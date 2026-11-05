// People for the dioramas: a stylized but proportioned figure with a shaped torso, clothing layers
// (collar, cuffs, belt, an open jacket or cardigan), mitten hands with a thumb, shoes with soles, and a
// face that blinks and moves its mouth when talking. Joints follow poses.mjs, so any pose works.
import * as THREE from 'three';
import { mat, roundedBoxGeometry, blob, canvasTex } from './kit.mjs';
import { Z, poseValues, turnTo } from './poses.mjs';
import { mergeChildren } from './merge.mjs';

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();

// ---------- shared textures ----------
let FABRIC = null, KNIT = null, DENIM = null;
function fabricTex() {
  if (FABRIC) return FABRIC;
  FABRIC = canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const x = (i / 4) % w, y = Math.floor(i / 4 / w);
      const weave = ((x + y) % 4 < 2 ? 6 : -6) + ((x * 7 + y * 13) % 11) - 5;
      const v = 236 + weave;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
  }, { repeat: [6, 6] });
  return FABRIC;
}
function knitTex() {
  if (KNIT) return KNIT;
  KNIT = canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.09)'; ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 8) { ctx.beginPath(); for (let y = 0; y <= h; y += 8) { ctx.lineTo(x + (y / 8) % 2 * 4, y); } ctx.stroke(); }
  }, { repeat: [8, 8] });
  return KNIT;
}
function denimTex() {
  if (DENIM) return DENIM;
  DENIM = canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1;
    for (let k = -h; k < w; k += 4) { ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + h, h); ctx.stroke(); }
  }, { repeat: [6, 10] });
  return DENIM;
}

let STRANDS = null;
function strandTex() {
  if (STRANDS) return STRANDS;
  STRANDS = canvasTex(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x++) {
      const v = 200 + Math.round(Math.sin(x * 1.7) * 18 + Math.sin(x * 0.37) * 22 + ((x * 37) % 13) * 2);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, 0, 1, h);
    }
  }, { repeat: [3, 1] });
  return STRANDS;
}
const hairCache = new Map();
function hairMaterial(color) {
  if (hairCache.has(color)) return hairCache.get(color);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.04, map: strandTex() });
  hairCache.set(color, m);
  return m;
}

const clothCache = new Map();
function cloth(color, kind = 'fabric') {
  const key = color + kind;
  if (clothCache.has(key)) return clothCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: kind === 'knit' ? 0.95 : 0.86, map: kind === 'knit' ? knitTex() : kind === 'denim' ? denimTex() : fabricTex() });
  clothCache.set(key, m);
  return m;
}
const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

// ---------- shapes ----------
function lathe(points, segments = 28) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);
}
function part(geometry, material, { x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, shadow = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.set(rx, ry, rz);
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}
const sphereGeo = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
/** A limb segment hanging from its joint: tapered from rTop to rBottom over len, with flat ends so two
 * segments that overlap at a joint read as one limb when straight. */
function limb(rTop, rBottom, len) {
  const pts = [[0, 0], [rTop * 0.92, 0], [rTop, -0.01]];
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    pts.push([rTop + (rBottom - rTop) * t, -0.01 - t * (len - 0.02)]);
  }
  pts.push([rBottom * 0.92, -len], [0, -len]);
  return lathe(pts, 18);
}

/**
 * A person. opts: shirt, pants, skin, hair, hairStyle ('short' | 'curly' | 'bob' | 'ponytail' | 'bun' | 'crop' | 'long'),
 * shoes, glasses (true or a color), earbuds, beard, cardigan or jacket (a color), shortSleeves, knit, scale.
 */
