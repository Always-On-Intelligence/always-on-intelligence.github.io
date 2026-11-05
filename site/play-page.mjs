// Entry point for the Demo page (play.html): the island, the episode library and player, and the
// sheet that the players' source links open.
import { mountCases } from './cases.mjs';
import { registerWorkSheet } from './works.mjs';

registerWorkSheet().catch(error => console.error('Could not load the works index', error));
mountCases(document.querySelector('[data-cases]'));

const topbar = document.querySelector('.topbar');
const onScroll = () => topbar?.classList.toggle('is-scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();
