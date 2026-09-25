/**
 * Three errands that span both campus days, each led by one channel:
 * - task 6, a receipt is not the result (A → S): after printing, Action sends Sensing to the board;
 * - task 5, the meeting place changed (S → M): a notice corrects Memory, and the reminder built on it;
 * - task 4, the habit blind spot (M → S): where Memory says Prof. Chen is decides where Sensing looks.
 * Every rule is authored here; correcting a record changes Memory, never the rules.
 */
import { speak, text, type CardAction, type LoopReader, type ServiceLoop, type Text } from './alwaysOnLoop'
import { at, minutes, timeOf } from './ntuCampusClock'
import { CAST, PLACES, TIMES, distance, nowOf, num, present, type AgendaItem, type CampusStory, type CampusView, type CastId, type PlaceId, type StoryReader } from './ntuCampusWorld'

export const POSTER = 'poster'
export const POSTER_RECEIPT = 'poster.receipt'
export const GROUP = 'group'
export const CHEN = 'chen'
export const CHEN_WHERE = 'chen.where'
export const SEARCH_PREF = 'pref.search'
/** The kiosk should have printed and posted within this; the board is not checked sooner. */
export const PRINT_TIME_MS = minutes(20)
/** How long an empty board stays checked before the glasses look again. */
const RECHECK_MS = minutes(30)
/** Battery drain in percent per campus minute; recognising people everywhere costs extra. */
export const DRAIN = { base: 0.06, wide: 0.12 }
const CHEN_CARDS = ['chen.start', 'chen.search', 'chen.found']
export type Scope = 'starbucks' | 'library' | 'everywhere'
export type ErrandInteraction = 'chen.greet' | 'chen.sign' | 'poster.fix' | 'group.join'
export type ErrandAnswer = boolean | { travel: PlaceId }

const ok = (label = text('Got it', '知道了')): CardAction => ({ id: 'ok', label, primary: true })
const go = (place: PlaceId, primary = true): CardAction => ({ id: `go:${place}`, label: text(`Go to ${PLACES[place].name.en}`, `前往 ${PLACES[place].name.zh}`), ...(primary ? { primary: true } : {}) })
const posterRecord = (value: Text) => ({ id: POSTER, kind: 'commitment' as const, label: text('Print the G-07 poster', '给学习小组打印海报'), value })
const groupRecord = (value: Text) => ({ id: GROUP, kind: 'commitment' as const, label: text('Study group G-07', '学习小组 G-07'), value })
const chenPlaceRecord = (value: Text) => ({ id: CHEN_WHERE, kind: 'fact' as const, label: text('Where Prof. Chen is in the afternoon', '陈教授下午在哪'), value })
const CHEN_LABEL = text('Get the form signed by Prof. Chen', '找陈教授签实习表')
const groupPlace = (read: LoopReader): 'hall2' | 'hive' => (read.recall(GROUP)?.data?.place === 'hive' ? 'hive' : 'hall2')

// ——— Morning plans ———

export const PLAN_DAY1_LINES = [
  text('Print the study group poster · for the North Spine notice board', '给学习小组打印海报 · 贴到 North Spine 公告板'),
  text('Tomorrow 16:00 · study group G-07 at Hall 2', '明天 16:00 · 学习小组 G-07 在 Hall 2')
]
export function answerPlanDay1 (loop: ServiceLoop) {
  loop.remember(POSTER, { ...posterRecord(text('For the North Spine notice board', '贴到 North Spine 公告板')) }, {
    from: 'sensing', note: text('The poster is kept as today’s task.', '打印海报记成今天的一件事。')
  })
  loop.remember(GROUP, { ...groupRecord(text('Tomorrow 16:00 · Hall 2', '明天 16:00 · Hall 2')), data: { place: 'hall2' } }, {
    from: 'sensing', note: text('Tomorrow’s study group is kept with its time and place.', '明天的学习小组连同时间地点一起记下。')
  })
}
/** Day 2: what the errands carry over from Memory, and the one new item you add. */
export function planDay2Lines (read: LoopReader): Text[] {
  const lines: Text[] = []
  if (read.recall(POSTER)?.status === 'active') lines.push(text('The poster is not confirmed on the board yet', '海报还没确认贴上公告板'))
  if (read.recall(GROUP)?.status === 'active') {
    const place = PLACES[groupPlace(read)].name
    lines.push(text(`16:00 study group G-07 · ${place.en}`, `16:00 学习小组 G-07 · ${place.zh}`))
  }
  lines.push(text('Added today: get the internship form signed by Prof. Chen this afternoon', '今天新加：下午找陈教授签实习表'))
  return lines
}
export function answerPlanDay2 (loop: ServiceLoop) {
  if (loop.recall(CHEN)) return
  loop.remember(CHEN, { id: CHEN, kind: 'commitment', label: CHEN_LABEL, value: text('This afternoon, during his office hours', '今天下午，他答疑的时候') }, {
    from: 'sensing', note: text('You add today’s new item: find Prof. Chen for a signature.', '你加了今天的新事项：找陈教授签表。')
  })
}

// ——— Task 6: a receipt is not the result ———

