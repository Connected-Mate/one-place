/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
import type { ReactNode } from 'react'
import type { Artifact } from '../../data/types'
import { useT } from '../../i18n'
import { useStore } from '../../store'
import { Button, Icon } from '../../ui/kit'
import { APP_NAME, appOf, WorkspaceIcon } from '../../ui/WorkspaceIcon'
import { FileIcon } from '../shared'

/** Same header on every document. It lives here, and "Open in" is there for the moments you want the full app. */
export function ArtifactHeader({ artifact, children }: { artifact: Artifact; children?: ReactNode }) {
  const t = useT()
  const toast = useStore((s) => s.toast)
  const title = t(artifact.title)
  const app = artifact.kind === 'video' && artifact.overview ? 'notebooklm' : appOf(artifact.kind)
  return (
    <header className="rp-doc-head">
      <FileIcon a={artifact} size={24} />
      <h2 className="rp-doc-title rp-trunc" title={title}>{title}</h2>
      <span className="rp-drive"><WorkspaceIcon app="drive" size={14} />{t({ fr: 'Dans Drive', en: 'In Drive' })}</span>
      <span className="rp-doc-head-extra">{children}</span>
      {app && (
        <button
          type="button"
          className="rp-open-in"
          title={`Open in ${APP_NAME[app]}`}
          onClick={() => toast({ text: { fr: `S’ouvrirait dans ${APP_NAME[app]}. Simulé dans cette démo.`, en: `This would open in ${APP_NAME[app]}. Simulated in this demo.` } })}
        >
          <WorkspaceIcon app={app} size={18} /><span>{`Open in ${APP_NAME[app]}`}</span>
        </button>
      )}
      <Button
        variant="tonal"
        className="rp-share"
        icon="group"
        onClick={() => toast({ text: { fr: 'Tout le monde l’a déjà', en: 'Everyone already has it' }, icon: 'group' })}
      >
        {t({ fr: 'Partager', en: 'Share' })}
      </Button>
    </header>
  )
}

/** The Workspace toolbar: a soft pill under the title. Square-ish 28px buttons, thin separators. */
export function TB({ icon, label, onClick, disabled, pressed, children }: { icon?: string; label: string; onClick?: () => void; disabled?: boolean; pressed?: boolean; children?: ReactNode }) {
  return (
    <button
      type="button"
      className={`rp-tb${pressed ? ' on' : ''}${children ? ' wide' : ''}`}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the text selection and the caret where they are
      onClick={onClick}
    >
      {icon && <Icon name={icon} size={18} />}{children}
    </button>
  )
}
export const TBSep = () => <span className="rp-tb-sep" aria-hidden="true" />

/** Give the keyboard to a document, unless the person is typing somewhere else (the chat composer, say). */
export function takeFocus(el: HTMLElement | null) {
  const a = document.activeElement as HTMLElement | null
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return
  el?.focus({ preventScroll: true })
}
