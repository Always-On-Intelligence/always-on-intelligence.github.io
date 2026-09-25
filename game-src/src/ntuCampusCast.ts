/**
 * The campus cast as small fictional figures and props, plus what floats above them:
 * name tags, speech bubbles and objective pins. Everything is built lazily once the
 * ground under it has loaded, so nobody floats over missing chunks. Positions are
 * absolute world coordinates under a group the renderer's scene origin tracks.
 */
import * as THREE from 'three'
import type { CastId, Point } from './ntuCampusStory'

type Scene = { add: (object: THREE.Object3D) => void, remove: (object: THREE.Object3D) => void }
/** `aim` turns a prop's front toward a point, usually where visitors arrive. */
type Member = { at: Point, kind: 'person' | 'prop', faces?: CastId, aim?: Point }
export type CastFrame = {
  /** Who is on stage now, with the words they are saying, if any. */
  present: Partial<Record<CastId, boolean>>
  says: Partial<Record<CastId, string>>
  /** Name tags are the glasses' overlay: only for people and things they recognise. */
  names: Partial<Record<CastId, string>>
  /** Targets the player can act on now. */
  pins: readonly CastId[]
  /** What props show: a title line, then content. */
  displays: Partial<Record<CastId, readonly string[]>>
}
type Look = { shirt: string, skin: string, hair: string, pants: string }
const LOOKS: Partial<Record<CastId, Look>> = {
  presenter: { shirt: '#6d5a93', skin: '#e0b48f', hair: '#231d1c', pants: '#2c3440' },
  peer: { shirt: '#c7874a', skin: '#b98260', hair: '#1d1a19', pants: '#39424c' },
  zhou: { shirt: '#4f8c73', skin: '#e5bc98', hair: '#2a2321', pants: '#27313a' },
  chenCafe: { shirt: '#8c9aa8', skin: '#d9ab86', hair: '#8a8580', pants: '#2b2f36' },
  chenLibrary: { shirt: '#8c9aa8', skin: '#d9ab86', hair: '#8a8580', pants: '#2b2f36' },
  groupA: { shirt: '#d1a640', skin: '#c68d69', hair: '#231c1a', pants: '#34414f' },
  groupB: { shirt: '#6a8f4e', skin: '#e3b894', hair: '#4a3328', pants: '#2d3440' },
  pharmacist: { shirt: '#eef1f2', skin: '#c99672', hair: '#1f1a18', pants: '#3a4a5c' },
  chatA: { shirt: '#b25c6e', skin: '#d8a47c', hair: '#3a2b24', pants: '#303945' },
  chatB: { shirt: '#5a7fb3', skin: '#8d5f45', hair: '#141212', pants: '#2c2f38' },
  librarian: { shirt: '#8a8f55', skin: '#e2b995', hair: '#6b6460', pants: '#383a3f' }
}
/** Figures and props are only built and shown near the player. */
const BUILD_M = 90
const TAG_M = 22
const BUBBLE_M = 20
/** Heights above a target's floor for what floats over it. */
const LIFT = { person: { tag: 2, bubble: 2.5, pin: 2.95 }, prop: { tag: 1.55, bubble: 2, pin: 2.05 } }
const TAG_LIFT: Partial<Record<CastId, number>> = { rig: 1.62, board: 2.3, printer: 1.55, hallNotice: 2.1 }

type Floating = { sprite: THREE.Sprite, text: string, texture: THREE.CanvasTexture, material: THREE.SpriteMaterial }
/** A flat face on a prop, such as the board's notices; unlike sprites it does not turn to the camera. */
type Panel = { mesh: THREE.Mesh, text: string, texture: THREE.CanvasTexture, style: 'board' | 'kiosk' | 'notice' }
type Figure = { root: THREE.Group, head: THREE.Group, arms: THREE.Group[], phase: number }
type Entry = { id: CastId, member: Member, root?: THREE.Object3D, figure?: Figure, floor?: number, external?: boolean, tag?: Floating, bubble?: Floating, screen?: Floating, panel?: Panel }

function wrap (context: CanvasRenderingContext2D, value: string, width: number): string[] {
  const words = /[\u3400-\u9FFF]/.test(value) ? [...value] : value.split(/(\s+)/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    // Closing punctuation stays with the text before it rather than opening a new line.
    if (line && !/^[。，、！？；：）」』…]$/.test(word) && context.measureText(line + word).width > width) {
      lines.push(line.trim())
      line = word.trimStart()
    } else { line += word }
  }
  if (line.trim()) lines.push(line.trim())
  return lines.slice(0, 3)
}

