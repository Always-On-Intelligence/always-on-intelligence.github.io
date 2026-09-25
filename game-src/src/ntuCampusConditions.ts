/**
 * Two shared conditions that bind what Action may do, each shown by one task:
 * - task 9, authority: the glasses may draft a message, but sending needs a grant that
 *   covers today. A grant kept in Memory from yesterday does not (M → A, checked at commitment);
 * - task 8, audience: a reminder about your own health still comes when others are around,
 *   but only as “private reminder”, with the content held back until you are alone or open it (S → A).
 */
import { speak, text, type CardAction, type LoopReader, type ServiceLoop, type Text } from './alwaysOnLoop'
import { at, minutes, timeOf } from './ntuCampusClock'
import { GROUP } from './ntuCampusErrands'
import { CAST, CAST_IDS, PHARMACY_HOURS, PLACES, TIMES, distance, minutesBetween, nowOf, present, type AgendaItem, type CampusStory, type CampusView, type CastId, type PlaceId, type StoryReader } from './ntuCampusWorld'

export const GRANT = 'grant.send'
export const MEDS = 'meds'
/** A quarter of an hour before a meeting, being this far from it counts as running late. */
export const LATE_M = 120
const LEAD_MS = minutes(15)
/** Anyone this close could see or hear what the glasses say. */
export const AUDIENCE_M = 6
export type ConditionInteraction = 'meds.collect'

const ok = (label = text('Got it', '知道了')): CardAction => ({ id: 'ok', label, primary: true })
const go = (place: PlaceId): CardAction => ({ id: `go:${place}`, label: text(`Go to ${PLACES[place].name.en}`, `前往${PLACES[place].name.zh}`), primary: true })
const DRAFT = text('“Running about 10 minutes late.”', '“晚 10 分钟到。”')

// ——— Morning plans ———

export const PLAN_DAY1_GRANT = text('Messages today: you may send them for me', '今天的消息可以直接替我发')
export function answerGrant (loop: ServiceLoop, story: CampusStory) {
  loop.remember(GRANT, {
    id: GRANT, kind: 'preference', label: text('Sending messages for you', '代发消息的授权'), data: { day: story.clock.day },
    value: text('Monday only: may send messages for you', '只限第一天：可以直接替你发消息')
  }, {
    from: 'sensing', note: text('You said the glasses may send today’s messages. Memory keeps the grant together with its scope: today only.', '你说今天的消息可以直接替你发。记忆连同范围一起记下：只限今天。')
  })
}
export const PLAN_DAY2_MEDS = text('Added today: collect medicine at University Health Service before 17:00', '今天新加：17:00 前去校医院取药')
const CLOSES = at(2, PHARMACY_HOURS[1])
export function answerMeds (loop: ServiceLoop) {
  if (loop.recall(MEDS)) return
  loop.remember(MEDS, { id: MEDS, kind: 'commitment', label: text('Collect medicine', '取药'), value: text('Before 17:00 · University Health Service', '17:00 前 · 校医院'), data: { private: true } }, {
    from: 'sensing', note: text('You add a private errand. Memory keeps it, marked as your own health information.', '你加了一件私事。记忆记下它，并标明这是你自己的健康信息。')
  })
}

// ——— Task 9: a draft is allowed, sending needs current authority ———

