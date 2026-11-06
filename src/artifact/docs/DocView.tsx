import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Artifact, Txt } from '../../data/types'
import { fmtTime, useT } from '../../i18n'
import { personById, useStore } from '../../store'
import { Avatar, AvatarStack, Button, Icon, IconButton, Sparkle } from '../../ui/kit'
import { prefersReducedMotion, useBoard } from '../shared'
import { ArtifactHeader } from './Header'

type Doc = Extract<Artifact, { kind: 'doc' }>
type Section = Doc['sections'][number]

/** contentEditable that React never re-renders while it has the focus, so the caret stays put. */
function Editable({ value, onInput, readOnly, placeholder, as: Tag, label, className }: { value: string; onInput: (v: string) => void; readOnly: boolean; placeholder: string; as: 'h1' | 'h3' | 'div'; label: string; className: string }) {
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || document.activeElement === el) return
    if (el.innerText !== value) el.innerText = value
    el.dataset.empty = String(!value)
  }, [value])
  const El = Tag as 'div'
  return (
    <El
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`rp-edit ${className}`}
      contentEditable={readOnly ? false : 'plaintext-only'}
      suppressContentEditableWarning
      role="textbox"
      aria-multiline={Tag === 'div'}
      aria-label={label}
      aria-readonly={readOnly}
      data-placeholder={placeholder}
      spellCheck
      onKeyDown={(e) => { if (Tag !== 'div' && e.key === 'Enter') e.preventDefault() }}
      onInput={(e) => {
        const text = e.currentTarget.innerText.replace(/\n$/, '')
        e.currentTarget.dataset.empty = String(!text.trim())
        onInput(text)
      }}
    />
  )
}

