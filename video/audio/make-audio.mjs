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
import { callTimes } from '../capture/call-cuts.mjs'
import { loadTrack } from './music.mjs'
import { timeline } from '../film/timeline.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const SCRATCH = process.env.FILM_SCRATCH ?? '/private/tmp/claude-502/-Users-0104389S/a60853bb-6655-4d82-acf6-a5c639d40492/scratchpad/film'
const PUBLIC = process.env.FILM_PUBLIC ?? join(here, '../../public') // the voices, from the same version of the app as the footage
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d }
const SR = 48000, DUR = Math.ceil(timeline(SCRATCH).end[1] * 100) / 100, N = Math.round(SR * DUR)
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
const T = Object.fromEntries(Object.entries(timeline(SCRATCH)).map(([k, v]) => [k, v[0]]))
const TIMES = callTimes(SCRATCH)
const CALL = [{ at: 0, len: 3.1, src: TIMES.camLine - .1 }, { at: 3.1, len: 2.2, src: TIMES.chorus - .4 }]
const HANG_AT = T.call + 5.3 + .4 / 1.7
const WOW = T.call + 3.1 + .4
const MERGE_LAND = T.merge + 1.42
function cutWhoosh(t, vel = .34) { put(sfx, t - .22, whoosh(.5, vel, 380, 3800, .46), 1, 0) }

/* Before the music: only the sounds of work piling up. The music is the answer, it starts on the mark. */
Array.from({ length: 13 }, (_, i) => .3 + i / 15).forEach((t) => put(sfx, t, key(.2 + rand() * .06), 1, (rand() - .5) * .4))
for (const t of [T.spent, T.gmail, T.chaos]) cutWhoosh(t, .26)
{
  const prg = (lt) => 1.4 * lt + 2.2 * lt * lt + .45 * lt * lt * lt
  let row = 0
  for (let t = 0; t < 3.5; t += .004) { const p = prg(t); if (p >= row) { const midi = 76 + (row % 5) * 2 + Math.floor(t * 2); put(sfx, T.chaos + t, tick(mtof(midi), .22 + t * .03, .05), 1, Math.sin(row * 2.4) * .5); row += row < 50 ? 1 : 2 } }
  const SCALE = [60, 62, 64, 67, 69]
  for (let i = 0; i < 10; i++) { const m = SCALE[i % 5] + 12 + (i > 4 ? 12 : 0); put(sfx, T.chaos + .95 + i * .2, mallet(mtof(m), .5), 1, Math.sin(i * 1.4) * .6) }
  for (let i = 0; i < 86; i += 2) { const m = 72 + (i * 7) % 24; put(sfx, T.chaos + 2.95 + i * .0058, tick(mtof(m), .24, .05), 1, (rand() - .5) * 1.4) }
  put(sfx, T.chaos + 1.6, whoosh(1.95, .6, 300, 6200, .92))
  put(sfx, T.chaos + 3.45, whoosh(.5, .7, 5000, 280, .55))
}
// the mark lands
put(sfx, T.merge + 1.08, whoosh(.45, .4, 900, 5200, .85))
// Under the music the interface only whispers
const whisper = .55
for (const t of [T.w1, T.w2, T.w3, T.w4, T.w5, T.agents, T.only1, T.hey, T.end]) cutWhoosh(t, .2)
{ // the bots leave
  put(sfx, T.agents + 2, whoosh(.7, .24, 2600, 700, .3))
}
const fromFootage = (seg, fromT, rate) => (src) => seg + (src - fromT) / rate
{
  const at = fromFootage(T.chat, .85, 1.8)
  Array.from({ length: 45 }, (_, i) => 1.1 + i / 24).filter((x) => x > .85).forEach((x) => put(sfx, at(x), key(.14 + rand() * .05), 1, (rand() - .5) * .3))
}
{
  const at = fromFootage(T.type, .4, 1)
  ;[.25, .33, .41, .49].filter((x) => x > .4).forEach((x) => put(sfx, at(x), key(.2)))
  Array.from({ length: 18 }, (_, i) => .25 + .31 + .33 + .17 + i / 22).forEach((x) => put(sfx, at(x), key(.16 + rand() * .06), 1, (rand() - .5) * .3))
  put(sfx, at(2.57), tick(2600, .3, .03))
}
{ const at = fromFootage(T.docs, .45, 1.62); for (const x of [.65 + .1, 1.5, 3.1, 3.9, 5.2]) put(sfx, at(x), tick(2300, .2, .03)) }
{ const at = fromFootage(T.home, .9, 1.4); put(sfx, at(1.9), tick(2600, .22, .03)) }
{ const at = fromFootage(T.overview, .4, 1.3); put(sfx, at(1.85), tick(2600, .22, .03)) }
// the gradient block lands: two glassy notes, in the key of nothing in particular
malletAt(T.block + .1, 'G6', .28); malletAt(T.block + .22, 'C7', .3, .2)
// call sounds, as in the app: a camera switching on, the hang-up
put(sfx, T.call + 3.1 - .4, tick(1500, .3, .05))
{ const m = (f, t, v) => put(sfx, t, mallet(f, v)); m(783.99, HANG_AT, .34); m(659.25, HANG_AT + .13, .34); m(523.25, HANG_AT + .26, .36) }
// each hard cut of the call carries the smallest tick, so it does not feel accidental
for (const c of [0, 3.1, 5.3]) put(sfx, T.call + c, tick(1500, .08, .02))
// a star for each sparkle
;['G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7'].forEach((nm, i) => malletAt(T.every + .32 + i * .07, nm, .1, i % 2 ? .4 : -.4))

