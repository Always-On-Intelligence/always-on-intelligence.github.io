import { expect, test } from 'vitest'
import { EVIDENCE_BUFFER_MS, createServiceLoop } from './alwaysOnLoop'
import { at, gameMs, minutes, realToGameMs, skipTo } from './ntuCampusClock'
import { CAST, agenda, agendaAction, answerCard, interact, interactions, newStory, nextEvent, startDay2, tickStory, type CampusView, type CastId, type Point } from './ntuCampusStory'

const setup = () => {
  const story = newStory()
  const loop = createServiceLoop(undefined, () => gameMs(story.clock), { evidenceBufferMs: realToGameMs(EVIDENCE_BUFFER_MS) })
  return { story, loop }
}
type World = ReturnType<typeof setup>
const far: Point = { x: 400, y: 60, z: 400 }
const near = (point: Point, dx = 2): Point => ({ ...point, x: point.x + dx })
const view = (where: Point, sees: CastId[] = []): CampusView => ({ at: where, sees: Object.fromEntries(sees.map(id => [id, true])) })
const at_ = (id: CastId) => view(near(CAST[id].at), [id])
const tick = (world: World, where: CampusView) => tickStory(world.loop, world.story, where)
const until = (world: World, time: number, where: CampusView) => {
  tick(world, where)
  while (gameMs(world.story.clock) < time) {
    skipTo(world.story.clock, Math.min(time, gameMs(world.story.clock) + minutes(1)))
    tick(world, where)
  }
}
const cards = (world: World) => world.loop.state.action.cards.map(card => card.id)
const card = (world: World, id: string) => world.loop.state.action.cards.find(entry => entry.id === id)
const planned = () => {
  const world = setup()
  tick(world, view(far))
  answerCard(world.loop, world.story, 'plan.1', 'ok')
  return world
}
/** Sleep through the night and accept the day 2 plan, which adds the errand for Prof. Chen. */
const toDay2 = (world: World) => {
  until(world, at(1, 18), view(far))
  startDay2(world.loop, world.story)
  tick(world, view(far))
  answerCard(world.loop, world.story, 'plan.2', 'ok')
  return world
}
const greeted = () => {
  const world = planned()
  until(world, at(1, 13, 30), view(far))
  interact(world.loop, world.story, 'chen.greet', at_('chenCafe'))
  return world
}

test('the morning plan keeps the poster and tomorrow’s study group', () => {
  const world = planned()
  expect(world.loop.recall('poster')).toMatchObject({ kind: 'commitment', source: 'S → M' })
  expect(world.loop.recall('group')).toMatchObject({ kind: 'commitment', data: { place: 'hall2' } })
})

test('task 6: the receipt says accepted; only a look at the board says whether the poster is up', () => {
  const world = planned()
  until(world, at(1, 13), view(far))
  expect(agendaAction(world.loop, world.story, 'poster.send')).toBe(true)
  expect(agendaAction(world.loop, world.story, 'poster.send')).toBe(false)
  expect(world.loop.state.trace.slice(-2).map(entry => [entry.module, entry.kind, entry.channels])).toEqual([['A', 'execute', ['S → A', 'M → A']], ['M', undefined, ['A → M']]])
  // Too early to judge: the kiosk has not had time to print.
  tick(world, at_('board'))
  expect(world.loop.evidence('board.poster')).toBeUndefined()
  until(world, at(1, 13, 25), view(far))
  tick(world, at_('board'))
  expect(world.loop.state.trace.find(entry => entry.ref === 'board.poster')?.channels).toEqual(['A → S'])
  expect(world.loop.recall('poster')).toMatchObject({ status: 'active', source: 'S → M', data: { missing: true } })
  expect(world.loop.recall('poster.receipt')?.source).toBe('A → M')
  expect(cards(world)).toContain('poster')
  expect(world.loop.state.trace.at(-1)?.channels).toEqual(['S → A', 'M → A'])
  // The card is said once; more looks at the empty board change nothing, even once the sighting lapses.
  const { length } = world.loop.state.trace
  tick(world, at_('board'))
  world.loop.drop('board.poster')
  tick(world, at_('board'))
  expect(world.loop.state.trace).toHaveLength(length)
  expect(interactions(world.loop, world.story).map(entry => entry.id)).toContain('poster.fix')
  expect(interact(world.loop, world.story, 'poster.fix', at_('printer'))).toBe('done')
  tick(world, at_('board'))
  expect(world.loop.state.trace.filter(entry => entry.ref === 'board.poster').map(entry => entry.channels)).toEqual([['A → S'], ['A → S']])
  expect(world.loop.recall('poster')).toMatchObject({ status: 'done', source: 'S → M' })
})

