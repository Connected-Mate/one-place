// Relative dates so the demo is always fresh. Everything is computed when seedProjects() runs.
export const DAY = 864e5

/** `dayAt(-1, 14, 30)` = yesterday at 14:30 local time. */
export const dayAt = (offset: number, h: number, m = 0): number => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

/** Monday 09:00 of the week `w` weeks from this one (w may be negative). */
export const week = (w: number, h = 9): number => {
  const d = new Date()
  const dow = (d.getDay() + 6) % 7 // monday = 0
  d.setDate(d.getDate() - dow + w * 7)
  d.setHours(h, 0, 0, 0)
  return d.getTime()
}

/** Short date like "12 nov." / "Nov 12" to embed in texts. */
export const fmtDay = (t: number, lang: 'fr' | 'en'): string =>
  new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date(t))

export const weekday = (t: number, lang: 'fr' | 'en'): string =>
  new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long' }).format(new Date(t))
