/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The project's calendar: week, day and month, like the calendar people already know.
// Events come from the block and from the meeting cards in the chat, without duplicates, and a new event is a real meeting card.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { startCall } from '../../call/callActions'
import type { Block, Project, Txt } from '../../data/types'
import { fmtTime, tx, useT } from '../../i18n'
import { canSee, personById, uid, useStore } from '../../store'
import { Avatar, AvatarStack, Button, Icon, IconButton } from '../../ui/kit'
import { Frame, revealIn, startOfDay, useBoard } from '../shared'

type View = 'day' | 'week' | 'month' | 'agenda'
interface Ev {
  key: string
  title: Txt
  start: number
  durationMin: number
  attendeeIds: string[]
  guests: string[]
  messageId?: string
  live?: boolean
  ended?: boolean
  outside: boolean
}
interface AllDay { id: string; label: Txt; at: number; blockId: string }

const addDays = (at: number, n: number) => { const d = new Date(at); d.setDate(d.getDate() + n); return d.getTime() }
const weekStart = (at: number) => { const d = new Date(startOfDay(at)); d.setDate(d.getDate() - d.getDay()); return d.getTime() }
const monthStart = (at: number) => { const d = new Date(at); return new Date(d.getFullYear(), d.getMonth(), 1).getTime() }
const fmt = (at: number, o: Intl.DateTimeFormatOptions) => new Date(at).toLocaleDateString('en-US', o)
const minutesOf = (at: number) => { const d = new Date(at); return d.getHours() * 60 + d.getMinutes() }

/** Same rule as Home: a meeting card and a calendar entry with one title and one start are one event. */
function eventsOf(p: Project, viewerId: string): Ev[] {
  const out = new Map<string, Ev>()
  const norm = (title: Txt, start: number) => `${tx(title, 'en').trim().toLowerCase()}|${Math.round(start / 60e3)}`
  for (const m of p.messages) {
    if (m.kind !== 'meeting' || !canSee(m.visibility, viewerId)) continue
    const outside = !!m.guestEmails?.length || m.attendeeIds.some((id) => p.externalIds.includes(id))
    out.set(norm(m.title, m.start), { key: m.id, title: m.title, start: m.start, durationMin: m.durationMin, attendeeIds: m.attendeeIds, guests: m.guestEmails ?? [], messageId: m.id, live: m.live, ended: m.ended, outside })
  }
  for (const b of p.blocks) {
    if (b.type !== 'calendar') continue
    for (const e of b.events) {
      const key = norm(e.title, e.start)
      if (!out.has(key)) out.set(key, { key: e.id, title: e.title, start: e.start, durationMin: e.durationMin, attendeeIds: e.attendeeIds, guests: [], outside: e.attendeeIds.some((id) => p.externalIds.includes(id)) })
    }
  }
  return [...out.values()].sort((a, b) => a.start - b.start)
}

/** Overlapping events share the column side by side, like every calendar. */
function layoutDay(events: Ev[]) {
  const sorted = [...events].sort((a, b) => a.start - b.start || b.durationMin - a.durationMin)
  const placed: { ev: Ev; col: number; cols: number }[] = []
  let cluster: { ev: Ev; col: number; cols: number }[] = []
  let clusterEnd = -Infinity
  const close = () => { const cols = Math.max(0, ...cluster.map((c) => c.col)) + 1; for (const c of cluster) c.cols = cols; placed.push(...cluster); cluster = [] }
  for (const ev of sorted) {
    const end = ev.start + Math.max(ev.durationMin, 20) * 6e4
    if (ev.start >= clusterEnd) { close(); clusterEnd = -Infinity }
    const used = new Set(cluster.filter((c) => c.ev.start + Math.max(c.ev.durationMin, 20) * 6e4 > ev.start).map((c) => c.col))
    let col = 0
    while (used.has(col)) col++
    cluster.push({ ev, col, cols: 1 })
    clusterEnd = Math.max(clusterEnd, end)
  }
  close()
  return placed
}

