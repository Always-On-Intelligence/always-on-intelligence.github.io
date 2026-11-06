// A work's loop, drawn in the framework's own figure: the three modules where §2 places them and the
// coupling channels between them (the geometry is site/framework.mjs). A work's sheet shows it, so
// the mechanisms of different works read side by side.
// - The 40 systems of HALO's channel audit (Table 22) show each channel's mark and the line that
//   explains it (site/data/halo-lines.json), so a missing channel says why it is missing and where the
//   audit looked (site/data/halo-evidence.json).
// - Other systems and methods show the module classes and the channels that the paper's tables
//   report. The other channels stay faint, because no one checked them.
// - Benchmarks show the channels, modules and conditions their score depends on (the Framework column
//   of Tables 8, 13 and 18).
import { channelGeometry, headPath } from './framework.mjs';
import { channels as CHANNELS, conditions as CONDITIONS } from './data/framework.mjs';
import { esc } from './systems.mjs';

// the framework figure's layout, with taller boxes so each module can name the work's own parts
const VB = { w: 780, h: 480 };
const RECTS = {
  M: { x: 265, y: 4, w: 250, h: 150 },
  S: { x: 14, y: 326, w: 256, h: 150 },
  A: { x: 510, y: 326, w: 256, h: 150 }
};
const NAME = { S: 'Sensing', M: 'Memory', A: 'Action' };
const SPACE = { 'tab:sensing-methods': 'S', 'tab:memory-methods': 'M', 'tab:action-methods': 'A' };
const POLICY = { 'tab:sensing-policy': 'S', 'tab:memory-policy': 'M', 'tab:action-policy': 'A' };
// the two columns of each coupling table that say what the channel carries and how it is used
const COUPLING = {
  'tab:sensing-loop-coverage': ['7', 'Guidance supplied', 'Use in Sensing'],
  'tab:memory-loop-coverage': ['12', 'Supplied information', 'Update supported'],
  'tab:action-loop-coverage': ['17', 'Supplied information', 'Use in Action']
};
const BENCH = { 'tab:sensing-benchmarks': '8', 'tab:memory-benchmarks': '13', 'tab:action-benchmarks': '18' };
const MARK = { '●': 'yes', '◐': 'na', '○': 'no' };
const FALLBACK = {
  '●': 'Reported in the work’s paper or released code.',
  '◐': 'Not specified clearly enough in the paper or code to decide.',
  '○': 'The source states that this flow is absent.'
};
// condition abbreviations of the Framework columns (priv., auth., saf., res., avail., unc.)
const CONDITION = Object.fromEntries(CONDITIONS.map(c => [c.id.slice(0, 3), c.name.toLowerCase()]));
const arrow = id => `${id[0]}→${id[1]}`;
const pct = (value, total) => `${(value / total * 100).toFixed(3)}%`;
const touches = (id, mod) => id.includes(mod);

const json = name => fetch(new URL(`./data/${name}`, import.meta.url)).then(r => {
  if (!r.ok) throw new Error(`${name}: ${r.status}`);
  return r.json();
});
let loading = null;
export function loadLoops() {
  loading ||= Promise.all([json('halo-read.json'), json('halo-lines.json'), json('halo-evidence.json')])
    .then(([read, lines, evidence]) => ({ read, lines, evidence }));
  return loading;
}

/** Parse a Framework cell such as "S→A, c_t: auth., res., ∉R" into the parts of the figure it names. */
export function frameworkParts(text) {
  const out = { channels: new Set(), modules: new Set(), conditions: [], outside: false, retained: false, revision: false };
  const condition = abbr => {
    const name = CONDITION[abbr.trim().slice(0, 3)];
    if (name && !out.conditions.includes(name)) out.conditions.push(name);
  };
  for (const raw of String(text || '').split(/[,;]/)) {
    const t = raw.trim();
    let m;
    if ((m = t.match(/^([SMA])→([SMA])$/))) out.channels.add(m[1] + m[2]);
    else if ((m = t.match(/^π_([SMA])$/) || t.match(/^([SMA]) space$/))) out.modules.add(m[1]);
    else if (t === 'θ_t') out.revision = true;
    else if (t === '∉R') out.outside = true;
    else if (t === 'B') out.retained = true;
    else if (t.startsWith('c_t')) condition(t.split(':')[1] || '');
    else condition(t);
  }
  return out;
}

