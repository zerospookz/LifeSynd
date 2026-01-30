"use strict";
// --- Analytics state (must be defined before first render) ---
let analyticsView = localStorage.getItem("habitsAnalyticsView") || "month";
let analyticsOffsetDays = parseInt(localStorage.getItem("habitsAnalyticsOffsetDays") || "0", 10);
let analyticsPaintMode = localStorage.getItem("habitsAnalyticsPaintMode") || "mark"; // mark | erase
let lastPulse = null; // {hid, iso, mode:"done"|"miss"} for subtle mark animation

function rangeDates(rangeDays, offsetDays, dir="backward"){
  // dir: "backward" (default) returns [oldest..newest] ending at (today+offset)
  //      "forward" returns [today+offset .. +rangeDays-1]
  const base = new Date();
  base.setDate(base.getDate() + (offsetDays||0));
  const res=[];
  if(dir === "forward"){
    for(let i=0;i<rangeDays;i++){
      const x=new Date(base);
      x.setDate(base.getDate()+i);
      res.push(x.toISOString().slice(0,10));
    }
  }else{
    for(let i=rangeDays-1;i>=0;i--){
      const x=new Date(base);
      x.setDate(base.getDate()-i);
      res.push(x.toISOString().slice(0,10));
    }
  }
  return res;
}

// Format ISO date (YYYY-MM-DD) to e.g. "Jan 29"
function fmtMonthDay(iso){
  const d = new Date(iso+"T00:00:00");
  try{
    return new Intl.DateTimeFormat(undefined,{month:"short", day:"numeric"}).format(d);
  }catch(e){
    return iso.slice(5);
  }
}
let habits=JSON.parse(localStorage.getItem("habitsV2")||"[]");
function save(){localStorage.setItem("habitsV2",JSON.stringify(habits));}

// Normalize hues on load so accents stay stable and unique.
// (If older data had duplicates, we keep the first occurrence and reassign the rest.)
try{
  ensureHabitHues();
  ensureUniqueHues();
}catch(e){ /* ignore */ }
// --- UI filters ---
let habitSearchTerm = "";
function getFilteredHabits(){
  const term = (habitSearchTerm||"").trim().toLowerCase();
  if(!term) return habits;
  return (habits||[]).filter(h => (h.name||"").toLowerCase().includes(term));
}


// --- Habit carousel state ---
let habitCarouselIndex = parseInt(localStorage.getItem('habitsCarouselIndex')||'0',10);
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }

function setCarouselIndex(i){
  habitCarouselIndex = clamp(i, 0, Math.max(0, habits.length-1));
  localStorage.setItem('habitsCarouselIndex', String(habitCarouselIndex));
  // If carousel is present, update without full rerender.
  const track = document.getElementById('habTrack');
  const dots = document.getElementById('habitDots');
  if(track){
    track.style.transform = `translateX(${-habitCarouselIndex*100}%)`;
  }
  if(dots){
    [...dots.querySelectorAll('button')].forEach((b,idx)=>b.classList.toggle('active', idx===habitCarouselIndex));
  }
}

function setupHabitCarousel(){
  const track = document.getElementById('habTrack');
  const viewport = document.getElementById('habViewport');
  const prev = document.getElementById('habPrev');
  const next = document.getElementById('habNext');
  const dots = document.getElementById('habitDots');
  if(!track || !viewport || !dots) return;

  // Re-clamp in case habits length changed
  habitCarouselIndex = clamp(habitCarouselIndex, 0, Math.max(0, habits.length-1));
  localStorage.setItem('habitsCarouselIndex', String(habitCarouselIndex));

  // Build dots
  dots.innerHTML = habits.map((_,idx)=>`<button type="button" class="dotBtn ${idx===habitCarouselIndex?'active':''}" aria-label="Go to habit ${idx+1}"></button>`).join('');
  [...dots.querySelectorAll('button')].forEach((b,idx)=>b.addEventListener('click', ()=>setCarouselIndex(idx)));

  prev?.addEventListener('click', ()=>setCarouselIndex(habitCarouselIndex-1));
  next?.addEventListener('click', ()=>setCarouselIndex(habitCarouselIndex+1));

  // Swipe/drag to change slide
  if(viewport.dataset.bound === '1'){
    track.style.transition='transform .22s ease';
    setCarouselIndex(habitCarouselIndex);
    return;
  }
  viewport.dataset.bound = '1';
  let startX=0;
  let dx=0;
  let isDown=false;
  let dragging=false;
  const THRESH=48; // px

  function onDown(e){
    isDown=true; dragging=false; dx=0;
    startX = (e.touches?e.touches[0].clientX:e.clientX);
    track.style.transition='none';
  }
  function onMove(e){
    if(!isDown) return;
    const x = (e.touches?e.touches[0].clientX:e.clientX);
    dx = x-startX;
    if(Math.abs(dx) > 6) dragging=true;
    if(!dragging) return;
    // prevent vertical scroll when swiping horizontally
    if(e.cancelable) e.preventDefault();
    const pct = (dx / Math.max(1, viewport.clientWidth)) * 100;
    track.style.transform = `translateX(calc(${-habitCarouselIndex*100}% + ${pct}%))`;
  }
  function onUp(){
    if(!isDown) return;
    isDown=false;
    track.style.transition='transform .22s ease';
    if(dragging && Math.abs(dx) > THRESH){
      setCarouselIndex(habitCarouselIndex + (dx<0 ? 1 : -1));
    }else{
      setCarouselIndex(habitCarouselIndex);
    }
  }

  viewport.addEventListener('touchstart', onDown, {passive:true});
  viewport.addEventListener('touchmove', onMove, {passive:false});
  viewport.addEventListener('touchend', onUp, {passive:true});
  viewport.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);

  // init position
  track.style.transition='transform .22s ease';
  setCarouselIndex(habitCarouselIndex);
}
// ---------- helpers ----------
function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function today(){return isoToday();}
function getMarkDate(){ return markDate.value ? markDate.value : today(); }

const HUE_PALETTE = [140, 260, 20, 200, 320, 80, 0, 170, 240, 300, 110, 30];

function habitHueFrom(id){
  let hash=0;
  for(let i=0;i<id.length;i++) hash=id.charCodeAt(i)+((hash<<5)-hash);
  return Math.abs(hash);
}

function ensureHabitHues(){
  const used = new Set(habits.map(h=>h.hue).filter(v=>typeof v==="number"));
  let changed = false;
  for(const h of habits){
    if(typeof h.hue !== "number"){
      // pick next unused palette hue; fallback to hashed palette slot
      let hue = null;
      for(const candidate of HUE_PALETTE){
        if(!used.has(candidate)){ hue=candidate; break; }
      }
      if(hue === null){
        hue = HUE_PALETTE[habitHueFrom(h.id)%HUE_PALETTE.length];
      }
      h.hue = hue;
      used.add(hue);
      changed = true;
    }
  }
  if(changed) save();
}

function habitHue(id){
  const h = habits.find(x=>x.id===id);
  if(h && typeof h.hue==="number") return h.hue;
  return HUE_PALETTE[habitHueFrom(id)%HUE_PALETTE.length];
}




function fmtWeekday(iso){
  const d=new Date(iso+"T00:00:00");
  return d.toLocaleDateString(undefined,{weekday:"short"});
}


function addHabitNamed(name){
  const n = (name||"").trim();
  if(!n) return;
  // Persist an explicit hue so the habit keeps a stable accent everywhere
  // (especially important in the transposed mobile grid).
  const used = new Set((habits||[]).map(h=>h.hue).filter(v=>typeof v==="number"));
  // Prefer an unused palette hue; if the palette is exhausted, generate a unique hue.
  let hue = null;
  for(const candidate of HUE_PALETTE){
    if(!used.has(candidate)){ hue = candidate; break; }
  }
  if(hue === null){
    // Deterministic-ish starting point based on name, then step until unique.
    let base = 0;
    for(let i=0;i<n.length;i++) base = (base*31 + n.charCodeAt(i)) % 360;
    hue = base;
    const STEP = 29;
    let guard = 0;
    while(used.has(hue) && guard < 400){
      hue = (hue + STEP) % 360;
      guard++;
    }
  }
  habits.push({id:crypto.randomUUID(), name:n, created:today(), datesDone:[], hue});
  save();
  render();
  showToast("Habit added");
}

