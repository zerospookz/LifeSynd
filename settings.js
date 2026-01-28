
function exportData(){
 const payload={
  habitsV2: JSON.parse(localStorage.getItem("habitsV2")||"[]"),
  workoutData: JSON.parse(localStorage.getItem("workoutData")||"[]"),
  meals: JSON.parse(localStorage.getItem("meals")||"[]"),
  workoutTemplates: JSON.parse(localStorage.getItem("workoutTemplates")||"{}"),
  plannedWorkouts: JSON.parse(localStorage.getItem("plannedWorkouts")||"{}"),
  financeTx: JSON.parse(localStorage.getItem("financeTx")||"[]"),
 };
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
 const a=document.createElement("a");
 a.href=URL.createObjectURL(blob);
 a.download="lifesync-export.json";
 a.click();
 showToast("Exported");
}
function importData(){
 const f=importFile.files[0];
 if(!f) return;
 const r=new FileReader();
 r.onload=()=>{
  try{
   const obj=JSON.parse(r.result);
   if(obj.habitsV2) localStorage.setItem("habitsV2", JSON.stringify(obj.habitsV2));
   if(obj.workoutData) localStorage.setItem("workoutData", JSON.stringify(obj.workoutData));
   if(obj.meals) localStorage.setItem("meals", JSON.stringify(obj.meals));
   if(obj.workoutTemplates) localStorage.setItem("workoutTemplates", JSON.stringify(obj.workoutTemplates));
   if(obj.plannedWorkouts) localStorage.setItem("plannedWorkouts", JSON.stringify(obj.plannedWorkouts));
   if(obj.financeTx) localStorage.setItem("financeTx", JSON.stringify(obj.financeTx));
   showToast("Imported — refresh pages");
  }catch(e){ alert("Invalid JSON"); }
 };
 r.readAsText(f);
}
