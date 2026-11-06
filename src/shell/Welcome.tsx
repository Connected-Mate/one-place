/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
import { useEffect, useState } from 'react'
import { Button, Dialog } from '../ui/kit'
import { APP_NAME, WorkspaceIcon, type WorkspaceApp } from '../ui/WorkspaceIcon'
import { Logo } from '../ui/Logo'
import { useT } from '../i18n'

const APPS: WorkspaceApp[] = ['gmail', 'chat', 'calendar', 'meet', 'docs', 'sheets', 'slides', 'drive', 'tasks', 'keep']

export function Welcome({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [merged, setMerged] = useState(false)
  useEffect(() => {
    // Wait for the loading logo to leave (about 1.6 s after page load), or the merge plays unseen behind it.
    const splashLeft = Math.max(0, 1600 - performance.now())
    const x = setTimeout(() => setMerged(true), splashLeft + 1800)
    return () => clearTimeout(x)
  }, [])
  const mid = (APPS.length - 1) / 2
  return (
    <Dialog
      width={620}
      onClose={onClose}
      title={t({ fr: 'Et si c’était le dernier endroit où travailler ?', en: 'What if this was the last place you work?' })}
      footer={<Button variant="filled" data-autofocus onClick={onClose}>{t({ fr: 'Entrer', en: 'Step in' })}</Button>}
    >
      <div className={`wel-stage${merged ? ' merged' : ''}`} aria-hidden="true">
        <ul className="wel-apps">
          {APPS.map((a, i) => (
            <li key={a} style={{ '--i': i - mid, '--d': `${Math.abs(i - mid) * 45}ms` } as React.CSSProperties}>
              <span className="wel-app"><WorkspaceIcon app={a} size={32} /></span>
              <span className="wel-app-name">{APP_NAME[a]}</span>
            </li>
          ))}
        </ul>
        <div className="wel-one"><Logo size={56} /><span>One Place</span></div>
      </div>
      <p className="wel-lead">{t({
        fr: 'Gmail, Chat, Calendar, Meet, Docs, Sheets, Slides, Drive, Tasks et Keep fusionnent en un seul endroit, avec Gemini partout.',
        en: 'Gmail, Chat, Calendar, Meet, Docs, Sheets, Slides, Drive, Tasks and Keep merge into one place, with Gemini throughout.',
      })}</p>
      <p className="wel-body">{t({
        fr: 'Concentrons-nous sur l’humain, pas sur l’IA. L’IA est partout pour nous rendre du temps pour ce qui compte : les relations, les discussions, les idées.',
        en: 'Let’s focus on humans, not on AI. AI is everywhere so we can spend more time on what matters: relationships, conversations, ideas.',
      })}</p>
      <p className="wel-note">{t({ fr: 'Démo d’interface, tout est simulé. Un concept d’', en: 'An interface demo, everything is simulated. A concept by ' })}<a href="https://www.linkedin.com/in/alex-cormeraie/" target="_blank" rel="noopener">Alexandre Cormeraie</a>{t({ fr: '. Pas un produit Google.', en: '. Not a Google product.' })}</p>
    </Dialog>
  )
}
