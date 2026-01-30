
const TPL_KEY="workoutTemplates";
const PLAN_KEY="plannedWorkouts";

function loadTemplates(){
  const t=JSON.parse(localStorage.getItem(TPL_KEY)||"{}");
  if(!t.Push && !t.Pull && !t.Legs){
    t.Push={name:"Push", exercises:["Bench Press","Overhead Press","Triceps Pushdown"]};
    t.Pull={name:"Pull", exercises:["Deadlift","Row","Lat Pulldown","Biceps Curl"]};
    t.Legs={name:"Legs", exercises:["Squat","Leg Press","Hamstring Curl","Calf Raises"]};
    localStorage.setItem(TPL_KEY,JSON.stringify(t));
  }
  return t;
}
function saveTemplates(t){ localStorage.setItem(TPL_KEY,JSON.stringify(t)); }
function loadPlan(){ return JSON.parse(localStorage.getItem(PLAN_KEY)||"{}"); }
function savePlan(p){ localStorage.setItem(PLAN_KEY,JSON.stringify(p)); }

let templates=loadTemplates();
let plan=loadPlan();

function saveTemplate(){
  if(!tplName.value) return;
  const name=tplName.value.trim();
  templates[name]={name, exercises:[]};
  saveTemplates(templates);
  tplName.value="";
  render(); showToast("Template saved");
}

function startOfWeek(d){
  const x=new Date(d);
  const day=(x.getDay()+6)%7;
  x.setDate(x.getDate()-day);
  x.setHours(0,0,0,0);
  return x;
}
function iso(d){ return d.toISOString().slice(0,10); }
function label(d){ return d.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"}); }

function setDayTemplate(dateIso, tpl){
  if(!tpl){ delete plan[dateIso]; }
  else{
    plan[dateIso]=plan[dateIso]||{template:tpl,done:false};
    plan[dateIso].template=tpl;
  }
  savePlan(plan);
  render(); showToast("Plan updated");
}
function toggleDone(dateIso){
  if(!plan[dateIso]) return;
  plan[dateIso].done=!plan[dateIso].done;
  savePlan(plan);
  render(); showToast(plan[dateIso].done ? "Marked done" : "Marked planned");
}

function renderTemplates(){
  const names=Object.keys(templates).sort();
  tplList.innerHTML = names.map(n=>{
    const ex=(templates[n].exercises||[]).slice(0,3).join(", ");
    return `<div class="card" style="margin:12px 0 0">
      <div class="row" style="justify-content:space-between">
        <strong>${n}</strong>
        <span class="badge">${(templates[n].exercises||[]).length} exercises</span>
      </div>
      <div class="small">${ex || "No exercises listed (you can extend later)."}</div>
    </div>`;
  }).join("");
}

function renderWeek(){
  const now=new Date();
  const start=startOfWeek(now);
  const names=Object.keys(templates).sort();
  weekList.innerHTML="";
  let planned=0, done=0;

  for(let i=0;i<7;i++){
    const d=new Date(start); d.setDate(d.getDate()+i);
    const dIso=iso(d);
    const entry=plan[dIso];
    if(entry) planned++;
    if(entry?.done) done++;
    const current = entry?.template || "";
    const opts = ['<option value="">—</option>']
      .concat(names.map(n=>`<option value="${n}" ${n===current?'selected':''}>${n}</option>`))
      .join("");
    const status = entry ? (entry.done ? '<span class="badge ok">Done</span>' : '<span class="badge warn">Planned</span>') : '<span class="badge">Free</span>';
    weekList.innerHTML += `
      <div class="card" style="margin:12px 0 0">
        <div class="row" style="justify-content:space-between">
          <div><strong>${label(d)}</strong> <span class="small">${dIso}</span></div>
          ${status}
        </div>
        <div class="row" style="margin-top:10px">
          <select onchange="setDayTemplate('${dIso}', this.value)">${opts}</select>
          <button onclick="toggleDone('${dIso}')" ${!entry?'disabled':''} style="${!entry?'opacity:.45;cursor:not-allowed':''}">Done</button>
        </div>
        ${entry ? `<div class="small" style="margin-top:8px">Template: <strong>${entry.template}</strong></div>` : ""}
      </div>`;
  }
  weekSummary.innerHTML=`<h3>This week</h3>
    <p><strong>${planned}</strong> planned • <strong>${done}</strong> done</p>
    <p class="small">Goal: keep planned ≈ done.</p>`;
}

window.setDayTemplate=setDayTemplate;
window.toggleDone=toggleDone;

function render(){
  templates=loadTemplates();
  plan=loadPlan();
  renderTemplates();
  renderWeek();
}
render();