export function person(view, opts = {}) {
  const o = { shirt: '#5f6d7e', pants: '#2b3340', skin: '#e0ac85', hair: '#2c211a', hairStyle: 'short', shoes: '#26282c', scale: 1, ...opts };
  const outer = o.cardigan || o.jacket || null;
  const shirtM = cloth(o.shirt, o.knit ? 'knit' : 'fabric');
  const outerM = outer ? cloth(outer, o.cardigan ? 'knit' : 'fabric') : null;
  const sleeveM = outerM || shirtM;
  const pantsM = cloth(o.pants, o.denim ? 'denim' : 'fabric');
  const skinM = mat(o.skin, { rough: 0.55 });
  const blushM = mat(new THREE.Color(o.skin).lerp(new THREE.Color('#e88a7a'), 0.18).getStyle(), { rough: 0.6 });
  const hairM = hairMaterial(o.hair);
  const browM = mat(shade(o.hair, 0.8), { rough: 0.7 });
  const shoeM = mat(o.shoes, { rough: 0.55 });
  const soleM = mat('#e9e6df', { rough: 0.7 });
  const scleraM = mat('#f4f1ea', { rough: 0.35 });
  const irisM = mat(o.eyes || '#3a2a1f', { rough: 0.2 });
  const shineM = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const lipM = mat(shade(o.skin, 0.72), { rough: 0.55 });

  const root = new THREE.Group();
  const pelvis = new THREE.Group();
  root.add(pelvis);

  // hips and belt (pants), torso (shirt), optional open outer layer
  pelvis.add(part(lathe([[0, -0.045], [0.1, -0.042], [0.138, -0.02], [0.146, 0.04], [0.14, 0.11], [0.136, 0.13], [0, 0.13]]), pantsM, { sz: 0.7 }));
  pelvis.add(part(new THREE.TorusGeometry(0.137, 0.008, 8, 32), mat(shade(o.pants, 0.55), { rough: 0.45 }), { y: 0.118, rx: Math.PI / 2, sy: 0.7 }));
  const spine = new THREE.Group();
  pelvis.add(spine);
  const torsoProfile = [[0, 0.1], [0.136, 0.1], [0.131, 0.2], [0.14, 0.28], [0.158, 0.36], [0.17, 0.42], [0.168, 0.465], [0.13, 0.51], [0.07, 0.535], [0, 0.545]];
  spine.add(part(lathe(torsoProfile), shirtM, { sz: 0.68 }));
  if (outer) {
    // an open front: the lathe leaves a wedge facing +z
    const open = new THREE.LatheGeometry(torsoProfile.slice(1, 8).map(([r, y]) => new THREE.Vector2(r + 0.012, y)), 28, Math.PI * 0.12, Math.PI * 1.76);
    spine.add(part(open, outerM, { sz: 0.7 }));
    outerM.side = THREE.DoubleSide;
    for (const s of [1, -1]) spine.add(part(roundedBoxGeometry(0.035, 0.2, 0.012, 0.005), outerM, { x: s * 0.05, y: 0.38, z: 0.108, rz: s * -0.25, ry: s * 0.15 }));
  }
  if (o.buttons) {
    spine.add(part(roundedBoxGeometry(0.02, 0.3, 0.006, 0.002), mat(shade(o.shirt, 0.92), { rough: 0.8 }), { y: 0.36, z: outer ? 0.104 : 0.106, shadow: false }));
    for (let k = 0; k < 4; k++) spine.add(part(new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 10), mat('#f2efe8', { rough: 0.4 }), { y: 0.25 + k * 0.075, z: outer ? 0.108 : 0.11, rx: Math.PI / 2, shadow: false }));
  }
  // collar
  spine.add(part(new THREE.TorusGeometry(0.058, 0.016, 8, 24, Math.PI * 1.5), o.shortSleeves ? shirtM : mat(o.collar || shade(o.shirt, 1.12), { rough: 0.8 }), { y: 0.525, rx: Math.PI / 2 + 0.25, rz: Math.PI * 0.25 + Math.PI }));

  const neck = new THREE.Group();
  neck.position.y = 0.53;
  spine.add(neck);
  neck.add(part(new THREE.CylinderGeometry(0.04, 0.046, 0.1, 16), skinM, { y: 0.04 }));
  const head = new THREE.Group();
  head.position.y = 0.155;
  head.scale.setScalar(1.1);
  neck.add(head);
  head.add(part(sphereGeo(0.104, 28, 20), skinM, { sy: 1.1, sz: 1.04 }));
  head.add(part(sphereGeo(0.072, 20, 14), skinM, { y: -0.052, z: 0.022, sx: 1.05, sy: 0.9 }));
  // face
  head.add(part(sphereGeo(0.016, 12, 10), skinM, { y: -0.004, z: 0.104, sx: 0.85, sy: 1.35, sz: 1.1 }));
  for (const s of [1, -1]) head.add(part(sphereGeo(0.024, 12, 10), skinM, { x: s * 0.103, y: 0.0, z: -0.006, sx: 0.55, sy: 1.25 }));
  const eyes = [1, -1].map(s => {
    const e = new THREE.Group();
    e.position.set(s * 0.037, 0.016, 0.095);
    e.rotation.y = s * 0.32;
    e.add(part(sphereGeo(0.0132, 14, 10), scleraM, { sy: 1.05, sz: 0.62, shadow: false }));
    e.add(part(sphereGeo(0.0088, 14, 10), irisM, { z: 0.0062, sy: 1.08, sz: 0.5, shadow: false }));
    const shine = part(sphereGeo(0.0019, 8, 6), shineM, { x: 0.0028, y: 0.0035, z: 0.0108, shadow: false });
    shine.userData.noAO = true;
    e.add(shine);
    head.add(e);
    return e;
  });
  // upper lids: a little skin above each eye gives the face a calmer look
  for (const s of [1, -1]) head.add(part(new THREE.SphereGeometry(0.0145, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.3), skinM, { x: s * 0.037, y: 0.019, z: 0.094, ry: s * 0.32, rx: 0.42, sz: 0.7, shadow: false }));
  for (const s of [1, -1]) head.add(part(roundedBoxGeometry(0.03, 0.007, 0.008, 0.003), browM, { x: s * 0.039, y: 0.044, z: 0.093, rz: s * -0.12, ry: s * 0.25, shadow: false }));
  for (const s of [1, -1]) head.add(part(sphereGeo(0.017, 12, 8), blushM, { x: s * 0.057, y: -0.024, z: 0.0835, ry: s * 0.55, sz: 0.22, shadow: false }));
  const mouth = part(new THREE.CapsuleGeometry(0.0045, 0.022, 4, 8), lipM, { y: -0.048, z: 0.1, rz: Math.PI / 2, shadow: false });
  head.add(mouth);
  hair(head, o.hairStyle, hairM);
  if (o.beard) {
    head.add(part(new THREE.SphereGeometry(0.082, 20, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.42), hairM, { y: -0.035, z: 0.018, sx: 1.1, sy: 1.05, sz: 1.0 }));
    for (const s2 of [1, -1]) head.add(part(sphereGeo(0.019, 14, 10), hairM, { x: s2 * 0.014, y: -0.034, z: 0.099, sx: 1.25, sy: 0.42, sz: 0.5, rz: s2 * 0.28, shadow: false }));
  }

  let glassesDisplay = null;
  if (o.glasses) {
    const frameM = mat(typeof o.glasses === 'string' ? o.glasses : '#23252a', { rough: 0.3, metal: 0.5 });
    const lensM = new THREE.MeshStandardMaterial({ color: '#2a3442', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.35 });
    const g = new THREE.Group();
    g.position.set(0, 0.018, 0.112);
    const rim = rimGeometry(0.046, 0.032, 0.0055);
    for (const s of [1, -1]) {
      g.add(part(rim, frameM, { x: s * 0.037, shadow: false }));
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.026), lensM);
      lens.position.set(s * 0.037, 0, 0.001);
      lens.userData.noAO = true;
      g.add(lens);
      g.add(part(roundedBoxGeometry(0.006, 0.006, 0.113, 0.002), frameM, { x: s * 0.083, y: 0.004, z: -0.052, ry: -s * 0.38, shadow: false }));
    }
    g.add(part(roundedBoxGeometry(0.022, 0.005, 0.005, 0.002), frameM, { y: 0.006, shadow: false }));
    const dispMat = new THREE.MeshBasicMaterial({ color: '#9fe8c8', transparent: true, opacity: 0, toneMapped: false });
    glassesDisplay = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.013), dispMat);
    glassesDisplay.position.set(-0.04, 0.004, 0.003);
    glassesDisplay.userData.noGlow = true;
    g.add(glassesDisplay);
    head.add(g);
  }
  const buds = [];
  if (o.earbuds) {
    for (const s of [1, -1]) {
      const bud = part(new THREE.CapsuleGeometry(0.009, 0.014, 4, 8), mat(typeof o.earbuds === 'string' ? o.earbuds : '#e9eaec', { rough: 0.25 }), { x: s * 0.106, y: -0.006, z: 0.01, rx: 0.3, shadow: false });
      head.add(bud);
      buds.push(bud);
    }
  }

  // arms
  const arm = side => {
    const sh = new THREE.Group();
    sh.position.set(side * 0.2, 0.465, 0);
    spine.add(sh);
    sh.add(part(sphereGeo(0.047, 16, 12), sleeveM, { x: -side * 0.014, y: -0.004, sz: 0.92 }));
    sh.add(part(limb(0.05, 0.042, 0.305), sleeveM, { y: -0.005 }));
    const el = new THREE.Group();
    el.position.y = -0.29;
    sh.add(el);
    const foreM = o.shortSleeves ? skinM : sleeveM;
    el.add(part(limb(0.041, 0.033, 0.25), foreM, { y: 0.012 }));
    if (!o.shortSleeves) el.add(part(new THREE.TorusGeometry(0.036, 0.009, 8, 20), mat(shade(outer || o.shirt, 0.82), { rough: 0.8 }), { y: -0.225, rx: Math.PI / 2 }));
    el.add(part(new THREE.CylinderGeometry(0.024, 0.026, 0.05, 12), skinM, { y: -0.245 }));
    const hand = new THREE.Group();
    hand.position.y = -0.258;
    el.add(hand);
    hand.add(part(roundedBoxGeometry(0.032, 0.056, 0.056, 0.014), skinM, { y: -0.018 }));
    [[-0.0195, 0.03], [-0.0065, 0.035], [0.0065, 0.033], [0.0195, 0.027]].forEach(([dz, len]) => {
      hand.add(part(new THREE.CapsuleGeometry(0.0074, len, 4, 8), skinM, { x: -side * 0.004, y: -0.046 - len / 2, z: dz, rz: -side * 0.2 }));
    });
    hand.add(part(new THREE.CapsuleGeometry(0.0088, 0.024, 4, 8), skinM, { x: -side * 0.008, y: -0.03, z: 0.028, rx: -0.5, rz: -side * 0.3 }));
    return { sh, el, hand };
  };
  const L = arm(1), R = arm(-1);
  // legs
  const feet = [];
  const leg = side => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.085, 0, 0);
    pelvis.add(hip);
    hip.add(part(limb(0.074, 0.056, 0.45), pantsM, { y: 0.01 }));
    const knee = new THREE.Group();
    knee.position.y = -0.43;
    hip.add(knee);
    knee.add(part(limb(0.055, 0.046, 0.4), pantsM, { y: 0.012 }));
    knee.add(part(new THREE.CylinderGeometry(0.05, 0.053, 0.03, 18), pantsM, { y: -0.39 }));
    const foot = new THREE.Group();
    foot.position.y = -0.43;
    knee.add(foot);
    feet.push(foot);
    foot.add(part(roundedBoxGeometry(0.098, 0.028, 0.255, 0.012), soleM, { y: -0.046, z: 0.045 }));
    foot.add(part(roundedBoxGeometry(0.09, 0.06, 0.2, 0.028), shoeM, { y: -0.012, z: 0.02 }));
    foot.add(part(sphereGeo(0.047, 14, 10), shoeM, { y: -0.02, z: 0.11, sx: 0.96, sy: 0.72, sz: 1.1 }));
    return { hip, knee };
  };
  const LL = leg(1), RL = leg(-1);
  const shadow = blob(0.38, 0.32);
  shadow.userData.noAO = true;
  root.add(shadow);
  // one mesh per material on each joint: a figure goes from about 80 draw calls to about 30
  const keep = new Set([mouth, ...buds]);
  for (const g of [pelvis, spine, neck, head, L.sh, L.el, L.hand, R.sh, R.el, R.hand, LL.hip, LL.knee, RL.hip, RL.knee, ...feet]) mergeChildren(g, keep);
  root.traverse(o => { if (o.isGroup && o.children.every(c => c.isMesh) && o.parent === head) mergeChildren(o); });
  root.userData.dynamic = true;
  // small parts (hands, face details, cuffs) do not need to cast shadows
  root.traverse(o => {
    if (!o.isMesh || !o.castShadow) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    if (o.geometry.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z) < 0.07) o.castShadow = false;
  });

  root.scale.setScalar(o.scale);
  const state = { ...Z };
  let blinkAt = 1 + Math.random() * 3, blinkUntil = 0;
  const actor = {
    root, head, neck, spine, pelvis, handR: R.hand, handL: L.hand, glassesDisplay, buds,
    talking: false, walking: false, phase: Math.random() * 10, lookTarget: null, gest: null, pose: 'stand',
    gesture(kind, ms = 900) { actor.gest = { kind, t0: performance.now(), ms }; return view.wait(ms); },
    lookAt(target) { actor.lookTarget = target; },
    apply(v) {
      pelvis.position.y = v.pelvisY;
      spine.rotation.x = v.lean;
      neck.rotation.set(v.neckX, v.neckY, 0);
      L.sh.rotation.set(v.lShX, 0, v.lShZ); L.el.rotation.x = v.lEl;
      R.sh.rotation.set(v.rShX, 0, v.rShZ); R.el.rotation.x = v.rEl;
      LL.hip.rotation.x = v.lHip; LL.knee.rotation.x = v.lKnee;
      RL.hip.rotation.x = v.rHip; RL.knee.rotation.x = v.rKnee;
    },
    setPose(name, ms = 600) {
      actor.pose = name;
      const from = { ...state };
      const to = poseValues(name);
      return view.animate(ms, k => { for (const key of Object.keys(Z)) state[key] = from[key] + (to[key] - from[key]) * k; });
    },
    async walkTo(points, { speed = 1.1, face = null } = {}) {
      const e0 = view.epoch;
      let prev = [root.position.x, root.position.z];
      actor.walking = true;
      await actor.setPose('stand', 250);
      for (const [x, z] of points) {
        const dist = Math.hypot(x - prev[0], z - prev[1]);
        if (dist < 0.01) continue;
        const yaw0 = root.rotation.y;
        const yaw1 = Math.atan2(x - prev[0], z - prev[1]);
        const dy = Math.atan2(Math.sin(yaw1 - yaw0), Math.cos(yaw1 - yaw0));
        const [x0, z0] = prev;
        await view.animate(Math.max(250, (dist / speed) * 1000), k => {
          root.position.x = x0 + (x - x0) * k;
          root.position.z = z0 + (z - z0) * k;
          root.rotation.y = yaw0 + dy * Math.min(1, k * 3);
          actor.stride = (actor.strideBase || 0) + dist * k * 5.2;
        }, k => k);
        actor.strideBase = actor.stride;
        prev = [x, z];
        if (view.epoch !== e0) break;
      }
      actor.walking = false;
      if (view.epoch !== e0) return;
      if (face !== null) await turnTo(root, face, view, 300);
    },
    place(x, z, yaw = 0) { root.position.set(x, 0, z); root.rotation.y = yaw; },
    setDisplay(color = null) {
      if (!glassesDisplay) return;
      glassesDisplay.material.opacity = color ? 0.95 : 0;
      if (color) glassesDisplay.material.color.set(color);
    }
  };
  const stopLife = view.every((dt, t) => {
    const v = { ...state };
    const ph = actor.phase + t;
    // breathing and small head movements
    v.lean += Math.sin(ph * 1.7) * 0.012;
    v.neckY += Math.sin(ph * 0.6) * 0.05;
    v.neckX += Math.sin(ph * 0.9) * 0.025;
    if (actor.talking) {
      v.neckX += Math.sin(ph * 7) * 0.04;
      v.rShX += Math.sin(ph * 3.1) * 0.12;
      v.rEl += Math.sin(ph * 3.1 + 1) * 0.15;
    }
    if (actor.lookTarget) {
      const tp = actor.lookTarget.isObject3D ? actor.lookTarget.getWorldPosition(_v1) : _v1.copy(actor.lookTarget);
      head.getWorldPosition(_v2);
      const yaw = Math.atan2(tp.x - _v2.x, tp.z - _v2.z) - root.rotation.y;
      v.neckY = Math.max(-1.1, Math.min(1.1, Math.atan2(Math.sin(yaw), Math.cos(yaw))));
      v.neckX = Math.max(-0.5, Math.min(0.7, -Math.atan2(tp.y - _v2.y, Math.hypot(tp.x - _v2.x, tp.z - _v2.z)) - v.lean));
    }
    if (actor.gest) {
      const k = (performance.now() - actor.gest.t0) / actor.gest.ms;
      if (k >= 1) actor.gest = null;
      else if (actor.gest.kind === 'shake') v.neckY += Math.sin(k * Math.PI * 6) * 0.32 * (1 - k);
      else if (actor.gest.kind === 'nod') v.neckX += Math.sin(k * Math.PI * 4) * 0.22 * (1 - k);
      else if (actor.gest.kind === 'flinch') { v.lean -= Math.sin(k * Math.PI) * 0.16; v.neckX -= Math.sin(k * Math.PI) * 0.18; }
    }
    if (actor.walking) {
      const s = Math.sin(actor.stride || 0);
      v.lHip = s * 0.45; v.rHip = -s * 0.45;
      v.lKnee = Math.max(0, -s) * 0.6; v.rKnee = Math.max(0, s) * 0.6;
      v.lShX = -s * 0.35; v.rShX = s * 0.35;
      v.lEl = -0.25; v.rEl = -0.25;
      v.pelvisY = Z.pelvisY + Math.abs(Math.cos(actor.stride || 0)) * 0.025;
    }
    actor.apply(v);
    // blink every few seconds, and move the mouth while talking
    if (t > blinkAt) { blinkUntil = t + 0.12; blinkAt = t + 2.5 + Math.random() * 3.5; }
    const closed = t < blinkUntil ? 0.12 : 1;
    eyes.forEach(e => { e.scale.y = closed; });
    const open = actor.talking ? Math.max(0, Math.sin(ph * 14)) : 0;
    mouth.scale.set(1 + open * 0.25, 1 + open * 1.8, 1);
  });
  actor.apply(state);
  /** Hold the current pose for good: no more per-frame updates, and the figure can be merged. */
  actor.freeze = () => {
    actor.apply({ ...state });
    stopLife();
    root.userData.dynamic = false;
  };
  return actor;
}

