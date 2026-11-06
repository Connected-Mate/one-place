/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Small pure helpers shared by the chat UI and the Gemini engine.
import { tx } from '../i18n'
import { personById, useStore } from '../store'
import type { Lang, Message, Project } from '../data/types'
import { people } from '../data/seed'

export const MENTION_RE = /@\[([^\]]+)\]\(([^)]+)\)/g
export const firstName = (id: string) => personById(id).name.split(/\s+/)[0]

/** Finds a message anywhere in the project, thread replies included. */
export function findMessage(p: Project, id: string): Message | undefined {
  for (const m of p.messages) {
    if (m.id === id) return m
    const r = m.replies?.find((x) => x.id === id)
    if (r) return r
  }
  return undefined
}
export function parentOf(p: Project, id: string): Message | undefined {
  return p.messages.find((m) => m.replies?.some((r) => r.id === id))
}

/** The store's `patch` only reaches top-level messages; this also reaches thread replies. */
export function updateMessage(pid: string, id: string, patch: Partial<Message>) {
  const s = useStore.getState()
  const p = s.projects.find((x) => x.id === pid)
  if (!p) return
  if (p.messages.some((m) => m.id === id)) { s.patch(pid, id, patch); return }
  const parent = parentOf(p, id)
  if (parent) s.patch(pid, parent.id, { replies: parent.replies!.map((r) => (r.id === id ? ({ ...r, ...patch } as Message) : r)) })
}

/** Same as the store's `react`, thread replies included. */
export function reactTo(pid: string, id: string, emoji: string) {
  const s = useStore.getState()
  const p = s.projects.find((x) => x.id === pid)
  if (!p) return
  if (p.messages.some((m) => m.id === id)) { s.react(pid, id, emoji); return }
  const m = findMessage(p, id)
  if (!m) return
  const me = s.viewerId
  const rs = m.reactions ?? []
  const has = rs.find((x) => x.emoji === emoji)
  const reactions = !has ? [...rs, { emoji, by: [me] }]
    : rs.map((x) => (x.emoji === emoji ? { ...x, by: x.by.includes(me) ? x.by.filter((b) => b !== me) : [...x.by, me] } : x)).filter((x) => x.by.length)
  updateMessage(pid, id, { reactions })
}

export const stripMarkup = (s: string) => s.replace(MENTION_RE, '@$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\(op:[^)]*\)/g, '$1')

/** One readable line about any message: used for quotes and when Gemini talks about a message. */
export function snippet(m: Message, l: Lang): string {
  switch (m.kind) {
    case 'text': case 'system': return stripMarkup(tx(m.text, l))
    case 'email': return `${tx(m.subject, l)}: ${tx(m.body, l)}`
    case 'meeting': case 'proposal': case 'call-summary': return tx(m.title, l)
    case 'file': {
      const p = useStore.getState().projects.flatMap((x) => x.artifacts).find((a) => a.id === m.artifactId)
      return tx(m.text, l) || tx(p?.title, l)
    }
  }
}

/** "Jun Park <jun@x.example>" gives "Jun Park"; "jun@x.example" gives a known person's name, or the mailbox name. */
export function mailName(from: string): string {
  const named = from.match(/^\s*"?([^"<]+?)"?\s*</)
  if (named) return named[1]
  const addr = mailAddress(from)
  const known = people.find((p) => p.email && p.email.toLowerCase() === addr.toLowerCase())
  if (known) return known.name
  const local = addr.split('@')[0] ?? addr
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : from
}
export const mailAddress = (from: string) => from.match(/<([^>]+)>/)?.[1] ?? from.trim()

/** A draft prepared by Gemini: outgoing, still private, still authored by Gemini. Sending changes all three. */
export const isDraftMail = (m: Message): boolean => m.kind === 'email' && m.direction === 'out' && m.authorId === 'gemini' && m.visibility.type === 'private'

/** Turns the readable "@Maya Chen" of the composer into the stored @[Maya Chen](maya). */
export function encodeMentions(text: string, p: Project): string {
  const candidates = [{ id: 'gemini', name: 'Gemini' }, ...p.memberIds.filter((id) => id !== 'gemini').map((id) => ({ id, name: personById(id).name }))]
  const keys = candidates.flatMap((c) => [{ key: c.name, ...c }, { key: c.name.split(/\s+/)[0], ...c }]).sort((a, b) => b.key.length - a.key.length)
  const seen = new Set<string>(); const unique = keys.filter((k) => { const n = k.key.toLowerCase(); if (seen.has(n)) return false; seen.add(n); return true })
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(^|[\\s(])@(${unique.map((k) => esc(k.key)).join('|')})(?![\\p{L}\\p{N}_])`, 'giu')
  return text.replace(re, (_, pre: string, key: string) => {
    const k = unique.find((u) => u.key.toLowerCase() === key.toLowerCase())!
    return `${pre}@[${k.name}](${k.id})`
  })
}
export const mentionIds = (text: string) => [...text.matchAll(MENTION_RE)].map((m) => m[2])
