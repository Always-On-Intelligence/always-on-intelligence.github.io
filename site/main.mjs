// Entry point for the project page: mounts each interactive figure when present.
import { mountFramework, mountAdjacent } from './framework.mjs';
import { mountDefinitions } from './definitions.mjs';
import { mountHalo } from './halo.mjs';
import { mountApplications } from './applications.mjs';
import { mountLevels } from './levels.mjs';
import { mountWorks, loadWorks } from './works.mjs';
import { mountCases } from './cases.mjs';
import { mountTeaser } from './teaser.mjs';
import { loadData, systemDetailHtml, arrowNE } from './systems.mjs';
import { registerView } from './sheet.mjs';
import { mountStats } from './stats.mjs';
import { mountWall } from './wall.mjs';
import { mountReveal, mountNavRail, mountZoom } from './motion.mjs';
import { mountHeroAnim, mountTitleIntro } from './hero-anim.mjs';
import { loadLoops, loopHtml, mountLoopLinks } from './loopcard.mjs';
import { mountVideo } from './video.mjs';
import { mountTakeaways } from './takeaways.mjs';

// The system detail view is shared by the applications, the levels and HALO read mode.
registerView('work', key => {
  const data = loadedData;
  const item = data?.systems.get(key);
  const more = worksByKey.has(key) ? `<button type="button" class="link-btn" data-paperwork="${key}">Every table in the paper that cites it ${arrowNE}</button>` : '';
  const loop = loopHtml(worksByKey.get(key), loops);
  return `<div class="sheet-body sheet-body--detail"><!--back-->${item ? systemDetailHtml(item, { levels: data.levels, loop }) : '<p>This system is not in the exported tables.</p>'}${more}</div>`;
});
let loadedData = null;
let worksByKey = new Map();
let loops = null;
loadData().then(data => { loadedData = data; }).catch(() => {});
loadWorks().then(data => { worksByKey = new Map(data.works.map(w => [w.key, w])); }).catch(() => {});
loadLoops().then(data => { loops = data; }).catch(() => {});
mountLoopLinks();

const mounts = [
  ['.props', mountDefinitions],
  ['[data-framework]', mountFramework],
  ['[data-adjacent]', mountAdjacent],
  ['[data-halo]', mountHalo],
  ['[data-applications]', mountApplications],
  ['[data-levels]', mountLevels],
  ['[data-works]', mountWorks],
  ['[data-cases]', mountCases],
  ['.pg-teaser', mountTeaser],
  ['[data-hero-anim]', mountHeroAnim],
  ['.hero-head .title', mountTitleIntro],
  ['[data-video]', mountVideo],
  ['[data-stats]', mountStats],
  ['[data-wall]', mountWall],
  ['.tk-grid', mountTakeaways]
];

for (const [selector, mount] of mounts) {
  const el = document.querySelector(selector);
  if (!el) continue;
  Promise.resolve()
    .then(() => mount(el))
    .catch(error => console.error(`Could not mount ${selector}`, error));
}

// Sticky bar border and current-section highlight.
const topbar = document.querySelector('.topbar');
const onScroll = () => topbar?.classList.toggle('is-scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

const links = [...document.querySelectorAll('.nav a[href^="#"]')];
const sections = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
if ('IntersectionObserver' in window && sections.length) {
  const io = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      links.forEach(a => a.classList.toggle('is-current', a.getAttribute('href') === `#${entry.target.id}`));
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => io.observe(s));
}
mountNavRail(document.querySelector('.nav'));
mountReveal();
mountZoom();

// Copy BibTeX: the BibTeX tile under the title and the button in the citation box copy in place.
// Only the [data-copy-label] part changes to "Copied", so the tile keeps its icon.
document.querySelectorAll('[data-copy]').forEach(button => {
  const label = button.querySelector('[data-copy-label]') || button;
  const idle = label.textContent;
  let timer;
  button.addEventListener('click', async () => {
    const target = document.querySelector(button.dataset.copy);
    if (!target) return;
    const text = target.textContent.trim();
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.append(area);
      area.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      area.remove();
    }
    label.textContent = ok ? 'Copied' : 'Copy failed';
    button.classList.toggle('is-copied', ok);
    clearTimeout(timer);
    timer = setTimeout(() => { label.textContent = idle; button.classList.remove('is-copied'); }, 1600);
  });
});
