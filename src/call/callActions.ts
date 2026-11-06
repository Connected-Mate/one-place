/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The call's life cycle: everything that must survive the stage being unmounted
// (switching project, reload) lives here, not in a component.
import { create } from 'zustand'
import { useChat } from '../chat/chatState'
import { people } from '../data/seed'
import type { Block, CallState, CallSummaryMessage, MeetingMessage, Message, PaneView, Person, Project, ProjectScript, Todo, Txt } from '../data/types'
import { tx } from '../i18n'
import { GEMINI_ID, personById, roleIn, uid, useStore } from '../store'
import { stopMedia } from './media'
import { playSound, stopLoop, unlockSounds } from './sounds'
import { stopVoice, unlockAudio } from './voice'

const INVITE_JOIN_MS = 2200
const WRITEUP_MS = 2400
const SAVED_KEY = 'one-place-call'
const OWN_LIVE_PREFIX = 'mcall-'
const WRITEUP_PREFIX = 'call-writeup-'

/** State of the call that only the call module needs. */
interface CallUi {
  hand: boolean
  captionLine: number
  pendingInvites: { name: string; email: string }[]
  writingUp: number
  /** cameras turned on so far: everyone arrives with theirs off */
  camsOn: string[]
  /** people who have dropped off at the end of the meeting */
  leftIds: string[]
  /** a 1:1 call nobody picks up: see startRinging */
  ring: { phase: 'ringing' | 'noanswer'; attempt: number; posted: boolean } | null
}
export const useCallUi = create<CallUi>(() => ({ hand: false, captionLine: 0, pendingInvites: [], writingUp: 0, camsOn: [], leftIds: [], ring: null }))

const FRESH_CALL = { hand: false, captionLine: 0, pendingInvites: [], camsOn: [], leftIds: [], ring: null }

let callTimers: ReturnType<typeof setTimeout>[] = []
const clearCallTimers = () => { callTimers.forEach(clearTimeout); callTimers = [] }

const both = (v: Txt, fn: (text: string, lang: 'fr' | 'en') => string): Txt => ({ fr: fn(tx(v, 'fr'), 'fr'), en: fn(tx(v, 'en'), 'en') })
const projectById = (id: string) => useStore.getState().projects.find((p) => p.id === id)
const isHuman = (id: string) => personById(id).role !== 'ai'

/** The project's script, or sensible words when a project (a new one, say) has none. */
export function scriptFor(project: Project, viewerId: string): Pick<ProjectScript, 'callTitle' | 'captions' | 'callSummary'> {
  if (project.script) return project.script
  const others = project.memberIds.filter((id) => id !== viewerId && isHuman(id)).slice(0, 2)
  const captions: ProjectScript['captions'] = []
  if (others[0]) captions.push({ who: others[0], text: { fr: 'Bonjour à tous, je vous entends bien.', en: 'Hi everyone, I can hear you fine.' } })
  if (others[1]) captions.push({ who: others[1], text: { fr: 'Parfait. On fait un point rapide sur la suite ?', en: 'Great. Shall we do a quick check on next steps?' } })
  return {
    callTitle: both(project.name, (name, lang) => (lang === 'fr' ? `Appel : ${name}` : `Call: ${name}`)),
    captions,
    callSummary: {
      summary: { fr: 'Appel court, sans décision formelle.', en: 'A short call, with no formal decision.' },
      decisions: [],
      todos: [{ text: { fr: 'Partager les prochaines étapes dans le chat', en: 'Share the next steps in the chat' }, assigneeId: project.ownerId }],
    },
  }
}

const liveMeetingOf = (project: Project | undefined): MeetingMessage | undefined =>
  project?.messages.slice().reverse().find((m): m is MeetingMessage => m.kind === 'meeting' && !!m.live && !m.ended)

/** Who is expected to join: the team, plus anyone who speaks in the script. */
export const expectedIds = (project: Project, viewerId: string, captions: { who: string }[]) =>
  [...new Set([...project.memberIds, ...captions.map((c) => c.who)])].filter((id) => id !== viewerId && isHuman(id))

function setPaneFor(projectId: string, view: PaneView) {
  const s = useStore.getState()
  if (s.activeProjectId === projectId) s.setPane(view)
  else useStore.setState({ panes: { ...s.panes, [projectId]: view } })
}
function openCallPane(projectId: string) {
  const s = useStore.getState()
  if (s.activeProjectId !== projectId) s.selectProject(projectId)
  useStore.getState().setPane({ type: 'call' })
}

