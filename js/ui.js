(function () {
  'use strict';
  const D = window.GAEILGE;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const css = getComputedStyle(document.documentElement);
  const tok = n => css.getPropertyValue(n).trim();
  const C = { vellum: tok('--vellum'), lit: tok('--vellum-lit'), mid: tok('--vellum-mid'), shade: tok('--vellum-shade'), ink: tok('--ink'), soft: tok('--ink-soft'), minium: tok('--minium'),
    green: tok('--green'), mint: tok('--mint'), onbg: tok('--on-bg'), onbgSoft: tok('--on-bg-soft') };
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const pct = (x, d) => x.toFixed(d == null ? 1 : d) + '%';
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function rng(seed) {
    let s = seed >>> 0;
    return function () { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const APP = window.__ga = { D, $, $$, C, fmt, pct, clamp, rng, RM: matchMedia('(prefers-reduced-motion: reduce)').matches, hooks: {} };

  const tip = $('#tip');
  let tipBye = null, tipTouch = false;
  APP.tip = function (html, ev, bye) {
    if (!html) { tip.classList.remove('on'); tipTouch = false; if (tipBye) { const f = tipBye; tipBye = null; f(); } return; }
    if (tipBye && tipBye !== bye) { const f = tipBye; tipBye = null; f(); }
    tipBye = bye || null; tipTouch = !!(ev && ev.pointerType === 'touch');
    tip.innerHTML = html; tip.classList.add('on');
    const r = tip.getBoundingClientRect();
    let x = ev.clientX + 14, y = ev.clientY - r.height - 12;
    if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
    if (y < 8) y = ev.clientY + 18;
    tip.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  };

  addEventListener('pointerdown', e => { if (tipTouch && e.pointerType === 'touch' && !e.target.closest('[data-tap]')) APP.tip(null); }, true);
  addEventListener('scroll', () => { if (tipTouch) APP.tip(null); }, { passive: true });
  APP.TOUCH = matchMedia('(hover: none) and (pointer: coarse)').matches;
  const isMouse = ev => ev.pointerType !== 'touch';

  function plaitSVG(o) {
    const W = 760, H = o.h, P = o.period, A = o.amp, n = Math.ceil(W / (P / 2)) + 2;
    const seg = (phase, x0, x1) => {
      let d = '';
      for (let i = 0; i <= 10; i++) {
        const x = x0 + (x1 - x0) * i / 10, y = H / 2 + A * Math.sin(2 * Math.PI * x / P + phase);
        d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }
      return d;
    };
    const band = d => '<path d="' + d + '" fill="none" stroke="' + o.edge + '" stroke-width="' + (o.band + o.line * 2) + '"/><path d="' + d + '" fill="none" stroke="' + o.fill + '" stroke-width="' + o.band + '"/>';
    let out = '';
    for (let k = -1; k < n; k++) {
      const xc = k * P / 2, x0 = xc - P / 4, x1 = xc + P / 4;
      const over = ((k % 2) + 2) % 2 === 0 ? 0 : Math.PI, under = over === 0 ? Math.PI : 0;
      out += band(seg(under, x0, x1)) + band(seg(over, x0, x1));
      out += '<circle cx="' + x1.toFixed(1) + '" cy="' + (H / 2) + '" r="' + o.dot + '" fill="' + C.minium + '"/>';
    }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMinYMid slice" aria-hidden="true">' + out + '</svg>';
  }
  $$('[data-plait]').forEach(el => {
    el.innerHTML = plaitSVG({ h: 26, period: 36, amp: 6.5, band: 4.2, line: 1.3, dot: 1.9, edge: C.mint, fill: C.green });
  });

  function trefoilSVG(o) {
    const N = 300, pts = [];
    for (let i = 0; i < N; i++) { const t = i / N * 2 * Math.PI; pts.push([Math.sin(t) + 2 * Math.sin(2 * t), Math.cos(t) - 2 * Math.cos(2 * t)]); }
    const P = i => pts[((i % N) + N) % N];
    const path = (a, b) => { let d = ''; for (let i = a; i <= b; i++) { const p = P(i); d += (i === a ? 'M' : 'L') + p[0].toFixed(3) + ' ' + p[1].toFixed(3); } return d; };
    const band = (d, close) => '<path d="' + d + (close ? 'Z' : '') + '" fill="none" stroke="' + o.edge + '" stroke-width="' + (o.band + o.line * 2) + '" stroke-linejoin="round"/><path d="' + d + (close ? 'Z' : '') + '" fill="none" stroke="' + o.fill + '" stroke-width="' + o.band + '" stroke-linejoin="round"/>';
    const visits = [];
    const cross = (a, b, c, d) => {
      const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
      if (Math.abs(den) < 1e-9) return false;
      const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
      return t >= 0 && t < 1 && u >= 0 && u < 1;
    };
    for (let i = 0; i < N; i++) for (let j = i + 12; j < N; j++) {
      if (i === 0 && j > N - 12) continue;
      if (cross(P(i), P(i + 1), P(j), P(j + 1))) visits.push(i, j);
    }
    visits.sort((a, b) => a - b);
    let out = band(path(0, N - 1), true);
    visits.forEach((v, k) => { if (k % 2 === 0) out += band(path(v - 11, v + 12)); });
    return '<svg viewBox="-3.45 -3.75 6.9 6.9" aria-hidden="true">' + out + '</svg>';
  }
  $$('[data-knot]').forEach(el => { el.innerHTML = trefoilSVG({ band: 0.42, line: 0.2, edge: C.green, fill: C.mint }); });

  const secs = APP.secs = $$('main .ch');
  const stem = $('#stem');
  secs.forEach((s, i) => {
    const li = document.createElement('li'), a = document.createElement('a');
    a.href = '#' + s.id;
    let g = '';
    const cx = 20, cy = 19;
    if (i === 0) g = '<line x1="12" y1="27" x2="20" y2="17"/><line x1="28" y1="27" x2="20" y2="17"/>';
    else if (i === secs.length - 1) g = '<line x1="12" y1="11" x2="20" y2="21"/><line x1="28" y1="11" x2="20" y2="21"/>';
    else {
      const n = i <= 5 ? i : i - 5, dir = i <= 5 ? 1 : -1;
      for (let q = 0; q < n; q++) { const y = cy + (q - (n - 1) / 2) * 5.2; g += '<line x1="' + cx + '" y1="' + y + '" x2="' + (cx + dir * 13) + '" y2="' + y + '"/>'; }
    }
    const num = s.dataset.n ? s.dataset.n + ' ' : '';
    a.innerHTML = '<svg viewBox="0 0 40 38" aria-hidden="true">' + g + '</svg><span>' + num + esc(s.dataset.ga) + ', ' + esc(s.dataset.en) + '</span>';
    a.setAttribute('aria-label', num + s.dataset.ga + ', ' + s.dataset.en);
    li.appendChild(a); stem.appendChild(li);
  });
  const stemLinks = $$('a', stem), where = $('#where');
  let curCh = -1;
  APP.setChapter = function (i) {
    if (i === curCh) return; curCh = i;
    stemLinks.forEach((a, k) => a.setAttribute('aria-current', k === i ? 'true' : 'false'));
    const s = secs[i];
    where.innerHTML = '<b>' + (s.dataset.n ? s.dataset.n + ' ' : '') + esc(s.dataset.ga) + '</b>' + esc(s.dataset.en);
  };

  $('#latin-table tbody').innerHTML = D.latin.map(w =>
    '<tr><td lang="ga">' + esc(w.ga) + '</td><td><i>' + esc(w.la) + '</i></td><td>' + esc(w.en) + (w.kin || w.note ? '<small>' + esc(w.kin ? 'cf. ' + w.kin : w.note) + '</small>' : '') + '</td></tr>').join('');

  function shareTable(sel, rows, hot, open) {
    const max = Math.max.apply(null, rows.map(r => r.n));
    $(sel + ' tbody').innerHTML = rows.map(r => {
      const cls = r.k === hot ? ' bar--hot' : (open.indexOf(r.k) > -1 ? ' bar--open' : '');
      return '<tr><td style="font:inherit">' + esc(r.t) + '<span class="bar' + cls + '" style="width:' + (r.n / max * 100).toFixed(1) + '%"></span></td><td class="num">' + fmt(r.n) + '</td><td class="num">' + pct(r.n / D.total2022 * 100) + '</td></tr>';
    }).join('');
  }
  shareTable('#freq-table', D.freq, 'daily', ['ns']);
  shareTable('#ability-table', D.ability, null, ['nw', 'ns']);

  $('#gael-table tbody').innerHTML = D.gaeltacht.map(g =>
    '<tr><td>' + esc(g.name) + '</td><td class="num">' + fmt(g.pop) + '</td><td class="num">' + fmt(g.sp) + '</td><td class="num">' + fmt(g.d[2]) + '</td></tr>').join('') +
    '<tr><td>Total</td><td class="num">106,220</td><td class="num">65,156</td><td class="num">20,261</td></tr>';

  $('#loans').innerHTML = D.loans.map(l => '<li><b lang="ga">' + esc(l.ga) + '</b><span>‘' + esc(l.lit) + '’ <i>became</i> ' + esc(l.out) + '</span></li>').join('');
  $('#phrases').innerHTML = D.phrases.map(p => '<li><b lang="ga">' + esc(p.ga) + '</b><span>' + esc(p.en) + '.' + (p.lit.toLowerCase() !== p.en.toLowerCase() ? ' Literally ‘' + esc(p.lit) + '’.' : '') + ' <i>Sounds like ‘' + esc(p.say) + '’.</i></span></li>').join('');

  const OG = { b: [1, 'R'], l: [2, 'R'], f: [3, 'R'], s: [4, 'R'], n: [5, 'R'], h: [1, 'L'], d: [2, 'L'], t: [3, 'L'], c: [4, 'L'], q: [5, 'L'],
    m: [1, 'X'], g: [2, 'X'], ng: [3, 'X'], z: [4, 'X'], r: [5, 'X'], a: [1, 'V'], o: [2, 'V'], u: [3, 'V'], e: [4, 'V'], i: [5, 'V'] };
  const SUB = { p: 'b', j: 'i', k: 'c', v: 'f', w: 'f', x: 'cs', y: 'i' };
  APP.OG = OG;
  APP.toOgham = function (text) {
    const s = String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
    const out = [];
    for (let i = 0; i < s.length && out.length < 12; i++) {
      if (s[i] === 'n' && s[i + 1] === 'g') { out.push('ng'); i++; continue; }
      const sub = SUB[s[i]] || s[i];
      for (const ch of sub) if (OG[ch] && out.length < 12) out.push(ch);
    }
    return out;
  };

  const ogSvg = $('#ogham-svg'), ogRead = $('#ogham-read'), ogIn = $('#ogham-input');
  function drawOghamSVG(letters) {
    const cx = 45, y0 = 268, y1 = 34;
    let need = 0;
    letters.forEach(l => { need += (OG[l][0] - 1) * 7 + 15; });
    const k = Math.min(1, (y0 - y1 - 6) / Math.max(1, need));
    let y = y0 - 8, g = '';
    letters.forEach(l => {
      const n = OG[l][0], kind = OG[l][1], ys = y;
      for (let q = 0; q < n; q++) {
        if (kind === 'R') g += '<line x1="' + cx + '" y1="' + y + '" x2="' + (cx + 22) + '" y2="' + y + '"/>';
        else if (kind === 'L') g += '<line x1="' + cx + '" y1="' + y + '" x2="' + (cx - 22) + '" y2="' + y + '"/>';
        else if (kind === 'X') g += '<line x1="' + (cx - 19) + '" y1="' + (y + 8) + '" x2="' + (cx + 19) + '" y2="' + (y - 8) + '"/>';
        else g += '<line x1="' + (cx - 6) + '" y1="' + y + '" x2="' + (cx + 6) + '" y2="' + y + '"/>';
        if (q < n - 1) y -= 7 * k;
      }
      g += '<text x="86" y="' + ((ys + y) / 2 + 3.5) + '" text-anchor="end" class="lab lab--ink" style="font-size:10px">' + l.toUpperCase() + '</text>';
      y -= 15 * k;
    });
    ogSvg.innerHTML =
      '<path d="M17 292 L12 66 Q16 16 44 7 Q73 14 77 70 L73 292 Z" fill="' + C.mid + '" stroke="' + C.ink + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<line x1="45" y1="' + y0 + '" x2="45" y2="' + y1 + '" stroke="' + C.ink + '" stroke-width="1.3"/>' +
      '<g stroke="' + C.ink + '" stroke-width="2.6" stroke-linecap="round">' + g + '</g>';
  }
  function oghamKey() {
    const groups = [['R', 'b l f s n', 'To the right of the edge'], ['L', 'h d t c q', 'To the left'], ['X', 'm g ng z r', 'Across the edge'], ['V', 'a o u e i', 'Notches on the edge: the vowels']];
    $('#ogham-key').innerHTML = groups.map(gr => {
      let x = 8, g = '', lab = '';
      gr[1].split(' ').forEach(l => {
        const n = OG[l][0], x0 = x;
        for (let q = 0; q < n; q++) {
          if (gr[0] === 'R') g += '<line x1="' + x + '" y1="13" x2="' + x + '" y2="24"/>';
          else if (gr[0] === 'L') g += '<line x1="' + x + '" y1="13" x2="' + x + '" y2="2"/>';
          else if (gr[0] === 'X') g += '<line x1="' + (x - 4) + '" y1="22" x2="' + (x + 4) + '" y2="4"/>';
          else g += '<line x1="' + x + '" y1="9" x2="' + x + '" y2="17"/>';
          x += 4.2;
        }
        lab += '<text x="' + ((x0 + x - 4.2) / 2) + '" y="33.5" text-anchor="middle" class="lab lab--ink" style="font-size:8.5px">' + l.toUpperCase() + '</text>';
        x += 7.5;
      });
      return '<div><svg viewBox="0 0 ' + (x + 2) + ' 35" preserveAspectRatio="xMinYMid meet" aria-hidden="true"><line x1="2" y1="13" x2="' + x + '" y2="13" stroke="' + C.ink + '" stroke-width="1"/><g stroke="' + C.ink + '" stroke-width="1.7" stroke-linecap="round">' + g + '</g>' + lab + '</svg><span>' + gr[2] + '</span></div>';
    }).join('');
  }
  function onOgham() {
    const letters = APP.toOgham(ogIn.value);
    drawOghamSVG(letters);
    ogRead.textContent = letters.length ? 'Read upwards: ' + letters.map(l => l.toUpperCase()).join(' ') : 'Type a letter or two.';
    if (APP.hooks.inscription) APP.hooks.inscription(letters);
  }
  APP.oghamLetters = () => APP.toOgham(ogIn.value);
  ogIn.addEventListener('input', onOgham);
  $('#ogham-form').addEventListener('submit', e => e.preventDefault());
  oghamKey(); onOgham();

  const selP = $('#mut-pos'), selN = $('#mut-noun');
  selP.innerHTML = D.possessives.map(p => '<option value="' + p.k + '">' + p.ga + ', ' + p.en + (p.who ? ' (' + p.who + ')' : '') + '</option>').join('');
  selN.innerHTML = D.nouns.map((n, i) => '<option value="' + i + '">' + n.ga + ', ' + n.en + '</option>').join('');
  const ECL = { b: 'mb', c: 'gc', d: 'nd', f: 'bhf', g: 'ng', p: 'bp', t: 'dt' };
  function onMut() {
    const p = D.possessives.find(x => x.k === selP.value), n = D.nouns[+selN.value];
    const c = n.ga[0], rest = n.ga.slice(1);
    let head = c, kind = 'none', pre = p.ga, join = ' ';
    if (p.m === 'len' && 'bcdfgmpst'.indexOf(c) > -1) { head = c + 'h'; kind = 'len'; }
    else if (p.m === 'ecl' && ECL[c]) { head = ECL[c]; kind = 'ecl'; }
    if (kind === 'len' && c === 'f' && (p.k === 'mo' || p.k === 'do')) { pre = p.ga[0] + '’'; join = ''; }
    $('#mut-ga').innerHTML = esc(pre) + join + (kind === 'none' ? esc(n.ga) : '<mark>' + esc(head) + '</mark>' + esc(rest));
    $('#mut-es').textContent = p.en + (p.who ? ' (' + p.who + ')' : '') + ' ' + n.en;
    const old = $('#mut-old'), note = $('#mut-note');
    if (kind === 'len') {
      old.innerHTML = esc(pre) + join + '<span class="ponc' + ('bdf'.indexOf(c) > -1 ? ' ponc--tall' : '') + '">' + esc(c) + '</span>' + esc(rest);
      note.innerHTML = '<span lang="ga">Séimhiú</span>: ' + c + ' becomes ' + c + 'h. Until the mid-20th century this was written as a dot over the letter, as on the second line.';
    } else {
      old.innerHTML = '';
      if (kind === 'ecl') note.innerHTML = '<span lang="ga">Urú</span>: ' + ECL[c].slice(0, -1) + ' is written in front, and the ' + c + ' falls silent.';
      else if (p.m === 'ecl') note.textContent = 'No change: ' + c + ' does not take eclipsis.';
      else note.textContent = 'No change: after a meaning ‘her’, a consonant stays as it is.';
    }
  }
  selP.addEventListener('change', onMut); selN.addEventListener('change', onMut);
  $('#mut-form').addEventListener('submit', e => e.preventDefault());
  onMut();

  const d3 = window.d3;
  const widthOf = (svg, lo, hi) => clamp(svg.parentNode.clientWidth || hi, lo, hi);

  function drawTree() {
    const svg = d3.select('#tree'), W = widthOf(svg.node(), 250, 560), narrow = W < 440;
    const H = narrow ? 386 : 322, m = { l: narrow ? 4 : 10, r: narrow ? 104 : 150, t: narrow ? 22 : 26, b: narrow ? 18 : 10 };
    svg.attr('viewBox', '0 0 ' + W + ' ' + H).selectAll('*').remove();
    const root = d3.hierarchy(D.family);
    d3.tree().size([H - m.t - m.b, W - m.l - m.r]).separation((a, b) => a.parent === b.parent ? 1 : 1.35)(root);
    const g = svg.append('g').attr('transform', 'translate(' + m.l + ',' + m.t + ')');
    const link = d3.linkHorizontal().x(d => d.y).y(d => d.x);
    g.selectAll('path').data(root.links()).join('path').attr('d', link).attr('fill', 'none')
      .attr('stroke', d => d.target.data.dead ? C.soft : C.ink).attr('stroke-width', d => d.target.data.hi ? 2.6 : 1.6)
      .attr('stroke-dasharray', d => d.target.data.dead ? '2 4' : null).attr('stroke-linecap', 'round');
    const node = g.selectAll('g.n').data(root.descendants()).join('g').attr('class', 'n').attr('transform', d => 'translate(' + d.y + ',' + d.x + ')');
    node.append('circle').attr('r', d => d.data.hi ? 6 : 4)
      .attr('fill', d => d.data.hi ? C.minium : (d.data.dead ? C.lit : C.ink)).attr('stroke', d => d.data.dead ? C.soft : C.ink).attr('stroke-width', 1.5);
    node.filter(d => d.children).append('text').attr('class', 'lab lab--ink halo').attr('x', d => d.depth ? (narrow ? 0 : -7) : -2).attr('y', d => narrow && d.depth ? -10 : -9)
      .attr('text-anchor', d => d.depth ? (narrow ? 'middle' : 'end') : 'start').text(d => d.data.name + (d.data.dead ? ' †' : ''));
    const leaf = node.filter(d => !d.children).append('text').attr('x', 11).attr('y', d => narrow && (d.data.own || d.data.note) ? -1 : 4);
    leaf.append('tspan').attr('class', d => d.data.hi ? 'lab--disp' : 'lab lab--ink').text(d => d.data.name + (d.data.dead ? ' †' : ''));
    if (narrow) leaf.append('tspan').attr('class', 'lab').attr('font-style', 'italic').attr('x', 11).attr('dy', 13).text(d => d.data.own || d.data.note || '');
    else leaf.append('tspan').attr('class', 'lab').attr('font-style', 'italic').attr('dx', 6).text(d => d.data.own || d.data.note || '');
  }

  let census = null;
  function drawCensus() {
    const svg = d3.select('#census'), W = widthOf(svg.node(), 200, 1400), small = W < 520, tiny = W < 360;
    const H = tiny ? 78 : (small ? 96 : 132), m = { l: tiny ? 30 : 34, r: 12, t: tiny ? 15 : 16, b: 19 };
    svg.attr('viewBox', '0 0 ' + W + ' ' + H).selectAll('*').remove();
    const x = d3.scaleLinear([1861, 2022], [m.l, W - m.r]), y = d3.scaleLinear([0, 2e6], [H - m.b, m.t]);
    const defs = svg.append('defs');
    defs.append('pattern').attr('id', 'hatch').attr('width', 5).attr('height', 5).attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(42)')
      .append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 5).attr('stroke', C.ink).attr('stroke-width', 1.1);
    const ax = svg.append('g').attr('class', 'ax');
    [0, 1e6, 2e6].forEach(v => {
      ax.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', v ? C.shade : C.ink).attr('stroke-width', 1);
      ax.append('text').attr('x', m.l - 6).attr('y', y(v) + 4).attr('text-anchor', 'end').text(v ? (v / 1e6) + 'm' : '0');
    });
    (small ? [1861, 1926, 1996, 2022] : [1861, 1891, 1926, 1961, 1996, 2022]).forEach(v => {
      ax.append('text').attr('x', x(v)).attr('y', H - 4).attr('text-anchor', v === 1861 ? 'start' : (v === 2022 ? 'end' : 'middle')).text(v);
    });
    ax.append('text').attr('x', m.l).attr('y', 10).text(W < 300 ? 'Can speak Irish' : 'People who say they can speak Irish');
    D.marks.forEach(e => ax.append('line').attr('x1', x(e.y)).attr('x2', x(e.y)).attr('y1', y(0)).attr('y2', y(0) + 5).attr('stroke', C.ink).attr('stroke-width', 1.4));
    const area = d3.area().x(d => x(d.y)).y0(y(0)).y1(d => y(d.n)), line = d3.line().x(d => x(d.y)).y(d => y(d.n));
    svg.append('path').attr('d', area(D.census)).attr('fill', 'url(#hatch)').attr('opacity', .5);
    svg.append('path').attr('d', line(D.census)).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 2).attr('stroke-linejoin', 'round');
    svg.append('g').selectAll('circle').data(D.census).join('circle').attr('cx', d => x(d.y)).attr('cy', d => y(d.n)).attr('r', 3).attr('fill', C.ink).attr('stroke', C.lit).attr('stroke-width', 1.5);
    const cur = svg.append('g');
    cur.append('line').attr('y1', m.t - 4).attr('y2', y(0)).attr('stroke', C.minium).attr('stroke-width', 1.2);
    cur.append('circle').attr('r', 6).attr('fill', C.minium).attr('stroke', C.lit).attr('stroke-width', 2);
    census = { x, y, cur, i: -1 };
    const nearest = ev => { const px = d3.pointer(ev, svg.node())[0], yr = x.invert(px); let b = 0; D.census.forEach((d, i) => { if (Math.abs(d.y - yr) < Math.abs(D.census[b].y - yr)) b = i; }); return b; };
    svg.append('rect').attr('x', m.l - 8).attr('y', 0).attr('width', W - m.l - m.r + 16).attr('height', H).attr('fill', 'transparent').style('cursor', 'pointer')
      .on('pointermove', ev => { if (!isMouse(ev)) return; const d = D.census[nearest(ev)]; APP.tip('<b>' + d.y + '</b>' + fmt(d.n) + ' people<br>' + pct(d.p, d.p % 1 ? 1 : 0) + ' of the population<br><i>Click to go to its stone</i>', ev); })
      .on('pointerleave', () => APP.tip(null))
      .on('click', ev => { if (APP.hooks.goYear) APP.hooks.goYear(D.census[nearest(ev)].y); });
    const keep = APP.censusIndex == null ? 0 : APP.censusIndex; APP.censusIndex = -1; APP.setCensus(keep);
  }
  APP.setCensus = function (i) {
    if (i === APP.censusIndex || !census) return; APP.censusIndex = i;
    const d = D.census[i];
    census.cur.attr('transform', null);
    census.cur.select('line').attr('x1', census.x(d.y)).attr('x2', census.x(d.y));
    census.cur.select('circle').attr('cx', census.x(d.y)).attr('cy', census.y(d.n));
    $('#strip-year').textContent = d.y;
    $('#strip-n').innerHTML = fmt(d.n) + ' people <i>(' + pct(d.p, d.p % 1 ? 1 : 0) + ')</i>';
  };

  function drawSlope() {
    const svg = d3.select('#slope'), W = widthOf(svg.node(), 290, 560), H = 318, m = { l: 44, r: W < 400 ? 132 : 158, t: 26, b: 12 };
    svg.attr('viewBox', '0 0 ' + W + ' ' + H).selectAll('*').remove();
    const yrs = [2011, 2016, 2022], x = d3.scaleLinear([2011, 2022], [m.l, W - m.r]), y = d3.scaleLog([240, 12000], [H - m.b, m.t]);
    const ax = svg.append('g').attr('class', 'ax');
    [300, 1000, 3000, 10000].forEach(v => {
      ax.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', C.shade).attr('stroke-width', 1);
      ax.append('text').attr('x', m.l - 7).attr('y', y(v) + 4).attr('text-anchor', 'end').text(fmt(v));
    });
    yrs.forEach(v => {
      ax.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', m.t - 6).attr('y2', H - m.b).attr('stroke', C.shade).attr('stroke-width', 1);
      ax.append('text').attr('x', x(v)).attr('y', 12).attr('text-anchor', 'middle').attr('class', 'lab lab--ink').text(v);
    });
    const line = d3.line().x((v, i) => x(yrs[i])).y(v => y(v));
    const rows = D.gaeltacht.map(g => ({ g, up: g.d[2] > g.d[0], ly: y(g.d[2]) })).sort((a, b) => a.ly - b.ly);
    for (let i = 1; i < rows.length; i++) rows[i].ly = Math.max(rows[i].ly, rows[i - 1].ly + 15);
    const over = rows[rows.length - 1].ly - (H - 4);
    if (over > 0) rows.forEach(r => { r.ly -= over; });
    const gs = svg.append('g').selectAll('g').data(rows).join('g').attr('class', 'zone');
    gs.append('path').attr('d', r => line(r.g.d)).attr('fill', 'none').attr('stroke', r => r.up ? C.minium : C.ink).attr('stroke-width', 2).attr('stroke-linejoin', 'round');
    gs.each(function (r) {
      d3.select(this).selectAll('circle').data(r.g.d).join('circle').attr('cx', (v, i) => x(yrs[i])).attr('cy', v => y(v)).attr('r', 3.6)
        .attr('fill', r.up ? C.minium : C.ink).attr('stroke', C.lit).attr('stroke-width', 1.6);
    });
    gs.append('path').attr('d', r => 'M' + (x(2022) + 5) + ' ' + y(r.g.d[2]) + 'L' + (x(2022) + 13) + ' ' + r.ly).attr('stroke', C.soft).attr('stroke-width', 1).attr('fill', 'none');
    const t = gs.append('text').attr('x', x(2022) + 16).attr('y', r => r.ly + 4);
    t.append('tspan').attr('class', 'lab lab--ink').text(r => r.g.name);
    t.append('tspan').attr('class', 'lab').attr('dx', 5).text(r => fmt(r.g.d[2]));
    const reset = () => gs.attr('opacity', 1);
    const show = (ev, r) => {
      const ch = (r.g.d[2] - r.g.d[0]) / r.g.d[0] * 100;
      APP.tip('<b>' + r.g.name + '</b>' + r.g.place + '<br>2011: ' + fmt(r.g.d[0]) + '<br>2016: ' + fmt(r.g.d[1]) + '<br>2022: ' + fmt(r.g.d[2]) + '<br>' + (ch > 0 ? 'Up ' : 'Down ') + pct(Math.abs(ch), 0) + ' since 2011', ev, reset);
      gs.attr('opacity', q => q === r ? 1 : .22);
    };
    gs.append('path').attr('d', r => line(r.g.d) + 'L' + (W - 4) + ' ' + r.ly).attr('fill', 'none').attr('stroke', 'transparent').attr('stroke-width', APP.TOUCH ? 22 : 15).style('cursor', 'default').attr('data-tap', '')
      .on('pointermove', (ev, r) => { if (isMouse(ev)) show(ev, r); })
      .on('click', (ev, r) => { if (!isMouse(ev) || ev.pointerType === undefined) show(ev, r); })
      .on('pointerleave', ev => { if (isMouse(ev)) { gs.attr('opacity', 1); APP.tip(null); } });
  }

  APP.drawCharts = function () { if (!d3) return; drawTree(); drawCensus(); drawSlope(); };

  if (APP.TOUCH) { const how = $('.hero__how'); if (how) how.textContent = 'Swipe up to move forward and drag sideways across the drawing to look around. The index on the right reads from the bottom up, like ogham.'; }
  APP.drawCharts();
  let rz = 0, lastW = innerWidth;
  addEventListener('resize', () => { if (innerWidth === lastW) return; lastW = innerWidth; clearTimeout(rz); rz = setTimeout(APP.drawCharts, 180); });
})();
