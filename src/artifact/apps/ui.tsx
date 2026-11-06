/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Controls every Gemini-built tool shares: a real Material slider, segmented buttons, the verdict card, saved state.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Block } from '../../data/types'
import { useStore } from '../../store'
import { Icon, Sparkle } from '../../ui/kit'
import { useBoard } from '../shared'

export type AppBlock = Extract<Block, { type: 'app' }>
export interface AppProps { block: AppBlock }

/**
 * What people did with a tool. Every drag updates the screen at once and reaches the store a moment later:
 * writing the whole persisted store on each pointer move would drop frames.
 */
export function useAppState<T extends Record<string, unknown>>(block: AppBlock, defaults: T) {
  const { project } = useBoard()
  const pid = project.id
  const [state, setState] = useState<T>(() => ({ ...defaults, ...(block.state as Partial<T>) }))
  const pending = useRef<T | null>(null)
  const timer = useRef(0)
  const sent = useRef(JSON.stringify(block.state ?? null))
  const flush = useCallback(() => {
    clearTimeout(timer.current)
    if (!pending.current) return
    const next = pending.current
    pending.current = null
    sent.current = JSON.stringify(next)
    useStore.getState().patchBlock(pid, block.id, { state: next } as Partial<Block>)
  }, [pid, block.id])
  const update = useCallback((patch: Partial<T> | ((s: T) => Partial<T>)) => {
    setState((s) => {
      const next = { ...s, ...(typeof patch === 'function' ? patch(s) : patch) }
      pending.current = next
      return next
    })
    clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, 180)
  }, [flush])
  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => { window.removeEventListener('pagehide', flush); flush() }
  }, [flush])
  // Changed from outside, by Gemini ("update Deal calculator: price 112"): follow it.
  const incoming = JSON.stringify(block.state ?? null)
  useEffect(() => {
    if (incoming === sent.current || pending.current) return
    sent.current = incoming
    setState((s) => ({ ...s, ...(block.state as Partial<T>) }))
  }, [incoming]) // eslint-disable-line react-hooks/exhaustive-deps
  return [state, update, flush] as const
}

export function Slider({ label, value, min, max, step = 1, onChange, onCommit, text, marks, disabled, hideLabel }: {
  label: string; value: number; min: number; max: number; step?: number
  onChange: (v: number) => void; onCommit?: () => void; text?: string
  marks?: { at: number; label: string; tone?: 'bad' | 'ai'; side?: 'left' }[]; disabled?: boolean; hideLabel?: boolean
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="ap-slider" data-disabled={disabled || undefined}>
      {!hideLabel && <div className="ap-slider-head"><span>{label}</span>{text != null && <b>{text}</b>}</div>}
      <div className="ap-slider-track" style={{ '--p': `${pct}%` } as CSSProperties}>
        <input type="range" aria-label={label} aria-valuetext={text} min={min} max={max} step={step} value={value} disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))} onPointerUp={onCommit} onKeyUp={onCommit} />
        {marks?.map((m) => <i key={m.at} className={`ap-slider-tick${m.tone ? ` ${m.tone}` : ''}`} style={{ left: `calc(${((m.at - min) / (max - min)) * 100}% + ${10 - ((m.at - min) / (max - min)) * 20}px)` }} />)}
      </div>
      {marks && (
        <div className="ap-slider-marks" aria-hidden="true">
          {marks.map((m) => <button key={m.at} type="button" tabIndex={-1} className={`${m.tone ?? ''}${m.side ? ` ${m.side}` : ''}`} style={{ left: `calc(${((m.at - min) / (max - min)) * 100}% + ${10 - ((m.at - min) / (max - min)) * 20}px)` }} onClick={() => { onChange(m.at); onCommit?.() }}>{m.label}</button>)}
        </div>
      )}
    </div>
  )
}

export function Seg<T extends string>({ label, value, options, onChange, size }: { label: string; value: T; options: { id: T; label: ReactNode; aria?: string }[]; onChange: (v: T) => void; size?: 's' }) {
  return (
    <div className={`ap-seg${size === 's' ? ' s' : ''}`} role="radiogroup" aria-label={label}
      onKeyDown={(e) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
        e.preventDefault()
        const i = options.findIndex((o) => o.id === value)
        const next = options[(i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length]
        onChange(next.id)
        requestAnimationFrame(() => (e.currentTarget.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus())
      }}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={o.id === value} aria-label={o.aria} tabIndex={o.id === value ? 0 : -1} onClick={() => onChange(o.id)}>
          {o.id === value && <Icon name="check" size={16} />}{o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({ label, on, onChange, hint }: { label: ReactNode; on: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`ap-switch${on ? ' on' : ''}`} onClick={() => onChange(!on)}>
      <span className="ap-switch-text"><span>{label}</span>{hint && <small>{hint}</small>}</span>
      <i aria-hidden="true"><u>{on && <Icon name="check" size={14} />}</u></i>
    </button>
  )
}

/** Gemini speaking inside a tool. Announced to screen readers when it changes. */
export function Verdict({ children, tone, title = 'Gemini' }: { children: ReactNode; tone?: 'bad' | 'good' | 'warn'; title?: string }) {
  return (
    <div className={`ap-verdict${tone ? ` ${tone}` : ''}`}>
      <Sparkle size={20} />
      <div><small>{title}</small><p aria-live="polite">{children}</p></div>
    </div>
  )
}

export function Stat({ label, value, note, tone, children }: { label: string; value: ReactNode; note?: ReactNode; tone?: 'bad' | 'good' | 'warn'; children?: ReactNode }) {
  return (
    <div className="ap-stat">
      <span className="ap-stat-label">{label}</span>
      <b className={`ap-stat-value${tone ? ` ${tone}` : ''}`}>{value}</b>
      {children}
      {note && <span className="ap-stat-note">{note}</span>}
    </div>
  )
}

/** The real width of a box, for charts drawn in true pixels (text in a stretched viewBox looks wrong). */
export function useWidth<T extends HTMLElement>(initial = 600) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(initial)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => { if (el.clientWidth) setWidth(el.clientWidth) }
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

export const compose = (text: string) => window.dispatchEvent(new CustomEvent('oneplace:compose', { detail: { text } }))
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
