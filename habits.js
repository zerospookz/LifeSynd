
let habits=JSON.parse(localStorage.getItem("habitsV2")||"[]");
function save(){localStorage.setItem("habitsV2",JSON.stringify(habits));}
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

  const endIso=getMarkDate();
  const end=new Date(endIso);
  const endWeekStart=normalizeToMonday(end);
  const weeks=12;
  const start=new Date(endWeekStart);
  start.setDate(start.getDate()-(weeks-1)*7);

  // Gather values
  const rows=[];
  const dowStats=Array.from({length:7},()=>({sum:0,count:0}));
  let totalSum=0, totalCount=0;

  for(let w=0; w<weeks; w++){
    const rowStart=new Date(start);
    rowStart.setDate(rowStart.getDate()+w*7);
    const cells=[];
    for(let d=0; d<7; d++){
      const dd=new Date(rowStart);
      dd.setDate(dd.getDate()+d);
      const iso=dd.toISOString().slice(0,10);
      const p=completionForDate(iso);
      cells.push({iso,p});
      dowStats[d].sum += p;
      dowStats[d].count += 1;
      totalSum += p;
      totalCount += 1;
    }
    rows.push({rowStart: rowStart.toISOString().slice(0,10), cells});
  }

  const best = dowStats
    .map((s,i)=>({i,avg: s.count? (s.sum/s.count):0}))
    .sort((a,b)=>b.avg-a.avg)[0];

  const overallAvg = totalCount? (totalSum/totalCount):0;

  const bestText = habits.length
    ? `${weekdayLabel(best.i)} (${Math.round(best.avg*100)}%)`
    : "Add habits to unlock";

  habitAnalytics.innerHTML=`
    <div class="cardHeader">
      <h3 class="cardTitle">Habit analytics</h3>
      <span class="badge">Last ${weeks} weeks</span>
    </div>
    <div class="analyticsTop">
      <div>
        <div class="small" style="margin-bottom:6px">Weekly completion heatmap</div>
        <div class="heatmap">
          <div class="heatmapHeader">
            ${Array.from({length:7}).map((_,i)=>`<div class="heatLabel">${weekdayLabel(i)}</div>`).join("")}
          </div>
          <div class="heatmapBody">
            ${rows.map(r=>{
              const wk=new Date(r.rowStart);
              const label = wk.toLocaleDateString(undefined,{month:"short",day:"numeric"});
              return `
                <div class="heatRow">
                  <div class="heatWeek">${label}</div>
                  <div class="heatCells">
                    ${r.cells.map(c=>{
                      const pct=Math.round(c.p*100);
                      const title=`${c.iso}: ${pct}%`;
                      return `<div class="heatCell" title="${title}" style="background:${heatColor(c.p)}"></div>`;
                    }).join("")}
                  </div>
                </div>`;
            }).join("")}
          </div>
        </div>
      </div>
      <div class="analyticsSide">
        <div class="statCard">
          <div class="statLabel">Best day</div>
          <div class="statValue">${bestText}</div>
          <div class="statHint">Based on avg completion</div>
        </div>
        <div class="statCard">
          <div class="statLabel">Overall</div>
          <div class="statValue">${Math.round(overallAvg*100)}%</div>
          <div class="statHint">Across all habits & days</div>
        </div>
        <div class="statCard">
          <div class="statLabel">Tip</div>
          <div class="statHint">Click a square to see its date & completion.</div>
        </div>
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
   </div>`;
 });
}
// Re-render when the selected mark date changes (affects streaks + analytics)
if(typeof markDate!=="undefined"){
  markDate.addEventListener("change", ()=>render());
}

render();
