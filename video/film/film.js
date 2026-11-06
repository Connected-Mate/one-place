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
function revealWords(b, t, t0, stagger = .13, dur = .55) {
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
  return { sh, card, img, shot, rect, dsf: dsfOf[shot], last: -1 }
}
function featherMask({ l = 0, r = 0, t = 0, b = 0 }) {
  const lin = (dir, a, z) => `linear-gradient(to ${dir}, transparent 0, #000 ${a}px, #000 calc(100% - ${z}px), transparent 100%)`
  return [lin('right', l, r), lin('bottom', t, b)].join(',')
}
const dsfOf = { home: 3, type: 8, answer: 5, block: 6, docs: 4, callwide: 3, callsquare: 3, chat: 5, overview: 3 }
const frameJobs = []
function setFootage(f, ft, cam) {
  const idx = Math.max(0, Math.min((window.__FRAMES?.[f.shot] ?? 1e9) - 1, Math.floor(ft * 30 + 1e-6)))
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
function statement(name, start, end, wide, square, { mode = 'words', stagger = .13, t0 = .14, size = FS, opts = {}, carets, cps = 17, extra } = {}) {
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
statement('hello', ...T.hello, [['Hello Google.']], [['Hello'], ['Google.']], { mode: 'type', t0: .3, cps: 15, carets: ['#4285f4'], opts: { noIn: true } })
statement('spent', ...T.spent, [['Last quarter, you spent'], [{ t: '$51B', blue: true }, ' to build AI.']], [['Last quarter,'], ['you spent'], [{ t: '$51B', blue: true }, ' to build AI.']], { stagger: .13, size: WIDE ? 168 : 138 })
statement('gmail', ...T.gmail, [['And we still'], ['work in ', { i: 'gmail' }, ' Gmail.']], [['And we still'], ['work in ', { i: 'gmail' }], ['Gmail.']], { stagger: .11 })

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
    const lt = t - s.start, D = T.chaos[1] - T.chaos[0]
    const collapse = acc(prog(t, s.end - .5, s.end - .06))
    const gone = prog(t, s.end - .1, s.end - .02)
    s.layer.style.opacity = 1 - gone
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

statement('first', ...T.first, [['Maybe there’s something'], [{ t: 'to do first.', blue: true }]], [['Maybe there’s'], ['something'], [{ t: 'to do first.', blue: true }]], { opts: { noIn: true }, t0: .3, stagger: .2, size: WIDE ? 160 : 132 })

/* -- The merge, as in the welcome dialog -- */
{
  let items = [], mark, name, paths
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
  const STEP = WIDE ? 178 : 198, TILE = WIDE ? 146 : 160
  segment('merge', ...T.merge, (s) => {
    APPS.forEach((a, i) => {
      const e = el('div', 'appt', s.layer, { left: '50%', top: '50%', fontSize: (WIDE ? 30 : 32) + 'px' })
      const box = el('div', 'box', e, { width: TILE + 'px', height: TILE + 'px', borderRadius: TILE * .22 + 'px', background: '#f6f8fc' })
      imgEl(icon(a[0]), box, { width: TILE * .62 + 'px', height: TILE * .62 + 'px' })
      const n = el('div', '', e, { marginTop: '14px' }); n.textContent = a[1]
      const cols = WIDE ? 10 : 5, rows = WIDE ? 1 : 2
      const col = i % cols, row = Math.floor(i / cols)
      const x = (col - (cols - 1) / 2) * STEP, y = (row - (rows - 1) / 2) * (WIDE ? 0 : 230)
      items.push({ e, x, y, d: Math.hypot(col - (cols - 1) / 2, (row - .5)) })
    })
    const m = window.__logo(s.layer, WIDE ? 240 : 230, { position: 'absolute', left: '50%', top: '50%' })
    mark = m.svg; paths = m.ps
    name = el('div', '', s.layer, { position: 'absolute', left: 0, right: 0, top: '50%', textAlign: 'center', fontSize: (WIDE ? 104 : 96) + 'px', fontWeight: 500, whiteSpace: 'nowrap' })
    name.textContent = 'One place.'
  }, (s, t) => {
    const lt = t - s.start
    const MERGE = 1.1 // the row is read, then it folds into the mark, on the downbeat
    items.forEach((it) => {
      const inn = emph(prog(lt, it.d * .035, it.d * .035 + .5))
      const out = acc(prog(lt, MERGE + it.d * .03, MERGE + it.d * .03 + .34))
      it.e.style.transform = `translate(-50%,-50%) translate(${it.x * (1 - out)}px,${(it.y * (1 - out)) + (1 - inn) * 80}px) scale(${lerp(.82, 1, inn) * (1 - out * .72)})`
      it.e.style.opacity = prog(lt, it.d * .035, it.d * .035 + .12) * (1 - prog(lt, MERGE + it.d * .03 + .2, MERGE + it.d * .03 + .34))
    })
    const landing = MERGE + .32
    const u = emph(prog(lt, landing, landing + .62))
    mark.style.opacity = prog(lt, landing, landing + .06)
    const push = 1 + .02 * prog(t, s.start + landing, s.end + .2)
    const up = -emph(prog(lt, landing + .34, landing + .94))
    mark.style.transform = `translate(-50%,-50%) translateY(${up * (WIDE ? 88 : 92)}px) scale(${lerp(.3, 1, u) * push}) rotate(${(1 - u) * -26}deg)`
    const n = emph(prog(lt, landing + .34, landing + .94))
    name.style.opacity = prog(lt, landing + .34, landing + .5)
    name.style.transform = `translateY(${lerp(170, 88, n)}px) scale(${push})`
    s.layer.style.transform = `translateY(${travel(s, t)}px)`
  }, { noIn: true })
}

/* -- The word wheel between product moments -- */
const WHEEL = [
  { wide: ['One chat.'], sq: ['One chat.'] },
  { wide: ['Tag the AI.', 'It works for you.'], sq: ['Tag the AI.', 'It works', 'for you.'] },
  { wide: ['Built on the fly.'], sq: ['Built', 'on the fly.'] },
  { wide: ['Your docs. Your tools.', 'Connected.'], sq: ['Your docs.', 'Your tools.', 'Connected.'] },
  { wide: ['Your calls.', 'Right there.'], sq: ['Your calls.', 'Right there.'] },
  { wide: ['Your project.', 'End to end.'], sq: ['Your project.', 'End to end.'] },
]
function wheel(name, [start, end], index, extra) {
  let items = []
  const fs = WIDE ? 140 : 122
  const lh = fs * 1.16
  const L = WHEEL.length
  const lines = (i) => (WIDE ? WHEEL[((i % L) + L) % L].wide : WHEEL[((i % L) + L) % L].sq)
  const height = (i) => lines(i).length * lh + fs * .42
  const posOf = (x) => { const k = Math.floor(x); let y = 0; for (let j = 0; j < k; j++) y += height(j); return y + height(k) * (x - k) }
  segment(name, start, end, (s) => {
    for (let i = 0; i <= 9; i++) {
      const e = el('div', '', s.layer, { position: 'absolute', left: 0, right: 0, top: '50%', textAlign: 'center', fontSize: fs + 'px', lineHeight: 1.16, whiteSpace: 'nowrap', zIndex: 5 })
      lines(i).forEach((l) => { const d = el('div', '', e); d.textContent = l })
      items.push({ e, i })
    }
    extra?.build?.(s)
  }, (s, t) => {
    const lt = t - s.start
    const at = index + L // room on both sides of the list
    const roll = lerp(at - .9, at, emph(prog(lt, 0, .62)))
    const center = posOf(at) // of its top: the item is centered once it has settled
    items.forEach(({ e, i }) => {
      // i is drawn at its position in the list around the current one
      const j = at - 4 + i
      const y = posOf(j) - posOf(roll) - lines(j).length * lh / 2
      const dist = Math.abs(j - roll)
      const on = 1 - clamp(dist / .55)
      e.textContent = ''
      lines(j).forEach((l) => { const d = el('div', '', e); d.textContent = l })
      e.style.color = `rgb(${lerp(189, 66, on)},${lerp(193, 133, on)},${lerp(198, 244, on)})`
      e.style.opacity = clamp(1.05 - Math.max(0, dist - .4) * .62)
      const blur = Math.min(14, dist * 9)
      e.style.filter = blur < .05 ? 'none' : `blur(${blur}px)`
      e.style.transform = `translateY(${y}px) scale(${lerp(.86, 1, on)})`
    })
    s.layer.style.transform = `translateY(${travel(s, t)}px)`
    extra?.update?.(s, t)
  }, { noIn: true })
}

/* -- Not a dozen agents: a cloud of little bots, gone in a breath -- */
const BOT = (hue) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect x="8" y="14" width="32" height="26" rx="9" fill="${hue}"/><rect x="22.5" y="6" width="3" height="9" rx="1.5" fill="${hue}"/><circle cx="24" cy="6" r="3" fill="${hue}"/><rect x="3" y="22" width="4" height="10" rx="2" fill="${hue}"/><rect x="41" y="22" width="4" height="10" rx="2" fill="${hue}"/><circle cx="18" cy="26" r="3.6" fill="#fff"/><circle cx="30" cy="26" r="3.6" fill="#fff"/><rect x="17" y="33" width="14" height="2.8" rx="1.4" fill="#fff"/></svg>`)}`
{
  let bots = []
  const HUES = ['#9aa0a6', '#80868b', '#bdc1c6', '#aeb4bb']
  const r = rng(77)
  statement('agents', ...T.agents, [['Not a dozen agents.']], [['Not a dozen'], ['agents.']], { t0: .12, size: WIDE ? 150 : 132, opts: { noOut: true }, extra: {
    build: (s) => {
      const n = 44
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 * 3 + r() * .5, ring = .55 + r() * .6
        const x = Math.cos(a) * W * .48 * ring, y = Math.sin(a) * H * .46 * ring
        if (Math.abs(y) < (WIDE ? 130 : 210) && Math.abs(x) < (WIDE ? 760 : 470)) continue // the line stays readable
        const d = lerp(46, 104, r())
        const e = imgEl(BOT(HUES[i % 4]), s.layer, { position: 'absolute', left: W / 2 + 'px', top: H / 2 + 'px', width: d + 'px', height: d + 'px' })
        bots.push({ e, x, y, d, at: .35 + r() * 1.0, rot: (r() - .5) * 24, off: r() })
      }
    },
    update: (s, t) => {
      const lt = t - s.start, gone = T.agents[1] - T.agents[0] - .75
      bots.forEach((b) => {
        const u = emph(prog(lt, b.at, b.at + .45))
        const v = acc(prog(lt, gone + b.off * .18, gone + b.off * .18 + .42))
        const k = 1 + v * 1.1
        b.e.style.opacity = prog(lt, b.at, b.at + .08) * (1 - v)
        b.e.style.transform = `translate(${b.x * k - b.d / 2}px,${b.y * k - b.d / 2 + Math.sin((t + b.off * 9) * 1.5) * 6}px) rotate(${b.rot + v * 60 * (b.off - .5)}deg) scale(${lerp(.3, 1, u) * (1 - v * .6)})`
      })
    },
  } })
}

wheel('w1', T.w1, 0); wheel('w2', T.w2, 1)
if (T.wf) wheel('wf', T.wf, 2)
{ // the tools flow in around the words, and fall into the product
  let items = []
  wheel('w3', T.w3, 3, {
    build: (s) => { APPS.forEach(([a], i) => { const d = WIDE ? 118 : 96; const e = el('div', '', s.layer, { position: 'absolute', left: W / 2 + 'px', top: H / 2 + 'px', width: d + 'px', height: d + 'px', borderRadius: d * .24 + 'px', background: '#fff', boxShadow: '0 18px 50px rgba(66,133,244,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }); imgEl(icon(a), e, { width: d * .6 + 'px', height: d * .6 + 'px' }); const ang = (i / 10) * Math.PI * 2 + (WIDE ? .3 : .3); items.push({ e, d, ang, i }) }) },
    update: (s, t) => {
      const lt = t - s.start
      items.forEach(({ e, d, ang, i }) => {
        const u = emph(prog(lt, .1 + i * .04, .85 + i * .04))
        const rx = (WIDE ? W * .46 : W * .43) * lerp(1.7, 1, u), ry = (WIDE ? H * .41 : H * .43) * lerp(1.7, 1, u)
        e.style.transform = `translate(${Math.cos(ang) * rx - d / 2}px,${Math.sin(ang) * ry - d / 2}px)`
        e.style.opacity = prog(lt, .1 + i * .04, .2 + i * .04)
      })
    },
  })
}
wheel('w4', T.w4, 4); wheel('w5', T.w5, 5)

/* -- Product moments, from the real app -- */
function shot(name, [start, end], source, spec, { glow = null, fromT = 0, rate = 1, opts = {}, after } = {}) {
  let f, wrap, gl
  segment(name, start, end, (s) => {
    wrap = el('div', 'wrap3d', s.layer)
    f = footage(wrap, source, spec)
    if (glow) gl = el('div', 'glow', s.layer, { '--g1': (WIDE ? 150 : 120) + 'px', '--g2': (WIDE ? 34 : 26) + 'px', '--g3': (WIDE ? 280 : 220) + 'px', '--g4': (WIDE ? 70 : 54) + 'px' })
    after?.build?.(s)
  }, (s, t) => {
    const lt = t - s.start
    const y = travel(s, t)
    s.layer.style.transform = `translateY(${y}px)`
    if (spec.rectAt) { const q = spec.rectAt(lt); f.rect = q; f.sh.style.left = q.x + 'px'; f.sh.style.top = q.y + 'px'; f.sh.style.width = q.w + 'px'; f.sh.style.height = q.h + 'px' }
    setFootage(f, fromT + lt * rate, spec.cam(lt))
    if (spec.tilt) tilt(f.sh, t, s.start, s.end, ...spec.tilt)
    if (gl) gl.style.opacity = track(lt, glow)
    after?.update?.(s, t, f)
  }, opts)
}
window.__shot = shot
window.__seg = segment

/* -- Product moments: real recordings, framing per format -- */
const r = (x, y, w, h) => ({ x, y, w, h })
// One chat: the conversation, a message written, a real answer
shot('chat', T.chat, 'chat', WIDE
  ? { rect: r(420, 0, 1075, 1080), shadow: false, feather: { t: 120, b: 80 }, cam: (t) => ({ x: 215, y: track(t, [[0, 640], [3, 680]]), zoom: 2.5 }) }
  : { rect: r(30, 0, 1020, 1080), shadow: false, feather: { t: 110, b: 70 }, cam: (t) => ({ x: 215, y: track(t, [[0, 640], [3, 665]]), zoom: 2.37 }) },
{ fromT: .85, rate: 1.8 })
// Tag the AI: the composer, alone, huge
shot('type', T.type, 'type', WIDE
  ? { rect: r(0, 230, 1920, 620), shadow: false, feather: { t: 60 }, cam: (t) => ({ x: track(t, [[0, 215], [1.5, 215], [2.3, 290]]), y: track(t, [[0, 73], [2.3, 90]]), zoom: track(t, [[0, 4.2], [1.5, 4.2], [2.3, 4.9]]) }) }
  : { rect: r(0, 290, 1080, 500), shadow: false, feather: { t: 50 }, cam: (t) => ({ x: track(t, [[0, 170], [1, 170], [1.8, 262], [2.3, 268]]), y: track(t, [[0, 80], [2.3, 98]]), zoom: track(t, [[0, 3.3], [2.3, 3.5]]) }) },
{ fromT: .4 })
// The answer streams; Gemini at work lights the edge of the frame
shot('answer', T.answer, 'answer', WIDE
  ? { rect: r(420, 0, 1080, 1080), shadow: false, feather: { t: 130, b: 130 }, cam: (t) => ({ x: 215, y: track(t, [[0, 570], [1.8, 590]]), zoom: 2.5 }) }
  : { rect: r(30, 0, 1020, 1080), shadow: false, feather: { t: 110, b: 110 }, cam: (t) => ({ x: 215, y: track(t, [[0, 570], [1.8, 590]]), zoom: 2.37 }) },
{ fromT: .85, rate: 1.9, glow: [[0, 0], [.3, .72], [1.3, .72], [1.8, .25]] })
// ...and a block lands on the board in the gradient, with the answer floating beside it
{
  const BOX = window.__BLOCKBOX
  let reply
  const R = WIDE ? r(90, 150, 800, 360) : r(40, 90, 780, 350)
  const Z = WIDE ? 1.95 : 1.9
  // the new tile with its gradient ring, and the board around it (positions from the capture, see block frames)
  shot('block', T.block, 'block', WIDE
    ? { rect: r(760, 300, 1060, 680), radius: 44, tilt: [2, -3, 0, 1.2], cam: (t) => ({ x: 1060, y: 580, zoom: track(t, [[0, 2.8], [1.6, 2.9]]) }) }
    : { rect: r(220, 450, 820, 560), radius: 40, tilt: [2, -3, 0, 1], cam: (t) => ({ x: 1090, y: 580, zoom: track(t, [[0, 2.55], [1.6, 2.62]]) }) },
  { fromT: 1.0, glow: [[0, .35], [.5, 0]], after: {
    build: (s) => { reply = footage(s.layer.querySelector('.wrap3d'), 'block', { rect: R, radius: 36, shadow: true }) },
    update: (s, t) => { const lt = t - s.start; setFootage(reply, 1.0 + lt, { x: 205, y: 714, zoom: Z }); const u = emph(prog(lt, .05, .6)); reply.sh.style.transform = `translateY(${(1 - u) * 90}px) rotateX(2.2deg) rotateY(-2.6deg)`; reply.sh.style.zIndex = 3 },
  } })
}
// Your docs, your tools: a doc and a sheet open right in the pane, Open in Sheets is there
shot('docs', T.docs, 'docs', WIDE
  ? { rect: r(160, 40, 1600, 1000), radius: 44, tilt: [1.6, -2.2, 0, 1], cam: (t) => ({ x: 400, y: 250, zoom: 2 }) }
  : { rect: r(40, 130, 1000, 820), radius: 40, tilt: [1.4, -2, 0, .8], cam: (t) => ({ x: 400, y: 328, zoom: 1.25 }) },
{ fromT: .45, rate: 1.62 })

// Your calls. Right there: chat at left, call at right, in the project. The idea, not a scene.
const CALLT = window.__CALL ? window.__CALL[WIDE ? 'wide' : 'square'] : { camLine: 8.2, chorus: 45.6, hang: 49.8, clip: { width: 1442, height: 808 } }
window.__CALLCUTS = [
  // film offset, length, source start (from the capture, see capture/call-cuts.mjs), caption
  { at: 0, len: 3.1, src: CALLT.camLine - .1, rate: 1, cap: 'Hold on, let me turn my camera on.' },
  { at: 3.1, len: 2.2, src: CALLT.chorus - .4, rate: 1, cap: 'Wow.   Whoa.   Oh, that’s so good.', capAt: .35, peak: true },
  { at: 5.3, len: 2.5, src: CALLT.hang - .4, rate: 1.7, cap: 'Hang up. The summary and the to-dos are already there.', capAt: .55 },
]
{
  const SRC = WIDE ? 'callwide' : 'callsquare'
  const SIZE = { w: CALLT.clip.width, h: CALLT.clip.height }
  const RECT = WIDE ? r(59, 35, 1802, 1010) : r(38, 165, 1004, 718)
  const FIT = Math.min(RECT.w / SIZE.w, RECT.h / SIZE.h)
  let f, wrap, subs, subIn
  segment('call', ...T.call, (s) => {
    wrap = el('div', 'wrap3d', s.layer)
    f = footage(wrap, SRC, { rect: RECT, radius: 32, shadow: true })
    subs = el('div', 'subs', s.layer, { fontSize: (WIDE ? 42 : 38) + 'px', zIndex: 5 })
    subIn = el('span', '', subs)
  }, (s, t) => {
    const lt = t - s.start
    s.layer.style.transform = `translateY(${travel(s, t)}px)`
    const cuts = window.__CALLCUTS
    const c = cuts.find((x) => lt < x.at + x.len) ?? cuts[cuts.length - 1]
    const ct = lt - c.at
    setFootage(f, c.src + ct * c.rate, { x: SIZE.w / 2, y: SIZE.h / 2, zoom: FIT })
    const grow = lerp(.975, 1, smooth(prog(lt, 0, 7.8)))
    f.sh.style.transform = `scale(${grow})`
    subs.style.bottom = (WIDE ? 100 : 130) + 'px'
    const shown = c.cap && ct >= (c.capAt ?? 0) && ct < c.len - .05
    subs.style.display = shown ? 'flex' : 'none'
    if (shown) subIn.textContent = c.cap
    subIn.style.whiteSpace = 'pre-wrap'
    const pop = c.peak ? emph(prog(ct, c.capAt, c.capAt + .35)) : 1
    subIn.style.fontSize = c.peak ? (WIDE ? '1.32em' : '1.14em') : '1em'
    subIn.style.transform = c.peak ? `scale(${lerp(.86, 1, pop)})` : 'none'
    subIn.style.fontWeight = c.peak ? 500 : 400
  })
}

// Your project, end to end: the whole board, then what needs you
shot('overview', T.overview, 'overview', WIDE
  ? { rect: r(70, 40, 1780, 1000), radius: 40, tilt: [1.4, -1.8, 0, 1], cam: (t) => ({ x: 756, y: track(t, [[0, 440], [2, 448]]), zoom: track(t, [[0, 1.18], [2, 1.2]]) }) }
  : { rect: r(30, 40, 1020, 1000), radius: 40, tilt: [1.2, -1.6, 0, .8], cam: (t) => ({ x: 1104, y: track(t, [[0, 440], [2, 450]]), zoom: track(t, [[0, 1.27], [2, 1.3]]) }) },
{ fromT: .4, rate: 1.3 })
shot('home', T.home, 'home', WIDE
  ? { rect: r(70, 50, 1780, 980), radius: 40, tilt: [1.4, 1.8, 0, 1], cam: (t) => ({ x: 545, y: track(t, [[0, 300], [2, 306]]), zoom: track(t, [[0, 1.66], [2, 1.7]]) }) }
  : { rect: r(30, 170, 1020, 740), radius: 40, tilt: [1.2, 1.6, 0, .8], cam: (t) => ({ x: 378, y: 274, zoom: track(t, [[0, 1.35], [2, 1.4]]) }) },
{ fromT: .9, rate: 1.4 })

/* -- The turn: AI everywhere, a sparkle in every corner. Each sparkle becomes a person. -- */
{
  const FACES = WIDE
    ? [['maya', -650, -300, 226], ['tom', 660, -290, 246], ['sofia', -700, 250, 250], ['karim', 690, 270, 226], ['lea', -320, 380, 158], ['priya', 340, -400, 144], ['jun', 300, 410, 144], ['ben', -320, -410, 130]]
    : [['maya', -350, -395, 196], ['tom', 350, -385, 208], ['sofia', -370, 385, 208], ['karim', 370, 400, 196], ['lea', -60, 435, 130], ['priya', 30, -450, 120]]
  const SVG = (id) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" style="display:block"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset=".28" stop-color="#4285f4"/><stop offset=".5" stop-color="#9b72cb"/><stop offset=".72" stop-color="#d96570"/></linearGradient></defs><path fill="url(#${id})" d="M12 0C12.6 6.6 17.4 11.4 24 12 17.4 12.6 12.6 17.4 12 24 11.4 17.4 6.6 12.6 0 12 6.6 11.4 11.4 6.6 12 0Z"/></svg>`
  const mkSparkles = (s, tag) => FACES.map(([n, x, y, d], i) => { const e = el('div', '', s.layer, { position: 'absolute', left: W / 2 + 'px', top: H / 2 + 'px', width: d * .42 + 'px', height: d * .42 + 'px' }); e.innerHTML = SVG(tag + i); return { e, x, y, d: d * .42, i } })
  const place = (e, x, y, d, sc, rot = 0) => { e.style.transform = `translate(${x - d / 2}px,${y - d / 2}px) rotate(${rot}deg) scale(${sc})` }
  let spA, glowA
  statement('every', ...T.every, [['AI everywhere.']], [['AI'], ['everywhere.']], { t0: .1, opts: { noOut: true }, extra: {
    build: (s) => { spA = mkSparkles(s, 'a'); glowA = el('div', 'glow', s.layer, { '--g1': (WIDE ? 150 : 120) + 'px', '--g2': (WIDE ? 34 : 26) + 'px', '--g3': (WIDE ? 280 : 220) + 'px', '--g4': (WIDE ? 70 : 54) + 'px' }) },
    update: (s, t) => {
      const lt = t - s.start
      glowA.style.opacity = emph(prog(lt, .2, .8)) * .68
      spA.forEach(({ e, x, y, d, i }) => { const a = .32 + i * .07, u = emph(prog(lt, a, a + .5)); e.style.opacity = prog(lt, a, a + .06); place(e, x, y + Math.sin((t + i) * 1.1) * 7, d, lerp(.2, 1, u), (1 - u) * -90 + Math.sin(t * .6 + i) * 8) })
    },
  } })
  let items = [], spB, glowB
  statement('people', ...T.people, [['So we can focus'], [{ t: 'on people.', blue: true }]], [['So we can'], ['focus'], [{ t: 'on people.', blue: true }]], { t0: .08, stagger: .13, size: WIDE ? 168 : 130, opts: { noIn: true },
    extra: {
      build: (s) => {
        glowB = el('div', 'glow', s.layer, { '--g1': (WIDE ? 150 : 120) + 'px', '--g2': (WIDE ? 34 : 26) + 'px', '--g3': (WIDE ? 280 : 220) + 'px', '--g4': (WIDE ? 70 : 54) + 'px' })
        FACES.forEach(([n, x, y, d], i) => { const e = el('div', 'face', s.layer, { width: d + 'px', height: d + 'px', left: W / 2 + 'px', top: H / 2 + 'px', backgroundImage: `url(/call/${n}.webp)` }); items.push({ e, x, y, d, i }) })
        spB = mkSparkles(s, 'b')
      },
      update: (s, t) => {
        const lt = t - s.start
        glowB.style.opacity = .68 * (1 - std(prog(lt, .1, .9)))
        items.forEach(({ e, x, y, d, i }) => {
          const a = .32 + i * .06, u = emph(prog(lt, a, a + .62))
          const dr = Math.sin((t + i) * 1.1) * 7
          e.style.opacity = prog(lt, a, a + .08)
          place(e, x, y + dr, d, lerp(.18, 1, u))
        })
        spB.forEach(({ e, x, y, d, i }) => {
          const a = .32 + i * .06, u = emph(prog(lt, a, a + .2))
          e.style.opacity = 1 - prog(lt, a, a + .1)
          place(e, x, y + Math.sin((t + i) * 1.1) * 7, d, 1 + u * .6, Math.sin(t * .6 + i) * 8 + u * 45)
        })
      },
    } })
}

/* -- Only you -- */
{
  const gem = { i: 'gemini' }
  statement('only1', ...T.only1, [['No one else has'], [{ i: 'gmail' }, ' Gmail, ', { i: 'docs' }, ' Docs,'], [{ i: 'meet' }, ' Meet and ', gem, ' Gemini.']], [['No one else has'], [{ i: 'gmail' }, ' Gmail, ', { i: 'docs' }, ' Docs,'], [{ i: 'meet' }, ' Meet and'], [gem, ' Gemini.']], { t0: .05, stagger: .1, size: WIDE ? 128 : 104 })
  statement('only2', ...T.only2, [['Only ', { t: 'you', blue: true }, ' can do this.']], [['Only ', { t: 'you', blue: true }], ['can do this.']], { t0: .08, stagger: .16, size: WIDE ? 170 : 146 })
}

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
    if (seg.name.startsWith('w') && e.parentElement.style.filter !== 'none') continue // the neighbours on the wheel run off frame on purpose
    const lt = window.__auditT ?? 0
    if (lt < seg.start + .7 || lt > seg.end - .12) continue
    if (q.left < margin || q.right > W - margin || q.top < margin || q.bottom > H - margin) out.push(`${seg.name}: "${txt.slice(0, 30)}" at ${Math.round(q.left)},${Math.round(q.top)} to ${Math.round(q.right)},${Math.round(q.bottom)}`)
  }
  return out
}
