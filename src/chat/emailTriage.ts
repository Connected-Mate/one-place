/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// What Gemini says under an email that reaches a project: what it's about, who should answer, by when.
// The seeded emails have lines written by hand; anything else is read by the rules below.
import { tx } from '../i18n'
import { GEMINI_ID, personById } from '../store'
import type { EmailMessage, Project, Txt } from '../data/types'
import { isDraftMail, mailAddress, mailName } from './helpers'

export interface Triage {
  summary: string
  /** person who should answer; absent once someone has replied */
  whoId?: string
  why?: string
  deadline?: string
  repliedBy?: string
}
interface Written { summary: string; who: string; why: string; deadline?: [RegExp, string] }

/** Hand-written for the emails of the demo, by message id or, for the simulated ones, by subject. */
export const WRITTEN: Record<string, Written> = {
  'a-m08': { summary: 'Batch 2 failed the haze check. Lumen Works is rerunning it, delivery slips 7 days, and 300 good parts are ready now.', who: 'karim', why: 'Karim owns the diffusers on the timeline.', deadline: [/New delivery date: ([A-Z][a-z]+ \d+)/, 'New delivery date: $1'] },
  'a-m25': { summary: 'The 300 parts left by air this morning, and Jun says the new batch 2 date is firm.', who: 'karim', why: 'The airway bill went to Karim, who runs the pilot run.', deadline: [/([A-Z][a-z]+ \d+) is firm/, 'Batch 2 firm for $1'] },
  'n-m01': { summary: 'Priya wants a proposal for 400 engraved lamps for the Lyon hotel, with price, lead time and warranty. Bordeaux and Lille could follow.', who: 'alex', why: 'Alex leads this account.' },
  'n-m07': { summary: 'Priya asks for €105 a room, a 2-year warranty and delivery before launch. That price is under Léa’s €110 floor.', who: 'alex', why: 'Alex leads the account, and Léa should check the price first.', deadline: [/board on ([A-Z][a-z]+ \d+)/, 'Her board meets on $1'] },
  'h-m04': { summary: 'Ben sent his portfolio, can start in two months, and would rather show real work than do a take-home.', who: 'tom', why: 'Tom leads the design interview.' },
  'Aurora for our December window': { summary: 'Halden & Co wants 200 Aurora units for six stores in its December window, and needs allocation and a wholesale price.', who: 'karim', why: 'Karim talks to the retailers.' },
  'A review unit for our gift guide': { summary: 'Lumière Magazine wants a review unit of Aurora for its holiday gift guide, which could be good early press.', who: 'sofia', why: 'Sofia handles press and samples.' },
  'Delivery slot for your desks': { summary: 'Delta can deliver the desks on one of two mornings, and needs a slot and an elevator booking.', who: 'karim', why: 'Karim runs the move.' },
  'A reference for Ben Okafor': { summary: 'Ingrid worked with Ben on the Ondine lamp and is offering a reference call.', who: 'maya', why: 'Maya runs this hire.' },
  'Bordeaux hotel: same terms as Lyon?': { summary: 'Northwind’s Bordeaux hotel wants 280 lamps on the Lyon terms, which is the follow-on order Alex asked for.', who: 'alex', why: 'Alex leads this account.' },
}

