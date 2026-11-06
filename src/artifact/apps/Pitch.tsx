/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Pitch timer: a teleprompter fed by the project's own slides, a countdown, and a word check that buzzes.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Button, Icon, IconButton, Sparkle } from '../../ui/kit'
import { Empty, Frame, useBoard } from '../shared'
import { buzzWords, BUZZ, deckOf, en, fmtClock, PITCH_SECONDS, scriptFrom, wordCount, WPM } from './logic'
import { useAppState, Verdict, type AppProps } from './ui'

type Rec = { continuous: boolean; interimResults: boolean; lang: string; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null }
const Recognition = () => (window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition

let audio: AudioContext | null = null
function buzzSound() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
    const o = audio.createOscillator(), g = audio.createGain()
    o.type = 'square'; o.frequency.value = 110
    g.gain.setValueAtTime(0.06, audio.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.32)
    o.connect(g).connect(audio.destination)
    o.start(); o.stop(audio.currentTime + 0.34)
  } catch { /* no sound on this device: the screen still buzzes */ }
  try { navigator.vibrate?.([70, 40, 70]) } catch { /* no vibration here */ }
}

export default function Pitch({ block }: AppProps) {
  const { project } = useBoard()
  const deck = deckOf(project, block)
  const seedText = useMemo(() => scriptFrom(deck), [deck])
  const [state, update, flush] = useAppState(block, { script: '' as string, best: 0 as number })
  const script = String(state.script) || seedText
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [editing, setEditing] = useState(false)
  const [buzz, setBuzz] = useState<string | null>(null)
  const [hits, setHits] = useState(0)
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const seen = useRef(0)
  const started = useRef(0)
  const buzzTimer = useRef(0)

  const trip = useCallback((word: string) => {
    setBuzz(word); setHits((n) => n + 1); buzzSound()
    clearTimeout(buzzTimer.current)
    buzzTimer.current = window.setTimeout(() => setBuzz(null), 1800)
  }, [])

  useEffect(() => {
    if (!running) return
    started.current = performance.now() - elapsed * 1000
    let raf = 0
    const tick = (now: number) => { setElapsed((now - started.current) / 1000); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running]) // eslint-disable-line react-hooks/exhaustive-deps

  const paras = script.split(/\n\s*\n/).map((p) => p.split('\n').filter(Boolean)).filter((p) => p.length)
  const lines = paras.flat()
  const words = wordCount(script)
  const allotted = (words / WPM) * 60
  const counts = lines.map(wordCount)
  const total = counts.reduce((a, b) => a + b, 0) || 1
  // Reading pace: the highlighted line follows the clock at a calm spoken speed.
  const spokenWords = (elapsed / Math.max(PITCH_SECONDS, allotted)) * total
  let current = -1, acc = 0
  if (elapsed > 0) { for (let i = 0; i < lines.length; i++) { acc += counts[i]; if (spokenWords <= acc) { current = i; break } } if (current < 0) current = lines.length - 1 }
  useEffect(() => {
    const box = scroller.current
    if (!box || current < 0) return
    const el = box.querySelector<HTMLElement>(`[data-line="${current}"]`)
    if (el) box.scrollTo({ top: el.offsetTop - box.clientHeight * 0.34, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [current])

  const left = PITCH_SECONDS - elapsed
  const over = left < 0
  const pct = Math.min(1, elapsed / PITCH_SECONDS)

  // Rehearsing out loud: what the microphone hears goes through the same word check.
  const rec = useRef<Rec | null>(null)
  const canListen = !!Recognition()
  const listen = () => {
    if (listening) { rec.current?.stop(); setListening(false); return }
    const R = Recognition()
    if (!R) return
    const r = new R()
    r.continuous = true; r.interimResults = true; r.lang = 'en-US'
    seen.current = 0
    r.onresult = (e) => {
      const text = Array.from(e.results as ArrayLike<ArrayLike<{ transcript: string }>>).map((x) => x[0].transcript).join(' ')
      setHeard(text)
      const found = buzzWords(text)
      if (found.length > seen.current) { trip(found[found.length - 1]); seen.current = found.length }
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    rec.current = r
    try { r.start(); setListening(true) } catch { setListening(false) }
  }
  useEffect(() => () => { rec.current?.stop(); clearTimeout(buzzTimer.current) }, [])

  const onEdit = (value: string) => {
    const before = buzzWords(script).length, found = buzzWords(value)
    if (found.length > before) trip(found[found.length - 1])
    update({ script: value })
  }
  const flagged = buzzWords(script)
  const reset = () => { setRunning(false); setElapsed(0); setHeard(''); seen.current = 0; setHits(0); scroller.current?.scrollTo({ top: 0 }) }
  const highlight = (text: string) => {
    const parts = text.split(BUZZ)
    return parts.map((part, i) => (i % 2 ? <mark key={i} className="ap-buzzword">{part}</mark> : part))
  }
  const fitLine = allotted > PITCH_SECONDS
    ? `${words} words is about ${fmtClock(Math.round(allotted))} at ${WPM} words a minute. ${Math.round(((allotted - PITCH_SECONDS) / 60) * WPM)} words have to go.`
    : `${words} words is about ${fmtClock(Math.round(allotted))} at ${WPM} words a minute. You have ${fmtClock(Math.round(PITCH_SECONDS - allotted))} left to breathe, and to say it like you mean it.`
  const verdict = flagged.length ? `The script says “${flagged[0]}”. That is the one rule. Take it out before anyone hears it.` : over ? `${fmtClock(Math.abs(Math.round(left)))} over. Nobody has ever complained that a pitch was too short.` : elapsed > 0 && !running && pct > 0.9 ? `${fmtClock(Math.round(elapsed))}. Close enough. Stop rehearsing and send it.` : fitLine
  if (!deck) return <Frame block={block}><Empty icon="timer" title="No slides to read from" hint="Add a deck to this project and it becomes the script." /></Frame>
  return (
    <Frame block={block}>
      <div className={`ap ap-pitch${buzz ? ' buzzing' : ''}`}>
        <div className="ap-pitch-head">
          <div className={`ap-clock${over ? ' over' : ''}`} style={{ '--p': `${pct * 360}deg` } as CSSProperties} role="timer" aria-label={`${fmtClock(Math.round(left))} left`}>
            <span data-testid="pitch-clock">{fmtClock(Math.ceil(left))}</span>
          </div>
          <div className="ap-pitch-ctl">
            <div className="ap-pitch-title"><b>{en(deck.title)}</b><small>{deck.slides.length} slides, {words} words</small></div>
            <div className="ap-pitch-btns">
              <Button variant="filled" icon={running ? 'pause' : 'play_arrow'} onClick={() => setRunning((r) => !r)} data-testid="pitch-start">{running ? 'Pause' : elapsed ? 'Resume' : 'Start'}</Button>
              <IconButton icon="restart_alt" label="Reset the clock" onClick={reset} />
              {canListen && <IconButton icon={listening ? 'mic' : 'mic_off'} active={listening} label={listening ? 'Stop listening' : 'Listen while I rehearse'} onClick={listen} data-testid="pitch-mic" />}
              <IconButton icon={editing ? 'check' : 'edit'} active={editing} label={editing ? 'Done editing' : 'Edit the script'} onClick={() => { flush(); setEditing((e) => !e) }} data-testid="pitch-edit" />
            </div>
          </div>
        </div>
        <div className="ap-buzz" data-on={buzz ? 'true' : undefined} role="status" aria-live="assertive">
          {buzz ? <><Icon name="notifications_active" fill size={18} /><b>Bzzzt.</b> “{buzz}” is banned.{hits > 1 ? ` That is ${hits} now.` : ''}</> : <span>Word check on: “disrupt”, “passionate” and friends will buzz.</span>}
        </div>
        {editing ? (
          <textarea className="ap-pitch-edit" value={script} aria-label="Your pitch script" data-testid="pitch-text" onChange={(e) => onEdit(e.target.value)} onBlur={flush} rows={12} />
        ) : (
          <div className="ap-prompter-wrap"><div ref={scroller} className="ap-prompter" tabIndex={0} aria-label="Teleprompter">
            <div className="ap-prompter-pad" />
            {(() => { let n = -1; return paras.map((p, i) => (
              <div key={i} className="ap-prompter-slide">
                <small>Slide {i + 1}</small>
                {p.map((line, j) => { n++; return <p key={j} data-line={n} className={n === current ? 'now' : n < current ? 'past' : ''}>{highlight(line)}</p> })}
              </div>
            )) })()}
            <div className="ap-prompter-pad" />
          </div></div>
        )}
        {listening && <p className="ap-heard" aria-live="off"><Icon name="graphic_eq" size={16} />{heard ? heard.slice(-120) : 'Listening. Nothing leaves this rehearsal except what your browser needs to transcribe it.'}</p>}
        <Verdict tone={flagged.length || over ? 'bad' : undefined}>{verdict}</Verdict>
        <p className="ap-foot"><Sparkle size={14} />Script drafted from the slides. {canListen ? 'The microphone is off until you press it.' : 'Live listening is not available in this browser, so the word check reads what you type.'}</p>
      </div>
    </Frame>
  )
}
