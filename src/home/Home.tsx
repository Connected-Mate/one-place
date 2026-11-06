/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Home: the one place across all your projects. Gemini says what needs you; a click takes you to the exact spot.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AvatarStack, Button, Icon, IconButton, Sparkle } from '../ui/kit'
import { startCall } from '../call/callActions'
import { useChat } from '../chat/chatState'
import { fmtDate, fmtTime, tx, useT } from '../i18n'
import { ME_ID, personById, useStore, useViewer } from '../store'
import type { Project } from '../data/types'
import { canJoin, daysFrom, geminiBrief, projectStatus, todoProgress, useAgenda, useNeeds, type AgendaItem, type Need } from './needs'
import { openBlock, openMessage, openTodo } from './goTo'
import { TryCard } from '../shell/TryPanel'
import './home.css'

const MAX_ROWS = 6
const MAX_EVENTS = 5
const LEAVE_MS = 320

const greetingFor = (hour: number) => (hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening')

export function Home({ onAbout }: { onAbout: () => void }) {
  const t = useT()
  const viewer = useViewer()
  const today = new Date()
  const name = viewer.name.split(/\s+/)[0]
  return (
    <section className="pane home-pane" aria-label={t({ fr: 'Accueil', en: 'Home' })}>
      <div className="hm-scroll">
        <div className="hm">
          <header className="hm-greet">
            <h1>{greetingFor(today.getHours())}, {name}</h1>
            <p>{today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            {/* On a phone the top bar is only the search pill: the concept framing and the persona stay reachable here. */}
            <div className="hm-chips">
              <button type="button" className="concept" onClick={onAbout} title={t({ fr: 'À propos de ce concept', en: 'About this concept' })}><span>{t({ fr: 'Concept', en: 'Concept' })}</span></button>
              {viewer.id !== ME_ID && <Button size="s" variant="tonal" icon="visibility" onClick={() => useStore.getState().setViewer(ME_ID)} title={t({ fr: 'Revenir à Alex', en: 'Back to Alex' })}>{t({ fr: 'Vu par', en: 'Viewing as' })} {name}</Button>}
            </div>
          </header>
          <TryCard />
          <div className="hm-top">
            <WhatNeedsYou key={viewer.id} />
            <ComingUp key={`up-${viewer.id}`} />
          </div>
          <ProjectTiles />
        </div>
      </div>
    </section>
  )
}

/* ---------------- What needs you ---------------- */
type Shown = { need: Need; leaving: boolean }

function WhatNeedsYou() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const { items, count } = useNeeds()
  const [all, setAll] = useState(false)
  const visible = useMemo(() => (all ? items : items.slice(0, MAX_ROWS)), [items, all])

  // A resolved row stays for one calm animation before it goes. Pushed down the list is not resolved.
  const [prev, setPrev] = useState(visible)
  const [ghosts, setGhosts] = useState<{ need: Need; index: number }[]>([])
  if (prev !== visible) {
    const gone = prev.map((need, index) => ({ need, index })).filter(({ need }) => !items.some((x) => x.id === need.id))
    setPrev(visible)
    if (gone.length) setGhosts((g) => [...g, ...gone])
  }
  useEffect(() => {
    if (!ghosts.length) return
    const x = setTimeout(() => setGhosts([]), LEAVE_MS)
    return () => clearTimeout(x)
  }, [ghosts])
  const rows: Shown[] = visible.map((need) => ({ need, leaving: false }))
  for (const g of ghosts) if (!rows.some((r) => r.need.id === g.need.id)) rows.splice(Math.min(g.index, rows.length), 0, { need: g.need, leaving: true })

  // Only rows that arrive later animate in, not the whole list on landing.
  const known = useRef(new Set(visible.map((n) => n.id)))
  useEffect(() => { for (const n of visible) known.current.add(n.id) }, [visible])

  const list = useRef<HTMLUListElement>(null)
  /** The row under the keyboard is about to leave: hand the focus to the next one instead of dropping it. */
  const focusNext = (id: string) => {
    const li = list.current?.querySelector(`[data-need="${CSS.escape(id)}"]`)
    const next = (li?.nextElementSibling ?? li?.previousElementSibling)?.querySelector<HTMLElement>('.hm-main')
    next?.focus({ preventScroll: true })
  }

  const hidden = items.length - visible.length
  const empty = !items.length && !ghosts.length
  return (
    <section className="hm-needs" aria-labelledby="hm-needs-title">
      <h2 id="hm-needs-title" className="hm-title"><Sparkle size={20} />{t({ fr: 'Ce qui t’attend', en: 'What needs you' })}{count > 0 && <span className="hm-count">{count}</span>}</h2>
      <p className="hm-brief">{geminiBrief(items, lang)}</p>
      {empty ? (
        <div className="hm-clear">
          <Icon name="task_alt" size={32} />
          <p>{t({ fr: 'Gemini te préviendra dès que quelque chose demande ton attention.', en: 'Gemini will tell you as soon as something needs you.' })}</p>
        </div>
      ) : (
        <ul ref={list} className="hm-rows">
          {rows.map(({ need, leaving }) => <NeedRow key={need.id} need={need} leaving={leaving} fresh={!leaving && !known.current.has(need.id)} onResolve={() => focusNext(need.id)} />)}
        </ul>
      )}
      {hidden > 0 && <Button size="s" className="hm-more" icon="expand_more" onClick={() => setAll(true)}>{hidden} more</Button>}
      {all && items.length > MAX_ROWS && <Button size="s" className="hm-more" icon="expand_less" onClick={() => setAll(false)}>{t({ fr: 'Moins', en: 'Show less' })}</Button>}
    </section>
  )
}

const KIND_ICON: Record<Need['kind'], string> = { live: 'videocam', todo: 'check', proposal: 'how_to_vote', waiting: 'hourglass_empty', mail: 'mail', mention: 'alternate_email', meeting: 'event' }

function NeedRow({ need, leaving, fresh, onResolve }: { need: Need; leaving: boolean; fresh: boolean; onResolve: () => void }) {
  const t = useT()
  const viewerId = useStore((s) => s.viewerId)
  const s = useStore.getState()
  const pid = need.project.id
  const name = t(need.project.name)
  const inCall = useStore((st) => st.call?.projectId === pid)

  const go = () => {
    if (need.kind === 'todo' && need.blockId && need.todo) openTodo(pid, need.blockId, need.todo.id)
    else if (need.messageId) openMessage(pid, need.messageId)
  }
  const tick = () => {
    const st = useStore.getState()
    const block = st.projects.find((p) => p.id === pid)?.blocks.find((b) => b.id === need.blockId)
    const todo = block?.type === 'todo' ? block.todos.find((x) => x.id === need.todo?.id) : undefined
    if (!todo || todo.done || !need.blockId) return // a second click must not untick it
    onResolve()
    st.toggleTodo(pid, need.blockId, todo.id)
    st.toast({
      text: { fr: 'Tâche terminée.', en: 'Marked done.' }, icon: 'task_alt',
      action: { label: { fr: 'Annuler', en: 'Undo' }, run: () => {
        const again = useStore.getState().projects.find((p) => p.id === pid)?.blocks.find((b) => b.id === need.blockId)
        if (again?.type === 'todo' && again.todos.find((x) => x.id === todo.id)?.done) useStore.getState().toggleTodo(pid, need.blockId!, todo.id)
      } },
    })
  }
  const decide = (approved: boolean) => {
    if (!need.messageId) return
    const st = useStore.getState()
    const m = st.projects.find((p) => p.id === pid)?.messages.find((x) => x.id === need.messageId)
    if (m?.kind !== 'proposal' || m.status !== 'pending') return
    onResolve()
    st.decideProposal(pid, need.messageId, approved)
    st.toast(approved
      ? { text: `Approved. ${name} is up to date.`, icon: 'check_circle', action: { label: { fr: 'Voir', en: 'Show' }, run: () => openMessage(pid, need.messageId!) } }
      : { text: { fr: 'Proposition refusée.', en: 'Proposal declined.' }, icon: 'close' })
  }
  const join = () => {
    const st = useStore.getState()
    // An upcoming meeting becomes the call, with its own title, instead of opening a new one beside it.
    if (need.kind === 'meeting' && need.messageId) st.patch(pid, need.messageId, { live: true } as never)
    startCall(pid)
  }
  const reply = () => {
    openMessage(pid, need.messageId!)
    const c = useChat.getState()
    if (need.kind === 'mail') c.setMailReply({ pid, messageId: need.messageId! })
    c.focusComposer()
  }
  const setAside = () => { onResolve(); s.markHomeDone(`${viewerId}:${need.id}`) }

  const lead = need.kind === 'todo'
    ? <button type="button" className="hm-tick" onClick={tick} aria-label={t({ fr: `Terminer : ${need.text}`, en: `Mark done: ${need.text}` })} title={t({ fr: 'Terminer', en: 'Mark done' })}><Icon name="check" size={16} /></button>
    : <span className={`hm-lead ${need.tone}`}><Icon name={KIND_ICON[need.kind]} size={20} fill={need.kind === 'live'} /></span>

  return (
    <li className={`hm-row${leaving ? ' leaving' : ''}${fresh ? ' fresh' : ''}${need.kind === 'todo' ? ' is-todo' : ''}`} data-need={need.id} inert={leaving || undefined}>
      {lead}
      <button type="button" className="hm-main" onClick={go} title={need.text}>
        <span className="hm-sentence">{need.text}</span>
        <span className="hm-meta">
          <span className={`hm-cue ${need.tone}`}>{need.cue}</span>
          <span className="hm-dot" aria-hidden="true">·</span>
          <span className="hm-project"><Icon name={need.project.icon} size={16} style={{ color: need.project.color }} /><span>{name}</span></span>
        </span>
      </button>
      <div className="hm-actions">
        {need.kind === 'proposal' && <>
          <Button size="s" variant="tonal" onClick={() => decide(true)}>{t({ fr: 'Approuver', en: 'Approve' })}</Button>
          <Button size="s" onClick={() => decide(false)}>{t({ fr: 'Refuser', en: 'Decline' })}</Button>
        </>}
        {need.kind === 'todo' && <Button size="s" onClick={go}>{t({ fr: 'Ouvrir', en: 'Open' })}</Button>}
        {(need.kind === 'mail' || need.kind === 'mention') && <Button size="s" onClick={reply}>{t({ fr: 'Répondre', en: 'Reply' })}</Button>}
        {need.joinable && <Button size="s" variant="filled" icon="videocam" className="join-green" onClick={join}>{inCall ? t({ fr: 'Retour', en: 'Return' }) : t({ fr: 'Rejoindre', en: 'Join' })}</Button>}
        {need.kind === 'meeting' && !need.joinable && <Button size="s" onClick={go}>{t({ fr: 'Préparer', en: 'Prepare' })}</Button>}
        {need.kind === 'waiting' && <Button size="s" onClick={go}>{t({ fr: 'Voir', en: 'View' })}</Button>}
        {need.kind !== 'todo' && need.kind !== 'proposal' && need.kind !== 'live' && (
          <IconButton icon="check" size={32} className="hm-aside" label={t({ fr: `Marquer comme traité : ${need.text}`, en: `Mark as handled: ${need.text}` })} onClick={setAside} />
        )}
      </div>
    </li>
  )
}

/* ---------------- Coming up ---------------- */
const sameDay = (a: number, b: number) => daysFrom(a, b) === 0

function ComingUp() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const { events, now } = useAgenda()
  const [day, setDay] = useState<number | null>(null)
  const [all, setAll] = useState(false)

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() + i); d.setHours(12, 0, 0, 0)
    return d.getTime()
  }), [now])
  const shown = day == null ? events : events.filter((e) => sameDay(e.start, day))
  const list = all ? shown : shown.slice(0, MAX_EVENTS)
  const hidden = shown.length - list.length

  return (
    <section className="hm-up" aria-labelledby="hm-up-title">
      <h2 id="hm-up-title" className="hm-title"><Icon name="calendar_month" size={20} />{t({ fr: 'À venir', en: 'Coming up' })}</h2>
      <div className="hm-week" role="group" aria-label={t({ fr: 'Filtrer par jour', en: 'Filter by day' })}>
        {week.map((d, i) => {
          const dayEvents = events.filter((e) => sameDay(e.start, d))
          const on = day === d
          const date = new Date(d)
          const label = `${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}, ${dayEvents.length} ${dayEvents.length === 1 ? 'event' : 'events'}`
          return (
            <button key={d} type="button" className={`hm-day${i === 0 ? ' today' : ''}${on ? ' on' : ''}`} aria-pressed={on} aria-label={label} onClick={() => { setDay(on ? null : d); setAll(false) }}>
              <span className="hm-day-name" aria-hidden="true">{date.toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
              <span className="hm-day-num" aria-hidden="true">{date.getDate()}</span>
              <span className="hm-day-dots" aria-hidden="true">{dayEvents.slice(0, 3).map((e) => <i key={e.key} style={{ background: e.project.color }} />)}</span>
            </button>
          )
        })}
      </div>
      {list.length === 0 ? (
        <p className="hm-none">{day == null
          ? t({ fr: 'Rien à l’agenda. Demande à @Gemini de caler un point.', en: 'Nothing on your calendar. Ask @Gemini to book something.' })
          : t({ fr: 'Rien ce jour-là.', en: 'Nothing that day.' })}</p>
      ) : (
        <ol className="hm-events">
          {list.map((e, i) => {
            const firstOfDay = i === 0 || !sameDay(list[i - 1].start, e.start)
            return <EventRow key={e.key} e={e} now={now} firstOfDay={firstOfDay} lang={lang} />
          })}
        </ol>
      )}
      {hidden > 0 && <Button size="s" className="hm-more" icon="expand_more" onClick={() => setAll(true)}>{hidden} more</Button>}
    </section>
  )
}

