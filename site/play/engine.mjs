// Real-time view for the playable episodes: one three.js renderer, a diorama camera the viewer can
// drag around within limits, HTML labels pinned to 3D points, clickable objects, simple tweens and
// time-of-day lighting. Scenes (site/play/scenes/*.mjs) build their rooms into view.root.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { mergeStatic } from './merge.mjs';

export { THREE };

export const EASE = {
  linear: k => k,
  out: k => 1 - Math.pow(1 - k, 3),
  in: k => k * k * k,
  inOut: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  back: k => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); }
};

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function detectQuality() {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const memory = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  return coarse || memory <= 4 || cores <= 4 ? 'low' : 'high';
}

// Lighting presets: window sky, ambient, sun and lamp strengths.
export const TIMES = {
  morning: { shaft: [1.0, '#fff3d6'], env: 0.32, sky: ['#9ec7e8', '#e9f1f4'], hemi: ['#f4f7ff', '#5b5348', 0.85], key: ['#fff1dc', 2.9], fill: ['#c9dcff', 0.5], lamps: 0, exposure: 1.0, bg: ['#1a2230', '#0b0e14'] },
  day: { shaft: [0.85, '#fff6e6'], env: 0.32, sky: ['#8fc0ea', '#eef4f2'], hemi: ['#fffaf0', '#5e5446', 0.85], key: ['#fff0d6', 3.1], fill: ['#d3e2ff', 0.45], lamps: 0, exposure: 1.0, bg: ['#1b2330', '#0b0e14'] },
  dusk: { shaft: [0.6, '#ffc48a'], env: 0.2, sky: ['#3d4f7c', '#f2a865'], hemi: ['#ffd9b0', '#3f3530', 0.62], key: ['#ffb27a', 2.5], fill: ['#7d8fd6', 0.5], lamps: 1, exposure: 1.02, bg: ['#22202c', '#0c0b10'] },
  evening: { shaft: [0.06, '#9fb0e0'], env: 0.12, sky: ['#1b2440', '#4b4f72'], hemi: ['#c9c4e0', '#2b2830', 0.55], key: ['#ffc58f', 1.1], fill: ['#5d6fb8', 0.45], lamps: 1.2, exposure: 1.05, bg: ['#161826', '#08090e'] },
  island: { shaft: [0, '#ffffff'], env: 0.36, sky: ['#8fc0ea', '#eef4f2'], hemi: ['#ffffff', '#6f8a5a', 1.05], key: ['#fff3dc', 3.0], fill: ['#cfe0ff', 0.6], lamps: 0, exposure: 1.0, bg: ['#4f8fd6', '#cfe7f8'] },
  night: { shaft: [0.0, '#9fb0e0'], env: 0.07, sky: ['#0b1124', '#1f2a47'], hemi: ['#9aa6d6', '#1d1b22', 0.38], key: ['#9fb4ff', 0.45], fill: ['#4b5ca8', 0.35], lamps: 1.4, exposure: 1.08, bg: ['#0f1220', '#05060a'] }
};

/**
 * Create a view inside `host`. Returns helpers used by scenes and the player:
 * root, camera rig (setRig / focus), label(), pickable(), animate(), every(), setTime(), start/stop/dispose.
 */
