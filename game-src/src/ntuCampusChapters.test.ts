import { expect, test } from 'vitest'
import { EVIDENCE_BUFFER_MS, createServiceLoop, type Text } from './alwaysOnLoop'
import { advanceClock, gameMs, realToGameMs, skipTo } from './ntuCampusClock'
import { CHAPTERS, WALK_INS, replay, skipTarget } from './ntuCampusChapters'
import { runChapter, type Chapter, type DirectorDeps } from './ntuCampusDirector'
import { CAST, PLACES, agendaAction, answerCard, interact, interactions, newStory, startDay2, tickStory, type CastId, type Point } from './ntuCampusStory'
import { finishPickupHandoff } from './ntuPickupQuest'

/** Normal Minecraft walking speed; the demo never sprints. */
const WALK_MS_PER_METRE = 1000 / 4.317
/**
 * A headless player: positions, sight and key presses stand in for the 3D world. Like the
 * host, it keeps ticking wherever the player stands unless the director holds the story.
 */
function headless (from?: { at: Point, facing?: CastId }) {
  const story = newStory()
  const loop = createServiceLoop(undefined, () => gameMs(story.clock), { evidenceBufferMs: realToGameMs(EVIDENCE_BUFFER_MS) })
  let at = from?.at ?? PLACES.hive.at
  let facing = from?.facing
  let held = false
  const steps: Array<[number, Text | undefined]> = []
  const view = () => ({ at, sees: facing ? { [facing]: true } : {} })
  const tick = () => { if (!held) tickStory(loop, story, view()) }
  const reach = (id: CastId) => Math.hypot(at.x - CAST[id].at.x, at.z - CAST[id].at.z) <= 5.5
  const deps: DirectorDeps = {
    hold (on) { held = on },
    prepare (chapter) {
      replay(loop, story, chapter.prelude)
      // The host ticks right away wherever the last chapter left the player.
      tick()
    },
    // The demo sets down where the place's walk in starts.
    async travel (place) { at = WALK_INS[place]?.[0] ?? PLACES[place].at; facing = undefined; tick(); return true },
    walkIn: place => WALK_INS[place],
    // Walking takes the time it takes, and the rules watch every metre of it.
    async walk (points) {
      facing = undefined
      for (const point of points) {
        const from = at
        const metres = Math.hypot(point.x - from.x, point.z - from.z)
        for (let walked = 1; walked < metres; walked++) {
          at = { x: from.x + (point.x - from.x) * walked / metres, y: point.y, z: from.z + (point.z - from.z) * walked / metres }
          if (!held) advanceClock(story.clock, WALK_MS_PER_METRE)
          tick()
        }
        at = point
      }
      tick()
      return { ok: true, reason: 'arrived' }
    },
    face (target) { facing = target; tick() },
    canPress (id) {
      const entry = interactions(loop, story).find(candidate => candidate.id === id)
      return Boolean(entry && facing === entry.target && reach(entry.target))
    },
    press (id) {
      const result = interact(loop, story, id, view())
      if (result === 'handoff') finishPickupHandoff(loop, id === 'a17.collect' ? 'collect' : 'deliver')
      tick()
      return Boolean(result)
    },
    handoffDone: () => true,
    showing: card => loop.showing(card),
    async answer (card, action) {
      const result = answerCard(loop, story, card, action)
      tick()
      return typeof result === 'object' ? result : Boolean(result)
    },
    skip (to) {
      const target = skipTarget(loop, story, gameMs(story.clock), to)
      if (target === undefined || !skipTo(story.clock, target)) return false
      tick()
      return true
    },
    agenda (id) {
      const done = agendaAction(loop, story, id)
      tick()
      return done
    },
    sleep () {
      const done = startDay2(loop, story)
      tick()
      return done
    },
    speed: () => 4,
    // Every pause lets the campus clock run and the rules pass once, as the host does.
    async wait (ms) {
      advanceClock(story.clock, Math.min(ms, 1000))
      tick()
    },
    onStep (step, _of, said) { steps.push([step, said]) }
  }
  return { story, loop, deps, steps, where: () => ({ at, facing }) }
}
const play = async (chapter: Chapter) => {
  const world = headless()
  await runChapter(chapter, world.deps, new AbortController().signal)
  return world
}
const chapter = (id: string) => CHAPTERS.find(entry => entry.id === id)!

