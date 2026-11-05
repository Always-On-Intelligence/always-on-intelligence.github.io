import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NavGrid } from '../engine/nav.mjs';
import { canvasTexture, carpetTexture, seeded } from '../engine/textures.mjs';
import { createFigures, makePerson } from '../engine/figures.mjs';
import { SpatialHash, bodyBlocks } from '../engine/crowdspace.mjs';
import { ROOM } from './places.mjs';

// S-Lab, illustrative. NTU lists S-Lab for Advanced Intelligence at ABN-02b-11 in Academic Block
// North; the room itself is invented. It sits inside the ABN massing one level above the ground,
// with its windows on the real south façade, so the campus outside the glass is the real model.
// The lab mates are fictional.

export { ROOM };
const PODS = [[-72.2, 116.4], [-66.2, 116.4], [-72.2, 121.6], [-66.2, 121.6]];

function tinted(geometry, hex) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.deleteAttribute('uv');
  const c = new THREE.Color(hex);
  const colors = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

function screenAtlas() {
  // 4 × 4 monitor screens: code, plots, a terminal, a paper.
  return canvasTexture(1024, 576, (ctx) => {
    const rnd = seeded(11);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const x = col * 256, y = row * 144, kind = (row * 4 + col) % 4;
        ctx.save();
        ctx.beginPath(); ctx.rect(x, y, 256, 144); ctx.clip();
        if (kind === 0) {
          ctx.fillStyle = '#1e2329'; ctx.fillRect(x, y, 256, 144);
          for (let l = 0; l < 13; l++) {
            let cx = x + 10 + (rnd() * 3 | 0) * 12;
            for (let w = 0; w < 4; w++) {
              const len = 12 + rnd() * 44;
              ctx.fillStyle = ['#8fb3d9', '#c9a86a', '#9fc79b', '#d7d7d7', '#c98f8f'][rnd() * 5 | 0];
              ctx.fillRect(cx, y + 8 + l * 10.5, len, 4);
              cx += len + 6;
            }
          }
        } else if (kind === 1) {
          ctx.fillStyle = '#f7f7f4'; ctx.fillRect(x, y, 256, 144);
          ctx.strokeStyle = '#c9ccd0'; ctx.lineWidth = 1;
          for (let g = 0; g < 5; g++) { ctx.beginPath(); ctx.moveTo(x + 16, y + 20 + g * 26); ctx.lineTo(x + 244, y + 20 + g * 26); ctx.stroke(); }
          for (const [color, k] of [['#3b6ea8', 0.9], ['#c0582f', 0.6], ['#5b8c4a', 0.35]]) {
            ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath();
            for (let s = 0; s <= 40; s++) {
              const px = x + 16 + s * 5.7, py = y + 124 - (1 - Math.exp(-s / (8 + k * 10))) * 96 * k - rnd() * 4;
              s ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
            }
            ctx.stroke();
          }
        } else if (kind === 2) {
          ctx.fillStyle = '#0f1512'; ctx.fillRect(x, y, 256, 144);
          ctx.fillStyle = '#7fd08a'; ctx.font = '500 9px "IBM Plex Mono", monospace';
          for (let l = 0; l < 11; l++) ctx.fillText(`epoch ${String(l + 12).padStart(3, ' ')}  loss ${(0.92 - l * 0.031 - rnd() * 0.01).toFixed(4)}  acc ${(61 + l * 1.3).toFixed(1)}`, x + 8, y + 16 + l * 11.5);
        } else {
          ctx.fillStyle = '#e9e8e4'; ctx.fillRect(x, y, 256, 144);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 70, y + 6, 116, 138);
          ctx.fillStyle = '#2a2d31'; ctx.fillRect(x + 82, y + 16, 90, 5);
          ctx.fillStyle = '#9a9ea3';
          for (let l = 0; l < 16; l++) ctx.fillRect(x + 80, y + 30 + l * 6.6, 60 + rnd() * 40, 2.2);
        }
        ctx.restore();
      }
    }
  });
}

