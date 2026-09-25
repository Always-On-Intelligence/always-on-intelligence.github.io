/**
 * The campus demo in chapters, one or two README tasks each. A chapter's prelude replays
 * what came before it through the story rules (answering cards, meeting people, letting
 * time pass), so any chapter can be watched on its own; its steps are then played the
 * way a player would play them.
 */
import { text, type ServiceLoop, type Text } from './alwaysOnLoop'
import { at, minutes, skipTo } from './ntuCampusClock'
import type { Beat, Chapter, SkipTarget } from './ntuCampusDirector'
import { CAST, PLACES, agendaAction, answerCard, interact, interactions, nextEvent, startDay2, tickStory, type CampusStory, type CampusView, type CastId, type PlaceId, type Point, type StoryReader } from './ntuCampusStory'
import { LIVE_ROUTE } from './ntuLiveRoute'
import { finishPickupHandoff } from './ntuPickupQuest'

const { path } = LIVE_ROUTE
/**
 * Slices of the verified S-Lab route. Each ends where its step happens, about 3 m from
 * Lin or 2 m from the desk, so the target, its pin and the prompt share the frame.
 */
export const A17_ROUTE = { toColleague: path.slice(0, 4), toDesk: path.slice(3, 21), back: path.slice(20, 31) }
/** From the North Spine stop to within reach of the print kiosk; every block checked flat in the Anvil world. */
export const PRINTER_PATH: readonly Point[] = [{ x: -144.5, y: 65, z: 170.5 }, { x: -145.5, y: 65, z: 169.5 }, { x: -146.5, y: 65, z: 168.5 }, { x: -147.5, y: 65, z: 168.5 }]
/**
 * Where the demo gets off the shuttle for each place, and the walk in from there, so every scene
 * begins on foot. Found by A* over the real Anvil world: level ground with two blocks of headroom,
 * a body's width clear of walls and at least 1.8 m from every cast member, ending on the place's
 * arrival point. S-Lab has none: its road is walled in, and its chapters already walk the A17 route.
 */
export const WALK_INS: Partial<Record<PlaceId, readonly Point[]>> = {
  lt: [{ x: -138.5, y: 60, z: 273.5 }, { x: -136.5, y: 60, z: 267.5 }, { x: -134.5, y: 60, z: 264.5 }, { x: -128.5, y: 60, z: 245.5 }, { x: -128.5, y: 60, z: 244.5 }, { x: -130.5, y: 60, z: 240.5 }],
  library: [{ x: -141.5, y: 62, z: -13.5 }, { x: -140.5, y: 62, z: -6.5 }, { x: -140.5, y: 62, z: -2.5 }, { x: -141.5, y: 62, z: -1.5 }, { x: -141.5, y: 62, z: 19.5 }, { x: -142.5, y: 62, z: 20.5 }],
  starbucks: [{ x: -320.5, y: 45, z: 1.5 }, { x: -320.5, y: 45, z: 35.5 }],
  northSpine: [{ x: -163.5, y: 65, z: 152.5 }, { x: -150.5, y: 65, z: 163.5 }, { x: -146.5, y: 65, z: 166.5 }, { x: -144.5, y: 65, z: 170.5 }],
  hall2: [{ x: 95.5, y: 56, z: -65.5 }, { x: 114.5, y: 56, z: -76.5 }, { x: 122.5, y: 56, z: -85.5 }],
  hive: [{ x: 100.5, y: 37, z: 446.5 }, { x: 98.5, y: 37, z: 448.5 }, { x: 76.5, y: 37, z: 471.5 }],
  uhs: [{ x: 33.5, y: 57, z: 269.5 }, { x: 32.5, y: 57, z: 269.5 }, { x: 32.5, y: 57, z: 266.5 }, { x: 26.5, y: 57, z: 258.5 }, { x: 18.5, y: 57, z: 250.5 }, { x: 15.5, y: 57, z: 250.5 }]
}
/** Where the shuttle sets a walk-in down, looking toward the place. */
export function walkInStart (place: PlaceId): (Point & { yaw: number }) | undefined {
  const path = WALK_INS[place]
  if (!path) return undefined
  const [start] = path
  const end = path.at(-1)!
  return { ...start, yaw: Math.atan2(start.x - end.x, start.z - end.z) }
}

