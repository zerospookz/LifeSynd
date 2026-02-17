
let tx=JSON.parse(localStorage.getItem("financeTx")||"[]");
let budgets=JSON.parse(localStorage.getItem("financeBudgets")||"{}"); // {category: amount}

// --- Transaction editing/deleting (local-first) ---
let editingId = null;

function saveTx(){ localStorage.setItem("financeTx", JSON.stringify(tx)); }
function saveBudgets(){ localStorage.setItem("financeBudgets", JSON.stringify(budgets)); }
function todayIso(){ return isoToday(); }

function addTx(){
  const type=txType.value;
  const amount=Number(txAmount.value);
  const category=(txCategory.value||"Other").trim();
  const note=(txNote.value||"").trim();
  const date=txDate.value || todayIso();
  if(!amount || amount<=0) return;

  tx.unshift({id:crypto.randomUUID(), type, amount, category, note, date});
  saveTx(); render(); showToast("Transaction added");
  txAmount.value=""; txCategory.value=""; txNote.value=""; // keep date
}

function openEditTxModal(id){
  const m=document.getElementById("editTxModal");
  if(!m) return;
  const item = tx.find(t=>t.id===id);
  if(!item) return;
  editingId=id;
  document.getElementById("eTxId").value=id;
  document.getElementById("eTxType").value=item.type;
  document.getElementById("eTxAmount").value=item.amount;
  document.getElementById("eTxCategory").value=item.category||"";
  document.getElementById("eTxNote").value=item.note||"";
  document.getElementById("eTxDate").value=item.date || todayIso();
  m.classList.add("show");
  m.setAttribute("aria-hidden","false");
}

function closeEditTxModal(){
  const m=document.getElementById("editTxModal");
  if(!m) return;
  m.classList.remove("show");
  m.setAttribute("aria-hidden","true");
  editingId=null;
}

function saveEditedTx(){
  const id = editingId || document.getElementById("eTxId").value;
  if(!id) return;
  const idx = tx.findIndex(t=>t.id===id);
  if(idx===-1) return;

  const type=document.getElementById("eTxType").value;
  const amount=Number(document.getElementById("eTxAmount").value);
  const category=(document.getElementById("eTxCategory").value||"Other").trim();
  const note=(document.getElementById("eTxNote").value||"").trim();
  const date=document.getElementById("eTxDate").value || todayIso();
  if(!amount || amount<=0) return;

  tx[idx] = {...tx[idx], type, amount, category, note, date};
  saveTx();
  closeEditTxModal();
  render();
  showToast("Transaction updated");
}

function deleteTx(id){
  const idx = tx.findIndex(t=>t.id===id);
  if(idx===-1) return;
  tx.splice(idx,1);
  saveTx();
  render();
  showToast("Transaction deleted");
}

function deleteTxFromModal(){
  const id = editingId || document.getElementById("eTxId").value;
  if(!id) return;
  if(!confirm("Delete this transaction?")) return;
  closeEditTxModal();
  deleteTx(id);
}

function saveBudget(){
  const cat=(bCat.value||"").trim();
  const amt=Number(bAmt.value);
  if(!cat || !amt || amt<=0) return;
  budgets[cat]=amt;
  saveBudgets();
  bCat.value=""; bAmt.value="";
  render(); showToast("Budget saved");
}
function deleteBudget(cat){
  delete budgets[cat];
  saveBudgets();
  render(); showToast("Budget removed");
}

function sum(arr, pred){ return arr.filter(pred).reduce((s,t)=>s+t.amount,0); }
function startOfWeek(){
  const d=new Date();
  const day=(d.getDay()+6)%7;
  d.setDate(d.getDate()-day);
  d.setHours(0,0,0,0);
  return d;
}

function monthKey(d){
  const dt=new Date(d);
  return dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0");
}

