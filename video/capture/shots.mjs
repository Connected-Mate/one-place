/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// One take of the whole app, for the film's laptop. Every action happens on a beat of the track: the app's clock is stepped frame by
// frame, so a frame of this recording is a frame of the film. The call runs for a minute in the app: it jumps twice, on beats.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { open, SCRATCH } from './lib.mjs'
import { BEAT } from '../film/timeline.mjs'
const PREVIEW = !!process.env.FILM_PREVIEW
const CSS = '*{scrollbar-width:none!important}*::-webkit-scrollbar{display:none!important}.cv-quiet{display:none!important}.cv-captions{display:none!important}'
const W = 1280, H = 800
const SEND = (id, who, text) => `(() => { const st = window.__opStore.getState(); st.push(st.activeProjectId, { id: '${id}', kind: 'text', authorId: '${who}', at: Date.now(), visibility: { type: 'all' }, text: { fr: ${JSON.stringify(text)}, en: ${JSON.stringify(text)} } }) })()`

const s = await open({ dsf: PREVIEW ? 1 : 4, name: 'tour', width: W, height: H, css: CSS })
const p = s.page
await s.skip(2500)
await p.getByRole('button', { name: 'Step in' }).click(); await s.skip(700)
await p.getByRole('button', { name: /Aurora launch/ }).first().click(); await s.skip(1200)
await s.shot('tour', { x: 0, y: 0, width: W, height: H })
const frameOf = (h) => Math.round(h * BEAT * s.fps)
/** Records up to beat h of the tour. */
const to = async (h, fn) => { const end = frameOf(h); if (s.frame > end + 1) console.log(`late: beat ${h} wanted frame ${end}, at ${s.frame}`); while (s.frame < end) { if (fn) await fn(s.frame); await s.advance(); await s.snap() } }
const moveToAt = async (x, y, h) => { const { x: x0, y: y0 } = s.cursor, f0 = s.frame, n = Math.max(1, frameOf(h) - f0); await to(h, (f) => { const u = Math.min(1, (f - f0 + 1) / n), e = u * u * (3 - 2 * u); return s.setCursor(x0 + (x - x0) * e, y0 + (y - y0) * e) }) }
const clickAt = async (loc, h, from) => { const b = await loc.boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2; await moveToAt(x, y, h - .25); await to(h, () => s.setCursor(x, y, 1)); await p.mouse.down(); await p.mouse.up(); await s.setCursor(x, y, 0) }
const typeUntil = async (text, h) => { const chars = [...text], f0 = s.frame, n = frameOf(h) - f0; let i = 0; await to(h, async (f) => { const want = Math.ceil(((f - f0 + 1) / n) * chars.length); while (i < want && i < chars.length) await p.keyboard.type(chars[i++]) }) }
const composer = () => p.locator('textarea:visible').first()
const marks = s.marks
/** The smallest element holding both texts: a whole component, measured live. */
const boxAround = async (name, a, b) => { const q = await p.evaluate(([a, b]) => {
  const deep = (t) => { const all = [...document.querySelectorAll('.chat-pane *, .right-pane *')].filter((e) => e.textContent.includes(t) && e.getBoundingClientRect().width > 0); return all[all.length - 1] }
  const ea = deep(a), eb = deep(b); if (!ea || !eb) return null
  let c = ea; while (c && !c.contains(eb)) c = c.parentElement
  const r = c.getBoundingClientRect()
  if (r.height < 720 && r.y > 40) return { x: r.x, y: r.y, w: r.width, h: r.height }
  const pane = (ea.closest('.chat-pane') ?? ea.closest('.right-pane')).getBoundingClientRect(), ra = ea.getBoundingClientRect(), rb = eb.getBoundingClientRect()
  return { x: pane.x + 6, y: ra.y - 30, w: pane.width - 12, h: rb.bottom - ra.y + 40 } // several messages in a row: the row of them
}, [a, b]); if (q) marks[name] = q; else console.log('no box for', name) }
const row0 = (n) => p.getByRole('button', { name: new RegExp(n) }).first().boundingBox()
const zone = async (name, loc) => { const b = await loc.boundingBox(); if (b) marks[name] = { x: b.x, y: b.y, w: b.width, h: b.height } }

await zone('rail', p.locator('nav, aside').filter({ hasText: 'Aurora launch' }).first())
await zone('chat', p.locator('.chat-pane').first())
await zone('pane', p.locator('.right-pane').first())
{ const a = await row0('Get hired'), b = await row0('Northwind'); marks.projects = { x: 0, y: a.y - 6, w: 256, h: b.y + b.height - a.y + 12 } }
marks.chatLow = { x: marks.chat.x, y: 400, w: marks.chat.w, h: marks.chat.y + marks.chat.h - 400 }

