(() => {
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===== Theme ===== */
  const root = document.documentElement;
  const saved = localStorage.getItem('lifesync-theme');
  if (saved) root.dataset.theme = saved; // 'light' | 'dark'

  const themeBtn = document.getElementById('themeToggle');
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
           <path d="M21 13.2A8.5 8.5 0 0 1 10.8 3a7 7 0 1 0 10.2 10.2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
         </svg>`;
  };
  setThemeIcon();

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = (root.dataset.theme === 'light') ? 'dark' : 'light';
      root.dataset.theme = next;
      localStorage.setItem('lifesync-theme', next);
      setThemeIcon();
    });
  }

  /* ===== Scroll reveal ===== */
  const els = Array.from(document.querySelectorAll('.reveal'));
  if (!reduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) e.target.classList.add('in');
    }, { threshold: 0.14 });
    els.forEach(el => io.observe(el));
  } else {
    els.forEach(el => el.classList.add('in'));
  }

  /* ===== Active nav ===== */
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('a[data-nav]').forEach(a => {
    const target = (a.getAttribute('href') || '').split('/').pop();
    if (target === here) a.classList.add('active');
  });

  /* ===== Micro-interaction: button ripple origin ===== */
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--mx', `${e.clientX - r.left}px`);
      btn.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

  /* ===== Tiny hover parallax on hero image ===== */
  const hero = document.querySelector('[data-tilt]');
  if (!reduced && hero) {
    const max = 8;
    const onMove = (ev) => {
      const r = hero.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width - 0.5;
      const y = (ev.clientY - r.top) / r.height - 0.5;
      hero.style.transform = `translateY(-6px) rotateX(${(-y*max).toFixed(2)}deg) rotateY(${(x*max).toFixed(2)}deg)`;
    };
    const onLeave = () => hero.style.transform = '';
    hero.addEventListener('mousemove', onMove);
    hero.addEventListener('mouseleave', onLeave);
  }

  /* ===== Animated progress rings ===== */
  const initRing = (el) => {
    const value = Math.max(0, Math.min(100, Number(el.dataset.progress || 0)));
    const label = el.dataset.label || 'Progress';
    const sub = el.dataset.sub || 'This week';
    const radius = 54;
    const circ = 2 * Math.PI * radius;
    el.classList.add('progress');
    el.innerHTML = `
      <svg class="ring" viewBox="0 0 120 120" aria-label="${label}">
        <defs>
          <linearGradient id="ls-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="rgba(79,209,255,1)"/>
            <stop offset="55%" stop-color="rgba(167,139,250,1)"/>
            <stop offset="100%" stop-color="rgba(52,211,153,1)"/>
          </linearGradient>
        </defs>
        <circle class="track" cx="60" cy="60" r="${radius}" stroke="currentColor" stroke-width="10" fill="none"/>
        <circle class="value" cx="60" cy="60" r="${radius}" stroke="url(#ls-grad)" stroke-width="10" fill="none"
          stroke-dasharray="${circ}" stroke-dashoffset="${circ}"
        />
      </svg>
      <div class="ring-label">
        <div class="small">${label}</div>
        <div class="big">${value}<span style="font-size:14px;font-weight:700;opacity:.7">/100</span></div>
        <div class="small">${sub}</div>
      </div>
    `;
    const valueCircle = el.querySelector('.value');
    const targetOffset = circ * (1 - value / 100);
    requestAnimationFrame(() => { valueCircle.style.strokeDashoffset = String(targetOffset); });
  };

  document.querySelectorAll('[data-progress]').forEach(initRing);

  /* ===== Simple charts (bars) ===== */
  const initBars = (wrap) => {
    const bars = Array.from(wrap.querySelectorAll('.bar'));
    bars.forEach((b, i) => {
      const h = Math.max(6, Math.min(100, Number(b.dataset.h || 10)));
      // delay via transition
      b.style.transitionDelay = `${i * 70}ms`;
      requestAnimationFrame(() => {
        b.classList.add('in');
        b.style.height = `${h}%`;
      });
    });
  };

  document.querySelectorAll('[data-chart="bars"]').forEach(initBars);

  /* ===== PWA: service worker + install prompt ===== */
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

  const showInstallToast = () => {
    if (reduced) return;
    if (document.getElementById('pwaToast')) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.id = 'pwaToast';
    toast.innerHTML = `
      <div>
        <div class="toast-title">Install LifeSync</div>
        <div class="toast-text">Add it to your home screen for a fast, app-like experience.</div>
      </div>
      <div class="toast-actions">
        <button class="btn ghost" id="pwaLater">Not now</button>
        <button class="btn primary" id="pwaInstall">Install</button>
      </div>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    toast.querySelector('#pwaLater').addEventListener('click', () => toast.remove());
    toast.querySelector('#pwaInstall').addEventListener('click', async () => {
      if (!deferredPrompt) return toast.remove();
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch {}
      deferredPrompt = null;
      toast.remove();
    });
  };
})();