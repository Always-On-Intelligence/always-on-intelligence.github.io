type WorldLoadState = { ready: boolean; loaded: number; total: number }

/** Subscribe before checking, so both an already-ready world and later updates work. */
export async function waitForWorldReady ({ read, subscribe, onProgress, signal, timeoutMs = 120_000 }: {
  read: () => WorldLoadState
  subscribe: (check: () => void) => () => void
  onProgress?: (progress: number) => void
  signal?: AbortSignal
  timeoutMs?: number
}): Promise<void> {
  return new Promise((resolve, reject) => {
    let done = false
    let unsubscribe: (() => void) | undefined
    const timer = setTimeout(() => finish(new Error('Terrain rendering timed out. 地形渲染等待超时，请保持页面在前台后重试。')), timeoutMs)
    const finish = (error?: Error) => {
      if (done) return
      done = true
      clearTimeout(timer)
      unsubscribe?.()
      signal?.removeEventListener('abort', aborted)
      if (error) reject(error); else resolve()
    }
    const aborted = () => finish(new Error('World loading cancelled.'))
    const check = () => {
      if (done) return
      try {
        const state = read()
        if (state.ready && state.total > 0) { finish(); return }
        onProgress?.(state.total > 0 ? Math.max(0, Math.min(1, state.loaded / state.total)) : 0)
      } catch (error) { finish(error instanceof Error ? error : new Error(String(error))) }
    }
    if (signal?.aborted) { aborted(); return }
    signal?.addEventListener('abort', aborted, { once: true })
    try {
      unsubscribe = subscribe(check)
      // Some subscriptions can synchronously report readiness during registration.
      if (done) unsubscribe(); else check()
    } catch (error) { finish(error instanceof Error ? error : new Error(String(error))) }
  })
}