test('twelve chapters cover every README task, each with a lede and captions', () => {
  expect(CHAPTERS).toHaveLength(12)
  expect(new Set(CHAPTERS.flatMap(entry => entry.tasks))).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
  expect(new Set(CHAPTERS.map(entry => entry.id)).size).toBe(12)
  for (const entry of CHAPTERS) expect(entry.lede.zh.length).toBeGreaterThan(10)
})

for (const entry of CHAPTERS) {
  test(`chapter “${entry.id}” plays through the story rules from its own prelude`, async () => {
    const world = await play(entry)
    expect(world.steps.at(-1)?.[0]).toBe(entry.steps.length)
  })
}

test('chapter outcomes: each ends in the state its captions describe', async () => {
  const a17 = await play(chapter('a17'))
  expect(a17.loop.recall('a17')?.status).toBe('done')
  const readings = await play(chapter('readings'))
  expect(readings.loop.state.trace.some(entry => entry.shadow)).toBe(true)
  expect(readings.loop.recall('readings.pref')?.data?.on).toBe(true)
  expect(readings.loop.recall('readings.checks')?.data).toMatchObject({ afterReminder: 1 })
  const library = await play(chapter('library'))
  expect(library.loop.recall('book')?.status).toBe('done')
  const meeting = await play(chapter('meeting'))
  expect(meeting.loop.recall('late.1')?.data?.grant).toBe(true)
  expect(meeting.loop.state.tally.refused).toBe(1)
  expect(meeting.loop.recall('report')?.status).toBe('done')
  const poster = await play(chapter('poster'))
  expect(poster.loop.recall('poster')?.status).toBe('done')
  expect(poster.loop.state.trace.filter(entry => entry.ref === 'board.poster').map(entry => entry.channels)).toEqual([['A → S'], ['A → S']])
  const chen1 = await play(chapter('chen1'))
  expect(chen1.loop.recall('chen.where')?.data?.place).toBe('starbucks')
  const evening = await play(chapter('evening'))
  expect(evening.story.clock.day).toBe(2)
  expect(evening.loop.recall('review.1')?.source).toBe('A → M')
  const board = await play(chapter('board'))
  expect(board.loop.recall('group')?.data).toMatchObject({ place: 'hive', source: 'board' })
  expect(board.loop.recall('chen.where')?.data).toMatchObject({ place: 'library', source: 'board' })
  const blind = await play(chapter('blind'))
  expect(blind.loop.state.trace.find(entry => entry.ref === 'chen.blind')?.channels).toEqual(['M → S'])
  expect(blind.loop.recall('chen.where')?.data).toMatchObject({ place: 'library', source: 'seen' })
  expect(blind.loop.recall('chen')?.status).toBe('done')
  const afternoon = await play(chapter('afternoon'))
  expect(afternoon.loop.recall('late.2')?.data?.confirmed).toBe(true)
  expect(afternoon.loop.recall('group')).toMatchObject({ status: 'done', data: { was: 'hall2' } })
  const hidden = await play(chapter('private'))
  expect(hidden.story.marks['meds.hidden']).toBeDefined()
  expect(hidden.loop.recall('meds')?.status).toBe('done')
  const ending = await play(chapter('ending'))
  const lines = ending.loop.state.action.cards.find(card => card.id === 'ending')?.lines?.map(line => line.en) ?? []
  expect(lines.some(line => line.startsWith('Sending for you: on Monday'))).toBe(true)
  expect(lines.some(line => line.includes('refused to keep 1'))).toBe(true)
  expect(lines).toContain('Missed: the medicine was not collected before 17:00.')
})

test('playing all chapters in a row: where one ends never leaks into the next', async () => {
  let from: { at: Point, facing?: CastId } | undefined
  for (const entry of CHAPTERS) {
    const world = headless(from)
    // eslint-disable-next-line no-await-in-loop -- chapters play one after another
    await runChapter(entry, world.deps, new AbortController().signal)
    from = world.where()
  }
  // Chapter 9 starts where chapter 8 left the player: facing the notice board on Tuesday.
  const blind = headless({ at: PLACES.northSpine.at, facing: 'board' })
  await runChapter(chapter('blind'), blind.deps, new AbortController().signal)
  expect(blind.loop.recall('chen.where')?.data?.source).toBe('seen')
})

test('a prelude only goes through the rules: an unavailable step fails loudly', () => {
  const world = headless()
  expect(() => replay(world.loop, world.story, [{ meet: 'a17.collect' }])).toThrow('a17.collect is not available')
  expect(() => replay(world.loop, world.story, [{ answer: 'review.1' }])).toThrow('review.1 is not showing')
})