// Ensure no two habits share the same hue. Keeps the first occurrence and reassigns duplicates.
function ensureUniqueHues(){
  const used = new Set();
  let changed = false;
  for(const h of (habits||[])){
    if(typeof h.hue !== "number") continue;
    if(!used.has(h.hue)){
      used.add(h.hue);
      continue;
    }
    // duplicate hue → pick next unused palette hue, else step through the hue wheel
    let next = null;
    for(const candidate of HUE_PALETTE){
      if(!used.has(candidate)){ next = candidate; break; }
    }
    if(next === null){
      next = (h.hue + 29) % 360;
      let guard = 0;
      while(used.has(next) && guard < 400){ next = (next + 29) % 360; guard++; }
    }
    h.hue = next;
    used.add(next);
    changed = true;
  }
  if(changed) save();
}

function openAddHabit(triggerEl){
  const isPhone = window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
  const card = document.getElementById('addCard');
  if(isPhone){
    openAddHabitModal(triggerEl);
    return;
  }
  if(card) card.classList.toggle('open');
  const input = document.getElementById('habitName');
  input && input.focus && input.focus();
}

function openAddHabitModal(triggerEl){
  const modal = document.getElementById('addHabitModal');
  const input = document.getElementById('addHabitModalInput');
  if(!modal || !input){
    // Safe fallback
    const name = prompt('New habit name:');
    if(name===null) return;
    addHabitNamed(name);
    return;
  }

  // Button pop animation
  if(triggerEl && triggerEl.classList){
    triggerEl.classList.remove('pillPop');
    // force reflow to restart animation
    void triggerEl.offsetWidth;
    triggerEl.classList.add('pillPop');
  }

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('modalOpen');
  input.value = '';
  setTimeout(()=>input.focus(), 60);
}

