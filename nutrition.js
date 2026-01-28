
const goals={cal:2200,protein:150,carbs:250,fat:70};
const store=(k,d)=>JSON.parse(localStorage.getItem(k)||JSON.stringify(d));
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));

let data=store("nutrition",{days:{},templates:{
  "Breakfast":{protein:25,carbs:40,fat:15},
  "Lunch":{protein:40,carbs:60,fat:20},
  "Dinner":{protein:45,carbs:50,fat:20}
}});

const today=new Date().toISOString().slice(0,10);
data.days[today]??={meals:[]};

function addMeal(tpl){
  const m=tpl||{
    name:mealName.value,
    protein:+protein.value,
    carbs:+carbs.value,
    fat:+fat.value
  };
  data.days[today].meals.push(m);
  save("nutrition",data);
  render();
}

function render(){
  const sum={protein:0,carbs:0,fat:0};
  data.days[today].meals.forEach(m=>{
    sum.protein+=m.protein;
    sum.carbs+=m.carbs;
    sum.fat+=m.fat;
  });
  const cal=sum.protein*4+sum.carbs*4+sum.fat*9;
  caloriesLeft.textContent=`Calories left: ${goals.cal-cal}`;

  document.querySelectorAll(".ring").forEach(r=>{
    const k=r.dataset.macro;
    r.querySelector("span").textContent=`${goals[k]-sum[k]}g left`;
  });

  const t=document.getElementById("templates");
  t.innerHTML="";
  Object.entries(data.templates).forEach(([n,v])=>{
    const b=document.createElement("button");
    b.textContent=n;
    b.onclick=()=>addMeal({name:n,...v});
    t.appendChild(b);
  });

  const trend=document.getElementById("trend");
  trend.innerHTML="";
  for(let i=6;i>=0;i--){
    const d=new Date(); d.setDate(d.getDate()-i);
    const k=d.toISOString().slice(0,10);
    const meals=data.days[k]?.meals||[];
    const c=meals.reduce((s,m)=>s+(m.protein*4+m.carbs*4+m.fat*9),0);
    const bar=document.createElement("div");
    bar.style.height=Math.min(100,c/goals.cal*100)+"%";
    bar.title=`${k}: ${c} cal`;
    trend.appendChild(bar);
  }
}
render();
