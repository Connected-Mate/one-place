/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Loaded on demand only. Everything is modeled in code: no asset file.
import {
  AmbientLight, CanvasTexture, CatmullRomCurve3, CylinderGeometry, DirectionalLight, DoubleSide, ExtrudeGeometry, Group, LatheGeometry, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, PMREMGenerator, PointLight, Scene, Shape, SphereGeometry, SplineCurve,
  Sprite, SpriteMaterial, SRGBColorSpace, TorusGeometry, TubeGeometry, Vector2, Vector3, WebGLRenderer, ACESFilmicToneMapping, Color, Texture,
  type Material, type Object3D,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

export type Tint = 'warm' | 'dawn' | 'dusk'
export interface SceneControl { setTint(t: Tint): void; nudge(dYaw: number, dPitch: number): void; dispose(): void }
interface Options { model: 'lamp' | 'desk' | 'badge'; tint: Tint; onLost(): void }

const TINT: Record<Tint, number> = { warm: 0xffb26b, dawn: 0xff8a80, dusk: 0x8f86ff }

function radialTexture(stops: [number, string][], size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [at, color] of stops) grad.addColorStop(at, color)
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function floorDisc(size: number, tex: Texture, opacity: number, color = 0xffffff) {
  const m = new Mesh(new PlaneGeometry(size, size), new MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, color }))
  m.rotation.x = -Math.PI / 2
  return m
}

interface Built { root: Group; update?: (c: Color) => void; height: number; distance: number }

function buildLamp(textures: Texture[]): Built {
  const root = new Group()
  const charcoal = new MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.48, metalness: 0.15 })
  const brass = new MeshStandardMaterial({ color: 0xc9a26b, roughness: 0.28, metalness: 1 })

  // Lathe-turned foot: a low shoulder that tapers towards the collar.
  const foot = new SplineCurve([
    new Vector2(0.66, 0.04), new Vector2(0.67, 0.1), new Vector2(0.6, 0.2), new Vector2(0.38, 0.33), new Vector2(0.25, 0.45), new Vector2(0.22, 0.56),
  ]).getPoints(48)
  const base = new Mesh(new LatheGeometry([new Vector2(0, 0), new Vector2(0.63, 0), ...foot, new Vector2(0, 0.56)], 96), charcoal)
  root.add(base)

  const collar = new Mesh(new LatheGeometry([new Vector2(0.235, 0.54), new Vector2(0.25, 0.56), new Vector2(0.25, 0.62), new Vector2(0.2, 0.64)], 64), brass)
  root.add(collar)

  // Opal glass globe, brighter at its heart: the emissive map follows the lathe's profile.
  const profile = new SplineCurve([
    new Vector2(0.17, 0.62), new Vector2(0.42, 0.74), new Vector2(0.6, 1.02), new Vector2(0.6, 1.34), new Vector2(0.42, 1.62), new Vector2(0.17, 1.76), new Vector2(0.001, 1.79),
  ]).getPoints(72)
  const strip = document.createElement('canvas')
  strip.width = 4; strip.height = 256
  const g = strip.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#7a7a7a'); grad.addColorStop(0.35, '#ffffff'); grad.addColorStop(0.72, '#f2f2f2'); grad.addColorStop(1, '#6e6e6e')
  g.fillStyle = grad
  g.fillRect(0, 0, 4, 256)
  const emissiveMap = new CanvasTexture(strip)
  emissiveMap.colorSpace = SRGBColorSpace
  textures.push(emissiveMap)
  const glassMat = new MeshStandardMaterial({ color: 0xd9d4ce, roughness: 0.32, metalness: 0, emissive: 0xffffff, emissiveMap, emissiveIntensity: 0.92, envMapIntensity: 0.35, side: DoubleSide })
  root.add(new Mesh(new LatheGeometry(profile, 96), glassMat))

  // A thin brass hoop around the globe: it also makes the rotation readable on a round object.
  const hoop = new Mesh(new TorusGeometry(0.76, 0.016, 16, 128, Math.PI * 1.62), brass)
  hoop.position.y = 1.2
  hoop.rotation.z = -Math.PI * 0.31
  root.add(hoop)
  for (const side of [-1, 1]) { // two short rods tie the hoop to the collar
    const rod = new Mesh(new CylinderGeometry(0.016, 0.016, 0.22, 12), brass)
    rod.position.set(side * 0.335, 0.572, 0)
    rod.rotation.z = Math.PI / 2
    root.add(rod)
  }

  // Touch dial and status light on the shoulder, power cord leaving from the back.
  const dial = new Mesh(new CylinderGeometry(0.075, 0.08, 0.04, 40), brass)
  dial.position.set(0.3, 0.335, 0.32)
  dial.rotation.set(0.62, 0, -0.45)
  root.add(dial)
  const ledMat = new MeshBasicMaterial({ color: 0xffffff })
  const led = new Mesh(new SphereGeometry(0.017, 16, 16), ledMat)
  led.position.set(-0.2, 0.34, 0.45)
  root.add(led)

  const cordPath = new CatmullRomCurve3([
    new Vector3(0, 0.05, -0.6), new Vector3(0, 0.03, -0.9), new Vector3(0.28, 0.022, -1.2), new Vector3(0.8, 0.022, -1.22), new Vector3(1.3, 0.022, -0.95),
  ])
  root.add(new Mesh(new TubeGeometry(cordPath, 64, 0.018, 10), new MeshStandardMaterial({ color: 0x8a8d91, roughness: 0.9 })))
  const plug = new Mesh(new RoundedBoxGeometry(0.13, 0.08, 0.2, 4, 0.03), charcoal)
  plug.position.set(1.36, 0.045, -0.9)
  plug.rotation.y = 1.0
  root.add(plug)

  // What the light does around it. The halo is plain alpha blending so it stays visible on a white panel.
  const heart = new PointLight(0xffffff, 3.5, 7, 1.6)
  heart.position.y = 1.15
  root.add(heart)
  const haloTex = radialTexture([[0, 'rgba(255,255,255,.75)'], [0.28, 'rgba(255,255,255,.36)'], [0.62, 'rgba(255,255,255,.08)'], [1, 'rgba(255,255,255,0)']])
  textures.push(haloTex)
  const haloMat = new SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, opacity: 0.85 })
  const halo = new Sprite(haloMat)
  halo.scale.setScalar(3.6)
  halo.position.y = 1.2
  halo.renderOrder = -1
  root.add(halo)
  const poolTex = radialTexture([[0, 'rgba(255,255,255,.75)'], [0.45, 'rgba(255,255,255,.28)'], [1, 'rgba(255,255,255,0)']])
  textures.push(poolTex)
  const pool = floorDisc(4.4, poolTex, 0.55)
  pool.position.y = 0.002
  pool.renderOrder = -2
  root.add(pool)
  const shadowTex = radialTexture([[0, 'rgba(0,0,0,.7)'], [0.55, 'rgba(0,0,0,.5)'], [0.72, 'rgba(0,0,0,.14)'], [1, 'rgba(0,0,0,0)']])
  textures.push(shadowTex)
  const shadow = floorDisc(1.85, shadowTex, 0.55)
  shadow.position.y = 0.004
  root.add(shadow)

  return {
    root, height: 1.02, distance: 7.2,
    update: (c) => {
      glassMat.emissive.copy(c)
      heart.color.copy(c)
      haloMat.color.copy(c)
      ;(pool.material as MeshBasicMaterial).color.copy(c)
      ledMat.color.copy(c)
    },
  }
}