function EventRow({ e, now, firstOfDay, lang }: { e: AgendaItem; now: number; firstOfDay: boolean; lang: 'fr' | 'en' }) {
  const t = useT()
  const date = new Date(e.start)
  const end = e.start + e.durationMin * 60e3
  const pid = e.project.id
  const title = t(e.title)
  const join = canJoin(e, now)
  const inCall = useStore((st) => st.call?.projectId === pid)
  const isToday = daysFrom(e.start, now) === 0
  const open = () => { if (e.messageId) openMessage(pid, e.messageId); else if (e.blockId) openBlock(pid, e.blockId) }
  const onJoin = () => {
    // same rule as the row above: the meeting itself becomes the call
    if (!e.live && e.messageId) useStore.getState().patch(pid, e.messageId, { live: true } as never)
    startCall(pid)
  }
  return (
    <li className={`hm-event${firstOfDay ? ' first' : ''}`}>
      <span className={`hm-date${isToday ? ' today' : ''}`} aria-hidden={!firstOfDay}>
        {firstOfDay && <><small>{date.toLocaleDateString('en-US', { weekday: 'short' })}</small><b>{date.getDate()}</b></>}
      </span>
      <button type="button" className="hm-event-main" onClick={open} title={title} style={{ '--ev': e.project.color } as React.CSSProperties}>
        <span className="hm-event-title">{title}</span>
        <span className="hm-event-time">
          {e.live ? <span className="hm-cue live">{t({ fr: 'En direct', en: 'Live now' })}</span> : <>{fmtTime(e.start, lang)} to {fmtTime(end, lang)}{!firstOfDay ? '' : daysFrom(e.start, now) > 6 ? `, ${fmtDate(e.start, lang)}` : ''}</>}
        </span>
        <span className="hm-event-project">{t(e.project.name)}</span>
      </button>
      <div className="hm-event-side">
        {join
          ? <Button size="s" variant="filled" icon="videocam" className="join-green" onClick={onJoin}>{inCall ? t({ fr: 'Retour', en: 'Return' }) : t({ fr: 'Rejoindre', en: 'Join' })}</Button>
          : <>
              {e.guests > 0 && <span className="hm-guest"><Icon name="person_add" size={14} />{e.guests > 1 ? `${e.guests} guests` : 'Guest'}</span>}
              <AvatarStack ids={e.attendeeIds} size={24} max={3} />
            </>}
      </div>
    </li>
  )
}

