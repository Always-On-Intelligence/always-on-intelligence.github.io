# Always-on glasses in three.js: ECCV 2026 and NTU

`world/` holds both scenes of the project page demo, seen through always-on glasses: Poster Session 6 in Malmömässan (`?scene=eccv`, the default) and the NTU campus (`?scene=ntu`). It is plain ES modules with a vendored three.js, so there is no build step. `demo/minecraft-embed.mjs` loads both scenes from here; the older Minecraft campus under `game/` is left untouched and only loads for local prototype previews (`?campusPrototype=…` on localhost).

Open `world/?scene=eccv` or `world/?scene=ntu` directly, or add `lang=zh` for Chinese, `tour=1` to start the guided walk, and `quality=low|high` to override device detection. Move the mouse over the view to look around (rest it near the left or right edge to keep turning) and walk with `W A S D` (`Shift` runs); a click greets the person or opens the poster in front of you and never walks you anywhere. Touch screens, which have no keys, drag to look and tap to walk. In either scene, `T` starts the guided walk, `M` opens the map, `V` toggles the overview and `G` takes the glasses off. During a guided walk, `N` skips the current scene, the Scenes menu jumps to any scene (earlier ones replay at skip speed so their state is rebuilt), and the speed button cycles 1×, 2× and 4×. In NTU, `E` enters the building you face and leaves the one you are in.

## ECCV 2026: what is real and what is scripted

- **Venue**: the Malmömässan ground floor at 1:1. The official ECCV 2026 floor plan image is the Momentus VFP CAD drawing flipped vertically at 6.82 px per metre, so walls, columns and rooms come from the CAD layer, while booths, poster rows and coffee points come from EgoPoster's calibration on the floor plan.
- **Boards**: EgoPoster's worksheet grid (`worksheet-new-floorplan-20260908-v1`, from `docs/map-id.xlsx`), 498 boards in 12 double-sided rows.
- **Posters**: every Session 6 board shows its real title, authors, first listed affiliation and the first sentence of the abstract when available. The poster layouts and figures are generated.
- **Cards**: #108, #175, #172, #402 and #424 reuse EgoPoster's own demo walk (`tools/glasses-sync-demo/demo-plan.json`); other posters show program metadata only.
- **Scripted**: the visitor's history and interests, the presenters' talk, and the timing revision θ₁ → θ₂, which illustrates the paper's self-evolving extension and is not an EgoPoster feature. There is no model, camera or microphone.

## NTU: what is real and what is scripted

- **Campus**: buildings, roads, paths, covered walkways, land use, bus stops and names from OpenStreetMap (a snapshot in `game/maps/ntu-campus-v2/ntu-core-osm.json` plus building tags in `tools/ntu/data/`). Heights follow OSM levels where mapped and are estimated from the building type elsewhere. The Hive appears under its current name, UOB Innovation Hub, with the old name kept as an alias.
- **Terrain**: Copernicus GLO-30 elevation, one Mapterhorn terrarium tile sampled on a 10 m grid.
- **Shuttle**: two buses run the Campus Loop Red in the stop order NTU publishes, routed over the OSM road graph.
- **S-Lab**: NTU lists S-Lab for Advanced Intelligence at ABN-02b-11 in Academic Block North. The lab interior (`ntu/lab.mjs`) is illustrative: layout, furniture and lab mates are invented. It sits inside the ABN massing one level up, with its windows on the real south façade. Entering ABN from outside takes you there.
- **Other interiors**: every other building of some size can be entered (`ntu/interiors.mjs`). The room is chosen by the building's name and OSM kind, or by a library or food place mapped near the door you use (`ntu/kinds.mjs`): library, food court, hall of residence, residential block, sports hall, lecture theatre or lobby. Only names and level counts come from the map; each room says it is illustrative, and its windows sit on the façade you came in by.
- **Scripted**: the S-Lab day (`ntu/day.mjs`). The student, supervisor, lab mates, meetings, the cluster job and the commute revision θ₁ → θ₂ are fictional. Each step is labelled as common today, the always-on target, or the self-evolving extension.
- **Not used**: ntumap.app, MazeMap and other campus 3D sources are not redistributable, so none of their geometry is in this scene.

## Layout

| Path | Role |
|---|---|
| `main.mjs` | Loads a scene module, runs the loop, keyboard and page messages (`always-on-game-ready`, `always-on-exit-game`, `always-on-game-mode`) |
| `engine/` | Renderer, navigation grid and A*, first-person player, figures, glasses HUD, minimap, canvas textures |
| `eccv/` | Hall, posters, crowd and the guided walk; `venue.json` is generated (see below) |
| `ntu/scene.mjs` | Terrain, roads, walkways, buildings, trees, water, buses, sky presets |
| `ntu/nav.mjs` | Two grids: 1 m for collision and line of sight, 3 m cost grid for routes along paths |
| `ntu/crowd.mjs` | Students on walkways, people at stops and outside food courts |
| `ntu/lab.mjs` | The illustrative S-Lab room and its lab mates |
| `ntu/interiors.mjs`, `ntu/kinds.mjs` | Illustrative rooms for the other buildings, built when you walk in |
| `engine/tour.mjs` | Guided walk controls shared by both scenes: scenes, skipping, speed |
| `ntu/story.mjs`, `ntu/day.mjs` | Free mode (building recognition, greetings, the lab) and the guided S-Lab day |
| `ntu/campus.json` | Generated campus data (see below) |

## Rebuilding the data

```bash
python3 tools/eccv/build_venue.py ~/Desktop/code/EgoPoster
python3 tools/ntu/build_campus.py
```

`build_venue.py` reads EgoPoster's venue map, map publication, `poster-map.js` worksheet grid, the ECCV 2026 paper list and program, and the glasses demo plan; world coordinates are CAD metres shifted by (−120, +85), with Y up. `build_campus.py` projects OSM around NTU to metres (x east, z south) from 103.6825 E, 1.3475 N, and writes buildings, roads, areas, stops, the Campus Loop Red and the terrain grid.

## Credits

three.js r184 (MIT, `vendor/three/LICENSE`). ECCV venue geometry, board map and demo content from EgoPoster (Action Intelligence); poster size (140 × 100 cm, landscape) from the ECCV 2026 author guidance. NTU map data © OpenStreetMap contributors, available under the Open Database License (ODbL). Terrain from Copernicus GLO-30 (© DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the European Union and ESA), via Mapterhorn tiles.
