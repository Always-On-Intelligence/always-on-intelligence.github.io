// A tilted wall of the reviewed papers' first pages that drifts slowly upward, after the paper wall on
// frontier-cs.org. The pages are the ones the survey video uses (site/data/paper-pages.json lists the
// works; the images are assets/papers/<key>.jpg, from arXiv or the publishers' open-access PDFs).
// Hovering lifts a page off the wall, and clicking it opens the same sheet as the index below. The wall
// rests when it is off screen and stays still under prefers-reduced-motion; the index below remains the
// accessible way in.
import { loadWorks } from './works.mjs';
import { esc } from './systems.mjs';
import { openSheet } from './sheet.mjs';

const COLUMNS = 6;

// a fixed shuffle, so the wall looks the same on every visit
function shuffled(list) {
  const out = [...list];
  let seed = 7;
  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const page = w => `<button type="button" class="wp" tabindex="-1" data-paperwork="${esc(w.key)}" title="${esc(w.title)}">
  <img src="assets/papers/${esc(w.key)}.jpg" width="297" height="420" alt="" decoding="async">
</button>`;

export function mountWall(root) {
  if (!root) return;
  // the pages load only when the section comes near, and then all at once, so none drifts in blank
  if (!('IntersectionObserver' in window)) { build(root); return; }
  const io = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { io.disconnect(); build(root); }
  }, { rootMargin: '1200px 0px' });
  io.observe(root);
}

async function build(root) {
  const [{ works }, pages] = await Promise.all([
    loadWorks(),
    fetch(new URL('./data/paper-pages.json', import.meta.url)).then(r => r.json())
  ]);
  const byKey = new Map(works.map(w => [w.key, w]));
  const picked = shuffled(pages.keys.map(k => byKey.get(k)).filter(Boolean));
  const columns = Array.from({ length: COLUMNS }, (_, c) => picked.filter((_, i) => i % COLUMNS === c));
  // each column holds its pages twice, so drifting by half its height loops without a seam
  root.innerHTML = `<div class="wall-plane">${columns.map((col, c) => {
    const pages = col.map(page).join('');
    return `<div class="wall-col" style="--dur:${48 + (c % 3) * 6}s;--delay:${-c * 7}s">${pages}${pages}</div>`;
  }).join('')}</div>`;

  root.addEventListener('click', event => {
    const t = event.target.closest('[data-paperwork]');
    if (t) openSheet({ type: 'paperwork', id: t.dataset.paperwork }, t);
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      for (const e of entries) root.classList.toggle('is-resting', !e.isIntersecting);
    }).observe(root);
  }
}
