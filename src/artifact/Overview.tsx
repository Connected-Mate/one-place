/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The Overview tab: a bento of everything about the project, the same for everyone, on one screen. Each tile opens its full tab.
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import type { Block } from '../data/types'
import { fmtDate, fmtDay, fmtTime, useT, withUnit } from '../i18n'
import { canOpen, personById, useStore } from '../store'
import { Avatar, AvatarStack, Button, Icon, Sparkle } from '../ui/kit'
import { AppTile } from './apps/AppTile'
import { ModelTilePreview } from './blocks/Model3D'
import { layout, type Slot } from './overviewLayout'
import { DAY, Empty, KindIcon, revealIn, startOfDay, upcomingEvents, useBoard } from './shared'

type Of<T extends Block['type']> = Extract<Block, { type: T }>
const pctOf = (v: number | undefined) => (v == null ? null : Math.max(0, Math.min(100, v <= 1 ? v * 100 : v)))

function SummaryTile({ block }: { block: Of<'summary'> }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const n = block.bullets.length
  return (
    <>
      <span className="rp-t-summary">{t(block.text)}</span>
      <span className="rp-t-meta">
        {n > 0 && <>{n === 1 ? t({ fr: '1 point', en: '1 point' }) : t({ fr: `${n} points`, en: `${n} points` })}, </>}
        {t({ fr: 'mis à jour à', en: 'updated at' })} {fmtTime(block.updatedAt, lang)}
      </span>
    </>
  )
}

function TimelineTile({ block }: { block: Of<'timeline'> }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const now = Date.now()
  const items = block.items
  if (!items.length) return <span className="rp-t-none">{t({ fr: 'Pas encore de jalon', en: 'No milestones yet' })}</span>
  const today = startOfDay(now)
  const isLate = (i: typeof items[number]) => !i.milestone && i.end < today && (pctOf(i.progress) ?? 0) < 100
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
          const label = <em>{t(i.label)}</em>
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
            {x.assigneeId && <Avatar id={x.assigneeId} size={20} />}
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
  const top = Math.max(...series.flatMap((s) => [s.value, s.target ?? 0]), 1)
  // the top lines; the whole chart is in its tab
  const lines = [...series].sort((a, b) => b.value - a.value).slice(0, 4)
  return (
    <>
      <span className={`rp-t-big${planned > 0 && total > planned ? ' over' : ''}`}>{withUnit(nf.format(total), block.unit)}</span>
      {planned > 0 && <span className="rp-t-meta">{t({ fr: `pour ${withUnit(nf.format(planned), block.unit)} prévus`, en: `against ${withUnit(nf.format(planned), block.unit)} planned` })}</span>}
      <span className="rp-t-bars" aria-hidden="true">
        {lines.map((s, i) => (
          <span key={i} className="rp-t-barrow">
            <em className="rp-trunc">{t(s.label)}</em>
            <span className="rp-t-track"><i style={{ width: `${(Math.max(0, s.value) / top) * 100}%` }} />{s.target != null && <u style={{ left: `${(s.target / top) * 100}%` }} />}</span>
          </span>
        ))}
      </span>
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
    <span className="rp-t-next">
      <span className="rp-date" aria-hidden="true"><span>{new Date(e.start).toLocaleDateString('en-US', { month: 'short' })}</span><b>{new Date(e.start).getDate()}</b></span>
      <span className="rp-row-main">
        <span className="rp-trunc rp-t-strong">{t(e.title)}</span>
        <span className="rp-t-meta rp-trunc"><span className="sr-only">{fmtDay(e.start, lang)}, </span>{fmtTime(e.start, lang)}{next.length > 1 ? `, +${next.length - 1}` : ''}</span>
      </span>
      <AvatarStack ids={e.attendeeIds} size={20} max={2} />
    </span>
  )
}

