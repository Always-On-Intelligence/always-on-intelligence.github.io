// The title banner as a loop that keeps running, like a short GIF: a streak of light runs along the arrows
// the banner draws, from what the glasses observe into memory, from memory to an action, and from the
// action to the people it helps; each icon rings as the light reaches it, and then the loop starts again.
// Everything is drawn in the banner's own pixels (viewBox 0 0 2172 724). The loop rests while the title
// is off screen or the tab is hidden, and does not run under prefers-reduced-motion.

const NS = 'http://www.w3.org/2000/svg';
const PERIOD = 5600;
const SAGE = '#6f9a7c', ROSE = '#c98376', BLUE = '#6b8fc4', GOLD = '#d9a93a';
// one leg per drawn arrow: when the light leaves and arrives (ms into the loop), and its colours
const LEGS = [
  { path: 'sense', t0: 350, t1: 1850, from: SAGE, to: ROSE },
  { path: 'remember', t0: 1950, t1: 3050, from: ROSE, to: BLUE },
  { path: 'act', t0: 3150, t1: 4050, from: BLUE, to: BLUE }
];
// rings where the light starts or arrives: centre and radius in banner pixels, colour, time
const RINGS = [
  { x: 380, y: 222, r: 30, c: GOLD, t: 80 },        // the glasses notice something
  { x: 483, y: 277, r: 50, c: SAGE, t: 260 },       // a scene
  { x: 510, y: 358, r: 38, c: SAGE, t: 420 },       // a remark
  { x: 592, y: 424, r: 38, c: SAGE, t: 580 },       // an observation
  { x: 950, y: 426, r: 92, c: ROSE, t: 1850 },      // memory keeps it
  { x: 1562, y: 386, r: 80, c: BLUE, t: 3050 },     // an action is chosen
  { x: 1835, y: 391, r: 36, c: GOLD, t: 4050 }      // and reaches the people it helps
];
const TRAIL = 170, RING_MS = 1000;

const ease = t => (t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
function el(name, attrs) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

export function mountHeroAnim(svg) {
  if (!svg) return;
  if (/[?&]heroDebug\b/.test(location.search)) svg.classList.add('ha-debug');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const defs = el('defs', {});
  svg.prepend(defs);
  const legs = LEGS.map((leg, i) => {
    const path = svg.querySelector(`[data-path="${leg.path}"]`);
    const length = path.getTotalLength();
    const a = path.getPointAtLength(0), b = path.getPointAtLength(length);
    // the streak changes colour along the arrow, as the drawn arrow does
    const grad = el('linearGradient', { id: `ha-grad-${i}`, gradientUnits: 'userSpaceOnUse', x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    grad.append(el('stop', { offset: 0, 'stop-color': leg.from }), el('stop', { offset: 1, 'stop-color': leg.to }));
    defs.append(grad);
    const trail = el('path', { d: path.getAttribute('d'), class: 'ha-trail', stroke: `url(#ha-grad-${i})`, 'stroke-dasharray': `${TRAIL} ${length + TRAIL}`, opacity: 0 });
    const head = el('g', { opacity: 0 });
    const glow = el('circle', { r: 24, class: 'ha-glow', fill: `url(#ha-grad-${i})` });
    const core = el('circle', { r: 10, class: 'ha-core' });
    head.append(glow, core);
    svg.append(trail, head);
    return { ...leg, path, length, trail, head, core };
  });
  const rings = RINGS.map(ring => {
    const node = el('circle', { cx: ring.x, cy: ring.y, r: ring.r, class: 'ha-ring', stroke: ring.c });
    svg.insertBefore(node, defs.nextSibling);
    return { ...ring, node };
  });

  function frame(now) {
    const t = now % PERIOD;
    for (const leg of legs) {
      const p = (t - leg.t0) / (leg.t1 - leg.t0);
      if (p < 0 || p > 1.15) { leg.trail.setAttribute('opacity', 0); leg.head.setAttribute('opacity', 0); continue; }
      const along = leg.length * ease(Math.min(p, 1));
      // the streak ends at the head and fades out shortly after it arrives
      const fade = p > 1 ? 1 - (p - 1) / .15 : Math.min(1, p / .08);
      leg.trail.setAttribute('stroke-dashoffset', (TRAIL - along).toFixed(1));
      leg.trail.setAttribute('opacity', (.85 * fade).toFixed(3));
      const at = leg.path.getPointAtLength(along);
      leg.head.setAttribute('transform', `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`);
      leg.head.setAttribute('opacity', fade.toFixed(3));
    }
    for (const ring of rings) {
      const p = (t - ring.t) / RING_MS;
      if (p < 0 || p > 1) { ring.node.style.opacity = 0; continue; }
      ring.node.setAttribute('r', (ring.r * (.9 + .5 * (1 - (1 - p) ** 3))).toFixed(1));
      ring.node.style.opacity = (.9 * (1 - p)).toFixed(3);
    }
  }

  let raf = 0, visible = true;
  const loop = now => { frame(now); raf = requestAnimationFrame(loop); };
  const sync = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    if (visible && !document.hidden) raf = requestAnimationFrame(loop);
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }).observe(svg);
  }
  document.addEventListener('visibilitychange', sync);
  sync();
}

