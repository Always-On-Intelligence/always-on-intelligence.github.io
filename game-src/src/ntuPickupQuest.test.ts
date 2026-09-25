import { expect, test } from 'vitest'
import { createServiceLoop, noteQuietPreference, restoreLoop, serializeLoop } from './alwaysOnLoop'
import { at, minutes } from './ntuCampusClock'
import { PICKUP_REMINDER, REMINDER_AFTER_MS, SNOOZE_MS, answerPickupReminder, finishPickupHandoff, pickupInteraction, pickupNextAction, pickupStage, tickPickup, type PickupView } from './ntuPickupQuest'

const away: PickupView = { colleagueVisible: false, deskVisible: false }
const atColleague: PickupView = { colleagueVisible: true, deskVisible: false }
const atDesk: PickupView = { colleagueVisible: false, deskVisible: true }
const setup = () => {
  let time = at(1, 9, 30)
  const loop = createServiceLoop(undefined, () => time)
  return { loop, advance (ms: number) { time += ms } }
}
const accepted = () => {
  const world = setup()
  pickupInteraction(world.loop, 'accept', atColleague)
  return world
}
const collected = () => {
  const world = accepted()
  pickupInteraction(world.loop, 'collect', atDesk)
  finishPickupHandoff(world.loop, 'collect')
  return world
}
const delivered = () => {
  const world = collected()
  pickupInteraction(world.loop, 'deliver', atColleague)
  finishPickupHandoff(world.loop, 'deliver')
  return world
}
/** Run checks every campus minute, as the host does with its clock. */
const run = ({ loop, advance }: ReturnType<typeof setup>, ms: number, view = away) => {
  for (let elapsed = 0; elapsed < ms; elapsed += minutes(1)) {
    advance(minutes(1))
    tickPickup(loop, view)
  }
}

test('seeing Lin reveals a request as current evidence, never as Memory', () => {
  const { loop } = setup()
  tickPickup(loop, atColleague)
  expect(loop.evidence('a17.request')).toMatchObject({ anchor: 'lin' })
  expect(loop.state.memory).toEqual([])
  expect(pickupStage(loop)).toBe('available')
  expect(loop.state.trace.map(entry => [entry.module, entry.channels])).toEqual([['S', []]])
})

test('every step needs its target in view right now', () => {
  expect(pickupInteraction(setup().loop, 'accept', away)).toBe(false)
  expect(pickupInteraction(accepted().loop, 'collect', atColleague)).toBe(false)
  expect(pickupInteraction(collected().loop, 'deliver', atDesk)).toBe(false)
})

test('accept, collect and deliver are separate steps that do not repeat', () => {
  const world = accepted()
  expect(pickupNextAction(world.loop)).toBe('collect')
  expect(pickupInteraction(world.loop, 'accept', atColleague)).toBe(false)
  expect(pickupInteraction(world.loop, 'deliver', atColleague)).toBe(false)
  pickupInteraction(world.loop, 'collect', atDesk)
  finishPickupHandoff(world.loop, 'collect')
  expect(pickupStage(world.loop)).toBe('carrying')
  expect(pickupInteraction(world.loop, 'collect', atDesk)).toBe(false)
  pickupInteraction(world.loop, 'deliver', atColleague)
  finishPickupHandoff(world.loop, 'deliver')
  expect(pickupStage(world.loop)).toBe('completed')
  expect(world.loop.recall('a17')?.status).toBe('done')
  expect(pickupInteraction(world.loop, 'deliver', atColleague)).toBe(false)
  expect(pickupNextAction(world.loop)).toBeUndefined()
})

test('the errand uses only S → M and M → A: your own steps are sensed, not claimed as decisions', () => {
  const { loop } = delivered()
  expect(Object.keys(loop.state.counts).sort()).toEqual(['M → A', 'S → M'])
  expect(loop.state.trace.filter(entry => entry.module === 'A').map(entry => entry.kind)).toEqual(['prompt'])
  expect(loop.recall('a17.pickup')?.source).toBe('S → M')
  expect(loop.recall('a17.delivery')?.value.en).toBe('Lin has A17 · 09:30')
})

test('an interrupted handoff writes no receipt', () => {
  const { loop } = accepted()
  expect(pickupInteraction(loop, 'collect', atDesk)).toBe(true)
  expect(loop.state.memory.map(record => record.id)).toEqual(['a17'])
  const restored = createServiceLoop(restoreLoop(serializeLoop(loop.state)))
  expect(pickupStage(restored)).toBe('pending')
})

