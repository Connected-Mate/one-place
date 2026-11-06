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
function travel(s, t) {
  const inn = s.opts.noIn ? 1 : emph(prog(t, s.start, s.start + CONVEY))
  const out = s.opts.noOut ? 0 : acc(prog(t, s.end - .1, s.end + .16))
  const y = (1 - inn) * H * .86 - out * H * .92
  return y
}
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
function statement(name, start, end, wide, square, { mode = 'words', stagger = .1, t0 = .1, size = FS, opts = {}, carets, cps = 17, extra } = {}) {
  let b
  return segment(name, start, end, (s) => { b = textBlock(s.layer, lines(wide, square), { size, maxW: MAXW }); extra?.build?.(s) }, (s, t) => {
    if (!b.fitted) { b.fit(); b.fitted = true }
    const lt = t - s.start
    if (mode === 'type') revealType(b, lt, t0, cps, carets); else revealWords(b, lt, t0, stagger)
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
statement('hello', ...T.hello, [['Hello Google.']], [['Hello'], ['Google.']], { mode: 'type', t0: .2, cps: 19, carets: ['#4285f4'], opts: { noIn: true } })
statement('spent', ...T.spent, [['Last quarter, you spent'], [{ t: '$51B', blue: true }, ' to build AI.']], [['Last quarter,'], ['you spent'], [{ t: '$51B', blue: true }, ' to build AI.']], { stagger: .09, size: WIDE ? 168 : 138 })
statement('gmail', ...T.gmail, [['And we still'], ['work in ', { i: 'gmail' }, ' Gmail.']], [['And we still'], ['work in ', { i: 'gmail' }], ['Gmail.']], { stagger: .09 })

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
    const lt = (t - s.start) * 1.18
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
      const at = i < 10 ? .95 + i * .2 : 2.95 + (i - 10) * .0058
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

statement('first', ...T.first, [['Maybe there’s something'], ['to do first.']], [['Maybe there’s'], ['something'], ['to do first.']], { opts: { noIn: true }, t0: .1, stagger: .12, size: WIDE ? 160 : 132 })

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
const CAST = ['maya', 'tom', 'sofia', 'karim', 'lea', 'priya', 'jun', 'ben']

/* -- THE PROJECT: one object on screen, that things enter -- */
const PROJECT_APPS = [['chat', 'Chat'], ['gmail', 'Gmail'], ['drive', 'Drive'], ['docs', 'Docs'], ['sheets', 'Sheets'], ['slides', 'Slides'], ['meet', 'Meet'], ['calendar', 'Calendar'], ['notebooklm', 'NotebookLM']]
{
  const CARD = WIDE ? { w: 1320, h: 760, top: 230 } : { w: 1000, h: 780, top: 230 }
  const P = (t) => t - T.project[0]
  const STEPS = [
    { at: 0, lines: [['Picture one project.']] },
    { at: 1.3, lines: [['Now bring ', { t: 'Google', blue: true }, ' in.']] },
    { at: 4.2, lines: [['Bring your ', { t: 'people', blue: true }, ' in.']] },
    { at: 5.6, lines: [['Bring ', { t: 'Gemini', blue: true }, ' in.']] },
  ]
  let card, ring, fill, pct, tiles = [], faces = [], spark, words = []
  segment('project', ...T.project, (s) => {
    STEPS.forEach((st) => { const box = el('div', '', s.layer, { position: 'absolute', left: 0, right: 0, top: (WIDE ? 62 : 70) + 'px', height: '150px', zIndex: 6 }); const b = textBlock(box, st.lines, { size: WIDE ? 124 : 104, maxW: MAXW }); b.box.style.position = 'relative'; words.push({ box, b, st }) })
    card = el('div', '', s.layer, { position: 'absolute', left: (W - CARD.w) / 2 + 'px', top: CARD.top + 'px', width: CARD.w + 'px', height: CARD.h + 'px', borderRadius: '48px', background: '#fff', boxShadow: '0 50px 140px rgba(66,133,244,.20),0 10px 40px rgba(66,133,244,.10)' })
    ring = el('div', '', card, { position: 'absolute', inset: '-5px', borderRadius: '53px', padding: '5px', background: 'linear-gradient(120deg,#4285f4,#9b72cb 50%,#d96570)', WebkitMask: 'linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', opacity: 0 })
    const head = el('div', '', card, { position: 'absolute', left: '56px', right: '56px', top: '44px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', fontSize: '50px' })
    const nm = el('div', '', head); nm.textContent = 'Aurora launch'
    pct = el('div', 'mini', head, { color: '#5f6368' })
    const track_ = el('div', '', card, { position: 'absolute', left: '56px', right: '56px', top: '122px', height: '16px', borderRadius: '8px', background: '#e9eef6', overflow: 'hidden' })
    fill = el('div', '', track_, { height: '100%', width: '0%', borderRadius: '8px', background: 'linear-gradient(90deg,#4285f4,#9b72cb)' })
    const cols = 5, TS = WIDE ? 132 : 128
    const stepX = WIDE ? 232 : (CARD.w - 112) / cols, x0 = (CARD.w - stepX * cols) / 2
    PROJECT_APPS.forEach(([a, n], i) => {
      const col = i % cols, row = Math.floor(i / cols)
      const x = x0 + stepX * (col + .5) + (row === 1 ? stepX / 2 : 0), y = 180 + row * 192
      const e = el('div', '', card, { position: 'absolute', left: x + 'px', top: y + 'px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: 0, zIndex: 3 })
      const box = el('div', '', e, { width: TS + 'px', height: TS + 'px', flex: 'none', borderRadius: TS * .24 + 'px', background: '#f6f8fc', display: 'flex', alignItems: 'center', justifyContent: 'center' })
      imgEl(icon(a), box, { width: TS * .62 + 'px', height: TS * .62 + 'px' })
      const lab = el('div', 'mini', e, { marginTop: '10px', fontSize: (WIDE ? 28 : 28) + 'px', color: '#3c4043', whiteSpace: 'nowrap' }); lab.textContent = n
      const ang = (i / 9) * Math.PI * 2 + .4
      tiles.push({ e, lab, fromX: Math.cos(ang) * 1400, fromY: Math.sin(ang) * 1000 - 200, i })
    })
    const faceY = WIDE ? 578 : 592, FD = WIDE ? 150 : 118, faceStep = (CARD.w - 112) / CAST.length
    CAST.forEach((n, i) => {
      const e = el('div', 'face', card, { width: FD + 'px', height: FD + 'px', left: 56 + faceStep * (i + .5) - FD / 2 + 'px', top: faceY + 'px', backgroundImage: `url(/call/${n}.webp)`, zIndex: 3 })
      faces.push({ e, i })
    })
    spark = el('div', '', card, { position: 'absolute', right: '230px', top: '26px', width: '86px', height: '86px', zIndex: 4 }); spark.innerHTML = SPARK('pj')
  }, (s, t) => {
    const lt = P(t), D = T.project[1] - T.project[0]
    words.forEach(({ box, b, st }, i) => {
      if (!b.fitted) { b.fit(); b.fitted = true }
      const end = STEPS[i + 1]?.at ?? D + 1
      const on = lt >= st.at - .01 && lt < end
      box.style.display = on ? 'block' : 'none'
      if (on) { revealWords(b, lt - st.at, .02, .07, .34); box.style.transform = `translateY(${(1 - emph(prog(lt, st.at, st.at + .3))) * 18}px)` }
    })
    // the card opens, calm and empty
    const open = emph(prog(lt, .0, .75)), collapse = acc(prog(lt, D - .42, D - .02))
    card.style.transform = `translateY(${(1 - open) * 120}px) scale(${lerp(.9, 1, open) * (1 - collapse * .94)})`
    card.style.opacity = prog(lt, 0, .12) * (1 - prog(lt, D - .08, D))
    tiles.forEach(({ e, lab, fromX, fromY, i }) => {
      const a = 1.4 + i * .3, u = emph(prog(lt, a, a + .42))
      e.style.opacity = prog(lt, a, a + .05)
      e.style.transform = `translate(calc(${(1 - u) * fromX}px), ${(1 - u) * fromY}px) scale(${lerp(1.5, 1, u)})`
      lab.style.opacity = prog(lt, a + .18, a + .3)
    })
    faces.forEach(({ e, i }) => {
      const a = 4.25 + i * .12, u = emph(prog(lt, a, a + .42))
      e.style.opacity = prog(lt, a, a + .05)
      e.style.transform = `translateY(${(1 - u) * 240}px) scale(${lerp(.5, 1, u)})`
    })
    const g = emph(prog(lt, 5.65, 6.15))
    spark.style.opacity = prog(lt, 5.65, 5.72)
    spark.style.transform = `translate(${(1 - g) * 300}px,${(1 - g) * -600}px) scale(${lerp(3, 1, g)}) rotate(${(1 - g) * 180}deg)`
    ring.style.opacity = smooth(prog(lt, 5.9, 6.3))
    pct.textContent = Math.round(lerp(0, 8, smooth(prog(lt, 6, 6.6)))) + '%'
    fill.style.width = lerp(0, 8, smooth(prog(lt, 6, 6.6))) + '%'
    s.layer.style.transform = `translateY(${(1 - emph(prog(t, s.start, s.start + CONVEY))) * H * .86}px)`
  }, { noOut: true, noIn: true })
}

/* -- The drop: That's One Place -- */
{
  let mark, name, burst
  segment('merge', ...T.merge, (s) => {
    burst = el('div', 'glow', s.layer, { '--g1': (WIDE ? 220 : 180) + 'px', '--g2': (WIDE ? 60 : 50) + 'px', '--g3': (WIDE ? 420 : 320) + 'px', '--g4': (WIDE ? 120 : 90) + 'px' })
    mark = window.__logo(s.layer, 280, { position: 'absolute', left: '50%', top: '50%' }).svg
    name = el('div', '', s.layer, { position: 'absolute', left: 0, right: 0, top: '50%', textAlign: 'center', fontSize: (WIDE ? 160 : 112) + 'px', whiteSpace: 'nowrap' })
    name.textContent = 'That’s One Place.'
  }, (s, t) => {
    const lt = t - s.start, u = emph(prog(lt, 0, .5)), push = 1 + .03 * prog(t, s.start, s.end + .2)
    burst.style.opacity = 1 - std(prog(lt, .02, .8))
    mark.style.transform = `translate(-50%,-50%) translateY(-120px) scale(${lerp(.25, 1, u) * push}) rotate(${(1 - u) * -30}deg)`
    const n = emph(prog(lt, .1, .55))
    name.style.opacity = prog(lt, .1, .18)
    name.style.transform = `translateY(${lerp(170, 100, n)}px) scale(${push})`
    s.layer.style.transform = `translateY(${travel(s, t)}px)`
  }, { noIn: true })
}

/* -- Not agents: a robot and its cloud, crossed out. A word in neutral type and a generic icon, no logo -- */
{
  let bots = [], x1, x2, tag
  const R = rng(77), HUES = ['#9aa0a6', '#80868b', '#bdc1c6', '#aeb4bb']
  statement('notagents', ...T.notagents, [['Not agents.']], [['Not agents.']], { t0: .8, size: WIDE ? 190 : 150, extra: {
    build: (s) => {
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2 * 3 + R() * .5, k = .6 + R() * .55
        const x = Math.cos(a) * W * .48 * k, y = Math.sin(a) * H * .46 * k - 30
        if (Math.abs(y) < 360 && Math.abs(x) < (WIDE ? 640 : 460)) continue
        const d = lerp(44, 100, R())
        const e = imgEl(BOT(HUES[i % 4]), s.layer, { position: 'absolute', left: W / 2 + 'px', top: H / 2 + 'px', width: d + 'px', height: d + 'px' })
        bots.push({ e, x, y, d, at: R() * .28, rot: (R() - .5) * 24, off: R() })
      }
      tag = el('div', '', s.layer, { position: 'absolute', left: 0, right: 0, top: (H / 2 - 320) + 'px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '28px', fontSize: (WIDE ? 120 : 110) + 'px', color: '#3c4043', fontWeight: 400 })
      imgEl(BOT('#3c4043'), tag, { width: '130px', height: '130px' })
      const w = el('span', '', tag); w.textContent = 'Cowork'
      const mk = (rot) => el('div', '', s.layer, { position: 'absolute', left: W / 2 - 340 + 'px', top: H / 2 - 262 + 'px', width: '680px', height: '11px', borderRadius: '6px', background: '#ea4335', transformOrigin: 'center', zIndex: 5, boxShadow: '0 6px 24px rgba(234,67,53,.3)', '--r': rot })
      x1 = mk(0); x2 = mk(0)
    },
    update: (s, t) => {
      const lt = t - s.start
      tag.style.opacity = prog(lt, .02, .1)
      tag.style.transform = `translateY(${(1 - emph(prog(lt, .02, .4))) * 40}px)`
      const a = acc(prog(lt, .42, .58)), b = acc(prog(lt, .58, .74))
      x1.style.transform = `rotate(-11deg) scaleX(${a})`; x2.style.transform = `rotate(11deg) scaleX(${b})`
      s.layer.querySelector('.center').style.marginTop = (WIDE ? 150 : 150) + 'px'
      bots.forEach((o) => {
        const u = emph(prog(lt, o.at, o.at + .3)), v = acc(prog(lt, .85 + o.off * .25, 1.2 + o.off * .25)), k = 1 + v * 1.2
        o.e.style.opacity = prog(lt, o.at, o.at + .06) * (1 - v)
        o.e.style.transform = `translate(${o.x * k - o.d / 2}px,${o.y * k - o.d / 2}px) rotate(${o.rot + v * 60 * (o.off - .5)}deg) scale(${lerp(.3, 1, u) * (1 - v * .6)})`
      })
    },
  } })
}

function shot(name, [start, end], source, spec, { glow = null, fromT = 0, rate = 1, opts = {}, after } = {}) {
  let f, wrap, gl
  segment(name, start, end, (s) => {
    wrap = el('div', 'wrap3d', s.layer)
    f = footage(wrap, source, spec)
    if (glow) gl = el('div', 'glow', s.layer, { '--g1': (WIDE ? 150 : 120) + 'px', '--g2': (WIDE ? 34 : 26) + 'px', '--g3': (WIDE ? 280 : 220) + 'px', '--g4': (WIDE ? 70 : 54) + 'px' })
    after?.build?.(s)
  }, (s, t) => {
    const lt = t - s.start
    s.layer.style.transform = `translateY(${travel(s, t)}px)`
    setFootage(f, fromT + lt * rate, spec.cam(lt))
    if (spec.tilt) tilt(f.sh, t, s.start, s.end, ...spec.tilt)
    if (gl) gl.style.opacity = track(lt, glow)
    after?.update?.(s, t, f)
  }, opts)
}
function beat(name, seg, lines, source, spec, { fromT = 0, rate = 1, size = WIDE ? 104 : 86, top = WIDE ? 48 : 50, opts } = {}) {
  let b
  shot(name, seg, source, spec, { fromT, rate, opts, after: {
    build: (s) => {
      const box = el('div', '', s.layer, { position: 'absolute', left: 0, right: 0, top: top + 'px', zIndex: 6 })
      b = textBlock(box, lines, { size, maxW: MAXW })
      b.box.style.position = 'relative'
    },
    update: (s, t) => { if (!b.fitted) { b.fit(); b.fitted = true } revealWords(b, t - s.start, .02, .07, .34) },
  } })
}
// All your tools. All your people. One project.
beat('all', T.all, WIDE ? [['All your tools. All your people. ', { t: 'One project.', blue: true }]] : [['All your tools.'], ['All your people.'], [{ t: 'One project.', blue: true }]], 'all', WIDE
  ? { rect: r(90, 160, 1740, 900), radius: 36, tilt: [1.2, -1.2, 0, .6], cam: (t) => ({ x: 756, y: track(t, [[0, 400], [2.8, 406]]), zoom: track(t, [[0, 1.15], [2.8, 1.16]]) }) }
  : { rect: r(30, 375, 1020, 680), radius: 36, tilt: [1, -1, 0, .5], cam: (t) => ({ x: 445, y: 340, zoom: 1.15 }) },
{ fromT: .2, rate: 1.2, size: WIDE ? 84 : 88 })

statement('fast', ...T.fast, [[{ t: 'Moving fast.', blue: true }]], [[{ t: 'Moving', blue: true }], [{ t: 'fast.', blue: true }]], { t0: .03, stagger: .1, size: WIDE ? 210 : 200 })

/* The bar is the thread: it jumps on every beat. It stays still while the shots run under it. */
const BAR_Y = WIDE ? 40 : 44
const beatRect = WIDE ? r(170, 150, 1580, 900) : r(40, 150, 1000, 900)
shot('btodo', T.btodo, 'todo', { rect: beatRect, radius: 40, cam: (t) => (WIDE ? { x: 400, y: 200, zoom: track(t, [[0, 1.98], [1.4, 2.04]]) } : { x: 290, y: 245, zoom: track(t, [[0, 1.72], [1.4, 1.8]]) }) }, { fromT: .25, rate: 1.75 })
shot('broad', T.broad, 'roadmap', { rect: beatRect, radius: 40, cam: (t) => (WIDE ? { x: 400, y: 330, zoom: 1.98 } : { x: 400, y: 320, zoom: 1.25 }) }, { fromT: .3, rate: 1 })
shot('bdoc', T.bdoc, 'doc', { rect: beatRect, radius: 40, cam: (t) => (WIDE ? { x: 400, y: 230, zoom: 1.98 } : { x: 400, y: 300, zoom: 1.25 }) }, { fromT: .9, rate: 1.4 })
if (T.bmini) shot('bmini', T.bmini, 'mini', { rect: beatRect, radius: 40, cam: () => (WIDE ? { x: 400, y: 250, zoom: 1.98 } : { x: 400, y: 330, zoom: 1.25 }) }, { fromT: .25, rate: .95 })

// The call, 3 s, chat beside it. One wow. Then it is over and the summary is there.
const CALLT = window.__CALL ? window.__CALL[WIDE ? 'wide' : 'square'] : { chorus: 45.6, hang: 49.8, clip: { width: 1442, height: 808 } }
window.__CALLCUTS = { wowFrom: CALLT.chorus - 1, hangFrom: CALLT.hang - .3 }
{
  const SRC = WIDE ? 'callwide' : 'callsquare'
  const SIZE = { w: CALLT.clip.width, h: CALLT.clip.height }
  const RECT = WIDE ? r(92, 140, 1736, 920) : r(30, 180, 1020, 730)
  const FIT = Math.min(RECT.w / SIZE.w, RECT.h / SIZE.h)
  let f, subs, subIn
  segment('bcall', ...T.bcall, (s) => {
    const wrap = el('div', 'wrap3d', s.layer)
    f = footage(wrap, SRC, { rect: RECT, radius: 32, shadow: true })
    subs = el('div', 'subs', s.layer, { fontSize: (WIDE ? 56 : 44) + 'px', zIndex: 5, bottom: (WIDE ? 90 : 130) + 'px' })
    subIn = el('span', '', subs); subIn.style.fontWeight = 500; subIn.textContent = 'Wow.   Whoa.   Oh, that’s so good.'; subIn.style.whiteSpace = 'pre-wrap'
  }, (s, t) => {
    const lt = t - s.start
    s.layer.style.transform = `translateY(${travel(s, t)}px)`
    setFootage(f, window.__CALLCUTS.wowFrom + lt, { x: SIZE.w / 2, y: SIZE.h / 2, zoom: FIT })
    const on = lt >= 1.02 && lt < 3.1
    subs.style.display = on ? 'flex' : 'none'
    subIn.style.transform = `scale(${lerp(.86, 1, emph(prog(lt, 1.02, 1.35)))})`
  })
  let f2
  segment('bsum', ...T.bsum, (s) => {
    const wrap = el('div', 'wrap3d', s.layer)
    f2 = footage(wrap, SRC, { rect: RECT, radius: 32, shadow: true })
  }, (s, t) => {
    const lt = t - s.start
    s.layer.style.transform = `translateY(${travel(s, t)}px)`
    setFootage(f2, window.__CALLCUTS.hangFrom + lt * 2.4, { x: SIZE.w / 2, y: SIZE.h / 2, zoom: FIT })
  })
}
{
  const beats = [T.btodo, T.broad, T.bdoc, ...(T.bmini ? [T.bmini] : []), T.bcall, T.bsum]
  const steps = T.bmini ? [22, 38, 52, 66, 86, 100] : [24, 42, 58, 84, 100]
  let wrap, bar, fill, pct
  segment('bar', T.btodo[0], T.bsum[1], (s) => {
    s.layer.style.zIndex = 20
    bar = el('div', '', s.layer, { position: 'absolute', left: (WIDE ? 460 : 90) + 'px', right: (WIDE ? 460 : 90) + 'px', top: BAR_Y + 'px', height: '84px', borderRadius: '42px', background: '#fff', boxShadow: '0 16px 50px rgba(66,133,244,.26),0 3px 12px rgba(60,64,67,.12)', display: 'flex', alignItems: 'center', gap: '24px', padding: '0 34px', fontSize: '34px' })
    const nm = el('div', '', bar, { whiteSpace: 'nowrap' }); nm.textContent = 'Aurora launch'
    const trk = el('div', '', bar, { flex: 1, height: '14px', borderRadius: '7px', background: '#e9eef6', overflow: 'hidden' })
    fill = el('div', '', trk, { height: '100%', borderRadius: '7px', background: 'linear-gradient(90deg,#4285f4,#9b72cb)' })
    pct = el('div', 'mini', bar, { width: '86px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' })
  }, (s, t) => {
    let v = 8
    beats.forEach(([a], i) => { const u = emph(prog(t, a + .05, a + .5)); v = lerp(i ? steps[i - 1] : 8, steps[i], u) > v && t >= a ? lerp(i ? steps[i - 1] : 8, steps[i], u) : v })
    fill.style.width = v + '%'; pct.textContent = Math.round(v) + '%'
    s.layer.style.transform = `translateY(${(1 - emph(prog(t, s.start, s.start + .4))) * -160}px)`
    const pop = beats.reduce((m, [a]) => Math.max(m, 1 - prog(t, a, a + .3)), 0) * (t >= beats[0][0] ? 1 : 0)
    bar.style.transform = `scale(${1 + .03 * (t >= s.start ? Math.sin(Math.PI * clamp(1 - pop)) : 0)})`
  }, { noIn: true, noOut: true })
}

/* -- Gemini does the boring stuff -- */
const BOR = WIDE ? r(440, 170, 1040, 910) : r(60, 235, 960, 845)
const Bz = WIDE ? 2.42 : 2.23
shot('bdraft', T.bdraft, 'draft', { rect: BOR, shadow: false, feather: { t: 70, b: 50 }, cam: () => ({ x: 215, y: 500, zoom: Bz }) }, { fromT: .9, rate: 1.4, glow: [[0, 0], [.25, .6], [1.6, .6]] })
shot('bsumm', T.bsumm, 'answer', { rect: BOR, shadow: false, feather: { t: 70, b: 50 }, cam: () => ({ x: 215, y: 600, zoom: Bz }) }, { fromT: 1.1, rate: 2.2, glow: [[0, .6], [1.3, .6]] })
shot('badd', T.badd, 'todoai', { rect: BOR, shadow: false, feather: { t: 70, b: 50 }, cam: () => ({ x: 215, y: 210, zoom: Bz }) }, { fromT: .55, rate: 1.1, glow: [[0, .6], [1.3, 0]] })
{
  let b
  segment('borline', T.bdraft[0], T.badd[1], (s) => {
    s.layer.style.zIndex = 20
    const box = el('div', '', s.layer, { position: 'absolute', left: 0, right: 0, top: (WIDE ? 52 : 50) + 'px' })
    b = textBlock(box, WIDE ? [['Gemini does the boring stuff.']] : [['Gemini does'], ['the boring stuff.']], { size: WIDE ? 104 : 72, maxW: MAXW })
    b.box.style.position = 'relative'
    box.style.background = 'rgba(255,255,255,.0)'
  }, (s, t) => { if (!b.fitted) { b.fit(); b.fitted = true } revealWords(b, t - s.start, .03, .08, .36) }, { noIn: true, noOut: true })
}

/* -- So people do what matters: the faces, close -- */
{
  const F = WIDE
    ? [['maya', -700, -170, 320], ['tom', 700, -170, 320], ['sofia', -310, 345, 230], ['karim', 310, 345, 230], ['lea', -750, 290, 200], ['priya', 750, 290, 200]]
    : [['maya', -300, -340, 280], ['tom', 300, -340, 280], ['sofia', -300, 370, 280], ['karim', 300, 370, 280]]
  let items = []
  statement('people', ...T.people, [['So people do'], [{ t: 'what matters.', blue: true }]], [['So people do'], [{ t: 'what matters.', blue: true }]], { t0: .06, stagger: .1, size: WIDE ? 130 : 120, extra: {
    build: (s) => { F.forEach(([n, x, y, d], i) => { const e = el('div', 'face', s.layer, { width: d + 'px', height: d + 'px', left: W / 2 + 'px', top: H / 2 + 'px', backgroundImage: `url(/call/${n}.webp)` }); items.push({ e, x, y, d, i }) }) },
    update: (s, t) => {
      const lt = t - s.start
      items.forEach(({ e, x, y, d, i }) => {
        const a = .12 + i * .08, u = emph(prog(lt, a, a + .5))
        e.style.opacity = prog(lt, a, a + .08)
        e.style.transform = `translate(${x - d / 2}px,${y - d / 2 + Math.sin((t + i) * 1.1) * 6 + (1 - u) * 90}px) scale(${lerp(.6, 1, u)})`
      })
    },
  } })
}
statement('only', ...T.only, [['Only ', { t: 'you', blue: true }, ' can do this.']], [['Only ', { t: 'you', blue: true }], ['can do this.']], { t0: .05, stagger: .13, size: WIDE ? 170 : 146 })

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
    const legal = el('div', 'mini', s.layer, { position: 'absolute', left: 0, right: 0, bottom: (WIDE ? 64 : 64) + 'px', textAlign: 'center', fontSize: '30px', color: '#5f6368' }); legal.textContent = 'A concept. Not a Google product.'
    els = [m, nm, li, url, legal]
  }, (s, t) => {
    const lt = t - s.start
    els.forEach((e, i) => {
      const a = [.0, .22, .55, .67, .95][i]
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
    const on = t >= s.start && t < s.end + (s.opts.noOut ? 0 : .2)
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
  const margin = 40
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
    if (lt < seg.start + .55 || lt > seg.end - .12) continue
    if (seg.name === 'project' && e.closest('.face')) continue
    if (q.left < margin || q.right > W - margin || q.top < margin || q.bottom > H - margin) out.push(`${seg.name}: "${txt.slice(0, 30)}" at ${Math.round(q.left)},${Math.round(q.top)} to ${Math.round(q.right)},${Math.round(q.bottom)}`)
  }
  return out
}
