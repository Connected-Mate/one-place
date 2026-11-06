/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// One renderer per message kind, the action bar, threads and the private treatment.
import { inviteGuest } from '../call/callActions'
import { memo, useCallback, useState } from 'react'
import { fmtDate, fmtTime, useT } from '../i18n'
import { canSee, GEMINI_ID, personById, useStore } from '../store'
import { startCall } from '../call/callActions'
import { Avatar, AvatarStack, Button, Chip, Dialog, Icon, IconButton, Sparkle } from '../ui/kit'
import type { Artifact, CallSummaryMessage, EmailMessage, L, Lang, MeetingMessage, Message, ProposalMessage, Visibility } from '../data/types'
import { blockOfTodo, goBoard, sendChat, sendDraft, useChat } from './chatState'
import { findMessage, firstName, isDraftMail, mailAddress, mailName, reactTo, snippet, updateMessage } from './helpers'
import { appOfKind, WorkspaceIcon } from '../ui/WorkspaceIcon'
import { RichText } from './rich'
import { MentionInput } from './MentionInput'

const EMOJIS = ['👍', '❤️', '🎉', '😄', '👀', '🙏']

/* ---------- small pieces ---------- */
export function privateLabel(v: Visibility, viewer: string, l: Lang) {
  if (v.type !== 'private') return ''
  const others = v.with.filter((id) => id !== viewer).map(firstName)
  const list = others.length > 1 ? `${others.slice(0, -1).join(', ')}${l === 'fr' ? ' et ' : ' and '}${others[others.length - 1]}` : others[0]
  if (!list) return l === 'fr' ? 'Toi seul peux voir ceci' : 'Only you can see this'
  return l === 'fr' ? `Seuls toi et ${list} pouvez voir ceci` : `Only you and ${list} can see this`
}
export const ARTIFACT_ICON: Record<Artifact['kind'], { icon: string; className: string; label: L }> = {
  doc: { icon: 'description', className: 'k-doc', label: { fr: 'Doc', en: 'Doc' } },
  sheet: { icon: 'table_chart', className: 'k-sheet', label: { fr: 'Feuille de calcul', en: 'Sheet' } },
  slides: { icon: 'slideshow', className: 'k-slides', label: { fr: 'Présentation', en: 'Slides' } },
  pdf: { icon: 'picture_as_pdf', className: 'k-pdf', label: { fr: 'PDF', en: 'PDF' } },
}
const useArtifact = (pid: string, id: string) => useStore((s) => s.projects.find((p) => p.id === pid)?.artifacts.find((a) => a.id === id))

function ArtifactChip({ pid, id }: { pid: string; id: string }) {
  const t = useT()
  const a = useArtifact(pid, id)
  const setPane = useStore((s) => s.setPane)
  if (!a) return null
  const k = ARTIFACT_ICON[a.kind]
  return <Chip icon={<span className={`file-glyph ${k.className}`}>{a.kind === 'pdf' ? <Icon name={k.icon} fill size={16} /> : <WorkspaceIcon app={appOfKind[a.kind]} size={16} />}</span>} onClick={() => setPane({ type: 'artifact', id: a.id })} className="attach-chip"><span className="ellipsis">{t(a.title)}</span></Chip>
}

/* ---------- text ---------- */
function Thinking() {
  const t = useT()
  return <span className="thinking" role="status"><span className="shimmer">{t({ fr: 'Gemini réfléchit', en: 'Gemini is thinking' })}</span></span>
}

