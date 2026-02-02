/* Workouts Page UI (Increment 1)
 * Uses window.Workouts from workouts.js
 * Adds app-like "Active workout" view: exercises + sets, inline edit, add set/exercise, start/finish.
 */
(function(){
  const $ = (sel) => document.querySelector(sel);

  const el = {
    title: $("#w3Title"),
    subtitle: $("#w3Subtitle"),
    metaSets: $("#w3MetaSets"),
    metaVol: $("#w3MetaVol"),
    metaTime: $("#w3MetaTime"),
    content: $("#w3Content"),
    empty: $("#w3Empty"),
    btnAddExercise: $("#w3AddExercise"),
    btnAddExerciseEmpty: $("#w3AddExerciseEmpty"),
    btnStart: $("#w3Start"),
    btnFinish: $("#w3Finish"),
    btnRest60: $("#w3Rest60"),
    restTimer: $("#w3RestTimer"),
    restTime: $("#w3RestTime"),
    restStop: $("#w3RestStop"),
    tabs: $("#w3Tabs"),
    modalOverlay: $("#w3ModalOverlay"),
    modalInput: $("#w3ExerciseName"),
    modalOk: $("#w3ModalOk"),
    modalCancel: $("#w3ModalCancel"),
  };

  // Increment 2: PR flash state
  let prFlashSetId = null;
  let prFlashTimer = null;

  // Tabs
  let currentTab = "today";

  function flashPR(setId){
    prFlashSetId = setId;
    if (prFlashTimer) clearTimeout(prFlashTimer);
    render();
    prFlashTimer = setTimeout(()=>{
      if (prFlashSetId === setId){
        prFlashSetId = null;
        render();
      }
    }, 1450);
  }

  // Increment 3: Rest timer (persisted)
  const REST_KEY = "w3_restTimer_v1";
  let restInterval = null;

  function loadRest(){
    try{
      const raw = localStorage.getItem(REST_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || !obj.endAt) return null;
      return obj;
    }catch(_){ return null; }
  }

  function saveRest(state){
    try{
      if (!state) localStorage.removeItem(REST_KEY);
      else localStorage.setItem(REST_KEY, JSON.stringify(state));
    }catch(_){}
  }

  function fmtClock(sec){
    const s = Math.max(0, sec|0);
    const mm = String(Math.floor(s/60)).padStart(2,"0");
    const ss = String(s%60).padStart(2,"0");
    return `${mm}:${ss}`;
  }

  function startRest(seconds){
    const now = Date.now();
    const st = { running:true, endAt: now + Math.max(1, seconds|0)*1000 };
    saveRest(st);
    showRest();
  }

  function stopRest(){
    saveRest(null);
    hideRest();
  }

  function showRest(){
    if (!el.restTimer) return;
    el.restTimer.hidden = false;
    tickRest();
    if (restInterval) clearInterval(restInterval);
    restInterval = setInterval(tickRest, 250);
  }

  function hideRest(){
    if (!el.restTimer) return;
    el.restTimer.hidden = true;
    el.restTimer.classList.remove("w3-restDone");
    if (restInterval) { clearInterval(restInterval); restInterval = null; }
  }

  function tickRest(){
    const st = loadRest();
    if (!st || !st.endAt) { hideRest(); return; }
    const remaining = Math.max(0, Math.ceil((st.endAt - Date.now())/1000));
    if (el.restTime) el.restTime.textContent = fmtClock(remaining);
    if (remaining <= 0){
      saveRest(null);
      if (el.restTimer){
        el.restTimer.classList.add("w3-restDone");
        try{ if (navigator.vibrate) navigator.vibrate([40,40,40]); }catch(_){}
      }
      setTimeout(()=>hideRest(), 1200);
    }
  }

  // Swipe state (pointer-based, works on touch + mouse)
  const SWIPE_MAX = 92;
  const SWIPE_THRESHOLD = 60;
  const swipe = { active:false, row:null, startX:0, dx:0, pointerId:null };



  function isoDate(d=new Date()){
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,"0");
    const da=String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${da}`;
  }

  function getWorkoutId(){
    const p=new URLSearchParams(location.search);
    return p.get("id") || p.get("workoutId") || null;
  }

  function setWorkoutId(id){
    const url=new URL(location.href);
    url.searchParams.set("id", id);
    history.replaceState({}, "", url.toString());
  }

  function safe(fn, fallback){
    try { return fn(); } catch(e){ console.warn(e); return fallback; }
  }

  function fmtInt(n){
    const x = Number(n||0);
    return x.toLocaleString("en-US");
  }

  function secondsToClock(sec){
    const s = Math.max(0, Number(sec||0)|0);
    const mm = String(Math.floor(s/60)).padStart(2,"0");
    const ss = String(s%60).padStart(2,"0");
    return `${mm}:${ss}`;
  }

  function ensureWorkout(){
    let id = getWorkoutId();
    if (id) {
      const w = safe(()=>Workouts.getWorkout(id), null);
      if (w) return w;
    }

    // No id: open today's planned/in_progress/completed workout if exists; else create.
    const today = isoDate();
    const todays = safe(()=>Workouts.listWorkouts({from: today, to: today}), []);
    let w = (todays || []).slice().sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")))[0] || null;

    if (!w) {
      w = safe(()=>Workouts.createWorkout({name:"Workout", date: today}), null);
    }
    if (w?.id) setWorkoutId(w.id);
    return w;
  }

  function computeMeta(workoutId){
    const s = safe(()=>Workouts.computeWorkoutSummary(workoutId), null);
    if (s) return s;
    return { totalSets:0, totalVolumeKg:0 };
  }

  function render(){
    // Tabs
    if (currentTab === "history") { renderHistory(); return; }
    if (currentTab === "templates") { renderTemplates(); return; }
    if (!window.Workouts) {
      el.content.innerHTML = `<div class="w3-empty"><div class="w3-emptyTitle">Workouts API missing</div><div class="w3-muted">window.Workouts not loaded.</div></div>`;
      el.empty.hidden = true;
      return;
    }

    const workout = ensureWorkout();
    if (!workout) {
      el.content.innerHTML = `<div class="w3-empty"><div class="w3-emptyTitle">No workout</div><div class="w3-muted">Could not create or load a workout.</div></div>`;
      el.empty.hidden = true;
      return;
    }

    el.title.textContent = workout.name || "Workout";
    el.subtitle.textContent = `${workout.status || "planned"} · ${workout.date || "—"}`;

    const meta = computeMeta(workout.id);
    el.metaSets.textContent = fmtInt(meta.totalSets || 0);
    el.metaVol.textContent = fmtInt(Math.round(meta.totalVolumeKg || 0));
    el.metaTime.textContent = workout.durationSec ? secondsToClock(workout.durationSec) : "--:--";

    const exercises = safe(()=>Workouts.listExercises(workout.id), []);
    el.content.innerHTML = "";

    if (!exercises.length) {
      el.empty.hidden = false;
      return;
    }
    el.empty.hidden = true;

    for (const ex of exercises) {
      const sets = safe(()=>Workouts.listSets(ex.id), []);
      const card = document.createElement("section");
      card.className = "w3-exCard";
      card.dataset.exerciseId = ex.id;
      card.dataset.exerciseName = ex.name || "";

      card.innerHTML = `
        <div class="w3-exHeader">
          <div>
            <div class="w3-hSection">${esc(ex.name || "Exercise")}</div>
            ${ex.notes ? `<div class="w3-exSub">${esc(ex.notes)}</div>` : ``}
          </div>
          <button class="w3-iconBtn" data-action="ex-menu" aria-label="Exercise menu">⋮</button>
        </div>

        <div class="w3-setLabels" aria-hidden="true">
          <div></div><div>set</div><div>kg</div><div>reps</div>
        </div>

        <div class="w3-sets">
          ${sets.map((s,i)=>setRowHtml(s,i, ex.id, ex.name)).join("")}
        </div>

        <button class="w3-addSet" data-action="add-set">+ Add set</button>
      `;

      el.content.appendChild(card);
    }
  }

  function setRowHtml(s, index, exerciseId, exerciseName){
    const done = !!s.completed;
    const w = (s.weightKg ?? "");
    const r = (s.reps ?? "");
    const isPR = (prFlashSetId && prFlashSetId === s.id);

    return `
      <div class="w3-swipeWrap" data-set-id="${escAttr(s.id)}" data-exercise-name="${escAttr(exerciseName||"")}">
        <div class="w3-swipeAction left" data-action="dup-set">Duplicate</div>
        <div class="w3-swipeAction right" data-action="del-set">Delete</div>

        <div class="w3-setRow ${done ? "isDone" : ""} ${isPR ? "isPR" : ""}" data-set-id="${escAttr(s.id)}" data-exercise-name="${escAttr(exerciseName||"")}">
          <div class="w3-check ${done ? "isDone" : ""}" data-action="toggle-set" role="button" aria-label="Toggle set"></div>
          <div class="w3-setIndex">${index+1}</div>
          <input class="w3-input" data-field="weightKg" inputmode="decimal" value="${escAttr(String(w))}" placeholder="kg" />
          <input class="w3-input" data-field="reps" inputmode="numeric" value="${escAttr(String(r))}" placeholder="reps" />

          <div class="w3-hoverActions" aria-hidden="true">
            <button class="w3-miniBtn" data-action="dup-set" title="Duplicate">Dup</button>
            <button class="w3-miniBtn danger" data-action="del-set" title="Delete">Del</button>
          </div>
        </div>
      </div>
    `;
  }

  // Events: add set / toggle / menu

  function findExerciseContextFromSetId(setId){
    const row = el.content.querySelector(`.w3-setRow[data-set-id="${cssEsc(setId)}"]`);
    const card = row ? row.closest(".w3-exCard") : null;
    return {
      row,
      card,
      exerciseId: card ? card.dataset.exerciseId : null,
      exerciseName: card ? (card.dataset.exerciseName || "") : ""
    };
  }

  function duplicateSet(setId){
    const ctx = findExerciseContextFromSetId(setId);
    if (!ctx.exerciseId) return;
    const sets = safe(()=>Workouts.listSets(ctx.exerciseId), []);
    const srcSet = sets.find(s => String(s.id) === String(setId));
    if (!srcSet) return;

    const cloneDefaults = {
      weightKg: srcSet.weightKg ?? null,
      reps: srcSet.reps ?? null,
      completed: false
    };
    const newSet = safe(()=>Workouts.addSet(ctx.exerciseId, cloneDefaults), null);
    if (!newSet) return;

    // Reorder to place directly after original
    const ordered = sets.slice().sort((a,b)=>Number(a.order||0)-Number(b.order||0)).map(s=>s.id);
    const insertAt = Math.max(0, ordered.findIndex(id=>String(id)===String(setId))) + 1;
    const next = ordered.slice(0, insertAt).concat([newSet.id]).concat(ordered.slice(insertAt));
    safe(()=>Workouts.reorderSets(ctx.exerciseId, next), null);
  }

  function deleteSet(setId){
    safe(()=>Workouts.removeSet(setId), null);
  }

  function maybeFlashPR(setId, exerciseName, oldPR){
    if (!exerciseName) return;

    const ctx = findExerciseContextFromSetId(setId);
    const exerciseId = ctx.exerciseId;
    if (!exerciseId) return;

    const sets = safe(()=>Workouts.listSets(exerciseId), []);
    const s = sets.find(x=>String(x.id)===String(setId));
    if (!s || !s.completed) return;

    const w = Number(s.weightKg || 0);
    const r = Number(s.reps || 0);
    const v = w * r;

    const before = oldPR || {};
    const oldW = Number(before.maxWeightKg || 0);
    const oldR = Number(before.maxReps || 0);
    const oldV = Number(before.maxVolumeKg || 0);

    if ((w > oldW && w > 0) || (r > oldR && r > 0) || (v > oldV && v > 0)) {
      flashPR(setId);
    }
  }

// Pointer swipe handling (Apple-style)
  el.content.addEventListener("pointerdown", (e)=>{
    const row = e.target.closest(".w3-setRow");
    if (!row) return;

    // don't start swipe when editing inputs
    if (e.target.closest("input")) return;

    swipe.active = true;
    swipe.row = row;
    swipe.startX = e.clientX;
    swipe.dx = 0;
    swipe.pointerId = e.pointerId;

    try { row.setPointerCapture(e.pointerId); } catch(_) {}
  });

  el.content.addEventListener("pointermove", (e)=>{
    if (!swipe.active || !swipe.row || e.pointerId !== swipe.pointerId) return;
    const dx = e.clientX - swipe.startX;
    swipe.dx = Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, dx));
    swipe.row.style.transform = `translateX(${swipe.dx}px)`;
  });

  el.content.addEventListener("pointerup", (e)=>{
    if (!swipe.active || !swipe.row || e.pointerId !== swipe.pointerId) return;
    const row = swipe.row;
    const dx = swipe.dx;

    const setId = row.dataset.setId;
    const card = row.closest(".w3-exCard");
    const exerciseName = card ? (card.dataset.exerciseName || "") : "";

    const reset = () => {
      row.style.transform = "translateX(0)";
      row.style.transition = "transform .22s ease";
      setTimeout(()=>{ if(row) row.style.transition = ""; }, 260);
    };

    if (dx > SWIPE_THRESHOLD) {
      row.style.transform = `translateX(${SWIPE_MAX}px)`;
      setTimeout(()=>{
        duplicateSet(setId);
        reset();
        render();
      }, 120);
    } else if (dx < -SWIPE_THRESHOLD) {
      row.style.transform = `translateX(-${SWIPE_MAX}px)`;
      setTimeout(()=>{
        deleteSet(setId);
        render();
      }, 120);
    } else {
      reset();
    }

    swipe.active = false;
    swipe.row = null;
    swipe.pointerId = null;
    swipe.dx = 0;
  });

  el.content.addEventListener("pointercancel", ()=>{
    if (swipe.row) swipe.row.style.transform = "translateX(0)";
    swipe.active = false;
    swipe.row = null;
    swipe.pointerId = null;
    swipe.dx = 0;
  });

  el.content.addEventListener("click", (e)=>{
    const act = e.target.closest("[data-action]");
    if (!act) return;
    const action = act.dataset.action;

    const card = act.closest(".w3-exCard");
    const exerciseId = card?.dataset.exerciseId;

    const setRow = act.closest(".w3-setRow");
    const setId = setRow?.dataset.setId;
    const exerciseName = card?.dataset.exerciseName || "";

    if (action === "dup-set") {
      if (!setId) return;
      duplicateSet(setId);
      render();
      return;
    }

    if (action === "del-set") {
      if (!setId) return;
      deleteSet(setId);
      render();
      return;
    }

    if (action === "add-set") {
      if (!exerciseId) return;
      safe(()=>Workouts.addSet(exerciseId, { completed:false }), null);
      render();
    }
    if (action === "toggle-set") {
      const row = act.closest(".w3-setRow");
      const setId = row?.dataset.setId;
      if (!setId) return;

      // Snapshot PRs BEFORE completion to detect improvements reliably
      const oldPR = exerciseName ? safe(()=>Workouts.getExercisePRs(exerciseName), null) : null;

      safe(()=>Workouts.toggleSetCompleted(setId), null);

      // Auto start rest when completing a set
      const ctx = findExerciseContextFromSetId(setId);
      if (ctx.exerciseId){
        const sets = safe(()=>Workouts.listSets(ctx.exerciseId), []);
        const s = sets.find(x=>String(x.id)===String(setId));
        if (s && s.completed){
          startRest(Number(s.restSec || 60));
          maybeFlashPR(setId, exerciseName, oldPR);
        }
      }

      render();
      return;
    }
    if (action === "ex-menu") {
      // Increment 1 keeps it minimal
      console.log("Exercise menu (next increment)");
    }
  });

  // Inline edit
  el.content.addEventListener("change", (e)=>{
    const inp = e.target.closest(".w3-input");
    if (!inp) return;

    const row = inp.closest(".w3-setRow");
    const setId = row?.dataset.setId;
    const card = inp.closest(".w3-exCard");
    const exerciseName = card?.dataset.exerciseName || "";
    const field = inp.dataset.field;
    if (!setId || !field) return;

    const raw = String(inp.value||"").trim();

    // Snapshot PRs for this exercise (used if set is already completed)
    const oldPRInline = exerciseName ? safe(()=>Workouts.getExercisePRs(exerciseName), null) : null;
    if (raw === "") {
      safe(()=>Workouts.updateSet(setId, { [field]: null }), null);
      render();
      return;
    }
    const num = Number(raw.replace(",", "."));
    if (Number.isNaN(num)) { render(); return; }

    safe(()=>Workouts.updateSet(setId, { [field]: num }), null);

    // If this set is already completed, an edit can create a new PR
    if (exerciseName) {
      const ctx2 = findExerciseContextFromSetId(setId);
      if (ctx2.exerciseId){
        const sets2 = safe(()=>Workouts.listSets(ctx2.exerciseId), []);
        const s2 = sets2.find(x=>String(x.id)===String(setId));
        if (s2 && s2.completed) maybeFlashPR(setId, exerciseName, oldPRInline);
      }
    }
    if (field === "weightKg") {
      // If the set is already completed, we may have created a PR
      maybeFlashPR(setId, exerciseName);
    }
    render();
  });


  // Modal (replaces native prompt)
  function openAddExerciseModal(onSubmit){
    if (!el.modalOverlay || !el.modalInput) return;
    el.modalOverlay.hidden = false;
    el.modalInput.value = "";
    el.modalInput.focus();

    const submit = () => {
      const name = (el.modalInput.value || "").trim();
      if (!name) return;
      closeAddExerciseModal();
      onSubmit(name);
    };

    const onKey = (ev) => {
      if (ev.key === "Escape") { ev.preventDefault(); closeAddExerciseModal(); }
      if (ev.key === "Enter") { ev.preventDefault(); submit(); }
    };

    const onBg = (ev) => {
      if (ev.target === el.modalOverlay) closeAddExerciseModal();
    };

    // one-shot listeners
    el.modalOk?.addEventListener("click", submit, { once:true });
    el.modalCancel?.addEventListener("click", closeAddExerciseModal, { once:true });
    el.modalInput.addEventListener("keydown", onKey, { once:true });
    el.modalOverlay.addEventListener("click", onBg, { once:true });
  }

  function closeAddExerciseModal(){
    if (!el.modalOverlay) return;
    el.modalOverlay.hidden = true;
  }

  function promptExerciseName(){
    // fallback (should not be used)
    const name = prompt("Exercise name (e.g. Bench Press):");
    if (!name) return null;
    const tt = name.trim();
    return tt ? tt : null;
  }

  function addExercise(){
    const w = ensureWorkout();
    if (!w) return;
    // open nice modal instead of prompt
    if (el.modalOverlay && el.modalInput){
      openAddExerciseModal((name)=>{
        safe(()=>Workouts.addExercise(w.id, { name }), null);
        render();
      });
      return;
    }
    // fallback
    const name = promptExerciseName();
    if (!name) return;
    safe(()=>Workouts.addExercise(w.id, { name }), null);
    render();
  }

  el.btnAddExercise?.addEventListener("click", addExercise);
  el.btnAddExerciseEmpty?.addEventListener("click", addExercise);

  // Tabs switching
  el.tabs?.addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-tab]");
    if (!btn) return;
    currentTab = btn.dataset.tab || "today";
    for (const b of el.tabs.querySelectorAll(".w3-tabBtn")) b.classList.remove("is-active");
    btn.classList.add("is-active");
    render();
  });

  el.btnStart?.addEventListener("click", ()=>{
    const w = ensureWorkout();
    if (!w) return;
    safe(()=>Workouts.startWorkout(w.id), null);
    render();
  });

  el.btnFinish?.addEventListener("click", ()=>{
    const w = ensureWorkout();
    if (!w) return;
    safe(()=>Workouts.finishWorkout(w.id), null);
    render();
  });

  function esc(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
  function escAttr(s){ return esc(s).replaceAll("\n"," "); }
  function cssEsc(s){
    const v = String(s);
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(v);
    return v.replace(/[^a-zA-Z0-9_-]/g, (ch)=>"\\\\" + ch);
  }

  render();
  const st = loadRest();
  if (st && st.endAt && st.endAt > Date.now()) showRest();
})();
