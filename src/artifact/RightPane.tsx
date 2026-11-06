import { useEffect, useMemo, useRef, useState } from 'react'
import { CallView } from '../call/CallView'
import type { Artifact, PaneView } from '../data/types'
import { useT } from '../i18n'
import { roleIn, useProject, useStore } from '../store'
import { Icon } from '../ui/kit'
import './artifact.css'
import { BlockGallery } from './BlockGallery'
import { Board } from './Board'
import { DocView } from './docs/DocView'
import { PdfView } from './docs/PdfView'
import { SheetView } from './docs/SheetView'
import { SlidesView } from './docs/SlidesView'
import { BoardContext, KindIcon } from './shared'

const BOARD_VIEW: PaneView = { type: 'board' }
const TABS_KEY = 'one-place-open-tabs'
type TabMap = Record<string, string[]>
const loadTabs = (): TabMap => {
  try { return JSON.parse(localStorage.getItem(TABS_KEY) ?? '{}') as TabMap } catch { return {} }
}
const saveTabs = (m: TabMap) => {
  try { localStorage.setItem(TABS_KEY, JSON.stringify(m)) } catch { /* private mode: tabs just won't come back */ }
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

  const activeKey = view === 'call' ? 'call' : view === 'artifact' ? openArtifact!.id : 'board'
  useEffect(() => {
    tablist.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeKey, tabIds.length])

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
      <div ref={tablist} className="rp-tabs" role="tablist" aria-label={t({ fr: 'Ouvert dans ce projet', en: 'Open in this project' })} onKeyDown={onTabsKey}>
        <div className={`rp-tab${activeKey === 'board' ? ' on' : ''}`} role="presentation">
          <button type="button" role="tab" aria-selected={activeKey === 'board'} tabIndex={activeKey === 'board' ? 0 : -1} className="rp-tab-btn" onClick={() => setPane({ type: 'board' })}>
            <Icon name="dashboard" size={18} fill={activeKey === 'board'} />{t({ fr: 'Tableau', en: 'Board' })}
          </button>
        </div>
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
      <BoardContext.Provider value={{ project, role, viewerId }}>
        <div className="rp-body">
          {/* The board stays mounted under a document: scroll position kept, 3D paused by its own observer. */}
          <div className="rp-view" hidden={view !== 'board'} role="tabpanel"><Board key={project.id} /></div>
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
