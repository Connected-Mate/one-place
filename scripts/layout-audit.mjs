#!/usr/bin/env node
/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Walks every screen at every size and fails on layout defects a person would see:
// text cut without an ellipsis, placeholders that don't fit, a page that scrolls sideways,
// controls off screen or covered by something else, icons shown as words.
// Usage: AUDIT_URL=http://localhost:4173/one-place/ npm run audit:layout
import { chromium } from 'playwright'

const URL_ = process.env.AUDIT_URL ?? 'http://localhost:4173/one-place/'
const SIZES = [
  ['desktop', 1512, 949], ['small-laptop', 1280, 720], ['wide', 1920, 1080],
  ['tablet-land', 1180, 820], ['tablet-port', 820, 1180], ['phone', 390, 844], ['small-phone', 360, 640], ['phone-land', 844, 390],
]

/** Runs in the page. Returns the defects on the current screen. */
const inspect = () => {
  const out = []
  const name = (el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ').filter(Boolean).slice(0, 2).join('.')}`
  const shown = (el) => {
    const r = el.getBoundingClientRect(); const c = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && +c.opacity > 0.05 && !el.closest('[hidden],[inert],.sr-only')
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`page scrolls sideways by ${document.documentElement.scrollWidth - innerWidth}px`)
  const ctx = document.createElement('canvas').getContext('2d')
  for (const el of document.querySelectorAll('input[placeholder],textarea[placeholder]')) {
    if (!shown(el) || el.value) continue
    const c = getComputedStyle(el); ctx.font = `${c.fontWeight} ${c.fontSize} ${c.fontFamily}`
    const room = el.clientWidth - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight)
    const w = ctx.measureText(el.placeholder).width
    if (w > room + 1 && c.textOverflow !== 'ellipsis') out.push(`placeholder cut: "${el.placeholder}" needs ${Math.round(w)}px, has ${Math.round(room)}px`)
    if (w > room + 1 && c.textOverflow === 'ellipsis' && el.tagName === 'TEXTAREA' && c.whiteSpace !== 'nowrap') out.push(`placeholder wraps: "${el.placeholder}"`)
  }
  for (const el of document.querySelectorAll('body *')) {
    if (!shown(el) || el.closest('svg,canvas,.ms,[data-audit-skip]')) continue
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    if (!own) continue
    const c = getComputedStyle(el)
    const clips = /hidden|clip/.test(c.overflowX + c.overflowY)
    const r = el.getBoundingClientRect()
    if (clips) {
      const handled = c.textOverflow === 'ellipsis' || c.webkitLineClamp !== 'none'
      if (!handled && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2)) out.push(`text cut: ${name(el)} "${el.textContent.trim().slice(0, 40)}"`)
    }
    // text cut by a clipping ancestor (the case of a line falling out of a pill)
    for (let a = el.parentElement, i = 0; a && i < 4; a = a.parentElement, i++) {
      const ac = getComputedStyle(a)
      if (!/hidden|clip/.test(ac.overflowY) || c.webkitLineClamp !== 'none' || a.scrollHeight > a.clientHeight + 40) continue
      const ar = a.getBoundingClientRect()
      if (r.bottom > ar.bottom + 2 && r.top < ar.bottom - 2 && r.height < 80 && a.scrollHeight <= a.clientHeight + 40) { out.push(`text falls out of its box: ${name(el)} "${el.textContent.trim().slice(0, 40)}" in ${name(a)}`); break }
    }
  }
  for (const el of document.querySelectorAll('.ms')) {
    if (shown(el) && el.getBoundingClientRect().width > parseFloat(getComputedStyle(el).fontSize) * 1.6) out.push(`icon shown as a word: ${el.textContent}`)
  }
  for (const el of document.querySelectorAll('button,a[href],input,textarea,[role=tab]')) {
    if (!shown(el) || el.disabled) continue
    const r = el.getBoundingClientRect()
    let scroller = false
    for (let a = el.parentElement; a; a = a.parentElement) { const ov = getComputedStyle(a); if (/auto|scroll/.test(ov.overflowX + ov.overflowY)) { scroller = true; break } }
    if (scroller) continue // reachable by scrolling
    if (r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1 || r.top < -1) { out.push(`control off screen: ${name(el)} "${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 30)}"`); continue }
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    if (hit && hit !== el && !el.contains(hit) && !hit.contains(el) && !el.closest('[aria-hidden=true]')) out.push(`control covered: ${name(el)} "${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 30)}" by ${name(hit)}`)
  }
  return [...new Set(out)]
}

const browser = await chromium.launch(process.env.AUDIT_CHROME ? { executablePath: process.env.AUDIT_CHROME } : {})
const defects = []
let screens = 0
for (const [device, width, height] of SIZES) {
  const touch = width < 900 || height < 500
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, locale: 'en-US' })
  const page = await context.newPage()
  page.on('pageerror', (e) => defects.push(`${device} JS error: ${e.message}`))
  const check = async (where) => {
    await page.waitForTimeout(450)
    screens++
    for (const d of await page.evaluate(inspect)) defects.push(`${device} > ${where}: ${d}`)
  }
  await page.goto(URL_)
  await page.waitForSelector('.wel-stage')
  await page.waitForTimeout(1800)
  await check('welcome')
  await page.keyboard.press('Escape')
  await check('home')

  // A project with a very long name is the classic trap.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('one-place') ?? '{}')
    return raw
  })
  const projects = await page.evaluate(() => JSON.parse(localStorage.getItem('one-place') ?? '{}')?.state?.projects?.map((p) => p.id) ?? [])
  for (const id of projects) {
    await page.evaluate((pid) => window.__opStore?.getState().selectProject(pid), id)
    await check(`${id} chat`)
    await page.evaluate(() => window.__opStore?.getState().setMobilePane('pane'))
    await check(`${id} overview`)
    const tabs = await page.locator('[role=tab]').count()
    for (let i = 1; i < Math.min(tabs, 14); i++) {
      const tab = page.locator('[role=tab]').nth(i)
      if (!(await tab.isVisible().catch(() => false))) continue
      const label = (await tab.innerText().catch(() => '')).trim().replace(/\s+/g, ' ').slice(0, 24)
      await tab.click({ timeout: 2000 }).catch(() => {})
      await check(`${id} tab ${label}`)
    }
    await page.evaluate(() => window.__opStore?.getState().setPane({ type: 'board' }))
  }

  await page.evaluate(() => {
    const s = window.__opStore?.getState()
    s?.createProject('An extremely long project name that nobody should ever have to type but somebody always does', 'launch')
    s?.setMobilePane('chat')
  })
  await check('long name chat')
  await page.evaluate(() => window.__opStore?.getState().setMobilePane('pane'))
  await check('long name board')
  await context.close()
}
await browser.close()

const unique = [...new Set(defects)]
console.log(`${screens} screens checked at ${SIZES.length} sizes, ${unique.length} defects`)
for (const d of unique) console.log(' -', d)
process.exit(unique.length ? 1 : 0)
