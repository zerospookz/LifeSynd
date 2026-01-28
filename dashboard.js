
const today=isoToday();

// Habits (streak model)
const habits=JSON.parse(localStorage.getItem("habitsV2")||"[]");
const habitsDue=habits.length;
const habitsDone=habits.filter(h=>h.datesDone?.includes(today)).length;
dHabits.innerHTML=`<h3>Habits today</h3><p>${habitsDone}/${habitsDue} done</p>`;

// Workouts
const sets=JSON.parse(localStorage.getItem("workoutData")||"[]");
dWorkouts.innerHTML=`<h3>Workout sets</h3><p>${sets.length} total sets logged</p>`;

// Nutrition
const meals=JSON.parse(localStorage.getItem("meals")||"[]");
dCalories.innerHTML=`<h3>Calories</h3><p>${meals.reduce((s,m)=>s+m.cal,0)} kcal today</p>`;

// Planner
const plan=JSON.parse(localStorage.getItem("plannedWorkouts")||"{}");
const todayPlan=plan[today];
if(todayPlan){
  const status=todayPlan.done ? '<span class="badge ok">Done</span>' : '<span class="badge warn">Planned</span>';
  dPlanner.innerHTML=`<h3>Today’s workout</h3><p><strong>${todayPlan.template}</strong> ${status}</p>`;
} else {
  dPlanner.innerHTML=`<h3>Today’s workout</h3><p class="empty">Nothing planned.</p>`;
}

// streak helpers
function streakForDates(dates){
  if(!dates || dates.length===0) return {current:0,best:0};
  const set=new Set(dates);
  // best
  let best=0, cur=0;
  const now=new Date();
  for(let i=365;i>=0;i--){
    const d=new Date(now); d.setDate(d.getDate()-i);
    const iso=d.toISOString().slice(0,10);
    if(set.has(iso)){ cur++; best=Math.max(best,cur);} else cur=0;
  }
  // current ending today
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
dStreak.innerHTML=`<h3>Streaks</h3><p><strong>Current best:</strong> ${bestCurrent} days</p><p><strong>All-time best:</strong> ${bestBest} days</p>`;

// Embedded analytics cards (used to be analytics page)
const prs={};
sets.forEach(d=>{ prs[d.ex]=Math.max(prs[d.ex]||0,d.weight||0); });
aWorkouts.innerHTML=`<h3>Workouts</h3><p><strong>${sets.length}</strong> sets logged</p><p><strong>${Object.keys(prs).length}</strong> PR categories</p>`;

const keys=Object.keys(plan);
const planned=keys.length;
const done=keys.filter(k=>plan[k].done).length;
aPlanner.innerHTML=`<h3>Planner</h3><p><strong>${planned}</strong> planned days</p><p><strong>${done}</strong> done days</p>`;

aHabits.innerHTML=`<h3>Habits</h3><p>${habitsDone}/${habitsDue} done today</p><p class="small">Streaks live in Habits.</p>`;

// Finance mini summary
const tx=JSON.parse(localStorage.getItem("financeTx")||"[]");
const weekStart=new Date(); weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));
weekStart.setHours(0,0,0,0);
const inWeek=tx.filter(t=> new Date(t.date) >= weekStart);
const income=inWeek.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
const expense=inWeek.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
aFinances.innerHTML=`<h3>Finances</h3><p><strong>${Math.round(expense)}</strong> spent this week</p><p><strong>${Math.round(income)}</strong> income this week</p>`;
