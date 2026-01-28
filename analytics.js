
const data=JSON.parse(localStorage.getItem("workoutData")||"[]");
const byWeek={};
data.forEach(d=>{
 const vol=d.sets*d.reps*d.weight;
 byWeek[d.date]=(byWeek[d.date]||0)+vol;
});

const c=weeklyChart.getContext("2d");
let i=0;
Object.values(byWeek).forEach(v=>{
 c.fillStyle="#6366f1";
 c.fillRect(i*40,180-v/20,24,v/20);
 i++;
});

const prs={};
data.forEach(d=>{
 prs[d.name]=Math.max(prs[d.name]||0,d.weight);
});

prList.innerHTML="";
Object.entries(prs).forEach(([k,v])=>{
 prList.innerHTML+=`<div class=card>${k}: ${v} kg</div>`;
});
