// Shared index of reviewed systems, joined on cite key across the paper's systems table
// (applications, §6.1), the closure table (levels of loop closure, §6.3) and HALO's read mode
// (Table 22 of the paper, §7.1).

const dataUrl = name => new URL(`./data/${name}`, import.meta.url);
let cache = null;

/** The up-right arrow of everything that opens: the paper, outside links, and the domain and level sheets. */
export const arrowNE = '<svg class="ne" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 17 17 7M8.5 7H17v8.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export const esc = value => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function loadData() {
  if (!cache) {
    cache = Promise.all(['applications.json', 'levels.json', 'halo-read.json']
      .map(name => fetch(dataUrl(name)).then(r => {
        if (!r.ok) throw new Error(`${name}: ${r.status}`);
        return r.json();
      })))
      .then(([applications, levels, read]) => ({ applications, levels, read, systems: buildIndex(applications, levels, read) }));
  }
  return cache;
}

export function buildIndex(applications, levels, read) {
  const index = new Map();
  const entry = (key, name, ref) => {
    if (!index.has(key)) index.set(key, { key, name, ref: ref || {}, app: null, level: null, conditional: false, audit: null, audits: [] });
    const item = index.get(key);
    if (!item.ref?.title && ref?.title) item.ref = ref;
    return item;
  };
  for (const group of applications.groups) {
    for (const work of group.works) {
      const item = entry(work.key, work.name, work.ref);
      item.name = work.name;
      item.app = { ...work, section: group.section, sectionTitle: group.title };
    }
  }
  for (const [level, list] of Object.entries(levels.placements)) {
    for (const p of list) {
      const item = entry(p.key, p.name, p.ref);
      if (!item.level || level > item.level) {
        item.level = level;
        item.conditional = Boolean(p.conditional);
      }
    }
  }
  for (const row of read?.rows || []) {
    const item = entry(row.key, row.name, row.ref);
    const audit = { name: row.name, cells: row.cells, chain: row.chain };
    item.audits.push(audit);
    if (!item.audit) item.audit = audit;
  }
  return index;
}

const AUDIT_ORDER = ['S→M', 'M→A', 'A→S', 'M→S', 'A→M'];

/** Render framework notation such as "π_S, M→A; c_t" with subscripts. */
export function notation(text) {
  return esc(text).replace(/([πθc])_([A-Za-z0-9]+)/g, '<i>$1</i><sub>$2</sub>');
}
const MARK_LABEL = { '●': 'reported', '○': 'explicitly absent', '◐': 'insufficient reporting to decide' };
const CHAIN_ORDER = [['record', 'Rec.'], ['outcome', 'Out.'], ['attribution', 'Attr.'], ['revision', 'Rev.'], ['later_use', 'Use']];

export function auditHtml(audit, { chainOnly = false } = {}) {
  if (!audit) return '';
  const chain = audit.chain ? `<div class="audit-row audit-row--chain" aria-label="Chain of evidence">
    ${CHAIN_ORDER.map(([id, short]) => {
      const on = audit.chain[id];
      return `<span class="audit-cell audit-cell--${on ? 'step' : 'na'}" title="${short} ${on ? 'stated in the source' : 'not stated'}"><b>${short}</b><i>${on ? '■' : '·'}</i></span>`;
    }).join('')}
  </div>` : '';
  if (chainOnly) return chain;
  return `<div class="audit-row" aria-label="HALO read mode">
    ${AUDIT_ORDER.map(ch => {
      const mark = audit.cells[ch] ?? '◐';
      return `<span class="audit-cell audit-cell--${mark === '●' ? 'yes' : mark === '○' ? 'no' : 'na'}" title="${ch}: ${MARK_LABEL[mark] || mark}"><b>${ch}</b><i>${mark}</i></span>`;
    }).join('')}
  </div>${chain}`;
}

export function refLine(ref) {
  if (!ref) return '';
  const bits = [ref.all_authors_short, ref.venue, ref.year].filter(Boolean).map(esc);
  const title = ref.title ? `<span class="ref-title">${esc(ref.title)}</span>` : '';
  const link = ref.url ? ` <a href="${esc(ref.url)}" target="_blank" rel="noopener">Source ↗</a>` : '';
  return `<p class="ref">${title}${bits.length ? `<span class="ref-meta">${bits.join(' · ')}</span>` : ''}${link}</p>`;
}

function conditionFor(item, levels) {
  const found = levels?.conditions?.find(c => c.systems.includes(item.name));
  return found ? `Meets L5 only under a stated condition: it ${found.text.replace(/^achieves? /, 'reaches ')}` : 'Meets L5 only under a stated condition.';
}

export function systemDetailHtml(item, { levels, loop = '' } = {}) {
  const app = item.app;
  const level = item.level && levels ? levels.levels.find(l => l.id === item.level) : null;
  return `
    <p class="detail-kicker">${app ? `${esc(app.domains.join(' / '))} · ${esc(app.participants.join(' / '))} · ${esc(app.horizon || 'horizon not stated')}` : 'Reviewed system'}</p>
    <h3 class="detail-title">${esc(item.name)}</h3>
    ${refLine(item.ref)}
    ${app ? `<dl class="detail-facts">
      <div><dt>Key method</dt><dd>${esc(app.mechanism)}</dd></div>
      <div><dt>Bottleneck</dt><dd>${esc(app.bottleneck)}</dd></div>
      <div><dt>Place in the framework</dt><dd class="notation">${notation(app.framework)}</dd></div>
    </dl>` : ''}
    ${level ? `<div class="detail-level"><span class="level-chip">${esc(level.id)}${item.conditional ? '§' : ''}</span><div><b>${esc(level.name)}</b><span>${esc(level.tagline || '')}</span>${item.conditional ? `<span class="detail-cond">§ ${esc(conditionFor(item, levels))}</span>` : ''}</div></div>` : ''}
    ${loop}
    ${item.audits?.length ? `<div class="detail-audit"><p class="detail-sub">${loop ? 'Chain of evidence for self-evolution · HALO read mode' : 'HALO read mode · majority of three agents'}</p>${item.audits.map(a => `${item.audits.length > 1 ? `<p class="detail-variant">${esc(a.name)}</p>` : ''}${auditHtml(a, { chainOnly: Boolean(loop) })}`).join('')}</div>` : ''}
    <p class="detail-note">${[app ? `Applications, §${esc(app.section)}` : '', level ? 'levels of loop closure, §6.3' : '', item.audit ? 'HALO read mode' : ''].filter(Boolean).join(' · ')}</p>`;
}
