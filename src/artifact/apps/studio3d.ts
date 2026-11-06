/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The Colorway studio's stage. Everything is modeled in code. It renders on demand: a still scene costs nothing.
import {
  ACESFilmicToneMapping, AdditiveBlending, AmbientLight, BufferAttribute, CanvasTexture, Color, CylinderGeometry, DirectionalLight, Group, LatheGeometry, Mesh, MeshBasicMaterial,
  MeshPhysicalMaterial, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, PMREMGenerator, PointLight, RepeatWrapping, Scene, SplineCurve, Sprite, SpriteMaterial,
  SRGBColorSpace, TorusGeometry, Vector2, Vector3, WebGLRenderer, type Material, type Object3D, type Texture,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { COLORS, kelvinToRgb } from './logic'

export type StudioView = 'sand' | 'slate' | 'compare'
export interface StudioLook { kelvin: number; brightness: number; view: StudioView }
export interface StudioControl { set(look: StudioLook): void; nudge(dAz: number, dEl: number): void; dispose(): void }

function radial(stops: [number, string][], size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [at, color] of stops) grad.addColorStop(at, color)
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}
/** Fine ceramic grain: enough to catch the light, too small to read as a pattern. */
function grain() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const img = g.createImageData(256, 256)
  for (let i = 0; i < img.data.length; i += 4) { const v = 118 + Math.random() * 20; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255 }
  g.putImageData(img, 0, 0)
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(6, 3)
  return t
}

interface Lamp { group: Group; body: MeshPhysicalMaterial; glass: MeshPhysicalMaterial; heart: PointLight; halo: SpriteMaterial; pool: MeshBasicMaterial }

function buildLamp(textures: Texture[], bump: Texture, haloTex: Texture, poolTex: Texture, shadowTex: Texture): Lamp {
  const group = new Group()
  // The base: a low turned drum with a soft shoulder. You turn it to set the light, so it wears one fine seam.
  const prof = new SplineCurve([new Vector2(0.74, 0.0), new Vector2(0.78, 0.03), new Vector2(0.79, 0.12), new Vector2(0.77, 0.26), new Vector2(0.68, 0.38), new Vector2(0.52, 0.46), new Vector2(0.4, 0.49)]).getPoints(64)
  const body = new MeshPhysicalMaterial({ color: COLORS.sand.hex, roughness: 0.62, metalness: 0, bumpMap: bump, bumpScale: 0.25, sheen: 0.35, sheenRoughness: 0.6, clearcoat: 0.12, clearcoatRoughness: 0.5, dithering: true })
  const base = new Mesh(new LatheGeometry([new Vector2(0, 0), ...prof, new Vector2(0, 0.49)], 128), body)
  base.castShadow = true; base.receiveShadow = true
  group.add(base)
  const brass = new MeshStandardMaterial({ color: 0xbfa27a, roughness: 0.32, metalness: 1 })
  const seam = new Mesh(new TorusGeometry(0.788, 0.006, 12, 160), brass)
  seam.rotation.x = Math.PI / 2
  seam.position.y = 0.13
  group.add(seam)
  const collar = new Mesh(new CylinderGeometry(0.41, 0.42, 0.035, 96), brass)
  collar.position.y = 0.5
  group.add(collar)
  // Opal glass: a soft sphere, slightly taller than wide. Nothing inside can be seen, as the spec demands.
  const gp: Vector2[] = []
  for (let i = 0; i <= 96; i++) { const th = 0.448 + (i / 96) * (Math.PI - 0.448); gp.push(new Vector2(Math.max(0.001, 0.9 * Math.sin(th)), 1.36 - 0.92 * Math.cos(th))) }
  const strip = document.createElement('canvas')
  strip.width = 4; strip.height = 256
  const s = strip.getContext('2d')!
  const grad = s.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#9c9c9c'); grad.addColorStop(0.3, '#ffffff'); grad.addColorStop(0.62, '#ffffff'); grad.addColorStop(1, '#a8a8a8')
  s.fillStyle = grad; s.fillRect(0, 0, 4, 256)
  const emissiveMap = new CanvasTexture(strip)
  emissiveMap.colorSpace = SRGBColorSpace
  textures.push(emissiveMap)
  const glass = new MeshPhysicalMaterial({ color: 0xd6d1c8, roughness: 0.34, metalness: 0, emissive: 0xffffff, emissiveMap, emissiveIntensity: 0.8, clearcoat: 0.35, clearcoatRoughness: 0.4, envMapIntensity: 0.3, dithering: true })
  const globe = new Mesh(new LatheGeometry(gp, 128), glass)
  globe.castShadow = true
  group.add(globe)
  const heart = new PointLight(0xffffff, 8, 14, 1.8)
  heart.position.y = 1.35
  group.add(heart)
  const halo = new SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, opacity: 0.6 })
  const haloS = new Sprite(halo)
  haloS.scale.setScalar(4.8)
  haloS.position.y = 1.35
  haloS.renderOrder = 5
  group.add(haloS)
  const pool = new MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0.5 })
  const poolM = new Mesh(new PlaneGeometry(6.4, 6.4), pool)
  poolM.rotation.x = -Math.PI / 2
  poolM.position.y = 0.004
  group.add(poolM)
  const contact = new Mesh(new PlaneGeometry(2.12, 2.12), new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.85 }))
  contact.rotation.x = -Math.PI / 2
  contact.position.y = 0.006
  group.add(contact)
  return { group, body, glass, heart, halo, pool }
}

