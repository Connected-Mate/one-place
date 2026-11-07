/*!
 * One Place, the film. Concept, product and design by Alexandre Cormeraie, product manager.
 * Deterministic: everything on screen is a pure function of the time t.
 */
const params = new URLSearchParams(location.search)
const FORMAT = params.get('format') === '1x1' ? '1x1' : '16x9'
const WIDE = FORMAT === '16x9'
const W = WIDE ? 1920 : 1080, H = 1080
const stage = document.getElementById('stage')
stage.style.width = W + 'px'; stage.style.height = H + 'px'
document.documentElement.style.background = '#fff'

/* ---------- easing ---------- */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const lerp = (a, b, t) => a + (b - a) * t
function bez(x1, y1, x2, y2) {
  return (x) => {
    if (x <= 0) return 0; if (x >= 1) return 1
    let lo = 0, hi = 1, t = x
    for (let i = 0; i < 24; i++) { t = (lo + hi) / 2; const cx = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3; if (cx < x) lo = t; else hi = t }
    return 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3
  }
}
const emph = bez(.05, .7, .1, 1), acc = bez(.45, 0, .9, .25), std = bez(.3, 0, 0, 1), smooth = bez(.4, 0, .2, 1)
const prog = (t, a, b) => clamp((t - a) / (b - a))
/** Keyframes: [[t, value], ...], eased between each pair. */
const track = (t, kf, ease = smooth) => {
  if (t <= kf[0][0]) return kf[0][1]
  for (let i = 1; i < kf.length; i++) if (t <= kf[i][0]) return lerp(kf[i - 1][1], kf[i][1], ease(prog(t, kf[i - 1][0], kf[i][0])))
  return kf[kf.length - 1][1]
}
const rng = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296 }

/* ---------- dom ---------- */
const el = (tag, cls, parent, style) => { const e = document.createElement(tag); if (cls) e.className = cls; if (style) for (const [k, v] of Object.entries(style)) { if (k.startsWith('--')) e.style.setProperty(k, v); else e.style[k] = v } if (parent) parent.appendChild(e); return e }
const APPS = [['gmail', 'Gmail'], ['chat', 'Chat'], ['calendar', 'Calendar'], ['meet', 'Meet'], ['docs', 'Docs'], ['sheets', 'Sheets'], ['slides', 'Slides'], ['drive', 'Drive'], ['tasks', 'Tasks'], ['keep', 'Keep']]
const GEMINI_ICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset=".28" stop-color="#4285f4"/><stop offset=".5" stop-color="#9b72cb"/><stop offset=".72" stop-color="#d96570"/></linearGradient></defs><path fill="url(#g)" d="M12 0C12.6 6.6 17.4 11.4 24 12 17.4 12.6 12.6 17.4 12 24 11.4 17.4 6.6 12.6 0 12 6.6 11.4 11.4 6.6 12 0Z"/></svg>')}`
const icon = (n) => n === 'gemini' ? GEMINI_ICON : n === 'tasks' ? '/workspace/tasks.png' : `/workspace/${n}.svg`
const pending = new Set()
const whenLoaded = (img) => { if (!img.complete) pending.add(new Promise((r) => { img.onload = img.onerror = r })) }
const imgEl = (src, parent, style, cls) => { const i = el('img', cls, parent, style); i.decoding = 'sync'; i.src = src; whenLoaded(i); return i }

/* ---------- type ---------- */
/**
 * A text block. lines: [[token,...],...]; a token is a string (words), {t,blue} or {i:'gmail'}.
 * Every character is its own span, so type-on and word-by-word work from measured positions.
 */
function textBlock(parent, lines, { size, maxW = W - 180, gap = 0 }) {
  const box = el('div', 'center', parent)
  const inner = el('div', '', box, { fontSize: size + 'px', position: 'relative' })
  const items = []
  const lineEls = lines.map((line) => {
    const le = el('div', 'tline', inner)
    line.forEach((tok) => {
      if (tok.i) {
        const t = el('span', 'tile tok', le); imgEl(icon(tok.i), t)
        items.push({ kind: 'icon', e: t, line: le })
      } else {
        const text = typeof tok === 'string' ? tok : tok.t
        text.split(/( )/).forEach((w) => {
          if (!w) return
          if (w === ' ') { const sp = el('span', 'tok', le); sp.textContent = ' '; items.push({ kind: 'space', e: sp, line: le }); return }
          const we = el('span', 'tok' + (tok.blue ? ' blue' : ''), le)
          const chars = [...w].map((c) => { const ch = el('span', 'ch', we); ch.textContent = c; return ch })
          items.push({ kind: 'word', e: we, chars, line: le })
        })
      }
    })
    return le
  })
  return { box, inner, items, lineEls, fit() {
    let widest = 0; lineEls.forEach((l) => { widest = Math.max(widest, [...l.children].reduce((a, c) => a + c.offsetWidth + parseFloat(getComputedStyle(c).marginLeft) * 2, 0)) })
    if (widest > maxW) inner.style.fontSize = (size * maxW / widest) + 'px'
  } }
}
/** Words come up one by one, soft focus to sharp. */
function revealWords(b, t, t0, stagger = .1, dur = .42) {
  let i = 0
  b.items.forEach((it) => {
    if (it.kind === 'space') return
    const p = emph(prog(t, t0 + i * stagger, t0 + i * stagger + dur))
    it.e.style.opacity = prog(t, t0 + i * stagger, t0 + i * stagger + .1)
    const pop = it.kind === 'icon' ? ` scale(${lerp(.55, 1, p)})` : ''
    it.e.style.transform = `translateY(${(1 - p) * .34}em)${pop}`
    it.e.style.filter = p > .985 ? 'none' : `blur(${(1 - p) * .05}em)`
    i++
  })
}
/** The line types itself, the caret in the color of what comes next, and the block stays centered as it grows. */
function revealType(b, t, t0, cps, caretColors = ['#4285f4']) {
  if (!b.caret) { b.caret = el('div', 'caret', b.inner); b.seq = []; b.items.forEach((it) => { if (it.kind === 'word') it.chars.forEach((c) => b.seq.push({ e: c, it })); else b.seq.push({ e: it.e, it, solid: true }) }) }
  const n = (t - t0) * cps, last = Math.floor(n)
  let tip = null
  b.seq.forEach((s, i) => {
    const on = i <= last
    s.e.style.opacity = on ? 1 : 0
    if (s.solid && s.it.kind === 'icon') s.e.style.transform = `scale(${lerp(.6, 1, emph(prog(n, i, i + 4)))})`
    if (on) tip = s
  })
  const ir = b.inner.getBoundingClientRect ? b.inner : null
  const blockW = b.inner.offsetWidth
  let x = 0, y = 0, lineW = 0
  if (tip) { const r = rectIn(tip.e, b.inner); x = r.x + r.w; y = r.y + r.h / 2 }
  const showCaret = t >= t0 - 1 && (t < t0 + b.seq.length / cps + .55)
  b.caret.style.opacity = showCaret ? 1 : 0
  b.caret.style.left = (tip ? x + 2 : blockW / 2) + 'px'
  b.caret.style.top = (tip ? y : b.inner.offsetHeight / 2) + 'px'
  b.caret.style.background = caretColors[Math.min(caretColors.length - 1, Math.floor(prog(n, 0, b.seq.length) * caretColors.length))]
  // recenter: the visible part stays in the middle of the frame
  const shift = tip ? (blockW - x) / 2 : 0
  const lines = new Set(b.seq.slice(0, last + 1).map((s) => s.it.line)).size
  b.inner.style.transform = `translateX(${b.lineEls.length === 1 ? shift : 0}px)`
}
function rectIn(e, root) { let x = 0, y = 0, n = e; while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent } return { x, y, w: e.offsetWidth, h: e.offsetHeight } }

