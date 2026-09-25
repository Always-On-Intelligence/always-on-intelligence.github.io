import { expect, test } from 'vitest'
import { DAY_END, DAY_START, advanceClock, at, dayOver, dayProgress, formatGameMs, formatMinute, gameMs, newClock, restoreClock, skipTo, startNextDay } from './ntuCampusClock'

test('one real minute is thirty campus minutes, and a paused page never jumps', () => {
  const clock = newClock()
  for (let i = 0; i < 120; i++) advanceClock(clock, 500)
  expect(formatMinute(clock.minute)).toBe('09:30')
  expect(advanceClock(clock, 600_000)).toBeCloseTo(0.5)
  expect(advanceClock(clock, Number.NaN)).toBe(0)
})

test('the day stops at 18:00 and the night moves to the next morning once', () => {
  const clock = { day: 1, minute: DAY_END - 0.1 }
  advanceClock(clock, 1000)
  expect(clock.minute).toBe(DAY_END)
  expect(dayOver(clock)).toBe(true)
  expect(advanceClock(clock, 1000)).toBe(0)
  expect(startNextDay(clock)).toBe(true)
  expect(clock).toEqual({ day: 2, minute: DAY_START })
  expect(startNextDay(clock)).toBe(false)
})

test('game time is absolute across days and formats for the panel', () => {
  expect(gameMs({ day: 2, minute: DAY_START })).toBe(at(2, 9))
  expect(at(2, 9) - at(1, 18)).toBe(15 * 60 * 60_000)
  expect(formatGameMs(at(1, 10, 5), 'zh', 1)).toBe('10:05')
  expect(formatGameMs(at(1, 10, 5), 'zh', 2)).toBe('第一天 10:05')
  expect(formatGameMs(at(2, 17, 30), 'en', 1)).toBe('Day 2 17:30')
})

test('skipping only moves forward within the same day', () => {
  const clock = newClock()
  expect(skipTo(clock, at(1, 11))).toBe(true)
  expect(formatMinute(clock.minute)).toBe('11:00')
  expect(skipTo(clock, at(1, 10))).toBe(false)
  expect(skipTo(clock, at(2, 10))).toBe(false)
  expect(skipTo(clock, at(1, 23))).toBe(true)
  expect(clock.minute).toBe(DAY_END)
  expect(dayProgress(clock)).toBe(1)
})

test('saved clocks are validated', () => {
  expect(restoreClock({ day: 2, minute: 700 })).toEqual({ day: 2, minute: 700 })
  for (const bad of [null, {}, { day: 3, minute: 600 }, { day: 1.5, minute: 600 }, { day: 1, minute: 'x' }]) expect(restoreClock(bad)).toEqual(newClock())
  expect(restoreClock({ day: 1, minute: 2000 }).minute).toBe(DAY_END)
})
