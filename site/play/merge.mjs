// Fewer draw calls: meshes that never move are merged into one mesh per material. Each draw call
// costs time three times a frame (shadows, the image, ambient occlusion), so a room of a few
// hundred small parts becomes a few dozen meshes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function prepared(mesh, matrix) {
  let g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  // vertex-coloured materials keep their colours; every geometry in a bucket then has the same attributes
  const keep = mesh.material.vertexColors ? ['position', 'normal', 'uv', 'color'] : ['position', 'normal', 'uv'];
  for (const name of Object.keys(g.attributes)) if (!keep.includes(name)) g.deleteAttribute(name);
  const n = g.attributes.position.count;
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  if (mesh.material.vertexColors && !g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  if (g.attributes.color && g.attributes.color.itemSize !== 3) {
    const c = g.attributes.color, out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { out[i * 3] = c.getX(i); out[i * 3 + 1] = c.getY(i); out[i * 3 + 2] = c.getZ(i); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(out, 3));
  }
  g.morphAttributes = {};
  g.applyMatrix4(matrix);
  return g;
}

const mergeable = m => m.isMesh && !m.isInstancedMesh && !m.isSkinnedMesh && !Array.isArray(m.material) && !m.material.transparent && m.material.blending !== THREE.AdditiveBlending && !m.userData.noMerge;

function mergeBuckets(items, toLocal, parent) {
  const buckets = new Map();
  for (const { mesh, matrix } of items) {
    const key = `${mesh.material.uuid}|${mesh.castShadow ? 1 : 0}|${mesh.receiveShadow ? 1 : 0}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({ mesh, matrix });
  }
  let merged = 0;
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const geo = mergeGeometries(list.map(({ mesh, matrix }) => prepared(mesh, matrix)), false);
    if (!geo) continue;
    const out = new THREE.Mesh(geo, list[0].mesh.material);
    out.castShadow = list[0].mesh.castShadow;
    out.receiveShadow = list[0].mesh.receiveShadow;
    out.userData.merged = list.length;
    parent.add(out);
    for (const { mesh } of list) mesh.parent?.remove(mesh);
    merged += list.length;
  }
  return merged;
}

/**
 * Merge every static mesh under root. A mesh stays as it is when it, or any ancestor up to root, is
 * marked userData.dynamic (it moves, turns or hides) or userData.spot (it can be clicked).
 */
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const items = [];
  root.traverse(o => {
    if (!mergeable(o)) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.dynamic || p.userData.spot || !p.visible) return;
    items.push({ mesh: o, matrix: new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld) });
  });
  return mergeBuckets(items, inverse, root);
}

/** Merge the direct mesh children of one group (a joint of a figure), keeping those in skip. */
export function mergeChildren(group, skip = new Set()) {
  group.updateMatrix();
  const items = [];
  for (const child of [...group.children]) {
    if (!mergeable(child) || skip.has(child) || child.children.length) continue;
    child.updateMatrix();
    items.push({ mesh: child, matrix: child.matrix.clone() });
  }
  return mergeBuckets(items, null, group);
}
