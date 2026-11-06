import { useState } from 'react'
import { Icon, IconButton } from '../ui/kit'
import { ME_ID, useProject, useStore } from '../store'
import { startCall } from '../call/callActions'
import { useT } from '../i18n'

/** The five things that make the concept click. Each row takes you straight there. */
export function TryPanel() {
  const t = useT()
  const done = useStore((s) => s.tourDone)
  const project = useProject()
  const [open, setOpenState] = useState(() => { try { return localStorage.getItem('one-place-try') !== 'min' } catch { return true } })
  const setOpen = (v: boolean) => { setOpenState(v); try { localStorage.setItem('one-place-try', v ? 'open' : 'min') } catch { /* private mode */ } }
  const s = useStore.getState()
  // From Home the composer is still hidden at this point: wait for the frame that shows it, or it can't take focus.
  const compose = (text: string) => requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('oneplace:compose', { detail: { text } })))
  const steps = [
    { id: 'gemini', icon: 'alternate_email', l: { fr: 'Demande quelque chose à @Gemini', en: 'Ask @Gemini for something' }, run: () => { s.setMobilePane('chat'); compose('@') } },
    { id: 'private', icon: 'lock', l: { fr: 'Envoie un message privé dans le fil', en: 'Send a private message in the thread' }, run: () => { s.setMobilePane('chat'); s.setPrivateTo(project.memberIds.find((m) => m !== s.viewerId) ?? null); compose('') } },
    { id: 'proposal', icon: 'how_to_vote', l: { fr: 'Valide une proposition', en: 'Approve a proposal' }, run: () => {
      const m = [...project.messages].reverse().find((x) => x.kind === 'proposal' && x.status === 'pending')
      s.setMobilePane('chat')
      if (m) s.focusMessage(m.id); else s.toast({ text: { fr: 'Aucune proposition en attente ici.', en: 'No pending proposal here.' } })
    } },
    { id: 'call', icon: 'call', l: { fr: 'Lance un appel et raccroche', en: 'Start a call, then hang up' }, run: () => startCall(project.id) },
    { id: 'viewas', icon: 'visibility', l: s.viewerId === ME_ID ? { fr: 'Regarde avec les yeux de Tom', en: 'See it through Tom’s eyes' } : { fr: 'Reviens à Alex', en: 'Back to Alex’s view' }, run: () => s.setViewer(s.viewerId === ME_ID ? 'tom' : ME_ID) },
  ]
  const count = steps.filter((x) => done.includes(x.id)).length
  if (!open) {
    return (
      <button type="button" className="try-fab" onClick={() => setOpen(true)} aria-label={t({ fr: 'Ouvrir le parcours', en: 'Open the tour' })}>
        <Icon name="flag" size={18} /> {count}/{steps.length}
      </button>
    )
  }
  return (
    <aside className="try" aria-label={t({ fr: 'À essayer', en: 'Things to try' })}>
      <header>
        <strong>{t({ fr: 'À essayer', en: 'Things to try' })}</strong>
        <span className="try-count">{count}/{steps.length}</span>
        <IconButton icon="close" size={28} label={t({ fr: 'Réduire', en: 'Minimize' })} onClick={() => setOpen(false)} />
      </header>
      <ul>
        {steps.map((x) => {
          const on = done.includes(x.id)
          return (
            <li key={x.id}>
              <button type="button" className={on ? 'on' : ''} onClick={x.run}>
                <Icon name={on ? 'check_circle' : x.icon} fill={on} size={18} />
                <span>{t(x.l)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