function makeRig(renderer: WebGLRenderer) {
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  const scene = new Scene()
  scene.background = new Color(0x000000)
  const pmrem = new PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.05).texture
  scene.environment = env

  // A seamless paper sweep, the backdrop of every product photo: flat floor, a soft curve, up the wall.
  const paper = new PlaneGeometry(40, 30, 1, 96)
  const pos = paper.attributes.position as BufferAttribute
  const R = 4, flat = 14, front = 12, arc = (R * Math.PI) / 2
  for (let i = 0; i < pos.count; i++) {
    const v = pos.getY(i) + 15 // distance along the sheet, 0 at the front edge
    let y = 0, z = front - v
    if (v > flat) {
      const along = v - flat
      const a = Math.min(along / R, Math.PI / 2)
      z = front - flat - R * Math.sin(a)
      y = R - R * Math.cos(a) + Math.max(0, along - arc)
    }
    pos.setXYZ(i, pos.getX(i), y, z)
  }
  paper.computeVertexNormals()
  const paperMat = new MeshStandardMaterial({ color: 0xe9e2d8, roughness: 0.96, metalness: 0, dithering: true, envMapIntensity: 0.3 })
  const sweep = new Mesh(paper, paperMat)
  sweep.receiveShadow = true
  scene.add(sweep)

  const textures: Texture[] = []
  const bump = grain(); textures.push(bump)
  const haloTex = radial([[0, 'rgba(255,255,255,.95)'], [0.2, 'rgba(255,255,255,.34)'], [0.5, 'rgba(255,255,255,.08)'], [1, 'rgba(255,255,255,0)']]); textures.push(haloTex)
  const poolTex = radial([[0, 'rgba(255,255,255,.75)'], [0.35, 'rgba(255,255,255,.3)'], [0.7, 'rgba(255,255,255,.06)'], [1, 'rgba(255,255,255,0)']]); textures.push(poolTex)
  const shadowTex = radial([[0, 'rgba(10,8,6,.8)'], [0.68, 'rgba(10,8,6,.7)'], [0.78, 'rgba(10,8,6,.16)'], [1, 'rgba(10,8,6,0)']]); textures.push(shadowTex)
  const a = buildLamp(textures, bump, haloTex, poolTex, shadowTex)
  const b = buildLamp(textures, bump, haloTex, poolTex, shadowTex)
  b.body.color.setHex(COLORS.slate.hex)
  scene.add(a.group, b.group)

  const key = new DirectionalLight(0xfff4e6, 1)
  key.position.set(-4.5, 7, 5)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.radius = 9
  key.shadow.blurSamples = 16
  key.shadow.bias = -0.0004
  const sc = key.shadow.camera
  sc.left = -6; sc.right = 6; sc.top = 6; sc.bottom = -6; sc.near = 1; sc.far = 22
  const fill = new AmbientLight(0xffffff, 0.2)
  scene.add(key, fill)

  const camera = new PerspectiveCamera(26, 16 / 9, 0.1, 80)
  const target = new Vector3(0, 1.08, 0)
  const dispose = () => {
    scene.traverse((o: Object3D) => {
      const m = o as Mesh
      m.geometry?.dispose?.()
      const mats = (Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) as Material[]
      mats.forEach((x) => x.dispose())
    })
    textures.forEach((t) => t.dispose())
    env.dispose(); pmrem.dispose(); renderer.dispose(); renderer.forceContextLoss()
  }
  return { scene, a, b, key, fill, paperMat, camera, target, dispose }
}
type Rig = ReturnType<typeof makeRig>