test('reload keeps the commitment and its receipts', () => {
  for (const { loop } of [accepted(), collected(), delivered()]) {
    const restored = createServiceLoop(restoreLoop(serializeLoop(loop.state)))
    expect(pickupStage(restored)).toBe(pickupStage(loop))
  }
})

test('a saved stage without its receipts confers neither possession nor completion', () => {
  const { loop } = accepted()
  const task = loop.recall('a17')!
  loop.remember('a17', { ...task, data: { ...task.data, stage: 'completed' } }, { from: 'sensing', note: task.value })
  expect(pickupStage(loop)).toBe('pending')
  const { loop: carrying } = collected()
  const record = carrying.recall('a17')!
  carrying.remember('a17', { ...record, data: { ...record.data, stage: 'completed' } }, { from: 'sensing', note: record.value })
  expect(pickupStage(carrying)).toBe('carrying')
})

test('half an hour of campus time brings one reminder card, based on the commitment', () => {
  const world = accepted()
  run(world, REMINDER_AFTER_MS - minutes(1))
  expect(world.loop.state.action.cards).toEqual([])
  expect(world.loop.state.action.scheduled[PICKUP_REMINDER]).toMatchObject({ unit: 'game', dueMs: REMINDER_AFTER_MS })
  run(world, minutes(1))
  expect(world.loop.state.action.cards).toMatchObject([{ id: PICKUP_REMINDER, kind: 'reminder', basis: 'a17', task: 'a17' }])
  expect(world.loop.state.action.cards[0].why?.en).toContain('09:30')
  expect(world.loop.state.trace.at(-1)).toMatchObject({ module: 'A', kind: 'remind', channels: ['M → A'], reads: ['a17'] })
  expect(world.loop.recall('a17')?.used).toBe(2)
  const { length } = world.loop.state.trace
  run(world, minutes(30))
  expect(world.loop.state.trace).toHaveLength(length)
})

test('your answer is sensed and kept: "Got it" ends the reminder, "Later" brings it back', () => {
  const done = accepted()
  run(done, REMINDER_AFTER_MS)
  expect(answerPickupReminder(done.loop, 'ok')).toBe(true)
  expect(done.loop.state.action.cards).toEqual([])
  expect(done.loop.state.trace.at(-1)?.channels).toEqual(['S → M'])
  run(done, minutes(90))
  expect(done.loop.state.action.cards).toEqual([])

  const later = accepted()
  run(later, REMINDER_AFTER_MS)
  answerPickupReminder(later.loop, 'later')
  run(later, SNOOZE_MS - minutes(1))
  expect(later.loop.state.action.cards).toEqual([])
  run(later, minutes(1))
  expect(later.loop.showing(PICKUP_REMINDER)).toBe(true)
  expect(answerPickupReminder(later.loop, 'ok')).toBe(true)
  expect(answerPickupReminder(later.loop, 'ok')).toBe(false)
})

test('in quiet mode the card is held and still owed; the silence is logged once', () => {
  const world = accepted()
  noteQuietPreference(world.loop, true)
  run(world, REMINDER_AFTER_MS + minutes(10))
  expect(world.loop.state.action.cards).toEqual([])
  expect(world.loop.state.action.held[PICKUP_REMINDER]).toMatchObject({ task: 'a17' })
  expect(world.loop.state.trace.filter(entry => entry.kind === 'wait')).toHaveLength(1)
  expect(world.loop.state.trace.find(entry => entry.kind === 'wait')?.reads).toEqual(['a17', 'pref.quiet'])
  noteQuietPreference(world.loop, false)
  expect(world.loop.state.action.held).toEqual({})
  run(world, minutes(1))
  expect(world.loop.showing(PICKUP_REMINDER)).toBe(true)
})

test('each stage gets its own reminder, and a finished errand schedules nothing', () => {
  const world = accepted()
  run(world, REMINDER_AFTER_MS)
  answerPickupReminder(world.loop, 'ok')
  pickupInteraction(world.loop, 'collect', atDesk)
  finishPickupHandoff(world.loop, 'collect')
  run(world, minutes(1))
  expect(world.loop.state.action.scheduled[PICKUP_REMINDER].elapsedMs).toBe(minutes(1))
  run(world, REMINDER_AFTER_MS)
  expect(world.loop.state.action.cards[0]?.title.en).toBe('Remember to hand A17 to Lin')
  pickupInteraction(world.loop, 'deliver', atColleague)
  finishPickupHandoff(world.loop, 'deliver')
  expect(world.loop.state.action.cards).toEqual([])
  tickPickup(world.loop, away)
  expect(world.loop.state.action.scheduled).toEqual({})
})
