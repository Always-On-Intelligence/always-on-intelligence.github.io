/**
 * Chapter director for the campus demo. A chapter first replays what came before it
 * through the same story rules, then plays its own part the way a player would: it
 * takes the shuttle to near a place and walks in, walks verified paths with real physics,
 * faces each target, presses the interaction key only once the prompt allows it and answers
 * cards by their buttons. Every pause scales with the chosen speed; travel, walking and
 * handoffs take the time they take.
 */
import type { Text } from './alwaysOnLoop'
import type { CastId, InteractionId, PlaceId, Point } from './ntuCampusStory'

export type AgendaActionId = 'report.send' | 'readings.on' | 'poster.send'
/** Where a skip lands: the next timed event, a clock time, some minutes later, or when a check is next due. */
export type SkipTarget = { at: number } | { after: number } | { timer: string } | undefined
export type Step = { say?: Text } & (
  | { do: 'travel', place: PlaceId }
  | { do: 'walk', path: readonly Point[] }
  | { do: 'face', target: CastId }
  | { do: 'press', id: InteractionId, handoff?: true }
  | { do: 'answer', card: string, action: string }
  | { do: 'skip', to?: SkipTarget }
  | { do: 'agenda', id: AgendaActionId }
  | { do: 'sleep' }
  | { do: 'read' }
)
export type Chapter = {
  id: string
  title: Text
  /** The README task numbers this chapter shows. */
  tasks: readonly number[]
  /** What to watch for, shown when the chapter starts. */
  lede: Text
  /** What happened before this chapter, replayed through the story rules when it starts. */
  prelude: readonly Beat[]
  /** Where the player stands when the chapter's own part begins, unless it opens with a trip. */
  start: PlaceId
  steps: readonly Step[]
}
/**
 * A prelude beat. `at` moves the clock and runs one rule pass there: far from everything,
 * at a place, or beside a cast member who is in view. `meet` acts on an interaction with its
 * target in view; `answer` clicks a card's button; `clear` puts away cards left from before.
 */
export type Beat =
  | { at: number, where?: PlaceId | CastId }
  | { meet: InteractionId }
  | { answer: string, action?: string }
  | { agenda: AgendaActionId }
  | { sleep: true }
  | { clear: true }
export type Answered = boolean | { travel: PlaceId }
export type DirectorDeps = {
  /** Start over and replay what came before this chapter, through the story rules. */
  prepare: (chapter: Chapter) => void
  /**
   * Hold the campus clock and the story rules while a chapter is set up, so where the last
   * chapter left the player cannot leak into this one.
   */
  hold: (on: boolean) => void
  /** Shuttle there, or to where its walk in starts; resolves once the place is drawn and ready to watch. */
  travel: (place: PlaceId, signal: AbortSignal) => Promise<boolean>
  /** The walk from where the shuttle set down to the place, if it has one. */
  walkIn: (place: PlaceId) => readonly Point[] | undefined
  walk: (path: readonly Point[], signal: AbortSignal) => Promise<{ ok: boolean, reason: string }>
  face: (target: CastId) => void
  canPress: (id: InteractionId) => boolean
  /** Press the interaction key exactly as a player would. */
  press: (id: InteractionId) => Promise<boolean> | boolean
  handoffDone: () => boolean
  showing: (card: string) => boolean
  /** Click a card's button. An answer such as “go to Hall 2” returns the trip for the director to take. */
  answer: (card: string, action: string, signal: AbortSignal) => Promise<Answered> | Answered
  skip: (to: SkipTarget) => boolean
  agenda: (id: AgendaActionId) => boolean
  sleep: () => boolean
  /** Current playback speed: 1, 2 or 4. Read on every pause, so it can change mid-chapter. */
  speed: () => number
  /** Waits count only active service time and reject once the demo is stopped. */
  wait: (ms: number, signal: AbortSignal) => Promise<void>
  onStep: (step: number, of: number, say?: Text) => void
}

/** Long enough to read the prompt, then the subtitles and the panel, at 1×. */
export const BEATS = { settle: 1200, prompt: 1400, read: 3800 }
export const SPEEDS = [1, 2, 4] as const
const cancelled = () => new DOMException('Cancelled', 'AbortError')

