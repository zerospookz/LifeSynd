
const profileStore=(k,d)=>JSON.parse(localStorage.getItem(k)||JSON.stringify(d));
const saveProfile=(k,v)=>localStorage.setItem(k,JSON.stringify(v));

const profile=profileStore("profile",{
  name:"",
  calorieGoal:2200,
  protein:150,
  carbs:250,
  fat:70
});

function saveUserProfile(){
  profile.name=document.getElementById("pname").value;
  profile.calorieGoal=+document.getElementById("pcal").value;
  profile.protein=+document.getElementById("pprot").value;
  profile.carbs=+document.getElementById("pcarb").value;
  profile.fat=+document.getElementById("pfat").value;
  saveProfile("profile",profile);
  alert("Profile saved");
}

document.addEventListener("DOMContentLoaded",()=>{
  pname.value=profile.name;
  pcal.value=profile.calorieGoal;
  pprot.value=profile.protein;
  pcarb.value=profile.carbs;
  pfat.value=profile.fat;
});
