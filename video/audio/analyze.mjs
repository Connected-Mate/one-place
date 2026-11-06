/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Reads a music file by numbers, for someone who cannot hear it: tempo, beats, loudness over time, brightness.
// Usage: node audio/analyze.mjs file [--beats from to]
import { spawnSync } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'
const file = process.argv[2]
const SR = 22050
const r = spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 })
const s = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4)
const HOP = 220, n = Math.floor(s.length / HOP)
const env = new Float32Array(n), hi = new Float32Array(n)
let z = 0
for (let i = 0; i < n; i++) { let e = 0, h = 0; for (let j = 0; j < HOP; j++) { const x = s[i * HOP + j]; e += x * x; const d = x - z; h += d * d; z = x } env[i] = Math.sqrt(e / HOP); hi[i] = Math.sqrt(h / HOP) }
const flux = new Float32Array(n)
for (let i = 1; i < n; i++) flux[i] = Math.max(0, Math.log1p(env[i] * 50) - Math.log1p(env[i - 1] * 50))
const dt = HOP / SR
const tempo = (a, b) => {
  const i0 = Math.floor(a / dt), i1 = Math.min(n, Math.floor(b / dt)); let best = [], m = 0
  for (let i = i0; i < i1; i++) m += flux[i]; m /= (i1 - i0)
  for (let bpm = 50; bpm <= 200; bpm += .5) { const lag = 60 / bpm / dt; let c = 0, k = 0; for (let i = i0; i + lag < i1; i++) { c += (flux[i] - m) * (flux[Math.round(i + lag)] - m); k++ } best.push([c / k, bpm]) }
  best.sort((x, y) => y[0] - x[0]); const top = []; for (const b of best) if (top.every((t) => Math.abs(t[1] - b[1]) > 4)) { top.push(b); if (top.length === 3) break }
  return top.map((t) => t[1]).join('/')
}
console.log(file.split('/').pop(), (s.length / SR).toFixed(1) + 's', 'tempo whole', tempo(0, s.length / SR))
const step = 6
for (let t = 0; t + step < s.length / SR && t < 120; t += step) {
  const i0 = Math.floor(t / dt), i1 = Math.floor((t + step) / dt); let e = 0, h = 0, p = 0
  for (let i = i0; i < i1; i++) { e += env[i] ** 2; h += hi[i] ** 2; p = Math.max(p, env[i]) }
  const rms = 20 * Math.log10(Math.sqrt(e / (i1 - i0)) + 1e-6), bright = 10 * Math.log10((h + 1e-9) / (e + 1e-9))
  console.log(String(t).padStart(4), 'rms', rms.toFixed(1).padStart(6), 'bright', bright.toFixed(1).padStart(6), 'tempo', tempo(t, t + step).padEnd(16), '#'.repeat(Math.max(0, Math.round((rms + 45) / 1.5))))
}
const bi = process.argv.indexOf('--beats')
if (bi > 0) { const a = +process.argv[bi + 1], b = +process.argv[bi + 2]; const out = []; for (let i = Math.floor(a / dt) + 1; i < b / dt - 1; i++) if (flux[i] > .28 && flux[i] >= flux[i - 1] && flux[i] > flux[i + 1]) out.push((i * dt).toFixed(2)); console.log('onsets', out.join(' ')) }
