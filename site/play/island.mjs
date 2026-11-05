// The hero of the Demo page: a floating island over the sea with one building for each episode, after
// the illustration in assets/play/island.webp. Each building is cut open towards the viewer and shows
// its episode's people and devices at the moment the episode is about. Units are metres, y is up; the
// camera looks from +x +z, so the open sides of every building face +x and +z.
//
// Performance: everything that never moves is coloured per vertex and merged (one mesh per material for
// the land, a few per building); trees, bushes, flowers and vines are instanced; water and the sea are
// small shaders. A frame draws about a hundred meshes.
import * as THREE from 'three';
import { mergeStatic, mergeChildren } from './merge.mjs';
import { VC, VC_SATIN, VC_LIT, paint, piece, bake, miniPerson, miniHomeRobot, miniServiceRobot } from './mini.mjs';
import * as K from './kit.mjs';

const R = 16.5;            // half size of the island top
const T = 1.2;             // height of the back terrace
const SEA = -40;           // sea level
const BACK_Z = -6.5, BACK_X = -7;
const onTerrace = (x, z) => z < BACK_Z || x < BACK_X;

function rand(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function noise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ---------- materials ----------

const ROCK = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
// warm plaster inside the rooms: lamplight on the walls without a light per room
const INNER = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, emissive: '#ffd9a8', emissiveIntensity: 0.14 });
let STONE = null;
/** Ashlar stone, coloured in the texture; uvs of tiledBox() are in metres. */
function stoneMaterial() {
  if (STONE) return STONE;
  const map = texture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#7d7466'; ctx.fillRect(0, 0, w, h);
    const r = rand(5);
    const rows = 8;
    for (let j = 0; j < rows; j++) {
      let x = j % 2 ? -18 : 0;
      while (x < w) {
        const sw = 34 + r() * 30, y = (j * h) / rows;
        const tone = r();
        const c = tone < 0.33 ? [196, 184, 162] : tone < 0.66 ? [178, 168, 150] : [208, 198, 178];
        const v = (r() - 0.5) * 18;
        ctx.fillStyle = `rgb(${c[0] + v | 0},${c[1] + v | 0},${c[2] + v | 0})`;
        ctx.beginPath(); ctx.roundRect(x + 2, y + 2, sw - 4, h / rows - 4, 4); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + 4, y + 3, sw - 10, 3);
        x += sw;
      }
    }
  }, [1, 1]);
  map.colorSpace = THREE.SRGBColorSpace;
  STONE = new THREE.MeshStandardMaterial({ map, roughness: 0.92 });
  return STONE;
}
/** A box whose uvs are in units of `unit` metres on every face, so a texture keeps its scale. */
function tiledBox(w, h, d, unit = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const spans = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let i = 0; i < uv.count; i++) {
    const [su, sv] = spans[Math.floor(i / 4)];
    uv.setXY(i, (uv.getX(i) * su) / unit, (uv.getY(i) * sv) / unit);
  }
  return g;
}
function stoneBox(w, h, d, { x = 0, y = 0, z = 0 } = {}) {
  const m = new THREE.Mesh(tiledBox(w, h, d), stoneMaterial());
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
const GLASS = new THREE.MeshStandardMaterial({ color: '#cfe6f2', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
const CLOUD = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#dbe8f7', emissiveIntensity: 0.55 });

function texture(w, h, paintFn, repeat) {
  const t = K.canvasTex(w, h, paintFn, { repeat });
  t.anisotropy = 8;
  return t;
}
function grassMaterial() {
  const map = texture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#82b45a'; ctx.fillRect(0, 0, w, h);
    const r = rand(3);
    for (let i = 0; i < 2600; i++) {
      const v = r();
      ctx.fillStyle = v < 0.45 ? 'rgba(70,120,50,0.28)' : v < 0.8 ? 'rgba(180,215,120,0.3)' : 'rgba(120,160,70,0.35)';
      ctx.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3);
    }
  }, [1, 1]);
  map.repeat.set(1 / 5, 1 / 5);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.95 });
}
function pathMaterial() {
  const map = texture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#9d907d'; ctx.fillRect(0, 0, w, h);
    const r = rand(11);
    const rows = 8;
    for (let j = 0; j < rows; j++) {
      let x = -r() * 30;
      while (x < w) {
        const sw = 22 + r() * 22, y = (j * h) / rows;
        const tone = 205 + Math.floor(r() * 30);
        ctx.fillStyle = `rgb(${tone},${tone - 10},${tone - 26})`;
        ctx.beginPath(); ctx.roundRect(x + 2, y + 2, sw - 4, h / rows - 4, 6); ctx.fill();
        x += sw;
      }
    }
  }, [1, 1]);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.92 });
}

// ---------- shapes ----------

/** The island outline: a rounded square with a little wobble, as [x, z] points. */
function outline(n = 160) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a), p = 3.6;
    const r = R / Math.pow(Math.pow(Math.abs(c), p) + Math.pow(Math.abs(s), p), 1 / p);
    const k = 1 + 0.03 * Math.sin(a * 5 + 1.3) + 0.022 * Math.sin(a * 11 + 0.4) + 0.012 * Math.sin(a * 23);
    pts.push([c * r * k, s * r * k]);
  }
  return pts;
}
/** Keep the part of a polygon where f(p) >= 0 (f linear). */
function clip(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = f(a), db = f(b);
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
/** A flat polygon at height y (points are [x, z]). */
function flat(poly, y) {
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  // world-space uvs so textures keep their scale on every piece
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
  return g;
}
/** A strip along a polyline of [x, z] points, width w, at height y, with uvs in metres. */
function ribbon(points, w, y) {
  const pos = [], uv = [], idx = [];
  let run = 0;
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i];
    const prev = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
    let dx = next[0] - prev[0], dz = next[1] - prev[1];
    const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
    if (i > 0) run += Math.hypot(x - points[i - 1][0], z - points[i - 1][1]);
    const nx = -dz * w / 2, nz = dx * w / 2;
    pos.push(x + nx, y, z + nz, x - nx, y, z - nz);
    uv.push(0, run / w, 1, run / w);
    if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // make the normals point up whatever the winding
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

/** Instances of one geometry: add(x, y, z, sx, sy, sz, color, rotY), then build(). */
function scatter(geometry, material, { shadow = true } = {}) {
  const items = [];
  return {
    add(x, y, z, sx, sy = sx, sz = sx, color = '#ffffff', ry = 0) { items.push([x, y, z, sx, sy, sz, color, ry]); },
    build() {
      const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, items.length));
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
      items.forEach(([x, y, z, sx, sy, sz, color, ry], i) => {
        m.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(0, ry, 0)), new THREE.Vector3(sx, sy, sz));
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, c.set(color));
      });
      mesh.count = items.length;
      mesh.castShadow = shadow; mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      return mesh;
    },
    get count() { return items.length; }
  };
}
const LEAF = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.88 });
const BARK = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 });
const BLOOM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 });

// ---------- water ----------

const waterUniforms = { uTime: { value: 0 } };
function seaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...waterUniforms, uFogColor: { value: new THREE.Color('#a9d4f2') } },
    vertexShader: `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uFogColor; varying vec3 vW;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y); }
      void main() {
        vec2 p = vW.xz;
        float t = uTime;
        float w = n(p * 0.05 + vec2(t * 0.04, t * 0.02)) * 0.6 + n(p * 0.14 - vec2(t * 0.06, -t * 0.04)) * 0.4;
        vec3 deep = vec3(0.012, 0.1, 0.36), mid = vec3(0.03, 0.22, 0.56);
        vec3 col = mix(deep, mid, smoothstep(0.3, 0.8, w));
        // wave crests: thin short strokes on the swell, sparse
        vec2 q = p * vec2(0.3, 1.1) + vec2(t * 0.25, 0.0);
        float c = n(q + n(p * 0.04) * 5.0);
        float crest = smoothstep(0.9, 0.935, c) * smoothstep(0.5, 0.7, w);
        col = mix(col, vec3(0.75, 0.9, 1.0), crest * 0.55);
        float glint = smoothstep(0.965, 0.99, n(p * 0.7 + vec2(-t * 0.5, t * 0.2)));
        col += vec3(0.5, 0.6, 0.65) * glint * 0.5;
        float d = length(vW.xz - cameraPosition.xz);
        col = mix(col, uFogColor, smoothstep(140.0, 520.0, d) * 0.85);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`
  });
}
function fallMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime; varying vec2 vUv;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y); }
      void main() {
        float streak = n(vec2(vUv.x * 14.0, vUv.y * 5.0 - uTime * 2.2));
        streak = streak * 0.6 + n(vec2(vUv.x * 30.0, vUv.y * 9.0 - uTime * 3.1)) * 0.4;
        vec3 col = mix(vec3(0.42, 0.72, 0.95), vec3(0.97, 0.99, 1.0), smoothstep(0.3, 0.75, streak));
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float a = edge * (0.78 + streak * 0.22) * smoothstep(1.0, 0.85, vUv.y);
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`
  });
}

// ---------- the land ----------

function land(rnd) {
  const g = new THREE.Group();
  const out = outline();
  // tops: the front and the L-shaped back terrace
  const front = clip(clip(out, p => p[1] - BACK_Z), p => p[0] - BACK_X);
  const backA = clip(out, p => BACK_Z - p[1]);
  const backB = clip(clip(out, p => p[1] - BACK_Z), p => BACK_X - p[0]);
  const grass = grassMaterial();
  for (const [poly, y] of [[front, 0], [backA, T], [backB, T]]) {
    const m = new THREE.Mesh(flat(poly, y), grass);
    m.receiveShadow = true;
    g.add(m);
  }
  // retaining walls of the terrace, with a cap
  const crossing = (axis, v, sign) => {
    let best = null;
    for (let i = 0; i < out.length; i++) {
      const a = out[i], b = out[(i + 1) % out.length];
      const da = a[axis] - v, db = b[axis] - v;
      if ((da >= 0) === (db >= 0)) continue;
      const t = da / (da - db);
      const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const other = p[1 - axis];
      if (other * sign > 0 && (!best || Math.abs(other) > Math.abs(best[1 - axis]))) best = p;
    }
    return best;
  };
  const endX = crossing(1, BACK_Z, 1)[0];   // where z = BACK_Z meets the right edge
  const endZ = crossing(0, BACK_X, 1)[1];   // where x = BACK_X meets the front edge
  const capC = '#d8ccb8';
  const wallA = endX - BACK_X + 0.4, wallB = endZ - BACK_Z + 0.4;
  g.add(stoneBox(wallA, T + 0.35, 0.45, { x: (BACK_X + endX) / 2, y: (T + 0.35) / 2 - 0.2, z: BACK_Z }));
  g.add(piece(new THREE.BoxGeometry(wallA, 0.1, 0.6), capC, { x: (BACK_X + endX) / 2, y: T + 0.2, z: BACK_Z }));
  g.add(stoneBox(0.45, T + 0.35, wallB, { x: BACK_X, y: (T + 0.35) / 2 - 0.2, z: (BACK_Z + endZ) / 2 }));
  g.add(piece(new THREE.BoxGeometry(0.6, 0.1, wallB), capC, { x: BACK_X, y: T + 0.2, z: (BACK_Z + endZ) / 2 }));
  g.add(cliffs(out, rnd));
  return { group: g, out };
}

/** The rocky underside: rings that taper downwards, banded like sandstone, and stalactites. */
function rockDetail() {
  const map = texture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    const r = rand(9);
    for (let y = 0; y < h; y += 2) {
      const v = 214 + Math.sin(y * 0.21) * 16 + Math.sin(y * 0.047 + 1) * 14 + (r() - 0.5) * 10;
      ctx.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
      ctx.fillRect(0, y, w, 2);
    }
    for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(60,45,30,${0.1 + r() * 0.15})`; ctx.fillRect(r() * w, r() * h, 2 + r() * 10, 1 + r() * 2); }
  }, [1, 1]);
  map.colorSpace = THREE.NoColorSpace;
  return map;
}

