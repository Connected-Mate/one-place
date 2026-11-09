/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Gemini's advice is computed from the real state of the project, every time. Nothing is scripted.
import type { Block, Message, Project, Todo, TimelineItem, Txt } from '../data/types'
import { fmtDate, tx } from '../i18n'
import { canSee, personById, uid, type ProjectRole } from '../store'
import { DAY, startOfDay } from './shared'

export type AdviceAction =
  | { kind: 'proposal'; messageId: string }
  | { kind: 'section'; blockId: string }
  | { kind: 'compose'; text: string }
  | { kind: 'toggle'; blockId: string; todoId: string }
  | { kind: 'add-todo'; blockId: string; todo: Todo }
  | { kind: 'gallery' }

export interface Advice {
  id: string
  group: 'broken' | 'next'
  text: string
  label: string
  action: AdviceAction
  /** The action itself settles it (the person looked, the message is drafted). Otherwise only the real state does. */
  settles: boolean
}

const first = (id: string) => personById(id).name.split(' ')[0]
const quoted = (t: Txt | undefined) => `"${tx(t, 'en')}"`
const ago = (at: number, now: number) => {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY)
  return days <= 0 ? 'since this morning' : days === 1 ? 'since yesterday' : `for ${days} days`
}
const todoBlocks = (p: Project) => p.blocks.filter((b): b is Extract<Block, { type: 'todo' }> => b.type === 'todo')
const progressOf = (i: TimelineItem) => (i.progress == null ? null : i.progress <= 1 ? i.progress : i.progress / 100)

