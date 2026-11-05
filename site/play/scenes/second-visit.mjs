// Episode 02, "The second visit": a running-shoe shop. The glasses start a closer look when the user
// lingers, pick a note that fits the profile, record what they showed (A→M), and stay quiet at the
// revisit because the record says the note was already shown.
import * as THREE from 'three';
import { mat, C, box, room, windowPane, rug, plant, frameArt, wallShelf, shoe, clothesRack, bench, table, ring, beam } from '../kit.mjs';
import { person } from '../rig.mjs';
import { scriptRunner, makeSpots, lensHud } from './common.mjs';

const P = { door: [3.6, 2.6], middle: [1.6, 0.4], shelf: [1.45, -2.25], rack: [-1.6, -1.2] };
const SHOE_X = [1.18, 1.27, -3.02], SHOE_Y = [1.72, 1.27, -3.02];
export const overview = { target: [0.2, 0.7, -0.6], radius: 15, theta: 0.5, phi: 1.0 };
const CAM = [
  { target: [1.8, 0.9, 0.4], radius: 10, theta: 0.55, phi: 1.0 },
  { target: [1.4, 1.25, -2.5], radius: 5.6, theta: 0.38, phi: 1.08 },
  { target: [1.4, 1.3, -2.6], radius: 4.8, theta: 0.3, phi: 1.1 },
  { target: [1.5, 1.25, -2.55], radius: 5.2, theta: 0.42, phi: 1.08 },
  { target: [0.6, 1.0, -1.6], radius: 8.5, theta: 0.45, phi: 1.02 }
];

