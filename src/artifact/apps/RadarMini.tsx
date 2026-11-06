/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The radar and the dial: drawn by the full tools and by their Overview tiles.
import { CRITERIA, scoreAvg, type Scores } from './logic'

export const SERIES = ['#4285f4', '#9b72cb', '#d96570']

export function Radar({ scores, ids, size = 300, labels = true }: { scores: Scores; ids: string[]; size?: number; labels?: boolean }) {
  const c = size / 2, r = size / 2 - (labels ? 62 : 6), n = CRITERIA.length
  const pt = (i: number, v: number) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [c + Math.cos(a) * r * (v / 4), c + Math.sin(a) * r * (v / 4)] as const }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="ap-radar" role="img" aria-label={`Radar of average scores for ${ids.length} candidates`}>
      {[1, 2, 3, 4].map((l) => <polygon key={l} points={CRITERIA.map((_, i) => pt(i, l).join(',')).join(' ')} className="ap-radar-grid" />)}
      {CRITERIA.map((x, i) => {
        const [ex, ey] = pt(i, 4)
        const [lx, ly] = pt(i, 4.55)
        return (
          <g key={x.id}>
            <line x1={c} y1={c} x2={ex} y2={ey} className="ap-radar-grid" />
            {labels && <text x={lx} y={ly + 4} textAnchor={Math.abs(lx - c) < 12 ? 'middle' : lx > c ? 'start' : 'end'} className="ap-radar-label">{x.short}</text>}
          </g>
        )
      })}
      {ids.map((id, k) => {
        const pts = CRITERIA.map((x, i) => pt(i, scoreAvg(scores, id, x.id)))
        return (
          <g key={id}>
            <polygon points={pts.map((p) => p.join(',')).join(' ')} fill={SERIES[k]} fillOpacity=".16" stroke={SERIES[k]} strokeWidth="2" strokeLinejoin="round" />
            {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={labels ? 3 : 2} fill={SERIES[k]} />)}
          </g>
        )
      })}
    </svg>
  )
}

export function Dial({ value, size = 280, thin }: { value: number; size?: number; thin?: boolean }) {
  const w = size, h = size * 0.58, r = size * 0.42, cx = w / 2, cy = h - 6
  const pt = (v: number, rad = r) => { const a = Math.PI - (v / 100) * Math.PI; return [cx + Math.cos(a) * rad, cy - Math.sin(a) * rad] as const }
  const arc = (from: number, to: number) => { const [ax, ay] = pt(from), [bx, by] = pt(to); return `M${ax} ${ay} A${r} ${r} 0 ${to - from > 100 ? 1 : 0} 1 ${bx} ${by}` }
  const id = `ap-dial-${size}${thin ? 't' : ''}`
  const angle = -90 + (value / 100) * 180
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="ap-dial" aria-hidden="true">
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#4285f4" /><stop offset=".55" stopColor="#9b72cb" /><stop offset="1" stopColor="#d96570" /></linearGradient></defs>
      <path d={arc(0, 100)} className="ap-dial-track" strokeWidth={thin ? 8 : 16} fill="none" strokeLinecap="round" />
      <path d={arc(0, 100)} stroke={`url(#${id})`} strokeWidth={thin ? 8 : 16} fill="none" strokeLinecap="round" pathLength={100} strokeDasharray={`${value} 100`} className="ap-dial-value" />
      {!thin && [0, 25, 50, 75, 100].map((v) => { const [x1, y1] = pt(v, r - 16); const [x2, y2] = pt(v, r - 22); return <line key={v} x1={x1} y1={y1} x2={x2} y2={y2} className="ap-dial-tick" /> })}
      <g className="ap-dial-needle" style={{ transform: `translate(${cx}px,${cy}px) rotate(${angle}deg)` }}>
        <line x1={0} y1={0} x2={0} y2={-(r - (thin ? 10 : 26))} strokeWidth={thin ? 2 : 3} strokeLinecap="round" />
        <circle r={thin ? 3.5 : 7} />
      </g>
    </svg>
  )
}

export const DialMini = ({ value }: { value: number }) => <Dial value={value} size={160} thin />
