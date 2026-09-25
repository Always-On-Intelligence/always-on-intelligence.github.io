import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useSnapshot } from 'valtio'
import { activeModalStack, miscUiState } from './globalState'
import { CHANNELS, noteQuietPreference, readLoop, text, type Text } from './alwaysOnLoop'
import AlwaysOnLoopPanel, { AlwaysOnLoopSubtitles } from './alwaysOnLoopPanel'
import { bearingTo, describePrompt } from './alwaysOnPrompt'
import { WEEKDAY, advanceClock, dayOver, dayProgress, formatGameMs, formatMinute, gameMs, skipTo, timeOf } from './ntuCampusClock'
import NtuCampusCards, { CARD_KEYS } from './ntuCampusCards'
import { createCampusCast, type CampusCast } from './ntuCampusCast'
import { chenRecognised } from './ntuCampusErrands'
import { CAST, CAST_IDS, PLACES, agenda, agendaAction, answerCard, displays, interact, interactions, newStory, nextEvent, present, says, startDay2, tickStory, type CampusStory, type CastId, type Interaction, type InteractionId, type PlaceId, type StoryReader } from './ntuCampusStory'
import { createCampusActors } from './ntuLiveEpisodeActors'
import { createNtuLiveEpisodeRuntime } from './ntuLiveEpisodeRuntime'
import { LIVE_ROUTE } from './ntuLiveRoute'
import { CHAPTERS, WALK_INS, replay, skipTarget, walkInStart } from './ntuCampusChapters'
import { BEATS, SPEEDS, runChapter, waitActive, type DirectorDeps } from './ntuCampusDirector'
import { PICKUP_DESK_LABEL, finishPickupHandoff, pickupStage } from './ntuPickupQuest'
import { getNtuCampus, ntuLoopStorage, saveNtuCampus } from './ntuServiceLoop'
import { drawnAround, waitForNtu, waitForNtuTerrain, type ChunkRenderer } from './ntuTerrainReady'
import './ntuCampusHud.css'

type RuntimeOptions = Parameters<typeof createNtuLiveEpisodeRuntime>[0]
type Point = { x: number; y: number; z: number }
type Props = {
  player: RuntimeOptions['bot']; language: 'en' | 'zh'; active: boolean; hidden: boolean; quiet: boolean
  isVisible: (point: Point, range: number) => boolean
  onQuiet: () => void; onInteract: () => void
  /** Shuttle to a stop, or to a checked point to walk in from; resolves false when the trip failed or was cancelled. */
  onTravel: (to: string | Point & { yaw: number }, signal: AbortSignal) => Promise<boolean>
}
/** The chapter demo: choosing, playing (with its step and caption), and how it ended. `all` plays on to the next chapter. */
type DemoState =
  | { status: 'idle' | 'picking' }
  | { status: 'running', chapter: number, step: number, of: number, say?: Text, all: boolean }
  | { status: 'done', chapter: number, all: boolean }
  | { status: 'stopped', chapter: number }
  | { status: 'failed', chapter: number, error: string }
