/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The scripted Gemini engine: no network, one AI. It reads the live project, decides what was asked,
// acts on the project for real and streams a short answer word by word.
//
// The one rule of decide(): a question never acts. Questions are answered from project data;
// only imperative phrasing changes anything. Keywords are understood in French and English,
// answers are in English (the product is English only).
//
// Callers post the user's own message themselves; askGemini only posts the answer.
import { tx } from '../i18n'
import { appUpdate, hasApp, makeApp, TOOLS, wantedApp } from '../artifact/apps/catalog'
import { people } from '../data/seed'
import { canSee, GEMINI_ID, personById, roleIn, uid, useStore } from '../store'
import type { AppId, Artifact, Block, EmailMessage, Message, Project, ProposalAction, ProposalMessage, TimelineItem, Todo, Txt, Visibility } from '../data/types'
import { triageEmail } from './emailTriage'
import { findMessage, firstName, mailAddress, mailName, MENTION_RE, snippet, stripMarkup, updateMessage } from './helpers'

export interface AskOptions {
  /** private ask: the answer is visible only to the viewer, this person and Gemini */
  privateTo?: string
  /** message the question is about */
  quoteId?: string
  /** answer inside this message's thread */
  parentId?: string
}

interface Ctx {
  pid: string
  viewer: string
  owner: boolean
  visibility: Visibility
  parentId?: string
  quote?: Message
  /** question without the Gemini mention, other mentions turned to names */
  plain: string
  /** lower case, no accents: what intents are detected on */
  norm: string
  /** people mentioned, Gemini excluded */
  mentioned: string[]
}
interface Plan {
  say: Txt
  /** runs before the text arrives: the answer then confirms something already true */
  before?: () => void
  /** runs when the text has finished: cards follow the sentence that announces them */
  after?: () => void
}

const DAY = 864e5
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const get = () => useStore.getState()
const projectOf = (pid: string) => get().projects.find((p) => p.id === pid)
const uniq = <T,>(a: T[]) => [...new Set(a)]
const en = (v: Txt | undefined) => tx(v, 'en')
export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’]/g, "'").toLowerCase()
const oneLine = (s: string, n = 70) => { const c = s.replace(/\s+/g, ' ').trim(); return c.length > n ? `${c.slice(0, n - 1).trimEnd()}…` : c }
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s)
const list = (a: string[]) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0] ?? '')
const count = (n: number, word: string, plural = `${word}s`) => `${n} ${n === 1 ? word : plural}`
const firstSentence = (s: string) => (s.replace(/\s+/g, ' ').trim().match(/^.*?[.!?](?=\s|$)/)?.[0] ?? s.trim())
const emailWord = (s: string) => s.replace(/\bmail\b/g, 'email').replace(/\bMail\b/g, 'Email')
const stripRe = (s: string) => s.replace(/^(\s*(re|fw|fwd)\s*:\s*)+/i, '').trim()
/** "Re: Diffuser batch 2: revised delivery date" becomes "diffuser batch 2": how a person would say it. */
const shortTopic = (s: string) => lowerFirst(stripRe(s).split(/:\s/)[0])
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
let turn = 0
const pick = <T,>(a: T[]) => a[turn++ % a.length]

