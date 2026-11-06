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
  const list = [
    ['hello', 2], ['spent', 2.75], ['gmail', 2], ['chaos', 4], ['first', 2.25], ['merge', 2.75], ['agents', 2.75],
    ['w1', 1], ['chat', 3], ['w2', 1.4], ['type', 2.3], ['answer', 1.8], ['block', 1.6],
    ...(mini ? [['wf', 1.2], ['mini', 3.6]] : []),
    ['w3', 1.6], ['docs', 4], ['w4', 1.2], ['call', 7.8], ['w5', 1.2], ['overview', 2], ['home', 2],
    ['every', 1.5], ['people', 2.5], ['only1', 2.5], ['only2', 1.7], ['hey', 2], ['hire', 2.5], ['end', 4.9],
  ]
  const T = {}; let t = 0
  for (const [n, d] of list) { T[n] = [+t.toFixed(3), +(t + d).toFixed(3)]; t += d }
  return T
}