export function createView(host, { quality = detectQuality(), onPick = null, onHover = null, fov = [26, 38], near = 0.1, far = 200, ao = {}, denoise = {}, zoom = true, touchAction = 'none' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'pv-canvas';
  const overlay = document.createElement('div');
  overlay.className = 'pv-overlay';
  host.append(canvas, overlay);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  // the pixel ratio is the device's (capped), lowered by adaptive quality, times the pixelation of transitions
  let baseRatio = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.25 : 1), pix = 1;
  renderer.setPixelRatio(baseRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  // a soft backdrop behind the diorama; its colours follow the time of day
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = 16; bgCanvas.height = 256;
  const bgTex = new THREE.CanvasTexture(bgCanvas);
  bgTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = bgTex;
  function paintBackdrop(top, bottom) {
    const ctx = bgCanvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top); g.addColorStop(0.55, bottom); g.addColorStop(1, bottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 256);
    bgTex.needsUpdate = true;
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(fov[0], 1, near, far);
  const root = new THREE.Group();
  scene.add(root);

  const hemi = new THREE.HemisphereLight('#fffaf0', '#5e5446', 1.1);
  const key = new THREE.DirectionalLight('#fff0d6', 2.6);
  key.position.set(-7, 12, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.025;
  key.shadow.radius = 3;
  const fill = new THREE.DirectionalLight('#d3e2ff', 0.5);
  fill.position.set(9, 6, -3);
  scene.add(hemi, key, key.target, fill);

  // ---------- ambient occlusion (high quality) ----------
  // The room is drawn straight to the canvas; the occlusion is then computed at half resolution from
  // a normal and depth pass and multiplied over the frame. This costs about half of a full composer.
  let gtao = null, aoQuad = null;
  if (quality === 'high') {
    gtao = new GTAOPass(scene, camera, 16, 16);
    gtao.output = GTAOPass.OUTPUT.Off;
    gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.6, thickness: 1.2, scale: 1.15, samples: 12, distanceFallOff: 1.0, ...ao });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 6, ...denoise });
    // the occlusion is soft, so half resolution (a quarter of the pixels) is enough
    const aoSize = gtao.setSize.bind(gtao);
    gtao.setSize = (w, h) => aoSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
    // keep helpers (beams, rings, glows, soft shadows) out of the occlusion buffers
    gtao._overrideVisibility = function () {
      const cache = this._visibilityCache;
      this.scene.traverse(o => {
        if (!o.visible) return;
        if (o.isPoints || o.isLine || o.isLine2 || o.isSprite || (o.isMesh && (o.userData.noAO || o.material?.transparent || o.material?.blending === THREE.AdditiveBlending))) { o.visible = false; cache.push(o); }
      });
    };
    // the frame is already tone mapped and in sRGB, so the occlusion factor is converted to match
    aoQuad = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tAO: { value: gtao.pdRenderTarget.texture }, intensity: { value: 0.9 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tAO; uniform float intensity; varying vec2 vUv; void main() { vec3 ao = texture2D(tAO, vUv).rgb; gl_FragColor = vec4(pow(mix(vec3(1.0), ao, intensity), vec3(0.4545)), 1.0); }',
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor,
      blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor
    }));
  }
  let useAO = Boolean(gtao);
  function draw() {
    renderer.render(scene, camera);
    if (!useAO || pix < 0.6) return;
    // the normal pass must not redraw the shadow map a second time
    const shadows = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    gtao.render(renderer, null, null);
    renderer.shadowMap.autoUpdate = shadows;
    renderer.setRenderTarget(null);
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    aoQuad.render(renderer);
    renderer.autoClear = autoClear;
  }
  // frame pacing: if frames stay slow (under about 48 a second), first drop the ambient occlusion,
  // then the resolution, then the shadow map size
  let slowFor = 0, avg = 1 / 60, stage = 0;
  function adapt(dt) {
    if (!dt || dt >= 0.05) return;
    avg += (dt - avg) * 0.06;
    slowFor = avg > 1 / 48 ? slowFor + dt : 0;
    if (slowFor < 1.2 || stage >= 3) return;
    slowFor = 0; avg = 1 / 60; stage++;
    if (stage === 1 && useAO) useAO = false;
    else if (stage <= 2) { baseRatio = Math.max(0.75, baseRatio * 0.75); applyRatio(); }
    else { key.shadow.mapSize.set(1024, 1024); key.shadow.map?.dispose(); key.shadow.map = null; }
  }

  // ---------- camera rig: orbit around a target within limits ----------
  const rig = { target: new THREE.Vector3(0, 0.6, 0), theta: 0.55, phi: 0.98, radius: 16, limits: { theta: 0.75, phiMin: 0.55, phiMax: 1.32, rMin: 5, rMax: 26 } };
  const home = { target: rig.target.clone(), theta: rig.theta, phi: rig.phi, radius: rig.radius };
  const cur = { target: rig.target.clone(), theta: rig.theta, phi: rig.phi, radius: rig.radius };
  let userTheta = 0, userPhi = 0, userZoom = 1;
  // where the rig target appears on screen, as an offset from the centre in viewport fractions
  const frameWant = { x: 0, y: 0 }, frameCur = { x: 0, y: 0 };
  function setFrame(x = 0, y = 0, { instant = false } = {}) {
    frameWant.x = x; frameWant.y = y;
    if (instant) { frameCur.x = x; frameCur.y = y; applyFrame(); }
  }
  function applyFrame() {
    if (!width || !height) return;
    camera.setViewOffset(width, height, -frameCur.x * width, -frameCur.y * height, width, height);
  }

  function placeCamera() {
    const th = cur.theta, ph = cur.phi, r = cur.radius;
    camera.position.set(cur.target.x + r * Math.sin(ph) * Math.sin(th), cur.target.y + r * Math.cos(ph), cur.target.z + r * Math.sin(ph) * Math.cos(th));
    camera.lookAt(cur.target);
  }

  /** Set where the camera looks (scene coordinates); the viewer's drag offset is kept within limits. */
  function setRig({ target, theta, phi, radius, limits } = {}, { instant = false } = {}) {
    if (limits) Object.assign(rig.limits, limits);
    if (target) rig.target.set(...target);
    if (theta !== undefined) rig.theta = theta;
    if (phi !== undefined) rig.phi = phi;
    if (radius !== undefined) rig.radius = radius;
    if (instant) syncNow();
  }
  function setHome(view) {
    setRig(view, { instant: true });
    Object.assign(home, { target: rig.target.clone(), theta: rig.theta, phi: rig.phi, radius: rig.radius });
  }
  function resetUser() { userTheta = 0; userPhi = 0; userZoom = 1; }
  function desired() {
    const L = rig.limits;
    const theta = rig.theta + Math.max(-L.theta, Math.min(L.theta, userTheta));
    const phi = Math.max(L.phiMin, Math.min(L.phiMax, rig.phi + userPhi));
    const radius = Math.max(L.rMin, Math.min(L.rMax, rig.radius * userZoom));
    return { theta, phi, radius };
  }
  function syncNow() {
    const d = desired();
    cur.target.copy(rig.target);
    Object.assign(cur, d);
    placeCamera();
  }

  // ---------- pointer: drag to orbit, wheel or pinch to zoom, click to pick ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const picks = [];
  let hovered = null;
  let drag = null;
  const touches = new Map();

  function pickAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(picks.filter(p => p.visible !== false && isShown(p)), true);
    for (const hit of hits) {
      let o = hit.object;
      while (o && !o.userData.spot) o = o.parent;
      if (o) return o;
    }
    return null;
  }
  function isShown(o) {
    for (let p = o; p; p = p.parent) if (p.visible === false) return false;
    return true;
  }
  function setHover(obj) {
    if (hovered === obj) return;
    if (hovered) glow(hovered, 0);
    hovered = obj;
    if (hovered) glow(hovered, 1);
    canvas.style.cursor = hovered ? 'pointer' : drag ? 'grabbing' : 'grab';
    onHover?.(hovered?.userData.spot || null);
  }
  function glow(obj, on) {
    obj.traverse(m => {
      if (!m.isMesh || !m.material || m.userData.noGlow) return;
      if (!m.userData.ownMat) { m.material = m.material.clone(); m.userData.ownMat = true; }
      if (m.material.emissive) {
        if (m.userData.baseEmissive === undefined) m.userData.baseEmissive = m.material.emissive.getHex();
        m.material.emissive.setHex(on ? 0x3a3020 : m.userData.baseEmissive);
      }
    });
  }

  canvas.style.touchAction = touchAction;
  canvas.addEventListener('pointerdown', event => {
    canvas.setPointerCapture(event.pointerId);
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    drag = { x: event.clientX, y: event.clientY, moved: 0, pinch: touches.size === 2 ? pinchDist() : 0 };
  });
  canvas.addEventListener('pointermove', event => {
    if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (drag) {
      if (touches.size === 2 && zoom) {
        const d = pinchDist();
        if (drag.pinch) userZoom = Math.max(0.35, Math.min(1.8, userZoom * drag.pinch / d));
        drag.pinch = d;
        drag.moved += 10;
        return;
      }
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      drag.x = event.clientX; drag.y = event.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > 4) {
        userTheta -= dx * 0.006;
        userPhi -= dy * 0.004;
        const L = rig.limits;
        userTheta = Math.max(-L.theta, Math.min(L.theta, userTheta));
        userPhi = Math.max(L.phiMin - rig.phi, Math.min(L.phiMax - rig.phi, userPhi));
        canvas.style.cursor = 'grabbing';
      }
      return;
    }
    if (event.pointerType === 'mouse') setHover(pickAt(event.clientX, event.clientY));
  });
  const endPointer = event => {
    touches.delete(event.pointerId);
    if (!drag) return;
    const click = drag.moved <= 4 && touches.size === 0;
    if (touches.size === 0) drag = null;
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
    if (click && event.type === 'pointerup') {
      const obj = pickAt(event.clientX, event.clientY);
      if (obj) onPick?.(obj.userData.spot, obj);
    }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', () => setHover(null));
  // without zoom (a hero on a scrolling page) the wheel keeps scrolling the page
  if (zoom) canvas.addEventListener('wheel', event => {
    event.preventDefault();
    userZoom = Math.max(0.35, Math.min(1.8, userZoom * (1 + Math.sign(event.deltaY) * 0.08)));
  }, { passive: false });
  canvas.addEventListener('dblclick', () => resetUser());
  function pinchDist() {
    const [a, b] = [...touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  }

  /** Register an object the viewer can click; spot is an id the scene understands. */
  function pickable(obj, spot) {
    obj.userData.spot = spot;
    picks.push(obj);
    return obj;
  }

  // ---------- labels: HTML pinned to a point in the scene ----------
  const labels = new Set();
  const tmp = new THREE.Vector3();
  function label(anchor, { className = 'pv-label', html = '', offset = [0, 0, 0] } = {}) {
    const el = document.createElement('div');
    el.className = className;
    el.innerHTML = html;
    el.hidden = !html;
    overlay.append(el);
    const item = {
      el, anchor, offset: new THREE.Vector3(...offset), shown: Boolean(html),
      set(next, cls) {
        if (cls !== undefined) el.className = `${className} ${cls}`.trim();
        if (next === item.html && cls === undefined) return item;
        item.html = next;
        el.innerHTML = next || '';
        item.shown = Boolean(next);
        el.hidden = !item.shown;
        if (item.shown) { el.classList.remove('is-in'); void el.offsetWidth; el.classList.add('is-in'); }
        return item;
      },
      remove() { el.remove(); labels.delete(item); }
    };
    item.html = html;
    labels.add(item);
    return item;
  }
  function placeLabels(w, h) {
    for (const item of labels) {
      if (!item.shown) continue;
      if (item.anchor.isObject3D) item.anchor.getWorldPosition(tmp); else tmp.set(...item.anchor);
      tmp.add(item.offset);
      tmp.project(camera);
      const behind = tmp.z > 1;
      item.el.style.transform = `translate(${((tmp.x + 1) / 2 * w).toFixed(1)}px, ${((1 - tmp.y) / 2 * h).toFixed(1)}px)`;
      item.el.style.visibility = behind || !isShown(item.anchor.isObject3D ? item.anchor : root) ? 'hidden' : 'visible';
    }
  }

  // ---------- tweens and per-frame updates ----------
  const tweens = new Set();
  const updates = new Set();
  /** Run fn(k) for k from 0 to 1 over ms; resolves when done (instantly under reduced motion). */
  function animate(ms, fn, ease = EASE.inOut) {
    if (!ms || reduceMotion()) { fn(1); return Promise.resolve(); }
    return new Promise(resolve => tweens.add({ t0: performance.now(), ms, fn, ease, resolve }));
  }
  const wait = ms => animate(ms, () => {}, EASE.linear);
  function every(fn) { updates.add(fn); return () => updates.delete(fn); }
  // epoch changes whenever running animations are cut short, so multi-step moves can stop early
  let epoch = 0;
  function stopAnimations() { epoch++; for (const t of [...tweens]) { t.fn(1); t.resolve(); } tweens.clear(); }

  // ---------- time of day ----------
  const lamps = [];
  const skies = [];
  const shafts = [];
  let timeName = 'day';
  const lerpColor = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k);
  function applyTime(from, to, k) {
    hemi.color.copy(lerpColor(from.hemi[0], to.hemi[0], k));
    hemi.groundColor.copy(lerpColor(from.hemi[1], to.hemi[1], k));
    hemi.intensity = from.hemi[2] + (to.hemi[2] - from.hemi[2]) * k;
    key.color.copy(lerpColor(from.key[0], to.key[0], k));
    key.intensity = from.key[1] + (to.key[1] - from.key[1]) * k;
    fill.color.copy(lerpColor(from.fill[0], to.fill[0], k));
    fill.intensity = from.fill[1] + (to.fill[1] - from.fill[1]) * k;
    renderer.toneMappingExposure = from.exposure + (to.exposure - from.exposure) * k;
    scene.environmentIntensity = from.env + (to.env - from.env) * k;
    const lampK = from.lamps + (to.lamps - from.lamps) * k;
    for (const l of lamps) {
      l.light.intensity = l.base * lampK;
      if (l.bulb) l.bulb.emissiveIntensity = 0.2 + lampK * 1.6;
      if (l.halo) { l.halo.material.opacity = Math.min(0.75, lampK * 0.55); l.halo.visible = lampK > 0.05; }
    }
    for (const s of skies) s(lerpColor(from.sky[0], to.sky[0], k), lerpColor(from.sky[1], to.sky[1], k));
    const sk = from.shaft[0] + (to.shaft[0] - from.shaft[0]) * k;
    const sc = lerpColor(from.shaft[1], to.shaft[1], k);
    for (const sh of shafts) {
      sh.beam.opacity = 0.11 * sk; sh.patch.opacity = 0.42 * sk;
      sh.beam.color.copy(sc); sh.patch.color.copy(sc);
    }
    const top = '#' + lerpColor(from.bg[0], to.bg[0], k).getHexString();
    const bottom = '#' + lerpColor(from.bg[1], to.bg[1], k).getHexString();
    host.style.setProperty('--pv-bg-top', top);
    host.style.setProperty('--pv-bg-bottom', bottom);
    paintBackdrop(top, bottom);
  }
  function setTime(name, ms = 0) {
    const from = TIMES[timeName] || TIMES.day;
    const to = TIMES[name] || TIMES.day;
    timeName = name;
    return animate(ms, k => applyTime(from, to, k));
  }
  /** A lamp: a point light whose strength follows the time of day; bulb is an emissive material. */
  function addLamp(light, bulb = null, halo = null) { lamps.push({ light, base: light.intensity, bulb, halo }); applyTime(TIMES[timeName], TIMES[timeName], 1); }
  /** Sunlight through a window: { beam, patch } materials whose strength follows the time of day. */
  function addShaft(sh) { shafts.push(sh); applyTime(TIMES[timeName], TIMES[timeName], 1); }
  /** A window sky: paint(top, bottom) is called with colors as the time changes. */
  function addSky(paint) { skies.push(paint); const t = TIMES[timeName]; paint(new THREE.Color(t.sky[0]), new THREE.Color(t.sky[1])); }

  // ---------- loop ----------
  let onResize = null;
  let raf = 0;
  let running = false;
  let last = performance.now();
  let width = 0, height = 0;
  const clock = { t: 0 };
  function resize() {
    const w = host.clientWidth || 640, h = host.clientHeight || 360;
    if (w === width && h === height) return;
    width = w; height = h;
    renderer.setSize(w, h, false);
    if (gtao) { const r = renderer.getPixelRatio(); gtao.setSize(Math.round(w * r), Math.round(h * r)); }
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? fov[1] : fov[0];
    camera.updateProjectionMatrix();
    applyFrame();
    onResize?.(w, h);
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(host);

  function frame(now) {
    raf = running ? requestAnimationFrame(frame) : 0;
    // on 120 Hz and faster displays draw every other frame: a steady 60 is smoother than an uneven 120
    if (now - last < 10) return;
    // rAF timestamps can be a little earlier than the performance.now() taken at start: never step backwards
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    clock.t += dt;
    for (const tw of [...tweens]) {
      const k = Math.min(1, (now - tw.t0) / tw.ms);
      tw.fn(tw.ease(k));
      if (k >= 1) { tweens.delete(tw); tw.resolve(); }
    }
    for (const fn of updates) fn(dt, clock.t);
    adapt(dt);
    // camera damping toward the desired rig
    const d = desired();
    const s = 1 - Math.pow(0.0015, dt);
    cur.target.lerp(rig.target, s);
    cur.theta += (d.theta - cur.theta) * s;
    cur.phi += (d.phi - cur.phi) * s;
    cur.radius += (d.radius - cur.radius) * s;
    if (Math.abs(frameWant.x - frameCur.x) + Math.abs(frameWant.y - frameCur.y) > 0.0005) {
      frameCur.x += (frameWant.x - frameCur.x) * s;
      frameCur.y += (frameWant.y - frameCur.y) * s;
      applyFrame();
    }
    placeCamera();
    resize();
    draw();
    placeLabels(width, height);
  }
  function start() { if (running) return; running = true; last = performance.now() - 17; raf = requestAnimationFrame(frame); }
  function applyRatio() { renderer.setPixelRatio(Math.max(0.02, baseRatio * pix)); width = 0; resize(); }
  /** Draw at k of the resolution, scaled up with hard edges (k = 1 is the normal image). */
  function setPixelation(k) {
    if (k === pix) return;
    pix = k;
    canvas.classList.toggle('is-pixel', k < 1);
    applyRatio();
  }
  /** Step the pixelation to `to` over ms, in a few visible steps like an old console. */
  function pixelate(to, ms = 600, steps = 6) {
    const from = pix;
    if (reduceMotion()) { setPixelation(to); return Promise.resolve(); }
    return animate(ms, k => setPixelation(from * Math.pow(to / from, Math.round(k * steps) / steps)), EASE.linear);
  }
  /** Compile the scene's shaders in the background and draw once, so the first moves do not stutter. */
  async function warm() {
    resize(); syncNow();
    try { await renderer.compileAsync(scene, camera); } catch { /* older browsers compile on first draw */ }
    draw();
  }
  function stop() { running = false; cancelAnimationFrame(raf); raf = 0; }
  function renderOnce() { resize(); syncNow(); draw(); placeLabels(width, height); }
  /** Merge everything that never moves; call once a scene is built. */
  function optimize() { return mergeStatic(root); }
  /** Render one still at w × h (without HTML labels) and return it as a data URL; used for library art. */
  function capture(w, h, { frame = [0, 0], type = 'image/png' } = {}) {
    const ratio = renderer.getPixelRatio();
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    if (gtao) gtao.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = fov[0];
    camera.setViewOffset(w, h, -frame[0] * w, -frame[1] * h, w, h);
    camera.updateProjectionMatrix();
    syncNow();
    for (const fn of updates) fn(0, clock.t);
    draw();
    const url = renderer.domElement.toDataURL(type, 0.92);
    renderer.setPixelRatio(ratio);
    width = 0; height = 0;
    resize();
    return url;
  }

  function dispose() {
    stop();
    ro.disconnect();
    tweens.clear(); updates.clear(); labels.clear();
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) { for (const v of Object.values(m)) if (v && v.isTexture) v.dispose(); m.dispose(); }
    });
    scene.environment?.dispose();
    bgTex.dispose();
    if (gtao) { gtao.dispose(); aoQuad.material.dispose(); aoQuad.dispose(); }
    renderer.dispose();
    canvas.remove(); overlay.remove();
  }

  resize();
  syncNow();
  return {
    THREE, renderer, scene, camera, root, overlay, canvas, key, hemi, fill, clock, quality, gtao,
    setRig, setHome, resetUser, setFrame, label, pickable, animate, wait, every, stopAnimations,
    setTime, addLamp, addSky, addShaft, start, stop, warm, renderOnce, capture, optimize, dispose, setPixelation, pixelate,
    set onResize(fn) { onResize = fn; if (fn && width) fn(width, height); },
    get size() { return { width, height }; },
    get running() { return running; },
    get time() { return timeName; },
    get epoch() { return epoch; },
    get stats() { return { avgFrameMs: Math.round(avg * 1000), ao: useAO, ratio: renderer.getPixelRatio(), stage }; },
    get debug() { return { theta: rig.theta, phi: rig.phi, radius: rig.radius, userTheta, userPhi, userZoom, cur: { theta: cur.theta, phi: cur.phi, radius: cur.radius } }; },
    get home() { return home; }
  };
}
