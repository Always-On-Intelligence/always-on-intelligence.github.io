import { MinHeap, NavGrid } from '../engine/nav.mjs';

// Two grids for a campus of a few square kilometres: a 1 m grid for collision and line of
// sight, and a 3 m cost grid for route search, where paths and roads cost less than grass.

const COARSE = 3;
const WALK = new Set(['footway', 'path', 'pedestrian', 'steps', 'cycleway', 'corridor', 'service', 'residential', 'unclassified', 'tertiary', 'secondary', 'primary', 'track']);

export class CampusNav {
  constructor(bounds, { buildings, water, roads, trees = [] }) {
    this.fine = new NavGrid({ minX: bounds.x0, minZ: bounds.z0, maxX: bounds.x1, maxZ: bounds.z1, cell: 1, radius: 0.3 });
    this.fine.cells.fill(1);
    for (const poly of buildings) this.fine.blockPolygon(poly);
    for (const poly of water) this.fine.blockPolygon(poly);
    // Tree trunks block walking but not sight: their cells are 3, buildings and water are 2.
    const f = this.fine;
    for (const [x, z] of trees) {
      const [ix, iz] = f.toCell(x, z);
      if (f.walkableCell(ix, iz)) f.cells[f.index(ix, iz)] = 3;
    }
    this.x0 = bounds.x0; this.z0 = bounds.z0;
    this.w = Math.ceil((bounds.x1 - bounds.x0) / COARSE);
    this.h = Math.ceil((bounds.z1 - bounds.z0) / COARSE);
    const n = this.w * this.h;
    this.cost = new Uint8Array(n);
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        const [x, z] = this.center(i, j);
        this.cost[j * this.w + i] = this.fine.walkable(x, z) ? 3 : 0;
      }
    }
    for (const r of roads) {
      if (!WALK.has(r.k)) continue;
      const pad = r.w / 2 + 1.5;
      for (let k = 0; k + 3 < r.p.length; k += 2) {
        const ax = r.p[k], az = r.p[k + 1], bx = r.p[k + 2], bz = r.p[k + 3];
        const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5));
        for (let s = 0; s <= steps; s++) {
          const x = ax + (bx - ax) * s / steps, z = az + (bz - az) * s / steps;
          for (let o = -pad; o <= pad; o += 1.5) {
            for (const [ox, oz] of [[o, 0], [0, o]]) {
              const [i, j] = this.cell(x + ox, z + oz);
              if (i < 0 || j < 0 || i >= this.w || j >= this.h) continue;
              const idx = j * this.w + i;
              if (this.cost[idx]) this.cost[idx] = 1;
            }
          }
        }
      }
    }
    this.g = new Float32Array(n);
    this.came = new Int32Array(n);
    this.seen = new Uint32Array(n);
    this.done = new Uint32Array(n);
    this.gen = 0;
  }

  cell(x, z) { return [Math.floor((x - this.x0) / COARSE), Math.floor((z - this.z0) / COARSE)]; }
  center(i, j) { return [this.x0 + (i + 0.5) * COARSE, this.z0 + (j + 0.5) * COARSE]; }
  walkable(x, z) { return this.fine.walkable(x, z); }

  /**
   * Mark the open ground connected to the main campus, starting from known open spots. Closed
   * courtyards and cells inside building complexes are left out, so jumps never land where
   * nobody can walk out.
   */
  computeReach(seeds) {
    const f = this.fine, n = f.w * f.h;
    const reach = new Uint8Array(n);
    const queue = new Int32Array(1 << 21), mask = queue.length - 1;
    let best = null;
    for (const [sx, sz] of seeds) {
      const start = f.nearestWalkable(sx, sz, 10);
      if (!start) continue;
      const [ix, iz] = f.toCell(start[0], start[1]);
      const s0 = f.index(ix, iz);
      if (reach[s0]) continue;
      let head = 0, tail = 0, size = 0;
      queue[tail++ & mask] = s0; reach[s0] = 1;
      while (head !== tail) {
        const c = queue[head++ & mask]; size++;
        const x = c % f.w;
        for (const d of [x > 0 ? -1 : 0, x < f.w - 1 ? 1 : 0, -f.w, f.w]) {
          const m = c + d;
          if (!d || m < 0 || m >= n || reach[m] || f.cells[m] !== 1) continue;
          reach[m] = 1; queue[tail++ & mask] = m;
        }
      }
      if (size > n * 0.3) { best = true; break; }
    }
    this.reach = best ? reach : null;
  }

  /** Nearest open cell connected to the main campus (falls back to any open cell). */
  nearestReachable(x, z, maxRadius = 160) {
    const f = this.fine;
    if (!this.reach) return f.nearestWalkable(x, z, maxRadius);
    const [cx, cz] = f.toCell(x, z);
    const ok = (ix, iz) => f.inBounds(ix, iz) && this.reach[f.index(ix, iz)] && f.cells[f.index(ix, iz)] === 1;
    if (ok(cx, cz)) return f.center(cx, cz);
    for (let ring = 1; ring <= maxRadius; ring++) {
      let best = null, bestD = Infinity;
      for (let d = -ring; d <= ring; d++) {
        for (const [ix, iz] of [[cx + d, cz - ring], [cx + d, cz + ring], [cx - ring, cz + d], [cx + ring, cz + d]]) {
          if (!ok(ix, iz)) continue;
          const dd = (ix - cx) ** 2 + (iz - cz) ** 2;
          if (dd < bestD) { bestD = dd; best = [ix, iz]; }
        }
      }
      if (best) return f.center(best[0], best[1]);
    }
    return f.nearestWalkable(x, z, 12);
  }

  /** Is (x, z) on the main campus network? */
  reachable(x, z) {
    const f = this.fine, [ix, iz] = f.toCell(x, z);
    return !!(f.inBounds(ix, iz) && f.cells[f.index(ix, iz)] === 1 && (!this.reach || this.reach[f.index(ix, iz)]));
  }
  /** A building or water at (x, z), as opposed to open ground or a tree. */
  solid(x, z) {
    const [ix, iz] = this.fine.toCell(x, z);
    return this.fine.inBounds(ix, iz) && this.fine.cells[this.fine.index(ix, iz)] === 2;
  }
  slide(x, z, dx, dz) { return this.fine.slide(x, z, dx, dz); }
  clear(x1, z1, x2, z2) { return this.fine.clear(x1, z1, x2, z2); }
  nearestWalkable(x, z, r) { return this.fine.nearestWalkable(x, z, r); }

  nearestCoarse(x, z) {
    const [ci, cj] = this.cell(x, z);
    for (let ring = 0; ring < 12; ring++) {
      for (let dj = -ring; dj <= ring; dj++) for (let di = -ring; di <= ring; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
        const i = ci + di, j = cj + dj;
        if (i >= 0 && j >= 0 && i < this.w && j < this.h && this.cost[j * this.w + i]) return j * this.w + i;
      }
    }
    return -1;
  }

  findPath(from, to) {
    const start = this.fine.nearestWalkable(from[0], from[1], 4) || from;
    const goal = this.reachable(start[0], start[1]) ? this.nearestReachable(to[0], to[1], 40) : this.fine.nearestWalkable(to[0], to[1], 25);
    if (!goal) return null;
    if (Math.hypot(goal[0] - start[0], goal[1] - start[1]) < 80 && this.clear(start[0], start[1], goal[0], goal[1])) return [[from[0], from[1]], goal];
    const s = this.nearestCoarse(start[0], start[1]), t = this.nearestCoarse(goal[0], goal[1]);
    if (s < 0 || t < 0) return null;
    const gen = ++this.gen;
    const { w, cost, g, came, seen, done } = this;
    const tx = t % w, tz = Math.floor(t / w);
    const h = (i, j) => { const dx = Math.abs(i - tx), dz = Math.abs(j - tz); return (dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz)); };
    const heap = new MinHeap();
    g[s] = 0; seen[s] = gen; came[s] = -1;
    heap.push(s, h(s % w, Math.floor(s / w)));
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    let found = false, expanded = 0;
    while (heap.size) {
      const cur = heap.pop();
      if (done[cur] === gen) continue;
      done[cur] = gen;
      if (cur === t) { found = true; break; }
      if (++expanded > 350000) break;
      const ci = cur % w, cj = (cur - ci) / w;
      for (const [di, dj, step] of dirs) {
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= w || nj >= this.h) continue;
        const nidx = nj * w + ni;
        const c = cost[nidx];
        if (!c || done[nidx] === gen) continue;
        if (di && dj && (!cost[cj * w + ni] || !cost[nj * w + ci])) continue;
        const ng = g[cur] + step * c;
        if (seen[nidx] !== gen || ng < g[nidx]) {
          seen[nidx] = gen; g[nidx] = ng; came[nidx] = cur;
          heap.push(nidx, ng + h(ni, nj));
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let i = t; i !== -1; i = came[i]) cells.push(i);
    cells.reverse();
    const raw = [[from[0], from[1]], ...cells.map(i => this.center(i % w, Math.floor(i / w))), goal];
    return this.smooth(raw);
  }

  smooth(points) {
    if (points.length <= 2) return points;
    const out = [points[0]];
    let anchor = 0;
    while (anchor < points.length - 1) {
      let next = Math.min(points.length - 1, anchor + 40);
      while (next > anchor + 1 && !this.clear(points[anchor][0], points[anchor][1], points[next][0], points[next][1])) next--;
      out.push(points[next]);
      anchor = next;
    }
    return out;
  }
}
