// A real Gantt: positions are percentages of a track that is at least 14px per day, so it
// fills wide columns and scrolls inside the block on narrow ones.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Block, TimelineItem } from '../../data/types'
import { fmtDate, useT } from '../../i18n'
import { personById, useStore } from '../../store'
import { Avatar } from '../../ui/kit'
import { DAY, Empty, Frame, prefersReducedMotion, startOfDay, useBoard, useTip } from '../shared'

const PX_PER_DAY = 14
const monday = (at: number) => { const d = new Date(startOfDay(at)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime() }
const addDays = (at: number, n: number) => { const d = new Date(at); d.setDate(d.getDate() + n); return d.getTime() }

export function TimelineBlock({ block }: { block: Extract<Block, { type: 'timeline' }> }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const { project } = useBoard()
  const { bind, node, hide } = useTip()
  const scroller = useRef<HTMLDivElement>(null)
  const seen = useRef(new Map<string, number>())
  const [moved, setMoved] = useState<string[]>([])
  const now = Date.now()
  const items = block.items

  const { from, to, weeks, groups } = useMemo(() => {
    const starts = items.map((i) => i.start), ends = items.map((i) => Math.max(i.start, i.end))
    const from = addDays(monday(Math.min(now, ...starts)), -7)
    const to = addDays(monday(Math.max(now, ...ends)), 14)
    const weeks: number[] = []
    for (let w = from; w < to; w = addDays(w, 7)) weeks.push(w)
    const groups = new Map<string, { lane: TimelineItem['lane']; items: TimelineItem[] }>()
    for (const item of items) {
      const key = item.lane == null ? '' : typeof item.lane === 'string' ? item.lane : item.lane.en
      const g = groups.get(key) ?? { lane: item.lane, items: [] }
      g.items.push(item)
      groups.set(key, g)
    }
    return { from, to, weeks, groups: [...groups.values()] }
    // `now` only moves the today line, not worth recomputing the range on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])
  const totalDays = Math.round((to - from) / DAY)
  const pct = (at: number) => ((at - from) / (to - from)) * 100

  const placeToday = () => {
    const el = scroller.current
    if (el) el.scrollLeft = Math.max(0, (pct(now) / 100) * el.scrollWidth - el.clientWidth * 0.25)
  }
  // Open on today, a quarter from the left, once.
  useLayoutEffect(placeToday, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Spot the bars whose dates changed (a move approved in the chat) and show the move.
  useEffect(() => {
    const changed = items.filter((i) => { const was = seen.current.get(i.id); return was != null && was !== i.start }).map((i) => i.id)
    seen.current = new Map(items.map((i) => [i.id, i.start]))
    if (!changed.length) return
    setMoved(changed)
    const el = scroller.current
    const item = items.find((i) => i.id === changed[0])
    if (el && item) el.scrollTo({ left: Math.max(0, (pct(item.start) / 100) * el.scrollWidth - el.clientWidth * 0.3), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    const timer = setTimeout(() => setMoved([]), 2000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  if (items.length === 0) {
    return (
      <Frame block={block}>
        <Empty icon="view_timeline" title={t({ fr: 'Pas encore de jalon', en: 'No milestones yet' })} hint={t({ fr: 'Demandez à @Gemini de bâtir le planning depuis le chat.', en: 'Ask @Gemini to build the plan from the chat.' })} />
      </Frame>
    )
  }

  // `progress` may be written 0-1 or 0-100 by whoever fills the data
  const progressOf = (i: TimelineItem) => (i.progress == null ? null : Math.max(0, Math.min(100, i.progress <= 1 ? i.progress * 100 : i.progress)))

  const describe = (i: TimelineItem) => {
    const owner = i.ownerId ? personById(i.ownerId).name : ''
    const dates = i.milestone ? fmtDate(i.start, lang) : `${fmtDate(i.start, lang)} ${t({ fr: 'au', en: 'to' })} ${fmtDate(i.end, lang)}`
    return { owner, dates, label: t(i.label) }
  }
  const tipFor = (i: TimelineItem) => {
    const d = describe(i)
    return (
      <>
        <b>{d.label}</b>
        <span>{d.dates}</span>
        {d.owner && <span>{d.owner}</span>}
        {progressOf(i) != null && !i.milestone && <span>{t({ fr: 'Avancement', en: 'Progress' })} {Math.round(progressOf(i)!)}%</span>}
      </>
    )
  }
  return (
    <Frame block={block}>
      <div ref={scroller} className="rp-gantt-scroll" role="region" tabIndex={0} aria-label={t({ fr: `${t(block.title)}, défilement horizontal`, en: `${t(block.title)}, scrolls horizontally` })} onScroll={hide}>
        <div className="rp-gantt" style={{ minWidth: totalDays * PX_PER_DAY }}>
          <div className="rp-g-axis" aria-hidden="true">
            {weeks.map((w) => <span key={w} className="rp-g-week" style={{ left: `${pct(w)}%` }}>{fmtDate(w, lang).replace('.', '')}</span>)}
          </div>
          <div className="rp-g-body">
            {weeks.map((w) => <span key={w} className="rp-g-grid" style={{ left: `${pct(w)}%` }} />)}
            <span className="rp-g-today" style={{ left: `${pct(now)}%` }}><span>{t({ fr: 'Aujourd’hui', en: 'Today' })}</span></span>
            {groups.map((g, gi) => (
              <div key={gi} className="rp-g-lane">
                {g.lane != null && <p className="rp-g-lane-name"><span>{t(g.lane)}</span></p>}
                {g.items.map((i) => {
                  const color = i.color ?? project.color
                  const d = describe(i)
                  const isMoved = moved.includes(i.id)
                  if (i.milestone) {
                    const flip = pct(i.start) > 72
                    return (
                      <div key={i.id} className="rp-g-row">
                        <button type="button" className={`rp-g-ms${isMoved ? ' moved' : ''}${flip ? ' flip' : ''}`} style={{ left: `${pct(i.start)}%`, '--c': color } as React.CSSProperties} aria-label={`${d.label}, ${d.dates}${d.owner ? `, ${d.owner}` : ''}`} {...bind(tipFor(i))}>
                          <span className="rp-g-diamond" />
                          <span className="rp-g-ms-label">{d.label}</span>
                        </button>
                      </div>
                    )
                  }
                  const end = Math.max(i.end, i.start + DAY)
                  const widthPx = ((end - i.start) / DAY) * PX_PER_DAY
                  const fits = d.label.length * 7.2 + (i.ownerId ? 38 : 16) < widthPx
                  const flip = !fits && pct(end) > 68
                  const progress = progressOf(i)
                  return (
                    <div key={i.id} className="rp-g-row">
                      <button
                        type="button"
                        className={`rp-g-bar${isMoved ? ' moved' : ''}${fits ? '' : flip ? ' out flip' : ' out'}`}
                        style={{ left: `${pct(i.start)}%`, width: `${pct(end) - pct(i.start)}%`, '--c': color } as React.CSSProperties}
                        aria-label={`${d.label}, ${d.dates}${d.owner ? `, ${d.owner}` : ''}${progress != null ? `, ${Math.round(progress)}%` : ''}`}
                        {...bind(tipFor(i))}
                      >
                        <span className="rp-g-track">
                          {progress != null && <span className="rp-g-progress" style={{ width: `${progress}%` }} />}
                          {i.ownerId && <Avatar id={i.ownerId} size={20} />}
                        </span>
                        <span className="rp-g-label">{d.label}</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {node}
    </Frame>
  )
}
