"use strict";
// Optional date input (some layouts include a date picker; Habits page currently doesn't).
// We still declare it to avoid ReferenceError in strict mode.
let markDate = null;
// --- Analytics state (must be defined before first render) ---
let analyticsView = localStorage.getItem("habitsAnalyticsView") || "month";

// Per-view offsets so switching Week/Month/Year doesn't unexpectedly jump to past periods.
let analyticsOffsets = (() => {
  try {
    const raw = localStorage.getItem("habitsAnalyticsOffsets");
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") {
        return {
          week:  Number(obj.week)  || 0,
          month: Number(obj.month) || 0,
          year:  Number(obj.year)  || 0,
          all:   Number(obj.all)   || 0,
        };
      }
    }
  } catch (e) {}

  // Migration: older builds stored a single offset.
  const legacy = parseInt(localStorage.getItem("habitsAnalyticsOffsetDays") || "0", 10) || 0;
  return { week: 0, month: legacy, year: 0, all: 0 };
})();

function saveAnalyticsOffsets() {
  localStorage.setItem("habitsAnalyticsOffsets", JSON.stringify(analyticsOffsets));
}

let analyticsOffsetDays = Number(analyticsOffsets[analyticsView]) || 0;
let analyticsPaintMode = (localStorage.getItem("habitsAnalyticsPaintMode")==="mark" || localStorage.getItem("habitsAnalyticsPaintMode")==="erase") ? localStorage.getItem("habitsAnalyticsPaintMode") : null; // mark | erase
let lastPulse = null; // {hid, iso, mode:"done"|"miss"} for subtle mark animation

// Month view selected day + quick day details modal
let monthSelectedIso = null;
let dayDetailsModalEl = null;

function isWeekendIso(iso){
  try{
    const d = new Date(iso + "T00:00:00");
    const dow = d.getDay(); // 0 Sun .. 6 Sat
    return dow === 0 || dow === 6;
  }catch(e){ return false; }
}

function setHabitDoneForIso(hid, iso, done){
  const h = habits.find(x=>x.id===hid);
  if(!h) return;
  h.datesDone = h.datesDone || [];
  const set = new Set(h.datesDone);
  const had = set.has(iso);
  if(done){
    set.add(iso);
  }else{
    set.delete(iso);
  }
  // no-op
  if(had === set.has(iso)) return;
  h.datesDone = Array.from(set).sort();
  save();
}

function computePctForIso(iso){
  const total = Math.max(1, (habits||[]).length);
  let done = 0;
  for(const h of (habits||[])){
    if((h.datesDone||[]).includes(iso)) done++;
  }
  return Math.round((done/total)*100);
}