function cliffs(out, rnd) {
  const g = new THREE.Group();
  ROCK.map = rockDetail();
  const rings = [[0, 1.0], [0.45, 1.0], [1.3, 0.99], [2.6, 0.96], [4.2, 0.9], [6.2, 0.78], [8.8, 0.6], [11.5, 0.38], [14, 0.16]];
  const n = out.length;
  const pos = [], col = [];
  const band = ['#c8a779', '#b48f63', '#d6bb8f', '#a88358', '#c29e72', '#9a7a55', '#8a6d4f', '#7a6249', '#6b5643'];
  const ring = rings.map(([depth, k], ri) => out.map(([x, z], i) => {
    const top = ri === 0 && onTerrace(x * 0.98, z * 0.98) ? T : 0;
    const wob = ri < 2 ? 1 : 1 + (noise(i * 0.35, ri * 1.7) - 0.5) * 0.16;
    const y = ri === 0 ? top : -depth - (ri > 1 ? noise(i * 0.5, ri) * 1.4 : 0) + (ri === 1 ? top * 0.5 : 0);
    return [x * k * wob, y, z * k * wob];
  }));
  for (let ri = 0; ri < rings.length - 1; ri++) {
    for (let i = 0; i < n; i++) {
      const a = ring[ri][i], b = ring[ri][(i + 1) % n], c = ring[ri + 1][i], d = ring[ri + 1][(i + 1) % n];
      pos.push(...a, ...c, ...b, ...b, ...c, ...d);
      const base = new THREE.Color(ri === 0 ? '#6f5a3e' : band[ri]);
      const v = 0.9 + noise(i * 0.7, ri * 3.1) * 0.2;
      for (let k = 0; k < 6; k++) col.push(base.r * v, base.g * v, base.b * v);
    }
  }
  // close the bottom
  const tip = [0, -16.5, 0];
  for (let i = 0; i < n; i++) {
    const a = ring[rings.length - 1][i], b = ring[rings.length - 1][(i + 1) % n];
    pos.push(...a, ...tip, ...b);
    const base = new THREE.Color('#5f4c3a');
    for (let k = 0; k < 3; k++) col.push(base.r, base.g, base.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  // uvs around the island in metres, so the bands of the rock stay level
  const uvs = [];
  for (let i = 0; i < pos.length; i += 3) uvs.push(Math.atan2(pos[i + 2], pos[i]) * 4, pos[i + 1] / 5);
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  const rock = new THREE.Mesh(geo, ROCK);
  rock.castShadow = true; rock.receiveShadow = true;
  g.add(rock);
  // stalactites hanging from the underside, longer towards the middle
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 0.85;
    const [ox, oz] = out[Math.floor((a / (Math.PI * 2)) * n) % n];
    const x = ox * rr * 0.62, z = oz * rr * 0.62;
    const depth = 3 + (1 - rr) * 9;
    const len = 2.5 + rnd() * 5;
    const cone = new THREE.ConeGeometry(0.8 + rnd() * 1.6, len, 6, 3);
    cone.rotateX(Math.PI);
    cone.translate(0, -len / 2, 0);
    const p = cone.attributes.position;
    for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) * (0.85 + hash(k, i) * 0.3), p.getY(k), p.getZ(k) * (0.85 + hash(i, k) * 0.3));
    const c = new THREE.Color(band[3 + (i % 5)]);
    paint(cone, c);
    const m = new THREE.Mesh(cone, ROCK);
    m.position.set(x, -depth + 0.5, z);
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

// ---------- buildings ----------

const GLASS_GEOS = new Map();
function addGlass(b, geo) { if (!GLASS_GEOS.has(b)) GLASS_GEOS.set(b, []); GLASS_GEOS.get(b).push(geo); }

/**
 * A building shell cut open towards the viewer: plinth, floor, back (-z) and left (-x) walls with inner
 * plaster, a post at the open corner, and a roof. Returns the group; content goes inside at y = 0.
 */
function shell(b, { w, d, h = 3.3, wall = '#e8dfd0', inner = '#f3ebdd', floor = '#b98a5e', plinth = '#a89c8a', roof = 'gable', roofColor = '#4b505a', trim = '#f6f1e8', glass = false, windows = true, stone = false }) {
  const g = b.group;
  b.roof = new THREE.Group();
  g.add(b.roof);
  g.add(piece(new THREE.BoxGeometry(w + 0.4, 0.42, d + 0.4), plinth, { y: -0.17 }));
  g.add(piece(new THREE.BoxGeometry(w, 0.06, d), floor, { y: 0.06 }));
  const t = 0.24;
  if (glass) {
    // a frame of dark metal and panes of glass on every side
    const metal = '#2f343b';
    for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) g.add(piece(new THREE.BoxGeometry(0.12, h, 0.12), metal, { x, y: h / 2 + 0.06, z, finish: 'satin' }));
    for (const y of [0.12, h + 0.02]) {
      g.add(piece(new THREE.BoxGeometry(w, 0.1, 0.1), metal, { y, z: -d / 2, finish: 'satin' }), piece(new THREE.BoxGeometry(w, 0.1, 0.1), metal, { y, z: d / 2, finish: 'satin' }));
      g.add(piece(new THREE.BoxGeometry(0.1, 0.1, d), metal, { x: -w / 2, y, finish: 'satin' }), piece(new THREE.BoxGeometry(0.1, 0.1, d), metal, { x: w / 2, y, finish: 'satin' }));
    }
    const mullions = (len, axis, at) => {
      const k = Math.max(2, Math.round(len / 1.4));
      for (let i = 1; i < k; i++) {
        const v = -len / 2 + (i * len) / k;
        g.add(piece(new THREE.BoxGeometry(0.06, h, 0.06), metal, axis === 'x' ? { x: v, y: h / 2 + 0.06, z: at, finish: 'satin' } : { x: at, y: h / 2 + 0.06, z: v, finish: 'satin' }));
      }
    };
    mullions(w, 'x', -d / 2); mullions(w, 'x', d / 2); mullions(d, 'z', -w / 2); mullions(d, 'z', w / 2);
    for (const [pw, px, pz, ry] of [[w, 0, -d / 2, 0], [w, 0, d / 2, 0], [d, -w / 2, 0, Math.PI / 2], [d, w / 2, 0, Math.PI / 2]]) {
      const pane = new THREE.PlaneGeometry(pw, h - 0.1);
      pane.rotateY(ry);
      pane.translate(px, h / 2 + 0.07, pz);
      addGlass(b, pane);
    }
  } else {
    if (stone) {
      g.add(stoneBox(w + t, h, t, { x: -t / 2, y: h / 2 + 0.06, z: -d / 2 - t / 2 }));
      g.add(stoneBox(t, h, d, { x: -w / 2 - t / 2, y: h / 2 + 0.06 }));
    } else {
      g.add(piece(new THREE.BoxGeometry(w + t, h, t), wall, { x: -t / 2, y: h / 2 + 0.06, z: -d / 2 - t / 2 }));
      g.add(piece(new THREE.BoxGeometry(t, h, d), wall, { x: -w / 2 - t / 2, y: h / 2 + 0.06 }));
    }
    const innerWall = (geo, opts) => { const m = piece(geo, inner, { ...opts, shadow: false }); m.material = INNER; return m; };
    g.add(innerWall(new THREE.BoxGeometry(w - 0.02, h - 0.02, 0.02), { y: h / 2 + 0.06, z: -d / 2 + 0.01 }));
    g.add(innerWall(new THREE.BoxGeometry(0.02, h - 0.02, d - 0.02), { x: -w / 2 + 0.01, y: h / 2 + 0.06 }));
    // skirting and the cut edges of the open sides
    g.add(piece(new THREE.BoxGeometry(w, 0.1, 0.03), trim, { y: 0.14, z: -d / 2 + 0.03, shadow: false }));
    g.add(piece(new THREE.BoxGeometry(0.03, 0.1, d), trim, { x: -w / 2 + 0.03, y: 0.14, shadow: false }));
    if (windows) {
      // a window in each wall: sky behind glass, with a frame
      for (const [ax, at, len] of [['x', -d / 2 + 0.03, w], ['z', -w / 2 + 0.03, d]]) {
        const ww = Math.min(1.5, len * 0.3), wh = 1.1, c = len * 0.18;
        const opts = ax === 'x' ? { x: c, y: 1.55, z: at } : { x: at, y: 1.55, z: -c };
        const geo = ax === 'x' ? new THREE.BoxGeometry(ww, wh, 0.03) : new THREE.BoxGeometry(0.03, wh, ww);
        g.add(piece(geo, '#bfe0f5', { ...opts, finish: 'lit' }));
        const fr = ax === 'x' ? new THREE.BoxGeometry(ww + 0.12, wh + 0.12, 0.02) : new THREE.BoxGeometry(0.02, wh + 0.12, ww + 0.12);
        g.add(piece(fr, trim, { ...opts, x: ax === 'x' ? opts.x : opts.x - 0.012, z: ax === 'x' ? opts.z - 0.012 : opts.z, shadow: false }));
        const bar = ax === 'x' ? new THREE.BoxGeometry(0.05, wh, 0.04) : new THREE.BoxGeometry(0.04, wh, 0.05);
        g.add(piece(bar, trim, { ...opts, shadow: false }));
      }
    }
  }
  const top = h + 0.06;
  if (roof === 'gable' || roof === 'glass') gableRoof(b, w, d, top, roofColor, roof === 'glass');
  else if (roof === 'hip') hipRoof(b.roof, w, d, top, roofColor);
  else flatRoof(b.roof, w, d, top, roofColor);
  b.top = top;
  return g;
}

function gableRoof(b, w, d, top, color, glass) {
  const g = b.roof;
  const o = 0.28, rise = d * 0.36, half = d / 2 + o;
  const slope = Math.atan2(rise, d / 2), len = Math.hypot(half, rise * (half / (d / 2)));
  for (const s of [1, -1]) {
    const slab = new THREE.Group();
    slab.position.set(0, top + rise / 2 - 0.02, s * d / 4);
    slab.rotation.x = s * slope;
    if (glass) {
      // dark frame with glass panes
      slab.add(piece(new THREE.BoxGeometry(w + o * 2, 0.08, 0.1), '#2f343b', { z: s * len / 2, finish: 'satin' }));
      slab.add(piece(new THREE.BoxGeometry(w + o * 2, 0.08, 0.1), '#2f343b', { z: -s * len / 2, finish: 'satin' }));
      const k = 5;
      for (let i = 0; i <= k; i++) slab.add(piece(new THREE.BoxGeometry(0.08, 0.09, len), '#2f343b', { x: -w / 2 - o + (i * (w + o * 2)) / k, finish: 'satin' }));
      const pane = new THREE.PlaneGeometry(w + o * 2, len);
      pane.rotateX(-Math.PI / 2);
      pane.applyMatrix4(new THREE.Matrix4().makeRotationX(s * slope));
      pane.translate(0, top + rise / 2 - 0.02, s * d / 4);
      addGlass(b.roof, pane);
    } else {
      slab.add(piece(new THREE.BoxGeometry(w + o * 2, 0.16, len), color));
      // rows of tiles
      for (let i = 0; i < 7; i++) slab.add(piece(new THREE.BoxGeometry(w + o * 2, 0.05, 0.05), new THREE.Color(color).multiplyScalar(0.78), { y: 0.09, z: -len / 2 + (i + 0.5) * (len / 7), shadow: false }));
    }
    g.add(slab);
  }
  // gable ends
  const tri = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, rise)]);
  for (const s of [1, -1]) {
    const geo = new THREE.ExtrudeGeometry(tri, { depth: 0.2, bevelEnabled: false });
    geo.rotateY(Math.PI / 2);
    g.add(piece(geo, glass ? '#b9ad9a' : '#e8dfd0', { x: s * (w / 2) - (s > 0 ? 0.2 : 0), y: top - 0.02 }));
  }
  g.add(piece(new THREE.BoxGeometry(w + o * 2 + 0.1, 0.14, 0.18), glass ? '#2f343b' : new THREE.Color(color).multiplyScalar(0.7), { y: top + rise + 0.03 }));
  b.roofTop = top + rise;
}

