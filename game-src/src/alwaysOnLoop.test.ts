import { expect, test } from 'vitest'
import { EVIDENCE_BUFFER_MS, QUIET_PREFERENCE, createServiceLoop, noteQuietPreference, readLoop, restoreLoop, serializeLoop, speak, text } from './alwaysOnLoop'

const note = text('note', '说明')
const label = text('Desk', '桌子')
const setup = () => {
  let time = 1000
  const loop = createServiceLoop(undefined, () => time)
  return { loop, advance (ms: number) { time += ms } }
}

test('each write derives its channel from the receiving module and its source', () => {
  const { loop } = setup()
  loop.observe('t', { id: 'o', label, value: label }, { guidedBy: ['memory', 'action'], note })
  loop.remember('t', { id: 'r', kind: 'fact', label, value: label }, { from: 'sensing', note })
  loop.remember('t', { id: 'r', kind: 'fact', label, value: label }, { from: 'action', note })
  loop.act('t', { kind: 'permit', label }, { uses: ['sensing', 'memory'], note })
  expect(loop.state.trace.map(entry => entry.channels)).toEqual([['M → S', 'A → S'], ['S → M'], ['A → M'], ['S → A', 'M → A']])
  expect(loop.state.counts).toEqual({ 'M → S': 1, 'A → S': 1, 'S → M': 1, 'A → M': 1, 'S → A': 1, 'M → A': 1 })
})

test('local decisions are traced without inventing a channel', () => {
  const { loop } = setup()
  loop.observe('t', { id: 'o', label, value: label }, { note })
  loop.act('t', { kind: 'wait', label }, { note })
  loop.remember('t', { id: 'r', kind: 'evidence', label, value: label }, { from: 'sensing', note })
  expect(loop.expire('r', note)).toBe(true)
  expect(loop.expire('r', note)).toBe(false)
  expect(loop.state.trace.map(entry => [entry.module, entry.channels.length])).toEqual([['S', 0], ['A', 0], ['M', 1], ['M', 0]])
  expect(loop.recall('r')?.status).toBe('stale')
})

test('writing an existing id updates the record in place and records its latest source', () => {
  const { loop } = setup()
  loop.remember('t', { id: 'r', kind: 'commitment', label, value: text('pending', '待办') }, { from: 'sensing', note })
  loop.remember('t', { id: 'r', kind: 'commitment', label, value: text('done', '完成'), status: 'done' }, { from: 'action', note })
  expect(loop.state.memory).toHaveLength(1)
  expect(loop.recall('r')).toMatchObject({ status: 'done', source: 'A → M', value: { en: 'done' } })
})

test('evidence survives a brief glance away but lapses once its anchor stays out of view', () => {
  const { loop, advance } = setup()
  loop.see('desk', { label, inView: true, distance: 2 })
  loop.observe('t', { id: 'label', anchor: 'desk', label, value: label }, { note })
  advance(1000)
  loop.see('desk', { label, inView: false, distance: 9 })
  expect(loop.evidence('label')).toBeDefined()
  advance(EVIDENCE_BUFFER_MS)
  loop.see('desk', { label, inView: false, distance: 9 })
  expect(loop.evidence('label')).toBeUndefined()
  expect(loop.inView('desk')).toBe(false)
})

test('unchanged field updates do not replace sensing state', () => {
  const { loop } = setup()
  loop.see('desk', { label, inView: true, distance: 2.2 })
  const entry = loop.state.sensing.field.desk
  loop.see('desk', { label: text('Desk', '桌子'), inView: true, distance: 1.8 })
  expect(loop.state.sensing.field.desk).toBe(entry)
})

test('writes in one synchronous turn share a step; the next turn starts another', async () => {
  const { loop } = setup()
  loop.act('t', { kind: 'prompt', label }, { note })
  loop.act('t', { kind: 'prompt', label }, { note })
  await Promise.resolve()
  loop.act('t', { kind: 'prompt', label }, { note })
  expect(loop.state.trace.map(entry => entry.step)).toEqual([1, 1, 2])
})

