import { afterEach, expect, test, vi } from 'vitest'
import { waitForWorldReady } from './waitForWorldReady'

afterEach(() => { vi.useRealTimers() })
test('an already-ready renderer resolves without needing a future notification', async () => {
  const unsubscribe = vi.fn()
  await waitForWorldReady({ read: () => ({ ready: true, loaded: 9, total: 9 }), subscribe: () => unsubscribe })
  expect(unsubscribe).toHaveBeenCalledOnce()
})
test('later changes report bounded progress and resolve when rendering finishes', async () => {
  let check = () => {}
  const state = { ready: false, loaded: 0, total: 0 }
  const progress = vi.fn(); const unsubscribe = vi.fn()
  const pending = waitForWorldReady({ read: () => state, subscribe (callback) { check = callback; return unsubscribe }, onProgress: progress })
  expect(progress).toHaveBeenLastCalledWith(0)
  Object.assign(state, { loaded: 4, total: 8 }); check()
  expect(progress).toHaveBeenLastCalledWith(.5)
  Object.assign(state, { ready: true, loaded: 8 }); check()
  await pending
  expect(unsubscribe).toHaveBeenCalledOnce()
})
test('synchronous readiness during subscription still releases its listener', async () => {
  const unsubscribe = vi.fn()
  await waitForWorldReady({ read: () => ({ ready: true, loaded: 1, total: 1 }), subscribe (check) { check(); return unsubscribe } })
  expect(unsubscribe).toHaveBeenCalledOnce()
})
test('timeout reports a failure instead of treating missing terrain as success', async () => {
  vi.useFakeTimers()
  const unsubscribe = vi.fn()
  const pending = waitForWorldReady({ read: () => ({ ready: false, loaded: 0, total: 9 }), subscribe: () => unsubscribe, timeoutMs: 100 })
  const assertion = expect(pending).rejects.toThrow('Terrain rendering timed out')
  await vi.advanceTimersByTimeAsync(100)
  await assertion
  expect(unsubscribe).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})
test('disconnect cancels a wait and cleans up subscription and timer', async () => {
  vi.useFakeTimers()
  const controller = new AbortController(); const unsubscribe = vi.fn()
  const pending = waitForWorldReady({ read: () => ({ ready: false, loaded: 0, total: 9 }), subscribe: () => unsubscribe, signal: controller.signal })
  controller.abort()
  await expect(pending).rejects.toThrow('cancelled')
  expect(unsubscribe).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})
