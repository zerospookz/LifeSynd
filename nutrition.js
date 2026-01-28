
let meals=JSON.parse(localStorage.getItem("meals")||"[]");
function save(){localStorage.setItem("meals",JSON.stringify(meals));}
function addMeal(){
 meals.unshift({name:meal.value,cal:+cal.value});
 meal.value=""; cal.value="";
 save(); render();
}
function render(){
 mealList.innerHTML="";
 meals.forEach(m=>mealList.innerHTML+=`<div class="card">${m.name} – ${m.cal} kcal</div>`);
}
render();