test('task 6: fixing the jam before the check still ends in a verified poster, and the review knows a receipt alone', () => {
  const early = planned()
  until(early, at(1, 13), view(far))
  agendaAction(early.loop, early.story, 'poster.send')
  interact(early.loop, early.story, 'poster.fix', at_('printer'))
  until(early, at(1, 13, 25), view(far))
  tick(early, at_('board'))
  expect(early.loop.recall('poster')?.status).toBe('done')
  expect(cards(early)).not.toContain('poster')

  const unseen = planned()
  until(unseen, at(1, 13), view(far))
  agendaAction(unseen.loop, unseen.story, 'poster.send')
  until(unseen, at(1, 18), view(far))
  expect(card(unseen, 'review.1')?.lines?.map(line => line.en)).toContain('Poster: only a receipt so far; nobody has seen it on the board')
})

test('task 5: a notice on the board corrects the meeting place, and the reminder is built from the correction', () => {
  const world = toDay2(planned())
  until(world, at(2, 9, 29), view(far))
  tick(world, at_('board'))
  expect(world.loop.evidence('board.notices')).toBeUndefined()
  until(world, at(2, 9, 31), view(far))
  tick(world, at_('board'))
  expect(world.loop.recall('group')).toMatchObject({ source: 'S → M', data: { place: 'hive', was: 'hall2', source: 'board' } })
  expect(world.loop.recall('group')?.value.en).toContain('was Hall 2')
  expect(world.loop.recall('chen.where')).toMatchObject({ data: { place: 'library', source: 'board' } })
  until(world, at(2, 15, 30), view(far))
  expect(card(world, 'group')?.title.en).toBe('Study group G-07 · 16:00 · The Hive')
  expect(agenda(world.loop, world.story).find(item => item.id === 'group')).toMatchObject({ place: 'hive' })
  expect(answerCard(world.loop, world.story, 'group', 'go:hive')).toEqual({ travel: 'hive' })
})

test('task 5: without the notice, Hall 2 is empty; its door corrects Memory and replaces the reminder', () => {
  const world = toDay2(planned())
  until(world, at(2, 15, 30), view(far))
  expect(card(world, 'group')?.title.en).toBe('Study group G-07 · 16:00 · Hall 2')
  tick(world, at_('hallNotice'))
  expect(world.loop.recall('group')?.data).toMatchObject({ place: 'hive', source: 'door' })
  expect(card(world, 'group')?.title.en).toBe('The study group moved to The Hive')
  expect(world.loop.state.trace.at(-1)?.channels).toEqual(['S → A', 'M → A'])
  until(world, at(2, 16), view(far))
  expect(interact(world.loop, world.story, 'group.join', at_('groupA'))).toBe('done')
  expect(world.loop.recall('group')).toMatchObject({ status: 'done', data: { was: 'hall2' } })
  until(world, at(2, 18), view(far))
  expect(card(world, 'ending')?.lines?.map(line => line.en)).toContain('Study group: Memory said Hall 2 until a notice corrected it to The Hive.')
})

test('task 4: a habit kept on day 1 decides where the glasses look for Prof. Chen on day 2', () => {
  const world = greeted()
  expect(world.loop.recall('chen.where')).toMatchObject({ source: 'S → M', data: { place: 'starbucks' } })
  toDay2(world)
  expect(nextEvent(world.loop, world.story)?.at).toBe(at(2, 13, 30))
  until(world, at(2, 13, 30), view(far))
  expect(world.loop.evidence('chen.focus')?.data).toEqual({ scope: 'starbucks' })
  expect(world.loop.state.trace.find(entry => entry.ref === 'chen.focus')?.channels).toEqual(['M → S'])
  expect(card(world, 'chen.start')?.actions[0].id).toBe('go:starbucks')
  // He stands right there in the library, but Sensing is not looking there.
  tick(world, at_('chenLibrary'))
  expect(world.loop.state.sensing.field.chenLibrary).toBeUndefined()
  expect(world.loop.state.trace.find(entry => entry.ref === 'chen.blind')?.channels).toEqual(['M → S'])
  expect(world.story.marks['chen.found']).toBeUndefined()
  expect(interactions(world.loop, world.story).find(entry => entry.id === 'chen.sign')?.name?.en).toBe('A lecturer')
  // At Starbucks he is missing, and you can widen the search.
  tick(world, view(near({ x: -320.5, y: 45, z: 35.5 })))
  expect(card(world, 'chen.search')?.actions.map(action => action.id)).toEqual(['explore', 'stay'])
  answerCard(world.loop, world.story, 'chen.search', 'explore')
  expect(world.loop.recall('pref.search')).toMatchObject({ source: 'S → M', data: { mode: 'explore' } })
  tick(world, view(far))
  expect(world.loop.evidence('chen.focus')?.data).toEqual({ scope: 'everywhere' })
  tick(world, at_('chenLibrary'))
  expect(card(world, 'chen.found')).toBeDefined()
  expect(world.loop.recall('chen.where')).toMatchObject({ data: { place: 'library', source: 'seen', was: 'starbucks' } })
  tick(world, at_('chenLibrary'))
  expect(world.loop.state.sensing.field.chenLibrary?.inView).toBe(true)
  expect(interact(world.loop, world.story, 'chen.sign', at_('chenLibrary'))).toBe('done')
  expect(world.loop.recall('chen')?.status).toBe('done')
  expect(world.loop.evidence('chen.focus')).toBeUndefined()
})

