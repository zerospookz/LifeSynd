
let habits=JSON.parse(localStorage.getItem("habitsV2")||"[]");
function save(){localStorage.setItem("habitsV2",JSON.stringify(habits));}

let analyticsView = localStorage.getItem("habitsAnalyticsView") || "month";

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

function habitHue(id){
  let hash=0;
  for(let i=0;i<id.length;i++) hash=id.charCodeAt(i)+((hash<<5)-hash);
  return Math.abs(hash)%360;
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

function miniHeatHtml(h){
  const days=10;
  const now=new Date(getMarkDate()+"T00:00:00");
  const set=new Set(h.datesDone||[]);
  const cells=[];
  for(let i=days-1;i>=0;i--){
    const d=new Date(now); d.setDate(now.getDate()-i);
    const iso=d.toISOString().slice(0,10);
    const on=set.has(iso);
    const hue=habitHue(h.id);
    const accent=`hsl(${hue} 70% 55%)`;
    const p=on?0.65:0.10;
    cells.push(`<div class="miniCell" style="background: color-mix(in oklab, ${accent} ${Math.round(p*100)}%, rgba(255,255,255,.05))"></div>`);
  }
  return `<div class="miniHeat">${cells.join("")}</div>`;
}

// ---------- Analytics (Matrix) ----------


function renderAnalytics(){
  const card = document.getElementById("habitAnalytics");
  if(!card) return;

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
      <div class="matrixHint">Tip: drag to paint. Hold Shift to erase temporarily. Use ✕ to remove a habit.</div>
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

  if(!habits || habits.length===0){
    grid.innerHTML = '<p class="empty">Add a habit to see analytics.</p>';
    return;
  }

  const dates = rangeDates(range, analyticsOffsetDays);
  const colTemplate = `190px repeat(${habits.length}, 54px)`;

  // header row
  const header = document.createElement("div");
  header.className = "matrixHeaderRow";
  header.style.gridTemplateColumns = colTemplate;

  const corner = document.createElement("div");
  corner.className = "matrixCorner";
  corner.textContent = "Date";
  header.appendChild(corner);

  habits.forEach(h=>{
    const el = document.createElement("div");
    el.className = "matrixHabit";
    el.style.setProperty("--habit-accent", `hsl(${habitHue(h.id)} 70% 55%)`);
    el.title = h.name;
    el.innerHTML = `<span>${escapeHtml(h.name)}</span><button class="matrixDelete" title="Remove habit" type="button">✕</button>`;
    el.querySelector(".matrixDelete").onclick = (ev)=>{
      ev.stopPropagation();
      if(confirm("Remove habit?")){
        habits = habits.filter(x=>x.id!==h.id);
        save();
        render();
      }
    };
    header.appendChild(el);
  });

  grid.appendChild(header);

  const todayIso = today();

  // rows
  dates.forEach(iso=>{
    const row = document.createElement("div");
    row.className = "matrixRow";
    row.style.gridTemplateColumns = colTemplate;

    const dateEl = document.createElement("div");
    dateEl.className = "matrixDate";
    dateEl.innerHTML = `<div class="d1">${iso.slice(5)}</div><div class="d2">${fmtWeekday(iso)}</div>`;
    row.appendChild(dateEl);

    habits.forEach(h=>{
      const cell = document.createElement("div");
      cell.className = "matrixCell";
      cell.style.setProperty("--habit-accent", `hsl(${habitHue(h.id)} 70% 55%)`);

      const set = new Set(h.datesDone||[]);
      const done = set.has(iso);
      if(done) cell.classList.add("done");
      else if(iso < todayIso) cell.classList.add("missed");

      cell.dataset.hid = h.id;
      cell.dataset.iso = iso;
      row.appendChild(cell);
    });

    grid.appendChild(row);
  });

  // interactions: click vs drag threshold
  let dragging = false;
  let dragStarted = false;
  let dragStartX = 0;
  let dragStartY = 0;
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

    const h = habits.find(x=>x.id===hid);
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
  }

  function endDrag(){
    if(!dragging && !dragStarted) return;
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
    touched = new Set();
    dirty = false;

    targetDone = (analyticsPaintMode==="erase" ? false : !cell.classList.contains("done"));
    if(e.shiftKey) targetDone = false;

    grid.setPointerCapture?.(e.pointerId);
  });

  grid.addEventListener("pointermove", (e)=>{
    const dx = Math.abs(e.clientX - dragStartX);
    const dy = Math.abs(e.clientY - dragStartY);

    if(!dragStarted && (dx > 6 || dy > 6)){
      dragStarted = true;
      dragging = true;
      e.preventDefault();
    }
    if(!dragging) return;

    if(e.shiftKey) targetDone = false;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = el ? el.closest(".matrixCell") : null;
    applyCell(cell);
  });

  grid.addEventListener("pointerup", endDrag);
  grid.addEventListener("pointercancel", endDrag);
  grid.addEventListener("lostpointercapture", endDrag);

  grid.addEventListener("click", (e)=>{
    if(dragStarted) return;
    const cell = e.target.closest(".matrixCell");
    if(!cell) return;
    toggleHabitAt(cell.dataset.hid, cell.dataset.iso, {preserveScroll:true});
  });
}



