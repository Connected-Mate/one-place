/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Viewers for what is not a Workspace document: images, videos and other files. They open in the pane like everything else.
import { useState, type ReactNode } from 'react'
import type { Artifact } from '../../data/types'
import { fmtDate, useT } from '../../i18n'
import { personById, useStore } from '../../store'
import { Avatar, base, Icon, IconButton } from '../../ui/kit'
import { ArtifactHeader } from './Header'
import { Player } from './Player'

const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3]
export const sizeLabel = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`)

function Facts({ rows, a }: { rows: [string, ReactNode][]; a: Artifact }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const owner = personById(a.ownerId)
  return (
    <dl className="rp-facts">
      {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      <div><dt>{t({ fr: 'Propriétaire', en: 'Owner' })}</dt><dd className="rp-facts-owner"><Avatar person={owner} size={20} />{owner.name}</dd></div>
      <div><dt>{t({ fr: 'Modifié', en: 'Modified' })}</dt><dd>{fmtDate(a.updatedAt, lang)}</dd></div>
    </dl>
  )
}

export function ImageView({ image }: { image: Extract<Artifact, { kind: 'image' }> }) {
  const t = useT()
  const [zoom, setZoom] = useState<number | 'fit'>('fit')
  const [broken, setBroken] = useState(false)
  const shown = zoom === 'fit' ? 'fit' : zoom
  const step = (d: number) => setZoom((z) => {
    const now = z === 'fit' ? 1 : z
    return ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(now) + d))]
  })
  return (
    <div className="rp-doc">
      <ArtifactHeader artifact={image} />
      <div className="rp-img-main">
        <div
          className={`rp-img-stage${zoom === 'fit' ? ' fit' : ''}`}
          role="region"
          tabIndex={0}
          aria-label={t(image.title)}
          onKeyDown={(e) => {
            if (e.key === '+' || e.key === '=') { e.preventDefault(); step(1) }
            if (e.key === '-') { e.preventDefault(); step(-1) }
            if (e.key === '0') { e.preventDefault(); setZoom('fit') }
          }}
        >
          {broken
            ? <span className="rp-file-big"><Icon name="broken_image" size={48} /></span>
            : <img src={base + image.src} alt={t(image.caption) || t(image.title)} width={image.width} height={image.height} onError={() => setBroken(true)} style={zoom === 'fit' ? undefined : { width: image.width * zoom, height: image.height * zoom }} />}
          <div className="rp-pdf-bar rp-img-bar">
            <IconButton icon="remove" size={32} disabled={zoom !== 'fit' && zoom === ZOOMS[0]} label={t({ fr: 'Dézoomer', en: 'Zoom out' })} onClick={() => step(-1)} />
            <button type="button" className="rp-img-fit" aria-label={t({ fr: 'Ajuster à la fenêtre', en: 'Fit to window' })} onClick={() => setZoom('fit')}>{shown === 'fit' ? t({ fr: 'Ajusté', en: 'Fit' }) : `${Math.round((shown as number) * 100)}%`}</button>
            <IconButton icon="add" size={32} disabled={zoom === ZOOMS[ZOOMS.length - 1]} label={t({ fr: 'Zoomer', en: 'Zoom in' })} onClick={() => step(1)} />
          </div>
        </div>
        <Facts a={image} rows={[
          [t({ fr: 'Type', en: 'Type' }), image.format],
          [t({ fr: 'Dimensions', en: 'Dimensions' }), `${image.width} x ${image.height}`],
          [t({ fr: 'Taille', en: 'Size' }), sizeLabel(image.sizeKb)],
          ...(image.caption ? [[t({ fr: 'Description', en: 'Description' }), t(image.caption)] as [string, ReactNode]] : []),
        ]} />
      </div>
    </div>
  )
}

export function VideoView({ video }: { video: Extract<Artifact, { kind: 'video' }> }) {
  const t = useT()
  const audio = video.overview === 'audio'
  const type = video.overview === 'audio' ? t({ fr: 'Synthèse audio NotebookLM', en: 'NotebookLM Audio Overview' }) : video.overview === 'video' ? t({ fr: 'Synthèse vidéo NotebookLM', en: 'NotebookLM Video Overview' }) : t({ fr: 'Vidéo', en: 'Video' })
  return (
    <div className="rp-doc">
      <ArtifactHeader artifact={video} />
      <div className="rp-img-main rp-video-main">
        <div className="rp-video-col">
          <Player kind={audio ? 'audio' : 'video'} title={t(video.title)} durationSec={video.durationSec} poster={video.poster ? base + video.poster : undefined} transcript={video.transcript} />
        </div>
        <Facts a={video} rows={[
          [t({ fr: 'Type', en: 'Type' }), type],
          [t({ fr: 'Durée', en: 'Length' }), `${Math.floor(video.durationSec / 60)}:${String(video.durationSec % 60).padStart(2, '0')}`],
          [t({ fr: 'Taille', en: 'Size' }), `${video.sizeMb} MB`],
        ]} />
      </div>
    </div>
  )
}

export function FileView({ file }: { file: Extract<Artifact, { kind: 'file' }> }) {
  const t = useT()
  const icon = /csv|xls|tsv/i.test(file.ext) ? 'table_chart' : /zip|tar|rar/i.test(file.ext) ? 'folder_zip' : 'draft'
  return (
    <div className="rp-doc">
      <ArtifactHeader artifact={file} />
      <div className="rp-img-main">
        <div className="rp-file-main">
          {file.preview ? (
            <div className="rp-file-preview" role="region" tabIndex={0} aria-label={t({ fr: 'Aperçu', en: 'Preview' })}>
              <table>
                <thead><tr>{file.preview[0].map((c, i) => <th key={i} scope="col">{c}</th>)}</tr></thead>
                <tbody>{file.preview.slice(1).map((r, i) => <tr key={i}>{r.map((c, x) => <td key={x}>{c}</td>)}</tr>)}</tbody>
              </table>
            </div>
          ) : (
            <div className="rp-file-big">
              <Icon name={icon} size={64} />
              <b>{file.ext.toUpperCase()}</b>
              <p>{t({ fr: 'Pas d’aperçu pour ce type de fichier.', en: 'No preview for this type of file.' })}</p>
            </div>
          )}
        </div>
        <Facts a={file} rows={[
          [t({ fr: 'Type', en: 'Type' }), file.ext.toUpperCase()],
          [t({ fr: 'Taille', en: 'Size' }), sizeLabel(file.sizeKb)],
          ...(file.description ? [[t({ fr: 'Description', en: 'Description' }), t(file.description)] as [string, ReactNode]] : []),
        ]} />
      </div>
    </div>
  )
}
