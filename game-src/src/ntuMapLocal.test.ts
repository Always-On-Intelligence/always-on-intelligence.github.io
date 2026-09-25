import { describe, expect, it } from 'vitest'
import { isNtuMapRebuild, ntuMesherWorkers } from './ntuMapLocal'

describe('published campus selection', () => {
  it('uses the reconstructed world on public hosts and old shared campus links', () => {
    for (const scene of ['singapore', 'ntu', 'village']) {
      expect(isNtuMapRebuild({ hostname: 'always-on-agent.github.io', search: `?scene=${scene}` })).toBe(true)
    }
  })
  it('keeps ECCV independent and only permits the legacy hall preview locally', () => {
    expect(isNtuMapRebuild({ hostname: 'always-on-agent.github.io', search: '?scene=eccv' })).toBe(false)
    expect(isNtuMapRebuild({ hostname: 'localhost', search: '?scene=singapore&campusPrototype=hall3-16' })).toBe(false)
    expect(isNtuMapRebuild({ hostname: 'always-on-agent.github.io', search: '?scene=singapore&campusPrototype=hall3-16' })).toBe(true)
  })
})

describe('campus drawing', () => {
  it('meshes on half the cores, from one worker on small devices up to four', () => {
    expect([1, 2, 3, 4, 6, 8, 10, 16].map(cores => ntuMesherWorkers(cores))).toEqual([1, 1, 1, 2, 3, 4, 4, 4])
    // A browser that hides the core count gets the small-device setting.
    expect(ntuMesherWorkers(0)).toBe(1)
  })
})