/* ---------- mail ---------- */
function EmailCard({ m, pid, address, viewerId }: { m: EmailMessage; pid: string; address: string; viewerId: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const body = t(m.body)
  const draft = isDraftMail(m)
  // a draft is read in full before it leaves
  const long = !draft && (body.length > 180 || body.split('\n').length > 3)
  const { setMailReply, focusComposer, setDraft } = useChat.getState()
  const reply = () => { setMailReply({ pid, messageId: m.id }); focusComposer() }
  const edit = () => {
    setDraft(pid, body)
    setMailReply({ pid, messageId: m.quoteId ?? m.id })
    updateMessage(pid, m.id, { visibility: { type: 'private', with: [] } })
    focusComposer()
  }
  const discard = () => updateMessage(pid, m.id, { visibility: { type: 'private', with: [] } })
  const outName = mailName(m.to)
  return (
    <article className={`ocard mail-card ${m.direction}${draft ? ' draft' : ''}`}>
      <div className="mail-tag">
        <span>{draft
          ? t({ fr: `Brouillon de mail pour ${outName}, pas encore envoyé`, en: `Draft to ${outName}, not sent yet` })
          : m.direction === 'in'
            ? t({ fr: `Mail reçu, envoyé à ${address}`, en: `Email received, sent to ${address}` })
            : t({ fr: `Envoyé par mail à ${outName}, pas besoin de compte pour le recevoir`, en: `Sent by email to ${outName}. They don’t need an account.` })}</span>
      </div>
      {/* The sender's name is above the card and the line above says who it goes to. Only a draft shows the address: it is read before it leaves. */}
      {draft && <div className="mail-meta"><span className="mail-label">{t({ fr: 'À', en: 'To' })}</span> <span className="mail-who">{outName}</span> <span className="mail-addr">{mailAddress(m.to)}</span></div>}
      <div className="mail-subject">{t(m.subject)}</div>
      <div className={`mail-body${open || !long ? ' open' : ''}`}>{body}</div>
      {long && (
        <button type="button" className="op-link mail-more" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? t({ fr: 'Réduire', en: 'Show less' }) : t({ fr: 'Lire la suite', en: 'Read more' })}
        </button>
      )}
      {!!m.attachmentIds?.length && <div className="chip-row">{m.attachmentIds.map((id) => <ArtifactChip key={id} pid={pid} id={id} />)}</div>}
      <div className="card-actions empty-hide">
        {draft && m.visibility.type === 'private' && m.visibility.with.includes(viewerId) && (
          <>
            <Button variant="filled" size="s" icon="send" onClick={() => sendDraft(pid, m.id)}>{t({ fr: 'Envoyer', en: 'Send' })}</Button>
            <Button size="s" onClick={edit}>{t({ fr: 'Modifier', en: 'Edit' })}</Button>
            <Button size="s" onClick={discard}>{t({ fr: 'Supprimer', en: 'Discard' })}</Button>
          </>
        )}
        {!draft && m.direction === 'in' && <Button size="s" onClick={reply}>{t({ fr: 'Répondre par mail', en: 'Reply by email' })}</Button>}
      </div>
    </article>
  )
}

