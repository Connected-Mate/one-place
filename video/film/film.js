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
const icon = (n) => n === 'tasks' ? '/workspace/tasks.png' : `/workspace/${n}.svg`
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
const dsfOf = { home: 3, type: 4, answer: 3, block: 3, private: 3, tabs: 3, callwide: 3, callsquare: 3 }
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

const T = window.__T = { // the edit, on a 120 bpm grid
  hello: [0, 2], spend: [2, 4], gmail: [4, 6], chaos: [6, 10], designed: [10, 12], merge: [12, 14.5],
  w1: [14.5, 15.5], home: [15.5, 18.5], w2: [18.5, 19.5], type: [19.5, 22], answer: [22, 24], block: [24, 25.5], w3: [25.5, 26.5], priv: [26.5, 29.5],
  w4: [29.5, 30.5], call: [30.5, 43.5], w5: [43.5, 44.5], tabs: [44.5, 47.5],
  every: [47.5, 49], people: [49, 51.5], hey: [51.5, 53.5], hire: [53.5, 56], end: [56, 60],
}
window.__DURATION = T.end[1]

/* -- Hello -- */
statement('hello', ...T.hello, [['Hello Google.']], [['Hello'], ['Google.']], { mode: 'type', t0: .3, cps: 15, carets: ['#4285f4'], opts: { noIn: true } })
statement('spend', ...T.spend, [['You’re spending'], [{ t: '$200B', blue: true }, ' on AI.']], [['You’re spending'], [{ t: '$200B', blue: true }, ' on AI.']], {})
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

statement('designed', ...T.designed, [['So I designed'], [{ t: 'what’s next.', blue: true }]], [['So I designed'], [{ t: 'what’s next.', blue: true }]], { opts: { noIn: true }, t0: .25, stagger: .17 })

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
    name.textContent = 'One Place'
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
  { wide: 'One place', sq: ['One place'] },
  { wide: 'One AI', sq: ['One AI'] },
  { wide: 'Private, in context', sq: ['Private,', 'in context'] },
  { wide: 'Every call, right here', sq: ['Every call,', 'right here'] },
  { wide: 'Built on the fly', sq: ['Built', 'on the fly'] },
  { wide: 'One place', sq: ['One place'] },
]
function wheel(name, [start, end], index) {
  let items = []
  const fs = WIDE ? 150 : 124
  const lh = fs * 1.2
  const heights = WHEEL.map((w) => (WIDE ? 1 : w.sq.length) * lh + (WIDE ? fs * .34 : fs * .36))
  const posOf = (i) => { let y = 0; const k = Math.floor(i); for (let j = 0; j < k; j++) y += heights[j % 6]; return y + heights[k % 6] * (i - k) }
  segment(name, start, end, (s) => {
    for (let i = -3; i <= 9; i++) {
      const w = WHEEL[(i + 6) % 6]
      const e = el('div', '', s.layer, { position: 'absolute', left: 0, right: 0, top: '50%', textAlign: 'center', fontSize: fs + 'px', lineHeight: 1.2, whiteSpace: 'nowrap' })
      ;(WIDE ? [w.wide] : w.sq).forEach((l) => { const d = el('div', '', e); d.textContent = l })
      items.push({ e, i })
    }
  }, (s, t) => {
    const lt = t - s.start
    const roll = lerp(index - .9, index, emph(prog(lt, .0, .62)))
    const center = posOf(roll + 12) + heights[index] / 2 - 0
    items.forEach(({ e, i }) => {
      const y = posOf(i + 12) - posOf(roll + 12) - (((WIDE ? 1 : WHEEL[(i + 6) % 6].sq.length) * lh) / 2)
      const dist = Math.abs(i - roll)
      const on = 1 - clamp(dist / .55)
      e.style.color = on > .5 ? '#4285f4' : '#bdc1c6'
      if (on > 0 && on < 1) e.style.color = `rgb(${lerp(189, 66, on)},${lerp(193, 133, on)},${lerp(198, 244, on)})`
      e.style.opacity = clamp(1.05 - Math.max(0, dist - .4) * .62)
      const blur = Math.min(14, dist * 9)
      e.style.filter = blur < .05 ? 'none' : `blur(${blur}px)`
      e.style.transform = `translateY(${y}px) scale(${lerp(.86, 1, on)})`
    })
    s.layer.style.transform = `translateY(${travel(s, t)}px)`
  }, { noIn: true })
}
wheel('w1', T.w1, 0); wheel('w2', T.w2, 1); wheel('w3', T.w3, 2); wheel('w4', T.w4, 3); wheel('w5', T.w5, 4)

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

