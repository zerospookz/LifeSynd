
(function(){
  const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('.nav a').forEach(a=>{
    const href = (a.getAttribute('href')||'').toLowerCase();
    if(href === path){
      a.classList.add('active');

      // Icon micro-pulse (runs once per page load / tab open)
      const img = a.querySelector('img.navIcon, img.navIconBottom');
      if(img){
        img.classList.remove('pulseOnce');
        // restart animation reliably
        void img.offsetWidth;
        img.classList.add('pulseOnce');
      }
    }
  });

  // Service Worker (required for background Push Notifications)
  // Note: service workers work only on https or localhost.
  if('serviceWorker' in navigator){
    window.__swReady = navigator.serviceWorker.register('sw.js', { scope: './' })
      .then(()=> navigator.serviceWorker.ready)
      .catch(err=>{
        console.warn('SW register failed', err);
        return null;
      });
  } else {
    window.__swReady = Promise.resolve(null);
  }

  // Keyboard-safe layout (mobile): keep inputs and bottom panels visible when the on-screen
  // keyboard opens. We do this by setting a CSS var (--kb) to the keyboard height using
  // VisualViewport (supported on iOS Safari / Chrome Android).
  (function setupKeyboardSafeArea(){
    const vv = window.visualViewport;
    if (!vv) return;

    const setVar = ()=>{
      // Keyboard height ≈ difference between layout viewport and visual viewport.
      const kb = Math.max(0, (window.innerHeight - vv.height - vv.offsetTop) || 0);
      document.documentElement.style.setProperty('--kb', kb ? `${Math.round(kb)}px` : '0px');
    };

    vv.addEventListener('resize', setVar);
    vv.addEventListener('scroll', setVar);
    window.addEventListener('orientationchange', ()=> setTimeout(setVar, 50));
    setVar();

    // When focusing an input, nudge it into view (prevents it from sitting behind the keyboard).
    document.addEventListener('focusin', (e)=>{
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (!t.matches('input, textarea, select')) return;
      setTimeout(()=>{
        try{ t.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }); }catch(_){ }
      }, 60);
    });
  })();
})();