export function build(view) {
  view.setTime('day');
  const R = view.root;
  R.add(room({ w: 9, d: 6.5, h: 2.75, wall: '#ece5da', floorColor: '#c4935f' }).group);
  // the shoe wall
  R.add(box(4.4, 2.2, 0.08, mat('#d9c3a3', { rough: 0.8 }), { x: 1.5, y: 0.2, z: -3.2, r: 0.01 }));
  for (const y of [0.85, 1.25, 1.65]) R.add(wallShelf({ x: 1.5, y, z: -3.03, w: 4.0, d: 0.3, color: C.walnut }));
  const others = [['#2f3e56', '#e8e2d6'], ['#c46a52', '#f2f0ea'], ['#3d5a4c', '#e8e2d6'], ['#e2c26e', '#ffffff'], ['#7d9bb5', '#f2f0ea'], ['#1f2328', '#c9ccd0'], ['#a0463c', '#ffffff'], ['#d8d4cc', '#7a5c4f']];
  const slots = [[-0.2, 0.85], [0.5, 0.85], [2.6, 0.85], [3.2, 0.85], [-0.2, 1.25], [0.5, 1.25], [2.6, 1.25], [3.2, 1.25], [-0.2, 1.65], [0.5, 1.65], [1.2, 1.65], [1.9, 1.65], [2.6, 1.65], [3.2, 1.65]];
  slots.forEach(([x, y], i) => {
    const [c, sole] = others[i % others.length];
    const s = shoe({ color: c, sole });
    s.position.set(x, y + 0.02, -3.0); s.rotation.y = -0.35;
    R.add(s);
  });
  const shoeX = shoe({ color: '#f3eee4', sole: '#ffffff', accent: '#d8cdb8' });
  shoeX.position.set(...SHOE_X); shoeX.rotation.y = -0.35; shoeX.scale.setScalar(1.15);
  const shoeY = shoe({ color: '#6c7c95', sole: '#f2f0ea', accent: '#4f5d73' });
  shoeY.position.set(...SHOE_Y); shoeY.rotation.y = -0.35; shoeY.scale.setScalar(1.15);
  R.add(shoeX, shoeY);
  // the rest of the shop
  R.add(windowPane(view, { x: -4.42, z: -0.8, y: 0.6, w: 2.6, h: 1.7, axis: 'x' }));
  R.add(bench({ x: -3.75, z: -0.8, w: 1.6, rot: Math.PI / 2 }));
  R.add(clothesRack({ x: -2.1, z: -2.6 }));
  R.add(rug(3.2, 2.2, { x: -0.4, z: 0.9, colors: ['#3f5469', '#e6d6bd', '#c99a4a', '#a8553f'] }));
  const display = table({ x: -0.4, z: 0.9, w: 1.4, d: 0.8, h: 0.62, top: C.birch, legs: C.walnut });
  R.add(display);
  [['#c46a52', -0.8, 0.75], ['#3f5469', -0.3, 1.0], ['#e2c26e', 0.15, 0.8]].forEach(([c, x, z]) => { const s = shoe({ color: c }); s.position.set(x, 0.62, z); s.rotation.y = 0.6; R.add(s); });
  R.add(box(1.4, 1.0, 0.55, mat(C.oak, { rough: 0.6 }), { x: 3.4, z: 1.2, r: 0.03 }));
  R.add(box(1.46, 0.05, 0.6, mat('#ece7de'), { x: 3.4, y: 1.0, z: 1.2, r: 0.01 }));
  R.add(plant({ x: -4.0, z: -2.85, scale: 1.3 }), plant({ x: 4.0, z: -2.85, scale: 1.1, pot: C.potCream }), plant({ x: -4.0, z: 2.6, scale: 0.9 }));
  R.add(frameArt(1.0, 0.6, { x: -1.9, y: 2.2, z: -3.2, colors: ['#6f8fa8', '#f0c08a', '#f3e9d8'] }));

  const runner = person(view, { shirt: '#b4532a', pants: '#2b3340', skin: '#7a4e33', hair: '#1a1512', hairStyle: 'crop', glasses: true, shoes: '#e8e2d6' });
  R.add(runner.root);
  const hud = lensHud(view, runner, [0.34, 0.3, 0.3]);
  const gaze = beam('#bfe3c8');
  R.add(gaze);
  const halo = ring(0.24, '#9fe8c8');
  R.add(halo);
  const chip = view.label(runner.head, { className: 'pv-chip', offset: [0, 0.42, 0] });
  const alert = view.label(runner.head, { className: 'pv-alert', offset: [-0.35, 0.15, 0] });
  const spots = makeSpots(view, [
    { id: 'runner', obj: runner.root, at: [0, 1.05, 0], name: 'The user' },
    { id: 'glasses', obj: runner.head, at: [0, 0.03, 0.12], name: 'Smart glasses' },
    { id: 'shoeX', obj: shoeX, at: [0, 0.14, 0], name: 'Ivory shoe' },
    { id: 'shoeY', obj: shoeY, at: [0, 0.14, 0], name: 'Blue-gray shoe' }
  ]);

  const run = scriptRunner(view);
  const shoeAnchor = new THREE.Object3D();
  shoeX.add(shoeAnchor);
  function lookShelf(on) { runner.lookAt(on ? new THREE.Vector3(SHOE_X[0] + 0.25, SHOE_X[1], SHOE_X[2]) : null); }

  function snapBase() {
    runner.place(...P.door, Math.PI);
    runner.setPose('stand', 0);
    runner.lookAt(null);
    hud.set(null); gaze.visible = false; halo.visible = false;
    chip.set(''); alert.set('');
  }
  function snapEnd(i, ctl) {
    snapBase();
    if (i < 0) return;
    runner.place(...P.middle, Math.PI * 0.85);
    if (i >= 1) { runner.place(...P.shelf, Math.PI); lookShelf(true); }
    if (i === 2) hud.set({ text: 'Heel drop: 8 mm vs 4 mm', tone: 'suggest' });
    if (i >= 3) runner.lookAt(new THREE.Vector3(SHOE_Y[0], SHOE_Y[1], SHOE_Y[2]));
    if (i >= 4) {
      lookShelf(true);
      if (ctl === 'cut-AM') hud.set({ text: 'Heel drop: 8 mm vs 4 mm (again)', tone: 'alert' });
    }
    labelsFor(i, ctl);
  }
  function labelsFor(i, ctl) {
    if (i === 0) chip.set('Kept from yesterday: profile and shown notes', 'is-mem');
    if (i === 1) chip.set(ctl === 'cut-MS' ? 'Perceived: an unfamiliar setting' : 'Long look: a closer observation starts', 'is-check');
    if (i === 3) chip.set(ctl === 'cut-AM' ? 'Shown, but not recorded' : 'Recorded: heel-drop note shown Tue', ctl === 'cut-AM' ? 'is-stop' : 'is-mem');
    if (i === 4) chip.set(ctl === 'cut-AM' ? 'Nothing says the note was shown' : 'Both notes already shown today', ctl === 'cut-AM' ? 'is-stop' : 'is-ok');
  }

  async function enter(i, ctl, { instant = false, beat } = {}) {
    view.setRig(CAM[i] || overview);
    return run(async step => {
      snapEnd(i - 1, ctl);
      chip.set(''); hud.set(null); alert.set('');
      if (instant) { snapEnd(i, ctl); return; }
      if (i === 0) {
        snapBase();
        await step(runner.walkTo([P.middle], { speed: 1.0, face: Math.PI * 0.85 }));
        chip.set('Kept from yesterday: profile and shown notes', 'is-mem');
      } else if (i === 1) {
        await step(runner.walkTo([[1.5, -1.2], P.shelf], { speed: 1.0, face: Math.PI }));
        lookShelf(true);
        await step(view.wait(900));
        gaze.visible = true; gaze.userData.aim(runner.head, shoeAnchor, 0.5);
        halo.visible = true; halo.position.set(SHOE_X[0], SHOE_X[1] - 0.1, SHOE_X[2] + 0.12); halo.rotation.x = 0;
        if (ctl === 'cut-MS') hud.set(beat?.scene?.hud || { text: 'Perceived: unfamiliar setting', tone: 'quiet' });
        chip.set(ctl === 'cut-MS' ? 'Perceived: an unfamiliar setting' : 'Long look: a closer observation starts', 'is-check');
      } else if (i === 2) {
        lookShelf(true);
        gaze.visible = true; gaze.userData.aim(runner.head, shoeAnchor, 0.5);
        await step(runner.gesture('nod', 700));
        chip.set('Profile: runs marathons · skips brand stories', 'is-mem');
      } else if (i === 3) {
        runner.lookAt(new THREE.Vector3(SHOE_Y[0], SHOE_Y[1], SHOE_Y[2]));
        await step(view.wait(700));
        chip.set(ctl === 'cut-AM' ? 'Shown, but not recorded' : 'Recorded: heel-drop note shown Tue', ctl === 'cut-AM' ? 'is-stop' : 'is-mem');
      } else if (i === 4) {
        runner.lookAt(null);
        await step(runner.walkTo([[0.4, -1.6], P.rack], { speed: 1.0, face: Math.PI }));
        chip.set('Ten minutes later', 'is-wait');
        await step(view.wait(1100));
        chip.set('');
        await step(runner.walkTo([[0.4, -1.8], P.shelf], { speed: 1.0, face: Math.PI }));
        lookShelf(true);
        gaze.visible = true; gaze.userData.aim(runner.head, shoeAnchor, 0.5);
        chip.set(ctl === 'cut-AM' ? 'Memory holds only Monday’s note' : 'Memory: both notes shown today', ctl === 'cut-AM' ? 'is-stop' : 'is-mem');
      }
    });
  }

  async function act(i, option, ctl, { policy = false } = {}) {
    return run(async step => {
      alert.set('');
      if (option === 'deeper note') {
        hud.set({ text: 'Heel drop: 8 mm vs 4 mm', tone: 'suggest' });
        await step(runner.gesture('nod', 800));
      } else if (option === 'beginner overview') {
        hud.set({ text: 'Running shoes 101: cushioning, drop and fit', tone: 'suggest' });
        await step(view.wait(500));
        alert.set('Not what an experienced runner needs', 'is-in');
        await step(runner.gesture('shake', 900));
      } else if (option === 'stay silent' && i === 2) {
        hud.set(null);
        alert.set('No help while the user compares', 'is-in');
        await step(view.wait(1100));
      } else if (option === 'repeat a note' || (option === 'new note' && ctl === 'cut-AM')) {
        hud.set({ text: 'Heel drop: 8 mm vs 4 mm (again)', tone: 'alert' });
        await step(view.wait(400));
        if (!policy || ctl !== 'cut-AM') alert.set('Shown a second time', 'is-in');
        await step(runner.gesture('shake', 900));
      } else if (option === 'new note') {
        hud.set({ text: 'Fun fact: the brand’s founders…', tone: 'suggest' });
        await step(view.wait(400));
        alert.set('Filler: no new relevant note', 'is-in');
        await step(runner.gesture('shake', 900));
      } else if (option === 'stay silent') {
        hud.set(null);
        if (ctl === 'cut-AM') { alert.set('Nothing in Memory gives a reason to stay quiet', 'is-in'); await step(view.wait(1300)); }
        else { chip.set(policy ? 'The policy stays quiet: both notes were shown' : 'Quiet: both notes were shown today', 'is-ok'); await step(view.wait(900)); }
      }
    });
  }

  function inspect(id, i, ctl) {
    const facts = {
      runner: ['Person', 'The user', 'An experienced runner on a second visit. The profile in Memory says marathons and no brand stories.'],
      glasses: ['Sensing and Action', 'Smart glasses', ctl === 'cut-AM' ? 'Show notes on a small in-lens display, but with A→M cut they never record what they showed.' : 'Track gaze to start a closer look (triggered sensing) and show short notes on a small in-lens display.'],
      shoeX: ['Object', 'Ivory running shoe', 'Heel drop 8 mm. The note about it is recorded as shown on Tuesday, unless A→M is cut.'],
      shoeY: ['Object', 'Blue-gray running shoe', 'Heel drop 4 mm, the comparison the note makes.']
    };
    const [tag, title, text] = facts[id] || [];
    return title ? { tag, title, text } : null;
  }
  const visibleSpots = i => (i === 0 ? ['runner', 'glasses'] : ['glasses', 'shoeX', 'shoeY']);

  snapBase();
  view.setHome(overview);
  return { overview, enter, act, inspect, spots, visibleSpots, snapEnd };
}
