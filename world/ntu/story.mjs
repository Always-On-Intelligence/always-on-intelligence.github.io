import * as THREE from 'three';
import { pointInPolygon } from '../engine/nav.mjs';
import { installTour, TOUR_ABORT } from '../engine/tour.mjs';
import { buildInterior, interiorFor } from './interiors.mjs';

// Always-on glasses on the NTU campus. Free mode: the glasses read buildings as you look, stay
// silent while you walk, answer greetings, and follow you into buildings (press E at a wall).
// The guided S-Lab day lives in day.mjs.

export { TOUR_ABORT };

const hhmm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(Math.floor(min % 60)).padStart(2, '0')}`;
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const P = {
  interpret: { en: 'π_S interpret', zh: 'π_S 解读' },
  attend: { en: 'π_S allocate attention', zh: 'π_S 分配注意力' },
  filter: { en: 'π_S filter: blur faces first', zh: 'π_S 过滤：先模糊人脸' },
  sample: { en: 'π_S sample', zh: 'π_S 采样' },
  admit: { en: 'π_M admit and encode', zh: 'π_M 接纳并编码' },
  refuse: { en: 'π_M decline to admit', zh: 'π_M 拒绝接纳' },
  correct: { en: 'π_M correct', zh: 'π_M 修正' },
  retrieve: { en: 'π_M retrieve', zh: 'π_M 检索' },
  retire: { en: 'π_M retire', zh: 'π_M 退役' },
  gate: { en: 'π_A gate: intervene or stay silent', zh: 'π_A 门控：介入还是保持安静' },
  timing: { en: 'π_A select timing', zh: 'π_A 选择时机' },
  effector: { en: 'π_A choose the effector within granted authority', zh: 'π_A 在授权范围内选择执行方式' },
};
export const C = {
  privacy: { en: 'Privacy', zh: '隐私' }, authority: { en: 'Authority', zh: '权限' }, availability: { en: 'Availability', zh: '可用性' },
  uncertainty: { en: 'Uncertainty', zh: '不确定性' }, resources: { en: 'Resources', zh: '资源' },
};

// Places the demo names, found by their OSM names in campus.json.
const KEY_PLACES = [
  { name: 'S-Lab for Advanced Intelligence', short: { en: 'S-Lab', zh: 'S-Lab' }, mark: 'S', r: 30 },
  { name: 'Academic Block North', short: { en: 'Academic Block North', zh: 'Academic Block North（ABN）' }, r: 50 },
  { name: 'North Spine', short: { en: 'North Spine', zh: 'North Spine' }, r: 80 },
  { name: 'Lee Wee Nam Library', short: { en: 'Lee Wee Nam Library', zh: 'Lee Wee Nam 图书馆' }, mark: 'L', r: 40 },
  { name: 'UOB Innovation Hub', short: { en: 'UOB Innovation Hub', zh: 'UOB Innovation Hub（原 The Hive）' }, mark: 'U', r: 55 },
  { name: 'The Arc - Learning Hub North', short: { en: 'The Arc', zh: 'The Arc' }, r: 45 },
  { name: 'School of Art, Design and Media', short: { en: 'School of Art, Design and Media', zh: '艺术设计与媒体学院（ADM）' }, r: 60 },
  { name: 'South Spine', short: { en: 'South Spine', zh: 'South Spine' }, r: 80 },
  { name: 'Canteen 2', short: { en: 'Canteen 2', zh: '二号食堂' }, r: 35 },
  { name: 'Nanyang Auditorium', short: { en: 'Nanyang Auditorium', zh: 'Nanyang Auditorium' }, r: 45 },
  { name: 'Chinese Heritage Centre', short: { en: 'Chinese Heritage Centre', zh: '华裔馆' }, r: 45 },
  { name: 'Yunnan Garden', short: { en: 'Yunnan Garden', zh: '云南园' }, r: 90 },
  { name: 'Sports and Recreation Centre', short: { en: 'Sports and Recreation Centre', zh: '体育中心' }, r: 70 },
  { name: 'Graduate Hall 1', short: { en: 'Graduate Hall 1', zh: 'Graduate Hall 1（研究生宿舍）' }, mark: 'H', r: 60 },
];

// Scenes of the guided day, for skipping and jumping.
export const CHAPTERS = [
  { id: 'hall', time: '08:25', title: { en: 'Graduate Hall 1: the morning brief', zh: 'Graduate Hall 1：晨间简报' } },
  { id: 'bus', time: '08:36', title: { en: 'The leave prompt and the bus', zh: '出门提醒和班车' } },
  { id: 'abn', time: '08:47', title: { en: 'To Academic Block North', zh: '去 Academic Block North' } },
  { id: 'meeting', time: '10:00', title: { en: 'Group meeting: what is kept, what is not', zh: '组会：记什么，不记什么' } },
  { id: 'desk', time: '10:30', title: { en: 'A conversation holds a reminder', zh: '对话中暂缓提醒' } },
  { id: 'camera', time: '11:19', title: { en: 'The camera is not on shelf B', zh: '相机不在 B 号架' } },
  { id: 'lunch', time: '12:30', title: { en: 'Lunch on a battery budget', zh: '午饭和电量预算' } },
  { id: 'run', time: '13:02', title: { en: 'A training run and its receipt', zh: '训练任务和回执' } },
  { id: 'review', time: '21:30', title: { en: 'Evening review and θ₂', zh: '晚间回顾和 θ₂' } },
  { id: 'wednesday', time: { en: 'Wed', zh: '周三' }, title: { en: 'Wednesday: θ₂ takes over in the rain', zh: '周三：雨天 θ₂ 生效' } },
];

const ABN = 'Academic Block North';

export class NtuStory {
  constructor({ world, campus, player, hud, minimap, camera, lang, t, L, nav, scene, renderer, quality }) {
    Object.assign(this, { world, campus, player, hud, minimap, camera, lang, t, L, nav, scene, renderer, quality });
    this.inside = false;
    this.room = null;
    this.seated = false;
    this.enterable = this.buildEnterable();
    this.clock = 9 * 60 + 40;
    this.glassesOn = true;
    this.tour = null;
    this.mem = { pending: [], done: [], log: [], seen: new Set(), theta: 1, revision: 'none' };
    this.decision = { kind: 'wait', text: { en: 'nothing needs you', zh: '没有需要你的事' } };
    this.blurPool = [];
    this.blurCount = 0;
    this.tmp = new THREE.Vector3();
    this.lastWait = performance.now();
    this.walked = 0;
    this.passedBuildings = new Set();
    this.places = KEY_PLACES.map(k => ({ ...k, place: campus.places.find(p => p.name === k.name) || this.buildingPlace(k.name) })).filter(k => k.place);
    this.zone = null;
    this.hud.setStatus({ session: t('session'), time: hhmm(this.clock) });
    this.hud.setContract(t('contract'), () => this.openContract());
    this.bindUi();
    this.bindTourUi(CHAPTERS);
    setTimeout(() => {
      if (this.tour) return;
      this.step('note', null, 'S', { en: 'Glasses on. Sensing runs between your requests; faces are blurred first.', zh: '眼镜已戴上。Sensing 在你的请求之间也在运行，人脸先做模糊。' }, null,
        { src: 'target', policy: P.filter, condition: C.privacy, build: { en: 'Detect and blur on the device, before frames reach a model or storage.', zh: '在设备端检测并模糊，画面到达模型或存储之前就处理掉。' } });
      this.hud.toast({ title: L({ en: 'Walk around NTU', zh: '在 NTU 里走走' }),
        text: L({ en: 'Look at a building and the glasses name it; walk up to one and press E to go in. M opens the map, or live one S-Lab day with the glasses.', zh: '看向一栋楼，眼镜会认出它；走到楼边按 E 可以进去。M 打开地图，或者跟着眼镜过一天 S-Lab 的日子。' }), ttl: 11000,
        actions: [{ label: t('startTour'), run: () => this.startTour() }] });
    }, 1500);
  }

  get time() { return hhmm(this.clock); }

  step(kind, channel, module, text, detail = null, meta = {}) {
    const L = this.L;
    this.hud.trace({ time: this.time, kind, channel, module, text: L(text), detail: L(detail), src: meta.src || 'target',
      meta: { policy: L(meta.policy), grounds: L(meta.grounds), condition: L(meta.condition), build: L(meta.build) } });
    if (kind === 'act' || kind === 'wait') this.decision = { kind, text: meta.short || text };
    this.mem.log.push({ time: this.time, kind, text: L(text) });
  }

  bindUi() {
    const hud = this.hud;
    hud.el('[data-trail]').addEventListener('click', () => this.openTrail());
    hud.el('[data-about]').addEventListener('click', () => this.openAbout());
    hud.el('[data-glasses]').addEventListener('click', () => { if (!this.tour) this.setGlasses(!this.glassesOn); });
  }

  /** Buildings you can walk into: named ones, and unnamed ones bigger than a shed. */
  buildEnterable() {
    const out = [];
    const skip = new Set(['roof', 'substation', 'shed', 'garage', 'garages', 'service', 'construction', 'hut', 'toilets', 'kiosk', 'transformer_tower']);
    for (const b of this.campus.buildings) {
      if (skip.has(b.k)) continue;
      const ring = [];
      for (let i = 0; i < b.p.length; i += 2) ring.push([b.p[i], b.p[i + 1]]);
      if (ring.length < 3) continue;
      const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
      const box = [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
      if (!b.n && (box[2] - box[0]) * (box[3] - box[1]) < 180) continue;
      out.push({ b, ring, box, name: b.n || null });
    }
    return out;
  }

  placeOf(name) { return this.campus.places.find(p => p.name === name) || this.buildingPlace(name); }

  buildingPlace(name) {
    const b = this.campus.buildings.find(x => x.n === name);
    if (!b) return null;
    const n = b.p.length / 2;
    let x = 0, z = 0;
    for (let i = 0; i < b.p.length; i += 2) { x += b.p[i]; z += b.p[i + 1]; }
    return { name, x: x / n, z: z / n };
  }

  /** Fade out, run the change, fade back in: used for jumps and scene cuts. */
  async cut(change, caption = null) {
    if (this.skipping) { this.player.stop(); await change(); return; }
    const app = this.hud.root.parentElement;
    app.classList.add('is-cut');
    await new Promise(r => setTimeout(r, 380));
    this.player.stop();
    await change();
    if (caption) this.hud.caption(this.L(caption), 3400);
    await new Promise(r => setTimeout(r, 140));
    app.classList.remove('is-cut');
  }

  aim(face, pitch = -0.04) {
    const p = this.player;
    if (face) p.yaw = Math.atan2(-(face[0] - p.x), -((face.length === 3 ? face[2] : face[1]) - p.z));
    p.pitch = pitch;
    p.cancelLook();
  }

  /** Teleport with a short fade, used for long distances and scene cuts. Lands on open ground connected to the campus. */
  async jump(x, z, { face = null, caption = null, pitch = -0.04 } = {}) {
    await this.cut(() => {
      if (this.inside) this.leaveRoomState();
      const spot = this.nav.nearestReachable(x, z, 160) || [x, z];
      this.player.x = spot[0]; this.player.z = spot[1];
      this.player.groundY = this.player.groundAt(spot[0], spot[1]);
      this.aim(face, pitch);
    }, caption);
  }

  // ------------------------------------------------------------ rooms: S-Lab and building interiors
  /** Step into a room (the S-Lab or a building interior): its own floor, walls and navigation. */
  async enterRoom(room, { at = null, face = null, seated = false, caption = null } = {}) {
    this.entering = true;
    try {
      await this.cut(() => {
        if (this.inside && this.room !== room) this.leaveRoomState();
        this.inside = true;
        this.room = room;
        this.seated = seated;
        room.setVisible(true);
        this.player.nav = room.nav;
        this.player.groundAt = () => room.floorY - (this.seated ? 0.44 : 0);
        const spot = at || room.spots.inside;
        this.player.x = spot[0]; this.player.z = spot[1];
        this.player.groundY = this.player.groundAt();
        this.player.overview.dist = room === this.world.lab ? 11 : 8.5;
        if (face) this.aim(face, -0.05);
        else { this.player.yaw = room.yawIn; this.player.pitch = -0.03; this.player.cancelLook(); }
        this.hud.brackets(null);
        this.hud.setInteract(null);
        this.gazeName = null;
        this.entranceIntent = null;
      }, caption);
    } finally {
      this.entering = false;
    }
  }

  async enterLab({ at = null, face = null, seated = false, caption = null } = {}) {
    const lab = this.world.lab;
    if (!this.tour && lab.people.every(p => p.hidden)) lab.layout('desks');
    this.lastEntrance ||= { outside: [-66, 131], face: [-40, 131] };
    await this.enterRoom(lab, { at, face: face || lab.spots.window, seated, caption });
  }

  leaveRoomState() {
    const room = this.room;
    this.inside = false;
    this.seated = false;
    this.room = null;
    if (room) {
      room.setVisible(false);
      room.setCutaway?.(false);
      if (room !== this.world.lab) room.dispose();
    }
    this.player.nav = this.nav;
    this.player.groundAt = this.world.ground;
    this.player.overview.dist = 46;
    this.hud.setInteract(null);
  }

  /** Walk out: back to where you came in, facing away from the building. */
  async leaveRoom({ caption = null } = {}) {
    const room = this.room;
    if (!room) return;
    const out = this.lastEntrance || { outside: [-66, 131], face: [-40, 131] };
    this.onLeaveRoom(room);
    await this.jump(out.outside[0], out.outside[1], { face: out.face, caption: caption || { en: `You leave ${room.name || 'the building'}.`, zh: `你离开了 ${room.name || '这栋楼'}。` } });
  }

  async exitLab(opts = {}) { await this.leaveRoom(opts); }

  roomName(room = this.room) {
    if (!room) return '';
    return room === this.world.lab ? 'S-Lab' : room.name;
  }

  /** The nearest wall you face, within a few metres: where you could walk in. */
  updateEntrance(now) {
    if (this.entranceAt && now - this.entranceAt < 150) return;
    this.entranceAt = now;
    if (this.tour || this.entering || this.player.mode === 'overview') { this.entrance = null; this.hud.setInteract(null); return; }
    const p = this.player, fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    let best = null, bestD = 3.4;
    for (const e of this.enterable) {
      if (p.x < e.box[0] - 4 || p.x > e.box[2] + 4 || p.z < e.box[1] - 4 || p.z > e.box[3] + 4) continue;
      const r = e.ring;
      for (let i = 0; i < r.length; i++) {
        const [ax, az] = r[i], [bx, bz] = r[(i + 1) % r.length];
        const ex = bx - ax, ez = bz - az, len2 = ex * ex + ez * ez;
        if (len2 < 1) continue;
        const t = Math.max(0, Math.min(1, ((p.x - ax) * ex + (p.z - az) * ez) / len2));
        const qx = ax + ex * t, qz = az + ez * t, d = Math.hypot(p.x - qx, p.z - qz);
        if (d >= bestD) continue;
        const len = Math.sqrt(len2);
        let nx = -ez / len, nz = ex / len;
        if (!pointInPolygon(qx + nx * 0.6, qz + nz * 0.6, r)) { nx = -nx; nz = -nz; }
        if (fx * nx + fz * nz < 0.25 && this.entranceIntent !== e) continue;
        bestD = d;
        best = { e, point: [qx, qz], inward: [nx, nz] };
      }
    }
    this.entrance = best;
    if (!best) { this.hud.setInteract(null); return; }
    const name = best.e.name || this.L({ en: 'this building', zh: '这栋楼' });
    const label = best.e.name === ABN ? this.L({ en: `Enter ${name} · S-Lab`, zh: `进入 ${name} · S-Lab` }) : this.L({ en: `Enter ${name}`, zh: `进入 ${name}` });
    this.hud.setInteract(label, () => this.interact());
  }

  /** E, or the prompt: go into the building in front of you, or leave the one you are in. */
  interact() {
    if (this.tour || this.entering || this.leaving) return;
    if (this.inside) {
      this.leaving = true;
      this.leaveRoom().finally(() => { this.leaving = false; });
      return;
    }
    if (this.entrance) this.enterBuilding(this.entrance);
  }

  async enterBuilding({ e, point, inward }) {
    const L = this.L;
    this.lastEntrance = { outside: [point[0] - inward[0] * 2, point[1] - inward[1] * 2], face: [point[0] - inward[0] * 12, point[1] - inward[1] * 12] };
    if (e.name === ABN) {
      await this.enterLab({ caption: { en: 'Academic Block North. You take the lift to level 2: S-Lab (illustrative room).', zh: 'Academic Block North。你坐电梯到二层：S-Lab（示意室内）。' } });
      return;
    }
    const { kind, place } = interiorFor(e.b, e.ring, this.campus.places, point);
    // A mapped place near the door names the room (Lee Wee Nam Library inside North Spine).
    const building = e.name || L({ en: 'Campus building', zh: '校园建筑' });
    const name = place && place !== e.name ? (e.name ? `${place} · ${e.name}` : place) : building;
    const room = buildInterior({ kind, name, levels: e.b.l, entrance: point, inward, ground: this.world.ground, quality: this.quality, lang: this.lang });
    this.world.root.add(room.group);
    room.setVisible(false);
    await this.enterRoom(room, { caption: { en: `${name}: ${room.label.en}. The interior is illustrative; walk out the door or press E to leave.`, zh: `${name}：${room.label.zh}。室内为示意；从门走出去或按 E 离开。` } });
    this.onEnterRoom(room);
  }

  /** What the glasses do in each kind of place: the contract names quiet and private places. */
  onEnterRoom(room) {
    if (this.tour) return;
    const L = this.L, name = room.name;
    this.hud.zone(`room:${name}`, name, performance.now());
    if (room.kind === 'library') {
      this.step('wait', null, 'A', { en: `Quiet zone in ${name}: anything that is not urgent waits until you leave.`, zh: `${name} 是安静区：不紧急的提醒都等你离开再说。` },
        { en: 'The contract lists libraries and lectures as quiet places.', zh: '服务约定把图书馆和上课列为安静场合。' },
        { policy: P.gate, condition: C.availability, short: { en: 'quiet zone', zh: '安静区' }, build: { en: 'Read the place type from the map and the signs, and check it against the contract before speaking.', zh: '从地图和指示牌判断场所类型，开口前先对照服务约定。' } });
    } else if (room.kind === 'lecture') {
      this.step('wait', null, 'A', { en: 'Lecture in progress: the glasses stay quiet until it ends.', zh: '正在上课：眼镜保持安静，直到下课。' },
        { en: 'Quiet in lectures is part of the contract.', zh: '上课时保持安静写在服务约定里。' },
        { policy: P.gate, condition: C.availability, short: { en: 'lecture: quiet', zh: '上课：安静' } });
    } else if (room.kind === 'hall' || room.kind === 'home') {
      this.step('note', null, 'S', { en: 'Residential building: past the lobby the camera pauses, so nobody’s home is recorded.', zh: '住宅楼：过了大堂摄像头就暂停，不记录别人的住处。' }, null,
        { policy: P.filter, condition: C.privacy, build: { en: 'Mark private areas on the map; pause capture there and keep only the wake word.', zh: '在地图上标出私人区域；在那里暂停采集，只保留唤醒词。' } });
    } else if (room.kind === 'canteen') {
      this.step('note', null, 'S', { en: `Busy ${L(room.label)}: every face is blurred before processing.`, zh: `${L(room.label)}里人很多：每张脸在处理前都先模糊。` }, null, { policy: P.filter, condition: C.privacy });
      this.step('wait', null, 'A', { en: 'Nothing on your list here, so the glasses stay silent.', zh: '这里没有你清单上的事，眼镜保持安静。' }, null, { policy: P.gate, short: { en: 'nothing needs you', zh: '没有需要你的事' } });
    } else if (room.kind === 'sports') {
      this.step('note', null, 'S', { en: 'Sports hall: fast motion and nothing to follow, so Sensing samples less.', zh: '体育馆：动作快又没有要跟进的事，Sensing 降低采样。' }, null, { policy: P.sample, condition: C.resources });
    } else {
      const levels = room.levels ? { en: `the directory lists ${room.levels} levels`, zh: `楼层指引显示共 ${room.levels} 层` } : { en: 'the directory is read', zh: '读到了楼层指引' };
      this.step('update', 'SM', null, { en: `Inside ${name}: ${levels.en}.`, zh: `进入 ${name}：${levels.zh}。` },
        { en: 'The number of levels comes from the map; the interior itself is illustrative.', zh: '楼层数来自地图；室内布局是示意。' }, { policy: P.interpret });
    }
  }

  onLeaveRoom(room) {
    if (this.tour || !room) return;
    if (room.kind === 'library' || room.kind === 'lecture') {
      this.step('act', null, 'A', { en: 'Out of the quiet zone: held prompts may speak again.', zh: '离开安静区：暂缓的提醒可以恢复。' }, null, { policy: P.timing, short: { en: 'prompts resume', zh: '提醒恢复' } });
    } else if (room.kind === 'hall' || room.kind === 'home') {
      this.step('note', null, 'S', { en: 'Out of the residential building: the camera resumes.', zh: '离开住宅楼：摄像头恢复。' }, null, { policy: P.sample });
    }
  }

  /** Sit down or stand up in place: the eye drops to seated height. */
  sit(on) { this.seated = on; }

  setSky(name) {
    this.world.setSky(name, this.scene, this.renderer);
    this.hud.root.parentElement.classList.toggle('is-rain', name === 'rain');
  }

  // ------------------------------------------------------------ glasses on and off
  setGlasses(on) {
    if (on === this.glassesOn) return;
    const L = this.L;
    this.glassesOn = on;
    this.hud.setGlasses(on);
    if (!on) {
      this.step('boundary', null, null, { en: 'Glasses off: the interaction ends here.', zh: '摘下眼镜：这次交互到此结束。' }, { en: 'An interaction boundary, t ∈ ℬ.', zh: '一个交互边界，t ∈ ℬ。' });
      this.step('note', null, 'A', { en: 'The service keeps running on your phone: no camera, same decisions.', zh: '服务在手机上继续运行：没有摄像头，判断照旧。' },
        { en: 'What stays on is the decision whether to help, not the camera.', zh: '保持开着的是「要不要帮你」的判断，不是摄像头。' }, { policy: P.effector });
      this.hud.phone([
        { title: L({ en: 'Glasses', zh: '眼镜' }), text: this.mem.pending.length ? L({ en: `${this.mem.pending.length} open task(s)`, zh: `${this.mem.pending.length} 条待办` }) : L({ en: 'No open tasks', zh: '没有待办' }) },
        { title: 'NTU', text: L({ en: 'Campus Loop Red running', zh: 'Campus Loop Red 运行中' }) },
      ]);
      this.hud.brackets(null);
    } else {
      this.step('update', null, 'M', { en: 'Glasses on: open tasks and today’s log are back.', zh: '戴回眼镜：待办和今天的记录都回来了。' }, null, { policy: P.retrieve });
    }
  }

  // ------------------------------------------------------------ greetings
  /**
   * Get within talking distance of someone. With `walk` (a tap on a touch screen) the player walks
   * up; otherwise the person must already be close, and the view turns to them.
   */
  async reach(p, eye, walk) {
    const player = this.player;
    const d = Math.hypot(p.x - player.x, p.z - player.z);
    if (walk && d > 2.4) {
      const a = Math.atan2(player.z - p.z, player.x - p.x);
      return player.walkTo([p.x + Math.cos(a) * 1.35, p.z + Math.sin(a) * 1.35], { face: eye });
    }
    if (d > 3.8) return false;
    await player.lookAt(eye, 0.5);
    return true;
  }

  async greet(p, { walk = false } = {}) {
    if (this.tour || !p || p.hidden || p.kind === 'extra' || !this.glassesOn) return;
    if (p.lab) return this.greetLabMate(p, walk);
    if (p.room) return this.greetRoomPerson(p, walk);
    const L = this.L, player = this.player;
    if (!await this.reach(p, [p.x, (p.y || 0) + 1.62, p.z], walk)) return;
    this.world.crowd.greet(p, player);
    this.hud.say(L({ en: 'You', zh: '你' }), L({ en: 'Hi!', zh: '你好！' }), 1500);
    await new Promise(r => setTimeout(r, 1100));
    const who = L({ en: 'Student', zh: '同学' });
    this.step('update', null, 'S', { en: 'Talking with someone you have not registered: their face stays blurred.', zh: '在和一位未登记的人说话：对方的脸保持模糊。' }, null,
      { src: 'target', policy: P.filter, condition: C.privacy });
    if (p.i % 4 === 0) {
      this.hud.say(who, L({ en: 'Meeting at the Hive? It is called UOB Innovation Hub now, same building.', zh: '在 Hive 碰头？它现在叫 UOB Innovation Hub 了，还是那栋楼。' }), 4200);
      this.step('update', 'SM', null, { en: 'Name update: The Hive is now UOB Innovation Hub. The alias is kept with its source; no new place is added.', zh: '名称更新：The Hive 现在叫 UOB Innovation Hub。旧名作为别名保留并记下来源，不新增地点。' }, null,
        { src: 'target', policy: P.correct, condition: C.uncertainty, build: { en: 'Correct the place record in place; keep the old name as an alias so old notes still resolve.', zh: '原地修正地点记录；旧名保留为别名，旧笔记仍能对上。' } });
      return;
    }
    const talk = [
      { en: 'Hey! Is the Campus Loop Red running late again?', zh: '嘿！Campus Loop Red 又晚点了吗？' },
      { en: 'Hi! The library is packed before finals.', zh: '你好！考试前图书馆人好多。' },
      { en: 'Morning! It might rain later, take an umbrella.', zh: '早！等会儿可能下雨，记得带伞。' },
    ];
    this.hud.say(who, L(talk[p.i % talk.length]), 3400);
    this.step('wait', null, 'A', { en: 'Just talk: nothing for the assistant to do.', zh: '只是闲聊：助手不需要做什么。' },
      { en: 'Nothing was asked and nothing is pending, so the glasses stay silent.', zh: '没人提要求，也没有待办，所以眼镜保持安静。' },
      { src: 'target', policy: P.gate, short: { en: 'just talk', zh: '只是闲聊' } });
  }

  async greetLabMate(p, walk) {
    const L = this.L, player = this.player, lab = this.world.lab;
    if (!await this.reach(p, [p.x, lab.floorY + (p.state === 'sit' ? 1.2 : 1.62), p.z], walk)) return;
    lab.figures.greet(p, player);
    this.hud.say(L({ en: 'You', zh: '你' }), L({ en: 'Hi!', zh: '嗨！' }), 1500);
    await new Promise(r => setTimeout(r, 1100));
    const who = L(p.role === 'supervisor' ? { en: 'Supervisor', zh: '导师' } : p.role === 'senior' ? { en: 'Senior PhD student', zh: '高年级博士生' } : { en: 'Lab mate', zh: '同门' });
    const lines = {
      supervisor: { en: 'Hi! How are the experiments going?', zh: '嗨！实验进展怎么样？' },
      mateA: { en: 'Hey! The GPU queue is long today.', zh: '嘿！今天 GPU 排队好长。' },
      mateB: { en: 'Hi! Kopi at the Hive later?', zh: '嗨！等会儿去 Hive 喝杯咖啡？' },
      senior: { en: 'Hey! Your data loader trick worked for me too.', zh: '嘿！你那个 data loader 的办法我也用上了。' },
    };
    this.hud.say(who, L(lines[p.role] || { en: 'Hi! Back to the deadline.', zh: '嗨！继续赶 deadline。' }), 3400);
    this.step('update', null, 'S', { en: `${who}: a contact you registered, so recognised and not blurred.`, zh: `${who}：你登记过的联系人，所以被认出，不做模糊。` }, null,
      { policy: P.interpret, condition: C.privacy, build: { en: 'Match faces only against the contacts the wearer registered.', zh: '人脸只和佩戴者登记过的联系人比对。' } });
    this.step('wait', null, 'A', { en: 'Just talk: nothing for the assistant to do.', zh: '只是闲聊：助手不需要做什么。' }, null,
      { policy: P.gate, short: { en: 'just talk', zh: '只是闲聊' } });
  }

  async greetRoomPerson(p, walk) {
    const L = this.L, player = this.player, room = this.room;
    if (!room) return;
    if (!await this.reach(p, [p.x, room.floorY + (p.state === 'sit' ? 1.2 : 1.62), p.z], walk)) return;
    room.figures.greet(p, player);
    this.hud.say(L({ en: 'You', zh: '你' }), L(room.kind === 'library' || room.kind === 'lecture' ? { en: '(whispering) Hi.', zh: '（小声）你好。' } : { en: 'Hi!', zh: '你好！' }), 1500);
    await new Promise(r => setTimeout(r, 1100));
    const lines = {
      library: { en: '(whispering) Hi! It is packed before finals.', zh: '（小声）嗨！考试前这里人好多。' },
      lecture: { en: '(whispering) The slides are online, by the way.', zh: '（小声）对了，课件已经放到网上了。' },
      canteen: { en: 'The chicken rice queue is long again today.', zh: '今天鸡饭的队又好长。' },
      hall: { en: 'Hi! Are you visiting someone?', zh: '嗨！你是来找人的吗？' },
      home: { en: 'Hello! Looking for someone?', zh: '你好！找人吗？' },
      sports: { en: 'Want to join the next game?', zh: '要不要一起打下一场？' },
      lobby: { en: 'Hi! The lifts are slow today.', zh: '嗨！今天电梯好慢。' },
    };
    this.hud.say(L({ en: 'Student', zh: '同学' }), L(lines[room.kind] || lines.lobby), 3400);
    this.step('update', null, 'S', { en: 'Talking with someone you have not registered: their face stays blurred.', zh: '在和一位未登记的人说话：对方的脸保持模糊。' }, null, { policy: P.filter, condition: C.privacy });
    this.step('wait', null, 'A', { en: 'Just talk: nothing for the assistant to do.', zh: '只是闲聊：助手不需要做什么。' }, null, { policy: P.gate, short: { en: 'just talk', zh: '只是闲聊' } });
  }

  // ------------------------------------------------------------ every frame
  update(dt, now) {
    this.clock += dt * (this.tour ? 0 : 1 / 12);
    this.hud.setStatus({ time: this.time });
    const moving = this.player.path || Math.hypot(this.player.vx, this.player.vz) > 0.5;
    if (moving) this.walked += dt;
    if (this.inside && this.room) {
      const room = this.room;
      room.update(dt, this.player, this.camera);
      room.setCutaway?.(this.player.mode === 'overview' && this.player.overview.t > 0.15);
      if (!this.tour) {
        room.idle?.(dt);
        // Walking out through the door leaves the room.
        const door = room.spots.door;
        if (!this.leaving && !this.entering && Math.hypot(this.player.x - door[0], this.player.z - door[1]) < 0.7) this.interact();
        else this.hud.setInteract(this.L({ en: `Leave ${this.roomName()}`, zh: `离开 ${this.roomName()}` }), () => this.interact(), { quiet: true });
      }
    } else this.updateEntrance(now);
    if (this.glassesOn) {
      if (this.inside) { this.hud.brackets(null); this.gazeName = null; } else this.updateGaze(dt, now);
      this.updateBlur();
      if (!this.tour) this.updateWaits(now);
    } else {
      for (const box of this.blurPool) box.style.display = 'none';
      this.hud.brackets(null);
      this.blurCount = 0;
    }
    this.updateZone(now);
    this.day?.update?.(dt, now);
    if (!this.moduleAt || now - this.moduleAt > 250) { this.moduleAt = now; this.refreshModules(); }
    if (!this.mapAt || now - this.mapAt > 90) {
      this.mapAt = now;
      this.minimap.setMarkers(this.places.filter(k => k.mark).map(k => ({ x: k.place.x, z: k.place.z, label: k.mark, title: this.L(k.short), state: this.mem.pending.some(t => t.place === k.name) ? 'next' : 'place' })));
      const p = this.player;
      if (p.path) this.minimap.setRoute([[p.x, p.z], ...p.path.slice(p.pathIndex)]);
      else this.minimap.setRoute(this.route || null);
      this.minimap.drawSmall({ x: p.x, z: p.z, yaw: p.yaw });
      if (!this.hud.el('[data-fullmap]').hidden) this.minimap.drawFull({ x: p.x, z: p.z, yaw: p.yaw });
    }
  }

  updateGaze(dt, now) {
    // Read the building you look at: the glasses name it, like a sign you glance at.
    if (this.gazeAt && now - this.gazeAt < 160) return;
    this.gazeAt = now;
    const cam = this.camera;
    const fwd = cam.getWorldDirection(this.tmp.set(0, 0, 0)).clone();
    const seen = [];
    for (const b of this.world.named) {
      const dx = b.cx - cam.position.x, dz = b.cz - cam.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 170 || d < 4) continue;
      const my = (b.g + b.top) / 2 - cam.position.y;
      const len = Math.hypot(dx, my, dz);
      const a = Math.acos(Math.max(-1, Math.min(1, (dx * fwd.x + my * fwd.y + dz * fwd.z) / len)));
      if (a < 0.16) seen.push([a, b]);
    }
    seen.sort((p, q) => p[0] - q[0]);
    const best = seen.find(([, b]) => !this.hidden(b, cam.position))?.[1] || null;
    if (!best) { this.hud.brackets(null); this.gazeName = null; return; }
    if (this.gazeName !== best.name) { this.gazeName = best.name; this.gazeSince = now; }
    this.tmp.set(best.cx, best.top + 2, best.cz).project(cam);
    if (this.tmp.z > 1) { this.hud.brackets(null); return; }
    const w = this.hud.root.clientWidth, h = this.hud.root.clientHeight;
    const sx = (this.tmp.x + 1) / 2 * w, sy = (1 - this.tmp.y) / 2 * h;
    const locked = now - this.gazeSince > 700;
    const name = best.name === 'UOB Innovation Hub' && this.lang === 'zh' ? 'UOB Innovation Hub（原 The Hive）' : best.name;
    const levels = this.campus.buildings.find(x => x.n === best.name)?.l;
    this.hud.brackets({ x: sx - 34, y: sy - 18, w: 68, h: 36 }, locked ? `${name}${levels ? ` · ${levels}F` : ''}` : this.L({ en: 'reading…', zh: '正在识别…' }), locked ? 'locked' : 'scan');
    if (locked && !this.mem.seen.has(best.name) && (!this.lastSeenLog || now - this.lastSeenLog > 15000)) {
      this.mem.seen.add(best.name);
      this.lastSeenLog = now;
      this.step('update', 'SM', null, { en: `Recognized ${name}.`, zh: `认出了 ${name}。` }, { en: 'A place seen today is noted, with where you were.', zh: '今天看到的地点会被记下，连同你当时的位置。' },
        { src: 'target', policy: P.interpret, build: { en: 'Match the view against the campus map by bearing and outline; confirm with signage when readable.', zh: '按方位和轮廓把画面对到校园地图上；能读到招牌时再确认。' } });
    }
  }

  /** A building hidden behind another: the first footprint on the ground line is not its own. */
  hidden(b, from) {
    const dx = b.cx - from.x, dz = b.cz - from.z, d = Math.hypot(dx, dz);
    for (let s = 2; s < d; s += 1) {
      const x = from.x + dx / d * s, z = from.z + dz / d * s;
      if (!this.nav.solid(x, z)) continue;
      for (let k = 0; k <= 3; k++) if (pointInPolygon(x + dx / d * k, z + dz / d * k, b.ring)) return false;
      return true;
    }
    return false;
  }

  updateWaits(now) {
    if (this.walked > 35 && now - this.lastWait > 45000) {
      this.lastWait = now;
      this.walked = 0;
      this.step('wait', null, 'A', { en: 'Walking between buildings; nothing on your list is nearby, so the glasses stay silent.', zh: '在楼与楼之间走；附近没有你清单上的事，眼镜保持安静。' },
        { en: 'Operational continuity: steps happen between requests, and most of them end in waiting.', zh: '运行连续：请求之间也在运行，多数步骤的结果是等待。' },
        { policy: P.gate, short: { en: 'nothing needs you', zh: '没有需要你的事' } });
    }
  }

  updateZone(now) {
    const { x, z } = this.player;
    let best = null, bd = Infinity;
    for (const k of this.places) {
      const d = Math.hypot(k.place.x - x, k.place.z - z);
      if (d < k.r && d < bd) { best = k; bd = d; }
    }
    if (best && best !== this.zone) {
      this.zone = best;
      if (this.glassesOn) this.hud.zone(best.name, this.L(best.short), now);
    } else if (!best) this.zone = null;
  }

  updateBlur() {
    const cam = this.camera, hudRoot = this.hud.root;
    const w = hudRoot.clientWidth, h = hudRoot.clientHeight;
    const near = [];
    // Inside a room, its people (in the room's frame, on its floor); outside, the campus crowd.
    const people = this.inside ? this.room?.people || [] : this.world.crowd.people;
    const nav = this.inside ? this.room.nav : this.nav;
    const base = this.inside ? this.room.floorY : 0;
    for (const p of people) {
      if (p.hidden || p.registered) continue;
      const d2 = (p.x - cam.position.x) ** 2 + (p.z - cam.position.z) ** 2;
      if (d2 < 64) near.push([d2, p]);
    }
    near.sort((a, b) => a[0] - b[0]);
    let used = 0;
    for (const [, p] of near) {
      if (used >= 10) break;
      const hy = base + (p.y || 0) + 1.71 * p.scale - (p.state === 'sit' ? 0.42 : 0);
      this.tmp.set(p.x, hy, p.z).project(cam);
      if (this.tmp.z > 1 || this.tmp.z < -1 || Math.abs(this.tmp.x) > 1.1 || Math.abs(this.tmp.y) > 1.1) continue;
      if (!nav.clear(cam.position.x, cam.position.z, p.x, p.z)) continue;
      const dist = Math.hypot(p.x - cam.position.x, hy - cam.position.y, p.z - cam.position.z);
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
      box.style.transform = `translate(${(this.tmp.x + 1) / 2 * w - size / 2}px, ${(1 - this.tmp.y) / 2 * h - size / 2}px)`;
      used++;
    }
    for (let i = used; i < this.blurPool.length; i++) this.blurPool[i].style.display = 'none';
    this.blurCount = used;
  }

  refreshModules() {
    const L = this.L;
    const S = [], M = [], A = [];
    if (!this.glassesOn) {
      S.push(L({ en: 'camera and mic off', zh: '摄像头和麦克风关闭' }));
      S.push(L({ en: 'phone: clock, shuttle times', zh: '手机：时钟、班车时间' }));
    } else {
      S.push(this.inside ? (this.room === this.world.lab ? L({ en: 'S-Lab, ABN level 2', zh: 'S-Lab，ABN 二层' }) : `${this.room.name} · ${L(this.room.label)}`) : this.gazeName ? L({ en: `seeing ${this.gazeName}`, zh: `看到 ${this.gazeName}` }) : this.zone ? L(this.zone.short) : L({ en: 'campus paths', zh: '校园小路' }));
      S.push(L({ en: `${this.blurCount} face${this.blurCount === 1 ? '' : 's'} blurred`, zh: `${this.blurCount} 张脸已模糊` }));
      if (this.day?.watching) S.push({ text: L(this.day.watching), tone: 'watch' });
    }
    for (const task of this.mem.pending.slice(0, 2)) M.push({ text: L({ en: `open: ${L(task.label)}`, zh: `待办：${L(task.label)}` }), tone: 'pending' });
    M.push(L({ en: `places seen today: ${this.mem.seen.size}`, zh: `今天认出的地点：${this.mem.seen.size}` }));
    if (this.mem.theta === 2) M.push({ text: L({ en: 'rule θ₂: leave prompt from your walk time', zh: '规则 θ₂：按步行时间提醒出门' }), tone: 'revised' });
    else if (this.mem.revision === 'ready') M.push({ text: L({ en: 'θ₂ validated, waits for a boundary', zh: 'θ₂ 已验证，等待边界生效' }), tone: 'revised' });
    const d = this.decision;
    A.push({ text: `${this.t('k_' + d.kind)} · ${L(d.text)}`, tone: d.kind });
    if (!this.glassesOn) A.push(L({ en: 'effector: phone', zh: '执行方式：手机' }));
    else if (this.day?.acting) A.push({ text: L(this.day.acting), tone: 'plain' });
    this.hud.setModules({ S: S.slice(0, 3), M: M.slice(0, 3), A: A.slice(0, 2) });
  }

  // ------------------------------------------------------------ sheets
  openContract() {
    const L = this.L;
    const items = [
      { en: 'On duty on weekdays, 08:00–22:00; quiet at night, in lectures and in libraries.', zh: '工作日 08:00–22:00 工作；夜间、上课时和图书馆里保持安静。' },
      { en: 'The camera pauses inside residential halls, past the lobby.', zh: '进入学生宿舍、过了大堂，摄像头就暂停。' },
      { en: 'May speak when you are not in a conversation, about your deadlines, open tasks, shuttles and weather.', zh: '你不在对话中时才开口，只说截止时间、待办、班车和天气。' },
      { en: 'Faces are blurred before processing; only contacts you registered are recognised.', zh: '人脸在处理前先模糊；只认出你登记过的联系人。' },
      { en: 'Sends, bookings and submissions need your say-so each time; permissions expire.', zh: '发送、预约和提交每次都需要你同意；授权会过期。' },
      { en: 'Keeps your tasks, places and routines across days; delete anything at any time.', zh: '跨天保留你的待办、地点和习惯；随时可以删除。' },
    ];
    this.hud.openSheet(`
      <p class="sheet-kicker">${L({ en: 'Operational continuity', zh: '运行连续' })}</p>
      <h2 class="sheet-title">${L({ en: 'Service contract', zh: '服务约定' })}</h2>
      <p class="sheet-lede">${L({ en: 'The glasses may act between your requests, but only on the schedule and terms you declared.', zh: '眼镜可以在你的请求之间行动，但只在你声明过的时间和条件下。' })}</p>
      <ul class="about-list">${items.map(i => `<li>${escapeHtml(L(i))}</li>`).join('')}</ul>`);
  }

  openTrail() {
    const L = this.L;
    const rows = this.mem.log.filter(e => e.kind !== 'note').slice(-18).map(e => `<li><span class="tr-i">${escapeHtml(e.time)}</span><span class="tr-n">${escapeHtml(this.t('k_' + e.kind) === 'k_' + e.kind ? '' : this.t('k_' + e.kind))}</span><span class="tr-t">${escapeHtml(e.text)}</span><span class="tr-m"></span></li>`).join('')
      || `<li class="tr-empty">${L({ en: 'Nothing yet. Walk around, look at buildings, or start the S-Lab day.', zh: '还没有记录。四处走走、看看建筑，或者开始 S-Lab 的一天。' })}</li>`;
    this.hud.openSheet(`
      <p class="sheet-kicker">${L({ en: 'Memory · today', zh: 'Memory · 今天' })}</p>
      <h2 class="sheet-title">${L({ en: 'My day', zh: '我的一天' })}</h2>
      <ol class="trail trail--day">${rows}</ol>
      <p class="sheet-foot">${L({ en: 'The student, their lab mates and all events are fictional.', zh: '这位学生、实验室同学和所有事件都是虚构的。' })}</p>`, { wide: true });
  }

  openAbout() {
    const L = this.L;
    this.hud.openSheet(`
      <p class="sheet-kicker">${L({ en: 'About this demo', zh: '关于这个演示' })}</p>
      <h2 class="sheet-title">${L({ en: 'NTU, from open data', zh: '用开放数据搭的 NTU' })}</h2>
      <ul class="about-list">
        <li>${L({ en: 'Buildings, roads, paths, covered walkways, land use and names: © OpenStreetMap contributors (ODbL). Heights follow OSM levels where mapped and are estimated elsewhere.', zh: '建筑、道路、小路、有顶连廊、用地和地名：© OpenStreetMap 贡献者（ODbL）。有楼层数据的按 OSM，其余是估算。' })}</li>
        <li>${L({ en: 'Terrain: Copernicus GLO-30 elevation (about 30 m resolution). Façades and landmarks are simplified, not surveyed architecture.', zh: '地形：Copernicus GLO-30 高程（约 30 米分辨率）。立面和地标是简化模型，不是测绘建筑。' })}</li>
        <li>${L({ en: 'S-Lab for Advanced Intelligence is in Academic Block North, room ABN-02b-11, per NTU’s contact page. The lab interior is illustrative: its layout, furniture and people are invented; only the windows face the real south side of ABN.', zh: '根据 NTU 联系页，S-Lab for Advanced Intelligence 位于 Academic Block North 的 ABN-02b-11。实验室室内是示意：布局、家具和人物都是虚构的，只有窗户朝向 ABN 真实的南侧。' })}</li>
        <li>${L({ en: 'Other buildings can be entered too (walk up to a wall and press E). Their rooms are illustrative, chosen by the kind of building or the place mapped near the door: library, food court, hall of residence, residential block, sports hall, lecture theatre or lobby. Only the names and the number of levels come from the map.', zh: '其他建筑也可以进（走到墙边按 E）。室内是示意，按建筑类型或门口附近标注的地点生成：图书馆、食堂、学生宿舍、住宅楼、体育馆、讲堂或大堂。只有名称和楼层数来自地图。' })}</li>
        <li>${L({ en: 'The shuttle follows the Campus Loop Red stop order from NTU’s shuttle page. The student, lab mates and events are fictional; nothing runs a model or a camera.', zh: '班车按 NTU 班车页公布的 Campus Loop Red 站序行驶。学生、实验室同学和事件都是虚构的；没有运行模型或摄像头。' })}</li>
      </ul>`);
  }
}

installTour(NtuStory.prototype, {
  async run() {
    const { runDay } = await import('./day.mjs');
    await runDay(this);
  },
  finish() {
    this.day = null;
    this.seated = false;
    this.setSky('day');
    if (!this.glassesOn) this.setGlasses(true);
  },
});
