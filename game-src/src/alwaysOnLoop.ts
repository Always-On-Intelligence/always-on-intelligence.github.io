/**
 * Authored always-on service loop: fixed rules, visible state.
 *
 * Tasks decide when to observe, remember and act; this module only records
 * those decisions so every view reads one state. Each write names its
 * receiving module (observe → S, remember → M, act → A) and its source module,
 * so the directed channel follows from the call instead of a hand-written
 * label. Nothing here learns or revises a rule.
 */

export type Lang = 'en' | 'zh'
export type Text = { en: string, zh: string }
export const text = (en: string, zh: string): Text => ({ en, zh })

export type Module = 'S' | 'M' | 'A'
export const CHANNELS = ['S → A', 'S → M', 'M → A', 'A → S', 'M → S', 'A → M'] as const
export type Channel = typeof CHANNELS[number]
const ROLE = { sensing: 'S', memory: 'M', action: 'A' } as const
type Many<T> = T | readonly T[]

export type Data = Record<string, string | number | boolean>
/** Sensing space: task-relevant people and places, and whether they are in view now. */
export type FieldEntry = { label: Text, inView: boolean, distance: number }
/** Current evidence. It is a short buffer that lapses once its anchor leaves view. */
export type Observation = { id: string, task: string, anchor?: string, label: Text, value: Text, data?: Data, guidedBy: readonly Module[], at: number }
export const MEMORY_KINDS = ['commitment', 'fact', 'evidence', 'preference', 'receipt'] as const
export type MemoryKind = typeof MEMORY_KINDS[number]
export type MemoryStatus = 'active' | 'stale' | 'done'
/** `used` counts the Action decisions that read this record. */
export type MemoryRecord = { id: string, task: string, kind: MemoryKind, label: Text, value: Text, status: MemoryStatus, source: Channel | 'M', at: number, data?: Data, used?: number }
export const DECISION_KINDS = ['prompt', 'check', 'permit', 'block', 'execute', 'remind', 'wait', 'ask', 'notify', 'review'] as const
export type DecisionKind = typeof DECISION_KINDS[number]
export type Decision = { task: string, kind: DecisionKind, label: Text, note: Text, uses: readonly Module[], at: number }
/** A check that runs between interactions: the continuing part of the loop. `unit: 'game'` values are campus-clock time. */
export type Scheduled = { task: string, label: Text, elapsedMs: number, dueMs: number, unit?: 'game' }
export const CARD_KINDS = ['reminder', 'confirm', 'message', 'review', 'plan'] as const
export type CardKind = typeof CARD_KINDS[number]
export type CardAction = { id: string, label: Text, primary?: boolean }
/** Something Action says to the user and waits for an answer to. `basis` names the memory record it relies on. */
export type Card = { id: string, task: string, kind: CardKind, title: Text, why?: Text, basis?: string, lines?: Text[], private?: boolean, actions: CardAction[], at: number }
export type CardInput = Omit<Card, 'task' | 'at'>
/** A card Action chose not to show yet, such as a reminder held in quiet mode. It is still owed. */
export type Held = { task: string, title: Text, at: number }
/** Decisions by kind, plus shadow and refused entries. The trace is capped; these tallies are not. */
export type TallyKey = DecisionKind | 'shadow' | 'refused'
/**
 * `ref` names the observation or record a write touched; `kind` names an Action decision;
 * `reads` lists the records a decision used. Shadow, refused and frozen entries describe
 * something that did not happen, so they never count as channel use.
 */
export type TraceEntry = {
  seq: number, step: number, at: number, task: string, module: Module, channels: readonly Channel[], note: Text
  ref?: string, kind?: DecisionKind, reads?: readonly string[], shadow?: true, refused?: readonly Channel[], frozen?: true
}
export type LoopState = {
  version: 1
  seq: number
  step: number
  sensing: { field: Record<string, FieldEntry>, evidence: Record<string, Observation> }
  memory: MemoryRecord[]
  action: { latest?: Decision, scheduled: Record<string, Scheduled>, cards: Card[], held: Record<string, Held> }
  trace: TraceEntry[]
  counts: Partial<Record<Channel, number>>
  tally: Partial<Record<TallyKey, number>>
  /** Research control: channels whose writes are switched off. */
  frozen: Channel[]
}

const TRACE_LIMIT = 200
const MEMORY_LIMIT = 60
const CARD_LIMIT = 6
const TICK_CAP_MS = 1000
export const EVIDENCE_BUFFER_MS = 2500

