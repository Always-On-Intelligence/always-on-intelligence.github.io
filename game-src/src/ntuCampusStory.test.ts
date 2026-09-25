import { expect, test } from 'vitest'
import { EVIDENCE_BUFFER_MS, createServiceLoop, noteQuietPreference, restoreLoop, serializeLoop } from './alwaysOnLoop'
import { DAY_END, at, gameMs, minutes, realToGameMs, skipTo } from './ntuCampusClock'
import { finishPickupHandoff } from './ntuPickupQuest'
import { CAST, PLACES, READINGS, READINGS_CHECKS, READINGS_PREF, READINGS_REMINDERS, TIMES, agenda, agendaAction, answerCard, interact, interactions, newStory, nextEvent, present, restoreStory, serializeStory, startDay2, tickStory, type CampusStory, type CastId, type CampusView, type Point } from './ntuCampusStory'

const setup = (story: CampusStory = newStory(), saved?: string) => {
  const loop = createServiceLoop(restoreLoop(saved ?? null), () => gameMs(story.clock), { evidenceBufferMs: realToGameMs(EVIDENCE_BUFFER_MS) })
  return { story, loop }
}
type World = ReturnType<typeof setup>
const far: Point = { x: 400, y: 60, z: 400 }
const near = (point: Point, dx = 2): Point => ({ ...point, x: point.x + dx })
const view = (where: Point, sees: CastId[] = []): CampusView => ({ at: where, sees: Object.fromEntries(sees.map(id => [id, true])) })
const tick = (world: World, where: CampusView) => tickStory(world.loop, world.story, where)
/** Walk the clock forward a campus minute at a time, checking at each step like the host. */
const until = (world: World, time: number, where: CampusView) => {
  tick(world, where)
  while (gameMs(world.story.clock) < time) {
    skipTo(world.story.clock, Math.min(time, gameMs(world.story.clock) + minutes(1)))
    tick(world, where)
  }
}
/** Card ids, leaving out the running-late messages that ntuCampusConditions.test.ts covers. */
const cards = (world: World) => world.loop.state.action.cards.map(card => card.id).filter(id => !id.startsWith('late.'))
const planned = () => {
  const world = setup()
  tick(world, view(far))
  answerCard(world.loop, world.story, 'plan.1', 'ok')
  return world
}
const atLin = view(near(CAST.lin.at), ['lin'])
/** A17 done and the readings agreed at 09:30, so only the readings remind from here. */
const withReadings = () => {
  const world = planned()
  until(world, at(1, 9, 30), view(far))
  interact(world.loop, world.story, 'a17.accept', atLin)
  expect(interactions(world.loop, world.story).map(entry => entry.id)).toContain('readings.agree')
  interact(world.loop, world.story, 'a17.collect', view(near(CAST.desk.at), ['desk']))
  finishPickupHandoff(world.loop, 'collect')
  interact(world.loop, world.story, 'a17.deliver', atLin)
  finishPickupHandoff(world.loop, 'deliver')
  interact(world.loop, world.story, 'readings.agree', atLin)
  tick(world, view(far))
  return world
}

test('the day opens with a question nobody asked for; your answer becomes commitments', () => {
  const world = setup()
  tick(world, view(far))
  expect(cards(world)).toEqual(['plan.1'])
  expect(world.loop.state.trace.at(-1)).toMatchObject({ module: 'A', kind: 'ask', channels: [] })
  tick(world, view(far))
  expect(world.loop.state.trace.filter(entry => entry.kind === 'ask')).toHaveLength(1)
  expect(answerCard(world.loop, world.story, 'plan.1', 'ok')).toBe(true)
  expect(world.loop.state.memory.map(record => [record.id, record.kind, record.source])).toEqual([['book', 'commitment', 'S → M'], ['report', 'commitment', 'S → M'], ['poster', 'commitment', 'S → M'], ['group', 'commitment', 'S → M'], ['grant.send', 'preference', 'S → M']])
  expect(answerCard(world.loop, world.story, 'plan.1', 'ok')).toBe(false)
})

