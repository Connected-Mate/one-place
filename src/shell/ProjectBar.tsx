/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The top of a project under 900px, where the chat and the board take turns: phone and portrait tablet.
// On a phone it replaces the whole top bar, with a back arrow to the list, like a space in the Google Chat app.
import { useCallback, useEffect, useState } from 'react'
import { startCall } from '../call/callActions'
import { tx, useT } from '../i18n'
import { canSee, GEMINI_ID, mobileView, openSpaceOf, roleIn, useProject, useStore } from '../store'
import { Button, Icon, IconButton, Menu } from '../ui/kit'
import { openPeople } from '../home/goTo'
import { copyProjectAddress, InviteDialog } from '../chat/Invite'

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function CallTime({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const x = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(x) }, [])
  return <span className="pb-time">{mmss(now - since)}</span>
}

export function ProjectBar() {
  const t = useT()
  const project = useProject()
  const view = useStore(mobileView)
  const viewerId = useStore((s) => s.viewerId)
  const paneType = useStore((s) => s.panes[s.activeProjectId]?.type)
  const call = useStore((s) => s.call)
  const chosenSpace = useStore((st) => st.spaceOpen[st.activeProjectId])
  const s = useStore.getState()
  if (!project) return null
  const callHere = !!call && call.projectId === project.id
  const onCallTab = view === 'pane' && callHere && paneType === 'call'
  const tab = onCallTab ? 'call' : view === 'pane' ? 'board' : 'chat'
  const role = roleIn(project, viewerId)
  const peopleCount = project.memberIds.filter((id) => id !== GEMINI_ID).length
  const space = openSpaceOf(project, viewerId, chosenSpace)
  const roleLabel = space
    ? `${tx(space.name, 'en')} · ${space.kind === 'confidential' ? 'confidential' : role === 'partner' ? 'you see this space only' : tx(space.name, 'en') === space.org ? 'shared space' : `shared with ${space.org}`}`
    : role === 'partner' ? 'Shared space · you see this space only'
    : `${peopleCount} ${peopleCount === 1 ? 'person' : 'people'} · ${role === 'owner' ? 'you’re the owner' : role === 'member' ? 'you’re a member' : 'you’re a guest'}`
  const live = project.messages.some((m) => m.kind === 'meeting' && m.live && !m.ended && canSee(m.visibility, viewerId))
  const [inviting, setInviting] = useState(false)
  const closeInvite = useCallback(() => setInviting(false), [])
  const openBoard = () => {
    // From the call, Board means the board: the call stays alive and gets its own tab here.
    if (paneType === 'call') s.setPane({ type: 'board' }); else s.setMobilePane('pane')
  }
  return (
    <header className="project-bar">
      <div className="pb-row">
        <span className="pb-back"><IconButton icon="arrow_back" label={t({ fr: 'Retour aux projets', en: 'Back to projects' })} onClick={() => s.setMobilePane('projects')} /></span>
        <div className="pb-title">
          <h1 className="pb-name">{t(project.name)}</h1>
          <span className="pb-role">{roleLabel}</span>
        </div>
        <nav className="pb-switch" aria-label={t({ fr: 'Vue du projet', en: 'Project view' })}>
          <button type="button" className={tab === 'chat' ? 'on' : ''} aria-current={tab === 'chat' ? 'page' : undefined} onClick={() => s.setMobilePane('chat')}>
            <Icon name="chat_bubble" size={18} fill={tab === 'chat'} />{t({ fr: 'Chat', en: 'Chat' })}
          </button>
          <button type="button" className={tab === 'board' ? 'on' : ''} aria-current={tab === 'board' ? 'page' : undefined} onClick={openBoard}>
            <Icon name={role === 'partner' ? 'attach_file' : 'dashboard'} size={18} fill={tab === 'board'} />{role === 'partner' ? 'Files' : t({ fr: 'Board', en: 'Board' })}
          </button>
          {callHere && (
            <button type="button" className={`pb-call${tab === 'call' ? ' on' : ''}`} aria-current={tab === 'call' ? 'page' : undefined} onClick={() => s.setPane({ type: 'call' })}>
              <i className="rp-live-dot" aria-hidden="true" />{t({ fr: 'Appel', en: 'Call' })}<CallTime since={call.startedAt} />
            </button>
          )}
        </nav>
        <div className="pb-actions">
          {!callHere && role !== 'guest' && role !== 'partner' && (live
            ? <Button variant="filled" size="s" icon="videocam" onClick={() => startCall(project.id)}>{t({ fr: 'Rejoindre', en: 'Join' })}</Button>
            : <IconButton icon="videocam" label={t({ fr: 'Lancer un appel', en: 'Start a call' })} onClick={() => startCall(project.id)} />)}
          {role !== 'partner' && <Menu align="right" items={[
            { icon: 'person_add', label: t({ fr: 'Inviter', en: 'Invite' }), onSelect: () => setInviting(true) },
            { icon: 'mail', label: project.address, hint: t({ fr: 'Copier', en: 'Copy' }), onSelect: () => { void copyProjectAddress(project.address) } },
            { divider: true, label: '' },
            { icon: 'group', label: t({ fr: `${peopleCount} membres`, en: `${peopleCount} ${peopleCount === 1 ? 'member' : 'members'}` }), onSelect: () => openPeople(project.id) },
          ]} trigger={(p) => <IconButton {...p} icon="more_vert" label={t({ fr: 'Plus d’options', en: 'More options' })} />} />}
        </div>
      </div>
      {inviting && <InviteDialog project={project} onClose={closeInvite} />}
    </header>
  )
}