export const newLoopState = (): LoopState => ({ version: 1, seq: 0, step: 0, sensing: { field: {}, evidence: {} }, memory: [], action: { scheduled: {}, cards: [], held: {} }, trace: [], counts: {}, tally: {}, frozen: [] })
const list = <T>(value: Many<T> | undefined): T[] => (value === undefined ? [] : Array.isArray(value) ? [...value] : [value as T])
const copyText = (value: Text): Text => ({ en: value.en, zh: value.zh })
const copyData = (value: Data): Data => ({ ...value })
const copyCard = (card: CardInput): CardInput => ({
  id: card.id, kind: card.kind, title: copyText(card.title), actions: card.actions.map(action => ({ id: action.id, label: copyText(action.label), ...(action.primary ? { primary: true } : {}) })),
  ...(card.why ? { why: copyText(card.why) } : {}), ...(card.basis ? { basis: card.basis } : {}),
  ...(card.lines?.length ? { lines: card.lines.map(copyText) } : {}), ...(card.private ? { private: true } : {})
})

type ReadableState = {
  readonly memory: ReadonlyArray<Readonly<MemoryRecord>>
  readonly sensing: { readonly field: Readonly<Record<string, Readonly<FieldEntry>>>, readonly evidence: Readonly<Record<string, Readonly<Observation>>> }
}
/** Reads for task rules and views. Works on the live state or a render snapshot. */
export function readLoop (state: ReadableState) {
  return {
    recall: (id: string): Readonly<MemoryRecord> | undefined => state.memory.find(record => record.id === id),
    evidence: (id: string): Readonly<Observation> | undefined => state.sensing.evidence[id],
    inView: (id: string) => Boolean(state.sensing.field[id]?.inView)
  }
}
export type LoopReader = ReturnType<typeof readLoop>

type LogDetail = { note: Text, ref?: string, kind?: DecisionKind, reads?: readonly string[], shadow?: boolean, refused?: readonly Channel[], frozen?: boolean }

