// Interactive framework figure: three modules, six directed channels, shared
// conditions (left of the loop) and the implementation (right of it), as in the paper's framework figure, with
// two guided walkthroughs from Section 2: self-evolving, and the reminder example.
import {
  modules, channels, channelIntro, conditions, conditionsIntro, implementation,
  reminderSteps, reminderVariants, reminderClosing, evolveSteps,
  adjacentProps, adjacentKinds
} from './data/framework.mjs';
import { loadKatex, tex } from './math.mjs';

let KATEX = null;

const SVG_NS = 'http://www.w3.org/2000/svg';
export const VB = { w: 780, h: 590 };
export const RECTS = {
  M: { x: 270, y: 22, w: 240, h: 116 },
  S: { x: 30, y: 344, w: 240, h: 116 },
  A: { x: 510, y: 344, w: 240, h: 116 }
};
const WORLD = { x: 30, y: 528, w: 720, h: 50 };
const PILL_SHIFT = 19;
const OFFSET = 14;
const GAP = 7;
const byId = Object.fromEntries(channels.map(ch => [ch.id, ch]));
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const esc = value => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const arrow = id => `${id[0]}→${id[1]}`;
const pct = (value, total) => `${(value / total * 100).toFixed(3)}%`;

function center(rect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function exitPoint(rect, p, d) {
  const tx = d.x > 0 ? (rect.x + rect.w - p.x) / d.x : d.x < 0 ? (rect.x - p.x) / d.x : Infinity;
  const ty = d.y > 0 ? (rect.y + rect.h - p.y) / d.y : d.y < 0 ? (rect.y - p.y) / d.y : Infinity;
  const t = Math.min(tx, ty);
  return { x: p.x + d.x * t, y: p.y + d.y * t };
}

/** Geometry of one channel: straight offset line between two module boxes (the figure's, or other boxes). */
export function channelGeometry(channel, rects = RECTS) {
  const a = center(rects[channel.from]);
  const b = center(rects[channel.to]);
  const cx = (rects.S.x + rects.A.x + rects.M.x) / 3 + rects.S.w / 2;
  const cy = (rects.S.y + rects.A.y + rects.M.y) / 3 + rects.S.h / 2;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const d = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  let n = { x: -d.y, y: d.x };
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const inward = (cx - mid.x) * n.x + (cy - mid.y) * n.y > 0;
  if (inward !== (channel.side === 'inner')) n = { x: -n.x, y: -n.y };
  const p0 = { x: a.x + n.x * OFFSET, y: a.y + n.y * OFFSET };
  const p1 = { x: b.x + n.x * OFFSET, y: b.y + n.y * OFFSET };
  const s0 = exitPoint(rects[channel.from], p0, d);
  const e0 = exitPoint(rects[channel.to], p1, { x: -d.x, y: -d.y });
  const start = { x: s0.x + d.x * GAP, y: s0.y + d.y * GAP };
  const end = { x: e0.x - d.x * GAP, y: e0.y - d.y * GAP };
  const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  return { start, end, d, n, mid: middle, label: { x: middle.x + n.x * PILL_SHIFT, y: middle.y + n.y * PILL_SHIFT } };
}

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

export function headPath(end, d, size = 10, width = 5.2) {
  const base = { x: end.x - d.x * size, y: end.y - d.y * size };
  const n = { x: -d.y, y: d.x };
  return `M${end.x.toFixed(1)},${end.y.toFixed(1)} L${(base.x + n.x * width).toFixed(1)},${(base.y + n.y * width).toFixed(1)} L${(base.x - n.x * width).toFixed(1)},${(base.y - n.y * width).toFixed(1)} Z`;
}

function buildSvg() {
  const svg = svgEl('svg', { viewBox: `0 0 ${VB.w} ${VB.h}`, class: 'loop-svg', 'aria-hidden': 'true', focusable: 'false' });
  const world = svgEl('g', { class: 'world-arrows' });
  const inX = RECTS.S.x + 40;
  const outX = RECTS.A.x + RECTS.A.w - 40;
  const up = { x: 0, y: -1 };
  const down = { x: 0, y: 1 };
  const inEnd = { x: inX, y: RECTS.S.y + RECTS.S.h + GAP };
  const outEnd = { x: outX, y: WORLD.y - GAP };
  world.append(
    svgEl('path', { d: `M${inX},${WORLD.y - 2} L${inEnd.x},${inEnd.y + 9}`, class: 'world-line' }),
    svgEl('path', { d: headPath(inEnd, up, 9, 4.6), class: 'world-head' }),
    svgEl('path', { d: `M${outX},${RECTS.A.y + RECTS.A.h + 2} L${outEnd.x},${outEnd.y - 9}`, class: 'world-line' }),
    svgEl('path', { d: headPath(outEnd, down, 9, 4.6), class: 'world-head' })
  );
  svg.append(world);
  for (const channel of channels) {
    const g = channelGeometry(channel);
    const group = svgEl('g', { class: 'ch', 'data-ch': channel.id, 'data-to': channel.to, 'data-difficulty': channel.difficulty.toLowerCase() });
    const lineEnd = { x: g.end.x - g.d.x * 8, y: g.end.y - g.d.y * 8 };
    const line = svgEl('path', {
      d: `M${g.start.x.toFixed(1)},${g.start.y.toFixed(1)} L${lineEnd.x.toFixed(1)},${lineEnd.y.toFixed(1)}`,
      class: 'ch-line'
    });
    const hit = svgEl('path', { d: line.getAttribute('d'), class: 'ch-hit' });
    group.append(hit, line, svgEl('path', { d: headPath(g.end, g.d), class: 'ch-head' }));
    svg.append(group);
  }
  const packet = svgEl('circle', { r: 6.5, class: 'packet', cx: -20, cy: -20, style: 'display:none' });
  svg.append(packet);
  return svg;
}

function nodeHtml(mod) {
  const rect = RECTS[mod.id];
  return `<button type="button" class="node node--${mod.id}" data-node="${mod.id}"
    style="left:${pct(rect.x, VB.w)};top:${pct(rect.y, VB.h)};width:${pct(rect.w, VB.w)};height:${pct(rect.h, VB.h)}"
    aria-label="${esc(mod.name)} module">
    <span class="node-head"><span class="node-name">${esc(mod.name)}</span><span class="node-theta" hidden></span></span>
    <span class="node-row"><em>Space</em> ${esc(mod.spaceShort)}</span>
    <span class="node-row"><em>Policy</em> ${esc(mod.policyShort)}</span>
  </button>`;
}

function pillHtml(channel) {
  const g = channelGeometry(channel);
  return `<button type="button" class="ch-pill" data-ch="${channel.id}" data-difficulty="${channel.difficulty.toLowerCase()}"
    style="left:${pct(g.label.x, VB.w)};top:${pct(g.label.y, VB.h)}" aria-label="${arrow(channel.id)} channel: ${esc(channel.short)}">${arrow(channel.id)}</button>`;
}

function legendHtml() {
  return channels.map(ch => `<button type="button" class="legend-item" data-ch="${ch.id}" data-difficulty="${ch.difficulty.toLowerCase()}">
      <span class="legend-id">${arrow(ch.id)}</span>
      <span class="legend-text">${esc(ch.short)}</span>
      <span class="legend-diff">${ch.difficulty}</span>
    </button>`).join('');
}

function scaffoldHtml() {
  return implementation.scaffolding.parts
    .map(part => `<button type="button" class="chip chip--quiet" data-impl="scaffolding">${esc(part)}</button>`).join('');
}

function figureHtml() {
  const world = `<div class="world" style="left:${pct(WORLD.x, VB.w)};top:${pct(WORLD.y, VB.h)};width:${pct(WORLD.w, VB.w)};height:${pct(WORLD.h, VB.h)}">User &amp; world</div>
    <span class="world-label world-label--in" style="left:${pct(RECTS.S.x + 52, VB.w)};top:${pct(RECTS.S.y + RECTS.S.h + 22, VB.h)}">observations &amp; feedback (<i>x</i><sub>t</sub>)</span>
    <span class="world-label world-label--out" style="right:${pct(VB.w - (RECTS.A.x + RECTS.A.w - 52), VB.w)};top:${pct(RECTS.A.y + RECTS.A.h + 22, VB.h)}">executions &amp; assistance (<i>a</i><sub>t</sub>)</span>`;
  return `
    <div class="fw-bar">
      <div class="seg" role="tablist" aria-label="Framework view">
        <button type="button" role="tab" aria-selected="true" data-mode="explore">Framework</button>
        <button type="button" role="tab" aria-selected="false" data-mode="evolve">Self-evolving</button>
        <button type="button" role="tab" aria-selected="false" data-mode="reminder">Example</button>
      </div>
      <div class="seg seg--quiet" aria-label="Colour the channels by">
        <span class="seg-label">Channels by</span>
        <button type="button" aria-pressed="true" data-color="module">receiver</button>
        <button type="button" aria-pressed="false" data-color="difficulty">difficulty</button>
      </div>
    </div>
    <div class="fw-main">
      <div class="fw-side fw-side--cond">
        <span class="fw-row-label">Shared conditions <i>c</i><sub>t</sub></span>
        ${conditions.map(c => `<button type="button" class="chip" data-cond="${c.id}">${esc(c.name)}</button>`).join('')}
      </div>
      <div class="fw-figure">
        <div class="loop" data-color="module">
          ${Object.values(modules).map(nodeHtml).join('')}
          ${channels.map(pillHtml).join('')}
          ${world}
        </div>
        <div class="legend" aria-label="Channels">${legendHtml()}</div>
      </div>
      <div class="fw-side fw-side--impl">
        <span class="fw-row-label">Implementation <i>θ</i><sub>t</sub> = (<i>ω</i><sub>t</sub>, <i>Σ</i><sub>t</sub>)</span>
        <button type="button" class="chip" data-impl="model">Model</button>
        <span class="fw-row-sep">Scaffolding</span>
        ${scaffoldHtml()}
      </div>
      <aside class="fw-panel" aria-live="polite"></aside>
    </div>`;
}

function chipList(items) {
  return `<ul class="chips">${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`;
}

function channelLink(id) {
  const ch = byId[id];
  return `<button type="button" class="inline-ch" data-go-ch="${id}" data-difficulty="${ch.difficulty.toLowerCase()}">${arrow(id)}</button>`;
}

function renderOverview() {
  return `<p class="panel-kicker">How to read the figure</p>
    <p>${esc(channelIntro)}</p>
    <p class="panel-muted">Select a module, a channel, a shared condition, or a part of the implementation.</p>`;
}

function renderModule(id) {
  const mod = modules[id];
  return `<p class="panel-kicker"><span class="dot dot--${id}"></span>Module · Paper ${mod.section}</p>
    <h3 class="panel-title">${esc(mod.name)}</h3>
    <p>${esc(mod.role)}</p>
    <p class="panel-muted">${esc(mod.detail)}</p>
    <dl class="facts">
      <dt>Space</dt><dd>${esc(mod.space)}</dd>
      <dt>Local policy <i>π</i><sub>${id}</sub></dt><dd>${chipList(mod.policy)}</dd>
      <dt>Core challenge</dt><dd>${esc(mod.challenge)}</dd>
      <dt>Incoming channels</dt><dd class="inline-list">${mod.incoming.map(channelLink).join(' ')}</dd>
      <dt>For example</dt><dd>${esc(mod.example)}</dd>
    </dl>
    <div class="takeaway"><p class="takeaway-title">${esc(mod.takeawayTitle)}</p>${mod.takeaway.map(([lead, text]) => `<p><b>${esc(lead)}</b> ${esc(text)}</p>`).join('')}</div>`;
}

function renderChannel(id) {
  const ch = byId[id];
  return `<p class="panel-kicker"><span class="diff diff--${ch.difficulty.toLowerCase()}">${ch.difficulty}</span>Channel · covered in ${modules[ch.to].section} ${esc(modules[ch.to].name)}</p>
    <h3 class="panel-title">${arrow(id)} <span class="panel-title-sub">${esc(ch.short)}</span></h3>
    <p>${esc(ch.flow)}</p>
    <dl class="facts">
      <dt>Core challenge</dt><dd>${esc(ch.challenge)}</dd>
      <dt>In the reminder example</dt><dd>${esc(ch.example)}</dd>
    </dl>
    <p class="panel-muted">Selecting, integrating, and using this information stays with the receiving module’s policy, so the framework adds no separate policy per channel.</p>`;
}

function renderCondition(id) {
  const cond = conditions.find(c => c.id === id);
  const perModule = cond.perModule
    ? `<dl class="facts">${['S', 'M', 'A'].filter(m => cond.perModule[m]).map(m => `<dt><span class="dot dot--${m}"></span>In ${modules[m].name} · ${modules[m].section}</dt><dd>${esc(cond.perModule[m])}</dd>`).join('')}</dl>`
    : '';
  return `<p class="panel-kicker">Shared condition · Paper §2.4</p>
    <h3 class="panel-title">${esc(cond.name)}</h3>
    <p>${esc(cond.text)}</p>
    ${perModule}
    <p class="panel-muted">${esc(conditionsIntro)}</p>`;
}

function renderImpl(key) {
  const part = implementation[key];
  const extra = key === 'scaffolding' ? chipList(implementation.scaffolding.parts) : '';
  return `<p class="panel-kicker">Implementation · Paper §2.4</p>
    <h3 class="panel-title">${esc(part.name)}</h3>
    <p>${esc(part.text)}</p>
    ${extra}
    <p>${esc(implementation.intro)}</p>
    <p class="panel-muted">${esc(implementation.mechanism)}</p>`;
}

const KIND_LABEL = { request: 'request step', boundary: 'interaction ends', outside: 'outside the request steps' };

function fillState(text, free) {
  const reminded = free;
  return text
    .replace('{free}', free ? 'the user is free' : 'the user is still busy')
    .replace('{decision}', reminded ? 'remind now' : 'wait')
    .replace('{task}', reminded ? 'done: the reminder was sent' : 'pending: send the report after the meeting')
    .replace('{history}', reminded ? 'reminded once the user was free' : 'waited because the user was busy');
}

function reminderSkipped(step, variant) {
  return variant !== 'continuing' && step.kind === 'outside';
}

const SESSION_LATER = 'The calendar event still produces a step, but the pending task was dropped when the conversation ended, so Memory has nothing to supply and there is nothing to remind about.';

function reminderNote(step, variant) {
  if (variant === 'request' && step.kind === 'outside') return reminderVariants.request.note;
  if (variant === 'session' && step.kind === 'boundary') return reminderVariants.session.note;
  if (variant === 'session' && step.kind === 'outside') return SESSION_LATER;
  return '';
}

function renderReminder(state) {
  const step = reminderSteps[state.step];
  const skipped = reminderSkipped(step, state.variant);
  const note = reminderNote(step, state.variant);
  const sessionDropped = state.variant === 'session' && state.step >= 1;
  const timeline = reminderSteps.map((s, i) => `<button type="button" class="tl-dot tl-dot--${s.kind}${i === state.step ? ' is-current' : ''}${reminderSkipped(s, state.variant) ? ' is-skipped' : ''}" data-step="${i}" aria-label="Step ${i + 1}: ${esc(s.title)}"></button>`).join('<span class="tl-link"></span>');
  const memory = sessionDropped ? ['reset to the initial state z₀']
    : skipped ? reminderSteps.find(s => s.kind === 'boundary').state.m
    : step.state.m.map(m => fillState(m, state.free));
  const stateRows = `
    <div class="z-row"><span class="z-key">sensed</span><span class="z-val">${esc(skipped ? 'no step' : fillState(step.state.s, state.free))}</span></div>
    <div class="z-row"><span class="z-key">z<sub>t</sub> retained</span><span class="z-val">${memory.map(esc).join('<br>')}</span></div>
    ${step.state.a && !skipped ? `<div class="z-row"><span class="z-key">a<sub>t</sub> action</span><span class="z-val">${esc(fillState(step.state.a, state.free))}</span></div>` : ''}`;
  const skippedNote = note ? `<p class="variant-note">${esc(note)}</p>` : '';
  const channelLine = step.channel && !skipped
    ? `<p class="step-channel">${channelLink(step.channel)} ${esc(byId[step.channel].short)}</p>` : '';
  const choice = step.choice && !skipped
    ? `<div class="seg seg--quiet seg--small" aria-label="Result of the availability check">
        <span class="seg-label">Availability check says</span>
        <button type="button" data-free="1" aria-pressed="${state.free}">free</button>
        <button type="button" data-free="0" aria-pressed="${!state.free}">busy</button>
      </div>` : '';
  return `<p class="panel-kicker">Walkthrough · Paper §2.1 and §2.3</p>
    <div class="seg seg--quiet seg--small seg--variants" aria-label="Kind of assistant">
      ${Object.entries(reminderVariants).map(([key, v]) => `<button type="button" data-variant="${key}" aria-pressed="${state.variant === key}">${esc(v.name)}</button>`).join('')}
    </div>
    <p class="variant-caption">${esc(reminderVariants[state.variant].note)}</p>
    <div class="timeline">${timeline}</div>
    <div class="tl-legend"><span><i class="tl-key tl-key--request"></i>request</span><span><i class="tl-key tl-key--boundary"></i>interaction ends</span><span><i class="tl-key tl-key--outside"></i>no request</span></div>
    <div class="stepper">
      <span class="step-no">${state.step + 1}/${reminderSteps.length}</span>
      <button type="button" class="btn btn--ghost" data-step-move="-1" ${state.step === 0 ? 'disabled' : ''}>Back</button>
      <button type="button" class="btn" data-step-move="1" ${state.step === reminderSteps.length - 1 ? 'disabled' : ''}>Next step</button>
    </div>
    <h3 class="panel-title panel-title--step">${esc(step.title)}</h3>
    <p class="step-kind">${KIND_LABEL[step.kind]}</p>
    <p class="${note ? 'is-faded' : ''}">${esc(fillState(step.text, state.free))}</p>
    ${skippedNote}
    ${channelLine}
    ${choice}
    <div class="z-card" aria-label="Running state">${stateRows}</div>
    ${state.step === reminderSteps.length - 1 ? `<p class="panel-muted">${esc(reminderClosing)}</p>` : ''}`;
}

function renderEvolve(state) {
  const step = evolveSteps[state.step];
  const list = evolveSteps.map((s, i) => `<li class="${i === state.step ? 'is-current' : ''}${i < state.step ? ' is-done' : ''}"><button type="button" data-step="${i}">${esc(s.title)}</button></li>`).join('');
  const theta = step.theta === 'new'
    ? `<div class="theta-card is-revised"><span class="theta-key">θ<sub>t+1</sub></span><span>the revised timing rule: wait until the user is back at their workstation</span></div>`
    : `<div class="theta-card"><span class="theta-key">θ<sub>t</sub></span><span>current rules, unchanged</span></div>`;
  return `<p class="panel-kicker">Walkthrough · Paper §1 and §2.1</p>
    <div class="stepper">
      <span class="step-no">${state.step + 1}/${evolveSteps.length}</span>
      <button type="button" class="btn btn--ghost" data-step-move="-1" ${state.step === 0 ? 'disabled' : ''}>Back</button>
      <button type="button" class="btn" data-step-move="1" ${state.step === evolveSteps.length - 1 ? 'disabled' : ''}>Next step</button>
    </div>
    <h3 class="panel-title panel-title--step">${esc(step.title)}</h3>
    <p>${esc(step.text)}</p>
    ${step.formula ? `<p class="formula">${tex(KATEX, step.formula)}</p>` : ''}
    ${step.channel ? `<p class="step-channel">${channelLink(step.channel)} ${esc(byId[step.channel].short)}</p>` : ''}
    ${theta}
    <ol class="evolve-list">${list}</ol>`;
}

export function mountFramework(root) {
  if (!root) return;
  loadKatex().then(k => { KATEX = k; });
  root.innerHTML = figureHtml();
  const loop = root.querySelector('.loop');
  const svg = buildSvg();
  loop.prepend(svg);
  const panel = root.querySelector('.fw-panel');
  const packet = svg.querySelector('.packet');
  const state = {
    mode: 'explore',
    select: null,
    reminder: { step: 0, variant: 'continuing', free: true },
    evolve: { step: 0 }
  };
  let raf = 0;

  function stopPacket() {
    cancelAnimationFrame(raf);
    packet.style.display = 'none';
    packet.removeAttribute('data-ch');
  }

  function runPacket(channelId) {
    stopPacket();
    if (!channelId) return;
    const g = channelGeometry(byId[channelId]);
    packet.setAttribute('data-ch', channelId);
    packet.dataset.to = byId[channelId].to;
    packet.style.display = '';
    if (reduceMotion()) {
      packet.setAttribute('cx', g.mid.x);
      packet.setAttribute('cy', g.mid.y);
      return;
    }
    const duration = 1100;
    const pause = 650;
    const t0 = performance.now();
    const tick = now => {
      const phase = ((now - t0) % (duration + pause)) / duration;
      const t = Math.min(1, phase);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      packet.setAttribute('cx', g.start.x + (g.end.x - g.start.x) * e);
      packet.setAttribute('cy', g.start.y + (g.end.y - g.start.y) * e);
      packet.style.opacity = phase > 1 ? 0 : 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function highlight({ nodes = [], chans = [], dim = false }) {
    loop.classList.toggle('is-focused', dim);
    loop.querySelectorAll('[data-node]').forEach(el => el.classList.toggle('is-on', nodes.includes(el.dataset.node)));
    loop.querySelectorAll('[data-ch]').forEach(el => el.classList.toggle('is-on', chans.includes(el.dataset.ch)));
    root.querySelectorAll('.legend-item').forEach(el => el.classList.toggle('is-on', chans.includes(el.dataset.ch)));
  }

  function setTheta(text) {
    const tag = loop.querySelector('.node--A .node-theta');
    if (!text) { tag.hidden = true; return; }
    tag.hidden = false;
    tag.innerHTML = text;
  }

  function render() {
    root.querySelectorAll('[data-mode]').forEach(el => el.setAttribute('aria-selected', String(el.dataset.mode === state.mode)));
    root.querySelectorAll('.chip[data-cond], .chip[data-impl]').forEach(el => {
      const on = (state.select?.type === 'cond' && el.dataset.cond === state.select.id)
        || (state.select?.type === 'impl' && el.dataset.impl === state.select.id);
      el.classList.toggle('is-on', Boolean(on && state.mode === 'explore'));
    });
    root.classList.toggle('is-walkthrough', state.mode !== 'explore');
    setTheta(null);
    if (state.mode === 'reminder') {
      const step = reminderSteps[state.reminder.step];
      const skipped = reminderSkipped(step, state.reminder.variant);
      highlight({ nodes: skipped ? [] : step.active, chans: skipped || !step.channel ? [] : [step.channel], dim: true });
      runPacket(skipped ? null : step.channel);
      panel.innerHTML = renderReminder(state.reminder);
      return;
    }
    if (state.mode === 'evolve') {
      const step = evolveSteps[state.evolve.step];
      const nodes = step.channel ? [byId[step.channel].from, byId[step.channel].to] : ['M', 'A'];
      highlight({ nodes, chans: step.channel ? [step.channel] : [], dim: true });
      runPacket(step.channel);
      setTheta(step.theta === 'new' ? 'θ<sub>t+1</sub>' : 'θ<sub>t</sub>');
      panel.innerHTML = renderEvolve(state.evolve);
      return;
    }
    stopPacket();
    const sel = state.select;
    if (!sel) {
      highlight({});
      panel.innerHTML = renderOverview();
    } else if (sel.type === 'node') {
      const mod = modules[sel.id];
      highlight({ nodes: [sel.id], chans: mod.incoming, dim: true });
      panel.innerHTML = renderModule(sel.id);
    } else if (sel.type === 'ch') {
      const ch = byId[sel.id];
      highlight({ nodes: [ch.from, ch.to], chans: [sel.id], dim: true });
      runPacket(sel.id);
      panel.innerHTML = renderChannel(sel.id);
    } else if (sel.type === 'cond') {
      highlight({ nodes: ['S', 'M', 'A'], chans: channels.map(c => c.id), dim: false });
      panel.innerHTML = renderCondition(sel.id);
    } else if (sel.type === 'impl') {
      highlight({ nodes: ['S', 'M', 'A'], chans: [], dim: false });
      panel.innerHTML = renderImpl(sel.id);
    }
    panel.insertAdjacentHTML('beforeend', sel ? '<button type="button" class="link-btn" data-clear>Back to the overview</button>' : '');
  }

  function select(type, id) {
    state.mode = 'explore';
    state.select = state.select && state.select.type === type && state.select.id === id ? null : { type, id };
    render();
  }

  // Links elsewhere on the page, such as the takeaways, open a module here: <a data-fw-node="S">.
  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-fw-node]');
    if (!link || !modules[link.dataset.fwNode]) return;
    event.preventDefault();
    state.mode = 'explore';
    state.select = { type: 'node', id: link.dataset.fwNode };
    render();
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    (document.getElementById('modules') || root).scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  });

  root.addEventListener('click', event => {
    const t = event.target.closest('button, [data-ch]');
    if (!t || !root.contains(t)) return;
    if (t.dataset.mode) { state.mode = t.dataset.mode; render(); return; }
    if (t.dataset.color) {
      loop.dataset.color = t.dataset.color;
      root.querySelectorAll('[data-color]').forEach(el => el.setAttribute('aria-pressed', String(el === t)));
      return;
    }
    if (t.dataset.variant) { state.reminder.variant = t.dataset.variant; render(); return; }
    if (t.dataset.free !== undefined) { state.reminder.free = t.dataset.free === '1'; render(); return; }
    if (t.dataset.stepMove) {
      const key = state.mode === 'evolve' ? 'evolve' : 'reminder';
      const max = (key === 'evolve' ? evolveSteps : reminderSteps).length - 1;
      state[key].step = Math.max(0, Math.min(max, state[key].step + Number(t.dataset.stepMove)));
      render();
      return;
    }
    if (t.dataset.step !== undefined && t.closest('.fw-panel')) {
      const key = state.mode === 'evolve' ? 'evolve' : 'reminder';
      state[key].step = Number(t.dataset.step);
      render();
      return;
    }
    if (t.hasAttribute('data-clear')) { state.select = null; render(); return; }
    if (t.dataset.goCh) { select('ch', t.dataset.goCh); return; }
    if (t.dataset.node) { select('node', t.dataset.node); return; }
    if (t.dataset.cond) { select('cond', t.dataset.cond); return; }
    if (t.dataset.impl) { select('impl', t.dataset.impl); return; }
    if (t.dataset.ch) { select('ch', t.dataset.ch); }
  });

  loop.addEventListener('pointerover', event => {
    const t = event.target.closest('[data-ch], [data-node]');
    if (!t || state.mode !== 'explore' || state.select) return;
    loop.classList.add('is-hovering');
    const id = t.dataset.ch || t.dataset.node;
    loop.querySelectorAll('[data-ch], [data-node]').forEach(el => {
      const match = el.dataset.ch === id || el.dataset.node === id
        || (t.dataset.node && el.dataset.ch && (el.dataset.ch[0] === id || el.dataset.ch[1] === id));
      el.classList.toggle('is-hover', Boolean(match));
    });
  });
  loop.addEventListener('pointerout', event => {
    if (event.relatedTarget && loop.contains(event.relatedTarget) && event.relatedTarget.closest('[data-ch], [data-node]')) return;
    loop.classList.remove('is-hovering');
    loop.querySelectorAll('.is-hover').forEach(el => el.classList.remove('is-hover'));
  });

  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && state.mode === 'explore' && state.select) {
      state.select = null;
      render();
    }
    if (state.mode !== 'explore' && (event.key === 'ArrowRight' || event.key === 'ArrowLeft') && event.target.closest('.fw-panel, .loop')) {
      const key = state.mode === 'evolve' ? 'evolve' : 'reminder';
      const max = (key === 'evolve' ? evolveSteps : reminderSteps).length - 1;
      state[key].step = Math.max(0, Math.min(max, state[key].step + (event.key === 'ArrowRight' ? 1 : -1)));
      render();
    }
  });

  // SVG groups are not focusable; forward clicks on lines to the channel.
  svg.addEventListener('click', event => {
    const g = event.target.closest('.ch');
    if (g) select('ch', g.dataset.ch);
  });

  render();
}

