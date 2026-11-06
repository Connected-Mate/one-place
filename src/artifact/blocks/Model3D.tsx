// three.js is only reached through the dynamic import of ./scene3d, so it never lands in the main bundle.
import { useEffect, useRef, useState } from 'react'
import type { Block } from '../../data/types'
import { useT } from '../../i18n'
import { Frame, prefersReducedMotion } from '../shared'
import type { SceneControl, Tint } from './scene3d'

const hasWebGL = () => {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}
const TINTS: { id: Tint; fr: string; en: string; css: string }[] = [
  { id: 'warm', fr: 'Chaud', en: 'Warm', css: '#ffb26b' },
  { id: 'dawn', fr: 'Aube', en: 'Dawn', css: '#ff8a80' },
  { id: 'dusk', fr: 'Crépuscule', en: 'Dusk', css: '#8f86ff' },
]

function StaticModel({ model, color }: { model: 'lamp' | 'desk' | 'badge'; color: string }) {
  return (
    <div className={`rp-static rp-static-${model}`} style={{ '--lamp': color } as React.CSSProperties} aria-hidden="true">
      {model === 'lamp' && <><i className="halo" /><i className="globe" /><i className="base" /></>}
      {model === 'desk' && <><i className="screen" /><i className="top" /><i className="leg l" /><i className="leg r" /></>}
      {model === 'badge' && <><i className="strap" /><i className="card" /></>}
    </div>
  )
}

/** The Overview tile: a real render as a picture, turning live only while hovered or focused. */
export function ModelTilePreview({ model }: { model: 'lamp' | 'desk' | 'badge' }) {
  const root = useRef<HTMLSpanElement>(null)
  const host = useRef<HTMLSpanElement>(null)
  const [poster, setPoster] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  useEffect(() => {
    if (!hasWebGL()) return
    let dead = false
    const run = () => import('./scene3d').then((m) => {
      if (dead) return
      const r = root.current?.getBoundingClientRect()
      setPoster(m.renderPoster(model, Math.round(r?.width || 320) || 320, Math.round(r?.height || 240) || 240))
    }).catch(() => { /* the CSS still image stays */ })
    const idle = window.requestIdleCallback?.(run, { timeout: 1500 }) ?? window.setTimeout(run, 300)
    return () => { dead = true; if (window.cancelIdleCallback) window.cancelIdleCallback(idle); else clearTimeout(idle) }
  }, [model])
  useEffect(() => {
    const tile = root.current?.closest('button')
    if (!tile || prefersReducedMotion() || !hasWebGL()) return
    let made: SceneControl | null = null
    let timer = 0
    let wanted = false
    const on = () => {
      wanted = true
      timer = window.setTimeout(() => {
        import('./scene3d').then((m) => {
          if (!wanted || made || !host.current) return
          made = m.createScene(host.current, { model, tint: 'warm', onLost: () => { made = null; setLive(false) } })
          setLive(true)
        }).catch(() => undefined)
      }, 180)
    }
    const off = () => { wanted = false; clearTimeout(timer); made?.dispose(); made = null; setLive(false) }
    tile.addEventListener('pointerenter', on); tile.addEventListener('pointerleave', off)
    tile.addEventListener('focus', on); tile.addEventListener('blur', off)
    return () => {
      tile.removeEventListener('pointerenter', on); tile.removeEventListener('pointerleave', off)
      tile.removeEventListener('focus', on); tile.removeEventListener('blur', off)
      off()
    }
  }, [model])
  return (
    <span ref={root} className={`rp-t-3d${live ? ' live' : ''}`} aria-hidden="true">
      {poster ? <img src={poster} alt="" /> : <StaticModel model={model} color="#ffb26b" />}
      <span ref={host} className="rp-t-3d-live" />
    </span>
  )
}

export function Model3DBlock({ block }: { block: Extract<Block, { type: 'model3d' }> }) {
  const t = useT()
  const host = useRef<HTMLDivElement>(null)
  const ctl = useRef<SceneControl | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading')
  const [tint, setTint] = useState<Tint>('warm')
  const tintRef = useRef(tint)
  tintRef.current = tint
  const isLamp = block.model === 'lamp'

  useEffect(() => {
    let dead = false
    if (!hasWebGL()) { setStatus('fallback'); return }
    setStatus('loading')
    let made: SceneControl | null = null
    import('./scene3d')
      .then((m) => {
        if (dead || !host.current) return
        made = m.createScene(host.current, { model: block.model, tint: tintRef.current, onLost: () => { if (!dead) { ctl.current = null; setStatus('fallback') } } })
        ctl.current = made
        setStatus('ready')
      })
      .catch(() => { if (!dead) setStatus('fallback') }) // offline chunk or renderer refused: degrade quietly
    return () => { dead = true; made?.dispose(); ctl.current = null }
  }, [block.model])

  const pick = (id: Tint) => { setTint(id); ctl.current?.setTint(id) }
  const onKey = (e: React.KeyboardEvent) => {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
    if (!step || !ctl.current) return
    e.preventDefault()
    ctl.current.nudge(step[0] * 0.18, step[1] * 0.1)
  }
  const name = block.model === 'lamp' ? t({ fr: 'Lampe de chevet connectée', en: 'Smart bedside lamp' }) : block.model === 'desk' ? t({ fr: 'Bureau', en: 'Desk' }) : t({ fr: 'Badge', en: 'Badge' })
  const color = TINTS.find((x) => x.id === tint)!.css
  const ready = status === 'ready'

  return (
    <Frame block={block}>
      <div
        className={`rp-3d ${status}`}
        data-status={status}
        role="group"
        tabIndex={ready ? 0 : undefined}
        aria-label={ready
          ? t({ fr: `${name}, modèle 3D. Flèches ou glisser pour tourner.`, en: `${name}, 3D model. Arrow keys or drag to rotate.` })
          : t({ fr: `${name}, image fixe.`, en: `${name}, still image.` })}
        onKeyDown={onKey}
      >
        <div ref={host} className="rp-3d-host" />
        {!ready && <StaticModel model={block.model} color={color} />}
      </div>
      {status === 'fallback' && <p className="rp-meta">{t({ fr: 'Aperçu fixe : la 3D n’est pas disponible sur cet appareil.', en: 'Still preview: 3D is not available on this device.' })}</p>}
      {(isLamp || block.caption) && (
        <div className="rp-3d-foot">
          {block.caption && <p className="rp-meta rp-3d-caption">{t(block.caption)}</p>}
          {isLamp && (
            <div className="rp-3d-chips" role="group" aria-label={t({ fr: 'Couleur de la lumière', en: 'Light color' })}>
              {TINTS.map((x) => (
                <button key={x.id} type="button" className={`chip click${tint === x.id ? ' selected' : ''}`} aria-pressed={tint === x.id} onClick={() => pick(x.id)}>
                  <i className="rp-3d-dot" style={{ background: x.css }} />{t({ fr: x.fr, en: x.en })}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Frame>
  )
}