function buildDesk(textures: Texture[]): Built {
  const root = new Group()
  const wood = new MeshStandardMaterial({ color: 0xb98a5e, roughness: 0.55 })
  const metal = new MeshStandardMaterial({ color: 0x3c4043, roughness: 0.4, metalness: 0.7 })
  const top = new Mesh(new RoundedBoxGeometry(3, 0.09, 1.4, 4, 0.035), wood)
  top.position.y = 1.2
  root.add(top)
  for (const [x, z] of [[-1.3, -0.55], [1.3, -0.55], [-1.3, 0.55], [1.3, 0.55]]) {
    const leg = new Mesh(new CylinderGeometry(0.035, 0.025, 1.16, 16), metal)
    leg.position.set(x, 0.58, z)
    leg.rotation.z = x > 0 ? 0.05 : -0.05
    root.add(leg)
  }
  const screen = new Mesh(new RoundedBoxGeometry(1.3, 0.76, 0.04, 4, 0.018), metal)
  screen.position.set(0, 1.82, -0.25)
  root.add(screen)
  const glow = new Mesh(new PlaneGeometry(1.22, 0.68), new MeshStandardMaterial({ color: 0x0b57d0, emissive: 0x4285f4, emissiveIntensity: 0.8, roughness: 0.3 }))
  glow.position.set(0, 1.82, -0.228)
  root.add(glow)
  const neck = new Mesh(new CylinderGeometry(0.03, 0.03, 0.3, 16), metal)
  neck.position.set(0, 1.39, -0.27)
  root.add(neck)
  const foot = new Mesh(new CylinderGeometry(0.17, 0.19, 0.02, 32), metal)
  foot.position.set(0, 1.255, -0.27)
  root.add(foot)
  const shadowTex = radialTexture([[0, 'rgba(0,0,0,.42)'], [0.6, 'rgba(0,0,0,.2)'], [1, 'rgba(0,0,0,0)']])
  textures.push(shadowTex)
  const shadow = floorDisc(4.2, shadowTex, 0.6)
  shadow.position.y = 0.002
  root.add(shadow)
  return { root, height: 1.15, distance: 8.6 }
}

