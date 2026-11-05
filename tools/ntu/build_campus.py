"""Build world/ntu/campus.json, the NTU open world, from open data only.

Sources
- OpenStreetMap snapshot game/maps/ntu-campus-v2/ntu-core-osm.json (2026-09-16), with
  building tags refreshed from tools/ntu/data/osm-building-tags-20260928.json.
  © OpenStreetMap contributors, ODbL 1.0.
- Terrain: Mapterhorn tile z12/3227/2032 (Copernicus GLO-30 DEM, terrarium encoding),
  tools/ntu/data/mapterhorn-z12-3227-2032.webp.
- NTU's public shuttle page for the Campus Loop Red stop order.

ntumap.app, MazeMap and NTU VirCampus are not used: their terms do not allow
redistribution. Frame: metres, x = (lon - 103.6825) * 111288.7 (east),
z = (1.3475 - lat) * 111319.5 (south); the same frame as the earlier campus map.

Usage: python3 tools/ntu/build_campus.py
"""

import heapq
import json
import math
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
OSM = REPO / 'game/maps/ntu-campus-v2/ntu-core-osm.json'
TAGS = REPO / 'tools/ntu/data/osm-building-tags-20260928.json'
DEM = REPO / 'tools/ntu/data/mapterhorn-z12-3227-2032.webp'
OUT = REPO / 'world/ntu/campus.json'

LAT0, LON0, KX, KZ = 1.3475, 103.6825, 111288.7, 111319.5
TILE_Z, TILE_X, TILE_Y = 12, 3227, 2032
STEP = 10.0  # terrain grid spacing, metres


def xz(lat, lon):
    return ((lon - LON0) * KX, (LAT0 - lat) * KZ)


def r1(value):
    return round(value, 1)


def tile_lonlat(px, py, size):
    n = 2 ** TILE_Z
    lon = (TILE_X + px / size) / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (TILE_Y + py / size) / n))))
    return lat, lon


def load_dem():
    image = Image.open(DEM).convert('RGB')
    size = image.size[0]
    pixels = image.load()
    lat_top, lon_left = tile_lonlat(0, 0, size)
    lat_bottom, lon_right = tile_lonlat(size, size, size)

    def elevation(lat, lon):
        # Web Mercator y, then bilinear sampling of the terrarium-encoded pixels.
        fx = (lon - lon_left) / (lon_right - lon_left) * size - 0.5
        n = 2 ** TILE_Z
        merc = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
        fy = (merc - TILE_Y) * size - 0.5
        x0, y0 = int(math.floor(fx)), int(math.floor(fy))
        tx, ty = fx - x0, fy - y0

        def h(x, y):
            x = min(size - 1, max(0, x))
            y = min(size - 1, max(0, y))
            r, g, b = pixels[x, y]
            return r * 256 + g + b / 256 - 32768

        top = h(x0, y0) * (1 - tx) + h(x0 + 1, y0) * tx
        bottom = h(x0, y0 + 1) * (1 - tx) + h(x0 + 1, y0 + 1) * tx
        return top * (1 - ty) + bottom * ty

    assert lat_bottom < 1.337 < 1.3633 < lat_top, 'terrain tile does not cover the campus'
    return elevation


def ring_area(points):
    return sum(x0 * z1 - x1 * z0 for (x0, z0), (x1, z1) in zip(points, points[1:] + points[:1])) / 2


def clean_ring(points):
    out = []
    for p in points:
        if not out or math.dist(out[-1], p) > 0.3:
            out.append(p)
    if len(out) > 2 and math.dist(out[0], out[-1]) < 0.3:
        out.pop()
    return out


def default_levels(kind):
    return {'university': 5, 'college': 4, 'school': 3, 'residential': 9, 'apartments': 12, 'dormitory': 8,
            'house': 2, 'bungalow': 1, 'commercial': 3, 'retail': 2, 'office': 6, 'roof': 1, 'substation': 1,
            'construction': 2, 'barracks': 3, 'hospital': 5, 'civic': 3, 'sports_hall': 2, 'garage': 1,
            'parking': 4, 'church': 2, 'temple': 2, 'hut': 1, 'shed': 1, 'service': 1}.get(kind, 3)


ROAD_WIDTH = {'motorway': 14, 'motorway_link': 7, 'trunk': 12, 'primary': 11, 'primary_link': 6, 'secondary': 9,
              'secondary_link': 5, 'tertiary': 8, 'tertiary_link': 5, 'residential': 6.5, 'unclassified': 6,
              'service': 4.5, 'track': 3, 'pedestrian': 4, 'footway': 2.2, 'path': 1.8, 'cycleway': 2.5,
              'steps': 2.2, 'corridor': 2.5, 'construction': 4}
