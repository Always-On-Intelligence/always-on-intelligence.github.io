// The Demo page hero: the island in real-time 3D (site/play/island.mjs). Every building carries a pin;
// hovering a building or its pin lifts the roof, clicking flies the camera into the building and opens
// its episode. The island stops drawing when it is off screen, behind an episode, or in a hidden tab.
// Without WebGL the hero keeps the illustration with the same pins.
import { cases } from './data/cases.mjs';
import { PINS } from './data/case-play.mjs';
import { domains, participants, horizons } from './data/regimes.mjs';
import { esc } from './systems.mjs';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const coarse = () => window.matchMedia?.('(pointer: coarse)').matches;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const NAME = Object.fromEntries([...domains, ...participants, ...horizons].map(x => [x.id, x.name]));
const pinHtml = c => `<button type="button" class="pg-pin" data-case-pin="${c.id}" aria-label="Play episode ${c.num}: ${esc(c.title)}"><b>${c.num}</b><span>${esc(c.title)}</span></button>`;
/**
 * The card above a hovered building: what the episode shows, and where it sits in the paper's
 * application space (interaction domain × participant scope, outcome horizon) and its level.
 */
const cardHtml = c => `<div class="pg-card3" aria-hidden="true">
    <p class="pg-card3-top"><span>Episode ${c.num}</span><span class="pg-card3-level" title="Level of loop closure">${c.level}</span></p>
    <p class="pg-card3-title">${esc(c.title)}</p>
    <p class="pg-card3-text">${esc(c.tagline)}</p>
    <p class="pg-card3-tags" title="Application setting: interaction domain, participant scope and outcome horizon"><b>Setting</b><span>${esc(NAME[c.domain] || c.domain)}</span><span>${esc(NAME[c.scope] || c.scope)}</span><span>${esc(NAME[c.horizon] || c.horizon)}</span></p>
    <p class="pg-card3-go">${coarse() ? 'Tap again to play' : 'Click to play'} <i aria-hidden="true">▶</i></p>
  </div>`;

/** The illustration with pins, used when the 3D island cannot run. */
function poster(stage) {
  stage.classList.add('is-poster');
  stage.innerHTML = `
    <div class="pg-island">
      <img class="pg-island-img" src="assets/play/island.webp" width="1672" height="941" alt="An island over the sea with one building for each episode.">
    </div>
    <div class="pg-island pg-pins">${cases.map(c => pinHtml(c).replace('class="pg-pin"', `class="pg-pin" style="left:${PINS[c.id][0]}%;top:${PINS[c.id][1]}%"`)).join('')}</div>`;
}

/**
 * Mount the island in hero (an element with a .pg-stage inside). onEnter(caseId, origin) opens an
 * episode. Returns a controller: { flyTo(id), reset(), pause(on), point(id) } (all no-ops for the poster).
 */
