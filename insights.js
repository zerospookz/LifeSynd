/* Insights (Consistency) – Bento dashboard
   Uses habits stored in localStorage key `habitsV2`.
   Works standalone (no dependency on habits.js UI), but matches the same data model.
*/

(function(){
  const LS_KEY = 'habitsV2';

  const scoreEl = document.getElementById('score');
  const barFill = document.getElementById('barFill');
  const marker = document.getElementById('marker');

  const baselineEl = document.getElementById('baseline');
  const streakEl = document.getElementById('streak');
  const todayEl = document.getElementById('today');
  const nextEl = document.getElementById('next');
  const tipTextEl = document.getElementById('tipText');

  const avg7El = document.getElementById('avg7');
  const deltaEl = document.getElementById('delta');
  const trendStatusEl = document.getElementById('trendStatus');

  const sparkLine = document.getElementById('sparkLine');
  const sparkArea = document.getElementById('sparkArea');

  const chips = Array.from(document.querySelectorAll('.chip[data-range]'));
  const rangeBtns = Array.from(document.querySelectorAll('.range__btn[data-range]'));

  const pctEls = {
    7: document.getElementById('v7'),
    30: document.getElementById('v30'),
    60: document.getElementById('v60'),
    180: document.getElementById('v180'),
  };
  const wEls = {
    7: document.getElementById('w7'),
    30: document.getElementById('w30'),
    60: document.getElementById('w60'),
    180: document.getElementById('w180'),
  };

  function loadHabits(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      const arr = JSON.parse(raw||'[]');
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }

  function isoLocal(d){
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function todayIso(){
    return isoLocal(new Date());
  }

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  function avg(arr){
    if(!arr || !arr.length) return 0;
    return arr.reduce((s,v)=>s+v,0) / arr.length;
  }

  function animateNumber(el, to, dur = 520){
    if(!el) return;
    const from = Number(el.textContent) || 0;
    const start = performance.now();

    function tick(t){
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = String(Math.round(from + (to - from) * eased));
      if(k < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function setMarker(pct){
    const p = clamp(pct, 0, 100);
    marker.style.top = `${100 - p}%`;
  }

  function movingAvg(arr, w=3){
    const out = [];
    for(let i=0;i<arr.length;i++){
      const s = Math.max(0, i - Math.floor(w/2));
      const e = Math.min(arr.length, i + Math.floor(w/2) + 1);
      out.push(avg(arr.slice(s,e)));
    }
    return out;
  }

  function renderSparkline(done14){
    const w = 160, h = 44, padX = 6, padY = 6;
    const vals = movingAvg(done14, 3); // 0..1
    const n = vals.length;
    if(n < 2){
      sparkLine.setAttribute('d','');
      sparkArea.setAttribute('d','');
      return;
    }
    const xStep = (w - padX*2) / (n - 1);

    const pts = vals.map((v, i) => {
      const x = padX + i * xStep;
      const y = padY + (1 - v) * (h - padY*2);
      return {x, y};
    });

    const dLine = pts.map((p, i) => `${i===0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
    const dArea = `${dLine} L ${(padX + (n-1)*xStep).toFixed(2)} ${(h - padY).toFixed(2)} L ${padX.toFixed(2)} ${(h - padY).toFixed(2)} Z`;

    const svg = sparkLine.ownerSVGElement;
    if(svg && !svg.querySelector('#sparkGrad')){
      const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
      defs.innerHTML = `
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="var(--red)"/>
          <stop offset="100%" stop-color="var(--amber)"/>
        </linearGradient>
      `;
      svg.prepend(defs);
    }

    sparkLine.setAttribute('d', dLine);
    sparkArea.setAttribute('d', dArea);
  }

  function computeDailyFractions(habits, days){
    const out = [];
    const end = new Date();
    end.setHours(0,0,0,0);
    const start = new Date(end);
    start.setDate(end.getDate()-(days-1));

    const nHabits = habits.length;
    for(let i=0;i<days;i++){
      const d = new Date(start);
      d.setDate(start.getDate()+i);
      const iso = isoLocal(d);
      let done = 0;
      for(const h of habits){
        const set = new Set(h.datesDone||[]);
        if(set.has(iso)) done++;
      }
      out.push(nHabits ? done / nHabits : 0);
    }
    return out;
  }

  function completionRate(habits, days){
    const nHabits = habits.length;
    if(nHabits <= 0 || days <= 0) return 0;

    const end = new Date();
    end.setHours(0,0,0,0);
    const start = new Date(end);
    start.setDate(end.getDate()-(days-1));

    let done = 0;
    for(let i=0;i<days;i++){
      const d = new Date(start);
      d.setDate(start.getDate()+i);
      const iso = isoLocal(d);
      for(const h of habits){
        const set = new Set(h.datesDone||[]);
        if(set.has(iso)) done++;
      }
    }

    const total = nHabits * days;
    return Math.round((done / total) * 100);
  }

  function maxCurrentStreak(habits){
    const t = todayIso();
    let best = 0;
    for(const h of habits){
      const set = new Set(h.datesDone||[]);
      let cur = 0;
      const d = new Date(t+'T00:00:00');
      while(true){
        const iso = isoLocal(d);
        if(set.has(iso)){
          cur++;
          d.setDate(d.getDate()-1);
        }else{
          break;
        }
      }
      best = Math.max(best, cur);
    }
    return best;
  }

  function todaySummary(habits){
    const iso = todayIso();
    const n = habits.length;
    if(n === 0) return { text: 'No habits yet', done: 0, total: 0, pct: 0 };
    let done = 0;
    for(const h of habits){
      const set = new Set(h.datesDone||[]);
      if(set.has(iso)) done++;
    }
    const pct = Math.round((done / n) * 100);
    return { text: `${done} done today`, done, total: n, pct };
  }

  function coachNext(scorePct, todayPct){
    if(scorePct >= 80) return 'Keep the streak alive — keep it easy.';
    if(scorePct >= 60) return 'Repeat yesterday — don’t add extra.';
    if(scorePct >= 40) return 'Do 5 minutes — then stop.';
    if(todayPct >= 50) return 'Do 2 minutes — stop. Win the day.';
    return 'Pick one tiny action — 2 minutes, done.';
  }

  function coachTip(scorePct){
    if(scorePct >= 70) return '<b>Protect your baseline.</b> Don’t raise the bar every day.';
    if(scorePct >= 45) return '<b>Consistency beats intensity.</b> Show up small, daily.';
    return '<b>Keep it small.</b> Small actions done daily beat big actions done rarely.';
  }

  function updateTrendFromLast14(done14){
    const prev7 = done14.slice(0, 7);
    const this7 = done14.slice(7, 14);

    const prevPct = Math.round(avg(prev7) * 100);
    const thisPct = Math.round(avg(this7) * 100);
    const delta = thisPct - prevPct;

    avg7El.textContent = String(thisPct);

    deltaEl.classList.remove('pos','neg');
    deltaEl.textContent = `${delta >= 0 ? '+' : ''}${delta}% this week`;
    deltaEl.classList.add(delta >= 0 ? 'pos' : 'neg');

    trendStatusEl.classList.remove('up','down','flat');
    if(delta >= 5){
      trendStatusEl.textContent = '↑ Improving';
      trendStatusEl.classList.add('up');
    } else if(delta <= -5){
      trendStatusEl.textContent = '↓ Slipping';
      trendStatusEl.classList.add('down');
    } else {
      trendStatusEl.textContent = '→ Steady';
      trendStatusEl.classList.add('flat');
    }

    renderSparkline(done14);
  }

  function setActiveRange(r){
    const habits = loadHabits();

    // selection styling
    rangeBtns.forEach(b => b.classList.toggle('is-on', Number(b.dataset.range) === r));

    // primary score
    const score = completionRate(habits, r);
    animateNumber(scoreEl, score);

    baselineEl.textContent = String(r);

    // bar
    barFill.style.height = `${score}%`;
    setMarker(score);

    // windows (always show current rolling)
    const v7 = completionRate(habits, 7);
    const v30 = completionRate(habits, 30);
    const v60 = completionRate(habits, 60);
    const v180 = completionRate(habits, 180);

    const vals = {7:v7,30:v30,60:v60,180:v180};
    for(const k of [7,30,60,180]){
      if(pctEls[k]) pctEls[k].textContent = `${vals[k]}%`;
      if(wEls[k]) wEls[k].style.setProperty('--w', `${clamp(vals[k],0,100)}%`);
    }

    // streak
    animateNumber(streakEl, maxCurrentStreak(habits));

    // today + guidance
    const t = todaySummary(habits);
    todayEl.textContent = t.total ? t.text : 'No activity';
    nextEl.textContent = coachNext(score, t.pct);
    if(tipTextEl) tipTextEl.innerHTML = coachTip(score);

    // trend sparkline from last 14 days
    const done14 = computeDailyFractions(habits, 14);
    updateTrendFromLast14(done14);

    // persist
    try{ localStorage.setItem('insightsRange', String(r)); }catch(e){}
  }

  // interactions
  rangeBtns.forEach(btn => btn.addEventListener('click', () => setActiveRange(Number(btn.dataset.range))));
  chips.forEach(ch => ch.addEventListener('click', () => setActiveRange(Number(ch.dataset.range))));

  // init
  const initRange = Number(localStorage.getItem('insightsRange')||'180') || 180;
  setActiveRange([7,30,60,180].includes(initRange) ? initRange : 180);
})();
