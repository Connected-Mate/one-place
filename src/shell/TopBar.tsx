import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, Button, Icon, IconButton, Menu, Sparkle } from '../ui/kit'
import { Logo } from '../ui/Logo'
import { askGemini } from '../chat/gemini'
import { canSee, ME_ID, personById, useStore, useViewer } from '../store'
import { tx, useT } from '../i18n'
import type { Message } from '../data/types'

type Hit = { key: string; icon: string; title: string; sub: string; run: () => void }

const plain = (s: string) => s.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1').replace(/\*\*/g, '')
const msgText = (m: Message, l: 'fr' | 'en') => {
  switch (m.kind) {
    case 'text': case 'system': return tx(m.text, l)
    case 'email': return `${tx(m.subject, l)} ${tx(m.body, l)}`
    case 'meeting': case 'proposal': return tx(m.title, l)
    case 'call-summary': return `${tx(m.title, l)} ${tx(m.summary, l)}`
    case 'file': return tx(m.text, l)
  }
}

function Search({ lead, trail }: { lead?: React.ReactNode; trail?: React.ReactNode }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const projects = useStore((s) => s.projects)
  const viewerId = useStore((s) => s.viewerId)
  const activeId = useStore((s) => s.activeProjectId)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const wrap = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); setOpen(true) } }
    const down = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('keydown', key); document.addEventListener('mousedown', down)
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('mousedown', down) }
  }, [])

  const hits = useMemo<Hit[]>(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    const out: Hit[] = []
    const st = useStore.getState
    for (const p of projects.filter((x) => x.memberIds.includes(viewerId))) {
      const pn = tx(p.name, lang)
      for (const a of p.artifacts) if (tx(a.title, lang).toLowerCase().includes(s)) {
        out.push({ key: a.id, icon: { doc: 'description', sheet: 'table_chart', slides: 'slideshow', pdf: 'picture_as_pdf' }[a.kind], title: tx(a.title, lang), sub: pn, run: () => { st().selectProject(p.id); st().setPane({ type: 'artifact', id: a.id }) } })
      }
      for (const b of p.blocks) if (b.type === 'todo') for (const x of b.todos) if (tx(x.text, lang).toLowerCase().includes(s)) {
        out.push({ key: x.id, icon: 'task_alt', title: tx(x.text, lang), sub: pn, run: () => { st().selectProject(p.id); st().setPane({ type: 'board' }) } })
      }
      for (const m of p.messages) {
        if (!canSee(m.visibility, viewerId)) continue // private stays private, in search too
        const body = plain(msgText(m, lang))
        if (body.toLowerCase().includes(s)) out.push({ key: m.id, icon: m.kind === 'email' ? 'mail' : m.visibility.type === 'private' ? 'lock' : 'chat_bubble', title: body.slice(0, 90), sub: `${personById(m.authorId).name} · ${pn}`, run: () => { st().selectProject(p.id); st().setMobilePane('chat'); st().focusMessage(m.id) } })
      }
    }
    return out.slice(0, 7)
  }, [q, projects, lang, viewerId])

  const ask = () => { askGemini(activeId, `@[Gemini](gemini) ${q.trim()}`); useStore.getState().setMobilePane('chat') }
  const total = hits.length + 1
  const go = (i: number) => {
    if (i < hits.length) hits[i].run(); else ask()
    setOpen(false); setQ('')
  }
  const showPanel = open && q.trim().length >= 2

  return (
    <form ref={wrap} className={`search${showPanel ? ' open' : ''}`} role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 2) go(sel) }}>
      {lead}
      <Icon name="search" className="search-icon" />
      <input
        ref={input} value={q} aria-label={t({ fr: 'Rechercher', en: 'Search' })}
        placeholder={t({ fr: 'Rechercher partout, ou demander à Gemini', en: 'Search or ask Gemini' })}
        onChange={(e) => { setQ(e.target.value); setSel(0); setOpen(true) }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setOpen(false); input.current?.blur() }
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel((x) => (x + 1) % total) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSel((x) => (x - 1 + total) % total) }
        }}
      />
      {q ? <IconButton icon="close" size={32} label={t({ fr: 'Effacer', en: 'Clear' })} onClick={() => { setQ(''); input.current?.focus() }} /> : <kbd className="search-kbd" aria-hidden="true">{navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl K'}</kbd>}
      {!q && trail}
      {showPanel && (
        <div className="search-panel">
          <ul role="listbox" aria-label={t({ fr: 'Résultats', en: 'Results' })}>
            {hits.map((h, i) => (
              <li key={h.key} role="option" aria-selected={sel === i}>
                <button type="button" className={`search-hit${sel === i ? ' on' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => go(i)}>
                  <Icon name={h.icon} /><span className="hit-main"><span className="hit-title">{h.title}</span><span className="hit-sub">{h.sub}</span></span>
                </button>
              </li>
            ))}
            {!hits.length && <li className="search-none">{t({ fr: 'Rien dans tes projets.', en: 'Nothing in your projects.' })}</li>}
            <li role="option" aria-selected={sel === hits.length}>
              <button type="button" className={`search-hit ask${sel === hits.length ? ' on' : ''}`} onMouseEnter={() => setSel(hits.length)} onClick={() => go(hits.length)}>
                <Sparkle /><span className="hit-main"><span className="hit-title">{t({ fr: 'Demander à Gemini', en: 'Ask Gemini' })}: {q.trim()}</span></span>
              </button>
            </li>
          </ul>
        </div>
      )}
    </form>
  )
}

export const PERSONAS = [
  { id: ME_ID, role: { fr: 'Responsable du projet', en: 'Project owner' }, hint: { fr: 'Décide', en: 'Decides' } },
  { id: 'tom', role: { fr: 'Membre', en: 'Member' }, hint: { fr: 'Propose', en: 'Proposes' } },
  { id: 'nora', role: { fr: 'Invitée à un appel', en: 'Guest on one call' }, hint: { fr: 'Appel seul', en: 'Call only' } },
]

export function TopBar({ onAbout, onMenu }: { onAbout: () => void; onMenu: () => void }) {
  const t = useT()
  const viewer = useViewer()
  const theme = useStore((s) => s.theme)
  const s = useStore.getState()
  return (
    <header className="topbar">
      <div className="brand">
        <span className="only-wide"><IconButton icon="menu" size={36} label={t({ fr: 'Réduire les projets', en: 'Collapse projects' })} onClick={() => s.toggleRail()} /></span>
        <span className="only-tablet"><IconButton icon="menu" label={t({ fr: 'Ouvrir les projets', en: 'Open projects' })} onClick={onMenu} /></span>
        <button type="button" className="brand-home" onClick={() => s.goHome()} aria-label={t({ fr: 'One Place, accueil', en: 'One Place, home' })}>
          <Logo size={26} />
          <span className="wordmark">One Place</span>
        </button>
        <button type="button" className="concept" onClick={onAbout} title={t({ fr: 'À propos de ce concept', en: 'About this concept' })}><span>{t({ fr: 'Concept', en: 'Concept' })}</span></button>
      </div>
      <Search
        lead={<button type="button" className="search-lead" onClick={() => s.goHome()} aria-label={t({ fr: 'One Place, accueil', en: 'One Place, home' })}><Logo size={24} /></button>}
        trail={<button type="button" className="search-you" onClick={() => s.setMobilePane('you')} aria-label={t({ fr: 'Votre compte et les réglages', en: 'You and settings' })}><Avatar person={viewer} size={32} /></button>}
      />
      <div className="top-actions">
        {viewer.id !== ME_ID && (
          <Button size="s" variant="tonal" icon="visibility" className="viewing" onClick={() => s.setViewer(ME_ID)} title={t({ fr: 'Revenir à Alex', en: 'Back to Alex' })}>
            {t({ fr: 'Vu par', en: 'Viewing as' })} {viewer.name.split(' ')[0]}
          </Button>
        )}
        <Menu
          align="right"
          items={[
            { label: <span className="menu-section">{t({ fr: 'Voir la démo en tant que', en: 'View the demo as' })}</span>, disabled: true },
            ...PERSONAS.map((p) => ({ icon: <Avatar id={p.id} size={28} />, label: <span className="persona"><strong>{personById(p.id).name}</strong><small>{t(p.role)}</small></span>, selected: viewer.id === p.id, onSelect: () => s.setViewer(p.id) })),
            { divider: true, label: '' },
            { icon: 'info', label: t({ fr: 'À propos de ce concept', en: 'About this concept' }), onSelect: onAbout },
            { divider: true, label: '' },
            { icon: 'brightness_auto', label: t({ fr: 'Thème automatique', en: 'Automatic theme' }), selected: theme === 'auto', onSelect: () => s.setTheme('auto') },
            { icon: 'light_mode', label: t({ fr: 'Clair', en: 'Light' }), selected: theme === 'light', onSelect: () => s.setTheme('light') },
            { icon: 'dark_mode', label: t({ fr: 'Sombre', en: 'Dark' }), selected: theme === 'dark', onSelect: () => s.setTheme('dark') },
            { divider: true, label: '' },
            { icon: 'restart_alt', label: t({ fr: 'Remettre la démo à zéro', en: 'Reset the demo' }), onSelect: () => { s.reset(); s.toast({ text: { fr: 'Démo remise à zéro.', en: 'Demo reset.' }, icon: 'restart_alt' }) } },
          ]}
          trigger={(p) => <IconButton icon="settings" size={36} label={t({ fr: 'Réglages', en: 'Settings' })} {...p} />}
        />
        <span className="me"><Avatar person={viewer} size={28} /></span>
      </div>
    </header>
  )
}