export async function mountIslandHero(hero, { onEnter }) {
  const stage = hero.querySelector('.pg-stage');
  const none = { flyTo: async () => null, reset() {}, pause() {}, point: () => null, live: false };
  let engine, islandMod;
  try {
    [engine, islandMod] = await Promise.all([import('./play/engine.mjs'), import('./play/island.mjs')]);
    if (!document.createElement('canvas').getContext('webgl2')) throw new Error('no WebGL 2');
  } catch (error) {
    console.warn('3D island unavailable, showing the illustration', error);
    poster(stage);
    return none;
  }
  const { createView, detectQuality } = engine;
  const quality = detectQuality();
  let island = null;
  let busy = false;   // true while the camera flies into a building
  let hot = null;     // the hovered building
  const view = createView(stage, {
    quality, fov: [30, 44], near: 1, far: 900, zoom: false, touchAction: 'pan-y',
    ao: { radius: 1.4, thickness: 2.6, scale: 1.1, distanceFallOff: 1.0 }, denoise: { radius: 7, samples: 8 },
    onPick: id => enter(id, pins.get(id)?.el.querySelector('button')),
    onHover: id => hover(id, 'scene')
  });
  try {
    island = islandMod.buildIsland(view, { ids: cases.map(c => c.id) });
  } catch (error) {
    console.error(error);
    view.dispose();
    poster(stage);
    return none;
  }

  // framing: the whole island, a little to the right of the copy on wide screens
  const home = island.overview;
  const limits = { theta: 0.55, phiMin: 0.82, phiMax: 1.2, rMin: 40, rMax: 120 };
  function fit(w, h, instant = false) {
    const aspect = w / h;
    const wide = aspect > 1.25 && w > 900;
    // far enough that the island (about 21 m either side of its centre) fits the width
    const vfov = (aspect < 1 ? 44 : 30) * Math.PI / 180;
    const half = Math.atan(Math.tan(vfov / 2) * aspect);
    const radius = Math.max(home.radius, 21 / Math.tan(half));
    view.setRig({ ...home, radius, limits }, { instant });
    view.setFrame(wide ? 0.13 : 0, wide ? 0.02 : 0, { instant });
  }
  view.setHome(home);
  view.onResize = (w, h) => { if (!busy) fit(w, h); };

  // pins above the buildings
  const pins = new Map();
  for (const c of cases) {
    const b = island.buildings.get(c.id);
    if (!b) continue;
    const label = view.label(b.pin, { className: 'pg-pin3', html: pinHtml(c) + cardHtml(c) });
    pins.set(c.id, label);
  }
  view.overlay.addEventListener('click', event => {
    const btn = event.target.closest('[data-case-pin]');
    if (btn) enter(btn.dataset.casePin, btn);
  });
  view.overlay.addEventListener('pointerover', event => {
    const btn = event.target.closest('[data-case-pin]');
    if (btn) hover(btn.dataset.casePin, 'pin');
  });
  view.overlay.addEventListener('pointerout', event => {
    const btn = event.target.closest('[data-case-pin]');
    if (btn && !btn.contains(event.relatedTarget)) hover(null, 'pin');
  });
  view.overlay.addEventListener('focusin', event => {
    const btn = event.target.closest('[data-case-pin]');
    if (btn) hover(btn.dataset.casePin, 'pin');
  });
  view.overlay.addEventListener('focusout', () => hover(null, 'pin'));

  function hover(id, from) {
    if (busy) return;
    if (hot === id) return;
    hot = id;
    island.hover(id);
    for (const [k, label] of pins) {
      label.el.classList.toggle('is-hot', k === id);
      if (k === id) place(label.el);
    }
    hero.classList.toggle('is-pointing', Boolean(id));
    if (from === 'pin') view.canvas.style.cursor = id ? 'pointer' : 'grab';
  }
  // keep the card inside the stage: below the pin near the top, shifted near the sides
  function place(el) {
    const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
    el.classList.toggle('is-below', r.top - s.top < 230);
    el.classList.toggle('is-left', s.right - r.right < 150);
    el.classList.toggle('is-right', r.left - s.left < 150);
  }

  function enter(id, origin) {
    if (busy || !id) return;
    // on touch screens the first tap shows the card, the second one plays
    if (coarse() && hot !== id) { hover(id, 'pin'); return; }
    onEnter(id, origin || null);
  }

  // drawing only while visible
  let visible = true, paused = false;
  const sync = () => { if (visible && !paused && !document.hidden) view.start(); else view.stop(); };
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { rootMargin: '80px' }).observe(hero);
  document.addEventListener('visibilitychange', sync);

  await view.warm();
  stage.classList.add('is-ready');
  sync();

  const project = v => {
    const p = v.clone().project(view.camera);
    const r = view.canvas.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  };
  return {
    live: true,
    /** Fly the camera into a building; resolves with its screen point once the camera is close. */
    async flyTo(id) {
      const b = island.buildings.get(id);
      if (!b) return null;
      busy = true;
      hero.classList.add('is-flying');
      island.hover(id);
      for (const [k, label] of pins) label.el.classList.toggle('is-hot', k === id);
      view.resetUser();
      view.setFrame(0, 0);
      view.setRig({ ...island.focus(id), limits: { ...limits, rMin: 6 } });
      if (!reduced()) {
        // the island breaks into bigger and bigger pixels as the camera closes in
        await sleep(160);
        await view.pixelate(0.05, 640, 6);
      }
      return project(b.focus);
    },
    /** Back to the overview, as if the page had just opened; with pixels, it resolves out of them. */
    reset({ pixels = false } = {}) {
      busy = false;
      hot = null;
      hero.classList.remove('is-flying', 'is-pointing');
      island.hover(null);
      for (const label of pins.values()) label.el.classList.remove('is-hot');
      view.resetUser();
      fit(view.size.width || stage.clientWidth, view.size.height || stage.clientHeight, true);
      if (pixels && !reduced()) { view.setPixelation(0.05); view.pixelate(1, 700, 6); }
      else view.setPixelation(1);
    },
    pause(on) { paused = on; sync(); },
    point(id) { const b = island.buildings.get(id); return b ? project(b.focus) : null; },
    view
  };
}
