// Episode 05, "Did the export work?": an office desk. A desktop agent exports a report twice,
// records both runs, opens the file to check it (A→S), and cannot link a complaint that names no run,
// so it keeps the task open instead of repairing the procedure on a guess.
import * as THREE from 'three';
import { mat, C, box, room, windowPane, rug, plant, frameArt, bookshelf, table, chair, laptop, mug } from '../kit.mjs';
import { person, POSES } from '../rig.mjs';
import { scriptRunner, makeSpots, screenPanel, paintScreen } from './common.mjs';

const DESK = { x: 0.6, z: -2.6, h: 0.75 };
const SEAT = [0.6, -1.85, Math.PI];
export const overview = { target: [0.4, 0.8, -1.2], radius: 11.5, theta: 0.55, phi: 1.0 };
const CAM = [0, 1, 2, 3, 4, 5].map(i => ({ target: [0.7, 1.1, -2.3], radius: i === 4 ? 5.0 : 5.6, theta: 0.5 + (i % 2) * 0.06, phi: 1.02 }));

export function build(view) {
  view.setTime('day');
  const R = view.root;
  R.add(room({ w: 8, d: 6, h: 2.7, wall: '#e4e6e3', floorColor: '#8f7155' }).group);
  R.add(windowPane(view, { x: -3.92, z: -1.0, y: 0.8, w: 2.6, h: 1.5, axis: 'x' }));
  R.add(table({ x: DESK.x, z: DESK.z, w: 1.8, d: 0.75, h: DESK.h, top: '#d9d4c9', legs: '#2b2f36' }));
  R.add(chair({ x: SEAT[0], z: SEAT[1] - 0.12, rot: Math.PI, office: true }));
  const lap = laptop({ x: 0.6, y: DESK.h, z: -2.58, color: '#5d636b', w: 0.4, d: 0.27 });
  R.add(lap.group);
  for (let k = 0; k < 4; k++) R.add(box(0.21, 0.004, 0.29, mat('#f7f6f2', { rough: 0.9 }), { x: 1.25 + (k % 2) * 0.03, y: DESK.h + k * 0.004, z: -2.45, rot: 0.2 + k * 0.05, r: 0 }));
  R.add(mug({ x: 0.0, y: DESK.h, z: -2.45, color: '#2f3e56' }));
  R.add(bookshelf({ x: 2.6, z: -2.85, w: 1.4, h: 1.9 }));
  R.add(plant({ x: -3.5, z: -2.7, scale: 1.3 }), plant({ x: 3.5, z: 1.6, scale: 1.0, pot: C.potCream }));
  R.add(rug(3.0, 2.0, { x: -1.2, z: 0.6, colors: ['#3f5469', '#d9cbb1', '#5f7357', '#c99a4a'] }));
  R.add(frameArt(1.0, 0.65, { x: -1.4, y: 1.9, z: -2.98, colors: ['#6f8fa8', '#d9a15c', '#eef1f4'] }));
  R.add(chair({ x: -1.6, z: 0.6, rot: 0.8, color: '#3a2c22', seat: '#7b8f86' }));

  const analyst = person(view, { shirt: '#2f4a3c', pants: '#2b3340', skin: '#e0ac85', hair: '#1a1512', hairStyle: 'short', buttons: true });
  R.add(analyst.root);
  const screen = screenPanel(view, lap.group, [0.8, 0.75, 0.4]);
  const chip = view.label(lap.group, { className: 'pv-chip', offset: [-0.6, 0.38, 0.2] });
  const alert = view.label(lap.group, { className: 'pv-alert', offset: [0, 0.45, 0.1] });
  const says = view.label(analyst.head, { className: 'pv-bubble', offset: [-0.5, 0.3, 0.2] });
  const spots = makeSpots(view, [
    { id: 'agent', obj: lap.group, at: [0, 0.3, -0.1], name: 'Desktop agent' },
    { id: 'analyst', obj: analyst.root, at: [0, 1.0, 0], name: 'The user' }
  ]);
  const run = scriptRunner(view);
  const show = s => { screen.set(s); paintScreen(lap, s); };
  const filesOnly = { clock: 'Wed 14:13', net: 'online', panes: [{ app: 'files', title: 'Exports', rows: [['A17', 'Q3-report.pdf (partial)'], ['A18', 'Q3-report.pdf']] }, { app: 'log', title: 'Runs', rows: [['A17', 'timeout'], ['A18', 'done']] }] };

  function snapBase() {
    analyst.place(...SEAT); analyst.setPose('sitType', 0); analyst.lookAt(null);
    chip.set(''); alert.set(''); says.set('');
  }
  const beats = [];
  function snapEnd(i, ctl, beat) {
    snapBase();
    if (i < 0) { show(null); return; }
    if (beat?.scene) show(beat.scene);
    if (i === 4) analyst.setPose({ ...POSES.sit, lean: -0.1, rShX: -0.6, rEl: -1.5 }, 0);
    labels(i, ctl);
  }
  function labels(i, ctl) {
    const t = {
      0: ['Using the saved export procedure (M→A)', 'is-mem'],
      1: ['Recorded: A17 timeout · A18 done', 'is-mem'],
      2: ctl === 'cut-AS' ? ['Reported success without a check', 'is-stop'] : ['Opening the file (A→S)', 'is-check'],
      3: ctl === 'cut-AS' ? ['Nobody looked at the file', 'is-stop'] : ['12 of 20 pages · run unknown', 'is-wait'],
      4: ctl === 'with-id' ? ['Feedback on A17', 'is-mem'] : ['Feedback without a run id', 'is-wait'],
      5: ctl === 'with-id' ? ['A17 removed · procedure unchanged', 'is-ok'] : ['Task kept open · procedure unchanged', 'is-wait']
    }[i];
    if (t) chip.set(...t);
  }

  async function enter(i, ctl, { instant = false, beat } = {}) {
    beats[i] = beat;
    view.setRig(CAM[i] || overview);
    return run(async step => {
      snapEnd(i - 1, ctl, beats[i - 1]);
      chip.set(''); alert.set(''); says.set('');
      if (instant) { snapEnd(i, ctl, beat); return; }
      if (i === 0) {
        show(beat?.scene);
        await step(analyst.setPose('sitType', 400));
        await step(view.wait(900));
        labels(0, ctl);
      } else if (i === 1) {
        show({ ...beat.scene, panes: [beat.scene.panes[0], { app: 'log', title: 'Runs', rows: [['A17', 'timeout']] }] });
        await step(view.wait(900));
        show(beat.scene);
        labels(1, ctl);
      } else if (i === 2) {
        show(filesOnly);
        chip.set('The second click finished', 'is-wait');
        await step(analyst.setPose({ ...POSES.sit, lean: -0.08 }, 600));
      } else if (i === 3) {
        show(beat?.scene);
        await step(view.wait(600));
        labels(3, ctl);
      } else if (i === 4) {
        await step(analyst.setPose('sitType', 400));
        says.set('The report is missing pages.');
        show(beat?.scene);
        await step(view.wait(900));
        await step(analyst.setPose({ ...POSES.sit, lean: -0.1, rShX: -0.6, rEl: -1.5 }, 600));
        labels(4, ctl);
      } else if (i === 5) {
        show(beat?.scene);
        chip.set(ctl === 'with-id' ? 'Linked: A17, the run that timed out' : 'Two candidate runs: A17 or A18', ctl === 'with-id' ? 'is-ok' : 'is-wait');
        await step(view.wait(600));
      }
    });
  }

  async function act(i, option, ctl, { policy = false } = {}) {
    const beat = beats[i];
    return run(async step => {
      alert.set('');
      if (option === 'inspect the file') {
        if (ctl === 'cut-AS') { alert.set('Not possible: A→S is cut', 'is-in'); await step(view.wait(1300)); return; }
        show(beat?.scene);
        chip.set(policy ? 'The agent opens the file (A→S)' : 'Opening the file (A→S)', 'is-check');
        await step(view.wait(1100));
      } else if (option === 'report success') {
        show({ ...filesOnly, panes: [{ app: 'chat', title: 'Agent', rows: [['agent', 'Done: Q3-report.pdf is ready.']] }, filesOnly.panes[0]], toast: { title: 'Agent', text: 'Export complete' } });
        await step(view.wait(500));
        alert.set('Nobody checked the file', 'is-in');
        await step(view.wait(1300));
      } else if (option === 'keep the task open') {
        show({ ...beat.scene, panes: [...beat.scene.panes] });
        chip.set(policy ? 'The agent keeps the task open' : 'Task kept open · procedure unchanged', 'is-wait');
        await step(view.wait(1000));
      } else if (option === 'blame A18 and edit the procedure' || option === 'edit the procedure') {
        show({ clock: 'Wed 14:32', net: 'online', panes: [{ app: 'editor', title: 'Procedure', rows: [['v2', 'export report'], ['v3', 'edited on a guess']] }, { app: 'log', title: 'Attribution', rows: [[option.startsWith('blame') ? 'A18' : 'A17', option.startsWith('blame') ? 'blamed (no evidence)' : 'linked: incomplete']] }] });
        await step(view.wait(500));
        alert.set(option.startsWith('blame') ? 'A guess can break a working procedure' : 'The procedure did not cause the failure', 'is-in');
        await step(analyst.gesture('shake', 900));
        await step(view.wait(500));
      } else if (option === 'remove the partial file') {
        show(beat?.scene);
        chip.set(policy ? 'The agent removes the partial file' : 'A17 removed · A18 kept', 'is-ok');
        await step(view.wait(1000));
      }
    });
  }

  function inspect(id, i, ctl) {
    const facts = {
      agent: ['Action and Sensing', 'Desktop agent', ctl === 'cut-AS' ? 'Operates apps for the user. With A→S cut it cannot ask to open the file it exported.' : 'Operates apps for the user, records each run with its id (A17, A18), and can open a file to check it (A→S).'],
      analyst: ['Person', 'The user', ctl === 'with-id' ? 'Flags the file from the export dialog, so the complaint carries the run id.' : 'Writes back that pages are missing, without saying which export.']
    };
    const [tag, title, text] = facts[id] || [];
    return title ? { tag, title, text } : null;
  }
  const visibleSpots = () => ['agent', 'analyst'];

  snapBase();
  show(null);
  view.setHome(overview);
  return { overview, enter, act, inspect, spots, visibleSpots, snapEnd };
}
