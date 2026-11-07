/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The sound of the film, entirely synthesized here: felt-piano and mallet motif, soft claps, whooshes, UI ticks,
// plus the real voices of the call. No sample, no download. Output: audio/mix.wav, loudness-normalized by finish.mjs.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ffmpegPath from 'ffmpeg-static'
import { loadTrack } from './music.mjs'
import { timeline, PIECES, BEAT } from '../film/timeline.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const SCRATCH = process.env.FILM_SCRATCH ?? '/private/tmp/claude-502/-Users-0104389S/a60853bb-6655-4d82-acf6-a5c639d40492/scratchpad/film'
const PUBLIC = process.env.FILM_PUBLIC ?? join(here, '../../public') // the voices, from the same version of the app as the footage
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d }
const SR = 48000, DUR = timeline().end[1], N = Math.round(SR * DUR)
const bus = () => [new Float32Array(N), new Float32Array(N)]
const music = bus(), sfx = bus(), voice = bus()
let seed = 2026; const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
const mtof = (m) => 440 * 2 ** ((m - 69) / 12)
const NOTE = { C: 0, 'C#': 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 }
const n = (s) => { const m = s.match(/^([A-G][#b]?)(\d)$/); return 12 * (+m[2] + 1) + NOTE[m[1]] }

function put(b, t, mono, g = 1, pan = 0) {
  const i0 = Math.round(t * SR), l = Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2 * g, r = Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2 * g
  for (let i = 0; i < mono.length; i++) { const j = i0 + i; if (j < 0 || j >= N) continue; b[0][j] += mono[i] * l; b[1][j] += mono[i] * r }
}
/** Felt piano: soft hammer, a few slightly stretched partials, the high ones die first. */
function piano(freq, dur = 2, vel = .7, bright = 1) {
  const L = Math.floor((dur + .4) * SR), o = new Float32Array(L)
  const partials = [[1, 1, 1.0], [2.001, .42 * bright, .62], [3.004, .16 * bright, .42], [4.01, .07 * bright, .3], [5.02, .03 * bright, .2], [6.05, .012 * bright, .14]]
  for (const [h, a, life] of partials) {
    const f = freq * h; if (f > SR / 2.2) continue
    const tau = Math.min(dur * life * 1.1, (1.9 * life) * (440 / Math.max(220, freq)) ** .3)
    const det = 1 + (rand() - .5) * .0004
    for (let i = 0; i < L; i++) { const t = i / SR; o[i] += a * Math.sin(2 * Math.PI * f * det * t) * Math.exp(-t / tau) }
  }
  const atk = Math.floor(.006 * SR), rel = Math.floor(.3 * SR)
  for (let i = 0; i < L; i++) { let e = vel; if (i < atk) e *= i / atk; if (i > L - rel) e *= (L - i) / rel; o[i] *= e * .34 }
  // felt: a tiny low thud of the hammer
  for (let i = 0; i < .012 * SR; i++) o[i] += (rand() - .5) * .02 * vel * (1 - i / (.012 * SR))
  return o
}
/** Mallet: glassy and short, for the motif and the sparkle. */
function mallet(freq, vel = .6) {
  const L = Math.floor(.9 * SR), o = new Float32Array(L)
  const parts = [[1, 1, .42], [3.93, .25, .12], [9.2, .05, .04]]
  for (const [h, a, tau] of parts) { const f = freq * h; if (f > SR / 2.2) continue; for (let i = 0; i < L; i++) { const t = i / SR; o[i] += a * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / tau) } }
  for (let i = 0; i < L; i++) { const e = Math.min(1, i / (.002 * SR)); o[i] *= e * vel * .3 }
  return o
}
function bass(freq, dur = .5, vel = .7) {
  const L = Math.floor((dur + .15) * SR), o = new Float32Array(L)
  for (let i = 0; i < L; i++) { const t = i / SR; const e = Math.min(1, t / .008) * Math.exp(-t / (dur * .75)) * Math.min(1, (L - i) / (.04 * SR)); o[i] = (Math.sin(2 * Math.PI * freq * t) + .25 * Math.sin(4 * Math.PI * freq * t) + .08 * Math.sin(6 * Math.PI * freq * t)) * e * vel * .42 }
  return o
}
function kick(vel = .6) {
  const L = Math.floor(.22 * SR), o = new Float32Array(L); let ph = 0
  for (let i = 0; i < L; i++) { const t = i / SR; const f = 48 + 70 * Math.exp(-t / .03); ph += 2 * Math.PI * f / SR; o[i] = Math.sin(ph) * Math.exp(-t / .07) * vel * .6 }
  return o
}
function svf(input, cutoff, q = .7, mode = 'bp') { // cutoff: number or fn(i)
  const o = new Float32Array(input.length); let lo = 0, ba = 0
  for (let i = 0; i < input.length; i++) {
    const c = typeof cutoff === 'function' ? cutoff(i) : cutoff
    const f = 2 * Math.sin(Math.PI * Math.min(c, SR / 6.5) / SR)
    const hi = input[i] - lo - ba / q / 1
    ba += f * hi; lo += f * ba
    o[i] = mode === 'bp' ? ba : mode === 'lp' ? lo : hi
  }
  return o
}
const noise = (L) => { const o = new Float32Array(L); for (let i = 0; i < L; i++) o[i] = rand() * 2 - 1; return o }
function clap(vel = .6) {
  const L = Math.floor(.2 * SR), raw = new Float32Array(L), nz = noise(L)
  const hits = [0, .011, .021]
  for (let i = 0; i < L; i++) { const t = i / SR; let e = 0; for (const h of hits) if (t >= h) e = Math.max(e, Math.exp(-(t - h) / .004) * .8); if (t > .021) e = Math.max(e, .55 * Math.exp(-(t - .021) / .055)); raw[i] = nz[i] * e }
  const o = svf(raw, 1500, 1.1, 'bp')
  for (let i = 0; i < L; i++) o[i] *= vel * .52
  return o
}
function shaker(vel = .2) { const L = Math.floor(.06 * SR), r = noise(L); const o = svf(r, 7500, 1, 'hp'); for (let i = 0; i < L; i++) { const t = i / SR; o[i] *= Math.min(1, t / .006) * Math.exp(-t / .016) * vel * .16 } return o }
/** A gentle air movement. rising: the filter opens to the end. */
function whoosh(dur = .45, vel = .4, from = 500, to = 4200, peak = .55) {
  const L = Math.floor(dur * SR), nz = noise(L)
  const o = svf(nz, (i) => from * (to / from) ** (i / L), .9, 'bp')
  for (let i = 0; i < L; i++) { const u = i / L; const e = u < peak ? (u / peak) ** 1.6 : ((1 - u) / (1 - peak)) ** 1.8; o[i] *= e * vel * .55 }
  return o
}
function tick(freq = 2300, vel = .3, len = .03) { const L = Math.floor(len * SR), o = new Float32Array(L); for (let i = 0; i < L; i++) { const t = i / SR; o[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t / (len * .28)) * vel * .3 } return o }
function key(vel = .25) { const L = Math.floor(.022 * SR), nz = noise(L), o = svf(nz, 3400, 1.3, 'bp'); for (let i = 0; i < L; i++) { o[i] *= Math.exp(-(i / SR) / .005) * vel * .5 } return o }
/** Warm soft pad, slow in and out. */
function pad(midis, dur, vel = .5) {
  const L = Math.floor(dur * SR), o = new Float32Array(L)
  for (const m of midis) { const f = mtof(m); for (const d of [-.0012, .0013]) { const ph = rand() * 6; for (let i = 0; i < L; i++) { const t = i / SR; o[i] += (Math.sin(2 * Math.PI * f * (1 + d) * t + ph) + .12 * Math.sin(4 * Math.PI * f * (1 + d) * t)) } } }
  const k = vel * .05, a = Math.min(.9 * SR, L / 2.2), r = Math.min(1.1 * SR, L / 2.2)
  for (let i = 0; i < L; i++) { let e = 1; if (i < a) e = (i / a) ** 1.5; if (i > L - r) e = ((L - i) / r) ** 1.5; o[i] *= e * k }
  return o
}
const pianoAt = (t, name, vel = .7, pan = 0, dur = 2.4, bright = 1) => put(music, t, piano(mtof(n(name)), dur, vel, bright), 1, pan)
const chordAt = (t, names, vel = .6, dur = 2.6, spread = .012, bright = .8) => names.forEach((nm, i) => pianoAt(t + i * spread, nm, vel * (i === 0 ? .85 : .7), (i - names.length / 2) * .08, dur, bright))
const malletAt = (t, name, vel = .55, pan = 0) => put(music, t, mallet(mtof(n(name)), vel), 1, pan)

/* ---------- the edit (same as film.js) ---------- */
const T = Object.fromEntries(Object.entries(timeline()).map(([k, v]) => [k, v[0]]))
const CHOICE = arg('music', 'custom')
const H = (h) => T.tour + h * BEAT
const meta = JSON.parse(readFileSync(join(SCRATCH, 'cap/tour/meta.json'), 'utf8'))

/* The sounds are only a whisper under the track, and they stay on the grid. */
const tickAt = (t, f = 2400, v = .2) => put(sfx, t, tick(f, v, .03))
Array.from({ length: 13 }, (_, i) => i * .075).forEach((t) => put(sfx, t, key(.2 + rand() * .06), 1, (rand() - .5) * .4))
for (let i = 0; i < 16; i++) put(sfx, T.chaos + i * .15, tick(mtof(76 + (i % 5) * 2 + i), .2, .05), 1, Math.sin(i * 2.4) * .5)
for (const h of [23, 26, 27, 29, 30.25, 34, 42, 43.5, 49, 59.5, 64]) tickAt(H(h))
{ const m = (f, t, v) => put(sfx, t, mallet(f, v)); m(783.99, H(59.5), .3); m(659.25, H(59.5) + .13, .3); m(523.25, H(59.5) + .26, .32) }

/* ---------- the music ---------- */
const { track } = await loadTrack(CHOICE, SCRATCH, here)
function decode(file) {
  const raw = execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '2', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 })
  const a = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4)
  const L = new Float32Array(a.length / 2), R = new Float32Array(a.length / 2)
  for (let i = 0; i < L.length; i++) { L[i] = a[2 * i]; R[i] = a[2 * i + 1] }
  return [L, R]
}
{
  const song = decode(track.path)
  const norm = (10 ** (-15.5 / 20)) / (() => { let e = 0, c = 0; for (let t = 38.38; t < 68; t += .001) { const i = Math.floor(t * SR); e += song[0][i] ** 2 + song[1][i] ** 2; c += 2 } return Math.sqrt(e / c) })()
  let f = 0, cuts = []
  const pieces = PIECES
  const X = Math.floor(.012 * SR) // short equal-gain crossfade at each musical cut
  for (const [a, b] of pieces) {
    const i0 = Math.round(f * SR), L = Math.round((b - a) * SR), j0 = Math.round(a * SR)
    for (let i = -X; i < L + X; i++) {
      const o = i0 + i; if (o < 0 || o >= N) continue
      const g = Math.min(1, (i + X) / (2 * X)) * Math.min(1, (L + X - i) / (2 * X))
      if (g <= 0) continue
      for (let ch = 0; ch < 2; ch++) music[ch][o] += (song[ch][j0 + i] || 0) * Math.sqrt(g) * norm
    }
    cuts.push(f.toFixed(2)); f += b - a
  }
  console.log('music cuts at film', cuts.join(' '), 'gain', (20 * Math.log10(norm)).toFixed(1), 'dB; reveal', T.merge.toFixed(2), 'end card', T.end.toFixed(2), 'duration', DUR)
}

