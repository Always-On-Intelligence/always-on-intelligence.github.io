// Small versions of the episode cast for the island hero: the same people (clothes, hair, glasses,
// earbuds) and robots as the rooms in scenes/, at about a twentieth of the triangles. Everything is
// coloured per vertex with a few shared materials, so a whole building, its furniture and its people
// merge into a handful of meshes. Joints follow poses.mjs, so the rooms' poses work here too.
import * as THREE from 'three';
import { Z, poseValues } from './poses.mjs';
import { mergeChildren } from './merge.mjs';

/** Shared materials: matte, satin (plastic, painted metal) and lit (screens, lamps, LEDs). */
export const VC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0 });
export const VC_SATIN = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.12 });
export const VC_LIT = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

/** Colour every vertex of a geometry (in the linear working space, like material colours). */
export function paint(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** A painted mesh placed in its parent. */
export function piece(geo, color, { x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, finish = 'matte', shadow = true } = {}) {
  const m = new THREE.Mesh(paint(geo, color), finish === 'lit' ? VC_LIT : finish === 'satin' ? VC_SATIN : VC);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.set(rx, ry, rz);
  m.castShadow = shadow && finish !== 'lit';
  m.receiveShadow = finish !== 'lit';
  return m;
}

const cap = (r, len, radial = 7) => new THREE.CapsuleGeometry(r, len, 2, radial);
const ball = (r, w = 10, h = 7) => new THREE.SphereGeometry(r, w, h);
const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

// the average colour of a texture drawn on a canvas, so textured kit pieces keep their tone
const AVERAGE = new Map();
function averageColor(tex) {
  if (AVERAGE.has(tex.uuid)) return AVERAGE.get(tex.uuid);
  let out = null;
  const img = tex.image;
  if (img && img.width) {
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, 8, 8);
    const d = ctx.getImageData(0, 0, 8, 8).data;
    let r = 0, g = 0, b = 0, a = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; a += d[i + 3]; }
    if (a / 64 > 8) out = new THREE.Color().setRGB(r / 64 / 255, g / 64 / 255, b / 64 / 255, THREE.SRGBColorSpace);
  }
  AVERAGE.set(tex.uuid, out);
  return out;
}

/**
 * Re-colour meshes built with kit.mjs materials as vertex colours on the shared materials, so they
 * merge with the rest. Lit and see-through materials keep their own material.
 */
export function bake(root) {
  root.traverse(o => {
    if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
    const m = o.material;
    if (m.vertexColors || m.transparent || m.blending === THREE.AdditiveBlending || m.isSpriteMaterial) return;
    const lit = m.isMeshBasicMaterial || (m.emissive && m.emissiveIntensity > 0.3 && m.emissive.getHex() !== 0);
    const tone = m.map ? averageColor(m.map) : null;
    const base = tone ? tone.clone().multiply(m.color) : m.color;
    const color = lit && m.emissive && !m.isMeshBasicMaterial ? m.emissive.clone().lerp(base, 0.25) : base;
    o.geometry = paint(o.geometry.clone(), color);
    o.material = lit ? VC_LIT : (m.roughness ?? 0.8) < 0.5 || (m.metalness ?? 0) > 0.3 ? VC_SATIN : VC;
    if (lit) { o.castShadow = false; o.receiveShadow = false; }
  });
  return root;
}

/**
 * A small person. o: shirt, pants, skin, hair, hairStyle ('short' | 'curly' | 'bob' | 'ponytail' |
 * 'bun' | 'crop' | 'long'), shoes, glasses, earbuds, beard, cardigan or jacket, backpack, pose.
 */
