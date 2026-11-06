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
async function start({ project = 'Aurora launch', dsf = 3, width, height, name, fps = 60 }) {
  const s = await open({ dsf: PREVIEW ? 1 : dsf, name, width, height, css: FILM_CSS, fps })
  await s.skip(2500)
  await s.page.getByRole('button', { name: 'Step in' }).click()
  await s.skip(700)
  if (project) { await s.page.getByRole('button', { name: new RegExp(project) }).first().click(); await s.skip(1000) }
  return s
}
const ask = async (s, q, cps) => {
  await s.page.locator('textarea:visible').first().click()
  await s.page.keyboard.type('@Gem'); await s.skip(130); await s.page.keyboard.press('Enter'); await s.skip(60)
  await s.page.keyboard.type(q); await s.skip(60); await s.page.keyboard.press('Enter')
}

const SEND = (id, who, text) => `(() => { const st = window.__opStore.getState(); st.push(st.activeProjectId, { id: '${id}', kind: 'text', authorId: '${who}', at: Date.now(), visibility: { type: 'all' }, text: { fr: ${JSON.stringify(text)}, en: ${JSON.stringify(text)} } }) })()`

const SHOTS = {
  // All your tools, all your people, one project: the whole product, people really writing in it
  async all() {
    const s = await start({ dsf: 3, name: 'all' })
    s.shot('all', { x: 0, y: 52, width: 1512, height: 897 })
    await s.rec_(500)
    await s.page.evaluate(SEND('f1', 'sofia', 'Preorder page is live on staging.'))
    await s.rec_(900)
    await s.page.evaluate(SEND('f2', 'tom', 'Looks great. Sand it is?'))
    await s.rec_(900)
    await s.page.evaluate(SEND('f3', 'maya', 'Firmware passes QA, pilot run holds.'))
    await s.rec_(1100)
    s.meta(); await s.close()
  },
  // Moving fast: to-dos ticking
  async todo() {
    const s = await start({ dsf: 5, name: 'todo' })
    await s.page.locator('[role=tab]:visible', { hasText: 'To-do' }).first().click(); await s.skip(600)
    s.shot('todo', { x: 704, y: 96, width: 800, height: 560 })
    await s.setCursor(1250, 560); await s.hideCursor(); await s.rec_(60); await s.setCursor(1250, 560)
    const check = (t) => s.page.locator('.rp-todo', { hasText: t }).filter({ visible: true }).first().locator('.rp-todo-check').first()
    await s.pressAt(check('Reconfirm the pilot'), { ms: 320 }); await s.rec_(300)
    await s.pressAt(check('Tell Nora'), { ms: 260 }); await s.rec_(300)
    await s.pressAt(check('Decide the keynote'), { ms: 240 }); await s.rec_(600)
    s.meta(); await s.close()
  },
  // Moving fast: a bar dragged on the roadmap
  async roadmap() {
    const s = await start({ dsf: 5, name: 'roadmap' })
    await s.page.locator('[role=tab]:visible', { hasText: 'Roadmap' }).first().click(); await s.skip(700)
    s.shot('roadmap', { x: 704, y: 96, width: 800, height: 780 })
    await s.setCursor(1300, 700); await s.hideCursor(); await s.rec_(60); await s.setCursor(1300, 700)
    const bar = s.page.locator('[aria-label^="Pilot run"]').filter({ visible: true }).first()
    const b = await bar.boundingBox()
    await s.moveTo(b.x + b.width / 2, b.y + b.height / 2, 300)
    await s.page.mouse.down()
    await s.rec_(450, (t) => s.setCursor(b.x + b.width / 2 + 90 * Math.min(1, t * 1.05) ** .7, b.y + b.height / 2, 1))
    await s.page.mouse.up()
    await s.rec_(700, () => s.setCursor(b.x + b.width / 2 + 90, b.y + b.height / 2, 0))
    s.meta(); await s.close()
  },
  // Moving fast: a doc, in the pane
  async doc() {
    const s = await start({ dsf: 5, name: 'doc' })
    s.shot('doc', { x: 704, y: 52, width: 800, height: 700 })
    const files = s.page.locator('button[aria-label^="Files"]').filter({ visible: true }).first()
    await s.setCursor(1100, 300); await s.hideCursor(); await s.rec_(50); await s.setCursor(1100, 300)
    await s.pressAt(files, { ms: 300 }); await s.rec_(450)
    const row = s.page.getByText('Launch brief', { exact: true }).filter({ visible: true }).last()
    await s.pressAt(row, { ms: 280 }); await s.rec_(1200)
    s.meta(); await s.close()
  },
  async mini() {
    const s = await start({ dsf: 4, name: 'mini' })
    await s.page.locator('[role=tab]:visible', { hasText: 'Launch date simulator' }).first().click(); await s.skip(800)
    s.shot('mini', { x: 704, y: 96, width: 800, height: 700 })
    const range = s.page.locator('input[type=range]').filter({ visible: true }).first()
    const box = await range.boundingBox()
    const f = await range.evaluate((e) => (e.value - e.min) / (e.max - e.min))
    const x0 = box.x + box.width * f, y0 = box.y + box.height / 2
    await s.setCursor(x0 - 80, y0 + 140); await s.hideCursor(); await s.rec_(60)
    await s.setCursor(x0 - 80, y0 + 140)
    await s.moveTo(x0, y0, 280)
    await s.page.mouse.down()
    await s.rec_(1400, (t) => s.setCursor(x0 + box.width * .32 * Math.sin(t * Math.PI * .72), y0, 1))
    await s.page.mouse.up()
    await s.rec_(250)
    s.meta(); await s.close()
  },
  // Gemini does the boring stuff: an email drafted, a summary, to-dos
  async draft() {
    const s = await start({ dsf: 5, name: 'draft' })
    await ask(s, 'draft a reply to Jun')
    s.shot('draft', { x: 262, y: 104, width: 430, height: 780 })
    await s.rec_(3500)
    s.meta(); await s.close()
  },
  async answer() {
    const s = await start({ dsf: 5, name: 'answer' })
    await ask(s, 'where do we stand?')
    s.shot('answer', { x: 262, y: 104, width: 430, height: 770 })
    await s.rec_(4500)
    s.meta(); await s.close()
  },
  async todoai() {
    const s = await start({ dsf: 5, name: 'todoai' })
    await ask(s, 'add a to-do: check the diffuser date with Jun')
    s.shot('todoai', { x: 262, y: 500, width: 430, height: 384 })
    await s.rec_(2500)
    s.meta(); await s.close()
  },
  async callwide() { await call('callwide', 1700, 860) },
  async callsquare() { await call('callsquare', 1512, 949) },
}

async function call(name, width, height) {
  const s = await start({ dsf: 3, name, width, height, fps: 30 })
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
