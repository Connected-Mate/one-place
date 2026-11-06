/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// What each tool computes from the live project. No React here: the full tool and its Overview tile share it.
import type { Artifact, Block, KanbanCard, Project, TimelineItem, Txt } from '../../data/types'
import { tx } from '../../i18n'

export const DAY = 864e5
export const en = (v: Txt | undefined) => tx(v, 'en')
export const money = (n: number) => `€${Math.round(n).toLocaleString('en-US')}`
export const moneyK = (n: number) => `€${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: n % 1000 ? 1 : 0 })}K`
export const dateLong = (t: number) => new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
export const dateShort = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
export const weekdayOf = (t: number) => new Date(t).toLocaleDateString('en-US', { weekday: 'long' })
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
type App = Extract<Block, { type: 'app' }>
type Sheet = Extract<Artifact, { kind: 'sheet' }>
const sheetWith = (p: Project, id: string) => p.artifacts.find((a): a is Sheet => a.kind === 'sheet' && a.id === id)
export const timelineOf = (p: Project) => p.blocks.find((b): b is Extract<Block, { type: 'timeline' }> => b.type === 'timeline' && b.items.length > 0)

/* ---------------- Launch date simulator ---------------- */
export interface Budget { target: number; committed: number; contingency: number; shoot: number }
export function budgetOf(p: Project): Budget | null {
  const sheet = p.artifacts.find((a): a is Sheet => a.kind === 'sheet' && a.rows.some((r) => r[0] === 'TOTAL'))
  const row = sheet?.rows.find((r) => r[0] === 'TOTAL')
  if (!sheet || !row) return null
  const line = (name: string, col: number) => num(sheet.rows.find((r) => r[0] === name)?.[col], 0)
  return { target: num(row[2], 0), committed: num(row[3], 0), contingency: line('Contingency', 3), shoot: line('Product shoot', 2) }
}
export interface ChainRow { id: string; label: string; start: number; end: number; moves: boolean; milestone: boolean; ownerId?: string; note?: string }
export type Level = 'good' | 'warn' | 'bad'
export interface LaunchModel {
  date: number; days: number; committedDays: number; item: TimelineItem | undefined; blockId: string | undefined; anchor: number
  weekend: boolean; rows: ChainRow[]; budget: Budget | null; shift: number; shiftPriced: boolean; total: number; over: number
  airFreight: number; buffer: number; preorders: { total: number; atRisk: number; euros: number } | null
  press: { name: string; by: number; label: string; level: Level } | null; verdict: string; level: Level; label: string
}
export const launchDefaults = { days: 0 }
export function launchModel(p: Project, block: App, days: number): LaunchModel {
  const d = block.data ?? {}
  const tl = timelineOf(p)
  const itemId = d.itemId as string | undefined
  const milestones = tl?.items.filter((i) => i.milestone) ?? []
  const item = tl?.items.find((i) => i.id === itemId) ?? milestones.at(-1) ?? tl?.items.at(-1)
  const anchor = num(d.anchor, item?.start ?? Date.now())
  const committedDays = item ? Math.round((item.start - anchor) / DAY) : 0
  const date = anchor + days * DAY
  const weekday = new Date(date).getDay()
  const weekend = weekday === 0 || weekday === 6
  const fixed = (d.fixed as string[] | undefined) ?? []
  const moving = (d.moving as string[] | undefined)
  const shiftBy = (days - committedDays) * DAY
  const rows: ChainRow[] = (tl?.items ?? [])
    .filter((i) => i.end >= Date.now() - 2 * DAY && (i.milestone || i.end - i.start < 60 * DAY))
    .filter((i) => !(d.chain as string[] | undefined) || (d.chain as string[]).includes(i.id))
    .map((i) => {
      const moves = moving ? moving.includes(i.id) : !fixed.includes(i.id) && i.start >= (item?.start ?? anchor) - 2 * DAY
      const stretches = ((d.stretch as string[] | undefined) ?? []).includes(i.id)
      return { id: i.id, label: en(i.label), start: i.start + (moves ? shiftBy : 0), end: i.end + (moves || stretches ? shiftBy : 0), moves, milestone: !!i.milestone, ownerId: i.ownerId }
    })
    .sort((a, b) => a.start - b.start)
  const budget = budgetOf(p)
  const perDay = num(d.shiftPerDay, 500)
  const priced = num(d.shiftPriced, 7)
  const shift = days * perDay
  const total = (budget?.committed ?? 0) + shift
  const over = budget ? total - budget.target : 0
  const preorderItem = tl?.items.find((i) => i.id === d.preordersItem)
  const perDayOrders = num(d.preordersPerDay, 0)
  const window = preorderItem ? Math.round((anchor - preorderItem.start) / DAY) : 0
  const totalOrders = window * perDayOrders
  const atRisk = Math.round(totalOrders * days * num(d.slipRisk, 0))
  const preorders = perDayOrders ? { total: totalOrders, atRisk, euros: atRisk * num(d.unitPrice, 0) } : null
  const pressBy = d.pressBy as number | undefined
  const pressName = (d.pressName as string | undefined) ?? 'Press'
  const press = pressBy ? (days === 0
    ? { name: pressName, by: pressBy, label: 'Embargo holds. Nothing to tell her.', level: 'good' as Level }
    : days <= 7
      ? { name: pressName, by: pressBy, label: `Moves with launch. She follows if told by ${weekdayOf(pressBy)}.`, level: 'warn' as Level }
      : { name: pressName, by: pressBy, label: 'She agreed to one week, not this. Her piece goes elsewhere.', level: 'bad' as Level }) : null
  const buffer = days
  const contingencyOk = budget ? shift <= budget.contingency : true
  let verdict: string, level: Level
  const label = days === 0 ? 'Hold the date' : `${days > 0 ? '+' : ''}${days} ${days === 1 ? 'day' : 'days'} from plan`
  if (press) {
    if (weekend) { verdict = `${dateLong(date)} is a ${weekdayOf(date)}. An embargo lifting on a weekend reads like a mistake, and nobody is at the keynote. Pick a weekday.`; level = 'bad' }
    else if (days === 0) { verdict = `Holding saves ${money(num(d.shiftPerDay, 500) * priced)}, but leaves zero buffer. If press 2 slips by one more day, the launch has no room left.`; level = 'warn' }
    else if (days < 7) { verdict = `+${days} means the same calls to ${pressName} and the retailers as +7, for less buffer. If you are telling them anyway, take the full week.`; level = 'warn' }
    else if (days === 7) { verdict = `This is the one I would take. ${money(shift)}${contingencyOk ? ', which the contingency line absorbs' : ''}, a full week of buffer, and ${pressName} can still follow if she knows by ${weekdayOf(pressBy!)}.`; level = 'good' }
    else { verdict = `Past +7 you are buying buffer nobody asked for. ${pressName} agreed to one week, so this costs you her piece${preorders ? ` and about ${atRisk} preorders` : ''}.`; level = 'bad' }
  } else {
    if (weekend) { verdict = `${dateLong(date)} falls on a ${weekdayOf(date)}. Pick a weekday.`; level = 'warn' }
    else if (days === 0) { verdict = 'The plan as it stands. No cost, and no buffer either.'; level = 'warn' }
    else { verdict = `${days} ${days === 1 ? 'day' : 'days'} of buffer for about ${money(shift)}. Nothing has moved until the owner approves.`; level = 'good' }
  }
  if (days === committedDays && days !== 0) verdict = `This is the date on the roadmap now. ${verdict}`
  return { date, days, committedDays, item, blockId: tl?.id, anchor, weekend, rows, budget, shift, shiftPriced: days <= priced, total, over, airFreight: num(d.airFreight, 0), buffer, preorders, press, verdict, level, label }
}