function MiniMonth({ cursor, today, marks, onPick }: { cursor: number; today: number; marks: Set<number>; onPick: (at: number) => void }) {
  const t = useT()
  const [month, setMonth] = useState(monthStart(cursor))
  useEffect(() => setMonth(monthStart(cursor)), [cursor])
  const first = weekStart(month)
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i))
  const inMonth = (d: number) => new Date(d).getMonth() === new Date(month).getMonth()
  return (
    <div className="rp-cal-mini">
      <div className="rp-cal-mini-head">
        <span>{fmt(month, { month: 'long', year: 'numeric' })}</span>
        <IconButton icon="chevron_left" size={28} label={t({ fr: 'Mois précédent', en: 'Previous month' })} onClick={() => setMonth(monthStart(addDays(month, -1)))} />
        <IconButton icon="chevron_right" size={28} label={t({ fr: 'Mois suivant', en: 'Next month' })} onClick={() => setMonth(monthStart(addDays(month, 32)))} />
      </div>
      <div className="rp-cal-mini-grid" role="grid" aria-label={fmt(month, { month: 'long', year: 'numeric' })}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="rp-cal-mini-dow" aria-hidden="true">{d}</span>)}
        {days.map((d) => (
          <button key={d} type="button" className={`${d === today ? 'today ' : ''}${d === startOfDay(cursor) ? 'sel ' : ''}${inMonth(d) ? '' : 'out '}${marks.has(d) ? 'mark' : ''}`} aria-label={fmt(d, { weekday: 'long', month: 'long', day: 'numeric' })} aria-current={d === today ? 'date' : undefined} onClick={() => onPick(d)}>
            {new Date(d).getDate()}
          </button>
        ))}
      </div>
    </div>
  )
}

/** A floating card next to what was clicked; a bottom sheet on a phone. Esc, click outside, focus comes back. */
function Floating({ anchor, label, onClose, children }: { anchor: DOMRect | null; label: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<React.CSSProperties>({ visibility: 'hidden' })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const m = el.getBoundingClientRect()
    if (innerWidth < 600 || !anchor) { setPos({}); return }
    const right = anchor.right + 8 + m.width < innerWidth - 8
    const left = right ? anchor.right + 8 : Math.max(8, anchor.left - m.width - 8)
    setPos({ left, top: Math.max(8, Math.min(anchor.top, innerHeight - m.height - 8)) })
  }, [anchor])
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('[data-autofocus],button')?.focus({ preventScroll: true })
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose() }
    document.addEventListener('keydown', key, true)
    const timer = setTimeout(() => document.addEventListener('mousedown', down), 0)
    return () => { clearTimeout(timer); document.removeEventListener('keydown', key, true); document.removeEventListener('mousedown', down); prev?.focus?.({ preventScroll: true }) }
  }, [onClose])
  return createPortal(<div ref={ref} className="rp-cal-float" role="dialog" aria-label={label} style={pos}>{children}</div>, document.body)
}

