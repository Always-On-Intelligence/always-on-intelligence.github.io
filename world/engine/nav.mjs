// Walkable grid for first-person movement and click-to-walk.
// Obstacles are rasterised once, inflated by the walker's radius, so a path
// through free cells is a path the camera can follow without clipping.

export class NavGrid {
  constructor({ minX, minZ, maxX, maxZ, cell = 0.25, radius = 0.32 }) {
    this.cell = cell;
    this.radius = radius;
    this.minX = minX;
    this.minZ = minZ;
    this.w = Math.ceil((maxX - minX) / cell);
    this.h = Math.ceil((maxZ - minZ) / cell);
    // 0 = outside, 1 = walkable, 2 = blocked
    this.cells = new Uint8Array(this.w * this.h);
  }

  index(ix, iz) { return iz * this.w + ix; }
  toCell(x, z) { return [Math.floor((x - this.minX) / this.cell), Math.floor((z - this.minZ) / this.cell)]; }
  center(ix, iz) { return [this.minX + (ix + 0.5) * this.cell, this.minZ + (iz + 0.5) * this.cell]; }
  inBounds(ix, iz) { return ix >= 0 && iz >= 0 && ix < this.w && iz < this.h; }

  walkable(x, z) {
    const [ix, iz] = this.toCell(x, z);
    return this.inBounds(ix, iz) && this.cells[this.index(ix, iz)] === 1;
  }

  walkableCell(ix, iz) {
    return this.inBounds(ix, iz) && this.cells[this.index(ix, iz)] === 1;
  }

  /** Mark every cell whose centre lies inside the polygon as walkable. */
  fillPolygon(poly, value = 1) {
    const zs = poly.map(p => p[1]);
    const [, iz0] = this.toCell(0, Math.min(...zs));
    const [, iz1] = this.toCell(0, Math.max(...zs));
    for (let iz = Math.max(0, iz0); iz <= Math.min(this.h - 1, iz1); iz++) {
      const z = this.minZ + (iz + 0.5) * this.cell;
      const xs = [];
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, zi] = poly[i];
        const [xj, zj] = poly[j];
        if ((zi > z) !== (zj > z)) xs.push(xi + (z - zi) * (xj - xi) / (zj - zi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const [ix0] = this.toCell(xs[k], z);
        const [ix1] = this.toCell(xs[k + 1], z);
        for (let ix = Math.max(0, ix0 + 1); ix <= Math.min(this.w - 1, ix1); ix++) {
          const cx = this.minX + (ix + 0.5) * this.cell;
          if (cx >= xs[k] && cx <= xs[k + 1]) this.cells[this.index(ix, iz)] = value;
        }
      }
    }
  }

