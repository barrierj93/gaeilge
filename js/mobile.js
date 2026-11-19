(function () {
  'use strict';
  const APP = window.__ga, D = APP.D, $ = APP.$, $$ = APP.$$, clamp = APP.clamp, secs = APP.secs, world = APP.world;
  const MQ = matchMedia('(max-width: 800px), (orientation: portrait) and (max-width: 1100px), (max-width: 1100px) and (max-height: 600px) and (pointer: coarse)');
  const root = document.documentElement, body = document.body, main = $('#main');
  const lerp = (a, b, f) => a + (b - a) * f;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const MU = {
    hero: 0, cloch: [1.0, 1.3], carve: [1.5, 1.62], lamh: [2.06, 2.22], latin: [2.42, 2.56], tree: [2.74, 2.9],
    culu: 3.06, knot: e => 3.2 + e * 0.075, census: [3.76, 3.84], revival: [3.87, 3.915], school: 4.9,
    inniu: [5.2, 5.4, 5.6, 5.8], gael: [6.14, 6.32], daily: [6.48, 6.56], beyond: [6.8, 6.92], focail: [7.2, 7.4, 7.6, 7.8], fin: 8.5, marks: []
  };

  const ANCHOR = {
    cross: { in: 2.64, full: 2.74, out: 2.92, knots: 3.06, pills: 3.04 },
    beyond: { in: 6.62, full: 6.76, out: 7.0 },
    avenue: { revIn: 3.9, revOut: 3.97, sch: 4.9 }
  };

  const cards = [];
  const card = (el, ch, u, o) => { if (el) cards.push(Object.assign({ el: el, ch: ch, u: u, w: 1, chunks: [] }, o || {})); };
  const event = (e, label, i, n, short) => {
    const a = document.createElement('article'); a.className = 'gloss m-event';
    a.innerHTML = '<p class="m-event__k">' + label + ', ' + (i + 1) + ' of ' + n + '</p><p class="m-event__y">' + esc(e.y) + '</p><h3>' + esc(e.t) + '</h3>' + (short ? '' : '<p>' + esc(e.d) + '</p>');
    return a;
  };
  const cover = { ch: 0, u: [MU.hero, MU.hero], w: 1, chunks: [], cover: true };
  card($('#cloch .step:nth-child(1) .gloss'), 1, MU.cloch, { w: 1.3 });
  card($('#cloch .step:nth-child(2) .gloss'), 1, MU.carve, { w: 1.2 });
  card($('#lamhscribhinn .step:nth-child(1) .gloss'), 2, MU.lamh, { w: 1.8 });
  card($('#lamhscribhinn .step:nth-child(2) .gloss'), 2, MU.latin, { w: 1.2 });
  card($('#lamhscribhinn .step:nth-child(3) .gloss'), 2, MU.tree, { w: 1.5 });
  card($('#culu .step:nth-child(1) .gloss'), 3, MU.culu, { w: 1.6 });
  D.knots.forEach((k, e) => card(event(k, 'The retreat', e, D.knots.length, true), 3, MU.knot(e), { gen: true, year: String(k.y), w: e ? 1 : 1.2 }));
  card($('#culu .step:last-child .gloss'), 3, MU.census, { w: 1.4 });
  card($('#athbheochan .step:nth-child(1) .gloss'), 4, MU.revival, { w: 1.1 });
  D.marks.forEach((m, i) => card(event(m, 'The revival', i, D.marks.length), 4, () => MU.marks[i], { gen: true, year: String(m.y) }));
  card($('#athbheochan .step:last-child .gloss'), 4, MU.school, { w: 1.3 });
  $$('#inniu .step').forEach((st, i) => card(st.querySelector('.gloss'), 5, MU.inniu[i], { form: +st.dataset.form, w: i ? 1.1 : 1.7 }));
  card($('#gaeltacht .step:nth-child(1) .gloss'), 6, MU.gael, { w: 1.8 });
  card($('#gaeltacht .step:nth-child(2) .gloss'), 6, MU.daily, { w: 1.1 });
  card($('#gaeltacht .step:nth-child(3) .gloss'), 6, MU.beyond, { w: 1.4 });
  $$('#focail .step').forEach((st, i) => card(st.querySelector('.gloss'), 7, MU.focail[i], { w: i ? 1.1 : 1.6 }));
  card($('#crioch .fin .gloss'), 8, MU.fin, { w: 1.4, fin: true });
  const uOf = c => { const u = typeof c.u === 'function' ? c.u() : c.u; return Array.isArray(u) ? u : [u, u]; };

  const I = {
    look: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 4.5c-4.4 0-7.6 3.6-8.6 7.5 1 3.9 4.2 7.5 8.6 7.5s7.6-3.6 8.6-7.5c-1-3.9-4.2-7.5-8.6-7.5Z"/><circle cx="12" cy="12" r="3"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 14.5 6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 9.5 6 6 6-6"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="6" cy="6" r="1.6"/><circle cx="6" cy="12" r="1.6"/><circle cx="6" cy="18" r="1.6"/><path d="M10.5 6H19M10.5 12H19M10.5 18H19"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>'
  };
  const ui = document.createElement('div'); ui.id = 'm-ui'; ui.hidden = true;
  ui.innerHTML =
    '<div class="m-intro" id="m-intro" aria-hidden="true"></div>' +
    '<div class="m-swipe" id="m-swipe" aria-hidden="true"><span class="m-swipe__a">' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m6 14.5 6-6 6 6"/></svg>' + '</span><span>Swipe up to travel</span></div>' +
    '<div class="m-saying" id="m-saying" aria-hidden="true"></div>' +
    '<div class="m-chip" id="m-chip"><p class="m-chip__y" id="m-chip-y"></p><p class="m-chip__n" id="m-chip-n"></p>' +
      '<label class="vh" for="m-year">Go to a census year</label><select id="m-year"></select></div>' +
    '<div class="m-tools" id="m-tools"><p class="m-hint" id="m-hint">Drag sideways to look around.</p></div>' +
    '<div class="m-clip"><section class="m-sheet" id="m-sheet" aria-label="The story"><header class="m-sheet__head" id="m-head"><p class="m-where" id="m-where"></p><p class="m-count" id="m-count"></p><span class="m-bar" id="m-bar"></span></header>' +
      '<div class="m-view"><div class="m-strip" id="m-strip"></div></div></section><div class="m-fade" aria-hidden="true"></div></div>' +
    '<div class="m-safe" id="m-safe" aria-hidden="true"></div>';
  body.appendChild(ui);

  const top = document.createElement('div'); top.className = 'm-top';
  top.innerHTML = '<button type="button" class="m-look" id="m-look" aria-pressed="false">' + I.look + '<span id="m-look-t">Explore</span></button>' +
    '<button type="button" class="m-index" id="m-index" aria-haspopup="dialog" aria-controls="m-map" aria-label="Chapters">' + I.list + '</button>';
  $('.mast').appendChild(top); top.hidden = true;
  const track = document.createElement('div'); track.id = 'm-track'; track.hidden = true; track.setAttribute('aria-hidden', 'true'); body.appendChild(track);
  const dialog = document.createElement('dialog'); dialog.id = 'm-map'; dialog.setAttribute('aria-labelledby', 'm-map-h');
  dialog.innerHTML = '<header class="m-map__head"><h2 id="m-map-h">Chapters</h2><button type="button" class="m-map__x" aria-label="Close">' + I.close + '</button></header><ol class="m-map__list"></ol>';
  body.appendChild(dialog);
  const strip = $('#m-strip'), sheet = $('#m-sheet'), head = $('#m-head'), safe = $('#m-safe'), tools = $('#m-tools'), intro = $('#m-intro'), saying = $('#m-saying'), chip = $('#m-chip');
  intro.innerHTML = '<p class="m-intro__t">' + esc($('#tairseach h1').textContent) + '</p><p class="m-intro__s">' + esc($('#tairseach .hero__lede').textContent) + '</p>';
  const swipe = $('#m-swipe'), fade = $('.m-fade', ui);
  saying.innerHTML = '<p class="m-saying__ga" lang="ga">' + esc($('.fin__saw').textContent) + '</p><p class="m-saying__en">' + esc($('.fin__es').textContent) + '</p>';

  const probe = document.createElement('div'); probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;left:0;top:0;width:1px;visibility:hidden;pointer-events:none;height:100vh;height:100lvh';
  body.appendChild(probe);
  const stableH = () => probe.offsetHeight || innerHeight;

  let steps = [], Y = [], N = 0, cur = -1, curCh = -1, active = false, inspect = false, insp = 0, frozenY = 0, geo = null, stripH = 0, relay = 0;
  const firstOf = [];
  const HEAD = k => k.matches('.plate, h3, .big, .m-event__k, .m-event__y');
  const TAIL = k => k.matches('.note, figcaption, .ogham__read');
  function unwrap() { $$('.m-chunk', strip).forEach(d => { while (d.firstChild) d.before(d.firstChild); d.remove(); }); cards.forEach(c => { c.chunks = []; }); }
  function layout(keep) {
    const was = keep && N ? at(scrollY) : null, wasCard = was ? steps[was.s] : null;
    unwrap();
    const vw = innerWidth, vh = stableH(), land = vw > vh && vh < 600;
    root.classList.toggle('m-land', land);
    const dockH = safe.offsetHeight, headH = head.offsetHeight, hb = Math.round($('.mast').getBoundingClientRect().bottom);
    const usable = vh - dockH - headH;
    const maxWin = land ? usable - 6 : Math.round(usable * (vw > 600 ? 0.42 : 0.5));
    const target = land ? maxWin * 0.92 : Math.round(vh * (vw > 600 ? 0.22 : 0.27));

    const maxBig = land ? maxWin : Math.round(usable * (vw > 600 ? 0.5 : 0.6));
    root.style.setProperty('--m-hb', hb + 'px'); root.style.setProperty('--m-sheet', (headH + maxBig + dockH) + 'px');
    geo = { vh: vh, land: land, dockH: dockH, headH: headH, hb: hb, maxWin: maxBig, introH: intro.offsetHeight, sayH: saying.offsetHeight, swH: swipe.offsetHeight + 18 };
    const G = 13;
    cards.forEach(c => {
      const kids = Array.from(c.el.children).filter(k => getComputedStyle(k).display !== 'none');
      const groups = []; let g = [], gh = 0;
      kids.forEach(k => {
        const h = k.getBoundingClientRect().height + G;
        if (g.length && !g.every(HEAD) && gh + h > target && !(TAIL(k) && gh + h <= maxWin)) { groups.push(g); g = []; gh = 0; }
        g.push(k); gh += h;
      });
      if (g.length) groups.push(g);
      groups.forEach(gr => {
        const d = document.createElement('div'); d.className = 'm-chunk' + (gr[0].matches('.plate') ? ' m-chunk--plate' : '');
        gr[0].before(d); gr.forEach(k => d.appendChild(k)); c.chunks.push(d);
      });
    });
    const s0 = strip.getBoundingClientRect().top;
    steps = [{ c: cover, ci: -1, k: 0, d: null, off: 0, win: 0, u: MU.hero, w: 1, hid: 1 }]; firstOf.length = 0; firstOf[0] = 0;
    cards.forEach((c, ci) => {
      const u = uOf(c), n = c.chunks.length;
      if (firstOf[c.ch] == null) firstOf[c.ch] = steps.length;
      c.chunks.forEach((d, k) => {
        const r = d.getBoundingClientRect(), top = r.top - s0, h = Math.round(r.height), uk = n > 1 ? lerp(u[0], u[1], k / (n - 1)) : u[0];
        const lim = d.querySelector('svg, table') ? maxBig : maxWin;
        if (h <= lim + 2) { steps.push({ c: c, ci: ci, k: k, d: d, off: top, win: h, u: uk, w: k ? 1 : c.w }); return; }

        const cuts = Array.from(d.querySelectorAll('li, tr, p, h3, figure, figcaption, table, .field, .mut__out, .ogham__key > div'))
          .map(e => Math.round(e.getBoundingClientRect().top - r.top) - 8).filter(y => y > 24 && y < h - 24).sort((a, b) => a - b);
        const parts = [0];
        while (h - parts[parts.length - 1] > lim) {
          const o = parts[parts.length - 1], fit = cuts.filter(y => y > o + 40 && y <= o + lim);
          parts.push(fit.length ? fit[fit.length - 1] : o + Math.round(lim * 0.85));
        }
        parts.forEach((o, j) => steps.push({ c: c, ci: ci, k: k, d: d, off: top + o, win: Math.min(lim, (j < parts.length - 1 ? parts[j + 1] : h) - o), u: uk, w: k || j ? 1 : c.w, part: j }));
      });
    });
    N = steps.length; stripH = strip.offsetHeight;
    const minS = vh * 0.4;
    Y = [0];
    for (let i = 1; i < N; i++) Y[i] = Y[i - 1] + Math.round(clamp(Math.max(Math.abs(steps[i].off - steps[i - 1].off), minS * steps[i].w), minS, vh * 0.94));

    track.textContent = '';
    for (let i = 0; i < N; i++) { const t = document.createElement('div'); t.style.height = (i < N - 1 ? Y[i + 1] - Y[i] : vh) + 'px'; track.appendChild(t); }
    if (was) {
      let i = steps.findIndex(x => x.c === wasCard.c && x.k === wasCard.k && (x.part || 0) === (wasCard.part || 0));
      if (i < 0) i = steps.findIndex(x => x.c === wasCard.c);
      scrollTo({ top: Y[Math.max(0, i)], behavior: 'instant' });
    }
    cur = -1;
  }
  function at(y) {
    let lo = 0, hi = N - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (Y[m] <= y) lo = m; else hi = m - 1; }
    const s = lo, f = s < N - 1 ? clamp((y - Y[s]) / (Y[s + 1] - Y[s]), 0, 1) : 0;
    return { s: s, f: f };
  }

  const where = $('#m-where'), count = $('#m-count'), bar = $('#m-bar'), hint = $('#m-hint');
  let last = { sheet: '', strip: '', tools: '' };
  const memo = new Map();
  const put = (el, k, v) => { const m = memo.get(el) || {}; if (m[k] !== v) { el.style[k] = v; m[k] = v; memo.set(el, m); } };
  function update(dt) {
    if (!N) return 0;
    const y = inspect ? frozenY : scrollY, q = at(y), A = steps[q.s], B = steps[Math.min(q.s + 1, N - 1)], f = q.f;
    const u = lerp(A.u, B.u, f), off = lerp(A.off, B.off, f), p = q.s + f;
    insp += ((inspect ? 1 : 0) - insp) * (APP.RM ? 1 : 1 - Math.exp(-(dt || 0.016) * 9));
    if (Math.abs(insp - (inspect ? 1 : 0)) < 0.002) insp = inspect ? 1 : 0;
    const win = lerp(A.win, B.win, f) * (1 - insp);
    const vh = innerHeight, vw = innerWidth, G = geo, hid = Math.max(insp, lerp(A.hid || 0, B.hid || 0, f));

    const sy = G.maxWin - win + hid * (G.headH + G.dockH + 8);
    const ts = 'translate3d(0,' + sy.toFixed(1) + 'px,0)', tt = 'translate3d(0,' + (-off).toFixed(1) + 'px,0)';
    if (ts !== last.sheet) { sheet.style.transform = ts; last.sheet = ts; }
    if (tt !== last.strip) { strip.style.transform = tt; last.strip = tt; }

    const iIn = G.introH * clamp(1 - p, 0, 1), sIn = G.sayH * clamp(p - (N - 2), 0, 1);
    let st;
    const swIn = G.swH * clamp(1 - p, 0, 1);
    if (G.land) st = { t: G.hb + 4, b: vh - G.dockH - 6 - swIn, l: hid > 0.5 && !inspect ? vw * 0.5 : 0, r: hid > 0.5 ? vw : vw * 0.5 };
    else st = { t: G.hb + iIn + sIn, b: vh - G.dockH - G.headH * (1 - hid) - win - 6 - swIn, l: 0, r: vw };
    const pad = 6, sw = st.r - st.l - pad * 2, sh = Math.max(80, st.b - st.t - pad * 2), aD = 0.9;
    const bw = Math.min(sw, sh * aD, 620), bh = bw / aD;
    const box = { x: st.l + pad + (sw - bw) / 2, y: st.t + pad + (sh - bh) / 2, w: bw, h: bh };

    const sheetTop = G.land ? vh : vh - Math.max(0, G.headH + win + G.dockH - hid * (G.headH + G.dockH + 8));
    if (world) world.setStage(st, box, sheetTop);

    put(intro, 'opacity', clamp(1 - p * 1.8, 0, 1).toFixed(2));
    put(intro, 'transform', 'translate3d(0,' + (-clamp(p, 0, 1) * 24).toFixed(1) + 'px,0)');
    put(swipe, 'opacity', inspect ? '0' : clamp(1 - p * 3, 0, 1).toFixed(2));
    put(fade, 'opacity', (1 - hid).toFixed(2));
    put(saying, 'opacity', clamp((p - (N - 2)) * 1.8 - 0.4, 0, 1).toFixed(2));
    const chipOn = u > 3.72 && u < 4.97 && insp < 0.5;
    if (chipOn !== chip.classList.contains('on')) chip.classList.toggle('on', chipOn);
    const tb = G.land ? vh - G.dockH - 52 : (inspect ? vh - G.dockH - 52 : st.b - 46 + 6), tx = 'translate3d(0,' + tb.toFixed(1) + 'px,0)';
    if (tx !== last.tools) { tools.style.transform = tx; last.tools = tx; }
    put(hint, 'opacity', inspect ? '1' : clamp(Math.min(p * 2 - 0.6, 2.6 - p), 0, 1).toFixed(2));
    put(bar, 'transform', 'scaleX(' + (N > 1 ? p / (N - 1) : 0).toFixed(3) + ')');
    const i = Math.round(p);
    if (i !== cur) step(i);
    return u;
  }

  function step(i) {
    cur = i; const s = steps[i], c = s.c;
    if (c.ch !== curCh) {
      curCh = c.ch; APP.setChapter(c.ch);
      const sc = secs[c.ch];
      where.innerHTML = (sc.dataset.n ? '<b>' + sc.dataset.n + '</b> ' : '') + '<span lang="ga">' + esc(sc.dataset.ga) + '</span> <i>' + esc(sc.dataset.en) + '</i>';
      $$('.m-map__list button', dialog).forEach((b, k) => { if (k === c.ch) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      if (location.hash !== '#' + sc.id) history.replaceState(null, '', '#' + sc.id);
    }
    count.textContent = (i + 1) + ' / ' + N;
    if (world) { world.setFocus(c.year || null); if (c.form != null) world.setForm(c.form); }
    steps.forEach(x => { if (x.d) x.d.toggleAttribute('inert', x.d !== s.d); });
  }
  function go(i, instant) { if (!N) return; i = clamp(i, 0, N - 1); setInspect(false); scrollTo({ top: Y[i], behavior: instant || APP.RM ? 'instant' : 'smooth' }); }
  function goU(u, from, to) {
    let best = 0, bd = 1e9;
    steps.forEach((s, i) => { if (s.c.ch < from || s.c.ch > to) return; const d = Math.abs(s.u - u); if (d < bd - 1e-4) { bd = d; best = i; } });
    go(best);
  }

  const look = $('#m-look');
  function setInspect(on) {
    on = !!on; if (on === inspect) return;
    inspect = on;
    if (on) { frozenY = scrollY; root.classList.add('m-lock'); APP.tip(null); }
    else { root.classList.remove('m-lock'); scrollTo({ top: frozenY, behavior: 'instant' }); }
    body.classList.toggle('is-inspect', on); look.setAttribute('aria-pressed', String(on));
    $('#m-look-t').textContent = on ? 'Done' : 'Explore';
    hint.textContent = on ? 'Drag to turn it. Pinch to zoom.' : 'Drag sideways to look around.';
    if (world) world.setInspect(on);
  }
  look.addEventListener('click', () => setInspect(!inspect));

  const list = $('.m-map__list', dialog);
  secs.forEach((sc, k) => {
    const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button';
    b.innerHTML = '<span class="m-map__n">' + (sc.dataset.n || '·') + '</span><span><b lang="ga">' + esc(sc.dataset.ga) + '</b><i>' + esc(sc.dataset.en) + '</i></span>';
    b.addEventListener('click', () => { dialog.close(); go(firstOf[k]); });
    li.appendChild(b); list.appendChild(li);
  });
  const openMap = () => { if (!active || dialog.open) return; setInspect(false); APP.tip(null); dialog.showModal(); const b = $('.m-map__list [aria-current]', dialog); if (b) b.focus(); };
  $('#m-index').addEventListener('click', openMap);
  $('.m-map__x', dialog).addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  const yearSel = $('#m-year');
  yearSel.innerHTML = D.census.map(c => '<option value="' + c.y + '">' + c.y + '</option>').join('');
  const setCensus = APP.setCensus;
  APP.setCensus = function (i) {
    setCensus(i);
    const d = D.census[i]; if (!d) return;
    $('#m-chip-y').textContent = d.y; yearSel.value = String(d.y);
    $('#m-chip-n').textContent = APP.fmt(d.n) + ' can speak Irish, ' + APP.pct(d.p, d.p % 1 ? 1 : 0);
  };
  yearSel.addEventListener('change', () => { if (world) goU(world.uForYear(+yearSel.value), 3, 4); });

  document.addEventListener('click', e => {
    if (!active) return;
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const k = secs.findIndex(s => '#' + s.id === a.getAttribute('href'));
    if (k >= 0) { e.preventDefault(); go(firstOf[k]); }
  });
  strip.addEventListener('focusin', e => {
    if (!active || inspect) return;
    const d = e.target.closest('.m-chunk'), i = steps.findIndex(s => s.d === d);
    if (i >= 0 && steps[cur] && steps[cur].d !== d) go(i, true);
  });
  addEventListener('keydown', e => { if (active && inspect && e.key === 'Escape') setInspect(false); });

  function enter() {
    active = true;
    root.classList.add('m-on'); body.classList.add('is-mobile'); ui.hidden = false; track.hidden = false; top.hidden = false;
    if (APP.sound) top.insertBefore(APP.sound.btn, $('#m-index'));
    main.setAttribute('aria-hidden', 'true');
    cards.forEach(c => {
      if (!c.gen && !c.ph) { c.ph = document.createComment('lectura'); c.el.before(c.ph); }
      c.el.classList.add('m-card'); strip.appendChild(c.el);
    });
    if (world) {
      world.setCross(ANCHOR.cross); world.setBeyond(ANCHOR.beyond); world.setAvenue(ANCHOR.avenue);
      MU.marks = D.marks.map(m => world.uForYear(m.y));
      world.setMobile(true, MU);
    } else MU.marks = D.marks.map(m => 3.97 + (MU.school - 3.97) * (m.y - 1897) / 125);
    if (APP.drawCharts) APP.drawCharts();
    APP.hooks.goYear = y => { if (world) goU(world.uForYear(y), 3, 4); };
    layout(false);
    const k = secs.findIndex(s => '#' + s.id === location.hash);
    go(k > 0 ? firstOf[k] : 0, true);
    curCh = -1; cur = -1;
  }
  function exit() {
    const ch = steps[cur] ? steps[cur].c.ch : 0;
    setInspect(false); if (dialog.open) dialog.close();
    unwrap();
    steps.forEach(x => x.d && x.d.removeAttribute('inert'));
    cards.forEach(c => {
      c.el.classList.remove('m-card');
      if (c.gen) c.el.remove(); else if (c.ph) { c.ph.replaceWith(c.el); c.ph = null; }
    });
    active = false; steps = []; N = 0; cur = -1;
    root.classList.remove('m-on', 'm-lock', 'm-land', 'm-pre'); body.classList.remove('is-mobile', 'is-inspect');
    ui.hidden = true; top.hidden = true; track.hidden = true; track.textContent = ''; main.removeAttribute('aria-hidden');
    if (APP.sound) $('.mast__where').after(APP.sound.btn);
    APP.hooks.goYear = y => { if (world && APP.scrollToU) APP.scrollToU(world.uForYear(y)); };
    if (world) world.setMobile(false);
    if (APP.drawCharts) APP.drawCharts();
    requestAnimationFrame(() => { if (APP.measure) APP.measure(); scrollTo({ top: secs[ch].getBoundingClientRect().top + scrollY, behavior: 'instant' }); });
  }

  let lastW = 0, lastH = 0;
  function sync() {
    if (MQ.matches !== active) { if (MQ.matches) enter(); else exit(); lastW = innerWidth; lastH = stableH(); return active; }
    if (!active) return false;
    const w = innerWidth, h = stableH(), a = document.activeElement, typing = a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName);
    if (w !== lastW || (Math.abs(h - lastH) > 90 && !typing)) {
      lastW = w; lastH = h;
      if (APP.drawCharts) APP.drawCharts();
      layout(true);
    }
    return true;
  }
  APP.mobile = {
    get active() { return active; }, sync: sync, update: update, go: go
  };

  const relayout = () => { if (relay) return; relay = requestAnimationFrame(() => { relay = 0; if (active && Math.abs(strip.offsetHeight - stripH) > 1) layout(true); }); };
  if (window.ResizeObserver) new ResizeObserver(relayout).observe(strip);
  if (document.fonts) {
    if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { if (active) { if (APP.drawCharts) APP.drawCharts(); relayout(); } });
    if (document.fonts.ready) document.fonts.ready.then(() => { if (active) relayout(); });
  }
})();
