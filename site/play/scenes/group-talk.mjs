// Episode 03, "A private cue in a group talk": a meeting room. Earbuds listen with permission,
// keep only the user's own action item, hold a cue while someone speaks, withdraw private content
// when a visitor joins, and give the cue privately at a pause.
import * as THREE from 'three';
import { mat, C, box, room, windowPane, plant, frameArt, table, chair, laptop, mug, door, wallBoard } from '../kit.mjs';
import { person, POSES } from '../rig.mjs';
import { scriptRunner, makeSpots, earCue } from './common.mjs';

const TABLE = { x: 0.3, z: -0.95, w: 3.4, d: 1.4, h: 0.75 };
export const overview = { target: [0.3, 0.7, -0.9], radius: 12.5, theta: 0.5, phi: 0.98 };
const CAM = [
  { target: [0.1, 1.0, -1.1], radius: 7.5, theta: 0.5, phi: 1.0 },
  { target: [-0.6, 1.0, -1.0], radius: 6.5, theta: 0.6, phi: 1.0 },
  { target: [-0.4, 1.0, -1.1], radius: 6.5, theta: 0.5, phi: 1.0 },
  { target: [1.4, 1.0, -1.3], radius: 8.5, theta: 0.45, phi: 1.0 },
  { target: [0.2, 1.0, -1.0], radius: 7.5, theta: 0.5, phi: 0.98 },
  { target: [0.8, 0.9, -1.2], radius: 10, theta: 0.5, phi: 1.0 }
];
const SEATS = {
  user: [-1.65, -0.95, Math.PI / 2], alex: [-0.55, -1.95, 0], chen: [0.95, -1.95, 0], ben: [2.2, -0.95, -Math.PI / 2], visitor: [0.3, 0.05, Math.PI]
};
const DOOR = [3.3, -2.95];