/** `evidenceBufferMs` is in the clock's own units, so a faster campus clock can keep the same real-time buffer. */
export function createServiceLoop (state: LoopState = newLoopState(), clock: () => number = Date.now, options: { evidenceBufferMs?: number } = {}) {
  const bufferMs = options.evidenceBufferMs ?? EVIDENCE_BUFFER_MS
  // When each anchor was last in view. Bookkeeping for the evidence buffer, never displayed.
  const seen = new Map<string, number>()
  let stepOpen = false
  function log (task: string, module: Module, sources: readonly Module[], { note, ref, kind, reads, shadow, refused, frozen }: LogDetail): Channel[] {
    // Writes made in one synchronous turn form one step, so views can replay them in order.
    if (!stepOpen) {
      stepOpen = true
      state.step++
      queueMicrotask(() => { stepOpen = false })
    }
    const channels = sources.map(source => `${source} → ${module}` as Channel)
    if (!shadow && !frozen) for (const channel of channels) state.counts[channel] = (state.counts[channel] ?? 0) + 1
    const tally: TallyKey | undefined = refused?.length ? 'refused' : kind && shadow ? 'shadow' : kind
    if (tally) state.tally[tally] = (state.tally[tally] ?? 0) + 1
    state.trace.push({
      seq: ++state.seq, step: state.step, at: clock(), task, module, channels, note: copyText(note),
      ...(ref ? { ref } : {}), ...(kind ? { kind } : {}), ...(reads?.length ? { reads: [...reads] } : {}),
      ...(shadow ? { shadow: true } : {}), ...(refused?.length ? { refused: [...refused] } : {}), ...(frozen ? { frozen: true } : {})
    })
    if (state.trace.length > TRACE_LIMIT) state.trace.splice(0, state.trace.length - TRACE_LIMIT)
    return channels
  }
  function upsert (record: MemoryRecord) {
    const index = state.memory.findIndex(entry => entry.id === record.id)
    if (index >= 0) { state.memory[index] = record; return }
    state.memory.push(record)
    while (state.memory.length > MEMORY_LIMIT) {
      // Make room by dropping the oldest record that no longer counts as current.
      const inactive = state.memory.findIndex(entry => entry.status !== 'active')
      state.memory.splice(Math.max(0, inactive), 1)
    }
  }
  function show (task: string, card: CardInput) {
    const next: Card = { ...copyCard(card), task, at: clock() }
    const index = state.action.cards.findIndex(entry => entry.id === card.id)
    if (index >= 0) state.action.cards[index] = next
    else state.action.cards.push(next)
    if (state.action.cards.length > CARD_LIMIT) state.action.cards.splice(0, state.action.cards.length - CARD_LIMIT)
  }
  return {
    state,
    ...readLoop(state),
    now: clock,
    /** Sensing space only: whether an anchor is in view. A local update, so no channel or trace. */
    see (id: string, entry: FieldEntry) {
      const at = clock()
      if (entry.inView) seen.set(id, at)
      const distance = Number.isFinite(entry.distance) ? Math.round(entry.distance) : -1
      const previous = state.sensing.field[id]
      if (!previous || previous.inView !== entry.inView || previous.distance !== distance || previous.label.en !== entry.label.en || previous.label.zh !== entry.label.zh) {
        state.sensing.field[id] = { label: copyText(entry.label), inView: entry.inView, distance }
      }
      if (entry.inView || at - (seen.get(id) ?? -Infinity) <= bufferMs) return
      for (const [key, observation] of Object.entries(state.sensing.evidence)) {
        if (observation.anchor === id) delete state.sensing.evidence[key]
      }
    },
    /** Remove a sensing-space entry that no longer applies, such as a person who has left. */
    unsee (id: string) {
      if (state.sensing.field[id]) delete state.sensing.field[id]
    },
    /** Drop a current observation that no longer applies, such as a finished search. Local: no channel, no trace. */
    drop (id: string) {
      if (state.sensing.evidence[id]) delete state.sensing.evidence[id]
    },
    /** S receives. `guidedBy` names what told Sensing where to look: M → S, A → S. */
    observe (task: string, observation: { id: string, anchor?: string, label: Text, value: Text, data?: Data }, how: { guidedBy?: Many<'memory' | 'action'>, note: Text }) {
      const guidedBy = list(how.guidedBy).map(role => ROLE[role])
      const at = clock()
      if (observation.anchor) seen.set(observation.anchor, at)
      state.sensing.evidence[observation.id] = {
        id: observation.id, task, label: copyText(observation.label), value: copyText(observation.value), guidedBy, at,
        ...(observation.anchor ? { anchor: observation.anchor } : {}), ...(observation.data ? { data: copyData(observation.data) } : {})
      }
      log(task, 'S', guidedBy, { note: how.note, ref: observation.id })
    },
    /**
     * M receives from Sensing (S → M) or Action (A → M). Writing an existing id updates it.
     * Returns false, writing nothing, while that channel is frozen for a research comparison.
     */
    remember (task: string, record: { id: string, kind: MemoryKind, label: Text, value: Text, status?: MemoryStatus, data?: Data }, how: { from: 'sensing' | 'action', note: Text }): boolean {
      const source = ROLE[how.from]
      if (state.frozen.includes(`${source} → M` as Channel)) {
        log(task, 'M', [source], { note: how.note, ref: record.id, frozen: true })
        return false
      }
      const [channel] = log(task, 'M', [source], { note: how.note, ref: record.id })
      const used = state.memory.find(entry => entry.id === record.id)?.used
      upsert({
        id: record.id, task, kind: record.kind, label: copyText(record.label), value: copyText(record.value),
        status: record.status ?? 'active', source: channel, at: clock(), ...(record.data ? { data: copyData(record.data) } : {}), ...(used ? { used } : {})
      })
      return true
    },
    /** M refuses what a source offered, such as another person's private information. Nothing is written. */
    decline (task: string, how: { from: 'sensing' | 'action', note: Text }) {
      log(task, 'M', [], { note: how.note, refused: [`${ROLE[how.from]} → M` as Channel] })
    },
    /** A local Memory decision: the record stays, but no longer counts as current. */
    expire (id: string, note: Text): boolean {
      const record = state.memory.find(entry => entry.id === id)
      if (record?.status !== 'active') return false
      record.status = 'stale'
      record.at = clock()
      log(record.task, 'M', [], { note, ref: id })
      return true
    },
    /**
     * A receives, using current evidence (S → A) and/or retained state (M → A). `reads` names the
     * records the decision used; `card` is what Action says to the user. A shadow decision is only
     * logged: it changes no state, shows nothing and counts as no channel use.
     */
    act (task: string, decision: { kind: DecisionKind, label: Text }, how: { uses?: Many<'sensing' | 'memory'>, note: Text, reads?: readonly string[], shadow?: boolean, card?: CardInput }) {
      const uses = list(how.uses).map(role => ROLE[role])
      const reads = (how.reads ?? []).filter(id => state.memory.some(record => record.id === id))
      if (!how.shadow) {
        state.action.latest = { task, kind: decision.kind, label: copyText(decision.label), note: copyText(how.note), uses, at: clock() }
        for (const record of state.memory) if (reads.includes(record.id)) record.used = (record.used ?? 0) + 1
        if (how.card) show(task, how.card)
      }
      log(task, 'A', uses, { note: how.note, kind: decision.kind, reads, shadow: how.shadow })
    },
    /** Remove a card once the user has answered it. */
    dismiss (id: string): Card | undefined {
      const index = state.action.cards.findIndex(card => card.id === id)
      if (index < 0) return
      return state.action.cards.splice(index, 1)[0]
    },
    showing: (id: string) => state.action.cards.some(card => card.id === id),
    /** Keep a card owed without showing it. Action's own bookkeeping, so no channel or trace. */
    hold (id: string, task: string, title: Text) {
      if (!state.action.held[id]) state.action.held[id] = { task, title: copyText(title), at: clock() }
    },
    release (id: string) {
      if (state.action.held[id]) delete state.action.held[id]
    },
    /** Register a check that runs between interactions. Existing progress is kept. */
    schedule (id: string, task: string, entry: { label: Text, dueMs: number }) {
      if (!state.action.scheduled[id]) state.action.scheduled[id] = { task, label: copyText(entry.label), elapsedMs: 0, dueMs: entry.dueMs }
    },
    /** Add active service time. Paused pages and open menus simply stop calling this. */
    serve (id: string, deltaMs: number): number {
      const entry = state.action.scheduled[id]
      if (!entry) return 0
      const delta = Number.isFinite(deltaMs) ? Math.max(0, Math.min(TICK_CAP_MS, deltaMs)) : 0
      const elapsed = Math.min(entry.dueMs, entry.elapsedMs + delta)
      if (elapsed !== entry.elapsedMs) entry.elapsedMs = elapsed
      return elapsed
    },
    /** Set a scheduled check's progress directly, for checks timed by the campus clock. */
    track (id: string, task: string, entry: { label: Text, elapsedMs: number, dueMs: number, unit?: 'game' }) {
      const current = state.action.scheduled[id]
      const elapsedMs = Math.max(0, Math.min(entry.dueMs, entry.elapsedMs))
      if (current && current.elapsedMs === elapsedMs && current.dueMs === entry.dueMs && current.unit === entry.unit && current.label.zh === entry.label.zh) return
      state.action.scheduled[id] = { task, label: copyText(entry.label), elapsedMs, dueMs: entry.dueMs, ...(entry.unit ? { unit: entry.unit } : {}) }
    },
    restart (id: string) {
      const entry = state.action.scheduled[id]
      if (entry?.elapsedMs) entry.elapsedMs = 0
    },
    unschedule (id: string) {
      if (state.action.scheduled[id]) delete state.action.scheduled[id]
    },
    /** Research control: stop one channel's writes without changing any rule. */
    setFrozen (channel: Channel, on: boolean) {
      const index = state.frozen.indexOf(channel)
      if (on && index < 0) state.frozen.push(channel)
      if (!on && index >= 0) state.frozen.splice(index, 1)
    },
    /**
     * The user's explicit reset: Memory, the trace, cards and scheduled checks are deleted.
     * Ending an interaction never does this. Counters keep rising, so views never
     * mistake new steps for old ones; the reset itself is the first new entry.
     */
    reset (note: Text) {
      seen.clear()
      state.sensing = { field: {}, evidence: {} }
      state.memory.splice(0)
      state.action = { scheduled: {}, cards: [], held: {} }
      state.trace.splice(0)
      state.counts = {}
      state.tally = {}
      state.frozen = []
      log('glasses', 'M', [], { note })
    }
  }
}
export type ServiceLoop = ReturnType<typeof createServiceLoop>

