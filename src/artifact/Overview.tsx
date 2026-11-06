/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The Overview tab: where the project stands, the same for everyone, on one screen. Each tile opens its full tab.
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import type { Block } from '../data/types'
import { fmtDate, fmtDay, fmtTime, useT, withUnit } from '../i18n'
import { personById, useStore } from '../store'
import { Button, Icon, Sparkle } from '../ui/kit'
import { ModelTilePreview } from './blocks/Model3D'
import { layout, onOverview, type Slot } from './overviewLayout'
import { DAY, Empty, revealIn, startOfDay, upcomingEvents, useBoard } from './shared'

type Of<T extends Block['type']> = Extract<Block, { type: T }>
const pctOf = (v: number | undefined) => (v == null ? null : Math.max(0, Math.min(100, v <= 1 ? v * 100 : v)))

function SummaryTile({ block }: { block: Of<'summary'> }) {
  const t = useT()
  const text = t(block.text)
  // one sentence here; the whole story, with its points, is in the Summary tab
  return <span className="rp-t-summary"><Sparkle size={16} />{/^.+?[.!?](?=\s|$)/s.exec(text)?.[0] ?? text}</span>
}

function TimelineTile({ block }: { block: Of<'timeline'> }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const now = Date.now()
  const items = block.items
  if (!items.length) return <span className="rp-t-none">{t({ fr: 'Pas encore de jalon', en: 'No milestones yet' })}</span>
  // Labels only on what matters: what is running, what is late, the next milestone and the last one.
  const today = startOfDay(now)
  const isLate = (i: typeof items[number]) => !i.milestone && i.end < today && (pctOf(i.progress) ?? 0) < 100
  const ahead = items.filter((i) => i.milestone && i.start >= now).sort((a, b) => a.start - b.start)
  const named = new Set([ahead[0]?.id, ahead[ahead.length - 1]?.id])
  const speaks = (i: typeof items[number]) => named.has(i.id) || isLate(i) || (!i.milestone && i.start <= now && now <= i.end)
  const from = Math.min(now, ...items.map((i) => i.start)) - 2 * DAY
  const to = Math.max(now, ...items.map((i) => Math.max(i.start, i.end))) + 4 * DAY
  const pct = (at: number) => ((at - from) / (to - from)) * 100
  const months: number[] = []
  for (let d = new Date(from); d.getTime() < to; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const first = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
    if (first < to) months.push(first)
  }
  return (
    <span className="rp-t-gantt" aria-hidden="true">
      <span className="rp-t-gantt-rows">
        {months.map((m) => <i key={m} className="rp-t-gantt-grid" style={{ left: `${pct(m)}%` }}><em>{new Date(m).toLocaleDateString('en-US', { month: 'short' })}</em></i>)}
        <i className="rp-t-gantt-today" style={{ left: `${pct(now)}%` }} />
        {items.map((i) => {
          const label = speaks(i) ? <em>{t(i.label)}</em> : null
          const left = pct(i.start)
          if (i.milestone) return <span key={i.id} className={`rp-t-g-row${left > 64 ? ' flip' : ''}`}><span className="rp-t-g-ms" style={{ left: `${left}%` }}><i />{label}</span></span>
          const end = Math.max(i.end, i.start + DAY)
          const progress = pctOf(i.progress)
          return (
            <span key={i.id} className={`rp-t-g-row${pct(end) > 64 ? ' flip' : ''}`}>
              <span className={`rp-t-g-bar${isLate(i) ? ' late' : ''}`} style={{ left: `${left}%`, width: `${pct(end) - left}%` }}>
                {progress != null && <i style={{ width: `${progress}%` }} />}
                {label}
              </span>
            </span>
          )
        })}
      </span>
      <span className="sr-only">{fmtDate(now, lang)}</span>
    </span>
  )
}

function TodoTile({ block }: { block: Of<'todo'> }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const today = startOfDay(Date.now())
  const open = block.todos.filter((x) => !x.done).sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity))
  if (!block.todos.length) return <span className="rp-t-none">{t({ fr: 'Rien à faire pour l’instant', en: 'Nothing to do yet' })}</span>
  if (!open.length) return <span className="rp-t-none">{t({ fr: 'Tout est fait', en: 'All done' })}</span>
  return (
    <span className="rp-t-list">
      {open.slice(0, 3).map((x) => {
        const late = x.due != null && x.due < today
        return (
          <span key={x.id} className="rp-t-todo">
            <i className="rp-t-ring" />
            <span className="rp-trunc">{t(x.text)}</span>
            {x.due != null && <span className={late ? 'rp-t-late' : 'rp-t-due'}>{late && <span className="sr-only">{t({ fr: 'En retard : ', en: 'Overdue: ' })}</span>}{fmtDate(x.due, lang)}</span>}
          </span>
        )
      })}
    </span>
  )
}

function ChartTile({ block }: { block: Of<'chart'> }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const series = block.series
  if (!series.length) return <span className="rp-t-none">{t({ fr: 'Pas encore de données', en: 'No data yet' })}</span>
  const nf = new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 1, notation: 'compact' })
  const total = series.reduce((n, s) => n + s.value, 0)
  const planned = series.reduce((n, s) => n + (s.target ?? 0), 0)
  // The whole chart is in its tab. Here, the number and one bar against plan; only what is over plan takes a color.
  const top = Math.max(total, planned, 1)
  const within = (Math.min(total, planned) / top) * 100
  return (
    <>
      <span className="rp-t-big">{withUnit(nf.format(total), block.unit)}</span>
      {planned > 0 && <span className="rp-t-meta">{t({ fr: `pour ${withUnit(nf.format(planned), block.unit)} prévus`, en: `against ${withUnit(nf.format(planned), block.unit)} planned` })}</span>}
      {planned > 0 && (
        <span className="rp-t-plan" aria-hidden="true">
          <i style={{ width: `${within}%` }} />
          {total > planned && <b style={{ width: `${100 - within}%` }} />}
        </span>
      )}
    </>
  )
}

