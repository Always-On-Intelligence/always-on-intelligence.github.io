// Animated definitions for the three property cards of Section 2.1. Each figure stacks
// the defining property (highlighted) over the case it rules out (grey) on one time axis:
// request-only for operational continuity, session-local for state durability, and a
// fixed mechanism for mechanism revision. Formulas and symbols are rendered with KaTeX.

import { loadKatex, tex, mixed } from './math.mjs';

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const X0 = 8;
const X1 = 312;

function svg(viewBox, body, label) {
  return `<svg class="ds" viewBox="${viewBox}" role="img" aria-label="${label}">${body}</svg>`;
}

// ---------- notation, quoted from the symbol table and equations of Section 2.1 (TeX, rendered by KaTeX) ----------
// Eq. (1) of the paper: the policy selects an operation at every step; the two cases differ in R.
const POLICY = String.raw`\pi_i^{\theta_t}(\,\cdot\mid I_{i,t};c_t)\ \text{selects}\\ \text{an operation at every }t\in\mathcal{T}`;
const FORMULAS = {
  continuing: String.raw`\begin{gathered}${POLICY}\\ \mathcal{R}\subsetneq\mathcal{T}\end{gathered}`,
  request: String.raw`\begin{gathered}${POLICY}\\ \mathcal{R}=\mathcal{T}\end{gathered}`,
  durable: String.raw`\begin{gathered}z_{t+1}=\mathrm{UPDATE}(z_t,x_t;\theta_t,c_t)\\ t\in\mathcal{B}\end{gathered}`,
  session: String.raw`\begin{gathered}z_{t+1}=z_0\\ t\in\mathcal{B}\end{gathered}`,
  evolve: String.raw`\theta_{t+1}=\mathrm{REVISE}(\theta_t;\tau_t)`,
  fixed: String.raw`\theta_{t+1}=\mathrm{REVISE}(\theta_t;\tau_t)=\theta_t`
};
const MECHANISM = String.raw`Mechanism implementing the local policies: model parameters $\omega_t$ and scaffolding $\Sigma_t$.`;
const GLOSSARY = {
  continuity: [
    [String.raw`t\in\mathcal{T}`, String.raw`Step of the assistant: one runtime event or decision, and $\mathcal{T}$ is the set of all steps.`],
    [String.raw`\mathcal{R}`, String.raw`Steps that carry out an explicit request as asked. Operational continuity means $\mathcal{R}\subsetneq\mathcal{T}$, and in a request-only assistant every step lies in $\mathcal{R}$, so $\mathcal{R}=\mathcal{T}$.`],
    [String.raw`\pi_i`, String.raw`Local policy of module $i\in\{S,M,A\}$. It can be deterministic or stochastic.`],
    ['I_{i,t}', String.raw`Decision context of module $i$: external input, local state, and input from other modules.`],
    ['c_t', 'Shared conditions: privacy, authority, safety, resources, availability, and uncertainty.'],
    [String.raw`\theta_t`, MECHANISM]
  ],
  durability: [
    ['z_t', String.raw`Running state: all information the assistant carries into step $t$, except the mechanism $\theta_t$.`],
    ['x_t', String.raw`Input or event at step $t$.`],
    [String.raw`\mathcal{B}`, 'Steps ending an interaction.'],
    [String.raw`\mathrm{UPDATE}`, String.raw`Chooses the information kept for later steps. With $\mathrm{ACT}$, which chooses the current action, it forms one assistant step, $\mathrm{STEP}$.`],
    ['z_0', 'Initial running state, to which a session-local assistant returns whenever an interaction ends.'],
    [String.raw`\theta_t`, MECHANISM],
    ['c_t', 'Shared conditions: privacy, authority, safety, resources, availability, and uncertainty. They limit what UPDATE is allowed to store.']
  ],
  revision: [
    [String.raw`\theta_t=(\omega_t,\Sigma_t)`, String.raw`Mechanism: model parameters $\omega_t$ and scaffolding $\Sigma_t$, its prompts, context construction, storage, tools and APIs, and the harness that runs the loop.`],
    [String.raw`\tau_t`, String.raw`Trajectory: the assistant's inputs and actions up to step $t$, with feedback on them.`],
    [String.raw`\mathrm{REVISE}`, String.raw`Revises the mechanism $\theta_t$, changing how the assistant works. In a fixed-mechanism loop it returns $\theta_t$ unchanged, so only the running state $z_t$ changes.`]
  ]
};

