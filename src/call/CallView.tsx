/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CallState, MeetingMessage, Project, Txt } from '../data/types'
import { fmtDay, fmtTime, useT } from '../i18n'
import { personById, ME_ID, paneOf, useStore, useViewer } from '../store'
import { Avatar, AvatarStack, Button, Icon, Sparkle } from '../ui/kit'
import { Logo } from '../ui/Logo'
import { endCall, expectedIds, guestAsPerson, returnToCall, scriptFor, startCall, useCallUi } from './callActions'
import { InviteDialog } from './InviteDialog'
import { setCamera, setMicrophone, useLiveMedia } from './media'
import { unlockAudio } from './voice'
import { CtlButton, MediaNotice, Stage, Tile, useElapsed, type CaptionLine, type StagePerson } from './Stage'
import './call.css'

/* ---- The call inside the project ---- */
function ProjectStage({ call, project }: { call: CallState; project: Project }) {
  const viewerId = useStore((s) => s.viewerId)
  const patchCall = useStore((s) => s.patchCall)
  const toast = useStore((s) => s.toast)
  const hand = useCallUi((u) => u.hand)
  const line = useCallUi((u) => u.captionLine)
  const pending = useCallUi((u) => u.pendingInvites.length)
  const [inviting, setInviting] = useState(false)
  const closeInvite = useCallback(() => setInviting(false), [])
  const script = scriptFor(project, viewerId)
  const doc = project.artifacts.find((a) => a.kind === 'doc') ?? project.artifacts[0]

  const people = useMemo<StagePerson[]>(() => {
    const ids = call.participantIds.includes(viewerId) ? call.participantIds : [viewerId, ...call.participantIds]
    return [
      ...ids.map((id) => ({ person: personById(id), callOnly: !project.memberIds.includes(id) })),
      ...call.guests.map((g) => ({ person: guestAsPerson(g), callOnly: true })),
    ]
  }, [call.participantIds, call.guests, viewerId, project.memberIds])
  const expected = expectedIds(project, viewerId, script.captions)
  const waiting = expected.filter((id) => !call.participantIds.includes(id)).length + pending
  useLiveMedia(true, call.cam, call.mic, (what) => patchCall(what === 'cam' ? { cam: false } : { mic: false }))

  return (
    <>
      <Stage mode="project" title={call.title} startedAt={call.startedAt} selfId={viewerId} people={people} waiting={waiting}
        mic={call.mic} cam={call.cam} captions={call.captions} sharing={call.sharing} hand={hand} doc={doc}
        lines={script.captions} voicePrefix={project.id} line={line} onLine={(n) => useCallUi.setState({ captionLine: n })}
        onMic={() => { void setMicrophone(!call.mic); patchCall({ mic: !call.mic }) }}
        onCam={() => { void setCamera(!call.cam); patchCall({ cam: !call.cam }) }}
        onCaptions={() => patchCall({ captions: !call.captions })} onHand={() => useCallUi.setState({ hand: !hand })}
        onShare={() => {
          if (!doc) { toast({ icon: 'info', text: { fr: 'Aucun document à présenter.', en: 'No document to present yet.' } }); return }
          patchCall({ sharing: !call.sharing })
        }}
        onInvite={() => setInviting(true)} onHangUp={endCall} />
      {inviting && <InviteDialog startedAt={call.startedAt} onClose={closeInvite} />}
    </>
  )
}

export function CallView() {
  const t = useT()
  const call = useStore((s) => s.call)
  const project = useStore((s) => s.projects.find((p) => p.id === s.activeProjectId))
  const setPane = useStore((s) => s.setPane)
  if (call && project && call.projectId === project.id) return <ProjectStage key={call.startedAt} call={call} project={project} />
  // Pane left on "call" while nothing runs here: say so rather than show an empty stage.
  return (
    <div className="cv-stage cv-empty">
      <Icon name="videocam_off" size={40} />
      <p>{t({ fr: 'Aucun appel en cours dans ce projet.', en: 'No call running in this project.' })}</p>
      <div className="cv-empty-actions">
        {project && <button type="button" className="cv-pill-primary" onClick={() => startCall(project.id)}>{t({ fr: 'Démarrer un appel', en: 'Start a call' })}</button>}
        <button type="button" className="cv-pill-ghost" onClick={() => setPane({ type: 'board' })}>{t({ fr: 'Retour au board', en: 'Back to the board' })}</button>
      </div>
    </div>
  )
}