function CalendarTile({ block }: { block: Of<'calendar'> }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const { project, viewerId } = useBoard()
  const next = upcomingEvents(block, project, viewerId)
  if (!next.length) return <span className="rp-t-none">{t({ fr: 'Rien de prévu', en: 'Nothing planned' })}</span>
  const e = next[0]
  return (
    <span className="rp-row-main">
      <span className="rp-trunc rp-t-strong">{t(e.title)}</span>
      <span className="rp-t-meta rp-trunc">{fmtDay(e.start, lang)}, {fmtTime(e.start, lang)}</span>
    </span>
  )
}

function KanbanTile({ block }: { block: Of<'kanban'> }) {
  const t = useT()
  return (
    <span className="rp-t-kanban">
      {block.columns.slice(0, 4).map((c) => (
        <span key={c.id} className="rp-t-kcol">
          <b>{c.cards.length}</b>
          <span className="rp-trunc">{t(c.title)}</span>
        </span>
      ))}
    </span>
  )
}

function PollTile({ block }: { block: Of<'poll'> }) {
  const t = useT()
  const total = block.options.reduce((n, o) => n + o.votes.length, 0)
  return (
    <>
      <span className="rp-trunc rp-t-text">{t(block.question)}</span>
      <span className="rp-t-bars rp-t-pollbars">
        {block.options.slice(0, 2).map((o) => (
          <span key={o.id} className="rp-t-barrow">
            <em className="rp-trunc">{t(o.label)}</em>
            <span className="rp-t-track poll"><i style={{ width: `${total ? (o.votes.length / total) * 100 : 0}%` }} /></span>
          </span>
        ))}
      </span>
    </>
  )
}

function tileMeta(block: Block, t: ReturnType<typeof useT>): ReactNode {
  if (block.type === 'todo') { const d = block.todos.filter((x) => x.done).length; return block.todos.length ? t({ fr: `${d} sur ${block.todos.length} faites`, en: `${d} of ${block.todos.length} done` }) : null }
  return null
}

function TileBody({ block }: { block: Block }) {
  switch (block.type) {
    case 'summary': return <SummaryTile block={block} />
    case 'timeline': return <TimelineTile block={block} />
    case 'todo': return <TodoTile block={block} />
    case 'chart': return <ChartTile block={block} />
    case 'calendar': return <CalendarTile block={block} />
    case 'kanban': return <KanbanTile block={block} />
    case 'poll': return <PollTile block={block} />
    case 'model3d': return <ModelTilePreview model={block.model} />
    default: return null
  }
}

export function Overview({ onOpen }: { onOpen: (blockId: string) => void }) {
  const t = useT()
  const { project, role } = useBoard()
  const setBlockGallery = useStore((s) => s.setBlockGallery)
  const scroller = useRef<HTMLDivElement>(null)
  const owner = personById(project.ownerId).name.split(' ')[0]
  const addLabel = role === 'owner' ? t({ fr: 'Ajouter un bloc', en: 'Add block' }) : t({ fr: 'Proposer un bloc', en: 'Propose a block' })
  const add = role !== 'guest' && <Button variant="tonal" size="s" icon="add" onClick={() => setBlockGallery(true)}>{addLabel}</Button>
  const { ordered, wide, narrow } = layout(project.blocks)

  const fresh = project.blocks.find((b) => b.fresh)?.id
  useEffect(() => {
    if (!fresh || !scroller.current?.offsetParent) return
    revealIn(scroller.current, scroller.current.querySelector(`[data-tile="${CSS.escape(fresh)}"]`), { top: 16, right: 0, bottom: 16, left: 0 }, true)
  }, [fresh])

  const place = (w: Slot, n: Slot) => ({
    '--c': w.c + 1, '--r': w.r + 1, '--w': w.w, '--h': w.h,
    '--nc': n.c + 1, '--nr': n.r + 1, '--nw': n.w, '--nh': n.h,
  }) as CSSProperties

  return (
    <div ref={scroller} className="rp-ov">
      {!project.blocks.some(onOverview) ? (
        <Empty
          icon="dashboard_customize"
          title={t({ fr: 'Ce tableau est encore vide', en: 'This board is still empty' })}
          hint={role === 'owner'
            ? t({ fr: 'Ajoutez un premier bloc, ou demandez à Gemini de le faire.', en: 'Add a first block, or ask Gemini to do it.' })
            : t({ fr: `Tout le monde voit le même tableau. ${owner} décide de ce qui y arrive : proposez-lui un bloc.`, en: `Everyone sees the same board. ${owner} decides what goes on it: propose a block.` })}
        >
          {add}
        </Empty>
      ) : (
        <div className="rp-bento" style={{ '--rows': wide.rows } as CSSProperties}>
          {ordered.map((b) => {
            const title = t(b.title)
            const meta = tileMeta(b, t)
            return (
              <button key={b.id} type="button" data-tile={b.id} className={`rp-tile t-${b.type}${b.fresh ? ' fresh' : ''}`} style={place(wide.slots.get(b.id)!, narrow.slots.get(b.id)!)} aria-label={b.type === 'summary' ? title : undefined} onClick={() => onOpen(b.id)}>
                <span className="rp-tile-head">
                  <span className="rp-tile-title rp-trunc" title={title}>{title}</span>
                  {meta && <span className="rp-tile-count">{meta}</span>}
                  <Icon name="chevron_right" size={16} className="rp-tile-go" />
                </span>
                <span className="rp-tile-body"><TileBody block={b} /></span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
