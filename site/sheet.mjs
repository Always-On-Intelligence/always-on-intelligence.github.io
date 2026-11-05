// One glass sheet for the whole page: opens from the element that was clicked,
// keeps a back stack, traps focus, and returns focus when it closes.

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
let layer = null;
let sheet = null;
let scroll = null;
let scrim = null;
let opener = null;
let stack = [];
let current = null;
const renderers = new Map();

function ensure() {
  if (layer) return;
  layer = document.createElement('div');
  layer.className = 'sheet-layer';
  layer.hidden = true;
  layer.innerHTML = `
    <div class="sheet-scrim" data-sheet-close></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1">
      <button type="button" class="sheet-close" data-sheet-close aria-label="Close">✕</button>
      <div class="sheet-scroll"></div>
    </div>`;
  document.body.append(layer);
  sheet = layer.querySelector('.sheet');
  scroll = layer.querySelector('.sheet-scroll');
  scrim = layer.querySelector('.sheet-scrim');
  layer.addEventListener('click', event => {
    const t = event.target.closest('button, [data-sheet-close]');
    if (!t) return;
    if (t.hasAttribute('data-sheet-close')) { closeSheet(); return; }
    if (t.hasAttribute('data-sheet-back')) { back(); return; }
    for (const [attr, render] of renderers) {
      if (t.dataset[attr] !== undefined) {
        pushView({ type: attr, id: t.dataset[attr] }, render);
        return;
      }
    }
  });
  document.addEventListener('keydown', event => {
    if (layer.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); closeSheet(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...sheet.querySelectorAll('button, a[href]')].filter(el => !el.disabled && el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
}

/** Register how a view type renders; buttons with data-<attr>="id" inside the sheet open it. */
export function registerView(attr, render) {
  renderers.set(attr, render);
}

function paint(html, animate) {
  scroll.innerHTML = html;
  scroll.scrollTop = 0;
  if (animate && !reduceMotion()) {
    scroll.animate([{ opacity: 0, transform: 'translateX(14px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
}

function render(view) {
  const fn = renderers.get(view.type);
  const html = fn ? fn(view.id) : '';
  return stack.length ? html.replace('<!--back-->', '<button type="button" class="link-btn back" data-sheet-back>← Back</button>') : html.replace('<!--back-->', '');
}

function pushView(view) {
  if (current) stack.push(current);
  current = view;
  paint(render(view), true);
}

function back() {
  const prev = stack.pop();
  if (!prev) return;
  current = prev;
  paint(render(prev), true);
}

export function openSheet(view, fromEl) {
  ensure();
  opener = fromEl || document.activeElement;
  stack = [];
  current = view;
  layer.hidden = false;
  document.documentElement.classList.add('has-sheet');
  paint(render(view), false);
  sheet.focus({ preventScroll: true });
  if (reduceMotion() || !fromEl) return;
  const to = sheet.getBoundingClientRect();
  const from = fromEl.getBoundingClientRect();
  const s = Math.max(0.2, Math.min(1, from.width / to.width));
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  sheet.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.35, filter: 'blur(6px)' },
    { transform: 'none', opacity: 1, filter: 'blur(0)' }
  ], { duration: 560, easing: 'cubic-bezier(.2,.85,.25,1)' });
  scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, easing: 'ease-out' });
}

export function refreshSheet() {
  if (layer && !layer.hidden && current) paint(render(current), false);
}

export function closeSheet() {
  if (!layer || layer.hidden) return;
  const finish = () => {
    layer.hidden = true;
    document.documentElement.classList.remove('has-sheet');
    opener?.focus?.({ preventScroll: true });
  };
  if (reduceMotion()) { finish(); return; }
  const anim = sheet.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(12px) scale(.97)', opacity: 0 }], { duration: 220, easing: 'ease-in' });
  scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220 });
  anim.onfinish = finish;
}
