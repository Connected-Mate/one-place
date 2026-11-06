/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Colorway studio: Sand or Slate, under the lamp's own light. A configurator with the debate attached.
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Block, Message } from '../../data/types'
import { uid, useStore } from '../../store'
import { AvatarStack, Button, Icon, Sparkle } from '../../ui/kit'
import { Frame, useBoard } from '../shared'
import { colorCost, colorDefaults, colorVerdict, COLORS, glowContrast, kelvinCss, money, pollOf, type ColorId } from './logic'
import type { StudioControl, StudioView } from './studio3d'
import { Seg, Slider, useAppState, Verdict, type AppProps } from './ui'

const hasWebGL = () => {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
}

/** When WebGL is missing: the same lamps, drawn in layers. */
function CssLamps({ kelvin, brightness, view }: { kelvin: number; brightness: number; view: StudioView }) {
  const list: ColorId[] = view === 'compare' ? ['sand', 'slate'] : [view]
  return (
    <div className="ap-css-stage" style={{ '--glow': kelvinCss(kelvin), '--b': brightness / 100 } as CSSProperties} aria-hidden="true">
      {list.map((c) => <div key={c} className="ap-css-lamp" style={{ '--base': COLORS[c].css } as CSSProperties}><i className="pool" /><i className="halo" /><i className="globe" /><i className="foot" /></div>)}
    </div>
  )
}

