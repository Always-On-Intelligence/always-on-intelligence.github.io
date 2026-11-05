// Episode 04, "Morning plan, evening check-in": a home office from morning to evening. The plan is
// kept as pending items; at 18:00 the service checks the calendar (A→S), waits out a call, and checks
// in once the user is free. In the scheduled mode it sends at 18:00 no matter what (L2).
import * as THREE from 'three';
import { mat, C, box, room, windowPane, rug, plant, frameArt, bookshelf, table, chair, laptop, phone, mug, deskLamp, armchair } from '../kit.mjs';
import { person, POSES } from '../rig.mjs';
import { scriptRunner, makeSpots, screenPanel, paintScreen } from './common.mjs';

const DESK = { x: 0.3, z: -2.65, h: 0.75 };
const SEAT = [0.3, -1.9, Math.PI];
export const overview = { target: [0.2, 0.8, -1.2], radius: 11.5, theta: 0.5, phi: 1.0 };
const CAM = [
  { target: [0.4, 1.1, -2.3], radius: 5.6, theta: 0.5, phi: 1.02 },
  { target: [0.6, 1.0, -1.6], radius: 7.5, theta: 0.5, phi: 1.0 },
  { target: [0.4, 1.1, -2.3], radius: 5.6, theta: 0.55, phi: 1.02 },
  { target: [0.4, 1.1, -2.3], radius: 5.6, theta: 0.55, phi: 1.02 },
  { target: [0.4, 1.1, -2.3], radius: 5.2, theta: 0.45, phi: 1.02 },
  { target: [0.4, 1.1, -2.3], radius: 5.6, theta: 0.5, phi: 1.02 }
];
const TIME = ['morning', 'morning', 'dusk', 'dusk', 'evening', 'evening'];

