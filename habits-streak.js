
const store=(k,d)=>JSON.parse(localStorage.getItem(k)||JSON.stringify(d));
const habits=store("habits",[]);

function calcStreak(days){
  let streak=0;
  for(let i=0;i<days.length;i++){
    if(days[i]) streak++;
    else break;
  }
  return streak;
}

function renderHabitStats(){
  const el=document.getElementById("habitStats");
  if(!el) return;
  let totalStreak=0,best=0,consistency=0,count=0;
  habits.forEach(h=>{
    const s=calcStreak(h.history||[]);
    totalStreak+=s;
    best=Math.max(best,s);
    consistency+= (h.history||[]).filter(Boolean).length;
    count+= (h.history||[]).length;
  });
  el.innerHTML=`
    <div class=card>Current streak 🔥 ${totalStreak}</div>
    <div class=card>Best streak ⭐ ${best}</div>
    <div class=card>Consistency ${(count?Math.round(consistency/count*100):0)}%</div>
  `;
}

document.addEventListener("DOMContentLoaded",renderHabitStats);
