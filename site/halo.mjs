// HALO (Section 7). Read mode shows the paper's Table 22 (site/data/halo-read.json, exported by
// tools/paper/export_halo.py): for each of 40 works, three oversight agents read its paper or blog and
// released code, and a majority vote decides whether each coupling channel and each step of the chain
// of evidence is reported. Run mode shows HALO's own runs (site/data/halo-results.json, exported from
// the HALO codebase by tools/halo/export_results.py): a work's code runs on fixed inputs, once as
// released and once with a channel or step cut, and a blind judge compares the two runs. A work in the
// table opens its sheet; a work in run mode opens its tests.
import { openSheet, registerView } from './sheet.mjs';
import { esc } from './systems.mjs';

const CHANNELS = ['S→M', 'M→A', 'A→S', 'M→S', 'A→M'];
const STEPS = [['record', 'Record', 'Rec.'], ['outcome', 'Outcome', 'Out.'], ['attribution', 'Attribution', 'Attr.'], ['revision', 'Revision', 'Rev.'], ['later_use', 'Later use', 'Use']];
const STEP_NAME = Object.fromEntries(STEPS.map(([id, name]) => [id, name]));
const DOMAINS = [['wearable', 'Wearable'], ['physical', 'Physical'], ['digital', 'Digital']];
const DOMAIN = Object.fromEntries(DOMAINS);
const MARK = { '●': ['yes', 'reported'], '○': ['abs', 'explicitly absent'], '◐': ['ins', 'insufficient reporting to decide'] };
const arrow = id => id.replace('->', '→');
const cutName = id => STEP_NAME[id] || arrow(id);
const pct = (n, d) => `${((n / d) * 100).toFixed(1)}%`;

const json = name => fetch(new URL(`./data/${name}`, import.meta.url)).then(r => { if (!r.ok) throw new Error(`${name}: ${r.status}`); return r.json(); });
let loading = null, results = null;
// run cases keep the paper's name for their work (one work, one name), found through the cite key
const load = () => (loading ||= Promise.all([json('halo-read.json'), json('halo-results.json'), json('halo-evidence.json'), json('halo-lines.json')]).then(([paper, codebase, evidence, lines]) => {
  for (const c of codebase.run.cases) c.name = paper.rows.find(r => r.key === codebase.works[c.id])?.name || c.name;
  return { paper, codebase, evidence, lines };
}));

// ---------- read mode: the paper's Table 22 ----------

function channelChart(paper) {
  const n = paper.counts.works;
  return `<figure class="hx-chart">
    <figcaption>Coupling channels <small>of ${n} works</small></figcaption>
    ${CHANNELS.map(ch => {
      const marks = paper.rows.map(r => r.cells[ch]);
      const c = { yes: marks.filter(m => m === '●').length, ins: marks.filter(m => m === '◐').length, abs: marks.filter(m => m === '○').length };
      return `<div class="hx-row"><b>${ch}</b><span class="hx-stack" role="img" aria-label="${ch}: ${c.yes} reported, ${c.ins} insufficient to decide, ${c.abs} explicitly absent">
        <i class="is-yes" style="width:${pct(c.yes, n)}"></i><i class="is-ins" style="width:${pct(c.ins, n)}"></i><i class="is-abs" style="width:${pct(c.abs, n)}"></i></span><span class="hx-n">${c.yes}</span></div>`;
    }).join('')}
    <p class="hx-key"><span><i class="is-yes"></i>reported</span><span><i class="is-ins"></i>insufficient</span><span><i class="is-abs"></i>absent</span></p>
  </figure>`;
}

function chainChart(paper) {
  const n = paper.counts.works;
  return `<figure class="hx-chart hx-chain">
    <figcaption>Chain of evidence <small>works that state each step</small></figcaption>
    <div class="hx-cols">${STEPS.map(([id, name]) => {
      const v = paper.counts.stated[id];
      return `<div class="hx-col" role="img" aria-label="${name}: ${v} of ${n}"><span class="hx-col-n">${v}</span><span class="hx-col-bar"><i style="height:${pct(v, n)}"></i></span><span class="hx-col-name">${name}</span></div>`;
    }).join('')}</div>
  </figure>`;
}

