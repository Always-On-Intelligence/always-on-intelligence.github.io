// Episode 01, "One hint at the workbench": a home workshop. Smart glasses help with an assembly:
// they ask for a closer look when two parts look alike (A→S), raise a skipped clip without a request,
// wait when the user is already fixing it, and remember nothing the next morning (L0).
import * as THREE from 'three';
import { mat, C, box, room, windowPane, rug, plant, frameArt, bookshelf, workbench, pegboard, mechPart, clipPart, machine, deskLamp, chair, ring, beam } from '../kit.mjs';
import { person, POSES } from '../rig.mjs';
import { scriptRunner, makeSpots, lensHud } from './common.mjs';

const BENCH = { x: 0.4, z: -2.55, top: 0.92 };
const PART_A = [0.05, BENCH.top, -2.35], PART_B = [0.28, BENCH.top, -2.37], CLIP = [0.62, BENCH.top, -2.32], MACHINE = [1.05, BENCH.top, -2.6];
export const overview = { target: [0.2, 0.75, -0.9], radius: 13, theta: 0.5, phi: 1.0 };
const CAM = [
  { target: [0.3, 1.0, -2.2], radius: 5.2, theta: 0.42, phi: 1.02 },
  { target: [0.25, 0.95, -2.35], radius: 3.0, theta: 0.35, phi: 0.9 },
  { target: [0.2, 0.95, -2.35], radius: 3.4, theta: 0.4, phi: 0.92 },
  { target: [0.6, 1.0, -2.4], radius: 4.0, theta: 0.45, phi: 0.95 },
  { target: [0.6, 1.0, -2.4], radius: 4.0, theta: 0.45, phi: 0.95 },
  { target: [0.2, 0.9, -1.6], radius: 8.5, theta: 0.5, phi: 1.0 }
];
const SIT_WORK = { ...POSES.sitWork };
const SIT_COVER = { ...POSES.sitCover };
const SIT_ASK = { ...POSES.sit, rShX: -0.55, rShZ: -0.3, rEl: -1.3, neckX: 0.15, lean: 0.1 };
const SIT_REACH_CLIP = { ...POSES.sitWork, lShX: -0.95, lShZ: 0.3, lEl: -0.5, neckX: 0.4 };
const SIT_NEXT = { ...POSES.sitWork, rShX: -1.0, rShZ: 0.2, rEl: -0.5, neckX: 0.35 };

