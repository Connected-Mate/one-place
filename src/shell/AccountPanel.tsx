/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The account card behind the profile picture, for whoever the demo is viewed as. On a phone the same content is the You tab.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n'
import { canSee, personById, useStore, useViewer, type Theme } from '../store'
import { Avatar, Button, Icon, IconButton, Sparkle } from '../ui/kit'
import { useAgenda, whenCue } from '../home/needs'
import type { Person } from '../data/types'
import { PERSONAS } from './personas'
import './account.css'

const THEMES: { id: Theme; icon: string; l: { fr: string; en: string } }[] = [
  { id: 'auto', icon: 'brightness_auto', l: { fr: 'Auto', en: 'Auto' } },
  { id: 'light', icon: 'light_mode', l: { fr: 'Clair', en: 'Light' } },
  { id: 'dark', icon: 'dark_mode', l: { fr: 'Sombre', en: 'Dark' } },
]
const STATUSES: { id: Person['presence']; color: string; l: { fr: string; en: string } }[] = [
  { id: 'online', color: 'var(--green)', l: { fr: 'Actif', en: 'Active' } },
  { id: 'dnd', color: 'var(--red)', l: { fr: 'Ne pas déranger', en: 'Do not disturb' } },
  { id: 'away', color: 'var(--yellow)', l: { fr: 'Absent', en: 'Away' } },
]

function useGlance(viewerId: string) {
  const projects = useStore((s) => s.projects)
  const { events, now } = useAgenda()
  return useMemo(() => {
    const mine = projects.filter((p) => p.memberIds.includes(viewerId))
    const todos = mine.flatMap((p) => p.blocks.flatMap((b) => (b.type === 'todo' ? b.todos : []))).filter((x) => !x.done && x.assigneeId === viewerId).length
    // a proposal waits on the owner: that is what a member's own count shows too, those they sent
    const waiting = mine.flatMap((p) => p.messages.filter((m) => m.kind === 'proposal' && m.status === 'pending' && canSee(m.visibility, viewerId) && (p.ownerId === viewerId || m.authorId === viewerId))).length
    return { projects: mine.length, todos, waiting, next: events[0], now }
  }, [projects, viewerId, events, now])
}

/** Her own clock when we know where she is, the visitor's otherwise. */
const localTime = (zone?: string) => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', ...(zone ? { timeZone: zone } : null) })

