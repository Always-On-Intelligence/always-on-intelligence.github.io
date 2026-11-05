import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NavGrid } from '../engine/nav.mjs';
import { canvasTexture, carpetTexture, hashString, seeded, signTexture } from '../engine/textures.mjs';
import { createFigures, makePerson } from '../engine/figures.mjs';
import { SpatialHash, bodyBlocks } from '../engine/crowdspace.mjs';

export { interiorFor, interiorKind } from './kinds.mjs';

// Illustrative interiors for campus buildings. Only the building's name, its number of levels
// (from OSM) and its kind are real; layouts, furniture and people are invented, and the sign in
// every room says so. A room is built when you walk in and disposed of when you leave. Its
// windows sit on the façade you came in by, so the campus outside the glass is the real model.

// board: where the room's name board hangs (local u, v, height, facing).
export const KINDS = {
  lobby: { w: 18, d: 12, h: 3.6, floor: '#bdb7ab', wall: '#ecebe6', label: { en: 'lobby', zh: '大堂' }, board: [-4, 11.97, 2.3, Math.PI] },
  library: { w: 22, d: 16, h: 3.4, floor: '#5f6b78', wall: '#efeee9', label: { en: 'reading room', zh: '阅览室' }, board: [10.98, 11, 2.2, -Math.PI / 2] },
  canteen: { w: 24, d: 16, h: 4.2, floor: '#cbc5b8', wall: '#e9e6de', label: { en: 'food court', zh: '食堂' }, board: [-11.98, 6, 2.5, Math.PI / 2] },
  hall: { w: 14, d: 10, h: 3.2, floor: '#a89d8d', wall: '#eeebe4', label: { en: 'hall lobby', zh: '宿舍大堂' }, board: [6.98, 4.4, 1.9, -Math.PI / 2] },
  home: { w: 14, d: 10, h: 3.2, floor: '#9f9a90', wall: '#efece6', label: { en: 'residential lobby', zh: '住宅楼大堂' }, board: [6.98, 4.4, 1.9, -Math.PI / 2] },
  sports: { w: 30, d: 20, h: 7.5, floor: '#b88b5d', wall: '#dcdad4', label: { en: 'sports hall', zh: '体育馆' }, board: [0, 19.97, 5.6, Math.PI] },
  lecture: { w: 18, d: 16, h: 5.0, floor: '#6b7480', wall: '#e8e6e1', label: { en: 'lecture theatre', zh: '讲堂' }, board: [-8.98, 8, 3.2, Math.PI / 2] },
};

function tinted(geometry, hex) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.deleteAttribute('uv');
  const c = new THREE.Color(hex);
  const colors = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

function booksTexture() {
  return canvasTexture(512, 128, (ctx, w, h) => {
    const rnd = seeded(77);
    ctx.fillStyle = '#3a2d22'; ctx.fillRect(0, 0, w, h);
    for (const [y0, y1] of [[4, 60], [68, 124]]) {
      let x = 2;
      while (x < w - 2) {
        const bw = 5 + rnd() * 11, bh = (y1 - y0) * (0.72 + rnd() * 0.28);
        ctx.fillStyle = ['#8e3b32', '#2f4f6f', '#6b7c3a', '#c9a45c', '#5a4a6b', '#d8d2c4', '#2e5d57', '#9a6a3a'][rnd() * 8 | 0];
        ctx.fillRect(x, y1 - bh, bw - 1, bh);
        x += bw;
      }
    }
  });
}

function courtTexture() {
  return canvasTexture(1024, 600, (ctx, w, h) => {
    ctx.fillStyle = '#c0915f'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 5;
    ctx.strokeRect(20, 20, w - 40, h - 40);
    ctx.beginPath(); ctx.moveTo(w / 2, 20); ctx.lineTo(w / 2, h - 20); ctx.stroke();
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 70, 0, Math.PI * 2); ctx.stroke();
    for (const s of [-1, 1]) {
      const x = w / 2 + s * (w / 2 - 20);
      ctx.beginPath(); ctx.arc(x, h / 2, 230, s > 0 ? Math.PI / 2 : -Math.PI / 2, s > 0 ? Math.PI * 1.5 : Math.PI / 2); ctx.stroke();
      ctx.strokeRect(s > 0 ? x - 190 : x, h / 2 - 70, 190, 140);
    }
  });
}

