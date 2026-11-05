// Index of reviewed works, exported from every citing table of the paper.
// Search and filters run in the page; a work opens the shared glass sheet.
import { esc, notation, loadData } from './systems.mjs';
import { openSheet, registerView } from './sheet.mjs';
import { loadLoops, loopHtml } from './loopcard.mjs';

const MODULES = ['Sensing', 'Memory', 'Action', 'Systems', 'HALO'];
const CHANNELS = ['S→M', 'M→S', 'M→A', 'A→M', 'A→S'];
const LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];
let worksCache = null;

export function loadWorks() {
  if (!worksCache) {
    worksCache = fetch(new URL('./data/works.json', import.meta.url)).then(r => {
      if (!r.ok) throw new Error(`works.json: ${r.status}`);
      return r.json();
    });
  }
  return worksCache;
}

const normalize = s => String(s ?? '').normalize('NFKC').toLowerCase();

export function filterWorks(works, { query = '', module = '', channel = '', level = '', sort = 'year' } = {}) {
  const q = normalize(query).trim();
  const out = works.filter(w => {
    if (module && !w.modules.includes(module) && !(module === 'HALO' && w.audit)) return false;
    if (channel && !w.channels.includes(channel)) return false;
    if (level && w.level !== level) return false;
    if (!q) return true;
    const hay = normalize([w.names.join(' '), w.title, w.authors, w.venue, w.year, w.key,
      ...w.placements.map(p => `${p.group} ${Object.values(p.cells).join(' ')}`)].join(' '));
    return q.split(/\s+/).every(t => hay.includes(t));
  });
  const name = w => normalize(w.names[0] || w.title);
  return out.sort(sort === 'name'
    ? (a, b) => name(a).localeCompare(name(b))
    : (a, b) => (b.year || 0) - (a.year || 0) || name(a).localeCompare(name(b)));
}

function tagList(w, product) {
  const kind = product ? '<span class="wtag wtag--product">Product</span>' : '';
  const mods = w.modules.map(m => `<span class="wtag wtag--${m.toLowerCase()}">${m}</span>`).join('');
  const chs = w.channels.map(c => `<span class="wtag wtag--ch">${c}</span>`).join('');
  const lvl = w.level ? `<span class="wtag wtag--level">${w.level}</span>` : '';
  return kind + mods + chs + lvl;
}

function rowHtml(w, product = false) {
  const name = w.names[0] || w.title;
  return `<button type="button" class="work-row${product ? ' is-product' : ''}" data-paperwork="${esc(w.key)}">
    <span class="work-year">${esc(w.year || '')}</span>
    <span class="work-main"><span class="work-row-name">${esc(name)}${product ? '<sup class="sys-dag" title="Product">†</sup>' : ''}</span><span class="work-row-title">${esc(w.title || '')}</span></span>
    <span class="work-tags">${tagList(w, product)}</span>
  </button>`;
}

