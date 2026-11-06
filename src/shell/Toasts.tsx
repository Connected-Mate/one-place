/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
import { Button, Icon } from '../ui/kit'
import { useStore } from '../store'
import { useT } from '../i18n'

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const drop = useStore((s) => s.dropToast)
  const t = useT()
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} className="toast">
          {x.icon && <Icon name={x.icon} size={18} />}
          <span className="toast-text">{t(x.text)}</span>
          {x.action && <Button size="s" className="toast-action" onClick={() => { x.action!.run(); drop(x.id) }}>{t(x.action.label)}</Button>}
        </div>
      ))}
    </div>
  )
}
