/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
import { useEffect, useState } from 'react'
import { Button, Dialog, Icon, Sparkle } from '../ui/kit'
import { Logo } from '../ui/Logo'
import { useT } from '../i18n'

const OLD = [
  { icon: 'mail', l: { fr: 'Boîte mail', en: 'Inbox' } },
  { icon: 'forum', l: { fr: 'Chats', en: 'Chats' } },
  { icon: 'description', l: { fr: 'Documents', en: 'Docs' } },
  { icon: 'folder_open', l: { fr: 'Drive', en: 'Drive' } },
  { icon: 'videocam', l: { fr: 'Visio', en: 'Video calls' } },
  { icon: 'checklist', l: { fr: 'Tâches', en: 'Tasks' } },
  { icon: 'calendar_month', l: { fr: 'Agenda', en: 'Calendar' } },
  { icon: 'smart_toy', l: { fr: 'Dix agents IA', en: 'Ten AI agents' } },
]

export function Welcome({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [gone, setGone] = useState(false)
  useEffect(() => { const x = setTimeout(() => setGone(true), 700); return () => clearTimeout(x) }, [])
  return (
    <Dialog
      width={640}
      onClose={onClose}
      title={<span className="wel-title"><Logo size={36} /> One Place</span>}
      footer={<Button variant="filled" data-autofocus onClick={onClose}>{t({ fr: 'Entrer', en: 'Step in' })}</Button>}
    >
      <p className="wel-lead">{t({ fr: 'Et si c’était la dernière appli ?', en: 'What if this was the last app?' })}</p>
      <ul className={`wel-apps${gone ? ' gone' : ''}`} aria-label={t({ fr: 'Ce que ça remplace', en: 'What it replaces' })}>
        {OLD.map((a, i) => <li key={a.icon} style={{ transitionDelay: `${i * 70}ms` }}><Icon name={a.icon} size={18} />{t(a.l)}</li>)}
      </ul>
      <p className="wel-body">{t({
        fr: 'Un projet, c’est un chat et une vue partagée. Tout se passe là : les messages, les mails qui arrivent, les documents, les appels. Une seule IA, que tu appelles avec @.',
        en: 'A project is one chat and one shared view. Everything happens there: messages, incoming email, documents, calls. One AI, called with @.',
      })}</p>
      <p className="wel-note"><Sparkle size={16} /> <span>{t({
        fr: 'Une démo d’interface : tout est simulé, rien n’est envoyé, aucun compte. Un concept d’',
        en: 'An interface demo: everything is simulated, nothing is sent, no account. A concept by ',
      })}<a href="https://www.linkedin.com/in/alex-cormeraie/" target="_blank" rel="noopener">Alexandre Cormeraie</a>{t({ fr: '. Pas un produit Google.', en: '. Not a Google product.' })}</span></p>
    </Dialog>
  )
}
