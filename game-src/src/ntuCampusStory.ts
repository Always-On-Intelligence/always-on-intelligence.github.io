/**
 * Two campus days on the shared always-on loop. The clock, the cast and every rule are
 * authored here: what the glasses observe, keep and decide follows only from where you
 * are, what time it is and how you answered. Nothing learns or revises a rule.
 *
 * Three kinds of state stay apart:
 * - the world: what is true on campus, whether or not the glasses know it;
 * - the loop: what the glasses sensed, kept and decided (alwaysOnLoop);
 * - scene marks: which timed scenes already played, so a reload never replays them.
 */
import { speak, text, type CardAction, type CardInput, type LoopReader, type MemoryKind, type MemoryRecord, type ServiceLoop, type Text } from './alwaysOnLoop'
import { at, dayOver, formatGameMs, minutes, startNextDay, timeOf } from './ntuCampusClock'
import { GRANT, MEDS, PLAN_DAY1_GRANT, PLAN_DAY2_MEDS, answerCondition, answerGrant, answerMeds, conditionAgenda, conditionEnding, conditionEvents, conditionInteract, conditionInteractions, conditionSays, tickConditions, type ConditionInteraction } from './ntuCampusConditions'
import { GROUP, PLAN_DAY1_LINES, POSTER, answerErrand, answerPlanDay1, answerPlanDay2, chargeOvernight, chenRecognised, errandAgenda, errandDisplays, errandEnding, errandEvents, errandInteract, errandInteractions, errandReview, errandSays, planDay2Lines, sendPoster, tickErrands, type ErrandInteraction } from './ntuCampusErrands'
import { CAST, CAST_IDS, PLACES, PLACE_IDS, TIMES, distance, minutesBetween, nowOf, num, present, type AgendaItem, type CampusStory, type CampusView, type CastId, type PlaceId, type StoryReader } from './ntuCampusWorld'
import { PICKUP_COLLEAGUE, PICKUP_DESK, PICKUP_REMINDER, PICKUP_TASK, answerPickupReminder, pickupInteraction, pickupStage, tickPickup } from './ntuPickupQuest'

export { CAST, CAST_IDS, PLACES, PLACE_IDS, TIMES, newStory, present, restoreStory, serializeStory } from './ntuCampusWorld'
export type { AgendaItem, CampusStory, CampusView, CampusWorld, CastId, PlaceId, Point, StoryReader } from './ntuCampusWorld'

export const READINGS = 'readings'
export const READINGS_CHECKS = 'readings.checks'
export const READINGS_REMINDERS = 'readings.reminders'
export const READINGS_ANSWERS = 'readings.answers'
export const READINGS_PREF = 'readings.pref'
export const READINGS_EVERY_MS = minutes(30)
/** A check this soon after a reminder is linked to it. */
export const LINK_WINDOW_MS = minutes(10)
const BOOK = 'book'
const REPORT = 'report'
const REVIEW = 'review.1'
/** Passing the library means coming this close to its entrance. */
export const LIBRARY_PASS_M = 35
const AT_MEETING_M = 15
const SEE_M = 25
const FORGET_M = 45
/** How close counts as being at a place, for the sensing space. */
const PLACE_NEAR_M: Record<PlaceId, number> = { slab: 20, lt: AT_MEETING_M, library: LIBRARY_PASS_M, starbucks: 25, northSpine: 20, hall2: 20, hive: 20, uhs: 20 }
const ok = (label = text('Got it', '知道了')): CardAction => ({ id: 'ok', label, primary: true })

const atMeeting = (view: CampusView) => distance(view.at, PLACES.lt.at) <= AT_MEETING_M
const inMeeting = (story: CampusStory, view: CampusView) => nowOf(story) >= TIMES.meetingStart && nowOf(story) < TIMES.meetingEnd && atMeeting(view)
/** The instrument's value, a fixed function of campus time. */
export const readingAt = (ms: number) => (3.1 + 0.25 * Math.sin(ms / 2_400_000)).toFixed(2)

/** What someone is saying, shown as a speech bubble. Part of the world, not of the glasses. */
export function says (read: LoopReader, story: CampusStory, id: CastId): Text | undefined {
  const now = nowOf(story)
  const day1 = story.clock.day === 1
  if (id === 'lin') {
    const stage = pickupStage(read)
    if (stage === 'available') return text('Could you bring me A17 from the pickup desk?', '能帮我把领取桌上的 A17 拿过来吗？')
    if (stage === 'carrying') return text('Is that A17? Thanks!', '拿到 A17 了？谢谢！')
    if (!read.recall(READINGS) && day1 && now < TIMES.readingsLastAsk) return text('Also: could you check my readings every 30 minutes?', '对了，能每 30 分钟帮我看一眼读数吗？')
    if (day1 && now >= TIMES.linMessage) return text('I’ll watch the experiment myself now.', '实验我来盯，你忙你的。')
    return
  }
  if (id === 'presenter' && now >= TIMES.meetingStart && now < TIMES.meetingEnd) return text('This week we tried three settings…', '这周我们试了三种设置……')
  if (id === 'chatA' && now >= TIMES.privacyStart && now < TIMES.privacyEnd) return text('Did you hear Alex is in hospital?', '听说 Alex 这周住院了？')
  if (id === 'chatB' && now >= TIMES.privacyStart && now < TIMES.privacyEnd) return text('Yes, something with the heart…', '嗯，好像是心脏的问题……')
  if (id === 'zhou' && story.world.chat) return text('Hey, what did you think of that proposal?', '诶，刚才那个方案你怎么看？')
  if (id === 'librarian' && !story.world.bookReturned) return text('Returns go here.', '还书放这里就好。')
  return errandSays(read, story, id) ?? conditionSays(story, id)
}

/** Sensing space: nearby cast and places. Only a local update, so no channel or trace. */
function sense (loop: ServiceLoop, story: CampusStory, view: CampusView) {
  for (const id of CAST_IDS) {
    const member = CAST[id]
    const far = distance(view.at, member.at)
    // Someone the glasses do not recognise is not in their sensing space at all.
    const known = id !== 'chenLibrary' || chenRecognised(loop, story)
    if (known && present(story, id) && far <= FORGET_M && (far <= SEE_M || loop.state.sensing.field[id])) {
      loop.see(id, { label: member.name, inView: Boolean(view.sees[id]), distance: far })
    } else if (loop.state.sensing.field[id]) {
      loop.see(id, { label: member.name, inView: false, distance: far })
      // Let current evidence lapse first; then the entry leaves the sensing space.
      if (!Object.values(loop.state.sensing.evidence).some(entry => entry.anchor === id)) loop.unsee(id)
    }
  }
  for (const id of PLACE_IDS) {
    const near = PLACE_NEAR_M[id]
    const far = distance(view.at, PLACES[id].at)
    const anchor = `place:${id}`
    if (far <= near * 2) { loop.see(anchor, { label: PLACES[id].name, inView: far <= near, distance: far }) } else if (loop.state.sensing.field[anchor]) {
      loop.see(anchor, { label: PLACES[id].name, inView: false, distance: far })
      if (!Object.values(loop.state.sensing.evidence).some(entry => entry.anchor === anchor)) loop.unsee(anchor)
    }
  }
}