/* ---------- the real voices ---------- */
const manifest = JSON.parse(readFileSync(join(PUBLIC, 'call/voice/manifest.json'), 'utf8'))
const callTrack = new Float32Array(SR * 90)
for (const p of meta.plays) {
  const key_ = p.file.replace('.mp3', '')
  const raw = execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', join(PUBLIC, 'call/voice', p.file), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 })
  const s = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4)
  const end = manifest[key_]?.end ?? s.length / SR
  const i0 = Math.round(p.at * SR), M = Math.min(s.length, Math.floor(end * SR))
  for (let i = 0; i < M; i++) { const j = i0 + i; if (j >= 0 && j < callTrack.length) callTrack[j] += s[i] * (i > M - 480 ? (M - i) / 480 : 1) }
}
// Voices follow the recording: each window of the take shows that moment of the call.
const WOW = T.tour + meta.wowFilm
const wins = meta.windows
for (let w = 0; w < wins.length; w++) {
  const filmEnd = w + 1 < wins.length ? wins[w + 1].film : 59.5 * BEAT
  const from = Math.round(wins[w].app * SR), L = Math.round((filmEnd - wins[w].film) * SR), fade = 240
  const seg = new Float32Array(Math.max(0, L))
  for (let i = 0; i < L; i++) { let e = 1; if (i < fade) e = i / fade; if (i > L - fade) e = (L - i) / fade; seg[i] = (callTrack[from + i] || 0) * e }
  put(voice, T.tour + wins[w].film, seg, 1)
}
// Levelling the voices: gentle compression, so the wow is loud without spiking.
{
  const th = 10 ** (-20 / 20), ratio = 3.2, atk = Math.exp(-1 / (.004 * SR)), rel = Math.exp(-1 / (.12 * SR))
  let env = 0
  for (let i = 0; i < N; i++) {
    const x = Math.max(Math.abs(voice[0][i]), Math.abs(voice[1][i]))
    env = x > env ? atk * env + (1 - atk) * x : rel * env + (1 - rel) * x
    const g = env > th ? (th * (env / th) ** (1 / ratio)) / env : 1
    voice[0][i] *= g; voice[1][i] *= g
  }
}

