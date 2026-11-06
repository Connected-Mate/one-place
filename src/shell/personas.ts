/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
import { ME_ID } from '../store'

/** Who the demo can be viewed as. */
export const PERSONAS = [
  { id: ME_ID, role: { fr: 'Responsable du projet', en: 'Project owner' }, hint: { fr: 'Décide', en: 'Decides' } },
  { id: 'tom', role: { fr: 'Membre', en: 'Member' }, hint: { fr: 'Propose', en: 'Proposes' } },
  { id: 'nora', role: { fr: 'Invitée à un appel', en: 'Guest on one call' }, hint: { fr: 'Appel seul', en: 'Call only' } },
]