/* ---------- meeting ---------- */
function GuestDialog({ m, pid, onClose }: { m: MeetingMessage; pid: string; onClose: () => void }) {
  const t = useT()
  const [email, setEmail] = useState('')
  const [bad, setBad] = useState(false)
  const add = () => {
    const v = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { setBad(true); return }
    const guests = m.guestEmails ?? []
    if (!guests.includes(v)) updateMessage(pid, m.id, { guestEmails: [...guests, v] })
    // On a live call the guest really joins the stage, not just the card.
    if (m.live && useStore.getState().call?.projectId === pid) inviteGuest(v.split('@')[0].replace(/[._-]+/g, ' '), v)
    onClose()
  }
  return (
    <Dialog title={t({ fr: 'Inviter à cet appel', en: 'Invite to this call' })} onClose={onClose} footer={<><Button onClick={onClose}>{t({ fr: 'Annuler', en: 'Cancel' })}</Button><Button variant="filled" onClick={add}>{t({ fr: 'Inviter', en: 'Invite' })}</Button></>}>
      <p className="dialog-note">{t({ fr: 'Cette personne rejoint uniquement cet appel. Elle ne verra ni le chat ni le board.', en: 'This person joins this call only. They won’t see the chat or the board.' })}</p>
      <div className="field">
        <label htmlFor="guest-mail">{t({ fr: 'Adresse mail', en: 'Email address' })}</label>
        <input id="guest-mail" data-autofocus className={`input${bad ? ' bad' : ''}`} type="email" value={email} aria-invalid={bad} onChange={(e) => { setEmail(e.target.value); setBad(false) }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} placeholder="nora@example.org" />
        {bad && <span className="field-err" role="alert">{t({ fr: 'Cette adresse ne semble pas valide.', en: 'That address doesn’t look valid.' })}</span>}
      </div>
    </Dialog>
  )
}
function MeetingCard({ m, pid }: { m: MeetingMessage; pid: string }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const inCall = useStore((s) => s.call?.projectId === pid)
  const setPane = useStore((s) => s.setPane)
  const [guest, setGuest] = useState(false)
  const close = useCallback(() => setGuest(false), [])
  const d = new Date(m.start)
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const join = () => { if (inCall) setPane({ type: 'call' }); else startCall(pid) }
  return (
    <article className={`ocard meeting-card${m.ended ? ' ended' : ''}`}>
      <div className="date-block" aria-hidden="true">
        <span className="date-month">{d.toLocaleDateString(locale, { month: 'short' })}</span>
        <span className="date-day">{d.getDate()}</span>
      </div>
      <div className="meeting-main">
        <div className="meeting-title">{t(m.title)}</div>
        <div className="meeting-when">
          <span className="sr-only">{fmtDate(m.start, lang)}, </span>
          {d.toLocaleDateString(locale, { weekday: 'long' })}, {fmtTime(m.start, lang)} - {fmtTime(m.start + m.durationMin * 6e4, lang)}
          {m.live && !m.ended && <span className="live-tag"><span className="live-dot" />{t({ fr: 'En cours', en: 'Live' })}</span>}
          {m.ended && <span className="muted-tag">{t({ fr: 'Terminée', en: 'Ended' })}</span>}
        </div>
        <AvatarStack ids={m.attendeeIds} size={22} max={3} />
        {!!m.guestEmails?.length && (
          <div className="chip-row">
            {m.guestEmails.map((g) => <span key={g} className="guest-chip"><span className="ellipsis">{g}</span><em>{t({ fr: 'appel uniquement', en: 'call only' })}</em></span>)}
          </div>
        )}
        {!m.ended && (
          <div className="card-actions">
            {inCall && m.live
              ? <button type="button" className="in-call-note" onClick={join}><Icon name="check_circle" size={16} />{t({ fr: 'Tu es dans cet appel', en: 'You’re in this call' })}</button>
              : <Button variant="filled" size="s" icon="videocam" onClick={join}>{t({ fr: 'Rejoindre', en: 'Join' })}</Button>}
            <Button size="s" onClick={() => setGuest(true)}>{t({ fr: 'Ajouter un invité', en: 'Add guest' })}</Button>
          </div>
        )}
      </div>
      {guest && <GuestDialog m={m} pid={pid} onClose={close} />}
    </article>
  )
}

/* ---------- call summary ---------- */
function CallSummaryCard({ m, pid }: { m: CallSummaryMessage; pid: string }) {
  const t = useT()
  const n = m.todoIds.length
  const open = () => {
    const p = useStore.getState().projects.find((x) => x.id === pid)
    goBoard(pid, p ? blockOfTodo(p, m.todoIds[0]) : undefined)
  }
  return (
    <article className="ocard summary-card">
      <div className="summary-head">
        <Sparkle size={18} />
        <span className="summary-title">{t(m.title)}</span>
        <span className="summary-dur">{m.durationMin} min</span>
      </div>
      <p className="summary-text">{t(m.summary)}</p>
      {!!m.decisions.length && (
        <>
          <div className="summary-label">{t({ fr: 'Décisions', en: 'Decisions' })}</div>
          <ul className="rich-list">{m.decisions.map((d, i) => <li key={i}>{t(d)}</li>)}</ul>
        </>
      )}
      {n > 0 && (
        <button type="button" className="summary-todos" onClick={open}>
          {t(n > 1 ? { fr: `${n} tâches ajoutées au board`, en: `${n} to-dos added to the board` } : { fr: '1 tâche ajoutée au board', en: '1 to-do added to the board' })}
          <Icon name="chevron_right" size={16} />
        </button>
      )}
    </article>
  )
}

