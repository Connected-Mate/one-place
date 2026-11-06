// The scripted Gemini engine: no network, one AI. It reads the project, decides what was asked, acts on the
// project for real (board, documents, meetings, proposals) and streams its answer word by word.
// Callers post the user's own message themselves; askGemini only posts the answer.
import { fmtDate, fmtTime, tx } from '../i18n'
import { canSee, GEMINI_ID, personById, roleIn, uid, useStore } from '../store'
import type { Artifact, Block, EmailMessage, L, Lang, Message, Project, ProposalAction, Todo, Txt, Visibility } from '../data/types'
import { findMessage, firstName, mailName, MENTION_RE, snippet, updateMessage } from './helpers'

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

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const both = (f: (l: Lang) => string): L => ({ fr: f('fr'), en: f('en') })
const get = () => useStore.getState()
const projectOf = (pid: string) => get().projects.find((p) => p.id === pid)
const uniq = <T,>(a: T[]) => [...new Set(a)]
export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’]/g, "'").toLowerCase()
const oneLine = (s: string, n = 70) => { const c = s.replace(/\s+/g, ' ').trim(); return c.length > n ? `${c.slice(0, n - 1).trimEnd()}…` : c }
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const DAY = 864e5

/* ---------------- project facts ---------------- */
const todosOf = (p: Project) => p.blocks.flatMap((b) => (b.type === 'todo' ? b.todos : []))
const openTodos = (p: Project) => todosOf(p).filter((t) => !t.done)
const timelineOf = (p: Project) => p.blocks.find((b): b is Extract<Block, { type: 'timeline' }> => b.type === 'timeline' && b.items.length > 0)
const nextMilestone = (p: Project) => {
  const items = p.blocks.flatMap((b) => (b.type === 'timeline' ? b.items : [])).filter((i) => i.end >= Date.now()).sort((a, b) => a.start - b.start)
  return items.find((i) => i.milestone) ?? items[0]
}
const nextMeeting = (p: Project, viewer: string) => p.messages
  .filter((m): m is Extract<Message, { kind: 'meeting' }> => m.kind === 'meeting' && !m.ended && m.start >= Date.now() && canSee(m.visibility, viewer))
  .sort((a, b) => a.start - b.start)[0]
/** "2 tâches ouvertes" (every French word agrees) / "2 open to-dos" (English: last word, and zero is plural). */
const plural = (n: number, l: Lang, fr: string, en: string) => `${n} ${l === 'fr' ? (n > 1 ? fr.replace(/\S+/g, '$&s') : fr) : (n === 1 ? en : `${en}s`)}`

/* ---------------- intents, FR and EN ---------------- */
const VERB_MAKE = /\b(add|create|build|make|show|put|new|generate|want|need|draw|start|set up|ajoute\w*|cree\w*|creer|construi\w*|fai[st]\w*|mets?|montre\w*|genere\w*|nouveau|nouvelle|veux|voudrais|lance\w*|dessine\w*|propose\w*|insere\w*)\b/
const BLOCK_WORDS: [Exclude<Block['type'], 'summary' | 'files' | 'people'>, RegExp][] = [
  ['timeline', /\b(timeline|frise|calendrier du projet|planning|roadmap|retroplanning|gantt)\b/],
  ['poll', /\b(poll|sondage|vote)\b/],
  ['chart', /\b(charts?|graphs?|graphique|courbe|diagramme)\b/],
  ['model3d', /(\b3d\b|\bmaquette\b|\bmodele\b)/],
  ['kanban', /\bkanban\b/],
  ['todo', /\b(to-?do list|liste de taches|liste de to-?dos?)\b/],
  ['calendar', /\b(agenda|calendar|calendrier)\b/],
  ['notes', /\b(notes?|bloc-?notes)\b/],
]
const isReply = (n: string) => /\b(reponds?|repondre|reponse|reply|respond|answer)\b/.test(n)
  || /\b(draft|redige\w*|ecris|write|prepare\w*|envoie|send)\b.*\b(mail|email|e-mail)\b/.test(n)
  || /\b(mail|email|e-mail)\s+(a|to|pour|for)\b/.test(n)
const isAddTodo = (n: string) => /^\s*(to-?do|tache|task)\s*:/.test(n)
  || (/\b(to-?dos?|taches?|tasks?|a faire)\b/.test(n) && /\b(add|create|new|note|remember|put|ajoute\w*|cree\w*|nouvelle|mets?|rappelle\w*)\b/.test(n) && !/\b(to-?do list|liste)\b/.test(n))
  || /\b(rappelle-moi|remind me)\b/.test(n)
const isMove = (n: string) => /\b(decal\w*|delay\w*|postpone\w*|repouss\w*|reporte[rz]?|push back|move\w*|retard\w*|avance[rz]?|bring forward)\b/.test(n)
const isDoc = (n: string) => /\b(redige\w*|draft|brief|document|memo|compte[- ]rendu|note de cadrage)\b/.test(n)
const isMeeting = (n: string) => /\b(meeting|reunion|call|appel|rdv|rendez-?vous|schedule|planifie\w*|book|cale)\b/.test(n)
const isRecap = (n: string) => /\b(recap\w*|resume\w*|catch ?up|summar\w*|synthese|point|ou on en est|ou en est|where (are|do) we|where things stand|what.*missed|quoi de neuf)\b/.test(n)