// ---------- shared animation loop: progress p goes 0 → 1, holds, then restarts ----------
function animate(root, draw, duration = 7600) {
  let raf = 0;
  let start = 0;
  const frame = now => {
    if (!start) start = now;
    const phase = ((now - start) % duration) / duration;
    draw(Math.min(1, phase / 0.84));
    raf = requestAnimationFrame(frame);
  };
  const play = () => {
    if (reduceMotion()) { draw(1); return; }
    if (!raf) { start = 0; raf = requestAnimationFrame(frame); }
  };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => (entry.isIntersecting ? play() : stop()), { threshold: 0.2 }).observe(root);
  } else {
    play();
  }
  draw(reduceMotion() ? 1 : 0);
  return { restart() { start = 0; if (reduceMotion()) draw(1); } };
}

const icon = {
  req: (x, y) => `<path class="ic ic--req" d="M${x - 7},${y - 5} h14 a2.5,2.5 0 0 1 2.5,2.5 v5.5 a2.5,2.5 0 0 1 -2.5,2.5 h-6.5 l-3.5,3 v-3 h-4 a2.5,2.5 0 0 1 -2.5,-2.5 v-5.5 a2.5,2.5 0 0 1 2.5,-2.5 z"/>`,
  event: (x, y) => `<g class="ic ic--event"><rect x="${x - 6}" y="${y - 5}" width="12" height="11" rx="2"/><path d="M${x - 6},${y - 1.5} h12"/></g>`,
  tick: (x, y) => `<g class="ic ic--tick"><circle cx="${x}" cy="${y}" r="5.5"/><path d="M${x},${y - 3} v3 h2.6"/></g>`
};

// Each figure stacks two timelines on one time axis: the defining property on top,
// highlighted, and the case it rules out below, in grey. One playhead crosses both.

function laneLabel(y, text, base) {
  return `<text class="ds-lane-label${base ? ' is-base' : ''}" x="${X0}" y="${y}">${text}</text>`;
}

// ---------- Property 1: operational continuity ----------
const STEPS = [
  { trig: 'req', out: 'act' }, { trig: 'tick', out: 'wait' }, { trig: 'event', out: 'act' },
  { trig: 'tick', out: 'wait' }, { trig: 'req', out: 'act' }, { trig: 'event', out: 'wait' },
  { trig: 'tick', out: 'wait' }, { trig: 'event', out: 'act' }, { trig: 'tick', out: 'wait' }
];