function auditRow(work, read) {
  if (!read || !work.audit) return null;
  const listed = work.placements.find(p => p.table === 'tab:channel-evidence')?.cells.System?.replace(/†/g, '').trim();
  return read.rows.find(r => r.key === work.key) || read.rows.find(r => r.name === listed) || null;
}

/**
 * What the figure shows for one work of site/data/works.json, or null when the paper's tables say
 * nothing about its loop (surveys, and systems placed only by level).
 */
export function loopModel(work, data = {}) {
  if (!work) return null;
  const { read, lines, evidence } = data;
  const modules = Object.fromEntries(['S', 'M', 'A'].map(id => [id, { id, state: 'off', space: [], policy: [], input: '' }]));
  for (const p of work.placements) {
    if (SPACE[p.table]) modules[SPACE[p.table]].space.push({ cls: p.group, feature: p.cells['Key feature'] });
    if (POLICY[p.table]) modules[POLICY[p.table]].policy.push(p.cells.Decision || p.cells.Policy || p.group);
    // the device the work senses through (Input of Tables 4 and 9) and acts through (Interface of Table 14)
    if (p.table === 'tab:sensing-methods' || p.table === 'tab:memory-methods') modules.S.input ||= p.cells.Input;
    if (p.table === 'tab:action-methods') modules.A.input ||= p.cells.Interface;
  }
  const described = Object.values(modules).some(m => m.space.length || m.policy.length);

  const row = auditRow(work, read);
  if (row) {
    const own = lines?.[row.id] || {};
    const checked = evidence?.[row.id]?.cells || {};
    const channels = CHANNELS.map(ch => {
      if (ch.id === 'SA') return { id: ch.id, to: ch.to, state: 'basic' };
      const mark = row.cells[arrow(ch.id)] || '◐';
      const where = checked[arrow(ch.id)] || {};
      return { id: ch.id, to: ch.to, state: MARK[mark] || 'na', mark, text: own[arrow(ch.id)] || FALLBACK[mark], where: where.where || '', url: where.url || '' };
    });
    for (const m of Object.values(modules)) m.state = 'on';
    // Memory has no channel of the basic path, so when the source rules out all four, it has no Memory
    if (channels.filter(c => touches(c.id, 'M')).every(c => c.state === 'no')) modules.M.state = 'absent';
    return { kind: 'audit', name: row.name, summary: own.work || evidence?.[row.id]?.summary || work.application?.mechanism || '', modules, channels };
  }

  const fw = frameworkParts(work.application?.framework);
  const coupled = new Map();
  for (const p of work.placements) {
    const cols = COUPLING[p.table];
    const m = cols && String(p.group || '').match(/^([SMA])→([SMA])/);
    if (m && !coupled.has(m[1] + m[2])) {
      coupled.set(m[1] + m[2], { table: cols[0], text: `${cols[1]}: ${p.cells[cols[1]]}. ${cols[2]}: ${p.cells[cols[2]]}.` });
    }
  }
  if (described || coupled.size || fw.channels.size || fw.modules.size) {
    const system = Boolean(work.application || work.level);
    const channels = CHANNELS.map(ch => {
      const found = coupled.get(ch.id);
      if (found) return { id: ch.id, to: ch.to, state: 'yes', text: found.text, table: found.table };
      if (fw.channels.has(ch.id)) return { id: ch.id, to: ch.to, state: 'yes', text: 'Table 19 places its key method on this channel.', table: '19' };
      if (ch.id === 'SA' && system) return { id: ch.id, to: ch.to, state: 'basic' };
      return { id: ch.id, to: ch.to, state: 'off' };
    });
    for (const m of Object.values(modules)) {
      const used = channels.some(c => c.state === 'yes' && touches(c.id, m.id));
      if (m.space.length || m.policy.length || fw.modules.has(m.id) || used) m.state = 'on';
    }
    return { kind: 'tables', summary: work.application?.mechanism || '', modules, channels };
  }

  const bench = work.placements.filter(p => BENCH[p.table] && p.cells.Framework);
  if (bench.length) {
    const parts = bench.map(p => frameworkParts(p.cells.Framework));
    const has = (key, id) => parts.some(x => x[key].has(id));
    const channels = CHANNELS.map(ch => ({ id: ch.id, to: ch.to, state: has('channels', ch.id) ? 'scored' : 'off' }));
    for (const m of Object.values(modules)) m.state = has('modules', m.id) ? 'scored' : 'plain';
    const scored = [...new Set(parts.flatMap(x => x.conditions))];
    return {
      kind: 'bench',
      tables: [...new Set(bench.map(p => BENCH[p.table]))],
      summary: '',
      modules,
      channels,
      extra: [
        scored.length ? `The shared conditions it scores: ${scored.join(', ')}.` : '',
        parts.some(x => x.outside) ? 'It scores decisions at steps where no request is being carried out.' : '',
        parts.some(x => x.retained) ? 'It scores state that is kept when an interaction ends and is used later.' : '',
        parts.some(x => x.revision) ? 'It scores a revision of the mechanism.' : ''
      ].filter(Boolean)
    };
  }
  return null;
}

