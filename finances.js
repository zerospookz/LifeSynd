
let tx=JSON.parse(localStorage.getItem("financeTx")||"[]");

function save(){ localStorage.setItem("financeTx", JSON.stringify(tx)); }
function todayIso(){ return isoToday(); }

function addTx(){
  const type=txType.value;
  const amount=Number(txAmount.value);
  const category=(txCategory.value||"Other").trim();
  const note=(txNote.value||"").trim();
  const date=txDate.value || todayIso();

  if(!amount || amount<=0) return;

  tx.unshift({id:crypto.randomUUID(), type, amount, category, note, date});
  save();
  render();
  showToast("Transaction added");
  txAmount.value=""; txCategory.value=""; txNote.value=""; txDate.value="";
}

function sum(arr, pred){ return arr.filter(pred).reduce((s,t)=>s+t.amount,0); }

function startOfWeek(){
  const d=new Date();
  const day=(d.getDay()+6)%7;
  d.setDate(d.getDate()-day);
  d.setHours(0,0,0,0);
  return d;
}

function render(){
  if(!txDate.value) txDate.value=todayIso();

  // summary: week + month
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

  fSummary.innerHTML=`<h3>Summary</h3>
    <p><span class="badge ok">Week income: ${weekIncome.toFixed(0)}</span> <span class="badge danger">Week spend: ${weekExpense.toFixed(0)}</span></p>
    <p><span class="badge ok">Month income: ${monthIncome.toFixed(0)}</span> <span class="badge danger">Month spend: ${monthExpense.toFixed(0)}</span></p>
    <p><strong>Net week:</strong> ${netWeek.toFixed(0)} • <strong>Net month:</strong> ${netMonth.toFixed(0)}</p>`;

  // categories (month expense)
  const cat={};
  inMonth.filter(t=>t.type==="expense").forEach(t=>{ cat[t.category]=(cat[t.category]||0)+t.amount; });
  const entries=Object.entries(cat).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const top=entries[0]?.[1] || 0;
  fCategories.innerHTML=`<h3>Top categories (month)</h3>` + (entries.length? entries.map(([k,v])=>`
    <div style="margin:10px 0 0">
      <div class="row" style="justify-content:space-between">
        <span>${k}</span><strong>${v.toFixed(0)}</strong>
      </div>
      <div class="miniBar"><div style="width:${top? (v/top*100).toFixed(0):0}%"></div></div>
    </div>`).join("") : `<p class="empty">No expenses yet.</p>`);

  // table
  txBody.innerHTML = tx.slice(0,12).map(t=>`
    <tr>
      <td>${t.date}</td>
      <td><span class="badge ${t.type==='income'?'ok':'danger'}">${t.type}</span></td>
      <td>${t.category}</td>
      <td>${t.type==='income'?'+':'-'}${t.amount.toFixed(0)}</td>
      <td>${t.note||''}</td>
    </tr>
  `).join("");
}

render();
