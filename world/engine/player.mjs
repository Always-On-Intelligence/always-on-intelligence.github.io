import * as THREE from 'three';

// First-person viewer. With a mouse, the view follows the mouse as it moves over the 3D view (no
// button needed), and keeps turning while the cursor rests near the left or right edge; W A S D
// walk. A click "uses" what is under the cursor and never walks you anywhere. Touch screens, which
// have no keys, keep drag-to-look and tap-to-walk. V gives an overhead view. During a guided walk
// the script owns the camera, so the mouse does not turn it. The tour drives the same body.

const HOVER_GAIN = 0.0034;
const EDGE_TURN = 1.7;

const EYE = 1.64;
const TAU = Math.PI * 2;
const wrap = (a) => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));

export class Player {
  constructor(camera, dom, nav, { x = 0, z = 0, yaw = 0, groundAt = null } = {}) {
    this.camera = camera;
    this.dom = dom;
    this.nav = nav;
    this.groundAt = groundAt || (() => 0);
    this.x = x; this.z = z; this.yaw = yaw; this.pitch = -0.04;
    this.groundY = this.groundAt(x, z);
    this.vx = 0; this.vz = 0;
    this.keys = new Set();
    this.mode = 'walk';
    this.path = null;
    this.walkSpeed = 1.45;
    this.faceTarget = null;
    this.arrive = null;
    this.bob = 0;
    this.inputLocked = false;
    this.lookLocked = false;
    this.onClick = null;
    this.onManualMove = null;
    this.overview = { t: 0, dist: 46, yaw: 0.35, tilt: 1.05 };
    this.cancelLook();
    this.bindInput();
    this.apply(0);
  }

