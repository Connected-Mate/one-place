/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The tools Gemini knows how to build: when each one fits a project, what to ask for, and how it starts. No React: Gemini's engine imports this.
import type { AppId, Block, Project } from '../../data/types'
import { personById, uid } from '../../store'
import { candidatesOf, deckOf, DAY, genericMoves, timelineOf } from './logic'

type App = Extract<Block, { type: 'app' }>
interface Tool {
  title: string; name: string; hint: string; icon: string; ask: string
  /** does this project hold the data the tool computes from? */
  fits: (p: Project) => boolean
  missing: string
  strict: RegExp; loose: RegExp
  make?: (p: Project) => Partial<App>
}
const members = (p: Project) => p.memberIds.filter((id) => personById(id).role !== 'ai')

export const TOOLS: Record<AppId, Tool> = {
  'launch-sim': {
    title: 'Launch date simulator', name: 'a launch date simulator', hint: 'Drag the date, see what moves and what it costs', icon: 'event_upcoming', ask: 'Simulate the launch date',
    fits: (p) => !!timelineOf(p)?.items.some((i) => i.milestone), missing: 'It needs a milestone on the Roadmap to move, and this project has none yet.',
    strict: /\b(simulat\w*|what-if)\b.*\b(launch|date|lancement|milestone|jalon)\b|\b(launch|date)\b.*\bsimulat\w*\b/, loose: /\b(launch|lancement|release|date slip|milestone)\b/,
  },
  colorway: {
    title: 'Colorway studio', name: 'a colorway studio', hint: 'Compare the finishes under the lamp’s own light', icon: 'palette', ask: 'Build a colorway studio',
    fits: (p) => p.id === 'aurora', missing: 'It needs the Aurora product and its finishes, which live on the Aurora launch project.',
    strict: /\b(colou?rway|coloris)\s+(studio|configurator|viewer|tool|compar\w*)\b|\bconfigurator\b|\bcompare\b.*\b(colou?rways?|coloris|sand|slate)\b/, loose: /\b(colou?rways?|coloris|finish(es)?|sand|slate)\b/,
  },
  seats: {
    title: 'Who sits where', name: 'a floor plan', hint: 'Drag faces onto desks, with everyone’s needs in view', icon: 'floor', ask: 'Build a floor plan of who sits where',
    fits: (p) => members(p).length >= 3, missing: 'A floor plan needs at least three people on the project.',
    strict: /\bfloor ?plan\b|\bseating (plan|chart|map)\b|\bwho sits where\b|\bplan des (postes|places)\b|\bseat(s|ing)? (map|planner)\b/, loose: /\b(seat(s|ing)?|desks?|office layout|bureaux?)\b/,
  },
  candidates: {
    title: 'Candidate compare', name: 'a candidate compare', hint: 'Same five lines for everyone, scored by each interviewer', icon: 'compare_arrows', ask: 'Build me something to compare candidates',
    fits: (p) => candidatesOf(p).length >= 2 && p.id === 'hiring', missing: 'It needs candidates on a kanban, and there are none on this project.',
    strict: /\b(compar\w*)\b.*\b(candidat\w*|applicants?)\b|\bcandidat\w*\b.*\bcompar\w*\b|\b(interview|candidate) (grid|scorecard|score card)\b/, loose: /\b(candidat\w*|applicants?|interview\w*|hiring)\b/,
  },
  deal: {
    title: 'Deal calculator', name: 'a deal calculator', hint: 'Drag the terms, watch the margin and the floor', icon: 'calculate', ask: 'Build a deal calculator',
    fits: (p) => p.artifacts.some((a) => a.id === 'n-sheet-pricing'), missing: 'It needs a pricing sheet with a unit cost, and this project has none.',
    strict: /\bdeal (calculator|simulator|tool)\b|\b(margin|price|pricing) calculator\b|\bcalculate the deal\b|\bcalculateur\b/, loose: /\b(deal|margin|pricing|price|offer|marge)\b/,
    make: () => ({ data: { sheetId: 'n-sheet-pricing' } }),
  },
  odds: {
    title: 'Odds machine', name: 'an odds machine', hint: 'A dial, your open moves, and a number that admits it is invented', icon: 'speed', ask: 'Build an odds machine',
    fits: (p) => genericMoves(p).length >= 2 || p.id === 'hired', missing: 'It turns open to-dos into switches, and this project does not have enough of them.',
    strict: /\bodds( machine| calculator)?\b|\bchances? of\b.*\b(tool|machine|dial)\b/, loose: /\b(odds|chances?|probabilit\w*)\b/,
  },
  pitch: {
    title: 'Pitch timer', name: 'a pitch timer', hint: 'A teleprompter from your slides, a countdown, a word check', icon: 'timer', ask: 'Build a pitch timer',
    fits: (p) => !!deckOf(p, { type: 'app', app: 'pitch', id: '', title: '', span: 3 }), missing: 'It reads from a deck, and this project has no slides yet.',
    strict: /\b(pitch|keynote|speech|talk) timer\b|\bteleprompter\b|\bprompteur\b|\btimer\b.*\b(pitch|keynote)\b/, loose: /\b(pitch|keynote|rehears\w*|speech)\b/,
  },
}
const IDS = Object.keys(TOOLS) as AppId[]
const TOOL_PHRASE = /\b(tool|outil|mini-?app|calculator|simulator|simulateur|something to|something for|un truc pour)\b/

