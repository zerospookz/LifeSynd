/* Workouts Page UI (Increment 1)
 * Uses window.Workouts from workouts.js
 * Adds app-like "Active workout" view: exercises + sets, inline edit, add set/exercise, start/finish.
 */
(function(){
  const $ = (sel) => document.querySelector(sel);

  const el = {
    page: $("#w3Page"),
    title: $("#w3Title"),
    subtitle: $("#w3Subtitle"),
    metaSets: $("#w3MetaSets"),
    metaVol: $("#w3MetaVol"),
    metaTime: $("#w3MetaTime"),
    content: $("#w3Content"),
    emptyWrap: $("#w3EmptyWrap"),
    emptySide: $("#w3EmptySide"),
    empty: $("#w3Empty"),
    todayDock: $("#w3TodayDock"),
    rpToday: $("#w3RpToday"),
    rightPanel: $("#w3RightPanel"),
    bottomBar: document.querySelector(".w3-bottomBar"),
    btnAddExercise: $("#w3AddExercise"),
    btnAddExerciseEmpty: $("#w3AddExerciseEmpty"),
    btnStart: $("#w3Start"),
    btnFinish: $("#w3Finish"),
    btnRest60: $("#w3Rest60"),
    restTimer: $("#w3RestTimer"),
    restTime: $("#w3RestTime"),
    restStop: $("#w3RestStop"),
    restProgress: $("#w3RestProgress"),
    // Right panel (desktop)
    rpLivePill: $("#w3RpLivePill"),
    rpSets: $("#w3RpSets"),
    rpVol: $("#w3RpVol"),
    rpTime: $("#w3RpTime"),
    rpPRsCount: $("#w3RpPRsCount"),

    rpNextCard: $("#w3RpNext"),
    rpNextSource: $("#w3RpNextSource"),
    rpNextName: $("#w3RpNextName"),
    rpNextSub: $("#w3RpNextSub"),
    rpStartSuggested: $("#w3RpStartSuggested"),
    rpAddSuggested: $("#w3RpAddSuggested"),

    rpCtxCard: $("#w3RpContext"),
    rpCtxName: $("#w3RpCtxName"),
    rpLastSession: $("#w3RpLastSession"),
    rpPRs: $("#w3RpPRs"),

    tabs: $("#w3Tabs"),
    sideTiles: $("#w3SideTiles"),
    modalOverlay: $("#w3ModalOverlay"),
    modalInput: $("#w3ExerciseName"),
    modalOk: $("#w3ModalOk"),
    modalCancel: $("#w3ModalCancel"),
  };

  // Desktop layout: move the right panel stack into the right utility column.
  // Mobile: keep it inside the bottom bar.
  function dockRightPanel(){
    const isDesktop = window.matchMedia("(min-width: 1100px)").matches;
    if (isDesktop){
      if (el.rightPanel && el.todayDock && !el.todayDock.contains(el.rightPanel)){
        el.todayDock.appendChild(el.rightPanel);
      }
    } else {
      if (!el.bottomBar) el.bottomBar = document.querySelector(".w3-bottomBar");
      if (el.rightPanel && el.bottomBar && !el.bottomBar.contains(el.rightPanel)){
        el.bottomBar.appendChild(el.rightPanel);
      }
    }
  }
  dockRightPanel();
  window.addEventListener("resize", ()=>{ dockRightPanel(); });



  // Increment 2: PR flash state
  let prFlashSetId = null;
  let prFlashTimer = null;

  // Track NEW PRs achieved during the current workout so Today summary can update instantly
  // and we can show them on completion.
  const SESSION_PRS_KEY_PREFIX = "w3_sessionPRs_";
  let sessionPRs = { workoutId: null, items: [] }; // items: [{setId, exerciseName, types:[] }]

  function loadSessionPRs(workoutId){
    sessionPRs = { workoutId: workoutId || null, items: [] };
    if (!workoutId) return;
    try{
      const raw = localStorage.getItem(SESSION_PRS_KEY_PREFIX + String(workoutId));
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj && Array.isArray(obj.items)) sessionPRs.items = obj.items;
    }catch(_){ }
  }

  function saveSessionPRs(){
    if (!sessionPRs?.workoutId) return;
    try{
      localStorage.setItem(SESSION_PRS_KEY_PREFIX + String(sessionPRs.workoutId), JSON.stringify({ items: sessionPRs.items }));
    }catch(_){ }
  }

  function recordSessionPR(setId, exerciseName, types){
    if (!sessionPRs?.workoutId) return;
    const sid = String(setId);
    const ex = String(exerciseName||"").trim();
    if (!sid || !ex) return;
    const t = (types||[]).filter(Boolean);
    const existing = (sessionPRs.items||[]).find(x=>String(x.setId)===sid);
    if (existing){
      // Merge types
      const merged = new Set([...(existing.types||[]), ...t]);
      existing.types = Array.from(merged);
    } else {
      sessionPRs.items.push({ setId: sid, exerciseName: ex, types: t });
    }
    saveSessionPRs();
  }

  function getSessionPRCount(){
    return (sessionPRs.items||[]).length;
  }

    // Active exercise (for in-card actions)
  let activeExerciseId = null;

// Right panel state
let suggestedExerciseName = null;
let workoutClockInterval = null;

// Exercise drag/reorder state
let currentWorkoutId = null;
const drag = {
  active:false,
  pointerId:null,
  card:null,
  ghost:null,
  placeholder:null,
  offsetX:0,
  offsetY:0,
};

// Long-press delete state (2.5s)
const holdDel = {
  t:null,
  pointerId:null,
  card:null,
  startX:0,
  startY:0,
};


// Tabs
// User request: remove tabs UI and keep a single "Today" experience.
let currentTab = "today";
  let _prevTotalSets = null; // for Today summary reveal animation

  function syncTabUI(){
    // Mobile tabs
    if (el.tabs){
      for (const b of el.tabs.querySelectorAll(".w3-tabBtn")) b.classList.remove("is-active");
      el.tabs.querySelector(`[data-tab="${currentTab}"]`)?.classList.add("is-active");
    }
    // Desktop tiles
    if (el.sideTiles){
      for (const b of el.sideTiles.querySelectorAll(".w3-sideTile")) b.classList.remove("is-active");
      el.sideTiles.querySelector(`[data-tab="${currentTab}"]`)?.classList.add("is-active");
    }
  }



  function setTab(tab){
    if (!tab) return;
    currentTab = tab;
    // Make tab state feel like a "page" change and keep it shareable/reloadable.
    // This also helps users who expect the right-side cards to "open" a section.
    try{
      const next = `#${tab}`;
      if (location.hash !== next) history.replaceState(null, "", next);
    }catch(_){ }
    syncTabUI();
    render();
  }

  // Tabs / quick-actions navigation
  document.addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-tab]");
    if (!btn) return;
    // Only handle our workouts tab buttons / quick buttons
    if (btn.classList.contains("w3-tabBtn") || btn.classList.contains("w3-emptyQuickBtn") || btn.classList.contains("w3-sideTile") || btn.classList.contains("w3-dockNavCard")){
      const tab = btn.getAttribute("data-tab");
      if (tab) setTab(tab);
    }
  });

  // Keyboard accessibility for dock cards
  document.addEventListener("keydown", (e)=>{
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target?.closest?.(".w3-dockNavCard[data-tab]");
    if (!card) return;
    e.preventDefault();
    const tab = card.getAttribute("data-tab");
    if (tab) setTab(tab);
  });

  // Empty-state animation helpers (hero expand/collapse)
  let _emptyHideTimer = null;
  function showEmpty(){
    if (_emptyHideTimer){ clearTimeout(_emptyHideTimer); _emptyHideTimer = null; }
    // Show wrapper
    if (el.emptyWrap) el.emptyWrap.hidden = false;
    // Keep Today summary in the right dock on desktop (same placement as non-empty).
    // This avoids layout jumps and keeps alignment consistent.
    // next frame so transitions apply
    requestAnimationFrame(()=> el.page?.classList.add("is-empty"));
  }
  function hideEmptyAnimated(){
    el.page?.classList.remove("is-empty");
    if (!el.emptyWrap || el.emptyWrap.hidden) return;
    if (_emptyHideTimer) clearTimeout(_emptyHideTimer);
    _emptyHideTimer = setTimeout(()=>{
      if (el.emptyWrap) el.emptyWrap.hidden = true;
    }, 280);
  }


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
  const REST_PRESET_KEY = "w3_restPresetSec_v2";
  // User request: allow any rest duration from 0:01 to 5:00.
  const REST_MIN = 1;
  const REST_MAX = 300;
  let restInterval = null;
  // SVG ring math (r=40 in workouts.html -> circumference ≈ 251.2)
  const REST_RING_R = 40;
  const REST_CIRC = 2 * Math.PI * REST_RING_R;

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

  function loadRestPreset(){
    try{
      const raw = localStorage.getItem(REST_PRESET_KEY);
      const n = parseInt(raw || "", 10);
      if (!Number.isFinite(n) || n < REST_MIN) return 60;
      return Math.min(REST_MAX, Math.max(REST_MIN, n|0));
    }catch(_){
      return 60;
    }
  }

  function saveRestPreset(sec){
    try{
      const v = Math.min(REST_MAX, Math.max(REST_MIN, sec|0));
      localStorage.setItem(REST_PRESET_KEY, String(v));
    }catch(_){ }
  }

  function labelRestButton(){
    if (!el.btnRest60) return;
    const sec = loadRestPreset();
    // Show as mm:ss but keep the compact "Rest" intent
    el.btnRest60.textContent = `Rest ${fmtClock(sec)}`;
  }

  // Start rest from the user's preset immediately.
  // Use modifier keys (Shift/Alt/Ctrl/Meta) to open the picker instead.
  function handleRestPrimaryClick(e){
    try{
      if (e && (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey)){
        openRestPicker();
        return;
      }
    }catch(_){ }
    startRest(loadRestPreset());
  }

  function startRest(seconds){
    const now = Date.now();
    const totalSec = Math.min(REST_MAX, Math.max(REST_MIN, seconds|0));
    const st = { running:true, startAt: now, totalSec, endAt: now + totalSec*1000 };
    saveRest(st);
    showRest();
  }

  // ===== Rest duration picker UI =====
  const restUI = {
    picker: document.getElementById('w3RestPicker'),
    pickerValue: document.getElementById('w3RestPickerValue'),
    pickerRange: document.getElementById('w3RestPickerRange'),
    pickerSec: document.getElementById('w3RestPickerSec'),
    pickerStart: document.getElementById('w3RestPickerStart'),
    pickerClose: document.getElementById('w3RestPickerClose'),
  };

  function setPickerValue(sec){
    const v = Math.min(REST_MAX, Math.max(REST_MIN, sec|0));
    if (restUI.pickerRange) restUI.pickerRange.value = String(v);
    if (restUI.pickerSec) restUI.pickerSec.value = String(v);
    if (restUI.pickerValue) restUI.pickerValue.textContent = fmtClock(v);
  }

  function openRestPicker(){
    if (!restUI.picker) return;
    const v = loadRestPreset();
    setPickerValue(v);
    restUI.picker.classList.add('is-open');
    if (el.btnRest60) el.btnRest60.setAttribute('aria-expanded','true');
  }

  function closeRestPicker(){
    if (!restUI.picker) return;
    restUI.picker.classList.remove('is-open');
    if (el.btnRest60) el.btnRest60.setAttribute('aria-expanded','false');
  }

  function toggleRestPicker(){
    if (!restUI.picker) return;
    if (restUI.picker.classList.contains('is-open')) closeRestPicker();
    else openRestPicker();
  }

  function stopRest(){
    saveRest(null);
    hideRest();
  }

  function showRest(){
    if (!el.restTimer) return;
    el.restTimer.hidden = false;
    // Smooth enter animation
    el.restTimer.classList.remove("w3-restDone", "w3-restUrgent");
    el.restTimer.classList.remove("is-on");
    requestAnimationFrame(()=>{ try{ el.restTimer.classList.add("is-on"); }catch(_){ } });
    // Prime ring values (in case first tick takes a moment)
    if (el.restProgress){
      el.restProgress.style.strokeDasharray = String(REST_CIRC);
      el.restProgress.style.strokeDashoffset = "0";
    }
    tickRest();
    if (restInterval) clearInterval(restInterval);
    restInterval = setInterval(tickRest, 250);
  }

  function hideRest(){
    if (!el.restTimer) return;
    // Fade out
    el.restTimer.classList.remove("is-on");
    el.restTimer.classList.remove("w3-restDone", "w3-restUrgent");
    setTimeout(()=>{
      if (!el.restTimer) return;
      el.restTimer.hidden = true;
    }, 180);
    if (el.restProgress){
      el.restProgress.style.strokeDashoffset = "0";
    }
    if (restInterval) { clearInterval(restInterval); restInterval = null; }
  }

  function tickRest(){
    const st = loadRest();
    if (!st || !st.endAt) { hideRest(); return; }
    const remaining = Math.max(0, Math.ceil((st.endAt - Date.now())/1000));
    if (el.restTime) el.restTime.textContent = fmtClock(remaining);

    // Last-seconds urgency animation
    if (el.restTimer){
      if (remaining > 0 && remaining <= 5) el.restTimer.classList.add("w3-restUrgent");
      else el.restTimer.classList.remove("w3-restUrgent");
    }

    // Update analog ring (1 = full remaining, 0 = done)
    if (el.restProgress){
      const totalSec = Math.max(1, (st.totalSec|0) || remaining || 60);
      const frac = Math.min(1, Math.max(0, remaining / totalSec));
      const dashOffset = REST_CIRC * (1 - frac);
      el.restProgress.style.strokeDasharray = String(REST_CIRC);
      el.restProgress.style.strokeDashoffset = String(dashOffset);
    }
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


  // ===== Increment 10: Exercise card drag & drop reorder (handle: ⋮) =====
  function listExerciseCards(){
    return Array.from(el.content?.querySelectorAll?.('.w3-exCard') || []);
  }

  function beginExerciseDrag(card, pointerId, clientX, clientY){
    if (!card || drag.active) return;
    const parent = card.parentElement;
    if (!parent) return;

    drag.active = true;
    drag.pointerId = pointerId;
    drag.card = card;

    const rect = card.getBoundingClientRect();
    drag.offsetX = clientX - rect.left;
    drag.offsetY = clientY - rect.top;

    // Placeholder keeps layout
    const ph = document.createElement('div');
    ph.className = 'w3-dragPlaceholder';
    ph.style.height = `${rect.height}px`;
    ph.style.width = `${rect.width}px`;
    drag.placeholder = ph;

    // Detach card and insert placeholder at its position
    parent.insertBefore(ph, card);
    parent.removeChild(card);

    // Ghost clone follows the pointer
    const ghost = card.cloneNode(true);
    ghost.classList.add('w3-dragGhost');
    ghost.style.width = `${rect.width}px`;
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    drag.ghost = ghost;
    document.body.appendChild(ghost);

    // Visual hint
    card.classList.add('is-dragging');

    try{ document.body.classList.add('w3-isReordering'); }catch(_){ }
  }

  function moveExerciseDrag(clientY){
    if (!drag.active || !drag.ghost || !drag.placeholder) return;
    const y = clientY - drag.offsetY;
    drag.ghost.style.top = `${y}px`;

    const cards = listExerciseCards().filter(c => c !== drag.card);
    const ph = drag.placeholder;
    const parent = ph.parentElement;
    if (!parent) return;

    // Find insertion point based on vertical midpoint
    let before = null;
    for (const c of cards){
      const r = c.getBoundingClientRect();
      const mid = r.top + r.height/2;
      if (clientY < mid){ before = c; break; }
    }
    if (before) parent.insertBefore(ph, before);
    else parent.appendChild(ph);
  }

  function endExerciseDrag(){
    if (!drag.active) return;
    const ph = drag.placeholder;
    const parent = ph?.parentElement;
    const card = drag.card;

    // Cleanup ghost
    try{ drag.ghost?.remove?.(); }catch(_){ }

    if (parent && ph && card){
      parent.insertBefore(card, ph);
      ph.remove();
    }

    // Persist order
    if (currentWorkoutId){
      const ordered = listExerciseCards().map(c => c.dataset.exerciseId).filter(Boolean);
      try{ Workouts.reorderExercises(currentWorkoutId, ordered); }catch(_){ }
    }

    try{ document.body.classList.remove('w3-isReordering'); }catch(_){ }

    drag.active = false;
    drag.pointerId = null;
    drag.card = null;
    drag.ghost = null;
    drag.placeholder = null;
  }

  // Start drag from the three-dots handle (tap or hold)
  // Hold-to-delete needs a non-passive listener so we can prevent default
  // (avoids text selection / context menu on mobile) and capture the pointer.
  document.addEventListener('pointerdown', (e)=>{
    const handle = e.target.closest && e.target.closest('[data-action="ex-menu"]');
    if (!handle) return;
    const card = handle.closest('.w3-exCard');
    if (!card) return;
    // Don't start reorder when user is selecting text or interacting with inputs
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    beginExerciseDrag(card, e.pointerId, e.clientX, e.clientY);
  }, { passive:false });

  document.addEventListener('pointermove', (e)=>{
    if (!drag.active) return;
    if (drag.pointerId !== null && e.pointerId !== drag.pointerId) return;
    moveExerciseDrag(e.clientY);
  });

  document.addEventListener('pointerup', (e)=>{
    if (!drag.active) return;
    if (drag.pointerId !== null && e.pointerId !== drag.pointerId) return;
    endExerciseDrag();
  });

  document.addEventListener('pointercancel', ()=>{ if (drag.active) endExerciseDrag(); });

  // Long-press (2.5s) on an exercise card to delete it
  function clearHoldDelete(){
    if (holdDel.t) clearTimeout(holdDel.t);
    holdDel.t = null;
    if (holdDel.card) holdDel.card.classList.remove('w3-holdDelete');
    // Release pointer capture if we took it.
    try{
      if (holdDel.card && holdDel.pointerId != null) holdDel.card.releasePointerCapture(holdDel.pointerId);
    }catch(_){ }
    holdDel.pointerId = null;
    holdDel.card = null;
  }

  document.addEventListener('pointerdown', (e)=>{
    const card = e.target.closest && e.target.closest('.w3-exCard');
    if (!card) return;
    // Only allow hold-to-delete from the "safe zone" (header/title area).
    // This prevents conflicts with drag (⋮), inputs, buttons, and scrolling.
    if (!e.target.closest('[data-hold-delete="1"]')) return;
    // Ignore interactions that should not trigger delete hold
    if (e.target.closest('input,button,a,textarea,select,[contenteditable]')) return;
    if (e.target.closest('[data-action="ex-menu"]')) return;
    if (drag.active) return;

    // Prevent the browser from starting text selection or long-press menus.
    // Also keep receiving pointer events even if the finger leaves the element.
    try{ e.preventDefault(); }catch(_){ }
    try{ e.stopPropagation(); }catch(_){ }

    holdDel.pointerId = e.pointerId;
    holdDel.card = card;
    holdDel.startX = e.clientX;
    holdDel.startY = e.clientY;
    card.classList.add('w3-holdDelete');

    try{ card.setPointerCapture(e.pointerId); }catch(_){ }

    holdDel.t = setTimeout(()=>{
      const id = card.dataset.exerciseId;
      if (!id) return;
      try{ if (navigator.vibrate) navigator.vibrate(35); }catch(_){ }
      try{ Workouts.removeExercise(id); }catch(_){ }
      clearHoldDelete();
      render();
    }, 2500);
  }, { passive:false });

  document.addEventListener('pointermove', (e)=>{
    if (!holdDel.card) return;
    if (holdDel.pointerId !== null && e.pointerId !== holdDel.pointerId) return;
    const dx = Math.abs(e.clientX - holdDel.startX);
    const dy = Math.abs(e.clientY - holdDel.startY);
    // Mobile finger jitter is real; use a larger threshold so holds can complete.
    // If the user meaningfully drags/scrolls, we cancel.
    if (dx > 24 || dy > 24) clearHoldDelete();
  }, { passive:false });

  document.addEventListener('pointerup', (e)=>{
    if (holdDel.pointerId !== null && e.pointerId !== holdDel.pointerId) return;
    clearHoldDelete();
  }, { passive:false });

  document.addEventListener('pointercancel', ()=>{ clearHoldDelete(); }, { passive:true });

  // iOS/Safari can fire a context menu on long press which cancels pointer events.
  // While we're in a hold-to-delete gesture, suppress it.
  document.addEventListener('contextmenu', (e)=>{
    if (!holdDel.card) return;
    try{ e.preventDefault(); }catch(_){ }
  }, { passive:false });



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

  
  let isReadOnly = false;

  // ===== Increment 4: History + Templates marketplace (v1) =====
  let historyRange = "all"; // week | month | all
  let templatesCat = "coach"; // coach | push | legs | home | all
  let templatePreviewId = null;
  let templatePreviewDayIdx = 0;

  const MARKET_KEY = "w3_market_templates_v1";
  function seedMarket(){
    try{
      const raw = localStorage.getItem(MARKET_KEY);
      if (raw) return;
      const seed = [
        {
          id:"tpl_push_hyp_a",
          title:"PUSH A — Hypertrophy",
          coach:"Coach Ivan",
          tags:["push","gym"],
          weeks:6,
          workouts:3,
          rating:4.6,
          reviews:128,
          price:9.99,
          currency:"USD",
          description:"A balanced upper-body hypertrophy plan focused on progressive overload.",
          preview:[
            { name:"Day 1 — Push A", exercises:[
              { name:"Bench Press", sets:[{weightKg:80,reps:8},{weightKg:80,reps:8},{weightKg:75,reps:10}] },
              { name:"Incline DB Press", sets:[{weightKg:24,reps:10},{weightKg:24,reps:10}] },
              { name:"Triceps Pushdown", sets:[{weightKg:30,reps:12},{weightKg:30,reps:12}] }
            ] },
            { name:"Day 2 — Push B", exercises:[
              { name:"Overhead Press", sets:[{weightKg:50,reps:6},{weightKg:50,reps:6},{weightKg:45,reps:8}] },
              { name:"DB Shoulder Press", sets:[{weightKg:22,reps:10},{weightKg:22,reps:10}] },
              { name:"Lateral Raise", sets:[{weightKg:10,reps:15},{weightKg:10,reps:15}] }
            ] },
            { name:"Day 3 — Push C", exercises:[
              { name:"Close-Grip Bench", sets:[{weightKg:70,reps:8},{weightKg:70,reps:8}] },
              { name:"Cable Fly", sets:[{weightKg:20,reps:12},{weightKg:20,reps:12}] },
              { name:"Overhead Triceps Ext", sets:[{weightKg:24,reps:12},{weightKg:24,reps:12}] }
            ] }
]
        },
        {
          id:"tpl_home_db",
          title:"Home Dumbbell Plan",
          coach:"FitLab",
          tags:["home"],
          weeks:4,
          workouts:3,
          rating:4.8,
          reviews:76,
          price:0,
          currency:"USD",
          description:"A simple 3x/week dumbbell plan for home workouts.",
          preview:[
            { name:"Day 1 — Full Body", exercises:[
              { name:"DB Goblet Squat", sets:[{weightKg:20,reps:12},{weightKg:20,reps:12}] },
              { name:"DB Floor Press", sets:[{weightKg:18,reps:10},{weightKg:18,reps:10}] }
            ] },
            { name:"Day 2 — Upper", exercises:[
              { name:"One-arm DB Row", sets:[{weightKg:22,reps:12},{weightKg:22,reps:12}] },
              { name:"DB Shoulder Press", sets:[{weightKg:16,reps:10},{weightKg:16,reps:10}] }
            ] },
            { name:"Day 3 — Lower", exercises:[
              { name:"DB RDL", sets:[{weightKg:24,reps:12},{weightKg:24,reps:12}] },
              { name:"Split Squat", sets:[{weightKg:14,reps:10},{weightKg:14,reps:10}] }
            ] }
]
        },
        {
          id:"tpl_legs_strength",
          title:"Legs Strength Block",
          coach:"Coach Maria",
          tags:["legs","gym"],
          weeks:5,
          workouts:3,
          rating:4.7,
          reviews:92,
          price:14.99,
          currency:"USD",
          description:"A squat-forward strength block with smart fatigue management.",
          preview:[
            { name:"Day 1 — Legs A", exercises:[
              { name:"Back Squat", sets:[{weightKg:120,reps:5},{weightKg:120,reps:5},{weightKg:110,reps:6}] },
              { name:"RDL", sets:[{weightKg:90,reps:8},{weightKg:90,reps:8}] }
            ] },
            { name:"Day 2 — Legs B", exercises:[
              { name:"Front Squat", sets:[{weightKg:90,reps:5},{weightKg:90,reps:5}] },
              { name:"Leg Press", sets:[{weightKg:180,reps:10},{weightKg:180,reps:10}] },
              { name:"Calf Raise", sets:[{weightKg:60,reps:15},{weightKg:60,reps:15}] }
            ] },
            { name:"Day 3 — Legs C", exercises:[
              { name:"Deadlift", sets:[{weightKg:150,reps:3},{weightKg:150,reps:3}] },
              { name:"Hamstring Curl", sets:[{weightKg:35,reps:12},{weightKg:35,reps:12}] }
            ] }
]
        }
      ];
      localStorage.setItem(MARKET_KEY, JSON.stringify(seed));
    }catch(_){}
  }


function listMarket(){
  seedMarket();
  try{
    const raw = localStorage.getItem(MARKET_KEY);
    const arr = JSON.parse(raw||"[]");
    const list = Array.isArray(arr) ? arr : [];
    // Normalize market templates to multi-day "routine" shape.
    // Back-compat: if template has only `preview` (array of workouts), treat each preview workout as a day.
    return list.map(t=>{
      if (t && Array.isArray(t.days) && t.days.length) return t;
      const preview = (t && Array.isArray(t.preview)) ? t.preview : [];
      const days = preview.map((w, i)=>({
        id: `d${i+1}`,
        name: (w && w.name) ? String(w.name) : `Day ${i+1}`,
        order: i,
        workout: w
      }));
      return { ...t, days };
    });
  }catch(_){ return []; }
}catch(_){ return []; }
}


  function renderHistory(){
    const workoutId = getWorkoutId();
    el.title.textContent = "History";
    el.subtitle.textContent = "Completed workouts";
    // Hide create/edit controls in history
    el.btnAddExercise.style.display = "none";
    el.btnRest60.style.display = "none";
    el.btnStart.style.display = "none";
    el.btnFinish.style.display = "none";
    // Leaving Today should fully exit the empty-state visual mode.
    el.page?.classList.remove("is-empty");
    if (el.emptyWrap) el.emptyWrap.hidden = true;

    const all = safe(()=>Workouts.listWorkouts ? Workouts.listWorkouts() : [], []);
    const done = (all||[]).filter(w => (w.status === "completed" || w.status === "skipped") && w.date && withinRange(w.date))
                         .slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));

    const groups = new Map();
    for (const w of done){
      const key = w.date;
      if (!groups.has(key)) groups.set(key, []);
      const summary = safe(()=>Workouts.computeWorkoutSummary ? Workouts.computeWorkoutSummary(w.id) : null, null) || {};
      groups.get(key).push({
        ...w,
        totalSets: summary.totalSets || 0,
        totalVolumeKg: summary.totalVolumeKg || 0,
        durationSec: summary.durationSec || w.durationSec || null,
        prs: summary.prs || []
      });
    }

    const header = `
      <div class="w4-range">
        <button class="w4-pill ${historyRange==="week"?"is-active":""}" data-range="week" type="button">Week</button>
        <button class="w4-pill ${historyRange==="month"?"is-active":""}" data-range="month" type="button">Month</button>
        <button class="w4-pill ${historyRange==="all"?"is-active":""}" data-range="all" type="button">All</button>
      </div>
    `;

    if (!done.length){
      el.content.innerHTML = header + `<div class="w3-empty" style="margin-top:12px;"><div class="w3-emptyTitle">No completed workouts yet</div><div class="w3-muted">Finish a workout and it will appear here.</div></div>`;
      return;
    }

    const blocks = [];
    for (const [date, items] of groups.entries()){
      blocks.push(`
        <div class="w4-day">
          <div class="w4-dayTitle">${esc(date)}</div>
          <div class="w4-dayList">
            ${items.map(w=>{
              const prBadge = (w.prs && w.prs.length) ? `<span class="w4-prBadge">PR</span>` : ``;
              const dur = w.durationSec ? ` · ${secondsToClock(w.durationSec)}` : ``;
              return `
                <div class="w4-hCard">
                  <div class="w4-hTop">
                    <div>
                      <div class="w4-hTitle">${esc(w.name || "Workout")} ${prBadge}</div>
                      <div class="w4-hSub">${esc(w.status || "completed")}${dur}</div>
                    </div>
                    <button class="w3-miniBtn" data-open-workout="${escAttr(w.id)}" type="button">Open</button>
                  </div>
                  <div class="w4-hMeta">${fmtInt(w.totalSets||0)} sets · ${fmtInt(Math.round(w.totalVolumeKg||0))} kg</div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `);
    }

    el.content.innerHTML = header + blocks.join("");
  }

  function templatePrice(t){
    if (t.price === 0) return "FREE";
    const cur = t.currency || "USD";
    const sym = (cur === "USD") ? "$" : cur + " ";
    return `${sym}${Number(t.price).toFixed(2)}`;
  }

  function tagMatch(t){
    if (templatesCat === "all") return true;
    if (templatesCat === "coach") return true; // featured
    const tags = (t.tags || []).map(x=>String(x).toLowerCase());
    return tags.includes(templatesCat);
  }

  function renderTemplates(){
    el.title.textContent = "Templates";
    el.subtitle.textContent = "Coach plans & programs";
    el.btnAddExercise.style.display = "none";
    el.btnRest60.style.display = "none";
    el.btnStart.style.display = "none";
    el.btnFinish.style.display = "none";
    // Leaving Today should fully exit the empty-state visual mode.
    el.page?.classList.remove("is-empty");
    if (el.emptyWrap) el.emptyWrap.hidden = true;

    const cats = `
      <div class="w4-range">
        <button class="w4-pill ${templatesCat==="coach"?"is-active":""}" data-cat="coach" type="button">Coach Picks</button>
        <button class="w4-pill ${templatesCat==="push"?"is-active":""}" data-cat="push" type="button">Push</button>
        <button class="w4-pill ${templatesCat==="legs"?"is-active":""}" data-cat="legs" type="button">Legs</button>
        <button class="w4-pill ${templatesCat==="home"?"is-active":""}" data-cat="home" type="button">Home</button>
        <button class="w4-pill ${templatesCat==="all"?"is-active":""}" data-cat="all" type="button">All</button>
      </div>
    `;

    const list = listMarket().filter(tagMatch);

    if (templatePreviewId){
      const t = listMarket().find(x=>x.id===templatePreviewId);
      templatePreviewDayIdx = Math.max(0, Math.min(templatePreviewDayIdx, ((t && t.days) ? t.days.length : 1) - 1));
      if (!t){
        templatePreviewId = null;
        el.content.innerHTML = cats;
        return;
      }
      el.content.innerHTML = cats + `
        <div class="w4-preview">
          <div class="w4-previewTop">
            <button class="w3-miniBtn" data-action="tpl-back" type="button">← Back</button>
            <div class="w4-previewTitle">${esc(t.title)}</div>
            <div class="w4-previewPrice">${esc(templatePrice(t))}</div>
          </div>
          <div class="w4-previewSub">by ${esc(t.coach)} · ${esc(String(t.weeks||0))} weeks · ${esc(String(t.workouts||0))} workouts</div>
          <div class="w4-previewDesc">${esc(t.description || "")}</div>

          

${(() => {
  const days = (t.days && t.days.length) ? t.days : [];
  const hasDays = days.length > 1;
  const day = days[templatePreviewDayIdx] || null;
  const w = day && day.workout ? day.workout : ((t.preview && t.preview[0]) ? t.preview[0] : null);

  const dayPills = hasDays ? `
    <div class="w4-range" style="margin-top:10px; flex-wrap:wrap;">
      ${days.map((d,i)=>`<button class="w4-pill ${templatePreviewDayIdx===i?'is-active':''}" data-action="tpl-day" data-idx="${i}" type="button">${esc(d.name || ('Day '+(i+1)))}</button>`).join("")}
    </div>
  ` : ``;

  const workoutHtml = w ? `
    <div class="w4-previewList">
      <div class="w4-prevWorkout">
        <div class="w4-prevWTitle">${esc(w.name || (day ? day.name : 'Day 1'))}</div>
        ${(w.exercises||[]).map(ex=>`
          <div class="w4-prevEx">
            <div class="w4-prevExTitle">${esc(ex.name)}</div>
            <div class="w4-prevExMeta">${(ex.sets||[]).map(s=>`${esc(String(s.weightKg||""))}×${esc(String(s.reps||""))}`).join(" · ")}</div>
          </div>
        `).join("")}
      </div>
    </div>
  ` : `<div class="w3-empty" style="margin-top:12px;"><div class="w3-emptyTitle">No workouts</div><div class="w3-muted">This routine has no days yet.</div></div>`;

  return dayPills + workoutHtml;
})()}