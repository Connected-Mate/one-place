/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Gemini's short note under every email that reaches the project: one line until you open it.
import { useEffect, useId, useState } from 'react'
import { useT } from '../i18n'
import { GEMINI_ID, useStore } from '../store'
import { Avatar, Button, Icon, Sparkle } from '../ui/kit'
import type { EmailMessage } from '../data/types'
import { useChat } from './chatState'
import { askGemini } from './gemini'
import { triageEmail } from './emailTriage'
import { firstName } from './helpers'

/** How long Gemini "reads" a new email before its note appears. */
const READ_MS = 1500

export function EmailSubChat({ m, pid, viewerId }: { m: EmailMessage; pid: string; viewerId: string }) {
  const t = useT()
  const panelId = useId()
  const project = useStore((s) => s.projects.find((x) => x.id === pid))
  const [open, setOpen] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [reading, setReading] = useState(() => Date.now() - m.at < READ_MS)

  useEffect(() => {
    if (!reading) return
    const left = setTimeout(() => setReading(false), Math.max(0, READ_MS - (Date.now() - m.at)))
    return () => clearTimeout(left)
  }, [reading, m.at])

  if (!project) return null
  if (reading) {
    return (
      <div className="esc esc-reading" role="status"><Sparkle size={16} /><span className="shimmer">{t({ fr: 'Gemini lit cet e-mail', en: 'Gemini is reading this email' })}</span></div>
    )
  }
  const triage = triageEmail(m, project)
  const who = triage.whoId === viewerId ? t({ fr: 'Toi', en: 'You' }) : triage.whoId ? firstName(triage.whoId) : null
  // the draft stays between the viewer and Gemini until it's sent
  const draft = () => {
    if (drafting) return
    setDrafting(true)
    useChat.getState().scrollToEnd()
    void askGemini(pid, 'draft a reply', { privateTo: GEMINI_ID, quoteId: m.id }).finally(() => setDrafting(false))
  }
  const ask = () => {
    const c = useChat.getState()
    c.setThread(m.id, true)
    c.setThreadAsk(m.id)
    c.setThreadCompose(m.id)
  }
  return (
    <div className={`esc${open ? ' open' : ''}`}>
      <button type="button" className="esc-line" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        <Sparkle size={16} />
        <span className="esc-summary">{triage.summary}</span>
        <Icon name={open ? 'expand_less' : 'expand_more'} size={18} />
      </button>
      {open && (
        <div className="esc-body" id={panelId}>
          {triage.repliedBy
            ? <div className="esc-row"><Icon name="check_circle" size={16} className="esc-done" /><span>{t({ fr: `${firstName(triage.repliedBy)} a répondu`, en: `${triage.repliedBy === viewerId ? 'You' : firstName(triage.repliedBy)} replied` })}</span></div>
            : triage.whoId && (
              <div className="esc-row">
                <Avatar id={triage.whoId} size={20} />
                <span><strong>{t({ fr: 'Qui devrait répondre', en: 'Who should answer' })}: {who}</strong>. {triage.why}</span>
              </div>
            )}
          {triage.deadline && <div className="esc-row"><Icon name="schedule" size={16} /><span>{triage.deadline}</span></div>}
          <div className="esc-actions">
            <Button variant="gemini" size="s" disabled={drafting} onClick={draft}><Sparkle size={14} />{t({ fr: 'Rédiger une réponse', en: 'Draft a reply' })}</Button>
            <Button size="s" onClick={ask}>{t({ fr: 'Demander à Gemini', en: 'Ask Gemini' })}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
