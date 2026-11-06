/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The footage of the film: real interactions in the real app. Usage: node shots.mjs home type answer block private tabs callwide callsquare
import { open } from './lib.mjs'
import { END_LINE, END_TAIL, HANGUP_SECONDS } from './call-cuts.mjs'
const FILM_CSS = `:root{--bg:#fff!important}body{background:#fff!important}*{scrollbar-width:none!important}*::-webkit-scrollbar{display:none!important}.cv-quiet{display:none!important}`

const PREVIEW = !!process.env.FILM_PREVIEW
async function start({ project = 'Aurora launch', dsf = 3, width, height, name }) {
  const s = await open({ dsf: PREVIEW ? 1 : dsf, name, width, height, css: FILM_CSS })
  await s.skip(2500)
  await s.page.getByRole('button', { name: 'Step in' }).click()
  await s.skip(700)
  if (project) { await s.page.getByRole('button', { name: new RegExp(project) }).first().click(); await s.skip(1000) }
  return s
}
const ask = async (s, q, cps) => {
  await s.page.locator('textarea:visible').first().click()
  await s.page.keyboard.type('@Gem'); await s.skip(120); await s.page.keyboard.press('Enter'); await s.skip(60)
  await s.page.keyboard.type(q); await s.skip(60); await s.page.keyboard.press('Enter')
}

const SHOTS = {
  // One chat: people talking, a message written and sent, the column alive.
  async chat() {
    const s = await start({ dsf: 5, name: 'chat' })
    s.shot('chat', { x: 262, y: 52, width: 430, height: 888 })
    await s.rec_(200)
    await s.setCursor(560, 780)
    await s.moveTo(470, 905, 600)
    await s.page.locator('textarea:visible').first().click()
    await s.rec_(150)
    await s.hideCursor()
    await s.type('@Maya is the firmware good for the pilot run?', { cps: 24 })
    await s.rec_(200)
    await s.page.keyboard.press('Enter')
    await s.rec_(4200)
    s.meta(); await s.close()
  },
  // Tag the AI: the composer, alone and huge
  async type() {
    const s = await start({ dsf: 8, name: 'type' })
    await s.page.addStyleTag({ content: '[role=log]{visibility:hidden!important}' })
    await s.page.locator('textarea:visible').first().click()
    s.shot('type', { x: 262, y: 800, width: 430, height: 140 })
    await s.rec_(250)
    await s.type('@Gem', { cps: 13 })
    await s.rec_(330)
    await s.page.keyboard.press('Enter')
    await s.rec_(170)
    await s.type('where do we stand?', { cps: 22 })
    await s.rec_(100)
    const send = s.page.locator('.composer-send:visible').first()
    const b = await send.boundingBox()
    await s.setCursor(b.x + 40, b.y + 110)
    await s.pressAt(send, { ms: 500 })
    await s.rec_(500)
    s.meta(); await s.close()
  },
  async answer() {
    const s = await start({ dsf: 5, name: 'answer' })
    await ask(s, 'where do we stand?')
    s.shot('answer', { x: 262, y: 104, width: 430, height: 770 })
    await s.rec_(7000)
    s.meta(); await s.close()
  },
  // A block arrives on the bento board, in the gradient
  async block() {
    const s = await start({ dsf: 6, name: 'block' })
    await ask(s, 'build a preorder tracker by region')
    s.shot('block', { x: 262, y: 52, width: 1242, height: 888 })
    await s.rec_(6500)
    s.meta(); await s.close()
  },
  // Your docs, your tools: a doc, then a sheet, opening in the pane. Open in Sheets is right there.
  async docs() {
    const s = await start({ dsf: 4, name: 'docs' })
    s.shot('docs', { x: 704, y: 52, width: 800, height: 888 })
    await s.setCursor(1100, 600); await s.hideCursor()
    await s.rec_(150)
    await s.setCursor(1100, 700)
    const files = () => s.page.locator('[role=tab]:visible', { hasText: 'Files' }).first()
    const row = (t) => s.page.locator('.rp-view :visible, main :visible').getByText(t, { exact: true }).last()
    await s.pressAt(files(), { ms: 480 })
    await s.rec_(300)
    await s.pressAt(s.page.getByText('Launch brief', { exact: true }).filter({ visible: true }).last(), { ms: 450 })
    await s.rec_(1200)
    await s.pressAt(files(), { ms: 450 })
    await s.rec_(300)
    await s.pressAt(s.page.getByText('Budget', { exact: true }).filter({ visible: true }).last(), { ms: 450 })
    await s.rec_(800)
    const openIn = s.page.locator('[title^="Open in"]:visible').first()
    const bo = await openIn.boundingBox()
    await s.moveTo(bo.x + bo.width / 2, bo.y + bo.height / 2, 550)
    await s.rec_(900)
    s.meta({ openIn: bo }); await s.close()
  },
  async callwide() { await call('callwide', 1700, 860) },
  async callsquare() { await call('callsquare', 1512, 949) },
  // Your project: the bento board, and everything around it
  async overview() {
    const s = await start({ dsf: 3, name: 'overview' })
    s.shot('overview', { x: 0, y: 52, width: 1512, height: 897 })
    await s.setCursor(1200, 880); await s.hideCursor()
    await s.rec_(150)
    await s.setCursor(1200, 880)
    await s.moveTo(1010, 610, 700)
    await s.moveTo(1100, 610, 450) // over the board: the lamp turns, the tiles respond
    await s.moveTo(1370, 420, 700)
    await s.rec_(1700)
    s.meta(); await s.close()
  },
  async home() {
    const s = await start({ project: null, dsf: 3, name: 'home' })
    s.shot('home', { x: 0, y: 52, width: 1090, height: 660 })
    await s.setCursor(150, 380); await s.hideCursor()
    await s.rec_(200)
    await s.setCursor(150, 380)
    await s.moveTo(120, 260, 500)
    await s.rec_(150)
    const tick = s.page.locator('.hm-tick:visible').first()
    await s.pressAt(tick, { ms: 800 })
    await s.rec_(500)
    await s.moveTo(950, 600, 800)
    await s.rec_(500)
    s.meta(); await s.close()
  },
}

