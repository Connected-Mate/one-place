/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The small blocks: summary, files, people, calendar, notes, poll.
import { useEffect, useRef, useState } from 'react'
import type { Block, Person } from '../../data/types'
import { fmtDate, fmtTime, useT } from '../../i18n'
import { personById, useStore } from '../../store'
import { Avatar, Button, Icon, IconButton, Sparkle } from '../../ui/kit'
import { Empty, Frame, startOfDay, useBoard } from '../shared'

type Of<T extends Block['type']> = Extract<Block, { type: T }>

export function SummaryBlock({ block }: { block: Of<'summary'> }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const { project } = useBoard()
  const patchBlock = useStore((s) => s.patchBlock)
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const refresh = () => {
    if (busy) return
    setBusy(true)
    timer.current = setTimeout(() => {
      patchBlock(project.id, block.id, { updatedAt: Date.now() })
      setBusy(false)
    }, 1400)
  }
  const sameDay = startOfDay(block.updatedAt) === startOfDay(Date.now())
  return (
    <Frame
      block={block}
      className="rp-summary"
      leading={<Sparkle size={20} />}
      actions={<Button size="s" icon="refresh" onClick={refresh} disabled={busy}>{t({ fr: 'Actualiser', en: 'Refresh' })}</Button>}
    >
      <div aria-live="polite" aria-busy={busy}>
        {busy ? (
          <div className="rp-shimmer-group" aria-label={t({ fr: 'Gemini relit le projet', en: 'Gemini is rereading the project' })}>
            <span className="rp-shimmer" style={{ width: '92%' }} /><span className="rp-shimmer" style={{ width: '76%' }} /><span className="rp-shimmer" style={{ width: '84%' }} />
          </div>
        ) : (
          <>
            <p className="rp-summary-text">{t(block.text)}</p>
            {block.bullets.length > 0 && <ul className="rp-summary-list">{block.bullets.map((b, i) => <li key={i}>{t(b)}</li>)}</ul>}
          </>
        )}
      </div>
      <p className="rp-meta">
        {t({ fr: 'Mis à jour', en: 'Updated' })} {sameDay ? t({ fr: `à ${fmtTime(block.updatedAt, lang)}`, en: `at ${fmtTime(block.updatedAt, lang)}` }) : t({ fr: `le ${fmtDate(block.updatedAt, lang)}`, en: `on ${fmtDate(block.updatedAt, lang)}` })}
      </p>
    </Frame>
  )
}

