import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, seeded } from '../engine/textures.mjs';

// NTU as an open world, built from campus.json (OpenStreetMap, Copernicus terrain).
// Metres, Y up, x east, z south. Heights are metres above the lowest terrain sample.

const WALKWAYS = new Set(['footway', 'path', 'pedestrian', 'steps', 'cycleway', 'corridor']);
const DRIVE = new Set(['motorway', 'motorway_link', 'trunk', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'residential', 'unclassified', 'service', 'track', 'construction']);
const AREA_COLOR = { grass: '#6f8f55', park: '#6a9152', forest: '#3f6437', water: '#35566a', pitch: '#5c9a4e', track: '#a85b45', parking: '#8b8d8a', plaza: '#b9b3a6', bare: '#8d7b5f' };

export function flat(list) {
  const out = [];
  for (let i = 0; i < list.length; i += 2) out.push([list[i], list[i + 1]]);
  return out;
}

export function makeGround(terrain) {
  const { x0, z0, step, nx, nz, dm } = terrain;
  return (x, z) => {
    const fi = Math.min(nx - 1.001, Math.max(0, (x - x0) / step));
    const fj = Math.min(nz - 1.001, Math.max(0, (z - z0) / step));
    const i = Math.floor(fi), j = Math.floor(fj);
    const tx = fi - i, tz = fj - j;
    const a = dm[j * nx + i], b = dm[j * nx + i + 1], c = dm[(j + 1) * nx + i], d = dm[(j + 1) * nx + i + 1];
    return ((a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz) / 10;
  };
}

function pointInPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < xi + (z - zi) * (xj - xi) / (zj - zi)) inside = !inside;
  }
  return inside;
}

// Slight per-building colour variation around each facade's base tone.
function tintFor(style, random) {
  const palettes = {
    campus: [[1, 1, 1], [0.96, 0.95, 0.92], [0.93, 0.94, 0.96], [1, 0.97, 0.93], [0.9, 0.9, 0.9]],
    hall: [[1, 1, 1], [1, 0.95, 0.9], [0.95, 0.97, 1], [0.98, 1, 0.95], [1, 0.93, 0.93]],
    house: [[1, 1, 1], [0.95, 0.93, 0.9], [1, 0.96, 0.9]],
    utility: [[1, 1, 1], [0.92, 0.92, 0.92]],
    hub: [[1, 1, 1]],
  }[style];
  const c = palettes[Math.floor(random() * palettes.length)];
  const k = 0.94 + random() * 0.08;
  return [c[0] * k, c[1] * k, c[2] * k];
}

