/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Frame-accurate capture of the real app. The page clock is faked, CSS animations are stepped by hand,
// so one frame = exactly 1/30 s of app time however long the screenshot takes. No real-time recording.
import { chromium } from '../../node_modules/playwright/index.mjs'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const SCRATCH = process.env.FILM_SCRATCH ?? '/private/tmp/claude-502/-Users-0104389S/a60853bb-6655-4d82-acf6-a5c639d40492/scratchpad/film'
export const APP = process.env.FILM_APP ?? 'http://localhost:5187/one-place/'
const pwDir = join(homedir(), 'Library/Caches/ms-playwright')
const chromiumDir = readdirSync(pwDir).find((d) => /^chromium-\d+/.test(d))
const executablePath = join(pwDir, chromiumDir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')
export const FPS = 30
const DT = 1000 / FPS

/** A big white hand with a black outline, the pointer of product films. Injected on top of the real page. */
const HAND = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="44" height="44"><path d="M12.2 3.2c-1.3 0-2.3 1-2.3 2.3V17l-2.5-2.4c-1-.9-2.5-.9-3.4 0-.9.9-.9 2.3-.1 3.2l6.6 8c1.5 1.8 3.7 2.9 6 2.9h3.1c4.2 0 7.6-3.4 7.6-7.6v-6.5c0-1.2-1-2.2-2.2-2.2-.5 0-1 .2-1.4.5-.2-1-1.1-1.7-2.1-1.7-.6 0-1.1.2-1.5.6-.3-.9-1.1-1.5-2.1-1.5-.5 0-1 .2-1.4.5V5.5c0-1.3-1-2.3-2.3-2.3Z" fill="#fff" stroke="#1f1f1f" stroke-width="1.7" stroke-linejoin="round"/><path d="M14.5 12v7M18.2 12.6V19M21.9 13.6V19" fill="none" stroke="#1f1f1f" stroke-width="1.4" stroke-linecap="round"/></svg>`

export async function open({ width = 1512, height = 949, dsf = 3, name, css = '' }) {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'] })
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, locale: 'en-US', colorScheme: 'light', reducedMotion: 'no-preference' })
  const page = await context.newPage()
  page.on('pageerror', (e) => console.error('PAGE ERROR', e.message))
  // Audio is mixed afterwards from the same clips. Here every play() is logged with its clock time and refused,
  // which puts the app on its silent path, whose length comes from the same manifest.
  await page.addInitScript(() => {
    window.__plays = []
    HTMLMediaElement.prototype.play = function () { window.__plays.push({ src: this.src || this.currentSrc, at: Date.now() }); return Promise.reject(new DOMException('film capture', 'NotSupportedError')) }
    // no camera or mic in the capture: real tiles use photos
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('film', 'NotFoundError'))
  })
  const start = new Date(); start.setHours(10, 12, 0, 0)
  await page.clock.install({ time: start })
  await page.goto(APP, { waitUntil: 'load' })
  await page.clock.pauseAt(new Date(start.getTime() + 3000)) // from here on, time moves only when a frame says so
  await page.addStyleTag({ content: `
    #film-hand{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;width:44px;height:44px;transform-origin:30% 10%;will-change:transform;margin:-3px 0 0 -14px;filter:drop-shadow(0 3px 8px rgba(11,87,208,.18))}
    ${css}` })
  await page.evaluate((h) => { const d = document.createElement('div'); d.id = 'film-hand'; d.innerHTML = h; d.style.opacity = '0'; document.body.append(d) }, HAND)
  const s = new Session(page, browser, name)
  await s.tick(1) // first paint
  return s
}

const ease = (t) => { // emphasized: quick start, long soft landing
  const u = Math.min(1, Math.max(0, t))
  return 1 - Math.pow(1 - u, 3.2)
}
const inOut = (t) => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u) }

export class Session {
  constructor(page, browser, name) { this.page = page; this.browser = browser; this.name = name; this.clip = null; this.frame = 0; this.rec = false; this.cursor = { x: 0, y: 0, shown: false, press: 0 }; this.events = [] }
  /** Runs the page's clock and animations by one frame, without recording. */
  async advance() {
    await this.page.clock.runFor(DT)
    await this.page.evaluate((dt) => new Promise((res) => {
      const ch = new MessageChannel()
      let n = 0
      ch.port1.onmessage = () => {
        if (++n < 3) { ch.port2.postMessage(0); return }
        for (const a of document.getAnimations()) {
          if (a.__film === undefined) { a.pause(); a.__film = Number(a.currentTime ?? 0); continue }
          if (a.playState === 'finished') continue
          a.__film += dt
          const end = a.effect?.getComputedTiming().endTime
          if (Number.isFinite(end) && a.__film >= end) { try { a.finish() } catch { a.currentTime = a.__film } } else a.currentTime = a.__film
        }
        res()
      }
      ch.port2.postMessage(0)
    }), DT)
  }
  async tick(n = 1) { for (let i = 0; i < n; i++) await this.advance() }
  /** Skips n ms of app time quickly (nothing is recorded, animations still end properly). */
  async skip(ms) { await this.tick(Math.round(ms / DT)) }
  shot(name, clip) {
    this.shotName = name; this.clip = clip; this.frame = 0
    this.dir = join(SCRATCH, 'cap', name); mkdirSync(this.dir, { recursive: true })
    for (const f of readdirSync(this.dir)) if (f.endsWith('.jpg')) { /* overwritten below */ }
    this.times = []; this.shotStart = Date.now()
  }
  async snap() {
    const p = join(this.dir, String(this.frame).padStart(5, '0') + '.jpg')
    await this.page.screenshot({ path: p, type: 'jpeg', quality: 94, clip: this.clip ?? undefined, animations: 'allow', caret: 'initial', scale: 'device' })
    this.frame++
  }
  /** Records ms of app time, one screenshot a frame. fn(t01) runs before each frame. */
  async rec_(ms, fn) {
    const n = Math.round(ms / DT)
    for (let i = 0; i < n; i++) {
      if (fn) await fn((i + 1) / n)
      await this.advance()
      await this.snap()
    }
  }
  async setCursor(x, y, press = 0) {
    this.cursor.x = x; this.cursor.y = y; this.cursor.press = press
    await this.page.mouse.move(x, y)
    await this.page.evaluate(([x, y, p]) => { const d = document.getElementById('film-hand'); d.style.opacity = '1'; d.style.transform = `translate(${x}px,${y}px) scale(${1 - p * .14})` }, [x, y, press])
  }
  async hideCursor() { await this.page.evaluate(() => { document.getElementById('film-hand').style.opacity = '0' }) }
  async moveTo(x, y, ms = 700, record = true) {
    const { x: x0, y: y0 } = this.cursor
    const f = (t) => { const e = inOut(t); return this.setCursor(x0 + (x - x0) * e, y0 + (y - y0) * e) }
    if (record) await this.rec_(ms, f); else await f(1)
  }
  async pressAt(sel, { ms = 650, rec = true, offset = [0.5, 0.5] } = {}) {
    const el = typeof sel === 'string' ? this.page.locator(sel).first() : sel
    const b = await el.boundingBox()
    const x = b.x + b.width * offset[0], y = b.y + b.height * offset[1]
    await this.moveTo(x, y, ms, rec)
    if (rec) { await this.rec_(100, (t) => this.setCursor(x, y, t)) }
    await this.page.mouse.down(); await this.page.mouse.up()
    if (rec) { await this.rec_(130, (t) => this.setCursor(x, y, 1 - t)) } else { await this.setCursor(x, y, 0) }
  }
  /** Types as a person: chars per second, a touch of unevenness that stays deterministic. */
  async type(text, { cps = 22, rec = true } = {}) {
    let carry = 0, i = 0
    const chars = [...text]
    while (i < chars.length) {
      carry += (cps / FPS) * (0.75 + 0.5 * (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) / 2)
      while (carry >= 1 && i < chars.length) { await this.page.keyboard.type(chars[i++]); carry -= 1 }
      await this.advance()
      if (rec) await this.snap()
    }
  }
  async plays() { return this.page.evaluate(() => window.__plays) }
  meta(extra = {}) {
    writeFileSync(join(this.dir, 'meta.json'), JSON.stringify({ frames: this.frame, fps: FPS, clip: this.clip, ...extra }, null, 1))
    console.log(`  ${this.shotName}: ${this.frame} frames`)
  }
  async close() { await this.browser.close() }
}