/** Everything the two sliders change. `spread` is 0 for one lamp, 1 for two. */
function applyLook(rig: Rig, kelvin: number, brightness: number, spread: number, color: Color) {
  const b = brightness / 100
  const [r, g, bl] = kelvinToRgb(kelvin)
  const glow = new Color().setRGB(r, g, bl, SRGBColorSpace)
  for (const lamp of [rig.a, rig.b]) {
    lamp.glass.emissive.copy(glow)
    lamp.glass.emissiveIntensity = 0.02 + b ** 0.8 * 0.92
    lamp.heart.color.copy(glow)
    lamp.heart.intensity = 2 + b * 26
    lamp.heart.visible = b > 0.005
    lamp.halo.color.copy(glow)
    lamp.halo.opacity = b ** 0.8 * 0.42
    lamp.pool.color.copy(glow)
    lamp.pool.opacity = b ** 0.8 * 0.3
  }
  // The room wakes with the lamp: almost dark before dawn, a soft daylight studio at full ramp.
  const room = 0.015 + b ** 2.4 * 0.72
  rig.scene.environmentIntensity = 0.06 + room * 0.55
  rig.key.intensity = 0.12 + room * 1.5
  rig.fill.intensity = 0.015 + room * 0.28
  rig.scene.background = new Color(0x050404).lerp(new Color(0xd7d0c6), room)
  rig.paperMat.color.setHex(0xefe9e0)
  // positions
  const x = 1.42 * spread
  rig.a.group.position.x = -x
  rig.b.group.position.x = x
  rig.b.group.visible = spread > 0.02
  rig.a.body.color.copy(color)
}
function placeCamera(rig: Rig, az: number, el: number, spread: number, aspect: number) {
  const narrow = aspect < 1.25
  const need = 8.1 + spread * 3.3 + (narrow ? (1.25 - aspect) * (spread ? 13 : 5) : 0)
  rig.camera.aspect = aspect
  rig.camera.fov = 26
  rig.camera.updateProjectionMatrix()
  const y = rig.target.y + Math.sin(el) * need
  const flat = Math.cos(el) * need
  rig.camera.position.set(Math.sin(az) * flat, y, Math.cos(az) * flat)
  rig.camera.lookAt(rig.target)
}

const posters = new Map<string, string>()
export function renderPoster(w: number, h: number): string {
  const key = `${w}x${h}`
  const known = posters.get(key)
  if (known) return known
  const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
  renderer.setSize(w, h, false)
  const rig = makeRig(renderer)
  applyLook(rig, 2100, 52, 1, new Color(COLORS.sand.hex))
  placeCamera(rig, 0.25, 0.14, 1, w / h)
  renderer.render(rig.scene, rig.camera)
  const url = renderer.domElement.toDataURL('image/jpeg', 0.9)
  rig.dispose()
  posters.set(key, url)
  return url
}