test('scheduled checks accumulate capped active time and stop at their due time', () => {
  const { loop } = setup()
  expect(loop.serve('missing', 500)).toBe(0)
  loop.schedule('check', 't', { label, dueMs: 3000 })
  expect(loop.serve('check', 999_999)).toBe(1000)
  expect(loop.serve('check', Number.NaN)).toBe(1000)
  loop.schedule('check', 't', { label, dueMs: 3000 })
  expect(loop.serve('check', 900)).toBe(1900)
  expect(loop.serve('check', 900)).toBe(2800)
  expect(loop.serve('check', 900)).toBe(3000)
  loop.restart('check')
  expect(loop.state.action.scheduled.check.elapsedMs).toBe(0)
  loop.unschedule('check')
  expect(loop.state.action.scheduled.check).toBeUndefined()
})

test('reload keeps Memory, the trace and scheduled checks, but never current Sensing', () => {
  const { loop } = setup()
  loop.see('desk', { label, inView: true, distance: 2 })
  loop.observe('t', { id: 'label', anchor: 'desk', label, value: label }, { note })
  loop.remember('t', { id: 'task', kind: 'commitment', label, value: label, data: { stage: 'pending' } }, { from: 'sensing', note })
  loop.remember('t', { id: 'check', kind: 'evidence', label, value: label }, { from: 'sensing', note })
  loop.schedule('remind', 't', { label, dueMs: 5000 })
  loop.serve('remind', 800)
  const restored = createServiceLoop(restoreLoop(serializeLoop(loop.state)))
  expect(restored.state.sensing).toEqual({ field: {}, evidence: {} })
  expect(restored.recall('task')).toMatchObject({ status: 'active', data: { stage: 'pending' } })
  // A check describes the moment it was made, so it comes back stale.
  expect(restored.recall('check')?.status).toBe('stale')
  expect(restored.state.action.scheduled.remind.elapsedMs).toBe(800)
  expect(restored.state.trace).toEqual(loop.state.trace)
  expect(restored.state.counts).toEqual(loop.state.counts)
  restored.act('t', { kind: 'prompt', label }, { note })
  expect(restored.state.trace.at(-1)!.seq).toBe(loop.state.seq + 1)
})

test('malformed saves restore only valid parts and never throw', () => {
  for (const raw of [null, '{', 'null', '[]', '{"version":2}']) expect(restoreLoop(raw).memory).toEqual([])
  const state = restoreLoop(JSON.stringify({
    version: 1,
    memory: [
      { id: 'ok', task: 't', kind: 'receipt', label, value: label, status: 'done', source: 'A → M', at: 1 },
      { id: 'bad-kind', task: 't', kind: 'rumour', label, value: label, status: 'active', source: 'S → M', at: 1 },
      { id: 'bad-source', task: 't', kind: 'fact', label, value: label, status: 'active', source: 'M → M', at: 1 },
      { id: 'bad-text', task: 't', kind: 'fact', label: 'Desk', value: label, status: 'active', source: 'S → M', at: 1 }
    ],
    trace: [{ seq: 1, step: 1, at: 1, task: 't', module: 'M', channels: ['S → A'], note }],
    counts: { 'S → A': -3, 'S → M': 2.7, 'X → Y': 4 },
    scheduled: { remind: { task: 't', label, dueMs: 100, elapsedMs: 900 }, broken: { task: 't', label, dueMs: 0 } }
  }))
  expect(state.memory.map(record => record.id)).toEqual(['ok'])
  expect(state.trace).toEqual([])
  expect(state.counts).toEqual({ 'S → M': 2 })
  expect(Object.keys(state.action.scheduled)).toEqual(['remind'])
  expect(state.action.scheduled.remind.elapsedMs).toBe(100)
})

test('quiet mode becomes a preference only when it differs from what is remembered', () => {
  const { loop } = setup()
  noteQuietPreference(loop, false)
  expect(loop.recall(QUIET_PREFERENCE)).toBeUndefined()
  noteQuietPreference(loop, true)
  noteQuietPreference(loop, true)
  expect(loop.state.trace).toHaveLength(1)
  expect(loop.recall(QUIET_PREFERENCE)).toMatchObject({ kind: 'preference', source: 'S → M', data: { on: true } })
  noteQuietPreference(loop, false)
  expect(loop.recall(QUIET_PREFERENCE)?.data?.on).toBe(false)
})

