# Always-On Agent · Minecraft experiences

两个可直接运行的浏览器场景：**NTU 校园**和 **ECCV / EgoPoster 展台**。无需登录，也无需独立 Minecraft 服务端。此目录包含完整客户端、眼镜 HUD、人物交互和自动演示源码。

- [体验网页](https://always-on-agent.github.io/?lang=zh&scene=singapore#live-demo)
- [直接打开游戏](https://always-on-agent.github.io/game/?lang=zh&scene=singapore)
- [资源与依赖说明](https://always-on-agent.github.io/game/credits.html)

## Quick start / 本地开发

Requirements: **Node.js 22 or 24**, **pnpm 10.32.1**, Git. Clone the whole repository; map assets live next to this source directory.

```sh
git clone https://github.com/Always-On-Agent/Always-On-Agent.github.io.git
cd Always-On-Agent.github.io/game-src
corepack enable
CYPRESS_INSTALL_BINARY=0 pnpm install --frozen-lockfile
pnpm prepare:always-on
pnpm dev:always-on --port 3000
```

Open `http://localhost:3000/?scene=singapore&lang=zh` for NTU or `?scene=eccv&lang=en` for the exhibition. The default with no scene parameter is ECCV. `lang=en` / `lang=zh` selects English / Chinese. The NTU campus HUD is laid out for a window of about 1440×900 or larger; below that the right-hand card gives the agenda less room first, then Memory's list, and scrolls with the mouse wheel. In a small embedded preview it drops to the phone layout, so open the address in a full browser window for demos. The first dependency installation and compilation take longer than subsequent runs. If Corepack is unavailable, install the pinned pnpm version with `npm install --global pnpm@10.32.1`.

For the built project page, no Node installation is needed:

```sh
# From the repository root
python3 -m http.server 8888 --bind 127.0.0.1
```

Open `http://localhost:8888/?scene=singapore&lang=zh#live-demo`.

## Where to develop / 修改入口

| Area | Entry points |
| --- | --- |
| S/M/A 服务循环 / Service loop core | `src/alwaysOnLoop.ts` (`observe` / `remember` / `act` / `decline`; channels follow from each call; cards, held cards, tallies, frozen channels), `ntuServiceLoop.ts` (the NTU loop and story on campus time, browser save) |
| S/M/A 实时面板与字幕 / Live system panel, subtitles | `src/alwaysOnLoopPanel.tsx`, `alwaysOnLoopPanel.css` |
| 校园两天剧情 / Two-day campus story | `src/ntuCampusWorld.ts` (places, cast, timetable, story state), `ntuCampusStory.ts` (tasks 1, 2, 3, 7, 10 and the hooks the host calls), `ntuCampusErrands.ts` (tasks 4, 5, 6), `ntuCampusConditions.ts` (tasks 8, 9: audience and authority), `ntuCampusClock.ts` (campus clock) |
| A17 教学关 / A17 tutorial rules | `src/ntuPickupQuest.ts` |
| 剧情宿主 / Story host | `src/ntuCampusHud.tsx` (clock, agenda, prompt, keys, demo), `ntuCampusHud.css` |
| 提醒卡片 / Reminder cards | `src/ntuCampusCards.tsx`, `ntuCampusCards.css` |
| 校园人物与名牌 / Cast, tags, bubbles, pins | `src/ntuCampusCast.ts`; Lin, the steward, the desk and the parcel stay in `ntuLiveEpisodeActors.js` |
| 章节演示 / Chapter demo | `src/ntuCampusChapters.ts` (12 chapters, their preludes and verified walking paths), `ntuCampusDirector.ts` (runner, speed, pausable waits), started from `ntuCampusHud.tsx` |
| 交互提示 / Interaction prompt | `src/alwaysOnPrompt.ts` (direction to the target and prompt text), prompt styles in `ntuCampusHud.css` |
| 连续自动演示 / Continuous episode | `src/ntuLiveEpisodeStory.js` (events, bilingual story, S/M/A trace and report), `ntuLiveEpisode.tsx` (UI/lifecycle) |
| 人物、道具交接 / Actors and parcel | `src/ntuLiveEpisodeActors.js` |
| 实际行走与碰撞 / Physical movement | `src/ntuLiveEpisodeRuntime.ts`, `ntuLiveRoute.ts` |
| NTU 眼镜面板与交互 | `src/singaporeHud.tsx`, `singaporeActions.ts`, `ntuCompanionHud.tsx` |
| 地图、地点、区域标题 | `src/singaporeMap.ts`, `singaporeMinimap.tsx`, `ntuPlaceSearch.ts`, `ntuRegionBanner.tsx` |
| 校园纹理与环境人物/交通 | `src/ntuCampusTextures.ts`, `singaporeLife.ts` |
| 第一人称、自由飞行、俯瞰 | `src/ntuObserverView.ts`, `ntuCampusExploreHud.tsx` |
| ECCV 场景与交互 | `src/eccvWorld.ts`, `eccvSigns.ts`, `eccvHud.tsx` |
| Esc / 鼠标 / 菜单 | `src/alwaysOnMenuInput.ts`, `controls.ts`, `react/PauseScreen.tsx` |
| 页面嵌入与游戏模式 | `../demo/minecraft-embed.mjs`, `../demo/minecraft-embed.css` |
| 画质、帧率等默认值 | `config.always-on.json`, `src/singaporeMap.ts` |

The story/actors are bundled into Minecraft; there is no separate mesh renderer and no dependency on `demo/campus/` or a machine-specific Downloads directory.

### Maps

- `../game/maps/ntu-campus-v3/`: active converted Minecraft world, `scene.json`, `places.json`, `regions.json`, `routes.json`, `minimap.json`, and Anvil `region/*.mca` files. Treat this as the canonical checked-in map input.
- `../game/maps/ntu-campus-v2/`: legacy Arnis world retained for tests and a local hall comparison. It is not a second public renderer.
- `pnpm prepare:always-on` copies these into ignored local `game-assets/` and `assets/maps/ntu/`. Do not edit those generated copies if you want the change committed.
- `ALWAYS_ON_MAPS_DIR=/path/to/maps` supports a standalone client checkout; no absolute personal paths are built into the source.
- ECCV is generated in code; it needs no external world download.

The active world is about 141 MiB on disk, including metadata. Regions and nearby chunks load on demand; this is not the browser's total memory budget. NTU starts at a short render distance and 30 FPS, and draws with the WASM mesher on half the CPU cores (one to four workers): a new place takes about 5–10 s to draw on a 10-core laptop, against 20–40 s with the single JS mesher it used before. Lower-end devices still need testing; the renderer, in-browser server, loaded world and browser all consume additional memory. Free flight temporarily increases the visible radius.

### Controls

- `WASD`: move; mouse: look; `Space`: jump. Touch controls are supplied by the client.
- `Tab`: release/capture the cursor; `M`: campus map; `E`: nearby interaction; `H`: glasses panel.
- `Esc`: one game-menu action. The project page's **Enter game mode** fills the page without native browser fullscreen; **Exit game** returns to the project page.
- Campus view tools enable free flight/overhead in the current world. These are Minecraft cameras, not a separate 3D page.
- Inside the NTU scene a two-day campus story runs (see [README.CONTENT.MD](README.CONTENT.MD)). The clock at the top runs 09:00–18:00 at 30 campus minutes per real minute, only while you walk the campus; menus, observer mode and hidden pages stop it. **⏩** skips to the next timed event (a meeting, a due reminder, the evening review) and never past it. At 18:00 the clock stops until you choose **Sleep · start day 2**.
- **Your day / 你的日程** on the right is your own calendar: each item says what is next and **Go / 前往** shuttles to its place. It is not what the glasses keep; that is the Memory module below it.
- Within 30 m of a target, a prompt under the crosshair shows an arrow, the distance and the next action; within reach and in view it becomes `E` plus the action (tap it on touch screens). Pins float over every target you can act on now. `E` is the one interaction key for glasses stations and story targets; elsewhere it still opens the Minecraft inventory.
- Whatever the glasses say without being asked appears as a card at the top: what, why now, and the memory it relies on. `1`–`3` answer the newest card without leaving mouse-look (click works too). Quiet mode holds cards instead; held cards are listed in the Action module as still owed.
- **Chapter demo / 章节演示** plays the story for an audience in 12 chapters, one or two tasks each, or all of them in a row. A chapter first replays what came before it through the same story rules (so any chapter can be shown on its own), then plays its own part as a player would: it shuttles, walks verified paths with normal physics, faces each target, presses `E` only when the prompt allows it and answers cards by their buttons. **1× / 2× / 4×** scales every pause and can be changed mid-chapter; shuttle trips, walking and handoffs keep their own pace. Every shuttle trip closes a curtain over the world (the chapter's first one doubles as its title card) and opens it only once every chunk within the view distance of the arrival point is drawn and the cast there is standing; the campus clock and the story rules wait meanwhile, so loading time never shifts the story. A chapter that opens with a trip starts at its destination. The shuttle sets down a short walk away and the player walks the last 27–38 m in with normal physics, so every scene begins on foot and "passing" a place triggers its rules on the way; the walk-in routes in `ntuCampusChapters.ts` were found by A* over the Anvil world (level ground, two blocks of headroom, at least 1.8 m from every cast member). S-Lab has none: its road is walled in and its chapters walk the A17 route instead. Press `WASD` or **Stop** to take over; the state so far is kept. Quiet mode must be off, since it holds the cards the chapters answer.
- **Start over / 从头开始** (click twice) deletes the loop's memory, trace, cards and timers and returns the campus to Monday 09:00. This is the user's explicit reset, which the paper distinguishes from state lost at the end of an interaction; the reset itself is logged.
- A17 is a local quest item, shown in the world, not a Minecraft inventory slot. The loop and the story survive reload in two browser saves that are kept or dropped together. Receipts are written after the visible handoff finishes.

### Paper walkthrough / 论文导览

The right-hand **Glasses system / 眼镜系统** panel stays folded to one line while you play: each step opens it for 6 s on just what that step touched (the channels it used and the record, evidence or decision that changed), then it folds again. It opens in full when a demo chapter ends and at 18:00, and **展开系统 / 收起系统** opens or folds it at any time (remembered). Open, it shows the three modules live: **S** lists who and what is in view plus current evidence (never saved), **M** lists retained records with their source channel, status and how many decisions have read them (survives reload; stale records stay visible as history), and **A** shows the latest decision, the timers that run between interactions and any card held back. The six channel chips sit between the modules (S↔A runs as a bracket beside Memory) and light up in the order each step used them; a chip also counts refusals (⊘). Each step is replayed as a subtitle above the hotbar. **Full trace / 完整记录** keeps the history, including decisions that were only logged ("not carried out") and writes a frozen channel blocked; **How it works / 系统原理** shows each module's space and policy, L1–L3, the fixed-policy boundary and the researcher control below.

Each task gives one or two channels the leading role (the full table is in [README.CONTENT.MD](README.CONTENT.MD)):

- **A17 (tutorial, S-Lab):** Lin's request is current evidence only; your yes becomes a commitment (S→M) that suggests the next step (M→A). Collecting and delivering are your actions; the glasses only keep what they saw (S→M). Left for half an hour, the errand is reminded once (M→A).
- **Morning plan and evening review (task 10):** at 09:00 the glasses ask what today holds; your answer becomes commitments. At 18:00 a review nobody asked for compares them with what happened (M→A) and is written back (A→M). Day 2 opens from it.
- **Return the book when passing the library (task 1):** the reminder fires only near the library (S→A with M→A).
- **Report after the meeting (task 2):** at 12:00 the glasses hold back while Zhou is talking to you (S→A), then remind.
- **Someone else's health (task 7):** overheard at 11:20, kept in Sensing only; Memory refuses it (⊘ S→M).
- **The poster (task 6):** you ask the glasses to print it; the kiosk answers "accepted" (A→M). The receipt leaves a check open, so when you next pass the North Spine board, Action sends Sensing to look (A→S). The board is empty (the kiosk jammed), and only a later sighting of the poster closes the task.
- **The study group moved (task 5):** Memory holds "Hall 2" from Monday. On Tuesday a notice on the North Spine board, or on the empty Hall 2 door, corrects it (S→M), and the reminder built on the old place is replaced.
- **Prof. Chen's habit (task 4):** on Monday he tells you he spends afternoons at Starbucks (S→M). On Tuesday that memory decides where the glasses try to recognise him (M→S), so in the library, where he holds office hours this week, he stays unrecognised: no tag, no pin, not in Sensing. "Look elsewhere too" widens the search at a battery cost; the notice board corrects the habit; or you find him yourself.
- **Sending for you (task 9):** on Monday morning you say today's messages may be sent for you, and Memory keeps that grant with its scope. Running late for the meeting that day, the glasses send "running 10 minutes late" themselves and tell you. Running late on Tuesday, they only draft it: at the point of sending, the remembered grant covers yesterday, so the card asks you (M→A, checked at commitment).
- **Who is listening (task 8):** on Tuesday you add collecting medicine before 17:00. If others are within a few metres when the reminder is due, it still comes, but only as "private reminder" with the content held back (S→A); it opens when you are alone or when you open it.
- **Lin's readings every 30 minutes (task 3):** every reminder is written back (A→M); the interval counts from it, and a check within 10 minutes is linked to it. **Stop reminding** on the card is your intervention: the old records stay, due times are only logged as "would have reminded", and the evening review compares before and after without claiming cause. **Freeze A→M** under **How it works** is the researcher's intervention: reminders still show, but the glasses repeat themselves, cannot link your checks and cannot count their reminders.

Switching quiet mode is itself sensed and kept as a preference (S→M), which every reminder reads before speaking (M→A).

### Adding a task / 新增任务

Tasks are authored rules: they decide when to observe, what to remember and when to act. Places and cast go in `src/ntuCampusWorld.ts`; rules go in `ntuCampusStory.ts` or a module it calls, like `ntuPickupQuest.ts`, `ntuCampusErrands.ts` or `ntuCampusConditions.ts`: a rule runs in `tickStory`, a player action goes through `interactions`/`interact`, a card answer through `answerCard`, and any timed event belongs in `nextEvent` so fast-forward stops at it. Against the loop:

- `loop.see(anchor, …)` updates what is in view (no channel, no trace).
- `loop.observe(task, evidence, { guidedBy })`: Sensing receives; `guidedBy: 'memory' | 'action'` records M→S / A→S.
- `loop.remember(task, record, { from })`: Memory receives; `from: 'sensing' | 'action'` records S→M / A→M. `loop.decline(task, { from })` records a refusal and writes nothing.
- `loop.act(task, decision, { uses, reads })`: Action receives; `uses: 'sensing' | 'memory'` records S→A / M→A and `reads` names the records it used. `shadow: true` only logs a decision that is not carried out.
- `speak(loop, task, decision, { card, … })` says something with a card, or holds it in quiet mode.
- `loop.track(id, …, { unit: 'game' })` shows a timer that runs between interactions; `loop.expire(id)`, `loop.drop(id)` and calls without a source are local module decisions and add no channel.

Never write a channel label by hand; it follows from the call. Keep what the glasses know in Memory and what is true on campus in the story's world state, so reload semantics stay consistent, and write outcome receipts only after the visible result.

For a guided playthrough, open `?scene=singapore&lang=zh`, answer the morning card with `1`, use **Go / 前往** on A17, accept it from Lin with `E`, then agree to the readings. Go to the meeting before 11:00 and stay: the overheard conversation, the wait while Zhou talks and the report reminder follow. Stop the readings reminders on a card, skip ahead with ⏩ and read the evening review. The local handoff and receipts illustrate information flow; they do not validate real-world outcomes or a self-evolving policy.

## Framework boundary

This is a **research illustration with authored rules**, not a model benchmark. The open-world quest uses player actions and game-state observations; legacy episodes are scripted. The revised framework has six directed channels: S→A, S→M, M→A, A→S, M→S and A→M. Channels deliver information; Sensing, Memory and Action policies decide how to use it. Legacy episode annotations have not yet all been migrated. Preserve these distinctions when adding a case:

1. Sensing shows an observable cue and its uncertainty.
2. Memory admits scoped information separately from merely seeing it.
3. Action selects an intervention, including checking or waiting.
4. Verification observes an outcome before storing a completion receipt.
5. Priors, current evidence, decisions and receipts remain distinguishable in the trace/report.

Do not replace movement with a camera teleport to make a step pass. Do not write a success receipt before the item handoff finishes. A scripted fixed policy is not self-learning. No camera, microphone or external language model runs in this demo; browser storage contains only this fictional experience's state.

## Test, build, publish

```sh
pnpm build:always-on
pnpm exec tsc --noEmit
pnpm test:always-on
pnpm stage:website
```

Run the build first on a fresh checkout: it also generates the Minecraft data/type artifacts needed by TypeScript. The tests include real Anvil-world movement/collision, pause and cancellation, controls, region cooldowns, HUD interactions and map storage. The stage command copies the tested build into `../game/`; it does not commit or push. Preview the complete project page with Python, check both scenes and a complete automatic episode, then commit `game-src/`, `game/`, and any embedding changes together. Push to `main` to update the existing GitHub Pages site.

For a standalone source checkout, set `ALWAYS_ON_WEBSITE_DIR` to the project website before staging. Build commands force the research configuration and disable the service worker. Dependency versions are locked in `pnpm-lock.yaml`; keep it and `patches/` in sync.

## Upstream and rights

Based on [zardoy/minecraft-web-client](https://github.com/zardoy/minecraft-web-client), upstream baseline `637b62f`, with previous project work through `c39e726` and the current changes in this repository. The original README is retained as `README.UPSTREAM.MD`, alongside its `LICENSE`, `TECH.md`, patches and pinned dependencies. Upstream CI/deployment workflows are not activated here.

Client code, dependencies, Minecraft artwork and third-party campus data have different licenses. See `THIRD_PARTY_NOTICES.txt`, `gpl-dependency-source.zip`, `credits.html`, and each map's `SOURCES.md`. The converted campus is an approximate exterior reconstruction from NTUMap; the original downloaded mesh archive is not included or used at runtime. NPCs, activities, timetables and traffic are fictional. This project is not affiliated with Mojang/Microsoft, NTUMap or Finute.
