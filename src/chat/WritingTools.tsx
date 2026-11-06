/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Gemini's writing tools on any message input: select text (or press the sparkle) to correct, rephrase or translate it.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { tx, useT } from '../i18n'
import { GEMINI_ID, personById, useStore } from '../store'
import { Button, Icon, IconButton, Sparkle } from '../ui/kit'
import type { L, TimelineItem } from '../data/types'
import { CANNOT_INSTRUCT, instructionToAction, isRewritable, mentionRanges, rewrite, type RewriteAction, type TargetLang } from './rewrite'

type Mode = 'menu' | 'translate' | 'working' | 'preview' | 'none' | 'undo'
export interface WritingState {
  mode: Mode
  start: number
  end: number
  /** the input's text when the tools opened; if it changes, the tools no longer apply */
  base: string
  whole: boolean
  action?: RewriteAction
  lang?: TargetLang
  variant?: number
  variants?: number
  result?: string
  message?: string
  before?: string
}
const ACTIONS: { id: RewriteAction; label: L }[] = [
  { id: 'fix', label: { fr: 'Corriger l’orthographe et la grammaire', en: 'Fix spelling and grammar' } },
  { id: 'improve', label: { fr: 'Améliorer', en: 'Improve' } },
  { id: 'shorter', label: { fr: 'Plus court', en: 'Shorter' } },
  { id: 'longer', label: { fr: 'Plus long', en: 'Longer' } },
  { id: 'formal', label: { fr: 'Plus formel', en: 'More formal' } },
  { id: 'friendly', label: { fr: 'Plus amical', en: 'Friendlier' } },
]
const LANGS: { id: TargetLang; label: L }[] = [
  { id: 'en', label: { fr: 'Anglais', en: 'English' } },
  { id: 'fr', label: { fr: 'Français', en: 'French' } },
  { id: 'es', label: { fr: 'Espagnol', en: 'Spanish' } },
  { id: 'de', label: { fr: 'Allemand', en: 'German' } },
]
const nextStepOf = (items: TimelineItem[]) => {
  const next = items.filter((i) => i.end >= Date.now()).sort((a, b) => a.end - b.end).find((i) => i.milestone)
  return next ? `the ${tx(next.label, 'en').replace(/^./, (c) => c.toLowerCase())}` : undefined
}