/** Arrivals are part of the call's timeline, see openings.ts. */
export function joinParticipants(ids: string[]) {
  const { call, patchCall } = useStore.getState()
  if (!call) return
  const fresh = ids.filter((id) => !call.participantIds.includes(id))
  if (fresh.length) patchCall({ participantIds: [...call.participantIds, ...fresh] })
}

/* ---- A 1:1 with a real person: their voice is never synthesized, so they simply don't pick up. ---- */
const REAL_PEOPLE = ['alex', 'damien']
const RING_MS = 13500
const offeredHelp = new Set<string>()

export function unansweredPeer(project: Project, viewerId: string): string | null {
  if (project.memberIds.length !== 2 || !project.memberIds.includes(viewerId)) return null
  const other = project.memberIds.find((id) => id !== viewerId)!
  return REAL_PEOPLE.includes(other) ? other : null
}

function postMissedCall(projectId: string, peerId: string) {
  const ui = useCallUi.getState()
  if (!ui.ring || ui.ring.posted) return
  useCallUi.setState({ ring: { ...ui.ring, posted: true } })
  const s = useStore.getState()
  const first = personById(peerId).name.split(' ')[0]
  s.push(projectId, {
    id: uid('m'), kind: 'system', authorId: s.viewerId, at: Date.now(), visibility: { type: 'all' }, icon: 'call_end',
    text: { fr: `Appel manqué : ${first} n’a pas répondu.`, en: `Missed call: ${first} didn’t answer.` },
  })
  if (offeredHelp.has(projectId)) return
  offeredHelp.add(projectId)
  s.push(projectId, {
    id: uid('m'), kind: 'text', authorId: GEMINI_ID, at: Date.now() + 1, visibility: { type: 'all' },
    text: { fr: 'Je lui dis de quoi il s’agit ?', en: 'Want me to tell him what it’s about?' },
  })
}

function ringFor(projectId: string, peerId: string, attempt: number) {
  useCallUi.setState({ ring: { phase: 'ringing', attempt, posted: false } })
  callTimers.push(setTimeout(() => {
    const ui = useCallUi.getState()
    if (!ui.ring || useStore.getState().call?.projectId !== projectId) return
    postMissedCall(projectId, peerId)
    useCallUi.setState((u) => ({ ring: u.ring && { ...u.ring, phase: 'noanswer' } }))
  }, RING_MS))
}

function startRinging(project: Project, peerId: string) {
  const s = useStore.getState()
  useCallUi.setState(FRESH_CALL)
  s.setCall({
    projectId: project.id, title: { fr: `Appel de ${personById(peerId).name.split(' ')[0]}`, en: `Calling ${personById(peerId).name.split(' ')[0]}` },
    startedAt: Date.now(), participantIds: [s.viewerId], guests: [], mic: true, cam: true, captions: false, sharing: false,
  })
  openCallPane(project.id)
  s.markTour('call')
  ringFor(project.id, peerId, 1)
}

export function callAgain() {
  const s = useStore.getState()
  const ui = useCallUi.getState()
  const project = s.call && projectById(s.call.projectId)
  const peer = project && unansweredPeer(project, s.viewerId)
  if (!project || !peer || ui.ring?.phase !== 'noanswer') return // double click safe
  unlockAudio()
  unlockSounds()
  ringFor(project.id, peer, ui.ring.attempt + 1)
}

/** Back to the chat, with the composer ready. */
export function leaveNote() {
  const s = useStore.getState()
  const projectId = s.call?.projectId
  endCall()
  if (!projectId) return
  useStore.getState().setMobilePane('chat')
  useChat.getState().focusComposer()
}

export function startCall(projectId: string) {
  const s = useStore.getState()
  const project = projectById(projectId)
  if (!project || roleIn(project, s.viewerId) === 'guest') return
  unlockAudio() // we are inside the click: sound can then play on its own
  unlockSounds()
  if (s.call?.projectId === projectId) { // already running here: rejoin, nothing else
    openCallPane(projectId)
    s.markTour('call')
    return
  }
  if (s.call) endCall() // running elsewhere: that call gets its one summary, then we move on
  playSound('enter')
  const peer = unansweredPeer(project, s.viewerId)
  if (peer) { startRinging(project, peer); return }

  const now = Date.now()
  const script = scriptFor(project, s.viewerId)
  const existing = liveMeetingOf(project)
  const title = existing?.title ?? script.callTitle
  const expected = expectedIds(project, s.viewerId, script.captions)
  useCallUi.setState(FRESH_CALL)
  s.setCall({ projectId, title, startedAt: now, participantIds: [s.viewerId], guests: [], mic: true, cam: true, captions: true, sharing: false })
  openCallPane(projectId)
  if (!existing) {
    const message: MeetingMessage = {
      id: uid(OWN_LIVE_PREFIX), kind: 'meeting', authorId: s.viewerId, at: now, visibility: { type: 'all' },
      title, start: now, durationMin: 30, attendeeIds: [s.viewerId, ...expected], live: true,
    }
    s.push(projectId, message)
  }
  s.markTour('call')
}

