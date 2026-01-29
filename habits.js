
// --- Analytics state (must be defined before first render) ---
let analyticsView = localStorage.getItem("habitsAnalyticsView") || "month";
let analyticsOffsetDays = parseInt(localStorage.getItem("habitsAnalyticsOffsetDays") || "0", 10);
let analyticsPaintMode = localStorage.getItem("habitsAnalyticsPaintMode") || "mark"; // mark | erase
let lastPulse = null; // {hid, iso, mode:"done"|"miss"} for subtle mark animation

function rangeDates(rangeDays, offsetDays){
  const base = new Date();
  base.setDate(base.getDate() + (offsetDays||0));
  const res=[];
  for(let i=rangeDays-1;i>=0;i--){
    const x=new Date(base);
    x.setDate(base.getDate()-i);
    res.push(x.toISOString().slice(0,10));
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

// Forward-looking range (start at today+offset and go forward)
function rangeDatesForward(rangeDays, offsetDays){
  const start = new Date();
  start.setDate(start.getDate() + (offsetDays||0));
  const res=[];
  for(let i=0;i<rangeDays;i++){
    const x=new Date(start);
    x.setDate(start.getDate()+i);
    res.push(x.toISOString().slice(0,10));
  }
  return res;
}


let habits=JSON.parse(localStorage.getItem("habitsV2")||"[]");
function save(){localStorage.setItem("habitsV2",JSON.stringify(habits));}
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

function lastNDates(n=21){
  const res=[];
  const d=new Date();
  for(let i=n-1;i>=0;i--){
    const x=new Date(d);
    x.setDate(d.getDate()-i);
    res.push(x.toISOString().slice(0,10));
  }
  return res;
}




function fmtWeekday(iso){
  const d=new Date(iso+"T00:00:00");
  return d.toLocaleDateString(undefined,{weekday:"short"});
}

// ---------- Templates ----------
const HABIT_TEMPLATES={
  morning:["Drink water","Meditate 5 min","Plan the day","Walk 10 min"],
  gym:["Workout","Protein target","Stretch","Steps 8k"],
  study:["Deep work 45 min","Review notes","Read 20 pages"],
};


function addHabit(){
  if(!habitName.value) return;
  habits.push({id:crypto.randomUUID(), name:habitName.value, created:today(), datesDone:[]});
  habitName.value="";
  save(); render(); showToast("Habit added");
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

  // Preserve matrix scroll position for a smoother feel
  const wrap = document.querySelector('.matrixWrap');
  const scroll = wrap ? {top:wrap.scrollTop, left:wrap.scrollLeft} : null;

  render();

  if(opts && opts.preserveScroll && scroll){
    requestAnimationFrame(()=>{
      const w = document.querySelector('.matrixWrap');
      if(w){ w.scrollTop = scroll.top; w.scrollLeft = scroll.left; }
    });
  }
  return nowDone;
}

function toggleHabit(id){
  // kept for compatibility, but UI no longer uses buttons
  const date = getMarkDate();
  return toggleHabitAt(id, date, {preserveScroll:true});
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

  const range = analyticsView==="week" ? 14 : 60; // bigger heatmap
  const step  = analyticsView==="week" ? 14 : 30;

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
    analyticsOffsetDays = 0;
    localStorage.setItem("habitsAnalyticsOffsetDays", String(analyticsOffsetDays));
    renderAnalytics();
  });

  if(!H || H.length===0){
    grid.innerHTML = '<p class="empty">Add a habit to see analytics.</p>';
    return;
  }

  // Week view should look forward (today → next 14 days). Month view remains historical.
  const dates = analyticsView === "week"
    ? rangeDatesForward(range, analyticsOffsetDays)
    : rangeDates(range, analyticsOffsetDays);
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

    // Hold-to-delete (2.5 seconds)
    let holdTimer = null;
    let raf = null;
    let holdStart = 0;
    const HOLD_MS = 2500;

    function clearHold(){
      if(holdTimer){ clearTimeout(holdTimer); holdTimer = null; }
      if(raf){ cancelAnimationFrame(raf); raf = null; }
      el.classList.remove("holding");
      el.style.removeProperty("--hold");
    }

    function tick(){
      const t = Math.min(1, (performance.now() - holdStart) / HOLD_MS);
      el.style.setProperty("--hold", String(t));
      if(t < 1) raf = requestAnimationFrame(tick);
    }

    el.addEventListener("pointerdown", (ev)=>{
      // Only primary button / touch
      if(ev.button != null && ev.button !== 0) return;
      holdStart = performance.now();
      el.classList.add("holding");
      tick();
      holdTimer = setTimeout(()=>{
        clearHold();
        H = H.filter(x=>x.id!==h.id);
        save();
        showToast("Habit removed");
        render();
      }, HOLD_MS);
    });
    ["pointerup","pointercancel","pointerleave"].forEach(evt=>{
      el.addEventListener(evt, clearHold);
    });

    header.appendChild(el);
  });

  grid.appendChild(header);

  const todayIso = today();

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
  const r7=completionRate(7);
  const r30=completionRate(30);

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
    <div class="kpiRow">
      <div class="kpi"><div class="kpiLabel">7‑day completion</div><div class="kpiValue">${r7}%</div></div>
      <div class="kpi"><div class="kpiLabel">30‑day completion</div><div class="kpiValue">${r30}%</div></div>
    </div>
    <p class="small" style="margin-top:10px">Mark H in the Analytics grid above.</p>
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

  if(weakest){
    const hint = el.querySelector('#weakestHint');
    const go = ()=>{ setCarouselIndex(H.findIndex(x=>x.id===weakest.h.id)); };
    hint?.addEventListener('click', go);
    hint?.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); go(); } });
  }
}

