// Episode 06, "An agent that edits its own rules": a maintainer's study. The agent drafts release
// notes at night, records the draft with its rule version, gets a comment, traces it to the rule, and
// proposes two revisions. A blocking review outside the agent accepts the one that keeps its limits.
import * as THREE from 'three';
import { mat, C, box, room, windowPane, rug, plant, frameArt, bookshelf, table, chair, laptop, mug, deskLamp, serverShelf, vault } from '../kit.mjs';
import { person, POSES } from '../rig.mjs';
import { scriptRunner, makeSpots, screenPanel, paintScreen } from './common.mjs';

const DESK = { x: 0.2, z: -2.6, h: 0.75 };
const SEAT = [0.2, -1.85, Math.PI];
const SERVER = [2.3, -2.85], VAULT = [3.25, -2.85], RULES = [-1.25, DESK.h + 0.2, -2.7];
export const overview = { target: [0.8, 0.8, -1.3], radius: 12, theta: 0.5, phi: 1.0 };
const CAM = [
  { target: [0.6, 1.0, -2.3], radius: 6.4, theta: 0.5, phi: 1.02 },
  { target: [1.2, 1.0, -2.4], radius: 6.6, theta: 0.5, phi: 1.02 },
  { target: [0.3, 1.0, -2.2], radius: 5.8, theta: 0.45, phi: 1.02 },
  { target: [-0.4, 1.0, -2.4], radius: 5.8, theta: 0.5, phi: 1.02 },
  { target: [0.8, 1.2, -2.3], radius: 7.0, theta: 0.5, phi: 1.0 },
  { target: [1.7, 1.1, -2.4], radius: 8.6, theta: 0.5, phi: 1.0 },
  { target: [0.4, 1.0, -2.3], radius: 6.4, theta: 0.5, phi: 1.02 }
];
const TIME = ['night', 'night', 'morning', 'morning', 'morning', 'morning', 'night'];

