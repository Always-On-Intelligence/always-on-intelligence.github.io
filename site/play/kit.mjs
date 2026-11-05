// Building blocks for the episode dioramas: materials, rounded shapes, room shells and furniture.
// Everything is procedural so the page ships no models. Units are metres, y is up.
import * as THREE from 'three';

const cache = new Map();
// grayscale detail maps multiplied with a material's colour, repeated per metre of surface
const DETAIL = {};
function detail(kind) {
  if (DETAIL[kind]) return DETAIL[kind];
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  let seed = 1234567;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < img.data.length; i += 4) {
    const x = (i / 4) % size, y = Math.floor(i / 4 / size);
    let v = 255;
    if (kind === 'fabric') v = 238 + ((x + y) % 4 < 2 ? 7 : -7) + (rnd() - 0.5) * 10;
    if (kind === 'plaster') v = 246 + (rnd() - 0.5) * 9;
    if (kind === 'wood') v = 232 + Math.sin((y + Math.sin(x * 0.05) * 6) * 0.35) * 9 + Math.sin(y * 0.07 + x * 0.01) * 6 + (rnd() - 0.5) * 6;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, v));
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  const rep = { fabric: 6, plaster: 0.8, wood: 1.6 }[kind];
  t.repeat.set(rep, rep);
  DETAIL[kind] = t;
  return t;
}

/** Shared standard material by name or hex; tex adds a detail map ('fabric', 'wood', 'plaster'). */
export function mat(color, { rough = 0.8, metal = 0, emissive = null, ei = 0, opacity = 1, side = THREE.FrontSide, tex = null } = {}) {
  const key = [color, rough, metal, emissive, ei, opacity, side, tex].join('|');
  if (cache.has(key)) return cache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, side });
  if (tex) m.map = detail(tex);
  if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = ei; }
  if (opacity < 1) { m.transparent = true; m.opacity = opacity; m.depthWrite = false; }
  cache.set(key, m);
  return m;
}
export function clearMaterialCache() { cache.clear(); }

export const C = {
  wall: '#efe7dc', wallWarm: '#e9dccb', wallCool: '#dfe3e2', trim: '#f7f2ea',
  oak: '#c08a58', oakDark: '#8a5a36', walnut: '#6f4a33', birch: '#d9b98e',
  floorWood: '#b9855a', tile: '#d8d2c7', concrete: '#bdb8b0',
  fabricGreen: '#5f7357', fabricRust: '#b35f43', fabricBlue: '#4f6380', fabricCream: '#e8dfcf', fabricGray: '#8c8a86',
  metal: '#a9adb2', metalDark: '#3c3f44', black: '#24262a', white: '#f4f3ef', plastic: '#f1f0ec',
  leaf: '#5d8a4e', leafDark: '#41693a', pot: '#c97f5a', potCream: '#e8e0d2',
  screen: '#1d2433', screenOn: '#2d3b57', glass: '#cfe3ee', amber: '#f1b24a', mug: '#d08f3a'
};

/** Box with rounded edges (r is the edge radius). */
export function roundedBoxGeometry(w, h, d, r = 0.04, seg = 3) {
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const shape = new THREE.Shape();
  const x = -w / 2 + r, y = -h / 2 + r, ww = w - 2 * r, hh = h - 2 * r;
  shape.moveTo(x, y);
  shape.lineTo(x + ww, y);
  shape.lineTo(x + ww, y + hh);
  shape.lineTo(x, y + hh);
  shape.lineTo(x, y);
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.0001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: seg, curveSegments: seg });
  g.translate(0, 0, -(d - 2 * r) / 2);
  g.computeVertexNormals();
  return g;
}

/** Mesh helper: box(w,h,d) at (x,y,z) where y is the bottom. */
export function box(w, h, d, material, { x = 0, y = 0, z = 0, r = 0.02, rot = 0, shadow = true } = {}) {
  const geo = r > 0 ? roundedBoxGeometry(w, h, d, r) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, typeof material === 'string' ? mat(material) : material);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = rot;
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}
export function cyl(rTop, rBottom, h, material, { x = 0, y = 0, z = 0, seg = 24, shadow = true } = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), typeof material === 'string' ? mat(material) : material);
  m.position.set(x, y + h / 2, z);
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}
export function sphere(r, material, { x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, seg = 18 } = {}) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.6 | 0)), typeof material === 'string' ? mat(material) : material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
export function group(...children) { const g = new THREE.Group(); children.forEach(c => c && g.add(c)); return g; }
export function at(obj, x = 0, y = 0, z = 0, rot = 0) { obj.position.set(x, y, z); obj.rotation.y = rot; return obj; }

