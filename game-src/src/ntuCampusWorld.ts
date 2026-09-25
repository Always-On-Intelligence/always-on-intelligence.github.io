/**
 * The campus world of the two-day story: places, cast, timetable and the story state.
 * The world is what is true on campus, whether or not the glasses know it; the rules
 * that make the glasses observe, keep and decide live in ntuCampusStory.ts and
 * ntuCampusErrands.ts.
 */
import { text, type Channel, type LoopReader, type LoopState, type MemoryRecord, type Scheduled, type Text } from './alwaysOnLoop'
import { at, gameMs, newClock, restoreClock, type CampusClock } from './ntuCampusClock'
import { LIVE_ROUTE } from './ntuLiveRoute'

export type Point = { x: number, y: number, z: number }
export const PLACE_IDS = ['slab', 'lt', 'library', 'starbucks', 'northSpine', 'hall2', 'hive', 'uhs'] as const
export type PlaceId = typeof PLACE_IDS[number]
/** `stop` is the shuttle stop in the map data; `at` is where the story happens, the stop's arrival point. */
export const PLACES: Record<PlaceId, { stop: string, name: Text, at: Point }> = {
  slab: { stop: 'ntumap-place-8baec8760caf', name: text('S-Lab', 'S-Lab'), at: { x: -18.5, y: 52, z: 132.5 } },
  lt: { stop: 'ntumap-place-795af31fe395', name: text('Tan Chin Tuan Lecture Theatre', 'Tan Chin Tuan 讲堂'), at: { x: -130.5, y: 60, z: 240.5 } },
  library: { stop: 'ntumap-place-73b9d4f9463a', name: text('Lee Wee Nam Library', 'Lee Wee Nam 图书馆'), at: { x: -142.5, y: 62, z: 20.5 } },
  starbucks: { stop: 'ntumap-place-7072f8b02edb', name: text('Starbucks', 'Starbucks'), at: { x: -320.5, y: 45, z: 35.5 } },
  northSpine: { stop: 'tour-north-spine', name: text('North Spine', 'North Spine'), at: { x: -144.5, y: 65, z: 170.5 } },
  hall2: { stop: 'ntumap-place-52f40b1435d4', name: text('Hall 2', 'Hall 2'), at: { x: 122.5, y: 56, z: -85.5 } },
  hive: { stop: 'tour-hive', name: text('The Hive', 'The Hive'), at: { x: 76.5, y: 37, z: 471.5 } },
  uhs: { stop: 'ntumap-place-9d6365c4f779', name: text('University Health Service', '校医院'), at: { x: 15.5, y: 57, z: 250.5 } }
}

export const CAST_IDS = ['lin', 'steward', 'desk', 'rig', 'presenter', 'peer', 'zhou', 'chatA', 'chatB', 'librarian', 'returnDesk', 'chenCafe', 'chenLibrary', 'board', 'printer', 'hallNotice', 'groupA', 'groupB', 'pharmacist', 'pharmacyDesk'] as const
export type CastId = typeof CAST_IDS[number]
export type CastMember = { place: PlaceId, at: Point, kind: 'person' | 'prop', name: Text, faces?: CastId }
/**
 * Standing spots were checked against the Anvil world: solid floor, two clear blocks above.
 * Prof. Chen appears twice because he is somewhere else on each day.
 */