const en = (v: Txt | undefined) => tx(v, 'en')
const stripRe = (s: string) => s.replace(/^(\s*(re|fw|fwd)\s*:\s*)+/i, '').trim()
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/** The next date a person would mean by "Thursday" when this email was sent. */
function weekdayAfter(at: number, name: string) {
  const d = new Date(at)
  const target = WEEKDAYS.indexOf(name.toLowerCase())
  d.setDate(d.getDate() + (((target - d.getDay() + 7) % 7) || 7))
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}
/** "by Thursday", "before Nov 20", "no later than Friday", "by end of week". */
export function findDeadline(body: string, at: number): string | undefined {
  const m = body.match(/\b(?:by|before|until|no later than|deadline(?: is|:)?)\s+(?:the\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|end of (?:the )?(?:week|day|month)|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2})\b/i)
  if (!m) return undefined
  const what = m[1]
  if (WEEKDAYS.includes(what.toLowerCase())) return `By ${weekdayAfter(at, what)}`
  return `By ${what.charAt(0).toLowerCase() === 't' || what.startsWith('end') ? what.toLowerCase() : what}`
}
/** The sentence that carries a fact, not the greeting or the sign-off. */
function factOf(body: string) {
  const paras = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const content = (paras.length > 2 ? paras.slice(0, -1) : paras).filter((x) => !(x.length < 40 && /,$/.test(x)))
  const sentences = content.join(' ').match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)?.map((s) => s.trim()).filter((s) => s.length > 24 && !/^(hi|hello|dear)\b/i.test(s)) ?? []
  return sentences.find((s) => /\d/.test(s)) ?? sentences[0] ?? ''
}
const TOPICS: [RegExp, RegExp, string][] = [
  [/\b(price|pricing|budget|invoice|payment|margin|cost|quote|contract)\b/i, /finance/i, 'handles the numbers'],
  [/\b(deliver\w*|ship\w*|logistic\w*|supplier|factory|batch|parts|furniture|retail\w*|stock)\b/i, /operations/i, 'runs operations'],
  [/\b(press|review|journalist|article|campaign|sample|magazine|interview request)\b/i, /marketing/i, 'handles press and marketing'],
  [/\b(firmware|spec|bug|warranty|defect)\b/i, /product/i, 'looks after the product'],
  [/\b(design|portfolio|colorway|render)\b/i, /design/i, 'leads design'],
]
function whoShouldAnswer(text: string, p: Project): { id: string; why: string } {
  const members = p.memberIds.filter((id) => id !== GEMINI_ID)
  for (const [topic, title, role] of TOPICS) {
    if (!topic.test(text)) continue
    const id = members.find((m) => title.test(en(personById(m).title)))
    if (id) return { id, why: `${personById(id).name.split(/\s+/)[0]} ${role}.` }
  }
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 4)
  for (const b of p.blocks) {
    if (b.type !== 'timeline') continue
    const hit = b.items.find((i) => i.ownerId && words.some((w) => en(i.label).toLowerCase().includes(w)))
    if (hit?.ownerId) return { id: hit.ownerId, why: `${personById(hit.ownerId).name.split(/\s+/)[0]} owns ${en(hit.label)} on the timeline.` }
  }
  return { id: p.ownerId, why: `${personById(p.ownerId).name.split(/\s+/)[0]} leads this project.` }
}
/** Someone has already answered: a sent email that refers to this one, or a later one to the same address. */
function repliedBy(m: EmailMessage, p: Project) {
  const address = mailAddress(m.from).toLowerCase()
  return p.messages.find((x) => x.kind === 'email' && x.direction === 'out' && !isDraftMail(x) && x.at > m.at
    && (x.quoteId === m.id || mailAddress(x.to).toLowerCase() === address))?.authorId
}

export function triageEmail(m: EmailMessage, p: Project): Triage {
  const body = en(m.body)
  const subject = stripRe(en(m.subject))
  const written = WRITTEN[m.id] ?? WRITTEN[subject]
  const replied = repliedBy(m, p)
  if (written) {
    const found = written.deadline ? body.match(written.deadline[0]) : null
    const deadline = found && written.deadline ? written.deadline[1].replace('$1', found[1]) : findDeadline(body, m.at)
    return { summary: written.summary, whoId: replied ? undefined : written.who, why: written.why, deadline, repliedBy: replied }
  }
  const who = whoShouldAnswer(`${subject} ${body}`, p)
  const fact = factOf(body)
  const name = mailName(m.from).split(/\s+/)[0]
  return { summary: fact ? `${name}: ${fact}` : `${name} wrote about ${subject}.`, whoId: replied ? undefined : who.id, why: who.why, deadline: findDeadline(body, m.at), repliedBy: replied }
}
