/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Launch date simulator: drag the date and watch everything that hangs on it move.
import type { CSSProperties } from 'react'
import type { Message } from '../../data/types'
import { uid, useStore } from '../../store'
import { Avatar, Button, Icon, Sparkle } from '../../ui/kit'
import { Empty, Frame, useBoard } from '../shared'
import { dateLong, dateShort, DAY, launchDefaults, launchModel, money, moneyK, type ChainRow } from './logic'
import { Slider, Stat, useAppState, Verdict, type AppProps } from './ui'

export default function LaunchSim({ block }: AppProps) {
  const { project, viewerId } = useBoard()
  const [state, update, flush] = useAppState(block, launchDefaults)
  const days = Math.max(0, Math.min(14, Number(state.days) || 0))
  const m = launchModel(project, block, days)
  const delta = days - m.committedDays
  const pending = project.messages.find((x) => x.kind === 'proposal' && x.status === 'pending' && x.action.type === 'move-milestone' && x.action.itemId === m.item?.id && x.action.deltaDays === delta)

  if (!m.item || !m.blockId) {
    return <Frame block={block}><Empty icon="event_upcoming" title="No milestone to simulate yet" hint="Add a milestone on the Roadmap and this tool will use it." /></Frame>
  }
  const shiftOthers = m.rows.filter((r) => r.moves && r.id !== m.item!.id).map((r) => r.id)
  const propose = () => {
    const s = useStore.getState()
    flush()
    if (pending) { s.focusMessage(pending.id); s.setMobilePane('chat'); return }
    if (!delta) return
    const id = uid('m')
    const moved = m.rows.filter((r) => r.moves && r.id !== m.item!.id).map((r) => r.label)
    const cost = delta > 0 ? ` It costs about ${money(m.shift)}, the budget lands at ${moneyK(m.total)}.` : ''
    const message: Message = {
      id, kind: 'proposal', authorId: viewerId, at: Date.now(), visibility: { type: 'all' }, status: 'pending',
      title: `Move the launch to ${dateShort(m.date)} (${delta > 0 ? '+' : ''}${delta} days)`,
      description: `From the Launch date simulator. ${moved.length ? `${moved.join(' and ')} move with it.` : ''}${cost} Nothing changes until this is approved.`,
      action: { type: 'move-milestone', blockId: m.blockId!, itemId: m.item!.id, deltaDays: delta, alsoItemIds: shiftOthers },
    }
    s.push(project.id, message)
    s.focusMessage(id)
    s.setMobilePane('chat')
  }

  // A fixed axis: the rows move on it, it does not move under them.
  const maxShift = (14 - days) * DAY
  const from = Math.min(Date.now(), ...m.rows.map((r) => r.start)) - DAY
  const to = Math.max(...m.rows.map((r) => r.end + (r.moves ? maxShift : 0))) + 3 * DAY
  const pos = (t: number) => ((t - from) / (to - from)) * 100
  const shift = (days - m.committedDays) * DAY
  const row = (r: ChainRow) => {
    const left = pos(r.start), width = Math.max(pos(r.end) - left, 0)
    const ghost = pos(r.start - (r.moves ? shift : 0))
    const isMain = r.id === m.item!.id
    return (
      <li key={r.id} className={`ap-chain-row${r.moves ? ' moves' : ''}${isMain ? ' main' : ''}`}>
        <span className="ap-chain-name">{r.ownerId && <Avatar id={r.ownerId} size={20} />}<span className="ap-trunc">{r.label}</span></span>
        <span className="ap-chain-track" aria-hidden="true">
          {r.moves && shift !== 0 && <i className="ap-chain-shift" style={{ left: `${Math.min(ghost, left)}%`, width: `${Math.abs(left - ghost)}%` }} />}
          {r.moves && shift !== 0 && <i className="ap-chain-ghost" style={{ left: `${ghost}%` }} />}
          {r.milestone ? <i className="ap-chain-dot" style={{ left: `${left}%` }} /> : <i className="ap-chain-bar" style={{ left: `${left}%`, width: `${width}%` }} />}
        </span>
        <span className="ap-chain-date">{dateShort(r.start < Date.now() ? r.end : r.start)}{!r.moves && <Icon name="lock" size={12} />}</span>
      </li>
    )
  }
  const over = m.over > 0
  const bud = m.budget
  const meterMax = bud ? bud.target * 1.08 : 1
  const canPropose = !!pending || (delta !== 0)
  return (
    <Frame block={block}>
      <div className="ap ap-launch">
        <div className="ap-hero">
          <div>
            <span className="ap-eyebrow">{project.id === 'aurora' ? 'If Aurora launches on' : `If ${m.rows.find((r) => r.id === m.item!.id)?.label ?? 'it'} lands on`}</span>
            <div className="ap-hero-date gemini-text" data-testid="sim-date">{dateLong(m.date)}</div>
            <span className={`ap-hero-sub${m.weekend ? ' bad' : ''}`}>{m.label}{m.weekend && ', on a weekend'}</span>
          </div>
          {bud && (
            <div className="ap-hero-side">
              <span className="ap-eyebrow">Budget committed</span>
              <b className={over ? 'bad' : ''} data-testid="sim-budget">{moneyK(m.total)}</b>
              <span className="ap-meter" aria-hidden="true" style={{ '--v': `${(m.total / meterMax) * 100}%`, '--t': `${(bud.target / meterMax) * 100}%` } as CSSProperties}><i /><u /></span>
              <small>{over ? `${moneyK(m.over)} over the ${moneyK(bud.target)} target` : `under the ${moneyK(bud.target)} target`}</small>
            </div>
          )}
        </div>
        <Slider label="Launch date" hideLabel min={0} max={14} value={days} text={`${dateLong(m.date)}, ${m.label}`} onChange={(v) => update({ days: v })} onCommit={flush}
          marks={[{ at: 0, label: 'Hold' }, { at: 7, label: '+7', tone: 'ai' }, { at: 14, label: '+14' }]} />
        <ol className="ap-chain" aria-label="What moves with the date">{m.rows.map(row)}</ol>
        <div className="ap-stats">
          {m.budget && <Stat label="Shift cost" value={money(m.shift)} note={days === 0 ? 'Nothing to rebook' : m.shiftPriced && days === 7 ? 'Léa’s figure: venue, retailers' : 'Estimate, pro rata of Léa’s €3,500'} tone={days ? 'warn' : undefined} />}
          {m.airFreight > 0 && <Stat label="Air freight" value={money(m.airFreight)} note="Already in the air: spent in every scenario" />}
          <Stat label="Buffer" value={`${m.buffer} ${m.buffer === 1 ? 'day' : 'days'}`} note={m.buffer ? 'If Lumen Works slips again' : 'If Lumen Works slips again, you are dry'} tone={m.buffer >= 7 ? 'good' : m.buffer === 0 ? 'bad' : 'warn'} />
          {m.preorders && <Stat label="Preorders at risk" value={m.preorders.atRisk ? `about ${m.preorders.atRisk}` : 'None'} note={m.preorders.atRisk ? `of ${m.preorders.total}, or ${money(m.preorders.euros)}. My estimate.` : `of about ${m.preorders.total} expected. My estimate.`} tone={m.preorders.atRisk > 60 ? 'bad' : undefined} />}
          {m.press && <Stat label={`Press embargo, ${m.press.name}`} value={m.press.level === 'bad' ? 'Lost' : m.days ? `Tell by ${dateShort(m.press.by)}` : 'Holds'} note={m.press.label} tone={m.press.level === 'bad' ? 'bad' : m.press.level === 'good' ? 'good' : 'warn'} />}
        </div>
        <Verdict tone={m.level}>{m.verdict}</Verdict>
        <div className="ap-actions">
          <Button variant="gemini" onClick={propose} disabled={!canPropose}>
            <Sparkle size={16} />{pending ? 'Already proposed: see it' : delta === 0 ? (m.committedDays ? 'On the roadmap' : 'This is the current date') : 'Propose this date'}
          </Button>
          <span className="ap-actions-note">{pending ? 'Waiting in the chat for a decision.' : delta === 0 ? 'Drag to try another date.' : 'Posts a proposal in the chat. Nothing moves until it is approved.'}</span>
        </div>
      </div>
    </Frame>
  )
}
