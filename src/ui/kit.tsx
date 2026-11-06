/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Small shared UI kit. Styles in ui/kit.css. Everyone reuses these instead of re-inventing them.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { personById } from '../store'
import type { Person } from '../data/types'
import './kit.css'

export const base = import.meta.env.BASE_URL

export function Icon({ name, fill, size, className = '', style }: { name: string; fill?: boolean; size?: number; className?: string; style?: React.CSSProperties }) {
  return <span aria-hidden="true" className={`ms${fill ? ' fill' : ''} ${className}`} style={{ ...(size ? { fontSize: size } : null), ...style }}>{name}</span>
}

/** Four-pointed sparkle in the Gemini gradient. Our own drawing, not the Gemini logo file. */
export function Sparkle({ size = 20, mono }: { size?: number; mono?: boolean }) {
  const id = useRef(`sp${Math.random().toString(36).slice(2, 8)}`).current
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" style={{ flex: 'none' }}>
      <defs><linearGradient id={id} x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#4285f4" /><stop offset=".55" stopColor="#9b72cb" /><stop offset="1" stopColor="#d96570" /></linearGradient></defs>
      <path fill={mono ? 'currentColor' : `url(#${id})`} d="M12 1c.7 5.9 4.1 9.3 11 11-6.9 1.7-10.3 5.1-11 11-.7-5.9-4.1-9.3-11-11 6.9-1.7 10.3-5.1 11-11Z" />
    </svg>
  )
}

export function Avatar({ id, person, size = 32, ring, status }: { id?: string; person?: Person; size?: number; ring?: boolean; status?: boolean }) {
  const p = person ?? personById(id ?? '')
  const [broken, setBroken] = useState(false)
  const initials = p.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span className={`avatar${ring ? ' ring' : ''}`} style={{ width: size, height: size, fontSize: size * 0.4, background: p.role === 'ai' ? 'var(--surface-2)' : p.hue }} title={p.name}>
      {p.role === 'ai' ? <Sparkle size={size * 0.62} />
        : p.avatar && !broken ? <img src={base + p.avatar} alt="" width={size} height={size} onError={() => setBroken(true)} />
        : <span aria-hidden="true">{initials}</span>}
      {status && p.role !== 'ai' && <span className={`dot ${p.presence}`} />}
    </span>
  )
}
export function AvatarStack({ ids, size = 28, max = 4 }: { ids: string[]; size?: number; max?: number }) {
  return (
    <span className="avatar-stack" aria-label={ids.map((i) => personById(i).name).join(', ')}>
      {ids.slice(0, max).map((i) => <Avatar key={i} id={i} size={size} ring />)}
      {ids.length > max && <span className="avatar more" style={{ width: size, height: size, fontSize: size * .38 }}>+{ids.length - max}</span>}
    </span>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon?: string; variant?: 'filled' | 'tonal' | 'outlined' | 'text' | 'danger'; size?: 's' | 'm' }
export function Button({ icon, variant = 'text', size = 'm', className = '', children, ...r }: BtnProps) {
  return <button type="button" {...r} className={`btn ${variant} ${size} ${className}`}>{icon && <Icon name={icon} size={18} />}{children}</button>
}
export function IconButton({ icon, label, active, fill, size = 40, className = '', ...r }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string; active?: boolean; fill?: boolean; size?: number }) {
  return (
    <button type="button" {...r} aria-label={label} title={label} aria-pressed={active} className={`icon-btn${active ? ' active' : ''} ${className}`} style={{ width: size, height: size }}>
      <Icon name={icon} fill={fill || active} size={size >= 36 ? 22 : 18} />
    </button>
  )
}
export function Chip({ icon, children, onClick, selected, className = '' }: { icon?: ReactNode; children: ReactNode; onClick?: () => void; selected?: boolean; className?: string }) {
  const C = onClick ? 'button' : 'span'
  return <C type={onClick ? 'button' : undefined} onClick={onClick} className={`chip${selected ? ' selected' : ''}${onClick ? ' click' : ''} ${className}`}>{typeof icon === 'string' ? <Icon name={icon} size={16} /> : icon}{children}</C>
}

/** Modal with focus trap, Esc to close, focus restored on close. */
export function Dialog({ title, onClose, children, width = 480, footer }: { title: ReactNode; onClose: () => void; children: ReactNode; width?: number; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const el = ref.current!
    const first = el.querySelector<HTMLElement>('[data-autofocus],input,textarea,button')
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      if (e.key !== 'Tab') return
      const items = [...el.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input,textarea,select,[tabindex="0"]')]
      if (!items.length) return
      const a = items[0], z = items[items.length - 1]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [onClose])
  return createPortal(
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" style={{ width: `min(${width}px, calc(100vw - 32px))` }}>
        <h2 id="dialog-title" className="dialog-title">{title}</h2>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>, document.body)
}

export interface MenuItem { icon?: ReactNode; label: ReactNode; onSelect?: () => void; selected?: boolean; hint?: ReactNode; divider?: boolean; disabled?: boolean }
/** Anchored popup menu: arrow keys, Esc, click outside. */
export function Menu({ trigger, items, align = 'left', header }: { trigger: (p: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' }) => ReactNode; items: MenuItem[]; align?: 'left' | 'right'; header?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLSpanElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<React.CSSProperties>({})
  useLayoutEffect(() => {
    if (!open || !wrap.current || !pop.current) return
    const r = wrap.current.getBoundingClientRect(), m = pop.current.getBoundingClientRect()
    const below = r.bottom + 4 + m.height < innerHeight
    const left = align === 'right' ? r.right - m.width : r.left
    setPos({ top: below ? r.bottom + 4 : Math.max(8, r.top - m.height - 4), left: Math.max(8, Math.min(left, innerWidth - m.width - 8)) })
    pop.current.querySelector<HTMLElement>('button:not(:disabled)')?.focus()
  }, [open, align])
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (!pop.current?.contains(e.target as Node) && !wrap.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); wrap.current?.querySelector('button')?.focus() }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const b = [...(pop.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])]
        const i = b.indexOf(document.activeElement as HTMLElement)
        b[(i + (e.key === 'ArrowDown' ? 1 : -1) + b.length) % b.length]?.focus()
      }
    }
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key, true)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key, true) }
  }, [open])
  return (
    <span ref={wrap} className="menu-wrap">
      {trigger({ onClick: () => setOpen((o) => !o), 'aria-expanded': open, 'aria-haspopup': 'menu' })}
      {open && createPortal(
        <div ref={pop} className="menu" role="menu" style={{ position: 'fixed', ...pos }}>
          {header && <div className="menu-head">{header}</div>}
          {items.map((it, i) => it.divider ? <div key={i} className="menu-div" role="separator" /> : (
            <button key={i} type="button" role="menuitem" disabled={it.disabled} className={`menu-item${it.selected ? ' selected' : ''}`} onClick={() => { setOpen(false); it.onSelect?.() }}>
              {typeof it.icon === 'string' ? <Icon name={it.icon} /> : it.icon}
              <span className="menu-label">{it.label}</span>
              {it.hint && <span className="menu-hint">{it.hint}</span>}
              {it.selected && <Icon name="check" size={18} />}
            </button>
          ))}
        </div>, document.body)}
    </span>
  )
}
