
let data=JSON.parse(localStorage.getItem("workoutData")||"[]");

function save(){localStorage.setItem("workoutData",JSON.stringify(data));}

function logSet(){
 if(!ex.value||!sets.value||!reps.value) return;
 const entry={
  ex:ex.value,
  sets:+sets.value,
  reps:+reps.value,
  weight:+weight.value||0,
  date:new Date().toLocaleDateString()
 };
 data.unshift(entry);
 save();
 render();
 showToast("Set logged");
 ex.value=sets.value=reps.value=weight.value="";
}

function render(){
 workoutList.innerHTML="";
 const prs={};
 data.forEach(d=>{
  prs[d.ex]=Math.max(prs[d.ex]||0,d.weight);
 });
 prBox.innerHTML="<h3>Personal Records</h3>"+
  Object.entries(prs).map(([k,v])=>`${k}: ${v} kg`).join("<br>");

 if(!data.length){
  workoutList.innerHTML='<p class="empty">No workouts logged.</p>';
  return;
 }

 data.forEach(d=>{
  workoutList.innerHTML+=`
   <div class="card">
    <strong>${d.ex}</strong><br>
    ${d.sets}×${d.reps} @ ${d.weight}kg<br>
    <span class="empty">${d.date}</span>
   </div>`;
 });
}
render();
