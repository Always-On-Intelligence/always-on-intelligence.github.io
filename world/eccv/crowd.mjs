import { createFigures, makePerson, seeded } from '../engine/figures.mjs';
import { SpatialHash, bodyBlocks } from '../engine/crowdspace.mjs';

// Poster Session 6 crowd: presenters explain and point at their posters, listeners nod and
// drift to another board on the same row, walkers pace the aisles, staff and coffee chats idle.
// Nobody is placed inside furniture or on top of someone else; walkers step around people in
// the aisle, listeners only move along a clear line, and the player cannot walk through anyone.

export function createCrowd({ boards, papers, booths, coffee, rows, keepClear = [], solid = () => false, furniture = [], quality = 'high', seed = 42, busy = {}, extras = 0 }) {
  const random = seeded(seed);
  const people = [];
  const placed = new SpatialHash(2);
  const clear = (x, z) => keepClear.every(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 > r * r);
  const add = (x, z, yaw, kind, extra = {}, force = false) => {
    if (!force && (!clear(x, z) || solid(x, z) || !placed.free(x, z, 0.62))) return null;
    const person = makePerson(random, x, z, yaw, kind, extra);
    people.push(person);
    if (!extra.hidden) placed.add(person);
    return person;
  };
  const density = quality === 'low' ? 0.5 : 1;
  const solidWall = (x, z) => solid(x, z, 0.22, { walls: true });
  const boardByN = new Map(boards.map(b => [b.n, b]));

  // Presenters and listeners at posters.
  for (const b of boards) {
    if (!papers[String(b.n)]) continue;
    const demo = b.demo === true;
    if (!demo && random() > 0.52 * density) continue;
    const first = demo ? -b.side : random() > 0.5 ? 1 : -1;
    const along = demo ? 0.98 : 0.98 + random() * 0.12, front = 0.5 + random() * 0.15;
    let presenter = null;
    // Stand beside the poster, on whichever side is free (neighbouring presenters share the gap).
    for (const s of demo ? [first] : [first, -first]) {
      const px = b.x + s * along, pz = b.z + b.side * front;
      presenter = add(px, pz, Math.atan2(b.x - px, b.z + b.side * 1.6 - pz) + (random() - 0.5) * 0.3, 'presenter', { board: b.n });
      if (presenter) break;
    }
    if (!presenter) continue;
    if (busy[b.n]) {
      // A crowded poster: listeners stand where you would, so the presenter is busy.
      [[-0.45, 1.35], [0.35, 1.55], [1.05, 1.3], [-1.1, 1.6]].slice(0, busy[b.n]).forEach(([dx, dz]) => {
        const lx = b.x + dx, lz = b.z + b.side * dz;
        add(lx, lz, Math.atan2(b.x - lx, b.z - lz) + (random() - 0.5) * 0.25, 'visitor', { busyAt: b.n, board: b.n, fixed: true }, true);
      });
      continue;
    }
    const listeners = demo ? (random() > 0.5 ? 1 : 0) : [0, 0, 1, 1, 1, 2, 2, 3][Math.floor(random() * 8)];
    for (let i = 0; i < listeners; i++) {
      for (let k = 0; k < 5; k++) {
        let lx = b.x + (random() - 0.5) * 1.5, lz = b.z + b.side * (1.25 + random() * 0.8);
        if (demo) { lx = b.x + b.side * (0.9 + random() * 0.3); lz = b.z + b.side * (1.4 + random() * 0.4); }
        if (add(lx, lz, Math.atan2(b.x - lx, b.z - lz) + (random() - 0.5) * 0.35, 'visitor', { board: b.n, fixed: demo })) break;
      }
    }
  }

  // Walkers along the aisles between poster rows.
  const aisles = [];
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i], b = rows[i + 1];
    const x0 = Math.max(Math.min(...a.segments.flat()), Math.min(...b.segments.flat())) + 1;
    const x1 = Math.min(Math.max(...a.segments.flat()), Math.max(...b.segments.flat())) - 1;
    if (x1 - x0 > 6) aisles.push({ z: (a.z + b.z) / 2, x0, x1, width: b.z - a.z });
  }
  const walkerCount = quality === 'low' ? 26 : 58;
  for (let i = 0, tries = 0; i < walkerCount && tries < walkerCount * 8; tries++) {
    const aisle = aisles[Math.floor(random() * aisles.length)];
    const lane = (random() - 0.5) * Math.max(0.4, aisle.width - 2.4);
    const x = aisle.x0 + random() * (aisle.x1 - aisle.x0);
    const dir = random() > 0.5 ? 1 : -1;
    if (add(x, aisle.z + lane, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 'walker', { aisle, lane, dodge: 0, dir, speed: 0.85 + random() * 0.45, pause: 0, walk: true, moving: true })) i++;
  }

  // Booth staff and visitors.
  for (const booth of booths) {
    if (!booth.front) continue;
    const { cx, cz, nx, nz, depth } = booth.front;
    // Staff stand beside the counter, not in it and not in front of the screen on the back wall.
    const inset = Math.min(0.9, depth * 0.3), first = random() > 0.5 ? 1 : -1;
    let staff = null;
    for (const back of [inset, inset + 0.3, inset - 0.2]) {
      for (const side of [1.25, 1.05, 1.45, 0.9]) {
        for (const s of [first, -first]) {
          const along = s * side;
          const sx = cx - nx * back + nz * along, sz = cz - nz * back + nx * along;
          staff = add(sx, sz, Math.atan2(nx, nz) - along * 0.2, 'staff', { booth: booth.id, boothName: booth.name, boothKind: booth.kind });
          if (staff) break;
        }
        if (staff) break;
      }
      if (staff) break;
    }
    const visitors = booth.kind === 'merch' ? 2 : Math.floor(random() * 3 * density);
    for (let i = 0; i < visitors; i++) {
      for (let k = 0; k < 5; k++) {
        const tx = cx + nx * (0.9 + random() * 0.8) + (random() - 0.5) * 1.6 * Math.abs(nz);
        const tz = cz + nz * (0.9 + random() * 0.8) + (random() - 0.5) * 1.6 * Math.abs(nx);
        if (add(tx, tz, Math.atan2(-nx, -nz) + (random() - 0.5) * 0.5, 'visitor', { fixed: true, booth: booth.id })) break;
      }
    }
  }

  // Coffee chats.
  for (const [x, z, r] of coffee) {
    const n = Math.round((3 + random() * 4) * density);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 5; k++) {
        const a = random() * Math.PI * 2, d = r * (0.62 + random() * 0.18);
        const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
        // The bar and its tables are obstacles themselves, so only walls and other people count here.
        if (!clear(px, pz) || !placed.free(px, pz, 0.62) || solidWall(px, pz)) continue;
        add(px, pz, Math.atan2(x - px, z - pz) + (random() - 0.5) * 1.2, 'coffee', { cup: random() > 0.35 }, true);
        break;
      }
    }
  }

  // Reserved figures the story can bring in, such as a colleague (a registered contact).
  for (let i = 0; i < extras; i++) add(0, 0, 0, 'extra', { hidden: true, registered: true, shirt: '#6c5f7a', pants: '#2b3340', scripted: true }, true);

  const posterCenter = (n) => { const b = boardByN.get(n); return b ? [b.x, b.z] : null; };
  const grid = new SpatialHash(2);
  // Columns, counters, the coffee bars and their tables, which walkers steer round like people.
  const fixtures = new SpatialHash(3);
  for (const [x, z, r] of furniture) fixtures.add({ x, z, r });

  function pose(p, out, ph, relYaw) {
    if (p.kind === 'presenter') {
      const c = posterCenter(p.board);
      if ((ph * 0.22) % 3 < 1 && c) {
        const toPoster = relYaw(p, c[0], c[1]);
        out.headYaw = Math.max(-1.1, Math.min(1.1, toPoster));
        if (toPoster > 0) out.armL = [-1.2 - Math.sin(ph * 2) * 0.08, 0.55];
        else out.armR = [-1.2 - Math.sin(ph * 2) * 0.08, -0.55];
      } else {
        out.armL = [-0.45 - Math.sin(ph * 2.3) * 0.25, 0.12];
        out.armR = [-0.35 - Math.sin(ph * 2.9 + 1) * 0.3, -0.12];
        out.headYaw = Math.sin(ph * 0.5) * 0.35;
      }
    } else if (p.kind === 'visitor') {
      out.headPitch = 0.05 + (Math.sin(ph * 0.55) > 0.93 ? Math.sin(ph * 9) * 0.12 : 0);
      if (p.i % 3 === 0) { out.armL = [-0.95, -0.35]; out.armR = [-0.95, 0.35]; }
      else if (p.i % 5 === 1) out.armR = [-1.0, -0.1];
    } else if (p.kind === 'staff') {
      out.armR = [-0.35 - Math.max(0, Math.sin(ph * 1.7)) * 0.5, -0.1];
      out.headYaw = Math.sin(ph * 0.4) * 0.5;
    } else if (p.kind === 'coffee') {
      if (p.cup) out.armR = [-1.05, -0.12];
      out.armL = [-0.2 - Math.max(0, Math.sin(ph * 1.3)) * 0.35, 0.1];
      out.headYaw = Math.sin(ph * 0.35) * 0.45;
    }
  }

  function step(p, dt, player) {
    if (p.walk) {
      if (p.pause > 0) {
        p.pause = Math.max(0, p.pause - dt);
        p.walking = false;
        return;
      }
      // Step around people in the aisle (and the player): shift lanes away from them and slow
      // down; if both sides are taken, wait, and turn back after a while.
      let push = 0, blocked = false;
      const others = grid.near(p.x, p.z, 1.6, p);
      if (player && (player.x - p.x) ** 2 + (player.z - p.z) ** 2 < 2.56) others.push(player);
      // People count with a body radius of about 0.22 m, fixtures with their own radius.
      const avoid = (q, r) => {
        const ahead = (q.x - p.x) * p.dir, dz = q.z - p.z, reach = r + 0.58;
        if (ahead < -0.2 || ahead > 1.4 + r || Math.abs(dz) > reach) return;
        push -= (Math.sign(dz) || (p.i % 2 ? 1 : -1)) * (reach - Math.abs(dz)) * (1.4 + r - Math.max(0, ahead)) / (1.4 + r);
        if (ahead < r + 0.42 && Math.abs(dz) < r + 0.26) blocked = true;
      };
      for (const q of others) avoid(q, 0.22);
      for (const c of fixtures.near(p.x, p.z, 4)) avoid(c, c.r);
      const room = Math.max(0.2, p.aisle.width / 2 - 1.15);
      if (push) p.dodge = Math.max(-room - p.lane, Math.min(room - p.lane, p.dodge + push * dt * 3));
      else if (p.dodge) p.dodge -= Math.sign(p.dodge) * Math.min(Math.abs(p.dodge), dt * 0.4);
      p.z = p.aisle.z + p.lane + p.dodge;
      if (blocked) {
        p.walking = false;
        p.stuck = (p.stuck || 0) + dt;
        if (p.stuck > 2.5) { p.dir *= -1; p.stuck = 0; p.yaw = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
        return;
      }
      p.stuck = 0;
      const speed = p.speed * (push ? 0.7 : 1);
      p.x += p.dir * speed * dt;
      if (p.x > p.aisle.x1 || p.x < p.aisle.x0) {
        p.dir *= -1;
        p.x = Math.min(p.aisle.x1, Math.max(p.aisle.x0, p.x));
        p.pause = 0.5 + Math.random() * 1.5;
      }
      p.yaw = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      p.stride = (p.stride || 0) + dt * speed * 5.2;
      p.walking = true;
    } else if (p.kind === 'visitor' && !p.fixed && quality !== 'low') {
      // Listeners drift along the aisle to another board on the same row.
      p.idle = (p.idle ?? 8 + Math.random() * 30) - dt;
      if (p.drift) {
        // Hold while someone is right in the way (a walker crossing, the player).
        const dir = Math.sign(p.drift.to - p.drift.from);
        if (grid.near(p.x + dir * 0.4, p.z, 0.52, p).length || (player && Math.hypot(player.x - (p.x + dir * 0.4), player.z - p.z) < 0.52)) { p.walking = false; return; }
        p.drift.t = Math.min(1, p.drift.t + dt / p.drift.dur);
        p.x = p.drift.from + (p.drift.to - p.drift.from) * p.drift.t;
        p.stride = (p.stride || 0) + dt * 4.4;
        p.walking = true;
        p.yaw = p.drift.to > p.drift.from ? Math.PI / 2 : -Math.PI / 2;
        if (p.drift.t >= 1) {
          p.walking = false;
          p.moving = false;
          p.board = p.drift.board;
          const c = posterCenter(p.board);
          if (c) p.yaw = p.baseYaw = Math.atan2(c[0] - p.x, c[1] - p.z);
          p.drift = null;
          p.idle = 15 + Math.random() * 35;
        }
      } else if (p.idle <= 0) {
        const b = boardByN.get(p.board);
        const options = b ? boards.filter(o => o.side === b.side && Math.abs(o.z - b.z) < 0.01 && Math.abs(o.x - b.x) > 2 && Math.abs(o.x - b.x) < 12 && papers[String(o.n)]) : [];
        // Move only to a free spot along a clear line: nobody standing in between.
        const target = options.length ? options[Math.floor(Math.random() * options.length)] : null;
        const tx = target ? target.x + (Math.random() - 0.5) * 1.2 : 0;
        let lineClear = target && grid.free(tx, p.z, 0.65, p) && !people.some(q => q !== p && !q.hidden && !q.walk && Math.abs(q.z - p.z) < 0.5 && (q.x - p.x) * (q.x - tx) < 0);
        // ...and no column or counter on the way.
        for (let k = 0; lineClear && k <= 10; k++) if (solid(p.x + (tx - p.x) * k / 10, p.z, 0.2)) lineClear = false;
        if (lineClear) {
          p.drift = { from: p.x, to: tx, t: 0, dur: Math.max(0.5, Math.abs(tx - p.x) / 0.9), board: target.n };
          p.moving = true;
        } else p.idle = options.length ? 6 + Math.random() * 10 : 30;
      }
    }
  }

  const figures = createFigures(people, { quality, pose });
  const obstacles = people.filter(p => !p.hidden && (p.kind === 'presenter' || p.kind === 'staff' || p.kind === 'coffee' || (p.kind === 'visitor' && p.fixed && !p.busyAt))).map(p => [p.x, p.z, 0.2]);
  return {
    ...figures,
    obstacles,
    update(dt, player, camera) {
      grid.fill(people);
      figures.update(dt, player, camera, step);
    },
    /** Would the player's step from (fx, fz) to (x, z) walk into someone? */
    blocks: (x, z, fx, fz) => bodyBlocks(grid, x, z, fx, fz),
    grid,
  };
}
