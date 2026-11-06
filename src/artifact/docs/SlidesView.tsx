import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Artifact } from '../../data/types'
import { useT } from '../../i18n'
import { useStore } from '../../store'
import { Button, IconButton } from '../../ui/kit'
import { Empty, revealIn, useBoard } from '../shared'
import { ArtifactHeader, takeFocus, TB, TBSep } from './Header'

type Deck = Extract<Artifact, { kind: 'slides' }>
type SlideData = Deck['slides'][number]

/** All sizes are in cqw, so the same slide is right as a thumbnail, on stage and presented. */
function Slide({ slide, index, onEdit }: { slide: SlideData; index: number; onEdit?: (patch: Partial<SlideData>) => void }) {
  const t = useT()
  const hasBullets = !!slide.bullets?.length
  const title = useRef<HTMLParagraphElement>(null)
  const sub = useRef<HTMLParagraphElement>(null)
  // Keep typed text out of React's way: only write to the DOM when it isn't being edited.
  useLayoutEffect(() => { if (title.current && document.activeElement !== title.current) title.current.innerText = t(slide.title) })
  useLayoutEffect(() => { if (sub.current && document.activeElement !== sub.current) sub.current.innerText = t(slide.subtitle) })
  const editable = (save: (v: string) => void) => onEdit ? {
    contentEditable: 'plaintext-only' as const,
    suppressContentEditableWarning: true,
    role: 'textbox',
    onBlur: (e: React.FocusEvent<HTMLElement>) => save(e.currentTarget.innerText.trim()),
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      e.stopPropagation()
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.currentTarget.blur() }
    },
  } : {}
  return (
    <div className={`rp-slide${hasBullets ? '' : ' cover'}`} style={{ '--a': slide.accent ?? 'var(--blue)' } as React.CSSProperties}>
      <div className="rp-slide-in">
        <i className="rp-slide-mark" />
        <div className="rp-slide-text">
          <p ref={title} className="rp-slide-title" aria-label={t({ fr: 'Titre de la diapo', en: 'Slide title' })} {...editable((v) => { if (v !== t(slide.title)) onEdit?.({ title: v }) })} />
          {slide.subtitle != null && <p ref={sub} className="rp-slide-sub" aria-label={t({ fr: 'Sous-titre', en: 'Subtitle' })} {...editable((v) => { if (v !== t(slide.subtitle)) onEdit?.({ subtitle: v }) })} />}
          {hasBullets && <ul>{slide.bullets!.map((b, i) => <li key={i}>{t(b)}</li>)}</ul>}
        </div>
        <span className="rp-slide-num">{index + 1}</span>
      </div>
    </div>
  )
}