export function AccountBody({ onAbout, onDone }: { onAbout: () => void; onDone?: () => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const viewer = useViewer()
  const theme = useStore((s) => s.theme)
  useStore((s) => s.presence)
  const s = useStore.getState()
  const glance = useGlance(viewer.id)
  const first = viewer.name.split(/\s+/)[0]
  const rows: [string, React.ReactNode][] = []
  if (!viewer.minimal) {
    rows.push([t({ fr: 'Nom', en: 'Name' }), viewer.fullName ?? viewer.name])
    rows.push([t({ fr: 'Fonction', en: 'Title' }), t(viewer.title)])
    if (viewer.company) rows.push([t({ fr: 'Entreprise', en: 'Company' }), viewer.company])
    if (viewer.team) rows.push([t({ fr: 'Équipe', en: 'Team' }), viewer.team])
    if (viewer.location) rows.push([t({ fr: 'Lieu', en: 'Location' }), viewer.location])
    rows.push([t({ fr: 'Heure locale', en: 'Local time' }), localTime(viewer.timeZone)])
    if (viewer.linkedin) rows.push(['LinkedIn', <a href={viewer.linkedin} target="_blank" rel="noopener noreferrer">{viewer.linkedin.replace(/^https:\/\/www\.linkedin\.com\/in\/|\/$/g, '')}<span className="sr-only"> (opens in a new tab)</span></a>])
  } else {
    rows.push([t({ fr: 'Fonction', en: 'Title' }), t(viewer.title)])
  }
  const signOut = () => { onDone?.(); s.setViewer(viewer.id); useStore.setState({ welcomeSeen: false }) }
  return (
    <div className="acc">
      <header className="acc-head">
        <span className="acc-ring"><Avatar person={viewer} size={76} /></span>
        <h2>{t({ fr: `Bonjour ${first} !`, en: `Hi, ${first}!` })}</h2>
        {!viewer.minimal && viewer.email && <p>{viewer.email}</p>}
        <Button variant="outlined" size="s" onClick={() => s.toast({ text: { fr: 'Simulé dans cette démo', en: 'Simulated in this demo' } })}>{t({ fr: 'Gérer votre compte', en: 'Manage your account' })}</Button>
      </header>

      <section className="acc-card" aria-labelledby="acc-profile">
        <h3 id="acc-profile">{t({ fr: 'Profil', en: 'Profile' })}</h3>
        <dl className="acc-rows">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        <div className="acc-status" role="radiogroup" aria-label={t({ fr: 'Statut', en: 'Status' })}>
          {STATUSES.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={viewer.presence === x.id} className={viewer.presence === x.id ? 'on' : ''} onClick={() => s.setPresence(viewer.id, x.id)}>
              <i style={{ background: x.color }} aria-hidden="true" />{t(x.l)}
            </button>
          ))}
        </div>
      </section>

      <section className="acc-card" aria-labelledby="acc-glance">
        <h3 id="acc-glance">{t({ fr: 'Votre espace en un coup d’œil', en: 'Workspace at a glance' })}</h3>
        <div className="acc-stats">
          <div><b>{glance.projects}</b><span>{glance.projects === 1 ? t({ fr: 'projet', en: 'project' }) : t({ fr: 'projets', en: 'projects' })}</span></div>
          <div><b>{glance.todos}</b><span>{t({ fr: 'tâches ouvertes', en: glance.todos === 1 ? 'open to-do' : 'open to-dos' })}</span></div>
          <div><b>{glance.waiting}</b><span>{t({ fr: 'propositions en attente', en: glance.waiting === 1 ? 'proposal waiting' : 'proposals waiting' })}</span></div>
        </div>
        <p className="acc-next"><Icon name="event" size={16} />{glance.next
          ? <span className="acc-next-text"><b>{t(glance.next.title)}</b> {whenCue(glance.next.start, glance.now, lang)}</span>
          : <span>{t({ fr: 'Aucune réunion à venir', en: 'No meeting coming up' })}</span>}</p>
        <div className="acc-sim">
          <span className="acc-sim-tag">{t({ fr: 'Simulé', en: 'Simulated' })}</span>
          <span className="acc-sim-line"><Sparkle size={14} />{t({ fr: 'Gemini vous a fait gagner 3 h 20 cette semaine', en: 'Gemini saved you 3 h 20 this week' })}</span>
          <span className="acc-storage" aria-hidden="true"><i /></span>
          <span className="acc-sim-line">{t({ fr: '4,2 Go sur 15 Go utilisés', en: '4.2 GB of 15 GB used' })}</span>
        </div>
      </section>

      <section className="acc-card" aria-labelledby="acc-persona">
        <h3 id="acc-persona">{t({ fr: 'Voir la démo en tant que', en: 'View the demo as' })}</h3>
        <div className="acc-list" role="radiogroup" aria-labelledby="acc-persona">
          {PERSONAS.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={viewer.id === p.id} className={viewer.id === p.id ? 'on' : ''} onClick={() => s.setViewer(p.id)}>
              <Avatar id={p.id} size={32} />
              <span className="acc-text"><strong>{personById(p.id).name}</strong><small>{t(p.role)}</small></span>
              {viewer.id === p.id && <Icon name="check" size={18} />}
            </button>
          ))}
        </div>
      </section>

      <section className="acc-card" aria-labelledby="acc-theme">
        <h3 id="acc-theme">{t({ fr: 'Apparence', en: 'Appearance' })}</h3>
        <div className="acc-status" role="radiogroup" aria-labelledby="acc-theme">
          {THEMES.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={theme === x.id} className={theme === x.id ? 'on' : ''} onClick={() => s.setTheme(x.id)}>
              <Icon name={x.icon} size={16} />{t(x.l)}
            </button>
          ))}
        </div>
      </section>

      <div className="acc-actions">
        <button type="button" onClick={() => { onDone?.(); onAbout() }}><Icon name="info" size={18} />{t({ fr: 'À propos de ce concept', en: 'About this concept' })}</button>
        <button type="button" onClick={() => { onDone?.(); s.reset(); s.toast({ text: { fr: 'Démo remise à zéro.', en: 'Demo reset.' } }) }}><Icon name="restart_alt" size={18} />{t({ fr: 'Remettre la démo à zéro', en: 'Reset the demo' })}</button>
        <button type="button" onClick={signOut}><Icon name="logout" size={18} />{t({ fr: 'Se déconnecter', en: 'Sign out' })}</button>
      </div>
      <p className="acc-foot">{t({ fr: 'Un concept. Pas un produit Google.', en: 'A concept. Not a Google product.' })}</p>
    </div>
  )
}

/** The profile picture and its card: Esc and a click outside close it, the focus goes back to the picture. */
export function AccountButton({ onAbout }: { onAbout: () => void }) {
  const t = useT()
  const viewer = useViewer()
  useStore((s) => s.presence)
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    card.current?.focus()
    const trigger = button.current
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); trigger?.focus() } }
    const down = (e: MouseEvent) => { const at = e.target as Node; if (!card.current?.contains(at) && !trigger?.contains(at)) setOpen(false) }
    document.addEventListener('keydown', key, true)
    document.addEventListener('mousedown', down)
    return () => { document.removeEventListener('keydown', key, true); document.removeEventListener('mousedown', down) }
  }, [open])
  const label = t({ fr: `Compte : ${viewer.name}`, en: `Account: ${viewer.name}` })
  return (
    <>
      <button ref={button} type="button" className="me-btn" aria-haspopup="dialog" aria-expanded={open} aria-label={label} title={label} onClick={() => setOpen((o) => !o)}>
        <Avatar person={viewer} size={32} status />
      </button>
      {open && createPortal(
        <div ref={card} className="acc-pop" role="dialog" aria-label={t({ fr: 'Votre compte', en: 'Your account' })} tabIndex={-1}>
          <span className="acc-close"><IconButton icon="close" size={32} label={t({ fr: 'Fermer', en: 'Close' })} onClick={() => { setOpen(false); button.current?.focus() }} /></span>
          <AccountBody onAbout={onAbout} onDone={() => setOpen(false)} />
        </div>, document.body)}
    </>
  )
}
