
import { State } from "../core/state.js";
import { page } from "../core/utils.js";

if (page("finances")) {
  const data = State.get("finances", { budget: 3000, tx: [] });

  function draw() {
    const canvas = document.getElementById("spendChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = "#6366f1";
    data.tx.slice(-7).forEach((t,i)=>{
      ctx.fillRect(i*40+10, canvas.height - t.amount/10, 24, t.amount/10);
    });
  }

  window.addTransaction = () => {
    data.tx.push({
      name: tName.value,
      amount: +tAmount.value,
      cat: tCat.value,
      date: new Date().toISOString()
    });
    State.set("finances", data);
    requestAnimationFrame(draw);
  };

  draw();
}
