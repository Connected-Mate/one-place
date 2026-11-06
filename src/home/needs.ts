/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// What Home knows: everything is derived from the live store, for one viewer, on each change. Nothing is hardcoded.
import { useEffect, useMemo, useState } from 'react'
import { canSee, personById, useStore } from '../store'
import type { CallState, Lang, Message, Project, Todo, Txt } from '../data/types'
import { fmtDate, fmtDay, fmtTime, tx } from '../i18n'

export type NeedKind = 'live' | 'todo' | 'proposal' | 'waiting' | 'mail' | 'mention' | 'meeting'
export type Tone = 'late' | 'soon' | 'calm' | 'live'

export interface Need {
  id: string
  kind: NeedKind
  project: Project
  rank: number
  at: number
  cue: string
  tone: Tone
  text: string
  /** the exact place a click goes to */
  messageId?: string
  blockId?: string
  todo?: Todo
  /** starts within minutes: Join instead of Prepare */
  joinable?: boolean
}

export interface AgendaItem {
  key: string
  project: Project
  title: Txt
  start: number
  durationMin: number
  attendeeIds: string[]
  guests: number
  live: boolean
  messageId?: string
  blockId?: string
}

const DAY_MS = 864e5
const SOON_DAYS = 3
const JOIN_WINDOW = 15 * 60e3

const dayStart = (at: number) => { const d = new Date(at); d.setHours(0, 0, 0, 0); return d.getTime() }
export const daysFrom = (at: number, now: number) => Math.round((dayStart(at) - dayStart(now)) / DAY_MS)
export const first = (id: string) => personById(id).name.split(/\s+/)[0]
/** "2:00 PM" reads as "2 PM" in a calm sentence */
const clock = (at: number, lang: Lang) => fmtTime(at, lang).replace(':00', '')
const plain = (s: string) => s.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

/** "Today 6 PM", "Tomorrow 2 PM", "Monday 11 AM", "Nov 20". */
export function whenCue(at: number, now: number, lang: Lang): string {
  const d = daysFrom(at, now)
  if (d === 0 || d === 1) return `${fmtDay(at, lang)} ${clock(at, lang)}`
  if (d > 1 && d < 7) return `${new Date(at).toLocaleDateString('en-US', { weekday: 'long' })} ${clock(at, lang)}`
  return fmtDate(at, lang)
}
/** How long something has been sitting there. */
function sinceCue(at: number, now: number): string {
  const d = -daysFrom(at, now)
  if (d <= 0) return 'Today'
  if (d === 1) return 'Since yesterday'
  return `Waiting ${d} days`
}

/** Top-level messages and their thread replies, whichever the viewer may see. */
function visibleMessages(p: Project, viewerId: string): Message[] {
  const out: Message[] = []
  for (const m of p.messages) {
    if (!canSee(m.visibility, viewerId)) continue
    out.push(m)
    for (const r of m.replies ?? []) if (canSee(r.visibility, viewerId)) out.push(r)
  }
  return out
}

const reacted = (m: Message, viewerId: string) => !!m.reactions?.some((r) => r.by.includes(viewerId))

