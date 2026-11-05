import { P, C, TOUR_ABORT } from './story.mjs';
import { SPOTS } from './places.mjs';

// The S-Lab day. A fictional first-year PhD student at S-Lab wears always-on glasses from
// Tuesday morning to Wednesday morning. Every beat is one step of the loop: a module or a
// channel, the policy that decided it, and whether it is common today, the always-on target,
// or the self-evolving extension. The student, the lab mates and all events are fictional.

const { hall: HALL, walkToStop: WALK_TO_STOP, runFrom: RUN_FROM, abn: ABN_PATH, foodCourt: FOOD_COURT } = SPOTS;
const WHO = {
  you: { en: 'You', zh: '你' },
  supervisor: { en: 'Supervisor', zh: '导师' },
  mateA: { en: 'Lab mate', zh: '同门' },
  mateB: { en: 'Another lab mate', zh: '另一位同门' },
  senior: { en: 'Senior PhD student', zh: '高年级博士生' },
};

export async function runDay(story) {
  const { hud, world, L } = story;
  const lab = world.lab, loop = world.loop, cast = lab.cast;
  const day = { watching: null, acting: null };
  story.day = day;
  story.mem = { pending: [], done: [], log: [], seen: new Set(), theta: 1, revision: 'none' };
  story.decision = { kind: 'wait', text: { en: 'nothing needs you', zh: '没有需要你的事' } };
  hud.el('[data-trace-list]').innerHTML = '';
  hud.hideCard();

  const at = (h, m) => { story.clock = h * 60 + m; };
  const pause = (ms) => story.pause(ms);
  const say = (who, line, ms = 3600) => hud.say(L(WHO[who] || who), L(line), ms / Math.max(1, story.speed * 0.8));
  const step = (...args) => story.step(...args);
  const until = async (cond, maxMs = 15000) => {
    const end = performance.now() + maxMs;
    while (!story.skipping && !cond() && performance.now() < end) {
      await new Promise(r => setTimeout(r, 100));
      if (story.tour?.cancelled) throw TOUR_ABORT;
    }
    if (story.tour?.cancelled) throw TOUR_ABORT;
  };
  const addTask = (id, label, extra = {}) => story.mem.pending.push({ id, label, status: 'open', ...extra });
  const finishTask = (id) => {
    const task = story.mem.pending.find(x => x.id === id);
    if (!task) return;
    task.status = 'done';
    story.mem.pending = story.mem.pending.filter(x => x !== task);
    story.mem.done.push(task);
  };
  const stopSide = (k, d = 4.5) => {
    const st = loop.stops[k];
    return [st.x - Math.sin(st.yaw) * d, st.z - Math.cos(st.yaw) * d];
  };
  // Lab mates walk on their own; walkMate waits for arrival, moveMate does not.
  const moveMate = (p, to, opts = {}) => lab.walk(p, to, { ...opts, speed: (opts.speed || 1.2) * story.speed, instant: story.skipping });
  const walkMate = async (p, to, opts = {}) => { moveMate(p, to, opts); await until(() => !p.route, 30000); };
  const seatEye = (id) => [lab.seats[id].x, lab.floorY + 1.2, lab.seats[id].z];

  // ------------------------------------------------------------------ 08:25 · Graduate Hall 1
  await story.chapter('hall');
  story.setSky('day');
  hud.setStatus({ session: L({ en: 'NTU · Tuesday', zh: 'NTU · 周二' }) });
  at(8, 25);
  if (!story.glassesOn) story.setGlasses(true);
  await story.jump(HALL.stand[0], HALL.stand[1], { face: HALL.face, pitch: 0.1,
    caption: { en: 'Tuesday 08:25, Graduate Hall 1. You are a first-year PhD student at S-Lab (fictional), putting the glasses on.', zh: '周二 08:25，Graduate Hall 1。你是 S-Lab 的一年级博士生（虚构），正戴上眼镜。' } });
  lab.layout('empty');
  lab.placeCamera('charger');
  await pause(2400);
  step('update', null, 'M', { en: 'Glasses on. Yesterday’s state is back: your routines, the places you went, and where you left the lab’s depth camera (shelf B, Monday 18:40).', zh: '眼镜戴上。昨天的状态回来了：你的日常安排、去过的地方，以及你把实验室的深度相机放在哪儿（B 号架，周一 18:40）。' },
    { en: 'State durability: the glasses were off for ten hours and nothing reset.', zh: '状态持久：眼镜关了十个小时，什么都没有重置。' },
    { policy: P.retrieve, build: { en: 'Keep one store per user, not per session; waking the glasses reloads it.', zh: '按用户而不是按会话保存状态；唤醒眼镜时重新载入。' } });
  await pause(3000);
  step('note', null, 'A', { en: 'Service contract active: weekdays 08:00 to 22:00.', zh: '服务约定生效：工作日 08:00 到 22:00。' },
    { en: 'Operational continuity runs under a declared schedule; outside it the glasses stay quiet.', zh: '运行连续的前提是声明好的时间表；时间表之外，眼镜保持安静。' },
    { policy: P.gate, condition: { en: 'Availability, privacy, authority', zh: '可用性、隐私、权限' }, build: { en: 'A small rule file that the Action policy reads before every intervention.', zh: '一份小规则，Action 的策略每次介入前都要读。' } });
  await pause(2600);
  step('note', null, 'S', { en: 'Faces are blurred before processing; only the contacts you registered are recognised.', zh: '人脸在处理前先做模糊；只认出你登记过的联系人。' }, null,
    { policy: P.filter, condition: C.privacy, build: { en: 'Detect and blur on the device, before frames reach a model or storage.', zh: '在设备端检测并模糊，画面到达模型或存储之前就处理掉。' } });
  await pause(2400);
  hud.toast({ channel: 'MA', title: L({ en: 'Tuesday', zh: '周二' }), text: L({ en: '10:00 group meeting · S-Lab, ABN level 2. Your usual bus: Campus Loop Red from Blk 55.', zh: '10:00 组会 · S-Lab，ABN 二层。常坐的车：Blk 55 上 Campus Loop Red。' }), ttl: 6500 });
  step('act', 'MA', null, { en: 'Morning brief: 10:00 group meeting at S-Lab. Your usual bus is the Campus Loop Red from Blk 55.', zh: '晨间简报：10:00 在 S-Lab 开组会。你平时坐 Blk 55 的 Campus Loop Red。' },
    { en: 'Built from your calendar and routines in Memory, and given once, when the contract window opens.', zh: '由 Memory 里的日程和习惯生成，只在约定时段开始时说一次。' },
    { policy: P.timing, grounds: { en: 'calendar; your usual bus', zh: '日程；你常坐的班车' }, short: { en: 'morning brief', zh: '晨间简报' },
      build: { en: 'Schedule one brief at the first boundary of the day, built from Memory rather than a new request.', zh: '在一天的第一个边界安排一次简报，内容来自 Memory，而不是新的请求。' } });
  await pause(3600);

  // ------------------------------------------------------------------ 08:36 · the leave prompt under θ₁
  await story.chapter('bus');
  at(8, 36);
  step('act', 'AS', null, { en: 'Before prompting you to leave, Action asks for a fresh check: the shuttle feed and the sky.', zh: '提醒你出门之前，Action 要求重新检查：班车信息和天色。' }, null,
    { policy: P.timing, short: { en: 'fresh check', zh: '重新检查' }, build: { en: 'A prompt names the facts it depends on, and each one is read again just before it fires.', zh: '每条提醒写明它依赖哪些事实，触发前逐一重新读取。' } });
  day.watching = { en: 'shuttle feed; sky', zh: '班车信息；天色' };
  await pause(2400);
  step('update', 'SA', null, { en: 'Shuttle feed: Campus Loop Red at Blk 55 in 4 min. The camera sees dry roads.', zh: '班车信息：Campus Loop Red 4 分钟后到 Blk 55。摄像头看到路面是干的。' },
    { en: 'Live arrival times are common today; the always-on part is checking them unasked, at the right moment.', zh: '实时到站信息现在很常见；always-on 的部分，是在对的时刻主动去查。' },
    { src: 'ego', policy: P.interpret });
  day.watching = null;
  await pause(2600);
  hud.toast({ kind: 'alert', channel: 'MA', title: L({ en: 'Leave now', zh: '现在出门' }), text: L({ en: 'Campus Loop Red at Blk 55 in 4 min.', zh: 'Campus Loop Red 4 分钟后到 Blk 55。' }), ttl: 5000 });
  step('act', 'MA', null, { en: 'Leave now: the bus is 4 min away.', zh: '现在出门：班车 4 分钟后到。' },
    { en: 'Rule θ₁, from your first week: always prompt 4 minutes before the bus.', zh: '规则 θ₁，从你入学第一周沿用至今：总是在车到前 4 分钟提醒。' },
    { policy: P.timing, short: { en: 'leave now (θ₁)', zh: '现在出门（θ₁）' } });
  await pause(1400);
  await story.walk(WALK_TO_STOP, { speed: 1.7 });
  at(8, 39);
  const waitAt = stopSide(0);
  const bus = loop.send(0, 9);
  await story.jump(RUN_FROM[0], RUN_FROM[1], { face: [loop.stops[0].x, loop.stops[0].z],
    caption: { en: '08:39. The bus is already pulling in. You run the last stretch.', zh: '08:39。车已经进站了，你跑完最后一段。' } });
  await story.walk(waitAt, { speed: 3.4, face: [loop.stops[0].x, 1.5 + world.ground(loop.stops[0].x, loop.stops[0].z), loop.stops[0].z] });
  await until(() => loop.atStop(bus, 0), 12000);
  step('update', 'AM', null, { en: 'Logged with the prompt: you had to run for the bus.', zh: '和这条提醒一起记下：你是跑着赶上车的。' },
    { en: 'The outcome of a prompt is written back next to the prompt, so the rule that made it can be judged later.', zh: '提醒的结果写回到提醒旁边，以后才能评估是哪条规则造成的。' },
    { policy: P.admit, build: { en: 'Log each prompt with what happened next: walked, ran, or missed it.', zh: '每条提醒都记下后续：走过去、跑过去，还是没赶上。' } });
  await pause(2400);

  // ------------------------------------------------------------------ 08:47 · off the bus, to ABN
  await story.chapter('abn');
  at(8, 47);
  const off = stopSide(3);
  loop.park(3, 5);
  await story.jump(off[0], off[1], { face: [-120, 40], caption: { en: '08:47. Lee Wee Nam Library stop.', zh: '08:47。Lee Wee Nam Library 站。' } });
  await pause(1600);
  step('wait', null, 'A', { en: 'On the bus and on the walk: nothing on your list is nearby, so the glasses stay silent.', zh: '坐车和步行途中：附近没有你清单上的事，眼镜保持安静。' },
    { en: 'Most steps between requests end in waiting. That is still the loop running.', zh: '请求之间的大多数步骤都以等待告终。这仍然是循环在运行。' },
    { policy: P.gate, short: { en: 'nothing needs you', zh: '没有需要你的事' } });
  await pause(2600);
  at(8, 55);
  await story.jump(ABN_PATH.from[0], ABN_PATH.from[1], { face: ABN_PATH.face, pitch: 0.06, caption: { en: '08:55. The lane beside Academic Block North, where S-Lab is.', zh: '08:55。Academic Block North 旁的小路，S-Lab 就在这栋楼里。' } });
  await pause(2600);
  await story.walk(ABN_PATH.door, { speed: 1.9, face: ABN_PATH.facade });

  // ------------------------------------------------------------------ 10:00 · the weekly meeting (illustrative room)
  await story.chapter('meeting');
  at(10, 0);
  lab.layout('meeting');
  cast.supervisor.pointing = true;
  await story.enterLab({ at: [lab.seats.head.x, lab.seats.head.z], face: lab.spots.screen, seated: true,
    caption: { en: '10:00. S-Lab, ABN level 2: the weekly group meeting. The room is illustrative.', zh: '10:00。S-Lab，ABN 二层：每周组会。室内为示意。' } });
  hud.showCard({ number: '10:00', row: L({ en: 'S-Lab · group meeting', zh: 'S-Lab · 组会' }), title: L({ en: 'Weekly group meeting', zh: '每周组会' }),
    authors: L({ en: 'Your supervisor and three lab mates, all registered contacts', zh: '导师和三位同门，都是登记过的联系人' }), origin: L({ en: 'People and meeting are fictional', zh: '人物和会议均为虚构' }) });
  await pause(2200);
  step('update', null, 'S', { en: 'Four registered contacts at the table: recognised. Anyone else would stay blurred.', zh: '桌边四位登记过的联系人：被认出。其他人仍会保持模糊。' }, null,
    { policy: P.filter, condition: C.privacy, build: { en: 'Match faces only against the contacts the wearer registered; unknown faces are never identified.', zh: '人脸只和佩戴者登记过的联系人比对；陌生人的脸从不识别。' } });
  await pause(2400);
  cast.supervisor.talking = true;
  say('supervisor', { en: 'For Friday’s paper call: can you send me the ablation table by Friday noon?', zh: '周五要讨论论文：你能在周五中午前把消融实验表发给我吗？' }, 4200);
  await pause(3800);
  cast.supervisor.talking = false;
  say('you', { en: 'Sure, by Friday noon.', zh: '好的，周五中午前。' }, 2200);
  await pause(1800);
  addTask('table', { en: 'ablation table to supervisor · Fri 12:00', zh: '消融实验表发给导师 · 周五 12:00' });
  step('update', 'SM', null, { en: 'Commitment kept: send the ablation table to your supervisor by Friday 12:00. Source: this meeting, 10:04.', zh: '承诺已记下：周五 12:00 前把消融实验表发给导师。来源：本次组会，10:04。' },
    { en: 'Who asked, what, and by when, with a pointer to the moment it was said, so you can check it later.', zh: '谁提的、做什么、截止何时，并指向说这句话的那一刻，方便以后核对。' },
    { policy: P.admit, build: { en: 'Extract commitments (who, what, deadline) from speech, and keep the source span rather than a paraphrase.', zh: '从对话里抽取承诺（谁、做什么、截止时间），保留原话出处，而不是转述。' } });
  hud.cardSection({ id: 'kept', label: L({ en: 'Kept', zh: '记下' }), channel: 'SM', items: [L({ en: 'Ablation table to your supervisor, by Friday 12:00 (10:04)', zh: '消融实验表发给导师，周五 12:00 前（10:04）' })] });
  await pause(3200);
  cast.mateB.talking = true;
  say('mateB', { en: 'I’ll be out on Thursday. Physio for my back again.', zh: '我周四不在，又要去做背部理疗。' }, 3600);
  await pause(3400);
  cast.mateB.talking = false;
  step('update', 'SM', null, { en: 'Not kept: a lab mate’s health detail. Only “out on Thursday” is kept, for scheduling.', zh: '不记：同门的健康细节。只记下「周四不在」，用于排期。' },
    { en: 'Someone else’s health is not yours to store; the part your tasks need is the absence.', zh: '别人的健康信息不该由你来存；你的事情用得上的只是「不在」这一点。' },
    { policy: P.refuse, condition: C.privacy, build: { en: 'Tag sensitive third-party content (health, money, relationships) and drop it before storage; keep only what a task needs.', zh: '标出涉及他人的敏感内容（健康、钱、感情），存储前丢掉；只保留任务需要的部分。' } });
  hud.cardSection({ id: 'dropped', label: L({ en: 'Not kept', zh: '没有记' }), channel: 'SM', items: [L({ en: 'A lab mate’s health detail (kept only: out on Thursday)', zh: '同门的健康细节（只记：周四不在）' })] });
  await pause(3400);
  cast.mateA.talking = true;
  say('mateA', { en: 'Do you still have the depth camera? I need it for a capture at 11:30.', zh: '深度相机还在你那儿吗？我 11:30 要用它采数据。' }, 3800);
  await pause(3400);
  cast.mateA.talking = false;
  say('you', { en: 'It’s on shelf B. I’ll bring it over before 11:30.', zh: '在 B 号架上，我 11:30 前拿给你。' }, 2800);
  await pause(2400);
  addTask('camera', { en: 'depth camera to lab mate · 11:30', zh: '深度相机交给同门 · 11:30' }, { place: 'S-Lab for Advanced Intelligence' });
  step('update', 'SM', null, { en: 'Commitment kept: bring the depth camera to your lab mate before 11:30.', zh: '承诺已记下：11:30 前把深度相机交给同门。' }, null,
    { policy: P.admit, build: { en: 'A commitment with a time gets a reminder plan: when to speak, and what must be true first.', zh: '带时间的承诺会生成提醒计划：何时开口，开口前什么必须成立。' } });
  hud.cardSection({ id: 'kept', label: L({ en: 'Kept', zh: '记下' }), channel: 'SM', items: [
    L({ en: 'Ablation table to your supervisor, by Friday 12:00 (10:04)', zh: '消融实验表发给导师，周五 12:00 前（10:04）' }),
    L({ en: 'Depth camera to your lab mate, before 11:30 (10:11)', zh: '深度相机交给同门，11:30 前（10:11）' })] });
  await pause(3400);

  // ------------------------------------------------------------------ 10:30 · back to the desks
  await story.chapter('desk');
  at(10, 30);
  hud.hideCard();
  cast.supervisor.pointing = false;
  story.sit(false);
  hud.caption(L({ en: '10:30. The meeting ends.', zh: '10:30。组会结束。' }), 2600);
  moveMate(cast.supervisor, lab.spots.door).then(() => { lab.figures.setHidden(cast.supervisor, true); });
  moveMate(cast.mateA, [lab.seats.p1se.x, lab.seats.p1se.z], { sit: 'p1se', typing: true, speed: 1.1 });
  moveMate(cast.mateB, [lab.seats.p0nw.x, lab.seats.p0nw.z], { sit: 'p0nw', typing: true, speed: 1.0 });
  moveMate(cast.senior, [lab.seats.p2se.x, lab.seats.p2se.z], { sit: 'p2se', typing: true, speed: 1.15 });
  await pause(900);
  await story.walk([lab.seats.p3nw.x, lab.seats.p3nw.z], { speed: 1.4, face: lab.seats.p3nw.look });
  story.sit(true);
  lab.place(cast.bg1, 'p1nw', { typing: true });
  lab.place(cast.bg2, 'p2nw', { typing: true });
  await pause(1800);

  // ------------------------------------------------------------------ 11:05 · a conversation, then the reminder
  at(11, 5);
  hud.caption(L({ en: '11:05. A senior PhD student stops by your desk.', zh: '11:05。一位高年级博士生走到你桌边。' }), 3000);
  // The senior comes round the pods by the aisle, never through your chair.
  const TALK = [-65.55, 119.3];
  const AISLE = [[-69.2, 122.9], [-69.2, 119.3]];
  await walkMate(cast.senior, TALK, { via: AISLE, yaw: Math.atan2(lab.seats.p3nw.x - TALK[0], lab.seats.p3nw.z - TALK[1]), speed: 1.1 });
  await story.look([TALK[0], lab.floorY + 1.55, TALK[1]], 0.7);
  cast.senior.talking = true;
  say('senior', { en: 'Got a minute? Your data loader is three times faster than mine. How?', zh: '有空吗？你的 data loader 比我的快三倍，怎么做到的？' }, 4000);
  await pause(2800);
  step('update', 'SA', null, { en: 'You are in a conversation: a registered lab mate is talking to you.', zh: '你正在对话中：一位登记过的同门在和你说话。' }, null,
    { policy: P.interpret, condition: C.availability, build: { en: 'Voice activity plus a registered face in front of you counts as a conversation.', zh: '有人在说话，而且面前是登记过的脸，就算作对话。' } });
  await pause(2600);
  at(11, 15);
  step('wait', 'MA', null, { en: 'The camera reminder is due, but you are talking and 15 minutes of slack remain: holding it.', zh: '相机提醒到点了，但你在说话，离截止还有 15 分钟：先不说。' },
    { en: 'The contract says speak only outside conversations; the deadline says there is still time.', zh: '约定说只在对话之外开口；截止时间说还来得及。' },
    { policy: P.gate, condition: C.availability, grounds: { en: 'task due 11:30; in a conversation; contract', zh: '11:30 到期的待办；正在对话；服务约定' }, short: { en: 'holding a reminder', zh: '暂缓提醒' },
      build: { en: 'Gate on three things at once: the trigger, the contract, and the slack the deadline leaves.', zh: '同时看三件事：触发条件、服务约定、截止时间还剩多少余量。' } });
  await pause(3000);
  cast.senior.talking = false;
  say('you', { en: 'Pinned memory and four workers. Happy to pair on it later.', zh: 'pinned memory 加四个 worker。晚点可以一起看。' }, 3200);
  await pause(2800);
  say('senior', { en: 'Nice, thanks!', zh: '好，谢啦！' }, 1600);
  moveMate(cast.senior, [lab.seats.p2se.x, lab.seats.p2se.z], { via: [...AISLE].reverse(), sit: 'p2se', typing: true, speed: 1.1 });
  await pause(2200);
  at(11, 18);
  hud.toast({ kind: 'alert', channel: 'MA', title: L({ en: 'Depth camera for 11:30', zh: '11:30 的深度相机' }),
    text: L({ en: 'Your lab mate needs it at 11:30. Last seen on shelf B, Monday 18:40.', zh: '同门 11:30 要用。上次看到在 B 号架，周一 18:40。' }), ttl: 7000 });
  step('act', 'MA', null, { en: 'Reminder, once, now that you are free: the depth camera is needed at 11:30. Last seen on shelf B.', zh: '你空下来了，提醒一次：11:30 要用深度相机。上次看到在 B 号架。' },
    { en: 'Nobody asked again. A request-only assistant would have said nothing.', zh: '没有人再问一次。只在请求时运行的助手，这时不会开口。' },
    { policy: P.gate, grounds: { en: 'open task; conversation over; 12 min left', zh: '待办未完成；对话结束；还剩 12 分钟' }, short: { en: 'camera reminder', zh: '相机提醒' },
      build: { en: 'Fire once when the gate opens, then stay quiet unless the situation changes.', zh: '门控一打开就提醒一次，之后除非情况变化，不再重复。' } });
  await pause(3200);

  // ------------------------------------------------------------------ 11:19 · where the camera is not
  await story.chapter('camera');
  story.sit(false);
  hud.showCard({ number: 'CAM', row: L({ en: 'Shared lab equipment', zh: '实验室共用设备' }), title: L({ en: 'Depth camera, due 11:30', zh: '深度相机，11:30 要用' }),
    authors: L({ en: 'Last seen: shelf B, Monday 18:40', zh: '上次看到：B 号架，周一 18:40' }) });
  day.watching = { en: 'looking for: depth camera', zh: '寻找：深度相机' };
  step('act', 'MS', null, { en: 'Memory points Sensing at shelf B first: the last place the camera was seen.', zh: 'Memory 让 Sensing 先看 B 号架：相机上次出现的地方。' }, null,
    { policy: P.attend, grounds: { en: 'last sighting in Memory', zh: 'Memory 里的上次目击' }, short: { en: 'look at shelf B first', zh: '先看 B 号架' }, build: { en: 'Turn remembered object locations into a search order for the camera.', zh: '把记住的物品位置变成摄像头的搜索顺序。' } });
  await story.walk(lab.spots.shelfB.stand, { speed: 1.5, face: lab.spots.shelfB.look });
  at(11, 19);
  await pause(1600);
  step('update', 'SM', null, { en: 'Memory corrected: the camera is not on shelf B. Someone moved it while you were away.', zh: 'Memory 已更正：相机不在 B 号架。你不在的时候有人挪走了它。' },
    { en: 'A blind spot: the glasses only know what they saw, and the lab kept changing overnight.', zh: '这是盲区：眼镜只知道自己看到过的东西，而实验室在夜里一直在变。' },
    { policy: P.correct, condition: C.uncertainty, build: { en: 'Store each sighting with its time, and treat old sightings as guesses to verify.', zh: '每次目击都带时间保存，旧的目击只当作待核实的猜测。' } });
  hud.cardSection({ id: 'shelf', label: L({ en: 'Shelf B', zh: 'B 号架' }), channel: 'SM', items: [L({ en: 'Not here at 11:19; the slot is empty', zh: '11:19 不在；位置是空的' })] });
  await pause(3000);
  step('act', 'AS', null, { en: 'Action asks Sensing to scan the room for the camera’s shape.', zh: 'Action 让 Sensing 在房间里找相机的外形。' }, null,
    { policy: P.attend, short: { en: 'scan the room', zh: '扫视整个房间' }, build: { en: 'When memory fails, widen the search: the whole room, most likely surfaces first.', zh: '记忆不管用时就扩大搜索：整个房间，最可能的台面先看。' } });
  await story.look(lab.spots.charger.look, 1.4);
  await pause(1200);
  step('update', 'SA', null, { en: 'Found: the depth camera on the charging table by the window.', zh: '找到了：深度相机在窗边的充电桌上。' }, null,
    { policy: P.interpret, build: { en: 'A small detector for the lab’s shared equipment, running only while a search is open.', zh: '一个识别实验室共用设备的小模型，只在有搜索任务时运行。' } });
  hud.cardSection({ id: 'found', label: L({ en: 'Found', zh: '找到' }), channel: 'SA', items: [L({ en: 'Charging table by the window, 11:20', zh: '窗边充电桌，11:20' })] });
  day.watching = null;
  await pause(1800);
  await story.walk(lab.spots.charger.stand, { speed: 1.6, face: lab.spots.charger.look });
  lab.placeCamera(null);
  at(11, 22);
  await pause(900);
  const handTo = [-64.55, 118.25];
  await story.walk(handTo, { speed: 1.5, face: seatEye('p1se') });
  lab.placeCamera([-65.0, 0.775, 116.95, 0.2]);
  say('you', { en: 'Here you go.', zh: '给你。' }, 1800);
  await pause(1500);
  say('mateA', { en: 'Thanks, just in time.', zh: '谢啦，正好赶上。' }, 2200);
  at(11, 24);
  finishTask('camera');
  step('update', 'AM', null, { en: 'Task done: camera handed over at 11:24. The commitment is retired and kept in history.', zh: '待办完成：11:24 交出相机。这条承诺退役，记入历史。' },
    { en: 'The camera’s new place is noted too: your lab mate’s desk.', zh: '相机的新位置也记下了：同门的桌上。' },
    { policy: P.retire, build: { en: 'Mark the commitment done, keep what happened, and update the object’s location.', zh: '把承诺标为完成，保留经过，并更新物品位置。' } });
  hud.cardSection({ id: 'done', label: L({ en: 'Done', zh: '完成' }), channel: 'AM', items: [L({ en: 'Handed over at 11:24, before 11:30', zh: '11:24 交出，早于 11:30' })] });
  await pause(3400);
  hud.hideCard();

  // ------------------------------------------------------------------ 12:30 · lunch, and a resource budget
  await story.chapter('lunch');
  at(12, 30);
  await story.jump(FOOD_COURT.stand[0], FOOD_COURT.stand[1], { face: FOOD_COURT.face, caption: { en: '12:30. Lunch at the North Spine food court.', zh: '12:30。在 North Spine 食堂吃午饭。' } });
  await pause(2200);
  step('wait', null, 'A', { en: 'Lunch: nothing on your list is due, so the glasses stay silent.', zh: '午饭时间：清单上没有到期的事，眼镜保持安静。' }, null,
    { policy: P.gate, short: { en: 'nothing needs you', zh: '没有需要你的事' } });
  await pause(2400);
  step('note', null, 'S', { en: 'Battery at 46%: Sensing drops to one frame every 10 seconds while nothing on your list is nearby.', zh: '电量 46%：附近没有清单上的事时，Sensing 降到每 10 秒一帧。' },
    { en: 'The glasses must last until 22:00; sampling follows need, not habit.', zh: '眼镜要撑到 22:00；采样跟着需要走，而不是一直满速。' },
    { policy: P.sample, condition: C.resources, build: { en: 'Sample faster near an open task and slower when idle, against a budget for the whole day.', zh: '靠近待办时多采样，空闲时少采样，按整天的电量预算来分配。' } });
  await pause(3200);

  // ------------------------------------------------------------------ 13:02 · a training run, and its receipt
  await story.chapter('run');
  at(13, 2);
  lab.layout('desks');
  await story.enterLab({ at: [lab.seats.p3nw.x, lab.seats.p3nw.z], face: lab.seats.p3nw.look, seated: true,
    caption: { en: '13:02. Back at your desk.', zh: '13:02。回到座位。' } });
  lab.placeCamera([-65.0, 0.775, 116.95, 0.2]);
  await pause(1600);
  say('you', { en: 'Queue the ablation run on the cluster: four GPUs from the lab quota.', zh: '把消融实验排到集群上：四张 GPU，用实验室配额。' }, 3600);
  step('request', null, 'A', { en: 'You ask the glasses to queue the ablation run on the cluster.', zh: '你让眼镜把消融实验排到集群上。' }, null, { policy: P.effector });
  await pause(2600);
  const confirm = hud.toast({ kind: 'alert', channel: null, title: L({ en: 'Use 4 GPUs from the lab quota?', zh: '使用实验室配额中的 4 张 GPU？' }), text: L({ en: 'For this run only. Say yes to confirm.', zh: '仅限这次运行。说「好」确认。' }), ttl: 0 });
  await pause(2200);
  say('you', { en: 'Yes.', zh: '好。' }, 1400);
  confirm.close();
  await pause(900);
  step('act', null, 'A', { en: 'Submitted with your say-so: 4 GPUs from the lab quota, for this run only.', zh: '经你同意后提交：实验室配额的 4 张 GPU，仅限这次。' },
    { en: 'Spending shared resources needs explicit authority each time; the grant ends with the run.', zh: '动用共享资源每次都要明确授权；授权随这次运行结束。' },
    { policy: P.effector, condition: C.authority, short: { en: 'run submitted', zh: '已提交运行' }, build: { en: 'Scope each grant to one action, let it expire, and log who granted it.', zh: '每次授权只对应一个动作，到期失效，并记下是谁授权的。' } });
  await pause(2800);
  hud.showCard({ number: 'JOB', row: L({ en: 'Cluster receipt', zh: '集群回执' }), title: L({ en: 'Job 48213 · ablation run', zh: 'Job 48213 · 消融实验' }),
    authors: L({ en: 'Queued 13:02 · 4 GPUs · lab quota · about 3 h', zh: '13:02 排队 · 4 张 GPU · 实验室配额 · 约 3 小时' }), origin: L({ en: 'Linked to: ablation table, Friday 12:00', zh: '关联：消融实验表，周五 12:00' }) });
  step('update', 'AM', null, { en: 'Receipt kept: job 48213, queued 13:02, about 3 hours, for Friday’s ablation table.', zh: '回执已保存：job 48213，13:02 排队，约 3 小时，用于周五的消融实验表。' },
    { en: 'Action writes what it did back to Memory, so a later event can find its cause.', zh: 'Action 把自己做过的事写回 Memory，之后的事件才能找到来由。' },
    { policy: P.admit, build: { en: 'Store receipts (IDs, time, purpose) next to the commitment they serve.', zh: '把回执（编号、时间、用途）存在它服务的承诺旁边。' } });
  day.acting = { en: 'waiting on job 48213', zh: '等待 job 48213' };
  day.watching = { en: 'cluster feed: job 48213', zh: '集群消息：job 48213' };
  await pause(3400);
  hud.hideCard();
  hud.caption(L({ en: 'Three hours later.', zh: '三个小时后。' }), 2400);
  await pause(2400);

  // ------------------------------------------------------------------ 16:05 · the finish event meets its receipt
  at(16, 5);
  step('update', 'SM', null, { en: 'Cluster notice: job 48213 finished.', zh: '集群通知：job 48213 已完成。' },
    { en: 'Job notifications are common today. What is new is what happens next.', zh: '任务完成通知现在很常见。新的是接下来发生的事。' },
    { src: 'ego', policy: P.interpret });
  await pause(2400);
  day.watching = null;
  day.acting = null;
  const table = story.mem.pending.find(x => x.id === 'table');
  if (table) table.label = { en: 'ablation table · Fri 12:00 · results in', zh: '消融实验表 · 周五 12:00 · 结果已出' };
  hud.toast({ channel: 'MA', title: L({ en: 'Ablation run done', zh: '消融实验跑完了' }), text: L({ en: 'Job 48213 (queued 13:02) finished. Friday’s table can be drafted now.', zh: 'Job 48213（13:02 排队）已完成。周五的表现在可以开始写了。' }), ttl: 6500 });
  step('act', 'MA', null, { en: 'Linked to the 13:02 receipt: the run for Friday’s table is done, so the table can be drafted now.', zh: '对上了 13:02 的回执：周五那张表要的实验跑完了，现在可以开始写表。' },
    { en: 'A bare notice says a job ended; the link says which promise it moves forward.', zh: '单独的通知只说任务结束了；关联起来才知道它推进了哪个承诺。' },
    { policy: P.timing, grounds: { en: 'receipt from 13:02; commitment from 10:04', zh: '13:02 的回执；10:04 的承诺' }, short: { en: 'run done, table next', zh: '实验完成，接着写表' },
      build: { en: 'Join incoming events to stored receipts by ID before deciding whether to speak.', zh: '先按编号把新事件和已存的回执对上，再决定要不要开口。' } });
  await pause(3600);

  // ------------------------------------------------------------------ 21:30 · evening review at the hall
  await story.chapter('review');
  at(21, 30);
  story.setSky('night');
  await story.jump(HALL.stand[0], HALL.stand[1], { face: HALL.face, pitch: 0.1, caption: { en: '21:30. Back at Graduate Hall 1.', zh: '21:30。回到 Graduate Hall 1。' } });
  lab.setVisible(false);
  await pause(2000);
  hud.showCard({ number: '21:30', row: L({ en: 'Evening review', zh: '晚间回顾' }), title: L({ en: 'Tuesday', zh: '周二' }), authors: L({ en: 'From today’s log and open tasks', zh: '来自今天的记录和待办' }) });
  hud.cardSection({ id: 'done', label: L({ en: 'Done', zh: '完成' }), channel: 'MA', items: [L({ en: 'Depth camera handed over, 11:24', zh: '深度相机已交出，11:24' }), L({ en: 'Ablation run finished, 16:05', zh: '消融实验跑完，16:05' })] });
  hud.cardSection({ id: 'open', label: L({ en: 'Open', zh: '待办' }), channel: 'MA', items: [L({ en: 'Ablation table to your supervisor, Friday 12:00 (results in)', zh: '消融实验表发给导师，周五 12:00（结果已出）' })] });
  hud.cardSection({ id: 'tomorrow', label: L({ en: 'Tomorrow', zh: '明天' }), channel: 'MA', items: [L({ en: 'Rain forecast 08:00 to 10:00', zh: '预报 08:00 到 10:00 有雨' })] });
  step('act', 'MA', null, { en: 'Evening review: two things done, one open (the table, Friday 12:00), rain tomorrow morning.', zh: '晚间回顾：完成两件，待办一件（周五 12:00 的表），明早有雨。' }, null,
    { policy: P.timing, short: { en: 'evening review', zh: '晚间回顾' }, build: { en: 'One review near the end of the contract window, built from today’s log and open tasks.', zh: '在约定时段快结束时做一次回顾，内容来自今天的记录和待办。' } });
  await pause(4200);
  hud.hideCard();

  // ------------------------------------------------------------------ the extension: revising θ, validated, waiting for a boundary
  story.mem.revision = 'proposed';
  hud.toast({ kind: 'extension', title: L({ en: 'Extension · self-evolving', zh: '扩展 · 自进化' }),
    text: L({ en: 'Candidate rule θ₂: prompt at your measured walk time plus 2 minutes, plus 3 more when it rains.', zh: '候选规则 θ₂：按你实测的步行时间再加 2 分钟提醒，下雨再加 3 分钟。' }), ttl: 8000 });
  step('revise', null, null, { en: 'Candidate revision to the leave prompt: three mornings this month you ran for the bus after it, today included.', zh: '候选修订出门提醒：这个月有三个早上你收到提醒后跑着赶车，包括今天。' },
    { en: 'Content m changed all day: tasks, locations, receipts. This would change θ, the rule that decides when to prompt.', zh: '内容 m 一整天都在变：待办、位置、回执。这次要改的是 θ，也就是决定何时提醒的规则。' },
    { src: 'ext', grounds: { en: 'three runs after the prompt, all on this route', zh: '三次收到提醒后跑步，都在这条路线上' }, build: { en: 'Attribute outcomes to the rule that caused them before proposing a change; one bad morning is not enough.', zh: '先把结果归因到造成它的规则，再提出修改；一个糟糕的早上不够。' } });
  await pause(3600);
  step('revise', null, null, { en: 'Checked on this month’s 15 mornings: under θ₂ you would not have run, and no prompt comes more than 10 minutes early.', zh: '用这个月的 15 个早上检验：按 θ₂ 你都不用跑，也没有哪次提醒早于 10 分钟。' },
    { en: 'Validation comes before the rule is kept.', zh: '先验证，再保留规则。' },
    { src: 'ext', build: { en: 'Replay stored mornings under the candidate rule and compare outcomes with what happened.', zh: '用候选规则重放存下的早晨，和实际发生的结果对比。' } });
  story.mem.revision = 'ready';
  await pause(3200);
  step('note', null, null, { en: 'θ₂ waits for the next declared boundary: tomorrow, when you put the glasses on.', zh: 'θ₂ 等到下一个声明的边界再生效：明天你戴上眼镜的时候。' }, null, { src: 'ext' });
  await pause(2600);

  // ------------------------------------------------------------------ 22:00 · off duty, glasses off
  at(22, 0);
  step('wait', null, 'A', { en: '22:00: the contract window ends, and the glasses go quiet until 08:00.', zh: '22:00：约定时段结束，眼镜安静到明早 08:00。' },
    { en: 'Continuity runs on a declared schedule, not forever.', zh: '运行连续依照声明的时间表，而不是永远开着。' },
    { policy: P.gate, short: { en: 'off duty', zh: '下班' } });
  await pause(2200);
  story.setGlasses(false);
  await pause(1400);
  step('update', null, 'M', { en: 'The open task survives the night: ablation table, Friday 12:00.', zh: '待办跨过了夜晚：消融实验表，周五 12:00。' },
    { en: 'State durability. A session-local assistant would reset here and lose it.', zh: '状态持久。会话级的助手到这里会重置，把它忘掉。' },
    { policy: P.retrieve, build: { en: 'Open tasks live in the user’s store, keyed to the user, not to the session.', zh: '待办存在用户的存储里，按用户而不是按会话保存。' } });
  await pause(3400);

  // ------------------------------------------------------------------ Wednesday 08:24 · rain, and θ₂ takes over at the boundary
  await story.chapter('wednesday');
  at(8, 24);
  hud.setStatus({ session: L({ en: 'NTU · Wednesday', zh: 'NTU · 周三' }) });
  story.setSky('rain');
  await story.cut(() => { story.aim(HALL.face, 0.1); }, { en: 'Wednesday 08:24. It is raining.', zh: '周三 08:24。下雨了。' });
  await pause(2000);
  story.setGlasses(true);
  await pause(1600);
  story.mem.theta = 2;
  story.mem.revision = 'active';
  step('revise', null, null, { en: 'Activated as the glasses came on: θ₁ → θ₂.', zh: '戴上眼镜时生效：θ₁ → θ₂。' },
    { en: 'A declared boundary, not the middle of a decision.', zh: '在声明的边界生效，而不是在某个决定的中途。' },
    { src: 'ext', build: { en: 'Keep rule versions and switch only at a boundary, so no single decision mixes two rules.', zh: '保留规则版本，只在边界切换，避免同一个决定混用两套规则。' } });
  await pause(3000);
  at(8, 29);
  step('act', 'AS', null, { en: 'Fresh check before the leave prompt: shuttle feed and sky.', zh: '出门提醒前重新检查：班车信息和天色。' }, null, { policy: P.timing, short: { en: 'fresh check', zh: '重新检查' } });
  await pause(1800);
  step('update', 'SA', null, { en: 'Shuttle feed: bus at Blk 55 in 11 min. The camera sees rain.', zh: '班车信息：11 分钟后到 Blk 55。摄像头看到在下雨。' }, null, { src: 'ego', policy: P.interpret });
  await pause(2000);
  hud.toast({ kind: 'alert', channel: 'MA', title: L({ en: 'Leave in 2 minutes', zh: '2 分钟后出门' }), text: L({ en: 'Rain: take the covered walkway (7 min). Campus Loop Red at Blk 55 at 08:40.', zh: '下雨：走有顶连廊（7 分钟）。Campus Loop Red 08:40 到 Blk 55。' }), ttl: 6500 });
  step('act', 'MA', null, { en: 'Leave in 2 minutes: rain, so the covered walkway, 7 minutes. Bus at 08:40.', zh: '2 分钟后出门：下雨，走有顶连廊，7 分钟。车 08:40 到。' },
    { en: 'The same kind of prompt as yesterday, now decided by θ₂.', zh: '和昨天同一类提醒，现在由 θ₂ 决定。' },
    { src: 'ext', policy: P.timing, short: { en: 'leave in 2 min (θ₂)', zh: '2 分钟后出门（θ₂）' } });
  await pause(3200);
  at(8, 38);
  const bus2 = loop.send(0, 7);
  const wait2 = stopSide(0);
  await story.jump(wait2[0], wait2[1], { face: [loop.stops[0].x, loop.stops[0].z], caption: { en: '08:38. At the stop, dry, with two minutes to spare.', zh: '08:38。到站了，没淋雨，还富余两分钟。' } });
  await until(() => loop.atStop(bus2, 0), 10000);
  step('update', 'AM', null, { en: 'Logged with the prompt: you walked and made the bus.', zh: '和这条提醒一起记下：你走着就赶上了车。' },
    { en: 'The outcome under θ₂ is kept as evidence too, for the next revision or a rollback.', zh: 'θ₂ 下的结果也作为证据保留，供下一次修订或回滚使用。' },
    { src: 'ext', policy: P.admit });
  await pause(2600);
  openDaySheet(story);
}

