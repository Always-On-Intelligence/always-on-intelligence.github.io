/**
 * Interaction guidance for authored tasks: where the next target is relative
 * to the player's view, and which key completes the next step.
 */
import type { Lang, Text } from './alwaysOnLoop'

/** One interaction key for the glasses stations and every authored task. */
export const INTERACT_KEY = 'E'

/** Angle from the player's facing direction to a point: 0 straight ahead, positive to the right. */
export function bearingTo (entity: { position: { x: number, z: number }, yaw?: number } | undefined, point: { x: number, z: number }): number {
  if (!entity) return 0
  const yaw = entity.yaw ?? 0
  const dx = point.x - entity.position.x
  const dz = point.z - entity.position.z
  // Minecraft yaw 0 faces -z and turns toward -x as it grows.
  return Math.atan2(dx * Math.cos(yaw) - dz * Math.sin(yaw), -dx * Math.sin(yaw) - dz * Math.cos(yaw))
}

const DIRECTIONS: Record<Lang, readonly string[]> = {
  en: ['behind you', 'behind you, left', 'to your left', 'ahead, left', 'ahead', 'ahead, right', 'to your right', 'behind you, right', 'behind you'],
  zh: ['在你身后', '在你左后方', '在你左侧', '在你左前方', '就在前方', '在你右前方', '在你右侧', '在你右后方', '在你身后']
}
export function directionOf (bearing: number, lang: Lang): string {
  if (!Number.isFinite(bearing)) return ''
  return DIRECTIONS[lang][Math.round(Math.max(-Math.PI, Math.min(Math.PI, bearing)) / (Math.PI / 4)) + 4]
}

export type PromptInput = {
  target: Text, action: Text, distance: number, bearing: number
  /** The next step can run right now. */
  ready: boolean
  touch: boolean
  /** Distance within which the target counts as reachable. */
  reach: number
}
export type Prompt = { mode: 'act' | 'guide', key: string, headline: string, detail: string }

/** One line saying where to go and one saying what to press, so the key is known before arrival. */
export function describePrompt (input: PromptInput, lang: Lang): Prompt {
  const zh = lang === 'zh'
  const key = input.touch ? (zh ? '点按' : 'Tap') : INTERACT_KEY
  const where = Number.isFinite(input.distance) ? `${input.target[lang]} · ${Math.round(input.distance)} m` : input.target[lang]
  if (input.ready) return { mode: 'act', key, headline: input.action[lang], detail: where }
  const step = input.distance > input.reach ? (zh ? `走到 ${Math.floor(input.reach)} 米内` : `Walk within ${Math.floor(input.reach)} m`)
    : Math.abs(input.bearing) > Math.PI / 4 ? (zh ? '转身面向它' : 'Turn to face it')
      : (zh ? '把准星对准它' : 'Put the crosshair on it')
  const then = input.touch ? '' : zh ? `，再按 ${INTERACT_KEY} ${input.action.zh}` : `, then press ${INTERACT_KEY} to ${input.action.en.charAt(0).toLowerCase()}${input.action.en.slice(1)}`
  return { mode: 'guide', key, headline: `${where} · ${directionOf(input.bearing, lang)}`, detail: `${step}${then}` }
}