function continuity(root) {
  const xs = STEPS.map((_, i) => 26 + i * 33.5);
  const LANES = [{ y: 50, base: false }, { y: 100, base: true }];
  const steps = STEPS.map((s, i) => `<g class="ds-col" data-i="${i}">
      ${icon[s.trig](xs[i], 12)}
      <path class="ds-stem" d="M${xs[i]},21 V108"/>
      ${LANES.map((l, k) => `<g class="ds-step${l.base ? ' is-base' : ''}" data-lane="${k}"><circle class="ds-node" cx="${xs[i]}" cy="${l.y}" r="6"/><path class="ds-none" d="M${xs[i] - 4},${l.y} h8"/><text class="ds-out" x="${xs[i]}" y="${l.y + 17}"></text></g>`).join('')}
    </g>`).join('');
  root.innerHTML = svg('0 0 320 124', `
      ${LANES.map(l => `<path class="ds-axis${l.base ? ' is-base' : ''}" d="M${X0},${l.y} H${X1}"/>`).join('')}
      ${laneLabel(34, 'Continuing loop', false)}${laneLabel(84, 'Request-only', true)}
      ${steps}
      <path class="ds-head" d="M${X0},2 V120"/>`, 'Two timelines of the same requests, events and scheduled checks: a continuing loop acts or waits at every step, a request-only assistant takes steps only when asked')
    + `<div class="ds-legend"><span><svg viewBox="0 0 20 16">${icon.req(10, 8)}</svg>request</span><span><svg viewBox="0 0 20 16">${icon.event(10, 8)}</svg>event</span><span><svg viewBox="0 0 20 16">${icon.tick(10, 8)}</svg>scheduled check</span><span><i class="dot-act"></i>act</span><span><i class="dot-wait"></i>wait</span><span><i class="dot-none"></i>no step</span></div>`;
  const cols = [...root.querySelectorAll('.ds-col')];
  const head = root.querySelector('.ds-head');
  const draw = p => {
    const x = X0 + (X1 - X0) * p;
    head.setAttribute('transform', `translate(${x - X0},0)`);
    cols.forEach((col, i) => {
      const s = STEPS[i];
      const passed = xs[i] <= x;
      col.querySelectorAll('.ds-step').forEach(g => {
        const base = g.dataset.lane === '1';
        const state = !passed ? 'pending' : base ? (s.trig === 'req' ? 'act' : 'none') : s.out;
        if (g.dataset.state === state) return;
        g.dataset.state = state;
        g.querySelector('.ds-out').textContent = state === 'act' ? 'act' : state === 'wait' ? 'wait' : '';
      });
    });
  };
  animate(root, draw);
  return {
    formulas: [['Continuing loop', FORMULAS.continuing], ['Request-only', FORMULAS.request]],
    note: ''
  };
}

// ---------- Property 2: state durability ----------
const SESSIONS = [[X0, 104], [112, 208], [216, X1]];
const BOUNDS = [108, 212];
const ITEMS = [
  { x: 30, session: 0, text: 'pending: send the report' },
  { x: 132, session: 1, text: 'prefers reminders after meetings' }
];
const DONE_X = 262;

function durability(root) {
  const TOP = [50, 72];
  const LOW = [104, 118];
  const bands = SESSIONS.map(([a, b], i) => `<g class="ds-band"><rect x="${a}" y="2" width="${b - a}" height="16" rx="5"/><text x="${(a + b) / 2}" y="13.5">interaction ${i + 1}</text></g>`).join('');
  const bounds = BOUNDS.map(bx => `<path class="ds-bound" d="M${bx},2 V128"/><g class="ds-reset is-base-accent" data-x="${bx}"><circle cx="${bx}" cy="111" r="7.5"/><text x="${bx}" y="114.2">z₀</text></g>`).join('');
  const top = ITEMS.map((it, i) => `<g class="ds-item" data-i="${i}" data-lane="0"><text class="ds-item-label" x="${it.x}" y="${TOP[i] - 4}">${it.text}</text><rect class="ds-bar" x="${it.x}" y="${TOP[i]}" height="8" rx="4" width="0"/></g>`).join('');
  const low = ITEMS.map((it, i) => `<g class="ds-item is-base" data-i="${i}" data-lane="1"><rect class="ds-bar" x="${it.x}" y="${LOW[i]}" height="8" rx="4" width="0"/></g>`).join('');
  root.innerHTML = svg('0 0 320 132', `
      ${bands}${bounds}
      ${laneLabel(33, 'Durable state', false)}${laneLabel(96, 'Session-local', true)}
      ${top}${low}
      <g class="ds-done"><circle cx="${DONE_X}" cy="${TOP[0] + 4}" r="6"/><path d="M${DONE_X - 2.6},${TOP[0] + 4.1} l1.8,1.8 l3.4,-3.6"/><text x="${DONE_X + 9}" y="${TOP[0] - 4}">reminded</text></g>
      <text class="ds-missing" x="${DONE_X + 4}" y="${LOW[0] + 7}">nothing to remind</text>
      <path class="ds-head" d="M${X0},2 V128"/>`, 'The same interactions with durable state on top, where the pending task is carried across the ends of interactions, and session-local state below, reset at every end')
    + '<div class="ds-legend"><span><i class="dot-bound"></i>interaction ends</span><span><i class="dot-state"></i>retained state</span><span><i class="dot-reset">z₀</i>reset to the initial state</span></div>';
  const head = root.querySelector('.ds-head');
  const items = [...root.querySelectorAll('.ds-item')];
  const resets = [...root.querySelectorAll('.ds-reset')];
  const done = root.querySelector('.ds-done');
  const missing = root.querySelector('.ds-missing');
  const draw = p => {
    const x = X0 + (X1 - X0) * p;
    head.setAttribute('transform', `translate(${x - X0},0)`);
    items.forEach(g => {
      const it = ITEMS[Number(g.dataset.i)];
      const base = g.dataset.lane === '1';
      const end = base ? SESSIONS[it.session][1] : (it === ITEMS[0] ? DONE_X : X1);
      g.querySelector('.ds-bar').setAttribute('width', Math.max(0, Math.min(x, end) - it.x).toFixed(1));
      g.classList.toggle('is-on', x >= it.x);
    });
    resets.forEach(r => r.classList.toggle('is-on', x >= Number(r.dataset.x)));
    done.classList.toggle('is-on', x >= DONE_X);
    missing.classList.toggle('is-on', x >= DONE_X);
  };
  animate(root, draw);
  return {
    formulas: [['Durable state', FORMULAS.durable], ['Session-local', FORMULAS.session]],
    note: 'The pending reminder, for example, remains after the report conversation ends, while a privacy requirement can forbid storing the conversation’s transcript.'
  };
}

