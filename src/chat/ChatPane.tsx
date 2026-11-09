/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The project chat: header, message log and composer.
import { useCallback, Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { fmtDay, tx, useT } from '../i18n'
import { canSee, filesFor, GEMINI_ID, personById, roleIn, spacesOf, useOpenSpace, useProject, useStore } from '../store'
import { startCall, useCallUi } from '../call/callActions'
import { Avatar, AvatarStack, Button, Icon, IconButton, Menu, Sparkle } from '../ui/kit'
import type { Message, Project, Space } from '../data/types'
import { attachFake, sendChat, useChat } from './chatState'
import { Composer, SuggestionChips } from './Composer'
import { healInterruptedAnswers } from './gemini'
import { firstName, parentOf } from './helpers'
import { openPeople } from '../home/goTo'
import { MessageRow } from './Messages'
import { copyProjectAddress, InviteDialog } from './Invite'
import './inbound'
import './chat.css'

const GROUP_MS = 5 * 6e4
const dayKey = (at: number) => { const d = new Date(at); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }
const groupable = (m: Message) => m.kind === 'text' && !m.quoteId
const sameAudience = (a: Message, b: Message) => a.visibility.type === b.visibility.type && (a.visibility.type === 'all' || (a.visibility.with.join() === (b.visibility.type === 'private' ? b.visibility.with.join() : '')))

function Header({ project }: { project: Project }) {
  const t = useT()
  const ring = useCallUi((u) => u.ring?.phase)
  const pid = project.id
  const viewerId = useStore((s) => s.viewerId)
  const inThisCall = useStore((s) => s.call?.projectId === pid)
  const setPane = useStore((s) => s.setPane)
  const role = roleIn(project, viewerId)
  const live = inThisCall || project.messages.some((m) => m.kind === 'meeting' && m.live && !m.ended && canSee(m.visibility, viewerId))
  const peopleCount = project.memberIds.filter((id) => id !== GEMINI_ID).length
  const roleLabel = role === 'partner'
    ? `Shared with ${spacesOf(project, viewerId).map((x) => x.org ?? tx(x.name, 'en')).join(', ')} · you see this space only`
    : `${peopleCount} ${peopleCount === 1 ? 'person' : 'people'} · ${role === 'owner' ? 'you’re the owner' : role === 'member' ? 'you’re a member' : 'you’re a guest'}`
  const roleHelp = role === 'owner'
    ? { fr: 'Tu décides de ce qui arrive sur le board', en: 'You decide what goes on the board' }
    : { fr: `Tu proposes, ${firstName(project.ownerId)} approuve`, en: `You propose, ${firstName(project.ownerId)} approves` }
  const [inviting, setInviting] = useState(false)
  const closeInvite = useCallback(() => setInviting(false), [])
  const copyAddress = () => copyProjectAddress(project.address)
  return (
    <header className={`chat-head${inThisCall ? ' in-call' : ''}`}>
      <div className="chat-title">
        <h2 className="chat-name">{t(project.name)}</h2>
        <span className="role-label" title={t(roleHelp)}>{roleLabel}</span>
      </div>
      {role !== 'partner' && <button type="button" className="chat-faces" title={t({ fr: 'Voir l’équipe', en: 'See the team' })} aria-label={t({ fr: `Voir l’équipe, ${peopleCount} personnes`, en: `See the team, ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}` })} onClick={() => openPeople(pid)}><AvatarStack ids={project.memberIds.filter((id) => id !== GEMINI_ID)} size={26} max={3} more={false} /></button>}
      {role === 'partner' ? null : inThisCall
        ? <button type="button" className="in-call-note" onClick={() => setPane({ type: 'call' })}><Icon name={ring ? 'call' : 'check_circle'} size={16} />{ring === 'ringing' ? 'Calling…' : ring === 'noanswer' ? 'No answer' : t({ fr: 'Tu es dans cet appel', en: 'You’re in this call' })}</button>
        : live
        ? <Button variant="filled" size="s" icon="videocam" onClick={() => startCall(pid)}>{t({ fr: 'Rejoindre', en: 'Join' })}</Button>
        : <IconButton icon="videocam" label={t({ fr: 'Lancer un appel', en: 'Start a call' })} onClick={() => startCall(pid)} />}
      {role !== 'partner' && <><Menu align="right" items={[
        { icon: 'dashboard', label: t({ fr: 'Voir le board', en: 'Open the board' }), onSelect: () => setPane({ type: 'board' }) },
        { icon: 'person_add', label: t({ fr: 'Inviter', en: 'Invite' }), onSelect: () => setInviting(true) },
        { icon: 'alternate_email', label: t({ fr: 'Copier l’adresse du projet', en: 'Copy project address' }), hint: undefined, onSelect: () => { void copyAddress() } },
        { divider: true, label: '' },
        { icon: 'group', label: t({ fr: `${peopleCount} membres`, en: `${peopleCount} ${peopleCount === 1 ? 'member' : 'members'}` }), onSelect: () => openPeople(pid) },
      ]} trigger={(p) => <IconButton {...p} icon="more_vert" label={t({ fr: 'Plus d’options', en: 'More options' })} />} />
      <span className="head-break" aria-hidden="true" />
      <button type="button" className="addr-chip" title={t({ fr: 'Copier l’adresse du projet', en: 'Copy the project address' })} aria-label={t({ fr: `Copier l’adresse du projet, ${project.address}`, en: `Copy the project address, ${project.address}` })} onClick={() => { void copyAddress() }}>
        <Icon name="mail" size={14} /><span className="ellipsis">{project.address}</span>
      </button></>}
      {inviting && <InviteDialog project={project} onClose={closeInvite} />}
    </header>
  )
}

/** The project's threads: the whole team, then each sub-team the viewer belongs to. A partner only has theirs. */
function SpaceBar({ project, open }: { project: Project; open: Space | null }) {
  const t = useT()
  const viewerId = useStore((s) => s.viewerId)
  const setSpace = useStore((s) => s.setSpace)
  const mine = spacesOf(project, viewerId)
  const member = project.memberIds.includes(viewerId)
  if (!mine.length) return null
  const unseen = (sp: Space | null) => project.messages.filter((m) => (sp ? m.visibility.type === 'space' && m.visibility.space === sp.id : m.visibility.type !== 'space') && canSee(m.visibility, viewerId)).length
  const chip = (sp: Space | null) => {
    const on = (open?.id ?? null) === (sp?.id ?? null)
    const label = sp ? t(sp.name) : t({ fr: 'Toute l’équipe', en: 'Whole team' })
    return (
      <button key={sp?.id ?? 'team'} type="button" role="tab" aria-selected={on} className={`space-chip${on ? ' on' : ''}${sp ? ` ${sp.kind}` : ''}`}
        title={sp ? t(sp.description) : t({ fr: 'Le fil de toute l’équipe', en: 'The whole team’s thread' })}
        aria-label={`${label}, ${unseen(sp)} messages`} onClick={() => setSpace(sp?.id ?? null)}>
        <Icon name={sp ? sp.icon : 'groups'} size={16} fill={on} />
        <span className="ellipsis">{label}</span>
        {sp?.kind === 'partner' && <span className="space-tag">{t({ fr: 'Partagé', en: 'Shared' })}</span>}
      </button>
    )
  }
  return (
    <div className="space-bar" role="tablist" aria-label={t({ fr: 'Fils du projet', en: 'Threads in this project' })}>
      {member && chip(null)}
      {mine.map(chip)}
    </div>
  )
}

/** First thing in a space's thread: who reads it, and what they can open. */
function SpaceIntro({ project, space }: { project: Project; space: Space }) {
  const t = useT()
  const viewerId = useStore((s) => s.viewerId)
  const setPane = useStore((s) => s.setPane)
  const people = space.memberIds.filter((id) => id !== GEMINI_ID)
  const files = filesFor(project, viewerId).filter((a) => a.space === space.id)
  const names = people.map((id) => firstName(id))
  const nameList = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]
  return (
    <div className={`space-intro ${space.kind}`}>
      <div className="space-intro-head">
        <span className="space-intro-icon" aria-hidden="true"><Icon name={space.icon} size={20} /></span>
        <div className="space-intro-text">
          <strong>{t(space.name)}{space.kind === 'confidential' ? ' · confidential' : ` · shared with ${space.org}`}</strong>
          <span>{t(space.description)}</span>
        </div>
      </div>
      <div className="space-intro-meta">
        <AvatarStack ids={people} size={22} max={5} more={false} />
        <span className="ellipsis">{nameList}{space.memberIds.includes(GEMINI_ID) ? ', and Gemini' : ''}</span>
      </div>
      {files.length > 0 && (
        <div className="space-intro-files">
          {files.map((a) => (
            <button key={a.id} type="button" className="space-file" onClick={() => setPane({ type: 'artifact', id: a.id })}>
              <Icon name={a.kind === 'sheet' ? 'table' : a.kind === 'pdf' ? 'picture_as_pdf' : 'description'} size={16} />
              <span className="ellipsis">{t(a.title)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState({ project, onPick }: { project: Project; onPick: (text: string) => void }) {
  const t = useT()
  return (
    <div className="chat-empty">
      <Sparkle size={40} />
      <h3>{t({ fr: 'Tout le projet commence ici', en: 'The whole project starts here' })}</h3>
      <p>{t({ fr: `Écrivez à l’équipe, ou demandez à Gemini. Les mails envoyés à ${project.address} arrivent aussi ici.`, en: `Write to the team, or ask Gemini. Email sent to ${project.address} shows up here too.` })}</p>
      <SuggestionChips project={project} onPick={onPick} className="center" />
    </div>
  )
}

function Typing({ pid, viewerId }: { pid: string; viewerId: string }) {
  const t = useT()
  const typing = useChat((s) => s.typing).filter((x) => x.pid === pid && canSee(x.visibility, viewerId))
  if (!typing.length) return null
  const names = typing.map((x) => firstName(x.personId))
  const first = typing[0]
  const label = names.length > 1
    ? t({ fr: `${names.join(' et ')} écrivent`, en: `${names.join(' and ')} are typing` })
    : t({ fr: `${names[0]} écrit`, en: `${names[0]} is typing` })
  return (
    <div className={`typing${first.visibility.type === 'private' ? ' private' : ''}`} role="status">
      <Avatar person={personById(first.personId)} size={24} />
      <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
      <span>{label}</span>
    </div>
  )
}

export function ChatPane() {
  const t = useT()
  const project = useProject()
  const pid = project.id
  const lang = useStore((s) => s.lang)
  const viewerId = useStore((s) => s.viewerId)
  const focusMessageId = useStore((s) => s.focusMessageId)
  const focusMessage = useStore((s) => s.focusMessage)
  const scrollNonce = useChat((s) => s.scrollNonce)
  const privateTo = useStore((s) => s.privateTo)
  const quoteId = useStore((s) => s.quoteId)
  const scroller = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const lastTop = useRef(0)
  const [newCount, setNewCount] = useState(0)
  const [flashId, setFlashId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)

  useEffect(() => { healInterruptedAnswers() }, [])

  const space = useOpenSpace(project)
  const spaceId = space?.id ?? null
  // each thread shows its own messages: the main one never shows a space's, a space only its own
  const visible = useMemo(() => project.messages.filter((m) => canSee(m.visibility, viewerId)
    && (spaceId ? m.visibility.type === 'space' && m.visibility.space === spaceId : m.visibility.type !== 'space')), [project.messages, viewerId, spaceId])
  const isEmpty = !visible.some((m) => m.kind !== 'system')

  const toEnd = (smooth = false) => {
    const el = scroller.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
    stick.current = true
    setNewCount(0)
  }

  // a new project or persona opens at the latest message
  useLayoutEffect(() => { toEnd() }, [pid, viewerId, spaceId]) // eslint-disable-line
  useLayoutEffect(() => { if (scrollNonce) toEnd() }, [scrollNonce]) // eslint-disable-line

  // follows the conversation while the reader is at the bottom, including text that grows while streaming
  useEffect(() => {
    const el = scroller.current; const body = inner.current
    if (!el || !body) return
    const ro = new ResizeObserver(() => { if (stick.current) el.scrollTop = el.scrollHeight })
    ro.observe(body); ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // reader has scrolled up: count what arrives instead of pulling them down
  const lastCount = useRef({ pid, viewerId, spaceId, n: visible.length })
  useEffect(() => {
    const prev = lastCount.current
    const added = prev.pid === pid && prev.viewerId === viewerId && prev.spaceId === spaceId ? visible.length - prev.n : 0
    lastCount.current = { pid, viewerId, spaceId, n: visible.length }
    if (added > 0 && !stick.current) setNewCount((c) => c + added)
  }, [visible.length, pid, viewerId, spaceId])

  // jump to a message from anywhere (board, search, a quote) and flash it
  useEffect(() => {
    if (!focusMessageId) return
    const parent = parentOf(project, focusMessageId)
    if (parent) useChat.getState().setThread(parent.id, true)
    const raf = requestAnimationFrame(() => {
      const el = scroller.current?.querySelector(`[data-mid="${CSS.escape(focusMessageId)}"]`)
      if (el) {
        stick.current = false
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setFlashId(focusMessageId)
        window.setTimeout(() => setFlashId((f) => (f === focusMessageId ? null : f)), 1600)
      }
      focusMessage(null)
    })
    return () => cancelAnimationFrame(raf)
  }, [focusMessageId]) // eslint-disable-line

  const onDragEnter = (e: DragEvent) => { if (e.dataTransfer.types.includes('Files')) { dragDepth.current++; setDragging(true) } }
  const onDragLeave = () => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false) }
  const onDragOver = (e: DragEvent) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    for (const f of e.dataTransfer.files) attachFake(pid, f)
  }

  const role = roleIn(project, viewerId)
  return (
    <section className="pane chat-pane" aria-label={t({ fr: `Discussion ${tx(project.name, 'fr')}`, en: `${tx(project.name, 'en')} chat` })}
      onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop}>
      <Header project={project} />
      <SpaceBar project={project} open={space} />
      <div className="log-wrap">
        <div ref={scroller} className="chat-log" role="log" aria-live="polite" aria-label={t({ fr: 'Messages', en: 'Messages' })} tabIndex={0}
          onScroll={(e) => {
            // Only the reader scrolling up unsticks. A gap alone proves nothing: scroll events arrive a frame late,
            // and by then a new card may have grown the content under a scroll that was on its way to the bottom.
            const el = e.currentTarget
            const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 48
            if (atEnd) stick.current = true
            else if (el.scrollTop < lastTop.current - 1) stick.current = false
            lastTop.current = el.scrollTop
            if (atEnd && newCount) setNewCount(0)
          }}>
          <div ref={inner} className="chat-log-inner">
            {space && <SpaceIntro project={project} space={space} />}
            {isEmpty && !space && <EmptyState project={project} onPick={(text) => { sendChat(pid, `@Gemini ${text}`, { privateTo, quoteId }) }} />}
            {visible.map((m, i) => {
              const prev = visible[i - 1]
              const newDay = !prev || dayKey(prev.at) !== dayKey(m.at)
              const grouped = !!prev && !newDay && prev.authorId === m.authorId && groupable(m) && groupable(prev) && sameAudience(prev, m) && m.at - prev.at < GROUP_MS
              // A private exchange says who can see it, and what it is about, once: on its first message.
              const samePrivate = !!prev && !newDay && m.visibility.type === 'private' && sameAudience(prev, m)
              const sameQuote = samePrivate && !!m.quoteId && prev.quoteId === m.quoteId
              return (
                <Fragment key={m.id}>
                  {newDay && <div className="day-sep" role="separator"><span>{fmtDay(m.at, lang)}</span></div>}
                  <MessageRow m={m} pid={pid} viewerId={viewerId} ownerId={project.ownerId} address={project.address} grouped={grouped} flash={flashId === m.id} samePrivate={samePrivate} sameQuote={sameQuote} />
                </Fragment>
              )
            })}
            <Typing pid={pid} viewerId={viewerId} />
          </div>
        </div>
        {newCount > 0 && (
          <button type="button" className="new-pill" onClick={() => toEnd(true)}>
            <Icon name="arrow_downward" size={18} />
            {t(newCount > 1 ? { fr: `${newCount} nouveaux messages`, en: `${newCount} new messages` } : { fr: '1 nouveau message', en: '1 new message' })}
          </button>
        )}
      </div>
      {role === 'guest'
        ? <div className="composer-note">{t({ fr: 'Tu ne fais pas partie de ce projet.', en: 'You are not part of this project.' })}</div>
        : <Composer project={project} />}
      {dragging && (
        <div className="drop-veil" aria-hidden="true">
          <Icon name="upload_file" size={32} />
          <span>{t({ fr: 'Dépose pour joindre au projet', en: 'Drop to attach to the project' })}</span>
        </div>
      )}
    </section>
  )
}
