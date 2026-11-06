import { Icon } from '../ui/kit'
import { useStore } from '../store'
import { useT } from '../i18n'
import type { MobilePane } from '../data/types'

export function MobileNav() {
  const t = useT()
  const cur = useStore((s) => s.mobilePane)
  const set = useStore((s) => s.setMobilePane)
  const items: { id: MobilePane; icon: string; label: { fr: string; en: string } }[] = [
    { id: 'projects', icon: 'folder', label: { fr: 'Projets', en: 'Projects' } },
    { id: 'chat', icon: 'chat_bubble', label: { fr: 'Chat', en: 'Chat' } },
    { id: 'pane', icon: 'dashboard', label: { fr: 'Tableau', en: 'Board' } },
  ]
  return (
    <nav className="mobile-nav" aria-label={t({ fr: 'Navigation', en: 'Navigation' })}>
      {items.map((i) => (
        <button key={i.id} type="button" className={cur === i.id ? 'on' : ''} aria-current={cur === i.id ? 'page' : undefined} onClick={() => set(i.id)}>
          <span className="pill"><Icon name={i.icon} fill={cur === i.id} /></span>
          {t(i.label)}
        </button>
      ))}
    </nav>
  )
}
