import * as THREE from 'three';
import { createRenderer, createStage, detectQuality, fitRenderer } from './engine/renderer.mjs';
import { makeL } from './eccv/i18n.mjs';

// Boots one scene (?scene=eccv, the default, or ?scene=ntu) and runs the shared loop,
// keyboard shortcuts and project-page messages.

const params = new URLSearchParams(location.search);
const sceneName = params.get('scene') === 'ntu' ? 'ntu' : 'eccv';
const quality = detectQuality(params.get('quality'));
const lang = params.get('lang') === 'zh' ? 'zh' : 'en';
const embedded = window.parent !== window;
const app = document.getElementById('app');
const canvas = document.getElementById('view');
const loading = document.getElementById('loading');
const stepText = loading.querySelector('[data-step]');
const bar = loading.querySelector('[data-bar]');
const L = makeL(lang);
document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';

function progress(text, fraction) {
  stepText.textContent = text;
  bar.style.width = `${Math.round(fraction * 100)}%`;
  // Let the label paint, without stalling when the tab is in the background (no rAF there).
  return new Promise(resolve => { requestAnimationFrame(resolve); setTimeout(resolve, 60); });
}

async function loadFonts() {
  const faces = ['400 16px "IBM Plex Sans"', '500 16px "IBM Plex Sans"', '600 16px "IBM Plex Sans"', '700 16px "IBM Plex Sans"', '500 16px "IBM Plex Mono"', '600 16px "Source Serif 4"'];
  try { await Promise.race([Promise.all(faces.map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 2500))]); } catch { /* system fonts */ }
}

let failedText = { en: 'The scene could not be loaded. ', zh: '场景加载失败。' };

async function main() {
  const mod = await import(`./${sceneName}/index.mjs`);
  const t = mod.makeT(lang);
  failedText = mod.meta.failed;
  document.title = L(mod.meta.title);
  if (mod.meta.aria) app.setAttribute('aria-label', L(mod.meta.aria));
  loading.querySelector('.loading-kicker').textContent = mod.meta.kicker;
  loading.querySelector('.loading-title').textContent = L(mod.meta.heading);
  await progress(L({ en: 'Loading fonts…', zh: '正在加载字体…' }), 0.08);
  await loadFonts();

  const renderer = createRenderer(canvas, quality);
  const { scene, camera } = createStage(renderer, mod.stageOptions);
  const world = await mod.boot({ THREE, renderer, scene, camera, app, canvas, hudRoot: document.getElementById('hud'), t, L, lang, quality, params, progress });
  const { player, story, hud } = world;
  fitRenderer(renderer, camera, app);
  window.addEventListener('resize', () => fitRenderer(renderer, camera, app));

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      if (hud.sheetOpen) hud.closeSheet();
      else if (world.mapOpen) world.closeMap();
      else if (player.mode === 'overview') player.setOverview(false);
      else if (story.tour) story.stopTour();
      else if (embedded && gameMode) window.parent.postMessage({ type: 'always-on-exit-game' }, location.origin);
      return;
    }
    if (hud.sheetOpen) return;
    if (k === 'v') player.setOverview(player.mode !== 'overview');
    else if (k === 'm') (world.mapOpen ? world.closeMap() : world.openMap());
    else if (k === 't') (story.tour ? story.stopTour() : story.startTour());
    else if (k === 'h') app.classList.toggle('hud-hidden');
    else if (k === 'g' && !story.tour) story.setGlasses(!story.glassesOn);
    else if (k === 'e') world.interact?.();
    else if (k === 'n' && story.tour) story.skipChapter?.();
  });

  // Page integration: the project page wraps this frame in "game mode".
  let gameMode = false;
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin) return;
    if (event.data?.type === 'always-on-game-mode') gameMode = !!event.data.active;
  });

  // "Move the mouse to look around": shown at the start on devices with a mouse, until you have
  // looked around a little. The left edge of the 3D view, for turning at the edge, is right of the
  // side panel while the panel is open.
  const lookHint = hud.el('[data-lock-hint]');
  const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
  player.viewLeft = () => {
    const loop = hud.el('[data-loop]');
    if (!loop || loop.classList.contains('is-collapsed') || app.classList.contains('hud-hidden')) return 0;
    return loop.getBoundingClientRect().right;
  };
  let hintAt = 0, hintDone = false;

  const clock = new THREE.Clock();
  let first = true;
  const frame = () => {
    const dt = Math.min(0.05, clock.getDelta());
    const now = performance.now();
    world.update(dt, now);
    renderer.render(scene, camera);
    if (now - hintAt > 200) {
      hintAt = now;
      hintDone ||= player.mouseTurned > 0.8;
      lookHint.hidden = first || touchOnly || hintDone || story.tour || hud.sheetOpen || world.mapOpen;
    }
    if (first) {
      first = false;
      progress(L({ en: 'Ready', zh: '准备好了' }), 1).then(() => loading.classList.add('is-done'));
      if (embedded) window.parent.postMessage({ type: 'always-on-game-ready' }, location.origin);
      if (params.get('tour') === '1') setTimeout(() => story.startTour(), 900);
    }
  };
  // debugLoop=1 drives frames from a timer, for headless checks where rAF is paused.
  if (params.get('debugLoop') === '1') setInterval(frame, 33);
  else renderer.setAnimationLoop(frame);
  window.__world = { THREE, scene, camera, renderer, quality, sceneName, ...world, ...world.debug };
}

main().catch((error) => {
  console.error(error);
  stepText.textContent = L(failedText) + (error?.message || '');
});