function hipRoof(g, w, d, top, color) {
  const o = 0.3, W = w / 2 + o, D = d / 2 + o, rise = d * 0.4, ridge = Math.max(0.2, W - D);
  const v = [[-W, 0, -D], [W, 0, -D], [W, 0, D], [-W, 0, D], [-ridge, rise, 0], [ridge, rise, 0]];
  const faces = [[0, 4, 5, 1], [2, 5, 4, 3], [1, 5, 2], [3, 4, 0]];
  const pos = [];
  for (const f of faces) {
    const tri = f.length === 4 ? [[f[0], f[1], f[2]], [f[0], f[2], f[3]]] : [f];
    for (const t of tri) for (const k of t) pos.push(...v[k]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  g.add(piece(geo, color, { y: top + 0.12 }));
  // a thickness under the eaves
  g.add(piece(new THREE.BoxGeometry(W * 2, 0.14, D * 2), new THREE.Color(color).multiplyScalar(0.7), { y: top + 0.05 }));
  for (let i = 1; i < 6; i++) {
    const k = i / 6;
    g.add(piece(new THREE.BoxGeometry(W * 2 * (1 - k) + ridge * 2 * k + 0.02, 0.04, 0.04), new THREE.Color(color).multiplyScalar(0.8), { y: top + 0.14 + rise * k, z: D * (1 - k), shadow: false }));
    g.add(piece(new THREE.BoxGeometry(0.04, 0.04, D * 2 * (1 - k) + 0.02), new THREE.Color(color).multiplyScalar(0.8), { x: W * (1 - k) + ridge * k, y: top + 0.14 + rise * k, shadow: false }));
  }
}

function flatRoof(g, w, d, top, color) {
  g.add(piece(new THREE.BoxGeometry(w + 0.5, 0.22, d + 0.5), color, { y: top + 0.05 }));
  const p = new THREE.Color(color).multiplyScalar(0.85);
  g.add(piece(new THREE.BoxGeometry(w + 0.5, 0.22, 0.12), p, { y: top + 0.27, z: -d / 2 - 0.19 }));
  g.add(piece(new THREE.BoxGeometry(0.12, 0.22, d + 0.5), p, { x: -w / 2 - 0.19, y: top + 0.27 }));
  g.add(piece(new THREE.BoxGeometry(w + 0.5, 0.22, 0.12), p, { y: top + 0.27, z: d / 2 + 0.19 }));
  g.add(piece(new THREE.BoxGeometry(0.12, 0.22, d + 0.5), p, { x: w / 2 + 0.19, y: top + 0.27 }));
}

/** Kit furniture, placed and re-coloured per vertex. */
function put(g, obj, x = 0, y = 0, z = 0, ry = 0) {
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  obj.traverse(o => { delete o.userData.dynamic; });
  g.add(bake(obj));
  return obj;
}
function laptopMini(g, x, y, z, ry = 0, screen = '#9fc2ff') {
  const l = new THREE.Group();
  l.add(piece(new THREE.BoxGeometry(0.36, 0.02, 0.25), '#b8bcc2', { finish: 'satin' }));
  const lid = new THREE.Group();
  lid.position.set(0, 0.01, -0.125);
  lid.rotation.x = -0.32;
  lid.add(piece(new THREE.BoxGeometry(0.36, 0.25, 0.015), '#b8bcc2', { y: 0.125, finish: 'satin' }));
  lid.add(piece(new THREE.PlaneGeometry(0.32, 0.21), screen, { y: 0.125, z: 0.009, finish: 'lit' }));
  l.add(lid);
  l.position.set(x, y, z); l.rotation.y = ry;
  g.add(l);
}
function lamp(g, x, y, z) {
  g.add(piece(new THREE.CylinderGeometry(0.16, 0.24, 0.2, 10, 1, true), '#ffdca0', { x, y, z, finish: 'lit' }));
  const halo = K.glow('#ffcf8f', 1.6);
  halo.position.set(x, y - 0.1, z);
  halo.material.opacity = 0.5;
  g.add(halo);
}
function plantMini(g, x, z, s = 1, y = 0) {
  g.add(piece(new THREE.CylinderGeometry(0.16 * s, 0.12 * s, 0.3 * s, 8), '#c97f5a', { x, y: y + 0.15 * s, z }));
  for (let i = 0; i < 4; i++) g.add(piece(new THREE.IcosahedronGeometry(0.22 * s, 0), ['#5d8a4e', '#4c7a42', '#6e9c55'][i % 3], { x: x + Math.cos(i * 1.7) * 0.12 * s, y: y + (0.42 + (i % 2) * 0.16) * s, z: z + Math.sin(i * 1.7) * 0.12 * s }));
}
function shoesOnShelf(g, start, y, fixed, n, along = 'x', colors = ['#f1ece2', '#2b2e33', '#3f6fb5', '#c0533a', '#e6c14e', '#5f8f6a']) {
  for (let i = 0; i < n; i++) {
    const c = colors[(i * 7 + Math.round(y * 10)) % colors.length];
    const off = start + i * 0.36;
    for (const s of [-0.07, 0.07]) {
      const geo = along === 'x' ? new THREE.BoxGeometry(0.1, 0.08, 0.26) : new THREE.BoxGeometry(0.26, 0.08, 0.1);
      g.add(piece(geo, c, along === 'x' ? { x: off + s, y: y + 0.04, z: fixed, shadow: false } : { x: fixed, y: y + 0.04, z: off + s, shadow: false }));
    }
  }
}

// ---------- small helpers for the looping scenes in the buildings ----------

const smooth = k => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
/** 0 → 1 between seconds a and b of a loop, eased. */
const ramp = (t, a, b) => smooth((t - a) / (b - a));
/** A dynamic group whose static parts are merged among themselves (it still moves as a whole). */
function mover(obj) { mergeStatic(obj); obj.userData.dynamic = true; return obj; }
/** Walk an object along [[x, z], ...] for k in 0..1 (eased per leg), facing where it goes. */
function along(obj, pts, k) {
  const legs = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = legs.reduce((a, b) => a + b, 0);
  let d = smooth(k) * total, i = 0;
  while (i < legs.length - 1 && d > legs[i]) { d -= legs[i]; i++; }
  const f = legs[i] ? d / legs[i] : 0, [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
  obj.position.x = x0 + (x1 - x0) * f;
  obj.position.z = z0 + (z1 - z0) * f;
  return Math.atan2(x1 - x0, z1 - z0);
}
/** Turn towards yaw, the short way round, by k. */
const turn = (from, to, k) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * smooth(k);

/** The eight buildings, keyed by episode id. Positions are the centres of their floors. */
const BUILDINGS = {
  workbench: { at: [-11.2, 1.2], level: T, w: 6, d: 4.8, build(b) {
    const g = shell(b, { w: 6, d: 4.8, h: 3.0, wall: '#b9ad9a', inner: '#efe5d4', floor: '#a97b52', plinth: '#9b8f7d', roof: 'glass', stone: true });
    put(g, K.workbench({ w: 2.8, d: 0.85 }), 0.2, 0.06, 0.1);
    put(g, K.machine(), -0.6, 0.98, 0.15);
    g.add(piece(new THREE.BoxGeometry(2.6, 1.0, 0.03), '#c9a77b', { x: 0.2, y: 1.75, z: -2.37, shadow: false }));
    ['#c0392b', '#2f3e56', '#8c8f94', '#d9a441', '#8c8f94', '#3d5a4c'].forEach((c, i) => g.add(piece(new THREE.BoxGeometry(0.06, 0.3, 0.03), c, { x: -0.85 + i * 0.42, y: 1.75 + (i % 2) * 0.1, z: -2.34, shadow: false })));
    for (const y of [1.0, 1.55, 2.1]) put(g, K.wallShelf({ w: 1.6, d: 0.32 }), -2.83, y, -0.6, Math.PI / 2);
    for (let i = 0; i < 6; i++) g.add(piece(new THREE.BoxGeometry(0.28, 0.22, 0.24), ['#7d9bb5', '#c46a52', '#e0c08a', '#8c8a86'][i % 4], { x: -2.83, y: 1.13 + Math.floor(i / 2) * 0.55, z: -1.1 + (i % 2) * 0.55 }));
    lamp(g, 1.1, 2.3, 0.1);
    g.add(piece(new THREE.CylinderGeometry(0.01, 0.01, 0.6), '#2b2b2b', { x: 1.1, y: 2.7, z: 0.1, shadow: false }));
    const maker = miniPerson({ shirt: '#3a3d42', pants: '#4a4f56', skin: '#d9a07a', hair: '#1f1712', hairStyle: 'curly', beard: true, glasses: true, shoes: '#2b2b2b', hud: '#9fe8c8', pose: { lean: 0.28, neckX: 0.35, rShX: -0.95, rEl: -0.55, lShX: -0.9, lEl: -0.6, rShZ: 0.1, lShZ: -0.1 } });
    maker.place(0.3, 0.06, -0.75, 0);
    maker.live('neck', 'lSh', 'rSh');
    g.add(maker.root);
    b.tick = t => {
      const m = maker.base;
      maker.move({ rShX: m.rShX + 0.16 * Math.sin(t * 2.3), rEl: m.rEl + 0.22 * Math.sin(t * 2.3 + 1.2), lShX: m.lShX + 0.1 * Math.sin(t * 1.6 + 2), neckY: 0.28 * Math.sin(t * 0.55), neckX: m.neckX + 0.05 * Math.sin(t * 1.4) });
      const u = t % 7;
      maker.hud.visible = u > 3.8 && u < 5.6;
    };
    plantMini(g, 2.4, -1.8, 1.1, 0.06);
    b.focus = [0.2, 1.3, 0.1];
  } },
  'second-visit': { at: [-3.8, 4.0], level: 0, w: 4.6, d: 4.0, build(b) {
    const g = shell(b, { w: 4.6, d: 4.0, h: 3.8, wall: '#c9c6bf', inner: '#f2efe9', floor: '#cbb89a', plinth: '#9d9a93', roof: 'flat', roofColor: '#b5b2ab' });
    // shelves of shoes along the back and left walls
    for (const y of [0.45, 0.95, 1.45, 1.95]) {
      g.add(piece(new THREE.BoxGeometry(3.6, 0.05, 0.4), '#d9c3a0', { x: 0.1, y, z: -1.8 }));
      shoesOnShelf(g, -1.5, y + 0.03, -1.8, 9);
      g.add(piece(new THREE.BoxGeometry(0.4, 0.05, 2.6), '#d9c3a0', { x: -2.1, y, z: -0.2 }));
      shoesOnShelf(g, -1.3, y + 0.03, -2.1, 6, 'z');
    }
    for (const y of [1.0, 1.5, 2.0]) lamp(g, -0.2 + y * 0.6, 2.7, -0.4);
    put(g, K.table({ w: 1.2, d: 0.6, h: 0.72, top: '#e8e2d6', legs: '#2b2e33' }), 1.0, 0.06, -0.6);
    shoesOnShelf(g, 0.7, 0.84, -0.6, 2);
    const runner = miniPerson({ shirt: '#b4532a', pants: '#2b3340', skin: '#7a4e33', hair: '#1a1512', hairStyle: 'crop', glasses: true, shoes: '#e8e2d6', backpack: '#39404a', hud: '#ffd27a', pose: 'standHold' });
    runner.place(-0.7, 0.06, 0.5, -Math.PI / 2);
    runner.joints.rEl.add(piece(new THREE.BoxGeometry(0.11, 0.1, 0.27), '#f1ece2', { y: -0.31, z: 0.06 }));
    runner.live('neck', 'rSh');
    g.add(runner.root);
    b.tick = t => {
      const m = runner.base;
      runner.move({ neckY: 0.42 * Math.sin(t * 0.45), neckX: 0.18 + 0.08 * Math.sin(t * 0.9), rShX: m.rShX + 0.09 * Math.sin(t * 1.2), rEl: m.rEl + 0.12 * Math.sin(t * 1.2 + 0.8) });
      const u = t % 9;
      runner.hud.visible = u > 2 && u < 3.4;
    };
    // rooftop unit and a sign
    b.roof.add(piece(new THREE.BoxGeometry(1.0, 0.6, 0.8), '#d9d6cf', { x: -0.8, y: b.top + 0.55, z: -0.6 }));
    b.roof.add(piece(new THREE.BoxGeometry(1.8, 0.45, 0.08), '#2f4a3c', { x: 0.6, y: b.top + 0.6, z: 2.2 }));
    b.roof.add(piece(new THREE.BoxGeometry(1.4, 0.16, 0.02), '#f6efe0', { x: 0.6, y: b.top + 0.6, z: 2.25, finish: 'lit' }));
    b.focus = [0, 1.2, 0];
  } },
  'group-talk': { at: [-2.0, -2.6], level: 0, w: 6.4, d: 5.2, build(b) {
    const g = shell(b, { w: 6.4, d: 5.2, h: 3.0, floor: '#c9a77b', plinth: '#a9a092', roof: 'flat', roofColor: '#d8d3ca', glass: true });
    put(g, K.table({ w: 2.8, d: 1.2, h: 0.75, top: '#7a4f33', legs: '#2b2e33' }), -0.3, 0.06, -0.3);
    const seats = [[-0.95, -1.25, 0], [0.35, -1.25, 0], [-0.95, 0.65, Math.PI], [0.35, 0.65, Math.PI]];
    const cast = [
      { shirt: '#5f6b46', pants: '#2b3340', skin: '#e0ac85', hair: '#2c211a', hairStyle: 'short', beard: true },
      { shirt: '#26324a', pants: '#2b3340', skin: '#f5d6bc', hair: '#141414', hairStyle: 'bob' },
      { shirt: '#e8dfcf', pants: '#3a3f45', skin: '#f1c9a5', hair: '#3b2a20', hairStyle: 'ponytail', earbuds: '#aeb4bb' },
      { shirt: '#3a3d42', pants: '#4a4f56', skin: '#8d5a3b', hair: '#1a1512', hairStyle: 'crop', glasses: '#1f2328' }
    ];
    const ppl = seats.map(([x, z, ry], i) => {
      put(g, K.chair({ office: true }), x, 0.06, z + (ry ? 0.15 : -0.15), ry);
      const p = miniPerson({ ...cast[i], cue: i === 2 ? '#7fd1ff' : null, pose: i === 0 ? 'sitTalk' : 'sitType' });
      p.place(x, 0.06, z, ry);
      g.add(p.root);
      laptopMini(g, x, 0.87, z + (ry ? -0.42 : 0.42), ry + Math.PI);
      return p;
    });
    const [alex, chen, user] = ppl;
    alex.live('neck', 'rSh'); chen.live('neck'); user.live('neck');
    const visitor = miniPerson({ shirt: '#b8a07e', pants: '#3a3f45', skin: '#c68b62', hair: '#4a3526', hairStyle: 'short', pose: 'standTalk' });
    visitor.place(2.55, 0.06, 1.4, -Math.PI * 0.62);
    visitor.live('neck', 'rSh');
    g.add(visitor.root);
    b.tick = t => {
      alex.move({ rShX: alex.base.rShX + 0.22 * Math.sin(t * 2.6), rEl: alex.base.rEl + 0.3 * Math.sin(t * 2.6 + 1), neckX: alex.base.neckX + 0.06 * Math.sin(t * 3.1), neckY: 0.3 * Math.sin(t * 0.4) });
      chen.move({ neckX: chen.base.neckX + 0.09 * Math.max(0, Math.sin(t * 1.3)), neckY: 0.35 + 0.1 * Math.sin(t * 0.5) });
      user.move({ neckY: -0.25 + 0.2 * Math.sin(t * 0.35) });
      const u = t % 8;
      user.cue.visible = u > 4.5 && u < 6.2;
      user.cue.scale.setScalar(0.8 + 0.35 * Math.abs(Math.sin(t * 6)));
      visitor.move({ neckY: 0.35 * Math.sin(t * 0.3), rShX: visitor.base.rShX + 0.1 * Math.sin(t * 1.8) });
    };
    g.add(piece(new THREE.CylinderGeometry(0.42, 0.3, 0.2, 14, 1, true), '#2b2e33', { x: -0.3, y: 2.35, z: -0.3, finish: 'satin' }));
    g.add(piece(new THREE.CircleGeometry(0.3, 14), '#ffe2ae', { x: -0.3, y: 2.26, z: -0.3, rx: Math.PI / 2, finish: 'lit' }));
    plantMini(g, -2.7, -2.1, 1.3, 0.06); plantMini(g, 2.6, -2.1, 1.1, 0.06);
    b.roof.add(piece(new THREE.BoxGeometry(1.2, 0.5, 0.9), '#cfcac0', { x: 1.2, y: b.top + 0.5, z: -1.0 }));
    b.focus = [-0.3, 1.1, -0.3];
  } },
  'governed-revision': { at: [-10.4, -10.4], level: T, w: 4.8, d: 4.2, build(b) {
    const g = shell(b, { w: 4.8, d: 4.2, h: 3.7, wall: '#efe4d0', inner: '#f5eddf', floor: '#9a7454', plinth: '#a3937c', roof: 'gable', roofColor: '#b5553a' });
    put(g, K.table({ w: 1.4, d: 0.7, h: 0.74, top: '#8a5a36' }), -0.9, 0.06, -1.3);
    laptopMini(g, -0.9, 0.86, -1.3, 0);
    put(g, K.chair({ office: true }), -0.4, 0.06, -0.5, Math.PI * 0.85);
    put(g, K.deskLamp({}), -1.45, 0.8, -1.45, 0.4);
    lamp(g, -1.3, 1.3, -1.35);
    put(g, K.serverShelf({}), 1.0, 0.06, -1.7);
    put(g, K.serverShelf({}), 1.7, 0.06, -1.7);
    put(g, K.vault({}), 1.75, 0.06, 0.2, -Math.PI / 2);
    put(g, K.bookshelf({ w: 1.2, h: 1.8 }), -2.2, 0.06, 0.4, Math.PI / 2);
    const leds = [new THREE.Group(), new THREE.Group()];
    for (const sx of [1.0, 1.7]) for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) {
      leds[(i + k) % 2].add(piece(new THREE.BoxGeometry(0.034, 0.034, 0.012), k === 0 ? '#9dffbf' : '#9fd8ff', { x: sx + 0.2 + k * 0.03, y: 0.3 + i * 0.26, z: -1.43, finish: 'lit' }));
    }
    leds.forEach(l => g.add(mover(l)));
    const sheet = piece(new THREE.BoxGeometry(0.24, 0.012, 0.32), '#fbfaf5', { finish: 'lit' });
    g.add(mover(sheet));
    b.tick = t => {
      leds[0].visible = Math.sin(t * 5.2) > -0.2;
      leds[1].visible = Math.sin(t * 3.4 + 1) > 0.1;
      const u = (t % 7) / 7;
      sheet.visible = u < 0.62;
      const k = smooth(u / 0.55);
      sheet.position.set(-0.9 + 2.65 * k, 0.95 + Math.sin(Math.PI * k) * 0.9, -1.3 + 1.5 * k);
      sheet.rotation.y = k * 2.4;
    };
    // chimney
    b.roof.add(piece(new THREE.BoxGeometry(0.5, 1.4, 0.5), '#9c5a44', { x: 1.4, y: b.roofTop + 0.2, z: -0.7 }));
    b.focus = [0, 1.1, -0.6];
  } },
  'export-check': { at: [1.6, -11.0], level: T, w: 4.8, d: 4.8, build(b) {
    const h1 = 3.1;
    const g = shell(b, { w: 4.8, d: 4.8, h: h1 * 2, floor: '#8f7155', plinth: '#9a958c', roof: 'flat', roofColor: '#c9c5bd', glass: true });
    // the upper floor
    g.add(piece(new THREE.BoxGeometry(4.8, 0.18, 4.8), '#d9d4cb', { y: h1 + 0.06 }));
    g.add(piece(new THREE.BoxGeometry(4.82, 0.1, 4.82), '#2f343b', { y: h1 + 0.2, finish: 'satin' }));
    put(g, K.table({ w: 1.4, d: 0.7, h: 0.74, top: '#c08a58' }), -0.2, 0.06, 0.55);
    laptopMini(g, -0.2, 0.86, 0.4, Math.PI, '#a7e3c0');
    put(g, K.chair({ office: true }), -0.2, 0.06, -0.4, 0);
    const analyst = miniPerson({ shirt: '#2f4a3c', pants: '#2b3340', skin: '#e0ac85', hair: '#1a1512', hairStyle: 'short', pose: 'sitType' });
    analyst.place(-0.2, 0.06, -0.2, 0);
    analyst.live('neck', 'lSh', 'rSh');
    g.add(analyst.root);
    g.add(piece(new THREE.BoxGeometry(0.6, 0.62, 0.45), '#8a8f96', { x: 1.25, y: 0.37, z: 0.6 }));
    g.add(piece(new THREE.BoxGeometry(0.5, 0.22, 0.4), '#d9dbde', { x: 1.25, y: 0.79, z: 0.6, finish: 'satin' }));
    const report = piece(new THREE.BoxGeometry(0.3, 0.01, 0.38), '#fbfaf5', { finish: 'lit' });
    g.add(mover(report));
    b.tick = t => {
      const m = analyst.base;
      analyst.move({ rShX: m.rShX + 0.05 * Math.sin(t * 11), lShX: m.lShX + 0.05 * Math.sin(t * 11 + 1.6), rEl: m.rEl + 0.06 * Math.sin(t * 11 + 0.5), neckY: 0.12 * Math.sin(t * 0.7), neckX: m.neckX + 0.03 * Math.sin(t * 2) });
      const u = (t % 6) / 6;
      report.visible = u > 0.15;
      report.position.set(1.25, 0.92, 0.6 + 0.32 * smooth((u - 0.15) / 0.5));
    };
    put(g, K.bookshelf({ w: 1.3, h: 1.9 }), 1.4, 0.06, -2.2);
    plantMini(g, -2.0, -2.0, 1.4, 0.06);
    // upstairs: two desks and a plant
    put(g, K.table({ w: 1.4, d: 0.7, h: 0.74, top: '#c08a58' }), -0.8, h1 + 0.15, -1.2);
    put(g, K.table({ w: 1.4, d: 0.7, h: 0.74, top: '#c08a58' }), 1.0, h1 + 0.15, -1.2);
    laptopMini(g, 1.0, h1 + 0.92, -1.2, 0);
    plantMini(g, 2.0, 1.6, 1.3, h1 + 0.15);
    lamp(g, -0.4, 2.7, -0.8); lamp(g, 0.2, h1 + 2.7, -0.8);
    // roof garden
    for (let i = 0; i < 9; i++) b.roof.add(piece(new THREE.IcosahedronGeometry(0.34 + (i % 3) * 0.08, 1), ['#5d8a4e', '#6e9c55', '#4c7a42'][i % 3], { x: -1.9 + (i % 5) * 0.9, y: b.top + 0.5, z: i < 5 ? -1.9 : 1.9 }));
    b.roof.add(piece(new THREE.BoxGeometry(1.1, 0.55, 0.9), '#dedad2', { x: 0.6, y: b.top + 0.45, z: 0.2 }));
    b.focus = [-0.4, 1.0, -0.6];
  } },
  'robot-cup': { at: [8.6, -3.0], level: 0, w: 6.0, d: 5.0, build(b) {
    const g = shell(b, { w: 6.0, d: 5.0, h: 3.9, wall: '#f1ece2', inner: '#f6efe3', floor: '#b9855a', plinth: '#a89c8a', roof: 'flat', roofColor: '#cfc8bb' });
    g.add(piece(new THREE.BoxGeometry(2.4, 0.02, 3.0), '#b5533e', { x: -1.1, y: 0.1, z: -0.3, shadow: false }));
    g.add(piece(new THREE.BoxGeometry(2.0, 0.022, 2.6), '#e6d6bd', { x: -1.1, y: 0.1, z: -0.3, shadow: false }));
    put(g, K.sofa({ w: 2.2 }), -2.45, 0.06, -0.3, Math.PI / 2);
    const user = miniPerson({ shirt: '#3b4a6b', cardigan: '#2e3a56', pants: '#b9a68c', skin: '#f0cfb2', hair: '#c9c7c2', hairStyle: 'bun', shoes: '#8d8f95', pose: { pelvisY: 0.6, lHip: -1.45, lKnee: 1.45, rHip: -1.45, rKnee: 1.45, lShX: -0.3, lEl: -0.8, rShX: -0.3, rEl: -0.8, lean: 0.05 } });
    user.place(-2.3, 0.06, 0.15, Math.PI / 2);
    const userCup = piece(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 10), '#d08f3a', { y: -0.3, z: 0.04 });
    userCup.userData.noMerge = true;
    user.joints.rEl.add(userCup);
    user.live('rSh', 'neck');
    g.add(user.root);
    // a counter with the next cup, and the side table where the user puts the empty one
    g.add(piece(new THREE.BoxGeometry(2.0, 0.9, 0.6), '#e9e3d8', { x: 1.7, y: 0.51, z: -2.15 }));
    g.add(piece(new THREE.BoxGeometry(2.06, 0.05, 0.66), '#8a5a36', { x: 1.7, y: 0.98, z: -2.15 }));
    g.add(piece(new THREE.BoxGeometry(1.2, 0.5, 0.35), '#6f8a5c', { x: 1.7, y: 2.1, z: -2.3 }));
    const counterCup = piece(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 10), '#d08f3a', { x: 1.7, y: 1.06, z: -1.98 });
    g.add(mover(counterCup));
    put(g, K.roundTable({ r: 0.32 }), -2.2, 0.06, 1.25);
    const tableCup = piece(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 10), '#d08f3a', { x: -2.2, y: 0.69, z: 1.25 });
    g.add(mover(tableCup));
    g.add(piece(new THREE.CylinderGeometry(0.28, 0.24, 0.32, 12), '#c9a36b', { x: 1.9, y: 0.22, z: 1.5 }));
    g.add(piece(new THREE.BoxGeometry(0.42, 0.12, 0.4), '#f3f0ea', { x: 1.9, y: 0.4, z: 1.5, shadow: false }));
    const robot = miniHomeRobot({ arm: 'stow' });
    robot.userData.arm.userData.dynamic = true;
    g.add(mover(robot));
    const ARMS = { reach: [-0.35, 0.3], carry: [1.0, -1.6], offer: [0.38, 0], stow: [1.35, -2.45] };
    const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * smooth(k), a[1] + (b[1] - a[1]) * smooth(k)];
    const C = [1.7, -1.3], W = [0.7, -0.2], S = [-1.25, 0.15];
    const FACE_USER = -Math.PI / 2, FACE_COUNTER = Math.PI;
    b.tick = t => {
      const u = t % 15;
      let arm = ARMS.stow, yaw = FACE_COUNTER;
      // 0-1.4 grasp at the counter; 1.4-2.2 lift; 2.2-5.4 drive; 5.4-6.0 face the user; 6.0-6.8 offer
      // 6.8-8.0 the user takes it; 8.0-8.8 stow; 8.8-12 drive back; 12-15 wait; the user sets the cup down
      robot.position.y = 0.06;
      if (u < 1.4) { robot.position.set(C[0], 0.06, C[1]); arm = mix(ARMS.stow, ARMS.reach, u / 1.1); }
      else if (u < 2.2) { robot.position.set(C[0], 0.06, C[1]); arm = mix(ARMS.reach, ARMS.carry, (u - 1.4) / 0.8); }
      else if (u < 5.4) { arm = ARMS.carry; yaw = along(robot, [C, W, S], (u - 2.2) / 3.2); }
      else {
        if (u < 8.8) robot.position.set(S[0], 0.06, S[1]);
        if (u < 6.0) { arm = ARMS.carry; yaw = turn(Math.atan2(S[0] - W[0], S[1] - W[1]), FACE_USER, (u - 5.4) / 0.6); }
        else if (u < 8.0) { arm = mix(ARMS.carry, ARMS.offer, (u - 6.0) / 0.8); yaw = FACE_USER; }
        else if (u < 8.8) { arm = mix(ARMS.offer, ARMS.stow, (u - 8.0) / 0.8); yaw = FACE_USER; }
        else if (u < 12) yaw = along(robot, [S, W, C], (u - 8.8) / 3.2);
        else { robot.position.set(C[0], 0.06, C[1]); yaw = turn(Math.atan2(C[0] - W[0], C[1] - W[1]), FACE_COUNTER, (u - 12) / 0.6); }
      }
      robot.rotation.y = yaw;
      robot.userData.setArm(arm[0], arm[1]);
      const held = u >= 1.0 && u < 7.4;
      robot.userData.cup.visible = held;
      counterCup.visible = u < 1.0 || u > 13.5;
      userCup.visible = u >= 7.4 && u < 13.0;
      tableCup.visible = u >= 13.0 || u < 0.5;
      // the user reaches out for the cup, then drinks
      const reach = ramp(u, 6.4, 7.2) * (1 - ramp(u, 7.6, 8.4));
      const sip = ramp(u, 8.6, 9.4) * (1 - ramp(u, 11.6, 12.4));
      user.move({ rShX: -0.3 - 0.75 * reach - 0.35 * sip, rEl: -0.8 + 0.5 * reach - 0.9 * sip, rShZ: 0.05, neckY: 0.35 * reach + 0.12 * Math.sin(t * 0.5) });
    };
    put(g, K.floorLamp({}), -2.5, 0.06, -2.05);
    plantMini(g, 2.6, 0.4, 1.2, 0.06);
    // solar panel and plants on the roof
    const panel = new THREE.Group();
    panel.add(piece(new THREE.BoxGeometry(2.6, 0.06, 1.5), '#24324f', { finish: 'satin' }));
    for (let i = 1; i < 4; i++) panel.add(piece(new THREE.BoxGeometry(0.02, 0.07, 1.5), '#8ea3c4', { x: -1.3 + i * 0.65, shadow: false }));
    panel.position.set(0.4, b.top + 0.55, -0.6); panel.rotation.x = -0.35;
    b.roof.add(panel);
    for (let i = 0; i < 6; i++) b.roof.add(piece(new THREE.IcosahedronGeometry(0.3, 0), ['#5d8a4e', '#6e9c55'][i % 2], { x: -2.6 + i * 0.9, y: b.top + 0.45, z: 2.35 }));
    b.focus = [-0.6, 1.0, -0.2];
  } },
  'daily-plan': { at: [-0.6, 10.0], level: 0, w: 5.4, d: 4.4, build(b) {
    const g = shell(b, { w: 5.4, d: 4.4, h: 3.7, wall: '#ece2cf', inner: '#f4ecdc', floor: '#b48256', plinth: '#a3937c', roof: 'gable', roofColor: '#4a505c' });
    put(g, K.table({ w: 1.5, d: 0.75, h: 0.75, top: '#8a5a36' }), -0.5, 0.06, 0.15);
    laptopMini(g, -0.5, 0.87, 0.3, Math.PI);
    put(g, K.chair({ office: true }), -0.5, 0.06, -0.7, 0);
    const user = miniPerson({ shirt: '#56657c', cardigan: '#46546a', pants: '#2b3340', skin: '#f5d6bc', hair: '#1a1512', hairStyle: 'bob', earbuds: '#f2f2f0', pose: 'sitCall' });
    user.place(-0.5, 0.06, -0.5, 0);
    user.live('neck', 'lSh');
    g.add(user.root);
    // the evening check-in: amber while it waits out the call, green once it is sent
    const wait = piece(new THREE.BoxGeometry(0.2, 0.2, 0.03), '#f2c14e', { finish: 'lit' });
    const sent = piece(new THREE.BoxGeometry(0.2, 0.2, 0.03), '#8be0a4', { finish: 'lit' });
    for (const m of [wait, sent]) { m.position.set(-0.5, 1.55, 0.3); g.add(mover(m)); }
    b.tick = t => {
      const m = user.base;
      const u = t % 10, onCall = u < 7;
      user.move({ neckX: m.neckX + (onCall ? 0.07 * Math.sin(t * 2.4) : 0), neckY: m.neckY + 0.15 * Math.sin(t * 0.5), lShX: m.lShX + (onCall ? 0.15 * Math.sin(t * 1.9) : 0), lEl: m.lEl + (onCall ? 0.2 * Math.sin(t * 1.9 + 1) : 0) });
      wait.visible = onCall && Math.sin(t * 4) > -0.3;
      sent.visible = !onCall && u < 9.4;
      wait.position.y = sent.position.y = 1.55 + 0.04 * Math.sin(t * 3);
    };
    put(g, K.bookshelf({ w: 1.4, h: 1.9 }), 1.3, 0.06, -1.95);
    put(g, K.deskLamp({}), -1.1, 0.81, -0.05, -0.6);
    g.add(piece(new THREE.BoxGeometry(0.9, 0.65, 0.04), '#3a2c22', { x: -0.8, y: 1.85, z: -2.17, shadow: false }));
    g.add(piece(new THREE.BoxGeometry(0.8, 0.55, 0.02), '#d9a15c', { x: -0.8, y: 1.85, z: -2.15, shadow: false }));
    g.add(piece(new THREE.BoxGeometry(0.8, 0.25, 0.022), '#6f8fa8', { x: -0.8, y: 1.98, z: -2.15, shadow: false }));
    plantMini(g, 2.2, 1.6, 1.2, 0.06);
    put(g, K.armchair({ color: '#c98a6a' }), 1.6, 0.06, 0.4, -Math.PI / 2);
    // chimney and a dormer
    b.roof.add(piece(new THREE.BoxGeometry(0.5, 1.3, 0.5), '#8a7f72', { x: -1.6, y: b.roofTop + 0.15, z: -0.6 }));
    b.roof.add(piece(new THREE.BoxGeometry(1.0, 0.8, 0.9), '#ece2cf', { x: 0.9, y: b.top + 0.75, z: 1.2 }));
    b.roof.add(piece(new THREE.BoxGeometry(0.6, 0.45, 0.02), '#ffe2ae', { x: 0.9, y: b.top + 0.75, z: 1.66, finish: 'lit' }));
    b.roof.add(piece(new THREE.BoxGeometry(1.2, 0.12, 1.1), '#4a505c', { x: 0.9, y: b.top + 1.2, z: 1.2 }));
    b.focus = [-0.6, 1.0, -0.8];
  } },
  'care-visits': { at: [8.4, 6.2], level: 0, w: 7.4, d: 5.4, build(b) {
    const g = shell(b, { w: 7.4, d: 5.4, h: 3.9, wall: '#c8b9a2', inner: '#f3ebdd', floor: '#b88a5e', plinth: '#9b8f7d', roof: 'hip', roofColor: '#4a505c', stone: true });
    const T0 = [-0.7, 0.1];
    g.add(piece(new THREE.CylinderGeometry(1.7, 1.7, 0.02, 24), '#5f7a8c', { x: T0[0], y: 0.1, z: T0[1], shadow: false }));
    put(g, K.roundTable({ r: 0.55, h: 0.6 }), T0[0], 0.06, T0[1]);
    g.add(piece(new THREE.SphereGeometry(0.11, 10, 8), '#f3f0ea', { x: T0[0], y: 0.78, z: T0[1], finish: 'satin' }));
    for (let i = 0; i < 3; i++) g.add(piece(new THREE.CylinderGeometry(0.045, 0.04, 0.07, 8), '#f3f0ea', { x: T0[0] + Math.cos(i * 2.1) * 0.35, y: 0.7, z: T0[1] + Math.sin(i * 2.1) * 0.35 }));
    const seniors = [
      { shirt: '#8d6e8f', pants: '#4a4f56', skin: '#f1c9a5', hair: '#d9d6d0', hairStyle: 'bun' },
      { shirt: '#5f7357', pants: '#4a4f56', skin: '#c68b62', hair: '#bfbcb5', hairStyle: 'short' },
      { shirt: '#c98a6a', pants: '#4a4f56', skin: '#e0ac85', hair: '#e8e6e0', hairStyle: 'bob' }
    ];
    [[-Math.PI * 0.55, '#6f8a5c'], [Math.PI * 0.15, '#c9a14e'], [Math.PI * 0.85, '#6f8a5c']].forEach(([a, c], i) => {
      const x = T0[0] + Math.sin(a) * 1.15, z = T0[1] + Math.cos(a) * 1.15, ry = a + Math.PI;
      put(g, K.armchair({ color: c }), x + Math.sin(a) * 0.1, 0.06, z + Math.cos(a) * 0.1, ry);
      const p = miniPerson({ ...seniors[i], pose: i === 1 ? 'sitTalk' : 'sitHold' });
      p.place(x, 0.06, z, ry);
      g.add(p.root);
    });
    const robot = mover(miniServiceRobot());
    g.add(robot);
    const walker = miniPerson({ shirt: '#6b7078', pants: '#3a3f45', skin: '#e0ac85', hair: '#e8e6e0', hairStyle: 'crop', pose: { lean: 0.18, lShX: -0.7, lEl: -0.5, rShX: -0.7, rEl: -0.5, neckX: 0.1 } });
    put(walker.root, K.walker(), 0, 0, 0.5, 0);
    walker.live('lHip', 'rHip');
    g.add(mover(walker.root));
    const OFFICE = [2.6, -1.7], MID = [1.9, 0.3], LOUNGE = [0.75, 0.95];
    const FACE_TABLE = Math.atan2(T0[0] - LOUNGE[0], T0[1] - LOUNGE[1]);
    b.tick = t => {
      const u = t % 16;
      let yaw;
      robot.position.y = 0.06;
      if (u < 4) { robot.position.set(OFFICE[0], 0.06, OFFICE[1]); yaw = turn(Math.atan2(OFFICE[0] - MID[0], OFFICE[1] - MID[1]), Math.atan2(MID[0] - OFFICE[0], MID[1] - OFFICE[1]), (u - 3) / 1); }
      else if (u < 7.5) yaw = along(robot, [OFFICE, MID, LOUNGE], (u - 4) / 3.5);
      else if (u < 12) { robot.position.set(LOUNGE[0], 0.06, LOUNGE[1]); yaw = turn(Math.atan2(LOUNGE[0] - MID[0], LOUNGE[1] - MID[1]), FACE_TABLE, (u - 7.5) / 0.7); }
      else yaw = along(robot, [LOUNGE, MID, OFFICE], (u - 12) / 4);
      robot.rotation.y = yaw;
      // a slow walk with the walker, there and back
      const w = (t % 18) / 18, k = w < 0.5 ? w * 2 : 2 - w * 2;
      walker.root.position.set(3.15, 0.06, 1.9 - 1.6 * smooth(k));
      walker.root.rotation.y = w < 0.5 ? Math.PI : 0;
      const s = Math.sin(t * 2.2);
      walker.move({ lHip: s * 0.22, rHip: -s * 0.22 });
    };
    g.add(piece(new THREE.BoxGeometry(1.26, 0.86, 0.03), '#e9e4da', { x: 0.6, y: 1.75, z: -2.68, shadow: false }));
    for (let i = 0; i < 4; i++) g.add(piece(new THREE.BoxGeometry(1.0, 0.07, 0.02), ['#7fa6c9', '#d6aba2', '#a7c4b2', '#e9c580'][i], { x: 0.6, y: 1.98 - i * 0.16, z: -2.66, shadow: false }));
    g.add(piece(new THREE.BoxGeometry(1.8, 0.8, 0.45), '#8a5a36', { x: -2.4, y: 0.46, z: -2.4 }));
    plantMini(g, -3.2, 1.8, 1.3, 0.06); plantMini(g, 3.2, -2.2, 1.2, 0.06);
    lamp(g, T0[0], 2.6, T0[1]);
    b.focus = [-0.4, 1.0, -0.3];
  } }
};