export function createStudio(host: HTMLElement, look: StudioLook, onLost: () => void): StudioControl {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
  const canvas = renderer.domElement
  host.appendChild(canvas)
  const rig = makeRig(renderer)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const goal = { ...look }
  let kelvin = look.kelvin, brightness = look.brightness
  let spread = look.view === 'compare' ? 1 : 0
  const color = new Color(look.view === 'slate' ? COLORS.slate.hex : COLORS.sand.hex)
  const goalColor = color.clone()
  let az = 0.32, el = 0.13, tAz = az, tEl = el
  let aspect = 16 / 9
  let raf = 0, dirty = true, dead = false, last = 0
  const ease = (dt: number, k: number) => (reduced ? 1 : 1 - Math.exp(-dt * k))
  const frame = (now: number) => {
    raf = 0
    if (dead || document.hidden) return
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now
    const near = (a: number, b: number, e: number) => Math.abs(a - b) < e
    const targetSpread = goal.view === 'compare' ? 1 : 0
    let moving = false
    const step = (cur: number, to: number, k: number, e: number) => { if (near(cur, to, e)) return to; moving = true; return cur + (to - cur) * ease(dt, k) }
    kelvin = step(kelvin, goal.kelvin, 14, 1)
    brightness = step(brightness, goal.brightness, 14, 0.05)
    spread = step(spread, targetSpread, 8, 0.002)
    az = step(az, tAz, 12, 0.0005)
    el = step(el, tEl, 12, 0.0005)
    goalColor.setHex(goal.view === 'slate' ? COLORS.slate.hex : COLORS.sand.hex)
    if (color.getHex() !== goalColor.getHex()) {
      color.lerp(goalColor, ease(dt, 8))
      if (Math.abs(color.r - goalColor.r) + Math.abs(color.g - goalColor.g) + Math.abs(color.b - goalColor.b) < 0.003) color.copy(goalColor)
      moving = true
    }
    if (dirty || moving) {
      applyLook(rig, kelvin, brightness, spread, color)
      placeCamera(rig, az, el, spread, aspect)
      renderer.render(rig.scene, rig.camera)
      host.dataset.frames = String(Number(host.dataset.frames ?? 0) + 1)
      dirty = false
    }
    if (moving) raf = requestAnimationFrame(frame)
  }
  const wake = () => { if (!raf && !dead && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame) } }
  const ro = new ResizeObserver(() => {
    const w = host.clientWidth, h = host.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    aspect = w / h
    dirty = true
    wake()
  })
  ro.observe(host)
  document.addEventListener('visibilitychange', wake)
  let dragging = false, px = 0, py = 0
  const limit = (a: number) => Math.max(-0.95, Math.min(0.95, a))
  const limitEl = (a: number) => Math.max(0.03, Math.min(0.5, a))
  const down = (e: PointerEvent) => { dragging = true; px = e.clientX; py = e.clientY; canvas.setPointerCapture(e.pointerId); host.classList.add('grabbing') }
  const move = (e: PointerEvent) => {
    if (!dragging) return
    tAz = limit(tAz - (e.clientX - px) * 0.006)
    tEl = limitEl(tEl + (e.clientY - py) * 0.003)
    px = e.clientX; py = e.clientY
    wake()
  }
  const up = () => { dragging = false; host.classList.remove('grabbing') }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)
  const lost = (e: Event) => { e.preventDefault(); onLost() }
  canvas.addEventListener('webglcontextlost', lost)
  return {
    set: (l) => { Object.assign(goal, l); dirty = true; wake() },
    nudge: (dAz, dEl) => { tAz = limit(tAz + dAz); tEl = limitEl(tEl + dEl); dirty = true; wake() },
    dispose: () => {
      dead = true
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', wake)
      canvas.removeEventListener('webglcontextlost', lost)
      rig.dispose()
      canvas.remove()
    },
  }
}
