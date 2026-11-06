/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Who sits where: the real floor, the team's faces, and what Gemini knows about each of them.
import { useEffect, useRef, useState, type KeyboardEvent as RKey, type PointerEvent as RPointer } from 'react'
import { createPortal } from 'react-dom'
import type { Block } from '../../data/types'
import { personById } from '../../store'
import { Avatar, base, Button, Icon, Sparkle } from '../../ui/kit'
import { Frame, useBoard } from '../shared'
import { dateLong, DESKS, en, PLACES, seatDefaults, seatRulesFor, seatScore, solveSeats, timelineOf, type Desk } from './logic'
import { useAppState, useWidth, Verdict, type AppProps } from './ui'

const LABEL: Record<string, { name: string; color: string }> = {
  maya: { name: 'Blue, product', color: '#4285f4' }, tom: { name: 'Blue, product', color: '#4285f4' }, karim: { name: 'Green, ops', color: '#34a853' },
  sofia: { name: 'Pink, marketing', color: '#d01884' }, lea: { name: 'Gray, finance', color: '#80868b' }, alex: { name: 'Blue, product', color: '#4285f4' },
}
const W = 800, H = 520
const first = (id: string) => personById(id).name.split(' ')[0]
type Check = { id: string; text: string }

function checklist(team: string[], seats: Record<string, string>, block: Extract<Block, { type: 'app' }>, moveDay: string | null) {
  const seated = team.filter((id) => seats[id])
  const desks = seated.map((id) => `${first(id)} to desk ${DESKS.find((d) => d.id === seats[id])?.n}`)
  void block
  const floors: { floor: string; icon: string; items: Check[] }[] = [
    { floor: 'Old office', icon: 'inventory_2', items: [
      { id: 'labels', text: `Color labels on every box, one color per team (${new Set(team.map((t) => LABEL[t]?.name ?? '')).size} colors)` },
      { id: 'coffee', text: 'Coffee machine in its own box, red label' },
      { id: 'leave', text: 'Ping-pong table stays behind' },
    ] },
    { floor: 'Street level', icon: 'local_shipping', items: [
      { id: 'truck', text: `Fauvel truck at passage des Lilas${moveDay ? `, ${moveDay}` : ''}` },
      { id: 'neighbors', text: 'Neighbors warned about the elevator' },
    ] },
    { floor: 'Elevator and stairs', icon: 'elevator', items: [
      { id: 'tables', text: 'Meeting tables go by the stairs: the elevator is too small' },
      { id: 'chairs', text: '18 chairs and 6 lockers by elevator, in batches' },
    ] },
    { floor: '3rd floor', icon: 'stairs', items: [
      { id: 'lockers', text: 'Lockers by the entrance, nothing in front of the 9-meter wall' },
      { id: 'desks', text: seated.length ? `Boxes to desks: ${desks.join(', ')}` : 'Boxes to desks, once people are seated' },
      { id: 'box4g', text: '4G box plugged in, until fiber comes' },
    ] },
  ]
  return floors
}

