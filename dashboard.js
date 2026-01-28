
const habits=JSON.parse(localStorage.getItem("habits")||"[]");
const workouts=JSON.parse(localStorage.getItem("workouts")||"[]");
const meals=JSON.parse(localStorage.getItem("meals")||"[]");
summary.innerHTML=`Habits: ${habits.length} | Workouts: ${workouts.length} | Meals: ${meals.length}`;