function closeAddHabitModal(){
  const modal = document.getElementById('addHabitModal');
  if(!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('modalOpen');
}

function confirmAddHabitModal(){
  const input = document.getElementById('addHabitModalInput');
  if(!input) return;
  const name = (input.value || '').trim();
  if(!name){
    input.classList.remove('shake');
    void input.offsetWidth;
    input.classList.add('shake');
    input.focus();
    return;
  }
  addHabitNamed(name);
  closeAddHabitModal();
}

function addHabit(){
  // Used by the desktop "Add & mark" card.
  if(typeof habitName === "undefined") return;
  addHabitNamed(habitName.value);
  habitName.value="";
}

function toggleHabitAt(id, iso, opts={}){
  const h = habits.find(x=>x.id===id);
  if(!h) return;
  h.datesDone = h.datesDone || [];
  const idx = h.datesDone.indexOf(iso);
  let nowDone;
  if(idx>=0){
    h.datesDone.splice(idx,1);
    nowDone = false;
    showToast("Marked as missed");
  }else{
    h.datesDone.push(iso);
    h.datesDone.sort();
    nowDone = true;
    showToast("Marked done");
  }
  lastPulse = { hid: id, iso, mode: nowDone ? "done" : "miss" };
  save();

  // Preserve scroll positions for a smoother feel (both matrix + page)
  const wrap = document.querySelector('.matrixWrap');
  const scroll = wrap ? {top:wrap.scrollTop, left:wrap.scrollLeft} : null;
  const pageScrollY = window.scrollY;

  render();

  if(opts && opts.preserveScroll){
    requestAnimationFrame(()=>{
      const w = document.querySelector('.matrixWrap');
      if(w && scroll){ w.scrollTop = scroll.top; w.scrollLeft = scroll.left; }
      // prevent "jump to top" after re-render
      window.scrollTo({ top: pageScrollY, left: 0, behavior: 'auto' });
    });
  }
  return nowDone;
}


function streakFor(h){
  const dates=(h.datesDone||[]).slice().sort();
  const set=new Set(dates);
  const end=getMarkDate();
  let current=0;
  let d=new Date(end);
  while(true){
    const iso=d.toISOString().slice(0,10);
    if(set.has(iso)){ current++; d.setDate(d.getDate()-1); }
    else break;
  }
  let best=0, cur=0;
  const now=new Date();
  for(let i=365;i>=0;i--){
    const dd=new Date(now); dd.setDate(dd.getDate()-i);
    const iso=dd.toISOString().slice(0,10);
    if(set.has(iso)){ cur++; best=Math.max(best,cur); } else cur=0;
  }
  return {current,best};
}

function completionRate(days){
  const endIso = getMarkDate();
  const end = new Date(endIso+"T00:00:00");
  const start = new Date(end);
  start.setDate(end.getDate()-(days-1));

  const total = habits.length * days;
  if(total<=0) return 0;

  let done = 0;
  for(const h of habits){
    const set = new Set(h.datesDone||[]);
    for(let i=0;i<days;i++){
      const d=new Date(start);
      d.setDate(start.getDate()+i);
      const iso=d.toISOString().slice(0,10);
      if(set.has(iso)) done++;
    }
  }
  return Math.round((done/total)*100);
}

// Mini GitHub-style heatmap: last 28 days (4 weeks)
// 5 levels based on *consecutive* completions ending on each day (caps at 4).
function miniHeatHtml(h){
  const days=28;
  const now=new Date(today()+"T00:00:00");
  const set=new Set(h.datesDone||[]);
  const cells=[];
  let streak=0;

  // We render oldest -> newest so streak is meaningful.
  for(let i=days-1;i>=0;i--){
    const d=new Date(now); d.setDate(now.getDate()-i);
    const iso=d.toISOString().slice(0,10);
    const on=set.has(iso);

    streak = on ? Math.min(4, streak+1) : 0; // 0..4
    const level = streak;

    // map level -> percent of accent used in color-mix (deterministic, non-random)
    const PCTS = [8, 22, 38, 56, 78];
    const heatP = PCTS[level];

    const accent = `hsl(${habitHue(h.id)} 70% 55%)`;
    cells.push(
      `<div class="miniCell" title="${iso}" style="--habitAccent:${accent};--heatP:${heatP}%"></div>`
    );
  }

  return `
    <div class="miniHeatWrap">
      <div class="miniHeat">${cells.join("")}</div>
      <div class="miniHeatLegend">
        <span class="dot l0"></span><span class="dot l1"></span><span class="dot l2"></span><span class="dot l3"></span><span class="dot l4"></span>
        <span class="label">last 4 weeks</span>
      </div>
    </div>
  `;
}


// ---------- Analytics (Matrix) ----------


function renderAnalytics(){
  const card = document.getElementById("habitAnalytics");
  if(!card) return;
  const H = getFilteredHabits();

  // Shared: hold-to-delete (2.5s) for habit labels (desktop header + mobile sticky column)
  function bindHoldToDelete(labelEl, habit){
    if(!labelEl || !habit) return;
    // Avoid double-binding on rerenders
    if(labelEl.dataset.holdBound === "1") return;
    labelEl.dataset.holdBound = "1";

    let holdTimer = null;
    let raf = null;
    let holdStart = 0;
    const HOLD_MS = 2500;

    function clearHold(){
      if(holdTimer){ clearTimeout(holdTimer); holdTimer = null; }
      if(raf){ cancelAnimationFrame(raf); raf = null; }
      labelEl.classList.remove("holding");
      labelEl.style.removeProperty("--hold");
    }

    function tick(){
      const t = Math.min(1, (performance.now() - holdStart) / HOLD_MS);
      labelEl.style.setProperty("--hold", String(t));
      if(t < 1) raf = requestAnimationFrame(tick);
    }

    labelEl.addEventListener("pointerdown", (ev)=>{
      if(ev.button != null && ev.button !== 0) return;
      holdStart = performance.now();
      labelEl.classList.add("holding");
      tick();
      holdTimer = setTimeout(()=>{
        clearHold();
        habits = (habits||[]).filter(x=>x.id!==habit.id);
        save();
        showToast("Habit removed");
        render();
      }, HOLD_MS);
    });
    ["pointerup","pointercancel","pointerleave"].forEach(evt=>{
      labelEl.addEventListener(evt, clearHold);
    });
  }

  const isMobile = window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
  // Mobile: show a 7-day viewport and allow paging via swipe.
  const range = isMobile ? 7 : (analyticsView==="week" ? 14 : 60);
  const step  = isMobile ? 7 : (analyticsView==="week" ? 14 : 30);

  const viewLabel = analyticsView==="week" ? "2W" : "60D";
  const offsetLabel = analyticsOffsetDays===0 ? "Today" : (analyticsOffsetDays>0 ? `+${analyticsOffsetDays}d` : `${analyticsOffsetDays}d`);

  card.innerHTML = `
    <div class="cardHeader" style="align-items:flex-start">
      <div>
        <h3 class="cardTitle">Analytics</h3>
        <p class="small" style="margin:6px 0 0">Tap to toggle · Drag to paint · <span class="badge">${viewLabel}</span> · <span class="badge">${offsetLabel}</span></p>
      </div>
      <div class="analyticsControls">
        <div class="seg" role="tablist" aria-label="Analytics range">
          <button class="segBtn ${analyticsView==="week"?"active":""}" data-view="week" type="button">2W</button>
          <button class="segBtn ${analyticsView==="month"?"active":""}" data-view="month" type="button">60D</button>
        </div>
        <div class="seg" role="tablist" aria-label="Paint mode">
          <button class="segBtn ${analyticsPaintMode==="mark"?"active":""}" data-paint="mark" type="button">Mark</button>
          <button class="segBtn ${analyticsPaintMode==="erase"?"active":""}" data-paint="erase" type="button">Erase</button>
        </div>
        <button class="btn ghost" id="calPrev" type="button">←</button>
        <button class="btn ghost" id="calToday" type="button">Today</button>
        <button class="btn ghost" id="calNext" type="button">→</button>
      </div>
    </div>

    <div class="matrixWrap"><div class="matrixGrid" id="matrixGrid"></div></div>

    <div class="matrixHelp">
      <div class="matrixHint">Tip: hold then drag to paint. Hold Shift to erase temporarily. Hold a habit name for 2.5s to remove it.</div>
    </div>
  `;

  const grid = card.querySelector("#matrixGrid");

  // view toggle
  card.querySelectorAll("[data-view]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const v = btn.dataset.view;
      if(!v || v===analyticsView) return;
      analyticsView = v;
      localStorage.setItem("habitsAnalyticsView", analyticsView);
      renderAnalytics();
    });
  });

  // paint mode toggle
  card.querySelectorAll("[data-paint]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const p = btn.dataset.paint;
      if(!p || p===analyticsPaintMode) return;
      analyticsPaintMode = p;
      localStorage.setItem("habitsAnalyticsPaintMode", analyticsPaintMode);
      renderAnalytics();
    });
  });

  // calendar navigation
  card.querySelector("#calPrev").addEventListener("click", ()=>{
    analyticsOffsetDays -= step;
    localStorage.setItem("habitsAnalyticsOffsetDays", String(analyticsOffsetDays));
    renderAnalytics();
  });
  card.querySelector("#calNext").addEventListener("click", ()=>{
    analyticsOffsetDays += step;
    localStorage.setItem("habitsAnalyticsOffsetDays", String(analyticsOffsetDays));
    renderAnalytics();
  });
  card.querySelector("#calToday").addEventListener("click", ()=>{
    // On phone we want a clean "today → next 7 days" view.
    if(isMobile){
      analyticsView = "week";
      localStorage.setItem("habitsAnalyticsView", analyticsView);
    }
    analyticsOffsetDays = 0;
    localStorage.setItem("habitsAnalyticsOffsetDays", String(analyticsOffsetDays));
    window.__resetMatrixScroll = true;
    renderAnalytics();
  });

  if(!H || H.length===0){
    grid.innerHTML = '<p class="empty">Add a habit to see analytics.</p>';
    return;
  }

  // Week view should look forward (today → next N days). Month view remains historical.
  const dates = analyticsView === "week"
    ? rangeDates(range, analyticsOffsetDays, "forward")
    : rangeDates(range, analyticsOffsetDays);

  const todayIso = today();

  // ------------------------
  // Desktop: dates (rows) x habits (cols)
  // Mobile:  habits (rows) x dates (cols) with 7-day viewport + swipe paging
  // ------------------------

  if(!isMobile){
    const dateCol = 190;
    // compute cell size to fill available width when there are few H
    const wrapW = card.querySelector(".matrixWrap")?.clientWidth || 360;
    const gap = 8;
    const maxCell = 74;
    const minCell = 44;
    const avail = Math.max(0, wrapW - dateCol - gap*(H.length+1));
    const cell = Math.max(minCell, Math.min(maxCell, Math.floor(avail / Math.max(1, H.length))));
    grid.style.setProperty("--dateCol", dateCol+"px");
    grid.style.setProperty("--cell", cell+"px");

    const colTemplate = `var(--dateCol) repeat(${H.length}, var(--cell))`;

    // header row
    const header = document.createElement("div");
    header.className = "matrixHeaderRow";
    header.style.gridTemplateColumns = colTemplate;

    const corner = document.createElement("div");
    corner.className = "matrixCorner";
    corner.innerHTML = `
      <div style="font-weight:800">Dates</div>
      <div class="small" style="margin-top:4px;opacity:.85">${fmtMonthDay(dates[0])} → ${fmtMonthDay(dates[dates.length-1])}</div>
    `;
    header.appendChild(corner);

    H.forEach(h=>{
      const el = document.createElement("div");
      el.className = "matrixHabit";
      el.style.setProperty("--habit-accent", `hsl(${habitHue(h.id)} 70% 55%)`);
      el.title = h.name;
      el.innerHTML = `<span>${escapeHtml(h.name)}</span><div class="holdBar" aria-hidden="true"></div>`;

      bindHoldToDelete(el, h);

      header.appendChild(el);
    });

    grid.appendChild(header);
    requestAnimationFrame(()=>adaptDayLabels(header));

    // rows
    dates.forEach(iso=>{
      const row = document.createElement("div");
      row.className = "matrixRow" + (iso===todayIso ? " today" : "");
      row.style.gridTemplateColumns = colTemplate;

      const dateEl = document.createElement("div");
      dateEl.className = "matrixDate";
      dateEl.innerHTML = `<div class="d1">${fmtMonthDay(iso)}</div><div class="d2">${fmtWeekday(iso)}</div>`;
      row.appendChild(dateEl);

      H.forEach(h=>{
        const cell = document.createElement("div");
        cell.className = "matrixCell";
        cell.style.setProperty("--habit-accent", `hsl(${habitHue(h.id)} 70% 55%)`);

        const set = new Set(h.datesDone||[]);
        const done = set.has(iso);
        if(done) cell.classList.add("done");
        else if(iso < todayIso) cell.classList.add("missed");

        if(lastPulse && lastPulse.hid===h.id && lastPulse.iso===iso){
          cell.classList.add("justChanged");
          if(lastPulse.mode==="miss") cell.classList.add("pulseMiss");
        }
        cell.dataset.hid = h.id;
        cell.dataset.iso = iso;
        row.appendChild(cell);
      });

      grid.appendChild(row);
    });
  } else {
    // Mobile transpose
    const habitCol = 152;
    const wrapW = card.querySelector(".matrixWrap")?.clientWidth || 360;
    const gap = 8;
    // Slightly smaller cells on phone so more days fit comfortably.
    const maxCell = 58;
    const minCell = 34;
    const avail = Math.max(0, wrapW - habitCol - gap*(dates.length+1));
    const cell = Math.max(minCell, Math.min(maxCell, Math.floor(avail / Math.max(1, dates.length))));
    grid.style.setProperty("--habitCol", habitCol+"px");
    grid.style.setProperty("--cell", cell+"px");

    const colTemplate = `var(--habitCol) repeat(${dates.length}, var(--cell))`;

    const header = document.createElement("div");
    header.className = "matrixHeaderRow";
    header.style.gridTemplateColumns = colTemplate;

    const corner = document.createElement("div");
    corner.className = "matrixCorner";
    corner.innerHTML = `
      <div style="font-weight:800">Habits</div>
      <div class="small" style="margin-top:4px;opacity:.85">Swipe ← →</div>
    `;
    header.appendChild(corner);

    dates.forEach(iso=>{
      const d = document.createElement("div");
      d.className = "matrixDayHead";
      // Mobile day chip (low resolution): show ONLY
      // Row 1: month (2 letters)
      // Row 2: day (2 digits)
      const dd = new Date(iso+"T00:00:00");
      let mon = "";
      let day = "";
      try{
        mon = new Intl.DateTimeFormat(undefined,{month:"short"}).format(dd);
        day = new Intl.DateTimeFormat(undefined,{day:"2-digit"}).format(dd);
      }catch(e){
        mon = iso.slice(5,7);
        day = iso.slice(8,10);
      }
      // Force month to 2 letters for low-res chips (e.g. "Jan", "Feb" -> "Ja", "Fe").
      // Trim common trailing punctuation from some locales (e.g. "ян.").
      const mon2 = (String(mon).replace(/\./g, "").trim()).slice(0, 2);
      d.innerHTML = `
        <div class="d1"><span class="m" data-full="${mon}">${mon2}</span></div>
        <div class="d2"><span class="n">${day}</span></div>
      `;
      header.appendChild(d);
    });

    grid.appendChild(header);
    // No adaptive month/weekday shrinking here: low-res spec is fixed 2-letter month + 2-digit day.

    H.forEach(h=>{
      const row = document.createElement("div");
      row.className = "matrixRow";
      row.style.gridTemplateColumns = colTemplate;

      const name = document.createElement("div");
      name.className = "matrixHabitName";
      name.style.setProperty("--habit-accent", `hsl(${habitHue(h.id)} 70% 55%)`);
      name.title = h.name;
      name.innerHTML = `<span>${escapeHtml(h.name)}</span><div class="holdBar" aria-hidden="true"></div>`;
      bindHoldToDelete(name, h);
      row.appendChild(name);

      dates.forEach(iso=>{
        const cell = document.createElement("div");
        cell.className = "matrixCell";
        cell.style.setProperty("--habit-accent", `hsl(${habitHue(h.id)} 70% 55%)`);

        const set = new Set(h.datesDone||[]);
        const done = set.has(iso);
        if(done) cell.classList.add("done");
        else if(iso < todayIso) cell.classList.add("missed");

        if(lastPulse && lastPulse.hid===h.id && lastPulse.iso===iso){
          cell.classList.add("justChanged");
          if(lastPulse.mode==="miss") cell.classList.add("pulseMiss");
        }

        cell.dataset.hid = h.id;
        cell.dataset.iso = iso;
        row.appendChild(cell);
      });

      grid.appendChild(row);
    });

    // Swipe paging (mobile viewport)
    const wrap = card.querySelector('.matrixWrap');
    if(wrap && !wrap.dataset.swipeBound){
      wrap.dataset.swipeBound = '1';
      let sx=0, sy=0;
      let pointerDown=false;
      wrap.addEventListener('pointerdown', (e)=>{
        if(e.target && e.target.closest('.matrixCell')) return; // don't fight paint/tap
        pointerDown=true;
        sx=e.clientX; sy=e.clientY;
      });
      wrap.addEventListener('pointerup', (e)=>{
        if(!pointerDown) return;
        pointerDown=false;
        const dx = e.clientX - sx;
        const dy = e.clientY - sy;
        if(Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return;
        analyticsOffsetDays += (dx < 0 ? step : -step);
        localStorage.setItem('habitsAnalyticsOffsetDays', String(analyticsOffsetDays));
        renderAnalytics();
      });
      wrap.addEventListener('pointercancel', ()=>{ pointerDown=false; });
    }
  }

  // If user tapped "Today", ensure the viewport starts from the first day.
  const wrapEl = card.querySelector('.matrixWrap');
  if(wrapEl && window.__resetMatrixScroll){
    wrapEl.scrollLeft = 0;
    wrapEl.scrollTop = 0;
    window.__resetMatrixScroll = false;
  }

  // interactions: tap to toggle, hold then drag to paint
  let dragging = false;
  let dragStarted = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragHoldTimer = null;
  let dragPrimed = false;
  let dragStartCell = null;
  const DRAG_HOLD_MS = 380; // must hold this long before painting
  let targetDone = true;
  let touched = new Set();
  let dirty = false;

  function applyCell(cell){
    if(!cell) return;
    const hid = cell.dataset.hid;
    const iso = cell.dataset.iso;
    const key = hid + "|" + iso;
    if(touched.has(key)) return;
    touched.add(key);

    const h = H.find(x=>x.id===hid);
    if(!h) return;

    const set = new Set(h.datesDone||[]);
    const already = set.has(iso);

    if(targetDone){
      if(!already){
        set.add(iso);
        h.datesDone = Array.from(set).sort();
        dirty = true;
      }
      cell.classList.add("done");
      cell.classList.remove("missed");
    }else{
      if(already){
        set.delete(iso);
        h.datesDone = Array.from(set).sort();
        dirty = true;
      }
      cell.classList.remove("done");
      if(iso < todayIso) cell.classList.add("missed");
    }

    // one-shot micro animation on paint toggle
    cell.classList.add("justChanged");
    if(!targetDone) cell.classList.add("pulseMiss");
    setTimeout(()=>cell.classList.remove("justChanged","pulseMiss"), 280);
  }

  function endDrag(e){
    if(dragHoldTimer){ clearTimeout(dragHoldTimer); dragHoldTimer = null; }

    // If we never entered paint mode, treat this as a tap toggle (desktop-safe).
    if(dragPrimed && !dragStarted && dragStartCell){
      toggleHabitAt(dragStartCell.dataset.hid, dragStartCell.dataset.iso, {preserveScroll:true});
    }

    dragPrimed = false;
    dragStartCell = null;

    if(dirty) save();
    dirty = false;
    touched = new Set();
    dragging = false;
    setTimeout(()=>{ dragStarted = false; }, 0);
  }

  grid.addEventListener("pointerdown", (e)=>{
    const cell = e.target.closest(".matrixCell");
    if(!cell) return;

    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStarted = false;
    dragging = false;
    dragPrimed = true;
    dragStartCell = cell;
    touched = new Set();
    dirty = false;

    targetDone = (analyticsPaintMode==="erase" ? false : !cell.classList.contains("done"));
    if(e.shiftKey) targetDone = false;

    // Arm paint mode only after a short hold. If user releases quickly, it's just a tap.
    if(dragHoldTimer){ clearTimeout(dragHoldTimer); }
    dragHoldTimer = setTimeout(()=>{
      if(!dragPrimed) return;
      dragStarted = true;
      dragging = true;
      applyCell(dragStartCell);
    }, DRAG_HOLD_MS);

    grid.setPointerCapture?.(e.pointerId);
  });

  grid.addEventListener("pointermove", (e)=>{
    const dx = Math.abs(e.clientX - dragStartX);
    const dy = Math.abs(e.clientY - dragStartY);

    // If user starts moving before holding long enough, treat it as scroll/hover and cancel drag.
    if(!dragging && (dx > 12 || dy > 12)){
      if(dragHoldTimer){ clearTimeout(dragHoldTimer); dragHoldTimer = null; }
      dragPrimed = false;
      return;
    }
    if(!dragging) return;

    e.preventDefault();
    if(e.shiftKey) targetDone = false;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = el ? el.closest(".matrixCell") : null;
    applyCell(cell);
  });

  grid.addEventListener("pointerup", endDrag);
  grid.addEventListener("pointercancel", endDrag);
  grid.addEventListener("lostpointercapture", endDrag);

  // Subtle pulse animation for the most recently toggled cell (one-shot).
  if(lastPulse){
    requestAnimationFrame(()=>{
      document.querySelectorAll(".matrixCell.justChanged").forEach(c=>{
        setTimeout(()=>c.classList.remove("justChanged","pulseMiss"), 280);
      });
    });
    lastPulse = null;
  }
}



