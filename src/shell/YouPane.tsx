// The phone's third place: who you are in the demo, the theme, and the "not a Google product" framing.
import { useT } from '../i18n'
import { personById, useStore, useViewer, type Theme } from '../store'
import { Avatar, Icon } from '../ui/kit'
import { PERSONAS } from './TopBar'

const THEMES: { id: Theme; icon: string; l: { fr: string; en: string } }[] = [
  { id: 'auto', icon: 'brightness_auto', l: { fr: 'Auto', en: 'Auto' } },
  { id: 'light', icon: 'light_mode', l: { fr: 'Clair', en: 'Light' } },
  { id: 'dark', icon: 'dark_mode', l: { fr: 'Sombre', en: 'Dark' } },
]

export function YouPane({ onAbout }: { onAbout: () => void }) {
  const t = useT()
  const viewer = useViewer()
  const theme = useStore((s) => s.theme)
  const s = useStore.getState()
  return (
    <section className="pane you-pane" aria-label={t({ fr: 'Vous', en: 'You' })}>
      <div className="you-scroll">
        <header className="you-head">
          <Avatar person={viewer} size={72} />
          <h1>{viewer.name}</h1>
          <p>{viewer.email}</p>
        </header>

        <h2 className="you-title" id="you-persona">{t({ fr: 'Voir la démo en tant que', en: 'View the demo as' })}</h2>
        <div className="you-list" role="radiogroup" aria-labelledby="you-persona">
          {PERSONAS.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={viewer.id === p.id} className={`you-row${viewer.id === p.id ? ' on' : ''}`} onClick={() => s.setViewer(p.id)}>
              <Avatar id={p.id} size={40} />
              <span className="you-text"><strong>{personById(p.id).name}</strong><small>{t(p.role)}</small></span>
              <Icon name={viewer.id === p.id ? 'radio_button_checked' : 'radio_button_unchecked'} size={24} />
            </button>
          ))}
        </div>

        <h2 className="you-title" id="you-theme">{t({ fr: 'Apparence', en: 'Appearance' })}</h2>
        <div className="you-theme" role="radiogroup" aria-labelledby="you-theme">
          {THEMES.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={theme === x.id} className={theme === x.id ? 'on' : ''} onClick={() => s.setTheme(x.id)}>
              <Icon name={theme === x.id ? 'check' : x.icon} size={18} />{t(x.l)}
            </button>
          ))}
        </div>

        <h2 className="you-title">{t({ fr: 'Cette démo', en: 'This demo' })}</h2>
        <div className="you-list">
          <button type="button" className="you-row" onClick={onAbout}>
            <span className="you-icon"><Icon name="info" size={22} /></span>
            <span className="you-text"><strong>{t({ fr: 'À propos de ce concept', en: 'About this concept' })}</strong><small>{t({ fr: 'Pas un produit Google', en: 'Not a Google product' })}</small></span>
          </button>
          <button type="button" className="you-row" onClick={() => { s.reset(); s.setMobilePane('you'); s.toast({ text: { fr: 'Démo remise à zéro.', en: 'Demo reset.' }, icon: 'restart_alt' }) }}>
            <span className="you-icon"><Icon name="restart_alt" size={22} /></span>
            <span className="you-text"><strong>{t({ fr: 'Remettre la démo à zéro', en: 'Reset the demo' })}</strong><small>{t({ fr: 'Tout redevient comme au début', en: 'Everything goes back to the start' })}</small></span>
          </button>
        </div>
      </div>
    </section>
  )
}