export function sendPoster (loop: ServiceLoop, story: CampusStory): boolean {
  if (story.world.posterSent) return false
  const now = loop.now()
  story.world.posterSent = now
  // In this story the kiosk jams on the print. Only the board can show it.
  story.world.posterJammed = true
  if (!loop.recall(POSTER)) {
    loop.remember(POSTER, posterRecord(text('For the North Spine notice board', '贴到 North Spine 公告板')), {
      from: 'sensing', note: text('You asked for the poster to be printed; the task is kept.', '你要打印海报，这件事被记下。')
    })
  }
  loop.act(POSTER, { kind: 'execute', label: text('Send the poster to print', '把海报发去打印') }, {
    uses: ['sensing', 'memory'], reads: [POSTER],
    note: text('You asked (S); the glasses send the poster in Memory (M) to the North Spine print kiosk.', '你开口了（S），眼镜把记忆里的海报（M）发到 North Spine 的自助打印机。')
  })
  const code = 1400 + Math.floor(now / 60_000) % 600
  loop.remember(POSTER, {
    id: POSTER_RECEIPT, kind: 'receipt', label: text('Print receipt', '打印回执'), data: { at: now, verifyAfter: now + PRINT_TIME_MS },
    value: text(`Accepted · #P-${code} · ${timeOf(now)} · to check on the board`, `已接受 · #P-${code} · ${timeOf(now)} · 待在公告板上核实`)
  }, {
    from: 'action', note: text('The kiosk answers “accepted”. Action writes the receipt back and leaves one thing open: check the board when you pass it.', '打印机回了“已接受”。行动把回执写回记忆，留下一件待核实的事：你路过公告板时看一眼。')
  })
  return true
}
function fixPrinter (loop: ServiceLoop, story: CampusStory) {
  story.world.posterJammed = false
  story.world.posterPosted = loop.now()
  loop.observe(POSTER, { id: 'printer.state', anchor: 'printer', label: text('Print kiosk', '自助打印机'), value: text('Jam cleared · poster printed and put up', '卡纸已清 · 海报打出来，贴上了公告板') }, {
    note: text('You clear the jam and put the fresh poster up. Sensing sees the kiosk working again.', '你清掉卡纸，把打出来的海报贴上了公告板。感知看到打印机恢复了。')
  })
  loop.dismiss(POSTER)
}
/** A → S: the open check sends Sensing to the board. What it sees, not the receipt, decides. */
function posterRules (loop: ServiceLoop, story: CampusStory, view: CampusView) {
  const poster = loop.recall(POSTER)
  const receipt = loop.recall(POSTER_RECEIPT)
  if (poster?.status !== 'active' || !receipt || !view.sees.board || loop.now() < num(receipt.data?.verifyAfter)) return
  const up = Boolean(story.world.posterPosted)
  const now = loop.now()
  // An empty board is looked at again only after a while; a reposted one on the next look.
  const checked = story.marks['poster.checked']
  if (up ? loop.evidence('board.poster')?.data?.up === true : checked !== undefined && now - checked < RECHECK_MS) return
  story.marks['poster.checked'] = now
  loop.observe(POSTER, { id: 'board.poster', anchor: 'board', label: text('Notice board', '公告板'), value: up ? text('The G-07 poster is up', 'G-07 的海报贴上了') : text('No G-07 poster', '没有 G-07 的海报'), data: { up } }, {
    guidedBy: 'action',
    note: up ? text('The open check sends Sensing to the board again: now the poster is there.', '待核实的事让感知再看一眼公告板：海报已经在上面了。')
      : text('The receipt left a check open, so Sensing looks at the board: there is no poster.', '回执留下一件待核实的事，于是感知看了一眼公告板：上面没有海报。')
  })
  if (up) {
    loop.remember(POSTER, { ...posterRecord(text(`On the board · seen ${timeOf(now)}`, `已贴上 · ${timeOf(now)} 亲眼看到`)), status: 'done', data: { seen: now } }, {
      from: 'sensing', note: text('This sighting, not the receipt, closes the task.', '让这件事完成的是这一眼，不是回执。')
    })
    loop.dismiss(POSTER)
    loop.release(POSTER)
    return
  }
  if (poster.data?.missing) return
  loop.remember(POSTER, { ...posterRecord(text('Receipt says accepted, but the board is empty · maybe a jam', '回执说已接受，公告板上却没有 · 可能卡纸了')), data: { missing: true } }, {
    from: 'sensing', note: text('What Sensing saw and the receipt disagree, and Memory keeps both: accepted is not done.', '看到的和回执对不上，记忆两样都留着：被接受不等于做成。')
  })
  speak(loop, POSTER, { kind: 'remind', label: text('Tell you the poster is not up', '告诉你海报没贴上') }, {
    uses: ['sensing', 'memory'], reads: [POSTER, POSTER_RECEIPT],
    note: text('The fresh look (S) contradicts the receipt in Memory (M), so the glasses speak up.', '眼前看到的（S）和记忆里的回执（M）对不上，眼镜主动告诉你。'),
    card: {
      id: POSTER, kind: 'reminder', basis: POSTER_RECEIPT, title: text('The poster is not on the board', '公告板上没有海报'),
      why: text(`You are at the board, and the receipt said “accepted” at ${timeOf(num(receipt.data?.at))}. The paper may have jammed.`, `你正路过公告板，打印回执 ${timeOf(num(receipt.data?.at))} 说“已接受”。可能卡纸了。`),
      lines: [text('A receipt says the request was accepted, not that the poster is up.', '回执只说明请求被接受，不说明海报已经贴上。')],
      actions: [ok(text('I’ll check the printer', '我去看看打印机'))]
    }
  })
}

