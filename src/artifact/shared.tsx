/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Pieces shared by every board block and document view.
import { appOf, WorkspaceIcon } from '../ui/WorkspaceIcon'
import { Component, createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Artifact, Block, BlockType, L, Project } from '../data/types'
import { useT } from '../i18n'
import { canSee, useStore, type ProjectRole } from '../store'
import { Icon, IconButton, Menu, type MenuItem } from '../ui/kit'

export const DAY = 864e5
export const prefersReducedMotion = () => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}
/** Scroll one container only. el.scrollIntoView would also move every ancestor, even overflow:hidden ones. */
export function revealIn(box: HTMLElement | null, el: Element | null | undefined, pad = { top: 0, right: 0, bottom: 0, left: 0 }, smooth = false) {
  if (!box || !el) return
  const b = box.getBoundingClientRect(), r = el.getBoundingClientRect()
  let dx = 0, dy = 0
  if (r.left < b.left + pad.left) dx = r.left - b.left - pad.left
  else if (r.right > b.right - pad.right) dx = Math.min(r.right - b.right + pad.right, r.left - b.left - pad.left)
  if (r.top < b.top + pad.top) dy = r.top - b.top - pad.top
  else if (r.bottom > b.bottom - pad.bottom) dy = Math.min(r.bottom - b.bottom + pad.bottom, r.top - b.top - pad.top)
  if (dx || dy) box.scrollBy({ left: dx, top: dy, behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' })
}
export const startOfDay = (at: number) => { const d = new Date(at); d.setHours(0, 0, 0, 0); return d.getTime() }

export interface BoardCtx { project: Project; role: ProjectRole; viewerId: string }
export const BoardContext = createContext<BoardCtx | null>(null)
export const useBoard = () => useContext(BoardContext)!

export const KINDS: Record<Artifact['kind'], { icon: string; color: string; label: L }> = {
  doc: { icon: 'description', color: 'var(--blue)', label: { fr: 'Document', en: 'Doc' } },
  sheet: { icon: 'table_chart', color: 'var(--green)', label: { fr: 'Feuille de calcul', en: 'Sheet' } },
  slides: { icon: 'slideshow', color: 'var(--yellow)', label: { fr: 'Présentation', en: 'Slides' } },
  pdf: { icon: 'picture_as_pdf', color: 'var(--red)', label: { fr: 'PDF', en: 'PDF' } },
  notebook: { icon: 'auto_stories', color: 'var(--text)', label: { fr: 'Notebook', en: 'Notebook' } },
  image: { icon: 'image', color: 'var(--blue)', label: { fr: 'Image', en: 'Image' } },
  video: { icon: 'movie', color: 'var(--red)', label: { fr: 'Vidéo', en: 'Video' } },
  file: { icon: 'draft', color: 'var(--text-3)', label: { fr: 'Fichier', en: 'File' } },
}
export const BLOCK_META: Record<BlockType, { icon: string; label: L }> = {
  summary: { icon: 'auto_awesome', label: { fr: 'Résumé', en: 'Summary' } },
  timeline: { icon: 'view_timeline', label: { fr: 'Calendrier', en: 'Timeline' } },
  todo: { icon: 'task_alt', label: { fr: 'À faire', en: 'To-do' } },
  kanban: { icon: 'view_kanban', label: { fr: 'Kanban', en: 'Kanban' } },
  files: { icon: 'folder', label: { fr: 'Fichiers', en: 'Files' } },
  people: { icon: 'group', label: { fr: 'Équipe', en: 'People' } },
  calendar: { icon: 'event', label: { fr: 'Agenda', en: 'Calendar' } },
  chart: { icon: 'bar_chart', label: { fr: 'Graphique', en: 'Chart' } },
  model3d: { icon: 'view_in_ar', label: { fr: '3D', en: '3D' } },
  notes: { icon: 'notes', label: { fr: 'Notes', en: 'Notes' } },
  poll: { icon: 'ballot', label: { fr: 'Sondage', en: 'Poll' } },
  app: { icon: 'auto_awesome', label: { fr: 'Outil fait par Gemini', en: 'Tool made by Gemini' } },
}

export function KindIcon({ kind, size = 20 }: { kind: Artifact['kind']; size?: number }) {
  const app = appOf(kind)
  if (app) return <WorkspaceIcon app={app} size={size} />
  return <Icon name={KINDS[kind].icon} fill size={size} style={{ color: KINDS[kind].color }} />
}
/** Same, for a particular file: an Audio or Video Overview is NotebookLM's, not a plain video. */
export function FileIcon({ a, size = 20 }: { a: Artifact; size?: number }) {
  if (a.kind === 'video' && a.overview) return <WorkspaceIcon app="notebooklm" size={size} />
  return <KindIcon kind={a.kind} size={size} />
}

export function Empty({ icon, title, hint, children }: { icon: string; title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="rp-empty">
      <Icon name={icon} size={24} />
      <p className="rp-empty-title">{title}</p>
      {hint && <p className="rp-empty-hint">{hint}</p>}
      {children}
    </div>
  )
}

/** The project's calendar: its own events and the meetings booked in the chat that this viewer can see, once each, next first. */
export function upcomingEvents(block: Extract<Block, { type: 'calendar' }>, project: Project, viewerId: string, now = Date.now()) {
  const key = (title: unknown, start: number) => `${start}|${typeof title === 'string' ? title : (title as { en: string }).en}`
  const seen = new Set(block.events.map((e) => key(e.title, e.start)))
  const meetings = project.messages.flatMap((m) => (m.kind === 'meeting' && !m.ended && canSee(m.visibility, viewerId) && !seen.has(key(m.title, m.start))
    ? [{ id: m.id, title: m.title, start: m.start, durationMin: m.durationMin, attendeeIds: m.attendeeIds }]
    : []))
  return [...block.events, ...meetings].filter((e) => e.start + e.durationMin * 6e4 >= now).sort((a, b) => a.start - b.start)
}

/** A tooltip that escapes the scrolling parents. `bind(content)` goes on the target. */
export function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; below: boolean; content: ReactNode } | null>(null)
  const show = (el: Element, content: ReactNode) => {
    const r = el.getBoundingClientRect()
    setTip({ x: Math.max(120, Math.min(r.left + r.width / 2, innerWidth - 120)), y: r.top < 110 ? r.bottom + 8 : r.top - 8, below: r.top < 110, content })
  }
  const hide = () => setTip(null)
  const bind = (content: ReactNode) => ({
    onPointerEnter: (e: React.PointerEvent) => show(e.currentTarget, content),
    onPointerLeave: hide,
    onFocus: (e: React.FocusEvent) => { if (e.currentTarget.matches(':focus-visible')) show(e.currentTarget, content) },
    onBlur: hide,
  })
  const node = tip && createPortal(
    <div className="rp-tip" role="tooltip" style={{ left: tip.x, top: tip.y, transform: `translate(-50%,${tip.below ? '0' : '-100%'})` }}>{tip.content}</div>,
    document.body,
  )
  return { bind, node, hide }
}