/* -- Product moments: framing per format -- */
const r = (x, y, w, h) => ({ x, y, w, h })
// Home: what needs you
shot('home', T.home, 'home', WIDE
  ? { rect: r(150, 150, 1620, 780), radius: 44, tilt: [3.4, -5, 0, 1.8], cam: (t) => ({ x: track(t, [[0, 400], [3, 360]]), y: track(t, [[0, 186], [3, 182]]), zoom: track(t, [[0, 2.08], [3, 2.22]]) }) }
  : { rect: r(50, 250, 980, 600), radius: 40, tilt: [3, -4, 0, 1.6], feather: { r: 90 }, cam: (t) => ({ x: track(t, [[0, 256], [3, 248]]), y: track(t, [[0, 158], [3, 160]]), zoom: track(t, [[0, 1.9], [3, 2.0]]) }) },
{ fromT: .55 })
// One AI: the composer, alone, huge. The pill runs off frame like the real ads.
shot('type', T.type, 'type', WIDE
  ? { rect: r(0, 230, 1920, 620), shadow: false, feather: { t: 60 }, cam: (t) => ({ x: track(t, [[0, 215], [1.7, 215], [2.5, 300]]), y: track(t, [[0, 73], [2.5, 92]]), zoom: track(t, [[0, 4.3], [1.7, 4.3], [2.5, 5.4]]) }) }
  : { rect: r(0, 290, 1080, 500), shadow: false, feather: { t: 50 }, cam: (t) => ({ x: track(t, [[0, 170], [1, 170], [1.9, 262], [2.5, 268]]), y: track(t, [[0, 80], [2.5, 98]]), zoom: track(t, [[0, 3.3], [2.5, 3.5]]) }) },
{ fromT: .2 })
// The answer streams; Gemini at work lights the edge of the frame
shot('answer', T.answer, 'answer', WIDE
  ? { rect: r(420, 0, 1080, 1080), shadow: false, feather: { t: 130, b: 130 }, cam: (t) => ({ x: 215, y: track(t, [[0, 570], [2, 590]]), zoom: 2.5 }) }
  : { rect: r(30, 0, 1020, 1080), shadow: false, feather: { t: 110, b: 110 }, cam: (t) => ({ x: 215, y: track(t, [[0, 570], [2, 590]]), zoom: 2.37 }) },
{ fromT: .85, rate: 1.7, glow: [[0, 0], [.35, .72], [1.5, .72], [2, .25]] })
// ...and a block lands on the board: the answer and the block, two floating pieces of the same screen
{
  let reply
  const R = WIDE ? r(120, 66, 800, 360) : r(40, 150, 780, 350)
  const Z = WIDE ? 1.95 : 1.9
  shot('block', T.block, 'block', WIDE
    ? { rect: r(180, 480, 1560, 507), radius: 44, tilt: [2.2, -2.6, 0, 1.2], cam: (t) => ({ x: 840, y: 755, zoom: track(t, [[0, 1.95], [1.5, 1.99]]) }) }
    : { rect: r(40, 545, 1000, 325), radius: 40, tilt: [2, -2.4, 0, 1], cam: (t) => ({ x: 840, y: 755, zoom: track(t, [[0, 1.25], [1.5, 1.28]]) }) },
  { fromT: 1.0, glow: [[0, .35], [.5, 0]], after: {
    build: (s) => { reply = footage(s.layer.querySelector('.wrap3d'), 'block', { rect: R, radius: 36, shadow: true }) },
    update: (s, t) => { const lt = t - s.start; setFootage(reply, 1.0 + lt, { x: 205, y: 714, zoom: Z }); const u = emph(prog(lt, .05, .6)); reply.sh.style.transform = `translateY(${(1 - u) * 90}px) rotateX(${2.2}deg) rotateY(${-2.6}deg)`; reply.sh.style.zIndex = 3 },
  } })
}
// Private, in context
shot('private', T.priv, 'private', WIDE
  ? { rect: r(420, 0, 1080, 1080), shadow: false, feather: { t: 130, b: 130 }, cam: (t) => ({ x: 215, y: track(t, [[0, 380], [1.4, 460], [3, 610]]), zoom: 2.5 }) }
  : { rect: r(30, 0, 1020, 1080), shadow: false, feather: { t: 110, b: 110 }, cam: (t) => ({ x: 215, y: track(t, [[0, 380], [1.4, 460], [3, 610]]), zoom: 2.37 }) },
{ fromT: .6, rate: 1.7 })

