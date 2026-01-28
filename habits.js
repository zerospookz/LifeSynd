
let habits=JSON.parse(localStorage.getItem("habits")||"[]");
function save(){localStorage.setItem("habits",JSON.stringify(habits));}
function addHabit(){
 if(!habitName.value) return;
 habits.push({name:habitName.value,done:false});
 habitName.value=""; save(); render();
}
function toggle(i){habits[i].done=!habits[i].done; save(); render();}
function render(){
 habitList.innerHTML="";
 if(habits.length===0){
  habitList.innerHTML='<p class="empty">No habits yet.</p>'; return;
 }
 habits.forEach((h,i)=>{
  habitList.innerHTML+=`
   <div class="card">
    <input type="checkbox" ${h.done?"checked":""} onchange="toggle(${i})"> ${h.name}
   </div>`;
 });
}
render();
