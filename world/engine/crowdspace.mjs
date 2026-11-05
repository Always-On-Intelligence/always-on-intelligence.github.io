// Keeping figures out of each other: a grid of who stands where, for spacing people when a scene
// places them, for walkers stepping around whoever is in their way, and for stopping the player
// from walking through someone.

export const BODY = 0.42;   // centre-to-centre distance below which two figures overlap

export class SpatialHash {
  constructor(cell = 2) {
    this.cell = cell;
    this.cells = new Map();
  }

  key(x, z) { return `${Math.floor(x / this.cell)}|${Math.floor(z / this.cell)}`; }

  clear() { this.cells.clear(); }

  add(p) {
    const k = this.key(p.x, p.z);
    let list = this.cells.get(k);
    if (!list) this.cells.set(k, list = []);
    list.push(p);
  }

  /** Everyone within r of (x, z), except `skip`. */
  near(x, z, r, skip = null) {
    const out = [];
    const c = this.cell, x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c), z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      for (const q of this.cells.get(`${i}|${j}`) || []) {
        if (q === skip || q.hidden) continue;
        if ((q.x - x) ** 2 + (q.z - z) ** 2 < r * r) out.push(q);
      }
    }
    return out;
  }

  /** Is there room for someone at (x, z), keeping `gap` from everyone already here? */
  free(x, z, gap = 0.62, skip = null) { return this.near(x, z, gap, skip).length === 0; }

  /** Rebuild from a list of people (visible ones only). */
  fill(people) {
    this.clear();
    for (const p of people) if (!p.hidden) this.add(p);
  }
}

/**
 * Would a step from (fromX, fromZ) to (x, z) walk the player into someone? Stepping away from a
 * person you already overlap is always allowed, so nobody can get stuck.
 */
export function bodyBlocks(hash, x, z, fromX, fromZ, r = 0.5) {
  for (const q of hash.near(x, z, r)) {
    if ((q.x - x) ** 2 + (q.z - z) ** 2 < (q.x - fromX) ** 2 + (q.z - fromZ) ** 2) return true;
  }
  return false;
}
