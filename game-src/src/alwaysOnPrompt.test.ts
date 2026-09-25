import { expect, test } from 'vitest'
import { text } from './alwaysOnLoop'
import { bearingTo, describePrompt, directionOf } from './alwaysOnPrompt'

const at = (yaw: number) => ({ position: { x: 0, z: 0 }, yaw })
const north = { x: 0, z: -5 }
const east = { x: 5, z: 0 }
const west = { x: -5, z: 0 }
const south = { x: 0, z: 5 }

test('bearing follows Minecraft yaw: 0 faces north and positive angles are to the right', () => {
  expect(bearingTo(at(0), north)).toBeCloseTo(0)
  expect(bearingTo(at(0), east)).toBeCloseTo(Math.PI / 2)
  expect(bearingTo(at(0), west)).toBeCloseTo(-Math.PI / 2)
  expect(Math.abs(bearingTo(at(0), south))).toBeCloseTo(Math.PI)
  // Facing west, north is on the right.
  expect(bearingTo(at(Math.PI / 2), west)).toBeCloseTo(0)
  expect(bearingTo(at(Math.PI / 2), north)).toBeCloseTo(Math.PI / 2)
  expect(bearingTo(undefined, north)).toBe(0)
})

test('directions use eight sectors in both languages', () => {
  expect(directionOf(0, 'zh')).toBe('就在前方')
  expect(directionOf(Math.PI / 2, 'en')).toBe('to your right')
  expect(directionOf(-Math.PI / 2, 'zh')).toBe('在你左侧')
  expect(directionOf(Math.PI * 0.75, 'zh')).toBe('在你右后方')
  expect(directionOf(-Math.PI, 'en')).toBe('behind you')
  expect(directionOf(Number.NaN, 'en')).toBe('')
})

const input = { target: text('Colleague', '同事'), action: text('Accept the errand', '接受这项委托'), distance: 12, bearing: Math.PI, ready: false, touch: false, reach: 5.5 }

test('guidance names the key before the player arrives', () => {
  expect(describePrompt(input, 'zh')).toEqual({ mode: 'guide', key: 'E', headline: '同事 · 12 m · 在你身后', detail: '走到 5 米内，再按 E 接受这项委托' })
  expect(describePrompt(input, 'en').detail).toBe('Walk within 5 m, then press E to accept the errand')
})

test('within reach, guidance says whether to turn or to aim', () => {
  expect(describePrompt({ ...input, distance: 3 }, 'zh').detail).toBe('转身面向它，再按 E 接受这项委托')
  expect(describePrompt({ ...input, distance: 3, bearing: 0.3 }, 'en').detail).toBe('Put the crosshair on it, then press E to accept the errand')
})

test('a ready step shows the key and the action itself', () => {
  expect(describePrompt({ ...input, distance: 2.6, ready: true }, 'zh')).toEqual({ mode: 'act', key: 'E', headline: '接受这项委托', detail: '同事 · 3 m' })
})

test('touch players tap instead of pressing E', () => {
  expect(describePrompt({ ...input, ready: true, touch: true }, 'zh').key).toBe('点按')
  expect(describePrompt({ ...input, touch: true }, 'en').detail).toBe('Walk within 5 m')
})
