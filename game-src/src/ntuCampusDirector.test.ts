import { afterEach, expect, test, vi } from 'vitest'
import { A17_ROUTE, PRINTER_PATH, WALK_INS, walkInStart } from './ntuCampusChapters'
import { BEATS, runChapter, waitActive, type Chapter, type DirectorDeps } from './ntuCampusDirector'
import { text } from './alwaysOnLoop'
import { CAST, CAST_IDS, PLACES, PLACE_IDS, type PlaceId, type Point } from './ntuCampusStory'
import { LIVE_ROUTE } from './ntuLiveRoute'

const chapter: Chapter = {
  id: 'test', title: text('Test', '测试'), tasks: [0], lede: text('Watch this.', '看这里。'), prelude: [], start: 'hive',
  steps: [
    { do: 'travel', place: 'slab' },
    { do: 'walk', path: A17_ROUTE.toColleague },
    { do: 'face', target: 'lin', say: text('Face Lin', '面向林') },
    { do: 'press', id: 'a17.accept' },
    { do: 'answer', card: 'plan.1', action: 'ok' },
    { do: 'skip' },
    { do: 'agenda', id: 'poster.send' },
    { do: 'sleep' },
    { do: 'read' }
  ]
}
const fakeDeps = (overrides: Partial<DirectorDeps> = {}) => {
  const calls: string[] = []
  const waits: number[] = []
  const steps: string[] = []
  let speed = 1
  const deps: DirectorDeps = {
    hold (on) { calls.push(`hold ${on}`) },
    prepare (entry) { calls.push(`prepare ${entry.id}`) },
    async travel (place) { calls.push(`travel ${place}`); return true },
    walkIn: () => undefined,
    async walk (points) { calls.push(`walk ${points.length}`); return { ok: true, reason: 'arrived' } },
    face (target) { calls.push(`face ${target}`) },
    canPress: () => true,
    press (id) { calls.push(`press ${id}`); return true },
    handoffDone: () => true,
    showing: () => true,
    answer (card, action) { calls.push(`answer ${card} ${action}`); return true },
    skip () { calls.push('skip'); return true },
    agenda (id) { calls.push(`agenda ${id}`); return true },
    sleep () { calls.push('sleep'); return true },
    speed: () => speed,
    async wait (ms) { waits.push(ms) },
    onStep (step, of, say) { steps.push(`${step}/${of}${say ? ` ${say.en}` : ''}`) },
    ...overrides
  }
  return { deps, calls, waits, steps, setSpeed (value: number) { speed = value } }
}

afterEach(() => { vi.useRealTimers() })

test('a chapter sets up its prelude, then plays each step in order with captions', async () => {
  const { deps, calls, steps } = fakeDeps()
  await runChapter(chapter, deps, new AbortController().signal)
  // It opens with a trip, so it starts at that trip's destination.
  expect(calls).toEqual(['hold true', 'prepare test', 'travel slab', 'hold false', 'walk 4', 'face lin', 'press a17.accept', 'answer plan.1 ok', 'skip', 'agenda poster.send', 'sleep'])
  expect(steps[0]).toBe('0/9 Watch this.')
  expect(steps).toContain('3/9 Face Lin')
  expect(steps.at(-1)).toBe('9/9')
})

test('without an opening trip a chapter starts at its own place; the lede is read before the story goes on', async () => {
  const log: string[] = []
  const { deps } = fakeDeps({
    hold (on) { log.push(`hold ${on}`) },
    async travel (place) { log.push(`travel ${place}`); return true },
    async wait (ms) { log.push(`wait ${ms}`) },
    answer (card) { log.push(`answer ${card}`); return true }
  })
  await runChapter({ ...chapter, steps: chapter.steps.slice(4, 5) }, deps, new AbortController().signal)
  expect(log.slice(0, 6)).toEqual(['hold true', 'travel hive', `wait ${BEATS.read}`, 'hold false', `wait ${BEATS.settle}`, `wait ${BEATS.read}`])
  expect(log[6]).toBe('answer plan.1')
})

test('every pause divides by the speed, which can change mid-chapter', async () => {
  const slow = fakeDeps()
  await runChapter(chapter, slow.deps, new AbortController().signal)
  const fast = fakeDeps()
  fast.setSpeed(4)
  await runChapter(chapter, fast.deps, new AbortController().signal)
  expect(fast.waits.reduce((sum, ms) => sum + ms, 0)).toBeCloseTo(slow.waits.reduce((sum, ms) => sum + ms, 0) / 4)
  expect(fast.waits[0]).toBe(BEATS.read / 4)
})

test('a step that never becomes possible stops the chapter with a reason, before pressing', async () => {
  const blocked = fakeDeps({ canPress: () => false })
  await expect(runChapter(chapter, blocked.deps, new AbortController().signal)).rejects.toThrow('not-in-view-a17.accept')
  expect(blocked.calls).not.toContain('press a17.accept')
  const missing = fakeDeps({ showing: () => false })
  await expect(runChapter(chapter, missing.deps, new AbortController().signal)).rejects.toThrow('no-card-plan.1')
  const stranded = fakeDeps({ async travel () { return false } })
  await expect(runChapter(chapter, stranded.deps, new AbortController().signal)).rejects.toThrow('travel-slab')
  expect(stranded.calls.at(-1)).toBe('hold false')
})