/** Canvas texture helper. */
export function canvasTex(w, h, paint, { repeat = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

function plankTexture(base = '#b9855a') {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    const rows = 8;
    for (let i = 0; i < rows; i++) {
      const y = (i * h) / rows;
      const shade = (i * 37 % 7 - 3) * 4;
      ctx.fillStyle = `rgba(${shade > 0 ? '255,240,220' : '60,40,25'},${Math.abs(shade) / 120})`;
      ctx.fillRect(0, y, w, h / rows);
      ctx.fillStyle = 'rgba(60,36,20,0.28)'; ctx.fillRect(0, y, w, 2);
      const off = (i * 173) % w;
      ctx.fillRect(off, y, 2, h / rows);
      for (let k = 0; k < 14; k++) {
        ctx.strokeStyle = `rgba(80,50,30,${0.04 + (k % 3) * 0.02})`;
        ctx.beginPath(); ctx.moveTo(0, y + 6 + k * 4); ctx.bezierCurveTo(w * 0.3, y + 4 + k * 4, w * 0.6, y + 8 + k * 4, w, y + 5 + k * 4); ctx.stroke();
      }
    }
  }, { repeat: [2, 2] });
}
function tileTexture(base = '#d8d2c7') {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(90,80,70,0.25)'; ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * w / 4, 0); ctx.lineTo(i * w / 4, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * h / 4); ctx.lineTo(w, i * h / 4); ctx.stroke(); }
  }, { repeat: [3, 3] });
}
function rugTexture(colors = ['#a8553f', '#e6d6bd', '#3f5469', '#c99a4a']) {
  return canvasTex(512, 320, (ctx, w, h) => {
    ctx.fillStyle = colors[0]; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = colors[1]; ctx.fillRect(18, 18, w - 36, h - 36);
    ctx.fillStyle = colors[0]; ctx.fillRect(30, 30, w - 60, h - 60);
    for (let y = 46; y < h - 46; y += 22) {
      for (let x = 46; x < w - 46; x += 22) {
        ctx.fillStyle = colors[((x + y) / 22 | 0) % 3 + 1];
        ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 7, y); ctx.fill();
      }
    }
  });
}

/**
 * The diorama: a thick floor slab with a back wall (z = -d/2) and a left wall (x = -w/2), open towards
 * the viewer. Returns { group, floorY }.
 */
export function room({ w = 10, d = 7, h = 2.7, floor = 'wood', floorColor = C.floorWood, wall = C.wall, leftWall = true, backWall = true, base = '#2a2622' } = {}) {
  const g = new THREE.Group();
  const slab = box(w + 0.3, 0.4, d + 0.3, mat(base, { rough: 0.9 }), { y: -0.47, r: 0.08 });
  g.add(slab);
  const floorMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: floor === 'wood' ? 0.62 : 0.8, map: floor === 'wood' ? plankTexture(floorColor) : tileTexture(floorColor) });
  if (floorMat.map) floorMat.map.repeat.set(w / 3, d / 3);
  const fl = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), floorMat);
  fl.position.set(0, -0.03, 0); fl.receiveShadow = true;
  g.add(fl);
  const wallMat = mat(wall, { rough: 0.92, tex: 'plaster' });
  if (backWall) {
    g.add(box(w + 0.15, h, 0.16, wallMat, { x: -0.075, z: -d / 2 - 0.08, r: 0.01 }));
    g.add(box(w, 0.1, 0.03, mat(C.trim), { z: -d / 2 + 0.015, r: 0.005 }));
  }
  if (leftWall) {
    g.add(box(0.16, h, d, wallMat, { x: -w / 2 - 0.08, r: 0.01 }));
    g.add(box(0.03, 0.1, d, mat(C.trim), { x: -w / 2 + 0.015, r: 0.005 }));
  }
  return { group: g, floorY: 0 };
}

/** A low interior wall from (x1,z1) to (x2,z2), cut at height h like a model. */
export function partition(x1, z1, x2, z2, { h = 1.15, t = 0.12, color = C.wall } = {}) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const m = box(len, h, t, mat(color, { rough: 0.92 }), { r: 0.015 });
  m.position.set((x1 + x2) / 2, h / 2, (z1 + z2) / 2);
  m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  const cap = box(len + 0.02, 0.025, t + 0.02, mat('#d9cfc1'), { r: 0.005 });
  cap.position.set((x1 + x2) / 2, h + 0.012, (z1 + z2) / 2);
  cap.rotation.y = m.rotation.y;
  return group(m, cap);
}

/** A window on the back wall (axis 'z') or left wall (axis 'x') with a sky that follows the time of day. */
export function windowPane(view, { x = 0, y = 1.0, z = 0, w = 1.6, h = 1.3, axis = 'z', shaft = {} } = {}) {
  const g = new THREE.Group();
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 64; skyCanvas.height = 128;
  const tex = new THREE.CanvasTexture(skyCanvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const skyMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(w, h), skyMat);
  g.add(sky);
  const ctx = skyCanvas.getContext('2d');
  view.addSky((top, bottom) => {
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#' + top.getHexString());
    grad.addColorStop(1, '#' + bottom.getHexString());
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 128);
    // distant hills
    ctx.fillStyle = 'rgba(30,40,50,0.35)';
    ctx.beginPath(); ctx.moveTo(0, 100); ctx.quadraticCurveTo(20, 84, 36, 96); ctx.quadraticCurveTo(50, 80, 64, 92); ctx.lineTo(64, 128); ctx.lineTo(0, 128); ctx.fill();
    tex.needsUpdate = true;
  });
  const frame = mat('#f5f1ea', { rough: 0.6 });
  const fw = 0.06;
  g.add(box(w + fw * 2, fw, 0.08, frame, { y: -h / 2 - fw, r: 0.01 }), box(w + fw * 2, fw, 0.08, frame, { y: h / 2, r: 0.01 }));
  g.add(box(fw, h, 0.08, frame, { x: -w / 2 - fw / 2, y: -h / 2, r: 0.01 }), box(fw, h, 0.08, frame, { x: w / 2 + fw / 2, y: -h / 2, r: 0.01 }));
  g.add(box(0.035, h, 0.05, frame, { y: -h / 2, r: 0.005 }));
  g.add(box(w + 0.2, 0.05, 0.18, mat('#f5f1ea'), { y: -h / 2 - 0.1, z: 0.06, r: 0.01 }));
  if (shaft) g.add(lightShaft(view, w, h, y + h / 2, shaft));
  g.position.set(x, y + h / 2, z);
  if (axis === 'x') g.rotation.y = Math.PI / 2;
  return g;
}

