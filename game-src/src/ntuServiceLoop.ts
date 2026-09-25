import { proxy, subscribe } from 'valtio'
import { EVIDENCE_BUFFER_MS, createServiceLoop, restoreLoop, serializeLoop, type ServiceLoop } from './alwaysOnLoop'
import { gameMs, realToGameMs } from './ntuCampusClock'
import { restoreStory, serializeStory, type CampusStory } from './ntuCampusStory'

/**
 * One loop and one story for the NTU scene. Memory and the story persist in this browser;
 * Sensing restarts empty on every visit. The loop runs on campus time, so every record
 * and decision carries the story clock.
 */
export const NTU_LOOP_KEY = 'always-on-ntu-loop-v2'
export const NTU_STORY_KEY = 'always-on-ntu-campus-v1'
/** The A17-only save from before the campus story used real time; it cannot be mixed in. */
const RETIRED_KEYS = ['always-on-ntu-loop-v1']
/** Timers change on every check, so storage is written at most this often. */
const SAVE_EVERY_MS = 2000
export const ntuLoopStorage = proxy({ saved: true })
export type NtuCampus = { loop: ServiceLoop, story: CampusStory }
let session: NtuCampus | undefined
let pending: ReturnType<typeof setTimeout> | undefined
const lastSaved = { loop: '', story: '' }

export function saveNtuCampus () {
  if (pending) clearTimeout(pending)
  pending = undefined
  if (!session) return
  const loop = serializeLoop(session.loop.state)
  const story = serializeStory(session.story)
  if (loop === lastSaved.loop && story === lastSaved.story) return
  try {
    if (loop !== lastSaved.loop) localStorage.setItem(NTU_LOOP_KEY, loop)
    if (story !== lastSaved.story) localStorage.setItem(NTU_STORY_KEY, story)
    lastSaved.loop = loop
    lastSaved.story = story
    if (!ntuLoopStorage.saved) ntuLoopStorage.saved = true
  } catch {
    if (ntuLoopStorage.saved) ntuLoopStorage.saved = false
  }
}
const saveSoon = () => { pending ??= setTimeout(saveNtuCampus, SAVE_EVERY_MS) }

export function getNtuCampus (): NtuCampus {
  if (session) return session
  const read = (key: string) => {
    try { return localStorage.getItem(key) } catch { return null }
  }
  try { for (const key of RETIRED_KEYS) localStorage.removeItem(key) } catch {}
  const found = { loop: read(NTU_LOOP_KEY), story: read(NTU_STORY_KEY) }
  // Memory timestamps only make sense on the clock they were written by: keep both or neither.
  const raw = found.loop && found.story ? found : { loop: null, story: null }
  const story = proxy(restoreStory(raw.story))
  const loop = createServiceLoop(proxy(restoreLoop(raw.loop)), () => gameMs(story.clock), { evidenceBufferMs: realToGameMs(EVIDENCE_BUFFER_MS) })
  session = { loop, story }
  lastSaved.loop = raw.loop ?? ''
  lastSaved.story = raw.story ?? ''
  // Sensing-only changes serialize identically, so they never reach storage.
  subscribe(loop.state, saveSoon)
  subscribe(story, saveSoon)
  addEventListener('pagehide', saveNtuCampus)
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNtuCampus() })
  return session
}