function drawTrends(){
  const canvas=document.getElementById("financeTrend");
  if(!canvas) return;
  const ctx=canvas.getContext("2d");
  const now=new Date();
  const months=[];
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(), now.getMonth()-i, 1);
    months.push(d);
  }
  const series=months.map(m=>{
    const y=m.getFullYear(), mo=m.getMonth();
    const start=new Date(y,mo,1);
    const end=new Date(y,mo+1,1);
    const inM=tx.filter(t=>{
      const td=new Date(t.date);
      return td>=start && td<end;
    });
    return {
      label: m.toLocaleDateString(undefined,{month:"short"}),
      expense: sum(inM,t=>t.type==="expense"),
      income: sum(inM,t=>t.type==="income"),
    };
  });

  const maxVal=Math.max(1, ...series.map(s=>Math.max(s.expense,s.income)));
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // axes baseline
  ctx.globalAlpha=0.35;
  ctx.fillStyle="#ffffff";
  for(let i=0;i<4;i++){
    const y=30 + i*60;
    ctx.fillRect(40,y,canvas.width-60,1);
  }
  ctx.globalAlpha=1;

  const left=50, bottom=230, w=canvas.width-90, h=190;
  const groupW = w/series.length;
  series.forEach((s,idx)=>{
    const x = left + idx*groupW + 10;
    const barW = Math.min(28, groupW/3);
    const eH = (s.expense/maxVal)*h;
    const iH = (s.income/maxVal)*h;

    // expense bar (left)
    ctx.fillStyle="#ffffff";
    ctx.globalAlpha=0.18;
    ctx.fillRect(x, bottom-eH, barW, eH);
    // income bar (right, slightly brighter)
    ctx.globalAlpha=0.30;
    ctx.fillRect(x+barW+10, bottom-iH, barW, iH);

    // labels
    ctx.globalAlpha=0.6;
    ctx.font="14px Inter, system-ui";
    ctx.fillText(s.label, x, 255);
    ctx.globalAlpha=1;
  });

  ctx.globalAlpha=0.75;
  ctx.font="13px Inter, system-ui";
  ctx.fillText("Expense", 52, 18);
  ctx.globalAlpha=0.95;
  ctx.fillText("Income", 118, 18);
  ctx.globalAlpha=1;
}

