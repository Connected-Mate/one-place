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

const here = dirname(fileURLToPath(import.meta.url))
const SCRATCH = process.env.FILM_SCRATCH ?? '/private/tmp/claude-502/-Users-0104389S/a60853bb-6655-4d82-acf6-a5c639d40492/scratchpad/film'
const PUBLIC = process.env.FILM_PUBLIC ?? join(here, '../../public') // the voices, from the same version of the app as the footage
const SR = 48000, DUR = 60, N = SR * DUR
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
const T = { hello: 0, spend: 2, gmail: 4, chaos: 6, designed: 10, merge: 12, w1: 14.5, home: 15.5, w2: 18.5, type: 19.5, answer: 22, block: 24, w3: 25.5, priv: 26.5, w4: 29.5, call: 30.5, w5: 43.5, tabs: 44.5, every: 47.5, people: 49, hey: 51.5, hire: 53.5, end: 56 }
const TIMES = callTimes(SCRATCH)
const CALL = [{ at: 0, len: 1.7 }, { at: 1.7, len: 2.45 }, { at: 4.15, len: 1.2 }, { at: 5.35, len: 7.65 }].map((c, i) => ({ ...c, src: TIMES.src[i] }))
const BEAT = .5, BAR = 2

/* Chords of the main loop: one a bar. Bright, major, nothing clever. */
const LOOP = [
  { root: 'C3', tones: ['E5', 'G5', 'C6', 'B5', 'G5'], hold: ['C4', 'G4', 'E4'] },
  { root: 'G2', tones: ['D5', 'G5', 'B5', 'A5', 'G5'], hold: ['B3', 'D4', 'G4'] },
  { root: 'A2', tones: ['C5', 'E5', 'A5', 'G5', 'E5'], hold: ['C4', 'E4', 'A4'] },
  { root: 'F2', tones: ['C5', 'F5', 'A5', 'G5', 'C6'], hold: ['C4', 'F4', 'A4'] },
]
const MOTIF = [0, .75, 1.5, 2.5, 3] // beats within a 4-beat bar
function groove(from, to, { motif = 1, drums = 1, keys = .9, bassOn = 1, shake = 1 } = {}) {
  for (let bar = Math.floor(from / BAR); bar * BAR < to; bar++) {
    const c = LOOP[bar % 4], t0 = bar * BAR
    if (t0 >= from - .001) {
      if (keys) chordAt(t0, c.hold, .42 * keys, 2.2, .01, .7)
      if (bassOn) { put(music, t0, bass(mtof(n(c.root)), .9, .72 * bassOn)); put(music, t0 + 1.25, bass(mtof(n(c.root)), .35, .5 * bassOn)); put(music, t0 + 1.5, bass(mtof(n(c.root)), .35, .5 * bassOn)) }
    }
    if (motif) MOTIF.forEach((b, i) => { const t = t0 + b * BEAT; if (t >= from && t < to) malletAt(t, c.tones[i], .46 * motif * (i === 0 ? 1 : .82), i % 2 ? .22 : -.22) })
    for (let b = 0; b < 4; b++) {
      const t = t0 + b * BEAT
      if (t < from || t >= to) continue
      if (drums) { if (b === 0 || b === 2) put(music, t, kick(.5 * drums)); if (b === 1 || b === 3) put(music, t, clap(.38 * drums), 1, .05) }
      if (shake) for (const s of [0, .25]) put(music, t + s, shaker(s ? .34 : .22), 1, s ? .3 : -.3)
    }
  }
}
function cutWhoosh(t, vel = .34) { put(sfx, t - .22, whoosh(.5, vel, 380, 3800, .46), 1, 0) }

/* 0-6 the opening: a question, nearly nothing */
const typeTimes = (t0, cps, chars) => Array.from({ length: chars }, (_, i) => t0 + i / cps)
typeTimes(.3, 15, 13).forEach((t, i) => put(sfx, t, key(.16 + rand() * .06), 1, (rand() - .5) * .4))
pianoAt(.3, 'C5', .6, -.1, 2.4, .9); pianoAt(1.2, 'G5', .5, .1, 2.2, .9)
cutWhoosh(2, .26)
put(music, 2, bass(mtof(n('C3')), .9, .5))
malletAt(2.12, 'E5', .42); malletAt(2.5, 'G5', .42, .2); malletAt(2.9, 'C6', .5, -.2)
chordAt(2.9, ['C4', 'E4', 'G4'], .38, 1.5)
put(music, 3.0, clap(.32))
cutWhoosh(4, .26)
put(music, 4, bass(mtof(n('A2')), .9, .5))
malletAt(4.12, 'C5', .4); malletAt(4.5, 'E5', .4, .2); malletAt(4.9, 'A5', .44, -.2)
chordAt(4.9, ['C4', 'E4', 'A4'], .34, 1.2)
put(music, 5.0, clap(.28))

