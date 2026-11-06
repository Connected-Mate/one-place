import { useRef, useState } from 'react'
import { useT } from '../i18n'
import { Button, Dialog, Icon } from '../ui/kit'
import { copyCallLink, inviteGuest, validateInvite, type InviteErrors } from './callActions'

const SCOPE = [
  { icon: 'videocam', ok: true, label: { fr: 'Cet appel', en: 'This call' } },
  { icon: 'chat', ok: false, label: { fr: 'Le chat', en: 'The chat' } },
  { icon: 'dashboard', ok: false, label: { fr: 'Le board', en: 'The board' } },
  { icon: 'description', ok: false, label: { fr: 'Les documents', en: 'The documents' } },
]

export function InviteDialog({ startedAt, onClose }: { startedAt: number; onClose(): void }) {
  const t = useT()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<InviteErrors>({})
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const result = inviteGuest(name, email)
    if (!result) { onClose(); return }
    setErrors(result)
    if (result.name) nameRef.current?.focus()
    else emailRef.current?.focus()
  }

  return (
    <Dialog title={t({ fr: 'Inviter pour cet appel uniquement', en: 'Invite for this call only' })} onClose={onClose} width={500}
      footer={(
        <>
          <Button icon="link" className="cv-inv-copy" onClick={() => void copyCallLink(startedAt)}>{t({ fr: 'Copier le lien', en: 'Copy link' })}</Button>
          <Button onClick={onClose}>{t({ fr: 'Annuler', en: 'Cancel' })}</Button>
          <Button variant="filled" type="submit" form="cv-invite-form">{t({ fr: 'Inviter', en: 'Invite' })}</Button>
        </>
      )}>
      <form id="cv-invite-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="cv-inv-name">{t({ fr: 'Nom', en: 'Name' })}</label>
          <input ref={nameRef} id="cv-inv-name" className={`input${errors.name ? ' bad' : ''}`} value={name} maxLength={80} autoComplete="off"
            aria-invalid={!!errors.name} aria-describedby={errors.name ? 'cv-inv-name-err' : undefined}
            onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((x) => ({ ...x, name: undefined })) }}
            onBlur={() => { if (name.trim()) setErrors((x) => ({ ...x, name: validateInvite(name, email).name })) }} />
          {errors.name && <span id="cv-inv-name-err" className="field-err" role="alert">{t(errors.name)}</span>}
        </div>
        <div className="field">
          <label htmlFor="cv-inv-email">{t({ fr: 'Adresse e-mail', en: 'Email address' })}</label>
          <input ref={emailRef} id="cv-inv-email" className={`input${errors.email ? ' bad' : ''}`} type="email" inputMode="email" value={email} maxLength={160} autoComplete="off"
            aria-invalid={!!errors.email} aria-describedby={errors.email ? 'cv-inv-email-err' : undefined}
            onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((x) => ({ ...x, email: undefined })) }}
            onBlur={() => { if (email.trim()) setErrors((x) => ({ ...x, email: validateInvite(name, email).email })) }} />
          {errors.email && <span id="cv-inv-email-err" className="field-err" role="alert">{t(errors.email)}</span>}
        </div>
      </form>
      <div className="cv-scope">
        <ul aria-hidden="true">
          {SCOPE.map((s) => (
            <li key={s.icon} className={s.ok ? 'ok' : 'no'}>
              <span className="cv-scope-icon"><Icon name={s.icon} size={20} /><Icon className="cv-scope-mark" name={s.ok ? 'check_circle' : 'block'} fill size={16} /></span>
              {t(s.label)}
            </li>
          ))}
        </ul>
        <p>{t({
          fr: 'Cette personne rejoint cet appel uniquement : pas d’accès au chat, au board ni aux documents. Une fois l’appel fini, elle n’a plus accès à rien.',
          en: 'They join this call only: no access to the chat, the board or the documents. Once the call ends, they have access to nothing.',
        })}</p>
      </div>
    </Dialog>
  )
}
