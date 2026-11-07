// The Demo teaser on the paper's page. Hovering an episode in the list plays a short loop of the game
// itself (assets/play/preview/): the episode's one call, an option the assistant would not pick played
// out, then the assistant's own call, about 0.8 s each at normal speed, joined by cross-fades. Each clip is made once and kept, so going
// back to an episode plays at once.
// The episodes themselves only open on the Demo page, through "Open the demo".
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function mountTeaser(root) {
  const art = root.querySelector('.pg-teaser-art');
  const tag = art?.querySelector('.pg-teaser-tag');
  const list = root.querySelector('.pg-teaser-list');
  if (!art || !tag || !list) return;
  const clips = new Map();
  let current = null;
  // the first frames are small: fetch them when the teaser comes into view, so a hover shows at once
  new IntersectionObserver((entries, io) => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    for (const li of list.querySelectorAll('[data-preview]')) new Image().src = `assets/play/preview/${li.dataset.preview}.webp`;
  }, { rootMargin: '300px' }).observe(root);

  function clip(id) {
    if (clips.has(id)) return clips.get(id);
    const v = document.createElement('video');
    v.className = 'pg-teaser-video';
    v.muted = true; v.loop = true; v.playsInline = true;
    v.preload = 'auto';
    v.poster = `assets/play/preview/${id}.webp`;
    if (!reduced()) v.src = `assets/play/preview/${id}.mp4`;
    art.insertBefore(v, tag);
    clips.set(id, v);
    return v;
  }
  function show(id) {
    if (id === current) return;
    const prev = current ? clips.get(current) : null;
    current = id;
    for (const li of list.querySelectorAll('[data-preview]')) li.classList.toggle('is-on', li.dataset.preview === id);
    if (prev) { prev.classList.remove('is-on'); prev.pause(); }
    if (!id) { art.classList.remove('is-previewing'); return; }
    const v = clip(id);
    v.classList.add('is-on');
    if (!reduced()) { v.currentTime = 0; v.play().catch(() => {}); }
    tag.textContent = `Episode ${list.querySelector(`[data-preview="${id}"] b`)?.textContent || ''}`;
    art.classList.add('is-previewing');
  }
  list.addEventListener('pointerover', event => {
    const li = event.target.closest('[data-preview]');
    if (li) show(li.dataset.preview);
  });
  list.addEventListener('pointerleave', () => show(null));
}
