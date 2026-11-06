/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Deal calculator: the Northwind terms, the margin they leave, and the line Léa will not cross.
import { useRef, type PointerEvent as RPointer } from 'react'
import { Button, Icon, Sparkle } from '../../ui/kit'
import { Frame, useBoard } from '../shared'
import { dealDefaults, dealFacts, dealMath, dealReplyText, dealVerdict, gridPrice, money } from './logic'
import { clamp, compose, Seg, Slider, Stat, Switch, useAppState, useWidth, Verdict, type AppProps } from './ui'

const PMIN = 95, PMAX = 149

export default function Deal({ block }: AppProps) {
  const { project } = useBoard()
  const [state, update, flush] = useAppState(block, dealDefaults)
  const t = { volume: Number(state.volume), price: Number(state.price), warranty: Number(state.warranty), engraving: Number(state.engraving), bordeaux: !!state.bordeaux }
  const f = dealFacts(project, block)
  const m = dealMath(f, t)
  const v = dealVerdict(f, t)
  const priya = dealMath(f, { ...t, price: f.counter, warranty: 2 })
  const offer = dealMath(f, { ...t, price: f.lastOffer, warranty: 1 })
  const grid = gridPrice(f, t.volume)
  const [box, W] = useWidth<HTMLDivElement>(700)
  const H = W < 480 ? 190 : 230, top = 44, bottom = 24, left = 8, right = 8
  const x = (p: number) => left + ((p - PMIN) / (PMAX - PMIN)) * (W - left - right)
  const marginAt = (p: number) => dealMath(f, { ...t, price: p }).margin
  const maxY = Math.max(marginAt(PMAX), 1), minY = Math.min(0, marginAt(PMIN)) || marginAt(PMIN) * 0.7
  const y = (val: number) => top + (1 - (val - minY) / (maxY - minY)) * (H - top - bottom)
  const pts = Array.from({ length: PMAX - PMIN + 1 }, (_, i) => PMIN + i)
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)} ${y(marginAt(p)).toFixed(1)}`).join(' ')
  const area = `${line} L${x(PMAX)} ${y(minY)} L${x(PMIN)} ${y(minY)} Z`
  const dragging = useRef(false)
  const fromEvent = (e: RPointer<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    update({ price: Math.round(clamp(PMIN + ((e.clientX - r.left - left) / (W - left - right)) * (PMAX - PMIN), PMIN, PMAX)) })
  }
  const dim = (val: number) => `${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  const rows = [
    { label: 'Unit price', cells: [money(t.price), money(f.counter), money(f.lastOffer)] },
    { label: 'Warranty', cells: [`${t.warranty} ${t.warranty === 1 ? 'year' : 'years'}`, '2 years', '1 year'] },
    { label: 'Margin per lamp', cells: [money(m.unitMargin), money(priya.unitMargin), money(offer.unitMargin)] },
    { label: 'Margin', cells: [`${dim(m.marginPct)}%`, `${dim(priya.marginPct)}%`, `${dim(offer.marginPct)}%`] },
    { label: `On ${t.volume} lamps`, cells: [money(m.margin), money(priya.margin), money(offer.margin)] },
  ]
  const floorCells = [t.price >= f.floor, f.counter >= f.floor, f.lastOffer >= f.floor]
  const signed = f.rollout.filter((r, i) => i === 0 || (r.signed && t.bordeaux))
  const rollTotal = f.rollout.reduce((n, r) => n + r.rooms, 0)
  const bars = f.rollout.map((r, i) => ({ ...r, on: i === 0 || (t.bordeaux && r.signed) }))
  const volumeLamps = t.volume + (t.bordeaux ? (f.rollout.find((r) => r.signed)?.rooms ?? 0) : 0)
  return (
    <Frame block={block}>
      <div className="ap ap-deal">
        <div className="ap-deal-top">
          <div className="ap-deal-big">
            <span className="ap-eyebrow">Margin per lamp, after warranty and engraving</span>
            <b className={m.belowFloor ? 'bad' : 'gemini-text'} data-testid="deal-margin">{money(m.unitMargin)}</b>
            <span className={m.belowFloor ? 'ap-floor-flag bad' : 'ap-floor-flag'}><Icon name={m.belowFloor ? 'error' : 'check_circle'} size={16} />{m.belowFloor ? `${money(f.floor - t.price)} below Léa’s floor` : `${money(t.price - f.floor)} above Léa’s floor`}</span>
          </div>
          <div className="ap-stats tight">
            <Stat label="Margin" value={`${m.marginPct.toFixed(0)}%`} tone={m.belowFloor ? 'bad' : undefined} />
            <Stat label="Deal margin" value={money(m.margin)} />
            <Stat label="Grid price here" value={money(grid)} note={t.price < grid ? `You are ${Math.round(((grid - t.price) / grid) * 100)}% under` : 'You are at or above'} />
          </div>
        </div>
        <div className="ap-deal-chart" ref={box}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Deal margin against unit price. Your price ${money(t.price)}, Léa’s floor ${money(f.floor)}, Priya’s budget ${money(f.counter)}.`}
            onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); fromEvent(e) }}
            onPointerMove={(e) => { if (dragging.current) fromEvent(e) }}
            onPointerUp={() => { dragging.current = false; flush() }} onPointerCancel={() => { dragging.current = false; flush() }}>
            <defs>
              <linearGradient id="ap-deal-fill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#4285f4" stopOpacity=".22" /><stop offset=".55" stopColor="#9b72cb" stopOpacity=".2" /><stop offset="1" stopColor="#d96570" stopOpacity=".16" /></linearGradient>
              <linearGradient id="ap-deal-line" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#4285f4" /><stop offset=".55" stopColor="#9b72cb" /><stop offset="1" stopColor="#d96570" /></linearGradient>
            </defs>
            <rect x={x(PMIN)} y={top - 8} width={x(f.floor) - x(PMIN)} height={H - top - bottom + 8} className="ap-deal-danger" />
            <path d={area} fill="url(#ap-deal-fill)" />
            <path d={line} fill="none" stroke="url(#ap-deal-line)" strokeWidth="2.5" />
            {[{ p: f.counter, l: `Priya ${money(f.counter)}`, row: 0, cls: 'priya' }, { p: f.floor, l: W < 480 ? `Floor ${money(f.floor)}` : `Léa’s floor ${money(f.floor)}`, row: 1, cls: 'floor' }, { p: f.lastOffer, l: W < 480 ? `Offer ${money(f.lastOffer)}` : `Our offer ${money(f.lastOffer)}`, row: 0, cls: 'offer' }].map((mk) => (
              <g key={mk.cls} className={`ap-deal-mark ${mk.cls}`}>
                <line x1={x(mk.p)} x2={x(mk.p)} y1={mk.row ? 28 : 12} y2={H - bottom} />
                <text x={x(mk.p) + 4} y={mk.row ? 36 : 20}>{mk.l}</text>
              </g>
            ))}
            <line x1={x(t.price)} x2={x(t.price)} y1={y(m.margin)} y2={H - bottom} className="ap-deal-you-line" />
            <text x={clamp(x(t.price), 40, W - 40)} y={y(m.margin) - 16} textAnchor="middle" className="ap-deal-you-text">{money(m.margin)}</text>
            <circle cx={x(t.price)} cy={y(m.margin)} r="9" className={`ap-deal-you${m.belowFloor ? ' bad' : ''}`} />
            <text x={clamp(x(t.price), 30, W - 30)} y={H - 6} textAnchor="middle" className="ap-deal-you-text">{money(t.price)}</text>
          </svg>
        </div>
        <div className="ap-deal-controls">
          <Slider label="Unit price" min={PMIN} max={PMAX} value={t.price} text={money(t.price)} onChange={(p) => update({ price: p })} onCommit={flush}
            marks={[{ at: f.counter, label: 'Priya', side: 'left' }, { at: f.floor, label: 'Floor', tone: 'bad' }, { at: f.lastOffer, label: 'Offer' }, { at: f.list, label: 'List' }]} />
          <Slider label="Volume" min={50} max={800} step={10} value={t.volume} text={`${t.volume} lamps`} onChange={(p) => update({ volume: p })} onCommit={flush} marks={[{ at: 400, label: 'Lyon' }]} />
          <Slider label="Engraving, charged per unit" min={0} max={6} value={t.engraving} text={t.engraving ? `${money(t.engraving)} (costs ${money(f.engravingCost)})` : 'None'} onChange={(p) => update({ engraving: p })} onCommit={flush} marks={[{ at: 4, label: 'Quoted' }]} />
          <div className="ap-field">
            <span className="ap-field-label">Warranty</span>
            <Seg label="Warranty" value={String(t.warranty)} onChange={(w) => update({ warranty: Number(w) })} options={[{ id: '1', label: '1 year' }, { id: '2', label: '2 years', aria: `2 years, costs ${money(f.warrantyPerYear)} per lamp` }, { id: '3', label: '3 years' }]} />
            <small>Each year past the first costs {money(f.warrantyPerYear)} a lamp{t.warranty === 3 ? ', my estimate for year 3' : ''}.</small>
          </div>
        </div>
        <section aria-label="Comparison">
          <h4 className="ap-h">Against Priya’s email</h4>
          <div className="ap-compare" role="table">
            <div role="row" className="head"><span role="columnheader" /><span role="columnheader">Your terms</span><span role="columnheader">Priya asks</span><span role="columnheader">Our last offer</span></div>
            {rows.map((r) => <div role="row" key={r.label}><span role="rowheader">{r.label}</span>{r.cells.map((c, i) => <span role="cell" key={i} className={i === 0 ? 'mine' : ''}>{c}</span>)}</div>)}
            <div role="row"><span role="rowheader">Léa signs</span>{floorCells.map((ok, i) => <span role="cell" key={i} className={ok ? 'yes' : 'no'}><Icon name={ok ? 'check' : 'close'} size={16} />{ok ? 'Yes' : 'No'}</span>)}</div>
          </div>
        </section>
        {f.rollout.length > 0 && (
          <section aria-label="Rollout">
            <Switch label="Bordeaux written into the contract" hint="What Léa asked for in return, and what Priya offered to put on her board’s agenda." on={t.bordeaux} onChange={(b) => update({ bordeaux: b })} />
            <ul className="ap-rollout">
              {bars.map((r) => <li key={r.label} className={r.on ? 'on' : ''}><span className="ap-trunc">{r.label}</span><i><u style={{ width: `${(r.rooms / Math.max(...f.rollout.map((x) => x.rooms))) * 100}%` }} /></i><b>{r.on ? money(r.rooms * (t.price + t.engraving)) : `${r.rooms} rooms`}</b></li>)}
            </ul>
            <small className="ap-foot">{signed.length > 1 ? `${volumeLamps} lamps under contract of ${rollTotal} rooms in sight.` : `${t.volume} lamps under contract of ${rollTotal} rooms in sight.`}</small>
          </section>
        )}
        <Verdict tone={v.level}>{v.text}</Verdict>
        <div className="ap-actions">
          <Button variant="gemini" onClick={() => { flush(); compose(dealReplyText(t)) }}><Sparkle size={16} />Draft the reply with these terms</Button>
          <span className="ap-actions-note">Goes to your composer. Nothing is sent to Priya.</span>
        </div>
      </div>
    </Frame>
  )
}
