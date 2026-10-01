/* Faceprint Atlas: the interactive literature map on atlas.html.
   Reads window.ATLAS from assets/data/atlas-data.js; field reference in _tools/atlas/README.md. */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const h = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const root = document.getElementById('atlas');
  const DATA = window.ATLAS;
  if (!root) return;
  if (!DATA || !Array.isArray(DATA.papers) || !DATA.papers.length) {
    const box = document.getElementById('overview') || root;
    box.insertAdjacentHTML('afterbegin', '<p class="at-error">The paper data did not load. Check that assets/data/atlas-data.js is published next to this page.</p>');
    return;
  }

  /* ---------- data ---------- */
  const P = DATA.papers, FAMS = DATA.families, GROUPS = DATA.groups;
  const DUELS = DATA.duels || [], PATHS = DATA.paths || [];
  const famBy = Object.fromEntries(FAMS.map((f) => [f.key, f]));
  const grpBy = Object.fromEntries(GROUPS.map((g) => [g.key, g]));
  const byId = Object.fromEntries(P.map((p) => [p.id, p]));
  P.forEach((p) => { p.group = famBy[p.family] ? famBy[p.family].group : GROUPS[0].key; });

  const RECENT = 2018;
  const allYears = P.map((p) => p.year);
  const Y0 = Math.min(1999, ...allYears), Y1 = Math.max(2026, ...allYears);
  const YEARS = Array.from({ length: Y1 - Y0 + 1 }, (_, i) => Y0 + i);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(pointer: fine)').matches;

  const color = (p) => grpBy[p.group].color;
  const famName = (p) => (famBy[p.family] || {}).name || p.family;
  const scholar = (p) => 'https://scholar.google.com/scholar?q=' + encodeURIComponent('"' + p.title + '"');
  const paperLink = (p) => (p.arxiv ? 'https://arxiv.org/abs/' + p.arxiv : p.doi ? 'https://doi.org/' + p.doi : p.url || scholar(p));
  const authorShort = (p) => { const a = p.authors.split(',').map((s) => s.trim()).filter(Boolean); return a.length > 1 ? a[0] + ' et al.' : (a[0] || ''); };
  const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
  const entries = (n) => n + (n === 1 ? ' entry' : ' entries');

  /* ---------- shared helpers ---------- */
  const toastEl = $('#toast');
  let toastTimer = 0;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2400);
  }

  function safe(sectionId, fn) {
    try { fn(); } catch (err) {
      console.error('Faceprint Atlas: the "' + sectionId + '" section failed to draw.', err);
      const sec = document.getElementById(sectionId);
      if (sec) sec.insertAdjacentHTML('beforeend', '<p class="at-error">This section could not be drawn. The rest of the atlas still works.</p>');
    }
  }

  /* Hook dynamic elements into the site's custom cursor (scripts.js only wires elements present at load). */
  const outline = document.querySelector('.cursor-outline');
  const HOVER = 'a, button, summary, select, input, label';
  if (!fine) document.documentElement.classList.add('at-native-cursor');
  if (outline && fine) {
    root.addEventListener('mouseover', (e) => { if (e.target.closest(HOVER)) outline.classList.add('hovering'); });
    root.addEventListener('mouseout', (e) => {
      const from = e.target.closest(HOVER);
      const to = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest(HOVER) : null;
      if (from && from !== to) outline.classList.remove('hovering');
    });
  }

  /* ---------- library state (declared first: every section can filter the library) ---------- */
  const state = { q: '', fams: new Set(), y0: Y0, y1: Y1, vt: '', code: false, sort: 'ynew', ids: null, pathName: '', pathOrder: false };
  const els = { q: $('#q'), y0: $('#y0'), y1: $('#y1'), vt: $('#vt'), code: $('#codeOnly'), sort: $('#sort') };
  const chipsEl = $('#famChips'), yearChipsEl = $('#yearChips'), cardsEl = $('#cards'), countEl = $('#count');
  let current = [], allOpen = false;

  function resetFilters() { Object.assign(state, { q: '', fams: new Set(), y0: Y0, y1: Y1, vt: '', code: false, ids: null, pathName: '', pathOrder: false }); }
  function syncControls() {
    els.q.value = state.q; els.y0.value = state.y0; els.y1.value = state.y1; els.vt.value = state.vt; els.code.checked = state.code; els.sort.value = state.sort;
    chipsEl.querySelectorAll('[data-fam]').forEach((b) => b.setAttribute('aria-pressed', String(state.fams.has(b.dataset.fam))));
    yearChipsEl.querySelectorAll('[data-y0]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.y0 === state.y0 && +b.dataset.y1 === state.y1)));
  }
  function goLibrary() { $('#library').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); }
  function openEntry(id) {
    if (!byId[id]) return;
    let el = document.getElementById('p-' + id);
    if (!el) { resetFilters(); syncControls(); render(); el = document.getElementById('p-' + id); }
    if (!el) return;
    el.open = true;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    const sum = el.querySelector('summary');
    if (sum) sum.focus({ preventScroll: true });
  }

  /* ---------- overview: stats and the sky ---------- */
  safe('overview', () => {
    const venues = new Set(P.map((p) => p.venue.replace(/\s*\(.*$/, '').trim()));
    $('#stats').innerHTML = [['Entries', P.length], ['From ' + RECENT + ' onward', P.filter((p) => p.year >= RECENT).length], ['Distinct venues', venues.size], ['With public code', P.filter((p) => p.code).length]]
      .map(([k, v]) => `<div class="at-stat"><span class="v">${v}</span><span class="k">${h(k)}</span></div>`).join('');
    $('#skyLegend').innerHTML = GROUPS.map((g) => `<span><i style="background:${g.colorDark}"></i>${h(g.name)}</span>`).join('') +
      '<span class="arc"><i></i>Defense tested by a later paper</span>';

    const cv = $('#sky'), tip = $('#skyTip'), ctx = cv.getContext('2d');
    const rows = GROUPS.map((g) => g.key);
    const L = 18, R = 18, T = 16, B = 30;
    let W = 0, H = 0, pts = [], index = {}, hover = -1, raf = 0, visible = true;
    const start = performance.now();
    const rng = (seed) => { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; };
    const xOf = (yr) => L + (yr - Y0 + 0.5) / (Y1 - Y0 + 1) * (W - L - R);

    function layout() {
      const r = cv.getBoundingClientRect();
      W = r.width; H = r.height;
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rnd = rng(7), rowH = (H - T - B) / rows.length;
      pts = P.map((p) => ({ p, x: xOf(p.year + (rnd() - 0.5) * 0.8), y: T + rows.indexOf(p.group) * rowH + rowH * (0.18 + rnd() * 0.64), ph: rnd() * Math.PI * 2 }));
      index = Object.fromEntries(pts.map((q) => [q.p.id, q]));
    }
    const pos = (q, t) => [q.x, q.y + (reduced ? 0 : Math.sin(t * 0.8 + q.ph) * 2.4)];

    function frame(now) {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, W, H);
      ctx.font = '10px "Space Mono", monospace';
      ctx.textAlign = 'center';
      const every = W < 520 ? 6 : 3;
      for (let yr = Y0 + every; yr <= Y1; yr += every) {
        const x = xOf(yr);
        ctx.fillStyle = 'rgba(226, 232, 240, 0.07)'; ctx.fillRect(x, 10, 1, H - B - 6);
        ctx.fillStyle = 'rgba(203, 213, 225, 0.75)'; ctx.fillText(String(yr), x, H - 10);
      }
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(240, 160, 32, 0.5)';
      DUELS.forEach((d) => {
        const a = index[d.defense], b = index[d.attack];
        if (!a || !b) return;
        const [x1, y1] = pos(a, t), [x2, y2] = pos(b, t);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo((x1 + x2) / 2, Math.min(y1, y2) - 34, x2, y2); ctx.stroke();
      });
      pts.forEach((q, i) => {
        const [x, y] = pos(q, t), r = i === hover ? 6.5 : 4;
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.fillStyle = '#0F172A'; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = grpBy[q.p.group].colorDark;
        ctx.globalAlpha = hover >= 0 && i !== hover ? 0.5 : 0.95; ctx.fill();
      });
      ctx.globalAlpha = 1;
      raf = !reduced && visible ? requestAnimationFrame(frame) : 0;
    }
    const redraw = () => { if (!raf) frame(performance.now()); };

    function nearest(e) {
      const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      let best = -1, bd = 14 * 14;
      pts.forEach((q, i) => { const d = (q.x - mx) ** 2 + (q.y - my) ** 2; if (d < bd) { bd = d; best = i; } });
      return best;
    }
    cv.addEventListener('mousemove', (e) => {
      hover = nearest(e);
      if (hover >= 0) {
        const q = pts[hover];
        tip.innerHTML = `<b>${q.p.year}</b>${h(q.p.title)}`;
        const tw = tip.offsetWidth;
        tip.style.left = Math.max(tw / 2 + 6, Math.min(W - tw / 2 - 6, q.x)) + 'px';
        tip.style.top = q.y + 'px';
        tip.classList.add('on');
        if (outline && fine) outline.classList.add('hovering');
      } else {
        tip.classList.remove('on');
        if (outline && fine) outline.classList.remove('hovering');
      }
      redraw();
    });
    cv.addEventListener('mouseleave', () => { hover = -1; tip.classList.remove('on'); if (outline) outline.classList.remove('hovering'); redraw(); });
    cv.addEventListener('click', (e) => { const i = nearest(e); if (i >= 0) openEntry(pts[i].p.id); });

    let resizeTimer = 0;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { layout(); redraw(); }, 120); });
    if ('IntersectionObserver' in window && !reduced) {
      new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); }).observe(cv);
    }
    layout();
    frame(performance.now());
  });

  /* ---------- years ---------- */
  safe('years', () => {
    const count = (a, b) => P.filter((p) => p.year >= a && p.year <= b).length;
    const tiles = [{ label: 'Before ' + RECENT, a: Y0, b: RECENT - 1, pre: true }]
      .concat(YEARS.filter((y) => y >= RECENT).map((y) => ({ label: String(y), a: y, b: y })));
    const max = Math.max(1, ...tiles.map((t) => count(t.a, t.b)));
    const grid = $('#yearGrid');
    grid.innerHTML = tiles.map((t) => {
      const n = count(t.a, t.b);
      return `<button type="button" class="at-tile at-year${t.pre ? ' pre' : ''}" data-y0="${t.a}" data-y1="${t.b}"><span class="y">${t.label}</span><span class="n">${entries(n)}</span><span class="bar"><span style="width:${Math.round(n / max * 100)}%"></span></span></button>`;
    }).join('');
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('[data-y0]');
      if (!b) return;
      resetFilters(); state.y0 = +b.dataset.y0; state.y1 = +b.dataset.y1; syncControls(); render(); goLibrary();
    });
  });

  /* ---------- families ---------- */
  safe('families', () => {
    const LAYERS = [
      ['picture', 'On the picture', 'Change the image before anyone sees it'],
      ['numbers', 'On the numbers', 'Protect the faceprint and what it reveals'],
      ['system', 'In the system', 'Change how recognisers are trained, deployed and audited'],
      ['cross', 'Cutting across', 'Attacks, evaluations and the field itself']
    ];
    const sparkYears = YEARS.filter((y) => y >= 2005);
    const spark = (f) => {
      const n = sparkYears.map((y) => P.filter((p) => p.family === f.key && p.year === y).length);
      const m = Math.max(1, ...n), w = 100 / sparkYears.length, c = grpBy[f.group].color;
      return `<svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">${n.map((v, i) => (v ? `<rect x="${(i * w + 0.6).toFixed(2)}" y="${(30 - v / m * 28).toFixed(2)}" width="${(w - 1.2).toFixed(2)}" height="${(v / m * 28).toFixed(2)}" fill="${c}"></rect>` : '')).join('')}</svg>`;
    };
    const tax = $('#tax');
    tax.innerHTML = LAYERS.map(([key, name, sub]) => {
      const fams = FAMS.filter((f) => f.layer === key);
      if (!fams.length) return '';
      return `<div class="at-layer"><div class="lab"><b>${name}</b><span>${sub}</span></div><div class="at-fams">${fams.map((f) =>
        `<button type="button" class="at-tile at-fam" data-fam="${h(f.key)}" style="border-top-color:${grpBy[f.group].color}"><span class="top"><span class="nm">${h(f.name)}</span><span class="cnt">${P.filter((p) => p.family === f.key).length}</span></span>${spark(f)}<span class="df">${h(f.description)}</span><span class="ex">e.g. ${h(f.examples)}</span></button>`
      ).join('')}</div></div>`;
    }).join('');
    tax.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fam]');
      if (!b) return;
      resetFilters(); state.fams = new Set([b.dataset.fam]); syncControls(); render(); goLibrary();
    });
  });

  /* ---------- timeline chart ---------- */
  safe('timeline', () => {
    const viz = $('#tlViz'), plot = viz.querySelector('[data-plot]'), tip = viz.querySelector('[data-tip]');
    const grid = YEARS.map((y) => Object.fromEntries(GROUPS.map((g) => [g.key, P.filter((p) => p.year === y && p.group === g.key).length])));
    const totals = grid.map((g) => Object.values(g).reduce((a, b) => a + b, 0));
    const maxT = Math.max(1, ...totals);
    $('#tlLegend').innerHTML = GROUPS.map((g) => `<span><i style="background:${g.color}"></i>${h(g.name)}</span>`).join('');
    const seg = (x, y, w, hh, r) => (r
      ? `M${x} ${y + hh}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + hh}Z`
      : `M${x} ${y}H${x + w}V${y + hh}H${x}Z`);

    function chart() {
      const W = 1000, L = 36, R = 12, T = 20, B = 34, PH = 250, H = T + PH + B;
      const slot = (W - L - R) / YEARS.length, bw = Math.min(24, slot - 8);
      const step = maxT > 20 ? 10 : 5, top = Math.ceil(maxT / step) * step, sy = (v) => T + PH - v / top * PH;
      let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Stacked columns of atlas entries per year by group">`;
      for (let v = 0; v <= top; v += step) s += `<line class="grid" x1="${L}" y1="${sy(v)}" x2="${W - R}" y2="${sy(v)}"></line><text class="tick" x="${L - 6}" y="${sy(v) + 3}" text-anchor="end">${v}</text>`;
      s += `<line class="axis" x1="${L}" y1="${sy(0)}" x2="${W - R}" y2="${sy(0)}"></line>`;
      const labelled = totals.map((t, i) => [t, i]).sort((a, b) => b[0] - a[0]).slice(0, 3).map((x) => x[1]);
      YEARS.forEach((y, i) => {
        const x = +(L + i * slot + (slot - bw) / 2).toFixed(1);
        let acc = 0;
        GROUPS.forEach((g) => {
          const n = grid[i][g.key];
          if (!n) return;
          const y1 = sy(acc), y2 = sy(acc + n), hh = Math.max(0, y1 - y2 - 2), isTop = acc + n === totals[i];
          s += `<path d="${seg(x, +(y2 + 2).toFixed(1), +bw.toFixed(1), +hh.toFixed(1), isTop ? Math.min(3, hh / 2) : 0)}" fill="${g.color}" data-y="${y}" data-g="${g.key}" data-n="${n}"></path>`;
          acc += n;
        });
        if (labelled.includes(i) && totals[i]) s += `<text class="lbl" x="${(x + bw / 2).toFixed(1)}" y="${(sy(totals[i]) - 4).toFixed(1)}" text-anchor="middle">${totals[i]}</text>`;
        if ((y - Y0) % 3 === 0) s += `<text class="tick" x="${(x + bw / 2).toFixed(1)}" y="${H - 12}" text-anchor="middle">${y}</text>`;
      });
      plot.innerHTML = s + '</svg>';
    }
    function table() {
      plot.innerHTML = `<table><thead><tr><th>Year</th>${GROUPS.map((g) => `<th>${h(g.name)}</th>`).join('')}<th>Total</th></tr></thead><tbody>${YEARS.map((y, i) => (totals[i]
        ? `<tr><td>${y}</td>${GROUPS.map((g) => `<td>${grid[i][g.key] || ''}</td>`).join('')}<td><b>${totals[i]}</b></td></tr>` : '')).join('')}</tbody></table>`;
    }
    plot.addEventListener('mousemove', (e) => {
      const r = e.target.closest('[data-y]');
      if (!r) { tip.classList.remove('on'); return; }
      const b = viz.getBoundingClientRect();
      tip.textContent = `${r.dataset.y} · ${grpBy[r.dataset.g].name} · ${entries(+r.dataset.n)}`;
      tip.style.left = (e.clientX - b.left) + 'px';
      tip.style.top = (e.clientY - b.top) + 'px';
      tip.classList.add('on');
    });
    plot.addEventListener('mouseleave', () => tip.classList.remove('on'));
    plot.addEventListener('click', (e) => {
      const r = e.target.closest('[data-y]');
      if (!r) return;
      resetFilters();
      state.fams = new Set(FAMS.filter((f) => f.group === r.dataset.g).map((f) => f.key));
      state.y0 = state.y1 = +r.dataset.y;
      syncControls(); render(); goLibrary();
    });
    viz.querySelectorAll('.at-toggle button').forEach((b) => b.addEventListener('click', () => {
      viz.querySelectorAll('.at-toggle button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (b.dataset.view === 'chart') chart(); else table();
    }));
    chart();
  });

  /* ---------- library ---------- */
  function filtered() {
    const q = state.q.trim().toLowerCase();
    let arr = P.filter((p) => (!state.fams.size || state.fams.has(p.family)) && p.year >= state.y0 && p.year <= state.y1 &&
      (!state.vt || p.venueType === state.vt) && (!state.code || p.code));
    if (q) {
      arr = arr.filter((p) => [p.title, p.authors, p.venue, p.approach, p.findings, p.threatModel, p.limitations, p.datasets, p.models, p.tags.join(' '), famName(p)]
        .join(' ').toLowerCase().includes(q));
    }
    if (state.ids) {
      const order = new Map(state.ids.map((id, i) => [id, i]));
      arr = arr.filter((p) => order.has(p.id));
      if (state.pathOrder) return arr.sort((a, b) => order.get(a.id) - order.get(b.id));
    }
    const famIdx = new Map(FAMS.map((f, i) => [f.key, i]));
    const cmp = {
      ynew: (a, b) => b.year - a.year || a.title.localeCompare(b.title),
      yold: (a, b) => a.year - b.year || a.title.localeCompare(b.title),
      title: (a, b) => a.title.localeCompare(b.title),
      family: (a, b) => famIdx.get(a.family) - famIdx.get(b.family) || b.year - a.year
    }[state.sort] || ((a, b) => b.year - a.year);
    return arr.sort(cmp);
  }

  function card(p, open) {
    const links = [];
    if (p.arxiv) links.push(`<a href="https://arxiv.org/abs/${h(p.arxiv)}" target="_blank" rel="noopener"><i class="fas fa-file-lines" aria-hidden="true"></i>arXiv ${h(p.arxiv)}</a>`);
    if (p.doi) links.push(`<a href="https://doi.org/${h(p.doi)}" target="_blank" rel="noopener"><i class="fas fa-link" aria-hidden="true"></i>DOI</a>`);
    if (p.url && !p.arxiv && !p.doi) links.push(`<a href="${h(p.url)}" target="_blank" rel="noopener"><i class="fas fa-link" aria-hidden="true"></i>Publisher</a>`);
    if (p.github) {
      const gh = p.github.includes('github.com');
      links.push(`<a href="${h(p.github)}" target="_blank" rel="noopener"><i class="${gh ? 'fab fa-github' : 'fas fa-code'}" aria-hidden="true"></i>${gh ? 'GitHub' : 'Code'}</a>`);
    }
    links.push(`<a href="${scholar(p)}" target="_blank" rel="noopener"><i class="fas fa-graduation-cap" aria-hidden="true"></i>Google Scholar</a>`);
    links.push(`<a href="#p-${h(p.id)}"><i class="fas fa-hashtag" aria-hidden="true"></i>Link to this entry</a>`);
    const fld = (k, v, wide) => `<div class="at-fld${wide ? ' wide' : ''}"><span class="k">${k}</span><span class="v">${v}</span></div>`;
    return `<details class="at-card" id="p-${h(p.id)}" style="border-left-color:${color(p)}"${open ? ' open' : ''}>` +
      `<summary><span class="at-meta"><span class="yr">${p.year}</span><span class="fam"><i style="background:${color(p)}"></i>${h(famName(p))}</span><span class="vt">${h(p.venueType)}</span><span>${h(p.venue)}</span>${p.code ? '<span class="code">● Code</span>' : ''}</span>` +
      `<span class="ttl">${h(p.title)}</span><span class="au">${h(p.authors)}</span></summary>` +
      '<div class="body">' +
      fld('Approach', h(p.approach), true) +
      fld('Key findings', h(p.findings), true) +
      fld('Datasets', h(p.datasets)) +
      fld('Models and backbones', h(p.models)) +
      fld('Threat model · protects against', h(p.threatModel)) +
      fld('Utility preserved', h(p.utility)) +
      fld('Limitations and known attacks', h(p.limitations), true) +
      fld('Tags', `<span class="at-tags">${p.tags.map((t) => `<span>${h(t)}</span>`).join('')}</span>`) +
      fld('Links', `<span class="at-links">${links.join('')}</span>`) +
      '</div></details>';
  }

  function safeCard(p) {
    try { return card(p, allOpen); } catch (err) {
      const id = String(p && p.id).replace(/[^\w-]/g, '');
      console.error('Faceprint Atlas: entry "' + id + '" could not be drawn. Check its fields in assets/data/atlas-data.js.', err);
      return '<div class="at-card" id="p-' + id + '"><p class="at-error">Entry ' + id + ' could not be displayed.</p></div>';
    }
  }

  function render() {
    current = filtered();
    countEl.textContent = current.length + ' of ' + entries(P.length) + (state.ids ? ' · reading path: ' + state.pathName : '');
    cardsEl.innerHTML = current.length ? current.map(safeCard).join('') : '<div class="at-empty">No entries match. Loosen a filter or clear the search.</div>';
  }

  function csvOf(rows) {
    const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const head = ['id', 'title', 'authors', 'year', 'venue', 'venue_type', 'family', 'datasets', 'models', 'approach', 'findings', 'threat_model', 'utility', 'limitations', 'tags', 'code', 'github', 'paper_link'];
    return [head.join(',')].concat(rows.map((p) => [p.id, p.title, p.authors, p.year, p.venue, p.venueType, famName(p), p.datasets, p.models, p.approach, p.findings,
      p.threatModel, p.utility, p.limitations, p.tags.join('; '), p.code ? 'yes' : 'no', p.github, paperLink(p)].map(esc).join(','))).join('\r\n');
  }
  function downloadCsv() {
    if (!current.length) { toast('Nothing to download. Loosen the filters first.'); return; }
    const blob = new Blob(['﻿' + csvOf(current)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'faceprint-atlas-' + current.length + '-entries.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Downloaded ' + entries(current.length) + ' as CSV');
  }
  function copyText(text, ok) {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let done = false;
      try { done = document.execCommand('copy'); } catch (err) { done = false; }
      ta.remove();
      toast(done ? ok : 'Your browser blocked copying. Use the CSV download instead.');
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => toast(ok), fallback); else fallback();
  }
  function copyRefs() {
    if (!current.length) { toast('Nothing to copy. Loosen the filters first.'); return; }
    copyText(current.map((p) => `${p.authors}. ${p.title}. ${p.venue}, ${p.year}. ${paperLink(p)}`).join('\n'), 'Copied ' + plural(current.length, 'reference'));
  }

  safe('library', () => {
    els.y0.min = els.y1.min = Y0; els.y0.max = els.y1.max = Y1;
    chipsEl.innerHTML = FAMS.map((f) => `<button type="button" class="at-chip" data-fam="${h(f.key)}" aria-pressed="false"><i style="background:${grpBy[f.group].color}"></i>${h(f.short)}</button>`).join('');
    yearChipsEl.innerHTML = [{ l: 'All years', a: Y0, b: Y1 }, { l: 'Before ' + RECENT, a: Y0, b: RECENT - 1 }]
      .concat(YEARS.filter((y) => y >= RECENT).map((y) => ({ l: String(y), a: y, b: y })))
      .map((t) => `<button type="button" class="at-chip" data-y0="${t.a}" data-y1="${t.b}" aria-pressed="false">${t.l}</button>`).join('');

    chipsEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fam]');
      if (!b) return;
      const k = b.dataset.fam;
      if (state.fams.has(k)) state.fams.delete(k); else state.fams.add(k);
      state.ids = null; syncControls(); render();
    });
    yearChipsEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-y0]');
      if (!b) return;
      state.y0 = +b.dataset.y0; state.y1 = +b.dataset.y1; state.ids = null; syncControls(); render();
    });
    els.q.addEventListener('input', () => { state.q = els.q.value; state.ids = null; render(); });
    const yearInput = (key) => () => {
      const v = parseInt(els[key].value, 10);
      state[key] = Number.isFinite(v) ? Math.min(Y1, Math.max(Y0, v)) : (key === 'y0' ? Y0 : Y1);
      state.ids = null; syncControls(); render();
    };
    els.y0.addEventListener('change', yearInput('y0'));
    els.y1.addEventListener('change', yearInput('y1'));
    els.vt.addEventListener('change', () => { state.vt = els.vt.value; render(); });
    els.code.addEventListener('change', () => { state.code = els.code.checked; render(); });
    els.sort.addEventListener('change', () => { state.sort = els.sort.value; state.pathOrder = false; render(); });
    $('#reset').addEventListener('click', () => { resetFilters(); state.sort = 'ynew'; syncControls(); render(); });
    $('#expandAll').addEventListener('click', (e) => {
      allOpen = !allOpen;
      cardsEl.querySelectorAll('details').forEach((d) => { d.open = allOpen; });
      e.currentTarget.textContent = allOpen ? 'Collapse all' : 'Expand all';
    });
    $('#dlCsv').addEventListener('click', downloadCsv);
    $('#copyRefs').addEventListener('click', copyRefs);
    syncControls();
    try { render(); } catch (err) {
      console.warn('Faceprint Atlas: the first library render failed; retrying once.', err);
      setTimeout(() => safe('library', render), 50);
    }
  });

  /* ---------- attacks vs defenses ---------- */
  safe('duels', () => {
    const side = (ref, cls, label) => {
      const p = byId[ref];
      return p
        ? `<div class="at-side ${cls}"><span class="k">${label}</span><span class="t"><button type="button" data-goto="${h(p.id)}">${h(p.title)}</button></span><span class="d">${h(authorShort(p))} · ${h(p.venue)} ${p.year}</span></div>`
        : `<div class="at-side ${cls}"><span class="k">${label}</span><span class="t">${h(ref)}</span></div>`;
    };
    const list = $('#duelList');
    list.innerHTML = DUELS.map((d) => `<div class="at-duel">${side(d.defense, 'def', 'Defense')}<div class="at-mid">tested by</div>${side(d.attack, 'att', 'Attack or evaluation')}<div class="at-side verdict"><span class="k">What it showed</span><span class="d">${h(d.verdict)}</span></div></div>`).join('');
    list.addEventListener('click', (e) => { const b = e.target.closest('[data-goto]'); if (b) openEntry(b.dataset.goto); });
  });

  /* ---------- reading paths ---------- */
  safe('paths', () => {
    const list = $('#pathList');
    list.innerHTML = PATHS.map((pt, i) => `<div class="at-path"><h3>${h(pt.name)}</h3><p>${h(pt.description)}</p><ol>${pt.ids.filter((id) => byId[id]).map((id) =>
      `<li>${h(byId[id].title)} <span class="yr">${byId[id].year}</span></li>`).join('')}</ol><button class="at-btn at-btn-outline" type="button" data-path="${i}">Open in library</button></div>`).join('');
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-path]');
      if (!b) return;
      const pt = PATHS[+b.dataset.path];
      resetFilters();
      Object.assign(state, { ids: pt.ids.slice(), pathName: pt.name, pathOrder: true });
      syncControls(); render(); goLibrary();
    });
  });

  /* ---------- open problems and footer note ---------- */
  safe('open', () => {
    $('#problems').innerHTML = (DATA.openProblems || []).map((o) => `<div class="at-problem"><h3>${h(o.title)}</h3><p>${h(o.text)}</p></div>`).join('');
  });
  const updated = $('#updated');
  if (updated && DATA.updated) updated.textContent = 'Last updated ' + DATA.updated + '.';

  /* ---------- permalinks: atlas.html#p-<id> opens that entry ---------- */
  const fromHash = () => {
    if (location.hash.indexOf('#p-') !== 0) return;
    const id = decodeURIComponent(location.hash.slice(3));
    if (byId[id]) openEntry(id);
  };
  window.addEventListener('hashchange', fromHash);
  if (location.hash.indexOf('#p-') === 0) setTimeout(fromHash, 60);
})();
