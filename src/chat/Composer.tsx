/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The pill at the bottom: who it goes to, what it quotes, suggestions, attachments.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { attachable, canSee, GEMINI_ID, personById, useOpenSpace, useStore } from '../store'
import { Avatar, Button, Dialog, Icon, IconButton, Menu, Sparkle, type MenuItem } from '../ui/kit'
import type { Project } from '../data/types'
import { attachFake, newDoc, scheduleMeeting, sendChat, sendMailReply, shareArtifact, suggestionsFor, useChat } from './chatState'
import { findMessage, firstName, mailAddress, mailName, snippet } from './helpers'
import { MentionInput } from './MentionInput'
import { ARTIFACT_ICON } from './Messages'

export function SuggestionChips({ project, quoteId, onPick, className = '' }: { project: Project; quoteId?: string | null; onPick: (text: string) => void; className?: string }) {
  const t = useT()
  const quote = quoteId ? findMessage(project, quoteId) : undefined
  const list = useMemo(() => suggestionsFor(project, quote), [project, quote])
  return (
    <div className={`suggestions ${className}`} role="group" aria-label={t({ fr: 'Suggestions pour Gemini', en: 'Suggestions for Gemini' })}>
      {list.map((s) => (
        <button key={s.en} type="button" className="suggestion" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(t(s))}>
          <Sparkle size={14} />{t(s)}
        </button>
      ))}
    </div>
  )
}

