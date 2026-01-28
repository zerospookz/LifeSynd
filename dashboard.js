
const today=isoToday();

const habits=JSON.parse(localStorage.getItem("habitsV2")||"[]");
const habitsDue=habits.length;
const habitsDone=habits.filter(h=>h.datesDone?.includes(today)).length;

dHabits.innerHTML=`
  <div class="cardHeader"><h3 class="cardTitle">Habits today</h3><span class="badge ${habitsDue? (habitsDone===habitsDue?'ok':'warn'):'warn'}">${habitsDone}/${habitsDue}</span></div>
  <div class="metric">${habitsDue? Math.round((habitsDone/Math.max(1,habitsDue))*100):0}%</div>
  <div class="small">${habitsDue? 'Completion rate for today.':'Add your first habit to start streaks.'}</div>
`;

const sets=JSON.parse(localStorage.getItem("workoutData")||"[]");
dWorkouts.innerHTML=`
  <div class="cardHeader"><h3 class="cardTitle">Workout sets</h3><span class="badge">${sets.length}</span></div>
  <div class="metric">${sets.length}</div>
  <div class="small">Total sets logged.</div>
`;

const meals=JSON.parse(localStorage.getItem("meals")||"[]");
const kcal = meals.reduce((s,m)=>s+m.cal,0);
dCalories.innerHTML=`
  <div class="cardHeader"><h3 class="cardTitle">Calories</h3><span class="badge">${kcal} kcal</span></div>
  <div class="metric">${kcal}</div>
  <div class="small">Logged today.</div>
`;

const plan=JSON.parse(localStorage.getItem("plannedWorkouts")||"{}");
const todayPlan=plan[today];
dPlanner.innerHTML = todayPlan ? `
  <div class="cardHeader"><h3 class="cardTitle">Today’s workout</h3>${todayPlan.done?'<span class="badge ok">Done</span>':'<span class="badge warn">Planned</span>'}</div>
  <div class="metric">${todayPlan.template}</div>
  <div class="small">Open Planner to adjust.</div>
` : `
  <div class="cardHeader"><h3 class="cardTitle">Today’s workout</h3><span class="badge">—</span></div>
  <div class="metric">None</div>
  <div class="small">Pick Push / Pull / Legs in Planner.</div>
`;

function streakForDates(dates){
  if(!dates || dates.length===0) return {current:0,best:0};
  const set=new Set(dates);
  let best=0, cur=0;
  const now=new Date();
  for(let i=365;i>=0;i--){
    const d=new Date(now); d.setDate(d.getDate()-i);
    const iso=d.toISOString().slice(0,10);
    if(set.has(iso)){ cur++; best=Math.max(best,cur);} else cur=0;
  }
  let current=0;
  let d=new Date();
  while(true){
    const iso=d.toISOString().slice(0,10);
    if(set.has(iso)){ current++; d.setDate(d.getDate()-1);} else break;
  }
  return {current,best};
}
let bestCurrent=0, bestBest=0;
habits.forEach(h=>{
  const s=streakForDates(h.datesDone||[]);
  bestCurrent=Math.max(bestCurrent,s.current);
  bestBest=Math.max(bestBest,s.best);
});
dStreak.innerHTML=`
  <div class="cardHeader"><h3 class="cardTitle">Streaks</h3><span class="badge ok">${bestCurrent} current</span></div>
  <div class="metric">${bestBest}</div>
  <div class="small">All-time best streak (days).</div>
`;

// Embedded analytics cards
const prs={};
sets.forEach(d=>{ prs[d.ex]=Math.max(prs[d.ex]||0,d.weight||0); });
aWorkouts.innerHTML=`
  <div class="cardHeader"><h3 class="cardTitle">Workouts</h3><span class="badge">${Object.keys(prs).length} PRs</span></div>
  <div class="metric">${sets.length}</div>
  <div class="small">Sets logged total.</div>
`;

const keys=Object.keys(plan);
const planned=keys.length;
const done=keys.filter(k=>plan[k].done).length;
aPlanner.innerHTML=`
  <div class="cardHeader"><h3 class="cardTitle">Planner</h3><span class="badge ${planned && done===planned?'ok':'warn'}">${done}/${planned}</span></div>
  <div class="metric">${planned}</div>
  <div class="small">Days planned this cycle.</div>
`;

aHabits.innerHTML=`
  <div class="cardHeader"><h3 class="cardTitle">Habits</h3><span class="badge">${habitsDone}/${habitsDue}</span></div>
  <div class="metric">${habitsDone}</div>
  <div class="small">Completed today.</div>
`;

const tx=JSON.parse(localStorage.getItem("financeTx")||"[]");
const weekStart=new Date(); weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));
weekStart.setHours(0,0,0,0);
const inWeek=tx.filter(t=> new Date(t.date) >= weekStart);
const income=inWeek.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
const expense=inWeek.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
aFinances.innerHTML=`
  <div class="cardHeader"><h3 class="cardTitle">Finances</h3><span class="badge danger">${Math.round(expense)} spent</span></div>
  <div class="metric">${Math.round(income-expense)}</div>
  <div class="small">Net this week (income − spend).</div>
`;
