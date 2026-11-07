#!/usr/bin/env node
/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Numeric proof that the picture sits on the music. Usage: node sync-check.mjs film.mp4
// 1. every scheduled cut, caption and spotlight: distance from the nearest beat or 16th of the film's grid.
// 2. the rendered file: cuts found by frame differencing, each scheduled cut must have one within 1 frame.
// 3. the rendered file's own audio: is the track's drop on the frame of the mark?
// Fails (exit 1) if anything is more than 1 frame off.
import { spawnSync } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'
import { BEAT, CHIPS, LENSES, SEGMENTS, STEPS, timeline } from './film/timeline.mjs'

const file = process.argv[2]
const FPS = +(process.argv[3] ?? 60)
const FRAME = 1 / FPS
const T = timeline()
const sched = []
for (const [n] of SEGMENTS) sched.push({ what: 'cut ' + n, t: T[n][0], cut: true })
STEPS.forEach((st, i) => { if (st.h) sched.push({ what: `caption+spotlight ${i}: ${st.cap[0].slice(0, 34)}`, t: T.tour[0] + st.h * BEAT, cut: true }) })
for (const l of LENSES) sched.push({ what: 'close-up in ' + l.mark, t: T.tour[0] + l.from * BEAT, cut: true })
for (const c of CHIPS) sched.push({ what: 'chip ' + c.t, t: T.tour[0] + c.h * BEAT })
sched.push({ what: 'text line: Not another bot', t: T.notagents[0] + 1.2 })
sched.sort((a, b) => a.t - b.t)
let fail = 0
const SUB = BEAT / 4
console.log('SCHEDULE  time(s)  beat   bar.beat  off grid(ms)  what')
for (const x of sched) {
  const b = x.t / BEAT, g = Math.round(x.t / SUB) * SUB, off = Math.abs(x.t - g)
  if (off > FRAME) { fail++; x.bad = true }
  const bar = Math.floor(b / 4)
  console.log(x.t.toFixed(3).padStart(14), b.toFixed(2).padStart(7), `${bar + 1}.${(b - bar * 4 + 1).toFixed(2)}`.padStart(9), (off * 1000).toFixed(1).padStart(10), ' ', x.what, x.bad ? 'FAIL' : '')
}
if (file) {
  const W = 240, H = W === 240 ? 136 : 0
  const r = spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 2 ** 32 })
  const n = Math.floor(r.stdout.length / (W * H)), d = new Float32Array(n)
  for (let f = 1; f < n; f++) { let s = 0; const a = (f - 1) * W * H, b = f * W * H; for (let i = 0; i < W * H; i += 2) s += Math.abs(r.stdout[a + i] - r.stdout[b + i]); d[f] = s / (W * H / 2) }
  const med = [...d].sort((x, y) => x - y)[n >> 1]
  const peaks = []
  for (let f = 2; f < n - 2; f++) if (d[f] > Math.max(.12, med * 4) && d[f] >= d[f - 1] && d[f] > d[f + 1]) peaks.push(f)
  console.log(`\nRENDER ${file.split('/').pop()}: ${n} frames, ${peaks.length} sudden changes found`)
  console.log('  scheduled cut            wanted frame  found frame  off(frames)')
  for (const x of sched.filter((q) => q.cut)) {
    const want = Math.ceil(x.t * FPS - 1e-6)
    if (want >= n || want === 0) continue
    const found = peaks.reduce((b, p) => (Math.abs(p - want) < Math.abs(b - want) ? p : b), -1e9)
    const off = found - want
    if (Math.abs(off) > 1) fail++
    console.log(' ', x.what.slice(0, 26).padEnd(28), String(want).padStart(6), String(found).padStart(12), String(off).padStart(8), Math.abs(off) > 1 ? 'FAIL' : '')
  }
  const known = new Set(sched.filter((q) => q.cut).map((q) => Math.ceil(q.t * FPS - 1e-6)))
  const extra = peaks.filter((p) => ![...known].some((k) => Math.abs(k - p) <= 12))
  console.log(`  sudden changes that are not scheduled cuts (app content changing inside the take): ${extra.length}${extra.length ? ' at ' + extra.slice(0, 30).map((p) => (p / FPS).toFixed(2)).join(' ') : ''}`)
  // The audio of the file: the drop's attack against the mark's frame.
  const a = spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', file, '-map', '0:a', '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], { maxBuffer: 2 ** 31 })
  const s = new Float32Array(a.stdout.buffer, a.stdout.byteOffset, a.stdout.length / 4)
  const want = T.merge[0]; let best = 0, at = want, prev = 0
  for (let i = Math.round((want - .06) * 48000); i < (want + .06) * 48000; i += 120) { let e = 0; for (let j = 0; j < 120; j++) e += s[i + j] ** 2; const v = Math.sqrt(e / 120); if (v - prev > best) { best = v - prev; at = i / 48000 } prev = v }
  const off = at - want
  console.log(`\nAUDIO in the file: drop attack at ${at.toFixed(3)} s, mark's first frame at ${want.toFixed(3)} s, ${(off * 1000).toFixed(0)} ms (track's own attack sits 0 to 15 ms after the grid)`)
  if (Math.abs(off) > .03) fail++
}
console.log(fail ? `\nFAILED: ${fail}` : '\nPASSED: nothing more than 1 frame off')
process.exit(fail ? 1 : 0)
