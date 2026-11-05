// The guided walk, shared by both scenes: start and stop, speed (1×, 2×, 4×), and chapters you
// can skip or jump to. A story's script calls `await this.chapter(id)` at each scene. While
// skipping, pause() returns at once, walks and turns finish instantly and the glasses stay quiet,
// so the state at the next chapter is the one a full run reaches; only the waiting is dropped.

export const TOUR_ABORT = Symbol('tour-abort');
const PACE = 0.8;
const wrap = (a) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

/**
 * Add the guided-walk methods to a story class. `run` is the script (called with the story as
 * `this`); `finish` restores the free-mode state when the walk ends, however it ends.
 */
export function installTour(proto, { run, finish = null }) {
  proto.bindTourUi = function (chapters) {
    const hud = this.hud;
    this.chapters = chapters;
    this.speed = 1;
    hud.el('[data-tour]').addEventListener('click', () => (this.tour ? this.stopTour() : this.startTour()));
    hud.el('[data-speed]').addEventListener('click', () => this.cycleSpeed());
    hud.el('[data-skip]').addEventListener('click', () => this.skipChapter());
    hud.el('[data-chapters]').addEventListener('click', () => this.toggleChapterMenu());
    hud.el('[data-chapter-list]').addEventListener('click', (e) => {
      const id = e.target.closest('[data-chapter]')?.dataset.chapter;
      if (!id) return;
      this.toggleChapterMenu(false);
      this.goToChapter(id);
    });
  };

  proto.startTour = async function ({ skipUntil = null } = {}) {
    if (this.tour) return;
    const hud = this.hud;
    this.tour = { cancelled: false };
    this.chapterId = null;
    const btn = hud.el('[data-tour]');
    btn.textContent = this.t('stopTour');
    btn.classList.add('is-active');
    for (const sel of ['[data-speed]', '[data-skip]', '[data-chapters]']) hud.el(sel).hidden = false;
    hud.el('[data-glasses]').hidden = true;
    hud.el('[data-speed]').textContent = `${this.speed}×`;
    this.player.inputLocked = true;
    if (hud.sheetOpen) hud.closeSheet();
    if (skipUntil && skipUntil !== this.chapters[0]?.id) this.beginSkip(skipUntil);
    try {
      await run.call(this);
    } catch (error) {
      if (error !== TOUR_ABORT) console.error(error);
    } finally {
      this.endSkip();
      this.player.inputLocked = false;
      this.player.stop();
      this.tour = null;
      this.chapterId = null;
      finish?.call(this);
      btn.textContent = this.t('startTour');
      btn.classList.remove('is-active');
      for (const sel of ['[data-speed]', '[data-skip]', '[data-chapters]']) hud.el(sel).hidden = true;
      hud.el('[data-glasses]').hidden = false;
      this.toggleChapterMenu(false);
      if (this.restartTo) {
        const id = this.restartTo;
        this.restartTo = null;
        setTimeout(() => this.startTour({ skipUntil: id }), 0);
      }
    }
  };

  proto.stopTour = function () {
    if (!this.tour) return;
    this.tour.cancelled = true;
    this.player.stop();
    this.hud.caption(this.L({ en: 'Stopped. You are free to explore.', zh: '已停止，可以自由探索。' }), 3000);
  };

  /** Called by the script at the start of each scene. */
  proto.chapter = async function (id) {
    if (this.tour?.cancelled) throw TOUR_ABORT;
    this.chapterId = id;
    if (this.skipping && this.skipUntil === id) this.endSkip();
    this.renderChapters();
  };

  proto.beginSkip = function (until) {
    this.skipping = true;
    this.skipUntil = until;
    this.hud.muted = true;
    this.player.stop();
    this.hud.root.parentElement.classList.add('is-skipping');
  };

  proto.endSkip = function () {
    this.skipping = false;
    this.skipUntil = null;
    this.hud.muted = false;
    this.hud.root.parentElement.classList.remove('is-skipping');
  };

  /** Skip the rest of the current scene. */
  proto.skipChapter = function () {
    if (!this.tour || this.skipping) return;
    const i = this.chapters.findIndex(c => c.id === this.chapterId);
    this.beginSkip(this.chapters[i + 1]?.id ?? '__end');
  };

  proto.goToChapter = function (id) {
    if (!this.tour) { this.startTour({ skipUntil: id }); return; }
    const target = this.chapters.findIndex(c => c.id === id);
    const current = this.chapters.findIndex(c => c.id === this.chapterId);
    if (target > current) { this.beginSkip(id); return; }
    // Earlier scenes are replayed from the start at skip speed, so their state is rebuilt.
    this.restartTo = id;
    this.tour.cancelled = true;
    this.player.stop();
  };

  proto.cycleSpeed = function () {
    this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
    this.hud.el('[data-speed]').textContent = `${this.speed}×`;
  };

  proto.toggleChapterMenu = function (open) {
    const list = this.hud.el('[data-chapter-list]');
    const show = open ?? list.hidden;
    list.hidden = !show;
    this.hud.el('[data-chapters]').setAttribute('aria-expanded', String(show));
    if (show) this.renderChapters();
  };

  proto.renderChapters = function () {
    const L = this.L, list = this.hud.el('[data-chapter-list]');
    const i = this.chapters.findIndex(c => c.id === this.chapterId);
    this.hud.el('[data-chapters]').innerHTML = `${this.t('chapters')} <span class="chapter-count">${i + 1}/${this.chapters.length}</span>`;
    if (list.hidden) return;
    list.innerHTML = this.chapters.map((c, k) => `<button type="button" data-chapter="${c.id}" class="${k === i ? 'is-current' : k < i ? 'is-done' : ''}"><span>${L(c.time)}</span><span>${L(c.title)}</span></button>`).join('');
  };

  // -------------------------------------------------------------- script helpers
  proto.pause = async function (ms) {
    if (this.skipping) {
      await null;
      if (this.tour?.cancelled) throw TOUR_ABORT;
      return;
    }
    const end = performance.now() + ms * PACE / this.speed;
    while (performance.now() < end) {
      await new Promise(r => setTimeout(r, Math.min(120, end - performance.now())));
      if (this.tour?.cancelled) throw TOUR_ABORT;
      if (this.skipping) return;
    }
    if (this.tour?.cancelled) throw TOUR_ABORT;
  };

  /** Walk to a point (or arrive at once while skipping); `face` is a point [x, y, z] to look at. */
  proto.walk = async function (target, { face = null, speed = 1.9 } = {}) {
    if (this.skipping) {
      this.placeAt(target, face);
      return true;
    }
    const walking = this.player.walkTo(target, { face, speed: speed * this.speed });
    // A skip pressed mid-walk ends the walk where it was going.
    const ok = await Promise.race([walking, new Promise(r => { const t = setInterval(() => { if (this.skipping || this.tour?.cancelled) { clearInterval(t); r('skip'); } else if (!this.player.path && !this.player.arrive) { clearInterval(t); } }, 100); })]);
    if (this.tour?.cancelled) throw TOUR_ABORT;
    if (ok === 'skip') { this.placeAt(target, face); return true; }
    return ok;
  };

  proto.look = async function (point, duration = 0.8) {
    if (this.skipping) { this.faceNow(point); return; }
    await this.player.lookAt(point, duration / this.speed);
    if (this.tour?.cancelled) throw TOUR_ABORT;
  };

  proto.placeAt = function (target, face = null) {
    const p = this.player;
    const spot = p.nav?.nearestWalkable?.(target[0], target[1], 6) || target;
    p.stop();
    p.x = spot[0]; p.z = spot[1];
    p.groundY = p.groundAt(p.x, p.z);
    if (face) this.faceNow(face);
  };

  proto.faceNow = function (point) {
    const p = this.player;
    const dx = point[0] - p.x, dz = (point.length === 3 ? point[2] : point[1]) - p.z;
    p.cancelLook();
    p.yaw = wrap(Math.atan2(-dx, -dz));
    if (point.length === 3) p.pitch = Math.atan2(point[1] - (p.groundY + 1.64), Math.hypot(dx, dz));
  };
}