// ---------- Extension: mechanism revision ----------
const REM_X = [24, 62, 100, 138, 176, 214, 252, 290];
const CHECK_X = 147;
const BOUNDARY_X = 158;
const OUT_EVOLVE = ['no', 'no', 'no', 'no', 'yes', 'yes', 'yes', 'yes'];
const OUT_FIXED = ['no', 'no', 'no', 'no', 'yes', 'no', 'yes', 'no'];
const M_X = [82, 196, 270];

function revision(root) {
  const L = [{ label: 'Self-evolving', ly: 34, rem: 47, bar: 61, base: false }, { label: 'Fixed θ', ly: 92, rem: 105, bar: 119, base: true }];
  const lane = (l, k) => `
      ${laneLabel(l.ly, l.label, l.base)}
      ${REM_X.map((x, i) => `<g class="ds-rem${l.base ? ' is-base' : ''}" data-lane="${k}" data-i="${i}"><circle cx="${x}" cy="${l.rem}" r="6.5"/><path class="mk-no" d="M${x - 2.4},${l.rem - 2.4} l4.8,4.8 M${x + 2.4},${l.rem - 2.4} l-4.8,4.8"/><path class="mk-yes" d="M${x - 2.8},${l.rem + 0.2} l2,2.1 l3.8,-4.2"/></g>`).join('')}
      <rect class="ds-theta ds-theta--1${l.base ? ' is-base' : ''}" data-lane="${k}" x="${X0 + 16}" y="${l.bar}" height="12" rx="6" width="0"/>
      <text class="ds-theta-label ds-theta-label--1" x="${X0 + 22}" y="${l.bar + 8.6}">θ₁ remind at meeting end</text>`;
  root.innerHTML = svg('0 0 320 138', `
      <text class="ds-lane-label is-shared" x="${X0}" y="12">state z</text>
      <path class="ds-axis ds-axis--m" d="M62,8 H${X1}"/>
      ${M_X.map((x, i) => `<rect class="ds-m" data-i="${i}" x="${x - 4}" y="4" width="8" height="8" rx="2"/>`).join('')}
      ${L.map(lane).join('')}
      <rect class="ds-theta ds-theta--2" x="${BOUNDARY_X}" y="${L[0].bar}" height="12" rx="6" width="0"/>
      <text class="ds-theta-label ds-theta-label--2" x="${BOUNDARY_X + 6}" y="${L[0].bar + 8.6}">θ₂ wait until back at workstation</text>
      <g class="ds-check"><path d="M${CHECK_X},${L[0].bar - 1} l5,7 l-5,7 l-5,-7 z"/></g>
      <g class="ds-boundary"><path d="M${BOUNDARY_X},22 V${L[0].bar + 14}"/><text x="${BOUNDARY_X + 4}" y="30">takes effect</text></g>
      <path class="ds-head" d="M${X0},2 V134"/>`, 'Two timelines of reminders: on top a revision of the timing rule, made within the user’s limits, takes effect and later reminders use it, below the rule stays fixed')
    + '<div class="ds-legend"><span><i class="dot-no"></i>dismissed</span><span><i class="dot-yes"></i>accepted</span><span><i class="dot-m"></i>state update</span><span><i class="dot-check"></i>within limits</span></div>';
  const head = root.querySelector('.ds-head');
  const rems = [...root.querySelectorAll('.ds-rem')];
  const ms = [...root.querySelectorAll('.ds-m')];
  const t1 = [...root.querySelectorAll('.ds-theta--1')];
  const t2 = root.querySelector('.ds-theta--2');
  const l2 = root.querySelector('.ds-theta-label--2');
  const check = root.querySelector('.ds-check');
  const boundary = root.querySelector('.ds-boundary');
  const draw = p => {
    const x = X0 + (X1 - X0) * p;
    head.setAttribute('transform', `translate(${x - X0},0)`);
    rems.forEach(g => {
      const i = Number(g.dataset.i);
      const outs = g.dataset.lane === '1' ? OUT_FIXED : OUT_EVOLVE;
      g.dataset.out = REM_X[i] <= x ? outs[i] : '';
    });
    ms.forEach((r, i) => r.classList.toggle('is-on', M_X[i] <= x));
    t1.forEach(r => {
      const cut = r.dataset.lane === '0' ? Math.min(x, BOUNDARY_X) : x;
      r.setAttribute('width', Math.max(0, cut - (X0 + 16)).toFixed(1));
    });
    t2.setAttribute('width', Math.max(0, x - BOUNDARY_X).toFixed(1));
    l2.classList.toggle('is-on', x >= BOUNDARY_X + 30);
    check.classList.toggle('is-on', x >= CHECK_X);
    boundary.classList.toggle('is-on', x >= BOUNDARY_X);
  };
  animate(root, draw);
  return {
    formulas: [['Self-evolving', FORMULAS.evolve], ['Fixed θ', FORMULAS.fixed]],
    note: ''
  };
}