/** All text is English: the product is English only. */
export function computeAdvice(p: Project, viewerId: string, role: ProjectRole, now = Date.now()): Advice[] {
  const out: Advice[] = []
  const today = startOfDay(now)
  const seen = (m: Message) => canSee(m.visibility, viewerId)
  const ownerName = first(p.ownerId)
  const todoBlock = todoBlocks(p)[0]

  // Proposals waiting for a decision. The owner reviews them; a member can only look or nudge.
  const pending = p.messages.filter((m) => m.kind === 'proposal' && m.status === 'pending' && seen(m))
  if (pending.length && pending[0].kind === 'proposal') {
    const m = pending[0]
    if (role === 'owner') {
      out.push({
        id: `proposal:${m.id}`, group: 'broken', settles: false, label: 'Review it', action: { kind: 'proposal', messageId: m.id },
        text: pending.length > 1 ? `${pending.length} proposals wait for your decision, starting with ${quoted(m.title)}.` : `${quoted(m.title)} waits for your decision.`,
      })
    } else if (m.authorId === viewerId) {
      out.push({
        id: `proposal:${m.id}`, group: 'broken', settles: true, label: `Nudge ${ownerName}`,
        action: { kind: 'compose', text: `@${personById(p.ownerId).name} could you decide on ${quoted(m.title)}?` },
        text: `Your proposal ${quoted(m.title)} is still waiting on ${ownerName}.`,
      })
    } else {
      out.push({
        id: `proposal:${m.id}`, group: 'broken', settles: true, label: 'See it', action: { kind: 'proposal', messageId: m.id },
        text: `${quoted(m.title)} is still waiting on ${ownerName}.`,
      })
    }
  }

  // Email that came in with nothing sent back since.
  const mails = p.messages.filter((m) => m.kind === 'email' && seen(m))
  const lastMail = mails[mails.length - 1]
  if (lastMail && lastMail.kind === 'email' && lastMail.direction === 'in') {
    const who = first(lastMail.authorId)
    out.push({
      id: `mail:${lastMail.id}`, group: 'broken', settles: true, label: 'Draft a reply',
      action: { kind: 'compose', text: `@Gemini draft a reply to ${who}'s email` },
      text: `${who}'s email ${quoted(lastMail.subject)} has had no reply ${ago(lastMail.at, now)}.`,
    })
  }

  // Overdue to-dos: the oldest one is the one to chase.
  const overdue = todoBlocks(p).flatMap((b) => b.todos.filter((x) => !x.done && x.due != null && x.due < today).map((x) => ({ b, x })))
    .sort((a, b) => a.x.due! - b.x.due!)
  if (overdue.length) {
    const { b, x } = overdue[0]
    const days = Math.round((today - startOfDay(x.due!)) / DAY)
    const late = `${days} day${days > 1 ? 's' : ''} overdue`
    const more = overdue.length > 1 ? ` (${overdue.length} overdue in all)` : ''
    if (x.assigneeId === viewerId || !x.assigneeId) {
      out.push({ id: `overdue:${x.id}`, group: 'broken', settles: false, label: 'Mark done', action: { kind: 'toggle', blockId: b.id, todoId: x.id }, text: `${quoted(x.text)} is ${late}${more}.` })
    } else {
      const who = first(x.assigneeId)
      out.push({
        id: `overdue:${x.id}`, group: 'broken', settles: true, label: `Ask ${who}`,
        action: { kind: 'compose', text: `@${personById(x.assigneeId).name} where are we on ${quoted(x.text)}?` },
        text: `${who}'s ${quoted(x.text)} is ${late}${more}.`,
      })
    }
  }

  // Budget over target, naming the line that weighs most.
  for (const b of p.blocks) {
    if (b.type !== 'chart') continue
    const lines = b.series.filter((s) => s.target != null)
    const actual = lines.reduce((n, s) => n + s.value, 0), target = lines.reduce((n, s) => n + s.target!, 0)
    if (!target || actual <= target * 1.005) continue
    const worst = [...lines].sort((x, y) => (y.value - y.target!) - (x.value - x.target!))[0]
    out.push({
      id: `budget:${b.id}:${Math.round(actual)}`, group: 'broken', settles: true, label: 'See the numbers', action: { kind: 'section', blockId: b.id },
      text: `${tx(b.title, 'en')} is ${Math.round(((actual - target) / target) * 100)}% over target, mostly ${tx(worst.label, 'en')}.`,
    })
    break
  }

  // A bar crossing today behind where it should be.
  for (const b of p.blocks) {
    if (b.type !== 'timeline') continue
    const behind = b.items.filter((i) => !i.milestone && progressOf(i) != null && i.start < now && i.end > i.start)
      .map((i) => ({ i, expected: Math.min(1, (now - i.start) / (i.end - i.start)), real: progressOf(i)! }))
      .filter((x) => x.expected - x.real >= 0.15)
      .sort((x, y) => (y.expected - y.real) - (x.expected - x.real))[0]
    if (!behind) continue
    out.push({
      id: `behind:${behind.i.id}:${behind.i.end}:${behind.real}`, group: 'broken', settles: true, label: 'Open the timeline', action: { kind: 'section', blockId: b.id },
      text: `${tx(behind.i.label, 'en')} is at ${Math.round(behind.real * 100)}% and should be near ${Math.round(behind.expected * 100)}% by today.`,
    })
    break
  }

  // A meeting tomorrow with nothing prepared: no to-do and no document names it.
  const events = p.blocks.flatMap((b) => (b.type === 'calendar' ? b.events : []))
  const tomorrow = events.find((e) => startOfDay(e.start) === today + DAY) ?? events.find((e) => startOfDay(e.start) === startOfDay(today + 1.5 * DAY))
  if (tomorrow) {
    const title = tx(tomorrow.title, 'en')
    const needle = title.toLowerCase()
    const prepared = todoBlocks(p).some((b) => b.todos.some((x) => tx(x.text, 'en').toLowerCase().includes(needle)))
      || p.artifacts.some((a) => tx(a.title, 'en').toLowerCase().includes(needle))
    if (!prepared) {
      out.push(todoBlock ? {
        id: `meeting:${tomorrow.id}`, group: 'broken', settles: false, label: 'Add a to-do',
        action: { kind: 'add-todo', blockId: todoBlock.id, todo: { id: uid('todo'), text: `Prepare ${title}`, assigneeId: viewerId, due: tomorrow.start, done: false, source: 'Gemini advice' } },
        text: `${title} is tomorrow and nothing is prepared for it.`,
      } : {
        id: `meeting:${tomorrow.id}`, group: 'broken', settles: true, label: 'Draft a brief',
        action: { kind: 'compose', text: `@Gemini draft a brief for ${quoted(title)}` },
        text: `${title} is tomorrow and nothing is prepared for it.`,
      })
    }
  }

  // What could come next.
  const mine = todoBlocks(p).flatMap((b) => b.todos.filter((x) => !x.done && x.assigneeId === viewerId && x.due != null && x.due >= today).map((x) => ({ b, x })))
    .sort((a, b) => a.x.due! - b.x.due!)[0]
  if (mine) {
    out.push({ id: `mine:${mine.x.id}`, group: 'next', settles: false, label: 'Mark done', action: { kind: 'toggle', blockId: mine.b.id, todoId: mine.x.id }, text: `Your next to-do is ${quoted(mine.x.text)}, due ${fmtDate(mine.x.due!, 'en')}.` })
  }
  const poll = p.blocks.find((b): b is Extract<Block, { type: 'poll' }> => b.type === 'poll' && !b.options.some((o) => o.votes.includes(viewerId)))
  if (poll && poll.options.length) {
    out.push({ id: `poll:${poll.id}`, group: 'next', settles: false, label: 'Vote', action: { kind: 'section', blockId: poll.id }, text: `You have not voted on ${quoted(poll.question)} yet.` })
  }

  // A project that has just been created: help it take shape.
  if (todoBlock && todoBlocks(p).every((b) => b.todos.length === 0)) {
    out.push({
      id: `first-todo:${p.id}`, group: 'next', settles: false, label: 'Add it',
      action: { kind: 'add-todo', blockId: todoBlock.id, todo: { id: uid('todo'), text: 'Write down the goal of this project', assigneeId: viewerId, done: false, source: 'Gemini advice' } },
      text: 'No to-dos yet. The first one could be to write down the goal of this project.',
    })
  }
  if (!p.blocks.some((b) => b.type === 'timeline')) {
    out.push({
      id: `no-timeline:${p.id}`, group: 'next', settles: false, label: role === 'owner' ? 'Add one' : 'Propose one', action: { kind: 'gallery' },
      text: role === 'owner' ? 'This project has no timeline yet, so nobody can see the dates.' : `This project has no timeline yet. You could propose one to ${ownerName}.`,
    })
  }
  if (p.memberIds.filter((id) => personById(id).role !== 'ai').length <= 1) {
    out.push({
      id: `alone:${p.id}`, group: 'next', settles: true, label: 'Ask Gemini', action: { kind: 'compose', text: '@Gemini who should join this project?' },
      text: 'You are alone on this project for now. Email sent to its address shows up here too.',
    })
  }
  return out
}
