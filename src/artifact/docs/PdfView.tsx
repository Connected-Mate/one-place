import { useEffect, useRef, useState } from 'react'
import type { Artifact } from '../../data/types'
import { useT } from '../../i18n'
import { IconButton } from '../../ui/kit'
import { Empty } from '../shared'
import { ArtifactHeader } from './Header'

type Pdf = Extract<Artifact, { kind: 'pdf' }>
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const MAX_RENDERED = 200 // a 2 000 page file should not take the tab down: this is a demo

const FILLER = [
  { fr: 'Le présent document décrit le périmètre retenu, les hypothèses de travail et les engagements de chaque partie. Il remplace toute version antérieure et fait foi jusqu’à sa prochaine révision.', en: 'This document sets out the agreed scope, the working assumptions and what each party commits to. It replaces any earlier version and stands until its next revision.' },
  { fr: 'Les délais indiqués supposent une validation sous cinq jours ouvrés. Tout retard de validation décale d’autant les étapes suivantes, sans modifier les prix convenus.', en: 'The timings given assume sign-off within five working days. Any delay in sign-off moves the following stages by the same amount, without changing the agreed prices.' },
  { fr: 'Les échantillons sont contrôlés par lot. Un lot est accepté lorsque moins de deux pour cent des pièces présentent un défaut visible à un mètre, sous lumière du jour.', en: 'Samples are inspected per batch. A batch is accepted when fewer than two percent of the pieces show a defect visible at one meter, in daylight.' },
  { fr: 'Les informations contenues dans ce document sont confidentielles. Elles ne peuvent être transmises à un tiers qu’après accord écrit des deux parties.', en: 'The information in this document is confidential. It may only be passed on to a third party with the written agreement of both parties.' },
]

export function PdfView({ pdf }: { pdf: Pdf }) {
  const t = useT()
  const pages = Math.max(0, Math.min(MAX_RENDERED, Math.floor(pdf.pages)))
  const [zoom, setZoom] = useState(1)
  const [page, setPage] = useState(1)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const ratios = new Map<number, number>()
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) ratios.set(Number((e.target as HTMLElement).dataset.page), e.intersectionRatio)
      let best = 1, top = -1
      for (const [p, r] of ratios) if (r > top) { top = r; best = p }
      setPage(best)
    }, { root, threshold: [0, 0.25, 0.5, 0.75, 1] })
    root.querySelectorAll('[data-page]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [pages])

  const goTo = (n: number) => {
    const target = Math.max(1, Math.min(pages, n))
    const box = scroller.current, el = box?.querySelector(`[data-page="${target}"]`)
    if (box && el) box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - 16
    setPage(target)
  }
  const stepZoom = (d: number) => setZoom((z) => ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + d))])
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === '+' || e.key === '=') { e.preventDefault(); stepZoom(1) }
    if (e.key === '-') { e.preventDefault(); stepZoom(-1) }
    if (e.key === 'PageDown') { e.preventDefault(); goTo(page + 1) }
    if (e.key === 'PageUp') { e.preventDefault(); goTo(page - 1) }
  }
  const excerpt = t(pdf.excerpt)
  const title = t(pdf.title)

  return (
    <div className="rp-doc">
      <ArtifactHeader artifact={pdf} />
      {pages === 0 ? <Empty icon="picture_as_pdf" title={t({ fr: 'Ce PDF n’a aucune page', en: 'This PDF has no pages' })} /> : (
        <>
          <div ref={scroller} className="rp-pdf-scroll" tabIndex={0} role="region" aria-label={title} onKeyDown={onKey}>
            <div className="rp-pdf-pages" style={{ '--z': zoom } as React.CSSProperties}>
              {Array.from({ length: pages }, (_, i) => {
                const n = i + 1
                return (
                  <article key={n} className="rp-pdf-page" data-page={n} aria-label={t({ fr: `Page ${n}`, en: `Page ${n}` })}>
                    {n === 1 ? (
                      <>
                        <h3 className="rp-pdf-title">{title}</h3>
                        <p>{excerpt}</p>
                        <p>{t(FILLER[0])}</p>
                      </>
                    ) : (
                      <>
                        <h4>{n}. {t({ fr: ['Périmètre', 'Calendrier', 'Contrôle qualité', 'Confidentialité'][i % 4], en: ['Scope', 'Schedule', 'Quality control', 'Confidentiality'][i % 4] })}</h4>
                        <p>{t(FILLER[i % 4])}</p>
                        <p>{t(FILLER[(i + 1) % 4])}</p>
                        <p>{t(FILLER[(i + 2) % 4])}</p>
                      </>
                    )}
                    <footer>{n} / {pages}</footer>
                  </article>
                )
              })}
            </div>
          </div>
          <div className="rp-pdf-bar">
            <IconButton icon="keyboard_arrow_up" size={32} disabled={page <= 1} label={t({ fr: 'Page précédente', en: 'Previous page' })} onClick={() => goTo(page - 1)} />
            <span className="rp-pdf-count" aria-live="polite">{t({ fr: `Page ${page} sur ${pages}`, en: `Page ${page} of ${pages}` })}</span>
            <IconButton icon="keyboard_arrow_down" size={32} disabled={page >= pages} label={t({ fr: 'Page suivante', en: 'Next page' })} onClick={() => goTo(page + 1)} />
            <span className="rp-pdf-sep" />
            <IconButton icon="remove" size={32} disabled={zoom === ZOOMS[0]} label={t({ fr: 'Dézoomer', en: 'Zoom out' })} onClick={() => stepZoom(-1)} />
            <span className="rp-pdf-zoom" aria-live="polite">{Math.round(zoom * 100)}%</span>
            <IconButton icon="add" size={32} disabled={zoom === ZOOMS[ZOOMS.length - 1]} label={t({ fr: 'Zoomer', en: 'Zoom in' })} onClick={() => stepZoom(1)} />
          </div>
        </>
      )}
    </div>
  )
}
