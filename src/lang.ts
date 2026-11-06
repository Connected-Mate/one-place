import type { Lang } from './data/types'

/** Alex, 06/11/2026: the product is English only, whatever the browser language or URL. */
export const detectLang = (): Lang => 'en'
