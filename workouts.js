
let workouts=JSON.parse(localStorage.getItem("workouts")||"[]");
function save(){localStorage.setItem("workouts",JSON.stringify(workouts));}
function addWorkout(){
 if(!workoutName.value) return;
 workouts.unshift({name:workoutName.value,date:new Date().toLocaleDateString()});
 workoutName.value="";
 save(); render();
}
function render(){
 workoutList.innerHTML="";
 if(!workouts.length){
  workoutList.innerHTML='<p class="empty">No workouts yet.</p>';return;
 }
 workouts.forEach(w=>{
  workoutList.innerHTML+=`<div class="card"><strong>${w.name}</strong><div class="empty">${w.date}</div></div>`;
 });
}
render();