function cellHtml(row, id, label, cls) {
  return `<td><span class="hx-cell ${cls}" tabindex="0" data-tip="${esc(row.id)}|${esc(id)}" aria-label="${esc(row.name)}, ${esc(label)}"></span></td>`;
}

function matrixHtml(paper) {
  const head = `<tr><th scope="col" class="hx-sys">Work</th>${CHANNELS.map(ch => `<th scope="col">${ch}</th>`).join('')}${STEPS.map(([id, name, short], i) => `<th scope="col" class="${i === 0 ? 'is-first' : ''}" title="${name}">${short}</th>`).join('')}</tr>`;
  const body = DOMAINS.map(([d, name]) => {
    const rows = paper.rows.filter(r => r.group === name);
    if (!rows.length) return '';
    return `<tr class="hx-group"><th colspan="11" scope="rowgroup">${name}</th></tr>${rows.map(r => `<tr${r.product ? ' class="is-product"' : ''}>
      <th scope="row" class="hx-sys"><button type="button" class="hx-name" data-open-work="${esc(r.key)}" data-tip="${esc(r.id)}|work">${esc(r.name)}</button>${r.product ? '<sup title="Product">†</sup>' : ''}</th>
      ${CHANNELS.map(ch => { const [cls, word] = MARK[r.cells[ch]] || MARK['◐']; return cellHtml(r, ch, `${ch}: ${word}`, `is-${cls}`); }).join('')}${STEPS.map(([id, name]) => cellHtml(r, id, `${name}: ${r.chain[id] ? 'stated' : 'not stated'}`, r.chain[id] ? 'is-stated' : 'is-not')).join('')}</tr>`).join('')}`;
  }).join('');
  return `<div class="hx-scroll"><table class="hx-matrix"><thead><tr class="hx-heads"><th></th><th colspan="5" scope="colgroup">Coupling channels</th><th colspan="5" scope="colgroup" class="is-first">Chain of evidence</th></tr>${head}</thead><tbody>${body}</tbody></table></div>
    <p class="hx-legend"><span><i class="hx-cell is-yes"></i>reported</span><span><i class="hx-cell is-ins"></i>unreported or insufficiently specified</span><span><i class="hx-cell is-abs"></i>explicitly absent</span><span><i class="hx-cell is-stated"></i>stated</span><span><i class="hx-cell is-not"></i>not stated</span><span class="hx-legend-product">† product</span></p>`;
}

// ---------- read mode: a card for each cell ----------
// A channel card says in one line what passes along that edge in this work and names the section of the
// work's paper; an evidence-step card says what the step holds. The column heads already show the edge
// or step, so the cards carry no diagram. A work's name shows what the work is.

const FALLBACK = {
  '●': 'Reported in the work’s paper or released code.',
  '◐': 'Not specified clearly enough in the paper or code to decide.',
  '○': 'The source states that this flow is absent.',
  stated: 'Stated in the primary source.',
  not: 'Not stated in the primary source.'
};

function tipHtml({ paper, evidence, lines }, id) {
  const [rowId, cell] = id.split('|');
  const row = paper.rows.find(r => r.id === rowId);
  if (!row) return '';
  const ev = evidence[rowId] || {};
  const own = lines?.[rowId] || {};
  const head = (sub, mark) => `<p class="hx-tip-head"><b>${esc(row.name)}</b>${sub ? `<span>${sub}</span>` : ''}${mark || ''}</p>`;
  if (cell === 'work') {
    return `${head(esc(row.group) + (row.product ? ' · product' : ''))}
      <p class="hx-tip-line">${esc(own.work || ev.summary || '')}</p>
      <p class="hx-tip-src">Select the name for its details.</p>`;
  }
  if (CHANNELS.includes(cell)) {
    const mark = row.cells[cell];
    const [cls, word] = MARK[mark] || MARK['◐'];
    const c = ev.cells?.[cell] || {};
    return `${head(cell, `<em class="hx-tip-mark is-${cls}">${word}</em>`)}
      <p class="hx-tip-line">${esc(own[cell] || FALLBACK[mark] || '')}</p>
      ${c.where ? `<p class="hx-tip-src">${mark === '●' ? 'In the paper' : 'Checked in'}: ${esc(c.where)}${c.url ? ` <a href="${esc(c.url)}" target="_blank" rel="noopener" tabindex="-1">↗</a>` : ''}</p>` : ''}`;
  }
  const on = row.chain[cell];
  return `${head(esc(STEP_NAME[cell] || cell), `<em class="hx-tip-mark ${on ? 'is-stated' : 'is-not'}">${on ? 'stated' : 'not stated'}</em>`)}
    <p class="hx-tip-line">${esc(own[cell] || FALLBACK[on ? 'stated' : 'not'])}</p>`;
}