const PLAN_DAY1: CardInput = {
  id: 'plan.1', kind: 'plan', title: text('What is on today?', '今天有什么安排？'), why: text('Monday 09:00 · the day starts', '周一 09:00 · 新的一天'),
  lines: [
    text('Return the library book · remind me when I pass Lee Wee Nam Library', '还书 · 路过 Lee Wee Nam 图书馆时提醒我'),
    text('Send the report to Prof. Chen · after the 11:00 group meeting', '给陈教授发报告 · 11:00 组会开完之后'),
    ...PLAN_DAY1_LINES,
    PLAN_DAY1_GRANT
  ],
  actions: [ok(text('That’s the plan', '就这样'))]
}
/** Open commitments from yesterday, read from Memory. */
const carried = (read: LoopReader) => [PICKUP_TASK, BOOK, REPORT].map(id => read.recall(id)).filter((record): record is Readonly<MemoryRecord> => record?.status === 'active')
function planDay2 (read: LoopReader): CardInput {
  const open = carried(read)
  const line: Record<string, Text> = {
    [BOOK]: text('The library book is still not returned · I will remind you when you pass the library', '昨天的书还没还 · 路过图书馆时照样提醒你'),
    [REPORT]: text('The report to Prof. Chen is still not sent', '给陈教授的报告还没发'),
    [PICKUP_TASK]: text('Lin’s A17 is still not delivered', '林的 A17 还没送到')
  }
  return {
    id: 'plan.2', kind: 'plan', title: text('Today, and what is left from yesterday', '今天的安排，和昨天留下的事'), basis: open[0]?.id,
    why: read.recall(REVIEW) ? text('Tuesday 09:00 · from last night’s review', '周二 09:00 · 来自昨晚的复盘') : text('Tuesday 09:00 · from Memory', '周二 09:00 · 来自记忆'),
    lines: [...(open.length ? open.map(record => line[record.id]) : [text('Everything from yesterday is done.', '昨天的事都做完了。')]), ...planDay2Lines(read), PLAN_DAY2_MEDS],
    actions: [ok(text('That’s the plan', '就这样'))]
  }
}
function planScene (loop: ServiceLoop, story: CampusStory) {
  const { day } = story.clock
  const key = `plan.${day}`
  if (story.marks[key] || loop.now() < at(day, 9)) return
  const reads = day === 1 ? [] : [...carried(loop).map(record => record.id), REVIEW, GROUP, POSTER, GRANT]
  const spoke = speak(loop, 'plan', { kind: 'ask', label: day === 1 ? text('Ask about today’s plan', '问今天的安排') : text('Bring up yesterday’s open items', '带出昨天没做完的事') }, {
    uses: day === 1 ? [] : 'memory', reads,
    note: day === 1 ? text('The day starts. No one has spoken yet; the glasses open by asking what today holds.', '一天开始了。还没人开口，眼镜先问今天有什么安排。')
      : text('A new day. Without being asked, the glasses bring up what Memory still holds from yesterday.', '新的一天。没人开口，眼镜主动带出记忆里昨天留下的事。'),
    card: day === 1 ? PLAN_DAY1 : planDay2(loop)
  })
  if (spoke) story.marks[key] = loop.now()
}

function endChat (loop: ServiceLoop, story: CampusStory, byYou: boolean) {
  delete story.world.chat
  loop.observe(REPORT, { id: 'lt.talk', anchor: 'zhou', label: text('Zhou', '周'), value: text('Conversation over', '聊完了') }, {
    note: byYou ? text('You said goodbye to Zhou. Sensing sees the conversation end.', '你和周道别。感知看到谈话结束了。') : text('The conversation with Zhou is over.', '和周的谈话结束了。')
  })
}
function meetingScenes (loop: ServiceLoop, story: CampusStory, view: CampusView) {
  const now = loop.now()
  if (inMeeting(story, view)) story.marks['meeting.attended'] ??= now
  // Task 7: something the glasses must not keep.
  if (now >= TIMES.privacyStart && now < TIMES.privacyEnd && !story.marks.privacy && distance(view.at, CAST.chatA.at) <= 9) {
    story.marks.privacy = now
    loop.observe('privacy', { id: 'lt.overheard', anchor: 'chatA', label: text('Nearby conversation', '旁边的对话'), value: text('About another person’s health · content not shown', '关于另一个人的健康 · 内容不显示') }, {
      note: text('Sensing overhears two classmates talking about someone else’s illness. It stays in current evidence only.', '感知听到两位同学在聊另一个人的病情。它只停留在眼前的证据里。')
    })
    loop.decline('privacy', { from: 'sensing', note: text('This is someone else’s health information. Memory refuses to keep it.', '这是别人的健康信息，记忆拒绝保存。') })
  }
  if (now >= TIMES.meetingEnd && now < TIMES.zhouLeaves && atMeeting(view) && !story.marks['meeting.end']) {
    story.marks['meeting.end'] = now
    loop.observe(REPORT, { id: 'lt.ended', anchor: 'place:lt', label: text('Group meeting', '组会'), value: text('Over · people are leaving', '散会了 · 大家在离开') }, {
      note: text('Sensing sees the meeting break up.', '感知看到组会散了。')
    })
  }
  if (now >= TIMES.meetingEnd && now < TIMES.chatEnd && atMeeting(view) && !story.marks.chat) {
    story.marks.chat = now
    story.world.chat = { with: 'zhou', until: TIMES.chatEnd }
    loop.observe(REPORT, { id: 'lt.talk', anchor: 'zhou', label: text('Zhou', '周'), value: text('Talking with you', '正在和你说话') }, {
      note: text('Zhou stops you for a chat. Sensing notes that you are in a conversation.', '周拉住你聊天。感知注意到你正在和人说话。')
    })
  }
  const { chat } = story.world
  if (chat && (now >= chat.until || distance(view.at, CAST[chat.with].at) > 9)) endChat(loop, story, false)
}