export function build(view) {
  view.setTime('day');
  const R = view.root;
  R.add(room({ w: 9, d: 6.5, h: 2.7, wall: '#e7e4dd', floorColor: '#9c7b5a' }).group);
  R.add(table({ x: TABLE.x, z: TABLE.z, w: TABLE.w, d: TABLE.d, h: TABLE.h, top: C.walnut, legs: '#3a2c22' }));
  for (const [x, z, yaw] of Object.values(SEATS)) R.add(chair({ x: x - Math.sin(yaw) * 0.12, z: z - Math.cos(yaw) * 0.12, rot: yaw, office: true }));
  const laptops = [[-1.2, -0.95, Math.PI / 2], [-0.55, -1.5, 0], [0.95, -1.5, 0], [1.75, -0.95, -Math.PI / 2]].map(([x, z, r]) => { const l = laptop({ x, z, y: TABLE.h, rot: r, color: '#8d939b' }); R.add(l.group); return l; });
  laptops.forEach(l => l.draw((c, w, h) => { c.fillStyle = '#26324a'; c.fillRect(0, 0, w, h); c.fillStyle = '#e9edf3'; c.fillRect(20, 30, w - 40, h - 60); }));
  R.add(mug({ x: -0.1, y: TABLE.h, z: -0.7, color: '#e8e2d6' }), mug({ x: 1.4, y: TABLE.h, z: -1.2, color: '#3f5469' }));
  R.add(windowPane(view, { x: -4.42, z: -1.0, y: 0.7, w: 2.8, h: 1.6, axis: 'x' }));
  const board = wallBoard({ x: -0.5, y: 2.15, z: -3.2, w: 1.8, h: 1.0, paint: (c, w, h) => { c.fillStyle = '#f7f6f2'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3f5469'; c.lineWidth = 4; c.beginPath(); c.moveTo(30, h - 50); c.lineTo(110, 140); c.lineTo(190, 170); c.lineTo(260, 80); c.lineTo(340, 110); c.stroke(); c.fillStyle = '#c46a52'; c.fillRect(30, 30, 120, 14); c.fillStyle = '#9aa3ad'; c.fillRect(30, 56, 180, 10); } });
  R.add(board);
  const theDoor = door({ x: DOOR[0], z: -3.22, color: '#8a6a4a' });
  R.add(theDoor);
  R.add(box(1.6, 0.75, 0.45, mat(C.oak, { rough: 0.6 }), { x: -2.9, z: -2.95, r: 0.02 }));
  R.add(plant({ x: -3.9, z: -2.85, scale: 1.3 }), plant({ x: 4.0, z: 2.6, scale: 1.0, pot: C.potCream }), plant({ x: -2.9, y: 0.75, z: -2.95, scale: 0.5 }));
  R.add(frameArt(0.9, 0.6, { x: 1.9, y: 1.85, z: -3.2, colors: ['#5f7357', '#e9c58a', '#f3e9d8'] }));

  const user = person(view, { shirt: '#e8dfcf', pants: '#3a3f45', skin: '#f1c9a5', hair: '#3b2a20', hairStyle: 'ponytail', earbuds: '#aeb4bb' });
  const alex = person(view, { shirt: '#5f6b46', pants: '#2b3340', skin: '#e0ac85', hair: '#2c211a', hairStyle: 'short', beard: true });
  const chen = person(view, { shirt: '#26324a', pants: '#2b3340', skin: '#f5d6bc', hair: '#141414', hairStyle: 'bob' });
  const ben = person(view, { shirt: '#3a3d42', pants: '#4a4f56', skin: '#8d5a3b', hair: '#1a1512', hairStyle: 'crop', glasses: '#1f2328', buttons: true });
  const visitor = person(view, { shirt: '#b8a07e', pants: '#3a3f45', skin: '#c68b62', hair: '#4a3526', hairStyle: 'short' });
  const people = { user, alex, chen, ben, visitor };
  for (const [k, p] of Object.entries(people)) { R.add(p.root); p.place(...SEATS[k]); p.setPose('sit', 0); }

  const cue = earCue(view, user, [0.55, 0.42, 0.3]);
  const chip = view.label(user.head, { className: 'pv-chip', offset: [0.6, 0.78, 0.2] });
  const alert = view.label(visitor.head, { className: 'pv-alert', offset: [0, 0.42, 0] });
  const names = ['alex', 'chen', 'ben', 'visitor'].map(k => ({ k, label: view.label(people[k].head, { className: 'pv-tag', offset: [0, 0.3, 0] }) }));
  const spots = makeSpots(view, [
    { id: 'earbuds', obj: user.head, at: [0.11, 0, 0], name: 'Earbuds' },
    { id: 'user', obj: user.root, at: [0, 1.0, 0], name: 'The user' },
    { id: 'alex', obj: alex.root, at: [0, 1.0, 0], name: 'Speaker' },
    { id: 'visitor', obj: visitor.root, at: [0, 1.0, 0], name: 'Visitor' }
  ]);

  // sound rings: expanding circles at head height
  const rings = [];
  function soundRing(from, { color = '#f4f2ec', radius = 1.2, ms = 1100 } = {}) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.userData.noGlow = true;
    const p = new THREE.Vector3(); from.getWorldPosition(p);
    m.position.set(p.x, p.y - 0.05, p.z);
    R.add(m); rings.push(m);
    return view.animate(ms, k => { m.scale.setScalar(0.1 + k * radius); m.material.opacity = 0.7 * (1 - k); }, k => k).then(() => { R.remove(m); m.geometry.dispose(); m.material.dispose(); });
  }
  let talker = null;
  view.every((dt, t) => {
    if (!talker) return;
    if (!talker._next || t > talker._next) { talker._next = t + 0.55; soundRing(talker.head, { radius: 0.9, ms: 900 }); }
  });
  function talk(p) { for (const q of Object.values(people)) q.talking = false; talker = p; if (p) p.talking = true; }

  const run = scriptRunner(view);
  function setNames(ctl, withVisitor) {
    const labels = ctl === 'cut-MS' ? { alex: 'Voice 1', chen: 'Voice 2', ben: 'Voice 3', visitor: 'Voice 4' } : { alex: 'Alex', chen: 'Chen', ben: 'Ben', visitor: 'Visitor' };
    names.forEach(n => n.label.set(n.k === 'visitor' && !withVisitor ? '' : labels[n.k]));
  }
  function snapBase(ctl) {
    talk(null);
    theDoor.userData.hinge.rotation.y = 0;
    for (const [k, p] of Object.entries(people)) { p.place(...SEATS[k]); p.setPose('sit', 0); p.root.visible = true; p.lookAt(null); }
    visitor.root.visible = false;
    user.lookAt(alex.head);
    cue.set(''); chip.set(''); alert.set('');
    setNames(ctl, false);
  }
  function snapEnd(i, ctl) {
    snapBase(ctl);
    if (i < 0) return;
    if (i === 1) chip.set('Kept: send Ben the sampling plan', 'is-mem');
    if (i === 2) chip.set('Holding a cue', 'is-wait');
    if (i >= 3) { visitor.root.visible = true; setNames(ctl, true); }
    if (i === 3) chip.set('Audience changed: private notes withdrawn', 'is-check');
    if (i === 4) cue.set('Ask Ben about the missing week', ctl === 'spoken' ? 'shared' : 'private');
    if (i >= 5) {
      for (const p of Object.values(people)) p.root.visible = false;
      user.root.visible = true; user.place(2.6, -2.2, Math.PI * 0.9); user.setPose('stand', 0); user.lookAt(null);
      names.forEach(n => n.label.set(''));
      chip.set('Audio discarded · cue and action item kept', 'is-mem');
    }
  }

  async function enter(i, ctl, { instant = false } = {}) {
    view.setRig(CAM[i] || overview);
    return run(async step => {
      snapEnd(i - 1, ctl);
      chip.set(''); cue.set(''); alert.set('');
      if (instant) { snapEnd(i, ctl); return; }
      if (i === 0) {
        talk(alex);
        await step(alex.setPose('sitTalk', 500));
        chip.set(ctl === 'cut-MS' ? 'Speakers tracked as voices only' : 'Processing speech the user may process', 'is-check');
        await step(view.wait(1500));
      } else if (i === 1) {
        talk(chen);
        await step(chen.setPose('sitTalk', 500));
        user.lookAt(chen.head);
        chip.set('Speech now, and one task for the user', 'is-check');
        await step(view.wait(1200));
      } else if (i === 2) {
        talk(alex);
        user.lookAt(alex.head);
        await step(alex.setPose('sitTalk', 400));
        chip.set('Alex is mid-sentence', 'is-wait');
      } else if (i === 3) {
        talk(null);
        await step(view.animate(600, k => { theDoor.userData.hinge.rotation.y = -k * 1.2; }));
        visitor.root.visible = true; visitor.place(DOOR[0], -2.6, Math.PI); visitor.setPose('stand', 0);
        for (const p of [user, alex, chen, ben]) p.lookAt(visitor.head);
        await step(visitor.walkTo([[2.9, -0.6], [1.6, 0.45], [SEATS.visitor[0], SEATS.visitor[1] + 0.05]], { speed: 1.1, face: SEATS.visitor[2] }));
        await step(visitor.setPose('sit', 500));
        await step(view.animate(500, k => { theDoor.userData.hinge.rotation.y = -1.2 + k * 1.2; }));
        setNames(ctl, true);
        chip.set('Audience changed: private notes withdrawn', 'is-check');
        for (const p of [alex, chen, ben]) p.lookAt(null);
        user.lookAt(ben.head);
      } else if (i === 4) {
        talk(null);
        setNames(ctl, true);
        user.lookAt(ben.head);
        chip.set('A natural pause', 'is-ok');
        await step(view.wait(600));
      } else if (i === 5) {
        talk(null);
        names.forEach(n => n.label.set(''));
        await step(view.animate(500, k => { theDoor.userData.hinge.rotation.y = -k * 1.2; }));
        const exits = [visitor, ben, chen, alex];
        for (const p of exits) { p.setPose('stand', 300); p.walkTo([[p.root.position.x, -2.4], [DOOR[0], -2.7], [DOOR[0], -3.3]], { speed: 1.3 }).then(() => { p.root.visible = false; }); await step(view.wait(350)); }
        await step(user.setPose('stand', 400));
        user.lookAt(null);
        await step(user.walkTo([[-1.2, -0.2], [2.6, -2.2]], { speed: 1.2, face: Math.PI * 0.9 }));
        chip.set('Audio discarded · cue and action item kept', 'is-mem');
      }
    });
  }

  async function act(i, option, ctl, { policy = false } = {}) {
    return run(async step => {
      alert.set('');
      if (option === 'the user\'s action items') {
        chip.set(policy ? 'Memory keeps only the user’s task' : 'Kept: send Ben the sampling plan', 'is-mem');
        await step(view.wait(1000));
      } else if (option === 'the transcript') {
        alert.anchor = alex.head;
        alert.set('Others’ words stored without consent', 'is-in');
        await step(Promise.all([soundRing(alex.head, { color: '#f09582', radius: 2.5 }), soundRing(chen.head, { color: '#f09582', radius: 2.5 })]));
        await step(view.wait(700));
      } else if (option === 'nothing') {
        chip.set('Nothing kept: the task is lost after the meeting', 'is-stop');
        await step(view.wait(1100));
      } else if (option === 'wait for a pause') {
        chip.set(policy ? 'The earbuds hold the cue' : 'Holding a cue', 'is-wait');
        await step(view.wait(900));
      } else if (option === 'cue now') {
        cue.set('Ask Ben about the missing week', 'private');
        await step(user.gesture('flinch', 700));
        alert.anchor = user.head;
        alert.set('Splits attention while Alex speaks', 'is-in');
        await step(view.wait(1100));
        cue.set('');
      } else if (option === 'private cue') {
        cue.set('Ask Ben about the missing week', 'private');
        await step(soundRing(user.head, { color: '#a9bfdf', radius: 0.35, ms: 900 }));
        await step(view.wait(500));
      } else if (option === 'spoken suggestion') {
        cue.set('Ask Ben about the missing week', 'shared');
        for (const p of [alex, chen, ben, visitor]) p.lookAt(user.head);
        await step(soundRing(user.head, { color: '#f09582', radius: 5.5, ms: 1500 }));
        alert.anchor = visitor.head;
        alert.set('The visitor hears the user’s notes', 'is-in');
        await step(view.wait(1100));
        for (const p of [alex, chen, ben, visitor]) p.lookAt(null);
      } else if (option === 'stay silent') {
        cue.set('');
        chip.set(ctl === 'spoken' ? 'Silent: the notes stay private' : 'The pause passes', 'is-wait');
        await step(view.wait(1100));
      }
    });
  }

  function inspect(id, i, ctl) {
    const facts = {
      earbuds: ['Sensing and Action', 'Earbuds', ctl === 'spoken' ? 'In this setup every cue is spoken aloud to the room, so the audience is everyone present.' : 'A microphone that processes the talk the user may process, and a private channel for short cues.'],
      user: ['Person', 'The user', 'Their own action item may be kept. What others say is their information, and the user’s consent does not cover it.'],
      alex: ['Person', ctl === 'cut-MS' ? 'Voice 1' : 'Alex', ctl === 'cut-MS' ? 'With M→S cut, retained notes no longer tell perception who is speaking.' : 'Leads the study. Notes from last week help Sensing tell who is speaking (M→S).'],
      visitor: ['Person', 'Visitor', 'From another team. Not entitled to the user’s notes about the data, so private content is withdrawn.']
    };
    const [tag, title, text] = facts[id] || [];
    return title ? { tag, title, text } : null;
  }
  const visibleSpots = i => (i >= 3 && i <= 4 ? ['earbuds', 'user', 'visitor'] : i === 5 ? ['user'] : ['earbuds', 'user', 'alex']);

  snapBase('');
  view.setHome(overview);
  return { overview, enter, act, inspect, spots, visibleSpots, snapEnd };
}