/* ---------- file ---------- */
function FileCard({ m, pid }: { m: Extract<Message, { kind: 'file' }>; pid: string }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const a = useArtifact(pid, m.artifactId)
  const setPane = useStore((s) => s.setPane)
  if (!a) return <div className="ocard file-card missing"><Icon name="draft" />{t({ fr: 'Ce fichier n’est plus disponible.', en: 'This file is no longer available.' })}</div>
  const k = ARTIFACT_ICON[a.kind]
  return (
    <>
      {m.text && <div className="msg-text"><RichText text={t(m.text)} pid={pid} /></div>}
      <button type="button" className="ocard file-card" onClick={() => setPane({ type: 'artifact', id: a.id })}>
        <span className={`file-icon ${k.className}`}>{a.kind === 'pdf' ? <Icon name={k.icon} fill size={22} /> : <WorkspaceIcon app={appOfKind[a.kind]} size={22} />}</span>
        <span className="file-info">
          <span className="file-title">{t(a.title)}</span>
          <span className="file-meta">{t(k.label)} · {firstName(a.ownerId)} · {fmtDate(a.updatedAt, lang)}</span>
        </span>
      </button>
    </>
  )
}

/* ---------- proposal ---------- */
function ProposalCard({ m, pid, viewerId, ownerId }: { m: ProposalMessage; pid: string; viewerId: string; ownerId: string }) {
  const t = useT()
  const isOwner = viewerId === ownerId
  const decide = (approved: boolean) => {
    const s = useStore.getState()
    const p = s.projects.find((x) => x.id === pid)
    const cur = p && findMessage(p, m.id)
    if (!cur || cur.kind !== 'proposal' || cur.status !== 'pending') return
    s.decideProposal(pid, m.id, approved)
    if (!approved) return
    const a = m.action
    const blockId = a.type === 'add-block' ? a.block.id : a.type === 'none' ? undefined : a.blockId
    s.toast({ icon: 'check_circle', text: { fr: 'Sur le board', en: 'On the board' }, action: { label: { fr: 'Voir', en: 'View' }, run: () => goBoard(pid, blockId) } })
  }
  const decider = m.decidedBy ? firstName(m.decidedBy) : ''
  return (
    <article className={`ocard proposal-card ${m.status}`}>
      <div className="proposal-tag">{t({ fr: 'Proposition', en: 'Proposal' })}</div>
      <div className="proposal-title">{t(m.title)}</div>
      <div className="proposal-desc">{t(m.description)}</div>
      {m.status === 'pending' && isOwner && (
        <div className="card-actions">
          <Button variant="filled" size="s" onClick={() => decide(true)}>{t({ fr: 'Approuver', en: 'Approve' })}</Button>
          <Button size="s" onClick={() => decide(false)}>{t({ fr: 'Refuser', en: 'Decline' })}</Button>
        </div>
      )}
      {m.status === 'pending' && !isOwner && (
        <div className="proposal-state waiting"><Icon name="hourglass_top" size={16} />{t({ fr: `En attente de ${firstName(ownerId)}`, en: `Waiting for ${firstName(ownerId)}` })}</div>
      )}
      {m.status === 'approved' && <div className="proposal-state approved" role="status"><Icon name="check_circle" fill size={16} />{t({ fr: `Approuvée par ${decider}`, en: `Approved by ${decider}` })}</div>}
      {m.status === 'declined' && <div className="proposal-state declined" role="status"><Icon name="cancel" size={16} />{t({ fr: `Refusée par ${decider}`, en: `Declined by ${decider}` })}</div>}
    </article>
  )
}