/** Task 2: remind after the meeting, but not while you are talking. */
function reportRules (loop: ServiceLoop, story: CampusStory) {
  const report = loop.recall(REPORT)
  const now = loop.now()
  if (report?.status !== 'active' || now < num(report.data?.after) || loop.showing(REPORT)) return
  if (story.world.chat) {
    if (story.marks['report.wait']) return
    story.marks['report.wait'] = now
    loop.act(REPORT, { kind: 'wait', label: text('Not now: you are talking', '先不打扰：你在说话') }, {
      uses: ['sensing', 'memory'], reads: [REPORT],
      note: text('The meeting is over, but you are still talking (S). The report (M) can wait a few minutes.', '会开完了，但你还在说话（S）。发报告这件事（M）可以等几分钟，先不打扰。')
    })
    return
  }
  const snooze = num(report.data?.snoozeUntil)
  const reminded = story.marks['report.reminded']
  if (now < snooze || (reminded !== undefined && reminded >= snooze)) return
  const sawEnd = Boolean(loop.evidence('lt.talk') ?? loop.evidence('lt.ended'))
  const spoke = speak(loop, REPORT, { kind: 'remind', label: text('Remind: send the report', '提醒：发报告') }, {
    uses: ['memory', 'sensing'], reads: [REPORT],
    note: sawEnd ? text('The meeting is over and so is the conversation (S); the morning commitment says now (M).', '会开完了，聊天也结束了（S）；早上的承诺说就是现在（M）。')
      : text('The meeting in Memory ended at 12:00 (M), and you are not busy right now (S).', '记忆里的组会 12:00 已经结束（M），你此刻也不忙（S）。'),
    card: {
      id: REPORT, kind: 'reminder', basis: REPORT, title: text('Send the report to Prof. Chen', '给陈教授发报告'),
      why: sawEnd ? text('The meeting is over and you have finished talking.', '组会结束了，你们也聊完了。') : text('The group meeting ended at 12:00.', '组会 12:00 已经结束。'),
      actions: [{ id: 'send', label: text('Send now', '现在发送'), primary: true }, { id: 'later', label: text('In 15 min', '稍后 15 分钟') }]
    }
  })
  if (spoke) story.marks['report.reminded'] = now
}
function sendReport (loop: ServiceLoop, story: CampusStory): boolean {
  const now = loop.now()
  if (story.world.reportSent || now < TIMES.meetingEnd) return false
  story.world.reportSent = now
  loop.remember(REPORT, { id: REPORT, kind: 'commitment', label: text('Send the report to Prof. Chen', '给陈教授发报告'), value: text(`Sent · ${timeOf(now)}`, `已发送 · ${timeOf(now)}`), status: 'done', data: { after: TIMES.meetingEnd } }, {
    from: 'sensing', note: text('You sent the report. The glasses saw it, so the commitment is done.', '你发出了报告。眼镜看到了，这件事完成了。')
  })
  loop.dismiss(REPORT); loop.release(REPORT)
  return true
}

/** Task 1: a reminder with a place as its condition. */
function bookRules (loop: ServiceLoop, story: CampusStory, view: CampusView) {
  const far = distance(view.at, PLACES.library.at)
  // Leaving the area ends a visit; the next pass counts as a new one.
  if (far > LIBRARY_PASS_M * 2 && 'book.visit' in story.marks) delete story.marks['book.visit']
  const book = loop.recall(BOOK)
  if (far > LIBRARY_PASS_M || book?.status !== 'active' || story.marks['book.visit'] || loop.showing(BOOK) || loop.now() < num(book.data?.snoozeUntil)) return
  const spoke = speak(loop, BOOK, { kind: 'remind', label: text('Remind: return the book', '提醒：还书') }, {
    uses: ['memory', 'sensing'], reads: [BOOK],
    note: text('You are passing the library (S), and Memory holds a commitment waiting for exactly this place (M).', '你正路过图书馆（S），记忆里正好有一件等着这个地点的事（M）。'),
    card: {
      id: BOOK, kind: 'reminder', basis: BOOK, title: text('Return the library book', '还书'),
      why: text('You are passing Lee Wee Nam Library, and you asked to be reminded here.', '你正路过 Lee Wee Nam 图书馆，早上说过路过时提醒你。'),
      actions: [ok(), { id: 'later', label: text('Later', '稍后提醒') }]
    }
  })
  if (!spoke) return
  story.marks['book.visit'] = loop.now()
  story.marks['book.reminded'] = loop.now()
}
function returnBook (loop: ServiceLoop, story: CampusStory) {
  const now = loop.now()
  story.world.bookReturned = now
  loop.remember(BOOK, { id: BOOK, kind: 'commitment', label: text('Return the library book', '还书'), value: text(`Returned · ${timeOf(now)}`, `已还 · ${timeOf(now)}`), status: 'done' }, {
    from: 'sensing', note: text('The glasses saw you hand the book to the librarian. The commitment is done.', '眼镜看到你把书交给了图书馆员，这件事完成了。')
  })
  loop.dismiss(BOOK); loop.release(BOOK)
}