// URL and Source columns hold "paper link / code link"; show them as links.
const LINK_COLUMNS = new Set(['URL', 'Source']);
function cellHtml(column, value) {
  if (!LINK_COLUMNS.has(column)) return notation(value);
  const urls = String(value).split(' / ').map(part => part.trim()).filter(part => /^https?:\/\//.test(part));
  if (!urls.length) return notation(value);
  return urls.map(url => `<a href="${esc(url)}" target="_blank" rel="noopener">${/github\.com/.test(url) ? 'Code' : 'Source'} ↗</a>`).join(' · ');
}

export function workSheetHtml(w, tables, loops) {
  const byLabel = Object.fromEntries(tables.map(t => [t.label, t]));
  const groups = new Map();
  for (const p of w.placements) {
    if (!groups.has(p.table)) groups.set(p.table, []);
    groups.get(p.table).push(p);
  }
  const placements = [...groups.entries()].map(([label, list]) => {
    const t = byLabel[label] || {};
    return `<div class="placement">
      <p class="placement-head"><span class="wtag wtag--${String(t.module || '').toLowerCase()}">${esc(t.module || '')}</span><span>${esc(t.kind || '')}</span></p>
      <p class="placement-caption">${esc(t.caption || label)}</p>
      ${list.map(p => `<dl class="placement-cells">${p.group ? `<div><dt>Group</dt><dd>${esc(p.group)}</dd></div>` : ''}${Object.entries(p.cells).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${cellHtml(k, v)}</dd></div>`).join('')}</dl>`).join('')}
    </div>`;
  }).join('');
  return `<div class="sheet-body sheet-body--detail">
    <!--back-->
    <p class="detail-kicker">${esc(w.modules.join(' · '))}${w.level ? ` · ${esc(w.level)}` : ''}</p>
    <h3 class="detail-title" id="sheet-title">${esc(w.names[0] || w.title)}</h3>
    <p class="ref">${w.title ? `<span class="ref-title">${esc(w.title)}</span>` : ''}<span class="ref-meta">${[w.authors, w.venue, w.year].filter(Boolean).map(esc).join(' · ')}</span>${w.url ? ` <a href="${esc(w.url)}" target="_blank" rel="noopener">Source ↗</a>` : ''}</p>
    ${w.levelNote ? `<p class="detail-note">§ ${esc(w.levelNote)}</p>` : ''}
    ${loopHtml(w, loops)}
    <p class="detail-sub">Where the paper places it · ${w.placements.length} placement${w.placements.length === 1 ? '' : 's'}</p>
    <div class="placements">${placements}</div>
  </div>`;
}

/** The sheet that lists every table citing a work; registered on any page that links to works. */
export async function registerWorkSheet() {
  const data = await loadWorks();
  const byKey = new Map(data.works.map(w => [w.key, w]));
  // without the audit lines the sheets still draw each loop from the tables
  let loops = null;
  loadLoops().then(d => { loops = d; }).catch(error => console.error(error));
  registerView('paperwork', key => {
    const w = byKey.get(key);
    return w ? workSheetHtml(w, data.tables, loops) : '<div class="sheet-body"><!--back--><p>Not found.</p></div>';
  });
  return data;
}

export async function mountWorks(root) {
  if (!root) return;
  root.innerHTML = '<p class="panel-muted">Loading the index…</p>';
  let data;
  try {
    data = await registerWorkSheet();
  } catch (error) {
    root.innerHTML = '<p class="panel-muted">The index could not be loaded. Serve the site over http to use it.</p>';
    console.error(error);
    return;
  }

  // products as the closure table and HALO's read mode mark them (†)
  let products = new Set();
  try {
    const { levels, read } = await loadData();
    products = new Set([
      ...Object.values(levels.placements).flat().filter(p => /product/i.test(p.kind || '')).map(p => p.key),
      ...read.rows.filter(r => r.product).map(r => r.key)
    ]);
  } catch (error) {
    console.error(error);
  }

  const state = { query: '', module: '', channel: '', level: '', sort: 'year' };
  root.innerHTML = `
    <div class="works-bar">
      <label class="works-search"><span class="sr-only">Search works</span>
        <input type="search" placeholder="Search by name, title, author, or table text" autocomplete="off" data-works-q>
      </label>
      <div class="seg seg--quiet seg--small" role="group" aria-label="Module">
        <button type="button" data-works-module="" aria-pressed="true">All</button>
        ${MODULES.map(m => `<button type="button" data-works-module="${m}" aria-pressed="false">${m}</button>`).join('')}
      </div>
      <div class="works-selects">
        <label>Channel <select data-works-channel><option value="">any</option>${CHANNELS.map(c => `<option>${c}</option>`).join('')}</select></label>
        <label>Level <select data-works-level><option value="">any</option>${LEVELS.map(l => `<option>${l}</option>`).join('')}</select></label>
        <label>Sort <select data-works-sort><option value="year">newest</option><option value="name">name</option></select></label>
      </div>
    </div>
    <p class="works-count" aria-live="polite"></p>
    <div class="works-frame">
      <div class="works-list works-scroll" tabindex="0" aria-label="Reviewed works"></div>
      <div class="works-rail" aria-hidden="true"><span class="works-thumb"><span class="works-pos"></span></span></div>
    </div>`;

  const list = root.querySelector('.works-list');
  const count = root.querySelector('.works-count');
  const rail = root.querySelector('.works-rail');
  const thumb = root.querySelector('.works-thumb');
  const pos = root.querySelector('.works-pos');
  let rows = [];

  // the list scrolls inside its frame; the rail on the right shows where you are and can be dragged
  function sync() {
    const { scrollTop: top, scrollHeight: total, clientHeight: view } = list;
    const track = rail.clientHeight;
    const scrollable = total > view + 1;
    rail.classList.toggle('is-off', !scrollable);
    if (!scrollable) return;
    const h = Math.max(36, Math.round((view / total) * track));
    thumb.style.height = `${h}px`;
    thumb.style.transform = `translateY(${Math.round((top / (total - view)) * (track - h))}px)`;
    const items = list.children;
    let lo = 0, hi = items.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (items[mid].offsetTop + items[mid].offsetHeight <= top + 1) lo = mid + 1; else hi = mid; }
    const w = rows[lo];
    pos.textContent = w ? `${lo + 1} / ${rows.length}${w.year ? ` · ${w.year}` : ''}` : '';
  }
  list.addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync);
  thumb.addEventListener('pointerdown', event => {
    event.preventDefault();
    thumb.setPointerCapture(event.pointerId);
    rail.classList.add('is-dragging');
    const startY = event.clientY, startTop = list.scrollTop;
    const move = e => {
      const span = rail.clientHeight - thumb.offsetHeight;
      list.scrollTop = startTop + ((e.clientY - startY) / Math.max(1, span)) * (list.scrollHeight - list.clientHeight);
    };
    const up = () => { rail.classList.remove('is-dragging'); thumb.removeEventListener('pointermove', move); thumb.removeEventListener('pointerup', up); thumb.removeEventListener('pointercancel', up); };
    thumb.addEventListener('pointermove', move);
    thumb.addEventListener('pointerup', up);
    thumb.addEventListener('pointercancel', up);
  });
  rail.addEventListener('pointerdown', event => {
    if (event.target.closest('.works-thumb')) return;
    const r = rail.getBoundingClientRect();
    const k = (event.clientY - r.top - thumb.offsetHeight / 2) / Math.max(1, r.height - thumb.offsetHeight);
    list.scrollTo({ top: Math.max(0, Math.min(1, k)) * (list.scrollHeight - list.clientHeight), behavior: 'smooth' });
  });

  function render() {
    rows = filterWorks(data.works, state);
    count.textContent = `${rows.length} of ${data.works.length} works`;
    list.innerHTML = rows.map(w => rowHtml(w, products.has(w.key))).join('') || '<p class="panel-muted">No work matches these filters.</p>';
    list.scrollTop = 0;
    requestAnimationFrame(sync);
    root.querySelectorAll('[data-works-module]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.worksModule === state.module)));
  }

  let timer = 0;
  root.querySelector('[data-works-q]').addEventListener('input', event => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.query = event.target.value; render(); }, 120);
  });
  for (const [attr, key] of [['channel', 'channel'], ['level', 'level'], ['sort', 'sort']]) {
    root.querySelector(`[data-works-${attr}]`).addEventListener('change', event => { state[key] = event.target.value; render(); });
  }
  root.addEventListener('click', event => {
    const t = event.target.closest('button');
    if (!t || !root.contains(t)) return;
    if (t.dataset.worksModule !== undefined) { state.module = t.dataset.worksModule; render(); return; }
    if (t.dataset.paperwork) openSheet({ type: 'paperwork', id: t.dataset.paperwork }, t);
  });
  render();
}