/* ---------- the room: a short, airy reverb for everything but the UI ---------- */
function fft(re, im, inv = false) {
  const n_ = re.length
  for (let i = 1, j = 0; i < n_; i++) { let b = n_ >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]] } }
  for (let len = 2; len <= n_; len <<= 1) {
    const ang = 2 * Math.PI / len * (inv ? 1 : -1), wr = Math.cos(ang), wi = Math.sin(ang)
    for (let i = 0; i < n_; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const x = i + k, y = x + len / 2; const tr = re[y] * cr - im[y] * ci, ti = re[y] * ci + im[y] * cr; re[y] = re[x] - tr; im[y] = im[x] - ti; re[x] += tr; im[x] += ti; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t } }
  }
  if (inv) for (let i = 0; i < n_; i++) { re[i] /= n_; im[i] /= n_ }
}
function convolve(sig, ir) {
  let sz = 1; while (sz < sig.length + ir.length) sz <<= 1
  const a = new Float64Array(sz), ai = new Float64Array(sz), b = new Float64Array(sz), bi = new Float64Array(sz)
  a.set(sig); b.set(ir); fft(a, ai); fft(b, bi)
  for (let i = 0; i < sz; i++) { const r = a[i] * b[i] - ai[i] * bi[i]; ai[i] = a[i] * bi[i] + ai[i] * b[i]; a[i] = r }
  fft(a, ai, true)
  const o = new Float32Array(sig.length); for (let i = 0; i < sig.length; i++) o[i] = a[i]; return o
}
const irOf = () => { const L = Math.floor(1.5 * SR), nz = noise(L); const lp = svf(nz, (i) => 6500 * Math.exp(-i / L * 2.2) + 500, .8, 'lp'); for (let i = 0; i < L; i++) { const t = i / SR; lp[i] *= Math.exp(-t / .38) * Math.min(1, t / .004) } let e = 0; for (const x of lp) e += x * x; const g = 1 / Math.sqrt(e); for (let i = 0; i < L; i++) lp[i] *= g; return lp }

