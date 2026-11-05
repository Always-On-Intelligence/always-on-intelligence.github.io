"""Build world/eccv/venue.json from the EgoPoster ECCV 2026 venue data.

The official Malmömässan floor plan image (EgoPoster floorplans/*.png) is the
CAD drawing flipped vertically at 6.82 px per metre. That fit comes from
matching the CAD BUILDING lines to the dark pixels of the image, so CAD
coordinates are metres and every image-space layer (booth placement, poster
rows, coffee points) can be brought into the same frame.

World frame: X = CAD x - 120, Z = CAD y + 85, in metres, Y up. Looking down
with -Z up the screen reproduces the official floor plan.

Usage: python3 tools/eccv/build_venue.py [path/to/EgoPoster]
"""

import json
import math
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EGOPOSTER = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / 'Desktop/code/EgoPoster')
MAP_DIR = EGOPOSTER / 'app/web/components/poster_map/component'
OUT = REPO / 'world/eccv/venue.json'

# Floor plan image -> CAD metres (least-squares fit, see module docstring).
PX_PER_M, PX_BX, PX_BY = 6.82, -101.5, 1028.5
ORIGIN_X, ORIGIN_Y = 120.0, -85.0


def r2(value):
    return round(value, 2)


def cad(x, y):
    """CAD metres -> world [x, z]."""
    return [r2(x - ORIGIN_X), r2(y - ORIGIN_Y)]


def px(u, v):
    """Floor plan pixel -> world [x, z]."""
    return cad((u - PX_BX) / PX_PER_M, (v - PX_BY) / PX_PER_M)


def pm(u, v):
    """EgoPoster floor plan unit (pixel / 6) -> world [x, z]."""
    return px(6 * u, 6 * v)


def pm_len(value):
    return value * 6 / PX_PER_M


def rect(x0, z0, x1, z1):
    return [[r2(x0), r2(z0)], [r2(x1), r2(z0)], [r2(x1), r2(z1)], [r2(x0), r2(z1)]]


def load_worksheet_grid():
    source = (MAP_DIR / 'poster-map.js').read_text().split('\n')[1]
    match = re.match(r'const WORKSHEET_FLOORPLAN_GRID = (.*);\s*$', source)
    if not match:
        raise SystemExit('WORKSHEET_FLOORPLAN_GRID not found on line 2 of poster-map.js')
    return json.loads(match.group(1))


def short_authors(names):
    names = [n.strip() for n in names if n and n.strip()]
    if len(names) <= 3:
        return ', '.join(names)
    return ', '.join(names[:3]) + ' et al.'


def first_sentence(text, limit=190):
    text = re.sub(r'\s+', ' ', text or '').strip()
    if not text:
        return ''
    cut = re.split(r'(?<=[.!?])\s', text, maxsplit=1)[0]
    if len(cut) > limit:
        cut = cut[:limit].rsplit(' ', 1)[0] + '…'
    return cut