/**
 * One floating card for the whole table. Hovering or focusing a cell shows it for that cell. Clicking
 * a cell pins it: the card stays where it is, its source link can be clicked, and it closes on a second
 * click of the same cell, a click elsewhere, the close button, or Escape. On touch screens a tap pins.
 */
function mountTips(root, d) {
  const tip = document.createElement('div');
  tip.className = 'hx-tip';
  tip.id = 'hx-tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.append(tip);
  let current = null, pinned = false;
  const place = el => {
    const r = el.getBoundingClientRect();
    tip.style.left = '0px'; tip.style.top = '0px';
    const w = tip.offsetWidth, h = tip.offsetHeight, m = 12;
    const left = Math.min(Math.max(m, r.left + r.width / 2 - w / 2), innerWidth - w - m);
    const above = r.top - h - 10 >= m;
    tip.style.left = `${left}px`;
    tip.style.top = `${above ? r.top - h - 10 : Math.min(r.bottom + 10, innerHeight - h - m)}px`;
    tip.classList.toggle('is-below', !above);
  };
  const show = el => {
    if (current === el) return;
    current?.removeAttribute('aria-describedby');
    current?.classList.remove('is-pinned');
    current = el;
    tip.innerHTML = `${tipHtml(d, el.dataset.tip)}<button type="button" class="hx-tip-close" aria-label="Close">×</button>`;
    tip.hidden = false;
    tip.classList.remove('is-pop');
    void tip.offsetWidth;          // restart the pop for each new cell
    tip.classList.add('is-pop');
    el.setAttribute('aria-describedby', 'hx-tip');
    place(el);
  };
  const pin = on => {
    pinned = on;
    tip.classList.toggle('is-pinned', on);
    current?.classList.toggle('is-pinned', on);
  };
  const hide = () => {
    pin(false);
    current?.removeAttribute('aria-describedby');
    current = null;
    tip.hidden = true;
  };
  const coarse = () => window.matchMedia?.('(pointer: coarse)').matches;
  root.addEventListener('pointerover', e => { const el = e.target.closest('[data-tip]'); if (el && !pinned && !coarse()) show(el); });
  root.addEventListener('pointerout', e => { const el = e.target.closest('[data-tip]'); if (el && !pinned && !el.contains(e.relatedTarget) && !coarse()) hide(); });
  root.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (el && !pinned) show(el); });
  root.addEventListener('focusout', () => { if (!pinned) hide(); });
  root.addEventListener('click', e => {
    const el = e.target.closest('.hx-cell[data-tip]');
    if (!el) return;
    if (pinned && current === el) { hide(); return; }
    show(el);
    pin(true);
  });
  root.addEventListener('keydown', e => {
    const el = e.target.closest?.('.hx-cell[data-tip]');
    if (!el || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    if (pinned && current === el) hide(); else { show(el); pin(true); }
  });
  tip.addEventListener('click', e => { if (e.target.closest('.hx-tip-close')) { const el = current; hide(); el?.focus(); } });
  document.addEventListener('pointerdown', e => { if (current && !e.target.closest('[data-tip], .hx-tip')) hide(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && current) { const el = current; hide(); if (el.matches('.hx-cell')) el.focus(); } });
  addEventListener('scroll', () => { if (current) place(current); }, { passive: true });
  addEventListener('resize', () => { if (current) place(current); });
  return hide;
}

// ---------- run mode ----------

const net = t => (t.original - t.cut_wins) / t.pairs;
const isStepTest = t => t.cut.some(k => !k.includes('→'));