function openDaySheet(story) {
  const L = story.L;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rows = [
    ['08:25', 'M', { en: 'Yesterday’s state reloads when the glasses come on', zh: '戴上眼镜，昨天的状态重新载入' }],
    ['08:36', 'M→A', { en: 'Leave prompt under θ₁; you had to run', zh: '按 θ₁ 提醒出门；结果得跑着赶车' }],
    ['10:04', 'S→M', { en: 'A commitment kept with its source; a health detail not kept', zh: '承诺连同出处记下；健康细节不记' }],
    ['11:15', 'M→A', { en: 'Reminder held during a conversation, given once after', zh: '对话中暂缓提醒，结束后提醒一次' }],
    ['11:19', 'M→S', { en: 'Memory sent Sensing to the wrong shelf; corrected', zh: 'Memory 把 Sensing 引到错的架子；已更正' }],
    ['13:02', 'A→M', { en: 'A cluster receipt kept, linked at 16:05 to Friday’s table', zh: '集群回执已保存，16:05 与周五的表关联上' }],
    ['21:30', 'θ', { en: 'A revision proposed and validated, held for a boundary', zh: '提出并验证修订，等待边界' }],
    ['08:24', 'θ₂', { en: 'Wednesday: activated at glasses-on; you walked to the bus', zh: '周三：戴上眼镜时生效；走着就赶上了车' }],
  ];
  story.hud.openSheet(`
    <p class="sheet-kicker">${L({ en: 'Memory card · Tuesday to Wednesday', zh: '记忆卡 · 周二到周三' })}</p>
    <h2 class="sheet-title">${L({ en: 'Your S-Lab day', zh: '你在 S-Lab 的一天' })}</h2>
    <p class="sheet-lede">${L({ en: 'One request all day. Everything else happened between requests, and most of it was waiting.', zh: '一整天只有一次请求。其余都发生在请求之间，而其中大部分是等待。' })}</p>
    <div class="sheet-grid">
      <section><h3>${L({ en: 'The day, by channel', zh: '按通道看这一天' })}</h3>
        <ol class="trail trail--day">${rows.map(([time, ch, text]) => `<li><span class="tr-i">${time}</span><span class="tr-n">${esc(ch)}</span><span class="tr-t">${esc(L(text))}</span><span class="tr-m"></span></li>`).join('')}</ol></section>
      <section><h3>${L({ en: 'Still open', zh: '仍未完成' })}</h3>
        <ol class="trail">${story.mem.pending.map(t => `<li><span class="tr-i">·</span><span class="tr-t" style="grid-column: 2 / 4">${esc(L(t.label))}</span><span class="tr-m">${L({ en: 'open', zh: '进行中' })}</span></li>`).join('') || `<li class="tr-empty">${L({ en: 'Nothing open.', zh: '没有待办。' })}</li>`}</ol>
        <p class="sheet-note">${L({ en: 'Friday’s table crossed one night already and will cross two more.', zh: '周五那张表已经跨过一个夜晚，还要再跨两个。' })}</p></section>
    </div>
    <div class="sheet-split">
      <div><h3>${L({ en: 'Continuity and durability', zh: '运行连续与状态持久' })}</h3><p>${L({ en: 'The glasses ran on a declared schedule, held a reminder while you talked, and carried a task and a camera sighting across the night.', zh: '眼镜按声明的时间表运行，在你说话时压住提醒，并把一条待办和一次相机目击带过了夜晚。' })}</p></div>
      <div class="is-on"><h3>${L({ en: 'Content m versus mechanism θ', zh: '内容 m 与机制 θ' })}</h3><p>${L({ en: 'Tasks, locations and receipts changed all day. The leave-prompt rule changed once, after validation, at Wednesday’s glasses-on (θ₁ → θ₂). That revision is the self-evolving extension.', zh: '待办、位置和回执一整天都在变；出门提醒的规则只改了一次，经过验证，在周三戴上眼镜时生效（θ₁ → θ₂）。这次修订就是自进化扩展。' })}</p></div>
    </div>
    <p class="sheet-foot">${L({ en: 'The student, the lab mates, the supervisor and all events are fictional. Places, roads and the Campus Loop Red route come from open data; the lab interior is illustrative.', zh: '学生、同门、导师和所有事件都是虚构的。地点、道路和 Campus Loop Red 路线来自开放数据；实验室室内是示意。' })}</p>`, { wide: true });
}
