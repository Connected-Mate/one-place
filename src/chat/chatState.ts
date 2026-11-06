// What the chat does: transient UI state (never persisted) and the actions behind the composer and the cards.
import { create } from 'zustand'
import { tx } from '../i18n'
import { GEMINI_ID, uid, useStore } from '../store'
import type { Artifact, L, Message, Project, Txt, Visibility } from '../data/types'
import { askGemini } from './gemini'
import { encodeMentions, findMessage, firstName, isDraftMail, mailName, mentionIds, MENTION_RE, updateMessage } from './helpers'

export interface Typing { pid: string; personId: string; visibility: Visibility; parentId?: string }
interface ChatUI {
  drafts: Record<string, string>
  /** composer is answering this mail, by mail */
  mailReply: { pid: string; messageId: string } | null
  threadOpen: Record<string, boolean>
  threadCompose: string | null
  typing: Typing[]
  /** on touch screens, the message whose action bar is shown */
  touched: string | null
  focusNonce: number
  scrollNonce: number
  setDraft(pid: string, text: string): void
  setMailReply(v: ChatUI['mailReply']): void
  setThread(id: string, open: boolean): void
  setThreadCompose(id: string | null): void
  setTyping(fn: (t: Typing[]) => Typing[]): void
  setTouched(id: string | null): void
  focusComposer(): void
  scrollToEnd(): void
}
export const useChat = create<ChatUI>((set) => ({
  drafts: {}, mailReply: null, threadOpen: {}, threadCompose: null, typing: [], touched: null, focusNonce: 0, scrollNonce: 0,
  setDraft: (pid, text) => set((s) => ({ drafts: { ...s.drafts, [pid]: text } })),
  setMailReply: (mailReply) => set({ mailReply }),
  setThread: (id, open) => set((s) => ({ threadOpen: { ...s.threadOpen, [id]: open } })),
  setThreadCompose: (threadCompose) => set({ threadCompose }),
  setTyping: (fn) => set((s) => ({ typing: fn(s.typing) })),
  setTouched: (touched) => set({ touched }),
  focusComposer: () => set((s) => ({ focusNonce: s.focusNonce + 1 })),
  scrollToEnd: () => set((s) => ({ scrollNonce: s.scrollNonce + 1 })),
}))

const st = () => useStore.getState()
const projectOf = (pid: string) => st().projects.find((p) => p.id === pid)

/* ---------- people answering ---------- */
const GENERIC: L[] = [
  { fr: 'Bien reçu, je regarde ça ce matin.', en: 'Got it, I will look at this today.' },
  { fr: 'Ok pour moi. Je m’en occupe et je vous tiens au courant ici.', en: 'Works for me. I will take it and keep you posted here.' },
  { fr: 'Bonne idée. Je relis et je reviens vers toi avant ce soir.', en: 'Good idea. I will read it through and get back to you by tonight.' },
  { fr: 'C’est noté, merci. Je mets ça dans ma liste.', en: 'Noted, thanks. Adding it to my list.' },
]
const PRIVATE_FALLBACK: L[] = [
  { fr: 'Merci de me le dire ici plutôt que devant tout le monde. Je regarde.', en: 'Thanks for telling me here rather than in front of everyone. Looking now.' },
  { fr: 'Entre nous, je pense que c’est jouable. Je te confirme tout à l’heure.', en: 'Between us, I think it is doable. I will confirm shortly.' },
]
const cursors = new Map<string, number>()
const pending = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleReply(pid: string, personId: string, visibility: Visibility, parentId?: string) {
  const key = `${pid}:${personId}:${parentId ?? ''}`
  const previous = pending.get(key)
  if (previous) clearTimeout(previous)
  const { setTyping } = useChat.getState()
  setTyping((t) => [...t.filter((x) => !(x.pid === pid && x.personId === personId)), { pid, personId, visibility, parentId }])
  pending.set(key, setTimeout(() => {
    pending.delete(key)
    setTyping((t) => t.filter((x) => !(x.pid === pid && x.personId === personId)))
    const p = projectOf(pid)
    if (!p) return
    const isPrivate = visibility.type === 'private'
    const lines: Txt[] = isPrivate ? (p.script?.privateReplies?.[personId] ?? PRIVATE_FALLBACK) : GENERIC
    const list = lines.length ? lines : PRIVATE_FALLBACK
    const cursorKey = `${pid}:${personId}:${isPrivate}`
    const i = cursors.get(cursorKey) ?? 0
    cursors.set(cursorKey, i + 1)
    const m: Message = { id: uid('m'), kind: 'text', authorId: personId, at: Date.now(), visibility, text: list[i % list.length] }
    if (parentId && findMessage(p, parentId)) st().reply(pid, parentId, m)
    else st().push(pid, m)
  }, 1500 + Math.random() * 1500))
}