/* ---------------- dates, US format ---------------- */
const dateOnly = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const timeOnly = (t: number) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
function dayWord(t: number) {
  const d = new Date(t); const now = new Date()
  if (sameDay(d, now)) return 'today'
  if (sameDay(d, new Date(now.getTime() + DAY))) return 'tomorrow'
  if (sameDay(d, new Date(now.getTime() - DAY))) return 'yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}
const when = (t: number) => `${dayWord(t)} at ${timeOnly(t)}`

/* ---------------- project facts ---------------- */
/** A public answer must only draw on public messages: nothing private leaks through Gemini. */
const readable = (ctx: Ctx, p: Project) => p.messages.filter((m) => (ctx.visibility.type === 'all' ? m.visibility.type === 'all' : canSee(m.visibility, ctx.viewer)))
const todosOf = (p: Project) => p.blocks.flatMap((b) => (b.type === 'todo' ? b.todos : []))
const openTodos = (p: Project) => todosOf(p).filter((t) => !t.done)
const overdueTodos = (p: Project) => openTodos(p).filter((t) => t.due && t.due < Date.now())
const itemsOf = (p: Project) => p.blocks.flatMap((b) => (b.type === 'timeline' ? b.items : []))
const timelineOf = (p: Project) => p.blocks.find((b): b is Extract<Block, { type: 'timeline' }> => b.type === 'timeline' && b.items.length > 0)
const upcoming = (p: Project) => itemsOf(p).filter((i) => i.end >= Date.now()).sort((a, b) => a.end - b.end)
const nextMilestone = (p: Project) => upcoming(p).find((i) => i.milestone) ?? upcoming(p)[0]
/** Past its end date and not finished. */
const lateItems = (p: Project) => itemsOf(p).filter((i) => !i.milestone && i.end < Date.now() && (i.progress ?? 100) < 100)
/** Running, and clearly behind where the calendar says it should be. */
const behindItems = (p: Project) => itemsOf(p).filter((i) => {
  if (i.milestone || i.progress == null || i.start > Date.now() || i.end < Date.now() || i.end === i.start) return false
  return i.progress + 25 < ((Date.now() - i.start) / (i.end - i.start)) * 100
})
const pendingProposals = (ctx: Ctx, p: Project) => readable(ctx, p).filter((m): m is ProposalMessage => m.kind === 'proposal' && m.status === 'pending')
const inboundEmails = (ctx: Ctx, p: Project) => readable(ctx, p).filter((m): m is EmailMessage => m.kind === 'email' && m.direction === 'in')
const productName = (p: Project) => en(p.name).replace(/\s+(launch|project|account|campaign)$/i, '').trim() || en(p.name)
const msgLink = (id: string, label: string) => `[${label.replace(/[[\]]/g, '')}](op:msg/${id})`
const boardLink = (blockId?: string, label = 'View on board') => `[${label}](op:board${blockId ? `/${blockId}` : ''})`
const docLink = (a: Artifact) => `[${en(a.title).replace(/[[\]]/g, '')}](op:artifact/${a.id})`
const ownerWord = (ctx: Ctx, p: Project) => (ctx.owner ? 'you' : firstName(p.ownerId))

interface NextUp { title: string; start: number; attendees: string[]; guests: string[]; live: boolean; messageId?: string }
function meetingsAhead(ctx: Ctx, p: Project): NextUp[] {
  const fromChat: NextUp[] = readable(ctx, p).flatMap((m) => (m.kind === 'meeting' && !m.ended && (m.live || m.start >= Date.now())
    ? [{ title: en(m.title), start: m.start, attendees: m.attendeeIds, guests: m.guestEmails ?? [], live: !!m.live, messageId: m.id }] : []))
  const fromBoard: NextUp[] = p.blocks.flatMap((b) => (b.type === 'calendar' ? b.events.filter((e) => e.start >= Date.now()).map((e) => ({ title: en(e.title), start: e.start, attendees: e.attendeeIds, guests: [], live: false })) : []))
  const seen = new Set(fromChat.map((m) => m.title))
  return [...fromChat, ...fromBoard.filter((e) => !seen.has(e.title))].sort((a, b) => Number(b.live) - Number(a.live) || a.start - b.start)
}
function meetingLine(m: NextUp) {
  const who = list(m.attendees.filter((id) => id !== GEMINI_ID).map(firstName))
  const guests = m.guests.map((g) => mailName(g).split(/[\s.]+/)[0]).map(capitalize)
  const guestLine = guests.length ? ` ${list(guests)} ${guests.length > 1 ? 'join' : 'joins'} as a guest for that call only.` : ''
  const whenLine = m.live ? 'live right now' : when(m.start)
  return `**${m.title}**, ${whenLine}${who ? `, with ${who}` : ''}.${guestLine}`
}
const lastCallSummary = (ctx: Ctx, p: Project) => [...readable(ctx, p)].reverse().find((m): m is Extract<Message, { kind: 'call-summary' }> => m.kind === 'call-summary')

/* ---------------- people named in the text ---------------- */
function peopleNamed(ctx: Ctx) {
  const found = people.filter((x) => x.id !== GEMINI_ID && new RegExp(`\\b(${esc(normalize(x.name))}|${esc(normalize(x.name.split(/\s+/)[0]))})\\b`).test(ctx.norm)).map((x) => x.id)
  return uniq([...ctx.mentioned, ...found])
}
const onProject = (p: Project, id: string) => p.memberIds.includes(id) || p.externalIds.includes(id)

/* ---------------- what kind of sentence is this ---------------- */
const POLITE = /^(?:(?:please|s'il te plait|stp|can you|could you|would you|will you|peux-tu|peux tu|pourrais-tu|tu peux|merci de)[\s,]+)+/
const READ_VERB = /^(show|tell|explain|give me|list|remind me (what|who|when)|montre\w*|dis-moi|explique\w*|liste\w*)\b/
const ASKS_TO_MAKE = /\b(a|an|un|une|new|nouveau|nouvelle)\s+(\w+\s+)?(chart|graph|graphique|timeline|frise|kanban|poll|sondage|tracker)\b/
function isQuestion(n: string) {
  const rest = n.replace(POLITE, '')
  if (READ_VERB.test(rest)) return !ASKS_TO_MAKE.test(rest)
  if (rest !== n) return false // "can you add a poll?" is a request, however it ends
  if (/^(let'?s|shall i)\b/.test(n)) return false
  if (n.trimEnd().endsWith('?')) return true
  return /^(what|what's|whats|who|who's|whos|whose|which|when|where|why|how|should|shall we|are|is|isn't|do|does|did|will|would|could|can we|am|has|have|any|quel\w*|qui|quand|ou|pourquoi|comment|combien|est-ce|faut-il|doit-on|on devrait)\b/.test(n)
}

const VERB_MAKE = /\b(add|create|build|make|show|put|new|generate|want|need|draw|start|set up|ajoute\w*|cree\w*|creer|construi\w*|fai[st]\w*|mets?|montre\w*|genere\w*|nouveau|nouvelle|veux|voudrais|lance\w*|dessine\w*|propose\w*|insere\w*)\b/
type BlockKind = 'timeline' | 'poll' | 'chart' | 'model3d' | 'kanban' | 'todo' | 'calendar' | 'notes' | 'tracker'
const BLOCK_WORDS: [BlockKind, RegExp][] = [
  ['timeline', /\b(timeline|frise|calendrier du projet|planning|roadmap|retroplanning|gantt)\b/],
  ['poll', /\b(poll|sondage|vote)\b/],
  ['chart', /\b(charts?|graphs?|graphique|courbe|diagramme)\b/],
  ['model3d', /(\b3d\b|\bmaquette\b|\bmodele\b)/],
  ['kanban', /\bkanban\b/],
  ['todo', /\b(to-?do list|liste de taches|liste de to-?dos?)\b/],
  ['calendar', /\b(agenda|calendar|calendrier)\b/],
  ['notes', /\b(notes?|bloc-?notes)\b/],
]
const DIMENSION = /\b(?:by|per|par)\s+(phase|stage|month|mois|quarter|trimestre|week|semaine|team|equipe|person|personne|owner|region|status|statut|category|categorie|workstream|channel|canal|vendor|supplier|fournisseur|hotel|product)s?\b/
const isTodoAsk = (n: string) => /^\s*(to-?do|tache|task)\s*:/.test(n)
  || (/\b(to-?dos?|taches?|tasks?|a faire)\b/.test(n) && /\b(add|create|new|note|remember|put|make|turn|ajoute\w*|cree\w*|nouvelle|mets?|fais\w*|rappelle\w*)\b/.test(n) && !/\b(to-?do list|liste)\b/.test(n))
  || /\b(rappelle-moi|remind me)\b/.test(n)
  || /^(remind|ask|tell)\s+\S+(\s+\S+)?\s+to\b/.test(n)
const isReplyAsk = (n: string) => /\b(reponds?|repondre|reponse|reply|respond)\b/.test(n)
  || /\b(draft|redige\w*|ecris|write|prepare\w*|envoie|send)\b.*\b(mail|email|e-mail)\b/.test(n)
  || /^(mail|email|e-mail)\s+\S/.test(n)
  || /\b(mail|email|e-mail)\s+(a|to|pour|for)\b/.test(n)
const DOC_WORDS = /\b(doc|document|brief|memo|press release|communique( de presse)?|blog( post)?|article|post|faq|one-?pager|newsletter|agenda|report|rapport|compte[- ]rendu|summary|synthese|speech|discours|script|announcement|annonce|checklist|note de cadrage|proposal doc)\b/
const isDocAsk = (n: string) => (/\b(draft|redige\w*|write|ecris|prepare\w*|create|cree\w*|make|fais)\b/.test(n) && DOC_WORDS.test(n))
  || /^(draft|redige\w*)\b/.test(n)
  || /^brief\b(?! (me|us|moi))/.test(n)
const isMoveAsk = (n: string) => /\b(decal\w*|delay\w*|postpone\w*|repouss\w*|reporte[rz]?|push back|move\w*|retard\w*|avance[rz]?|bring forward|reschedule\w*)\b/.test(n)
const isCallTalk = (n: string) => /\b(meeting|reunion|call|appel|sync|rdv|rendez-?vous)\b/.test(n)
const isLastCallAsk = (n: string) => /\b(last|latest|previous|dernier\w*)\s+(\w+\s+)?(call|meeting|appel|reunion|sync)\b/.test(n)
  || /\b(summar\w*|recap\w*|resume\w*)\b.*\b(call|meeting|appel|reunion)\b/.test(n)
const isRecapAsk = (n: string) => /\b(recap\w*|resume\w*|catch( \w+)? up|catch ?up|fill me in|brief (me|us|moi)|summar\w*|synthese|le point|ou on en est|ou en est|where (are|do) we|where things stand|what.*missed?|quoi de neuf)\b/.test(n)

function wantedBlock(n: string): BlockKind | null {
  const hit = BLOCK_WORDS.find(([, re]) => re.test(n))
  const short = n.trim().split(/\s+/).length <= 3
  if (hit && (VERB_MAKE.test(n) || short)) return hit[0]
  if (/\b(tracker|suivi|table|breakdown|dashboard|tableau de bord)\b/.test(n) || DIMENSION.test(n)) return 'tracker'
  if (/\b(budget|plan)\b/.test(n) && (VERB_MAKE.test(n) || /^(a|an|un|une)\b/.test(n))) return 'tracker'
  if (/\b(block|widget|section|panel|bloc)\b/.test(n) && VERB_MAKE.test(n)) return 'notes'
  return null
}

/* ---------------- reading dates in the text ---------------- */
const WEEKDAYS: [RegExp, number][] = [[/\b(dimanche|sunday)\b/, 0], [/\b(lundi|monday)\b/, 1], [/\b(mardi|tuesday)\b/, 2], [/\b(mercredi|wednesday)\b/, 3], [/\b(jeudi|thursday)\b/, 4], [/\b(vendredi|friday)\b/, 5], [/\b(samedi|saturday)\b/, 6]]
const WHEN_PHRASE = /\b(?:(?:on|next|this|ce|le|prochain)\s+)*(?:day after tomorrow|apres-demain|demain|tomorrow|aujourd'hui|today|tonight|ce soir|next week|la semaine prochaine|monday|tuesday|wednesday|thursday|friday|saturday|sunday|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b|\b(?:at|a|à|by|before)?\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b(?:at|a|à)?\s*\d{1,2}\s*h(?:\s*\d{2})?\b|\b(?:at|à)\s+\d{1,2}(?::\d{2})?\b|\bfor\s+\d+\s*(?:min|mins|minutes|h|hours?)\b/gi
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6
function nextWeekday(from: Date) { const d = new Date(from); while (isWeekend(d)) d.setDate(d.getDate() + 1); return d }
/** Reads "tomorrow at 3pm", "friday at 2pm", "mardi 14h". Weekends only when the words say so. */
function parseWhen(n: string): { at?: number; hasTime: boolean; rolled: boolean } {
  const now = new Date()
  let day: Date | null = null
  if (/\b(apres-demain|day after tomorrow)\b/.test(n)) day = new Date(now.getTime() + 2 * DAY)
  else if (/\b(demain|tomorrow)\b/.test(n)) day = new Date(now.getTime() + DAY)
  else if (/\b(aujourd'hui|today|ce soir|tonight)\b/.test(n)) day = new Date(now)
  else if (/\b(next week|la semaine prochaine)\b/.test(n)) { day = new Date(now); day.setDate(day.getDate() + (((8 - day.getDay()) % 7) || 7)) }
  else for (const [re, wd] of WEEKDAYS) if (re.test(n)) { day = new Date(now.getTime() + (((wd - now.getDay() + 7) % 7) || 7) * DAY); break }
  const h12 = n.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/)
  const h24 = n.match(/\b(\d{1,2})\s*h\s*(\d{2})?\b/) ?? n.match(/\b(\d{1,2}):(\d{2})\b/)
  let hour: number | null = null; let min = 0
  if (h12) { hour = (Number(h12[1]) % 12) + (h12[3] === 'pm' ? 12 : 0); min = Number(h12[2] ?? 0) }
  else if (h24 && Number(h24[1]) < 24) { hour = Number(h24[1]); min = Number(h24[2] ?? 0) }
  else { const bare = n.match(/\b(?:at|a)\s+(\d{1,2})\b/); if (bare && Number(bare[1]) < 24) hour = Number(bare[1]) }
  if (!day && hour === null) return { hasTime: false, rolled: false }
  let d = day ?? new Date(now)
  d.setHours(hour ?? 10, min, 0, 0)
  if (d.getTime() < now.getTime()) d.setDate(d.getDate() + 1)
  const askedWeekend = /\b(saturday|sunday|samedi|dimanche|weekend|week-end)\b/.test(n)
  let rolled = false
  if (isWeekend(d) && !askedWeekend) { d = nextWeekday(d); rolled = true }
  return { at: d.getTime(), hasTime: hour !== null, rolled }
}
function nextBusinessMorning() {
  const d = nextWeekday(new Date(Date.now() + DAY))
  d.setHours(10, 0, 0, 0)
  return d.getTime()
}

/* ---------------- to-dos ---------------- */
const STRIP_POLITE = /^(?:(?:s'il te pla[iî]t|stp|please|peux-tu|peux tu|tu peux|can you|could you|would you|merci de|pourrais-tu|gemini)[\s,:]+)+/i
const STRIP_TODO = /^(?:ajoute[rz]?|add|cr[ée]+[rz]?|create|mets?|put|note|remember|rappelle(?:-moi)?(?:\s+de)?|remind me(?:\s+to)?|remind|ask|tell)?\s*(?:(?:une?|an?|the|la|le|ma|ce|cette)\s+)?(?:(?:nouvelle|new)\s+)?(?:to-?dos?|t[âa]ches?|tasks?|[àa] faire)?\s*(?:[:,.\-]\s*)?(?:(?:pour|for|de|to|que)\s+)?/i
const TRAILING_BOARD = /\s*(?:(?:sur|au|dans|on|to|in)\s+(?:le|les|la|the)?\s*(?:board|tableau|to-?dos?|liste|list))\s*\.?$/i
const FROM_QUOTE = /\b(from this|from that|de ce message|en une tache)\b|\b(this|that|it|ca)\b.*\b(to-?do|task|tache)\b/

function assigneeFrom(ctx: Ctx, p: Project): string | undefined {
  const m = ctx.mentioned.find((id) => p.memberIds.includes(id))
  if (m) return m
  return p.memberIds.find((id) => id !== GEMINI_ID && new RegExp(`\\b(pour|for|a|to|remind|ask|tell)\\s+${esc(normalize(firstName(id)))}\\b`).test(ctx.norm))
}
function todoTextFrom(ctx: Ctx, assigneeId?: string) {
  let t = ctx.plain.replace(STRIP_POLITE, '').trim().replace(STRIP_TODO, '').trim()
  if (assigneeId) {
    for (const name of [personById(assigneeId).name, firstName(assigneeId)]) {
      t = t.replace(new RegExp(`^${esc(name)}\\b\\s*[:,]?\\s*`, 'i'), '')
        .replace(new RegExp(`(?:^|\\s)(?:assign[ée]+\\s+)?(?:pour|for|à|a|to)\\s+${esc(name)}\\b`, 'i'), '')
    }
  }
  t = t.replace(/^(?:to|de|d'|that|qu')\s+/i, '')
    .replace(/\s*\b(?:by|due|before|avant|d'ici)?\s*(?:(?:on|next|this)\s+)?(?:tomorrow|demain|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s*\.?$/i, '')
    .replace(TRAILING_BOARD, '').replace(/^[\s:,.-]+/, '').replace(/[\s:,]+$/, '').trim()
  return t ? capitalize(t) : ''
}
/** A to-do a person would actually write about this message. */
function todoFromMessage(q: Message): string {
  switch (q.kind) {
    case 'email': return `Reply to ${mailName(q.from).split(/\s+/)[0]} about ${shortTopic(en(q.subject))}`
    case 'proposal': return `Decide: ${lowerFirst(en(q.title))}`
    case 'meeting': return `Prepare ${en(q.title)}`
    case 'call-summary': return `Follow up on ${en(q.title)}`
    case 'file': return `Review ${snippet(q, 'en')}`
    default: {
      const text = stripMarkup(en(q.text)).replace(/^@\S+\s*/, '')
      return oneLine(`Follow up with ${firstName(q.authorId)}: ${lowerFirst(firstSentence(text))}`.replace(/[.!]$/, ''), 90)
    }
  }
}

function planTodo(ctx: Ctx, p: Project): Plan {
  let assigneeId = assigneeFrom(ctx, p)
  const fromQuote = !!ctx.quote && (FROM_QUOTE.test(ctx.norm) || !todoTextFrom(ctx, assigneeId))
  const text = fromQuote ? todoFromMessage(ctx.quote!) : todoTextFrom(ctx, assigneeId)
  if (fromQuote && !assigneeId) assigneeId = ctx.viewer
  if (!text || (!ctx.quote && FROM_QUOTE.test(ctx.norm))) return { say: 'Happy to. What should the to-do say? For example: **add a to-do: review the brief for Maya**.' }
  const parsed = parseWhen(ctx.norm)
  const todo: Todo = { id: uid('t'), text, assigneeId, due: parsed.at, done: false, source: 'Asked Gemini' }
  const who = assigneeId ? `, assigned to ${assigneeId === ctx.viewer ? 'you' : firstName(assigneeId)}` : ''
  const due = parsed.at ? `, due ${dayWord(parsed.at)}` : ''
  const block = p.blocks.find((b) => b.type === 'todo')
  if (block) return { before: () => get().addTodo(ctx.pid, block.id, todo), say: `Added **${text}**${who}${due}. ${boardLink(block.id)}` }
  const fresh: Block = { id: uid('b'), type: 'todo', title: 'To do', span: 1, todos: [todo] }
  if (ctx.owner) return { before: () => get().addBlock(ctx.pid, fresh), say: `This project had no to-do list, so I started one with **${text}**${who}. ${boardLink(fresh.id)}` }
  return {
    say: `This project has no to-do list yet. I sent ${firstName(p.ownerId)} a proposal to add one, with **${text}** in it.`,
    after: () => postProposal(ctx, p, 'Add a to-do list', `With a first to-do: ${text}.`, { type: 'add-block', block: fresh }),
  }
}

/* ---------------- proposals ---------------- */
function proposalVisibility(ctx: Ctx, p: Project): Visibility {
  return ctx.visibility.type === 'all' ? ctx.visibility : { type: 'private', with: uniq([...ctx.visibility.with, p.ownerId]) }
}
function postProposal(ctx: Ctx, p: Project, title: Txt, description: Txt, action: ProposalAction) {
  get().push(ctx.pid, { id: uid('m'), kind: 'proposal', authorId: ctx.viewer, at: Date.now(), visibility: proposalVisibility(ctx, p), title, description, action, status: 'pending' })
}

/* ---------------- blocks ---------------- */
function dimensionValues(n: string, p: Project): string[] {
  const dim = n.match(DIMENSION)?.[1] ?? ''
  const team = p.memberIds.filter((m) => m !== GEMINI_ID).map(firstName)
  if (/phase|stage/.test(dim)) {
    const lanes = uniq(itemsOf(p).flatMap((i) => (i.lane ? [en(i.lane)] : [])))
    return lanes.length >= 2 ? lanes : ['Plan', 'Build', 'Launch']
  }
  if (/month|mois/.test(dim)) return [0, 1, 2, 3].map((i) => { const d = new Date(); d.setMonth(d.getMonth() + i, 1); return d.toLocaleDateString('en-US', { month: 'short' }) })
  if (/quarter|trimestre/.test(dim)) return ['Q1', 'Q2', 'Q3', 'Q4']
  if (/week|semaine/.test(dim)) return ['Week 1', 'Week 2', 'Week 3', 'Week 4']
  if (/team|equipe|person|personne|owner/.test(dim)) return team.length >= 2 ? team : ['Team A', 'Team B']
  if (/region/.test(dim)) return ['Americas', 'EMEA', 'APAC']
  if (/status|statut/.test(dim)) return ['To do', 'In progress', 'Done']
  return ['Plan', 'Build', 'Launch']
}
function trackerSubject(plain: string) {
  const s = plain.replace(STRIP_POLITE, '')
    .replace(/^(?:add|create|build|make|show|put|start|set up|generate|i (?:need|want)|ajoute\w*|cree\w*|fais)\s+/i, '')
    .replace(/^(?:(?:a|an|the|un|une|le|la|new)\s+)+/i, '')
    .replace(TRAILING_BOARD, '').replace(/[.!]+$/, '').trim()
  return capitalize(s)
}
function buildTracker(ctx: Ctx, p: Project): { block: Block; name: string } {
  const id = uid('b')
  const numeric = /\b(budget|costs?|spend\w*|revenue|sales|expenses?|hours|kpis?|metrics?|units|preorders?|couts?|depenses?|ventes)\b/.test(ctx.norm)
  const typed = oneLine(trackerSubject(ctx.plain), 48) || 'Tracker'
  // a chart shows the numbers, so "budget tracker by phase" reads "Budget by phase"; a board keeps the words typed
  const title = numeric ? capitalize(typed.replace(/\s+(?:tracker|table|breakdown|dashboard)\b/i, '')) : typed
  const cats = dimensionValues(ctx.norm, p)
  if (numeric) {
    // start from the project's real numbers when it has them, otherwise from clearly round figures
    const sheet = budgetFigures(p)
    const total = sheet?.planned ? Math.round(sheet.planned / 1000) : 120
    const weights = cats.map((_, i) => cats.length - i + 1); const sum = weights.reduce((a, b) => a + b, 0)
    const money = /\b(budget|costs?|spend\w*|revenue|sales|expenses?|couts?|depenses?|ventes)\b/.test(ctx.norm)
    const series = cats.map((label, i) => {
      const target = Math.round((total * weights[i]) / sum)
      return { label, target, value: Math.round(target * (i === 0 ? 0.9 : i === 1 ? 0.55 : 0.2)) }
    })
    return { name: /chart/i.test(title) ? `a ${lowerFirst(title).replace(/^a /, '')}` : `a ${lowerFirst(title)} chart`, block: { id, type: 'chart', title, span: 2, unit: money ? 'k€' : undefined, series } }
  }
  const words = ctx.norm.split(/[^a-z0-9]+/).filter((w) => w.length > 3)
  const related = openTodos(p).filter((t) => words.some((w) => normalize(en(t.text)).includes(w)))
  const seeds = related.length ? related.map((t) => ({ title: t.text, assigneeId: t.assigneeId })) : [{ title: `List what ${lowerFirst(title)} covers` }, { title: 'Name an owner for each item' }, { title: 'Review it with the team' }]
  const columns = (DIMENSION.test(ctx.norm) ? cats : ['Now', 'Next', 'Later']).map((c, i) => ({ id: uid('k'), title: c, cards: i === 0 ? seeds.map((s) => ({ id: uid('c'), ...s })) : [] }))
  return { name: `a ${lowerFirst(title)} block`, block: { id, type: 'kanban', title, span: 3, columns } }
}

/** "Which colorway?" with options from what the team already said, else sensible defaults. */
function buildPoll(ctx: Ctx, p: Project, id: string): { block: Block; name: string } {
  const after = ctx.plain.match(/(?::\s*|\b(?:on|about|for|sur|pour|concernant)\s+)(.{2,})$/i)?.[1]?.replace(/[.?!]+$/, '').trim() ?? ''
  const explicit = after.split(/\s+(?:ou|or)\s+|,\s*/i).map((o) => capitalize(o.trim())).filter(Boolean)
  const topic = after.replace(/^(?:(?:the|a|an|our|le|la|les|l')\s*)+/i, '').trim()
  const keyWord = normalize(topic).split(/\s+/).filter((w) => w.length > 3).pop()
  let options: string[] = explicit.length >= 2 ? explicit.slice(0, 5) : []
  if (options.length < 2 && keyWord) {
    const haystack = [
      ...readable(ctx, p).flatMap((m) => (m.kind === 'text' ? [stripMarkup(en(m.text))] : [])),
      ...p.blocks.flatMap((b) => (b.type === 'notes' ? [en(b.text)] : [])),
    ]
    for (const text of haystack.reverse()) {
      if (!normalize(text).includes(keyWord)) continue
      const m = text.match(/\b([A-Z][\p{L}-]+) or ([A-Z][\p{L}-]+)\b/u)
      if (m) { options = [m[1], m[2]]; break }
    }
  }
  if (options.length < 2) {
    const n = normalize(topic)
    options = /(date|time|slot|day|when|meeting|review|creneau|jour|heure)/.test(n) ? ['Tuesday morning', 'Thursday afternoon', 'Friday morning']
      : /(color|colour|couleur|coloris|finish|shade)/.test(n) ? ['Warm', 'Neutral', 'Bold']
      : /(venue|place|location|lieu|salle)/.test(n) ? ['Keep the current plan', 'Find somewhere new', 'Decide next week']
      : /(name|nom|title|titre)/.test(n) ? ['Keep the current one', 'Try something new', 'Ask the team for ideas']
      : ['Yes, go ahead', 'Not yet', 'I need more details']
  }
  const question = explicit.length >= 2 ? `${explicit.slice(0, 5).join(' or ')}?` : topic ? `Which ${lowerFirst(topic)}?` : 'Which slot works for the next review?'
  const title = topic && explicit.length < 2 ? capitalize(topic) : 'Team poll'
  return { name: 'a poll', block: { id, type: 'poll', title, span: 1, question, options: options.map((label) => ({ id: uid('o'), label, votes: [] })) } }
}

function buildBlock(type: BlockKind, ctx: Ctx, p: Project): { block: Block; name: string } {
  const id = uid('b'); const now = Date.now()
  const team = p.memberIds.filter((m) => m !== GEMINI_ID)
  const at = (i: number) => (team.length ? team[i % team.length] : undefined)
  const after = ctx.plain.match(/(?::\s*|\b(?:about|sur|concernant|regarding)\s+)(.{3,})$/i)?.[1]?.replace(/[.!]+$/, '').trim()
  switch (type) {
    case 'tracker': return buildTracker(ctx, p)
    case 'poll': return buildPoll(ctx, p, id)
    case 'timeline': return {
      name: 'a timeline',
      block: { id, type, title: 'Timeline', span: 3, items: [
        { id: uid('i'), label: 'Framing', start: now - 2 * DAY, end: now + 5 * DAY, ownerId: at(0), progress: 40 },
        { id: uid('i'), label: 'Production', start: now + 5 * DAY, end: now + 19 * DAY, ownerId: at(1), progress: 0 },
        { id: uid('i'), label: 'Team review', start: now + 21 * DAY, end: now + 21 * DAY, ownerId: at(0), milestone: true },
        { id: uid('i'), label: 'Launch', start: now + 30 * DAY, end: now + 30 * DAY, ownerId: at(0), milestone: true },
      ] },
    }
    case 'chart': {
      if (DIMENSION.test(ctx.norm) || /\b(budget|cost|spend|revenue|sales)\b/.test(ctx.norm)) return buildTracker(ctx, p)
      const todos = todosOf(p)
      const series = team.map((m) => ({ label: firstName(m), value: todos.filter((t) => t.assigneeId === m && !t.done).length })).filter((s) => s.value > 0)
      return {
        name: 'a chart',
        block: series.length
          ? { id, type, title: 'Open to-dos by person', span: 2, series }
          : { id, type, title: 'Progress by workstream', span: 2, unit: '%', series: [{ label: 'Framing', value: 80, target: 100 }, { label: 'Production', value: 45, target: 70 }, { label: 'Comms', value: 20, target: 50 }] },
      }
    }
    case 'model3d': {
      const model = /\b(bureau|desk)\b/.test(ctx.norm) ? 'desk' : /\bbadge\b/.test(ctx.norm) ? 'badge' : 'lamp'
      return { name: 'a 3D model', block: { id, type, title: '3D model', span: 1, model, caption: 'Drag to turn it around.' } }
    }
    case 'kanban': {
      const todos = todosOf(p)
      const card = (t: Todo) => ({ id: uid('c'), title: t.text, assigneeId: t.assigneeId })
      const open = todos.filter((t) => !t.done).map(card); const done = todos.filter((t) => t.done).map(card)
      return {
        name: 'a kanban',
        block: { id, type, title: 'Kanban', span: 3, columns: [
          { id: uid('k'), title: 'To do', cards: open.length ? open.slice(1) : [{ id: uid('c'), title: 'List the next steps', assigneeId: at(0) }] },
          { id: uid('k'), title: 'In progress', cards: open.slice(0, 1) },
          { id: uid('k'), title: 'Done', cards: done },
        ] },
      }
    }
    case 'todo': return { name: 'a to-do list', block: { id, type, title: 'To do', span: 1, todos: [] } }
    case 'calendar': return {
      name: 'a calendar',
      block: { id, type, title: 'Next meetings', span: 1, events: p.messages.flatMap((m) => (m.kind === 'meeting' && !m.ended && m.visibility.type === 'all' ? [{ id: uid('e'), title: m.title, start: m.start, durationMin: m.durationMin, attendeeIds: m.attendeeIds }] : [])) },
    }
    case 'notes': return { name: 'a notes block', block: { id, type: 'notes', title: 'Notes', span: 1, text: after ? capitalize(after) : 'For the team to fill in.' } }
  }
}

function planBlock(type: BlockKind, ctx: Ctx, p: Project): Plan {
  const { block, name } = buildBlock(type, ctx, p)
  const estimated = block.type === 'chart' && type !== 'chart' ? ' The figures are a starting estimate, so check them with the team.' : ''
  if (ctx.owner) return { before: () => get().addBlock(ctx.pid, block), say: `Done. ${capitalize(name)} is on the board.${estimated} ${boardLink(block.id)}` }
  const wanted = uniq(normalize(en(block.title)).split(/\s+/).filter((w) => w.length > 3))
  const same = pendingProposals(ctx, p).find((m) => m.action.type === 'add-block' && m.action.block.type === block.type && wanted.some((w) => normalize(`${en(m.title)} ${en(m.description)}`).includes(w)))
  if (same) return { say: `There’s already a proposal for that, waiting for ${firstName(p.ownerId)}. ${msgLink(same.id, 'See the proposal')}` }
  return {
    say: `I prepared ${name} and sent it to ${firstName(p.ownerId)} as a proposal. On this project, ${firstName(p.ownerId)} decides what goes on the board.`,
    after: () => postProposal(ctx, p, `Add ${name} to the board`, `${firstName(ctx.viewer)} asked: "${oneLine(ctx.plain, 90)}"`, { type: 'add-block', block }),
  }
}

/* ---------------- tools built for this project ---------------- */
function planApp(id: AppId, ctx: Ctx, p: Project): Plan {
  const tool = TOOLS[id]
  const have = hasApp(p, id)
  if (have) return { say: `${capitalize(tool.name)} is already on this project. ${boardLink(have.id, 'Open it')}` }
  if (!tool.fits(p)) return { say: `I can’t build ${tool.name} here yet. ${tool.missing}` }
  const block = makeApp(id, p)
  if (ctx.owner) return { before: () => get().addBlock(ctx.pid, block), say: `Built it. ${capitalize(tool.name)}, made for ${en(p.name)} from what is in this project. ${boardLink(block.id, 'Open it')}` }
  const same = pendingProposals(ctx, p).find((m) => m.action.type === 'add-block' && m.action.block.type === 'app' && m.action.block.app === id)
  if (same) return { say: `There’s already a proposal for that, waiting for ${firstName(p.ownerId)}. ${msgLink(same.id, 'See the proposal')}` }
  return {
    say: `I built ${tool.name} and sent it to ${firstName(p.ownerId)} as a proposal. On this project, ${firstName(p.ownerId)} decides what goes on the board.`,
    after: () => postProposal(ctx, p, `Add ${tool.name} to the board`, `${tool.hint}. ${firstName(ctx.viewer)} asked: "${oneLine(ctx.plain, 90)}"`, { type: 'add-block', block }),
  }
}

/* ---------------- moving dates ---------------- */
const NOT_A_LABEL = new Set(['move', 'moved', 'delay', 'push', 'back', 'postpone', 'reschedule', 'should', 'could', 'would', 'with', 'this', 'that', 'week', 'weeks', 'days', 'earlier', 'later', 'bring', 'forward', 'please', 'have', 'there', 'what', 'decaler', 'avancer', 'reporter', 'repousser', 'date', 'semaine', 'semaines', 'jours'])
function itemNamed(ctx: Ctx, p: Project): TimelineItem | undefined {
  const words = ctx.norm.split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !NOT_A_LABEL.has(w))
  const items = itemsOf(p)
  const score = (i: TimelineItem) => { const l = normalize(en(i.label)); return words.filter((w) => l.includes(w)).length }
  const best = items.map((i) => ({ i, s: score(i) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || Number(!!b.i.milestone) - Number(!!a.i.milestone))
  return best[0]?.i
}
const pendingMoveFor = (ctx: Ctx, p: Project, itemId?: string) => pendingProposals(ctx, p).find((m) => m.action.type === 'move-milestone' && (!itemId || m.action.itemId === itemId))

function planMove(ctx: Ctx, p: Project): Plan {
  const named = itemNamed(ctx, p)
  if (!named && isCallTalk(ctx.norm)) {
    const m = readable(ctx, p).filter((x) => x.kind === 'meeting' && !x.ended && !x.live && x.start >= Date.now()).sort((a, b) => (a.kind === 'meeting' && b.kind === 'meeting' ? a.start - b.start : 0))[0]
    const parsed = parseWhen(ctx.norm)
    if (m?.kind === 'meeting' && parsed.at) return { before: () => updateMessage(ctx.pid, m.id, { start: parsed.at } as Partial<Message>), say: `Moved **${en(m.title)}** to ${when(parsed.at)}. ${msgLink(m.id, 'See the meeting')}` }
    if (m?.kind === 'meeting') return { say: `When should **${en(m.title)}** move to? It’s currently ${when(m.start)}.` }
    return { say: 'There’s no upcoming meeting to move on this project.' }
  }
  const tl = timelineOf(p)
  if (!tl) return { say: 'There’s no timeline on this project yet, so there’s nothing to move.' }
  const item = named ?? nextMilestone(p) ?? tl.items[0]
  const pending = pendingMoveFor(ctx, p, item.id)
  if (pending) return { say: `That change is already proposed and waiting for ${ctx.owner ? 'your approval' : firstName(p.ownerId)}. ${msgLink(pending.id, en(pending.title))}` }
  const days = ctx.norm.match(/\b(\d+)\s*(?:jours?|days?|j)\b/)
  const weeks = ctx.norm.match(/\b(\d+)\s*(?:semaines?|weeks?)\b/)
  const abs = days ? Number(days[1]) : weeks ? Number(weeks[1]) * 7 : /\b(deux semaines|two weeks|quinze jours)\b/.test(ctx.norm) ? 14 : 7
  const earlier = /\b(avance[rz]?|earlier|bring forward|plus tot)\b/.test(ctx.norm)
  const delta = earlier ? -abs : abs
  const label = en(item.label)
  return {
    say: ctx.owner
      ? `Here’s the proposal for **${label}**. Nothing moves until you approve it.`
      : `I prepared the change for **${label}**. ${firstName(p.ownerId)} needs to approve it.`,
    after: () => postProposal(ctx, p,
      `${earlier ? 'Bring forward' : 'Move'} "${label}" by ${count(abs, 'day')}`,
      `Asked by ${firstName(ctx.viewer)}. New date: ${dateOnly(item.end + delta * DAY)}.`,
      { type: 'move-milestone', blockId: tl.id, itemId: item.id, deltaDays: delta }),
  }
}

/* ---------------- documents ---------------- */
type DocSection = { heading?: Txt; body: Txt }
function docSubject(plain: string) {
  const m = plain.match(/(?::\s*|\b(?:about|on|regarding|concerning|for|sur|concernant|pour)\s+)(.{3,})$/i)
  const s = m?.[1].replace(/\s*[.?!]+$/, '').replace(/^(?:the|a|an|our)\s+/i, '').trim()
  return s || null
}
function statusSection(ctx: Ctx, p: Project): DocSection {
  const open = openTodos(p); const ms = nextMilestone(p)
  return { heading: 'Where things stand', body: `${count(p.memberIds.filter((m) => m !== GEMINI_ID).length, 'person', 'people')} on the project and ${count(open.length, 'open to-do')}.${ms ? ` Next step: ${en(ms.label)}, on ${dateOnly(ms.end)}.` : ''}${pendingProposals(ctx, p).length ? ` ${count(pendingProposals(ctx, p).length, 'proposal')} waiting for a decision.` : ''}` }
}
function actionsSection(p: Project): DocSection {
  const open = openTodos(p)
  return { heading: 'Next actions', body: open.length ? open.slice(0, 5).map((t) => `• ${en(t.text)}${t.assigneeId ? ` (${firstName(t.assigneeId)})` : ''}`).join('\n') : 'No open to-dos yet. To be defined together.' }
}
function draftDoc(ctx: Ctx, p: Project): { title: string; label: string; sections: DocSection[] } {
  const n = ctx.norm
  const product = productName(p)
  const subject = docSubject(ctx.plain)
  const rawPitch = firstSentence(en(p.description))
  const pitch = /^[A-Z][\w\s-]* that /.test(rawPitch) ? `${product} is a ${lowerFirst(rawPitch)}` : rawPitch
  const launch = itemsOf(p).find((i) => /launch|lancement/i.test(en(i.label)) && i.milestone)
  const launchLine = launch ? `on ${new Date(launch.end).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}` : 'soon'
  const owner = personById(p.ownerId)
  const decisions = lastCallSummary(ctx, p)?.decisions.map(en) ?? []
  if (/\b(press release|communique)\b/.test(n)) {
    const topic = subject && normalize(subject) !== normalize(product) ? subject : `${product} launch`
    return {
      label: 'press release', title: `${product} press release`,
      sections: [
        { heading: 'For immediate release', body: `${product} arrives ${launchLine}` },
        { heading: 'Summary', body: `${product} is announced today. ${pitch}${subject && normalize(subject) !== normalize(product) ? ` This release covers ${lowerFirst(topic)}.` : ''} It will be available ${launchLine}.` },
        { heading: 'Why it matters', body: `${product} comes from a small team focused on one thing done well. Every detail was tested with real prototypes before the design was frozen.` },
        { heading: 'Quote', body: `"${product} is the result of months of careful work, and we can’t wait for people to try it," said ${owner.name}, ${lowerFirst(en(owner.title))}.` },
        { heading: 'Availability', body: launch ? `${product} will be available ${launchLine}. Preorders open before launch.` : `${product} will be available soon. Dates to be confirmed.` },
        { heading: 'Press contact', body: `${owner.name}, ${p.address}` },
      ],
    }
  }
  if (/\b(blog|article|post)\b/.test(n)) {
    const topic = subject ?? product
    return {
      label: 'blog post', title: capitalize(oneLine(topic, 60)),
      sections: [
        { body: `Blog post draft from the ${en(p.name)} team.` },
        { heading: 'The short version', body: `This post is about ${lowerFirst(topic)}. ${pitch}` },
        { heading: `Why ${lowerFirst(oneLine(topic, 40))} matters`, body: `The team spent real time on this because it shapes how people experience ${product}. Here’s what we set out to do, and what changed along the way.` },
        { heading: 'What we learned', body: decisions.length ? decisions.slice(0, 3).map((d) => `• ${d}`).join('\n') : 'Add one or two concrete lessons from the team here.' },
        { heading: 'What’s next', body: nextMilestone(p) ? `Next up: ${en(nextMilestone(p)!.label)}, on ${dateOnly(nextMilestone(p)!.end)}. We’ll share more then.` : 'We’ll share more soon.' },
      ],
    }
  }
  if (/\bfaq\b/.test(n)) {
    return {
      label: 'FAQ', title: `${product} FAQ`,
      sections: [
        { heading: `What is ${product}?`, body: pitch },
        { heading: 'When is it available?', body: launch ? `${capitalize(launchLine)}.` : 'Dates to be confirmed.' },
        { heading: 'Who can I contact?', body: `Write to ${p.address}. No account needed.` },
      ],
    }
  }
  if (/\b(agenda)\b/.test(n)) {
    return {
      label: 'agenda', title: subject ? `Agenda: ${oneLine(subject, 50)}` : `${product} meeting agenda`,
      sections: [
        { heading: 'Goal', body: subject ? `Agree next steps on ${lowerFirst(subject)}.` : 'Agree the next steps.' },
        { heading: 'To decide', body: pendingProposals(ctx, p).length ? pendingProposals(ctx, p).map((m) => `• ${en(m.title)}`).join('\n') : 'Nothing pending right now.' },
        { heading: 'To review', body: openTodos(p).slice(0, 4).map((t) => `• ${en(t.text)}`).join('\n') || 'No open to-dos.' },
      ],
    }
  }
  if (/\b(report|rapport|summary|synthese|compte[- ]rendu)\b/.test(n)) {
    return { label: 'report', title: subject ? `Report: ${oneLine(subject, 50)}` : `${product} status report`, sections: [statusSection(ctx, p), { heading: 'Decisions so far', body: decisions.length ? decisions.map((d) => `• ${d}`).join('\n') : 'None recorded yet.' }, actionsSection(p)] }
  }
  const kind = /\b(memo)\b/.test(n) ? 'memo' : /\b(one-?pager)\b/.test(n) ? 'one-pager' : /\b(announcement|annonce)\b/.test(n) ? 'announcement' : /\b(newsletter)\b/.test(n) ? 'newsletter' : /\b(speech|discours|script)\b/.test(n) ? 'script' : /\b(checklist)\b/.test(n) ? 'checklist' : 'brief'
  const title = subject ? `${capitalize(oneLine(subject, 50))} ${kind}` : `${product} ${kind}`
  return {
    label: kind, title,
    sections: [
      { heading: 'Purpose', body: subject ? `This ${kind} covers ${lowerFirst(subject)}, based on what’s in ${en(p.name)}.` : (pitch || `The starting point for ${en(p.name)}.`) },
      statusSection(ctx, p),
      actionsSection(p),
      { heading: 'Decisions needed', body: pendingProposals(ctx, p).length ? pendingProposals(ctx, p).map((m) => `• ${en(m.title)}`).join('\n') : 'Agree the scope with the team, then confirm the date of the next review.' },
    ],
  }
}
function planDoc(ctx: Ctx, p: Project): Plan {
  const { title, label, sections } = draftDoc(ctx, p)
  const art: Artifact = { id: uid('a'), kind: 'doc', title, ownerId: ctx.viewer, updatedAt: Date.now(), sections }
  const isPublic = ctx.visibility.type === 'all'
  return {
    before: () => {
      get().addArtifact(ctx.pid, art)
      const files = p.blocks.find((b) => b.type === 'files')
      if (isPublic && files?.type === 'files') get().patchBlock(ctx.pid, files.id, { artifactIds: [art.id, ...files.artifactIds] } as Partial<Block>)
    },
    say: `Here’s a first draft of your ${label}: **${title}**. It’s open next to the chat.`,
    after: () => {
      get().push(ctx.pid, { id: uid('m'), kind: 'file', authorId: GEMINI_ID, at: Date.now(), visibility: ctx.visibility, artifactId: art.id })
      const s = get()
      if (s.activeProjectId === ctx.pid && s.viewerId === ctx.viewer) s.setPane({ type: 'artifact', id: art.id })
    },
  }
}

/* ---------------- meetings ---------------- */
function planMeeting(ctx: Ctx, p: Project): Plan {
  const parsed = parseWhen(ctx.norm)
  const start = parsed.at ?? nextBusinessMorning()
  const named = peopleNamed(ctx).filter((id) => id !== ctx.viewer)
  const members = named.filter((id) => p.memberIds.includes(id))
  const outsiders = named.filter((id) => !p.memberIds.includes(id))
  const typedEmails = ctx.plain.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? []
  const guestEmails = uniq([...typedEmails, ...outsiders.map((id) => personById(id).email).filter(Boolean)])
  const attendeeIds = named.length ? uniq([ctx.viewer, ...members]) : uniq([ctx.viewer, ...p.memberIds]).filter((id) => id !== GEMINI_ID)
  const unknown = ctx.plain.match(/\bwith\s+([A-Z][\p{L}-]+)/u)?.[1]
  const unknownName = unknown && !named.some((id) => firstName(id) === unknown) ? unknown : undefined
  const cleaned = ctx.plain.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '').replace(WHEN_PHRASE, ' ').replace(/\s+/g, ' ').trim()
  const about = cleaned.match(/\b(?:about|regarding|to discuss|to review|to talk about|concernant|sur|pour parler de)\s+(.{3,}?)(?:\s+with\s+.*)?[.!]?$/i)?.[1]?.replace(/^(?:the|our)\s+/i, '')
  const word = /\b(call|appel)\b/.test(ctx.norm) ? 'Call' : 'Meeting'
  const nameList = list([...named.map(firstName), ...(unknownName ? [unknownName] : [])])
  const title = about ? capitalize(oneLine(about, 60)) : nameList ? `${word} with ${nameList}` : `${en(p.name)} team sync`
  const duration = ctx.norm.match(/\bfor\s+(\d+)\s*(?:min|mins|minutes)\b/)?.[1]
  const durationMin = duration ? Number(duration) : /\b(1\s*h|1 hour|une heure|an hour|one hour)\b/.test(ctx.norm) ? 60 : 30
  const weekendNote = parsed.rolled ? ' That day falls on a weekend, so I picked the next weekday.' : ''
  const guestNames = outsiders.map(firstName)
  const guestNote = guestNames.length ? ` ${list(guestNames)} ${guestNames.length > 1 ? 'join' : 'joins'} as a guest, for this call only.` : ''
  const unknownNote = unknownName ? ` I don’t have an address for ${unknownName}, so add them with Add guest.` : ''
  return {
    say: `Booked for ${when(start)}.${weekendNote}${guestNote}${unknownNote}`,
    after: () => {
      get().push(ctx.pid, { id: uid('m'), kind: 'meeting', authorId: GEMINI_ID, at: Date.now(), visibility: ctx.visibility, title, start, durationMin, attendeeIds, guestEmails: guestEmails.length ? guestEmails : undefined })
      const cal = projectOf(ctx.pid)?.blocks.find((b) => b.type === 'calendar')
      if (cal?.type === 'calendar' && ctx.visibility.type === 'all') get().patchBlock(ctx.pid, cal.id, { events: [...cal.events, { id: uid('e'), title, start, durationMin, attendeeIds }] } as Partial<Block>)
    },
  }
}

/* ---------------- email drafts ---------------- */
function keySentence(body: string) {
  const paras = body.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)
  const main = paras.find((x, i) => !(i === 0 && x.length < 40)) ?? paras[0] ?? ''
  // the sentence that carries a fact, not "Bad news, I'd rather tell you straight away"; the sign-off doesn't count
  const content = (paras.length > 2 ? paras.slice(0, -1) : paras).filter((x) => !(x.length < 40 && /,$/.test(x)))
  const sentences = content.join(' ').match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)?.map((x) => x.trim()).filter((x) => x.length > 24 && !/^(hi|hello|dear|bonjour)\b/i.test(x)) ?? []
  return sentences.find((x) => /\d/.test(x)) ?? firstSentence(main)
}
function planDraftMail(ctx: Ctx, p: Project): Plan {
  const inbound = inboundEmails(ctx, p)
  const me = firstName(ctx.viewer)
  const typed = ctx.plain.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0]
  const named = peopleNamed(ctx).filter((id) => id !== ctx.viewer)
  const quoted = ctx.quote?.kind === 'email' && ctx.quote.direction === 'in' ? ctx.quote : undefined
  const fromPerson = (id: string) => [...inbound].reverse().find((m) => m.authorId === id || mailAddress(m.from).toLowerCase() === personById(id).email.toLowerCase())

  let target: EmailMessage | undefined = quoted
  let to: string | undefined = typed
  let firstContactName: string | undefined
  if (!target && !to) {
    const unknown = ctx.plain.match(/\b(?:to|a|à)\s+([A-Z][\p{L}-]+)/u)?.[1]
    if (named.length) {
      const id = named[0]
      target = fromPerson(id)
      if (!target) {
        if (!onProject(p, id)) return { say: `${firstName(id)} isn’t on this project, so I haven’t drafted anything.` }
        to = personById(id).email
        firstContactName = firstName(id)
      }
    } else if (unknown) {
      return { say: `I don’t see ${unknown} on this project, so I haven’t drafted anything. Share their address and I’ll start one.` }
    } else {
      target = inbound[inbound.length - 1]
    }
  }
  if (target) to = target.from
  if (!to) return { say: 'No email has reached this project yet, and I have no address to write to. Give me a name or an address and I’ll prepare the draft.' }
  const name = firstContactName ?? mailName(to).split(/\s+/)[0]
  let subject: string; let body: string
  if (target) {
    const topic = stripRe(en(target.subject))
    subject = `Re: ${topic}`
    const key = keySentence(en(target.body))
    // "draft a reply to Priya: €112 per unit, ..." comes with its terms, from a tool or typed by hand
    const terms = ctx.plain.match(/^[^:]*\b(?:reply|respond|answer)\b[^:]*:\s*([\s\S]+)$/i)?.[1]?.trim().replace(/[.\s]+$/, '')
    body = terms
      ? `Hi ${name},\n\nThanks for your message on ${shortTopic(topic)}. Here is what we can offer: ${terms}.\n\nLet me know if that works for you, and I’ll send the paperwork.\n\nBest,\n${me}`
      : `Hi ${name},\n\nThanks for your update on ${shortTopic(topic)}. We’ve noted this: "${oneLine(key, 160)}"\n\nThe team is on it, and I’ll confirm our next steps shortly.\n\nBest,\n${me}`
  } else {
    subject = en(p.name)
    body = `Hi ${name},\n\nI’m reaching out about ${en(p.name)}. ${firstSentence(en(p.description))}\n\nCould we find time to talk this week?\n\nBest,\n${me}`
  }
  return {
    say: `The draft for ${name} is ready below. Only you can see it until you send it.`,
    after: () => get().push(ctx.pid, { id: uid('m'), kind: 'email', direction: 'out', authorId: GEMINI_ID, at: Date.now(), visibility: { type: 'private', with: [ctx.viewer, GEMINI_ID] }, subject, body, from: p.address, to: to!, quoteId: target?.id }),
  }
}

/* ---------------- catch up: computed from the live project ---------------- */
function liveFacts(ctx: Ctx, p: Project) {
  const pending = pendingProposals(ctx, p)
  const overdue = overdueTodos(p)
  const mine = openTodos(p).filter((t) => t.assigneeId === ctx.viewer)
  const mail = inboundEmails(ctx, p).at(-1)
  const meeting = meetingsAhead(ctx, p)[0]
  return { pending, overdue, mine, mail, meeting }
}
/** Scripted flavor is kept only for what stays true: nothing about pending decisions, which are computed. */
function flavor(p: Project) {
  const text = en(p.script?.catchUp.text)
  if (!text) return ''
  return (text.match(/[^.!?]+[.!?]+/g) ?? [])
    .map((s) => s.trim())
    .filter((s) => !/\b(proposal|waiting|decision|decide|poll|vote|approve)\b/i.test(s))
    .slice(0, 2).map(emailWord).join(' ')
}
function planRecap(ctx: Ctx, p: Project, refreshBoard = true): Plan {
  const f = liveFacts(ctx, p)
  const opener = flavor(p) || `Here’s where ${en(p.name)} stands.`
  const bullets: string[] = []
  if (f.pending.length) {
    const links = f.pending.slice(0, 3).map((m) => msgLink(m.id, en(m.title))).join(', ')
    bullets.push(ctx.owner ? `**Waiting on you (${f.pending.length}):** ${links}` : `**Waiting on ${firstName(p.ownerId)} (${f.pending.length}):** ${links}`)
  } else if (ctx.owner && readable(ctx, p).some((m) => m.kind === 'proposal')) bullets.push('**Nothing is waiting on you.** All proposals are decided.')
  if (!ctx.owner) {
    const yours = f.pending.filter((m) => m.authorId === ctx.viewer)
    if (yours.length) bullets.push(`**Yours among them:** ${yours.map((m) => en(m.title)).join(', ')}`)
  }
  if (f.mine.length) {
    const late = f.mine.filter((t) => t.due && t.due < Date.now()).length
    bullets.push(`**Your to-dos:** ${f.mine.length} open${late ? `, ${late} overdue` : ''}. Next: ${en(f.mine[0].text)}`)
  } else {
    bullets.push(openTodos(p).length ? `**Your to-dos:** none open. The team has ${count(openTodos(p).length, 'open to-do')}.` : '**To-dos:** none yet. Tell me what to add.')
  }
  if (f.overdue.length) bullets.push(`**Overdue:** ${en(f.overdue[0].text)}${f.overdue.length > 1 ? ` and ${f.overdue.length - 1} more` : ''}`)
  if (f.mail) bullets.push(`**Last email:** ${mailName(f.mail.from)}, ${dayWord(f.mail.at)}, about ${shortTopic(en(f.mail.subject))}. ${msgLink(f.mail.id, 'Read it')}`)
  if (f.meeting) bullets.push(`**Next meeting:** ${f.meeting.title}, ${f.meeting.live ? 'live now' : when(f.meeting.start)}`)
  const block = p.blocks.find((b) => b.type === 'summary')
  const say = `${opener}\n${bullets.map((b) => `- ${b}`).join('\n')}`
  // the board is shared: its summary is written for everyone, not for this viewer
  const boardBullets: string[] = [
    ...(f.pending.length ? [`${count(f.pending.length, 'proposal')} waiting for ${firstName(p.ownerId)}: ${f.pending.slice(0, 2).map((m) => en(m.title)).join(', ')}`] : []),
    ...(f.overdue.length ? [`${count(f.overdue.length, 'overdue to-do')}`] : []),
    `${count(openTodos(p).length, 'open to-do')}`,
    ...(f.mail ? [`Last email: ${mailName(f.mail.from)}, about ${shortTopic(en(f.mail.subject))}`] : []),
    ...(f.meeting ? [`Next meeting: ${f.meeting.title}, ${when(f.meeting.start)}`] : []),
  ]
  return {
    before: () => {
      if (!refreshBoard) return
      if (block) {
        get().patchBlock(ctx.pid, block.id, { text: opener, bullets: boardBullets, updatedAt: Date.now(), fresh: true } as Partial<Block>)
        setTimeout(() => get().patchBlock(ctx.pid, block.id, { fresh: false }), 1800)
      } else if (ctx.owner) {
        get().addBlock(ctx.pid, { id: uid('b'), type: 'summary', title: 'Where things stand', span: 3, text: opener, bullets: boardBullets, updatedAt: Date.now() })
      }
    },
    say,
  }
}

/* ---------------- answers: nothing below changes the project ---------------- */
function planLastCall(ctx: Ctx, p: Project): Plan {
  const m = lastCallSummary(ctx, p)
  if (!m) return { say: 'There’s no call summary on this project yet. I’ll write one when the next call ends.' }
  const decisions = m.decisions.length ? `\nDecisions:\n${m.decisions.map((d) => `- ${en(d)}`).join('\n')}` : ''
  return { say: `**${en(m.title)}**, ${dayWord(m.at)}, ${m.durationMin} min. ${firstSentence(en(m.summary))}${decisions}\n${msgLink(m.id, 'See the full summary')}` }
}
function answerNextMeeting(ctx: Ctx, p: Project): Plan {
  const m = meetingsAhead(ctx, p)[0]
  if (!m) return { say: 'Nothing is booked on this project.' }
  return { say: `${meetingLine(m)}${m.messageId ? ` ${msgLink(m.messageId, 'See it')}` : ''}` }
}
function budgetFigures(p: Project) {
  const sheet = p.artifacts.find((a): a is Extract<Artifact, { kind: 'sheet' }> => a.kind === 'sheet' && /budget|cost|spend|finance/i.test(en(a.title)))
  if (!sheet) return null
  const cols = sheet.columns.map((c) => en(c).toLowerCase())
  const planned = cols.findIndex((c) => /planned|budget|target/.test(c))
  const actual = cols.findIndex((c) => /committed|actual|spent/.test(c))
  if (planned < 0 || actual < 0) return { sheet, planned: 0, actual: 0, worst: null as null | { name: string; over: number } }
  const isTotal = (r: (string | number)[]) => /^total$/i.test(String(r[0]))
  const rows = sheet.rows.filter((r) => !isTotal(r))
  const total = sheet.rows.find(isTotal)
  const sum = (i: number) => rows.reduce((a, r) => a + (Number(r[i]) || 0), 0)
  const worst = rows.map((r) => ({ name: String(r[0]), over: (Number(r[actual]) || 0) - (Number(r[planned]) || 0) })).sort((a, b) => b.over - a.over)[0]
  return { sheet, planned: total ? Number(total[planned]) : sum(planned), actual: total ? Number(total[actual]) : sum(actual), worst }
}
const euros = (n: number) => `€${Math.round(n).toLocaleString('en-US')}`
const withUnit = (n: number, unit?: string) => (unit === 'k€' ? `€${n}K` : unit === '%' ? `${n}%` : `${n}${unit ? ` ${unit}` : ''}`)
function answerBudget(p: Project): Plan {
  const b = budgetFigures(p)
  if (b?.planned) {
    const gap = b.actual - b.planned
    const state = gap > 0 ? `${euros(gap)} over` : gap < 0 ? `${euros(-gap)} under` : 'exactly on plan'
    const worst = b.worst && b.worst.over > 0 ? ` The biggest overrun is ${b.worst.name}, ${euros(b.worst.over)} over.` : ''
    return { say: `${euros(b.actual)} committed against ${euros(b.planned)} planned, so ${state}.${worst} Open ${docLink(b.sheet)}` }
  }
  const chart = p.blocks.find((x): x is Extract<Block, { type: 'chart' }> => x.type === 'chart' && /budget|cost|spend|committed|planned|revenue/i.test(en(x.title)))
  if (chart) {
    const lines = chart.series.slice(0, 3).map((s) => `- ${en(s.label)}: ${withUnit(s.value, chart.unit)}${s.target != null ? ` of ${withUnit(s.target, chart.unit)}` : ''}`).join('\n')
    return { say: `${en(chart.title)}:\n${lines}\n${boardLink(chart.id, 'See it on the board')}` }
  }
  return { say: 'This project has no budget yet. Ask me for a budget tracker and I’ll start one.' }
}
function answerBlocking(ctx: Ctx, p: Project): Plan {
  const pending = pendingProposals(ctx, p); const overdue = overdueTodos(p); const late = lateItems(p)
  const lines = [
    ...pending.slice(0, 2).map((m) => `- ${msgLink(m.id, en(m.title))}: waiting on ${ownerWord(ctx, p)}`),
    ...overdue.slice(0, 2).map((t) => `- ${en(t.text)}: overdue${t.assigneeId ? `, with ${firstName(t.assigneeId)}` : ''}`),
    ...late.slice(0, 2).map((i) => `- ${en(i.label)}: past its date at ${i.progress ?? 0}%`),
  ]
  if (!lines.length) return { say: 'Nothing is blocked right now. No pending decisions and no overdue to-dos.' }
  return { say: `${lines.length === 1 ? 'One thing' : `${lines.length} things`} to clear:\n${lines.join('\n')}` }
}
function answerRisks(ctx: Ctx, p: Project): Plan {
  const b = budgetFigures(p)
  const pendingMove = pendingMoveFor(ctx, p)
  const lines = [
    ...(pendingMove ? [`- **Date:** ${msgLink(pendingMove.id, en(pendingMove.title))} is still undecided`] : []),
    ...(b?.planned && b.actual > b.planned ? [`- **Budget:** ${euros(b.actual - b.planned)} over plan${b.worst ? `, mostly ${b.worst.name}` : ''}`] : []),
    ...behindItems(p).slice(0, 2).map((i) => `- **Schedule:** ${en(i.label)} is at ${i.progress}%, due ${dateOnly(i.end)}`),
    ...lateItems(p).slice(0, 2).map((i) => `- **Late:** ${en(i.label)} is past its date at ${i.progress ?? 0}%`),
    ...(overdueTodos(p).length ? [`- **To-dos:** ${count(overdueTodos(p).length, 'item')} overdue, starting with ${en(overdueTodos(p)[0].text)}`] : []),
  ]
  if (!lines.length) return { say: itemsOf(p).length || todosOf(p).length ? 'No clear risk in the data right now. Dates, to-dos and budget all look fine.' : 'There isn’t enough in this project yet to see a risk.' }
  return { say: `What I’d watch:\n${lines.slice(0, 4).join('\n')}` }
}
function answerOnTrack(ctx: Ctx, p: Project): Plan {
  const items = itemsOf(p)
  if (!items.length) return { say: `I can’t tell yet. ${en(p.name)} has no timeline to measure against.` }
  const late = lateItems(p); const behind = behindItems(p); const overdue = overdueTodos(p); const pendingMove = pendingMoveFor(ctx, p)
  const ms = nextMilestone(p)
  const done = items.filter((i) => i.end < Date.now()).length - late.length
  const issues = [
    ...late.map((i) => `${en(i.label)} is late at ${i.progress ?? 0}%`),
    ...behind.map((i) => `${en(i.label)} is behind at ${i.progress}%`),
    ...(overdue.length ? [`${count(overdue.length, 'to-do')} overdue`] : []),
  ]
  const verdict = issues.length ? `Mostly, with ${count(issues.length, 'watch point')}.` : pendingMove ? 'So far, yes, though one date decision is open.' : 'Yes.'
  const next = ms ? ` Next milestone: ${en(ms.label)}, ${dateOnly(ms.end)}.` : ''
  const open = pendingMove ? ` Still open: ${msgLink(pendingMove.id, en(pendingMove.title))}.` : ''
  return { say: `${verdict} ${done} of ${items.length} timeline items ${done === 1 ? 'is' : 'are'} done.${next}${issues.length ? ` ${issues.slice(0, 2).join('. ')}.` : ''}${open}` }
}
const STOP = new Set('what whats where when which whose would could should about there their this that with have from your yours mine these those them they will just like tell show give please does done doing into over more most some been were want need know going much many very really still also dans pour avec quoi comment quand sont cette votre notre nous vous status update think thing things latest'.split(' '))
const keywordsOf = (n: string) => n.split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w))
function answerOwner(ctx: Ctx, p: Project): Plan {
  const term = ctx.norm.replace(/^.*?\b(owns?|owner of|in charge of|leads?|leading|responsible for|handling|handles|working on|takes? care of|s'occupe de|gere|responsable de)\b/, '').replace(/[?.!]/g, '').replace(/^\s*(the|our|le|la|les|du|de)\s+/, '').trim()
  const words = keywordsOf(term.length ? term : ctx.norm)
  const has = (s: string) => words.length > 0 && words.every((w) => normalize(s).includes(w))
  const lines: string[] = []
  for (const i of itemsOf(p).filter((x) => has(en(x.label))).slice(0, 2)) if (i.ownerId) lines.push(`${firstName(i.ownerId)} owns ${en(i.label)} on the timeline, ${dateOnly(i.end)}.`)
  for (const a of p.artifacts.filter((x) => has(en(x.title))).slice(0, 2)) lines.push(`${firstName(a.ownerId)} owns the document ${docLink(a)}.`)
  if (!lines.length) for (const t of openTodos(p).filter((x) => has(en(x.text))).slice(0, 2)) if (t.assigneeId) lines.push(`${firstName(t.assigneeId)} has the to-do: ${en(t.text)}.`)
  if (!lines.length) return { say: `I don’t see an owner for ${term || 'that'} on the board. ${firstName(p.ownerId)} leads the project overall.` }
  return { say: lines.join(' ') }
}
function answerPerson(ctx: Ctx, p: Project, id: string): Plan {
  const x = personById(id)
  const lastEmail = [...inboundEmails(ctx, p)].reverse().find((m) => m.authorId === id)
  if (/\b(say|said|write|wrote|send|sent|reply|replied|dit|ecrit|envoye)\b/.test(ctx.norm)) {
    if (lastEmail) return { say: `${x.name} emailed ${dayWord(lastEmail.at)} about ${shortTopic(en(lastEmail.subject))}: "${oneLine(keySentence(en(lastEmail.body)), 160)}" ${msgLink(lastEmail.id, 'Read it')}` }
    const last = [...readable(ctx, p)].reverse().find((m) => m.authorId === id && m.kind === 'text')
    if (last?.kind === 'text') return { say: `${firstName(id)}, ${dayWord(last.at)}: "${oneLine(stripMarkup(en(last.text)), 160)}" ${msgLink(last.id, 'See it')}` }
    return { say: `${firstName(id)} hasn’t written anything here yet.` }
  }
  if (!onProject(p, id)) return { say: `${x.name} isn’t on this project.` }
  const mine = openTodos(p).filter((t) => t.assigneeId === id)
  const owned = upcoming(p).filter((i) => i.ownerId === id)
  if (/\b(working|doing|busy|plate|to-?dos?|tasks?|taches?|fait|occupe)\b/.test(ctx.norm)) {
    const parts = [...mine.slice(0, 3).map((t) => en(t.text)), ...owned.slice(0, 1).map((i) => `${en(i.label)} on the timeline`)]
    return { say: parts.length ? `${firstName(id)} has: ${parts.join('; ')}.` : `${firstName(id)} has nothing assigned right now.` }
  }
  const role = p.memberIds.includes(id) ? `on the team, ${count(mine.length, 'open to-do')}` : 'an outside contact who reaches the project by email'
  return { say: `${x.name}, ${lowerFirst(en(x.title))}. ${firstName(id)} is ${role}.` }
}
function answerMine(ctx: Ctx, p: Project): Plan {
  const mine = openTodos(p).filter((t) => t.assigneeId === ctx.viewer)
  const waiting = ctx.owner ? pendingProposals(ctx, p) : []
  const lines = [
    ...waiting.slice(0, 3).map((m) => `- Decide: ${msgLink(m.id, en(m.title))}`),
    ...mine.slice(0, 4).map((t) => `- ${en(t.text)}${t.due ? `, due ${dayWord(t.due)}` : ''}`),
  ]
  if (!lines.length) return { say: 'Nothing on your plate right now.' }
  return { say: `For you:\n${lines.join('\n')}` }
}
function answerTodos(p: Project): Plan {
  const open = openTodos(p)
  if (!open.length) return { say: 'No open to-dos on this project.' }
  const lines = open.slice(0, 4).map((t) => `- ${en(t.text)}${t.assigneeId ? ` (${firstName(t.assigneeId)})` : ''}`).join('\n')
  return { say: `${count(open.length, 'open to-do')}${open.length > 4 ? ', starting with' : ''}:\n${lines}\n${boardLink(p.blocks.find((b) => b.type === 'todo')?.id)}` }
}
function answerFiles(ctx: Ctx, p: Project): Plan {
  const words = keywordsOf(ctx.norm).filter((w) => !/^(file|files|docs?|documents?|fichiers?|attachments?)$/.test(w))
  const hit = p.artifacts.filter((a) => words.some((w) => normalize(en(a.title)).includes(w)))
  if (hit.length) return { say: `Here ${hit.length > 1 ? 'they are' : 'it is'}: ${hit.slice(0, 3).map(docLink).join(', ')}.` }
  if (!p.artifacts.length) return { say: 'No files in this project yet.' }
  return { say: `${count(p.artifacts.length, 'file')} in this project:\n${p.artifacts.slice(0, 5).map((a) => `- ${docLink(a)}`).join('\n')}` }
}
function answerShould(ctx: Ctx, p: Project): Plan {
  const n = ctx.norm
  const item = itemNamed(ctx, p)
  const pending = isMoveAsk(n) ? pendingMoveFor(ctx, p, item?.id) ?? (item ? undefined : pendingMoveFor(ctx, p)) : pendingProposals(ctx, p).find((m) => keywordsOf(n).some((w) => normalize(en(m.title)).includes(w)))
  const decider = ctx.owner ? 'It’s your call' : `It’s ${firstName(p.ownerId)}’s call`
  if (isMoveAsk(n) && (item || pending)) {
    const call = lastCallSummary(ctx, p)
    const sentences = call ? (en(call.summary).match(/[^.!?]+[.!?]+/g) ?? []).map((s) => s.trim()) : []
    const cost = sentences.find((s) => /€|\$|cost|shift|price/i.test(s))
    const pro = pending ? firstSentence(emailWord(en(pending.description))) : lateItems(p)[0] ? `${en(lateItems(p)[0].label)} is already late.` : 'It buys margin on the dependencies.'
    const dependent = item ? upcoming(p).find((i) => i.id !== item.id && Math.abs(i.end - item.end) < 10 * DAY) : undefined
    const con = [cost, dependent ? `${en(dependent.label)} on ${dateOnly(dependent.end)} would likely have to move too.` : ''].filter(Boolean).join(' ') || 'Anything already promised on that date moves with it.'
    return { say: `**For:** ${pro}\n**Against:** ${con}\n${decider}.${pending ? ` The proposal is ready: ${msgLink(pending.id, en(pending.title))}` : ''}` }
  }
  if (pending) return { say: `That’s already on the table: ${msgLink(pending.id, en(pending.title))}. ${decider}.` }
  const ground = groundedHit(ctx, p)
  if (ground) return { say: `I’d look at this first. ${ground} ${decider}.` }
  return { say: `There isn’t enough in the project for me to say. A quick poll would settle it, and ${decider.toLowerCase().replace('it’s', 'it’s still')}.` }
}
function answerQuoteAbout(quote: Message): Plan {
  const link = msgLink(quote.id, 'See the message')
  if (quote.kind === 'email') return { say: `${mailName(quote.from)}’s email is about ${shortTopic(en(quote.subject))}. The main point: "${oneLine(keySentence(en(quote.body)), 160)}" ${link}` }
  if (quote.kind === 'proposal') return { say: `A proposal: ${en(quote.title)}. ${firstSentence(emailWord(en(quote.description)))} It’s ${quote.status}. ${link}` }
  const who = firstName(quote.authorId)
  return { say: `${who}’s point: "${oneLine(snippet(quote, 'en'), 180)}" ${link}` }
}
function answerAboutEmail(ctx: Ctx, p: Project, email: EmailMessage): Plan | null {
  const n = ctx.norm
  const triage = triageEmail(email, p)
  if (/\b(who|qui)\b/.test(n)) {
    if (triage.repliedBy) return { say: `${triage.repliedBy === ctx.viewer ? 'You' : firstName(triage.repliedBy)} already replied to this one.` }
    if (triage.whoId) return { say: `${triage.whoId === ctx.viewer ? 'You should' : `${firstName(triage.whoId)} should`} answer. ${triage.why}` }
  }
  if (/\b(when|deadline|by when|due|date|quand|echeance)\b/.test(n)) return { say: triage.deadline ? `${triage.deadline}.` : 'This email doesn’t set a deadline.' }
  if (/\b(what|summar\w*|about|mean|resume\w*|quoi)\b/.test(n)) return { say: triage.summary }
  return null
}
/** Looks for the topic in the project itself. Returns a sentence, or null when the project says nothing about it. */
function groundedHit(ctx: Ctx, p: Project): string | null {
  const words = keywordsOf(ctx.norm)
  if (!words.length) return null
  const has = (s: string) => { const x = normalize(s); return words.filter((w) => new RegExp(`\\b${esc(w)}`).test(x)).length }
  const item = itemsOf(p).map((i) => ({ i, s: has(en(i.label)) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s)[0]?.i
  // what people said, not the questions they asked Gemini, and not Gemini's own answers
  const said = [...readable(ctx, p)].reverse().filter((m) => (m.kind === 'email' || (m.kind === 'text' && !en(m.text).includes(`(${GEMINI_ID})`) && !/^@gemini\b/i.test(en(m.text)))) && m.authorId !== GEMINI_ID)
  const last = said.find((m) => has(snippet(m, 'en')) >= Math.min(words.length, 2)) ?? (words.length === 1 || !item ? said.find((m) => has(snippet(m, 'en')) >= Math.min(words.length, 2)) : undefined)
  const parts: string[] = []
  if (item) parts.push(item.milestone
    ? `${en(item.label)} is on ${dateOnly(item.end)}${item.ownerId ? `, with ${firstName(item.ownerId)}` : ''}.`
    : `${en(item.label)} is at ${item.progress ?? 0}%${item.ownerId ? `, owned by ${firstName(item.ownerId)}` : ''}, ${item.end < Date.now() ? 'ended' : 'due'} ${dateOnly(item.end)}.`)
  if (last) {
    const who = last.kind === 'email' ? mailName(last.from).split(/\s+/)[0] : firstName(last.authorId)
    const text = last.kind === 'email' ? keySentence(en(last.body)) : stripMarkup(snippet(last, 'en'))
    parts.push(`${who}, ${dayWord(last.at)}: "${oneLine(text, 130)}" ${msgLink(last.id, 'See it')}`)
  }
  return parts.length ? parts.join(' ') : null
}

const JOKES = [
  'I’d tell you a joke about meetings, but it could have been an email.',
  'A recurring meeting walks into a bar. Nobody knows why, but it happens every Tuesday.',
  'My favorite meeting is the one that ended five minutes early. I’ve heard it exists.',
]
const OFF_TOPIC = (p: Project) => pick([
  `I stay focused on ${en(p.name)}, so that one’s not for me.`,
  `That’s outside ${en(p.name)}, so I’ll leave it to you.`,
  `I only know what’s in this project, and that isn’t in it.`,
])

function smallTalk(ctx: Ctx, p: Project): Plan | null {
  const n = ctx.norm.replace(/[!.?,]+/g, ' ').trim()
  if (/^(thanks?|thank you|thx|ty|merci|cheers)\b/.test(n) && n.split(/\s+/).length <= 6) return { say: pick(['You’re welcome.', 'Anytime.', 'You’re welcome. I’m here if you need anything else.']) }
  if (/^(hi|hello|hey|bonjour|salut|good (morning|afternoon|evening))\b/.test(n) && n.split(/\s+/).length <= 3) {
    const waiting = ctx.owner ? pendingProposals(ctx, p).length : 0
    return { say: `Hi ${firstName(ctx.viewer)}.${waiting ? ` ${count(waiting, 'proposal')} waiting on you whenever you’re ready.` : ' What do you need?'}` }
  }
  if (/^(ok|okay|cool|great|nice|perfect|awesome|super|parfait|got it|sounds good|good|d'accord|top)\b/.test(n) && n.split(/\s+/).length <= 4) return { say: pick(['Sounds good.', 'Great.', 'Good to hear.']) }
  if (/\b(joke|blague|something funny)\b/.test(n)) return { say: pick(JOKES) }
  if (/\b(who are you|what are you|qui es-tu|what can you do|que peux-tu faire|how do you work)\b/.test(n)) return { say: 'I’m Gemini, the AI in this project. I can catch you up, answer from the project, add to-dos and board blocks, draft docs and emails, and book meetings.' }
  return null
}

/** Questions, and anything that isn't a clear request. Never changes the project. */
function answer(ctx: Ctx, p: Project): Plan {
  const n = ctx.norm
  if (ctx.quote?.kind === 'email' && ctx.quote.direction === 'in') {
    const about = answerAboutEmail(ctx, p, ctx.quote)
    if (about) return about
  }
  if (ctx.quote) return answerQuoteAbout(ctx.quote)
  if (isLastCallAsk(n) || /\b(what|which|quoi|quelles?)\b.*\b(decid\w*|decisions?)\b/.test(n)) return planLastCall(ctx, p)
  if (/\b(next|upcoming|prochaine?)\b.*\b(meeting|call|reunion|sync|appel|rdv)\b/.test(n) || /\b(when|quand)\b.*\b(meeting|call|reunion|sync)\b/.test(n)) return answerNextMeeting(ctx, p)
  if (/^(should|shall we|could we|can we)\b|\b(faut-il|doit-on|on devrait)\b/.test(n)) return answerShould(ctx, p)
  if (/\b(block\w*|stuck|holding us|bloqu\w*|waiting on)\b/.test(n)) return answerBlocking(ctx, p)
  if (/\b(what.*miss\w*|what'?s new|what happened|quoi de neuf|catch( \w+)? up|recap|ou en est|where (are|do) we)\b/.test(n)) return planRecap(ctx, p, false)
  if (/\b(budget|costs?|spend\w*|spent|money|expenses?|finance|combien|depens\w*|cout\w*)\b/.test(n)) return answerBudget(p)
  if (/\b(risks?|risques?|worr\w+|inquiet\w*)\b/.test(n)) return answerRisks(ctx, p)
  if (/\b(on track|on time|behind|late|en retard|dans les temps|schedule|deadline)\b/.test(n)) return answerOnTrack(ctx, p)
  if (/\b(who|qui)\b.*\b(owns?|owner|in charge|leads?|leading|responsible|handling|handles|takes? care|s'occupe|gere|responsable)\b/.test(n)) return answerOwner(ctx, p)
  if (/\b(my (plate|to-?dos?|tasks?)|on my plate|for me|do i have|mes (taches|to-?dos?))\b/.test(n) || /\bwhat should i\b/.test(n)) return answerMine(ctx, p)
  const person = peopleNamed(ctx).find((id) => id !== ctx.viewer)
  if (person && /^(who|what|did|has|is|qui|qu'|que|quoi|how)\b/.test(n)) return answerPerson(ctx, p, person)
  if (/\b(who|qui)\b.*\b(team|project|equipe|projet|here|on this)\b/.test(n) || /\b(team|members?|equipe|membres?)\b/.test(n)) {
    return { say: `On this project: ${list(p.memberIds.filter((m) => m !== GEMINI_ID).map((m) => personById(m).name))}. ${firstName(p.ownerId)} decides what goes on the board.` }
  }
  if (/\b(proposals?|propositions?|approve|approbation|decide)\b/.test(n)) {
    const pending = pendingProposals(ctx, p)
    if (!pending.length) return { say: 'No proposals are waiting. Everything’s been decided.' }
    return { say: `${count(pending.length, 'proposal')} waiting on ${ownerWord(ctx, p)}:\n${pending.map((m) => `- ${msgLink(m.id, en(m.title))}`).join('\n')}` }
  }
  if (/\b(emails?|mails?|inbox|courriels?)\b/.test(n)) {
    const mail = inboundEmails(ctx, p).at(-1)
    if (!mail) return { say: `No email yet. Anything sent to ${p.address} shows up here.` }
    return { say: `Last email: ${mailName(mail.from)}, ${dayWord(mail.at)}, about ${shortTopic(en(mail.subject))}. "${oneLine(keySentence(en(mail.body)), 130)}" ${msgLink(mail.id, 'Read it')}` }
  }
  if (/\b(poll|sondage|votes?|voted)\b/.test(n)) {
    const poll = p.blocks.find((b): b is Extract<Block, { type: 'poll' }> => b.type === 'poll')
    if (!poll) return { say: 'There’s no poll on the board yet.' }
    return { say: `${en(poll.question)} ${poll.options.map((o) => `${en(o.label)}: ${o.votes.length}`).join(', ')}. ${boardLink(poll.id, 'See it on the board')}` }
  }
  if (/\b(to-?dos?|taches?|tasks?|a faire|left to do|reste)\b/.test(n)) return answerTodos(p)
  if (/\b(files?|docs?|documents?|fichiers?|attachments?|pieces? jointes?|deck|slides?|sheet|brief)\b/.test(n)) return answerFiles(ctx, p)
  // when is the launch, how is the firmware going, anything about the shoot: look in the project itself
  const hit = groundedHit(ctx, p)
  if (hit) return { say: hit }
  if (/\b(next|prochaine?|milestone|jalon|when|quand)\b/.test(n) && nextMilestone(p)) {
    const ms = nextMilestone(p)!
    return { say: `Next milestone: **${en(ms.label)}**, ${dateOnly(ms.end)}${ms.ownerId ? `, with ${firstName(ms.ownerId)}` : ''}.` }
  }
  if (/\b(status|how are we|how's it going|ca avance|progress|avancement)\b/.test(n)) return answerOnTrack(ctx, p)
  return { say: OFF_TOPIC(p) }
}

/* ---------------- the decision ---------------- */
/* ---------------- updating a block Gemini made ("Ask Gemini to update") ---------------- */
function planUpdateBlock(ctx: Ctx, p: Project): Plan | null {
  const m = ctx.plain.trim().match(/^update\s+([^:]+?)(?:\s*:\s*([\s\S]*))?$/i)
  if (!m) return null
  const wanted = m[1].trim().toLowerCase()
  const block = p.blocks.find((b) => en(b.title).toLowerCase() === wanted) ?? p.blocks.find((b) => en(b.title).toLowerCase().includes(wanted))
  if (!block) return null
  const name = en(block.title)
  const ask = (m[2] ?? '').trim()
  if (!ask) return { say: `Sure. What should change in **${name}**? For example: "@Gemini update ${name}: add a line for shipping, 12".` }
  const tail = ask.match(/^(?:add\s+(?:a\s+|an\s+)?(?:line|row|bar|option|card|item)?\s*(?:for\s+)?)?(.+?)(?:[,:\s]+(\d+(?:\.\d+)?))?$/i)
  const label = (tail?.[1] ?? ask).replace(/^["']|["']$/g, '').trim()
  const value = tail?.[2] ? Number(tail[2]) : undefined
  if (block.type === 'app') {
    const change = appUpdate(block, ask)
    if (!change) return { say: `**${name}** is yours to drag: every control saves for everyone on the project. I can set numbers from here, for example "@Gemini update ${name}: 7".` }
    if (!ctx.owner) return { say: `I sent ${firstName(p.ownerId)} a proposal to update **${name}** with: ${ask}.`, after: () => postProposal(ctx, p, `Update ${name}`, ask, { type: 'none' }) }
    return { say: `Set **${name}** to ${change.say}.`, before: () => { get().patchBlock(ctx.pid, block.id, { state: change.state, fresh: true } as Partial<Block>); setTimeout(() => get().patchBlock(ctx.pid, block.id, { fresh: false } as Partial<Block>), 1800) } }
  }
  let patch: Partial<Block> | null = null
  if (block.type === 'chart') patch = { series: [...block.series, { label, value: value ?? 0 }] } as Partial<Block>
  else if (block.type === 'poll') patch = { options: [...block.options, { id: uid('o'), label, votes: [] }] } as Partial<Block>
  else if (block.type === 'notes') patch = { text: `${en(block.text)}\n${ask}` } as Partial<Block>
  else if (block.type === 'kanban' && block.columns.length) patch = { columns: block.columns.map((c, i) => (i ? c : { ...c, cards: [...c.cards, { id: uid('k'), title: label }] })) } as Partial<Block>
  if (!patch) return { say: `**${name}** is one of the project's fixed parts, so change it directly on the board. I can update anything I built: charts, polls, notes and kanban boards.` }
  const change = patch
  if (!ctx.owner) {
    return {
      say: `I sent ${firstName(p.ownerId)} a proposal to update **${name}** with: ${ask}.`,
      after: () => postProposal(ctx, p, `Update ${name}`, ask, { type: 'none' }),
    }
  }
  return {
    say: `Updated **${name}**: ${ask}.`,
    before: () => {
      get().patchBlock(ctx.pid, block.id, { ...change, fresh: true } as Partial<Block>)
      setTimeout(() => get().patchBlock(ctx.pid, block.id, { fresh: false } as Partial<Block>), 1800)
    },
  }
}

function decide(ctx: Ctx, p: Project): Plan {
  const n = ctx.norm
  const update = planUpdateBlock(ctx, p)
  if (update) return update
  const talk = smallTalk(ctx, p)
  if (talk) return talk
  if (isQuestion(n)) return answer(ctx, p)
  const app = wantedApp(n)
  if (app) return planApp(app, ctx, p)
  // read-only requests first: nothing to confirm, nothing to change
  if (isLastCallAsk(n)) return planLastCall(ctx, p)
  if (isTodoAsk(n)) return planTodo(ctx, p)
  if (isReplyAsk(n)) return planDraftMail(ctx, p)
  if (isDocAsk(n)) return planDoc(ctx, p)
  if (isMoveAsk(n)) return planMove(ctx, p)
  if (ctx.quote && (isRecapAsk(n) || !n.trim())) return answerQuoteAbout(ctx.quote)
  if (isRecapAsk(n)) return planRecap(ctx, p)
  const block = wantedBlock(n)
  if (block) return planBlock(block, ctx, p)
  const named = peopleNamed(ctx).length > 0 || !!parseWhen(n).at
  if (isCallTalk(n) && !/^call\s/.test(n)) return planMeeting(ctx, p)
  if (/^(call|schedule|book|planifie\w*|cale)\b/.test(n) && named) return planMeeting(ctx, p)
  if (/^(call|ajoute\w*|add|book|schedule|cree\w*|create)\b/.test(n)) return planTodo(ctx, p)
  return answer(ctx, p)
}

/* ---------------- streaming and sequencing ---------------- */
const queues = new Map<string, Promise<void>>()
const inFlight = new Set<string>()
const TOKENS = /@?\[[^\]]*\]\([^)]*\)\s*|\*\*[^*]+\*\*\s*|\S+\s*|\s+/g
const tokens = (s: string) => s.match(TOKENS) ?? []
const stillThere = (ctx: Ctx, mid: string) => { const p = projectOf(ctx.pid); return !!p && !!findMessage(p, mid) }

async function streamInto(ctx: Ctx, mid: string, say: Txt) {
  const full = en(say)
  const words = tokens(full)
  const duration = Math.min(1500, Math.max(1000, 800 + words.length * 14))
  const tick = 45
  const steps = Math.max(1, Math.floor(duration / tick))
  for (let i = 1; i <= steps; i++) {
    if (!stillThere(ctx, mid)) return false
    const text = words.slice(0, Math.ceil((words.length * i) / steps)).join('')
    updateMessage(ctx.pid, mid, { text } as Partial<Message>)
    await sleep(tick)
  }
  if (!stillThere(ctx, mid)) return false
  updateMessage(ctx.pid, mid, { text: full, streaming: false } as Partial<Message>)
  return true
}

async function run(ctx: Ctx) {
  const mid = uid('m')
  const message: Message = { id: mid, kind: 'text', authorId: GEMINI_ID, at: Date.now(), visibility: ctx.visibility, text: '', streaming: true }
  inFlight.add(mid)
  try {
    if (ctx.parentId) get().reply(ctx.pid, ctx.parentId, message)
    else get().push(ctx.pid, message)
    await sleep(500 + Math.random() * 350)
    const p = projectOf(ctx.pid)
    if (!p || !stillThere(ctx, mid)) return
    const plan = decide(ctx, p) // reads the project now, so answers queued after an action see its result
    plan.before?.()
    const finished = await streamInto(ctx, mid, plan.say)
    if (finished) plan.after?.()
  } catch (e) {
    console.error('Gemini', e)
    if (stillThere(ctx, mid)) updateMessage(ctx.pid, mid, { text: 'Something went wrong on my side. Could you try again?', streaming: false } as Partial<Message>)
  } finally {
    inFlight.delete(mid)
  }
}

/**
 * Ask Gemini in a project. Answers always go to the project that asked, one at a time per project,
 * whatever the viewer does in the meantime (send again, switch project, switch persona).
 */
export function askGemini(projectId: string, text: string, opts: AskOptions = {}): Promise<void> {
  const s = get()
  const p = s.projects.find((x) => x.id === projectId)
  if (!p) return Promise.resolve()
  s.markTour('gemini')
  const viewer = s.viewerId
  const mentioned: string[] = []
  const plain = text.replace(MENTION_RE, (_, name: string, id: string) => {
    if (id === GEMINI_ID) return ''
    mentioned.push(id)
    return name
  }).replace(/@gemini\b/gi, '').replace(/\s+/g, ' ').trim()
  const parent = opts.parentId ? findMessage(p, opts.parentId) : undefined
  const visibility: Visibility = parent ? parent.visibility
    : opts.privateTo ? { type: 'private', with: uniq([viewer, opts.privateTo, GEMINI_ID]) }
    : { type: 'all' }
  const quoted = opts.quoteId ? findMessage(p, opts.quoteId) : undefined
  const ctx: Ctx = {
    pid: projectId, viewer, owner: roleIn(p, viewer) === 'owner', visibility,
    parentId: parent?.id,
    quote: quoted && canSee(quoted.visibility, viewer) ? quoted : undefined,
    plain, norm: normalize(plain), mentioned: uniq(mentioned),
  }
  const job = (queues.get(projectId) ?? Promise.resolve()).then(() => run(ctx))
  queues.set(projectId, job)
  return job
}

/** After a reload no timer is left: an answer caught mid-way must stop shimmering. Safe to call repeatedly. */
export function healInterruptedAnswers() {
  const s = get()
  const fix = (pid: string, m: Message) => {
    if (!m.streaming || inFlight.has(m.id)) return
    const empty = m.kind === 'text' && !tx(m.text, 'en')
    updateMessage(pid, m.id, (empty ? { streaming: false, text: 'That answer was interrupted. Please ask me again.' } : { streaming: false }) as Partial<Message>)
  }
  for (const p of s.projects) for (const m of p.messages) { fix(p.id, m); for (const r of m.replies ?? []) fix(p.id, r) }
}