/* ---------- body switch ---------- */
function Body({ m, pid, viewerId, ownerId, address }: { m: Message; pid: string; viewerId: string; ownerId: string; address: string }) {
  const t = useT()
  switch (m.kind) {
    case 'text': {
      const text = t(m.text)
      if (m.streaming && !text) return <Thinking />
      return <div className={`msg-text${m.streaming ? ' streaming' : ''}`}><RichText text={text} pid={pid} /></div>
    }
    case 'email': return <EmailCard m={m} pid={pid} address={address} viewerId={viewerId} />
    case 'meeting': return <MeetingCard m={m} pid={pid} />
    case 'call-summary': return <CallSummaryCard m={m} pid={pid} />
    case 'file': return <FileCard m={m} pid={pid} />
    case 'proposal': return <ProposalCard m={m} pid={pid} viewerId={viewerId} ownerId={ownerId} />
    case 'system': return null
  }
}

/* ---------- quote ---------- */
function Quote({ id, pid, viewerId }: { id: string; pid: string; viewerId: string }) {
  const lang = useStore((s) => s.lang)
  const q = useStore((s) => { const p = s.projects.find((x) => x.id === pid); return p && findMessage(p, id) })
  const focus = useStore((s) => s.focusMessage)
  if (!q || !canSee(q.visibility, viewerId)) return null
  const who = q.kind === 'email' && q.direction === 'in' ? mailName(q.from) : firstName(q.authorId)
  return (
    <button type="button" className="quote" onClick={() => focus(q.id)}>
      <span className="quote-who">{who}</span>
      <span className="quote-text">{snippet(q, lang)}</span>
    </button>
  )
}

/* ---------- actions ---------- */
function privateTarget(m: Message, pid: string, viewerId: string) {
  const p = useStore.getState().projects.find((x) => x.id === pid)
  if (m.authorId === GEMINI_ID) return GEMINI_ID
  if (p?.memberIds.includes(m.authorId) && m.authorId !== viewerId) return m.authorId
  return p?.memberIds.find((id) => id !== viewerId && id !== GEMINI_ID) ?? GEMINI_ID
}
function ActionBar({ m, pid, viewerId, parentId }: { m: Message; pid: string; viewerId: string; parentId?: string }) {
  const t = useT()
  const [picking, setPicking] = useState(false)
  const closePicker = (row: Element | null) => {
    setPicking(false)
    requestAnimationFrame(() => row?.querySelector<HTMLElement>('.msg-actions button')?.focus())
  }
  const openThread = () => {
    const { setThread, setThreadCompose } = useChat.getState()
    const root = parentId ?? m.id
    setThread(root, true)
    setThreadCompose(root)
  }
  const replyPrivately = () => {
    useStore.getState().setPrivateTo(privateTarget(m, pid, viewerId), m.id)
    useChat.getState().setMailReply(null)
    useChat.getState().focusComposer()
  }
  const askAbout = () => {
    const s = useStore.getState()
    // a private message must stay private: asking about it privately keeps its content out of the public chat
    const target = m.visibility.type === 'private' ? GEMINI_ID : s.privateTo
    s.setPrivateTo(target, m.id)
    const c = useChat.getState()
    c.setMailReply(null)
    const cur = c.drafts[pid] ?? ''
    if (!/@gemini\b/i.test(cur)) c.setDraft(pid, `@Gemini ${cur}`)
    c.focusComposer()
  }
  if (picking) {
    return (
      <div className="msg-actions shown" role="toolbar" aria-label={t({ fr: 'Choisir une réaction', en: 'Pick a reaction' })}
        ref={(el) => { if (el && !el.contains(document.activeElement)) el.querySelector('button')?.focus() }}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePicker(e.currentTarget.closest('.msg')) } }}>
        {EMOJIS.map((e) => <button key={e} type="button" className="emoji-btn" aria-label={e} onClick={(ev) => { reactTo(pid, m.id, e); closePicker(ev.currentTarget.closest('.msg')) }}>{e}</button>)}
        <IconButton icon="close" size={32} label={t({ fr: 'Fermer', en: 'Close' })} onClick={(ev) => closePicker(ev.currentTarget.closest('.msg'))} />
      </div>
    )
  }
  return (
    <div className="msg-actions" role="toolbar" aria-label={t({ fr: 'Actions sur le message', en: 'Message actions' })}>
      <IconButton icon="add_reaction" size={32} label={t({ fr: 'Réagir', en: 'React' })} onClick={() => setPicking(true)} />
      <IconButton icon="forum" size={32} label={t({ fr: 'Répondre dans le fil', en: 'Reply in thread' })} onClick={openThread} />
      {m.authorId !== viewerId && <IconButton icon="lock" size={32} label={t({ fr: 'Répondre en privé', en: 'Reply privately' })} onClick={replyPrivately} />}
      <button type="button" className="icon-btn ask-btn" aria-label={t({ fr: 'Demander à Gemini', en: 'Ask Gemini about this' })} title={t({ fr: 'Demander à Gemini', en: 'Ask Gemini about this' })} onClick={askAbout}><Sparkle size={16} /></button>
    </div>
  )
}
function Reactions({ m, pid, viewerId }: { m: Message; pid: string; viewerId: string }) {
  if (!m.reactions?.length) return null
  return (
    <div className="reactions">
      {m.reactions.map((r) => (
        <button key={r.emoji} type="button" className={`reaction${r.by.includes(viewerId) ? ' mine' : ''}`} aria-pressed={r.by.includes(viewerId)} title={r.by.map(firstName).join(', ')} onClick={() => reactTo(pid, m.id, r.emoji)}>
          <span aria-hidden="true">{r.emoji}</span>{r.by.length}
        </button>
      ))}
    </div>
  )
}

