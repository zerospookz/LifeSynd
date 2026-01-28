
const workouts=JSON.parse(localStorage.getItem("workouts")||"[]");
stats.innerHTML=`Total workouts logged: ${workouts.length}`;
