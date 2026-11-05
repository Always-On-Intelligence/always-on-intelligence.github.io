// The main finding of the paper (abstract, §1, §7.1, §8): the two channels with the thinnest support,
// Memory guiding Sensing and outcomes from Action returning to Memory. Each is shown in the paper's
// running example (a reminder to send a report after a meeting) as a small demonstration, followed by
// the paper's counts from Table 22 (site/data/halo-read.json) and the open problem it raises.

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const loadRead = () => fetch(new URL('./data/halo-read.json', import.meta.url)).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

// ---------- 1. Memory → Sensing: the meeting moves ----------
// Times are minutes after 13:30. The meeting is stored as 14:00–15:00; an email can move its end to 16:00.
const T0 = 13 * 60 + 30, T1 = 16 * 60 + 40;
const hm = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
const W = 760, L = 150, R = 24;
const X = t => L + ((t - T0) / (T1 - T0)) * (W - L - R);

function staleScene(moved) {
  const end = moved ? 16 * 60 : 15 * 60;
  // lane A trusts its stored end time; lane B also checks the calendar now and then
  const lanes = [
    { name: 'Trusts its record', note: 'stored end: 15:00', checks: [], remind: 15 * 60 + 5 },
    { name: 'Also checks now and then', note: moved ? 'stored end: 15:00, then 16:00 after its check' : 'stored end: 15:00', checks: [14 * 60 + 30, 15 * 60 + 30].filter(t => t < end + 30), remind: end + 5 }
  ];
  const result = lane => lane.remind > end ? 'ok' : 'bad';
  return { end, lanes, result, moved };
}

function staleSvg(sc) {
  const rowY = [46, 112, 172];
  const f = v => v.toFixed(1);
  const ticks = [14, 15, 16].map(h => `<line class="sd-tick" x1="${f(X(h * 60))}" x2="${f(X(h * 60))}" y1="22" y2="200"/><text class="sd-time" x="${f(X(h * 60))}" y="216">${h}:00</text>`).join('');
  const meeting = `<rect class="sd-meeting" x="${f(X(14 * 60))}" y="${rowY[0] - 11}" width="${f(X(sc.end) - X(14 * 60))}" height="22" rx="6" data-t="${14 * 60}"/>
    <text class="sd-meeting-label" x="${f(X(14 * 60) + 10)}" y="${rowY[0] + 4}">Meeting${sc.moved ? ', now until 16:00' : ''}</text>
    ${sc.moved ? `<rect class="sd-planned" x="${f(X(14 * 60))}" y="${rowY[0] - 11}" width="${f(X(15 * 60) - X(14 * 60))}" height="22" rx="6"/>
    <g class="sd-ev" data-t="${14 * 60 + 20}"><circle cx="${f(X(14 * 60 + 20))}" cy="${rowY[0] - 22}" r="4"/><text x="${f(X(14 * 60 + 20) + 8)}" y="${rowY[0] - 18}">14:20 email: the meeting runs until 16:00</text></g>` : ''}`;
  const lanes = sc.lanes.map((lane, i) => {
    const y = rowY[i + 1];
    const ok = sc.result(lane) === 'ok';
    return `<text class="sd-lane" x="12" y="${y - 2}">${lane.name}</text><text class="sd-note" x="12" y="${y + 14}">${lane.note}</text>
      <line class="sd-rail" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/>
      ${lane.checks.map(t => `<g class="sd-ev sd-check" data-t="${t}"><circle cx="${f(X(t))}" cy="${y}" r="7"/><text x="${f(X(t))}" y="${y + 4}">?</text><text class="sd-cap" x="${f(X(t))}" y="${y + 24}">checks ${hm(t)}</text></g>`).join('')}
      <g class="sd-ev sd-remind ${ok ? 'is-ok' : 'is-bad'}" data-t="${lane.remind}"><circle cx="${f(X(lane.remind))}" cy="${y}" r="10"/><text x="${f(X(lane.remind))}" y="${y + 4.5}">${ok ? '✓' : '✕'}</text>
        <text class="sd-cap" x="${f(X(lane.remind))}" y="${y + 28}">reminds ${hm(lane.remind)}</text></g>`;
  }).join('');
  return `<svg class="sd-svg" viewBox="0 0 ${W} 226" role="img" aria-label="${sc.moved ? 'The meeting moves to 16:00. The assistant that trusts its record reminds at 15:05, during the meeting. The assistant that also checks sees the change at 14:30 and reminds at 16:05.' : 'The meeting ends at 15:00, and both assistants remind at 15:05.'}">
    ${ticks}<text class="sd-lane" x="12" y="${rowY[0] + 4}">The user’s afternoon</text>${meeting}${lanes}
    <line class="sd-head" x1="${L}" x2="${L}" y1="14" y2="202"/>
  </svg>`;
}