/* ---------------- Colorway studio ---------------- */
export type ColorId = 'sand' | 'slate'
export const COLORS: Record<ColorId, { name: string; css: string; hex: number; ready: string }> = {
  sand: { name: 'Sand', css: '#dcc8a8', hex: 0xdcc8a8, ready: 'Photos done. Nora’s test unit is Sand.' },
  slate: { name: 'Slate', css: '#4c5259', hex: 0x4c5259, ready: 'No photos yet: needs a second shoot.' },
}
export const colorDefaults = { kelvin: 2100, brightness: 52, view: 'compare' as 'sand' | 'slate' | 'compare' }
/** Black-body color of a light, close enough for a lamp (Tanner Helland's fit). Returns 0..1 channels. */
export function kelvinToRgb(k: number): [number, number, number] {
  const t = k / 100
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  const c = (v: number) => Math.max(0, Math.min(255, v)) / 255
  return [c(r), c(g), c(b)]
}
export const kelvinCss = (k: number) => { const [r, g, b] = kelvinToRgb(k); return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})` }
const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
/** How much the glow stands out from the base under this light: a contrast ratio, computed live. */
export function glowContrast(color: ColorId, kelvin: number, brightness: number) {
  const hex = COLORS[color].hex
  const base = lum(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255)
  const [r, g, b] = kelvinToRgb(kelvin)
  const glow = lum(r, g, b) * (brightness / 100)
  const hi = Math.max(glow, base), lo = Math.min(glow, base)
  return (hi + 0.05) / (lo + 0.05)
}
export interface PollView { options: { id: string; label: string; votes: string[] }[]; total: number; source: 'block' | 'proposal' | 'none'; blockId?: string; messageId?: string; question: string }
export function pollOf(p: Project): PollView {
  const block = p.blocks.find((b): b is Extract<Block, { type: 'poll' }> => b.type === 'poll' && /colou?rway|coloris/i.test(`${en(b.title)} ${en(b.question)}`) ) ?? p.blocks.find((b): b is Extract<Block, { type: 'poll' }> => b.type === 'poll')
  const toView = (b: Extract<Block, { type: 'poll' }>) => ({ options: b.options.map((o) => ({ id: o.id, label: en(o.label), votes: o.votes })), total: b.options.reduce((n, o) => n + o.votes.length, 0), question: en(b.question) })
  if (block) return { ...toView(block), source: 'block', blockId: block.id }
  const m = p.messages.find((x) => x.kind === 'proposal' && x.status === 'pending' && x.action.type === 'add-block' && x.action.block.type === 'poll')
  if (m && m.kind === 'proposal' && m.action.type === 'add-block' && m.action.block.type === 'poll') return { ...toView(m.action.block), source: 'proposal', messageId: m.id }
  return { options: [], total: 0, source: 'none', question: '' }
}
export function colorCost(p: Project, color: ColorId) {
  const b = budgetOf(p)
  const extra = color === 'sand' ? 0 : Math.round((b?.shoot ?? 25000) / 2)
  return { extra, total: (b?.committed ?? 0) + extra, target: b?.target ?? 0 }
}
export function colorVerdict(p: Project, kelvin: number, brightness: number) {
  const s = glowContrast('sand', kelvin, brightness), d = glowContrast('slate', kelvin, brightness)
  const poll = pollOf(p)
  const lead = [...poll.options].sort((a, b) => b.votes.length - a.votes.length)[0]
  const tied = poll.options.filter((o) => o.votes.length === lead?.votes.length).length > 1
  const pollLine = !poll.total ? 'No votes yet.' : tied ? 'The poll is tied.' : `${lead.label} leads the poll, ${lead.votes.length} of ${poll.total}.`
  const cost = colorCost(p, 'slate').extra
  const read = d > s * 1.25
    ? `At ${kelvin.toLocaleString('en-US')} K and ${brightness}%, the glow stands out more on Slate (${d.toFixed(1)}:1) than on Sand (${s.toFixed(1)}:1).`
    : s > d * 1.25
      ? `At ${kelvin.toLocaleString('en-US')} K and ${brightness}%, the glow stands out more on Sand (${s.toFixed(1)}:1) than on Slate (${d.toFixed(1)}:1).`
      : `At ${kelvin.toLocaleString('en-US')} K and ${brightness}%, both read about the same (Sand ${s.toFixed(1)}:1, Slate ${d.toFixed(1)}:1).`
  return `${read} ${pollLine} Sand is shot and costs nothing more. Slate means about ${money(cost)} for a second shoot, my estimate.`
}

/* ---------------- Who sits where ---------------- */
export interface Desk { id: string; n: number; x: number; y: number }
const COLS = [250, 325, 400, 490, 565, 640], ROWS = [80, 190, 300]
export const DESKS: Desk[] = ROWS.flatMap((y, r) => COLS.map((x, c) => ({ id: `d${r * 6 + c + 1}`, n: r * 6 + c + 1, x, y })))
export const PLACES = {
  archive: { x: 105, y: 75, label: 'Archive room' },
  booth: { x: 65, y: 175, label: 'Phone booth' },
  wall: { x: 205, y: 280, label: '9-meter wall' },
  elevator: { x: 62, y: 450, label: 'Elevator' },
  stairs: { x: 148, y: 450, label: 'Stairs' },
  meeting: { x: 610, y: 450, label: 'Meeting rooms' },
  kitchen: { x: 725, y: 245, label: 'Kitchen' },
  lockers: { x: 320, y: 485, label: 'Lockers' },
}
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
export interface SeatRule { id: string; who: string; text: string; place: keyof typeof PLACES | null; ok: (d: Desk, seats: Record<string, string>) => boolean }
export const SEAT_RULES: SeatRule[] = [
  { id: 'lea-archive', who: 'lea', text: 'Léa needs the archive room close: the accounts boxes move with us.', place: 'archive', ok: (d) => dist(d, PLACES.archive) <= 200 },
  { id: 'lea-booth', who: 'lea', text: 'Léa takes bank calls, so the phone booth should be a few steps away.', place: 'booth', ok: (d) => dist(d, PLACES.booth) <= 215 },
  { id: 'sofia-wall', who: 'sofia', text: 'Sofia wants the 9-meter wall in reach for the Aurora timeline and prototypes.', place: 'wall', ok: (d) => d.x <= 260 && d.y >= 140 },
  { id: 'karim-elevator', who: 'karim', text: 'Karim is half at Lumen Works during the pilot run. Near the elevator, he disturbs nobody.', place: 'elevator', ok: (d) => dist(d, PLACES.elevator) <= 345 },
  { id: 'tom-light', who: 'tom', text: 'Tom checks material samples, and the north light is the only even light on the floor.', place: null, ok: (d) => d.y <= 100 },
  { id: 'maya-tom', who: 'maya', text: 'Maya and Tom work on the same object all day: keep them within one desk.', place: null, ok: (d, seats) => { const t = DESKS.find((x) => x.id === seats.tom); return !!t && dist(d, t) <= 120 } },
  { id: 'alex-meeting', who: 'alex', text: 'Alex is in the meeting rooms half the week, so he sits on that side.', place: 'meeting', ok: (d) => dist(d, PLACES.meeting) <= 190 },
]
export const seatDefaults = { seats: { alex: 'd1', karim: 'd6', tom: 'd16', maya: 'd3' } as Record<string, string>, checked: {} as Record<string, boolean> }
export const seatRulesFor = (p: Project) => (p.id === 'move' ? SEAT_RULES : [])
export function seatScore(rules: SeatRule[], seats: Record<string, string>) {
  const results = rules.map((r) => { const d = DESKS.find((x) => x.id === seats[r.who]); return { rule: r, ok: !!d && r.ok(d, seats), seated: !!d } })
  return { results, met: results.filter((r) => r.ok).length, total: results.length }
}
/** Tries every placement that matters, one person at a time, keeping what the others need. */
export function solveSeats(team: string[], rules: SeatRule[], seats: Record<string, string>) {
  let best: Record<string, string> = {}
  let bestScore = -1
  const order = [...team].sort((a, b) => rules.filter((r) => r.who === b).length - rules.filter((r) => r.who === a).length)
  // tom before maya: her rule depends on his desk
  order.sort((a, b) => (a === 'tom' && b === 'maya' ? -1 : a === 'maya' && b === 'tom' ? 1 : 0))
  const walk = (i: number, cur: Record<string, string>) => {
    if (i === order.length) { const s = seatScore(rules, cur).met; if (s > bestScore) { bestScore = s; best = { ...cur } }; return }
    const who = order[i]
    const mine = rules.filter((r) => r.who === who)
    const used = new Set(Object.values(cur))
    const free = DESKS.filter((d) => !used.has(d.id))
    const fit = free.filter((d) => mine.length && mine.every((r) => r.ok(d, cur)))
    // current desk first, so people who are fine do not move for nothing
    const here = free.find((d) => d.id === seats[who])
    const tries = fit.length ? [...(here && fit.includes(here) ? [here] : []), ...fit.filter((d) => d !== here)].slice(0, 3) : [here ?? free[free.length - 1]].filter(Boolean)
    for (const d of tries) { cur[who] = d.id; walk(i + 1, cur); delete cur[who]; if (bestScore === rules.length) return }
  }
  walk(0, {})
  return best
}

/* ---------------- Candidate compare ---------------- */
export const CRITERIA = [
  { id: 'ship', label: 'Shipped a physical object', short: 'Shipped' },
  { id: 'detail', label: 'Eye for detail', short: 'Detail' },
  { id: 'no', label: 'Taste for saying no', short: 'Says no' },
  { id: 'lead', label: 'Leads a small team well', short: 'Leads' },
  { id: 'factory', label: 'Can talk to a factory', short: 'Factory' },
] as const
export type CriterionId = typeof CRITERIA[number]['id']
export type Scores = Record<string, Record<string, Partial<Record<CriterionId, number>>>>
export const candidateDefaults = { selected: ['c-ben', 'c-hanna'] as string[], scores: {} as Scores, interviewer: 'tom' }
export const INTERVIEWERS = ['tom', 'alex', 'maya']
export interface Candidate { id: string; name: string; stage: string; tag: string; note: string; assigneeId?: string; personId?: string }
export function candidatesOf(p: Project): Candidate[] {
  const k = p.blocks.find((b): b is Extract<Block, { type: 'kanban' }> => b.type === 'kanban')
  if (!k) return []
  return [...k.columns].reverse().flatMap((c) => c.cards.map((card: KanbanCard) => ({ id: card.id, name: en(card.title), stage: en(c.title), tag: en(card.tag), note: en(card.note), personId: card.assigneeId === 'ben' ? 'ben' : undefined })))
}
export const scoreAvg = (scores: Scores, c: string, crit: CriterionId) => {
  const v = Object.values(scores[c] ?? {}).map((s) => s[crit] ?? 0).filter((x) => x > 0)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0
}
export const scoreTotal = (scores: Scores, c: string) => CRITERIA.reduce((n, x) => n + scoreAvg(scores, c, x.id), 0)
export const scorers = (scores: Scores, c: string) => Object.entries(scores[c] ?? {}).filter(([, s]) => Object.values(s).some((v) => (v ?? 0) > 0)).map(([id]) => id)
const QUESTIONS: Record<string, Partial<Record<CriterionId, string>>> = {
  'c-ben': {
    ship: 'Ondine is your only object made at scale, 4,000 units. What would you do differently on the next tooling run?',
    factory: 'On Ondine, what went wrong at the factory, and who told whom?',
    no: 'Tell me about a time you said no to an engineer on Marée. What happened next?',
    detail: 'Show me one detail on Ondine nobody asked for. What did it cost?',
    lead: 'You would hire a second person here in the spring. What do you look for that Tom does not already have?',
  },
  'c-hanna': {
    factory: 'Our supplier is in Busan and molds fail in person. How would you run a factory relationship fully remote?',
    ship: 'Walk me through the last object you took from mockup to factory.',
    no: 'What is the last feature you killed, and how did you sell that to the team?',
    detail: 'How do you review physical samples when you are not in the room?',
    lead: 'How do you lead someone who is in the office while you are not?',
  },
}
const FALLBACK: Record<CriterionId, string> = {
  ship: 'Have you ever taken a physical object from mockup to factory? Show me the ugliest prototype.',
  detail: 'Show me one detail in your portfolio that nobody asked for.',
  no: 'What is the last idea you killed, and whose was it?',
  lead: 'Tell me about two people you have led. What did each of them need?',
  factory: 'What is the worst thing a supplier ever told you, and what did you do that day?',
}
export function nextQuestion(scores: Scores, c: Candidate) {
  const rated = CRITERIA.map((x) => {
    const v = Object.values(scores[c.id] ?? {}).map((s) => s[x.id] ?? 0).filter((n) => n > 0)
    const gap = v.length > 1 ? Math.max(...v) - Math.min(...v) : 0
    return { c: x, avg: v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0, gap, n: v.length }
  })
  const pick = [...rated].sort((a, b) => (b.gap >= 2 ? 1 : 0) - (a.gap >= 2 ? 1 : 0) || a.avg - b.avg)[0]
  const why = pick.n === 0 ? 'Nobody has scored this yet.' : pick.gap >= 2 ? `Your interviewers disagree here by ${pick.gap} points.` : `The lowest score so far, ${pick.avg.toFixed(1)} of 4.`
  return { criterion: pick.c.label, why, question: QUESTIONS[c.id]?.[pick.c.id] ?? FALLBACK[pick.c.id] }
}
const firstNames: Record<string, string> = { tom: 'Tom', alex: 'Alex', maya: 'Maya' }
export function biasNotes(scores: Scores, selected: Candidate[]) {
  const notes: string[] = []
  const counts = selected.map((c) => scorers(scores, c.id).length)
  if (counts.length > 1 && new Set(counts).size > 1) notes.push(`${selected.map((c, i) => `${c.name.split(' ')[0]} has ${counts[i]} ${counts[i] === 1 ? 'scorer' : 'scorers'}`).join(', ')}. Don’t compare totals until the numbers match.`)
  for (const c of selected) {
    for (const [who, s] of Object.entries(scores[c.id] ?? {})) {
      const v = CRITERIA.map((x) => s[x.id] ?? 0)
      if (v.every((n) => n > 0) && new Set(v).size === 1) notes.push(`${firstNames[who] ?? who} gave ${c.name.split(' ')[0]} a ${v[0]} on every line. That looks like a general impression rather than five judgments.`)
    }
    const fav = /favorite/i.test(c.note) && /tom/i.test(c.note)
    if (fav) {
      const avg = (who: string) => { const v = CRITERIA.map((x) => scores[c.id]?.[who]?.[x.id] ?? 0).filter((n) => n > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }
      const t = avg('tom'), others = ['alex', 'maya'].map(avg).filter((n): n is number => n != null)
      if (t != null && others.length) {
        const o = others.reduce((a, b) => a + b, 0) / others.length
        if (t - o >= 0.3) notes.push(`The board calls ${c.name.split(' ')[0]} Tom’s favorite, and Tom scores him ${(t - o).toFixed(1)} above the others. Worth saying out loud before the debrief.`)
      }
    }
    for (const x of CRITERIA) {
      const v = Object.values(scores[c.id] ?? {}).map((s) => s[x.id] ?? 0).filter((n) => n > 0)
      if (v.length > 1 && Math.max(...v) - Math.min(...v) >= 2) { notes.push(`Two scores for ${c.name.split(' ')[0]} on “${x.short}” are ${Math.max(...v) - Math.min(...v)} apart. Compare the evidence before averaging.`); break }
    }
  }
  notes.push('Scored on what the job description asks for, nothing else. Same five lines for everyone, and no names on the debrief sheet if you can help it.')
  return [...new Set(notes)].slice(0, 3)
}

/* ---------------- Deal calculator ---------------- */
export const dealDefaults = { volume: 400, price: 112, warranty: 2, engraving: 4, bordeaux: true }
export interface DealFacts { cost: number; engravingCost: number; warrantyPerYear: number; floor: number; list: number; counter: number; lastOffer: number; grid: { volume: number; price: number }[]; rollout: { label: string; rooms: number; signed: boolean }[] }
export function dealFacts(p: Project, block: App): DealFacts {
  const s = sheetWith(p, (block.data?.sheetId as string) ?? '')
  const rows = s?.rows ?? []
  const named = (n: string) => rows.find((r) => r[0] === n)
  const engrave = named('Engraving')
  const grid = rows.filter((r) => typeof r[0] === 'number').map((r) => ({ volume: r[0] as number, price: r[1] as number }))
  return {
    cost: num(named('Unit cost')?.[1], 61),
    engravingCost: engrave ? num(engrave[1], 4) - num(engrave[4], 1) : 3,
    warrantyPerYear: Math.abs(num(named('2-year warranty')?.[4], 3)),
    floor: num(block.data?.floor, 110), list: num(block.data?.list, 149), counter: num(block.data?.counter, 105), lastOffer: num(block.data?.lastOffer, 119),
    grid: grid.length ? grid : [{ volume: 50, price: 139 }, { volume: 100, price: 134 }, { volume: 200, price: 127 }, { volume: 400, price: 119 }, { volume: 800, price: 112 }],
    rollout: (block.data?.rollout as DealFacts['rollout'] | undefined) ?? [],
  }
}
export function dealMath(f: DealFacts, t: { price: number; warranty: number; engraving: number; volume: number }) {
  const engravingCost = t.engraving > 0 ? f.engravingCost : 0
  const unitCost = f.cost + (t.warranty - 1) * f.warrantyPerYear + engravingCost
  const unitRevenue = t.price + t.engraving
  const unitMargin = unitRevenue - unitCost
  return { unitCost, unitRevenue, unitMargin, marginPct: unitRevenue ? (unitMargin / unitRevenue) * 100 : 0, revenue: unitRevenue * t.volume, margin: unitMargin * t.volume, belowFloor: t.price < f.floor }
}
export const gridPrice = (f: DealFacts, volume: number) => [...f.grid].sort((a, b) => a.volume - b.volume).filter((g) => g.volume <= volume).at(-1)?.price ?? f.grid[0].price
export function dealVerdict(f: DealFacts, t: typeof dealDefaults) {
  const m = dealMath(f, t)
  const grid = gridPrice(f, t.volume)
  if (m.unitMargin <= 0) return { level: 'bad' as Level, text: `You would pay ${money(-m.unitMargin)} per lamp to win this. Please don’t.` }
  if (t.price < f.floor) return { level: 'bad' as Level, text: `${money(t.price)} is under Léa’s ${money(f.floor)} floor, so she does not sign this. You are ${money(f.floor - t.price)} short, ${t.bordeaux ? 'even with Bordeaux on the table' : 'and nothing in return'}.` }
  if (t.price === f.floor) return { level: 'warn' as Level, text: `Right on Léa’s floor. It signs, but it leaves you nothing to give when Priya pushes back.` }
  const b = t.bordeaux ? 'with Bordeaux in the contract' : 'and nothing written for Bordeaux, which Léa wanted'
  if (t.price >= grid) return { level: t.bordeaux ? 'good' as Level : 'warn' as Level, text: `At grid price or above, ${money(m.unitMargin)} a lamp. Priya’s budget is ${money(f.counter)}, so expect this to come back.` }
  return { level: t.bordeaux ? 'good' as Level : 'warn' as Level, text: `${money(t.price - f.counter)} over Priya’s budget, ${money(t.price - f.floor)} above Léa’s floor, ${m.marginPct.toFixed(0)}% margin ${b}. ${t.bordeaux ? 'I would send this.' : 'I would ask for Bordeaux first.'}` }
}
export function dealReplyText(t: typeof dealDefaults) {
  const y = t.warranty === 1 ? '1-year' : `${t.warranty}-year`
  const engr = t.engraving > 0 ? `engraving at ${money(t.engraving)} per unit` : 'engraving included'
  return `@Gemini draft a reply to Priya: ${money(t.price)} per unit for ${t.volume} units, ${y} warranty, ${engr}${t.bordeaux ? ', Bordeaux written into the contract' : ''}`
}

/* ---------------- Odds machine ---------------- */
export interface OddsMove { id: string; label: string; weight: number; todo?: string; on: string; off: string }
export const ODDS_MOVES: OddsMove[] = [
  { id: 'phone', label: 'Demo works on a phone', weight: 1.9, on: 'Good. Most people will open it from a link on a phone.', off: 'A demo that only works on your desk is a screenshot with extra steps.' },
  { id: 'film', label: 'Film posted', weight: 2.1, todo: 'hd-t6', on: 'Nobody can forward a film that lives on your laptop. Now they can.', off: 'The film is the part people forward. Currently nobody can.' },
  { id: 'intro', label: 'Warm intro sent', weight: 2.6, todo: 'hd-t7', on: 'The largest number on this machine. Also the one I made up most confidently.', off: 'Asking for a forward is not a favor. Asking for a job is. Ask for the forward.' },
  { id: 'apply', label: 'Applied the normal way too', weight: 1.3, on: 'Boring, and correct.', off: 'There is a careers page. It costs twenty minutes.' },
  { id: 'stop', label: 'Stopped adding features', weight: 1.5, todo: 'hd-t8', on: 'I will believe it when this tool is the last one.', off: 'This odds machine is a new feature. I am only mentioning it.' },
]
export const ODDS_BASE = 2
export function oddsOf(moves: OddsMove[], on: (m: OddsMove) => boolean) {
  const factor = moves.reduce((n, m) => n * (on(m) ? m.weight : 1), 1)
  return Math.min(96, Math.round(ODDS_BASE * factor))
}
export const todoDone = (p: Project, id?: string) => !!id && p.blocks.some((b) => b.type === 'todo' && b.todos.some((t) => t.id === id && t.done))
export function genericMoves(p: Project): OddsMove[] {
  const todos = p.blocks.flatMap((b) => (b.type === 'todo' ? b.todos : [])).filter((t) => !t.done).slice(0, 5)
  return todos.map((t) => ({ id: t.id, label: en(t.text), weight: 1.8, todo: t.id, on: 'One less thing between you and done.', off: 'Still open. The number will wait.' }))
}
export const movesFor = (p: Project) => (p.id === 'hired' ? ODDS_MOVES : genericMoves(p))
export function oddsRemark(moves: OddsMove[], states: boolean[], odds: number, last?: string) {
  const n = states.filter(Boolean).length
  const m = moves.find((x) => x.id === last)
  const i = m ? moves.indexOf(m) : -1
  if (m) return `${states[i] ? m.on : m.off}`
  if (n === 0) return 'Everything off. This is what sending a résumé into the void looks like, in number form.'
  if (n === moves.length) return `${odds}%, and it cannot go higher. The rest is someone else’s decision, and I have no data on that.`
  return `${n} of ${moves.length} done. Remember that I invented this number, and I would invent a different one tomorrow.`
}

/* ---------------- Pitch timer ---------------- */
export const PITCH_SECONDS = 120
export const WPM = 140
export const BANNED = ['disrupt', 'disrupting', 'disruptive', 'disruption', 'disrupter', 'passionate', 'passion', 'passionne', 'passionné', 'synergy', 'leverage']
export const BUZZ = /\b(disrupt\w*|passion\w*|synerg\w*|leverag\w*)\b/gi
export const buzzWords = (s: string) => s.match(BUZZ) ?? []
export const wordCount = (s: string) => (s.trim().match(/\S+/g) ?? []).length
export function deckOf(p: Project, block: App) {
  return p.artifacts.find((a): a is Extract<Artifact, { kind: 'slides' }> => a.kind === 'slides' && a.id === block.data?.deckId) ?? p.artifacts.find((a): a is Extract<Artifact, { kind: 'slides' }> => a.kind === 'slides')
}
export interface PitchLine { slide: number; text: string; title: boolean }
export function scriptFrom(deck: ReturnType<typeof deckOf>): string {
  if (!deck) return ''
  return deck.slides.map((s) => [en(s.title), en(s.subtitle), ...(s.bullets ?? []).map(en)].filter(Boolean).map((x) => (/[.!?]$/.test(x) ? x : `${x}.`)).join('\n')).join('\n\n')
}
export const fmtClock = (s: number) => `${s < 0 ? '-' : ''}${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(Math.trunc(s)) % 60).padStart(2, '0')}`