function ensureDayDetailsModal(){
  if(dayDetailsModalEl) return dayDetailsModalEl;
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.id = "dayDetailsModal";
  modal.innerHTML = `
    <div class="modalBackdrop" role="dialog" aria-modal="true" aria-label="Day details">
      <div class="modalSheet">
        <div class="modalHeader">
          <div class="modalTitle" id="dayDetailsTitle">Day details</div>
          <button class="iconBtn" type="button" data-close aria-label="Close">✕</button>
        </div>
        <div class="modalBody" id="dayDetailsBody"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = ()=> modal.classList.remove("open");
  modal.addEventListener("click", (e)=>{
    const t = e.target;
    if(t && (t.classList.contains("modalBackdrop") || t.closest("[data-close]"))){
      close();
    }
  });
  window.addEventListener("keydown", (e)=>{
    if(e.key==="Escape" && modal.classList.contains("open")) close();
  });

  dayDetailsModalEl = modal;
  return modal;
}

function openDayDetails(iso){
  monthSelectedIso = iso;
  const modal = ensureDayDetailsModal();
  const title = modal.querySelector("#dayDetailsTitle");
  const body = modal.querySelector("#dayDetailsBody");
  const d = new Date(iso + "T00:00:00");
  const pretty = d.toLocaleDateString(undefined, { weekday:"long", year:"numeric", month:"short", day:"numeric" });
  if(title) title.textContent = pretty;

  const todayIso = today();
  const rows = (habits||[]).map(h=>{
    const done = (h.datesDone||[]).includes(iso);
    const missed = (!done && iso < todayIso);
    const accent = habitAccent(h);
    return `
      <div class="dayRow" data-hid="${h.id}">
        <div class="dayLeft">
          <div class="dayDot" style="--accent:${accent}"></div>
          <div class="dayName">${escapeHtml(h.name)}</div>
          <div class="dayStatus ${done ? "isDone":""} ${missed ? "isMissed":""}">
            ${done ? "Done" : (missed ? "Missed" : "—")}
          </div>
        </div>
        <div class="dayActions">
          <button class="btnSmall ${done ? "primary":""}" type="button" data-act="toggle">${done ? "Undo" : "Done"}</button>
          <button class="btnSmall" type="button" data-act="clear">Clear</button>
        </div>
      </div>
    `;
  }).join("");

  body.innerHTML = `
    <div class="dayMeta">
      <div class="dayMetaChip">${isWeekendIso(iso) ? "Weekend" : "Weekday"}</div>
      <div class="dayMetaChip"><span class="mono">${iso}</span></div>
    </div>
    <div class="dayRows">
      ${rows || '<div class="empty">No habits yet. Add a habit to use day details.</div>'}
    </div>
  `;

  body.onclick = (e)=>{
    const btn = e.target.closest("button[data-act]");
    if(!btn) return;
    const row = btn.closest(".dayRow");
    if(!row) return;
    const hid = row.dataset.hid;
    const act = btn.dataset.act;
    const h = habits.find(x=>x.id===hid);
    if(!h) return;

    const currentlyDone = (h.datesDone||[]).includes(iso);
    if(act==="toggle"){
      setHabitDoneForIso(hid, iso, !currentlyDone);
    }else if(act==="clear"){
      setHabitDoneForIso(hid, iso, false);
    }

    // Update modal row UI
    const nowDone = (h.datesDone||[]).includes(iso);
    const nowMissed = (!nowDone && iso < today());
    row.querySelector(".dayStatus").textContent = nowDone ? "Done" : (nowMissed ? "Missed" : "—");
    row.querySelector(".dayStatus").className = `dayStatus ${nowDone ? "isDone":""} ${nowMissed ? "isMissed":""}`;
    const toggleBtn = row.querySelector('button[data-act="toggle"]');
    if(toggleBtn){
      toggleBtn.textContent = nowDone ? "Undo" : "Done";
      toggleBtn.classList.toggle("primary", nowDone);
    }

    // Update the month cell percent + visuals (no page refresh)
    const cell = document.querySelector(`.monthCalGrid .calCell[data-iso="${iso}"]`);
    if(cell){
      const pct = computePctForIso(iso);
      // colors based on pct (0..120 hue)
      const hue = (pct * 120) / 100;
      const bar = `hsl(${hue}, 88%, 55%)`;
      const glow = `hsla(${hue}, 92%, 58%, .70)`;
      cell.style.setProperty("--barColor", bar);
      cell.style.setProperty("--glowColor", glow);

      const pctEl = cell.querySelector(".calPctNum");
      if(pctEl){
        pctEl.textContent = pct + "%";
        pctEl.setAttribute("data-target", String(pct));
      }
      const fill = cell.querySelector(".calFill");
      if(fill) fill.style.width = pct + "%";

      cell.setAttribute("aria-label", `${iso}, ${pct}%`);
      cell.classList.toggle("isZero", pct===0);
      cell.classList.toggle("isLow", pct>0 && pct<35);
    }
  };

  // Highlight selected cell
  document.querySelectorAll(".monthCalGrid .calCell.selected").forEach(x=>x.classList.remove("selected"));
  const cell = document.querySelector(`.monthCalGrid .calCell[data-iso="${iso}"]`);
  if(cell) cell.classList.add("selected");

  modal.classList.add("open");
}

// Accent helper for modal dot (keeps it consistent with the rest of the app)
function habitAccent(h){
  const hue = (typeof h.hue === "number") ? h.hue : habitHue(h.id);
  return `hsl(${hue} 85% 60%)`;
}

function rangeDates(rangeDays, offsetDays, dir="backward"){
  // dir: "backward" (default) returns [oldest..newest] ending at (today+offset)
  //      "forward" returns [today+offset .. +rangeDays-1]
  const base = new Date();
  base.setDate(base.getDate() + (offsetDays||0));
  const res=[];
  if(dir === "forward"){
    for(let i=0;i<rangeDays;i++){
      const x=new Date(base);
      x.setDate(base.getDate()+i);
      res.push(x.toISOString().slice(0,10));
    }
  }else{
    for(let i=rangeDays-1;i>=0;i--){
      const x=new Date(base);
      x.setDate(base.getDate()-i);
      res.push(x.toISOString().slice(0,10));
    }
  }
  return res;
}

function addMonths(d, months){
  const x = new Date(d);
  const day = x.getDate();
  x.setDate(1);
  x.setMonth(x.getMonth() + (months||0));
  const last = new Date(x.getFullYear(), x.getMonth()+1, 0).getDate();
  x.setDate(Math.min(day, last));
  return x;
}

function addYears(d, years){
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + (years||0));
  return x;
}

function getBoundsForView(view, offset){
  const v = (view||"week").toLowerCase();
  const now = new Date();

  if(v === "month"){
    const base = addMonths(now, offset||0);
    const y = base.getFullYear();
    const m = base.getMonth();
    return { start: utcDate(y,m,1), end: utcDate(y,m+1,0) };
  }
  if(v === "year"){
    const base = addYears(now, offset||0);
    const y = base.getFullYear();
    return { start: utcDate(y,0,1), end: utcDate(y,11,31) };
  }

  // week + all: use rolling windows in days.
  const base = new Date(now);
  base.setDate(base.getDate() + (offset||0));
  if(v === "all"){
    // bounds for "All" are handled elsewhere (earliest mark). Provide a reasonable default.
    const end = new Date(base);
    const start = new Date(base);
    start.setDate(end.getDate()-29);
    return { start, end };
  }

  // week
  const end = new Date(base);
  const start = new Date(base);
  start.setDate(end.getDate()-6);
  return { start, end };
}

// Calendar week bounds where the week starts on Monday (Mon..Sun)
function getMondayWeekBounds(baseDate){
  const d = new Date(baseDate);
  // JS getDay(): 0=Sun..6=Sat. Convert to days since Monday.
  const daysSinceMon = (d.getDay() + 6) % 7;
  const start = new Date(d);
  start.setHours(0,0,0,0);
  start.setDate(start.getDate() - daysSinceMon);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function datesFromBounds(bounds){
  const out = [];
  const d = new Date(bounds.start);
  while(d <= bounds.end){
    out.push(d.toISOString().slice(0,10));
    d.setDate(d.getDate()+1);
  }
  return out;
}

// Format ISO date (YYYY-MM-DD) to e.g. "Jan 29"
function fmtMonthDay(iso){
  const d = new Date(iso+"T00:00:00");
  try{
    return new Intl.DateTimeFormat(undefined,{month:"short", day:"numeric"}).format(d);
  }catch(e){
    return iso.slice(5);
  }
}

// Format ISO date to e.g. "Mon, 2/4"
function fmtDowShortMD(iso){
  const d = new Date(iso+"T00:00:00");
  try{
    // Use numeric month/day to match compact UI.
    return new Intl.DateTimeFormat(undefined,{weekday:"short", month:"numeric", day:"numeric"}).format(d);
  }catch(e){
    return iso;
  }
}


// ----------------------
// Period comparison (for underline trend bar)
// ----------------------
function isoDate(d){
  return d.toISOString().slice(0,10);
}
function utcDate(y,m,d){
  return new Date(Date.UTC(y,m,d));
}

function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }


// ---------- Year heatmap helpers ----------
let yearHabitId = localStorage.getItem("habitsYearHabitId") || null;
function getYearHabit(){
  const H = getFilteredHabits ? getFilteredHabits() : (habits||[]);
  if(!H || !H.length) return null;
  if(!yearHabitId || !H.some(h=>h.id===yearHabitId)){
    yearHabitId = H[0].id;
    localStorage.setItem("habitsYearHabitId", yearHabitId);
  }
  return H.find(h=>h.id===yearHabitId) || H[0];
}
function setYearHabit(id){
  yearHabitId = id;
  localStorage.setItem("habitsYearHabitId", id);
}
function monthBoundsFor(year, monthIndex){
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex+1, 0);
  return { start, end };
}
function enumerateDates(start, end){
  const out = [];
  const d = new Date(start);
  d.setHours(0,0,0,0);
  const e = new Date(end);
  e.setHours(0,0,0,0);
  while(d <= e){
    out.push(isoDate(d));
    d.setDate(d.getDate()+1);
  }
  return out;
}
function calcStreaksInWindow(habit, startIso, endIso){
  const doneSet = new Set(habit.datesDone||[]);
  const start = new Date(startIso+"T00:00:00");
  const end = new Date(endIso+"T00:00:00");
  // best streak
  let best = 0, cur = 0;
  const d = new Date(start);
  while(d <= end){
    const k = isoDate(d);
    if(doneSet.has(k)){ cur++; best = Math.max(best, cur); }
    else cur = 0;
    d.setDate(d.getDate()+1);
  }
  // current streak (ending at endIso)
  let current = 0;
  const b = new Date(end);
  while(b >= start){
    const k = isoDate(b);
    if(doneSet.has(k)){ current++; b.setDate(b.getDate()-1); }
    else break;
  }
  return { best, current };
}
function intensityLevel(pct){
  if(pct <= 0) return 0;
  if(pct <= 30) return 1;
  if(pct <= 60) return 2;
  if(pct <= 85) return 3;
  return 4;
}


function renderYearHeatmap(gridEl, cardEl, habitsList, yearOffset){
  const viewYearBounds = getBoundsForView("year", Number(yearOffset)||0);
  const year = viewYearBounds.start.getFullYear();
  const todayIso = today();
  const yearStartIso = isoDate(viewYearBounds.start);
  const yearEndIsoRaw = isoDate(viewYearBounds.end);
  const yearEndIso = (yearEndIsoRaw < todayIso) ? yearEndIsoRaw : todayIso;

  const habit = getYearHabit();
  if(!habit){
    gridEl.innerHTML = '<p class="empty">Add a habit to view the year heatmap.</p>';
    return;
  }

  const accent = `hsl(${habitHue(habit.id)} 70% 55%)`;
  const createdIso = (habit && typeof habit.created === "string" && habit.created.length===10) ? habit.created : yearStartIso;
  const startIso = (createdIso > yearStartIso) ? createdIso : yearStartIso;
  const endIso = (yearEndIso < startIso) ? startIso : yearEndIso;

  // Year totals
  const doneYear = countDoneInBounds(habit, { start: new Date(startIso+"T00:00:00"), end: new Date(endIso+"T00:00:00") });
  const startD = new Date(startIso+"T00:00:00");
  const endD = new Date(endIso+"T00:00:00");
  let eligibleYear = Math.floor((endD - startD) / 86400000) + 1;
  if(!Number.isFinite(eligibleYear) || eligibleYear < 0) eligibleYear = 0;
  const pctYear = eligibleYear ? Math.round((doneYear/eligibleYear)*100) : 0;

  // Per-month stats
  const monthStats = [];
  for(let m=0;m<12;m++){
    const mb = monthBoundsFor(year, m);
    const msIso = isoDate(mb.start);
    const meIsoRaw = isoDate(mb.end);
    const meIso = (meIsoRaw < endIso) ? meIsoRaw : endIso;

    const mStartIso = (startIso > msIso) ? startIso : msIso;
    const mEndIso = (meIso < mStartIso) ? mStartIso : meIso;

    const mStartD = new Date(mStartIso+"T00:00:00");
    const mEndD = new Date(mEndIso+"T00:00:00");
    let eligible = Math.floor((mEndD - mStartD) / 86400000) + 1;
    if(!Number.isFinite(eligible) || eligible < 0) eligible = 0;

    const done = countDoneInBounds(habit, { start: new Date(mStartIso+"T00:00:00"), end: new Date(mEndIso+"T00:00:00") });
    const pct = eligible ? Math.round((done/eligible)*100) : 0;
    monthStats.push({ m, eligible, done, pct });
  }

  const validMonths = monthStats.filter(x=>x.eligible>0);
  const best = validMonths.length ? validMonths.reduce((a,b)=> (b.pct>a.pct?b:a)) : null;
  const worst = validMonths.length ? validMonths.reduce((a,b)=> (b.pct<a.pct?b:a)) : null;

  const streaks = calcStreaksInWindow(habit, startIso, endIso);

  const monthName = (m)=> {
    try{ return new Intl.DateTimeFormat(undefined,{month:"short"}).format(new Date(year, m, 1)); }
    catch(_){ return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m]; }
  };

  function monthHeatmapHTML(m){
    const mb = monthBoundsFor(year, m);
    const ms = mb.start;
    const me = mb.end;
    const msIso = isoDate(ms);
    const meIsoRaw = isoDate(me);
    const meIso = (meIsoRaw < endIso) ? meIsoRaw : endIso;

    const monthDates = enumerateDates(ms, new Date(meIso+"T00:00:00"));
    // Mon-first offset
    const first = new Date(msIso+"T00:00:00");
    const offset = (first.getDay() + 6) % 7;

    const doneSet = new Set(habit.datesDone||[]);
    let html = '<div class="yHeat" role="grid" aria-label="'+monthName(m)+'">';
    for(let i=0;i<offset;i++){
      html += '<div class="yCell empty" aria-hidden="true"></div>';
    }
    for(const dIso of monthDates){
      // Respect habit created/start window
      const inWindow = (dIso >= startIso && dIso <= endIso);
      const isDone = inWindow && doneSet.has(dIso);
      const isToday = dIso === todayIso;
      html += '<div class="yCell '+(isDone?'done':'')+' '+(isToday?'today':'')+' '+(!inWindow?'disabled':'')+'" title="'+dIso+': '+(isDone?'done':'not done')+'"></div>';
    }
    html += '</div>';
    return html;
  }

  const summaryHtml = `
    <div class="yearSummary" style="--habit-accent:${accent}">
      <div class="yearSummaryLeft">
        <div class="yearKicker">YEAR VIEW</div>
        <div class="yearHabitName">${escapeHtml(habit.name)}</div>
        <div class="yearMeta">${doneYear} / ${eligibleYear} days • ${pctYear}% consistency</div>
      </div>
      <div class="yearSummaryStats">
        <div class="yStat"><div class="k">Current streak</div><div class="v">${streaks.current}</div></div>
        <div class="yStat"><div class="k">Best streak</div><div class="v">${streaks.best}</div></div>
        <div class="yStat"><div class="k">Best month</div><div class="v">${best?monthName(best.m):"—"} <span class="sub">${best?best.pct+"%":""}</span></div></div>
        <div class="yStat"><div class="k">Worst month</div><div class="v">${worst?monthName(worst.m):"—"} <span class="sub">${worst?worst.pct+"%":""}</span></div></div>
      </div>
    </div>
  `;

  const options = (habitsList||[]).map(h=>`<option value="${h.id}" ${h.id===habit.id?'selected':''}>${escapeHtml(h.name)}</option>`).join("");
  const pickerHtml = `
    <div class="yearPickerRow">
      <div class="yearPicker">
        <div class="yearPickerLabel">Habit</div>
        <div class="selectWrap"><select id="yearHabitSelect" class="premiumSelect">${options}</select></div>
      </div>
    </div>
  `;

  const monthsHtml = `
    <div class="yearMonths" style="--habit-accent:${accent}">
      ${monthStats.map(ms=>{
        const lvl = intensityLevel(ms.pct);
        const title = `${monthName(ms.m)} ${year}: ${ms.done}/${ms.eligible} (${ms.pct}%)`;
        return `
          <div class="monthCard lvl${lvl}" title="${title}">
            <div class="monthHead">
              <div class="monthTitle">${monthName(ms.m)}</div>
              <div class="monthMeta">${ms.done}/${ms.eligible}</div>
            </div>
            ${monthHeatmapHTML(ms.m)}
          </div>
        `;
      }).join("")}
    </div>
  `;

  gridEl.innerHTML = `<div class="yearView">${pickerHtml}${summaryHtml}${monthsHtml}</div>`;

  const sel = gridEl.querySelector("#yearHabitSelect");
  sel?.addEventListener("change", (e)=>{
    const id = e.target && e.target.value;
    if(id){
      setYearHabit(id);
      renderAnalytics();
      renderListInAnalytics();
    }
  });

  // Hide paint hint (year heatmap is view-only).
  const help = cardEl.querySelector('.matrixHelp');
  if(help) help.style.display = 'none';
}

// ---------- All-time (multi-year) view ----------

function renderAllTimeYearsGrid(gridEl, cardEl, habitsList){
  if(!gridEl) return;
  const H = (habitsList||[]).slice();
  if(!H.length){
    gridEl.innerHTML = '<p class="empty">Add a habit to see analytics.</p>';
    return;
  }

  // Habit selector (persisted)
  let selId = localStorage.getItem('habitsAllHabitId') || '';
  if(!selId || !H.some(h=>h.id===selId)) selId = H[0].id;
  const selected = H.find(h=>h.id===selId) || H[0];

  const todayIso = today();
  const createdIso = (selected && typeof selected.created === 'string' && selected.created.length===10) ? selected.created : todayIso;
  const earliestIso = ((selected.datesDone||[]).concat([createdIso]).sort()[0]) || createdIso;
  const earliestYear = Number(String(earliestIso).slice(0,4)) || (new Date().getFullYear());
  const currentYear = new Date(todayIso + 'T00:00:00').getFullYear();

  const accent = `hsl(${habitHue(selected.id)} 70% 55%)`;

  function yearSummary(h, year){
    const b = { start: new Date(year,0,1), end: new Date(year,11,31) };
    // clamp window to created..today
    const startIso = (createdIso > isoDate(b.start)) ? createdIso : isoDate(b.start);
    const endIsoRaw = isoDate(b.end);
    const endIso = (endIsoRaw < todayIso) ? endIsoRaw : todayIso;
    const startD = new Date(startIso+'T00:00:00');
    const endD = new Date(endIso+'T00:00:00');
    let eligible = Math.floor((endD-startD)/86400000)+1;
    if(!Number.isFinite(eligible) || eligible < 0) eligible = 0;
    const done = countDoneInBounds(h, { start:startD, end:endD });
    const pct = eligible ? Math.round((done/eligible)*100) : 0;
    return { eligible, done, pct, startIso, endIso };
  }

  function renderMonthHeat(h, year, monthIdx, windowStartIso, windowEndIso){
    const mb = monthBoundsFor(year, monthIdx);
    let ms = isoDate(mb.start);
    let me = isoDate(mb.end);
    // clamp to window
    if(ms < windowStartIso) ms = windowStartIso;
    if(me > windowEndIso) me = windowEndIso;
    const startD = new Date(ms+'T00:00:00');
    const endD = new Date(me+'T00:00:00');
    const set = new Set(h.datesDone||[]);

    // Build Monday-first calendar for the month
    const first = new Date(year, monthIdx, 1);
    const last = new Date(year, monthIdx+1, 0);
    const monthStartIso = isoDate(first);
    const monthEndIso = isoDate(last);

    // compute month completion for title
    const mStartIso = (ms > monthStartIso) ? ms : monthStartIso;
    const mEndIso = (me < monthEndIso) ? me : monthEndIso;
    const mStartD = new Date(mStartIso+'T00:00:00');
    const mEndD = new Date(mEndIso+'T00:00:00');
    let eligible = Math.floor((mEndD-mStartD)/86400000)+1;
    if(!Number.isFinite(eligible) || eligible < 0) eligible = 0;
    const done = countDoneInBounds(h, { start:mStartD, end:mEndD });
    const pct = eligible ? Math.round((done/eligible)*100) : 0;
    const lvl = intensityLevel(pct);

    // Monday-first offset
    const dow = (d)=> (d.getDay()+6)%7; // Mon=0
    const startOffset = dow(first);
    const daysInMonth = last.getDate();
    const totalCells = startOffset + daysInMonth;
    const rows = Math.ceil(totalCells/7);
    const cellCount = rows*7;

    const cells = [];
    for(let i=0;i<cellCount;i++){
      const dayNum = i - startOffset + 1;
      if(dayNum < 1 || dayNum > daysInMonth){
        cells.push('<div class="yCell empty"></div>');
        continue;
      }
      const iso = isoDate(new Date(year, monthIdx, dayNum));
      // outside clamp window
      if(iso < ms || iso > me){
        cells.push('<div class="yCell empty"></div>');
        continue;
      }
      const doneDay = set.has(iso);
      const isToday = iso === todayIso;
      const isPast = iso < todayIso;
      const cls = ['yCell', `lvl${lvl}`];
      if(doneDay) cls.push('done');
      else if(isPast) cls.push('missed');
      if(isToday) cls.push('today');
      cells.push(`<div class="${cls.join(' ')}" title="${iso}" style="--habit-accent:${accent}"></div>`);
    }

    let mName = '';
    try{ mName = new Intl.DateTimeFormat(undefined,{month:'short'}).format(new Date(year, monthIdx, 1)).toUpperCase(); }
    catch(_){ mName = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][monthIdx]; }

    return `
      <div class="monthCard lvl${lvl}" style="--habit-accent:${accent}">
        <div class="monthHead">
          <div class="monthTitle">${mName}</div>
          <div class="monthMeta">${done}/${eligible}</div>
        </div>
        <div class="yHeat">${cells.join('')}</div>
      </div>
    `;
  }

  const years = [];
  for(let y=currentYear; y>=earliestYear; y--) years.push(y);

  const selector = `
    <div class="allTimeTop">
      <div class="allTimeTitle">
        <div class="kicker">All time</div>
        <div class="headline">${escapeHtml(selected.name||'Habit')}</div>
      </div>
      <label class="allTimePick">
        <span class="small">Habit</span>
        <div class="selectWrap"><select id="allTimeHabitPick" class="premiumSelect">
          ${H.map(h=>`<option value="${escapeHtml(h.id)}" ${h.id===selId?'selected':''}>${escapeHtml(h.name||'Habit')}</option>`).join('')}
        </select></div>
      </label>
    </div>
  `;

  const blocks = years.map((y, idx)=>{
    const s = yearSummary(selected, y);
    const open = (y===currentYear);
    const months = Array.from({length:12}, (_,m)=>renderMonthHeat(selected, y, m, s.startIso, s.endIso)).join('');
    return `
      <details class="yearBlock" ${open?'open':''}>
        <summary>
          <div class="ybLeft">
            <div class="ybYear">${y}</div>
            <div class="ybMeta">${s.pct}% • ${s.done}/${s.eligible} days</div>
          </div>
          <div class="ybChevron" aria-hidden="true">▾</div>
        </summary>
        <div class="ybBody">${months}</div>
      </details>
    `;
  }).join('');

  gridEl.classList.add('allTimeYears');
  gridEl.innerHTML = selector + `<div class="yearsStack">${blocks}</div>`;

  const pick = gridEl.querySelector('#allTimeHabitPick');
  if(pick){
    pick.addEventListener('change', ()=>{
      localStorage.setItem('habitsAllHabitId', pick.value);
      renderAnalytics();
      renderListInAnalytics();
    });
  }

  // All-time grid is view-only
  const help = cardEl?.querySelector('.matrixHelp');
  if(help) help.style.display = 'none';
}

function getCurrentViewMode(){
  try{ return localStorage.getItem("habitsViewMode") || "grid"; }catch(e){ return "grid"; }
}

function setHabitsViewMode(tab){
  const t = (tab||"grid").toLowerCase();
  try{ localStorage.setItem("habitsViewMode", t); }catch(e){}
  // We keep the analytics card visible and swap content INSIDE it (matrix vs list)
  // to avoid a "new page" feel.
  document.body.classList.toggle("habitsViewList", t === "list");

  // Keep both the page-level toggle (mobile) and the in-header toggles (desktop) in sync.
  const allBtns = Array.from(document.querySelectorAll('.tabBtn[data-tab], .tabBtn[data-settab]'));
  allBtns.forEach(b=>{
    const k = b.getAttribute('data-tab') || b.getAttribute('data-settab') || "grid";
    b.classList.toggle('active', k===t);
  });

  try{ render(); }catch(e){}
}

// Returns period bounds for the current analyticsView.
// Note: week uses a rolling 7-day window ending at (today+offsetDays).
// month/year use calendar month/year containing (today+offsetDays).
function getPeriodBounds(view, offset){
  const v=(view||"week").toLowerCase();
  const now=new Date();

  if(v==="month"){
    const base=addMonths(now, offset||0);
    const y=base.getFullYear();
    const m=base.getMonth();
    return { start:new Date(y,m,1), end:new Date(y,m+1,0), label:"vs last month", periodName:"month" };
  }
  if(v==="year"){
    const base=addYears(now, offset||0);
    const y=base.getFullYear();
    return { start:new Date(y,0,1), end:new Date(y,11,31), label:"vs last year", periodName:"year" };
  }
  if(v==="all"){
    // All-time comparison doesn't really make sense. Keep a neutral bar.
    const end=new Date(now);
    end.setDate(end.getDate() + (offset||0));
    const start=new Date(end);
    start.setDate(end.getDate()-6);
    return { start, end, label:"", periodName:"period" };
  }

  // week (default): rolling 7-day window ending at (today + offsetDays)
  const end=new Date(now);
  end.setDate(end.getDate() + (offset||0));
  const start=new Date(end);
  start.setDate(end.getDate()-6);
  return { start, end, label:"vs last week", periodName:"week" };
}

function shiftPeriod(bounds, view){
  const v=(view||"week").toLowerCase();
  if(v==="month"){
    const s=bounds.start;
    const prevStart=new Date(s.getFullYear(), s.getMonth()-1, 1);
    const prevEnd=new Date(s.getFullYear(), s.getMonth(), 0);
    return { start: prevStart, end: prevEnd };
  }
  if(v==="year"){
    const y=bounds.start.getFullYear()-1;
    return { start:new Date(y,0,1), end:new Date(y,11,31) };
  }
  // week/all fallback: previous 7 days
  const prevEnd=new Date(bounds.start);
  prevEnd.setDate(bounds.start.getDate()-1);
  const prevStart=new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate()-6);
  return { start: prevStart, end: prevEnd };
}

function countDoneInBounds(h, b){
  const arr = (h && h.datesDone) ? h.datesDone : [];
  if(!arr || arr.length===0) return 0;
  const s = isoDate(b.start);
  const e = isoDate(b.end);
  let c=0;
  for(const iso of arr){
    if(typeof iso!=="string") continue;
    if(iso>=s && iso<=e) c++;
  }
  return c;
}

function daysInBounds(b){
  const ms = b.end.getTime() - b.start.getTime();
  return Math.floor(ms / (24*3600*1000)) + 1;
}

// Returns { current, prev, delta, label, periodName }
function computeTrendDeltaPct(h, view, offsetDays){
  const bounds = getPeriodBounds(view, offsetDays);
  const prevB = shiftPeriod(bounds, view);
  const daysCur = Math.max(1, daysInBounds(bounds));
  const daysPrev = Math.max(1, daysInBounds(prevB));
  const curPct = (countDoneInBounds(h, bounds) / daysCur) * 100;
  const prevPct = (countDoneInBounds(h, prevB) / daysPrev) * 100;
  const delta = clamp(curPct - prevPct, -100, 100);
  return {
    current: curPct,
    prev: prevPct,
    delta,
    label: bounds.label || "",
    periodName: bounds.periodName || "period",
  };
}

let habits=JSON.parse(localStorage.getItem("habitsV2")||"[]");
function save(){localStorage.setItem("habitsV2",JSON.stringify(habits));}

// Normalize habit kinds on load (older builds didn't store this field).
function normalizeHabitKinds(){
  let changed = false;
  for(const h of (habits||[])){
    if(!h || typeof h !== 'object') continue;
    if(h.kind !== 'positive' && h.kind !== 'negative'){
      h.kind = 'positive';
      changed = true;
    }
  }
  if(changed) save();
}

function habitKind(h){
  return (h && (h.kind === 'negative' || h.kind === 'positive')) ? h.kind : 'positive';
}

function habitDoneText(h, done){
  // For negative habits, a "done" mark means you successfully avoided the habit.
  return habitKind(h)==='negative'
    ? (done ? 'I avoided this' : 'I slipped')
    : (done ? 'Completed' : 'Not completed');
}

function habitActionText(h, done){
  if(done) return 'Undo';
  return habitKind(h)==='negative' ? 'Mark avoided' : 'Mark complete';
}

function habitBadgeText(h, done){
  return habitKind(h)==='negative' ? (done ? 'Avoided' : 'At risk') : (done ? 'Completed' : 'Due');
}

// Normalize hues on load so accents stay stable and unique.
// (If older data had duplicates, we keep the first occurrence and reassign the rest.)
try{
  normalizeHabitKinds();
  ensureHabitHues();
  ensureUniqueHues();
}catch(e){ /* ignore */ }
// --- UI filters ---
let habitSearchTerm = "";
function getFilteredHabits(){
  const term = (habitSearchTerm||"").trim().toLowerCase();
  if(!term) return habits;
  return (habits||[]).filter(h => (h.name||"").toLowerCase().includes(term));
}


// --- Habit carousel state ---
let habitCarouselIndex = parseInt(localStorage.getItem('habitsCarouselIndex')||'0',10);
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }

function setCarouselIndex(i){
  habitCarouselIndex = clamp(i, 0, Math.max(0, habits.length-1));
  localStorage.setItem('habitsCarouselIndex', String(habitCarouselIndex));
  // If carousel is present, update without full rerender.
  const track = document.getElementById('habTrack');
  const dots = document.getElementById('habitDots');
  if(track){
    track.style.transform = `translateX(${-habitCarouselIndex*100}%)`;
  }
  if(dots){
    [...dots.querySelectorAll('button')].forEach((b,idx)=>b.classList.toggle('active', idx===habitCarouselIndex));
  }
}

function setupHabitCarousel(){
  const track = document.getElementById('habTrack');
  const viewport = document.getElementById('habViewport');
  const prev = document.getElementById('habPrev');
  const next = document.getElementById('habNext');
  const dots = document.getElementById('habitDots');
  if(!track || !viewport || !dots) return;

  // Re-clamp in case habits length changed
  habitCarouselIndex = clamp(habitCarouselIndex, 0, Math.max(0, habits.length-1));
  localStorage.setItem('habitsCarouselIndex', String(habitCarouselIndex));

  // Build dots
  dots.innerHTML = habits.map((_,idx)=>`<button type="button" class="dotBtn ${idx===habitCarouselIndex?'active':''}" aria-label="Go to habit ${idx+1}"></button>`).join('');
  [...dots.querySelectorAll('button')].forEach((b,idx)=>b.addEventListener('click', ()=>setCarouselIndex(idx)));

  prev?.addEventListener('click', ()=>setCarouselIndex(habitCarouselIndex-1));
  next?.addEventListener('click', ()=>setCarouselIndex(habitCarouselIndex+1));

  // Swipe/drag to change slide
  if(viewport.dataset.bound === '1'){
    track.style.transition='transform .22s ease';
    setCarouselIndex(habitCarouselIndex);
    return;
  }
  viewport.dataset.bound = '1';
  let startX=0;
  let dx=0;
  let isDown=false;
  let dragging=false;
  const THRESH=48; // px

  function onDown(e){
    isDown=true; dragging=false; dx=0;
    startX = (e.touches?e.touches[0].clientX:e.clientX);
    track.style.transition='none';
  }
  function onMove(e){
    if(!isDown) return;
    const x = (e.touches?e.touches[0].clientX:e.clientX);
    dx = x-startX;
    if(Math.abs(dx) > 6) dragging=true;
    if(!dragging) return;
    // prevent vertical scroll when swiping horizontally
    if(e.cancelable) e.preventDefault();
    const pct = (dx / Math.max(1, viewport.clientWidth)) * 100;
    track.style.transform = `translateX(calc(${-habitCarouselIndex*100}% + ${pct}%))`;
  }
  function onUp(){
    if(!isDown) return;
    isDown=false;
    track.style.transition='transform .22s ease';
    if(dragging && Math.abs(dx) > THRESH){
      setCarouselIndex(habitCarouselIndex + (dx<0 ? 1 : -1));
    }else{
      setCarouselIndex(habitCarouselIndex);
    }
  }

  viewport.addEventListener('touchstart', onDown, {passive:true});
  viewport.addEventListener('touchmove', onMove, {passive:false});
  viewport.addEventListener('touchend', onUp, {passive:true});
  viewport.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);

  // init position
  track.style.transition='transform .22s ease';
  setCarouselIndex(habitCarouselIndex);
}
// ---------- helpers ----------
function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function today(){return isoToday();}
function getMarkDate(){
  // If a date picker exists, use it. Otherwise default to today.
  return (markDate && markDate.value) ? markDate.value : today();
}

const HUE_PALETTE = [140, 260, 20, 200, 320, 80, 0, 170, 240, 300, 110, 30];

function habitHueFrom(id){
  let hash=0;
  for(let i=0;i<id.length;i++) hash=id.charCodeAt(i)+((hash<<5)-hash);
  return Math.abs(hash);
}

function ensureHabitHues(){
  const used = new Set(habits.map(h=>h.hue).filter(v=>typeof v==="number"));
  let changed = false;
  for(const h of habits){
    if(typeof h.hue !== "number"){
      // pick next unused palette hue; fallback to hashed palette slot
      let hue = null;
      for(const candidate of HUE_PALETTE){
        if(!used.has(candidate)){ hue=candidate; break; }
      }
      if(hue === null){
        hue = HUE_PALETTE[habitHueFrom(h.id)%HUE_PALETTE.length];
      }
      h.hue = hue;
      used.add(hue);
      changed = true;
    }
  }
  if(changed) save();
}

function habitHue(id){
  const h = habits.find(x=>x.id===id);
  if(h && typeof h.hue==="number") return h.hue;
  return HUE_PALETTE[habitHueFrom(id)%HUE_PALETTE.length];
}




function fmtWeekday(iso){
  const d=new Date(iso+"T00:00:00");
  return d.toLocaleDateString(undefined,{weekday:"short"});
}


function addHabitNamed(name, kind='positive'){
  const n = (name||"").trim();
  if(!n) return;
  kind = (kind === 'negative') ? 'negative' : 'positive';
  // Persist an explicit hue so the habit keeps a stable accent everywhere
  // (especially important in the transposed mobile grid).
  const used = new Set((habits||[]).map(h=>h.hue).filter(v=>typeof v==="number"));
  // Prefer an unused palette hue; if the palette is exhausted, generate a unique hue.
  let hue = null;
  for(const candidate of HUE_PALETTE){
    if(!used.has(candidate)){ hue = candidate; break; }
  }
  if(hue === null){
    // Deterministic-ish starting point based on name, then step until unique.
    let base = 0;
    for(let i=0;i<n.length;i++) base = (base*31 + n.charCodeAt(i)) % 360;
    hue = base;
    const STEP = 29;
    let guard = 0;
    while(used.has(hue) && guard < 400){
      hue = (hue + STEP) % 360;
      guard++;
    }
  }
  habits.push({id:crypto.randomUUID(), name:n, kind, created:today(), datesDone:[], hue});
  save();
  render();
  showToast(kind==='negative' ? "Negative habit added" : "Habit added");
}

// Ensure no two habits share the same hue. Keeps the first occurrence and reassigns duplicates.
function ensureUniqueHues(){
  const used = new Set();
  let changed = false;
  for(const h of (habits||[])){
    if(typeof h.hue !== "number") continue;
    if(!used.has(h.hue)){
      used.add(h.hue);
      continue;
    }
    // duplicate hue → pick next unused palette hue, else step through the hue wheel
    let next = null;
    for(const candidate of HUE_PALETTE){
      if(!used.has(candidate)){ next = candidate; break; }
    }
    if(next === null){
      next = (h.hue + 29) % 360;
      let guard = 0;
      while(used.has(next) && guard < 400){ next = (next + 29) % 360; guard++; }
    }
    h.hue = next;
    used.add(next);
    changed = true;
  }
  if(changed) save();
}

function openAddHabit(triggerEl){
  // Always open the modal (FAB is the single entry point)
  openAddHabitModal(triggerEl);
}

function openAddHabitModal(triggerEl){
  window.__lastAddHabitTrigger = triggerEl || window.__lastAddHabitTrigger || null;
  const modal = document.getElementById('addHabitModal');
  const input = document.getElementById('addHabitModalInput');
  if(!modal || !input){
    // Safe fallback
    const name = prompt('New habit name:');
    if(name===null) return;
    addHabitNamed(name);
    return;
  }

  // Button pop animation
  if(triggerEl && triggerEl.classList){
    triggerEl.classList.remove('pillPop');
    // force reflow to restart animation
    void triggerEl.offsetWidth;
    triggerEl.classList.add('pillPop');
  }

  // Make modal visible to assistive tech *before* moving focus into it.
  modal.classList.add('open');
  modal.removeAttribute('inert');
  modal.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('modalOpen');
  input.value = '';

  // Default to "positive" when opening.
  try{
    window.__addHabitKind = 'positive';
    const seg = document.getElementById('habitKindSeg');
    if(seg){
      const btns = Array.from(seg.querySelectorAll('[data-kind]'));
      btns.forEach(b=>{
        const k = b.getAttribute('data-kind');
        const active = (k === window.__addHabitKind);
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }
  }catch(_e){}

  setTimeout(()=>input.focus(), 60);
}

function closeAddHabitModal(){
  const modal = document.getElementById('addHabitModal');
  if(!modal) return;
  // Move focus OUT of the modal before hiding it to avoid aria-hidden warnings.
  const backTo = window.__lastAddHabitTrigger;
  if(backTo && backTo.focus) {
    try{ backTo.focus(); }catch(_e){}
  } else {
    try{ document.body && document.body.focus && document.body.focus(); }catch(_e){}
  }
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  modal.setAttribute('inert', '');
  document.documentElement.classList.remove('modalOpen');
}

function confirmAddHabitModal(){
  const input = document.getElementById('addHabitModalInput');
  if(!input) return;
  const name = (input.value || '').trim();
  if(!name){
    input.classList.remove('shake');
    void input.offsetWidth;
    input.classList.add('shake');
    input.focus();
    return;
  }
  const kind = (window.__addHabitKind === 'negative') ? 'negative' : 'positive';
  addHabitNamed(name, kind);
  closeAddHabitModal();
}


function toggleHabitAt(id, iso, opts={}){
  const h = habits.find(x=>x.id===id);
  if(!h) return;
  h.datesDone = h.datesDone || [];
  const idx = h.datesDone.indexOf(iso);
  let nowDone;
  if(idx>=0){
    h.datesDone.splice(idx,1);
    nowDone = false;
    showToast(habitKind(h)==='negative' ? "Marked as slipped" : "Marked as missed");
  }else{
    h.datesDone.push(iso);
    h.datesDone.sort();
    nowDone = true;
    showToast(habitKind(h)==='negative' ? "Marked avoided" : "Marked done");
  }
  lastPulse = { hid: id, iso, mode: nowDone ? "done" : "miss" };
  save();

  // Preserve scroll positions for a smoother feel (both matrix + page)
  const wrap = document.querySelector('.matrixWrap');
  const scroll = wrap ? {top:wrap.scrollTop, left:wrap.scrollLeft} : null;
  const pageScrollY = window.scrollY;

  render();

  if(opts && opts.preserveScroll){
    requestAnimationFrame(()=>{
      const w = document.querySelector('.matrixWrap');
      if(w && scroll){ w.scrollTop = scroll.top; w.scrollLeft = scroll.left; }
      // prevent "jump to top" after re-render
      window.scrollTo({ top: pageScrollY, left: 0, behavior: 'auto' });
    });
  }
  return nowDone;
}


function streakFor(h){
  const dates=(h.datesDone||[]).slice().sort();
  const set=new Set(dates);
  const end=getMarkDate();
  let current=0;
  let d=new Date(end);
  while(true){
    const iso=d.toISOString().slice(0,10);
    if(set.has(iso)){ current++; d.setDate(d.getDate()-1); }
    else break;
  }
  let best=0, cur=0;
  const now=new Date();
  for(let i=365;i>=0;i--){
    const dd=new Date(now); dd.setDate(dd.getDate()-i);
    const iso=dd.toISOString().slice(0,10);
    if(set.has(iso)){ cur++; best=Math.max(best,cur); } else cur=0;
  }
  return {current,best};
}

function completionRate(days){
  const endIso = getMarkDate();
  const end = new Date(endIso+"T00:00:00");
  const start = new Date(end);
  start.setDate(end.getDate()-(days-1));

  const total = habits.length * days;
  if(total<=0) return 0;

  let done = 0;
  for(const h of habits){
    const set = new Set(h.datesDone||[]);
    for(let i=0;i<days;i++){
      const d=new Date(start);
      d.setDate(start.getDate()+i);
      const iso=d.toISOString().slice(0,10);
      if(set.has(iso)) done++;
    }
  }
  return Math.round((done/total)*100);
}

// Mini GitHub-style heatmap: last 28 days (4 weeks)
// 5 levels based on *consecutive* completions ending on each day (caps at 4).
function miniHeatHtml(h){
  const days=28;
  const now=new Date(today()+"T00:00:00");
  const set=new Set(h.datesDone||[]);
  const cells=[];
  let streak=0;

  // We render oldest -> newest so streak is meaningful.
  for(let i=days-1;i>=0;i--){
    const d=new Date(now); d.setDate(now.getDate()-i);
    const iso=d.toISOString().slice(0,10);
    const on=set.has(iso);

    streak = on ? Math.min(4, streak+1) : 0; // 0..4
    const level = streak;

    // map level -> percent of accent used in color-mix (deterministic, non-random)
    const PCTS = [8, 22, 38, 56, 78];
    const heatP = PCTS[level];

    const accent = `hsl(${habitHue(h.id)} 70% 55%)`;
    cells.push(
      `<div class="miniCell" title="${iso}" style="--habitAccent:${accent};--heatP:${heatP}%"></div>`
    );
  }

  return `
    <div class="miniHeatWrap">
      <div class="miniHeat">${cells.join("")}</div>
      <div class="miniHeatLegend">
        <span class="dot l0"></span><span class="dot l1"></span><span class="dot l2"></span><span class="dot l3"></span><span class="dot l4"></span>
        <span class="label">last 4 weeks</span>
      </div>
    </div>
  `;
}


// ---------- Analytics (Matrix) ----------


function renderAnalytics(){
  const card = document.getElementById("habitAnalytics");
  if(!card) return;
  const H = getFilteredHabits();

  // Keep the body + header toggles in sync even when we re-render ONLY the analytics card
  // (e.g. when navigating periods). Otherwise, list mode can appear "blank".
  const currentViewMode = getCurrentViewMode();
  document.body.classList.toggle("habitsViewList", currentViewMode === "list");

  // Shared: hold-to-delete (2.5s) for habit labels (desktop header + mobile sticky column)
  function bindHoldToDelete(labelEl, habit){
    if(!labelEl || !habit) return;
    // Avoid double-binding on rerenders
    if(labelEl.dataset.holdBound === "1") return;
    labelEl.dataset.holdBound = "1";

    let holdTimer = null;
    let raf = null;
    let holdStart = 0;
    const HOLD_MS = 2500;

    function clearHold(){
      if(holdTimer){ clearTimeout(holdTimer); holdTimer = null; }
      if(raf){ cancelAnimationFrame(raf); raf = null; }
      labelEl.classList.remove("holding");
      labelEl.style.removeProperty("--hold");
    }

    function tick(){
      const t = Math.min(1, (performance.now() - holdStart) / HOLD_MS);
      labelEl.style.setProperty("--hold", String(t));
      if(t < 1) raf = requestAnimationFrame(tick);
    }

    labelEl.addEventListener("pointerdown", (ev)=>{
      if(ev.button != null && ev.button !== 0) return;
      holdStart = performance.now();
      labelEl.classList.add("holding");
      tick();
      holdTimer = setTimeout(()=>{
        clearHold();
        habits = (habits||[]).filter(x=>x.id!==habit.id);
        save();
        showToast("Habit removed");
        render();
      }, HOLD_MS);
    });
    ["pointerup","pointercancel","pointerleave"].forEach(evt=>{
      labelEl.addEventListener(evt, clearHold);
    });
  }

  
  const isMobile = window.matchMedia && window.matchMedia("(max-width: 900px)").matches;

  // Map views to window sizes. We keep ranges bounded for performance.
  function getAnalyticsConfig(view){
    const v = (view||"").toLowerCase();
    if(v === "week") return { key:"week", range:7, step:7, dir:"backward" };
    // Month/Year are calendar-based; range is computed from bounds, step is in months/years.
    if(v === "month") return { key:"month", range:31, step:1, dir:"calendar" };
    if(v === "year") return { key:"year", range:366, step:1, dir:"calendar" };

    // All time: from earliest mark we have, capped.
    let earliest = null;
    (habits||[]).forEach(h=>{
      (h.datesDone||[]).forEach(iso=>{
        if(!earliest || iso < earliest) earliest = iso;
      });
    });
    const todayIso = today();
    let days = 60;
    if(earliest){
      const a = new Date(earliest+"T00:00:00");
      const b = new Date(todayIso+"T00:00:00");
      days = Math.max(7, Math.floor((b - a) / 86400000) + 1);
    }
    days = Math.min(days, 730); // cap to ~2 years for UI/perf
    return { key:"all", range:days, step:30, dir:"backward" };
  }

  // Normalize stored value
  if(!["week","month","year","all"].includes(analyticsView)) analyticsView = "month";

  const cfg = getAnalyticsConfig(analyticsView);
  // Sync current offset from per-view storage
  analyticsOffsetDays = Number(analyticsOffsets[analyticsView]) || 0;

  // For week/month/year we use calendar bounds (month/year) and rolling bounds (week).
  // On mobile, we still render a 7-day viewport, but bounds/range labels remain correct.
  let dates = [];
  let range = cfg.range;
  if(analyticsView === "all"){
    range = isMobile ? Math.min(7, cfg.range) : cfg.range;
    dates = rangeDates(range, analyticsOffsetDays, cfg.dir);
  }else{
    // On small screens, "Week" should be a calendar week that starts on Monday.
    // Desktop keeps the rolling 7-day window behavior.
    let bounds;
    if(isMobile && analyticsView === "week"){
      const weekOffset = Math.round((analyticsOffsetDays||0) / 7);
      const base = new Date();
      base.setDate(base.getDate() + weekOffset*7);
      bounds = getMondayWeekBounds(base);
    }else{
      bounds = getBoundsForView(analyticsView, analyticsOffsetDays);
    }
    dates = datesFromBounds(bounds);
    range = dates.length;
    // On small screens, Month is a true calendar view (show the whole month grid),
    // while Year keeps a compact viewport for performance.
    if(isMobile && analyticsView === "year") dates = dates.slice(Math.max(0, dates.length-7));
  }

  const step  = (analyticsView === "week" || analyticsView === "all")
    ? (isMobile ? 7 : cfg.step)
    : cfg.step;
  const offsetLabel = (analyticsView==="month")
    ? (analyticsOffsetDays===0 ? "This month" : (analyticsOffsetDays>0 ? `+${analyticsOffsetDays}m` : `${analyticsOffsetDays}m`))
    : (analyticsView==="year")
      ? (analyticsOffsetDays===0 ? "This year" : (analyticsOffsetDays>0 ? `+${analyticsOffsetDays}y` : `${analyticsOffsetDays}y`))
      : (analyticsOffsetDays===0 ? "Today" : (analyticsOffsetDays>0 ? `+${analyticsOffsetDays}d` : `${analyticsOffsetDays}d`));
  // Range label
  let rangeLabel = (() => {
    // Premium English range label (Week/All), e.g. "Feb 5 – Feb 11" (optionally with year)
    try {
      const start = dates[0];
      const end = dates[dates.length-1];
      const nowY = (new Date()).getFullYear();
      const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
      const base = `${fmt.format(start)} – ${fmt.format(end)}`;
      const y = start.getFullYear();
      const y2 = end.getFullYear();
      if (y !== y2) return `${base}, ${y}–${y2}`;
      if (y !== nowY) return `${base}, ${y}`;
      return base;
    } catch (_) {
      return `${fmtDowShortMD(dates[0])} - ${fmtDowShortMD(dates[dates.length-1])}`;
    }
  })();
  try{
    if(analyticsView === "month"){
      const b = getBoundsForView("month", analyticsOffsetDays);
      rangeLabel = new Intl.DateTimeFormat(undefined,{ month:"long", year:"numeric" }).format(b.start);
    }else if(analyticsView === "year"){
      const b = getBoundsForView("year", analyticsOffsetDays);
      rangeLabel = String(b.start.getFullYear());
    }
  }catch(_){ /* keep fallback */ }
  const segIndex = ({ week:0, month:1, year:2, all:3 })[analyticsView] ?? 0;

  // Overall (shared) underline bar stats
  let achievedPct = 0;
  if(analyticsView === 'all'){
    // True lifetime % (from each habit's first tracked day -> today)
    const tIso = today();
    let totalEligible = 0;
    let totalDone = 0;
    (H||[]).forEach(h=>{
      const createdIso = (h && typeof h.created==='string' && h.created.length===10) ? h.created : tIso;
      const earliestIso = ((h.datesDone||[]).concat([createdIso]).sort()[0]) || createdIso;
      const startD = new Date(earliestIso+'T00:00:00');
      const endD = new Date(tIso+'T00:00:00');
      let eligible = Math.floor((endD-startD)/86400000)+1;
      if(!Number.isFinite(eligible) || eligible < 0) eligible = 0;
      const done = countDoneInBounds(h, { start:startD, end:endD });
      totalEligible += eligible;
      totalDone += done;
    });
    achievedPct = Math.round((totalDone / Math.max(1,totalEligible)) * 100);
  } else {
    const totalCells = Math.max(1, (H||[]).length * (dates||[]).length);
    let doneCells = 0;
    (H||[]).forEach(h=>{
      const set = new Set(h.datesDone||[]);
      (dates||[]).forEach(iso=>{ if(set.has(iso)) doneCells++; });
    });
    achievedPct = Math.round((doneCells / totalCells) * 100);
  }

  let deltaPct = 0;
  let hasDelta = analyticsView !== "all";
  if(hasDelta){
    // Keep comparisons consistent with the rendered dates.
    let curBounds;
    let prevBounds;
    if(isMobile && analyticsView === "week"){
      const weekOffset = Math.round((analyticsOffsetDays||0) / 7);
      const base = new Date();
      base.setDate(base.getDate() + weekOffset*7);
      curBounds = getMondayWeekBounds(base);
      const prevStart = new Date(curBounds.start);
      prevStart.setDate(prevStart.getDate() - 7);
      const prevEnd = new Date(curBounds.end);
      prevEnd.setDate(prevEnd.getDate() - 7);
      prevBounds = { start: prevStart, end: prevEnd };
    }else{
      curBounds = getPeriodBounds(analyticsView, analyticsOffsetDays);
      prevBounds = shiftPeriod(curBounds, analyticsView);
    }
    const curDates = datesFromBounds({ start: curBounds.start, end: curBounds.end });
    const prevDates = datesFromBounds({ start: prevBounds.start, end: prevBounds.end });
    const curTotal = Math.max(1, (H||[]).length * curDates.length);
    const prevTotal = Math.max(1, (H||[]).length * prevDates.length);
    let curDone = 0;
    let prevDone = 0;
    (H||[]).forEach(h=>{
      const set = new Set(h.datesDone||[]);
      curDates.forEach(iso=>{ if(set.has(iso)) curDone++; });
      prevDates.forEach(iso=>{ if(set.has(iso)) prevDone++; });
    });
    const curP = (curDone / curTotal) * 100;
    const prevP = (prevDone / prevTotal) * 100;
    deltaPct = Math.round(curP - prevP);
  }
  const deltaAbs = Math.min(100, Math.abs(deltaPct));
  const isUp = deltaPct >= 0;

  card.innerHTML = `
    <div class="habitsHeader">
      <div class="habitsHeaderRow1">
        <div class="seg segWide habitsRangeSeg" role="tablist" aria-label="Habits range" style="--seg-index:${segIndex}">
          <div class="segIndicator" aria-hidden="true"></div>
          <button class="segBtn ${analyticsView==="week"?"active":""}" data-view="week" type="button">Week</button>
          <button class="segBtn ${analyticsView==="month"?"active":""}" data-view="month" type="button">Month</button>
          <button class="segBtn ${analyticsView==="year"?"active":""}" data-view="year" type="button">Year</button>
          <button class="segBtn ${analyticsView==="all"?"active":""}" data-view="all" type="button">All Time</button>
        </div>
        <button class="btn secondary habitsAddBtn" id="addHabitDesktop" type="button">+ Add Habit</button>
      </div>

      <div class="habitsHeaderRow2">
        <div class="habitsDateSlot">
          <div class="habitsDateRow" id="habitsDateRow">
            <button class="btn ghost navBtn" id="calPrev" type="button" aria-label="Previous">‹</button>
            <div class="rangeLabel" id="rangeLabel">${rangeLabel}</div>
            <button class="btn ghost navBtn" id="calNext" type="button" aria-label="Next">›</button>
          </div>

          <!-- Month list panel: replaces the date row when the list icon is pressed (Month view only). -->
          <div class="monthInline" id="monthInline" aria-hidden="true">
            <div class="monthInlineHeader">
              <div class="monthInlineTitle">This month</div>
              <button class="iconBtn" id="monthInlineClose" type="button" aria-label="Close">✕</button>
            </div>
            <div class="monthInlineBody" id="monthInlineBody"></div>
          </div>
        </div>
        <div class="habitsRightControls">
          <div class="viewToggles" aria-label="View">
            <!-- Grid icon: 2 columns x 3 rows (6 cells) -->
            <button class="tabBtn ${getCurrentViewMode()==="grid"?"active":""}" data-settab="grid" type="button" aria-label="Grid view" title="Grid view">
              <span class="tabIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="4" width="6" height="5" rx="1.4" stroke="currentColor" stroke-width="2"/>
                  <rect x="13" y="4" width="6" height="5" rx="1.4" stroke="currentColor" stroke-width="2"/>
                  <rect x="5" y="9.5" width="6" height="5" rx="1.4" stroke="currentColor" stroke-width="2"/>
                  <rect x="13" y="9.5" width="6" height="5" rx="1.4" stroke="currentColor" stroke-width="2"/>
                  <rect x="5" y="15" width="6" height="5" rx="1.4" stroke="currentColor" stroke-width="2"/>
                  <rect x="13" y="15" width="6" height="5" rx="1.4" stroke="currentColor" stroke-width="2"/>
                </svg>
              </span>
            </button>
            <!-- List icon: 3 lines with different lengths (short / medium / long) -->
            <button class="tabBtn ${getCurrentViewMode()==="list"?"active":""}" data-settab="list" type="button" aria-label="List view" title="List view">
              <span class="tabIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M6 7h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M6 17h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </span>
            </button>
          </div>
        </div>
      </div>

      <div class="overallTrend ${hasDelta ? (isUp?"up":"down") : "neutral"}">
        <div class="trendMeta">
          ${hasDelta ? `<span class="trendDelta">${isUp?"Up":"Down"} ${deltaAbs}% from the period before</span>` : `<span class="trendDelta">All-time view</span>`}
        </div>
        <div class="trendBar" aria-hidden="true"><div class="trendFill" style="width:${deltaAbs}%"></div></div>
        <div class="trendAchieved"><b>${achievedPct}%</b> achieved</div>
      </div>
    </div>

    <div class="matrixWrap"><div class="matrixGrid" id="matrixGrid"></div></div>

    <!-- List view renders INSIDE the analytics card (below the header) to match the Dribbble demo. -->
    <div class="listInGrid" id="habitList" aria-label="Habits list"></div>

    <!-- Month list panel renders inside the header area (replaces the date row). -->

    <div class="matrixHelp">
      <div class="matrixHint">Tip: hold then drag to paint. Hold a habit name for 2.5s to remove it.</div>
    </div>
  `;

  const grid = card.querySelector("#matrixGrid");
  const monthInline = card.querySelector("#monthInline");
  const monthInlineBody = card.querySelector("#monthInlineBody");
  const monthInlineTitle = card.querySelector(".monthInlineTitle");
  const monthInlineClose = card.querySelector("#monthInlineClose");
  const habitsDateRow = card.querySelector("#habitsDateRow");

  function setMonthInline(open){
    if(!monthInline) return;
    monthInline.classList.toggle("open", !!open);
    monthInline.setAttribute("aria-hidden", open ? "false" : "true");
    if(habitsDateRow) habitsDateRow.classList.toggle("hidden", !!open);
  }

  if(monthInlineClose){
    monthInlineClose.addEventListener("click", ()=>setMonthInline(false));
  }

  // Desktop Add Habit button (FAB handles mobile)
  const addBtn = card.querySelector("#addHabitDesktop");
  if(addBtn){
    addBtn.addEventListener("click", (e)=>{
      e.preventDefault();
      try{ openAddHabit(addBtn); }catch(_){ }
    });
  }

  // View toggles (grid / list)
  // Requirement: the calendar grid and the list must be mutually exclusive.
  // The list icon should ALWAYS switch to list mode (and hide the calendar),
  // even in Month view.
  card.querySelectorAll("[data-settab]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const t = (btn.getAttribute("data-settab") || "grid").toLowerCase();
      // Always close the Month inline panel when switching modes.
      setMonthInline(false);
      setHabitsViewMode(t);
    });
  });

  // view toggle
  card.querySelectorAll("[data-view]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const v = btn.dataset.view;
      if(!v || v===analyticsView) return;
      analyticsView = v;
      localStorage.setItem("habitsAnalyticsView", analyticsView);
      // Leaving Month view closes the drawer.
      if(analyticsView !== "month") setMonthInline(false);
      // Reset offset when switching views so we start from the current period.
      analyticsOffsets[analyticsView] = 0;
      saveAnalyticsOffsets();
      analyticsOffsetDays = 0;
      renderAnalytics();
      renderListInAnalytics();
    });
  });

  // calendar navigation (All-time uses years accordion instead)
  const prevBtn = card.querySelector("#calPrev");
  const nextBtn = card.querySelector("#calNext");
  const rangeEl = card.querySelector("#rangeLabel");
  if(analyticsView === 'all'){
    if(rangeEl) rangeEl.textContent = 'All time';
    [prevBtn,nextBtn].forEach(b=>{
      if(!b) return;
      b.disabled = true;
      b.classList.add('disabled');
    });
  } else {
    prevBtn?.addEventListener("click", ()=>{
      analyticsOffsetDays -= step;
      analyticsOffsets[analyticsView] = analyticsOffsetDays;
      saveAnalyticsOffsets();
      renderAnalytics();
      renderListInAnalytics();
    });
    nextBtn?.addEventListener("click", ()=>{
      analyticsOffsetDays += step;
      analyticsOffsets[analyticsView] = analyticsOffsetDays;
      saveAnalyticsOffsets();
      renderAnalytics();
      renderListInAnalytics();
    });
  }
  // "Today" button removed by request. Keep null-safe logic in case older markup exists.
  const todayBtn = card.querySelector("#calToday");
  if(todayBtn){
    todayBtn.addEventListener("click", ()=>{
      // On phone we want a clean "today → next 7 days" view.
      if(isMobile){
        analyticsView = "week";
        localStorage.setItem("habitsAnalyticsView", analyticsView);
      }
      analyticsOffsetDays = 0;
      analyticsOffsets[analyticsView] = analyticsOffsetDays;
      saveAnalyticsOffsets();
      // legacy key no longer used
      window.__resetMatrixScroll = true;
      renderAnalytics();
      renderListInAnalytics();
    });
  }

  // Primary add habit action lives in the floating button (bound once globally)

  if(!H || H.length===0){
    grid.innerHTML = '<p class="empty">Add a habit to see analytics.</p>';
    return;
  }

  // Dates are computed above based on the selected view.


  const todayIso = today();

  // ------------------------
  // Month calendar view (Dribbble-style)
  // ------------------------
  const viewMode = getCurrentViewMode();
  if(analyticsView === "month" && viewMode === "grid"){
    const bounds = getBoundsForView("month", analyticsOffsetDays);
    // Defensive: ensure the calendar grid is strictly the selected month (no spillover days like 31st from prev month).
    const b0 = new Date(bounds.start);
    const y = b0.getFullYear();
    const m = b0.getMonth();
    const monthStart = utcDate(y, m, 1);
    const monthEnd = utcDate(y, m+1, 0);
    const monthDates = datesFromBounds({ start: monthStart, end: monthEnd });
    const daysInMonth = monthDates.length;

    // Label the drawer with the month name.
    try{
      const m = new Date(monthStart);
      const monthLabel = new Intl.DateTimeFormat(undefined,{month:"long", year:"numeric"}).format(m);
      if(monthInlineTitle) monthInlineTitle.textContent = monthLabel;
    }catch(e){
      if(monthInlineTitle) monthInlineTitle.textContent = "This month";
    }

    // Render calendar grid (Mon..Sun) with daily completion %.
    const weekdayNames = (()=>{
      // Always Monday-first to match the rest of the app.
      const base = new Date("2020-06-01T00:00:00"); // Monday
      const names = [];
      for(let i=0;i<7;i++){
        const d = new Date(base);
        d.setDate(base.getDate()+i);
        try{ names.push(new Intl.DateTimeFormat(undefined,{weekday:"narrow"}).format(d)); }
        catch(_){ names.push(["M","T","W","T","F","S","S"][i]); }
      }
      return names;
    })();

    function pctForIso(iso){
      const total = Math.max(1, H.length);
      let done = 0;
      for(const h of H){
        if((h.datesDone||[]).includes(iso)) done++;
      }
      return Math.round((done/total)*100);
    }


    function getMonthCols(){
      const w = window.innerWidth || 9999;
      if(w <= 420) return 3;
      if(w <= 720) return 4;
      return 7;
    }
    // Calendar start offset (Mon=0..Sun=6)
    const cols = getMonthCols();
    const first = new Date(monthStart);
    const offset = (cols === 7) ? ((first.getDay() + 6) % 7) : 0;

    let html = '<div class="monthCal" role="grid" aria-label="Month calendar">';
    html += '<div class="monthCalDow" aria-hidden="true">' + weekdayNames.map(n=>`<div class="dow">${escapeHtml(n)}</div>`).join('') + '</div>';
    html += '<div class="monthCalGrid">';
    for(let i=0;i<offset;i++) html += '<div class="calCell empty" aria-hidden="true"></div>';
        let dayIndex = 0;
for(const iso of monthDates){
      const day = Number(iso.slice(8,10));
      const pct = pctForIso(iso);
      const isToday = iso === todayIso;
      const isWeekend = isWeekendIso(iso);
      const isSelected = (monthSelectedIso === iso);
      const pctCls = (pct===0) ? "isZero" : (pct<35 ? "isLow" : "");
      const bar = `hsl(${(pct*120)/100}, 88%, 55%)`;
      const glow = `hsla(${(pct*120)/100}, 92%, 58%, .70)`;
      html += `
        <button class="calCell calDayCard ${isToday?"today":""} ${isWeekend?"weekend":""} ${isSelected?"selected":""} ${pctCls}" type="button" data-iso="${iso}" aria-label="${iso}, ${pct}%" style="--barColor:${bar}; --glowColor:${glow}; --delay:${(dayIndex++)*35}ms;">
          <span class="shine" aria-hidden="true"></span>
          <div class="calTop">
            <div class="calNum">${day}</div>
          </div>
          <div class="calPctRow">
            <div class="calPctNum" data-target="${pct}">0%</div>
          </div>
          <div class="calBar" aria-hidden="true">
            <div class="calFill" style="width:${pct}%"></div>
          </div>
        </button>
      `;
    }
    html += '</div></div>';
    grid.innerHTML = html;

    // Animate % count-up for month cards (respects reduced motion).
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(!reduceMotion){
      grid.querySelectorAll('.calCell .calPctNum[data-target]').forEach(el=>{
        const to = Number(el.getAttribute('data-target')||'0')||0;
        const duration = 650;
        const start = performance.now();
        function tick(now){
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          const val = Math.round(to * eased);
          el.textContent = val + '%';
          if(t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    }else{
      grid.querySelectorAll('.calCell .calPctNum[data-target]').forEach(el=>{
        el.textContent = (el.getAttribute('data-target')||'0') + '%';
      });
    }

    // Click a day → open details modal + set selected state
    grid.querySelectorAll('.calCell[data-iso]').forEach(btn=>{
      btn.addEventListener('click', ()=> openDayDetails(btn.dataset.iso));
    });

    // Render month drawer content: habits + count of checked days in this month.
    if(monthInlineBody){
      const rows = (H||[]).map(h=>{
        const done = countDoneInBounds(h, { start: monthStart, end: monthEnd });
        const pct = Math.round((done / Math.max(1, daysInMonth)) * 100);
        const hue = habitHue(h.id);
        return `
          <div class="monthHabitRow" style="--habit-accent:hsl(${hue} 70% 55%)">
            <div class="mhrLeft">
              <div class="mhrName">${escapeHtml(h.name)}</div>
              <div class="mhrMeta">${done}/${daysInMonth} days</div>
            </div>
            <div class="mhrRight">
              <div class="mhrBar" aria-hidden="true"><div class="mhrFill" style="width:${pct}%"></div></div>
              <div class="mhrPct">${pct}%</div>
            </div>
          </div>
        `;
      }).join('');
      monthInlineBody.innerHTML = rows || '<div class="empty">No habits yet.</div>';
    }

    // Month calendar is view-only; hide paint hint.
    const help = card.querySelector('.matrixHelp');
    if(help) help.style.display = 'none';
    return;
  }


  // ------------------------
  // Year heatmap (per habit)
  // ------------------------
  if(analyticsView === "year" && viewMode === "grid"){
    renderYearHeatmap(grid, card, H, analyticsOffsetDays);
    return;
  }

  // ------------------------
  // All-time: collapsible years (per habit)
  // ------------------------
  if(analyticsView === "all" && viewMode === "grid"){
    renderAllTimeYearsGrid(grid, card, H);
    return;
  }

  // ------------------------
  // Desktop: dates (rows) x habits (cols)
  // Mobile:  habits (rows) x dates (cols) with 7-day viewport + swipe paging
  // ------------------------

  if(!isMobile){
    const dateCol = 190;
    // compute cell size to fill available width when there are few H
    const wrapEl = card.querySelector(".matrixWrap");
    const wrapW = wrapEl?.clientWidth || 360;
    const gap = 8;
    const maxCell = 74;
    const minCell = 44;
    const avail = Math.max(0, wrapW - dateCol - gap*(H.length+1));
    const cell = Math.max(minCell, Math.min(maxCell, Math.floor(avail / Math.max(1, H.length))));
    // Set sizing vars on both the grid and its scroll wrapper.
    // The wrapper uses these to paint a subtle background strip behind the sticky date column.
    grid.style.setProperty("--dateCol", dateCol+"px");
    grid.style.setProperty("--cell", cell+"px");
    wrapEl?.style.setProperty("--dateCol", dateCol+"px");
    wrapEl?.style.setProperty("--cell", cell+"px");

    const colTemplate = `var(--dateCol) repeat(${H.length}, var(--cell))`;

    // header row
    const header = document.createElement("div");
    header.className = "matrixHeaderRow";
    header.style.gridTemplateColumns = colTemplate;

    const corner = document.createElement("div");
    corner.className = "matrixCorner";
    corner.innerHTML = `
      <div class="mcLabel">DATES: 2026</div>
      <div class="mcRange">
        <span>${fmtMonthDay(dates[0])}</span>
        <span class="mcSep">–</span>
        <span>${fmtMonthDay(dates[dates.length-1])}</span>
      </div>
    `;
    header.appendChild(corner);

    H.forEach(h=>{
      const el = document.createElement("div");
      el.className = "matrixHabit";
      el.style.setProperty("--habit-accent", `hsl(${habitHue(h.id)} 70% 55%)`);
      el.title = h.name;
      el.innerHTML = `<span>${escapeHtml(h.name)}</span><div class="holdBar" aria-hidden="true"></div>`;

      bindHoldToDelete(el, h);

      header.appendChild(el);
    });

    grid.appendChild(header);
    requestAnimationFrame(()=>adaptDayLabels(header));

    // rows
    dates.forEach(iso=>{
      const row = document.createElement("div");
      row.className = "matrixRow" + (iso===todayIso ? " today" : "");
      row.style.gridTemplateColumns = colTemplate;

      const dateEl = document.createElement("div");
      dateEl.className = "matrixDate";
      dateEl.innerHTML = `<div class="d1">${fmtMonthDay(iso)}</div><div class="d2">${fmtWeekday(iso)}</div>`;
      row.appendChild(dateEl);

      H.forEach(h=>{
        const cell = document.createElement("div");
        cell.className = "matrixCell";
        cell.style.setProperty("--habit-accent", `hsl(${habitHue(h.id)} 70% 55%)`);

        const set = new Set(h.datesDone||[]);
        const done = set.has(iso);
        if(done) cell.classList.add("done");
        else if(iso < todayIso) cell.classList.add("missed");

        if(lastPulse && lastPulse.hid===h.id && lastPulse.iso===iso){
          cell.classList.add("justChanged");
          if(lastPulse.mode==="miss") cell.classList.add("pulseMiss");
        }
        cell.dataset.hid = h.id;
        cell.dataset.iso = iso;
        row.appendChild(cell);
      });

      grid.appendChild(row);
    });
  } else {
    // Mobile: Dribbble-style weekly list (circles)
    grid.classList.add('mobileWeekTable');
    grid.innerHTML = '';

    // Day-of-week header (S M T W T F S)
    const head = document.createElement('div');
    head.className = 'mwtHead';
    const dowRow = document.createElement('div');
    dowRow.className = 'mwtDowRow';
    (dates||[]).forEach(iso=>{
      const d = new Date(iso+"T00:00:00");
      let w = '';
      try{ w = new Intl.DateTimeFormat(undefined,{weekday:'narrow'}).format(d); }
      catch(_){ w = ['S','M','T','W','T','F','S'][d.getDay()] || ''; }
      const c = document.createElement('div');
      c.className = 'mwtDow';
      c.textContent = String(w).toUpperCase();
      dowRow.appendChild(c);
    });
    // fraction spacer
    dowRow.appendChild(Object.assign(document.createElement('div'), { className: 'mwtFracHead' }));
    head.appendChild(dowRow);
    grid.appendChild(head);

    // Habit rows
    (H||[]).forEach(h=>{
      const row = document.createElement('div');
      row.className = 'mwtRow';
      row.style.setProperty('--habit-accent', `hsl(${habitHue(h.id)} 70% 55%)`);

      const left = document.createElement('div');
      left.className = 'mwtLabel';
      left.title = h.name;
      left.innerHTML = `
        <span class="mwtDot" aria-hidden="true"></span>
        <span class="mwtName">${escapeHtml(h.name)}</span>
      `;
      bindHoldToDelete(left, h);
      row.appendChild(left);

      const cellsWrap = document.createElement('div');
      cellsWrap.className = 'mwtCells';

      const set = new Set(h.datesDone||[]);
      let doneCount = 0;

      (dates||[]).forEach(iso=>{
        const cell = document.createElement('div');
        cell.className = 'mwtCell matrixCell';
        cell.style.setProperty('--habit-accent', `hsl(${habitHue(h.id)} 70% 55%)`);
        const done = set.has(iso);
        if(done){ cell.classList.add('done'); doneCount++; }
        else if(iso < todayIso) cell.classList.add('missed');
        if(lastPulse && lastPulse.hid===h.id && lastPulse.iso===iso){
          cell.classList.add('justChanged');
          if(lastPulse.mode==='miss') cell.classList.add('pulseMiss');
        }
        cell.dataset.hid = h.id;
        cell.dataset.iso = iso;
        cellsWrap.appendChild(cell);
      });

      // Right-side mini fraction (e.g., 3/6)
      const frac = document.createElement('div');
      frac.className = 'mwtFrac';
      frac.textContent = `${doneCount}/${Math.max(1,(dates||[]).length)}`;
      cellsWrap.appendChild(frac);

      row.appendChild(cellsWrap);

      grid.appendChild(row);
    });

    // Mobile weekly list doesn't need the swipe pager on the matrix wrapper.
    const wrap = card.querySelector('.matrixWrap');
    if(wrap) wrap.dataset.swipeBound = '1';
  }

  // If user tapped "Today", ensure the viewport starts from the first day.
  const wrapEl = card.querySelector('.matrixWrap');
  if(wrapEl && window.__resetMatrixScroll){
    wrapEl.scrollLeft = 0;
    wrapEl.scrollTop = 0;
    window.__resetMatrixScroll = false;
  }

  // interactions: tap to toggle, hold then drag to paint
  let dragging = false;
  let dragStarted = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragHoldTimer = null;
  let dragPrimed = false;
  let dragStartCell = null;
  const DRAG_HOLD_MS = 380; // must hold this long before painting
  let targetDone = true;
  let touched = new Set();
  let dirty = false;

  function applyCell(cell){
    if(!cell) return;
    const hid = cell.dataset.hid;
    const iso = cell.dataset.iso;
    const key = hid + "|" + iso;
    if(touched.has(key)) return;
    touched.add(key);

    const h = H.find(x=>x.id===hid);
    if(!h) return;

    const set = new Set(h.datesDone||[]);
    const already = set.has(iso);

    if(targetDone){
      if(!already){
        set.add(iso);
        h.datesDone = Array.from(set).sort();
        dirty = true;
      }
      cell.classList.add("done");
      cell.classList.remove("missed");
    }else{
      if(already){
        set.delete(iso);
        h.datesDone = Array.from(set).sort();
        dirty = true;
      }
      cell.classList.remove("done");
      if(iso < todayIso) cell.classList.add("missed");
    }

    // one-shot micro animation on paint toggle
    cell.classList.add("justChanged");
    if(!targetDone) cell.classList.add("pulseMiss");
    setTimeout(()=>cell.classList.remove("justChanged","pulseMiss"), 280);
  }

  function endDrag(e){
    if(dragHoldTimer){ clearTimeout(dragHoldTimer); dragHoldTimer = null; }

    // If we never entered paint mode, treat this as a tap toggle (desktop-safe).
    if(dragPrimed && !dragStarted && dragStartCell){
      toggleHabitAt(dragStartCell.dataset.hid, dragStartCell.dataset.iso, {preserveScroll:true});
    }

    dragPrimed = false;
    dragStartCell = null;

    // When painting via drag, we mutate in-memory habit dates and update only the grid cells.
    // We still need to refresh the rest of the UI (e.g., the "Today" list cards) so the
    // completion state matches what was painted.
    if(dirty){
      save();

      // Preserve scroll positions for a smoother feel (both matrix + page)
      const wrap = document.querySelector('.matrixWrap');
      const scroll = wrap ? {top:wrap.scrollTop, left:wrap.scrollLeft} : null;
      const pageScrollY = window.scrollY;

      render();

      requestAnimationFrame(()=>{
        const w = document.querySelector('.matrixWrap');
        if(w && scroll){ w.scrollTop = scroll.top; w.scrollLeft = scroll.left; }
        window.scrollTo({ top: pageScrollY, left: 0, behavior: 'auto' });
      });
    }
    dirty = false;
    touched = new Set();
    dragging = false;
    setTimeout(()=>{ dragStarted = false; }, 0);
  }

  grid.addEventListener("pointerdown", (e)=>{
    const cell = e.target.closest(".matrixCell");
    if(!cell) return;

    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStarted = false;
    dragging = false;
    dragPrimed = true;
    dragStartCell = cell;
    touched = new Set();
    dirty = false;

    // Respect the user's current paint mode:
    // - mark: always color/mark cells as done
    // - erase: always remove/clear done marks
    // Pull the latest mode from storage in case it was changed without reloading.

    let storedMode = null;
    try{
      const m = localStorage.getItem("habitsAnalyticsPaintMode");
      storedMode = (m==="mark"||m==="erase") ? m : null;
    }catch(_e){}
    analyticsPaintMode = storedMode;

    // If no explicit mode is set, choose based on the starting cell:
    // - start on empty -> mark
    // - start on done  -> erase
    targetDone = storedMode ? (storedMode !== "erase") : (!cell.classList.contains("done"));


    // Arm paint mode only after a short hold. If user releases quickly, it's just a tap.
    if(dragHoldTimer){ clearTimeout(dragHoldTimer); }
    dragHoldTimer = setTimeout(()=>{
      if(!dragPrimed) return;
      dragStarted = true;
      dragging = true;
      applyCell(dragStartCell);
    }, DRAG_HOLD_MS);

    grid.setPointerCapture?.(e.pointerId);
  });

  grid.addEventListener("pointermove", (e)=>{
    const dx = Math.abs(e.clientX - dragStartX);
    const dy = Math.abs(e.clientY - dragStartY);

    // If the user starts moving before the hold finishes:
    // - Mouse: start paint immediately (more natural for desktop).
    // - Touch: assume scrolling unless they held long enough.
    if(!dragging && (dx > 8 || dy > 8)){
      if(e.pointerType === "mouse"){
        if(dragHoldTimer){ clearTimeout(dragHoldTimer); dragHoldTimer = null; }
        if(dragPrimed){
          dragStarted = true;
          dragging = true;
          applyCell(dragStartCell);
        }
      }else{
        if(dragHoldTimer){ clearTimeout(dragHoldTimer); dragHoldTimer = null; }
        dragPrimed = false;
        return;
      }
    }
    if(!dragging) return;

    e.preventDefault();

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = el ? el.closest(".matrixCell") : null;
    applyCell(cell);
  });

  grid.addEventListener("pointerup", endDrag);
  grid.addEventListener("pointercancel", endDrag);
  grid.addEventListener("lostpointercapture", endDrag);

  // Subtle pulse animation for the most recently toggled cell (one-shot).
  if(lastPulse){
    requestAnimationFrame(()=>{
      document.querySelectorAll(".matrixCell.justChanged").forEach(c=>{
        setTimeout(()=>c.classList.remove("justChanged","pulseMiss"), 280);
      });
    });
    lastPulse = null;
  }
}

// Render the list section that lives INSIDE the analytics card.
// This must be callable even when only renderAnalytics() ran.
function renderListInAnalytics(){
  const habitListEl = document.getElementById("habitList");
  if(!habitListEl) return;

  const H = getFilteredHabits();
  const viewMode = getCurrentViewMode();
  if(viewMode !== "list"){
    habitListEl.innerHTML = "";
    return;
  }

  if(!H.length){
    habitListEl.innerHTML = '<p class="empty">No habits yet. Add your first habit above.</p>';
    return;
  }

  // List view summary counts should follow the currently selected analytics period.
  // Example: if the user is browsing Month view with an offset, use that month.
  const todayIso = today();

  function getListPeriod(){
    const v = (analyticsView||"month").toLowerCase();
    const off = Number(analyticsOffsetDays)||0;

    if(v === "month"){
      const b = getBoundsForView("month", off);
      let label = "This month";
      try{ label = new Intl.DateTimeFormat(undefined,{ month:"long", year:"numeric" }).format(b.start); }catch(_){ }
      return { startIso: isoDate(b.start), endIso: isoDate(b.end), label, kind:"month" };
    }

    if(v === "year"){
      const b = getBoundsForView("year", off);
      let label = "This year";
      try{ label = String(b.start.getFullYear()); }catch(_){ }
      return { startIso: isoDate(b.start), endIso: isoDate(b.end), label, kind:"year" };
    }

    if(v === "week"){
      // Use calendar week (Mon..Sun) that contains (today + offsetDays).
      const base = new Date();
      base.setDate(base.getDate() + off);
      const b = getMondayWeekBounds(base);
      let label = "This week";
      try{
        const s = new Intl.DateTimeFormat(undefined,{ month:"short", day:"numeric" }).format(b.start);
        const e = new Intl.DateTimeFormat(undefined,{ month:"short", day:"numeric" }).format(b.end);
        label = `${s} – ${e}`;
      }catch(_){ }
      return { startIso: isoDate(b.start), endIso: isoDate(b.end), label, kind:"week" };
    }

    // All-time: lifetime stats (from habit creation -> today)
    // (offset doesn't apply; we keep it truly "all time")
    return { startIso: "", endIso: todayIso, label:"All time", kind:"all" };
  }

  const period = getListPeriod();
  const periodStartIso = period.startIso;
  const periodEndIso = period.endIso;

  // Cap the end at today for current/future periods.
  const browseEndIso = (periodEndIso < todayIso) ? periodEndIso : todayIso;

  // ----- All-time list view: lifetime cards + sorting + badges -----
  const allSortKey = (()=>{
    try{ return localStorage.getItem('habitsAllListSort') || 'consistency'; }catch(_){ return 'consistency'; }
  })();

  function calcLifetime(h){
    const tIso = todayIso;
    const createdIso = (h && typeof h.created === 'string' && h.created.length===10) ? h.created : tIso;
    const earliestIso = ((h.datesDone||[]).concat([createdIso]).sort()[0]) || createdIso;
    const startIso = earliestIso;
    const endIso = tIso;
    const startD = new Date(startIso+'T00:00:00');
    const endD = new Date(endIso+'T00:00:00');
    let eligible = Math.floor((endD-startD)/86400000)+1;
    if(!Number.isFinite(eligible) || eligible < 0) eligible = 0;
    const done = countDoneInBounds(h, { start:startD, end:endD });
    const pct = eligible ? Math.round((done/eligible)*100) : 0;
    return { startIso, endIso, eligible, done, pct };
  }

  function pctInLastDays(h, days, endIso){
    const endD = new Date(endIso+'T00:00:00');
    const startD = new Date(endD);
    startD.setDate(startD.getDate() - (days-1));
    const startIso = isoDate(startD);
    const done = countDoneInBounds(h, { start:startD, end:endD });
    return Math.round((done / Math.max(1, days)) * 100);
  }

  function buildMiniTimeline(h, months=12){
    const out = [];
    const end = new Date(todayIso+'T00:00:00');
    for(let i=months-1;i>=0;i--){
      const d = new Date(end.getFullYear(), end.getMonth()-i, 1);
      const year = d.getFullYear();
      const m = d.getMonth();
      const mb = monthBoundsFor(year, m);
      let ms = isoDate(mb.start);
      let me = isoDate(mb.end);
      // Clamp to habit creation and today
      const createdIso = (h && typeof h.created === 'string' && h.created.length===10) ? h.created : ms;
      if(ms < createdIso) ms = createdIso;
      if(me > todayIso) me = todayIso;
      const startD = new Date(ms+'T00:00:00');
      const endD = new Date(me+'T00:00:00');
      let eligible = Math.floor((endD-startD)/86400000)+1;
      if(!Number.isFinite(eligible) || eligible < 0) eligible = 0;
      const done = eligible ? countDoneInBounds(h, { start:startD, end:endD }) : 0;
      const pct = eligible ? Math.round((done/eligible)*100) : 0;
      out.push({ year, m, pct, eligible });
    }
    return out;
  }

  // Precompute metrics for sorting + badges
  const metrics = H.map(h=>{
    const life = calcLifetime(h);
    const last30 = pctInLastDays(h, 30, todayIso);
    const prevEnd = new Date(todayIso+'T00:00:00');
    prevEnd.setDate(prevEnd.getDate()-30);
    const prev30 = pctInLastDays(h, 30, isoDate(prevEnd));
    const improvement = last30 - prev30;
    return { h, life, last30, prev30, improvement, timeline: buildMiniTimeline(h, 12) };
  });

  // Badges
  const bestConsistency = metrics.reduce((a,b)=> (b.life.pct > a.life.pct ? b : a), metrics[0]);
  const bestImproved = metrics.reduce((a,b)=> (b.improvement > a.improvement ? b : a), metrics[0]);
  const needsAttention = metrics.reduce((a,b)=> (b.last30 < a.last30 ? b : a), metrics[0]);

  function sortMetrics(list){
    const arr = list.slice();
    const key = String(allSortKey||'consistency');
    if(key==='name') arr.sort((a,b)=> String(a.h.name||'').localeCompare(String(b.h.name||'')));
    else if(key==='streak') arr.sort((a,b)=> (calcStreaksInWindow(b.h, b.life.startIso, b.life.endIso).best - calcStreaksInWindow(a.h, a.life.startIso, a.life.endIso).best));
    else if(key==='improvement') arr.sort((a,b)=> (b.improvement - a.improvement));
    else arr.sort((a,b)=> (b.life.pct - a.life.pct));
    return arr;
  }

  const sorted = (period.kind==='all') ? sortMetrics(metrics) : null;

  const rows = (period.kind==='all' ? sorted.map((m)=>{
    const h = m.h;
    const accent = `hsl(${habitHue(h.id)} 70% 55%)`;
    const streaks = calcStreaksInWindow(h, m.life.startIso, m.life.endIso);

    // Badge assignment
    const badge = (()=>{
      if(bestConsistency && h.id===bestConsistency.h.id) return { t:'Most consistent', cls:'bGood' };
      if(bestImproved && h.id===bestImproved.h.id && bestImproved.improvement>0) return { t:'Most improved', cls:'bUp' };
      if(needsAttention && h.id===needsAttention.h.id) return { t:'Needs attention', cls:'bWarn' };
      return null;
    })();

    const segs = m.timeline.map(seg=>{
      const lvl = intensityLevel(seg.pct);
      let title = '';
      try{ title = new Intl.DateTimeFormat(undefined,{month:'short', year:'numeric'}).format(new Date(seg.year, seg.m, 1)); }catch(_){ title=''; }
      return `<span class="tlSeg lvl${lvl}" title="${escapeHtml(title)}"></span>`;
    }).join('');

    return `
      <div class="lifeCard" style="--accent:${accent}">
        <div class="lifeTop">
          <div class="lifeTitle">
            <strong>${escapeHtml(h.name||'Habit')}</strong>
            ${badge ? `<span class="lifeBadge ${badge.cls}">${escapeHtml(badge.t)}</span>` : ''}
          </div>
          <div class="lifePct">${m.life.pct}%</div>
        </div>

        <div class="lifeSub">
          <span class="small">${habitKind(h)==='negative' ? 'Avoidance' : 'Completion'}</span>
          <span class="dotSep">•</span>
          <span class="small">${m.life.done} / ${m.life.eligible} days</span>
          <span class="dotSep">•</span>
          <span class="small">Current streak: <b>${streaks.current}</b></span>
          <span class="dotSep">•</span>
          <span class="small">Best streak: <b>${streaks.best}</b></span>
        </div>

        <div class="miniTimeline" aria-hidden="true">${segs}</div>

        <div class="lifeFoot">
          <div class="small">Last 30d: <b>${m.last30}%</b></div>
          <div class="small">Δ vs prev 30d: <b class="${m.improvement>=0?'up':'down'}">${m.improvement>=0?'+':''}${m.improvement}%</b></div>
        </div>
      </div>
    `;
  }).join('') : H.map((h)=>{
    const accent = `hsl(${habitHue(h.id)} 70% 55%)`;
    const createdIso = (h && typeof h.created === "string" && h.created.length===10) ? h.created : periodStartIso;
    const startIso = (createdIso > periodStartIso) ? createdIso : periodStartIso;
    const endIso = (browseEndIso < startIso) ? startIso : browseEndIso;

    // Count eligible days inclusive
    const startD = new Date(startIso+"T00:00:00");
    const endD = new Date(endIso+"T00:00:00");
    let eligible = Math.floor((endD - startD) / 86400000) + 1;
    if(!Number.isFinite(eligible) || eligible < 0) eligible = 0;

    // Done in window
    let doneCount = 0;
    const set = new Set(h.datesDone||[]);
    if(eligible > 0){
      const d = new Date(startD);
      while(d <= endD){
        const iso = d.toISOString().slice(0,10);
        if(set.has(iso)) doneCount++;
        d.setDate(d.getDate()+1);
      }
    }

    const pct = eligible ? Math.round((doneCount / eligible) * 100) : 0;

    // Year-only: richer card with mini month bar + streaks
    if(period.kind === "year"){
      const year = new Date(periodStartIso+"T00:00:00").getFullYear();

      // Month segments (intensity per month completion %)
      const segs = [];
      const monthStats = [];
      for(let m=0;m<12;m++){
        const mb = monthBoundsFor(year, m);
        const msIso = isoDate(mb.start);
        const meIsoRaw = isoDate(mb.end);
        const meIso = (meIsoRaw < endIso) ? meIsoRaw : endIso;

        const mStartIso = (startIso > msIso) ? startIso : msIso;
        const mEndIso = (meIso < mStartIso) ? mStartIso : meIso;

        const mStartD = new Date(mStartIso+"T00:00:00");
        const mEndD = new Date(mEndIso+"T00:00:00");
        let mEligible = Math.floor((mEndD - mStartD) / 86400000) + 1;
        if(!Number.isFinite(mEligible) || mEligible < 0) mEligible = 0;

        const mDone = countDoneInBounds(h, { start: new Date(mStartIso+"T00:00:00"), end: new Date(mEndIso+"T00:00:00") });
        const mPct = mEligible ? Math.round((mDone/mEligible)*100) : 0;
        monthStats.push({ m, eligible:mEligible, done:mDone, pct:mPct });
        segs.push(intensityLevel(mPct));
      }

      const valid = monthStats.filter(x=>x.eligible>0);
      const best = valid.length ? valid.reduce((a,b)=> (b.pct>a.pct?b:a)) : null;
      const worst = valid.length ? valid.reduce((a,b)=> (b.pct<a.pct?b:a)) : null;

      const streaks = calcStreaksInWindow(h, startIso, endIso);

      const mName = (m)=>{
        try{ return new Intl.DateTimeFormat(undefined,{month:"short"}).format(new Date(year, m, 1)); }
        catch(_){ return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m]; }
      };

      return `
        <div class="habitYearRow" style="--accent:${accent}">
          <div class="hyrTop">
            <div class="hyrTitle">
              <strong>${escapeHtml(h.name||"Habit")}</strong>
              <span class="badge">${escapeHtml(period.label||"")}</span>
            </div>
            <div class="hyrCount">${doneCount} / ${eligible}</div>
          </div>

          <div class="hyrBar" aria-hidden="true">
            ${segs.map((lvl,i)=>`<span class="hyrSeg lvl${lvl}" title="${mName(i)}"></span>`).join("")}
          </div>

          <div class="hyrMeta">
            <span>${pct}% consistency</span>
            <span>Current streak: <b>${streaks.current}</b></span>
            <span>Best streak: <b>${streaks.best}</b></span>
            <span>Best: <b>${best?mName(best.m):"—"}</b> ${best?best.pct+"%":""}</span>
            <span>Worst: <b>${worst?mName(worst.m):"—"}</b> ${worst?worst.pct+"%":""}</span>
          </div>
        </div>
      `;
    }

    // Default list row (Week/Month/All)
    return `
      <div class="habitTableRow" style="--accent:${accent}">
        <div class="htrMain">
          <div class="htrTitleRow">
            <strong>${escapeHtml(h.name||"Habit")}</strong>
            <span class="badge">${escapeHtml(period.label||"")}</span>
          </div>
          <div class="monthProg" aria-hidden="true"><div class="monthFill" style="width:${pct}%"></div></div>
          <div class="htrMeta small">${habitKind(h)==='negative' ? 'Avoidance' : 'Completion'} • ${pct}%</div>
        </div>
        <div class="htrRight">
          <div class="htrCount">${doneCount} / ${eligible}</div>
          <div class="small">days</div>
        </div>
      </div>
    `;
  }).join(""));

  if(period.kind === 'all'){
    habitListEl.innerHTML = `
      <div class="allListHeader">
        <div class="allListMeta">
          <div class="small">All‑time habits</div>
          <div class="small muted">Sorted by</div>
        </div>
        <div class="selectWrap"><select id="allListSort" class="premiumSelect">
          <option value="consistency" ${allSortKey==='consistency'?'selected':''}>Consistency</option>
          <option value="improvement" ${allSortKey==='improvement'?'selected':''}>Most improved (30d)</option>
          <option value="streak" ${allSortKey==='streak'?'selected':''}>Best streak</option>
          <option value="name" ${allSortKey==='name'?'selected':''}>Name</option>
        </select></div>
      </div>
      <div class="lifeGrid">${rows}</div>
    `;

    const sel = habitListEl.querySelector('#allListSort');
    if(sel){
      sel.addEventListener('change', ()=>{
        try{ localStorage.setItem('habitsAllListSort', sel.value); }catch(_){ }
        renderListInAnalytics();
      });
    }
  } else {
    habitListEl.innerHTML = `<div class="habitTable">${rows}</div>`;
  }
}



function renderInsights(){
  const el=document.getElementById("insights");
  if(!el) return;
  // Resolve the currently filtered habits locally (don't rely on external scope).
  const H = getFilteredHabits();
  const r7=completionRate(7);
  const r30=completionRate(30);
  const r60=completionRate(60);
  const r180=completionRate(180);

  // Weakest habit: lowest completion over last 14 days
  const weakest = (()=>{
    if(!H.length) return null;
    const now=new Date(today()+"T00:00:00");
    const days=14;
    const window=[];
    for(let i=days-1;i>=0;i--){
      const d=new Date(now); d.setDate(now.getDate()-i);
      window.push(d.toISOString().slice(0,10));
    }
    let best=null;
    for(const h of H){
      const set=new Set(h.datesDone||[]);
      const done=window.reduce((acc,iso)=>acc+(set.has(iso)?1:0),0);
      const rate=done/days;
      if(!best || rate < best.rate) best={h, done, days, rate};
    }
    return best;
  })();

  el.innerHTML=`
    <div class="cardHeader">
      <h3 class="cardTitle">Insights</h3>
      <span class="badge">Consistency</span>
    </div>
    <div class="consistencyViz">
      <div class="arcReactor" id="consistencyArc" data-scheme="status" aria-label="180 day completion visualization" role="img">
        <div class="arcCore">
          <div class="arcPct">${r180}%</div>
          <div class="arcLbl">180D</div>
        </div>
      </div>
      <div class="consistencyMeta">
        <div class="kpiRow" style="margin:0">
          <div class="kpi"><div class="kpiLabel">7‑day</div><div class="kpiValue">${r7}%</div></div>
          <div class="kpi"><div class="kpiLabel">30‑day</div><div class="kpiValue">${r30}%</div></div>
          <div class="kpi"><div class="kpiLabel">60‑day</div><div class="kpiValue">${r60}%</div></div>
          <div class="kpi"><div class="kpiLabel">180‑day</div><div class="kpiValue">${r180}%</div></div>
        </div>
        <p class="small" style="margin-top:10px">180 days is a strong baseline for long‑term habit formation.</p>
      </div>
    </div>
    <p class="small" style="margin-top:12px">Tap to toggle. Drag to paint in the Analytics grid.</p>
    ${weakest?`
      <div class="hintCard compact" style="margin-top:12px" id="weakestHint" role="button" tabindex="0" aria-label="Jump to weakest habit">
        <div class="hintIcon">🧠</div>
        <div class="hintText">
          <div class="hintTitle">Focus hint</div>
          <div class="hintBody">Weakest: <strong>${escapeHtml(weakest.h.name)}</strong> • ${weakest.done}/${weakest.days} in last 2 weeks</div>
        </div>
        <div class="hintCta">Jump →</div>
      </div>
    `:""}
  `;

  // Modern segmented "arc reactor" for 60-day consistency.
  const arc = el.querySelector('#consistencyArc');
  if(arc) setArcReactor(arc, r180, 5);
  // Store last computed value so the right-panel copy can re-apply styles.
  window.__lastConsistency180 = r180;

  if(weakest){
    const hint = el.querySelector('#weakestHint');
    const go = ()=>{ setCarouselIndex(H.findIndex(x=>x.id===weakest.h.id)); };
    hint?.addEventListener('click', go);
    hint?.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); go(); } });
  }
}

function buildArcGradient(pct, segments, onColor, offColor){
  const seg = Math.max(3, Math.min(8, segments||6));
  const p = Math.max(0, Math.min(100, Number(pct)||0));
  const total = (p/100) * seg;
  const full = Math.floor(total);
  const partial = total - full;

  const slice = 360/seg;
  const gap = Math.min(10, slice*0.18); // degrees between segments
  const fill = slice-gap;

  const on = onColor || 'hsla(210, 100%, 70%, 0.95)';
  const off = offColor || 'hsla(210, 35%, 45%, 0.18)';
  const stops=[];

  for(let i=0;i<seg;i++){
    const a0 = i*slice;
    const aFillEnd = a0 + fill;
    const a2 = a0 + slice;

    if(i < full){
      stops.push(`${on} ${a0}deg ${aFillEnd}deg`);
    }else if(i === full && partial > 0){
      const aMid = a0 + (fill * partial);
      stops.push(`${on} ${a0}deg ${aMid}deg`);
      stops.push(`${off} ${aMid}deg ${aFillEnd}deg`);
    }else{
      stops.push(`${off} ${a0}deg ${aFillEnd}deg`);
    }
    stops.push(`transparent ${aFillEnd}deg ${a2}deg`);
  }
  return `conic-gradient(from -90deg, ${stops.join(',')})`;
}



// --- Percent-based status coloring (shared by arc + stats fills) ---
function statusColorForPercent(pi){
  // Spec ranges:
  // 0–33  -> Low (red)
  // 34–66 -> Medium (yellow)
  // 67–100-> Good (green)
  const x = Math.max(0, Math.min(100, Math.round(Number(pi)||0)));

  // SVG attributes are picky about color formats; use rgba() to be safe.
  const clamp01 = (t)=>Math.max(0, Math.min(1, t));
  const lerp = (a,b,t)=>a+(b-a)*t;

  function hslToRgb(h, s, l){
    h = ((h%360)+360)%360;
    s = Math.max(0, Math.min(100, s))/100;
    l = Math.max(0, Math.min(100, l))/100;

    const c = (1 - Math.abs(2*l - 1)) * s;
    const hp = h / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r1=0,g1=0,b1=0;

    if(0<=hp && hp<1){ r1=c; g1=x; b1=0; }
    else if(1<=hp && hp<2){ r1=x; g1=c; b1=0; }
    else if(2<=hp && hp<3){ r1=0; g1=c; b1=x; }
    else if(3<=hp && hp<4){ r1=0; g1=x; b1=c; }
    else if(4<=hp && hp<5){ r1=x; g1=0; b1=c; }
    else if(5<=hp && hp<6){ r1=c; g1=0; b1=x; }

    const m = l - c/2;
    return {
      r: Math.round((r1+m)*255),
      g: Math.round((g1+m)*255),
      b: Math.round((b1+m)*255),
    };
  }

  const rgba = (h,s,l,a)=>{
    const {r,g,b} = hslToRgb(h,s,l);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  };

  if(x <= 33){
    const t = clamp01(x/33);
    return {
      on:   rgba(0, 92, lerp(54, 62, t), 0.96),
      off:  rgba(0, 50, lerp(20, 28, t), 0.22),
      glow: rgba(0, 92, lerp(58, 70, t), 0.75),
    };
  }
  if(x <= 66){
    const t = clamp01((x-34)/32);
    return {
      on:   rgba(45, 100, lerp(54, 62, t), 0.96),
      off:  rgba(45, 55,  lerp(24, 34, t), 0.22),
      glow: rgba(45, 100, lerp(58, 72, t), 0.75),
    };
  }
  {
    const t = clamp01((x-67)/33);
    return {
      on:   rgba(135, 90, lerp(58, 54, t), 0.96),
      off:  rgba(135, 55, lerp(32, 28, t), 0.22),
      glow: rgba(135, 90, lerp(68, 62, t), 0.75),
    };
  }
}

const __arcReactorState = new Map(); // key -> last integer pct rendered for arc reactors

function setArcReactor(el, pct, segments){
  const p = Math.max(0, Math.min(100, Number(pct)||0));
  const seg = Math.max(3, Math.min(8, Number(segments)||5));

  // Always animate from 0 → target so the viewer can *see* every single
  // percent step (1%, 2%, 3% ... target), like a true "filling" animation.
  // Start at 1% (when target > 0) so the user can visually see
  // 1%, 2%, 3% ... as distinct steps.
  // Persist last rendered % across re-renders so the arc can continue (or rollback) from where it was.
  const key = (el.id || el.getAttribute('data-key') || '').trim();
  const stored = key && __arcReactorState.has(key) ? Number(__arcReactorState.get(key)) : NaN;
  const inline = Number(el.dataset.curPct ?? el.style.getPropertyValue('--arc-p') ?? 0) || 0;
  const existing = Number.isFinite(stored) ? stored : inline;

  // If we have no prior state and target > 0, start at 1% so the user sees the first visible step.
  const prev = (existing > 0 || p <= 0) ? Math.max(0, Math.min(100, Math.round(existing))) : 1;
  el.dataset.pct = String(p);

  // Optional center label ("xx%") inside the arc.
  const pctLabel = el.querySelector('.arcPct');

  const scheme = (el.getAttribute('data-scheme')||'').toLowerCase();
  const pctEl = el.querySelector('.arcPct');
  let on, off;

  // Build status colors *per integer percent* so color visibly evolves
  // while the arc advances 1% at a time.
  function lerp(a,b,t){ return a + (b-a)*t; }
  function clamp01(x){ return Math.max(0, Math.min(1, x)); }
  function hsla(h,s,l,a){
    return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${a})`;
  }
  function statusColors(pi){ return statusColorForPercent(pi); }

  if(scheme === 'status'){
    ({on, off} = statusColors(prev));
    el.style.setProperty('--arc-glow', statusColors(prev).glow);
  }else{
    on = 'hsla(210, 100%, 70%, 0.95)';
    off = 'hsla(210, 35%, 45%, 0.18)';
    el.style.setProperty('--arc-glow', 'hsla(210, 100%, 70%, 0.65)');
  }

  el.style.setProperty('--arc-on', on);
  el.style.setProperty('--arc-off', off);

  // Paint the initial 1% state immediately so the first visible frame isn't 0%.
  el.style.backgroundImage = buildArcGradient(prev, seg, on, off);
  el.style.setProperty('--arc-p', String(prev));
  el.dataset.curPct = String(prev);
  if(key) __arcReactorState.set(key, prev);
  if(pctEl) pctEl.textContent = `${prev}%`;

  // reset state
  el.classList.remove('charged', 'fullPulse');
  el.classList.add('charging');

  // Slower fill so it feels like a smooth "loading" sweep.
    // Slower fill so it feels like a smooth "loading" sweep,
  // but we advance in *real* integer % steps: 1%, 2%, 3% ... target.
  // Make each 1% step readable. (e.g. 30% ≈ 1.2s, 70% ≈ 2.6s)
  const DURATION = Math.max(900, Math.round(p * 38));
  const t0 = performance.now();

  const easeOutCubic = (t)=>1 - Math.pow(1-t, 3);

  // We only re-render when the integer percentage changes.
  // This guarantees the visual passes through 1%, 2%, 3% ... (or downwards if needed).
  let lastInt = prev;

  const tick = (t)=>{
    const k = Math.max(0, Math.min(1, (t - t0) / DURATION));
    const e = easeOutCubic(k);
    const easedVal = prev + (p - prev) * e;

    let nextInt;
    if(p >= prev){
      nextInt = Math.min(p, Math.max(lastInt, Math.floor(easedVal)));
    }else{
      nextInt = Math.max(p, Math.min(lastInt, Math.ceil(easedVal)));
    }

    // Always keep the center % label in sync with the animated value.
    // (Some renders previously only updated at the end or on sparse steps.)
    if(pctEl) pctEl.textContent = `${nextInt}%`;

    if(nextInt !== lastInt){
      lastInt = nextInt;
      // Update colors per integer % (only for the status scheme)
      if(scheme === 'status'){
        const c = statusColors(lastInt);
        on = c.on; off = c.off;
        el.style.setProperty('--arc-on', on);
        el.style.setProperty('--arc-off', off);
        el.style.setProperty('--arc-glow', c.glow);
      }
      el.style.backgroundImage = buildArcGradient(lastInt, seg, on, off);
      el.style.setProperty('--arc-p', String(lastInt));
      el.dataset.curPct = String(lastInt);
      if(key) __arcReactorState.set(key, lastInt);
    }

    if(k < 1){
      requestAnimationFrame(tick);
      return;
    }

    // Snap to final value and add "charged" animation.
    // Final snap (and final color state)
    if(scheme === 'status'){
      const c = statusColors(p);
      on = c.on; off = c.off;
      el.style.setProperty('--arc-on', on);
      el.style.setProperty('--arc-off', off);
      el.style.setProperty('--arc-glow', c.glow);
    }
    el.style.backgroundImage = buildArcGradient(p, seg, on, off);
    el.style.setProperty('--arc-p', String(p));
    el.dataset.curPct = String(p);
    if(key) __arcReactorState.set(key, p);
    if(pctEl) pctEl.textContent = `${p}%`;
    el.classList.remove('charging');
    el.classList.add('charged');
    if(p >= 100){
      el.classList.add('fullPulse');
    }
  };

  requestAnimationFrame(tick);
}