/* ---------- segments ---------- */
const CONVEY = .46 // vertical whip between segments
const segments = []
function segment(name, start, end, build, update, opts = {}) {
  const layer = el('div', 'layer', stage); layer.style.display = 'none'
  const s = { name, start, end, layer, update, opts, built: false, build }
  segments.push(s); return s
}
/** Everything travels on one vertical axis: the outgoing shot leaves upward, the next rises from below. */
function travel() { return 0 } // every cut is a hard cut, on the beat
function cutIn(s, t) { return s.opts.noIn ? 1 : prog(t, s.start, s.start + .12) }

/* ---------- film footage ---------- */
const META = window.__META = {}
/** A floating crop of the real app. cam(t) gives center and zoom in the source's css pixels. */
function footage(parent, shot, { rect, radius = 36, shadow = true, feather = null }) {
  const sh = el('div', shadow ? 'fshadow' : '', parent, { position: 'absolute', left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px', '--r': radius + 'px' })
  const card = el('div', 'fcard', sh, { '--r': radius + 'px', background: shadow ? '#fff' : 'transparent' })
  if (feather) { const m = featherMask(feather); card.style.webkitMaskImage = m; card.style.maskImage = m; card.style.webkitMaskComposite = 'source-in'; card.style.maskComposite = 'intersect' }
  const img = el('img', '', card); img.decoding = 'sync'
  return { sh, card, img, shot, rect, dsf: window.__SHOTS?.[shot]?.dsf ?? 3, fps: window.__SHOTS?.[shot]?.fps ?? 30, last: -1 }
}
function featherMask({ l = 0, r = 0, t = 0, b = 0 }) {
  const lin = (dir, a, z) => `linear-gradient(to ${dir}, transparent 0, #000 ${a}px, #000 calc(100% - ${z}px), transparent 100%)`
  return [lin('right', l, r), lin('bottom', t, b)].join(',')
}
const dsfOf0 = { home: 3, type: 8, answer: 5, block: 6, docs: 4, callwide: 3, callsquare: 3, chat: 5, overview: 3 }
const frameJobs = []
function setFootage(f, ft, cam) {
  const idx = Math.max(0, Math.min((window.__SHOTS?.[f.shot]?.frames ?? 1e9) - 1, Math.floor(ft * f.fps + 1e-6)))
  if (idx !== f.last) {
    f.last = idx
    const url = `/cap/${f.shot}/${String(idx).padStart(5, '0')}.jpg`
    f.img.src = url
    frameJobs.push(f.img.decode().catch(() => {}))
  }
  const k = cam.zoom / f.dsf
  const tx = f.rect.w / 2 - cam.x * cam.zoom, ty = f.rect.h / 2 - cam.y * cam.zoom
  f.img.style.transform = `translate(${tx}px,${ty}px) scale(${k})`
}
/** Slow, living tilt: a few degrees, never still. */
function tilt(e, t, a, b, rx, ry, rz = 0, drift = 1.6) {
  const u = prog(t, a, b)
  const swing = 1 - emph(prog(t, a, a + .8)) // the card lands: it swings flat as it arrives
  e.style.transform = `rotateX(${rx + drift * .6 * (u - .5) + swing * 15}deg) rotateY(${ry - drift * (u - .5) + swing * ry * 2.2}deg) rotateZ(${rz + swing * -1.6}deg)`
}

/* ---------- the story ---------- */
const FS = WIDE ? 188 : 138
const MAXW = WIDE ? W - 200 : W - 120
const lines = (wide, square) => (WIDE ? wide : square)
function statement(name, start, end, wide, square, { mode = 'words', stagger = .15, t0 = 0, size = FS, opts = {}, carets, cps = 17, extra } = {}) {
  let b
  return segment(name, start, end, (s) => { b = textBlock(s.layer, lines(wide, square), { size, maxW: MAXW }); extra?.build?.(s) }, (s, t) => {
    if (!b.fitted) { b.fit(); b.fitted = true }
    const lt = t - s.start
    if (mode === 'type') revealType(b, lt, t0, cps, carets); else revealWords(b, lt, t0, .15)
    const push = 1 + .022 * smooth(prog(t, s.start, s.end + .2))
    const y = travel(s, t)
    s.layer.style.transform = `translateY(${y}px)`
    b.box.style.transform = `scale(${push})`
    extra?.update?.(s, t)
  }, opts)
}

const T = window.__T = window.__TIMELINE // the edit, see film/timeline.mjs
window.__DURATION = T.end[1]

/* -- Hello -- */
statement('hello', ...T.hello, [['Hello Google.']], [['Hello'], ['Google.']], { mode: 'type', t0: 0, cps: 1 / .075, carets: ['#4285f4'], opts: { noIn: true } })
statement('spent', ...T.spent, [['Last quarter, you spent'], [{ t: '$51B', blue: true }, ' to build AI.']], [['Last quarter,'], ['you spent'], [{ t: '$51B', blue: true }, ' to build AI.']], { stagger: .06, t0: .03, size: WIDE ? 168 : 138 })
statement('gmail', ...T.gmail, [['And we still'], ['work in ', { i: 'gmail' }, ' Gmail.']], [['And we still'], ['work in ', { i: 'gmail' }], ['Gmail.']], { stagger: .06, t0: .03 })

/* -- The chaos: an endless thread, tabs piling up, every app shouting -- */
{
  const SUBJ = ['Re: Launch deck v7', 'Fwd: Re: Launch deck v7', 'Re: Fwd: Re: Launch deck FINAL', 'Re: Re: Fwd: Re: FINAL v2', 'Fwd: Re: Re: Fwd: FINAL v3 (2)', 'Re: Fwd: Re: Re: Re: see below', 'Re: Re: Re: Fwd: Re: per my last email', 'Fwd: Re: Re: Re: Fwd: Re: looping in', 'Re: Fwd: Re: Re: Fwd: Re: Re: thoughts?', 'Re: Re: Re: Re: Re: Re: Re: +1']
  const WHO = ['Maya', 'Tom', 'Sofia', 'Karim', 'Léa', 'Jun', 'Priya', 'Ben']
  let rows = [], tabs = [], pops = [], bar, thread, cnt
  const r = rng(11)
  const NPOPS = 96
  segment('chaos', ...T.chaos, (s) => {
    thread = el('div', '', s.layer, { position: 'absolute', left: '50%', top: 0, width: 0, height: 0 })
    for (let i = 0; i < 22; i++) {
      const c = el('div', 'chip', thread, { fontSize: (WIDE ? 40 : 36) + 'px', left: 0, top: 0 })
      imgEl(icon('gmail'), c)
      const w = el('span', '', c); w.textContent = WHO[i % WHO.length] + '   '; w.style.fontWeight = 600; w.style.whiteSpace = 'pre'
      const sb = el('span', '', c); sb.textContent = SUBJ[Math.min(SUBJ.length - 1, Math.floor(i / 2))]; sb.style.fontWeight = 400
      rows.push(c)
    }
    bar = el('div', 'tabbar', s.layer, { height: (WIDE ? 70 : 60) + 'px', paddingTop: '10px', paddingLeft: '10px' })
    const names = ['Inbox (1,204)', 'Chat', 'Calendar', 'Meet', 'Launch plan', 'Budget', 'Deck v7', 'Drive', 'Tasks', 'Notes']
    for (let i = 0; i < 42; i++) {
      const a = APPS[i % 10][0]
      const tb = el('div', 'btab', bar, { fontSize: (WIDE ? 22 : 18) + 'px', height: '100%', padding: '0 14px', flex: '0 0 auto' })
      imgEl(icon(a), tb, { width: '26px', height: '26px', marginRight: '10px' })
      const sp = el('span', '', tb); sp.textContent = names[i % names.length]
      tabs.push({ e: tb, sp })
    }
    for (let i = 0; i < NPOPS; i++) {
      const a = APPS[i % 10]
      const size = i < 10 ? (WIDE ? 158 : 128) : lerp(WIDE ? 110 : 90, WIDE ? 250 : 190, r())
      const e = el('div', 'appt', s.layer, { fontSize: size * .19 + 'px' })
      const box = el('div', 'box', e, { width: size + 'px', height: size + 'px', borderRadius: size * .24 + 'px', background: '#fff', boxShadow: `0 ${size * .16}px ${size * .6}px rgba(66,133,244,.2),0 2px ${size * .12}px rgba(60,64,67,.12)` })
      imgEl(icon(a[0]), box, { width: size * .62 + 'px', height: size * .62 + 'px' })
      const nm = el('div', '', e, { marginTop: size * .09 + 'px', fontWeight: 500, color: '#3c4043' }); nm.textContent = a[1]
      let bd
      if (r() < .62) { bd = el('div', 'badge', e, { fontSize: size * .19 + 'px', minWidth: size * .36 + 'px', height: size * .36 + 'px', padding: `0 ${size * .08}px`, right: -size * .09 + 'px', top: -size * .09 + 'px' }); bd.textContent = String(1 + Math.floor(r() * 99)) }
      const angle = r() * Math.PI * 2
      const margin = (WIDE ? .46 : .44)
      // the first ten land clearly, the others bury them
      const ring = i < 10 ? [[-.36, -.2], [.36, -.26], [-.2, .24], [.22, .3], [-.4, .3], [.42, .12], [0, -.32], [-.1, .4], [.1, -.05], [-.28, 0]][i] : [(r() - .5) * 2 * margin, (r() - .5) * 2 * .42]
      pops.push({ e, x: ring[0] * W, y: ring[1] * H, rot: (r() - .5) * 14, size, seedD: r() })
    }
  }, (s, t) => {
    const lt = (t - s.start) * 1.75
    const collapse = 0 // it never resolves by itself: hard cut at its peak
    // endless thread: rows come up faster and faster, and never stop
    const prg = 1.4 * lt + 2.2 * lt * lt + .45 * lt * lt * lt
    const rowH = WIDE ? 96 : 88
    const SL = rows.length
    const headI = Math.floor(prg)
    rows.forEach((c, k) => {
      // each element serves a moving window of the endless list
      const i = headI - ((headI - k) % SL + SL) % SL
      const appear = emph(prog(prg, i - .05, i + .85))
      const yy = H * .82 - (prg - i - 1) * rowH
      const vis = i >= 0 && appear > 0 && yy > -rowH && yy < H + rowH
      c.style.display = vis ? 'flex' : 'none'
      if (!vis) return
      const wob = Math.sin(i * 2.4) * (WIDE ? 90 : 20)
      c.style.transform = `translate(calc(-50% + ${wob}px),${yy}px) scale(${lerp(.86, 1, appear)})`
      c.style.opacity = appear
      const who = WHO[i % WHO.length], sub = SUBJ[Math.min(SUBJ.length - 1, Math.floor(i / 2))]
      if (c.__i !== i) { c.__i = i; c.children[1].textContent = who + '   '; c.children[2].textContent = sub }
    })
    // tabs multiply and shrink until only icons are left
    const nt = Math.floor(lerp(0, 42, Math.pow(prog(lt, .7, 3.7), 1.7)))
    const widthEach = nt ? Math.min(WIDE ? 260 : 210, (W - 20) / nt) : 0
    bar.style.transform = `translateY(${(1 - emph(prog(lt, .55, 1.05))) * -90}px)`
    tabs.forEach((b, i) => { const on = i < nt; b.e.style.display = on ? 'flex' : 'none'; if (on) { b.e.style.width = widthEach + 'px'; b.e.style.padding = widthEach < 60 ? '0 2px' : '0 12px'; b.sp.style.display = widthEach < 82 ? 'none' : 'inline'; b.e.style.justifyContent = widthEach < 82 ? 'center' : 'flex-start'; b.e.firstChild.style.marginRight = widthEach < 82 ? '0' : '10px'; b.e.firstChild.style.width = b.e.firstChild.style.height = Math.min(26, widthEach * .7) + 'px' } })
    // apps land on the beat, then on every sixteenth
    pops.forEach((p, i) => {
      const at = 1.75 * (i < 10 ? i * .15 : 1.5 + (i - 10) * .0087)
      const u = emph(prog(lt, at, at + .36))
      const vis = lt >= at
      p.e.style.display = vis ? 'flex' : 'none'
      if (!vis) return
      const wob = Math.sin((lt + i) * 1.4) * 8
      const x = lerp(p.x, 0, collapse), y = lerp(p.y, 0, collapse)
      const sc = lerp(.5, 1, u) * (1 - collapse * .92)
      p.e.style.left = W / 2 + 'px'; p.e.style.top = H / 2 + 'px'
      p.e.style.transform = `translate(-50%,-50%) translate(${x}px,${y + wob + (1 - u) * 60}px) rotate(${p.rot * (1 - collapse)}deg) scale(${sc})`
      p.e.style.opacity = prog(lt, at, at + .07)
      p.e.style.zIndex = 10 + i
    })
    thread.style.opacity = 1 - collapse
    thread.style.transform = `scale(${1 - collapse * .6})`
    bar.style.opacity = 1 - collapse
    s.layer.style.transform = `translateY(${(1 - emph(prog(t, s.start, s.start + CONVEY))) * H * .86}px)`
  }, { noOut: true })
}

statement('first', ...T.first, [['Maybe there’s something'], ['to do first.']], [['Maybe there’s'], ['something'], ['to do first.']], { opts: { noIn: true, noOut: true }, size: WIDE ? 160 : 132 })

/* -- The merge, as in the welcome dialog -- */
{
  const svgNS = 'http://www.w3.org/2000/svg'
  const PATHS = [['#4285f4', 'M5 20V17A12 12 0 0 1 17 5H24.3'], ['#ea4335', 'M24 5H31A12 12 0 0 1 43 17V20.3'], ['#fbbc04', 'M43 20V23A12 12 0 0 1 31 35H23.7'], ['#34a853', 'M24 35H21L11.5 43V33.67A12 12 0 0 1 5 23V19.7']]
  window.__logo = (parent, size, style) => {
    const s = document.createElementNS(svgNS, 'svg')
    s.setAttribute('viewBox', '0 0 48 48'); s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('fill', 'none'); s.setAttribute('stroke-width', '6.5'); s.setAttribute('stroke-linejoin', 'round')
    if (style) Object.assign(s.style, style)
    const ps = PATHS.map(([c, d]) => { const p = document.createElementNS(svgNS, 'path'); p.setAttribute('stroke', c); p.setAttribute('d', d); s.appendChild(p); return p })
    parent.appendChild(s)
    return { svg: s, ps }
  }
}

const BOT = (hue) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect x="8" y="14" width="32" height="26" rx="9" fill="${hue}"/><rect x="22.5" y="6" width="3" height="9" rx="1.5" fill="${hue}"/><circle cx="24" cy="6" r="3" fill="${hue}"/><rect x="3" y="22" width="4" height="10" rx="2" fill="${hue}"/><rect x="41" y="22" width="4" height="10" rx="2" fill="${hue}"/><circle cx="18" cy="26" r="3.6" fill="#fff"/><circle cx="30" cy="26" r="3.6" fill="#fff"/><rect x="17" y="33" width="14" height="2.8" rx="1.4" fill="#fff"/></svg>`)}`
const r = (x, y, w, h) => ({ x, y, w, h })
const SPARK = (id) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" style="display:block"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset=".28" stop-color="#4285f4"/><stop offset=".5" stop-color="#9b72cb"/><stop offset=".72" stop-color="#d96570"/></linearGradient></defs><path fill="url(#${id})" d="M12 0C12.6 6.6 17.4 11.4 24 12 17.4 12.6 12.6 17.4 12 24 11.4 17.4 6.6 12.6 0 12 6.6 11.4 11.4 6.6 12 0Z"/></svg>`

/* -- The reveal, the biggest hit of the track -- */
{
  let mark, name, burst
  segment('merge', ...T.merge, (s) => {
    burst = el('div', 'glow', s.layer, { '--g1': (WIDE ? 220 : 180) + 'px', '--g2': (WIDE ? 60 : 50) + 'px', '--g3': (WIDE ? 420 : 320) + 'px', '--g4': (WIDE ? 120 : 90) + 'px' })
    mark = window.__logo(s.layer, 260, { position: 'absolute', left: '50%', top: '50%' }).svg
    name = el('div', '', s.layer, { position: 'absolute', left: 0, right: 0, top: '50%', textAlign: 'center', fontSize: (WIDE ? 150 : 124) + 'px', lineHeight: 1.12 })
    name.innerHTML = WIDE ? 'Everything in one place.' : 'Everything<br>in one place.'
  }, (s, t) => {
    const lt = t - s.start, u = emph(prog(lt, 0, .45)), push = 1 + .025 * prog(t, s.start, s.end)
    burst.style.opacity = 1 - std(prog(lt, 0, 1.2))
    mark.style.transform = `translate(-50%,-50%) translateY(${WIDE ? -140 : -210}px) scale(${lerp(.25, 1, u) * push}) rotate(${(1 - u) * -30}deg)`
    const n = emph(prog(lt, .15, .6))
    name.style.opacity = prog(lt, .15, .23)
    name.style.transform = `translateY(${lerp(WIDE ? 140 : 100, WIDE ? 70 : 20, n)}px) scale(${push})`
  }, { noIn: true })
}

/* -- Not another bot. A generic robot icon and a word in neutral type, crossed out on the beat. No logo. -- */
{
  let bots = [], x1, x2, tag
  const R = rng(77), HUES = ['#9aa0a6', '#80868b', '#bdc1c6', '#aeb4bb']
  statement('notagents', ...T.notagents, [['Not another bot.'], ['Not a Cowork.']], [['Not another bot.'], ['Not a Cowork.']], { t0: 1.2, size: WIDE ? 150 : 120, extra: {
    build: (s) => {
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2 * 3 + R() * .5, k = .6 + R() * .55
        const x = Math.cos(a) * W * .48 * k, y = Math.sin(a) * H * .46 * k - 30
        if (Math.abs(y) < 400 && Math.abs(x) < (WIDE ? 660 : 480)) continue
        const d = lerp(44, 100, R())
        const e = imgEl(BOT(HUES[i % 4]), s.layer, { position: 'absolute', left: W / 2 + 'px', top: H / 2 + 'px', width: d + 'px', height: d + 'px' })
        bots.push({ e, x, y, d, at: Math.round(R() * 4) * .15, rot: (R() - .5) * 24, off: R() })
      }
      tag = el('div', '', s.layer, { position: 'absolute', left: 0, right: 0, top: (H / 2 - 370) + 'px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '28px', fontSize: (WIDE ? 120 : 110) + 'px', color: '#3c4043', fontWeight: 400 })
      imgEl(BOT('#3c4043'), tag, { width: '130px', height: '130px' })
      const w = el('span', '', tag); w.textContent = 'Cowork'
      const mk = () => el('div', '', s.layer, { position: 'absolute', left: W / 2 - 340 + 'px', top: H / 2 - 312 + 'px', width: '680px', height: '11px', borderRadius: '6px', background: '#ea4335', transformOrigin: 'center', zIndex: 5, boxShadow: '0 6px 24px rgba(234,67,53,.3)' })
      x1 = mk(); x2 = mk()
    },
    update: (s, t) => {
      const lt = t - s.start
      tag.style.opacity = prog(lt, 0, .08)
      tag.style.transform = `translateY(${(1 - emph(prog(lt, 0, .4))) * 40}px)`
      x1.style.transform = `rotate(-11deg) scaleX(${emph(prog(lt, .6, .78))})`; x2.style.transform = `rotate(11deg) scaleX(${emph(prog(lt, .9, 1.08))})`
      s.layer.querySelector('.center').style.marginTop = '170px'
      bots.forEach((o) => {
        const u = emph(prog(lt, o.at, o.at + .3)), v = acc(prog(lt, 1.2 + o.off * .35, 1.7 + o.off * .35)), k = 1 + v * 1.2
        o.e.style.opacity = prog(lt, o.at, o.at + .06) * (1 - v)
        o.e.style.transform = `translate(${o.x * k - o.d / 2}px,${o.y * k - o.d / 2}px) rotate(${o.rot + v * 60 * (o.off - .5)}deg) scale(${lerp(.3, 1, u) * (1 - v * .6)})`
      })
    },
  } })
}
statement('notplace', ...T.notplace, [['Not a place to work'], ['with AI agents.']], [['Not a place'], ['to work with'], ['AI agents.']], { size: WIDE ? 150 : 128 })

const FACES = WIDE
  ? [['maya', -790, -240, 250], ['tom', 790, -240, 250], ['sofia', -330, 340, 230], ['karim', 330, 340, 230], ['lea', -780, 270, 200], ['priya', 780, 270, 200]]
  : [['maya', -300, -350, 270], ['tom', 300, -350, 270], ['sofia', -300, 370, 270], ['karim', 300, 370, 270]]
function facesStatement(name, seg, wide, square, size) {
  const items = []
  statement(name, ...seg, wide, square, { size, extra: {
    build: (s) => { FACES.forEach(([n, x, y, d], i) => { const e = el('div', 'face', s.layer, { width: d + 'px', height: d + 'px', left: W / 2 + 'px', top: H / 2 + 'px', backgroundImage: `url(/call/${n}.webp)` }); items.push({ e, x, y, d, i }) }) },
    update: (s, t) => {
      const lt = t - s.start
      items.forEach(({ e, x, y, d, i }) => { const a = i * .15, u = emph(prog(lt, a, a + .5)); e.style.opacity = prog(lt, a, a + .08); e.style.transform = `translate(${x - d / 2}px,${y - d / 2 + Math.sin((t + i) * 1.1) * 6 + (1 - u) * 90}px) scale(${lerp(.6, 1, u)})` })
    },
  } })
}
facesStatement('ppl', T.ppl, [['A place where people'], [{ t: 'work together.', blue: true }]], [['A place where'], ['people'], [{ t: 'work together.', blue: true }]], WIDE ? 120 : 108)

/* -- THE LAPTOP. The whole app, one take, never cropped. Spotlight by dimming, camera moves the whole laptop, always comes back. -- */
{
  const STEPS = window.__STEPS, CHIPS = window.__CHIPS, BEATS = .6, APP = { w: 1280, h: 800 }
  const DECK = WIDE ? 92 : 30, SW = WIDE ? 1240 : 984, SH = SW * APP.h / APP.w, X0 = (W - SW) / 2, Y0 = WIDE ? 176 : 330, S0 = SW / APP.w
  const AREA = WIDE ? r(60, 150, 1800, 925) : r(24, 225, 1032, 835)
  const ZONES = { rail: r(0, 52, 256, 748), chat: r(256, 52, 440, 740), pane: r(704, 52, 568, 740), needs: r(270, 118, 790, 420), railRows: r(0, 80, 256, 220), chatLow: r(256, 400, 440, 392) }
  const zoneOf = (n) => window.__SHOTS?.tour?.marks?.[n] ? (({ x, y, w, h }) => r(x, y, w, h))(window.__SHOTS.tour.marks[n]) : ZONES[n]
  const camFor = (name) => {
    if (!name) return { c: 1, tx: 0, ty: 0 }
    const z = zoneOf(name)
    const c = Math.min(WIDE ? 1.09 : 1, AREA.w / (z.w * S0), AREA.h / (z.h * S0))
    const px = X0 + (z.x + z.w / 2) * S0
    // The whole laptop stays in the frame and never goes under the caption: it grows downward and slides sideways.
    const lL = X0 - DECK, lR = X0 + SW + DECK, lT = Y0 - 14
    if (c <= 1) return { c: 1, tx: 0, ty: 0 }
    return { c, tx: clamp(W / 2 - px * c, 8 - lL * c, W - 8 - lR * c), ty: lT - lT * c }
  }
  // Camera keys, in film seconds from the start of the tour. Each move is centred on its beat: fastest on the beat.
  const camKeys = []
  const addCam = (h, name) => camKeys.push({ t: h * BEATS, ...camFor(name) })
  addCam(0, null); addCam(2, 'rail'); addCam(6, null)
  STEPS.slice(2).forEach((st) => addCam(st.h, st.cam ?? null))
  const camAt = (lt) => {
    let cur = camKeys[0]
    for (const k of camKeys) {
      if (lt >= k.t + .36) { cur = k; continue }
      if (lt > k.t - .36) { const u = smooth(prog(lt, k.t - .36, k.t + .36)); return { c: lerp(cur.c, k.c, u), tx: lerp(cur.tx, k.tx, u), ty: lerp(cur.ty, k.ty, u) } }
      break
    }
    return cur
  }
  const dimKeys = STEPS.map((st) => ({ t: st.h * BEATS, z: st.zone ? zoneOf(st.zone) : null, a: st.zone ? .62 : st.dimAll ? .5 : 0, all: !!st.dimAll }))
  let cam, img, hole, wash, last = -1, chips = [], subs, subIn, lenses = []
  segment('tour', ...T.tour, (s) => {
    cam = el('div', '', s.layer, { position: 'absolute', left: 0, top: 0, width: W + 'px', height: H + 'px', transformOrigin: '0 0' })
    const lid = el('div', '', cam, { position: 'absolute', left: X0 - 14 + 'px', top: Y0 - 14 + 'px', width: SW + 28 + 'px', height: SH + 28 + 'px', borderRadius: '26px 26px 8px 8px', background: '#1d1f22', boxShadow: '0 60px 130px rgba(32,48,80,.22),0 16px 40px rgba(32,48,80,.14)' })
    const screen = el('div', '', cam, { position: 'absolute', left: X0 + 'px', top: Y0 + 'px', width: SW + 'px', height: SH + 'px', overflow: 'hidden', borderRadius: '10px', background: '#fff' })
    img = el('img', '', screen, { position: 'absolute', left: 0, top: 0, maxWidth: 'none', transformOrigin: '0 0' }); img.decoding = 'sync'
    hole = el('div', '', screen, { position: 'absolute', borderRadius: '18px', pointerEvents: 'none' })
    wash = el('div', '', screen, { position: 'absolute', inset: 0, background: '#fff', pointerEvents: 'none', opacity: 0 })
    const deck = el('div', '', cam, { position: 'absolute', left: X0 - DECK + 'px', top: Y0 + SH + 14 + 'px', width: SW + 2 * DECK + 'px', height: '26px', borderRadius: '2px 2px 22px 22px', background: 'linear-gradient(#e9ebef,#c4c8ce)', boxShadow: '0 22px 40px rgba(32,48,80,.20)' })
    el('div', '', deck, { position: 'absolute', left: '50%', top: 0, width: '190px', height: '11px', marginLeft: '-95px', borderRadius: '0 0 12px 12px', background: '#b4b8bf' })
    window.__LENSES.forEach((l) => {
      const m0 = window.__SHOTS?.tour?.marks?.[l.mark]; if (!m0) return
      const PAD = l.mark === 'projects' ? 0 : l.mark === 'summary' ? 0 : 8, m = { x: m0.x - PAD, y: m0.y - PAD, w: m0.w + 2 * PAD, h: m0.h + 2 * PAD }
      const k = (WIDE ? 1500 : 1000) / m.w, z = Math.min(k, (WIDE ? 800 : 720) / m.h, WIDE ? 2.2 : 2.3)
      const box = el('div', '', s.layer, { position: 'absolute', zIndex: 7, left: (W - m.w * z) / 2 + 'px', top: (WIDE ? 170 + (860 - m.h * z) / 2 : 250 + (780 - m.h * z) / 2) + 'px', width: m.w * z + 'px', height: m.h * z + 'px', borderRadius: '22px', overflow: 'hidden', background: '#fff', boxShadow: '0 40px 120px rgba(32,48,80,.34),0 8px 26px rgba(32,48,80,.16)' })
      const im = el('img', '', box, { position: 'absolute', left: 0, top: 0, maxWidth: 'none', transformOrigin: '0 0' }); im.decoding = 'sync'
      lenses.push({ ...l, m, z, box, im, last: -1 })
    })
    CHIPS.forEach((c, i) => {
      const e = el('div', '', s.layer, { position: 'absolute', zIndex: 8, display: 'flex', alignItems: 'center', gap: '16px', background: '#fff', borderRadius: '999px', padding: (WIDE ? '22px 40px' : '20px 34px'), fontSize: (WIDE ? 56 : 52) + 'px', whiteSpace: 'nowrap', boxShadow: '0 22px 70px rgba(66,133,244,.30),0 4px 14px rgba(60,64,67,.12)' })
      const sp = el('div', '', e, { width: '46px', height: '46px', flex: 'none' }); sp.innerHTML = SPARK('ch' + i)
      el('span', '', e).textContent = c.t
      const pos = WIDE ? [[.27, .46], [.73, .46], [.27, .68], [.73, .68]][i] : [[.5, .36], [.5, .52], [.5, .68], [.5, .84]][i]
      chips.push({ e, h: c.h, x: pos[0] * W, y: pos[1] * H })
    })
    subs = el('div', 'subs', s.layer, { fontSize: (WIDE ? 50 : 44) + 'px', zIndex: 8, bottom: (WIDE ? 96 : 150) + 'px' })
    subIn = el('span', '', subs); subIn.style.fontWeight = 500; subIn.style.whiteSpace = 'pre-wrap'
  }, (s, t) => {
    const lt = t - s.start, meta = window.__SHOTS?.tour ?? {}
    const idx = Math.max(0, Math.min((meta.frames ?? 1) - 1, Math.floor(lt * (meta.fps ?? 60) + 1e-6)))
    if (idx !== last) { last = idx; img.src = `/cap/tour/${String(idx).padStart(5, '0')}.jpg`; frameJobs.push(img.decode().catch(() => {})) }
    img.style.transform = `scale(${SW / (APP.w * (meta.dsf ?? 1))})`
    // the laptop arrives on the downbeat, from a little below; never cut
    const arrive = emph(prog(lt, 0, .6))
    const q = camAt(lt)
    cam.style.transform = `translate(${q.tx}px,${q.ty + (1 - arrive) * 70}px) scale(${q.c})`
    let cur = dimKeys[0], i = 0
    for (let n = 0; n < dimKeys.length; n++) if (lt >= dimKeys[n].t - .09) { cur = dimKeys[n]; i = n }
    const prev = dimKeys[Math.max(0, i - 1)], u = smooth(prog(lt, cur.t - .09, cur.t + .09))
    const a = lerp(prev.z ? prev.a : 0, cur.z ? cur.a : 0, u)
    const zc = cur.z ?? prev.z ?? ZONES.chat, zp = prev.z ?? zc
    const zx = lerp(zp.x, zc.x, u), zy = lerp(zp.y, zc.y, u), zw = lerp(zp.w, zc.w, u), zh = lerp(zp.h, zc.h, u)
    hole.style.left = zx * S0 + 'px'; hole.style.top = zy * S0 + 'px'; hole.style.width = zw * S0 + 'px'; hole.style.height = zh * S0 + 'px'
    hole.style.boxShadow = `0 0 0 3000px rgba(255,255,255,${i === 0 ? a * prog(lt, .6, .78) : a})`
    wash.style.opacity = cur.all ? .5 * u : 0
    for (const q of lenses) {
      const a0 = q.from * BEATS, b0 = q.to * BEATS, on = lt >= a0 && lt < b0
      q.box.style.display = on ? 'block' : 'none'
      if (!on) continue
      if (idx !== q.last) { q.last = idx; q.im.src = img.src; frameJobs.push(q.im.decode().catch(() => {})) }
      const ds = meta.dsf ?? 1, u3 = emph(prog(lt, a0, a0 + .36))
      q.im.style.transform = `scale(${q.z / ds}) translate(${-q.m.x * ds}px,${-q.m.y * ds}px)`
      q.box.style.transform = `scale(${lerp(.95, 1, u3)})` // on the beat, at once, with almost no travel: no ghosting
    }
    chips.forEach(({ e, h, x, y }) => {
      const a0 = h * BEATS, u2 = emph(prog(lt, a0, a0 + .36))
      e.style.opacity = prog(lt, a0, a0 + .06)
      e.style.left = x + 'px'; e.style.top = y + 'px'
      e.style.transform = `translate(-50%,-50%) scale(${lerp(.6, 1, u2)})`
    })
    const sub = (window.__SHOTS?.tour?.subs ?? []).find((c) => lt >= c.from && lt < c.to)
    subs.style.display = sub ? 'flex' : 'none'
    if (sub) { subIn.textContent = sub.text; subIn.style.transform = `scale(${lerp(.86, 1, emph(prog(lt, sub.from, sub.from + .3)))})` }
  }, { noIn: true, noOut: true })
  // Captions: large, outside the laptop. If the camera has brought the laptop under one, it floats on its own white pill.
  STEPS.forEach((st, i) => {
    const a = T.tour[0] + st.h * BEATS, b = i + 1 < STEPS.length ? T.tour[0] + STEPS[i + 1].h * BEATS : T.tour[1]
    let bk, pill
    segment('cap' + i, a, b, (s) => {
      s.layer.style.zIndex = 30
      pill = el('div', '', s.layer, { position: 'absolute', left: '50%', top: '44px', transform: 'translateX(-50%)', maxWidth: W - 40 + 'px', width: 'max-content' })
      bk = textBlock(pill, WIDE ? [st.cap] : st.capS.map((l) => [l]), { size: WIDE ? 78 : 68, maxW: W - 130 })
      bk.box.style.position = 'relative'
    }, (s, t) => {
      if (!bk.fitted) { bk.fit(); bk.fitted = true }
      revealWords(bk, t - s.start, 0, .15, .36)
    }, { noIn: true, noOut: true })
  })
}

facesStatement('matter', T.matter, [['So people do'], [{ t: 'what matters.', blue: true }]], [['So people do'], [{ t: 'what matters.', blue: true }]], WIDE ? 136 : 120)
statement('noone', ...T.noone, [['No one else has'], [{ i: 'gmail' }, ' Gmail, ', { i: 'docs' }, ' Docs,'], [{ i: 'meet' }, ' Meet and ', { i: 'gemini' }, ' Gemini.']], [['No one else has'], [{ i: 'gmail' }, ' Gmail, ', { i: 'docs' }, ' Docs,'], [{ i: 'meet' }, ' Meet and'], [{ i: 'gemini' }, ' Gemini.']], { size: WIDE ? 128 : 104 })
statement('only', ...T.only, [['Only ', { t: 'you', blue: true }, ' can do this.']], [['Only ', { t: 'you', blue: true }], ['can do this.']], { size: WIDE ? 170 : 146 })

/* -- The ask -- */
statement('hey', ...T.hey, [['Hey Google,'], ['look what I did.']], [['Hey Google,'], ['look what'], ['I did.']], { t0: .1, stagger: .15 })
statement('hire', ...T.hire, [['Maybe it’s time'], [{ t: 'to hire me.', blue: true }]], [['Maybe it’s'], ['time to'], [{ t: 'hire me.', blue: true }]], { t0: .1, stagger: .17, opts: { } })

/* -- End card: his own mark, his name, and it says plainly what this is -- */
{
  let els = []
  segment('end', ...T.end, (s) => {
    const col = el('div', 'center', s.layer)
    const m = window.__logo(col, WIDE ? 190 : 190, { marginBottom: '44px' }).svg
    const nm = el('div', 'end-name', col, { fontSize: (WIDE ? 100 : 86) + 'px', lineHeight: 1.1 }); nm.textContent = 'Alexandre Cormeraie'
    const li = el('div', 'mini', col, { fontSize: (WIDE ? 42 : 42) + 'px', marginTop: '32px', color: '#444746' }); li.textContent = 'linkedin.com/in/alex-cormeraie'
    const url = el('div', 'mini', col, { fontSize: (WIDE ? 42 : 42) + 'px', marginTop: '12px', color: '#1a73e8' }); url.textContent = 'connected-mate.github.io/one-place'
    const legal = el('div', 'mini', s.layer, { position: 'absolute', left: 0, right: 0, bottom: (WIDE ? 64 : 64) + 'px', textAlign: 'center', fontSize: (WIDE ? 44 : 42) + 'px', color: '#3c4043' }); legal.textContent = 'A concept. Not a Google product.'
    els = [m, nm, li, url, legal]
  }, (s, t) => {
    const lt = t - s.start
    els.forEach((e, i) => {
      const a = [0, .3, .6, .75, 1.2][i]
      const u = emph(prog(lt, a, a + .6))
      e.style.opacity = prog(lt, a, a + .12)
      e.style.transform = i === 0 ? `scale(${lerp(.6, 1, u)}) rotate(${(1 - u) * -16}deg)` : `translateY(${(1 - u) * 34}px)`
    })
    s.layer.style.transform = `translateY(${travel(s, t)}px)`
  }, { noOut: true })
}

/* ---------- engine ---------- */
window.__ready = async () => {
  await Promise.all(['400 100px "Google Sans"', '500 100px "Google Sans"', '600 100px "Google Sans"'].map((f) => document.fonts.load(f)))
  segments.forEach((s) => { s.build(s); s.built = true; s.layer.style.display = 'block'; s.update(s, s.start + .5); s.layer.style.display = 'none' })
  await Promise.all([...pending, ...frameJobs.splice(0)])
  await document.fonts.ready
}
window.__render = async (t) => {
  for (const s of segments) {
    const on = t >= s.start && t < s.end
    s.layer.style.display = on ? 'block' : 'none'
    if (on) s.update(s, t)
  }
  const jobs = frameJobs.splice(0)
  if (jobs.length) await Promise.all(jobs)
}
window.__auditText = (x) => {
  window.__auditT = x
  const out = []
  const walk = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT)
  const margin = 36
  while (walk.nextNode()) {
    const n = walk.currentNode, txt = n.textContent.trim(); if (!txt) continue
    const e = n.parentElement
    if (e.closest('.chip,.appt,.tabbar,.badge')) continue // the chaos overflows on purpose
    const seg = segments.find((s) => s.layer.contains(e))
    if (!seg || seg.layer.style.display === 'none') continue
    // only when the shot has settled
    const ts = window.__lastT
    const rg = document.createRange(); rg.selectNodeContents(n); const q = rg.getBoundingClientRect()
    if (q.width === 0) continue
    if (+getComputedStyle(e).opacity < .05) continue
        const lt = window.__auditT ?? 0
    if (lt < seg.start + 1.2 || lt > seg.end - .05) continue
    if (seg.name === 'tour') continue
    if (q.left < margin || q.right > W - margin || q.top < margin || q.bottom > H - margin) out.push(`${seg.name}: "${txt.slice(0, 30)}" at ${Math.round(q.left)},${Math.round(q.top)} to ${Math.round(q.right)},${Math.round(q.bottom)}`)
  }
  return out
}