export function PeopleBlock({ block }: { block: Of<'people'> }) {
  const t = useT()
  const { project, role, viewerId } = useBoard()
  const setPrivateTo = useStore((s) => s.setPrivateTo)
  const setMobilePane = useStore((s) => s.setMobilePane)
  const ids = [...new Set([...project.memberIds, ...project.externalIds])]
  const list: Person[] = ids.map(personById).filter((p) => p.role !== 'ai')
  const presence = (p: Person) => p.presence === 'online' ? t({ fr: 'En ligne', en: 'Online' }) : p.presence === 'away' ? t({ fr: 'Absent', en: 'Away' }) : p.presence === 'dnd' ? t({ fr: 'Ne pas déranger', en: 'Do not disturb' }) : t({ fr: 'Hors ligne', en: 'Offline' })
  const write = (p: Person) => {
    setPrivateTo(p.id)
    setMobilePane('chat')
  }
  return (
    <Frame block={block}>
      {list.length === 0 ? <Empty icon="group" title={t({ fr: 'Personne pour l’instant', en: 'Nobody here yet' })} /> : (
        <ul className="rp-rows">
          {list.map((p) => {
            const outside = project.externalIds.includes(p.id) && !project.memberIds.includes(p.id)
            const guest = outside && p.role === 'guest'
            const byMail = outside && !guest
            return (
              <li key={p.id} className="rp-row">
                <Avatar person={p} size={32} status />
                <span className="rp-row-main">
                  <span className="rp-trunc" title={p.name}>{p.name}{p.id === viewerId && <span className="rp-row-sub"> {t({ fr: '(vous)', en: '(you)' })}</span>}</span>
                  <span className="rp-row-sub rp-trunc">{t(p.title)}{t(p.title) ? ', ' : ''}<span className="rp-lower">{presence(p)}</span></span>
                </span>
                {byMail && <span className="rp-tag"><Icon name="mail" size={14} />{t({ fr: 'Par mail', en: 'By email' })}</span>}
                {guest && <span className="rp-tag"><Icon name="videocam" size={14} />{t({ fr: 'Appel seul', en: 'Call only' })}</span>}
                {p.id !== viewerId && !guest && role !== 'guest' && (
                  <IconButton icon="chat_bubble" size={32} label={t({ fr: `Écrire en privé à ${p.name}`, en: `Message ${p.name} privately` })} onClick={() => write(p)} />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Frame>
  )
}

export function NotesBlock({ block }: { block: Of<'notes'> }) {
  const t = useT()
  const { project, role } = useBoard()
  const patchBlock = useStore((s) => s.patchBlock)
  const stored = t(block.text)
  const [draft, setDraft] = useState(stored)
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const value = editing ? draft : stored
  // CSS field-sizing is not everywhere yet: size the field by hand.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  const save = () => {
    setEditing(false)
    if (draft !== stored) patchBlock(project.id, block.id, { text: draft })
  }
  return (
    <Frame block={block}>
      <textarea
        ref={ref}
        className="rp-notes"
        rows={3}
        value={value}
        readOnly={role === 'guest'}
        aria-label={t(block.title)}
        placeholder={t({ fr: 'Écrivez quelque chose pour tout le projet…', en: 'Write something for the whole project…' })}
        onFocus={() => { setDraft(stored); setEditing(true) }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Escape') { setDraft(stored); e.currentTarget.blur() } }}
      />
    </Frame>
  )
}

export function PollBlock({ block }: { block: Of<'poll'> }) {
  const t = useT()
  const { project, role, viewerId } = useBoard()
  const patchBlock = useStore((s) => s.patchBlock)
  const total = block.options.reduce((n, o) => n + o.votes.length, 0)
  const vote = (id: string) => {
    const options = block.options.map((o) => {
      const without = o.votes.filter((v) => v !== viewerId)
      return o.id === id && !o.votes.includes(viewerId) ? { ...o, votes: [...without, viewerId] } : { ...o, votes: without }
    })
    patchBlock(project.id, block.id, { options })
  }
  return (
    <Frame block={block}>
      <p className="rp-poll-q">{t(block.question)}</p>
      {block.options.length === 0 ? <Empty icon="ballot" title={t({ fr: 'Pas encore d’option', en: 'No options yet' })} /> : (
        <ul className="rp-poll">
          {block.options.map((o) => {
            const mine = o.votes.includes(viewerId)
            const share = total ? Math.round((o.votes.length / total) * 100) : 0
            const label = t(o.label)
            return (
              <li key={o.id}>
                <button type="button" className={`rp-poll-opt${mine ? ' mine' : ''}`} aria-pressed={mine} disabled={role === 'guest'} onClick={() => vote(o.id)}>
                  <span className="rp-poll-fill" style={{ width: `${share}%` }} />
                  <Icon name={mine ? 'check_circle' : 'radio_button_unchecked'} fill={mine} size={18} />
                  <span className="rp-trunc rp-poll-label" title={label}>{label}</span>
                  <span className="rp-poll-share">{share}%</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="rp-meta" aria-live="polite">{total === 0 ? t({ fr: 'Aucun vote, soyez le premier', en: 'No votes yet, be the first' }) : total === 1 ? t({ fr: '1 vote', en: '1 vote' }) : t({ fr: `${total} votes`, en: `${total} votes` })}</p>
    </Frame>
  )
}