let SHAFT_TEX = null, PATCH_TEX = null;
/**
 * Sunlight through a window, in the window's local frame (the wall at z = 0, the room towards +z):
 * a faint beam from the opening down to the floor and a soft patch where it lands. Its strength and
 * colour follow the time of day (view.addShaft).
 */
function lightShaft(view, w, h, centreY, { dir = [0.3, -0.85, 1.0] } = {}) {
  if (!SHAFT_TEX) {
    SHAFT_TEX = canvasTex(8, 128, (ctx, cw, ch) => {
      const gr = ctx.createLinearGradient(0, 0, 0, ch);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, cw, ch);
    });
    PATCH_TEX = canvasTex(128, 128, (ctx, cw, ch) => {
      const gr = ctx.createRadialGradient(cw / 2, ch / 2, 10, cw / 2, ch / 2, cw / 2);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.65, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, cw, ch);
    });
  }
  const d = new THREE.Vector3(...dir).normalize();
  const floorY = -centreY + 0.004;
  const corners = [[-w / 2, h / 2], [w / 2, h / 2], [w / 2, -h / 2], [-w / 2, -h / 2]].map(([cx, cy]) => {
    const top = new THREE.Vector3(cx, cy, 0.02);
    const t = (cy - floorY) / -d.y;
    return [top, top.clone().addScaledVector(d, t)];
  });
  // four sides of the beam, each a quad from the opening (v = 0) to the floor (v = 1)
  const pos = [], uv = [];
  for (let i = 0; i < 4; i++) {
    const [a0, a1] = corners[i], [b0, b1] = corners[(i + 1) % 4];
    pos.push(...a0.toArray(), ...b0.toArray(), ...b1.toArray(), ...a0.toArray(), ...b1.toArray(), ...a1.toArray());
    uv.push(0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const beamMat = new THREE.MeshBasicMaterial({ map: SHAFT_TEX, color: '#fff2d8', transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  const beam = new THREE.Mesh(geo, beamMat);
  beam.userData.noGlow = true; beam.userData.noAO = true;
  // the patch on the floor, under the four landing points
  const land = corners.map(([, f]) => f);
  const patchGeo = new THREE.BufferGeometry();
  patchGeo.setAttribute('position', new THREE.Float32BufferAttribute([...land[0].toArray(), ...land[1].toArray(), ...land[2].toArray(), ...land[0].toArray(), ...land[2].toArray(), ...land[3].toArray()], 3));
  patchGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0], 2));
  const patchMat = new THREE.MeshBasicMaterial({ map: PATCH_TEX, color: '#fff0cc', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const patch = new THREE.Mesh(patchGeo, patchMat);
  patch.userData.noGlow = true; patch.userData.noAO = true;
  const grp = group(beam, patch);
  view.addShaft?.({ beam: beamMat, patch: patchMat });
  return grp;
}

export function rug(w, d, { x = 0, z = 0, colors } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), new THREE.MeshStandardMaterial({ map: rugTexture(colors), roughness: 0.95 }));
  m.position.set(x, 0.006, z);
  m.receiveShadow = true;
  return m;
}

export function plant({ x = 0, z = 0, y = 0, scale = 1, pot = C.pot, leaf = C.leaf } = {}) {
  const g = new THREE.Group();
  g.add(cyl(0.16, 0.12, 0.3, mat(pot, { rough: 0.7 })));
  const leafMat = mat(leaf, { rough: 0.75 });
  const leafDark = mat(C.leafDark, { rough: 0.75 });
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 0.12 + (i % 3) * 0.05;
    const leafMesh = sphere(0.13 + (i % 2) * 0.04, i % 2 ? leafMat : leafDark, { x: Math.cos(a) * r, y: 0.42 + (i % 4) * 0.11, z: Math.sin(a) * r, sx: 1, sy: 0.55, sz: 1.5, seg: 10 });
    leafMesh.rotation.y = -a;
    leafMesh.rotation.z = 0.5;
    g.add(leafMesh);
  }
  g.add(sphere(0.14, leafMat, { y: 0.78, sy: 0.8, seg: 10 }));
  g.scale.setScalar(scale);
  g.position.set(x, y, z);
  return g;
}

