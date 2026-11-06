/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The project's documents: a paperclip in the tab row, and a Drive-like view behind "See all files".
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Artifact, Block } from '../../data/types'
import { fmtDate, fmtTime, useT } from '../../i18n'
import { personById, useStore } from '../../store'
import { Avatar, Button, Icon } from '../../ui/kit'
import { Slide } from '../docs/SlidesView'
import { Empty, Frame, KindIcon, KINDS, startOfDay, useBoard } from '../shared'

const whenOf = (at: number, lang: 'fr' | 'en') => (startOfDay(at) === startOfDay(Date.now()) ? fmtTime(at, lang) : fmtDate(at, lang))
const newestFirst = (list: Artifact[]) => [...list].sort((a, b) => b.updatedAt - a.updatedAt)
const askForBrief = () => window.dispatchEvent(new CustomEvent('oneplace:compose', { detail: { text: '@Gemini draft a project brief' } }))

/** A real miniature of the document's own content, not a picture of a generic page. */
function Thumb({ a }: { a: Artifact }) {
  const t = useT()
  switch (a.kind) {
    case 'doc':
      return (
        <span className="rp-th rp-th-doc" aria-hidden="true">
          <b>{t(a.title)}</b>
          {a.sections.slice(0, 4).map((s, i) => <span key={i}>{s.heading != null && <em>{t(s.heading)}</em>}{t(s.body).slice(0, 220)}</span>)}
        </span>
      )
    case 'sheet':
      return (
        <span className="rp-th rp-th-sheet" aria-hidden="true">
          <table><tbody>
            <tr>{a.columns.slice(0, 4).map((c, i) => <th key={i}>{t(c)}</th>)}</tr>
            {a.rows.slice(0, 9).map((r, i) => <tr key={i}>{a.columns.slice(0, 4).map((_, c) => <td key={c} className={typeof r[c] === 'number' ? 'num' : ''}>{typeof r[c] === 'number' ? (r[c] as number).toLocaleString('en-US') : r[c]}</td>)}</tr>)}
          </tbody></table>
        </span>
      )
    case 'slides':
      return a.slides[0] ? <span className="rp-th rp-th-slide" aria-hidden="true"><Slide slide={a.slides[0]} index={0} /></span> : <span className="rp-th" aria-hidden="true" />
    case 'pdf':
      return <span className="rp-th rp-th-doc rp-th-pdf" aria-hidden="true"><b>{t(a.title)}</b><span>{t(a.excerpt)}</span></span>
    default:
      return <span className="rp-th" aria-hidden="true" />
  }
}

