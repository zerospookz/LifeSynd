
let habits=JSON.parse(localStorage.getItem("habitsV2")||"[]");
function save(){localStorage.setItem("habitsV2",JSON.stringify(habits));}
function today(){return isoToday();}
function getMarkDate(){ return markDate.value ? markDate.value : today(); }

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
render();
