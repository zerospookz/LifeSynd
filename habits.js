
let habits=JSON.parse(localStorage.getItem("habitsV2")||"[]");
function save(){localStorage.setItem("habitsV2",JSON.stringify(habits));}


let analyticsHabitId = localStorage.getItem("habitAnalyticsSelected") || "all";
function setAnalyticsHabitId(id){
  analyticsHabitId = id || "all";
  localStorage.setItem("habitAnalyticsSelected", analyticsHabitId);
}
function habitById(id){ return habits.find(h=>h.id===id); }
function completionForDateHabit(h, iso){
  if(!h) return 0;
  const set = new Set(h.datesDone||[]);
  return set.has(iso) ? 1 : 0;
}

function toggleHabitAt(habitId, iso){
  const h = habitById(habitId);
  if(!h) return;
  h.datesDone = h.datesDone || [];
  const set = new Set(h.datesDone);
  if(set.has(iso)) set.delete(iso); else set.add(iso);
  h.datesDone = Array.from(set).sort();
  save();
}



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

// --- Templates ---
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

function toggleHabit(id){
 const date=getMarkDate();
 const h=habits.find(x=>x.id===id);
 if(!h) return;
 h.datesDone=h.datesDone||[];
 const idx=h.datesDone.indexOf(date);
 if(idx>=0){ h.datesDone.splice(idx,1); showToast("Marked as missed"); }
 else { h.datesDone.push(date); h.datesDone.sort(); showToast("Marked done"); }
 save(); render();
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
 const end=new Date(getMarkDate());
 let start=new Date(end); start.setDate(start.getDate()-(days-1));
 let total=habits.length*days;
 if(total===0) return 0;
 let done=0;
 habits.forEach(h=>{
  const set=new Set(h.datesDone||[]);
  for(let i=0;i<days;i++){
   const d=new Date(start); d.setDate(d.getDate()+i);
   const iso=d.toISOString().slice(0,10);
   if(set.has(iso)) done++;
  }
 });
 return Math.round((done/total)*100);
}

// --- Analytics: weekly heatmap + best days (overall completion across habits) ---
function weekdayLabel(i){
  return ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i] || "";
}

function normalizeToMonday(d){
  const x=new Date(d);
  // JS: 0=Sun..6=Sat. Convert so Monday is start of week.
  const day=(x.getDay()+6)%7; // Mon=0
  x.setDate(x.getDate()-day);
  return x;
}

function completionForDate(iso){
  if(habits.length===0) return 0;
  let done=0;
  habits.forEach(h=>{
    const set=new Set(h.datesDone||[]);
    if(set.has(iso)) done++;
  });
  return done/habits.length; // 0..1
}

function heatColor(p){
  // Use alpha only so it fits the theme without hard-coded colors.
  const a = Math.max(0.08, Math.min(0.95, 0.08 + p*0.85));
  return `rgba(99,102,241,${a.toFixed(3)})`;
}