// --- Habits > Stats chart animation (streak bars) ---
const __streakFillState = new Map(); // key -> last integer pct rendered

function animateStreakFill(fillEl, targetPct, key){
  const p = Math.max(0, Math.min(100, Math.round(Number(targetPct)||0)));
  const prevRaw = __streakFillState.has(key) ? __streakFillState.get(key) : Number(fillEl.dataset.curPct||0)||0;
  const prev = Math.max(0, Math.min(100, Math.round(prevRaw)));

  // If the element is newly created, paint the previous state immediately (so it continues from there).
  fillEl.style.width = `${prev}%`;
  fillEl.dataset.curPct = String(prev);
  __streakFillState.set(key, prev);

  const DURATION = Math.max(650, Math.round(Math.abs(p - prev) * 28));
  const t0 = performance.now();
  const easeOutCubic = (t)=>1 - Math.pow(1-t, 3);
  let lastInt = prev;

  const tick = (t)=>{
    const k = Math.max(0, Math.min(1, (t - t0) / DURATION));
    const e = easeOutCubic(k);
    const easedVal = prev + (p - prev) * e;

    let nextInt;
    if(p >= prev){
      nextInt = Math.min(p, Math.max(lastInt, Math.floor(easedVal)));
    }else{
      nextInt = Math.max(p, Math.min(lastInt, Math.ceil(easedVal)));
    }

    if(nextInt !== lastInt){
      lastInt = nextInt;
      fillEl.style.width = `${lastInt}%`;
      fillEl.dataset.curPct = String(lastInt);
      __streakFillState.set(key, lastInt);

      // Color shifts per % (same scheme as the pie)
      const c = statusColorForPercent(lastInt);
      fillEl.style.background = c.on;
      fillEl.style.boxShadow = `0 0 0 rgba(0,0,0,0), 0 0 14px ${c.glow}`;
    }

    if(k < 1){
      requestAnimationFrame(tick);
      return;
    }

    // final snap
    fillEl.style.width = `${p}%`;
    fillEl.dataset.curPct = String(p);
    __streakFillState.set(key, p);
    const c = statusColorForPercent(p);
    fillEl.style.background = c.on;
    fillEl.style.boxShadow = `0 0 0 rgba(0,0,0,0), 0 0 14px ${c.glow}`;
  };

  requestAnimationFrame(tick);
}