/** Quiet mode is a user preference: sensed when switched (S → M), later read by Action (M → A). */
export const QUIET_PREFERENCE = 'pref.quiet'
export function noteQuietPreference (loop: ServiceLoop, quiet: boolean) {
  const current = loop.recall(QUIET_PREFERENCE)
  if (current ? current.data?.on === quiet : !quiet) return
  // Held cards become due again; each rule decides afresh whether it still applies.
  if (!quiet) for (const id of Object.keys(loop.state.action.held)) loop.release(id)
  loop.remember('glasses', {
    id: QUIET_PREFERENCE, kind: 'preference', label: text('Quiet mode', '安静模式'),
    value: quiet ? text('On · hold optional reminders', '开 · 暂缓可选提醒') : text('Off · reminders allowed', '关 · 允许提醒'),
    data: { on: quiet }
  }, {
    from: 'sensing',
    note: quiet ? text('You switched quiet mode on. It is kept as a preference for later decisions.', '你打开了安静模式。它作为偏好被记住，供之后的决定使用。')
      : text('You switched quiet mode off. The stored preference is updated.', '你关闭了安静模式，记忆中的偏好随之更新。')
  })
}

/**
 * Action says something to the user with a card. In quiet mode the card is held instead:
 * still owed, with the silence logged once. Returns whether the card was shown.
 */
