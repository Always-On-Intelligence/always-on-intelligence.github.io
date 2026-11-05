import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { blobTexture, seeded } from './textures.mjs';

// Faceless architectural-model figures shared by every scene. Arms, hands and heads are
// separate instanced parts so figures can walk, gesture, glance and wave. A figure faces +Z
// at yaw 0, so its left side is +X. Scenes place people and move them through step(p, dt).

export const PALETTE = {
  shirts: ['#2f3e56', '#e8e6df', '#6b7078', '#1f2328', '#9aa5b1', '#556b88', '#7a5c4f', '#c9c2b4', '#3d5a4c', '#a0463c', '#d8d4cc', '#44505c', '#f2f0ea', '#5f6d7e'],
  pants: ['#1f2328', '#2b3340', '#4a4f56', '#3a3f45', '#5a5246', '#1c2a3a', '#6d6a63'],
  skin: ['#f1c9a5', '#e0ac85', '#c68b62', '#a86f4c', '#8d5a3b', '#f5d6bc', '#d9a07a'],
  hair: ['#1a1512', '#2c211a', '#4a3526', '#7b5a3c', '#8f8f8f', '#141414', '#3b2a20'],
};
const SHOULDER_Y = 1.44, NECK_Y = 1.52, HIP_Y = 0.92;

