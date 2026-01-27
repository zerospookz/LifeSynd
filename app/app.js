const TABS=[
  {key:"dashboard",label:"Dashboard"},
  {key:"finances",label:"Finances"},
  {key:"habits",label:"Habits"},
  {key:"workouts",label:"Workouts"},
  {key:"nutrition",label:"Nutrition"},
];
const STORE_KEY="lifesync_demo_v2";
const tabsEl=document.getElementById("tabs");
const viewEl=document.getElementById("view");

function id(){return Math.random().toString(16).slice(2)+Date.now().toString(16);}
function today(){return new Date().toISOString().slice(0,10);}
function yesterday(){const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);}
function money(n){return (n<0?"-":"")+"$"+Math.abs(n).toFixed(2);}

function defaultState(){
  return {
    finances:{base:2450,tx:[
      {id:id(),title:"Groceries",amount:-42.35,category:"Food",date:today()},
      {id:id(),title:"Salary",amount:3200,category:"Income",date:today()},
      {id:id(),title:"Gym",amount:-29.99,category:"Health",date:yesterday()},
    ]},
    habits:[
      {id:id(),name:"Drink water",streak:6,doneToday:false},
      {id:id(),name:"Walk 20 min",streak:3,doneToday:true},
      {id:id(),name:"Read 10 pages",streak:10,doneToday:false},
      {id:id(),name:"Stretch",streak:2,doneToday:true},
    ],
    workouts:[
      {id:id(),name:"Upper Body",duration:45,date:today()},
      {id:id(),name:"Cardio",duration:25,date:yesterday()},
      {id:id(),name:"Mobility",duration:20,date:yesterday()},
    ],
    nutrition:{
      target:{calories:2100,protein:150,carbs:220,fat:60},
      meals:[
        {id:id(),name:"Greek yogurt + berries",calories:280,protein:20,carbs:35,fat:6},
        {id:id(),name:"Chicken rice bowl",calories:620,protein:45,carbs:70,fat:12},
        {id:id(),name:"Protein shake",calories:220,protein:30,carbs:10,fat:4},
      ]
    },
    ui:{}
  };
}
function loadState(){
  try{
    const raw=localStorage.getItem(STORE_KEY);
    return raw?({...defaultState(),...JSON.parse(raw)}):defaultState();
  }catch{ return defaultState(); }
}
function saveState(s){localStorage.setItem(STORE_KEY,JSON.stringify(s));}

let state=loadState();
let active=state.ui.active || "dashboard";

function renderTabs(){
  tabsEl.innerHTML="";
  TABS.forEach(t=>{
    const b=document.createElement("button");
    b.className="tab"+(t.key===active?" active":"");
    b.textContent=t.label;
    b.onclick=()=>{active=t.key; state.ui.active=active; saveState(state); render();};
    tabsEl.appendChild(b);
  });
}
function card(inner){
  const d=document.createElement("div");
  d.className="glass";
  d.style.padding="16px";
  d.innerHTML=inner;
  return d;
}
function kpi(label,value,chip){
  return `
    <div class="kpi">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
      <div style="margin-top:10px"><span class="tag">${chip}</span></div>
    </div>
  `;
}
function sumFinances(){
  const tx=state.finances.tx;
  const income=tx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
  const expenses=tx.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
  const balance=state.finances.base + (income-expenses);
  return {income,expenses,balance,net:income-expenses};
}
function habitStats(){
  const done=state.habits.filter(h=>h.doneToday).length;
  const total=state.habits.length;
  const streakAvg=Math.round(state.habits.reduce((s,h)=>s+h.streak,0)/Math.max(1,total));
  return {done,total,streakAvg};
}
function workoutStats(){
  const week=state.workouts.slice(0,7);
  const load=state.workouts.reduce((s,w)=>s+w.duration,0);
  return {count:state.workouts.length,load};
}
function nutritionStats(){
  const meals=state.nutrition.meals;
  const calories=meals.reduce((s,m)=>s+(m.calories||0),0);
  const protein=meals.reduce((s,m)=>s+(m.protein||0),0);
  return {calories,protein};
}
function drawSpark(canvas, points){
  const c=canvas.getContext("2d");
  const w=canvas.width = canvas.clientWidth * devicePixelRatio;
  const h=canvas.height = canvas.clientHeight * devicePixelRatio;
  c.clearRect(0,0,w,h);
  // grid
  c.globalAlpha=.55;
  c.strokeStyle="rgba(255,255,255,.08)";
  c.lineWidth=1*devicePixelRatio;
  for(let i=1;i<6;i++){
    const y=(h/6)*i;
    c.beginPath(); c.moveTo(0,y); c.lineTo(w,y); c.stroke();
  }
  c.globalAlpha=1;
  // line
  const max=Math.max(...points,1);
  const min=Math.min(...points,0);
  const pad=14*devicePixelRatio;
  const sx=(w-2*pad)/(points.length-1);
  const mapY=v=>{
    const t=(v-min)/(max-min||1);
    return (h-pad) - t*(h-2*pad);
  };
  c.lineWidth=3*devicePixelRatio;
  c.strokeStyle="rgba(110,231,255,.9)";
  c.shadowColor="rgba(110,231,255,.35)";
  c.shadowBlur=14*devicePixelRatio;
  c.beginPath();
  points.forEach((p,i)=>{
    const x=pad+i*sx;
    const y=mapY(p);
    if(i===0) c.moveTo(x,y); else c.lineTo(x,y);
  });
  c.stroke();
  // fill glow
  c.shadowBlur=0;
  c.globalAlpha=.25;
  c.fillStyle="rgba(167,139,250,.6)";
  c.beginPath();
  points.forEach((p,i)=>{
    const x=pad+i*sx;
    const y=mapY(p);
    if(i===0) c.moveTo(x,y); else c.lineTo(x,y);
  });
  c.lineTo(pad+(points.length-1)*sx, h-pad);
  c.lineTo(pad, h-pad);
  c.closePath();
  c.fill();
  c.globalAlpha=1;
}