export function mountAdjacent(root) {
  if (!root) return;
  const togglesRoot = root.parentElement?.querySelector('[data-adjacent-toggles]');
  const want = [null, null, null];
  const symbol = { yes: '●', no: '○', opt: '–' };
  const label = { yes: 'yes', no: 'no', opt: 'not required or varies' };
  const togglesHtml = `
    <div class="adj-toggles" role="group" aria-label="Properties">
      ${adjacentProps.map((p, i) => `<div class="adj-toggle"><span>${esc(p)}</span>
        <div class="seg seg--quiet seg--small">
          <button type="button" data-prop="${i}" data-val="yes" aria-pressed="false">yes</button>
          <button type="button" data-prop="${i}" data-val="no" aria-pressed="false">no</button>
        </div></div>`).join('')}
    </div>`;
  const tableHtml = `
    <table class="adj-table">
      <thead><tr><th scope="col">Kind of agent</th>${adjacentProps.map(p => `<th scope="col">${esc(p)}</th>`).join('')}</tr></thead>
      <tbody>${adjacentKinds.map((k, r) => `<tr data-row="${r}" class="${k.ours ? 'is-ours' : ''}"><th scope="row">${esc(k.name)}</th>${k.v.map(v => `<td class="v-${v}"><span aria-hidden="true">${symbol[v]}</span><span class="sr-only">${label[v]}</span></td>`).join('')}</tr>`).join('')}</tbody>
    </table>
    <p class="adj-note">● yes · ○ no · – not required or varies by design. Rows describe typical designs, and a system can combine them.</p>`;
  if (togglesRoot) {
    togglesRoot.innerHTML = togglesHtml;
    root.innerHTML = tableHtml;
  } else {
    root.innerHTML = togglesHtml + tableHtml;
  }
  const scope = togglesRoot ? root.parentElement : root;
  const update = () => {
    scope.querySelectorAll('[data-prop]').forEach(b => b.setAttribute('aria-pressed', String(want[b.dataset.prop] === b.dataset.val)));
    const any = want.some(Boolean);
    root.querySelectorAll('tbody tr').forEach(tr => {
      const kind = adjacentKinds[tr.dataset.row];
      const match = kind.v.every((v, i) => !want[i] || v === 'opt' || v === want[i]);
      tr.classList.toggle('is-match', any && match);
      tr.classList.toggle('is-miss', any && !match);
    });
  };
  scope.addEventListener('click', event => {
    const b = event.target.closest('[data-prop]');
    if (!b) return;
    const i = Number(b.dataset.prop);
    want[i] = want[i] === b.dataset.val ? null : b.dataset.val;
    update();
  });
  update();
}