// 0 Here are all your projects: the hand runs over them.
await s.setCursor(150, 330); await s.hideCursor()
await to(1.5)
await s.setCursor(150, 330)
const row = (n) => p.getByRole('button', { name: new RegExp(n) }).first()
for (const [n, h] of [['Paris office', 2.5], ['Hiring', 3.5], ['Northwind', 4.5], ['Get hired', 5.5]]) { const b = await row(n).boundingBox(); await moveToAt(b.x + 120, b.y + b.height / 2, h) }
await s.hideCursor(); await to(6)
// 6 A normal chat: people talking
await to(6.5); await p.evaluate(SEND('f1', 'sofia', 'Preorder page is live on staging.'))
await to(7.5); await p.evaluate(SEND('f2', 'tom', 'Looks great. Sand it is?'))
await to(8.5); await p.evaluate(SEND('f3', 'karim', 'Sand. I just saw the photos, it wins.'))
await to(9.4)
await boxAround('thread', 'Preorder page is live', 'it wins')
await to(12)
// 12 Everything is linked to it: Meet, then the tag
await p.evaluate(() => { const st = window.__opStore.getState(); st.push(st.activeProjectId, { id: 'm1', kind: 'meeting', authorId: 'maya', at: Date.now(), visibility: { type: 'all' }, title: { fr: 'Launch date: quick sync', en: 'Launch date: quick sync' }, start: Date.now() + 3600000, durationMin: 15, attendeeIds: ['alex', 'maya', 'tom', 'sofia'], guestEmails: [] }) })
await to(12.5)
await composer().click()
await typeUntil('@Gem', 13); await p.keyboard.press('Enter'); await typeUntil('where do we stand?', 14); await p.keyboard.press('Enter')
await to(18.4)
await boxAround('answer', 'Since you were last here', 'Next meeting')
await to(22)
// 22 On the right: an artifact Gemini built, then a doc
await s.setCursor(1000, 500)
await clickAt(p.locator('[role=tab]:visible', { hasText: 'Launch date simulator' }).first(), 23)
await to(23.5)
{
  const range = p.locator('input[type=range]').filter({ visible: true }).first(), box = await range.boundingBox()
  const f = await range.evaluate((e) => (e.value - e.min) / (e.max - e.min)), x0 = box.x + box.width * f, y0 = box.y + box.height / 2
  { const h = await p.locator('.ap-hero').filter({ visible: true }).first().boundingBox(); marks.sim = { x: h.x - 8, y: h.y - 8, w: h.width + 16, h: box.y + box.height + 34 - h.y } }
  await moveToAt(x0, y0, 23.75); await p.mouse.down()
  const f0 = s.frame, n = frameOf(25.5) - f0
  await to(25.5, (fr) => s.setCursor(x0 + box.width * .35 * Math.sin(((fr - f0) / n) * Math.PI * .6), y0, 1))
  await p.mouse.up()
}
await clickAt(p.locator('button[aria-label^="Files"]').filter({ visible: true }).first(), 26)
await to(26.25)
await clickAt(p.getByText('Launch brief', { exact: true }).filter({ visible: true }).last(), 27)
await moveToAt(1100, 650, 27.75); await s.hideCursor()
await to(28)
// 28 Invite anyone: the real dialog
const kebab = () => p.locator('.chat-pane button[aria-label="More options"]').filter({ visible: true }).first()
await clickAt(kebab(), 29)
await to(29.5)
{
  const item = p.locator('.menu button, [role=menu] button, [role=menuitem]').filter({ hasText: /Invite/ }).filter({ visible: true }).first()
  if (await item.count()) await clickAt(item, 30.25)
  else { await p.keyboard.press('Escape'); await to(29.7); await clickAt(p.getByRole('button', { name: 'Add guest' }).filter({ visible: true }).last(), 30.25) } // before the app's Invite menu item is committed
}
await s.hideCursor()
await to(30.4)
await zone('invite', p.locator('.dialog').first())
await to(31.7)
await p.keyboard.press('Escape')
await to(32)
// 32 One group address: it is on the chat's header
await s.setCursor(600, 400)
await zone('address', p.locator('.addr-chip').filter({ visible: true }).first())
await clickAt(p.locator('.addr-chip').filter({ visible: true }).first(), 34)
await s.hideCursor()
await to(36)
// 36 An email arrives, sent to that address: it is a message in the chat, and Gemini reads it
await to(37)
await p.evaluate(() => window.__opDemo.simulateInboundEmail('aurora'))
await to(37.4)
await boxAround('email', 'Aurora for our December window', 'Reply by email')
await to(39.8)
{ const e = marks.email, n = await p.locator('.esc').filter({ visible: true }).last().boundingBox(); await boxAround('email', 'Aurora for our December window', 'Reply by email'); const e2 = marks.email; marks.email2 = { x: e2.x, y: e2.y, w: e2.w, h: n.y + n.height - e2.y + 8 }; marks.email = e }
await to(41)
// 41 Gemini prepares the reply: its note opens, who should answer, then the draft
await s.setCursor(560, 500)
await clickAt(p.locator('.esc-line').filter({ visible: true }).last(), 42)
await to(42.4)
{ const n = await p.locator('.esc').filter({ visible: true }).last().boundingBox(); marks.triage = { x: n.x, y: n.y, w: n.width, h: n.height } }
await clickAt(p.getByRole('button', { name: 'Draft a reply' }).filter({ visible: true }).last(), 43.5)
await s.setCursor(1100, 720); await s.hideCursor() // no hover toolbar on the message
await to(46.9)
await boxAround('draft', 'Draft to', 'Discard')
await to(49 - .9)
// 49 Calls too: in the same window, beside the chat
await s.setCursor(600, 300)
const windows = [{ film: frameOf(49) / s.fps, app: 0 }]
await clickAt(p.locator('button[aria-label="Start a call"]').filter({ visible: true }).first(), 49)
await s.hideCursor()
const now = () => p.evaluate(() => Date.now())
const t0 = await now()
const has = async (k) => (await s.plays()).find((x) => x.src.includes(k + '.mp3'))
const skipUntil = async (fn, cap = 150000) => { const st = await now(); while (!(await fn()) && (await now()) - st < cap) await s.advance() }
await to(49.25)
// jump 1, on a half-beat: Maya says it, and switches her camera on
await skipUntil(() => has('open-aurora-0'))
if (!(await has('open-aurora-0'))) { await p.screenshot({ path: SCRATCH + '/fail.png' }); console.log('NO LINE', JSON.stringify((await s.plays()).map((x) => x.src.slice(-30)))); await s.close(); process.exit(1) }
const line0 = (await has('open-aurora-0')).at
await skipUntil(async () => (await now()) - line0 > 3900)
windows.push({ film: frameOf(49.25) / s.fps, app: ((await now()) - t0) / 1000 })
await to(50)
// jump 2, on a beat: everyone is in, the two lines that say it all
await skipUntil(() => has('open-aurora-11'))
windows.push({ film: frameOf(50) / s.fps, app: ((await now()) - t0) / 1000 })
const wowFilm = frameOf(50) / s.fps
await to(59)
const hang = p.locator('[aria-label*="Leave" i], [aria-label*="Hang" i], [aria-label*="End call" i]').filter({ visible: true }).first()
{ const b = await hang.boundingBox(); await s.setCursor(b.x + 140, b.y - 80) }
await clickAt(hang, 59.5)
await s.hideCursor()
await to(60.5)
// jump 3, on a half-beat, under the close-up: Gemini has finished writing up the call
{
  const ready = async () => { const e = await p.locator('.summary-todos').filter({ visible: true }).last().boundingBox().catch(() => null); return e && e.y > 0 && e.y < H && !(await p.getByText('Gemini is writing up').filter({ visible: true }).count()) }
  const st = await now(); while (!(await ready()) && (await now()) - st < 30000) await s.advance()
  await s.skip(300)
  const h = await p.locator('.summary-head').filter({ visible: true }).last().boundingBox(), e = await p.locator('.summary-todos').filter({ visible: true }).last().boundingBox()
  console.log('summary after', (await now()) - st, 'ms', JSON.stringify(h), JSON.stringify(e))
  marks.summary = { x: h.x - 12, y: h.y - 10, w: h.width + 24, h: e.y + e.height + 10 - h.y }
}
await to(64 - .9)
// 64 Your day: the hand goes Home
await s.setCursor(420, 300)
await clickAt(p.getByRole('button', { name: /^Home|One Place, home/ }).filter({ visible: true }).first(), 64)
await s.hideCursor()
await to(65)
await zone('needs', p.locator('.hm-needs').first())
await p.evaluate(() => { const st = window.__opStore.getState(); st.push('move', { id: 'd1', kind: 'meeting', authorId: 'karim', at: Date.now(), visibility: { type: 'all' }, title: { fr: 'Site visit: last check', en: 'Site visit: last check' }, start: Date.now() + 10 * 60000, durationMin: 30, attendeeIds: ['alex', 'karim', 'sofia'], guestEmails: [] }) })
await to(76)
const plays = (await s.plays()).filter((x) => /voice\//.test(x.src)).map((x) => ({ file: x.src.split('/').pop(), at: (x.at - t0) / 1000 }))
const sayAt = (k) => { const q = plays.find((x) => x.file === k + '.mp3'); return windows[2].film + (q.at - windows[2].app) }
const subs = [{ from: wowFilm, to: sayAt('open-aurora-13'), text: 'Wow, that’s so cool. Everything’s in the same place.' }, { from: sayAt('open-aurora-13'), to: frameOf(59.4) / s.fps, text: 'So easy to find my docs!' }]
s.meta({ plays, windows, subs, wowFilm }); console.log(JSON.stringify({ windows, wowFilm }))
await s.close()