function renderStreakSummary(){
  const el=document.getElementById("streakSummary");
  if(!el) return;
  // Resolve the currently filtered habits locally (don't rely on external scope).
  const H = getFilteredHabits();
  if(!H.length){
    el.innerHTML='<div class="cardHeader"><h3 class="cardTitle">Streaks</h3></div><p class="empty">No H yet.</p>';
    return;
  }
  const stats=H.map(h=>({h, s:streakFor(h)}));
  stats.sort((a,b)=>b.s.current-a.s.current);
  const top=stats.slice(0,4);
  const maxCurrent = Math.max(1, ...top.map(x=>x.s.current));
  el.innerHTML=`
    <div class="cardHeader">
      <h3 class="cardTitle">Streaks</h3>
      <span class="badge">Top</span>
    </div>
    <div class="streakList">
      ${top.map(x=>{
        const pct = Math.round((x.s.current / maxCurrent) * 100);
        return `
          <div class="streakItem">
            <div class="streakMeta">
              <div class="streakName">${escapeHtml(x.h.name)}</div>
              <div class="streakSub">Best ${x.s.best}</div>
            </div>
            <div class="streakRight">
              <div class="pill">${x.s.current}d</div>
            </div>
            <div class="streakBar"><div class="streakFill" style="width:${pct}%"></div></div>
          </div>
        `;


// Animate the Stats chart bars (continue from previous % instead of restarting).
// Keyed by habit name (stable enough for this app); if you have ids, switch to h.id.
requestAnimationFrame(()=>{
  const items = el.querySelectorAll('.streakItem');
  items.forEach(item=>{
    const nameEl = item.querySelector('.streakName');
    const fillEl = item.querySelector('.streakFill');
    if(!fillEl) return;
    const key = (nameEl ? nameEl.textContent.trim() : '') || fillEl.dataset.key || '';
    const target = parseFloat((fillEl.style.width||'').replace('%','')) || 0;
    // store key for future renders
    fillEl.dataset.key = key;
    animateStreakFill(fillEl, target, key);
  });
});
      }).join("")}
    </div>
  `;
}



