/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The voices of the call: one clip per scripted line, one line at a time, through one <audio> element.
// Nothing is downloaded before a call starts. Missing, stale or refused clips just mean silent captions.
import { create } from 'zustand'

/** `end` is where the speech stops, before the clip's silent tail: a real conversation doesn't wait for it. */
export interface Clip { who: string; hash: string; duration: number; end?: number }
export type VoiceManifest = Record<string, Clip>

const base = import.meta.env.BASE_URL
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
const START_TIMEOUT_MS = 4000

export const useVoice = create<{ muted: boolean; blocked: boolean }>(() => ({ muted: false, blocked: false }))

const POOL_SIZE = 4 // the most voices that talk at once
const pool: HTMLAudioElement[] = []
let manifest: Promise<VoiceManifest> | null = null
let cancelActive: (() => void) | null = null

function audioEl(i = 0) {
  while (pool.length <= i) {
    const el = document.createElement('audio')
    el.setAttribute('data-call-voice', '')
    el.preload = 'auto'
    el.style.display = 'none'
    el.muted = useVoice.getState().muted
    document.body.appendChild(el)
    pool.push(el)
  }
  return pool[i]
}

/** Call inside a click: browsers then let these elements play on their own for the rest of the call. */
export function unlockAudio() {
  if (cancelActive) return // already speaking: the elements are unlocked
  try {
    for (let i = 0; i < POOL_SIZE; i++) {
      const a = audioEl(i)
      a.src = SILENCE
      void a.play().then(() => { if (!cancelActive) a.pause() }, () => {})
    }
  } catch { /* no audio at all: captions carry on */ }
}

export function enableSound() {
  unlockAudio()
  useVoice.setState({ blocked: false, muted: false })
  pool.forEach((a) => { a.muted = false })
}

export function setCallAudioMuted(muted: boolean) {
  useVoice.setState({ muted })
  pool.forEach((a) => { a.muted = muted })
}

/** Dates in the script are computed from today: they must not make yesterday's clip look stale. */
export function normalizeForHash(text: string) {
  return text
    .replace(/[’‘]/g, "'")
    .replace(/\b(on )?(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day(, [A-Z][a-z]{2} \d{1,2})?/g, '#')
    .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b/g, '#')
    .replace(/\b(today|tomorrow|yesterday)\b/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
}
export function textHash(text: string) {
  let h = 0x811c9dc5
  for (const ch of normalizeForHash(text)) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

export function loadManifest(): Promise<VoiceManifest> {
  manifest ??= fetch(`${base}call/voice/manifest.json`)
    .then((r) => (r.ok ? r.json() as Promise<VoiceManifest> : {}))
    .catch(() => ({}))
  return manifest
}

/** The clip for this line, or null when this line has to stay silent. */
export function clipFor(m: VoiceManifest, key: string | undefined, who: string, text: string, selfId: string) {
  if (!key || who === selfId) return null // the viewer's own lines are captions only
  const clip = m[key]
  if (!clip || clip.who !== who || clip.hash !== textHash(text)) return null
  return { src: `${base}call/voice/${key}.mp3`, duration: clip.end ?? clip.duration }
}

export const estimateSeconds = (words: number) => Math.max(1.6, words * .36)

interface Speak {
  src?: string
  duration: number
  onTalk(on: boolean): void
  /** 0 to 1, driven by the real playback position when there is sound */
  onProgress(f: number): void
  onDone(): void
}

/** Plays one line. Returns a function that stops it at once. */
export function speak({ src, duration, onTalk, onProgress, onDone }: Speak) {
  cancelActive?.()
  let tick: ReturnType<typeof setInterval> | undefined
  let guard: ReturnType<typeof setTimeout> | undefined
  let over = false
  const a = src ? audioEl() : null

  const detach = () => {
    if (tick) clearInterval(tick)
    if (guard) clearTimeout(guard)
    tick = guard = undefined
    if (a) { a.onplaying = a.onended = a.onerror = null }
  }
  const stopElement = () => {
    if (!a) return
    a.pause()
    a.removeAttribute('src')
    a.load()
  }
  const cancel = () => {
    if (over) return
    over = true
    detach()
    stopElement()
    cancelActive = null
  }
  const finish = () => {
    if (over) return
    over = true
    detach()
    cancelActive = null
    onProgress(1)
    onDone()
  }
  const finishAndCut = () => {
    if (a) a.pause()
    finish()
  }
  const silent = (from = 0) => {
    if (over) return
    detach()
    if (a) stopElement()
    const t0 = performance.now() - from * duration * 1000
    onTalk(true)
    tick = setInterval(() => {
      const f = (performance.now() - t0) / (duration * 1000)
      onProgress(Math.min(1, f))
      if (f >= 1) finish()
    }, 60)
  }

  cancelActive = cancel
  if (!a) { silent(); return cancel }

  a.muted = useVoice.getState().muted
  a.src = src!
  guard = setTimeout(() => silent(), START_TIMEOUT_MS) // slow network: the captions don't wait
  a.onplaying = () => {
    if (guard) clearTimeout(guard)
    useVoice.setState({ blocked: false })
    onTalk(true)
    if (tick) clearInterval(tick)
    tick = setInterval(() => {
      onProgress(Math.min(1, a.currentTime / duration))
      if (a.currentTime >= duration) finishAndCut() // the rest of the clip is only its silent tail
    }, 40)
  }
  a.onended = finish
  a.onerror = () => silent()
  a.play().catch((e: { name?: string }) => {
    if (over || e?.name === 'AbortError') return
    if (e?.name === 'NotAllowedError') useVoice.setState({ blocked: true })
    silent()
  })
  return cancel
}

interface Many {
  parts: { src?: string; duration: number; at: number }[]
  onDone(): void
}

/** Several voices at once: one element each, each with its small offset, as people really talk over each other. */
export function speakTogether({ parts, onDone }: Many) {
  cancelActive?.()
  const timers: ReturnType<typeof setTimeout>[] = []
  const used: HTMLAudioElement[] = []
  let over = false
  const cancel = () => {
    if (over) return
    over = true
    timers.forEach(clearTimeout)
    used.forEach((a) => { a.pause(); a.removeAttribute('src'); a.load() })
    cancelActive = null
  }
  cancelActive = cancel
  parts.slice(0, POOL_SIZE).forEach((p, i) => {
    if (!p.src) return
    timers.push(setTimeout(() => {
      const a = audioEl(i)
      used.push(a)
      a.muted = useVoice.getState().muted
      a.src = p.src!
      a.play().then(() => useVoice.setState({ blocked: false }), (e: { name?: string }) => {
        if (!over && e?.name === 'NotAllowedError') useVoice.setState({ blocked: true })
      })
    }, p.at))
  })
  const longest = Math.max(...parts.map((p) => p.at + p.duration * 1000), 700)
  timers.push(setTimeout(() => { used.forEach((a) => a.pause()); over = true; cancelActive = null; onDone() }, longest))
  return cancel
}

export function stopVoice() {
  cancelActive?.()
}
