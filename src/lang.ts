import type { Lang } from './data/types'

/** Kept apart from i18n.ts: the store needs it at load time, and i18n.ts imports the store. */
export const detectLang = (): Lang => {
  try {
    const q = new URLSearchParams(location.search).get('lang')
    if (q === 'fr' || q === 'en') return q
  } catch { /* ignore */ }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}