type Late = { key: 'late.1' | 'late.2', start: number, place: PlaceId, what: Text, who: Text }
function lateEvent (read: LoopReader, story: CampusStory): Late | undefined {
  if (story.clock.day === 1) return { key: 'late.1', start: TIMES.meetingStart, place: 'lt', what: text('the group meeting', '组会'), who: text('the meeting group', '组会群') }
  if (read.recall(GROUP)?.status !== 'active') return
  return { key: 'late.2', start: TIMES.groupStart, place: read.recall(GROUP)?.data?.place === 'hive' ? 'hive' : 'hall2', what: text('the study group', '学习小组'), who: text('the G-07 chat', 'G-07 群') }
}
/** Whether the grant in Memory covers today. A remembered grant does not create current authority. */
export const grantCovers = (read: LoopReader, story: CampusStory) => read.recall(GRANT)?.data?.day === story.clock.day
function lateRules (loop: ServiceLoop, story: CampusStory, view: CampusView) {
  const event = lateEvent(loop, story)
  const now = loop.now()
  if (!event || story.marks[event.key] || now < event.start - LEAD_MS || now >= event.start) return
  const far = distance(view.at, PLACES[event.place].at)
  if (!Number.isFinite(far) || far <= LATE_M) return
  story.marks[event.key] = now
  const grant = loop.recall(GRANT)
  const why = text(`You are ${Math.round(far)} m from ${event.what.en}, which starts at ${timeOf(event.start)}.`, `你离${event.what.zh}还有 ${Math.round(far)} 米，${timeOf(event.start)} 开始。`)
  if (grantCovers(loop, story)) {
    loop.act(event.key, { kind: 'execute', label: text('Send “10 minutes late”', '发送“晚 10 分钟到”') }, {
      uses: ['sensing', 'memory'], reads: [GRANT],
      note: text('You are far away (S), and this morning’s grant in Memory covers today (M), so the glasses send it for you.', '你离得还远（S），记忆里今早的授权覆盖今天（M），眼镜直接替你发了。')
    })
    loop.remember(event.key, { id: event.key, kind: 'receipt', label: text('Message sent for you', '替你发的消息'), value: text(`To ${event.who.en}: ${DRAFT.en} · ${timeOf(now)} · under this morning’s grant`, `发给${event.who.zh}：${DRAFT.zh} · ${timeOf(now)} · 按今早的授权`), data: { sent: now, grant: true } }, {
      from: 'action', note: text('The sent message is written back as a receipt.', '发出的消息作为凭据写回记忆。')
    })
    speak(loop, event.key, { kind: 'notify', label: text('Tell you what was sent', '告诉你发了什么') }, {
      uses: 'memory', reads: [event.key],
      note: text('Something was sent in your name, so the glasses tell you straight away.', '以你的名义发了消息，眼镜马上告诉你。'),
      card: { id: event.key, kind: 'message', basis: GRANT, title: text(`Sent for you: ${DRAFT.en}`, `已替你发：${DRAFT.zh}`), why, lines: [text('This morning you said today’s messages could be sent for you.', '你今早说过“今天的消息可以直接替我发”。')], actions: [ok()] }
    })
    return
  }
  speak(loop, event.key, { kind: 'ask', label: text('Draft, then ask before sending', '拟好草稿，发之前先问你') }, {
    uses: ['sensing', 'memory'], reads: grant ? [GRANT, GROUP] : [GROUP],
    note: grant ? text('You are running late (S). Drafting is allowed, but at the point of sending the grant in Memory only covers yesterday (M), so the glasses ask.', '你快迟到了（S）。拟稿可以，但到了真正发出这一步，记忆里的授权只覆盖昨天（M），所以先问你。')
      : text('You are running late (S). Drafting is allowed; without a grant to send (M), the glasses ask.', '你快迟到了（S）。拟稿可以；没有代发的授权（M），发不发要问你。'),
    card: {
      id: event.key, kind: 'confirm', ...(grant ? { basis: GRANT } : {}), title: text(`I drafted ${DRAFT.en}`, `我拟好了${DRAFT.zh}`), why,
      lines: [grant ? text('Yesterday’s “you may send for me” covered yesterday only. Send it or not: your call.', '你昨天说的“可以替我发”只限昨天。发不发由你决定。') : text('You have not let me send messages for you. Send it or not: your call.', '你没有授权我替你发消息。发不发由你决定。')],
      actions: [{ id: 'send', label: text('Send', '发送'), primary: true }, { id: 'no', label: text('Don’t send', '不发') }]
    }
  })
}
function answerLate (loop: ServiceLoop, key: 'late.1' | 'late.2', answer: string) {
  const now = loop.now()
  if (answer === 'send') {
    loop.act(key, { kind: 'execute', label: text('Send “10 minutes late”', '发送“晚 10 分钟到”') }, {
      uses: 'sensing', note: text('You confirmed (S). That answer is the authority for this one message, so it is sent.', '你确认了（S）。这次确认就是这一条消息的授权，于是发出。')
    })
    loop.remember(key, { id: key, kind: 'receipt', label: text('Message sent for you', '替你发的消息'), value: text(`${DRAFT.en} · ${timeOf(now)} · after you confirmed`, `${DRAFT.zh} · ${timeOf(now)} · 你确认后发出`), data: { sent: now, confirmed: true } }, {
      from: 'action', note: text('The sent message is written back as a receipt.', '发出的消息作为凭据写回记忆。')
    })
    return
  }
  loop.remember(key, { id: key, kind: 'receipt', label: text('Drafted message', '拟好的消息'), value: text(`${DRAFT.en} · not sent: you said no`, `${DRAFT.zh} · 没发：你说不发`), status: 'done', data: { declined: now } }, {
    from: 'sensing', note: text('You said no. Memory keeps the unsent draft and your answer; nothing was sent.', '你说不发。记忆留下没发出的草稿和你的回答，什么也没发。')
  })
}

