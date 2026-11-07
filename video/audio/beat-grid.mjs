/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Measures the track: tempo, beat grid, downbeats, sections, from spectral flux. Writes audio/beat-grid.json.
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ffmpegPath from 'ffmpeg-static'
const here = dirname(fileURLToPath(import.meta.url))
const file = process.argv[2] ?? join(here, 'music-custom.mp3')
const SR = 44100, N = 1024, HOP = 220
const r = spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 })
const a = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4)
const win = Float64Array.from({ length: N }, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / N))
function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]] } } for (let l = 2; l <= n; l <<= 1) { const ang = -2 * Math.PI / l, wr = Math.cos(ang), wi = Math.sin(ang); for (let i = 0; i < n; i += l) { let cr = 1, ci = 0; for (let k = 0; k < l / 2; k++) { const x = i + k, y = x + l / 2, tr = re[y] * cr - im[y] * ci, ti = re[y] * ci + im[y] * cr; re[y] = re[x] - tr; im[y] = im[x] - ti; re[x] += tr; im[x] += ti; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t } } } }
const frames = Math.floor((a.length - N) / HOP), dt = HOP / SR
const flux = new Float32Array(frames), rms = new Float32Array(frames)
let prev = new Float64Array(N / 2)
const re = new Float64Array(N), im = new Float64Array(N)
for (let f = 0; f < frames; f++) {
  let e = 0
  for (let i = 0; i < N; i++) { const v = a[f * HOP + i]; re[i] = v * win[i]; im[i] = 0; e += v * v }
  rms[f] = Math.sqrt(e / N); fft(re, im)
  let s = 0
  for (let k = 1; k < N / 2; k++) { const m = Math.log1p(40 * Math.hypot(re[k], im[k])); const d = m - prev[k]; if (d > 0) s += d; prev[k] = m }
  flux[f] = s
}
// local normalisation, so quiet sections count
const norm = new Float32Array(frames); { const w = Math.round(1.5 / dt); let acc = 0; for (let i = 0; i < frames; i++) { acc += flux[i]; if (i >= 2 * w) acc -= flux[i - 2 * w]; const c = i - w; if (c >= 0) norm[c] = Math.max(0, flux[c] - acc / (2 * w)) } }
const dur = a.length / SR
/** Score of a grid: mean flux right on its points. */
const scoreOf = (period, phase, from = 0, to = dur) => { let s = 0, c = 0; for (let t = phase; t < to; t += period) { if (t < from) continue; const i = Math.round(t / dt); if (i < frames) { s += Math.max(norm[i], norm[i - 1] || 0, norm[i + 1] || 0); c++ } } return s / Math.max(1, c) }
const search = (from, to, lo = 60, hi = 180, step = .05) => { let best = { s: -1 }; for (let bpm = lo; bpm <= hi; bpm += step) { const p = 60 / bpm; for (let ph = 0; ph < p; ph += .005) { const s = scoreOf(p, ph, from, to); if (s > best.s) best = { s, bpm, ph } } } return best }
const whole = search(0, dur)
// candidates, whole track
const cands = []; for (const b of [80, 90, 100, 120, 133, 133.3, 150, 160, 200 / 3]) { const q = search(0, dur, b - 1.5, b + 1.5); cands.push([+q.bpm.toFixed(2), +q.s.toFixed(1)]) }
console.log('whole-track best', whole.bpm.toFixed(2), 'score', whole.s.toFixed(1), 'candidates', JSON.stringify(cands))
// per section, is the tempo stable?
for (const [x, y] of [[0, 30], [38, 60], [60, 90], [90, 117]]) { const q = search(x, y, 90, 110); console.log(`  ${x}-${y}s, best within 90-110: ${q.bpm.toFixed(2)}`) }
// Refine tempo around 100 and pick the phase.
let bpm = 100, phase = 0, top = -1
for (let b = 98; b <= 102; b += .01) { const p = 60 / b; for (let ph = 0; ph < p; ph += .002) { const s = scoreOf(p, ph); if (s > top) { top = s; bpm = b; phase = ph } } }
const beat = 60 / bpm
// Downbeats: which of the 4 positions has the strongest flux and energy jumps?
const bars = [0, 1, 2, 3].map((k) => scoreOf(beat * 4, phase + k * beat))
// Musical downbeat = where the sections change: the position with the biggest energy jumps across a bar line. (The snare position wins on flux alone.)
const en = (a, b) => { const i0 = Math.max(0, Math.round(a / dt)), i1 = Math.min(frames, Math.round(b / dt)); let e = 0; for (let i = i0; i < i1; i++) e += rms[i] ** 2; return 10 * Math.log10(e / Math.max(1, i1 - i0) + 1e-9) }
const jumps = [0, 1, 2, 3].map((k) => { let m = 0; for (let t = phase + k * beat + beat * 4; t < dur - beat; t += beat * 4) m = Math.max(m, en(t, t + beat) - en(t - beat * .5, t)); return m })
const down = jumps.indexOf(Math.max(...jumps))
console.log('biggest energy jump across a bar line per position', jumps.map((x) => x.toFixed(1)).join(' '))
const d0 = phase + 0 * beat // the track's own hits (38.425, 48.025, 115.225) fall on this position, whatever the jump test says about the fills
console.log('tempo', bpm.toFixed(2), 'beat', beat.toFixed(4), 'first beat', phase.toFixed(3), 'bar scores', bars.map((x) => x.toFixed(1)).join(' '), 'downbeat index', down)
// Accuracy: how far is each strong onset from the grid?
const onsets = []; { const th = 2.2 * norm.reduce((x, y) => x + y, 0) / frames; for (let i = 2; i < frames - 2; i++) if (norm[i] > th && norm[i] >= norm[i - 1] && norm[i] > norm[i + 1] && (!onsets.length || i * dt - onsets[onsets.length - 1] > .08)) onsets.push(i * dt) }
const sub = beat / 4
const dist = onsets.map((t) => { const u = (t - phase) / sub; return Math.abs(u - Math.round(u)) * sub }).sort((x, y) => x - y)
console.log('strong onsets', onsets.length, 'distance to 16th grid: median', (dist[dist.length >> 1] * 1000).toFixed(0), 'ms, p90', (dist[Math.floor(dist.length * .9)] * 1000).toFixed(0), 'ms; random would be', (sub / 4 * 1000).toFixed(0), 'ms')
// Bars and their energy, jumps = sections
const barList = []; for (let t = d0 % (beat * 4); t < dur; t += beat * 4) { const i0 = Math.round(t / dt), i1 = Math.min(frames, Math.round((t + beat * 4) / dt)); let e = 0; for (let i = i0; i < i1; i++) e += rms[i] ** 2; barList.push({ t: +t.toFixed(3), db: +(10 * Math.log10(e / Math.max(1, i1 - i0) + 1e-9)).toFixed(1) }) }
barList.forEach((b, i) => console.log(String(i).padStart(3), b.t.toFixed(2).padStart(7), String(b.db).padStart(6), '#'.repeat(Math.max(0, Math.round((b.db + 30) / 1)))))
writeFileSync(join(here, 'beat-grid.json'), JSON.stringify({ bpm: +bpm.toFixed(3), beat: +beat.toFixed(5), phase: +phase.toFixed(4), downbeat: +(d0 % (beat * 4)).toFixed(4), bars: barList, onsets: onsets.map((x) => +x.toFixed(3)), duration: +dur.toFixed(3) }))
