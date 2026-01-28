
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
 const end=new Date(getMarkDate());
 let start=new Date(end); start.setDate(start.getDate()-(days-1));
 let total=habits.length*days;
 if(total===0) return 0;
 let done=0;
  habits.forEach(h=>{
    const set=new Set(h.datesDone||[]);
    const done=set.has(date);
    const s=streakFor(h);
    const hue = habitHue(h.id);
    const accent = `hsl(${hue} 70% 55%)`;
    habitList.innerHTML+=`
     <div class="card">
       <div class="row" style="justify-content:space-between;align-items:flex-start">
         <div class="habitTitleRow">
           <span class="habitDot" style="--habit-accent:${accent}"></span>
           <div>
             <strong>${h.name}</strong>
             <div class="small">Current: ${s.current} • Best: ${s.best}</div>
           </div>
         </div>
         <div class="habitStatusPills">
           ${done?'<span class="badge ok">Done</span>':'<span class="badge warn">Missed</span>'}
           <span class="badge">Focus: ${date}</span>
         </div>
       </div>
       <div class="small" style="margin-top:10px;color:var(--muted)">
         Mark directly in the matrix above (click a square).
       </div>
       ${miniHeatHtml(h)}
     </div>`;
   });
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
