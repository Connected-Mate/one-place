/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// "Gemini advice" at the far right of the tab row: what is not working, what could come next, one click each.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n'
import { useStore } from '../store'
import { Button, Icon, IconButton, Sparkle } from '../ui/kit'
import { computeAdvice, type Advice } from './advice'
import { useBoard } from './shared'

const MAX_SHOWN = 4
const KEY = 'one-place-advice-settled'
const load = (): string[] => {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as string[] } catch { return [] }
}
const compose = (text: string) => window.dispatchEvent(new CustomEvent('oneplace:compose', { detail: { text } }))

export function AdviceChip({ onOpenSection }: { onOpenSection: (blockId: string) => void }) {
  const t = useT()
  const { project, role, viewerId } = useBoard()
  const [open, setOpen] = useState(false)
  const [settled, setSettled] = useState<string[]>(load)
  const chip = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)
  const giveFocusBack = useRef(true)

  // "Settled" belongs to one person on one project: another persona still gets their own advice.
  const scope = `${project.id}:${viewerId}:`
  const items = useMemo(() => computeAdvice(project, viewerId, role).filter((a) => !settled.includes(scope + a.id)), [project, viewerId, role, settled, scope])
  // what is broken comes first, but one "next step" always gets a place when there is one
  const broken = items.filter((a) => a.group === 'broken')
  const next = items.filter((a) => a.group === 'next')
  const shown = [...broken.slice(0, next.length ? MAX_SHOWN - 1 : MAX_SHOWN), ...next].slice(0, MAX_SHOWN)
  const shownBroken = shown.filter((a) => a.group === 'broken')
  const shownNext = shown.filter((a) => a.group === 'next')

  useEffect(() => {
    if (open) { pop.current?.focus() }
    else if (wasOpen.current && giveFocusBack.current) chip.current?.focus()
    wasOpen.current = open
    giveFocusBack.current = true
  }, [open])
  useEffect(() => { setOpen(false) }, [project.id])
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => {
      const target = e.target as Node
      if (pop.current?.contains(target) || chip.current?.contains(target)) return
      giveFocusBack.current = false // the click went somewhere on purpose: leave the focus there
      setOpen(false)
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key, true)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key, true) }
  }, [open])

  const settle = (a: Advice) => setSettled((list) => {
    const next = [...list, scope + a.id]
    try { sessionStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode: it just comes back on reload */ }
    return next
  })
  const run = (a: Advice) => {
    const s = useStore.getState()
    const act = a.action
    if (a.settles) settle(a)
    switch (act.kind) {
      case 'proposal':
        s.setMobilePane('chat')
        s.focusMessage(act.messageId)
        giveFocusBack.current = false
        setOpen(false)
        break
      case 'section':
        onOpenSection(act.blockId)
        giveFocusBack.current = false
        setOpen(false)
        break
      case 'compose':
        giveFocusBack.current = false // the composer takes the focus
        setOpen(false)
        compose(act.text)
        break
      case 'gallery':
        giveFocusBack.current = false
        setOpen(false)
        s.setBlockGallery(true)
        break
      case 'toggle':
        s.toggleTodo(project.id, act.blockId, act.todoId)
        pop.current?.focus()
        break
      case 'add-todo':
        s.addTodo(project.id, act.blockId, act.todo)
        s.toast({ text: { fr: 'Ajoutée', en: 'To-do added' }, icon: 'check_circle' })
        pop.current?.focus()
        break
    }
  }

  const row = (a: Advice) => (
    <li key={a.id} className="rp-advice-row">
      <p>{a.text}</p>
      <Button size="s" className="rp-advice-act" onClick={() => run(a)}>{a.label}</Button>
    </li>
  )
  const count = items.length
  const popover = open && (
    <div ref={pop} className="rp-advice-pop" role="dialog" aria-label={t({ fr: 'Conseils de Gemini', en: 'Gemini advice' })} tabIndex={-1}>
      <header className="rp-advice-head">
        <Sparkle size={20} />
        <h2>{t({ fr: 'Conseils de Gemini', en: 'Gemini advice' })}</h2>
        <IconButton icon="close" size={32} label={t({ fr: 'Fermer', en: 'Close' })} onClick={() => setOpen(false)} />
      </header>
      <div aria-live="polite">
        {shown.length === 0 && (
          <div className="rp-advice-none"><Icon name="check_circle" size={24} /><p>{t({ fr: 'Rien ne vous attend pour l’instant', en: 'Nothing needs you right now' })}</p></div>
        )}
        {shownBroken.length > 0 && <><h3>{t({ fr: 'Ce qui ne va pas', en: 'What is not working' })}</h3><ul>{shownBroken.map(row)}</ul></>}
        {shownNext.length > 0 && <><h3>{t({ fr: 'La suite possible', en: 'What could come next' })}</h3><ul>{shownNext.map(row)}</ul></>}
      </div>
    </div>
  )
  return (
    <>
      <button
        ref={chip}
        type="button"
        className={`rp-advice-chip${open ? ' on' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={count ? t({ fr: `Conseils de Gemini, ${count}`, en: `Gemini advice, ${count} ${count === 1 ? 'item' : 'items'}` }) : t({ fr: 'Conseils de Gemini', en: 'Gemini advice' })}
        title={t({ fr: 'Conseils de Gemini', en: 'Gemini advice' })}
        onClick={() => setOpen((o) => !o)}
      >
        <Sparkle size={16} />
        {count > 0 && <span className="rp-advice-count">{count}</span>}
      </button>
      {popover && createPortal(<div className="rp-advice-layer">{popover}</div>, matchMedia('(max-width:599px),(max-height:480px) and (max-width:1279px)').matches ? document.body : chip.current?.closest('.right-pane') ?? document.body)}
    </>
  )
}
