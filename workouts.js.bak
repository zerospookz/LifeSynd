
let data=JSON.parse(localStorage.getItem("workoutData")||"[]");
function save(){localStorage.setItem("workoutData",JSON.stringify(data));}
function logSet(){
 if(!ex.value||!sets.value||!reps.value) return;
 const entry={
  ex:ex.value, sets:+sets.value, reps:+reps.value,
  weight:+weight.value||0,
  date:new Date().toISOString().slice(0,10)
 };
 data.unshift(entry);
 save(); render(); showToast("Set logged");
 ex.value=sets.value=reps.value=weight.value="";
}
function render(){
 workoutList.innerHTML="";
 const prs={};
 data.forEach(d=>{ prs[d.ex]=Math.max(prs[d.ex]||0,d.weight||0); });
 const prLines=Object.entries(prs).sort((a,b)=>b[1]-a[1]).slice(0,10)
   .map(([k,v])=>`<div class="row" style="justify-content:space-between"><span>${k}</span><strong>${v} kg</strong></div>`).join("");
 prBox.innerHTML=`<h3>Personal Records</h3>${prLines || '<p class="empty">No PRs yet.</p>'}`;

 if(!data.length){ workoutList.innerHTML='<p class="empty">No sets logged yet.</p>'; return; }
 data.forEach(d=>{
  workoutList.innerHTML+=`
   <div class="card">
    <strong>${d.ex}</strong><br>
    ${d.sets}×${d.reps} @ ${d.weight}kg<br>
    <span class="small">${d.date}</span>
   </div>`;
 });
}
render();