export function frameArt(w, h, { x = 0, y = 1.6, z = 0, axis = 'z', colors = ['#d9a15c', '#6f8fa8', '#e9dcc3'] } = {}) {
  const tex = canvasTex(128, 96, (ctx, cw, ch) => {
    const g = ctx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, colors[1]); g.addColorStop(1, colors[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = colors[0];
    ctx.beginPath(); ctx.moveTo(0, ch); ctx.lineTo(cw * 0.35, ch * 0.45); ctx.lineTo(cw * 0.6, ch * 0.7); ctx.lineTo(cw * 0.8, ch * 0.5); ctx.lineTo(cw, ch); ctx.fill();
  });
  const g = new THREE.Group();
  g.add(box(w + 0.08, h + 0.08, 0.04, mat('#3a2c22', { rough: 0.6 }), { y: -h / 2 - 0.04, r: 0.01 }));
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  art.position.z = 0.022;
  g.add(art);
  g.position.set(x, y, z);
  if (axis === 'x') g.rotation.y = Math.PI / 2;
  return g;
}

export function bookshelf({ x = 0, z = 0, w = 1.2, h = 1.8, d = 0.32, rot = 0 } = {}) {
  const g = new THREE.Group();
  const wood = mat(C.oak, { rough: 0.62, tex: 'wood' });
  g.add(box(w, 0.04, d, wood, { r: 0.01 }), box(w, 0.04, d, wood, { y: h - 0.04, r: 0.01 }));
  g.add(box(0.04, h, d, wood, { x: -w / 2 + 0.02, r: 0.01 }), box(0.04, h, d, wood, { x: w / 2 - 0.02, r: 0.01 }));
  const shelves = 4;
  const bookColors = ['#a0463c', '#3f5469', '#d9b65f', '#5f7357', '#e6dccb', '#7a5c4f', '#2f3e56'];
  for (let s = 1; s < shelves; s++) {
    const y = (s * h) / shelves;
    g.add(box(w - 0.06, 0.03, d - 0.02, wood, { y, r: 0.005 }));
    let bx = -w / 2 + 0.08;
    let i = s * 3;
    while (bx < w / 2 - 0.12) {
      const bw = 0.04 + ((i * 7) % 4) * 0.012;
      const bh = 0.2 + ((i * 5) % 5) * 0.025;
      if ((i % 9) !== 4) g.add(box(bw, bh, d * 0.7, mat(bookColors[i % bookColors.length], { rough: 0.85 }), { x: bx + bw / 2, y: y + 0.03, r: 0.004 }));
      bx += bw + 0.008;
      i++;
    }
  }
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  return g;
}

export function sofa({ x = 0, z = 0, rot = 0, w = 2.1, color = C.fabricGreen } = {}) {
  const g = new THREE.Group();
  const fabric = mat(color, { rough: 0.95, tex: 'fabric' });
  g.add(box(w, 0.32, 0.9, fabric, { y: 0.12, r: 0.08 }));
  g.add(box(w, 0.48, 0.22, fabric, { y: 0.4, z: -0.36, r: 0.09 }));
  g.add(box(0.2, 0.32, 0.9, fabric, { x: -w / 2 + 0.1, y: 0.42, r: 0.08 }), box(0.2, 0.32, 0.9, fabric, { x: w / 2 - 0.1, y: 0.42, r: 0.08 }));
  for (const sx of [-w / 4, w / 4]) g.add(box(w / 2 - 0.2, 0.12, 0.62, mat(color, { rough: 0.98, tex: 'fabric' }), { x: sx, y: 0.42, z: 0.06, r: 0.05 }));
  g.add(box(0.42, 0.36, 0.14, mat(C.fabricRust, { rough: 0.95, tex: 'fabric' }), { x: -w / 2 + 0.42, y: 0.52, z: -0.22, r: 0.06 }));
  g.add(box(0.4, 0.34, 0.14, mat(C.fabricCream, { rough: 0.95, tex: 'fabric' }), { x: w / 2 - 0.44, y: 0.52, z: -0.2, r: 0.06 }));
  for (const [lx, lz] of [[-w / 2 + 0.1, -0.35], [w / 2 - 0.1, -0.35], [-w / 2 + 0.1, 0.35], [w / 2 - 0.1, 0.35]]) g.add(cyl(0.03, 0.025, 0.12, mat(C.walnut), { x: lx, z: lz }));
  g.position.set(x, 0, z); g.rotation.y = rot;
  return g;
}

export function roundTable({ x = 0, z = 0, r = 0.28, h = 0.58, top = C.walnut } = {}) {
  const g = new THREE.Group();
  g.add(cyl(r, r, 0.04, mat(top, { rough: 0.5, tex: 'wood' }), { y: h - 0.04 }));
  g.add(cyl(0.03, 0.03, h - 0.04, mat(top), {}));
  g.add(cyl(0.16, 0.18, 0.03, mat(top), {}));
  g.position.set(x, 0, z);
  g.userData.top = h;
  return g;
}

export function table({ x = 0, z = 0, w = 1.6, d = 0.8, h = 0.75, top = C.oak, legs = C.walnut, rot = 0 } = {}) {
  const g = new THREE.Group();
  g.add(box(w, 0.05, d, mat(top, { rough: 0.5, tex: 'wood' }), { y: h - 0.05, r: 0.015 }));
  for (const [lx, lz] of [[-w / 2 + 0.07, -d / 2 + 0.07], [w / 2 - 0.07, -d / 2 + 0.07], [-w / 2 + 0.07, d / 2 - 0.07], [w / 2 - 0.07, d / 2 - 0.07]]) g.add(box(0.05, h - 0.05, 0.05, mat(legs), { x: lx, z: lz, r: 0.01 }));
  g.position.set(x, 0, z); g.rotation.y = rot;
  g.userData.top = h;
  return g;
}

export function chair({ x = 0, z = 0, rot = 0, color = C.walnut, seat = C.fabricCream, office = false } = {}) {
  const g = new THREE.Group();
  if (office) {
    g.add(cyl(0.26, 0.26, 0.04, mat(C.metalDark, { rough: 0.5, metal: 0.4 }), { y: 0.05 }));
    g.add(cyl(0.03, 0.03, 0.36, mat(C.metalDark, { metal: 0.4, rough: 0.4 }), { y: 0.08 }));
    g.add(box(0.5, 0.09, 0.48, mat(C.black, { rough: 0.8 }), { y: 0.44, r: 0.04 }));
    g.add(box(0.48, 0.58, 0.07, mat(C.black, { rough: 0.8 }), { y: 0.56, z: -0.22, r: 0.04 }));
  } else {
    g.add(box(0.44, 0.05, 0.42, mat(seat, { rough: 0.9, tex: 'fabric' }), { y: 0.43, r: 0.02 }));
    for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) g.add(box(0.035, 0.43, 0.035, mat(color), { x: lx, z: lz, r: 0.008 }));
    g.add(box(0.44, 0.42, 0.04, mat(color), { y: 0.48, z: -0.2, r: 0.015 }));
  }
  g.position.set(x, 0, z); g.rotation.y = rot;
  return g;
}