// Every call, right here: an edit on the real timeline, with the real voices
const CALLT = window.__CALL ? window.__CALL[WIDE ? 'wide' : 'square'] : { src: [6.35, 19.95, 22.9, 30.3], chorus: 31, lea: 33.18, leaEnd: 37.75 }
window.__CALLCUTS = [
  // film offset, length, source start (from the capture, see capture/call-cuts.mjs), caption
  { at: 0, len: 1.7, src: CALLT.src[0], cap: 'No link, no waiting room?', who: 'Maya' },
  { at: 1.7, len: 2.45, src: CALLT.src[1], cap: 'Can you guys hear me?', who: 'Tom', cap2: 'Yes.', cap2at: 1.55 },
  { at: 4.15, len: 1.2, src: CALLT.src[2], cap: 'Sorry, sorry.', who: 'Karim' },
  { at: 5.35, len: 7.65, src: CALLT.src[3], cap: null },
]
{
  const SRC = WIDE ? 'callwide' : 'callsquare'
  const SIZE = WIDE ? { w: 1588, h: 936 } : { w: 800, h: 845 }
  const RECT = WIDE ? r(90, 27, 1740, 1026) : r(67, 40, 946, 1000)
  const FIT = Math.min(RECT.w / SIZE.w, RECT.h / SIZE.h)
  let f, wrap, subs, subIn, note
  // captions of the last cut: the moment everyone says it at once
  const c0 = CALLT.src[3]
  const LAST = [[CALLT.chorus - c0 + .05, CALLT.lea - c0 - .28, 'Wow.   Whoa.   Oh, that’s so good.'], [CALLT.lea - c0 - .18, CALLT.leaEnd - c0 + .1, 'Okay, it’s the first time I’ve wanted to come to a meeting.']]
  segment('call', ...T.call, (s) => {
    wrap = el('div', 'wrap3d', s.layer)
    f = footage(wrap, SRC, { rect: RECT, radius: 40, shadow: true })
    f.sh.style.boxShadow = '0 40px 120px rgba(31,41,55,.24),0 10px 40px rgba(66,133,244,.10)'
    subs = el('div', 'subs', s.layer, { bottom: (WIDE ? 100 : 104) + 'px', fontSize: (WIDE ? 42 : 40) + 'px' })
    subIn = el('span', '', subs)
  }, (s, t) => {
    const lt = t - s.start
    s.layer.style.transform = `translateY(${travel(s, t)}px)`
    const cuts = window.__CALLCUTS
    const c = cuts.find((x) => lt < x.at + x.len) ?? cuts[cuts.length - 1]
    const ct = lt - c.at
    let cam
    const i = cuts.indexOf(c)
    if (WIDE) {
      if (i === 0) cam = { x: 1192, y: track(ct, [[0, 430], [1.7, 420]]), zoom: track(ct, [[0, 2.2], [1.7, 2.3]]) } // Maya, just arrived
      else if (i === 1) cam = { x: 794, y: 468, zoom: FIT } // everyone, Tom asks
      else if (i === 2) cam = { x: 1324, y: 690, zoom: track(ct, [[0, 3.3], [1.3, 3.4]]) } // Karim, late
      else cam = { x: 794, y: 468, zoom: FIT } // the wow: the whole room, the card itself grows, no name gets cut
    } else {
      if (i === 0) cam = { x: 598, y: 330, zoom: track(ct, [[0, 2.5], [1.7, 2.6]]) }
      else if (i === 1) cam = { x: 400, y: 422.5, zoom: FIT }
      else if (i === 2) cam = { x: 666, y: 610, zoom: track(ct, [[0, 3.55], [1.3, 3.65]]) }
      else cam = { x: 400, y: 422.5, zoom: FIT }
    }
    const hw = RECT.w / 2 / cam.zoom, hh = RECT.h / 2 / cam.zoom
    cam.x = clamp(cam.x, hw, SIZE.w - hw); cam.y = clamp(cam.y, hh, SIZE.h - hh)
    setFootage(f, c.src + ct, cam)
    // the push: the floating card grows slowly towards the viewer
    const grow = i === 1 ? track(ct, [[0, .965], [c.len, 1]], (u) => u) : i === 3 ? track(ct, [[0, .9], [c.len, 1]], smooth) : 1
    f.sh.style.transform = `scale(${grow})`
    // captions sit on the card, above its controls, however large the card is at that moment
    subs.style.bottom = (H - (RECT.y + RECT.h / 2 + RECT.h / 2 * grow) + (i === 0 || i === 2 ? 34 : (WIDE ? 62 : 70)) * grow) + 'px'
    let txt = null
    if (c.cap) { txt = c.cap; if (c.cap2 && ct >= c.cap2at) txt = c.cap2 }
    else for (const [a, b, q] of LAST) if (ct >= a && ct < b) txt = q
    subs.style.display = txt ? 'flex' : 'none'
    if (txt) { subIn.textContent = txt }
    subIn.style.whiteSpace = 'pre-wrap'
    // the emotional peak gets bigger words, on the same beat as the voices
    const peak = i === 3 && ct >= LAST[0][0] && ct < LAST[0][1]
    const pop = peak ? emph(prog(ct, LAST[0][0], LAST[0][0] + .35)) : 1
    subIn.style.fontSize = peak ? (WIDE ? '1.32em' : '1.14em') : '1em'
    subIn.style.transform = peak ? `scale(${lerp(.86, 1, pop)})` : 'none'
    subIn.style.fontWeight = peak ? 500 : 400
  })
}