// ——— Task 8: the audience changes what may be said ———

/** People close enough to see or hear the glasses’ reminder. The player is not one of them. */
export function audience (story: CampusStory, view: CampusView): CastId[] {
  return CAST_IDS.filter(id => CAST[id].kind === 'person' && present(story, id) && distance(view.at, CAST[id].at) <= AUDIENCE_M)
}
function medsCard (loop: ServiceLoop, others: readonly CastId[], reason: 'due' | 'alone' | 'opened') {
  const hidden = others.length > 0
  const left = minutesBetween(loop.now(), CLOSES)
  return speak(loop, MEDS, { kind: 'remind', label: hidden ? text('Private reminder, content held back', '私人提醒（内容不显示）') : text('Remind: collect medicine', '提醒：取药') }, {
    uses: ['sensing', 'memory'], reads: [MEDS],
    note: hidden ? text(`Time for a private errand (M). ${others.length} other people are around (S): the card still comes, but only as “private reminder”.`, `到了提醒一件私事的时间（M）。身边有 ${others.length} 个人（S）：卡片照样弹出，但只显示“私人提醒”。`)
      : reason === 'alone' ? text('Nobody is around any more (S), so the private reminder shows its content.', '身边没人了（S），私人提醒显示出内容。')
        : reason === 'opened' ? text('You opened it yourself (S), so the content is shown.', '你自己点开了（S），内容显示出来。')
          : text('The pharmacy closes at 17:00 (M), and nobody else is around (S).', '药房 17:00 关门（M），身边也没有别人（S）。'),
    card: hidden
      ? { id: MEDS, kind: 'reminder', private: true, title: text('Private reminder', '私人提醒'), why: text('Others are around, so the content stays hidden until you are alone or open it.', '身边有人，内容先不显示；你独处时或点开后再显示。'), actions: [{ id: 'open', label: text('Open', '点开看看'), primary: true }, { id: 'later', label: text('Later', '稍后再看') }] }
      : { id: MEDS, kind: 'reminder', basis: MEDS, title: text('Collect your medicine before 17:00', '17:00 前去校医院取药'), why: text(`The pharmacy closes in ${left} minutes.`, `药房还有 ${left} 分钟关门。`), actions: [go('uhs'), { id: 'ok', label: text('Got it', '知道了') }] }
  })
}
function medsRules (loop: ServiceLoop, story: CampusStory, view: CampusView) {
  if (loop.recall(MEDS)?.status !== 'active' || story.clock.day !== 2) return
  const now = loop.now()
  if (now < TIMES.medsReminder || now >= CLOSES) return
  const others = audience(story, view)
  if (!story.marks['meds.remind']) {
    if (!medsCard(loop, others, 'due')) return
    story.marks['meds.remind'] = now
    story.marks[others.length ? 'meds.hidden' : 'meds.full'] = now
    return
  }
  // Once alone, a private reminder that is still owed shows its content.
  const shown = loop.state.action.cards.find(card => card.id === MEDS)
  if (others.length === 0 && !story.marks['meds.full'] && (shown?.private || !shown) && medsCard(loop, others, 'alone')) story.marks['meds.full'] = now
}
function collectMeds (loop: ServiceLoop, story: CampusStory) {
  const now = loop.now()
  story.world.medsCollected = now
  loop.remember(MEDS, { id: MEDS, kind: 'commitment', label: text('Collect medicine', '取药'), value: text(`Collected · ${timeOf(now)}`, `取到了 · ${timeOf(now)}`), status: 'done', data: { private: true } }, {
    from: 'sensing', note: text('The glasses see you collect it at the counter, so the errand is done.', '眼镜看到你在窗口取了药，这件事完成了。')
  })
  loop.dismiss(MEDS)
  loop.release(MEDS)
}

// ——— Hooks the story calls ———

