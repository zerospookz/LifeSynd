(function(){
  "use strict";
  const Workouts = window.Workouts;
  if (!Workouts) return;

  const $ = (s, r=document) => r.querySelector(s);

  const params = new URLSearchParams(location.search);
  const date = params.get("date"); // ISO YYYY-MM-DD

  const dateLabel = $("#pwDateLabel");
  const tplSel = $("#pwTemplate");
  const backBtn = $("#pwBack");
  const cancelBtn = $("#pwCancel");
  const saveBtn = $("#pwSave");

  function pretty(iso){
    try{
      const [y,m,d] = iso.split("-").map(Number);
      const dt = new Date(y, m-1, d);
      return dt.toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric", year:"numeric" });
    }catch(e){ return iso; }
  }

  function goBack(){
    // Return to month view
    location.href = "workouts.html";
  }

  if (dateLabel) dateLabel.textContent = date ? pretty(date) : "—";
  if (backBtn) backBtn.addEventListener("click", goBack);
  if (cancelBtn) cancelBtn.addEventListener("click", goBack);

  function loadTemplates(){
    const tpls = Workouts.listTemplates() || [];
    tplSel.innerHTML = "";
    if (!tpls.length){
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No templates yet";
      tplSel.appendChild(opt);
      tplSel.disabled = true;
      saveBtn.disabled = true;
      return;
    }
    for (const t of tpls){
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      tplSel.appendChild(opt);
    }
  }

  function save(){
    const templateId = tplSel.value;
    if (!templateId || !date) return;
    Workouts.createWorkoutFromTemplate(templateId, date);
    goBack();
  }

  if (saveBtn) saveBtn.addEventListener("click", save);

  loadTemplates();
})();