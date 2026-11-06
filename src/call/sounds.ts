/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The sounds of a call. All original, synthesized here in the browser: soft sine and marimba-like notes
// in the spirit of a video call, no audio file. Always well under the voices, silent when call audio is muted.
import { useVoice } from './voice'

export type Sound = 'enter' | 'join' | 'leave' | 'micOn' | 'micOff' | 'camOn' | 'camOff' | 'hand' | 'note' | 'hangup' | 'noAnswer'
export type Loop = 'ring' | 'waiting'

const MASTER = .22
let ctx: AudioContext | null = null
let master: GainNode | null = null
let loopTimer: ReturnType<typeof setInterval> | null = null
let loopName: Loop | null = null
/** What was asked for and whether it was audible. Lets the tests prove the sounds without ears. */
export const soundLog: { name: string; muted: boolean }[] = []

export function audioContext() {
  if (ctx) return ctx
  try {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = useVoice.getState().muted ? 0 : MASTER
    master.connect(ctx.destination)
    useVoice.subscribe((v) => { if (master && ctx) master.gain.setTargetAtTime(v.muted ? 0 : MASTER, ctx.currentTime, .01) })
  } catch { ctx = null }
  return ctx
}

/** Call inside a click, as browsers ask. */
export function unlockSounds() {
  const c = audioContext()
  if (c?.state === 'suspended') void c.resume().catch(() => {})
}

/** One struck note: a sine, with a quick bright partial on top that gives it the wooden attack of a marimba. */
function strike(freq: number, at: number, length = .5, volume = 1, bright = .22) {
  if (!ctx || !master) return
  const t = ctx.currentTime + at
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(volume, t + .006)
  g.gain.exponentialRampToValueAtTime(.0008, t + length)
  g.connect(master)
  const body = ctx.createOscillator()
  body.frequency.value = freq
  body.connect(g)
  body.start(t)
  body.stop(t + length + .02)
  if (!bright) return
  const g2 = ctx.createGain()
  g2.gain.setValueAtTime(volume * bright, t)
  g2.gain.exponentialRampToValueAtTime(.0008, t + .09)
  g2.connect(master)
  const top = ctx.createOscillator()
  top.frequency.value = freq * 4
  top.connect(g2)
  top.start(t)
  top.stop(t + .11)
}

/** A long, soft held tone: fades in and out, no attack. */
function swell(freqs: number[], at: number, length: number, volume: number) {
  if (!ctx || !master) return
  const t = ctx.currentTime + at
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(volume, t + .12)
  g.gain.setValueAtTime(volume, t + length - .2)
  g.gain.linearRampToValueAtTime(0, t + length)
  g.connect(master)
  for (const f of freqs) {
    const o = ctx.createOscillator()
    o.frequency.value = f
    o.connect(g)
    o.start(t)
    o.stop(t + length + .02)
  }
}

const NOTES: Record<Sound, () => void> = {
  enter: () => { strike(523.25, 0, .5, .9); strike(659.25, .11, .5, .9); strike(783.99, .22, .7, .9) },
  join: () => { strike(659.25, 0, .4, .6); strike(880, .1, .55, .6) },
  leave: () => { strike(880, 0, .4, .5); strike(659.25, .11, .55, .5) },
  micOn: () => strike(880, 0, .08, .5, 0),
  micOff: () => strike(622.25, 0, .08, .5, 0),
  camOn: () => strike(783.99, 0, .08, .45, 0),
  camOff: () => strike(554.37, 0, .08, .45, 0),
  hand: () => { strike(987.77, 0, .5, .55, .1); strike(1318.51, .09, .7, .55, .1) },
  note: () => strike(1567.98, 0, .22, .18, .05),
  hangup: () => { strike(783.99, 0, .35, .8); strike(659.25, .13, .35, .8); strike(523.25, .26, .7, .8) },
  noAnswer: () => { strike(493.88, 0, .4, .8, .08); strike(440, .3, .4, .8, .08); strike(392, .6, .9, .8, .08) },
}

export function playSound(name: Sound) {
  const muted = useVoice.getState().muted
  soundLog.push({ name, muted })
  if (muted) return
  try { audioContext(); NOTES[name]() } catch { /* no sound is not a problem */ }
}

/** A loop that keeps going until stopped: the outgoing ring, or the quiet tone while you wait alone. */
export function startLoop(name: Loop) {
  if (loopName === name) return
  stopLoop()
  loopName = name
  soundLog.push({ name, muted: useVoice.getState().muted })
  const once = name === 'ring'
    ? () => swell([440, 480], 0, 1.7, .32)
    : () => { strike(440, 0, 1.6, .16, 0); strike(554.37, .4, 1.8, .14, 0) }
  try { audioContext(); once() } catch { /* ignore */ }
  loopTimer = setInterval(() => { try { once() } catch { /* ignore */ } }, name === 'ring' ? 3400 : 5200)
}

export function stopLoop() {
  if (loopTimer) clearInterval(loopTimer)
  loopTimer = null
  loopName = null
}
