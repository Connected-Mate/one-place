import { useState } from 'react'
import { Button, Dialog, Icon } from '../ui/kit'
import { useStore } from '../store'
import { useT } from '../i18n'
import { TryPanel } from './TryPanel'
import { useNeeds } from '../home/needs'

export function ProjectsRail() {
  const t = useT()
  const projects = useStore((s) => s.projects)
  const activeId = useStore((s) => s.activeProjectId)
  const viewerId = useStore((s) => s.viewerId)
  const select = useStore((s) => s.selectProject)
  const home = useStore((s) => s.home)
  const goHome = useStore((s) => s.goHome)
  const needs = useNeeds().count
  const live = useStore((s) => s.call?.projectId)
  const [create, setCreate] = useState(false)
  const mine = projects.filter((p) => p.memberIds.includes(viewerId))
  return (
    <nav className="rail" aria-label={t({ fr: 'Projets', en: 'Projects' })}>
      <button type="button" className="compose" onClick={() => setCreate(true)}>
        <Icon name="add" size={24} /><span className="rail-label">{t({ fr: 'Nouveau projet', en: 'New project' })}</span>
      </button>
      <ul className="rail-list rail-home">
        <li>
          <button type="button" className={`rail-item${home ? ' on' : ''}${needs ? ' unread' : ''}`} aria-current={home ? 'page' : undefined} onClick={goHome} title={t({ fr: 'Accueil', en: 'Home' })}>
            <span className="rail-icon"><Icon name="home" fill={home} />{needs > 0 && <span className="rail-badge" aria-hidden="true" />}</span>
            <span className="rail-label rail-name">{t({ fr: 'Accueil', en: 'Home' })}</span>
            {needs > 0 && <span className="rail-count rail-label">{needs}<span className="sr-only"> {t({ fr: 'à traiter', en: 'need you' })}</span></span>}
          </button>
        </li>
      </ul>
      <div className="rail-head rail-label">{t({ fr: 'Projets', en: 'Projects' })}</div>
      <ul className="rail-list">
        {mine.map((p) => {
          const name = t(p.name)
          const on = !home && p.id === activeId
          return (
            <li key={p.id}>
              <button type="button" className={`rail-item${on ? ' on' : ''}${p.unread ? ' unread' : ''}`} aria-current={on ? 'page' : undefined} onClick={() => select(p.id)} title={name}>
                <span className="rail-icon" style={{ color: p.color }}><Icon name={p.icon} fill={on} />{p.unread > 0 && <span className="rail-badge" aria-hidden="true" />}</span>
                <span className="rail-label rail-name">{name}</span>
                {live === p.id && <Icon name="call" size={16} className="rail-live" />}
                {p.mentions > 0 && <span className="rail-at rail-label" aria-label={t({ fr: `${p.mentions} mentions`, en: `${p.mentions} mentions` })}>@</span>}
                {p.unread > 0 && <span className="rail-count rail-label">{p.unread}<span className="sr-only"> {t({ fr: 'non lus', en: 'unread' })}</span></span>}
              </button>
            </li>
          )
        })}
      </ul>
      <TryPanel />
      <div className="rail-foot rail-label">
        {t({ fr: 'Pas de boîte mail. Pas d’autres applis. Une seule vue.', en: 'No inbox. No other apps. One view.' })}
      </div>
      {create && <NewProject onClose={() => setCreate(false)} />}
    </nav>
  )
}

function NewProject({ onClose }: { onClose: () => void }) {
  const t = useT()
  const createProject = useStore((s) => s.createProject)
  const [name, setName] = useState('')
  const [tpl, setTpl] = useState<'blank' | 'launch' | 'event'>('launch')
  const [tried, setTried] = useState(false)
  const bad = !name.trim()
  const submit = (e?: React.FormEvent) => {
    e?.preventDefault()
    setTried(true)
    if (bad) return
    createProject(name.trim().slice(0, 80), tpl)
    onClose()
  }
  const tpls = [
    { id: 'launch' as const, icon: 'rocket_launch', l: { fr: 'Lancement', en: 'Launch' } },
    { id: 'event' as const, icon: 'event', l: { fr: 'Événement', en: 'Event' } },
    { id: 'blank' as const, icon: 'draft', l: { fr: 'Vide', en: 'Blank' } },
  ]
  return (
    <Dialog
      title={t({ fr: 'Nouveau projet', en: 'New project' })} onClose={onClose}
      footer={<><Button onClick={onClose}>{t({ fr: 'Annuler', en: 'Cancel' })}</Button><Button variant="filled" onClick={() => submit()}>{t({ fr: 'Créer', en: 'Create' })}</Button></>}
    >
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="np-name">{t({ fr: 'Nom du projet', en: 'Project name' })}</label>
          <input id="np-name" className={`input${tried && bad ? ' bad' : ''}`} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-invalid={tried && bad} />
          {tried && bad && <span className="field-err">{t({ fr: 'Donne un nom au projet.', en: 'Give the project a name.' })}</span>}
        </div>
        <div className="tpl-row" role="radiogroup" aria-label={t({ fr: 'Modèle', en: 'Template' })}>
          {tpls.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={tpl === x.id} className={`tpl${tpl === x.id ? ' on' : ''}`} onClick={() => setTpl(x.id)}>
              <Icon name={x.icon} size={24} />{t(x.l)}
            </button>
          ))}
        </div>
        <p className="np-note">{t({ fr: 'Le chat, le tableau et une adresse mail du projet sont prêts tout de suite.', en: 'The chat, the board and a project email address are ready right away.' })}</p>
      </form>
    </Dialog>
  )
}
