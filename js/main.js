(function () {
  'use strict';
  const APP = window.__ga, $$ = APP.$$, clamp = APP.clamp, secs = APP.secs, world = APP.world, n = secs.length;
  let tops = [], hs = [], vh = innerHeight, vs = vh;

  const TOUCH = APP.TOUCH;
  const probe = h => { const d = document.createElement('div'); d.setAttribute('aria-hidden', 'true'); d.style.cssText = 'position:absolute;left:0;top:0;width:1px;visibility:hidden;pointer-events:none;height:100vh;height:' + h; document.body.appendChild(d); return d; };
  const pL = TOUCH ? probe('100lvh') : null, pS = TOUCH ? probe('100svh') : null;
  function heights() {
    vh = pL ? (pL.offsetHeight || innerHeight) : innerHeight;
    vs = pS ? Math.min(vh, pS.offsetHeight || vh) : vh;
  }
  const strip = document.querySelector('.strip'), inniu = document.getElementById('inniu');

  const slides = $$('.step--slide').map(st => ({ st: st, card: st.querySelector('.gloss'), top: 0.26, p: 0 }));
  const census = slides.find(s => s.st.closest('#culu') && !s.st.matches(':first-child'));
  let stripOn = null;

  const swaps = APP.RM ? [] : [
    ['#cloch .step:last-child .gloss', '#lamhscribhinn .step:first-child .gloss', -1, 0.75],
    ['#gaeltacht .step:nth-child(2) .gloss', '#gaeltacht .step:last-child .gloss', 1, 0.12]
  ].map(c => {
    const o = document.querySelector(c[0]), i = document.querySelector(c[1]);
    if (!o || !i) return null;
    o.parentNode.classList.add('step--swap'); i.parentNode.classList.add('step--swap');
    return { o: o, i: i, so: o.parentNode, si: i.parentNode, dir: c[2], lh: c[3], S0: 0, S1: 1, R: 1, dxo: 0, dxi: 0 };
  }).filter(Boolean);
  const swap = swaps[0], gswap = swaps[1];
  const pageTop = el => { let y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; };
  function measure() {
    if (APP.mobile && APP.mobile.active) return;
    heights();
    const gapB = Math.max(14, vs * 0.022), stripH = strip ? strip.offsetHeight + 8 : 0;
    const pinB = (h, x) => vs - h - gapB - (x || 0);
    swaps.forEach(w => {

      w.o.style.transform = w.i.style.transform = '';
      const ho = w.o.offsetHeight, hi = w.i.offsetHeight, Lh = vh * w.lh, Ls = vh * 0.55;
      const pin = h => h <= vh * 0.92 ? Math.max(vh * 0.04, (vh - h) / 2) : vh - h - vh * 0.05;
      const to = pin(ho), ti = pin(hi);
      w.o.style.top = to.toFixed(1) + 'px'; w.i.style.top = ti.toFixed(1) + 'px';
      const pbo = parseFloat(getComputedStyle(w.so).paddingBottom) || 0, Ho = ho + Lh + Ls + pbo;
      w.so.style.minHeight = Ho.toFixed(1) + 'px';
      w.S1 = pageTop(w.so) + Ho - pbo - to - ho; w.S0 = w.S1 - Ls;

      w.si.style.marginTop = '0px'; w.si.style.minHeight = '';
      const natTop = pageTop(w.si), natH = w.si.offsetHeight, M = Math.max(0, natTop - (w.S0 + ti));
      w.si.style.marginTop = (-M).toFixed(1) + 'px'; w.si.style.minHeight = (natH + M).toFixed(1) + 'px';
      const pbi = parseFloat(getComputedStyle(w.si).paddingBottom) || 0;
      w.R = pageTop(w.si) + w.si.offsetHeight - pbi - ti - hi;
      const ro = w.o.getBoundingClientRect(), ri = w.i.getBoundingClientRect(), W = innerWidth;
      w.dxo = w.dir < 0 ? -(ro.right + 24) : (W - ro.left + 24);
      w.dxi = w.dir < 0 ? (W - ri.left + 24) : -(ri.right + 24);
    });
    slides.forEach(s => {
      if (s.card.style.top) s.card.style.top = '';
      if (TOUCH) {
        const h = s.card.offsetHeight, t = parseFloat(getComputedStyle(s.card).top) || 0, x = s === census ? stripH : 0;
        if (t + h > vs - gapB - x) s.card.style.top = pinB(h, x).toFixed(1) + 'px';
      }
      s.top = (parseFloat(getComputedStyle(s.card).top) || vh * 0.26) / vh;
    });
    secs.forEach((s, i) => { const r = s.getBoundingClientRect(); tops[i] = r.top + scrollY; hs[i] = r.height; });
    if (swap && world && world.setSwap) world.setSwap({ s0: uAtY(swap.S0 + vh * 0.5), s1: uAtY(swap.S1 + vh * 0.5) });

    if (gswap && world && world.setBeyond) world.setBeyond({ in: uAtY(gswap.S0 + vh * 0.5), full: uAtY(gswap.S1 + vh * 0.5), out: uAtY(gswap.R + vh * 0.5) });

    const gc = document.querySelector('#gaeltacht .step--hold .gloss');
    if (gc) {
      const st = gc.closest('.step'), h = gc.offsetHeight, ht = TOUCH && h > vs * 0.92 ? pinB(h) : Math.max(vh * 0.04, (vh - h) / 2);
      gc.style.setProperty('--hold-top', ht.toFixed(1) + 'px');
      const sr = st.getBoundingClientRect(), T = sr.top + scrollY, pb = parseFloat(getComputedStyle(st).paddingBottom) || 0;
      const y0 = T - ht + vh * 0.5, y1 = T + sr.height - pb - ht - h + vh * 0.5;
      if (world && world.setMapHold) world.setMapHold({ h0: uAtY(y0), h1: uAtY(y1) });
    }

    const cc = document.querySelector('#lamhscribhinn .step--hold .gloss');
    if (cc) {
      const st = cc.closest('.step'), h = cc.offsetHeight, ht = TOUCH && h > vs * 0.92 ? pinB(h) : Math.max(vh * 0.04, (vh - h) / 2);
      cc.style.setProperty('--hold-top', ht.toFixed(1) + 'px');
      const sr = st.getBoundingClientRect(), T = sr.top + scrollY, pb = parseFloat(getComputedStyle(st).paddingBottom) || 0;
      const y0 = T - ht + vh * 0.5, y1 = T + sr.height - pb - ht - h + vh * 0.5;

      const cs = slides.find(x => x.st.closest('#culu') && x.st.matches(':first-child'));
      let pills = 3.05, knots = 3.12;
      if (cs) { const T = cs.st.getBoundingClientRect().top + scrollY, y = T - cs.top * vh + vh * 0.5; pills = uAtY(y); knots = uAtY(y + vh * 0.45); }
      if (world && world.setCross) world.setCross({ in: uAtY(y0 - vh * 0.12), full: uAtY(y0), out: uAtY(y1 - vh * 0.04), knots: knots, pills: pills });
    }

    const rv = document.querySelector('#athbheochan .step:first-child .gloss'), sc = document.querySelector('#athbheochan .step:last-child .gloss');
    if (world && world.setAvenue && rv && sc) {
      const a = rv.getBoundingClientRect(), b = sc.getBoundingClientRect();
      world.setAvenue({ revIn: uAtY(a.top + scrollY - vh * 0.25), revOut: uAtY(a.top + scrollY + vh * 0.48), sch: uAtY((b.top + b.bottom) / 2 + scrollY) });
    }
    const bc = !gswap && document.querySelector('#gaeltacht .step:last-child .gloss');
    if (world && world.setBeyond && bc) {
      const r = bc.getBoundingClientRect();
      world.setBeyond({ in: uAtY(r.top + scrollY - vh * 0.22), full: uAtY(r.top + scrollY + vh * 0.18), out: uAtY(r.bottom + scrollY + vh * 0.05) });
    }
  }
  function uAtY(y) {
    let i = 0;
    while (i < n - 1 && y >= tops[i + 1]) i++;
    const s = span(i);
    return i + clamp((y - s[0]) / s[1], 0, 1);
  }
  function span(i) {
    let a = tops[i], h = hs[i];
    if (i === 0) { a += vh * 0.5; h -= vh * 0.5; }
    if (i === n - 1) h -= vh * 0.5;
    return [a, Math.max(1, h)];
  }
  function uNow() { return uAtY(scrollY + vh * 0.5); }
  function scrollToU(u) {
    const i = clamp(Math.floor(u), 0, n - 1), s = span(i);
    scrollTo({ top: s[0] + (u - i) * s[1] - vh * 0.5, behavior: APP.RM ? 'auto' : 'smooth' });
  }
  APP.scrollToU = scrollToU;
  APP.hooks.goYear = y => { if (world) scrollToU(world.uForYear(y)); };

  const steps = $$('#inniu .step');
  function activeForm() {
    let best = 0, bd = 1e9;
    steps.forEach(s => { const r = s.getBoundingClientRect(), d = Math.abs((r.top + r.bottom) / 2 - vh / 2); if (d < bd) { bd = d; best = +s.dataset.form; } });
    return best;
  }
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (APP.mobile && APP.mobile.active) {
      const um = APP.mobile.update(dt);
      if (world) world.frame(um, dt);
      else APP.setCensus(clamp(Math.round((um - 3.74) / 1.2 * (APP.D.census.length - 1)), 0, APP.D.census.length - 1));
      requestAnimationFrame(loop); return;
    }
    const u = uNow();
    swaps.forEach(w => {
      const k = clamp((scrollY - w.S0) / (w.S1 - w.S0), 0, 1), e = k * k * (3 - 2 * k);
      w.o.style.transform = 'translateX(' + (w.dxo * e).toFixed(1) + 'px)'; w.o.style.visibility = k >= 1 ? 'hidden' : '';
      w.i.style.transform = 'translateX(' + (w.dxi * (1 - e)).toFixed(1) + 'px)';
    });

    slides.forEach(s => {
      const t = (s.top - s.st.getBoundingClientRect().top / vh) / 0.45;
      s.p = clamp(t, 0, 1);
      s.card.style.setProperty('--slide', APP.RM ? '1' : (s.p * s.p * (3 - 2 * s.p)).toFixed(4));
      s.started = t > 0.02;
    });

    if (strip && census && inniu) {
      const on = census.started && inniu.getBoundingClientRect().top > vh * 0.75;
      if (on !== stripOn) { stripOn = on; strip.classList.toggle('is-on', on); strip.setAttribute('aria-hidden', on ? 'false' : 'true'); }
    }
    APP.setChapter(clamp(Math.floor(u + 0.03), 0, n - 1));
    if (world) {
      if (u > 4.6 && u < 6.4) world.setForm(activeForm());
      world.frame(u, dt);
    } else {
      APP.setCensus(clamp(Math.round((u - 3.4) / 1.5 * (APP.D.census.length - 1)), 0, APP.D.census.length - 1));
    }
    requestAnimationFrame(loop);
  }
  APP.measure = measure;

  let lastW = -1, lastL = -1, lastS = -1;
  function onResize() {
    if (TOUCH) {
      const w = innerWidth, l = pL.offsetHeight, s = pS.offsetHeight, a = document.activeElement;
      const typing = a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName);
      if (w === lastW && ((l === lastL && s === lastS) || typing)) return;
      lastW = w; lastL = l; lastS = s;
    }
    if (APP.mobile && APP.mobile.sync()) { if (world) world.resize(); return; }
    measure(); if (world) world.resize();
  }
  addEventListener('resize', onResize);
  addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  if (window.ResizeObserver) new ResizeObserver(measure).observe(document.getElementById('main'));
  onResize();
  requestAnimationFrame(loop);
})();