export function deskLamp({ x = 0, y = 0, z = 0, rot = 0, view = null, color = C.black } = {}) {
  const g = new THREE.Group();
  const m = mat(color, { rough: 0.45, metal: 0.3 });
  g.add(cyl(0.09, 0.1, 0.03, m));
  const arm1 = box(0.025, 0.42, 0.025, m, { y: 0.02, r: 0.008 });
  arm1.rotation.z = 0.25; arm1.position.x = -0.05;
  g.add(arm1);
  const arm2 = box(0.025, 0.36, 0.025, m, { r: 0.008 });
  arm2.position.set(0.02, 0.5, 0); arm2.rotation.z = -1.0;
  g.add(arm2);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.16, 20, 1, true), mat(color, { rough: 0.5, side: THREE.DoubleSide }));
  shade.position.set(0.2, 0.52, 0); shade.rotation.z = 0.5;
  shade.castShadow = true;
  g.add(shade);
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffd59a', emissiveIntensity: 1.2 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), bulbMat);
  bulb.position.set(0.23, 0.46, 0);
  g.add(bulb);
  g.position.set(x, y, z); g.rotation.y = rot;
  if (view) {
    const light = new THREE.PointLight('#ffcf8f', 3.2, 4.5, 1.6);
    light.position.set(0.24, 0.38, 0);
    g.add(light);
    const halo = glow('#ffd59a', 0.42);
    halo.position.copy(bulb.position);
    g.add(halo);
    view.addLamp(light, bulbMat, halo);
  }
  return g;
}

export function floorLamp({ x = 0, z = 0, view = null } = {}) {
  const g = new THREE.Group();
  g.add(cyl(0.16, 0.18, 0.03, mat(C.metalDark, { metal: 0.5, rough: 0.4 })));
  g.add(cyl(0.018, 0.018, 1.45, mat(C.metalDark, { metal: 0.5, rough: 0.4 })));
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#f3e3c3', emissive: '#ffcc88', emissiveIntensity: 0.6, roughness: 0.9, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 0.28, 24, 1, true), shadeMat);
  shade.position.y = 1.5;
  g.add(shade);
  g.position.set(x, 0, z);
  if (view) {
    const light = new THREE.PointLight('#ffc98a', 4.2, 6, 1.5);
    light.position.y = 1.45;
    g.add(light);
    const halo = glow('#ffcf8f', 0.9);
    halo.position.y = 1.5;
    g.add(halo);
    view.addLamp(light, shadeMat, halo);
  }
  return g;
}

/** Laptop with a screen whose content is drawn on a canvas; returns { group, screen, draw(fn) }. */
export function laptop({ x = 0, y = 0.75, z = 0, rot = 0, open = 1.85, color = '#b8bcc2', w = 0.36, d = 0.25 } = {}) {
  const g = new THREE.Group();
  const shell = mat(color, { rough: 0.35, metal: 0.55 });
  g.add(box(w, 0.018, d, shell, { r: 0.006 }));
  g.add(box(w * 0.86, 0.002, d * 0.46, mat('#2b2e33', { rough: 0.6 }), { y: 0.018, z: -d * 0.12, r: 0 }));
  const lid = new THREE.Group();
  lid.position.set(0, 0.018, -d / 2);
  lid.add(box(w, d, 0.012, shell, { y: 0, z: -0.006, r: 0.005 }));
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 320;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screenMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, d * 0.86), screenMat);
  screen.position.set(0, d / 2, 0.001);
  screen.userData.noGlow = true;
  lid.add(screen);
  lid.rotation.x = -(Math.PI - open);
  g.add(lid);
  g.position.set(x, y, z); g.rotation.y = rot;
  const ctx = canvas.getContext('2d');
  function draw(fn) { fn(ctx, canvas.width, canvas.height); tex.needsUpdate = true; }
  draw((c, cw, ch) => { c.fillStyle = '#1d2433'; c.fillRect(0, 0, cw, ch); });
  return { group: g, lid, screen, draw };
}