/** Bring the view back to the running call, wherever the user went. */
export function returnToCall() {
  const { call } = useStore.getState()
  if (!call) return
  unlockAudio()
  unlockSounds()
  openCallPane(call.projectId)
}

export function endCall() {
  const s = useStore.getState()
  const call = s.call
  if (!call) return // second click on hang-up: nothing left to do
  clearCallTimers()
  stopVoice()
  stopLoop()
  stopMedia()
  playSound('hangup')
  const ring = useCallUi.getState().ring
  if (ring) { // nobody picked up: a missed call, not a meeting. No summary, no to-dos.
    const project = projectById(call.projectId)
    const peer = project && unansweredPeer(project, s.viewerId)
    if (peer) postMissedCall(call.projectId, peer)
    s.setCall(null)
    useCallUi.setState(FRESH_CALL)
    if (s.panes[call.projectId]?.type === 'call') setPaneFor(call.projectId, { type: 'board' })
    return
  }
  s.setCall(null)
  useCallUi.setState(FRESH_CALL)
  if (s.panes[call.projectId]?.type === 'call') setPaneFor(call.projectId, { type: 'board' })

  const project = projectById(call.projectId)
  const meeting = liveMeetingOf(project)
  if (!meeting) return
  s.patch(call.projectId, meeting.id, {
    live: false, ended: true,
    durationMin: Math.max(1, Math.round((Date.now() - call.startedAt) / 60000)),
    attendeeIds: call.participantIds,
    guestEmails: [...new Set([...(meeting.guestEmails ?? []), ...call.guests.map((g) => g.email)])],
  } as Partial<Message>)
  const writeupId = WRITEUP_PREFIX + meeting.id
  s.push(call.projectId, {
    id: writeupId, kind: 'system', authorId: GEMINI_ID, at: Date.now(), visibility: { type: 'all' }, streaming: true, icon: 'auto_awesome',
    text: { fr: 'Gemini rédige le compte rendu de l’appel…', en: 'Gemini is writing up the call…' },
  })
  useCallUi.setState((u) => ({ writingUp: u.writingUp + 1 }))
  // Not a call timer: the write-up must arrive even if another call starts meanwhile.
  setTimeout(() => {
    useCallUi.setState((u) => ({ writingUp: Math.max(0, u.writingUp - 1) }))
    finishWriteup(call.projectId, meeting.id)
  }, WRITEUP_MS)
}

function firstTodoBlockId(projectId: string): string {
  const s = useStore.getState()
  const found = projectById(projectId)?.blocks.find((b) => b.type === 'todo')
  if (found) return found.id
  const id = uid('b')
  s.addBlock(projectId, { id, type: 'todo', title: { fr: 'À faire', en: 'To do' }, span: 1, todos: [] })
  return id
}

/** Gemini's fresh "where things stand" reflects what the call just decided. */
function refreshBoardSummary(projectId: string, summary: Txt, decisions: Txt[], todoCount: number) {
  const s = useStore.getState()
  const patch = {
    text: summary,
    bullets: [
      ...decisions.slice(0, 3),
      ...(todoCount ? [{
        fr: todoCount > 1 ? `${todoCount} tâches ajoutées à la liste` : '1 tâche ajoutée à la liste',
        en: todoCount > 1 ? `${todoCount} to-dos added to the list` : '1 to-do added to the list',
      }] : []),
    ],
    updatedAt: Date.now(),
  }
  const blocks = projectById(projectId)?.blocks ?? []
  const existing = blocks.find((b) => b.type === 'summary')
  if (existing) {
    s.patchBlock(projectId, existing.id, { ...patch, fresh: true } as Partial<Block>)
    setTimeout(() => useStore.getState().patchBlock(projectId, existing.id, { fresh: false }), 1800)
    return
  }
  const id = uid('b')
  s.addBlock(projectId, { id, type: 'summary', title: { fr: 'Où on en est', en: 'Where things stand' }, span: 3, ...patch })
  s.moveBlock(projectId, id, -blocks.length)
}

