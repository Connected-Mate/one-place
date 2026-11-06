/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Prints peak and RMS per stretch of the film, and draws the waveform: the only way to "see" the mix.
import { spawnSync } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'
const [file, png] = process.argv.slice(2)
const r = spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', file, '-af', 'pan=mono|c0=0.5*c0+0.5*c1', '-ar', '48000', '-f', 'f32le', '-'], { maxBuffer: 1 << 30 })
const s = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4)
const db = (x) => (20 * Math.log10(Math.max(x, 1e-6))).toFixed(1).padStart(6)
const marks = [...Array(14).keys()].map((i) => [i * 5, String(i * 5) + 's'])
for (let i = 0; i < marks.length - 1; i++) {
  const a = Math.floor(marks[i][0] * 48000), b = Math.min(s.length, Math.floor(marks[i + 1][0] * 48000))
  let p = 0, e = 0; for (let j = a; j < b; j++) { p = Math.max(p, Math.abs(s[j])); e += s[j] * s[j] }
  console.log(String(marks[i][0]).padStart(5), marks[i][1].padEnd(11), 'peak', db(p), 'rms', db(Math.sqrt(e / Math.max(1, b - a))))
}
if (png) spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-filter_complex', 'showwavespic=s=1900x260:split_channels=0:colors=#4285f4', '-frames:v', '1', png])