test('every trip ends on foot: the opening one, the start, and one an answer asks for', async () => {
  const route = (length: number) => Array.from({ length }, (_, x) => ({ x, y: 60, z: 0 }))
  const walkIns: Partial<Record<string, readonly Point[]>> = { slab: route(2), hall2: route(3), hive: route(4) }
  const trips = fakeDeps({
    walkIn: place => walkIns[place],
    answer (card, action) {
      trips.calls.push(`answer ${card} ${action}`)
      return action === 'go:hall2' ? { travel: 'hall2' } : true
    }
  })
  await runChapter({ ...chapter, steps: [{ do: 'travel', place: 'slab' }, { do: 'answer', card: 'group', action: 'go:hall2' }] }, trips.deps, new AbortController().signal)
  expect(trips.calls).toEqual(['hold true', 'prepare test', 'travel slab', 'hold false', 'walk 2', 'answer group go:hall2', 'travel hall2', 'walk 3'])
  // Without an opening trip, the walk in to the chapter's own place follows its setup.
  const staying = fakeDeps({ walkIn: place => walkIns[place] })
  await runChapter({ ...chapter, steps: [{ do: 'skip' }] }, staying.deps, new AbortController().signal)
  expect(staying.calls).toEqual(['hold true', 'prepare test', 'travel hive', 'hold false', 'walk 4', 'skip'])
  // A walk in that goes wrong stops the chapter with its reason.
  const blocked = fakeDeps({ walkIn: place => walkIns[place], async walk () { return { ok: false, reason: 'blocked' } } })
  await expect(runChapter({ ...chapter, steps: [{ do: 'skip' }] }, blocked.deps, new AbortController().signal)).rejects.toThrow('walk-blocked')
  expect(blocked.calls).not.toContain('skip')
})

test('stopping mid-walk cancels the chapter before any further step', async () => {
  const abort = new AbortController()
  const { deps, calls } = fakeDeps({
    async walk () {
      abort.abort()
      return { ok: false, reason: 'cancelled' }
    }
  })
  await expect(runChapter(chapter, deps, abort.signal)).rejects.toMatchObject({ name: 'AbortError' })
  expect(calls.some(call => call.startsWith('press'))).toBe(false)
})

test('walked paths join end to start and stop within reach of their targets', () => {
  const gap = (a: { x: number, z: number }, b: { x: number, z: number }) => Math.hypot(a.x - b.x, a.z - b.z)
  expect(A17_ROUTE.toColleague[0]).toEqual(LIVE_ROUTE.start)
  expect(A17_ROUTE.toDesk[0]).toEqual(A17_ROUTE.toColleague.at(-1))
  expect(A17_ROUTE.back[0]).toEqual(A17_ROUTE.toDesk.at(-1))
  for (const [end, target] of [[A17_ROUTE.toColleague.at(-1)!, LIVE_ROUTE.colleague], [A17_ROUTE.toDesk.at(-1)!, LIVE_ROUTE.pickup], [A17_ROUTE.back.at(-1)!, LIVE_ROUTE.colleague]] as const) {
    expect(gap(end, target)).toBeGreaterThanOrEqual(2)
    expect(gap(end, target)).toBeLessThan(5.5)
  }
  expect(PRINTER_PATH[0]).toEqual(PLACES.northSpine.at)
  expect(gap(PRINTER_PATH.at(-1)!, CAST.printer.at)).toBeLessThan(5.5)
})

test('walk-ins end on their place, stay level and keep clear of the people and props there', () => {
  const clearance = (point: { x: number, z: number }, a: Point, b: Point) => {
    const length = (b.x - a.x) ** 2 + (b.z - a.z) ** 2
    const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.z - a.z) * (b.z - a.z)) / length)) : 0
    return Math.hypot(a.x + (b.x - a.x) * t - point.x, a.z + (b.z - a.z) * t - point.z)
  }
  expect(Object.keys(WALK_INS).sort()).toEqual(PLACE_IDS.filter(place => place !== 'slab').sort())
  for (const [place, path] of Object.entries(WALK_INS) as Array<[PlaceId, readonly Point[]]>) {
    expect(path.at(-1)).toEqual(PLACES[place].at)
    expect(new Set(path.map(point => point.y))).toEqual(new Set([PLACES[place].at.y]))
    const walked = path.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - path[index].x, point.z - path[index].z), 0)
    expect(walked).toBeGreaterThan(20)
    expect(walked).toBeLessThan(45)
    for (const id of CAST_IDS.filter(member => CAST[member].place === place)) {
      for (const [index, point] of path.slice(1).entries()) expect(clearance(CAST[id].at, path[index], point), `${place} passes ${id}`).toBeGreaterThan(1.75)
    }
    // The shuttle sets you down looking toward the place.
    const start = walkInStart(place)!
    const end = path.at(-1)!
    expect(-Math.sin(start.yaw) * (end.x - start.x) - Math.cos(start.yaw) * (end.z - start.z)).toBeCloseTo(Math.hypot(end.x - start.x, end.z - start.z))
  }
})

test('waits count only unpaused time and reject when stopped', async () => {
  vi.useFakeTimers()
  let paused = true
  let done = false
  void waitActive(500, new AbortController().signal, () => paused).then(() => { done = true })
  await vi.advanceTimersByTimeAsync(2000)
  expect(done).toBe(false)
  paused = false
  await vi.advanceTimersByTimeAsync(550)
  expect(done).toBe(true)
  const abort = new AbortController()
  const stopped = waitActive(10_000, abort.signal, () => false)
  abort.abort()
  await expect(stopped).rejects.toMatchObject({ name: 'AbortError' })
})
