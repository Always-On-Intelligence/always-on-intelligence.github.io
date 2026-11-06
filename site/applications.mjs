// Applications (Section 6.1), aligned with the paper. The paper's application scope figure sits above this part in
// index.html, and this module draws one column per group of the paper's systems table, in the table's order:
// §6.1.1 wearable, §6.1.2 digital, §6.1.3 physical. A column gives what the group's assistants do, every row of the
// group (each opens its sheet), and the group's bottlenecks. The domain's name opens the domain sheet: what its
// systems do, in the short versions of the paper's texts (applications-brief.mjs), its bottlenecks, and its systems.
// The columns are drawn without blur or moving backgrounds, so scrolling stays smooth.
import { domains, tableHorizon } from './data/regimes.mjs';
import { briefs } from './data/applications-brief.mjs';
import { loadData, esc, arrowNE } from './systems.mjs';
import { openSheet, registerView } from './sheet.mjs';

const img = cellId => `assets/applications/${cellId}.webp`;

/** Brief text to HTML: ==phrase== is a marked key phrase, **label** a bold lead. */
const fmt = s => esc(s).replace(/==(.+?)==/g, '<mark class="hl">$1</mark>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const plain = s => esc(s).replace(/==(.+?)==/g, '$1');
/** A domain's bottlenecks: one per line, its name in bold and a short reason. */
const bottleneckList = b => `<ul class="bn-list">${b.bottlenecks.map(([name, why]) => `<li><b>${esc(name)}</b> ${esc(why)}</li>`).join('')}</ul>`;
const systems = n => `${n} system${n === 1 ? '' : 's'}`;

/** Systems of the table that operate in a domain (and a participant scope and an outcome horizon, if given). */
export function systemsIn(groups, domain, participant, horizon) {
  const out = [];
  for (const g of groups) {
    for (const w of g.works) {
      if (!w.domains.includes(domain.table)) continue;
      if (participant && !w.participants.includes(participant.table)) continue;
      if (horizon && !(tableHorizon[w.horizon] || []).includes(horizon)) continue;
      out.push({ ...w, section: g.section });
    }
  }
  return out;
}

/** The columns: the table's groups in its order, each with its domain and its rows, as the paper lists them. */
export function columnsOf(groups) {
  return groups.map(group => ({ group, domain: domains.find(d => d.table === group.domain) })).filter(c => c.domain);
}

function workCard(w) {
  return `<button type="button" class="work-card" data-work="${esc(w.key)}">
    <span class="work-name">${esc(w.name)}</span>
    <span class="work-mech">${esc(w.mechanism)}</span>
    <span class="work-meta"><span>${esc(w.horizon)}</span><span>${esc(w.bottleneck)}</span></span>
  </button>`;
}

function hero(cellId, inner, extra = '') {
  return `<div class="sheet-hero${extra}">
      <div class="sheet-hero-bg" style="background-image:url('${img(cellId)}')" aria-hidden="true"></div>
      <img class="sheet-hero-img" src="${img(cellId)}" alt="">
      <div class="sheet-hero-glass"><!--back-->${inner}</div>
    </div>`;
}

function columnHtml({ group, domain: d }) {
  const brief = briefs[d.table];
  return `<article class="app-card" data-d="${d.id}">
    <header class="app-head"><h3 class="app-name"><button type="button" class="app-domain" data-domain="${d.id}">${d.name}${arrowNE}</button></h3><span class="app-meta">${systems(group.works.length)} · §${esc(group.section)}</span></header>
    ${brief ? `<p class="app-gist">${plain(brief.gist)}</p>` : '<p class="app-gist"></p>'}
    <ul class="app-works" aria-label="${d.name} systems">${group.works.map(w => `<li><button type="button" class="app-work" data-work="${esc(w.key)}" title="${esc(w.mechanism)}">${esc(w.name)}</button></li>`).join('')}</ul>
    ${brief ? `<div class="app-bottleneck"><p class="app-label">Bottlenecks</p>${bottleneckList(brief)}</div>` : '<div></div>'}
  </article>`;
}

export async function mountApplications(root) {
  if (!root) return;
  let data;
  try {
    data = await loadData();
  } catch (error) {
    root.innerHTML = '<p class="apps-hint">The system data could not be loaded. Serve the site over http to use this figure.</p>';
    console.error(error);
    return;
  }
  const groups = data.applications.groups;

  root.innerHTML = `
    <div class="apps-stage">
      <div class="apps-cards">${columnsOf(groups).map(columnHtml).join('')}</div>
    </div>`;

  function domainSheet(did) {
    const d = domains.find(x => x.id === did);
    const group = groups.find(g => g.domain === d.table);
    const brief = briefs[d.table];
    const works = group?.works || [];
    return `${hero(`${d.id}-individual`, `
        <p class="sheet-kicker">Interaction domain · Paper §${esc(group?.section || '6.1')}</p>
        <h3 id="sheet-title">${esc(group?.title || d.name)}</h3>
        <p class="sheet-lede">${brief ? fmt(brief.gist) : ''}</p>`, ' sheet-hero--domain')}
      <div class="sheet-body">
        ${brief ? `<section>
          <ul class="brief-points">${brief.points.map(x => `<li>${fmt(x)}</li>`).join('')}</ul>
          <div class="sheet-bottleneck sheet-bottleneck--brief"><p class="app-label">Bottlenecks</p>${bottleneckList(brief)}</div>
        </section>` : ''}
        <section>
          <h4>${d.name} systems <span>${works.length}</span></h4>
          <div class="work-grid">${works.map(workCard).join('')}</div>
        </section>
      </div>`;
  }

  registerView('domain', domainSheet);

  root.addEventListener('click', event => {
    const t = event.target.closest('button');
    if (!t || !root.contains(t)) return;
    if (t.dataset.work) openSheet({ type: 'work', id: t.dataset.work }, t);
    else if (t.dataset.domain) openSheet({ type: 'domain', id: t.dataset.domain }, t);
  });
}