type Prompt = { interaction: Interaction, ready: boolean, distance: number, bearing: number }
/** The curtain over the world during a demo trip: where to, how much of the map is drawn, and on a chapter's first trip its title. */
type Loading = { place: PlaceId, shown: boolean, drawn: number, total: number, chapter?: number }
const targetPoint = (point: Point) => ({ x: point.x - .5, y: point.y + .5, z: point.z - .5 })
/** Targets count as reachable within this distance and as in view within the wider one. */
const REACH_M = 5.5
const SEE_M = 12
/** The centre prompt guides you toward targets this close. */
const PROMPT_RANGE_M = 30
/** Lin, the steward and the desk of the A17 scene are built once you come this close to S-Lab. */
const SLAB_BUILD_M = 80
/** After a shuttle trip the demo waits at least this long, at any speed, before moving on. */
const TRAVEL_SETTLE_MS = 1000
/** The curtain closes over this long before the shuttle jumps. */
const CURTAIN_MS = 350
/** A place usually draws in 5–10 s; past this, on a slow device, the demo goes on with what is drawn. */
const SCENE_TIMEOUT_MS = 45_000
/** Within this distance of a place its agenda item offers no shuttle. */
const HERE_M = 60
/** Drawn by the A17 scene; the cast module only adds tags, bubbles and pins to them. */
const A17_CAST: readonly CastId[] = ['lin', 'steward', 'desk']
/** Any of these keys hands control back to the player during the demo. */
const TAKEOVER_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
const isTyping = (event: KeyboardEvent) => Boolean((event.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]'))
const short = (name: Text) => text(name.en.split(' · ')[0], name.zh.split(' · ')[0])
/** Props turn their fronts toward where visitors arrive. */
const MEMBERS = Object.fromEntries(CAST_IDS.map(id => [id, { ...CAST[id], ...(CAST[id].kind === 'prop' ? { aim: PLACES[CAST[id].place].at } : {}) }])) as Record<CastId, typeof CAST[CastId] & { aim?: Point }>
const FAILURE: ReadonlyArray<readonly [string, Text]> = [
  ['quiet', text('Quiet mode holds the cards the chapters answer. Switch it off first.', '安静模式会扣住演示要回答的卡片，先把它关掉。')],
  ['prelude', text('Setting up the chapter failed.', '准备这一章的前情时出错了。')],
  ['travel', text('Could not get to the next place.', '没能到达下一个地点。')],
  ['terrain', text('Terrain along the route has not loaded yet.', '路线上的地形还没加载完。')],
  ['walk', text('The walk was blocked or interrupted.', '行走被挡住或被打断了。')],
  ['not-in-view', text('The target did not come into view.', '目标没有进入视野。')],
  ['no-card', text('A card the chapter expected did not appear.', '这一章等的卡片没有出现。')],
  ['handoff', text('The handoff did not finish.', '交接没有完成。')],
  ['refused', text('That step was not allowed at that moment.', '这一步当时不被允许。')],
  ['skip', text('There was nothing to skip ahead to.', '没有可以快进到的事。')]
]
const describeFailure = (error: string) => FAILURE.find(([prefix]) => error.startsWith(prefix))?.[1] ?? text('Something interrupted the demo.', '演示被打断了。')
const stop = (event: { stopPropagation: () => void }) => event.stopPropagation()

/**
 * Host for the two campus days: the clock, the cast, explicit reminder cards, your own
 * agenda, the interaction prompt and the live S/M/A panel. The player drives every
 * interaction; the optional demo director uses the same actions and route.
 */
export default function NtuCampusHud (props: Props) {
  const { loop, story } = getNtuCampus()
  const snap = useSnapshot(loop.state)
  const storySnap = useSnapshot(story)
  const { saved } = useSnapshot(ntuLoopStorage)
  const { currentTouch } = useSnapshot(miscUiState)
  const [paused, setPaused] = useState(true)
  const [prompt, setPrompt] = useState<Prompt>()
  const [handingOver, setHandingOver] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [pressingCard, setPressingCard] = useState<{ card: string, action: string }>()
  const [resetArmed, setResetArmed] = useState(false)
  const [demo, setDemo] = useState<DemoState>({ status: 'idle' })
  const [speed, setSpeed] = useState(1)
  const speedRef = useRef(1)
  const [subtitlesSince, setSubtitlesSince] = useState(0)
  const [travelling, setTravelling] = useState<PlaceId>()
  const [loading, setLoading] = useState<Loading>()
  const pendingHandoff = useRef<'collect' | 'deliver'>()
  const demoAbort = useRef<AbortController>()
  /** While a demo chapter is set up, the clock and the story rules wait. */
  const holdTicks = useRef(false)
  const travelAbort = useRef<AbortController>()
  const current = useRef(props); current.current = props
  const actors = useRef<ReturnType<typeof createCampusActors>>()
  const cast = useRef<CampusCast>()
  const runtimeRef = useRef<ReturnType<typeof createNtuLiveEpisodeRuntime>>()
  const check = useRef<() => void>(() => {})
  /** The interaction the key would perform right now, and the target the prompt points at. */
  const chosen = useRef<Interaction>()
  const guided = useRef<CastId>()
  const arrowRef = useRef<HTMLElement>(null)
  const zh = props.language === 'zh'
  const tr = (en: string, cn: string) => (zh ? cn : en)
  const available = () => current.current.active && !document.hidden && !activeModalStack.length
  const standing = (id: CastId) => (A17_CAST.includes(id) ? Boolean(actors.current) : Boolean(cast.current?.standing(id)))
  const measure = () => {
    const position = props.player.entity?.position
    const at = position ? { x: position.x, y: position.y, z: position.z } : undefined
    const sees: Partial<Record<CastId, boolean>> = {}
    const reach: Partial<Record<CastId, boolean>> = {}
    const distances: Partial<Record<CastId, number>> = {}
    for (const id of at ? CAST_IDS : []) {
      if (!present(story, id)) continue
      const target = CAST[id].at
      const far = Math.hypot(at!.x - target.x, at!.z - target.z)
      distances[id] = far
      // Only a figure standing in the world, in clear view right now, counts as seen.
      if (far > SEE_M + 1 || !available() || !standing(id)) continue
      if (current.current.isVisible(targetPoint(target), SEE_M)) sees[id] = true
      if (far <= REACH_M + 1 && current.current.isVisible(targetPoint(target), REACH_M)) reach[id] = true
    }
    return { at, sees, reach, distances }
  }

  // Switching quiet mode is a sensed user choice; Memory keeps it for later Action decisions.
  useEffect(() => { noteQuietPreference(loop, props.quiet) }, [props.quiet])
  // Playing all chapters: the next one starts once the opened panel has been seen.
  useEffect(() => {
    if (demo.status !== 'done' || !demo.all || demo.chapter + 1 >= CHAPTERS.length) return
    const timer = setTimeout(() => startChapter(demo.chapter + 1, true), BEATS.read / speedRef.current)
    return () => clearTimeout(timer)
  }, [demo])
  // A second click within three seconds confirms a reset.
  useEffect(() => {
    if (!resetArmed) return
    const timer = setTimeout(() => setResetArmed(false), 3000)
    return () => clearTimeout(timer)
  }, [resetArmed])
  // The agenda gives way to the S/M/A panel and may show only a few rows; keep the item that matters now in view.
  const agendaRef = useRef<HTMLUListElement>(null)
  const agendaFocus = useRef<{ list?: HTMLElement, id?: string }>({})
  useEffect(() => {
    const list = agendaRef.current
    const row = list?.querySelector<HTMLElement>('li[data-state=now]') ?? list?.querySelector<HTMLElement>('li[data-state=todo]')
    if (!list || !row || (agendaFocus.current.list === list && agendaFocus.current.id === row.dataset.id)) return
    agendaFocus.current = { list, id: row.dataset.id }
    list.scrollTo({ top: Math.max(0, row.offsetTop - list.offsetTop - 4), behavior: 'smooth' })
  })

  useEffect(() => {
    let runtime: ReturnType<typeof createNtuLiveEpisodeRuntime> | undefined
    let ownedActors: ReturnType<typeof createCampusActors> | undefined
    let ownedCast: CampusCast | undefined
    let frame = 0; let lastFrame = performance.now(); let lastCheck = performance.now()
    let shownStage = ''
    let runtimeHeld = false
    const run = () => {
      const now = performance.now(); const deltaMs = now - lastCheck; lastCheck = now
      const active = available()
      const position = props.player.entity?.position
      const renderer = window.world as unknown as RuntimeOptions['renderer']
      if (active && !runtime && renderer?.sceneOrigin) runtime = runtimeRef.current = createNtuLiveEpisodeRuntime({ bot: props.player, renderer })
      if (runtime && !ownedCast) ownedCast = cast.current = createCampusCast({ scene: runtime.scene, getGroundHeight: point => runtime!.getGroundHeight(point), members: MEMBERS, external: A17_CAST })
      // Wait for loaded terrain; do not spawn floating actors in unloaded chunks.
      if (active && runtime && ownedCast && !ownedActors && position && Math.hypot(position.x - LIVE_ROUTE.colleague.x, position.z - LIVE_ROUTE.colleague.z) < SLAB_BUILD_M
        && [LIVE_ROUTE.colleague, LIVE_ROUTE.steward, LIVE_ROUTE.pickup].every(point => Number.isFinite(runtime!.getGroundHeight(point)))) {
        ownedActors = actors.current = createCampusActors(THREE, { scene: runtime.scene, getGroundHeight: point => runtime!.getGroundHeight(point), deskLabel: `S-LAB / ${PICKUP_DESK_LABEL}` })
        ownedActors.show()
        // Pins now come from the cast module, one per available target.
        ownedActors.setMarker(null)
        ownedCast.attach('lin', ownedActors.colleague)
        ownedCast.attach('steward', ownedActors.steward)
      }
      // A paused service makes no observations and no decisions, and its clock stands still.
      const ticking = active && !holdTicks.current
      if (ticking) advanceClock(story.clock, deltaMs)
      const measured = measure()
      if (ticking && !pendingHandoff.current) tickStory(loop, story, { at: measured.at, sees: measured.sees })
      const options = interactions(loop, story)
      const distance = (option: Interaction) => measured.distances[option.target] ?? Number.POSITIVE_INFINITY
      const nearest = (a: Interaction, b: Interaction) => distance(a) - distance(b)
      // E acts on what you look at: the target closest to the centre of view, then the nearest.
      const offCentre = (option: Interaction) => Math.abs(bearingTo(props.player.entity, CAST[option.target].at))
      const ready = options.filter(option => measured.reach[option.target]).sort((a, b) => offCentre(a) - offCentre(b) || nearest(a, b))[0]
      const guide = ready ?? options.filter(option => !option.unmarked && distance(option) <= PROMPT_RANGE_M).sort(nearest)[0]
      chosen.current = ready
      guided.current = guide?.target
      setPaused(!active)
      setPrompt(guide && active ? { interaction: guide, ready: Boolean(ready), distance: distance(guide), bearing: bearingTo(props.player.entity, CAST[guide.target].at) } : undefined)
      const lang = current.current.language
      // Tags and pins are the glasses' overlay, so someone they do not recognise gets neither.
      const known = (id: CastId) => id !== 'chenLibrary' || chenRecognised(loop, story)
      ownedCast?.sync({
        present: Object.fromEntries(CAST_IDS.map(id => [id, present(story, id)])),
        says: Object.fromEntries(CAST_IDS.flatMap(id => {
          const line = says(loop, story, id)
          return line ? [[id, line[lang]]] : []
        })),
        names: Object.fromEntries(CAST_IDS.filter(known).map(id => [id, CAST[id].name[lang]])),
        pins: options.filter(option => !option.unmarked).map(option => option.target),
        displays: displays(story)
      })
    }
    check.current = run
    const animate = (time: number) => {
      const dt = Math.min(.1, (time - lastFrame) / 1000); lastFrame = time
      // Turn the guidance arrow every frame; the rest of the prompt refreshes with each check.
      const target = guided.current
      if (arrowRef.current && target && props.player.entity) arrowRef.current.style.transform = `rotate(${bearingTo(props.player.entity, CAST[target].at)}rad)`
      // During the demo the runtime walks and turns the player, and holds still whenever service pauses.
      if (runtime && demoAbort.current) {
        const hold = !available()
        if (hold !== runtimeHeld) { runtime.setPaused(hold); runtimeHeld = hold }
        runtime.update(dt)
      }
      if (runtime && available()) {
        const camera = runtime.getCamera()
        ownedCast?.update(dt, camera.position)
        if (ownedActors) {
          const pending = pendingHandoff.current
          const visualStage = pending === 'collect' ? 'carrying' : pending === 'deliver' ? 'completed' : pickupStage(loop)
          if (shownStage !== visualStage) {
            ownedActors.setParcel(visualStage === 'completed' ? 'delivered' : visualStage === 'carrying' ? 'carried' : 'desk')
            shownStage = visualStage
          }
          ownedActors.update(dt, camera.position, camera.quaternion)
          if (pending && !ownedActors.isTransferring()) {
            // The receipt is written only now, after the visible handoff finished.
            pendingHandoff.current = undefined
            finishPickupHandoff(loop, pending)
            setHandingOver(false)
          }
        }
      }
      frame = requestAnimationFrame(animate)
    }
    const key = (event: KeyboardEvent) => {
      if (demoAbort.current && TAKEOVER_KEYS.has(event.code) && !isTyping(event)) demoAbort.current.abort()
      if (isTyping(event) || !available()) return
      // Number keys answer the newest card; elsewhere they keep choosing hotbar slots.
      const slot = (CARD_KEYS as readonly string[]).indexOf(event.code)
      const newest = loop.state.action.cards.at(-1)
      if (slot >= 0 && newest?.actions[slot]) {
        event.preventDefault(); event.stopImmediatePropagation()
        if (!event.repeat && !demoAbort.current) answer(newest.id, newest.actions[slot].id)
        return
      }
      // Elsewhere E opens the Minecraft inventory; consume it only at a story target.
      if (event.code !== 'KeyE' || (!chosen.current && !pendingHandoff.current)) return
      event.preventDefault(); event.stopImmediatePropagation()
      if (event.repeat || demoAbort.current || !chosen.current) return
      setPressed(true)
      setTimeout(() => setPressed(false), 180)
      act(chosen.current.id)
    }
    run(); frame = requestAnimationFrame(animate)
    const timer = setInterval(run, 500)
    document.addEventListener('keydown', key, true)
    return () => {
      clearInterval(timer); cancelAnimationFrame(frame)
      document.removeEventListener('keydown', key, true)
      demoAbort.current?.abort(); demoAbort.current = undefined
      travelAbort.current?.abort(); travelAbort.current = undefined
      // Leaving mid-handoff cancels it: no receipt is written for an unfinished transfer.
      pendingHandoff.current = undefined
      check.current = () => {}
      saveNtuCampus()
      ownedCast?.dispose(); ownedActors?.dispose(); runtime?.dispose()
      cast.current = undefined; actors.current = undefined; runtimeRef.current = undefined
    }
  }, [props.player])

  /** Tick right after an answer or a step, in its own turn so it forms its own step. */
  const soon = () => setTimeout(() => check.current(), 0)
  const act = (id: InteractionId): boolean => {
    if (pendingHandoff.current || !available()) return false
    const measured = measure()
    const result = interact(loop, story, id, { at: measured.at, sees: measured.reach })
    if (!result) return false
    current.current.onInteract()
    if (id === 'a17.accept' || id === 'readings.agree') actors.current?.gesture('colleague', 'talk')
    if (result === 'handoff') {
      pendingHandoff.current = id === 'a17.collect' ? 'collect' : 'deliver'
      actors.current?.gesture(id === 'a17.collect' ? 'steward' : 'colleague', 'handoff')
      setHandingOver(true)
    }
    soon()
    return true
  }
  /** The user's explicit reset. Unlike ending an interaction, it deletes what the loop kept. */
  const resetAll = () => {
    pendingHandoff.current = undefined
    setHandingOver(false)
    setResetArmed(false)
    Object.assign(story, newStory())
    loop.reset(text('You started over. Memory, the trace, cards and timers were deleted; the campus is back to Monday 09:00.', '你重新开始了：记忆、记录、卡片和计时都已删除，校园回到周一 09:00。'))
    noteQuietPreference(loop, current.current.quiet)
    soon()
  }
  const answer = (card: string, action: string): boolean => {
    const result = answerCard(loop, story, card, action)
    if (result === 'reset') resetAll()
    else if (typeof result === 'object') travel(result.travel)
    else if (result) soon()
    return Boolean(result)
  }
  const reader = (): StoryReader => ({ ...readLoop(loop.state), state: loop.state })
  const skip = () => {
    const next = nextEvent(reader(), story)
    if (next && skipTo(story.clock, next.at)) soon()
  }
  const travel = (place: PlaceId) => {
    if (travelAbort.current || demoAbort.current) return
    const abort = new AbortController()
    travelAbort.current = abort
    setTravelling(place)
    void current.current.onTravel(PLACES[place].stop, abort.signal).finally(() => {
      if (travelAbort.current !== abort) return
      travelAbort.current = undefined
      setTravelling(undefined)
    })
  }
  /** Play one chapter; with `all`, the next one follows when it ends. */
  const startChapter = (index: number, all = false) => {
    if (demoAbort.current || !available()) return
    const chapter = CHAPTERS[index]
    if (current.current.quiet) {
      setDemo({ status: 'failed', chapter: index, error: 'quiet' })
      return
    }
    const abort = new AbortController()
    demoAbort.current = abort
    setDemo({ status: 'running', chapter: index, step: 0, of: chapter.steps.length, say: chapter.lede, all })
    const isPaused = () => !available()
    const pause = async (ms: number) => waitActive(ms / speedRef.current, abort.signal, isPaused)
    /** The chapter's first trip carries its title card. */
    let started = false
    /** A place is ready to watch once every chunk in view is drawn and its cast is standing. */
    const drawn = async (place: PlaceId, signal: AbortSignal) => {
      const members = CAST_IDS.filter(id => CAST[id].place === place && present(story, id))
      return waitForNtu({
        ready () {
          const renderer = window.world as unknown as Partial<ChunkRenderer> | undefined
          const at = current.current.player.entity?.position
          if (!at) return false
          // Without the renderer's chunk state there is nothing to wait for beyond the cast.
          if (renderer?.finishedChunks && Number.isFinite(renderer.viewDistance)) {
            const view = drawnAround(renderer as ChunkRenderer, at)
            setLoading(state => (state && (state.drawn !== view.drawn || state.total !== view.total) ? { ...state, ...view } : state))
            if (view.drawn < view.total) return false
          }
          return members.every(standing)
        },
        signal, isPaused, timeoutMs: SCENE_TIMEOUT_MS, pollMs: 200
      })
    }
    const deps: DirectorDeps = {
      hold (on) { holdTicks.current = on },
      prepare (entry) {
        resetAll()
        try {
          replay(loop, story, entry.prelude)
        } catch (error) {
          throw new Error(`prelude: ${error instanceof Error ? error.message : String(error)}`)
        }
        // The replayed prelude is the story so far, not something to narrate again.
        setSubtitlesSince(loop.state.step)
      },
      async travel (place, signal) {
        // A curtain hides the jump and the map being drawn. The story waits meanwhile, so
        // however long drawing takes, arriving is the next thing it sees.
        const held = holdTicks.current
        holdTicks.current = true
        setLoading({ place, shown: true, drawn: 0, total: 0, chapter: started ? undefined : index })
        try {
          await waitActive(CURTAIN_MS, signal, isPaused)
          // The demo sets down a short walk away, so the scene begins on foot.
          if (!await current.current.onTravel(walkInStart(place) ?? PLACES[place].stop, signal)) return false
          // The shuttle's last position corrections arrive after it resolves; walking before then reads as being pushed.
          const [ready] = await Promise.all([drawn(place, signal), waitActive(TRAVEL_SETTLE_MS, signal, isPaused)])
          if (!ready) console.warn(`Chapter demo: ${place} was still being drawn after ${SCENE_TIMEOUT_MS / 1000} s; going on.`)
          return true
        } finally {
          holdTicks.current = held
          setLoading(state => state && { ...state, shown: false })
        }
      },
      walkIn: place => WALK_INS[place],
      async walk (points, signal) {
        for (let waited = 0; !runtimeRef.current; waited += 100) {
          if (waited >= 20_000) return { ok: false, reason: 'not-ready' }
          // eslint-disable-next-line no-await-in-loop -- polling must wait for each check in turn
          await waitActive(100, signal, isPaused)
        }
        if (!await waitForNtuTerrain({ points, getGroundHeight: point => runtimeRef.current?.getGroundHeight(point), signal, isPaused })) return { ok: false, reason: 'terrain' }
        // Walking keeps normal speed at any playback speed: the local server corrects a faster gait.
        return runtimeRef.current ? runtimeRef.current.autoWalk(points, undefined, signal) : { ok: false, reason: 'not-ready' }
      },
      face (target) {
        const { at } = CAST[target]
        runtimeRef.current?.lookAt({ x: at.x, y: at.y + 1, z: at.z })
      },
      canPress: id => !pendingHandoff.current && available() && chosen.current?.id === id,
      async press (id) {
        // Show the key going down, then take exactly the player's path.
        setPressed(true)
        await pause(320)
        setPressed(false)
        return chosen.current?.id === id && act(id)
      },
      handoffDone: () => !pendingHandoff.current,
      showing: card => loop.showing(card),
      async answer (card, action, signal) {
        // Show the button going down, then answer exactly as a click would.
        setPressingCard({ card, action })
        await pause(420)
        setPressingCard(undefined)
        const result = answerCard(loop, story, card, action)
        if (result) soon()
        // A trip the answer asks for is the director's to take, walk in included.
        return typeof result === 'object' ? result : Boolean(result)
      },
      skip (to) {
        const target = skipTarget(reader(), story, gameMs(story.clock), to)
        if (target === undefined || !skipTo(story.clock, target)) return false
        soon()
        return true
      },
      agenda (id) {
        const done = agendaAction(loop, story, id)
        if (done) soon()
        return done
      },
      sleep () {
        const done = startDay2(loop, story)
        if (done) soon()
        return done
      },
      speed: () => speedRef.current,
      wait: async (ms, signal) => waitActive(ms, signal, isPaused),
      onStep (step, of, say) {
        if (step > 0) started = true
        if (demoAbort.current === abort) setDemo({ status: 'running', chapter: index, step, of, say, all })
      }
    }
    void runChapter(chapter, deps, abort.signal).then(() => {
      if (demoAbort.current === abort) setDemo({ status: 'done', chapter: index, all })
    }, (error: unknown) => {
      if (demoAbort.current !== abort) return
      setDemo(abort.signal.aborted ? { status: 'stopped', chapter: index } : { status: 'failed', chapter: index, error: error instanceof Error ? error.message : String(error) })
    }).finally(() => {
      if (demoAbort.current !== abort) return
      demoAbort.current = undefined
      holdTicks.current = false
      setLoading(state => state && { ...state, shown: false })
      setPressed(false)
      setPressingCard(undefined)
      // Release the camera and controls to the player.
      runtimeRef.current?.stop()
    })
  }
  const setPlaybackSpeed = (value: number) => {
    speedRef.current = value
    setSpeed(value)
  }

  if (props.hidden) return null
  const read: StoryReader = { ...readLoop(snap), state: snap }
  // Story reads never write, so the render snapshot can stand in for the live story.
  const storyView = storySnap as unknown as CampusStory
  const { day, minute } = storySnap.clock
  const formatTime = (at: number) => formatGameMs(at, props.language, day)
  const next = nextEvent(read, storyView)
  const over = dayOver(storySnap.clock)
  const items = agenda(read, storyView)
  const running = demo.status === 'running'
  const used = CHANNELS.filter(channel => (snap.counts[channel] ?? 0) > 0).length
  const closeDemo = () => setDemo({ status: 'idle' })
  const chapterName = (index: number) => (zh ? `第 ${index + 1}/${CHAPTERS.length} 章 · ${CHAPTERS[index].title.zh}` : `Chapter ${index + 1}/${CHAPTERS.length} · ${CHAPTERS[index].title.en}`)
  const speeds = <span className='ntu-speed' role='group' aria-label={tr('Playback speed', '播放速度')}>{SPEEDS.map(value => <button key={value} aria-pressed={speed === value} onClick={() => setPlaybackSpeed(value)}>{value}×</button>)}</span>
  const shown = prompt && !handingOver && !paused && !loading?.shown
    ? describePrompt({ target: prompt.interaction.name ?? short(CAST[prompt.interaction.target].name), action: prompt.interaction.action, distance: prompt.distance, bearing: prompt.bearing, ready: prompt.ready, touch: Boolean(currentTouch), reach: REACH_M }, props.language)
    : undefined
  const frozen = snap.frozen.includes('A → M')
  const position = props.player.entity?.position
  const here = (place: PlaceId) => Boolean(position && Math.hypot(position.x - PLACES[place].at.x, position.z - PLACES[place].at.z) <= HERE_M)
  // Quiet mode governs Action's interruptions, so its switch sits in the Action module.
  const quietSwitch = <button className='ntu-quest-quiet' aria-pressed={props.quiet} onClick={props.onQuiet}>{props.quiet ? tr('Quiet: on', '安静：开') : tr('Quiet: off', '安静：关')}</button>
  const research = <div className='ao-loop-research'>
    <strong>{tr('Researcher control: cut the write-back only', '研究者对照：只断开写回')}</strong>
    <span>{tr('Stopping a reminder is your intervention, and it changes three things at once: no reminder, no record, one prompt fewer for you. This control changes one: reminders still show, only A → M is frozen (Table 25). Then watch:', '“不再提醒”是用户的干预，一下子改了三件事：不提醒、不记录、你少了一个提示。这里只改一件：提醒照发，只冻结 A→M（表 25）。然后看：')}</span>
    <ol>
      <li>{tr('It cannot remember having just reminded you: answer the card and it reminds again.', '它记不住刚提醒过：你一回应卡片，它马上又提醒。')}</li>
      <li>{tr('When you check the readings, nothing links the check to a reminder.', '你去看读数，连不上是哪次提醒起的作用。')}</li>
      <li>{tr('The evening review cannot count the reminders.', '傍晚复盘数不出提醒了几次。')}</li>
    </ol>
    <button aria-pressed={frozen} onClick={() => loop.setFrozen('A → M', !frozen)}>{frozen ? tr('A → M frozen · restore', 'A→M 已冻结 · 恢复') : tr('Freeze A → M', '冻结 A→M')}</button>
  </div>
  return <>
    <div className='ntu-curtain' data-shown={Boolean(loading?.shown)} aria-hidden={!loading?.shown}>
      {loading && <div>
        {loading.chapter !== undefined && <>
          <small>{tr(`Chapter ${loading.chapter + 1}/${CHAPTERS.length} · Task ${CHAPTERS[loading.chapter].tasks.join(', ')}`, `第 ${loading.chapter + 1}/${CHAPTERS.length} 章 · 任务 ${CHAPTERS[loading.chapter].tasks.join('、')}`)}</small>
          <h2>{CHAPTERS[loading.chapter].title[props.language]}</h2>
          <p>{CHAPTERS[loading.chapter].lede[props.language]}</p>
        </>}
        <span className='ntu-curtain-load' role='status'>
          <strong>{tr('To', '前往')} {PLACES[loading.place].name[props.language]}</strong>
          <i aria-hidden='true'><b style={{ width: `${loading.total ? loading.drawn / loading.total * 100 : 0}%` }} /></i>
          <small>{loading.total && loading.drawn >= loading.total ? tr('Map drawn', '地图已就绪') : tr(`Drawing the map · ${loading.drawn}/${loading.total || '…'}`, `地图加载中 · ${loading.drawn}/${loading.total || '…'}`)}</small>
        </span>
      </div>}
    </div>
    <div className='ntu-top'>
      <div className='ntu-clock ao-interactive' role='group' aria-label={tr('Campus clock', '校园时钟')} data-paused={paused} onPointerDown={stop} onMouseDown={stop}>
        <span>{zh ? `第${day === 1 ? '一' : '二'}天 · ${WEEKDAY[day].zh}` : `Day ${day} · ${WEEKDAY[day].en}`}</span>
        <strong>{formatMinute(minute)}</strong>
        <i className='ntu-clock-bar' aria-hidden='true'><b style={{ width: `${dayProgress(storySnap.clock) * 100}%` }} /></i>
        {paused && !over && <small>{tr('Paused', '已暂停')}</small>}
        {!over && next && <button disabled={running || paused} title={tr('Skip ahead to the next timed event', '快进到下一件定时的事')} onClick={skip}>⏩ {timeOf(next.at)} {next.label[props.language]}</button>}
        {over && day === 1 && <button onClick={() => { if (startDay2(loop, story)) soon() }}>☾ {tr('Sleep · start day 2', '睡觉 · 进入第二天')}</button>}
        {over && day === 2 && <button onClick={resetAll}>↺ {tr('Play both days again', '从头再玩')}</button>}
      </div>
      {demo.status === 'picking' && <div className='ntu-chapters ao-interactive' role='dialog' aria-label={tr('Chapter demo', '章节演示')} onPointerDown={stop} onMouseDown={stop} onWheel={stop}>
        <header><b>{tr('CHAPTER DEMO', '章节演示')}</b>{speeds}<button aria-label={tr('Close', '关闭')} onClick={closeDemo}>×</button></header>
        <p>{tr('Each chapter sets up what came before it through the same rules, then plays its part as a player would. WASD takes over at any time.', '每章先按同样的规则快速重放前情，再像玩家一样演完自己那一段。按 WASD 可随时接管。')}</p>
        <button className='ntu-chapters-all' onClick={() => startChapter(0, true)}>▶ {tr('Play all 12 chapters', '从头连播全部 12 章')}</button>
        <ol>{CHAPTERS.map((entry, index) => <li key={entry.id}><button onClick={() => startChapter(index)}>
          <i>{index + 1}</i><span><strong>{entry.title[props.language]}</strong><small>{tr(`Task ${entry.tasks.join(', ')}`, `任务 ${entry.tasks.join('、')}`)}</small></span>
        </button></li>)}</ol>
      </div>}
      {demo.status !== 'idle' && demo.status !== 'picking' && <div className='ntu-demo-bar ao-interactive' role='status' data-status={demo.status} onPointerDown={stop} onMouseDown={stop}>
        {demo.status === 'running' && <>
          <div>
            <b>▶ {chapterName(demo.chapter)}{demo.step > 0 && ` · ${tr(`step ${demo.step}/${demo.of}`, `第 ${demo.step}/${demo.of} 步`)}`}</b>
            {demo.say && <span>{demo.say[props.language]}</span>}
            <small>{demo.step === 0 ? tr('Replaying what came before…', '正在按规则重放前情…') : tr('Press WASD to take over at any time.', '按 WASD 可随时接管。')}</small>
          </div>
          {speeds}
          {demo.chapter + 1 < CHAPTERS.length && <button onClick={() => { demoAbort.current?.abort(); setTimeout(() => startChapter(demo.chapter + 1, demo.all), 0) }}>{tr('Next', '下一章')}</button>}
          <button onClick={() => demoAbort.current?.abort()}>{tr('Stop', '停止')}</button>
        </>}
        {demo.status === 'done' && <>
          <div><b>✓ {chapterName(demo.chapter)}</b><span>{demo.all && demo.chapter + 1 < CHAPTERS.length ? tr('Next chapter coming…', '马上开始下一章…') : tr(`Done. ${used}/6 channels used so far; you can play on from here.`, `这一章演完了。目前用到 ${used}/6 条通路，可以从这里接着玩。`)}</span></div>
          <button onClick={() => startChapter(demo.chapter)}>{tr('Replay', '重播')}</button>
          {demo.chapter + 1 < CHAPTERS.length && !demo.all && <button onClick={() => startChapter(demo.chapter + 1)}>{tr('Next', '下一章')}</button>}
          <button onClick={() => setDemo({ status: 'picking' })}>{tr('Chapters', '章节')}</button>
          <button aria-label={tr('Close', '关闭')} onClick={closeDemo}>×</button>
        </>}
        {demo.status === 'stopped' && <>
          <div><b>{tr('DEMO STOPPED', '演示已停止')}</b><span>{tr('You have control now.', '现在由你操作。')}</span></div>
          <button onClick={() => setDemo({ status: 'picking' })}>{tr('Chapters', '章节')}</button>
          <button aria-label={tr('Close', '关闭')} onClick={closeDemo}>×</button>
        </>}
        {demo.status === 'failed' && <>
          <div><b>{tr('DEMO INTERRUPTED', '演示中断')}</b><span>{describeFailure(demo.error)[props.language]}</span><small>{demo.error}</small></div>
          {demo.error !== 'quiet' && <button onClick={() => startChapter(demo.chapter)}>{tr('Try again', '重试')}</button>}
          <button onClick={() => setDemo({ status: 'picking' })}>{tr('Chapters', '章节')}</button>
          <button aria-label={tr('Close', '关闭')} onClick={closeDemo}>×</button>
        </>}
      </div>}
      <NtuCampusCards state={snap} language={props.language} formatTime={formatTime} onAnswer={answer} pressing={pressingCard} />
    </div>
    {/* The wheel scrolls these panels; left to bubble, the hotbar takes it and cancels the scroll. */}
    <aside className='ntu-quest ao-interactive' aria-label={tr('Your day', '你的日程')} onPointerDown={stop} onMouseDown={stop} onWheel={stop}>
      <header><span>{tr('TWO CAMPUS DAYS · GLASSES ALWAYS ON', '校园两天 · 眼镜常开')}</span><small>{saved ? tr('Saved locally', '本地已保存') : tr('Not saved', '未能保存')}</small></header>
      <h2>{tr('Your day', '你的日程')}</h2>
      <ul className='ntu-agenda' ref={agendaRef}>{items.map(item => <li key={item.id} data-id={item.id} data-state={item.state}>
        <i aria-hidden='true'>{item.state === 'done' ? '✓' : item.state === 'missed' ? '×' : item.state === 'now' ? '●' : '○'}</i>
        <span><strong>{item.title[props.language]}</strong><small>{item.detail[props.language]}</small></span>
        {item.action ? <button disabled={running} onClick={() => { if (agendaAction(loop, story, item.action!.id)) soon() }}>{item.action.label[props.language]}</button>
          : item.place && item.state !== 'done' && !here(item.place) && <button disabled={Boolean(travelling) || running || paused} onClick={() => travel(item.place!)}>{travelling === item.place ? tr('Going…', '前往中…') : tr('Go', '前往')}</button>}
      </li>)}</ul>
      <small className='ntu-quest-hint'>{tr('E: act on a pinned person or thing · 1–3: answer a card · Tab: free the mouse', 'E：和带定位针的人或物互动 · 1–3：回答卡片 · Tab：放开鼠标')}</small>
      <div className='ntu-quest-tools'>
        <button disabled={running || paused} onClick={() => setDemo({ status: 'picking' })}>▶ {tr('Chapter demo', '章节演示')}</button>
        {(snap.memory.length > 0 || snap.trace.length > 1 || storySnap.clock.day > 1) && <button disabled={running} data-armed={resetArmed} onClick={() => { if (resetArmed) resetAll(); else setResetArmed(true) }}>
          {resetArmed ? tr('Click again to start over', '再点一次确认') : `↺ ${tr('Start over', '从头开始')}`}
        </button>}
      </div>
      {/* Folded while things happen; a chapter's end or the evening opens it for a look back. */}
      <AlwaysOnLoopPanel
        state={snap} language={props.language} paused={paused} actionTools={quietSwitch} formatTime={formatTime} research={research}
        since={subtitlesSince} reveal={demo.status === 'done' || over}
        sensingTools={<span className='ntu-battery' data-low={storySnap.world.battery < 25} title={tr('Glasses battery', '眼镜电量')}>{tr('Battery', '电量')} {Math.round(storySnap.world.battery)}%</span>} />
      {!saved && <p role='alert'>{tr('Browser storage failed. Progress may be lost on reload.', '浏览器存储失败，刷新可能丢失进度。')}</p>}
    </aside>
    {shown?.mode === 'act' && <button className='ntu-quest-prompt ao-interactive' data-mode='act' data-pressed={pressed} onPointerDown={stop} onMouseDown={stop} onClick={() => { if (chosen.current) act(chosen.current.id) }}>
      <kbd>{shown.key}</kbd><span><strong>{shown.headline}</strong><small>{shown.detail}</small></span>
    </button>}
    {shown?.mode === 'guide' && <div className='ntu-quest-prompt' data-mode='guide' role='status'>
      <i ref={arrowRef} aria-hidden='true' style={{ transform: `rotate(${prompt!.bearing}rad)` }}>↑</i><span><strong>{shown.headline}</strong><small>{shown.detail}</small></span>
    </div>}
    <AlwaysOnLoopSubtitles state={snap} language={props.language} since={subtitlesSince} />
  </>
}