// Built on the fly: a mini-app Gemini made. Waits for the final UI: the shot is written against it when the commit is known.
SHOTS.mini = async () => { console.log('mini: not captured yet, waiting for the final UI') }

async function call(name, width, height) {
  const s = await start({ dsf: 3, name, width, height })
  await s.page.addStyleTag({ content: '.cv-captions{display:none!important}' }) // the film sets its own larger captions
  await s.page.locator('button[aria-label="Start a call"]:visible').first().click()
  await s.tick(2)
  const b = await s.page.locator('.cv-stage:visible').first().boundingBox()
  const chat = await s.page.locator('textarea:visible').first().boundingBox()
  // chat at left, call at right: the whole project, nothing but the rail and the top bar left out
  const left = 258
  const box = { x: left, y: 52, width: width - left, height: height - 52 }
  s.shot(name, box)
  const t0 = await s.page.evaluate(() => Date.now())
  let heardAt = null
  for (let sec = 0; sec < 150; sec++) {
    await s.rec_(1000)
    const p = (await s.plays()).find((x) => x.src.includes(END_LINE))
    if (p && heardAt === null) heardAt = p.at
    if (heardAt !== null && (await s.page.evaluate(() => Date.now())) - heardAt > END_TAIL * 1000) break
  }
  if (heardAt === null) console.error(`WARNING ${name}: ${END_LINE} never played`)
  // Hang up with the real button: Gemini's summary lands in the chat, to-dos on the board
  const hangTime = (await s.page.evaluate(() => Date.now()) - t0) / 1000
  const hang = s.page.locator('[aria-label*="Leave" i]:visible, [aria-label*="Hang" i]:visible, [aria-label*="End call" i]:visible').first()
  const bh = await hang.boundingBox()
  await s.setCursor(bh.x + 200, bh.y - 120)
  await s.pressAt(hang, { ms: 550 })
  const clicked = (await s.page.evaluate(() => Date.now()) - t0) / 1000
  await s.hideCursor()
  await s.rec_(HANGUP_SECONDS * 1000)
  const plays = (await s.plays()).filter((p) => /voice\//.test(p.src)).map((p) => ({ file: p.src.split('/').pop(), at: (p.at - t0) / 1000 }))
  const cams = [] 
  s.meta({ plays, hangTime, clicked, stage: b, box, cams }); console.log(JSON.stringify(plays)); await s.close()
}

const list = process.argv.slice(2)
for (const n of list.length ? list : Object.keys(SHOTS)) { const t = Date.now(); await SHOTS[n](); console.log(n, Math.round((Date.now() - t) / 1000) + 's') }
