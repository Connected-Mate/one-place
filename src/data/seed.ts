/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The whole fake world of the demo, in French and English. One file per project under ./seed/.
// Dates are relative to now and computed each time seedProjects() runs, so the demo is always fresh.
import type { Project } from './types'
import { aurora } from './seed/aurora'
import { hired } from './seed/hired'
import { hiring } from './seed/hiring'
import { move } from './seed/move'
import { northwind } from './seed/northwind'

export { GEMINI_ID, ME_ID, people } from './seed/people'

/** Bump when the seed changes shape: the persisted store starts clean. */
export const SEED_VERSION = 7

/** `hired` comes first on purpose: it is the wink. The default active project stays `aurora` (set by id in the store). */
export const seedProjects = (): Project[] => [hired(), aurora(), move(), hiring(), northwind()]
