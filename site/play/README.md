# Playable episodes

The Demo page (`play.html`) runs the island and the eight episodes in real-time 3D, built with the
vendored three.js (`world/vendor/three`, mapped as `three` in the page's import map; the addons in
`world/vendor/three/addons/` are copied from the same r184 release). Nothing here is a generated
picture except the island illustration (`assets/play/island.webp`), which is the fallback hero
without WebGL and the teaser picture on the paper's page. The library covers and the teaser's
preview loops are rendered from these same rooms.

| File | Role |
|---|---|
| `engine.mjs` | Renderer, diorama camera (drag to orbit within limits, wheel or pinch to zoom), HTML labels pinned to 3D points, clickable objects, tweens, time-of-day lighting, `capture()` for stills. On capable devices it adds ground-truth ambient occlusion (GTAO), computed at half resolution and multiplied over the frame; helpers such as beams, rings, halos and soft shadows are kept out of it. Frames are capped near 60 a second, shaders compile before the first frame (`warm()`), and if frames stay slow it drops the occlusion, then the resolution, then the shadow map size |
| `merge.mjs` | Merges everything that never moves into one mesh per material (a room goes from about a thousand draw calls to a few hundred); anything marked `userData.dynamic` or clickable is left alone |
| `island.mjs`, `mini.mjs` | The island of the Demo page: land, cliffs, water, trees and the eight buildings, each cut open towards the viewer with its episode's people and devices as small figures (`mini.mjs`, the rooms' cast at about a twentieth of the triangles, coloured per vertex so a building merges into a few meshes). Hovering a building lifts its roof |
| `kit.mjs` | Procedural rooms and furniture: rounded boxes, walls cut at half height, windows whose sky follows the time of day, desks, shelves; fabric, wood and plaster detail maps; lamp halos |
| `people.mjs`, `poses.mjs` | People: a shaped torso, clothing layers (collar, cuffs, belt, open cardigan or jacket), hands with a thumb, shoes with soles, a face that blinks and moves its mouth while talking, seven hair styles; poses, walking, gestures and gaze |
| `rig.mjs` | The one-armed home robot and the armless service robot; re-exports `person`, `POSES` and `turnTo` |
| `scenes/common.mjs` | Cancellable scripts, clickable spots, and the device overlays (glasses display, earbud cue, readable screen) |
| `scenes/<case>.mjs` | One room per episode in `site/data/cases.mjs` |

A scene module exports `build(view)` and returns:

- `enter(i, scenario, { instant, beat })`: plays step `i` up to the moment of its call or action.
- `act(i, option, scenario, { policy })`: plays one option. Each episode has one call per scenario,
  where the viewer picks the option; after an option the assistant would not pick, the player plays
  the assistant's own call too (`policy: true`), so the next step starts from the episode's own path.
  Every other step that acts names its option in `auto`, and the player plays it once the step is set up.
- `snapEnd(i, scenario, beat)`: the state after step `i`, used when jumping between steps.
- `inspect(spot, i, scenario)`, `visibleSpots(i, scenario)`, `spots`, `overview`.

What each step means (modules, channels, conditions, memory, θ, tracked permissions) stays in
`site/data/cases.mjs`; the call's setup and results are there too, so the tests can check them without
a browser. Endings, with the reason each run sits at its level, and objectives are in
`site/data/case-play.mjs`.

## The hero and the transitions

The Demo page opens on the island in real-time 3D (`site/island-hero.mjs`). Every building plays the
core of its episode in a loop (`b.tick` in `island.mjs`): the maker works and the glasses show a hint,
the runner turns a shoe and a note flashes once, a cue pulses at the meeting user's ear, the home
office's check-in waits (amber) until the call ends (green), the analyst types while the report comes
out of the printer, a proposed rule travels from the unattended laptop to the locked cabinet beside
blinking servers, the home robot fetches the cup and hands it over, and the care robot visits the
lounge while a resident walks with a walker. Only the joints that move stay separate meshes
(`miniPerson().live()`); the rest of each figure merges with its building.

Each building carries a pin. Hovering a building or its pin lifts the roof and shows a card in the
game's pixel type: the episode's one-line description, its setting in the paper's application space
(interaction domain, participant scope, outcome horizon) and its level. On touch screens the first tap
shows the card and the second one plays. Drag turns the island within limits.

The transitions are pixel style. Clicking a building, its pin or Press start flies the camera into
that building while the view breaks into bigger and bigger pixels (`view.pixelate()` lowers the
resolution in steps and the canvas scales up with hard edges). Square pixels then dither over the
screen with lime and white at the front, the episode opens under them, the pixels dither away, and
the room resolves out of big pixels while the camera sweeps down. Closing an episode runs it in
reverse, back to the island's overview. Library cards use the dither. The island stops drawing while
it is off screen, behind an episode, or in a hidden tab. Without WebGL the hero shows the
illustration with pins at `PINS` (`site/data/case-play.mjs`). With reduced motion there are no
transitions and the island holds one telling moment of every scene.

## Teaser previews

`assets/play/preview/<case>.mp4` (and a `.webp` still of the first frame) are recordings of the
player itself, shown when an episode name is hovered on the paper's page. Each loop has three shots at
normal speed: the episode's one call, the first option the assistant would not pick played out, and the
assistant's own call played out. A shot holds about 0.8 s (up to 1 s while the room still moves), shots are joined by 0.25 s
cross-fades, and the last one fades back into the first, so the loop has no seam. They were
recorded in headless Chrome with the DevTools screencast at 1680 × 860, with the page logging when the
call is made and when the room starts and stops playing each call, then cropped to the stage at 16:9
and encoded with ffmpeg (H.264, CRF 26, 1280 × 720, 30 frames a second).

## Library art

Open the page with `?debug=1`, then in the console build a scene into an off-screen host, call
`scene.snapEnd(step, scenario, beat)`, set the camera with `view.setRig(...)`, and save
`view.capture(900, 1200)`. The covers in `assets/play/` are 600 × 800 WebP files.
