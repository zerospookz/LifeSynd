(function(){
  "use strict";
  const Workouts = window.Workouts;
  if (!Workouts) return;

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const params = new URLSearchParams(location.search);
  const date = params.get("date");        // ISO YYYY-MM-DD
  let workoutId = params.get("workoutId");

  // Elements
  const bigDateEl = $("#pwBigDate");
  const sublineEl = $("#pwSubline");
  const nameEl = $("#pwName");
  const tplSel = $("#pwTemplate");
  const applyTplBtn = $("#pwApplyTemplate");
  const savedEl = $("#pwSavedState");
  const exWrap = $("#pwExercises");

  const backBtn = $("#pwBack");
  const cancelBtn = $("#pwCancel");
  const doneBtn = $("#pwDone");
  const addExBtn = $("#pwAddExercise");

  // Sheet
  const overlay = $("#exOverlay");
  const sheet = $("#exSheet");
  const closeSheetBtn = $("#exClose");
  const searchEl = $("#exSearch");
  const chipsEl = $("#exChips");
  const listEl = $("#exList");

  // State
  let workout = null;
  let saveTimer = null;
  let activeChip = "Recent";
  let draggingId = null;

  // --- Utils ---
  function pretty(iso){
    try{
      const [y,m,d] = iso.split("-").map(Number);
      const dt = new Date(y, m-1, d);
      return dt.toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric", year:"numeric" });
    }catch(e){ return iso || "—"; }
  }

  function setSavedState(text){
    if (!savedEl) return;
    savedEl.textContent = text;
    savedEl.style.opacity = (text === "Saved") ? ".65" : ".9";
  }

  function goBack(){
    location.href = "workouts.html";
  }

  function debounceSave(fn, ms=350){
    clearTimeout(saveTimer);
    setSavedState("Saving…");
    saveTimer = setTimeout(() => {
      try { fn(); setSavedState("Saved"); }
      catch(e){ console.error(e); setSavedState("Error"); }
    }, ms);
  }

  function ensureWorkout(){
    if (workoutId){
      workout = Workouts.getWorkout(workoutId);
      if (workout) return workout;
    }

    // If there's already a workout for this date, reuse the newest planned/in_progress one.
    if (date){
      const existing = (Workouts.listWorkouts({from: date, to: date}) || [])
        .filter(w => ["planned","in_progress"].includes(w.status))
        .sort((a,b) => (a.updatedAt || "").localeCompare(b.updatedAt || ""));
      if (existing.length){
        workout = existing[existing.length - 1];
        workoutId = workout.id;
        params.set("workoutId", workoutId);
        history.replaceState(null, "", "plan_workout.html?" + params.toString());
        return workout;
      }
    }

    workout = Workouts.createWorkout({ date: date || undefined, name: "Workout" });
    workoutId = workout.id;
    params.set("workoutId", workoutId);
    history.replaceState(null, "", "plan_workout.html?" + params.toString());
    return workout;
  }

  // --- Template handling ---
  function loadTemplates(){
    const tpls = Workouts.listTemplates() || [];
    tplSel.innerHTML = "";
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "None";
    tplSel.appendChild(none);

    tpls.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      tplSel.appendChild(opt);
    });

    if (workout && workout.templateId){
      tplSel.value = workout.templateId;
    }
  }

  function applyTemplate(){
    if (!workout) return;
    const templateId = tplSel.value;
    if (!templateId) return;

    const tpls = Workouts.listTemplates() || [];
    const tpl = tpls.find(t => t.id === templateId);
    if (!tpl) return;

    const current = Workouts.listExercises(workout.id) || [];
    if (current.length){
      const ok = confirm("Replace current exercises with this template?");
      if (!ok) return;
      current.forEach(ex => Workouts.removeExercise(ex.id));
    }

    // Apply template to existing workout
    Workouts.updateWorkout(workout.id, { templateId: templateId });
    // If user hasn't changed the default name, gently set the template name
    if ((workout.name || "").trim().toLowerCase() === "workout"){
      Workouts.updateWorkout(workout.id, { name: tpl.name || "Workout" });
      nameEl.value = tpl.name || "Workout";
    }

    (tpl.exercises || []).forEach((exName, idx) => {
      const ex = Workouts.addExercise(workout.id, { name: exName, order: idx });
      Workouts.addSets(ex.id, 3, { kind: "work", restSec: 90, completed: false });
    });

    workout = Workouts.getWorkout(workout.id);
    renderExercises();
    setSavedState("Saved");
  }

  // --- Exercise catalog / picker ---
  const EX_CATALOG = [
    // Push
    {name:"Bench Press", tag:"Chest", cat:"Push"},
    {name:"Incline Dumbbell Press", tag:"Chest", cat:"Push"},
    {name:"Overhead Press", tag:"Shoulders", cat:"Push"},
    {name:"Dumbbell Shoulder Press", tag:"Shoulders", cat:"Push"},
    {name:"Dips", tag:"Chest/Triceps", cat:"Push"},
    {name:"Triceps Pushdown", tag:"Triceps", cat:"Push"},
    {name:"Lateral Raise", tag:"Delts", cat:"Push"},

    // Pull
    {name:"Pull-up", tag:"Back", cat:"Pull"},
    {name:"Lat Pulldown", tag:"Back", cat:"Pull"},
    {name:"Barbell Row", tag:"Back", cat:"Pull"},
    {name:"Seated Cable Row", tag:"Back", cat:"Pull"},
    {name:"Face Pull", tag:"Rear delts", cat:"Pull"},
    {name:"Biceps Curl", tag:"Biceps", cat:"Pull"},
    {name:"Hammer Curl", tag:"Biceps", cat:"Pull"},

    // Legs
    {name:"Back Squat", tag:"Quads", cat:"Legs"},
    {name:"Front Squat", tag:"Quads", cat:"Legs"},
    {name:"Leg Press", tag:"Quads", cat:"Legs"},
    {name:"Romanian Deadlift", tag:"Hamstrings", cat:"Legs"},
    {name:"Deadlift", tag:"Posterior", cat:"Legs"},
    {name:"Leg Curl", tag:"Hamstrings", cat:"Legs"},
    {name:"Calf Raise", tag:"Calves", cat:"Legs"},

    // Core
    {name:"Plank", tag:"Core", cat:"Core"},
    {name:"Hanging Leg Raise", tag:"Core", cat:"Core"},
    {name:"Cable Crunch", tag:"Core", cat:"Core"},
    {name:"Russian Twist", tag:"Obliques", cat:"Core"},

    // Cardio
    {name:"Treadmill Run", tag:"Cardio", cat:"Cardio"},
    {name:"Stationary Bike", tag:"Cardio", cat:"Cardio"},
    {name:"Row Erg", tag:"Cardio", cat:"Cardio"},
    {name:"Jump Rope", tag:"Cardio", cat:"Cardio"},
  ];

  const CHIP_ORDER = ["Recent","Favorites","Push","Pull","Legs","Core","Cardio"];

  function favKey(){ return "pwFavExercises"; }
  function getFavs(){
    try{ return JSON.parse(localStorage.getItem(favKey()) || "[]"); }catch{ return []; }
  }
  function setFavs(arr){ localStorage.setItem(favKey(), JSON.stringify(arr)); }

  function getRecentNames(){
    // last unique exercise names from completed workouts, then planned/in_progress
    const ws = (Workouts.listWorkouts() || []).slice()
      .sort((a,b) => (a.date < b.date ? 1 : -1));
    const seen = new Set();
    const out = [];
    for (const w of ws){
      const exs = Workouts.listExercises(w.id) || [];
      for (const ex of exs){
        const n = (ex.name || "").trim();
        const key = n.toLowerCase();
        if (!n || seen.has(key)) continue;
        seen.add(key);
        out.push(n);
        if (out.length >= 10) return out;
      }
    }
    return out;
  }

  function lastUsedMeta(name){
    try{
      const hist = Workouts.getExerciseHistory(name, 1);
      if (!hist || !hist.length) return "";
      const p = hist[0];
      const w = Math.round(Number(p.topSetWeightKg || 0) * 10) / 10;
      const r = Math.round(Number(p.topSetReps || 0));
      if (!w && !r) return `Last: ${p.date}`;
      if (w && r) return `Last: ${r} reps @ ${w}kg`;
      if (w) return `Last: ${w}kg`;
      return `Last: ${r} reps`;
    }catch{ return ""; }
  }

  function openSheet(){
    overlay.hidden = false;
    sheet.hidden = false;
    requestAnimationFrame(() => {
      searchEl.value = "";
      searchEl.focus();
      activeChip = "Recent";
      renderChips();
      renderPickerList();
    });
  }

  function closeSheet(){
    overlay.hidden = true;
    sheet.hidden = true;
  }

  function renderChips(){
    chipsEl.innerHTML = "";
    for (const c of CHIP_ORDER){
      const b = document.createElement("button");
      b.className = "sheetChip" + (c === activeChip ? " active" : "");
      b.type = "button";
      b.textContent = c;
      b.addEventListener("click", () => {
        activeChip = c;
        renderChips();
        renderPickerList();
        searchEl.focus();
      });
      chipsEl.appendChild(b);
    }
  }

  function computePickerItems(){
    const q = (searchEl.value || "").trim().toLowerCase();
    const favs = new Set(getFavs().map(x => String(x).toLowerCase()));
    const recent = getRecentNames();

    let items = [];

    if (activeChip === "Recent"){
      items = recent.map(n => {
        const found = EX_CATALOG.find(x => x.name.toLowerCase() === n.toLowerCase());
        return found || { name: n, tag: "Recent", cat: "Recent" };
      });
    }else if (activeChip === "Favorites"){
      items = EX_CATALOG.filter(x => favs.has(x.name.toLowerCase()))
        .concat(recent.filter(n => favs.has(n.toLowerCase())).map(n => ({name:n, tag:"Favorite", cat:"Favorites"})));
      // de-dupe
      const seen = new Set();
      items = items.filter(x => {
        const k = x.name.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }else{
      items = EX_CATALOG.filter(x => x.cat === activeChip);
    }

    // search filters across the whole catalog if query is present
    if (q){
      const all = EX_CATALOG.slice();
      // include recents not in catalog
      for (const n of recent){
        if (!all.find(x => x.name.toLowerCase() === n.toLowerCase())){
          all.push({name:n, tag:"Recent", cat:"Recent"});
        }
      }
      items = all.filter(x => x.name.toLowerCase().includes(q));
    }

    // de-dupe + sort
    const seen = new Set();
    items = items.filter(x => {
      const k = x.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).sort((a,b) => a.name.localeCompare(b.name));

    return items;
  }

  function renderPickerList(){
    const items = computePickerItems();
    const favs = new Set(getFavs().map(x => String(x).toLowerCase()));
    listEl.innerHTML = "";

    if (!items.length){
      const empty = document.createElement("div");
      empty.style.padding = "14px 12px";
      empty.style.opacity = ".7";
      empty.textContent = "No results";
      listEl.appendChild(empty);
      return;
    }

    for (const it of items){
      const row = document.createElement("div");
      row.className = "exRow";
      row.setAttribute("role","listitem");

      const main = document.createElement("div");
      main.className = "exRowMain";

      const t = document.createElement("div");
      t.className = "exRowTitle";
      t.textContent = it.name;

      const m = document.createElement("div");
      m.className = "exRowMeta";
      const extra = lastUsedMeta(it.name);
      m.textContent = `${it.tag || it.cat || ""}${extra ? " · " + extra : ""}`.trim();

      main.appendChild(t);
      main.appendChild(m);

      const star = document.createElement("button");
      star.type = "button";
      star.className = "exStar" + (favs.has(it.name.toLowerCase()) ? " on" : "");
      star.textContent = favs.has(it.name.toLowerCase()) ? "★" : "☆";
      star.addEventListener("click", (e) => {
        e.stopPropagation();
        const cur = getFavs().map(x => String(x));
        const key = it.name.toLowerCase();
        const idx = cur.findIndex(x => x.toLowerCase() === key);
        if (idx >= 0) cur.splice(idx,1); else cur.unshift(it.name);
        setFavs(cur.slice(0,50));
        renderPickerList();
      });

      row.appendChild(main);
      row.appendChild(star);

      row.addEventListener("click", () => {
        addExerciseToWorkout(it.name);
        closeSheet();
      });

      listEl.appendChild(row);
    }
  }

  function addExerciseToWorkout(name){
    if (!workout) return;
    const ex = Workouts.addExercise(workout.id, { name, order: (Workouts.listExercises(workout.id) || []).length });
    Workouts.addSets(ex.id, 3, { kind: "work", restSec: 90, completed: false });
    renderExercises();
    setSavedState("Saved");
  }

  // --- Render exercise cards ---
  function renderExercises(){
    if (!workout) return;
    const exs = Workouts.listExercises(workout.id) || [];
    exWrap.innerHTML = "";

    if (!exs.length){
      const empty = document.createElement("div");
      empty.style.opacity = ".7";
      empty.style.padding = "10px 2px";
      empty.textContent = "No exercises yet. Tap “Add exercise” to start.";
      exWrap.appendChild(empty);
      return;
    }

    for (const ex of exs){
      const card = document.createElement("div");
      card.className = "exCard";
      card.draggable = true;
      card.dataset.exid = ex.id;

      const head = document.createElement("div");
      head.className = "exHead";

      const drag = document.createElement("div");
      drag.className = "exDrag";
      drag.textContent = "⠿";

      const title = document.createElement("div");
      title.className = "exTitle";
      title.textContent = ex.name || "Exercise";

      const menu = document.createElement("button");
      menu.className = "exMenuBtn";
      menu.type = "button";
      menu.textContent = "⋮";

      head.appendChild(drag);
      head.appendChild(title);
      head.appendChild(menu);

      const setsWrap = document.createElement("div");
      setsWrap.className = "exSets";

      const setList = Workouts.listSets(ex.id) || [];
      setList.forEach((s, idx) => {
        const row = document.createElement("div");
        row.className = "setRow";
        row.dataset.setid = s.id;

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !!s.completed;
        cb.addEventListener("change", () => {
          Workouts.toggleSetCompleted(s.id, cb.checked);
          setSavedState("Saved");
        });

        const num = document.createElement("div");
        num.className = "setNum";
        num.textContent = String(idx + 1);

        const reps = document.createElement("input");
        reps.className = "setInput";
        reps.type = "number";
        reps.inputMode = "numeric";
        reps.placeholder = "reps";
        reps.value = (s.reps ?? "");
        reps.addEventListener("input", () => debounceSave(() => Workouts.updateSet(s.id, { reps: reps.value === "" ? null : Number(reps.value) })));

        const wt = document.createElement("input");
        wt.className = "setInput";
        wt.type = "number";
        wt.step = "0.5";
        wt.inputMode = "decimal";
        wt.placeholder = "kg";
        wt.value = (s.weightKg ?? "");
        wt.addEventListener("input", () => debounceSave(() => Workouts.updateSet(s.id, { weightKg: wt.value === "" ? null : Number(wt.value) })));

        const rpe = document.createElement("input");
        rpe.className = "setInput";
        rpe.type = "number";
        rpe.step = "0.5";
        rpe.inputMode = "decimal";
        rpe.placeholder = "RPE";
        rpe.value = (s.rpe ?? "");
        rpe.addEventListener("input", () => debounceSave(() => Workouts.updateSet(s.id, { rpe: rpe.value === "" ? null : Number(rpe.value) })));

        row.appendChild(cb);
        row.appendChild(num);
        row.appendChild(reps);
        row.appendChild(wt);
        row.appendChild(rpe);

        setsWrap.appendChild(row);
      });

      const actions = document.createElement("div");
      actions.className = "exActions";

      const restBtn = document.createElement("button");
      restBtn.type = "button";
      restBtn.className = "chipBtn";
      restBtn.textContent = "Rest";
      restBtn.addEventListener("click", () => {
        try{
          Workouts.startRestTimer(90);
        }catch(e){ console.error(e); }
      });

      const addSetBtn = document.createElement("button");
      addSetBtn.type = "button";
      addSetBtn.className = "chipBtn";
      addSetBtn.textContent = "+ Add set";
      addSetBtn.addEventListener("click", () => {
        Workouts.addSet(ex.id, { kind:"work", restSec: 90, completed:false });
        renderExercises();
        setSavedState("Saved");
      });

      actions.appendChild(restBtn);
      actions.appendChild(addSetBtn);

      const notesWrap = document.createElement("div");
      notesWrap.className = "exNotes";
      notesWrap.hidden = true;
      const ta = document.createElement("textarea");
      ta.placeholder = "Notes…";
      ta.value = ex.notes || "";
      ta.addEventListener("input", () => debounceSave(() => Workouts.updateExercise(ex.id, { notes: ta.value })));
      notesWrap.appendChild(ta);

      // Menu behavior (simple inline menu via prompt)
      menu.addEventListener("click", () => {
        const choice = prompt("Type: delete / replace / notes", "");
        if (!choice) return;
        const c = choice.trim().toLowerCase();
        if (c === "delete"){
          if (confirm("Delete this exercise?")){
            Workouts.removeExercise(ex.id);
            renderExercises();
            setSavedState("Saved");
          }
        }else if (c === "replace"){
          // open picker and replace name on select (temporary mode)
          openSheet();
          const oldAdd = addExerciseToWorkout;
          // override one-time selection by hijacking click handler through a flag
          sheet.dataset.replaceExId = ex.id;
        }else if (c === "notes"){
          notesWrap.hidden = !notesWrap.hidden;
          if (!notesWrap.hidden) ta.focus();
        }
      });

      card.appendChild(head);
      card.appendChild(setsWrap);
      card.appendChild(actions);
      card.appendChild(notesWrap);

      // Drag & drop reorder
      card.addEventListener("dragstart", (e) => {
        draggingId = ex.id;
        card.style.opacity = ".65";
        e.dataTransfer.effectAllowed = "move";
        try{ e.dataTransfer.setData("text/plain", ex.id); }catch{}
      });
      card.addEventListener("dragend", () => {
        draggingId = null;
        card.style.opacity = "";
        $$(".exCard", exWrap).forEach(c => c.classList.remove("dragOver"));
        persistExerciseOrder();
      });
      card.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        card.classList.add("dragOver");
        const dragging = exWrap.querySelector(`.exCard[data-exid="${draggingId}"]`);
        if (!dragging || dragging === card) return;
        const rect = card.getBoundingClientRect();
        const before = (e.clientY - rect.top) < rect.height / 2;
        if (before) exWrap.insertBefore(dragging, card);
        else exWrap.insertBefore(dragging, card.nextSibling);
      });
      card.addEventListener("dragleave", () => card.classList.remove("dragOver"));
      card.addEventListener("drop", (e) => {
        e.preventDefault();
        card.classList.remove("dragOver");
        persistExerciseOrder();
      });

      exWrap.appendChild(card);
    }
  }

  function persistExerciseOrder(){
    if (!workout) return;
    const ids = $$(".exCard", exWrap).map(el => el.dataset.exid);
    if (ids.length) Workouts.reorderExercises(workout.id, ids);
  }

  // Replace mode: if sheet has replaceExId set, clicking a row should update that exercise name instead of adding
  function handlePickerClickIntercept(){
    const replaceId = sheet.dataset.replaceExId;
    if (!replaceId) return false;
    const name = arguments[0];
    Workouts.updateExercise(replaceId, { name });
    sheet.dataset.replaceExId = "";
    renderExercises();
    setSavedState("Saved");
    return true;
  }

  // Patch addExerciseToWorkout to support replace mode
  const _addExerciseToWorkout = addExerciseToWorkout;
  addExerciseToWorkout = function(name){
    if (sheet.dataset.replaceExId){
      Workouts.updateExercise(sheet.dataset.replaceExId, { name });
      sheet.dataset.replaceExId = "";
      renderExercises();
      setSavedState("Saved");
      return;
    }
    return _addExerciseToWorkout(name);
  };

  // --- Init ---
  workout = ensureWorkout();

  if (bigDateEl) bigDateEl.textContent = date ? pretty(date) : "—";
  if (sublineEl) sublineEl.textContent = date ? ("Schedule for · " + pretty(date)) : "Schedule";

  if (nameEl){
    nameEl.value = (workout && workout.name) ? workout.name : "";
    nameEl.addEventListener("input", () => {
      debounceSave(() => Workouts.updateWorkout(workout.id, { name: nameEl.value || "Workout" }));
    });
  }

  loadTemplates();

  if (applyTplBtn) applyTplBtn.addEventListener("click", applyTemplate);

  if (tplSel){
    tplSel.addEventListener("change", () => {
      debounceSave(() => Workouts.updateWorkout(workout.id, { templateId: tplSel.value || undefined }));
    });
  }

  renderExercises();
  setSavedState("Saved");

  // Buttons / navigation
  if (backBtn) backBtn.addEventListener("click", goBack);
  if (cancelBtn) cancelBtn.addEventListener("click", goBack);
  if (doneBtn) doneBtn.addEventListener("click", goBack);

  // Sheet listeners
  if (addExBtn) addExBtn.addEventListener("click", openSheet);
  if (overlay) overlay.addEventListener("click", closeSheet);
  if (closeSheetBtn) closeSheetBtn.addEventListener("click", closeSheet);

  if (searchEl){
    searchEl.addEventListener("input", () => renderPickerList());
  }

  // Keyboard: Esc to close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !sheet.hidden) closeSheet();
  });
})();