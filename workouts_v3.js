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
          workouts:4,
          rating:4.6,
          reviews:128,
          price:9.99,
          currency:"USD",
          description:"A balanced upper-body hypertrophy plan focused on progressive overload.",
          preview:[
            { name:"Push A", exercises:[
              { name:"Bench Press", sets:[{weightKg:80,reps:8},{weightKg:80,reps:8},{weightKg:75,reps:10}] },
              { name:"Incline DB Press", sets:[{weightKg:24,reps:10},{weightKg:24,reps:10}] },
              { name:"Triceps Pushdown", sets:[{weightKg:30,reps:12},{weightKg:30,reps:12}] }
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
            { name:"Full Body", exercises:[
              { name:"DB Goblet Squat", sets:[{weightKg:20,reps:12},{weightKg:20,reps:12}] },
              { name:"DB Floor Press", sets:[{weightKg:18,reps:10},{weightKg:18,reps:10}] }
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
            { name:"Legs A", exercises:[
              { name:"Back Squat", sets:[{weightKg:120,reps:5},{weightKg:120,reps:5},{weightKg:110,reps:6}] },
              { name:"RDL", sets:[{weightKg:90,reps:8},{weightKg:90,reps:8}] }
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
      return Array.isArray(arr) ? arr : [];
    }catch(_){ return []; }
  }

  function withinRange(dateIso){
    if (historyRange === "all") return true;
    const d = new Date(dateIso+"T00:00:00");
    const now = new Date();
    const ms = now - d;
    const days = ms / 86400000;
    if (historyRange === "week") return days <= 7;
    if (historyRange === "month") return days <= 31;
    return true;
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

          <div class="w4-previewList">
            ${(t.preview||[]).map(w=>`
              <div class="w4-prevWorkout">
                <div class="w4-prevWTitle">${esc(w.name)}</div>
                ${(w.exercises||[]).map(ex=>`
                  <div class="w4-prevEx">
                    <div class="w4-prevExTitle">${esc(ex.name)}</div>
                    <div class="w4-prevExMeta">${(ex.sets||[]).map(s=>`${esc(String(s.weightKg||""))}×${esc(String(s.reps||""))}`).join(" · ")}</div>
                  </div>
                `).join("")}
              </div>
            `).join("")}
          </div>

          <div class="w4-previewActions">
            ${t.price === 0
              ? `<button class="w3-btnPrimary" data-action="tpl-add" data-tpl-id="${escAttr(t.id)}" type="button">Add to my templates</button>`
              : `<button class="w3-btnPrimary" data-action="tpl-buy" data-tpl-id="${escAttr(t.id)}" type="button">Buy (mock)</button>`
            }
          </div>
        </div>
      `;
      return;
    }

    if (!list.length){
      el.content.innerHTML = cats + `<div class="w3-empty" style="margin-top:12px;"><div class="w3-emptyTitle">No templates</div><div class="w3-muted">No templates match this category.</div></div>`;
      return;
    }

    el.content.innerHTML = cats + `
      <div class="w4-tplGrid">
        ${list.map(t=>{
          const rating = (t.rating!=null) ? `★ ${Number(t.rating).toFixed(1)}` : "";
          const reviews = (t.reviews!=null) ? `(${fmtInt(t.reviews)})` : "";
          const pill = (t.price===0) ? `<span class="w4-free">FREE</span>` : `<span class="w4-price">${esc(templatePrice(t))}</span>`;
          const cta = (t.price===0) ? "Add" : "Preview";
          return `
            <div class="w4-tplCard">
              <div class="w4-tplTop">
                <div class="w4-tplTitle">${esc(t.title)}</div>
                ${pill}
              </div>
              <div class="w4-tplSub">by ${esc(t.coach)}</div>
              <div class="w4-tplMeta">${esc(String(t.workouts||0))} workouts · ${esc(String(t.weeks||0))} weeks</div>
              <div class="w4-tplRating">${esc(rating)} <span class="w4-tplReviews">${esc(reviews)}</span></div>
              <div class="w4-tplActions">
                <button class="w3-btnSecondary" data-action="tpl-preview" data-tpl-id="${escAttr(t.id)}" type="button">${esc(cta)}</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  // Add free template to user's templates store (simple v1)
  const USER_TPL_KEY = "w3_user_templates_v1";
  function addToUserTemplates(tpl){
    try{
      const raw = localStorage.getItem(USER_TPL_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(arr) ? arr : [];
      if (!list.find(x=>x.id===tpl.id)) list.push(tpl);
      localStorage.setItem(USER_TPL_KEY, JSON.stringify(list));
    }catch(_){}
  }


  function liveDurationSec(workout){
    if (!workout) return null;
    const st = workout.startedAt ? new Date(workout.startedAt).getTime() : null;
    const fin = workout.finishedAt ? new Date(workout.finishedAt).getTime() : null;
    if (st && !fin) return Math.max(0, Math.floor((Date.now() - st)/1000));
    if (st && fin) return Math.max(0, Math.floor((fin - st)/1000));
    return workout.durationSec || null;
  }

  function fmtKg(n){
    const v = Number(n||0);
    return fmtInt(Math.round(v));
  }

  function getCurrentExerciseName(workoutId){
    if (!workoutId) return null;
    const exs = safe(()=>Workouts.listExercises(workoutId), []) || [];
    if (!exs.length) return null;
    const active = activeExerciseId ? exs.find(e => e.id === activeExerciseId) : null;
    return (active?.name || exs[0].name || "").trim() || null;
  }

  function pickSuggestedExercise(workout){
    // Priority:
    // 1) Template of current workout (if exists)
    // 2) Any template (first)
    // 3) Last completed workout's first exercise
    // 4) Fallback: last exercise name from history (most recent)
    const currentExNames = new Set((safe(()=>Workouts.listExercises(workout?.id), [])||[]).map(e => String(e.name||"").trim().toLowerCase()).filter(Boolean));

    // 1) current workout template
    const templates = safe(()=>Workouts.listTemplates(), []) || [];
    if (workout?.templateId){
      const tpl = templates.find(t => String(t.id) === String(workout.templateId));
      if (tpl?.exercises?.length){
        const next = tpl.exercises.map(x=>String(x.name||x).trim()).find(n => n && !currentExNames.has(n.toLowerCase()));
        if (next) return { name: next, source: `Template: ${tpl.name || tpl.id}` };
      }
    }

    // 2) any template (first with exercises)
    const firstTpl = templates.find(t => (t.exercises||[]).length);
    if (firstTpl){
      const next = (firstTpl.exercises||[]).map(x=>String(x.name||x).trim()).find(n => n && !currentExNames.has(n.toLowerCase()));
      if (next) return { name: next, source: `Template: ${firstTpl.name || firstTpl.id}` };
    }

    // 3) last completed workout
    const all = safe(()=>Workouts.listWorkouts({}), []) || [];
    const lastCompleted = (all||[]).filter(w => w.status === "completed").slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")))[0];
    if (lastCompleted?.id){
      const exs = safe(()=>Workouts.listExercises(lastCompleted.id), []) || [];
      const next = (exs[0]?.name || "").trim();
      if (next && !currentExNames.has(next.toLowerCase())) return { name: next, source: "Last session" };
    }

    // 4) most recent exercise from history by scanning last completed workout exercises
    if (lastCompleted?.id){
      const exs = safe(()=>Workouts.listExercises(lastCompleted.id), []) || [];
      for (const e of exs){
        const n = String(e.name||"").trim();
        if (n && !currentExNames.has(n.toLowerCase())) return { name: n, source: "History" };
      }
    }

    return null;
  }

  function renderRightPanel(workout, meta){
    // Today summary
    const dur = liveDurationSec(workout);
    const isLive = !!(workout?.startedAt && !workout?.finishedAt);

    // Reveal Today summary only after first set is logged
    const totalSetsNow = Number(meta?.totalSets || 0);
    if (el.rpToday){
      if (_prevTotalSets === null){
        // First render: show/hide without animation
        if (totalSetsNow > 0){
          el.rpToday.classList.remove("is-prehide");
          el.rpToday.classList.add("no-anim");
          requestAnimationFrame(()=> el.rpToday.classList.remove("no-anim"));
        } else {
          el.rpToday.classList.add("is-prehide");
        }
      } else {
        if (_prevTotalSets === 0 && totalSetsNow > 0){
          // First set added -> animate in
          el.rpToday.classList.remove("no-anim");
          el.rpToday.classList.remove("is-prehide");
        } else if (totalSetsNow === 0){
          // Back to zero -> hide (no animation requirement, but keep smooth)
          el.rpToday.classList.add("is-prehide");
        }
      }
    }
    _prevTotalSets = totalSetsNow;

    if (el.rpSets) el.rpSets.textContent = fmtInt(meta.totalSets || 0);
    if (el.rpVol) el.rpVol.textContent = fmtKg(meta.totalVolumeKg || 0);
    if (el.rpTime) el.rpTime.textContent = dur ? secondsToClock(dur) : "--:--";
    if (el.rpLivePill) el.rpLivePill.hidden = !isLive;

    // Next suggested
    const sug = pickSuggestedExercise(workout);
    suggestedExerciseName = sug?.name || null;

    if (el.rpNextCard){
      if (sug?.name){
        el.rpNextCard.hidden = false;
        if (el.rpNextName) el.rpNextName.textContent = sug.name;
        if (el.rpNextSource) el.rpNextSource.textContent = sug.source || "";
        // last used hint
        const hist = safe(()=>Workouts.getExerciseHistory(sug.name, 1), []) || [];
        if (el.rpNextSub){
          if (hist[0]){
            el.rpNextSub.textContent = `Last: ${fmtKg(hist[0].topSetWeightKg)} kg × ${fmtInt(hist[0].topSetReps)} reps • ${hist[0].date}`;
          } else {
            el.rpNextSub.textContent = "No history yet";
          }
        }
      } else {
        el.rpNextCard.hidden = true;
      }
    }

    // Exercise context (current exercise)
    const curName = getCurrentExerciseName(workout?.id);
    if (el.rpCtxCard){
      if (curName){
        el.rpCtxCard.hidden = false;
        if (el.rpCtxName) el.rpCtxName.textContent = curName;

        const hist = safe(()=>Workouts.getExerciseHistory(curName, 1), []) || [];
        if (el.rpLastSession){
          if (hist[0]) el.rpLastSession.textContent = `${hist[0].date}: top set ${fmtKg(hist[0].topSetWeightKg)} kg × ${fmtInt(hist[0].topSetReps)} reps • volume ${fmtKg(hist[0].totalVolumeKg)} kg`;
          else el.rpLastSession.textContent = "—";
        }

        const prs = safe(()=>Workouts.getExercisePRs(curName), null) || {};
        if (el.rpPRs){
          const parts = [];
          if (prs.maxWeightKg) parts.push(`Max weight: ${fmtKg(prs.maxWeightKg)} kg`);
          if (prs.maxReps) parts.push(`Max reps: ${fmtInt(prs.maxReps)}`);
          if (prs.maxVolumeKg) parts.push(`Max volume: ${fmtKg(prs.maxVolumeKg)} kg`);
          el.rpPRs.textContent = parts.length ? parts.join(" • ") : "—";
        }
      } else {
        el.rpCtxCard.hidden = true;
      }
    }
  }

  function startWorkoutClock(){
    if (workoutClockInterval) return;
    workoutClockInterval = setInterval(()=>{
      const w = safe(()=>Workouts.getWorkout(getWorkoutId()), null);
      if (!w) return;
      const dur = liveDurationSec(w);
      if (el.metaTime) el.metaTime.textContent = dur ? secondsToClock(dur) : "--:--";

    renderRightPanel(workout, meta);

    if (workout.startedAt && !workout.finishedAt) startWorkoutClock(); else stopWorkoutClock();
      if (el.rpTime) el.rpTime.textContent = dur ? secondsToClock(dur) : "--:--";
      if (el.rpLivePill) el.rpLivePill.hidden = !(w.startedAt && !w.finishedAt);
    }, 1000);
  }

  function stopWorkoutClock(){
    if (workoutClockInterval) { clearInterval(workoutClockInterval); workoutClockInterval = null; }
  }
function render(){
    // Tab router (Today / History / Templates)
    if (currentTab === "history"){ syncTabUI(); renderHistory(); return; }
    if (currentTab === "templates"){ syncTabUI(); renderTemplates(); return; }
    if (!window.Workouts) {
      el.content.innerHTML = `<div class="w3-empty"><div class="w3-emptyTitle">Workouts API missing</div><div class="w3-muted">window.Workouts not loaded.</div></div>`;
      if (el.emptyWrap) el.emptyWrap.hidden = true;
      return;
    }

    const workout = ensureWorkout();
    if (!workout) {
      el.content.innerHTML = `<div class="w3-empty"><div class="w3-emptyTitle">No workout</div><div class="w3-muted">Could not create or load a workout.</div></div>`;
      if (el.emptyWrap) el.emptyWrap.hidden = true;
      return;
    }

    el.title.textContent = workout.name || "Workout";
    el.subtitle.textContent = `${workout.status || "planned"} · ${workout.date || "—"}`;

    currentWorkoutId = workout.id || null;


    // Allow editing even if a workout is marked completed (prevents "can't type" on mobile)
    const status = workout.status || "planned";
    isReadOnly = false;
    // show workout controls only in Today tab
    el.btnAddExercise.style.display = "";
    el.btnRest60.style.display = "";
    labelRestButton();
    el.btnStart.style.display = "";
    el.btnFinish.style.display = "";
    // Primary: planned -> Start (bottom), in_progress -> Finish (top), done -> hide both
    if (status === "in_progress"){
      el.btnStart.style.display = "none";
      el.btnFinish.style.display = "";
    } else if (status === "planned"){
      el.btnStart.style.display = "";
      el.btnFinish.style.display = "none";
    } else {
      el.btnStart.style.display = "none";
      el.btnFinish.style.display = "none";
    }



    const meta = computeMeta(workout.id);
    el.metaSets.textContent = fmtInt(meta.totalSets || 0);
    el.metaVol.textContent = fmtInt(Math.round(meta.totalVolumeKg || 0));
    const dur = liveDurationSec(workout);
    el.metaTime.textContent = dur ? secondsToClock(dur) : "--:--";

    const exercises = safe(()=>Workouts.listExercises(workout.id), []);

    // Keep a stable "active" exercise for in-card actions
    if (exercises.length){
      const exists = activeExerciseId && exercises.some(e=>String(e.id)===String(activeExerciseId));
      if (!exists) activeExerciseId = exercises[0].id;
    } else {
      activeExerciseId = null;
    }
    el.content.innerHTML = "";

    if (!exercises.length) {
      showEmpty();
      return;
    }
    hideEmptyAnimated();

for (const ex of exercises) {
      const sets = safe(()=>Workouts.listSets(ex.id), []);
      const card = document.createElement("section");
      card.className = "w3-exCard" + (String(ex.id)===String(activeExerciseId) ? " is-active" : "");
      card.dataset.exerciseId = ex.id;
      card.dataset.exerciseName = ex.name || "";

      card.innerHTML = `
        <div class="w3-exHeader">
          <div class="w3-exHeaderLeft">
            <div class="w3-delHint" title="Hold 2.5s to delete" aria-hidden="true">
              <div class="w3-delGlass" aria-hidden="true"></div>
              <span class="w3-delIcon" aria-hidden="true">🗑️</span>
              <svg class="w3-delRing" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                <circle class="w3-delRingTrack" cx="12" cy="12" r="10.5"></circle>
                <circle class="w3-delRingProg" cx="12" cy="12" r="10.5"></circle>
              </svg>
            </div>
            <div class="w3-exHoldZone" data-hold-delete="1" title="Hold 2.5s to delete">
              <div class="w3-hSection">${esc(ex.name || "Exercise")}</div>
              ${ex.notes ? `<div class="w3-exSub">${esc(ex.notes)}</div>` : ``}
            </div>
          </div>
          <div class="w3-exHeaderRight">
            <button class="w3-iconBtn w3-exMenuBtn" data-action="ex-menu" aria-label="More options">
              <span class="w3-dots" aria-hidden="true"></span>
            </button>
          </div>
        </div>

        ${(isReadOnly || sets.length===0) ? "" : `<div class="w3-exActions" ${String(ex.id)!==String(activeExerciseId) ? "hidden" : ""}>
          <button class="w3-btnPrimary w3-exAction" data-action="start-workout" ${workout.status==="in_progress" ? "disabled" : ""}>${workout.status==="in_progress" ? "Started" : "Start"}</button>
          <button class="w3-btnSecondary w3-exAction" data-action="rest">Rest ${fmtClock(loadRestPreset())}</button>
        </div>`}

        <div class="w3-setLabels" aria-hidden="true">
          <div></div><div>set</div><div>kg</div><div>reps</div>
        </div>

        <div class="w3-sets">
          ${sets.map((s,i)=>setRowHtml(s,i, ex.id, ex.name)).join("")}
        </div>

        ${isReadOnly ? "" : `<button class="w3-addSet" data-action="add-set">+ Add set</button>`}
      `;

      el.content.appendChild(card);
    }

    // "Add another exercise" placeholder card (shows you can add more)
    if (!isReadOnly) {
      const addCard = document.createElement("section");
      addCard.className = "w3-addExerciseCard";
      addCard.setAttribute("role", "button");
      addCard.setAttribute("tabindex", "0");
      addCard.dataset.action = "add-exercise-card";
      addCard.innerHTML = `
        <div class="w3-addExerciseInner">
          <div class="w3-addExerciseIcon">+</div>
          <div class="w3-addExerciseText">
            <div class="w3-addExerciseTitle">Add another exercise</div>
            <div class="w3-addExerciseSub">Tap to add more to this workout.</div>
          </div>
        </div>
      `;
      el.content.appendChild(addCard);
    }
  }

  function setRowHtml(s, index, exerciseId, exerciseName){
    const done = !!s.completed;
    const w = (s.weightKg ?? "");
    const r = (s.reps ?? "");
    const isPR = (prFlashSetId && prFlashSetId === s.id);

    return `
      <div class="w3-swipeWrap" data-set-id="${escAttr(s.id)}" data-exercise-name="${escAttr(exerciseName||"")}">
        <div class="w3-swipeAction left" data-action="dup-set"><span class="w3-swipeIcon">⎘</span><span class="w3-swipeLabel">Duplicate</span></div>
        <div class="w3-swipeAction right" data-action="del-set"><span class="w3-swipeIcon">🗑</span><span class="w3-swipeLabel">Delete</span></div>

        <div class="w3-setRow ${done ? "isDone" : ""} ${isPR ? "isPR" : ""}" data-set-id="${escAttr(s.id)}" data-exercise-name="${escAttr(exerciseName||"")}">
          <div class="w3-check ${done ? "isDone" : ""}" data-action="toggle-set" role="button" aria-label="Toggle set"></div>
          <div class="w3-setIndex">${index+1}</div>
          <input class="w3-input" data-field="weightKg" inputmode="decimal" value="${escAttr(String(w))}" placeholder="kg" ${isReadOnly ? "disabled" : ""} />
          <input class="w3-input" data-field="reps" inputmode="numeric" value="${escAttr(String(r))}" placeholder="reps" ${isReadOnly ? "disabled" : ""} />

          <div class="w3-hoverActions" aria-hidden="true">
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
    const wrap = swipe.row.parentElement;
    if (wrap){
      wrap.classList.toggle("isSwipeLeft", swipe.dx > 8);
      wrap.classList.toggle("isSwipeRight", swipe.dx < -8);
    }
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
      const wrap = row.parentElement;
      if (wrap){ wrap.classList.remove("isSwipeLeft","isSwipeRight"); }

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
    if (swipe.row) {
      swipe.row.style.transform = "translateX(0)";
      const wrap = swipe.row.parentElement;
      if (wrap){ wrap.classList.remove("isSwipeLeft","isSwipeRight"); }
    }
    swipe.active = false;
    swipe.row = null;
    swipe.pointerId = null;
    swipe.dx = 0;
  });

  el.content.addEventListener("click", (e)=>{
    // Increment 4: History/Templates controls
    const openBtn = e.target.closest("[data-open-workout]");
    if (openBtn){
      const id = openBtn.getAttribute("data-open-workout");
      if (id){
        setWorkoutId(id);
        setTab("today");
      }
      return;
    }
    const rangeBtn = e.target.closest("[data-range]");
    if (rangeBtn){
      historyRange = rangeBtn.getAttribute("data-range") || "all";
      renderHistory();
      return;
    }
    const catBtn = e.target.closest("[data-cat]");
    if (catBtn){
      templatesCat = catBtn.getAttribute("data-cat") || "coach";
      templatePreviewId = null;
      renderTemplates();
      return;
    }
    // Set active exercise when clicking on a card surface (not on controls)
    const clickedCard = e.target.closest(".w3-exCard");
    if (clickedCard && !e.target.closest("[data-action]") && !e.target.closest("input,button,textarea,select")){
      const exId = clickedCard.dataset.exerciseId;
      if (exId && String(exId)!==String(activeExerciseId)){
        activeExerciseId = exId;
        render();
      }
      return;
    }

    const act = e.target.closest("[data-action]");
    if (!act) return;
    const action = act.dataset.action;

    if (action === "tpl-preview") {
      const id = act.getAttribute("data-tpl-id");
      templatePreviewId = id || null;
      renderTemplates();
      return;
    }
    if (action === "tpl-back") {
      templatePreviewId = null;
      renderTemplates();
      return;
    }
    if (action === "tpl-add") {
      const id = act.getAttribute("data-tpl-id");
      const tpl = listMarket().find(t=>t.id===id);
      if (tpl){ addToUserTemplates(tpl); }
      templatePreviewId = null;
      renderTemplates();
      return;
    }
    if (action === "tpl-buy") {
      // mock purchase: unlock and add to user templates
      const id = act.getAttribute("data-tpl-id");
      const tpl = listMarket().find(t=>t.id===id);
      if (tpl){ addToUserTemplates(tpl); }
      alert("Purchased (mock). Template added to your library.");
      templatePreviewId = null;
      renderTemplates();
      return;
    }

    const card = act.closest(".w3-exCard");
    const exerciseId = card?.dataset.exerciseId;

    const setRow = act.closest(".w3-setRow");
    const setId = setRow?.dataset.setId;
    const exerciseName = card?.dataset.exerciseName || "";

    if (action === "start-workout") {
      const w = ensureWorkout();
      if (!w) return;
      safe(()=>Workouts.startWorkout(w.id), null);
      render();
      return;
    }
    if (action === "rest") {
      // In-card Rest should start immediately (users expect feedback).
      // Hold a modifier key to open the picker and change duration.
      handleRestPrimaryClick(null);
      return;
    }

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
    if (action === "add-exercise-card") {
      addExercise();
      return;
    }

    if (action === "ex-menu") {
      // Reorder handle. Actual drag starts on pointerdown for this button.
      // Keep click as a harmless hint for desktop users.
      if (card){
        card.classList.remove("w3-reorderHint");
        void card.offsetWidth;
        card.classList.add("w3-reorderHint");
        setTimeout(()=>card.classList.remove("w3-reorderHint"), 700);
      }
      return;
    }
  });

  // Keyboard support for clickable "add exercise" card
  el.content.addEventListener("keydown", (e)=>{
    const act = e.target.closest && e.target.closest("[data-action='add-exercise-card']");
    if (!act) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      addExercise();
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
    // lazy query in case modal markup is after scripts
    if (!el.modalOverlay) el.modalOverlay = document.getElementById("w3ModalOverlay");
    if (!el.modalInput) el.modalInput = document.getElementById("w3ExerciseName");
    if (!el.modalOk) el.modalOk = document.getElementById("w3ModalOk");
    if (!el.modalCancel) el.modalCancel = document.getElementById("w3ModalCancel");
    const closeBtn = document.getElementById("w3ModalClose");
    if (!el.modalOverlay || !el.modalInput || !el.modalOk || !el.modalCancel) return;
    el.modalOverlay.hidden = false;
    // wire close actions (idempotent)
    if (!el.modalOverlay.__wired){
      el.modalOverlay.__wired = true;
      const doClose = ()=>{ el.modalOverlay.hidden = true; };
      el.modalCancel.addEventListener("click", doClose);
      const closeBtn = document.getElementById("w3ModalClose");
      if (closeBtn) closeBtn.addEventListener("click", doClose);
      el.modalOverlay.addEventListener("click", (e)=>{ if(e.target===el.modalOverlay) doClose(); });
      window.addEventListener("keydown", (e)=>{ if(e.key==="Escape" && !el.modalOverlay.hidden) doClose(); });
    }

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

  function addExercise(){
    const w = ensureWorkout();
    if (!w) return;
    // open add-exercise modal
    openAddExerciseModal((name)=>{
      safe(()=>Workouts.addExercise(w.id, { name }), null);
      render();
    });
    return;
  }

  el.btnAddExercise?.addEventListener("click", addExercise);
  el.btnAddExerciseEmpty?.addEventListener("click", addExercise);
  // Empty state card is clickable
  el.empty?.addEventListener("click", (e)=>{
    // If user clicks the Today summary card inside the empty state, don't open Add Exercise.
    if (e.target && e.target.closest && e.target.closest("#w3RpToday")) return;
    el.empty.classList.add("isPressed");
    setTimeout(()=>el.empty && el.empty.classList.remove("isPressed"), 140);
    addExercise();
  });
  el.empty?.addEventListener("keydown", (e)=>{
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      el.empty.classList.add("isPressed");
      setTimeout(()=>el.empty && el.empty.classList.remove("isPressed"), 140);
      addExercise();
    }
  });

  // Tabs switching
  el.tabs?.addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-tab]");
    if (!btn) return;
    // Tabs are hidden; ignore.
    currentTab = "today";
  });

  // Empty-state quick actions (Templates / History)
  el.emptySide?.addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-tab]");
    if (!btn) return;
    currentTab = "today";
  });

  // Desktop tiles switching
  el.sideTiles?.addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-tab]");
    if (!btn) return;
    currentTab = "today";
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

  // Rest timer: user can pick any duration from 0:01 to 5:00.
  // Click the Rest button to open the picker; Start inside picker begins the timer.
  (function initRestButton(){
    if (!el.btnRest60) return;
    labelRestButton();

    // Wire picker inputs
    const syncFrom = (sec)=>{
      const v = Math.min(REST_MAX, Math.max(REST_MIN, sec|0));
      setPickerValue(v);
      saveRestPreset(v);
      labelRestButton();
      // Also update any in-card Rest buttons without forcing a full rerender.
      try{
        document.querySelectorAll('.w3-exAction[data-action="rest"]').forEach(b=>{
          b.textContent = `Rest ${fmtClock(v)}`;
        });
      }catch(_){ }
    };

    restUI.pickerRange?.addEventListener('input', (e)=>{
      syncFrom(parseInt(e.target.value, 10));
    });
    restUI.pickerSec?.addEventListener('input', (e)=>{
      syncFrom(parseInt(e.target.value, 10));
    });

    // Open/close
    el.btnRest60.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      // Start immediately; use modifier keys to open picker.
      handleRestPrimaryClick(e);
    });
    restUI.pickerClose?.addEventListener('click', closeRestPicker);

    // Start rest from picker
    restUI.pickerStart?.addEventListener('click', ()=>{
      const sec = loadRestPreset();
      closeRestPicker();
      startRest(sec);
    });

    // Tap outside closes (but don't break other dialogs)
    document.addEventListener('click', (e)=>{
      if (!restUI.picker?.classList.contains('is-open')) return;
      const within = e.target.closest('#w3RestPicker') || e.target.closest('#w3Rest60');
      if (!within) closeRestPicker();
    });

    el.restStop?.addEventListener("click", stopRest);
  })();

  // Right panel actions
  el.rpStartSuggested?.addEventListener("click", ()=>{
    if (!suggestedExerciseName) return;
    // Start implies: add exercise then start workout if not started
    const w = ensureWorkout();
    if (!w) return;
    safe(()=>Workouts.addExercise(w.id, { name: suggestedExerciseName }), null);
    safe(()=>Workouts.startWorkout(w.id), null);
    // Focus the newly added exercise
    const exs = safe(()=>Workouts.listExercises(w.id), []) || [];
    const added = exs.slice().reverse().find(e => String(e.name||"").trim().toLowerCase() === String(suggestedExerciseName).trim().toLowerCase());
    if (added?.id) activeExerciseId = added.id;
    render();
  });

  el.rpAddSuggested?.addEventListener("click", ()=>{
    if (!suggestedExerciseName) return;
    const w = ensureWorkout();
    if (!w) return;
    safe(()=>Workouts.addExercise(w.id, { name: suggestedExerciseName }), null);
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

  // Init tab from hash (e.g. #templates, #history)
  try{
    const h = String(location.hash || "").replace(/^#/, "").trim();
    if (h === "today" || h === "history" || h === "templates") currentTab = h;
  }catch(_){ }

  // Restore tab "page" from URL hash (e.g. #templates, #history)
  try{
    const h = String(location.hash || "").replace(/^#/, "").trim().toLowerCase();
    if (h === "today" || h === "history" || h === "templates") currentTab = h;
  }catch(_){ }

  syncTabUI();
  render();
  const st = loadRest();
  if (st && st.endAt && st.endAt > Date.now()) showRest();
})();
