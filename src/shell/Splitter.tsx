/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
import { useRef } from 'react'
import { useStore } from '../store'
import { useT } from '../i18n'

const clamp = (w: number) => Math.max(320, Math.min(w, Math.max(360, innerWidth - 700)))
/** On a tablet the rail is 72 wide and the pane must keep 420: its own range, its own remembered width. */
const isTablet = () => matchMedia('(max-width:1279px)').matches
const clampTablet = (w: number) => Math.max(300, Math.min(w, Math.max(300, innerWidth - 72 - 16 - 420)))

/** Drag or use the arrow keys to share space between chat and right pane. */
export function Splitter() {
  const t = useT()
  const desktopWidth = useStore((s) => s.chatWidth)
  const setDesktop = useStore((s) => s.setChatWidth)
  const setTablet = useStore((s) => s.setChatWidthTablet)
  const self = useRef<HTMLDivElement>(null)
  // What is on screen, wherever it comes from: on a tablet the default width lives in the CSS.
  const shown = () => self.current?.previousElementSibling?.getBoundingClientRect().width ?? desktopWidth
  const setW = (w: number) => { if (isTablet()) setTablet(clampTablet(w)); else setDesktop(clamp(w)) }
  const start = useRef<{ x: number; w: number } | null>(null)
  return (
    <div
      ref={self} className="splitter" role="separator" aria-orientation="vertical" tabIndex={0}
      aria-label={t({ fr: 'Redimensionner le chat', en: 'Resize the chat' })} aria-valuenow={desktopWidth} aria-valuemin={320}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); start.current = { x: e.clientX, w: shown() }; document.body.classList.add('resizing') }}
      onPointerMove={(e) => { if (start.current) setW(start.current.w + e.clientX - start.current.x) }}
      onPointerUp={() => { start.current = null; document.body.classList.remove('resizing') }}
      onPointerCancel={() => { start.current = null; document.body.classList.remove('resizing') }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setW(shown() - 24)
        if (e.key === 'ArrowRight') setW(shown() + 24)
      }}
    />
  )
}
