/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// A demo of the group address: an outside contact writes to the project, the email lands in the chat.
// Used by "Things to try" and by the film (window.__opDemo.simulateInboundEmail).
import { tx } from '../i18n'
import { uid, useStore } from '../store'
import type { EmailMessage, Project } from '../data/types'

interface Sample { id: string; name: string; email: string; subject: string; body: (p: Project) => string }
const inDays = (n: number) => new Date(Date.now() + n * 864e5).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const SAMPLES: Record<string, Sample[]> = {
  aurora: [
    { id: 'ext-mina', name: 'Mina Okada', email: 'mina.okada@halden-retail.example', subject: 'Aurora for our December window', body: () => 'Hi team,\n\nWe’d love to carry Aurora in six of our stores for the December window, about 200 units in total. Can you confirm allocation and your wholesale price by Thursday? Our merchandising brief goes out on Friday.\n\nBest,\nMina Okada\nBuyer, Halden & Co' },
    { id: 'ext-paul', name: 'Paul Verne', email: 'paul@lumiere-mag.example', subject: 'A review unit for our gift guide', body: () => `Hello,\n\nWe are closing our holiday gift guide and Aurora would fit nicely. Could you send a review unit before ${inDays(12)}? We shoot everything in one day.\n\nThanks,\nPaul Verne\nLumière Magazine` },
  ],
  move: [
    { id: 'ext-delta', name: 'Hugo Martin', email: 'hugo.martin@delta-furniture.example', subject: 'Delivery slot for your desks', body: () => 'Hello,\n\nYour 14 desks are ready. We can deliver on Tuesday or Thursday morning the week of your move, and we need the elevator booked. Please confirm your slot by Friday.\n\nHugo Martin\nDelta Furniture' },
  ],
  hiring: [
    { id: 'ext-ingrid', name: 'Ingrid Solberg', email: 'ingrid@ondine-labs.example', subject: 'A reference for Ben Okafor', body: () => 'Hi Maya,\n\nBen mentioned he is talking to you. I worked with him for two years on the Ondine lamp, from first sketch to 4,000 units. Happy to do a short reference call if that helps.\n\nIngrid Solberg\nOndine Labs' },
  ],
  northwind: [
    { id: 'ext-tomas', name: 'Tomas Reis', email: 'tomas.reis@northwind-hotels.example', subject: 'Bordeaux hotel: same terms as Lyon?', body: () => 'Hi Alex,\n\nPriya pointed me to you. We open the Bordeaux hotel next spring, 280 rooms, and would like the same lamp on the same terms as Lyon. Could you confirm before our board next Friday?\n\nTomas Reis\nGeneral manager, Northwind Bordeaux' },
  ],
}
const generic = (p: Project): Sample => ({
  id: 'ext-sam', name: 'Sam Rivera', email: 'sam.rivera@partner-studio.example', subject: `Working together on ${tx(p.name, 'en')}`,
  body: () => `Hello,\n\nA colleague gave me this address for ${tx(p.name, 'en')}. We’d like to help, and I can send a short proposal. Who is the right person to talk to? A reply by Friday would be ideal.\n\nSam Rivera\nPartner Studio`,
})

const sent = new Map<string, number>()
let lastAt = 0
/** Pushes a realistic email from an outside contact. Gemini's note appears under it 1.5 seconds later. */
export function simulateInboundEmail(projectId: string): string | null {
  const s = useStore.getState()
  const p = s.projects.find((x) => x.id === projectId)
  if (!p || Date.now() - lastAt < 800) return null // a double click sends one email
  lastAt = Date.now()
  const list = SAMPLES[p.id] ?? [generic(p)]
  const n = sent.get(p.id) ?? 0
  sent.set(p.id, n + 1)
  const sample = list[n % list.length]
  const message: EmailMessage = {
    id: uid('m'), kind: 'email', direction: 'in', authorId: sample.id, at: Date.now(), visibility: { type: 'all' },
    subject: sample.subject, body: sample.body(p), from: `${sample.name} <${sample.email}>`, to: p.address,
  }
  s.push(p.id, message)
  if (s.activeProjectId !== p.id || s.home) {
    s.toast({ icon: 'mail', text: `New email from ${sample.name} in ${tx(p.name, 'en')}`, action: { label: 'View', run: () => { const g = useStore.getState(); g.selectProject(p.id); g.focusMessage(message.id) } } })
  }
  return message.id
}

// the film drives the app from outside
declare global { interface Window { __opDemo?: Record<string, unknown> } }
if (typeof window !== 'undefined') window.__opDemo = { ...window.__opDemo, simulateInboundEmail }