/* ---- The small chip that keeps the call within reach when its stage is out of sight ---- */
function useNarrowWindow() {
  const [narrow, setNarrow] = useState(() => { try { return matchMedia('(max-width: 899px)').matches } catch { return false } })
  useEffect(() => {
    let mq: MediaQueryList
    try { mq = matchMedia('(max-width: 899px)') } catch { return }
    const change = () => setNarrow(mq.matches)
    mq.addEventListener('change', change)
    return () => mq.removeEventListener('change', change)
  }, [])
  return narrow
}

function ChipLive({ call }: { call: CallState }) {
  const t = useT()
  const elapsed = useElapsed(call.startedAt)
  return (
    <div className="cv-chip" role="group" aria-label={t({ fr: 'Appel en cours', en: 'Call in progress' })}>
      <span className="cv-chip-dot" aria-hidden="true" />
      <span className="cv-chip-name">{t(call.title)}</span>
      <span className="cv-chip-time" role="timer">{elapsed}</span>
      <button type="button" className="cv-chip-back" onClick={returnToCall}>{t({ fr: 'Revenir', en: 'Return' })}</button>
      <button type="button" className="cv-chip-end" aria-label={t({ fr: 'Quitter l’appel', en: 'Leave call' })} title={t({ fr: 'Quitter l’appel', en: 'Leave call' })} onClick={endCall}><Icon name="call_end" fill size={18} /></button>
    </div>
  )
}

export function CallChip() {
  const t = useT()
  const call = useStore((s) => s.call)
  const onStage = useStore((s) => !!s.call && s.activeProjectId === s.call.projectId && paneOf(s).type === 'call')
  const mobilePane = useStore((s) => s.mobilePane)
  const writingUp = useCallUi((u) => u.writingUp)
  const viewer = useViewer()
  const narrow = useNarrowWindow()
  if (viewer.role === 'guest') return null
  const stageVisible = onStage && (!narrow || mobilePane === 'pane')
  if (call && !stageVisible) return <ChipLive call={call} />
  if (!call && writingUp > 0) {
    return (
      <div className="cv-chip writing" role="status">
        <Sparkle size={16} />
        <span className="cv-chip-name">{t({ fr: 'Gemini rédige le compte rendu…', en: 'Gemini is writing up the call…' })}</span>
      </div>
    )
  }
  return null
}

/* ---- What a call-only guest gets: this, and nothing else ---- */
interface GuestMeeting { title: Txt; hostId: string; attendeeIds: string[]; start: number; live: boolean; project: Project }

function findGuestMeeting(projects: Project[], viewerId: string, viewerEmail: string, call: CallState | null): GuestMeeting | null {
  const email = viewerEmail.toLowerCase()
  const running = call && projects.find((p) => p.id === call.projectId)
  if (call && running && call.guests.some((g) => g.email.toLowerCase() === email)) {
    return { title: call.title, hostId: running.ownerId, attendeeIds: call.participantIds, start: call.startedAt, live: true, project: running }
  }
  const all: { m: MeetingMessage; p: Project }[] = []
  for (const p of projects) {
    for (const m of p.messages) {
      if (m.kind === 'meeting' && !m.ended && (m.attendeeIds.includes(viewerId) || m.guestEmails?.some((g) => g.toLowerCase() === email))) all.push({ m, p })
    }
  }
  const pick = all.sort((a, b) => Number(!!b.m.live) - Number(!!a.m.live) || a.m.start - b.m.start)[0]
  if (!pick) return null
  const author = personById(pick.m.authorId)
  return {
    title: pick.m.title,
    hostId: author.role === 'ai' || author.role === 'guest' ? pick.p.ownerId : pick.m.authorId,
    attendeeIds: pick.m.attendeeIds, start: pick.m.start, live: !!pick.m.live, project: pick.p,
  }
}