export function phone({ x = 0, y = 0.75, z = 0, rot = 0 } = {}) {
  const g = new THREE.Group();
  g.add(box(0.075, 0.009, 0.15, mat('#202226', { rough: 0.3, metal: 0.4 }), { r: 0.006 }));
  const screenMat = new THREE.MeshStandardMaterial({ color: '#10141c', emissive: '#7fa6ff', emissiveIntensity: 0, roughness: 0.2 });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.138), screenMat);
  s.rotation.x = -Math.PI / 2; s.position.y = 0.0095;
  g.add(s);
  g.position.set(x, y, z); g.rotation.y = rot;
  g.userData.screen = screenMat;
  return g;
}

export function mug({ x = 0, y = 0, z = 0, color = C.mug } = {}) {
  const g = new THREE.Group();
  const m = mat(color, { rough: 0.45 });
  g.add(cyl(0.045, 0.04, 0.1, m));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 8, 16), m);
  handle.position.set(0.05, 0.05, 0);
  handle.castShadow = true;
  g.add(handle);
  g.add(cyl(0.04, 0.04, 0.005, mat('#3a2418', { rough: 0.3 }), { y: 0.088 }));
  g.position.set(x, y, z);
  return g;
}

let GLOW = null;
/** A soft additive halo, e.g. around a lamp bulb; its strength follows the lamp. */
export function glow(color = '#ffcf8f', size = 0.6) {
  if (!GLOW) {
    GLOW = canvasTex(64, 64, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.25, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0.6 }));
  s.scale.set(size, size, 1);
  s.userData.noGlow = true; s.userData.noAO = true;
  return s;
}

/** A soft dark disc under moving things, so they read as standing on the floor. */
export function blob(r = 0.4, opacity = 0.35) {
  const tex = canvasTex(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.004;
  m.userData.noGlow = true;
  return m;
}

/** A pulsing ring on the floor or around an object, used to show where attention or a check goes. */
export function ring(r = 0.4, color = '#e9c580') {
  const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.86, r, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  m.userData.noGlow = true;
  return m;
}

/** A translucent cone from `from` to `to` (Vector3 getters), e.g. a camera's requested look. */
export function beam(color = '#a9bfdf') {
  const geo = new THREE.ConeGeometry(0.22, 1, 24, 1, true);
  geo.translate(0, -0.5, 0);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  m.userData.noGlow = true;
  m.visible = false;
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  m.userData.aim = (from, to, spread = 1) => {
    from.getWorldPosition ? from.getWorldPosition(a) : a.copy(from);
    to.getWorldPosition ? to.getWorldPosition(b) : b.copy(to);
    m.position.copy(a);
    m.lookAt(b);
    const len = a.distanceTo(b);
    m.scale.set(spread * len * 0.35, spread * len * 0.35, len);
  };
  return m;
}

// ---------- more furniture for the other episodes ----------

export function workbench({ x = 0, z = 0, w = 2.4, d = 0.8, h = 0.92, rot = 0 } = {}) {
  const g = new THREE.Group();
  const top = mat(C.oak, { rough: 0.55, tex: 'wood' });
  g.add(box(w, 0.07, d, top, { y: h - 0.07, r: 0.012 }));
  for (const [lx, lz] of [[-w / 2 + 0.08, -d / 2 + 0.08], [w / 2 - 0.08, -d / 2 + 0.08], [-w / 2 + 0.08, d / 2 - 0.08], [w / 2 - 0.08, d / 2 - 0.08]]) g.add(box(0.07, h - 0.07, 0.07, mat(C.oakDark), { x: lx, z: lz, r: 0.01 }));
  g.add(box(w - 0.12, 0.04, d - 0.1, mat(C.oakDark), { y: 0.2, r: 0.008 }));
  for (let i = 0; i < 3; i++) g.add(box(0.36, 0.22, 0.3, mat(['#7d9bb5', '#c46a52', '#8c8a86'][i], { rough: 0.7 }), { x: -w / 2 + 0.35 + i * 0.5, y: 0.24, r: 0.02 }));
  g.position.set(x, 0, z); g.rotation.y = rot;
  g.userData.top = h;
  return g;
}

export function pegboard({ x = 0, y = 1.1, z = 0, w = 2.0, h = 1.0 } = {}) {
  const tex = canvasTex(256, 128, (ctx, cw, ch) => {
    ctx.fillStyle = '#c9a77b'; ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = 'rgba(60,40,20,0.55)';
    for (let i = 8; i < cw; i += 12) for (let j = 8; j < ch; j += 12) { ctx.beginPath(); ctx.arc(i, j, 1.6, 0, Math.PI * 2); ctx.fill(); }
  });
  const g = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
  board.receiveShadow = true;
  g.add(board);
  const tools = [['#c0392b', 0.04, 0.32], ['#2f3e56', 0.03, 0.26], ['#8c8f94', 0.025, 0.36], ['#d9a441', 0.05, 0.22], ['#8c8f94', 0.03, 0.3], ['#3d5a4c', 0.04, 0.28]];
  tools.forEach(([c, tw, th], i) => {
    const t = box(tw, th, 0.03, mat(c, { rough: 0.5, metal: c === '#8c8f94' ? 0.6 : 0.1 }), { x: -w / 2 + 0.25 + i * (w - 0.5) / (tools.length - 1), y: -th / 2 + (i % 2 ? 0.1 : 0.2), z: 0.03, r: 0.008 });
    g.add(t);
  });
  g.position.set(x, y, z);
  return g;
}

/** A small machined part; two of them look alike on purpose. */
export function mechPart({ color = '#b9bec5' } = {}) {
  const g = new THREE.Group();
  const m = mat(color, { rough: 0.35, metal: 0.75 });
  g.add(box(0.1, 0.035, 0.07, m, { r: 0.008 }));
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 16), m);
  boss.position.set(0.02, 0.05, 0); boss.castShadow = true;
  g.add(boss);
  return g;
}
export function clipPart() {
  const g = new THREE.Group();
  const m = mat('#d6dadf', { rough: 0.3, metal: 0.85 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 8, 20), m);
  ring.rotation.x = Math.PI / 2; ring.scale.set(1.5, 1, 1); ring.position.y = 0.007; ring.castShadow = true;
  g.add(ring);
  return g;
}
export function machine() {
  const g = new THREE.Group();
  const metal = mat('#a7adb4', { rough: 0.35, metal: 0.7 });
  const dark = mat('#3a3e45', { rough: 0.5, metal: 0.4 });
  g.add(box(0.5, 0.06, 0.32, dark, { r: 0.01 }));
  g.add(box(0.22, 0.2, 0.22, metal, { x: -0.1, y: 0.06, r: 0.02 }));
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 24), metal);
  drum.rotation.z = Math.PI / 2; drum.position.set(0.12, 0.16, 0); drum.castShadow = true;
  g.add(drum);
  g.add(box(0.06, 0.12, 0.06, dark, { x: 0.12, y: 0.06, z: 0.1, r: 0.01 }));
  return g;
}