export async function runChapter (chapter: Chapter, deps: DirectorDeps, signal: AbortSignal): Promise<void> {
  const pause = async (ms: number) => deps.wait(ms / Math.max(1, deps.speed()), signal)
  const until = async (ready: () => boolean, timeoutMs: number, failure: string) => {
    for (let waited = 0; !ready(); waited += 100) {
      if (waited >= timeoutMs) throw new Error(failure)
      // eslint-disable-next-line no-await-in-loop -- polling must wait for each check in turn
      await deps.wait(100, signal)
    }
  }
  const check = () => {
    if (signal.aborted) throw cancelled()
  }
  const travel = async (place: PlaceId) => {
    if (!await deps.travel(place, signal)) throw signal.aborted ? cancelled() : new Error(`travel-${place}`)
  }
  /** Walk in from where the shuttle set down, then take in the place; the story watches the whole way, as it would a player. */
  const arrive = async (place: PlaceId) => {
    const path = deps.walkIn(place)
    if (path?.length) {
      const result = await deps.walk(path, signal)
      check()
      if (!result.ok) throw new Error(`walk-${result.reason}`)
    }
    await pause(BEATS.settle)
  }
  const play = async (step: Step) => {
    switch (step.do) {
      case 'travel': {
        await travel(step.place)
        await arrive(step.place)
        break
      }
      case 'walk': {
        const result = await deps.walk(step.path, signal)
        check()
        if (!result.ok) throw new Error(`walk-${result.reason}`)
        break
      }
      case 'face': {
        deps.face(step.target)
        await pause(BEATS.settle)
        break
      }
      case 'press': {
        await until(() => deps.canPress(step.id), 8000, `not-in-view-${step.id}`)
        // Hold on the "[E] …" prompt so viewers see which key a player would press.
        await pause(BEATS.prompt)
        if (!await deps.press(step.id)) throw new Error(`refused-${step.id}`)
        if (step.handoff) await until(deps.handoffDone, 20_000, 'handoff-timeout')
        await pause(BEATS.read)
        break
      }
      case 'answer': {
        await until(() => deps.showing(step.card), 8000, `no-card-${step.card}`)
        await pause(BEATS.read)
        const answered = await deps.answer(step.card, step.action, signal)
        if (!answered) throw new Error(`refused-${step.card}`)
        check()
        if (typeof answered === 'object') {
          await travel(answered.travel)
          await arrive(answered.travel)
        } else {
          await pause(BEATS.settle)
        }
        break
      }
      case 'skip': {
        if (!deps.skip(step.to)) throw new Error('skip-failed')
        await pause(BEATS.read)
        break
      }
      case 'agenda': {
        if (!deps.agenda(step.id)) throw new Error(`refused-${step.id}`)
        await pause(BEATS.read)
        break
      }
      case 'sleep': {
        if (!deps.sleep()) throw new Error('sleep-failed')
        await pause(BEATS.settle)
        break
      }
      default: await pause(BEATS.read)
    }
  }
  // A chapter that opens with a trip starts there: one shuttle ride, and walking in is the
  // first thing the story sees.
  const [first] = chapter.steps
  const opening = first?.do === 'travel' ? first.place : undefined
  const start = opening ?? chapter.start
  deps.onStep(0, chapter.steps.length, chapter.lede)
  deps.hold(true)
  try {
    deps.prepare(chapter)
    // The lede is read while the start loads; the story waits for both.
    const [arrived] = await Promise.all([deps.travel(start, signal), pause(BEATS.read)])
    if (!arrived) throw signal.aborted ? cancelled() : new Error(`travel-${start}`)
  } finally {
    deps.hold(false)
  }
  if (!opening) await arrive(start)
  for (const [index, step] of chapter.steps.entries()) {
    check()
    deps.onStep(index + 1, chapter.steps.length, step.say)
    // The opening shuttle was taken while setting up; what is left of that step is the walk in.
    // eslint-disable-next-line no-await-in-loop -- steps run strictly in order
    await (index === 0 && opening ? arrive(opening) : play(step))
  }
  deps.onStep(chapter.steps.length, chapter.steps.length)
}

/** Resolve after `ms` of unpaused time; reject as soon as the demo is stopped. */
export async function waitActive (ms: number, signal: AbortSignal, isPaused: () => boolean, stepMs = 50): Promise<void> {
  return new Promise((resolve, reject) => {
    let left = ms
    let last = Date.now()
    const stop = () => {
      clearInterval(timer)
      reject(cancelled())
    }
    const timer = setInterval(() => {
      const now = Date.now()
      if (!isPaused()) left -= now - last
      last = now
      if (left > 0) return
      clearInterval(timer)
      signal.removeEventListener('abort', stop)
      resolve()
    }, stepMs)
    if (signal.aborted) stop()
    else signal.addEventListener('abort', stop, { once: true })
  })
}