/** Width of a name in the chart's units (the charts are drawn at about one unit per pixel). */
let ruler;
function textWidth(text, size) {
  try {
    ruler ||= document.createElement('canvas').getContext('2d');
    ruler.font = `500 ${size}px ${getComputedStyle(document.documentElement).getPropertyValue('--sans') || 'sans-serif'}`;
    return ruler.measureText(text).width;
  } catch { return text.length * size * 0.56; }
}

/**
 * Names beside their dots: each name takes the first free place right or left of its dot, moving a
 * line up or down (with a leader line) when that place is taken by another name or dot.
 */
function placeNames(points, area, size) {
  const taken = points.map(p => ({ x0: p.cx - p.r, y0: p.cy - p.r, x1: p.cx + p.r, y1: p.cy + p.r, owner: p }));
  const clash = (b, self) => taken.some(o => o.owner !== self && b.x0 < o.x1 && o.x0 < b.x1 && b.y0 < o.y1 && o.y0 < b.y1);
  const fits = b => b.x0 >= area.x0 && b.x1 <= area.x1 && b.y0 >= area.y0 && b.y1 <= area.y1;
  const h = size + 3;
  for (const p of [...points].sort((a, b) => a.cy - b.cy || a.cx - b.cx)) {
    const w = textWidth(p.name, size);
    let pick = null;
    for (const dy of [0, -h, h, -2 * h, 2 * h, -3 * h, 3 * h]) {
      for (const side of [1, -1]) {
        const x = side > 0 ? p.cx + p.r + 5 : p.cx - p.r - 5 - w;
        const b = { x0: x - 2, y0: p.cy + dy - h / 2, x1: x + w + 2, y1: p.cy + dy + h / 2, owner: p };
        if (fits(b) && !clash(b, p)) { pick = { x, y: p.cy + dy, side, dy, w, b }; break; }
      }
      if (pick) break;
    }
    pick ||= { x: p.cx + p.r + 5, y: p.cy, side: 1, dy: 0, w, b: null };
    if (pick.b) taken.push(pick.b);
    p.name_at = pick;
  }
}

/**
 * One dot per work. Right: more of the loop found in its papers and code (read mode). Up: its runs get
 * worse when that part is cut (run mode: in how many more pairs the blind judge preferred the intact run).
 * Drawn at the width it is shown at (at least 540 units, scrolling sideways on phones), so names keep
 * their size; the x axis starts at the fewest found among the works shown.
 */