const BUILDERS = { continuity, durability, revision };

export async function mountDefinitions(scope = document) {
  const katex = await loadKatex();
  scope.querySelectorAll('[data-def]').forEach(el => {
    const build = BUILDERS[el.dataset.def];
    if (!build) return;
    const card = el.closest('.prop');
    const math = card?.querySelector('.math');
    const sim = build(el);
    if (math) {
      const pair = document.createElement('div');
      pair.className = 'formula-pair';
      pair.innerHTML = sim.formulas.map(([label, source], i) => `<div class="fp-row${i ? ' is-base' : ''}"><span class="fp-label">${label}</span>${tex(katex, source, true)}</div>`).join('');
      math.replaceWith(pair);
      let last = pair;
      if (sim.note) {
        const note = document.createElement('p');
        note.className = 'ds-note';
        note.textContent = sim.note;
        last.after(note);
        last = note;
      }
      const symbols = document.createElement('details');
      symbols.className = 'glossary-toggle';
      symbols.innerHTML = `<summary>Symbols</summary><dl class="glossary">${(GLOSSARY[el.dataset.def] || []).map(([sym, text]) => `<dt>${tex(katex, sym)}</dt><dd>${mixed(katex, text)}</dd>`).join('')}</dl>`;
      last.after(symbols);
    }
  });
}