/* ---------------- Projects ---------------- */
function ProjectTiles() {
  const t = useT()
  const projects = useStore((s) => s.projects)
  const viewerId = useStore((s) => s.viewerId)
  const mine = projects.filter((p) => p.memberIds.includes(viewerId))
  return (
    <section className="hm-projects" aria-labelledby="hm-projects-title">
      <h2 id="hm-projects-title" className="hm-title"><Icon name="folder" size={20} />{t({ fr: 'Tes projets', en: 'Your projects' })}</h2>
      <ul className="hm-tiles">{mine.map((p) => <li key={p.id}><Tile p={p} /></li>)}</ul>
    </section>
  )
}

function Tile({ p }: { p: Project }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const viewerId = useStore((s) => s.viewerId)
  const select = useStore((s) => s.selectProject)
  const live = useStore((s) => s.call?.projectId === p.id)
  const status = projectStatus(p, viewerId, lang)
  const { total, done } = todoProgress(p)
  const open = total - done
  const name = tx(p.name, lang)
  return (
    <button type="button" className="hm-tile" onClick={() => select(p.id)} title={name}>
      <span className="hm-tile-head">
        <Icon name={p.icon} size={20} style={{ color: p.color }} fill />
        <span className="hm-tile-name">{name}</span>
        {live && <Icon name="call" size={16} className="rail-live" />}
        {p.unread > 0 && <span className="hm-tile-unread">{p.unread}<span className="sr-only"> {t({ fr: 'non lus', en: 'unread' })}</span></span>}
      </span>
      <span className="hm-tile-status">{status}</span>
      <span className="hm-tile-foot">
        <AvatarStack ids={p.memberIds.filter((id) => personById(id).role !== 'ai')} size={22} max={4} />
        <span className="hm-progress">
          <span className="hm-progress-label">{total === 0 ? t({ fr: 'Aucune tâche', en: 'No to-dos yet' }) : open === 0 ? t({ fr: 'Tout est fait', en: 'All done' }) : `${open} open`}</span>
          {total > 0 && <span className="hm-bar" aria-hidden="true"><i style={{ width: `${Math.round((done / total) * 100)}%` }} /></span>}
        </span>
      </span>
    </button>
  )
}