/** One broken block must never take the board down. */
export class BlockBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

/** The frame of every block: title row, owner menu, arrival animation. Flat by design: no card around it. */
export function Frame({ block, leading, actions, className = '', children, style, heading }: { block: Block; leading?: ReactNode; actions?: ReactNode; className?: string; children: ReactNode; style?: CSSProperties; heading?: string }) {
  const t = useT()
  const { project, role } = useBoard()
  const moveBlock = useStore((s) => s.moveBlock)
  const removeBlock = useStore((s) => s.removeBlock)
  const patchBlock = useStore((s) => s.patchBlock)
  const toast = useStore((s) => s.toast)
  const ref = useRef<HTMLElement>(null)
  const index = project.blocks.findIndex((b) => b.id === block.id)

  useEffect(() => {
    if (!block.fresh) return
    const el = ref.current
    if (el?.offsetParent) revealIn(el.closest('.rp-board'), el, { top: 24, right: 0, bottom: 24, left: 0 }, true)
    // the flag may have been persisted by a reload in mid-animation: always clear it.
    const timer = setTimeout(() => patchBlock(project.id, block.id, { fresh: false }), 2400)
    return () => clearTimeout(timer)
  }, [block.fresh, block.id, project.id, patchBlock])

  const remove = () => {
    const position = index
    removeBlock(project.id, block.id)
    toast({
      text: { fr: 'Bloc retiré', en: 'Block removed' },
      icon: 'delete',
      action: {
        label: { fr: 'Annuler', en: 'Undo' },
        run: () => {
          const s = useStore.getState()
          const p = s.projects.find((x) => x.id === project.id)
          if (!p || p.blocks.some((b) => b.id === block.id)) return // double click safe
          s.addBlock(project.id, { ...block, fresh: false })
          // addBlock appends: walk it back to where it was
          for (let i = p.blocks.length; i > position; i--) useStore.getState().moveBlock(project.id, block.id, -1)
        },
      },
    })
  }

  const items: MenuItem[] = [
    { icon: 'arrow_upward', label: t({ fr: 'Monter', en: 'Move up' }), disabled: index <= 0, onSelect: () => moveBlock(project.id, block.id, -1) },
    { icon: 'arrow_downward', label: t({ fr: 'Descendre', en: 'Move down' }), disabled: index >= project.blocks.length - 1, onSelect: () => moveBlock(project.id, block.id, 1) },
    { divider: true, label: '' },
    { icon: 'delete', label: t({ fr: 'Retirer du tableau', en: 'Remove from board' }), onSelect: remove },
  ]
  const title = t(block.title)
  return (
    <article ref={ref} className={`rp-block span-${block.span}${block.fresh ? ' fresh' : ''} ${className}`} aria-label={title} data-block={block.type} style={style}>
      <header className="rp-block-head">
        {leading}
        <h3 className="rp-block-title" title={heading ?? title}>{heading ?? title}</h3>
        <span className="rp-block-actions">{actions}</span>
        {role === 'owner' && (
          <span className="rp-block-menu">
            <Menu align="right" items={items} trigger={(p) => <IconButton icon="more_vert" size={32} label={t({ fr: `Options du bloc ${title}`, en: `${title} block options` })} {...p} />} />
          </span>
        )}
      </header>
      {children}
    </article>
  )
}
