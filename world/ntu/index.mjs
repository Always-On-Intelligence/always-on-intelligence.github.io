import * as THREE from 'three';
import { pointInPolygon } from '../engine/nav.mjs';
import { Player } from '../engine/player.mjs';
import { Hud } from '../engine/hud.mjs';
import { Minimap } from '../engine/minimap.mjs';
import { buildNtu } from './scene.mjs';
import { CampusNav } from './nav.mjs';
import { createNtuCrowd } from './crowd.mjs';
import { ntuMapView } from './map.mjs';
import { NtuStory } from './story.mjs';
import { buildLab } from './lab.mjs';

export { makeT } from './i18n.mjs';

export const meta = {
  title: { en: 'NTU Campus', zh: 'NTU 校园' },
  kicker: 'NTU · Singapore',
  heading: { en: 'An S-Lab day', zh: 'S-Lab 的一天' },
  failed: { en: 'The campus could not be loaded. ', zh: '校园加载失败。' },
  aria: { en: 'NTU campus, first-person view through always-on glasses', zh: 'NTU 校园，透过常开眼镜的第一人称视角' },
};

export const stageOptions = { background: '#dde6ea', fog: ['#d6e0e5', 260, 2300], environment: 0.4, far: 4000 };

const JUMP_PLACES = ['S-Lab for Advanced Intelligence', 'Academic Block North', 'North Spine', 'Lee Wee Nam Library', 'UOB Innovation Hub', 'The Arc - Learning Hub North',
  'School of Art, Design and Media', 'South Spine', 'Canteen 2', 'Nanyang Auditorium', 'Chinese Heritage Centre', 'Yunnan Garden', 'Sports and Recreation Centre'];

