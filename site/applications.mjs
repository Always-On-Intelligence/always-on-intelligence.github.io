// Applications (Section 6.1): a grid of operating regimes, interaction domain by participant scope.
// A tile shows how many systems of the paper's systems table operate there and the application
// figure's three example cases; it opens a sheet with the figure's illustration, the systems and the
// domain's bottleneck. Sheets show the short versions of the paper's domain texts (applications-brief.mjs),
// and the domain sheet keeps the full text behind a toggle. The grid is drawn without blur or moving
// backgrounds, so scrolling stays smooth.
import { domains, participants, horizons, cases, tableHorizon } from './data/regimes.mjs';
import { briefs } from './data/applications-brief.mjs';
import { loadData, esc } from './systems.mjs';
import { openSheet, registerView } from './sheet.mjs';

const HORIZON_NAME = Object.fromEntries(horizons.map(h => [h.id, h.name]));
const img = cellId => `assets/applications/${cellId}.webp`;

/** Brief text to HTML: ==phrase== is a marked key phrase, **label** a bold lead. */
const fmt = s => esc(s).replace(/==(.+?)==/g, '<mark class="hl">$1</mark>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const paragraphs = text => text.split(/\n\s*\n/).map(p => `<p>${esc(p.trim())}</p>`).join('');

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

function caseList(cellId, horizon) {
  return cases[cellId].map(([name, h]) => `<li class="case${horizon && horizon !== h ? ' is-dim' : ''}" data-h="${h}"><i></i>${esc(name)}</li>`).join('');
}

// one dot per system in the setting, coloured by the outcome horizon its row reports
const horizonOf = w => (tableHorizon[w.horizon] || ['unmeasured']).at(-1);
const dotsHtml = (works, horizon) => works.map(w => `<i class="tdot${horizon && !(tableHorizon[w.horizon] || ['unmeasured']).includes(horizon) ? ' is-dim' : ''}" data-h="${horizonOf(w)}" title="${esc(w.name)}"></i>`).join('');

function tileHtml(domain, participant, works, horizon) {
  const id = `${domain.id}-${participant.id}`;
  const count = horizon ? works.filter(w => (tableHorizon[w.horizon] || []).includes(horizon)).length : works.length;
  return `<button type="button" class="tile" data-cell="${id}" data-d="${domain.id}" aria-label="${domain.name}, ${participant.name}: ${count} systems">
    <span class="tile-where">${domain.name} · ${participant.name}</span>
    <span class="tile-top"><span class="tile-count"><b>${count}</b> ${count === 1 ? 'system' : 'systems'}</span><span class="tile-dots" aria-hidden="true">${dotsHtml(works, horizon)}</span></span>
    <ul class="cases">${caseList(id, horizon)}</ul>
  </button>`;
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

export async function mountApplications(root) {
  if (!root) return;
  root.innerHTML = `
    <div class="apps-stage">
      <div class="apps-bar glass-pill" role="group" aria-label="Outcome horizon">
        <span class="apps-bar-label">Outcome horizon</span>
        <button type="button" data-horizon="" aria-pressed="true">All</button>
        ${horizons.map(h => `<button type="button" data-horizon="${h.id}" aria-pressed="false"><i class="hdot" data-h="${h.id}"></i>${h.name}</button>`).join('')}
      </div>
      <div class="apps-grid" aria-label="Interaction domain by participant scope">
        <span class="apps-corner" aria-hidden="true"><span>domain →</span><span>participants ↓</span></span>
        ${domains.map(d => `<button type="button" class="apps-col glass-pill" data-domain="${d.id}">${d.name}<small data-count-domain="${d.id}"></small></button>`).join('')}
        ${participants.map(p => `<span class="apps-row">${p.name}</span>${domains.map(d => `<div class="apps-slot" data-slot="${d.id}-${p.id}"></div>`).join('')}`).join('')}
      </div>
      <p class="apps-hint">Each dot is one system of the paper’s systems table, coloured by the outcome horizon it reports. Select a setting for its systems and bottlenecks.</p>
    </div>`;

  const grid = root.querySelector('.apps-grid');
  const state = { horizon: '' };

  let data;
  try {
    data = await loadData();
  } catch (error) {
    grid.insertAdjacentHTML('afterend', '<p class="apps-hint">The system data could not be loaded. Serve the site over http to use this figure.</p>');
    console.error(error);
    data = { applications: { groups: [] }, levels: null, systems: new Map() };
  }
  const groups = data.applications.groups;

  function cellSheet(cellId) {
    const [did, pid] = cellId.split('-');
    const d = domains.find(x => x.id === did);
    const p = participants.find(x => x.id === pid);
    const group = groups.find(g => g.domain === d.table);
    const brief = briefs[d.table];
    const works = systemsIn(groups, d, p, state.horizon);
    const all = systemsIn(groups, d, p, '');
    return `${hero(cellId, `
        <p class="sheet-kicker">Operating regime · Paper §2.5 and §6.1</p>
        <h3 id="sheet-title">${d.name} · ${p.name}</h3>
        <ul class="cases cases--row">${caseList(cellId, state.horizon)}</ul>`)}
      <div class="sheet-body">
        <section>
          <h4>Systems in this setting <span>${works.length}${state.horizon ? ` of ${all.length}, ${esc(HORIZON_NAME[state.horizon])}` : ''}</span></h4>
          ${works.length ? `<div class="work-grid">${works.map(workCard).join('')}</div>` : `<p class="sheet-empty">No system in the paper’s systems table operates here${state.horizon ? ' with this outcome horizon' : ''}. The example cases come from the application figure of §2.5.</p>`}
        </section>
        ${group ? `<section class="sheet-domain">
          <h4>${esc(group.title)} <span>§${esc(group.section)}</span></h4>
          ${brief ? `<p>${fmt(brief.gist)}</p>
          <p class="sheet-bottleneck"><b>Bottlenecks.</b> ${fmt(brief.bottleneck)}</p>` : ''}
          <button type="button" class="link-btn" data-domain="${d.id}">All ${d.name.toLowerCase()} systems and bottlenecks</button>
        </section>` : ''}
      </div>`;
  }

  function domainSheet(did) {
    const d = domains.find(x => x.id === did);
    const group = groups.find(g => g.domain === d.table);
    const brief = briefs[d.table];
    const works = systemsIn(groups, d, null, state.horizon);
    return `${hero(`${d.id}-individual`, `
        <p class="sheet-kicker">Interaction domain · Paper §${esc(group?.section || '6.1')}</p>
        <h3 id="sheet-title">${esc(group?.title || d.name)}</h3>
        <p class="sheet-lede">${brief ? fmt(brief.gist) : ''}</p>`, ' sheet-hero--domain')}
      <div class="sheet-body">
        ${brief ? `<section>
          <ul class="brief-points">${brief.points.map(x => `<li>${fmt(x)}</li>`).join('')}</ul>
          <p class="sheet-bottleneck sheet-bottleneck--brief"><b>Bottlenecks.</b> ${fmt(brief.bottleneck)}</p>
        </section>` : ''}
        <section>
          <h4>${d.name} systems <span>${works.length}${state.horizon ? `, ${esc(HORIZON_NAME[state.horizon])}` : ''}</span></h4>
          <div class="work-grid">${works.map(workCard).join('')}</div>
        </section>
        ${group ? `<details class="sheet-full">
          <summary>The paper’s full text, §${esc(group.section)}</summary>
          ${paragraphs(group.description)}
          <h5>Bottlenecks and trade-offs</h5>
          ${paragraphs(group.bottleneck)}
        </details>` : ''}
      </div>`;
  }

  registerView('cell', cellSheet);
  registerView('domain', domainSheet);

  function renderTiles() {
    for (const d of domains) {
      for (const p of participants) {
        const slot = grid.querySelector(`[data-slot="${d.id}-${p.id}"]`);
        const all = systemsIn(groups, d, p, '');
        const count = systemsIn(groups, d, p, state.horizon).length;
        const existing = slot.querySelector('.tile');
        if (!existing) {
          slot.innerHTML = tileHtml(d, p, all, state.horizon);
        } else {
          existing.querySelector('.tile-count').innerHTML = `<b>${count}</b> ${count === 1 ? 'system' : 'systems'}`;
          existing.querySelector('.tile-dots').innerHTML = dotsHtml(all, state.horizon);
          existing.setAttribute('aria-label', `${d.name}, ${p.name}: ${count} systems`);
          existing.querySelectorAll('.case').forEach(li => li.classList.toggle('is-dim', Boolean(state.horizon) && li.dataset.h !== state.horizon));
        }
      }
      const n = systemsIn(groups, d, null, state.horizon).length;
      grid.querySelector(`[data-count-domain="${d.id}"]`).textContent = `${n} system${n === 1 ? '' : 's'}`;
    }
    root.querySelectorAll('[data-horizon]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.horizon === state.horizon)));
  }

  root.addEventListener('click', event => {
    const t = event.target.closest('button');
    if (!t || !root.contains(t)) return;
    if (t.dataset.horizon !== undefined) {
      state.horizon = t.dataset.horizon;
      renderTiles();
      return;
    }
    if (t.dataset.cell) openSheet({ type: 'cell', id: t.dataset.cell }, t);
    else if (t.dataset.domain) openSheet({ type: 'domain', id: t.dataset.domain }, t);
  });

  renderTiles();
}
