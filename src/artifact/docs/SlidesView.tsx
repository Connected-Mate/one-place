import { useEffect, useRef, useState } from 'react'
import type { Artifact } from '../../data/types'
import { useT } from '../../i18n'
import { Button, IconButton } from '../../ui/kit'
import { Empty } from '../shared'
import { ArtifactHeader, takeFocus } from './Header'

type Deck = Extract<Artifact, { kind: 'slides' }>
type SlideData = Deck['slides'][number]

/** All sizes are in cqw, so the same slide is right as a thumbnail, on stage and presented. */
function Slide({ slide, index }: { slide: SlideData; index: number }) {
  const t = useT()
  const hasBullets = !!slide.bullets?.length
  return (
    <div className={`rp-slide${hasBullets ? '' : ' cover'}`} style={{ '--a': slide.accent ?? 'var(--blue)' } as React.CSSProperties}>
      <div className="rp-slide-in">
        <i className="rp-slide-mark" />
        <div className="rp-slide-text">
          <p className="rp-slide-title">{t(slide.title)}</p>
          {slide.subtitle && <p className="rp-slide-sub">{t(slide.subtitle)}</p>}
          {hasBullets && <ul>{slide.bullets!.map((b, i) => <li key={i}>{t(b)}</li>)}</ul>}
        </div>
        <span className="rp-slide-num">{index + 1}</span>
      </div>
    </div>
  )
}

export function SlidesView({ deck }: { deck: Deck }) {
  const t = useT()
  const total = deck.slides.length
  const [at, setAt] = useState(0)
  const [present, setPresent] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLDivElement>(null)
  const current = Math.min(at, Math.max(0, total - 1))

  const go = (i: number) => setAt(Math.max(0, Math.min(total - 1, i)))
  useEffect(() => { takeFocus(root.current) }, [])
  useEffect(() => { strip.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }, [current])
  useEffect(() => {
    if (present) overlay.current?.focus()
    else root.current?.focus({ preventScroll: true })
  }, [present])

  const keys = (e: React.KeyboardEvent) => {
    const next = ['ArrowRight', 'ArrowDown', 'PageDown'].includes(e.key) || (present && e.key === ' ')
    const prev = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)
    if (next) { e.preventDefault(); go(current + 1) }
    else if (prev) { e.preventDefault(); go(current - 1) }
    else if (e.key === 'Home') { e.preventDefault(); go(0) }
    else if (e.key === 'End') { e.preventDefault(); go(total - 1) }
    else if (e.key === 'Escape' && present) { e.preventDefault(); e.stopPropagation(); setPresent(false) }
  }

  if (total === 0) {
    return (
      <div className="rp-doc">
        <ArtifactHeader artifact={deck} />
        <Empty icon="slideshow" title={t({ fr: 'Présentation vide', en: 'This deck is empty' })} hint={t({ fr: 'Demandez à @Gemini de la préparer depuis le chat.', en: 'Ask @Gemini to draft it from the chat.' })} />
      </div>
    )
  }
  const counter = t({ fr: `Diapo ${current + 1} sur ${total}`, en: `Slide ${current + 1} of ${total}` })

  return (
    <div className="rp-doc">
      <ArtifactHeader artifact={deck}>
        <Button size="s" variant="outlined" icon="play_arrow" onClick={() => setPresent(true)}>{t({ fr: 'Présenter', en: 'Present' })}</Button>
      </ArtifactHeader>
      <div ref={root} className="rp-slides" tabIndex={0} role="group" aria-label={`${t(deck.title)}. ${counter}`} onKeyDown={keys}>
        <div ref={strip} className="rp-strip" aria-label={t({ fr: 'Diapositives', en: 'Slides' })}>
          {deck.slides.map((s, i) => (
            <button key={i} type="button" className="rp-thumb" aria-current={i === current} aria-label={t({ fr: `Diapo ${i + 1}: ${t(s.title)}`, en: `Slide ${i + 1}: ${t(s.title)}` })} onClick={() => go(i)}>
              <span className="rp-thumb-num" aria-hidden="true">{i + 1}</span>
              <span className="rp-thumb-frame" aria-hidden="true"><Slide slide={s} index={i} /></span>
            </button>
          ))}
        </div>
        <div className="rp-stage"><div className="rp-stage-fit"><Slide slide={deck.slides[current]} index={current} /></div></div>
        <span className="sr-only" aria-live="polite">{counter}. {t(deck.slides[current].title)}</span>
      </div>
      {present && (
        <div ref={overlay} className="rp-present" tabIndex={-1} role="dialog" aria-modal="true" aria-label={t({ fr: `Présentation : ${t(deck.title)}`, en: `Presenting: ${t(deck.title)}` })} onKeyDown={keys}>
          <button type="button" className="rp-present-stage" aria-label={t({ fr: 'Diapo suivante', en: 'Next slide' })} onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            go(current + (e.clientX < r.left + r.width / 3 ? -1 : 1))
          }}>
            <span className="rp-stage-fit"><Slide slide={deck.slides[current]} index={current} /></span>
          </button>
          <div className="rp-present-bar">
            <IconButton icon="chevron_left" size={32} disabled={current === 0} label={t({ fr: 'Diapo précédente', en: 'Previous slide' })} onClick={() => go(current - 1)} />
            <span aria-live="polite">{current + 1} / {total}</span>
            <IconButton icon="chevron_right" size={32} disabled={current === total - 1} label={t({ fr: 'Diapo suivante', en: 'Next slide' })} onClick={() => go(current + 1)} />
            <IconButton icon="close" size={32} label={t({ fr: 'Quitter la présentation (Échap)', en: 'Exit presentation (Esc)' })} onClick={() => setPresent(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
