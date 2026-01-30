
function showToast(msg){
  const t=document.createElement("div");
  t.className="toast";
  t.textContent="✓ "+msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2000);
}
function isoToday(){
  const d=new Date();
  return d.toISOString().slice(0,10);
}


// === Focus Hint: prevent duplication ===
let __focusHintRendered = false;

function renderFocusHintOnce(container, content) {
  if (__focusHintRendered) return;
  __focusHintRendered = true;
  container.innerHTML = `
    <div class="focus-hint">
      <div class="focus-hint__title">Focus hint</div>
      <div class="focus-hint__body">${content}</div>
    </div>
  `;
}

// === Adaptive labels (3 → 2 → 1 letters) ===
function getAdaptiveLabels(labels, maxChars) {
  return labels.map(l => l.slice(0, maxChars));
}
