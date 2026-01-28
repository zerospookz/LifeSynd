
const data=JSON.parse(localStorage.getItem("workoutData")||"[]");
const byDay={};
data.forEach(d=>{
 const vol=(d.sets||1)*(d.reps||1)*(d.weight||0);
 byDay[d.date]=(byDay[d.date]||0)+vol;
});
const ctx=weeklyChart.getContext("2d");
let i=0;
Object.values(byDay).forEach(v=>{
 ctx.fillStyle="#6366f1";
 ctx.fillRect(i*40,180-v/20,24,v/20);
 i++;
});
const prs={};
data.forEach(d=>prs[d.name]=Math.max(prs[d.name]||0,d.weight||0));
prList.innerHTML="";
Object.entries(prs).forEach(([k,v])=>{
 prList.innerHTML+=`<div class="card">${k}: ${v} kg</div>`;
});
