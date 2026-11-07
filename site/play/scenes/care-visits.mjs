// Episode 08, "A week of visits": a care home with a staff office, a corridor and a lounge. The
// service robot plans its lounge visit from logged outcomes, checks the lounge (A→S), stops for a
// resident with a walker, logs the visit (A→M), and next week moves the plan, not the rules.
import * as THREE from 'three';
import { mat, C, box, room, partition, windowPane, rug, plant, frameArt, table, chair, roundTable, armchair, walker, wallBoard, mug, ring, beam } from '../kit.mjs';
import { person, serviceRobot, POSES } from '../rig.mjs';
import { scriptRunner, makeSpots } from './common.mjs';

const P = { office: [-3.7, -1.3], officeDoor: [-2.6, -0.2], corridor: [-1.1, -0.2], stopAt: [-1.45, -0.2], loungeDoor: [0.95, -0.2], lounge: [2.2, -0.6] };
export const overview = { target: [0, 0.6, -0.5], radius: 17, theta: 0.5, phi: 0.98 };
const CAM = [
  { target: [-3.4, 0.9, -1.5], radius: 7.5, theta: 0.5, phi: 1.0 },
  { target: [-3.4, 0.9, -1.5], radius: 7.5, theta: 0.5, phi: 1.0 },
  { target: [-0.6, 0.8, -0.8], radius: 11, theta: 0.5, phi: 0.98 },
  { target: [-1.0, 0.8, -0.4], radius: 7.5, theta: 0.5, phi: 1.0 },
  { target: [2.6, 0.9, -1.2], radius: 8, theta: 0.45, phi: 1.0 },
  { target: [-3.0, 0.9, -1.3], radius: 8, theta: 0.5, phi: 1.0 }
];
const SEATS = [[2.3, -2.3, 0.2], [3.5, -2.3, -0.2], [4.5, -1.2, -1.2], [4.4, 0.4, -1.9], [2.9, 1.2, Math.PI], [1.9, 0.9, 2.5]];

