// Modern Dashboard renderer (single-pass, refreshable)

const $ = (id) => document.getElementById(id);

// --- Status colors (0–33 Low=Red, 34–66 Medium=Yellow, 67–100 Good=Green) ---
function statusColorForPercent(percent){
  const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  // iOS-like, high-contrast colors on dark UI
  const RED = [255, 59, 48];
  const YEL = [255, 214, 10];
  const GRN = [52, 199, 89];
  const rgb = (arr)=>`rgb(${arr[0]}, ${arr[1]}, ${arr[2]})`;
  const rgba = (arr,a)=>`rgba(${arr[0]}, ${arr[1]}, ${arr[2]}, ${a})`;

  let c = RED;
  if(p >= 67) c = GRN;
  else if(p >= 34) c = YEL;

  // Glow intensity scales with percent (stronger at high %)
  const baseA = 0.16 + (p/100)*0.18;      // ~0.16 → 0.34
  const strongA = Math.min(0.55, baseA + 0.18); // up to ~0.52

  return {
    pct: p,
    color: rgb(c),
    glow: rgba(c, baseA),
    glowStrong: rgba(c, strongA)
  };
}

function applyRingStatus(ringEl, percent, opts={}){
  if(!ringEl) return;
  const s = statusColorForPercent(percent);
  ringEl.style.setProperty('--ring-accent', s.color);
  ringEl.style.setProperty('--ring-glow', s.glow);
  ringEl.style.setProperty('--ring-glow-strong', s.glowStrong);
  const n = ringEl.querySelector('.ringBig');
  if(n) n.style.color = s.color;

  // Pulse only at 100%
  if(s.pct === 100) ringEl.classList.add('fullPulse');
  else ringEl.classList.remove('fullPulse');

  if(opts.isAnimating) ringEl.classList.add('isAnimating');
  else ringEl.classList.remove('isAnimating');
}