function buildBadge(textures: Texture[]): Built {
  const root = new Group()
  const w = 1.1, h = 1.6, r = 0.1
  const shape = new Shape()
  shape.moveTo(-w / 2 + r, -h / 2)
  shape.lineTo(w / 2 - r, -h / 2); shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
  shape.lineTo(w / 2, h / 2 - r); shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
  shape.lineTo(-w / 2 + r, h / 2); shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
  shape.lineTo(-w / 2, -h / 2 + r); shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)
  const card = new Mesh(
    new ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 3, curveSegments: 16 }),
    new MeshStandardMaterial({ color: 0xf1f3f4, roughness: 0.38 }),
  )
  card.position.set(0, 1, -0.015)
  root.add(card)
  const c = document.createElement('canvas')
  c.width = 512; c.height = 744
  const g = c.getContext('2d')!
  g.fillStyle = '#f8fafd'; g.fillRect(0, 0, 512, 744)
  const band = g.createLinearGradient(0, 0, 512, 0)
  band.addColorStop(0, '#4285f4'); band.addColorStop(0.55, '#9b72cb'); band.addColorStop(1, '#d96570')
  g.fillStyle = band; g.fillRect(0, 0, 512, 170)
  g.fillStyle = '#d3e3fd'; g.beginPath(); g.arc(256, 340, 96, 0, 7); g.fill()
  g.fillStyle = '#0b57d0'; g.beginPath(); g.arc(256, 318, 38, 0, 7); g.fill(); g.beginPath(); g.ellipse(256, 402, 62, 34, 0, Math.PI, 0); g.fill()
  g.fillStyle = '#1f1f1f'; g.fillRect(126, 490, 260, 26)
  g.fillStyle = '#c4c7c5'; g.fillRect(166, 538, 180, 16); g.fillRect(186, 570, 140, 16)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  textures.push(tex)
  const face = new Mesh(new PlaneGeometry(w - 0.02, h - 0.02), new MeshStandardMaterial({ map: tex, roughness: 0.42 }))
  face.position.set(0, 1, 0.03)
  root.add(face)
  const metal = new MeshStandardMaterial({ color: 0xb0b4b9, roughness: 0.3, metalness: 1 })
  const clip = new Mesh(new RoundedBoxGeometry(0.2, 0.09, 0.05, 3, 0.02), metal)
  clip.position.set(0, 1.84, 0)
  root.add(clip)
  const strapPath = new CatmullRomCurve3([new Vector3(0, 1.86, 0), new Vector3(-0.2, 2.5, -0.1), new Vector3(-0.42, 3.3, -0.25)])
  const strapMat = new MeshStandardMaterial({ color: 0x0b57d0, roughness: 0.7 })
  root.add(new Mesh(new TubeGeometry(strapPath, 32, 0.022, 8), strapMat))
  root.add(new Mesh(new TubeGeometry(new CatmullRomCurve3([new Vector3(0, 1.86, 0), new Vector3(0.2, 2.5, -0.1), new Vector3(0.42, 3.3, -0.25)]), 32, 0.022, 8), strapMat))
  return { root, height: 1.25, distance: 8 }
}

function makeRig(renderer: WebGLRenderer, model: Options['model']) {
  renderer.setClearColor(0x000000, 0) // transparent: the panel shows through, in light and in dark
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  const scene = new Scene()
  const pmrem = new PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = env
  scene.environmentIntensity = 0.55
  const key = new DirectionalLight(0xffffff, 1.2)
  key.position.set(2.5, 4, 3)
  scene.add(key, new AmbientLight(0xffffff, 0.18))
  const textures: Texture[] = []
  const built = model === 'lamp' ? buildLamp(textures) : model === 'desk' ? buildDesk(textures) : buildBadge(textures)
  const pivot = new Group()
  pivot.add(built.root)
  scene.add(pivot)
  const camera = new PerspectiveCamera(28, 1, 0.1, 40)
  camera.position.set(0, built.height + 1.15, built.distance)
  camera.lookAt(0, built.height, 0)
  const frame = (w: number, h: number) => {
    camera.aspect = w / h
    // stay framed when the block is much narrower than it is tall
    camera.fov = w / h < 1 ? Math.min(46, 28 / (w / h)) : 28
    camera.updateProjectionMatrix()
  }
  const dispose = () => {
    scene.traverse((o: Object3D) => {
      const m = o as Mesh
      m.geometry?.dispose?.()
      const mats = (Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) as Material[]
      mats.forEach((x) => x.dispose())
    })
    textures.forEach((x) => x.dispose())
    env.dispose()
    pmrem.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
  }
  return { scene, built, pivot, camera, frame, dispose }
}