/* The ducking: the music steps back whenever people talk, and for his belief. Silence before the mark. */
const K = [[0, 1], [T.tour + wins[1].film - .1, 1], [T.tour + wins[1].film + .05, .35], [WOW - .1, .35], [WOW + .03, .1], [H(59.25), .1], [H(59.75), 1], [DUR, 1]] // under the call's voices only
const gainAt = (t) => { for (let i = 1; i < K.length; i++) if (t <= K[i][0]) { const [a, va] = K[i - 1], [b, vb] = K[i]; const u = (t - a) / (b - a); return va + (vb - va) * (u * u * (3 - 2 * u)) } return 1 }
const irL = irOf(), irR = irOf()
const wetM = [convolve(music[0], irL), convolve(music[1], irR)]
const wetS = [convolve(sfx[0], irL), convolve(sfx[1], irR)]
const wetV = [convolve(voice[0], irL), convolve(voice[1], irR)]
const out = [new Float32Array(N), new Float32Array(N)]
const MUSIC = 1, WET = 0, SFXG = .55, SFXWET = .09, VOICE = 2.7, VOICEWET = .035
for (let c = 0; c < 2; c++) for (let i = 0; i < N; i++) {
  const t = i / SR, g = gainAt(t)
  out[c][i] = (music[c][i] + wetM[c][i] * WET) * MUSIC * g + (sfx[c][i] + wetS[c][i] * SFXWET) * SFXG * .6 + (voice[c][i] + wetV[c][i] * VOICEWET) * VOICE
}
// the last second breathes out
for (let c = 0; c < 2; c++) for (let i = 0; i < N; i++) { const t = i / SR; if (t > DUR - .35) out[c][i] *= Math.cos((t - (DUR - .35)) / .35 * Math.PI / 2) ** 2 }

const pcm = Buffer.alloc(N * 8)
let peak = 0
for (let i = 0; i < N; i++) { peak = Math.max(peak, Math.abs(out[0][i]), Math.abs(out[1][i])); pcm.writeFloatLE(out[0][i], i * 8); pcm.writeFloatLE(out[1][i], i * 8 + 4) }
const raw = join(SCRATCH, 'mix.f32')
writeFileSync(raw, pcm)
console.log('peak', peak.toFixed(3), 'wow at', WOW.toFixed(2))
// Loudness: -14 LUFS with true peaks under -1 dB. A clean limiter catches the voice and chord peaks; gain found by iterating.
const target = arg('out', join(SCRATCH, `mix-${CHOICE}.wav`))
let gainDb = 2, summary = ''
const measure = (f) => spawnSync(ffmpegPath, ['-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr
for (let pass = 0; pass < 6; pass++) {
  spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', raw, '-af', `volume=${gainDb.toFixed(3)}dB,alimiter=limit=0.74:attack=4:release=90:level=disabled:latency=1`, '-c:a', 'pcm_s24le', target])
  summary = measure(target).split('Summary:')[1] ?? ''
  const I = parseFloat(summary.match(/I:\s+(-?[\d.]+) LUFS/)[1])
  if (Math.abs(I + 14) < .08) break
  gainDb += (-14 - I) * 1.05
}
console.log('gain', gainDb.toFixed(2), summary)