function finishWriteup(projectId: string, meetingId: string) {
  const s = useStore.getState()
  const project = projectById(projectId)
  const writeupId = WRITEUP_PREFIX + meetingId
  const writeup = project?.messages.find((m) => m.id === writeupId)
  const meeting = project?.messages.find((m): m is MeetingMessage => m.id === meetingId && m.kind === 'meeting')
  if (!project || !writeup?.streaming || !meeting) return // already done, or the demo was reset

  const { summary, decisions, todos } = scriptFor(project, meeting.authorId).callSummary
  const blockId = firstTodoBlockId(projectId)
  const added: Todo[] = todos.map((t) => ({ id: uid('t'), text: t.text, assigneeId: t.assigneeId, done: false, source: meeting.title }))
  // addTodo puts each one on top: go backwards to keep the order Gemini wrote them in.
  added.slice().reverse().forEach((t) => s.addTodo(projectId, blockId, t))

  const final: Partial<CallSummaryMessage> = {
    kind: 'call-summary', title: meeting.title, durationMin: meeting.durationMin, attendeeIds: meeting.attendeeIds,
    summary, decisions, todoIds: added.map((t) => t.id), streaming: false, at: Date.now(),
  }
  s.patch(projectId, writeupId, final as Partial<Message>)
  refreshBoardSummary(projectId, summary, decisions, added.length)
  s.toast({
    icon: 'task_alt',
    text: {
      fr: added.length > 1 ? `Résumé publié, ${added.length} tâches` : added.length === 1 ? 'Résumé publié, 1 tâche' : 'Résumé publié',
      en: added.length > 1 ? `Summary posted, ${added.length} to-dos` : added.length === 1 ? 'Summary posted, 1 to-do' : 'Summary posted',
    },
    action: {
      label: { fr: 'Voir', en: 'View' },
      run: () => {
        const st = useStore.getState()
        if (st.activeProjectId !== projectId) st.selectProject(projectId)
        useStore.getState().setPane({ type: 'board' })
      },
    },
  })
}

/* ---- Inviting someone for this call only ---- */
const GUEST_HUES = ['#00796b', '#c2185b', '#5e35b1', '#ef6c00', '#00838f', '#6d4c41', '#3949ab', '#558b2f']
/** A guest as a person the stage can draw. People we already know keep their face. */
export function guestAsPerson(g: { name: string; email: string }): Person {
  const known = people.find((p) => p.email.toLowerCase() === g.email.toLowerCase())
  if (known) return known
  const hash = [...g.email].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  return { id: `guest:${g.email}`, name: g.name, title: '', email: g.email, hue: GUEST_HUES[hash % GUEST_HUES.length], role: 'guest', presence: 'online' }
}

export type InviteErrors = { name?: Txt; email?: Txt }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateInvite(rawName: string, rawEmail: string): InviteErrors {
  const errors: InviteErrors = {}
  const name = rawName.trim()
  const email = rawEmail.trim().toLowerCase()
  if (!name) errors.name = { fr: 'Indiquez un nom.', en: 'Enter a name.' }
  else if (name.length < 2 || !/\p{L}/u.test(name)) errors.name = { fr: 'Ce nom paraît incomplet.', en: 'This name looks incomplete.' }
  if (!email) errors.email = { fr: 'Indiquez une adresse e-mail.', en: 'Enter an email address.' }
  else if (!EMAIL.test(email)) errors.email = { fr: 'Cette adresse n’est pas valide, par exemple : prenom@societe.com', en: 'This address is not valid, for example: name@company.com' }
  else {
    const s = useStore.getState()
    const call = s.call
    const project = call && projectById(call.projectId)
    if (call && project) {
      const same = (e: string) => e.toLowerCase() === email
      const idsInCall = new Set([...project.memberIds, ...call.participantIds, s.viewerId])
      if (call.guests.some((g) => same(g.email)) || useCallUi.getState().pendingInvites.some((g) => same(g.email))) {
        errors.email = { fr: 'Cette personne est déjà invitée à cet appel.', en: 'This person is already invited to this call.' }
      } else if ([...idsInCall].some((id) => same(personById(id).email))) {
        errors.email = { fr: 'Cette personne fait déjà partie de l’appel.', en: 'This person is already part of this call.' }
      }
    }
  }
  return errors
}