/* 6-10 the pile-up. Every row and every app is a ping, faster and faster, climbing, not musical on purpose */
cutWhoosh(6, .3)
{
  const prg = (lt) => 1.4 * lt + 2.2 * lt * lt + .45 * lt * lt * lt
  let row = 0
  for (let t = 0; t < 3.5; t += .004) { const p = prg(t); if (p >= row) { const midi = 76 + (row % 5) * 2 + Math.floor(t * 2); put(sfx, T.chaos + t, tick(mtof(midi), .17 + t * .022, .05), 1, Math.sin(row * 2.4) * .5); row += row < 50 ? 1 : 2 } }
  const SCALE = [60, 62, 64, 67, 69]
  for (let i = 0; i < 10; i++) { const m = SCALE[i % 5] + 12 + (i > 4 ? 12 : 0); put(music, T.chaos + .95 + i * .2, mallet(mtof(m), .4), 1, Math.sin(i * 1.4) * .6) }
  for (let i = 0; i < 86; i += 2) { const m = 72 + (i * 7) % 24; put(sfx, T.chaos + 2.95 + i * .0058, tick(mtof(m), .2, .05), 1, (rand() - .5) * 1.4) }
  // the bed tightens, a rising cluster
  for (let k = 0; k < 16; k++) { const t = T.chaos + k * .25; put(music, t, bass(mtof(36 + Math.floor(k / 4) * 2), .22, .4)); if (k % 2 === 1) put(music, t, shaker(.5), 1, .2) }
  for (let k = 0; k < 22; k++) { const t = T.chaos + 1.5 + k * .1; put(music, t, piano(mtof(60 + k), .4, .18 + k * .012, 1), 1, k % 2 ? .3 : -.3) }
  put(sfx, T.chaos + 1.6, whoosh(1.95, .5, 300, 6200, .92))
  // collapse: all of it inhaled, then silence
  put(sfx, T.chaos + 3.45, whoosh(.5, .62, 5000, 280, .55))
}
/* 10-12 silence, then the idea */
chordAt(10.2, ['F3', 'C4', 'G4', 'A4'], .5, 2.2, .018, .7)
pianoAt(10.95, 'C5', .34, .1, 2)
chordAt(11.5, ['G3', 'D4', 'G4', 'B4'], .4, 1.6, .018, .7)

/* 12-14.5 the merge: the row is read, it folds, the mark lands on the downbeat */
const MERGE_LAND = T.merge + 1.42
;['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6'].forEach((nm, i) => malletAt(T.merge + .03 + i * .045, nm, .26, (i - 4.5) * .1))
put(sfx, T.merge + 1.08, whoosh(.45, .46, 900, 5200, .85))
chordAt(MERGE_LAND, ['C3', 'G3', 'C4', 'E4', 'G4', 'C5'], .72, 3, .01, .95)
put(music, MERGE_LAND, kick(.55)); put(music, MERGE_LAND, clap(.3))
;['C6', 'E6', 'G6', 'C7'].forEach((nm, i) => malletAt(MERGE_LAND + .08 + i * .09, nm, .32 - i * .03, i % 2 ? .35 : -.35))

