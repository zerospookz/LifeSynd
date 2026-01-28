
let data=JSON.parse(localStorage.getItem("workoutData")||"[]");

function save(){localStorage.setItem("workoutData",JSON.stringify(data));}

function addWorkout(){
 if(!wName.value) return;
 const entry={
  name:wName.value,
  sets:+sets.value||1,
  reps:+reps.value||1,
  weight:+weight.value||0,
  date:new Date().toISOString().slice(0,10)
 };
 data.push(entry);
 save(); render();
 wName.value=sets.value=reps.value=weight.value="";
}

function render(){
 workoutList.innerHTML="";
 if(!data.length){workoutList.innerHTML='<p class=empty>No workouts logged.</p>';return;}
 data.slice().reverse().forEach(w=>{
  workoutList.innerHTML+=`
   <div class="card">
    <strong>${w.name}</strong><br>
    ${w.sets}×${w.reps} @ ${w.weight}kg<br>
    <span class=empty>${w.date}</span>
   </div>`;
 });
}
render();