// Stable per-habit hue (used by the matrix so each habit column has its own accent)
function habitHue(habitId){
  const s = String(habitId ?? "");
  let hash = 0;
  for(let i=0;i<s.length;i++){
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function renderAnalytics(){
  if(!habitAnalytics) return;

  // --- Matrix analytics: X = habit name, Y = date (no dropdown) ---
  const endIso = getMarkDate();
  const end = new Date(endIso);
  const days = 21;

  const list = habits.slice().sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));
  const dates = [];
  for(let i=0;i<days;i++){
    const d = new Date(end);
    d.setDate(d.getDate()-i);
    dates.push(d);
  }

  // Stats
  const totalCells = Math.max(1, dates.length * Math.max(1, list.length));
  let doneCells = 0;
  const dowStats = Array.from({length:7}, ()=>({sum:0,count:0}));

  const rows = dates.map(d=>{
    const iso = d.toISOString().slice(0,10);
    const dayIndex = (d.getDay()+6)%7; // Mon=0
    const cells = list.map(h=>{
      const done = completionForDateHabit(h, iso) ? 1 : 0;
      doneCells += done;
      dowStats[dayIndex].sum += done;
      dowStats[dayIndex].count += 1;
      return {hid:h.id, name:h.name, iso, done};
    });
    return {iso, d, dayIndex, cells};
  });

  const overall = list.length ? Math.round((doneCells/totalCells)*100) : 0;
  const best = dowStats
    .map((s,i)=>({i,avg: s.count ? (s.sum/s.count) : 0}))
    .sort((a,b)=>b.avg-a.avg)[0] || {i:0,avg:0};
  const bestText = list.length ? `${weekdayLabel(best.i)} (${Math.round(best.avg*100)}%)` : "Add habits to unlock";

  // Grid template: sticky date column + one column per habit
  const colDate = "120px";
  const colHabit = "96px";
  const gridCols = `${colDate} ${list.map(()=>colHabit).join(" ")}`;

  habitAnalytics.innerHTML = `
    <div class="cardHeader">
      <h3 class="cardTitle">Habit analytics</h3>
      <div class="analyticsControls">
        <span class="badge">Last ${days} days</span>
        <span class="badge">${list.length} habits</span>
      </div>
    </div>

    <div class="analyticsContext">
      <div class="small">X-axis: <strong>habits</strong> · Y-axis: <strong>dates</strong></div>
      <div class="small">Tip: click a square for details.</div>
    </div>

    <div class="analyticsTop">
      <div>
        <div class="small" style="margin-bottom:6px">Matrix consistency</div>
        <div class="matrixWrap" aria-label="Habit matrix analytics">
          <div class="matrixGrid">
            <div class="matrixHeaderRow" style="grid-template-columns:${gridCols}">
              <div class="matrixCorner">Date</div>
              ${list.map(h=>{
                const hue = habitHue(h.id);
                const accent = `hsl(${hue} 70% 55%)`;
                return `<div class="matrixHabit" title="${escapeHtml(h.name)}" style="--habit-accent:${accent}">${escapeHtml(h.name)}</div>`;
              }).join("")}
            </div>

            ${rows.map(r=>{
              const dateLabel = r.d.toLocaleDateString(undefined,{month:"short",day:"numeric"});
              const dow = weekdayLabel(r.dayIndex);
              return `
                <div class="matrixRow" style="grid-template-columns:${gridCols}">
                  <div class="matrixDate"><div class="d1">${dateLabel}</div><div class="d2">${dow}</div></div>
                  ${r.cells.map(c=>{
                    const title = `${c.iso} · ${c.name}: ${c.done?"Done":"Missed"}`;
                    const hue = habitHue(c.hid);
                    const accent = `hsl(${hue} 70% 55%)`;
                    return `<div class="matrixCell ${c.done?" data-hid="${h.id}" data-iso="${iso}"done":"missed"}" data-iso="${c.iso}" data-habit="${escapeHtml(c.name)}" data-done="${c.done}" title="${escapeHtml(title)}" style="--habit-accent:${accent}"></div>`;
                  }).join("")}
                </div>`;
            }).join("")}
          </div>
        </div>
      </div>

      <div class="analyticsSide">
        <div class="statCard">
          <div class="statLabel">Best day</div>
          <div class="statValue">${bestText}</div>
          <div class="statHint">Avg done rate by weekday</div>
        </div>
        <div class="statCard">
          <div class="statLabel">Overall</div>
          <div class="statValue">${overall}%</div>
          <div class="statHint">Across all habits × days</div>
        </div>
        <div class="statCard">
          <div class="statLabel">Legend</div>
          <div class="statHint"><span class="badge" style="border-color:rgba(255,255,255,.18);color:var(--text)">Done</span> <span class="badge">Missed</span></div>
        </div>
      </div>
    </div>
  `;

  // Click → toast details
  habitAnalytics.querySelectorAll('.matrixCell').forEach(el=>{
    el.addEventListener('click', ()=>{
      const iso = el.getAttribute('data-iso');
      const habit = el.getAttribute('data-habit');
      const done = el.getAttribute('data-done') === '1';
      showToast(`${habit} · ${iso} → ${done?"Done":"Missed"}`);
    });
  });


// Click-to-toggle directly in the matrix
if(!habitAnalytics.__matrixBound){
  habitAnalytics.__matrixBound = true;
  habitAnalytics.addEventListener("click", (e)=>{
    const cell = e.target.closest(".matrixCell");
    if(!cell) return;
    const hid = cell.getAttribute("data-hid");
    const iso = cell.getAttribute("data-iso");
    if(!hid || !iso) return;
    toggleHabitAt(hid, iso);
    render(); // re-render all (keeps other stats consistent)
  });
}

}


function renderInsights(){
 const rate7=completionRate(7);
 const rate30=completionRate(30);
 insights.innerHTML=`<h3>Consistency</h3>
 <p><span class="badge ${rate7>=70?'ok':'warn'}">Last 7 days: ${rate7}%</span></p>
 <p><span class="badge ${rate30>=70?'ok':'warn'}">Last 30 days: ${rate30}%</span></p>
 <p class="small">Tip: select yesterday above and mark it to recover streaks.</p>`;
}

function renderStreakSummary(){
 let bestCurrent=0, bestBest=0;
 habits.forEach(h=>{
  const s=streakFor(h);
  bestCurrent=Math.max(bestCurrent,s.current);
  bestBest=Math.max(bestBest,s.best);
 });
 streakSummary.innerHTML=`<h3>Streak engine</h3>
 <p><strong>Current best:</strong> ${bestCurrent} days</p>
 <p><strong>All-time best:</strong> ${bestBest} days</p>
 <p class="small">Current streak is counted up to the selected date.</p>`;
}


function miniHeatHtml(h, days=7){
  const endIso=getMarkDate();
  const end=new Date(endIso);
  const cells=[];
  for(let i=days-1;i>=0;i--){
    const d=new Date(end);
    d.setDate(d.getDate()-i);
    const iso=d.toISOString().slice(0,10);
    const p=completionForDateHabit(h, iso);
    const title=`${iso}: ${p? "Done":"Missed"}`;
    cells.push(`<div class="miniCell" title="${title}" style="background:${heatColor(p)}"></div>`);
  }
  return `<div class="miniHeat">${cells.join("")}</div>`;
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
     <div class="row" style="justify-content:space-between">
       <div>
         <strong>${h.name}</strong><div class="small">Current: ${s.current} • Best: ${s.best}</div>
       </div>
</div>
     <div style="margin-top:10px">
       ${done?'<span class="badge ok">Completed</span>':'<span class="badge warn">Due</span>'}
       <span class="badge">Date: ${date}</span>
     </div>
     ${miniHeatHtml(h)}
   </div>`;
 });
}
// Re-render when the selected mark date changes (affects streaks + analytics)
if(typeof markDate!=="undefined"){
  markDate.addEventListener("change", ()=>render());
}

render();
