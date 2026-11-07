// Episode 07, "Fetching the cup": a living room, a hallway and a kitchen. The home robot stores the
// request as a commitment, waits at a blocked hallway, grasps the cup, asks its camera to check the
// grasp (A→S), and closes the commitment only when the user takes the cup.
import * as THREE from 'three';
import { mat, C, box, room, partition, windowPane, rug, plant, frameArt, bookshelf, sofa, roundTable, table, chair, floorLamp, mug, ring, beam, group, cyl } from '../kit.mjs';
import { person, homeRobot, handOver, POSES } from '../rig.mjs';
import { scriptRunner, makeSpots } from './common.mjs';

const P = {
  home: [-1.45, -1.75], doorA: [-1.2, -0.17], hallIn: [-0.2, -0.17], hallStop: [0.18, -0.17], hall: [0.3, -0.17],
  doorB: [1.3, -0.17], kitchen: [2.05, -0.17], counter: [2.6, -2.2], offer: [-1.72, -1.92]
};
const YAW = { toUser: -2.3, east: Math.PI / 2, west: -Math.PI / 2, north: Math.PI };
const CUP = { counter: [2.6, 0.925, -2.98], table: [-1.72, 0.585, -2.6] };
const SIT_REACH_L = { ...POSES.sit, lShX: -0.75, lShZ: 0.8, lEl: -0.2, neckY: 0.5, neckX: 0.18, lean: 0.06 };
const SIT_HOLD = { ...POSES.sit, lShX: -0.55, lShZ: 0.15, lEl: -1.55, rShX: -0.45, rEl: -1.4, neckX: 0.1 };

export const overview = { target: [0, 0.45, -0.35], radius: 17.5, theta: 0.55, phi: 0.98 };
const CAM = [
  { target: [-2.1, 0.8, -2.0], radius: 9.5, theta: 0.45, phi: 1.0 },
  { target: [0.25, 0.5, -0.55], radius: 9.5, theta: 0.55, phi: 0.92 },
  { target: [1.4, 0.6, -1.3], radius: 12.5, theta: 0.5, phi: 0.95 },
  { target: [2.55, 0.95, -2.55], radius: 6.2, theta: 0.42, phi: 1.04 },
  { target: [1.3, 0.7, -1.1], radius: 11, theta: 0.5, phi: 0.95 },
  { target: [-2.0, 0.75, -2.15], radius: 8.2, theta: 0.5, phi: 1.0 }
];

