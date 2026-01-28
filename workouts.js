
let workouts=JSON.parse(localStorage.getItem("workouts")||"[]");
function save(){localStorage.setItem("workouts",JSON.stringify(workouts));}
function addWorkout(){workouts.push({name:workoutName.value,date:new Date().toISOString()});workoutName.value="";save();render();}
function render(){workoutList.innerHTML="";workouts.forEach(w=>workoutList.innerHTML+=`<div>${w.name}</div>`);}
render();
