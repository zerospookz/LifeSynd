
const habits=JSON.parse(localStorage.getItem("habits")||"[]");
const workouts=JSON.parse(localStorage.getItem("workoutData")||"[]");
const meals=JSON.parse(localStorage.getItem("meals")||"[]");

dHabits.innerHTML=`<h3>Habits</h3>${habits.filter(h=>h.done).length}/${habits.length} done`;
dWorkouts.innerHTML=`<h3>Workouts</h3>${workouts.length} sets logged`;
dCalories.innerHTML=`<h3>Calories</h3>${meals.reduce((s,m)=>s+m.cal,0)} kcal`;
