
const store=(k,d)=>JSON.parse(localStorage.getItem(k)||JSON.stringify(d));
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));

const data=store("finances",{budget:3000,tx:[]});

function addTransaction(){
  data.tx.push({
    name:tName.value,
    amount:+tAmount.value,
    cat:tCat.value,
    date:new Date().toISOString()
  });
  save("finances",data);
  render();
}

function render(){
  drawSpend();
  drawCategory();
  const spent=data.tx.reduce((s,t)=>s+t.amount,0);
  budgetHealth.textContent=`${Math.round((spent/data.budget)*100)}% used`;
}

function drawSpend(){
  const c=document.getElementById("spendChart");
  const ctx=c.getContext("2d");
  ctx.clearRect(0,0,c.width,c.height);
  ctx.fillStyle="#6366f1";
  data.tx.slice(-7).forEach((t,i)=>{
    ctx.fillRect(i*40+10,c.height-t.amount/10,24,t.amount/10);
  });
}

function drawCategory(){
  const c=document.getElementById("categoryChart");
  const ctx=c.getContext("2d");
  ctx.clearRect(0,0,c.width,c.height);
  const cats={};
  data.tx.forEach(t=>cats[t.cat]=(cats[t.cat]||0)+t.amount);
  let x=10;
  Object.values(cats).forEach(v=>{
    ctx.fillStyle=`hsl(${Math.random()*360},70%,60%)`;
    ctx.fillRect(x,c.height-v/10,40,v/10);
    x+=50;
  });
}

render();