function renderInsights(){
  const el=document.getElementById("insights");
  if(!el) return;
  // Resolve the currently filtered habits locally (don't rely on external scope).
  const H = getFilteredHabits();
  const r7=completionRate(7);
  const r30=completionRate(30);
  const r60=completionRate(60);
  const r180=completionRate(180);

  // Weakest habit: lowest completion over last 14 days
  const weakest = (()=>{
    if(!H.length) return null;
    const now=new Date(today()+"T00:00:00");
    const days=14;
    const window=[];
    for(let i=days-1;i>=0;i--){
      const d=new Date(now); d.setDate(now.getDate()-i);
      window.push(d.toISOString().slice(0,10));
    }
    let best=null;
    for(const h of H){
      const set=new Set(h.datesDone||[]);
      const done=window.reduce((acc,iso)=>acc+(set.has(iso)?1:0),0);
      const rate=done/days;
      if(!best || rate < best.rate) best={h, done, days, rate};
    }
    return best;
  })();

  el.innerHTML=`
    <div class="cardHeader">
      <h3 class="cardTitle">Insights</h3>
      <span class="badge">Consistency</span>
    </div>
    <div class="consistencyViz">
      <div class="arcReactor" id="consistencyArc" data-scheme="status" aria-label="180 day completion visualization" role="img">
        <div class="arcCore">
          <div class="arcPct">${r180}%</div>
          <div class="arcLbl">180D</div>
        </div>
      </div>
      <div class="consistencyMeta">
        <div class="kpiRow" style="margin:0">
          <div class="kpi"><div class="kpiLabel">7‑day</div><div class="kpiValue">${r7}%</div></div>
          <div class="kpi"><div class="kpiLabel">30‑day</div><div class="kpiValue">${r30}%</div></div>
          <div class="kpi"><div class="kpiLabel">60‑day</div><div class="kpiValue">${r60}%</div></div>
          <div class="kpi"><div class="kpiLabel">180‑day</div><div class="kpiValue">${r180}%</div></div>
        </div>
        <p class="small" style="margin-top:10px">180 days is a strong baseline for long‑term habit formation.</p>
      </div>
    </div>
    <p class="small" style="margin-top:12px">Tap to toggle. Drag to paint in the Analytics grid.</p>
    ${weakest?`
      <div class="hintCard compact" style="margin-top:12px" id="weakestHint" role="button" tabindex="0" aria-label="Jump to weakest habit">
        <div class="hintIcon">🧠</div>
        <div class="hintText">
          <div class="hintTitle">Focus hint</div>
          <div class="hintBody">Weakest: <strong>${escapeHtml(weakest.h.name)}</strong> • ${weakest.done}/${weakest.days} in last 2 weeks</div>
        </div>
        <div class="hintCta">Jump →</div>
      </div>
    `:""}
  `;

  // Modern segmented "arc reactor" for 60-day consistency.
  const arc = el.querySelector('#consistencyArc');
  if(arc) setArcReactor(arc, r180, 5);
  // Store last computed value so the right-panel copy can re-apply styles.
  window.__lastConsistency180 = r180;

  if(weakest){
    const hint = el.querySelector('#weakestHint');
    const go = ()=>{ setCarouselIndex(H.findIndex(x=>x.id===weakest.h.id)); };
    hint?.addEventListener('click', go);
    hint?.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); go(); } });
  }
}

