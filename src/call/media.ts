/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The viewer's real camera and mic. Nothing here records, stores or sends anything:
// the stream goes to the viewer's own <video> and to an analyser that is never connected to the speakers.
import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import type { Txt } from '../data/types'

type Failure = 'denied' | 'nodevice' | 'insecure' | 'error'
interface MediaState {
  video: MediaStreamTrack | null
  audio: MediaStreamTrack | null
  /** a request is on its way, or the tab is hidden: a missing track means nothing yet */
  busy: boolean
  notice: { id: number; text: Txt } | null
}
export const useMedia = create<MediaState>(() => ({ video: null, audio: null, busy: false, notice: null }))

const NOTE_KEY = 'one-place-camera-note'
let session = 0
let noticeId = 0
let notedThisPage = false
let ctx: AudioContext | null = null
let levelTimer: ReturnType<typeof setInterval> | null = null
let level = 0
const levelSubs = new Set<(v: number) => void>()

const notify = (text: Txt) => { noticeId += 1; useMedia.setState({ notice: { id: noticeId, text } }) }
export const clearNotice = () => useMedia.setState({ notice: null })

const FAILURE_TEXT: Record<Failure, Txt> = {
  denied: { fr: 'Caméra et micro bloqués par le navigateur. Vous suivez quand même l’appel.', en: 'Camera and mic are blocked by your browser. You can still follow the call.' },
  nodevice: { fr: 'Pas de caméra ou de micro trouvé. Vous suivez quand même l’appel.', en: 'No camera or mic found. You can still follow the call.' },
  insecure: { fr: 'La caméra et le micro demandent une page sécurisée. Vous suivez quand même l’appel.', en: 'Camera and mic need a secure page. You can still follow the call.' },
  error: { fr: 'Caméra ou micro indisponible pour l’instant. Vous suivez quand même l’appel.', en: 'Camera or mic is not available right now. You can still follow the call.' },
}

function failureOf(e: unknown): Failure {
  const name = (e as { name?: string } | null)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'nodevice'
  return 'error'
}

async function requestTracks(wantVideo: boolean, wantAudio: boolean): Promise<{ video: MediaStreamTrack | null; audio: MediaStreamTrack | null; failure: Failure | null }> {
  const none = { video: null, audio: null }
  if (!wantVideo && !wantAudio) return { ...none, failure: null }
  const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
  if (!md?.getUserMedia) return { ...none, failure: typeof isSecureContext !== 'undefined' && !isSecureContext ? 'insecure' : 'nodevice' }
  const ask = (video: boolean, audio: boolean) => md.getUserMedia({ video, audio })
  try {
    const s = await ask(wantVideo, wantAudio)
    return { video: s.getVideoTracks()[0] ?? null, audio: s.getAudioTracks()[0] ?? null, failure: null }
  } catch (e) {
    const failure = failureOf(e)
    if (failure === 'denied' || !wantVideo || !wantAudio) return { ...none, failure }
    // One device missing or busy must not take the other one down with it.
    const [v, a] = await Promise.allSettled([ask(true, false), ask(false, true)])
    const video = v.status === 'fulfilled' ? v.value.getVideoTracks()[0] ?? null : null
    const audio = a.status === 'fulfilled' ? a.value.getAudioTracks()[0] ?? null : null
    return { video, audio, failure }
  }
}

function startLevel(track: MediaStreamTrack) {
  stopLevel()
  try {
    ctx = new AudioContext()
    void ctx.resume().catch(() => {})
    const source = ctx.createMediaStreamSource(new MediaStream([track]))
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser) // and to nothing else: no path to the speakers, no feedback
    const data = new Uint8Array(analyser.fftSize)
    levelTimer = setInterval(() => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (const v of data) sum += ((v - 128) / 128) ** 2
      const rms = Math.sqrt(sum / data.length)
      level = track.enabled ? Math.max(Math.min(1, rms * 5), level * .72) : 0
      levelSubs.forEach((fn) => fn(level))
    }, 90)
  } catch { stopLevel() } // no level meter: the call goes on without the ring
}
function stopLevel() {
  if (levelTimer) clearInterval(levelTimer)
  levelTimer = null
  level = 0
  levelSubs.forEach((fn) => fn(0))
  if (ctx) void ctx.close().catch(() => {})
  ctx = null
}
/** Mic level from 0 to 1, about ten times a second. */
export function subscribeLevel(fn: (v: number) => void) {
  levelSubs.add(fn)
  return () => { levelSubs.delete(fn) }
}

