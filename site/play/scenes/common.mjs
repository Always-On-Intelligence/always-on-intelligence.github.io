// Shared helpers for the episode scenes: cancellable scripts and clickable spots.
import * as THREE from 'three';

const CANCEL = Symbol('cancel');

/**
 * run(async step => { await step(promise); ... }): starting a new script finishes the running tweens
 * and stops the previous script at its next step, so jumping between beats never leaves two
 * animations fighting over the same actor.
 */
export function scriptRunner(view) {
  let token = 0;
  return async function run(fn) {
    const my = ++token;
    view.stopAnimations();
    const step = async promise => {
      await promise;
      if (my !== token) throw CANCEL;
    };
    try {
      await fn(step);
      return my === token;
    } catch (error) {
      if (error !== CANCEL) throw error;
      return false;
    }
  };
}

/**
 * Spots the viewer can inspect: each is a 3D object (clickable in the scene) plus a small button pinned
 * above it, so the same thing works with a mouse, a finger and the keyboard.
 */
export function makeSpots(view, defs) {
  const items = defs.map(d => {
    view.pickable(d.obj, d.id);
    const anchor = new THREE.Object3D();
    anchor.position.set(...d.at);
    d.obj.add(anchor);
    const label = view.label(anchor, {
      className: 'pv-spot',
      html: `<button type="button" class="pv-spot-btn" data-spot="${d.id}" aria-label="Inspect: ${d.name}"><span class="pv-spot-dot" aria-hidden="true"></span><span class="pv-spot-name">${d.name}</span></button>`
    });
    return { ...d, anchor, label };
  });
  return {
    items,
    show(ids) {
      for (const it of items) {
        const on = ids.includes(it.id);
        it.label.shown = on;
        it.label.el.hidden = !on;
      }
    }
  };
}

const escHtml = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** What the glasses show: a small panel next to the wearer's head (beat.scene.hud = { text, tone }). */
export function lensHud(view, person, offset = [0.32, 0.28, 0.25]) {
  const label = view.label(person.head, { className: 'pv-hud', offset });
  return {
    label,
    set(hud) {
      person.setDisplay(hud ? (hud.tone === 'alert' ? '#ff9a7a' : hud.tone === 'quiet' ? '#b9c3cf' : '#9fe8c8') : null);
      label.set(hud ? `<span class="pv-hud-k">In-lens display</span>${escHtml(hud.text)}` : '', hud ? `is-${hud.tone || 'suggest'}` : undefined);
    }
  };
}

/** A cue in the earbuds, or the same cue spoken to the room. */
export function earCue(view, person, offset = [0.3, 0.25, 0.2]) {
  const label = view.label(person.head, { className: 'pv-cue', offset });
  return {
    label,
    set(text, audience = 'private') {
      label.set(text ? `<span class="pv-cue-k">${audience === 'shared' ? 'Spoken to the room' : 'Only the user hears'}</span>${escHtml(text)}` : '', text ? `is-${audience}` : undefined);
    }
  };
}

const APP_NAME = { chat: 'Chat', calendar: 'Calendar', tasks: 'Tasks', files: 'Files', log: 'Log', editor: 'Editor', review: 'Review' };
const BAD = /reject|unknown|timeout|incomplete|offline|unavailable|widen|without approval|missing|busy|\?/i;
const GOOD = /accept|confirmed|done|\bok\b|linked|20 pages|written$/i;

/** The readable screen: the panes of beat.scene ({ clock, net, panes, toast }) as an HTML window. */
export function screenPanel(view, anchor, offset = [0, 0.55, 0]) {
  const label = view.label(anchor, { className: 'pv-screen', offset });
  return {
    label,
    set(scene) {
      if (!scene?.panes) { label.set(''); return; }
      const panes = scene.panes.map(p => `<div class="pv-pane pv-pane--${p.app}"><p class="pv-pane-t">${escHtml(APP_NAME[p.app] || p.app)} · ${escHtml(p.title)}</p>${(p.rows || []).map((r, i) => {
        const [a, b] = r;
        if (p.app === 'chat') return `<p class="pv-msg${a === 'you' ? ' is-me' : ''}"><span>${escHtml(a)}</span>${escHtml(b)}</p>`;
        const tone = BAD.test(b) ? ' is-bad' : GOOD.test(b) ? ' is-good' : '';
        return `<p class="pv-row${p.highlight === i ? ' is-hl' : ''}${tone}">${a ? `<b>${escHtml(a)}</b>` : ''}<span>${escHtml(b)}</span></p>`;
      }).join('')}</div>`).join('');
      const toast = scene.toast ? `<div class="pv-toast"><b>${escHtml(scene.toast.title)}</b>${escHtml(scene.toast.text)}</div>` : '';
      label.set(`<div class="pv-screen-bar"><span>Screen</span><span class="${scene.net === 'offline' ? 'is-bad' : ''}">${scene.net === 'offline' ? 'offline · ' : ''}${escHtml(scene.clock || '')}</span></div><div class="pv-panes">${panes}</div>${toast}`);
    }
  };
}

/** Paint an abstract version of the same panes on a laptop screen in the room (no text). */
export function paintScreen(laptop, scene) {
  laptop.draw((c, w, h) => {
    c.fillStyle = scene?.net === 'offline' ? '#2a1f22' : '#1b2232';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#2c364a'; c.fillRect(0, 0, w, 22);
    const panes = scene?.panes || [];
    const n = Math.max(1, panes.length);
    const pw = (w - 16 * (n + 1)) / n;
    panes.forEach((p, i) => {
      const x = 16 + i * (pw + 16);
      c.fillStyle = '#e9edf3'; c.fillRect(x, 36, pw, h - 52);
      c.fillStyle = '#c9d2de'; c.fillRect(x, 36, pw, 22);
      (p.rows || []).forEach((r, k) => {
        const y = 72 + k * 34;
        if (y > h - 30) return;
        const bad = BAD.test(r[1]), good = GOOD.test(r[1]);
        if (p.app === 'chat') {
          const me = r[0] === 'you';
          c.fillStyle = me ? '#7fa6e8' : '#cfd8e6';
          const bw = Math.min(pw - 30, 40 + r[1].length * 4);
          c.fillRect(me ? x + pw - 10 - bw : x + 10, y, bw, 22);
        } else {
          c.fillStyle = p.highlight === k ? '#f2d58a' : bad ? '#f0a598' : good ? '#9ed8b1' : '#b8c3d3';
          c.fillRect(x + 10, y, Math.min(pw - 20, 30 + r[1].length * 5), 18);
        }
      });
    });
    if (scene?.toast) { c.fillStyle = '#ffffff'; c.fillRect(w - 190, 30, 174, 50); c.fillStyle = '#7fa6e8'; c.fillRect(w - 182, 40, 60, 10); }
  });
}