test('task 4: looking everywhere drains the battery faster than keeping to the habit', () => {
  const habit = toDay2(greeted())
  const wide = toDay2(greeted())
  until(wide, at(2, 13, 30), view(far))
  tick(wide, view(near({ x: -320.5, y: 45, z: 35.5 })))
  answerCard(wide.loop, wide.story, 'chen.search', 'explore')
  until(habit, at(2, 13, 30), view(far))
  const [habitStart, wideStart] = [habit.story.world.battery, wide.story.world.battery]
  until(habit, at(2, 15, 30), view(far))
  until(wide, at(2, 15, 30), view(far))
  expect(habitStart - habit.story.world.battery).toBeCloseTo(120 * 0.06, 1)
  expect(wideStart - wide.story.world.battery).toBeGreaterThan(120 * 0.17)
})

test('task 4: a skipped stretch only pays the wide-search cost inside the search window', () => {
  const world = toDay2(planned())
  skipTo(world.story.clock, at(2, 13, 30))
  tick(world, view(far))
  expect(100 - world.story.world.battery).toBeCloseTo(270 * 0.06, 1)
  skipTo(world.story.clock, at(2, 14, 30))
  tick(world, view(far))
  expect(100 - world.story.world.battery).toBeCloseTo(330 * 0.06 + 60 * 0.12, 1)
})

test('task 4: when you recognise him yourself, Memory is corrected but the credit is yours', () => {
  const world = toDay2(greeted())
  until(world, at(2, 14), view(far))
  expect(interact(world.loop, world.story, 'chen.sign', at_('chenLibrary'))).toBe('done')
  expect(world.loop.recall('chen.where')).toMatchObject({ data: { place: 'library', source: 'you' } })
  expect(world.loop.recall('chen')?.status).toBe('done')
  until(world, at(2, 18), view(far))
  expect(card(world, 'ending')?.lines?.map(line => line.en)).toContain('Prof. Chen: you recognised him in the library yourself; I was only looking around Starbucks, from an old habit in Memory.')
})

test('task 4: never found, the ending says why', () => {
  const world = toDay2(greeted())
  until(world, at(2, 18), view(far))
  expect(card(world, 'ending')?.lines?.map(line => line.en)).toContain('Missed: Prof. Chen was not found. I kept looking where Memory said, Starbucks; this week he was in the library.')
  expect(world.loop.state.trace.filter(entry => entry.ref === 'chen.focus')).toHaveLength(1)
})

test('without a day 1 habit there is nothing to narrow the search: it looks everywhere', () => {
  const world = toDay2(planned())
  until(world, at(2, 13, 30), view(far))
  expect(world.loop.evidence('chen.focus')?.data).toEqual({ scope: 'everywhere' })
  expect(card(world, 'chen.start')?.actions.map(action => action.id)).toEqual(['ok'])
  tick(world, at_('chenLibrary'))
  expect(card(world, 'chen.found')).toBeDefined()
})

test('never found without a habit, the ending blames the route, not Starbucks', () => {
  const world = toDay2(planned())
  until(world, at(2, 18), view(far))
  const lines = card(world, 'ending')?.lines?.map(line => line.en) ?? []
  expect(lines).toContain('Missed: Prof. Chen was not found. With no place for him in Memory I looked at everyone on the way, but we never passed the library.')
  expect(lines[0]).toMatch(/^Unasked, I reminded \d+×/)
  expect(lines[0]).not.toContain(' 0×')
})