/* 14.5-29.5 the groove: light, rhythmic, optimistic. Bars lock on the even seconds. */
groove(14.5, 29.5)
for (const t of [T.w1, T.w2, T.w3, T.w4, T.w5]) cutWhoosh(t, .3)
for (const t of [T.home, T.type, T.answer, T.block, T.priv, T.tabs]) put(sfx, t, tick(1900, .24, .035))
// UI in sync with the footage
put(sfx, T.home + (1.5 - .55), tick(2600, .42, .03))
{ // the composer: real keys of the capture, shifted to film time
  const at = (src) => T.type + (src - .2)
  ;[.25, .33, .41, .49].forEach((s) => put(sfx, at(s), key(.3)))
  Array.from({ length: 18 }, (_, i) => .25 + .31 + .33 + .17 + i / 22).forEach((s) => put(sfx, at(s), key(.22 + rand() * .1), 1, (rand() - .5) * .3))
  put(sfx, at(2.57), tick(2600, .46, .03))
  put(sfx, at(2.62), whoosh(.3, .22, 900, 3500, .4))
}
// Gemini answers: a small shimmer rising under the stream
;['E6', 'G6', 'A6', 'C7', 'E7'].forEach((nm, i) => malletAt(T.answer + .45 + i * .13, nm, .17, i % 2 ? .3 : -.3))
// a block lands
malletAt(T.block + .1, 'G6', .42); malletAt(T.block + .22, 'C7', .46, .2); chordAt(T.block + .1, ['C5', 'E5', 'G5'], .24, 1.4)
// the private message: the lock, and a softer, closer send
put(sfx, T.priv + (1.3 - .6) / 1.7, tick(1700, .44, .03))
put(sfx, T.priv + (3.56 - .6) / 1.7, tick(2100, .4, .04)); malletAt(T.priv + (3.6 - .6) / 1.7, 'E6', .28, .1); malletAt(T.priv + (3.6 - .6) / 1.7 + .11, 'A6', .24, -.1)

/* 29.5-43.5 the call: the room takes over. Keys only, very low, nothing at all under the wow */
const WOW = T.call + CALL[3].at + (TIMES.chorus - CALL[3].src)
const LEA = T.call + CALL[3].at + (TIMES.lea - CALL[3].src)
const LEA_END = T.call + CALL[3].at + (TIMES.leaEnd - CALL[3].src)
put(music, 29.5, pad([48, 55, 60, 64], 7.2, .5))
chordAt(30.5, ['C4', 'E4', 'G4'], .22, 2)
chordAt(32.5, ['B3', 'D4', 'G4'], .2, 2)
// each hard cut of the call carries a very small tick so it does not feel accidental
for (const c of CALL) put(sfx, T.call + c.at, tick(1500, .12, .02))
// after her line: the lift back
chordAt(LEA + 1.0, ['F3', 'C4', 'A4'], .18, 3.5)
chordAt(LEA_END - .15, ['G3', 'D4', 'B4'], .3, 1.5)
pianoAt(LEA_END + .05, 'G5', .32, .1); pianoAt(LEA_END + .22, 'A5', .3, -.1)

/* 43.5-47.5 back up */
chordAt(44, ['C3', 'G3', 'C4', 'E4', 'G4'], .54, 2.6, .01, .9)
groove(44, 47.5, { motif: 1 })
put(sfx, T.tabs + (3.4 - 1) / 1.75 + .25, tick(2500, .4, .03))
malletAt(T.tabs + .42, 'G6', .3); malletAt(T.tabs + .53, 'C7', .32, .2)

/* 47.5-51.5 the turn: no rhythm, one warm piano. This is his belief, it has to breathe */
put(sfx, 47.28, whoosh(.45, .22, 380, 2400, .5))
chordAt(47.56, ['F3', 'C4', 'A4'], .5, 3, .03, .7)
pianoAt(48.4, 'C5', .34, .1, 2.4, .7)
chordAt(49.0, ['E3', 'C4', 'G4'], .48, 3, .03, .7)
pianoAt(49.45, 'E5', .3, -.1, 2.2, .7)
chordAt(50.0, ['A3', 'E4', 'C5'], .5, 2.6, .03, .7)
pianoAt(50.4, 'G5', .34, .1, 2.4, .7)
chordAt(51.0, ['G3', 'D4', 'B4'], .42, 1.2, .03, .7)
put(music, 49, pad([53, 60, 65, 69], 2.6, .45))

// a small star for each sparkle, a warm note as each becomes a person
;['G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7'].forEach((nm, i) => malletAt(T.every + .32 + i * .07, nm, .13, i % 2 ? .4 : -.4))
;['C5', 'E5', 'G5', 'A5', 'C6', 'E6', 'G6', 'A6'].forEach((nm, i) => malletAt(T.people + .32 + i * .06, nm, .15, i % 2 ? -.4 : .4))

/* 51.5-56 the ask: the claps come back, with a smile */
put(sfx, 51.28, whoosh(.45, .28, 420, 3400, .5))
groove(52, 56, { motif: .85, drums: .9 })
put(music, 51.6, clap(.45)); put(music, 51.75, clap(.28))
chordAt(51.6, ['C4', 'E4', 'G4'], .42, 1.2)
malletAt(51.6, 'C6', .36); malletAt(51.85, 'E6', .36, .2)
cutWhoosh(53.5, .26)