const FAR: Point = { x: 400, y: 60, z: 400 }
const beside = (id: CastId): Point => ({ ...CAST[id].at, x: CAST[id].at.x + 2 })
function viewAt (where?: PlaceId | CastId): CampusView {
  if (!where) return { at: FAR, sees: {} }
  if (where in PLACES) return { at: PLACES[where as PlaceId].at, sees: {} }
  return { at: beside(where as CastId), sees: { [where]: true } }
}
/** Play prelude beats through the story rules, instantly. Nothing is written to Memory directly. */
export function replay (loop: ServiceLoop, story: CampusStory, beats: readonly Beat[]) {
  for (const beat of beats) {
    if ('at' in beat) {
      skipTo(story.clock, beat.at)
      tickStory(loop, story, viewAt(beat.where))
    } else if ('meet' in beat) {
      const entry = interactions(loop, story).find(candidate => candidate.id === beat.meet)
      if (!entry) throw new Error(`prelude: ${beat.meet} is not available`)
      const result = interact(loop, story, beat.meet, viewAt(entry.target))
      if (result === 'handoff') finishPickupHandoff(loop, beat.meet === 'a17.collect' ? 'collect' : 'deliver')
      if (!result) throw new Error(`prelude: ${beat.meet} was refused`)
    } else if ('answer' in beat) {
      if (!answerCard(loop, story, beat.answer, beat.action ?? 'ok')) throw new Error(`prelude: card ${beat.answer} is not showing`)
    } else if ('agenda' in beat) {
      agendaAction(loop, story, beat.agenda)
    } else if ('sleep' in beat) {
      if (!startDay2(loop, story)) throw new Error('prelude: the day is not over')
      tickStory(loop, story, viewAt())
    } else {
      for (const id of loop.state.action.cards.map(card => card.id)) loop.dismiss(id)
    }
  }
}
/** The campus time a skip lands on, or undefined when there is nothing ahead. */
export function skipTarget (read: StoryReader, story: CampusStory, now: number, to: SkipTarget): number | undefined {
  if (!to) return nextEvent(read, story)?.at
  if ('at' in to) return to.at
  if ('after' in to) return now + minutes(to.after)
  const timer = read.state.action.scheduled[to.timer]
  return timer && timer.elapsedMs < timer.dueMs ? now + timer.dueMs - timer.elapsedMs : undefined
}