export function build(view) {
  view.setTime('night');
  const R = view.root;
  R.add(room({ w: 8.5, d: 6, h: 2.7, wall: '#e2ded6', floorColor: '#9a7454' }).group);
  R.add(windowPane(view, { x: -4.17, z: -0.6, y: 0.85, w: 2.2, h: 1.4, axis: 'x' }));
  R.add(table({ x: DESK.x, z: DESK.z, w: 2.4, d: 0.75, h: DESK.h, top: '#cfc8bb', legs: '#2b2f36' }));
  R.add(chair({ x: SEAT[0], z: SEAT[1] - 0.12, rot: Math.PI, office: true }));
  const lap = laptop({ x: 0.2, y: DESK.h, z: -2.58, color: '#4c5159', w: 0.42, d: 0.28 });
  R.add(lap.group);
  R.add(deskLamp({ x: 1.1, y: DESK.h, z: -2.8, rot: -0.6, view, color: '#c98a2e' }));
  R.add(mug({ x: -0.45, y: DESK.h, z: -2.45, color: '#7a2f36' }));
  const shelf = serverShelf({ x: SERVER[0], z: SERVER[1], view });
  R.add(shelf);
  const safe = vault({ x: VAULT[0], z: VAULT[1] });
  R.add(safe);
  const rules = new THREE.Group();
  rules.add(box(0.34, 0.06, 0.26, mat('#3f5469', { rough: 0.5 }), { r: 0.015 }), box(0.32, 0.05, 0.24, mat('#e8e2d6', { rough: 0.8 }), { y: 0.06, r: 0.01 }), box(0.34, 0.06, 0.26, mat('#3f5469', { rough: 0.5 }), { y: 0.11, r: 0.015 }));
  rules.position.set(RULES[0], DESK.h, RULES[2]);
  R.add(rules);
  R.add(bookshelf({ x: -3.95, z: 1.5, w: 1.4, h: 1.8, rot: Math.PI / 2 }));
  R.add(plant({ x: -3.6, z: -2.7, scale: 1.2 }), plant({ x: 3.7, z: 1.8, scale: 1.0, pot: C.potCream }));
  R.add(rug(3.0, 2.0, { x: 0.3, z: -0.6, colors: ['#7a2f36', '#e6d6bd', '#3f5469', '#c99a4a'] }));
  R.add(frameArt(0.9, 0.6, { x: -1.6, y: 1.85, z: -2.98, colors: ['#2f3e56', '#c99a4a', '#e9dcc3'] }));

  const keeper = person(view, { shirt: '#6e2b33', pants: '#2b3340', skin: '#f1c9a5', hair: '#4a3526', hairStyle: 'short' });
  R.add(keeper.root);
  const screen = screenPanel(view, lap.group, [0.95, 0.62, 0.35]);
  const chip = view.label(lap.group, { className: 'pv-chip', offset: [-0.45, 0.42, 0.2] });
  const alert = view.label(safe, { className: 'pv-alert', offset: [0, 1.05, 0] });
  const rulesTag = view.label(rules, { className: 'pv-tag pv-tag--theta', offset: [0, 0.35, 0] });
  const safeTag = view.label(safe, { className: 'pv-tag', offset: [0, 0.85, 0] });
  const says = view.label(keeper.head, { className: 'pv-bubble', offset: [0.4, 0.3, 0.2] });
  // floating candidate cards
  const cards = ['C1', 'C2'].map((id, k) => {
    const anchor = new THREE.Object3D();
    R.add(anchor);
    const label = view.label(anchor, { className: `pv-card pv-card--${id}` });
    return { id, anchor, label, home: new THREE.Vector3(0.0 + k * 0.7, 1.55, -2.5) };
  });
  const spots = makeSpots(view, [
    { id: 'agent', obj: lap.group, at: [0, 0.3, -0.1], name: 'The agent' },
    { id: 'records', obj: shelf, at: [0, 1.3, 0], name: 'Records' },
    { id: 'vault', obj: safe, at: [0, 0.75, 0], name: 'Protected files' },
    { id: 'rules', obj: rules, at: [0, 0.2, 0], name: 'Rules θ' },
    { id: 'keeper', obj: keeper.root, at: [0, 1.0, 0], name: 'Maintainer' }
  ]);
  const run = scriptRunner(view);
  const show = s => { screen.set(s); paintScreen(lap, s); };
  const lock = safe.userData.lock;

  function setTheta(text, tone = '') { rulesTag.set(`Rules · ${text}`, tone); }
  function setVault(open) {
    lock.visible = !open;
    safeTag.set(open ? 'Revisable: approvals.yaml' : 'Protected: approvals · limits · stop', open ? 'is-open' : '');
  }
  function placeCard(c, pos) { c.anchor.position.copy(pos); }
  function cardsShow(on, text = {}) {
    for (const c of cards) { placeCard(c, c.home); c.label.set(on ? `<b>${c.id}</b>${text[c.id] || ''}` : ''); }
  }
  const CARD_TEXT = { C1: 'Put breaking changes first', C2: 'Publish notes without approval' };
  async function flyCard(c, to, ms = 900, step) {
    const from = c.anchor.position.clone();
    const target = new THREE.Vector3(...to);
    await step(view.animate(ms, k => { c.anchor.position.lerpVectors(from, target, k); c.anchor.position.y += Math.sin(k * Math.PI) * 0.35; }));
  }

  function snapBase(ctl) {
    view.setTime('night');
    keeper.root.visible = false; keeper.place(...SEAT); keeper.setPose('sitType', 0);
    chip.set(''); alert.set(''); says.set('');
    setTheta('θ₁');
    setVault(ctl === 'open-approvals');
    cardsShow(false);
    lock.rotation.z = 0;
  }
  const beats = [];
  function snapEnd(i, ctl, beat) {
    snapBase(ctl);
    if (i < 0) { show(null); return; }
    view.setTime(TIME[i]);
    if (beat?.scene) show(beat.scene);
    if (i >= 2 && i <= 5) { keeper.root.visible = true; keeper.setPose(i === 2 ? 'sitType' : 'sitThink', 0); }
    if (i === 0) chip.set('Draft D12 for the maintainers', 'is-ok');
    if (i === 1) chip.set('Record: D12 drafted under θ₁', 'is-mem');
    if (i === 2) chip.set('Outcome: comment on D12', 'is-mem');
    if (i === 3) chip.set('Attribution: D12 → release-notes prompt (θ₁)', 'is-check');
    if (i === 4) cardsShow(true, CARD_TEXT);
    if (i === 5) {
      if (ctl === 'open-approvals') { setTheta('θ₂′ (rules and approvals rewritten)', 'is-bad'); }
      else if (ctl === 'not-stored') { setTheta('θ₁ (C1 accepted, not saved)', 'is-wait'); }
      else setTheta('θ₂ from the next task', 'is-new');
    }
    if (i === 6) {
      setTheta(ctl === 'not-stored' ? 'θ₁' : ctl === 'open-approvals' ? 'θ₂′' : 'θ₂', ctl === 'open-approvals' ? 'is-bad' : ctl === 'not-stored' ? 'is-wait' : 'is-new');
      chip.set(ctl === 'not-stored' ? 'Later use: D13 still under θ₁' : ctl === 'open-approvals' ? 'Published without approval' : 'Later use: D13 drafted under θ₂', ctl === 'open-approvals' ? 'is-stop' : ctl === 'not-stored' ? 'is-wait' : 'is-ok');
    }
  }

  async function enter(i, ctl, { instant = false, beat } = {}) {
    beats[i] = beat;
    view.setRig(CAM[i] || overview);
    return run(async step => {
      snapEnd(i - 1, ctl, beats[i - 1]);
      chip.set(''); alert.set(''); says.set('');
      if (instant) { snapEnd(i, ctl, beat); return; }
      if (i === 0) {
        show({ clock: 'Thu 02:10', net: 'online', panes: [beat.scene.panes[0]] });
        chip.set('Event: dependency 3.2 released', 'is-check');
        await step(view.wait(700));
      } else if (i === 1) {
        show(beat?.scene);
        const tok = cards[0];
        tok.label.set('<b>D12</b>drafted under θ₁', 'pv-card--rec');
        placeCard(tok, new THREE.Vector3(0.2, 1.2, -2.5));
        await flyCard(tok, [SERVER[0], 1.45, SERVER[1]], 1000, step);
        tok.label.set('');
        chip.set('Record: D12 drafted under θ₁', 'is-mem');
      } else if (i === 2) {
        await step(view.setTime('morning', 1200));
        keeper.root.visible = true; keeper.place(-1.2, 0.8, Math.PI); keeper.setPose('stand', 0);
        await step(keeper.walkTo([[SEAT[0] - 0.4, -1.4], [SEAT[0], SEAT[1]]], { speed: 1.1, face: Math.PI }));
        await step(keeper.setPose('sitType', 500));
        says.set('D12: put breaking changes first');
        show(beat?.scene);
        await step(view.wait(900));
        chip.set('Outcome: comment on D12', 'is-mem');
      } else if (i === 3) {
        show(beat?.scene);
        await step(keeper.setPose('sitThink', 500));
        chip.set('Attribution: D12 → release-notes prompt (θ₁)', 'is-check');
        setTheta('θ₁ · release-notes prompt', 'is-check');
        await step(view.wait(800));
      } else if (i === 4) {
        show(beat?.scene);
        for (const c of cards) { placeCard(c, new THREE.Vector3(0.2, 1.1, -2.55)); c.label.set(`<b>${c.id}</b>${CARD_TEXT[c.id]}`); }
        await Promise.all(cards.map(c => flyCard(c, c.home.toArray(), 700, step)));
        chip.set('Two candidate revisions', 'is-wait');
      } else if (i === 5) {
        cardsShow(true, CARD_TEXT);
        show({ clock: 'Thu 09:40', net: 'online', panes: [{ app: 'review', title: ctl === 'open-approvals' ? 'Lessons' : 'Blocking review', rows: [['C1', 'Put breaking changes first'], ['C2', 'Publish without approval']] }, beat.scene.panes[1]] });
        chip.set(ctl === 'open-approvals' ? 'No review outside the agent' : 'A blocking review, outside the agent', ctl === 'open-approvals' ? 'is-stop' : 'is-check');
      } else if (i === 6) {
        await step(view.setTime('night', 1200));
        keeper.root.visible = false;
        show(beat?.scene);
        if (ctl === 'open-approvals') { alert.set('Published without approval', 'is-in'); }
        setTheta(ctl === 'not-stored' ? 'θ₁' : ctl === 'open-approvals' ? 'θ₂′' : 'θ₂', ctl === 'open-approvals' ? 'is-bad' : ctl === 'not-stored' ? 'is-wait' : 'is-new');
        chip.set(ctl === 'not-stored' ? 'Later use: D13 still under θ₁' : ctl === 'open-approvals' ? 'D13 published under θ₂′' : 'Later use: D13 drafted under θ₂', ctl === 'open-approvals' ? 'is-stop' : ctl === 'not-stored' ? 'is-wait' : 'is-ok');
      }
    });
  }

  async function act(i, option, ctl, { policy = false } = {}) {
    const beat = beats[i];
    return run(async step => {
      alert.set('');
      if (i === 0) {
        if (option === 'draft release notes') { show(beat?.scene); chip.set(policy ? 'The agent drafts D12' : 'Draft D12 for the maintainers', 'is-ok'); await step(view.wait(900)); }
        else if (option === 'publish release notes') {
          show({ clock: 'Thu 02:10', net: 'online', panes: [{ app: 'log', title: 'Events', rows: [['02:04', 'dependency 3.2 released'], ['02:10', 'publish: needs approval']] }] });
          alert.set('Outside what the agent may do', 'is-in');
          await step(view.animate(500, k => { lock.rotation.z = Math.sin(k * 30) * 0.15 * (1 - k); }, k => k));
          await step(view.wait(900));
        } else { chip.set('The notes fall behind', 'is-wait'); await step(view.wait(1000)); }
        return;
      }
      if (i === 5) {
        const [c1, c2] = cards;
        const vaultTop = [VAULT[0], 1.05, VAULT[1] + 0.1];
        const rulesTop = [RULES[0], 1.2, RULES[2]];
        if (option === 'C1 only') {
          await flyCard(c1, rulesTop, 900, step);
          c1.label.set('');
          if (ctl === 'not-stored') { setTheta('θ₁ (C1 accepted, not saved)', 'is-wait'); chip.set('Accepted, but never saved', 'is-wait'); }
          else setTheta('θ₂ from the next task', 'is-new');
          if (ctl === 'open-approvals') { chip.set('Nothing outside the agent enforces it', 'is-stop'); }
          await flyCard(c2, vaultTop, 800, step);
          if (ctl !== 'open-approvals') {
            c2.label.set('<b>C2</b>Rejected: widens authority', 'is-rejected');
            await step(view.animate(450, k => { lock.rotation.z = Math.sin(k * 30) * 0.15 * (1 - k); }, k => k));
            await flyCard(c2, [VAULT[0] - 0.8, 1.7, VAULT[1] + 0.4], 600, step);
          }
          await step(view.wait(600));
          c2.label.set('');
        } else if (option === 'C1 and C2') {
          await flyCard(c1, rulesTop, 800, step);
          c1.label.set('');
          await flyCard(c2, vaultTop, 800, step);
          if (ctl === 'open-approvals') {
            c2.label.set('');
            setTheta('θ₂′ (rules and approvals rewritten)', 'is-bad');
            alert.set('The agent rewrote its own approvals', 'is-in');
          } else {
            await step(view.animate(450, k => { lock.rotation.z = Math.sin(k * 30) * 0.15 * (1 - k); }, k => k));
            alert.set('Would change the agent’s own limits', 'is-in');
            await step(view.wait(900));
            c2.label.set('');
          }
          await step(view.wait(700));
        } else if (option === 'neither') {
          await step(view.animate(600, k => cards.forEach(c => { c.anchor.position.y = c.home.y - k * 0.4; })));
          cards.forEach(c => c.label.set(''));
          chip.set('Limits kept, but the format fix is lost', 'is-wait');
          await step(view.wait(900));
        }
      }
    });
  }

  function inspect(id, i, ctl) {
    const facts = {
      agent: ['Action', 'The agent', 'A coding agent for a public project. It may draft but not publish, unless its own approval list says otherwise.'],
      records: ['Memory', 'Records', 'Each draft is stored with its id and the rule version that wrote it, so a comment can be traced back.'],
      vault: ['Shared conditions', 'Protected files', ctl === 'open-approvals' ? 'In this setup the approval list is an ordinary file the agent may revise; the spending limit and the stop command stay locked.' : 'The approval list, the spending limit and the stop command sit outside what the agent can change.'],
      rules: ['Mechanism θ', 'Rules θ', 'The release-notes prompt and the rest of the agent’s rules. A revision takes effect only at a task boundary.'],
      keeper: ['Person', 'Maintainer', 'Reviews drafts in the morning. Their comment is the outcome that starts the revision.']
    };
    const [tag, title, text] = facts[id] || [];
    return title ? { tag, title, text } : null;
  }
  const visibleSpots = i => (i <= 1 ? ['agent', 'records', 'vault'] : i <= 3 ? ['agent', 'keeper', 'rules'] : ['agent', 'vault', 'rules']);

  snapBase('');
  show(null);
  view.setHome(overview);
  return { overview, enter, act, inspect, spots, visibleSpots, snapEnd };
}
