/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The live compact version of each tool, on the Overview. A tile is one big button: nothing in here is interactive.
import { useEffect, useRef, useState } from 'react'
import { personById } from '../../store'
import { Avatar } from '../../ui/kit'
import { useBoard } from '../shared'
import { DialMini, Radar } from './RadarMini'
import { candidateDefaults, candidatesOf, colorDefaults, COLORS, dateShort, dealDefaults, dealFacts, dealMath, DESKS, deckOf, fmtClock, launchDefaults, launchModel, money, moneyK, movesFor, oddsOf, PITCH_SECONDS, pollOf, scoreTotal, scriptFrom, seatDefaults, seatRulesFor, seatScore, todoDone, wordCount, WPM, type Scores } from './logic'
import type { AppBlock as App } from './ui'
import './apps.css'

function LaunchTile({ block }: { block: App }) {
  const { project } = useBoard()
  const days = Number((block.state ?? launchDefaults).days ?? 0)
  const m = launchModel(project, block, days)
  return (
    <span className="ap-tile">
      <span className="ap-tile-big gemini-text">{dateShort(m.date)}</span>
      <span className="ap-tile-sub">{m.label}</span>
      {m.budget && <span className={`ap-tile-line${m.over > 0 ? ' bad' : ''}`}><b>{moneyK(m.total)}</b> of {moneyK(m.budget.target)}</span>}
      <span className="ap-tile-slider" aria-hidden="true"><i style={{ width: `${(days / 14) * 100}%` }} /><u style={{ left: `${(days / 14) * 100}%` }} /><em style={{ left: '50%' }} /></span>
    </span>
  )
}
function ColorTile({ block }: { block: App }) {
  const { project } = useBoard()
  const root = useRef<HTMLSpanElement>(null)
  const [poster, setPoster] = useState<string | null>(null)
  const poll = pollOf(project)
  const view = String((block.state ?? colorDefaults).view ?? 'compare')
  useEffect(() => {
    let dead = false
    let ok = false
    try { const c = document.createElement('canvas'); ok = !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { ok = false }
    if (!ok) return
    const run = () => import('./studio3d').then((m) => {
      const r = root.current?.getBoundingClientRect()
      if (!dead) setPoster(m.renderPoster(Math.round(r?.width || 320), Math.round(r?.height || 200)))
    }).catch(() => undefined)
    const idle = window.requestIdleCallback?.(run, { timeout: 1500 }) ?? window.setTimeout(run, 300)
    return () => { dead = true; if (window.cancelIdleCallback) window.cancelIdleCallback(idle); else clearTimeout(idle) }
  }, [])
  return (
    <span className="ap-tile ap-tile-color" ref={root}>
      {poster ? <img src={poster} alt="" /> : <span className="ap-tile-colorbg" aria-hidden="true" />}
      <span className="ap-tile-pollbar">
        {poll.options.filter((o) => o.id !== 'both').map((o) => <span key={o.id}><i style={{ background: COLORS[o.id as 'sand' | 'slate']?.css ?? 'var(--outline)' }} />{o.label} {o.votes.length}</span>)}
        {!poll.options.length && <span>{view === 'compare' ? 'Sand and Slate' : view}</span>}
      </span>
    </span>
  )
}
function SeatsTile({ block }: { block: App }) {
  const { project } = useBoard()
  const seats = ((block.state ?? seatDefaults).seats ?? seatDefaults.seats) as Record<string, string>
  const score = seatScore(seatRulesFor(project), seats)
  return (
    <span className="ap-tile ap-tile-row">
      <svg viewBox="200 40 500 300" className="ap-tile-plan" aria-hidden="true">
        {DESKS.map((d) => <rect key={d.id} x={d.x - 30} y={d.y - 19} width={60} height={38} rx={6} className="ap-tile-desk" />)}
        {Object.entries(seats).map(([id, desk]) => { const d = DESKS.find((x) => x.id === desk); return d && <circle key={id} cx={d.x} cy={d.y} r={18} fill={personById(id).hue} /> })}
      </svg>
      {score.total > 0 && <span className="ap-tile-side"><b className="ap-tile-big gemini-text">{score.met}/{score.total}</b><small>needs met</small></span>}
    </span>
  )
}
function CandTile({ block }: { block: App }) {
  const { project } = useBoard()
  const st = { ...candidateDefaults, ...block.state }
  const scores = st.scores as Scores
  const everyone = candidatesOf(project)
  const ids = (st.selected as string[]).filter((id) => everyone.some((c) => c.id === id)).slice(0, 3)
  return (
    <span className="ap-tile ap-tile-row">
      <span className="ap-tile-radar"><Radar scores={scores} ids={ids} /></span>
      <span className="ap-tile-list">
        {ids.map((id) => { const c = everyone.find((x) => x.id === id)!; return <span key={id} className="ap-tile-li">{c.personId ? <Avatar id={c.personId} size={20} /> : null}<span className="ap-trunc">{c.name.split(' ')[0]}</span><b>{scoreTotal(scores, id).toFixed(1)}</b></span> })}
      </span>
    </span>
  )
}
function DealTile({ block }: { block: App }) {
  const { project } = useBoard()
  const t = { ...dealDefaults, ...block.state } as typeof dealDefaults
  const f = dealFacts(project, block)
  const m = dealMath(f, t)
  const span = (p: number) => ((p - 95) / (149 - 95)) * 100
  return (
    <span className="ap-tile">
      <span className={`ap-tile-big${m.belowFloor ? ' bad' : ' gemini-text'}`}>{money(t.price)}</span>
      <span className="ap-tile-sub">{t.volume} lamps, {t.warranty}-year warranty</span>
      <span className={`ap-tile-line${m.belowFloor ? ' bad' : ''}`}><b>{m.marginPct.toFixed(0)}%</b> margin, {money(m.margin)}</span>
      <span className="ap-tile-slider" aria-hidden="true"><i style={{ width: `${span(t.price)}%` }} /><u style={{ left: `${span(t.price)}%` }} /><em className="bad" style={{ left: `${span(f.floor)}%` }} /></span>
    </span>
  )
}
function OddsTile({ block }: { block: App }) {
  const { project } = useBoard()
  const picked = ((block.state ?? {}).picked ?? {}) as Record<string, boolean>
  const moves = movesFor(project)
  const value = oddsOf(moves, (m) => picked[m.id] ?? (m.id === 'phone' || todoDone(project, m.todo)))
  return (
    <span className="ap-tile ap-tile-dial">
      <DialMini value={value} />
      <span className="ap-tile-dial-text"><span className="ap-tile-big gemini-text">{value}%</span><span className="ap-tile-sub">Completely made up</span></span>
    </span>
  )
}
function PitchTile({ block }: { block: App }) {
  const { project } = useBoard()
  const deck = deckOf(project, block)
  const script = String((block.state ?? {}).script ?? '') || scriptFrom(deck)
  const words = wordCount(script)
  return (
    <span className="ap-tile">
      <span className="ap-tile-big gemini-text">{fmtClock(PITCH_SECONDS)}</span>
      <span className="ap-tile-sub">{deck?.slides.length ?? 0} slides, {words} words</span>
      <span className="ap-tile-line">about <b>{fmtClock(Math.round((words / WPM) * 60))}</b> out loud</span>
    </span>
  )
}

export function AppTile({ block }: { block: App }) {
  switch (block.app) {
    case 'launch-sim': return <LaunchTile block={block} />
    case 'colorway': return <ColorTile block={block} />
    case 'seats': return <SeatsTile block={block} />
    case 'candidates': return <CandTile block={block} />
    case 'deal': return <DealTile block={block} />
    case 'odds': return <OddsTile block={block} />
    case 'pitch': return <PitchTile block={block} />
  }
}
