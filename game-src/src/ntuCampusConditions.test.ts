import { expect, test } from 'vitest'
import { EVIDENCE_BUFFER_MS, createServiceLoop } from './alwaysOnLoop'
import { at, gameMs, minutes, realToGameMs, skipTo } from './ntuCampusClock'
import { audience } from './ntuCampusConditions'
import { CAST, PLACES, agenda, answerCard, interact, newStory, nextEvent, startDay2, tickStory, type CampusView, type CastId, type Point } from './ntuCampusStory'

const setup = () => {
  const story = newStory()
  const loop = createServiceLoop(undefined, () => gameMs(story.clock), { evidenceBufferMs: realToGameMs(EVIDENCE_BUFFER_MS) })
  return { story, loop }
}
type World = ReturnType<typeof setup>
const far: Point = { x: 400, y: 60, z: 400 }
const near = (point: Point, dx = 2): Point => ({ ...point, x: point.x + dx })
const view = (where: Point, sees: CastId[] = []): CampusView => ({ at: where, sees: Object.fromEntries(sees.map(id => [id, true])) })
const tick = (world: World, where: CampusView) => tickStory(world.loop, world.story, where)
const until = (world: World, time: number, where: CampusView) => {
  tick(world, where)
  while (gameMs(world.story.clock) < time) {
    skipTo(world.story.clock, Math.min(time, gameMs(world.story.clock) + minutes(1)))
    tick(world, where)
  }
}
const card = (world: World, id: string) => world.loop.state.action.cards.find(entry => entry.id === id)
const planned = () => {
  const world = setup()
  tick(world, view(far))
  answerCard(world.loop, world.story, 'plan.1', 'ok')
  return world
}
const toDay2 = (world: World) => {
  until(world, at(1, 18), view(far))
  startDay2(world.loop, world.story)
  tick(world, view(far))
  answerCard(world.loop, world.story, 'plan.2', 'ok')
  return world
}
const atMeeting = view(PLACES.lt.at)
const withGroup = view(near(CAST.groupA.at, 1), ['groupA', 'groupB'])

test('task 9, Monday: the morning grant covers today, so running late sends the message and says so', () => {
  const world = planned()
  expect(world.loop.recall('grant.send')).toMatchObject({ kind: 'preference', source: 'S → M', data: { day: 1 } })
  expect(nextEvent(world.loop, world.story)?.at).toBe(at(1, 10, 45))
  until(world, at(1, 10, 45), view(far))
  const sent = world.loop.state.trace.find(entry => entry.kind === 'execute')
  expect(sent).toMatchObject({ channels: ['S → A', 'M → A'], reads: ['grant.send'] })
  expect(world.loop.recall('late.1')).toMatchObject({ kind: 'receipt', source: 'A → M', data: { grant: true } })
  expect(card(world, 'late.1')).toMatchObject({ kind: 'message', basis: 'grant.send' })
  until(world, at(1, 10, 59), view(far))
  expect(world.loop.state.trace.filter(entry => entry.kind === 'execute')).toHaveLength(1)
})

test('task 9: on time, nothing is sent', () => {
  const world = planned()
  until(world, at(1, 10, 44), view(far))
  until(world, at(1, 10, 59), atMeeting)
  expect(world.loop.recall('late.1')).toBeUndefined()
  expect(card(world, 'late.1')).toBeUndefined()
})

test('task 9, Tuesday: yesterday’s grant does not cover today, so the draft waits for you', () => {
  const world = toDay2(planned())
  until(world, at(2, 15, 45), view(far))
  const ask = world.loop.state.trace.find(entry => entry.kind === 'ask' && entry.task === 'late.2')
  expect(ask).toMatchObject({ channels: ['S → A', 'M → A'], reads: ['grant.send', 'group'] })
  expect(card(world, 'late.2')).toMatchObject({ kind: 'confirm', basis: 'grant.send' })
  expect(card(world, 'late.2')?.lines?.[0].en).toContain('covered yesterday only')
  expect(world.loop.state.trace.filter(entry => entry.kind === 'execute' && entry.task === 'late.2')).toHaveLength(0)
  expect(answerCard(world.loop, world.story, 'late.2', 'send')).toBe(true)
  expect(world.loop.state.trace.at(-2)).toMatchObject({ kind: 'execute', channels: ['S → A'] })
  expect(world.loop.recall('late.2')).toMatchObject({ source: 'A → M', data: { confirmed: true } })
  until(world, at(2, 18), view(far))
  expect(card(world, 'ending')?.lines?.map(line => line.en)).toContain('Sending for you: on Monday your grant let me send “10 minutes late” myself; on Tuesday I asked first. Yesterday’s grant does not cover today.')
})