  bindInput() {
    const dom = this.dom;
    this.pointers = new Map();
    this.cursor = null;
    this.mouseTurned = 0;
    dom.addEventListener('contextmenu', e => e.preventDefault());
    // Mouse over the 3D view: movement turns the view (left turns left, up looks up). The first
    // move after the cursor enters is skipped, since its delta is the jump from outside.
    dom.addEventListener('mousemove', (e) => {
      const fresh = !this.cursor;
      this.cursor = { x: e.clientX, y: e.clientY };
      if (fresh || this.inputLocked || this.pointers.size) return;
      const dx = e.movementX * HOVER_GAIN, dy = e.movementY * HOVER_GAIN * 0.6;
      this.look(dx, dy);
      this.mouseTurned += Math.abs(dx) + Math.abs(dy);
    });
    dom.addEventListener('mouseleave', () => { this.cursor = null; });
    dom.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dom.setPointerCapture?.(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, touch: e.pointerType !== 'mouse' });
    });
    // Touch: drag to look. A mouse needs no drag, so a mouse drag does nothing extra.
    dom.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (!p.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 6) p.moved = true;
      if (!p.moved || !p.touch) return;
      this.look(dx * 0.0048, dy * 0.0048);
    });
    const end = (e) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (p && !p.moved && performance.now() - p.t < 450 && this.onClick) {
        const rect = dom.getBoundingClientRect();
        this.onClick((e.clientX - rect.left) / rect.width * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1, { pointer: e.pointerType === 'mouse' ? 'mouse' : 'touch' });
      }
    };
    dom.addEventListener('pointerup', end);
    dom.addEventListener('pointercancel', (e) => this.pointers.delete(e.pointerId));
    dom.addEventListener('wheel', (e) => {
      if (this.mode !== 'overview') return;
      e.preventDefault();
      this.overview.dist = Math.min(120, Math.max(12, this.overview.dist * Math.exp(e.deltaY * 0.001)));
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
        this.keys.add(k);
        if (k.startsWith('arrow')) e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  get position() { return { x: this.x, z: this.z }; }

  /** Stop an eased turn; whoever awaits it is released, so a greeting or a script never hangs. */
  cancelLook() {
    const t = this.lookTween;
    this.lookTween = null;
    t?.done?.();
  }

  /** Turn the view by (dx, dy) radians; in the overview, orbit instead. */
  look(dx, dy) {
    if (this.mode === 'overview') {
      this.overview.yaw -= dx;
      this.overview.tilt = Math.min(1.45, Math.max(0.45, this.overview.tilt + dy));
    } else if (!this.lookLocked) {
      this.yaw = wrap(this.yaw - dx);
      this.pitch = Math.min(1.1, Math.max(-1.15, this.pitch - dy));
      this.cancelLook();
    }
  }

  /**
   * Keep turning while the cursor rests near the left or right edge of the 3D view, so a mouse can
   * turn all the way round. `viewLeft()` (set by the scene) is where the view starts on the left,
   * right of the side panel.
   */
  edgeTurn(dt) {
    if (!this.cursor || this.inputLocked || this.mode === 'overview' || this.pointers.size) return;
    // Layout is read a few times a second, not every frame.
    const now = performance.now();
    if (!this.viewRect || now - this.viewRectAt > 300) {
      this.viewRectAt = now;
      const r = this.dom.getBoundingClientRect();
      this.viewRect = { left: r.left, right: r.right, inset: this.viewLeft?.() ?? r.left };
    }
    const rect = this.viewRect;
    const left = Math.max(rect.left, rect.inset);
    const zone = Math.min(90, (rect.right - left) * 0.1);
    const x = this.cursor.x;
    let turn = 0;
    if (x < left + zone) turn = Math.min(1, (left + zone - x) / zone);
    else if (x > rect.right - zone) turn = -Math.min(1, (x - (rect.right - zone)) / zone);
    if (!turn) return;
    this.yaw = wrap(this.yaw + turn * turn * Math.sign(turn) * EDGE_TURN * dt);
    this.cancelLook();
    this.mouseTurned += Math.abs(turn) * dt;
  }

  forward() { return [-Math.sin(this.yaw), -Math.cos(this.yaw)]; }

  /** Walk along a navigation path; resolves on arrival (false if no path). */
  walkTo(target, { face = null, speed = 1.45 } = {}) {
    const path = this.nav.findPath([this.x, this.z], target);
    if (this.arrive) this.arrive(false);
    this.arrive = null;
    // noPath tells a caller that nothing reaches the target (as opposed to a walk interrupted later).
    this.noPath = !path;
    if (!path) { this.path = null; return Promise.resolve(false); }
    this.path = path;
    this.pathIndex = 1;
    this.walkSpeed = speed;
    this.faceTarget = face;
    this.cancelLook();
    return new Promise(resolve => { this.arrive = resolve; });
  }

  stop() {
    this.path = null;
    if (this.arrive) this.arrive(false);
    this.arrive = null;
  }

  /** Turn the head towards a world point over a short ease. */
  lookAt(point, duration = 0.8) {
    const dx = point[0] - this.x, dz = point[2] - this.z;
    const dy = point[1] - (this.groundY + EYE);
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.atan2(dy, Math.hypot(dx, dz));
    this.cancelLook();
    this.lookTween = { fromYaw: this.yaw, fromPitch: this.pitch, yaw: this.yaw + wrap(yaw - this.yaw), pitch, t: 0, duration };
    return new Promise(resolve => { this.lookTween.done = resolve; });
  }

  setOverview(on) {
    this.mode = on ? 'overview' : 'walk';
    if (on) this.overview.yaw = this.yaw + 0.5;
  }

  update(dt) {
    let moving = false;
    if (this.mode !== 'overview' && !this.inputLocked) {
      const k = this.keys;
      const fwd = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
      const side = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0);
      const turn = (k.has('arrowleft') ? 1 : 0) - (k.has('arrowright') ? 1 : 0);
      if (turn) { this.yaw = wrap(this.yaw + turn * 1.9 * dt); this.cancelLook(); }
      if (fwd || side) {
        if (this.path) { this.stop(); this.onManualMove?.(); }
        const speed = k.has('shift') ? 3.1 : 1.6;
        const [fx, fz] = this.forward();
        const rx = -fz, rz = fx;
        let mx = fx * fwd + rx * side, mz = fz * fwd + rz * side;
        const len = Math.hypot(mx, mz) || 1;
        mx = mx / len * speed; mz = mz / len * speed;
        this.vx = damp(this.vx, mx, 10, dt); this.vz = damp(this.vz, mz, 10, dt);
        moving = true;
      } else if (!this.path) {
        this.vx = damp(this.vx, 0, 12, dt); this.vz = damp(this.vz, 0, 12, dt);
      }
      if (!this.path && (Math.abs(this.vx) > 0.01 || Math.abs(this.vz) > 0.01)) {
        let [nx, nz] = this.nav.slide(this.x, this.z, this.vx * dt, this.vz * dt);
        // People are solid too: slide along whoever is in the way instead of walking through them.
        if (this.bodies?.(nx, nz, this.x, this.z)) {
          if (!this.bodies(nx, this.z, this.x, this.z) && this.nav.walkable(nx, this.z)) nz = this.z;
          else if (!this.bodies(this.x, nz, this.x, this.z) && this.nav.walkable(this.x, nz)) nx = this.x;
          else { nx = this.x; nz = this.z; }
        }
        this.x = nx; this.z = nz;
        moving = moving || Math.hypot(this.vx, this.vz) > 0.2;
      }
    }
    this.edgeTurn(dt);
    if (this.path) moving = this.followPath(dt) || moving;
    if (this.lookTween) {
      const t = this.lookTween;
      t.t = Math.min(1, t.t + dt / t.duration);
      const e = t.t < 0.5 ? 2 * t.t * t.t : 1 - (-2 * t.t + 2) ** 2 / 2;
      this.yaw = wrap(t.fromYaw + (t.yaw - t.fromYaw) * e);
      this.pitch = t.fromPitch + (t.pitch - t.fromPitch) * e;
      if (t.t >= 1) { this.lookTween = null; t.done?.(); }
    }
    this.bob = moving ? this.bob + dt * 8.4 : damp(this.bob, Math.round(this.bob / Math.PI) * Math.PI, 6, dt);
    this.apply(dt);
    return moving;
  }

  followPath(dt) {
    const target = this.path[this.pathIndex];
    const dx = target[0] - this.x, dz = target[1] - this.z;
    const dist = Math.hypot(dx, dz);
    const step = this.walkSpeed * dt;
    if (dist <= step) {
      this.x = target[0]; this.z = target[1];
      this.pathIndex++;
      if (this.pathIndex >= this.path.length) {
        this.path = null;
        const done = this.arrive;
        this.arrive = null;
        if (this.faceTarget) this.lookAt(this.faceTarget, 0.7).then(() => done?.(true));
        else done?.(true);
        return false;
      }
      return true;
    }
    // On a walk (the guided tour, a tap), wait a moment for someone in the way to move on, rather
    // than walking through them; after a second and a half, carry on so a walk never stalls.
    const nx = this.x + dx / dist * step, nz = this.z + dz / dist * step;
    if (this.bodies?.(nx, nz, this.x, this.z) && (this.blockedFor = (this.blockedFor || 0) + dt) < 1.5) return false;
    this.blockedFor = 0;
    this.x = nx;
    this.z = nz;
    if (!this.lookTween) {
      // Look where you walk, glancing ahead to the next corner.
      const ahead = this.path[Math.min(this.pathIndex + 1, this.path.length - 1)];
      const wx = dist < 2.5 && ahead !== target ? (target[0] + ahead[0]) / 2 : target[0];
      const wz = dist < 2.5 && ahead !== target ? (target[1] + ahead[1]) / 2 : target[1];
      const want = Math.atan2(-(wx - this.x), -(wz - this.z));
      this.yaw = wrap(this.yaw + wrap(want - this.yaw) * (1 - Math.exp(-4.5 * dt)));
      this.pitch = damp(this.pitch, -0.05, 3, dt);
    }
    return true;
  }

  apply(dt) {
    const cam = this.camera;
    const o = this.overview;
    o.t = damp(o.t, this.mode === 'overview' ? 1 : 0, 3.2, dt || 1);
    // Follow the ground smoothly, so slopes and kerbs do not jolt the view.
    const g = this.groundAt(this.x, this.z);
    this.groundY = dt ? damp(this.groundY, g, 9, dt) : g;
    const eyeY = this.groundY + EYE + Math.sin(this.bob) * 0.016;
    const fp = new THREE.Vector3(this.x, eyeY, this.z);
    const fq = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    if (o.t < 0.001) {
      cam.position.copy(fp);
      cam.quaternion.copy(fq);
      return;
    }
    const center = new THREE.Vector3(this.x, this.groundY, this.z);
    const op = new THREE.Vector3(
      center.x + Math.sin(o.yaw) * Math.cos(o.tilt) * o.dist,
      this.groundY + Math.sin(o.tilt) * o.dist,
      center.z + Math.cos(o.yaw) * Math.cos(o.tilt) * o.dist,
    );
    const m = new THREE.Matrix4().lookAt(op, center, new THREE.Vector3(0, 1, 0));
    const oq = new THREE.Quaternion().setFromRotationMatrix(m);
    const e = o.t * o.t * (3 - 2 * o.t);
    cam.position.lerpVectors(fp, op, e);
    cam.quaternion.slerpQuaternions(fq, oq, e);
  }
}