function buildArcGradient(pct, segments, onColor, offColor){
  const seg = Math.max(3, Math.min(8, segments||6));
  const p = Math.max(0, Math.min(100, Number(pct)||0));
  const total = (p/100) * seg;
  const full = Math.floor(total);
  const partial = total - full;

  const slice = 360/seg;
  const gap = Math.min(10, slice*0.18); // degrees between segments
  const fill = slice-gap;

  const on = onColor || 'hsla(210, 100%, 70%, 0.95)';
  const off = offColor || 'hsla(210, 35%, 45%, 0.18)';
  const stops=[];

  for(let i=0;i<seg;i++){
    const a0 = i*slice;
    const aFillEnd = a0 + fill;
    const a2 = a0 + slice;

    if(i < full){
      stops.push(`${on} ${a0}deg ${aFillEnd}deg`);
    }else if(i === full && partial > 0){
      const aMid = a0 + (fill * partial);
      stops.push(`${on} ${a0}deg ${aMid}deg`);
      stops.push(`${off} ${aMid}deg ${aFillEnd}deg`);
    }else{
      stops.push(`${off} ${a0}deg ${aFillEnd}deg`);
    }
    stops.push(`transparent ${aFillEnd}deg ${a2}deg`);
  }
  return `conic-gradient(from -90deg, ${stops.join(',')})`;
}



// --- Percent-based status coloring (shared by arc + stats fills) ---
function statusColorForPercent(pi){
  // Spec ranges:
  // 0–33  -> Low (red)
  // 34–66 -> Medium (yellow)
  // 67–100-> Good (green)
  const x = Math.max(0, Math.min(100, Math.round(Number(pi)||0)));

  // SVG attributes are picky about color formats; use rgba() to be safe.
  const clamp01 = (t)=>Math.max(0, Math.min(1, t));
  const lerp = (a,b,t)=>a+(b-a)*t;

  function hslToRgb(h, s, l){
    h = ((h%360)+360)%360;
    s = Math.max(0, Math.min(100, s))/100;
    l = Math.max(0, Math.min(100, l))/100;

    const c = (1 - Math.abs(2*l - 1)) * s;
    const hp = h / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r1=0,g1=0,b1=0;

    if(0<=hp && hp<1){ r1=c; g1=x; b1=0; }
    else if(1<=hp && hp<2){ r1=x; g1=c; b1=0; }
    else if(2<=hp && hp<3){ r1=0; g1=c; b1=x; }
    else if(3<=hp && hp<4){ r1=0; g1=x; b1=c; }
    else if(4<=hp && hp<5){ r1=x; g1=0; b1=c; }
    else if(5<=hp && hp<6){ r1=c; g1=0; b1=x; }

    const m = l - c/2;
    return {
      r: Math.round((r1+m)*255),
      g: Math.round((g1+m)*255),
      b: Math.round((b1+m)*255),
    };
  }

  const rgba = (h,s,l,a)=>{
    const {r,g,b} = hslToRgb(h,s,l);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  };

  if(x <= 33){
    const t = clamp01(x/33);
    return {
      on:   rgba(0, 92, lerp(54, 62, t), 0.96),
      off:  rgba(0, 50, lerp(20, 28, t), 0.22),
      glow: rgba(0, 92, lerp(58, 70, t), 0.75),
    };
  }
  if(x <= 66){
    const t = clamp01((x-34)/32);
    return {
      on:   rgba(45, 100, lerp(54, 62, t), 0.96),
      off:  rgba(45, 55,  lerp(24, 34, t), 0.22),
      glow: rgba(45, 100, lerp(58, 72, t), 0.75),
    };
  }
  {
    const t = clamp01((x-67)/33);
    return {
      on:   rgba(135, 90, lerp(58, 54, t), 0.96),
      off:  rgba(135, 55, lerp(32, 28, t), 0.22),
      glow: rgba(135, 90, lerp(68, 62, t), 0.75),
    };
  }
}

const __arcReactorState = new Map(); // key -> last integer pct rendered for arc reactors