// ---------- Quick Mark Panel (inspired by Dribbble shot) ----------
function renderQuickMarkPanel(){
  const host = document.getElementById("habitQuickMark");
  if(!host) return;

  const H = getFilteredHabits();
  const iso = getMarkDate();
  const d = new Date(iso+"T00:00:00");
  const label = d.toLocaleDateString(undefined, { weekday:"short", month:"numeric", day:"numeric" });

  // Build list
  const todayIso = today();
  const rows = H.map(h=>{
    const done = (h.datesDone||[]).includes(iso);
    const missed = (!done && iso < todayIso);
    // Keep the Quick Mark tile color in sync with the Analytics matrix.
    const accent = `hsl(${habitHue(h.id)} 70% 55%)`;
    const isNeg = habitKind(h)==='negative';
    const negIcon = isNeg ? `
      <svg class="qmX" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    ` : "";
    return `
      <div class="qmRow ${done ? "isDone" : ""} ${missed ? "isMissed" : ""}" data-hid="${h.id}" style="--accent:${accent}">
        <div class="qmDot ${isNeg ? "isNeg" : ""}" aria-hidden="true">${negIcon}</div>
        <div class="qmMain">
          <div class="qmName">${escapeHtml(h.name||"Habit")}</div>
          <div class="qmMeta">${habitDoneText(h, done)}</div>
        </div>
        <button class="qmToggle" aria-label="${habitActionText(h, done)}" title="${habitActionText(h, done)}"></button>
      </div>
    `;
  }).join("");

  host.innerHTML = `
    <div class="qmHead">
      <div>
        <div class="qmTitle">Habits</div>
        <div class="qmSub">${label}</div>
      </div>
    </div>
    <div class="qmList">${rows || '<p class="empty">No habits yet.</p>'}</div>
  `;

  // Bind actions
  host.querySelectorAll(".qmRow").forEach(row=>{
    const hid = row.getAttribute("data-hid");
    const btn = row.querySelector(".qmToggle");
    if(!btn) return;
    btn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      toggleHabitAt(hid, iso, { silentToast:false });
      // rerender all to keep everything in sync (matrix, streaks, etc.)
      render();
    });
  });
}

