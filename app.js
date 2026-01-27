(() => {
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Scroll reveal
  const els = Array.from(document.querySelectorAll('.reveal'));
  if (!reduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) e.target.classList.add('in');
    }, { threshold: 0.14 });
    els.forEach(el => io.observe(el));
  } else {
    els.forEach(el => el.classList.add('in'));
  }

  // Mark active links (top nav + side nav)
  const here = location.pathname.split('/').pop() || 'index.html';
  const links = document.querySelectorAll('a[data-nav]');
  links.forEach(a => {
    const target = (a.getAttribute('href') || '').split('/').pop();
    if (target === here) a.classList.add('active');
  });

  // Tiny hover parallax on hero image
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
})();