test('an explicit reset deletes Memory, trace and checks but keeps counters rising', async () => {
  const { loop } = setup()
  loop.see('desk', { label, inView: true, distance: 2 })
  loop.observe('t', { id: 'label', anchor: 'desk', label, value: label }, { guidedBy: 'memory', note })
  loop.remember('t', { id: 'task', kind: 'commitment', label, value: label }, { from: 'sensing', note })
  loop.act('t', { kind: 'prompt', label }, { uses: 'memory', note })
  loop.schedule('remind', 't', { label, dueMs: 5000 })
  const { seq, step } = loop.state
  await Promise.resolve()
  loop.reset(text('Reset', '重置'))
  expect(loop.state.memory).toEqual([])
  expect(loop.state.sensing).toEqual({ field: {}, evidence: {} })
  expect(loop.state.action).toEqual({ scheduled: {}, cards: [], held: {} })
  expect(loop.state.counts).toEqual({})
  expect(loop.state.trace).toHaveLength(1)
  expect(loop.state.trace[0]).toMatchObject({ module: 'M', channels: [], seq: seq + 1, step: step + 1 })
  // The reset survives a reload as the only history.
  expect(restoreLoop(serializeLoop(loop.state)).trace).toHaveLength(1)
})

test('readers work on plain snapshots as well as the live state', () => {
  const { loop } = setup()
  loop.remember('t', { id: 'r', kind: 'fact', label, value: label }, { from: 'sensing', note })
  const snapshot = JSON.parse(JSON.stringify(loop.state))
  expect(readLoop(snapshot).recall('r')?.kind).toBe('fact')
})

test('decisions record which memories they read, and each record counts its uses', () => {
  const { loop } = setup()
  loop.remember('t', { id: 'plan', kind: 'commitment', label, value: label }, { from: 'sensing', note })
  loop.act('t', { kind: 'remind', label }, { uses: 'memory', reads: ['plan', 'missing'], note })
  loop.act('t', { kind: 'remind', label }, { uses: 'memory', reads: ['plan'], note })
  expect(loop.state.trace.at(-1)?.reads).toEqual(['plan'])
  expect(loop.recall('plan')?.used).toBe(2)
  // Updating the record keeps its history of use.
  loop.remember('t', { id: 'plan', kind: 'commitment', label, value: text('done', '完成'), status: 'done' }, { from: 'sensing', note })
  expect(loop.recall('plan')?.used).toBe(2)
})

test('a shadow decision is only logged: no card, no latest decision, no channel count, no use', () => {
  const { loop } = setup()
  loop.remember('t', { id: 'plan', kind: 'commitment', label, value: label }, { from: 'sensing', note })
  loop.act('t', { kind: 'remind', label }, { uses: 'memory', reads: ['plan'], shadow: true, note, card: { id: 'c', kind: 'reminder', title: label, actions: [{ id: 'ok', label }] } })
  expect(loop.state.trace.at(-1)).toMatchObject({ shadow: true, channels: ['M → A'] })
  expect(loop.state.action.cards).toEqual([])
  expect(loop.state.action.latest).toBeUndefined()
  expect(loop.state.counts['M → A']).toBeUndefined()
  expect(loop.recall('plan')?.used).toBeUndefined()
})

test('declining writes nothing and records the refused channel', () => {
  const { loop } = setup()
  loop.decline('t', { from: 'sensing', note })
  expect(loop.state.memory).toEqual([])
  expect(loop.state.trace.at(-1)).toMatchObject({ module: 'M', channels: [], refused: ['S → M'] })
  expect(loop.state.counts).toEqual({})
})

test('cards come from decisions, replace their own id and leave when answered', () => {
  const { loop } = setup()
  const card = { id: 'book', kind: 'reminder' as const, title: text('Return the book', '还书'), why: text('Passing the library', '路过图书馆'), basis: 'book', actions: [{ id: 'ok', label: text('OK', '知道了'), primary: true }] }
  loop.act('t', { kind: 'remind', label }, { uses: 'memory', note, card })
  loop.act('t', { kind: 'remind', label }, { uses: 'memory', note, card: { ...card, title: text('Again', '再次') } })
  expect(loop.state.action.cards).toHaveLength(1)
  expect(loop.state.action.cards[0]).toMatchObject({ id: 'book', task: 't', title: { zh: '再次' }, basis: 'book' })
  expect(loop.dismiss('book')?.id).toBe('book')
  expect(loop.dismiss('book')).toBeUndefined()
  expect(loop.state.action.cards).toEqual([])
})