export const CAST: Record<CastId, CastMember> = {
  lin: { place: 'slab', at: LIVE_ROUTE.colleague, kind: 'person', name: text('Lin · S-Lab colleague', '林 · S-Lab 同事') },
  steward: { place: 'slab', at: LIVE_ROUTE.steward, kind: 'person', name: text('S-Lab steward', 'S-Lab 管理员'), faces: 'desk' },
  desk: { place: 'slab', at: LIVE_ROUTE.pickup, kind: 'prop', name: text('Pickup desk', '领取桌') },
  rig: { place: 'slab', at: { x: -14.5, y: 52, z: 130.5 }, kind: 'prop', name: text('Lin’s experiment', '林的实验仪器') },
  presenter: { place: 'lt', at: { x: -134.5, y: 60, z: 241.5 }, kind: 'person', name: text('Presenter', '主讲同学'), faces: 'peer' },
  peer: { place: 'lt', at: { x: -132.5, y: 60, z: 243.5 }, kind: 'person', name: text('Group member', '组员'), faces: 'presenter' },
  zhou: { place: 'lt', at: { x: -133.5, y: 60, z: 239.5 }, kind: 'person', name: text('Zhou · group member', '周 · 组员'), faces: 'presenter' },
  chatA: { place: 'lt', at: { x: -131.5, y: 60, z: 244.5 }, kind: 'person', name: text('Classmate', '同学'), faces: 'chatB' },
  chatB: { place: 'lt', at: { x: -130.5, y: 60, z: 245.5 }, kind: 'person', name: text('Classmate', '同学'), faces: 'chatA' },
  librarian: { place: 'library', at: { x: -144.5, y: 63, z: 17.5 }, kind: 'person', name: text('Librarian', '图书馆员'), faces: 'returnDesk' },
  returnDesk: { place: 'library', at: { x: -143.5, y: 62, z: 18.5 }, kind: 'prop', name: text('Return desk', '还书台') },
  chenCafe: { place: 'starbucks', at: { x: -316.5, y: 45, z: 35.5 }, kind: 'person', name: text('Prof. Chen · advisor', '陈教授 · 导师') },
  chenLibrary: { place: 'library', at: { x: -143.5, y: 62, z: 15.5 }, kind: 'person', name: text('Prof. Chen · advisor', '陈教授 · 导师') },
  board: { place: 'northSpine', at: { x: -143.5, y: 65, z: 165.5 }, kind: 'prop', name: text('North Spine notice board', 'North Spine 公告板') },
  printer: { place: 'northSpine', at: { x: -149.5, y: 65, z: 166.5 }, kind: 'prop', name: text('Print kiosk', '自助打印机') },
  hallNotice: { place: 'hall2', at: { x: 125.5, y: 56, z: -84.5 }, kind: 'prop', name: text('Notice on the door', '门口的告示') },
  groupA: { place: 'hive', at: { x: 73.5, y: 37, z: 472.5 }, kind: 'person', name: text('G-07 study group', 'G-07 学习小组'), faces: 'groupB' },
  groupB: { place: 'hive', at: { x: 73.5, y: 37, z: 470.5 }, kind: 'person', name: text('G-07 study group', 'G-07 学习小组'), faces: 'groupA' },
  pharmacist: { place: 'uhs', at: { x: 15.5, y: 57, z: 247.5 }, kind: 'person', name: text('Pharmacist', '药剂师'), faces: 'pharmacyDesk' },
  pharmacyDesk: { place: 'uhs', at: { x: 15.5, y: 57, z: 248.5 }, kind: 'prop', name: text('Pharmacy counter', '取药窗口') }
}

/** The timetable. Times are absolute, so no scene recurs on the other day. */
export const TIMES = {
  gather: at(1, 10, 45), meetingStart: at(1, 11), privacyStart: at(1, 11, 20), privacyEnd: at(1, 11, 30),
  meetingEnd: at(1, 12), chatEnd: at(1, 12, 10), chatLeave: at(1, 12, 5), zhouLeaves: at(1, 12, 20),
  linMessage: at(1, 13), readingsLastAsk: at(1, 17),
  chenCafeFrom: at(1, 13), chenCafeUntil: at(1, 17),
  noticesUp: at(2, 9, 30), chenOfficeFrom: at(2, 13), chenSearch: at(2, 13, 30), chenStillMissing: at(2, 14, 30), chenOfficeUntil: at(2, 17),
  groupReminder: at(2, 15, 30), groupArrive: at(2, 15, 50), groupStart: at(2, 16), groupEnd: at(2, 17),
  medsReminder: at(2, 16, 30)
}
/** The pharmacy at University Health Service is open on both days. */
export const PHARMACY_HOURS = [9, 17] as const

