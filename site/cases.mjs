// Demo page: a game library of eight playable episodes under the 3D island. An episode opens
// in a player with a real-time 3D room (site/play/). The viewer makes the calls the episode's policy
// makes, sees each consequence play out in the room, and can change one condition or cut one channel
// before or during play. Side panels show the episode in the paper's terms: modules and channels
// (Table 2), shared conditions, the running state z, and the implementation and mechanism θ.
import { cases, IMPL, STEP_LABEL } from './data/cases.mjs';
import { play, SCENES } from './data/case-play.mjs';
import { resolveCase, arrow, CONDITIONS } from './case-core.mjs';
import { RECTS, channelGeometry, headPath } from './framework.mjs';
import { channels as CHANNEL_DEFS, conditions as CONDITION_DEFS } from './data/framework.mjs';
import { horizons } from './data/regimes.mjs';
import { esc } from './systems.mjs';
import { openSheet } from './sheet.mjs';
import { ICONS } from './case-icons.mjs';
import { mountIslandHero } from './island-hero.mjs';

const DOMAIN = { wearable: 'Wearable', digital: 'Digital', physical: 'Physical' };
const SCOPE = { individual: 'Single user', group: 'Small group', public: 'Public' };
const HORIZON = Object.fromEntries(horizons.map(h => [h.id, h.name]));
const CH = Object.fromEntries(CHANNEL_DEFS.map(c => [c.id, c]));
const COND = Object.fromEntries(CONDITION_DEFS.map(c => [c.id, c]));
const MEM_KIND = { retrospective: 'Retrospective', profile: 'Profile', prospective: 'Pending', working: 'Working' };
const STEP_NAME = { request: 'Request', outside: 'No request', boundary: 'Interaction ends', revision: 'Mechanism revision' };
const pad = n => String(n).padStart(2, '0');
// absolute, because a url() inside a custom property resolves against the stylesheet that uses it
const art = id => new URL(`assets/play/${id}.webp`, document.baseURI).href;
const decisionsOf = beats => beats.filter(b => b.decision && b.decision.options.length > 1);

// ---------- the loop map: modules and the six channels of Table 2 ----------

function loopMap(beat, cutChannel) {
  const on = new Set(beat.channels || []);
  const cut = new Set(beat.cut || []);
  const parts = CHANNEL_DEFS.map(ch => {
    const g = channelGeometry(ch);
    const state = cut.has(ch.id) ? 'cut' : on.has(ch.id) ? 'on' : cutChannel === ch.id ? 'blocked' : 'off';
    const end = { x: g.end.x - g.d.x * 8, y: g.end.y - g.d.y * 8 };
    const path = `M${g.start.x.toFixed(1)},${g.start.y.toFixed(1)} L${end.x.toFixed(1)},${end.y.toFixed(1)}`;
    const pulse = state === 'on' ? `<circle class="ml-pulse" r="11"><animateMotion dur="1.4s" repeatCount="indefinite" path="${path}"/></circle>` : '';
    const mark = state === 'cut' || state === 'blocked' ? `<text class="ml-x" x="${g.mid.x.toFixed(1)}" y="${(g.mid.y + 12).toFixed(1)}">✕</text>` : '';
    return `<g class="ml-ch ml-ch--${state}"><path class="ml-line" d="${path}"/><path class="ml-head" d="${headPath(g.end, g.d, 14, 7.5)}"/>${pulse}<text class="ml-label" x="${g.label.x.toFixed(1)}" y="${(g.label.y + 7).toFixed(1)}">${arrow(ch.id)}</text>${mark}</g>`;
  }).join('');
  const names = { S: 'Sensing', M: 'Memory', A: 'Action' };
  const mods = Object.entries(RECTS).map(([id, r]) => `<g class="ml-node ml-node--${id}${(beat.modules || []).includes(id) ? ' is-on' : ''}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="20"/><text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 + 12}">${names[id]}</text></g>`).join('');
  return `<svg class="gx-loop" viewBox="0 0 780 476" role="img" aria-label="Modules and channels active in this step">${parts}${mods}</svg>`;
}

// ---------- library ----------

function cardHtml(c) {
  const resolved = resolveCase(c);
  const calls = decisionsOf(resolved.beats).length;
  return `<button type="button" class="pg-card" data-case="${c.id}" data-domain="${c.domain}" style="--art:url('${art(c.id)}')">
    <span class="pg-card-art" aria-hidden="true"><span class="pg-card-num">${c.num}</span></span>
    <span class="pg-chip">${DOMAIN[c.domain]}</span>
    <span class="pg-card-level" title="Level of loop closure in this episode">${c.level}</span>
    <span class="pg-card-box">
      <span class="pg-card-meta">${SCOPE[c.scope]} · ${c.beats.length} steps · ${calls} ${calls === 1 ? 'call' : 'calls'}</span>
      <span class="pg-card-title">${esc(c.title)}</span>
      <span class="pg-card-desc">${esc(c.tagline)}</span>
      <span class="pg-card-by">Modeled on ${c.works.map(w => esc(w.name)).join(', ')}</span>
    </span>
  </button>`;
}