// ——— Task 5: the meeting place changed ———

/** S → M correction. The old place stays in the record as history. Returns whether Memory changed. */
function correctGroup (loop: ServiceLoop, source: 'board' | 'door'): boolean {
  const group = loop.recall(GROUP)
  if (group?.status !== 'active' || group.data?.place === 'hive') return false
  const now = loop.now()
  const where = source === 'board' ? text('the notice board', '公告板') : text('the notice on the Hall 2 door', 'Hall 2 门上的告示')
  loop.remember(GROUP, { ...groupRecord(text(`Today 16:00 · The Hive (was Hall 2; corrected at ${timeOf(now)} after seeing ${where.en})`, `今天 16:00 · The Hive（原为 Hall 2；${timeOf(now)} 看到${where.zh}后更正）`)), data: { place: 'hive', was: 'hall2', source } }, {
    from: 'sensing', note: text('The notice corrects Memory: Hall 2 becomes The Hive, and the old place is kept as history.', '告示更正了记忆：Hall 2 换成 The Hive，旧地点作为历史留在记录里。')
  })
  return true
}
function groupCard (loop: ServiceLoop, reason: 'due' | 'corrected' | 'door') {
  const place = groupPlace(loop)
  const { name } = PLACES[place]
  const corrected = reason !== 'due'
  return speak(loop, GROUP, { kind: 'remind', label: corrected ? text('Replace the study group reminder', '换掉学习小组的提醒') : text('Remind: study group at 16:00', '提醒：16:00 学习小组') }, {
    uses: reason === 'door' ? ['sensing', 'memory'] : 'memory', reads: [GROUP],
    note: corrected ? text('Memory was corrected, so a reminder built on the old place is replaced as well.', '记忆更正了，建立在旧地点上的提醒也跟着换掉。')
      : text('Half an hour before the group; the place comes from Memory.', '离学习小组还有半小时，地点取自记忆。'),
    card: {
      id: GROUP, kind: 'reminder', basis: GROUP,
      title: corrected ? text('The study group moved to The Hive', '学习小组改到 The Hive 了') : text(`Study group G-07 · 16:00 · ${name.en}`, `学习小组 G-07 · 16:00 · ${name.zh}`),
      why: reason === 'door' ? text('You are at Hall 2: nobody is here, and a notice on the door says so.', '你在 Hall 2：这里没人，门上的告示写着改地点了。')
        : reason === 'corrected' ? text('A new notice on the board corrected the place in Memory.', '公告板上的新告示更正了记忆里的地点。')
          : text('It starts in half an hour.', '还有半小时开始。'),
      actions: [go(place), { id: 'ok', label: text('Got it', '知道了') }]
    }
  })
}
function readDoor (loop: ServiceLoop, story: CampusStory, view: CampusView) {
  if (!present(story, 'hallNotice') || !view.sees.hallNotice || story.marks['door.notice']) return
  story.marks['door.notice'] = loop.now()
  loop.observe(GROUP, { id: 'door.notice', anchor: 'hallNotice', label: text('Notice on the Hall 2 door', 'Hall 2 门上的告示'), value: text('G-07 moves to The Hive today', 'G-07 今天改到 The Hive') }, {
    note: text('Nobody is here, but there is a notice on the door.', '这里一个人也没有，门上贴着一张告示。')
  })
  if (correctGroup(loop, 'door')) groupCard(loop, 'door')
}
function groupRules (loop: ServiceLoop, story: CampusStory, view: CampusView) {
  readDoor(loop, story, view)
  const now = loop.now()
  if (loop.recall(GROUP)?.status !== 'active' || now < TIMES.groupReminder || now >= TIMES.groupEnd || story.marks['group.remind'] || loop.showing(GROUP)) return
  if (groupCard(loop, 'due')) story.marks['group.remind'] = now
}
function joinGroup (loop: ServiceLoop, story: CampusStory) {
  const now = loop.now()
  story.world.groupJoined = now
  const group = loop.recall(GROUP)
  const remembered = group?.data?.place
  const was = group?.data?.was ?? (remembered === 'hall2' ? 'hall2' : undefined)
  loop.remember(GROUP, { ...groupRecord(text(`Met at The Hive · ${timeOf(now)}`, `${timeOf(now)} 在 The Hive 碰头了`)), status: 'done', data: { place: 'hive', ...(was ? { was } : {}) } }, {
    from: 'sensing', note: remembered === 'hall2' ? text('You found the group at The Hive. Memory still said Hall 2; this sighting corrects it and closes the item.', '你在 The Hive 找到了小组。记忆里还是 Hall 2，这一眼更正了它，也让这件事完成。')
      : text('The glasses see you join the group, so the item is done.', '眼镜看到你加入了学习小组，这件事完成了。')
  })
  loop.dismiss(GROUP)
  loop.release(GROUP)
}