function setArcReactor(el, pct, segments){
  const p = Math.max(0, Math.min(100, Number(pct)||0));
  const seg = Math.max(3, Math.min(8, Number(segments)||5));

  // Always animate from 0 → target so the viewer can *see* every single
  // percent step (1%, 2%, 3% ... target), like a true "filling" animation.
  // Start at 1% (when target > 0) so the user can visually see
  // 1%, 2%, 3% ... as distinct steps.
  // Persist last rendered % across re-renders so the arc can continue (or rollback) from where it was.
  const key = (el.id || el.getAttribute('data-key') || '').trim();
  const stored = key && __arcReactorState.has(key) ? Number(__arcReactorState.get(key)) : NaN;
  const inline = Number(el.dataset.curPct ?? el.style.getPropertyValue('--arc-p') ?? 0) || 0;
  const existing = Number.isFinite(stored) ? stored : inline;

  // If we have no prior state and target > 0, start at 1% so the user sees the first visible step.
  const prev = (existing > 0 || p <= 0) ? Math.max(0, Math.min(100, Math.round(existing))) : 1;
  el.dataset.pct = String(p);

  // Optional center label ("xx%") inside the arc.
  const pctLabel = el.querySelector('.arcPct');

  const scheme = (el.getAttribute('data-scheme')||'').toLowerCase();
  const pctEl = el.querySelector('.arcPct');
  let on, off;

  // Build status colors *per integer percent* so color visibly evolves
  // while the arc advances 1% at a time.
  function lerp(a,b,t){ return a + (b-a)*t; }
  function clamp01(x){ return Math.max(0, Math.min(1, x)); }
  function hsla(h,s,l,a){
    return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${a})`;
  }
  function statusColors(pi){ return statusColorForPercent(pi); }

  if(scheme === 'status'){
    ({on, off} = statusColors(prev));
    el.style.setProperty('--arc-glow', on);
  }else{
    on = 'hsla(210, 100%, 70%, 0.95)';
    off = 'hsla(210, 35%, 45%, 0.18)';
    el.style.setProperty('--arc-glow', 'hsla(210, 100%, 70%, 0.65)');
  }

  el.style.setProperty('--arc-on', on);
  el.style.setProperty('--arc-off', off);

  // Paint the initial 1% state immediately so the first visible frame isn't 0%.
  el.style.backgroundImage = buildArcGradient(prev, seg, on, off);
  el.style.setProperty('--arc-p', String(prev));
  el.dataset.curPct = String(prev);
  if(key) __arcReactorState.set(key, prev);
  if(pctEl) pctEl.textContent = `${prev}%`;

  // reset state
  el.classList.remove('charged', 'fullPulse');
  el.classList.add('charging');

  // Slower fill so it feels like a smooth "loading" sweep.
    // Slower fill so it feels like a smooth "loading" sweep,
  // but we advance in *real* integer % steps: 1%, 2%, 3% ... target.
  // Make each 1% step readable. (e.g. 30% ≈ 1.2s, 70% ≈ 2.6s)
  const DURATION = Math.max(900, Math.round(p * 38));
  const t0 = performance.now();

  const easeOutCubic = (t)=>1 - Math.pow(1-t, 3);

  // We only re-render when the integer percentage changes.
  // This guarantees the visual passes through 1%, 2%, 3% ... (or downwards if needed).
  let lastInt = prev;

  const tick = (t)=>{
    const k = Math.max(0, Math.min(1, (t - t0) / DURATION));
    const e = easeOutCubic(k);
    const easedVal = prev + (p - prev) * e;

    let nextInt;
    if(p >= prev){
      nextInt = Math.min(p, Math.max(lastInt, Math.floor(easedVal)));
    }else{
      nextInt = Math.max(p, Math.min(lastInt, Math.ceil(easedVal)));
    }

    // Always keep the center % label in sync with the animated value.
    // (Some renders previously only updated at the end or on sparse steps.)
    if(pctEl) pctEl.textContent = `${nextInt}%`;

    if(nextInt !== lastInt){
      lastInt = nextInt;
      // Update colors per integer % (only for the status scheme)
      if(scheme === 'status'){
        const c = statusColors(lastInt);
        on = c.on; off = c.off;
        el.style.setProperty('--arc-on', on);
        el.style.setProperty('--arc-off', off);
        el.style.setProperty('--arc-glow', c.glow);
      }
      el.style.backgroundImage = buildArcGradient(lastInt, seg, on, off);
      el.style.setProperty('--arc-p', String(lastInt));
      el.dataset.curPct = String(lastInt);
      if(key) __arcReactorState.set(key, lastInt);
    }

    if(k < 1){
      requestAnimationFrame(tick);
      return;
    }

    // Snap to final value and add "charged" animation.
    // Final snap (and final color state)
    if(scheme === 'status'){
      const c = statusColors(p);
      on = c.on; off = c.off;
      el.style.setProperty('--arc-on', on);
      el.style.setProperty('--arc-off', off);
      el.style.setProperty('--arc-glow', c.glow);
    }
    el.style.backgroundImage = buildArcGradient(p, seg, on, off);
    el.style.setProperty('--arc-p', String(p));
    el.dataset.curPct = String(p);
    if(key) __arcReactorState.set(key, p);
    if(pctEl) pctEl.textContent = `${p}%`;
    el.classList.remove('charging');
    el.classList.add('charged');
    if(p >= 100){
      el.classList.add('fullPulse');
    }
  };

  requestAnimationFrame(tick);
}



// --- Habits > Stats chart animation (streak bars) ---
const __streakFillState = new Map(); // key -> last integer pct rendered

function animateStreakFill(fillEl, targetPct, key){
  const p = Math.max(0, Math.min(100, Math.round(Number(targetPct)||0)));
  const prevRaw = __streakFillState.has(key) ? __streakFillState.get(key) : Number(fillEl.dataset.curPct||0)||0;
  const prev = Math.max(0, Math.min(100, Math.round(prevRaw)));

  // If the element is newly created, paint the previous state immediately (so it continues from there).
  fillEl.style.width = `${prev}%`;
  fillEl.dataset.curPct = String(prev);
  __streakFillState.set(key, prev);

  const DURATION = Math.max(650, Math.round(Math.abs(p - prev) * 28));
  const t0 = performance.now();
  const easeOutCubic = (t)=>1 - Math.pow(1-t, 3);
  let lastInt = prev;

  const tick = (t)=>{
    const k = Math.max(0, Math.min(1, (t - t0) / DURATION));
    const e = easeOutCubic(k);
    const easedVal = prev + (p - prev) * e;

    let nextInt;
    if(p >= prev){
      nextInt = Math.min(p, Math.max(lastInt, Math.floor(easedVal)));
    }else{
      nextInt = Math.max(p, Math.min(lastInt, Math.ceil(easedVal)));
    }

    if(nextInt !== lastInt){
      lastInt = nextInt;
      fillEl.style.width = `${lastInt}%`;
      fillEl.dataset.curPct = String(lastInt);
      __streakFillState.set(key, lastInt);

      // Color shifts per % (same scheme as the pie)
      const c = statusColorForPercent(lastInt);
      fillEl.style.background = c.on;
      fillEl.style.boxShadow = `0 0 0 rgba(0,0,0,0), 0 0 14px ${c.glow}`;
    }

    if(k < 1){
      requestAnimationFrame(tick);
      return;
    }

    // final snap
    fillEl.style.width = `${p}%`;
    fillEl.dataset.curPct = String(p);
    __streakFillState.set(key, p);
    const c = statusColorForPercent(p);
    fillEl.style.background = c.on;
    fillEl.style.boxShadow = `0 0 0 rgba(0,0,0,0), 0 0 14px ${c.glow}`;
  };

  requestAnimationFrame(tick);
}

function renderStreakSummary(){
  const el=document.getElementById("streakSummary");
  if(!el) return;
  // Resolve the currently filtered habits locally (don't rely on external scope).
  const H = getFilteredHabits();
  if(!H.length){
    el.innerHTML='<div class="cardHeader"><h3 class="cardTitle">Streaks</h3></div><p class="empty">No H yet.</p>';
    return;
  }
  const stats=H.map(h=>({h, s:streakFor(h)}));
  stats.sort((a,b)=>b.s.current-a.s.current);
  const top=stats.slice(0,4);
  const maxCurrent = Math.max(1, ...top.map(x=>x.s.current));
  el.innerHTML=`
    <div class="cardHeader">
      <h3 class="cardTitle">Streaks</h3>
      <span class="badge">Top</span>
    </div>
    <div class="streakList">
      ${top.map(x=>{
        const pct = Math.round((x.s.current / maxCurrent) * 100);
        return `
          <div class="streakItem">
            <div class="streakMeta">
              <div class="streakName">${escapeHtml(x.h.name)}</div>
              <div class="streakSub">Best ${x.s.best}</div>
            </div>
            <div class="streakRight">
              <div class="pill">${x.s.current}d</div>
            </div>
            <div class="streakBar"><div class="streakFill" style="width:${pct}%"></div></div>
          </div>
        `;


// Animate the Stats chart bars (continue from previous % instead of restarting).
// Keyed by habit name (stable enough for this app); if you have ids, switch to h.id.
requestAnimationFrame(()=>{
  const items = el.querySelectorAll('.streakItem');
  items.forEach(item=>{
    const nameEl = item.querySelector('.streakName');
    const fillEl = item.querySelector('.streakFill');
    if(!fillEl) return;
    const key = (nameEl ? nameEl.textContent.trim() : '') || fillEl.dataset.key || '';
    const target = parseFloat((fillEl.style.width||'').replace('%','')) || 0;
    // store key for future renders
    fillEl.dataset.key = key;
    animateStreakFill(fillEl, target, key);
  });
});
      }).join("")}
    </div>
  `;
}

function render(){
  if(markDate && !markDate.value) markDate.value=today();
  const H = getFilteredHabits();

  renderAnalytics();
  renderInsights();
  renderStreakSummary();
  renderHero();
  renderFocusCard();
  syncSidePanels();

  habitList.innerHTML="";
  if(H.length===0){
    habitList.innerHTML='<p class="empty">No H yet. Add your first habit above.</p>';
    return;
  }

  const date=getMarkDate();
  const cards = H.map((h, idx)=>{
    const set=new Set(h.datesDone||[]);
    const done=set.has(date);
    const s=streakFor(h);
    return `
      <div class="card habitSlide" data-index="${idx}" aria-label="Habit ${idx+1} of ${H.length}">
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div>
            <strong>${escapeHtml(h.name)}</strong>
            <div class="small">Current: ${s.current} • Best: ${s.best}</div>
          </div>
          <span class="badge">${done?'Completed':'Due'}</span>
        </div>
        <div style="margin-top:10px">
          <span class="badge">Date: ${date}</span>
          <span class="badge">Mark in grid</span>
        </div>
        ${miniHeatHtml(h)}
      </div>
    `;
  }).join('');

  habitList.innerHTML = `<div class="habitListStack">${cards}</div>`;

}

// Re-render when the selected mark date changes (affects streaks + insights)
if(typeof markDate!=="undefined"){
  markDate.addEventListener("change", ()=>render());
}


function deleteHabit(id){
  if(!confirm("Delete this habit?")) return;
  habits = habits.filter(h=>h.id!==id);
  save();
  render();
}



function renderFocusCard(){
  // v10: avoid duplicate "Focus hint" cards. We keep the single compact hint tile.
  const el = document.getElementById("focusHint");
  if(!el) return;
  el.innerHTML = "";
  el.style.display = "none";
}

function syncSidePanels(){
  const sMain = document.getElementById("streakSummary");
  const iMain = document.getElementById("insights");
  const sSide = document.getElementById("streakSummarySide");
  const iSide = document.getElementById("insightsSide");
  if(sMain && sSide) sSide.innerHTML = sMain.innerHTML;
  if(iMain && iSide) iSide.innerHTML = iMain.innerHTML;

  // Re-apply arc styling for the duplicated Insights card on desktop right panel.
  const sideArc = iSide?.querySelector?.('.arcReactor');
  if(sideArc && Number.isFinite(window.__lastConsistency180)){
    setArcReactor(sideArc, window.__lastConsistency180, 5);
  }
}

function wireHabitsLayout(){
  const sel = document.getElementById("dateRangeSelect");
  const sel2 = document.getElementById("appWeekSelect");
  const applyRange = (val)=>{
    analyticsView = (val==="week") ? "week" : "month";
    localStorage.setItem("habitsAnalyticsView", analyticsView);
    render();
  };
  if(sel){
    sel.value = (analyticsView==="week") ? "week" : "sixty";
    sel.addEventListener("change", ()=>applyRange(sel.value));
  }
  if(sel2){
    sel2.value = (analyticsView==="week") ? "week" : "sixty";
    sel2.addEventListener("change", ()=>applyRange(sel2.value));
  }

  const search = document.getElementById("habitSearch");
  if(search){
    search.addEventListener("input", ()=>{
      habitSearchTerm = search.value || "";
      render();
    });
  }

  const newBtn = document.getElementById("newHabitBtn");
  const newBtn2 = document.getElementById("appNewHabitBtn");
  if(newBtn) newBtn.addEventListener("click", (e)=>openAddHabit(e.currentTarget));
  if(newBtn2) newBtn2.addEventListener("click", (e)=>openAddHabit(e.currentTarget));

  // Add-habit modal wiring (mobile-friendly)
  const modal = document.getElementById('addHabitModal');
  if(modal && !modal.__wired){
    modal.__wired = true;
    const input = document.getElementById('addHabitModalInput');
    const close = document.getElementById('addHabitClose');
    const cancel = document.getElementById('addHabitCancel');
    const confirm = document.getElementById('addHabitConfirm');
    const backdrop = modal.querySelector('[data-close]');

    const onClose = ()=>closeAddHabitModal();
    close && close.addEventListener('click', onClose);
    cancel && cancel.addEventListener('click', onClose);
    backdrop && backdrop.addEventListener('click', onClose);
    confirm && confirm.addEventListener('click', ()=>confirmAddHabitModal());
    input && input.addEventListener('keydown', (ev)=>{
      if(ev.key==='Enter') confirmAddHabitModal();
      if(ev.key==='Escape') onClose();
    });
    document.addEventListener('keydown', (ev)=>{
      if(ev.key==='Escape' && modal.classList.contains('open')) onClose();
    });
  }

  // tabs (mobile)
  const tabBtns = Array.from(document.querySelectorAll(".tabBtn"));
  const panels = Array.from(document.querySelectorAll(".tabPanel"));
  tabBtns.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      tabBtns.forEach(b=>b.classList.toggle("active", b===btn));
      const tab = btn.getAttribute("data-tab");
      panels.forEach(p=>p.classList.toggle("active", p.getAttribute("data-panel")===tab));
      // On desktop, keep all visible via CSS
      if(tab==="stats"){ try{ renderFocusCard(); }catch(e){} }
    });
  });
}




// ----------------------
// Daily reminder (configurable in Settings)
// ----------------------
let __habitsReminderTimer = null;

function getHabitsReminderSettings(){
  try{
    const raw = JSON.parse(localStorage.getItem("habitsReminder")||"null") || {};
    return {
      enabled: raw.enabled !== false,
      time: typeof raw.time==="string" ? raw.time : "20:00",
      threshold: Number.isFinite(raw.threshold) ? Math.max(0, Math.min(100, raw.threshold)) : 50
    };
  }catch(_){
    return { enabled:true, time:"20:00", threshold:50 };
  }
}

function computeTodayCompletionPct(){
  const H = getFilteredHabits();
  if(!H.length) return 0;
  const iso = today();
  const done = H.filter(h => (h.datesDone||[]).includes(iso)).length;
  return Math.round((done / H.length) * 100);
}

function notifyHabitsReminder(pct, threshold){
  const title = "Habits reminder";
  const body = `You're at ${pct}% today (target ${threshold}%). Open Habits to finish today.`;
  // Prefer system notifications if allowed; fallback to toast/alert.
  if("Notification" in window && Notification.permission === "granted"){
    try{
      const n = new Notification(title, { body });
      // Some browsers require a user gesture to focus; ignore errors.
      n.onclick = ()=>{ try{ window.focus(); }catch(_){} };
      return;
    }catch(_){}
  }
  if(typeof showToast === "function") showToast(body);
  else alert(body);
}

