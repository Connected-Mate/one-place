/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The footage of the film: real interactions in the real app. Usage: node shots.mjs home type answer block private tabs callwide callsquare
import { open } from './lib.mjs'
import { LEA_LINE, LEA_TAIL } from './call-cuts.mjs'
const FILM_CSS = `:root{--bg:#fff!important}body{background:#fff!important}*{scrollbar-width:none!important}*::-webkit-scrollbar{display:none!important}.cv-quiet{display:none!important}`

async function start({ project = 'Aurora launch', dsf = 3, width, height, name }) {
  const s = await open({ dsf, name, width, height, css: FILM_CSS })
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
  async home() {
    const s = await start({ project: null, name: 'home' })
    s.shot('home', { x: 290, y: 150, width: 770, height: 360 })
    await s.setCursor(1040, 500); await s.hideCursor()
    await s.rec_(300)
    await s.setCursor(1040, 500)
    const tick = s.page.locator('.hm-tick:visible').first()
    await s.pressAt(tick, { ms: 1100 })
    await s.rec_(500)
    await s.moveTo(900, 600, 900)
    await s.rec_(800)
    s.meta(); await s.close()
  },
  async type() {
    const s = await start({ dsf: 4, name: 'type' })
    await s.page.addStyleTag({ content: '[role=log]{visibility:hidden!important}' }) // the composer alone, floating
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
    const s = await start({ name: 'answer' })
    await ask(s, 'where do we stand?')
    s.shot('answer', { x: 262, y: 104, width: 430, height: 770 })
    await s.rec_(7000)
    s.meta(); await s.close()
  },
  async block() {
    const s = await start({ name: 'block' })
    await ask(s, 'build a preorder tracker by region')
    s.shot('block', { x: 262, y: 52, width: 1242, height: 888 })
    await s.rec_(6500)
    s.meta(); await s.close()
  },
  async private() {
    const s = await start({ name: 'private' })
    s.shot('private', { x: 262, y: 104, width: 430, height: 830 })
    const msg = s.page.getByText('Ran firmware').first()
    const bm = await msg.boundingBox()
    await s.setCursor(560, 720); await s.hideCursor()
    await s.rec_(150)
    await s.setCursor(560, 720)
    await s.moveTo(bm.x + 240, bm.y + 30, 650)
    await s.rec_(150)
    const buttons = s.page.locator('[aria-label="Reply privately"]')
    const idx = await buttons.evaluateAll((a, y) => { let best = 0, d = 1e9; a.forEach((e, i) => { const q = Math.abs(e.getBoundingClientRect().y - y); if (q < d) { d = q; best = i } }); return best }, bm.y)
    await s.pressAt(buttons.nth(idx), { ms: 450 })
    await s.rec_(350)
    await s.hideCursor()
    await s.page.locator('textarea:visible').first().click()
    await s.type('Between us: can we hold the date?', { cps: 24 })
    await s.rec_(180)
    await s.page.keyboard.press('Enter')
    await s.rec_(2500)
    s.meta(); await s.close()
  },
  async tabs() {
    const s = await start({ name: 'tabs' })
    await ask(s, 'build a preorder tracker by region')
    s.shot('tabs', { x: 704, y: 52, width: 800, height: 888 })
    await s.rec_(3400)
    const tab = s.page.locator('[role=tab]:visible', { hasText: 'Preorder by region' }).first()
    const b = await tab.boundingBox()
    await s.setCursor(b.x - 60, b.y + 150)
    await s.pressAt(tab, { ms: 650 })
    await s.rec_(1800)
    s.meta(); await s.close()
  },
  async callwide() { await call('callwide', 2300, 1040) },
  async callsquare() { await call('callsquare', 1512, 949) },
}

async function call(name, width, height) {
  const s = await start({ dsf: 3, name, width, height })
  await s.page.addStyleTag({ content: '.cv-captions,.cv-caption,.cv-cc{display:none!important}' }) // the film sets its own larger captions
  await s.page.locator('button[aria-label="Start a call"]:visible').first().click()
  await s.tick(2)
  const b = await s.page.locator('.cv-stage:visible').first().boundingBox()
  const box = { x: Math.floor(b.x), y: Math.floor(b.y), width: Math.ceil(b.width), height: Math.ceil(b.height) }
  s.shot(name, box)
  const t0 = await s.page.evaluate(() => Date.now())
  // Record until Léa has said her line, however long the app's opening has become.
  let heardAt = null
  for (let sec = 0; sec < 120; sec++) {
    await s.rec_(1000)
    const p = (await s.plays()).find((x) => x.src.includes(LEA_LINE))
    if (p && heardAt === null) heardAt = p.at
    if (heardAt !== null && (await s.page.evaluate(() => Date.now())) - heardAt > LEA_TAIL * 1000) break
  }
  if (heardAt === null) console.error(`WARNING ${name}: ${LEA_LINE} never played`)
  const plays = (await s.plays()).filter((p) => /voice\//.test(p.src)).map((p) => ({ file: p.src.split('/').pop(), at: (p.at - t0) / 1000 }))
  s.meta({ plays }); console.log(JSON.stringify(plays)); await s.close()
}

const list = process.argv.slice(2)
for (const n of list.length ? list : Object.keys(SHOTS)) { const t = Date.now(); await SHOTS[n](); console.log(n, Math.round((Date.now() - t) / 1000) + 's') }
