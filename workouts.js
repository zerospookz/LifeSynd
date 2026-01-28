
let workouts=JSON.parse(localStorage.getItem("workouts")||"[]");
function save(){localStorage.setItem("workouts",JSON.stringify(workouts));}
function addWorkout(){
 workouts.unshift({name:wName.value,date:new Date().toLocaleDateString()});
 wName.value=""; save(); render();
}
function render(){
 workoutList.innerHTML="";
 workouts.forEach(w=>workoutList.innerHTML+=`<div class="card">${w.name} – ${w.date}</div>`);
}
render();