function runHabitsReminderCheck(){
  const s = getHabitsReminderSettings();
  if(!s.enabled) return;
  const H = getFilteredHabits();
  if(!H.length) return;

  const iso = today();
  const last = localStorage.getItem("habitsReminderLastNotified") || "";
  const pct = computeTodayCompletionPct();

  if(pct < s.threshold && last !== iso){
    localStorage.setItem("habitsReminderLastNotified", iso);
    notifyHabitsReminder(pct, s.threshold);
  }
}

function scheduleHabitsReminder(){
  if(__habitsReminderTimer) clearTimeout(__habitsReminderTimer);
  const s = getHabitsReminderSettings();
  if(!s.enabled) return;

  const now = new Date();
  const [hh, mm] = String(s.time||"20:00").split(":").map(x=>parseInt(x,10));
  const target = new Date(now);
  target.setHours(Number.isFinite(hh)?hh:20, Number.isFinite(mm)?mm:0, 0, 0);

  // If already past today's target, schedule for tomorrow.
  if(target.getTime() <= now.getTime()){
    target.setDate(target.getDate() + 1);
  }

  const ms = Math.max(250, target.getTime() - now.getTime());
  __habitsReminderTimer = setTimeout(()=>{
    runHabitsReminderCheck();
    scheduleHabitsReminder(); // reschedule next day
  }, ms);
}

