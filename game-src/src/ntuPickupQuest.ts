/**
 * A17 errand, the tutorial. Lin asks and you do the walking. The glasses keep only what
 * you agreed to and what they saw happen (S → M), suggest the next step from it (M → A)
 * and, if a step sits for half an hour, remind you once with a card. Every rule is
 * hard-coded below; updating the saved errand is not a policy revision.
 */
import { speak, text, type LoopReader, type ServiceLoop, type Text } from './alwaysOnLoop'
import { minutes, timeOf } from './ntuCampusClock'

export const PICKUP_PLACE = 'ntumap-place-8baec8760caf'
export const PICKUP_TASK = 'a17'
export const PICKUP_TARGET = 'A17'
/** The label actually on the desk in the world. */
export const PICKUP_DESK_LABEL = 'A17'
/** Campus time a step may sit before the glasses remind. */
export const REMINDER_AFTER_MS = minutes(30)
/** "Later" moves a reminder back by this much campus time. */
export const SNOOZE_MS = minutes(20)
/** Sensing anchors: the cast ids of Lin and the pickup desk. */
export const PICKUP_COLLEAGUE = 'lin'
export const PICKUP_DESK = 'desk'
export const PICKUP_REMINDER = 'a17.reminder'
const REQUEST = 'a17.request'
const PICKUP_RECEIPT = 'a17.pickup'
const DELIVERY_RECEIPT = 'a17.delivery'

export type PickupStage = 'available' | 'pending' | 'carrying' | 'completed'
export type PickupAction = 'accept' | 'collect' | 'deliver'
/** What the glasses can see right now, measured by the host. */
export type PickupView = { colleagueVisible: boolean, deskVisible: boolean }

const STAGE_VALUE: Record<Exclude<PickupStage, 'available'>, Text> = {
  pending: text('Collect A17 at the desk, then bring it to Lin', '去领取桌取 A17，再交给林'),
  carrying: text('A17 is with you · hand it to Lin', 'A17 在你手上 · 交给林'),
  completed: text('Delivered to Lin', '已交给林')
}
const commitment = (stage: Exclude<PickupStage, 'available'>) => ({ id: PICKUP_TASK, kind: 'commitment' as const, label: text('A17 errand for Lin', '帮林取 A17'), value: STAGE_VALUE[stage] })
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

export function pickupStage (read: LoopReader): PickupStage {
  const task = read.recall(PICKUP_TASK)
  if (!task) return 'available'
  // Possession and completion need their receipts; a stage flag alone confers neither.
  const stage = task.data?.stage
  if (stage === 'completed' && read.recall(PICKUP_RECEIPT) && read.recall(DELIVERY_RECEIPT)) return 'completed'
  if ((stage === 'carrying' || stage === 'completed') && read.recall(PICKUP_RECEIPT)) return 'carrying'
  return 'pending'
}

export function pickupNextAction (read: LoopReader): PickupAction | undefined {
  const stage = pickupStage(read)
  if (stage === 'available') return 'accept'
  if (stage === 'pending') return 'collect'
  if (stage === 'carrying') return 'deliver'
}

/** One pass between interactions. Callers stop calling it while service is paused. */
export function tickPickup (loop: ServiceLoop, view: PickupView) {
  const stage = pickupStage(loop)
  if (stage === 'available' && view.colleagueVisible && !loop.evidence(REQUEST)) {
    loop.observe(PICKUP_TASK, { id: REQUEST, anchor: PICKUP_COLLEAGUE, label: text('Lin asks', '林的请求'), value: text('“Could you bring me A17 from the pickup desk?”', '“能帮我把领取桌上的 A17 拿过来吗？”') }, {
      note: text('Sensing hears a request. It is only current evidence: Memory keeps nothing unless you agree.', '感知听到一个请求。它只是眼前的证据：除非你答应，记忆什么也不留。')
    })
  }
  if (stage !== 'pending' && stage !== 'carrying') {
    loop.unschedule(PICKUP_REMINDER)
    return
  }
  const task = loop.recall(PICKUP_TASK)!
  // Once you have answered "Got it" for this step, nothing more is scheduled for it.
  if (task.data?.ackFor === stage) {
    loop.unschedule(PICKUP_REMINDER)
    return
  }
  const now = loop.now()
  const since = num(task.data?.since) || task.at
  loop.track(PICKUP_REMINDER, PICKUP_TASK, { label: text('Reminder check · A17', '提醒检查 · A17'), elapsedMs: now - since, dueMs: REMINDER_AFTER_MS, unit: 'game' })
  if (now - since < REMINDER_AFTER_MS || now < num(task.data?.snoozeUntil) || loop.showing(PICKUP_REMINDER)) return
  const pending = stage === 'pending'
  speak(loop, PICKUP_TASK, { kind: 'remind', label: pending ? text('A17 is still at the desk', 'A17 还在领取桌上') : text('Hand A17 to Lin', '记得把 A17 交给林') }, {
    uses: 'memory', reads: [PICKUP_TASK],
    note: text('No one asked. The open errand in Memory has waited half an hour, so the glasses remind you once.', '没人开口。记忆里的委托已经搁了半小时，眼镜主动提醒你一次。'),
    card: {
      id: PICKUP_REMINDER, kind: 'reminder', basis: PICKUP_TASK,
      title: pending ? text('A17 is still waiting at the pickup desk', 'A17 还在领取桌上等你') : text('Remember to hand A17 to Lin', '记得把 A17 交给林'),
      why: pending ? text(`You told Lin yes at ${timeOf(since)}; half an hour has passed.`, `你 ${timeOf(since)} 答应了林，已经过了半小时。`)
        : text(`You collected A17 at ${timeOf(since)}; half an hour has passed.`, `你 ${timeOf(since)} 领到了 A17，已经过了半小时。`),
      actions: [{ id: 'ok', label: text('Got it', '知道了'), primary: true }, { id: 'later', label: text('Later', '稍后提醒') }]
    }
  })
}

