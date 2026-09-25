import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { INTERNAL_Snapshot as Snapshot } from 'valtio'
import { CHANNELS, type Channel, type Lang, type LoopState, type MemoryStatus, type Module, type TraceEntry } from './alwaysOnLoop'
import './alwaysOnLoopPanel.css'

type Props = {
  state: Snapshot<LoopState>, language: Lang, paused: boolean, actionTools?: ReactNode
  /** How to show a timestamp. Defaults to "n min ago" in real time; the campus passes its own clock. */
  formatTime?: (at: number) => string
  /** Research controls shown under "How it works", such as freezing one channel. */
  research?: ReactNode
  /** Status shown in the Sensing header, such as the battery. */
  sensingTools?: ReactNode
  /** Steps up to this one are history, such as a demo chapter's replayed prelude; only later ones open a folded panel. */
  since?: number
  /** Open the whole panel for a look back, such as when a chapter or a day is over. */
  reveal?: boolean
}
type Pair = readonly [string, string]
const ORDER: Record<Module, number> = { S: 0, M: 1, A: 2 }
/** Seconds between the writes of one step when views replay them. */
const STEP_DELAY = 0.45
/** Subtitles leave the screen this long after a step's last write. */
const SUBTITLE_MS = 9000
const COLLAPSE_KEY = 'always-on-loop-panel-collapsed-v2'
/** A folded panel opens on what a step touched for this long, then folds again. */
const PEEK_MS = 6000
const RANK: Record<MemoryStatus, number> = { active: 0, stale: 1, done: 2 }

