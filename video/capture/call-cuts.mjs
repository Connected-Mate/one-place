/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The edit of the call hangs on the voices, not on the clock: if the app's timeline moves, the film follows.
// Offsets inside a clip ("No link" starts 4.07 s into Maya's line) are read from the recording. If a line is re-recorded, check them.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ANCHORS = [
  { key: 'open-aurora-0', offset: 4.07 }, // Maya: No link, no waiting room?
  { key: 'open-aurora-4', offset: -.13 }, // Tom: Can you guys hear me? Maya: Yes.
  { key: 'open-aurora-6', offset: -.02 }, // Karim: Sorry, sorry.
  { key: 'open-aurora-7', offset: -.70 }, // Gemini's note, the chorus, then Léa
]
export const LEA_LINE = 'open-aurora-10'
export const LEA_TAIL = 5.5 // recorded after her line starts

/** Source times for the film, from a capture's meta.json. Refuses to guess when a line is missing. */
export function callTimes(scratch, shot = 'callwide') {
  const { plays } = JSON.parse(readFileSync(join(scratch, 'cap', shot, 'meta.json'), 'utf8'))
  const at = (k) => { const p = plays.find((x) => x.file === k + '.mp3'); if (!p) throw new Error(`call edit: the line ${k} is not in the capture. The script changed: update capture/call-cuts.mjs`); return p.at }
  const chorus = at('open-aurora-7'), lea = at(LEA_LINE)
  const src = ANCHORS.map((a) => at(a.key) + a.offset)
  return { src, chorus, lea, leaEnd: lea + 4.57 }
}