export function wallShelf({ x = 0, y = 1.2, z = 0, w = 1.4, d = 0.3, color = C.oak } = {}) {
  const g = new THREE.Group();
  g.add(box(w, 0.04, d, mat(color, { rough: 0.6 }), { r: 0.01 }));
  g.position.set(x, y, z);
  return g;
}

/** A running shoe. */
export function shoe({ color = '#f1ece2', sole = '#ffffff', accent = '#c7c2b8' } = {}) {
  const g = new THREE.Group();
  const body = mat(color, { rough: 0.7 });
  const s = box(0.28, 0.035, 0.1, mat(sole, { rough: 0.6 }), { r: 0.015 });
  g.add(s);
  const upper = box(0.2, 0.07, 0.09, body, { x: -0.03, y: 0.03, r: 0.035 });
  g.add(upper);
  const toe = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 10), body);
  toe.scale.set(1.3, 0.75, 0.92); toe.position.set(0.08, 0.05, 0); toe.castShadow = true;
  g.add(toe);
  g.add(box(0.06, 0.05, 0.095, mat(accent, { rough: 0.6 }), { x: -0.1, y: 0.04, r: 0.02 }));
  return g;
}

export function clothesRack({ x = 0, z = 0, rot = 0, colors = ['#3f5469', '#c46a52', '#e8e2d6', '#5f7357', '#2f3e56'] } = {}) {
  const g = new THREE.Group();
  const metal = mat(C.metalDark, { metal: 0.6, rough: 0.35 });
  for (const sx of [-0.6, 0.6]) g.add(cyl(0.015, 0.015, 1.5, metal, { x: sx }));
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.25, 10), metal);
  bar.rotation.z = Math.PI / 2; bar.position.y = 1.5;
  g.add(bar);
  colors.forEach((c, i) => g.add(box(0.06, 0.62, 0.42, mat(c, { rough: 0.95 }), { x: -0.45 + i * 0.22, y: 0.82, r: 0.02 })));
  g.position.set(x, 0, z); g.rotation.y = rot;
  return g;
}

export function bench({ x = 0, z = 0, w = 1.2, rot = 0, color = C.fabricRust } = {}) {
  const g = new THREE.Group();
  g.add(box(w, 0.1, 0.42, mat(color, { rough: 0.9, tex: 'fabric' }), { y: 0.36, r: 0.04 }));
  for (const sx of [-w / 2 + 0.08, w / 2 - 0.08]) for (const sz of [-0.14, 0.14]) g.add(box(0.04, 0.36, 0.04, mat(C.walnut), { x: sx, z: sz, r: 0.008 }));
  g.position.set(x, 0, z); g.rotation.y = rot;
  return g;
}

export function serverShelf({ x = 0, z = 0, rot = 0, view = null } = {}) {
  const g = new THREE.Group();
  const frame = mat('#2b2f36', { rough: 0.5, metal: 0.4 });
  g.add(box(0.62, 1.2, 0.5, frame, { r: 0.02 }));
  const leds = [];
  for (let i = 0; i < 4; i++) {
    g.add(box(0.56, 0.18, 0.02, mat('#1c1f24', { rough: 0.4, metal: 0.3 }), { y: 0.15 + i * 0.26, z: 0.25, r: 0.004 }));
    for (let k = 0; k < 3; k++) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.01), new THREE.MeshBasicMaterial({ color: k === 0 ? '#7fe3a1' : '#7cc8ff', toneMapped: false }));
      led.position.set(0.2 + k * 0.03, 0.24 + i * 0.26, 0.262);
      led.userData.noGlow = true;
      g.add(led);
      leds.push(led);
    }
  }
  g.position.set(x, 0, z); g.rotation.y = rot;
  g.userData.dynamic = true;
  if (view) view.every((dt, t) => leds.forEach((l, i) => { l.visible = Math.sin(t * (3 + (i % 5)) + i * 1.7) > -0.2; }));
  return g;
}