const posters = new Map<string, string>()
/** One real render as a picture, for the Overview tile: no running WebGL context until someone hovers it. */
export function renderPoster(model: Options['model'], w: number, h: number): string {
  const key = `${model}:${w}x${h}`
  const known = posters.get(key)
  if (known) return known
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
  renderer.setSize(w, h, false)
  const rig = makeRig(renderer, model)
  rig.built.update?.(new Color(TINT.warm))
  rig.frame(w, h)
  rig.pivot.rotation.set(0, model === 'badge' ? -0.35 : 0.5, 0)
  renderer.render(rig.scene, rig.camera)
  const url = renderer.domElement.toDataURL('image/png')
  rig.dispose()
  posters.set(key, url)
  return url
}

export function createScene(host: HTMLElement, opts: Options): SceneControl {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
  const canvas = renderer.domElement
  host.appendChild(canvas)
  const rig = makeRig(renderer, opts.model)
  const { scene, built, pivot, camera } = rig

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const color = new Color(TINT[opts.tint])
  const target = color.clone()
  built.update?.(color)

  let yaw = opts.model === 'badge' ? -0.35 : 0.5
  let pitch = 0
  let dirty = true
  let dragging = false
  let lastTouch = -1e9
  let visible = false
  let raf = 0
  let last = 0
  let dead = false

  const frame = (now: number) => {
    raf = 0
    if (dead || !visible || document.hidden) return
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now
    if (!reduced && !dragging && now - lastTouch > 2200) { yaw += dt * 0.28; dirty = true }
    if (color.getHex() !== target.getHex()) {
      color.lerp(target, reduced ? 1 : 1 - Math.exp(-dt * 7))
      if (Math.abs(color.r - target.r) + Math.abs(color.g - target.g) + Math.abs(color.b - target.b) < 0.004) color.copy(target)
      built.update?.(color)
      dirty = true
    }
    if (dirty) {
      pivot.rotation.set(pitch, yaw, 0)
      renderer.render(scene, camera)
      dirty = false
      host.dataset.frames = String(Number(host.dataset.frames ?? 0) + 1)
    }
    raf = requestAnimationFrame(frame)
  }
  const wake = () => { if (!raf && !dead && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame) } }

  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting)
    host.dataset.running = String(visible)
    wake()
  })
  io.observe(host)
  const ro = new ResizeObserver(() => {
    const w = host.clientWidth, h = host.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    rig.frame(w, h)
    dirty = true
    wake()
  })
  ro.observe(host)
  const onVisibility = () => wake()
  document.addEventListener('visibilitychange', onVisibility)

  let px = 0, py = 0
  const down = (e: PointerEvent) => {
    dragging = true
    px = e.clientX; py = e.clientY
    canvas.setPointerCapture(e.pointerId)
    host.classList.add('grabbing')
  }
  const move = (e: PointerEvent) => {
    if (!dragging) return
    yaw += (e.clientX - px) * 0.012
    pitch = Math.max(-0.4, Math.min(0.45, pitch + (e.clientY - py) * 0.006))
    px = e.clientX; py = e.clientY
    lastTouch = performance.now()
    dirty = true
    wake()
  }
  const up = () => { dragging = false; lastTouch = performance.now(); host.classList.remove('grabbing') }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)
  const lost = (e: Event) => { e.preventDefault(); opts.onLost() }
  canvas.addEventListener('webglcontextlost', lost)

  return {
    setTint: (t) => { target.set(TINT[t]); dirty = true; wake() },
    nudge: (dYaw, dPitch) => {
      yaw += dYaw
      pitch = Math.max(-0.4, Math.min(0.45, pitch + dPitch))
      lastTouch = performance.now()
      dirty = true
      wake()
    },
    dispose: () => {
      dead = true
      if (raf) cancelAnimationFrame(raf)
      io.disconnect(); ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('webglcontextlost', lost)
      rig.dispose()
      canvas.remove()
    },
  }
}
