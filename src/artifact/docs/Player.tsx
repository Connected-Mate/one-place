/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// A player for Audio and Video Overviews and video files. Nothing heavy ships with the demo: time runs for real,
// the transcript follows it, a video is its poster moving slowly. The controls behave like a real player's.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { TranscriptLine } from '../../data/types'
import { useT } from '../../i18n'
import { Icon, IconButton, Sparkle } from '../../ui/kit'
import { prefersReducedMotion, revealIn } from '../shared'

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const SPEEDS = [1, 1.5, 2]

export function Player({ kind, title, durationSec, poster, transcript = [] }: { kind: 'audio' | 'video'; title: string; durationSec: number; poster?: string; transcript?: TranscriptLine[] }) {
  const t = useT()
  const [at, setAt] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const list = useRef<HTMLOListElement>(null)
  const still = prefersReducedMotion()

  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    const timer = setInterval(() => {
      const now = performance.now()
      const step = ((now - last) / 1000) * speed
      last = now
      setAt((v) => {
        if (v + step >= durationSec) { setPlaying(false); return durationSec }
        return v + step
      })
    }, 200)
    return () => clearInterval(timer)
  }, [playing, speed, durationSec])

  const line = useMemo(() => {
    let i = -1
    transcript.forEach((l, x) => { if (l.at <= at) i = x })
    return i
  }, [transcript, at])
  useEffect(() => {
    if (line >= 0) revealIn(list.current, list.current?.children[line], { top: 8, right: 0, bottom: 8, left: 0 }, true)
  }, [line])
  const bars = useMemo(() => Array.from({ length: 56 }, (_, i) => 22 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.31)) * 78), [])
  const share = durationSec ? at / durationSec : 0
  const toggle = () => {
    if (!playing && at >= durationSec) setAt(0)
    setPlaying((p) => !p)
  }
  const seek = (v: number) => setAt(Math.max(0, Math.min(durationSec, v)))

  return (
    <div className={`rp-player ${kind}`}>
      {kind === 'video' ? (
        <button type="button" className="rp-player-stage" aria-label={playing ? t({ fr: 'Pause', en: 'Pause' }) : t({ fr: `Lire ${title}`, en: `Play ${title}` })} onClick={toggle}>
          {poster
            ? <img src={poster} alt="" style={still ? undefined : { transform: `scale(${1 + share * 0.1})` }} />
            : <span className="rp-player-gem"><Sparkle size={48} /></span>}
          {!playing && <span className="rp-player-big"><Icon name="play_arrow" fill size={36} /></span>}
          {playing && line >= 0 && <span className="rp-player-caption">{t(transcript[line].text)}</span>}
        </button>
      ) : (
        <div className="rp-player-wave" aria-hidden="true">
          {bars.map((h, i) => <i key={i} className={i / bars.length <= share ? 'on' : ''} style={{ height: `${h}%`, animationDelay: `${i * 30}ms` }} data-live={playing && !still ? 'y' : undefined} />)}
        </div>
      )}
      <div className="rp-player-bar">
        <IconButton icon={playing ? 'pause' : 'play_arrow'} size={40} label={playing ? t({ fr: 'Pause', en: 'Pause' }) : t({ fr: 'Lecture', en: 'Play' })} onClick={toggle} />
        <span className="rp-player-time">{clock(at)}</span>
        <input type="range" min={0} max={durationSec} step={1} value={Math.round(at)} aria-label={t({ fr: 'Position', en: 'Seek' })} aria-valuetext={`${clock(at)} of ${clock(durationSec)}`} onChange={(e) => seek(Number(e.target.value))} />
        <span className="rp-player-time">{clock(durationSec)}</span>
        <button type="button" className="rp-player-speed" aria-label={t({ fr: `Vitesse ${speed}x`, en: `Speed ${speed}x` })} onClick={() => setSpeed((v) => SPEEDS[(SPEEDS.indexOf(v) + 1) % SPEEDS.length])}>{speed}x</button>
      </div>
      {transcript.length > 0 && (
        <ol ref={list} className="rp-player-lines" aria-label={t({ fr: 'Transcription', en: 'Transcript' })}>
          {transcript.map((l, i) => (
            <li key={i} className={i === line ? 'on' : ''}>
              <button type="button" onClick={() => seek(l.at)}>
                <time>{clock(l.at)}</time>
                <span>{l.who && <b>{l.who}: </b>}{t(l.text)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