/** Sends the (fake) invitation. Returns the errors if it was refused. */
export function inviteGuest(rawName: string, rawEmail: string): InviteErrors | null {
  const errors = validateInvite(rawName, rawEmail)
  if (errors.name || errors.email) return errors
  const s = useStore.getState()
  const call = s.call
  if (!call) return null
  const guest = { name: rawName.trim(), email: rawEmail.trim().toLowerCase() }
  useCallUi.setState((u) => ({ pendingInvites: [...u.pendingInvites, guest] }))
  s.toast({ icon: 'mail', text: { fr: `${guest.name} invité`, en: `${guest.name} invited` } })
  callTimers.push(setTimeout(() => {
    const st = useStore.getState()
    useCallUi.setState((u) => ({ pendingInvites: u.pendingInvites.filter((g) => g.email !== guest.email) }))
    if (st.call?.startedAt !== call.startedAt) return
    st.patchCall({ guests: [...st.call.guests, guest] })
    st.push(call.projectId, {
      id: uid('m'), kind: 'system', authorId: st.viewerId, at: Date.now(), visibility: { type: 'all' }, icon: 'videocam',
      text: {
        fr: `${guest.name} a rejoint cet appel uniquement. Pas d’accès au chat, au board ni aux documents.`,
        en: `${guest.name} joined this call only. No access to the chat, the board or the documents.`,
      },
    })
  }, INVITE_JOIN_MS))
  return null
}

/** A believable, stable meeting link. */
export function callLink(startedAt: number) {
  const code = startedAt.toString(36).padStart(10, 'a').slice(-10)
  return `https://oneplace.example/call/${code.slice(0, 3)}-${code.slice(3, 7)}-${code.slice(7)}`
}

export async function copyCallLink(startedAt: number) {
  const link = callLink(startedAt)
  const { toast } = useStore.getState()
  try {
    await navigator.clipboard.writeText(link)
    toast({ icon: 'link', text: { fr: 'Lien copié', en: 'Link copied' } })
  } catch { // clipboard refused: still give the link, in plain sight
    toast({ icon: 'link', text: link })
  }
}

/* ---- Reload: `call` is not in the persisted state, so it is kept for this tab here. ---- */
function saveCall() {
  try {
    const call = useStore.getState().call
    if (call) sessionStorage.setItem(SAVED_KEY, JSON.stringify({ call, line: useCallUi.getState().captionLine, camsOn: useCallUi.getState().camsOn, leftIds: useCallUi.getState().leftIds }))
    else sessionStorage.removeItem(SAVED_KEY)
  } catch { /* private mode: the call just won't survive a reload */ }
}
function readSavedCall(): { call: CallState; line: number; camsOn?: string[]; leftIds?: string[] } | null {
  try {
    const raw = sessionStorage.getItem(SAVED_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function restoreOrSweep() {
  const s = useStore.getState()
  if (s.call) return // hot reload of this module during development
  const saved = readSavedCall()
  const savedProject = saved && projectById(saved.call.projectId)
  if (saved && savedProject && liveMeetingOf(savedProject)) {
    useCallUi.setState({ captionLine: saved.line ?? 0, camsOn: saved.camsOn ?? [], leftIds: saved.leftIds ?? [] })
    s.setCall(saved.call)
  }
  for (const p of useStore.getState().projects) {
    for (const m of p.messages) {
      // A tab closed in mid-call must not leave a "live" card behind for ever.
      if (m.kind === 'meeting' && m.live && !m.ended && m.id.startsWith(OWN_LIVE_PREFIX) && useStore.getState().call?.projectId !== p.id) {
        s.patch(p.id, m.id, { live: false, ended: true, durationMin: m.durationMin || 1 } as Partial<Message>)
      }
      // A reload during the write-up must not lose the summary and its to-dos.
      if (m.kind === 'system' && m.streaming && m.id.startsWith(WRITEUP_PREFIX)) finishWriteup(p.id, m.id.slice(WRITEUP_PREFIX.length))
    }
    if (useStore.getState().panes[p.id]?.type === 'call' && useStore.getState().call?.projectId !== p.id) {
      useStore.setState((st) => ({ panes: { ...st.panes, [p.id]: { type: 'board' } } }))
    }
  }
}

restoreOrSweep()
useStore.subscribe((s, prev) => {
  if (s.call === prev.call) return
  saveCall()
  if (!s.call) { // also covers the demo's reset, which clears the call without going through endCall
    clearCallTimers()
    useCallUi.setState(FRESH_CALL)
  }
})
useCallUi.subscribe((u, prev) => { if (u.captionLine !== prev.captionLine || u.camsOn !== prev.camsOn || u.leftIds !== prev.leftIds) saveCall() })
