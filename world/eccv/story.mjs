import * as THREE from 'three';
import { installTour, TOUR_ABORT } from '../engine/tour.mjs';

// The always-on glasses at Poster Session 6, told as the paper's reminder example:
// a request creates an open task, an interaction boundary passes, and later steps
// outside any request decide to wait or act on it. Every step names the module or
// channel it exercises (Section 2), where it comes from (EgoPoster today, the
// always-on target, or the self-evolving extension) and how one would build it.

const PLAN = [108, 175, 172, 402, 424];
const HISTORY = [
  { day: { en: 'Thu', zh: '周四' }, session: 'Session 2', n: 13, title: 'GeoBrowse: A Geolocation Benchmark for Agentic Tool Use with Expert-Annotated Reasoning Traces', link: 108 },
  { day: { en: 'Thu', zh: '周四' }, session: 'Session 2', n: 214, title: 'Vinci2: Providing Proactive Assistance in Continuous Egocentric Videos' },
  { day: { en: 'Fri', zh: '周五' }, session: 'Session 4', n: 209, title: "Let's Reward Step-by-Step: Step-Aware Contrastive Alignment for Vision-Language Navigation in Continuous Environments", link: 424 },
];
const PROFILE = {
  en: 'Embodied agents and first-person assistants; geolocation, map reasoning and navigation benchmarks. Goal: ideas for evaluation.',
  zh: '具身智能体和第一视角助手；关注地理定位、地图推理和导航 benchmark。目标：找评测思路。',
};
const CONTRACT = [
  { en: 'On duty during the conference; today until 17:00, when Poster Session 6 ends.', zh: '会议期间工作；今天到 17:00，也就是 Session 6 结束。' },
  { en: 'May speak when you are not in a conversation, about your plan, your open tasks and official sessions.', zh: '你不在对话中时才开口，只说你的计划、待办和官方日程。' },
  { en: 'Faces and screens are blurred before processing; only contacts you registered are recognised.', zh: '人脸和屏幕在处理前先模糊；只认出你登记过的联系人。' },
  { en: 'Nothing is sent or emailed without approval.', zh: '未经批准，不发送、不发邮件。' },
  { en: 'Interests, trail and open tasks are kept across days; delete anything at any time.', zh: '兴趣、足迹和待办跨天保留；随时可以删除。' },
];
// Short policy and condition names, following the module and condition lists of Section 2.
const P = {
  interpret: { en: 'π_S interpret: read the frame; a title counts once it reads the same twice', zh: 'π_S 解读：读画面；标题两次一致才算数' },
  segment: { en: 'π_S segment: bind speech to the poster in view', zh: 'π_S 切分：把语音绑定到眼前的 Poster' },
  attend: { en: 'π_S allocate attention', zh: 'π_S 分配注意力' },
  filter: { en: 'π_S filter: blur faces and screens first', zh: 'π_S 过滤：先模糊人脸和屏幕' },
  admit: { en: 'π_M admit and encode', zh: 'π_M 接纳并编码' },
  retrieve: { en: 'π_M retrieve', zh: 'π_M 检索' },
  retire: { en: 'π_M retire', zh: 'π_M 退役' },
  gate: { en: 'π_A gate: intervene or stay silent', zh: 'π_A 门控：介入还是保持安静' },
  timing: { en: 'π_A select timing', zh: 'π_A 选择时机' },
  effector: { en: 'π_A choose the effector within granted authority', zh: 'π_A 在授权范围内选择执行方式' },
};
const C = {
  privacy: { en: 'Privacy', zh: '隐私' },
  authority: { en: 'Authority', zh: '权限' },
  availability: { en: 'Availability', zh: '可用性' },
  uncertainty: { en: 'Uncertainty', zh: '不确定性' },
  resources: { en: 'Resources', zh: '资源' },
};
const ABORT = TOUR_ABORT;

