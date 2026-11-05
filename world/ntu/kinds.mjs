import { pointInPolygon } from '../engine/nav.mjs';

// Which illustrative room a building gets, kept free of three.js so tests can load it.

const FOOD = new Set(['food_court', 'restaurant', 'cafe', 'fast_food']);

/**
 * Which room to show: from the building's name and OSM kind, or from a library or food place
 * mapped inside it near the door you use (big blocks like North Spine hold several).
 */
export function interiorKind(b, ring, places, entrance = null) {
  return interiorFor(b, ring, places, entrance).kind;
}

/** The kind of room, and the mapped place it stands for when one decided it (e.g. a library inside North Spine). */
export function interiorFor(b, ring, places, entrance = null) {
  const n = b.n || '';
  if (/library/i.test(n)) return { kind: 'library' };
  if (/canteen|food court|koufu|restaurant|caf[eé]|starbucks/i.test(n)) return { kind: 'canteen' };
  if (/auditorium|lecture theatre|\bLT\d*\b/i.test(n)) return { kind: 'lecture' };
  if (/sport|recreation|gym|wave|swimming|pool|stadium/i.test(n) || b.k === 'sports_hall' || b.k === 'sports_centre') return { kind: 'sports' };
  if (/hall|residence|crescent|saraca|tamarind|binjai|banyan|tanjong|pioneer|graduate/i.test(n) || b.k === 'dormitory') return { kind: 'hall' };
  let best = null, bestD = entrance ? 45 : Infinity;
  for (const p of places) {
    if (!(FOOD.has(p.kind) || p.kind === 'library') || !pointInPolygon(p.x, p.z, ring)) continue;
    const d = entrance ? Math.hypot(p.x - entrance[0], p.z - entrance[1]) : 0;
    if (d < bestD) { bestD = d; best = p; }
  }
  if (best) return { kind: best.kind === 'library' ? 'library' : 'canteen', place: best.name };
  if (['residential', 'apartments', 'house', 'detached', 'terrace'].includes(b.k) || /^blk\b|\bblock \d/i.test(n)) return { kind: 'home' };
  return { kind: 'lobby' };
}