function renderDashboard(){
  const f=sumFinances();
  const h=habitStats();
  const w=workoutStats();
  const n=nutritionStats();
  const target=state.nutrition.target;

  const grid=document.createElement("div");
  grid.className="grid";

  const left=card(`
    <div class="h">Mission Control</div>
    <div class="grid">
      ${kpi("Balance", money(f.balance), f.net>=0?"+ net":"- net")}
      ${kpi("Habits today", `${h.done}/${h.total}`, `avg streak ${h.streakAvg}`)}
    </div>
    <div style="height:12px"></div>
    <div class="grid">
      ${kpi("Training load", `${w.load} min`, `${w.count} sessions`)}
      ${kpi("Calories", `${n.calories}/${target.calories}`, `protein ${n.protein}g`)}
    </div>
    <div style="height:12px"></div>
    <div class="glass2" style="padding:14px">
      <div class="small">Telemetry (7-day)</div>
      <div style="height:10px"></div>
      <canvas class="canvas" id="spark"></canvas>
    </div>
  `);

  const right=card(`
    <div class="h">Quick actions</div>
    <div class="row">
      <button class="primary" id="qaHabit">Mark all habits done</button>
      <button id="qaMeal">Add 250kcal meal</button>
      <button id="qaTx">Add -$10 expense</button>
      <button id="resetAll">Reset demo</button>
    </div>
    <div style="height:12px"></div>
    <div class="glass2" style="padding:14px">
      <div class="small">Tips</div>
      <ul style="margin:10px 0 0; padding-left:18px; color:rgba(255,255,255,.72); font-weight:800; line-height:1.65">
        <li>Click any list item to delete.</li>
        <li>Everything saves automatically.</li>
        <li>Share this URL as your live demo.</li>
      </ul>
    </div>
  `);

  grid.appendChild(left);
  grid.appendChild(right);
  viewEl.innerHTML="";
  viewEl.appendChild(grid);

  // actions
  right.querySelector("#qaHabit").onclick=()=>{
    state.habits.forEach(h=>{ if(!h.doneToday){h.doneToday=true; h.streak+=1;} });
    saveState(state); render();
  };
  right.querySelector("#qaMeal").onclick=()=>{
    state.nutrition.meals.push({id:id(),name:"Quick snack",calories:250,protein:10,carbs:25,fat:8});
    saveState(state); render();
  };
  right.querySelector("#qaTx").onclick=()=>{
    state.finances.tx.push({id:id(),title:"Quick expense",amount:-10,category:"Other",date:today()});
    saveState(state); render();
  };
  right.querySelector("#resetAll").onclick=()=>{
    if(!confirm("Reset everything to demo defaults?")) return;
    state=defaultState(); saveState(state); render();
  };

  // sparkline
  const points=[
    Math.max(0, h.done*10 + 20),
    Math.max(0, (h.done+1)*10 + 18),
    Math.max(0, (h.done+2)*10 + 14),
    Math.max(0, (h.done+1)*10 + 16),
    Math.max(0, (h.done+3)*10 + 10),
    Math.max(0, (h.done+2)*10 + 12),
    Math.max(0, h.done*10 + 22),
  ];
  const canvas=left.querySelector("#spark");
  drawSpark(canvas, points);
  window.addEventListener("resize", ()=>drawSpark(canvas, points), {once:true});
}

