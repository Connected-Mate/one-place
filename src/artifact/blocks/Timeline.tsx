/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The roadmap: a left column of lanes and items, a time grid on the right, filling the whole pane.
// Rows grow to use the height. Drag a bar to reschedule: the owner moves it, a member proposes it.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Block, TimelineItem } from '../../data/types'
import { fmtDate, tx, useT } from '../../i18n'
import { personById, uid, useStore } from '../../store'
import { Avatar, Button, Icon, IconButton } from '../../ui/kit'
import { DAY, Empty, Frame, prefersReducedMotion, startOfDay, useBoard, useTip } from '../shared'

type Zoom = 'weeks' | 'months' | 'quarters'
const PX: Record<Zoom, number> = { weeks: 22, months: 6, quarters: 2.6 }
const addDays = (at: number, n: number) => { const d = new Date(at); d.setDate(d.getDate() + n); return d.getTime() }
const monday = (at: number) => { const d = new Date(startOfDay(at)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime() }
const monthStart = (at: number) => { const d = new Date(at); return new Date(d.getFullYear(), d.getMonth(), 1).getTime() }
const nextMonth = (at: number) => { const d = new Date(at); return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() }
const quarterStart = (at: number) => { const d = new Date(at); return new Date(d.getFullYear(), d.getMonth() - (d.getMonth() % 3), 1).getTime() }
const progressOf = (i: TimelineItem) => (i.progress == null ? null : Math.max(0, Math.min(100, i.progress <= 1 ? i.progress * 100 : i.progress)))
const LANE_COUNT = 6
const HEAD_H = 52
const LANE_H = 26
const MS_LEVEL = 24

interface Row { kind: 'lane' | 'item' | 'milestones'; key: string; y: number; h: number; label: string; lane?: number; item?: TimelineItem }

export function TimelineBlock({ block }: { block: Extract<Block, { type: 'timeline' }> }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const { project, role, viewerId } = useBoard()
  const patchBlock = useStore((s) => s.patchBlock)
  const push = useStore((s) => s.push)
  const toast = useStore((s) => s.toast)
  const { bind, node, hide } = useTip()
  const scroller = useRef<HTMLDivElement>(null)
  const seen = useRef(new Map<string, number>())
  const [moved, setMoved] = useState<string[]>([])
  const [zoom, setZoom] = useState<Zoom>('months')
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [selected, setSelected] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ id: string; days: number } | null>(null)
  const justDragged = useRef(false)
  const now = Date.now()
  const items = block.items
  const canEdit = role === 'owner'
  const canPropose = role === 'member'

  const narrow = size.w > 0 && size.w < 560
  const leftW = narrow ? 0 : size.w < 800 ? 170 : 220

  const { from, to } = useMemo(() => {
    const starts = items.map((i) => i.start), ends = items.map((i) => Math.max(i.start, i.end))
    const lo = Math.min(now, ...starts), hi = Math.max(now, ...ends)
    if (zoom === 'quarters') return { from: quarterStart(lo), to: quarterStart(addDays(hi, 92)) }
    if (zoom === 'months') return { from: monthStart(lo), to: nextMonth(hi) }
    return { from: addDays(monday(lo), -7), to: addDays(monday(hi), 21) }
  }, [items, zoom]) // eslint-disable-line react-hooks/exhaustive-deps
  const totalDays = Math.max(1, Math.round((to - from) / DAY))
  const available = Math.max(0, size.w - leftW)
  const pxPerDay = Math.max(PX[zoom], available / totalDays)
  const trackW = Math.round(totalDays * pxPerDay)
  const xOf = (at: number) => ((at - from) / DAY) * pxPerDay

  // Lanes in order of first appearance, each with its own color. Milestones ride on their own row at the top.
  const { rows, bodyH, laneOf, msLevels } = useMemo(() => {
    const laneNames: string[] = []
    const laneKey = (i: TimelineItem) => (i.lane == null ? '' : tx(i.lane, 'en'))
    for (const i of items) if (!laneNames.includes(laneKey(i))) laneNames.push(laneKey(i))
    const laneOf = (i: TimelineItem) => laneNames.indexOf(laneKey(i)) % LANE_COUNT
    const bars = items.filter((i) => !i.milestone)
    const miles = items.filter((i) => i.milestone).sort((a, b) => a.start - b.start)
    // Two levels of labels, so close diamonds don't overprint each other.
    const msLevels = new Map<string, number>()
    const edge = [-Infinity, -Infinity, -Infinity]
    for (const m of miles) {
      const x = ((m.start - from) / DAY) * pxPerDay
      const w = t(m.label).length * 6.6 + 26
      const level = edge.findIndex((e) => x > e)
      const use = level < 0 ? 0 : level
      msLevels.set(m.id, use)
      edge[use] = x + w
    }
    const levels = Math.max(1, ...[...msLevels.values()].map((v) => v + 1))
    const msH = miles.length ? levels * MS_LEVEL + 12 : 0
    const lanesUsed = laneNames.filter((n) => bars.some((i) => laneKey(i) === n))
    const named = lanesUsed.some((n) => n)
    const fixed = msH + (named ? lanesUsed.length * LANE_H : 0)
    const free = Math.max(0, size.h - HEAD_H - fixed)
    const rowH = bars.length ? Math.round(Math.max(36, Math.min(76, free / bars.length))) : 44
    const rows: Row[] = []
    let y = 0
    if (miles.length) { rows.push({ kind: 'milestones', key: 'ms', y, h: msH, label: t({ fr: 'Jalons', en: 'Milestones' }) }); y += msH }
    for (const name of lanesUsed) {
      const lane = laneNames.indexOf(name) % LANE_COUNT
      const sample = bars.find((i) => laneKey(i) === name)!
      if (named) { rows.push({ kind: 'lane', key: `lane:${name}`, y, h: LANE_H, label: name ? t(sample.lane) : t({ fr: 'Autres', en: 'Other' }), lane }); y += LANE_H }
      for (const item of bars.filter((i) => laneKey(i) === name)) { rows.push({ kind: 'item', key: item.id, y, h: rowH, label: t(item.label), lane, item }); y += rowH }
    }
    return { rows, bodyH: y, laneOf, msLevels }
  }, [items, size.h, from, pxPerDay, t]) // eslint-disable-line react-hooks/exhaustive-deps
  const canvasH = Math.max(bodyH, size.h - HEAD_H)

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [items.length === 0]) // eslint-disable-line react-hooks/exhaustive-deps

  // Open with today a quarter of the way in.
  useEffect(() => {
    const el = scroller.current
    if (el && available > 0 && trackW > available) el.scrollLeft = Math.max(0, xOf(now) - available * 0.25)
    else if (el) el.scrollLeft = 0
  }, [zoom, trackW > available, available > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  // Spot the bars whose dates changed (a move approved in the chat) and show the move.
  useEffect(() => {
    const changed = items.filter((i) => { const was = seen.current.get(i.id); return was != null && was !== i.start }).map((i) => i.id)
    seen.current = new Map(items.map((i) => [i.id, i.start]))
    if (!changed.length) return
    setMoved(changed)
    const el = scroller.current
    const item = items.find((i) => i.id === changed[0])
    if (el && item) el.scrollTo({ left: Math.max(0, xOf(item.start) - available * 0.3), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    const timer = setTimeout(() => setMoved([]), 2000)
    return () => clearTimeout(timer)
  }, [items]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null) }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [selected])

  const header = useMemo(() => {
    const top: { at: number; end: number; label: string }[] = []
    const sub: { at: number; label: string }[] = []
    const fmtMonth = (at: number, long: boolean) => new Date(at).toLocaleDateString('en-US', long ? { month: 'long', year: 'numeric' } : { month: 'short' })
    if (zoom === 'quarters') {
      for (let q = quarterStart(from); q < to; q = new Date(new Date(q).getFullYear(), new Date(q).getMonth() + 3, 1).getTime()) {
        const d = new Date(q)
        top.push({ at: Math.max(q, from), end: new Date(d.getFullYear(), d.getMonth() + 3, 1).getTime(), label: `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}` })
      }
      for (let m = monthStart(from); m < to; m = nextMonth(m)) sub.push({ at: m, label: fmtMonth(m, false) })
    } else {
      for (let m = monthStart(from); m < to; m = nextMonth(m)) top.push({ at: Math.max(m, from), end: nextMonth(m), label: fmtMonth(m, true) })
      for (let w = monday(from); w < to; w = addDays(w, 7)) if (w >= from) sub.push({ at: w, label: zoom === 'weeks' ? fmtDate(w, lang) : String(new Date(w).getDate()) })
    }
    return { top, sub }
  }, [from, to, zoom, lang])

  const startDrag = (e: React.PointerEvent, item: TimelineItem) => {
    if (!canEdit && !canPropose) return
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const ox = e.clientX
    let days = 0
    const move = (ev: PointerEvent) => {
      const next = Math.round((ev.clientX - ox) / pxPerDay)
      if (next === days) return
      days = next
      hide()
      setDrag({ id: item.id, days })
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('keydown', key, true)
      setDrag(null)
    }
    const up = () => {
      stop()
      if (days === 0) return
      justDragged.current = true
      setTimeout(() => { justDragged.current = false }, 0)
      reschedule(item, days)
    }
    const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { ev.stopPropagation(); days = 0; stop() } }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('keydown', key, true)
  }

  /** The owner moves it. A member's move is a proposal in the chat, and the bar goes back until it is approved. */
  const reschedule = (item: TimelineItem, days: number) => {
    const label = t(item.label)
    const when = days > 0 ? `${days} day${days === 1 ? '' : 's'} later` : `${-days} day${days === -1 ? '' : 's'} earlier`
    if (canEdit) {
      const write = (d: number) => {
        const latest = useStore.getState().projects.find((p) => p.id === project.id)?.blocks.find((b) => b.id === block.id)
        if (latest?.type !== 'timeline') return
        patchBlock(project.id, block.id, { items: latest.items.map((i) => (i.id === item.id ? { ...i, start: addDays(i.start, d), end: addDays(i.end, d) } : i)) })
      }
      write(days)
      toast({ text: { fr: `${label} déplacé`, en: `${label} moved ${when}` }, icon: 'event', action: { label: { fr: 'Annuler', en: 'Undo' }, run: () => write(-days) } })
      return
    }
    const owner = personById(project.ownerId).name.split(' ')[0]
    push(project.id, {
      id: uid('m'), kind: 'proposal', authorId: viewerId, at: Date.now(), visibility: { type: 'all' }, status: 'pending',
      title: { fr: `Déplacer ${label}`, en: `Move ${label} ${when}` },
      description: { fr: `Nouvelle date : ${fmtDate(addDays(item.start, days), lang)}.`, en: `New start: ${fmtDate(addDays(item.start, days), lang)}. Proposed from the roadmap.` },
      action: { type: 'move-milestone', blockId: block.id, itemId: item.id, deltaDays: days },
    })
    toast({ text: { fr: `Proposition envoyée à ${owner}`, en: `Proposal sent: ${owner} decides in the chat` }, icon: 'how_to_vote' })
  }

  if (items.length === 0) {
    return (
      <Frame block={block} className="rp-fill rp-rm">
        <div className="rp-rm-empty">
          <Empty icon="view_timeline" title={t({ fr: 'Pas encore de feuille de route', en: 'No roadmap yet' })} hint={t({ fr: 'Demandez à Gemini de la bâtir depuis le chat.', en: 'Ask Gemini to build it from the chat, with dates and owners.' })}>
            {role !== 'guest' && <Button variant="tonal" size="s" onClick={() => window.dispatchEvent(new CustomEvent('oneplace:compose', { detail: { text: '@Gemini add a timeline to the board' } }))}>{t({ fr: 'Demander à Gemini', en: 'Ask Gemini' })}</Button>}
          </Empty>
        </div>
      </Frame>
    )
  }

  const describe = (i: TimelineItem) => ({
    label: t(i.label),
    owner: i.ownerId ? personById(i.ownerId).name : '',
    dates: i.milestone ? fmtDate(i.start, lang) : `${fmtDate(i.start, lang)} to ${fmtDate(i.end, lang)}`,
    progress: progressOf(i),
  })
  const tipFor = (i: TimelineItem) => {
    const d = describe(i)
    return (
      <>
        <b>{d.label}</b>
        <span>{d.dates}</span>
        {d.owner && <span>{d.owner}</span>}
        {d.progress != null && !i.milestone && <span>{Math.round(d.progress)}% done</span>}
      </>
    )
  }
  const select = (id: string) => {
    if (justDragged.current) return
    setSelected((s) => (s === id ? null : id))
  }
  const offset = (i: TimelineItem) => (drag?.id === i.id ? drag.days : 0)
  const rowOf = (id: string) => rows.find((r) => r.item?.id === id)

  // Arrows run from the end of what blocks an item to the start of the item.
  const anchor = (i: TimelineItem, side: 'start' | 'end') => {
    const off = offset(i)
    if (i.milestone) {
      const ms = rows.find((r) => r.kind === 'milestones')
      return { x: xOf(addDays(i.start, off)), y: (ms?.y ?? 0) + 6 + (msLevels.get(i.id) ?? 0) * MS_LEVEL + MS_LEVEL / 2 }
    }
    const r = rowOf(i.id)
    return { x: xOf(addDays(side === 'start' ? i.start : Math.max(i.end, i.start + DAY), off)), y: (r?.y ?? 0) + (r?.h ?? 0) / 2 }
  }
  const links = items.flatMap((i) => (i.dependsOn ?? []).map((dep) => {
    const from_ = items.find((x) => x.id === dep)
    if (!from_) return null
    const a = anchor(from_, 'end'), b = anchor(i, 'start')
    const on = selected === i.id || selected === dep
    const midX = b.x - a.x > 16 ? b.x - 8 : a.x + 8
    // A diamond's label sits to its right: leave a diamond from below, never across its own label.
    const path = from_.milestone ? `M${a.x} ${a.y + 8} V${b.y} H${b.x - 2}` : `M${a.x} ${a.y} H${midX} V${b.y} H${b.x - 2}`
    return { key: `${dep}>${i.id}`, path, on }
  })).filter((x) => x != null)

  const active = items.find((i) => i.id === selected)
  const barColor = (lane: number) => `var(--lane-${lane})`
  const ZOOMS: { v: Zoom; label: string }[] = [
    { v: 'weeks', label: t({ fr: 'Semaines', en: 'Weeks' }) },
    { v: 'months', label: t({ fr: 'Mois', en: 'Months' }) },
    { v: 'quarters', label: t({ fr: 'Trimestres', en: 'Quarters' }) },
  ]
  const goToday = () => {
    const el = scroller.current
    if (el) el.scrollTo({ left: Math.max(0, xOf(now) - available * 0.25), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }
  const weekends: number[] = []
  if (zoom === 'weeks') for (let d = from; d < to; d = addDays(d, 1)) { const wd = new Date(d).getDay(); if (wd === 6) weekends.push(d) }

  return (
    <Frame
      block={block}
      className="rp-fill rp-rm"
      actions={(
        <>
          <button type="button" className="chip click rp-rm-today" onClick={goToday}>{t({ fr: 'Aujourd’hui', en: 'Today' })}</button>
          <div className="rp-seg" role="group" aria-label={t({ fr: 'Zoom', en: 'Zoom' })}>
            {ZOOMS.map((z) => <button key={z.v} type="button" className={zoom === z.v ? 'on' : ''} aria-pressed={zoom === z.v} onClick={() => setZoom(z.v)}>{z.label}</button>)}
          </div>
        </>
      )}
    >
      <div className="rp-rm-main">
        <div ref={scroller} className="rp-rm-scroll" role="region" tabIndex={0} aria-label={t({ fr: 'Feuille de route, défilement', en: 'Roadmap, scrollable' })} onScroll={hide}>
          <div className="rp-rm-sheet" style={{ width: leftW + trackW, '--left': `${leftW}px` } as React.CSSProperties}>
            <div className="rp-rm-head" style={{ height: HEAD_H }}>
              <div className="rp-rm-corner">{leftW > 0 && <span>{t({ fr: 'Élément', en: 'Item' })}</span>}</div>
              <div className="rp-rm-axis" style={{ width: trackW }} aria-hidden="true">
                <div className="rp-rm-axis-top">
                  {header.top.map((m) => (
                    <span key={m.at} style={{ left: xOf(m.at), width: Math.min(trackW, xOf(m.end)) - xOf(m.at) }}><em>{m.label}</em></span>
                  ))}
                </div>
                <div className="rp-rm-axis-sub">
                  {header.sub.map((w) => <span key={w.at} style={{ left: xOf(w.at) }}>{w.label}</span>)}
                </div>
                <span className="rp-rm-todaypill" style={{ left: xOf(now) }}>{fmtDate(now, lang)}</span>
              </div>
            </div>
            <div className="rp-rm-body" style={{ height: canvasH }}>
              {leftW > 0 && (
                <div className="rp-rm-left" style={{ height: canvasH }}>
                  {rows.map((r) => r.kind === 'item' ? (
                    <button key={r.key} type="button" className={`rp-rm-name${selected === r.key ? ' on' : ''}`} style={{ top: r.y, height: r.h }} onClick={() => select(r.key)}>
                      {r.item?.ownerId && <Avatar id={r.item.ownerId} size={24} />}
                      <span className="rp-rm-name-text">
                        <span>{r.label}</span>
                        {r.h >= 46 && r.item && <small>{describe(r.item).dates}{describe(r.item).progress != null ? `, ${Math.round(describe(r.item).progress!)}%` : ''}</small>}
                      </span>
                    </button>
                  ) : (
                    <div key={r.key} className={`rp-rm-lane${r.kind === 'milestones' ? ' msrow' : ''}`} style={{ top: r.y, height: r.h }}>
                      {r.kind === 'lane' && <i style={{ background: barColor(r.lane ?? 0) }} />}
                      {r.kind === 'milestones' && <Icon name="flag" fill size={14} />}
                      <span className="rp-trunc">{r.label}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="rp-rm-canvas" style={{ width: trackW, height: canvasH }}>
                {weekends.map((d) => <i key={d} className="rp-rm-weekend" style={{ left: xOf(d), width: 2 * pxPerDay }} />)}
                {header.sub.map((w) => <i key={w.at} className="rp-rm-grid" style={{ left: xOf(w.at) }} />)}
                {rows.map((r) => (r.kind === 'lane' ? <i key={r.key} className="rp-rm-laneband" style={{ top: r.y, height: r.h }}>{leftW === 0 && <em>{r.label}</em>}</i> : <i key={r.key} className="rp-rm-rowline" style={{ top: r.y + r.h - 1 }} />))}
                <svg className="rp-rm-links" width={trackW} height={canvasH} aria-hidden="true">
                  <defs>
                    <marker id={`rm-arrow-${block.id}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8Z" fill="context-stroke" /></marker>
                  </defs>
                  {links.filter((l) => leftW > 0 || l.on).map((l) => <path key={l.key} d={l.path} className={l.on ? 'on' : ''} markerEnd={`url(#rm-arrow-${block.id})`} />)}
                </svg>
                <span className="rp-rm-todayline" style={{ left: xOf(now) }} />
                {items.filter((i) => i.milestone).map((i) => {
                  const lane = laneOf(i)
                  const x = xOf(addDays(i.start, offset(i)))
                  const level = msLevels.get(i.id) ?? 0
                  const flip = x + t(i.label).length * 6.6 + 26 > trackW
                  const d = describe(i)
                  return (
                    <button
                      key={i.id}
                      type="button"
                      className={`rp-rm-ms${selected === i.id ? ' on' : ''}${moved.includes(i.id) ? ' moved' : ''}${flip ? ' flip' : ''}${drag?.id === i.id ? ' dragging' : ''}`}
                      style={{ left: x, top: 6 + level * MS_LEVEL, height: MS_LEVEL, '--c': barColor(lane) } as React.CSSProperties}
                      aria-label={`${d.label}, ${t({ fr: 'jalon', en: 'milestone' })}, ${d.dates}${d.owner ? `, ${d.owner}` : ''}`}
                      onClick={() => select(i.id)}
                      onPointerDown={(e) => startDrag(e, i)}
                      {...bind(tipFor(i))}
                    >
                      <i />
                      <span>{d.label}</span>
                    </button>
                  )
                })}
                {rows.filter((r) => r.kind === 'item').map((r) => {
                  const i = r.item!
                  const off = offset(i)
                  const end = Math.max(i.end, i.start + DAY)
                  const left = xOf(addDays(i.start, off))
                  const width = Math.max(8, xOf(end) - xOf(i.start))
                  const barH = Math.min(30, Math.max(20, r.h - 14))
                  const d = describe(i)
                  const showLabel = leftW === 0
                  const flip = left + width + 150 > trackW
                  return (
                    <button
                      key={i.id}
                      type="button"
                      className={`rp-rm-bar${selected === i.id ? ' on' : ''}${moved.includes(i.id) ? ' moved' : ''}${drag?.id === i.id ? ' dragging' : ''}${canEdit || canPropose ? ' can-drag' : ''}`}
                      style={{ left, width, top: r.y + (r.h - barH) / 2, height: barH, '--c': barColor(r.lane ?? 0) } as React.CSSProperties}
                      aria-label={`${d.label}, ${d.dates}${d.owner ? `, ${d.owner}` : ''}${d.progress != null ? `, ${Math.round(d.progress)}%` : ''}`}
                      onClick={() => select(i.id)}
                      onPointerDown={(e) => startDrag(e, i)}
                      {...bind(tipFor(i))}
                    >
                      <span className="rp-rm-fill" style={{ width: `${d.progress ?? 100}%` }} />
                      {width > 40 && i.ownerId && barH >= 22 && <Avatar id={i.ownerId} size={barH - 6} />}
                      {showLabel && <span className={`rp-rm-after${flip ? ' flip' : ''}`}><b>{d.label}</b>{d.progress != null && <span>{Math.round(d.progress)}%</span>}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
        {active && (
          <RoadmapDetail
            item={active}
            items={items}
            color={barColor(laneOf(active))}
            canEdit={canEdit}
            canPropose={canPropose}
            onClose={() => setSelected(null)}
            onPick={setSelected}
            onMove={(days) => reschedule(active, days)}
            onProgress={canEdit ? (v) => patchBlock(project.id, block.id, { items: items.map((i) => (i.id === active.id ? { ...i, progress: v } : i)) }) : undefined}
          />
        )}
      </div>
      {node}
    </Frame>
  )
}

function RoadmapDetail({ item, items, color, canEdit, canPropose, onClose, onPick, onMove, onProgress }: { item: TimelineItem; items: TimelineItem[]; color: string; canEdit: boolean; canPropose: boolean; onClose: () => void; onPick: (id: string) => void; onMove: (days: number) => void; onProgress?: (v: number) => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const owner = item.ownerId ? personById(item.ownerId) : null
  const progress = progressOf(item)
  const blockedBy = (item.dependsOn ?? []).map((id) => items.find((x) => x.id === id)).filter((x) => x != null)
  const blocks = items.filter((x) => x.dependsOn?.includes(item.id))
  const days = Math.max(1, Math.round((item.end - item.start) / DAY) + 1)
  const ask = () => owner && window.dispatchEvent(new CustomEvent('oneplace:compose', { detail: { text: `@${owner.name} where are we on ${t(item.label)}?` } }))
  const panel = (
    <aside className="rp-rm-detail" aria-label={t(item.label)} style={{ '--c': color } as React.CSSProperties}>
      <header>
        <i className="rp-rm-dot" />
        <h4>{t(item.label)}</h4>
        <IconButton icon="close" size={32} label={t({ fr: 'Fermer', en: 'Close' })} onClick={onClose} />
      </header>
      <dl>
        <div><dt>{t({ fr: 'Dates', en: 'Dates' })}</dt><dd>{item.milestone ? fmtDate(item.start, lang) : `${fmtDate(item.start, lang)} to ${fmtDate(item.end, lang)}, ${days} days`}</dd></div>
        {item.lane != null && <div><dt>{t({ fr: 'Voie', en: 'Lane' })}</dt><dd>{t(item.lane)}</dd></div>}
        <div><dt>{t({ fr: 'Responsable', en: 'Owner' })}</dt><dd className="rp-rm-owner">{owner ? <><Avatar person={owner} size={24} /><span>{owner.name}</span></> : t({ fr: 'Personne', en: 'Nobody yet' })}</dd></div>
        {progress != null && !item.milestone && (
          <div>
            <dt>{t({ fr: 'Avancement', en: 'Progress' })}</dt>
            <dd className="rp-rm-progress">
              {onProgress
                ? <input type="range" min={0} max={100} step={5} value={progress} aria-label={t({ fr: 'Avancement', en: 'Progress' })} onChange={(e) => onProgress(Number(e.target.value))} />
                : <i><i style={{ width: `${progress}%` }} /></i>}
              <span>{Math.round(progress)}%</span>
            </dd>
          </div>
        )}
        {blockedBy.length > 0 && <div><dt>{t({ fr: 'Après', en: 'After' })}</dt><dd>{blockedBy.map((x) => <button key={x.id} type="button" className="rp-rm-link" onClick={() => onPick(x.id)}>{t(x.label)}</button>)}</dd></div>}
        {blocks.length > 0 && <div><dt>{t({ fr: 'Avant', en: 'Before' })}</dt><dd>{blocks.map((x) => <button key={x.id} type="button" className="rp-rm-link" onClick={() => onPick(x.id)}>{t(x.label)}</button>)}</dd></div>}
      </dl>
      {(canEdit || canPropose) && (
        <div className="rp-rm-moves">
          <span>{canEdit ? t({ fr: 'Déplacer', en: 'Reschedule' }) : t({ fr: 'Proposer de déplacer', en: 'Propose a move' })}</span>
          <div>
            <Button size="s" variant="outlined" onClick={() => onMove(-7)}>{t({ fr: '1 semaine plus tôt', en: '1 week earlier' })}</Button>
            <Button size="s" variant="outlined" onClick={() => onMove(7)}>{t({ fr: '1 semaine plus tard', en: '1 week later' })}</Button>
          </div>
        </div>
      )}
      {owner && (canEdit || canPropose) && <Button size="s" icon="chat_bubble" onClick={ask}>{t({ fr: `Demander à ${owner.name.split(' ')[0]}`, en: `Ask ${owner.name.split(' ')[0]}` })}</Button>}
    </aside>
  )
  // On a phone the panel is a bottom sheet above everything.
  return matchMedia('(max-width:599px)').matches ? createPortal(<div className="rp-rm-sheetwrap">{panel}</div>, document.body) : panel
}
