
let meals=JSON.parse(localStorage.getItem("meals")||"[]");
function save(){localStorage.setItem("meals",JSON.stringify(meals));}
function addMeal(){meals.push({name:mealName.value,cal:+cal.value});mealName.value="";cal.value="";save();render();}
function render(){mealList.innerHTML="";meals.forEach(m=>mealList.innerHTML+=`<div>${m.name} - ${m.cal} kcal</div>`);}
render();