export function computeNeeds(projects: Project[], viewerId: string, done: string[], call: CallState | null, now: number, lang: Lang) {
  const items: Need[] = []
  const skip = (id: string) => done.includes(`${viewerId}:${id}`)

  for (const project of projects) {
    if (!project.memberIds.includes(viewerId)) continue
    const seen = visibleMessages(project, viewerId)
    const lastSpoke = Math.max(0, ...seen.filter((m) => m.authorId === viewerId).map((m) => m.at))

    for (const b of project.blocks) {
      if (b.type !== 'todo') continue
      for (const todo of b.todos) {
        if (todo.done || todo.assigneeId !== viewerId || !todo.due) continue
        const days = daysFrom(todo.due, now)
        if (days > SOON_DAYS) continue
        const late = todo.due < now
        items.push({
          id: todo.id, kind: 'todo', project, blockId: b.id, todo, at: todo.due, text: tx(todo.text, lang),
          rank: late ? 1 : days === 0 ? 2 : days === 1 ? 7 : 9,
          cue: late ? 'Overdue' : whenCue(todo.due, now, lang),
          tone: late ? 'late' : days <= 1 ? 'soon' : 'calm',
        })
      }
    }

    for (const m of seen) {
      if (m.kind === 'proposal' && m.status === 'pending') {
        const title = tx(m.title, lang)
        if (project.ownerId === viewerId) {
          items.push({ id: m.id, kind: 'proposal', project, messageId: m.id, at: m.at, rank: 4, cue: sinceCue(m.at, now), tone: 'calm', text: `${first(m.authorId)} ${m.authorId === 'gemini' ? 'suggests' : 'proposes'}: ${title}` })
        } else if (m.authorId === viewerId && !skip(m.id)) {
          items.push({ id: m.id, kind: 'waiting', project, messageId: m.id, at: m.at, rank: 10, cue: sinceCue(m.at, now), tone: 'calm', text: `Your proposal is with ${first(project.ownerId)}: ${title}` })
        }
      }
      if (m.kind === 'email' && m.direction === 'in' && !reacted(m, viewerId) && !skip(m.id)) {
        const answered = seen.some((x) => x.kind === 'email' && x.direction === 'out' && x.at > m.at && (x.quoteId === m.id || x.to === m.from))
        if (!answered) items.push({ id: m.id, kind: 'mail', project, messageId: m.id, at: m.at, rank: 5, cue: sinceCue(m.at, now), tone: 'calm', text: `${personById(m.authorId).name} is waiting for a reply: ${tx(m.subject, lang).replace(/^(re|tr|fwd)\s*:\s*/i, '')}` })
      }
      if (m.kind === 'text' && m.authorId !== viewerId && m.at > lastSpoke && !reacted(m, viewerId) && !skip(m.id) && tx(m.text, lang).includes(`](${viewerId})`)) {
        const said = plain(tx(m.text, lang)).replace(new RegExp(`^@${personById(viewerId).name}\\s*`), '')
        items.push({ id: m.id, kind: 'mention', project, messageId: m.id, at: m.at, rank: 6, cue: sinceCue(m.at, now), tone: 'calm', text: `${first(m.authorId)} mentioned you: “${short(said, 110)}”` })
      }
      if (m.kind === 'meeting' && !m.ended && (m.attendeeIds.includes(viewerId) || m.authorId === viewerId)) {
        const end = m.start + m.durationMin * 60e3
        const liveHere = !!m.live || call?.projectId === project.id && call.title === m.title
        const title = tx(m.title, lang)
        if (liveHere) {
          items.push({ id: m.id, kind: 'live', project, messageId: m.id, at: m.start, rank: 0, cue: 'Live now', tone: 'live', joinable: true, text: call?.projectId === project.id ? `You are on this call: ${title}` : `This call is happening now: ${title}` })
        } else if (end > now && daysFrom(m.start, now) <= 1 && !skip(m.id)) {
          const others = m.attendeeIds.filter((a) => a !== viewerId).map(first)
          const guests = m.guestEmails?.length ?? 0
          const who = [...others.slice(0, 2), others.length > 2 ? `${others.length - 2} more` : '', guests ? `${guests} ${guests > 1 ? 'guests' : 'guest'}` : ''].filter(Boolean).join(', ')
          const soon = m.start - now <= JOIN_WINDOW
          items.push({
            id: m.id, kind: 'meeting', project, messageId: m.id, at: m.start, joinable: soon,
            rank: soon ? 0 : daysFrom(m.start, now) === 0 ? 3 : 8,
            cue: m.start <= now ? 'Started' : soon ? `In ${Math.max(1, Math.round((m.start - now) / 60e3))} min` : whenCue(m.start, now, lang),
            tone: soon ? 'live' : 'soon',
            text: `Get ready for ${title}${who ? ` · ${who}` : ''}`,
          })
        }
      }
    }
  }
  items.sort((a, b) => a.rank - b.rank || a.at - b.at)
  return { items, count: items.filter((x) => x.kind !== 'waiting').length }
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

/** Gemini's short sentence on top of the list: written from the same items, so it can never disagree with them. */
export function geminiBrief(items: Need[], lang: Lang): string {
  const of = (...kinds: NeedKind[]) => items.filter((x) => kinds.includes(x.kind))
  const late = items.filter((x) => x.tone === 'late').length
  const soon = of('todo').length - late
  const open = items.filter((x) => x.kind !== 'waiting')
  const waiting = of('waiting')
  if (!open.length) {
    return waiting.length
      ? `You're all caught up. ${waiting.length > 1 ? `${waiting.length} of your proposals are` : 'One of your proposals is'} still waiting for a decision.`
      : "You're all caught up."
  }
  const live = of('live').length
  const parts = [
    soon ? (soon > 1 ? `${soon} to-dos are due soon` : '1 to-do is due soon') : '',
    of('proposal').length ? (of('proposal').length > 1 ? `${of('proposal').length} proposals need your decision` : '1 proposal needs your decision') : '',
    of('mail').length ? (of('mail').length > 1 ? `${of('mail').length} emails have no reply` : '1 email has no reply') : '',
    of('meeting').length ? `${plural(of('meeting').length, 'meeting', 'meetings')} to get ready for` : '',
    of('mention').length ? (of('mention').length > 1 ? `${of('mention').length} people are waiting on you` : '1 person is waiting on you') : '',
  ].filter(Boolean).slice(0, 3)
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] ?? ''
  const opening = live ? 'A call is live right now.' : late ? `${late > 1 ? `${late} to-dos are` : '1 to-do is'} overdue.` : 'Nothing is overdue.'
  const next = open[0]
  const start = next.kind === 'live' ? '' : `Start with ${tx(next.project.name, lang)}.`
  return [opening, list && `${list[0].toUpperCase()}${list.slice(1)}.`, start].filter(Boolean).join(' ')
}

