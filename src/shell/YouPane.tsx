/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The phone's third place: the account card, full screen. The same content as behind the profile picture on larger screens.
import { useT } from '../i18n'
import { AccountBody } from './AccountPanel'

export function YouPane({ onAbout }: { onAbout: () => void }) {
  const t = useT()
  return (
    <section className="pane you-pane" aria-label={t({ fr: 'Vous', en: 'You' })}>
      <div className="you-scroll"><AccountBody onAbout={onAbout} /></div>
    </section>
  )
}