function watch(track: MediaStreamTrack, kind: 'video' | 'audio') {
  track.addEventListener('ended', () => { // unplugged, or permission taken away in mid-call
    if (useMedia.getState()[kind] !== track) return
    useMedia.setState({ [kind]: null })
    if (kind === 'audio') stopLevel()
  })
}
function attach(video: MediaStreamTrack | null, audio: MediaStreamTrack | null) {
  if (video) { watch(video, 'video'); useMedia.setState({ video }) }
  if (audio) { watch(audio, 'audio'); useMedia.setState({ audio }); startLevel(audio) }
}
function privacyNoteOnce() {
  if (notedThisPage) return
  notedThisPage = true
  try { if (localStorage.getItem(NOTE_KEY)) return; localStorage.setItem(NOTE_KEY, '1') } catch { /* private mode: say it once per page */ }
  notify({ fr: 'Caméra et micro restent sur votre appareil. Rien n’est enregistré, stocké ni envoyé.', en: 'Your camera and mic stay on this device. Nothing is recorded, stored or sent.' })
}

function releaseTracks() {
  const { video, audio } = useMedia.getState()
  video?.stop()
  audio?.stop()
  stopLevel()
  useMedia.setState({ video: null, audio: null })
}

export async function startMedia(wantVideo: boolean, wantAudio: boolean) {
  session += 1
  const mine = session
  releaseTracks()
  useMedia.setState({ busy: true })
  const { video, audio, failure } = await requestTracks(wantVideo, wantAudio)
  if (mine !== session) { video?.stop(); audio?.stop(); return } // hung up while the browser was asking
  attach(video, audio)
  useMedia.setState({ busy: false })
  if (failure) notify(FAILURE_TEXT[failure])
  else if (video || audio) privacyNoteOnce()
}

/** Everything off, right now. Safe to call twice. */
export function stopMedia() {
  session += 1
  releaseTracks()
  useMedia.setState({ busy: false })
}

function suspendMedia() {
  session += 1
  releaseTracks()
  useMedia.setState({ busy: true })
}

export async function setCamera(on: boolean) {
  const { video } = useMedia.getState()
  if (!on) { video?.stop(); useMedia.setState({ video: null }); return }
  if (video) return
  const mine = session
  useMedia.setState({ busy: true })
  const r = await requestTracks(true, false)
  if (mine !== session) { r.video?.stop(); return }
  attach(r.video, null)
  useMedia.setState({ busy: false })
  if (r.failure) notify(FAILURE_TEXT[r.failure])
  else privacyNoteOnce()
}

export async function setMicrophone(on: boolean) {
  const { audio } = useMedia.getState()
  if (audio) { audio.enabled = on; return }
  if (!on) return
  const mine = session
  useMedia.setState({ busy: true })
  const r = await requestTracks(false, true)
  if (mine !== session) { r.audio?.stop(); return }
  attach(null, r.audio)
  useMedia.setState({ busy: false })
  if (r.failure) notify(FAILURE_TEXT[r.failure])
}

export function useTabVisible() {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden')
  useEffect(() => {
    const change = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', change)
    return () => document.removeEventListener('visibilitychange', change)
  }, [])
  return visible
}

/**
 * Owns the stream for as long as `active`: stopped on unmount (hang-up, project switch, change of persona),
 * when the tab is hidden and when the page goes away, and asked again when the tab comes back.
 * `onOff` is told when a device the state says is on turns out not to be there, so the button tells the truth.
 */
export function useLiveMedia(active: boolean, cam: boolean, mic: boolean, onOff: (what: 'cam' | 'mic') => void) {
  const want = useRef({ cam, mic })
  want.current = { cam, mic }
  const video = useMedia((m) => m.video)
  const audio = useMedia((m) => m.audio)
  const busy = useMedia((m) => m.busy)
  useEffect(() => {
    if (!active) return
    void startMedia(want.current.cam, want.current.mic)
    const apply = () => { if (document.visibilityState === 'hidden') suspendMedia(); else void startMedia(want.current.cam, want.current.mic) }
    const hide = () => suspendMedia()
    const show = (e: PageTransitionEvent) => { if (e.persisted) void startMedia(want.current.cam, want.current.mic) }
    document.addEventListener('visibilitychange', apply)
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    return () => {
      document.removeEventListener('visibilitychange', apply)
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', show)
      stopMedia()
    }
  }, [active])
  const off = useRef(onOff)
  off.current = onOff
  useEffect(() => {
    if (!active) return
    const m = useMedia.getState() // fresh: the effect above may have just started a request
    if (m.busy) return
    if (cam && !m.video) off.current('cam')
    if (mic && !m.audio) off.current('mic')
  }, [active, cam, mic, video, audio, busy])
}