export function speak (loop: ServiceLoop, task: string, decision: { kind: DecisionKind, label: Text }, how: { uses?: Many<'sensing' | 'memory'>, reads?: readonly string[], note: Text, card: CardInput }): boolean {
  if (loop.recall(QUIET_PREFERENCE)?.data?.on !== true) {
    loop.release(how.card.id)
    loop.act(task, decision, how)
    return true
  }
  if (loop.state.action.held[how.card.id]) return false
  const uses = [...new Set([...list(how.uses), 'memory' as const])]
  loop.act(task, { kind: 'wait', label: text(`Hold: ${how.card.title.en}`, `暂缓：${how.card.title.zh}`) }, {
    uses, reads: [...(how.reads ?? []), QUIET_PREFERENCE],
    note: text(`It is time to say this, but your quiet preference (M) says not now. The card is held and still owed. ${how.note.en}`, `到了该说的时候，但记忆里的安静偏好说“现在别打扰”，卡片先不弹，这件事仍然欠着。${how.note.zh}`)
  })
  loop.hold(how.card.id, task, how.card.title)
  return false
}

/** Memory, the trace, cards and scheduled checks persist. Sensing is current context and is never saved. */
export function serializeLoop (state: LoopState): string {
  return JSON.stringify({
    version: 1, seq: state.seq, step: state.step, memory: state.memory, scheduled: state.action.scheduled, cards: state.action.cards,
    held: state.action.held, trace: state.trace, counts: state.counts, tally: state.tally, frozen: state.frozen
  })
}

const finite = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)
const shortId = (value: unknown) => (typeof value === 'string' && value.length > 0 && value.length <= 80 ? value : undefined)
const isChannel = (value: unknown): value is Channel => (CHANNELS as readonly unknown[]).includes(value)
const isModule = (value: unknown): value is Module => value === 'S' || value === 'M' || value === 'A'
function cleanText (value: unknown): Text | undefined {
  const candidate = value as Partial<Text> | null | undefined
  if (typeof candidate?.en !== 'string' || typeof candidate.zh !== 'string') return
  return { en: candidate.en.slice(0, 240), zh: candidate.zh.slice(0, 240) }
}
function cleanData (value: unknown): Data | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const data: Data = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(0, 16)) {
    if (typeof entry === 'string') data[key.slice(0, 40)] = entry.slice(0, 120)
    else if (typeof entry === 'boolean' || (typeof entry === 'number' && Number.isFinite(entry))) data[key.slice(0, 40)] = entry
  }
  return data
}
const cleanIds = (value: unknown) => (Array.isArray(value) ? value.map(shortId).filter((id): id is string => id !== undefined).slice(0, 8) : [])
function restoreRecord (value: any): MemoryRecord | undefined {
  const id = shortId(value?.id); const task = shortId(value?.task)
  const label = cleanText(value?.label); const shown = cleanText(value?.value)
  if (!id || !task || !label || !shown || !MEMORY_KINDS.includes(value.kind) || !['active', 'stale', 'done'].includes(value.status)) return
  if (!isChannel(value.source) && value.source !== 'M') return
  const data = cleanData(value.data)
  const used = Math.floor(finite(value.used))
  // A past check never describes the present after a reload.
  const status = value.kind === 'evidence' && value.status === 'active' ? 'stale' : value.status
  return { id, task, kind: value.kind, label, value: shown, status, source: value.source, at: finite(value.at), ...(data ? { data } : {}), ...(used > 0 ? { used } : {}) }
}
function restoreEntry (value: any): TraceEntry | undefined {
  const task = shortId(value?.task); const note = cleanText(value?.note)
  if (!task || !note || !isModule(value.module) || !Array.isArray(value.channels)) return
  const channels = value.channels.filter((channel: unknown) => isChannel(channel) && channel.endsWith(value.module))
  if (channels.length !== value.channels.length) return
  const ref = shortId(value.ref)
  const kind = DECISION_KINDS.includes(value.kind) ? value.kind as DecisionKind : undefined
  const reads = cleanIds(value.reads)
  const refused = Array.isArray(value.refused) ? value.refused.filter((channel: unknown) => isChannel(channel) && channel.endsWith(value.module)) : []
  return {
    seq: finite(value.seq), step: finite(value.step), at: finite(value.at), task, module: value.module, channels, note,
    ...(ref ? { ref } : {}), ...(kind ? { kind } : {}), ...(reads.length ? { reads } : {}), ...(value.shadow === true ? { shadow: true } : {}),
    ...(refused.length ? { refused } : {}), ...(value.frozen === true ? { frozen: true } : {})
  }
}
function restoreCard (value: any): Card | undefined {
  const id = shortId(value?.id); const task = shortId(value?.task); const title = cleanText(value?.title)
  if (!id || !task || !title || !CARD_KINDS.includes(value.kind) || !Array.isArray(value.actions)) return
  const actions = value.actions.slice(0, 4).flatMap((action: any) => {
    const actionId = shortId(action?.id); const label = cleanText(action?.label)
    return actionId && label ? [{ id: actionId, label, ...(action.primary === true ? { primary: true } : {}) }] : []
  })
  if (!actions.length) return
  const why = cleanText(value.why); const basis = shortId(value.basis)
  const lines = Array.isArray(value.lines) ? value.lines.slice(0, 12).map(cleanText).filter(Boolean) : []
  return {
    id, task, kind: value.kind, title, actions, at: finite(value.at),
    ...(why ? { why } : {}), ...(basis ? { basis } : {}), ...(lines.length ? { lines } : {}), ...(value.private === true ? { private: true } : {})
  }
}