export function SlidesView({ deck }: { deck: Deck }) {
  const t = useT()
  const { project, role } = useBoard()
  const patchArtifact = useStore((s) => s.patchArtifact)
  const readOnly = role === 'guest'
  const write = (slides: SlideData[]) => patchArtifact(project.id, deck.id, { slides, updatedAt: Date.now() })
  const total = deck.slides.length
  const [at, setAt] = useState(0)
  const [present, setPresent] = useState(false)
  const [notes, setNotes] = useState<Record<number, string>>({})
  const root = useRef<HTMLDivElement>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLDivElement>(null)
  const current = Math.min(at, Math.max(0, total - 1))

  const go = (i: number) => setAt(Math.max(0, Math.min(total - 1, i)))
  useEffect(() => { takeFocus(root.current) }, [])
  useEffect(() => { revealIn(strip.current, strip.current?.querySelector('[aria-current="true"]'), { top: 8, right: 8, bottom: 8, left: 8 }) }, [current])
  useEffect(() => {
    if (present) overlay.current?.focus()
    else root.current?.focus({ preventScroll: true })
  }, [present])

  const insert = () => {
    const slides = [...deck.slides]
    slides.splice(current + 1, 0, { title: t({ fr: 'Nouvelle diapo', en: 'New slide' }), bullets: [t({ fr: 'Votre premier point', en: 'Your first point' })], accent: deck.slides[current]?.accent })
    write(slides)
    setAt(current + 1)
  }
  const duplicate = () => {
    const slides = [...deck.slides]
    slides.splice(current + 1, 0, slides[current])
    write(slides)
    setAt(current + 1)
  }
  const remove = () => {
    write(deck.slides.filter((_, i) => i !== current))
    setAt(Math.max(0, current - 1))
    root.current?.focus({ preventScroll: true })
  }
  const keys = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).isContentEditable) return
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
        <Empty icon="slideshow" title={t({ fr: 'Présentation vide', en: 'This deck is empty' })} hint={t({ fr: 'Demandez à @Gemini de la préparer depuis le chat.', en: 'Ask @Gemini to draft it from the chat.' })}>
          {!readOnly && <Button size="s" variant="tonal" icon="add" onClick={insert}>{t({ fr: 'Nouvelle diapo', en: 'New slide' })}</Button>}
        </Empty>
      </div>
    )
  }
  const counter = t({ fr: `Diapo ${current + 1} sur ${total}`, en: `Slide ${current + 1} of ${total}` })

  return (
    <div className="rp-doc">
      <ArtifactHeader artifact={deck}>
        <Button size="s" variant="outlined" className="rp-present-btn" icon="slideshow" onClick={() => setPresent(true)}>{t({ fr: 'Présenter', en: 'Present' })}</Button>
      </ArtifactHeader>
      <div className="rp-toolbar" role="toolbar" aria-label={t({ fr: 'Outils de la présentation', en: 'Slide tools' })}>
        <TB icon="add" label={t({ fr: 'Nouvelle diapo', en: 'New slide' })} disabled={readOnly} onClick={insert} />
        <TB icon="content_copy" label={t({ fr: 'Dupliquer la diapo', en: 'Duplicate slide' })} disabled={readOnly} onClick={duplicate} />
        <TB icon="delete" label={t({ fr: 'Supprimer la diapo', en: 'Delete slide' })} disabled={readOnly} onClick={remove} />
        <TBSep />
        <TB icon="keyboard_arrow_up" label={t({ fr: 'Diapo précédente', en: 'Previous slide' })} disabled={current === 0} onClick={() => go(current - 1)} />
        <span className="rp-tb-text" aria-hidden="true">{current + 1} / {total}</span>
        <TB icon="keyboard_arrow_down" label={t({ fr: 'Diapo suivante', en: 'Next slide' })} disabled={current === total - 1} onClick={() => go(current + 1)} />
      </div>
      <div ref={root} className="rp-slides" tabIndex={0} role="group" aria-label={`${t(deck.title)}. ${counter}`} onKeyDown={keys}>
        <div ref={strip} className="rp-strip" aria-label={t({ fr: 'Diapositives', en: 'Slides' })}>
          {deck.slides.map((s, i) => (
            <button key={i} type="button" className="rp-thumb" aria-current={i === current} aria-label={t({ fr: `Diapo ${i + 1}: ${t(s.title)}`, en: `Slide ${i + 1}: ${t(s.title)}` })} onClick={() => go(i)}>
              <span className="rp-thumb-num" aria-hidden="true">{i + 1}</span>
              <span className="rp-thumb-frame" aria-hidden="true"><Slide slide={s} index={i} /></span>
            </button>
          ))}
        </div>
        <div className="rp-stage">
          <div className="rp-stage-fit"><Slide key={current} slide={deck.slides[current]} index={current} onEdit={readOnly ? undefined : (patch) => write(deck.slides.map((x, i) => (i === current ? { ...x, ...patch } : x)))} /></div>
          <textarea className="rp-notes-speaker" value={notes[current] ?? ''} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setNotes((n) => ({ ...n, [current]: e.target.value }))} placeholder={t({ fr: 'Cliquez pour ajouter des notes pour le présentateur', en: 'Click to add speaker notes' })} aria-label={t({ fr: 'Notes du présentateur', en: 'Speaker notes' })} />
        </div>
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