export function build(view) {
  view.setTime('evening');
  const R = view.root;
  R.add(room({ w: 8, d: 6, h: 2.7, wall: '#e6dfd3', floorColor: '#a8774f' }).group);
  R.add(workbench({ x: BENCH.x, z: BENCH.z, w: 2.6, d: 0.85, h: BENCH.top }));
  R.add(pegboard({ x: 0.4, y: 1.75, z: -2.98, w: 2.2, h: 1.0 }));
  R.add(deskLamp({ x: -0.6, y: BENCH.top, z: -2.75, rot: 0.6, view }));
  R.add(box(0.9, 0.012, 0.5, mat('#2d3238', { rough: 0.9 }), { x: 0.35, y: BENCH.top, z: -2.42, r: 0 }));
  R.add(windowPane(view, { x: -3.92, z: -1.4, y: 0.9, w: 1.8, h: 1.3, axis: 'x' }));
  R.add(bookshelf({ x: -3.75, z: 1.2, w: 1.3, h: 1.6, rot: Math.PI / 2 }));
  R.add(box(1.4, 0.9, 0.5, mat('#7d8a96', { rough: 0.6, metal: 0.3 }), { x: 2.9, z: -2.7, r: 0.02 }));
  for (let i = 0; i < 3; i++) R.add(box(1.3, 0.22, 0.02, mat('#6c7884', { rough: 0.5, metal: 0.3 }), { x: 2.9, y: 0.1 + i * 0.27, z: -2.44, r: 0.005 }));
  R.add(plant({ x: -3.5, z: -2.6, scale: 1.2 }), plant({ x: 3.6, z: 1.8, scale: 1.0, pot: C.potCream }));
  R.add(rug(2.6, 1.8, { x: 0.4, z: -1.2, colors: ['#3f5469', '#d9cbb1', '#a8553f', '#c99a4a'] }));
  R.add(frameArt(0.8, 0.55, { x: 2.9, y: 1.9, z: -2.98, colors: ['#c99a4a', '#3f5469', '#e9dcc3'] }));

  const partA = mechPart(); partA.position.set(...PART_A); partA.rotation.y = 0.3;
  const partB = mechPart(); partB.position.set(...PART_B); partB.rotation.y = -0.2;
  const clip = clipPart(); clip.position.set(...CLIP);
  const mach = machine(); mach.position.set(...MACHINE);
  R.add(partA, partB, clip, mach);
  const stool = chair({ x: 0.15, z: -1.75, rot: Math.PI, office: true });
  R.add(stool);

  const maker = person(view, { shirt: '#3a3d42', pants: '#4a4f56', skin: '#d9a07a', hair: '#1f1712', hairStyle: 'curly', beard: true, glasses: true, shoes: '#2b2b2b', buttons: true });
  maker.place(0.15, -1.82, Math.PI);
  maker.setPose(SIT_WORK, 0);
  R.add(maker.root);
  const hud = lensHud(view, maker, [-0.35, 0.3, 0.35]);
  const look = beam('#bfe3c8');
  R.add(look);
  const mark = ring(0.09, '#9fe8c8');
  R.add(mark);
  const shutter = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  shutter.position.set(0.35, 1.1, -2.2); shutter.rotation.x = -0.4; shutter.userData.noGlow = true;
  R.add(shutter);
  const chip = view.label(maker.head, { className: 'pv-chip', offset: [0, 0.48, 0] });
  const says = view.label(maker.head, { className: 'pv-bubble', offset: [0.45, 0.35, 0.2] });
  const alert = view.label([CLIP[0], CLIP[1] + 0.25, CLIP[2]], { className: 'pv-alert' });
  const spots = makeSpots(view, [
    { id: 'glasses', obj: maker.head, at: [0, 0.03, 0.12], name: 'Smart glasses' },
    { id: 'partA', obj: partA, at: [0, 0.12, 0], name: 'Part A' },
    { id: 'partB', obj: partB, at: [0, 0.12, 0], name: 'Part B' },
    { id: 'clip', obj: clip, at: [0, 0.08, 0], name: 'Clip' },
    { id: 'machine', obj: mach, at: [0, 0.3, 0], name: 'The assembly' }
  ]);

  const run = scriptRunner(view);
  let sampler = null;
  function sampling(on) {
    if (sampler) { sampler(); sampler = null; }
    if (!on) { shutter.material.opacity = 0; return; }
    let last = 0;
    sampler = view.every((dt, t) => {
      if (t - last > 2.6) last = t;
      const k = t - last;
      shutter.material.opacity = k < 0.12 ? 0.35 * (1 - k / 0.12) : 0;
    });
  }
  const aimAt = pos => { look.visible = true; look.userData.aim(maker.head, new THREE.Vector3(...pos), 0.35); };

  function snapBase(ctl) {
    view.setTime('evening');
    maker.place(0.15, -1.82, Math.PI);
    maker.setPose(SIT_WORK, 0);
    maker.talking = false;
    maker.root.visible = true;
    clip.position.set(...CLIP); clip.visible = true;
    hud.set(null); look.visible = false; mark.visible = false;
    chip.set(''); says.set(''); alert.set('');
    sampling(ctl === 'low-budget');
  }
  function snapEnd(i, ctl) {
    snapBase(ctl);
    if (i < 0) return;
    if (i === 1) { maker.setPose(SIT_COVER, 0); hud.set(ctl === 'cut-AS' ? { text: 'Not sure yet', tone: 'quiet' } : { text: 'Checking…', tone: 'quiet' }); }
    if (i === 2) { hud.set(ctl === 'cut-AS' ? { text: 'This one: part A (late)', tone: 'suggest' } : { text: 'This one: part A', tone: 'suggest' }); mark.visible = true; mark.position.set(PART_A[0], PART_A[1] + 0.005, PART_A[2]); }
    if (i === 3) { maker.setPose(SIT_NEXT, 0); if (ctl !== 'low-budget') { hud.set({ text: 'The clip on step 4 is missing', tone: 'alert' }); mark.visible = true; mark.position.set(CLIP[0], CLIP[1] + 0.005, CLIP[2]); } }
    if (i >= 4) {
      if (ctl === 'low-budget') { maker.setPose(SIT_NEXT, 0); }
      else { clip.position.set(MACHINE[0] - 0.1, MACHINE[1] + 0.21, MACHINE[2] + 0.05); hud.set({ text: 'Waiting', tone: 'quiet' }); }
    }
    if (i >= 5) {
      view.setTime('morning');
      hud.set({ text: 'New session', tone: 'quiet' });
      maker.place(-1.4, -0.4, 2.4); maker.setPose('stand', 0);
      chip.set('Working state cleared', 'is-stop');
    }
  }

  async function enter(i, ctl, { instant = false } = {}) {
    view.setRig(CAM[i] || overview);
    return run(async step => {
      snapEnd(i - 1, ctl);
      chip.set(''); says.set(''); alert.set(''); look.visible = false; mark.visible = false;
      if (instant) { snapEnd(i, ctl); return; }
      if (i === 0) {
        maker.talking = true;
        await step(maker.setPose(SIT_ASK, 500));
        says.set('Which one is part A?');
        await step(view.wait(1200));
        maker.talking = false;
        aimAt([PART_A[0] + 0.12, PART_A[1], PART_A[2]]);
        chip.set(ctl === 'low-budget' ? 'Sampling one frame every few seconds' : 'Continuous video of the bench', 'is-check');
        await step(maker.setPose(SIT_WORK, 500));
      } else if (i === 1) {
        await step(maker.setPose(SIT_COVER, 700));
        aimAt([PART_A[0] + 0.12, PART_A[1], PART_A[2]]);
        chip.set('Two parts match · 51% / 49%', 'is-wait');
      } else if (i === 2) {
        if (ctl === 'cut-AS') { await step(view.wait(600)); }
        await step(maker.setPose(SIT_WORK, 600));
        hud.set(ctl === 'cut-AS' ? { text: 'This one: part A (late)', tone: 'suggest' } : { text: 'This one: part A', tone: 'suggest' });
        mark.visible = true; mark.position.set(PART_A[0], PART_A[1] + 0.005, PART_A[2]);
        await step(maker.gesture('nod', 700));
      } else if (i === 3) {
        await step(maker.setPose(SIT_NEXT, 900));
        if (ctl === 'low-budget') { chip.set('No sampled frame shows the clip', 'is-wait'); }
        else { aimAt(CLIP); chip.set('The clip was skipped on step 4', 'is-check'); }
      } else if (i === 4) {
        if (ctl === 'low-budget') {
          await step(maker.setPose(SIT_NEXT, 500));
          chip.set('Still no frame shows the clip', 'is-wait');
        } else {
          hud.set({ text: 'The clip on step 4 is missing', tone: 'alert' });
          await step(maker.setPose(SIT_REACH_CLIP, 900));
          chip.set('The user reaches for the clip', 'is-check');
        }
      } else if (i === 5) {
        maker.lookAt(null);
        await step(maker.walkTo([[-0.6, -1.2], [-1.6, 0.4]], { speed: 1.1 }));
        await step(view.setTime('morning', 1400));
        hud.set({ text: 'New session', tone: 'quiet' });
        chip.set('Working state cleared', 'is-stop');
        await step(maker.walkTo([[-1.4, -0.4]], { speed: 1.0, face: 2.4 }));
      }
    });
  }

  async function act(i, option, ctl, { policy = false } = {}) {
    return run(async step => {
      alert.set('');
      if (option === 'look closer') {
        look.visible = true; look.userData.aim(maker.head, new THREE.Vector3(PART_A[0] + 0.12, PART_A[1], PART_A[2]), 0.12);
        hud.set({ text: 'Checking…', tone: 'quiet' });
        chip.set(policy ? 'The policy asks for a close-up (A→S)' : 'Close-up requested (A→S)', 'is-check');
        await step(view.wait(1100));
      } else if (option === 'answer now') {
        hud.set({ text: 'This one: part B', tone: 'suggest' });
        mark.visible = true; mark.position.set(PART_B[0], PART_B[1] + 0.005, PART_B[2]);
        alert.anchor = [PART_B[0], PART_B[1] + 0.25, PART_B[2]];
        alert.set('A guess: the wrong part', 'is-in');
        await step(view.wait(1400));
        mark.visible = false;
      } else if (option === 'wait' && i === 1) {
        hud.set({ text: 'Not sure yet', tone: 'quiet' });
        await step(view.wait(900));
      } else if (option === 'show a hint') {
        if (ctl === 'low-budget') {
          alert.anchor = [CLIP[0], CLIP[1] + 0.25, CLIP[2]];
          alert.set('No frame shows the clip: a hint from nowhere', 'is-in');
          await step(view.wait(1400));
        } else {
          hud.set({ text: 'The clip on step 4 is missing', tone: 'alert' });
          mark.visible = true; mark.position.set(CLIP[0], CLIP[1] + 0.005, CLIP[2]);
          await step(view.wait(900));
        }
      } else if (option === 'stay silent') {
        hud.set(null);
        if (ctl === 'low-budget') { chip.set(policy ? 'The policy stays silent: nothing observed' : 'Nothing observed, nothing shown', 'is-wait'); await step(view.wait(900)); }
        else {
          await step(maker.setPose({ ...SIT_NEXT, rShX: -1.2, rEl: -0.3 }, 600));
          alert.anchor = [CLIP[0], CLIP[1] + 0.25, CLIP[2]];
          alert.set('The next part covers the missing clip', 'is-in');
          await step(view.wait(1300));
          await step(maker.setPose(SIT_NEXT, 400));
        }
      } else if (option === 'repeat the hint') {
        hud.set({ text: 'The clip on step 4 is missing (again)', tone: 'alert' });
        await step(maker.gesture('flinch', 700));
        alert.anchor = maker.head;
        alert.set('Already on it', 'is-in');
        await step(view.wait(900));
      } else if (option === 'wait one frame') {
        hud.set({ text: 'Waiting', tone: 'quiet' });
        await step(view.animate(800, k => { clip.position.set(CLIP[0] + (MACHINE[0] - 0.1 - CLIP[0]) * k, CLIP[1] + Math.sin(k * Math.PI) * 0.2 + k * 0.21, CLIP[2] + (MACHINE[2] + 0.05 - CLIP[2]) * k); }));
        chip.set(policy ? 'The policy waits: the clip goes in' : 'The next frame shows the clip going in', 'is-ok');
        await step(maker.setPose(SIT_WORK, 500));
      }
    });
  }

  function inspect(id, i, ctl) {
    const facts = {
      glasses: ['Sensing and Action', 'Smart glasses', ctl === 'low-budget' ? 'The camera samples one frame every few seconds to save battery, so short events can fall between frames.' : 'A camera that watches the bench, and a small display for hints. Nothing is kept after the session (L0).'],
      partA: ['Object', 'Part A', 'Looks almost the same as part B. Only a close-up shows the notch.'],
      partB: ['Object', 'Part B', 'The look-alike. Picking it by mistake would be built in.'],
      clip: ['Object', 'The clip', i >= 4 && ctl !== 'low-budget' ? 'Installed after the hint.' : 'Belongs in step 4, and was skipped.'],
      machine: ['Object', 'The assembly', 'Seven steps. The current step lives only in this session’s working state.']
    };
    const [tag, title, text] = facts[id] || [];
    return title ? { tag, title, text } : null;
  }
  const visibleSpots = i => [['glasses', 'partA', 'partB'], ['glasses', 'partA', 'partB'], ['partA', 'partB'], ['glasses', 'clip', 'machine'], ['clip', 'machine'], ['glasses', 'machine']][i] || ['glasses'];

  snapBase('');
  view.setHome(overview);
  return { overview, enter, act, inspect, spots, visibleSpots, snapEnd };
}
