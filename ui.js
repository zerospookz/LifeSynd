
function showToast(msg){
 const t=document.createElement("div");
 t.className="toast";
 t.textContent="✓ "+msg;
 document.body.appendChild(t);
 setTimeout(()=>t.remove(),2000);
}
