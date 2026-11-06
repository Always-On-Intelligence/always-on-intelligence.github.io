// Levels of loop closure (Section 6.3) as one map: levels L0–L5 across, interaction domains down,
// and every system the closure table places, research systems first and products (†) after them.
// A level's name opens its sheet: what it adds, the level checklist, and why systems sit there.
// § marks an L5 placement that holds only under a stated condition.
import { loadData, esc, notation, arrowNE } from './systems.mjs';
import { openSheet, registerView } from './sheet.mjs';

const DOMAIN_ORDER = ['Wearable', 'Digital', 'Physical'];

function without(text, parts) {
  let out = text;
  for (const p of parts) if (p) out = out.replace(p, '');
  return out.split(/\n\n+/).map(par => par.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n');
}

export async function mountLevels(root) {
  if (!root) return;
  root.innerHTML = '<p class="panel-muted">Loading the levels…</p>';
  let data;
  try {
    data = await loadData();
  } catch (error) {
    root.innerHTML = '<p class="panel-muted">The level data could not be loaded. Serve the site over http to use this figure.</p>';
    console.error(error);
    return;
  }
  const { levels } = data;
  const list = levels.levels;
  const CHECKS = [['durability', 'State durability'], ['continuity', 'Operational continuity'], ['attribution', 'Attribution'], ['governed', 'Governed self-evolution']];
  const checklistHtml = l => l.checklist ? `<ul class="level-checks" aria-label="Required at ${esc(l.id)}">${CHECKS.map(([k, label]) => `<li class="${l.checklist[k] ? 'is-yes' : 'is-no'}"><span aria-hidden="true">${l.checklist[k] ? '✓' : '✕'}</span>${label}<span class="sr-only">${l.checklist[k] ? ': required' : ': not required'}</span></li>`).join('')}</ul>` : '';
  const conditionsHtml = l => l.id === 'L5' && levels.conditions?.length ? `<div class="level-conditions"><p class="placed-kind">§ Meets L5 only under a stated condition</p><ul>${levels.conditions.map(c => `<li><b>${esc(c.systems)}</b> ${esc(c.text)}</li>`).join('')}</ul></div>` : '';
  const firstOn = list.findIndex(l => l.checklist?.durability && l.checklist?.continuity);

  // one map of every placement: levels across, domains down, research systems then products in each cell
  const icon = p => p.icon ? `<img class="sys-icon" src="${esc(p.icon)}" alt="" width="16" height="16" loading="lazy" decoding="async">` : '';
  const chip = (p, product) => `<button type="button" class="sys-chip${product ? ' is-product' : ''}${p.icon ? ' has-icon' : ''}" data-open-work="${esc(p.key)}">${icon(p)}${esc(p.name)}${product ? '<sup class="sys-dag" title="Product">†</sup>' : ''}${p.conditional ? '<sup class="sys-cond" title="Meets L5 only under a stated condition">§</sup>' : ''}</button>`;
  const cell = (l, d, row) => {
    const items = (levels.placements[l.id] || []).filter(p => (p.domain || 'Other') === d);
    const research = items.filter(p => !/product/i.test(p.kind || ''));
    const products = items.filter(p => /product/i.test(p.kind || ''));
    const i = list.indexOf(l);
    return `<div class="lmap-cell" data-col="${i}" style="grid-column:${i + 2};grid-row:${row}">${research.map(p => chip(p, false)).join('')}${products.map(p => chip(p, true)).join('')}</div>`;
  };

  const domains = DOMAIN_ORDER.filter(d => list.some(l => (levels.placements[l.id] || []).some(p => p.domain === d)));

  // one plain sentence on what the map shows, with the counts and the source in a small line under it
  const n = id => (levels.placements[id] || []).length;
  const placed = list.reduce((sum, l) => sum + n(l.id), 0);
  const on = list.slice(firstOn).reduce((sum, l) => sum + n(l.id), 0);
  const middle = ['L2', 'L3', 'L4'].reduce((sum, id) => sum + n(id), 0);
  const top = levels.placements.L5 || [];
  const conditional = top.filter(p => p.conditional).length;
  const topText = conditional === top.length ? `${top.length} reach L5, each only under a stated condition` : `${top.length} reach L5, ${conditional} of them only under a stated condition`;
  // one compact line under the map, so the whole part fits one screen
  const takeaway = `<p class="levels-sum"><b>What the map shows.</b> Most systems sit between L2 and L4 (${middle} of ${placed}), ${on} reach L3 or above, and ${topText}. <span>${esc(levels.source || 'Paper §6.3')}</span></p>`;

  root.innerHTML = `
    <p class="lede levels-lede">Each level keeps the capabilities of the level below and adds one more. <mark class="hl">L3 is the first always-on level</mark>.</p>
    <div class="lmap-scroll">
      <div class="lmap" style="--on:${firstOn + 2}">
        <span class="lmap-band" aria-hidden="true">Always-on</span>
        ${list.map((l, i) => `<button type="button" class="lmap-level" data-level="${esc(l.id)}" style="grid-column:${i + 2}" aria-haspopup="dialog" title="What ${esc(l.id)} requires">
          <span class="lmap-id">${esc(l.id)}${arrowNE}</span><span class="lmap-name">${esc(l.short || l.name)}</span><span class="lmap-count">${(levels.placements[l.id] || []).length}</span>
        </button>`).join('')}
        ${domains.map((d, r) => `<p class="lmap-domain" style="grid-row:${r + 3}">${esc(d)}</p>${list.map(l => cell(l, d, r + 3)).join('')}`).join('')}
      </div>
    </div>
    <p class="lmap-key"><span><i class="sys-chip"></i>Research system</span><span><i class="sys-chip is-product"></i>Product †</span><span>§ only under a stated condition</span><span>Select a level for what it requires, or a name for its details</span></p>
    ${takeaway}
`;

  const placedHtml = l => {
    const rest = without(l.explanation || '', [l.tagline, l.adds, l.criterion]);
    return rest ? `<section class="level-why"><h4>Why these systems are placed here</h4>${rest.split(/\n\n+/).map(par => `<p>${esc(par)}</p>`).join('')}</section>` : '';
  };
  registerView('level', id => {
    const l = list.find(x => x.id === id);
    if (!l) return '';
    return `<div class="sheet-body sheet-body--detail level-sheet"><!--back-->
      <p class="panel-kicker">${esc(l.id)} · ${esc(l.name)}${l.mark ? ` · ${esc(l.mark.replace(/[()]/g, ''))}` : ''} · ${(levels.placements[l.id] || []).length} placed</p>
      <h3 id="sheet-title">${notation(l.tagline || l.name)}</h3>
      ${l.adds ? `<p>${esc(l.adds)}</p>` : ''}
      ${checklistHtml(l)}
      ${conditionsHtml(l)}
      ${placedHtml(l)}
      ${levels.rules?.length ? `<p class="level-rule"><b>Placement.</b> ${esc(levels.rules[0])}</p>` : ''}
      ${levels.rules?.[1] ? `<details class="level-variants"><summary>Which variant each entry covers</summary><p>${esc(levels.rules[1])}</p></details>` : ''}
    </div>`;
  });

  root.addEventListener('click', event => {
    const level = event.target.closest('.lmap-level');
    if (level) { openSheet({ type: 'level', id: level.dataset.level }, level); return; }
    const chipEl = event.target.closest('[data-open-work]');
    if (chipEl) openSheet({ type: 'work', id: chipEl.dataset.openWork }, chipEl);
  });
}
