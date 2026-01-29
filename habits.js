
let habits = JSON.parse(localStorage.getItem("habits_clean")||"[]");

function save(){
  localStorage.setItem("habits_clean", JSON.stringify(habits));
}

function addHabit(){
  const name = document.getElementById("habitInput").value.trim();
  if(!name) return;
  habits.push({ name, days:{} });
  document.getElementById("habitInput").value="";
  save();
  render();
}

function toggle(habitIndex, date){
  const h = habits[habitIndex];
  h.days[date] = !h.days[date];
  save();
  render();
}

function getDates(){
  const res=[];
  const d=new Date();
  for(let i=0;i<14;i++){
    const x=new Date(d);
    x.setDate(d.getDate()+i);
    res.push(x.toISOString().slice(0,10));
  }
  return res;
}

function render(){
  const root=document.getElementById("heatmap");
  root.innerHTML="";
  const dates=getDates();
  habits.forEach((h,hi)=>{
    const col=document.createElement("div");
    col.className="col";
    const t=document.createElement("div");
    t.className="col-title";
    t.textContent=h.name;
    col.appendChild(t);
    dates.forEach(d=>{
      const c=document.createElement("div");
      c.className="cell"+(h.days[d]?" done":"");
      c.onclick=()=>toggle(hi,d);
      col.appendChild(c);
    });
    root.appendChild(col);
  });
}

render();
