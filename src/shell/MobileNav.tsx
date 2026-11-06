/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
import { Icon } from '../ui/kit'
import { mobileView, useStore } from '../store'
import { useNeeds } from '../home/needs'
import { useT } from '../i18n'
import type { MobilePane } from '../data/types'

export function MobileNav() {
  const t = useT()
  const cur = useStore(mobileView)
  const set = useStore((s) => s.setMobilePane)
  const goHome = useStore((s) => s.goHome)
  const needs = useNeeds().count
  // The app's three places. Inside a project this bar steps aside: ProjectBar has the back arrow and Chat / Board.
  const items: { id: MobilePane | 'home'; icon: string; label: { fr: string; en: string } }[] = [
    { id: 'home', icon: 'home', label: { fr: 'Accueil', en: 'Home' } },
    { id: 'projects', icon: 'folder', label: { fr: 'Projets', en: 'Projects' } },
    { id: 'you', icon: 'account_circle', label: { fr: 'Vous', en: 'You' } },
  ]
  return (
    <nav className="mobile-nav" aria-label={t({ fr: 'Navigation', en: 'Navigation' })}>
      {items.map((i) => (
        <button key={i.id} type="button" className={cur === i.id ? 'on' : ''} aria-current={cur === i.id ? 'page' : undefined} onClick={() => (i.id === 'home' ? goHome() : set(i.id))}>
          <span className="pill"><Icon name={i.icon} fill={cur === i.id} />{i.id === 'home' && needs > 0 && <span className="nav-count">{needs}<span className="sr-only"> {t({ fr: 'à traiter', en: 'need you' })}</span></span>}</span>
          {t(i.label)}
        </button>
      ))}
    </nav>
  )
}