function staleCaption(sc) {
  if (!sc.moved) return 'Nothing changes, so both assistants remind at 15:05, right after the meeting. The extra check costs a little and finds nothing new.';
  return 'The assistant that trusts its record never looks again, so its reminder lands in the middle of the meeting. The one that also checks now and then sees the change at 14:30 and waits until 16:05.';
}

function mountStale(el) {
  let moved = false, raf = 0;
  el.innerHTML = `<div class="sd-bar">
      <div class="seg seg--quiet seg--small" role="group" aria-label="What happens in the afternoon">
        <button type="button" data-moved="0" aria-pressed="true">The meeting ends at 15:00</button>
        <button type="button" data-moved="1" aria-pressed="false">An email moves it to 16:00</button>
      </div>
      <button type="button" class="btn btn--ghost sd-play" data-play>▶ Play the afternoon</button>
    </div>
    <div class="sd-stage"></div>
    <p class="sd-caption" aria-live="polite"></p>`;
  const stage = el.querySelector('.sd-stage');
  const caption = el.querySelector('.sd-caption');
  const draw = () => {
    const sc = staleScene(moved);
    stage.innerHTML = staleSvg(sc);
    caption.textContent = '';
    return sc;
  };
  const play = () => {
    cancelAnimationFrame(raf);
    const sc = draw();
    const head = stage.querySelector('.sd-head');
    const evs = [...stage.querySelectorAll('[data-t]')];
    const finish = () => { evs.forEach(e => e.classList.add('is-on')); head.setAttribute('transform', `translate(${X(T1) - L},0)`); caption.textContent = staleCaption(sc); };
    if (reduced()) { finish(); return; }
    const start = performance.now(), dur = 6000;
    const tick = now => {
      const k = Math.min(1, (now - start) / dur);
      const t = T0 + k * (T1 - T0);
      head.setAttribute('transform', `translate(${(X(t) - L).toFixed(1)},0)`);
      evs.forEach(e => e.classList.toggle('is-on', Number(e.dataset.t) <= t));
      if (k < 1) raf = requestAnimationFrame(tick); else finish();
    };
    raf = requestAnimationFrame(tick);
  };
  el.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.moved !== undefined) {
      moved = b.dataset.moved === '1';
      el.querySelectorAll('[data-moved]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      play();
    } else if (b.dataset.play !== undefined) play();
  });
  // play once when the demonstration first comes into view
  draw();
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => { if (entries.some(x => x.isIntersecting)) { io.disconnect(); play(); } }, { threshold: 0.5 });
    io.observe(el);
  }
}

// ---------- 2. Action → Memory: learning from dismissals ----------
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STEPS = [
  { id: 'record', name: 'Record', text: 'Action keeps each reminder with its time and the rule that chose it: “remind at the end of the meeting”.' },
  { id: 'outcome', name: 'Outcome', text: 'The outcomes arrive later and say little: the user dismisses each reminder and sends the report about forty minutes later, back at the workstation.' },
  { id: 'attribution', name: 'Attribution', text: 'The assistant links each dismissal to the decision behind it, and to the timing rule, not just to “too many reminders”.' },
  { id: 'revision', name: 'Revision', text: 'It revises the rule: wait until the user is back at the workstation. This changes how the assistant works, not only what it remembers.' },
  { id: 'later_use', name: 'Later use', text: 'Later reminders run under the revised rule and are accepted. Only this step shows that the revision was used.' }
];