/** `external` members are drawn elsewhere (the A17 scene); they still get tags, bubbles and pins. */
export function createCampusCast ({ scene, getGroundHeight, members, external = [] }: { scene: Scene, getGroundHeight: (point: Point) => number | undefined, members: Record<CastId, Member>, external?: readonly CastId[] }) {
  const group = new THREE.Group()
  group.name = 'Campus story cast'
  scene.add(group)
  const disposables = new Set<{ dispose: () => void }>()
  const keep = <T extends { dispose: () => void }>(value: T) => {
    disposables.add(value)
    return value
  }
  const materials = new Map<string, THREE.MeshStandardMaterial>()
  const material = (color: string) => {
    if (!materials.has(color)) materials.set(color, keep(new THREE.MeshStandardMaterial({ color, roughness: 0.86 })))
    return materials.get(color)!
  }
  const shapes = {
    torso: keep(new THREE.CapsuleGeometry(0.17, 0.31, 2, 6)), leg: keep(new THREE.CapsuleGeometry(0.068, 0.62, 2, 6)), arm: keep(new THREE.CapsuleGeometry(0.052, 0.5, 2, 6)),
    head: keep(new THREE.SphereGeometry(0.125, 8, 6)), hair: keep(new THREE.SphereGeometry(0.129, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.57)), eye: keep(new THREE.SphereGeometry(0.009, 6, 3)),
    shadow: keep(new THREE.CircleGeometry(0.29, 16))
  }
  const shadowMaterial = keep(new THREE.MeshBasicMaterial({ color: '#24312c', transparent: true, opacity: 0.16, depthWrite: false }))
  const mesh = (geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const value = new THREE.Mesh(geometry, mat)
    value.position.set(x, y, z)
    value.castShadow = true
    parent.add(value)
    return value
  }
  function person (look: Look, phase: number): Figure {
    const root = new THREE.Group()
    const body = new THREE.Group()
    root.add(body)
    mesh(shapes.torso, material(look.shirt), body, 0, 1.17).scale.z = 0.82
    const head = new THREE.Group()
    head.position.set(0, 1.6, 0)
    body.add(head)
    mesh(shapes.head, material(look.skin), head).scale.set(0.94, 1.04, 0.94)
    mesh(shapes.hair, material(look.hair), head, 0, 0.016, -0.007)
    mesh(shapes.eye, material('#24313a'), head, -0.035, 0.015, 0.113)
    mesh(shapes.eye, material('#24313a'), head, 0.035, 0.015, 0.113)
    for (const sign of [-1, 1]) mesh(shapes.leg, material(look.pants), body, sign * 0.095, 0.47)
    const arms = [-1, 1].map(sign => {
      const shoulder = new THREE.Group()
      shoulder.position.set(sign * 0.22, 1.38, 0)
      body.add(shoulder)
      mesh(shapes.arm, material(look.shirt), shoulder, 0, -0.3)
      shoulder.rotation.z = sign * 0.07
      return shoulder
    })
    const shadow = mesh(shapes.shadow, shadowMaterial, root, 0, 0.013)
    shadow.rotation.x = -Math.PI / 2
    shadow.castShadow = false
    return { root, head, arms, phase }
  }
  /** Tags and bubbles keep a constant on-screen size, like name tags in games; the screen is part of the prop. */
  function canvasSprite (width: number, height: number, onScreen: boolean): Floating {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const texture = keep(new THREE.CanvasTexture(canvas))
    texture.colorSpace = THREE.SRGBColorSpace
    const spriteMaterial = keep(new THREE.SpriteMaterial({ map: texture, sizeAttenuation: !onScreen, transparent: true, fog: false, toneMapped: false }))
    const sprite = new THREE.Sprite(spriteMaterial)
    sprite.center.set(0.5, 0)
    group.add(sprite)
    return { sprite, text: '', texture, material: spriteMaterial }
  }
  const round = (context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    context.beginPath()
    context.moveTo(x + r, y)
    context.arcTo(x + w, y, x + w, y + h, r)
    context.arcTo(x + w, y + h, x, y + h, r)
    context.arcTo(x, y + h, x, y, r)
    context.arcTo(x, y, x + w, y, r)
    context.closePath()
  }
  function drawTag (floating: Floating, value: string) {
    if (floating.text === value) return
    floating.text = value
    const canvas = floating.texture.image
    const context = canvas.getContext('2d')!
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.font = '600 34px system-ui, sans-serif'
    const width = Math.min(canvas.width - 8, context.measureText(value).width + 36)
    round(context, (canvas.width - width) / 2, 4, width, 52, 26)
    context.fillStyle = 'rgba(20, 40, 34, 0.78)'
    context.fill()
    context.fillStyle = '#f2f7f1'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(value, canvas.width / 2, 31, canvas.width - 40)
    floating.texture.needsUpdate = true
  }
  function drawBubble (floating: Floating, value: string) {
    if (floating.text === value) return
    floating.text = value
    const canvas = floating.texture.image
    const context = canvas.getContext('2d')!
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.font = '500 34px system-ui, sans-serif'
    const lines = wrap(context, value, canvas.width - 70)
    const height = 30 + lines.length * 44
    const width = Math.min(canvas.width - 8, Math.max(...lines.map(line => context.measureText(line).width)) + 48)
    const left = (canvas.width - width) / 2
    const top = canvas.height - height - 26
    round(context, left, top, width, height, 22)
    context.moveTo(canvas.width / 2 - 14, top + height - 1)
    context.lineTo(canvas.width / 2, canvas.height - 4)
    context.lineTo(canvas.width / 2 + 14, top + height - 1)
    context.fillStyle = 'rgba(252, 251, 245, 0.96)'
    context.fill()
    context.fillStyle = '#20342e'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    for (const [index, line] of lines.entries()) context.fillText(line, canvas.width / 2, top + 37 + index * 44)
    floating.texture.needsUpdate = true
  }
  function drawScreen (floating: Floating, [title = '', value = '']: readonly string[]) {
    if (floating.text === title + value) return
    floating.text = title + value
    const canvas = floating.texture.image
    const context = canvas.getContext('2d')!
    context.fillStyle = '#10231e'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#8fd6a5'
    context.font = '600 30px ui-monospace, monospace'
    context.textAlign = 'center'
    context.fillText(title, canvas.width / 2, 44)
    context.font = '700 64px ui-monospace, monospace'
    context.fillText(value, canvas.width / 2, 116)
    floating.texture.needsUpdate = true
  }
  function canvasPanel (parent: THREE.Object3D, width: number, height: number, style: Panel['style'], y: number, z: number): Panel {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * 400)
    canvas.height = Math.round(height * 400)
    const texture = keep(new THREE.CanvasTexture(canvas))
    texture.colorSpace = THREE.SRGBColorSpace
    const face = new THREE.Mesh(keep(new THREE.PlaneGeometry(width, height)), keep(new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })))
    face.position.set(0, y, z)
    parent.add(face)
    return { mesh: face, text: '', texture, style }
  }
  function drawPanel (panel: Panel, lines: readonly string[]) {
    const joined = lines.join('\n')
    if (panel.text === joined) return
    panel.text = joined
    const canvas = panel.texture.image
    const context = canvas.getContext('2d')!
    const kiosk = panel.style === 'kiosk'
    context.fillStyle = kiosk ? '#10231e' : panel.style === 'board' ? '#e9e2cf' : '#f7f3e6'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.textAlign = panel.style === 'board' ? 'left' : 'center'
    const x = panel.style === 'board' ? 28 : canvas.width / 2
    const [title = '', ...rest] = lines
    context.fillStyle = kiosk ? '#8fd6a5' : '#7a3b2a'
    context.font = `700 ${kiosk ? 44 : 40}px system-ui, sans-serif`
    context.fillText(title, x, 58, canvas.width - 40)
    context.fillStyle = kiosk ? (rest.some(line => line.includes('JAM')) ? '#f1a37f' : '#8fd6a5') : '#20342e'
    context.font = `600 ${kiosk ? 52 : panel.style === 'notice' ? 48 : 30}px system-ui, sans-serif`
    const step = kiosk ? 70 : panel.style === 'notice' ? 64 : 46
    for (const [index, line] of rest.entries()) context.fillText(line, x, 58 + step * (index + 1) + (kiosk ? 10 : 0), canvas.width - 40)
    panel.texture.needsUpdate = true
  }
  // One pin texture serves every target.
  const pinTexture = (() => {
    const canvas = document.createElement('canvas')
    canvas.width = 96
    canvas.height = 128
    const context = canvas.getContext('2d')!
    context.fillStyle = '#d7eab9'
    context.strokeStyle = '#203c30'
    context.lineWidth = 7
    context.beginPath()
    context.arc(48, 44, 34, Math.PI * 0.8, Math.PI * 2.2)
    context.lineTo(48, 120)
    context.closePath()
    context.fill()
    context.stroke()
    context.fillStyle = '#203c30'
    context.beginPath()
    context.arc(48, 44, 12, 0, Math.PI * 2)
    context.fill()
    const texture = keep(new THREE.CanvasTexture(canvas))
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  })()
  const pinMaterial = keep(new THREE.SpriteMaterial({ map: pinTexture, depthTest: false, sizeAttenuation: false, fog: false, toneMapped: false }))
  const pins = new Map<CastId, THREE.Sprite>()

  function prop (entry: Entry): THREE.Group {
    const root = new THREE.Group()
    const wood = material('#bfad88'); const metal = material('#65736b')
    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => mesh(keep(new THREE.BoxGeometry(w, h, d)), mat, root, x, y, z)
    switch (entry.id) {
      case 'rig': {
        box(0.7, 0.72, 0.5, metal, 0, 0.36, 0)
        box(0.08, 0.5, 0.08, metal, 0, 0.97, -0.1)
        root.userData.light = box(0.05, 0.05, 0.05, material('#e4633f'), 0.26, 0.76, 0.2)
        break
      }
      case 'board': {
        for (const x of [-0.95, 0.95]) box(0.08, 2.1, 0.08, metal, x, 1.05, 0)
        box(2, 1.3, 0.06, material('#7c5a3a'), 0, 1.45, -0.02)
        entry.panel = canvasPanel(root, 1.86, 1.16, 'board', 1.45, 0.015)
        break
      }
      case 'printer': {
        box(0.66, 1.3, 0.5, material('#d8dde0'), 0, 0.65, 0)
        box(0.5, 0.06, 0.3, material('#3c464d'), 0, 0.82, 0.2)
        entry.panel = canvasPanel(root, 0.46, 0.3, 'kiosk', 1.08, 0.255)
        break
      }
      case 'hallNotice': {
        box(0.08, 1.2, 0.08, metal, 0, 0.6, -0.04)
        box(0.78, 0.96, 0.05, material('#6e8a7a'), 0, 1.5, -0.01)
        entry.panel = canvasPanel(root, 0.66, 0.84, 'notice', 1.5, 0.02)
        break
      }
      default: {
        box(1.1, 0.05, 0.55, wood, 0, 0.8, 0)
        for (const x of [-0.48, 0.48]) box(0.05, 0.78, 0.5, metal, x, 0.39, 0)
        box(0.3, 0.06, 0.22, material('#8e4d3c'), -0.2, 0.86, 0)
        box(0.28, 0.06, 0.2, material('#35607a'), -0.19, 0.92, 0.01)
      }
    }
    // The front of the prop faces where visitors arrive.
    const { aim, at } = entry.member
    if (aim) root.rotation.y = Math.atan2(aim.x - at.x, aim.z - at.z)
    return root
  }

  const entries = new Map<CastId, Entry>((Object.keys(members)).map(id => [id, { id, member: members[id], external: external.includes(id) }]))
  const camera = new THREE.Vector3()
  let elapsed = 0
  let disposed = false
  let frame: CastFrame = { present: {}, says: {}, names: {}, pins: [], displays: {} }
  const placeOf = (entry: Entry) => (entry.root ? entry.root.position : new THREE.Vector3(entry.member.at.x, entry.floor ?? entry.member.at.y, entry.member.at.z))

  function build (entry: Entry) {
    const floor = getGroundHeight(entry.member.at)
    if (!Number.isFinite(floor)) return
    entry.floor = floor
    if (entry.member.kind === 'person') {
      const look = LOOKS[entry.id]
      if (!look) return
      entry.figure = person(look, entry.id.length * 0.7)
      entry.root = entry.figure.root
    } else { entry.root = prop(entry) }
    entry.root.name = `cast:${entry.id}`
    entry.root.position.set(entry.member.at.x, floor!, entry.member.at.z)
    if (entry.id === 'rig') {
      entry.screen = canvasSprite(256, 150, false)
      entry.screen.sprite.scale.set(0.62, 0.36, 1)
    }
    group.add(entry.root)
  }
  function remove (entry: Entry) {
    entry.root?.removeFromParent()
    entry.root = undefined
    entry.figure = undefined
    entry.panel = undefined
    for (const key of ['tag', 'bubble', 'screen'] as const) {
      entry[key]?.sprite.removeFromParent()
      entry[key] = undefined
    }
  }

  return {
    /** Follow a figure built elsewhere, such as Lin in the A17 scene; `undefined` detaches it. */
    attach (id: CastId, root: THREE.Object3D | undefined) {
      const entry = entries.get(id)
      if (entry?.external && !disposed) entry.root = root
    },
    /** What the story says should be on stage; called on every check. */
    sync (next: CastFrame) {
      frame = next
    },
    update (dt: number, cameraPosition?: THREE.Vector3) {
      if (disposed) return
      dt = Math.max(0, Math.min(0.1, Number.isFinite(dt) ? dt : 0))
      elapsed += dt
      if (cameraPosition) camera.copy(cameraPosition)
      for (const entry of entries.values()) {
        const { at } = entry.member
        const near = Math.hypot(camera.x - at.x, camera.z - at.z)
        const onStage = Boolean(frame.present[entry.id]) && near <= BUILD_M
        if (entry.external) {
          if (!entry.root && entry.floor === undefined && onStage) {
            const floor = getGroundHeight(at)
            if (Number.isFinite(floor)) entry.floor = floor
          }
        } else {
          if (onStage && !entry.root) build(entry)
          if (!onStage && entry.root) remove(entry)
        }
        if (!(entry.root ?? (entry.external && entry.floor !== undefined)) || !onStage) {
          if (pins.get(entry.id)) pins.get(entry.id)!.visible = false
          if (entry.tag) entry.tag.sprite.visible = false
          if (entry.bubble) entry.bubble.sprite.visible = false
          continue
        }
        const place = placeOf(entry)
        const lift = LIFT[entry.member.kind]
        const { figure } = entry
        const saying = frame.says[entry.id]
        if (figure) {
          // Face the player when close, otherwise whoever this person is talking to.
          const target = near < 6 ? camera : entry.member.faces ? members[entry.member.faces].at : undefined
          if (target) {
            const desired = Math.atan2(target.x - place.x, target.z - place.z)
            const delta = Math.atan2(Math.sin(desired - figure.root.rotation.y), Math.cos(desired - figure.root.rotation.y))
            figure.root.rotation.y += delta * Math.min(1, dt * 4)
          }
          const sway = Math.sin(elapsed * 1.8 + figure.phase)
          figure.head.rotation.x = saying ? Math.sin(elapsed * 4.5 + figure.phase) * 0.06 : sway * 0.015
          figure.arms[1].rotation.x = saying ? -0.4 + Math.sin(elapsed * 3 + figure.phase) * 0.12 : sway * 0.03
          figure.arms[0].rotation.x = -sway * 0.03
        }
        const shows = frame.displays[entry.id]
        if (entry.screen && shows) {
          drawScreen(entry.screen, shows)
          entry.screen.sprite.position.set(place.x, place.y + 1.2, place.z)
        }
        if (entry.panel && shows) drawPanel(entry.panel, shows)
        const light = entry.root?.userData.light as THREE.Object3D | undefined
        if (light) light.visible = Math.sin(elapsed * 5) > -0.3
        const name = frame.names[entry.id]
        if (name && near <= TAG_M && !saying) {
          entry.tag ??= canvasSprite(512, 60, true)
          drawTag(entry.tag, name)
          entry.tag.sprite.scale.set(0.38, 0.045, 1)
          entry.tag.sprite.position.set(place.x, place.y + (TAG_LIFT[entry.id] ?? lift.tag), place.z)
          entry.tag.sprite.visible = true
        } else if (entry.tag) { entry.tag.sprite.visible = false }
        if (saying && near <= BUBBLE_M) {
          entry.bubble ??= canvasSprite(512, 200, true)
          drawBubble(entry.bubble, saying)
          entry.bubble.sprite.scale.set(0.4, 0.157, 1)
          entry.bubble.sprite.position.set(place.x, place.y + lift.bubble - 0.4, place.z)
          entry.bubble.sprite.visible = true
        } else if (entry.bubble) { entry.bubble.sprite.visible = false }
        const pinned = frame.pins.includes(entry.id)
        let pin = pins.get(entry.id)
        if (pinned && !pin) {
          pin = new THREE.Sprite(pinMaterial)
          pin.scale.set(0.045, 0.06, 1)
          pin.center.set(0.5, 0)
          pin.renderOrder = 999
          group.add(pin)
          pins.set(entry.id, pin)
        }
        if (pin) {
          // Up close the bubble and the interaction prompt already mark the target.
          const bubbled = Boolean(saying) && near <= BUBBLE_M
          pin.visible = pinned && !(bubbled && near < 8)
          pin.position.set(place.x, place.y + (bubbled ? lift.bubble + 0.3 : lift.pin) + Math.sin(elapsed * 2.6) * 0.05, place.z)
        }
      }
    },
    /** Whether a cast member's figure or prop is standing in the world now. */
    standing: (id: CastId) => Boolean(entries.get(id)?.root),
    dispose () {
      if (disposed) return
      disposed = true
      scene.remove(group)
      group.removeFromParent()
      for (const value of disposables) value.dispose()
    }
  }
}
export type CampusCast = ReturnType<typeof createCampusCast>
