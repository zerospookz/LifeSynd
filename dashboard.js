// Modern Dashboard renderer (single-pass, refreshable)

const $ = (id) => document.getElementById(id);

function formatPrettyDate(iso){
  try{
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  }catch(e){
    return iso;
  }
}

function getGreeting(){
  const h = new Date().getHours();
  if(h < 12) return "Good morning";
  if(h < 18) return "Good afternoon";
  return "Good evening";
}

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

function render(){
  const today = isoToday();

  // Header
  const gEl = $("dashGreeting");
  const dEl = $("dashDate");
  if(gEl) gEl.textContent = getGreeting();
  if(dEl) dEl.textContent = formatPrettyDate(today);

  // Data pulls (single read per storage key)
  const habits = JSON.parse(localStorage.getItem("habitsV2")||"[]");
  const sets = JSON.parse(localStorage.getItem("workoutData")||"[]");
  const meals = JSON.parse(localStorage.getItem("meals")||"[]");
  const plan = JSON.parse(localStorage.getItem("plannedWorkouts")||"{}");
  const tx = JSON.parse(localStorage.getItem("financeTx")||"[]");
  const budgets = JSON.parse(localStorage.getItem("financeBudgets")||"{}");

  // Habits KPI
  const habitsDue = habits.length;
  const habitsDone = habits.filter(h=>h.datesDone?.includes(today)).length;
  const habitsPct = habitsDue ? Math.round((habitsDone/Math.max(1,habitsDue))*100) : 0;
  const hCard = $("dHabits");
  if(hCard){
    hCard.innerHTML = `
      <div class="cardHeader"><h3 class="cardTitle">Habits</h3><span class="badge ${habitsDue? (habitsDone===habitsDue?'ok':'warn'):'warn'}">${habitsDone}/${habitsDue}</span></div>
      <div class="metric">${habitsPct}%</div>
      <div class="small">${habitsDue? 'Completion rate today.':'Add your first habit to start streaks.'}</div>
    `;
  }

  // Workouts KPI
  const wCard = $("dWorkouts");
  if(wCard){
    wCard.innerHTML = `
      <div class="cardHeader"><h3 class="cardTitle">Sets</h3><span class="badge">${sets.length}</span></div>
      <div class="metric">${sets.length}</div>
      <div class="small">Total sets logged.</div>
    `;
  }

  // Calories KPI
  const kcal = meals.reduce((s,m)=>s+(Number(m.cal)||0),0);
  const cCard = $("dCalories");
  if(cCard){
    cCard.innerHTML = `
      <div class="cardHeader"><h3 class="cardTitle">Calories</h3><span class="badge">${kcal} kcal</span></div>
      <div class="metric">${kcal}</div>
      <div class="small">Logged today.</div>
    `;
  }

  // Planner
  const todayPlan = plan[today];
  const pCard = $("dPlanner");
  if(pCard){
    pCard.innerHTML = todayPlan ? `
      <div class="cardHeader"><h3 class="cardTitle">Today’s workout</h3>${todayPlan.done?'<span class="badge ok">Done</span>':'<span class="badge warn">Planned</span>'}</div>
      <div class="metric">${todayPlan.template}</div>
      <div class="small">Open Planner to adjust.</div>
    ` : `
      <div class="cardHeader"><h3 class="cardTitle">Today’s workout</h3><span class="badge">—</span></div>
      <div class="metric">None</div>
      <div class="small">Pick Push / Pull / Legs in Planner.</div>
    `;
  }

  // Streaks
  let bestCurrent=0, bestBest=0;
  habits.forEach(h=>{
    const s=streakForDates(h.datesDone||[]);
    bestCurrent=Math.max(bestCurrent,s.current);
    bestBest=Math.max(bestBest,s.best);
  });
  const sCard = $("dStreak");
  if(sCard){
    sCard.innerHTML = `
      <div class="cardHeader"><h3 class="cardTitle">Streaks</h3><span class="badge ok">${bestCurrent} current</span></div>
      <div class="metric">${bestBest}</div>
      <div class="small">All-time best streak (days).</div>
    `;
  }

  // Analytics (embedded)
  const aWorkouts = $("aWorkouts");
  const aPlanner = $("aPlanner");
  const aHabits = $("aHabits");
  const aFinances = $("aFinances");

  const prs={};
  sets.forEach(d=>{ prs[d.ex]=Math.max(prs[d.ex]||0, Number(d.weight)||0); });
  if(aWorkouts){
    aWorkouts.innerHTML = `
      <div class="cardHeader"><h3 class="cardTitle">Workouts</h3><span class="badge">${Object.keys(prs).length} PRs</span></div>
      <div class="metric">${sets.length}</div>
      <div class="small">Sets logged total.</div>
    `;
  }

  const keys=Object.keys(plan);
  const planned=keys.length;
  const done=keys.filter(k=>plan[k].done).length;
  if(aPlanner){
    aPlanner.innerHTML = `
      <div class="cardHeader"><h3 class="cardTitle">Planner</h3><span class="badge ${planned && done===planned?'ok':'warn'}">${done}/${planned}</span></div>
      <div class="metric">${planned}</div>
      <div class="small">Days planned this cycle.</div>
    `;
  }

  if(aHabits){
    aHabits.innerHTML = `
      <div class="cardHeader"><h3 class="cardTitle">Habits</h3><span class="badge">${habitsDone}/${habitsDue}</span></div>
      <div class="metric">${habitsDone}</div>
      <div class="small">Completed today.</div>
    `;
  }

  const weekStart=new Date(); weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));
  weekStart.setHours(0,0,0,0);
  const inWeek=tx.filter(t=> new Date(t.date) >= weekStart);
  const income=inWeek.filter(t=>t.type==="income").reduce((s,t)=>s+Number(t.amount||0),0);
  const expense=inWeek.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.amount||0),0);
  if(aFinances){
    aFinances.innerHTML = `
      <div class="cardHeader"><h3 class="cardTitle">Finances</h3><span class="badge danger">${Math.round(expense)} spent</span></div>
      <div class="metric">${Math.round(income-expense)}</div>
      <div class="small">Net this week (income − spend).</div>
    `;
  }

  // Budget (month)
  const nowB=new Date();
  const monthStartB=new Date(nowB.getFullYear(), nowB.getMonth(), 1);
  const monthTx=tx.filter(t=> new Date(t.date) >= monthStartB && t.type==="expense");
  const spentByCat={};
  monthTx.forEach(t=>{ spentByCat[t.category]=(spentByCat[t.category]||0)+Number(t.amount||0); });
  const totalBudget=Object.values(budgets).reduce((s,v)=>s+Number(v||0),0);
  const totalSpent=Object.values(spentByCat).reduce((s,v)=>s+Number(v||0),0);
  const remaining=Math.max(0, totalBudget-totalSpent);
  const pct = totalBudget>0 ? Math.round((totalSpent/totalBudget)*100) : 0;

  const bCard = $("dBudget");
  if(bCard){
    bCard.innerHTML = totalBudget>0 ? `
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
  }

  // Recent transactions preview
  const rCard = $("dRecentTx");
  if(rCard){
    const last = tx.slice(0,5);
    const rows = last.map(t=>{
      const sign = t.type === "expense" ? "-" : "+";
      const val = `${sign}${Math.round(Number(t.amount||0))}`;
      const meta = `${t.category || "Other"} · ${t.date || ""}${t.note? " · " + t.note : ""}`;
      return `
        <div class="miniRow">
          <div class="miniLeft">
            <div class="miniTitle">${t.type === "expense" ? "Expense" : "Income"}</div>
            <div class="miniMeta">${meta}</div>
          </div>
          <div class="miniVal">${val}</div>
        </div>
      `;
    }).join("");
    rCard.innerHTML = `
      <div class="cardHeader"><h3 class="cardTitle">Recent transactions</h3><a class="badge" href="finances.html" style="text-decoration:none">View all</a></div>
      ${last.length ? `<div class="miniList">${rows}</div>` : `<div class="small">No transactions yet. Add one to start tracking.</div>`}
    `;
  }

  // Hero pills
  const hh = $("heroHabits");
  const hc = $("heroCalories");
  const hb = $("heroBudget");
  if(hh) hh.textContent = `${habitsDone}/${habitsDue}`;
  if(hc) hc.textContent = `${kcal} kcal`;
  if(hb) hb.textContent = totalBudget>0 ? `${pct}% used` : "Not set";

  drawBudgetGoalChart({ totalBudget, totalSpent, pct });

  // Budget alert (80%+) - once per month
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
}

function drawBudgetGoalChart({ totalBudget, totalSpent, pct }){
  const canvas = document.getElementById("budgetGoalChart");
  if(!canvas || !totalBudget || totalBudget<=0) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);

  const left=18, top=56, barH=26, barW=w-36;

  // Track
  ctx.globalAlpha=0.22;
  ctx.fillStyle="#ffffff";
  ctx.fillRect(left, top, barW, barH);

  // Fill
  const used=Math.min(1, totalSpent/totalBudget);
  ctx.globalAlpha=0.58;
  ctx.fillRect(left, top, barW*used, barH);

  // Labels
  ctx.globalAlpha=0.92;
  ctx.font="24px Inter, system-ui";
  ctx.fillText(`${Math.round(totalSpent)} / ${Math.round(totalBudget)}`, left, 38);
  ctx.globalAlpha=0.7;
  ctx.font="16px Inter, system-ui";
  ctx.fillText(`Spent this month`, left, 108);

  // 80% tick
  const t=0.8;
  ctx.globalAlpha=0.32;
  ctx.fillRect(left+barW*t, top-10, 2, barH+20);

  // Percent
  ctx.globalAlpha=0.92;
  ctx.textAlign="right";
  ctx.font="20px Inter, system-ui";
  ctx.fillText(`${pct}%`, left+barW, 38);
  ctx.textAlign="left";
  ctx.globalAlpha=1;
}

// Dashboard transaction modal
function openTxModal(){
  const m=$("txModal");
  if(!m) return;
  m.classList.add("show");
  m.setAttribute("aria-hidden","false");
  const dateInput=$("mTxDate");
  if(dateInput && !dateInput.value) dateInput.value=isoToday();
}
function closeTxModal(){
  const m=$("txModal");
  if(!m) return;
  m.classList.remove("show");
  m.setAttribute("aria-hidden","true");
}
function addTxFromDashboard(){
  const type=$("mTxType").value;
  const amount=Number($("mTxAmount").value);
  const category=($("mTxCategory").value||"Other").trim();
  const note=($("mTxNote").value||"").trim();
  const date=$("mTxDate").value || isoToday();
  if(!amount || amount<=0) return;

  const tx=JSON.parse(localStorage.getItem("financeTx")||"[]");
  tx.unshift({id:crypto.randomUUID(), type, amount, category, note, date});
  localStorage.setItem("financeTx", JSON.stringify(tx));
  showToast("Transaction added");
  closeTxModal();

  // reset inputs
  $("mTxAmount").value="";
  $("mTxCategory").value="";
  $("mTxNote").value="";

  // refresh numbers without a full page reload
  render();
}

// Close modal on backdrop click + ESC
document.addEventListener("keydown",(e)=>{ if(e.key==="Escape") closeTxModal(); });
document.addEventListener("click",(e)=>{
  const m=$("txModal");
  if(!m) return;
  if(m.classList.contains("show") && e.target===m) closeTxModal();
});

render();
