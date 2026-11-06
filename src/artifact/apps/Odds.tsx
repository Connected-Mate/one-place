/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Odds machine: a number that is honest about being invented.
import { useState } from 'react'
import { Button, Icon, Sparkle } from '../../ui/kit'
import { Empty, Frame, useBoard } from '../shared'
import { movesFor, ODDS_BASE, oddsOf, oddsRemark, todoDone, type OddsMove } from './logic'
import { Dial } from './RadarMini'
import { Switch, useAppState, Verdict, type AppProps } from './ui'

export const oddsStates = (moves: OddsMove[], picked: Record<string, boolean>, project: Parameters<typeof todoDone>[0]) =>
  moves.map((m) => picked[m.id] ?? (m.id === 'phone' || todoDone(project, m.todo)))

export default function Odds({ block }: AppProps) {
  const { project } = useBoard()
  const [state, update] = useAppState(block, { picked: {} as Record<string, boolean> })
  const picked = state.picked as Record<string, boolean>
  const moves = movesFor(project)
  const states = oddsStates(moves, picked, project)
  const [last, setLast] = useState<string | undefined>()
  const [spins, setSpins] = useState(0)
  const [offset, setOffset] = useState(0)
  if (!moves.length) return <Frame block={block}><Empty icon="casino" title="Nothing to weigh yet" hint="Add open to-dos and each becomes a switch." /></Frame>
  const real = oddsOf(moves, (m) => states[moves.indexOf(m)])
  const shown = Math.max(0, Math.min(100, real + offset))
  const remark = spins > 0 && !last ? (spins % 2 ? `Same inputs, new number. ${shown}% now. That should tell you everything about this number.` : `And back to ${shown}%. I could do this all day. I am not sure you should.`) : oddsRemark(moves, states, real, last)
  const spin = () => { setLast(undefined); setSpins((n) => n + 1); setOffset((spins + 1) % 2 ? (real > 50 ? -3 : 3) : 0) }
  return (
    <Frame block={block}>
      <div className="ap ap-odds">
        <div className="ap-odds-grid">
        <div className="ap-odds-dial">
          <Dial value={shown} />
          <div className="ap-odds-num"><b className="gemini-text" data-testid="odds-value">{shown}%</b><span className="ap-made-up"><Icon name="warning" size={14} />Completely made up</span></div>
          <small className="ap-foot center">Chance of a conversation. Starts at {ODDS_BASE}%, because someone has to start it somewhere. Not a measurement, not a forecast, and it knows nothing about how anyone hires.</small>
        </div>
        <div className="ap-odds-moves" role="group" aria-label="The moves in the plan">
          <h4 className="ap-h">The moves in the plan</h4>
          {moves.map((m, i) => (
            <Switch key={m.id} on={states[i]} label={m.label} hint={`Multiplies the invented number by ${m.weight}`} onChange={(v) => { setLast(m.id); setOffset(0); update((s) => ({ picked: { ...(s.picked as Record<string, boolean>), [m.id]: v } })) }} />
          ))}
        </div>
        </div>
        <Verdict>{remark}</Verdict>
        <div className="ap-actions">
          <Button variant="tonal" onClick={spin}><Sparkle size={16} />Get a second opinion</Button>
          <span className="ap-actions-note">The second opinion is also me.</span>
        </div>
      </div>
    </Frame>
  )
}
