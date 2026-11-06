/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// A notebook as NotebookLM shows it: sources on the left, summary and notes in the middle, Audio and Video Overviews on the right.
import { useState } from 'react'
import type { Artifact, NotebookSource } from '../../data/types'
import { useT } from '../../i18n'
import { useStore } from '../../store'
import { base, Icon, Sparkle } from '../../ui/kit'
import { useBoard } from '../shared'
import { ArtifactHeader } from './Header'
import { Player } from './Player'

const SOURCE_ICON: Record<NotebookSource['type'], { icon: string }> = { pdf: { icon: 'picture_as_pdf' }, doc: { icon: 'description' }, web: { icon: 'language' }, slides: { icon: 'slideshow' }, audio: { icon: 'graphic_eq' }, text: { icon: 'notes' } }

export function NotebookView({ nb }: { nb: Extract<Artifact, { kind: 'notebook' }> }) {
  const t = useT()
  const { project, role } = useBoard()
  const patchArtifact = useStore((s) => s.patchArtifact)
  const [openSource, setOpenSource] = useState<string | null>(null)
  const [overview, setOverview] = useState(nb.overviews[0]?.id ?? null)
  const [note, setNote] = useState('')
  const addNote = (e: React.FormEvent) => {
    e.preventDefault()
    const text = note.trim()
    if (!text) return
    patchArtifact(project.id, nb.id, { notes: [...nb.notes, text], updatedAt: Date.now() })
    setNote('')
  }
  const active = nb.overviews.find((o) => o.id === overview)
  return (
    <div className="rp-doc">
      <ArtifactHeader artifact={nb} />
      <div className="rp-nb">
        <section className="rp-nb-col rp-nb-sources" aria-label={t({ fr: 'Sources', en: 'Sources' })}>
          <h3>{t({ fr: 'Sources', en: 'Sources' })}<span>{nb.sources.length}</span></h3>
          <ul>
            {nb.sources.map((s) => {
              const open = openSource === s.id
              return (
                <li key={s.id}>
                  <button type="button" aria-expanded={open} disabled={!s.note} onClick={() => setOpenSource(open ? null : s.id)}>
                    <Icon name={SOURCE_ICON[s.type].icon} size={18} />
                    <span>{t(s.title)}</span>
                  </button>
                  {open && s.note && <p>{t(s.note)}</p>}
                </li>
              )
            })}
          </ul>
        </section>
        <section className="rp-nb-col rp-nb-center" aria-label={t({ fr: 'Résumé et notes', en: 'Summary and notes' })}>
          <h3><Sparkle size={16} />{t({ fr: 'Résumé', en: 'Summary' })}</h3>
          <p className="rp-nb-summary">{t(nb.summary)}</p>
          <h3>{t({ fr: 'Notes', en: 'Saved notes' })}</h3>
          {nb.notes.length > 0 && <ul className="rp-nb-notes">{nb.notes.map((n, i) => <li key={i}>{t(n)}</li>)}</ul>}
          {role !== 'guest' && (
            <form className="rp-td-add rp-nb-add" onSubmit={addNote}>
              <Icon name="add" size={18} />
              <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder={t({ fr: 'Ajouter une note', en: 'Add a note' })} aria-label={t({ fr: 'Ajouter une note', en: 'Add a note' })} />
            </form>
          )}
        </section>
        <section className="rp-nb-col rp-nb-studio" aria-label={t({ fr: 'Studio', en: 'Studio' })}>
          <h3>{t({ fr: 'Studio', en: 'Studio' })}</h3>
          {nb.overviews.length === 0 && <p className="rp-meta">{t({ fr: 'Pas encore de synthèse.', en: 'No overviews yet.' })}</p>}
          <ul className="rp-nb-overviews">
            {nb.overviews.map((o) => (
              <li key={o.id}>
                <button type="button" className={overview === o.id ? 'on' : ''} aria-pressed={overview === o.id} onClick={() => setOverview(o.id)}>
                  <Icon name={o.type === 'audio' ? 'graphic_eq' : 'movie'} size={20} />
                  <span className="rp-row-main"><span className="rp-trunc">{t(o.title)}</span><span className="rp-row-sub">{o.type === 'audio' ? t({ fr: 'Synthèse audio', en: 'Audio Overview' }) : t({ fr: 'Synthèse vidéo', en: 'Video Overview' })}, {Math.round(o.durationSec / 60)} min</span></span>
                </button>
              </li>
            ))}
          </ul>
          {active && <Player key={active.id} kind={active.type} title={t(active.title)} durationSec={active.durationSec} poster={active.poster ? base + active.poster : undefined} transcript={active.transcript} />}
        </section>
      </div>
    </div>
  )
}