// Keep reminder schedule in sync if Settings are changed in another tab.
window.addEventListener("storage", (e)=>{
  if(e && e.key === "habitsReminder") scheduleHabitsReminder();
});


wireHabitsLayout();
render();
// Start daily reminder timer (if enabled)
scheduleHabitsReminder();

// Keep the grid layout in sync when switching between desktop ↔ mobile widths.
// (Needed because the grid renderer branches on a media query.)
// Treat tablet widths as desktop so the Dates column is visible on larger screens.
// (Users reported the date column disappearing on "big" screens when the mobile transpose kicks in.)
let __habitsLastIsMobile = window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
let __habitsResizeTimer = null;
window.addEventListener("resize", ()=>{
  const nowIsMobile = window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
  const breakpointChanged = nowIsMobile !== __habitsLastIsMobile;
  __habitsLastIsMobile = nowIsMobile;
  if(__habitsResizeTimer) clearTimeout(__habitsResizeTimer);
  __habitsResizeTimer = setTimeout(()=>{
    // Re-render so the grid orientation + cell sizing recalculates.
    render();
  }, breakpointChanged ? 0 : 120);
});


function adaptLabel(el, maxChars=3){
  if(!el) return;
  const full = (el.dataset && el.dataset.full) ? el.dataset.full : el.textContent;
  if(el.dataset) el.dataset.full = full;

  for(let len = Math.min(maxChars, full.length); len >= 1; len--){
    el.textContent = full.slice(0, len);
    if(el.scrollWidth <= el.clientWidth) return;
  }
}

function adaptDayLabels(scope=document){
  scope.querySelectorAll(".matrixDayHead .m").forEach(el=>adaptLabel(el,3));
  scope.querySelectorAll(".matrixDayHead .w").forEach(el=>adaptLabel(el,3));
}

function setAnalyticsOffset(val){
  analyticsOffsetDays = val;
  localStorage.setItem("habitsAnalyticsOffsetDays", String(analyticsOffsetDays));
  render();
}


function setHeroWheel(el, pct){
  if(!el) return;
  const target = Math.max(0, Math.min(100, Math.round(Number(pct)||0)));
  const LS_KEY = "heroWheelPrevPct";
  const r = 46;
  const c = 2 * Math.PI * r;

  // Create a small gap at the top (like the reference design)
  const gap = 0.085; // 8.5% of circumference
  const usable = c * (1 - gap);

  const track = el.querySelector(".wheelTrack");
  const prog  = el.querySelector(".wheelProg");
  const label = el.querySelector(".wheelPct");
  const defs = el.querySelector('defs');
  const stops = defs ? Array.from(defs.querySelectorAll('#wheelGrad stop')) : [];

  const apply = (v, opts={})=>{
    const p = Math.max(0, Math.min(100, Math.round(Number(v)||0)));

    if(track){
      track.style.strokeDasharray = `${usable} ${c}`;
      track.style.strokeDashoffset = `${c * gap * 0.5}`;
    }
    if(prog){
      const filled = usable * (p/100);
      prog.style.strokeDasharray = `${filled} ${c}`;
      prog.style.strokeDashoffset = `${c * gap * 0.5}`;
    }

    // Status colors affect: glow, percent text, and the ring stroke
    const sc = statusColorForPercent(p);
    el.style.setProperty('--wheel-glow', sc.glow);

    if(stops.length){
      stops[0]?.setAttribute('stop-color', sc.on);
      stops[1]?.setAttribute('stop-color', sc.on);
      stops[2]?.setAttribute('stop-color', sc.on);
    }

    if(label){
      label.textContent = `${p}%`;
      label.style.color = sc.on;
      label.style.textShadow = `0 10px 30px ${sc.glow}`;
    }

    if(p === 100) el.classList.add('fullPulse');
    else el.classList.remove('fullPulse');

    if(opts.isAnimating) el.classList.add('isAnimating');
    else el.classList.remove('isAnimating');

    el.dataset.curPct = String(p);
  };

  // Respect reduced motion preferences.
  try{
    if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      apply(target, {isAnimating:false});
      try{ localStorage.setItem(LS_KEY, String(target)); }catch(e){}
      return;
    }
  }catch(e){}

  // Determine previous percent for smooth load:
  // load → get previousPercent → render ring @ previousPercent → animate(previous → target)
  let prev = Number(el.dataset.curPct);

  if(!Number.isFinite(prev)){
    const stored = Number(localStorage.getItem(LS_KEY));
    prev = Number.isFinite(stored) ? stored : 0;
  }

  prev = Math.max(0, Math.min(100, Math.round(prev)));

  // Always render at previous first (prevents instant flash to target on load)
  apply(prev, {isAnimating:false});

  const start = prev;
  const delta = target - start;

  if(delta === 0){
    apply(target, {isAnimating:false});
    try{ localStorage.setItem(LS_KEY, String(target)); }catch(e){}
    return;
  }

  const dur = Math.max(420, Math.min(1400, 420 + Math.abs(delta) * 10));
  const easeOutCubic = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

  let t0 = 0;
  let lastInt = start;

  function frame(ts){
    if(!t0) t0 = ts;
    const t = Math.max(0, Math.min(1, (ts - t0) / dur));
    const eased = easeOutCubic(t);
    const v = Math.round(start + delta * eased);

    if(v !== lastInt){
      lastInt = v;
      apply(v, {isAnimating:true});
    }else{
      // still keep animating class + glow intensity during active fill
      applyRingLikeAnimatingState();
    }

    if(t < 1){
      requestAnimationFrame(frame);
    }else{
      apply(target, {isAnimating:false});
      try{ localStorage.setItem(LS_KEY, String(target)); }catch(e){}
    }
  }

  function applyRingLikeAnimatingState(){
    // lightweight: just ensure class present during animation
    el.classList.add('isAnimating');
  }

  requestAnimationFrame(frame);
}




function renderHero(){
  const el = document.getElementById("habitsHero");
  if(!el) return;
  const H = getFilteredHabits();
  const iso = today();
  const done = H.filter(h => (h.datesDone||[]).includes(iso)).length;
  const total = H.length || 0;
  const pct = total ? Math.round((done/total)*100) : 0;

  el.innerHTML = `
    <div class="card heroCard">
      <div class="heroTop">
        <div>
          <div class="cardTitle">Today</div>
          <div class="heroKpi"><span class="heroNum">${done}</span><span class="heroDen">/${total||0}</span> done</div>
          <div class="small">Keep it simple: small wins compound.</div>
        </div>

        <div class="habitWheel" id="heroArc" data-pct="${pct}" role="img" aria-label="Today's completion">
          <svg class="wheelSvg" viewBox="0 0 120 120" aria-hidden="true">
            <defs>
              <linearGradient id="wheelGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="rgba(255, 222, 107, 0.95)"/>
                <stop offset="55%" stop-color="rgba(255, 204, 64, 0.98)"/>
                <stop offset="100%" stop-color="rgba(255, 180, 35, 0.95)"/>
              </linearGradient>
              <filter id="wheelGlow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3.5" result="blur"/>
                <feColorMatrix in="blur" type="matrix"
                  values="1 0 0 0 0
                          0 1 0 0 0
                          0 0 1 0 0
                          0 0 0 0.75 0" result="glow"/>
                <feMerge>
                  <feMergeNode in="glow"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            <g class="wheelRot">
              <circle class="wheelTrack" cx="60" cy="60" r="46"></circle>
              <circle class="wheelProg" cx="60" cy="60" r="46"></circle>
            </g>
          </svg>

          <div class="wheelCenter">
            <div class="wheelPct">${pct}%</div>
            <div class="wheelSub">${done} of ${total||0} done</div>
          </div>
        </div>
      </div>

      <div class="heroActions">
        <button class="heroPill onlyMobile" onclick="openAddHabit(this)">Add habit</button>
      </div>
    </div>
  `;

  const wheel = el.querySelector("#heroArc");
  if(wheel) setHeroWheel(wheel, pct);
}