test('a frozen channel logs the attempted write but changes no memory', () => {
  const { loop } = setup()
  loop.setFrozen('A → M', true)
  expect(loop.remember('t', { id: 'r', kind: 'fact', label, value: label }, { from: 'action', note })).toBe(false)
  expect(loop.recall('r')).toBeUndefined()
  expect(loop.state.trace.at(-1)).toMatchObject({ frozen: true, channels: ['A → M'] })
  expect(loop.state.counts['A → M']).toBeUndefined()
  expect(loop.remember('t', { id: 's', kind: 'fact', label, value: label }, { from: 'sensing', note })).toBe(true)
  loop.setFrozen('A → M', false)
  expect(loop.remember('t', { id: 'r', kind: 'fact', label, value: label }, { from: 'action', note })).toBe(true)
})

test('campus-clock checks are tracked directly, and the evidence buffer follows the loop clock', () => {
  let time = 0
  const loop = createServiceLoop(undefined, () => time, { evidenceBufferMs: 75_000 })
  loop.track('readings', 't', { label, elapsedMs: 600_000, dueMs: 1_800_000, unit: 'game' })
  expect(loop.state.action.scheduled.readings).toMatchObject({ elapsedMs: 600_000, unit: 'game' })
  loop.see('desk', { label, inView: true, distance: 2 })
  loop.observe('t', { id: 'o', anchor: 'desk', label, value: label }, { note })
  time += 60_000
  loop.see('desk', { label, inView: false, distance: 9 })
  expect(loop.evidence('o')).toBeDefined()
  time += 20_000
  loop.see('desk', { label, inView: false, distance: 9 })
  expect(loop.evidence('o')).toBeUndefined()
})

test('cards, uses, frozen channels and trace details survive a reload', () => {
  const { loop } = setup()
  loop.remember('t', { id: 'plan', kind: 'commitment', label, value: label }, { from: 'sensing', note })
  loop.act('t', { kind: 'remind', label }, { uses: 'memory', reads: ['plan'], note, card: { id: 'c', kind: 'reminder', title: label, basis: 'plan', lines: [label], private: true, actions: [{ id: 'ok', label, primary: true }] } })
  loop.decline('t', { from: 'sensing', note })
  loop.act('t', { kind: 'remind', label }, { uses: 'memory', note, shadow: true })
  loop.setFrozen('A → M', true)
  loop.remember('t', { id: 'x', kind: 'fact', label, value: label }, { from: 'action', note })
  const restored = restoreLoop(serializeLoop(loop.state))
  expect(restored.action.cards).toEqual(loop.state.action.cards)
  expect(restored.frozen).toEqual(['A → M'])
  expect(restored.memory.find(record => record.id === 'plan')?.used).toBe(1)
  expect(restored.trace).toEqual(loop.state.trace)
})

test('decisions are tallied by kind; shadows and refusals get their own tallies', () => {
  const { loop } = setup()
  loop.act('t', { kind: 'remind', label }, { note })
  loop.act('t', { kind: 'remind', label }, { note, shadow: true })
  loop.act('t', { kind: 'wait', label }, { note })
  loop.decline('t', { from: 'sensing', note })
  expect(loop.state.tally).toEqual({ remind: 1, shadow: 1, wait: 1, refused: 1 })
  expect(restoreLoop(serializeLoop(loop.state)).tally).toEqual(loop.state.tally)
})

test('speak shows a card, or in quiet mode holds it once and releases it when quiet ends', () => {
  const { loop } = setup()
  const card = { id: 'c', kind: 'reminder' as const, title: label, actions: [{ id: 'ok', label }] }
  expect(speak(loop, 't', { kind: 'remind', label }, { uses: 'sensing', note, card })).toBe(true)
  expect(loop.showing('c')).toBe(true)
  loop.dismiss('c')
  noteQuietPreference(loop, true)
  expect(speak(loop, 't', { kind: 'remind', label }, { uses: 'sensing', reads: ['r'], note, card })).toBe(false)
  expect(speak(loop, 't', { kind: 'remind', label }, { uses: 'sensing', note, card })).toBe(false)
  expect(loop.showing('c')).toBe(false)
  expect(loop.state.action.held).toEqual({ c: { task: 't', title: label, at: 1000 } })
  const waits = loop.state.trace.filter(entry => entry.kind === 'wait')
  expect(waits).toHaveLength(1)
  expect(waits[0].channels).toEqual(['S → A', 'M → A'])
  expect(restoreLoop(serializeLoop(loop.state)).action.held).toEqual(loop.state.action.held)
  noteQuietPreference(loop, false)
  expect(loop.state.action.held).toEqual({})
})