function FilesTile({ block }: { block: Of<'files'> }) {
  const t = useT()
  const { project, viewerId } = useBoard()
  const files = block.artifactIds.map((id) => project.artifacts.find((a) => a.id === id)).filter((a) => a != null).filter((a) => canOpen(project, a, viewerId)).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4)
  if (!files.length) return <span className="rp-t-none">{t({ fr: 'Aucun fichier', en: 'No files yet' })}</span>
  const spaceIcon = (id?: string) => { const sp = id ? project.spaces?.find((x) => x.id === id) : undefined; return sp && <span className={`rp-t-access ${sp.kind}`}><Icon name={sp.icon} size={14} /><span className="sr-only">{sp.kind === 'confidential' ? `${t(sp.name)} only` : `Shared with ${sp.org}`}</span></span> }
  return <span className="rp-t-files">{files.map((a) => <span key={a.id} className="rp-t-file"><KindIcon kind={a.kind} size={16} /><span className="rp-trunc">{t(a.title)}</span>{spaceIcon(a.space)}</span>)}</span>
}

function PeopleTile() {
  const { project } = useBoard()
  useStore((s) => s.presence)
  const ids = [...new Set([...project.memberIds, ...project.externalIds])].filter((id) => personById(id).role !== 'ai')
  return <span className="rp-t-faces">{ids.slice(0, 9).map((id) => <Avatar key={id} id={id} size={28} status />)}</span>
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

function tileMeta(block: Block, t: ReturnType<typeof useT>, online: number, everyone: number): ReactNode {
  if (block.type === 'todo') { const d = block.todos.filter((x) => x.done).length; return block.todos.length ? t({ fr: `${d} sur ${block.todos.length} faites`, en: `${d} of ${block.todos.length} done` }) : null }
  if (block.type === 'timeline') return block.items.length ? (block.items.length === 1 ? t({ fr: '1 étape', en: '1 item' }) : t({ fr: `${block.items.length} étapes`, en: `${block.items.length} items` })) : null
  if (block.type === 'people') return t({ fr: `${online} sur ${everyone} en ligne`, en: `${online} of ${everyone} online` })
  if (block.type === 'poll') { const n = block.options.reduce((s, o) => s + o.votes.length, 0); return n === 1 ? t({ fr: '1 vote', en: '1 vote' }) : t({ fr: `${n} votes`, en: `${n} votes` }) }
  if (block.type === 'kanban') { const n = block.columns.reduce((s, c) => s + c.cards.length, 0); return n === 1 ? t({ fr: '1 carte', en: '1 card' }) : t({ fr: `${n} cartes`, en: `${n} cards` }) }
  return null
}

function TileBody({ block }: { block: Block }) {
  const t = useT()
  switch (block.type) {
    case 'summary': return <SummaryTile block={block} />
    case 'timeline': return <TimelineTile block={block} />
    case 'todo': return <TodoTile block={block} />
    case 'chart': return <ChartTile block={block} />
    case 'calendar': return <CalendarTile block={block} />
    case 'files': return <FilesTile block={block} />
    case 'people': return <PeopleTile />
    case 'kanban': return <KanbanTile block={block} />
    case 'poll': return <PollTile block={block} />
    case 'app': return <AppTile block={block} />
    case 'model3d': return <ModelTilePreview model={block.model} />
    case 'notes': { const text = t(block.text); return text ? <span className="rp-t-note">{text}</span> : <span className="rp-t-none">{t({ fr: 'Pas encore de note', en: 'No notes yet' })}</span> }
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

  useStore((s) => s.presence)
  const everyone = [...new Set([...project.memberIds, ...project.externalIds])].map(personById).filter((p) => p.role !== 'ai')
  const online = everyone.filter((p) => p.presence === 'online').length

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
      {project.blocks.length === 0 ? (
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
            const meta = tileMeta(b, t, online, everyone.length)
            return (
              <button key={b.id} type="button" data-tile={b.id} className={`rp-tile t-${b.type}${b.fresh ? ' fresh' : ''}`} style={place(wide.slots.get(b.id)!, narrow.slots.get(b.id)!)} onClick={() => onOpen(b.id)}>
                <span className="rp-tile-head">
                  {b.type === 'summary' && <Sparkle size={16} />}
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
