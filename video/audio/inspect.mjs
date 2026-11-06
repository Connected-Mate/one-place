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
const marks = [[0, 'hello'], [2, 'spend'], [4, 'gmail'], [6, 'chaos'], [10, 'designed'], [12, 'merge'], [14.5, 'w1'], [15.5, 'home'], [18.5, 'w2'], [19.5, 'type'], [22, 'answer'], [24, 'block'], [25.5, 'w3'], [26.5, 'priv'], [29.5, 'w4'], [30.5, 'call maya'], [32.2, 'call tom'], [34.65, 'call karim'], [35.85, 'call wow'], [38.73, 'call lea'], [43.5, 'w5'], [44.5, 'tabs'], [47.5, 'every'], [49, 'people'], [51.5, 'hey'], [53.5, 'hire'], [56, 'end'], [60, '']]
for (let i = 0; i < marks.length - 1; i++) {
  const a = Math.floor(marks[i][0] * 48000), b = Math.min(s.length, Math.floor(marks[i + 1][0] * 48000))
  let p = 0, e = 0; for (let j = a; j < b; j++) { p = Math.max(p, Math.abs(s[j])); e += s[j] * s[j] }
  console.log(String(marks[i][0]).padStart(5), marks[i][1].padEnd(11), 'peak', db(p), 'rms', db(Math.sqrt(e / Math.max(1, b - a))))
}
if (png) spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-filter_complex', 'showwavespic=s=1900x260:split_channels=0:colors=#4285f4', '-frames:v', '1', png])
