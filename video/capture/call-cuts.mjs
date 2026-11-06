/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The edit of the call hangs on the voices, not on the clock: if the app's timeline moves, the film follows.
// Offsets inside a clip ("No link" starts 4.07 s into Maya's line) are read from the recording. If a line is re-recorded, check them.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// New script (app 6103fbc): Maya's second line is the camera, chorus, Léa, Maya's "let's start".
export const END_LINE = 'open-aurora-11' // the chorus is over and Léa has started
export const END_TAIL = 1.0
export const HANGUP_SECONDS = 7

/** Source times for the film, from a capture's meta.json. Refuses to guess when a line is missing. */
export function callTimes(scratch, shot = 'callwide') {
  const meta = JSON.parse(readFileSync(join(scratch, 'cap', shot, 'meta.json'), 'utf8'))
  const at = (k) => { const p = meta.plays.find((x) => x.file === k + '.mp3'); if (!p) throw new Error(`call edit: the line ${k} is not in the capture. The script changed: update capture/call-cuts.mjs`); return p.at }
    const chorus = at('open-aurora-8') // Wow. Whoa. Oh, that's so good.
  return { chorus, hang: meta.clicked, frames: meta.frames, clip: meta.clip }
}