function renderInsights(){
  const el=document.getElementById("insights");
  if(!el) return;
  const r7=completionRate(7);
  const r30=completionRate(30);
  el.innerHTML=`
    <div class="cardHeader">
      <h3 class="cardTitle">Insights</h3>
      <span class="badge">Consistency</span>
    </div>
    <div class="kpiRow">
      <div class="kpi"><div class="kpiLabel">7‑day completion</div><div class="kpiValue">${r7}%</div></div>
      <div class="kpi"><div class="kpiLabel">30‑day completion</div><div class="kpiValue">${r30}%</div></div>
    </div>
    <p class="small" style="margin-top:10px">Mark habits in the Analytics grid above.</p>
  `;
}

function renderStreakSummary(){
  const el=document.getElementById("streakSummary");
  if(!el) return;
  if(!habits.length){
    el.innerHTML='<div class="cardHeader"><h3 class="cardTitle">Streaks</h3></div><p class="empty">No habits yet.</p>';
    return;
  }
  const stats=habits.map(h=>({h, s:streakFor(h)}));
  stats.sort((a,b)=>b.s.current-a.s.current);
  const top=stats.slice(0,4);
  el.innerHTML=`
    <div class="cardHeader">
      <h3 class="cardTitle">Streaks</h3>
      <span class="badge">Top</span>
    </div>
    ${top.map(x=>`<div class="row" style="justify-content:space-between;margin:10px 0">
      <div><strong>${escapeHtml(x.h.name)}</strong><div class="small">Best ${x.s.best}</div></div>
      <div class="pill">${x.s.current} days</div>
    </div>`).join("")}
  `;
}

function render(){
  if(!markDate.value) markDate.value=today();

  renderAnalytics();
  renderInsights();
  renderStreakSummary();

  habitList.innerHTML="";
  if(habits.length===0){
    habitList.innerHTML='<p class="empty">No habits yet. Add your first habit above.</p>';
    return;
  }

  const date=getMarkDate();
  habits.forEach(h=>{
    const set=new Set(h.datesDone||[]);
    const done=set.has(date);
    const s=streakFor(h);
    habitList.innerHTML+=`
      <div class="card">
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
  });
}

// Re-render when the selected mark date changes (affects streaks + insights)
if(typeof markDate!=="undefined"){
  markDate.addEventListener("change", ()=>render());
}

render();


function deleteHabit(id){
  if(!confirm("Delete this habit?")) return;
  habits = habits.filter(h=>h.id!==id);
  save();
  render();
}
