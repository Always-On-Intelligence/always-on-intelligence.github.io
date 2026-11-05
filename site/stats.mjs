// Three numbers under the title, each with one plain line, in the manner of videoindex.org's stat strip.
// They come from the data the page exports from the paper's tables, so they follow every re-export.
import { loadData } from './systems.mjs';
import { loadWorks } from './works.mjs';
import { countUp, whenVisible } from './motion.mjs';

export async function mountStats(root) {
  if (!root) return;
  const [{ levels, read }, works] = await Promise.all([loadData(), loadWorks()]);
  const count = id => (levels.placements[id] || []).length;
  const firstOn = levels.levels.findIndex(l => l.checklist?.durability && l.checklist?.continuity);
  const values = {
    works: works.works.length,
    placed: levels.levels.reduce((n, l) => n + count(l.id), 0),
    on: levels.levels.slice(firstOn).reduce((n, l) => n + count(l.id), 0),
    read: read.counts.works,
    ms: read.counts.reported['M→S']
  };
  // the M→S line says it is the least reported channel only while the data says so
  const least = Math.min(...Object.values(read.counts.reported)) === values.ms;
  root.querySelectorAll('[data-stat-least]').forEach(el => { el.hidden = !least; });
  for (const el of root.querySelectorAll('[data-stat]')) {
    const value = values[el.dataset.stat];
    if (value === undefined) continue;
    if (el.classList.contains('stat-n')) whenVisible(el, () => countUp(el, value), 0.6);
    else el.textContent = String(value);
  }
}