/** Task 3: a periodic reminder whose own history lives in Memory. */
function readingsRules (loop: ServiceLoop, story: CampusStory, view: CampusView) {
  const promise = loop.recall(READINGS)
  if (promise?.status !== 'active' || dayOver(story.clock)) {
    loop.unschedule(READINGS)
    return
  }
  const now = loop.now()
  const lastCheck = num(loop.recall(READINGS_CHECKS)?.data?.last)
  const lastReminder = num(loop.recall(READINGS_REMINDERS)?.data?.last)
  // The interval counts from Memory: your last check (S → M) or the last reminder (A → M).
  const base = Math.max(num(promise.data?.since), lastCheck, lastReminder)
  const reads = [READINGS, READINGS_CHECKS, READINGS_REMINDERS]
  if (loop.recall(READINGS_PREF)?.data?.on === false) {
    // Switched off: a would-be reminder is only logged. Its timer is Action's own, not Memory.
    const from = Math.max(base, num(story.marks['readings.shadow']))
    loop.track(READINGS, READINGS, { label: text('Readings reminder · off, log only', '读数提醒 · 已关，只记日志'), elapsedMs: now - from, dueMs: READINGS_EVERY_MS, unit: 'game' })
    if (now - from < READINGS_EVERY_MS) return
    story.marks['readings.shadow'] = now
    loop.act(READINGS, { kind: 'remind', label: text('Would remind: check the readings', '本来会提醒：看读数') }, {
      uses: 'memory', reads: [...reads, READINGS_PREF], shadow: true,
      note: text('Due, but you switched this reminder off. Only the log notes “would have reminded”: no card, and Memory is unchanged.', '到点了，但你关掉了这个提醒。只在日志里记一笔“本来会提醒”：不弹卡片，记忆也不变。')
    })
    return
  }
  loop.track(READINGS, READINGS, { label: text('Readings reminder · every 30 min', '读数提醒 · 每 30 分钟'), elapsedMs: now - base, dueMs: READINGS_EVERY_MS, unit: 'game' })
  // An unanswered card is renewed every interval; the card's own time is Action's bookkeeping.
  const shown = loop.state.action.cards.find(card => card.id === READINGS)
  if (now - base < READINGS_EVERY_MS || (shown && now - shown.at < READINGS_EVERY_MS) || now < num(loop.recall(READINGS_ANSWERS)?.data?.snoozeUntil)) return
  // Due, but you are busy right now: in the meeting or talking with someone.
  const meeting = inMeeting(story, view)
  if (meeting || story.world.chat) {
    if (story.marks['readings.busy'] === base) return
    story.marks['readings.busy'] = base
    loop.act(READINGS, { kind: 'wait', label: meeting ? text('Not now: you are in the meeting', '先等等：你在开会') : text('Not now: you are talking', '先等等：你在说话') }, {
      uses: ['sensing', 'memory'], reads,
      note: meeting ? text('The readings are due (M), but you are in the group meeting (S). The reminder waits until it is over.', '读数到点了（M），但你正在开组会（S）。提醒等会开完再说。')
        : text('The readings are due (M), but you are talking with Zhou (S). The reminder waits until you are done.', '读数到点了（M），但你正在和周说话（S）。等你们聊完再提醒。')
    })
    return
  }
  const since = timeOf(base)
  const why = base === lastCheck ? text(`${minutesBetween(base, now)} minutes since you last looked (${since}).`, `距你上次看读数（${since}）已经 ${minutesBetween(base, now)} 分钟。`)
    : base === lastReminder ? text(`${minutesBetween(base, now)} minutes since the last reminder (${since}).`, `距上次提醒（${since}）已经 ${minutesBetween(base, now)} 分钟。`)
      : text(`You agreed at ${since}; ${minutesBetween(base, now)} minutes have passed.`, `你 ${since} 答应了林，已经过了 ${minutesBetween(base, now)} 分钟。`)
  const spoke = speak(loop, READINGS, { kind: 'remind', label: text('Remind: check the readings', '提醒：看读数') }, {
    uses: 'memory', reads,
    note: text(`${minutesBetween(base, now)} minutes have passed since the last check or reminder in Memory, so the glasses remind you.`, `按记忆里的上次查看或上次提醒，已经过了 ${minutesBetween(base, now)} 分钟，于是提醒你。`),
    card: {
      id: READINGS, kind: 'reminder', basis: READINGS, title: text('Check Lin’s experiment readings', '看一下林的实验读数'), why,
      actions: [ok(), { id: 'later', label: text('In 10 min', '稍后 10 分钟') }, { id: 'off', label: text('Stop reminding', '不再提醒') }]
    }
  })
  if (!spoke) return
  const count = num(loop.recall(READINGS_REMINDERS)?.data?.count) + 1
  loop.remember(READINGS, { id: READINGS_REMINDERS, kind: 'receipt', label: text('Readings reminders', '读数提醒记录'), value: text(`${count} given · last ${timeOf(now)}`, `提醒过 ${count} 次 · 最近 ${timeOf(now)}`), data: { count, last: now } }, {
    from: 'action', note: text('Action writes this reminder back to Memory: the next interval counts from here, and what you do next can be linked to it.', '行动把这次提醒写回记忆：下次间隔从这里算，你之后的反应也能和它连起来。')
  })
}
function agreeReadings (loop: ServiceLoop) {
  loop.remember(READINGS, { id: READINGS, kind: 'commitment', label: text('Check Lin’s readings', '帮林看实验读数'), value: text('Every 30 minutes, until the end of today', '每 30 分钟一次，到今天结束'), data: { since: loop.now() } }, {
    from: 'sensing', note: text('You agreed. Memory keeps the commitment and its interval; the reminders will count from it.', '你答应了林。记忆记下这个承诺和它的间隔，之后的提醒都从这里算。')
  })
}
function checkReadings (loop: ServiceLoop, story: CampusStory) {
  const now = loop.now()
  story.world.checks++
  loop.observe(READINGS, { id: 'readings.value', anchor: 'rig', label: text('Readings', '读数'), value: text(`${readingAt(now)} · normal`, `${readingAt(now)} · 正常`) }, {
    note: text('Sensing reads the instrument.', '感知读到了仪器上的数值。')
  })
  const checks = loop.recall(READINGS_CHECKS)
  const lastReminder = num(loop.recall(READINGS_REMINDERS)?.data?.last)
  const off = loop.recall(READINGS_PREF)?.data?.on === false
  const linked = !off && lastReminder > num(checks?.data?.last) && now - lastReminder <= LINK_WINDOW_MS
  const count = num(checks?.data?.count) + 1
  const afterReminder = num(checks?.data?.afterReminder) + (linked ? 1 : 0)
  const afterOff = num(checks?.data?.afterOff) + (off ? 1 : 0)
  const how = linked ? text(`${minutesBetween(lastReminder, now)} min after a reminder`, `提醒后 ${minutesBetween(lastReminder, now)} 分钟`)
    : off ? text('on your own, reminders off', '提醒已关，你自己去看的') : text('not right after a reminder', '不是紧跟在提醒之后')
  const frozen = loop.state.frozen.includes('A → M')
  loop.remember(READINGS, {
    id: READINGS_CHECKS, kind: 'fact', label: text('Readings checks', '看读数'),
    value: text(`${count} so far · last ${timeOf(now)} (${how.en})`, `看过 ${count} 次 · 最近 ${timeOf(now)}（${how.zh}）`), data: { count, last: now, afterReminder, afterOff }
  }, {
    from: 'sensing',
    note: linked ? text('You looked at the readings. Memory links it to the reminder it holds: an outcome of that reminder, though not proof it caused it.', '你看了读数。记忆把它和记下的那次提醒连起来：这是提醒之后的结果，但不能证明是提醒促成的。')
      : frozen && !off ? text('You looked at the readings, but no reminder was written back (write-back is frozen), so there is nothing to link it to.', '你看了读数，但提醒没有写回记忆（写回被冻结），这次查看连不上任何提醒。')
        : text('You looked at the readings. Memory keeps the check, and the interval restarts from it.', '你看了读数。记忆记下这次查看，间隔从这里重新计算。')
  })
  loop.dismiss(READINGS); loop.release(READINGS)
}
function setReadingsReminders (loop: ServiceLoop, story: CampusStory, on: boolean) {
  const now = loop.now()
  const base = Math.max(num(loop.recall(READINGS)?.data?.since), num(loop.recall(READINGS_CHECKS)?.data?.last), num(loop.recall(READINGS_REMINDERS)?.data?.last))
  if (on) delete story.marks['readings.shadow']
  else story.marks['readings.shadow'] = base
  loop.remember(READINGS, {
    id: READINGS_PREF, kind: 'preference', label: text('Readings reminders', '读数提醒'), data: { on, at: now },
    value: on ? text(`On · you switched them back on at ${timeOf(now)}`, `开 · 你 ${timeOf(now)} 重新打开`) : text(`Off · you stopped them at ${timeOf(now)}; due times go to the log only`, `关 · 你 ${timeOf(now)} 点了“不再提醒”；到点只记日志`)
  }, {
    from: 'sensing',
    note: on ? text('You switched the reminders back on. The old records are still in Memory, so the interval picks up from the last reminder.', '你重新打开了提醒。旧记录还在记忆里，间隔从上一次提醒接着算。')
      : text('You stopped the reminders. Your choice is kept as a preference. The old reminder records stay: stopping is not deleting.', '你关掉了提醒。这个选择作为偏好记下；旧的提醒记录还在：停用不等于删除。')
  })
  loop.dismiss(READINGS)
}
function linMessage (loop: ServiceLoop, story: CampusStory) {
  if (story.clock.day !== 1 || loop.now() < TIMES.linMessage || story.marks['lin.message'] || loop.recall(READINGS)?.status !== 'active') return
  const spoke = speak(loop, READINGS, { kind: 'notify', label: text('Pass on Lin’s message', '转达林的消息') }, {
    uses: 'sensing',
    note: text('A message from Lin arrives (S) and the glasses pass it on. They do not change the reminder themselves: that is your call.', '林发来消息（S），眼镜转给你。它不会自己改掉读数提醒：关不关由你决定。'),
    card: { id: 'lin.message', kind: 'message', title: text('Lin: I’ll watch the experiment myself.', '林：实验我来盯，你不用管了。'), why: text('New message · 13:00', '新消息 · 13:00'), actions: [ok()] }
  })
  if (spoke) story.marks['lin.message'] = loop.now()
}