test('task 1: passing the library, and only that, brings the book reminder', () => {
  const world = planned()
  until(world, at(1, 10), view(far))
  expect(cards(world)).toEqual([])
  const passing = view(near(PLACES.library.at, 20))
  tick(world, passing)
  expect(cards(world)).toEqual(['book'])
  expect(world.loop.state.trace.at(-1)).toMatchObject({ kind: 'remind', channels: ['M → A', 'S → A'], reads: ['book'] })
  answerCard(world.loop, world.story, 'book', 'ok')
  until(world, at(1, 10, 30), passing)
  expect(cards(world)).toEqual([])
  // A new visit reminds again; returning the book closes it.
  tick(world, view(far))
  tick(world, passing)
  expect(cards(world)).toEqual(['book'])
  expect(interact(world.loop, world.story, 'book.return', view(near(CAST.returnDesk.at), ['returnDesk']))).toBe('done')
  expect(world.loop.recall('book')).toMatchObject({ status: 'done', source: 'S → M' })
  expect(cards(world)).toEqual([])
  expect(interactions(world.loop, world.story).some(entry => entry.id === 'book.return')).toBe(false)
})

test('task 2: after the meeting the glasses wait while you talk, then remind', () => {
  const world = planned()
  const meeting = view(PLACES.lt.at, ['zhou'])
  until(world, TIMES.meetingEnd, meeting)
  expect(world.story.world.chat).toMatchObject({ with: 'zhou' })
  expect(world.loop.state.action.latest).toMatchObject({ kind: 'wait', uses: ['S', 'M'] })
  expect(cards(world)).toEqual([])
  until(world, TIMES.meetingEnd + minutes(5), meeting)
  expect(world.loop.state.trace.filter(entry => entry.kind === 'wait')).toHaveLength(1)
  expect(interact(world.loop, world.story, 'chat.leave', meeting)).toBe('done')
  tick(world, meeting)
  expect(cards(world)).toEqual(['report'])
  expect(world.loop.state.action.cards[0].why?.en).toContain('finished talking')
  answerCard(world.loop, world.story, 'report', 'later')
  expect(world.loop.recall('report')?.source).toBe('S → M')
  until(world, TIMES.meetingEnd + minutes(19), view(far))
  expect(cards(world)).toEqual([])
  until(world, TIMES.meetingEnd + minutes(21), view(far))
  expect(cards(world)).toEqual(['report'])
  answerCard(world.loop, world.story, 'report', 'send')
  expect(world.loop.recall('report')?.status).toBe('done')
  expect(world.story.world.reportSent).toBeGreaterThan(TIMES.meetingEnd)
})

test('task 2 without attending: the calendar time alone triggers the reminder at noon', () => {
  const world = planned()
  until(world, TIMES.meetingEnd, view(far))
  expect(world.story.world.chat).toBeUndefined()
  expect(cards(world)).toEqual(['report'])
  expect(world.loop.state.action.cards.find(card => card.id === 'report')?.why?.en).toBe('The group meeting ended at 12:00.')
})

test('task 7: overheard health information stays in Sensing and is refused by Memory', () => {
  const world = planned()
  const before = serializeLoop(world.loop.state)
  until(world, TIMES.privacyStart, view(near(CAST.chatA.at), ['chatA', 'chatB']))
  expect(world.loop.evidence('lt.overheard')).toBeDefined()
  expect(world.loop.state.trace.at(-1)).toMatchObject({ module: 'M', channels: [], refused: ['S → M'] })
  expect(world.loop.state.memory.map(record => record.id)).toEqual(JSON.parse(before).memory.map((record: { id: string }) => record.id))
  expect(world.loop.state.tally.refused).toBe(1)
  const absent = planned()
  until(absent, TIMES.privacyEnd, view(far))
  expect(absent.loop.state.tally.refused).toBeUndefined()
})

