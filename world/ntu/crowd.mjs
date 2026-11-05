import { createFigures, makePerson, seeded } from '../engine/figures.mjs';
import { SpatialHash, bodyBlocks } from '../engine/crowdspace.mjs';
import { flat } from './scene.mjs';

// Campus people: students walking the covered walkways and paths, people waiting at shuttle
// stops, and groups outside the food courts. All fictional. Nobody is placed inside a building
// or on top of someone else, walkers step around whoever is in their way, and the player cannot
// walk through anyone.

// Indoor corridors are left out: people walking them would move inside the building massing.
const WALK = new Set(['footway', 'pedestrian', 'path', 'steps']);

export function createNtuCrowd({ campus, ground, nav, quality = 'high', extras = 0, center = [-60, 200] }) {
  const random = seeded(2026);
  const people = [];
  const placed = new SpatialHash(2);
  const add = (x, z, yaw, kind, extra = {}) => {
    const p = makePerson(random, x, z, yaw, kind, extra);
    people.push(p);
    if (!extra.hidden) placed.add(p);
    return p;
  };
  const near = (x, z, r) => Math.hypot(x - center[0], z - center[1]) < r;
  // Open ground with a margin: no building, water or tree trunk within about `m` metres.
  const open = (x, z, m = 0.4) => nav.walkable(x, z) && nav.walkable(x + m, z) && nav.walkable(x - m, z) && nav.walkable(x, z + m) && nav.walkable(x, z - m);

  // ---------------------------------------------------------------- walkers
  // Each walkway keeps only its longest stretch in the open, so nobody walks through a building
  // where a mapped path runs under or beside one.
  const pointAt = (line, cum, d) => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const t = (d - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
    return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t, i];
  };
  const routes = [];
  for (const r of campus.roads) {
    if (!WALK.has(r.k) && !(r.k === 'service' && r.c)) continue;
    const full = flat(r.p);
    if (full.length < 2 || !near(full[0][0], full[0][1], 1000)) continue;
    const fcum = [0];
    for (let i = 1; i < full.length; i++) fcum.push(fcum[i - 1] + Math.hypot(full[i][0] - full[i - 1][0], full[i][1] - full[i - 1][1]));
    const flen = fcum[fcum.length - 1];
    if (flen < 35) continue;
    let best = null, start = null;
    for (let d = 0; d <= flen + 0.01; d += 1) {
      const [x, z] = pointAt(full, fcum, Math.min(d, flen));
      const ok = open(x, z, 0.5);
      if (ok && start === null) start = d;
      if ((!ok || d + 1 > flen) && start !== null) {
        const end = ok ? Math.min(d, flen) : d - 1;
        if (!best || end - start > best[1] - best[0]) best = [start, end];
        start = null;
      }
    }
    if (!best || best[1] - best[0] < 30) continue;
    const b0 = pointAt(full, fcum, best[0]), b1 = pointAt(full, fcum, best[1]);
    const line = [[b0[0], b0[1]], ...full.slice(b0[2], b1[2]), [b1[0], b1[1]]];
    const cum = [0];
    for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    routes.push({ line, cum, len: cum[cum.length - 1], weight: near(line[0][0], line[0][1], 450) ? 3 : 1 });
  }
  const weighted = routes.flatMap(r => Array(r.weight).fill(r));
  const walkers = quality === 'low' ? 70 : 170;
  for (let i = 0, tries = 0; i < walkers && weighted.length && tries < walkers * 6; tries++) {
    const route = weighted[Math.floor(random() * weighted.length)];
    const p = { route, s: random() * route.len, dir: random() > 0.5 ? 1 : -1, lane: (random() - 0.5) * 1.0, dodge: 0 };
    placeOnRoute(p);
    if (!open(p.x, p.z, 0.3)) { p.lane = 0; placeOnRoute(p); }
    if (!placed.free(p.x, p.z)) continue;
    const q = add(p.x, p.z, p.yaw, 'walker', { ...p, speed: 1.0 + random() * 0.45, walk: true, moving: true, pause: 0 });
    placeOnRoute(q);
    i++;
  }

  // ---------------------------------------------------------------- people waiting at stops
  for (const stop of campus.stops) {
    if (!near(stop.x, stop.z, 1100)) continue;
    const n = 1 + Math.floor(random() * 3);
    for (let i = 0; i < n; i++) {
      let spot = null;
      for (let k = 0; k < 10 && !spot; k++) {
        const s = nav.nearestWalkable(stop.x + (random() - 0.5) * 3.5, stop.z + (random() - 0.5) * 3.5, 6);
        if (s && open(s[0], s[1], 0.3) && placed.free(s[0], s[1], 0.7)) spot = s;
      }
      if (!spot) continue;
      const q = add(spot[0], spot[1], random() * Math.PI * 2, 'waiting', { phone: random() > 0.4 });
      // Some pace up and down while they wait, on a stretch that is open and clear of others.
      if (random() < 0.4) {
        for (let k = 0; k < 6; k++) {
          const a = random() * Math.PI * 2, bx = spot[0] + Math.cos(a) * 2.2, bz = spot[1] + Math.sin(a) * 2.2;
          const mid = [(spot[0] + bx) / 2, (spot[1] + bz) / 2];
          if (!open(bx, bz, 0.3) || !open(mid[0], mid[1], 0.3) || !placed.free(bx, bz, 0.8, q) || !placed.free(mid[0], mid[1], 0.8, q)) continue;
          q.pace = { a: [spot[0], spot[1]], b: [bx, bz], t: 0, dir: 1, rest: random() * 3 };
          q.moving = true;
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------- groups outside food courts and cafés
  for (const place of campus.places) {
    if (!['food_court', 'restaurant', 'cafe', 'library'].includes(place.kind) || !near(place.x, place.z, 1000)) continue;
    const spot = nav.nearestWalkable(place.x, place.z, 30);
    if (!spot) continue;
    const n = 3 + Math.floor(random() * 4);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + random() * 0.4, d = 1.1 + random() * 0.4;
      const x = spot[0] + Math.cos(a) * d, z = spot[1] + Math.sin(a) * d;
      if (!open(x, z, 0.35) || !placed.free(x, z)) continue;
      add(x, z, Math.atan2(spot[0] - x, spot[1] - z), 'group', { talk: random() > 0.5 });
    }
  }

  for (let i = 0; i < extras; i++) add(0, 0, 0, 'extra', { hidden: true, registered: true, scripted: true, shirt: '#6c5f7a', pants: '#2b3340' });

  // ---------------------------------------------------------------- movement
  function placeOnRoute(p) {
    const { line, cum } = p.route;
    const s = Math.max(0, Math.min(p.route.len, p.s));
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const t = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
    const [ax, az] = line[i - 1], [bx, bz] = line[i];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const nx = -(bz - az) / len, nz = (bx - ax) / len;
    p.nx = nx; p.nz = nz;
    p.tx = (bx - ax) / len * p.dir; p.tz = (bz - az) / len * p.dir;
    p.cx = ax + (bx - ax) * t; p.cz = az + (bz - az) * t;
    p.x = p.cx + nx * (p.lane + p.dodge);
    p.z = p.cz + nz * (p.lane + p.dodge);
    p.yaw = Math.atan2(p.tx, p.tz);
  }

  const grid = new SpatialHash(2);

  function step(p, dt, player) {
    if (p.pace) { stepPace(p, dt); return; }
    if (!p.walk) return;
    if (p.pause > 0) {
      p.pause = Math.max(0, p.pause - dt);
      p.walking = false;
      return;
    }
    // Step around whoever is ahead (the player, people standing, other walkers): drift to the
    // side away from them and slow down, but never sideways into a wall.
    let push = 0, speed = p.speed;
    const others = grid.near(p.x, p.z, 1.6, p);
    if (player && (player.x - p.x) ** 2 + (player.z - p.z) ** 2 < 2.56) others.push(player);
    for (const q of others) {
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      const ahead = dx * p.tx + dz * p.tz;
      if (ahead < -0.3 || d > 1.6) continue;
      const side = dx * p.nx + dz * p.nz;
      push -= (Math.sign(side) || (p.i % 2 ? 1 : -1)) * (1.6 - d);
      speed *= d < 0.7 && ahead > 0 ? 0.35 : 0.8;
    }
    if (push) {
      const want = Math.max(-1.3, Math.min(1.3, p.dodge + push * dt * 2.2));
      if (open(p.cx + p.nx * (p.lane + want), p.cz + p.nz * (p.lane + want), 0.25)) p.dodge = want;
    } else if (p.dodge) {
      p.dodge -= Math.sign(p.dodge) * Math.min(Math.abs(p.dodge), dt * 0.5);
    }
    p.s += p.dir * speed * dt;
    if (p.s > p.route.len || p.s < 0) {
      p.dir *= -1;
      p.s = Math.max(0, Math.min(p.route.len, p.s));
      p.pause = 1 + Math.random() * 3;
    }
    placeOnRoute(p);
    p.stride = (p.stride || 0) + dt * speed * 5.2;
    p.walking = true;
  }

  function stepPace(p, dt) {
    const q = p.pace;
    if (q.rest > 0) { q.rest -= dt; p.walking = false; return; }
    q.t += q.dir * dt * 0.45 / 2.2;
    if (q.t >= 1 || q.t <= 0) { q.t = Math.max(0, Math.min(1, q.t)); q.dir *= -1; q.rest = 2 + Math.random() * 4; }
    p.x = q.a[0] + (q.b[0] - q.a[0]) * q.t;
    p.z = q.a[1] + (q.b[1] - q.a[1]) * q.t;
    p.yaw = Math.atan2((q.b[0] - q.a[0]) * q.dir, (q.b[1] - q.a[1]) * q.dir);
    p.stride = (p.stride || 0) + dt * 0.45 * 5.2;
    p.walking = true;
  }

  function pose(p, out, ph) {
    if (p.kind === 'waiting') {
      if (p.phone) { out.armR = [-1.05, -0.12]; out.headPitch = 0.35; }
      else out.headYaw = Math.sin(ph * 0.3) * 0.6;
    } else if (p.kind === 'group') {
      if (p.talk) {
        out.armL = [-0.4 - Math.sin(ph * 2.2) * 0.25, 0.12];
        out.armR = [-0.35 - Math.sin(ph * 2.7 + 1) * 0.3, -0.12];
      }
      out.headYaw = Math.sin(ph * 0.45) * 0.35;
    }
  }

  const figures = createFigures(people, { quality, groundAt: ground, pose, radius: 45 });
  return {
    ...figures,
    update(dt, player, camera) {
      grid.fill(people);
      figures.update(dt, player, camera, step);
    },
    /** Would the player's step from (fx, fz) to (x, z) walk into someone? */
    blocks: (x, z, fx, fz) => bodyBlocks(grid, x, z, fx, fz),
    grid,
  };
}