export default function Colorway({ block }: AppProps) {
  const { project, viewerId, role } = useBoard()
  const [state, update, flush] = useAppState(block, colorDefaults)
  const kelvin = Number(state.kelvin), brightness = Number(state.brightness)
  const view = state.view as StudioView
  const host = useRef<HTMLDivElement>(null)
  const ctl = useRef<StudioControl | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading')
  const [playing, setPlaying] = useState(false)
  const lookRef = useRef({ kelvin, brightness, view })
  lookRef.current = { kelvin, brightness, view }

  useEffect(() => {
    if (!hasWebGL()) { setStatus('fallback'); return }
    let dead = false
    let made: StudioControl | null = null
    import('./studio3d').then((m) => {
      if (dead || !host.current) return
      made = m.createStudio(host.current, lookRef.current, () => { if (!dead) { ctl.current = null; setStatus('fallback') } })
      ctl.current = made
      setStatus('ready')
    }).catch(() => { if (!dead) setStatus('fallback') })
    return () => { dead = true; made?.dispose(); ctl.current = null }
  }, [])
  useEffect(() => { ctl.current?.set({ kelvin, brightness, view }) }, [kelvin, brightness, view])

  // A 20-minute sunrise in eight seconds. Only when asked.
  const raf = useRef(0)
  const play = () => {
    if (playing) { cancelAnimationFrame(raf.current); setPlaying(false); flush(); return }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { update({ kelvin: 3100, brightness: 100 }); return }
    setPlaying(true)
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 8000)
      update({ kelvin: Math.round((1300 + 1800 * p) / 50) * 50, brightness: Math.round(4 + 96 * p ** 1.4) })
      if (p < 1) raf.current = requestAnimationFrame(tick)
      else { setPlaying(false); flush() }
    }
    raf.current = requestAnimationFrame(tick)
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const poll = pollOf(project)
  const myVote = poll.options.find((o) => o.votes.includes(viewerId))?.id
  const vote = (id: string) => {
    if (role === 'guest') return
    const s = useStore.getState()
    const options = poll.options.map((o) => ({ id: o.id, label: o.label, votes: o.id === id && myVote !== id ? [...o.votes, viewerId] : o.votes.filter((v) => v !== viewerId) }))
    if (poll.source === 'block' && poll.blockId) {
      const b = project.blocks.find((x) => x.id === poll.blockId)
      if (b?.type === 'poll') s.patchBlock(project.id, b.id, { options: b.options.map((o, i) => ({ ...o, votes: options[i].votes })) } as Partial<Block>)
    } else if (poll.source === 'proposal' && poll.messageId) {
      // Tom's poll is still waiting for approval: the vote travels with it.
      const m = project.messages.find((x) => x.id === poll.messageId)
      if (m?.kind === 'proposal' && m.action.type === 'add-block' && m.action.block.type === 'poll') {
        const blockNext = { ...m.action.block, options: m.action.block.options.map((o, i) => ({ ...o, votes: options[i].votes })) }
        s.patch(project.id, m.id, { action: { ...m.action, block: blockNext } } as Partial<Message>)
      }
    }
  }
  const proposeHero = (c: ColorId) => {
    const s = useStore.getState()
    const name = COLORS[c].name
    const title = `Use ${name} for the keynote hero`
    const same = project.messages.find((m) => m.kind === 'proposal' && m.status === 'pending' && m.title === title)
    if (same) { s.focusMessage(same.id); s.setMobilePane('chat'); return }
    const id = uid('m')
    const extra = colorCost(project, c).extra
    s.push(project.id, {
      id, kind: 'proposal', authorId: viewerId, at: Date.now(), visibility: { type: 'all' }, status: 'pending', title,
      description: `From the Colorway studio. ${extra ? `About ${money(extra)} for a second shoot, an estimate.` : 'No extra cost: the photos are done.'} ${poll.total ? `Poll so far: ${poll.options.map((o) => `${o.label} ${o.votes.length}`).join(', ')}.` : ''}`.trim(),
      action: { type: 'none' },
    })
    s.focusMessage(id)
    s.setMobilePane('chat')
  }

  const onKey = (e: React.KeyboardEvent) => {
    const k = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, 0.04], ArrowDown: [0, -0.04] }[e.key]
    if (!k || !ctl.current) return
    e.preventDefault()
    ctl.current.nudge(k[0], k[1])
  }
  const toneWord = kelvin < 1700 ? 'Deep red' : kelvin < 2300 ? 'Amber dawn' : kelvin < 2800 ? 'Warm sunrise' : 'Warm white'
  const list: ColorId[] = ['sand', 'slate']
  return (
    <Frame block={block}>
      <div className="ap ap-color">
        <div className={`ap-stage ${status}`} data-status={status} role="group" tabIndex={status === 'ready' ? 0 : undefined} onKeyDown={onKey}
          aria-label={`Aurora in ${view === 'compare' ? 'Sand and Slate, side by side' : COLORS[view].name}, ${kelvin} kelvin, ${brightness} percent. Drag or use arrow keys to look around.`}>
          <div ref={host} className="ap-stage-host" />
          {status === 'fallback' && <CssLamps kelvin={kelvin} brightness={brightness} view={view} />}
          {status === 'loading' && <div className="ap-stage-load" aria-hidden="true" />}
          <div className="ap-stage-top"><Seg size="s" label="Show" value={view} onChange={(v) => update({ view: v })} options={[{ id: 'compare', label: 'Compare' }, { id: 'sand', label: 'Sand' }, { id: 'slate', label: 'Slate' }]} /></div>
          {view === 'compare' && <div className="ap-stage-names" aria-hidden="true"><span>Sand</span><span>Slate</span></div>}
          <button type="button" className="ap-stage-play" onClick={play} aria-pressed={playing}><Icon name={playing ? 'pause' : 'play_arrow'} fill size={18} />{playing ? 'Pause' : 'Play the sunrise'}</button>
        </div>
        <div className="ap-color-panel">
          <div className="ap-color-sliders">
            <Slider label="Dawn light" min={1200} max={3400} step={50} value={kelvin} text={`${toneWord}, ${kelvin.toLocaleString('en-US')} K`} onChange={(v) => update({ kelvin: v })} onCommit={flush} />
            <Slider label="Brightness" min={0} max={100} value={brightness} text={`${brightness}%`} onChange={(v) => update({ brightness: v })} onCommit={flush} />
          </div>
          <ul className="ap-swatches">
            {list.map((c) => {
              const cost = colorCost(project, c)
              return (
                <li key={c} className={view === c ? 'on' : ''}>
                  <button type="button" className="ap-swatch" aria-pressed={view === c} onClick={() => update({ view: view === c ? 'compare' : c })}>
                    <i style={{ background: COLORS[c].css }} />
                    <span><b>{COLORS[c].name}</b><small>{COLORS[c].ready}</small></span>
                  </button>
                  <dl>
                    <div><dt>Extra cost</dt><dd>{cost.extra ? `about ${money(cost.extra)}` : 'None'}</dd></div>
                    <div><dt>Glow contrast</dt><dd>{glowContrast(c, kelvin, brightness).toFixed(1)}:1</dd></div>
                  </dl>
                  {role !== 'guest' && <Button size="s" variant="text" className="ap-swatch-go" onClick={() => proposeHero(c)}>Propose {COLORS[c].name} as hero</Button>}
                </li>
              )
            })}
          </ul>
        </div>
        {poll.options.length > 0 && (
          <section className="ap-poll" aria-label="Keynote hero poll">
            <header><b>{poll.question}</b><small>{poll.source === 'proposal' ? 'Tom’s poll, waiting for approval' : `${poll.total} ${poll.total === 1 ? 'vote' : 'votes'}`}</small></header>
            {poll.options.map((o) => (
              <button key={o.id} type="button" className={`ap-poll-row${myVote === o.id ? ' mine' : ''}`} aria-pressed={myVote === o.id} onClick={() => vote(o.id)}>
                <i style={{ width: `${poll.total ? (o.votes.length / poll.total) * 100 : 0}%` }} />
                <span className="ap-trunc">{o.label}</span>
                <AvatarStack ids={o.votes} size={20} max={3} />
                <b>{o.votes.length}</b>
              </button>
            ))}
          </section>
        )}
        <Verdict>{colorVerdict(project, kelvin, brightness)}</Verdict>
        {status === 'fallback' && <p className="ap-foot"><Sparkle size={14} />3D is not available on this device, so this is a drawn preview.</p>}
      </div>
    </Frame>
  )
}