// --- Ring progress animation (1% → target%) ---
// Animates CSS var --p in true integer steps (1,2,3...) with an ease-out feel.
function animateRingProgress(ringEl, targetPct){
  if(!ringEl) return;
  const target = Math.max(0, Math.min(100, Math.round(Number(targetPct) || 0)));

  // Define easing locally (dashboard.js may be loaded standalone).
  const easeOutCubic = (t)=>1 - Math.pow(1-t, 3);
  // Soft "back" (spring-ish) easing with small overshoot, stable for rapid retargeting.
  const easeOutSoftBack = (t)=>{
    // overshoot tuned to feel premium but not bouncy
    const c1 = 1.15;
    const c3 = c1 + 1;
    return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2);
  };

  // Respect reduced motion preferences.
  try{
    if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      ringEl.style.setProperty('--p', String(target));
      ringEl.dataset.curPct = String(target);
      ringEl._animValue = target;
      const n = ringEl.querySelector('.ringBig');
      if(n) n.textContent = `${target}%`;
      applyRingStatus(ringEl, target, {isAnimating:false});
      return;
    }
  }catch(e){}

  // --- Robust animator (fix: rapid mark/unmark sometimes resulted in no animation) ---
  // Instead of cancel/restart race conditions, we retarget smoothly.
  if(!ringEl._ringAnim){
    ringEl._ringAnim = {
      raf: null,
      value: (typeof ringEl._animValue === 'number') ? ringEl._animValue : (Number(ringEl.dataset.curPct) || 0),
      start: 0,
      target: 0,
      t0: 0,
      dur: 0,
      needsRetarget: false
    };
  }

  const anim = ringEl._ringAnim;
  anim.target = target;
  anim.needsRetarget = true;

  const set = (v, isAnimating)=>{
    const clamped = Math.max(0, Math.min(100, v));
    anim.value = clamped;
    ringEl._animValue = clamped;
    ringEl.style.setProperty('--p', String(clamped));
    ringEl.dataset.curPct = String(Math.round(clamped));
    const n = ringEl.querySelector('.ringBig');
    if(n) n.textContent = `${Math.round(clamped)}%`; // realtime % update
    applyRingStatus(ringEl, Math.round(clamped), {isAnimating: !!isAnimating});
  };

  function retarget(ts){
    anim.start = Math.max(0, Math.min(100, anim.value));
    const delta = anim.target - anim.start;
    // If basically no change, snap but keep visuals coherent.
    if(Math.abs(delta) < 0.001){
      set(anim.target, false);
      anim.needsRetarget = false;
      anim.t0 = 0;
      anim.dur = 0;
      return;
    }
    // Duration scales with distance, capped.
    anim.dur = Math.max(260, Math.min(950, 320 + Math.abs(delta) * 7));
    anim.t0 = ts;
    anim.needsRetarget = false;
  }

  function frame(ts){
    if(anim.needsRetarget || !anim.t0){
      retarget(ts);
      // If retarget snapped (no delta), stop.
      if(!anim.dur){
        anim.raf = null;
        return;
      }
    }

    const t = Math.max(0, Math.min(1, (ts - anim.t0) / anim.dur));
    // Use soft-back easing for a subtle spring/bounce feel.
    const e = (t < 0.92) ? easeOutCubic(t) : easeOutSoftBack(t);
    const v = anim.start + (anim.target - anim.start) * e;
    set(v, true);

    if(t < 1){
      anim.raf = requestAnimationFrame(frame);
    }else{
      // settle exactly
      set(anim.target, false);
      anim.raf = null;
      anim.t0 = 0;
      anim.dur = 0;
      // If a new target arrived during the last frame, run again immediately.
      if(anim.needsRetarget) anim.raf = requestAnimationFrame(frame);
    }
  }

  if(!anim.raf){
    // First paint uses current value (prevents flash). Then animate to target.
    set(anim.value, false);
    anim.raf = requestAnimationFrame(frame);
  }
}


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

  // Week-over-week delta (last 7 days vs previous 7 days)
  const addDays = (iso, d)=>{
    const [y,m,dd] = iso.split("-").map(n=>parseInt(n,10));
    const dt = new Date(Date.UTC(y, m-1, dd));
    dt.setUTCDate(dt.getUTCDate() + d);
    return dt.toISOString().slice(0,10);
  };
  const daysBack = (fromIso, count, startOffset=0)=>{
    const out=[];
    for(let i=0;i<count;i++){
      out.push(addDays(fromIso, -(startOffset+i)));
    }
    return out;
  };
  const last7 = daysBack(today, 7, 0);   // today .. -6
  const prev7 = daysBack(today, 7, 7);   // -7 .. -13

  const countDoneIn = (range)=>{
    let c=0;
    for(const h of habits){
      const set = new Set(h.datesDone||[]);
      for(const d of range) if(set.has(d)) c++;
    }
    return c;
  };

  const possible = Math.max(1, habitsDue * 7);
  const doneLast = countDoneIn(last7);
  const donePrev = countDoneIn(prev7);
  const rateLast = doneLast / possible;
  const ratePrev = donePrev / possible;

  // Relative delta vs previous week (fallback to percentage-point delta when prev is 0)
  let delta = 0;
  let deltaMode = "rel";
  if(ratePrev > 0){
    delta = Math.round(((rateLast - ratePrev) / ratePrev) * 100);
  } else {
    deltaMode = "pp";
    delta = Math.round((rateLast - ratePrev) * 100);
  }
  const isUp = delta >= 0;
  const deltaAbs = Math.min(100, Math.abs(delta));
  const deltaLabel = deltaMode==="rel" ? `${isUp?"+":""}${delta}%` : `${isUp?"+":""}${delta}pp`;

  const hCard = $("dHabits");
  if(hCard){
    hCard.innerHTML = `
      <div class="cardHeader"><h3 class="cardTitle">Habits</h3><span class="badge ${habitsDue? (habitsDone===habitsDue?'ok':'warn'):'warn'}">${habitsDone}/${habitsDue}</span></div>
      <div class="metric">${habitsPct}%</div>
      <div class="small">${habitsDue? 'Completion rate today.':'Add your first habit to start streaks.'}</div>
      <div class="deltaRow">
        <div class="deltaText">${habitsDue ? 'vs last week <span class="'+(isUp?'up':'down')+'">'+deltaLabel+'</span>' : ''}</div>
        <div class="deltaBar" aria-hidden="true"><div class="deltaFill ${isUp?'':'down'}" style="width:${habitsDue?deltaAbs:0}%"></div></div>
      </div>
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

  // Today focus (what matters right now)
  const habitsDueToday = Math.max(0, habitsDue - habitsDone);

  // Workout plan status
  const planToday = plan?.[today] || null;
  const didWorkoutToday = sets.some(s => s.date === today);
  const workoutDone = (planToday && planToday.done) || didWorkoutToday;
  const workoutPlanned = !!planToday;
  const missedWorkouts = Object.keys(plan||{}).filter(k => k < today && plan[k] && !plan[k].done).length;

  const tf = $("dTodayFocus");
  if(tf){
    const budgetStatus = totalBudget>0 ? (pct < 80 ? "Safe" : "Warning") : "Not set";
    const budgetClass = totalBudget>0 ? (pct < 80 ? "ok" : "warn") : "";
    const habitLine = habitsDue ? `${habitsDueToday} due · ${habitsDone} done` : "Add your first habit";
    let workoutLine = "No workout planned";
    let workoutBadge = "badge";
    if(workoutPlanned && workoutDone){ workoutLine = `Completed · ${planToday.template || "Workout"}`; workoutBadge = "badge ok"; }
    else if(workoutPlanned && !workoutDone){ workoutLine = `Planned · ${planToday.template || "Workout"}`; workoutBadge = "badge"; }
    else if(!workoutPlanned && didWorkoutToday){ workoutLine = "Logged workout today"; workoutBadge = "badge ok"; }

    tf.innerHTML = `
      <div class="cardHeader">
        <h3 class="cardTitle">Today focus</h3>
        ${missedWorkouts ? `<span class="badge warn">${missedWorkouts} missed</span>` : `<span class="badge ok">On track</span>`}
      </div>
      <div class="grid" style="margin-top:14px">
        <div class="card soft" style="padding:14px">
          <div class="small">Habits</div>
          <div style="margin-top:6px;font-weight:800;letter-spacing:-.02em">${habitLine}</div>
          <div class="small" style="margin-top:6px">${habitsDueToday ? "Knock these out early for an easy win." : "All done — nice."}</div>
        </div>

        <div class="card soft" style="padding:14px">
          <div class="small">Budget</div>
          <div style="margin-top:6px;font-weight:800;letter-spacing:-.02em">
            <span class="badge ${budgetClass}" style="vertical-align:middle">${budgetStatus}</span>
            ${totalBudget>0 ? `<span class="small" style="margin-left:8px">${pct}% used</span>` : ``}
          </div>
          <div class="small" style="margin-top:6px">${totalBudget>0 ? `Remaining: <b>${Math.round(remaining)}</b>` : "Add budgets to enable alerts."}</div>
        </div>

        <div class="card soft" style="padding:14px">
          <div class="small">Workout</div>
          <div style="margin-top:6px;font-weight:800;letter-spacing:-.02em">${workoutLine}</div>
          <div class="small" style="margin-top:6px">${missedWorkouts ? "Review missed days in Planner." : "Keep the streak going."}</div>
        </div>
      </div>
    `;
  }


  const bCard = $("dBudget");
  if(bCard){
    if(totalBudget>0){
      const statusClass = pct < 80 ? "ok" : "warn";
      const statusLabel = pct < 80 ? "Safe" : "Warning";
      bCard.innerHTML = `
        <div class="cardHeader">
          <h3 class="cardTitle">Budget</h3>
          <span class="badge ${statusClass}">${statusLabel} · ${pct}%</span>
        </div>

        <div class="row" style="gap:16px;align-items:center;margin-top:12px">
          <div class="ringChart" data-target="${pct}" style="--p:0;--size:160px;--thickness:18px">
            <div class="ringInner">
              <div class="ringBig">0%</div>
              <div class="ringSmall">Spent <b>${Math.round(totalSpent)}</b> · Remaining <b>${Math.round(remaining)}</b></div>
            </div>
          </div>

          <div style="flex:1;min-width:180px">
            <div class="metric" style="font-size:28px">${Math.round(remaining)}</div>
            <div class="small">Remaining this month</div>

            <div class="ringLegend">
              <div class="legendItem"><span class="legendDot"></span> <span>Spent <b>${Math.round(totalSpent)}</b></span></div>
              <div class="legendItem"><span class="legendDot muted"></span> <span>Budget <b>${Math.round(totalBudget)}</b></span></div>
            </div>

            <div class="small" style="margin-top:10px">Tip: Keep usage under <b>80%</b> to avoid alerts.</div>
          </div>
        </div>
      `;

      // Animate ring in true % steps (1% → target%)
      const ring = bCard.querySelector('.ringChart');
      if(ring) animateRingProgress(ring, pct);
    }else{
      bCard.innerHTML = `
        <div class="cardHeader"><h3 class="cardTitle">Budget</h3><span class="badge">Not set</span></div>
        <div class="small">Set category budgets in Finances to unlock budget insights.</div>
        <div style="margin-top:12px"><a class="btn secondary" href="finances.html">Set budgets</a></div>
      `;
    }
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

  // Helper: rounded rect (fallback for older browsers)
  function rr(x,y,width,height,r){
    const rad = Math.min(r, width/2, height/2);
    if(ctx.roundRect){
      ctx.beginPath();
      ctx.roundRect(x,y,width,height,rad);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x+rad,y);
    ctx.arcTo(x+width,y,x+width,y+height,rad);
    ctx.arcTo(x+width,y+height,x,y+height,rad);
    ctx.arcTo(x,y+height,x,y,rad);
    ctx.arcTo(x,y,x+width,y,rad);
    ctx.closePath();
  }

  const left=18, top=60, barH=28, barW=w-36;
  const radius = 14;

  // Track
  ctx.save();
  ctx.globalAlpha=1;
  rr(left, top, barW, barH, radius);
  ctx.fillStyle="rgba(255,255,255,.10)";
  ctx.fill();
  // subtle inner stroke
  ctx.strokeStyle="rgba(255,255,255,.08)";
  ctx.lineWidth=1;
  ctx.stroke();
  ctx.restore();

  // Fill
  const used=Math.min(1, totalSpent/totalBudget);
  ctx.save();
  const fillW = Math.max(0, barW*used);
  if(fillW>0){
    rr(left, top, fillW, barH, radius);
    const g = ctx.createLinearGradient(left, top, left+barW, top);
    g.addColorStop(0, "rgba(99,102,241,.95)");
    g.addColorStop(1, "rgba(129,140,248,.80)");
    ctx.fillStyle=g;
    ctx.shadowColor="rgba(99,102,241,.35)";
    ctx.shadowBlur=18;
    ctx.fill();
    // gloss
    ctx.shadowBlur=0;
    rr(left+1, top+1, Math.max(0, fillW-2), Math.max(0, barH*0.55), radius);
    ctx.fillStyle="rgba(255,255,255,.10)";
    ctx.fill();
  }
  ctx.restore();

  // Labels
  ctx.globalAlpha=0.95;
  ctx.fillStyle="rgba(255,255,255,.92)";
  ctx.font="700 22px Inter, system-ui";
  ctx.fillText(`${Math.round(totalSpent)} / ${Math.round(totalBudget)}`, left, 40);
  ctx.globalAlpha=0.72;
  ctx.font="500 15px Inter, system-ui";
  ctx.fillText(`Spent this month`, left, 118);

  // 80% tick
  const t=0.8;
  ctx.save();
  ctx.globalAlpha=0.55;
  ctx.fillStyle="rgba(255,255,255,.20)";
  rr(left+barW*t-1, top-10, 2, barH+20, 2);
  ctx.fill();
  ctx.restore();

  // Percent
  ctx.globalAlpha=0.95;
  ctx.textAlign="right";
  ctx.font="800 20px Inter, system-ui";
  ctx.fillStyle="rgba(255,255,255,.92)";
  ctx.fillText(`${pct}%`, left+barW, 40);
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