// ---------- trees, plants, fences ----------

function greenery(rnd, keepOut, out) {
  const g = new THREE.Group();
  const trunks = scatter(new THREE.CylinderGeometry(0.5, 0.7, 1, 6), BARK);
  const crowns = scatter(new THREE.IcosahedronGeometry(1, 1), LEAF);
  const cones = scatter(new THREE.ConeGeometry(1, 1, 7), LEAF);
  const bushes = scatter(new THREE.IcosahedronGeometry(1, 1), LEAF);
  const blooms = scatter(new THREE.IcosahedronGeometry(1, 0), BLOOM, { shadow: false });
  const GREENS = ['#4f8a3c', '#3f7533', '#62994a', '#77ad52', '#2f6230', '#88b85a', '#5a8f3a'];
  const FLOWERS = ['#f2a7c3', '#ffffff', '#f7d35c', '#c79be8', '#ef8a7a', '#f6c4d9'];
  const free = (x, z, r) => {
    if (inside(out, x, z, 1.2 + r * 0.4) === false) return false;
    return keepOut.every(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) > cr + r);
  };
  const ground = (x, z) => (onTerrace(x, z) ? T : 0);
  const tree = (x, z, s) => {
    const y = ground(x, z);
    const h = (1.6 + rnd() * 1.2) * s;
    trunks.add(x, y + h / 2, z, 0.22 * s, h, 0.22 * s, '#7a5a3f');
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = (0.3 + rnd() * 0.6) * s;
      const cs = (0.9 + rnd() * 0.7) * s;
      crowns.add(x + Math.cos(a) * r, y + h + (0.3 + rnd() * 0.9) * s, z + Math.sin(a) * r, cs, cs * 0.9, cs, GREENS[Math.floor(rnd() * GREENS.length)], rnd() * 6);
    }
    crowns.add(x, y + h + 1.2 * s, z, 1.1 * s, 1.0 * s, 1.1 * s, GREENS[Math.floor(rnd() * 4)]);
    keepOut.push([x, z, 1.4 * s]);
  };
  const conifer = (x, z, s) => {
    const y = ground(x, z);
    trunks.add(x, y + 0.5 * s, z, 0.18 * s, 1.0 * s, 0.18 * s, '#6b4f38');
    for (let i = 0; i < 3; i++) cones.add(x, y + (1.5 + i * 0.95) * s, z, (1.25 - i * 0.3) * s, 1.7 * s, (1.25 - i * 0.3) * s, i % 2 ? '#2f5a3a' : '#3b6b44', rnd() * 3);
    keepOut.push([x, z, 1.1 * s]);
  };
  // trees: a ring inside the edge, denser at the back
  for (let i = 0; i < 520 && trunks.count < 64; i++) {
    const a = rnd() * Math.PI * 2;
    const [ox, oz] = out[Math.floor((a / (Math.PI * 2)) * out.length) % out.length];
    const k = 0.72 + rnd() * 0.24;
    const x = ox * k, z = oz * k;
    const back = x + z < -4;
    const s = back ? 1.0 + rnd() * 0.5 : 0.75 + rnd() * 0.35;
    if (!free(x, z, 1.3 * s)) continue;
    if (back && rnd() < 0.35) conifer(x, z, s); else tree(x, z, s);
  }
  // the plaza tree
  tree(3.0, 1.0, 0.95);
  // bushes and flower beds along the walls and paths
  for (let i = 0; i < 2600 && bushes.count < 260; i++) {
    const x = (rnd() * 2 - 1) * R, z = (rnd() * 2 - 1) * R;
    if (!free(x, z, 0.5)) continue;
    const y = ground(x, z);
    const s = 0.35 + rnd() * 0.45;
    bushes.add(x, y + s * 0.6, z, s, s * 0.8, s, GREENS[Math.floor(rnd() * GREENS.length)], rnd() * 6);
    if (rnd() < 0.6) for (let f = 0; f < 5; f++) {
      const fa = rnd() * Math.PI * 2, fr = rnd() * s * 0.9;
      blooms.add(x + Math.cos(fa) * fr, y + s * (0.9 + rnd() * 0.5), z + Math.sin(fa) * fr, 0.08 + rnd() * 0.06, 0.08, 0.08 + rnd() * 0.06, FLOWERS[Math.floor(rnd() * FLOWERS.length)]);
    }
  }
  // hanging vines on the edges that face the viewer: uneven strands with gaps, a few long drapes
  const vines = scatter(new THREE.IcosahedronGeometry(1, 1), LEAF);
  const VINE = ['#3f7533', '#4f8a3c', '#2f6230', '#5a8f3a', '#6e9c45', '#3a6b2e'];
  for (let i = 0; i < out.length; i++) {
    const [x, z] = out[i];
    if (x + z < -8 || rnd() < 0.18) continue;
    const top = onTerrace(x * 0.98, z * 0.98) ? T : 0;
    const [nx2, nz2] = out[(i + 1) % out.length];
    const r = Math.hypot(x, z), ox = x / r, oz = z / r;
    const strands = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < strands; k++) {
      const t = rnd();
      const px = x + (nx2 - x) * t, pz = z + (nz2 - z) * t;
      const len = rnd() < 0.15 ? 6 + Math.floor(rnd() * 5) : Math.floor(rnd() * 4);
      let y = top - 0.15;
      for (let j = 0; j <= len; j++) {
        const sz = (0.46 - j * 0.03) * (0.75 + rnd() * 0.5);
        const off = 0.12 + rnd() * 0.18 - j * 0.015;
        vines.add(px + ox * off + (rnd() - 0.5) * 0.25, y, pz + oz * off + (rnd() - 0.5) * 0.25, sz, sz * 1.35, sz, VINE[Math.floor(rnd() * VINE.length)], rnd() * 6);
        if (rnd() < 0.18) blooms.add(px + ox * (off + sz * 0.8), y, pz + oz * (off + sz * 0.8), 0.1, 0.1, 0.1, FLOWERS[Math.floor(rnd() * FLOWERS.length)]);
        y -= 0.45 + rnd() * 0.25;
      }
    }
  }
  for (const s of [trunks, crowns, cones, bushes, blooms, vines]) g.add(s.build());
  return g;
}

