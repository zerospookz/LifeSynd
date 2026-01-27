(() => {
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* =========================
     Toast
  ========================= */
  function toast(message, { timeout = 2400 } = {}) {
    // Re-use the same toast styling for both PWA + simple messages
    const t = document.createElement('div');
    t.className = 'toast toast--simple';
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    t.innerHTML = `<div class="toast-text">${message}</div>`;
    document.body.appendChild(t);

    requestAnimationFrame(() => t.classList.add('show'));
    window.setTimeout(() => {
      t.classList.remove('show');
      window.setTimeout(() => t.remove(), 260);
    }, timeout);
  }

  /* =========================
     Theme
  ========================= */
  const root = document.documentElement;
  const saved = localStorage.getItem('lifesync-theme');
  if (saved) root.dataset.theme = saved; // 'light' | 'dark'

  const themeBtn = $('#themeToggle');
  const setThemeIcon = () => {
    if (!themeBtn) return;
    const isLight = (root.dataset.theme === 'light');
    themeBtn.innerHTML = isLight
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
           <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" stroke-width="2"/>
           <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
             stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
         </svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
           <path d="M21 13.2A7.5 7.5 0 1 1 10.8 3a6 6 0 1 0 10.2 10.2Z"
             stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
         </svg>`;
  };
  setThemeIcon();

  themeBtn?.addEventListener('click', () => {
    const next = (root.dataset.theme === 'light') ? 'dark' : 'light';
    root.dataset.theme = next;
    localStorage.setItem('lifesync-theme', next);
    setThemeIcon();
  });

  /* =========================
     Scroll reveal
  ========================= */
  const revealEls = $$('.reveal');
  if (!reduced && 'IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12 });

    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }

  /* =========================
     Subtle hero parallax
  ========================= */
  const hero = $('#heroTilt');
  if (!reduced && hero) {
    let raf = null;
    const onMove = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const r = hero.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = (e.clientX - cx) / r.width;
        const dy = (e.clientY - cy) / r.height;
        hero.style.transform = `translate3d(0,0,0) rotateX(${(-dy * 6).toFixed(2)}deg) rotateY(${(dx * 8).toFixed(2)}deg)`;
      });
    };
    const reset = () => hero.style.transform = '';
    hero.addEventListener('mousemove', onMove);
    hero.addEventListener('mouseleave', reset);
  }

  /* =========================
     Progress rings + bar charts
  ========================= */
  const initRings = () => {
    $$('.ring[data-progress]').forEach((el) => {
      const p = Math.max(0, Math.min(100, Number(el.dataset.progress || 0)));
      el.style.setProperty('--p', String(p));
      if (el.dataset.label) el.setAttribute('aria-label', `${el.dataset.label}: ${p}%`);
    });
  };

  const initBars = (wrap) => {
    const bars = $$('.bar', wrap);
    bars.forEach((b, i) => {
      const h = Math.max(6, Math.min(100, Number(b.dataset.h || 10)));
      b.style.transitionDelay = `${i * 70}ms`;
      requestAnimationFrame(() => {
        b.classList.add('in');
        b.style.height = `${h}%`;
      });
    });
  };

  initRings();
  $$('[data-chart="bars"]').forEach(initBars);

  /* =========================
     Modal (used by Demo + Add)
  ========================= */
  function ensureModal() {
    let m = $('#lsModal');
    if (m) return m;

    m = document.createElement('div');
    m.className = 'modal';
    m.id = 'lsModal';
    m.setAttribute('aria-hidden', 'true');
    m.innerHTML = `
      <div class="modal-overlay" data-modal-close></div>
      <div class="modal-dialog" role="dialog" aria-modal="true" aria-label="LifeSync dialog">
        <button class="modal-close" type="button" aria-label="Close" data-modal-close>✕</button>
        <div class="modal-body"></div>
      </div>
    `;
    document.body.appendChild(m);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && m.classList.contains('open')) closeModal();
    });

    m.addEventListener('click', (e) => {
      if (e.target.closest('[data-modal-close]')) closeModal();
    });

    return m;
  }

  function openModal(html) {
    const m = ensureModal();
    $('.modal-body', m).innerHTML = html;
    m.classList.add('open');
    m.setAttribute('aria-hidden', 'false');

    // focus first focusable element
    const focusable = m.querySelector('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusable?.focus({ preventScroll: true });
  }

  function closeModal() {
    const m = $('#lsModal');
    if (!m) return;
    m.classList.remove('open');
    m.setAttribute('aria-hidden', 'true');
  }

  /* =========================
     "Working" buttons (no preview-only)
  ========================= */
  function nowTime() {
    try {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'now';
    }
  }

  function doSync() {
    const el = $('#lastSync');
    if (el) el.textContent = `Synced • ${nowTime()}`;
    toast('Synced ✓');
    // tiny haptic-like pulse
    document.body.classList.add('pulse');
    setTimeout(() => document.body.classList.remove('pulse'), 220);
  }

  function demoContent() {
    return `
      <div class="modal-title">LifeSync demo</div>
      <div class="modal-sub">Explore the fully-working UI — everything here is clickable and saved locally.</div>

      <div class="modal-grid">
        <a class="cardlink" href="dashboard.html">
          <div class="cardlink-title">Dashboard</div>
          <div class="cardlink-sub">Your daily overview + quick actions.</div>
        </a>
        <a class="cardlink" href="finances.html">
          <div class="cardlink-title">Finances</div>
          <div class="cardlink-sub">Add transactions + view activity.</div>
        </a>
        <a class="cardlink" href="habits.html">
          <div class="cardlink-title">Habits</div>
          <div class="cardlink-sub">Toggle habits + add new ones.</div>
        </a>
        <a class="cardlink" href="workouts.html">
          <div class="cardlink-title">Workouts</div>
          <div class="cardlink-sub">Plan sessions + mark done.</div>
        </a>
        <a class="cardlink" href="nutrition.html">
          <div class="cardlink-title">Nutrition</div>
          <div class="cardlink-sub">Log meals + track calories.</div>
        </a>
      </div>

      <div class="modal-actions">
        <button class="btn ghost" type="button" data-modal-close>Close</button>
        <a class="btn primary" href="dashboard.html">Open Dashboard</a>
      </div>
    `;
  }

  function openAddForPage(page) {
    const p = page || document.body.dataset.page || 'dashboard';

    if (p === 'finances') return openModal(addFinanceForm());
    if (p === 'habits') return openModal(addHabitForm());
    if (p === 'workouts') return openModal(addWorkoutForm());
    if (p === 'nutrition') return openModal(addMealForm());

    // dashboard: give quick shortcuts
    openModal(`
      <div class="modal-title">Quick add</div>
      <div class="modal-sub">Pick what you want to add.</div>
      <div class="modal-grid">
        <button class="cardlink" type="button" data-quick="finances">
          <div class="cardlink-title">Expense</div>
          <div class="cardlink-sub">Add a transaction</div>
        </button>
        <button class="cardlink" type="button" data-quick="habits">
          <div class="cardlink-title">Habit</div>
          <div class="cardlink-sub">Add a new habit</div>
        </button>
        <button class="cardlink" type="button" data-quick="workouts">
          <div class="cardlink-title">Workout</div>
          <div class="cardlink-sub">Add a workout block</div>
        </button>
        <button class="cardlink" type="button" data-quick="nutrition">
          <div class="cardlink-title">Meal</div>
          <div class="cardlink-sub">Log a meal</div>
        </button>
      </div>
      <div class="modal-actions">
        <button class="btn ghost" type="button" data-modal-close>Cancel</button>
      </div>
    `);
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-action]');
    if (!a) return;

    const action = a.dataset.action;
    if (action === 'open-demo') {
      e.preventDefault();
      openModal(demoContent());
    }
    if (action === 'sync') {
      e.preventDefault();
      doSync();
    }
    if (action === 'add') {
      e.preventDefault();
      openAddForPage(document.body.dataset.page);
    }
  });

  // quick add on dashboard modal
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-quick]');
    if (!b) return;
    const target = b.dataset.quick;
    closeModal();
    openAddForPage(target);
  });

  /* =========================
     Habits: toggle + persist
  ========================= */
  const HABITS_KEY = 'lifesync-habits-v1';

  function readHabitsFromDom() {
    const list = $('#habitsList');
    if (!list) return [];
    return $$('.item', list).map((it) => ({
      title: $('.title', it)?.textContent?.trim() || 'Habit',
      sub: $('.sub', it)?.textContent?.trim() || '',
      done: (it.classList.contains('done') || $('.right', it)?.textContent?.includes('✅'))
    }));
  }

  
  function renderHabits(habits) {
    const list = $('#habitsList');
    if (!list) return;
    list.innerHTML = '';
    habits.forEach((h) => {
      const it = document.createElement('div');
      it.className = 'habit-card reveal' + (h.done ? ' done' : '');
      it.setAttribute('data-toggle', '');
      it.innerHTML = `
        <div class="habit-ico">${escapeHtml(h.icon || pickHabitIcon(h.title))}</div>
        <div class="habit-body">
          <div class="row" style="gap:10px; align-items:center;">
            <div class="title">${escapeHtml(h.title)}</div>
            <span class="badge ${h.badgeType || ''}">${escapeHtml(h.badge || (h.done ? '+1 streak' : 'Queued'))}</span>
          </div>
          <div class="sub">${escapeHtml(h.sub || 'Daily')}</div>
          <div class="mini">
            <span class="dot ${h.done ? 'ok' : ''}"></span><span class="small">${h.done ? 'Done' : 'Pending'}</span>
            <span class="spacer"></span>
            <span class="small">${h.done ? '✅' : '○'}</span>
          </div>
        </div>
        <div class="habit-actions">
          <label class="switch" aria-label="Toggle habit">
            <input type="checkbox" ${h.done ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
      `;
      list.appendChild(it);
    });

    // re-trigger reveal for new items
    if (!reduced) $$('.reveal', list).forEach((el) => el.classList.add('in'));

    // update KPIs + heatmap
    updateHabitInsights();
  }


  function loadHabits() {
    const list = $('#habitsList');
    if (!list) return;
    const saved = localStorage.getItem(HABITS_KEY);
    if (saved) {
      try { renderHabits(JSON.parse(saved)); } catch {}
    } else {
      const dom = readHabitsFromDom();
      localStorage.setItem(HABITS_KEY, JSON.stringify(dom));
      updateHabitInsights();
    }
  }

  

  function pickHabitIcon(title='') {
    const t = (title || '').toLowerCase();
    if (t.includes('walk') || t.includes('run')) return '🚶';
    if (t.includes('read')) return '📖';
    if (t.includes('water')) return '💧';
    if (t.includes('stretch') || t.includes('yoga')) return '🧘';
    if (t.includes('work') || t.includes('pomodoro')) return '🧠';
    if (t.includes('medit')) return '🧘';
    if (t.includes('gym') || t.includes('lift')) return '🏋️';
    return '✨';
  }

  function seededRand(seed) {
    // deterministic pseudo random in [0,1)
    let h = 2166136261;
    for (let i=0; i<seed.length; i++) { h ^= seed.charCodeAt(i); h += (h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24); }
    h = h >>> 0;
    return () => {
      h = (h * 1664525 + 1013904223) >>> 0;
      return h / 4294967296;
    };
  }

  function updateHabitInsights() {
    const list = $('#habitsList');
    if (!list) return;
    const items = $$('.habit-card', list);
    const total = items.length || 0;
    const done = items.filter(it => it.classList.contains('done') || $('input[type="checkbox"]', it)?.checked).length;
    const pct = total ? Math.round((done/total)*100) : 0;

    const el = $('#habitConsistency');
    if (el) el.textContent = pct ? `${pct}%` : '—';

    // heatmap: 28 days
    const heat = $('#habitHeatmap');
    if (!heat) return;
    heat.innerHTML = '';
    const today = new Date();
    const seed = (today.toISOString().slice(0,10)) + '|' + items.map(i => $('.title', i)?.textContent||'').join(',');
    const rnd = seededRand(seed);

    // generate intensity based on overall pct, with slight variance
    const base = Math.max(.08, Math.min(.92, pct/100));
    for (let i=27; i>=0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const variance = (rnd() - .5) * .28;
      const a = Math.max(0, Math.min(1, base + variance));
      const cell = document.createElement('div');
      cell.className = 'hm-cell';
      cell.style.setProperty('--a', a.toFixed(3));
      cell.title = `${d.toDateString()} • ${Math.round(a*100)}%`;
      heat.appendChild(cell);
    }
  }
function saveHabitsFromDom() {
    const list = $('#habitsList');
    if (!list) return;
    const habits = $$('.habit-card, .item', list).map((it) => ({
      title: $('.title', it)?.textContent?.trim() || 'Habit',
      sub: $('.sub', it)?.textContent?.trim() || '',
      done: it.classList.contains('done') || $('input[type="checkbox"]', it)?.checked || $('.right', it)?.textContent?.includes('✅'),
    }));
    localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
  }

  document.addEventListener('click', (e) => {
    const it = e.target.closest('#habitsList [data-toggle]');
    if (!it) return;
    const input = $('input[type="checkbox"]', it);
    const was = it.classList.contains('done') || !!(input && input.checked);

    // If the user clicked the checkbox, honor its state. Otherwise toggle.
    const next = (e.target && e.target.matches('input[type="checkbox"]')) ? input.checked : !was;
    if (input) input.checked = next;
    it.classList.toggle('done', next);

    saveHabitsFromDom();
    updateHabitInsights();
    toast(next ? 'Habit completed 🎉' : 'Habit unchecked');
  });

  /* =========================
     Finances: add transactions + persist
  ========================= */
  const TX_KEY = 'lifesync-tx-v1';

  function addFinanceForm() {
    return `
      <div class="modal-title">Add transaction</div>
      <form class="form" id="txForm">
        <label>Merchant<input name="merchant" required placeholder="Starbucks"/></label>
        <label>Category<input name="category" required placeholder="Food"/></label>
        <label>Amount<input name="amount" required inputmode="decimal" placeholder="12.50"/></label>
        <label>Date<input name="date" required type="date"/></label>
        <div class="modal-actions">
          <button class="btn ghost" type="button" data-modal-close>Cancel</button>
          <button class="btn primary" type="submit">Add</button>
        </div>
      </form>
    `;
  }

  function getTx() {
    try { return JSON.parse(localStorage.getItem(TX_KEY) || '[]'); } catch { return []; }
  }

  function setTx(arr) {
    localStorage.setItem(TX_KEY, JSON.stringify(arr));
  }

  function renderTx() {
    const body = $('#transactionsBody');
    if (!body) return;
    const tx = getTx();
    // keep existing static rows as "seed" only if no saved data
    if (!tx.length) return;

    body.innerHTML = tx.map((t) => `
      <tr>
        <td>${escapeHtml(t.merchant)}</td>
        <td><span class="chip">${escapeHtml(t.category)}</span></td>
        <td>${escapeHtml(t.dateLabel)}</td>
        <td style="text-align:right;">${escapeHtml(t.amountLabel)}</td>
      </tr>
    `).join('');
  }

  /* =========================
     Workouts: add blocks + persist
  ========================= */
  const WO_KEY = 'lifesync-workouts-v1';

  function addWorkoutForm() {
    return `
      <div class="modal-title">Add workout block</div>
      <form class="form" id="woForm">
        <label>Title<input name="title" required placeholder="Upper Body"/></label>
        <label>Details<input name="sub" required placeholder="Strength · 45 min"/></label>
        <div class="modal-actions">
          <button class="btn ghost" type="button" data-modal-close>Cancel</button>
          <button class="btn primary" type="submit">Add</button>
        </div>
      </form>
    `;
  }

  function getWorkouts() {
    try { return JSON.parse(localStorage.getItem(WO_KEY) || '[]'); } catch { return []; }
  }
  function setWorkouts(arr) { localStorage.setItem(WO_KEY, JSON.stringify(arr)); }

  
  function normalizeWorkout(x, idx=0) {
    const id = x.id || `wo_${idx}_${hashStr(x.title || '')}`;
    return {
      id,
      title: x.title || 'Workout',
      sub: x.sub || '',
      done: !!x.done
    };
  }

  function renderWorkouts() {
    const list = $('#workoutsList');
    if (!list) return;
    const w = getWorkouts().map(normalizeWorkout);
    if (!w.length) return;

    list.innerHTML = '';
    w.forEach((x) => {
      const it = document.createElement('div');
      it.className = 'workout-card reveal' + (x.done ? ' done' : '');
      it.setAttribute('data-id', x.id);
      it.innerHTML = `
        <div class="workout-top">
          <div class="workout-title">
            <div class="title">${escapeHtml(x.title)}</div>
            <div class="sub">${escapeHtml(x.sub)}</div>
          </div>
          <div class="workout-meta">
            <span class="chip">${x.done ? 'Completed' : 'Planned'}</span>
            <span class="chip ghost">Today</span>
          </div>
        </div>
        <div class="workout-bottom">
          <div class="tiny">${x.done ? 'Nice work — keep the streak 💪' : 'Tap done when you finish.'}</div>
          <div class="spacer"></div>
          <button class="btn ${x.done ? 'primary' : 'ghost'}" type="button" data-mark-done>${x.done ? 'Done ✓' : 'Mark done'}</button>
        </div>
      `;
      list.appendChild(it);
    });

    // persist normalized back (adds ids)
    setWorkouts(w);

    if (!reduced) $$('.reveal', list).forEach((el) => el.classList.add('in'));
  }


  document.addEventListener('click', (e) => {
    const b = e.target.closest('#workoutsList [data-mark-done]');
    if (!b) return;
    const card = b.closest('[data-id], .workout-card, .item');
    if (!card) return;
    const id = card.getAttribute('data-id');
    const w = getWorkouts().map(normalizeWorkout);
    const idx = w.findIndex(x => x.id === id);
    if (idx >= 0) {
      w[idx].done = !w[idx].done;
      setWorkouts(w);
      renderWorkouts();
      toast(w[idx].done ? 'Workout completed 💪' : 'Workout set back to planned');
    } else {
      card.classList.toggle('done');
      toast('Updated');
    }
  });

  /* =========================
     Nutrition: add meals + persist
  ========================= */
  const MEAL_KEY = 'lifesync-meals-v1';

  function addMealForm() {
    return `
      <div class="modal-title">Log meal</div>
      <form class="form" id="mealForm">
        <label>Meal<input name="title" required placeholder="Chicken Salad"/></label>
        <label>Calories<input name="cal" required inputmode="numeric" placeholder="520"/></label>
        <div class="modal-actions">
          <button class="btn ghost" type="button" data-modal-close>Cancel</button>
          <button class="btn primary" type="submit">Log</button>
        </div>
      </form>
    `;
  }

  function getMeals() {
    try { return JSON.parse(localStorage.getItem(MEAL_KEY) || '[]'); } catch { return []; }
  }
  function setMeals(arr) { localStorage.setItem(MEAL_KEY, JSON.stringify(arr)); }

  function renderMeals() {
    const list = $('#mealsList');
    if (!list) return;
    const meals = getMeals();
    if (!meals.length) return;

    list.innerHTML = '';
    meals.forEach((m) => {
      const it = document.createElement('div');
      it.className = 'item reveal';
      it.innerHTML = `
        <div class="left">
          <div class="title">${escapeHtml(m.title)}</div>
          <div class="sub">${escapeHtml(m.sub)}</div>
        </div>
        <div class="right">${escapeHtml(m.right)}</div>
      `;
      list.appendChild(it);
    });
    if (!reduced) $$('.reveal', list).forEach((el) => el.classList.add('in'));
  }

  /* =========================
     Form submits
  ========================= */
  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;

    if (form.id === 'txForm') {
      e.preventDefault();
      const merchant = form.merchant.value.trim();
      const category = form.category.value.trim();
      const amount = form.amount.value.trim();
      const date = form.date.value;
      const d = date ? new Date(date) : new Date();

      const amountNum = Number(amount.replace(/[^0-9.\-]/g, ''));
      const amountLabel = isFinite(amountNum) ? `$${amountNum.toFixed(2)}` : `$${amount}`;
      const dateLabel = isFinite(d.getTime())
        ? d.toLocaleDateString([], { month: 'short', day: 'numeric' })
        : date;

      const tx = getTx();
      tx.unshift({ merchant, category, amountLabel, dateLabel, ts: Date.now() });
      setTx(tx);
      renderTx();

      closeModal();
      toast('Transaction added');
      return;
    }

    if (form.id === 'habitForm') {
      e.preventDefault();
      const title = form.title.value.trim();
      const sub = form.sub.value.trim();
      const list = $('#habitsList');
      if (!list) return;
      const habits = (localStorage.getItem(HABITS_KEY) ? JSON.parse(localStorage.getItem(HABITS_KEY)) : readHabitsFromDom());
      habits.unshift({ title, sub, done: false });
      localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
      renderHabits(habits);
      closeModal();
      toast('Habit added');
      return;
    }

    if (form.id === 'woForm') {
      e.preventDefault();
      const title = form.title.value.trim();
      const sub = form.sub.value.trim();
      const w = getWorkouts();
      w.unshift({ title, sub });
      setWorkouts(w);
      renderWorkouts();
      closeModal();
      toast('Workout block added');
      return;
    }

    if (form.id === 'mealForm') {
      e.preventDefault();
      const title = form.title.value.trim();
      const cal = form.cal.value.trim();
      const c = Number(cal.replace(/[^0-9]/g, ''));
      const calLabel = isFinite(c) ? `${c} cal` : `${cal} cal`;
      const meals = getMeals();
      meals.unshift({ title, sub: 'Logged just now', right: calLabel });
      setMeals(meals);
      renderMeals();
      closeModal();
      toast('Meal logged 🥗');
      return;
    }
  });

  function addHabitForm() {
    return `
      <div class="modal-title">Add habit</div>
      <form class="form" id="habitForm">
        <label>Habit<input name="title" required placeholder="Drink water"/></label>
        <label>Details<input name="sub" required placeholder="8 cups"/></label>
        <div class="modal-actions">
          <button class="btn ghost" type="button" data-modal-close>Cancel</button>
          <button class="btn primary" type="submit">Add</button>
        </div>
      </form>
    `;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }


  function hashStr(s='') {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
    return Math.abs(h).toString(36);
  }

  // load persisted data for relevant pages
  window.addEventListener('DOMContentLoaded', () => {
    loadHabits();
    renderTx();
    renderWorkouts();
    renderMeals();

    // seed workout & meals if none stored but lists exist
    if ($('#workoutsList') && !getWorkouts().length) {
      const seed = $$('#workoutsList .item').map((it) => ({
        title: $('.title', it)?.textContent?.trim() || 'Workout',
        sub: $('.sub', it)?.textContent?.trim() || '',
      }));
      if (seed.length) setWorkouts(seed);
    }
    if ($('#mealsList') && !getMeals().length) {
      const seed = $$('#mealsList .item').map((it) => ({
        title: $('.title', it)?.textContent?.trim() || 'Meal',
        sub: $('.sub', it)?.textContent?.trim() || '',
        right: $('.right', it)?.textContent?.trim() || '',
      }));
      if (seed.length) setMeals(seed);
    }
  });

  /* =========================
     PWA: service worker + install prompt
  ========================= */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallToast();
  });

  function showInstallToast() {
    if (reduced) return;
    if ($('#pwaToast')) return;

    const toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.id = 'pwaToast';
    toastEl.innerHTML = `
      <div>
        <div class="toast-title">Install LifeSync</div>
        <div class="toast-text">Add it to your home screen for a fast, app-like experience.</div>
      </div>
      <div class="toast-actions">
        <button class="btn ghost" id="pwaLater" type="button">Not now</button>
        <button class="btn primary" id="pwaInstall" type="button">Install</button>
      </div>
    `;
    document.body.appendChild(toastEl);
    requestAnimationFrame(() => toastEl.classList.add('show'));

    $('#pwaLater', toastEl)?.addEventListener('click', () => {
      toastEl.classList.remove('show');
      setTimeout(() => toastEl.remove(), 250);
    });

    $('#pwaInstall', toastEl)?.addEventListener('click', async () => {
      toastEl.classList.remove('show');
      setTimeout(() => toastEl.remove(), 250);
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch {}
      deferredPrompt = null;
    });
  }
})();