def main():
    venue = json.loads((MAP_DIR / 'data/eccv-2026-venue-map.json').read_text())
    publication = json.loads((MAP_DIR / 'data/eccv-2026-map-publication.json').read_text())['document']
    grid = load_worksheet_grid()
    papers = [json.loads(line) for line in (EGOPOSTER / 'data/papers/eccv2026_confirmed.jsonl').read_text().splitlines() if line.strip()]
    demo_plan = json.loads((EGOPOSTER / 'tools/glasses-sync-demo/demo-plan.json').read_text())
    program = json.loads((EGOPOSTER / 'data/programs/eccv2026/program.normalized.json').read_text())

    envelope = [cad(x, y) for x, y in publication['venueEnvelope']['polygon']]

    # Hall shell, read off the CAD BUILDING layer (metres, CAD frame).
    walls = []

    def wall(x0, y0, x1, y1, height=10.0, thickness=0.35, kind='wall'):
        a, b = cad(x0, y0), cad(x1, y1)
        walls.append([a[0], a[1], b[0], b[1], height, thickness, kind])

    # West wall between the hall and the restaurant / lobby, with its doors.
    for y0, y1 in [(-138.2, -122.45), (-120.34, -96.96), (-94.86, -82.8), (-62.5, -45.9)]:
        wall(65.2, y0, 65.2, y1)
    # South-west corner between the lobby corridor and room A.
    wall(65.2, -43.1, 70.2, -43.1, 5.0)
    # Drape along the column line that closes off the northern strip.
    for x0, x1 in [(65.2, 89.0), (93.0, 139.0)]:
        wall(x0, -123.7, x1, -123.7, 3.6, 0.12, 'drape')
    wall(143.9, -123.7, 143.9, -141.0, 3.6, 0.12, 'drape')

    blocks = [
        {'label': 'Mässbutik · Restrooms', 'h': 5.0, 'kind': 'service',
         'poly': [cad(x, y) for x, y in [(148.9, -137.4), (181.6, -137.4), (181.6, -103.2), (163.7, -103.2), (163.7, -110.2), (148.9, -110.2)]]},
        {'label': 'Restrooms', 'h': 4.5, 'kind': 'service',
         'poly': [cad(x, y) for x, y in [(164.3, -43.6), (181.6, -43.6), (181.6, -38.3), (173.3, -26.5), (164.3, -26.5)]]},
        {'label': 'Storage', 'h': 5.0, 'kind': 'service',
         'poly': [cad(x, y) for x, y in [(77.4, -43.1), (80.3, -43.1), (80.3, -23.5), (77.4, -23.5)]]},
    ]

    # Session rooms A-E along the south wall; C, D and E are split into 1 (hall side) and 2.
    rooms = []
    for label, x0, x1, split in [('A', 80.3, 101.0, False), ('B', 101.0, 125.1, False),
                                 ('C', 125.1, 137.2, True), ('D', 137.2, 149.3, True), ('E', 149.3, 161.4, True)]:
        if split:
            rooms.append({'id': label + '1', 'poly': [cad(x, y) for x, y in [(x0, -43.1), (x1, -43.1), (x1, -33.2), (x0, -33.2)]],
                          'door': cad((x0 + x1) / 2, -43.1), 'h': 5.0})
            rooms.append({'id': label + '2', 'poly': [cad(x, y) for x, y in [(x0, -33.2), (x1, -33.2), (x1, -23.4), (x0, -23.4)]],
                          'door': cad((x0 + x1) / 2, -23.4), 'h': 5.0})
        else:
            rooms.append({'id': label, 'poly': [cad(x, y) for x, y in [(x0, -43.1), (x1, -43.1), (x1, -23.4), (x0, -23.4)]],
                          'door': cad(x0 + (x1 - x0) * 0.3, -43.1), 'door2': cad(x0 + (x1 - x0) * 0.72, -43.1), 'h': 5.0})

    columns = []
    for line in venue['linework']:
        if line['layer'] != 'COLUMNS':
            continue
        xs = [p[0] for p in line['points']]
        ys = [p[1] for p in line['points']]
        center = cad((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2)
        columns.append(center + [r2(max(xs) - min(xs)), r2(max(ys) - min(ys))])

    # Booths: EgoPoster's per-group calibration from the CAD drawing onto the floor plan.
    by_id = {b['id']: b for b in venue['booths']}
    booths = []

    def rect_map(point, source, target):
        fx = (point[0] - source['x0']) / (source['x1'] - source['x0'])
        fy = (point[1] - source['y0']) / (source['y1'] - source['y0'])
        return (target['x0'] + fx * (target['x1'] - target['x0']), target['y0'] + fy * (target['y1'] - target['y0']))

    for group in venue['floorplan']['boothPlacementGroups']:
        for booth_id in group['boothIds']:
            booth = by_id[booth_id]
            exhibitor = (booth.get('exhibitors') or [{}])[0]
            booths.append({
                'id': booth['label'],
                'name': exhibitor.get('name', ''),
                'city': exhibitor.get('city', ''),
                'sponsor': bool(exhibitor.get('sponsorLevels')),
                'kind': 'exhibitor',
                'group': group['id'],
                'poly': [pm(*rect_map(p, group['sourceRect'], group['targetRect'])) for p in booth['polygon']],
            })
    # Demo-session booths and the merchandise stands, measured on the floor plan image.
    for index, label in enumerate(['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06']):
        u0 = 634 + index * 20.58
        a, b = px(u0 + 0.6, 309.5), px(u0 + 20.0, 329.0)
        booths.append({'id': label, 'name': 'Demo' if label != 'D-06' else '', 'kind': 'demo', 'group': 'demo-row',
                       'poly': rect(a[0], a[1], b[0], b[1])})
    for index, (v0, v1) in enumerate([(217.5, 257.5), (258.5, 299.0)]):
        a, b = px(676, v0), px(717, v1)
        booths.append({'id': f'T{index + 1}', 'name': 'ECCV T-shirts', 'kind': 'merch', 'group': 'merch',
                       'poly': rect(a[0], a[1], b[0], b[1])})

    coffee = []
    for amenity in venue['floorplan']['amenities']:
        center = pm(*amenity['center'])
        coffee.append(center + [r2(pm_len(amenity['radius']))])

    # Poster boards: the worksheet grid (docs/map-id.xlsx) used by the live EgoPoster map.
    session6 = {p['poster_board']: p for p in papers if p.get('poster_session') == 'Poster Session 6' and p.get('poster_board')}
    rows, boards, paper_index = [], [], {}
    for row in grid['rows']:
        center_v = row['points'][0][1]
        z = pm(0, center_v)[1]
        segments = [[pm(seg[0][0], center_v)[0], pm(seg[1][0], center_v)[0]] for seg in row['segments']]
        rows.append({'id': row['id'], 'z': z, 'segments': segments})
        for cell in row['cells']:
            u, v = cell['position']
            x = pm(u, v)[0]
            side = -1 if v < center_v else 1
            number = cell['number']
            boards.append([number, x, z, side, r2(pm_len(cell['width']))])
            paper = session6.get(number)
            if paper:
                details = paper.get('author_details') or []
                affiliation = ''
                for detail in details:
                    if detail.get('affiliations'):
                        affiliation = detail['affiliations'][0]
                        break
                paper_index[str(number)] = {
                    't': paper['title'].strip(),
                    'a': short_authors(paper.get('authors') or []),
                    'f': re.split(r',\s*(?=[A-Z][a-z]+\s+\d|\d)', affiliation)[0][:80] if affiliation else '',
                    'k': paper.get('topic') or '',
                    's': first_sentence(paper.get('abstract')),
                }
    boards.sort(key=lambda b: b[0])

    labels = [
        {'text': 'Main entrance', 'at': px(95, 820), 'kind': 'entrance'},
        {'text': 'Registration', 'at': cad(37.94, -52.63), 'kind': 'service'},
        {'text': 'Restaurant', 'at': px(300, 300), 'kind': 'service'},
        {'text': 'Stairs to first floor', 'at': px(235, 548), 'kind': 'service'},
        {'text': 'Poster Hall', 'at': px(930, 470), 'kind': 'zone'},
        {'text': 'Exhibition', 'at': px(520, 420), 'kind': 'zone'},
        {'text': 'Poster collection', 'at': px(750, 222), 'kind': 'zone'},
        {'text': 'Luggage', 'at': px(410, 930), 'kind': 'service'},
    ]

    # Main-conference program on the Poster Session 6 day, from the official calendar import.
    day = []
    for occurrence in sorted(program['occurrences'], key=lambda o: o.get('start_at') or ''):
        if occurrence.get('local_date') != '2026-09-12' or not occurrence.get('start_at'):
            continue
        if occurrence.get('kind') in ('workshop', 'tutorial', 'registration-desk'):
            continue
        day.append({'start': occurrence['start_at'][11:16], 'end': (occurrence.get('end_at') or '')[11:16],
                    'kind': occurrence['kind'], 'title': occurrence['title'], 'room': occurrence.get('room_name') or ''})

    route = [108, 175, 172, 402, 424]
    visits = []
    for number, visit in zip(route, demo_plan['visits']):
        visits.append({'board': number, 'id': visit['id'], 'title': visit['posterTitle'],
                       'topic': visit['topicConnection'], 'academic': visit['academicConnection'],
                       'insights': visit['keyInsights'], 'questions': visit.get('authorQuestions') or [],
                       'next': visit.get('recommendations') or []})

    booth44 = next(b for b in booths if b['id'] == '44')
    out = {
        'version': 1,
        'source': {
            'venue': 'Malmömässan ground floor, ECCV 2026 official floor plan and Momentus VFP CAD via EgoPoster',
            'boards': grid['version'] + ' (' + grid['source'] + ')',
            'papers': 'ECCV 2026 accepted papers, Poster Session 6 (EgoPoster data/papers/eccv2026_confirmed.jsonl)',
            'demo': demo_plan['id'],
            'frame': 'metres; X = CAD x - 120, Z = CAD y + 85; floor plan px = 6.82 m + (-101.5, 1028.5)',
        },
        'ceiling': 10.0,
        'envelope': envelope,
        'walls': walls,
        'blocks': blocks,
        'rooms': rooms,
        'columns': columns,
        'booths': booths,
        'coffee': coffee,
        'rows': rows,
        'boards': boards,
        'papers': paper_index,
        'labels': labels,
        'session': {'name': 'Poster Session 6', 'date': '2026-09-12', 'start': '15:00', 'end': '17:00', 'room': 'ExHall'},
        'day': day,
        'demo': {'route': route, 'visits': visits, 'start': booth44['id']},
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    print(f'wrote {OUT.relative_to(REPO)} ({OUT.stat().st_size / 1024:.0f} KB): '
          f'{len(walls)} walls, {len(blocks)} blocks, {len(rooms)} rooms, {len(columns)} columns, {len(booths)} booths, '
          f'{len(coffee)} coffee, {len(rows)} rows, {len(boards)} boards, {len(paper_index)} Session 6 papers, {len(day)} day events')


if __name__ == '__main__':
    main()