/** Task 10 and the task 3 comparison: an evening review nobody asked for. */
function reviewDay1 (read: StoryReader) {
  const lines: Text[] = []
  const reads = [BOOK, REPORT]
  const morning = [read.recall(REPORT), read.recall(BOOK), read.recall(POSTER)].filter((record): record is Readonly<MemoryRecord> => record !== undefined)
  if (morning.length) {
    lines.push(text(`This morning: ${morning.map(record => `${record.label.en} ${record.status === 'done' ? '✓' : '✗'}`).join(' · ')}`, `早上的事：${morning.map(record => `${record.label.zh} ${record.status === 'done' ? '✓' : '✗'}`).join(' · ')}`))
  }
  if (read.recall(READINGS)) {
    reads.push(READINGS, READINGS_REMINDERS, READINGS_CHECKS, READINGS_PREF)
    const given = num(read.recall(READINGS_REMINDERS)?.data?.count)
    const checks = read.recall(READINGS_CHECKS)?.data
    const shadows = read.state.tally.shadow ?? 0
    const switched = read.recall(READINGS_PREF) !== undefined || shadows > 0
    lines.push(text(`Readings: ${given} reminder${given === 1 ? '' : 's'}${switched ? ' before you stopped them' : ''}; you checked within 10 min after ${num(checks?.afterReminder)} of them`, `读数提醒：${switched ? '关掉前' : ''}提醒 ${given} 次，其中 ${num(checks?.afterReminder)} 次你在 10 分钟内去看了`))
    if (switched) {
      const related = num(checks?.afterReminder) > 0
      lines.push(
        text(`After: the log holds ${shadows} “would have reminded”; you checked ${num(checks?.afterOff)} times on your own`, `关掉后：日志里有 ${shadows} 次“本来会提醒”，你自己看了 ${num(checks?.afterOff)} 次`),
        related ? text('Related, but not proof the reminders did it: Lin took over at 13:00, so the situation changed too.', '有关联，但不能证明是提醒起的作用：13:00 林说他来盯，情况本身也变了。')
          : text('No check followed a reminder, so this day says nothing about whether the reminders helped.', '没有哪次查看紧跟在提醒之后，所以今天看不出提醒有没有用。')
      )
    }
    if (read.state.frozen.includes('A → M')) lines.push(text('Write-back was frozen: Memory holds no reminder records, so these counts and links are missing.', '写回被冻结：记忆里没有提醒记录，上面的次数和对应关系都数不出来。'))
  }
  const errands = errandReview(read)
  lines.push(...errands.lines)
  reads.push(...errands.reads)
  if (!lines.length) lines.push(text('Nothing was planned with the glasses today.', '今天没有和眼镜约定什么事。'))
  const bookOpen = read.recall(BOOK)?.status === 'active'
  const actions: CardAction[] = bookOpen ? [{ id: 'carry', label: text('Move the book to tomorrow', '书挪到明天'), primary: true }, { id: 'drop', label: text('Drop it', '不还了') }] : [ok(text('OK', '好'))]
  return { lines, reads, actions }
}
const KIND_WORDS: Record<MemoryKind, Text> = { commitment: text('commitments', '承诺'), fact: text('facts', '事实'), evidence: text('evidence', '证据'), preference: text('preferences', '偏好'), receipt: text('receipts', '凭据') }
function endingLines (read: StoryReader, story: CampusStory): Text[] {
  const { tally, memory } = read.state
  // What Action did unasked, leaving out what never happened.
  const did = ([['remind', 'reminded', '提醒'], ['wait', 'held back', '按下不说'], ['notify', 'passed on messages', '转达消息'], ['ask', 'asked first', '先问你'], ['review', 'reviewed', '复盘']] as const)
    .filter(([kind]) => tally[kind]).map(([kind, en, zh]) => [`${en} ${tally[kind]}×`, `${zh} ${tally[kind]} 次`])
  const lines = [text(`Unasked, I ${did.map(([en]) => en).join(', ') || 'did nothing'}`, `你没开口时，我${did.map(([, zh]) => zh).join('，') || '什么也没做'}`)]
  const kinds = (['commitment', 'receipt', 'fact', 'preference'] as const).map(kind => [kind, memory.filter(record => record.kind === kind).length] as const).filter(([, count]) => count > 0)
  lines.push(text(
    [`I kept ${kinds.map(([kind, count]) => `${count} ${KIND_WORDS[kind].en}`).join(', ') || 'nothing'}`, tally.refused ? `refused to keep ${tally.refused} (someone else’s health)` : '', tally.shadow ? `and logged ${tally.shadow} “would have reminded”` : ''].filter(Boolean).join('; '),
    [`我记住了：${kinds.map(([kind, count]) => `${KIND_WORDS[kind].zh} ${count} 条`).join('、') || '没有'}`, tally.refused ? `拒绝记下 ${tally.refused} 条（别人的健康信息）` : '', tally.shadow ? `日志里有 ${tally.shadow} 次“本来会提醒”` : ''].filter(Boolean).join('；')
  ))
  if (read.recall(BOOK)?.status === 'active') {
    const reminded = story.marks['book.reminded']
    lines.push(reminded === undefined
      ? text('Missed: the book is still not returned. I only remind when you pass the library, and you never did.', '没做到：书还没还。我只在你路过图书馆时提醒，而你一直没路过。')
      : text(`Missed: I reminded you at the library (${formatGameMs(reminded, 'en')}), but the book is still not returned.`, `没做到：在图书馆提醒过你（${formatGameMs(reminded, 'zh')}），但书还是没还。`))
  }
  if (read.recall(REPORT)?.status === 'active') lines.push(text('Missed: the report to Prof. Chen was never sent.', '没做到：给陈教授的报告一直没发。'))
  if (read.recall(PICKUP_TASK)?.status === 'active') lines.push(text('Missed: Lin never got A17.', '没做到：林的 A17 一直没送到。'))
  lines.push(...errandEnding(read, story), ...conditionEnding(read, story))
  return lines
}
function eveningScenes (loop: ServiceLoop, story: CampusStory) {
  const { day } = story.clock
  if (!dayOver(story.clock)) return
  if (day === 1 && loop.expire(READINGS, text('Lin’s experiment ended with the day; the commitment no longer applies.', '林的实验随今天结束了，这项承诺不再生效。'))) loop.unschedule(READINGS)
  if (day === 1 && !story.marks.review) {
    const review = reviewDay1(loop)
    const spoke = speak(loop, 'review', { kind: 'review', label: text('Review today’s plan', '复盘今天') }, {
      uses: 'memory', reads: review.reads,
      note: text('18:00. No one asked. The glasses compare what Memory holds with what happened.', '18:00，没人开口。眼镜拿记忆里的约定和实际发生的事做对比。'),
      card: { id: REVIEW, kind: 'review', title: text('Today’s review', '今天的复盘'), why: text('Monday 18:00 · end of the day', '周一 18:00 · 一天结束'), basis: loop.recall(BOOK) ? BOOK : undefined, lines: review.lines, actions: review.actions }
    })
    if (!spoke) return
    story.marks.review = loop.now()
    loop.remember('review', { id: REVIEW, kind: 'receipt', label: text('Day 1 review', '第一天复盘'), value: review.lines[0] }, {
      from: 'action', note: text('The review is written back to Memory; tomorrow morning will start from it.', '复盘写回记忆，明天早上会从这里接着来。')
    })
  }
  if (day === 2 && !story.marks.ending) {
    const lines = endingLines(loop, story)
    const spoke = speak(loop, 'review', { kind: 'review', label: text('Look back on two days', '回顾两天') }, {
      uses: 'memory', reads: loop.state.memory.map(record => record.id).slice(0, 8),
      note: text('The last evening. The glasses list what they did unasked, what they kept and refused, and what went wrong.', '最后一个傍晚。眼镜列出它没被要求时做了什么、记住和拒绝了什么，以及哪里没做到。'),
      card: { id: 'ending', kind: 'review', title: text('Two days with the glasses', '和眼镜的两天'), why: text('Tuesday 18:00 · the end', '周二 18:00 · 结束'), lines, actions: [{ id: 'again', label: text('Play again', '再玩一次'), primary: true }, { id: 'ok', label: text('Close', '关闭') }] }
    })
    if (spoke) story.marks.ending = loop.now()
  }
}

