const TABS=[
  {key:"dashboard",label:"Dashboard"},
  {key:"finances",label:"Finances"},
  {key:"habits",label:"Habits"},
  {key:"workouts",label:"Workouts"},
  {key:"nutrition",label:"Nutrition"},
];
const STORE_KEY="lifesync_demo_v1";

const tabsEl=document.getElementById("tabs");
const viewEl=document.getElementById("view");

function id(){return Math.random().toString(16).slice(2)+Date.now().toString(16);}
function today(){return new Date().toISOString().slice(0,10);}
function yesterday(){const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);}
function money(n){return (n<0?"-":"")+"$"+Math.abs(n).toFixed(2);}

function defaultState(){
  return {
    finances:{balance:2450,income:3200,expenses:1420,tx:[
      {id:id(),title:"Groceries",amount:-42.35,category:"Food",date:today()},
      {id:id(),title:"Salary",amount:3200,category:"Income",date:today()},
    ]},
    habits:[
      {id:id(),name:"Drink water",streak:6,doneToday:false},
      {id:id(),name:"Walk 20 min",streak:3,doneToday:true},
      {id:id(),name:"Read 10 pages",streak:10,doneToday:false},
    ],
    workouts:[
      {id:id(),name:"Upper Body",duration:45,date:today()},
      {id:id(),name:"Cardio",duration:25,date:yesterday()},
    ],
    nutrition:{
      target:{calories:2100,protein:150,carbs:220,fat:60},
      today:{calories:1480,protein:110,carbs:160,fat:40},
      meals:[
        {id:id(),name:"Greek yogurt + berries",calories:280,protein:20,carbs:35,fat:6},
        {id:id(),name:"Chicken rice bowl",calories:620,protein:45,carbs:70,fat:12},
      ]
    }
  };
}
function loadState(){
  try{const raw=localStorage.getItem(STORE_KEY);return raw?({...defaultState(),...JSON.parse(raw)}):defaultState();}
  catch{return defaultState();}
}
function saveState(s){localStorage.setItem(STORE_KEY,JSON.stringify(s));}

let state=loadState();
let active="dashboard";

function renderTabs(){
  tabsEl.innerHTML="";
  TABS.forEach(t=>{
    const b=document.createElement("button");
    b.className="tab"+(t.key===active?" active":"");
    b.textContent=t.label;
    b.onclick=()=>{active=t.key;render();};
    tabsEl.appendChild(b);
  });
}

function wrapCard(inner){
  const d=document.createElement("div");
  d.className="card pad";
  d.innerHTML=inner;
  return d;
}

function render(){
  renderTabs();
  if(active==="dashboard") return renderDashboard();
  if(active==="finances") return renderFinances();
  if(active==="habits") return renderHabits();
  if(active==="workouts") return renderWorkouts();
  if(active==="nutrition") return renderNutrition();
}

function renderDashboard(){
  const f=state.finances;
  const habitDone=state.habits.filter(h=>h.doneToday).length;
  const habitTotal=state.habits.length;
  const workoutCount=state.workouts.length;
  const n=state.nutrition;

  const grid=document.createElement("div"); grid.className="grid";
  const c1=wrapCard(`
    <div class="h">Today</div>
    <div class="kpi"><div><div class="muted">Habits</div><div class="v">${habitDone}/${habitTotal}</div></div><span class="tag">streaks</span></div>
    <div style="height:10px"></div>
    <div class="kpi"><div><div class="muted">Nutrition</div><div class="v">${n.today.calories}/${n.target.calories}</div></div><span class="tag">kcal</span></div>
  `);
  const c2=wrapCard(`
    <div class="h">Finances</div>
    <div class="kpi"><div><div class="muted">Balance</div><div class="v">${money(f.balance)}</div></div><span class="tag">month</span></div>
    <div style="height:10px"></div>
    <div class="kpi"><div><div class="muted">Workouts logged</div><div class="v">${workoutCount}</div></div><span class="tag">sessions</span></div>
  `);
  grid.appendChild(c1); grid.appendChild(c2);
  viewEl.innerHTML=""; viewEl.appendChild(grid);
}

