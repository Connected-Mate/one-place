import { useRef } from 'react'
import { useStore } from '../store'
import { useT } from '../i18n'

const clamp = (w: number) => Math.max(320, Math.min(w, Math.max(360, innerWidth - 700)))

/** Drag or use the arrow keys to share space between chat and right pane. */
export function Splitter() {
  const t = useT()
  const width = useStore((s) => s.chatWidth)
  const setW = useStore((s) => s.setChatWidth)
  const start = useRef<{ x: number; w: number } | null>(null)
  return (
    <div
      className="splitter" role="separator" aria-orientation="vertical" tabIndex={0}
      aria-label={t({ fr: 'Redimensionner le chat', en: 'Resize the chat' })} aria-valuenow={width} aria-valuemin={320}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); start.current = { x: e.clientX, w: width }; document.body.classList.add('resizing') }}
      onPointerMove={(e) => { if (start.current) setW(clamp(start.current.w + e.clientX - start.current.x)) }}
      onPointerUp={() => { start.current = null; document.body.classList.remove('resizing') }}
      onPointerCancel={() => { start.current = null; document.body.classList.remove('resizing') }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setW(clamp(width - 24))
        if (e.key === 'ArrowRight') setW(clamp(width + 24))
      }}
    />
  )
}