function learnSvg(step) {
  const f = v => v.toFixed(1);
  const col = i => 62 + i * 96;
  const revised = step >= 3;
  const days = DAYS.map((d, i) => {
    const later = i >= 3;
    const x = col(i);
    const show = !later || step >= 4;
    const at = later ? '15:40' : '15:00';
    const ok = later;
    return `<g class="ld-day${show ? ' is-on' : ''}">
      <text class="ld-d" x="${x}" y="22">${d}</text>
      <rect class="ld-meet" x="${x - 40}" y="34" width="56" height="16" rx="5"/><text class="ld-meet-l" x="${x - 12}" y="46">meeting</text>
      <g class="ld-rem${step >= 1 || later ? (ok ? ' is-ok' : ' is-bad') : ''}"><circle cx="${later ? x + 30 : x + 22}" cy="80" r="11"/><text x="${later ? x + 30 : x + 22}" y="84.5">${step >= 1 || later ? (ok ? '✓' : '✕') : '•'}</text></g>
      <text class="ld-at" x="${later ? x + 30 : x + 22}" y="106">${at}</text>
      ${!later && step >= 1 ? `<text class="ld-sent" x="${x + 22}" y="122">report 15:40</text>` : ''}
      ${!later && step >= 2 ? `<path class="ld-link" d="M${x + 22},128 C${x + 22},146 310,140 310,158"/>` : ''}
    </g>`;
  }).join('');
  return `<svg class="ld-svg" viewBox="0 0 620 200" role="img" aria-label="A week of reminders. ${STEPS[step].text}">
    <line class="ld-split" x1="${col(3) - 52}" x2="${col(3) - 52}" y1="10" y2="140"/>
    ${days}
    <g class="ld-rule${step >= 2 ? ' is-hot' : ''}${revised ? ' is-revised' : ''}"><rect x="160" y="160" width="300" height="30" rx="15"/>
      <text x="310" y="180">${revised ? 'Rule θ₂: wait until back at the workstation' : 'Rule θ₁: remind at the end of the meeting'}</text></g>
  </svg>`;
}

function funnelHtml(counts, n, step) {
  return `<div class="ld-funnel" aria-label="Works in Table 22 that state each step">
    <p class="ld-funnel-head">Works that show each step <small>of ${n}</small></p>
    ${STEPS.map((s, i) => `<div class="ld-f${i === step ? ' is-on' : ''}${i < step ? ' is-done' : ''}"><span>${s.name}</span><b><i style="width:${((counts[s.id] / n) * 100).toFixed(1)}%"></i></b><em>${counts[s.id]}</em></div>`).join('')}
  </div>`;
}

function mountLearn(el, read) {
  let step = 0;
  const counts = read?.counts?.stated, n = read?.counts?.works;
  const render = () => {
    el.innerHTML = `<div class="ld-steps" role="group" aria-label="Five steps of evidence">
        ${STEPS.map((s, i) => `<button type="button" data-step="${i}" aria-pressed="${i === step}" class="${i < step ? 'is-done' : ''}"><span>${i + 1}</span>${s.name}</button>`).join('')}
      </div>
      <div class="ld-body">
        <div class="ld-stage">${learnSvg(step)}<p class="sd-caption">${STEPS[step].text}</p></div>
        ${counts ? funnelHtml(counts, n, step) : ''}
      </div>
      <div class="ld-nav"><button type="button" class="btn btn--ghost" data-move="-1" ${step === 0 ? 'disabled' : ''}>Back</button><button type="button" class="btn" data-move="1" ${step === STEPS.length - 1 ? 'disabled' : ''}>Next step</button></div>`;
  };
  el.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.step !== undefined) step = Number(b.dataset.step);
    else if (b.dataset.move) step = Math.max(0, Math.min(STEPS.length - 1, step + Number(b.dataset.move)));
    else return;
    render();
  });
  render();
}

// ---------- evidence bars ----------
function channelBars(el, read) {
  const n = read.counts.works, rep = read.counts.reported;
  const rows = [['Memory guides Action', 'M→A'], ['Memory guides Sensing', 'M→S']];
  el.innerHTML = rows.map(([name, ch]) => `<div class="gap-bar"><span>${name} <small>${ch}</small></span><b><i style="width:${((rep[ch] / n) * 100).toFixed(1)}%"></i></b><em>${rep[ch]} of ${n}</em></div>`).join('');
}

export function mountFindings(root) {
  const stale = root.querySelector('[data-demo="stale"]');
  if (stale) mountStale(stale);
  loadRead().then(read => {
    const learn = root.querySelector('[data-demo="learn"]');
    if (learn) mountLearn(learn, read);
    const bars = root.querySelector('[data-bars="channels"]');
    if (bars) channelBars(bars, read);
  }).catch(error => {
    console.error(error);
    const learn = root.querySelector('[data-demo="learn"]');
    if (learn) mountLearn(learn, null);
  });
}