export function build(view) {
  view.setTime('day');
  const R = view.root;
  R.add(room({ w: 11, d: 7, h: 2.7, wall: '#efe8dc', floorColor: '#b88a5e' }).group);
  for (const x of [-2.2, 0.6]) R.add(partition(x, -3.5, x, -0.75), partition(x, 0.35, x, 3.5));
  // staff office
  R.add(table({ x: -4.1, z: -2.6, w: 1.6, d: 0.7, h: 0.75, top: C.oak, legs: C.walnut }));
  R.add(chair({ x: -4.1, z: -1.95, rot: Math.PI, office: true }));
  R.add(box(0.5, 0.012, 0.35, mat('#2d3238'), { x: -4.3, y: 0.75, z: -2.6, r: 0 }));
  R.add(plant({ x: -5.0, z: 2.9, scale: 1.1 }));
  R.add(windowPane(view, { x: -5.42, z: -0.8, y: 0.85, w: 1.6, h: 1.3, axis: 'x' }));
  const charger = box(0.5, 0.04, 0.5, mat('#3a3f45', { rough: 0.5 }), { x: P.office[0], z: P.office[1], r: 0.02 });
  R.add(charger);
  // corridor
  R.add(rug(1.4, 6.6, { x: -0.8, z: 0, colors: ['#5f7357', '#e6d6bd', '#c99a4a', '#a8553f'] }));
  const board = wallBoard({ x: -0.8, y: 2.05, z: -3.42, w: 1.3, h: 0.85 });
  R.add(board);
  // lounge
  R.add(rug(4.2, 3.4, { x: 3.2, z: -0.6, colors: ['#3f5469', '#e6d6bd', '#c99a4a', '#5f7357'] }));
  const tea = roundTable({ x: 3.25, z: -0.6, r: 0.5, h: 0.5, top: C.oak });
  R.add(tea);
  R.add(mug({ x: 3.1, y: 0.5, z: -0.5, color: '#e8e2d6' }), mug({ x: 3.4, y: 0.5, z: -0.75, color: '#7d9bb5' }));
  SEATS.forEach(([x, z, r]) => R.add(armchair({ x, z, rot: r, color: ['#7b8f86', '#c9a77b', '#8d9bb0'][Math.abs(Math.round(x * 3)) % 3] })));
  R.add(windowPane(view, { x: 3.2, z: -3.42, y: 0.75, w: 2.8, h: 1.5 }));
  R.add(plant({ x: 5.0, z: -3.0, scale: 1.4 }), plant({ x: 1.1, z: -3.0, scale: 1.1, pot: C.potCream }), plant({ x: 5.0, z: 3.0, scale: 1.0 }));

  const robot = serviceRobot(view);
  R.add(robot.root);
  const residents = SEATS.map(([x, z, r], k) => {
    const p = person(view, { shirt: ['#8d6e8f', '#5f7357', '#c98a6a', '#3f5469', '#b8a07e', '#7a5c4f'][k], pants: '#4a4f56', skin: ['#f1c9a5', '#c68b62', '#e0ac85', '#8d5a3b', '#f5d6bc', '#d9a07a'][k], hair: ['#d9d6d0', '#bfbcb5', '#e8e6e0', '#9a9790', '#d0cdc6', '#c9c7c2'][k], hairStyle: ['bun', 'short', 'bob', 'crop', 'short', 'bun'][k] });
    p.place(x + Math.sin(r) * 0.05, z + Math.cos(r) * 0.05, r);
    p.setPose('sit', 0);
    R.add(p.root);
    return p;
  });
  const walkerPerson = person(view, { shirt: '#6b7078', pants: '#3a3f45', skin: '#e0ac85', hair: '#e8e6e0', hairStyle: 'crop', scale: 0.96 });
  const frame = walker();
  frame.position.set(0, 0, 0.42);
  walkerPerson.root.add(frame);
  R.add(walkerPerson.root);
  const look = beam('#bfe3c8');
  R.add(look);
  const chip = view.label(robot.pan, { className: 'pv-chip', offset: [0, 0.42, 0] });
  const says = view.label(robot.pan, { className: 'pv-bubble pv-bubble--robot', offset: [0.5, 0.3, 0.4] });
  const alert = view.label(walkerPerson.head, { className: 'pv-alert', offset: [0, 0.35, 0] });
  const spots = makeSpots(view, [
    { id: 'robot', obj: robot.root, at: [0, 0.7, 0], name: 'Service robot' },
    { id: 'board', obj: board, at: [0, 0, 0.1], name: 'Activity calendar' },
    { id: 'lounge', obj: tea, at: [0, 0.8, 0], name: 'Lounge' },
    { id: 'walker', obj: walkerPerson.root, at: [0, 1.1, 0], name: 'Resident with a walker' }
  ]);
  const run = scriptRunner(view);

  function paintBoard(stale) {
    board.userData.paint((c, w, h) => {
      c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#3f5469'; c.font = '600 26px "IBM Plex Sans", sans-serif'; c.fillText('This week', 18, 36);
      const rows = [['10:00', 'Coffee in the lounge'], ['14:00', 'Garden walk'], ['15:00', stale ? 'Music hour' : 'Free time']];
      rows.forEach(([t, a], k) => { c.fillStyle = stale && k === 2 ? '#c4522f' : '#2b2f36'; c.font = '600 22px "IBM Plex Mono", monospace'; c.fillText(t, 18, 92 + k * 52); c.font = '400 22px "IBM Plex Sans", sans-serif'; c.fillText(a, 110, 92 + k * 52); });
    });
  }
  function lounge(n) { residents.forEach((p, k) => { p.root.visible = k < n; }); }
  function snapBase(ctl) {
    robot.place(...P.office, Math.PI / 2); robot.setLed('ok'); robot.look(0, 0);
    robot.setScreen(['Hello']);
    walkerPerson.root.visible = false; walkerPerson.place(-0.75, -3.0, 0);
    lounge(3);
    look.visible = false;
    chip.set(''); says.set(''); alert.set('');
    paintBoard(ctl === 'stale');
  }
  function snapEnd(i, ctl) {
    snapBase(ctl);
    if (i < 0) return;
    if (i === 0) chip.set('Last week: 10:00 · 1 chat / 15:00 · 6 chats', 'is-mem');
    if (i >= 1) { robot.setScreen(['Plan', 'Lounge 15:00']); }
    if (i === 1) chip.set('Plan: lounge 15:00', 'is-ok');
    if (i >= 2) { robot.place(...P.officeDoor, Math.PI / 2); }
    if (i === 2) chip.set('Checking the lounge', 'is-check');
    if (i >= 3) { robot.place(...P.stopAt, Math.PI / 2); }
    if (i === 3) { walkerPerson.root.visible = true; walkerPerson.place(-0.75, 1.6, 0); says.set('Please go ahead.'); }
    if (i >= 4) {
      robot.place(...P.lounge, Math.PI * 0.75);
      lounge(ctl === 'stale' ? 2 : 6);
      chip.set(ctl === 'cut-AM' ? 'Visit not logged' : ctl === 'stale' ? 'V5 logged: 2 chats (no music hour)' : 'V5 logged: 7 chats, 2 declined', ctl === 'cut-AM' ? 'is-stop' : 'is-mem');
    }
    if (i >= 5) {
      robot.place(...P.office, Math.PI / 2);
      lounge(3);
      robot.setScreen(['Plan', ctl === 'stale' ? 'Lounge 10:30' : 'Lounge 15:00']);
      chip.set(ctl === 'cut-AM' ? 'Plan rests on old data' : 'State z updated · rule θ unchanged', ctl === 'cut-AM' ? 'is-stop' : 'is-mem');
    }
  }

  async function enter(i, ctl, { instant = false } = {}) {
    view.setRig(CAM[i] || overview);
    return run(async step => {
      snapEnd(i - 1, ctl);
      chip.set(''); says.set(''); alert.set(''); look.visible = false;
      if (instant) { snapEnd(i, ctl); return; }
      if (i === 0) {
        robot.setScreen(['Monday']);
        await step(view.wait(500));
        chip.set('Last week: 10:00 · 1 chat / 15:00 · 6 chats', 'is-mem');
      } else if (i === 1) {
        robot.setScreen(['Planning', 'today']);
        chip.set(ctl === 'stale' ? 'Logs say 15:00 · the calendar lists a music hour at 15:00' : 'No request: the scheduler runs', 'is-check');
        await step(robot.look(0.3, 300));
        await step(robot.look(0, 300));
      } else if (i === 2) {
        await step(robot.drive([P.officeDoor], { speed: 0.6, face: Math.PI / 2 }));
        look.visible = true; look.userData.aim(robot.eye, new THREE.Vector3(3.0, 0.8, -0.8), 1.4);
        chip.set('Checking the lounge (A→S)', 'is-check');
        await step(view.wait(1100));
        look.visible = false;
      } else if (i === 3) {
        walkerPerson.root.visible = true; walkerPerson.place(-0.75, -3.0, 0);
        const go = robot.drive([P.stopAt], { speed: 0.55, face: Math.PI / 2 });
        await step(walkerPerson.walkTo([[-0.75, -1.1]], { speed: 0.35 }));
        await step(go);
        chip.set('A resident is crossing ahead', 'is-wait');
      } else if (i === 4) {
        lounge(ctl === 'stale' ? 2 : 6);
        await step(robot.drive([P.corridor, P.loungeDoor, P.lounge], { speed: 0.7, face: Math.PI * 0.75 }));
        says.set('Would you like to chat?');
        robot.setScreen(['Hello!']);
        await step(view.wait(1000));
        chip.set(ctl === 'cut-AM' ? 'Visit not logged' : ctl === 'stale' ? 'V5 logged: 2 chats (no music hour)' : 'V5 logged: 7 chats, 2 declined', ctl === 'cut-AM' ? 'is-stop' : 'is-mem');
      } else if (i === 5) {
        says.set('');
        await step(robot.drive([P.loungeDoor, P.corridor, P.officeDoor, P.office], { speed: 0.9, face: Math.PI / 2 }));
        lounge(3);
        robot.setScreen(['Plan', ctl === 'stale' ? 'Lounge 10:30' : 'Lounge 15:00']);
        chip.set(ctl === 'cut-AM' ? 'Plan rests on old data' : 'State z updated · rule θ unchanged', ctl === 'cut-AM' ? 'is-stop' : 'is-mem');
      }
    });
  }

  async function act(i, option, ctl, { policy = false } = {}) {
    return run(async step => {
      alert.set('');
      if (option === '15:00') {
        robot.setScreen(['Plan', 'Lounge 15:00']);
        chip.set(policy ? 'The robot plans 15:00' : 'Plan: lounge 15:00', 'is-ok');
        lounge(ctl === 'stale' ? 2 : 6);
        await step(view.wait(1100));
        lounge(3);
      } else if (option === '10:00') {
        robot.setScreen(['Plan', 'Lounge 10:00']);
        lounge(1);
        chip.set('At 10:00 the lounge is nearly empty', 'is-wait');
        await step(view.wait(1300));
        lounge(3);
      } else if (option === 'stop') {
        robot.setLed('wait');
        says.set('Please go ahead.');
        await step(walkerPerson.walkTo([[-0.75, 1.6]], { speed: 0.4 }));
        robot.setLed('ok');
      } else if (option === 'go around') {
        await step(robot.drive([[-0.95, 0.25]], { speed: 0.5 }));
        alert.set('Too close to a slow walker', 'is-in');
        await step(view.wait(1200));
        alert.set('');
        await step(robot.drive([P.stopAt], { speed: 0.5, face: Math.PI / 2 }));
      }
    });
  }

  function inspect(id, i, ctl) {
    const facts = {
      robot: ['Action', 'Service robot', 'Plans its own visits without a request, checks a room before going, and logs each visit as counts, not conversations.'],
      board: ['Sensing', 'Activity calendar', ctl === 'stale' ? 'Still lists last month’s music hour at 15:00. The robot cannot tell it is out of date.' : 'The facility’s weekly calendar, one of the inputs to the plan.'],
      lounge: ['Place', 'Lounge', 'Where residents gather. Who is there changes across the day and the week.'],
      walker: ['Person', 'Resident with a walker', 'Moves slowly in a narrow corridor. Safety comes before the schedule.']
    };
    const [tag, title, text] = facts[id] || [];
    return title ? { tag, title, text } : null;
  }
  const visibleSpots = i => (i <= 1 ? ['robot', 'board'] : i === 3 ? ['robot', 'walker'] : ['robot', 'lounge']);

  snapBase('');
  view.setHome(overview);
  return { overview, enter, act, inspect, spots, visibleSpots, snapEnd };
}
