
(function(){
  const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('.nav a').forEach(a=>{
    const href = (a.getAttribute('href')||'').toLowerCase();
    if(href === path) a.classList.add('active');
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
})();
