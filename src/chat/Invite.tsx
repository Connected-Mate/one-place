/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Inviting someone to a project: as a member, for calls only, or by email only.
import { useState } from 'react'
import { useT } from '../i18n'
import { canSee, GEMINI_ID, personById, roleIn, uid, useStore } from '../store'
import { inviteGuest } from '../call/callActions'
import { people } from '../data/seed'
import { Button, Dialog } from '../ui/kit'
import type { Person, Project } from '../data/types'
import { firstName } from './helpers'

export async function copyProjectAddress(address: string) {
  const { toast } = useStore.getState()
  try {
    await navigator.clipboard.writeText(address)
    toast({ icon: 'content_copy', text: { fr: 'Copiée : tout le monde peut écrire à ce projet', en: 'Copied: anyone can write to this project' } })
  } catch {
    toast({ icon: 'mail', text: address })
  }
}

export type InviteKind = 'member' | 'call' | 'email'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const HUES = ['#0b57d0', '#188038', '#e37400', '#8430ce', '#d01884', '#b3261e', '#00838f']

/** People invited during the demo live in the project's lists under an id that carries their name and address. */
const invitedId = (name: string, email: string) => `inv:${name}|${email}`
function personFrom(id: string): Person | null {
  const m = id.match(/^inv:([^|]+)\|(.+)$/)
  if (!m) return null
  const hash = [...id].reduce((a, c) => a + c.charCodeAt(0), 0)
  return { id, name: m[1], email: m[2], title: 'Invited', hue: HUES[hash % HUES.length], role: 'external', presence: 'offline' }
}
function register(id: string) {
  if (!people.some((p) => p.id === id)) { const p = personFrom(id); if (p) people.push(p) }
}
// after a reload the project lists come back from storage: their invited people must exist again
for (const p of useStore.getState().projects) for (const id of [...p.memberIds, ...p.externalIds]) register(id)

/** Returns an error for the form, or null when it's fine. */
export function validateInvite(p: Project, name: string, email: string): { name?: string; email?: string } | null {
  const errors: { name?: string; email?: string } = {}
  if (!name.trim()) errors.name = 'Enter a name.'
  const mail = email.trim().toLowerCase()
  if (!EMAIL.test(mail)) errors.email = 'That email address doesn’t look valid.'
  else {
    const on = [...p.memberIds, ...p.externalIds].filter((id) => id !== GEMINI_ID).map(personById).find((x) => x.email.toLowerCase() === mail)
    if (on) errors.email = `${on.name} is already on this project.`
    else if (p.messages.some((m) => m.kind === 'meeting' && !m.ended && m.guestEmails?.includes(mail))) errors.email = 'This person is already invited to a call.'
  }
  return errors.name || errors.email ? errors : null
}

export function invitePerson(pid: string, rawName: string, rawEmail: string, kind: InviteKind) {
  const s = useStore.getState()
  const p = s.projects.find((x) => x.id === pid)
  if (!p) return
  const name = rawName.trim().replace(/[[\]()|]/g, '')
  const email = rawEmail.trim().toLowerCase()
  const me = firstName(s.viewerId)
  const known = people.find((x) => x.email.toLowerCase() === email)
  const id = known?.id ?? invitedId(name, email)
  const shown = known?.name ?? name
  let text: string
  if (kind === 'member') {
    register(id)
    s.addMember(pid, id)
    text = `${me} added @[${shown}](${id}) to the project.`
  } else if (kind === 'email') {
    register(id)
    useStore.setState((st) => ({ projects: st.projects.map((x) => (x.id === pid ? { ...x, externalIds: [...x.externalIds, id] } : x)) }))
    text = `${me} added @[${shown}](${id}) by email. They write to ${p.address} and need no account.`
  } else {
    if (s.call?.projectId === pid) inviteGuest(shown, email)
    const next = p.messages.filter((m) => m.kind === 'meeting' && !m.ended && (m.live || m.start >= Date.now()) && canSee(m.visibility, s.viewerId)).sort((a, b) => (a.kind === 'meeting' && b.kind === 'meeting' ? a.start - b.start : 0))[0]
    if (next?.kind === 'meeting') s.patch(pid, next.id, { guestEmails: [...(next.guestEmails ?? []), email] })
    text = `${me} invited ${shown} to ${next?.kind === 'meeting' ? 'the next call' : 'a call'} only. They won’t see the chat or the board.`
  }
  s.push(pid, { id: uid('m'), kind: 'system', authorId: s.viewerId, at: Date.now(), visibility: { type: 'all' }, text, icon: 'person_add' })
  s.toast({ icon: 'person_add', text: kind === 'member' ? `${shown} joined the project` : `${shown} is invited` })
}

export function InviteDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const t = useT()
  const owner = roleIn(project, useStore.getState().viewerId) === 'owner'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [kind, setKind] = useState<InviteKind>(owner ? 'member' : 'call')
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})
  const options: { id: InviteKind; title: string; line: string; disabled?: boolean }[] = [
    { id: 'member', title: 'Member', line: owner ? 'Joins the project: the chat, the board and every call.' : `Joins the project. Only ${firstName(project.ownerId)} can add members.`, disabled: !owner },
    { id: 'call', title: 'Call only', line: 'Joins a call, without seeing the chat or the board.' },
    { id: 'email', title: 'By email only', line: `Writes to ${project.address} and gets answers by email. No account needed.` },
  ]
  const submit = () => {
    const bad = validateInvite(project, name, email)
    if (bad) { setErrors(bad); return }
    invitePerson(project.id, name, email, kind)
    onClose()
  }
  const enter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }
  return (
    <Dialog title={t({ fr: 'Inviter une personne', en: 'Invite someone' })} onClose={onClose} footer={<><Button onClick={onClose}>{t({ fr: 'Annuler', en: 'Cancel' })}</Button><Button variant="filled" onClick={submit}>{t({ fr: 'Inviter', en: 'Invite' })}</Button></>}>
      <div className="field">
        <label htmlFor="inv-name">{t({ fr: 'Nom', en: 'Name' })}</label>
        <input id="inv-name" data-autofocus className={`input${errors.name ? ' bad' : ''}`} value={name} maxLength={80} aria-invalid={!!errors.name} onChange={(e) => { setName(e.target.value); setErrors({ ...errors, name: undefined }) }} onKeyDown={enter} />
        {errors.name && <span className="field-err" role="alert">{errors.name}</span>}
      </div>
      <div className="field">
        <label htmlFor="inv-email">{t({ fr: 'Adresse e-mail', en: 'Email address' })}</label>
        <input id="inv-email" type="email" className={`input${errors.email ? ' bad' : ''}`} value={email} maxLength={120} aria-invalid={!!errors.email} onChange={(e) => { setEmail(e.target.value); setErrors({ ...errors, email: undefined }) }} onKeyDown={enter} />
        {errors.email && <span className="field-err" role="alert">{errors.email}</span>}
      </div>
      <fieldset className="inv-kinds">
        <legend className="field-label">{t({ fr: 'Accès', en: 'Access' })}</legend>
        {options.map((o) => (
          <label key={o.id} className={`inv-kind${kind === o.id ? ' on' : ''}${o.disabled ? ' off' : ''}`}>
            <input type="radio" name="inv-kind" value={o.id} checked={kind === o.id} disabled={o.disabled} onChange={() => setKind(o.id)} />
            <span className="inv-text"><span className="inv-title">{o.title}</span><span className="inv-line">{o.line}</span></span>
          </label>
        ))}
      </fieldset>
    </Dialog>
  )
}