/** One scheduled pass. Callers advance the clock first and stop calling while service is paused. */
export function tickStory (loop: ServiceLoop, story: CampusStory, view: CampusView) {
  sense(loop, story, view)
  planScene(loop, story)
  meetingScenes(loop, story, view)
  tickPickup(loop, { colleagueVisible: Boolean(view.sees[PICKUP_COLLEAGUE]), deskVisible: Boolean(view.sees[PICKUP_DESK]) })
  linMessage(loop, story)
  readingsRules(loop, story, view)
  bookRules(loop, story, view)
  reportRules(loop, story)
  tickErrands(loop, story, view)
  tickConditions(loop, story, view)
  eveningScenes(loop, story)
}

export const INTERACTIONS = ['a17.accept', 'a17.collect', 'a17.deliver', 'readings.agree', 'readings.check', 'book.return', 'chat.leave', 'chen.greet', 'chen.sign', 'poster.fix', 'group.join', 'meds.collect'] as const
export type InteractionId = typeof INTERACTIONS[number]
/**
 * `name` replaces the target's name where the glasses do not know who it is; `unmarked`
 * targets get no pin and no guidance, only the prompt once they are within reach.
 */
export type Interaction = { id: InteractionId, target: CastId, action: Text, name?: Text, unmarked?: true }
/** What the interaction key can do, at most one thing per target. */
export function interactions (read: LoopReader, story: CampusStory): Interaction[] {
  const list: Interaction[] = []
  const stage = pickupStage(read)
  if (stage === 'carrying') list.push({ id: 'a17.deliver', target: 'lin', action: text('Hand A17 to Lin', '把 A17 交给林') })
  else if (stage === 'available') list.push({ id: 'a17.accept', target: 'lin', action: text('Agree to fetch A17', '答应帮林取 A17') })
  else if (!read.recall(READINGS) && story.clock.day === 1 && nowOf(story) < TIMES.readingsLastAsk) list.push({ id: 'readings.agree', target: 'lin', action: text('Agree to check Lin’s readings', '答应帮林看读数') })
  if (stage === 'pending') list.push({ id: 'a17.collect', target: 'desk', action: text('Collect A17', '领取 A17') })
  if (read.recall(READINGS)?.status === 'active') list.push({ id: 'readings.check', target: 'rig', action: text('Check the readings', '看读数') })
  if (!story.world.bookReturned) list.push({ id: 'book.return', target: 'returnDesk', action: text('Return the book', '还书') })
  if (story.world.chat) list.push({ id: 'chat.leave', target: story.world.chat.with, action: text('Say goodbye to Zhou', '和周道别') })
  list.push(...errandInteractions(read, story), ...conditionInteractions(read, story))
  return list.filter(entry => present(story, entry.target))
}
/** 'handoff' means a visible handoff started; call finishPickupHandoff once it ends. */
export function interact (loop: ServiceLoop, story: CampusStory, id: InteractionId, view: CampusView): false | 'done' | 'handoff' {
  const entry = interactions(loop, story).find(candidate => candidate.id === id)
  if (!entry || !view.sees[entry.target]) return false
  const seen = { colleagueVisible: Boolean(view.sees.lin), deskVisible: Boolean(view.sees.desk) }
  if (id === 'a17.accept') return pickupInteraction(loop, 'accept', seen) ? 'done' : false
  if (id === 'a17.collect') return pickupInteraction(loop, 'collect', seen) ? 'handoff' : false
  if (id === 'a17.deliver') return pickupInteraction(loop, 'deliver', seen) ? 'handoff' : false
  switch (id) {
    case 'readings.agree': {
      agreeReadings(loop)
      break
    }
    case 'readings.check': {
      checkReadings(loop, story)
      break
    }
    case 'book.return': {
      returnBook(loop, story)
      break
    }
    case 'chat.leave': {
      endChat(loop, story, true)
      break
    }
    case 'meds.collect': {
      conditionInteract(loop, story, id as ConditionInteraction)
      break
    }
    default: errandInteract(loop, story, id as ErrandInteraction)
  }
  return 'done'
}