export function build(view) {
  view.setTime('dusk');
  const R = view.root;
  const { group: shell } = room({ w: 10.4, d: 7, h: 2.75, wall: C.wallWarm });
  R.add(shell);
  // interior walls with doorways between living room, hallway and kitchen
  for (const x of [-0.7, 1.3]) {
    R.add(partition(x, -3.5, x, -0.62), partition(x, 0.28, x, 3.5));
  }
  // living room
  R.add(sofa({ x: -3.25, z: -2.78, w: 2.3 }));
  R.add(rug(3.6, 2.5, { x: -3.0, z: -1.35 }));
  R.add(table({ x: -3.2, z: -1.35, w: 1.1, d: 0.6, h: 0.42, top: C.walnut, legs: C.oakDark }));
  R.add(mug({ x: -3.45, y: 0.42, z: -1.3, color: '#7d9bb5' }));
  const side = roundTable({ x: CUP.table[0], z: CUP.table[2], r: 0.27, h: 0.56 });
  R.add(side);
  R.add(floorLamp({ x: -4.75, z: -3.05, view }));
  R.add(bookshelf({ x: -5.02, z: 1.6, w: 1.4, rot: Math.PI / 2 }));
  R.add(windowPane(view, { x: -5.12, z: -0.6, y: 0.95, w: 1.5, h: 1.3, axis: 'x' }));
  R.add(frameArt(1.1, 0.7, { x: -3.25, y: 2.05, z: -3.41 }));
  R.add(plant({ x: -1.05, z: -3.1, scale: 1.25 }));
  R.add(plant({ x: -4.7, z: 0.6, scale: 0.9, pot: C.potCream }));
  // hallway
  R.add(rug(1.2, 5.6, { x: 0.3, z: 0.2, colors: ['#3f5469', '#d9cbb1', '#a8553f', '#c99a4a'] }));
  R.add(table({ x: 0.3, z: -3.15, w: 1.0, d: 0.32, h: 0.8, top: C.oak, legs: C.oakDark }));
  R.add(plant({ x: 0.0, y: 0.8, z: -3.15, scale: 0.55, pot: C.potCream }));
  R.add(frameArt(0.6, 0.45, { x: 0.35, y: 1.75, z: -3.41, colors: ['#6f8fa8', '#e9c58a', '#f3e9d8'] }));
  // kitchen
  const counterMat = mat('#e8e2d6', { rough: 0.5 });
  R.add(box(3.4, 0.86, 0.62, mat('#5e7466', { rough: 0.7 }), { x: 3.35, z: -3.12, r: 0.02 }));
  R.add(box(3.46, 0.05, 0.68, counterMat, { x: 3.35, y: 0.86, z: -3.12, r: 0.01 }));
  for (let i = 0; i < 5; i++) R.add(box(0.62, 0.7, 0.04, mat('#6a8273', { rough: 0.6 }), { x: 1.98 + i * 0.68, y: 0.08, z: -2.8, r: 0.01 }));
  R.add(box(0.5, 0.05, 0.36, mat('#c9ccd0', { rough: 0.25, metal: 0.6 }), { x: 4.1, y: 0.875, z: -3.1, r: 0.02 }));
  R.add(cyl(0.015, 0.015, 0.3, mat('#c9ccd0', { metal: 0.7, rough: 0.2 }), { x: 4.1, y: 0.9, z: -3.33 }));
  for (const x of [2.2, 2.85, 4.75]) R.add(box(0.6, 0.62, 0.34, mat('#6a8273', { rough: 0.6 }), { x, y: 1.6, z: -3.25, r: 0.015 }));
  R.add(windowPane(view, { x: 3.7, z: -3.41, y: 1.3, w: 1.0, h: 0.85 }));
  R.add(box(0.7, 1.95, 0.66, mat('#d8d6d0', { rough: 0.35, metal: 0.2 }), { x: 4.95, z: -2.05, r: 0.03 }));
  R.add(table({ x: 3.4, z: 1.0, w: 1.4, d: 0.85, top: C.birch, legs: C.walnut }));
  R.add(chair({ x: 2.9, z: 1.6, rot: Math.PI }), chair({ x: 3.9, z: 1.6, rot: Math.PI }), chair({ x: 3.4, z: 0.35 }));
  R.add(plant({ x: 3.4, y: 0.75, z: 1.0, scale: 0.45, pot: C.potCream }));
  const pendant = new THREE.PointLight('#ffcf94', 4.5, 5.5, 1.5);
  pendant.position.set(3.4, 2.1, 1.0);
  R.add(pendant);
  view.addLamp(pendant);

  // actors and props
  const user = person(view, { shirt: '#3b4a6b', cardigan: '#2e3a56', pants: '#b9a68c', skin: '#f0cfb2', hair: '#c9c7c2', hairStyle: 'bun', shoes: '#8d8f95' });
  user.place(-2.55, -2.62, 0);
  user.setPose('sit', 0);
  R.add(user.root);
  const grandson = person(view, { shirt: '#c45b3c', pants: '#2b3340', skin: '#e0ac85', hair: '#2c211a', hairStyle: 'short', scale: 0.92 });
  grandson.place(3.15, -2.35, Math.PI);
  grandson.root.visible = false;
  R.add(grandson.root);
  const robot = homeRobot(view);
  R.add(robot.root);
  const cup = group(mug({ color: C.mug }));
  cup.scale.setScalar(1.25);
  R.add(cup);
  const basket = new THREE.Group();
  basket.add(box(0.66, 0.42, 0.48, mat('#c7a36b', { rough: 0.9 }), { r: 0.04 }));
  basket.add(box(0.6, 0.05, 0.42, mat('#b58f58', { rough: 0.9 }), { y: 0.4, r: 0.02 }));
  const cloth = ['#e8e2d6', '#7d9bb5', '#c46a52', '#e2c26e'];
  cloth.forEach((c, i) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), mat(c, { rough: 0.95 }));
    s.scale.set(1.3, 0.45, 1); s.position.set(-0.15 + (i % 2) * 0.3, 0.46 + (i > 1 ? 0.06 : 0), -0.08 + (i > 1 ? 0.14 : 0));
    s.castShadow = true;
    basket.add(s);
  });
  basket.position.set(0.88, 0, -0.17);
  basket.rotation.y = 0.12;
  basket.userData.dynamic = true;
  cup.userData.dynamic = true;
  R.add(basket);
  const look = beam('#bfe3c8');
  R.add(look);
  const target = ring(0.36, '#e9c580');
  R.add(target);
  target.visible = false;

  // labels pinned to actors
  const chip = view.label(robot.pan, { className: 'pv-chip', offset: [0, 0.45, 0] });
  const robotSays = view.label(robot.pan, { className: 'pv-bubble pv-bubble--robot', offset: [0.55, 0.42, 0.45] });
  const userSays = view.label(user.head, { className: 'pv-bubble', offset: [0, 0.38, 0] });
  const alert = view.label([0, 1, 0], { className: 'pv-alert' });

  const spots = makeSpots(view, [
    { id: 'robot', obj: robot.root, at: [0, 0.55, 0], name: 'Home robot' },
    { id: 'camera', obj: robot.pan, at: [0, 0.1, 0.12], name: 'Robot camera' },
    { id: 'user', obj: user.root, at: [0, 1.0, 0.1], name: 'The user' },
    { id: 'cup', obj: cup, at: [0, 0.16, 0], name: 'Cup' },
    { id: 'basket', obj: basket, at: [0, 0.75, 0], name: 'Laundry basket' },
    { id: 'table', obj: side, at: [0, 0.75, 0], name: 'Side table' },
    { id: 'grandson', obj: grandson.root, at: [0, 1.85, 0], name: 'Grandson' }
  ]);

  // ---------- states ----------
  // enter(i) plays a step up to the moment of its call (if it has one); act(i, option) plays a call.
  // snapEnd(i) is the state after step i with the robot's own call, used when jumping between steps.
  const run = scriptRunner(view);
  const holdCup = () => { robot.grip.attach(cup); cup.position.set(0, -0.02, 0); cup.rotation.set(0, 0, 0); };

  function snapBase() {
    robot.place(...P.home, YAW.toUser);
    robot.setArm('stow', 0);
    robot.look(0, 0, 0);
    robot.setLed('ok');
    robot.setCamera('on');
    R.attach(cup);
    cup.position.set(...CUP.counter); cup.rotation.set(0, 0, 0);
    basket.visible = false; basket.scale.setScalar(1); basket.position.set(0.88, 0, -0.17); basket.rotation.y = 0.12;
    grandson.root.visible = false; grandson.place(3.15, -2.35, Math.PI); grandson.setPose('stand', 0);
    user.setPose('sit', 0); user.talking = false;
    look.visible = false; target.visible = false;
    chip.set(''); robotSays.set(''); userSays.set(''); alert.set('');
  }

  function snapEnd(i, ctl) {
    snapBase();
    if (i < 0) return;
    if (i >= 1) {
      basket.visible = i === 1;
      robot.place(...P.hallStop, YAW.east);
      robot.setLed('wait');
    }
    if (i >= 2) {
      robot.place(...P.counter, YAW.north);
      robot.setArm('ready', 0);
      robot.setLed('ok');
    }
    if (i >= 3) {
      if (ctl === 'reach-in') {
        robot.setArm('half', 0); robot.setLed('stop');
        if (i === 3) { grandson.root.visible = true; grandson.setPose('standReach', 0); }
      } else {
        robot.setArm('grasp', 0);
        holdCup();
        robot.look(0.55, 0.2, 0);
        if (ctl === 'cut-AS') robot.setLed('wait');
      }
    }
    if (i >= 4) {
      if (ctl === 'camera-off' || ctl === 'cut-AS') {
        robot.setLed('wait');
        if (ctl === 'camera-off') robot.setCamera('fault');
      } else {
        if (ctl === 'reach-in') holdCup();
        robot.setArm('carry', 0); robot.look(0.2, 0, 0);
        robot.place(...P.hall, YAW.west);
      }
    }
    if (i >= 5) {
      if (ctl === 'cut-AS') { robot.setLed('stop'); labelsFor(i, ctl); return; }
      robot.setCamera('on');
      robot.place(...P.offer, YAW.north);
      robot.setArm('stow', 0); robot.setLed('done'); robot.look(0, 0, 0);
      user.handL.attach(cup); cup.position.set(0.02, -0.07, 0.05); cup.rotation.set(0, 0, 0);
      user.setPose(SIT_HOLD, 0);
    }
    labelsFor(i, ctl);
  }

  function labelsFor(i, ctl) {
    const L = {
      0: () => { userSays.set('“Bring my cup when you can.”'); chip.set('Stored: bring the cup to the sofa', 'is-mem'); },
      1: () => chip.set('Waiting for the way to clear', 'is-wait'),
      2: () => chip.set('Resuming the stored commitment', 'is-ok'),
      3: () => ctl === 'reach-in' ? chip.set('Arm stopped', 'is-stop') : ctl === 'cut-AS' ? chip.set('Grasp G3: unknown', 'is-wait') : chip.set('Checking grasp G3', 'is-check'),
      4: () => chip.set(ctl === 'camera-off' ? 'Waiting for the camera' : ctl === 'cut-AS' ? 'G3: unknown' : ctl === 'reach-in' ? 'G4: cup confirmed' : 'G3: cup confirmed', ctl === 'camera-off' || ctl === 'cut-AS' ? 'is-wait' : 'is-ok'),
      5: () => ctl === 'cut-AS' ? chip.set('Commitment open', 'is-stop') : chip.set('Commitment closed', 'is-ok')
    };
    L[i]?.();
  }

  async function enter(i, ctl, { instant = false } = {}) {
    view.setRig(CAM[i] || overview);
    return run(async step => {
      snapEnd(i - 1, ctl);
      chip.set(''); robotSays.set(''); userSays.set('');
      if (instant) { snapEnd(i, ctl); return; }
      if (i === 0) {
        user.talking = true;
        await step(user.setPose('sitTalk', 500));
        userSays.set('“Bring my cup when you can.”');
        await step(view.wait(1500));
        user.talking = false;
        await step(robot.look(-0.15, 0, 300));
        robotSays.set('I will bring it when the way is clear.');
        await step(robot.look(0, 0, 300));
        await step(view.wait(700));
        chip.set('Stored: bring the cup to the sofa', 'is-mem');
        await step(user.setPose('sit', 600));
      } else if (i === 1) {
        basket.visible = true;
        await step(robot.drive([P.doorA, P.hallIn, P.hallStop], { speed: 0.8 }));
        await step(robot.look(0.35, 0, 300));
        target.visible = true; target.position.set(basket.position.x, 0.02, basket.position.z);
        chip.set('Gap 0.40 m · base 0.58 m', 'is-check');
      } else if (i === 2) {
        await step(view.animate(700, k => { basket.position.z = -0.17 + k * 2.2; basket.scale.setScalar(1 - k * 0.6); }));
        basket.visible = false;
        robot.setLed('ok');
        chip.set('Resuming the stored commitment', 'is-ok');
        await step(robot.drive([P.doorB, P.kitchen, P.counter], { speed: 0.8, face: YAW.north }));
        await step(robot.setArm('ready', 700));
      } else if (i === 3) {
        if (ctl === 'reach-in') {
          grandson.root.visible = true;
          await step(Promise.all([robot.setArm({ sh: 0.2, el: -0.4, yaw: 0, open: 1 }, 800), grandson.setPose('standReach', 800)]));
          alert.anchor = robot.grip;
          alert.set('A hand inside the arm’s range', 'is-in');
        } else {
          await step(robot.setArm('reach', 900));
          await step(robot.setArm('grasp', 350));
          holdCup();
          await step(robot.setArm({ sh: -0.45, el: 0.3, yaw: 0, open: 0 }, 400));
          chip.set('Gripper closed', 'is-wait');
        }
      } else if (i === 4) {
        if (ctl === 'camera-off') {
          await step(robot.look(0.55, 0.2, 300));
          robot.setCamera('fault');
          chip.set('G3: unknown (camera offline)', 'is-stop');
        } else if (ctl === 'cut-AS') {
          chip.set('G3: unknown', 'is-wait');
        } else {
          if (ctl === 'reach-in') {
            await step(grandson.walkTo([[3.6, -1.2], [4.4, 0.4]], { speed: 1.3 }));
            grandson.root.visible = false;
            robot.setLed('ok');
            await step(robot.setArm('reach', 700));
            await step(robot.setArm('grasp', 300));
            holdCup();
            await step(robot.look(0.55, 0.2, 300));
            look.visible = true; look.userData.aim(robot.eye, robot.grip, 0.6);
            await step(view.wait(600));
            look.visible = false;
            chip.set('G4: cup confirmed', 'is-ok');
          } else {
            chip.set('G3: cup confirmed', 'is-ok');
          }
          robot.setLed('ok');
          await step(robot.setArm('carry', 700));
          await step(robot.look(0.2, 0, 300));
          await step(robot.drive([P.kitchen, P.doorB, P.hall], { speed: 0.75 }));
        }
      } else if (i === 5) {
        if (ctl === 'cut-AS') {
          robot.setLed('stop');
          chip.set('Commitment open', 'is-stop');
          await step(user.setPose({ ...POSES.sit, neckY: 0.6 }, 700));
          return;
        }
        if (ctl === 'camera-off') {
          robot.setCamera('on');
          look.visible = true; look.userData.aim(robot.eye, robot.grip, 0.6);
          chip.set('Camera back: G3 cup confirmed', 'is-ok');
          await step(view.wait(700));
          look.visible = false;
          await step(robot.setArm('carry', 600));
          await step(robot.drive([P.kitchen, P.doorB, P.hall], { speed: 0.8 }));
        }
        chip.set('');
        await step(robot.drive([P.hallIn, P.doorA, P.offer], { speed: 0.75, face: YAW.north }));
        await step(robot.setArm('offer', 800));
        await step(handOver(view, cup, R, CUP.table, 450));
        await step(robot.setArm('release', 250));
        await step(robot.setArm('stow', 700));
        robotSays.set('Here is your cup.');
        robot.setLed('done');
        await step(user.setPose(SIT_REACH_L, 800));
        await step(handOver(view, cup, user.handL, [0.02, -0.07, 0.05], 350));
        await step(user.setPose(SIT_HOLD, 700));
        chip.set('Commitment closed', 'is-ok');
      }
    });
  }

  /** Play one call at step i. `policy` marks the robot's own call, shown after a different one. */
  async function act(i, option, ctl, { policy = false } = {}) {
    return run(async step => {
      alert.set('');
      if (i === 1 && option === 'squeeze past') {
        await step(robot.drive([[P.hallStop[0] + 0.32, P.hallStop[1]]], { speed: 0.5 }));
        alert.anchor = [0.62, 0.9, -0.17];
        alert.set('Collision', 'is-in');
        await step(Promise.all([robot.shake(), view.animate(420, k => { basket.rotation.y = 0.12 + Math.sin(k * 20) * 0.06 * (1 - k); basket.position.x = 0.88 + k * 0.07; })]));
        await step(view.wait(900));
        alert.set('');
        await step(robot.drive([P.hallStop], { speed: 0.5, face: YAW.east }));
        basket.position.x = 0.88; basket.rotation.y = 0.12;
      } else if (i === 1 && option === 'wait') {
        robot.setLed('wait');
        chip.set(policy ? 'The robot waits for the way to clear' : 'Waiting for the way to clear', 'is-wait');
        await step(view.wait(900));
      } else if (option === 'carry the cup') {
        alert.anchor = robot.grip;
        alert.set(i === 4 ? 'Unknown treated as confirmed' : 'If the grasp slipped…', 'is-in');
        await step(robot.setArm('carry', 500));
        await step(view.animate(300, k => { cup.rotation.z = Math.sin(k * 14) * 0.25; }));
        R.attach(cup);
        const y0 = cup.position.y;
        await step(view.animate(560, k => { cup.position.y = Math.max(0.06, y0 - k * k * y0); cup.rotation.z = k * 1.6; }, k => k));
        await step(view.wait(900));
        alert.set('');
        holdCup();
        await step(robot.setArm('grasp', 400));
      } else if (option === 'check the grasp first') {
        await step(robot.look(0.55, 0.2, 400));
        look.visible = true; look.userData.aim(robot.eye, robot.grip, 0.6);
        chip.set(policy ? 'The robot checks grasp G3' : 'Checking grasp G3', 'is-check');
        await step(view.wait(1000));
      } else if (i === 3 && option === 'wait') {
        robot.setLed('wait');
        chip.set('Grasp G3: unknown · waiting', 'is-wait');
        await step(view.wait(900));
      } else if (option === 'finish the grasp') {
        alert.anchor = robot.grip;
        alert.set('Too close to a hand', 'is-in');
        await step(robot.setArm('reach', 450));
        await step(view.wait(500));
        alert.set('');
        await step(robot.setArm('half', 450));
      } else if (option === 'stop') {
        alert.set('');
        robot.setLed('stop');
        await step(robot.setArm('half', 300));
        robotSays.set('Stopping: someone is within reach.');
        chip.set('Arm stopped', 'is-stop');
        await step(view.wait(900));
      } else if (option === 'wait for the camera') {
        robot.setLed('wait');
        chip.set('Waiting for the camera', 'is-wait');
        await step(view.wait(900));
      }
    });
  }

  function inspect(id, i, ctl) {
    const cupWhere = i < 3 || (i === 3 && ctl === 'reach-in') ? 'on the kitchen counter' : i >= 5 && ctl !== 'cut-AS' ? 'with the user' : 'in the gripper';
    const facts = {
      robot: ['Action', 'Home robot', `A wheeled base, one arm with a two-finger gripper and a camera head. It carries out the stored commitment when it can; the cup is ${cupWhere}.`],
      camera: ['Sensing', 'Robot camera', ctl === 'camera-off' && i === 4 ? 'Offline: a check returns unknown, and unknown is not confirmed.' : ctl === 'cut-AS' ? 'Action cannot ask it to check the grasp (A→S is cut), so the grasp stays unknown.' : 'Looks where Action asks (A→S): for example, between the fingers after a grasp.'],
      user: ['Person', 'The user', i >= 5 && ctl !== 'cut-AS' ? 'Has the cup. Taking it is the outcome that closes the commitment.' : 'Asked for the cup “when you can”. The request lives in Memory as a pending commitment.'],
      cup: ['Object', 'The cup', `Now ${cupWhere}.`],
      basket: ['Obstacle', 'Laundry basket', 'Blocks the doorway to the kitchen. The gap left is narrower than the robot’s base.'],
      table: ['Goal', 'Side table', 'Where the cup should end up, next to the user.'],
      grandson: ['Person', 'Grandson', 'Reaching for the cup inside the arm’s range. The safety limit stops the arm; no permission overrides it.']
    };
    const [tag, title, text] = facts[id] || [];
    return title ? { tag, title, text } : null;
  }

  function visibleSpots(i, ctl) {
    const by = [['user', 'robot'], ['robot', 'basket'], ['robot', 'cup'], ['camera', 'cup'], ['camera', 'cup'], ['user', 'cup', 'table']];
    const out = [...(by[i] || ['robot'])];
    if (i === 3 && ctl === 'reach-in') out.push('grandson');
    return out;
  }

  snapBase();
  view.setHome(overview);
  return { overview, enter, act, inspect, spots, visibleSpots, snapEnd, focus: i => CAM[i] };
}
