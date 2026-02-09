/* Workouts Month Planner (Layout v3)
 * - Renders a month calendar (dynamic month length) in a 7-column grid
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
  const todayBtn = $("#todayBtn");
  const monthPicker = $("#monthPicker");
  const datePicker = $("#datePicker");
  const rangePillText = $("#rangePillText");
  const clearRangeBtn = $("#clearRangeBtn");

  // ---- Month model ----
  // Month view is controlled by the Month + Date pickers in the header.
  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth(); // 0=Jan
  let selectedISO = null;
  let rangeFromISO = "";
  let rangeToISO = "";

  function pad2(n){ return String(n).padStart(2,"0"); }
  function isoFromDate(d){
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }

  function dateFromISO(iso){
    const p = String(iso||"").split("-").map(Number);
    if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return null;
    return new Date(p[0], p[1]-1, p[2]);
  }

  function addDays(d, n){
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function clampISOToRange(iso, fromISO, toISO){
    if (!iso || !fromISO || !toISO) return iso;
    if (iso < fromISO) return fromISO;
    if (iso > toISO) return toISO;
    return iso;
  }

  // default selected date: today
  selectedISO = isoFromDate(now);

  function startOfMonth(year, month){ return new Date(year, month, 1); }

  function endOfMonth(year, month){
    // day 0 of next month = last day of current month
    return new Date(year, month + 1, 0);
  }

  function friendlyMonthLabel(year, month){
    const m = new Date(year, month, 1).toLocaleString(undefined, { month: "long" });
    const days = endOfMonth(year, month).getDate();
    return `${m} ${year} · 1–${days}`;
  }

  function friendlyRangeLabel(fromISO, toISO){
    const a = dateFromISO(fromISO);
    const b = dateFromISO(toISO);
    if (!a || !b) return "Custom range";
    const sameYear = a.getFullYear() === b.getFullYear();
    const sameMonth = sameYear && a.getMonth() === b.getMonth();
    const optsA = { month: "short", day: "numeric" };
    const optsB = sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" };
    const left = a.toLocaleDateString(undefined, optsA);
    const right = b.toLocaleDateString(undefined, optsB);
    const year = sameYear ? ` ${a.getFullYear()}` : ` ${a.getFullYear()}–${b.getFullYear()}`;
    return `${left}–${right}${year}`;
  }

  function updateRangePill(){
    if (!rangePillText) return;
    if (rangeFromISO && rangeToISO && rangeFromISO !== rangeToISO){
      rangePillText.textContent = friendlyRangeLabel(rangeFromISO, rangeToISO);
      document.getElementById('rangePill')?.classList?.remove('is-hidden');
    } else {
      rangePillText.textContent = "Drag to range";
      document.getElementById('rangePill')?.classList?.add('is-hidden');
    }
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

    // If user selected a valid date range, render only that period.
    const hasRange = !!(rangeFromISO && rangeToISO && rangeFromISO <= rangeToISO);

    // Update range pill UI
    if (rangePillText){
      rangePillText.textContent = hasRange ? friendlyRangeLabel(rangeFromISO, rangeToISO) : "Drag to range";
    }
    const rangePill = clearRangeBtn?.closest?.('.rangePill');
    if (rangePill){
      rangePill.classList.toggle('is-hidden', !hasRange);
    }

    const periodStart = hasRange ? dateFromISO(rangeFromISO) : startOfMonth(viewYear, viewMonth);
    const periodEnd = hasRange ? dateFromISO(rangeToISO) : endOfMonth(viewYear, viewMonth);
    const fromISO = hasRange ? rangeFromISO : isoFromDate(periodStart);
    const toISO = hasRange ? rangeToISO : isoFromDate(periodEnd);

    // Keep selection inside range when filtering.
    if (hasRange){
      selectedISO = clampISOToRange(selectedISO, rangeFromISO, rangeToISO);
    }

    if (monthLabel){
      monthLabel.textContent = hasRange
        ? `Range · ${friendlyRangeLabel(fromISO, toISO)}`
        : friendlyMonthLabel(viewYear, viewMonth);
    }

    const byDate = listByDate(fromISO, toISO);

    // Clear
    monthGrid.innerHTML = "";

    // Calendar alignment: add leading blanks so the first day lands on correct weekday
    const leading = periodStart.getDay(); // 0 Sun ... 6 Sat
    const cells = [];
    for (let i=0;i<leading;i++) cells.push({ empty:true });

    // Build cells across the period (either month or custom range)
    let cursor = new Date(periodStart);
    let iDay = 1;
    while (cursor <= periodEnd){
      const iso = isoFromDate(cursor);
      // Show the day number within its month, not the index within range
      cells.push({ empty:false, day: cursor.getDate(), iso, dow: cursor.getDay() });
      cursor = addDays(cursor, 1);
      iDay++;
      if (iDay > 400) break; // safety
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
      if (selectedISO && c.iso === selectedISO) cell.classList.add("is-selected");
      if (selectedISO && c.iso === selectedISO) cell.classList.add("selected");

      // Range highlight
      if (hasRange && c.iso >= rangeFromISO && c.iso <= rangeToISO){
        cell.classList.add('in-range');
        if (c.iso === rangeFromISO) cell.classList.add('range-start');
        if (c.iso === rangeToISO) cell.classList.add('range-end');
      }

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
      // Show *all* workouts for the day. If there are many, the list becomes scrollable.
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

    // Click: open this exact workout inside the day's planner.
    card.style.cursor = "pointer";
    card.addEventListener("click", (e) => {
      // Don't block drag/drop: only treat as click if not dragging.
      if (drag) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const d = w.date || card.closest('.month-cell')?.dataset?.date;
      if (!d) return;
      location.href = `plan_workout.html?date=${encodeURIComponent(d)}&workoutId=${encodeURIComponent(w.id)}`;
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
    const t = new Date();
    viewYear = t.getFullYear();
    viewMonth = t.getMonth();
    selectedISO = isoFromDate(t);
    syncPickers();
    render();
    // try to scroll the today cell into view
    const todayISO = selectedISO;
    const el = monthGrid?.querySelector(`.month-cell[data-date="${todayISO}"]`);
    if (el) el.scrollIntoView({ behavior:"smooth", block:"center", inline:"center" });
  }

  function syncPickers(){
    if (monthPicker){
      monthPicker.value = `${viewYear}-${pad2(viewMonth+1)}`;
    }
    if (datePicker && selectedISO){
      datePicker.value = selectedISO;
    }
    // Range pill is updated in render() (so it always reflects the active view).
  }

  // --- controls ---
  if (todayBtn) todayBtn.addEventListener("click", gotoToday);

  // Make the whole date "pill" clickable (not just the small native input).
  // This fixes cases where users click the pill but the browser doesn't open the picker.
  (function enablePillClickFocus(){
    const pills = document.querySelectorAll('.workoutsDateControls .datePill');
    pills.forEach((pill) => {
      pill.addEventListener('click', (e) => {
        // Don't steal clicks from the clear (×) button on the range pill.
        if (e.target && e.target.closest && e.target.closest('.pillX')) return;
        const input = pill.querySelector('input.dateInput');
        if (!input) return;
        // Focus first so screen readers / keyboard users also benefit.
        try { input.focus({ preventScroll: true }); } catch { input.focus(); }
        // Chrome/Edge support showPicker() for month/date inputs.
        if (typeof input.showPicker === 'function') {
          try { input.showPicker(); } catch (_) { /* ignore */ }
        }
      });
    });
  })();

  if (monthPicker){
    monthPicker.addEventListener("change", () => {
      const val = String(monthPicker.value || "");
      const m = val.match(/^(\d{4})-(\d{2})$/);
      if (!m) return;

      // Switching months exits range filtering
      rangeFromISO = "";
      rangeToISO = "";
      viewYear = Number(m[1]);
      viewMonth = Math.max(0, Math.min(11, Number(m[2]) - 1));
      // keep selected day if it is within the new month; otherwise select 1st
      const keepDay = selectedISO ? Number(selectedISO.slice(8,10)) : 1;
      const maxDay = endOfMonth(viewYear, viewMonth).getDate();
      const day = Math.max(1, Math.min(maxDay, keepDay));
      selectedISO = `${viewYear}-${pad2(viewMonth+1)}-${pad2(day)}`;
      syncPickers();
      render();
    });
  }

  if (datePicker){
    datePicker.addEventListener("change", () => {
      const val = String(datePicker.value || "");
      if (!val) return;
      selectedISO = val;
      const parts = val.split("-").map(Number);
      if (parts.length === 3){
        viewYear = parts[0];
        viewMonth = parts[1] - 1;
      }
      syncPickers();
      render();
      const el = monthGrid?.querySelector(`.month-cell[data-date="${selectedISO}"]`);
      if (el) el.scrollIntoView({ behavior:"smooth", block:"center", inline:"center" });
    });
  }

  // --- Range selection inside the calendar ---
  // Press a day cell, then drag to another day cell to set a visible period.
  (function enableRangeSelect(){
    if (!monthGrid) return;
    let isSelecting = false;
    let anchorISO = "";
    let didDrag = false;

    const isInteractive = (el) => !!el?.closest?.('.wCard, .month-add, button, a, input, select, textarea');
    const getCellISO = (el) => el?.closest?.('.month-cell')?.dataset?.date || "";

    // Use capture so a user can start a range drag even when pressing on
    // nested non-interactive elements inside a cell. We still exclude cards/
    // buttons/etc via isInteractive().
    monthGrid.addEventListener('pointerdown', (e) => {
      if (isInteractive(e.target)) return;
      const iso = getCellISO(e.target);
      if (!iso) return;
      // Start selecting (prevents drag-pan)
      e.preventDefault();
      // Don't use stopImmediatePropagation here; it can interfere with other
      // click/interaction handlers in some browsers after a re-render.
      isSelecting = true;
      didDrag = false;
      anchorISO = iso;
      selectedISO = iso;
      rangeFromISO = iso;
      rangeToISO = iso;

      // Keep month picker in sync with the pressed day
      const d = dateFromISO(iso);
      if (d){ viewYear = d.getFullYear(); viewMonth = d.getMonth(); }
      syncPickers();
      render();
      try { monthGrid.setPointerCapture(e.pointerId); } catch(_){ }
      monthGrid.classList.add('is-selecting');
    }, { capture: true });

    monthGrid.addEventListener('pointermove', (e) => {
      if (!isSelecting) return;
      // Prevent the drag-pan handler from running while selecting.
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      const iso = getCellISO(e.target) || (document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.month-cell')?.dataset?.date || "");
      if (!iso) return;
      if (iso !== rangeToISO){
        didDrag = didDrag || iso !== anchorISO;
        // Normalize
        rangeFromISO = (anchorISO <= iso) ? anchorISO : iso;
        rangeToISO = (anchorISO <= iso) ? iso : anchorISO;
        selectedISO = clampISOToRange(selectedISO, rangeFromISO, rangeToISO);
        render();
      }
    });

    const endSelect = (e) => {
      if (!isSelecting) return;
      isSelecting = false;
      try { monthGrid.releasePointerCapture(e.pointerId); } catch(_){ }
      monthGrid.classList.remove('is-selecting');

      // Tap w/out dragging => just select the day (no range filter)
      if (!didDrag){
        rangeFromISO = "";
        rangeToISO = "";
      }
      syncPickers();
      render();
    };
    monthGrid.addEventListener('pointerup', endSelect);
    monthGrid.addEventListener('pointercancel', endSelect);
    // Safety: if pointerup is missed for any reason, ensure we always release
    // selection mode so header controls never become "dead".
    window.addEventListener('pointerup', endSelect, { passive: true });
    window.addEventListener('pointercancel', endSelect, { passive: true });
  })();
  if (clearRangeBtn){
    clearRangeBtn.addEventListener("click", () => {
      rangeFromISO = "";
      rangeToISO = "";
      // snap back to current month of selection
      if (selectedISO){
        const p = selectedISO.split("-").map(Number);
        if (p.length === 3){
          viewYear = p[0];
          viewMonth = p[1] - 1;
        }
      }
      syncPickers();
      render();
    });
  }

  // --- Drag-to-scroll (mobile & desktop) ---
  // On small screens we disable page scrolling and let users pan the calendar by dragging.
  (function enableDragPan(){
    if (!monthGrid) return;

    let isPanning = false;
    let startX = 0, startY = 0;
    let startScrollLeft = 0, startScrollTop = 0;

    const isInteractive = (el) => {
      if (!el) return false;
      // Don't pan when interacting with cards/controls OR when pressing a day cell (range selection).
      return !!el.closest('.wCard, .month-add, .month-cell[data-date], button, a, input, select, textarea');
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
  syncPickers();
  render();
})();