/** Your answer to the reminder card is sensed and kept, so later decisions follow it. */
export function answerPickupReminder (loop: ServiceLoop, answer: string): boolean {
  const task = loop.recall(PICKUP_TASK)
  const stage = pickupStage(loop)
  if (!loop.dismiss(PICKUP_REMINDER) || !task || (stage !== 'pending' && stage !== 'carrying')) return false
  const later = answer === 'later'
  loop.remember(PICKUP_TASK, { ...commitment(stage), data: { ...task.data, ...(later ? { snoozeUntil: loop.now() + SNOOZE_MS } : { ackFor: stage }) } }, {
    from: 'sensing',
    note: later ? text('You tapped “Later”. Memory keeps your answer, so the reminder returns in 20 minutes.', '你点了“稍后提醒”。记忆记下这个回应，20 分钟后再提醒。')
      : text('You tapped “Got it”. Memory keeps your answer, so this step is not reminded again.', '你点了“知道了”。记忆记下这个回应，这一步不再提醒。')
  })
  return true
}

/**
 * Player-initiated steps. Returns false, changing nothing, when a step is not allowed now.
 * Collecting and delivering only start a visible handoff; its outcome is written when it finishes.
 */
export function pickupInteraction (loop: ServiceLoop, action: PickupAction, view: PickupView): boolean {
  const stage = pickupStage(loop)
  if (action === 'accept' && stage === 'available' && view.colleagueVisible) {
    loop.remember(PICKUP_TASK, { ...commitment('pending'), data: { stage: 'pending', target: PICKUP_TARGET, since: loop.now() } }, {
      from: 'sensing', note: text('You said yes. Your answer turns the request into a commitment that Memory keeps.', '你答应了。你的回答让请求变成承诺，由记忆保留下来。')
    })
    loop.act(PICKUP_TASK, { kind: 'prompt', label: text('Next: collect A17 at the desk', '下一步：去领取桌取 A17') }, {
      uses: 'memory', reads: [PICKUP_TASK], note: text('The kept commitment decides what to suggest next.', '记下的承诺决定了下一步的建议。')
    })
    return true
  }
  if (action === 'collect') return stage === 'pending' && view.deskVisible
  if (action === 'deliver') return stage === 'carrying' && view.colleagueVisible
  return false
}

/** Called only once the visible handoff has finished. An interrupted handoff writes nothing. */
export function finishPickupHandoff (loop: ServiceLoop, action: 'collect' | 'deliver') {
  const task = loop.recall(PICKUP_TASK)
  const stage = pickupStage(loop)
  if (!task) return
  const now = loop.now()
  const target = String(task.data?.target ?? PICKUP_TARGET)
  if (action === 'collect' && stage === 'pending') {
    loop.remember(PICKUP_TASK, { id: PICKUP_RECEIPT, kind: 'receipt', label: text('Pickup receipt', '领取凭据'), value: text(`A17 collected · ${timeOf(now)}`, `领到 A17 · ${timeOf(now)}`) }, {
      from: 'sensing', note: text('The glasses saw the steward hand you A17. What they saw is kept as the receipt.', '眼镜看到管理员把 A17 交给了你。看到的结果被记作凭据。')
    })
    loop.remember(PICKUP_TASK, { ...commitment('carrying'), data: { stage: 'carrying', target, since: now } }, {
      from: 'sensing', note: text('The commitment moves on: A17 is now with you.', '承诺推进：A17 现在在你手上。')
    })
    loop.dismiss(PICKUP_REMINDER)
  } else if (action === 'deliver' && stage === 'carrying') {
    loop.remember(PICKUP_TASK, { id: DELIVERY_RECEIPT, kind: 'receipt', label: text('Delivery receipt', '交付凭据'), value: text(`Lin has A17 · ${timeOf(now)}`, `林收到 A17 · ${timeOf(now)}`) }, {
      from: 'sensing', note: text('The glasses saw Lin take A17. That sighting is the outcome that closes the errand.', '眼镜看到林接过了 A17。这一眼就是让委托闭环的结果。')
    })
    loop.remember(PICKUP_TASK, { ...commitment('completed'), status: 'done', data: { stage: 'completed', target, since: now } }, {
      from: 'sensing', note: text('The commitment is closed, but kept as history.', '承诺关闭，但作为历史继续保留。')
    })
    loop.dismiss(PICKUP_REMINDER)
    loop.unschedule(PICKUP_REMINDER)
  }
}
