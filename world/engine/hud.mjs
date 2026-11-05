// Two layers on top of the 3D view.
// Right and centre: what the glasses show (dark glass): status, cards, alerts, brackets.
// Left: the framework view (paper style): Sensing, Memory and Action with their live state,
// the six channels as arrows, and a step list saying which policy decided what and why.

// Run once on the next frame, or after a short timeout when frames are paused (background tab).
const nextFrame = (fn) => {
  let done = false;
  const run = () => { if (!done) { done = true; fn(); } };
  requestAnimationFrame(run);
  setTimeout(run, 40);
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const CHANNEL_NAMES = { SA: 'S→A', SM: 'S→M', MA: 'M→A', AS: 'A→S', MS: 'M→S', AM: 'A→M' };

// Geometry of the loop diagram, laid out like Figure 1 of the paper: Memory above, Sensing
// bottom left, Action bottom right, the world underneath. Outer and inner arrows pair up.
const EDGES = {
  SM: { d: 'M40,99 L96,64', label: [52, 76] },
  MS: { d: 'M118,64 L62,99', label: [98, 90] },
  MA: { d: 'M220,64 L276,99', label: [262, 76] },
  AM: { d: 'M254,99 L198,64', label: [216, 90] },
  SA: { d: 'M139,118 L177,118', label: [158, 112] },
  AS: { d: 'M177,146 L139,146', label: [158, 158] },
};

export class Hud {
  constructor(root, { t, lang }) {
    this.root = root;
    this.t = t;
    this.lang = lang;
    this.zoneCooldown = new Map();
    this.edgeTimers = new Map();
    root.innerHTML = `
      <div class="lens" aria-hidden="true"></div>
      <div class="glasses-ui">
        <header class="status">
          <span class="brand"><span class="live-dot"></span>${esc(t('brand'))}</span>
          <span class="status-sep"></span>
          <span class="status-session" data-session></span>
          <span class="status-time" data-time></span>
          <span class="sensors">
            <span class="sensor" data-sensor="camera"><i></i>${esc(t('camera'))}</span>
            <span class="sensor" data-sensor="mic"><i></i>${esc(t('mic'))}</span>
            <span class="sensor sensor--privacy" title="${esc(t('privacyTip'))}"><i></i>${esc(t('privacy'))}</span>
          </span>
          <button type="button" class="contract-chip" data-contract data-interactive hidden></button>
        </header>
        <div class="zone" data-zone aria-hidden="true"><span></span></div>
        <div class="reticle" aria-hidden="true"></div>
        <div class="brackets" data-brackets aria-hidden="true"><i></i><i></i><i></i><i></i><b></b></div>
        <div class="side">
          <div class="toasts" data-toasts></div>
          <aside class="card" data-card data-interactive aria-live="polite" hidden></aside>
        </div>
        <div class="minimap" data-minimap data-interactive>
          <canvas width="360" height="360" data-minimap-canvas aria-label="${esc(t('mapLabel'))}"></canvas>
          <button type="button" class="map-expand" data-map-open>${esc(t('openMap'))} <kbd>M</kbd></button>
        </div>
      </div>
      <div class="off-banner" data-off-banner hidden>
        <strong>${esc(t('glassesOffTitle'))}</strong><span>${esc(t('glassesOffText'))}</span>
      </div>
      <div class="phone" data-phone hidden aria-live="polite">
        <div class="phone-notch"></div>
        <p class="phone-time" data-phone-time></p>
        <div class="phone-list" data-phone-list></div>
      </div>
      <aside class="loop" data-loop data-interactive>
        <button class="loop-head" type="button" data-loop-toggle aria-expanded="true">
          <span class="loop-title">${esc(t('loopTitle'))}</span>
          <span class="loop-sub">${esc(t('loopSub'))}</span>
        </button>
        <div class="loop-body">
          <div class="lp">
            <svg class="lp-svg" viewBox="0 0 316 206" role="presentation">
              <defs><marker id="lp-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="context-stroke"/></marker></defs>
              <path class="lp-io" d="M69,178 L69,164" marker-end="url(#lp-arrow)"/>
              <path class="lp-io" d="M247,164 L247,178" marker-end="url(#lp-arrow)"/>
              ${Object.entries(EDGES).map(([id, e]) => `<path class="lp-edge" data-edge="${id}" d="${e.d}" marker-end="url(#lp-arrow)"/><text class="lp-label" data-label="${id}" x="${e.label[0]}" y="${e.label[1]}" text-anchor="middle">${CHANNEL_NAMES[id]}</text>`).join('')}
            </svg>
            ${['M', 'S', 'A'].map(m => `<div class="lp-mod lp-mod--${m}" data-mod="${m}"><h4><i>${m}</i>${esc(t('mod' + m))}</h4><ul data-state="${m}"></ul></div>`).join('')}
            <div class="lp-world"><span>${esc(t('worldIn'))}</span><b>${esc(t('world'))}</b><span>${esc(t('worldOut'))}</span></div>
          </div>
          <p class="lp-legend"><span data-src="ego">${esc(t('srcEgo'))}</span><span data-src="target">${esc(t('srcTarget'))}</span><span data-src="ext">${esc(t('srcExt'))}</span></p>
          <ol class="trace-list" data-trace-list></ol>
        </div>
      </aside>
      <div class="dock" data-dock data-interactive>
        <div class="dock-tour">
          <button type="button" class="btn btn--primary" data-tour>${esc(t('startTour'))}</button>
          <button type="button" class="btn" data-speed hidden aria-label="${esc(t('speed'))}">1×</button>
          <button type="button" class="btn" data-skip hidden>${esc(t('skip'))} <kbd>N</kbd></button>
          <button type="button" class="btn" data-chapters hidden aria-expanded="false">${esc(t('chapters'))}</button>
          <button type="button" class="btn" data-overview>${esc(t('overview'))} <kbd>V</kbd></button>
          <button type="button" class="btn" data-glasses>${esc(t('takeOff'))} <kbd>G</kbd></button>
          <button type="button" class="btn" data-trail>${esc(t('trail'))}</button>
          <button type="button" class="btn btn--icon" data-about aria-label="${esc(t('about'))}">i</button>
        </div>
        <p class="hint">${esc(t('hint'))}</p>
        <div class="chapter-list" data-chapter-list hidden></div>
      </div>
      <button type="button" class="interact" data-interact data-interactive hidden><span data-interact-label></span><kbd>E</kbd></button>
      <div class="voice" data-voice hidden><span class="voice-who" data-voice-who></span><span class="voice-text" data-voice-text></span></div>
      <div class="caption" data-caption hidden></div>
      <div class="lock-hint" data-lock-hint hidden><span>${esc(t('lockHint'))}</span></div>
      <div class="sheet" data-sheet hidden data-interactive>
        <div class="sheet-card" role="dialog" aria-modal="true" data-sheet-card></div>
      </div>
      <div class="fullmap" data-fullmap hidden data-interactive>
        <div class="fullmap-card">
          <header><strong>${esc(t('mapTitle'))}</strong><span>${esc(t('mapSub'))}</span><button type="button" class="btn" data-map-close>${esc(t('close'))} <kbd>Esc</kbd></button></header>
          <canvas data-fullmap-canvas></canvas>
        </div>
      </div>`;
    this.el = (sel) => root.querySelector(sel);
    this.card = this.el('[data-card]');
    this.traceList = this.el('[data-trace-list]');
    this.el('[data-loop-toggle]').addEventListener('click', () => {
      const loop = this.el('[data-loop]');
      const open = !loop.classList.toggle('is-collapsed');
      this.el('[data-loop-toggle]').setAttribute('aria-expanded', String(open));
    });
    this.traceList.addEventListener('click', (e) => {
      const row = e.target.closest('.ev-row');
      const more = row?.nextElementSibling;
      if (!more) return;
      more.hidden = !more.hidden;
      row.setAttribute('aria-expanded', String(!more.hidden));
    });
  }

  setStatus({ session, time }) {
    if (session !== undefined) this.el('[data-session]').textContent = session;
    if (time !== undefined) {
      this.el('[data-time]').textContent = time;
      this.el('[data-phone-time]').textContent = time;
    }
  }

  setContract(label, onOpen) {
    const chip = this.el('[data-contract]');
    chip.hidden = !label;
    chip.textContent = label || '';
    chip.onclick = onOpen || null;
  }

  pulseSensor(name, on = true) {
    this.el(`[data-sensor="${name}"]`)?.classList.toggle('is-active', on);
  }

  /** Live contents of the three modules; items are strings or {text, tone}. */
  setModules(state) {
    for (const m of ['S', 'M', 'A']) {
      const items = state[m];
      if (!items) continue;
      const key = JSON.stringify(items);
      const ul = this.el(`[data-state="${m}"]`);
      if (ul.dataset.key === key) continue;
      ul.dataset.key = key;
      ul.innerHTML = items.map(i => (typeof i === 'string' ? `<li>${esc(i)}</li>` : `<li class="is-${i.tone || 'plain'}">${esc(i.text)}</li>`)).join('');
    }
  }

  flashChannel(channel, module = null) {
    const nodes = channel ? [channel[0], channel[1]] : module ? [module] : [];
    const key = channel || module;
    if (!key) return;
    const targets = [
      channel && this.el(`[data-edge="${channel}"]`),
      channel && this.el(`[data-label="${channel}"]`),
      ...nodes.map(n => this.el(`[data-mod="${n}"]`)),
    ].filter(Boolean);
    targets.forEach(t => { t.classList.remove('is-on'); void t.getBoundingClientRect(); t.classList.add('is-on'); });
    clearTimeout(this.edgeTimers.get(key));
    this.edgeTimers.set(key, setTimeout(() => targets.forEach(t => t.classList.remove('is-on')), 2800));
  }

  /**
   * One step of the loop. kind: act | wait | update | request | boundary | revise | note.
   * src: ego (EgoPoster ships it) | target (the always-on form) | ext (self-evolving extension).
   */
  trace({ time, kind = 'note', channel = null, module = null, text, detail = '', src = 'ego', meta = {} }) {
    const t = this.t;
    const li = document.createElement('li');
    li.className = `ev ev--${kind}`;
    li.dataset.src = src;
    const chips = [];
    if (channel) chips.push(`<span class="chip" data-ch="${channel}">${CHANNEL_NAMES[channel]}</span>`);
    else if (module) chips.push(`<span class="chip" data-mod="${module}">${module}</span>`);
    const kindChip = { act: 'act', wait: 'wait', request: 'request', boundary: 'boundary', revise: 'revise' }[kind];
    if (kindChip) chips.push(`<span class="chip chip--${kindChip}">${esc(t('k_' + kindChip))}</span>`);
    chips.push(`<span class="src src--${src}">${esc(t(src === 'ext' ? 'srcExtShort' : src === 'target' ? 'srcTargetShort' : 'srcEgoShort'))}</span>`);
    const rows = [['policy', meta.policy], ['grounds', meta.grounds], ['condition', meta.condition], ['build', meta.build]].filter(([, v]) => v);
    li.innerHTML = `<button type="button" class="ev-row" aria-expanded="false" ${rows.length ? '' : 'disabled'}>
        <span class="ev-time">${esc(time || '')}</span>
        <span class="ev-main"><span class="ev-chips">${chips.join('')}</span><span class="ev-text">${esc(text)}</span>${detail ? `<small>${esc(detail)}</small>` : ''}${rows.length ? `<span class="ev-more-hint">${esc(t('howBuilt'))}</span>` : ''}</span>
      </button>${rows.length ? `<dl class="ev-more" hidden>${rows.map(([k, v]) => `<dt>${esc(t('m_' + k))}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}`;
    this.traceList.prepend(li);
    while (this.traceList.children.length > 60) this.traceList.lastElementChild.remove();
    nextFrame(() => li.classList.add('is-in'));
    this.flashChannel(channel, module);
  }

  toast({ kind = 'info', title, text, channel = null, ttl = 6000, actions = [] }) {
    // While a guided walk skips ahead, the glasses stay quiet: no toasts, lines or captions.
    if (this.muted) return { close() {}, box: null };
    const box = document.createElement('div');
    box.className = `toast toast--${kind}`;
    box.setAttribute('role', kind === 'alert' ? 'alert' : 'status');
    box.innerHTML = `<div class="toast-head">${channel ? `<span class="chip chip--dark" data-ch="${channel}">${CHANNEL_NAMES[channel]}</span>` : ''}<strong>${esc(title)}</strong></div>${text ? `<p>${esc(text)}</p>` : ''}${actions.length ? `<div class="toast-actions">${actions.map((a, i) => `<button type="button" class="btn" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>` : ''}`;
    this.el('[data-toasts]').append(box);
    nextFrame(() => box.classList.add('is-in'));
    const close = () => { box.classList.remove('is-in'); setTimeout(() => box.remove(), 400); };
    actions.forEach((a, i) => box.querySelector(`[data-i="${i}"]`).addEventListener('click', () => { a.run?.(); close(); }));
    if (ttl) setTimeout(close, ttl);
    return { close, box };
  }

  zone(id, name, now) {
    const last = this.zoneCooldown.get(id) || -Infinity;
    if (now - last < 45000) return;
    this.zoneCooldown.set(id, now);
    const z = this.el('[data-zone]');
    z.firstElementChild.textContent = name;
    z.classList.remove('is-in');
    void z.offsetWidth;
    z.classList.add('is-in');
  }

  caption(text, ttl = 4200) {
    if (this.muted && text) return;
    const c = this.el('[data-caption]');
    clearTimeout(this.captionTimer);
    if (!text) { c.hidden = true; return; }
    c.hidden = false;
    c.textContent = text;
    this.captionTimer = setTimeout(() => { c.hidden = true; }, ttl);
  }

  /** A spoken line: the wearer's request or someone nearby. */
  say(who, text, ttl = 4200) {
    if (this.muted) return;
    const v = this.el('[data-voice]');
    clearTimeout(this.voiceTimer);
    v.hidden = false;
    this.el('[data-voice-who]').textContent = who;
    this.el('[data-voice-text]').textContent = `“${text}”`;
    this.voiceTimer = setTimeout(() => { v.hidden = true; }, ttl);
  }

  /** The prompt to enter or leave a building; null hides it. */
  setInteract(label, onClick = null, { quiet = false } = {}) {
    const b = this.el('[data-interact]');
    if (!label) { b.hidden = true; b.onclick = null; return; }
    b.hidden = false;
    b.classList.toggle('is-quiet', quiet);
    if (b.dataset.label !== label) { b.dataset.label = label; this.el('[data-interact-label]').textContent = label; }
    b.onclick = onClick;
  }

  brackets(rect, label = '', state = 'seen') {
    const b = this.el('[data-brackets]');
    if (!rect) { b.classList.remove('is-on'); return; }
    b.classList.add('is-on');
    b.dataset.state = state;
    b.style.transform = `translate(${rect.x}px, ${rect.y}px)`;
    b.style.width = `${rect.w}px`;
    b.style.height = `${rect.h}px`;
    b.lastElementChild.textContent = label;
  }

  setGlasses(on) {
    this.root.classList.toggle('glasses-off', !on);
    this.el('[data-off-banner]').hidden = on;
    this.el('[data-phone]').hidden = on;
    this.el('[data-glasses]').innerHTML = `${esc(this.t(on ? 'takeOff' : 'putOn'))} <kbd>G</kbd>`;
  }

  phone(items) {
    this.el('[data-phone-list]').innerHTML = items.map(i => `<div class="phone-note"><b>${esc(i.title)}</b><span>${esc(i.text)}</span></div>`).join('');
  }

  // ---------------------------------------------------------------- poster card
  showCard({ number, row, title, authors, origin }) {
    const c = this.card;
    // A token per card, so a card hidden in the same moment it was shown (while skipping) stays hidden.
    const token = this.cardToken = (this.cardToken || 0) + 1;
    c.hidden = false;
    c.innerHTML = `
      <div class="card-top"><span class="plate">${esc(number)}</span><span class="card-row">${esc(row)}</span><span class="chip chip--dark" data-ch="SM" title="${esc(this.t('fromSensing'))}">S→M</span></div>
      <h2 class="card-title">${esc(title)}</h2>
      <p class="card-authors">${esc(authors)}</p>
      ${origin ? `<p class="card-origin">${esc(origin)}</p>` : ''}
      <div class="card-sections" data-sections></div>
      <div class="card-actions" data-card-actions></div>`;
    nextFrame(() => { if (this.cardToken === token) c.classList.add('is-in'); });
  }

  cardSection({ id, label, channel, items = [], body = '', tone = '' }) {
    const host = this.card.querySelector('[data-sections]');
    if (!host) return null;
    let sec = host.querySelector(`[data-sec="${id}"]`);
    if (!sec) {
      sec = document.createElement('section');
      sec.className = `card-sec ${tone ? 'card-sec--' + tone : ''}`;
      sec.dataset.sec = id;
      host.append(sec);
    }
    sec.innerHTML = `<h3><span>${esc(label)}</span>${channel ? `<span class="chip chip--dark" data-ch="${channel}">${CHANNEL_NAMES[channel]}</span>` : ''}</h3>${body ? `<p>${esc(body)}</p>` : ''}${items.length ? `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}`;
    nextFrame(() => sec.classList.add('is-in'));
    return sec;
  }

  cardActions(actions) {
    const host = this.card.querySelector('[data-card-actions]');
    if (!host) return;
    host.innerHTML = actions.map((a, i) => `<button type="button" class="btn btn--small" data-a="${i}">${esc(a.label)}</button>`).join('');
    actions.forEach((a, i) => host.querySelector(`[data-a="${i}"]`).addEventListener('click', () => { a.run?.(); host.innerHTML = ''; }));
  }

  removeSection(id) { this.card.querySelector(`[data-sec="${id}"]`)?.remove(); }

  hideCard() {
    this.cardToken = (this.cardToken || 0) + 1;
    this.card.classList.remove('is-in');
    clearTimeout(this.cardTimer);
    this.cardTimer = setTimeout(() => { if (!this.card.classList.contains('is-in')) this.card.hidden = true; }, 350);
  }

  openSheet(html, { wide = false } = {}) {
    const sheet = this.el('[data-sheet]');
    const card = this.el('[data-sheet-card]');
    card.classList.toggle('is-wide', wide);
    card.innerHTML = `${html}<button type="button" class="btn sheet-close" data-sheet-close>${esc(this.t('close'))} <kbd>Esc</kbd></button>`;
    sheet.hidden = false;
    card.querySelector('[data-sheet-close]').addEventListener('click', () => this.closeSheet());
    card.querySelector('[data-sheet-close]').focus({ preventScroll: true });
    nextFrame(() => sheet.classList.add('is-in'));
  }

  closeSheet() {
    const sheet = this.el('[data-sheet]');
    sheet.classList.remove('is-in');
    setTimeout(() => { sheet.hidden = true; }, 250);
  }

  get sheetOpen() { return !this.el('[data-sheet]').hidden; }
}