// ——— Task 4: the habit blind spot ———

/** Where Sensing tries to recognise Prof. Chen, decided by Memory (M → S). Without a prior it has to look everywhere. */
export function searchScope (read: LoopReader): Scope {
  if (read.recall(SEARCH_PREF)?.data?.mode === 'explore') return 'everywhere'
  const place = read.recall(CHEN_WHERE)?.data?.place
  return place === 'starbucks' || place === 'library' ? place : 'everywhere'
}
export const searching = (read: LoopReader, story: CampusStory) => story.clock.day === 2 && nowOf(story) >= TIMES.chenSearch && nowOf(story) < TIMES.chenOfficeUntil && read.recall(CHEN)?.status === 'active'
/** On day 2 the glasses know Prof. Chen by sight only once Memory places him in the library. */
export const chenRecognised = (read: LoopReader, story: CampusStory) => story.clock.day === 1 || read.recall(CHEN_WHERE)?.data?.place === 'library'
const SCOPE_TEXT: Record<Scope, Text> = {
  starbucks: text('Only around Starbucks · saves battery', '只在 Starbucks 附近认人 · 省电'),
  library: text('Around the library · saves battery', '在图书馆附近认人 · 省电'),
  everywhere: text('Everyone on the way · uses more battery', '沿途都认人 · 更耗电')
}
function scopeNote (scope: Scope, read: LoopReader): Text {
  if (read.recall(SEARCH_PREF)?.data?.mode === 'explore') return text('Your preference in Memory widens the search: Sensing now tries to recognise him wherever you go. It costs more battery.', '记忆里你选的“偶尔去别处看看”放大了范围：走到哪里都去认人，更耗电。')
  if (scope === 'starbucks') return text('Memory says he spends afternoons at Starbucks, so Sensing only tries to recognise him there. It saves battery.', '记忆说他下午在 Starbucks，感知只在那附近认人，省电。')
  if (scope === 'library') return text('Memory now places him in the library, so that is where Sensing looks.', '记忆里他现在在图书馆，感知就到那里去认人。')
  return text('Memory holds no place for him, so Sensing has to look at everyone on the way. It costs more battery.', '记忆里不知道他会在哪，感知只好沿途每个人都认一认，更耗电。')
}
function startCard (loop: ServiceLoop) {
  const where = loop.recall(CHEN_WHERE)?.data?.place
  const place = where === 'starbucks' || where === 'library' ? where : undefined
  return speak(loop, CHEN, { kind: 'remind', label: text('Remind: find Prof. Chen', '提醒：去找陈教授') }, {
    uses: 'memory', reads: [CHEN, CHEN_WHERE],
    note: text('His office hours have started; Memory holds the errand and, perhaps, where he will be.', '他的答疑时间到了。记忆里有这件事，也许还有他会在哪。'),
    card: {
      id: 'chen.start', kind: 'reminder', basis: place ? CHEN_WHERE : CHEN, title: text('Time to get the form signed', '该去找陈教授签表了'),
      why: place === 'library' ? text('The notice board says he holds office hours in the library this week.', '公告板说他本周在图书馆答疑。')
        : place === 'starbucks' ? text('From Memory: he is usually at Starbucks in the afternoon.', '按记忆，他下午一般在 Starbucks。')
          : text('He is free this afternoon; Memory does not say where he will be.', '他下午有空；记忆里没有他会在哪。'),
      actions: place ? [go(place), { id: 'ok', label: text('Got it', '知道了') }] : [ok()]
    }
  })
}
function missingCard (loop: ServiceLoop, scope: Scope, atCafe: boolean) {
  return speak(loop, CHEN, { kind: 'remind', label: text('Say he has not been seen', '告诉你还没看到陈教授') }, {
    uses: atCafe ? ['sensing', 'memory'] : 'memory', reads: [CHEN, CHEN_WHERE],
    note: atCafe ? text('Sensing looked where Memory said (S), and he is not there (M says he should be).', '感知按记忆找过了（S），他不在记忆说的地方（M）。')
      : text('An hour into his office hours he has not been recognised anywhere Sensing looked.', '答疑已经过了一个小时，感知找过的地方都没认出他。'),
    card: {
      id: 'chen.search', kind: 'reminder', basis: CHEN_WHERE, title: text('Prof. Chen has not been seen', '还没看到陈教授'),
      why: atCafe ? text('From Memory he is at Starbucks in the afternoon, but he is not around here.', '按记忆他下午在 Starbucks，但这附近没有他。')
        : text('His office hours began an hour ago; so far the glasses only looked around Starbucks.', '他的答疑已经开始一个小时了；眼镜目前只在 Starbucks 附近找过。'),
      actions: scope === 'starbucks'
        ? [{ id: 'explore', label: text('Look elsewhere too (more battery)', '偶尔去别处看看（更耗电）'), primary: true }, { id: 'stay', label: text('Keep to the usual place', '继续只在老地方找') }]
        : [ok()]
    }
  })
}
function correctChen (loop: ServiceLoop, source: 'board' | 'seen' | 'you'): boolean {
  const where = loop.recall(CHEN_WHERE)
  if (where?.data?.place === 'library') return false
  const now = loop.now()
  const was = where?.data?.place === 'starbucks'
  const how = source === 'board' ? text('notice board', '公告板') : source === 'seen' ? text('recognised there', '亲眼认出') : text('you recognised him', '你当面认出')
  loop.remember(CHEN, { ...chenPlaceRecord(text(`In the library this week (${how.en}, ${timeOf(now)})${was ? '; was: Starbucks' : ''}`, `本周在图书馆答疑（${how.zh}，${timeOf(now)}）${was ? '；原以为在 Starbucks' : ''}`)), data: { place: 'library', source, ...(was ? { was: 'starbucks' } : {}) } }, {
    from: 'sensing', note: source === 'you' ? text('Memory is corrected, but it was you who found him, not the glasses.', '记忆更正了。不过找到他的是你，不是眼镜。')
      : text('Memory is corrected: this week he is in the library, not at Starbucks.', '记忆更正：他本周在图书馆，不在 Starbucks。')
  })
  return true
}
function chenRules (loop: ServiceLoop, story: CampusStory, view: CampusView) {
  if (!searching(loop, story)) {
    loop.drop('chen.focus')
    return
  }
  const now = loop.now()
  const scope = searchScope(loop)
  if (loop.evidence('chen.focus')?.data?.scope !== scope) {
    loop.observe(CHEN, { id: 'chen.focus', label: text('Looking for Prof. Chen', '找陈教授'), value: SCOPE_TEXT[scope], data: { scope } }, { guidedBy: 'memory', note: scopeNote(scope, loop) })
  }
  if (!story.marks['chen.start'] && startCard(loop)) story.marks['chen.start'] = now
  const inLibrary = present(story, 'chenLibrary')
  if (inLibrary && view.sees.chenLibrary && scope !== 'starbucks' && !story.marks['chen.found']) {
    story.marks['chen.found'] = now
    loop.observe(CHEN, { id: 'chen.seen', anchor: 'chenLibrary', label: text('Prof. Chen', '陈教授'), value: text('Here, in the library', '就在图书馆') }, {
      guidedBy: 'memory', note: scope === 'library' ? text('Memory says the library, so Sensing looks here and recognises him.', '记忆说在图书馆，感知就在这里找，认出了他。')
        : text('Recognising everyone on the way, Sensing spots him in the library.', '沿途都在认人，感知在图书馆认出了他。')
    })
    correctChen(loop, 'seen')
    loop.dismiss('chen.search')
    speak(loop, CHEN, { kind: 'notify', label: text('Point out Prof. Chen', '告诉你陈教授在这') }, {
      uses: ['sensing', 'memory'], reads: [CHEN, CHEN_WHERE],
      note: text('He is in view (S) and the errand is open (M), so the glasses point him out.', '他就在眼前（S），事情还没办（M），眼镜告诉你。'),
      card: { id: 'chen.found', kind: 'message', basis: CHEN, title: text('Prof. Chen is right here', '陈教授就在这里'), why: text('You are in the library and the glasses recognised him.', '你在图书馆，眼镜认出了他。'), actions: [ok()] }
    })
  }
  // The blind spot: he stands right here, but Sensing is not looking here.
  if (inLibrary && scope === 'starbucks' && distance(view.at, CAST.chenLibrary.at) <= 8 && !story.marks['chen.blind']) {
    story.marks['chen.blind'] = now
    loop.observe(CHEN, { id: 'chen.blind', anchor: 'place:library', label: text('Looking for Prof. Chen', '找陈教授'), value: text('Not here · only around Starbucks', '这里不认人 · 只在 Starbucks 附近找') }, {
      guidedBy: 'memory', note: text('Memory says he spends afternoons at Starbucks, so Sensing only tries to recognise him there. Nobody here is checked.', '记忆说他下午在 Starbucks，感知只在那里认人。这里的人，一个都没去认。')
    })
  }
  if (story.marks['chen.found'] || story.marks['chen.missing']) return
  const atCafe = scope === 'starbucks' && distance(view.at, PLACES.starbucks.at) <= 25
  if (!atCafe && now < TIMES.chenStillMissing) return
  if (atCafe) {
    loop.observe(CHEN, { id: 'chen.cafe', anchor: 'place:starbucks', label: text('Starbucks', 'Starbucks'), value: text('No Prof. Chen around', '附近没有陈教授') }, {
      guidedBy: 'memory', note: text('Sensing looks where Memory says he would be: he is not here.', '感知按记忆在这里找：他不在。')
    })
  }
  if (missingCard(loop, scope, atCafe)) story.marks['chen.missing'] = now
}
function greetChen (loop: ServiceLoop, story: CampusStory) {
  story.marks['chen.greeted'] = loop.now()
  loop.remember(CHEN, { ...chenPlaceRecord(text('Usually at Starbucks (he said so)', '一般在 Starbucks（他自己说的）')), data: { place: 'starbucks', source: 'said' } }, {
    from: 'sensing', note: text('Prof. Chen says he is usually here in the afternoon. Memory keeps it as a fact about him.', '陈教授说他下午一般都在这。记忆把它记成一条关于他的事实。')
  })
}
function meetChen (loop: ServiceLoop, story: CampusStory) {
  if (!chenRecognised(loop, story)) {
    loop.observe(CHEN, { id: 'chen.seen', anchor: 'chenLibrary', label: text('Prof. Chen', '陈教授'), value: text('Here, in the library (you recognised him)', '就在图书馆（你认出来的）') }, {
      note: text('You say hello, and it is Prof. Chen. Sensing learns who he is from the conversation.', '你上前打招呼，对方是陈教授。感知从对话里知道了他是谁。')
    })
    correctChen(loop, 'you')
    story.marks['chen.byYou'] = loop.now()
  }
  if (loop.recall(CHEN)?.status !== 'active') return
  const now = loop.now()
  story.world.chenSigned = now
  loop.remember(CHEN, { id: CHEN, kind: 'commitment', label: CHEN_LABEL, value: text(`Signed · ${timeOf(now)}`, `签好了 · ${timeOf(now)}`), status: 'done' }, {
    from: 'sensing', note: text('The glasses see him sign the form, so the errand is done.', '眼镜看到陈教授签了表，这件事完成了。')
  })
  for (const id of CHEN_CARDS) loop.dismiss(id)
  loop.drop('chen.focus')
}