/* ---------- the music: a real recording, see audio/music.mjs. Chosen with --music ---------- */
const { track } = await loadTrack(arg('music', 'a'), SCRATCH, here)
function decode(file) {
  const raw = execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '2', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 })
  const a = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4)
  const L = new Float32Array(a.length / 2), R = new Float32Array(a.length / 2)
  for (let i = 0; i < L.length; i++) { L[i] = a[2 * i]; R[i] = a[2 * i + 1] }
  return [L, R]
}
const nearOnset = (x, t, span = .35) => { // the strongest attack near t: cuts land on a note, not between
  const HOP = 240, i0 = Math.max(1, Math.floor((t - span) * SR / HOP)), i1 = Math.floor((t + span) * SR / HOP)
  let best = t, top = -1
  const en = (k) => { let e = 0; for (let j = 0; j < HOP; j++) e += x[0][k * HOP + j] ** 2 || 0; return Math.log1p(Math.sqrt(e / HOP) * 50) }
  for (let k = i0; k < i1; k++) { const f = en(k) - en(k - 1); if (f > top) { top = f; best = k * HOP / SR } }
  return best
}
const song = decode(track.path)
const songEnd = (() => { let i = song[0].length - 1; while (i > 0 && Math.abs(song[0][i]) < .012) i--; return i / SR })()
{
  const enterFilm = track.enter === 'land' ? MERGE_LAND : MERGE_LAND - (track.lead ?? 0)
  const start = track.start ?? 0
  const offset = enterFilm - start // film time = track time + offset
  const CROSS = T.end + .05, TAIL = 4.6
  const xBody = nearOnset(song, CROSS - offset) + offset
  const u = nearOnset(song, songEnd - TAIL)
  // loudness of the part we use, to reach the same level whichever track is chosen
  let e = 0, c = 0
  for (let t = start; t < start + 40; t += .001) { const i = Math.floor(t * SR); if (i < song[0].length) { e += song[0][i] ** 2 + song[1][i] ** 2; c += 2 } }
  const norm = (10 ** (-17.5 / 20)) / Math.sqrt(e / Math.max(1, c))
  const fade = .22
  for (let i = Math.floor(enterFilm * SR); i < N; i++) {
    const t = i / SR
    let a = 0, b = 0
    if (t < xBody + fade) { const f = t < xBody ? 1 : 1 - (t - xBody) / fade; const j = Math.floor((t - offset) * SR); if (j >= 0 && j < song[0].length) a = f }
    if (t >= xBody) { const f = Math.min(1, (t - xBody) / fade); const j = Math.floor((t - xBody + u) * SR); if (j >= 0 && j < song[0].length) b = f }
    const j1 = Math.floor((t - offset) * SR), j2 = Math.floor((t - xBody + u) * SR)
    const inFade = Math.min(1, (t - enterFilm) / .03)
    for (let ch = 0; ch < 2; ch++) music[ch][i] = ((a ? (song[ch][j1] || 0) * a : 0) + (b ? (song[ch][j2] || 0) * b : 0)) * norm * inFade
  }
  console.log('music', track.id, 'in at', enterFilm.toFixed(2), 'track from', start, 'cross', xBody.toFixed(2), 'into', u.toFixed(2), 'of', songEnd.toFixed(1), 'gain', (20 * Math.log10(norm)).toFixed(1), 'dB')
}

