/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, Icon, IconButton } from '../ui/kit'
import { Logo } from '../ui/Logo'
import { inProject, openSpaceOf, spacesOf, useStore } from '../store'
import { useT } from '../i18n'
import { TryPanel } from './TryPanel'
import { projectStatus, useNeeds } from '../home/needs'

export function ProjectsRail({ drawer, onCloseDrawer }: { drawer?: boolean; onCloseDrawer?: () => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const projects = useStore((s) => s.projects)
  const activeId = useStore((s) => s.activeProjectId)
  const viewerId = useStore((s) => s.viewerId)
  const select = useStore((s) => s.selectProject)
  const home = useStore((s) => s.home)
  const goHome = useStore((s) => s.goHome)
  const needs = useNeeds().count
  const live = useStore((s) => s.call?.projectId)
  const spaceOpen = useStore((s) => s.spaceOpen)
  const setSpace = useStore((s) => s.setSpace)
  const [create, setCreate] = useState(false)
  const mine = projects.filter((p) => inProject(p, viewerId))
  const head = useRef<HTMLDivElement>(null)
  // Opening the drawer moves the keyboard into it; closing gives the focus back to what opened it.
  useEffect(() => {
    if (!drawer) return
    const prev = document.activeElement as HTMLElement | null
    head.current?.querySelector('button')?.focus()
    const behind = [...document.querySelectorAll<HTMLElement>('.topbar,.project-bar,.app-main>:not(.rail):not(.drawer-scrim)')]
    for (const el of behind) el.inert = true
    return () => { for (const el of behind) el.inert = false; prev?.focus?.() }
  }, [drawer])
  return (
    // A tap on anything that goes somewhere closes the drawer.
    <nav className="rail" aria-label={t({ fr: 'Projets', en: 'Projects' })} onClickCapture={(e) => { if (drawer && (e.target as HTMLElement).closest('.rail-item,.compose,.try li button')) onCloseDrawer?.() }}>
      <div ref={head} className="rail-drawer-head">
        <Logo size={26} /><span className="wordmark">One Place</span>
        <IconButton icon="close" label={t({ fr: 'Fermer', en: 'Close' })} onClick={onCloseDrawer} />
      </div>
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
          // with threads under it, the open thread carries the highlight, the project only its weight
          const parent = on && spacesOf(p, viewerId).length > 0
          return (
            <li key={p.id}>
              <button type="button" className={`rail-item${on ? ' on' : ''}${parent ? ' parent' : ''}${p.unread ? ' unread' : ''}`} aria-current={on ? 'page' : undefined} onClick={() => select(p.id)} title={name}>
                <span className="rail-icon" style={{ color: p.color }}><Icon name={p.icon} fill={on} />{p.unread > 0 && <span className="rail-badge" aria-hidden="true" />}</span>
                <span className="rail-label rail-text">
                  <span className="rail-name">{name}</span>
                  <span className="rail-sub">{projectStatus(p, viewerId, lang)}</span>
                </span>
                {live === p.id && <Icon name="call" size={16} className="rail-live" />}
                {p.unread > 0 && <span className="rail-count rail-label">{p.unread}<span className="sr-only"> {t({ fr: 'non lus', en: 'unread' })}{p.mentions > 0 ? t({ fr: `, ${p.mentions} mentions`, en: `, ${p.mentions} ${p.mentions === 1 ? 'mention' : 'mentions'}` }) : ''}</span></span>}
              </button>
              {on && spacesOf(p, viewerId).length > 0 && (() => {
                // The project's threads, under it like folders: the whole team, then each sub-team the viewer is in.
                const open = openSpaceOf(p, viewerId, spaceOpen[p.id])
                const rows = [...(p.memberIds.includes(viewerId) ? [null] : []), ...spacesOf(p, viewerId)]
                return (
                  <ul className="rail-spaces" aria-label={t({ fr: `Fils de ${name}`, en: `Threads in ${name}` })}>
                    {rows.map((sp) => {
                      const here = (open?.id ?? null) === (sp?.id ?? null)
                      const label = sp ? t(sp.name) : t({ fr: 'Toute l’équipe', en: 'Whole team' })
                      return (
                        <li key={sp?.id ?? 'team'}>
                          <button type="button" className={`rail-item rail-space${here ? ' here' : ''}${sp ? ` ${sp.kind}` : ''}`} aria-current={here ? 'true' : undefined}
                            title={sp ? t(sp.description) : t({ fr: 'Le fil de toute l’équipe', en: 'The whole team’s thread' })} onClick={() => setSpace(sp?.id ?? null)}>
                            <span className="rail-icon"><Icon name={sp ? sp.icon : 'groups'} size={18} fill={here} /></span>
                            <span className="rail-label rail-name">{label}</span>
                            {sp?.kind === 'partner' && <span className="rail-label rail-space-tag">{t({ fr: 'Partagé', en: 'Shared' })}</span>}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )
              })()}
            </li>
          )
        })}
      </ul>
      <button type="button" className="compose" onClick={() => setCreate(true)}>
        <Icon name="add" size={20} /><span className="rail-label">{t({ fr: 'Nouveau projet', en: 'New project' })}</span>
      </button>
      <TryPanel />
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