/** What a guest hears is generic on purpose: the project's script talks about things she must not see. */
const guestLines = (hostId: string, otherId: string | undefined, guestName: string): CaptionLine[] => [
  { who: hostId, text: { fr: `Bonjour ${guestName}, merci de nous rejoindre.`, en: `Hi ${guestName}, thanks for joining us.` } },
  ...(otherId ? [{ who: otherId, text: { fr: 'Bonjour ! On vous entend très bien.', en: 'Hello! We can hear you really well.' } }] : []),
  { who: hostId, text: { fr: 'On commence quand vous voulez. Vous avez une vingtaine de minutes ?', en: 'We can start whenever you like. Do you have about twenty minutes?' } },
]

function ViewAsAlex({ compact }: { compact?: boolean }) {
  const t = useT()
  const setViewer = useStore((s) => s.setViewer)
  const label = t({ fr: 'Démo : revenir à la vue d’Alex', en: 'Back to Alex’s view' })
  return (
    <button type="button" className={`cv-viewas${compact ? ' compact' : ''}`} aria-label={label} title={label} onClick={() => setViewer(ME_ID)}>
      <Icon name="visibility" size={16} /><span>{label}</span>
    </button>
  )
}

function GuestFrame({ children }: { children: React.ReactNode }) {
  const t = useT()
  return (
    <div className="cv-guest">
      <header className="cv-guest-head">
        <span className="cv-guest-brand"><Logo size={28} /><b>One Place</b></span>
        <span className="cv-guest-concept">{t({ fr: 'Concept', en: 'Concept' })}</span>
        <span className="cv-grow" />
        <ViewAsAlex />
      </header>
      <main className="cv-guest-main">{children}</main>
      <footer className="cv-guest-foot">{t({ fr: 'Concept de démonstration. Pas un produit Google.', en: 'A demonstration concept. Not a Google product.' })}</footer>
    </div>
  )
}