export function mountCases(root) {
  if (!root) return;
  const featured = cases.find(c => c.id === 'robot-cup') || cases[0];
  const count = d => cases.filter(c => c.domain === d).length;
  root.innerHTML = `
    <div class="pg">
      <div class="pg-hero">
        <div class="pg-stage" role="group" aria-label="An island over the sea with one building for each episode: a maker with smart glasses at a workbench, a runner at a shoe shelf, a meeting with a visitor at the door, a home office on a call, an analyst at a laptop, an unattended desk beside home servers and a locked cabinet, a robot bringing an older woman her cup, and a care-home lounge with a service robot. Drag to turn the island; choose a building to play its episode."><div class="pg-stage-wait" aria-hidden="true"><span>Raising the island</span><i></i></div></div>
        <div class="pg-hero-copy">
          <p class="pg-hero-logo" aria-hidden="true">PLAY THE LOOP</p>
          <p class="pg-hero-tag">Eight episodes. One framework.</p>
          <p class="pg-hero-sub">Choose a building on the island and make the calls its agent makes. Change one condition, cut one channel, and watch what follows.</p>
          <div class="pg-hero-actions"><button type="button" class="pg-pill pg-pill--start" data-case-start="${featured.id}">Press start</button><span class="pg-hero-hint">or click a building</span></div>
        </div>
      </div>
      <div class="pg-discover">
        <span class="pg-pill pg-pill--static">Discover</span>
        <p class="pg-kicker">Choose an episode</p>
        <div class="pg-filters" role="group" aria-label="Filter the episodes">
          <button type="button" aria-pressed="true" data-filter="all">All <small>${cases.length}</small></button>
          ${['wearable', 'digital', 'physical'].map(d => `<button type="button" aria-pressed="false" data-filter="${d}">${DOMAIN[d]} <small>${count(d)}</small></button>`).join('')}
        </div>
        <div class="pg-grid">${cases.map(cardHtml).join('')}</div>
        <p class="pg-note">Each episode is a scripted teaching scene built from what the paper reports for the works it names. Your calls are compared with the policy the episode follows; cutting a channel is a scripted contrast in the spirit of HALO’s run mode, not a run of the original system.</p>
      </div>
    </div>`;
  // mark cards whose art exists (the art is a real render of the episode's room)
  root.querySelectorAll('[style*="--art"]').forEach(el => {
    const url = el.style.getPropertyValue('--art').match(/url\(["']?([^"')]+)["']?\)/)?.[1];
    if (!url) return;
    const img = new Image();
    img.onload = () => el.classList.add('has-art');
    img.src = url;
  });
  root.addEventListener('click', event => {
    const filter = event.target.closest('[data-filter]');
    if (filter) {
      root.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === filter)));
      const f = filter.dataset.filter;
      root.querySelectorAll('.pg-card').forEach(card => { card.hidden = !(f === 'all' || card.dataset.domain === f); });
      return;
    }
    const start = event.target.closest('[data-case-start]');
    if (start) { enterEpisode(start.dataset.caseStart, start); return; }
    const card = event.target.closest('.pg-card');
    if (card) enterEpisode(card.dataset.case, card);
  });
  root.addEventListener('click', event => {
    // pins of the illustration (the 3D island handles its own)
    const pin = event.target.closest('.pg-pins [data-case-pin]');
    if (pin) enterEpisode(pin.dataset.casePin, pin);
  });
  const fromHash = location.hash.match(/^#case-([a-z0-9-]+)$/);
  if (fromHash) openEpisode(fromHash[1], null);
  const heroEl = root.querySelector('.pg-hero');
  mountIslandHero(heroEl, { onEnter: (id, origin) => enterEpisode(id, origin || heroEl, { fly: true }) })
    .then(ctl => { hero3d = ctl; if (G && !layer?.hidden) hero3d.pause(true); })
    .catch(error => console.error(error));
}

// the 3D island of the hero, once it is up
let hero3d = null;

// ---------- transitions: dive into the island, then a pixel wipe into the episode ----------

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wipeCanvas = null;
let busy = false;

/**
 * Cover (or uncover) the screen with big square pixels in a dithered order that spreads from (x, y),
 * in a few visible steps like an old console; the newest pixels flash in the lime of the game.
 */
