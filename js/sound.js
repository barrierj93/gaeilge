(function () {
  'use strict';
  const APP = window.__ga, $ = APP.$;
  const SRC = 'audio/celtic-track.mp3', VOL = 0.42;
  let on = false, raf = 0;
  const a = new Audio();
  a.loop = true; a.preload = 'none'; a.volume = 0; a.src = SRC;

  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'snd';
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" fill-opacity=".18"/>' +
    '<g class="snd__waves"><path d="M15.4 9.2a4 4 0 0 1 0 5.6"/><path d="M17.8 6.8a7.4 7.4 0 0 1 0 10.4"/></g>' +
    '<g class="snd__x"><path d="m16 9.5 5 5M21 9.5l-5 5"/></g></svg>';
  $('.mast__where').after(btn);

  function paint() {
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    const t = on ? 'Mute the music' : 'Play the music';
    btn.setAttribute('aria-label', t); btn.title = t;
  }

  function fade(to, ms, done) {
    cancelAnimationFrame(raf);
    const from = a.volume, t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms);
      try { a.volume = from + (to - from) * k; } catch (_) {}
      if (k < 1) raf = requestAnimationFrame(step); else if (done) done();
    };
    raf = requestAnimationFrame(step);
  }
  function start() {
    on = true; paint(); a.preload = 'auto';
    const p = a.play();
    if (p && p.then) p.then(() => { if (on) fade(VOL, 1500); }).catch(() => { on = false; paint(); });
    else fade(VOL, 1500);
  }
  function stop() { on = false; paint(); fade(0, 600, () => { if (!on) a.pause(); }); }
  let chosen = false;
  btn.addEventListener('click', () => { chosen = true; if (on) stop(); else start(); });

  const firstTouch = e => {
    if (chosen || on || !(APP.mobile && APP.mobile.active) || e.pointerType === 'mouse') return;
    if (e.target && e.target.closest && e.target.closest('.snd')) return;
    start();
  };
  addEventListener('pointerup', firstTouch, { capture: true, passive: true });
  addEventListener('touchend', firstTouch, { capture: true, passive: true });

  document.addEventListener('visibilitychange', () => {
    if (!on) return;
    if (document.hidden) a.pause(); else a.play().catch(() => {});
  });
  a.addEventListener('error', () => { on = false; btn.hidden = true; paint(); });
  paint();
  APP.sound = { btn: btn };
})();