function render(){
  if(markDate && !markDate.value) markDate.value=today();
  const H = getFilteredHabits();

  renderAnalytics();
  renderInsights();
  renderStreakSummary();
  renderHero();
  renderFocusCard();
  syncSidePanels();
  renderQuickMarkPanel();

  // List view lives inside the Analytics card.
  // Render it here too (in addition to callers that only re-render analytics),
  // so all side panels stay in sync.
  renderListInAnalytics();

}


// Re-render when the selected mark date changes (affects streaks + insights)
// (Only if the optional date picker exists in the current layout.)
if(markDate){
  markDate.addEventListener("change", ()=>render());
}


function deleteHabit(id){
  if(!confirm("Delete this habit?")) return;
  habits = habits.filter(h=>h.id!==id);
  save();
  render();
}



function renderFocusCard(){
  // v10: avoid duplicate "Focus hint" cards. We keep the single compact hint tile.
  const el = document.getElementById("focusHint");
  if(!el) return;
  el.innerHTML = "";
  el.style.display = "none";
}

function syncSidePanels(){
  const sMain = document.getElementById("streakSummary");
  const iMain = document.getElementById("insights");
  const sSide = document.getElementById("streakSummarySide");
  const iSide = document.getElementById("insightsSide");
  if(sMain && sSide) sSide.innerHTML = sMain.innerHTML;
  if(iMain && iSide) iSide.innerHTML = iMain.innerHTML;

  // Re-apply arc styling for the duplicated Insights card on desktop right panel.
  const sideArc = iSide?.querySelector?.('.arcReactor');
  if(sideArc && Number.isFinite(window.__lastConsistency180)){
    setArcReactor(sideArc, window.__lastConsistency180, 5);
  }
}