test('task 3: every reminder is written back, and a check soon after is linked to it', () => {
  const world = withReadings()
  expect(world.loop.recall(READINGS)?.source).toBe('S → M')
  until(world, at(1, 10), view(far))
  expect(cards(world)).toEqual(['readings'])
  expect(world.loop.recall(READINGS_REMINDERS)).toMatchObject({ source: 'A → M', data: { count: 1, last: at(1, 10) } })
  answerCard(world.loop, world.story, READINGS, 'ok')
  until(world, at(1, 10, 5), view(far))
  interact(world.loop, world.story, 'readings.check', view(near(CAST.rig.at), ['rig']))
  expect(world.loop.recall(READINGS_CHECKS)?.data).toMatchObject({ count: 1, afterReminder: 1 })
  // The next interval counts from the check, so the next card is at 10:35.
  until(world, at(1, 10, 34), view(far))
  expect(cards(world)).toEqual([])
  until(world, at(1, 10, 35), view(far))
  expect(cards(world)).toEqual(['readings'])
})

test('task 3: an unanswered card is renewed each interval; answering late does not fire again at once', () => {
  const world = withReadings()
  until(world, at(1, 10, 30), view(far))
  expect(world.loop.recall(READINGS_REMINDERS)?.data).toMatchObject({ count: 2, last: at(1, 10, 30) })
  expect(cards(world)).toEqual(['readings'])
  answerCard(world.loop, world.story, READINGS, 'ok')
  tick(world, view(far))
  expect(cards(world)).toEqual([])
})

test('task 3: stopping the reminders leaves the old records, logs shadows and writes nothing new', () => {
  const world = withReadings()
  until(world, at(1, 10), view(far))
  answerCard(world.loop, world.story, READINGS, 'off')
  expect(world.loop.recall(READINGS_PREF)).toMatchObject({ source: 'S → M', data: { on: false } })
  const kept = world.loop.recall(READINGS_REMINDERS)
  until(world, at(1, 11, 5), view(far))
  expect(cards(world)).toEqual([])
  expect(world.loop.recall(READINGS_REMINDERS)).toEqual(kept)
  const shadows = world.loop.state.trace.filter(entry => entry.shadow)
  expect(shadows).toHaveLength(2)
  expect(world.loop.state.tally.shadow).toBe(2)
  interact(world.loop, world.story, 'readings.check', view(near(CAST.rig.at), ['rig']))
  expect(world.loop.recall(READINGS_CHECKS)?.data).toMatchObject({ afterOff: 1, afterReminder: 0 })
  // Switching back on picks up from Memory and reads the old reminder record.
  until(world, at(1, 12, 10), view(far))
  const used = world.loop.recall(READINGS_REMINDERS)?.used ?? 0
  expect(agendaAction(world.loop, world.story, 'readings.on')).toBe(true)
  tick(world, view(far))
  expect(cards(world)).toContain('readings')
  expect(world.loop.recall(READINGS_REMINDERS)?.used).toBe(used + 1)
})

test('task 3, research control: with A → M frozen the glasses repeat themselves and cannot link your check', () => {
  const world = withReadings()
  world.loop.setFrozen('A → M', true)
  until(world, at(1, 10), view(far))
  expect(world.loop.recall(READINGS_REMINDERS)).toBeUndefined()
  expect(world.loop.state.trace.at(-1)).toMatchObject({ frozen: true, channels: ['A → M'] })
  answerCard(world.loop, world.story, READINGS, 'ok')
  tick(world, view(far))
  expect(cards(world)).toEqual(['readings'])
  interact(world.loop, world.story, 'readings.check', view(near(CAST.rig.at), ['rig']))
  expect(world.loop.recall(READINGS_CHECKS)?.data).toMatchObject({ count: 1, afterReminder: 0 })
})

