#!/usr/bin/env node
/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Renders film/film.html frame by frame with real motion blur (several samples inside a 180 degree shutter),
// and pipes to ffmpeg. Usage:
//   node render.mjs --format 16x9 --out out/film.mp4 [--audio audio/mix.wav] [--samples 4] [--workers 5] [--from 0 --to 60] [--fps 30]
//   node render.mjs --format 1x1 --stills 3.2,14 --dir out/stills
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ffmpegPath from 'ffmpeg-static'
import { chromium } from '../node_modules/playwright/index.mjs'
import { callTimes } from './capture/call-cuts.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const SCRATCH = process.env.FILM_SCRATCH ?? '/private/tmp/claude-502/-Users-0104389S/a60853bb-6655-4d82-acf6-a5c639d40492/scratchpad/film'
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d }
const FORMAT = arg('format', '16x9'), FPS = +arg('fps', 30), SAMPLES = +arg('samples', 4), WORKERS = +arg('workers', 5)
const pwDir = join(homedir(), 'Library/Caches/ms-playwright')
const executablePath = join(pwDir, readdirSync(pwDir).find((d) => /^chromium-\d+/.test(d)), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')
const W = FORMAT === '16x9' ? 1920 : 1080, H = 1080

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' }
function serve() {
  const PUBLIC = process.env.FILM_PUBLIC ?? join(here, '../public')
  const roots = { '/cap/': join(SCRATCH, 'cap/'), '/film/': join(here, 'film/'), '/fonts/': join(PUBLIC, 'fonts/'), '/workspace/': join(PUBLIC, 'workspace/'), '/avatars/': join(PUBLIC, 'avatars/'), '/call/': join(PUBLIC, 'call/') }
  const srv = createServer((q, r) => {
    const p = decodeURIComponent(q.url.split('?')[0])
    const pre = Object.keys(roots).find((k) => p.startsWith(k))
    const f = pre ? join(roots[pre], p.slice(pre.length)) : null
    if (!f || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); r.end(); return }
    r.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream', 'cache-control': 'max-age=600' })
    createReadStream(f).pipe(r)
  })
  return new Promise((res) => srv.listen(0, '127.0.0.1', () => res({ srv, port: srv.address().port })))
}
const frameCounts = () => {
  const out = {}
  for (const d of readdirSync(join(SCRATCH, 'cap'))) { const m = join(SCRATCH, 'cap', d, 'meta.json'); if (existsSync(m)) out[d] = JSON.parse(readFileSync(m, 'utf8')).frames }
  return out
}
async function openPage(port) {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text', '--disable-gpu-vsync'] })
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('PAGE ERROR', e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) console.error('CONSOLE', m.text()) })
  await page.addInitScript(([c, t]) => { window.__FRAMES = c; window.__CALL = t }, [frameCounts(), { wide: callTimes(SCRATCH, 'callwide'), square: callTimes(SCRATCH, 'callsquare') }])
  await page.goto(`http://127.0.0.1:${port}/film/film.html?format=${FORMAT}`, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => window.__ready())
  // Chromium can report a smaller surface for the very first frames: wait for the real one.
  await page.waitForFunction(([w, h]) => innerWidth === w && innerHeight === h, [W, H])
  return { browser, page }
}
const cdpShot = async (page, client, type = 'jpeg') => {
  const { data } = await client.send('Page.captureScreenshot', { format: type, quality: 97, captureBeyondViewport: false, clip: { x: 0, y: 0, width: W, height: H, scale: 1 }, fromSurface: true })
  return Buffer.from(data, 'base64')
}
async function chunk(port, a, b, file, idx) {
  for (let attempt = 1; ; attempt++) {
    try { return await chunkOnce(port, a, b, file, idx) } catch (e) {
      console.error(`worker ${idx}: attempt ${attempt} failed: ${e.message}`)
      if (attempt >= 3) throw e
    }
  }
}
async function chunkOnce(port, a, b, file, idx) {
  const { browser, page } = await openPage(port)
  const client = await page.context().newCDPSession(page)
  const ff = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS * SAMPLES), '-c:v', 'mjpeg', '-i', '-',
    '-vf', `tmix=frames=${SAMPLES}:weights=${Array(SAMPLES).fill(1).join(' ')},select='not(mod(n+1\\,${SAMPLES}))',setpts=N/(${FPS}*TB),scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p`,
    '-r', String(FPS),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', arg('crf', '13'), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-x264-params', 'keyint=60:bframes=2', file], { stdio: ['pipe', 'inherit', 'inherit'] })
  let dead = null
  const closed = new Promise((r) => ff.on('close', r))
  ff.on('close', (c) => { dead = c === 0 ? null : new Error('ffmpeg exit ' + c) })
  ff.stdin.on('error', (e) => { dead = e })
  const failed = () => { if (dead) { browser.close().catch(() => {}); throw dead } }
  const shutter = .5 / FPS // 180 degrees
  let done = 0
  for (let f = a; f < b; f++) {
    for (let s = 0; s < SAMPLES; s++) {
      const t = f / FPS + (SAMPLES === 1 ? 0 : (s / SAMPLES) * shutter)
      await page.evaluate((x) => window.__render(x), t)
      const buf = await cdpShot(page, client)
      failed()
      if (!ff.stdin.write(buf)) await Promise.race([new Promise((r) => ff.stdin.once('drain', r)), closed])
      failed()
    }
    if (++done % 150 === 0) console.log(`  worker ${idx}: ${done}/${b - a}`)
  }
  ff.stdin.end()
  await closed
  failed()
  await browser.close()
}
const run = (args) => new Promise((res, rej) => { const p = spawn(ffmpegPath, args, { stdio: ['ignore', 'inherit', 'inherit'] }); p.on('close', (c) => c === 0 ? res() : rej(new Error('ffmpeg ' + c))) })

