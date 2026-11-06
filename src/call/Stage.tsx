/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The call stage itself. Knows nothing about the store's call: the project call and
// the guest's call both feed it through props.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Artifact, Person, Txt } from '../data/types'
import { useT } from '../i18n'
import { useStore } from '../store'
import { Avatar, Icon, Sparkle, base } from '../ui/kit'
import { clearNotice, subscribeLevel, useMedia, useTabVisible } from './media'
import { talkersOf, type Beat } from './openings'
import { playSound, startLoop, stopLoop } from './sounds'
import { clipFor, enableSound, estimateSeconds, loadManifest, setCallAudioMuted, speak, speakTogether, useVoice, voiceLevel } from './voice'
import './call.css'

export interface StagePerson { person: Person; callOnly?: boolean }

export interface StageProps {
  mode: 'project' | 'guest'
  title: Txt
  startedAt: number
  selfId: string
  /** everyone in the call so far, self included */
  people: StagePerson[]
  /** how many are still on their way */
  waiting: number
  mic: boolean
  cam: boolean
  captions: boolean
  sharing?: boolean
  hand: boolean
  /** the whole call in order: opening, then script. See openings.ts */
  timeline: Beat[]
  line: number
  onJoin(ids: string[]): void
  /** whose camera is on, the viewer's aside */
  camsOn: string[]
  onCamOn(ids: string[]): void
  onLeave(ids: string[]): void
  doc?: Artifact
  onLine(n: number): void
  onMic(): void
  onCam(): void
  onCaptions(): void
  onHand(): void
  onShare?(): void
  onInvite?(): void
  onHangUp(): void
  topSlot?: ReactNode
}

const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }

export const fmtElapsed = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`
}
export function useElapsed(startedAt: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(i)
  }, [startedAt])
  return fmtElapsed(now - startedAt)
}

const GAP_MS = 600
const LAST_LINE_HOLD_MS = 2200

/** Runs the timeline step by step: joins, silences, lines, choruses, notes. Stops at the end; everything dies with the component. */
function useTimeline({ timeline, line, onLine, onJoin, onCamOn, onLeave, selfId, mic, onNote }: { timeline: Beat[]; line: number; onLine(n: number): void; onJoin(ids: string[]): void; onCamOn(ids: string[]): void; onLeave(ids: string[]): void; selfId: string; mic: boolean; onNote(text: string): void }) {
  const lang = useStore((s) => s.lang)
  const [count, setCount] = useState(0)
  const [talking, setTalking] = useState<string[]>([])
  const visible = useTabVisible()
  const hasMic = useMedia((m) => !!m.audio)
  const beat = timeline[line] as Beat | undefined
  const sayWho = beat?.kind === 'say' ? beat.who : undefined
  // You don't speak with your mic off. With no mic at all, your lines stay: the conversation needs them.
  const skip = sayWho === selfId && !mic && hasMic
  const text = beat?.kind === 'say' ? (typeof beat.text === 'string' ? beat.text : beat.text[lang]) : beat?.kind === 'chorus' ? beat.caption : ''
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text])
  const handlers = useRef({ onLine, onJoin, onCamOn, onLeave, onNote })
  handlers.current = { onLine, onJoin, onCamOn, onLeave, onNote }

  useEffect(() => {
    if (!beat || !visible) { setCount(0); setTalking([]); return }
    const next = () => handlers.current.onLine(line + 1)
    if (beat.kind === 'wait') {
      const t = setTimeout(next, beat.ms)
      return () => clearTimeout(t)
    }
    if (beat.kind === 'mimic') {
      setCount(0)
      setTalking([])
      const t = setTimeout(next, beat.ms)
      return () => clearTimeout(t)
    }
    if (beat.kind === 'join' || beat.kind === 'note' || beat.kind === 'cam' || beat.kind === 'leave') {
      if (beat.kind === 'join') handlers.current.onJoin(beat.ids)
      else if (beat.kind === 'cam') handlers.current.onCamOn(beat.ids)
      else if (beat.kind === 'leave') handlers.current.onLeave(beat.ids)
      else { playSound('note'); handlers.current.onNote(beat.text) }
      const t = setTimeout(next, beat.ms ?? 0)
      return () => clearTimeout(t)
    }
    setCount(0)
    setTalking([])
    if (skip) {
      const t = setTimeout(next, 0)
      return () => clearTimeout(t)
    }
    let dead = false
    let stop: (() => void) | undefined
    let hold: ReturnType<typeof setTimeout> | undefined
    const gap = beat.gap ?? (timeline[line + 1] ? GAP_MS : LAST_LINE_HOLD_MS)
    const after = () => {
      setTalking([])
      setCount(words.length)
      hold = setTimeout(next, gap)
    }
    void loadManifest().then((m) => {
      if (dead) return
      if (beat.kind === 'chorus') {
        setTalking(beat.parts.map((p) => p.who))
        setCount(words.length) // a shout has no word-by-word
        stop = speakTogether({
          parts: beat.parts.map((p) => {
            const clip = clipFor(m, p.key, p.who, p.text, selfId)
            return { who: p.who, src: clip?.src, duration: clip?.duration ?? .9, at: p.at ?? 0 }
          }),
          onDone: after,
        })
        return
      }
      // Words appear in proportion to their length, which follows speech better than a word count.
      const total = words.reduce((n, w) => n + w.length + 1, 0) || 1
      const countAt = (f: number) => {
        if (reducedMotion()) return words.length
        let seen = 0, n = 0
        for (const w of words) { seen += w.length + 1; if (seen / total > f + .02) break; n += 1 }
        return Math.max(1, n)
      }
      const clip = clipFor(m, beat.key, beat.who, text, selfId)
      stop = speak({
        who: beat.who,
        src: clip?.src,
        duration: clip?.duration ?? estimateSeconds(words.length),
        onTalk: (on) => setTalking(on ? [beat.who] : []),
        onProgress: (f) => { const n = countAt(f); setCount((c) => (c === n ? c : n)) },
        onDone: after,
      })
    })
    return () => { dead = true; stop?.(); if (hold) clearTimeout(hold) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, words, skip, visible])

  const spoken = beat?.kind === 'say' || beat?.kind === 'chorus'
  const shown = spoken && count > 0
  const speakers = beat?.kind === 'chorus' ? beat.parts.map((p) => p.who) : sayWho ? [sayWho] : []
  const prev = timeline[line - 1] as Beat | undefined
  const mimic = beat?.kind === 'mimic' ? beat.who : undefined
  const stillMuted = mimic ?? (prev?.kind === 'mimic' ? prev.who : undefined)
  return { talking, mimic, stillMuted, captionWho: shown ? speakers : [], text: shown ? words.slice(0, count).join(' ') : '' }
}

/** One quiet line at the top of the stage: the privacy note, or why the camera is off. Never blocks anything. */
export function MediaNotice() {
  const notice = useMedia((m) => m.notice)
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(clearNotice, 7000)
    return () => clearTimeout(t)
  }, [notice])
  const t = useT()
  if (!notice) return null
  return <div key={notice.id} className="cv-quiet" role="status">{t(notice.text)}</div>
}

const SoundIcon = ({ on }: { on: boolean }) => (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4Z" />
    {on
      ? <path d="M14.5 8.2a5 5 0 0 1 0 7.6l-1-1.2a3.4 3.4 0 0 0 0-5.2l1-1.2Zm2.3-2.6a8.4 8.4 0 0 1 0 12.8l-1-1.2a6.8 6.8 0 0 0 0-10.4l1-1.2Z" />
      : <path d="m15 9.1 1.1-1.1 2.4 2.4 2.4-2.4 1.1 1.1-2.4 2.4 2.4 2.4-1.1 1.1-2.4-2.4-2.4 2.4-1.1-1.1 2.4-2.4L15 9.1Z" />}
  </svg>
)

/* ---- Tooltip: fixed, clamped to the window, also shown on keyboard focus ---- */
function Tip({ anchor, label, shortcut }: { anchor: HTMLElement; label: string; shortcut?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<React.CSSProperties>({ visibility: 'hidden' })
  useLayoutEffect(() => {
    const a = anchor.getBoundingClientRect(), r = ref.current!.getBoundingClientRect()
    const top = a.top - r.height - 8
    setPos({ left: Math.max(8, Math.min(a.left + a.width / 2 - r.width / 2, innerWidth - r.width - 8)), top: top < 8 ? a.bottom + 8 : top })
  }, [anchor, label])
  return createPortal(
    <div ref={ref} className="cv-tip" role="presentation" style={pos}>{label}{shortcut && <kbd>{shortcut}</kbd>}</div>,
    document.body,
  )
}

function useTip() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!anchor) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setAnchor(null) }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [anchor])
  return {
    anchor,
    bind: {
      onMouseEnter: (e: React.MouseEvent<HTMLElement>) => setAnchor(e.currentTarget),
      onMouseLeave: () => setAnchor(null),
      onFocus: (e: React.FocusEvent<HTMLElement>) => { if (e.currentTarget.matches(':focus-visible')) setAnchor(e.currentTarget) },
      onBlur: () => setAnchor(null),
    },
  }
}

type Tone = 'off' | 'active'
export function CtlButton({ icon, iconNode, label, shortcut, tone, pressed, expanded, onClick, className = '' }: { icon?: string; iconNode?: ReactNode; label: string; shortcut?: string; tone?: Tone; pressed?: boolean; expanded?: boolean; onClick(e: React.MouseEvent<HTMLButtonElement>): void; className?: string }) {
  const { anchor, bind } = useTip()
  return (
    <>
      <button type="button" className={`cv-ctl ${tone ?? ''} ${className}`} aria-label={label} aria-pressed={pressed} aria-expanded={expanded} aria-keyshortcuts={shortcut?.toLowerCase()} onClick={onClick} {...bind}>
        {iconNode ?? <Icon name={icon ?? ''} fill={tone === 'active'} size={22} />}
      </button>
      {anchor && <Tip anchor={anchor} label={label} shortcut={shortcut} />}
    </>
  )
}

/* ---- A person on the stage ---- */
/** Webcam-framed stills of the fictional cast. Real people (Alex, Damien) keep their real photo, camera-off style. */
const STILLS = new Set(['maya', 'tom', 'sofia', 'karim', 'lea', 'jun', 'nora', 'priya', 'ben'])

function SelfVideo({ track }: { track: MediaStreamTrack }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = ref.current!
    v.srcObject = new MediaStream([track]) // video only: your own voice never comes back at you
    void v.play().catch(() => {})
    return () => { v.srcObject = null }
  }, [track])
  return <video ref={ref} className="cv-self-video" autoPlay muted playsInline aria-hidden="true" />
}

/** Each face moves a little differently, and at its own moment. */
function stillMotion(id: string): React.CSSProperties {
  const h = [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 11)
  return {
    '--cv-delay': `-${h % 29}s`,
    '--cv-x': `${(h % 2 ? 1 : -1) * (.5 + (h % 5) * .12)}%`,
    '--cv-y': `${(h % 3 ? 1 : -1) * (.3 + (h % 4) * .1)}%`,
    '--cv-breath': `${5.4 + (h % 7) * .35}s`,
  } as React.CSSProperties
}

/**
 * A person on camera: their still, with two more frames of the same moment.
 * Talking follows the voice's real level (timing if it can't be read), with small head movement;
 * listening stays nearly still, with a rare look aside. Every value is kept small on purpose:
 * credible beats busy, and any more reads as flicker.
 */
function Webcam({ person, talking, warm, onBroken }: { person: Person; talking: boolean; warm: boolean; onBroken(): void }) {
  const root = useRef<HTMLSpanElement>(null)
  const talk = useRef<HTMLImageElement>(null)
  const aside = useRef<HTMLImageElement>(null)
  const id = person.id

  useEffect(() => {
    if (!talking || reducedMotion()) return
    let open = false
    let holdUntil = 0
    let phase = Math.random() * 6
    const start = performance.now()
    let nextTiming = 0
    let envelope = .15
    let openedAt = 0
    const tick = () => {
      const now = performance.now()
      const level = voiceLevel(id)
      if (now >= holdUntil) {
        let want: boolean
        if (level != null) {
          // Syllables, not loudness: the mouth follows peaks above the running average, and never stays open long.
          envelope = envelope * .9 + level * .1
          want = level > Math.max(.05, envelope * 1.08) && (!open || now - openedAt < 280)
        }
        else { // no level to read: an irregular rhythm of syllables
          if (now >= nextTiming) { nextTiming = now + 120 + Math.random() * 210; want = !open } else want = open
        }
        if (want !== open) {
          open = want
          if (open) openedAt = now
          holdUntil = now + 110 + Math.random() * 90
          if (talk.current) talk.current.style.opacity = open ? '1' : '0'
        }
      }
      phase += .05 + (level ?? .2) * .05
      const t = (now - start) / 1000
      root.current?.style.setProperty('--cv-hx', `${(Math.sin(phase) * .28).toFixed(3)}%`)
      root.current?.style.setProperty('--cv-hy', `${(Math.sin(phase * .7 + t) * .18).toFixed(3)}%`)
    }
    const timer = setInterval(tick, 50)
    const r = root.current, tk = talk.current
    return () => {
      clearInterval(timer)
      if (tk) tk.style.opacity = '0'
      r?.style.setProperty('--cv-hx', '0%')
      r?.style.setProperty('--cv-hy', '0%')
    }
  }, [talking, id])

  useEffect(() => {
    if (talking || reducedMotion()) return
    let t: ReturnType<typeof setTimeout>
    const show = () => {
      if (aside.current) aside.current.style.opacity = '1'
      t = setTimeout(hide, 1800 + Math.random() * 2400)
    }
    const hide = () => {
      if (aside.current) aside.current.style.opacity = '0'
      t = setTimeout(show, 7000 + Math.random() * 11000)
    }
    t = setTimeout(show, 3500 + Math.random() * 11000)
    const a = aside.current
    return () => { clearTimeout(t); if (a) a.style.opacity = '0' }
  }, [talking])

  return (
    <span ref={root} className={`cv-still${warm ? ' warming' : ''}`} style={stillMotion(id)} aria-hidden="true">
      <span className="cv-still-move">
        <img src={`${base}call/${id}.webp`} alt="" onError={onBroken} />
        <img ref={aside} className="cv-still-aside" src={`${base}call/${id}-aside.webp`} alt="" decoding="async" onError={(e) => { e.currentTarget.style.display = 'none' }} />
        <img ref={talk} className="cv-still-talk" src={`${base}call/${id}-talk.webp`} alt="" decoding="async" onError={(e) => { e.currentTarget.style.display = 'none' }} />
      </span>
      <span className="cv-grain" />
    </span>
  )
}

export { SelfVideo }

export function Tile({ person, self, muted, speaking, mouthing, cam = true, hand, callOnly, arrive, youLabel }: { person: Person; self?: boolean; muted?: boolean; speaking?: boolean; mouthing?: boolean; cam?: boolean; hand?: boolean; callOnly?: boolean; arrive?: boolean; youLabel?: string }) {
  const t = useT()
  const ref = useRef<HTMLElement>(null)
  const track = useMedia((m) => (self && cam ? m.video : null))
  const [broken, setBroken] = useState(false)
  const [talking, setTalking] = useState(false)
  useEffect(() => {
    if (!self) return
    return subscribeLevel((v) => {
      ref.current?.style.setProperty('--cv-level', v.toFixed(2))
      setTalking((was) => (was ? v > .1 : v > .18))
    })
  }, [self])
  const still = !self && cam && STILLS.has(person.id) && !broken
  // A camera switched on while we watch warms up, as webcams do. One already on when we arrive doesn't.
  const wasOn = useRef(still)
  const warm = useRef(false)
  if (still && !wasOn.current) warm.current = true
  wasOn.current = still
  const video = !!track
  const talkingNow = speaking || (self && talking && !muted)
  return (
    <figure ref={ref} className={`cv-tile${talkingNow ? ' speaking' : ''}${arrive ? ' arrive' : ''}${video || still ? ' has-video' : ' cam-off'}${self && talking && !muted ? ' level' : ''}`} aria-label={person.name}>
      {video && <SelfVideo track={track} />}
      {still && <Webcam person={person} talking={!!speaking || !!mouthing} warm={warm.current} onBroken={() => setBroken(true)} />}
      {!video && !still && <span className="cv-face"><Avatar person={person} size={160} /></span>}
      <span className="cv-tile-top">
        {hand && <span className="cv-badge hand" title={t({ fr: 'Main levée', en: 'Hand raised' })}><Icon name="back_hand" fill size={16} /></span>}
        {muted
          ? <span className="cv-badge" title={t({ fr: 'Micro coupé', en: 'Muted' })}><Icon name="mic_off" size={16} /><span className="sr-only">{t({ fr: 'Micro coupé', en: 'Muted' })}</span></span>
          : talkingNow ? <span className="cv-badge talk" aria-hidden="true"><i /><i /><i /></span> : null}
      </span>
      <figcaption className="cv-tag">
        <span className="cv-tag-name">{person.name}{self ? ` (${youLabel ?? t({ fr: 'vous', en: 'you' })})` : ''}</span>
        {callOnly && <span className="cv-only">{t({ fr: 'Cet appel uniquement', en: 'Call only' })}</span>}
      </figcaption>
    </figure>
  )
}

/** M, C and S. Not while typing (the composer sits right beside the stage), in a dialog, or behind another tab. */
export function useCallKeys(root: React.RefObject<HTMLElement | null>, onMic: () => void, onCam: () => void) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || document.querySelector('.scrim')) return
      if (!root.current?.getClientRects().length) return
      const el = e.target as HTMLElement | null
      if (el?.closest?.('input,textarea,select,[contenteditable="true"]')) return
      const k = e.key.toLowerCase()
      if (k === 'm') { e.preventDefault(); onMic() }
      if (k === 'c') { e.preventDefault(); onCam() }
      if (k === 's') { e.preventDefault(); setCallAudioMuted(!useVoice.getState().muted) }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  })
}

/* ---- Gemini, at the crossing of the grid ---- */
const nearest = (list: number[], target: number) => list.reduce((best, v) => (Math.abs(v - target) < Math.abs(best - target) - .5 ? v : best), list[0])

/** Where the tiles' corners meet. Measured from the layout (not the animation), so it stays right as the grid resizes. */
function useCrossing(wrap: React.RefObject<HTMLDivElement | null>, n: number, captioning: boolean) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  useLayoutEffect(() => {
    const w = wrap.current
    if (!w) return
    const measure = () => {
      const grid = w.querySelector<HTMLElement>('.cv-grid')
      if (!grid) return
      const tiles = [...grid.children] as HTMLElement[]
      // The bottom row's name tags rise above the caption bar while it shows.
      const lowest = Math.max(...tiles.map((el) => el.offsetTop))
      tiles.forEach((el) => el.classList.toggle('bottom-row', el.offsetTop === lowest))
      const W = w.clientWidth, H = w.clientHeight
      let x = W / 2, y = H / 2
      if (tiles.length <= 1) y = H - (captioning ? 116 : 40) // one face: below it, above the captions
      else {
        const rows = new Map<number, HTMLElement[]>()
        for (const el of tiles) rows.set(el.offsetTop, [...(rows.get(el.offsetTop) ?? []), el])
        const tops = [...rows.keys()].sort((a, b) => a - b)
        const rowGaps = tops.slice(1).map((top, i) => (tops[i] + rows.get(tops[i])![0].offsetHeight + top) / 2 - grid.scrollTop)
        const widest = [...rows.values()].sort((a, b) => b.length - a.length)[0].slice().sort((a, b) => a.offsetLeft - b.offsetLeft)
        const colGaps = widest.slice(1).map((el, i) => (widest[i].offsetLeft + widest[i].offsetWidth + el.offsetLeft) / 2)
        if (rowGaps.length) y = nearest(rowGaps, H / 2)
        // Over a column gutter when the middle is one; an odd grid keeps its true center along the row gutter.
        if (colGaps.length && (widest.length % 2 === 0 || !rowGaps.length)) x = nearest(colGaps, W / 2)
      }
      setPos((p) => (p && Math.abs(p.x - x) < .25 && Math.abs(p.y - y) < .25 ? p : { x, y }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(w)
    const grid = w.querySelector('.cv-grid')
    grid?.addEventListener('scroll', measure, { passive: true })
    return () => { ro.disconnect(); grid?.removeEventListener('scroll', measure) }
  }, [wrap, n, captioning])
  return pos
}

function GeminiBadge({ mode, talking, notes, style, className = '' }: { mode: StageProps['mode']; talking: boolean; notes: { who: string; text: string }[]; style?: React.CSSProperties; className?: string }) {
  const t = useT()
  const label = t({ fr: 'Gemini prend des notes', en: 'Gemini is taking notes' })
  const { anchor, bind } = useTip()
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [popPos, setPopPos] = useState<React.CSSProperties>({ visibility: 'hidden' })
  useLayoutEffect(() => {
    if (!open || !btn.current || !pop.current) return
    const a = btn.current.getBoundingClientRect(), r = pop.current.getBoundingClientRect()
    const top = a.top - r.height - 10
    setPopPos({ left: Math.max(8, Math.min(a.left + a.width / 2 - r.width / 2, innerWidth - r.width - 8)), top: top < 8 ? a.bottom + 10 : top })
  }, [open, notes.length])
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus() } }
    const down = (e: MouseEvent) => { if (!pop.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('keydown', key)
    document.addEventListener('mousedown', down)
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('mousedown', down) }
  }, [open])

  // A guest gets the plain mark: notes are on, and that is all she needs to know.
  if (mode === 'guest') {
    const plain = t({ fr: 'Notes activées', en: 'Notes are on' })
    return <span className={`cv-gemini plain ${className}`} style={style} role="img" aria-label={plain} title={plain}><Sparkle size={22} /></span>
  }
  return (
    <>
      <button ref={btn} type="button" className={`cv-gemini${talking ? ' hearing' : ''} ${className}`} style={style} aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)} {...bind}>
        <Sparkle size={22} />
      </button>
      {anchor && !open && <Tip anchor={anchor} label={label} />}
      {open && createPortal(
        <div ref={pop} className="cv-gemini-pop" role="dialog" aria-label={t({ fr: 'Notes de Gemini', en: 'Gemini’s notes' })} style={popPos}>
          <header><Sparkle size={16} />{label}</header>
          {notes.length
            ? <ul>{notes.map((n, i) => <li key={i}><b>{n.who}</b> {n.text}</li>)}</ul>
            : <p>{t({ fr: 'Gemini écoute. Les notes arrivent ici dès que quelqu’un parle.', en: 'Listening. Notes show up here as soon as someone talks.' })}</p>}
        </div>,
        document.body)}
    </>
  )
}

/* ---- Sheets: side panel when there is room, bottom sheet when there is not ---- */
function useSheetBehaviour(onClose: () => void, alwaysModal: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const el = ref.current!
    el.querySelector<HTMLElement>('button,[tabindex="0"]')?.focus()
    const key = (e: KeyboardEvent) => {
      if (document.querySelector('.scrim')) return
      if (e.key === 'Escape') { e.stopPropagation(); close.current() }
      if (e.key !== 'Tab' || !(alwaysModal || getComputedStyle(el).position === 'absolute')) return
      const items = [...el.querySelectorAll<HTMLElement>('button:not(:disabled)')]
      if (!items.length) return
      const a = items[0], z = items[items.length - 1]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); if (prev?.isConnected) prev.focus() }
  }, [alwaysModal])
  return ref
}

function PeoplePanel({ people, selfId, hand, mic, mode, muted, onClose, onInvite }: { people: StagePerson[]; selfId: string; hand: boolean; mic: boolean; mode: StageProps['mode']; muted: (id: string) => boolean; onClose(): void; onInvite?(): void }) {
  const t = useT()
  const ref = useSheetBehaviour(onClose, false)
  return (
    <>
      <div className="cv-sheet-scrim when-sheet" onClick={onClose} />
      <aside ref={ref} className="cv-panel" aria-label={t({ fr: 'Participants', en: 'People' })}>
        <header className="cv-panel-head">
          <h3>{t({ fr: `Participants (${people.length})`, en: `People (${people.length})` })}</h3>
          <button type="button" className="cv-ghost-round" aria-label={t({ fr: 'Fermer', en: 'Close' })} onClick={onClose}><Icon name="close" /></button>
        </header>
        {mode === 'project' && onInvite && (
          <button type="button" className="cv-row-btn" onClick={onInvite}><Icon name="person_add" />{t({ fr: 'Inviter pour cet appel uniquement', en: 'Invite for this call only' })}</button>
        )}
        <ul className="cv-people">
          {people.map(({ person, callOnly }) => {
            const self = person.id === selfId
            return (
              <li key={person.id}>
                <Avatar person={person} size={36} />
                <span className="cv-people-text">
                  <b>{person.name}{self ? ` (${t({ fr: 'vous', en: 'you' })})` : ''}</b>
                  {callOnly && <small>{t({ fr: 'Invité pour cet appel uniquement', en: 'Invited for this call only' })}</small>}
                </span>
                {self && hand && <Icon name="back_hand" fill size={18} />}
                {(self ? !mic : muted(person.id))
                  ? <span title={t({ fr: 'Micro coupé', en: 'Muted' })}><Icon name="mic_off" size={18} /><span className="sr-only">{t({ fr: 'Micro coupé', en: 'Muted' })}</span></span>
                  : <Icon name="mic" size={18} />}
              </li>
            )
          })}
        </ul>
      </aside>
    </>
  )
}

function MoreSheet({ items, onClose }: { items: { icon: string; node?: ReactNode; label: string; active?: boolean; run(): void }[]; onClose(): void }) {
  const t = useT()
  const ref = useSheetBehaviour(onClose, true)
  return (
    <>
      <div className="cv-sheet-scrim" onClick={onClose} />
      <div ref={ref} className="cv-sheet" role="dialog" aria-modal="true" aria-label={t({ fr: 'Plus d’options', en: 'More options' })}>
        <span className="cv-grab" aria-hidden="true" />
        {items.map((it) => (
          <button key={it.icon} type="button" className={`cv-sheet-item${it.active ? ' active' : ''}`} onClick={() => { onClose(); it.run() }}>
            {it.node ?? <Icon name={it.icon} fill={it.active} />}{it.label}
          </button>
        ))}
      </div>
    </>
  )
}

/* ---- The document being presented ---- */
const KIND_ICON = { doc: 'description', sheet: 'table_chart', slides: 'slideshow', pdf: 'picture_as_pdf', notebook: 'auto_stories', image: 'image', video: 'movie', file: 'draft' } as const

function DocCard({ doc, onStop }: { doc: Artifact; onStop?(): void }) {
  const t = useT()
  return (
    <section className="cv-doc" aria-label={t({ fr: `Présentation : ${t(doc.title)}`, en: `Presenting: ${t(doc.title)}` })}>
      <header className="cv-doc-bar">
        <Icon name="present_to_all" size={18} />
        <span className="cv-doc-who">{t({ fr: 'Vous présentez', en: 'You are presenting' })}</span>
        {onStop && <button type="button" className="cv-doc-stop" onClick={onStop}>{t({ fr: 'Arrêter', en: 'Stop' })}</button>}
      </header>
      <div className="cv-doc-page">
        <h4><Icon name={KIND_ICON[doc.kind]} size={20} /><span>{t(doc.title)}</span></h4>
        {doc.kind === 'doc' && doc.sections.slice(0, 3).map((s, i) => (
          <div key={i}>{s.heading && <h5>{t(s.heading)}</h5>}<p>{t(s.body)}</p></div>
        ))}
        {doc.kind === 'slides' && doc.slides[0] && (
          <div className="cv-doc-slide" style={{ borderColor: doc.slides[0].accent }}>
            <h5>{t(doc.slides[0].title)}</h5>
            {doc.slides[0].subtitle && <p>{t(doc.slides[0].subtitle)}</p>}
            {doc.slides[0].bullets && <ul>{doc.slides[0].bullets.map((b, i) => <li key={i}>{t(b)}</li>)}</ul>}
          </div>
        )}
        {doc.kind === 'sheet' && (
          <table>
            <thead><tr>{doc.columns.map((c, i) => <th key={i}>{t(c)}</th>)}</tr></thead>
            <tbody>{doc.rows.slice(0, 6).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table>
        )}
        {doc.kind === 'pdf' && <p>{t(doc.excerpt)}</p>}
      </div>
    </section>
  )
}

const MAX_TILES = 9

export function Stage(p: StageProps) {
  const t = useT()
  const elapsed = useElapsed(p.startedAt)
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [log, setLog] = useState<{ id: number; text: string }[]>([])
  const logId = useRef(0)
  const root = useRef<HTMLDivElement>(null)
  const say = (text: string) => { logId.current += 1; const id = logId.current; setLog((l) => [...l.slice(-4), { id, text }]) }

  const ids = p.people.map((x) => x.person.id)
  const joined = useMemo(() => new Set(ids), [ids.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  const [card, setCard] = useState<{ id: number; text: string } | null>(null)
  const captions = useTimeline({ timeline: p.timeline, line: p.line, onLine: p.onLine, onJoin: p.onJoin, selfId: p.selfId, mic: p.mic, onCamOn: p.onCamOn, onLeave: p.onLeave, onNote: (text) => setCard((c) => ({ id: (c?.id ?? 0) + 1, text })) })
  useEffect(() => {
    if (!card) return
    const t = setTimeout(() => setCard(null), 6500)
    return () => clearTimeout(t)
  }, [card])
  const audioMuted = useVoice((v) => v.muted)
  const soundBlocked = useVoice((v) => v.blocked)
  const talkers = useMemo(() => talkersOf(p.timeline), [p.timeline])
  const muted = (id: string) => (id === p.selfId ? !p.mic : id === captions.stillMuted || !talkers.has(id))

  // Arrival animation and announcement only for those who join while we watch.
  const known = useRef<Set<string> | null>(null)
  const nameOf = (id: string) => p.people.find((x) => x.person.id === id)?.person.name ?? ''
  const [arrived, setArrived] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!known.current) { known.current = new Set(ids); return }
    const fresh = ids.filter((id) => !known.current!.has(id))
    const gone = [...known.current].filter((id) => !ids.includes(id))
    if (!fresh.length && !gone.length) return
    known.current = new Set(ids)
    if (fresh.length) {
      setArrived((a) => new Set([...a, ...fresh]))
      fresh.forEach((id) => say(t({ fr: `${nameOf(id)} a rejoint l’appel`, en: `${nameOf(id)} joined the call` })))
      fresh.slice(0, 3).forEach((_, i) => setTimeout(() => playSound('join'), i * 140))
    }
    if (gone.length) gone.slice(0, 3).forEach((_, i) => setTimeout(() => playSound('leave'), i * 140))
  }, [joined]) // eslint-disable-line react-hooks/exhaustive-deps

  // Focus goes back where it was once the stage is gone, rather than getting lost.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    return () => { if (prev?.isConnected && (document.activeElement === document.body || !document.activeElement)) prev.focus() }
  }, [])

  // Alone and still waiting: the quiet tone, as long as someone is expected.
  const visibleTab = useTabVisible()
  const lonely = p.people.length === 1 && p.waiting > 0 && visibleTab
  useEffect(() => {
    if (!lonely) return
    startLoop('waiting')
    return stopLoop
  }, [lonely])

  const toggleMic = () => { playSound(p.mic ? 'micOff' : 'micOn'); say(p.mic ? t({ fr: 'Micro coupé', en: 'Microphone off' }) : t({ fr: 'Micro activé', en: 'Microphone on' })); p.onMic() }
  const toggleCam = () => { playSound(p.cam ? 'camOff' : 'camOn'); say(p.cam ? t({ fr: 'Caméra coupée', en: 'Camera off' }) : t({ fr: 'Caméra activée', en: 'Camera on' })); p.onCam() }
  const toggleHand = () => { if (!p.hand) playSound('hand'); say(p.hand ? t({ fr: 'Main baissée', en: 'Hand lowered' }) : t({ fr: 'Main levée', en: 'Hand raised' })); p.onHand() }

  const label = {
    mic: p.mic ? t({ fr: 'Couper le micro', en: 'Turn off microphone' }) : t({ fr: 'Activer le micro', en: 'Turn on microphone' }),
    cam: p.cam ? t({ fr: 'Couper la caméra', en: 'Turn off camera' }) : t({ fr: 'Activer la caméra', en: 'Turn on camera' }),
    sound: audioMuted ? t({ fr: 'Réactiver le son de l’appel', en: 'Unmute call audio' }) : t({ fr: 'Couper le son de l’appel', en: 'Mute call audio' }),
    captions: p.captions ? t({ fr: 'Masquer les sous-titres', en: 'Turn off captions' }) : t({ fr: 'Afficher les sous-titres', en: 'Turn on captions' }),
    hand: p.hand ? t({ fr: 'Baisser la main', en: 'Lower hand' }) : t({ fr: 'Lever la main', en: 'Raise hand' }),
    share: p.sharing ? t({ fr: 'Arrêter de présenter', en: 'Stop presenting' }) : t({ fr: 'Présenter un document', en: 'Present a document' }),
    people: t({ fr: 'Participants', en: 'People' }),
    invite: t({ fr: 'Inviter pour cet appel uniquement', en: 'Invite for this call only' }),
    hangUp: t({ fr: 'Quitter l’appel', en: 'Leave call' }),
  }

  // More than nine: eight faces and a "+N". Whoever is talking is always among the faces.
  const self = p.people.filter((x) => x.person.id === p.selfId)
  const others = p.people.filter((x) => x.person.id !== p.selfId)
  const ordered = [...self, ...others]
  let visible = ordered
  let overflow = 0
  if (ordered.length > MAX_TILES && !p.sharing) {
    visible = ordered.slice(0, MAX_TILES - 1)
    overflow = ordered.length - visible.length
    const talking = ordered.find((x) => captions.talking.includes(x.person.id))
    if (talking && !visible.includes(talking)) visible = [...visible.slice(0, -1), talking]
  }
  const speakers = captions.captionWho.map((id) => p.people.find((x) => x.person.id === id)?.person).filter((x): x is Person => !!x)
  const showDoc = p.sharing && p.doc

  const captioning = p.captions && !!captions.text
  const cells = Math.min(visible.length + (overflow ? 1 : 0), MAX_TILES)
  const wrap = useRef<HTMLDivElement>(null)
  const crossing = useCrossing(wrap, showDoc ? 0 : cells, captioning)
  const firstName = (id: string) => (p.people.find((x) => x.person.id === id)?.person.name ?? '').split(' ')[0]
  // Gemini's notes: what it wrote, then what was said in the meeting proper. Hellos are not notes.
  const notes = p.mode === 'guest' ? [] : p.timeline.slice(0, captions.text ? p.line + 1 : p.line).flatMap((b) => (
    b.kind === 'note' ? [{ who: '', text: b.text }] : b.kind === 'say' && b.scripted ? [{ who: firstName(b.who), text: t(b.text) }] : []
  )).slice(-3)
  const hearing = captions.talking.length > 0 || !!card
  useCallKeys(root, toggleMic, toggleCam)

  const camsOn = new Set(p.camsOn)
  const capBar = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = capBar.current, r = root.current
    if (!el || !r) { r?.style.removeProperty('--cv-cap-h'); return }
    const set = () => r.style.setProperty('--cv-cap-h', `${el.offsetHeight + 12}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => { ro.disconnect(); r.style.removeProperty('--cv-cap-h') }
  }, [captioning])
  const tiles = visible.map(({ person, callOnly }) => {
    const isSelf = person.id === p.selfId
    return (
      <Tile key={person.id} person={person} self={isSelf} cam={isSelf ? p.cam : camsOn.has(person.id)} mouthing={captions.mimic === person.id}
        muted={muted(person.id)} speaking={captions.talking.includes(person.id)} hand={isSelf && p.hand}
        callOnly={callOnly} arrive={arrived.has(person.id)} />
    )
  })

  return (
    <div ref={root} className={`cv-stage${peopleOpen ? ' with-panel' : ''}`} data-mode={p.mode}>
      <header className="cv-top">
        <div className="cv-title">
          <h2>{t(p.title)}</h2>
          <span className="cv-timer" role="timer" aria-label={t({ fr: `Durée de l’appel : ${elapsed}`, en: `Call time: ${elapsed}` })}>{elapsed}</span>
        </div>
        {p.topSlot}
      </header>

      <div className="cv-body">
        <div className="cv-main">
          {showDoc && <DocCard doc={p.doc!} onStop={p.onShare} />}
          {showDoc
            ? <div className="cv-strip-wrap"><div className="cv-strip">{tiles}</div><GeminiBadge mode={p.mode} talking={hearing} notes={notes} className="on-strip" /></div>
            : (
              <div ref={wrap} className="cv-grid-wrap">
                <div className="cv-grid" data-n={cells}>
                  {tiles}
                  {overflow > 0 && (
                    <button type="button" className="cv-tile cv-more-tile" onClick={() => setPeopleOpen(true)} aria-label={t({ fr: `Voir ${overflow} autres participants`, en: `See ${overflow} more people` })}>
                      +{overflow}
                    </button>
                  )}
                </div>
                {crossing && <GeminiBadge mode={p.mode} talking={hearing} notes={notes} style={{ left: crossing.x, top: crossing.y }} />}
                {crossing && card && p.mode === 'project' && (
                  <div key={card.id} className={`cv-note-card${crossing.y > (wrap.current?.clientHeight ?? 0) * .6 ? ' above' : ''}`} role="status" style={{ left: crossing.x, top: crossing.y }}>
                    <header><Sparkle size={14} />{t({ fr: 'Gemini prend des notes', en: 'Gemini is taking notes' })}</header>
                    <p>{card.text}</p>
                  </div>
                )}
                {p.people.length === 1 && (
                  <div className="cv-alone">
                    {p.waiting > 0
                      ? t({ fr: 'En attente des autres participants', en: 'Waiting for others to join' })
                      : t({ fr: 'Vous êtes seul dans cet appel', en: 'You’re the only one here' })}
                  </div>
                )}
              </div>
            )}
          {captioning && (
            <div ref={capBar} className={`cv-captions${showDoc ? ' over-strip' : ''}`} aria-live="off" aria-label={t({ fr: 'Sous-titres en direct', en: 'Live captions' })}>
              {speakers.slice(0, 3).map((x, i) => <span key={x.id} className="cv-cap-face" style={{ marginLeft: i ? -8 : 0 }}><Avatar person={x} size={24} /></span>)}
              <div className="cv-cap-text">{speakers.length > 0 && <b>{speakers.map((x) => (speakers.length > 1 ? x.name.split(' ')[0] : x.name)).join(', ')}</b>}<p>{captions.text}</p></div>
            </div>
          )}
          <MediaNotice />
          {soundBlocked && !audioMuted && (
            <button type="button" className="cv-sound-chip" onClick={enableSound}><SoundIcon on />{t({ fr: 'Activer le son', en: 'Turn on sound' })}</button>
          )}
        </div>
        {peopleOpen && (
          <PeoplePanel people={p.people} selfId={p.selfId} hand={p.hand} mic={p.mic} mode={p.mode} muted={muted} onClose={() => setPeopleOpen(false)}
            onInvite={p.onInvite && (() => { setPeopleOpen(false); p.onInvite!() })} />
        )}
      </div>

      <div className="cv-bar">
      <div className="cv-bar-left" aria-hidden="true"><span className="cv-bar-time">{elapsed}</span><span className="cv-bar-sep" /><span className="cv-bar-title">{t(p.title)}</span></div>
      <div className="cv-controls" role="toolbar" aria-label={t({ fr: 'Commandes de l’appel', en: 'Call controls' })}>
        <CtlButton icon={p.mic ? 'mic' : 'mic_off'} label={label.mic} shortcut="M" tone={p.mic ? undefined : 'off'} onClick={toggleMic} />
        <CtlButton icon={p.cam ? 'videocam' : 'videocam_off'} label={label.cam} shortcut="C" tone={p.cam ? undefined : 'off'} onClick={toggleCam} />
        <CtlButton className="wide-only" iconNode={<SoundIcon on={!audioMuted} />} label={label.sound} shortcut="S" tone={audioMuted ? 'off' : undefined} onClick={() => setCallAudioMuted(!audioMuted)} />
        <CtlButton className="wide-only" icon={p.captions ? 'closed_caption' : 'closed_caption_off'} label={label.captions} tone={p.captions ? 'active' : undefined} pressed={p.captions} onClick={p.onCaptions} />
        <CtlButton className="wide-only" icon="back_hand" label={label.hand} tone={p.hand ? 'active' : undefined} pressed={p.hand} onClick={toggleHand} />
        {p.onShare && <CtlButton className="wide-only" icon="present_to_all" label={label.share} tone={p.sharing ? 'active' : undefined} pressed={!!p.sharing} onClick={p.onShare} />}
        <CtlButton className="narrow-only" icon="more_vert" label={t({ fr: 'Plus d’options', en: 'More options' })} expanded={moreOpen} onClick={() => setMoreOpen(true)} />
        <button type="button" className="cv-hangup" aria-label={label.hangUp} title={label.hangUp} onClick={p.onHangUp}><Icon name="call_end" fill size={24} /></button>
      </div>
      <div className="cv-bar-right">
        <CtlButton className="wide-only plain" icon="group" label={label.people} tone={peopleOpen ? 'active' : undefined} expanded={peopleOpen} onClick={() => setPeopleOpen((o) => !o)} />
        {p.onInvite && <CtlButton className="wide-only plain" icon="person_add" label={label.invite} onClick={p.onInvite} />}
      </div>
      </div>

      {moreOpen && (
        <MoreSheet onClose={() => setMoreOpen(false)} items={[
          { icon: 'sound', node: <SoundIcon on={!audioMuted} />, label: label.sound, active: audioMuted, run: () => setCallAudioMuted(!audioMuted) },
          { icon: p.captions ? 'closed_caption' : 'closed_caption_off', label: label.captions, active: p.captions, run: p.onCaptions },
          { icon: 'back_hand', label: label.hand, active: p.hand, run: toggleHand },
          ...(p.onShare ? [{ icon: 'present_to_all', label: label.share, active: !!p.sharing, run: p.onShare }] : []),
          { icon: 'group', label: `${label.people} (${p.people.length})`, run: () => setPeopleOpen(true) },
          ...(p.onInvite ? [{ icon: 'person_add', label: label.invite, run: p.onInvite }] : []),
        ]} />
      )}

      <div className="sr-only" role="log" aria-live="polite">{log.map((l) => <p key={l.id}>{l.text}</p>)}</div>
    </div>
  )
}