export function tickConditions (loop: ServiceLoop, story: CampusStory, view: CampusView) {
  lateRules(loop, story, view)
  medsRules(loop, story, view)
}
export function conditionInteractions (read: LoopReader, story: CampusStory): Array<{ id: ConditionInteraction, target: CastId, action: Text }> {
  return read.recall(MEDS)?.status === 'active' ? [{ id: 'meds.collect', target: 'pharmacist', action: text('Collect your medicine', '取药') }] : []
}
export function conditionInteract (loop: ServiceLoop, story: CampusStory, id: ConditionInteraction) {
  if (id === 'meds.collect') collectMeds(loop, story)
}
/** Returns undefined for cards these tasks do not own. */
export function answerCondition (loop: ServiceLoop, story: CampusStory, cardId: string, answer: string): boolean | { travel: PlaceId } | undefined {
  if (cardId !== MEDS && cardId !== 'late.1' && cardId !== 'late.2') return
  if (cardId === MEDS && answer === 'open') {
    story.marks['meds.full'] = loop.now()
    return medsCard(loop, [], 'opened')
  }
  if (!loop.dismiss(cardId)) return false
  if (answer.startsWith('go:') && answer.slice(3) in PLACES) return { travel: answer.slice(3) as PlaceId }
  if (cardId !== MEDS && (answer === 'send' || answer === 'no')) answerLate(loop, cardId, answer)
  return true
}
export function conditionEvents (read: StoryReader, story: CampusStory): Array<[number, Text]> {
  const events: Array<[number, Text]> = []
  const late = lateEvent(read, story)
  if (late && !story.marks[late.key]) events.push([late.start - LEAD_MS, story.clock.day === 1 ? text('Meeting in 15 minutes', '组会前 15 分钟') : text('Study group in 15 minutes', '学习小组前 15 分钟')])
  if (story.clock.day === 2 && read.recall(MEDS)?.status === 'active') events.push([TIMES.medsReminder, text('Medicine reminder', '取药提醒')], [CLOSES, text('Pharmacy closes', '药房关门')])
  return events
}
export function conditionAgenda (read: StoryReader, story: CampusStory): AgendaItem[] {
  const meds = read.recall(MEDS)
  if (story.clock.day !== 2 || !meds) return []
  const closed = nowOf(story) >= CLOSES
  return [{
    id: 'meds', title: text('Collect medicine', '取药'), place: 'uhs', state: meds.status === 'done' ? 'done' : closed ? 'missed' : 'todo',
    detail: meds.status === 'done' ? meds.value : text('Before 17:00 · University Health Service', '17:00 前 · 校医院')
  }]
}
export function conditionEnding (read: StoryReader, story: CampusStory): Text[] {
  const lines: Text[] = []
  const first = read.recall('late.1'); const second = read.recall('late.2')
  if (first?.data?.grant && second) lines.push(text('Sending for you: on Monday your grant let me send “10 minutes late” myself; on Tuesday I asked first. Yesterday’s grant does not cover today.', '代发消息：周一按你的授权，我直接发了“晚 10 分钟到”；周二我先问了你。昨天的授权管不到今天。'))
  else if (second) lines.push(text('Sending for you: I drafted the message but asked first; yesterday’s grant does not cover today.', '代发消息：我拟好了，但先问了你。昨天的授权管不到今天。'))
  else if (first?.data?.grant) lines.push(text('Sending for you: on Monday your grant let me send “10 minutes late” myself.', '代发消息：周一按你的授权，我直接发了“晚 10 分钟到”。'))
  const meds = read.recall(MEDS)
  if (meds) {
    const hidden = story.marks['meds.hidden'] !== undefined
    if (meds.status === 'done') lines.push(hidden ? text('Medicine: when the reminder came others were around, so I only said “private reminder”.', '取药：提醒时你身边有人，我只说了“私人提醒”。') : text('Medicine: collected before the pharmacy closed.', '取药：在药房关门前取到了。'))
    else lines.push(text('Missed: the medicine was not collected before 17:00.', '没做到：17:00 前没去取药。'))
  }
  return lines
}
export function conditionSays (story: CampusStory, id: CastId): Text | undefined {
  if (id === 'pharmacist') return story.world.medsCollected ? text('Take care!', '注意身体！') : text('Collections here, please.', '取药请到这边。')
}