interface HookArgs {
  pid: string
  value: string
  onChange: (v: string) => void
  input: RefObject<HTMLTextAreaElement | null>
  /** the mention list is open: it owns the keyboard */
  blocked: boolean
}
export function useWritingTools({ pid, value, onChange, input, blocked }: HookArgs) {
  const [state, setState] = useState<WritingState | null>(null)
  const pointer = useRef(false)
  const token = useRef(0)
  const ignored = useRef<[number, number] | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const latest = useRef({ state, value, blocked })
  latest.current = { state, value, blocked }

  const memberNames = useCallback(() => {
    const p = useStore.getState().projects.find((x) => x.id === pid)
    const ids = [GEMINI_ID, ...(p?.memberIds ?? []).filter((id) => id !== GEMINI_ID)]
    return ids.flatMap((id) => { const n = personById(id).name; return [n, n.split(/\s+/)[0]] })
  }, [pid])

  const close = useCallback((refocus = false) => {
    token.current++
    clearTimeout(timer.current)
    const s = latest.current.state
    if (s) ignored.current = [s.start, s.end]
    setState(null)
    if (refocus) input.current?.focus()
  }, [input])

  /** Grows a selection that cuts a mention in half, so a mention always stays whole. */
  const snap = useCallback((start: number, end: number): [number, number] => {
    let a = start; let b = end
    for (const [from, to] of mentionRanges(latest.current.value, memberNames())) {
      if (from < a && a < to) a = from
      if (from < b && b < to) b = to
    }
    return [a, b]
  }, [memberNames])

  const sync = useCallback(() => {
    const el = input.current
    const { state: s, value: v, blocked: b } = latest.current
    if (!el || b || pointer.current) return
    const start = el.selectionStart ?? 0; const end = el.selectionEnd ?? 0
    if (start === end) {
      ignored.current = null
      if (s && s.mode !== 'undo') close()
      return
    }
    if (ignored.current && ignored.current[0] === start && ignored.current[1] === end) return
    if (s && s.start === start && s.end === end) return
    if (s && (s.mode === 'working' || s.mode === 'preview')) { close(); return }
    const [a, z] = snap(start, end)
    if (!isRewritable(v.slice(a, z), memberNames())) { if (s) close(); return }
    if (a !== start || z !== end) el.setSelectionRange(a, z)
    setState({ mode: 'menu', start: a, end: z, base: v, whole: false })
  }, [close, input, memberNames, snap])

  /** Selections settle after the pointer is released, or after the arrow keys stop. */
  const onSelect = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(sync, 160)
  }, [sync])
  const onPointerDown = useCallback(() => { pointer.current = true }, [])
  useEffect(() => {
    const up = () => { if (pointer.current) { pointer.current = false; clearTimeout(timer.current); timer.current = setTimeout(sync, 0) } }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); clearTimeout(timer.current) }
  }, [sync])

  // anything that changes the text ends the tools: typing, sending, another project
  useEffect(() => {
    if (state && value !== state.base) { token.current++; setState(null) }
  }, [value, state])

  const openWhole = useCallback(() => {
    const el = input.current
    if (!el) return
    if (latest.current.state) { close(true); return }
    const v = latest.current.value
    el.focus()
    el.setSelectionRange(0, v.length)
    ignored.current = null
    setState({ mode: 'menu', start: 0, end: v.length, base: v, whole: true })
  }, [close, input])

  const run = useCallback((action: RewriteAction, lang?: TargetLang, variant = 0) => {
    const s = latest.current.state
    if (!s) return
    const t = ++token.current
    setState({ ...s, mode: 'working', action, lang, variant })
    const wait = 600 + Math.random() * 350
    setTimeout(() => {
      if (t !== token.current) return
      const cur = latest.current.state
      if (!cur) return
      const p = useStore.getState().projects.find((x) => x.id === pid)
      const r = rewrite(cur.base.slice(cur.start, cur.end), action, {
        mentions: memberNames(),
        names: (p?.memberIds ?? []).concat(p?.externalIds ?? []).map((id) => personById(id).name.split(/\s+/)[0]),
        projectName: p ? tx(p.name, 'en') : undefined,
        nextStep: nextStepOf((p?.blocks ?? []).flatMap((b) => (b.type === 'timeline' ? b.items : []))),
        atStart: !cur.base.slice(0, cur.start).trim(),
        atEnd: !cur.base.slice(cur.end).trim(),
        lang, variant,
      })
      if (r.status === 'ok') setState({ ...cur, mode: 'preview', action, lang, variant, variants: r.variants, result: r.text, message: undefined })
      else setState({ ...cur, mode: 'none', action, lang, variant, message: r.message, result: undefined })
    }, wait)
  }, [memberNames, pid])

  const instruct = useCallback((text: string) => {
    const hit = instructionToAction(text)
    if (hit) { run(hit.action, hit.lang); return }
    const s = latest.current.state
    if (s) setState({ ...s, mode: 'none', message: CANNOT_INSTRUCT })
  }, [run])

  /** Goes through the browser's own editing so Cmd+Z works, as it does for anything typed. */
  const replace = useCallback(() => {
    const s = latest.current.state
    const el = input.current
    if (!s || !el || s.result == null) return
    const next = s.base.slice(0, s.start) + s.result + s.base.slice(s.end)
    token.current++
    el.focus()
    el.setSelectionRange(s.start, s.end)
    setState({ ...s, mode: 'undo', base: next, before: s.base, end: s.start + s.result.length })
    let done = false
    try { done = document.execCommand('insertText', false, s.result) } catch { /* older browsers */ }
    if (!done || el.value !== next) onChange(next)
  }, [input, onChange])

  const undo = useCallback(() => {
    const s = latest.current.state
    const el = input.current
    if (!s || !el || s.before == null) return
    const before = s.before
    const original = before.length - (s.base.length - (s.end - s.start))
    el.focus()
    let done = false
    try { done = document.execCommand('undo') } catch { /* older browsers */ }
    if (!done || el.value !== before) onChange(before)
    ignored.current = [s.start, s.start + original]
    setState(null)
    requestAnimationFrame(() => el.setSelectionRange(s.start, s.start + original))
  }, [input, onChange])

  const again = useCallback(() => {
    const s = latest.current.state
    if (s?.action) run(s.action, s.lang, (s.variant ?? 0) + 1)
  }, [run])
  const back = useCallback(() => {
    token.current++
    const s = latest.current.state
    if (s) setState({ ...s, mode: 'menu', result: undefined, message: undefined })
  }, [])
  const setMode = useCallback((mode: Mode) => { const s = latest.current.state; if (s) setState({ ...s, mode }) }, [])

  return { state, close, onSelect, onPointerDown, openWhole, run, instruct, replace, undo, again, back, setMode, canWhole: !!value.trim() && isRewritable(value, memberNames()) }
}
export type WritingTools = ReturnType<typeof useWritingTools>