function renderFinances(){
  viewEl.innerHTML="";
  const f=state.finances;

  const card=wrapCard(`
    <div class="h">Finances</div>
    <div class="grid">
      <div class="kpi"><div><div class="muted">Balance</div><div class="v">${money(f.balance)}</div></div><span class="tag">total</span></div>
      <div class="kpi"><div><div class="muted">This month</div><div class="v">${money(f.income-f.expenses)}</div></div><span class="tag">net</span></div>
    </div>
    <div style="height:12px"></div>
    <div class="row">
      <input id="txTitle" placeholder="Transaction name" />
      <input id="txAmt" type="number" step="0.01" placeholder="Amount (use - for expense)" />
      <select id="txCat">
        <option>Food</option><option>Transport</option><option>Bills</option><option>Shopping</option><option>Income</option><option>Other</option>
      </select>
      <button class="primary" id="addTx">Add</button>
      <button id="resetFin">Reset</button>
    </div>
    <ul class="list" id="txList"></ul>
  `);
  viewEl.appendChild(card);

  const txList=card.querySelector("#txList");

  function recompute(){
    const income=f.tx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
    const expenses=f.tx.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
    f.income=income; f.expenses=expenses;
    f.balance=2450+(income-expenses);
  }

  function draw(){
    recompute();
    saveState(state);
    // update view by re-rendering the card quickly
    render();
  }

  function drawList(){
    txList.innerHTML="";
    f.tx.slice().sort((a,b)=>a.date<b.date?1:-1).forEach(tx=>{
      const li=document.createElement("li");
      li.className="item";
      li.innerHTML=`
        <div>
          <div style="font-weight:950">${tx.title} <span class="tag">${tx.category}</span></div>
          <div class="muted">${tx.date}</div>
        </div>
        <div style="font-weight:1000">${money(tx.amount)}</div>
      `;
      li.onclick=()=>{
        if(!confirm("Delete this transaction?")) return;
        f.tx=f.tx.filter(t=>t.id!==tx.id);
        saveState(state);
        renderFinances();
      };
      txList.appendChild(li);
    });
  }

  card.querySelector("#addTx").onclick=()=>{
    const title=(card.querySelector("#txTitle").value||"New transaction").trim();
    const amount=parseFloat(card.querySelector("#txAmt").value);
    if(Number.isNaN(amount)) return alert("Enter an amount (e.g. -12.50 or 50)");
    const category=card.querySelector("#txCat").value;
    f.tx.push({id:id(),title,amount,category,date:today()});
    saveState(state);
    renderFinances();
  };
  card.querySelector("#resetFin").onclick=()=>{
    if(!confirm("Reset finances to demo defaults?")) return;
    state=defaultState(); saveState(state); render();
  };

  drawList();
}

function renderHabits(){
  viewEl.innerHTML="";
  const card=wrapCard(`
    <div class="h">Habits</div>
    <div class="row">
      <input id="hName" placeholder="Add habit (e.g. Meditate)" />
      <button class="primary" id="addHabit">Add</button>
      <button id="resetHab">Reset</button>
    </div>
    <ul class="list" id="hList"></ul>
  `);
  viewEl.appendChild(card);
  const list=card.querySelector("#hList");

  function draw(){
    list.innerHTML="";
    state.habits.forEach(h=>{
      const li=document.createElement("li");
      li.className="item";
      li.innerHTML=`
        <div>
          <div style="font-weight:950">${h.name}</div>
          <div class="muted">Streak: <b>${h.streak}</b></div>
        </div>
        <div class="row">
          <span class="tag">${h.doneToday?"Done":"Not done"}</span>
          <button class="primary">${h.doneToday?"Undo":"Mark done"}</button>
        </div>
      `;
      li.querySelector("button").onclick=(e)=>{
        e.stopPropagation();
        h.doneToday=!h.doneToday;
        h.streak=Math.max(0,h.streak+(h.doneToday?1:-1));
        saveState(state);
        draw();
      };
      li.onclick=()=>{
        if(!confirm("Delete this habit?")) return;
        state.habits=state.habits.filter(x=>x.id!==h.id);
        saveState(state); draw();
      };
      list.appendChild(li);
    });
  }
  card.querySelector("#addHabit").onclick=()=>{
    const name=card.querySelector("#hName").value.trim();
    if(!name) return;
    state.habits.push({id:id(),name,streak:0,doneToday:false});
    saveState(state);
    card.querySelector("#hName").value="";
    draw();
  };
  card.querySelector("#resetHab").onclick=()=>{
    if(!confirm("Reset habits to demo defaults?")) return;
    state=defaultState(); saveState(state); render();
  };
  draw();
}

