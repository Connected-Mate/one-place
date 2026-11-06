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

export const TRACKS = {}
// The track Alex chose. Structure read from the file (RMS in tenths of a second): break at 31.07, gate at 38.1 to 38.3, drop at 38.38,
// second gate at 47.0, hit at 47.97, last big hit at 115.54, fading out by 117.8.
export const CUSTOM = { drop: 38.38, tail: 115.54, startFilm: 'project' }

export async function loadTrack(id, scratch, here) {
  if (id === 'custom') {
    const f = readdirSync(here).find((x) => x.startsWith('music-custom.'))
    if (!f) throw new Error('--music custom: put the file at video/audio/music-custom.<ext>')
    return { track: { id: 'custom', path: join(here, f), ...CUSTOM } }
  }
  const t = TRACKS[id]; if (!t) throw new Error('unknown track ' + id)
  const dir = join(scratch, 'music'); mkdirSync(dir, { recursive: true })
  const path = join(dir, t.file)
  if (!existsSync(path)) execFileSync('curl', ['-sSL', '-A', 'OnePlaceFilm/1.0', '-o', path, t.url])
  const got = createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16)
  if (t.sha256 && got !== t.sha256) throw new Error(`${t.file}: hash ${got} is not the one checked`)
  return { track: { ...t, path } }
}