/* ---------- thread ---------- */
function Thread({ m, pid, viewerId, ownerId, address }: { m: Message; pid: string; viewerId: string; ownerId: string; address: string }) {
  const t = useT()
  const open = useChat((s) => !!s.threadOpen[m.id])
  const composing = useChat((s) => s.threadCompose === m.id)
  const setThread = useChat((s) => s.setThread)
  const setThreadCompose = useChat((s) => s.setThreadCompose)
  const [text, setText] = useState('')
  const replies = (m.replies ?? []).filter((r) => canSee(r.visibility, viewerId))
  if (!replies.length && !composing) return null
  const n = replies.length
  const send = () => { if (sendChat(pid, text, { parentId: m.id })) { setText(''); setThreadCompose(m.id) } }
  return (
    <div className="thread">
      {n > 0 && (
        <button type="button" className="thread-toggle" aria-expanded={open} onClick={() => setThread(m.id, !open)}>
          <span>{t(n > 1 ? { fr: `${n} réponses`, en: `${n} replies` } : { fr: '1 réponse', en: '1 reply' })}</span>
          <Icon name={open ? 'expand_less' : 'expand_more'} size={16} />
        </button>
      )}
      {open && replies.map((r) => <MessageRow key={r.id} m={r} pid={pid} viewerId={viewerId} ownerId={ownerId} address={address} parentId={m.id} />)}
      {composing && (
        <div className="thread-compose">
          <MentionInput pid={pid} value={text} onChange={setText} onSubmit={send} onEscape={() => setThreadCompose(null)} autoFocus
            label={t({ fr: 'Répondre dans le fil', en: 'Reply in thread' })} placeholder={t({ fr: 'Répondre dans le fil', en: 'Reply in thread' })} />
          <IconButton icon="send" size={32} disabled={!text.trim()} label={t({ fr: 'Envoyer', en: 'Send' })} onClick={send} />
        </div>
      )}
    </div>
  )
}