/** A rounded-rectangle glasses rim with a hole for the lens. */
function rimGeometry(w, h, t) {
  const rr = (shape, x, y, ww, hh, r) => {
    shape.moveTo(x + r, y); shape.lineTo(x + ww - r, y); shape.quadraticCurveTo(x + ww, y, x + ww, y + r);
    shape.lineTo(x + ww, y + hh - r); shape.quadraticCurveTo(x + ww, y + hh, x + ww - r, y + hh);
    shape.lineTo(x + r, y + hh); shape.quadraticCurveTo(x, y + hh, x, y + hh - r);
    shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  };
  const shape = new THREE.Shape();
  rr(shape, -w / 2, -h / 2, w, h, 0.012);
  const hole = new THREE.Path();
  rr(hole, -w / 2 + t, -h / 2 + t, w - 2 * t, h - 2 * t, 0.008);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -0.003);
  return g;
}

/** Hair on a head of radius ~0.104 centred at the origin. */
function hair(head, style, m) {
  const add = (geo, opts) => head.add(part(geo, m, opts));
  // the cap covers the crown; its rim sits at the hairline
  add(new THREE.SphereGeometry(0.111, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.46), { y: 0.006, z: -0.006, sy: 1.12, sz: 1.06, rx: -0.18 });
  // back of the head (phi = 1.5π faces -z)
  add(new THREE.SphereGeometry(0.109, 22, 12, Math.PI * 1.08, Math.PI * 0.84, Math.PI * 0.3, Math.PI * 0.38), { y: 0, z: -0.004, sy: 1.1, sz: 1.05 });
  if (style === 'crop') return;
  if (style === 'short' || style === 'curly') {
    add(roundedBoxGeometry(0.15, 0.03, 0.05, 0.014), { y: 0.082, z: 0.06, rx: 0.5, rz: 0.08 });
    for (const s of [1, -1]) add(roundedBoxGeometry(0.02, 0.05, 0.05, 0.008), { x: s * 0.1, y: 0.02, z: 0.018 });
  }
  if (style === 'curly') {
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const ring = i % 2;
      add(sphereGeo(0.032 + (i % 3) * 0.006, 10, 8), { x: Math.cos(a) * (0.088 - ring * 0.02), y: 0.06 + ring * 0.04 + (i % 3) * 0.008, z: Math.sin(a) * (0.088 - ring * 0.02) - 0.012 });
    }
    add(sphereGeo(0.065, 14, 10), { y: 0.115, z: -0.01 });
  } else if (style === 'bob') {
    const shell = new THREE.LatheGeometry([[0.112, 0.05], [0.122, 0.0], [0.126, -0.05], [0.122, -0.085], [0.108, -0.092]].map(([r, y]) => new THREE.Vector2(r, y)), 28, Math.PI * 0.22, Math.PI * 1.56);
    m.side = THREE.DoubleSide;
    add(shell, { z: -0.006, sz: 1.04 });
    add(roundedBoxGeometry(0.17, 0.035, 0.05, 0.015), { y: 0.075, z: 0.075, rx: 0.35 });
  } else if (style === 'ponytail') {
    add(sphereGeo(0.035, 12, 10), { y: 0.03, z: -0.112 });
    add(new THREE.CapsuleGeometry(0.03, 0.15, 6, 12), { y: -0.07, z: -0.135, rx: 0.3 });
    add(roundedBoxGeometry(0.14, 0.025, 0.04, 0.01), { y: 0.085, z: 0.066, rx: 0.55 });
  } else if (style === 'bun') {
    add(sphereGeo(0.052, 16, 12), { y: 0.11, z: -0.07 });
    add(new THREE.TorusGeometry(0.03, 0.008, 6, 16), { y: 0.085, z: -0.07, rx: Math.PI / 2 + 0.6 });
  } else if (style === 'long') {
    const back = new THREE.LatheGeometry([[0.112, 0.04], [0.124, -0.04], [0.13, -0.16], [0.12, -0.22]].map(([r, y]) => new THREE.Vector2(r, y)), 24, Math.PI * 0.3, Math.PI * 1.4);
    m.side = THREE.DoubleSide;
    add(back, { z: -0.01 });
  }
}