function posterWall() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    const rnd = seeded(5);
    ctx.fillStyle = '#b89b72'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      const x = 12 + (i % 3) * 166 + rnd() * 10, y = 12 + Math.floor(i / 3) * 80 + rnd() * 6;
      ctx.fillStyle = ['#f4f1ea', '#e3a595', '#9fb8e0', '#9cc3ae', '#e2c07f'][rnd() * 5 | 0];
      ctx.fillRect(x, y, 140, 66);
      ctx.fillStyle = 'rgba(30,34,40,0.55)';
      for (let l = 0; l < 4; l++) ctx.fillRect(x + 10, y + 10 + l * 13, 60 + rnd() * 60, 5);
    }
  });
}

/**
 * Build a room for `kind` just inside a building, entered at `entrance` (a point on the façade)
 * heading `inward` (a unit vector). `ground(x, z)` is the terrain; the floor sits on its highest
 * point under the room so the terrain never shows through.
 */
export function buildInterior({ kind, name, levels, entrance, inward, ground, quality = 'high', lang = 'en' }) {
  const K = KINDS[kind] || KINDS.lobby;
  const W = K.w, D = K.d, H = K.h;
  const rot = Math.atan2(inward[0], inward[1]);
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const ex = entrance[0] + inward[0] * 0.35, ez = entrance[1] + inward[1] * 0.35;
  // Local u runs along the façade, v runs inward from the entrance wall (v = 0) to the back (v = D).
  const at = (u, v) => [ex + u * cs + v * sn, ez - u * sn + v * cs];
  let top = -Infinity;
  for (const u of [-W / 2, 0, W / 2]) for (const v of [0, D / 2, D]) { const [x, z] = at(u, v); top = Math.max(top, ground(x, z)); }
  const floorY = top + 0.08;
  const random = seeded(hashString(`${name}|${kind}`));
  const group = new THREE.Group();
  group.name = `interior:${name}`;
  group.position.y = floorY;
  const parts = { solid: [], glow: [], glass: [], ceiling: [], lights: [] };
  const textures = [];
  const box = (w, h, d, u, y, v, color, key = 'solid', ry = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.rotateY(rot + ry);
    const [x, z] = at(u, v);
    g.translate(x, y, z);
    parts[key].push(tinted(g, color));
  };
  const cyl = (r0, r1, h, u, y, v, color, seg = 10) => {
    const [x, z] = at(u, v);
    parts.solid.push(tinted(new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y, z), color));
  };
  const obstacles = [];
  const rect = (u0, v0, u1, v1) => obstacles.push({ poly: [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)] });
  const circle = (u, v, r) => obstacles.push({ circle: [...at(u, v), r] });
  const plane = (w, h, map, u, y, v, ry = 0, basic = false) => {
    textures.push(map);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic ? new THREE.MeshBasicMaterial({ map, toneMapped: false }) : new THREE.MeshStandardMaterial({ map, roughness: 0.75 }));
    const [x, z] = at(u, v);
    m.position.set(x, y, z);
    m.rotation.y = rot + ry;
    group.add(m);
    return m;
  };
  const people = [];
  const person = (u, v, yaw, extra = {}) => {
    const [x, z] = at(u, v);
    const p = makePerson(random, x, z, rot + yaw, 'room', { room: true, ...extra });
    people.push(p);
    return p;
  };
  const route = (points) => points.map(([u, v]) => at(u, v));

  // ---------------------------------------------------------------- shell
  const T = 0.15, doorW = 2.2;
  box(W + 2 * T, H, T, 0, H / 2, D + T / 2, K.wall);
  box(T, H, D, -W / 2 - T / 2, H / 2, D / 2, K.wall);
  box(T, H, D, W / 2 + T / 2, H / 2, D / 2, K.wall);
  for (const s of [-1, 1]) {
    const a = doorW / 2, b = W / 2, len = b - a, c = s * (a + b) / 2;
    box(len, 0.9, T, c, 0.45, -T / 2, '#d9d7d1');
    box(len, 0.35, T, c, H - 0.175, -T / 2, '#d9d7d1');
    box(len, H - 1.25, 0.02, c, 0.9 + (H - 1.25) / 2, -T / 2, '#bcd3dc', 'glass');
    const n = Math.max(1, Math.round(len / 1.8));
    for (let k = 0; k <= n; k++) box(0.07, H - 1.25, 0.14, s * (a + len * k / n), 0.9 + (H - 1.25) / 2, -T / 2, '#6d7278');
  }
  box(doorW, H - 2.4, T, 0, 2.4 + (H - 2.4) / 2, -T / 2, '#d9d7d1');
  for (const s of [-1, 1]) box(0.1, 2.4, 0.24, s * doorW / 2, 1.2, -T / 2, '#8b8f94');
  box(W + 0.3, 0.06, D + 0.3, 0, H + 0.03, D / 2, '#f2f1ec', 'ceiling');
  for (let u = -W / 2 + 2.4; u < W / 2 - 1; u += 3.4) for (let v = 2.2; v < D - 0.8; v += 3.6) box(1.2, 0.02, 0.6, u, H - 0.015, v, '#fffdf6', 'lights');
  const floorMap = kind === 'library' ? carpetTexture(K.floor) : null;
  if (floorMap) { floorMap.repeat.set(W / 2.5, D / 2.5); textures.push(floorMap); }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial(floorMap ? { map: floorMap, roughness: 0.95 } : { color: K.floor, roughness: kind === 'sports' ? 0.45 : 0.6 }));
  { const [x, z] = at(0, D / 2); floor.position.set(x, 0, z); floor.rotation.y = rot; }
  floor.name = 'interior-floor';
  group.add(floor);
  box(3, 0.012, 1.8, 0, 0.006, 1.1, '#454a50');

  // The room's name board, on the back wall.
  const levelText = levels ? (lang === 'zh' ? `共 ${levels} 层 · 当前 1 层` : `${levels} levels · you are on level 1`) : (lang === 'zh' ? '1 层' : 'Level 1');
  const note = lang === 'zh' ? '示意室内：布局和人物为虚构' : 'Illustrative interior: layout and people are invented';
  const boardW = kind === 'sports' ? 7 : 5.2;
  const [bu, bv, by, bry] = K.board;
  plane(boardW, boardW * 0.34, signTexture([name, `${lang === 'zh' ? K.label.zh : K.label.en} · ${levelText}`, note],
    { width: 1024, height: 348, background: '#1f2429', color: '#f4f4f1', sizes: [92, 44, 30], accent: '#e2c07f' }), bu, by, bv, bry);

  const tex = {};
  const figureState = {};

  // ---------------------------------------------------------------- rooms
  if (kind === 'lobby') {
    box(3.2, 1.05, 0.8, -5, 0.525, 5, '#d9d4c9'); box(3.4, 0.05, 0.95, -5, 1.075, 5, '#8f7e67'); rect(-6.7, 4.5, -3.3, 5.5);
    person(-5, 5.9, Math.PI, { state: 'stand' });
    for (const u of [4.6, 6.6]) { box(1.3, 2.3, 0.08, u, 1.15, D - 0.05, '#b7bcc1'); box(0.02, 2.3, 0.1, u, 1.15, D - 0.05, '#6d7278'); box(0.1, 0.16, 0.04, u + 0.85, 1.15, D - 0.06, '#e2c07f'); }
    box(0.04, 2.5, 2.6, -W / 2 + 0.03, 1.25, 8.4, '#3b3f44');
    plane(1.8, 0.34, signTexture(['Tutorial rooms  →'], { width: 512, height: 96, background: '#1f2429', color: '#f4f4f1' }), -W / 2 + 0.05, 2.75, 8.4, Math.PI / 2);
    for (const v of [2.4, 5.4]) { box(0.55, 0.45, 2.2, -W / 2 + 0.55, 0.225, v, '#8f7e67'); rect(-W / 2, v - 1.1, -W / 2 + 0.85, v + 1.1); }
    plane(3.4, 1.7, posterWall(), W / 2 - 0.02, 1.55, 5.2, -Math.PI / 2);
    person(W / 2 - 1.3, 4.6, Math.PI / 2 + 0.3, { state: 'stand', talking: true });
    person(W / 2 - 1.1, 5.8, Math.PI / 2 - 0.4, { state: 'stand' });
    const loopA = route([[0, 1.6], [2.2, 5], [5.6, D - 1.3], [5.6, D - 1.3], [-2, 7], [-W / 2 + 1.2, 8.4], [-2.4, 6.2], [-1.5, 3.2]]);
    for (let i = 0; i < 3; i++) person(0, 1.6, 0, { loop: loopA, leg: i * 2, speed: 1.1 + random() * 0.25, wait: [3, 5] });
  } else if (kind === 'library') {
    box(3, 1, 0.8, 6.5, 0.5, 2.8, '#d9d4c9'); box(3.2, 0.05, 0.95, 6.5, 1.02, 2.8, '#6b5a47'); rect(4.9, 2.3, 8.1, 3.3);
    person(6.5, 3.7, Math.PI, { state: 'stand' });
    const books = booksTexture(); textures.push(books);
    const bookPlanes = [];
    for (const v of [4.2, 6.7, 9.2, 11.7, 14.2]) {
      box(8.6, 2.1, 0.48, -5.8, 1.05, v, '#7a5f47');
      rect(-10.1, v - 0.3, -1.5, v + 0.3);
      for (const s of [-1, 1]) {
        const g = new THREE.PlaneGeometry(8.3, 1.9);
        g.rotateY(rot + (s < 0 ? Math.PI : 0));
        const [x, z] = at(-5.8, v + s * 0.245);
        g.translate(x, 1.05, z);
        bookPlanes.push(g);
      }
    }
    const shelfMesh = new THREE.Mesh(mergeGeometries(bookPlanes), new THREE.MeshStandardMaterial({ map: books, roughness: 0.85 }));
    group.add(shelfMesh);
    for (const u of [2.6, 6.2, 9.4]) {
      box(1.4, 0.04, 6.4, u, 0.74, 10, '#c9b79c'); box(0.1, 0.72, 5.8, u, 0.36, 10, '#6b5a47');
      rect(u - 0.72, 6.8, u + 0.72, 13.2);
      for (let v = 7.6; v <= 12.6; v += 1.25) {
        for (const s of [-1, 1]) {
          box(0.44, 0.05, 0.44, u + s * 1.02, 0.46, v, '#3a4048'); box(0.05, 0.45, 0.42, u + s * 1.24, 0.72, v, '#3a4048');
          if (random() < 0.42) person(u + s * 1.02, v, s < 0 ? Math.PI / 2 : -Math.PI / 2, { state: 'sit', typing: random() < 0.5, reading: true });
        }
        cyl(0.05, 0.08, 0.05, u, 0.78, v, '#2a2e33', 8);
        box(0.3, 0.02, 0.12, u, 1.12, v, '#fff4d6', 'glow');
      }
    }
    plane(3, 0.5, signTexture(['Quiet zone', 'Please keep noise to a minimum'], { width: 1024, height: 170, background: '#2f4f6f', color: '#f4f4f1', sizes: [70, 38] }), W / 2 - 0.02, 2.4, 6, -Math.PI / 2);
    // Browsers walk into an aisle between shelves and back out by the same end, never through a shelf.
    for (const k of [0, 1]) person(-1, 5.45 + k * 5, -Math.PI / 2, { loop: route([[-0.9, 5.45 + k * 5], [-9.2, 5.45 + k * 5], [-0.9, 5.45 + k * 5], [-0.9, 7.95 + k * 5], [-9.2, 7.95 + k * 5], [-0.9, 7.95 + k * 5]]), leg: k * 3, speed: 0.55, wait: [4, 8], reading: true });
  } else if (kind === 'canteen') {
    const stalls = [['Chicken Rice', '#a0463c'], ['Mala Hotpot', '#8e3b32'], ['Western', '#2f4f6f'], ['Indian', '#9a6a3a'], ['Japanese', '#556b88'], ['Drinks', '#3d5a4c']];
    stalls.forEach(([label, color], i) => {
      const u = -W / 2 + 2 + i * ((W - 4) / 5);
      box(3.3, 2.7, 0.1, u, 1.35, D - 0.1, color);
      box(3.1, 1.05, 0.8, u, 0.525, D - 1.4, '#d8d2c6'); box(3.2, 0.05, 0.9, u, 1.075, D - 1.4, '#8b8f94');
      for (let k = 0; k < 4; k++) box(0.5, 0.12, 0.35, u - 1.1 + k * 0.72, 1.16, D - 1.35, ['#e2c07f', '#c0582f', '#5b8c4a', '#f4f1ea'][(i + k) % 4]);
      plane(3.1, 0.62, signTexture([label], { width: 768, height: 154, background: color, color: '#fff8ee', sizes: [84] }), u, 3.05, D - 0.17, Math.PI);
      person(u, D - 0.55, Math.PI, { state: 'stand' });
      if (i === 0 || i === 2 || i === 4) for (let q = 0; q < 3; q++) person(u + (random() - 0.5) * 0.3, D - 2.6 - q * 0.85, 0, { state: 'stand', queue: true, phone: random() < 0.4 });
    });
    rect(-W / 2, D - 1.9, W / 2, D);
    for (const v of [4.6, 6.9, 9.2]) {
      for (const u of [-8.8, -4.4, 0, 4.4, 8.8]) {
        box(1.2, 0.04, 0.8, u, 0.74, v, '#ece8df'); cyl(0.06, 0.06, 0.72, u, 0.36, v, '#8b8f94', 8);
        rect(u - 0.62, v - 0.42, u + 0.62, v + 0.42);
        for (const [du, dv] of [[-0.42, -0.66], [0.42, -0.66], [-0.42, 0.66], [0.42, 0.66]]) {
          cyl(0.19, 0.19, 0.04, u + du, 0.46, v + dv, '#c0582f', 12); cyl(0.04, 0.04, 0.44, u + du, 0.22, v + dv, '#6d7278', 6);
          if (random() < 0.34) person(u + du, v + dv, dv < 0 ? 0 : Math.PI, { state: 'sit', eating: true, talking: random() < 0.3 });
        }
      }
    }
    box(2, 1.2, 0.6, W / 2 - 1.3, 0.6, 2.4, '#9aa0a6'); rect(W / 2 - 2.3, 2.1, W / 2, 2.7);
    // Walkers with trays keep to the aisles: stall, the aisle before the queues, a gap between
    // tables, the aisle by the entrance, the tray return, and back.
    // (The walker from the last stall uses the gap at 6.6: the one at 10.7 runs into the tray return.)
    [[-6, -6.6], [2, 2.2], [10, 6.6]].forEach(([su, gu], i) => {
      const loop = route([[su, 12.4], [su, 10.9], [gu, 10.9], [gu, 1.9], [W / 2 - 2.7, 1.9], [W / 2 - 2.7, 2.4], [W / 2 - 2.7, 1.9], [gu, 1.9], [gu, 10.9], [su, 10.9]]);
      person(0, 1.6, 0, { loop, leg: i * 3, speed: 1.0 + random() * 0.2, wait: [2, 5], tray: true });
    });
  } else if (kind === 'hall' || kind === 'home') {
    const mail = canvasTexture(512, 200, (ctx, w, h) => {
      ctx.fillStyle = '#8b8f94'; ctx.fillRect(0, 0, w, h);
      for (let r = 0; r < 5; r++) for (let c = 0; c < 12; c++) { ctx.fillStyle = '#c7ccd1'; ctx.fillRect(6 + c * 42, 6 + r * 39, 36, 33); ctx.fillStyle = '#4b5157'; ctx.fillRect(18 + c * 42, 16 + r * 39, 12, 3); }
    });
    plane(4, 1.56, mail, -W / 2 + 0.03, 1.4, 3.6, Math.PI / 2);
    person(-W / 2 + 0.9, 3.4, -Math.PI / 2, { state: 'stand', reading: true });
    for (const u of [2.8, 4.8]) { box(1.3, 2.3, 0.08, u, 1.15, D - 0.05, '#b7bcc1'); box(0.02, 2.3, 0.1, u, 1.15, D - 0.05, '#6d7278'); }
    for (const u of [-2.2, -0.8, 0.8, 2.2]) box(0.12, 1.0, 0.9, u, 0.5, 6.4, '#6d7278');
    box(0.9, 0.08, 0.06, -1.5, 0.95, 6.4, '#e2c07f'); box(0.9, 0.08, 0.06, 1.5, 0.95, 6.4, '#e2c07f');
    plane(3.2, 0.46, signTexture([kind === 'hall' ? 'Hall residents only beyond this point' : 'Residents only beyond this point'], { width: 1024, height: 148, background: '#a0463c', color: '#fff8ee', sizes: [64] }), 0, 2.6, 6.4, Math.PI);
    box(2.2, 0.45, 0.85, 4.6, 0.225, 2.4, '#556b88'); box(2.2, 0.5, 0.2, 4.6, 0.55, 2.85, '#556b88'); box(1, 0.4, 0.6, 4.6, 0.2, 1.4, '#c9b79c');
    rect(3.4, 1.0, 5.8, 3.0);
    person(4.2, 2.35, Math.PI, { state: 'sit', phone: true });
    box(1.6, 1.0, 0.7, -4.8, 0.5, 7.8, '#d9d4c9'); person(-4.8, 8.5, Math.PI, { state: 'stand' });
    for (let i = 0; i < 2; i++) person(0, 1.5, 0, { loop: route([[0, 1.4], [0, 5.8], [0, 7.4], [3.8, D - 1.2], [3.8, D - 1.2], [0, 7.4], [0, 5.8]]), leg: i * 3, speed: 1.1, wait: [2, 4] });
    obstacles.push({ wall: [at(-W / 2, 6.4), at(W / 2, 6.4)] });
  } else if (kind === 'sports') {
    const court = courtTexture(); textures.push(court);
    const cm = new THREE.Mesh(new THREE.PlaneGeometry(26, 15).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: court, roughness: 0.4 }));
    { const [x, z] = at(0, D / 2 + 0.8); cm.position.set(x, 0.01, z); cm.rotation.y = rot; }
    group.add(cm);
    for (const s of [-1, 1]) {
      box(0.25, 3.4, 0.25, s * 14.2, 1.7, D / 2 + 0.8, '#6d7278'); box(0.1, 1.05, 1.8, s * 13.7, 3.35, D / 2 + 0.8, '#f4f4f1');
      box(0.5, 0.04, 0.5, s * 13.35, 3.05, D / 2 + 0.8, '#c0582f');
      rect(s * 14.2 - 0.3, D / 2 + 0.5, s * 14.2 + 0.3, D / 2 + 1.1);
    }
    for (const s of [-1, 1]) { box(7, 0.45, 0.5, s * 7, 0.225, 0.9, '#8f7e67'); rect(s * 7 - 3.5, 0.6, s * 7 + 3.5, 1.2); }
    person(-5, 0.95, 0, { state: 'sit', phone: true }); person(6.2, 0.95, 0, { state: 'sit' });
    for (let i = 0; i < 8; i++) person(-10 + i * 2.8, 5 + (i % 3) * 3.5, 0, { play: [-12, 3.6, 12, D - 2.2], speed: 2.2 + random() * 1.2 });
  } else if (kind === 'lecture') {
    const slide = signTexture(['Lecture 7 · Sequence models', 'Attention, memory and long contexts', 'Illustrative slide'], { width: 1280, height: 720, background: '#fbfaf7', color: '#1f2429', sizes: [96, 54, 34] });
    plane(8, 4.5, slide, 0, 2.7, D - 0.09, Math.PI, true);
    box(8.3, 4.8, 0.06, 0, 2.7, D - 0.02, '#1b1e22');
    box(0.9, 1.1, 0.6, -5.5, 0.55, D - 2.4, '#8f7e67'); rect(-6, D - 2.7, -5, D - 2.1);
    person(-3, D - 2.1, Math.PI, { lecture: true, loop: route([[-4.5, D - 2.1], [3.8, D - 2.1]]), speed: 0.45, wait: [4, 7], talking: true });
    for (let r = 0; r < 6; r++) {
      const v = D - 5.2 - r * 1.55;
      for (const [u0, u1] of [[-W / 2 + 1, -1.3], [1.3, W / 2 - 1]]) {
        box(u1 - u0, 0.04, 0.45, (u0 + u1) / 2, 0.76, v, '#c9b79c'); box(u1 - u0, 0.72, 0.05, (u0 + u1) / 2, 0.36, v + 0.2, '#8f7e67');
        rect(u0, v - 0.25, u1, v + 0.25);
        for (let u = u0 + 0.35; u < u1 - 0.2; u += 0.62) {
          box(0.44, 0.05, 0.4, u, 0.46, v - 0.55, '#3a4048'); box(0.44, 0.42, 0.05, u, 0.7, v - 0.78, '#3a4048');
          if (random() < 0.45) person(u, v - 0.55, 0, { state: 'sit', typing: random() < 0.6 });
        }
      }
    }
  }

  // ---------------------------------------------------------------- merged meshes, people, navigation
  const meshes = [];
  if (parts.solid.length) meshes.push(new THREE.Mesh(mergeGeometries(parts.solid), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })));
  if (parts.glow.length) meshes.push(new THREE.Mesh(mergeGeometries(parts.glow), new THREE.MeshBasicMaterial({ vertexColors: true })));
  const ceiling = new THREE.Mesh(mergeGeometries(parts.ceiling), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  const lights = new THREE.Mesh(mergeGeometries(parts.lights), new THREE.MeshBasicMaterial({ vertexColors: true }));
  const glass = new THREE.Mesh(mergeGeometries(parts.glass), new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false }));
  glass.renderOrder = 2;
  group.add(...meshes, ceiling, lights, glass);

  function pose(p, out, ph) {
    if (p.state === 'sit') {
      out.bob = -0.42;
      out.legs = [-1.42, -1.42];
      if (p.typing) { out.armL = [-1.08 + Math.sin(ph * 9) * 0.05, 0.16]; out.armR = [-1.08 + Math.sin(ph * 9 + 1.3) * 0.05, -0.16]; out.headPitch = 0.14; }
      else if (p.eating) { out.armR = [-0.9 - Math.max(0, Math.sin(ph * 1.6)) * 0.7, -0.12]; out.armL = [-0.7, 0.14]; out.headPitch = 0.12; }
      else if (p.phone) { out.armR = [-1.05, -0.12]; out.headPitch = 0.35; }
      else if (p.reading) { out.armL = [-0.8, 0.2]; out.armR = [-0.8, -0.2]; out.headPitch = 0.3; }
      else { out.armL = [-0.6, 0.12]; out.armR = [-0.6, -0.12]; }
    } else if (p.phone || p.reading) {
      out.armR = [-1.05, -0.12]; out.headPitch = 0.3;
    }
    if (p.talking) {
      const k = p.state === 'sit' ? 0.5 : 1;
      out.armL = [(p.state === 'sit' ? -0.7 : -0.45) - Math.sin(ph * 2.3) * 0.25 * k, 0.14];
      out.armR = [(p.state === 'sit' ? -0.7 : -0.5) - Math.sin(ph * 2.9 + 1) * 0.3 * k, -0.14];
    }
    if (p.tray) { out.armL = [-1.0, 0.1]; out.armR = [-1.0, -0.1]; }
    if (p.queue) out.headYaw = Math.sin(ph * 0.4) * 0.5;
  }
  function stepTo(p, tx, tz, dt) {
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz), s = p.speed * dt;
    if (d <= s) { p.x = tx; p.z = tz; return true; }
    p.x += dx / d * s; p.z += dz / d * s;
    p.yaw = Math.atan2(dx, dz);
    p.walking = true;
    p.stride = (p.stride || 0) + dt * p.speed * 5.2;
    return false;
  }
  // Wait while someone stands right in the way; after a while, pick another way.
  function inTheWay(p, tx, tz, dt) {
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1;
    if (!grid.near(p.x + dx / d * 0.45, p.z + dz / d * 0.45, 0.44, p).length) { p.waited = 0; return false; }
    p.waited = (p.waited || 0) + dt;
    p.walking = false;
    return true;
  }
  function step(p, dt) {
    p.walking = false;
    if (p.pause > 0) { p.pause -= dt; return; }
    if (p.loop) {
      const target = p.loop[p.leg % p.loop.length];
      if (inTheWay(p, target[0], target[1], dt)) { if (p.waited > 1.6) { p.leg++; p.waited = 0; } return; }
      if (stepTo(p, target[0], target[1], dt)) {
        p.leg++;
        if (p.wait && random() < 0.5) p.pause = p.wait[0] + random() * (p.wait[1] - p.wait[0]);
      }
    } else if (p.play) {
      if (!p.goal) { const [u0, v0, u1, v1] = p.play; p.goal = at(u0 + random() * (u1 - u0), v0 + random() * (v1 - v0)); }
      if (inTheWay(p, p.goal[0], p.goal[1], dt)) { if (p.waited > 0.4) { p.goal = null; p.waited = 0; } return; }
      if (stepTo(p, p.goal[0], p.goal[1], dt)) { p.goal = null; if (random() < 0.3) p.pause = 0.4 + random(); }
    } else if (p.queue) {
      p.shuffle = (p.shuffle || 4 + random() * 6) - dt;
      if (p.shuffle < 0) { p.shuffle = 5 + random() * 6; p.yaw = p.baseYaw + (random() - 0.5) * 0.6; }
    }
  }
  for (const p of people) {
    if (p.loop) { p.leg ||= 0; const [x, z] = p.loop[p.leg % p.loop.length]; p.x = x + (random() - 0.5) * 0.6; p.z = z + (random() - 0.5) * 0.6; p.speed ||= 1.1; }
    if (p.play) p.speed ||= 2.4;
  }
  const figures = createFigures(people, { quality, groundAt: () => 0, pose, radius: 40 });
  group.add(figures.group);
  const grid = new SpatialHash(2);

  const corners = [at(-W / 2, 0), at(W / 2, 0), at(W / 2, D), at(-W / 2, D)];
  const doorOut = [at(-doorW / 2 + 0.15, -1.6), at(doorW / 2 - 0.15, -1.6), at(doorW / 2 - 0.15, 0.1), at(-doorW / 2 + 0.15, 0.1)];
  const xs = [...corners, ...doorOut].map(p => p[0]), zs = [...corners, ...doorOut].map(p => p[1]);
  const nav = new NavGrid({ minX: Math.min(...xs) - 1, minZ: Math.min(...zs) - 1, maxX: Math.max(...xs) + 1, maxZ: Math.max(...zs) + 1, cell: 0.2, radius: 0.28 });
  nav.fillPolygon(corners);
  nav.fillPolygon(doorOut);
  const seg = (a, b) => nav.blockSegment(a[0], a[1], b[0], b[1]);
  seg(at(-W / 2, 0), at(-doorW / 2, 0));
  seg(at(doorW / 2, 0), at(W / 2, 0));
  seg(at(-W / 2, 0), at(-W / 2, D));
  seg(at(W / 2, 0), at(W / 2, D));
  seg(at(-W / 2, D), at(W / 2, D));
  for (const o of obstacles) {
    if (o.poly) nav.blockPolygon(o.poly);
    else if (o.circle) nav.blockCircle(...o.circle);
    else if (o.wall) seg(...o.wall);
  }

  return {
    kind, name, levels, group, floorY, nav, people, figures, floor,
    label: K.label,
    pickables: [figures.group, floor],
    spots: { door: at(0, -1.0), inside: at(0, 1.7), outside: at(0, -2.2) },
    yawIn: Math.atan2(-inward[0], -inward[1]),
    yawOut: Math.atan2(inward[0], inward[1]),
    setVisible(on) { group.visible = on; },
    setCutaway(on) { ceiling.visible = lights.visible = !on; },
    update(dt, player, camera) {
      if (!group.visible) return;
      grid.fill(people);
      figures.update(dt, player, camera, step);
    },
    blocks: (x, z, fx, fz) => bodyBlocks(grid, x, z, fx, fz),
    debug: { obstacles },
    dispose() {
      group.traverse((o) => {
        o.geometry?.dispose?.();
        for (const m of [].concat(o.material || [])) m.dispose?.();
      });
      for (const t of textures) t.dispose?.();
      group.removeFromParent();
    },
  };
}
