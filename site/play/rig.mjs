// Animated actors for the dioramas: people with jointed limbs and poses, a one-armed home robot,
// and an armless service robot. Actors face +z at yaw 0; their left side is +x.
import * as THREE from 'three';
import { mat, roundedBoxGeometry, blob, C } from './kit.mjs';

const capsule = (r, len, material) => {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 12), material);
  m.castShadow = true; m.receiveShadow = true;
  return m;
};
const ball = (r, material, sy = 1) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), material);
  m.scale.y = sy;
  m.castShadow = true;
  return m;
};
const rbox = (w, h, d, r, material) => {
  const m = new THREE.Mesh(roundedBoxGeometry(w, h, d, r), material);
  m.castShadow = true; m.receiveShadow = true;
  return m;
};

export { POSES, turnTo } from './poses.mjs';
export { person } from './people.mjs';
import { turnTo } from './poses.mjs';

// ---------- the home robot: wheeled base, column, camera head and one arm with a two-finger gripper ----------
export const ARM = {
  stow: { sh: 1.35, el: -2.45, yaw: 0, open: 0 },
  ready: { sh: 0.6, el: -1.2, yaw: 0, open: 1 },
  reach: { sh: -0.35, el: 0.3, yaw: 0, open: 1 },
  grasp: { sh: -0.35, el: 0.3, yaw: 0, open: 0 },
  half: { sh: 0.3, el: -0.6, yaw: 0, open: 1 },
  carry: { sh: 1.0, el: -1.6, yaw: 0, open: 0 },
  offer: { sh: 0.38, el: 0.0, yaw: 0, open: 0 },
  release: { sh: 0.38, el: 0.0, yaw: 0, open: 1 }
};