export function GuestScreen() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const viewer = useViewer()
  const projects = useStore((s) => s.projects)
  const call = useStore((s) => s.call)
  const meeting = useMemo(() => findGuestMeeting(projects, viewer.id, viewer.email, call), [projects, viewer.id, viewer.email, call])
  const [phase, setPhase] = useState<'prejoin' | 'joined' | 'left'>('prejoin')
  const [mic, setMic] = useState(true)
  const [cam, setCam] = useState(true)
  const [captions, setCaptions] = useState(true)
  const [hand, setHand] = useState(false)
  const [startedAt, setStartedAt] = useState(0)
  const [line, setLine] = useState(0)
  const [joinedCount, setJoinedCount] = useState(0)

  // A guest's meeting is frozen once joined: the project moving on must not change her stage.
  const [held, setHeld] = useState<GuestMeeting | null>(null)
  const current = phase === 'joined' ? held ?? meeting : meeting

  const others = useMemo(() => {
    if (!current) return []
    const ids = current.attendeeIds.filter((id) => id !== viewer.id && personById(id).role !== 'ai')
    return ids.includes(current.hostId) ? [current.hostId, ...ids.filter((id) => id !== current.hostId)] : [current.hostId, ...ids]
  }, [current, viewer.id])

  const lines = useMemo<CaptionLine[]>(() => (
    current ? guestLines(current.hostId, others.find((id) => id !== current.hostId), viewer.name.split(' ')[0]) : []
  ), [current, others, viewer.name])

  useEffect(() => {
    if (phase !== 'joined') return
    const timers = others.map((_, i) => setTimeout(() => setJoinedCount((n) => Math.max(n, i + 1)), 700 + i * 1100))
    return () => timers.forEach(clearTimeout)
  }, [phase, others])

  // Pre-join shows a real preview, as Meet does; leaving lets go of the camera at once.
  useLiveMedia(phase !== 'left' && !!current, cam, mic, (what) => (what === 'cam' ? setCam(false) : setMic(false)))

  const join = () => { unlockAudio(); setHeld(meeting); setStartedAt(Date.now()); setLine(0); setJoinedCount(0); setHand(false); setPhase('joined') }

  if (phase === 'joined' && current) {
    const inCall: StagePerson[] = [
      { person: viewer, callOnly: true },
      ...others.slice(0, joinedCount).map((id) => ({ person: personById(id) })),
    ]
    return (
      <div className="cv-guest-stage">
        <Stage mode="guest" title={current.title} startedAt={startedAt} selfId={viewer.id} people={inCall} waiting={others.length - joinedCount}
          mic={mic} cam={cam} captions={captions} hand={hand} lines={lines} line={line} onLine={setLine}
          voicePrefix="guest"
          onMic={() => { void setMicrophone(!mic); setMic(!mic) }} onCam={() => { void setCamera(!cam); setCam(!cam) }} onCaptions={() => setCaptions((v) => !v)} onHand={() => setHand((v) => !v)}
          onHangUp={() => setPhase('left')} topSlot={<ViewAsAlex compact />} />
      </div>
    )
  }

  if (phase === 'left') {
    return (
      <GuestFrame>
        <div className="cv-guest-left">
          <h1>{t({ fr: 'Vous avez quitté l’appel. Merci.', en: 'You left the call. Thanks.' })}</h1>
          <p>{t({ fr: 'Vous n’avez plus accès à rien : c’était cet appel, et seulement lui.', en: 'You have no further access: it was this call, and only this call.' })}</p>
          <Button variant="filled" icon="videocam" onClick={join}>{t({ fr: 'Rejoindre à nouveau', en: 'Rejoin' })}</Button>
        </div>
      </GuestFrame>
    )
  }

  if (!current) {
    return (
      <GuestFrame>
        <div className="cv-guest-left">
          <Icon name="event_busy" size={40} />
          <h1>{t({ fr: 'Aucun appel pour le moment', en: 'No call right now' })}</h1>
          <p>{t({ fr: 'Quand quelqu’un vous invitera à un appel, le lien vous amènera ici.', en: 'When someone invites you to a call, the link will bring you here.' })}</p>
        </div>
      </GuestFrame>
    )
  }

  const host = personById(current.hostId)
  return (
    <GuestFrame>
      <div className="cv-prejoin">
        <div className="cv-preview">
          <Tile person={viewer} self cam={cam} muted={!mic} />
          <MediaNotice />
          <div className="cv-preview-ctl">
            <CtlButton icon={mic ? 'mic' : 'mic_off'} label={mic ? t({ fr: 'Couper le micro', en: 'Turn off microphone' }) : t({ fr: 'Activer le micro', en: 'Turn on microphone' })} tone={mic ? undefined : 'off'} onClick={() => { void setMicrophone(!mic); setMic(!mic) }} />
            <CtlButton icon={cam ? 'videocam' : 'videocam_off'} label={cam ? t({ fr: 'Couper la caméra', en: 'Turn off camera' }) : t({ fr: 'Activer la caméra', en: 'Turn on camera' })} tone={cam ? undefined : 'off'} onClick={() => { void setCamera(!cam); setCam(!cam) }} />
          </div>
        </div>
        <div className="cv-prejoin-text">
          <h1>{t(current.title)}</h1>
          <p className="cv-when">
            {current.live
              ? t({ fr: 'En cours', en: 'In progress' })
              : `${fmtDay(current.start, lang)}, ${fmtTime(current.start, lang)}`}
          </p>
          <p className="cv-host"><Avatar person={host} size={24} />{t({ fr: `Organisé par ${host.name}`, en: `Hosted by ${host.name}` })}</p>
          {others.length > 0 && <div className="cv-faces"><AvatarStack ids={others} size={40} max={5} /></div>}
          <Button variant="filled" icon="videocam" className="cv-join" onClick={join}>{t({ fr: 'Rejoindre', en: 'Join' })}</Button>
          <p className="cv-only-note"><Icon name="lock" size={18} />{t({ fr: 'Cette invitation concerne cet appel uniquement. Vous ne pouvez pas voir le projet.', en: 'You are invited to this call only. You can’t see the project.' })}</p>
        </div>
      </div>
    </GuestFrame>
  )
}