/**
 * Answers are sensed (S → M) whenever they change what the glasses do later.
 * 'reset' asks the host to start over; `{ travel }` asks it to shuttle to a place.
 */
export function answerCard (loop: ServiceLoop, story: CampusStory, cardId: string, answer: string): boolean | 'reset' | { travel: PlaceId } {
  if (!loop.showing(cardId)) return false
  const now = loop.now()
  if (cardId === PICKUP_REMINDER) return answerPickupReminder(loop, answer)
  const errand = answerErrand(loop, cardId, answer) ?? answerCondition(loop, story, cardId, answer)
  if (errand !== undefined) return errand
  if (cardId === READINGS && answer === 'off') {
    setReadingsReminders(loop, story, false)
    return true
  }
  loop.dismiss(cardId)
  if (cardId === 'plan.1') {
    loop.remember(BOOK, { id: BOOK, kind: 'commitment', label: text('Return the library book', '还书'), value: text('Remind when passing Lee Wee Nam Library', '路过 Lee Wee Nam 图书馆时提醒'), data: { place: 'library' } }, {
      from: 'sensing', note: text('You said you need to return a book. Memory keeps it together with its condition: when you pass the library.', '你说要还书。记忆连同触发条件一起记下：路过图书馆时。')
    })
    loop.remember(REPORT, { id: REPORT, kind: 'commitment', label: text('Send the report to Prof. Chen', '给陈教授发报告'), value: text('After the group meeting (ends 12:00)', '组会（12:00 结束）之后'), data: { after: TIMES.meetingEnd } }, {
      from: 'sensing', note: text('The report is kept with its condition: once the meeting is over.', '发报告也记下了，条件是组会结束之后。')
    })
    answerPlanDay1(loop)
    answerGrant(loop, story)
  } else if (cardId === 'plan.2') {
    answerPlanDay2(loop)
    answerMeds(loop)
  } else if (cardId === REPORT && answer === 'send') {
    sendReport(loop, story)
  } else if (cardId === REPORT && answer === 'later') {
    const report = loop.recall(REPORT)
    if (report?.status === 'active') {
      loop.remember(REPORT, { ...report, value: text(`After the meeting · you said later, again at ${timeOf(now + minutes(15))}`, `组会之后 · 你说稍后，${timeOf(now + minutes(15))} 再提醒`), data: { ...report.data, snoozeUntil: now + minutes(15) } }, {
        from: 'sensing', note: text('You tapped “In 15 min”. Memory keeps your answer, and the reminder returns then.', '你点了“稍后 15 分钟”。记忆记下这个回应，到时再提醒。')
      })
    }
  } else if (cardId === BOOK && answer === 'later') {
    const book = loop.recall(BOOK)
    if (book?.status === 'active') {
      loop.remember(BOOK, { ...book, data: { ...book.data, snoozeUntil: now + minutes(20) } }, {
        from: 'sensing', note: text('You tapped “Later”. Memory keeps it; if you are still nearby in 20 minutes, the glasses ask again.', '你点了“稍后提醒”。记忆记下这个回应；20 分钟后你若还在附近，再提醒一次。')
      })
      delete story.marks['book.visit']
    }
  } else if (cardId === READINGS) {
    const answers = loop.recall(READINGS_ANSWERS)?.data
    const okCount = num(answers?.ok) + (answer === 'later' ? 0 : 1)
    const later = num(answers?.later) + (answer === 'later' ? 1 : 0)
    loop.remember(READINGS, {
      id: READINGS_ANSWERS, kind: 'fact', label: text('Your answers to readings reminders', '你对读数提醒的回应'),
      value: text(`Got it ${okCount} · later ${later}`, `知道了 ${okCount} · 稍后 ${later}`), data: { ok: okCount, later, last: now, ...(answer === 'later' ? { snoozeUntil: now + minutes(10) } : {}) }
    }, {
      from: 'sensing', note: answer === 'later' ? text('You tapped “In 10 min”. The answer is kept and linked to this reminder; it returns in 10 minutes.', '你点了“稍后 10 分钟”。这个回应被记下，和这次提醒连在一起，10 分钟后再提醒。')
        : text('You tapped “Got it”. The answer is kept and linked to this reminder.', '你点了“知道了”。这个回应被记下，和这次提醒连在一起。')
    })
  } else if (cardId === REVIEW && answer !== 'ok') {
    const book = loop.recall(BOOK)
    if (book?.status === 'active') {
      loop.remember(BOOK, answer === 'carry'
        ? { ...book, value: text('Moved to tomorrow · remind when passing the library', '挪到明天 · 路过图书馆时提醒'), data: { ...book.data, carried: true } }
        : { ...book, value: text('Dropped · you decided not to', '已取消 · 你说不还了'), status: 'done' }, {
        from: 'sensing', note: answer === 'carry' ? text('You moved the book to tomorrow. Memory updates the commitment; the morning will bring it up.', '你把还书挪到明天。记忆更新这项承诺，明早会带出来。')
          : text('You dropped the book. The commitment is closed, and the glasses stop reminding.', '你决定不还了。这项承诺关闭，眼镜不再提醒。')
      })
    }
  } else if (cardId === 'ending' && answer === 'again') {
    return 'reset'
  }
  return true
}