function wireHabitsLayout(){
  // Analytics filter UI is rendered inside the Analytics card header.

  // Optional date picker (some templates include it). If not present, we default to today.
  markDate = document.getElementById("markDate");
  if(markDate && !markDate.__wired){
    markDate.__wired = true;
    markDate.addEventListener("change", ()=>render());
  }

  const search = document.getElementById("habitSearch");
  if(search){
    search.addEventListener("input", ()=>{
      habitSearchTerm = search.value || "";
      render();
    });
  }

  const newBtn = document.getElementById("newHabitBtn");
  const newBtn2 = document.getElementById("appNewHabitBtn");
  if(newBtn) newBtn.addEventListener("click", (e)=>openAddHabit(e.currentTarget));
  if(newBtn2) newBtn2.addEventListener("click", (e)=>openAddHabit(e.currentTarget));

  // Add-habit modal wiring (mobile-friendly)
  const modal = document.getElementById('addHabitModal');
  if(modal && !modal.__wired){
    modal.__wired = true;
    const input = document.getElementById('addHabitModalInput');
    const kindSeg = document.getElementById('habitKindSeg');
    const close = document.getElementById('addHabitClose');
    const cancel = document.getElementById('addHabitCancel');
    const confirm = document.getElementById('addHabitConfirm');
    const backdrop = modal.querySelector('[data-close]');

    const onClose = ()=>closeAddHabitModal();
    close && close.addEventListener('click', onClose);
    cancel && cancel.addEventListener('click', onClose);
    backdrop && backdrop.addEventListener('click', onClose);
    confirm && confirm.addEventListener('click', ()=>confirmAddHabitModal());

    // Habit type (positive/negative)
    if(kindSeg){
      kindSeg.addEventListener('click', (ev)=>{
        const btn = ev.target && ev.target.closest && ev.target.closest('[data-kind]');
        if(!btn) return;
        ev.preventDefault();
        const kind = btn.getAttribute('data-kind');
        window.__addHabitKind = (kind === 'negative') ? 'negative' : 'positive';
        const btns = Array.from(kindSeg.querySelectorAll('[data-kind]'));
        btns.forEach(b=>{
          const k = b.getAttribute('data-kind');
          const active = (k === window.__addHabitKind);
          b.classList.toggle('active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
      });
    }
    input && input.addEventListener('keydown', (ev)=>{
      if(ev.key==='Enter') confirmAddHabitModal();
      if(ev.key==='Escape') onClose();
    });
    document.addEventListener('keydown', (ev)=>{
      if(ev.key==='Escape' && modal.classList.contains('open')) onClose();
    });
  }

  // tabs (mobile)
  const tabBtns = Array.from(document.querySelectorAll(".tabBtn[data-tab]"));
  const panels = Array.from(document.querySelectorAll(".tabPanel"));
  tabBtns.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      tabBtns.forEach(b=>b.classList.toggle("active", b===btn));
      const tab = btn.getAttribute("data-tab") || "grid";
      try{ localStorage.setItem("habitsViewMode", tab); }catch(e){}
      panels.forEach(p=>p.classList.toggle("active", p.getAttribute("data-panel")===tab));
      // Swap the content inside Habits page (grid vs table view)
      try{ render(); }catch(e){}
      // On desktop, keep all visible via CSS
      if(tab==="stats"){ try{ renderFocusCard(); }catch(e){} }
    });
  });
}