export function build(view) {
  view.setTime('morning');
  const R = view.root;
  R.add(room({ w: 8, d: 6, h: 2.7, wall: '#ebe3d6', floorColor: '#b48256' }).group);
  R.add(windowPane(view, { x: 0.3, z: -2.92, y: 1.0, w: 2.4, h: 1.35 }));
  R.add(table({ x: DESK.x, z: DESK.z, w: 1.7, d: 0.72, h: DESK.h, top: C.walnut, legs: '#3a2c22' }));
  R.add(chair({ x: SEAT[0], z: SEAT[1] - 0.12, rot: Math.PI, office: true }));
  const lap = laptop({ x: 0.3, y: DESK.h, z: -2.62, rot: 0, color: '#c3c7cc', w: 0.4, d: 0.27 });
  R.add(lap.group);
  const ph = phone({ x: 0.85, y: DESK.h, z: -2.55, rot: 0.3 });
  R.add(ph);
  R.add(mug({ x: -0.3, y: DESK.h, z: -2.5, color: '#e8e2d6' }));
  R.add(deskLamp({ x: -0.35, y: DESK.h, z: -2.85, rot: 0.9, view }));
  R.add(bookshelf({ x: -3.75, z: -1.0, w: 1.5, h: 1.9, rot: Math.PI / 2 }));
  R.add(armchair({ x: -2.6, z: 1.3, rot: 0.6, color: '#7b8f86' }));
  R.add(rug(2.8, 2.0, { x: -1.6, z: 0.8, colors: ['#5f7357', '#e6d6bd', '#c99a4a', '#a8553f'] }));
  R.add(plant({ x: 1.95, z: -2.75, scale: 1.2 }), plant({ x: -3.55, z: -2.7, scale: 1.0, pot: C.potCream }), plant({ x: 3.5, z: 1.9, scale: 1.1 }));
  R.add(frameArt(0.7, 0.5, { x: -1.6, y: 1.8, z: -2.98, colors: ['#3f5469', '#e9c58a', '#f3e9d8'] }));

  const user = person(view, { shirt: '#56657c', cardigan: '#46546a', pants: '#2b3340', skin: '#f5d6bc', hair: '#1a1512', hairStyle: 'bob', earbuds: '#f2f2f0' });
  R.add(user.root);
  const screen = screenPanel(view, lap.group, [0.75, 0.75, 0.45]);
  const chip = view.label(user.head, { className: 'pv-chip', offset: [-0.55, 0.3, 0.2] });
  const alert = view.label(ph, { className: 'pv-alert', offset: [0, 0.3, 0] });
  const says = view.label(user.head, { className: 'pv-bubble', offset: [-0.5, 0.3, 0.2] });
  const spots = makeSpots(view, [
    { id: 'laptop', obj: lap.group, at: [0, 0.3, -0.1], name: 'Chat and calendar' },
    { id: 'phone', obj: ph, at: [0, 0.06, 0], name: 'Phone' },
    { id: 'user', obj: user.root, at: [0, 1.0, 0], name: 'The user' }
  ]);
  const run = scriptRunner(view);
  const CALL = { ...POSES.sitCall };

  function buzz() {
    ph.userData.screen.emissiveIntensity = 1.2;
    const x0 = ph.position.x;
    return view.animate(700, k => { ph.position.x = x0 + Math.sin(k * 60) * 0.006 * (1 - k); }, k => k).then(() => { ph.position.x = x0; });
  }
  function onCall(on) { user.buds.forEach(b => { b.visible = on; }); user.talking = on; }
  function showScreen(scene) { screen.set(scene); paintScreen(lap, scene); }

  function snapBase() {
    view.setTime('morning');
    user.place(...SEAT); user.setPose('sitType', 0); user.lookAt(null);
    onCall(false);
    ph.userData.screen.emissiveIntensity = 0;
    chip.set(''); alert.set(''); says.set('');
  }
  function snapEnd(i, ctl, beat) {
    snapBase();
    if (i < 0) { showScreen(null); return; }
    view.setTime(TIME[i]);
    if (beat?.scene) showScreen(beat.scene);
    if (i === 1) { user.place(2.6, 0.6, 0.4); user.setPose('stand', 0); chip.set('Plan kept as pending items', 'is-mem'); }
    if (i === 2 || i === 3) { onCall(true); user.setPose(CALL, 0); }
    if (i === 2) chip.set(ctl === 'scheduled' ? 'Sent at 18:00' : 'Calendar: on a call', ctl === 'scheduled' ? 'is-stop' : 'is-check');
    if (i === 3) chip.set(ctl === 'scheduled' ? 'Arrived during the call' : 'Waiting for the call to end', ctl === 'scheduled' ? 'is-stop' : 'is-wait');
    if (i >= 4) { user.setPose('sitType', 0); }
    if (i === 4) chip.set(ctl === 'scheduled' ? 'Reply: busy' : 'Check-in sent 18:35', ctl === 'scheduled' ? 'is-wait' : 'is-ok');
    if (i === 5) chip.set(ctl === 'scheduled' ? 'Nothing to update from “busy”' : 'Plan updated in z · θ unchanged', ctl === 'scheduled' ? 'is-wait' : 'is-mem');
  }

  let beats = [];
  async function enter(i, ctl, { instant = false, beat } = {}) {
    beats[i] = beat;
    view.setRig(CAM[i] || overview);
    return run(async step => {
      snapEnd(i - 1, ctl, beats[i - 1]);
      chip.set(''); alert.set(''); says.set('');
      if (instant) { snapEnd(i, ctl, beat); return; }
      if (i === 0) {
        showScreen(beat?.scene);
        await step(user.setPose('sitType', 400));
        await step(view.wait(1200));
        chip.set('Plan stored as pending items', 'is-mem');
      } else if (i === 1) {
        showScreen(beat?.scene);
        await step(user.setPose('stand', 600));
        await step(user.walkTo([[1.4, -1.6], [2.6, 0.6]], { speed: 1.1, face: 0.4 }));
        chip.set('Plan kept as pending items', 'is-mem');
      } else if (i === 2) {
        user.place(...SEAT); onCall(true);
        await step(view.setTime('dusk', 1200));
        await step(user.setPose(CALL, 600));
        showScreen(ctl === 'scheduled' ? { ...beat.scene, panes: [{ app: 'tasks', title: 'Pending', rows: [['open', 'Draft methods'], ['open', 'Review Ben\'s figures']] }] } : { ...beat.scene, panes: [{ app: 'tasks', title: 'Pending', rows: [['open', 'Draft methods'], ['open', 'Review Ben\'s figures']] }] });
        chip.set(ctl === 'scheduled' ? '18:00: the schedule fires' : '18:00: a check-in is due', 'is-wait');
      } else if (i === 3) {
        onCall(true);
        showScreen(beat?.scene);
        chip.set(ctl === 'calendar-offline' ? 'Calendar unavailable' : ctl === 'scheduled' ? 'The schedule decides' : 'Profile: no pings during calls', ctl === 'calendar-offline' ? 'is-stop' : 'is-mem');
        await step(view.wait(600));
      } else if (i === 4) {
        await step(view.setTime('evening', 900));
        onCall(false);
        await step(user.setPose('sitType', 600));
        showScreen(beat?.scene);
        if (beat?.scene?.toast) await step(buzz());
        chip.set(ctl === 'scheduled' ? 'Reply: busy' : 'Check-in sent 18:35', ctl === 'scheduled' ? 'is-wait' : 'is-ok');
      } else if (i === 5) {
        showScreen(beat?.scene);
        chip.set(ctl === 'scheduled' ? 'Nothing to update from “busy”' : 'Plan updated in z · θ unchanged', ctl === 'scheduled' ? 'is-wait' : 'is-mem');
        await step(view.wait(600));
      }
    });
  }

  async function act(i, option, ctl, { policy = false } = {}) {
    const beat = beats[i];
    return run(async step => {
      alert.set('');
      if (option === 'check the calendar first') {
        showScreen(beat?.scene);
        chip.set(policy ? 'The policy reads the calendar first (A→S)' : 'Reading the calendar (A→S)', 'is-check');
        await step(view.wait(1100));
      } else if (option === 'send at 18:00' || option === 'send now') {
        showScreen({ ...(beat?.scene || {}), toast: { title: 'Assistant', text: 'How did the methods draft go?' } });
        await step(buzz());
        await step(user.gesture('flinch', 700));
        alert.set(option === 'send now' && ctl === 'calendar-offline' ? 'Sent on missing evidence' : 'Interrupts the call', 'is-in');
        await step(view.wait(1200));
      } else if (option === 'wait') {
        chip.set(policy ? 'The policy waits for the call to end' : 'Waiting for the call to end', 'is-wait');
        await step(view.wait(1000));
      } else if (option === 'wait and retry') {
        chip.set('Retry in 30 minutes', 'is-wait');
        await step(view.wait(1000));
      }
    });
  }

  function inspect(id, i, ctl) {
    const facts = {
      laptop: ['Sensing and Action', 'Chat and calendar', ctl === 'calendar-offline' && i >= 2 && i <= 3 ? 'The calendar API cannot be reached, so the service has no evidence about whether the user is free.' : 'The morning plan was made here. In the evening the service reads the calendar before it checks in.'],
      phone: ['Action', 'Phone', 'Where a check-in arrives. A ping during a call interrupts it.'],
      user: ['Person', 'The user', 'Planned the day at 09:00. Prefers no pings during calls, a preference kept in the profile.']
    };
    const [tag, title, text] = facts[id] || [];
    return title ? { tag, title, text } : null;
  }
  const visibleSpots = i => (i === 1 ? ['laptop'] : ['laptop', 'phone', 'user']);

  snapBase();
  showScreen(null);
  view.setHome(overview);
  return { overview, enter, act, inspect, spots, visibleSpots, snapEnd };
}
