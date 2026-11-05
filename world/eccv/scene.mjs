import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, carpetTexture, concreteTexture, hashString, seeded, signTexture, wrapLines } from '../engine/textures.mjs';
import { createPosters, PANEL_H, PANEL_T, POSTER_H, POSTER_W, POSTER_Y } from './posters.mjs';
import { createCrowd } from './crowd.mjs';
import { pointInPolygon } from '../engine/nav.mjs';

// Malmömässan ground floor during ECCV 2026 Poster Session 6, built from venue.json
// (metres, Y up; see tools/eccv/build_venue.py for the frame).

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const yAxis = new THREE.Vector3(0, 1, 0);

class Batcher {
  constructor() { this.entries = new Map(); }
  add(material, geometry, matrix, cast = true, receive = true) {
    const key = material.uuid + (cast ? 'c' : '') + (receive ? 'r' : '');
    let entry = this.entries.get(key);
    if (!entry) this.entries.set(key, entry = { material, cast, receive, parts: [] });
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (matrix) g.applyMatrix4(matrix);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    entry.parts.push(g);
  }
  build(parent) {
    for (const entry of this.entries.values()) {
      const mesh = new THREE.Mesh(mergeGeometries(entry.parts, false), entry.material);
      mesh.castShadow = entry.cast;
      mesh.receiveShadow = entry.receive;
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    this.entries.clear();
  }
}

const matrixFor = (x, y, z, sx, sy, sz, rotY = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(yAxis, rotY), new THREE.Vector3(sx, sy, sz));

function bounds(poly) {
  const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

export function buildEccv(venue, { quality = 'high', anisotropy = 8 } = {}) {
  const root = new THREE.Group();
  root.name = 'eccv-malmomassan';
  const batch = new Batcher();
  const obstacles = { segments: [], polygons: [], circles: [] };
  const signs = [];
  const H = venue.ceiling;

  const mat = {
    floor: new THREE.MeshStandardMaterial({ map: concreteTexture(8), color: '#7f817f', roughness: 0.34, metalness: 0, envMapIntensity: 0.42 }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#32363c', roughness: 1, side: THREE.BackSide }),
    wall: new THREE.MeshStandardMaterial({ color: '#b9bcbd', roughness: 0.92 }),
    wallBase: new THREE.MeshStandardMaterial({ color: '#5a5e63', roughness: 0.8 }),
    column: new THREE.MeshStandardMaterial({ color: '#c6c8c5', roughness: 0.86 }),
    panel: new THREE.MeshStandardMaterial({ color: '#f2f2ef', roughness: 0.8 }),
    alu: new THREE.MeshStandardMaterial({ color: '#b9bec3', roughness: 0.3, metalness: 0.75 }),
    drape: new THREE.MeshStandardMaterial({ color: '#2c2f34', roughness: 1 }),
    counter: new THREE.MeshStandardMaterial({ color: '#f6f6f3', roughness: 0.42 }),
    wood: new THREE.MeshStandardMaterial({ color: '#b58a5c', roughness: 0.55 }),
    black: new THREE.MeshStandardMaterial({ color: '#17191c', roughness: 0.45, metalness: 0.2 }),
    truss: new THREE.MeshStandardMaterial({ color: '#1b1d20', roughness: 0.65, metalness: 0.35 }),
    lamp: new THREE.MeshBasicMaterial({ color: '#fff4dc' }),
    lampRim: new THREE.MeshStandardMaterial({ color: '#0f1012', roughness: 0.5, metalness: 0.4 }),
    glass: new THREE.MeshStandardMaterial({ color: '#a9c1c8', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.2, depthWrite: false }),
    mullion: new THREE.MeshStandardMaterial({ color: '#3a3f44', roughness: 0.4, metalness: 0.6 }),
    door: new THREE.MeshStandardMaterial({ color: '#7e8489', roughness: 0.55, metalness: 0.1 }),
    outside: new THREE.MeshStandardMaterial({ color: '#80837e', roughness: 1 }),
    screen: new THREE.MeshStandardMaterial({ color: '#0d1116', roughness: 0.25, metalness: 0.2 }),
  };
  const carpets = new Map();
  const carpetMat = (color) => {
    if (!carpets.has(color)) carpets.set(color, new THREE.MeshStandardMaterial({ map: carpetTexture(color), roughness: 1 }));
    return carpets.get(color);
  };

  const box = (material, x, y, z, sx, sy, sz, rotY = 0, cast = true, receive = true) =>
    batch.add(material, unitBox, matrixFor(x, y, z, sx, sy, sz, rotY), cast, receive);
  const segment = (material, x1, z1, x2, z2, y0, height, thickness, cast = true) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len < 0.01) return;
    box(material, (x1 + x2) / 2, y0 + height / 2, (z1 + z2) / 2, len, height, thickness, Math.atan2(-(z2 - z1), x2 - x1), cast);
  };
  const prism = (material, poly, y0, height, cast = true) => {
    const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    g.translate(0, y0, 0);
    batch.add(material, g, null, cast, true);
  };
  const sign = (texture, w, h, x, y, z, rotY = 0, { basic = false, double = false, emissive = 0 } = {}) => {
    const material = basic
      ? new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
      : new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55, emissive: emissive ? '#ffffff' : '#000000', emissiveMap: emissive ? texture : null, emissiveIntensity: emissive });
    const geometry = new THREE.PlaneGeometry(w, h);
    const faces = double ? [0, Math.PI] : [0];
    for (const turn of faces) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotY + turn;
      if (turn) mesh.position.add(new THREE.Vector3(Math.sin(rotY) * -0.004, 0, Math.cos(rotY) * -0.004));
      root.add(mesh);
      signs.push(mesh);
    }
  };

  // ---------------------------------------------------------------- shell
  const envelope = venue.envelope;
  {
    const shape = new THREE.Shape(envelope.map(([x, z]) => new THREE.Vector2(x, -z)));
    const floor = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), mat.floor);
    floor.receiveShadow = true;
    floor.name = 'floor';
    root.add(floor);
    const ceiling = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), mat.ceiling);
    ceiling.position.y = H;
    root.add(ceiling);
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(700, 700).rotateX(-Math.PI / 2), mat.outside);
    outside.position.set(-20, -0.03, 10);
    outside.receiveShadow = true;
    root.add(outside);
  }
  const GLASS_EDGES = new Set([9, 10, 11]);
  envelope.forEach((a, i) => {
    const b = envelope[(i + 1) % envelope.length];
    obstacles.segments.push([a[0], a[1], b[0], b[1], 0.2]);
    if (GLASS_EDGES.has(i)) {
      segment(mat.glass, a[0], a[1], b[0], b[1], 0, H, 0.03, false);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.round(len / 1.6));
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        box(mat.mullion, x, H / 2, z, 0.08, H, 0.14, Math.atan2(-(b[1] - a[1]), b[0] - a[0]));
      }
      for (const y of [0.05, 2.6, 5.8, H - 0.1]) segment(mat.mullion, a[0], a[1], b[0], b[1], y, 0.08, 0.12);
    } else {
      segment(mat.wall, a[0], a[1], b[0], b[1], 0, H, 0.4);
      segment(mat.wallBase, a[0], a[1], b[0], b[1], 0, 0.12, 0.44, false);
    }
  });

  for (const [x1, z1, x2, z2, h, t, kind] of venue.walls) {
    const material = kind === 'drape' ? mat.drape : mat.wall;
    segment(material, x1, z1, x2, z2, 0, h, t);
    if (kind !== 'drape') segment(mat.wallBase, x1, z1, x2, z2, 0, 0.12, t + 0.04, false);
    obstacles.segments.push([x1, z1, x2, z2, t / 2]);
  }

  for (const block of venue.blocks) {
    prism(mat.wall, block.poly, 0, block.h);
    obstacles.polygons.push(block.poly);
  }

  // Session rooms A-E: one solid block with doors and room letters on the hall side.
  const roomBounds = venue.rooms.map(r => bounds(r.poly));
  const hallFace = Math.min(...roomBounds.map(b => b.z0));
  for (const room of venue.rooms) {
    prism(mat.wall, room.poly, 0, room.h);
    obstacles.polygons.push(room.poly);
  }
  const roomFont = '700 {size}px "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif';
  for (const room of venue.rooms) {
    const b = bounds(room.poly);
    if (Math.abs(b.z0 - hallFace) > 0.2) continue;
    const doors = [room.door, room.door2].filter(Boolean);
    for (const [dx] of doors) {
      box(mat.door, dx - 0.47, 1.1, hallFace - 0.03, 0.9, 2.2, 0.06);
      box(mat.door, dx + 0.47, 1.1, hallFace - 0.03, 0.9, 2.2, 0.06);
      box(mat.alu, dx, 2.24, hallFace - 0.04, 2.0, 0.08, 0.07);
    }
    const tex = signTexture([room.id], { width: 256, height: 256, background: '#22272d', color: '#ffffff', font: roomFont, sizes: [150] });
    sign(tex, 0.9, 0.9, (b.x0 + b.x1) / 2, 3.55, hallFace - 0.02, Math.PI);
  }
  {
    // Program screen between the A and B doors: the room served the AB spotlight before the poster session.
    const a = venue.rooms.find(r => r.id === 'A'), b = venue.rooms.find(r => r.id === 'B');
    const x = (bounds(a.poly).x1 + bounds(b.poly).x0) / 2;
    const events = venue.day.filter(e => e.room === 'AB' || e.room === 'ExHall').slice(-4);
    const tex = canvasTexture(768, 432, (ctx, w, h) => {
      ctx.fillStyle = '#0e1318'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#9fb4d6'; ctx.font = '600 26px "IBM Plex Sans", Arial, sans-serif';
      ctx.fillText('ROOM AB  ·  SATURDAY 12 SEPTEMBER', 36, 58);
      ctx.fillStyle = '#ffffff';
      let y = 116;
      for (const e of events) {
        ctx.font = '500 24px "IBM Plex Mono", monospace';
        ctx.globalAlpha = e.start === '15:00' ? 1 : 0.55;
        ctx.fillText(`${e.start}–${e.end}`, 36, y);
        ctx.font = '600 26px "IBM Plex Sans", Arial, sans-serif';
        const lines = wrapLines(ctx, `${e.title}${e.room === 'ExHall' ? ' · ExHall' : ''}`, w - 250, 2);
        lines.forEach((line, k) => ctx.fillText(line, 220, y + k * 32));
        y += 36 + lines.length * 32;
      }
      ctx.globalAlpha = 1;
    });
    box(mat.black, x, 1.75, hallFace - 0.06, 1.34, 0.8, 0.06);
    sign(tex, 1.28, 0.72, x, 1.75, hallFace - 0.095, Math.PI, { basic: true });
  }

  // ---------------------------------------------------------------- structure
  const columnMesh = new THREE.InstancedMesh(unitBox, mat.column, venue.columns.length);
  venue.columns.forEach(([x, z, sx, sz], i) => {
    columnMesh.setMatrixAt(i, matrixFor(x, H / 2, z, sx, H, sz));
    obstacles.circles.push([x, z, Math.hypot(sx, sz) / 2]);
  });
  columnMesh.castShadow = columnMesh.receiveShadow = true;
  root.add(columnMesh);

  // Ceiling: trusses on the 12 m column grid and a field of down-lights.
  const colXs = [...new Set(venue.columns.map(c => c[0]))].sort((a, b) => a - b);
  const colZs = [...new Set(venue.columns.map(c => c[1]))].sort((a, b) => a - b);
  const hall = { x0: -54.5, x1: 61.5, z0: -38.3, z1: 41.5 };
  for (const z of [...colZs, 5.5, 29.5]) segment(mat.truss, hall.x0, z, hall.x1, z, H - 1.2, 0.9, 0.45, false);
  for (const x of colXs) segment(mat.truss, x, hall.z0, x, hall.z1, H - 1.35, 0.5, 0.35, false);
  {
    const lamps = [];
    for (let x = hall.x0 + 1.5; x < hall.x1; x += 3) for (let z = hall.z0 + 1.5; z < hall.z1; z += 3) lamps.push([x, z]);
    for (let x = -94; x < -56; x += 4) for (let z = -38; z < 50; z += 4) lamps.push([x, z]);
    const lampGeometry = new THREE.CylinderGeometry(0.16, 0.16, 0.05, 16);
    const rimGeometry = new THREE.CylinderGeometry(0.22, 0.2, 0.22, 16, 1, true);
    const lampMesh = new THREE.InstancedMesh(lampGeometry, mat.lamp, lamps.length);
    const rimMesh = new THREE.InstancedMesh(rimGeometry, mat.lampRim, lamps.length);
    lamps.forEach(([x, z], i) => {
      lampMesh.setMatrixAt(i, matrixFor(x, H - 1.52, z, 1, 1, 1));
      rimMesh.setMatrixAt(i, matrixFor(x, H - 1.42, z, 1, 1, 1));
    });
    root.add(lampMesh, rimMesh);
  }

  // ---------------------------------------------------------------- booths
  const booths = venue.booths.map(b => ({ ...b, ...bounds(b.poly) }));
  const groupBounds = new Map();
  for (const b of booths) {
    const g = groupBounds.get(b.group) || { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
    g.x0 = Math.min(g.x0, b.x0); g.x1 = Math.max(g.x1, b.x1); g.z0 = Math.min(g.z0, b.z0); g.z1 = Math.max(g.z1, b.z1);
    groupBounds.set(b.group, g);
  }
  const ROW_FRONT = { 'north-west-row': 's', 'south-row': 'n', 'demo-row': 's', merch: 'e' };
  const touches = (a, side) => booths.some(o => o !== a && (
    side === 'n' ? Math.abs(o.z1 - a.z0) < 0.35 && o.x0 < a.x1 - 0.4 && o.x1 > a.x0 + 0.4
    : side === 's' ? Math.abs(o.z0 - a.z1) < 0.35 && o.x0 < a.x1 - 0.4 && o.x1 > a.x0 + 0.4
    : side === 'w' ? Math.abs(o.x1 - a.x0) < 0.35 && o.z0 < a.z1 - 0.4 && o.z1 > a.z0 + 0.4
    : Math.abs(o.x0 - a.x1) < 0.35 && o.z0 < a.z1 - 0.4 && o.z1 > a.z0 + 0.4));
  const PALETTE = ['#39424f', '#46505c', '#2f3844', '#5b6168', '#3b4a5c', '#51483f', '#314a44'];
  const bannerFont = '700 {size}px "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif';

  for (const b of booths) {
    const w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const g = groupBounds.get(b.group);
    const island = b.group.includes('island');
    const closed = {};
    for (const side of ['n', 's', 'w', 'e']) {
      if (island) {
        const onEdge = side === 'n' ? Math.abs(b.z0 - g.z0) < 0.3 : side === 's' ? Math.abs(b.z1 - g.z1) < 0.3
          : side === 'w' ? Math.abs(b.x0 - g.x0) < 0.3 : Math.abs(b.x1 - g.x1) < 0.3;
        closed[side] = !onEdge;
      } else {
        const front = ROW_FRONT[b.group];
        const back = { n: 's', s: 'n', e: 'w', w: 'e' }[front];
        closed[side] = side === back || (side !== front && touches(b, side));
      }
    }
    if (b.id === '44') closed.e = false;
    const special = b.id === '44';
    const carpetColor = special ? '#1b2944' : b.kind === 'demo' ? '#2c3440' : b.kind === 'merch' ? '#4a4f56' : PALETTE[hashString(b.id) % PALETTE.length];
    box(carpetMat(carpetColor), cx, 0.012, cz, w - 0.04, 0.024, d - 0.04, 0, false, true);

    const wallH = 2.5;
    const sides = {
      n: [b.x0, b.z0, b.x1, b.z0, [0, -1]], s: [b.x0, b.z1, b.x1, b.z1, [0, 1]],
      w: [b.x0, b.z0, b.x0, b.z1, [-1, 0]], e: [b.x1, b.z0, b.x1, b.z1, [1, 0]],
    };
    for (const [side, [x1, z1, x2, z2, [nx, nz]]] of Object.entries(sides)) {
      if (!closed[side]) continue;
      const ix = -nx * 0.03, iz = -nz * 0.03;
      segment(mat.panel, x1 + ix, z1 + iz, x2 + ix, z2 + iz, 0.02, wallH, 0.05);
      segment(mat.alu, x1 + ix, z1 + iz, x2 + ix, z2 + iz, wallH, 0.035, 0.06, false);
      box(mat.alu, x1 + ix, wallH / 2, z1 + iz, 0.045, wallH, 0.045);
      box(mat.alu, x2 + ix, wallH / 2, z2 + iz, 0.045, wallH, 0.045);
      obstacles.segments.push([x1 + ix, z1 + iz, x2 + ix, z2 + iz, 0.03]);
    }
    // Front: the longest open side.
    const open = Object.entries(sides).filter(([side]) => !closed[side]);
    if (!open.length) continue;
    const preferred = ROW_FRONT[b.group];
    const [frontSide, [fx1, fz1, fx2, fz2, [nx, nz]]] = open.find(([s]) => s === preferred)
      || open.sort((p, q) => Math.hypot(q[1][2] - q[1][0], q[1][3] - q[1][1]) - Math.hypot(p[1][2] - p[1][0], p[1][3] - p[1][1]))[0];
    const frontLen = Math.hypot(fx2 - fx1, fz2 - fz1);
    const depth = nx ? w : d;
    const fcx = (fx1 + fx2) / 2, fcz = (fz1 + fz2) / 2;
    const rotFront = Math.atan2(nx, nz);
    b.front = { cx: fcx, cz: fcz, nx, nz, depth, side: frontSide };

    const name = b.name || (b.kind === 'demo' ? '' : '');
    const accent = special ? '#4f7bd9' : ['#556b88', '#607a6d', '#9d675d', '#6c5f7a', '#8b692e'][hashString(b.id + 'a') % 5];
    const allOpen = Object.values(closed).every(v => !v);
    if (b.kind !== 'demo' || b.id !== 'D-06') {
      const label = b.kind === 'demo' ? [`Demo ${b.id}`, 'Demo Session 6 · 15:00–17:00'] : b.kind === 'merch' ? ['ECCV 2026', 'T-shirts'] : [name || `Booth ${b.id}`, `Booth ${b.id}`];
      const tex = signTexture(label, { width: 1024, height: Math.max(96, Math.round(1024 * 0.36 / Math.max(frontLen, 1.2))),
        background: special ? '#15213a' : '#fbfbf9', color: special ? '#ffffff' : '#1d2126', accent, font: bannerFont, sizes: null });
      if (allOpen) {
        // Island stands get a four-sided hanging banner.
        const bw = Math.min(w, d) * 0.7;
        box(mat.panel, cx, 4.3, cz, bw, 0.9, bw, 0, false);
        const bt = signTexture(label, { width: 1024, height: 384, background: '#fbfbf9', color: '#1d2126', accent, font: bannerFont });
        for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 2;
          sign(bt, bw * 0.98, 0.86, cx + Math.sin(a) * (bw / 2 + 0.006), 4.3, cz + Math.cos(a) * (bw / 2 + 0.006), a);
        }
        for (const [px, pz] of [[cx - bw / 3, cz], [cx + bw / 3, cz]]) box(mat.black, px, (H + 4.3) / 2 + 0.2, pz, 0.01, H - 4.7, 0.01, 0, false);
      } else {
        const fy = wallH + 0.2;
        box(mat.panel, fcx - nx * 0.02, fy, fcz - nz * 0.02, nx ? 0.05 : frontLen, 0.36, nx ? frontLen : 0.05, 0, false);
        sign(tex, frontLen * 0.99, 0.35, fcx + nx * 0.008, fy, fcz + nz * 0.008, rotFront);
        if (!closed[{ n: 'w', s: 'w', e: 'n', w: 'n' }[frontSide]]) box(mat.alu, fx1, wallH / 2 + 0.2, fz1, 0.045, wallH + 0.4, 0.045);
        if (!closed[{ n: 'e', s: 'e', e: 's', w: 's' }[frontSide]]) box(mat.alu, fx2, wallH / 2 + 0.2, fz2, 0.045, wallH + 0.4, 0.045);
      }
    }
    // Counter and screen.
    const inset = Math.min(0.9, depth * 0.3);
    const ccx = fcx - nx * inset, ccz = fcz - nz * inset;
    if (b.kind === 'demo') {
      box(mat.counter, ccx, 0.74, ccz, nx ? 0.7 : Math.min(1.8, frontLen - 0.6), 0.04, nx ? Math.min(1.8, frontLen - 0.6) : 0.7);
      box(mat.black, ccx, 0.37, ccz, nx ? 0.62 : Math.min(1.7, frontLen - 0.7), 0.72, nx ? Math.min(1.7, frontLen - 0.7) : 0.62);
      box(mat.black, ccx, 0.77, ccz, 0.34, 0.02, 0.24, rotFront);
      box(mat.screen, ccx - nx * 0.1, 0.9, ccz - nz * 0.1, 0.34, 0.22, 0.015, rotFront);
      obstacles.circles.push([ccx, ccz, 0.8]);
    } else {
      const cw = Math.min(1.5, frontLen * 0.5);
      box(mat.counter, ccx, 0.51, ccz, nx ? 0.55 : cw, 1.02, nx ? cw : 0.55, 0, true);
      box(carpetMat(accent), ccx + nx * 0.279, 0.55, ccz + nz * 0.279, nx ? 0.01 : cw * 0.92, 0.6, nx ? cw * 0.92 : 0.01, 0, false);
      if (b.kind === 'merch') {
        const random = seeded(hashString(b.id));
        for (let k = 0; k < 10; k++) box(carpetMat(['#1f3a68', '#f1f1ee', '#2f3439', '#8c2432'][k % 4]), ccx + (nx ? 0 : (random() - 0.5) * cw * 0.8), 1.05 + (k % 3) * 0.035, ccz + (nx ? (random() - 0.5) * cw * 0.8 : 0), 0.3, 0.03, 0.24, 0, false);
      }
      obstacles.circles.push([ccx, ccz, Math.max(0.45, cw / 2)]);
      const backSide = { n: 's', s: 'n', e: 'w', w: 'e' }[frontSide];
      if (closed[backSide]) {
        const [bx1, bz1, bx2, bz2] = sides[backSide];
        const bcx = (bx1 + bx2) / 2 + nx * 0.06, bcz = (bz1 + bz2) / 2 + nz * 0.06;
        const sw = Math.min(1.6, Math.hypot(bx2 - bx1, bz2 - bz1) * 0.55);
        box(mat.black, bcx, 1.68, bcz, nx ? 0.05 : sw + 0.06, sw * 0.6 + 0.06, nx ? sw + 0.06 : 0.05, 0, false);
        const st = special ? booth44Screen() : canvasTexture(512, 300, (ctx, W, Hh) => {
          const gr = ctx.createLinearGradient(0, 0, W, Hh);
          gr.addColorStop(0, accent); gr.addColorStop(1, '#10151b');
          ctx.fillStyle = gr; ctx.fillRect(0, 0, W, Hh);
          ctx.fillStyle = 'rgba(255,255,255,0.92)';
          ctx.font = '700 38px "IBM Plex Sans", Arial, sans-serif';
          const lines = wrapLines(ctx, name || 'ECCV 2026', W - 60, 2);
          lines.forEach((line, k) => ctx.fillText(line, 30, 120 + k * 46));
          ctx.globalAlpha = 0.6; ctx.font = '500 20px "IBM Plex Sans", Arial, sans-serif';
          ctx.fillText(`Booth ${b.id}${b.city ? ' · ' + b.city : ''}`, 30, 250);
        });
        sign(st, sw, sw * 0.6, bcx + nx * 0.03, 1.68, bcz + nz * 0.03, rotFront, { basic: true });
      }
    }
    if (special) buildBooth44({ nx, nz, rotFront, ccx, ccz });
  }

  function booth44Screen() {
    return canvasTexture(512, 300, (ctx, W, Hh) => {
      const gr = ctx.createLinearGradient(0, 0, W, Hh);
      gr.addColorStop(0, '#0d1a33'); gr.addColorStop(1, '#1d3d7a');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, Hh);
      ctx.strokeStyle = 'rgba(160,200,255,0.9)'; ctx.lineWidth = 6;
      const cy = 118;
      for (const cxx of [W / 2 - 62, W / 2 + 62]) { ctx.beginPath(); ctx.roundRect(cxx - 52, cy - 32, 104, 64, 26); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(W / 2 - 10, cy - 8); ctx.quadraticCurveTo(W / 2, cy - 18, W / 2 + 10, cy - 8); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
      ctx.font = '700 40px "IBM Plex Sans", Arial, sans-serif';
      ctx.fillText('EgoPoster', W / 2, 212);
      ctx.globalAlpha = 0.75; ctx.font = '500 20px "IBM Plex Sans", Arial, sans-serif';
      ctx.fillText('Action Intelligence · live demo', W / 2, 250);
    });
  }

  function buildBooth44({ ccx, ccz, nx, nz, rotFront }) {
    // Three pairs of glasses on the counter, the first-person interface of the demo.
    for (let k = -1; k <= 1; k++) {
      const gx = ccx + (nz ? k * 0.36 : 0), gz = ccz + (nx ? k * 0.36 : 0);
      box(mat.black, gx, 1.07, gz, 0.15, 0.045, 0.012, rotFront, false);
      box(mat.black, gx - (nz ? 0.075 : 0), 1.06, gz - (nx ? 0.075 : 0), 0.008, 0.02, 0.14, rotFront, false);
      box(mat.black, gx + (nz ? 0.075 : 0), 1.06, gz + (nx ? 0.075 : 0), 0.008, 0.02, 0.14, rotFront, false);
    }
  }

  // ---------------------------------------------------------------- coffee
  for (const [x, z, r] of venue.coffee) {
    const ring = new THREE.Shape();
    ring.absarc(0, 0, 1.75, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, 1.15, 0, Math.PI * 2, true);
    ring.holes.push(hole);
    const body = new THREE.ExtrudeGeometry(ring, { depth: 1.0, bevelEnabled: false, curveSegments: 40 }).rotateX(-Math.PI / 2).translate(x, 0, z);
    batch.add(mat.counter, body, null);
    const top = new THREE.ExtrudeGeometry(ring, { depth: 0.05, bevelEnabled: false, curveSegments: 40 }).rotateX(-Math.PI / 2).translate(x, 1.0, z);
    batch.add(mat.wood, top, null);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + 0.4;
      box(mat.black, x + Math.cos(a) * 1.45, 1.27, z + Math.sin(a) * 1.45, 0.34, 0.45, 0.36, -a);
    }
    obstacles.circles.push([x, z, 1.8]);
    for (let k = 0; k < 5; k++) {
      const a = k * Math.PI * 2 / 5 + 0.2, tx = x + Math.cos(a) * (r - 0.55), tz = z + Math.sin(a) * (r - 0.55);
      box(mat.black, tx, 0.55, tz, 0.06, 1.1, 0.06);
      box(mat.counter, tx, 1.1, tz, 0.62, 0.03, 0.62, a);
      box(mat.black, tx, 0.01, tz, 0.42, 0.02, 0.42);
      obstacles.circles.push([tx, tz, 0.32]);
    }
    const ct = signTexture(['Coffee'], { width: 512, height: 180, background: '#f6f1e8', color: '#3a2a1f', sizes: [96] });
    box(mat.black, x, 6.95, z, 0.012, 2.8, 0.012, 0, false);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2;
      sign(ct, 1.5, 0.52, x + Math.sin(a) * 0.76, 5.3, z + Math.cos(a) * 0.76, a);
    }
    box(mat.wood, x, 5.3, z, 1.5, 0.54, 1.5, 0, false);
  }

  // ---------------------------------------------------------------- poster boards
  const boards = venue.boards.map(([n, x, z, side, w]) => ({ n, x, z, side, w }));
  const route = new Set(venue.demo.route);
  for (const b of boards) b.demo = route.has(b.n);
  const panelY = 0.06;
  for (const row of venue.rows) {
    const rowBoards = boards.filter(b => Math.abs(b.z - row.z) < 0.01);
    for (const [x0, x1] of row.segments) {
      const len = x1 - x0, mid = (x0 + x1) / 2;
      box(mat.panel, mid, panelY + PANEL_H / 2, row.z, len, PANEL_H, PANEL_T);
      box(mat.alu, mid, panelY + PANEL_H + 0.015, row.z, len + 0.04, 0.03, PANEL_T + 0.03, 0, false);
      const xs = [...new Set(rowBoards.filter(b => b.x > x0 && b.x < x1).map(b => b.x))].sort((a, c) => a - c);
      const posts = [x0, x1];
      for (let k = 0; k + 1 < xs.length; k++) posts.push((xs[k] + xs[k + 1]) / 2);
      for (const px of posts) {
        box(mat.alu, px, panelY + PANEL_H / 2, row.z, 0.05, PANEL_H + 0.02, PANEL_T + 0.035);
        box(mat.alu, px, 0.02, row.z, 0.07, 0.04, 0.62, 0, false);
      }
      obstacles.segments.push([x0 + 0.03, row.z, x1 - 0.03, row.z, 0.1]);
    }
    // Board range on both row ends.
    if (rowBoards.length) {
      const nums = rowBoards.map(b => b.n);
      const tex = signTexture([`${Math.min(...nums)}–${Math.max(...nums)}`, row.id.replace('poster-row-', 'Row ')], {
        width: 512, height: 256, background: '#1d2227', color: '#ffffff', sizes: [104, 44] });
      const x0 = Math.min(...row.segments.map(s => s[0])), x1 = Math.max(...row.segments.map(s => s[1]));
      for (const [ex, dir] of [[x0, -1], [x1, 1]]) {
        box(mat.alu, ex + dir * 0.1, 1.5, row.z, 0.04, 3.0, 0.04, 0, false);
        sign(tex, 0.72, 0.36, ex + dir * 0.1, 2.95, row.z, Math.PI / 2, { double: true });
      }
    }
  }
  const posters = createPosters(boards, venue.papers, { detailCount: quality === 'low' ? 8 : 14, anisotropy });
  root.add(posters.group);

  // Hanging session banners.
  const bannerTex = signTexture(['Poster Session 6', 'Saturday 12 September · 15:00–17:00 · ExHall'], { width: 1024, height: 256, background: '#f7f5ef', color: '#1f2429', accent: '#556b88', sizes: [100, 38] });
  for (const [x, z] of [[27, -2.5], [-12, 28.5], [30, 28.5]]) {
    box(mat.black, x, 7.1, z, 6.2, 1.62, 0.04, 0, false);
    sign(bannerTex, 6.1, 1.52, x, 7.1, z + 0.025, 0);
    sign(bannerTex, 6.1, 1.52, x, 7.1, z - 0.025, Math.PI);
    for (const dx of [-2.5, 2.5]) box(mat.black, x + dx, (H - 1.3 + 7.9) / 2, z, 0.01, H - 1.3 - 7.9, 0.01, 0, false);
  }
  const exhibitionTex = signTexture(['Exhibition', 'ECCV 2026 · Malmö'], { width: 1024, height: 256, background: '#f7f5ef', color: '#1f2429', accent: '#9d675d', sizes: [104, 38] });
  box(mat.black, -26, 7.1, -3, 6.2, 1.62, 0.04, 0, false);
  sign(exhibitionTex, 6.1, 1.52, -26, 7.1, -2.975, 0);
  sign(exhibitionTex, 6.1, 1.52, -26, 7.1, -3.025, Math.PI);

  // Service labels (restaurant, registration, entrance).
  for (const label of venue.labels) {
    if (label.kind !== 'service' && label.kind !== 'entrance') continue;
    const tex = signTexture([label.text], { width: 768, height: 160, background: '#22272d', color: '#ffffff', sizes: [74] });
    const [x, z] = label.at;
    box(mat.black, x, 3.2, z, 2.4, 0.52, 0.04, 0, false);
    sign(tex, 2.36, 0.48, x, 3.2, z + 0.025, 0);
    sign(tex, 2.36, 0.48, x, 3.2, z - 0.025, Math.PI);
  }
  // Registration desk.
  {
    const reg = venue.labels.find(l => l.text === 'Registration');
    if (reg) {
      const [x, z] = reg.at;
      box(mat.counter, x, 0.55, z + 2.2, 7, 1.1, 0.8);
      box(carpetMat('#556b88'), x, 0.6, z + 2.62, 6.9, 0.7, 0.02, 0, false);
      obstacles.segments.push([x - 3.5, z + 2.2, x + 3.5, z + 2.2, 0.4]);
    }
  }

  batch.build(root);

  // ---------------------------------------------------------------- crowd
  const b44 = booths.find(b => b.id === '44');
  const spawn = { x: b44.front.cx + b44.front.nx * 1.7, z: b44.front.cz + b44.front.nz * 1.7, yaw: Math.atan2(b44.front.nx, b44.front.nz) };
  const standPoint = (b) => [b.x, b.z + b.side * 1.45];
  const keepClear = [[spawn.x, spawn.z, 1.3], ...boards.filter(b => b.demo).map(b => [...standPoint(b), 0.95])];
  // Is a figure of radius r at (x, z) inside a wall, a board row, a counter, a column or a bar?
  const segDist = (x, z, x1, z1, x2, z2) => {
    const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz;
    const t = l2 ? Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / l2)) : 0;
    return Math.hypot(x - (x1 + dx * t), z - (z1 + dz * t));
  };
  // With walls: true, only walls, board rows and rooms count (not counters, bars or columns).
  const solid = (x, z, r = 0.22, { walls = false } = {}) => obstacles.segments.some(([x1, z1, x2, z2, half]) => segDist(x, z, x1, z1, x2, z2) < half + r)
    || (!walls && obstacles.circles.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr + r - 0.05))
    || obstacles.polygons.some(poly => pointInPolygon(x, z, poly));
  const crowd = createCrowd({ boards, papers: venue.papers, booths, coffee: venue.coffee, rows: venue.rows, keepClear, solid, furniture: obstacles.circles.slice(), quality, busy: { 175: 3 }, extras: 1 });
  root.add(crowd.group);
  for (const c of crowd.obstacles) obstacles.circles.push(c);

  // ---------------------------------------------------------------- zones (for the HUD)
  const zones = [
    { id: 'booth44', name: 'Booth 44 · Action Intelligence', test: (x, z) => x > b44.x0 - 2 && x < b44.x1 + 2 && z > b44.z0 - 2.5 && z < b44.z1 + 1 },
    { id: 'demo', name: 'Demo Session 6', test: (x, z) => x > -13 && x < 7 && z > -23 && z < -15 },
    { id: 'coffee', name: 'Coffee', test: (x, z) => venue.coffee.some(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 < (r + 0.6) ** 2) },
    { id: 'rooms', name: 'Session rooms A–E', test: (x, z) => z > 38 && z < 42 && x > -40 && x < 42 },
    { id: 'posters-east', name: 'Poster Hall · Rows 1–7', test: (x, z) => x > 11 && x < 60 && z > -15 && z < 13.3 },
    { id: 'posters-south', name: 'Poster Hall · Rows 8–12', test: (x, z) => x > -55 && x < 60 && z > 13.3 && z < 41 },
    { id: 'exhibition', name: 'Exhibition', test: (x, z) => x > -55.5 && x < 11 && z > -21.5 && z < 12.2 },
    { id: 'collection', name: 'Poster collection', test: (x, z) => z < -21.5 && z > -39 && x > -55 && x < 29 },
    { id: 'lobby', name: 'Lobby · Registration', test: (x) => x < -55.5 },
  ];

  const boardIndex = new Map(boards.map(b => [b.n, b]));

  // Sun-like key light that follows the viewer, so shadows stay sharp where you look.
  const hemi = new THREE.HemisphereLight('#eef1f5', '#5d5b56', 0.55);
  const key = new THREE.DirectionalLight('#fff3e2', 1.25);
  key.position.set(20, 40, 12);
  key.castShadow = quality !== 'low';
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 90;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.035;
  const fill = new THREE.DirectionalLight('#dfe8ff', 0.35);
  fill.position.set(-30, 25, -40);
  root.add(hemi, key, key.target, fill);
  const keyOffset = new THREE.Vector3(16, 30, 11);

  function update(dt, camera, now, player) {
    posters.update(camera, now);
    crowd.update(dt, player, camera);
    const snap = 2;
    const tx = Math.round(camera.position.x / snap) * snap, tz = Math.round(camera.position.z / snap) * snap;
    key.target.position.set(tx, 0, tz);
    key.position.set(tx + keyOffset.x, keyOffset.y, tz + keyOffset.z);
  }

  const bbox = bounds(envelope);
  return {
    root, obstacles, boards, boardIndex, standPoint, spawn, zones, update, booths, signs,
    walkable: envelope, bounds: bbox, posters, crowd, poster: { w: POSTER_W, h: POSTER_H, y: POSTER_Y },
  };
}

