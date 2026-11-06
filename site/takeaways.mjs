// Takeaway cards: a click opens the card as a larger card over the page. It grows lightly out of the card that
// was clicked and holds the reasoning and evidence of the card's disclosure. Without scripts the disclosure still
// opens in place. Esc, ✕ or a click outside closes it, and focus goes back to the card. Nothing moves under
// reduced motion.

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const OPEN = { duration: 260, easing: 'cubic-bezier(.2, .8, .2, 1)' };
const CLOSE = { duration: 180, easing: 'cubic-bezier(.4, 0, .9, .6)', fill: 'forwards' };

export function mountTakeaways(grid) {
  const cards = [...grid.querySelectorAll(':scope > .tk-card')];
  if (!cards.length || typeof HTMLDialogElement !== 'function') return;

  const dialog = document.createElement('dialog');
  dialog.className = 'tk-dialog';
  dialog.setAttribute('aria-labelledby', 'tk-dialog-title');
  dialog.innerHTML = '<div class="tk-dialog-scrim" data-tk-close></div>'
    + '<article class="tk-dialog-card" tabindex="-1">'
    + '<button type="button" class="tk-dialog-close" data-tk-close aria-label="Close">✕</button>'
    + '<div class="tk-dialog-body"></div></article>';
  grid.after(dialog);
  const panel = dialog.querySelector('.tk-dialog-card');
  const body = dialog.querySelector('.tk-dialog-body');
  const scrim = dialog.querySelector('.tk-dialog-scrim');

  // Each card's disclosure becomes a button, and its reasoning and evidence go into the larger card.
  const more = new Map();
  for (const card of cards) {
    const details = card.querySelector('.tk-more');
    if (!details) continue;
    const summary = details.querySelector('summary');
    more.set(card, [...details.children].filter(el => el !== summary).map(el => el.outerHTML).join(''));
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tk-open';
    button.setAttribute('aria-haspopup', 'dialog');
    button.textContent = summary?.textContent.trim() || 'Why and evidence';
    details.replaceWith(button);
    card.classList.add('is-openable');
  }

  let current = null;
  let closing = false;
  // From the larger card to the small one: the offset of their centres and the ratio of their widths.
  const toCard = card => {
    const from = card.getBoundingClientRect();
    const to = panel.getBoundingClientRect();
    const scale = Math.min(1, Math.max(0.5, from.width / to.width));
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    return `translate(${dx}px, ${dy}px) scale(${scale})`;
  };
  const settle = () => [panel, scrim].forEach(el => el.getAnimations().forEach(a => a.cancel()));

  const open = card => {
    if (dialog.open || !more.has(card)) return;
    current = card;
    const top = card.querySelector('.tk-top')?.outerHTML ?? '';
    const claim = card.querySelector('.tk-claim')?.innerHTML ?? '';
    body.innerHTML = `${top}<h2 class="tk-claim" id="tk-dialog-title">${claim}</h2>${more.get(card)}`;
    dialog.showModal();
    panel.scrollTop = 0;
    panel.focus({ preventScroll: true });
    if (still()) return;
    panel.animate([{ transform: toCard(card), opacity: 0 }, { opacity: 1, offset: 0.4 }, { transform: 'none', opacity: 1 }], OPEN);
    scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
  };

  const close = () => {
    if (!dialog.open || closing) return;
    const card = current;
    const finish = () => {
      dialog.close();
      card?.querySelector('.tk-open')?.focus({ preventScroll: true });
    };
    if (still() || !card) { finish(); return; }
    closing = true;
    settle();
    panel.animate([{ transform: 'none', opacity: 1 }, { transform: toCard(card), opacity: 0 }], CLOSE).onfinish = finish;
    scrim.animate([{ opacity: 1 }, { opacity: 0 }], CLOSE);
  };

  grid.addEventListener('click', event => {
    const card = event.target.closest('.tk-card');
    // a click that ends a text selection only selects
    if (card && !String(getSelection?.() ?? '').trim()) open(card);
  });
  dialog.addEventListener('click', event => { if (event.target.closest('[data-tk-close]')) close(); });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  // however it closed, the next opening starts clean
  dialog.addEventListener('close', () => { closing = false; settle(); });
}
