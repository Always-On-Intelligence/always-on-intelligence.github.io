import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { NavGrid, pointInPolygon } from '../world/engine/nav.mjs';
import { CampusNav } from '../world/ntu/nav.mjs';
import { ROOM, SPOTS } from '../world/ntu/places.mjs';
import { interiorFor } from '../world/ntu/kinds.mjs';
import { installTour, TOUR_ABORT } from '../world/engine/tour.mjs';

const venue = JSON.parse(readFileSync(new URL('../world/eccv/venue.json', import.meta.url), 'utf8'));
const route = [108, 175, 172, 402, 424];

test('eccv venue: 498 boards, the Session 6 program and the five demo posters', () => {
  assert.equal(venue.boards.length, 498);
  const numbers = new Set(venue.boards.map(b => b[0]));
  assert.equal(numbers.size, 498, 'board numbers are unique');
  assert.equal(Object.keys(venue.papers).length, 477);
  for (const n of Object.keys(venue.papers)) assert.ok(numbers.has(Number(n)), `paper #${n} sits on a board`);
  assert.deepEqual(venue.demo.route, route);
  const titles = {
    108: 'Towards Interactive Global Geolocation Assistant',
    175: 'OmniMapBench',
    172: 'Beyond Description',
    402: 'LaGen',
    424: '360CityArena',
  };
  for (const [n, start] of Object.entries(titles)) assert.ok(venue.papers[n].t.startsWith(start), `#${n} is ${start}`);
  venue.demo.visits.forEach((visit, i) => assert.equal(visit.board, route[i]));
  const booth44 = venue.booths.find(b => b.id === '44');
  assert.equal(booth44.name, 'Action Intelligence');
  assert.equal(venue.session.start, '15:00');
  assert.ok(venue.day.some(e => e.title === 'Poster Session 6' && e.start === '15:00'));
});

test('eccv venue: everything placed inside the building outline', () => {
  const inside = ([x, z]) => pointInPolygon(x, z, venue.envelope);
  for (const [n, x, z] of venue.boards) assert.ok(inside([x, z]), `board #${n}`);
  for (const b of venue.booths) for (const p of b.poly) assert.ok(inside(p), `booth ${b.id}`);
  for (const [x, z] of venue.coffee) assert.ok(inside([x, z]), 'coffee point');
  for (const [x, z] of venue.columns) assert.ok(inside([x, z]), 'column');
});

test('eccv venue: the guided walk can reach every stop from Booth 44', () => {
  const xs = venue.envelope.map(p => p[0]), zs = venue.envelope.map(p => p[1]);
  const nav = new NavGrid({ minX: Math.min(...xs) - 1, minZ: Math.min(...zs) - 1, maxX: Math.max(...xs) + 1, maxZ: Math.max(...zs) + 1, cell: 0.25, radius: 0.28 });
  nav.fillPolygon(venue.envelope, 1);
  for (const block of venue.blocks) nav.blockPolygon(block.poly);
  for (const room of venue.rooms) nav.blockPolygon(room.poly);
  for (const [x1, z1, x2, z2, , t] of venue.walls) nav.blockSegment(x1, z1, x2, z2, t / 2);
  for (const [x, z, sx, sz] of venue.columns) nav.blockCircle(x, z, Math.hypot(sx, sz) / 2);
  for (const [x, z] of venue.coffee) nav.blockCircle(x, z, 1.8);
  for (const row of venue.rows) for (const [x0, x1] of row.segments) nav.blockSegment(x0 + 0.03, row.z, x1 - 0.03, row.z, 0.1);
  const booth = venue.booths.find(b => b.id === '44');
  const bx = booth.poly.reduce((a, p) => a + p[0], 0) / booth.poly.length;
  const bz = Math.min(...booth.poly.map(p => p[1])) - 1.7;
  let from = [bx, bz];
  for (const n of route) {
    const [, x, z, side] = venue.boards.find(b => b[0] === n);
    const stand = [x, z + side * 1.45];
    assert.ok(nav.walkable(...stand), `stand point of #${n} is free`);
    const path = nav.findPath(from, stand);
    assert.ok(path, `path to #${n}`);
    const length = path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - path[i][0], p[1] - path[i][1]), 0);
    assert.ok(length < 80, `walk to #${n} stays direct (${length.toFixed(1)} m)`);
    from = stand;
  }
});

test('project page: both scenes load the three.js world; the Minecraft campus stays for local previews', () => {
  const embed = readFileSync(new URL('../demo/minecraft-embed.mjs', import.meta.url), 'utf8');
  assert.match(embed, /`world\/\?\$\{new URLSearchParams\(\{lang, scene: scene === 'eccv' \? 'eccv' : 'ntu'\}\)\}`/);
  assert.match(embed, /const minecraft = scene === 'singapore' && frameParams\.has\('campusPrototype'\)/);
  assert.match(embed, /`game\/\?\$\{frameParams\}`/);
  const html = readFileSync(new URL('../world/index.html', import.meta.url), 'utf8');
  assert.match(html, /"three": "\.\/vendor\/three\/three\.module\.min\.js"/);
});