/* ---------- row ---------- */
export interface RowProps { m: Message; pid: string; viewerId: string; ownerId: string; address: string; grouped?: boolean; parentId?: string; flash?: boolean; samePrivate?: boolean; sameQuote?: boolean }
export const MessageRow = memo(function MessageRow({ m, pid, viewerId, ownerId, address, grouped, parentId, flash, samePrivate, sameQuote }: RowProps) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const touched = useChat((s) => s.touched === m.id)
  const setTouched = useChat((s) => s.setTouched)

  if (m.kind === 'system') {
    return (
      <div className={`msg-system${flash ? ' flash' : ''}`} data-mid={m.id}>
        {m.icon && <Icon name={m.icon} size={16} />}
        <span><RichText text={t(m.text)} pid={pid} /></span>
      </div>
    )
  }

  const own = m.authorId === viewerId
  const person = personById(m.authorId)
  const isCard = m.kind !== 'text'
  const isPrivate = m.visibility.type === 'private'
  const name = m.kind === 'email' && m.direction === 'in' ? mailName(m.from) : person.name
  const onTap = (e: React.MouseEvent) => {
    if (!matchMedia('(hover: none)').matches) return
    if ((e.target as HTMLElement).closest('button,a,input,textarea')) return
    setTouched(touched ? null : m.id)
  }
  const bubbled = !isCard && (own || isPrivate)
  // later messages of the same private exchange: the tint says it, a screen reader still hears it
  const pvt = isPrivate && (samePrivate
    ? <span className="sr-only">{privateLabel(m.visibility, viewerId, lang)}</span>
    : <div className="private-tag"><Icon name="lock" size={12} /><span className="ellipsis">{privateLabel(m.visibility, viewerId, lang)}</span></div>
  )
  const showQuote = !!m.quoteId && !sameQuote
  return (
    <div
      className={`msg${own ? ' own' : ''}${grouped ? ' grouped' : ''}${parentId ? ' reply' : ''}${isPrivate ? ' private' : ''}${flash ? ' flash' : ''}${touched ? ' touched' : ''}${isCard ? ' is-card' : ''}`}
      data-mid={m.id} data-kind={m.kind} aria-busy={m.streaming ? true : undefined} onClick={onTap}
    >
      {!own && <div className="msg-avatar">{!grouped && <Avatar person={m.kind === 'email' && m.direction === 'in' && !person.email ? { ...person, name } : person} size={parentId ? 24 : 32} />}</div>}
      <div className="msg-main">
        {!grouped && (
          <div className="msg-head">
            {!own && <span className={`msg-name${person.role === 'ai' ? ' ai' : ''}`} title={m.kind === 'email' && m.direction === 'in' ? mailAddress(m.from) : undefined}>{name}</span>}
            {own && <span className="sr-only">{t({ fr: 'Toi', en: 'You' })}</span>}
            <time className="msg-time" dateTime={new Date(m.at).toISOString()}>{fmtTime(m.at, lang)}</time>
          </div>
        )}
        <div className="msg-content">
          {bubbled
            ? (
              <div className={`bubble${isPrivate ? ' private' : ''}`}>
                {pvt}
                {showQuote && <Quote id={m.quoteId!} pid={pid} viewerId={viewerId} />}
                <Body m={m} pid={pid} viewerId={viewerId} ownerId={ownerId} address={address} />
              </div>
            )
            : (
              <>
                {isPrivate && pvt}
                {showQuote && m.kind !== 'email' && <Quote id={m.quoteId!} pid={pid} viewerId={viewerId} />}
                <Body m={m} pid={pid} viewerId={viewerId} ownerId={ownerId} address={address} />
              </>
            )}
          {!m.streaming && <ActionBar m={m} pid={pid} viewerId={viewerId} parentId={parentId} />}
        </div>
        <Reactions m={m} pid={pid} viewerId={viewerId} />
        {!parentId && <Thread m={m} pid={pid} viewerId={viewerId} ownerId={ownerId} address={address} />}
      </div>
    </div>
  )
})