export function miniPerson(o = {}) {
  o = { shirt: '#5f6d7e', pants: '#2b3340', skin: '#e0ac85', hair: '#2c211a', hairStyle: 'short', shoes: '#26282c', pose: 'stand', ...o };
  const outer = o.cardigan || o.jacket || null;
  const sleeve = outer || o.shirt;
  const root = new THREE.Group();
  const pelvis = new THREE.Group();
  root.add(pelvis);
  pelvis.add(piece(new THREE.CylinderGeometry(0.135, 0.14, 0.17, 9), o.pants, { y: 0.04, sz: 0.72 }));
  const spine = new THREE.Group();
  pelvis.add(spine);
  spine.add(piece(cap(0.15, 0.24, 9), outer || o.shirt, { y: 0.33, sz: 0.68 }));
  if (outer) spine.add(piece(new THREE.BoxGeometry(0.09, 0.34, 0.02), o.shirt, { y: 0.33, z: 0.098, shadow: false }));
  if (o.backpack) spine.add(piece(new THREE.BoxGeometry(0.24, 0.3, 0.12), o.backpack, { y: 0.32, z: -0.15 }));
  const neck = new THREE.Group();
  neck.position.y = 0.53;
  spine.add(neck);
  neck.add(piece(new THREE.CylinderGeometry(0.042, 0.046, 0.1, 7), o.skin, { y: 0.04, shadow: false }));
  const head = new THREE.Group();
  head.position.y = 0.155;
  head.scale.setScalar(1.1);
  neck.add(head);
  head.add(piece(ball(0.104, 12, 9), o.skin, { sy: 1.1, sz: 1.04 }));
  for (const s of [1, -1]) head.add(piece(ball(0.012, 6, 4), '#22201e', { x: s * 0.036, y: 0.012, z: 0.098, shadow: false }));
  hair(head, o.hairStyle, o.hair);
  if (o.beard) head.add(piece(new THREE.SphereGeometry(0.086, 12, 6, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.5, Math.PI * 0.4), o.hair, { y: -0.03, z: 0.02, sx: 1.05 }));
  if (o.glasses) head.add(piece(new THREE.BoxGeometry(0.17, 0.034, 0.016), typeof o.glasses === 'string' ? o.glasses : '#23252a', { y: 0.016, z: 0.104, finish: 'satin', shadow: false }));
  if (o.earbuds) for (const s of [1, -1]) head.add(piece(ball(0.014, 6, 4), typeof o.earbuds === 'string' ? o.earbuds : '#f2f2f0', { x: s * 0.106, y: -0.004, z: 0.012, finish: 'satin', shadow: false }));
  // a lit glasses display and an earbud cue that the island switches on and off
  let hud = null, cue = null;
  if (o.hud) {
    hud = piece(new THREE.BoxGeometry(0.07, 0.045, 0.006), o.hud, { x: -0.04, y: 0.02, z: 0.118, finish: 'lit' });
    hud.userData.noMerge = true;
    hud.visible = false;
    head.add(hud);
  }
  if (o.cue) {
    cue = piece(ball(0.05, 8, 6), o.cue, { x: 0.13, y: 0.0, z: 0.0, finish: 'lit' });
    cue.userData.noMerge = true;
    cue.visible = false;
    head.add(cue);
  }

  const arm = side => {
    const sh = new THREE.Group();
    sh.position.set(side * 0.2, 0.465, 0);
    spine.add(sh);
    sh.add(piece(cap(0.047, 0.22), sleeve, { y: -0.14 }));
    const el = new THREE.Group();
    el.position.y = -0.29;
    sh.add(el);
    el.add(piece(cap(0.039, 0.18), o.shortSleeves ? o.skin : sleeve, { y: -0.11 }));
    el.add(piece(ball(0.043, 8, 6), o.skin, { y: -0.27, sx: 0.8, shadow: false }));
    return { sh, el };
  };
  const L = arm(1), R = arm(-1);
  const leg = side => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.085, 0, 0);
    pelvis.add(hip);
    hip.add(piece(cap(0.068, 0.3), o.pants, { y: -0.21 }));
    const knee = new THREE.Group();
    knee.position.y = -0.43;
    hip.add(knee);
    knee.add(piece(cap(0.054, 0.3), o.pants, { y: -0.2 }));
    knee.add(piece(new THREE.BoxGeometry(0.1, 0.07, 0.24), o.shoes, { y: -0.43, z: 0.045 }));
    return { hip, knee };
  };
  const LL = leg(1), RL = leg(-1);
  const state = { ...Z };
  const joints = { pelvis, spine, neck, head, lSh: L.sh, lEl: L.el, rSh: R.sh, rEl: R.el, lHip: LL.hip, lKnee: LL.knee, rHip: RL.hip, rKnee: RL.knee };
  const actor = {
    root, joints, hud, cue,
    /**
     * Let these joints move (for example 'neck', 'lSh', 'rSh', 'lHip'): they stay out of the building's
     * merge, one mesh per joint, without shadows; everything else of the figure merges with the room.
     */
    live(...names) {
      for (const name of names) {
        const j = joints[name];
        j.userData.dynamic = true;
        const groups = [];
        j.traverse(o => { if (o.isMesh) o.castShadow = false; if (o.isGroup) groups.push(o); });
        for (const g of groups) mergeChildren(g);
      }
      return actor;
    },
    /** Pose offsets from the figure's base pose, for one frame. */
    move(delta) { actor.apply({ ...actor.base, ...delta }); },
    apply(v) {
      pelvis.position.y = v.pelvisY;
      spine.rotation.x = v.lean;
      neck.rotation.set(v.neckX, v.neckY, 0);
      L.sh.rotation.set(v.lShX, 0, v.lShZ); L.el.rotation.x = v.lEl;
      R.sh.rotation.set(v.rShX, 0, v.rShZ); R.el.rotation.x = v.rEl;
      LL.hip.rotation.x = v.lHip; LL.knee.rotation.x = v.lKnee;
      RL.hip.rotation.x = v.rHip; RL.knee.rotation.x = v.rKnee;
    },
    pose(name) { Object.assign(state, poseValues(name)); actor.base = { ...state }; actor.apply(state); return actor; },
    /** One step of a walk cycle at stride phase s (radians). */
    stride(s) {
      const k = Math.sin(s);
      actor.apply({ ...state, lHip: k * 0.42, rHip: -k * 0.42, lKnee: Math.max(0, -k) * 0.55, rKnee: Math.max(0, k) * 0.55, lShX: -k * 0.32, rShX: k * 0.32, lEl: -0.25, rEl: -0.25, pelvisY: Z.pelvisY + Math.abs(Math.cos(s)) * 0.022 });
    },
    place(x, y, z, yaw = 0) { root.position.set(x, y, z); root.rotation.y = yaw; return actor; }
  };
  actor.pose(o.pose);
  return actor;
}