function renderWorkouts(){
  viewEl.innerHTML="";
  const card=wrapCard(`
    <div class="h">Workouts</div>
    <div class="row">
      <input id="wName" placeholder="Session name (e.g. Legs)" />
      <input id="wDur" type="number" placeholder="Minutes" />
      <button class="primary" id="addW">Add</button>
      <button id="resetW">Reset</button>
    </div>
    <ul class="list" id="wList"></ul>
  `);
  viewEl.appendChild(card);
  const list=card.querySelector("#wList");

  function draw(){
    list.innerHTML="";
    state.workouts.slice().sort((a,b)=>a.date<b.date?1:-1).forEach(w=>{
      const li=document.createElement("li");
      li.className="item";
      li.innerHTML=`
        <div>
          <div style="font-weight:950">${w.name}</div>
          <div class="muted">${w.date} • ${w.duration} min</div>
        </div>
        <span class="tag">session</span>
      `;
      li.onclick=()=>{
        if(!confirm("Delete this workout?")) return;
        state.workouts=state.workouts.filter(x=>x.id!==w.id);
        saveState(state); draw();
      };
      list.appendChild(li);
    });
  }
  card.querySelector("#addW").onclick=()=>{
    const name=(card.querySelector("#wName").value||"Workout").trim();
    const dur=parseInt(card.querySelector("#wDur").value||"30",10);
    state.workouts.push({id:id(),name,duration:dur,date:today()});
    saveState(state);
    card.querySelector("#wName").value=""; card.querySelector("#wDur").value="";
    draw();
  };
  card.querySelector("#resetW").onclick=()=>{
    if(!confirm("Reset workouts to demo defaults?")) return;
    state=defaultState(); saveState(state); render();
  };
  draw();
}

function renderNutrition(){
  viewEl.innerHTML="";
  const n=state.nutrition;
  const card=wrapCard(`
    <div class="h">Nutrition</div>
    <div class="grid">
      <div class="kpi"><div><div class="muted">Calories</div><div class="v">${n.today.calories}/${n.target.calories}</div></div><span class="tag">kcal</span></div>
      <div class="kpi"><div><div class="muted">Protein</div><div class="v">${n.today.protein}/${n.target.protein}</div></div><span class="tag">g</span></div>
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
  viewEl.appendChild(card);
  const list=card.querySelector("#mList");

  function recalc(){
    n.today.calories=n.meals.reduce((s,m)=>s+(m.calories||0),0);
    n.today.protein=n.meals.reduce((s,m)=>s+(m.protein||0),0);
  }
  function draw(){
    recalc(); saveState(state);
    list.innerHTML="";
    n.meals.forEach(m=>{
      const li=document.createElement("li");
      li.className="item";
      li.innerHTML=`
        <div>
          <div style="font-weight:950">${m.name}</div>
          <div class="muted">${m.calories} kcal • ${m.protein}g protein</div>
        </div>
        <span class="tag">meal</span>
      `;
      li.onclick=()=>{
        if(!confirm("Delete this meal?")) return;
        n.meals=n.meals.filter(x=>x.id!==m.id);
        draw();
      };
      list.appendChild(li);
    });
    // refresh KPI by re-rendering entire tab
    render();
  }
  card.querySelector("#addM").onclick=()=>{
    const name=(card.querySelector("#mName").value||"Meal").trim();
    const calories=parseInt(card.querySelector("#mCal").value||"0",10);
    const protein=parseInt(card.querySelector("#mPro").value||"0",10);
    n.meals.push({id:id(),name,calories,protein,carbs:0,fat:0});
    card.querySelector("#mName").value=""; card.querySelector("#mCal").value=""; card.querySelector("#mPro").value="";
    draw();
  };
  card.querySelector("#resetN").onclick=()=>{
    if(!confirm("Reset nutrition to demo defaults?")) return;
    state=defaultState(); saveState(state); render();
  };
  // initial list
  list.innerHTML="";
  n.meals.forEach(m=>{
    const li=document.createElement("li");
    li.className="item";
    li.innerHTML=`
      <div>
        <div style="font-weight:950">${m.name}</div>
        <div class="muted">${m.calories} kcal • ${m.protein}g protein</div>
      </div>
      <span class="tag">meal</span>
    `;
    li.onclick=()=>{
      if(!confirm("Delete this meal?")) return;
      n.meals=n.meals.filter(x=>x.id!==m.id);
      saveState(state); renderNutrition();
    };
    list.appendChild(li);
  });
}

render();