DRIVEABLE = {'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'residential',
             'unclassified', 'service'}
AREA_KIND = {('landuse', 'grass'): 'grass', ('landuse', 'recreation_ground'): 'grass', ('leisure', 'park'): 'park',
             ('leisure', 'garden'): 'park', ('landuse', 'forest'): 'forest', ('natural', 'wood'): 'forest',
             ('natural', 'scrub'): 'forest', ('natural', 'grassland'): 'grass', ('natural', 'water'): 'water',
             ('water', 'pond'): 'water', ('landuse', 'reservoir'): 'water', ('leisure', 'pitch'): 'pitch',
             ('leisure', 'track'): 'track', ('amenity', 'parking'): 'parking', ('leisure', 'playground'): 'plaza',
             ('leisure', 'swimming_pool'): 'water', ('landuse', 'construction'): 'bare'}

# Campus Loop Red, in the order published on NTU's internal shuttle page, matched to OSM stop names.
LOOP_RED = ['Blk 55', 'Nanyang Crescent Hall', 'Hall 12', 'Lee Wee Nam Library', 'School of Biological Sciences',
            'Wee Kim Wee School Of Communications And Information', 'School of PMS', 'Opposite Yunnan Garden',
            'Hall 4', 'Hall 1', 'Opposite Hall 2', 'Hall 8', 'Blk 55']

# Curated places with public names; aliases keep old names searchable.
EXTRA_PLACES = [
    {'id': 's-lab', 'name': 'S-Lab for Advanced Intelligence', 'aliases': ['S-Lab', 'ABN-02b-11'], 'lat': 1.34643, 'lon': 103.68188,
     'kind': 'lab', 'note': 'Academic Block North, level 2, room ABN-02b-11 (NTU S-Lab contact page)'},
]
ALIASES = {'The Hive': ['UOB Innovation Hub'], 'Academic Block North': ['ABN'], 'Lee Wee Nam Library': ['NS3-03-01', 'Library'],
           'The Arc - Learning Hub North': ['The Arc'], 'School of Art, Design and Media': ['ADM']}
RENAMED = {'The Hive': 'UOB Innovation Hub'}