/** The next working days, as chips: no native date picker, always US format. */
function dayChoices() {
  const out: { at: number; label: string }[] = []
  const d = new Date(); d.setHours(0, 0, 0, 0)
  for (let i = 0; out.length < 8 && i < 16; i++, d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 6) continue
    if (i === 0 && new Date().getHours() >= 18) continue
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    out.push({ at: d.getTime(), label })
  }
  return out
}
const TIMES = Array.from({ length: 22 }, (_, i) => 8 * 60 + i * 30) // 8:00 AM to 6:30 PM
const timeLabel = (min: number) => { const d = new Date(); d.setHours(Math.floor(min / 60), min % 60, 0, 0); return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }
function MeetingDialog({ pid, onClose }: { pid: string; onClose: () => void }) {
  const t = useT()
  const days = useMemo(dayChoices, [])
  const [title, setTitle] = useState('')
  const [day, setDay] = useState(() => days[days[0]?.label === 'Today' ? 1 : 0]?.at ?? days[0]?.at)
  const [time, setTime] = useState(600)
  const [err, setErr] = useState<'title' | 'when' | null>(null)
  const submit = () => {
    if (!title.trim()) { setErr('title'); return }
    const at = day + time * 6e4
    const d = new Date(day); d.setHours(Math.floor(time / 60), time % 60, 0, 0)
    if (d.getTime() < Date.now() || Number.isNaN(at)) { setErr('when'); return }
    scheduleMeeting(pid, title.trim(), d.getTime(), 30)
    onClose()
  }
  return (
    <Dialog title={t({ fr: 'Planifier une réunion', en: 'Schedule a meeting' })} onClose={onClose} footer={<><Button onClick={onClose}>{t({ fr: 'Annuler', en: 'Cancel' })}</Button><Button variant="filled" onClick={submit}>{t({ fr: 'Planifier', en: 'Schedule' })}</Button></>}>
      <div className="field">
        <label htmlFor="mt-title">{t({ fr: 'Titre', en: 'Title' })}</label>
        <input id="mt-title" data-autofocus className={`input${err === 'title' ? ' bad' : ''}`} value={title} maxLength={120} onChange={(e) => { setTitle(e.target.value); setErr(null) }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }} />
        {err === 'title' && <span className="field-err" role="alert">{t({ fr: 'Donne un titre à la réunion.', en: 'Give the meeting a title.' })}</span>}
      </div>
      <div className="field" role="group" aria-labelledby="mt-day-label">
        <span id="mt-day-label" className="field-label">{t({ fr: 'Jour', en: 'Day' })}</span>
        <div className="day-chips">
          {days.map((d) => (
            <button key={d.at} type="button" className={`chip click day-chip${day === d.at ? ' selected' : ''}`} aria-pressed={day === d.at} onClick={() => { setDay(d.at); setErr(null) }}>{d.label}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="mt-time">{t({ fr: 'Heure', en: 'Time' })}</label>
        <select id="mt-time" className={`input${err === 'when' ? ' bad' : ''}`} value={time} onChange={(e) => { setTime(Number(e.target.value)); setErr(null) }}>
          {TIMES.map((m) => <option key={m} value={m}>{timeLabel(m)}</option>)}
        </select>
        {err === 'when' && <span className="field-err" role="alert">{t({ fr: 'Choisis une heure à venir.', en: 'That time has passed. Pick a later one.' })}</span>}
      </div>
    </Dialog>
  )
}
function AttachDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const t = useT()
  const viewerId = useStore((s) => s.viewerId)
  const space = useOpenSpace(project)
  const docs = attachable(project, viewerId, space)
  return (
    <Dialog title={t({ fr: 'Joindre un document du projet', en: 'Attach a project document' })} onClose={onClose} footer={<Button onClick={onClose}>{t({ fr: 'Fermer', en: 'Close' })}</Button>}>
      {docs.length === 0
        ? <p className="dialog-note">{t({ fr: 'Ce projet n’a pas encore de document. Crée-en un avec le menu +, ou demande à Gemini.', en: 'This project has no documents yet. Create one from the + menu, or ask Gemini.' })}</p>
        : (
          <div className="attach-list">
            {docs.map((a) => {
              const k = ARTIFACT_ICON[a.kind]
              return (
                <button key={a.id} type="button" className="attach-item" onClick={() => { shareArtifact(project.id, a.id); onClose() }}>
                  <span className={`file-icon ${k.className}`}><Icon name={k.icon} fill size={20} /></span>
                  <span className="file-info"><span className="file-title">{t(a.title)}</span><span className="file-meta">{t(k.label)}</span></span>
                </button>
              )
            })}
          </div>
        )}
    </Dialog>
  )
}

export function Composer({ project }: { project: Project }) {
  const t = useT()
  const pid = project.id
  const lang = useStore((s) => s.lang)
  const viewerId = useStore((s) => s.viewerId)
  const privateTo = useStore((s) => s.privateTo)
  const quoteId = useStore((s) => s.quoteId)
  const setPrivateTo = useStore((s) => s.setPrivateTo)
  const draft = useChat((s) => s.drafts[pid] ?? '')
  const setDraft = useChat((s) => s.setDraft)
  const mailReplyRaw = useChat((s) => s.mailReply)
  const setMailReply = useChat((s) => s.setMailReply)
  const focusNonce = useChat((s) => s.focusNonce)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const pointerDown = useRef(false)
  const [focused, setFocused] = useState(false)
  // after a send the answer is what matters: no chips until the composer is used again
  const [justSent, setJustSent] = useState(false)
  const [dialog, setDialog] = useState<'meeting' | 'attach' | null>(null)
  const closeDialog = useCallback(() => setDialog(null), [])

  const mailReply = mailReplyRaw?.pid === pid ? mailReplyRaw : null
  const mailSource = mailReply ? findMessage(project, mailReply.messageId) : undefined
  const mailTarget = mailSource?.kind === 'email' ? (mailSource.direction === 'in' ? mailSource.from : mailSource.to) : null
  const quote = quoteId ? findMessage(project, quoteId) : undefined
  const shownQuote = quote && canSee(quote.visibility, viewerId) ? quote : undefined
  const space = useOpenSpace(project)
  const isPrivate = !!privateTo && !mailReply && !space
  const recipient = privateTo ? personById(privateTo) : null

  useEffect(() => { if (focusNonce) inputRef.current?.focus() }, [focusNonce])

  // the shell's "Things to try" panel can start something in the composer
  useEffect(() => {
    const on = (e: Event) => {
      const text = (e as CustomEvent<{ text?: string }>).detail?.text ?? ''
      useStore.getState().setMobilePane('chat')
      const cur = useChat.getState().drafts[pid] ?? ''
      // already there, or nothing to add: just bring the cursor back, never "@ @"
      if (text && !cur.trimEnd().endsWith(text)) setDraft(pid, cur && !/\s$/.test(cur) ? `${cur} ${text}` : cur + text)
      inputRef.current?.blur()
      inputRef.current?.focus()
    }
    window.addEventListener('oneplace:compose', on)
    return () => window.removeEventListener('oneplace:compose', on)
  }, [pid, setDraft])

  // Leaving the composer removes the chips, which moves the log. Wait until the press is over,
  // otherwise the button under the pointer moves away between mouse down and mouse up and the click is lost.
  const onLeave = () => {
    const hide = () => { setFocused(false); setJustSent(false) }
    if (!pointerDown.current) { hide(); return }
    window.addEventListener('pointerup', () => setTimeout(() => { if (!rootRef.current?.contains(document.activeElement) && !document.activeElement?.closest('.wt-panel')) hide() }, 0), { once: true })
  }
  useEffect(() => {
    const down = () => { pointerDown.current = true }
    // A menu or a dialog of the composer can close without giving the focus back: a press elsewhere still means "left".
    const up = () => {
      pointerDown.current = false
      setTimeout(() => { if (!rootRef.current?.contains(document.activeElement) && !document.querySelector('.menu,.scrim,.wt-panel')) { setFocused(false); setJustSent(false) } }, 0)
    }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', up, true)
    return () => { window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true) }
  }, [])

  const onlyGemini = /^\s*@gemini\s*$/i.test(draft)
  const showChips = focused && !mailReply && (onlyGemini || (draft.trim() === '' && !justSent))
  const canSend = mailReply ? !!draft.trim() : !!draft.trim() && !onlyGemini

  const clearModes = () => { setPrivateTo(null, null); setMailReply(null) }
  const send = () => {
    if (mailReply) {
      if (sendMailReply(pid, mailReply.messageId, draft)) setDraft(pid, '')
      return
    }
    if (sendChat(pid, draft, { privateTo, quoteId })) {
      setDraft(pid, '')
      setJustSent(true)
      setPrivateTo(privateTo, null)
    }
  }
  const pickSuggestion = (text: string) => {
    if (sendChat(pid, `@Gemini ${text}`, { privateTo, quoteId })) {
      setDraft(pid, '')
      setJustSent(true)
      setPrivateTo(privateTo, null)
    }
  }

  const recipients = [GEMINI_ID, ...project.memberIds.filter((id) => id !== GEMINI_ID && id !== viewerId)]
  const spaceCount = space ? space.memberIds.filter((id) => id !== GEMINI_ID).length : 0
  const recipientItems: MenuItem[] = space ? [
    { icon: space.icon, label: t({ fr: `Tout ${t(space.name)}`, en: `Everyone in ${t(space.name)}` }), selected: true, onSelect: () => inputRef.current?.focus() },
  ] : [
    { icon: 'groups', label: t({ fr: 'Tout le monde', en: 'Everyone' }), selected: !privateTo, onSelect: () => { setPrivateTo(null, quoteId); inputRef.current?.focus() } },
    { divider: true, label: '' },
    ...recipients.map((id) => ({ icon: <Avatar id={id} size={24} />, label: t({ fr: `En privé à ${firstName(id)}`, en: `Private to ${firstName(id)}` }), selected: privateTo === id, onSelect: () => { setPrivateTo(id, quoteId); inputRef.current?.focus() } })),
  ]
  const plusItems: MenuItem[] = [
    { icon: 'attach_file', label: t({ fr: 'Joindre un document du projet', en: 'Attach a project document' }), onSelect: () => setDialog('attach') },
    { icon: 'upload_file', label: t({ fr: 'Ajouter un fichier', en: 'Add a file' }), onSelect: () => fileRef.current?.click() },
    { icon: 'note_add', label: t({ fr: 'Nouveau document', en: 'New document' }), onSelect: () => newDoc(pid) },
    { icon: 'event', label: t({ fr: 'Planifier une réunion', en: 'Schedule a meeting' }), onSelect: () => setDialog('meeting') },
  ]
  const placeholder = mailReply
    ? t({ fr: `Votre réponse à ${mailName(mailTarget ?? '')}`, en: `Your reply to ${mailName(mailTarget ?? '')}` })
    : isPrivate && recipient
      ? t({ fr: `Message privé à ${firstName(recipient.id)}`, en: `Private message to ${firstName(recipient.id)}` })
      : t({ fr: 'Message, ou @Gemini', en: 'Message or @Gemini' })

  return (
    <div
      ref={rootRef}
      className={`composer${isPrivate ? ' is-private' : ''}${mailReply ? ' is-mail' : ''}`}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { const to = e.relatedTarget as Element | null; if (!e.currentTarget.contains(to) && !to?.closest?.('.wt-panel')) onLeave() }}
    >
      {showChips && <SuggestionChips project={project} quoteId={shownQuote?.id} onPick={pickSuggestion} />}

      {mailReply && mailTarget && (
        <div className="composer-banner mail">
          <Icon name="forward_to_inbox" size={18} />
          <span className="banner-text">{t({ fr: `Réponse par mail à ${mailName(mailTarget)} (${mailAddress(mailTarget)}). Pas besoin de compte pour la recevoir.`, en: `Reply by email to ${mailName(mailTarget)} (${mailAddress(mailTarget)}). They don’t need an account.` })}</span>
          <IconButton icon="close" size={28} label={t({ fr: 'Annuler la réponse par mail', en: 'Cancel reply by email' })} onClick={() => setMailReply(null)} />
        </div>
      )}

      {!mailReply && shownQuote && (
        <div className={`composer-banner quoted${isPrivate ? ' private' : ''}`}>
          <Icon name="format_quote" size={18} />
          <span className="banner-text"><strong>{shownQuote.kind === 'email' && shownQuote.direction === 'in' ? mailName(shownQuote.from) : firstName(shownQuote.authorId)}</strong> {snippet(shownQuote, lang)}</span>
          <IconButton icon="close" size={28} label={t({ fr: 'Retirer la citation', en: 'Remove quote' })} onClick={() => setPrivateTo(privateTo, null)} />
        </div>
      )}

      {!mailReply && (
        // Everyone is the default: nothing to say until the composer is in use. It stays in the tab order, and focusing it opens it.
        <div className={`composer-to${focused || isPrivate || draft ? '' : ' rest'}`}>
          <Menu items={recipientItems} header={t({ fr: 'Qui peut voir ce message', en: 'Who can see this message' })} trigger={(p) => (
            <button type="button" {...p} className={`to-switch${isPrivate ? ' private' : ''}`} aria-label={t({ fr: 'Choisir les destinataires', en: 'Choose recipients' })}>
              <Icon name={space ? space.icon : isPrivate ? 'lock' : 'groups'} fill={isPrivate} size={16} />
              <span className="ellipsis">{space ? t(space.name) : isPrivate && recipient ? t({ fr: `En privé à ${firstName(recipient.id)}`, en: `Private to ${firstName(recipient.id)}` }) : t({ fr: 'Tout le monde', en: 'Everyone' })}</span>
              <Icon name="arrow_drop_down" size={18} />
            </button>
          )} />
          {space && <span className="to-note">{space.kind === 'partner' ? `${spaceCount} people, ${space.org} included` : `Only these ${spaceCount} people`}</span>}
          {isPrivate && recipient && <span className="to-note">{t({ fr: 'Personne d’autre ne le verra', en: 'Nobody else will see it' })}</span>}
          {isPrivate && <IconButton icon="close" size={28} label={t({ fr: 'Revenir à tout le monde', en: 'Back to everyone' })} onClick={() => setPrivateTo(null, quoteId)} />}
        </div>
      )}

      <div className="composer-pill">
        <Menu items={plusItems} trigger={(p) => (
          <button type="button" {...p} className="composer-plus" aria-label={t({ fr: 'Ajouter', en: 'Add' })}><Icon name="add" size={24} /></button>
        )} />
        <MentionInput pid={pid} value={draft} onChange={(v) => setDraft(pid, v)} onSubmit={() => { if (canSend) send() }} onEscape={clearModes} inputRef={inputRef} label={placeholder} placeholder={placeholder} />
        <button type="button" className="composer-send" disabled={!canSend} aria-label={mailReply ? t({ fr: 'Envoyer par mail', en: 'Send by email' }) : t({ fr: 'Envoyer', en: 'Send' })} title={t({ fr: 'Envoyer', en: 'Send' })} onClick={send}>
          <Icon name="send" fill size={20} />
        </button>
      </div>

      <input ref={fileRef} type="file" multiple hidden tabIndex={-1} onChange={(e) => { for (const f of e.target.files ?? []) attachFake(pid, f); e.target.value = '' }} />
      {dialog === 'meeting' && <MeetingDialog pid={pid} onClose={closeDialog} />}
      {dialog === 'attach' && <AttachDialog project={project} onClose={closeDialog} />}
    </div>
  )
}
