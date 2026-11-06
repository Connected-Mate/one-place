import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CallView } from '../call/CallView'
import type { Artifact, Block, PaneView } from '../data/types'
import { useT } from '../i18n'
import { roleIn, useProject, useStore } from '../store'
import { Icon } from '../ui/kit'
import { AdviceChip } from './AdviceChip'
import './artifact.css'
import { BlockGallery } from './BlockGallery'
import { SectionView } from './Board'
import { DocView } from './docs/DocView'
import { PdfView } from './docs/PdfView'
import { SheetView } from './docs/SheetView'
import { SlidesView } from './docs/SlidesView'
import { Overview } from './Overview'
import { BLOCK_META, BoardContext, KindIcon, revealIn } from './shared'

const BOARD_VIEW: PaneView = { type: 'board' }
const TABS_KEY = 'one-place-open-tabs'
type TabMap = Record<string, string[]>
const loadTabs = (): TabMap => {
  try { return JSON.parse(localStorage.getItem(TABS_KEY) ?? '{}') as TabMap } catch { return {} }
}
const saveTabs = (m: TabMap) => {
  try { localStorage.setItem(TABS_KEY, JSON.stringify(m)) } catch { /* private mode: tabs just won't come back */ }
}
// Which part of the board is showing, per project. 'overview' or a block id.
const SECTIONS_KEY = 'one-place-board-section'
const loadSections = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(SECTIONS_KEY) ?? '{}') as Record<string, string> } catch { return {} }
}
const saveSections = (m: Record<string, string>) => {
  try { localStorage.setItem(SECTIONS_KEY, JSON.stringify(m)) } catch { /* private mode: back to Overview on reload */ }
}
/** A tab is named after its kind, so the row stays short. A chart goes by its own title; a second of a kind too. */
function sectionTabs(blocks: Block[], t: (v: { fr: string; en: string } | string) => string) {
  const seen = new Map<string, number>()
  return blocks.map((b) => {
    const n = (seen.get(b.type) ?? 0) + 1
    seen.set(b.type, n)
    const kind = t(BLOCK_META[b.type].label)
    const own = t(b.title)
    const label = b.type === 'chart' ? own : n === 1 ? kind : own && own !== kind ? own : `${kind} ${n}`
    return { block: b, label }
  })
}
const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function ArtifactView({ artifact }: { artifact: Artifact }) {
  switch (artifact.kind) {
    case 'doc': return <DocView doc={artifact} />
    case 'sheet': return <SheetView sheet={artifact} />
    case 'slides': return <SlidesView deck={artifact} />
    case 'pdf': return <PdfView pdf={artifact} />
  }
}