/* ---------- sending ---------- */
export interface SendOptions { privateTo?: string | null; quoteId?: string | null; parentId?: string | null }

/** Posts what the viewer typed and wakes whoever it concerns. Returns false if there was nothing to send. */
export function sendChat(pid: string, raw: string, opts: SendOptions = {}): boolean {
  const s = st()
  const p = projectOf(pid)
  if (!p) return false
  const text = encodeMentions(raw.trim(), p)
  const withoutGemini = text.replace(MENTION_RE, (all, _n: string, id: string) => (id === GEMINI_ID ? '' : all)).trim()
  if (!withoutGemini) return false
  const viewer = s.viewerId
  const mentions = mentionIds(text)
  const atGemini = mentions.includes(GEMINI_ID)
  const parent = opts.parentId ? findMessage(p, opts.parentId) : undefined
  const privateTo = parent ? null : opts.privateTo ?? null
  const visibility: Visibility = parent ? parent.visibility
    : privateTo ? { type: 'private', with: [...new Set([viewer, privateTo, ...(atGemini ? [GEMINI_ID] : [])])] }
    : { type: 'all' }
  const message: Message = { id: uid('m'), kind: 'text', authorId: viewer, at: Date.now(), visibility, text, quoteId: opts.quoteId ?? undefined }
  if (parent) { s.reply(pid, parent.id, message); useChat.getState().setThread(parent.id, true) } else s.push(pid, message)
  if (privateTo) s.markTour('private')
  useChat.getState().scrollToEnd()

  if (atGemini || privateTo === GEMINI_ID) void askGemini(pid, text, { privateTo: privateTo ?? undefined, quoteId: opts.quoteId ?? undefined, parentId: parent?.id })
  const humans = visibility.type === 'private'
    ? visibility.with
    : mentions.filter((id) => p.memberIds.includes(id))
  for (const id of new Set(humans)) if (id !== viewer && id !== GEMINI_ID) scheduleReply(pid, id, visibility, parent?.id)
  return true
}

/** Answers a mail from the chat: it leaves as a mail, the other side needs no account. */
export function sendMailReply(pid: string, messageId: string, raw: string): boolean {
  const s = st()
  const p = projectOf(pid)
  const source = p && findMessage(p, messageId)
  const body = raw.trim()
  if (!p || !source || source.kind !== 'email' || !body) return false
  const subject = (l: 'fr' | 'en') => { const v = tx(source.subject, l); return /^re\s*:/i.test(v) ? v : `Re: ${v}` }
  s.push(pid, { id: uid('m'), kind: 'email', direction: 'out', authorId: s.viewerId, at: Date.now(), visibility: { type: 'all' }, subject: { fr: subject('fr'), en: subject('en') }, body, from: p.address, to: source.direction === 'in' ? source.from : source.to, quoteId: source.id })
  useChat.getState().setMailReply(null)
  useChat.getState().scrollToEnd()
  s.toast({ icon: 'forward_to_inbox', text: { fr: `Mail envoyé à ${mailName(source.from)}`, en: `Mail sent to ${mailName(source.from)}` } })
  return true
}

/** Sends a draft prepared by Gemini. Double click safe: only a message that is still a draft can leave. */
export function sendDraft(pid: string, messageId: string) {
  const s = st()
  const p = projectOf(pid)
  const m = p && findMessage(p, messageId)
  if (!m || m.kind !== 'email' || !isDraftMail(m)) return
  updateMessage(pid, messageId, { authorId: s.viewerId, at: Date.now(), visibility: { type: 'all' } })
  s.toast({ icon: 'forward_to_inbox', text: { fr: `Mail envoyé à ${mailName(m.to)}`, en: `Mail sent to ${mailName(m.to)}` } })
}

