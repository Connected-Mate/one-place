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
    ['hello', 1.6], ['spent', 2.4], ['gmail', 1.7], ['chaos', 3.4], ['first', 1.9], ['stop', 1.7],
    ['merge', 1.6], ['conv', 1.7], ['proj', 1.7], ['files', 1.7], ['connected', 2.4], ['everyone', 2.6], ['surface', 3],
    ['ai', 1.6], ['nosub', 1.8], ['type', 1.9], ['answer', 1.3], ['block', 1.6],
    ...(mini ? [['mini', 2.6]] : []),
    ['callsT', .9], ['call', 5], ['every', 1.2], ['people', 2], ['only1', 2], ['only2', 1.3], ['hey', 1.6], ['hire', 2], ['end', 4],
  ]
  const T = {}; let t = 0
  for (const [n, d] of list) { T[n] = [+t.toFixed(3), +(t + d).toFixed(3)]; t += d }
  return T
}