// ——— Hooks the story calls ———

export function tickErrands (loop: ServiceLoop, story: CampusStory, view: CampusView) {
  drainBattery(loop, story)
  posterRules(loop, story, view)
  // Day 2: new notices on the board correct two things Memory holds.
  if (story.clock.day === 2 && loop.now() >= TIMES.noticesUp && view.sees.board && !story.marks['board.notices']) {
    story.marks['board.notices'] = loop.now()
    loop.observe(GROUP, { id: 'board.notices', anchor: 'board', label: text('New notices', '新告示'), value: text('G-07 moves to The Hive today · Prof. Chen: office hours in the library this week', 'G-07 今天改到 The Hive · 陈教授本周改在图书馆答疑') }, {
      note: text('Sensing reads two new notices on the board.', '感知读到公告板上两张新告示。')
    })
    if (correctGroup(loop, 'board') && loop.showing(GROUP)) groupCard(loop, 'corrected')
    correctChen(loop, 'board')
    // A search card built on the old place no longer applies.
    loop.dismiss('chen.search')
  }
  chenRules(loop, story, view)
  groupRules(loop, story, view)
}
function drainBattery (loop: ServiceLoop, story: CampusStory) {
  const now = loop.now()
  const last = story.marks['battery.at'] ?? now
  if (now > last) {
    // A skipped stretch is charged piecewise: the wide search costs extra only inside its window.
    const wide = story.clock.day === 2 && loop.recall(CHEN)?.status === 'active' && searchScope(loop) === 'everywhere'
    const overlap = wide ? Math.max(0, Math.min(now, TIMES.chenOfficeUntil) - Math.max(last, TIMES.chenSearch)) : 0
    const used = ((now - last) * DRAIN.base + overlap * DRAIN.wide) / 60_000
    story.world.battery = Math.max(3, Math.round((story.world.battery - used) * 100) / 100)
  }
  if (story.marks['battery.at'] !== now) story.marks['battery.at'] = now
}
/** Night: the glasses charge. */
export function chargeOvernight (story: CampusStory) {
  story.world.battery = 100
  story.marks['battery.at'] = at(story.clock.day, 9)
}