export function DocView({ doc }: { doc: Doc }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const { project, role, viewerId } = useBoard()
  const patchArtifact = useStore((s) => s.patchArtifact)
  const [state, setState] = useState<'saved' | 'saving'>('saved')
  const [summary, setSummary] = useState<'off' | 'busy' | 'on'>('off')
  const [resolved, setResolved] = useState(false)
  const [commentTop, setCommentTop] = useState(0)
  const [reply, setReply] = useState('')
  const [replies, setReplies] = useState<string[]>([])
  const page = useRef<HTMLDivElement>(null)
  const anchor = useRef<HTMLDivElement>(null)
  const readOnly = role === 'guest'

  // Latest text waiting to be saved. Flushed on a timer, on leaving the view and on leaving the page.
  const pending = useRef<Partial<Doc> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const flush = useCallback(() => {
    clearTimeout(timer.current)
    if (!pending.current) return
    patchArtifact(project.id, doc.id, { ...pending.current, updatedAt: Date.now() } as Partial<Artifact>)
    pending.current = null
    setState('saved')
  }, [patchArtifact, project.id, doc.id])
  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => { window.removeEventListener('pagehide', flush); flush() }
  }, [flush])
  const queue = (patch: Partial<Doc>) => {
    pending.current = { ...pending.current, ...patch }
    setState('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, 500)
  }

  const sectionsRef = useRef<Section[]>(doc.sections.length ? doc.sections : [{ body: '' }])
  useEffect(() => { if (!pending.current) sectionsRef.current = doc.sections.length ? doc.sections : [{ body: '' }] }, [doc.sections])
  const editSection = (i: number, patch: Partial<Section>) => {
    sectionsRef.current = sectionsRef.current.map((s, x) => (x === i ? { ...s, ...patch } : s))
    queue({ sections: sectionsRef.current })
  }

  const sections = doc.sections.length ? doc.sections : [{ body: '' as Txt }]
  const anchorIndex = Math.min(1, sections.length - 1)
  const commenterId = project.memberIds.find((id) => id !== doc.ownerId && id !== viewerId && personById(id).role !== 'ai') ?? doc.ownerId
  const commenter = personById(commenterId)
  const viewing = [...new Set([doc.ownerId, ...project.memberIds.filter((id) => personById(id).presence === 'online' && personById(id).role !== 'ai'), viewerId])].slice(0, 4)

  useLayoutEffect(() => {
    const measure = () => {
      if (anchor.current && page.current) setCommentTop(anchor.current.getBoundingClientRect().top - page.current.getBoundingClientRect().top)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (page.current) ro.observe(page.current)
    return () => ro.disconnect()
  }, [summary])

  const summaryTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(summaryTimer.current), [])
  const summarize = () => {
    if (summary === 'busy') return
    if (summary === 'on') { setSummary('off'); return }
    setSummary('busy')
    summaryTimer.current = setTimeout(() => setSummary('on'), prefersReducedMotion() ? 200 : 1100)
  }
  // The "summary" is really made from what is on the page, so it follows the edits.
  const points = sections
    .map((s) => ({ head: t(s.heading), first: t(s.body).split(/(?<=[.!?])\s/)[0]?.trim() ?? '' }))
    .filter((p) => p.first)
    .slice(0, 4)

  const sendReply = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reply.trim()) return
    setReplies((r) => [...r, reply.trim()])
    setReply('')
  }

  return (
    <div className="rp-doc">
      <ArtifactHeader artifact={doc}>
        <span className="rp-saved" aria-live="polite" data-state={state}>
          <Icon name={state === 'saved' ? 'cloud_done' : 'cloud_sync'} size={18} />
          <span>{state === 'saved' ? t({ fr: 'Enregistré', en: 'Saved' }) : t({ fr: 'Enregistrement…', en: 'Saving…' })}</span>
        </span>
        <span aria-label={t({ fr: 'En train de consulter', en: 'Viewing now' })} role="group"><AvatarStack ids={viewing} size={24} max={3} /></span>
      </ArtifactHeader>
      <div className="rp-doc-canvas">
        <div className="rp-doc-layout">
          <div ref={page} className="rp-doc-column">
            <div className="rp-doc-page">
              <button type="button" className={`rp-gem-chip${summary !== 'off' ? ' on' : ''}`} aria-expanded={summary !== 'off'} onClick={summarize}>
                <Sparkle size={16} />{t({ fr: 'Résumer', en: 'Summarize' })}
              </button>
              {summary !== 'off' && (
                <aside className="rp-doc-summary" aria-live="polite" aria-busy={summary === 'busy'}>
                  {summary === 'busy' ? (
                    <div className="rp-shimmer-group"><span className="rp-shimmer" style={{ width: '90%' }} /><span className="rp-shimmer" style={{ width: '72%' }} /></div>
                  ) : points.length === 0 ? (
                    <p>{t({ fr: 'Rien à résumer pour l’instant : ce document est vide.', en: 'Nothing to summarize yet: this document is empty.' })}</p>
                  ) : (
                    <ul>{points.map((p, i) => <li key={i}>{p.head && <b>{p.head}: </b>}{p.first}</li>)}</ul>
                  )}
                  {summary === 'on' && <IconButton icon="close" size={32} label={t({ fr: 'Fermer le résumé', en: 'Close summary' })} onClick={() => setSummary('off')} />}
                </aside>
              )}
              <Editable as="h1" className="rp-doc-h1" value={t(doc.title)} readOnly={readOnly} label={t({ fr: 'Titre du document', en: 'Document title' })} placeholder={t({ fr: 'Sans titre', en: 'Untitled' })} onInput={(v) => queue({ title: v })} />
              {sections.map((s, i) => (
                <div key={i} ref={i === anchorIndex ? anchor : undefined} className={`rp-doc-section${i === anchorIndex && !resolved ? ' commented' : ''}`}>
                  {s.heading != null && <Editable as="h3" className="rp-doc-h3" value={t(s.heading)} readOnly={readOnly} label={t({ fr: 'Intertitre', en: 'Heading' })} placeholder={t({ fr: 'Intertitre', en: 'Heading' })} onInput={(v) => editSection(i, { heading: v })} />}
                  <Editable as="div" className="rp-doc-body" value={t(s.body)} readOnly={readOnly} label={t({ fr: 'Texte du document', en: 'Document text' })} placeholder={t({ fr: 'Commencez à écrire…', en: 'Start writing…' })} onInput={(v) => editSection(i, { body: v })} />
                </div>
              ))}
            </div>
            {!resolved && (
              <aside className="rp-comment" style={{ '--top': `${commentTop}px` } as React.CSSProperties} aria-label={t({ fr: 'Commentaire', en: 'Comment' })}>
                <div className="rp-comment-head">
                  <Avatar person={commenter} size={28} />
                  <span className="rp-row-main"><span className="rp-trunc">{commenter.name}</span><span className="rp-row-sub">{fmtTime(doc.updatedAt, lang)}</span></span>
                  <IconButton icon="check" size={32} label={t({ fr: 'Marquer comme résolu', en: 'Mark as resolved' })} onClick={() => setResolved(true)} />
                </div>
                <p>{t({ fr: 'On devrait préciser la date ici, sinon l’équipe va me la redemander. Tu confirmes ?', en: 'We should pin down the date here or the team will ask me again. Can you confirm?' })}</p>
                {replies.map((r, i) => <p key={i} className="rp-comment-reply"><Avatar id={viewerId} size={20} /><span>{r}</span></p>)}
                {!readOnly && (
                  <form onSubmit={sendReply} className="rp-comment-form">
                    <input className="rp-inline-input" value={reply} maxLength={300} onChange={(e) => setReply(e.target.value)} placeholder={t({ fr: 'Répondre', en: 'Reply' })} aria-label={t({ fr: 'Répondre au commentaire', en: 'Reply to the comment' })} />
                    {reply.trim() && <Button size="s" type="submit">{t({ fr: 'Envoyer', en: 'Send' })}</Button>}
                  </form>
                )}
              </aside>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