// ---------- drawing ----------

function channelSvg(c) {
  const g = channelGeometry(CHANNELS.find(ch => ch.id === c.id), RECTS);
  const end = { x: g.end.x - g.d.x * 8, y: g.end.y - g.d.y * 8 };
  const d = `M${g.start.x.toFixed(1)},${g.start.y.toFixed(1)} L${end.x.toFixed(1)},${end.y.toFixed(1)}`;
  return `<g class="lc-ch" data-lc-ch="${c.id}" data-state="${c.state}" data-to="${c.to}">
    <path class="lc-hit" d="${d}"/><path class="lc-line" d="${d}"/><path class="lc-tip" d="${headPath(g.end, g.d, 13, 6.8)}"/>
  </g>`;
}

function pillHtml(c, audit) {
  if (c.state === 'off') return '';
  const g = channelGeometry(CHANNELS.find(ch => ch.id === c.id), RECTS);
  const mark = audit && c.mark ? `<i>${c.mark}</i>` : '';
  return `<span class="lc-pill" data-lc-ch="${c.id}" data-state="${c.state}" data-to="${c.to}" style="left:${pct(g.label.x, VB.w)};top:${pct(g.label.y, VB.h)}">${arrow(c.id)}${mark}</span>`;
}

function nodeHtml(m) {
  const r = RECTS[m.id];
  const rows = [];
  const space = m.space[0];
  if (space) rows.push(`<span class="lc-row"><em>Space</em> ${esc(space.cls)}</span>`, space.feature ? `<span class="lc-feat" title="${esc(space.feature)}">${esc(space.feature)}</span>` : '');
  if (m.policy.length) rows.push(`<span class="lc-row"><em>Policy</em> ${esc([...new Set(m.policy)].join(', '))}</span>`);
  if (m.input && m.state !== 'off') rows.push(`<span class="lc-row lc-row--io"><em>${m.id === 'A' ? 'Interface' : 'Input'}</em> ${esc(m.input)}</span>`);
  if (m.state === 'absent') rows.push('<span class="lc-row lc-row--absent">Every Memory channel is stated as absent</span>');
  return `<div class="lc-node lc-node--${m.id}" data-state="${m.state}" style="left:${pct(r.x, VB.w)};top:${pct(r.y, VB.h)};width:${pct(r.w, VB.w)};height:${pct(r.h, VB.h)}">
    <b>${NAME[m.id]}</b>${rows.join('')}
  </div>`;
}

function itemHtml(c, audit) {
  const id = `<span class="lc-id" data-state="${c.state}" data-to="${c.to}">${arrow(c.id)}${audit && c.mark ? ` <i>${c.mark}</i>` : ''}</span>`;
  const where = c.where ? `<span class="lc-where">${c.state === 'yes' ? 'In the paper' : 'Checked in'}: ${esc(c.where)}${c.url ? ` <a href="${esc(c.url)}" target="_blank" rel="noopener">↗</a>` : ''}</span>` : '';
  const table = !audit && c.table ? ` <span class="lc-table">Table ${esc(c.table)}</span>` : '';
  return `<li data-lc-ch="${c.id}" data-state="${c.state}">${id}<span class="lc-text">${esc(c.text)}${table}${where}</span></li>`;
}

const LEGEND = {
  audit: [['yes', 'reported', '●'], ['na', 'not reported clearly enough to decide', '◐'], ['no', 'stated as absent', '○'], ['basic', 'basic path', '']],
  tables: [['yes', 'in the paper’s tables', ''], ['basic', 'basic path', ''], ['off', 'not checked', '']],
  bench: [['scored', 'scored', ''], ['off', 'not scored', '']]
};