export async function boot({ renderer, scene, camera, canvas, hudRoot, t, L, lang, quality, progress }) {
  await progress(L({ en: 'Reading the campus map…', zh: '正在读取校园地图…' }), 0.2);
  const campus = await (await fetch('ntu/campus.json')).json();
  await progress(L({ en: 'Raising 792 buildings and planting trees…', zh: '正在立起 792 栋楼、种树…' }), 0.35);
  const world = buildNtu(campus, { quality, anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()) });
  scene.add(world.root);
  await progress(L({ en: 'Mapping paths and walkways…', zh: '正在铺设道路和连廊…' }), 0.6);
  const nav = new CampusNav(campus.bounds, { buildings: world.obstacles.polygons, water: world.obstacles.water, roads: campus.roads, trees: world.obstacles.trees });
  // Open ground connected to the main campus, seeded from the spawn lawn and two bus stops, so
  // jumps never land inside a building complex or a closed courtyard.
  nav.computeReach([[30, 205], [427, -938], [-202, -59], [-60, 200]]);
  await progress(L({ en: 'Bringing students onto campus…', zh: '正在让学生们出门…' }), 0.8);
  const crowd = createNtuCrowd({ campus, ground: world.ground, nav, quality, extras: 3 });
  world.crowd = crowd;
  world.root.add(crowd.group);
  world.lab = buildLab({ ground: world.ground, quality });
  world.root.add(world.lab.group);

  // Start on the lawn south-east of Academic Block North, the building that houses S-Lab,
  // looking at it across the grass (checked by eye: far enough that it does not fill the view).
  const abn = campus.places.find(p => p.name === 'Academic Block North');
  const start = nav.nearestReachable(30, 205, 40) || [30, 205];
  const player = new Player(camera, canvas, nav, { x: start[0], z: start[1], yaw: Math.atan2(-(abn.x - start[0]), -(abn.z - start[1])), groundAt: world.ground });
  player.pitch = 0.04;
  player.nav = nav;
  // Nobody can be walked through: the campus crowd outside, the room's people inside.
  player.bodies = (x, z, fx, fz) => (story.inside ? story.room?.blocks?.(x, z, fx, fz) : crowd.blocks(x, z, fx, fz)) || false;

  const hud = new Hud(hudRoot, { t, lang });
  const fullmap = hud.el('[data-fullmap]');
  const labels = JUMP_PLACES.map(name => campus.places.find(p => p.name === name)).filter(Boolean)
    .map(p => ({ x: p.x, z: p.z, text: p.name.replace(' - Learning Hub North', '').replace('School of Art, Design and Media', 'ADM'), minor: !['S-Lab for Advanced Intelligence', 'North Spine', 'South Spine', 'UOB Innovation Hub'].includes(p.name) }));
  const minimap = new Minimap({
    bounds: campus.bounds,
    drawView: ntuMapView(campus, { labels }),
    small: hud.el('[data-minimap-canvas]'),
    full: hud.el('[data-fullmap-canvas]'),
    onPick: (x, z) => { closeMap(); if (!story.tour) story.jump(x, z, { caption: { en: 'Jumped there. Walk on with W A S D.', zh: '已跳到这里，用 W A S D 继续走。' } }); },
    smallView: 170,
  });
  const story = new NtuStory({ world, campus, player, hud, minimap, camera, lang, t, L, nav, scene, renderer, quality });

  // Walk there, or jump when it is far or no path gets there (never leave the click unanswered).
  async function goTo(x, z, face = null) {
    if (story.inside) { await story.leaveRoom(); }
    if (Math.hypot(x - player.x, z - player.z) > 280) { story.jump(x, z, { face, caption: { en: 'Jumped there to save the walk.', zh: '直接跳过去，省去步行。' } }); return; }
    player.walkTo([x, z], { speed: 2.0, face });
    if (player.noPath && !story.tour && Math.hypot(x - player.x, z - player.z) > 3) story.jump(x, z, { face, caption: { en: 'No path on foot; jumped there.', zh: '走不过去，直接跳过去了。' } });
  }

  // Place list inside the full map.
  const list = document.createElement('div');
  list.className = 'fullmap-places';
  list.innerHTML = `<p>${t('places')}</p><button type="button" data-lab>${L({ en: 'Inside S-Lab (illustrative)', zh: 'S-Lab 室内（示意）' })}</button>` + JUMP_PLACES.map(name => campus.places.find(p => p.name === name)).filter(Boolean)
    .map(p => `<button type="button" data-place="${p.name}">${p.name === 'UOB Innovation Hub' ? 'UOB Innovation Hub (The Hive)' : p.name}</button>`).join('');
  hud.el('.fullmap-card').append(list);
  list.addEventListener('click', (e) => {
    if (story.tour) return;
    if (e.target.closest('[data-lab]')) {
      closeMap();
      story.lastEntrance = { outside: [-66, 131], face: [-40, 131] };
      story.enterLab({ caption: { en: 'S-Lab, ABN level 2. The room is illustrative; walk out through the door or press E to leave.', zh: 'S-Lab，ABN 二层。室内是示意；从门走出去或按 E 离开。' } });
      return;
    }
    const name = e.target.closest('[data-place]')?.dataset.place;
    const p = campus.places.find(q => q.name === name);
    if (!p) return;
    closeMap();
    story.jump(p.x, p.z + 18, { face: [p.x, p.z] });
  });

  function openMap() { fullmap.hidden = false; minimap.drawFull({ x: player.x, z: player.z, yaw: player.yaw }); }
  function closeMap() { fullmap.hidden = true; }
  hud.el('[data-map-open]').addEventListener('click', openMap);
  hud.el('[data-map-close]').addEventListener('click', closeMap);
  hud.el('[data-overview]').addEventListener('click', () => player.setOverview(player.mode !== 'overview'));

  const raycaster = new THREE.Raycaster();
  raycaster.far = 400;
  // A mouse click uses what is under the crosshair and within reach: it greets someone in front of
  // you, and never walks you anywhere (W A S D does). A tap on a touch screen, which has no keys,
  // still walks you there.
  player.onClick = (nx, ny, { pointer = 'mouse' } = {}) => {
    if (story.tour) return;
    const touch = pointer === 'touch';
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const room = story.inside ? story.room : null;
    const hit = (room ? raycaster.intersectObjects(room.pickables, true) : raycaster.intersectObjects([crowd.group, ...world.root.children.filter(o => o.name === 'terrain' || o.userData.buildings)], true))
      .find(h => h.object.visible && !h.object.material?.transparent);
    if (!hit) return;
    const person = (room ? room.figures : crowd).personAt(hit.object, hit.instanceId);
    if (person) {
      if (touch || hit.distance < 3.6) story.greet(person, { walk: touch });
      else hud.caption(L({ en: 'Walk closer to say hi.', zh: '走近一点再打招呼。' }), 1600);
      return;
    }
    if (!touch) return;
    if (room) { player.walkTo([hit.point.x, hit.point.z], { speed: 1.5 }); return; }
    if (hit.object.userData.buildings) { approach(hit.point, raycaster.ray.direction); return; }
    goTo(hit.point.x, hit.point.z);
  };

  // Clicking a building walks you to its nearest wall, facing it, so the Enter prompt appears.
  function approach(point, dir) {
    const probe = [point.x + dir.x * 0.5, point.z + dir.z * 0.5];
    const inside = (b, x, z) => x >= b.box[0] && x <= b.box[2] && z >= b.box[1] && z <= b.box[3] && pointInPolygon(x, z, b.ring);
    const e = story.enterable.find(b => inside(b, probe[0], probe[1])) || story.enterable.find(b => inside(b, point.x, point.z));
    if (!e) { goTo(point.x, point.z); return; }
    // Nearest point of the footprint to where you stand, and the way out from it.
    let best = null;
    for (let i = 0; i < e.ring.length; i++) {
      const [ax, az] = e.ring[i], [bx, bz] = e.ring[(i + 1) % e.ring.length];
      const ex = bx - ax, ez = bz - az, len2 = ex * ex + ez * ez;
      if (len2 < 1) continue;
      const t = Math.max(0, Math.min(1, ((player.x - ax) * ex + (player.z - az) * ez) / len2));
      const qx = ax + ex * t, qz = az + ez * t, d = Math.hypot(player.x - qx, player.z - qz);
      if (!best || d < best.d) {
        const len = Math.sqrt(len2);
        let nx = -ez / len, nz = ex / len;
        if (pointInPolygon(qx + nx * 0.6, qz + nz * 0.6, e.ring)) { nx = -nx; nz = -nz; }
        best = { d, q: [qx, qz], out: [nx, nz] };
      }
    }
    story.entranceIntent = e;
    const stand = [best.q[0] + best.out[0] * 1.6, best.q[1] + best.out[1] * 1.6];
    goTo(stand[0], stand[1], [best.q[0], player.groundY + 1.64, best.q[1]]);
  }

  return {
    player, story, hud, minimap, openMap, closeMap,
    interact: () => story.interact(),
    get mapOpen() { return !fullmap.hidden; },
    update(dt, now) {
      player.update(dt);
      world.update(dt, camera);
      crowd.update(dt, player, camera);
      story.update(dt, now);
    },
    debug: { world, nav, campus },
  };
}
