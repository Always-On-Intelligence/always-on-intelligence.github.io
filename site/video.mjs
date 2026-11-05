// The survey video under the title. On big screens it is shown whole on the first screen, and on laptops it
// takes the full page column (site.css, .teaser--video). It never plays by itself: its opening frame waits
// with one play button, so it plays with its music only when asked, and pressing play brings it into view.
// Without this script the video keeps the browser's own controls.

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountVideo(root) {
  const video = root.querySelector('video');
  const button = root.querySelector('[data-video-play]');
  if (!video || !button) return;
  video.controls = false;
  button.hidden = false;
  const figure = root.closest('figure') || root;
  // Show the video whole on the first screen when the room left there gives at least 640px of width.
  const fit = () => {
    const top = figure.getBoundingClientRect().top + window.scrollY;
    const room = Math.max(0, Math.round(window.innerHeight - top - 16));
    figure.style.setProperty('--video-room', `${room}px`);
    figure.classList.toggle('is-fit', room * 16 / 9 >= 640);
  };
  fit();
  document.fonts?.ready.then(fit);
  window.addEventListener('resize', fit, { passive: true });

  button.addEventListener('click', () => {
    root.classList.add('is-playing');
    video.controls = true;
    video.play().catch(() => {});
    const box = figure.getBoundingClientRect();
    if (box.top < 64 || box.bottom > window.innerHeight) figure.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'center' });
  });
}