function scatterSvg({ kind, xLabel, points: given, width }) {
  const points = given.map(p => ({ ...p }));
  const size = 13, W = width, H = width < 760 ? 360 : 400, L = 74, R = 12, T = 16, B = 52;
  const yMin = -0.25, yMax = 1.05, x0 = Math.min(...points.map(p => p.x));
  const step = (W - L - R - 40 - 150) / Math.max(1, 5 - x0);
  const X = v => L + 40 + (v - x0) * step;
  const Y = v => T + ((yMax - v) / (yMax - yMin)) * (H - T - B);
  for (const p of points) { p.r = 5 + Math.sqrt(p.tests) * 1.6; p.cx = X(p.x); p.cy = Y(p.y); }
  // works on the same spot sit side by side
  const columns = new Map();
  for (const p of points) columns.set(p.x, [...(columns.get(p.x) || []), p]);
  for (const list of columns.values()) {
    list.sort((a, b) => a.cy - b.cy);
    for (let i = 0; i < list.length;) {
      let j = i + 1;
      while (j < list.length && list[j].cy - list[j - 1].cy < list[j].r + list[j - 1].r) j++;
      const group = list.slice(i, j), gap = 2 * Math.max(...group.map(p => p.r)) + 2;
      group.forEach((p, k) => { p.cx += (k - (group.length - 1) / 2) * gap; });
      i = j;
    }
  }
  placeNames(points, { x0: L + 2, y0: T - 8, x1: W - R, y1: H - B + 2 }, size);
  const ticks = [];
  for (let v = x0; v <= 5; v++) ticks.push(v);
  const f = v => v.toFixed(1);
  const grid = ticks.map(v => `<line class="hx-grid" x1="${f(X(v))}" x2="${f(X(v))}" y1="${T}" y2="${H - B}"/><text class="hx-tick" x="${f(X(v))}" y="${H - B + 18}" text-anchor="middle">${v}</text>`).join('')
    + [0, 0.5, 1].map(v => `<line class="hx-grid${v === 0 ? ' is-zero' : ''}" x1="${L}" x2="${W - R}" y1="${f(Y(v))}" y2="${f(Y(v))}"/><text class="hx-tick" x="${L - 8}" y="${f(Y(v) + 4)}" text-anchor="end">${v === 0 ? 'no change' : `+${v * 100}%`}</text>`).join('');
  const dots = points.map(p => {
    const n = p.name_at;
    const lead = n.dy ? `<line class="hx-lead" x1="${f(p.cx + n.side * p.r * 0.8)}" y1="${f(p.cy + Math.sign(n.dy) * p.r * 0.5)}" x2="${f(n.side > 0 ? n.x - 2 : n.x + n.w + 2)}" y2="${f(n.y)}"/>` : '';
    const tip = `${p.name}: ${p.x} of 5 found in read mode. Over ${p.tests} ${p.tests === 1 ? 'test' : 'tests'}, the judge preferred the intact run in ${Math.round(p.y * 100)}% more pairs than the cut run.`;
    return `<g class="hx-pt" data-case="${esc(p.id)}" tabindex="0" role="button" aria-label="${esc(tip)}"><title>${esc(tip)}</title>${lead}<circle class="hx-dot hx-dot--${p.domain}" cx="${f(p.cx)}" cy="${f(p.cy)}" r="${f(p.r)}"/><text class="hx-pt-name" x="${f(n.x)}" y="${f(n.y + size * 0.36)}">${esc(p.name)}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="One dot per work, by how much of the loop read mode finds (right) and how much worse its runs get when that part is cut (up).">
      <defs><radialGradient id="hx-adv-${kind}" cx="1" cy="0" r="0.75"><stop offset="0" stop-color="#6b5a8e" stop-opacity=".13"/><stop offset="1" stop-color="#6b5a8e" stop-opacity="0"/></radialGradient></defs>
      <rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="url(#hx-adv-${kind})"/>
      ${grid}${dots}
      <text class="hx-axis" x="${f((L + W - R) / 2)}" y="${H - 8}" text-anchor="middle">${esc(xLabel)} →</text>
      <text class="hx-axis" transform="translate(16 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">Worse when cut →</text>
    </svg>`;
}

let quads = {};
function quadrants(paper, codebase) {
  const run = codebase.run;
  // a run case is one of the 40 works of Table 22, found by its cite key
  const found = (work, kind) => Math.max(...paper.rows.filter(r => r.key === codebase.works[work]).map(r => kind === 'steps'
    ? Object.values(r.chain).filter(Boolean).length
    : Object.values(r.cells).filter(m => m === '●').length));
  const points = kind => run.cases.map(c => [c, c.tests.filter(t => isStepTest(t) === (kind === 'steps'))])
    .filter(([, tests]) => tests.length)
    .map(([c, tests]) => ({ id: c.id, name: c.name, domain: c.domain, x: found(c.id, kind), y: tests.reduce((a, t) => a + net(t), 0) / tests.length, tests: tests.length }))
    .filter(p => Number.isFinite(p.x));
  quads = {
    channels: { kind: 'channels', xLabel: 'Channels found in read mode (of 5)', points: points('channels') },
    steps: { kind: 'steps', xLabel: 'Evidence steps found in read mode (of 5)', points: points('steps') }
  };
  const figure = (kind, title, note) => `<figure class="hx-chart hx-quad"><figcaption>${title} <small>${note}</small></figcaption><div class="hx-quad-scroll" data-quad="${kind}"></div></figure>`;
  return `<p class="hx-quad-lede">One dot per work. Further right, read mode finds more of the loop in its papers and code. Higher up, its runs get worse when that part is cut. <mark class="hl">Top right is the most advanced.</mark></p>
  <div class="hx-quads">
    ${figure('channels', 'Coupling channels', `${quads.channels.points.length} works, channel cuts`)}
    ${figure('steps', 'Self-evolution', `${quads.steps.points.length} works, evidence-step cuts`)}
  </div>
  <p class="hx-key"><span><i class="hx-dot-key hx-dot--wearable"></i>wearable</span><span><i class="hx-dot-key hx-dot--physical"></i>physical</span><span><i class="hx-dot-key hx-dot--digital"></i>digital</span><span>larger dot: more tests</span><span>select a work for its tests</span></p>`;
}

/** Draw the run charts at the width they get, again when it changes (the run tab starts hidden). */
function drawQuads(root) {
  const drawn = new WeakMap();
  const draw = el => {
    const w = Math.round(el.clientWidth);
    if (!w || Math.abs((drawn.get(el) || 0) - w) < 24) return;
    drawn.set(el, w);
    el.innerHTML = scatterSvg({ ...quads[el.dataset.quad], width: Math.max(540, w) });
  };
  const els = root.querySelectorAll('[data-quad]');
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(entries => entries.forEach(e => draw(e.target)));
    els.forEach(el => ro.observe(el));
  } else {
    els.forEach(el => { el.innerHTML = scatterSvg({ ...quads[el.dataset.quad], width: 1100 }); });
  }
}

function splitBar(t) {
  return `<span class="hx-split" role="img" aria-label="original preferred ${t.original}, tie ${t.tie}, cut preferred ${t.cut_wins} of ${t.pairs}"><i class="is-orig" style="width:${pct(t.original, t.pairs)}"></i><i class="is-tie" style="width:${pct(t.tie, t.pairs)}"></i><i class="is-cut" style="width:${pct(t.cut_wins, t.pairs)}"></i></span>`;
}

function casesHtml(run) {
  return `<div class="hx-cases">${DOMAINS.flatMap(([d]) => run.cases.filter(c => c.domain === d)).map(c => `<button type="button" class="hx-case" data-case="${esc(c.id)}">
      <span class="hx-case-head"><b>${esc(c.name)}</b><small>${esc(DOMAIN[c.domain] || c.domain)} · ${c.tests.length} ${c.tests.length === 1 ? 'test' : 'tests'}</small></span>
      ${c.tests.map(t => `<span class="hx-t"><em>${t.cut.map(cutName).join(' + ')}</em>${splitBar(t)}</span>`).join('')}
    </button>`).join('')}</div>
    <p class="hx-legend"><span><i class="hx-sw is-orig"></i>judge preferred the original run</span><span><i class="hx-sw is-tie"></i>tie</span><span><i class="hx-sw is-cut"></i>preferred the run with the cut</span></p>`;
}

// ---------- sheets ----------

function caseSheet(id) {
  const run = results?.codebase.run;
  const c = run?.cases.find(x => x.id === id);
  if (!c) return '<div class="sheet-body"><!--back--><p>Not found.</p></div>';
  const metric = name => esc(name.replace(/_/g, ' '));
  const num = v => (Number.isInteger(v) ? v : v.toFixed(2));
  return `<div class="sheet-body hx-sheet"><!--back-->
    <p class="sheet-kicker">HALO run mode · ${esc(DOMAIN[c.domain] || c.domain)}</p>
    <h3 id="sheet-title">${esc(c.name)}</h3>
    <p class="hx-meta">${c.items ? `${c.items} inputs × ${c.samples} samples. ` : ''}Backbone ${esc(run.backbone)}, blind judge ${esc(run.judge)}.${c.report ? ` <a href="${esc(c.report)}" target="_blank" rel="noopener">Paper ↗</a>` : ''}${c.code ? ` <a href="${esc(c.code)}" target="_blank" rel="noopener">Code ↗</a>` : ''}</p>
    ${c.tests.map(t => `<section class="hx-test">
      <h4>Cut ${t.cut.map(cutName).join(' + ')} <span>${t.original} · ${t.tie} · ${t.cut_wins} of ${t.pairs}</span></h4>
      ${splitBar(t)}
      ${t.cut.map(k => c.sites[k.replace('->', '→')] || c.sites[k] ? `<p class="hx-site"><b>${esc(cutName(k))}</b> ${esc(c.sites[k.replace('->', '→')] || c.sites[k])}</p>` : '').join('')}
      ${Object.keys(t.metrics).length ? `<table class="hx-metrics"><thead><tr><th>Measure</th><th>Original</th><th>Cut</th></tr></thead><tbody>${Object.entries(t.metrics).map(([k, [a, b]]) => `<tr class="${a !== b ? 'is-diff' : ''}"><td>${metric(k)}</td><td>${num(a)}</td><td>${num(b)}</td></tr>`).join('')}</tbody></table>` : ''}
    </section>`).join('')}
  </div>`;
}

// ---------- mount ----------

export function mountHalo(root) {
  if (!root) return;
  root.innerHTML = '<p class="panel-muted">Loading HALO’s results…</p>';
  registerView('halo-case', caseSheet);
  const start = () => load().then(d => {
    results = d;
    render(root, d);
  }).catch(error => {
    root.innerHTML = '<p class="panel-muted">HALO’s results could not be loaded. Serve the site over http to see them.</p>';
    console.error(error);
  });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: '800px' });
    io.observe(root);
  } else start();
}