/** Malformed or partial saves restore as much valid Memory as they can; they never crash the scene. */
export function restoreLoop (raw: string | null): LoopState {
  const state = newLoopState()
  try {
    const data = JSON.parse(raw ?? 'null')
    if (!data || data.version !== 1) return state
    const records = new Map<string, MemoryRecord>()
    for (const value of Array.isArray(data.memory) ? data.memory : []) {
      const record = restoreRecord(value)
      if (record) records.set(record.id, record)
    }
    state.memory = [...records.values()].slice(-MEMORY_LIMIT)
    state.trace = (Array.isArray(data.trace) ? data.trace : []).map(restoreEntry).filter(Boolean).slice(-TRACE_LIMIT)
    state.action.cards = (Array.isArray(data.cards) ? data.cards : []).map(restoreCard).filter(Boolean).slice(-CARD_LIMIT)
    state.frozen = (Array.isArray(data.frozen) ? data.frozen : []).filter(isChannel)
    for (const channel of CHANNELS) {
      const count = finite(data.counts?.[channel])
      if (count > 0) state.counts[channel] = Math.floor(count)
    }
    for (const key of [...DECISION_KINDS, 'shadow', 'refused'] as const) {
      const count = finite(data.tally?.[key])
      if (count > 0) state.tally[key] = Math.floor(count)
    }
    for (const [id, value] of Object.entries<any>(data.held && typeof data.held === 'object' ? data.held : {}).slice(0, CARD_LIMIT * 2)) {
      const task = shortId(value?.task); const title = cleanText(value?.title)
      if (shortId(id) && task && title) state.action.held[id] = { task, title, at: finite(value.at) }
    }
    for (const [id, value] of Object.entries<any>(data.scheduled && typeof data.scheduled === 'object' ? data.scheduled : {})) {
      const task = shortId(value?.task); const label = cleanText(value?.label); const dueMs = finite(value?.dueMs)
      if (!shortId(id) || !task || !label || dueMs <= 0) continue
      state.action.scheduled[id] = { task, label, dueMs, elapsedMs: Math.max(0, Math.min(dueMs, finite(value.elapsedMs))), ...(value.unit === 'game' ? { unit: 'game' as const } : {}) }
    }
    const last = state.trace.at(-1)
    state.seq = Math.max(finite(data.seq), last?.seq ?? 0)
    state.step = Math.max(finite(data.step), last?.step ?? 0)
  } catch { return newLoopState() }
  return state
}