/** Things you can do from the agenda instead of waiting for a card. */
export function agendaAction (loop: ServiceLoop, story: CampusStory, id: 'report.send' | 'readings.on' | 'poster.send'): boolean {
  if (id === 'report.send') return sendReport(loop, story)
  if (id === 'poster.send') return sendPoster(loop, story)
  if (loop.recall(READINGS)?.status !== 'active' || loop.recall(READINGS_PREF)?.data?.on !== false) return false
  setReadingsReminders(loop, story, true)
  return true
}

/** Night falls: yesterday's cards go away, Memory stays. Returns false unless day 1 is over. */
export function startDay2 (loop: ServiceLoop, story: CampusStory): boolean {
  if (story.clock.day !== 1 || !dayOver(story.clock)) return false
  for (const id of loop.state.action.cards.map(card => card.id)) loop.dismiss(id)
  for (const id of Object.keys(loop.state.action.held)) loop.release(id)
  delete story.world.chat
  if (!startNextDay(story.clock)) return false
  chargeOvernight(story)
  return true
}

/** The next timed thing on today's clock, for fast-forwarding. Where you happen to be is not an event. */
export function nextEvent (read: StoryReader, story: CampusStory): { at: number, label: Text } | undefined {
  const now = nowOf(story)
  const { day } = story.clock
  const events: Array<[number, Text]> = [[at(day, 18), day === 1 ? text('Evening review', '傍晚复盘') : text('Two-day review', '两天回顾')]]
  if (day === 1) {
    events.push([TIMES.meetingStart, text('Group meeting starts', '组会开始')], [TIMES.privacyStart, text('Meeting in progress', '组会进行中')], [TIMES.meetingEnd, text('Meeting ends', '组会结束')])
    if (story.world.chat) events.push([story.world.chat.until, text('Chat ends', '聊天结束')])
    if (read.recall(READINGS)?.status === 'active' && !story.marks['lin.message']) events.push([TIMES.linMessage, text('Message from Lin', '林的消息')])
  }
  events.push(...errandEvents(read, story), ...conditionEvents(read, story))
  for (const entry of Object.values(read.state.action.scheduled)) {
    if (entry.unit === 'game' && entry.elapsedMs < entry.dueMs) events.push([now + entry.dueMs - entry.elapsedMs, entry.label])
  }
  const snoozes: Array<[unknown, Text]> = [
    [read.recall(REPORT)?.data?.snoozeUntil, text('Report reminder', '发报告提醒')],
    [read.recall(READINGS_ANSWERS)?.data?.snoozeUntil, text('Readings reminder', '读数提醒')],
    [read.recall(PICKUP_TASK)?.data?.snoozeUntil, text('A17 reminder', 'A17 提醒')]
  ]
  for (const [until, label] of snoozes) if (num(until) > now) events.push([num(until), label])
  return events.filter(([time]) => time > now + 1000 && time <= at(day, 18)).sort(([a], [b]) => a - b).map(([time, label]) => ({ at: time, label }))[0]
}

/** Your own calendar and to-dos: what you know, which is not the same as what the glasses keep. */
export function agenda (read: StoryReader, story: CampusStory): AgendaItem[] {
  const now = nowOf(story)
  const { day } = story.clock
  const items: AgendaItem[] = []
  const stage = pickupStage(read)
  if (day === 1 || stage !== 'completed') {
    items.push({
      id: 'a17', title: text('Fetch A17 for Lin', '帮林取 A17'), place: 'slab', state: stage === 'completed' ? 'done' : 'todo',
      detail: stage === 'available' ? text('Find Lin outside S-Lab', '去 S-Lab 外找林') : stage === 'pending' ? text('Collect it at the pickup desk', '去领取桌取件') : stage === 'carrying' ? text('Bring it back to Lin', '带回去交给林') : text('Delivered', '已交付')
    })
  }
  if (day === 1) {
    items.push({
      id: 'meeting', title: text('Group meeting 11:00–12:00', '组会 11:00–12:00'), place: 'lt',
      state: now < TIMES.meetingStart ? 'todo' : now < TIMES.meetingEnd ? 'now' : story.marks['meeting.attended'] ? 'done' : 'missed',
      detail: now >= TIMES.meetingEnd && !story.marks['meeting.attended'] ? text('Missed', '错过了') : PLACES.lt.name
    })
  }
  const readings = read.recall(READINGS)
  if (readings && day === 1) {
    const off = read.recall(READINGS_PREF)?.data?.on === false
    const next = read.state.action.scheduled[READINGS]
    items.push({
      id: 'readings', title: text('Check Lin’s readings', '帮林看读数'), place: 'slab', state: readings.status === 'active' ? 'todo' : 'done',
      detail: readings.status === 'active' ? off ? text('Reminders off', '提醒已关')
        : next && next.elapsedMs < next.dueMs ? text(`Every 30 min · next ${timeOf(now + next.dueMs - next.elapsedMs)}`, `每 30 分钟 · 下次 ${timeOf(now + next.dueMs - next.elapsedMs)}`) : text('Every 30 min · due now', '每 30 分钟 · 到点了') : text('Experiment over', '实验已结束'),
      ...(readings.status === 'active' && off ? { action: { id: 'readings.on' as const, label: text('Remind again', '重新提醒') } } : {})
    })
  }
  if (day === 1 || !story.world.reportSent) {
    items.push({
      id: 'report', title: text('Send the report to Prof. Chen', '给陈教授发报告'), state: story.world.reportSent ? 'done' : 'todo',
      detail: story.world.reportSent ? text(`Sent ${timeOf(story.world.reportSent)}`, `已发送 ${timeOf(story.world.reportSent)}`) : now < TIMES.meetingEnd ? text('After the meeting', '组会之后') : text('Ready to send', '可以发了'),
      ...(!story.world.reportSent && now >= TIMES.meetingEnd ? { action: { id: 'report.send' as const, label: text('Send', '发送') } } : {})
    })
  }
  if (day === 1 || !story.world.bookReturned) {
    items.push({
      id: 'book', title: text('Return the library book', '还书'), place: 'library', state: story.world.bookReturned ? 'done' : 'todo',
      detail: story.world.bookReturned ? text(`Returned ${timeOf(story.world.bookReturned)}`, `已还 ${timeOf(story.world.bookReturned)}`) : PLACES.library.name
    })
  }
  items.push(...errandAgenda(read, story), ...conditionAgenda(read, story))
  return items
}

/** What the props show right now: the readout, the board, the kiosk and the door notice. */
export function displays (story: CampusStory): Partial<Record<CastId, string[]>> {
  return { rig: ['READING', readingAt(nowOf(story))], ...errandDisplays(story) }
}
