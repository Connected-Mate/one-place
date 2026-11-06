import type { ReactNode } from 'react'
import type { Artifact } from '../../data/types'
import { useT } from '../../i18n'
import { useStore } from '../../store'
import { Button, Icon } from '../../ui/kit'
import { KindIcon } from '../shared'

/** Same header on every document. There is no "Open original" on purpose: the pane is the original. */
export function ArtifactHeader({ artifact, children }: { artifact: Artifact; children?: ReactNode }) {
  const t = useT()
  const toast = useStore((s) => s.toast)
  const title = t(artifact.title)
  return (
    <header className="rp-doc-head">
      <KindIcon kind={artifact.kind} size={24} />
      <h2 className="rp-doc-title rp-trunc" title={title}>{title}</h2>
      <span className="rp-drive"><Icon name="add_to_drive" size={16} />{t({ fr: 'Dans Drive', en: 'In Drive' })}</span>
      <span className="rp-doc-head-extra">{children}</span>
      <Button
        variant="tonal"
        size="s"
        icon="group"
        onClick={() => toast({ text: { fr: 'Tout le monde dans le projet l’a déjà', en: 'Everyone in the project already has it' }, icon: 'group' })}
      >
        {t({ fr: 'Partager', en: 'Share' })}
      </Button>
    </header>
  )
}

/** Give the keyboard to a document, unless the person is typing somewhere else (the chat composer, say). */
export function takeFocus(el: HTMLElement | null) {
  const a = document.activeElement as HTMLElement | null
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return
  el?.focus({ preventScroll: true })
}
