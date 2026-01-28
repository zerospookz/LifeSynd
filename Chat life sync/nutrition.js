
let meals=JSON.parse(localStorage.getItem("meals")||"[]");
function save(){localStorage.setItem("meals",JSON.stringify(meals));}
function addMeal(){
 if(!meal.value||!cal.value) return;
 meals.unshift({name:meal.value,cal:+cal.value});
 meal.value=""; cal.value="";
 save(); render(); showToast("Meal added");
}
function render(){
 mealList.innerHTML="";
 if(!meals.length){ mealList.innerHTML='<p class="empty">No meals logged yet.</p>'; return; }
 meals.forEach(m=>mealList.innerHTML+=`<div class="card">${m.name} – ${m.cal} kcal</div>`);
}
render();