function pixelWipe(x, y, { cover = true, ms = 440 } = {}) {
  if (!wipeCanvas) {
    wipeCanvas = document.createElement('canvas');
    wipeCanvas.className = 'gx-wipe';
    document.body.append(wipeCanvas);
  }
  const c = wipeCanvas;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth, H = window.innerHeight;
  c.width = W * dpr; c.height = H * dpr;
  c.hidden = false;
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const size = Math.max(22, Math.round(Math.min(W, H) / 24));
  const cols = Math.ceil(W / size), rows = Math.ceil(H / size);
  const far = Math.hypot(Math.max(x, W - x), Math.max(y, H - y));
  // each pixel's turn: mostly random, partly by distance from the click
  const turn = new Float32Array(cols * rows);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    turn[i * rows + j] = 0.6 * Math.random() + 0.4 * (Math.hypot(i * size + size / 2 - x, j * size + size / 2 - y) / far);
  }
  const steps = 8;
  const t0 = performance.now();
  return new Promise(resolve => {
    let shown = -1;
    const draw = now => {
      const step = Math.min(steps, Math.floor(((now - t0) / ms) * steps) + 1);
      if (step !== shown) {
        shown = step;
        const p = step / steps, q = (step - 1) / steps;
        ctx.clearRect(0, 0, W, H);
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
          const v = turn[i * rows + j];
          const on = cover ? v < p : v >= p;
          if (!on) continue;
          const fresh = cover ? v >= q : v < p + 1 / steps;
          ctx.fillStyle = fresh && step < steps ? ((i + j) % 3 ? '#c8f26a' : '#ffffff') : '#050608';
          ctx.fillRect(i * size, j * size, size, size);
        }
      }
      if (step < steps) requestAnimationFrame(draw);
      else { if (!cover) c.hidden = true; resolve(); }
    };
    requestAnimationFrame(draw);
  });
}

/**
 * Open an episode with a transition. From the island (a building, its pin, or Press start) the camera
 * flies into that building first; from a card the wipe starts at the card.
 */
async function enterEpisode(caseId, origin, { fly = false } = {}) {
  if (busy) return;
  const fromHero = fly || Boolean(origin?.closest?.('.pg-hero'));
  if (reduced() || !origin) { openEpisode(caseId, origin); hero3d?.pause(true); return; }
  busy = true;
  try {
    const r = origin.getBoundingClientRect();
    let x = r.left + r.width / 2, y = r.top + r.height / 2;
    const heroEl = origin.closest('.pg-hero');
    if (fromHero && hero3d?.live) {
      heroEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const pt = await hero3d.flyTo(caseId);
      if (pt) ({ x, y } = pt);
    } else if (heroEl && origin.matches('.pg-pins .pg-pin')) {
      heroEl.style.setProperty('--ox', origin.style.left);
      heroEl.style.setProperty('--oy', origin.style.top);
      heroEl.classList.add('is-diving');
      await sleep(330);
    }
    await pixelWipe(x, y, { cover: true });
    hero3d?.pause(true);
    await openEpisode(caseId, origin, { swoop: true });
    heroEl?.classList.remove('is-diving');
    await pixelWipe(window.innerWidth / 2, window.innerHeight / 2, { cover: false });
  } finally {
    busy = false;
  }
}

async function leaveEpisode() {
  if (busy) return;
  if (reduced()) { closePlayer(); return; }
  busy = true;
  try {
    // the room breaks into pixels, pixels cover the screen, and the island resolves out of them
    if (G?.view) await G.view.pixelate(0.05, 380, 5);
    await pixelWipe(window.innerWidth / 2, window.innerHeight / 2, { cover: true, ms: 380 });
    closePlayer({ pixels: true });
    await pixelWipe(window.innerWidth / 2, window.innerHeight / 2, { cover: false, ms: 440 });
  } finally {
    busy = false;
  }
}

// ---------- the player ----------

let layer = null;
let G = null;
if (new URLSearchParams(location.search).has('debug')) { window.__gx = () => G; window.__hero = () => hero3d; }

