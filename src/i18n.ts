import { useStore } from './store'
import type { Lang, Txt } from './data/types'

export const tx = (v: Txt | undefined, lang: Lang): string => (v == null ? '' : typeof v === 'string' ? v : v[lang])

/** const t = useT(); t({fr:'Bonjour',en:'Hello'}) — all UI strings are written inline like this, in both languages. */
export function useT() {
  const lang = useStore((s) => s.lang)
  return (v: Txt | undefined) => tx(v, lang)
}
export { detectLang } from './lang'
const locale = (l: Lang) => (l === 'fr' ? 'fr-FR' : 'en-US')
export const fmtTime = (at: number, l: Lang) => new Date(at).toLocaleTimeString(locale(l), { hour: 'numeric', minute: '2-digit' })
export const fmtDate = (at: number, l: Lang) => new Date(at).toLocaleDateString(locale(l), { day: 'numeric', month: 'short' })
export const fmtDay = (at: number, l: Lang) => {
  const d = new Date(at), n = new Date()
  const days = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 864e5)
  if (days === 0) return l === 'fr' ? "Aujourd'hui" : 'Today'
  if (days === 1) return l === 'fr' ? 'Hier' : 'Yesterday'
  if (days === -1) return l === 'fr' ? 'Demain' : 'Tomorrow'
  return d.toLocaleDateString(locale(l), { weekday: 'long', day: 'numeric', month: 'long' })
}