// One plain sentence on what the read table shows, with the counts and the source in a small line under it.
function takeawayHtml(paper) {
  const { works, reported: r, stated } = paper.counts;
  const both = r['S→M'] === r['M→A'] ? `${r['S→M']} of ${works} each` : `${r['S→M']} and ${r['M→A']} of ${works}`;
  return `<p class="takeaway"><b>What the table shows.</b> Most systems let what they observe update memory and let memory guide action (${both}). Fewer let memory decide what to observe (${r['M→S']}) or bring outcomes back into memory (${r['A→M']}), and only ${stated.later_use} state that a revision was used later.
    <span class="takeaway-src">${Object.entries(r).map(([k, v]) => `${esc(k)} ${v}`).join(' · ')} of ${works} reported · ${esc(paper.source || 'Paper §7.1')}, working draft of November 2026</span></p>`;
}

function render(root, d) {
  const { paper, codebase } = d;
  const run = codebase.run;
  root.innerHTML = `
    <div class="hx-tabs seg" role="tablist" aria-label="HALO modes">
      <button type="button" role="tab" aria-selected="true" data-mode="read">Read mode <small>${paper.counts.works} works</small></button>
      <button type="button" role="tab" aria-selected="false" data-mode="run">Run mode <small>${run.cases.length} works</small></button>
    </div>
    <section class="hx-panel" data-panel="read">
      <p class="hx-intro">Three oversight agents, GPT-6-Astra, Claude Opus 5.5, and Claude Fable 5.1, read each work’s paper or blog and its released code. A majority vote of the three decides each cell. Select a work for its details.</p>
      <div class="hx-summary">${channelChart(paper)}${chainChart(paper)}</div>
      ${takeawayHtml(paper)}
      ${matrixHtml(paper)}
    </section>
    <section class="hx-panel" data-panel="run" hidden>
      <p class="hx-intro">A work’s own code runs on fixed inputs, once as released and once with a channel or step cut. A blind judge compares the two runs. Select a work for its measures.</p>
      ${quadrants(paper, codebase)}
      ${casesHtml(run)}
    </section>`;
  drawQuads(root);
  const hideTip = mountTips(root, d);
  root.addEventListener('click', event => {
    const tab = event.target.closest('[data-mode]');
    if (tab) {
      hideTip();
      root.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-selected', String(b === tab)));
      root.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== tab.dataset.mode; });
      return;
    }
    const kase = event.target.closest('[data-case]');
    if (kase) { openSheet({ type: 'halo-case', id: kase.dataset.case }, kase); return; }
    const work = event.target.closest('[data-open-work]');
    if (work) openSheet({ type: 'work', id: work.dataset.openWork }, work);
  });
  // the dots in the run charts are SVG groups: Enter or Space opens them too
  root.addEventListener('keydown', event => {
    const pt = event.target.closest?.('.hx-pt[data-case]');
    if (!pt || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    openSheet({ type: 'halo-case', id: pt.dataset.case }, pt);
  });
}