function colorGeometry(geometry, hex) {
  const c = new THREE.Color(hex);
  const n = geometry.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function prep(geometry, matrix, color = '#ffffff') {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.applyMatrix4(matrix);
  g.deleteAttribute('uv');
  return colorGeometry(g, color);
}

function partGeometries() {
  const M = (x, y, z, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
  return {
    body: mergeGeometries([
      prep(new THREE.CylinderGeometry(0.19, 0.155, 0.58, 10, 1), M(0, 1.22, 0, 1, 1, 0.62)),
      prep(new THREE.CapsuleGeometry(0.085, 0.3, 4, 10).rotateZ(Math.PI / 2), M(0, 1.47, 0, 1, 1, 0.78)),
    ]),
    arm: mergeGeometries([prep(new THREE.CapsuleGeometry(0.05, 0.46, 2, 6), M(0, -0.28, 0))]),
    hand: mergeGeometries([prep(new THREE.SphereGeometry(0.047, 6, 5), M(0, 0, 0))]),
    head: mergeGeometries([
      prep(new THREE.CylinderGeometry(0.046, 0.05, 0.13, 6, 1), M(0, 1.575, 0)),
      prep(new THREE.SphereGeometry(0.104, 12, 8), M(0, 1.715, 0.005, 1, 1.13, 1.02)),
    ]),
    hair: mergeGeometries([prep(new THREE.SphereGeometry(0.112, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.52), M(0, 1.738, -0.012, 1, 1.06, 1.05))]),
    leg: mergeGeometries([
      prep(new THREE.CapsuleGeometry(0.066, 0.72, 2, 7), M(0, -0.43, 0)),
      prep(new THREE.BoxGeometry(0.105, 0.075, 0.25), M(0, -0.885, 0.045), '#262626'),
    ]),
  };
}

export const wrapAngle = (a) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

/** A person with default looks; scenes add kind-specific fields. */
export function makePerson(random, x, z, yaw, kind, extra = {}) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  return { x, z, yaw, baseYaw: yaw, kind, scale: 0.93 + random() * 0.13, shirt: pick(PALETTE.shirts), pants: pick(PALETTE.pants),
    skin: pick(PALETTE.skin), hair: pick(PALETTE.hair), phase: random() * 100, ...extra };
}

export { seeded };

/**
 * people: list from the scene. options.groundAt(x, z) gives the floor height, options.pose(p, pose, ph)
 * adds scene-specific idle poses, options.radius is the animation radius in metres.
 */
export function createFigures(people, { quality = 'high', groundAt = () => 0, pose: scenePose = null, radius = 28 } = {}) {
  const parts = partGeometries();
  const material = (roughness) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0 });
  const count = people.length;
  const meshes = {
    body: new THREE.InstancedMesh(parts.body, material(0.85), count),
    arm: new THREE.InstancedMesh(parts.arm, material(0.85), count * 2),
    hand: new THREE.InstancedMesh(parts.hand, material(0.6), count * 2),
    head: new THREE.InstancedMesh(parts.head, material(0.6), count),
    hair: new THREE.InstancedMesh(parts.hair, material(0.8), count),
    leg: new THREE.InstancedMesh(parts.leg, material(0.85), count * 2),
  };
  const group = new THREE.Group();
  group.name = 'figures';
  for (const [name, mesh] of Object.entries(meshes)) {
    mesh.castShadow = quality !== 'low' && name !== 'hand';
    mesh.frustumCulled = false;
    mesh.userData.part = name;
    group.add(mesh);
  }
  const blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.8 }), count);
  blobs.renderOrder = 1;
  blobs.frustumCulled = false;
  group.add(blobs);

  const color = new THREE.Color();
  people.forEach((p, i) => {
    p.i = i;
    p.y = groundAt(p.x, p.z);
    meshes.body.setColorAt(i, color.set(p.shirt));
    meshes.head.setColorAt(i, color.set(p.skin));
    meshes.hair.setColorAt(i, color.set(p.hair));
    for (const k of [0, 1]) {
      meshes.arm.setColorAt(i * 2 + k, color.set(p.shirt));
      meshes.hand.setColorAt(i * 2 + k, color.set(p.skin));
      meshes.leg.setColorAt(i * 2 + k, color.set(p.pants));
    }
  });

  const base = new THREE.Matrix4(), part = new THREE.Matrix4(), joint = new THREE.Matrix4(), offset = new THREE.Matrix4();
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3(), euler = new THREE.Euler();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const jointAt = (x, y, z, rx, ry, rz) => joint.compose(pos.set(x, y, z), quat.setFromEuler(euler.set(rx, ry, rz, 'YXZ')), scl.set(1, 1, 1));
  // Arms are [rx, rz]: negative rx lifts the arm forward; positive rz swings it towards +X.
  const REST = { armL: [0.02, 0.07], armR: [0.02, -0.07] };

  function write(p, pose = REST) {
    const i = p.i;
    if (p.hidden) {
      for (const mesh of [meshes.body, meshes.head, meshes.hair, blobs]) mesh.setMatrixAt(i, zero);
      for (const k of [0, 1]) { meshes.arm.setMatrixAt(i * 2 + k, zero); meshes.hand.setMatrixAt(i * 2 + k, zero); meshes.leg.setMatrixAt(i * 2 + k, zero); }
      return;
    }
    const y = p.y ?? 0;
    base.compose(pos.set(p.x, y + (pose.bob || 0), p.z), quat.setFromAxisAngle(yAxis, p.yaw), scl.setScalar(p.scale));
    meshes.body.setMatrixAt(i, base);
    part.multiplyMatrices(base, jointAt(0, NECK_Y, 0, pose.headPitch || 0, pose.headYaw || 0, 0)).multiply(offset.makeTranslation(0, -NECK_Y, 0));
    meshes.head.setMatrixAt(i, part);
    meshes.hair.setMatrixAt(i, part);
    [[1, pose.armL || REST.armL], [-1, pose.armR || REST.armR]].forEach(([side, [rx, rz]], k) => {
      part.multiplyMatrices(base, jointAt(side * 0.235, SHOULDER_Y, 0.01, rx, 0, rz));
      meshes.arm.setMatrixAt(i * 2 + k, part);
      meshes.hand.setMatrixAt(i * 2 + k, part.multiply(offset.makeTranslation(0, -0.6, 0)));
    });
    const swing = pose.legSwing || 0;
    // pose.legs sets both hips directly (negative is forward), e.g. [-1.4, -1.4] to sit.
    const [legL, legR] = pose.legs || [swing, -swing];
    meshes.leg.setMatrixAt(i * 2, part.multiplyMatrices(base, jointAt(0.095, HIP_Y, 0, legL, 0, 0)));
    meshes.leg.setMatrixAt(i * 2 + 1, part.multiplyMatrices(base, jointAt(-0.095, HIP_Y, 0, legR, 0, 0)));
    blobs.setMatrixAt(i, part.compose(pos.set(p.x, y + 0.012, p.z), quat.identity(), scl.set(0.95, 1, 0.95)));
  }

  const dirty = () => {
    for (const mesh of Object.values(meshes)) mesh.instanceMatrix.needsUpdate = true;
    blobs.instanceMatrix.needsUpdate = true;
  };
  people.forEach(p => write(p));
  dirty();

  const relYaw = (p, x, z) => wrapAngle(Math.atan2(x - p.x, z - p.z) - p.yaw);

  function poseFor(p, t, player) {
    const ph = p.phase + t;
    const pose = { armL: [...REST.armL], armR: [...REST.armR], bob: 0, legSwing: 0,
      headYaw: Math.sin(ph * 0.9) * 0.05, headPitch: Math.sin(ph * 0.7) * 0.03 };
    if (p.walking) {
      const s = Math.sin(p.stride || 0);
      pose.legSwing = s * 0.42;
      pose.bob = Math.abs(Math.cos(p.stride || 0)) * 0.025;
      pose.armL = [-s * 0.35, 0.08];
      pose.armR = [s * 0.35, -0.08];
    } else if (scenePose) {
      scenePose(p, pose, ph, relYaw);
    }
    if (p.greet) {
      const g = p.greet;
      pose.headYaw = THREE.MathUtils.clamp(relYaw(p, g.x, g.z), -1.2, 1.2);
      if (g.t < 1.4) pose.armR = [-0.3, -2.5 + Math.sin(g.t * 14) * 0.25];
      else if (g.t < g.dur - 0.6) {
        pose.armL = [-0.5 - Math.sin(g.t * 3) * 0.2, 0.1];
        pose.armR = [-0.55 - Math.sin(g.t * 2.6 + 1) * 0.25, -0.1];
      }
    } else if (player && !p.walking) {
      const d2 = (player.x - p.x) ** 2 + (player.z - p.z) ** 2;
      if (d2 < 9) {
        const face = relYaw(p, player.x, player.z);
        if (Math.abs(face) < 1.7) pose.headYaw = THREE.MathUtils.clamp(face, -1.1, 1.1) * Math.min(1, (9 - d2) / 5);
      }
    }
    return pose;
  }

  let clock = 0;
  const fwd = new THREE.Vector3();
  const r2 = (quality === 'low' ? Math.min(16, radius) : radius) ** 2;

  /** step(p, dt) moves people (sets p.x, p.z, p.yaw, p.walking, p.stride); posing happens here. */
  function update(dt, player, camera, step) {
    clock += dt;
    const cam = camera?.position;
    if (camera) camera.getWorldDirection(fwd);
    for (const p of people) {
      if (p.hidden || p.scripted) continue;
      const wasX = p.x, wasZ = p.z;
      if (!p.greet) step?.(p, dt, player);
      if (p.x !== wasX || p.z !== wasZ) p.y = groundAt(p.x, p.z);
      if (p.greet) {
        p.greet.t += dt;
        const want = Math.atan2(p.greet.x - p.x, p.greet.z - p.z);
        p.yaw += wrapAngle(want - p.yaw) * Math.min(1, dt * 6);
        p.walking = false;
        if (p.greet.t > p.greet.dur) {
          p.greet = null;
          if (!p.moving) p.yaw = p.baseYaw;
        }
      }
      if (cam) {
        const dx = p.x - cam.x, dz = p.z - cam.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > r2 || (d2 > 16 && dx * fwd.x + dz * fwd.z < -2)) {
          if (p.moving) write(p);
          continue;
        }
      }
      write(p, poseFor(p, clock, player));
    }
    dirty();
  }

  const move = (p, x, z, yaw, swing = 0) => {
    Object.assign(p, { x, z, yaw });
    p.y = groundAt(x, z);
    write(p, { legSwing: swing, armL: [-swing * 0.8, 0.08], armR: [swing * 0.8, -0.08], bob: Math.abs(swing) * 0.04 });
    dirty();
  };
  const setHidden = (p, hidden) => { p.hidden = hidden; write(p); dirty(); };
  const greet = (p, player) => { p.greet = { t: 0, dur: 6, x: player.x, z: player.z }; };
  const personAt = (object, instanceId) => {
    const name = object?.userData?.part;
    if (!name || instanceId === undefined || !Object.values(meshes).includes(object)) return null;
    return people[['arm', 'hand', 'leg'].includes(name) ? Math.floor(instanceId / 2) : instanceId] || null;
  };
  return { group, update, people, move, setHidden, greet, personAt, meshes, write, dirty };
}