function renderFinances(){
  const f=sumFinances();
  viewEl.innerHTML="";
  const c=card(`
    <div class="h">Finances</div>
    <div class="grid">
      ${kpi("Balance", money(f.balance), "total")}
      ${kpi("Net", money(f.net), "this month")}
    </div>
    <div style="height:12px"></div>
    <div class="row">
      <input id="txTitle" placeholder="Transaction name" />
      <input id="txAmt" type="number" step="0.01" placeholder="Amount (use - for expense)" />
      <select id="txCat">
        <option>Food</option><option>Transport</option><option>Bills</option><option>Shopping</option><option>Health</option><option>Income</option><option>Other</option>
      </select>
      <button class="primary" id="addTx">Add</button>
      <button id="resetFin">Reset</button>
    </div>
    <ul class="list" id="txList"></ul>
  `);
  viewEl.appendChild(c);
  const list=c.querySelector("#txList");

  const tx=state.finances.tx.slice().sort((a,b)=>a.date<b.date?1:-1);
  tx.forEach(t=>{
    const li=document.createElement("li");
    li.className="item";
    li.innerHTML=`
      <div>
        <div style="font-weight:1000">${t.title} <span class="tag">${t.category}</span></div>
        <div class="small">${t.date}</div>
      </div>
      <div style="font-weight:1000">${money(t.amount)}</div>
    `;
    li.onclick=()=>{
      if(!confirm("Delete this transaction?")) return;
      state.finances.tx=state.finances.tx.filter(x=>x.id!==t.id);
      saveState(state); renderFinances();
    };
    list.appendChild(li);
  });

  c.querySelector("#addTx").onclick=()=>{
    const title=(c.querySelector("#txTitle").value||"New transaction").trim();
    const amount=parseFloat(c.querySelector("#txAmt").value);
    if(Number.isNaN(amount)) return alert("Enter an amount (e.g. -12.50 or 50)");
    const category=c.querySelector("#txCat").value;
    state.finances.tx.push({id:id(),title,amount,category,date:today()});
    saveState(state); renderFinances();
  };
  c.querySelector("#resetFin").onclick=()=>{
    if(!confirm("Reset finances to demo defaults?")) return;
    state=defaultState(); saveState(state); render();
  };
}

function renderHabits(){
  viewEl.innerHTML="";
  const c=card(`
    <div class="h">Habits</div>
    <div class="row">
      <input id="hName" placeholder="Add habit (e.g. Meditate)" />
      <button class="primary" id="addHabit">Add</button>
      <button id="resetHab">Reset</button>
    </div>
    <ul class="list" id="hList"></ul>
  `);
  viewEl.appendChild(c);
  const list=c.querySelector("#hList");

  state.habits.forEach(h=>{
    const li=document.createElement("li");
    li.className="item";
    li.innerHTML=`
      <div>
        <div style="font-weight:1000">${h.name}</div>
        <div class="small">Streak: <b>${h.streak}</b></div>
      </div>
      <div class="row">
        <span class="tag">${h.doneToday?"Done":"Not done"}</span>
        <button class="primary">${h.doneToday?"Undo":"Mark done"}</button>
      </div>
    `;
    li.querySelector("button").onclick=(e)=>{
      e.stopPropagation();
      h.doneToday=!h.doneToday;
      h.streak=Math.max(0, h.streak + (h.doneToday?1:-1));
      saveState(state); renderHabits();
    };
    li.onclick=()=>{
      if(!confirm("Delete this habit?")) return;
      state.habits=state.habits.filter(x=>x.id!==h.id);
      saveState(state); renderHabits();
    };
    list.appendChild(li);
  });

  c.querySelector("#addHabit").onclick=()=>{
    const name=c.querySelector("#hName").value.trim();
    if(!name) return;
    state.habits.push({id:id(),name,streak:0,doneToday:false});
    saveState(state); renderHabits();
  };
  c.querySelector("#resetHab").onclick=()=>{
    if(!confirm("Reset habits to demo defaults?")) return;
    state=defaultState(); saveState(state); render();
  };
}