/* 56-60 the card: home */
put(sfx, 55.78, whoosh(.45, .3, 420, 3400, .5))
chordAt(56.0, ['C3', 'G3', 'C4', 'E4', 'G4', 'C5'], .72, 3.8, .012, .95)
put(music, 56.0, bass(mtof(n('C2')), 2, .55))
;['G5', 'C6', 'E6', 'G6', 'C7'].forEach((nm, i) => malletAt(56.08 + i * .11, nm, .3 - i * .03, i % 2 ? .3 : -.3))
pianoAt(58.0, 'E5', .2, .1, 1.8, .6); pianoAt(58.5, 'G5', .16, -.1, 1.4, .6)

/* ---------- the real voices ---------- */
const meta = JSON.parse(readFileSync(join(SCRATCH, 'cap/callwide/meta.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(join(PUBLIC, 'call/voice/manifest.json'), 'utf8'))
const callTrack = new Float32Array(SR * 45)
for (const p of meta.plays) {
  const key_ = p.file.replace('.mp3', '')
  const raw = execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', join(PUBLIC, 'call/voice', p.file), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 })
  const s = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4)
  const end = manifest[key_]?.end ?? s.length / SR
  const i0 = Math.round(p.at * SR), M = Math.min(s.length, Math.floor(end * SR))
  // a person's voice in a call: same clip as the app. Choruses overlap for real.
  for (let i = 0; i < M; i++) { const j = i0 + i; if (j >= 0 && j < callTrack.length) callTrack[j] += s[i] * (i > M - 480 ? (M - i) / 480 : 1) }
}
const VGAIN = 1.0
for (const c of CALL) {
  const from = Math.round(c.src * SR), L = Math.round(c.len * SR), fade = 288
  const seg = new Float32Array(L)
  for (let i = 0; i < L; i++) { let e = 1; if (i < fade) e = i / fade; if (i > L - fade) e = (L - i) / fade; seg[i] = (callTrack[from + i] || 0) * e }
  put(voice, T.call + c.at, seg, VGAIN)
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

/* The ducking: music sits back whenever the people talk */
const K = [[0, 1], [29.6, 1], [30.5, .42], [T.call + 5.3, .34], [WOW - .25, .08], [LEA_END - .4, .12], [LEA_END, .9], [43.5, 1], [60, 1]]
const gainAt = (t) => { for (let i = 1; i < K.length; i++) if (t <= K[i][0]) { const [a, va] = K[i - 1], [b, vb] = K[i]; const u = (t - a) / (b - a); return va + (vb - va) * (u * u * (3 - 2 * u)) } return 1 }
const irL = irOf(), irR = irOf()
const wetM = [convolve(music[0], irL), convolve(music[1], irR)]
const wetS = [convolve(sfx[0], irL), convolve(sfx[1], irR)]
const wetV = [convolve(voice[0], irL), convolve(voice[1], irR)]
const out = [new Float32Array(N), new Float32Array(N)]
const MUSIC = .6, WET = .17, SFXG = .62, SFXWET = .09, VOICE = 2.5, VOICEWET = .035
for (let c = 0; c < 2; c++) for (let i = 0; i < N; i++) {
  const t = i / SR, g = gainAt(t)
  out[c][i] = (music[c][i] + wetM[c][i] * WET) * MUSIC * g + (sfx[c][i] + wetS[c][i] * SFXWET) * SFXG + (voice[c][i] + wetV[c][i] * VOICEWET) * VOICE
}
// the last second breathes out
for (let c = 0; c < 2; c++) for (let i = 0; i < N; i++) { const t = i / SR; if (t > 59) out[c][i] *= Math.cos((t - 59) / 1 * Math.PI / 2) ** 2 }

const pcm = Buffer.alloc(N * 8)
let peak = 0
for (let i = 0; i < N; i++) { peak = Math.max(peak, Math.abs(out[0][i]), Math.abs(out[1][i])); pcm.writeFloatLE(out[0][i], i * 8); pcm.writeFloatLE(out[1][i], i * 8 + 4) }
const raw = join(SCRATCH, 'mix.f32')
writeFileSync(raw, pcm)
console.log('peak', peak.toFixed(3), 'wow at', WOW.toFixed(2), 'lea', LEA.toFixed(2), 'lea end', LEA_END.toFixed(2))
// Loudness: -14 LUFS with true peaks under -1 dB. A clean limiter catches the voice and chord peaks; gain found by iterating.
const target = process.argv[2] ?? join(here, 'mix.wav')
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