function facadeTexture(style) {
  const random = seeded(style.length * 97);
  return canvasTexture(256, 304, (ctx, w, h) => {
    const wall = { campus: '#d9d6cf', hall: '#e6dfcf', house: '#d8c6a8', utility: '#9fa3a3', hub: '#c9bba5' }[style];
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(${random() > 0.5 ? '255,255,255' : '40,40,36'},${0.03 + random() * 0.04})`;
      ctx.fillRect(random() * w, random() * h, 2, 2);
    }
    const glass = (x, y, gw, gh) => {
      const g = ctx.createLinearGradient(x, y, x + gw, y + gh);
      g.addColorStop(0, '#34414d'); g.addColorStop(0.55, '#4f6371'); g.addColorStop(1, '#2b3640');
      ctx.fillStyle = g; ctx.fillRect(x, y, gw, gh);
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y, gw, gh * 0.18);
    };
    if (style === 'campus') {
      glass(0, h * 0.28, w, h * 0.46);
      ctx.fillStyle = '#b9b5ac';
      for (let x = 0; x <= w; x += w / 3) ctx.fillRect(x - 2, h * 0.28, 4, h * 0.46);
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, h * 0.74, w, 6);
    } else if (style === 'hall') {
      glass(w * 0.18, h * 0.24, w * 0.3, h * 0.44);
      glass(w * 0.56, h * 0.24, w * 0.26, h * 0.44);
      ctx.fillStyle = '#cfc6b3'; ctx.fillRect(0, h * 0.8, w, h * 0.06);
      ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fillRect(0, h * 0.86, w, 4);
    } else if (style === 'house') {
      glass(w * 0.3, h * 0.3, w * 0.4, h * 0.36);
      ctx.strokeStyle = '#f4efe6'; ctx.lineWidth = 6; ctx.strokeRect(w * 0.3, h * 0.3, w * 0.4, h * 0.36);
    } else if (style === 'hub') {
      // Stacked, rounded concrete bands with recessed glazing, as on the tower cluster.
      glass(0, h * 0.12, w, h * 0.5);
      ctx.fillStyle = '#b8a992'; ctx.fillRect(0, h * 0.62, w, h * 0.38);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let y = h * 0.66; y < h; y += h * 0.07) ctx.fillRect(0, y, w, 2);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(w * 0.1, h * 0.35, w * 0.25, h * 0.2);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(0, h - 5, w, 5);
  }, { repeat: [1, 1] });
}

export function buildNtu(campus, { quality = 'high', anisotropy = 8 } = {}) {
  const root = new THREE.Group();
  root.name = 'ntu';
  const ground = makeGround(campus.terrain);
  const B = campus.bounds;
  const random = seeded(20260929);
  const obstacles = { polygons: [], water: [] };

  // ---------------------------------------------------------------- terrain + land cover
  const LC = 2048;
  const lcScale = LC / Math.max(B.x1 - B.x0, B.z1 - B.z0);
  const lcX = (x) => (x - B.x0) * lcScale, lcZ = (z) => (z - B.z0) * lcScale;
  const landcover = canvasTexture(LC, LC, (ctx) => {
    ctx.fillStyle = '#7a9460';
    ctx.fillRect(0, 0, LC, LC);
    const rnd = seeded(7);
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * LC, y = rnd() * LC, r = 6 + rnd() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${rnd() > 0.5 ? '120,140,70' : '70,95,55'},0.35)`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    const poly = (p) => {
      ctx.beginPath();
      p.forEach(([x, z], i) => (i ? ctx.lineTo(lcX(x), lcZ(z)) : ctx.moveTo(lcX(x), lcZ(z))));
      ctx.closePath();
    };
    const order = ['forest', 'grass', 'park', 'bare', 'parking', 'plaza', 'pitch', 'track', 'water'];
    for (const kind of order) {
      for (const a of campus.areas) {
        if (a.k !== kind) continue;
        poly(flat(a.p));
        ctx.fillStyle = AREA_COLOR[kind];
        ctx.fill();
        if (kind === 'pitch') { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.stroke(); }
      }
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const r of campus.roads) {
      const line = flat(r.p);
      ctx.beginPath();
      line.forEach(([x, z], i) => (i ? ctx.lineTo(lcX(x), lcZ(z)) : ctx.moveTo(lcX(x), lcZ(z))));
      ctx.strokeStyle = WALKWAYS.has(r.k) ? '#c9c3b6' : '#55585a';
      ctx.lineWidth = Math.max(1, r.w * lcScale);
      ctx.stroke();
    }
    for (const b of campus.buildings) {
      poly(flat(b.p));
      ctx.fillStyle = '#6d6a64';
      ctx.fill();
    }
  }, { anisotropy });
  const detail = canvasTexture(256, 256, (ctx, w, h) => {
    const rnd = seeded(11);
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '0,0,0'},${0.05 + rnd() * 0.1})`;
      ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
    }
  }, { srgb: false, repeat: [1, 1] });
  {
    const { x0, z0, step, nx, nz } = campus.terrain;
    const positions = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2), uv1 = new Float32Array(nx * nz * 2);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i, x = x0 + i * step, z = z0 + j * step;
        positions.set([x, campus.terrain.dm[k] / 10 - 0.06, z], k * 3);
        uv.set([lcX(x) / LC, 1 - lcZ(z) / LC], k * 2);
        uv1.set([x / 5, z / 5], k * 2);
      }
    }
    const index = [];
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
        index.push(a, c, b, b, c, d);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geometry.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    detail.channel = 1;
    const terrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: landcover, bumpMap: detail, bumpScale: 1.2, roughness: 0.96 }));
    terrain.receiveShadow = true;
    terrain.name = 'terrain';
    root.add(terrain);
  }

  // ---------------------------------------------------------------- roads, draped on the terrain
  const roadParts = { drive: [], walk: [] };
  const canopy = [], posts = [];
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  for (const r of campus.roads) {
    const line = flat(r.p);
    const pts = [];
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, az] = line[i], [bx, bz] = line[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 4));
      for (let s = 0; s < n; s++) pts.push([ax + (bx - ax) * s / n, az + (bz - az) * s / n]);
    }
    pts.push(line[line.length - 1]);
    const half = r.w / 2;
    const walk = WALKWAYS.has(r.k) || !DRIVE.has(r.k);
    const lift = walk ? 0.07 : 0.05;
    const pos = [];
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i];
      const [px, pz] = pts[Math.max(0, i - 1)], [qx, qz] = pts[Math.min(pts.length - 1, i + 1)];
      let dx = qx - px, dz = qz - pz;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      const lx = x - dz * half, lz = z + dx * half, rx = x + dz * half, rz = z - dx * half;
      pos.push(lx, ground(lx, lz) + lift, lz, rx, ground(rx, rz) + lift, rz);
    }
    const index = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      index.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    roadParts[walk ? 'walk' : 'drive'].push(g);
    // Covered walkways: a canopy on posts along the path.
    if (r.c) {
      for (let i = 0; i + 1 < line.length; i++) {
        const [ax, az] = line[i], [bx, bz] = line[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.5) continue;
        const mx = (ax + bx) / 2, mz = (az + bz) / 2;
        const y = Math.max(ground(ax, az), ground(bx, bz), ground(mx, mz)) + 3.1;
        const yaw = Math.atan2(-(bz - az), bx - ax);
        tmpQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        canopy.push(tmpM.compose(tmpP.set(mx, y, mz), tmpQ, tmpS.set(len + 0.3, 0.16, r.w + 1.2)).clone());
        const n = Math.max(1, Math.floor(len / 7));
        const nx = -(bz - az) / len, nz = (bx - ax) / len;
        for (let s = 0; s <= n; s++) {
          const px = ax + (bx - ax) * s / n, pz = az + (bz - az) * s / n;
          for (const side of [-1, 1]) {
            const ox = px + nx * side * (r.w / 2 + 0.4), oz = pz + nz * side * (r.w / 2 + 0.4);
            const gy = ground(ox, oz);
            posts.push(tmpM.compose(tmpP.set(ox, (gy + y) / 2, oz), tmpQ, tmpS.set(0.14, y - gy, 0.14)).clone());
          }
        }
      }
    }
  }
  const asphalt = new THREE.MeshStandardMaterial({ color: '#4d5154', roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const paving = new THREE.MeshStandardMaterial({ color: '#c3bdb1', roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  for (const [key, material] of [['drive', asphalt], ['walk', paving]]) {
    if (!roadParts[key].length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(roadParts[key]), material);
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  const instanced = (geometry, material, matrices, cast = true) => {
    if (!matrices.length) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  instanced(unitBox, new THREE.MeshStandardMaterial({ color: '#e9e7e1', roughness: 0.7 }), canopy);
  instanced(unitBox, new THREE.MeshStandardMaterial({ color: '#6c7174', roughness: 0.5, metalness: 0.4 }), posts);

  // ---------------------------------------------------------------- buildings
  const styles = { campus: facadeTexture('campus'), hall: facadeTexture('hall'), house: facadeTexture('house'), utility: facadeTexture('utility'), hub: facadeTexture('hub') };
  for (const tex of Object.values(styles)) tex.anisotropy = anisotropy;
  const wallMat = Object.fromEntries(Object.entries(styles).map(([k, map]) => [k, new THREE.MeshStandardMaterial({ map, roughness: 0.85, vertexColors: true })]));
  const roofMat = {
    flat: new THREE.MeshStandardMaterial({ color: '#b6b5ae', roughness: 0.95, vertexColors: true }),
    green: new THREE.MeshStandardMaterial({ color: '#6f9153', roughness: 1, vertexColors: true }),
    tile: new THREE.MeshStandardMaterial({ color: '#9a5b43', roughness: 0.9, vertexColors: true }),
  };
  const CHUNK = 400;
  const buckets = new Map();
  const bucket = (key, cx, cz) => {
    const id = `${key}|${Math.floor(cx / CHUNK)}|${Math.floor(cz / CHUNK)}`;
    if (!buckets.has(id)) buckets.set(id, { key, parts: [] });
    return buckets.get(id).parts;
  };
  const named = [];
  for (const b of campus.buildings) {
    const ring = flat(b.p);
    if (ring.length < 3) continue;
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const hub = b.n === 'UOB Innovation Hub';
    const adm = b.n === 'School of Art, Design and Media';
    const style = hub ? 'hub' : ['dormitory', 'residential', 'apartments'].includes(b.k) || /Hall|Block \d/.test(b.n) ? 'hall'
      : ['house', 'bungalow', 'detached'].includes(b.k) ? 'house' : ['substation', 'garage', 'shed', 'construction', 'service'].includes(b.k) ? 'utility' : 'campus';
    const roofOnly = b.k === 'roof';
    const top = b.g + (adm ? Math.min(b.h, 9) : b.h);
    const bottom = b.g - 1.5;
    // Walls.
    if (!roofOnly) {
      const pos = [], uv = [];
      let run = 0;
      for (let i = 0; i < ring.length; i++) {
        const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length];
        const len = Math.hypot(bx - ax, bz - az);
        const u0 = run / 3.2, u1 = (run + len) / 3.2;
        const v0 = (bottom - b.g) / 3.8, v1 = (top - b.g) / 3.8;
        pos.push(ax, bottom, az, bx, top, bz, bx, bottom, bz, ax, bottom, az, ax, top, az, bx, top, bz);
        uv.push(u0, v0, u1, v1, u1, v0, u0, v0, u0, v1, u1, v1);
        run += len;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const tint = tintFor(style, random);
      g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill(0).flatMap(() => tint), 3));
      g.computeVertexNormals();
      bucket('wall-' + style, cx, cz).push(g);
    }
    // Roof (ring is counter-clockwise in x/z, so the top faces up once flipped).
    const contour = ring.map(([x, z]) => new THREE.Vector2(x, z));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const rpos = [], ruv = [];
    for (const [a, c, d] of tris) {
      for (const k of [a, d, c]) {
        rpos.push(ring[k][0], top + 0.02, ring[k][1]);
        ruv.push(ring[k][0] / 6, ring[k][1] / 6);
      }
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(rpos, 3));
    rg.setAttribute('uv', new THREE.Float32BufferAttribute(ruv, 2));
    const rt = 0.86 + random() * 0.2;
    rg.setAttribute('color', new THREE.Float32BufferAttribute(new Array(rpos.length / 3).fill(0).flatMap(() => [rt, rt, rt * 0.98]), 3));
    rg.computeVertexNormals();
    bucket(adm ? 'roof-green' : style === 'house' ? 'roof-tile' : 'roof-flat', cx, cz).push(rg);
    if (!roofOnly) obstacles.polygons.push(ring);
    if (b.n) named.push({ name: b.n, ring, cx, cz, g: b.g, top, kind: b.k });
  }
  const buildingMeshes = [];
  for (const { key, parts } of buckets.values()) {
    const material = key.startsWith('wall-') ? wallMat[key.slice(5)] : roofMat[key.slice(5)];
    const mesh = new THREE.Mesh(mergeGeometries(parts), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.buildings = true;
    root.add(mesh);
    buildingMeshes.push(mesh);
  }

  // ---------------------------------------------------------------- water
  const waterMat = new THREE.MeshStandardMaterial({ color: '#3d5f6f', roughness: 0.12, metalness: 0.1, envMapIntensity: 1.2 });
  for (const a of campus.areas) {
    if (a.k !== 'water') continue;
    const ring = flat(a.p);
    const level = Math.min(...ring.map(([x, z]) => ground(x, z))) + 0.25;
    const shape = new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).translate(0, level, 0);
    const mesh = new THREE.Mesh(g, waterMat);
    mesh.receiveShadow = true;
    root.add(mesh);
    obstacles.water.push(ring);
  }

  // ---------------------------------------------------------------- trees
  const occupied = new Uint8Array(Math.ceil((B.x1 - B.x0) / 4) * Math.ceil((B.z1 - B.z0) / 4));
  const OW = Math.ceil((B.x1 - B.x0) / 4);
  const occ = (x, z) => occupied[Math.floor((z - B.z0) / 4) * OW + Math.floor((x - B.x0) / 4)];
  const mark = (x, z) => { const i = Math.floor((z - B.z0) / 4) * OW + Math.floor((x - B.x0) / 4); if (i >= 0 && i < occupied.length) occupied[i] = 1; };
  for (const b of campus.buildings) {
    const ring = flat(b.p);
    const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
    for (let x = Math.min(...xs) - 3; x <= Math.max(...xs) + 3; x += 2) for (let z = Math.min(...zs) - 3; z <= Math.max(...zs) + 3; z += 2) {
      if (pointInPolygon(x, z, ring) || pointInPolygon(x + 3, z, ring) || pointInPolygon(x - 3, z, ring) || pointInPolygon(x, z + 3, ring) || pointInPolygon(x, z - 3, ring)) mark(x, z);
    }
  }
  for (const r of campus.roads) {
    const line = flat(r.p);
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, az] = line[i], [bx, bz] = line[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 2));
      for (let s = 0; s <= n; s++) {
        const x = ax + (bx - ax) * s / n, z = az + (bz - az) * s / n;
        for (let o = -r.w / 2 - 1.5; o <= r.w / 2 + 1.5; o += 2) mark(x + o * 0.7, z + o * 0.7), mark(x - o * 0.7, z + o * 0.7);
      }
    }
  }
  // Bus stops keep a clear kerb for people waiting.
  for (const st of campus.stops) for (let dx = -6; dx <= 6; dx += 2) for (let dz = -6; dz <= 6; dz += 2) if (dx * dx + dz * dz <= 36) mark(st.x + dx, st.z + dz);
  const areaOf = (x, z) => {
    for (const a of campus.areas) {
      if (a.k === 'water' || a.k === 'forest' || a.k === 'park' || a.k === 'grass' || a.k === 'pitch' || a.k === 'parking') {
        a.ring ||= flat(a.p);
        a.box ||= [Math.min(...a.ring.map(p => p[0])), Math.max(...a.ring.map(p => p[0])), Math.min(...a.ring.map(p => p[1])), Math.max(...a.ring.map(p => p[1]))];
        if (x < a.box[0] || x > a.box[1] || z < a.box[2] || z > a.box[3]) continue;
        if (pointInPolygon(x, z, a.ring)) return a.k;
      }
    }
    return null;
  };
  const trees = [];
  const osmTrees = flat(campus.trees);
  for (const [x, z] of osmTrees) trees.push([x, z, 0.9 + random() * 0.3]);
  const spacing = quality === 'low' ? 22 : 15;
  for (let x = B.x0 + 4; x < B.x1 - 4; x += spacing) {
    for (let z = B.z0 + 4; z < B.z1 - 4; z += spacing) {
      const jx = x + (random() - 0.5) * spacing * 0.9, jz = z + (random() - 0.5) * spacing * 0.9;
      if (occ(jx, jz)) continue;
      const kind = areaOf(jx, jz);
      const keep = { forest: 0.95, park: 0.55, grass: 0.3, water: 0, pitch: 0, parking: 0.05 }[kind] ?? 0.4;
      if (random() < keep) trees.push([jx, jz, 0.75 + random() * 0.55]);
    }
  }
  // Roadside trees along the main campus roads.
  for (const r of campus.roads) {
    if (!['primary', 'secondary', 'tertiary', 'residential', 'unclassified'].includes(r.k)) continue;
    const line = flat(r.p);
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, az] = line[i], [bx, bz] = line[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const nx = -(bz - az) / (len || 1), nz = (bx - ax) / (len || 1);
      for (let d = 6; d < len; d += 13) {
        for (const side of [-1, 1]) {
          const x = ax + (bx - ax) * d / len + nx * side * (r.w / 2 + 3), z = az + (bz - az) * d / len + nz * side * (r.w / 2 + 3);
          if (!occ(x, z)) trees.push([x, z, 0.9 + random() * 0.35]);
        }
      }
    }
  }
  {
    const trunkG = new THREE.CylinderGeometry(0.16, 0.26, 1, 5, 1, true).translate(0, 0.5, 0);
    const canopyG = mergeGeometries([
      new THREE.IcosahedronGeometry(1, 0).scale(1.3, 0.75, 1.3).translate(0, 0.1, 0),
      new THREE.IcosahedronGeometry(0.85, 0).scale(1.1, 0.72, 1.1).translate(0.55, 0.45, 0.3),
      new THREE.IcosahedronGeometry(0.8, 0).scale(1.1, 0.72, 1.1).translate(-0.5, 0.38, -0.35),
    ].map(g => g.toNonIndexed()));
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5b4a3a', roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true });
    // Chunked so off-screen groups are culled.
    const TC = 300;
    const groups = new Map();
    for (const t of trees) {
      const key = `${Math.floor(t[0] / TC)}|${Math.floor(t[1] / TC)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }
    const color = new THREE.Color();
    for (const list of groups.values()) {
      const trunks = new THREE.InstancedMesh(trunkG, trunkMat, list.length);
      const crowns = new THREE.InstancedMesh(canopyG, leafMat, list.length);
      list.forEach(([x, z, s], i) => {
        const y = ground(x, z);
        const h = 5.5 * s;
        tmpQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * Math.PI * 2);
        trunks.setMatrixAt(i, tmpM.compose(tmpP.set(x, y - 0.2, z), tmpQ, tmpS.set(s, h * 0.62, s)));
        crowns.setMatrixAt(i, tmpM.compose(tmpP.set(x, y + h * 0.62 + 1.4 * s, z), tmpQ, tmpS.set(2.6 * s, 2.3 * s, 2.6 * s)));
        crowns.setColorAt(i, color.setHSL(0.24 + random() * 0.07, 0.38 + random() * 0.15, 0.24 + random() * 0.09));
      });
      trunks.computeBoundingSphere();
      crowns.computeBoundingSphere();
      crowns.castShadow = quality !== 'low';
      trunks.castShadow = false;
      root.add(trunks, crowns);
    }
    obstacles.trees = trees.map(([x, z]) => [x, z]);
  }

  // ---------------------------------------------------------------- shuttle buses on the Campus Loop Red
  const loop = flat(campus.loop.p);
  const cum = [0];
  for (let i = 1; i < loop.length; i++) cum.push(cum[i - 1] + Math.hypot(loop[i][0] - loop[i - 1][0], loop[i][1] - loop[i - 1][1]));
  const loopLength = cum[cum.length - 1];
  const stopAt = campus.loop.stops.map(s => cum[s.i]);
  const busTexture = canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f4f4f1'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c0392b'; ctx.fillRect(0, h * 0.72, w, h * 0.12);
    ctx.fillStyle = '#23303b';
    for (let x = 18; x < w - 60; x += 58) ctx.fillRect(x, h * 0.18, 48, h * 0.38);
    ctx.fillRect(w - 52, h * 0.12, 40, h * 0.5);
    ctx.fillStyle = '#c0392b'; ctx.font = '700 22px "IBM Plex Sans", Arial, sans-serif';
    ctx.fillText('CAMPUS LOOP RED', 22, h * 0.68);
  });
  const busBody = new THREE.MeshStandardMaterial({ map: busTexture, roughness: 0.5 });
  const buses = [0, 0.5].map((offset, k) => {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(11, 2.9, 2.5).translate(0, 1.85, 0), [busBody, busBody, new THREE.MeshStandardMaterial({ color: '#f4f4f1' }), new THREE.MeshStandardMaterial({ color: '#333' }), busBody, busBody]);
    body.castShadow = true;
    group.add(body);
    for (const [x, z] of [[-3.6, -1.1], [-3.6, 1.1], [3.6, -1.1], [3.6, 1.1]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 14).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#1b1d20' }));
      wheel.position.set(x, 0.5, z);
      group.add(wheel);
    }
    root.add(group);
    return { group, s: offset * loopLength, wait: 0, k };
  });
  const along = (s) => {
    s = ((s % loopLength) + loopLength) % loopLength;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
    const t = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
    const [ax, az] = loop[lo], [bx, bz] = loop[hi];
    return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, yaw: Math.atan2(-(bz - az), bx - ax) };
  };

  // ---------------------------------------------------------------- sky and light
  {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(3500, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color('#6f9fcb') }, horizon: { value: new THREE.Color('#dde6ea') } },
      vertexShader: 'varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying float vY; void main(){ float t = smoothstep(-0.02, 0.45, vY); gl_FragColor = vec4(mix(horizon, top, t), 1.0); }',
    }));
    sky.name = 'sky';
    sky.frustumCulled = false;
    root.add(sky);
    root.userData.sky = sky;
  }
  const hemi = new THREE.HemisphereLight('#d8e8f6', '#5a6b4a', 0.9);
  const sun = new THREE.DirectionalLight('#fff0d6', 2.3);
  sun.castShadow = quality !== 'low';
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  root.add(hemi, sun, sun.target);
  const sunOffset = new THREE.Vector3(120, 160, 60);

  function update(dt, camera) {
    const snap = 4;
    const tx = Math.round(camera.position.x / snap) * snap, tz = Math.round(camera.position.z / snap) * snap;
    const ty = ground(tx, tz);
    sun.target.position.set(tx, ty, tz);
    sun.position.set(tx + sunOffset.x, ty + sunOffset.y, tz + sunOffset.z);
    root.userData.sky.position.copy(camera.position);
    for (const bus of buses) {
      if (bus.wait > 0) { bus.wait -= dt; }
      else {
        const before = bus.s;
        bus.s += 8 * dt;
        const a = ((before % loopLength) + loopLength) % loopLength, b = ((bus.s % loopLength) + loopLength) % loopLength;
        if (stopAt.some(s => (a < s && b >= s) || (a > b && (s > a || s <= b)))) bus.wait = 6;
      }
      const p = along(bus.s);
      bus.group.position.set(p.x, ground(p.x, p.z), p.z);
      bus.group.rotation.y = p.yaw;
    }
  }

  // Sky presets for the day's scenes: clear day, rain, and night.
  const SKY = {
    day: { top: '#6f9fcb', horizon: '#dde6ea', fog: '#d6e0e5', near: 260, far: 2300, hemi: 0.9, sun: 2.3, sunColor: '#fff0d6', env: 0.4, exposure: 1.02 },
    rain: { top: '#87919a', horizon: '#c2c8cb', fog: '#b7bec2', near: 70, far: 760, hemi: 0.8, sun: 0.35, sunColor: '#e6ecf0', env: 0.34, exposure: 0.92 },
    night: { top: '#0b1322', horizon: '#26344c', fog: '#1b2537', near: 90, far: 1100, hemi: 0.2, sun: 0.16, sunColor: '#9fb3d9', env: 0.1, exposure: 0.5 },
  };
  function setSky(name, scene, renderer = null) {
    const s = SKY[name] || SKY.day;
    const u = root.userData.sky.material.uniforms;
    u.top.value.set(s.top);
    u.horizon.value.set(s.horizon);
    hemi.intensity = s.hemi;
    sun.intensity = s.sun;
    sun.color.set(s.sunColor);
    if (scene) {
      scene.background.set(s.fog);
      scene.fog.color.set(s.fog);
      scene.fog.near = s.near;
      scene.fog.far = s.far;
      scene.environmentIntensity = s.env;
    }
    if (renderer) renderer.toneMappingExposure = s.exposure;
  }

  // The Campus Loop Red, for the day's bus rides: stop positions and a bus sent to a stop.
  const loopInfo = {
    length: loopLength,
    stops: campus.loop.stops.map((st, k) => ({ name: st.n, s: stopAt[k], ...along(stopAt[k]) })),
    along,
    /** Send the nearest bus so it reaches stop k in about `seconds`. */
    send(k, seconds) {
      const target = stopAt[k];
      const bus = buses.reduce((best, b) => {
        const behind = ((target - b.s) % loopLength + loopLength) % loopLength;
        return !best || behind < best.behind ? { b, behind } : best;
      }, null).b;
      bus.s = target - seconds * 8;
      bus.wait = 0;
      return bus;
    },
    /** Park a bus at stop k, as if it just pulled in. */
    park(k, wait = 6) {
      const bus = loopInfo.send(k, 0);
      bus.s = stopAt[k] + 0.01;
      bus.wait = wait;
      return bus;
    },
    atStop: (bus, k) => bus.wait > 0 && Math.abs(((bus.s - stopAt[k]) % loopLength + loopLength) % loopLength) < 9,
  };

  return { root, ground, obstacles, named, buses, update, buildingMeshes, bounds: B, setSky, loop: loopInfo };
}
