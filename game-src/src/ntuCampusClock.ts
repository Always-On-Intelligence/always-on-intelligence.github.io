/**
 * Campus clock for the two-day story. Game time runs only while the service is
 * active, at a fixed pace, and stops at the end of each day until the player
 * moves on. Days are absolute, so times compare across the night.
 */
import { text, type Text } from './alwaysOnLoop'

export const DAY_START = 9 * 60
export const DAY_END = 18 * 60
export const LAST_DAY = 2
/** Game minutes per real minute. */
export const CLOCK_PACE = 30
const MINUTE_MS = 60_000
const DAY_MINUTES = 24 * 60
const TICK_CAP_MS = 1000

export type CampusClock = { day: number, minute: number }
export const WEEKDAY: Record<number, Text> = { 1: text('Monday', '周一'), 2: text('Tuesday', '周二') }

export const newClock = (): CampusClock => ({ day: 1, minute: DAY_START })
/** Absolute game time in milliseconds; the loop uses it so records carry campus time. */
export const gameMs = (clock: CampusClock) => ((clock.day - 1) * DAY_MINUTES + clock.minute) * MINUTE_MS
/** Absolute game time for a clock reading on a given day. */
export const at = (day: number, hour: number, minute = 0) => ((day - 1) * DAY_MINUTES + hour * 60 + minute) * MINUTE_MS
export const minutes = (count: number) => count * MINUTE_MS
/** A real-time span expressed in game milliseconds, for buffers that should feel the same at any pace. */
export const realToGameMs = (realMs: number) => realMs * CLOCK_PACE

/** Advance by real elapsed time, capped per tick so a paused page never jumps. Returns game minutes moved. */
export function advanceClock (clock: CampusClock, realMs: number): number {
  const delta = Number.isFinite(realMs) ? Math.max(0, Math.min(TICK_CAP_MS, realMs)) : 0
  const next = Math.min(DAY_END, clock.minute + delta * CLOCK_PACE / MINUTE_MS)
  const moved = next - clock.minute
  clock.minute = next
  return moved
}

/** Jump forward to an absolute game time on the same day; never backwards, never past the end of the day. */
export function skipTo (clock: CampusClock, target: number): boolean {
  const day = Math.floor(target / (DAY_MINUTES * MINUTE_MS)) + 1
  if (day !== clock.day) return false
  const minute = Math.min(DAY_END, target / MINUTE_MS - (day - 1) * DAY_MINUTES)
  if (minute <= clock.minute) return false
  clock.minute = minute
  return true
}

export const dayOver = (clock: CampusClock) => clock.minute >= DAY_END
export const lastDay = (clock: CampusClock) => clock.day >= LAST_DAY

/** Sleep through the night. Returns false after the last day. */
export function startNextDay (clock: CampusClock): boolean {
  if (clock.day >= LAST_DAY) return false
  clock.day++
  clock.minute = DAY_START
  return true
}

const pad = (value: number) => String(value).padStart(2, '0')
/** 24-hour campus time, e.g. "09:05". */
export function formatMinute (minute: number): string {
  const whole = Math.floor(minute)
  return `${pad(Math.floor(whole / 60) % 24)}:${pad(whole % 60)}`
}
/** The clock reading of a game timestamp, e.g. "10:05", whatever the day. */
export const timeOf = (ms: number) => formatMinute((ms / MINUTE_MS) % DAY_MINUTES)
/** Which story day a game timestamp falls on. */
export const dayOf = (ms: number) => Math.floor(ms / (DAY_MINUTES * MINUTE_MS)) + 1
/** A game timestamp as the panel shows it: time only on the current day, the day otherwise. */
export function formatGameMs (ms: number, lang: 'en' | 'zh', today?: number): string {
  const total = ms / MINUTE_MS
  const day = Math.floor(total / DAY_MINUTES) + 1
  const time = formatMinute(total - (day - 1) * DAY_MINUTES)
  if (day === today) return time
  return lang === 'zh' ? `第${day === 1 ? '一' : '二'}天 ${time}` : `Day ${day} ${time}`
}
/** How far a day has progressed, 0 to 1, for a daylight bar. */
export const dayProgress = (clock: CampusClock) => Math.max(0, Math.min(1, (clock.minute - DAY_START) / (DAY_END - DAY_START)))

export function restoreClock (value: unknown): CampusClock {
  const candidate = value as Partial<CampusClock> | null | undefined
  const day = Number(candidate?.day); const minute = Number(candidate?.minute)
  if (!Number.isInteger(day) || day < 1 || day > LAST_DAY || !Number.isFinite(minute)) return newClock()
  return { day, minute: Math.max(DAY_START, Math.min(DAY_END, minute)) }
}