  /** Block a segment of the given half thickness, inflated by the walker radius. */
  blockSegment(x1, z1, x2, z2, half = 0.05) {
    const pad = half + this.radius;
    const [ix0, iz0] = this.toCell(Math.min(x1, x2) - pad, Math.min(z1, z2) - pad);
    const [ix1, iz1] = this.toCell(Math.max(x1, x2) + pad, Math.max(z1, z2) + pad);
    const dx = x2 - x1, dz = z2 - z1;
    const len2 = dx * dx + dz * dz || 1e-9;
    for (let iz = Math.max(0, iz0); iz <= Math.min(this.h - 1, iz1); iz++) {
      for (let ix = Math.max(0, ix0); ix <= Math.min(this.w - 1, ix1); ix++) {
        const [cx, cz] = this.center(ix, iz);
        const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cz - z1) * dz) / len2));
        const ex = x1 + t * dx - cx, ez = z1 + t * dz - cz;
        if (ex * ex + ez * ez <= pad * pad) {
          const i = this.index(ix, iz);
          if (this.cells[i]) this.cells[i] = 2;
        }
      }
    }
  }

  blockCircle(x, z, r) {
    const pad = r + this.radius;
    const [ix0, iz0] = this.toCell(x - pad, z - pad);
    const [ix1, iz1] = this.toCell(x + pad, z + pad);
    for (let iz = Math.max(0, iz0); iz <= Math.min(this.h - 1, iz1); iz++) {
      for (let ix = Math.max(0, ix0); ix <= Math.min(this.w - 1, ix1); ix++) {
        const [cx, cz] = this.center(ix, iz);
        if ((cx - x) ** 2 + (cz - z) ** 2 <= pad * pad) {
          const i = this.index(ix, iz);
          if (this.cells[i]) this.cells[i] = 2;
        }
      }
    }
  }

  /** Block a polygon and its edges (edges are inflated like segments). */
  blockPolygon(poly) {
    const saved = [];
    const zs = poly.map(p => p[1]);
    const xsAll = poly.map(p => p[0]);
    const [ix0, iz0] = this.toCell(Math.min(...xsAll), Math.min(...zs));
    const [ix1, iz1] = this.toCell(Math.max(...xsAll), Math.max(...zs));
    for (let iz = Math.max(0, iz0); iz <= Math.min(this.h - 1, iz1); iz++) {
      for (let ix = Math.max(0, ix0); ix <= Math.min(this.w - 1, ix1); ix++) {
        const [cx, cz] = this.center(ix, iz);
        if (pointInPolygon(cx, cz, poly)) saved.push(this.index(ix, iz));
      }
    }
    for (const i of saved) if (this.cells[i]) this.cells[i] = 2;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      this.blockSegment(poly[j][0], poly[j][1], poly[i][0], poly[i][1], 0.02);
    }
  }

  /** Nearest walkable cell to (x, z), searching outwards in rings. */
  nearestWalkable(x, z, maxRadius = 12) {
    const [cx, cz] = this.toCell(x, z);
    if (this.walkableCell(cx, cz)) return this.center(cx, cz);
    const maxRing = Math.ceil(maxRadius / this.cell);
    for (let ring = 1; ring <= maxRing; ring++) {
      let best = null, bestD = Infinity;
      for (let dz = -ring; dz <= ring; dz++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          if (!this.walkableCell(cx + dx, cz + dz)) continue;
          const d = dx * dx + dz * dz;
          if (d < bestD) { bestD = d; best = [cx + dx, cz + dz]; }
        }
      }
      if (best) return this.center(best[0], best[1]);
    }
    return null;
  }

  /** Straight line of walkable cells between two world points. */
  clear(x1, z1, x2, z2) {
    const steps = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / (this.cell * 0.5));
    for (let s = 0; s <= steps; s++) {
      const t = steps ? s / steps : 0;
      if (!this.walkable(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t)) return false;
    }
    return true;
  }

  /** A* over the 8-connected grid; returns a smoothed list of world points or null. */
  findPath(from, to) {
    const start = this.nearestWalkable(from[0], from[1], 3);
    const goal = this.nearestWalkable(to[0], to[1], 12);
    if (!start || !goal) return null;
    const [sx, sz] = this.toCell(start[0], start[1]);
    const [gx, gz] = this.toCell(goal[0], goal[1]);
    const n = this.w * this.h;
    const g = new Float32Array(n).fill(Infinity);
    const came = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const heap = new MinHeap();
    const startI = this.index(sx, sz), goalI = this.index(gx, gz);
    const h = (ix, iz) => {
      const dx = Math.abs(ix - gx), dz = Math.abs(iz - gz);
      return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz);
    };
    g[startI] = 0;
    heap.push(startI, h(sx, sz));
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    let found = false;
    let expanded = 0;
    while (heap.size) {
      const cur = heap.pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === goalI) { found = true; break; }
      if (++expanded > 400000) break;
      const cx = cur % this.w, cz = (cur - cx) / this.w;
      for (const [dx, dz, cost] of dirs) {
        const nx = cx + dx, nz = cz + dz;
        if (!this.walkableCell(nx, nz)) continue;
        if (dx && dz && (!this.walkableCell(cx + dx, cz) || !this.walkableCell(cx, cz + dz))) continue;
        const ni = this.index(nx, nz);
        if (closed[ni]) continue;
        const ng = g[cur] + cost;
        if (ng < g[ni]) {
          g[ni] = ng;
          came[ni] = cur;
          heap.push(ni, ng + h(nx, nz));
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let i = goalI; i !== -1; i = came[i]) cells.push(i);
    cells.reverse();
    const raw = cells.map(i => this.center(i % this.w, Math.floor(i / this.w)));
    raw[0] = [from[0], from[1]];
    raw[raw.length - 1] = goal;
    return this.smooth(raw);
  }

  smooth(points) {
    if (points.length <= 2) return points;
    const out = [points[0]];
    let anchor = 0;
    while (anchor < points.length - 1) {
      let next = points.length - 1;
      while (next > anchor + 1 && !this.clear(points[anchor][0], points[anchor][1], points[next][0], points[next][1])) next--;
      out.push(points[next]);
      anchor = next;
    }
    return out;
  }

  /** Move from (x, z) by (dx, dz), sliding along blocked cells. */
  slide(x, z, dx, dz) {
    if (this.walkable(x + dx, z + dz)) return [x + dx, z + dz];
    if (this.walkable(x + dx, z)) return [x + dx, z];
    if (this.walkable(x, z + dz)) return [x, z + dz];
    return [x, z];
  }
}

export function pointInPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < xi + (z - zi) * (xj - xi) / (zj - zi)) inside = !inside;
  }
  return inside;
}

export class MinHeap {
  constructor() { this.items = []; this.keys = []; }
  get size() { return this.items.length; }
  push(item, key) {
    const items = this.items, keys = this.keys;
    let i = items.length;
    items.push(item); keys.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= key) break;
      items[i] = items[p]; keys[i] = keys[p];
      i = p;
    }
    items[i] = item; keys[i] = key;
  }
  pop() {
    const items = this.items, keys = this.keys;
    const top = items[0];
    const lastItem = items.pop(), lastKey = keys.pop();
    if (items.length) {
      let i = 0;
      const n = items.length;
      while (true) {
        let l = 2 * i + 1, r = l + 1, m = i;
        let mk = lastKey;
        if (l < n && keys[l] < mk) { m = l; mk = keys[l]; }
        if (r < n && keys[r] < mk) { m = r; mk = keys[r]; }
        if (m === i) break;
        items[i] = items[m]; keys[i] = keys[m];
        i = m;
      }
      items[i] = lastItem; keys[i] = lastKey;
    }
    return top;
  }
}