const campus = JSON.parse(readFileSync(new URL('../world/ntu/campus.json', import.meta.url), 'utf8'));
const ring = (flatList) => flatList.reduce((out, v, i) => (i % 2 ? out[out.length - 1].push(v) : out.push([v]), out), []);

test('ntu campus: open data only, with the S-Lab address inside Academic Block North', () => {
  assert.equal(campus.buildings.length, 792);
  assert.ok(campus.attribution.some(a => /OpenStreetMap/.test(a) && /ODbL/.test(a)), 'OSM attribution');
  assert.ok(campus.attribution.some(a => /Copernicus/.test(a)), 'terrain attribution');
  assert.equal(JSON.stringify(campus).includes('ntumap'), false, 'no ntumap.app geometry');
  const loop = campus.loop.stops.map(s => s.n);
  assert.equal(loop.length, 13);
  assert.equal(loop[0], 'Blk 55');
  assert.equal(loop[12], 'Blk 55');
  assert.equal(loop[3], 'Lee Wee Nam Library');
  const hub = campus.buildings.find(b => b.n === 'UOB Innovation Hub');
  assert.ok(hub, 'The Hive appears under its current name');
  assert.ok(campus.places.find(p => p.name === 'UOB Innovation Hub').aliases.includes('The Hive'), 'the old name is kept as an alias');
  const abn = ring(campus.buildings.find(b => b.n === 'Academic Block North').p);
  const slab = campus.places.find(p => p.id === 's-lab');
  assert.ok(pointInPolygon(slab.x, slab.z, abn), 'S-Lab sits inside ABN');
  for (const [x, z] of [[ROOM.x0, ROOM.z0], [ROOM.x1, ROOM.z0], [ROOM.x1, ROOM.z1], [ROOM.x0, ROOM.z1]]) assert.ok(pointInPolygon(x, z, abn), `lab corner ${x}, ${z} inside ABN`);
  assert.ok(slab.x > ROOM.x0 && slab.x < ROOM.x1 && slab.z > ROOM.z0 && slab.z < ROOM.z1, 'the illustrative room contains the S-Lab point');
  for (const a of campus.areas.filter(a => a.k === 'track')) {
    const r = ring(a.p);
    const span = Math.max(Math.max(...r.map(p => p[0])) - Math.min(...r.map(p => p[0])), Math.max(...r.map(p => p[1])) - Math.min(...r.map(p => p[1])));
    assert.ok(span <= 250, 'jogging loops are not filled as running tracks');
  }
});

test('ntu day: every fixed spot is open ground, and the walks between them exist', () => {
  const buildings = campus.buildings.filter(b => b.k !== 'roof').map(b => ring(b.p));
  const water = campus.areas.filter(a => a.k === 'water').map(a => ring(a.p));
  const nav = new CampusNav(campus.bounds, { buildings, water, roads: campus.roads });
  const points = { hall: SPOTS.hall.stand, walkToStop: SPOTS.walkToStop, runFrom: SPOTS.runFrom, abnFrom: SPOTS.abn.from, abnDoor: SPOTS.abn.door, foodCourt: SPOTS.foodCourt.stand };
  for (const [name, [x, z]] of Object.entries(points)) assert.ok(nav.walkable(x, z), `${name} is walkable`);
  for (const [a, b] of [[SPOTS.hall.stand, SPOTS.walkToStop], [SPOTS.abn.from, SPOTS.abn.door]]) {
    const path = nav.findPath(a, b);
    assert.ok(path, 'path exists');
    const length = path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - path[i][0], p[1] - path[i][1]), 0);
    assert.ok(length < 1.5 * Math.hypot(b[0] - a[0], b[1] - a[1]) + 5, `walk stays direct (${length.toFixed(1)} m)`);
  }
});