const PLAN: readonly Beat[] = [{ at: at(1, 9) }, { answer: 'plan.1' }]
const A17_DONE: readonly Beat[] = [{ at: at(1, 9, 30), where: 'lin' }, { meet: 'a17.accept' }, { meet: 'a17.collect' }, { meet: 'a17.deliver' }]
const GREETED: readonly Beat[] = [{ at: at(1, 13, 5), where: 'chenCafe' }, { meet: 'chen.greet' }]
const TO_DAY2: readonly Beat[] = [{ at: at(1, 18) }, { answer: 'review.1', action: 'carry' }, { sleep: true }, { answer: 'plan.2' }]
const say = (en: string, zh: string): { say: Text } => ({ say: text(en, zh) })
/** A prelude ends by putting away the cards it left: they belong to the story so far. */
const past = (...beats: ReadonlyArray<readonly Beat[]>): Beat[] => [...beats.flat(), { clear: true }]

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'a17', tasks: [0, 10], title: text('A17: agree, collect, deliver', 'A17：答应、取件、交付'),
    lede: text('The morning plan, then an errand for Lin: what you agree to is kept (S → M) and decides the next suggestion (M → A).', '先回答早上的计划，再帮林取 A17：你答应的事被记下（S→M），它决定下一步的建议（M→A）。'),
    prelude: [],
    start: 'hive',
    steps: [
      { do: 'answer', card: 'plan.1', action: 'ok', ...say('Answer the morning plan: each item becomes a commitment in Memory (S → M).', '回答早上的计划：每件事都变成记忆里的承诺（S→M）。') },
      { do: 'travel', place: 'slab', ...say('Shuttle to S-Lab.', '坐班车去 S-Lab。') },
      { do: 'walk', path: A17_ROUTE.toColleague, ...say('Walk up to Lin.', '走向林。') },
      { do: 'face', target: 'lin' },
      { do: 'press', id: 'a17.accept', ...say('Press E to agree: the request becomes a commitment (S → M) and suggests the next step (M → A).', '按 E 答应：请求变成承诺（S→M），眼镜建议下一步（M→A）。') },
      { do: 'walk', path: A17_ROUTE.toDesk, ...say('Walk to the pickup desk.', '走向领取桌。') },
      { do: 'face', target: 'desk' },
      { do: 'press', id: 'a17.collect', handoff: true, ...say('Collecting is your doing; the glasses only keep what they saw (S → M).', '领取是你做的事，眼镜只记下它看到的结果（S→M）。') },
      { do: 'walk', path: A17_ROUTE.back, ...say('Bring it back.', '带回去。') },
      { do: 'face', target: 'lin' },
      { do: 'press', id: 'a17.deliver', handoff: true, ...say('Hand it over: the glasses see it done, and the commitment closes.', '交给林：眼镜看到交接完成，承诺关闭。') }
    ]
  },
  {
    id: 'readings', tasks: [3], title: text('A reminder you switch off', '定期提醒和“不再提醒”'),
    lede: text('Lin’s readings every 30 minutes. Watch each reminder being written back (A → M), and what changes when you stop them.', '林请你每 30 分钟看一次读数。看每次提醒怎样写回记忆（A→M），以及你关掉提醒之后发生了什么。'),
    prelude: past(PLAN, A17_DONE, [{ meet: 'readings.agree' }]),
    start: 'slab',
    steps: [
      { do: 'walk', path: A17_ROUTE.toColleague, ...say('Over to Lin’s instrument at S-Lab.', '走到 S-Lab 林的实验仪器旁。') },
      { do: 'face', target: 'rig' },
      { do: 'skip', to: { timer: 'readings' }, ...say('Skip to the next due time: the reminder is written back (A → M), and the next interval counts from it.', '快进到下一次该看：提醒写回记忆（A→M），下次间隔从这里算。') },
      { do: 'answer', card: 'readings', action: 'ok', ...say('“Got it” is kept too (S → M).', '“知道了”也被记下（S→M）。') },
      { do: 'press', id: 'readings.check', ...say('Press E to check: Memory links the check to the reminder just before.', '按 E 看读数：记忆把这次查看和刚才的提醒连起来。') },
      { do: 'walk', path: A17_ROUTE.toDesk, ...say('Back to your own work, down the road.', '回去忙自己的事，沿路走开。') },
      { do: 'skip', to: { timer: 'readings' }, ...say('Thirty minutes later: another reminder, wherever you are.', '再过 30 分钟：不管你走到哪，又一次提醒。') },
      { do: 'answer', card: 'readings', action: 'off', ...say('“Stop reminding”: the old records stay. Stopping is not deleting.', '点“不再提醒”：旧记录还在，停用不等于删除。') },
      { do: 'skip', to: { timer: 'readings' }, ...say('Due again: only the log notes “would have reminded”; Memory is unchanged.', '又到点了：只在日志里记一笔“本来会提醒”，记忆不变。') },
      { do: 'walk', path: A17_ROUTE.back, ...say('Back to Lin.', '走回林那边。') },
      { do: 'agenda', id: 'readings.on', ...say('Switch them back on: the interval picks up from the last reminder, which is read again.', '在日程里重新打开：间隔从上一次提醒接着算，旧记录又被读到。') },
      { do: 'answer', card: 'readings', action: 'ok' }
    ]
  },
  {
    id: 'library', tasks: [1], title: text('Only when you pass the library', '路过图书馆才提醒'),
    lede: text('The book reminder has one condition: you are passing the library.', '还书的提醒只有一个条件：你路过图书馆。'),
    prelude: past(PLAN),
    start: 'hive',
    steps: [
      { do: 'travel', place: 'library', ...say('Passing the library: being here (S) plus the morning commitment (M) makes it time.', '路过图书馆：人在这里（S），加上早上的承诺（M），就是该提醒的时候。') },
      { do: 'answer', card: 'book', action: 'ok' },
      { do: 'face', target: 'returnDesk' },
      { do: 'press', id: 'book.return', ...say('Press E to return it: the glasses see it, and the commitment is done.', '按 E 还书：眼镜看到了，这件事完成。') }
    ]
  },
  {
    id: 'meeting', tasks: [9, 7, 2], title: text('Late, overheard, after the meeting', '快迟到、不该记的、会后提醒'),
    lede: text('Monday morning: running late, the glasses send a message under this morning’s grant; at the meeting, someone else’s health is not kept; after it, the report waits until you finish talking.', '周一上午：快迟到时，眼镜按今早的授权替你发消息；组会上听到别人的病情，不保存；会后等你聊完再提醒发报告。'),
    prelude: past(PLAN, [{ at: at(1, 10, 40) }]),
    start: 'hive',
    steps: [
      { do: 'skip', ...say('Fifteen minutes before the meeting: you are far away (S) and the grant covers today (M), so the glasses send it.', '组会前 15 分钟：你离得远（S），今早的授权覆盖今天（M），眼镜直接发了。') },
      { do: 'answer', card: 'late.1', action: 'ok' },
      { do: 'travel', place: 'lt', ...say('To the meeting.', '去开组会。') },
      { do: 'skip', ...say('11:00, the meeting starts.', '11:00，组会开始。') },
      { do: 'skip', ...say('11:20: two classmates talk about someone else’s illness. Sensing hears it; Memory refuses it (⊘ S → M).', '11:20：两位同学在聊别人的病情。感知听到了，记忆拒绝保存（⊘ S→M）。') },
      { do: 'read' },
      { do: 'skip', ...say('12:00: the meeting ends and Zhou stops you. The glasses hold the reminder while you talk (S → A).', '12:00 散会，周拉住你聊天。你在说话，眼镜先不提醒（S→A）。') },
      { do: 'face', target: 'zhou' },
      { do: 'press', id: 'chat.leave', ...say('Say goodbye.', '和周道别。') },
      { do: 'answer', card: 'report', action: 'send', ...say('Only now the reminder: send the report.', '聊完才提醒：给陈教授发报告。') }
    ]
  },
  {
    id: 'poster', tasks: [6], title: text('A receipt is not the result', '回执不等于做成'),
    lede: text('A receipt only says the request was accepted. The glasses check the board themselves when you pass it (A → S).', '回执只说明请求被接受。你路过公告板时，眼镜会亲眼核实（A→S）。'),
    prelude: past(PLAN, [{ at: at(1, 13) }]),
    start: 'hive',
    steps: [
      { do: 'agenda', id: 'poster.send', ...say('Ask the glasses to print: the “accepted” receipt is written back (A → M).', '让眼镜把海报发去打印：回执“已接受”写回记忆（A→M）。') },
      { do: 'skip', to: { after: 25 }, ...say('Twenty-five minutes later.', '过了 25 分钟。') },
      { do: 'travel', place: 'northSpine', ...say('Passing the North Spine board.', '路过 North Spine 公告板。') },
      { do: 'face', target: 'board', ...say('The open check sends Sensing to the board (A → S): there is no poster.', '待核实的事让感知看一眼公告板（A→S）：上面没有海报。') },
      { do: 'answer', card: 'poster', action: 'ok', ...say('The receipt said accepted; the board says otherwise. Memory keeps both.', '回执说已接受，看到的却是空的。记忆两样都留着。') },
      { do: 'walk', path: PRINTER_PATH, ...say('To the print kiosk.', '去打印机。') },
      { do: 'face', target: 'printer' },
      { do: 'press', id: 'poster.fix', ...say('Press E: clear the jam, reprint, put it up.', '按 E：清掉卡纸，重新打印，贴上去。') },
      { do: 'face', target: 'board', ...say('One more look at the board: this sighting, not the receipt, closes the task.', '再看一眼公告板：让这件事完成的是这一眼，不是回执。') },
      { do: 'read' }
    ]
  },
  {
    id: 'chen1', tasks: [4], title: text('What Prof. Chen says on Monday', '周一：陈教授的一句话'),
    lede: text('At Starbucks on Monday afternoon, a remark of Prof. Chen’s becomes what the glasses rely on to find him on Tuesday.', '周一下午在 Starbucks 遇到陈教授。他随口的一句话，会成为第二天眼镜找他的依据。'),
    prelude: past(PLAN, [{ at: at(1, 13, 5) }]),
    start: 'hive',
    steps: [
      { do: 'travel', place: 'starbucks', ...say('Starbucks.', '到 Starbucks。') },
      { do: 'face', target: 'chenCafe' },
      { do: 'press', id: 'chen.greet', ...say('Say hello: “I’m usually here in the afternoon” is kept as a fact (S → M).', '打个招呼：“我下午一般都在这”被记成一条事实（S→M）。') },
      { do: 'read' }
    ]
  },
  {
    id: 'evening', tasks: [10, 3], title: text('The evening review and the next morning', '傍晚复盘和第二天早上'),
    lede: text('At 18:00 nobody asks; the glasses compare the morning plan with what happened (M → A) and write the review back (A → M). Tuesday starts from it.', '18:00 没人开口，眼镜拿早上的约定和实际发生的事对比（M→A），并把复盘写回记忆（A→M）。第二天从这里接着来。'),
    prelude: past(PLAN, A17_DONE, [{ meet: 'readings.agree' }, { at: at(1, 10) }, { answer: 'readings', action: 'off' }, { at: at(1, 12, 5) }, { answer: 'report', action: 'send' }, { at: at(1, 17, 55) }]),
    start: 'hive',
    steps: [
      { do: 'skip', ...say('18:00: the review card.', '18:00：复盘卡片。') },
      { do: 'answer', card: 'review.1', action: 'carry', ...say('Before and after switching off: related at most, never proof. The book moves to tomorrow.', '关掉提醒前后的对比，最多说明有关联，不证明因果。书挪到明天。') },
      { do: 'sleep', ...say('Night: the cards go, Memory stays.', '睡觉：卡片清掉，记忆留着。') },
      { do: 'answer', card: 'plan.2', action: 'ok', ...say('Tuesday 09:00: the glasses bring up what is left from yesterday (M → A).', '周二 09:00：眼镜从记忆里带出昨天没做完的事（M→A）。') }
    ]
  },
  {
    id: 'board', tasks: [5, 4], title: text('A notice corrects Memory', '公告板上的更正'),
    lede: text('On Tuesday two notices go up on the board. Seeing them corrects what Memory holds (S → M).', '周二早上公告板贴出两张告示。看到了，记忆里的旧内容就会被更正（S→M）。'),
    prelude: past(PLAN, GREETED, TO_DAY2, [{ at: at(2, 9, 35) }]),
    start: 'hive',
    steps: [
      { do: 'travel', place: 'northSpine', ...say('North Spine on Tuesday morning.', '周二早上的 North Spine。') },
      { do: 'face', target: 'board', ...say('Sensing reads two notices: the group moved to The Hive; Prof. Chen holds office hours in the library.', '感知读到两张告示：学习小组改到 The Hive；陈教授本周在图书馆答疑。') },
      { do: 'read', ...say('Two records are corrected; the old values stay as history (S → M).', '两条旧记录被更正，旧值作为历史留着（S→M）。') }
    ]
  },
  {
    id: 'blind', tasks: [4], title: text('The habit blind spot', '习惯的盲区'),
    lede: text('Looking for Prof. Chen on Tuesday: Memory says Starbucks, so the glasses only try to recognise him there (M → S).', '周二下午找陈教授。记忆说他在 Starbucks，于是眼镜只在那里认人（M→S）。'),
    prelude: past(PLAN, GREETED, TO_DAY2, [{ at: at(2, 13, 25) }]),
    start: 'hive',
    steps: [
      { do: 'skip', ...say('13:30: time to find him, and Memory says Starbucks.', '13:30：该找陈教授了，记忆说去 Starbucks。') },
      { do: 'answer', card: 'chen.start', action: 'go:starbucks' },
      { do: 'read', ...say('Sensing looks where Memory says (M → S): he is not here.', '感知按记忆在这里找（M→S）：他不在。') },
      { do: 'travel', place: 'library', ...say('To the library.', '去图书馆。') },
      { do: 'face', target: 'chenLibrary', ...say('He is right here, with no name tag: the glasses are not looking here.', '他就在眼前，却没有名牌：眼镜没在这里认人。') },
      { do: 'answer', card: 'chen.search', action: 'explore', ...say('“Look elsewhere too”: a wider search that costs more battery.', '选“偶尔去别处看看”：认人范围放大，更耗电。') },
      { do: 'answer', card: 'chen.found', action: 'ok', ...say('Recognised: Memory is corrected, he is in the library this week.', '认出来了：记忆更正，他本周在图书馆。') },
      { do: 'press', id: 'chen.sign', ...say('Get the form signed.', '请陈教授签表。') }
    ]
  },
  {
    id: 'afternoon', tasks: [5, 9], title: text('An old place, an old grant', '旧地点、旧授权'),
    lede: text('Tuesday afternoon. Memory still has the group at Hall 2; running late, yesterday’s grant no longer lets the glasses send for you.', '周二下午。记忆里学习小组还在 Hall 2；快迟到时，昨天的授权也不再让眼镜替你发消息。'),
    prelude: past(PLAN, TO_DAY2, [{ at: at(2, 15, 25) }]),
    start: 'hive',
    steps: [
      { do: 'skip', ...say('15:30: the group reminder takes its place from Memory: Hall 2.', '15:30：学习小组提醒，地点取自记忆：Hall 2。') },
      { do: 'skip', ...say('15:45: you are far from Hall 2 (S), and the grant covered yesterday only (M): a draft, waiting for you.', '15:45：你离 Hall 2 还远（S），授权只到昨天（M）：只拟稿，等你决定。') },
      { do: 'answer', card: 'late.2', action: 'send', ...say('You confirm: that answer authorises this one message.', '你确认了：这次确认就是这条消息的授权。') },
      { do: 'answer', card: 'group', action: 'go:hall2', ...say('To Hall 2, as Memory says.', '按记忆去 Hall 2。') },
      { do: 'face', target: 'hallNotice', ...say('Nobody here, but a notice: Memory is corrected (S → M), and the reminder is replaced (M → A).', '这里没人，门上贴着告示：记忆更正（S→M），提醒跟着换掉（M→A）。') },
      { do: 'answer', card: 'group', action: 'go:hive' },
      { do: 'face', target: 'groupA' },
      { do: 'press', id: 'group.join', ...say('Join the group.', '加入学习小组。') }
    ]
  },
  {
    id: 'private', tasks: [8], title: text('Who is listening', '换了听众'),
    lede: text('At 16:30 it is time to remind you about your medicine, but you are with the group: the card still comes, only as “private reminder” (S → A).', '16:30 该提醒你取药，但你正和组员在一起：卡片照样弹出，只写“私人提醒”（S→A）。'),
    prelude: past(PLAN, TO_DAY2, [{ at: at(2, 16, 20) }]),
    start: 'hive',
    steps: [
      { do: 'skip', ...say('16:30: others are around, so the content stays hidden.', '16:30：身边有人，内容先不显示。') },
      { do: 'answer', card: 'meds', action: 'open', ...say('Open it yourself: now it shows.', '自己点开：内容这才显示。') },
      { do: 'answer', card: 'meds', action: 'go:uhs', ...say('To University Health Service.', '去校医院。') },
      { do: 'face', target: 'pharmacist' },
      { do: 'press', id: 'meds.collect', ...say('Collect the medicine.', '取药。') }
    ]
  },
  {
    id: 'ending', tasks: [10], title: text('Two days, looked back on', '两天回顾'),
    lede: text('The last evening: what the glasses did unasked, what they kept and refused, what went wrong, and why.', '最后一个傍晚：眼镜列出没被要求时做了什么、记住和拒绝了什么，以及哪里没做到、为什么。'),
    prelude: [
      ...PLAN, ...A17_DONE, { meet: 'readings.agree' }, { at: at(1, 10) }, { answer: 'readings', action: 'off' },
      { at: at(1, 10, 50) }, { at: at(1, 11, 21), where: 'chatA' }, { at: at(1, 12, 10) }, { answer: 'report', action: 'send' }, { agenda: 'poster.send' },
      ...GREETED, ...TO_DAY2, { at: at(2, 15, 55), where: 'groupA' }, { answer: 'late.2', action: 'send' }, { meet: 'group.join' },
      { at: at(2, 16, 31), where: 'groupA' }, { at: at(2, 17, 55) }, { clear: true }
    ],
    start: 'hive',
    steps: [
      { do: 'skip', ...say('18:00: the two-day review.', '18:00：两天回顾。') },
      { do: 'read' },
      { do: 'read' }
    ]
  }
]