function ensureLayer() {
  if (layer) return layer;
  layer = document.createElement('div');
  layer.className = 'gx-layer';
  layer.hidden = true;
  layer.innerHTML = `
    <div class="gx" role="dialog" aria-modal="true" aria-labelledby="gx-title" tabindex="-1">
      <header class="gx-bar">
        <button type="button" class="gx-pill gx-back" data-gx="close"><span aria-hidden="true">◀</span> Library</button>
        <div class="gx-bar-title"><span class="gx-ep"></span><h3 id="gx-title"></h3></div>
        <div class="gx-bar-right">
          <span class="gx-level" title="Level of loop closure in this scenario"></span>
          <label class="gx-scenario"><span>Scenario</span><select data-gx="scenario"></select></label>
          <button type="button" class="gx-close" data-gx="close" aria-label="Close the episode">${ICONS.close}</button>
        </div>
      </header>
      <div class="gx-main">
        <div class="gx-stage">
          <div class="gx-view"></div>
          <div class="gx-objective"><span>Objective</span><p></p></div>
          <p class="gx-help" aria-hidden="true">Drag to look around · Scroll to zoom · Click a marker to inspect</p>
          <div class="gx-card" hidden></div>
          <div class="gx-loading" hidden><span>Building the room</span><i></i></div>
          <div class="gx-screen gx-screen--title"></div>
          <div class="gx-screen gx-screen--end" hidden></div>
          <section class="gx-dialog" aria-live="polite" hidden></section>
        </div>
        <aside class="gx-side" aria-label="The episode in the paper's terms"></aside>
      </div>
      <footer class="gx-timeline"></footer>
    </div>`;
  document.body.append(layer);
  layer.addEventListener('click', onClick);
  layer.addEventListener('change', event => {
    if (event.target.matches('[data-gx="scenario"], input[name="gx-scenario"]')) setScenario(event.target.value);
  });
  layer.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', () => {
    if (!G?.view) return;
    if (document.hidden) G.view.stop(); else if (!layer.hidden) G.view.start();
  });
  return layer;
}

const $ = sel => layer.querySelector(sel);
const resolved = () => resolveCase(G.c, G.ctl || null);

async function openEpisode(caseId, opener, { swoop = false } = {}) {
  const c = cases.find(x => x.id === caseId);
  if (!c) return;
  ensureLayer();
  if (G?.view) closeView();
  G = { c, ctl: '', step: -1, calls: {}, phase: 'title', view: null, scene: null, opener, entering: null };
  setPhase('title');
  $('.gx-ep').textContent = `Episode ${c.num} · ${DOMAIN[c.domain]}`;
  $('#gx-title').textContent = c.title;
  $('.gx-objective p').textContent = play[c.id]?.objective || '';
  $('[data-gx="scenario"]').innerHTML = scenarioOptions(c).map(o => `<option value="${o.id}">${esc(o.label)}</option>`).join('');
  layer.hidden = false;
  document.documentElement.classList.add('gx-open');
  for (const el of document.body.children) if (el !== layer && !el.matches('script, style, link')) { el.dataset.gxInert = el.inert ? '1' : ''; el.inert = true; }
  history.replaceState(null, '', `#case-${c.id}`);
  renderTitle();
  renderSide(null);
  renderTimeline();
  $('.gx-dialog').hidden = true;
  $('.gx-screen--end').hidden = true;
  $('.gx').focus();
  G.swoop = swoop;
  loadScene();
}

function scenarioOptions(c) {
  return [{ id: '', label: 'Episode baseline', note: 'As the episode is built.' }, ...(c.controls || []).map(k => ({ id: k.id, label: k.label, note: k.note, type: k.type }))];
}

async function loadScene() {
  const host = $('.gx-view');
  host.innerHTML = '';
  const path = SCENES[G.c.id];
  const loading = $('.gx-loading');
  if (!path) { host.classList.add('is-empty'); host.innerHTML = `<p class="gx-noscene">The 3D room for this episode is in production. The steps, calls and panels below already work.</p>`; return; }
  host.classList.remove('is-empty');
  loading.hidden = false;
  const mine = G;
  try {
    const [{ createView }, mod] = await Promise.all([import('./play/engine.mjs'), import(new URL(path, import.meta.url).href)]);
    if (G !== mine) return;
    const view = createView(host, { onPick: id => inspect(id) });
    const scene = mod.build(view);
    view.optimize();
    if (G.phase === 'title') { const o = scene.overview; view.setRig({ ...o, theta: o.theta - 0.7, phi: 0.62, radius: o.radius * 1.7 }, { instant: true }); }
    if (G.swoop && !reduced()) view.setPixelation(0.05);
    await view.warm();
    if (G !== mine) { view.dispose(); return; }
    G.view = view;
    G.scene = scene;
    scene.spots.show([]);
    host.addEventListener('click', event => {
      const btn = event.target.closest('[data-spot]');
      if (btn) inspect(btn.dataset.spot);
    });
    host.addEventListener('pointerdown', () => $('.gx-help')?.classList.add('is-done'), { once: true });
    view.start();
    if (G.swoop) view.pixelate(1, 760, 6);
    frameView(true);
    window.addEventListener('resize', () => frameView());
    if (G.phase === 'title') titleOrbit();
    else await G.scene.enter(G.step, G.ctl, { instant: true, beat: resolved().beats[G.step] });
  } catch (error) {
    console.error(error);
    host.innerHTML = '<p class="gx-noscene">This browser could not start the 3D room. The steps and panels still work.</p>';
  } finally {
    loading.hidden = true;
  }
}

