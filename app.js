
const store={get:(k,d)=>JSON.parse(localStorage.getItem(k)||JSON.stringify(d)),set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
const workouts=store.get("workouts",{templates:{},plans:{},history:{}});
function addExerciseRow(c){const r=document.createElement("div");r.className="exercise-row";r.innerHTML=`<input placeholder="Exercise"/><input type=number placeholder=Sets><input type=number placeholder=Reps><input type=number placeholder=Weight><input type=number placeholder="Rest (s)"><button onclick="this.parentElement.remove()">✕</button>`;c.appendChild(r)}
function saveTemplate(){const n=document.getElementById("templateName").value;if(!n)return alert("Name required");const rows=[...document.querySelectorAll(".exercise-row")].map(r=>({name:r.children[0].value,sets:r.children[1].value,reps:r.children[2].value,weight:r.children[3].value,rest:r.children[4].value}));workouts.templates[n]=rows;store.set("workouts",workouts);renderTemplates()}
function renderTemplates(){const l=document.getElementById("templates");if(!l)return;l.innerHTML="";Object.keys(workouts.templates).forEach(t=>{const b=document.createElement("button");b.textContent=t;b.onclick=()=>loadTemplate(t);l.appendChild(b)})}
function loadTemplate(n){const c=document.getElementById("exerciseList");c.innerHTML="";workouts.templates[n].forEach(()=>addExerciseRow(c))}
let tI,s=0;function startTimer(){clearInterval(tI);tI=setInterval(()=>{s++;document.getElementById("timer").textContent=new Date(s*1000).toISOString().substr(11,8)},1000)}function stopTimer(){clearInterval(tI)}
function renderWeek(){const e=document.getElementById("week");if(!e)return;e.innerHTML="";const td=new Date();for(let i=0;i<7;i++){const d=new Date(td);d.setDate(td.getDate()-td.getDay()+i);const k=d.toISOString().slice(0,10);e.innerHTML+=`<div class="day ${workouts.history[k]?'done':''}">${d.toDateString().slice(0,3)}</div>`}}
document.addEventListener("DOMContentLoaded",()=>{renderTemplates();renderWeek()});
