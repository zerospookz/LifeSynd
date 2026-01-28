
const store = (k,d)=>JSON.parse(localStorage.getItem(k)||JSON.stringify(d));
const data = store("workoutHistory", []);

function logWorkout(exercises){
  const day = new Date().toISOString().slice(0,10);
  exercises.forEach(e=>{
    data.push({
      day,
      name:e.name,
      volume:(+e.sets)*(+e.reps)*(+e.weight||0),
      weight:+e.weight||0
    });
  });
  localStorage.setItem("workoutHistory", JSON.stringify(data));
}

function renderAnalytics(){
  const list=document.getElementById("analytics");
  if(!list) return;
  const grouped={};
  data.forEach(d=>{
    grouped[d.name] ??= {best:0,total:0};
    grouped[d.name].best=Math.max(grouped[d.name].best,d.weight);
    grouped[d.name].total+=d.volume;
  });
  list.innerHTML="";
  Object.entries(grouped).forEach(([k,v])=>{
    list.innerHTML+=`<div class=card><strong>${k}</strong><br/>PR: ${v.best} kg<br/>Total Volume: ${v.total}</div>`;
  });
}
document.addEventListener("DOMContentLoaded", renderAnalytics);