test('task 3: during the meeting the reminder waits for it to end', () => {
  const world = withReadings()
  const meeting = view(PLACES.lt.at, ['presenter'])
  until(world, at(1, 10, 30), view(far))
  answerCard(world.loop, world.story, READINGS, 'ok')
  until(world, at(1, 11, 5), meeting)
  expect(cards(world)).toEqual([])
  expect(world.loop.state.trace.filter(entry => entry.kind === 'wait' && entry.task === READINGS)).toHaveLength(1)
  expect(world.loop.state.action.latest).toMatchObject({ kind: 'wait', uses: ['S', 'M'] })
})

test('task 3: the readings reminder also waits while you talk, then comes with the report', () => {
  const world = withReadings()
  until(world, at(1, 11, 40), view(far))
  answerCard(world.loop, world.story, READINGS, 'ok')
  const meeting = view(PLACES.lt.at, ['zhou'])
  until(world, at(1, 12, 5), meeting)
  expect(cards(world)).toEqual([])
  expect(world.loop.state.trace.filter(entry => entry.kind === 'wait').map(entry => entry.task)).toEqual(['readings', 'report'])
  interact(world.loop, world.story, 'chat.leave', meeting)
  tick(world, meeting)
  expect(cards(world)).toEqual(['readings', 'report'])
})

test('Lin’s 13:00 message is passed on, not acted on', () => {
  const world = withReadings()
  until(world, at(1, 12, 59), view(far))
  world.loop.dismiss(READINGS)
  until(world, TIMES.linMessage, view(far))
  expect(cards(world)).toContain('lin.message')
  const notify = world.loop.state.trace.find(entry => entry.kind === 'notify' && entry.task === READINGS)
  expect(notify?.channels).toEqual(['S → A'])
  expect(world.loop.recall(READINGS_PREF)).toBeUndefined()
  const skipped = planned()
  until(skipped, TIMES.linMessage, view(far))
  expect(cards(skipped)).not.toContain('lin.message')
})

test('task 10: the evening review compares before and after, and is written back', () => {
  const world = withReadings()
  until(world, at(1, 10), view(far))
  answerCard(world.loop, world.story, READINGS, 'off')
  until(world, at(1, 18), view(far))
  const review = world.loop.state.action.cards.find(card => card.id === 'review.1')!
  expect(review.lines?.map(line => line.en)).toEqual([
    'This morning: Send the report to Prof. Chen ✗ · Return the library book ✗ · Print the G-07 poster ✗',
    'Readings: 1 reminder before you stopped them; you checked within 10 min after 0 of them',
    `After: the log holds ${world.loop.state.tally.shadow} “would have reminded”; you checked 0 times on your own`,
    'No check followed a reminder, so this day says nothing about whether the reminders helped.',
    'Tomorrow: 16:00 study group G-07 at Hall 2'
  ])
  expect(world.loop.recall('review.1')?.source).toBe('A → M')
  expect(world.loop.recall(READINGS)?.status).toBe('stale')
  expect(world.story.clock.minute).toBe(DAY_END)
  answerCard(world.loop, world.story, 'review.1', 'carry')
  expect(world.loop.recall('book')).toMatchObject({ status: 'active', source: 'S → M', data: { carried: true } })
})