export function RightPane() {
  const t = useT()
  const project = useProject()
  const viewerId = useStore((s) => s.viewerId)
  // not useStore(paneOf): it builds a new object on every read, which loops under useSyncExternalStore
  const rawPane = useStore((s) => s.panes[s.activeProjectId]) ?? BOARD_VIEW
  const call = useStore((s) => s.call)
  const setPane = useStore((s) => s.setPane)
  const selectProject = useStore((s) => s.selectProject)
  const toast = useStore((s) => s.toast)
  const galleryOpen = useStore((s) => s.blockGalleryOpen)
  const setBlockGallery = useStore((s) => s.setBlockGallery)
  const [tabMap, setTabMap] = useState<TabMap>(loadTabs)
  const [sectionMap, setSectionMap] = useState<Record<string, string>>(loadSections)
  const [overflow, setOverflow] = useState({ left: false, right: false })
  const [now, setNow] = useState(() => Date.now())
  const tablist = useRef<HTMLDivElement>(null)
  const warned = useRef<string | null>(null)

  const callHere = !!call && call.projectId === project?.id
  const openArtifact = rawPane.type === 'artifact' ? project?.artifacts.find((a) => a.id === rawPane.id) : undefined
  // What really shows: a stale call or a missing document falls back to the board.
  const view = rawPane.type === 'call' && callHere ? 'call' : openArtifact ? 'artifact' : 'board'

  // An unknown document: back to the board, once, without yanking a phone user to this pane.
  useEffect(() => {
    if (rawPane.type !== 'artifact' || openArtifact) { warned.current = null; return }
    if (warned.current === rawPane.id) return
    warned.current = rawPane.id
    useStore.setState((s) => ({ panes: { ...s.panes, [s.activeProjectId]: { type: 'board' } } }))
    toast({ text: { fr: 'Ce document n’est plus dans le projet', en: 'This document is no longer in the project' }, icon: 'error' })
  }, [rawPane, openArtifact, toast])

  const pid = project?.id ?? ''
  const stored = tabMap[pid]
  const tabIds = useMemo(() => {
    const known = (stored ?? []).filter((id) => project?.artifacts.some((a) => a.id === id))
    return openArtifact && !known.includes(openArtifact.id) ? [...known, openArtifact.id] : known
  }, [stored, project?.artifacts, openArtifact])
  useEffect(() => {
    if ((stored ?? []).join() === tabIds.join()) return
    setTabMap((m) => { const next = { ...m, [pid]: tabIds }; saveTabs(next); return next })
  }, [tabIds, stored, pid])

  useEffect(() => {
    if (!call) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [call])

  const blocks = project?.blocks
  const storedSection = sectionMap[pid] ?? 'overview'
  const openBlock = storedSection === 'overview' ? undefined : blocks?.find((b) => b.id === storedSection)
  const section = openBlock ? openBlock.id : 'overview'
  const activeKey = view === 'call' ? 'call' : view === 'artifact' ? openArtifact!.id : section
  const pickSection = useCallback((id: string) => {
    setSectionMap((m) => { const next = { ...m, [useStore.getState().activeProjectId]: id }; saveSections(next); return next })
  }, [])
  const openSection = useCallback((id: string) => {
    pickSection(id)
    useStore.getState().setPane({ type: 'board' })
  }, [pickSection])

  // Something just landed on the board. On Overview its tile glows, right there. On another part of the
  // board, its own tab opens. In a document or a call nothing is taken away: its tab lights up instead.
  const freshIds = useMemo(() => (blocks ?? []).filter((b) => b.fresh).map((b) => b.id), [blocks])
  const knownFresh = useRef({ pid, ids: freshIds })
  useEffect(() => {
    const known = knownFresh.current
    knownFresh.current = { pid, ids: freshIds }
    if (known.pid !== pid) return
    const arrived = freshIds.filter((id) => !known.ids.includes(id))
    if (arrived.length && view === 'board' && section !== 'overview') pickSection(arrived[0])
    const tab = tablist.current?.querySelector(`[data-tab="${CSS.escape(arrived[0] ?? '')}"]`)
    if (tab) revealIn(tablist.current, tab, { top: 0, right: 40, bottom: 0, left: 40 })
  }, [freshIds, pid, view, section, pickSection])
  // The flag can outlive its timer (a reload in mid-animation, a block that is not on screen).
  useEffect(() => {
    if (!freshIds.length) return
    const timer = setTimeout(() => { for (const id of freshIds) useStore.getState().patchBlock(pid, id, { fresh: false }) }, 2400)
    return () => clearTimeout(timer)
  }, [freshIds, pid])

  const tabCount = (blocks?.length ?? 0) + tabIds.length + (call ? 1 : 0)
  const readOverflow = useCallback(() => {
    const el = tablist.current
    if (!el) return
    const left = el.scrollLeft > 2, right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
    setOverflow((o) => (o.left === left && o.right === right ? o : { left, right }))
  }, [])
  useLayoutEffect(() => {
    const el = tablist.current
    if (!el) return
    readOverflow()
    const ro = new ResizeObserver(readOverflow)
    ro.observe(el)
    return () => ro.disconnect()
  }, [readOverflow, tabCount, pid])
  useEffect(() => {
    revealIn(tablist.current, tablist.current?.querySelector('[aria-selected="true"]')?.parentElement, { top: 0, right: 40, bottom: 0, left: 40 })
  }, [activeKey, tabCount])
  const scrollTabs = (dir: -1 | 1) => tablist.current?.scrollBy({ left: dir * tablist.current.clientWidth * 0.7 })

  if (!project) return <section className="pane right-pane" />

  const closeTab = (id: string) => {
    const rest = tabIds.filter((x) => x !== id)
    setTabMap((m) => { const next = { ...m, [pid]: rest }; saveTabs(next); return next })
    if (activeKey !== id) return
    const i = tabIds.indexOf(id)
    const neighbour = rest[i] ?? rest[i - 1]
    setPane(neighbour ? { type: 'artifact', id: neighbour } : { type: 'board' })
  }
  const openCall = () => {
    if (!call) return
    if (!callHere) selectProject(call.projectId)
    setPane({ type: 'call' })
  }
  const onTabsKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return
    const tabs = [...(tablist.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])]
    const i = tabs.indexOf(document.activeElement as HTMLElement)
    if (i < 0) return
    e.preventDefault()
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    tabs[next].focus()
    tabs[next].click()
  }
  const role = roleIn(project, viewerId)

  return (
    <section className="pane right-pane" aria-label={t({ fr: 'Vue partagée du projet', en: 'Shared project view' })}>
      <BoardContext.Provider value={{ project, role, viewerId }}>
      <div className="rp-tabbar">
      {overflow.left && <button type="button" className="rp-tab-scroll prev" tabIndex={-1} aria-hidden="true" onClick={() => scrollTabs(-1)}><Icon name="chevron_left" size={20} /></button>}
      <div ref={tablist} className="rp-tabs" role="tablist" aria-label={t({ fr: 'Parties du projet', en: 'Parts of this project' })} onKeyDown={onTabsKey} onScroll={readOverflow}>
        <div className={`rp-tab${activeKey === 'overview' ? ' on' : ''}`} role="presentation" data-tab="overview">
          <button type="button" role="tab" aria-selected={activeKey === 'overview'} tabIndex={activeKey === 'overview' ? 0 : -1} className="rp-tab-btn" onClick={() => openSection('overview')}>
            <Icon name="dashboard" size={18} fill={activeKey === 'overview'} />{t({ fr: 'Vue d’ensemble', en: 'Overview' })}
          </button>
        </div>
        {sectionTabs(project.blocks, t).map(({ block, label }) => {
          const on = activeKey === block.id
          return (
            <div key={block.id} className={`rp-tab${on ? ' on' : ''}${block.fresh && !on ? ' fresh' : ''}`} role="presentation" data-tab={block.id}>
              <button type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1} className="rp-tab-btn" title={label} onClick={() => openSection(block.id)}>
                <span className="rp-trunc">{label}</span>
              </button>
            </div>
          )
        })}
        {tabIds.map((id) => {
          const a = project.artifacts.find((x) => x.id === id)!
          const title = t(a.title)
          const on = activeKey === id
          return (
            <div key={id} className={`rp-tab closable${on ? ' on' : ''}`} role="presentation" onAuxClick={(e) => { if (e.button === 1) closeTab(id) }}>
              <button type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1} className="rp-tab-btn" title={title} onClick={() => setPane({ type: 'artifact', id })} onKeyDown={(e) => { if (e.key === 'Delete') closeTab(id) }}>
                <KindIcon kind={a.kind} size={18} /><span className="rp-trunc">{title}</span>
              </button>
              <button type="button" className="rp-tab-x" aria-label={t({ fr: `Fermer ${title}`, en: `Close ${title}` })} onClick={() => closeTab(id)}><Icon name="close" size={16} /></button>
            </div>
          )
        })}
        {call && (
          <div className={`rp-tab rp-tab-call${activeKey === 'call' ? ' on' : ''}`} role="presentation">
            <button type="button" role="tab" aria-selected={activeKey === 'call'} tabIndex={activeKey === 'call' ? 0 : -1} className="rp-tab-btn" onClick={openCall}>
              <i className="rp-live-dot" aria-hidden="true" />{t({ fr: 'Appel', en: 'Call' })}<span className="rp-tab-time">{mmss(now - call.startedAt)}</span>
            </button>
          </div>
        )}
      </div>
      {overflow.right && <button type="button" className="rp-tab-scroll next" tabIndex={-1} aria-hidden="true" onClick={() => scrollTabs(1)}><Icon name="chevron_right" size={20} /></button>}
      {role !== 'guest' && <div className="rp-advice-slot"><AdviceChip key={project.id} onOpenSection={openSection} /></div>}
      </div>
        <div className="rp-body">
          {/* Overview stays mounted under the other tabs: scroll position kept, and its bars can animate a move. */}
          <div className="rp-view" hidden={view !== 'board' || section !== 'overview'} role="tabpanel"><Overview key={project.id} onOpen={openSection} /></div>
          {view === 'board' && openBlock && <div className="rp-view" role="tabpanel" key={openBlock.id}><SectionView block={openBlock} /></div>}
          {view === 'artifact' && <div className="rp-view" role="tabpanel" key={openArtifact!.id}><ArtifactView artifact={openArtifact!} /></div>}
          {/* The call keeps running behind other tabs and other projects. */}
          {call && <div className="rp-view" role="tabpanel" hidden={view !== 'call'}><CallView /></div>}
        </div>
        {galleryOpen && role !== 'guest' && <BlockGallery project={project} />}
        {galleryOpen && role === 'guest' && <CloseOnMount close={() => setBlockGallery(false)} />}
      </BoardContext.Provider>
    </section>
  )
}

/** A guest persona can't add anything: don't leave the flag on for when the persona changes back. */
function CloseOnMount({ close }: { close: () => void }) {
  useEffect(close, [close])
  return null
}
