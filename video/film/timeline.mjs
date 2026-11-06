/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The one edit list, read by the picture and by the sound. Change a length here and both follow.
// "Built on the fly" comes in by itself as soon as its footage has been captured.
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export function timeline(scratch) {
  const mini = existsSync(join(scratch, 'cap/mini/meta.json'))
  // The cut follows the track: "Product Launch" by lNPLUSMUSIC. Its break starts at 31.07 s, its drop lands at 38.38 s (That's One Place),
  // a second hit at 47.97 s (the bar starts), then the beat is 60/133 s. See audio/music.mjs.
  const B = 60 / 133, BREAK = 7.31, DROP2 = 9.59
  const list = [
    ['hello', 1.5], ['spent', 2.3], ['gmail', 1.6], ['chaos', 3], ['first', 1.8], ['project', BREAK],
    ['merge', 5 * B], ['notagents', 6 * B], ['all', 8 * B], ['fast', DROP2 - 19 * B],
    ['btodo', 3 * B], ['broad', 3 * B], ['bdoc', 3 * B], ...(mini ? [['bmini', 4 * B]] : []), ['bcall', 7 * B], ['bsum', 3 * B],
    ['bdraft', 3 * B], ['bsumm', 3 * B], ['badd', 3 * B], ['people', 5 * B], ['only', 4 * B], ['hey', 4 * B], ['hire', 5 * B], ['end', 4.2],
  ]
  const T = {}; let t = 0
  for (const [n, d] of list) { T[n] = [+t.toFixed(3), +(t + d).toFixed(3)]; t += d }
  return T
}
