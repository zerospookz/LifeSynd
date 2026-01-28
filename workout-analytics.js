
const store=(k,d)=>JSON.parse(localStorage.getItem(k)||JSON.stringify(d));
const history=store("workoutHistory",[]);

function weekKey(d){
  const date=new Date(d);
  const first=new Date(date.setDate(date.getDate()-date.getDay()));
  return first.toISOString().slice(0,10);
}

function renderWeekly(){
  const el=document.getElementById("weekly");
  if(!el) return;
  const weeks={};
  history.forEach(h=>{
    const k=weekKey(h.day);
    weeks[k]=(weeks[k]||0)+h.volume;
  });
  el.innerHTML="";
  Object.entries(weeks).forEach(([w,v])=>{
    const bar=document.createElement("div");
    bar.className="bar";
    bar.style.height=Math.min(100,v/5000*100)+"%";
    bar.title=`${w}: ${v}`;
    el.appendChild(bar);
  });
}

function renderExerciseHistory(){
  const el=document.getElementById("exerciseHistory");
  if(!el) return;
  const map={};
  history.forEach(h=>{
    map[h.name]??=[];
    map[h.name].push(h.weight);
  });
  el.innerHTML="";
  Object.entries(map).forEach(([name,arr])=>{
    const best=Math.max(...arr);
    el.innerHTML+=`<div class=card><h4>${name}</h4>PR: ${best} kg</div>`;
  });
}

document.addEventListener("DOMContentLoaded",()=>{
  renderWeekly();
  renderExerciseHistory();
});