// ----------------------
// Daily reminder (configurable in Settings)
// ----------------------
let __habitsReminderTimer = null;

function getHabitsReminderSettings(){
  try{
    const raw = JSON.parse(localStorage.getItem("habitsReminder")||"null") || {};
    return {
      enabled: raw.enabled !== false,
      time: typeof raw.time==="string" ? raw.time : "20:00",
      threshold: Number.isFinite(raw.threshold) ? Math.max(0, Math.min(100, raw.threshold)) : 50
    };
  }catch(_){
    return { enabled:true, time:"20:00", threshold:50 };
  }
}

function computeTodayCompletionPct(){
  const H = getFilteredHabits();
  if(!H.length) return 0;
  const iso = today();
  const done = H.filter(h => (h.datesDone||[]).includes(iso)).length;
  return Math.round((done / H.length) * 100);
}

function notifyHabitsReminder(pct, threshold){
  const title = "Habits reminder";
  const body = `You're at ${pct}% today (target ${threshold}%). Open Habits to finish today.`;
  // Prefer system notifications if allowed; fallback to toast/alert.
  if("Notification" in window && Notification.permission === "granted"){
    try{
      const n = new Notification(title, { body });
      // Some browsers require a user gesture to focus; ignore errors.
      n.onclick = ()=>{ try{ window.focus(); }catch(_){} };
      return;
    }catch(_){}
  }
  if(typeof showToast === "function") showToast(body);
  else alert(body);
}

function runHabitsReminderCheck(){
  const s = getHabitsReminderSettings();
  if(!s.enabled) return;
  const H = getFilteredHabits();
  if(!H.length) return;

  const iso = today();
  const last = localStorage.getItem("habitsReminderLastNotified") || "";
  const pct = computeTodayCompletionPct();

  if(pct < s.threshold && last !== iso){
    localStorage.setItem("habitsReminderLastNotified", iso);
    notifyHabitsReminder(pct, s.threshold);
  }
}

function scheduleHabitsReminder(){
  if(__habitsReminderTimer) clearTimeout(__habitsReminderTimer);
  const s = getHabitsReminderSettings();
  if(!s.enabled) return;

  const now = new Date();
  const [hh, mm] = String(s.time||"20:00").split(":").map(x=>parseInt(x,10));
  const target = new Date(now);
  target.setHours(Number.isFinite(hh)?hh:20, Number.isFinite(mm)?mm:0, 0, 0);

  // If already past today's target, schedule for tomorrow.
  if(target.getTime() <= now.getTime()){
    target.setDate(target.getDate() + 1);
  }

  const ms = Math.max(250, target.getTime() - now.getTime());
  __habitsReminderTimer = setTimeout(()=>{
    runHabitsReminderCheck();
    scheduleHabitsReminder(); // reschedule next day
  }, ms);
}

// Keep reminder schedule in sync if Settings are changed in another tab.
window.addEventListener("storage", (e)=>{
  if(e && e.key === "habitsReminder") scheduleHabitsReminder();
});


wireHabitsLayout();
render();
// Start daily reminder timer (if enabled)
scheduleHabitsReminder();

// Keep the grid layout in sync when switching between desktop ↔ mobile widths.
// (Needed because the grid renderer branches on a media query.)
// Treat tablet widths as desktop so the Dates column is visible on larger screens.
// (Users reported the date column disappearing on "big" screens when the mobile transpose kicks in.)
let __habitsLastIsMobile = window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
let __habitsResizeTimer = null;
window.addEventListener("resize", ()=>{
  const nowIsMobile = window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
  const breakpointChanged = nowIsMobile !== __habitsLastIsMobile;
  __habitsLastIsMobile = nowIsMobile;
  if(__habitsResizeTimer) clearTimeout(__habitsResizeTimer);
  __habitsResizeTimer = setTimeout(()=>{
    // Re-render so the grid orientation + cell sizing recalculates.
    render();
  }, breakpointChanged ? 0 : 120);
});


function adaptLabel(el, maxChars=3){
  if(!el) return;
  const full = (el.dataset && el.dataset.full) ? el.dataset.full : el.textContent;
  if(el.dataset) el.dataset.full = full;

  for(let len = Math.min(maxChars, full.length); len >= 1; len--){
    el.textContent = full.slice(0, len);
    if(el.scrollWidth <= el.clientWidth) return;
  }
}

function adaptDayLabels(scope=document){
  scope.querySelectorAll(".matrixDayHead .m").forEach(el=>adaptLabel(el,3));
  scope.querySelectorAll(".matrixDayHead .w").forEach(el=>adaptLabel(el,3));
}

function setAnalyticsOffset(val){
  analyticsOffsetDays = val;
  analyticsOffsets[analyticsView] = analyticsOffsetDays;
    saveAnalyticsOffsets();
    // legacy key no longer used
  render();
}


function setHeroWheel(el, pct){
  if(!el) return;
  const target = Math.max(0, Math.min(100, Math.round(Number(pct)||0)));

  // Persist previous % per-day so refreshes during the same day animate from
  // the last seen value, but a new day starts fresh.
  const dayIso = (typeof today === 'function') ? today() : new Date().toISOString().slice(0,10);
  const LS_KEY = `heroWheelPrevPct:${dayIso}`;

  const r = 46;
  const c = 2 * Math.PI * r;

  // Create a small gap at the top (like the reference design)
  const gap = 0.085; // 8.5% of circumference
  const usable = c * (1 - gap);

  const track = el.querySelector(".wheelTrack");
  const prog  = el.querySelector(".wheelProg");
  const label = el.querySelector(".wheelPct");
  const defs = el.querySelector('defs');
  const stops = defs ? Array.from(defs.querySelectorAll('#wheelGrad stop')) : [];

  // Stronger glow helper
  const strongerGlow = (rgbaStr)=>{
    const m = String(rgbaStr||'').match(/rgba\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\)/i);
    if(!m) return rgbaStr;
    const a = Math.max(0, Math.min(1, Number(m[4])||0));
    const a2 = Math.min(1, a + 0.22);
    return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${a2})`;
  };

  const applyRing = (pRaw)=>{
    const v = Math.max(0, Math.min(100, Number(pRaw)||0));

    if(track){
      track.style.strokeDasharray = `${usable} ${c}`;
      track.style.strokeDashoffset = `${c * gap * 0.5}`;
    }
    if(prog){
      const filled = usable * (v/100);
      prog.style.strokeDasharray = `${filled} ${c}`;
      prog.style.strokeDashoffset = `${c * gap * 0.5}`;
    }
  };

  const applyStatus = (pInt)=>{
    const p = Math.max(0, Math.min(100, Math.round(Number(pInt)||0)));
    const sc = statusColorForPercent(p);

    el.style.setProperty('--wheel-glow', sc.glow);
    el.style.setProperty('--wheel-glow-strong', strongerGlow(sc.glow));

    if(stops.length){
      // Same hue, subtle alpha differences via gradient stops
      stops[0]?.setAttribute('stop-color', sc.on);
      stops[1]?.setAttribute('stop-color', sc.on);
      stops[2]?.setAttribute('stop-color', sc.on);
    }

    if(label){
      label.style.color = sc.on;
      label.style.textShadow = `0 10px 30px ${sc.glow}`;
    }

    if(p === 100) el.classList.add('fullPulse');
    else el.classList.remove('fullPulse');
  };

  const applyText = (pRaw)=>{
    const pInt = Math.max(0, Math.min(100, Math.round(Number(pRaw)||0)));
    if(label) label.textContent = `${pInt}%`;
  };

  const setAnimating = (isAnimating)=>{
    if(isAnimating) el.classList.add('isAnimating');
    else el.classList.remove('isAnimating');
  };

  // Reduced motion: snap
  try{
    if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      applyRing(target);
      applyStatus(target);
      applyText(target);
      el.dataset.curPct = String(target);
      try{ localStorage.setItem(LS_KEY, String(target)); }catch(e){}
      return;
    }
  }catch(e){}

  // load → get previousPercent → render ring @ previousPercent → animate(previous → target)
  let prev = Number(el.dataset.curPct);
  if(!Number.isFinite(prev)){
    const stored = Number(localStorage.getItem(LS_KEY));
    prev = Number.isFinite(stored) ? stored : 0;
  }
  prev = Math.max(0, Math.min(100, Math.round(prev)));

  // Render previous first (prevents instant flash to target on load)
  applyRing(prev);
  applyStatus(prev);
  applyText(prev);
  setAnimating(false);

  const start = prev;
  const delta = target - start;

  if(delta === 0){
    el.dataset.curPct = String(target);
    try{ localStorage.setItem(LS_KEY, String(target)); }catch(e){}
    return;
  }

  // --- Spring/Bounce easing ---
  // Produces a soft overshoot + settle. Works for both increase & decrease.
  const spring = (t)=>{
    const x = Math.max(0, Math.min(1, t));
    const damping = 10.5;      // higher = less bounce
    const omega = 12.5;        // higher = faster oscillation
    // 1 - e^{-d t} * cos(ω t)
    return 1 - Math.exp(-damping * x) * Math.cos(omega * x);
  };

  // Duration scales with delta; keep it snappy but readable.
  const dur = Math.max(560, Math.min(1500, 560 + Math.abs(delta) * 9));

  // Micro-delay between ring and % label (premium feel)
  const textLagTauMs = 90; // percent label 'chases' ring smoothly (no weird delay)

  let t0 = 0;
  let lastTs = 0;
  let vText = start;

  // Start anim state
  setAnimating(true);

  function frame(ts){
    if(!t0) t0 = ts;

    const tRing = Math.max(0, Math.min(1, (ts - t0) / dur));
    const eRing = spring(tRing);

    // Ring can move in sub-percent floats for smoother motion
    const vRing = start + delta * eRing;

    // Percent label follows the ring with a small, natural lag (1st-order follower)
    const dt = lastTs ? (ts - lastTs) : 16;
    lastTs = ts;
    const alpha = 1 - Math.exp(-dt / textLagTauMs);
    vText = vText + (vRing - vText) * alpha;

    applyRing(vRing);

    // Status/glow should follow the ring (so color changes feel tied to the motion)
    const ringInt = Math.round(Math.max(0, Math.min(100, vRing)));
    applyStatus(ringInt);

    // Percent updates in real-time during animation
    applyText(vText);

    // Persist last rendered integer as "current"
    el.dataset.curPct = String(ringInt);

    if(tRing < 1){
      requestAnimationFrame(frame);
    }else{
      // Final snap
      applyRing(target);
      applyStatus(target);
      applyText(target);
      setAnimating(false);
      el.dataset.curPct = String(target);
      try{ localStorage.setItem(LS_KEY, String(target)); }catch(e){}
    }
  }

  requestAnimationFrame(frame);
}




function renderHero(){
  const el = document.getElementById("habitsHero");
  if(!el) return;
  // No inline "New habit" field in the page header.
  // Creating habits should happen via the floating action button (FAB) + modal.
  el.innerHTML = '';
}

// Floating "New habit" action
(() => {
  const fab = document.getElementById("fabNewHabit");
  if(!fab) return;
  fab.addEventListener("click", (e)=>{
    e.preventDefault();
    openAddHabit(fab);
  });
})();

