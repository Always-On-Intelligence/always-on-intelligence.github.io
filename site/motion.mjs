// Motion modelled on the two reference pages: content rises a few pixels into place once it scrolls
// into view (videoindex.org), the current section's link carries a sliding rail and the paper's figures
// open full size (frontier-cs.org), and numbers count up the first time they are seen.
// Nothing moves under prefers-reduced-motion.

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Blocks that rise into place. Siblings matched by one selector rise one after another.
const REVEAL = ['.section-head', '.teaser', '.contribs > li', '.stats > .stat', '.open-grid > .open-card', '.faq details', '.works-intro .wall'];

/** Calls fn once, the first time el is at least partly in view. */
export function whenVisible(el, fn, threshold = 0.4) {
  if (!('IntersectionObserver' in window)) { fn(); return; }
  const io = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { io.disconnect(); fn(); }
  }, { threshold });
  io.observe(el);
}

/** Counts el's text up from zero to value. */
export function countUp(el, value, duration = 800) {
  if (still() || !value) { el.textContent = String(value); return; }
  const start = performance.now();
  const step = now => {
    const t = Math.min(1, (now - start) / duration);
    el.textContent = String(Math.round(value * (1 - (1 - t) ** 3)));
    if (t < 1) requestAnimationFrame(step);
  };
  el.textContent = '0';
  requestAnimationFrame(step);
}

export function mountReveal() {
  if (still() || !('IntersectionObserver' in window)) return;
  const items = [];
  for (const selector of REVEAL) {
    document.querySelectorAll(selector).forEach(el => {
      const group = [...el.parentElement.children].filter(c => c.matches(selector));
      items.push([el, group.length > 1 ? group.indexOf(el) : 0]);
    });
  }
  if (!items.length) return;
  document.documentElement.classList.add('motion');
  const t0 = performance.now();
  const done = el => { el.classList.remove('rv', 'is-in'); el.style.transitionDelay = ''; };
  const io = new IntersectionObserver(entries => {
    // what is on screen at load waits for the title to settle first
    const base = performance.now() - t0 < 500 ? 220 : 0;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      io.unobserve(el);
      el.style.transitionDelay = `${base + Math.min(Number(el.dataset.rvIndex) || 0, 8) * 70}ms`;
      el.classList.add('is-in');
      // afterwards the block keeps its own hover transitions
      const end = event => { if (event.target === el) { el.removeEventListener('transitionend', end); done(el); } };
      el.addEventListener('transitionend', end);
      setTimeout(() => done(el), 1600);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  for (const [el, index] of items) {
    el.dataset.rvIndex = index;
    el.classList.add('rv');
    io.observe(el);
  }
  addEventListener('beforeprint', () => items.forEach(([el]) => done(el)));
}

/** A rail under the nav that slides to the link of the section in view. */
export function mountNavRail(nav) {
  if (!nav) return;
  const rail = document.createElement('i');
  rail.className = 'nav-rail';
  rail.setAttribute('aria-hidden', 'true');
  nav.append(rail);
  const move = () => {
    const a = nav.querySelector('a.is-current');
    rail.classList.toggle('is-on', Boolean(a));
    if (!a) return;
    rail.style.width = `${a.offsetWidth - 20}px`;
    rail.style.transform = `translateX(${a.offsetLeft + 10}px)`;
  };
  new MutationObserver(move).observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] });
  addEventListener('resize', move);
  document.fonts?.ready.then(move);
  move();
}

/** Clicking a figure marked data-zoom opens it at the largest size the window allows. */
export function mountZoom() {
  document.addEventListener('click', event => {
    const img = event.target.closest('img[data-zoom]');
    if (img && !event.defaultPrevented) open(img);
  });
}

function open(img) {
  const from = img.getBoundingClientRect();
  const ratio = (img.naturalWidth && img.naturalHeight) ? img.naturalWidth / img.naturalHeight : from.width / from.height;
  const margin = innerWidth < 700 ? 12 : 40;
  const w = Math.min(innerWidth - 2 * margin, (innerHeight - 2 * margin) * ratio, img.naturalWidth || Infinity);
  const h = w / ratio;
  const left = (innerWidth - w) / 2;
  const top = (innerHeight - h) / 2;

  const overlay = document.createElement('div');
  overlay.className = 'zoom-overlay';
  const big = document.createElement('img');
  big.className = 'zoom-img';
  big.src = img.currentSrc || img.src;
  big.alt = img.alt;
  Object.assign(big.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` });
  document.body.append(overlay, big);
  img.style.visibility = 'hidden';

  const fromTransform = `translate(${from.left - left}px, ${from.top - top}px) scale(${from.width / w})`;
  const timing = { duration: 320, easing: 'cubic-bezier(.2, 0, .2, 1)' };
  if (!still()) {
    big.animate([{ transform: fromTransform }, { transform: 'none' }], timing);
    overlay.animate([{ opacity: 0 }, { opacity: 1 }], timing);
  }

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    removeEventListener('keydown', onKey);
    removeEventListener('scroll', close);
    const finish = () => { overlay.remove(); big.remove(); img.style.visibility = ''; };
    if (still()) { finish(); return; }
    const now = img.getBoundingClientRect();
    big.animate([{ transform: 'none' }, { transform: `translate(${now.left - left}px, ${now.top - top}px) scale(${now.width / w})` }], { ...timing, duration: 260, fill: 'forwards' });
    overlay.animate([{ opacity: 1 }, { opacity: 0 }], { ...timing, duration: 260, fill: 'forwards' }).onfinish = finish;
  };
  const onKey = event => { if (event.key === 'Escape') close(); };
  overlay.addEventListener('click', close);
  big.addEventListener('click', close);
  addEventListener('keydown', onKey);
  addEventListener('scroll', close, { passive: true });
}
