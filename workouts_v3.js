/* Workouts Month Planner (Layout v3)
 * - Renders a February calendar (1..28) in a 7-column grid
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
  if (!Workouts) {
    console.error("Workouts API missing (workouts.js not loaded).");
    return;
  }

  const $ = (sel, root=document) => root.querySelector(sel);

  const monthGrid = $("#monthGrid");
  const monthLabel = $("#wMonthLabel");
  const prevBtn = $("#prevMonth");
  const nextBtn = $("#nextMonth");
  const todayBtn = $("#todayBtn");

  // ---- Month model: February 1..28 (as requested) ----
  // We keep it deterministic: February of the current year.
  // If you later want full month navigation, we already support prev/next.
  let viewYear = new Date().getFullYear();
  let viewMonth = 1; // 0=Jan, 1=Feb

  function pad2(n){ return String(n).padStart(2,"0"); }
  function isoFromDate(d){
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }

  function startOfMonth(year, month){ return new Date(year, month, 1); }

  function clampToFebDays(d){
    // Ensures we only show 1..28 for Feb, per user requirement
    const day = d.getDate();
    if (day < 1) d.setDate(1);
    if (day > 28) d.setDate(28);
    return d;
  }

  function friendlyMonthLabel(year, month){
    const m = new Date(year, month, 1).toLocaleString(undefined, { month: "long" });
    return `${m} ${year} · 1–28`;
  }

  // ---- DnD state ----
  let drag = null; // { workoutId, fromDate }

  function sortWithinDay(a,b){
    const ao = (a.dayOrder ?? 9999);
    const bo = (b.dayOrder ?? 9999);
    if (ao !== bo) return ao - bo;
    // stable fallback: createdAt then id
    const ac = (a.createdAt ?? 0);
    const bc = (b.createdAt ?? 0);
    if (ac !== bc) return ac - bc;
    return String(a.id).localeCompare(String(b.id));
  }

  function listByDate(fromISO, toISO){
    const items = Workouts.listWorkouts({ from: fromISO, to: toISO }) || [];
    const map = new Map();
    for (const w of items){
      if (!w.date) continue;
      if (!map.has(w.date)) map.set(w.date, []);
      map.get(w.date).push(w);
    }
    for (const [k, arr] of map.entries()){
      arr.sort(sortWithinDay);
      map.set(k, arr);
    }
    return map;
  }

  function render(){
    if (!monthGrid) return;

    const monthStart = startOfMonth(viewYear, viewMonth); // Feb 1
    const febStart = new Date(viewYear, 1, 1);
    const febEnd = new Date(viewYear, 1, 28);
    const fromISO = isoFromDate(febStart);
    const toISO = isoFromDate(febEnd);

    if (monthLabel) monthLabel.textContent = friendlyMonthLabel(viewYear, viewMonth);

    const byDate = listByDate(fromISO, toISO);

    // Clear
    monthGrid.innerHTML = "";

    // Calendar alignment: add leading blanks so Feb 1 lands on correct weekday
    const leading = febStart.getDay(); // 0 Sun ... 6 Sat
    const totalDays = 28;
    const cells = [];
    for (let i=0;i<leading;i++) cells.push({ empty:true });
    for (let day=1; day<=totalDays; day++){
      const d = new Date(viewYear, 1, day);
      const iso = isoFromDate(d);
      cells.push({ empty:false, day, iso, dow: d.getDay() });
    }
    // trailing to complete weeks
    const trailing = (7 - (cells.length % 7)) % 7;
    for (let i=0;i<trailing;i++) cells.push({ empty:true });

    const todayISO = isoFromDate(new Date());

    const dowNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

    for (const c of cells){
      const cell = document.createElement("div");
      cell.className = "month-cell";
      if (c.empty){
        cell.classList.add("is-empty");
        monthGrid.appendChild(cell);
        continue;
      }

      cell.dataset.date = c.iso;
      if (c.iso === todayISO) cell.classList.add("today");

      // Head (day number + dow)
      const head = document.createElement("div");
      head.className = "month-head";

      const dayNum = document.createElement("div");
      dayNum.className = "month-daynum";
      dayNum.textContent = String(c.day);

      const dow = document.createElement("div");
      dow.className = "month-dow";
      dow.textContent = dowNames[c.dow];

      head.appendChild(dayNum);
      head.appendChild(dow);

      const list = document.createElement("div");
      list.className = "month-list";

      const items = (byDate.get(c.iso) || []);
      for (const w of items){
        list.appendChild(renderWorkoutCard(w));
      }

      const addBtn = document.createElement("button");
      addBtn.className = "month-add tap";
      addBtn.type = "button";
      addBtn.textContent = "Workouts";
      addBtn.addEventListener("click", () => {
        // Go to a dedicated screen for planning
        location.href = `plan_workout.html?date=${encodeURIComponent(c.iso)}`;
      });

      // Drop target
      cell.addEventListener("dragover", (e) => {
        if (!drag) return;
        e.preventDefault();
        cell.classList.add("is-dropTarget");
      });
      cell.addEventListener("dragleave", () => cell.classList.remove("is-dropTarget"));
      cell.addEventListener("drop", (e) => {
        if (!drag) return;
        e.preventDefault();
        cell.classList.remove("is-dropTarget");
        const targetDate = cell.dataset.date;

        const afterId = getAfterCardId(list, e.clientY);
        moveWorkout(drag.workoutId, targetDate, afterId);
        drag = null;
        render();
      });

      cell.appendChild(head);
      cell.appendChild(list);
      cell.appendChild(addBtn);
      monthGrid.appendChild(cell);
    }
  }

  function renderWorkoutCard(w){
    const card = document.createElement("div");
    card.className = "wCard";
    card.draggable = true;
    card.dataset.id = w.id;

    const title = document.createElement("div");
    title.className = "wTitle";
    title.textContent = w.name || "Workout";

    const meta = document.createElement("div");
    meta.className = "wMeta";
    meta.textContent = statusLabel(w.status);

    card.appendChild(title);
    card.appendChild(meta);

    card.addEventListener("dragstart", () => {
      drag = { workoutId: w.id, fromDate: w.date };
      card.classList.add("is-dragging");
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("is-dragging");
      drag = null;
    });

    // click opens workout details if available (fallback: no-op)
    card.addEventListener("click", () => {
      // If you have a workout detail page, route there:
      // location.href = `workout_session.html?id=${encodeURIComponent(w.id)}`;
    });

    return card;
  }

  function statusLabel(status){
    const s = String(status || "planned").toLowerCase();
    if (s === "completed" || s === "done" || s === "finished") return "Completed";
    if (s === "in_progress" || s === "inprogress" || s === "active") return "In progress";
    return "Planned";
  }

  function getAfterCardId(listEl, mouseY){
    // Determine reordering position inside the day list based on Y
    const cards = [...listEl.querySelectorAll(".wCard")].filter(c => !c.classList.contains("is-dragging"));
    let closest = { offset: Number.NEGATIVE_INFINITY, id: null };
    for (const c of cards){
      const box = c.getBoundingClientRect();
      const offset = mouseY - (box.top + box.height/2);
      if (offset < 0 && offset > closest.offset){
        closest = { offset, id: c.dataset.id };
      }
    }
    return closest.id; // insert before this id (or null => append)
  }

  function moveWorkout(workoutId, targetDate, beforeWorkoutId){
    const w = Workouts.getWorkout(workoutId);
    if (!w) return;

    const oldDate = w.date;
    // Update date first
    Workouts.updateWorkout(workoutId, { date: targetDate });

    // Reorder within target day by assigning dayOrder
    const items = Workouts.listWorkouts({ from: targetDate, to: targetDate }) || [];
    const others = items.filter(x => x.id !== workoutId).sort((a,b)=> (a.dayOrder??9999)-(b.dayOrder??9999));

    const newOrder = [];
    if (beforeWorkoutId){
      for (const it of others){
        if (String(it.id) === String(beforeWorkoutId)) newOrder.push(w);
        newOrder.push(it);
      }
      // If before id wasn't found, append
      if (!newOrder.includes(w)) newOrder.unshift(w);
    } else {
      newOrder.push(...others, w);
    }

    // Normalize dayOrder to 10,20,30...
    newOrder.forEach((it, idx) => {
      Workouts.updateWorkout(it.id, { dayOrder: (idx+1)*10 });
    });

    // If moving out of old day, normalize old day too
    if (oldDate && oldDate !== targetDate){
      const oldItems = Workouts.listWorkouts({ from: oldDate, to: oldDate }) || [];
      oldItems.sort((a,b)=> (a.dayOrder??9999)-(b.dayOrder??9999)).forEach((it, idx) => {
        Workouts.updateWorkout(it.id, { dayOrder: (idx+1)*10 });
      });
    }
  }

  function gotoToday(){
    viewYear = new Date().getFullYear();
    viewMonth = 1; // Feb
    render();
    // try to scroll the today cell into view
    const todayISO = isoFromDate(new Date());
    const el = monthGrid?.querySelector(`.month-cell[data-date="${todayISO}"]`);
    if (el) el.scrollIntoView({ behavior:"smooth", block:"center", inline:"center" });
  }

  // --- controls ---
  if (todayBtn) todayBtn.addEventListener("click", gotoToday);

  if (prevBtn) prevBtn.addEventListener("click", () => {
    // month nav (kept even though we show only Feb 1..28)
    viewYear = viewYear - 1; // Previous year Feb
    render();
  });

  if (nextBtn) nextBtn.addEventListener("click", () => {
    viewYear = viewYear + 1; // Next year Feb
    render();
  });


  // --- Drag-to-scroll (mobile & desktop) ---
  // On small screens we disable page scrolling and let users pan the calendar by dragging.
  (function enableDragPan(){
    if (!monthGrid) return;

    let isPanning = false;
    let startX = 0, startY = 0;
    let startScrollLeft = 0, startScrollTop = 0;

    const isInteractive = (el) => {
      if (!el) return false;
      return !!el.closest('.wCard, button, a, input, select, textarea');
    };

    monthGrid.addEventListener('pointerdown', (e) => {
      // Don't hijack interactions with cards/buttons/links
      if (isInteractive(e.target)) return;
      // Only pan on small screens OR when using mouse middle button? We'll allow always.
      isPanning = true;
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = monthGrid.scrollLeft;
      startScrollTop = monthGrid.scrollTop;
      monthGrid.setPointerCapture(e.pointerId);
      monthGrid.classList.add('is-panning');
    });

    monthGrid.addEventListener('pointermove', (e) => {
      if (!isPanning) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      monthGrid.scrollLeft = startScrollLeft - dx;
      monthGrid.scrollTop = startScrollTop - dy;
    });

    const endPan = (e) => {
      if (!isPanning) return;
      isPanning = false;
      try { monthGrid.releasePointerCapture(e.pointerId); } catch(_){}
      monthGrid.classList.remove('is-panning');
    };
    monthGrid.addEventListener('pointerup', endPan);
    monthGrid.addEventListener('pointercancel', endPan);
    monthGrid.addEventListener('pointerleave', endPan);
  })();

  // initial render
  render();
})();
