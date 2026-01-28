
const data=JSON.parse(localStorage.getItem("workoutData")||"[]");
stats.innerHTML=`Total sets logged: ${data.length}`;