// The title on every load: a streak of light, drawn like the banner's, sweeps in a low arc under
// "Always-" and rises into "On", which then flashes and rings once, as the banner's icons ring when
// its light reaches them. The streak is placed from the rendered glyphs, so it waits for the fonts.
const INTRO = { start: 650, travel: 1050, ring: 1000 };

export function mountTitleIntro(title) {
  if (!title || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const accent = title.querySelector('.title-accent');
  const on = title.querySelector('.title-on');
  if (!accent || !on) return;
  const begin = performance.now();
  const fonts = document.fonts?.ready ?? Promise.resolve();
  Promise.race([fonts, new Promise(resolve => setTimeout(resolve, 1200))]).then(() => {
    setTimeout(() => playIntro(title, accent, on), Math.max(0, INTRO.start - (performance.now() - begin)));
  });
}

function playIntro(title, accent, on) {
  const box = title.getBoundingClientRect();
  const a = accent.getBoundingClientRect();
  const o = on.getBoundingClientRect();
  const fs = parseFloat(getComputedStyle(title).fontSize);
  const x = v => v - box.left, y = v => v - box.top;
  // from under the start of "Always" through a shallow arc that stays clear of the second line, up into the foot of "On"
  const base = y(o.top) + o.height * .8;
  const x0 = x(a.left) + fs * .04, x1 = x(o.left) + o.width * .5;
  const d = `M ${x0} ${base + fs * .08} C ${x0 + (x1 - x0) * .4} ${base + fs * .3}, ${x1 - fs * .6} ${base + fs * .28}, ${x1} ${base - fs * .04}`;
  const center = { x: x(o.left) + o.width / 2, y: y(o.top) + o.height * .52 };

  const svg = el('svg', { class: 'ti', width: box.width, height: box.height, viewBox: `0 0 ${box.width} ${box.height}`, 'aria-hidden': 'true' });
  const grad = el('linearGradient', { id: 'ti-grad', gradientUnits: 'userSpaceOnUse', x1: x0, y1: base, x2: x1, y2: base });
  grad.append(el('stop', { offset: 0, 'stop-color': '#e6c46e' }), el('stop', { offset: 1, 'stop-color': GOLD }));
  const defs = el('defs', {});
  defs.append(grad);
  const path = el('path', { d, fill: 'none', stroke: 'none' });
  svg.append(defs, path);
  const length = path.getTotalLength();
  const trailLength = Math.min(length * .55, fs * 2.4);
  const trail = el('path', { d, class: 'ti-trail', stroke: 'url(#ti-grad)', 'stroke-width': (fs * .075).toFixed(1), 'stroke-dasharray': `${trailLength} ${length + trailLength}`, opacity: 0 });
  const head = el('g', { opacity: 0 });
  head.append(el('circle', { r: (fs * .17).toFixed(1), class: 'ti-glow' }), el('circle', { r: (fs * .065).toFixed(1), class: 'ti-core' }));
  const rings = [0, 220].map(delay => ({ delay, node: el('circle', { cx: center.x, cy: center.y, class: 'ti-ring', opacity: 0 }) }));
  svg.append(trail, ...rings.map(r => r.node), head);
  title.append(svg);

  let flashed = false;
  const t0 = performance.now();
  const frame = now => {
    const t = now - t0;
    const p = t / INTRO.travel;
    if (p <= 1.25) {
      const along = length * ease(Math.min(p, 1));
      const fade = p > 1 ? 1 - (p - 1) / .25 : Math.min(1, p / .1);
      trail.setAttribute('stroke-dashoffset', (trailLength - along).toFixed(1));
      trail.setAttribute('opacity', (.9 * fade).toFixed(3));
      const at = path.getPointAtLength(along);
      head.setAttribute('transform', `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`);
      head.setAttribute('opacity', fade.toFixed(3));
    } else {
      trail.setAttribute('opacity', 0);
      head.setAttribute('opacity', 0);
    }
    if (p >= 1 && !flashed) {
      flashed = true;
      on.classList.add('is-flash');
      on.addEventListener('animationend', () => on.classList.remove('is-flash'), { once: true });
    }
    for (const ring of rings) {
      const q = (t - INTRO.travel - ring.delay) / INTRO.ring;
      if (q < 0 || q > 1) { ring.node.setAttribute('opacity', 0); continue; }
      ring.node.setAttribute('r', (fs * (.42 + .62 * (1 - (1 - q) ** 3))).toFixed(1));
      ring.node.setAttribute('stroke-width', (fs * .05 * (1 - q) + 1).toFixed(1));
      ring.node.setAttribute('opacity', (.85 * (1 - q)).toFixed(3));
    }
    if (t < INTRO.travel + 220 + INTRO.ring) requestAnimationFrame(frame);
    else svg.remove();
  };
  requestAnimationFrame(frame);
}