/**
 * `unmarked` targets are ones the glasses do not know to point at: no pin and no guidance,
 * though you can still act on them once they are within reach.
 */
type ErrandTarget = { id: ErrandInteraction, target: CastId, action: Text, name?: Text, unmarked?: true }
export function errandInteractions (read: LoopReader, story: CampusStory): ErrandTarget[] {
  const list: ErrandTarget[] = []
  if (story.clock.day === 1 && !story.marks['chen.greeted']) list.push({ id: 'chen.greet', target: 'chenCafe', action: text('Say hello to Prof. Chen', '和陈教授打个招呼') })
  if (story.clock.day === 2 && !story.world.chenSigned) {
    const known = chenRecognised(read, story)
    const errand = read.recall(CHEN)?.status === 'active'
    if (errand || !known) {
      list.push({
        id: 'chen.sign', target: 'chenLibrary', ...(known ? {} : { name: text('A lecturer', '一位老师'), unmarked: true }),
        action: errand && known ? text('Ask Prof. Chen to sign the form', '请陈教授签实习表') : text('Say hello', '上前打招呼')
      })
    }
  }
  if (story.world.posterJammed && story.world.posterSent) {
    // Until the board check finds the poster missing, the glasses have no reason to send you to the kiosk.
    const known = Boolean(read.recall(POSTER)?.data?.missing)
    list.push({ id: 'poster.fix', target: 'printer', action: text('Clear the jam and reprint', '清掉卡纸，重新打印'), ...(known ? {} : { unmarked: true }) })
  }
  if (story.clock.day === 2 && !story.world.groupJoined) list.push({ id: 'group.join', target: 'groupA', action: text('Join the study group', '加入学习小组') })
  return list
}
export function errandInteract (loop: ServiceLoop, story: CampusStory, id: ErrandInteraction) {
  switch (id) {
    case 'chen.greet': {
      greetChen(loop, story)
      break
    }
    case 'chen.sign': {
      meetChen(loop, story)
      break
    }
    case 'poster.fix': {
      fixPrinter(loop, story)
      break
    }
    default: joinGroup(loop, story)
  }
}