function wantedBlock(n: string) {
  const hit = BLOCK_WORDS.find(([, re]) => re.test(n))
  if (!hit) return null
  const shortAsk = n.trim().split(/\s+/).length <= 3
  if (n.includes('?') && !/\b(peux|can|could|pourrais)\b/.test(n)) return null
  return VERB_MAKE.test(n) || shortAsk ? hit[0] : null
}

/* ---------------- text parsing ---------------- */
const WEEKDAYS: [RegExp, number][] = [[/\b(dimanche|sunday)\b/, 0], [/\b(lundi|monday)\b/, 1], [/\b(mardi|tuesday)\b/, 2], [/\b(mercredi|wednesday)\b/, 3], [/\b(jeudi|thursday)\b/, 4], [/\b(vendredi|friday)\b/, 5], [/\b(samedi|saturday)\b/, 6]]
/** Reads "demain 14h", "friday at 2pm", "mardi". */
function parseWhen(n: string): { at?: number; hasTime: boolean } {
  const now = new Date()
  let day: Date | null = null
  if (/\b(apres-demain|day after tomorrow)\b/.test(n)) day = new Date(now.getTime() + 2 * DAY)
  else if (/\b(demain|tomorrow)\b/.test(n)) day = new Date(now.getTime() + DAY)
  else if (/\b(aujourd'hui|today|ce soir|tonight)\b/.test(n)) day = new Date(now)
  else for (const [re, wd] of WEEKDAYS) if (re.test(n)) { day = new Date(now.getTime() + (((wd - now.getDay() + 7) % 7) || 7) * DAY); break }
  const h24 = n.match(/\b(\d{1,2})\s*h\s*(\d{2})?\b/) ?? n.match(/\b(\d{1,2}):(\d{2})\b/)
  const h12 = n.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/)
  let hour: number | null = null; let min = 0
  if (h12) { hour = (Number(h12[1]) % 12) + (h12[3] === 'pm' ? 12 : 0); min = Number(h12[2] ?? 0) }
  else if (h24 && Number(h24[1]) < 24) { hour = Number(h24[1]); min = Number(h24[2] ?? 0) }
  else { const bare = n.match(/\b(?:at|a)\s+(\d{1,2})\b/); if (bare && Number(bare[1]) < 24) hour = Number(bare[1]) }
  if (!day && hour === null) return { hasTime: false }
  const d = day ?? new Date(now)
  d.setHours(hour ?? 10, min, 0, 0)
  if (d.getTime() < now.getTime()) d.setDate(d.getDate() + 1)
  return { at: d.getTime(), hasTime: hour !== null }
}
function nextBusinessMorning() {
  const d = new Date(Date.now() + DAY)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  return d.getTime()
}
const PREFIX_POLITE = /^(?:(?:s'il te pla[iî]t|stp|please|peux-tu|peux tu|tu peux|can you|could you|merci de|pourrais-tu|gemini)[\s,:]+)+/i
const PREFIX_TODO = /^(?:ajoute[rz]?|add|cr[ée]+[rz]?|create|mets?|put|note|remember|rappelle(?:-moi)?(?:\s+de)?|remind me(?:\s+to)?)?\s*(?:(?:une?|an?|the|la|le|ma|ce|cette)\s+)?(?:(?:nouvelle|new)\s+)?(?:to-?dos?|t[âa]ches?|tasks?|[àa] faire)?\s*(?:[:,.\-]\s*)?(?:(?:pour|for|de|to|que)\s+)?/i
const TRAILING_BOARD = /\s*(?:(?:sur|au|dans|on|to|in)\s+(?:le|les|la|the)?\s*(?:board|tableau|to-?dos?|liste|list))\s*\.?$/i

/** Person named in the text: an explicit mention first, then a first name after "pour/for/à/to". */
function assigneeFrom(ctx: Ctx, p: Project): string | undefined {
  const m = ctx.mentioned.find((id) => p.memberIds.includes(id))
  if (m) return m
  return p.memberIds.find((id) => id !== GEMINI_ID && new RegExp(`\\b(pour|for|a|to)\\s+${normalize(firstName(id))}\\b`).test(ctx.norm))
}
function todoTextFrom(ctx: Ctx, assigneeId?: string) {
  let t = ctx.plain.replace(PREFIX_POLITE, '').trim().replace(PREFIX_TODO, '').trim()
  if (assigneeId) {
    const full = personById(assigneeId).name; const first = firstName(assigneeId)
    for (const name of [full, first]) {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      t = t.replace(new RegExp(`(?:^|\\s)(?:assign[ée]+\\s+)?(?:pour|for|à|a|to)\\s+${esc}\\b`, 'i'), '').replace(new RegExp(`^${esc}\\b\\s*[:,]?\\s*`, 'i'), '')
    }
  }
  t = t.replace(TRAILING_BOARD, '').replace(/^[\s:,.\-]+/, '').replace(/[\s:,]+$/, '').trim()
  return t ? capitalize(t) : ''
}
/** Subject after "sur / about / : ", or null. */
function subjectFrom(plain: string) {
  const m = plain.match(/(?::\s*|\b(?:sur|about|on|pour|for|concernant|regarding)\s+)(.{3,})$/i)
  const s = m?.[1].replace(/\s*[.?!]+$/, '').trim()
  return s ? capitalize(s) : null
}

/* ---------------- answer plans ---------------- */
const boardLink = (blockId?: string) => both((l) => `[${l === 'fr' ? 'Voir sur le board' : 'View on board'}](op:board${blockId ? `/${blockId}` : ''})`)
const ownerName = (p: Project) => firstName(p.ownerId)

function proposalVisibility(ctx: Ctx, p: Project): Visibility {
  return ctx.visibility.type === 'all' ? ctx.visibility : { type: 'private', with: uniq([...ctx.visibility.with, p.ownerId]) }
}
function postProposal(ctx: Ctx, p: Project, title: L, description: L, action: ProposalAction) {
  get().push(ctx.pid, { id: uid('m'), kind: 'proposal', authorId: ctx.viewer, at: Date.now(), visibility: proposalVisibility(ctx, p), title, description, action, status: 'pending' })
}

function planTodo(ctx: Ctx, p: Project): Plan {
  const assigneeId = assigneeFrom(ctx, p)
  const text = todoTextFrom(ctx, assigneeId) || (ctx.quote ? oneLine(snippet(ctx.quote, 'fr'), 90) : '')
  if (!text) return { say: { fr: 'Volontiers. Que dois-je ajouter ? Par exemple : **ajoute une tâche : relire le brief pour Maya**.', en: 'Happy to. What should I add? For example: **add a to-do: review the brief for Maya**.' } }
  const when = parseWhen(ctx.norm)
  const todo: Todo = { id: uid('t'), text, assigneeId, due: when.at, done: false, source: { fr: 'Demandé à Gemini', en: 'Asked Gemini' } }
  const who = both((l) => (assigneeId ? (l === 'fr' ? `, pour ${firstName(assigneeId)}` : `, for ${firstName(assigneeId)}`) : ''))
  const block = p.blocks.find((b) => b.type === 'todo')
  if (block) {
    return {
      before: () => get().addTodo(ctx.pid, block.id, todo),
      say: both((l) => (l === 'fr' ? `C’est ajouté : **${text}**${who.fr}. ` : `Added: **${text}**${who.en}. `) + tx(boardLink(block.id), l)),
    }
  }
  const fresh: Block = { id: uid('b'), type: 'todo', title: { fr: 'À faire', en: 'To do' }, span: 1, todos: [todo] }
  if (ctx.owner) {
    return {
      before: () => get().addBlock(ctx.pid, fresh),
      say: both((l) => (l === 'fr' ? `Ce projet n’avait pas encore de liste, je l’ai créée. Première tâche : **${text}**${who.fr}. ` : `This project had no list yet, so I created one. First to-do: **${text}**${who.en}. `) + tx(boardLink(fresh.id), l)),
    }
  }
  return {
    say: both((l) => (l === 'fr' ? `Ce projet n’a pas encore de liste de tâches. J’en propose une à ${ownerName(p)}, avec **${text}** dedans.` : `This project has no to-do list yet. I’m proposing one to ${ownerName(p)}, with **${text}** in it.`)),
    after: () => postProposal(ctx, p, { fr: 'Ajouter une liste de tâches', en: 'Add a to-do list' }, both((l) => (l === 'fr' ? `Avec une première tâche : ${text}.` : `With a first to-do: ${text}.`)), { type: 'add-block', block: fresh }),
  }
}

function buildBlock(type: (typeof BLOCK_WORDS)[number][0], ctx: Ctx, p: Project): { block: Block; name: L } {
  const id = uid('b'); const now = Date.now()
  const team = p.memberIds.filter((m) => m !== GEMINI_ID)
  const at = (i: number) => team.length ? team[i % team.length] : undefined
  switch (type) {
    case 'timeline': return {
      name: { fr: 'une frise', en: 'a timeline' },
      block: { id, type, title: { fr: 'Calendrier', en: 'Timeline' }, span: 3, items: [
        { id: uid('i'), label: { fr: 'Cadrage', en: 'Framing' }, start: now - 2 * DAY, end: now + 5 * DAY, ownerId: at(0), progress: 40 },
        { id: uid('i'), label: { fr: 'Production', en: 'Production' }, start: now + 5 * DAY, end: now + 19 * DAY, ownerId: at(1), progress: 0 },
        { id: uid('i'), label: { fr: 'Revue d’équipe', en: 'Team review' }, start: now + 21 * DAY, end: now + 21 * DAY, ownerId: at(0), milestone: true },
        { id: uid('i'), label: { fr: 'Lancement', en: 'Launch' }, start: now + 30 * DAY, end: now + 30 * DAY, ownerId: at(0), milestone: true },
      ] },
    }
    case 'poll': {
      const subject = subjectFrom(ctx.plain)
      const parts = subject?.split(/\s+(?:ou|or)\s+|,\s*/i).map((o) => capitalize(o.trim())).filter(Boolean) ?? []
      const options: L[] | string[] = parts.length >= 2 ? parts.slice(0, 5) : [{ fr: 'Mardi matin', en: 'Tuesday morning' }, { fr: 'Jeudi après-midi', en: 'Thursday afternoon' }, { fr: 'Vendredi matin', en: 'Friday morning' }]
      return {
        name: { fr: 'un sondage', en: 'a poll' },
        block: { id, type, title: { fr: 'Sondage', en: 'Poll' }, span: 1, question: parts.length >= 2 ? { fr: 'Que préfère l’équipe ?', en: 'What does the team prefer?' } : subject ?? { fr: 'Quel créneau pour la prochaine revue ?', en: 'Which slot for the next review?' }, options: options.map((label: Txt) => ({ id: uid('o'), label, votes: [] })) },
      }
    }
    case 'chart': {
      const todos = todosOf(p)
      const series = todos.length
        ? team.map((m) => ({ label: firstName(m), value: todos.filter((t) => t.assigneeId === m && !t.done).length })).filter((s) => s.value > 0)
        : []
      return {
        name: { fr: 'un graphique', en: 'a chart' },
        block: series.length
          ? { id, type, title: { fr: 'Tâches ouvertes par personne', en: 'Open to-dos by person' }, span: 2, series }
          : { id, type, title: { fr: 'Avancement par chantier', en: 'Progress by workstream' }, span: 2, unit: '%', series: [{ label: { fr: 'Cadrage', en: 'Framing' }, value: 80, target: 100 }, { label: { fr: 'Production', en: 'Production' }, value: 45, target: 70 }, { label: { fr: 'Communication', en: 'Comms' }, value: 20, target: 50 }] },
      }
    }
    case 'model3d': {
      const model = /\b(bureau|desk)\b/.test(ctx.norm) ? 'desk' : /\bbadge\b/.test(ctx.norm) ? 'badge' : 'lamp'
      return { name: { fr: 'un modèle 3D', en: 'a 3D model' }, block: { id, type, title: { fr: 'Modèle 3D', en: '3D model' }, span: 1, model, caption: { fr: 'Fais-le tourner pour le regarder.', en: 'Drag to turn it around.' } } }
    }
    case 'kanban': {
      const todos = todosOf(p)
      const card = (t: Todo) => ({ id: uid('c'), title: t.text, assigneeId: t.assigneeId })
      const open = todos.filter((t) => !t.done).map(card); const done = todos.filter((t) => t.done).map(card)
      return {
        name: { fr: 'un kanban', en: 'a kanban' },
        block: { id, type, title: { fr: 'Kanban', en: 'Kanban' }, span: 3, columns: [
          { id: uid('k'), title: { fr: 'À faire', en: 'To do' }, cards: open.length ? open.slice(1) : [{ id: uid('c'), title: { fr: 'Lister les prochaines étapes', en: 'List the next steps' }, assigneeId: at(0) }] },
          { id: uid('k'), title: { fr: 'En cours', en: 'In progress' }, cards: open.slice(0, 1) },
          { id: uid('k'), title: { fr: 'Fait', en: 'Done' }, cards: done },
        ] },
      }
    }
    case 'todo': return { name: { fr: 'une liste de tâches', en: 'a to-do list' }, block: { id, type, title: { fr: 'À faire', en: 'To do' }, span: 1, todos: [] } }
    case 'calendar': return {
      name: { fr: 'un agenda', en: 'a calendar' },
      block: { id, type, title: { fr: 'Prochaines réunions', en: 'Next meetings' }, span: 1, events: p.messages.flatMap((m) => (m.kind === 'meeting' && !m.ended && m.visibility.type === 'all' ? [{ id: uid('e'), title: m.title, start: m.start, durationMin: m.durationMin, attendeeIds: m.attendeeIds }] : [])) },
    }
    case 'notes': {
      const subject = subjectFrom(ctx.plain)
      return { name: { fr: 'un bloc de notes', en: 'a notes block' }, block: { id, type, title: { fr: 'Notes', en: 'Notes' }, span: 1, text: subject ?? { fr: 'À compléter par l’équipe.', en: 'For the team to fill in.' } } }
    }
  }
}

function planBlock(type: (typeof BLOCK_WORDS)[number][0], ctx: Ctx, p: Project): Plan {
  const { block, name } = buildBlock(type, ctx, p)
  if (ctx.owner) {
    return {
      before: () => get().addBlock(ctx.pid, block),
      say: both((l) => (l === 'fr' ? `C’est fait, ${name.fr} vient d’arriver sur le board. ` : `Done, ${name.en} just landed on the board. `) + tx(boardLink(block.id), l)),
    }
  }
  const asker = firstName(ctx.viewer)
  return {
    say: both((l) => (l === 'fr'
      ? `Sur ce projet, c’est ${ownerName(p)} qui décide du board. J’ai préparé ${name.fr} et je lui soumets la proposition.`
      : `On this project, ${ownerName(p)} decides what goes on the board. I prepared ${name.en} and sent it as a proposal.`)),
    after: () => postProposal(ctx, p,
      both((l) => (l === 'fr' ? `Ajouter ${name.fr} au board` : `Add ${name.en} to the board`)),
      both((l) => (l === 'fr' ? `${asker} a demandé : « ${oneLine(ctx.plain, 90)} ». C’est prêt à arriver sur le board.` : `${asker} asked: "${oneLine(ctx.plain, 90)}". It’s ready to land on the board.`)),
      { type: 'add-block', block }),
  }
}

function planMove(ctx: Ctx, p: Project): Plan {
  const tl = timelineOf(p)
  if (!tl) return { say: { fr: 'Il n’y a pas encore de calendrier sur ce projet, donc rien à décaler. Veux-tu que je construise une frise ?', en: 'There is no timeline on this project yet, so nothing to move. Shall I build one?' } }
  const words = ctx.norm.split(/[^a-z0-9]+/).filter((w) => w.length > 3)
  const named = tl.items.find((i) => { const f = normalize(tx(i.label, 'fr')); const e = normalize(tx(i.label, 'en')); return words.some((w) => f.includes(w) || e.includes(w)) })
  const item = named ?? tl.items.filter((i) => i.end >= Date.now()).sort((a, b) => a.start - b.start).find((i) => i.milestone) ?? tl.items[0]
  const days = ctx.norm.match(/\b(\d+)\s*(?:jours?|days?|j)\b/)
  const weeks = ctx.norm.match(/\b(\d+)\s*(?:semaines?|weeks?)\b/)
  const abs = days ? Number(days[1]) : weeks ? Number(weeks[1]) * 7 : /\b(deux semaines|two weeks|quinze jours)\b/.test(ctx.norm) ? 14 : 7
  const earlier = /\b(avance[rz]?|earlier|bring forward|plus tot)\b/.test(ctx.norm)
  const delta = earlier ? -abs : abs
  const newDate = both((l) => fmtDate(item.end + delta * DAY, l))
  const asker = firstName(ctx.viewer)
  return {
    say: ctx.owner
      ? both((l) => (l === 'fr' ? `Voici la proposition pour **${tx(item.label, 'fr')}**. Rien ne bouge tant que tu ne l’as pas approuvée.` : `Here is the proposal for **${tx(item.label, 'en')}**. Nothing moves until you approve it.`))
      : both((l) => (l === 'fr' ? `J’ai préparé le décalage de **${tx(item.label, 'fr')}**. ${ownerName(p)} doit l’approuver.` : `I prepared the change for **${tx(item.label, 'en')}**. ${ownerName(p)} has to approve it.`)),
    after: () => postProposal(ctx, p,
      both((l) => (l === 'fr' ? `${earlier ? 'Avancer' : 'Décaler'} « ${tx(item.label, 'fr')} » de ${plural(abs, 'fr', 'jour', '')}` : `${earlier ? 'Bring forward' : 'Move'} "${tx(item.label, 'en')}" by ${plural(abs, 'en', '', 'day')}`)),
      both((l) => (l === 'fr' ? `Demandé par ${asker}. Nouvelle date : ${newDate.fr}.` : `Asked by ${asker}. New date: ${newDate.en}.`)),
      { type: 'move-milestone', blockId: tl.id, itemId: item.id, deltaDays: delta }),
  }
}

function planDoc(ctx: Ctx, p: Project): Plan {
  const subject = subjectFrom(ctx.plain)
  const title = both((l) => (subject ? oneLine(subject, 60) : l === 'fr' ? `Brief ${tx(p.name, 'fr')}` : `${tx(p.name, 'en')} brief`))
  const open = openTodos(p); const ms = nextMilestone(p)
  const art: Artifact = {
    id: uid('a'), kind: 'doc', title, ownerId: ctx.viewer, updatedAt: Date.now(),
    sections: [
      { heading: { fr: 'Objet', en: 'Purpose' }, body: both((l) => (subject ? (l === 'fr' ? `Ce document traite de : ${subject}. Il a été rédigé à partir de ce qui se trouve dans le projet ${tx(p.name, 'fr')}.` : `This document covers: ${subject}. It was written from what is in the ${tx(p.name, 'en')} project.`) : tx(p.description, l) || (l === 'fr' ? `Le point de départ du projet ${tx(p.name, 'fr')}.` : `The starting point of the ${tx(p.name, 'en')} project.`))) },
      { heading: { fr: 'Où on en est', en: 'Where things stand' }, body: both((l) => (l === 'fr' ? `${plural(p.memberIds.length, 'fr', 'personne', '')} sur le projet, ${plural(open.length, 'fr', 'tâche ouverte', '')}.${ms ? ` Prochaine étape : ${tx(ms.label, 'fr')}, le ${fmtDate(ms.end, 'fr')}.` : ''}` : `${plural(p.memberIds.length, 'en', '', 'person').replace('persons', 'people')} on the project, ${plural(open.length, 'en', '', 'open to-do')}.${ms ? ` Next step: ${tx(ms.label, 'en')}, on ${fmtDate(ms.end, 'en')}.` : ''}`)) },
      { heading: { fr: 'Prochaines actions', en: 'Next actions' }, body: both((l) => (open.length ? open.slice(0, 5).map((t) => `• ${tx(t.text, l)}${t.assigneeId ? ` (${firstName(t.assigneeId)})` : ''}`).join('\n') : l === 'fr' ? 'Aucune tâche ouverte. À définir ensemble.' : 'No open to-dos. To be defined together.')) },
      { heading: { fr: 'Décisions à prendre', en: 'Decisions needed' }, body: { fr: 'Valider le périmètre avec l’équipe, puis confirmer la date de la prochaine revue.', en: 'Agree the scope with the team, then confirm the date of the next review.' } },
    ],
  }
  const isPublic = ctx.visibility.type === 'all'
  return {
    before: () => {
      get().addArtifact(ctx.pid, art)
      const files = p.blocks.find((b) => b.type === 'files')
      if (isPublic && files?.type === 'files') get().patchBlock(ctx.pid, files.id, { artifactIds: [art.id, ...files.artifactIds] } as Partial<Block>)
    },
    say: both((l) => (l === 'fr' ? `Voici un premier jet : **${title.fr}**. Il est ouvert à côté, l’équipe peut le reprendre.` : `Here is a first draft: **${title.en}**. It’s open next to the chat, ready for the team.`)),
    after: () => {
      get().push(ctx.pid, { id: uid('m'), kind: 'file', authorId: GEMINI_ID, at: Date.now(), visibility: ctx.visibility, artifactId: art.id })
      const s = get()
      if (s.activeProjectId === ctx.pid && s.viewerId === ctx.viewer) s.setPane({ type: 'artifact', id: art.id })
    },
  }
}

function planMeeting(ctx: Ctx, p: Project): Plan {
  const when = parseWhen(ctx.norm)
  const start = when.at ?? nextBusinessMorning()
  const subject = subjectFrom(ctx.plain.replace(/\b(demain|tomorrow|today|aujourd'hui)\b.*$/i, '').trim())
  const title: Txt = subject && !/@/.test(subject) ? oneLine(subject, 60) : { fr: `Point d’équipe ${tx(p.name, 'fr')}`, en: `${tx(p.name, 'en')} team sync` }
  const guestEmails = uniq(ctx.plain.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? [])
  const attendeeIds = uniq([ctx.viewer, ...ctx.mentioned, ...p.memberIds]).filter((id) => id !== GEMINI_ID)
  const durationMin = /\b(1\s*h|une heure|an hour|one hour)\b/.test(ctx.norm) ? 60 : 30
  return {
    say: both((l) => (l === 'fr'
      ? `C’est calé pour ${fmtDate(start, 'fr')} à ${fmtTime(start, 'fr')}. L’équipe la retrouve ici, pas d’invitation à ouvrir.`
      : `Booked for ${fmtDate(start, 'en')} at ${fmtTime(start, 'en')}. The team finds it right here, no invite to open.`)),
    after: () => {
      get().push(ctx.pid, { id: uid('m'), kind: 'meeting', authorId: GEMINI_ID, at: Date.now(), visibility: ctx.visibility, title, start, durationMin, attendeeIds, guestEmails: guestEmails.length ? guestEmails : undefined })
      const cal = projectOf(ctx.pid)?.blocks.find((b) => b.type === 'calendar')
      if (cal?.type === 'calendar' && ctx.visibility.type === 'all') get().patchBlock(ctx.pid, cal.id, { events: [...cal.events, { id: uid('e'), title, start, durationMin, attendeeIds }] } as Partial<Block>)
    },
  }
}

function planDraftMail(ctx: Ctx, p: Project): Plan {
  const inbound = p.messages.filter((m): m is EmailMessage => m.kind === 'email' && m.direction === 'in' && canSee(m.visibility, ctx.viewer))
  const named = inbound.filter((m) => { const first = normalize(mailName(m.from).split(/\s+/)[0]); return first.length > 1 && new RegExp(`\\b${first}\\b`).test(ctx.norm) })
  const target = ctx.quote?.kind === 'email' && ctx.quote.direction === 'in' ? ctx.quote : (named[named.length - 1] ?? inbound[inbound.length - 1])
  const external = p.externalIds.map(personById).find((x) => x.email && new RegExp(`\\b${normalize(x.name.split(/\s+/)[0])}\\b`).test(ctx.norm))
  const typed = ctx.plain.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0]
  const to = typed ?? (external && !named.length ? external.email : target?.from)
  if (!to) return { say: { fr: 'Aucun mail n’est encore arrivé sur ce projet, et je n’ai pas d’adresse pour écrire. Donne-moi un nom ou une adresse, et je prépare le brouillon.', en: 'No mail has reached this project yet, and I have no address to write to. Give me a name or an address and I’ll prepare the draft.' } }
  const name = mailName(to).split(/\s+/)[0]
  const me = firstName(ctx.viewer)
  const subject: Txt = target && to === target.from
    ? both((l) => { const s = tx(target.subject, l); return /^re\s*:/i.test(s) ? s : `Re: ${s}` })
    : { fr: `Projet ${tx(p.name, 'fr')}`, en: `${tx(p.name, 'en')} project` }
  const ms = nextMilestone(p)
  const body = both((l) => {
    const about = target && to === target.from ? tx(target.subject, l) : tx(p.name, l)
    return l === 'fr'
      ? `Bonjour ${name},\n\nMerci pour votre message au sujet de « ${about} ». Nous l’avons bien reçu et l’équipe s’en occupe.${ms ? ` Notre prochaine étape est ${tx(ms.label, 'fr')}, le ${fmtDate(ms.end, 'fr')} : je reviens vers vous d’ici là.` : ' Je reviens vers vous très vite.'}\n\nBien à vous,\n${me}`
      : `Hi ${name},\n\nThanks for your message about "${about}". We received it and the team is on it.${ms ? ` Our next step is ${tx(ms.label, 'en')}, on ${fmtDate(ms.end, 'en')}: I’ll get back to you before then.` : ' I’ll get back to you very soon.'}\n\nBest,\n${me}`
  })
  return {
    say: both((l) => (l === 'fr' ? `Le brouillon pour ${name} est prêt juste en dessous. Toi seul le vois tant qu’il n’est pas envoyé.` : `The draft for ${name} is ready just below. Only you can see it until it is sent.`)),
    after: () => get().push(ctx.pid, { id: uid('m'), kind: 'email', direction: 'out', authorId: GEMINI_ID, at: Date.now(), visibility: { type: 'private', with: [ctx.viewer, GEMINI_ID] }, subject, body, from: p.address, to, quoteId: target?.id }),
  }
}

function planRecap(ctx: Ctx, p: Project): Plan {
  const open = openTodos(p); const ms = nextMilestone(p); const meeting = nextMeeting(p, ctx.viewer)
  const script = p.script?.catchUp
  const text: Txt = script?.text ?? both((l) => (l === 'fr'
    ? `Voici où en est ${tx(p.name, 'fr')}.`
    : `Here is where ${tx(p.name, 'en')} stands.`))
  const bullets: Txt[] = script?.bullets ?? [
    both((l) => (l === 'fr' ? `${plural(open.length, 'fr', 'tâche ouverte', '')}, ${plural(todosOf(p).length - open.length, 'fr', 'terminée', '')}.` : `${plural(open.length, 'en', '', 'open to-do')}, ${todosOf(p).length - open.length} done.`)),
    ...(ms ? [both((l) => (l === 'fr' ? `Prochaine étape : ${tx(ms.label, 'fr')}, le ${fmtDate(ms.end, 'fr')}.` : `Next step: ${tx(ms.label, 'en')}, on ${fmtDate(ms.end, 'en')}.`))] : []),
    ...(meeting ? [both((l) => (l === 'fr' ? `Prochaine réunion : ${tx(meeting.title, 'fr')}, le ${fmtDate(meeting.start, 'fr')}.` : `Next meeting: ${tx(meeting.title, 'en')}, on ${fmtDate(meeting.start, 'en')}.`))] : []),
    ...(!ms && !meeting ? [{ fr: 'Pas encore de date ni de réunion : je peux poser une frise ou caler un point.', en: 'No dates or meetings yet: I can build a timeline or book a sync.' }] : []),
  ]
  const block = p.blocks.find((b) => b.type === 'summary')
  const say = both((l) => `${tx(text, l)}\n${bullets.map((b) => `- ${tx(b, l)}`).join('\n')}${block ? `\n${tx(boardLink(block.id), l)}` : ''}`)
  return {
    before: () => {
      if (block) {
        get().patchBlock(ctx.pid, block.id, { text, bullets, updatedAt: Date.now(), fresh: true } as Partial<Block>)
        setTimeout(() => get().patchBlock(ctx.pid, block.id, { fresh: false }), 1800)
      } else if (ctx.owner) {
        get().addBlock(ctx.pid, { id: uid('b'), type: 'summary', title: { fr: 'Où on en est', en: 'Where things stand' }, span: 3, text, bullets, updatedAt: Date.now() })
      }
    },
    say,
  }
}

function planAboutQuote(quote: Message): Plan {
  const name = quote.kind === 'email' ? mailName(quote.from) : firstName(quote.authorId)
  const excerpt = both((l) => oneLine(snippet(quote, l), 160))
  const link = both((l) => `[${l === 'fr' ? 'Voir le message' : 'See the message'}](op:msg/${quote.id})`)
  if (quote.kind === 'email') {
    return { say: both((l) => (l === 'fr'
      ? `C’est un mail de ${name}, sujet **${tx(quote.subject, 'fr')}**. L’essentiel : ${excerpt.fr} Je peux préparer une réponse ou en faire une tâche. ${link.fr}`
      : `This is a mail from ${name}, subject **${tx(quote.subject, 'en')}**. The gist: ${excerpt.en} I can draft a reply or turn it into a to-do. ${link.en}`)) }
  }
  return { say: both((l) => (l === 'fr'
    ? `${name} dit en substance : « ${excerpt.fr} » Je peux en faire une tâche, un point dans un brief, ou le mettre à l’ordre du jour de la prochaine réunion. ${link.fr}`
    : `${name} is essentially saying: "${excerpt.en}" I can turn it into a to-do, a point in a brief, or an item for the next meeting. ${link.en}`)) }
}

function planFallback(ctx: Ctx, p: Project): Plan {
  const n = ctx.norm
  const open = openTodos(p); const ms = nextMilestone(p); const meeting = nextMeeting(p, ctx.viewer)
  if (/\b(to-?dos?|taches?|tasks?|a faire|reste)\b/.test(n)) {
    return { say: open.length
      ? both((l) => (l === 'fr' ? `Il reste ${plural(open.length, 'fr', 'tâche ouverte', '')} :` : `There ${open.length > 1 ? 'are' : 'is'} ${plural(open.length, 'en', '', 'open to-do')}:`) + `\n${open.slice(0, 4).map((t) => `- ${tx(t.text, l)}${t.assigneeId ? ` (${firstName(t.assigneeId)})` : ''}`).join('\n')}\n${tx(boardLink(p.blocks.find((b) => b.type === 'todo')?.id), l)}`)
      : { fr: 'Aucune tâche ouverte sur ce projet. Dis-moi quoi ajouter, je m’en occupe.', en: 'No open to-dos on this project. Tell me what to add and I’ll take care of it.' } }
  }
  if (/\b(quand|when|prochaine?|next|date|jalon|milestone|deadline|echeance)\b/.test(n)) {
    if (!ms && !meeting) return { say: { fr: 'Aucune date posée pour l’instant. Veux-tu que je construise une frise ou que je cale une réunion ?', en: 'No dates set so far. Shall I build a timeline or book a meeting?' } }
    return { say: both((l) => [
      ms ? (l === 'fr' ? `Prochaine étape : **${tx(ms.label, 'fr')}**, le ${fmtDate(ms.end, 'fr')}.` : `Next step: **${tx(ms.label, 'en')}**, on ${fmtDate(ms.end, 'en')}.`) : '',
      meeting ? (l === 'fr' ? `Prochaine réunion : **${tx(meeting.title, 'fr')}**, le ${fmtDate(meeting.start, 'fr')} à ${fmtTime(meeting.start, 'fr')}.` : `Next meeting: **${tx(meeting.title, 'en')}**, on ${fmtDate(meeting.start, 'en')} at ${fmtTime(meeting.start, 'en')}.`) : '',
    ].filter(Boolean).join('\n')) }
  }
  if (/\b(qui|who|equipe|team|membres?|members?)\b/.test(n)) {
    const names = p.memberIds.filter((m) => m !== GEMINI_ID).map((m) => personById(m).name).join(', ')
    return { say: both((l) => (l === 'fr' ? `Sur ce projet : ${names}. Le board est décidé par ${ownerName(p)}.` : `On this project: ${names}. ${ownerName(p)} decides what goes on the board.`)) }
  }
  if (/\b(fichiers?|files?|docs?|documents?|pieces? jointes?|attachments?)\b/.test(n)) {
    return { say: p.artifacts.length
      ? both((l) => (l === 'fr' ? `${plural(p.artifacts.length, 'fr', 'fichier', '')} dans le projet :` : `${plural(p.artifacts.length, 'en', '', 'file')} in this project:`) + `\n${p.artifacts.slice(0, 5).map((a) => `- [${tx(a.title, l)}](op:artifact/${a.id})`).join('\n')}`)
      : { fr: 'Aucun fichier dans ce projet pour l’instant. Je peux rédiger un premier brief, si tu veux.', en: 'No files in this project yet. I can draft a first brief if you like.' } }
  }
  return { say: both((l) => {
    const facts = l === 'fr'
      ? `Sur **${tx(p.name, 'fr')}** : ${plural(open.length, 'fr', 'tâche ouverte', '')}, ${plural(p.artifacts.length, 'fr', 'fichier', '')}${ms ? `, prochaine étape ${tx(ms.label, 'fr')} le ${fmtDate(ms.end, 'fr')}` : ''}.`
      : `On **${tx(p.name, 'en')}**: ${plural(open.length, 'en', '', 'open to-do')}, ${plural(p.artifacts.length, 'en', '', 'file')}${ms ? `, next step ${tx(ms.label, 'en')} on ${fmtDate(ms.end, 'en')}` : ''}.`
    const offer = l === 'fr'
      ? 'Je peux faire le point, ajouter une tâche, poser une frise ou un sondage sur le board, rédiger un brief, caler une réunion ou préparer une réponse à un mail. Que préfères-tu ?'
      : 'I can recap, add a to-do, put a timeline or a poll on the board, draft a brief, book a meeting or prepare a reply to a mail. What would you like?'
    return `${facts}\n${offer}`
  }) }
}

function decide(ctx: Ctx, p: Project): Plan {
  const n = ctx.norm
  if (isReply(n)) return planDraftMail(ctx, p)
  if (isAddTodo(n)) return planTodo(ctx, p)
  if (isMove(n)) return planMove(ctx, p)
  if (isDoc(n)) return planDoc(ctx, p)
  const block = wantedBlock(n)
  if (block) return planBlock(block, ctx, p)
  if (isMeeting(n) && !(n.includes('?') && /\b(quand|when|prochaine?|next)\b/.test(n))) return planMeeting(ctx, p)
  if (ctx.quote && (isRecap(n) || !n.trim())) return planAboutQuote(ctx.quote)
  if (isRecap(n)) return planRecap(ctx, p)
  if (/^(ajoute\w*|add)\b/.test(n)) return planTodo(ctx, p)
  if (ctx.quote) return planAboutQuote(ctx.quote)
  return planFallback(ctx, p)
}

/* ---------------- streaming and sequencing ---------------- */
const queues = new Map<string, Promise<void>>()
const inFlight = new Set<string>()
const TOKENS = /@?\[[^\]]*\]\([^)]*\)\s*|\*\*[^*]+\*\*\s*|\S+\s*|\s+/g
const tokens = (s: string) => s.match(TOKENS) ?? []
const stillThere = (ctx: Ctx, mid: string) => { const p = projectOf(ctx.pid); return !!p && !!findMessage(p, mid) }

async function streamInto(ctx: Ctx, mid: string, say: Txt) {
  const full: L = typeof say === 'string' ? { fr: say, en: say } : say
  const fr = tokens(full.fr); const en = tokens(full.en)
  const words = Math.max(fr.length, en.length)
  const duration = Math.min(1500, Math.max(1000, 800 + words * 14))
  const tick = 45
  const steps = Math.max(1, Math.floor(duration / tick))
  for (let i = 1; i <= steps; i++) {
    if (!stillThere(ctx, mid)) return false
    updateMessage(ctx.pid, mid, { text: { fr: fr.slice(0, Math.ceil((fr.length * i) / steps)).join(''), en: en.slice(0, Math.ceil((en.length * i) / steps)).join('') } } as Partial<Message>)
    await sleep(tick)
  }
  if (!stillThere(ctx, mid)) return false
  updateMessage(ctx.pid, mid, { text: say, streaming: false } as Partial<Message>)
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
    if (stillThere(ctx, mid)) updateMessage(ctx.pid, mid, { text: { fr: 'Je n’ai pas réussi à le faire. Peux-tu reformuler ?', en: 'I couldn’t do that. Could you rephrase?' }, streaming: false } as Partial<Message>)
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
    updateMessage(pid, m.id, (empty ? { streaming: false, text: { fr: 'Réponse interrompue. Demande-moi à nouveau.', en: 'Answer interrupted. Please ask me again.' } } : { streaming: false }) as Partial<Message>)
  }
  for (const p of s.projects) for (const m of p.messages) { fix(p.id, m); for (const r of m.replies ?? []) fix(p.id, r) }
}