function inside(poly, x, z, margin = 0) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  if (!c || !margin) return c;
  // shrink: also require the points margin away towards the centre to be inside
  const r = Math.hypot(x, z) || 1;
  return inside(poly, x + (x / r) * margin, z + (z / r) * margin, 0);
}

// ---------- the scene ----------

/**
 * Build the island into view.root. Returns { buildings, overview, focus(id), pin(id), hover(id), tick }.
 * buildings: Map id -> { group, pin (Object3D above the roof), focus (Vector3) }.
 */
export function buildIsland(view, { ids = Object.keys(BUILDINGS) } = {}) {
  const rnd = rand(20261010);
  const root = view.root;
  view.setTime('island');
  view.scene.fog = new THREE.Fog('#a9d4f2', 150, 520);
  // sun from the upper right of the picture, and a shadow camera that covers the island
  view.key.position.set(26, 52, -10);
  Object.assign(view.key.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 10, far: 130 });
  view.key.shadow.camera.updateProjectionMatrix();
  view.key.shadow.bias = -0.0004;
  view.key.shadow.normalBias = 0.04;

  const { group: ground, out } = land(rnd);
  root.add(ground);

  // paths, plaza and stairs
  const paths = [
    [[[3.0, -5.1], [3.0, 14.4]], 0], [[[-5.6, 6.6], [3.0, 6.6]], 0], [[[3.0, 1.0], [14.6, 1.0]], 0],
    [[[-7.7, -7.7], [14.2, -7.7]], T], [[[-7.7, -7.7], [-7.7, 12.6]], T]
  ];
  const pathMat = pathMaterial();
  for (const [pts, y] of paths) { const m = new THREE.Mesh(ribbon(pts, 1.5, y + 0.025), pathMat); m.receiveShadow = true; root.add(m); }
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(2.3, 40).rotateX(-Math.PI / 2).translate(3.0, 0.03, 1.0), pathMat);
  plaza.receiveShadow = true;
  root.add(plaza);
  root.add(piece(new THREE.CylinderGeometry(1.15, 1.25, 0.45, 24), '#b8aa94', { x: 3.0, y: 0.22, z: 1.0 }));
  root.add(piece(new THREE.CylinderGeometry(1.0, 1.0, 0.05, 24), '#6f8f4a', { x: 3.0, y: 0.46, z: 1.0, shadow: false }));
  const stairs = (x, z, dir) => {
    for (let i = 0; i < 5; i++) {
      const hgt = ((i + 1) * T) / 5, depth = 0.26;
      const off = 0.25 + (4 - i) * depth;
      const geo = dir === 'z' ? new THREE.BoxGeometry(1.5, hgt, depth) : new THREE.BoxGeometry(depth, hgt, 1.5);
      root.add(piece(geo, '#d3c6b0', dir === 'z' ? { x, y: hgt / 2, z: z + off } : { x: x + off, y: hgt / 2, z }));
    }
  };
  stairs(3.0, BACK_Z - 0.2, 'z');
  stairs(BACK_X - 0.2, 6.6, 'x');

  // buildings
  const buildings = new Map();
  const keepOut = [[3.0, 1.0, 2.6]];
  for (const [pts] of paths) {
    const [[x1, z1], [x2, z2]] = pts;
    const n = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 1.2);
    for (let i = 0; i <= n; i++) keepOut.push([x1 + ((x2 - x1) * i) / n, z1 + ((z2 - z1) * i) / n, 0.9]);
  }
  keepOut.push([3.0, BACK_Z + 0.6, 1.3], [BACK_X + 0.6, 6.6, 1.3]);
  for (const id of ids) {
    const def = BUILDINGS[id];
    if (!def) continue;
    const group = new THREE.Group();
    const b = { group, id };
    def.build(b);
    group.position.set(def.at[0], def.level, def.at[1]);
    root.add(group);
    view.pickable(group, id);
    const pin = new THREE.Object3D();
    pin.position.set(0, (b.roofTop || b.top || 3) + 0.7, 0);
    group.add(pin);
    buildings.set(id, { group, roof: b.roof, pin, tick: b.tick || null, focus: new THREE.Vector3(...(b.focus || [0, 1, 0])).add(group.position), base: def.level, lift: 0, want: 0 });
    keepOut.push([def.at[0], def.at[1], Math.hypot(def.w, def.d) / 2 + 0.6]);
    // the glass of this building (walls, and roof panes that lift with the roof) as one mesh each
    for (const [key, parent] of [[b, group], [b.roof, b.roof]]) {
      const panes = GLASS_GEOS.get(key);
      if (!panes) continue;
      const merged = new THREE.Mesh(mergeGeometriesSafe(panes), GLASS);
      merged.userData.noAO = true;
      merged.renderOrder = 2;
      parent.add(merged);
      GLASS_GEOS.delete(key);
    }
  }

  // street lamps and benches
  const lampAt = (x, z) => {
    const y = onTerrace(x, z) ? T : 0;
    root.add(piece(new THREE.CylinderGeometry(0.05, 0.07, 2.2, 6), '#2f343b', { x, y: y + 1.1, z, finish: 'satin' }));
    root.add(piece(new THREE.BoxGeometry(0.26, 0.32, 0.26), '#ffe2ae', { x, y: y + 2.35, z, finish: 'lit' }));
    root.add(piece(new THREE.ConeGeometry(0.24, 0.18, 4), '#2f343b', { x, y: y + 2.6, z, ry: Math.PI / 4, finish: 'satin' }));
  };
  for (const [x, z] of [[4.2, 9.5], [4.2, -3.5], [9.5, 2.2], [-1.0, 5.4], [6.0, -8.9], [-8.9, 4.5], [-8.9, -4.0], [11.5, -8.9]]) lampAt(x, z);
  const benchAt = (x, z, ry) => { const y = onTerrace(x, z) ? T : 0; put(root, K.bench({ w: 1.4, color: '#a0703f' }), x, y, z, ry); };
  benchAt(-4.6, 7.7, Math.PI); benchAt(5.6, 2.2, Math.PI); benchAt(5.0, -1.0, Math.PI / 2);
  const reader = miniPerson({ shirt: '#d9b65a', pants: '#3a4a5f', skin: '#e0ac85', hair: '#5a3b26', hairStyle: 'long', pose: 'sitHold' });
  reader.place(-4.6, 0, 7.5, Math.PI);
  root.add(reader.root);
  root.add(piece(new THREE.BoxGeometry(0.22, 0.03, 0.16), '#c0533a', { x: -4.6, y: 0.78, z: 7.12, rx: -0.6 }));
  // fences along the front edges
  for (let i = 0; i < out.length; i += 2) {
    const [x, z] = out[i], [x2, z2] = out[(i + 2) % out.length];
    if (x + z < 4 || (Math.abs(x - z) < 4)) continue;
    const y = 0, k = 0.95;
    const ax = x * k, az = z * k, bx = x2 * k, bz = z2 * k;
    root.add(piece(new THREE.BoxGeometry(0.1, 0.8, 0.1), '#9a7a55', { x: ax, y: y + 0.4, z: az }));
    const len = Math.hypot(bx - ax, bz - az);
    for (const hgt of [0.35, 0.7]) root.add(piece(new THREE.BoxGeometry(len, 0.07, 0.06), '#b08c62', { x: (ax + bx) / 2, y: y + hgt, z: (az + bz) / 2, ry: -Math.atan2(bz - az, bx - ax), shadow: false }));
  }

  // where the waterfalls leave the island: keep their streams clear of trees
  const fallSpots = [0.18, 0.31, 0.965].map(f => out[Math.round(out.length * f) % out.length]);
  for (const [x, z] of fallSpots) {
    const r = Math.hypot(x, z);
    for (let k = 0; k <= 4; k++) keepOut.push([x - (x / r) * k, z - (z / r) * k, k === 4 ? 1.6 : 0.9]);
  }
  root.add(greenery(rnd, keepOut, out));

  // water: the sea, waterfalls with streams on top, and mist
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), seaMaterial());
  sea.position.y = SEA;
  sea.userData.noAO = true;
  sea.receiveShadow = false;
  root.add(sea);
  // streams, ponds and falls share one shader, so they are built as one mesh
  const fallMat = fallMaterial();
  const waterGeos = [];
  for (const [x, z] of fallSpots) {
    const r = Math.hypot(x, z), nx = x / r, nz = z / r;
    const top = onTerrace(x * 0.98, z * 0.98) ? T : 0;
    // a pond and a stream on top (uv.y stays below 0.8, where the fall's fade starts)
    const sx = x - nx * 4, sz = z - nz * 4;
    const stream = ribbon([[sx, sz], [x * 1.01, z * 1.01]], 1.6, top + 0.05);
    const suv = stream.attributes.uv;
    for (let i = 0; i < suv.count; i++) suv.setY(i, suv.getY(i) * 1.6 / 6);
    waterGeos.push(stream);
    const pond = new THREE.CircleGeometry(1.5, 20).rotateX(-Math.PI / 2).translate(sx, top + 0.045, sz);
    const puv = pond.attributes.uv;
    for (let i = 0; i < puv.count; i++) puv.setY(i, puv.getY(i) * 0.75);
    waterGeos.push(pond);
    // the fall: a ribbon that leaves the edge and drops to the sea
    const seg = 40, wdt = 2.3, pos = [], uv = [], idxs = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const out2 = 0.4 + Math.sqrt(t) * 2.2, y = top + 0.05 - t * (top - SEA + 2);
      for (const sd of [-1, 1]) {
        pos.push(x + nx * out2 - nz * sd * wdt / 2, y, z + nz * out2 + nx * sd * wdt / 2);
        uv.push((sd + 1) / 2, t);
      }
      if (i) { const k = i * 2; idxs.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idxs);
    geo.computeVertexNormals();
    waterGeos.push(geo);
    const mist = K.glow('#ffffff', 10);
    mist.position.set(x + nx * 2.6, SEA + 2, z + nz * 2.6);
    mist.material.opacity = 0.75;
    mist.material.blending = THREE.NormalBlending;
    root.add(mist);
  }
  const water = new THREE.Mesh(mergeGeometriesSafe(waterGeos), fallMat);
  water.userData.noAO = true;
  root.add(water);

  // floating islets, distant islands, clouds and boats
  const islets = [];
  for (const [x, y, z, s] of [[30, -6, -22, 1.1], [24, -16, -34, 0.8], [-22, 3, -32, 0.8], [33, 0, 8, 0.7], [20, -22, 28, 0.9]]) {
    const isl = new THREE.Group();
    const cone = new THREE.ConeGeometry(2.6 * s, 4.5 * s, 7, 2);
    cone.rotateX(Math.PI);
    paint(cone, '#b08d63');
    const rock = new THREE.Mesh(cone, ROCK);
    rock.position.y = -2.25 * s;
    rock.castShadow = true;
    isl.add(rock);
    isl.add(piece(new THREE.CylinderGeometry(2.62 * s, 2.62 * s, 0.35 * s, 7), '#7fb35a', { y: 0.05 }));
    isl.add(piece(new THREE.CylinderGeometry(0.15 * s, 0.2 * s, 1.4 * s, 6), '#7a5a3f', { y: 0.8 * s }));
    for (let i = 0; i < 3; i++) isl.add(piece(new THREE.IcosahedronGeometry((0.9 - i * 0.15) * s, 1), ['#4f8a3c', '#62994a', '#3f7533'][i], { x: (i - 1) * 0.5 * s, y: (1.8 + i * 0.35) * s, z: (i % 2) * 0.3 * s }));
    for (let i = 0; i < 4; i++) isl.add(piece(new THREE.IcosahedronGeometry(0.35 * s, 0), '#4f8a3c', { x: Math.cos(i * 1.6) * 1.9 * s, y: 0.35 * s, z: Math.sin(i * 1.6) * 1.9 * s }));
    isl.position.set(x, y, z);
    mergeStatic(isl);
    isl.userData.dynamic = true;
    root.add(isl);
    islets.push({ obj: isl, y, phase: rnd() * 6 });
  }
  const far = new THREE.Group();
  const surf = [];
  for (const [x, z, sz] of [[-190, -40, 6], [-160, -100, 4], [-50, -195, 7], [-115, -160, 3.5], [-210, 50, 4.5], [55, -210, 4]]) {
    const cliff = new THREE.CylinderGeometry(sz * 0.8, sz, sz * 0.6, 9, 1);
    paint(cliff, '#b9976b');
    const c = new THREE.Mesh(cliff, ROCK);
    c.position.set(x, SEA + sz * 0.25, z);
    far.add(c);
    const top = new THREE.SphereGeometry(sz * 0.82, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    top.scale(1, 0.55, 1);
    paint(top, '#4f8a3c');
    const m = new THREE.Mesh(top, ROCK);
    m.position.set(x, SEA + sz * 0.55, z);
    far.add(m);
    surf.push(new THREE.RingGeometry(sz * 0.98, sz * 1.35, 18).rotateX(-Math.PI / 2).translate(x, SEA + 0.15, z));
  }
  const surfMesh = new THREE.Mesh(mergeGeometriesSafe(surf), new THREE.MeshBasicMaterial({ color: '#d9eefc', transparent: true, opacity: 0.55, depthWrite: false }));
  surfMesh.userData.noAO = true;
  root.add(surfMesh);
  far.userData.noAO = true;
  root.add(far);
  // clouds at the edges of the view, some below the island; all in one mesh
  const clouds = new THREE.Group();
  const puffs = [];
  for (const [x, y, z, sc] of [[-40, -30, 46, 1.4], [42, -9, -42, 1.4], [54, 2, -16, 1.0], [-12, -27, 50, 1.6], [36, -29, 18, 1.3], [-56, -2, -38, 1.2], [-28, 5, -60, 1.0]]) {
    for (let i = 0; i < 8; i++) {
      const p = new THREE.IcosahedronGeometry((2.0 + rnd() * 1.8) * sc, 1);
      p.scale(1, 0.72, 1);
      p.translate(x + (i - 3.5) * 1.7 * sc + rnd(), y + Math.sin(i * 1.3) * 0.7 * sc + (i % 3 === 1 ? 1.1 * sc : 0), z + (rnd() - 0.5) * 2.6 * sc);
      puffs.push(p);
    }
  }
  const cloudMesh = new THREE.Mesh(mergeGeometriesSafe(puffs), CLOUD);
  cloudMesh.userData.noAO = true;
  clouds.add(cloudMesh);
  clouds.userData.dynamic = true;
  root.add(clouds);
  const boats = [boat('sail'), boat('ferry')];
  boats.forEach(bt => { mergeStatic(bt); bt.userData.dynamic = true; root.add(bt); });

  // a few people walking the paths
  const walkers = [
    { p: miniPerson({ shirt: '#c0533a', pants: '#2b3340', hair: '#2c211a', hairStyle: 'short', skin: '#c68b62' }), path: [[3.0, -4.6], [3.0, 13.4]], y: 0, speed: 1.0, t: 0.2 },
    { p: miniPerson({ shirt: '#5f7a8c', pants: '#4a4f56', hair: '#3b2a20', hairStyle: 'ponytail', skin: '#f1c9a5' }), path: [[-6.8, -7.7], [13.0, -7.7]], y: T, speed: 0.9, t: 0.6 },
    { p: miniPerson({ shirt: '#e8dfcf', pants: '#5a4a3a', hair: '#141414', hairStyle: 'bob', skin: '#f5d6bc' }), path: [[3.6, 1.0], [14.0, 1.0]], y: 0, speed: 0.8, t: 0.1 }
  ];
  for (const w of walkers) {
    w.p.root.userData.dynamic = true;
    root.add(w.p.root);
    w.p.root.traverse(o => { if (o.isGroup) mergeChildren(o); });
  }

  // merge everything that never moves; then each building on its own (they lift when hovered)
  mergeStatic(root);
  for (const b of buildings.values()) {
    b.roof.userData.dynamic = true;
    mergeStatic(b.group);
    mergeStatic(b.roof);
  }

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // a telling moment of every scene, so a still island (reduced motion) shows each case too
  for (const bd of buildings.values()) bd.tick?.(6.6);
  view.every((dt, t) => {
    waterUniforms.uTime.value = reduce ? 0 : t;
    if (!reduce) {
      for (const isl of islets) isl.obj.position.y = isl.y + Math.sin(t * 0.35 + isl.phase) * 0.5;
      clouds.rotation.y = t * 0.0035;
      boats[0].position.set(Math.cos(t * 0.012 + 2.2) * 96, SEA + 0.2, Math.sin(t * 0.012 + 2.2) * 96);
      boats[0].rotation.y = -(t * 0.012 + 2.2);
      boats[1].position.set(Math.cos(-t * 0.009 + 0.6) * 74, SEA + 0.2, Math.sin(-t * 0.009 + 0.6) * 74);
      boats[1].rotation.y = -(-t * 0.009 + 0.6) + Math.PI;
      for (const bd of buildings.values()) bd.tick?.(t);
      for (const w of walkers) {
        const [[x1, z1], [x2, z2]] = w.path;
        const len = Math.hypot(x2 - x1, z2 - z1);
        const u = ((w.t * len + t * w.speed) % (len * 2)) / len;
        const k = u < 1 ? u : 2 - u;
        w.p.root.position.set(x1 + (x2 - x1) * k, w.y + 0.03, z1 + (z2 - z1) * k);
        w.p.root.rotation.y = Math.atan2((x2 - x1) * (u < 1 ? 1 : -1), (z2 - z1) * (u < 1 ? 1 : -1));
        w.p.stride(t * w.speed * 5.4);
      }
    }
    // hovered buildings rise a little
    for (const b of buildings.values()) {
      b.lift += (b.want - b.lift) * Math.min(1, dt * 7);
      b.group.position.y = b.base + b.lift * 0.35;
      b.roof.position.y = b.lift * 2.6;
    }
  });

  const overview = { target: [0.4, -1.0, 0.4], theta: Math.PI / 4, phi: 1.06, radius: 66 };
  return {
    buildings,
    overview,
    hover(id) { for (const [k, b] of buildings) b.want = k === id ? 1 : 0; },
    /** Camera settings that look into one building. */
    focus(id) {
      const b = buildings.get(id);
      if (!b) return overview;
      // from higher up, so the trees in front of a building do not block the view in
      return { target: b.focus.toArray(), theta: Math.PI / 4, phi: 0.84, radius: 12 };
    }
  };
}