const { srv, port } = await serve()
if (arg('stills')) {
  const dir = resolve(arg('dir', join(SCRATCH, 'stills'))); mkdirSync(dir, { recursive: true })
  const { browser, page } = await openPage(port)
  for (const s of arg('stills').split(',')) {
    await page.evaluate((x) => window.__render(x), +s)
    await page.screenshot({ path: join(dir, `${FORMAT}-${(+s).toFixed(2).padStart(6, "0")}.jpg`), type: 'jpeg', quality: 92 })
  }
  await browser.close(); srv.close(); process.exit(0)
}
if (arg('audit')) {
  const { browser, page } = await openPage(port)
  const dur = await page.evaluate(() => window.__DURATION)
  const bad = new Map()
  for (let t = 0; t < dur; t += +arg('audit')) {
    const r = await page.evaluate((x) => { window.__render(x); return window.__auditText(x) }, t)
    for (const b of r) if (!bad.has(b)) { bad.set(b, t); console.log(t.toFixed(2), b) }
  }
  console.log('audit done:', bad.size, 'issues')
  await browser.close(); srv.close(); process.exit(0)
}
const { browser: b0, page: p0 } = await openPage(port)
const DUR = await p0.evaluate(() => window.__DURATION); await b0.close()
const from = +arg('from', 0), to = +arg('to', DUR)
const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS)
const out = resolve(arg('out', join(SCRATCH, `film-${FORMAT}.mp4`)))
mkdirSync(dirname(out), { recursive: true })
const tmp = join(SCRATCH, 'chunks-' + FORMAT); mkdirSync(tmp, { recursive: true })
const started = Date.now()
const n = Math.min(WORKERS, Math.max(1, Math.ceil((f1 - f0) / 30)))
const parts = Array.from({ length: n }, (_, i) => ({ a: f0 + Math.floor((f1 - f0) * i / n), b: f0 + Math.floor((f1 - f0) * (i + 1) / n), file: join(tmp, `p${i}.mp4`) }))
await Promise.all(parts.map((p, i) => chunk(port, p.a, p.b, p.file, i)))
const listFile = join(tmp, 'list.txt'); writeFileSync(listFile, parts.map((p) => `file '${p.file}'`).join('\n'))
const audio = arg('audio')
await run(['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile, ...(audio ? ['-i', audio] : []), '-c:v', 'copy', ...(audio ? ['-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest'] : []), '-movflags', '+faststart', '-metadata', 'title=One Place, a concept by Alexandre Cormeraie', '-metadata', 'artist=Alexandre Cormeraie', '-metadata', 'comment=A concept. Not a Google product.', out])
for (const p of parts) unlinkSync(p.file)
unlinkSync(listFile)
console.log(`rendered ${out} in ${Math.round((Date.now() - started) / 1000)}s`)
srv.close(); process.exit(0)