test('ntu buildings: every building you walk into gets a room that fits it', () => {
  const find = (name) => campus.buildings.find(b => b.n === name);
  const kindOf = (b, at = null) => interiorFor(b, ring(b.p), campus.places, at).kind;
  assert.equal(kindOf(find('Nanyang Auditorium')), 'lecture');
  assert.equal(kindOf(find('Graduate Hall 1')), 'hall');
  assert.equal(kindOf(find('Sport Hall')), 'sports');
  // ADM is a lobby, unless you come in by the café mapped inside it.
  const adm = find('School of Art, Design and Media');
  assert.equal(kindOf(adm, [150, -136]), 'lobby');
  assert.deepEqual(interiorFor(adm, ring(adm.p), campus.places, [149, -250]), { kind: 'canteen', place: 'Art Pastry @ ADM' });
  // North Spine holds the library: entering by it shows the reading room, named after it.
  const lib = campus.places.find(p => p.name === 'Lee Wee Nam Library');
  const spine = campus.buildings.find(b => b.n === 'North Spine' && pointInPolygon(lib.x, lib.z, ring(b.p)));
  assert.deepEqual(interiorFor(spine, ring(spine.p), campus.places, [lib.x, lib.z]), { kind: 'library', place: 'Lee Wee Nam Library' });
  const court = campus.places.find(p => p.name === 'North Spine Food Court');
  const courtBuilding = campus.buildings.find(b => pointInPolygon(court.x, court.z, ring(b.p)));
  assert.equal(kindOf(courtBuilding, [court.x, court.z]), 'canteen');
});

test('ntu jumps: landings are open ground joined to the campus, never inside a building', () => {
  const buildings = campus.buildings.filter(b => b.k !== 'roof').map(b => ring(b.p));
  const water = campus.areas.filter(a => a.k === 'water').map(a => ring(a.p));
  const nav = new CampusNav(campus.bounds, { buildings, water, roads: campus.roads });
  nav.computeReach([[30, 205], [427, -938], [-202, -59], [-60, 200]]);
  assert.ok(nav.reach, 'the main campus network was found');
  for (const name of ['North Spine', 'Lee Wee Nam Library', 'UOB Innovation Hub', 'Canteen 2', 'Nanyang Auditorium', 'Academic Block North']) {
    const p = campus.places.find(q => q.name === name);
    const spot = nav.nearestReachable(p.x, p.z + 18, 160);
    assert.ok(spot, `${name}: a landing exists`);
    assert.ok(nav.reachable(spot[0], spot[1]), `${name}: the landing joins the campus`);
    assert.ok(!buildings.some(r => pointInPolygon(spot[0], spot[1], r)), `${name}: the landing is outside every building`);
  }
});

test('guided walk: skipping reaches the chosen scene with the same state, without waiting', async () => {
  const el = () => ({ hidden: false, textContent: '', innerHTML: '', dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, setAttribute() {} });
  const els = {};
  class Fake {
    constructor() {
      this.hud = { el: (s) => (els[s] ||= el()), root: { parentElement: el() }, muted: false, sheetOpen: false, caption() {} };
      this.player = { inputLocked: false, stop() {}, walkTo: async () => true, lookAt: async () => {}, nav: null, groundAt: () => 0, x: 0, z: 0 };
      this.t = (k) => k; this.L = (v) => (typeof v === 'string' ? v : v?.en);
      this.log = [];
    }
  }
  installTour(Fake.prototype, {
    async run() {
      for (const id of ['a', 'b', 'c']) {
        await this.chapter(id);
        this.log.push(id);
        await this.pause(60000);
        await this.walk([1, 2]);
      }
    },
  });
  const story = new Fake();
  story.bindTourUi([{ id: 'a', time: '1', title: 'A' }, { id: 'b', time: '2', title: 'B' }, { id: 'c', time: '3', title: 'C' }]);
  const started = Date.now();
  const running = story.startTour({ skipUntil: 'c' });
  while (story.chapterId !== 'c') await new Promise(r => setTimeout(r, 5));
  assert.ok(Date.now() - started < 1000, 'earlier scenes were skipped, not waited through');
  assert.equal(story.skipping, false, 'skipping stops at the chosen scene');
  assert.deepEqual(story.log, ['a', 'b', 'c'], 'every earlier scene still ran');
  story.stopTour();
  await running;
  assert.equal(story.tour, null);
  assert.ok(TOUR_ABORT);
});

test('crowd spacing: nobody is placed on top of someone, and the player cannot walk into a person', async () => {
  const { SpatialHash, bodyBlocks } = await import('../world/engine/crowdspace.mjs');
  const grid = new SpatialHash(2);
  const a = { x: 0, z: 0 }, b = { x: 5, z: 5 }, hidden = { x: 1, z: 1, hidden: true };
  grid.fill([a, b, hidden]);
  assert.equal(grid.free(0.3, 0.3), false, 'a spot next to someone is taken');
  assert.equal(grid.free(1, 1), true, 'hidden people take no room');
  assert.deepEqual(grid.near(4.8, 5.1, 0.5), [b]);
  assert.equal(bodyBlocks(grid, 0.3, 0, 1, 0), true, 'stepping towards someone is blocked');
  assert.equal(bodyBlocks(grid, 0.45, 0, 0.3, 0), false, 'stepping away from someone you touch is allowed');
});