test('day 2 starts from Memory: yesterday is carried over, and the ending looks back on both days', () => {
  const world = planned()
  until(world, at(1, 18), view(far))
  expect(startDay2(world.loop, world.story)).toBe(true)
  expect(startDay2(world.loop, world.story)).toBe(false)
  expect(cards(world)).toEqual([])
  tick(world, view(far))
  const plan = world.loop.state.action.cards.find(card => card.id === 'plan.2')!
  expect(plan.lines?.map(line => line.en)).toEqual([
    'The library book is still not returned · I will remind you when you pass the library', 'The report to Prof. Chen is still not sent',
    'The poster is not confirmed on the board yet', '16:00 study group G-07 · Hall 2', 'Added today: get the internship form signed by Prof. Chen this afternoon', 'Added today: collect medicine at University Health Service before 17:00'
  ])
  expect(world.loop.state.trace.at(-1)).toMatchObject({ kind: 'ask', channels: ['M → A'] })
  answerCard(world.loop, world.story, 'plan.2', 'ok')
  tick(world, view(near(PLACES.library.at, 10)))
  expect(cards(world)).toEqual(['book'])
  until(world, at(2, 18), view(far))
  const ending = world.loop.state.action.cards.find(card => card.id === 'ending')!
  expect(ending.lines?.some(line => line.en.startsWith('Missed: I reminded you at the library'))).toBe(true)
  expect(answerCard(world.loop, world.story, 'ending', 'again')).toBe('reset')
})

test('quiet mode holds the morning question until you switch it off', () => {
  const world = setup()
  noteQuietPreference(world.loop, true)
  tick(world, view(far))
  expect(cards(world)).toEqual([])
  expect(world.loop.state.action.held['plan.1']).toBeDefined()
  noteQuietPreference(world.loop, false)
  tick(world, view(far))
  expect(cards(world)).toEqual(['plan.1'])
})

test('fast-forward stops at the next timed thing, including checks between interactions', () => {
  const world = setup()
  tick(world, view(far))
  expect(nextEvent(world.loop, world.story)).toMatchObject({ at: at(1, 10, 45) })
  const reading = withReadings()
  expect(nextEvent(reading.loop, reading.story)).toMatchObject({ at: at(1, 10) })
  until(reading, at(1, 12, 30), view(far))
  reading.loop.dismiss(READINGS)
  expect(nextEvent(reading.loop, reading.story)?.at).toBe(TIMES.linMessage)
  const evening = setup()
  skipTo(evening.story.clock, at(1, 18))
  expect(nextEvent(evening.loop, evening.story)).toBeUndefined()
})

test('the cast follows the timetable', () => {
  const story = newStory()
  expect(present(story, 'presenter')).toBe(false)
  skipTo(story.clock, TIMES.meetingStart)
  expect(['presenter', 'peer', 'zhou', 'chatA', 'lin'].map(id => present(story, id as CastId))).toEqual([true, true, true, true, true])
  skipTo(story.clock, TIMES.zhouLeaves)
  expect(present(story, 'zhou')).toBe(false)
})

test('the agenda is your own calendar, with the actions you can take yourself', () => {
  const world = planned()
  until(world, TIMES.meetingEnd + minutes(1), view(far))
  const items = agenda(world.loop, world.story)
  expect(items.map(item => [item.id, item.state])).toEqual([['a17', 'todo'], ['meeting', 'missed'], ['report', 'todo'], ['book', 'todo'], ['poster', 'todo'], ['chen1', 'todo']])
  expect(items.find(item => item.id === 'report')?.action?.id).toBe('report.send')
  expect(agendaAction(world.loop, world.story, 'report.send')).toBe(true)
  expect(world.loop.recall('report')?.status).toBe('done')
  expect(cards(world)).not.toContain('report')
})

test('the story restores what is valid and starts over on anything else', () => {
  const world = withReadings()
  until(world, at(1, 10, 3), view(far))
  const restored = setup(restoreStory(serializeStory(world.story)), serializeLoop(world.loop.state))
  expect(restored.story).toEqual(world.story)
  tick(restored, view(far))
  expect(restored.loop.state.trace.filter(entry => entry.kind === 'ask')).toHaveLength(1)
  for (const bad of [null, '{', '{"version":2}', JSON.stringify({ version: 1, clock: { day: 9 }, world: { chat: { with: 'nobody', until: 5 } }, marks: { x: 'y' } })]) {
    const story = restoreStory(bad)
    expect(story.clock).toEqual({ day: 1, minute: 540 })
    expect(story.world).toEqual({ checks: 0, battery: 100 })
    expect(story.marks).toEqual({})
  }
})