function renderStreakSummary(){
  const el=document.getElementById("streakSummary");
  if(!el) return;
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

  habitList.innerHTML = `
    <div class="habitCarousel" id="habitCarousel">
      <button class="iconBtn" type="button" id="habPrev" aria-label="Previous habit">←</button>
      <div class="habitViewport" id="habViewport" aria-label="Habits carousel">
        <div class="habitTrack" id="habTrack">${cards}</div>
      </div>
      <button class="iconBtn" type="button" id="habNext" aria-label="Next habit">→</button>
    </div>
    <div class="habitDots" id="habitDots" aria-label="Habit navigation dots"></div>
  `;

  setupHabitCarousel();
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
        <div class="ring" style="--p:${pct}">
          <div class="ringInner">${pct}%</div>
        </div>
      </div>
      <div class="heroActions">
        <button class="btn primary" onclick="document.querySelector('[data-tab=\'grid\']')?.click()">Mark habits</button>
        <button class="btn secondary" onclick="setAnalyticsOffset(0)">Today</button>
      </div>
    </div>
  `;
}

function renderFocusCard(){
  const el = document.getElementById("focusHint");
  if(!el) return;
  const H = getFilteredHabits();
  if(!H.length){
    el.innerHTML = `<div class="cardHeader"><h3 class="cardTitle">Focus</h3></div><p class="small">Add a habit to see insights.</p>`;
    return;
  }
  // reuse logic from insights (weakest habit over last 14 days)
  const now=new Date(today()+"T00:00:00");
  const days=14;
  const window=[];
  for(let i=days-1;i>=0;i--){
    const d=new Date(now); d.setDate(now.getDate()-i);
    window.push(d.toISOString().slice(0,10));
  }
  let weakest=null, weakestCount=Infinity, weakestDone=0;
  for(const h of H){
    const set=new Set(h.datesDone||[]);
    const done=window.reduce((a,iso)=>a+(set.has(iso)?1:0),0);
    if(done < weakestCount){
      weakest=h; weakestCount=done; weakestDone=done;
    }
  }
  const label = weakest ? weakest.name : "—";
  el.innerHTML = `
    <div class="focusRow">
      <div class="focusIcon">🧠</div>
      <div class="focusText">
        <div class="focusTitle">Focus hint</div>
        <div class="focusBody">Weakest habit: <b>${escapeHtml(label)}</b> — ${weakestDone}/${days} days in the last 2 weeks</div>
      </div>
      <button class="btn tertiary" onclick="jumpToHabit('${weakest?weakest.id:""}')">Jump →</button>
    </div>
  `;
}

function syncSidePanels(){
  const sMain = document.getElementById("streakSummary");
  const iMain = document.getElementById("insights");
  const sSide = document.getElementById("streakSummarySide");
  const iSide = document.getElementById("insightsSide");
  if(sMain && sSide) sSide.innerHTML = sMain.innerHTML;
  if(iMain && iSide) iSide.innerHTML = iMain.innerHTML;
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
  const showAdd = ()=>{
    const card = document.getElementById("addCard");
    if(card) card.classList.toggle("open");
    const input = document.getElementById("habitName");
    input && input.focus && input.focus();
  };
  if(newBtn) newBtn.addEventListener("click", showAdd);
  if(newBtn2) newBtn2.addEventListener("click", showAdd);

  // tabs (mobile)
  const tabBtns = Array.from(document.querySelectorAll(".tabBtn"));
  const panels = Array.from(document.querySelectorAll(".tabPanel"));
  tabBtns.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      tabBtns.forEach(b=>b.classList.toggle("active", b===btn));
      const tab = btn.getAttribute("data-tab");
      panels.forEach(p=>p.classList.toggle("active", p.getAttribute("data-panel")===tab));
      // On desktop, keep all visible via CSS
    });
  });
}


wireHabitsLayout();
render();

function setAnalyticsOffset(val){
  analyticsOffsetDays = val;
  localStorage.setItem("habitsAnalyticsOffsetDays", String(analyticsOffsetDays));
  render();
}
