type LocationLike = { hostname?: string; search?: string }

/** The reconstructed campus is the default NTU world, including on static hosts. */
export function isNtuMapRebuild (where: LocationLike | undefined = globalThis.location): boolean {
  if (!where) return false
  const query = new URLSearchParams(where.search)
  // Retain the developer-only hall comparison against the older world.
  if (query.get('campusPrototype') === 'hall3-16'
    && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(where.hostname ?? '')) return false
  return query.get('campusPrototype') === 'ntumap'
    || ['singapore', 'ntu', 'village'].includes(query.get('scene') ?? '')
}

export function ntuMapAsset (file: string): string {
  return `${isNtuMapRebuild() ? './maps/ntu-campus-v3/' : './maps/ntu-campus-v2/'}${file}`
}

export function ntuMemoryKey (original: string): string {
  return isNtuMapRebuild() ? 'always-on-ntumap-memory-v1' : original
}

/**
 * Mesher workers for the campus: half the CPU cores, one to four. Drawing a new place is
 * CPU-bound, so this decides how long a shuttle trip or a fresh load takes; a two-core
 * device keeps a single worker.
 */
export function ntuMesherWorkers (cores: number | undefined = globalThis.navigator?.hardwareConcurrency): number {
  return Math.max(1, Math.min(4, Math.floor((cores || 2) / 2)))
}
