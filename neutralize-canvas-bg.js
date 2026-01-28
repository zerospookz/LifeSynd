
// LifeSync – Neutral Canvas Background Override
(function () {
  function neutralize(canvas) {
    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const draw = () => {
        const w = canvas.width = window.innerWidth;
        const h = canvas.height = window.innerHeight;
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, "#020617");
        g.addColorStop(0.5, "#030712");
        g.addColorStop(1, "#020617");
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      };

      draw();
      window.addEventListener("resize", draw);
    } catch (e) {}
  }

  function scan() {
    document.querySelectorAll("canvas").forEach(neutralize);
  }

  // Initial + delayed scan (for dynamically injected canvas)
  scan();
  setTimeout(scan, 500);
  setTimeout(scan, 1500);
})();