function titleOrbit() {
  if (!G?.view) return;
  const o = G.scene.overview;
  // start high and wide, then settle on the room: the damping turns this into a sweep
  G.view.setRig({ ...o, theta: o.theta - 0.7, phi: 0.62, radius: o.radius * 1.7 }, { instant: true });
  G.view.setRig({ ...o, theta: o.theta + 0.1 });
}

function closeView() {
  try { G?.view?.dispose(); } catch { /* ignore */ }
}

function closePlayer({ pixels = false } = {}) {
  if (!layer || layer.hidden) return;
  closeView();
  layer.hidden = true;
  document.documentElement.classList.remove('gx-open');
  for (const el of document.body.children) if (el !== layer && 'gxInert' in el.dataset) { el.inert = el.dataset.gxInert === '1'; delete el.dataset.gxInert; }
  if (location.hash.startsWith('#case-')) history.replaceState(null, '', location.pathname + location.search);
  const opener = G?.opener;
  G = null;
  hero3d?.reset({ pixels });
  hero3d?.pause(false);
  opener?.focus({ preventScroll: true });
}

// ---------- title screen ----------

function renderTitle() {
  const c = G.c;
  const screen = $('.gx-screen--title');
  screen.hidden = false;
  screen.innerHTML = `
    <div class="gx-title-card">
      <p class="gx-kicker">Episode ${c.num} · ${DOMAIN[c.domain]} · ${SCOPE[c.scope]} · ${esc(HORIZON[c.horizon] || c.horizon)}</p>
      <p class="gx-title-big">${esc(c.title)}</p>
      <p class="gx-title-tag">${esc(c.tagline)}</p>
      <div class="gx-title-obj"><span>Objective</span>${esc(play[c.id]?.objective || '')}</div>
      <fieldset class="gx-scenarios">
        <legend>Scenario</legend>
        ${scenarioOptions(c).map(o => `<label class="gx-scen"><input type="radio" name="gx-scenario" value="${o.id}" ${o.id === G.ctl ? 'checked' : ''}><span><b>${esc(o.label)}</b><small>${esc(o.note)}</small></span></label>`).join('')}
      </fieldset>
      <button type="button" class="gx-pill gx-pill--start" data-gx="start">Press start</button>
      <p class="gx-title-src">Modeled on ${c.works.map(w => esc(w.name)).join(', ')} · ${c.level === resolved().level ? c.level : resolved().level} in this scenario</p>
    </div>`;
}

function setPhase(phase) {
  G.phase = phase;
  $('.gx').dataset.phase = phase;
  frameView();
}

/** Keep the action clear of the panels drawn over the room: the title card (left) and the dialog (lower left). */
function frameView(instant = false) {
  if (!G?.view) return;
  const wide = window.matchMedia('(min-width: 1101px)').matches;
  const [x, y] = G.phase === 'title' ? (wide ? [0.2, 0.02] : [0, 0]) : G.phase === 'beat' && wide ? [0.14, -0.12] : [0, 0];
  G.view.setFrame(x, y, { instant });
}

function start() {
  setPhase('beat');
  $('.gx-screen--title').hidden = true;
  $('.gx-dialog').hidden = false;
  G.calls = {};
  goTo(0);
}

// ---------- beats ----------

async function goTo(i, { instant = false } = {}) {
  const beats = resolved().beats;
  i = Math.max(0, Math.min(beats.length - 1, i));
  G.step = i;
  setPhase('beat');
  $('.gx-screen--end').hidden = true;
  $('.gx-dialog').hidden = false;
  $('.gx-card').hidden = true;
  const beat = beats[i];
  renderDialog();
  renderSide(beat);
  renderTimeline();
  if (G.scene) {
    G.scene.spots.show(G.scene.visibleSpots(i, G.ctl));
    G.entering = G.scene.enter(i, G.ctl, { instant, beat });
    await G.entering;
  }
}

