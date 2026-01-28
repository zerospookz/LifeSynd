
const habits=JSON.parse(localStorage.getItem("habits")||"[]");
const workouts=JSON.parse(localStorage.getItem("workouts")||"[]");
const meals=JSON.parse(localStorage.getItem("meals")||"[]");

habitStat.innerHTML=`<h3>Habits</h3><p>${habits.filter(h=>h.done).length}/${habits.length} completed</p>`;
workoutStat.innerHTML=`<h3>Workouts</h3><p>${workouts.length} logged</p>`;
calStat.innerHTML=`<h3>Calories</h3><p>${meals.reduce((s,m)=>s+m.cal,0)} kcal today</p>`;