export function homeRobot(view, { body = '#f3f2ee', accent = '#2f3a4a' } = {}) {
  const white = mat(body, { rough: 0.32, metal: 0.05 });
  const dark = mat(accent, { rough: 0.4, metal: 0.2 });
  const rubber = mat('#1c1d20', { rough: 0.8 });
  const root = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.29, 0.2, 40), white);
  base.position.y = 0.13; base.castShadow = true; base.receiveShadow = true;
  root.add(base);
  const bumper = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.025, 10, 40), rubber);
  bumper.rotation.x = Math.PI / 2; bumper.position.y = 0.05;
  root.add(bumper);
  for (const s of [1, -1]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 20), rubber);
    wheel.rotation.z = Math.PI / 2; wheel.position.set(s * 0.25, 0.07, 0);
    root.add(wheel);
  }
  const ledMat = new THREE.MeshBasicMaterial({ color: '#7fd1ff', toneMapped: false });
  const led = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.008, 8, 48), ledMat);
  led.rotation.x = Math.PI / 2; led.position.y = 0.235;
  led.userData.noGlow = true;
  root.add(led);
  const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 32), mat('#d9d7d1', { rough: 0.5 }));
  tray.position.y = 0.24;
  root.add(tray);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.86, 28), white);
  column.position.y = 0.66; column.castShadow = true;
  root.add(column);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 24), dark);
  collar.position.y = 1.07;
  root.add(collar);
  // head: pan and tilt
  const pan = new THREE.Group();
  pan.position.y = 1.1;
  root.add(pan);
  const tilt = new THREE.Group();
  pan.add(tilt);
  const headShell = rbox(0.21, 0.15, 0.18, 0.05, white);
  headShell.position.y = 0.09;
  tilt.add(headShell);
  const face = rbox(0.16, 0.1, 0.02, 0.02, mat('#15181d', { rough: 0.2, metal: 0.3 }));
  face.position.set(0, 0.09, 0.088);
  tilt.add(face);
  const lensMat = new THREE.MeshBasicMaterial({ color: '#58b7ff', toneMapped: false });
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.026, 24), lensMat);
  lens.position.set(-0.035, 0.09, 0.0995);
  lens.userData.noGlow = true;
  tilt.add(lens);
  const lensRing = new THREE.Mesh(new THREE.RingGeometry(0.028, 0.036, 24), mat('#3a4250', { rough: 0.3, metal: 0.5 }));
  lensRing.position.set(-0.035, 0.09, 0.0993);
  tilt.add(lensRing);
  const eye = new THREE.Object3D();
  eye.position.set(-0.035, 0.09, 0.11);
  tilt.add(eye);
  // arm: shoulder on the front of the column
  const shoulder = new THREE.Group();
  shoulder.position.set(0, 0.86, 0.09);
  root.add(shoulder);
  const shJoint = new THREE.Mesh(new THREE.SphereGeometry(0.055, 18, 12), dark);
  shoulder.add(shJoint);
  const upper = rbox(0.075, 0.075, 0.36, 0.035, white);
  upper.position.z = 0.17;
  shoulder.add(upper);
  const elbow = new THREE.Group();
  elbow.position.z = 0.34;
  shoulder.add(elbow);
  elbow.add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), dark));
  const fore = rbox(0.06, 0.06, 0.3, 0.028, white);
  fore.position.z = 0.15;
  elbow.add(fore);
  const wrist = new THREE.Group();
  wrist.position.z = 0.3;
  elbow.add(wrist);
  wrist.add(rbox(0.07, 0.05, 0.05, 0.015, dark));
  const fingers = [1, -1].map(s => {
    const f = rbox(0.016, 0.05, 0.085, 0.006, dark);
    f.position.set(s * 0.035, 0, 0.06);
    wrist.add(f);
    return f;
  });
  const grip = new THREE.Object3D();
  grip.position.set(0, -0.0, 0.075);
  wrist.add(grip);
  const shadow = blob(0.42, 0.38);
  root.add(shadow);
  root.userData.dynamic = true;

  const arm = { ...ARM.stow };
  const apply = () => {
    shoulder.rotation.set(arm.sh, arm.yaw, 0);
    elbow.rotation.x = arm.el;
    // keep the wrist level so a held cup stays upright
    wrist.rotation.x = -(arm.sh + arm.el);
    fingers[0].position.x = 0.022 + arm.open * 0.02;
    fingers[1].position.x = -0.022 - arm.open * 0.02;
  };
  apply();
  const actor = {
    root, pan, tilt, eye, grip, led, lens, shoulder,
    place(x, z, yaw = 0) { root.position.set(x, 0, z); root.rotation.y = yaw; },
    setArm(name, ms = 700) {
      const from = { ...arm };
      const to = typeof name === 'string' ? ARM[name] : name;
      return view.animate(ms, k => { for (const key of Object.keys(to)) arm[key] = from[key] + (to[key] - from[key]) * k; apply(); });
    },
    look(tiltX = 0, panY = 0, ms = 400) {
      const t0 = tilt.rotation.x, p0 = pan.rotation.y;
      return view.animate(ms, k => { tilt.rotation.x = t0 + (tiltX - t0) * k; pan.rotation.y = p0 + (panY - p0) * k; });
    },
    setLed(state) { ledMat.color.set({ ok: '#7fd1ff', wait: '#f2c14e', stop: '#ff6b5a', done: '#8be0a4', off: '#2a2d33' }[state] || state); },
    setCamera(on) { lensMat.color.set(on === 'off' ? '#1a1c20' : on === 'fault' ? '#ff5d4d' : '#58b7ff'); },
    /** Drive along [[x, z], ...]; turns on the spot, then rolls. */
    async drive(points, { speed = 0.75, face = null } = {}) {
      const e0 = view.epoch;
      let prev = [root.position.x, root.position.z];
      for (const [x, z] of points) {
        const dist = Math.hypot(x - prev[0], z - prev[1]);
        if (dist < 0.01) continue;
        await turnTo(root, Math.atan2(x - prev[0], z - prev[1]), view, 280);
        if (view.epoch !== e0) return;
        const [x0, z0] = prev;
        await view.animate((dist / speed) * 1000, k => { root.position.x = x0 + (x - x0) * k; root.position.z = z0 + (z - z0) * k; }, k => (k < 0.15 ? k * k / 0.3 : k > 0.85 ? 1 - (1 - k) * (1 - k) / 0.3 : (k - 0.075) / 0.85));
        prev = [x, z];
        if (view.epoch !== e0) return;
      }
      if (face !== null) await turnTo(root, face, view, 320);
    },
    shake(ms = 420, amp = 0.025) {
      const x0 = root.position.x, z0 = root.position.z;
      return view.animate(ms, k => { const s = Math.sin(k * Math.PI * 9) * amp * (1 - k); root.position.x = x0 + s; root.position.z = z0 + s * 0.6; }, k => k).then(() => { root.position.x = x0; root.position.z = z0; });
    }
  };
  return actor;
}