/** A small locked cabinet for files the agent may not change (lock can be opened). */
export function vault({ x = 0, z = 0, rot = 0 } = {}) {
  const g = new THREE.Group();
  g.add(box(0.6, 0.7, 0.45, mat('#5b6472', { rough: 0.4, metal: 0.5 }), { r: 0.03 }));
  g.add(box(0.5, 0.58, 0.02, mat('#6c7685', { rough: 0.35, metal: 0.5 }), { y: 0.06, z: 0.23, r: 0.01 }));
  const lock = new THREE.Group();
  lock.add(box(0.12, 0.1, 0.05, mat('#e0b64a', { rough: 0.3, metal: 0.7 }), { r: 0.015 }));
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 8, 20, Math.PI), mat('#c9ccd0', { rough: 0.25, metal: 0.9 }));
  shackle.position.y = 0.1; shackle.castShadow = true;
  lock.add(shackle);
  lock.position.set(0, 0.36, 0.27);
  g.add(lock);
  g.position.set(x, 0, z); g.rotation.y = rot;
  g.userData.lock = lock; g.userData.shackle = shackle;
  return g;
}

export function armchair({ x = 0, z = 0, rot = 0, color = C.fabricBlue } = {}) {
  const g = new THREE.Group();
  const f = mat(color, { rough: 0.95, tex: 'fabric' });
  g.add(box(0.8, 0.3, 0.78, f, { y: 0.12, r: 0.07 }));
  g.add(box(0.8, 0.5, 0.18, f, { y: 0.38, z: -0.3, r: 0.08 }));
  for (const sx of [-0.34, 0.34]) g.add(box(0.14, 0.28, 0.74, f, { x: sx, y: 0.4, r: 0.06 }));
  g.add(box(0.52, 0.1, 0.56, mat(color, { rough: 0.98, tex: 'fabric' }), { y: 0.42, z: 0.04, r: 0.04 }));
  for (const [lx, lz] of [[-0.32, -0.3], [0.32, -0.3], [-0.32, 0.3], [0.32, 0.3]]) g.add(cyl(0.025, 0.02, 0.12, mat(C.walnut), { x: lx, z: lz }));
  g.position.set(x, 0, z); g.rotation.y = rot;
  return g;
}

export function walker() {
  const g = new THREE.Group();
  const m = mat('#b9bec5', { metal: 0.7, rough: 0.3 });
  for (const sx of [-0.24, 0.24]) {
    for (const sz of [-0.18, 0.18]) g.add(cyl(0.012, 0.012, 0.82, m, { x: sx, z: sz }));
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.4, 8), m);
    top.rotation.x = Math.PI / 2; top.position.set(sx, 0.82, 0);
    g.add(top);
    for (const sz of [0.18]) { const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.025, 14), mat('#2b2e33')); wheel.rotation.z = Math.PI / 2; wheel.position.set(sx, 0.04, sz); g.add(wheel); }
  }
  const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.48, 8), m);
  crossbar.rotation.z = Math.PI / 2; crossbar.position.set(0, 0.55, 0.18);
  g.add(crossbar);
  return g;
}

/** A wall board drawn on a canvas, e.g. a weekly activity calendar. */
export function wallBoard({ x = 0, y = 1.5, z = 0, w = 1.2, h = 0.8, axis = 'z', paint } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 384; canvas.height = 256;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  g.add(box(w + 0.06, h + 0.06, 0.03, mat('#e9e4da', { rough: 0.6 }), { y: -h / 2 - 0.03, r: 0.01 }));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
  face.position.z = 0.02;
  g.add(face);
  g.position.set(x, y, z);
  if (axis === 'x') g.rotation.y = Math.PI / 2;
  const ctx = canvas.getContext('2d');
  g.userData.paint = fn => { fn(ctx, canvas.width, canvas.height); tex.needsUpdate = true; };
  if (paint) g.userData.paint(paint);
  return g;
}

export function door({ x = 0, z = 0, axis = 'z', color = '#b98f62', open = 0 } = {}) {
  const g = new THREE.Group();
  const frame = mat('#f2ede4', { rough: 0.6 });
  g.add(box(0.08, 2.1, 0.12, frame, { x: -0.5, r: 0.01 }), box(0.08, 2.1, 0.12, frame, { x: 0.5, r: 0.01 }), box(1.08, 0.08, 0.12, frame, { y: 2.06, r: 0.01 }));
  const hinge = new THREE.Group();
  hinge.position.set(-0.46, 0, 0.02);
  const panel = box(0.9, 2.04, 0.04, mat(color, { rough: 0.6 }), { x: 0.45, r: 0.01 });
  hinge.add(panel);
  hinge.add(cyl(0.025, 0.025, 0.04, mat('#c9ccd0', { metal: 0.8, rough: 0.3 }), { x: 0.82, y: 1.0, z: 0.03 }));
  hinge.rotation.y = -open;
  g.add(hinge);
  g.position.set(x, 0, z);
  if (axis === 'x') g.rotation.y = Math.PI / 2;
  g.userData.hinge = hinge;
  g.userData.dynamic = true;
  return g;
}