/** Returns undefined for cards the errands do not own. */
export function answerErrand (loop: ServiceLoop, cardId: string, answer: string): ErrandAnswer | undefined {
  if (![POSTER, GROUP, ...CHEN_CARDS].includes(cardId)) return
  if (!loop.dismiss(cardId)) return false
  if (answer.startsWith('go:') && answer.slice(3) in PLACES) return { travel: answer.slice(3) as PlaceId }
  if (cardId === 'chen.search' && (answer === 'explore' || answer === 'stay')) {
    const explore = answer === 'explore'
    loop.remember(CHEN, {
      id: SEARCH_PREF, kind: 'preference', label: text('How to look for people', '找人的方式'), data: { mode: explore ? 'explore' : 'habit' },
      value: explore ? text('Look elsewhere too · uses more battery', '偶尔去别处看看 · 更耗电') : text('Keep to the usual place · saves battery', '只在老地方找 · 省电')
    }, {
      from: 'sensing', note: explore ? text('You tell the glasses to look elsewhere too. The choice is kept as a preference, and it widens where Sensing looks.', '你让眼镜偶尔去别处看看。这个选择记成偏好，感知找人的范围随之放大。')
        : text('You keep the usual place. The choice is kept as a preference.', '你让眼镜继续只在老地方找。这个选择记成偏好。')
    })
  }
  return true
}

export function errandEvents (read: StoryReader, story: CampusStory): Array<[number, Text]> {
  if (story.clock.day === 1) return story.marks['chen.greeted'] ? [] : [[TIMES.chenCafeFrom, text('Prof. Chen at Starbucks', '陈教授在 Starbucks')]]
  const events: Array<[number, Text]> = []
  if (read.recall(CHEN)?.status === 'active') {
    events.push([TIMES.chenSearch, text('Office hours: find Prof. Chen', '陈教授答疑：去找他')])
    if (!story.marks['chen.found']) events.push([TIMES.chenStillMissing, text('Still looking for Prof. Chen', '还在找陈教授')])
  }
  if (read.recall(GROUP)?.status === 'active') events.push([TIMES.groupReminder, text('Study group reminder', '学习小组提醒')], [TIMES.groupStart, text('Study group starts', '学习小组开始')], [TIMES.groupEnd, text('Study group ends', '学习小组结束')])
  return events
}

export function errandAgenda (read: StoryReader, story: CampusStory): AgendaItem[] {
  const items: AgendaItem[] = []
  const now = nowOf(story)
  const { day } = story.clock
  const poster = read.recall(POSTER)
  if (day === 1 || poster?.status === 'active') {
    const { posterSent, posterPosted } = story.world
    const done = poster?.status === 'done'
    items.push({
      id: 'poster', title: text('Print the G-07 poster', '打印学习小组海报'), place: 'northSpine', state: done ? 'done' : 'todo',
      detail: done ? text('On the board', '已贴上公告板') : posterSent ? posterPosted ? text('Reprinted · look at the board', '重新打印了 · 看一眼公告板') : poster?.data?.missing ? text('Not on the board · check the printer', '公告板上没有 · 去打印机看看') : text('Sent · to check on the board', '已发去打印 · 待在公告板上核实')
        : text('North Spine notice board', 'North Spine 公告板'),
      ...(posterSent ? {} : { action: { id: 'poster.send' as const, label: text('Ask the glasses to print', '让眼镜发去打印') } })
    })
  }
  if (day === 1) {
    items.push({
      id: 'chen1', title: text('Say hello to Prof. Chen', '见陈教授'), place: 'starbucks', state: story.marks['chen.greeted'] ? 'done' : now >= TIMES.chenCafeUntil ? 'missed' : 'todo',
      detail: now < TIMES.chenCafeFrom ? text('This afternoon · Starbucks', '下午 · Starbucks') : text('He is at Starbucks this afternoon', '他下午在 Starbucks')
    })
  }
  const chen = read.recall(CHEN)
  if (day === 2 && chen) {
    items.push({
      id: 'chen2', title: text('Form signed by Prof. Chen', '找陈教授签实习表'), state: chen.status === 'done' ? 'done' : now >= TIMES.chenOfficeUntil ? 'missed' : now >= TIMES.chenOfficeFrom ? 'now' : 'todo',
      detail: chen.status === 'done' ? chen.value : text('Office hours 13:00–17:00', '答疑 13:00–17:00')
    })
  }
  const group = read.recall(GROUP)
  if (day === 2 && group) {
    const place = groupPlace(read)
    items.push({
      id: 'group', title: text('Study group G-07 · 16:00', '学习小组 G-07 · 16:00'), place, state: group.status === 'done' ? 'done' : now >= TIMES.groupEnd ? 'missed' : now >= TIMES.groupStart ? 'now' : 'todo',
      detail: group.status === 'done' ? group.value : group.data?.was ? text(`${PLACES[place].name.en} (corrected, was Hall 2)`, `${PLACES[place].name.zh}（已更正，原为 Hall 2）`) : PLACES[place].name
    })
  }
  return items
}

