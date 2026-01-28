
let habits=JSON.parse(localStorage.getItem("habitsV2")||"[]");
function save(){localStorage.setItem("habitsV2",JSON.stringify(habits));}

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

function addTemplate(key){
  const list=HABIT_TEMPLATES[key];
  if(!list){ showToast("Template not found"); return; }
  const existing=new Set(habits.map(h=>String(h.name||"").trim().toLowerCase()));
  let added=0;
  list.forEach(name=>{
    const k=name.trim().toLowerCase();
    if(existing.has(k)) return;
    habits.push({id:crypto.randomUUID(), name, created:today(), datesDone:[]});
    existing.add(k);
    added++;
  });
  save();
  render();
  showToast(added?`Added ${added} habits`:"All template habits already exist");
}

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

  card.innerHTML = `
    <div class="cardHeader">
      <h3 class="cardTitle">Analytics</h3>
      <span class="badge">Click to mark</span>
    </div>
    <p class="small" style="margin-top:0">Tap a square to toggle done/missed for that habit & date.</p>
    <div class="matrixWrap"><div class="matrixGrid" id="matrixGrid"></div></div>
  `;

  const grid = card.querySelector("#matrixGrid");
  if(!habits || habits.length===0){
    grid.innerHTML = '<p class="empty">Add a habit to see analytics.</p>';
    return;
  }

  const dates = lastNDates(21);
  const cols = 1 + habits.length;
  const colTemplate = `160px repeat(${habits.length}, 36px)`;

  // header row
  const header = document.createElement("div");
  header.className = "matrixHeaderRow";
  header.style.gridTemplateColumns = colTemplate;

  const corner = document.createElement("div");
  corner.className = "matrixCorner";
  corner.textContent = "Date";
  header.appendChild(corner);

  habits.forEach(h=>{
    const el=document.createElement("div");
    el.className="matrixHabit";
    el.style.setProperty("--habit-accent", `hsl(${habitHue(h.id)} 70% 55%)`);
    el.title=h.name;
    el.textContent=h.name;
    header.appendChild(el);
  });

  grid.appendChild(header);

  const todayIso = today();

  // rows
  dates.forEach(iso=>{
    const row = document.createElement("div");
    row.className="matrixRow";
    row.style.gridTemplateColumns = colTemplate;

    const dateEl=document.createElement("div");
    dateEl.className="matrixDate";
    dateEl.innerHTML = `<div class="d1">${iso.slice(5)}</div><div class="d2">${fmtWeekday(iso)}</div>`;
    row.appendChild(dateEl);

    habits.forEach(h=>{
      const cell=document.createElement("div");
      cell.className="matrixCell";
      cell.style.setProperty("--habit-accent", `hsl(${habitHue(h.id)} 70% 55%)`);

      const set=new Set(h.datesDone||[]);
      const done=set.has(iso);
      if(done) cell.classList.add("done");
      else if(iso < todayIso) cell.classList.add("missed");

      cell.dataset.hid=h.id;
      cell.dataset.iso=iso;
      row.appendChild(cell);
    });

    grid.appendChild(row);
  });

  // click delegation
  grid.addEventListener("click", (e)=>{
    const cell=e.target.closest(".matrixCell");
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