/** "build me something to compare candidates", "floor plan", "make me a tool for the launch date". Null: not a known tool. */
export function wantedApp(norm: string): AppId | null {
  const strict = IDS.find((id) => TOOLS[id].strict.test(norm))
  if (strict) return strict
  if (!TOOL_PHRASE.test(norm)) return null
  return IDS.find((id) => TOOLS[id].loose.test(norm)) ?? null
}
export const hasApp = (p: Project, id: AppId) => p.blocks.find((b): b is App => b.type === 'app' && b.app === id)

export function makeApp(id: AppId, p: Project): App {
  const t = TOOLS[id]
  const more = t.make?.(p) ?? {}
  const base: App = { id: uid('b'), type: 'app', app: id, span: 3, title: t.title, ...more }
  if (id === 'launch-sim') {
    const tl = timelineOf(p)
    const item = tl?.items.filter((i) => i.milestone).sort((a, b) => a.start - b.start).findLast((i) => /launch|lancement|release/i.test(JSON.stringify(i.label))) ?? tl?.items.filter((i) => i.milestone && i.start >= Date.now() - DAY).at(-1)
    if (item) base.data = { itemId: item.id, anchor: item.start, ...(p.id === 'aurora' ? { pressBy: Date.now() + 2 * DAY, pressName: 'Nora' } : {}) }
  }
  if (id === 'pitch') base.data = { deckId: deckOf(p, base)?.id }
  return base
}

/** The top row of the gallery: what Gemini could build here, given this project's data. */
export const appSuggestions = (p: Project) => IDS.filter((id) => TOOLS[id].fits(p) && !hasApp(p, id)).sort((a, b) => order(p, a) - order(p, b)).slice(0, 3).map((id) => ({ id, ...TOOLS[id] }))
const PREFER: Record<string, AppId[]> = { aurora: ['pitch', 'odds'], move: ['launch-sim', 'odds'], hiring: ['pitch', 'odds'], northwind: ['pitch', 'odds'], hired: ['launch-sim'] }
const order = (p: Project, id: AppId) => { const i = PREFER[p.id]?.indexOf(id) ?? -1; return i < 0 ? 9 : i }

/** "update Deal calculator: price 112". Only what can be set by number; the rest is a drag away. */
export function appUpdate(block: App, ask: string): { state: Record<string, unknown>; say: string } | null {
  const n = Number(ask.match(/-?\d+(?:\.\d+)?/)?.[0])
  if (!Number.isFinite(n)) return null
  const state = block.state ?? {}
  if (block.app === 'launch-sim') { const days = Math.max(0, Math.min(14, Math.round(n))); return { state: { ...state, days }, say: days ? `+${days} days` : 'hold the date' } }
  if (block.app === 'deal') {
    if (/\b(volume|units?|lamps?|rooms?)\b/i.test(ask)) { const volume = Math.max(50, Math.min(800, Math.round(n / 10) * 10)); return { state: { ...state, volume }, say: `${volume} lamps` } }
    if (/\b(warrant\w*)\b/i.test(ask)) { const warranty = Math.max(1, Math.min(3, Math.round(n))); return { state: { ...state, warranty }, say: `${warranty}-year warranty` } }
    const price = Math.max(95, Math.min(149, Math.round(n)))
    return { state: { ...state, price }, say: `€${price} per unit` }
  }
  if (block.app === 'colorway') {
    if (/\bk(elvin)?\b/i.test(ask) || n > 100) { const kelvin = Math.max(1200, Math.min(3400, Math.round(n / 50) * 50)); return { state: { ...state, kelvin }, say: `${kelvin} K` } }
    const brightness = Math.max(0, Math.min(100, Math.round(n)))
    return { state: { ...state, brightness }, say: `${brightness}% brightness` }
  }
  return null
}