function hair(head, style, color) {
  const add = (geo, opts) => head.add(piece(geo, color, opts));
  // the cap covers the crown, the back piece the back of the head
  add(new THREE.SphereGeometry(0.112, 12, 5, 0, Math.PI * 2, 0, Math.PI * 0.46), { y: 0.008, z: -0.006, sy: 1.12, sz: 1.06, rx: -0.18 });
  add(new THREE.SphereGeometry(0.109, 10, 5, Math.PI * 1.08, Math.PI * 0.84, Math.PI * 0.3, Math.PI * 0.38), { sy: 1.1, sz: 1.05 });
  if (style === 'short' || style === 'curly') add(new THREE.BoxGeometry(0.15, 0.03, 0.05), { y: 0.082, z: 0.06, rx: 0.5 });
  if (style === 'curly') {
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; add(ball(0.04, 7, 5), { x: Math.cos(a) * 0.08, y: 0.08, z: Math.sin(a) * 0.08 - 0.01 }); }
    add(ball(0.07, 9, 6), { y: 0.12, z: -0.01 });
  } else if (style === 'bob' || style === 'long') {
    add(new THREE.SphereGeometry(0.124, 12, 7, Math.PI * 0.5 + 0.75, Math.PI * 2 - 1.5, Math.PI * 0.12, Math.PI * (style === 'long' ? 0.62 : 0.5)), { y: style === 'long' ? -0.02 : 0, z: -0.004 });
  } else if (style === 'ponytail') {
    add(cap(0.03, 0.13, 6), { y: -0.06, z: -0.13, rx: 0.3 });
  } else if (style === 'bun') {
    add(ball(0.052, 8, 6), { y: 0.11, z: -0.07 });
  }
}