/* ---------- files ---------- */
function currentVisibility(): Visibility {
  const s = st()
  return s.privateTo ? { type: 'private', with: [s.viewerId, s.privateTo] } : { type: 'all' }
}
function addToFilesBlock(p: Project, id: string, visibility: Visibility) {
  if (visibility.type !== 'all') return
  const files = p.blocks.find((b) => b.type === 'files')
  if (files?.type === 'files' && !files.artifactIds.includes(id)) st().patchBlock(p.id, files.id, { artifactIds: [id, ...files.artifactIds] })
}
/** Dropped file: nothing is uploaded, it becomes a PDF document inside the project. */
export function attachFake(pid: string, file: { name: string; size: number }) {
  const s = st()
  const p = projectOf(pid)
  if (!p) return
  const title = file.name.replace(/\.[^.]+$/, '') || file.name || 'Document'
  const art: Artifact = { id: uid('a'), kind: 'pdf', title, ownerId: s.viewerId, updatedAt: Date.now(), pages: Math.max(1, Math.min(48, Math.round(file.size / 90000))), excerpt: { fr: `Fichier déposé dans ${tx(p.name, 'fr')} par ${firstName(s.viewerId)}.`, en: `File dropped into ${tx(p.name, 'en')} by ${firstName(s.viewerId)}.` } }
  const visibility = currentVisibility()
  s.addArtifact(pid, art)
  addToFilesBlock(p, art.id, visibility)
  s.push(pid, { id: uid('m'), kind: 'file', authorId: s.viewerId, at: Date.now(), visibility, artifactId: art.id })
  useChat.getState().scrollToEnd()
}
export function shareArtifact(pid: string, artifactId: string) {
  const s = st()
  s.push(pid, { id: uid('m'), kind: 'file', authorId: s.viewerId, at: Date.now(), visibility: currentVisibility(), artifactId })
  useChat.getState().scrollToEnd()
}
export function newDoc(pid: string) {
  const s = st()
  const p = projectOf(pid)
  if (!p) return
  const art: Artifact = { id: uid('a'), kind: 'doc', title: { fr: 'Document sans titre', en: 'Untitled document' }, ownerId: s.viewerId, updatedAt: Date.now(), sections: [{ body: { fr: 'Commence ici, ou demande à Gemini de rédiger un premier jet.', en: 'Start here, or ask Gemini for a first draft.' } }] }
  const visibility = currentVisibility()
  s.addArtifact(pid, art)
  addToFilesBlock(p, art.id, visibility)
  s.push(pid, { id: uid('m'), kind: 'file', authorId: s.viewerId, at: Date.now(), visibility, artifactId: art.id })
  useChat.getState().scrollToEnd()
  s.setPane({ type: 'artifact', id: art.id })
}
export function scheduleMeeting(pid: string, title: string, start: number, durationMin: number) {
  const s = st()
  const p = projectOf(pid)
  if (!p) return
  const attendeeIds = p.memberIds.filter((id) => id !== GEMINI_ID)
  s.push(pid, { id: uid('m'), kind: 'meeting', authorId: s.viewerId, at: Date.now(), visibility: { type: 'all' }, title, start, durationMin, attendeeIds })
  const cal = p.blocks.find((b) => b.type === 'calendar')
  if (cal?.type === 'calendar') s.patchBlock(pid, cal.id, { events: [...cal.events, { id: uid('e'), title, start, durationMin, attendeeIds }] })
  useChat.getState().scrollToEnd()
}

/* ---------- going to the board ---------- */
export function goBoard(pid: string, blockId?: string) {
  const s = st()
  if (s.activeProjectId !== pid) s.selectProject(pid)
  st().setPane({ type: 'board' })
  if (!blockId) return
  st().patchBlock(pid, blockId, { fresh: true })
  setTimeout(() => st().patchBlock(pid, blockId, { fresh: false }), 1800)
  requestAnimationFrame(() => document.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
}
export function blockOfTodo(p: Project, todoId?: string) {
  return p.blocks.find((b) => b.type === 'todo' && (!todoId || b.todos.some((t) => t.id === todoId)))?.id
}

/* ---------- suggestions ---------- */
export function suggestionsFor(p: Project, quote?: Message): L[] {
  if (quote) {
    return [
      { fr: 'Résume ce message', en: 'Summarize this' },
      { fr: 'Fais-en une tâche', en: 'Add a to-do from this' },
      ...(quote.kind === 'email' ? [{ fr: 'Prépare une réponse', en: 'Draft a reply' }] : []),
    ]
  }
  const mail = [...p.messages].reverse().find((m) => m.kind === 'email' && m.direction === 'in')
  const first = mail?.kind === 'email' ? mailName(mail.from).split(/\s+/)[0] : null
  const hasTimeline = p.blocks.some((b) => b.type === 'timeline')
  return [
    { fr: 'Résume où on en est', en: 'Recap where things stand' },
    { fr: 'Ajoute une tâche : relire le brief', en: 'Add a to-do: review the brief' },
    hasTimeline ? { fr: 'Ajoute un sondage au board', en: 'Add a poll to the board' } : { fr: 'Ajoute une frise au board', en: 'Add a timeline to the board' },
    first ? { fr: `Prépare une réponse à ${first}`, en: `Draft a reply to ${first}` } : { fr: 'Rédige un brief du projet', en: 'Draft a project brief' },
  ]
}