/* ---------- the real voices ---------- */
const meta = JSON.parse(readFileSync(join(SCRATCH, 'cap/callwide/meta.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(join(PUBLIC, 'call/voice/manifest.json'), 'utf8'))
const callTrack = new Float32Array(SR * 80)
for (const p of meta.plays) {
  const key_ = p.file.replace('.mp3', '')
  const raw = execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', join(PUBLIC, 'call/voice', p.file), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 })
  const s = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4)
  const end = manifest[key_]?.end ?? s.length / SR
  const i0 = Math.round(p.at * SR), M = Math.min(s.length, Math.floor(end * SR))
  for (let i = 0; i < M; i++) { const j = i0 + i; if (j >= 0 && j < callTrack.length) callTrack[j] += s[i] * (i > M - 480 ? (M - i) / 480 : 1) }
}
for (const c of CALL) {
  const from = Math.round(c.src * SR), L = Math.round(c.len * SR), fade = 288
  const seg = new Float32Array(L)
  for (let i = 0; i < L; i++) { let e = 1; if (i < fade) e = i / fade; if (i > L - fade) e = (L - i) / fade; seg[i] = (callTrack[from + i] || 0) * e }
  put(voice, T.call + c.at, seg, 1)
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
const K = [[0, 1], [T.call - .15, 1], [T.call + .05, .22], [WOW - .3, .16], [WOW - .05, .07], [T.call + 5.3 - .1, .07], [T.call + 5.3 + .15, .75], [T.w5, 1], [T.every - .1, 1], [T.every + .15, .5], [T.people + 2.4, .55], [T.only1 + .1, 1], [DUR, 1]]
const gainAt = (t) => { for (let i = 1; i < K.length; i++) if (t <= K[i][0]) { const [a, va] = K[i - 1], [b, vb] = K[i]; const u = (t - a) / (b - a); return va + (vb - va) * (u * u * (3 - 2 * u)) } return 1 }
const irL = irOf(), irR = irOf()
const wetM = [convolve(music[0], irL), convolve(music[1], irR)]
const wetS = [convolve(sfx[0], irL), convolve(sfx[1], irR)]
const wetV = [convolve(voice[0], irL), convolve(voice[1], irR)]
const out = [new Float32Array(N), new Float32Array(N)]
const MUSIC = 1, WET = 0, SFXG = .55, SFXWET = .09, VOICE = 2.7, VOICEWET = .035
for (let c = 0; c < 2; c++) for (let i = 0; i < N; i++) {
  const t = i / SR, g = gainAt(t)
  out[c][i] = (music[c][i] + wetM[c][i] * WET) * MUSIC * g + (sfx[c][i] + wetS[c][i] * SFXWET) * SFXG * (t < 14 ? 2.6 : 1) + (voice[c][i] + wetV[c][i] * VOICEWET) * VOICE
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
const target = arg('out', join(here, `mix-${track.id}.wav`))
let gainDb = 2, summary = ''
const measure = (f) => spawnSync(ffmpegPath, ['-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr
for (let pass = 0; pass < 6; pass++) {
  spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', raw, '-af', `volume=${gainDb.toFixed(3)}dB,alimiter=limit=0.80:attack=4:release=90:level=disabled:latency=1`, '-c:a', 'pcm_s24le', target])
  summary = measure(target).split('Summary:')[1] ?? ''
  const I = parseFloat(summary.match(/I:\s+(-?[\d.]+) LUFS/)[1])
  if (Math.abs(I + 14) < .08) break
  gainDb += (-14 - I) * 1.05
}
console.log('gain', gainDb.toFixed(2), summary)
