/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The project chat: header, message log and composer.
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { fmtDay, tx, useT } from '../i18n'
import { canSee, GEMINI_ID, personById, roleIn, useProject, useStore } from '../store'
import { startCall } from '../call/callActions'
import { Avatar, AvatarStack, Button, Icon, IconButton, Menu, Sparkle } from '../ui/kit'
import type { Message, Project } from '../data/types'
import { attachFake, sendChat, useChat } from './chatState'
import { Composer, SuggestionChips } from './Composer'
import { healInterruptedAnswers } from './gemini'
import { firstName, parentOf } from './helpers'
import { MessageRow } from './Messages'
import './chat.css'

const GROUP_MS = 5 * 6e4
const dayKey = (at: number) => { const d = new Date(at); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }
const groupable = (m: Message) => m.kind === 'text' && !m.quoteId
const sameAudience = (a: Message, b: Message) => a.visibility.type === b.visibility.type && (a.visibility.type === 'all' || (a.visibility.with.join() === (b.visibility.type === 'private' ? b.visibility.with.join() : '')))

function Header({ project }: { project: Project }) {
  const t = useT()
  const pid = project.id
  const viewerId = useStore((s) => s.viewerId)
  const inThisCall = useStore((s) => s.call?.projectId === pid)
  const setPane = useStore((s) => s.setPane)
  const toast = useStore((s) => s.toast)
  const role = roleIn(project, viewerId)
  const live = inThisCall || project.messages.some((m) => m.kind === 'meeting' && m.live && !m.ended && canSee(m.visibility, viewerId))
  const peopleCount = project.memberIds.filter((id) => id !== GEMINI_ID).length
  const roleLabel = `${peopleCount} ${peopleCount === 1 ? 'person' : 'people'} · ${role === 'owner' ? 'you’re the owner' : role === 'member' ? 'you’re a member' : 'you’re a guest'}`
  const roleHelp = role === 'owner'
    ? { fr: 'Tu décides de ce qui arrive sur le board', en: 'You decide what goes on the board' }
    : { fr: `Tu proposes, ${firstName(project.ownerId)} approuve`, en: `You propose, ${firstName(project.ownerId)} approves` }
  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(project.address)
      toast({ icon: 'content_copy', text: { fr: 'Adresse du projet copiée', en: 'Project address copied' } })
    } catch {
      toast({ icon: 'mail', text: project.address })
    }
  }
  return (
    <header className={`chat-head${inThisCall ? ' in-call' : ''}`}>
      <div className="chat-title">
        <h2 className="chat-name">{t(project.name)}</h2>
        <span className="role-label" title={t(roleHelp)}>{roleLabel}</span>
      </div>
      <AvatarStack ids={project.memberIds} size={28} max={4} />
      {inThisCall
        ? <button type="button" className="in-call-note" onClick={() => setPane({ type: 'call' })}><Icon name="check_circle" size={16} />{t({ fr: 'Tu es dans cet appel', en: 'You’re in this call' })}</button>
        : live
        ? <Button variant="filled" size="s" icon="videocam" onClick={() => startCall(pid)}>{t({ fr: 'Rejoindre', en: 'Join' })}</Button>
        : <IconButton icon="videocam" label={t({ fr: 'Lancer un appel', en: 'Start a call' })} onClick={() => startCall(pid)} />}
      <Menu align="right" items={[
        { icon: 'dashboard', label: t({ fr: 'Voir le board', en: 'Open the board' }), onSelect: () => setPane({ type: 'board' }) },
        { icon: 'alternate_email', label: t({ fr: 'Copier l’adresse du projet', en: 'Copy project address' }), hint: undefined, onSelect: () => { void copyAddress() } },
        { divider: true, label: '' },
        { icon: 'group', label: t({ fr: `${peopleCount} membres`, en: `${peopleCount} ${peopleCount === 1 ? 'member' : 'members'}` }), disabled: true },
      ]} trigger={(p) => <IconButton {...p} icon="more_vert" label={t({ fr: 'Plus d’options', en: 'More options' })} />} />
    </header>
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

  const visible = useMemo(() => project.messages.filter((m) => canSee(m.visibility, viewerId)), [project.messages, viewerId])
  const isEmpty = !visible.some((m) => m.kind !== 'system')

  const toEnd = (smooth = false) => {
    const el = scroller.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
    stick.current = true
    setNewCount(0)
  }

  // a new project or persona opens at the latest message
  useLayoutEffect(() => { toEnd() }, [pid, viewerId]) // eslint-disable-line
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
  const lastCount = useRef({ pid, viewerId, n: visible.length })
  useEffect(() => {
    const prev = lastCount.current
    const added = prev.pid === pid && prev.viewerId === viewerId ? visible.length - prev.n : 0
    lastCount.current = { pid, viewerId, n: visible.length }
    if (added > 0 && !stick.current) setNewCount((c) => c + added)
  }, [visible.length, pid, viewerId])

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
            {isEmpty && <EmptyState project={project} onPick={(text) => { sendChat(pid, `@Gemini ${text}`, { privateTo, quoteId }) }} />}
            {visible.map((m, i) => {
              const prev = visible[i - 1]
              const newDay = !prev || dayKey(prev.at) !== dayKey(m.at)
              const grouped = !!prev && !newDay && prev.authorId === m.authorId && groupable(m) && groupable(prev) && sameAudience(prev, m) && m.at - prev.at < GROUP_MS
              return (
                <Fragment key={m.id}>
                  {newDay && <div className="day-sep" role="separator"><span>{fmtDay(m.at, lang)}</span></div>}
                  <MessageRow m={m} pid={pid} viewerId={viewerId} ownerId={project.ownerId} address={project.address} grouped={grouped} flash={flashId === m.id} />
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