// Scenes of the guided walk, for skipping and jumping.
const CHAPTERS = [
  { id: 'booth', time: '15:00', title: { en: 'Booth 44: contract and plan', zh: 'Booth 44：约定和计划' } },
  { id: 'p108', time: '15:04', title: { en: '#108: a next stop too early', zh: '#108：下一站提示得太早' } },
  { id: 'p175', time: '15:12', title: { en: '#175: busy presenter, one request', zh: '#175：讲者很忙，一次请求' } },
  { id: 'coffee', time: '15:22', title: { en: '#172, then coffee with the glasses off', zh: '#172，然后摘下眼镜喝咖啡' } },
  { id: 'p402', time: '16:25', title: { en: 'Glasses back on: θ₂ at #402', zh: '戴回眼镜：#402 用上 θ₂' } },
  { id: 'pass175', time: '16:35', title: { en: 'Passing #175: wait, then remind', zh: '路过 #175：先等，再提醒' } },
  { id: 'back175', time: '16:38', title: { en: 'Back at #175: the task retires', zh: '回到 #175：待办完成' } },
  { id: 'p424', time: '16:47', title: { en: '#424, the last stop', zh: '#424，最后一站' } },
  { id: 'end', time: '17:00', title: { en: 'Off duty: the memory card', zh: '下班：记忆卡' } },
];
const hhmm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(Math.floor(min % 60)).padStart(2, '0')}`;
const freshMemory = () => ({ trail: [], theta: 1, dismissals: 0, pending: [], done: [], reminded: false, seen: new Set(), revision: 'none' });

export class EccvStory {
  constructor({ world, venue, player, hud, minimap, camera, lang, t, L }) {
    Object.assign(this, { world, venue, player, hud, minimap, camera, lang, t, L });
    this.clock = 15 * 60;
    this.mem = freshMemory();
    this.focus = null;
    this.gaze = null;
    this.tour = null;
    this.glassesOn = true;
    this.watch = new Set();
    this.conversation = false;
    this.decision = { kind: 'wait', text: { en: 'nothing needs you', zh: '没有需要你的事' } };
    this.visits = new Map(venue.demo.visits.map(v => [v.board, v]));
    this.zoneId = null;
    this.lastWait = 0;
    this.passed = [];
    this.nextTarget = null;
    this.blurPool = [];
    this.blurCount = 0;
    this.tmp = new THREE.Vector3();
    this.colleague = null;
    this.extra = world.crowd.people.find(p => p.kind === 'extra');
    this.hud.setStatus({ session: t('session'), time: hhmm(this.clock) });
    this.hud.setContract(t('contract'), () => this.openContract());
    this.bindUi();
    this.bindTourUi(CHAPTERS);
    setTimeout(() => {
      if (this.tour) return;
      this.step('note', null, 'S', { en: 'Glasses on. Sensing runs between your requests; faces are blurred first.', zh: '眼镜已戴上。Sensing 在你的请求之间也在运行，人脸先做模糊。' }, null,
        { src: 'ego', policy: P.filter, condition: C.privacy, build: { en: 'Detect and blur on the device, before frames reach a model or storage.', zh: '在设备端检测并模糊，画面到达模型或存储之前就处理掉。' } });
      this.hud.toast({ title: this.L({ en: 'Look at any poster for a moment', zh: '看任意一张 Poster 片刻' }),
        text: this.L({ en: 'The glasses start a card, and the panel on the left shows which module did what. Or take the guided walk through one afternoon.', zh: '眼镜会开始建卡片，左侧面板显示每一步由哪个模块完成。也可以跟着导览走完一个下午。' }), ttl: 10000,
        actions: [{ label: this.t('startTour'), run: () => this.startTour() }] });
    }, 1500);
  }

  // ------------------------------------------------------------ helpers
  get time() { return hhmm(this.clock); }
  paper(n) { return this.venue.papers[String(n)]; }
  board(n) { return this.world.boardIndex.get(n); }
  short(n) {
    const v = this.visits.get(n);
    if (v) return v.id === 'gaga' ? 'GaGA' : v.title.split(':')[0];
    return (this.paper(n)?.t || `#${n}`).split(':')[0].slice(0, 42);
  }
  row(board) {
    const i = this.venue.rows.findIndex(r => Math.abs(r.z - board.z) < 0.01);
    return this.lang === 'zh' ? `第 ${i + 1} 排` : `Row ${i + 1}`;
  }
  dist(n) {
    const [sx, sz] = this.world.standPoint(this.board(n));
    return Math.hypot(sx - this.player.x, sz - this.player.z);
  }
  metres(n) { return `${Math.max(1, Math.round(this.dist(n)))} m`; }

  /** Log one step of the loop. */
  step(kind, channel, module, text, detail = null, meta = {}) {
    const L = this.L;
    this.hud.trace({ time: this.time, kind, channel, module, text: L(text), detail: L(detail), src: meta.src || 'ego',
      meta: { policy: L(meta.policy), grounds: L(meta.grounds), condition: L(meta.condition), build: L(meta.build) } });
    if (kind === 'act' || kind === 'wait') this.decision = { kind, text: meta.short || text };
  }

  bindUi() {
    const hud = this.hud;
    hud.el('[data-trail]').addEventListener('click', () => this.openTrail());
    hud.el('[data-about]').addEventListener('click', () => this.openAbout());
    hud.el('[data-glasses]').addEventListener('click', () => { if (!this.tour) this.setGlasses(!this.glassesOn); });
  }

  // ------------------------------------------------------------ poster card
  /** A click on a poster within reach opens its card at once, instead of waiting for the gaze to settle. */
  readPoster(n) {
    if (this.tour || !this.glassesOn || this.focus?.n === n) return;
    if (this.focus) this.leave(this.focus);
    this.recognize(n, { again: this.mem.seen.has(n) });
    if (this.nextTarget === n) this.nextTarget = null;
  }

  recognize(n, { again = false } = {}) {
    const b = this.board(n), p = this.paper(n);
    this.focus = { n, since: performance.now(), stage: 0, away: 0 };
    this.mem.seen.add(n);
    this.hud.showCard({ number: String(n), row: this.row(b), title: p?.t || '', authors: p?.a || '', origin: p?.f || '' });
    this.step('update', 'SM', null,
      again ? { en: `Back at #${n}: the card from earlier is reopened.`, zh: `回到 #${n}：之前的卡片被重新打开。` } : { en: `Poster #${n} recognized: the title read the same twice.`, zh: `识别出 #${n}：标题连续两次读到一致。` },
      { en: 'New evidence enters Memory as the poster’s card.', zh: '新证据以这张 Poster 的卡片进入 Memory。' },
      { src: 'ego', policy: P.interpret, condition: C.uncertainty, build: { en: 'A vision-language model reads each frame; the card is admitted only after two matching title reads.', zh: '视觉语言模型逐帧读取；标题两次读到一致才把卡片收进 Memory。' } });
    this.hud.pulseSensor('camera', true);
    setTimeout(() => this.hud.pulseSensor('camera', false), 1400);
    if (this.mem.revision === 'ready' && !this.tour) this.activateRevision({ en: 'at this new poster', zh: '在这张新 Poster 开始时' });
    if (!this.tour && this.presenterNear(n) && !this.mem.pending.some(t => t.n === n && t.status === 'open')) {
      this.hud.cardActions([{ label: this.t('comeBack'), run: () => this.request(n) }]);
    }
  }

  presenterNear(n) {
    const b = this.board(n);
    return this.world.crowd.people.some(p => p.kind === 'presenter' && p.board === n && !p.hidden && Math.hypot(p.x - b.x, p.z - b.z) < 2.2);
  }

  presenterBusy(n) {
    return this.world.crowd.people.filter(p => p.busyAt === n && !p.hidden).length >= 2;
  }

  stage(n, k) {
    const v = this.visits.get(n), p = this.paper(n), t = this.t;
    if (k === 1) {
      if (this.presenterNear(n)) {
        this.hud.pulseSensor('mic', true);
        this.step('update', 'SM', null, { en: `The presenter’s explanation is transcribed and bound to #${n}.`, zh: `讲者的讲解被转写，并绑定到 #${n}。` }, null,
          { src: 'ego', policy: P.segment, build: { en: 'Streaming speech recognition; each final segment attaches to the poster in view.', zh: '流式语音识别；每段定稿绑定到当前视野里的 Poster。' } });
      }
      if (v) this.hud.cardSection({ id: 'insights', label: t('insights'), channel: 'SM', items: v.insights });
      else if (p?.s) this.hud.cardSection({ id: 'insights', label: t('fromPoster'), channel: 'SM', body: p.s });
      else this.hud.cardSection({ id: 'insights', label: t('topic'), channel: 'SM', body: p?.k || '' });
    } else if (k === 2) {
      if (!v?.questions?.length) return false;
      this.hud.cardSection({ id: 'questions', label: t('questions'), channel: 'MA', items: v.questions });
      this.step('act', 'MA', null, { en: 'Two questions for the author, drawn from your interests.', zh: '根据你的兴趣，给出两个可以问作者的问题。' }, null,
        { src: 'ego', policy: P.timing, grounds: { en: 'your interests in Memory; the card so far', zh: 'Memory 里的兴趣；目前的卡片' }, build: { en: 'Prompt the model with the card and the stored interests.', zh: '把卡片和存下的兴趣一起交给模型生成。' } });
    } else if (k === 3) {
      const links = HISTORY.filter(h => h.link === n);
      const items = [];
      if (v) items.push(v.topic, v.academic);
      else if (p?.k) items.push(this.L({ en: `Topic: ${p.k}`, zh: `主题：${p.k}` }));
      for (const h of links) items.push(this.L({ en: `${h.day.en}: you stopped at #${h.n} ${h.title.split(':')[0]}.`, zh: `${h.day.zh}：你看过 #${h.n} ${h.title.split(':')[0]}。` }));
      if (!items.length) return false;
      this.hud.cardSection({ id: 'connections', label: t('connections'), channel: 'MA', items });
      if (links.length) {
        this.step('act', 'MA', null, { en: `Linked to ${links.map(h => '#' + h.n).join(', ')} from ${links[0].day.en}.`, zh: `关联到${links[0].day.zh}看过的 ${links.map(h => '#' + h.n).join('、')}。` },
          { en: 'State durability at work: an earlier day shapes today’s card.', zh: '状态持久在起作用：前几天的记录影响今天的卡片。' },
          { src: 'ego', policy: P.retrieve, grounds: { en: 'the trail kept across days', zh: '跨天保存的足迹' }, build: { en: 'Retrieve past stops by topic and author overlap, not by time.', zh: '按主题和作者重合检索过去的停留，而不是按时间。' } });
      }
    }
    return true;
  }

  nextFor(n) {
    const unseen = (k) => !this.mem.trail.some(v => v.n === k) && k !== n;
    const i = PLAN.indexOf(n);
    if (i >= 0) return PLAN.slice(i + 1).find(unseen) ?? PLAN.find(unseen) ?? null;
    const topic = this.paper(n)?.k;
    let best = null, bestD = Infinity;
    for (const b of this.world.boards) {
      const p = this.paper(b.n);
      if (!p || !unseen(b.n) || this.mem.seen.has(b.n) || p.k !== topic) continue;
      const d = Math.hypot(b.x - this.player.x, b.z - this.player.z);
      if (d > 4 && d < bestD) { best = b.n; bestD = d; }
    }
    return best ?? PLAN.find(unseen) ?? null;
  }

  offerNext(n, { during = false } = {}) {
    const next = this.nextFor(n);
    if (!next) return null;
    const v = this.visits.get(n);
    const reason = v?.next?.[0]?.reason || this.L({ en: `Same topic, ${this.metres(next)} away.`, zh: `同一主题，距离 ${this.metres(next)}。` });
    this.hud.cardSection({ id: 'next', label: this.t('next'), channel: 'MA', tone: 'next', items: [`#${next} ${this.short(next)} · ${this.metres(next)}`, reason] });
    this.nextTarget = next;
    this.showRoute(next);
    this.step('act', 'MA', null, { en: `Next stop: #${next} ${this.short(next)}, ${this.metres(next)}.`, zh: `下一站：#${next} ${this.short(next)}，${this.metres(next)}。` },
      during ? { en: 'Shown while the presenter is still talking, under rule θ₁.', zh: '按规则 θ₁，在讲者还在讲时弹出。' } : null,
      { src: 'ego', policy: P.timing, grounds: { en: 'plan and trail in Memory', zh: 'Memory 里的计划和足迹' }, short: { en: `next stop #${next}`, zh: `下一站 #${next}` },
        build: { en: 'Rule θ₁: show the next stop as soon as the card is complete.', zh: '规则 θ₁：卡片一完整就显示下一站。' } });
    return next;
  }

  dismissNext(n, { byScript = false } = {}) {
    this.hud.removeSection('next');
    this.minimap.setRoute(null);
    this.mem.dismissals += 1;
    if (byScript) this.hud.caption(this.L({ en: 'You swipe the card away: not now.', zh: '你把卡片划掉了：现在不要。' }), 2600);
    this.step('update', 'AM', null, { en: `You dismissed the next stop while the presenter at #${n} was talking.`, zh: `讲者还在讲 #${n} 时，你关掉了「下一站」。` },
      { en: 'The action, its context and your response go back to Memory.', zh: '行动、当时的情境和你的反应回到 Memory。' },
      { src: 'target', policy: P.admit, build: { en: 'Log each intervention with its context and outcome, so later revisions have evidence.', zh: '每次介入连同情境和结果一起记下，之后的修订才有依据。' } });
    if (!this.tour && this.mem.dismissals >= 2 && this.mem.revision === 'none') this.proposeRevision();
  }

  showRoute(next) {
    const path = this.player.nav.findPath([this.player.x, this.player.z], this.world.standPoint(this.board(next)));
    this.minimap.setRoute(path);
  }

  archive(n) {
    if (!this.focus || this.focus.n !== n) return;
    const minutes = Math.max(1, Math.round((performance.now() - this.focus.since) / 1000 / 6));
    const known = this.mem.trail.find(v => v.n === n);
    if (!known) this.mem.trail.push({ n, at: this.time, minutes: this.tourMinutes ?? minutes });
    else known.minutes += this.tourMinutes ?? minutes;
    this.step('update', 'SM', null, { en: `Visit saved to today’s trail: #${n}.`, zh: `这次停留记入今天的足迹：#${n}。` }, null,
      { src: 'ego', policy: P.admit, build: { en: 'Dwell time and the card are written to the user’s trail as the visit ends.', zh: '停留结束时，把时长和卡片写进用户的足迹。' } });
    this.lastArchived = { n, at: performance.now() };
    this.focus = null;
    this.hud.pulseSensor('mic', false);
    this.hud.hideCard();
  }

  // ------------------------------------------------------------ the open task
  request(n) {
    const L = this.L;
    this.hud.say(L({ en: 'You', zh: '你' }), L({ en: 'Remind me to come back when the presenter is free.', zh: '讲者空了提醒我回来。' }), 4200);
    this.step('request', 'SM', null, { en: 'You ask: remind me to come back when the presenter is free.', zh: '你说：讲者空了提醒我回来。' },
      { en: 'A request step, one of the few steps you start yourself.', zh: '这是一次请求，是少数由你发起的步骤之一。' },
      { src: 'target', policy: P.interpret, build: { en: 'Speech to intent: remind(when = presenter free at the poster).', zh: '语音转成意图：提醒（条件 = 这张 Poster 的讲者空闲）。' } });
    const task = { id: `back-${n}`, n, status: 'open', since: performance.now(), label: { en: `back to #${n} when the presenter is free`, zh: `讲者空了回到 #${n}` } };
    this.mem.pending.push(task);
    this.watch.add(n);
    this.step('update', null, 'M', { en: `Open task kept: back to #${n} when the presenter is free.`, zh: `待办已保存：讲者空了回到 #${n}。` },
      { en: 'Memory keeps it as a condition to watch, not as a timer.', zh: 'Memory 把它存成一个要留意的条件，而不是定时器。' },
      { src: 'target', policy: P.admit, build: { en: 'Store a conditional commitment with its trigger and an expiry at the end of the session.', zh: '存成带触发条件的承诺，在场次结束时过期。' } });
    return task;
  }

  /** Steps outside any request about an open task: observe it (Sensing side), then decide (Action side). */
  checkTask(task, now) {
    if (task.status !== 'open' || !this.glassesOn) return;
    const b = this.board(task.n);
    if (!task.freed && !this.tour && now - task.since > 40000 && Math.hypot(b.x - this.player.x, b.z - this.player.z) > 9) this.freePresenter(task.n);
    if (this.focus?.n === task.n) return;
    if (this.observeTask(task)) this.decideTask(task);
  }

  taskVisible(task) {
    const b = this.board(task.n);
    const d = Math.hypot(b.x - this.player.x, b.z - this.player.z);
    const fwd = this.camera.getWorldDirection(this.tmp);
    return d < 16 && ((b.x - this.player.x) * fwd.x + (b.z - this.player.z) * fwd.z) / (d || 1) > 0.2 && -(b.z - this.player.z) * b.side > 0.5;
  }

  /** Returns true once the presenter has been seen free. */
  observeTask(task, force = false) {
    if (!force && !this.taskVisible(task)) return false;
    if (!task.checked) {
      task.checked = true;
      this.step('act', 'MS', null, { en: `The open task turns Sensing towards #${task.n} as you pass.`, zh: `这条待办让 Sensing 在你路过时看向 #${task.n}。` }, null,
        { src: 'target', policy: P.attend, grounds: { en: 'open task in Memory', zh: 'Memory 里的待办' }, build: { en: 'Each open task registers a visual check that fires whenever its poster is in view.', zh: '每条待办登记一个视觉检查，它的 Poster 一进视野就触发。' } });
      this.step('act', 'AS', null, { en: 'Action asks for a fresh check: is the presenter free?', zh: 'Action 要求重新检查：讲者现在有空吗？' }, null,
        { src: 'target', policy: P.timing, build: { en: 'The reminder plan names what must be true before it fires.', zh: '提醒计划写明触发前必须成立的条件。' } });
      this.step('update', 'SA', null, this.presenterBusy(task.n) ? { en: `#${task.n}: the presenter is still busy.`, zh: `#${task.n}：讲者还在忙。` } : { en: `#${task.n}: the presenter is free now.`, zh: `#${task.n}：讲者现在有空了。` }, null,
        { src: 'target', policy: P.interpret, condition: C.uncertainty, build: { en: 'Count the people facing the presenter; free means nobody is waiting.', zh: '数一数面向讲者的人；没人在等就算有空。' } });
    }
    if (this.presenterBusy(task.n)) { task.checked = false; return false; }
    return true;
  }

  decideTask(task) {
    if (task.status !== 'open' || task.reminded) return;
    if (this.conversation || this.focus) {
      if (!task.held) {
        task.held = true;
        this.step('wait', 'MA', null, { en: 'Holding the reminder: you are talking with someone.', zh: '先不提醒：你正在和人说话。' },
          { en: 'Your contract says: only speak when you are not in a conversation.', zh: '约定写明：你不在对话中时才开口。' },
          { src: 'target', policy: P.gate, condition: C.availability, short: { en: 'holding a reminder', zh: '暂缓提醒' },
            build: { en: 'A gate combines the task’s trigger, your stored preferences and your availability right now.', zh: '门控同时看待办的触发条件、存下的偏好和你此刻是否有空。' } });
      }
      return;
    }
    this.remindTask(task);
  }

  remindTask(task) {
    task.reminded = true;
    const L = this.L;
    this.nextTarget = task.n;
    this.showRoute(task.n);
    this.hud.toast({ kind: 'alert', channel: 'MA', title: L({ en: `The presenter at #${task.n} is free`, zh: `#${task.n} 的讲者有空了` }),
      text: L({ en: `You asked to come back. ${this.short(task.n)} is ${this.metres(task.n)} away.`, zh: `你说过要回来。${this.short(task.n)} 距离 ${this.metres(task.n)}。` }), ttl: 9000,
      actions: this.tour ? [] : [{ label: L({ en: 'Show the way', zh: '显示路线' }), run: () => { this.showRoute(task.n); this.hud.caption(L({ en: 'The route is on the map. Walk there with W A S D.', zh: '路线已显示在地图上，用 W A S D 走过去。' }), 3000); } }] });
    this.step('act', 'MA', null, { en: `Reminder: the presenter at #${task.n} is free, ${this.metres(task.n)} away.`, zh: `提醒：#${task.n} 的讲者有空了，距离 ${this.metres(task.n)}。` },
      { en: 'Nobody asked again. A request-only assistant would stay silent here.', zh: '没有人再问一次。只在请求时运行的助手，这时不会开口。' },
      { src: 'target', policy: P.gate, grounds: { en: 'open task in Memory; presenter free (Sensing); you are free', zh: 'Memory 里的待办；讲者有空（Sensing）；你也有空' }, short: { en: `reminder #${task.n}`, zh: `提醒 #${task.n}` },
        build: { en: 'Fire only when the trigger holds and the contract allows speaking.', zh: '触发条件成立、并且约定允许开口时才触发。' } });
  }

  completeTask(task) {
    task.status = 'done';
    this.watch.delete(task.n);
    this.mem.done.push(task);
    this.mem.pending = this.mem.pending.filter(t => t !== task);
    this.step('update', 'AM', null, { en: `Open task done: #${task.n} is retired and kept in history.`, zh: `待办完成：#${task.n} 退役，记入历史。` },
      { en: 'Completing it retires the commitment; the preference not to be interrupted mid-conversation stays.', zh: '完成后承诺退役；「对话中别打断我」这个偏好继续保留。' },
      { src: 'target', policy: P.retire, build: { en: 'Mark the commitment done and keep what happened on the poster’s card.', zh: '把承诺标为完成，把经过留在这张 Poster 的卡片上。' } });
  }

  freePresenter(n) {
    const task = this.mem.pending.find(t => t.n === n);
    if (task) task.freed = true;
    for (const p of this.world.crowd.people) if (p.busyAt === n) this.world.crowd.setHidden(p, true);
  }

  // ------------------------------------------------------------ boundaries
  setGlasses(on) {
    if (on === this.glassesOn) return;
    const L = this.L;
    if (!on) {
      if (this.focus) this.archive(this.focus.n);
      this.glassesOn = false;
      this.hud.setGlasses(false);
      this.step('boundary', null, null, { en: 'Glasses off: the interaction ends here.', zh: '摘下眼镜：这次交互到此结束。' },
        { en: 'An interaction boundary, t ∈ ℬ.', zh: '一个交互边界，t ∈ ℬ。' },
        { src: 'ego', build: { en: 'Write the session state to the user’s persistent store before the device sleeps.', zh: '设备休眠前，把会话状态写进用户的持久存储。' } });
      for (const task of this.mem.pending) {
        this.step('update', null, 'M', { en: `The open task survives the boundary: ${L(task.label)}.`, zh: `待办跨过了边界：${L(task.label)}。` },
          { en: 'State durability. A session-local assistant would reset here and lose it.', zh: '状态持久。会话级的助手到这里会重置，把它忘掉。' },
          { src: 'target', policy: P.retrieve, build: { en: 'Open tasks live in the same store as the trail, keyed to the user, not to the session.', zh: '待办和足迹存在同一处，按用户而不是按会话保存。' } });
      }
      this.step('note', null, 'A', { en: 'The service keeps running on your phone: no camera, same decisions.', zh: '服务在手机上继续运行：没有摄像头，判断照旧。' },
        { en: 'What stays on is the decision whether to help, not the camera.', zh: '保持开着的是「要不要帮你」的判断，不是摄像头。' },
        { src: 'target', policy: P.effector, build: { en: 'Run the scheduler and task triggers on the phone; the glasses are one effector among several.', zh: '调度和待办触发放在手机上；眼镜只是几种执行方式之一。' } });
      this.hud.phone([
        { title: 'EgoPoster', text: this.mem.pending.length ? L({ en: `Open: ${L(this.mem.pending[0].label)}`, zh: `待办：${L(this.mem.pending[0].label)}` }) : L({ en: 'No open tasks', zh: '没有待办' }) },
        { title: 'ECCV 2026', text: L({ en: 'Poster Session 6 until 17:00', zh: 'Poster Session 6 到 17:00' }) },
      ]);
      this.hud.brackets(null);
    } else {
      this.glassesOn = true;
      this.hud.setGlasses(true);
      this.step('update', null, 'M', { en: `Glasses on: ${this.mem.pending.length} open task${this.mem.pending.length === 1 ? '' : 's'} and the trail are back.`, zh: `戴回眼镜：${this.mem.pending.length} 条待办和足迹都回来了。` }, null,
        { src: 'ego', policy: P.retrieve, build: { en: 'Reload the user’s state on wake; nothing is rebuilt from scratch.', zh: '唤醒时重新载入用户状态，不从头重建。' } });
      if (this.mem.revision === 'ready') this.activateRevision({ en: 'as the glasses came back on', zh: '在戴回眼镜时' });
    }
  }

  async proposeRevision() {
    this.mem.revision = 'proposed';
    this.hud.toast({ kind: 'extension', title: this.L({ en: 'Extension · not part of EgoPoster', zh: '扩展 · 不属于 EgoPoster' }),
      text: this.L({ en: 'Twice you dismissed the next stop while a presenter was talking. Candidate rule: hold it until you step away.', zh: '你两次在讲者讲话时关掉了「下一站」。候选规则：等你离开 Poster 再提示。' }), ttl: 9000 });
    this.step('revise', null, null, { en: 'Candidate revision: hold the next stop until you step away.', zh: '候选修订：等你离开 Poster 再提示下一站。' },
      { en: 'Content m changes at every poster; this would change θ, the rule that decides when to speak.', zh: '内容 m 每张 Poster 都在变；这次要改的是 θ，也就是决定何时开口的规则。' },
      { src: 'ext', grounds: { en: 'two dismissals, both while a presenter was talking', zh: '两次关闭，都发生在讲者讲话时' }, build: { en: 'Attribute the feedback to its situation before proposing a rule; one dismissal is not enough.', zh: '先把反馈归因到具体情境，再提出规则；一次关闭不够。' } });
    await this.pause(2600);
    this.step('revise', null, null, { en: 'Checked on today’s trace: it avoids both interruptions and delays nothing else.', zh: '在今天的记录上检查：两次打断都能避免，也不耽误别的提示。' },
      { en: 'Validation before the revision is kept.', zh: '先验证，再保留修订。' },
      { src: 'ext', build: { en: 'Replay the day’s decisions under the candidate rule and compare outcomes.', zh: '用候选规则重放当天的决定，比较结果。' } });
    this.mem.revision = 'ready';
  }

  activateRevision(when) {
    this.mem.theta = 2;
    this.mem.revision = 'active';
    this.step('revise', null, null, { en: `Activated ${this.L(when)}: θ₁ → θ₂.`, zh: `${this.L(when)}生效：θ₁ → θ₂。` },
      { en: 'A declared boundary, not the middle of a visit.', zh: '在声明的边界生效，不在一次停留中途切换。' },
      { src: 'ext', build: { en: 'Keep rule versions; switch only at a boundary so no single decision mixes two rules.', zh: '保留规则版本；只在边界切换，避免同一个决定混用两套规则。' } });
  }

  // ------------------------------------------------------------ free mode
  updateFree(dt, now) {
    const g = this.gaze;
    if (this.focus) {
      const f = this.focus;
      const b = this.board(f.n);
      const [sx, sz] = this.world.standPoint(b);
      const d = Math.hypot(sx - this.player.x, sz - this.player.z);
      // Looking at the presenter beside the poster still counts as being there; turning your back does not.
      const fwd = this.camera.getWorldDirection(this.tmp);
      const tx = b.x - this.player.x, tz = b.z - this.player.z;
      const facing = (tx * fwd.x + tz * fwd.z) / (Math.hypot(tx, tz) || 1);
      f.away = (d > 3.6 || facing < -0.15) ? f.away + dt : 0;
      const dwell = (now - f.since) / 1000;
      const plan = [0, 2.5, 5.5, 8.5, 11];
      while (f.stage < 4 && dwell > plan[f.stage + 1]) {
        f.stage += 1;
        if (f.stage <= 3) this.stage(f.n, f.stage);
        if (f.stage === 4) this.cardComplete(f);
      }
      const task = this.mem.pending.find(t => t.n === f.n && t.status === 'open' && t.reminded);
      if (task && dwell > 2) this.completeTask(task);
      if (f.away > 1.4) this.leave(f);
    } else if (g && g.dwell > 1.6 && !this.player.path && Math.hypot(this.player.vx, this.player.vz) < 0.4 && !(this.lastArchived?.n === g.n && now - this.lastArchived.at < 20000)) {
      this.recognize(g.n, { again: this.mem.seen.has(g.n) });
      if (this.nextTarget === g.n) this.nextTarget = null;
    }
  }

  cardComplete(f) {
    const speaking = this.presenterNear(f.n);
    if (this.mem.theta === 1 || !speaking) {
      const next = this.offerNext(f.n, { during: speaking });
      if (next && speaking) {
        this.hud.toast({ channel: 'MA', title: `${this.t('next')} · #${next}`, text: this.L({ en: 'The presenter is still talking.', zh: '讲者还在讲。' }), ttl: 8000,
          actions: [{ label: this.L({ en: 'Not now', zh: '现在不要' }), run: () => this.dismissNext(f.n) }] });
      }
    } else {
      f.held = true;
      this.step('wait', 'SA', null, { en: 'Presenter still talking: holding the next stop (θ₂).', zh: '讲者还在讲：先不提示下一站（θ₂）。' }, null,
        { src: 'ext', policy: P.gate, short: { en: 'holding the next stop', zh: '暂缓下一站' }, build: { en: 'The revised rule reads the presenter’s voice activity before speaking.', zh: '修订后的规则先看讲者是否在说话，再决定开口。' } });
    }
  }

  leave(f) {
    const n = f.n, held = f.held;
    this.archive(n);
    const hadNext = this.nextTarget && this.nextTarget !== n;
    if (held || (!hadNext && f.stage >= 3)) {
      const next = this.nextFor(n);
      if (next) {
        this.nextTarget = next;
        this.showRoute(next);
        this.step('act', 'MA', null, { en: `You stepped away: next stop #${next} ${this.short(next)}, ${this.metres(next)}.`, zh: `你离开了：下一站 #${next} ${this.short(next)}，${this.metres(next)}。` }, null,
          { src: 'ego', policy: P.timing, short: { en: `next stop #${next}`, zh: `下一站 #${next}` } });
        this.hud.toast({ channel: 'MA', title: `${this.t('next')} · #${next}`, text: `${this.short(next)} · ${this.metres(next)}`, ttl: 5000 });
      }
    }
    if (this.nextTarget) {
      this.step('act', 'AS', null, { en: `Checking for arrival at #${this.nextTarget}.`, zh: `留意你是否到达 #${this.nextTarget}。` },
        { en: 'The plan tells Sensing what to confirm next.', zh: '计划告诉 Sensing 接下来要确认什么。' },
        { src: 'ego', policy: P.attend, build: { en: 'The route’s destination becomes a watched board number.', zh: '路线的终点变成一个被留意的板号。' } });
    }
  }

  // ------------------------------------------------------------ every frame
  update(dt, now) {
    this.clock += dt * (this.tour ? 4 / 60 : 10 / 60) * (this.tour ? this.speed : 1);
    this.hud.setStatus({ time: this.time });
    if (this.glassesOn) {
      this.updateGaze(dt);
      if (!this.tour) this.updateFree(dt, now);
      this.updateWaits(now);
      this.updateBlur();
      this.updateBrackets();
    } else {
      this.gaze = null;
      for (const box of this.blurPool) box.style.display = 'none';
      this.blurCount = 0;
    }
    if (!this.tour) for (const task of this.mem.pending) this.checkTask(task, now);
    this.updateColleague(dt);
    this.updateZone(now);
    if (!this.tour && !this.mem.reminded && this.clock >= 16 * 60 + 40) this.sessionReminder();
    if (!this.moduleAt || now - this.moduleAt > 250) { this.moduleAt = now; this.refreshModules(); }
    if (!this.minimapAt || now - this.minimapAt > 70) {
      this.minimapAt = now;
      this.minimap.setMarkers(PLAN.map((n, i) => {
        const b = this.board(n);
        const visited = this.mem.trail.some(v => v.n === n);
        const open = this.mem.pending.some(t => t.n === n);
        return { x: b.x, z: b.z + b.side * 0.8, label: String(i + 1), title: `#${n} ${this.short(n)}`, state: open ? 'next' : visited ? 'visited' : n === this.nextTarget ? 'next' : 'plan' };
      }));
      const p = this.player;
      if (p.path) this.minimap.setRoute([[p.x, p.z], ...p.path.slice(p.pathIndex)]);
      this.minimap.drawSmall({ x: p.x, z: p.z, yaw: p.yaw });
      if (!this.hud.el('[data-fullmap]').hidden) this.minimap.drawFull({ x: p.x, z: p.z, yaw: p.yaw });
    }
  }

  refreshModules() {
    const L = this.L;
    const S = [], M = [], A = [];
    if (!this.glassesOn) {
      S.push(L({ en: 'camera and mic off', zh: '摄像头和麦克风关闭' }));
      S.push(L({ en: 'phone: clock, notifications', zh: '手机：时钟、通知' }));
    } else {
      const f = this.focus;
      if (f) S.push(`#${f.n} ${this.short(f.n)}`);
      else if (this.gaze && this.gaze.dwell > 0.3) S.push(L({ en: `reading #${this.gaze.n}…`, zh: `正在读 #${this.gaze.n}…` }));
      else S.push(this.zoneId ? this.zoneName(this.world.zones.find(z => z.id === this.zoneId)) : L({ en: 'the hall', zh: '大厅' }));
      if (this.conversation) S.push({ text: L({ en: 'talking with a colleague', zh: '正在和同事说话' }), tone: 'watch' });
      else if (f && this.presenterNear(f.n)) S.push(this.presenterBusy(f.n) ? L({ en: 'presenter busy', zh: '讲者在忙' }) : L({ en: 'presenter speaking', zh: '讲者在讲' }));
      else S.push(L({ en: `${this.blurCount} face${this.blurCount === 1 ? '' : 's'} blurred`, zh: `${this.blurCount} 张脸已模糊` }));
      if (this.watch.size) S.push({ text: L({ en: `watching #${[...this.watch].join(', #')}`, zh: `留意 #${[...this.watch].join('、#')}` }), tone: 'watch' });
    }
    for (const task of this.mem.pending) M.push({ text: L({ en: `open: ${L(task.label)}`, zh: `待办：${L(task.label)}` }), tone: 'pending' });
    M.push(L({ en: `trail: ${this.mem.trail.length} today · ${HISTORY.length} earlier`, zh: `足迹：今天 ${this.mem.trail.length} · 之前 ${HISTORY.length}` }));
    M.push({ text: L({ en: `rule θ${this.mem.theta === 2 ? '₂' : '₁'}: next stop ${this.mem.theta === 2 ? 'after you step away' : 'when the card completes'}`, zh: `规则 θ${this.mem.theta === 2 ? '₂' : '₁'}：${this.mem.theta === 2 ? '离开后再提示下一站' : '卡片完整就提示下一站'}` }), tone: this.mem.theta === 2 ? 'revised' : 'plain' });
    const d = this.decision;
    A.push({ text: `${this.t('k_' + d.kind)} · ${L(d.text)}`, tone: d.kind });
    if (!this.glassesOn) A.push(L({ en: 'effector: phone', zh: '执行方式：手机' }));
    else if (this.nextTarget) A.push(L({ en: `route to #${this.nextTarget}`, zh: `路线：去 #${this.nextTarget}` }));
    this.hud.setModules({ S: S.slice(0, 3), M: M.slice(0, 3), A: A.slice(0, 2) });
  }

  updateGaze(dt) {
    const cam = this.camera;
    const fwd = cam.getWorldDirection(this.tmp).clone();
    let best = null, bestA = 0.42;
    for (const b of this.world.boards) {
      if (!this.paper(b.n)) continue;
      const dx = b.x - cam.position.x, dz = b.z - cam.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 4.6 || d < 0.3) continue;
      if (-dz * b.side < 0.25) continue;
      const dy = this.world.poster.y - cam.position.y;
      const len = Math.hypot(dx, dy, dz);
      const a = Math.acos(Math.max(-1, Math.min(1, (dx * fwd.x + dy * fwd.y + dz * fwd.z) / len)));
      if (a < bestA) { bestA = a; best = b; }
    }
    if (best && this.gaze?.n === best.n) this.gaze.dwell += dt;
    else this.gaze = best ? { n: best.n, dwell: 0 } : null;
  }

  updateWaits(now) {
    // Continuity is mostly silence: while you walk past boards the glasses decide to wait.
    const moving = this.player.path || Math.hypot(this.player.vx, this.player.vz) > 0.5;
    const g = this.gaze;
    if (g && !this.focus && moving && !this.passed.includes(g.n) && g.dwell > 0.25) {
      this.passed.push(g.n);
      if (PLAN.includes(g.n) && !this.mem.trail.some(v => v.n === g.n) && g.n !== this.nextTarget && !this.spotted?.has(g.n)) {
        (this.spotted ||= new Set()).add(g.n);
        this.step('act', 'MS', null, { en: `Spotted #${g.n} ${this.short(g.n)}: in your plan, but not next. Noted, no interruption.`, zh: `看到了 #${g.n} ${this.short(g.n)}：在你的计划里，但不是下一站。记下位置，不打扰你。` },
          { en: 'Your plan tells Sensing which boards matter.', zh: '你的计划告诉 Sensing 哪些板值得留意。' },
          { src: 'target', policy: P.attend, short: { en: 'noted a planned poster', zh: '记下计划中的 Poster' } });
      }
    }
    const plain = this.passed.filter(n => !PLAN.includes(n));
    if (now - this.lastWait > 16000 && plain.length >= 5 && !this.focus) {
      this.lastWait = now;
      this.passed = [];
      this.step('wait', null, 'A', { en: `Passed ${plain.length} posters outside your interests. Nothing needs you, so the glasses stay silent.`, zh: `路过 ${plain.length} 张和你兴趣无关的 Poster。没有需要你的事，眼镜保持安静。` },
        { en: 'Operational continuity: steps happen between requests, and most of them end in waiting.', zh: '运行连续：请求之间也在运行，多数步骤的结果是等待。' },
        { src: 'ego', policy: P.gate, short: { en: 'nothing needs you', zh: '没有需要你的事' }, build: { en: 'Run the gate on every event, and make silence its cheapest outcome.', zh: '每个事件都过一遍门控，并让「保持安静」成为最便宜的结果。' } });
    }
  }

  updateZone(now) {
    const { x, z } = this.player;
    const zone = this.world.zones.find(zn => zn.test(x, z));
    if (zone && zone.id !== this.zoneId) {
      this.zoneId = zone.id;
      if (this.glassesOn) this.hud.zone(zone.id, this.zoneName(zone), now);
    } else if (!zone) this.zoneId = null;
  }

  zoneName(zone) {
    if (!zone) return '';
    if (this.lang !== 'zh') return zone.name;
    return ({ booth44: 'Booth 44 · Action Intelligence', demo: 'Demo Session 6', coffee: '咖啡', rooms: '会议室 A–E', 'posters-east': 'Poster 大厅 · 第 1–7 排', 'posters-south': 'Poster 大厅 · 第 8–12 排', exhibition: '展商区', collection: 'Poster 领取区', lobby: '大堂 · 注册处' })[zone.id] || zone.name;
  }

  updateBlur() {
    // Faces are blurred before any processing: show it where it happens.
    const cam = this.camera, hudRoot = this.hud.root;
    const w = hudRoot.clientWidth, h = hudRoot.clientHeight;
    const near = [];
    for (const p of this.world.crowd.people) {
      if (p.hidden || p.registered) continue;
      const d2 = (p.x - cam.position.x) ** 2 + (p.z - cam.position.z) ** 2;
      if (d2 < 49) near.push([d2, p]);
    }
    near.sort((a, b) => a[0] - b[0]);
    this.rowSegs ||= this.venue.rows.flatMap(r => r.segments.map(([x0, x1]) => [x0, x1, r.z]));
    const hidden = (px, pz) => this.rowSegs.some(([x0, x1, rz]) => {
      if ((cam.position.z - rz) * (pz - rz) >= 0) return false;
      const x = cam.position.x + (px - cam.position.x) * (rz - cam.position.z) / (pz - cam.position.z);
      return x >= x0 && x <= x1;
    });
    let used = 0;
    const v = this.tmp;
    for (const [, p] of near) {
      if (used >= 10) break;
      if (hidden(p.x, p.z)) continue;
      v.set(p.x, 1.71 * p.scale, p.z).project(cam);
      if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) continue;
      const dist = Math.hypot(p.x - cam.position.x, 1.71 * p.scale - cam.position.y, p.z - cam.position.z);
      const size = Math.min(160, 0.3 / dist * (h / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
      let box = this.blurPool[used];
      if (!box) {
        box = document.createElement('div');
        box.className = 'faceblur';
        hudRoot.prepend(box);
        this.blurPool.push(box);
      }
      box.style.display = 'block';
      box.style.width = box.style.height = `${size}px`;
      box.style.transform = `translate(${(v.x + 1) / 2 * w - size / 2}px, ${(1 - v.y) / 2 * h - size / 2}px)`;
      used++;
    }
    for (let i = used; i < this.blurPool.length; i++) this.blurPool[i].style.display = 'none';
    this.blurCount = used;
  }

  updateBrackets() {
    const n = this.focus?.n ?? (this.gaze && this.gaze.dwell > 0.35 ? this.gaze.n : null);
    if (!n) { this.hud.brackets(null); return; }
    const b = this.board(n), cam = this.camera;
    const w = this.hud.root.clientWidth, h = this.hud.root.clientHeight;
    const pw = this.world.poster.w / 2, ph = this.world.poster.h / 2, y = this.world.poster.y;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [dx, dy] of [[-pw, -ph], [pw, -ph], [-pw, ph], [pw, ph]]) {
      this.tmp.set(b.x + dx, y + dy, b.z + b.side * 0.05).project(cam);
      if (this.tmp.z > 1) { this.hud.brackets(null); return; }
      const sx = (this.tmp.x + 1) / 2 * w, sy = (1 - this.tmp.y) / 2 * h;
      x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
    }
    const locked = this.focus?.n === n;
    this.hud.brackets({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, locked ? `#${n}` : this.L({ en: `reading #${n}…`, zh: `正在读取 #${n}…` }), locked ? 'locked' : 'scan');
  }

  sessionReminder() {
    this.mem.reminded = true;
    const unseen = PLAN.filter(n => !this.mem.trail.some(v => v.n === n));
    if (!unseen.length) return;
    this.hud.toast({ kind: 'alert', channel: 'MA', title: this.L({ en: '20 minutes left in Poster Session 6', zh: 'Poster Session 6 还剩 20 分钟' }),
      text: this.L({ en: `Still unseen from your plan: ${unseen.map(n => `#${n} ${this.short(n)}`).join(', ')}.`, zh: `计划里还没看：${unseen.map(n => `#${n} ${this.short(n)}`).join('、')}。` }), ttl: 9000 });
    this.step('act', 'MA', null, { en: `Reminder: 20 minutes left, ${unseen.length} planned posters unseen.`, zh: `提醒：还剩 20 分钟，计划里有 ${unseen.length} 张没看。` },
      { en: 'Nobody asked; the session clock and your plan made this the moment to speak.', zh: '没有人发问；是场次时间和你的计划让这一刻值得开口。' },
      { src: 'ego', policy: P.timing, short: { en: 'session reminder', zh: '场次提醒' } });
  }

  // ------------------------------------------------------------ greeting people
  /** Walk up to someone and say hello. Some greetings give the glasses something to do; most are just talk. */
  async greet(p, { walk = false } = {}) {
    if (this.tour || !p || p.hidden || p.kind === 'extra' || !this.glassesOn) return;
    const L = this.L, player = this.player;
    const d = Math.hypot(p.x - player.x, p.z - player.z);
    if (walk && d > 2.4) {
      const a = Math.atan2(player.z - p.z, player.x - p.x);
      const ok = await player.walkTo([p.x + Math.cos(a) * 1.35, p.z + Math.sin(a) * 1.35], { face: [p.x, 1.62, p.z] });
      if (!ok) return;
    } else if (d > 3.8) return;
    else await player.lookAt([p.x, 1.62, p.z], 0.5);
    this.world.crowd.greet(p, player);
    this.hud.say(L({ en: 'You', zh: '你' }), L({ en: 'Hi!', zh: '你好！' }), 1500);
    await new Promise(r => setTimeout(r, 1100));
    const role = { presenter: { en: 'Presenter', zh: '讲者' }, staff: { en: 'Booth staff', zh: '展位工作人员' }, coffee: { en: 'Attendee', zh: '参会者' }, walker: { en: 'Attendee', zh: '参会者' }, visitor: { en: 'Attendee', zh: '参会者' } }[p.kind] || { en: 'Attendee', zh: '参会者' };
    const who = p.kind === 'presenter' ? `${L(role)} · #${p.board}` : L(role);
    const stranger = { src: 'ego', policy: P.filter, condition: C.privacy, build: { en: 'Unregistered faces are blurred before recognition runs, so there is no identity to store.', zh: '未登记的脸在识别之前就被模糊，也就没有身份可存。' } };
    const justTalk = (why) => this.step('wait', null, 'A', { en: 'Just talk: nothing for the assistant to do.', zh: '只是闲聊：助手不需要做什么。' }, why,
      { src: 'target', policy: P.gate, short: { en: 'just talk', zh: '只是闲聊' }, build: { en: 'Most speech around you should end at the gate: silence is the default outcome.', zh: '身边的大多数对话都应该止步于门控：默认结果是保持安静。' } });
    if (p.kind === 'presenter') {
      this.hud.say(who, L({ en: `Hi! Want a quick tour of #${p.board}?`, zh: `你好！要不要我带你快速过一遍 #${p.board}？` }), 3600);
      this.step('update', 'SM', null, { en: `The presenter at #${p.board} starts explaining; the talk is bound to the poster’s card.`, zh: `#${p.board} 的讲者开始讲解，讲解绑定到这张 Poster 的卡片。` }, null,
        { src: 'ego', policy: P.segment, build: { en: 'A greeting at a poster opens its card, the same as stopping in front of it.', zh: '在 Poster 前打招呼，就和驻足一样，会打开它的卡片。' } });
      if (this.focus?.n !== p.board && this.paper(p.board)) this.recognize(p.board, { again: this.mem.seen.has(p.board) });
      return;
    }
    if (p.kind === 'staff') {
      this.hud.say(who, L({ en: `Welcome to ${p.boothName || 'our booth'}! Want a quick demo?`, zh: `欢迎来到 ${p.boothName || '我们展位'}！要不要看个演示？` }), 3600);
      this.step('wait', null, 'A', { en: 'They offered a demo. Their contact is not saved unless you ask.', zh: '对方邀请你看演示。除非你开口，否则不保存对方的联系方式。' }, null,
        { src: 'target', policy: P.gate, condition: C.authority, short: { en: 'nothing saved', zh: '什么都不存' }, build: { en: 'Keeping someone else’s details needs your explicit say-so, not a default.', zh: '保存别人的信息需要你明确同意，而不是默认。' } });
      return;
    }
    const tips = [
      { line: { en: 'Hi! If you like embodied work, row 9 is worth a walk.', zh: '你好！如果你做具身，第 9 排值得逛逛。' }, board: null },
      { line: { en: 'Have you seen #402? The LiDAR one drew a crowd all afternoon.', zh: '你看过 #402 吗？那张激光雷达的一下午都围满了人。' }, board: 402 },
    ];
    const talk = [
      { en: 'Hi! Busy session, isn’t it?', zh: '你好！这场人好多啊。' },
      { en: 'Hello! The coffee here is surprisingly good.', zh: '你好！这里的咖啡意外地好喝。' },
      { en: 'Hey! Last poster session of the conference already.', zh: '嘿！已经是会议最后一场 Poster 了。' },
      { en: 'Oh, hi! Sorry, I’m heading to a poster.', zh: '哦，你好！不好意思，我赶着去看一张 Poster。' },
    ];
    this.step('update', null, 'S', { en: 'Talking with someone you have not registered: their face stays blurred.', zh: '在和一位未登记的人说话：对方的脸保持模糊。' }, null, stranger);
    if (p.kind === 'visitor' && p.i % 3 === 0) {
      const tip = tips[p.i % tips.length];
      this.hud.say(who, L(tip.line), 3800);
      const inPlan = tip.board && PLAN.includes(tip.board);
      if (inPlan && !this.mem.trail.some(v => v.n === tip.board)) {
        this.step('wait', 'MA', null, { en: `A tip about #${tip.board}: it is already in your plan, so nothing changes.`, zh: `听到有人推荐 #${tip.board}：它已经在你的计划里，什么都不用改。` }, null,
          { src: 'target', policy: P.gate, grounds: { en: 'the plan in Memory', zh: 'Memory 里的计划' }, short: { en: 'tip already covered', zh: '推荐已在计划中' } });
      } else {
        this.step('update', 'SM', null, { en: 'Heard a tip. Kept as a weak hint, not a change to your plan.', zh: '听到一条推荐。作为弱线索记下，不改你的计划。' }, null,
          { src: 'target', policy: P.admit, condition: C.uncertainty, build: { en: 'Admit hearsay with low weight and its source; only your own signals change the plan.', zh: '道听途说的信息带着来源、以低权重记下；只有你自己的信号才会改计划。' } });
      }
      return;
    }
    this.hud.say(who, L(talk[p.i % talk.length]), 3200);
    justTalk({ en: 'Nothing was asked and nothing is pending, so the glasses stay silent.', zh: '没人提要求，也没有待办，所以眼镜保持安静。' });
  }

  // A colleague (a contact you registered) stops you in the aisle.
  async meetColleague() {
    const p = this.extra;
    if (!p) return;
    const [fx, fz] = [-Math.sin(this.player.yaw), -Math.cos(this.player.yaw)];
    const stop = [this.player.x + fx * 1.25, this.player.z + fz * 1.25];
    const start = [this.player.x + fx * 7 + fz * 1.5, this.player.z + fz * 7 - fx * 1.5];
    this.world.crowd.setHidden(p, false);
    this.colleague = { p, from: start, to: stop, t: this.skipping ? 1 : 0, dur: 2.4, mode: 'approach' };
    await this.pause(2600);
  }

  async colleagueLeaves() {
    const c = this.colleague;
    if (!c) return;
    const away = [c.to[0] + (c.to[0] - this.player.x) * 6 + 2.5, c.to[1] + (c.to[1] - this.player.z) * 6];
    Object.assign(c, { from: [...c.to], to: away, t: this.skipping ? 1 : 0, dur: 3.2, mode: 'leave' });
    this.conversation = false;
    await this.pause(1200);
  }

  updateColleague(dt) {
    const c = this.colleague;
    if (!c) return;
    const { p } = c;
    c.phase = (c.phase || 0) + dt * 5.5;
    if (c.mode === 'approach' || c.mode === 'leave') {
      c.t = Math.min(1, c.t + dt / c.dur);
      const e = c.t * c.t * (3 - 2 * c.t);
      const x = c.from[0] + (c.to[0] - c.from[0]) * e, z = c.from[1] + (c.to[1] - c.from[1]) * e;
      const yaw = Math.atan2(c.to[0] - c.from[0], c.to[1] - c.from[1]);
      this.world.crowd.move(p, x, z, c.t < 1 ? yaw : Math.atan2(this.player.x - x, this.player.z - z), c.t < 1 ? Math.sin(c.phase) * 0.4 : 0);
      if (c.t >= 1 && c.mode === 'approach') c.mode = 'talk';
      if (c.t >= 1 && c.mode === 'leave') { this.world.crowd.setHidden(p, true); this.colleague = null; }
    }
  }

  // ------------------------------------------------------------ guided walk (pause, walk, look: engine/tour.mjs)
  async walkTo(target, face = null) {
    return this.walk(target, { face, speed: 1.9 });
  }

  async walkToBoard(n, standOffset = 1.45, dx = 0) {
    const b = this.board(n);
    await this.walkTo([b.x + dx, b.z + b.side * standOffset], [b.x, this.world.poster.y, b.z]);
  }

  async stepAway(n) {
    const b = this.board(n);
    await this.walkTo([b.x + 1.2, b.z + b.side * 3.3], null);
  }

  async tourVisit(n, { dismiss = false, time, minutes = 5, leaveForCoffee = false } = {}) {
    this.clock = Math.max(this.clock, time);
    this.nextTarget = n;
    await this.walkToBoard(n);
    await this.pause(500);
    this.recognize(n);
    await this.pause(2200);
    this.stage(n, 1);
    await this.pause(2800);
    this.stage(n, 2);
    await this.pause(2800);
    this.stage(n, 3);
    await this.pause(2800);
    const speaking = this.presenterNear(n);
    if (leaveForCoffee) {
      this.step('wait', 'SA', null, { en: 'You glance at the time and turn towards the coffee. Nothing to add.', zh: '你看了眼时间，转身去拿咖啡。没什么要补充的。' }, null,
        { src: 'ego', policy: P.gate, short: { en: 'nothing to add', zh: '没什么要说的' } });
    } else if (this.mem.theta === 1) {
      this.offerNext(n, { during: speaking });
      await this.pause(1700);
      if (dismiss) {
        this.dismissNext(n, { byScript: true });
        await this.pause(1600);
      }
    } else {
      this.step('wait', 'SA', null, { en: 'Presenter still talking: holding the next stop (θ₂).', zh: '讲者还在讲：先不提示下一站（θ₂）。' },
        { en: 'Sensing reports the presenter’s voice; Action waits.', zh: 'Sensing 报告讲者在说话，Action 选择等待。' },
        { src: 'ext', policy: P.gate, short: { en: 'holding the next stop', zh: '暂缓下一站' } });
      await this.pause(2400);
    }
    this.clock += 2;
    this.tourMinutes = minutes;
    if (!leaveForCoffee) await this.stepAway(n);
    this.archive(n);
    this.tourMinutes = null;
    if (leaveForCoffee) { this.nextTarget = null; return null; }
    const next = this.nextFor(n);
    if (next && (this.mem.theta === 2 || dismiss)) {
      this.nextTarget = next;
      this.showRoute(next);
      this.hud.toast({ channel: 'MA', title: `${this.t('next')} · #${next}`, text: `${this.short(next)} · ${this.metres(next)}`, ttl: 4500 });
      this.step('act', 'MA', null, { en: `You stepped away: next stop #${next} ${this.short(next)}, ${this.metres(next)}.`, zh: `你离开了：下一站 #${next} ${this.short(next)}，${this.metres(next)}。` }, null,
        { src: 'ego', policy: P.timing, short: { en: `next stop #${next}`, zh: `下一站 #${next}` } });
    }
    if (next) {
      this.step('act', 'AS', null, { en: `Checking for arrival at #${next}.`, zh: `留意你是否到达 #${next}。` },
        { en: 'The plan tells Sensing what to confirm next.', zh: '计划告诉 Sensing 接下来要确认什么。' },
        { src: 'ego', policy: P.attend, build: { en: 'The route’s destination becomes a watched board number.', zh: '路线的终点变成一个被留意的板号。' } });
    }
    return next;
  }

  resetScene() {
    for (const p of this.world.crowd.people) if (p.busyAt) this.world.crowd.setHidden(p, false);
    if (this.extra) this.world.crowd.setHidden(this.extra, true);
    this.colleague = null;
    this.mem = freshMemory();
    this.watch.clear();
    this.focus = null;
    this.nextTarget = null;
    this.spotted = new Set();
    this.hud.hideCard();
  }

  async runTour() {
    const L = this.L;
    const b44 = this.world.booths.find(b => b.id === '44');
    const spawn = this.world.spawn;
    this.resetScene();
    this.clock = 15 * 60 - 1;
    if (Math.hypot(spawn.x - this.player.x, spawn.z - this.player.z) > 2) await this.walkTo([spawn.x, spawn.z], [b44.front.cx, 1.5, b44.front.cz]);
    await this.look([b44.front.cx, 1.45, b44.front.cz], 0.8);
    this.clock = 15 * 60;
    await this.chapter('booth');

    // 15:00 · Booth 44: the state from earlier days comes back, under a declared contract.
    this.hud.toast({ title: L({ en: 'Put them on', zh: '戴上眼镜' }), text: L({ en: 'Saturday 15:00, Booth 44. The session you began on Thursday picks up where it stopped.', zh: '周六 15:00，Booth 44。周四开始的会话从上次停下的地方接着运行。' }), ttl: 5200 });
    this.step('update', null, 'M', { en: 'Glasses on. Thursday’s and Friday’s state is back: your interests and 3 earlier stops.', zh: '眼镜戴上。周四、周五的状态回来了：你的兴趣和之前的 3 站。' },
      { en: 'State durability: nothing reset overnight.', zh: '状态持久：过夜之后没有重置。' },
      { src: 'ego', policy: P.retrieve, grounds: PROFILE, build: { en: 'One persistent session per user across days; waking the glasses reloads its snapshot.', zh: '每个用户跨天共用一个持久会话；唤醒眼镜就重新载入快照。' } });
    await this.pause(2600);
    this.showContractToast();
    this.step('note', null, 'A', { en: 'Service contract active until 17:00.', zh: '服务约定生效，到 17:00。' },
      { en: 'Operational continuity runs under a declared schedule and availability contract.', zh: '运行连续的前提，是声明好的时间表和可用性约定。' },
      { src: 'target', policy: P.gate, condition: { en: 'Availability, privacy, authority', zh: '可用性、隐私、权限' }, build: { en: 'A small rule file that the Action policy reads before every intervention.', zh: '一份小规则，Action 的策略每次介入前都要读。' } });
    await this.pause(3400);
    this.step('note', null, 'S', { en: 'Faces and screens are blurred before any processing.', zh: '人脸和屏幕在任何处理之前先做模糊。' },
      { en: 'The privacy condition shapes the Sensing policy.', zh: '隐私条件约束 Sensing 的策略。' },
      { src: 'ego', policy: P.filter, condition: C.privacy, build: { en: 'Detect and blur on the device, before frames reach a model or storage.', zh: '在设备端检测并模糊，画面到达模型或存储之前就处理掉。' } });
    this.hud.caption(L({ en: 'The squares over faces are the privacy filter, applied before anything else sees the frame.', zh: '人脸上的方块就是隐私过滤，在其他模块看到画面之前就已完成。' }), 4200);
    await this.pause(2800);
    this.hud.toast({ channel: 'MA', title: L({ en: 'Your plan for Poster Session 6', zh: '你在 Session 6 的计划' }), text: PLAN.map(n => `#${n}`).join(' → '), ttl: 6000 });
    this.step('act', 'MA', null, { en: `Plan for Session 6: ${PLAN.map(n => '#' + n).join(' → ')}.`, zh: `Session 6 的计划：${PLAN.map(n => '#' + n).join(' → ')}。` },
      { en: 'Ranked from the interests you gave on Thursday.', zh: '按你周四给出的兴趣排序。' },
      { src: 'ego', policy: P.timing, grounds: { en: 'interests in Memory; today’s session list', zh: 'Memory 里的兴趣；今天的场次列表' }, short: { en: 'plan shown', zh: '给出计划' },
        build: { en: 'Rank the session’s papers with BM25 and embeddings against the stored interests.', zh: '用 BM25 加向量检索，把场次论文和存下的兴趣做匹配排序。' } });
    this.nextTarget = PLAN[0];
    this.showRoute(PLAN[0]);
    await this.pause(2200);
    this.watch.add(PLAN[0]);
    this.step('act', 'MS', null, { en: `Watching for board #${PLAN[0]} as you walk.`, zh: `走路时留意 #${PLAN[0]} 的号牌。` },
      { en: 'The plan tells Sensing what to look for.', zh: '计划告诉 Sensing 要找什么。' },
      { src: 'target', policy: P.attend, build: { en: 'Hand Sensing a watch list of board numbers; plates are cheap to read.', zh: '给 Sensing 一份要留意的板号清单；号牌读起来很便宜。' } });

    // #108: the card, a link to Thursday, and a next stop that arrives too early.
    await this.chapter('p108');
    await this.tourVisit(108, { dismiss: true, time: 15 * 60 + 4, minutes: 6 });
    this.watch.delete(108);

    // #175: crowded. You make the one request of the afternoon.
    await this.chapter('p175');
    this.clock = Math.max(this.clock, 15 * 60 + 12);
    await this.walkToBoard(175, 2.9, 0.4);
    await this.pause(500);
    this.recognize(175);
    await this.pause(2000);
    this.step('wait', 'SA', null, { en: 'Presenter busy with three visitors: keep the card short.', zh: '讲者正被三位听众围着：卡片先简短一点。' }, null,
      { src: 'target', policy: P.gate, grounds: { en: 'three people facing the presenter', zh: '三个人正面向讲者' }, short: { en: 'presenter busy', zh: '讲者在忙' },
        build: { en: 'Count the people facing the presenter; a queue means questions can wait.', zh: '数面向讲者的人数；有人排队时，问题可以晚点问。' } });
    this.stage(175, 1);
    await this.pause(2600);
    this.request(175);
    await this.pause(3400);
    this.stage(175, 2);
    await this.pause(2200);
    this.offerNext(175, { during: true });
    await this.pause(1700);
    this.dismissNext(175, { byScript: true });
    await this.pause(1500);
    this.clock += 3;
    this.tourMinutes = 3;
    await this.stepAway(175);
    this.archive(175);
    this.tourMinutes = null;
    await this.proposeRevision();
    this.step('note', null, null, { en: 'The revision waits for the next declared boundary.', zh: '这次修订要等到下一个声明的边界才生效。' }, null, { src: 'ext' });
    await this.pause(1200);

    // #172, then coffee.
    await this.chapter('coffee');
    await this.tourVisit(172, { time: 15 * 60 + 22, minutes: 6, leaveForCoffee: true });
    const cup = this.venue.coffee.reduce((best, c) => (Math.hypot(c[0] - this.player.x, c[1] - this.player.z) < Math.hypot(best[0] - this.player.x, best[1] - this.player.z) ? c : best));
    const ang = Math.atan2(this.player.z - cup[1], this.player.x - cup[0]);
    await this.walkTo([cup[0] + Math.cos(ang) * 2.6, cup[1] + Math.sin(ang) * 2.6], [cup[0], 1.1, cup[1]]);
    this.clock = 15 * 60 + 35;

    // Coffee break: the glasses come off. The interaction ends; the open task does not.
    this.hud.caption(L({ en: '15:35. You take the glasses off for coffee.', zh: '15:35。你摘下眼镜去喝咖啡。' }), 3600);
    await this.pause(1200);
    this.setGlasses(false);
    await this.pause(4200);
    this.hud.caption(L({ en: 'Fifty minutes later.', zh: '五十分钟后。' }), 2600);
    this.freePresenter(175);
    this.clock = 16 * 60 + 25;
    await this.pause(2400);
    this.setGlasses(true);
    await this.pause(1600);
    this.step('wait', null, 'A', { en: 'One open task, no news about its presenter yet: nothing to say.', zh: '一条待办，讲者那边还没有新情况：没什么要说的。' },
      { en: 'Deciding not to act is still a step of the loop.', zh: '决定不行动，也是循环里的一步。' },
      { src: 'target', policy: P.gate, short: { en: 'nothing new', zh: '没有新情况' } });
    await this.pause(1400);

    // #402 under the revised rule.
    await this.chapter('p402');
    await this.tourVisit(402, { time: 16 * 60 + 27, minutes: 5 });

    // Passing #175 on the way: the open task fires, but only once you are free.
    await this.chapter('pass175');
    const b175 = this.board(175);
    await this.walkTo([b175.x + 7.5, b175.z + b175.side * 2.2], [b175.x + 1.5, 1.6, b175.z]);
    const open = this.mem.pending[0];
    this.observeTask(open, true);
    await this.pause(2200);
    await this.meetColleague();
    this.conversation = true;
    this.hud.say(L({ en: 'Colleague', zh: '同事' }), L({ en: 'Hey, are you going to the dinner tonight?', zh: '嘿，今晚的晚餐你去吗？' }), 3200);
    this.step('update', 'SA', null, { en: 'You are in a conversation with a colleague (a registered contact).', zh: '你正在和一位同事说话（登记过的联系人）。' },
      { en: 'Registered contacts are recognised; everyone else stays blurred.', zh: '登记过的联系人会被认出，其他人仍然模糊。' },
      { src: 'target', policy: P.interpret, condition: C.privacy, build: { en: 'Voice activity plus a registered face in front of you counts as a conversation.', zh: '有人在说话，且面前是登记过的脸，就算作对话。' } });
    await this.pause(1800);
    this.decideTask(open);
    await this.pause(3600);
    this.hud.say(L({ en: 'You', zh: '你' }), L({ en: 'Yes, see you there!', zh: '去，到时候见！' }), 2400);
    await this.pause(1800);
    await this.colleagueLeaves();
    await this.pause(900);
    this.decideTask(open);
    await this.pause(3200);

    // Back at #175: ask the question, retire the task.
    await this.chapter('back175');
    this.clock = Math.max(this.clock, 16 * 60 + 38);
    await this.walkToBoard(175);
    await this.pause(400);
    this.recognize(175, { again: true });
    await this.pause(1400);
    const question = this.visits.get(175)?.questions?.[1] || this.L({ en: 'Could this diagnose evidence use per question?', zh: '这个能按单个问题诊断证据使用吗？' });
    this.hud.say(L({ en: 'You', zh: '你' }), question, 4200);
    this.step('update', 'SM', null, { en: 'Your question and the presenter’s answer are bound to #175.', zh: '你的提问和讲者的回答绑定到 #175。' }, null,
      { src: 'ego', policy: P.segment, build: { en: 'Two-channel audio separates your voice from the presenter’s.', zh: '双声道音频把你的声音和讲者的声音分开。' } });
    await this.pause(3200);
    this.completeTask(open);
    await this.pause(2400);
    this.tourMinutes = 4;
    await this.stepAway(175);
    this.archive(175);
    this.tourMinutes = null;

    // #424, the last one.
    await this.chapter('p424');
    await this.tourVisit(424, { time: 16 * 60 + 47, minutes: 4 });

    // 17:00: off duty, back to the booth.
    await this.chapter('end');
    this.clock = 16 * 60 + 58;
    await this.walkTo([spawn.x, spawn.z], [b44.front.cx, 1.45, b44.front.cz]);
    this.clock = 17 * 60;
    this.step('wait', null, 'A', { en: '17:00. The session is over; under the contract the glasses go quiet.', zh: '17:00，场次结束；按照约定，眼镜安静下来。' },
      { en: 'Continuity runs on a declared schedule, not forever.', zh: '运行连续依照声明的时间表，而不是永远开着。' },
      { src: 'target', policy: P.gate, short: { en: 'off duty', zh: '下班' } });
    await this.pause(1400);
    this.step('update', 'AM', null, { en: `Trail saved: ${this.mem.trail.length} stops today, ${this.mem.trail.length + HISTORY.length} across three days; 1 task done.`, zh: `足迹已保存：今天 ${this.mem.trail.length} 站，三天共 ${this.mem.trail.length + HISTORY.length} 站；完成 1 条待办。` }, null,
      { src: 'ego', policy: P.admit });
    await this.pause(1200);
    this.step('act', null, 'A', { en: 'Trip report drafted. It is emailed only after an admin approves it.', zh: '参会报告已起草，管理员批准后才会发邮件。' },
      { en: 'The authority condition gates the action.', zh: '权限条件把关这个行动。' },
      { src: 'ego', policy: P.effector, condition: C.authority, short: { en: 'report waits for approval', zh: '报告等待批准' } });
    await this.pause(900);
    this.openTrail({ finale: true });
  }

  // ------------------------------------------------------------ sheets
  showContractToast() {
    const L = this.L;
    this.hud.toast({ title: L({ en: 'Service contract', zh: '服务约定' }), text: CONTRACT.slice(0, 3).map(c => L(c)).join(' '), ttl: 8000 });
  }

  openContract() {
    const L = this.L;
    this.hud.openSheet(`
      <p class="sheet-kicker">${L({ en: 'Operational continuity', zh: '运行连续' })}</p>
      <h2 class="sheet-title">${L({ en: 'Service contract', zh: '服务约定' })}</h2>
      <p class="sheet-lede">${L({ en: 'Always on means the glasses may act between your requests, but only on a schedule and terms you declared. You set these on Thursday.', zh: '常开意味着眼镜可以在你的请求之间行动，但只在你声明过的时间和条件下。这是你周四设好的。' })}</p>
      <ul class="about-list">${CONTRACT.map(c => `<li>${escapeHtml(L(c))}</li>`).join('')}</ul>`);
  }

  openTrail({ finale = false } = {}) {
    const L = this.L;
    const trail = this.mem.trail;
    const rows = trail.map((v, i) => `<li><span class="tr-i">${i + 1}</span><span class="tr-n">#${v.n}</span><span class="tr-t">${escapeHtml(this.paper(v.n)?.t || '')}</span><span class="tr-m">${v.at}</span></li>`).join('')
      || `<li class="tr-empty">${L({ en: 'No stops yet today. Look at a poster for a moment and the glasses start a card.', zh: '今天还没有停留。看一张 Poster 片刻，眼镜就会开始建卡片。' })}</li>`;
    const deepest = trail.slice().sort((a, b) => b.minutes - a.minutes)[0];
    const tasks = [...this.mem.done.map(t => ({ t, done: true })), ...this.mem.pending.map(t => ({ t, done: false }))];
    this.hud.openSheet(`
      <p class="sheet-kicker">${L({ en: 'Memory card · Saturday 12 September', zh: '记忆卡 · 9 月 12 日周六' })}</p>
      <h2 class="sheet-title">${L({ en: 'Your ECCV trail', zh: '你的 ECCV 足迹' })}</h2>
      ${finale ? `<p class="sheet-lede">${L({ en: 'One request, one boundary, and a reminder that waited until you were free. The emailed report waits for an admin’s approval.', zh: '一次请求，一次边界，一个等你有空才开口的提醒。邮件报告要等管理员批准后才发出。' })}</p>` : ''}
      <div class="sheet-grid">
        <section><h3>${L({ en: 'Today', zh: '今天' })}</h3><ol class="trail">${rows}</ol>
          ${deepest ? `<p class="sheet-note">${L({ en: 'Deepest stop', zh: '停留最久' })}: #${deepest.n} ${escapeHtml(this.short(deepest.n))} · ${deepest.minutes} min</p>` : ''}
          <h3 class="sheet-h3">${L({ en: 'Open tasks', zh: '待办' })}</h3>
          <ol class="trail">${tasks.length ? tasks.map(({ t, done }) => `<li><span class="tr-i">${done ? '✓' : '·'}</span><span class="tr-n">#${t.n}</span><span class="tr-t">${escapeHtml(L(t.label))}</span><span class="tr-m">${done ? L({ en: 'done', zh: '完成' }) : L({ en: 'open', zh: '进行中' })}</span></li>`).join('') : `<li class="tr-empty">${L({ en: 'None. Ask the glasses to remind you when a busy presenter is free.', zh: '没有。可以让眼镜在忙碌的讲者空下来时提醒你。' })}</li>`}</ol></section>
        <section><h3>${L({ en: 'Carried from earlier days', zh: '从前几天带过来的' })}</h3><ol class="trail trail--past">${HISTORY.map(h => `<li><span class="tr-i">${L(h.day)}</span><span class="tr-n">#${h.n}</span><span class="tr-t">${escapeHtml(h.title)}</span><span class="tr-m">${h.session}</span></li>`).join('')}</ol>
          <p class="sheet-note">${L({ en: 'Your interests, from Thursday’s interview:', zh: '你的兴趣，来自周四的访谈：' })} ${L(PROFILE)}</p></section>
      </div>
      <div class="sheet-split">
        <div><h3>${L({ en: 'Continuity and durability', zh: '运行连续与状态持久' })}</h3><p>${L({ en: 'Most steps ended in waiting. The one request became an open task, crossed the coffee break, and fired only when the presenter and you were both free.', zh: '大多数步骤的结果是等待。唯一一次请求变成待办，跨过了咖啡时间，直到讲者和你都有空时才触发。' })}</p></div>
        <div class="${this.mem.theta === 2 ? 'is-on' : ''}"><h3>${L({ en: 'Content m versus mechanism θ', zh: '内容 m 与机制 θ' })}</h3><p>${this.mem.theta === 2
          ? L({ en: 'Cards, trail and tasks changed at every step. The timing rule changed once, at a declared boundary (θ₁ → θ₂). That revision is an extension beyond EgoPoster.', zh: '卡片、足迹和待办每一步都在变；时机规则只在一个声明的边界改过一次（θ₁ → θ₂）。这次修订是 EgoPoster 之外的扩展。' })
          : L({ en: 'Cards, trail and tasks changed; the rules did not. Dismiss the next stop twice while a presenter is talking and the glasses propose a revision.', zh: '卡片、足迹和待办变了，规则没有变。在讲者讲话时关掉「下一站」两次，眼镜就会提出修订。' })}</p></div>
      </div>
      <p class="sheet-foot">${L({ en: 'The visitor, their history, the colleague and the conversations are fictional. Poster titles and board numbers are the real Session 6 program.', zh: '访客、访客之前几天的记录、同事和对话都是虚构的；Poster 标题和板号是 Session 6 的真实日程。' })}</p>`, { wide: true });
  }

  openAbout() {
    const L = this.L;
    this.hud.openSheet(`
      <p class="sheet-kicker">${L({ en: 'About this demo', zh: '关于这个演示' })}</p>
      <h2 class="sheet-title">${L({ en: 'Poster Session 6, reconstructed', zh: '重建的 Poster Session 6' })}</h2>
      <ul class="about-list">
        <li>${L({ en: 'The hall is Malmömässan’s ground floor, built at 1:1 from the official ECCV 2026 floor plan and its CAD drawing, as prepared by EgoPoster.', zh: '场馆是 Malmömässan 一层，按官方 ECCV 2026 平面图和 CAD 图 1:1 搭建，数据由 EgoPoster 整理。' })}</li>
        <li>${L({ en: 'Board positions follow EgoPoster’s worksheet map. Each of the 477 posters carries its real title, authors and board number; the poster layouts are generated.', zh: '展板位置沿用 EgoPoster 的工作表布局。477 张 Poster 都带有真实的标题、作者和板号；海报版面是生成的。' })}</li>
        <li>${L({ en: 'The left panel is the framework, not the glasses: every step names its module or channel, and marks whether EgoPoster ships it today, whether it is the always-on target, or the self-evolving extension.', zh: '左侧面板是框架，不是眼镜界面：每一步都写明对应的模块或通道，并标出它是 EgoPoster 现有功能、always-on 目标形态，还是自进化扩展。' })}</li>
        <li>${L({ en: 'Everything runs in your browser as a script. There is no model, camera or microphone; the visitor, the colleague and the conversations are fictional.', zh: '全部在浏览器里按脚本运行，没有模型、摄像头或麦克风；访客、同事和对话都是虚构的。' })}</li>
      </ul>`);
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

installTour(EccvStory.prototype, {
  async run() { await this.runTour(); },
  finish() {
    this.conversation = false;
    if (!this.glassesOn) this.setGlasses(true);
  },
});