function legendHtml(kind) {
  return `<p class="lc-legend">${LEGEND[kind].map(([state, label, mark]) => `<span data-state="${state}"><svg viewBox="0 0 26 8" aria-hidden="true"><path d="M1,4 H25"/></svg>${mark ? `${mark} ` : ''}${label}</span>`).join('')}</p>`;
}

/** The loop block of a work's sheet: the figure, its legend and what each channel carries. */
export function loopHtml(work, data) {
  const model = loopModel(work, data);
  if (!model) return '';
  const audit = model.kind === 'audit';
  const head = {
    audit: ['Framework', 'HALO channel audit, Table 22'],
    tables: ['Framework', 'From the paper’s tables'],
    bench: ['What its score depends on', `Framework column of Table ${model.tables?.join(' and ')}`]
  }[model.kind];
  const figure = `<div class="lc-fig">
    <svg class="lc-svg" viewBox="0 0 ${VB.w} ${VB.h}" aria-hidden="true" focusable="false">${model.channels.map(channelSvg).join('')}</svg>
    ${Object.values(model.modules).map(nodeHtml).join('')}
    ${model.channels.map(c => pillHtml(c, audit)).join('')}
  </div>`;

  let notes = '';
  if (audit) {
    const missing = model.channels.filter(c => c.state === 'na' || c.state === 'no');
    const reported = model.channels.filter(c => c.state === 'yes');
    notes = `${missing.length
      ? `<p class="lc-group lc-group--missing">Missing, and why</p><ul class="lc-list">${missing.map(c => itemHtml(c, true)).join('')}</ul>`
      : '<p class="lc-group">Every audited channel is reported.</p>'}
      ${reported.length ? `<p class="lc-group">Reported</p><ul class="lc-list">${reported.map(c => itemHtml(c, true)).join('')}</ul>` : ''}
      <p class="lc-note">S→A, from Sensing straight to Action, is the basic path that every system has, so the audit does not mark it.</p>`;
  } else if (model.kind === 'tables') {
    const reported = model.channels.filter(c => c.state === 'yes');
    notes = `${reported.length ? `<ul class="lc-list">${reported.map(c => itemHtml(c, false)).join('')}</ul>` : ''}
      <p class="lc-note">Faint channels were not checked. Only the 40 systems of HALO’s channel audit (Table 22) are checked channel by channel, so this figure does not say which channels the work lacks.</p>`;
  } else {
    const scored = model.channels.filter(c => c.state === 'scored').map(c => arrow(c.id));
    notes = `<p class="lc-note">${scored.length ? `Its score depends on ${scored.join(', ')}. ` : 'Its score depends on no coupling channel. '}${model.extra.join(' ')}</p>`;
  }
  return `<section class="lc" data-kind="${model.kind}" aria-label="${esc(head[0])}">
    <p class="lc-head"><b>${head[0]}</b><span>${esc(head[1])}</span></p>
    ${model.summary ? `<p class="lc-summary">${esc(model.summary)}</p>` : ''}
    ${model.kind === 'bench' ? '' : `<p class="lc-lens">Drawn in the survey’s framework of Sensing, Memory, Action and the channels between them, not the authors’ own architecture.${audit ? ' A channel counts as missing when the paper or code does not report it, or states that it is absent.' : ''}</p>`}
    <div class="lc-body">
      <div class="lc-figwrap">${figure}${legendHtml(model.kind)}</div>
      <div class="lc-notes">${notes}</div>
    </div>
  </section>`;
}

/** Hovering or focusing a channel, in the figure or in the list, picks it out in both. */
export function mountLoopLinks() {
  if (mountLoopLinks.done) return;
  mountLoopLinks.done = true;
  const mark = (event, on) => {
    const t = event.target.closest?.('[data-lc-ch]');
    const card = t?.closest('.lc');
    if (!card) return;
    card.classList.toggle('is-hl', on);
    for (const el of card.querySelectorAll('[data-lc-ch]')) el.classList.toggle('is-hl', on && el.dataset.lcCh === t.dataset.lcCh);
  };
  document.addEventListener('pointerover', event => mark(event, true));
  document.addEventListener('pointerout', event => mark(event, false));
  document.addEventListener('focusin', event => mark(event, true));
  document.addEventListener('focusout', event => mark(event, false));
}