function slideTexture() {
  return canvasTexture(1024, 576, (ctx, w, h) => {
    ctx.fillStyle = '#fbfaf7'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1f2429'; ctx.font = '600 44px "IBM Plex Sans", Arial, sans-serif';
    ctx.fillText('Weekly group meeting', 56, 92);
    ctx.fillStyle = '#6b7178'; ctx.font = '400 24px "IBM Plex Sans", Arial, sans-serif';
    ctx.fillText('Ablation plan (draft) · settings A to D', 56, 132);
    const vals = [0.52, 0.61, 0.66, 0.0];
    vals.forEach((v, i) => {
      const x = 90 + i * 210, base = 470;
      ctx.fillStyle = '#e4e2dc'; ctx.fillRect(x, base - 280, 120, 280);
      ctx.fillStyle = v ? '#3b6ea8' : '#e4e2dc';
      if (v) ctx.fillRect(x, base - v * 400, 120, v * 400);
      ctx.fillStyle = '#1f2429'; ctx.font = '500 24px "IBM Plex Mono", monospace';
      ctx.fillText(v ? v.toFixed(2) : 'to run', x + (v ? 22 : 12), v ? base - v * 400 - 14 : base - 140);
      ctx.fillStyle = '#6b7178'; ctx.fillText('ABCD'[i], x + 52, base + 36);
    });
    ctx.fillStyle = '#9a9ea3'; ctx.font = '400 18px "IBM Plex Sans", Arial, sans-serif';
    ctx.fillText('Illustrative slide', w - 200, h - 24);
  });
}

function whiteboardTexture() {
  // A marker sketch of the loop: Sensing, Memory and Action.
  return canvasTexture(1024, 340, (ctx, w, h) => {
    ctx.fillStyle = '#f6f7f6'; ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const node = (x, y, text, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(x, y, 86, 38, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = color; ctx.font = 'italic 600 30px "IBM Plex Sans", Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.fillText(text, x, y + 10);
    };
    const arrow = (x1, y1, x2, y2, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo((x1 + x2) / 2 + (y2 - y1) * 0.15, (y1 + y2) / 2 - (x2 - x1) * 0.15, x2, y2); ctx.stroke();
      const a = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - 16 * Math.cos(a - 0.4), y2 - 16 * Math.sin(a - 0.4));
      ctx.moveTo(x2, y2); ctx.lineTo(x2 - 16 * Math.cos(a + 0.4), y2 - 16 * Math.sin(a + 0.4)); ctx.stroke();
    };
    node(300, 80, 'Memory', '#2f5f9e');
    node(150, 250, 'Sensing', '#2d7a4f');
    node(450, 250, 'Action', '#b0452c');
    arrow(190, 212, 250, 116, '#2d7a4f'); arrow(262, 122, 204, 218, '#2f5f9e');
    arrow(350, 116, 410, 212, '#2f5f9e'); arrow(396, 218, 336, 122, '#b0452c');
    arrow(236, 250, 362, 250, '#2d7a4f'); arrow(362, 268, 236, 268, '#b0452c');
    ctx.textAlign = 'left'; ctx.fillStyle = '#34383d'; ctx.font = 'italic 26px "IBM Plex Sans", Arial, sans-serif';
    ctx.fillText('when to speak?', 620, 90);
    ctx.fillText('what to keep? (not 3rd-party health)', 620, 150);
    ctx.fillText('rules change only at a boundary', 620, 210);
    ctx.strokeStyle = '#b0452c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(620, 226); ctx.lineTo(960, 226); ctx.stroke();
  });
}

function labelTexture(lines, { width = 512, height = 128, bg = '#1f2429', color = '#f4f4f1', sizes = [54, 26] } = {}) {
  return canvasTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color; ctx.textAlign = 'center';
    lines.forEach((line, i) => {
      ctx.font = `${i ? 400 : 600} ${sizes[i] || 24}px "IBM Plex Sans", Arial, sans-serif`;
      ctx.fillText(line, w / 2, lines.length === 1 ? h / 2 + sizes[0] * 0.35 : h * (i ? 0.8 : 0.46));
    });
  });
}

