/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Autosizing text input with the @ mention list. People are written @Name here, and stored as @[Name](id) on send.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { useT } from '../i18n'
import { GEMINI_ID, personById, useStore } from '../store'
import { Avatar, Sparkle } from '../ui/kit'
import { normalize } from './gemini'
import { useWritingTools, WritingPanel } from './WritingTools'

interface Props {
  pid: string
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onEscape?: () => void
  label: string
  placeholder: string
  autoFocus?: boolean
  inputRef?: RefObject<HTMLTextAreaElement | null>
}

function queryAt(value: string, caret: number) {
  const m = value.slice(0, caret).match(/(?:^|[\s(])@([\p{L}\p{N}._-]*)$/u)
  return m ? { query: m[1], start: caret - m[1].length - 1 } : null
}

/** Draws the text; while Gemini works, the range it's rewriting shimmers. Offsets stay those of the textarea. */
function renderMirror(pieces: (string | { m: string })[] | null, shimmer: [number, number] | null) {
  if (!pieces) return null
  let at = 0
  return pieces.flatMap((x, i) => {
    const text = typeof x === 'string' ? x : x.m
    const from = at; at += text.length
    const cls = typeof x === 'string' ? '' : 'mi-mention'
    const wrap = (t: string, k: string, extra = '') => (cls || extra ? <span key={k} className={`${cls} ${extra}`.trim()}>{t}</span> : t)
    if (!shimmer || shimmer[1] <= from || shimmer[0] >= at) return [wrap(text, `${i}`)]
    const a = Math.max(shimmer[0], from) - from; const z = Math.min(shimmer[1], at) - from
    return [wrap(text.slice(0, a), `${i}a`), wrap(text.slice(a, z), `${i}b`, 'mi-shimmer'), wrap(text.slice(z), `${i}c`)].filter((p) => p !== '')
  })
}

export function MentionInput({ pid, value, onChange, onSubmit, onEscape, label, placeholder, autoFocus, inputRef }: Props) {
  const t = useT()
  const own = useRef<HTMLTextAreaElement>(null)
  const ref = inputRef ?? own
  const mirror = useRef<HTMLDivElement>(null)
  const [caret, setCaret] = useState(0)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [active, setActive] = useState(0)
  const pendingCaret = useRef<number | null>(null)
  const memberIds = useStore((s) => s.projects.find((p) => p.id === pid)?.memberIds)
  const viewerId = useStore((s) => s.viewerId)
  const listId = useRef(`mentions-${Math.random().toString(36).slice(2, 7)}`).current

  const known = useMemo(() => [GEMINI_ID, ...(memberIds ?? []).filter((id) => id !== GEMINI_ID)].map(personById), [memberIds])
  const found = queryAt(value, caret)
  const options = useMemo(() => {
    if (!found) return []
    const q = normalize(found.query)
    return known
      .filter((p) => p.id !== viewerId)
      .filter((p) => !q || normalize(p.name).split(/\s+/).some((w) => w.startsWith(q)) || normalize(p.name).startsWith(q))
      .slice(0, 8)
  }, [found?.query, known, viewerId]) // eslint-disable-line
  const menuOpen = focused && !dismissed && !!found && options.length > 0
  const current = Math.min(active, Math.max(0, options.length - 1))

  const tools = useWritingTools({ pid, value, onChange, input: ref, blocked: menuOpen })
  const open = tools.state

  useEffect(() => { setActive(0) }, [found?.query])
  useEffect(() => { if (autoFocus) ref.current?.focus() }, [autoFocus, ref])
  // after any value change (typed or set from outside), follow the real caret so the list opens or closes correctly
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (pendingCaret.current != null) { el.setSelectionRange(pendingCaret.current, pendingCaret.current); pendingCaret.current = null }
    setCaret(el.selectionStart ?? value.length)
  }, [value, ref])

  const insert = (id: string) => {
    if (!found) return
    const person = personById(id)
    const text = `@${person.name} `
    const end = found.start + 1 + found.query.length
    pendingCaret.current = found.start + text.length
    onChange(value.slice(0, found.start) + text + value.slice(end))
    setDismissed(false)
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return
    if (open) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); tools.close(); return }
      // the arrows without Shift, or Tab, go to the tools. With Shift they keep extending the selection.
      if ((e.key === 'Tab' || e.key === 'ArrowDown') && !e.shiftKey && open.mode !== 'working') {
        e.preventDefault()
        const from = document.querySelector('.wt-panel')
        ;(from?.querySelector<HTMLElement>('[data-wt-primary]') ?? from?.querySelector<HTMLElement>('.wt-chip') ?? from?.querySelector<HTMLElement>('[data-wt-item]'))?.focus()
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) tools.close() // sending with the tools open just sends
    }
    if (menuOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((current + 1) % options.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((current - 1 + options.length) % options.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insert(options[current].id); return }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setDismissed(true); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); return }
    if (e.key === 'Escape') onEscape?.()
  }

  // the readable mentions are shown in blue by a mirror behind the (transparent) text of the textarea
  const pieces = useMemo(() => {
    if (!value) return null
    const names = known.flatMap((p) => [p.name, p.name.split(/\s+/)[0]]).sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const re = new RegExp(`(^|[\\s(])(@(?:${names.join('|')}))(?![\\p{L}\\p{N}_])`, 'giu')
    const out: (string | { m: string })[] = []
    let last = 0
    for (const m of value.matchAll(re)) {
      const at = m.index + m[1].length
      if (at > last) out.push(value.slice(last, at))
      out.push({ m: m[2] })
      last = at + m[2].length
    }
    if (last < value.length) out.push(value.slice(last))
    return out
  }, [value, known])

  return (
    <div className="mi">
      {menuOpen && (
        <ul className="mention-menu" id={listId} role="listbox" aria-label={t({ fr: 'Mentionner', en: 'Mention' })}>
          {options.map((p, i) => (
            <li key={p.id} id={`${listId}-${i}`} role="option" aria-selected={i === current} className={i === current ? 'active' : ''}
              onMouseDown={(e) => { e.preventDefault(); insert(p.id) }} onMouseEnter={() => setActive(i)}>
              <Avatar person={p} size={28} status />
              <span className="mention-name">{p.name}</span>
              <span className="mention-hint">{p.id === GEMINI_ID ? t({ fr: 'L’IA du projet', en: 'Project AI' }) : t(p.title)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mi-stack">
        <div ref={mirror} className="mi-mirror" aria-hidden="true">
          {renderMirror(pieces, open?.mode === 'working' ? [open.start, open.end] : null)}
          {'​'}
        </div>
        <textarea
          ref={ref}
          className={`mi-input${open?.mode === 'working' ? ' working' : ''}`}
          rows={1}
          value={value}
          placeholder={placeholder}
          aria-label={label}
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? listId : undefined}
          aria-activedescendant={menuOpen ? `${listId}-${current}` : undefined}
          onChange={(e) => { setDismissed(false); setCaret(e.target.selectionStart ?? 0); onChange(e.target.value) }}
          onSelect={(e) => { setCaret(e.currentTarget.selectionStart ?? 0); tools.onSelect() }}
          onPointerDown={tools.onPointerDown}
          onKeyDown={onKey}
          onFocus={() => { setFocused(true); setDismissed(false) }}
          onBlur={() => setFocused(false)}
          onScroll={(e) => { if (mirror.current) mirror.current.scrollTop = e.currentTarget.scrollTop }}
        />
      </div>
      {tools.canWhole && (
        <button type="button" className={`wt-spark${open?.whole ? ' on' : ''}`} aria-label={t({ fr: 'Réécrire avec Gemini', en: 'Rewrite with Gemini' })} title={t({ fr: 'Réécrire avec Gemini', en: 'Rewrite with Gemini' })}
          aria-expanded={!!open} onMouseDown={(e) => e.preventDefault()} onClick={tools.openWhole}><Sparkle size={18} /></button>
      )}
      <WritingPanel tools={tools} input={ref} mirror={mirror} />
    </div>
  )
}