test('task 9: saying no keeps the unsent draft and sends nothing; without any grant the glasses ask on Monday too', () => {
  const declined = toDay2(planned())
  until(declined, at(2, 15, 45), view(far))
  answerCard(declined.loop, declined.story, 'late.2', 'no')
  expect(declined.loop.recall('late.2')).toMatchObject({ source: 'S → M', status: 'done', data: { declined: at(2, 15, 45) } })
  expect(declined.loop.state.trace.filter(entry => entry.kind === 'execute' && entry.task === 'late.2')).toHaveLength(0)

  const ungranted = setup()
  until(ungranted, at(1, 10, 45), view(far))
  expect(card(ungranted, 'late.1')).toMatchObject({ kind: 'confirm' })
  expect(card(ungranted, 'late.1')?.basis).toBeUndefined()
})

test('task 8: with others around, the medicine reminder comes as “private reminder” and shows nothing else', () => {
  const world = toDay2(planned())
  expect(world.loop.recall('meds')).toMatchObject({ kind: 'commitment', source: 'S → M', data: { private: true } })
  until(world, at(2, 16, 30), withGroup)
  expect(audience(world.story, withGroup)).toEqual(['groupA', 'groupB'])
  const hidden = card(world, 'meds')!
  expect(hidden).toMatchObject({ private: true, kind: 'reminder' })
  expect(hidden.title.en).toBe('Private reminder')
  expect(hidden.basis).toBeUndefined()
  expect(JSON.stringify(hidden)).not.toMatch(/medicine|pharmacy|取药/i)
  expect(world.loop.state.trace.at(-1)).toMatchObject({ kind: 'remind', channels: ['S → A', 'M → A'] })
  // Alone again, the owed content appears.
  tick(world, view(far))
  expect(card(world, 'meds')).toMatchObject({ basis: 'meds', title: { en: 'Collect your medicine before 17:00' } })
  expect(card(world, 'meds')?.private).toBeUndefined()
  tick(world, view(far))
  expect(world.loop.state.trace.filter(entry => entry.task === 'meds' && entry.kind === 'remind')).toHaveLength(2)
})

test('task 8: you can open a private reminder yourself; collecting the medicine closes it', () => {
  const world = toDay2(planned())
  until(world, at(2, 16, 30), withGroup)
  expect(answerCard(world.loop, world.story, 'meds', 'open')).toBe(true)
  expect(card(world, 'meds')?.private).toBeUndefined()
  expect(answerCard(world.loop, world.story, 'meds', 'go:uhs')).toEqual({ travel: 'uhs' })
  expect(interact(world.loop, world.story, 'meds.collect', view(near(CAST.pharmacist.at), ['pharmacist']))).toBe('done')
  expect(world.loop.recall('meds')).toMatchObject({ status: 'done', source: 'S → M' })
  expect(agenda(world.loop, world.story).find(item => item.id === 'meds')?.state).toBe('done')
  until(world, at(2, 18), view(far))
  expect(card(world, 'ending')?.lines?.map(line => line.en)).toContain('Medicine: when the reminder came others were around, so I only said “private reminder”.')
})

test('task 8: alone at 16:30 the reminder is plain; after 17:00 the pharmacy is closed and the ending says so', () => {
  const world = toDay2(planned())
  until(world, at(2, 16, 30), view(far))
  expect(card(world, 'meds')).toMatchObject({ basis: 'meds' })
  expect(card(world, 'meds')?.private).toBeUndefined()
  until(world, at(2, 17), view(far))
  expect(agenda(world.loop, world.story).find(item => item.id === 'meds')?.state).toBe('missed')
  until(world, at(2, 18), view(far))
  expect(card(world, 'ending')?.lines?.map(line => line.en)).toContain('Missed: the medicine was not collected before 17:00.')
})