// Built on the fly: the tab row floats alone, then opens into what Gemini just made
{
  const openT = 1.45
  const hAt = (t, h0, h1) => track(t, [[0, h0], [openT, h0], [openT + .6, h1]], std)
  shot('tabs', T.tabs, 'tabs', WIDE
    ? { rect: r(100, 450, 1720, 180), radius: 44, tilt: [2.2, -3, 0, 1.2], rectAt: (t) => { const h = hAt(t, 150, 780); return r(100, 540 - h / 2, 1720, h) }, cam: (t) => ({ x: track(t, [[0, 500], [openT, 560], [openT + .6, 400]], std), y: track(t, [[0, 20], [openT, 20], [openT + .6, 177]], std), zoom: track(t, [[0, 3.1], [openT, 3.1], [openT + .6, 2.15], [3, 2.24]], std) }) }
    : { rect: r(40, 450, 1000, 180), radius: 40, tilt: [2, -2.6, 0, 1], rectAt: (t) => { const h = hAt(t, 118, 600); return r(40, 540 - h / 2, 1000, h) }, cam: (t) => ({ x: track(t, [[0, 500], [openT, 570], [openT + .6, 370]], std), y: track(t, [[0, 20], [openT, 20], [openT + .6, 222]], std), zoom: track(t, [[0, 2.6], [openT, 2.6], [openT + .6, 1.35], [3, 1.4]], std) }) },
  { fromT: 1.0, rate: 1.75 })
}

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
