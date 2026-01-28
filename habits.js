
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


function renderAnalytics(){
  if(!habitAnalytics) return;

  const endIso = getMarkDate();
  const end = new Date(endIso);

  // Last N days (matrix)
  const days = 28; // 4 weeks gives a readable matrix
  const start = new Date(end);
  start.setDate(start.getDate()-(days-1));

  // Build date list (newest first for y-axis)
  const dates=[];
  for(let i=0;i<days;i++){
    const d=new Date(end);
    d.setDate(d.getDate()-i);
    dates.push(d);
  }

  const cols = habits.length;

  // Stats
  const dow = Array.from({length:7},()=>({sum:0,count:0}));
  const habitStats = habits.map(h=>({id:h.id,name:h.name, done:0, total:0}));
  let allDone=0, allTotal=0;

  const rows = dates.map((d)=>{
    const iso=d.toISOString().slice(0,10);
    const label=d.toLocaleDateString(undefined,{month:"short",day:"numeric"});
    const weekday=d.toLocaleDateString(undefined,{weekday:"short"});
    const cells = habits.map((h,hi)=>{
      const done = completionForDateHabit(h, iso) ? 1 : 0;
      const s = habitStats[hi];
      s.total += 1;
      s.done += done;
      allTotal += 1;
      allDone += done;

      const di = (new Date(iso)).getDay(); // 0 Sun .. 6 Sat
      const monBased = (di+6)%7; // 0 Mon .. 6 Sun
      dow[monBased].sum += done;
      dow[monBased].count += 1;

      return {iso, done, hi};
    });
    return {iso,label,weekday,cells};
  });

  const bestDow = dow
    .map((s,i)=>({i,avg: s.count? (s.sum/s.count):0}))
    .sort((a,b)=>b.avg-a.avg)[0] || {i:0,avg:0};

  const bestHabit = habitStats
    .map(s=>({ ...s, rate: s.total? (s.done/s.total):0 }))
    .sort((a,b)=>b.rate-a.rate)[0];

  const overall = allTotal? (allDone/allTotal):0;

  habitAnalytics.innerHTML=`
    <div class="cardHeader">
      <h3 class="cardTitle">Habit analytics</h3>
      <div class="analyticsControls">
        <span class="badge">Last ${days} days</span>
        <span class="badge primary"><span class="dot"></span>Matrix view</span>
      </div>
    </div>

    <div class="analyticsContext">
      <div class="small">X-axis: habits • Y-axis: date</div>
      <div class="small">Tip: hover any square for details.</div>
    </div>

    <div class="matrixWrap">
      <div class="matrixScroll" role="region" aria-label="Habit completion matrix">
        <div class="matrix" style="--cols:${cols}">
          <div class="mCorner">Date</div>
          ${habits.map((h,hi)=>{
            const hue = (hi*37)%360;
            return `<div class="mH" style="--hue:${hue}" title="${escapeHtml(h.name)}">${escapeHtml(h.name)}</div>`;
          }).join("")}

          ${rows.map(r=>{
            return `
              <div class="mDate" title="${r.iso}">${r.weekday} ${r.label}</div>
              ${r.cells.map(c=>{
                const hue=(c.hi*37)%360;
                const title = `${r.iso} • ${habits[c.hi]?.name || ""}: ${c.done? "Done":"Not done"}`;
                return `<div class="mCell ${c.done?"done":"off"}" style="--hue:${hue}" title="${escapeHtml(title)}"></div>`;
              }).join("")}
            `;
          }).join("")}
        </div>
      </div>

      <div class="matrixLegend">
        <div class="legendItem"><span class="legendSwatch off"></span><span class="small">Not done</span></div>
        <div class="legendItem"><span class="legendSwatch done"></span><span class="small">Done</span></div>
      </div>
    </div>

    <div class="analyticsStats">
      <div class="statCard accent primary">
        <div class="statLabel">Overall</div>
        <div class="statValue">${Math.round(overall*100)}%</div>
        <div class="statHint">Across all habits</div>
      </div>
      <div class="statCard accent success">
        <div class="statLabel">Best day</div>
        <div class="statValue">${weekdayLabel(bestDow.i)} <span class="muted">(${Math.round(bestDow.avg*100)}%)</span></div>
        <div class="statHint">Avg completion</div>
      </div>
      <div class="statCard accent violet">
        <div class="statLabel">Strongest habit</div>
        <div class="statValue">${bestHabit? escapeHtml(bestHabit.name):"—"}</div>
        <div class="statHint">${bestHabit? Math.round(bestHabit.rate*100)+"% in window":"Add habits to unlock"}</div>
      </div>
    </div>
  `;
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
       <button onclick="toggleHabit('${h.id}')">${done?'Unmark':'Done'}</button>
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