export default function Seats({ block }: AppProps) {
  const { project } = useBoard()
  const [state, update] = useAppState(block, seatDefaults)
  const seats = (state.seats ?? {}) as Record<string, string>
  const checked = (state.checked ?? {}) as Record<string, boolean>
  const rules = seatRulesFor(project)
  const team = ((block.data?.team as string[] | undefined) ?? project.memberIds.filter((id) => personById(id).role !== 'ai')).filter((id) => id !== 'gemini').slice(0, 18)
  const [wrap, width] = useWidth<HTMLDivElement>(700)
  const tall = width < 560
  // on a phone the floor stands up: same plan, turned on its diagonal, so nothing has to shrink to nothing
  const px = (p: { x: number; y: number }) => (tall ? { x: p.y, y: p.x } : p)
  const vw = tall ? H : W, vh = tall ? W : H
  const svg = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<{ who: string; cx: number; cy: number; over: string | null } | null>(null)
  const dragRef = useRef(drag)
  dragRef.current = drag
  const [moved, setMoved] = useState<string | null>(null)
  const score = seatScore(rules, seats)
  const moveDay = project.id === 'move' ? timelineOf(project)?.items.find((i) => i.id === 'mv-tl7') : undefined
  const floors = checklist(team, seats, block, moveDay ? dateLong(moveDay.start) : null)

  const toSvg = (cx: number, cy: number) => {
    const el = svg.current; const m = el?.getScreenCTM()
    if (!el || !m) return null
    const pt = el.createSVGPoint(); pt.x = cx; pt.y = cy
    const r = pt.matrixTransform(m.inverse())
    return tall ? { x: r.y, y: r.x } : { x: r.x, y: r.y }
  }
  const nearest = (cx: number, cy: number) => {
    const at = toSvg(cx, cy)
    if (!at || at.x < 0 || at.y < 0 || at.x > W || at.y > H) return null
    let best: Desk | null = null, bd = 70
    for (const d of DESKS) { const q = Math.hypot(d.x - at.x, d.y - at.y); if (q < bd) { bd = q; best = d } }
    return best?.id ?? null
  }
  const place = (who: string, deskId: string | null) => {
    update((s) => {
      const cur = { ...(s.seats as Record<string, string>) }
      const from = cur[who]
      const other = deskId ? Object.keys(cur).find((k) => cur[k] === deskId && k !== who) : undefined
      if (deskId) cur[who] = deskId; else delete cur[who]
      if (other) { if (from) cur[other] = from; else delete cur[other] }
      return { seats: cur }
    })
    setMoved(who)
  }
  useEffect(() => {
    if (!drag) return
    const onMove = (e: PointerEvent) => setDrag((d) => (d ? { ...d, cx: e.clientX, cy: e.clientY, over: nearest(e.clientX, e.clientY) } : d))
    const onUp = () => {
      const d = dragRef.current
      setDrag(null)
      if (!d) return
      // where the finger last was: a touch that ends has no position of its own on every device
      const at = toSvg(d.cx, d.cy)
      const inside = at && at.x >= 0 && at.y >= 0 && at.x <= W && at.y <= H
      const target = nearest(d.cx, d.cy)
      if (target) place(d.who, target)
      else if (!inside) place(d.who, null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrag(null) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); window.removeEventListener('keydown', onKey) }
  }, [!!drag, tall]) // eslint-disable-line react-hooks/exhaustive-deps

  // touch-action does not reach inside an SVG on every browser: a finger on a face must not scroll the page.
  useEffect(() => {
    const el = svg.current
    if (!el) return
    const hold = (e: TouchEvent) => { if ((e.target as Element).closest?.('[data-face]')) e.preventDefault() }
    el.addEventListener('touchstart', hold, { passive: false })
    return () => el.removeEventListener('touchstart', hold)
  }, [])
  const start = (who: string) => (e: RPointer) => {
    if (e.button) return
    e.preventDefault()
    setDrag({ who, cx: e.clientX, cy: e.clientY, over: seats[who] ?? null })
  }
  const keyFace = (who: string) => (e: RKey) => {
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); place(who, null); return }
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
    if (!dir) return
    e.preventDefault()
    const cur = DESKS.find((d) => d.id === seats[who]) ?? DESKS[0]
    const [dx, dy] = tall ? [dir[1], dir[0]] : dir
    const next = DESKS.filter((d) => d.id !== cur.id && (d.x - cur.x) * dx + (d.y - cur.y) * dy > 0)
      .sort((a, b) => (Math.abs((a.x - cur.x) * dy) + Math.abs((a.y - cur.y) * dx) + Math.hypot(a.x - cur.x, a.y - cur.y)) - (Math.abs((b.x - cur.x) * dy) + Math.abs((b.y - cur.y) * dx) + Math.hypot(b.x - cur.x, b.y - cur.y)))[0]
    if (next) place(who, next.id)
    requestAnimationFrame(() => svg.current?.querySelector<SVGGElement>(`[data-face="${who}"]`)?.focus())
  }
  const auto = () => update({ seats: solveSeats(team, rules, seats) })

  const dragRules = drag ? rules.filter((r) => r.who === drag.who) : []
  const fits = (d: Desk) => {
    if (!dragRules.length) return false
    const next = { ...seats, [drag!.who]: d.id }
    return dragRules.every((r) => r.ok(d, next))
  }
  const sizeText = tall ? 17 : 12.5
  const room = (x: number, y: number, w: number, h: number) => (tall ? { x: y, y: x, width: h, height: w } : { x, y, width: w, height: h })
  const label = (p: { x: number; y: number }, text: string, opts: { anchor?: 'start' | 'middle' | 'end'; dy?: number } = {}) => {
    const q = px(p)
    return <text x={q.x} y={q.y + (opts.dy ?? 0)} className="ap-fp-label" fontSize={sizeText} textAnchor={opts.anchor ?? 'middle'}>{text}</text>
  }
  const unseated = team.filter((id) => !seats[id])
  const tip = score.total === 0 ? 'Drag a face onto a desk. It saves for everyone on the project.' : score.met === score.total ? 'Everyone’s need is met. Sign it off on the site visit.' : `${score.met} of ${score.total} needs met. ${score.results.find((r) => !r.ok)?.rule.text}`
  const faceR = tall ? 27 : 19

  return (
    <Frame block={block}>
      <div className="ap ap-seats" ref={wrap}>
        <div className="ap-seats-tray" aria-label="Not seated yet">
          {unseated.length === 0 && <span className="ap-seats-all"><Icon name="check_circle" size={18} />Everyone has a desk</span>}
          {unseated.map((id) => (
            <button key={id} type="button" className={`ap-tray-face${drag?.who === id ? ' lifted' : ''}`} onPointerDown={start(id)} aria-label={`${personById(id).name}, not seated. Press Enter for the next free desk.`} data-tray={id}
              onClick={(e) => { if (e.detail === 0) { const free = DESKS.find((d) => !Object.values(seats).includes(d.id)); if (free) place(id, free.id) } }}>
              <Avatar id={id} size={32} /><span>{first(id)}</span>
            </button>
          ))}
          {rules.length > 0 && <Button size="s" variant="gemini" className="ap-seats-auto" onClick={auto}><Sparkle size={14} />Seat everyone for me</Button>}
        </div>
        <div className="ap-fp">
          <svg ref={svg} viewBox={`0 0 ${vw} ${vh}`} role="group" aria-label="Floor plan, 3rd floor, passage des Lilas. Arrow keys move the focused person to another desk.">
            <defs>
              <linearGradient id="ap-sun" x1="0" y1="0" x2={tall ? '1' : '0'} y2={tall ? '0' : '1'}><stop offset="0" stopColor="var(--ap-sun)" style={{ stopOpacity: 'var(--ap-sun-a)' }} /><stop offset="1" stopColor="var(--ap-sun)" stopOpacity="0" /></linearGradient>
              <linearGradient id="ap-ai" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#4285f4" /><stop offset=".55" stopColor="#9b72cb" /><stop offset="1" stopColor="#d96570" /></linearGradient>
              {team.map((id) => <clipPath key={id} id={`ap-face-${id}`}><circle r={faceR} cx={0} cy={0} /></clipPath>)}
            </defs>
            <rect {...room(16, 16, 768, 488)} rx={14} className="ap-fp-floor" />
            <rect {...room(17, 18, 766, 190)} fill="url(#ap-sun)" />
            <line {...(tall ? { x1: 18, y1: 16, x2: 18, y2: 784 } : { x1: 16, y1: 18, x2: 784, y2: 18 })} className="ap-fp-window" />
            {tall ? <text x={36} y={425} fontSize={sizeText} textAnchor="middle" className="ap-fp-label" transform="rotate(-90 36 425)">North windows, even light</text> : label({ x: 425, y: 37 }, 'North windows, even light all day')}
            <rect {...room(26, 26, 170, 104)} rx={8} className="ap-fp-room" />{label({ x: 110, y: 82 }, tall ? 'Archive' : 'Archive room')}
            <rect {...room(26, 140, 90, 74)} rx={8} className="ap-fp-room" />{label({ x: 71, y: 177 }, 'Phone', { dy: tall ? -10 : -9 })}{label({ x: 71, y: 177 }, 'booth', { dy: tall ? 12 : 9 })}
            <line {...(tall ? { x1: 140, y1: 202, x2: 400, y2: 202 } : { x1: 202, y1: 140, x2: 202, y2: 400 })} className="ap-fp-wall" />
            {tall ? <text x={270} y={190} fontSize={sizeText} textAnchor="middle" className="ap-fp-label">9-meter wall</text> : <text x={190} y={270} fontSize={sizeText} textAnchor="middle" className="ap-fp-label" transform="rotate(-90 190 270)">9-meter wall</text>}
            <rect {...room(26, 410, 72, 84)} rx={8} className="ap-fp-room strong" />{label({ x: 62, y: 456 }, 'Elevator')}
            <rect {...room(106, 410, 84, 84)} rx={8} className="ap-fp-room" />{label({ x: 148, y: 456 }, 'Stairs')}
            <rect {...room(205, 470, 200, 26)} rx={6} className="ap-fp-room" />{tall ? <text x={484} y={305} fontSize={sizeText - 2} textAnchor="middle" className="ap-fp-label" transform="rotate(-90 484 305)" dominantBaseline="middle">Lockers</text> : label({ x: 305, y: 488 }, 'Lockers')}
            <rect {...room(440, 398, 160, 96)} rx={8} className="ap-fp-room" />{label({ x: 520, y: 450 }, 'Meeting 1')}
            <rect {...room(610, 398, 164, 96)} rx={8} className="ap-fp-room" />{label({ x: 692, y: 450 }, 'Meeting 2')}
            <rect {...room(692, 130, 82, 230)} rx={8} className="ap-fp-room" />{label({ x: 733, y: 248 }, 'Kitchen', { dy: tall ? 6 : 0 })}
            {DESKS.map((d) => {
              const q = px(d)
              const occupied = Object.values(seats).includes(d.id)
              const glow = drag && fits(d)
              const over = drag?.over === d.id
              const dw = tall ? 46 : 62, dh = tall ? 68 : 40
              return (
                <g key={d.id}>
                  <rect x={q.x - dw / 2} y={q.y - dh / 2} width={dw} height={dh} rx={6} data-desk={d.id} className={`ap-fp-desk${glow ? ' fits' : ''}${over ? ' over' : ''}`} />
                  {!occupied && <text x={q.x} y={q.y + 4} textAnchor="middle" fontSize={tall ? 14 : 11} className="ap-fp-desknum">{d.n}</text>}
                </g>
              )
            })}
            {drag && dragRules.filter((r) => r.place).map((r) => {
              const pl = px(PLACES[r.place!]); const here = drag.over ? DESKS.find((d) => d.id === drag.over) : null
              const q = here ? px(here) : null
              return q && <line key={r.id} x1={q.x} y1={q.y} x2={pl.x} y2={pl.y} className={`ap-fp-link${here && r.ok(here, { ...seats, [drag.who]: here.id }) ? ' ok' : ' no'}`} />
            })}
            {team.filter((id) => seats[id]).map((id) => {
              const d = DESKS.find((x) => x.id === seats[id])
              if (!d) return null
              const q = px(d)
              const p = personById(id)
              const bad = score.results.some((r) => r.rule.who === id && !r.ok)
              return (
                <g key={id} className={`ap-fp-face${moved === id ? ' moved' : ''}${drag?.who === id ? ' lifted' : ''}`} data-face={id} role="button" tabIndex={0} style={{ transform: `translate(${q.x}px,${q.y}px)` }} onPointerDown={start(id)} onKeyDown={keyFace(id)}
                  aria-label={`${p.name}, desk ${d.n}${bad ? ', a need is not met' : ''}. Arrow keys to move, Delete to unseat.`}>
                  <title>{p.name}</title>
                  <circle r={faceR + 5} fill="transparent" />
                  <circle r={faceR + 2} className={bad ? 'ap-fp-ring bad' : 'ap-fp-ring'} />
                  {p.avatar ? <image href={base + p.avatar} x={-faceR} y={-faceR} width={faceR * 2} height={faceR * 2} clipPath={`url(#ap-face-${id})`} preserveAspectRatio="xMidYMid slice" /> : <circle r={faceR} fill={p.hue} />}
                </g>
              )
            })}
          </svg>
        </div>
        {drag && createPortal(<div className="ap-drag-ghost" style={{ left: drag.cx, top: drag.cy }} aria-hidden="true"><Avatar id={drag.who} size={tall ? 56 : 44} /></div>, document.body)}
        <Verdict tone={score.total && score.met === score.total ? 'good' : undefined}>{tip}</Verdict>
        <div className="ap-seats-cols">
          {rules.length > 0 && (
            <section aria-label="What Gemini knows">
              <h4 className="ap-h">What Gemini knows <span>{score.met} of {score.total}</span></h4>
              <ul className="ap-rules">
                {score.results.map(({ rule, ok, seated }) => (
                  <li key={rule.id} className={ok ? 'ok' : ''} data-rule={rule.id}><Avatar id={rule.who} size={24} /><span>{rule.text}</span><Icon name={ok ? 'check_circle' : seated ? 'error' : 'radio_button_unchecked'} size={18} /><span className="sr-only">{ok ? 'Met' : 'Not met'}</span></li>
                ))}
              </ul>
            </section>
          )}
          <section aria-label="Seat list">
            <h4 className="ap-h">Seat list</h4>
            <ul className="ap-seatlist">
              {team.map((id) => (
                <li key={id}>
                  <Avatar id={id} size={24} />
                  <label htmlFor={`${block.id}-${id}`} className="ap-trunc">{first(id)}</label>
                  <i className="ap-seat-label" style={{ background: LABEL[id]?.color ?? 'var(--outline)' }} title={LABEL[id]?.name} />
                  <select id={`${block.id}-${id}`} value={seats[id] ?? ''} data-seat={id} onChange={(e) => place(id, e.target.value || null)}>
                    <option value="">No desk</option>
                    {DESKS.map((d) => <option key={d.id} value={d.id}>Desk {d.n}{Object.entries(seats).find(([k, v]) => v === d.id && k !== id) ? `, ${first(Object.entries(seats).find(([k, v]) => v === d.id && k !== id)![0])}` : ''}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <section aria-label="Moving day checklist">
          <h4 className="ap-h">Moving day, floor by floor{moveDay && <span>{dateLong(moveDay.start)}, {en(moveDay.label).split(' (')[0]}</span>}</h4>
          <div className="ap-floors">
            {floors.map((f) => (
              <div key={f.floor} className="ap-floor">
                <b><Icon name={f.icon} size={18} />{f.floor}</b>
                {f.items.map((it) => (
                  <label key={it.id}>
                    <input type="checkbox" checked={!!checked[it.id]} data-check={it.id} onChange={(e) => update((s) => ({ checked: { ...(s.checked as Record<string, boolean>), [it.id]: e.target.checked } }))} />
                    <span>{it.text}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </Frame>
  )
}