export function computeAgenda(projects: Project[], viewerId: string, call: CallState | null, now: number): AgendaItem[] {
  const out = new Map<string, AgendaItem>()
  const norm = (title: Txt, start: number) => `${tx(title, 'en').trim().toLowerCase()}|${Math.round(start / 60e3)}`
  for (const project of projects) {
    if (!project.memberIds.includes(viewerId)) continue
    const over = new Set<string>()
    for (const m of project.messages) {
      if (m.kind !== 'meeting' || !canSee(m.visibility, viewerId)) continue
      const key = norm(m.title, m.start)
      if (m.ended) { over.add(key); continue }
      const live = !!m.live || (call?.projectId === project.id && call.title === m.title)
      if (!live && m.start + m.durationMin * 60e3 <= now) continue
      if (!m.attendeeIds.includes(viewerId) && m.authorId !== viewerId) continue
      out.set(`${project.id}|${key}`, { key: m.id, project, title: m.title, start: m.start, durationMin: m.durationMin, attendeeIds: m.attendeeIds, guests: m.guestEmails?.length ?? 0, live, messageId: m.id })
    }
    for (const b of project.blocks) {
      if (b.type !== 'calendar') continue
      for (const e of b.events) {
        const key = norm(e.title, e.start)
        if (over.has(key) || out.has(`${project.id}|${key}`)) continue // the card in the chat already says it
        if (!e.attendeeIds.includes(viewerId) || e.start + e.durationMin * 60e3 <= now) continue
        out.set(`${project.id}|${key}`, { key: e.id, project, title: e.title, start: e.start, durationMin: e.durationMin, attendeeIds: e.attendeeIds, guests: 0, live: false, blockId: b.id })
      }
    }
  }
  return [...out.values()].sort((a, b) => Number(b.live) - Number(a.live) || a.start - b.start)
}
export const canJoin = (e: AgendaItem, now: number) => e.live || e.start - now <= JOIN_WINDOW

/** A clock good enough for "overdue" and "starting soon": one tick a minute. */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const x = setInterval(() => setNow(Date.now()), 60e3); return () => clearInterval(x) }, [])
  return now
}

export function useNeeds() {
  const projects = useStore((s) => s.projects)
  const viewerId = useStore((s) => s.viewerId)
  const done = useStore((s) => s.homeDone)
  const call = useStore((s) => s.call)
  const lang = useStore((s) => s.lang)
  const now = useNow()
  return useMemo(() => computeNeeds(projects, viewerId, done, call, now, lang), [projects, viewerId, done, call, now, lang])
}

export function useAgenda() {
  const projects = useStore((s) => s.projects)
  const viewerId = useStore((s) => s.viewerId)
  const call = useStore((s) => s.call)
  const now = useNow()
  return { now, events: useMemo(() => computeAgenda(projects, viewerId, call, now), [projects, viewerId, call, now]) }
}

/** The line on a project tile. */
export function projectStatus(p: Project, viewerId: string, lang: Lang): string {
  const talked = p.messages.some((m) => m.kind !== 'system' && canSee(m.visibility, viewerId))
  if (p.createdByUser && !talked) return tx({ fr: 'Nouveau projet', en: 'New project' }, lang)
  const sum = p.blocks.find((b) => b.type === 'summary')
  const text = sum?.type === 'summary' ? tx(sum.text, lang) : tx(p.description, lang)
  return short(text.split(/(?<=[.!?])\s/)[0] ?? text, 120)
}

export function todoProgress(p: Project) {
  const todos = p.blocks.flatMap((b) => (b.type === 'todo' ? b.todos : []))
  return { total: todos.length, done: todos.filter((x) => x.done).length }
}