function renderDialog() {
  const beats = resolved().beats;
  const beat = beats[G.step];
  const d = beat.decision;
  const call = G.calls[G.step];
  const control = resolved().control;
  const last = G.step === beats.length - 1;
  const head = `<div class="gx-dialog-head"><span class="gx-step gx-step--${beat.step}">${STEP_NAME[beat.step]}</span><span class="gx-count">${pad(G.step + 1)} / ${pad(beats.length)}</span>${beat.varied && control ? `<span class="gx-changed">Changed by: ${esc(control.label)}</span>` : ''}${beat.cut?.length ? `<span class="gx-changed gx-changed--cut">${beat.cut.map(arrow).join(', ')} cut</span>` : ''}</div>`;
  let body = '';
  if (d && !call) {
    const single = d.options.length === 1;
    body = `<p class="gx-beat-title">${esc(beat.title)}</p>
      <p class="gx-text">${esc(d.prompt || beat.text)}</p>
      <div class="gx-choices" role="group" aria-label="${esc(d.ask || 'What does Action do?')}">
        <p class="gx-ask">${single ? 'No choice to make: the schedule decides' : esc(d.ask || 'What does Action do?')}</p>
        ${d.options.map((o, k) => `<button type="button" class="gx-choice" data-choice="${esc(o)}"><kbd>${k + 1}</kbd>${esc(o)}</button>`).join('')}
      </div>`;
  } else {
    const verdict = d && call ? verdictHtml(d, call) : '';
    body = `<p class="gx-beat-title">${esc(beat.title)}</p>${verdict}<p class="gx-text">${esc(beat.text)}</p>
      <div class="gx-actions">
        <button type="button" class="gx-pill gx-pill--ghost" data-gx="prev" ${G.step === 0 ? 'disabled' : ''}><span aria-hidden="true">◀</span> Back</button>
        <button type="button" class="gx-pill gx-pill--go" data-gx="next">${last ? 'Finish episode' : 'Continue'} <span aria-hidden="true">▶</span></button>
      </div>`;
  }
  $('.gx-dialog').innerHTML = head + body;
}

function verdictHtml(d, call) {
  const single = d.options.length === 1;
  const same = call.mine === d.choice;
  return `<div class="gx-verdict ${single ? 'is-single' : same ? 'is-same' : 'is-diff'}">
    ${single ? '' : `<span class="gx-match">${same ? 'Same call as the policy' : 'A different call from the policy'}</span>`}
    <p><span class="gx-who">${single ? 'What happens' : 'Your call'}</span><b>${esc(call.mine)}</b> ${esc(d.results?.[call.mine] || '')}</p>
    ${single ? '' : `<p><span class="gx-who">${esc(d.ask === 'What does the blocking review accept?' ? 'The review' : 'The policy')}</span><b>${esc(d.choice)}</b> ${esc(d.why)}</p>`}
  </div>`;
}

async function choose(option) {
  const beat = resolved().beats[G.step];
  const d = beat.decision;
  if (!d || G.calls[G.step]) return;
  const at = G.step;
  G.calls[at] = { mine: option, policy: d.choice, match: option === d.choice, counted: d.options.length > 1 };
  renderDialog();
  renderTimeline();
  $('.gx-dialog [data-gx="next"]')?.focus();
  if (!G.scene) return;
  if (G.entering) await G.entering;
  if (G.step !== at) return;
  const played = await G.scene.act(at, option, G.ctl);
  // after a different call, the room plays the policy's call too, so the next step starts from it
  if (played && option !== d.choice && d.options.includes(d.choice) && G.step === at) {
    await G.view.wait(350);
    if (G.step === at) await G.scene.act(at, d.choice, G.ctl, { policy: true });
  }
}

function next() {
  const beats = resolved().beats;
  const d = beats[G.step]?.decision;
  if (d && !G.calls[G.step]) return;
  if (G.step >= beats.length - 1) { showEnd(); return; }
  goTo(G.step + 1);
}

function prev() {
  if (G.phase === 'end') { goTo(resolved().beats.length - 1, { instant: true }); return; }
  if (G.step > 0) goTo(G.step - 1, { instant: true });
}

function setScenario(id) {
  if (!G) return;
  G.ctl = id || '';
  $('[data-gx="scenario"]').value = G.ctl;
  layer.querySelectorAll('input[name="gx-scenario"]').forEach(r => { r.checked = r.value === G.ctl; });
  $('.gx-level').textContent = resolved().level;
  if (G.phase === 'title') { renderTitle(); renderTimeline(); return; }
  const beats = resolved().beats;
  const first = G.ctl ? beats.findIndex(b => b.varied || (b.cut || []).length) : 0;
  const from = Math.max(0, first);
  for (const k of Object.keys(G.calls)) if (Number(k) >= from) delete G.calls[k];
  goTo(from);
}

// ---------- end screen ----------

