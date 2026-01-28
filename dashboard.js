
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


// Remaining budget widget
const budgets=JSON.parse(localStorage.getItem("financeBudgets")||"{}"); // {category: amount}
const nowB=new Date();
const monthStartB=new Date(nowB.getFullYear(), nowB.getMonth(), 1);
const monthTx=tx.filter(t=> new Date(t.date) >= monthStartB && t.type==="expense");
const spentByCat={};
monthTx.forEach(t=>{ spentByCat[t.category]=(spentByCat[t.category]||0)+t.amount; });
const totalBudget=Object.values(budgets).reduce((s,v)=>s+Number(v||0),0);
const totalSpent=Object.values(spentByCat).reduce((s,v)=>s+v,0);
const remaining=Math.max(0, totalBudget-totalSpent);
const pct = totalBudget>0 ? Math.round((totalSpent/totalBudget)*100) : 0;

dBudget.innerHTML = totalBudget>0 ? `
  <div class="cardHeader"><h3 class="cardTitle">Budget</h3><span class="badge ${pct<80?'ok':'warn'}">${pct}% used</span></div>
  <div class="metric">${Math.round(remaining)}</div>
  <div style="margin:10px 0 6px">
    <canvas id="budgetGoalChart" width="900" height="150" style="width:100%;height:150px"></canvas>
  </div>
  <div class="small">Monthly goal progress (spent vs budget).</div>
` : `
  <div class="cardHeader"><h3 class="cardTitle">Budget</h3><span class="badge">Not set</span></div>
  <div class="metric">—</div>
  <div class="small">Set category budgets in Finances.</div>
`;

function drawBudgetGoalChart(){
  const canvas=document.getElementById("budgetGoalChart");
  if(!canvas || totalBudget<=0) return;
  const ctx=canvas.getContext("2d");
  const w=canvas.width, h=canvas.height;
  ctx.clearRect(0,0,w,h);

  // background track
  const left=18, top=50, barH=26, barW=w-36;
  ctx.globalAlpha=0.25;
  ctx.fillStyle="#ffffff";
  ctx.fillRect(left, top, barW, barH);

  // progress fill
  const used=Math.min(1, totalSpent/totalBudget);
  ctx.globalAlpha=0.55;
  ctx.fillRect(left, top, barW*used, barH);

  // labels
  ctx.globalAlpha=0.9;
  ctx.font="24px Inter, system-ui";
  const label=`${Math.round(totalSpent)} / ${Math.round(totalBudget)}`;
  ctx.fillText(label, left, 34);
  ctx.globalAlpha=0.7;
  ctx.font="16px Inter, system-ui";
  ctx.fillText(`Spent this month`, left, 96);

  // tick for 80% warning
  const t=0.8;
  ctx.globalAlpha=0.35;
  ctx.fillRect(left+barW*t, top-10, 2, barH+20);

  // percent on right
  ctx.globalAlpha=0.9;
  ctx.textAlign="right";
  ctx.font="20px Inter, system-ui";
  ctx.fillText(`${pct}%`, left+barW, 34);
  ctx.textAlign="left";
  ctx.globalAlpha=1;
}
drawBudgetGoalChart();

// Dashboard transaction modal
function openTxModal(){
  const m=document.getElementById("txModal");
  if(!m) return;
  m.classList.add("show");
  m.setAttribute("aria-hidden","false");
  const dateInput=document.getElementById("mTxDate");
  if(dateInput && !dateInput.value) dateInput.value=isoToday();
}
function closeTxModal(){
  const m=document.getElementById("txModal");
  if(!m) return;
  m.classList.remove("show");
  m.setAttribute("aria-hidden","true");
}
function addTxFromDashboard(){
  const type=document.getElementById("mTxType").value;
  const amount=Number(document.getElementById("mTxAmount").value);
  const category=(document.getElementById("mTxCategory").value||"Other").trim();
  const note=(document.getElementById("mTxNote").value||"").trim();
  const date=document.getElementById("mTxDate").value || isoToday();
  if(!amount || amount<=0) return;

  const tx=JSON.parse(localStorage.getItem("financeTx")||"[]");
  tx.unshift({id:crypto.randomUUID(), type, amount, category, note, date});
  localStorage.setItem("financeTx", JSON.stringify(tx));
  showToast("Transaction added");
  closeTxModal();
  // reset inputs
  document.getElementById("mTxAmount").value="";
  document.getElementById("mTxCategory").value="";
  document.getElementById("mTxNote").value="";
  // refresh dashboard numbers without reload
  location.reload();
}
// Close modal on backdrop click + ESC
document.addEventListener("keydown",(e)=>{
  if(e.key==="Escape") closeTxModal();
});
document.addEventListener("click",(e)=>{
  const m=document.getElementById("txModal");
  if(!m) return;
  if(m.classList.contains("show") && e.target===m) closeTxModal();
});

// Budget alert (80%+)
try{
  const budgetAlertKey = "budgetAlertShown-" + (new Date().getFullYear()) + "-" + String(new Date().getMonth()+1).padStart(2,"0");
  if(totalBudget>0){
    const usedPct = (totalSpent/totalBudget)*100;
    const already = localStorage.getItem(budgetAlertKey)==="1";
    if(usedPct>=80 && !already){
      showToast("Budget warning: 80%+ used");
      localStorage.setItem(budgetAlertKey,"1");
    }
  }
}catch(e){}
