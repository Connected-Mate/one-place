// The whole fake world of the demo, in French and English. One file per project under ./seed/.
// Dates are relative to now and computed each time seedProjects() runs, so the demo is always fresh.
import type { Project } from './types'
import { aurora } from './seed/aurora'
import { hiring } from './seed/hiring'
import { move } from './seed/move'
import { northwind } from './seed/northwind'

export { GEMINI_ID, ME_ID, people } from './seed/people'

/** Bump when the seed changes shape: the persisted store starts clean. */
export const SEED_VERSION = 4

export const seedProjects = (): Project[] => [aurora(), move(), hiring(), northwind()]