function renderWorkouts(){
  viewEl.innerHTML="";
  const c=card(`
    <div class="h">Workouts</div>
    <div class="row">
      <input id="wName" placeholder="Session name (e.g. Legs)" />
      <input id="wDur" type="number" placeholder="Minutes" />
      <button class="primary" id="addW">Add</button>
      <button id="resetW">Reset</button>
    </div>
    <ul class="list" id="wList"></ul>
  `);
  viewEl.appendChild(c);
  const list=c.querySelector("#wList");

  state.workouts.slice().sort((a,b)=>a.date<b.date?1:-1).forEach(w=>{
    const li=document.createElement("li");
    li.className="item";
    li.innerHTML=`
      <div>
        <div style="font-weight:1000">${w.name}</div>
        <div class="small">${w.date} • ${w.duration} min</div>
      </div>
      <span class="tag">session</span>
    `;
    li.onclick=()=>{
      if(!confirm("Delete this workout?")) return;
      state.workouts=state.workouts.filter(x=>x.id!==w.id);
      saveState(state); renderWorkouts();
    };
    list.appendChild(li);
  });

  c.querySelector("#addW").onclick=()=>{
    const name=(c.querySelector("#wName").value||"Workout").trim();
    const dur=parseInt(c.querySelector("#wDur").value||"30",10);
    state.workouts.push({id:id(),name,duration:dur,date:today()});
    saveState(state); renderWorkouts();
  };
  c.querySelector("#resetW").onclick=()=>{
    if(!confirm("Reset workouts to demo defaults?")) return;
    state=defaultState(); saveState(state); render();
  };
}

function renderNutrition(){
  viewEl.innerHTML="";
  const target=state.nutrition.target;
  const meals=state.nutrition.meals;
  const calories=meals.reduce((s,m)=>s+(m.calories||0),0);
  const protein=meals.reduce((s,m)=>s+(m.protein||0),0);
  const p=Math.min(1, calories/target.calories);

  const c=card(`
    <div class="h">Nutrition</div>
    <div class="grid">
      ${kpi("Calories", `${calories}/${target.calories}`, "kcal")}
      ${kpi("Protein", `${protein}/${target.protein}`, "grams")}
    </div>
    <div style="height:12px"></div>
    <div class="glass2" style="padding:14px">
      <div class="small">Daily target</div>
      <div style="height:10px"></div>
      <div class="progress"><div style="width:${Math.round(p*100)}%"></div></div>
      <div class="small" style="margin-top:10px">${Math.round(p*100)}% complete</div>
    </div>
    <div style="height:12px"></div>
    <div class="row">
      <input id="mName" placeholder="Meal name" />
      <input id="mCal" type="number" placeholder="Calories" />
      <input id="mPro" type="number" placeholder="Protein (g)" />
      <button class="primary" id="addM">Add</button>
      <button id="resetN">Reset</button>
    </div>
    <ul class="list" id="mList"></ul>
  `);
  viewEl.appendChild(c);
  const list=c.querySelector("#mList");

  meals.forEach(m=>{
    const li=document.createElement("li");
    li.className="item";
    li.innerHTML=`
      <div>
        <div style="font-weight:1000">${m.name}</div>
        <div class="small">${m.calories} kcal • ${m.protein}g protein</div>
      </div>
      <span class="tag">meal</span>
    `;
    li.onclick=()=>{
      if(!confirm("Delete this meal?")) return;
      state.nutrition.meals=state.nutrition.meals.filter(x=>x.id!==m.id);
      saveState(state); renderNutrition();
    };
    list.appendChild(li);
  });

  c.querySelector("#addM").onclick=()=>{
    const name=(c.querySelector("#mName").value||"Meal").trim();
    const cal=parseInt(c.querySelector("#mCal").value||"0",10);
    const pro=parseInt(c.querySelector("#mPro").value||"0",10);
    state.nutrition.meals.push({id:id(),name,calories:cal,protein:pro,carbs:0,fat:0});
    saveState(state); renderNutrition();
  };
  c.querySelector("#resetN").onclick=()=>{
    if(!confirm("Reset nutrition to demo defaults?")) return;
    state=defaultState(); saveState(state); render();
  };
}

function render(){
  renderTabs();
  if(active==="dashboard") return renderDashboard();
  if(active==="finances") return renderFinances();
  if(active==="habits") return renderHabits();
  if(active==="workouts") return renderWorkouts();
  if(active==="nutrition") return renderNutrition();
}

render();