export function CalendarBlock({ block }: { block: Extract<Block, { type: 'calendar' }> }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const { project, role, viewerId } = useBoard()
  const push = useStore((s) => s.push)
  const toast = useStore((s) => s.toast)
  const setMobilePane = useStore((s) => s.setMobilePane)
  const focusMessage = useStore((s) => s.focusMessage)
  const rootRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [gridH, setGridH] = useState(0)
  const [cursor, setCursor] = useState(() => startOfDay(Date.now()))
  const [chosen, setChosen] = useState<View | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [card, setCard] = useState<{ ev: Ev; rect: DOMRect } | null>(null)
  const [draft, setDraft] = useState<{ start: number; rect: DOMRect | null } | null>(null)
  const [title, setTitle] = useState('')
  const [dur, setDur] = useState(30)
  const readOnly = role === 'guest'
  const today = startOfDay(now)

  useEffect(() => { const x = setInterval(() => setNow(Date.now()), 60e3); return () => clearInterval(x) }, [])
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const narrow = width > 0 && width < 620
  const showRail = width >= 780
  const view: View = chosen && !(narrow && (chosen === 'week' || chosen === 'month')) && !(!narrow && chosen === 'agenda') ? chosen : narrow ? 'day' : 'week'

  const events = useMemo(() => eventsOf(project, viewerId), [project, viewerId])
  const allDay: AllDay[] = useMemo(() => project.blocks.flatMap((b) => (b.type === 'timeline' ? b.items.filter((i) => i.milestone).map((i) => ({ id: i.id, label: i.label, at: startOfDay(i.start), blockId: b.id })) : [])), [project.blocks])
  const marks = useMemo(() => new Set(events.map((e) => startOfDay(e.start))), [events])

  const days = view === 'day' ? [startOfDay(cursor)] : view === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(weekStart(cursor), i)) : []
  const heading = view === 'month' || view === 'week' || view === 'agenda'
    ? fmt(cursor, { month: 'long', year: 'numeric' })
    : fmt(cursor, { weekday: width < 420 ? 'short' : 'long', month: 'long', day: 'numeric' })

  const go = (dir: -1 | 1) => setCursor((c) => {
    if (view === 'day') return addDays(c, dir)
    if (view === 'week') return addDays(c, 7 * dir)
    if (view === 'agenda') return addDays(c, 14 * dir)
    const d = new Date(c)
    return new Date(d.getFullYear(), d.getMonth() + dir, 1).getTime()
  })

  // Hours are sized so 8 AM to 7 PM fills the pane, and the grid opens there.
  const hourH = Math.max(44, Math.min(84, gridH / 11))
  useLayoutEffect(() => {
    const el = gridRef.current
    if (!el) return
    const read = () => setGridH(el.clientHeight - (el.querySelector<HTMLElement>('.rp-cal-sticky')?.offsetHeight ?? 0))
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [view, days.length === 0]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (gridRef.current) gridRef.current.scrollTop = 8 * hourH - 12 }, [view, hourH])

  const openEvent = (e: React.MouseEvent, ev: Ev) => { e.stopPropagation(); setDraft(null); setCard({ ev, rect: e.currentTarget.getBoundingClientRect() }) }
  const startDraft = (start: number, rect: DOMRect | null) => { if (readOnly) return; setCard(null); setTitle(''); setDur(30); setDraft({ start, rect }) }
  const onColumnClick = (e: React.MouseEvent<HTMLDivElement>, day: number) => {
    if (e.target !== e.currentTarget) return
    const r = e.currentTarget.getBoundingClientRect()
    const mins = Math.max(0, Math.min(23 * 60 + 30, Math.floor(((e.clientY - r.top) / hourH) * 2) * 30))
    startDraft(day + mins * 6e4, new DOMRect(e.clientX, e.clientY, 0, 0))
  }
  const nextSlot = () => {
    const base = startOfDay(cursor) === today ? now : startOfDay(cursor) + 9 * 36e5
    return Math.ceil(base / 18e5) * 18e5
  }
  const closeCard = useMemo(() => () => setCard(null), [])
  const closeDraft = useMemo(() => () => setDraft(null), [])
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const name = title.trim()
    if (!draft || !name) return
    push(project.id, {
      id: uid('m'), kind: 'meeting', authorId: viewerId, at: Date.now(), visibility: { type: 'all' },
      title: name, start: draft.start, durationMin: dur,
      attendeeIds: project.memberIds.filter((id) => personById(id).role !== 'ai'),
    })
    setDraft(null)
    toast({ text: { fr: 'Invitation envoyée dans le chat', en: 'Invite posted in the chat' }, icon: 'event' })
  }
  const toMessage = (id: string) => { setCard(null); setMobilePane('chat'); focusMessage(id) }
  const openRoadmap = (blockId: string) => document.querySelector<HTMLElement>(`[data-tab="${CSS.escape(blockId)}"] [role="tab"]`)?.click()
  const eventsOn = (d: number) => events.filter((e) => startOfDay(e.start) === d)

  const chip = (ev: Ev) => (
    <button key={ev.key} type="button" className={`rp-cal-chip${ev.outside ? ' outside' : ''}${ev.ended ? ' past' : ''}`} onClick={(e) => openEvent(e, ev)} title={`${fmtTime(ev.start, lang)} ${t(ev.title)}`} aria-label={`${t(ev.title)}, ${fmtTime(ev.start, lang)}`}>
      <span className="rp-trunc">{t(ev.title)}</span>
    </button>
  )
  const VIEWS: { v: View; label: string }[] = narrow
    ? [{ v: 'day', label: t({ fr: 'Jour', en: 'Day' }) }, { v: 'agenda', label: t({ fr: 'Liste', en: 'Agenda' }) }]
    : [{ v: 'day', label: t({ fr: 'Jour', en: 'Day' }) }, { v: 'week', label: t({ fr: 'Semaine', en: 'Week' }) }, { v: 'month', label: t({ fr: 'Mois', en: 'Month' }) }]

  const gridView = (
    <div ref={gridRef} className="rp-cal-grid" role="region" tabIndex={0} aria-label={heading} style={{ '--hh': `${hourH}px`, '--days': days.length } as React.CSSProperties}>
      <div className="rp-cal-sticky">
        <div className="rp-cal-dayhead">
          <span className="rp-cal-gutter" />
          {days.map((d) => (
            <button key={d} type="button" className={`rp-cal-dh${d === today ? ' today' : ''}`} aria-label={fmt(d, { weekday: 'long', month: 'long', day: 'numeric' })} onClick={() => { setCursor(d); setChosen('day') }}>
              <span>{fmt(d, { weekday: 'short' })}</span>
              <b>{new Date(d).getDate()}</b>
            </button>
          ))}
        </div>
        {days.some((d) => allDay.some((a) => a.at === d)) && (
          <div className="rp-cal-allday">
            <span className="rp-cal-gutter rp-cal-alllabel">{t({ fr: 'Jour', en: 'All day' })}</span>
            {days.map((d) => (
              <div key={d} className="rp-cal-allcol">
                {allDay.filter((a) => a.at === d).map((a) => <button key={a.id} type="button" className="rp-cal-pill" title={t(a.label)} onClick={() => openRoadmap(a.blockId)}><Icon name="flag" fill size={12} /><span className="rp-trunc">{t(a.label)}</span></button>)}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rp-cal-hours">
        <div className="rp-cal-gutter rp-cal-times" aria-hidden="true">
          {Array.from({ length: 23 }, (_, i) => <span key={i} style={{ top: (i + 1) * hourH }}>{new Date(2026, 0, 1, i + 1).toLocaleTimeString('en-US', { hour: 'numeric' })}</span>)}
        </div>
        {days.map((d) => (
          <div key={d} className={`rp-cal-col${d === today ? ' today' : ''}`} onClick={(e) => onColumnClick(e, d)}>
            {d === today && <i className="rp-cal-now" style={{ top: (minutesOf(now) / 60) * hourH }} />}
            {layoutDay(eventsOn(d)).map(({ ev, col, cols }) => {
              const top = (minutesOf(ev.start) / 60) * hourH
              const h = Math.max(22, (ev.durationMin / 60) * hourH - 2)
              // what fits, line by line: a title, then its time, then a second title line, then the faces
              const tall = h >= 40
              const roomy = h >= 56
              return (
                <button
                  key={ev.key}
                  type="button"
                  className={`rp-cal-ev${ev.outside ? ' outside' : ''}${ev.ended || ev.start + ev.durationMin * 6e4 < now ? ' past' : ''}${ev.live ? ' live' : ''}${tall && !(cols > 1 && days.length > 1) ? ` tall${roomy ? ' roomy' : ''}` : ''}`}
                  style={{ top, height: h, left: `calc(${(col / cols) * 100}% + 1px)`, width: `calc(${100 / cols}% - 6px)` }}
                  onClick={(e) => openEvent(e, ev)}
                  aria-label={`${t(ev.title)}, ${fmt(ev.start, { weekday: 'long', month: 'long', day: 'numeric' })}, ${fmtTime(ev.start, lang)}, ${ev.durationMin} min`}
                >
                  <span className="rp-cal-evtitle">{t(ev.title)}</span>
                  <span className="rp-cal-evtime">{fmtTime(ev.start, lang)}</span>
                  {h >= 80 && cols === 1 && <span className="rp-cal-evfaces"><AvatarStack ids={ev.attendeeIds} size={18} max={3} /></span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )

  const monthView = (() => {
    const first = weekStart(monthStart(cursor))
    const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i))
    const month = new Date(cursor).getMonth()
    return (
      <div className="rp-cal-month" role="grid" aria-label={heading}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <span key={d} className="rp-cal-mdow">{d}</span>)}
        {cells.map((d) => {
          const list = eventsOn(d)
          const pills = allDay.filter((a) => a.at === d)
          const room = Math.max(0, 2 - pills.length)
          return (
            <div key={d} className={`rp-cal-cell${new Date(d).getMonth() === month ? '' : ' out'}`} onClick={(e) => { if (e.target === e.currentTarget) startDraft(d + 10 * 36e5, new DOMRect(e.clientX, e.clientY, 0, 0)) }}>
              <button type="button" className={`rp-cal-mday${d === today ? ' today' : ''}`} aria-label={fmt(d, { weekday: 'long', month: 'long', day: 'numeric' })} onClick={() => { setCursor(d); setChosen('day') }}>{new Date(d).getDate()}</button>
              {pills.map((a) => <button key={a.id} type="button" className="rp-cal-pill" title={t(a.label)} onClick={() => openRoadmap(a.blockId)}><Icon name="flag" fill size={12} /><span className="rp-trunc">{t(a.label)}</span></button>)}
              {list.slice(0, room).map(chip)}
              {list.length > room && <button type="button" className="rp-cal-more" onClick={() => { setCursor(d); setChosen('day') }}>{t({ fr: `${list.length - room} de plus`, en: `${list.length - room} more` })}</button>}
            </div>
          )
        })}
      </div>
    )
  })()

  const agendaView = (() => {
    const from = startOfDay(cursor)
    const groups = Array.from({ length: 30 }, (_, i) => addDays(from, i)).map((d) => ({ d, list: eventsOn(d), pills: allDay.filter((a) => a.at === d) })).filter((g) => g.list.length || g.pills.length)
    return (
      <div className="rp-cal-agenda">
        {groups.length === 0 && <p className="rp-cal-noevents">{t({ fr: 'Rien de prévu ces 30 prochains jours.', en: 'Nothing planned for the next 30 days.' })}</p>}
        {groups.map((g) => (
          <section key={g.d} className="rp-cal-aday">
            <span className={`rp-cal-adate${g.d === today ? ' today' : ''}`}><b>{new Date(g.d).getDate()}</b><span>{fmt(g.d, { month: 'short' })}, {fmt(g.d, { weekday: 'short' })}</span></span>
            <div>
              {g.pills.map((a) => <button key={a.id} type="button" className="rp-cal-pill" onClick={() => openRoadmap(a.blockId)}><Icon name="flag" fill size={12} /><span className="rp-trunc">{t(a.label)}</span></button>)}
              {g.list.map((ev) => (
                <button key={ev.key} type="button" className={`rp-cal-arow${ev.outside ? ' outside' : ''}`} onClick={(e) => openEvent(e, ev)}>
                  <b>{t(ev.title)}</b>
                  <span>{fmtTime(ev.start, lang)}, {ev.durationMin} min</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    )
  })()

  return (
    <Frame
      block={block}
      className="rp-fill rp-cal"
      heading={heading}
      actions={(
        <>
          <button type="button" className="chip click" onClick={() => setCursor(today)}>{t({ fr: 'Aujourd’hui', en: 'Today' })}</button>
          <IconButton icon="chevron_left" size={32} label={t({ fr: 'Précédent', en: 'Previous' })} onClick={() => go(-1)} />
          <IconButton icon="chevron_right" size={32} label={t({ fr: 'Suivant', en: 'Next' })} onClick={() => go(1)} />
          <div className="rp-seg" role="group" aria-label={t({ fr: 'Vue', en: 'View' })}>
            {VIEWS.map((v) => <button key={v.v} type="button" className={view === v.v ? 'on' : ''} aria-pressed={view === v.v} onClick={() => setChosen(v.v)}>{v.label}</button>)}
          </div>
          {!readOnly && !showRail && <IconButton icon="add" size={32} label={t({ fr: 'Nouvel événement', en: 'New event' })} onClick={(e) => startDraft(nextSlot(), e.currentTarget.getBoundingClientRect())} />}
        </>
      )}
    >
      <div ref={rootRef} className="rp-cal-main">
        {showRail && (
          <div className="rp-cal-rail">
            {!readOnly && <Button variant="tonal" size="s" icon="add" onClick={(e) => startDraft(nextSlot(), e.currentTarget.getBoundingClientRect())}>{t({ fr: 'Créer', en: 'Create' })}</Button>}
            <MiniMonth cursor={cursor} today={today} marks={marks} onPick={setCursor} />
            <UpNext events={events} now={now} onOpen={(e, ev) => openEvent(e, ev)} />
          </div>
        )}
        <div className="rp-cal-view">
          {view === 'month' ? monthView : view === 'agenda' ? agendaView : gridView}
        </div>
      </div>
      {card && <EventCard key={card.ev.key} ev={card.ev} rect={card.rect} project={project} readOnly={readOnly} onClose={closeCard} onMessage={toMessage} now={now} />}
      {draft && (
        <Floating anchor={draft.rect} label={t({ fr: 'Nouvel événement', en: 'New event' })} onClose={closeDraft}>
          <form onSubmit={save} className="rp-cal-form">
            <input data-autofocus className="rp-cal-title" value={title} maxLength={120} placeholder={t({ fr: 'Ajouter un titre', en: 'Add title' })} aria-label={t({ fr: 'Titre', en: 'Title' })} onChange={(e) => setTitle(e.target.value)} />
            <p className="rp-cal-when"><Icon name="schedule" size={18} />{fmt(draft.start, { weekday: 'long', month: 'long', day: 'numeric' })}, {fmtTime(draft.start, lang)}</p>
            <label className="rp-cal-dur"><Icon name="event" size={18} />
              <select value={dur} aria-label={t({ fr: 'Durée', en: 'Duration' })} onChange={(e) => setDur(Number(e.target.value))}>
                {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? '' : 's'}`}</option>)}
              </select>
            </label>
            <p className="rp-cal-when"><Icon name="group" size={18} />{t({ fr: 'Tout le projet est invité', en: 'Everyone on the project is invited' })}</p>
            <div className="rp-cal-actions">
              <Button size="s" onClick={closeDraft}>{t({ fr: 'Annuler', en: 'Cancel' })}</Button>
              <Button size="s" variant="filled" type="submit" disabled={!title.trim()}>{t({ fr: 'Enregistrer', en: 'Save' })}</Button>
            </div>
          </form>
        </Floating>
      )}
    </Frame>
  )
}

function UpNext({ events, now, onOpen }: { events: Ev[]; now: number; onOpen: (e: React.MouseEvent, ev: Ev) => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const box = useRef<HTMLDivElement>(null)
  const next = events.filter((e) => !e.ended && e.start + e.durationMin * 6e4 >= now).slice(0, 4)
  useEffect(() => { revealIn(box.current, box.current?.firstElementChild) }, [])
  if (!next.length) return <p className="rp-cal-noevents">{t({ fr: 'Rien de prévu', en: 'Nothing planned' })}</p>
  return (
    <div ref={box} className="rp-cal-next">
      <h4>{t({ fr: 'À venir', en: 'Coming up' })}</h4>
      {next.map((ev) => (
        <button key={ev.key} type="button" className={ev.outside ? 'outside' : ''} onClick={(e) => onOpen(e, ev)}>
          <b>{t(ev.title)}</b>
          <span>{fmt(ev.start, { month: 'short', day: 'numeric' })}, {fmtTime(ev.start, lang)}</span>
        </button>
      ))}
    </div>
  )
}

function EventCard({ ev, rect, project, readOnly, onClose, onMessage, now }: { ev: Ev; rect: DOMRect; project: Project; readOnly: boolean; onClose: () => void; onMessage: (id: string) => void; now: number }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const over = ev.ended || ev.start + ev.durationMin * 6e4 < now
  const end = ev.start + ev.durationMin * 6e4
  return (
    <Floating anchor={rect} label={t(ev.title)} onClose={onClose}>
      <div className="rp-cal-card">
        <div className="rp-cal-cardbar">
          <IconButton icon="close" size={32} label={t({ fr: 'Fermer', en: 'Close' })} onClick={onClose} />
        </div>
        <h4><i className={ev.outside ? 'outside' : ''} />{t(ev.title)}</h4>
        <p className="rp-cal-when">{fmt(ev.start, { weekday: 'long', month: 'long', day: 'numeric' })}<br />{fmtTime(ev.start, lang)} to {fmtTime(end, lang)}</p>
        {!over && !readOnly && <Button variant="filled" size="s" icon="videocam" onClick={() => { startCall(project.id); onClose() }}>{t({ fr: 'Rejoindre', en: 'Join' })}</Button>}
        {over && <p className="rp-cal-when">{t({ fr: 'Terminé', en: 'This meeting has ended' })}</p>}
        <h5>{t({ fr: `${ev.attendeeIds.length + ev.guests.length} invités`, en: `${ev.attendeeIds.length + ev.guests.length} guest${ev.attendeeIds.length + ev.guests.length === 1 ? '' : 's'}` })}</h5>
        <ul className="rp-cal-guests">
          {ev.attendeeIds.map((id) => <li key={id}><Avatar id={id} size={24} status /><span className="rp-trunc">{personById(id).name}</span></li>)}
          {ev.guests.map((mail) => <li key={mail}><Icon name="person" size={20} /><span className="rp-trunc">{mail}</span></li>)}
        </ul>
        {ev.messageId && <Button size="s" icon="chat_bubble" onClick={() => onMessage(ev.messageId!)}>{t({ fr: 'Voir dans le chat', en: 'Go to the message' })}</Button>}
      </div>
    </Floating>
  )
}
