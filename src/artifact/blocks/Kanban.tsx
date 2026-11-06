/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Block, KanbanCard, KanbanColumn } from '../../data/types'
import { useT } from '../../i18n'
import { uid, useStore } from '../../store'
import { Avatar, Icon, IconButton } from '../../ui/kit'
import { Frame, useBoard } from '../shared'

interface Drag { card: KanbanCard; x: number; y: number; w: number; dx: number; dy: number; col: string | null; index: number }

export function KanbanBlock({ block }: { block: Extract<Block, { type: 'kanban' }> }) {
  const t = useT()
  const { project, role } = useBoard()
  const patchBlock = useStore((s) => s.patchBlock)
  const root = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [live, setLive] = useState('')
  const [adding, setAdding] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const refocus = useRef<{ id: string; label: 'left' | 'right' } | null>(null)
  const readOnly = role === 'guest'

  const write = (columns: KanbanColumn[]) => patchBlock(project.id, block.id, { columns })
  const moveCard = (cardId: string, toCol: string, index: number) => {
    const fromCol = block.columns.find((c) => c.cards.some((x) => x.id === cardId))
    const card = fromCol?.cards.find((x) => x.id === cardId)
    if (!card) return
    const columns = block.columns.map((c) => ({ ...c, cards: c.cards.filter((x) => x.id !== cardId) }))
    const target = columns.find((c) => c.id === toCol)
    if (!target) return
    target.cards.splice(Math.min(index, target.cards.length), 0, card)
    write(columns)
    setLive(t({ fr: `${t(card.title)} déplacée dans ${t(target.title)}`, en: `${t(card.title)} moved to ${t(target.title)}` }))
  }

  // After a keyboard move the card has a new DOM node: put the focus back on it.
  useEffect(() => {
    const want = refocus.current
    if (!want || !root.current) return
    refocus.current = null
    const card = root.current.querySelector<HTMLElement>(`[data-card="${want.id}"]`)
    const btn = card?.querySelector<HTMLButtonElement>(`[data-move="${want.label}"]:not(:disabled)`) ?? card?.querySelector<HTMLButtonElement>('[data-move]:not(:disabled)')
    btn?.focus()
  })

  const startDrag = (e: React.PointerEvent, card: KanbanCard) => {
    if (readOnly || e.pointerType !== 'mouse' || e.button !== 0 || (e.target as HTMLElement).closest('button,input')) return
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const originX = e.clientX, originY = e.clientY
    let current: Drag | null = null
    const locate = (x: number, y: number, base: Drag): Drag => {
      const cols = [...(root.current?.querySelectorAll<HTMLElement>('[data-col]') ?? [])]
      const col = cols.find((el) => { const r = el.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top - 24 && y <= r.bottom + 24 })
      if (!col) return { ...base, x, y, col: null, index: 0 }
      const others = [...col.querySelectorAll<HTMLElement>('[data-card]')].filter((el) => el.dataset.card !== card.id)
      let index = others.findIndex((el) => { const r = el.getBoundingClientRect(); return y < r.top + r.height / 2 })
      if (index < 0) index = others.length
      return { ...base, x, y, col: col.dataset.col!, index }
    }
    const move = (ev: PointerEvent) => {
      if (!current && Math.hypot(ev.clientX - originX, ev.clientY - originY) < 4) return
      current = locate(ev.clientX, ev.clientY, current ?? { card, x: ev.clientX, y: ev.clientY, w: rect.width, dx: originX - rect.left, dy: originY - rect.top, col: null, index: 0 })
      setDrag(current)
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('keydown', key, true)
      current = null
      setDrag(null)
    }
    const up = () => {
      if (current?.col) moveCard(card.id, current.col, current.index)
      stop()
    }
    const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { ev.stopPropagation(); stop() } }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('keydown', key, true)
  }

  const addCard = (colId: string) => {
    const title = draft.trim()
    setAdding(null); setDraft('')
    if (!title) return
    write(block.columns.map((c) => (c.id === colId ? { ...c, cards: [...c.cards, { id: uid('card'), title }] } : c)))
  }

  const cardNode = (c: KanbanCard, colIndex: number, inert = false) => {
    const title = t(c.title)
    const go = (dir: -1 | 1) => {
      refocus.current = { id: c.id, label: dir < 0 ? 'left' : 'right' }
      const target = block.columns[colIndex + dir]
      moveCard(c.id, target.id, target.cards.length)
    }
    return (
      <>
        <p className="rp-card-title">{title}</p>
        {c.note && <p className="rp-card-note">{t(c.note)}</p>}
        {c.tag && <span className="rp-tag rp-card-tag">{t(c.tag)}</span>}
        <div className="rp-card-foot">
          <span className="rp-card-moves">
            {!readOnly && !inert && (
              <>
                <IconButton data-move="left" icon="chevron_left" size={24} disabled={colIndex === 0} onClick={() => go(-1)} label={t({ fr: `Déplacer ${title} vers la colonne précédente`, en: `Move ${title} to the previous column` })} />
                <IconButton data-move="right" icon="chevron_right" size={24} disabled={colIndex === block.columns.length - 1} onClick={() => go(1)} label={t({ fr: `Déplacer ${title} vers la colonne suivante`, en: `Move ${title} to the next column` })} />
              </>
            )}
          </span>
          {c.assigneeId && <Avatar id={c.assigneeId} size={24} />}
        </div>
      </>
    )
  }

  return (
    <Frame block={block}>
      <div ref={root} className={`rp-kanban${drag ? ' dragging' : ''}`} role="group" tabIndex={0} aria-label={t(block.title)}>
        {block.columns.map((col, colIndex) => {
          const over = drag?.col === col.id
          const visible = col.cards.filter((c) => c.id !== drag?.card.id)
          return (
            <section key={col.id} className={`rp-col${over ? ' over' : ''}`} data-col={col.id} aria-label={t(col.title)}>
              <header className="rp-col-head">
                <span className="rp-trunc" title={t(col.title)}>{t(col.title)}</span>
                <span className="rp-col-count">{col.cards.length}</span>
              </header>
              <ul className="rp-cards">
                {visible.map((c, i) => (
                  <li key={c.id} className={`rp-card${over && drag?.index === i ? ' drop-before' : ''}`} data-card={c.id} onPointerDown={(e) => startDrag(e, c)}>
                    {cardNode(c, colIndex)}
                  </li>
                ))}
                {over && drag!.index >= visible.length && <li className="rp-drop-line" aria-hidden="true" />}
              </ul>
              {col.cards.length === 0 && !over && <p className="rp-col-empty">{t({ fr: 'Vide', en: 'Empty' })}</p>}
              {!readOnly && (adding === col.id ? (
                <input
                  autoFocus
                  className="rp-col-input"
                  value={draft}
                  maxLength={120}
                  aria-label={t({ fr: `Nouvelle carte dans ${t(col.title)}`, en: `New card in ${t(col.title)}` })}
                  placeholder={t({ fr: 'Titre de la carte', en: 'Card title' })}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => addCard(col.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addCard(col.id)
                    if (e.key === 'Escape') { setDraft(''); setAdding(null) }
                  }}
                />
              ) : (
                <button type="button" className="rp-col-add" onClick={() => { setDraft(''); setAdding(col.id) }}>
                  <Icon name="add" size={18} />{t({ fr: 'Carte', en: 'Card' })}
                </button>
              ))}
            </section>
          )
        })}
      </div>
      <span className="sr-only" aria-live="polite">{live}</span>
      {drag && createPortal(
        <div className="rp-card rp-card-ghost" aria-hidden="true" style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.w }}>
          {cardNode(drag.card, 0, true)}
        </div>, document.body)}
    </Frame>
  )
}
