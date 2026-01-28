import { isPage } from "../core/utils.js";

if(isPage("dashboard")){
  const h=new Date().getHours();
  const title=document.getElementById("dashMode");
  const hint=document.getElementById("dashHint");

  if(h<12){
    title.textContent="Good Morning ☀️";
    hint.textContent="Focus on habits and your workout.";
  }else{
    title.textContent="Good Evening 🌙";
    hint.textContent="Review progress and close the day strong.";
  }
}
