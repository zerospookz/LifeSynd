
import { State } from "../core/state.js";
import { page } from "../core/utils.js";

if (page("workouts")) {
  const data = State.get("workouts", { templates: {}, history: [] });
  let timer = null, seconds = 0;

  window.startTimer = () => {
    clearInterval(timer);
    timer = setInterval(()=>{
      seconds++;
      timerEl.textContent = new Date(seconds*1000).toISOString().substr(11,8);
    },1000);
  };

  window.stopTimer = () => clearInterval(timer);

  window.addEventListener("beforeunload", ()=> clearInterval(timer));
}