function showEnd() {
  setPhase('end');
  const c = G.c;
  const outcomes = play[c.id]?.outcomes || {};
  const out = outcomes[G.ctl] || outcomes[''] || { title: 'Episode complete', tone: 'neutral', text: '' };
  const calls = decisionsOf(resolved().beats).map(b => ({ b, call: G.calls[b.index] })).filter(x => x.call);
  const matched = calls.filter(x => x.call.match).length;
  const tried = scenarioOptions(c).filter(o => o.id !== G.ctl);
  const nextScenario = tried.find(o => o.id) || tried[0];
  const screen = $('.gx-screen--end');
  screen.hidden = false;
  $('.gx-dialog').hidden = true;
  screen.innerHTML = `
    <div class="gx-end-card gx-end-card--${out.tone}">
      <p class="gx-kicker">Episode complete · ${esc(scenarioOptions(c).find(o => o.id === G.ctl)?.label || 'Episode baseline')} · ${resolved().level}</p>
      <p class="gx-end-title">${esc(out.title)}</p>
      <p class="gx-end-text">${esc(out.text)}</p>
      ${calls.length ? `<div class="gx-calls"><p class="gx-calls-head">Your calls <b>${matched} / ${calls.length}</b> matched the episode’s policy</p><ol>${calls.map(({ b, call }) => `<li class="${call.match ? 'is-same' : 'is-diff'}"><span>${esc(b.title)}</span><span>You: ${esc(call.mine)}</span><span>Policy: ${esc(b.decision.choice)}</span></li>`).join('')}</ol></div>` : ''}
      <div class="gx-end-actions">
        <button type="button" class="gx-pill gx-pill--ghost" data-gx="replay">Replay</button>
        ${nextScenario ? `<button type="button" class="gx-pill gx-pill--go" data-gx="try" data-scenario="${nextScenario.id}">Try: ${esc(nextScenario.label)}</button>` : ''}
        <button type="button" class="gx-pill gx-pill--ghost" data-gx="close">Library</button>
      </div>
    </div>`;
  renderTimeline();
  screen.querySelector('[data-gx="try"], [data-gx="replay"]')?.focus();
}

// ---------- side panels ----------

function renderSide(beat) {
  const c = G.c;
  const side = $('.gx-side');
  const control = resolved().control;
  $('.gx-level').textContent = resolved().level;
  if (!beat) {
    side.innerHTML = `<section class="gx-panel"><h5>How to play</h5><ol class="gx-howto"><li>Press start. Each step plays out in the room.</li><li>At a call, choose what happens next. The episode then shows the call its policy made, and why.</li><li>Change the scenario at any time: one condition, one cut channel, or one mode.</li><li>Click a marker in the room to inspect it.</li></ol></section>${sourcesHtml(c)}`;
    return;
  }
  const flows = (beat.channels || []).map(ch => `<li><b>${arrow(ch)}</b>${esc(CH[ch]?.short || '')}</li>`).join('')
    + (beat.cut || []).map(ch => `<li class="is-cut"><b>${arrow(ch)}</b>Cut: no information delivered</li>`).join('');
  const memory = beat.memory || [];
  side.innerHTML = `
    <section class="gx-panel"><h5>Loop map</h5>${loopMap(beat, control?.type === 'cut' ? control.channel : null)}
      <ul class="gx-flows">${flows || '<li class="is-none">No channel active in this step</li>'}</ul></section>
    <section class="gx-panel"><h5>Shared conditions</h5>
      <div class="gx-conds">${CONDITIONS.map(id => `<button type="button" class="gx-cond${(beat.conditions || []).includes(id) ? ' is-on' : ''}" data-cond="${id}" aria-pressed="false">${ICONS[id] || ''}<span>${esc(COND[id]?.name || id)}</span></button>`).join('')}</div>
      <p class="gx-cond-def" hidden></p></section>
    <section class="gx-panel"><h5>Running state <i>z</i></h5>
      <ul class="gx-mem">${memory.length ? memory.map(m => `<li class="${m.fresh ? 'is-fresh' : ''}"><span class="gx-mem-k gx-mem-k--${m.kind}">${MEM_KIND[m.kind] || m.kind}</span>${esc(m.text)}</li>`).join('') : '<li class="is-none">Nothing is retained.</li>'}</ul></section>
    <section class="gx-panel"><h5>Implementation <i>θ</i></h5>
      <div class="gx-impl">${IMPL.map(([id, name]) => `<span class="gx-impl-i${(beat.impl || []).includes(id) ? ' is-on' : ''}">${ICONS[id] || ''}<span>${esc(name)}</span></span>`).join('')}</div>
      <p class="gx-theta">Mechanism <i>θ</i>: <b>${esc(beat.theta || 'not specified in this episode')}</b>${beat.evidence ? ` · evidence step: <b>${esc(beat.evidence.replace('_', ' '))}</b>` : ''}</p></section>
    ${sourcesHtml(c)}`;
}