const CHANNEL_HINT: Record<Channel, Pair> = {
  'S → A': ['Current evidence changes what Action may do.', '眼前的证据影响行动能做什么。'],
  'S → M': ['What was sensed is offered to Memory to keep.', '感知到的内容交给记忆保留。'],
  'M → A': ['Retained state shapes a decision.', '保留下来的状态影响决定。'],
  'A → S': ['An intended action asks for a fresh look.', '准备行动时，要求重新观察。'],
  'M → S': ['Memory tells Sensing what to look for.', '记忆告诉感知要找什么。'],
  'A → M': ['An action and its outcome are written back.', '行动及其结果写回记忆。']
}
const WORDS = {
  en: {
    head: 'GLASSES SYSTEM · LIVE', used: 'channels used',
    modules: { S: ['Sensing', 'What the glasses see now'], M: ['Memory', 'What is kept'], A: ['Action', 'What it decides'] } as Record<Module, Pair>,
    ephemeral: 'not saved', durable: 'survives reload', inView: 'in view', outOfView: 'out of view',
    noField: 'Nothing task-related nearby yet.', noEvidence: 'No current evidence. It fades soon after you look away.', guided: 'guided by',
    noMemory: 'Nothing kept yet. Answer the morning card and watch it land here.', stale: 'stale · recheck', done: 'closed', more: (count: number) => `+${count} older`,
    kinds: { commitment: 'Commitment', fact: 'Fact', evidence: 'Evidence', preference: 'Preference', receipt: 'Receipt' },
    decisions: { prompt: 'Suggest', check: 'Check', permit: 'Permit', block: 'Block', execute: 'Execute', remind: 'Remind', wait: 'Hold back', ask: 'Ask', notify: 'Pass on', review: 'Review' },
    local: 'local rule', noDecision: 'No decision yet.', between: 'runs between interactions',
    readBy: (count: number) => `read by ${count} decision${count === 1 ? '' : 's'}`, held: 'Owed, not shown', shadow: 'not carried out', refused: 'refused', frozen: 'frozen · not written',
    all: 'Show all', fewer: 'Show fewer', minutes: (elapsed: number, due: number) => `${elapsed} / ${due} min`,
    paused: 'Paused. Checks stop while a menu, observer view or hidden page is active.',
    trace: 'Full trace', framework: 'How it works', hide: 'Hide system', show: 'Show system',
    intro: 'Each module has a space (what it can hold or do) and a local policy that chooses among it. Here every policy is a fixed, authored rule. Arrows deliver information between modules; they are not an execution order.',
    spaces: {
      S: 'Space: who and what is in view, current evidence. Policy: when and what to check.',
      M: 'Space: commitments, facts, preferences, receipts. Policy: what to keep, what to refuse, and when it stops counting.',
      A: 'Space: ask, suggest, remind, pass on, review, hold back; timers and owed cards. Policy: when to speak and when not to.'
    } as Record<Module, string>,
    loop: 'The continuing loop', levels: ['L1 · kept across visits', 'L2 · memory shapes a later decision', 'L3 · checks between interactions'],
    boundary: 'Nothing here learns. Updating a saved task changes Memory, not the rules, so no self-evolution (L4–L5) is claimed.',
    ago: (seconds: number) => (seconds < 10 ? 'just now' : seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.floor(seconds / 60)} min ago` : seconds < 86_400 ? `${Math.floor(seconds / 3600)} h ago` : `${Math.floor(seconds / 86_400)} d ago`)
  },
  zh: {
    head: '眼镜系统 · 实时', used: '条通路已使用',
    modules: { S: ['感知', '眼镜此刻看到的'], M: ['记忆', '会被保留的'], A: ['行动', '系统的决定'] } as Record<Module, Pair>,
    ephemeral: '不保存', durable: '刷新后仍在', inView: '在视野内', outOfView: '不在视野',
    noField: '附近还没有与任务相关的对象。', noEvidence: '暂无当前证据。移开视线不久，它就会消失。', guided: '引导',
    noMemory: '还没有保留任何内容。回答早上的卡片后，看它出现在这里。', stale: '已过期 · 需重新确认', done: '已关闭', more: (count: number) => `还有 ${count} 条较早记录`,
    kinds: { commitment: '承诺', fact: '事实', evidence: '证据', preference: '偏好', receipt: '凭据' },
    decisions: { prompt: '建议', check: '核对', permit: '允许', block: '阻止', execute: '执行', remind: '提醒', wait: '按下不说', ask: '询问', notify: '转达', review: '复盘' },
    local: '局部规则', noDecision: '还没有决定。', between: '在交互之间运行',
    readBy: (count: number) => `被 ${count} 个决定读过`, held: '欠着没说', shadow: '未执行', refused: '已拒绝', frozen: '已冻结 · 未写入',
    all: '展开全部', fewer: '收起', minutes: (elapsed: number, due: number) => `${elapsed} / ${due} 分钟`,
    paused: '已暂停。打开菜单、观察视角或页面隐藏时，检查会停止。',
    trace: '完整记录', framework: '系统原理', hide: '收起系统', show: '展开系统',
    intro: '每个模块都有一个空间（能保存或能做什么），以及在其中做选择的局部策略。这里的策略都是事先写好的固定规则。箭头在模块之间传递信息，不代表执行顺序。',
    spaces: {
      S: '空间：视野里的人和物、当前证据。策略：何时查、查什么。',
      M: '空间：承诺、事实、偏好、凭据。策略：保留什么、拒绝什么、何时不再算数。',
      A: '空间：询问、建议、提醒、转达、复盘、按下不说；计时和欠着的卡片。策略：什么时候开口，什么时候不开口。'
    } as Record<Module, string>,
    loop: '持续服务的闭环', levels: ['L1 · 跨访问保留', 'L2 · 记忆影响之后的决定', 'L3 · 交互之间也在检查'],
    boundary: '这里没有任何学习。更新已保存的任务改变的是记忆，不是规则，因此不宣称自演化（L4–L5）。',
    ago: (seconds: number) => (seconds < 10 ? '刚刚' : seconds < 60 ? `${seconds} 秒前` : seconds < 3600 ? `${Math.floor(seconds / 60)} 分钟前` : seconds < 86_400 ? `${Math.floor(seconds / 3600)} 小时前` : `${Math.floor(seconds / 86_400)} 天前`)
  }
}

const compact = (channel: Channel) => channel.replaceAll(' ', '')
const ends = (channel: Channel) => channel.split(' → ') as [Module, Module]
/** Folded unless the visitor opened it: each step shows briefly as it happens, the whole panel at the end. */
function initialCollapsed () {
  try {
    const saved = localStorage.getItem(COLLAPSE_KEY)
    if (saved === 'true' || saved === 'false') return saved === 'true'
  } catch {}
  return true
}

/** Channels a trace entry used, or would have used: shadow and frozen entries are drawn hollow, refusals struck through. */
function Route ({ entry, language }: { entry: Snapshot<TraceEntry>, language: Lang }) {
  const w = WORDS[language]
  const mark = entry.shadow ? w.shadow : entry.frozen ? w.frozen : undefined
  return <span className='ao-loop-route' data-shadow={entry.shadow} data-frozen={entry.frozen}>
    {!entry.channels.length && !entry.refused?.length && <i data-from={entry.module} data-to={entry.module}>{entry.module}</i>}
    {entry.channels.map(channel => {
      const [from, to] = ends(channel)
      return <i key={channel} data-from={from} data-to={to}>{compact(channel)}</i>
    })}
    {entry.refused?.map(channel => {
      const [from, to] = ends(channel)
      return <i key={channel} data-from={from} data-to={to} data-refused=''>⊘ {compact(channel)}</i>
    })}
    {mark && <em>{mark}</em>}
  </span>
}

/**
 * Game-style subtitles: the latest step, replayed in order, then gone. Restored history never
 * plays, and neither does anything up to `since`, such as a demo chapter's replayed prelude.
 */
export function AlwaysOnLoopSubtitles ({ state, language, since = 0 }: { state: Snapshot<LoopState>, language: Lang, since?: number }) {
  const firstStep = useRef(state.step)
  const latest = state.trace.at(-1)
  const [expired, setExpired] = useState(0)
  const live = !!latest && latest.step > Math.max(firstStep.current, since) && expired !== latest.seq
  useEffect(() => {
    if (!live) return
    const { seq } = latest
    const timer = setTimeout(() => setExpired(seq), SUBTITLE_MS)
    return () => clearTimeout(timer)
  }, [live, latest?.seq])
  if (!live) return null
  const batch = state.trace.filter(entry => entry.step === latest.step).slice(-3)
  return <ol className='ao-loop-subtitles' key={latest.step} aria-live='polite'>{batch.map((entry, index) => <li key={entry.seq} data-module={entry.module} style={{ '--i': index } as CSSProperties}>
    <Route entry={entry} language={language} /><span>{entry.note[language]}</span>
  </li>)}</ol>
}

/** Live view of the three modules. It reads the loop; it never writes to it. */
export default function AlwaysOnLoopPanel ({ state, language, paused, actionTools, formatTime, research, sensingTools, since = 0, reveal = false }: Props) {
  const w = WORDS[language]
  const zh = language === 'zh'
  const [drawer, setDrawer] = useState<'' | 'trace' | 'framework'>('')
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  /** A look back opens the panel until it is over; then the visitor's own choice applies again. */
  const [override, setOverride] = useState<boolean>()
  const [peekStep, setPeekStep] = useState<number>()
  const [allMemory, setAllMemory] = useState(false)
  const [, setClock] = useState(0)
  // Only steps that happen while the panel is open are replayed; restored history is shown still.
  const firstStep = useRef(state.step)
  useEffect(() => {
    const timer = setInterval(() => setClock(value => value + 1), 5000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => { setOverride(reveal ? false : undefined) }, [reveal])
  const folded = override ?? collapsed
  const toggleCollapsed = () => {
    setOverride(undefined)
    setCollapsed(!folded)
    try { localStorage.setItem(COLLAPSE_KEY, String(!folded)) } catch {}
  }
  const now = Date.now()
  const ago = formatTime ?? ((at: number) => w.ago(Math.max(0, Math.round((now - at) / 1000))))

  const latest = state.trace.at(-1)
  const batch = latest ? state.trace.filter(entry => entry.step === latest.step).slice(-5) : []
  const live = !!latest && latest.step > firstStep.current
  // Each new step opens a folded panel on what it touched, then lets it fold again.
  const fresh = live && latest.step > since ? latest.step : undefined
  useEffect(() => {
    if (fresh === undefined) return
    setPeekStep(fresh)
    const timer = setTimeout(() => setPeekStep(undefined), PEEK_MS)
    return () => clearTimeout(timer)
  }, [fresh])
  const peeking = folded && peekStep !== undefined && peekStep === latest?.step
  const order = new Map<string, number>()
  if (live) {
    for (const [index, entry] of batch.entries()) {
      for (const key of [...entry.channels, entry.module, ...(entry.ref ? [`ref:${entry.ref}`] : [])]) if (!order.has(key)) order.set(key, index)
    }
  }
  // Restart the CSS animation for every new step by re-keying what fired.
  const fire = (key: string) => (order.has(key) ? { 'data-fire': '', style: { '--delay': `${order.get(key)! * STEP_DELAY}s` } as CSSProperties } : {})
  const fireKey = (key: string) => (order.has(key) ? `${key}@${latest!.step}` : key)
  const count = (channel: Channel) => state.counts[channel] ?? 0
  const used = CHANNELS.filter(channel => count(channel) > 0).length

  const refusals = (channel: Channel) => state.trace.filter(entry => entry.refused?.includes(channel)).length
  const chip = (channel: Channel) => {
    const [from, to] = ends(channel)
    const frozen = state.frozen.includes(channel)
    const refused = refusals(channel)
    return <span
      key={fireKey(channel)} className='ao-loop-chip' data-from={from} data-to={to} data-used={count(channel) > 0} data-frozen={frozen} title={`${CHANNEL_HINT[channel][zh ? 1 : 0]}${frozen ? ` · ${w.frozen}` : ''}`}
      {...fire(channel)}>
      <i aria-hidden='true'>{ORDER[to] > ORDER[from] ? '↓' : '↑'}</i>{compact(channel)}<small>{count(channel)}</small>{refused > 0 && <b title={w.refused}>⊘{refused}</b>}
    </span>
  }
  const moduleHead = (module: Module, life?: ReactNode) => <header>
    <b>{module}</b><strong>{w.modules[module][0]}</strong><small>{w.modules[module][1]}</small>{life}
  </header>

  const field = Object.entries(state.sensing.field).sort(([, a], [, b]) => Number(b.inView) - Number(a.inView))
  const evidence = Object.values(state.sensing.evidence)
  const records = [...state.memory].sort((a, b) => RANK[a.status] - RANK[b.status] || b.at - a.at)
  const shown = allMemory ? records : records.slice(0, 6)
  const held = Object.entries(state.action.held)
  const decision = state.action.latest
  const scheduled = Object.entries(state.action.scheduled)
  const reached = [
    state.memory.some(record => record.kind === 'commitment'),
    count('M → A') + count('M → S') > 0,
    scheduled.some(([, entry]) => entry.elapsedMs > 0) || state.trace.some(entry => entry.kind === 'remind' || entry.kind === 'wait')
  ]

  return <section className='ao-loop' data-collapsed={folded && !peeking} data-peek={peeking} aria-label={w.head}>
    <div className='ao-loop-head'>
      <span>{w.head}</span>
      <b title={w.used}>{used}/6</b>
      <button onClick={toggleCollapsed} aria-expanded={!folded}>{folded ? w.show : w.hide}</button>
    </div>

    {(!folded || peeking) && <div className='ao-loop-diagram' data-paused={paused} key={peeking ? `peek-${peekStep}` : 'open'}>
      <div className='ao-loop-stack'>
        <article className='ao-loop-module' data-module='S' key={fireKey('S')} {...fire('S')}>
          {moduleHead('S', <>{sensingTools}<em>{w.ephemeral}</em></>)}
          {paused && <p className='ao-loop-paused'>{w.paused}</p>}
          {field.length ? <ul className='ao-loop-field'>{field.map(([id, entry]) => <li key={id} data-in={entry.inView}>
            <i aria-hidden='true' />{entry.label[language]}<small>{entry.distance >= 0 ? `${entry.distance} m · ` : ''}{entry.inView ? w.inView : w.outOfView}</small>
          </li>)}</ul> : <p className='ao-loop-empty'>{w.noField}</p>}
          {evidence.length ? <ul className='ao-loop-evidence'>{evidence.map(observation => <li key={fireKey(`ref:${observation.id}`)} {...fire(`ref:${observation.id}`)}>
            <span>{observation.label[language]}</span><strong>{observation.value[language]}</strong>
            {observation.guidedBy.length > 0 && <small>{w.guided} {observation.guidedBy.map(module => compact(`${module} → S` as Channel)).join(' · ')}</small>}
          </li>)}</ul> : <p className='ao-loop-empty'>{w.noEvidence}</p>}
        </article>

        <div className='ao-loop-gap'>{chip('S → M')}{chip('M → S')}</div>

        <article className='ao-loop-module' data-module='M' key={fireKey('M')} {...fire('M')}>
          {moduleHead('M', <em>{w.durable}</em>)}
          {shown.length ? <ul className='ao-loop-memory'>{shown.map(record => <li key={fireKey(`ref:${record.id}`)} data-status={record.status} {...fire(`ref:${record.id}`)}>
            <span className='ao-loop-kind' data-kind={record.kind}>{w.kinds[record.kind]}</span>
            <div><strong>{record.label[language]}</strong><p>{record.value[language]}</p></div>
            <small>{record.source === 'M' ? w.local : compact(record.source)} · {record.status === 'stale' ? w.stale : record.status === 'done' ? w.done : ago(record.at)}{record.used ? ` · ${w.readBy(record.used)}` : ''}</small>
          </li>)}</ul> : <p className='ao-loop-empty'>{w.noMemory}</p>}
          {records.length > 6 && <button className='ao-loop-more' onClick={() => setAllMemory(!allMemory)}>{allMemory ? w.fewer : w.more(records.length - shown.length)}</button>}
        </article>

        <div className='ao-loop-gap'>{chip('M → A')}{chip('A → M')}</div>

        <article className='ao-loop-module' data-module='A' key={fireKey('A')} {...fire('A')}>
          {moduleHead('A', actionTools)}
          {decision ? <div className='ao-loop-decision' data-kind={decision.kind}>
            <span className='ao-loop-kind'>{w.decisions[decision.kind]}</span>
            <strong>{decision.label[language]}</strong>
            <small>{decision.uses.length ? decision.uses.map(module => compact(`${module} → A` as Channel)).join(' · ') : w.local} · {ago(decision.at)}</small>
          </div> : <p className='ao-loop-empty'>{w.noDecision}</p>}
          {scheduled.map(([id, entry]) => <div key={id} className='ao-loop-timer'>
            <span><i aria-hidden='true'>◷</i>{entry.label[language]}</span>
            <span className='ao-loop-bar' role='progressbar' aria-valuemin={0} aria-valuemax={entry.dueMs} aria-valuenow={entry.elapsedMs}><i style={{ width: `${Math.min(100, entry.elapsedMs / entry.dueMs * 100)}%` }} /></span>
            <small>{entry.unit === 'game' ? w.minutes(Math.floor(entry.elapsedMs / 60_000), Math.round(entry.dueMs / 60_000)) : `${Math.floor(entry.elapsedMs / 1000)} / ${Math.round(entry.dueMs / 1000)} s`} · {w.between}</small>
          </div>)}
          {held.length > 0 && <ul className='ao-loop-held' aria-label={w.held}>{held.map(([id, entry]) => <li key={id}><i aria-hidden='true'>◌</i>{entry.title[language]}<small>{w.held}</small></li>)}</ul>}
        </article>
      </div>
      {/* S ↔ A bypasses Memory, so it runs as a bracket beside the stack. */}
      <div className='ao-loop-rail'>{chip('S → A')}{chip('A → S')}</div>
    </div>}

    <div className='ao-loop-tools'>
      {(['trace', 'framework'] as const).map(name => <button key={name} aria-expanded={drawer === name} onClick={() => setDrawer(drawer === name ? '' : name)}>{w[name]} {drawer === name ? '−' : '+'}</button>)}
    </div>
    {drawer === 'trace' && <ol className='ao-loop-trace'>{[...state.trace].reverse().map(entry => <li key={entry.seq} data-module={entry.module} data-shadow={entry.shadow}>
      <Route entry={entry} language={language} /><p>{entry.note[language]}</p><time>{ago(entry.at)}</time>
    </li>)}</ol>}
    {drawer === 'framework' && <div className='ao-loop-framework'>
      <p>{w.intro}</p>
      {(['S', 'M', 'A'] as const).map(module => <div key={module} data-module={module}><b>{module} · {w.modules[module][0]}</b><span>{w.spaces[module]}</span></div>)}
      <ul>{CHANNELS.map(channel => <li key={channel} data-used={count(channel) > 0}><b>{count(channel) > 0 ? '✓' : '○'} {channel}</b><span>{CHANNEL_HINT[channel][zh ? 1 : 0]}</span></li>)}</ul>
      <h4>{w.loop}</h4>
      <div className='ao-loop-levels'>{w.levels.map((level, index) => <span key={level} data-reached={reached[index]}>{level}</span>)}</div>
      <p>{w.boundary}</p>
      {research}
    </div>}
  </section>
}