def main():
    osm = json.loads(OSM.read_text())
    fresh = json.loads(TAGS.read_text())['buildings']
    elevation = load_dem()
    nodes = {e['id']: e for e in osm['elements'] if e['type'] == 'node'}
    ways = {e['id']: e for e in osm['elements'] if e['type'] == 'way'}
    rels = [e for e in osm['elements'] if e['type'] == 'relation']
    pts = lambda way: [xz(nodes[i]['lat'], nodes[i]['lon']) for i in way.get('nodes', []) if i in nodes]

    lats = [n['lat'] for n in nodes.values()]
    lons = [n['lon'] for n in nodes.values()]
    south, north = max(min(lats), 1.337), min(max(lats), 1.3633)
    west, east = max(min(lons), 103.6696), min(max(lons), 103.6925)
    x0, z0 = xz(north, west)
    x1, z1 = xz(south, east)

    # Terrain grid, heights relative to the lowest sample.
    nx, nz = int((x1 - x0) / STEP) + 2, int((z1 - z0) / STEP) + 2
    raw = []
    for j in range(nz):
        for i in range(nx):
            x, z = x0 + i * STEP, z0 + j * STEP
            raw.append(elevation(LAT0 - z / KZ, LON0 + x / KX))
    base = min(raw)
    heights = [round((h - base) * 10) for h in raw]

    def ground(x, z):
        fi = min(nx - 1.001, max(0, (x - x0) / STEP))
        fj = min(nz - 1.001, max(0, (z - z0) / STEP))
        i, j = int(fi), int(fj)
        tx, tz = fi - i, fj - j
        h = lambda a, b: heights[b * nx + a] / 10
        return (h(i, j) * (1 - tx) + h(i + 1, j) * tx) * (1 - tz) + (h(i, j + 1) * (1 - tx) + h(i + 1, j + 1) * tx) * tz

    inside = lambda p: x0 - 5 <= p[0] <= x1 + 5 and z0 - 5 <= p[1] <= z1 + 5

    # Buildings.
    buildings = []

    def add_building(key, ring, tags):
        ring = clean_ring(ring)
        if len(ring) < 3 or not all(inside(p) for p in ring):
            return
        if ring_area(ring) < 0:
            ring.reverse()
        area = abs(ring_area(ring))
        if area < 6:
            return
        tags = {**tags, **fresh.get(key, {})}
        kind = tags.get('building', 'yes')
        if kind == 'yes' and 'Block' in tags.get('name', '') and area > 300:
            kind = 'residential'
        levels = None
        try:
            levels = float(tags['building:levels'])
        except (KeyError, ValueError):
            pass
        height = None
        try:
            height = float(str(tags.get('height', '')).replace('m', '').strip())
        except ValueError:
            pass
        if height is None:
            height = (levels or default_levels(kind)) * 3.8 + 0.8
        if kind == 'roof':
            height = min(height, 4.5)
        g = min(ground(*p) for p in ring + [(sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring))])
        name = tags.get('name', '')
        buildings.append({'id': key, 'k': kind, 'l': levels, 'h': r1(height), 'g': r1(g), 'n': RENAMED.get(name, name),
                          'p': [r1(v) for p in ring for v in p]})

    for w in ways.values():
        if 'building' in w.get('tags', {}):
            add_building(f"way/{w['id']}", pts(w), w['tags'])
    for r in rels:
        tags = r.get('tags', {})
        if 'building' not in tags:
            continue
        for m in r.get('members', []):
            if m.get('type') == 'way' and m.get('role') == 'outer' and m['ref'] in ways:
                ring = pts(ways[m['ref']])
                if ring and math.dist(ring[0], ring[-1]) < 0.5:
                    add_building(f"relation/{r['id']}", ring, tags)

    # Roads and paths.
    roads = []
    graph = {}
    for w in ways.values():
        tags = w.get('tags', {})
        k = tags.get('highway')
        if k not in ROAD_WIDTH:
            continue
        line = pts(w)
        if len(line) < 2 or not any(inside(p) for p in line):
            continue
        width = ROAD_WIDTH[k]
        try:
            width = max(width, float(tags.get('lanes', 0)) * 3.2) if k in DRIVEABLE or k.startswith('primary') else width
        except ValueError:
            pass
        roads.append({'k': k, 'w': width, 'c': 1 if tags.get('covered') == 'yes' else 0,
                      'b': 1 if tags.get('bridge') in ('yes', 'viaduct') else 0, 'n': tags.get('name', ''),
                      'p': [r1(v) for p in line for v in p]})
        if k in DRIVEABLE and tags.get('access') not in ('private', 'no'):
            ids = [i for i in w['nodes'] if i in nodes]
            for a, b in zip(ids, ids[1:]):
                pa, pb = xz(nodes[a]['lat'], nodes[a]['lon']), xz(nodes[b]['lat'], nodes[b]['lon'])
                d = math.dist(pa, pb)
                graph.setdefault(a, []).append((b, d))
                if tags.get('oneway') not in ('yes', '1'):
                    graph.setdefault(b, []).append((a, d))

    # Areas.
    areas = []
    for w in ways.values():
        tags = w.get('tags', {})
        kind = next((AREA_KIND[(k, tags[k])] for k in ('landuse', 'leisure', 'natural', 'water', 'amenity') if (k, tags.get(k)) in AREA_KIND), None)
        if not kind:
            continue
        ring = clean_ring(pts(w))
        if len(ring) < 3 or not any(inside(p) for p in ring):
            continue
        if ring_area(ring) < 0:
            ring.reverse()
        # leisure=track also tags jogging loops around the campus; only a running track (about
        # 180 x 90 m) is an area to fill, a closed loop over a kilometre long is a line.
        xs, zs = [p[0] for p in ring], [p[1] for p in ring]
        if kind == 'track' and max(max(xs) - min(xs), max(zs) - min(zs)) > 250:
            continue
        areas.append({'k': kind, 'p': [r1(v) for p in ring for v in p]})

    # Trees: mapped trees and tree rows.
    trees = []
    for n in nodes.values():
        if n.get('tags', {}).get('natural') == 'tree':
            x, z = xz(n['lat'], n['lon'])
            if inside((x, z)):
                trees += [r1(x), r1(z)]
    for w in ways.values():
        if w.get('tags', {}).get('natural') == 'tree_row':
            line = pts(w)
            for a, b in zip(line, line[1:]):
                steps = max(1, int(math.dist(a, b) / 8))
                for s in range(steps):
                    t = s / steps
                    trees += [r1(a[0] + (b[0] - a[0]) * t), r1(a[1] + (b[1] - a[1]) * t)]

    # Bus stops and the Campus Loop Red.
    stops = []
    for n in nodes.values():
        tags = n.get('tags', {})
        if tags.get('highway') == 'bus_stop' and tags.get('name'):
            x, z = xz(n['lat'], n['lon'])
            if inside((x, z)):
                stops.append({'n': tags['name'], 'x': r1(x), 'z': r1(z), 'ref': tags.get('ref', '')})

    def nearest_node(x, z):
        best, bd = None, 1e18
        for nid in graph:
            p = xz(nodes[nid]['lat'], nodes[nid]['lon'])
            d = (p[0] - x) ** 2 + (p[1] - z) ** 2
            if d < bd:
                best, bd = nid, d
        return best

    def shortest(a, b):
        dist, prev, heap = {a: 0}, {}, [(0, a)]
        while heap:
            d, u = heapq.heappop(heap)
            if u == b:
                break
            if d > dist.get(u, 1e18):
                continue
            for v, w in graph.get(u, []):
                nd = d + w
                if nd < dist.get(v, 1e18):
                    dist[v], prev[v] = nd, u
                    heapq.heappush(heap, (nd, v))
        if b not in dist:
            return None
        path = [b]
        while path[-1] != a:
            path.append(prev[path[-1]])
        return path[::-1]

    by_name = {s['n']: s for s in stops}
    loop, loop_stops = [], []
    for name_a, name_b in zip(LOOP_RED, LOOP_RED[1:]):
        sa, sb = by_name.get(name_a), by_name.get(name_b)
        if not sa or not sb:
            continue
        na, nb = nearest_node(sa['x'], sa['z']), nearest_node(sb['x'], sb['z'])
        leg = shortest(na, nb) if na and nb else None
        coords = [xz(nodes[i]['lat'], nodes[i]['lon']) for i in leg] if leg else [(sa['x'], sa['z']), (sb['x'], sb['z'])]
        if not loop:
            loop_stops.append({'n': name_a, 'i': 0})
        loop += coords if not loop else coords[1:]
        loop_stops.append({'n': name_b, 'i': len(loop) - 1})

    # Places.
    places = []
    seen = set()
    for w in list(ways.values()) + [n for n in nodes.values() if n.get('tags')]:
        tags = w.get('tags', {})
        name = tags.get('name')
        if not name or name in seen:
            continue
        kind = tags.get('amenity') or tags.get('building') or tags.get('leisure') or tags.get('tourism')
        if not kind or kind in ('bus_stop', 'yes') and 'Hall' not in name and 'Block' not in name and 'Canteen' not in name:
            continue
        if w['type'] == 'way':
            ring = pts(w)
            if not ring:
                continue
            cx, cz = sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)
        else:
            cx, cz = xz(w['lat'], w['lon'])
        if not inside((cx, cz)):
            continue
        seen.add(name)
        display = RENAMED.get(name, name)
        places.append({'id': f"{w['type']}/{w['id']}", 'name': display, 'aliases': ALIASES.get(name, []) + ([name] if display != name else []),
                       'kind': kind, 'x': r1(cx), 'z': r1(cz), 'g': r1(ground(cx, cz))})
    for p in EXTRA_PLACES:
        x, z = xz(p['lat'], p['lon'])
        places.append({'id': p['id'], 'name': p['name'], 'aliases': p['aliases'], 'kind': p['kind'], 'x': r1(x), 'z': r1(z), 'g': r1(ground(x, z)), 'note': p['note']})

    out = {
        'version': 1,
        'frame': {'lat0': LAT0, 'lon0': LON0, 'kx': KX, 'kz': KZ, 'axes': 'x east, z south, metres', 'elevationBase': round(base, 2)},
        'bounds': {'x0': r1(x0), 'z0': r1(z0), 'x1': r1(x1), 'z1': r1(z1)},
        'terrain': {'x0': r1(x0), 'z0': r1(z0), 'step': STEP, 'nx': nx, 'nz': nz, 'dm': heights},
        'buildings': buildings, 'roads': roads, 'areas': areas, 'trees': trees, 'stops': stops,
        'loop': {'name': 'Campus Loop Red', 'p': [r1(v) for p in loop for v in p], 'stops': loop_stops},
        'places': places,
        'attribution': [
            'Buildings, roads, paths, land use, trees, stops and names: © OpenStreetMap contributors, ODbL 1.0 (snapshot 2026-09-16, building tags 2026-09-28).',
            'Terrain: Copernicus GLO-30 DEM via Mapterhorn. © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA.',
            'Shuttle stop order: NTU internal campus shuttle page. People and events in the demo are fictional.',
        ],
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    print(f'wrote {OUT.relative_to(REPO)} ({OUT.stat().st_size / 1024:.0f} KB): {len(buildings)} buildings, {len(roads)} roads, '
          f'{len(areas)} areas, {len(trees) // 2} trees, {len(stops)} stops, loop {len(loop)} points / {len(loop_stops)} stops, '
          f'{len(places)} places, terrain {nx}x{nz} ({(max(heights) - min(heights)) / 10:.1f} m range)')


if __name__ == '__main__':
    main()