function mergeGeometriesSafe(list) {
  const prepared = list.map(g => {
    const x = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(name)) x.deleteAttribute(name);
    if (!x.attributes.normal) x.computeVertexNormals();
    if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
    return x;
  });
  const total = prepared.reduce((n, g) => n + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const size = prepared[0].attributes[name].itemSize;
    const arr = new Float32Array(total * size);
    let off = 0;
    for (const g of prepared) { arr.set(g.attributes[name].array, off); off += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  out.computeBoundingSphere();
  return out;
}

function boat(kind) {
  const g = new THREE.Group();
  if (kind === 'sail') {
    const hull = new THREE.CylinderGeometry(0.9, 0.5, 5, 8, 1);
    hull.rotateX(Math.PI / 2); hull.scale(1, 0.55, 1);
    g.add(piece(hull, '#f4f1ea', { y: 0.3 }));
    g.add(piece(new THREE.BoxGeometry(1.5, 0.12, 4.6), '#a8553f', { y: 0.62 }));
    g.add(piece(new THREE.CylinderGeometry(0.06, 0.06, 5.5, 5), '#6b4f38', { y: 3.3 }));
    const sail = new THREE.BufferGeometry();
    sail.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.2, -0.2, 0, 5.8, -0.1, 0, 1.0, -2.4], 3));
    sail.computeVertexNormals();
    const s = new THREE.Mesh(paint(sail, '#fbf8f0'), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 }));
    s.castShadow = true;
    g.add(s);
  } else {
    g.add(piece(new THREE.BoxGeometry(3.2, 1.0, 9), '#f4f1ea', { y: 0.4 }));
    g.add(piece(new THREE.BoxGeometry(3.25, 0.3, 9.05), '#2f4f7a', { y: 0.05 }));
    g.add(piece(new THREE.BoxGeometry(2.4, 1.1, 4.2), '#f7f5ef', { y: 1.45, z: -0.6 }));
    g.add(piece(new THREE.BoxGeometry(2.42, 0.3, 4.22), '#3f6fa5', { y: 1.65, z: -0.6, shadow: false }));
    g.add(piece(new THREE.CylinderGeometry(0.3, 0.35, 1.0, 8), '#c0533a', { y: 2.4, z: -1.5 }));
  }
  // a white wake
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(kind === 'sail' ? 2.2 : 3.6, kind === 'sail' ? 9 : 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: wakeTexture(), transparent: true, depthWrite: false, opacity: 0.8 }));
  wake.position.set(0, 0.06, kind === 'sail' ? 6.5 : 12);
  wake.userData.noAO = true;
  g.add(wake);
  return g;
}
let WAKE = null;
function wakeTexture() {
  if (WAKE) return WAKE;
  WAKE = K.canvasTex(64, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(w * 0.35, 0); ctx.lineTo(w * 0.65, 0); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.1); ctx.lineTo(w * 0.8, h); ctx.lineTo(w * 0.2, h); ctx.closePath(); ctx.fill();
  });
  return WAKE;
}
