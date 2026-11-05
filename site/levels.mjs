// Levels of loop closure (Section 6.3) as one map: levels L0–L5 across, interaction domains down,
// and every system the closure table places, research systems first and products (†) after them.
// Selecting a level shows what it requires (the level checklist) and why systems sit there.
// § marks an L5 placement that holds only under a stated condition.
import { loadData, esc, notation } from './systems.mjs';
import { openSheet } from './sheet.mjs';

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
  let current = Math.max(0, list.findIndex(l => l.id === 'L3'));
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
  const takeaway = `<p class="takeaway"><b>What the map shows.</b> Most systems sit between L2 and L4 (${middle} of ${placed}). ${on} reach L3 or above, where the assistant decides for itself whether or when to act, and ${topText}.
    <span class="takeaway-src">${list.map(l => `${esc(l.id)} ${n(l.id)}`).join(' · ')} · ${esc(levels.source || 'Paper §6.3')}, working draft of November 2026</span></p>`;

  root.innerHTML = `
    <p class="lede levels-lede">Each level keeps the capabilities of the level below and adds one more. <mark class="hl">L3 is the first always-on level</mark>, because the assistant begins to decide for itself whether or when to act without a request.</p>
    <div class="lmap-scroll">
      <div class="lmap" style="--on:${firstOn + 2}">
        <span class="lmap-band" aria-hidden="true">Always-on</span>
        ${list.map((l, i) => `<button type="button" class="lmap-level" data-level="${i}" style="grid-column:${i + 2}" aria-pressed="false" title="Show what ${esc(l.id)} requires">
          <span class="lmap-id">${esc(l.id)}</span><span class="lmap-name">${esc(l.short || l.name)}</span><span class="lmap-count">${(levels.placements[l.id] || []).length}</span>
        </button>`).join('')}
        ${domains.map((d, r) => `<p class="lmap-domain" style="grid-row:${r + 3}">${esc(d)}</p>${list.map(l => cell(l, d, r + 3)).join('')}`).join('')}
      </div>
    </div>
    <p class="lmap-key"><span><i class="sys-chip"></i>Research system</span><span><i class="sys-chip is-product"></i>Product †</span><span>§ only under a stated condition</span><span>Select a level for what it requires, a name for its details</span></p>
    ${takeaway}
    <div class="level-panel" role="region" aria-live="polite"></div>
    <div class="levels-foot">
      ${levels.rules?.length ? `<p><b>Placement.</b> ${esc(levels.rules[0])}</p>` : ''}
      ${levels.rules?.[1] ? `<details class="levels-variants"><summary>Which variant each entry covers</summary><p>${esc(levels.rules[1])}</p></details>` : ''}
    </div>`;

  const panel = root.querySelector('.level-panel');

  function render() {
    root.querySelectorAll('.lmap-level').forEach((b, i) => {
      b.classList.toggle('is-on', i === current);
      b.setAttribute('aria-pressed', String(i === current));
    });
    root.querySelectorAll('.lmap-cell').forEach(c => c.classList.toggle('is-on', Number(c.dataset.col) === current));
    const l = list[current];
    const rest = without(l.explanation || '', [l.tagline, l.adds, l.criterion]);
    panel.innerHTML = `
      <div class="level-copy">
        <p class="panel-kicker">${esc(l.id)} · ${esc(l.name)}${l.mark ? ` · ${esc(l.mark.replace(/[()]/g, ''))}` : ''} · ${(levels.placements[l.id] || []).length} placed</p>
        <h3>${notation(l.tagline || l.name)}</h3>
        ${l.adds ? `<p>${esc(l.adds)}</p>` : ''}
        ${checklistHtml(l)}
        ${conditionsHtml(l)}
        ${rest ? `<details class="level-why"><summary>Why these systems are placed here</summary>${rest.split(/\n\n+/).map(par => `<p class="panel-muted">${esc(par)}</p>`).join('')}</details>` : ''}
      </div>`;
  }

  root.addEventListener('click', event => {
    const level = event.target.closest('.lmap-level');
    if (level) { current = Number(level.dataset.level); render(); return; }
    const chipEl = event.target.closest('[data-open-work]');
    if (chipEl) openSheet({ type: 'work', id: chipEl.dataset.openWork }, chipEl);
  });
  root.querySelector('.lmap').addEventListener('keydown', event => {
    if (!event.target.closest('.lmap-level') || !['ArrowRight', 'ArrowLeft'].includes(event.key)) return;
    event.preventDefault();
    current = Math.max(0, Math.min(list.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)));
    render();
    root.querySelector(`.lmap-level[data-level="${current}"]`).focus();
  });
  render();
}
