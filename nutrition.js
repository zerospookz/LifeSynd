
let meals=JSON.parse(localStorage.getItem("meals")||"[]");
function save(){localStorage.setItem("meals",JSON.stringify(meals));}
function addMeal(){
 if(!mealName.value||!cal.value) return;
 meals.unshift({name:mealName.value,cal:+cal.value});
 mealName.value=""; cal.value="";
 save(); render();
}
function render(){
 mealList.innerHTML="";
 if(meals.length===0){
  mealList.innerHTML='<p class="empty">No meals logged.</p>'; return;
 }
 meals.forEach(m=>{
  mealList.innerHTML+=`<div class="card">${m.name} – ${m.cal} kcal</div>`;
 });
}
render();
