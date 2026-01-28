
// ===== Habits Analytics Matrix (SAFE) =====

function habitHue(id){
  let h=0;for(let i=0;i<id.length;i++)h=id.charCodeAt(i)+((h<<5)-h);
  return Math.abs(h)%360;
}

function lastDates(n=14){
  const d=new Date(),a=[];
  for(let i=n-1;i>=0;i--){
    const x=new Date(d);x.setDate(d.getDate()-i);
    a.push(x.toISOString().slice(0,10));
  }
  return a;
}

function toggleAt(hid, iso){
  const h=habits.find(x=>x.id===hid);
  if(!h)return;
  h.log=h.log||{};
  h.log[iso]=!h.log[iso];
  save();
}

function renderMatrix(){
  const c=document.getElementById("habitAnalytics")||document.getElementById("habits-analytics");
  if(!c)return;
  if(!habits||!habits.length){
    c.innerHTML="<p class='muted'>No habits yet</p>";return;
  }
  const dates=lastDates(14);
  c.innerHTML="";
  const m=document.createElement("div");
  m.className="habits-matrix";

  const hr=document.createElement("div");
  hr.className="matrix-row header";
  hr.appendChild(document.createElement("div"));
  habits.forEach(h=>{
    const el=document.createElement("div");
    el.className="matrix-col-header";
    el.style.setProperty("--habit-accent",`hsl(${habitHue(h.id)} 70% 55%)`);
    el.textContent=h.name;
    hr.appendChild(el);
  });
  m.appendChild(hr);

  dates.forEach(d=>{
    const r=document.createElement("div");
    r.className="matrix-row";
    const dl=document.createElement("div");
    dl.className="matrix-date";
    dl.textContent=d.slice(5);
    r.appendChild(dl);
    habits.forEach(h=>{
      const cell=document.createElement("div");
      cell.className="matrix-cell";
      cell.style.setProperty("--habit-accent",`hsl(${habitHue(h.id)} 70% 55%)`);
      if(h.log&&h.log[d])cell.classList.add("done");
      cell.dataset.hid=h.id;
      cell.dataset.date=d;
      r.appendChild(cell);
    });
    m.appendChild(r);
  });

  m.addEventListener("click",e=>{
    const cell=e.target.closest(".matrix-cell");
    if(!cell)return;
    toggleAt(cell.dataset.hid,cell.dataset.date);
    renderMatrix();
  });

  c.appendChild(m);
}

document.addEventListener("DOMContentLoaded",()=>{
  setTimeout(renderMatrix,0);
});