/** The paperclip next to Gemini. A short list with search; everything else is one click further. */
export function FilesButton({ onSeeAll, on }: { onSeeAll: () => void; on: boolean }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const { project } = useBoard()
  const setPane = useStore((s) => s.setPane)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const chip = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const restore = useRef(true)
  const docs = newestFirst(project.artifacts)
  const q = query.trim().toLowerCase()
  const found = q ? docs.filter((a) => t(a.title).toLowerCase().includes(q)) : docs

  useEffect(() => {
    if (!open) return
    setQuery('')
    restore.current = true
    pop.current?.querySelector('input')?.focus()
    const down = (e: MouseEvent) => {
      const target = e.target as Node
      if (pop.current?.contains(target) || chip.current?.contains(target)) return
      restore.current = false
      setOpen(false)
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key, true)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key, true)
      if (restore.current) chip.current?.focus()
    }
  }, [open])

  const openDoc = (a: Artifact) => { restore.current = false; setOpen(false); setPane({ type: 'artifact', id: a.id }) }
  const seeAll = () => { restore.current = false; setOpen(false); onSeeAll() }
  const label = docs.length === 1 ? t({ fr: '1 fichier', en: '1 file' }) : t({ fr: `${docs.length} fichiers`, en: `${docs.length} files` })
  const phone = typeof matchMedia === 'function' && matchMedia('(max-width:599px)').matches
  const panel = open && (
    <div ref={pop} className="rp-files-pop" role="dialog" aria-label={t({ fr: 'Fichiers du projet', en: 'Project files' })}>
      <div className="rp-files-search">
        <Icon name="search" size={18} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t({ fr: 'Chercher un fichier', en: 'Search files' })} aria-label={t({ fr: 'Chercher un fichier', en: 'Search files' })} />
      </div>
      {docs.length === 0 ? (
        <Empty icon="attach_file" title={t({ fr: 'Aucun fichier', en: 'No files yet' })} hint={t({ fr: 'Glissez un fichier dans le chat, ou demandez un brief à Gemini.', en: 'Drop a file in the chat, or ask Gemini for a brief.' })} />
      ) : found.length === 0 ? (
        <p className="rp-files-none">{t({ fr: 'Aucun résultat', en: 'No file matches that search' })}</p>
      ) : (
        <ul className="rp-files-list">
          {found.map((a) => {
            const title = t(a.title)
            return (
              <li key={a.id}>
                <button type="button" onClick={() => openDoc(a)} title={title}>
                  <KindIcon kind={a.kind} size={20} />
                  <span className="rp-row-main"><span className="rp-trunc">{title}</span><span className="rp-row-sub rp-trunc">{t(KINDS[a.kind]?.label)}, {whenOf(a.updatedAt, lang)}</span></span>
                  <Avatar id={a.ownerId} size={24} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <div className="rp-files-foot"><Button size="s" onClick={seeAll}>{t({ fr: 'Voir tous les fichiers', en: 'See all files' })}</Button></div>
    </div>
  )
  return (
    <>
      <button ref={chip} type="button" className={`rp-clip${open || on ? ' on' : ''}`} aria-expanded={open} aria-haspopup="dialog" aria-label={t({ fr: `Fichiers, ${label}`, en: `Files, ${label}` })} title={t({ fr: 'Fichiers', en: 'Files' })} onClick={() => setOpen((o) => !o)}>
        <Icon name="attach_file" size={20} />
        {docs.length > 0 && <span className="rp-clip-n">{docs.length}</span>}
      </button>
      {panel && createPortal(<div className="rp-files-layer">{panel}</div>, phone ? document.body : chip.current?.closest('.right-pane') ?? document.body)}
    </>
  )
}

type Kind = 'all' | Artifact['kind']
type Sort = { by: 'modified' | 'name'; dir: 1 | -1 }

export function FilesBlock({ block }: { block: Extract<Block, { type: 'files' }> }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const { project, role } = useBoard()
  const setPane = useStore((s) => s.setPane)
  const [kind, setKind] = useState<Kind>('all')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>({ by: 'modified', dir: -1 })
  const docs = project.artifacts
  const kinds = useMemo(() => [...new Set(docs.map((a) => a.kind))], [docs])
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = docs.filter((a) => (kind === 'all' || a.kind === kind) && (!q || t(a.title).toLowerCase().includes(q)))
    return [...list].sort((a, b) => (sort.by === 'name' ? t(a.title).localeCompare(t(b.title)) : a.updatedAt - b.updatedAt) * sort.dir)
  }, [docs, kind, query, sort]) // eslint-disable-line react-hooks/exhaustive-deps
  const open = (a: Artifact) => setPane({ type: 'artifact', id: a.id })
  const CHIP_NAMES: Record<string, string> = { doc: t({ fr: 'Documents', en: 'Docs' }), sheet: t({ fr: 'Feuilles', en: 'Sheets' }), slides: t({ fr: 'Présentations', en: 'Slides' }), pdf: 'PDFs' }
  const sortBy = (by: Sort['by']) => setSort((s) => (s.by === by ? { by, dir: s.dir === 1 ? -1 : 1 } : { by, dir: by === 'name' ? 1 : -1 }))
  const arrow = (by: Sort['by']) => (sort.by === by ? <Icon name={sort.dir === 1 ? 'arrow_upward' : 'arrow_downward'} size={14} /> : null)

  return (
    <Frame
      block={block}
      className="rp-fill rp-dv"
      actions={docs.length > 0 && (
        <div className="rp-seg rp-seg-icons" role="group" aria-label={t({ fr: 'Affichage', en: 'Layout' })}>
          <button type="button" className={layout === 'grid' ? 'on' : ''} aria-pressed={layout === 'grid'} aria-label={t({ fr: 'Grille', en: 'Grid' })} title={t({ fr: 'Grille', en: 'Grid' })} onClick={() => setLayout('grid')}><Icon name="grid_view" size={18} /></button>
          <button type="button" className={layout === 'list' ? 'on' : ''} aria-pressed={layout === 'list'} aria-label={t({ fr: 'Liste', en: 'List' })} title={t({ fr: 'Liste', en: 'List' })} onClick={() => setLayout('list')}><Icon name="view_list" size={18} /></button>
        </div>
      )}
    >
      {docs.length === 0 ? (
        <div className="rp-rm-empty">
          <Empty icon="attach_file" title={t({ fr: 'Aucun fichier', en: 'No files yet' })} hint={t({ fr: 'Glissez un fichier dans le chat : il arrive ici.', en: 'Drop a file in the chat and it shows up here, or ask Gemini for a first draft.' })}>
            {role !== 'guest' && <Button variant="tonal" size="s" onClick={askForBrief}>{t({ fr: 'Demander un brief à Gemini', en: 'Ask Gemini for a brief' })}</Button>}
          </Empty>
        </div>
      ) : (
        <>
          <div className="rp-drive-tools">
            <div className="rp-td-chips" role="group" aria-label={t({ fr: 'Type', en: 'Type' })}>
              <button type="button" className={`chip click${kind === 'all' ? ' selected' : ''}`} aria-pressed={kind === 'all'} onClick={() => setKind('all')}>{t({ fr: 'Tous', en: 'All' })}<span className="rp-td-chipn">{docs.length}</span></button>
              {kinds.map((k) => (
                <button key={k} type="button" className={`chip click${kind === k ? ' selected' : ''}`} aria-pressed={kind === k} onClick={() => setKind(k)}>
                  <KindIcon kind={k} size={16} />{CHIP_NAMES[k] ?? k}
                </button>
              ))}
            </div>
            <div className="rp-files-search rp-drive-search">
              <Icon name="search" size={18} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t({ fr: 'Chercher', en: 'Search' })} aria-label={t({ fr: 'Chercher un fichier', en: 'Search files' })} />
            </div>
          </div>
          <div className="rp-drive-body">
            {shown.length === 0 ? (
              <p className="rp-files-none">{t({ fr: 'Aucun résultat', en: 'No file matches' })}</p>
            ) : layout === 'grid' ? (
              <ul className="rp-drive-grid">
                {shown.map((a) => {
                  const title = t(a.title)
                  const owner = personById(a.ownerId)
                  return (
                    <li key={a.id}>
                      <button type="button" className="rp-drive-card" onClick={() => open(a)} title={title}>
                        <span className="rp-drive-top"><KindIcon kind={a.kind} size={20} /><span className="rp-trunc">{title}</span></span>
                        <span className="rp-drive-thumb"><Thumb a={a} /></span>
                        <span className="rp-drive-foot"><Avatar person={owner} size={24} /><span className="rp-trunc">{owner.name.split(' ')[0]}, {whenOf(a.updatedAt, lang)}</span></span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <table className="rp-drive-table">
                <thead>
                  <tr>
                    <th scope="col" aria-sort={sort.by === 'name' ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}><button type="button" onClick={() => sortBy('name')}>{t({ fr: 'Nom', en: 'Name' })}{arrow('name')}</button></th>
                    <th scope="col" className="rp-drive-owner">{t({ fr: 'Propriétaire', en: 'Owner' })}</th>
                    <th scope="col" className="rp-drive-kind">{t({ fr: 'Type', en: 'Type' })}</th>
                    <th scope="col" aria-sort={sort.by === 'modified' ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}><button type="button" onClick={() => sortBy('modified')}>{t({ fr: 'Modifié', en: 'Last modified' })}{arrow('modified')}</button></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((a) => {
                    const owner = personById(a.ownerId)
                    const title = t(a.title)
                    return (
                      <tr key={a.id}>
                        <td><button type="button" className="rp-drive-name" title={title} onClick={() => open(a)}><KindIcon kind={a.kind} size={20} /><span className="rp-trunc">{title}</span></button></td>
                        <td className="rp-drive-owner"><span className="rp-drive-person"><Avatar person={owner} size={24} /><span className="rp-trunc">{owner.name}</span></span></td>
                        <td className="rp-drive-kind">{t(KINDS[a.kind]?.label)}</td>
                        <td className="rp-drive-when">{whenOf(a.updatedAt, lang)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </Frame>
  )
}
