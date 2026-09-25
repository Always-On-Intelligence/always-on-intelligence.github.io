type Point = { x: number; y: number; z: number }

type WaitOptions = {
  signal: AbortSignal
  isPaused?: () => boolean
  timeoutMs?: number
  pollMs?: number
}

/** Poll until `ready` holds. Paused time does not consume the budget; running out resolves false. */
export async function waitForNtu ({ ready, signal, isPaused = () => false, timeoutMs = 15_000, pollMs = 100 }: WaitOptions & { ready: () => boolean }): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let settled = false
    let activeMs = 0
    let previousTime = performance.now()
    let previouslyPaused = isPaused()
    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      signal.removeEventListener('abort', cancel)
    }
    const finish = (done: boolean) => {
      settled = true
      cleanup()
      resolve(done)
    }
    const cancel = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new DOMException('Cancelled', 'AbortError'))
    }
    const tick = () => {
      if (signal.aborted) { cancel(); return }
      try {
        const now = performance.now()
        const paused = isPaused()
        if (!paused && !previouslyPaused) activeMs += Math.max(0, now - previousTime)
        previousTime = now
        previouslyPaused = paused
        if (!paused) {
          if (ready()) { finish(true); return }
          if (activeMs >= timeoutMs) { finish(false); return }
        }
        timer = setTimeout(tick, paused ? pollMs : Math.min(pollMs, Math.max(1, timeoutMs - activeMs)))
      } catch (error) {
        settled = true
        cleanup()
        reject(error)
      }
    }
    signal.addEventListener('abort', cancel, { once: true })
    tick()
  })
}

/** Wait for real streamed terrain. Paused time does not consume the loading budget. */
export async function waitForNtuTerrain ({ points, getGroundHeight, ...options }: WaitOptions & {
  points: readonly Point[]
  getGroundHeight: (point: Point) => number | undefined
}): Promise<boolean> {
  return waitForNtu({ ...options, ready: () => points.every(point => Number.isFinite(getGroundHeight(point))) })
}

/** What the renderer tells about drawn chunks. Keys are chunk corners in blocks, `x,z`. */
export type ChunkRenderer = {
  viewDistance: number
  finishedChunks: Record<string, boolean>
  chunkMeshManager?: { pendingNearReveal?: { has: (key: string) => boolean } }
}

/**
 * How much of the view around a point is drawn: chunks within the view distance whose
 * meshes are finished and not held back from display, out of all of them.
 */
export function drawnAround (renderer: ChunkRenderer, at: { x: number, z: number }): { drawn: number, total: number } {
  const radius = Math.max(0, Math.floor(renderer.viewDistance))
  const centreX = Math.floor(at.x / 16)
  const centreZ = Math.floor(at.z / 16)
  let drawn = 0
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const key = `${(centreX + dx) * 16},${(centreZ + dz) * 16}`
      if (renderer.finishedChunks[key] && !renderer.chunkMeshManager?.pendingNearReveal?.has(key)) drawn++
    }
  }
  return { drawn, total: (2 * radius + 1) ** 2 }
}