function sourcesHtml(c) {
  return `<details class="gx-panel gx-sources"><summary>Sources and additions</summary>
    <p><b>From the paper.</b> ${esc(c.source)} ${c.works.map(w => `<button type="button" class="link-btn" data-paperwork="${w.key}">${esc(w.name)} ↗</button>`).join(' ')}</p>
    <p><b>Added for this episode.</b> ${esc(c.extension)} Your calls are compared with the policy the episode follows; a cut is a scripted contrast in the spirit of HALO’s run mode, not a run of the original system.</p></details>`;
}

function renderTimeline() {
  const beats = resolved().beats;
  const tl = $('.gx-timeline');
  tl.innerHTML = `<ol class="gx-dots">${beats.map((b, i) => {
    const call = G.calls[i];
    const cls = ['gx-dot', `gx-dot--${b.step}`, b.decision && b.decision.options.length > 1 ? 'is-call' : '', i === G.step && G.phase === 'beat' ? 'is-current' : '', i < G.step || G.phase === 'end' ? 'is-done' : '', b.varied || b.cut?.length ? 'is-varied' : '', call ? (call.match ? 'is-same' : 'is-diff') : ''].filter(Boolean).join(' ');
    return `<li><button type="button" class="${cls}" data-step="${i}" ${G.phase === 'title' ? 'disabled' : ''} aria-label="Step ${i + 1}: ${esc(b.title)}${b.decision ? ' (a call)' : ''}"><span></span></button></li>`;
  }).join('')}</ol>
  <p class="gx-legend"><span><i class="gx-key gx-key--call"></i>A call</span><span><i class="gx-key gx-key--varied"></i>Changed by the scenario</span></p>`;
}

// ---------- inspect ----------

function inspect(id) {
  if (!G?.scene) return;
  const info = G.scene.inspect(id, Math.max(0, G.step), G.ctl);
  const card = $('.gx-card');
  if (!info) { card.hidden = true; return; }
  card.innerHTML = `<p class="gx-card-tag">${esc(info.tag)}</p><p class="gx-card-title">${esc(info.title)}</p><p>${esc(info.text)}</p><button type="button" class="gx-card-x" data-gx="uncard" aria-label="Close">${ICONS.close}</button>`;
  card.hidden = false;
}

// ---------- events ----------

function onClick(event) {
  const el = event.target.closest('button, [data-gx]');
  if (!el || !G) return;
  const act = el.dataset.gx;
  if (act === 'close') { leaveEpisode(); return; }
  if (act === 'start') { start(); return; }
  if (act === 'next') { next(); return; }
  if (act === 'prev') { prev(); return; }
  if (act === 'uncard') { $('.gx-card').hidden = true; return; }
  if (act === 'replay') { G.calls = {}; goTo(0); return; }
  if (act === 'try') { setScenario(el.dataset.scenario); G.calls = {}; if (G.phase !== 'beat') goTo(0); return; }
  if (el.dataset.choice !== undefined) { choose(el.dataset.choice); return; }
  if (el.dataset.step !== undefined) { goTo(Number(el.dataset.step), { instant: true }); return; }
  if (el.dataset.paperwork) { openSheet({ type: 'paperwork', id: el.dataset.paperwork }, el); return; }
  if (el.dataset.cond) {
    const def = $('.gx-cond-def');
    const open = el.getAttribute('aria-pressed') === 'true';
    layer.querySelectorAll('.gx-cond').forEach(b => b.setAttribute('aria-pressed', 'false'));
    if (open) { def.hidden = true; return; }
    el.setAttribute('aria-pressed', 'true');
    def.textContent = COND[el.dataset.cond]?.text || '';
    def.hidden = false;
  }
}

function onKey(event) {
  if (!G) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    if (!$('.gx-card').hidden) { $('.gx-card').hidden = true; return; }
    leaveEpisode();
    return;
  }
  if (event.key === 'Tab') { trapFocus(event); return; }
  if (event.target.closest('select, input, textarea')) return;
  if (G.phase === 'title' && event.key === 'Enter' && !event.target.closest('button')) { event.preventDefault(); start(); return; }
  if (G.phase !== 'beat') return;
  const d = resolved().beats[G.step]?.decision;
  if (d && !G.calls[G.step] && /^[1-9]$/.test(event.key)) {
    const option = d.options[Number(event.key) - 1];
    if (option) { event.preventDefault(); choose(option); }
    return;
  }
  if (event.target.closest('button')) return;
  if (event.key === 'ArrowRight' || event.key === 'Enter') { event.preventDefault(); next(); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); prev(); }
}

function trapFocus(event) {
  const box = $('.gx');
  const focusable = [...box.querySelectorAll('button, select, input, summary, [href]')].filter(el => !el.disabled && el.offsetParent !== null && !el.closest('[hidden]'));
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