/** Where a range of the input sits on screen, read from the mirror that draws its text. */
function rangeRect(mirror: HTMLElement | null, start: number, end: number) {
  if (!mirror) return null
  const walker = document.createTreeWalker(mirror, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  let offset = 0; let started = false
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const len = node.textContent?.length ?? 0
    if (!started && start <= offset + len) { range.setStart(node, Math.max(0, start - offset)); started = true }
    if (started && end <= offset + len) { range.setEnd(node, Math.max(0, end - offset)); return range.getClientRects()[0] ?? range.getBoundingClientRect() }
    offset += len
  }
  return null
}

export function WritingPanel({ tools, input, mirror }: { tools: WritingTools; input: RefObject<HTMLTextAreaElement | null>; mirror: RefObject<HTMLDivElement | null> }) {
  const t = useT()
  const { state } = tools
  const panel = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<React.CSSProperties>({ visibility: 'hidden' })
  const [ask, setAsk] = useState('')
  const compact = typeof matchMedia === 'function' && matchMedia('(max-width: 600px)').matches
  const mode = state?.mode

  const place = useCallback(() => {
    const el = panel.current; const field = input.current
    if (!el || !field || !state) return
    const box = field.getBoundingClientRect()
    const h = el.offsetHeight; const w = el.offsetWidth
    // on a phone it's a row just above the input, which itself sits above the keyboard
    if (matchMedia('(max-width: 600px)').matches) {
      setPos({ left: 8, right: 8, top: Math.max(8, box.top - h - 10) })
      return
    }
    const r = state.whole ? box : rangeRect(mirror.current, state.start, state.end) ?? box
    // scrolled out of the input: stay on the input
    const top = Math.max(box.top, Math.min(r.top, box.bottom))
    const center = r.left + r.width / 2
    const above = top - h - 8
    setPos({
      top: above >= 8 ? above : Math.min(innerHeight - h - 8, Math.max(r.bottom, box.top) + 8),
      // over its own pane, not over the projects rail, whenever the pane has room
      left: Math.max(field.closest('.pane')?.getBoundingClientRect().left ?? 8, 8, Math.min(center - w / 2, innerWidth - w - 8)),
    })
  }, [input, mirror, state])

  useLayoutEffect(() => { place() }, [place, mode, state?.result, state?.message])
  useEffect(() => {
    if (!state) return
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    window.visualViewport?.addEventListener('resize', place)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); window.visualViewport?.removeEventListener('resize', place) }
  }, [place, state])

  // click outside closes; the input settles its own selection
  useEffect(() => {
    if (!state) return
    const down = (e: PointerEvent) => {
      const target = e.target as Node
      if (panel.current?.contains(target) || target === input.current || (target as Element).closest?.('.wt-spark')) return
      tools.close()
    }
    document.addEventListener('pointerdown', down, true)
    return () => document.removeEventListener('pointerdown', down, true)
  }, [state, tools, input])

  // a result gets the keyboard, so Enter means Replace and not Send. On a phone the keyboard stays where it is.
  useEffect(() => {
    if (compact) return
    if (mode === 'preview' || mode === 'none' || mode === 'undo' || mode === 'translate') panel.current?.querySelector<HTMLElement>('[data-wt-primary],[data-wt-item]')?.focus()
  }, [mode, state?.result, compact])
  useEffect(() => { if (mode === 'menu') setAsk('') }, [mode])

  if (!state) return null
  const items = () => [...(panel.current?.querySelectorAll<HTMLElement>('[data-wt-item]') ?? [])]
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); tools.close(true); return }
    const typing = (e.target as HTMLElement).tagName === 'INPUT'
    const forward = e.key === 'ArrowDown' || (e.key === 'ArrowRight' && !typing)
    const backward = e.key === 'ArrowUp' || (e.key === 'ArrowLeft' && !typing)
    if (!forward && !backward) return
    const list = items()
    if (!list.length) return
    e.preventDefault()
    const i = list.indexOf(document.activeElement as HTMLElement)
    list[(i + (forward ? 1 : -1) + list.length) % list.length]?.focus()
  }
  // chips keep the focus in the input: its selection stays visible and typing still closes the tools
  const keep = (e: React.MouseEvent) => e.preventDefault()
  const label = ACTIONS.find((a) => a.id === state.action)?.label
  const heading = state.action === 'translate'
    ? { fr: `Traduire en ${t(LANGS.find((l) => l.id === state.lang)?.label)}`, en: `Translate to ${tx(LANGS.find((l) => l.id === state.lang)?.label, 'en')}` }
    : label

  return createPortal(
    <div ref={panel} className={`wt-panel wt-${state.mode}`} style={{ position: 'fixed', ...pos }} role="toolbar" aria-label={t({ fr: 'Outils d’écriture Gemini', en: 'Gemini writing tools' })} onKeyDown={onKey}>
      {state.mode === 'menu' && (
        <>
          <form className="wt-ask" onSubmit={(e) => { e.preventDefault(); if (ask.trim()) tools.instruct(ask) }}>
            <Sparkle size={18} />
            <input data-wt-item className="wt-ask-input" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={t({ fr: 'Dites à Gemini comment réécrire', en: 'Tell Gemini how to rewrite' })} aria-label={t({ fr: 'Dites à Gemini comment réécrire', en: 'Tell Gemini how to rewrite' })} />
          </form>
          <div className="wt-chips">
            {ACTIONS.map((a) => (
              <button key={a.id} type="button" data-wt-item className="wt-chip" onMouseDown={keep} onClick={() => tools.run(a.id)}><Sparkle size={14} />{t(a.label)}</button>
            ))}
            <button type="button" data-wt-item className="wt-chip" aria-haspopup="true" onMouseDown={keep} onClick={() => tools.setMode('translate')}><Sparkle size={14} />{t({ fr: 'Traduire', en: 'Translate' })}<Icon name="chevron_right" size={16} /></button>
          </div>
        </>
      )}
      {state.mode === 'translate' && (
        <div className="wt-chips">
          <IconButton data-wt-item icon="arrow_back" size={32} label={t({ fr: 'Retour', en: 'Back' })} onMouseDown={keep} onClick={tools.back} />
          {LANGS.map((l) => <button key={l.id} type="button" data-wt-item className="wt-chip" onMouseDown={keep} onClick={() => tools.run('translate', l.id)}>{t(l.label)}</button>)}
        </div>
      )}
      {state.mode === 'working' && (
        <div className="wt-working" role="status"><Sparkle size={16} /><span className="shimmer">{t({ fr: 'Gemini réécrit', en: 'Gemini is rewriting' })}</span></div>
      )}
      {state.mode === 'preview' && (
        <div className="wt-result" aria-live="polite">
          <div className="wt-head"><Sparkle size={16} /><span className="wt-title">{t(heading)}</span><IconButton icon="close" size={28} label={t({ fr: 'Fermer', en: 'Close' })} onMouseDown={keep} onClick={() => tools.close(true)} /></div>
          <div className="wt-text">{state.result}</div>
          <div className="wt-actions">
            <Button data-wt-primary data-wt-item variant="gemini" size="s" onMouseDown={keep} onClick={tools.replace}>{t({ fr: 'Remplacer', en: 'Replace' })}</Button>
            {(state.variants ?? 1) > 1 && <Button data-wt-item size="s" icon="refresh" onMouseDown={keep} onClick={tools.again}>{t({ fr: 'Réessayer', en: 'Try again' })}</Button>}
            <Button data-wt-item size="s" onMouseDown={keep} onClick={tools.back}>{t({ fr: 'Autres options', en: 'Other options' })}</Button>
          </div>
        </div>
      )}
      {state.mode === 'none' && (
        <div className="wt-result" role="status">
          <div className="wt-head"><Sparkle size={16} /><span className="wt-line">{state.message}</span></div>
          <div className="wt-actions">
            <Button data-wt-primary data-wt-item size="s" onMouseDown={keep} onClick={tools.back}>{t({ fr: 'Autres options', en: 'Other options' })}</Button>
            <Button data-wt-item size="s" onMouseDown={keep} onClick={() => tools.close(true)}>{t({ fr: 'Fermer', en: 'Close' })}</Button>
          </div>
        </div>
      )}
      {state.mode === 'undo' && (
        <div className="wt-undo" role="status">
          <span>{t({ fr: 'Texte remplacé', en: 'Text replaced' })}</span>
          <Button data-wt-primary data-wt-item size="s" icon="undo" onMouseDown={keep} onClick={tools.undo}>{t({ fr: 'Annuler', en: 'Undo' })}</Button>
          <IconButton data-wt-item icon="close" size={28} label={t({ fr: 'Fermer', en: 'Close' })} onMouseDown={keep} onClick={() => tools.close(true)} />
        </div>
      )}
    </div>, document.body)
}
