import * as THREE from 'three';
import { NavGrid } from '../engine/nav.mjs';
import { Player } from '../engine/player.mjs';
import { Hud } from '../engine/hud.mjs';
import { Minimap } from '../engine/minimap.mjs';
import { buildEccv } from './scene.mjs';
import { EccvStory } from './story.mjs';
import { eccvMapView } from './map.mjs';

export { makeT } from './i18n.mjs';

export const meta = {
  title: { en: 'ECCV Poster Hall', zh: 'ECCV Poster 大厅' },
  kicker: 'ECCV 2026 · Malmömässan',
  heading: { en: 'Poster Session 6', zh: 'Poster Session 6' },
  failed: { en: 'The hall could not be loaded. ', zh: '场馆加载失败。' },
};

export const stageOptions = { background: '#c9d2d8', fog: ['#aeb3b6', 55, 210], environment: 0.5 };

function buildNav(world) {
  const { bounds, walkable, obstacles } = world;
  const nav = new NavGrid({ minX: bounds.x0 - 1, minZ: bounds.z0 - 1, maxX: bounds.x1 + 1, maxZ: bounds.z1 + 1, cell: 0.25, radius: 0.28 });
  nav.fillPolygon(walkable, 1);
  for (const poly of obstacles.polygons) nav.blockPolygon(poly);
  for (const [x1, z1, x2, z2, half] of obstacles.segments) nav.blockSegment(x1, z1, x2, z2, half);
  for (const [x, z, r] of obstacles.circles) nav.blockCircle(x, z, r);
  return nav;
}

export async function boot({ renderer, scene, camera, canvas, hudRoot, t, L, lang, quality, progress }) {
  await progress(L({ en: 'Reading the ECCV 2026 floor plan…', zh: '正在读取 ECCV 2026 平面图…' }), 0.2);
  const venue = await (await fetch('eccv/venue.json')).json();
  await progress(L({ en: 'Building Malmömässan…', zh: '正在搭建 Malmömässan…' }), 0.4);
  const world = buildEccv(venue, { quality, anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()) });
  scene.add(world.root);
  await progress(L({ en: 'Placing 477 posters and the crowd…', zh: '正在摆放 477 张 Poster 和人群…' }), 0.7);
  const nav = buildNav(world);
  const player = new Player(camera, canvas, nav, world.spawn);
  player.nav = nav;
  player.bodies = (x, z, fx, fz) => world.crowd.blocks(x, z, fx, fz);

  const hud = new Hud(hudRoot, { t, lang });
  const fullmap = hud.el('[data-fullmap]');
  const minimap = new Minimap({
    bounds: world.bounds,
    drawView: eccvMapView(venue, world.bounds),
    small: hud.el('[data-minimap-canvas]'),
    full: hud.el('[data-fullmap-canvas]'),
    onPick: (x, z) => { closeMap(); if (!story.tour) teleport(x, z); },
  });
  const story = new EccvStory({ world, venue, player, hud, minimap, camera, lang, t, L });

  function openMap() { fullmap.hidden = false; minimap.drawFull({ x: player.x, z: player.z, yaw: player.yaw }); }

  // Picking a spot on the map moves you there with a short fade; you walk on with W A S D.
  async function teleport(x, z) {
    const app = hudRoot.parentElement;
    app.classList.add('is-cut');
    await new Promise(r => setTimeout(r, 360));
    const spot = nav.nearestWalkable(x, z, 6) || [x, z];
    player.stop();
    player.x = spot[0]; player.z = spot[1];
    await new Promise(r => setTimeout(r, 120));
    app.classList.remove('is-cut');
  }
  function closeMap() { fullmap.hidden = true; }
  hud.el('[data-map-open]').addEventListener('click', openMap);
  hud.el('[data-map-close]').addEventListener('click', closeMap);
  hud.el('[data-overview]').addEventListener('click', () => player.setOverview(player.mode !== 'overview'));

  // A mouse click uses what is under the crosshair and within reach: a poster opens its card, a
  // person gets a greeting. It never walks you anywhere (W A S D does). A tap on a touch screen,
  // which has no keys, still walks you to the poster, the person or the spot.
  const raycaster = new THREE.Raycaster();
  const byInstance = new Map(world.boards.filter(b => b.instance !== undefined).map(b => [b.instance, b]));
  player.onClick = (nx, ny, { pointer = 'mouse' } = {}) => {
    if (story.tour) return;
    const touch = pointer === 'touch';
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const hit = raycaster.intersectObject(world.root, true).find(h => h.object.visible && !h.object.material?.transparent);
    if (!hit) return;
    const person = world.crowd.personAt(hit.object, hit.instanceId);
    if (person) {
      if (touch || hit.distance < 3.6) story.greet(person, { walk: touch });
      else hud.caption(L({ en: 'Walk closer to say hi.', zh: '走近一点再打招呼。' }), 1600);
      return;
    }
    let board = null;
    if (hit.object === world.posters.farMesh) board = byInstance.get(hit.instanceId);
    const slot = world.posters.pool.find(s => s.mesh === hit.object);
    if (slot) board = slot.board;
    if (board && venue.papers[String(board.n)]) {
      if (touch) {
        const [sx, sz] = world.standPoint(board);
        player.walkTo([sx, sz], { face: [board.x, world.poster.y, board.z] });
      } else if (hit.distance < 4.6) story.readPoster(board.n);
      else hud.caption(L({ en: 'Walk closer to read this poster.', zh: '走近一点再看这张 Poster。' }), 1600);
      return;
    }
    if (touch) player.walkTo([hit.point.x, hit.point.z]);
  };

  return {
    player, story, hud, minimap, openMap, closeMap,
    get mapOpen() { return !fullmap.hidden; },
    update(dt, now) {
      player.update(dt);
      world.update(dt, camera, now, player);
      story.update(dt, now);
    },
    debug: { world, nav, venue },
  };
}