/** Day 1 review: the poster, and what tomorrow already holds. */
export function errandReview (read: StoryReader): { lines: Text[], reads: string[] } {
  const lines: Text[] = []
  const poster = read.recall(POSTER)
  if (poster?.status === 'active' && read.recall(POSTER_RECEIPT)) {
    lines.push(poster.data?.missing
      ? text('Poster: the receipt said accepted, but the board was empty (maybe a jam)', '海报：回执说已接受，公告板上却没有（可能卡纸）')
      : text('Poster: only a receipt so far; nobody has seen it on the board', '海报：只有回执，还没在公告板上亲眼看到'))
  }
  const group = read.recall(GROUP)
  if (group?.status === 'active') lines.push(text(`Tomorrow: 16:00 study group G-07 at ${PLACES[groupPlace(read)].name.en}`, `明天：16:00 学习小组 G-07，在 ${PLACES[groupPlace(read)].name.zh}`))
  return { lines, reads: [POSTER, POSTER_RECEIPT, GROUP] }
}
/** The ending: what the errands show about where the glasses went wrong, and why. */
export function errandEnding (read: StoryReader, story: CampusStory): Text[] {
  const lines: Text[] = []
  const where = read.recall(CHEN_WHERE)
  const chen = read.recall(CHEN)
  if (chen) {
    if (story.marks['chen.byYou']) { lines.push(text('Prof. Chen: you recognised him in the library yourself; I was only looking around Starbucks, from an old habit in Memory.', '陈教授：是你自己在图书馆认出他的。我按记忆里的旧习惯，只在 Starbucks 附近认人。')) } else if (story.marks['chen.found']) { lines.push(where?.data?.source === 'board' ? text('Prof. Chen: the notice board corrected my memory, so I looked in the library and found him.', '陈教授：公告板更正了我的记忆，我到图书馆去找，找到了他。') : text('Prof. Chen: once you let me look elsewhere, I recognised him in the library, not at Starbucks.', '陈教授：你让我去别处看看之后，我在图书馆认出了他，不在 Starbucks。')) } else if (chen.status === 'active') {
      lines.push(where?.data?.place === 'starbucks'
        ? text('Missed: Prof. Chen was not found. I kept looking where Memory said, Starbucks; this week he was in the library.', '没做到：没找到陈教授。我一直按记忆在 Starbucks 找，他这周在图书馆。')
        : text('Missed: Prof. Chen was not found. With no place for him in Memory I looked at everyone on the way, but we never passed the library.', '没做到：没找到陈教授。记忆里没有他会在哪，我沿途都在认人，但我们一直没经过图书馆。'))
    }
  }
  const group = read.recall(GROUP)
  if (group?.status === 'done') {
    if (group.data?.was) lines.push(text('Study group: Memory said Hall 2 until a notice corrected it to The Hive.', '学习小组：记忆里一直是 Hall 2，直到看到告示才改成 The Hive。'))
  } else if (group) { lines.push(text(`Missed: the study group. Memory still said ${PLACES[groupPlace(read)].name.en}.`, `没做到：学习小组没赶上，记忆里还是 ${PLACES[groupPlace(read)].name.zh}。`)) }
  if (read.recall(POSTER)?.status === 'active' && read.recall(POSTER_RECEIPT)) lines.push(text('Missed: the poster never made it onto the board; the receipt only ever said “accepted”.', '没做到：海报一直没贴上公告板，回执只说过“已接受”。'))
  return lines
}

export function errandSays (read: LoopReader, story: CampusStory, id: CastId): Text | undefined {
  if (id === 'chenCafe') return story.marks['chen.greeted'] ? text('I’m usually here in the afternoon.', '我下午一般都在这，有事来这找我。') : text('Hello! Have a seat?', '你好！坐坐吧？')
  if (id === 'chenLibrary') return story.world.chenSigned ? text('All signed. Good luck!', '签好了，加油。') : text('Questions? Come over.', '有问题可以过来问。')
  if (id === 'groupA') return story.world.groupJoined ? text('Right, let’s start.', '好，开始吧。') : text('Over here! We moved to The Hive.', '这边！今天改在 The Hive 了。')
  if (id === 'groupB') return read.recall(POSTER)?.status === 'done' ? text('Saw the poster, nice.', '海报看到了，不错。') : undefined
}
/** What props show: the board's notices, the kiosk's status and the door notice. */
export function errandDisplays (story: CampusStory): Partial<Record<CastId, string[]>> {
  const notices = story.clock.day === 2 && nowOf(story) >= TIMES.noticesUp
  return {
    board: [
      'NORTH SPINE · 公告',
      '· Career fair · 就业展 Thu',
      ...(story.world.posterPosted ? ['· G-07 study group · 学习小组海报'] : []),
      ...(notices ? ['· G-07 → The Hive today 今天改地点', '· Prof. Chen: office hours in the library 本周图书馆答疑'] : [])
    ],
    printer: ['PRINT', story.world.posterJammed ? 'JAM 卡纸' : 'READY'],
    hallNotice: ['G-07', '→ The Hive', '今天改地点']
  }
}
