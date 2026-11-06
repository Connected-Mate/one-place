/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The three tracks, their exact sources and licenses. Downloaded from Wikimedia Commons only, checked by hash,
// stored in a directory of their own and only ever read as audio. A track Alex licenses himself: audio/music-custom.* and --music custom.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export const TRACKS = {
  a: {
    id: 'a', title: 'The Entertainer', artist: 'Kevin MacLeod (composition: Scott Joplin, 1902)', file: 'entertainer-macleod.ogg', sha256: 'f19ed758e6579a41',
    url: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/The_Entertainer_by_Kevin_MacLeod.ogg', page: 'https://commons.wikimedia.org/wiki/File:The_Entertainer_by_Kevin_MacLeod.ogg',
    license: 'CC BY 4.0', credit: '"The Entertainer" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 4.0. https://creativecommons.org/licenses/by/4.0/',
    start: .35, lead: .32,
  },
  b: {
    id: 'b', title: 'Eine kleine Nachtmusik, K. 525, I. Allegro', artist: 'Advent Chamber Orchestra, Roxanna Pavel Goldstein (composition: W. A. Mozart)', file: 'mozart-advent.ogg', sha256: 'db35d442500e3d32',
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/24/Mozart_-_Eine_kleine_Nachtmusik_-_1._Allegro.ogg', page: 'https://commons.wikimedia.org/wiki/File:Mozart_-_Eine_kleine_Nachtmusik_-_1._Allegro.ogg',
    license: 'CC BY-SA 2.0', credit: 'Mozart, Eine kleine Nachtmusik, I. Allegro. Advent Chamber Orchestra, The Al Goldstein collection. CC BY-SA 2.0. https://creativecommons.org/licenses/by-sa/2.0/',
    start: .94, enter: 'land',
  },
  c: {
    id: 'c', title: 'Ode to Joy', artist: 'United States Air Force Band of the Rockies, Concert Band (composition: L. van Beethoven)', file: 'ode-usaf.mp3', sha256: 'b1c689fc4260b289',
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Ode_to_Joy_-_Concert_Band_-_United_States_Air_Force_Band_of_the_Rockies.mp3', page: 'https://commons.wikimedia.org/wiki/File:Ode_to_Joy_-_Concert_Band_-_United_States_Air_Force_Band_of_the_Rockies.mp3',
    license: 'Public domain (work of the U.S. federal government, per Wikimedia Commons; source music.af.mil)', credit: 'Ode to Joy, United States Air Force Band of the Rockies. Public domain. No endorsement by the U.S. Air Force.',
    start: 42.55, enter: 'land',
  },
}

export async function loadTrack(id, scratch, here) {
  if (id === 'custom') {
    const f = readdirSync(here).find((x) => x.startsWith('music-custom.'))
    if (!f) throw new Error('--music custom: put the file at video/audio/music-custom.<ext>')
    return { track: { id: 'custom', path: join(here, f), start: 0, enter: 'land' } }
  }
  const t = TRACKS[id]; if (!t) throw new Error('unknown track ' + id)
  const dir = join(scratch, 'music'); mkdirSync(dir, { recursive: true })
  const path = join(dir, t.file)
  if (!existsSync(path)) execFileSync('curl', ['-sSL', '-A', 'OnePlaceFilm/1.0', '-o', path, t.url])
  const got = createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16)
  if (t.sha256 && got !== t.sha256) throw new Error(`${t.file}: hash ${got} is not the one checked`)
  return { track: { ...t, path } }
}
