/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The voices of the call: one clip per scripted line, one line at a time, through one <audio> element.
// Nothing is downloaded before a call starts. Missing, stale or refused clips just mean silent captions.
import { create } from 'zustand'

export interface Clip { who: string; hash: string; duration: number }
export type VoiceManifest = Record<string, Clip>

const base = import.meta.env.BASE_URL
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
const START_TIMEOUT_MS = 4000

export const useVoice = create<{ muted: boolean; blocked: boolean }>(() => ({ muted: false, blocked: false }))

let el: HTMLAudioElement | null = null
let manifest: Promise<VoiceManifest> | null = null
let cancelActive: (() => void) | null = null

function audioEl() {
  if (!el) {
    el = document.createElement('audio')
    el.setAttribute('data-call-voice', '')
    el.preload = 'auto'
    el.style.display = 'none'
    document.body.appendChild(el)
  }
  return el
}

/** Call inside a click: browsers then let this element play on its own for the rest of the call. */
export function unlockAudio() {
  try {
    const a = audioEl()
    if (cancelActive) return // already speaking: the element is unlocked
    a.src = SILENCE
    void a.play().then(() => { if (!cancelActive) a.pause() }, () => {})
  } catch { /* no audio at all: captions carry on */ }
}

export function enableSound() {
  unlockAudio()
  useVoice.setState({ blocked: false, muted: false })
}

export function setCallAudioMuted(muted: boolean) {
  useVoice.setState({ muted })
  if (el) el.muted = muted
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
export function clipFor(m: VoiceManifest, prefix: string | undefined, line: number, who: string, text: string, selfId: string) {
  if (!prefix || who === selfId) return null // the viewer's own lines are captions only
  const key = `${prefix}-${line}`
  const clip = m[key]
  if (!clip || clip.who !== who || clip.hash !== textHash(text)) return null
  return { src: `${base}call/voice/${key}.mp3`, duration: clip.duration }
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
    tick = setInterval(() => onProgress(Math.min(1, a.currentTime / (a.duration || duration))), 60)
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

export function stopVoice() {
  cancelActive?.()
}