/** Build the lab. ground(x, z) is the terrain; the floor sits one level above its highest point. */
export function buildLab({ ground, quality = 'high' }) {
  const { x0, x1, z0, z1, h, glass: gx, door } = ROOM;
  const xc = (x0 + x1) / 2, zc = (z0 + z1) / 2;
  let top = -Infinity;
  for (const x of [x0, xc, x1]) for (const z of [z0, zc, z1]) top = Math.max(top, ground(x, z));
  const floorY = Math.round((top + 4.2) * 10) / 10;

  const group = new THREE.Group();
  group.name = 'lab';
  group.position.y = floorY;
  group.visible = false;
  const random = seeded(4402);
  const parts = { solid: [], glow: [], glass: [], ceiling: [] };
  const box = (w, hh, d, x, y, z, color, key = 'solid', ry = 0) => {
    const g = new THREE.BoxGeometry(w, hh, d);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    parts[key].push(tinted(g, color));
  };
  const cyl = (r0, r1, hh, x, y, z, color, seg = 10) => parts.solid.push(tinted(new THREE.CylinderGeometry(r0, r1, hh, seg).translate(x, y, z), color));
  const obstacles = [];
  const rect = (xa, za, xb, zb) => obstacles.push([[xa, za], [xb, za], [xb, zb], [xa, zb]]);

  // ---------------------------------------------------------------- shell
  const WALL = '#ecebe6';
  box(door[0] - x0, h, 0.15, (x0 + door[0]) / 2, h / 2, z0 - 0.075, WALL);
  box(x1 - door[1], h, 0.15, (door[1] + x1) / 2, h / 2, z0 - 0.075, WALL);
  box(door[1] - door[0], h - 2.2, 0.15, (door[0] + door[1]) / 2, 2.2 + (h - 2.2) / 2, z0 - 0.075, WALL);
  for (const x of door) box(0.08, 2.2, 0.2, x, 1.1, z0 - 0.075, '#8b8f94');
  // A short vestibule behind the door, so the doorway does not open onto the outside.
  box(door[1] - door[0] + 0.3, h, 0.1, (door[0] + door[1]) / 2, h / 2, z0 - 1.6, '#d8d6d0');
  box(0.1, h, 1.5, door[0] - 0.1, h / 2, z0 - 0.85, '#d8d6d0');
  box(0.1, h, 1.5, door[1] + 0.1, h / 2, z0 - 0.85, '#d8d6d0');
  box(0.15, h, z1 - z0, x0 - 0.075, h / 2, zc, WALL);
  box(0.15, h, z1 - z0, x1 + 0.075, h / 2, zc, WALL);
  // South: windows on the façade, sill and header solid.
  box(x1 - x0, 0.8, 0.2, xc, 0.4, z1 + 0.1, '#d9d7d1');
  box(x1 - x0, 0.3, 0.2, xc, h - 0.15, z1 + 0.1, '#d9d7d1');
  box(x1 - x0, 0.04, 0.34, xc, 0.82, z1 + 0.03, '#bdbab3');
  for (let x = x0; x <= x1 + 0.01; x += 1.75) box(0.07, h - 1.1, 0.14, x, 0.8 + (h - 1.1) / 2, z1 + 0.1, '#6d7278');
  box(x1 - x0, h - 1.1, 0.02, xc, 0.8 + (h - 1.1) / 2, z1 + 0.12, '#bcd3dc', 'glass');
  // Ceiling and light panels.
  box(x1 - x0 + 0.3, 0.05, z1 - z0 + 0.3, xc, h + 0.025, zc, '#f2f1ec', 'ceiling');
  for (let x = x0 + 2.5; x < x1 - 1; x += 3.2) for (const z of [114.4, 118.5, 122.6]) box(1.2, 0.02, 0.6, x, h - 0.012, z, '#fffdf6', 'glow');
  // Meeting-room floor and glass partition, with the doorway near the north wall.
  box(gx - x0, 0.01, z1 - z0, (x0 + gx) / 2, 0.005, zc, '#b49d80');
  box(0.02, h - 0.3, z1 - (z0 + 1.5), gx, (h - 0.3) / 2, (z0 + 1.5 + z1) / 2, '#cfdfe5', 'glass');
  box(0.06, 0.05, z1 - (z0 + 1.5), gx, 0.025, (z0 + 1.5 + z1) / 2, '#6d7278');
  box(0.06, 0.3, z1 - z0, gx, h - 0.15, zc, '#e4e2dc');
  for (let z = z0 + 1.5; z <= z1; z += 1.9) box(0.05, h - 0.3, 0.05, gx, (h - 0.3) / 2, z, '#6d7278');

  // ---------------------------------------------------------------- desks, pods of four
  const seats = [];
  const screens = [];
  const chair = (x, z, yaw, color = '#3a4048') => {
    box(0.46, 0.06, 0.44, x, 0.46, z, color, 'solid', yaw);
    box(0.44, 0.5, 0.05, x - Math.sin(yaw) * 0.22, 0.77, z - Math.cos(yaw) * 0.22, color, 'solid', yaw);
    cyl(0.03, 0.03, 0.4, x, 0.23, z, '#2a2e33', 6);
    cyl(0.26, 0.26, 0.03, x, 0.03, z, '#2a2e33', 10);
  };
  let cell = 0;
  PODS.forEach(([cx, cz], podIndex) => {
    for (const row of [-1, 1]) {
      for (const col of [-1, 1]) {
        const dx = cx + col * 0.72, dz = cz + row * 0.39, mz = cz + row * 0.12;
        box(1.4, 0.03, 0.74, dx, 0.735, dz, '#d9d4c9');
        box(0.03, 0.72, 0.68, dx - 0.68, 0.36, dz, '#b9b3a7');
        box(0.03, 0.72, 0.68, dx + 0.68, 0.36, dz, '#b9b3a7');
        box(0.6, 0.36, 0.03, dx, 1.03, mz, '#1d2126');
        box(0.05, 0.2, 0.05, dx, 0.84, mz, '#2a2e33');
        box(0.22, 0.015, 0.16, dx, 0.755, mz, '#2a2e33');
        box(0.42, 0.02, 0.14, dx, 0.76, dz + row * 0.1, '#2b2f35');
        if (random() > 0.4) cyl(0.04, 0.035, 0.1, dx + 0.45, 0.8, dz + row * 0.12, ['#f4f4f1', '#c0582f', '#3b6ea8'][random() * 3 | 0], 8);
        if (random() > 0.5) box(0.3, 0.012, 0.22, dx - 0.4, 0.757, dz + row * 0.05, '#f7f6f2');
        const sg = new THREE.PlaneGeometry(0.56, 0.32);
        if (row === -1) sg.rotateY(Math.PI);
        sg.translate(dx, 1.03, mz + row * 0.017);
        const c = cell++ % 16, u = sg.attributes.uv;
        for (let i = 0; i < u.count; i++) u.setXY(i, ((c % 4) + u.getX(i)) / 4, (3 - Math.floor(c / 4) + u.getY(i)) / 4);
        screens.push(sg);
        const sx = dx, sz = cz + row * 1.2, yaw = row === -1 ? 0 : Math.PI;
        chair(sx, sz, yaw);
        seats.push({ id: `p${podIndex}${row < 0 ? 'n' : 's'}${col < 0 ? 'w' : 'e'}`, x: sx, z: sz, yaw, look: [dx, floorY + 1.0, mz] });
      }
    }
    box(2.84, 0.34, 0.03, cx, 0.92, cz, '#c7ccd1');
    rect(cx - 1.42, cz - 0.78, cx + 1.42, cz + 0.78);
  });

  // ---------------------------------------------------------------- meeting room
  const table = { x: -81.7, z: 118.8 };
  box(3.6, 0.04, 1.3, table.x, 0.74, table.z, '#e7e2d8');
  box(0.1, 0.72, 0.8, table.x - 1.3, 0.36, table.z, '#8f949a');
  box(0.1, 0.72, 0.8, table.x + 1.3, 0.36, table.z, '#8f949a');
  rect(table.x - 1.8, table.z - 0.65, table.x + 1.8, table.z + 0.65);
  const meet = [
    { id: 'm1', x: -82.9, z: 117.55, yaw: 0 }, { id: 'm2', x: -81.7, z: 117.55, yaw: 0 }, { id: 'm3', x: -80.5, z: 117.55, yaw: 0 },
    { id: 'm4', x: -82.9, z: 120.05, yaw: Math.PI }, { id: 'm5', x: -81.7, z: 120.05, yaw: Math.PI }, { id: 'm6', x: -80.5, z: 120.05, yaw: Math.PI },
    { id: 'head', x: -78.9, z: 118.8, yaw: -Math.PI / 2 },
  ];
  for (const s of meet) { chair(s.x, s.z, s.yaw, '#4a5058'); seats.push({ ...s, look: [table.x, floorY + 0.8, table.z] }); }
  for (const [x, z] of [[-83.2, 118.6], [-80.2, 119.1]]) box(0.3, 0.012, 0.22, x, 0.765, z, '#f7f6f2');
  // Wall screen and credenza on the west wall.
  box(0.05, 1.56, 2.7, x0 + 0.03, 1.55, table.z, '#1b1e22');
  box(0.45, 0.7, 2.4, x0 + 0.25, 0.35, table.z, '#cfc9bd');
  rect(x0, table.z - 1.25, x0 + 0.5, table.z + 1.25);

  // ---------------------------------------------------------------- shelves, charging table, odds
  const shelf = (z) => {
    const x = x1 - 0.25;
    box(0.45, 2.0, 0.03, x, 1.0, z - 0.99, '#9aa0a6');
    box(0.45, 2.0, 0.03, x, 1.0, z + 0.99, '#9aa0a6');
    for (const y of [0.05, 0.55, 1.05, 1.55, 1.98]) box(0.45, 0.025, 2.0, x, y, z, '#b7bcc1');
    for (const y of [0.07, 0.57, 1.07, 1.57]) {
      let zz = z - 0.9;
      while (zz < z + 0.8) {
        const w = 0.22 + random() * 0.3, hh = 0.16 + random() * 0.26;
        if (!(y === 1.07 && Math.abs(zz + w / 2 - z) < 0.3 && z > 116)) box(0.36, hh, w, x, y + hh / 2, zz + w / 2, ['#c9c2b4', '#8b8f94', '#3b6ea8', '#d9d4c9', '#5b8c4a', '#a0463c'][random() * 6 | 0]);
        zz += w + 0.05;
      }
    }
    rect(x1 - 0.5, z - 1.02, x1, z + 1.02);
  };
  shelf(114.2);
  shelf(116.9);
  box(1.3, 0.04, 0.6, -59.6, 0.74, 124.2, '#d9d4c9');
  box(0.04, 0.72, 0.55, -60.2, 0.36, 124.2, '#8f949a');
  box(0.04, 0.72, 0.55, -59.0, 0.36, 124.2, '#8f949a');
  box(0.34, 0.03, 0.06, -59.2, 0.775, 124.35, '#f4f4f1');
  box(0.32, 0.015, 0.22, -59.35, 0.77, 124.05, '#2b2f35');
  rect(-60.3, 123.85, -58.9, 124.55);
  box(0.6, 0.9, 0.5, -75.6, 0.45, z0 + 0.35, '#b7bcc1');
  rect(-75.95, z0, -75.25, z0 + 0.65);
  for (const [x, z] of [[-76.7, 124.4], [-85.4, 124.4], [-58.6, 112.6]]) {
    cyl(0.2, 0.16, 0.42, x, 0.21, z, '#d9d4c9', 10);
    parts.solid.push(tinted(new THREE.IcosahedronGeometry(0.42, 0).scale(1, 1.3, 1).translate(x, 0.95, z), '#5b7d4a'));
    obstacles.push({ circle: [x, z, 0.3] });
  }
  // The shared depth camera: a small bar with two lenses, first seen on the charging table.
  const depthCamera = new THREE.Group();
  depthCamera.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.045, 0.045), new THREE.MeshStandardMaterial({ color: '#2b2f35', roughness: 0.5 })));
  for (const x of [-0.07, 0.07]) {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 12).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#0d1a2a', roughness: 0.2 }));
    lens.position.set(x, 0, 0.024);
    depthCamera.add(lens);
  }
  group.add(depthCamera);
  const cameraSpots = { charger: [-59.8, 0.785, 124.25, 0], shelf: [x1 - 0.25, 1.1, 116.9, Math.PI / 2] };
  function placeCamera(where) {
    if (!where) { depthCamera.visible = false; return; }
    const spot = Array.isArray(where) ? where : cameraSpots[where];
    depthCamera.visible = true;
    depthCamera.position.set(spot[0], spot[1], spot[2]);
    depthCamera.rotation.y = spot[3] || 0;
  }
  placeCamera('charger');

  // ---------------------------------------------------------------- merged meshes
  const solid = new THREE.Mesh(mergeGeometries(parts.solid), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }));
  const glow = new THREE.Mesh(mergeGeometries(parts.glow), new THREE.MeshBasicMaterial({ vertexColors: true }));
  const ceilingMesh = new THREE.Mesh(mergeGeometries(parts.ceiling), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  const glassMesh = new THREE.Mesh(mergeGeometries(parts.glass), new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false }));
  glassMesh.renderOrder = 2;
  const monitorMesh = new THREE.Mesh(mergeGeometries(screens), new THREE.MeshBasicMaterial({ map: screenAtlas(), toneMapped: false }));
  const carpet = carpetTexture('#6f7a86');
  carpet.repeat.set(9, 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate(xc, 0, zc), new THREE.MeshStandardMaterial({ map: carpet, roughness: 0.95 }));
  floor.name = 'lab-floor';
  const plane = (w, hh, map, x, y, z, ry, basic = false) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), basic ? new THREE.MeshBasicMaterial({ map, toneMapped: false }) : new THREE.MeshStandardMaterial({ map, roughness: 0.6 }));
    m.rotation.y = ry;
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };
  plane(2.6, 1.46, slideTexture(), x0 + 0.06, 1.55, table.z, Math.PI / 2, true);
  box(3.7, 1.3, 0.04, -69, 1.5, z0 + 0.02, '#9aa0a6');
  plane(3.6, 1.2, whiteboardTexture(), -69, 1.5, z0 + 0.045, 0);
  plane(3.0, 0.47, labelTexture(['S-Lab for Advanced Intelligence', 'ABN-02b-11 · illustrative room'], { width: 1024, height: 160, sizes: [58, 28] }), -69, 2.62, z0 + 0.03, 0);
  plane(0.42, 0.1, labelTexture(['SHELF A'], { sizes: [60] }), x1 - 0.02, 2.1, 114.2, -Math.PI / 2);
  plane(0.42, 0.1, labelTexture(['SHELF B'], { sizes: [60] }), x1 - 0.02, 2.1, 116.9, -Math.PI / 2);
  plane(0.3, 0.06, labelTexture(['DEPTH CAMERA'], { bg: '#f4f4f1', color: '#1f2429', sizes: [44] }), x1 - 0.475, 1.1, 116.9, -Math.PI / 2);
  group.add(solid, glow, ceilingMesh, glassMesh, monitorMesh, floor);
  for (const m of [solid, floor]) m.receiveShadow = false;

  // ---------------------------------------------------------------- navigation
  const nav = new NavGrid({ minX: x0 - 1, minZ: z0 - 2, maxX: x1 + 1, maxZ: z1 + 1, cell: 0.2, radius: 0.28 });
  nav.fillPolygon([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
  nav.fillPolygon([[door[0], z0 - 1.5], [door[1], z0 - 1.5], [door[1], z0 + 0.1], [door[0], z0 + 0.1]]);
  nav.blockSegment(x0, z0, door[0], z0);
  nav.blockSegment(door[1], z0, x1, z0);
  nav.blockSegment(x0, z0, x0, z1);
  nav.blockSegment(x1, z0, x1, z1);
  nav.blockSegment(x0, z1, x1, z1);
  nav.blockSegment(gx, z0 + 1.5, gx, z1);
  for (const o of obstacles) (o.circle ? nav.blockCircle(...o.circle) : nav.blockPolygon(o));

  // ---------------------------------------------------------------- lab mates (fictional)
  const people = [];
  const person = (role, shirt, pants, hair, extra = {}) => {
    const p = makePerson(random, x0 + 2, z0 + 2, 0, 'lab', { role, shirt, pants, hair, lab: true, registered: true, hidden: true, ...extra });
    people.push(p);
    return p;
  };
  const cast = {
    supervisor: person('supervisor', '#e8e6df', '#2b3340', '#8f8f8f'),
    mateA: person('mateA', '#556b88', '#1f2328', '#1a1512'),
    mateB: person('mateB', '#a0463c', '#3a3f45', '#2c211a'),
    senior: person('senior', '#3d5a4c', '#4a4f56', '#141414'),
    bg1: person('bg1', '#6b7078', '#1c2a3a', '#4a3526'),
    bg2: person('bg2', '#c9c2b4', '#2b3340', '#1a1512'),
  };
  function pose(p, out, ph) {
    if (p.state === 'sit') {
      out.bob = -0.42;
      out.legs = [-1.42, -1.42];
      if (p.typing) {
        out.armL = [-1.08 + Math.sin(ph * 9) * 0.05, 0.16];
        out.armR = [-1.08 + Math.sin(ph * 9 + 1.3) * 0.05, -0.16];
        out.headPitch = 0.14;
      } else {
        out.armL = [-0.6, 0.12];
        out.armR = [-0.6, -0.12];
      }
    }
    if (p.talking) {
      const k = p.state === 'sit' ? 0.5 : 1;
      out.armL = [(p.state === 'sit' ? -0.7 : -0.45) - Math.sin(ph * 2.3) * 0.25 * k, 0.14];
      out.armR = [(p.state === 'sit' ? -0.7 : -0.5) - Math.sin(ph * 2.9 + 1) * 0.3 * k, -0.14];
    }
    if (p.pointing) out.armL = [-1.25, 0.35];
    if (p.holding) out.armR = [-0.95, -0.05];
  }
  function step(p, dt) {
    if (!p.route) { p.walking = false; return; }
    const [tx, tz] = p.route[0];
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz), s = p.speed * dt;
    // Wait a moment while someone is right in the way.
    if (d > 0.05 && grid.near(p.x + dx / d * 0.45, p.z + dz / d * 0.45, 0.42, p).length && (p.waited = (p.waited || 0) + dt) < 2.5) { p.walking = false; return; }
    p.waited = 0;
    if (d <= s) {
      p.x = tx; p.z = tz;
      p.route.shift();
      if (!p.route.length) {
        p.route = null;
        p.walking = false;
        if (p.endYaw != null) p.yaw = p.endYaw;
        const done = p.arrive;
        p.arrive = null;
        done?.(true);
      }
      return;
    }
    p.x += dx / d * s;
    p.z += dz / d * s;
    p.yaw = Math.atan2(dx, dz);
    p.walking = true;
    p.stride = (p.stride || 0) + dt * p.speed * 5.2;
  }
  // Figures live in the lab group, which already sits at floorY.
  const figures = createFigures(people, { quality, groundAt: () => 0, pose, radius: 40 });
  const grid = new SpatialHash(2);
  group.add(figures.group);

  const seatById = Object.fromEntries(seats.map(s => [s.id, s]));
  /** Put someone in a seat (sitting) or at a standing spot [x, z, yaw]. */
  function place(p, where, { sit = true, typing = false } = {}) {
    const s = typeof where === 'string' ? seatById[where] : { x: where[0], z: where[1], yaw: where[2] ?? p.yaw };
    Object.assign(p, { x: s.x, z: s.z, yaw: s.yaw, baseYaw: s.yaw, state: sit && typeof where === 'string' ? 'sit' : 'stand', typing, route: null, walking: false, hidden: false });
    figures.write(p);
    figures.dirty();
  }
  /** Walk someone to a point, through fixed waypoints if given; resolves on arrival. */
  function walk(p, to, { speed = 1.2, yaw = null, sit = null, typing = false, via = null, instant = false } = {}) {
    if (instant) {
      if (sit) place(p, sit, { typing });
      else place(p, [to[0], to[1], yaw ?? p.yaw], { sit: false });
      return Promise.resolve(true);
    }
    const path = via ? [[p.x, p.z], ...via, to] : nav.findPath([p.x, p.z], to) || [[p.x, p.z], to];
    p.goal = to;
    p.state = 'stand';
    p.typing = false;
    p.speed = speed;
    p.endYaw = yaw;
    p.route = path.slice(1);
    return new Promise(resolve => {
      p.arrive = (ok) => {
        if (sit) { const s = seatById[sit]; Object.assign(p, { x: s.x, z: s.z, yaw: s.yaw, baseYaw: s.yaw, state: 'sit', typing }); }
        else if (yaw != null) p.baseYaw = yaw;
        resolve(ok);
      };
    });
  }

  /** Where everyone is: at their desks, in the weekly meeting, or out. */
  function layout(name) {
    idleToken++;
    for (const p of people) { p.hidden = true; p.route = null; p.arrive = null; p.talking = p.pointing = p.holding = false; }
    if (name === 'desks') {
      place(cast.mateA, 'p1se', { typing: true });
      place(cast.mateB, 'p0nw', { typing: true });
      place(cast.senior, 'p2se', { typing: true });
      place(cast.bg1, 'p1nw', { typing: true });
      place(cast.bg2, 'p2nw', { typing: true });
    } else if (name === 'meeting') {
      place(cast.supervisor, [-84.55, 117.35, 1.05], { sit: false });
      // The two places next to you stay free, so the table and the screen are in view.
      place(cast.mateA, 'm1');
      place(cast.mateB, 'm2');
      place(cast.senior, 'm5');
    }
    for (const p of people) figures.write(p);
    figures.dirty();
  }

  // In free mode the lab is not frozen: now and then someone gets up, goes to the printer, the
  // whiteboard or the shelves, and comes back.
  let idleToken = 0, idleWait = 6;
  const errands = [[-75.2, 113.2], [-69, 113.4], [-59.9, 116.9], [-60.3, 123.2], [-64.2, 119.4]];
  function idle(dt) {
    idleWait -= dt;
    if (idleWait > 0) return;
    idleWait = 9 + random() * 12;
    const seated = [cast.mateA, cast.mateB, cast.senior, cast.bg1, cast.bg2].filter(p => !p.hidden && p.state === 'sit' && !p.route);
    if (!seated.length) return;
    const p = seated[Math.floor(random() * seated.length)];
    const seat = seats.find(s => Math.hypot(s.x - p.x, s.z - p.z) < 0.05);
    if (!seat) return;
    const token = idleToken;
    // An errand spot nobody is at or heading to.
    const free = errands.filter(e => people.every(q => q === p || q.hidden || (Math.hypot(q.x - e[0], q.z - e[1]) > 0.9 && !(q.route && q.goal && Math.hypot(q.goal[0] - e[0], q.goal[1] - e[1]) < 0.9))));
    if (!free.length) return;
    walk(p, free[Math.floor(random() * free.length)], { speed: 1.1 })
      .then(() => new Promise(r => setTimeout(r, 3000 + random() * 3500)))
      .then(() => { if (token === idleToken && !p.hidden) walk(p, [seat.x, seat.z], { speed: 1.1, sit: seat.id, typing: true }); });
  }

  const spots = {
    door: [(door[0] + door[1]) / 2, z0 - 0.9],
    inside: [(door[0] + door[1]) / 2, z0 + 1.2],
    screen: [x0 + 0.06, floorY + 1.55, table.z],
    table: [table.x, floorY + 0.8, table.z],
    shelfB: { stand: [x1 - 2.7, 116.9], look: [x1 - 0.3, floorY + 1.05, 116.9] },
    charger: { stand: [-59.7, 123.2], look: [-59.8, floorY + 0.8, 124.25] },
    window: [xc, floorY + 1.5, z1 + 5],
  };

  return {
    group, floorY, nav, seats: seatById, spots, cast, people, figures, placeCamera, place, walk, layout, idle,
    name: 'S-Lab', kind: 'lab', label: { en: 'lab', zh: '实验室' },
    setCutaway(on) { ceilingMesh.visible = glow.visible = !on; },
    pickables: [figures.group, floor],
    contains: (x, z) => x > x0 - 0.5 && x < x1 + 0.5 && z > z0 - 2 && z < z1 + 0.5,
    setVisible(on) { group.visible = on; },
    update(dt, player, camera) {
      if (!group.visible) return;
      grid.fill(people);
      figures.update(dt, player, camera, step);
    },
    blocks: (x, z, fx, fz) => bodyBlocks(grid, x, z, fx, fz),
  };
}