export type CampusWorld = {
  bookReturned?: number
  reportSent?: number
  /** Readings you actually looked at, whether or not the glasses could link them. */
  checks: number
  chat?: { with: CastId, until: number }
  /** The print job: when it was sent, whether the kiosk jammed, and when the poster actually went up. */
  posterSent?: number
  posterJammed?: boolean
  posterPosted?: number
  chenSigned?: number
  groupJoined?: number
  medsCollected?: number
  /** The glasses' battery, in percent. Looking more widely drains it faster. */
  battery: number
}
export type CampusStory = { version: 1, clock: CampusClock, world: CampusWorld, marks: Record<string, number> }
/** What the host measured this check: where you stand and which cast members are in clear view. */
export type CampusView = { at?: Point, sees: Partial<Record<CastId, boolean>> }
/** Reads that also need the loop's tallies and timers. Works on the live loop or a render snapshot. */
export type StoryReader = LoopReader & {
  state: { readonly memory: ReadonlyArray<Readonly<MemoryRecord>>, readonly frozen: readonly Channel[], readonly tally: Readonly<LoopState['tally']>, readonly action: { readonly scheduled: Readonly<Record<string, Readonly<Scheduled>>> } }
}

export type AgendaItem = { id: string, title: Text, detail: Text, place?: PlaceId, state: 'todo' | 'now' | 'done' | 'missed', action?: { id: 'report.send' | 'readings.on' | 'poster.send', label: Text } }

export const newStory = (): CampusStory => ({ version: 1, clock: newClock(), world: { checks: 0, battery: 100 }, marks: {} })
export const serializeStory = (story: CampusStory) => JSON.stringify(story)
export const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)
export function restoreStory (raw: string | null): CampusStory {
  const story = newStory()
  try {
    const data = JSON.parse(raw ?? 'null')
    if (data?.version !== 1) return story
    story.clock = restoreClock(data.clock)
    const world = data.world ?? {}
    for (const key of ['bookReturned', 'reportSent', 'posterSent', 'posterPosted', 'chenSigned', 'groupJoined', 'medsCollected'] as const) {
      if (num(world[key]) > 0) story.world[key] = num(world[key])
    }
    if (world.posterJammed === true) story.world.posterJammed = true
    story.world.checks = Math.max(0, Math.floor(num(world.checks)))
    story.world.battery = typeof world.battery === 'number' ? Math.max(0, Math.min(100, num(world.battery))) : 100
    if ((CAST_IDS as readonly unknown[]).includes(world.chat?.with) && num(world.chat?.until) > 0) story.world.chat = { with: world.chat.with, until: num(world.chat.until) }
    for (const [key, value] of Object.entries<unknown>(data.marks && typeof data.marks === 'object' ? data.marks : {}).slice(0, 120)) {
      if (key.length <= 40 && typeof value === 'number' && Number.isFinite(value)) story.marks[key] = value
    }
  } catch { return newStory() }
  return story
}

export const distance = (from: Point | undefined, to: Point) => (from ? Math.hypot(from.x - to.x, from.z - to.z) : Number.POSITIVE_INFINITY)
export const nowOf = (story: CampusStory) => gameMs(story.clock)
export const minutesBetween = (from: number, to: number) => Math.max(0, Math.round((to - from) / 60_000))
const within = (story: CampusStory, from: number, until: number) => nowOf(story) >= from && nowOf(story) < until

/** Who is where right now. Scenes set the cast; nobody walks between places. */
export function present (story: CampusStory, id: CastId): boolean {
  switch (id) {
    case 'presenter': case 'peer': return within(story, TIMES.gather, TIMES.meetingEnd)
    case 'chatA': case 'chatB': return within(story, TIMES.gather, TIMES.chatLeave)
    case 'zhou': return within(story, TIMES.gather, TIMES.zhouLeaves) || Boolean(story.world.chat)
    case 'chenCafe': return within(story, TIMES.chenCafeFrom, TIMES.chenCafeUntil)
    case 'chenLibrary': return within(story, TIMES.chenOfficeFrom, TIMES.chenOfficeUntil)
    case 'hallNotice': return nowOf(story) >= TIMES.noticesUp
    case 'groupA': case 'groupB': return within(story, TIMES.groupArrive, TIMES.groupEnd)
    case 'pharmacist': return within(story, at(story.clock.day, PHARMACY_HOURS[0]), at(story.clock.day, PHARMACY_HOURS[1]))
    default: return true
  }
}
