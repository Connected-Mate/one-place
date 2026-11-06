// Demo-safe clock. Everything is relative to `now()` and computed each time seedProjects() runs.
// Rules: seeded "today" messages are never in the future; team activity never sits on a weekend;
// future meetings land on business days. Only Date.now() is read, so tests can fake the clock.
import type { L } from '../types'

export const DAY = 864e5
const MIN = 60_000
/** Seeded messages of "today" are planned between these two times (local). */
const PLAN_START = 8 * 60
const PLAN_END = 11 * 60
/** Before this time, "today" is still the previous business day. */
const OPENING = 8 * 60 + 30

export const now = (): number => Date.now()
const startOfDay = (t: number): number => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
const addDays = (t: number, n: number): number => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime() }
export const isBusinessDay = (t: number): boolean => { const w = new Date(t).getDay(); return w !== 0 && w !== 6 }
const minutesOf = (t: number): number => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes() }
const at = (day: number, h: number, m: number): number => { const d = new Date(day); d.setHours(h, m, 0, 0); return d.getTime() }

/** Step `n` business days from the day of `t` (n may be negative; 0 = same day). */
const stepBiz = (t: number, n: number): number => {
  let d = startOfDay(t)
  const s = Math.sign(n)
  for (let k = Math.abs(n); k > 0;) { d = addDays(d, s); if (isBusinessDay(d)) k-- }
  return d
}

/** The day the seeded "today" lives on: today if it is a business day and the office is open, else the previous business day. */
export const anchorDay = (): number => {
  const n = now()
  let a = startOfDay(n)
  if (!isBusinessDay(a) || minutesOf(n) < OPENING) { do a = addDays(a, -1); while (!isBusinessDay(a)) }
  return a
}

/** nth business day from today (n > 0: future, counted from the real today; n <= 0: counted back from the anchor day). */
export const biz = (n: number): number => (n > 0 ? stepBiz(startOfDay(now()), n) : stepBiz(anchorDay(), n))

/**
 * `dayAt(-1, 14, 30)` = previous business day at 2:30 PM. `dayAt(0, h, m)` = the anchor day; when that is today and the
 * planned morning (08:00 to 11:00) is not over yet, the planned times are compressed into the 90 minutes before now, in order.
 */
export const dayAt = (offset: number, h: number, m = 0): number => {
  if (offset !== 0) return at(biz(offset), h, m)
  const day = anchorDay()
  const planned = at(day, h, m)
  const n = now()
  const p = h * 60 + m
  if (day !== startOfDay(n) || p < PLAN_START || p > PLAN_END || n >= at(day, 0, PLAN_END) + MIN) return planned
  const windowEnd = n - MIN
  const windowStart = windowEnd - 90 * MIN
  return Math.round(windowStart + ((p - PLAN_START) / (PLAN_END - PLAN_START)) * (windowEnd - windowStart))
}

/** Monday 09:00 of the week `w` weeks from this one (w may be negative). */
export const week = (w: number, h = 9): number => {
  const d = new Date(now())
  const dow = (d.getDay() + 6) % 7 // monday = 0
  d.setDate(d.getDate() - dow + w * 7)
  d.setHours(h, 0, 0, 0)
  return d.getTime()
}

/** Short date like "12 nov." / "Nov 12" to embed in texts. */
export const fmtDay = (t: number, lang: 'fr' | 'en'): string =>
  new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' }).format(new Date(t))

export const weekday = (t: number, lang: 'fr' | 'en'): string =>
  new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long' }).format(new Date(t))

/** "today" / "tomorrow" / "yesterday" / "on Monday, Nov 10", seen from `from` (default: now). Safe to embed in a sentence. */
export const rel = (t: number, from: number = now()): L => {
  const d = startOfDay(t); const f = startOfDay(from)
  if (d === f) return { fr: 'aujourd’hui', en: 'today' }
  if (d === addDays(f, 1)) return { fr: 'demain', en: 'tomorrow' }
  if (d === addDays(f, -1)) return { fr: 'hier', en: 'yesterday' }
  return { fr: `${weekday(t, 'fr')} ${fmtDay(t, 'fr')}`, en: `on ${weekday(t, 'en')}, ${fmtDay(t, 'en')}` }
}