/** The home robot of robot-cup: wheeled base, column, camera head, one arm; arm 'offer' holds a cup. */
export function miniHomeRobot({ arm = 'offer', cup = '#d08f3a' } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const white = '#f3f2ee', dark = '#2f3a4a';
  body.add(piece(new THREE.CylinderGeometry(0.27, 0.29, 0.2, 18), white, { y: 0.13, finish: 'satin' }));
  body.add(piece(new THREE.CylinderGeometry(0.295, 0.295, 0.05, 18), '#1c1d20', { y: 0.05 }));
  body.add(piece(new THREE.TorusGeometry(0.255, 0.012, 4, 24), '#7fd1ff', { y: 0.235, rx: Math.PI / 2, finish: 'lit' }));
  body.add(piece(new THREE.CylinderGeometry(0.07, 0.085, 0.86, 12), white, { y: 0.66, finish: 'satin' }));
  body.add(piece(new THREE.BoxGeometry(0.21, 0.15, 0.18), white, { y: 1.19, finish: 'satin' }));
  body.add(piece(new THREE.BoxGeometry(0.16, 0.1, 0.02), '#15181d', { y: 1.19, z: 0.09, finish: 'satin', shadow: false }));
  body.add(piece(new THREE.CircleGeometry(0.026, 10), '#58b7ff', { x: -0.035, y: 1.19, z: 0.101, finish: 'lit' }));
  // arm from the front of the column: shoulder pitch, then the forearm
  const sh = new THREE.Group();
  sh.position.set(0, 0.86, 0.09);
  g.add(sh);
  // the same joint angles as rig.mjs: a positive shoulder angle lowers the arm, the wrist stays level
  const [a0, a1] = { offer: [0.38, 0], stow: [1.35, -2.45], carry: [1.0, -1.6] }[arm] || [0.38, 0];
  sh.rotation.x = a0;
  sh.add(piece(new THREE.BoxGeometry(0.075, 0.075, 0.36), white, { z: 0.17, finish: 'satin' }));
  const el = new THREE.Group();
  el.position.z = 0.34;
  el.rotation.x = a1;
  sh.add(el);
  el.add(piece(new THREE.BoxGeometry(0.06, 0.06, 0.3), white, { z: 0.15, finish: 'satin' }));
  const wrist = new THREE.Group();
  wrist.position.z = 0.3;
  wrist.rotation.x = -(a0 + a1);
  el.add(wrist);
  wrist.add(piece(new THREE.BoxGeometry(0.08, 0.05, 0.06), dark, { finish: 'satin' }));
  for (const s of [1, -1]) wrist.add(piece(new THREE.BoxGeometry(0.016, 0.05, 0.085), dark, { x: s * 0.05, z: 0.06, finish: 'satin', shadow: false }));
  let held = null;
  if (cup) { held = piece(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 10), cup, { y: -0.005, z: 0.075 }); held.userData.noMerge = true; wrist.add(held); }
  /** Shoulder and elbow angles as in rig.mjs ARM; the wrist stays level. */
  g.userData.setArm = (s0, s1) => { sh.rotation.x = s0; el.rotation.x = s1; wrist.rotation.x = -(s0 + s1); };
  g.userData.cup = held;
  g.userData.arm = sh;
  return g;
}

/** The care home's service robot: rounded body, a screen on the chest and a visor with two eyes. */
export function miniServiceRobot() {
  const g = new THREE.Group();
  const white = '#f4efe6';
  g.add(piece(new THREE.CylinderGeometry(0.26, 0.31, 0.26, 18), white, { y: 0.15, finish: 'satin' }));
  g.add(piece(new THREE.CylinderGeometry(0.31, 0.31, 0.05, 18), '#2c3036', { y: 0.04 }));
  g.add(piece(cap(0.16, 0.62, 12), white, { y: 0.68, sz: 0.8, finish: 'satin' }));
  g.add(piece(new THREE.PlaneGeometry(0.2, 0.125), '#9fd8ff', { y: 0.74, z: 0.133, rx: -0.12, finish: 'lit' }));
  g.add(piece(new THREE.BoxGeometry(0.24, 0.17, 0.2), white, { y: 1.22, finish: 'satin' }));
  g.add(piece(new THREE.BoxGeometry(0.19, 0.08, 0.02), '#14171c', { y: 1.23, z: 0.1, finish: 'satin', shadow: false }));
  for (const s of [1, -1]) g.add(piece(new THREE.CircleGeometry(0.016, 8), '#7cc8ff', { x: s * 0.045, y: 1.23, z: 0.112, finish: 'lit' }));
  g.add(piece(new THREE.TorusGeometry(0.262, 0.01, 4, 24), '#7fd1ff', { y: 0.285, rx: Math.PI / 2, finish: 'lit' }));
  return g;
}

export { shade };