// ---------- the care-home service robot: base, slim body, chest screen and camera head, no arms ----------
export function serviceRobot(view, { body = '#f4efe6' } = {}) {
  const white = mat(body, { rough: 0.35 });
  const dark = mat('#2c3036', { rough: 0.4, metal: 0.2 });
  const root = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.31, 0.26, 40), white);
  base.position.y = 0.15; base.castShadow = true;
  root.add(base);
  const skirt = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.022, 10, 40), dark);
  skirt.rotation.x = Math.PI / 2; skirt.position.y = 0.04;
  root.add(skirt);
  const bodyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.62, 8, 24), white);
  bodyMesh.position.y = 0.68; bodyMesh.scale.z = 0.8; bodyMesh.castShadow = true;
  root.add(bodyMesh);
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 160;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.125), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  screen.position.set(0, 0.74, 0.132);
  screen.rotation.x = -0.12;
  screen.userData.noGlow = true;
  root.add(screen);
  const pan = new THREE.Group();
  pan.position.y = 1.16;
  root.add(pan);
  const headShell = rbox(0.24, 0.17, 0.2, 0.07, white);
  headShell.position.y = 0.06;
  pan.add(headShell);
  const visor = rbox(0.19, 0.08, 0.02, 0.03, mat('#14171c', { rough: 0.2, metal: 0.3 }));
  visor.position.set(0, 0.07, 0.096);
  pan.add(visor);
  const lensMat = new THREE.MeshBasicMaterial({ color: '#7cc8ff', toneMapped: false });
  for (const s of [1, -1]) {
    const e = new THREE.Mesh(new THREE.CircleGeometry(0.016, 18), lensMat);
    e.position.set(s * 0.045, 0.07, 0.107);
    e.userData.noGlow = true;
    pan.add(e);
  }
  const eye = new THREE.Object3D();
  eye.position.set(0, 0.07, 0.12);
  pan.add(eye);
  const ledMat = new THREE.MeshBasicMaterial({ color: '#7fd1ff', toneMapped: false });
  const led = new THREE.Mesh(new THREE.TorusGeometry(0.262, 0.007, 8, 48), ledMat);
  led.rotation.x = Math.PI / 2; led.position.y = 0.285;
  root.add(led);
  root.add(blob(0.45, 0.38));
  root.userData.dynamic = true;
  const ctx = canvas.getContext('2d');
  const actor = {
    root, pan, eye,
    place(x, z, yaw = 0) { root.position.set(x, 0, z); root.rotation.y = yaw; },
    setScreen(lines = [], tone = 'calm') {
      ctx.fillStyle = tone === 'warn' ? '#3a2a12' : '#10202c';
      ctx.fillRect(0, 0, 256, 160);
      ctx.fillStyle = tone === 'warn' ? '#ffd27a' : '#bfe6ff';
      ctx.font = '600 26px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      lines.slice(0, 3).forEach((line, i) => ctx.fillText(line, 128, 52 + i * 38));
      tex.needsUpdate = true;
    },
    setLed(state) { ledMat.color.set({ ok: '#7fd1ff', wait: '#f2c14e', stop: '#ff6b5a', done: '#8be0a4' }[state] || state); },
    drive: null,
    look(panY = 0, ms = 400) { const p0 = pan.rotation.y; return view.animate(ms, k => { pan.rotation.y = p0 + (panY - p0) * k; }); }
  };
  actor.drive = async (points, { speed = 0.7, face = null } = {}) => {
    const e0 = view.epoch;
    let prev = [root.position.x, root.position.z];
    for (const [x, z] of points) {
      const dist = Math.hypot(x - prev[0], z - prev[1]);
      if (dist < 0.01) continue;
      await turnTo(root, Math.atan2(x - prev[0], z - prev[1]), view, 300);
      if (view.epoch !== e0) return;
      const [x0, z0] = prev;
      await view.animate((dist / speed) * 1000, k => { root.position.x = x0 + (x - x0) * k; root.position.z = z0 + (z - z0) * k; });
      prev = [x, z];
      if (view.epoch !== e0) return;
    }
    if (face !== null) await turnTo(root, face, view, 320);
  };
  actor.setScreen(['Hello']);
  return actor;
}

/** Move an object to a new parent without a jump, then glide it to `local` in that parent. */
export async function handOver(view, obj, parent, local = [0, 0, 0], ms = 500) {
  const world = new THREE.Vector3();
  obj.getWorldPosition(world);
  parent.attach(obj);
  const from = obj.position.clone();
  const to = new THREE.Vector3(...local);
  const r0 = obj.rotation.clone();
  await view.animate(ms, k => { obj.position.lerpVectors(from, to, k); obj.rotation.set(r0.x * (1 - k), r0.y * (1 - k), r0.z * (1 - k)); });
}