function render(){
  if(txDate && !txDate.value) txDate.value=todayIso();

  const ws=startOfWeek();
  const now=new Date();
  const monthStart=new Date(now.getFullYear(), now.getMonth(), 1);

  const inWeek=tx.filter(t=> new Date(t.date) >= ws);
  const inMonth=tx.filter(t=> new Date(t.date) >= monthStart);

  const weekIncome=sum(inWeek,t=>t.type==="income");
  const weekExpense=sum(inWeek,t=>t.type==="expense");
  const monthIncome=sum(inMonth,t=>t.type==="income");
  const monthExpense=sum(inMonth,t=>t.type==="expense");

  const netWeek=weekIncome-weekExpense;
  const netMonth=monthIncome-monthExpense;

  if(fSummary){
    fSummary.innerHTML=`
      <div class="cardHeader"><h3 class="cardTitle">Summary</h3><span class="badge ${netWeek>=0?'ok':'danger'}">Net week ${netWeek.toFixed(0)}</span></div>
      <div class="grid">
        <div class="card soft">
          <div class="cardHeader"><h3 class="cardTitle">Week spend</h3><span class="badge danger">Expense</span></div>
          <div class="metric">${weekExpense.toFixed(0)}</div>
          <div class="small">Outgoing this week.</div>
        </div>
        <div class="card soft">
          <div class="cardHeader"><h3 class="cardTitle">Week income</h3><span class="badge ok">Income</span></div>
          <div class="metric">${weekIncome.toFixed(0)}</div>
          <div class="small">Incoming this week.</div>
        </div>
        <div class="card soft">
          <div class="cardHeader"><h3 class="cardTitle">Month spend</h3><span class="badge danger">Expense</span></div>
          <div class="metric">${monthExpense.toFixed(0)}</div>
          <div class="small">Outgoing this month.</div>
        </div>
        <div class="card soft">
          <div class="cardHeader"><h3 class="cardTitle">Month income</h3><span class="badge ok">Income</span></div>
          <div class="metric">${monthIncome.toFixed(0)}</div>
          <div class="small">Incoming this month.</div>
        </div>
      </div>
      <div class="badges">
        <span class="badge ${netMonth>=0?'ok':'danger'}">Net month: ${netMonth.toFixed(0)}</span>
        <span class="badge">Transactions: ${tx.length}</span>
      </div>
    `;
  }

  // budgets list + remaining per category
  if(budgetList){
    const spentByCat={};
    inMonth.filter(t=>t.type==="expense").forEach(t=>{ spentByCat[t.category]=(spentByCat[t.category]||0)+t.amount; });
    const entries=Object.entries(budgets).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
    const totalBudget=entries.reduce((s,[,v])=>s+Number(v||0),0);
    const totalSpent=Object.values(spentByCat).reduce((s,v)=>s+v,0);
    const remaining=Math.max(0,totalBudget-totalSpent);
    const pct= totalBudget>0 ? Math.round((totalSpent/totalBudget)*100) : 0;

    // budget alerts per category (80%+), once per month
    try{
      const ym = String(now.getFullYear())+"-"+String(now.getMonth()+1).padStart(2,"0");
      entries.forEach(([cat,amt])=>{
        const spent=spentByCat[cat]||0;
        const used = Number(amt)>0 ? (spent/Number(amt))*100 : 0;
        const key = "budgetCatAlert-"+ym+"-"+cat;
        if(used>=80 && localStorage.getItem(key)!=="1"){
          // only notify if there is spending and a budget
          showToast(`Budget alert: ${cat} at ${Math.round(used)}%`);
          localStorage.setItem(key,"1");
        }
      });
    }catch(e){}

    budgetList.innerHTML = entries.length ? `
      <div class="badges" style="margin-bottom:10px">
        <span class="badge ${pct<80?'ok':'warn'}">Used: ${pct}%</span>
        <span class="badge">Remaining: ${remaining.toFixed(0)}</span>
        <span class="badge">Total budget: ${totalBudget.toFixed(0)}</span>
      </div>
      ${entries.map(([cat,amt])=>{
        const spent=spentByCat[cat]||0;
        const left=Math.max(0, Number(amt)-spent);
        const used = Number(amt)>0 ? Math.round((spent/Number(amt))*100) : 0;
        const badgeClass = used<80 ? 'ok' : 'warn';
        return `
          <div style="margin:10px 0 0">
            <div class="actionsRow" style="justify-content:space-between">
              <div><strong>${cat}</strong><div class="small">${spent.toFixed(0)} spent • ${left.toFixed(0)} left</div></div>
              <div class="actionsRow">
                <span class="badge ${badgeClass}">${used}%</span>
                <button class="btn secondary" onclick="deleteBudget('${cat.replace(/'/g,"\'")}')">Remove</button>
              </div>
            </div>
            <div class="miniBar"><div style="width:${Math.min(100,used)}%"></div></div>
          </div>
        `;
      }).join("")}
    ` : `<p class="small">No budgets yet. Add one above (e.g., Food 400).</p>`;
  }

  // categories widget (top expenses) if present
  if(fCategories){
    const cat={};
    inMonth.filter(t=>t.type==="expense").forEach(t=>{ cat[t.category]=(cat[t.category]||0)+t.amount; });
    const entries=Object.entries(cat).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const top=entries[0]?.[1] || 0;
    fCategories.innerHTML=`<div class="cardHeader"><h3 class="cardTitle">Top categories</h3><span class="badge">This month</span></div>` +
      (entries.length ? entries.map(([k,v])=>`
        <div style="margin:10px 0 0">
          <div class="actionsRow" style="justify-content:space-between">
            <span>${k}</span><strong>${v.toFixed(0)}</strong>
          </div>
          <div class="miniBar"><div style="width:${top? (v/top*100).toFixed(0):0}%"></div></div>
        </div>`).join("") : `<p class="small">No expenses yet.</p>`);
  }

  // table
  if(txBody){
    txBody.innerHTML = tx.slice(0,12).map(t=>`
      <tr>
        <td>${t.date}</td>
        <td><span class="badge ${t.type==='income'?'ok':'danger'}">${t.type}</span></td>
        <td>${t.category}</td>
        <td>${t.type==='income'?'+':'-'}${t.amount.toFixed(0)}</td>
        <td>${t.note||''}</td>
        <td>
          <div class="actionsRow" style="gap:8px;justify-content:flex-end">
            <button class="btn secondary" onclick="openEditTxModal('${t.id}')">Edit</button>
            <button class="btn secondary" onclick="deleteTxConfirm('${t.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  drawTrends();
}
render();
window.saveBudget=saveBudget;
window.deleteBudget=deleteBudget;

function deleteTxConfirm(id){
  if(confirm("Delete this transaction?")) deleteTx(id);
}

// expose modal + actions for inline onclick
window.openEditTxModal=openEditTxModal;
window.closeEditTxModal=closeEditTxModal;
window.saveEditedTx=saveEditedTx;
window.deleteTxFromModal=deleteTxFromModal;
window.deleteTxConfirm=deleteTxConfirm;

// Close edit modal on backdrop click + ESC
document.addEventListener("keydown",(e)=>{
  if(e.key==="Escape") closeEditTxModal();
});
document.addEventListener("click",(e)=>{
  const m=document.getElementById("editTxModal");
  if(!m) return;
  if(m.classList.contains("show") && e.target===m) closeEditTxModal();
});
