/* Workouts Week Planner (Layout v3)
 * - Renders a 7-day week grid
 * - Uses window.Workouts (workouts.js) as the single source of truth
 * - Drag & drop to move/reorder workouts between days
 *
 * Data conventions:
 * - workout.date is ISO YYYY-MM-DD
 * - workout.dayOrder (optional) is used to order workouts within a day
 */

(function(){
  "use strict";

  const Workouts = window.Workouts;
  if (!Workouts){
    console.error("Workouts API not found. Ensure workouts.js is loaded before workouts_v3.js");
    return;
  }

  const el = {
    weekGrid: document.getElementById("weekGrid"),
    prevWeek: document.getElementById("prevWeek"),
    nextWeek: document.getElementById("nextWeek"),
    todayBtn: document.getElementById("todayBtn"),
    headerSubtle: document.querySelector(".workouts-header .subtle"),
  };
  if (!el.weekGrid) return;

  const dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]; // Monday-first
  const monthShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; 

  const iso = (d) => {
    const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    return dt.toISOString().slice(0,10);
  };

  const parseIso = (s) => {
    const [y,m,d] = String(s||"").split("-").map(Number);
    if (!y||!m||!d) return new Date();
    return new Date(y, m-1, d);
  };

  function startOfWeek(date){
    // Monday start
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dow = (d.getDay()+6)%7; // Mon=0..Sun=6
    d.setDate(d.getDate() - dow);
    return d;
  }

  function addDays(date, n){
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + n);
    return d;
  }

  function fmtDay(date){
    return `${monthShort[date.getMonth()]} ${date.getDate()}`;
  }

  function fmtWeekRange(weekStart){
    const a = weekStart;
    const b = addDays(weekStart, 6);
    const sameMonth = a.getMonth() === b.getMonth();
    const sameYear = a.getFullYear() === b.getFullYear();
    const left = `${monthShort[a.getMonth()]} ${a.getDate()}`;
    const right = `${sameMonth ? "" : (monthShort[b.getMonth()] + " ")}${b.getDate()}${sameYear ? "" : (", " + b.getFullYear())}`;
    return `Week of ${left} – ${right}`;
  }

  const todayIso = iso(new Date());
  let viewDate = new Date(); // any day within the viewed week

  // DnD state
  const dnd = {
    draggingId: null,
    placeholder: null,
    overColumn: null,
  };

  function ensurePlaceholder(){
    if (dnd.placeholder) return dnd.placeholder;
    const p = document.createElement("div");
    p.className = "drop-placeholder";
    dnd.placeholder = p;
    return p;
  }

  function getWeekRange(weekStart){
    return { from: iso(weekStart), to: iso(addDays(weekStart, 6)) };
  }

  function getWorkoutsForWeek(weekStart){
    const {from,to} = getWeekRange(weekStart);
    // listWorkouts returns inclusive range
    const list = Workouts.listWorkouts({from, to}) || [];
    return list;
  }

  function sortForDay(list){
    return list.slice().sort((a,b)=>{
      const ao = (typeof a.dayOrder === "number") ? a.dayOrder : 1e9;
      const bo = (typeof b.dayOrder === "number") ? b.dayOrder : 1e9;
      if (ao !== bo) return ao - bo;
      // stable-ish fallback
      const at = String(a.createdAt||"");
      const bt = String(b.createdAt||"");
      if (at && bt && at !== bt) return at < bt ? -1 : 1;
      return String(a.id).localeCompare(String(b.id));
    });
  }

  function normalizeDayOrder(dateIso, orderedIds){
    (orderedIds||[]).forEach((id, idx)=>{
      try{ Workouts.updateWorkout(id, { date: dateIso, dayOrder: idx }); }catch(_){ }
    });
  }

  function buildCard(w){
    const card = document.createElement("div");
    card.className = "workout-card";
    if (w.status === "completed") card.classList.add("is-completed");
    card.draggable = true;
    card.dataset.workoutId = w.id;

    const title = document.createElement("div");
    title.className = "workout-title";
    title.textContent = w.name || "Workout";

    const sub = document.createElement("div");
    sub.className = "workout-sub";
    sub.textContent = w.status === "completed" ? "Completed" : (w.status === "in_progress" ? "In progress" : "Planned");

    card.appendChild(title);
    card.appendChild(sub);

    // Quick open: navigate to active workout view if your app supports it
    // For now, toggle status with a double click (small quality-of-life).
    card.addEventListener("dblclick", ()=>{
      try{
        const next = (w.status === "completed") ? "planned" : "completed";
        Workouts.updateWorkout(w.id, { status: next });
        render();
      }catch(_){ }
    });

    // Drag events
    card.addEventListener("dragstart", (e)=>{
      dnd.draggingId = w.id;
      try{
        e.dataTransfer.setData("text/plain", w.id);
        e.dataTransfer.effectAllowed = "move";
      }catch(_){ }
      card.classList.add("is-dragging");
    });
    card.addEventListener("dragend", ()=>{
      dnd.draggingId = null;
      card.classList.remove("is-dragging");
      cleanupPlaceholder();
      clearDropHighlights();
    });

    // Allow drop positioning relative to cards
    card.addEventListener("dragover", (e)=>{
      e.preventDefault();
      const col = card.closest(".day-column");
      if (!col) return;
      positionPlaceholder(col, e.clientY);
    });

    return card;
  }

  function cleanupPlaceholder(){
    if (dnd.placeholder && dnd.placeholder.parentElement){
      dnd.placeholder.parentElement.removeChild(dnd.placeholder);
    }
  }

  function clearDropHighlights(){
    document.querySelectorAll(".day-column.is-dropTarget").forEach(n=>n.classList.remove("is-dropTarget"));
  }

  function positionPlaceholder(columnEl, pointerY){
    const p = ensurePlaceholder();
    const list = Array.from(columnEl.querySelectorAll(".workout-card:not(.is-dragging)"));
    // Find insertion point
    let inserted = false;
    for (const card of list){
      const r = card.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (pointerY < mid){
        if (card.previousSibling !== p) columnEl.insertBefore(p, card);
        inserted = true;
        break;
      }
    }
    if (!inserted){
      // Before the add button if exists, else at end
      const add = columnEl.querySelector(".add-workout");
      if (add) columnEl.insertBefore(p, add);
      else columnEl.appendChild(p);
    }
  }

  function wireColumnDnD(columnEl){
    columnEl.addEventListener("dragover", (e)=>{
      e.preventDefault();
      columnEl.classList.add("is-dropTarget");
      positionPlaceholder(columnEl, e.clientY);
    });
    columnEl.addEventListener("dragleave", (e)=>{
      // If leaving to a child, ignore
      if (columnEl.contains(e.relatedTarget)) return;
      columnEl.classList.remove("is-dropTarget");
    });
    columnEl.addEventListener("drop", (e)=>{
      e.preventDefault();
      const dateIso = columnEl.dataset.date;
      const id = dnd.draggingId || (function(){
        try{ return e.dataTransfer.getData("text/plain"); }catch(_){ return null; }
      })();
      if (!id || !dateIso) return;

      // Collect intended order for this day based on DOM (placeholder position)
      const ids = [];
      const kids = Array.from(columnEl.children);
      for (const k of kids){
        if (k.classList.contains("workout-card") && !k.classList.contains("is-dragging")) ids.push(k.dataset.workoutId);
        if (k.classList.contains("drop-placeholder")) ids.push(id);
      }
      // If placeholder wasn't used (rare), append
      if (!ids.includes(id)) ids.push(id);

      // Persist: move + reorder
      normalizeDayOrder(dateIso, ids);

      cleanupPlaceholder();
      clearDropHighlights();
      render();
    });
  }

  function createDayColumn(date, workoutsForDay){
    const dateIso = iso(date);

    const col = document.createElement("div");
    col.className = "day-column";
    col.dataset.date = dateIso;
    if (dateIso === todayIso) col.classList.add("today");

    const head = document.createElement("div");
    head.className = "day-head";
    const dn = document.createElement("div");
    dn.className = "day-name";
    dn.textContent = dayNames[(date.getDay()+6)%7];
    const dd = document.createElement("div");
    dd.className = "day-date";
    dd.textContent = fmtDay(date);
    head.appendChild(dn);
    head.appendChild(dd);
    col.appendChild(head);

    const list = sortForDay(workoutsForDay);
    list.forEach(w=> col.appendChild(buildCard(w)));

    const add = document.createElement("div");
    add.className = "add-workout";
    add.textContent = "+ Plan workout";
    add.addEventListener("click", ()=>{
      const name = prompt("Workout name", "Workout");
      if (name === null) return;
      try{
        const w = Workouts.createWorkout({ name: String(name||"Workout").trim() || "Workout", date: dateIso, status: "planned" });
        // Put at end of day
        const dayWs = (Workouts.listWorkouts({from: dateIso, to: dateIso})||[]).filter(x=>x.date===dateIso);
        const maxOrder = dayWs.reduce((m,x)=> Math.max(m, (typeof x.dayOrder === "number") ? x.dayOrder : -1), -1);
        Workouts.updateWorkout(w.id, { dayOrder: maxOrder + 1 });
        render();
      }catch(err){
        console.error(err);
      }
    });
    col.appendChild(add);

    wireColumnDnD(col);
    return col;
  }

  function render(){
    const ws = startOfWeek(viewDate);
    if (el.headerSubtle) el.headerSubtle.textContent = fmtWeekRange(ws);

    const all = getWorkoutsForWeek(ws);
    const byDate = new Map();
    all.forEach(w=>{
      const d = String(w.date||"");
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d).push(w);
    });

    el.weekGrid.innerHTML = "";
    for (let i=0;i<7;i++){
      const d = addDays(ws, i);
      const dIso = iso(d);
      const col = createDayColumn(d, byDate.get(dIso) || []);
      el.weekGrid.appendChild(col);
    }
  }

  function shiftWeek(delta){
    viewDate = addDays(startOfWeek(viewDate), delta*7);
    render();
  }

  // Controls
  el.prevWeek && el.prevWeek.addEventListener("click", ()=>shiftWeek(-1));
  el.nextWeek && el.nextWeek.addEventListener("click", ()=>shiftWeek(1));
  el.todayBtn && el.todayBtn.addEventListener("click", ()=>{ viewDate = new Date(); render(); });

  // Re-render when returning to the tab (common after editing elsewhere)
  document.addEventListener("visibilitychange", ()=>{ if (!document.hidden) render(); });

  // Initial
  render();
})();
