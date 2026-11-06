/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CallView } from '../call/CallView'
import type { Artifact, Block, PaneView } from '../data/types'
import { fmtDate, fmtTime, useT } from '../i18n'
import { roleIn, uid, useProject, useStore } from '../store'
import { Button, Icon, IconButton, Menu, Sparkle, type MenuItem } from '../ui/kit'
import { AdviceChip } from './AdviceChip'
import './artifact.css'
import { BlockGallery } from './BlockGallery'
import { SectionView } from './Board'
import { DocView } from './docs/DocView'
import { PdfView } from './docs/PdfView'
import { SheetView } from './docs/SheetView'
import { SlidesView } from './docs/SlidesView'
import { Overview } from './Overview'
import { BoardContext, KindIcon, revealIn, startOfDay } from './shared'

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
/**
 * The row, left to right, in every project. Overview and the three parts never move; Summary and People are reached from
 * their tile and from the header faces, so they have no tab, only a hidden one that links can press. Files sits on the right
 * with the documents. Whatever is left was made for this project: the middle, the only part that scrolls.
 */
const PARTS: { type: 'todo' | 'timeline' | 'calendar'; label: { fr: string; en: string } }[] = [
  { type: 'todo', label: { fr: 'À faire', en: 'To-do' } },
  { type: 'timeline', label: { fr: 'Feuille de route', en: 'Roadmap' } },
  { type: 'calendar', label: { fr: 'Agenda', en: 'Calendar' } },
]
const firstOf = (blocks: Block[], type: Block['type']) => blocks.find((b) => b.type === type)
function middleOf(blocks: Block[]) {
  const taken = (['todo', 'timeline', 'calendar', 'summary', 'people', 'files'] as const).map((type) => firstOf(blocks, type)?.id)
  return blocks.filter((b) => !taken.includes(b.id))
}
/** A part the project does not have yet: it comes into being, empty, the first time it is opened. */
function newPart(type: 'todo' | 'timeline' | 'calendar' | 'files'): Block {
  const base = { id: uid('b'), span: 3 as const }
  switch (type) {
    case 'todo': return { ...base, type, title: { fr: 'À faire', en: 'To do' }, todos: [] }
    case 'timeline': return { ...base, type, title: { fr: 'Feuille de route', en: 'Roadmap' }, items: [] }
    case 'calendar': return { ...base, type, title: { fr: 'Agenda', en: 'Calendar' }, events: [] }
    case 'files': return { ...base, type, title: { fr: 'Fichiers', en: 'Files' }, artifactIds: [] }
  }
}
/** Only the middle scrolls, and clear of its edge fades. */
function revealTab(middle: HTMLElement | null, tab: Element | null | undefined) {
  if (!middle || !tab || !tab.getClientRects().length) return
  revealIn(middle, tab, { top: 0, right: 28, bottom: 0, left: 28 })
}
const DOC_TAB_W = 120
const MIDDLE_MIN = 112
const AI_SPARK = <Sparkle size={12} mono />
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
  const [fade, setFade] = useState({ left: false, right: false })
  const [docSlots, setDocSlots] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const bar = useRef<HTMLDivElement>(null)
  const middle = useRef<HTMLDivElement>(null)
  const parts = useRef<HTMLDivElement>(null)
  const docsAnchor = useRef<HTMLDivElement>(null)
  const adviceSlot = useRef<HTMLDivElement>(null)
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
    toast({ text: { fr: 'Document introuvable', en: 'Document not found' }, icon: 'error' })
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
    // A refreshed summary glows on its tile: no one is taken away for that.
    const opens = arrived.find((id) => blocks?.some((b) => b.id === id && b.type !== 'summary'))
    if (opens && view === 'board' && section !== 'overview') pickSection(opens)
    revealTab(middle.current, middle.current?.querySelector(`[data-tab="${CSS.escape(arrived.at(-1) ?? '')}"]`))
  }, [freshIds, pid, view, section, pickSection, blocks])
  // The flag can outlive its timer (a reload in mid-animation, a block that is not on screen).
  useEffect(() => {
    if (!freshIds.length) return
    const timer = setTimeout(() => { for (const id of freshIds) useStore.getState().patchBlock(pid, id, { fresh: false }) }, 2400)
    return () => clearTimeout(timer)
  }, [freshIds, pid])

  const middleCount = blocks ? middleOf(blocks).length : 0
  const readFade = useCallback(() => {
    const el = middle.current
    if (!el) return
    const left = el.scrollLeft > 2, right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
    setFade((o) => (o.left === left && o.right === right ? o : { left, right }))
  }, [])
  // How many documents show as tabs: what the fixed parts leave, once the middle keeps enough to be usable. The rest go in the Files menu.
  const readRoom = useCallback(() => {
    readFade()
    const row = bar.current
    if (!row) return
    const fixed = (parts.current?.offsetWidth ?? 0) + (docsAnchor.current?.offsetWidth ?? 0) + (adviceSlot.current?.offsetWidth ?? 0)
    const room = row.clientWidth - fixed - MIDDLE_MIN - 12
    setDocSlots(matchMedia('(max-width:599px)').matches ? 0 : Math.max(0, Math.floor(room / DOC_TAB_W)))
  }, [readFade])
  useLayoutEffect(() => {
    readRoom()
    const ro = new ResizeObserver(readRoom)
    if (bar.current) ro.observe(bar.current)
    if (middle.current) ro.observe(middle.current)
    return () => ro.disconnect()
  }, [readRoom, middleCount, pid, !!call]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    revealTab(middle.current, middle.current?.querySelector('[aria-selected="true"]')?.parentElement)
  }, [activeKey, middleCount])

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
    const tabs = [...(bar.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])].filter((x) => x.getClientRects().length)
    const i = tabs.indexOf(document.activeElement as HTMLElement)
    if (i < 0) return
    e.preventDefault()
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    tabs[next].focus()
    tabs[next].click()
  }
  const role = roleIn(project, viewerId)
  const summaryBlock = firstOf(project.blocks, 'summary')
  const peopleBlock = firstOf(project.blocks, 'people')
  const filesBlock = firstOf(project.blocks, 'files')
  const made = middleOf(project.blocks)
  const madeOpen = !!openBlock && view === 'board' && made.some((b) => b.id === openBlock.id)
  // reached from a tile or from the header faces: Overview stays the tab in hand
  const viewFromOverview = activeKey === summaryBlock?.id || activeKey === peopleBlock?.id
  const openPart = (type: 'todo' | 'timeline' | 'calendar' | 'files') => {
    const have = firstOf(project.blocks, type)
    if (have) { openSection(have.id); return }
    const fresh = newPart(type)
    useStore.getState().addBlock(project.id, fresh)
    useStore.getState().patchBlock(project.id, fresh.id, { fresh: false })
    openSection(fresh.id)
  }
  const addLabel = role === 'owner' ? t({ fr: 'Ajouter un bloc', en: 'Add block' }) : t({ fr: 'Proposer un bloc', en: 'Propose a block' })
  // Documents take the tabs they have room for, the open one always among them. The others wait in the Files menu.
  const shownDocs = tabIds.slice(0, docSlots)
  if (openArtifact && docSlots > 0 && !shownDocs.includes(openArtifact.id)) shownDocs[docSlots - 1] = openArtifact.id
  const moreDocs = tabIds.filter((id) => !shownDocs.includes(id))
  const docTitle = (id: string) => t(project.artifacts.find((a) => a.id === id)!.title)
  const filesItems: MenuItem[] = moreDocs.map((id) => ({ label: docTitle(id), selected: activeKey === id, onSelect: () => setPane({ type: 'artifact', id }) }))
  if (openArtifact && moreDocs.includes(openArtifact.id)) filesItems.push({ divider: true, label: '' }, { label: t({ fr: `Fermer ${docTitle(openArtifact.id)}`, en: `Close ${docTitle(openArtifact.id)}` }), onSelect: () => closeTab(openArtifact.id) })
  const filesOn = activeKey === filesBlock?.id || (!!openArtifact && moreDocs.includes(openArtifact.id))
  const tabButton = (on: boolean, onClick: () => void, children: React.ReactNode, title?: string) => (
    <button type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1} className="rp-tab-btn" title={title} onClick={onClick}>{children}</button>
  )

  return (
    <section className="pane right-pane" aria-label={t({ fr: 'Vue partagée du projet', en: 'Shared project view' })}>
      <BoardContext.Provider value={{ project, role, viewerId }}>
      <div ref={bar} className="rp-tabbar" onKeyDown={onTabsKey}>
        <div ref={parts} className="rp-tabs rp-parts" role="tablist" aria-label={t({ fr: 'Parties du projet', en: 'Parts of this project' })}>
          <div className={`rp-tab${activeKey === 'overview' || viewFromOverview ? ' on' : ''}`} role="presentation" data-tab="overview">
            {tabButton(activeKey === 'overview' || viewFromOverview, () => openSection('overview'), t({ fr: 'Vue d’ensemble', en: 'Overview' }))}
          </div>
          {PARTS.map(({ type, label }) => {
            const block = firstOf(project.blocks, type)
            const on = !!block && activeKey === block.id
            return (
              <div key={type} className={`rp-tab${on ? ' on' : ''}${block?.fresh && !on ? ' fresh' : ''}`} role="presentation" data-tab={block?.id ?? `part-${type}`}>
                {tabButton(on, () => openPart(type), t(label))}
              </div>
            )
          })}
          {[summaryBlock, peopleBlock].map((block) => block && (
            <div key={block.id} role="presentation" data-tab={block.id} hidden>
              <button type="button" role="tab" aria-selected={false} tabIndex={-1} onClick={() => openSection(block.id)}>{t(block.title)}</button>
            </div>
          ))}
        </div>
        <i className="rp-divider" aria-hidden="true" />
        <div className="rp-mid-wrap">
          {made.length > 0 && (
            <div ref={middle} className={`rp-mid${fade.left ? ' fade-l' : ''}${fade.right ? ' fade-r' : ''}`} onScroll={readFade} onWheel={(e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY }}>
              <div className="rp-tabs" role="tablist" aria-label={t({ fr: 'Faits par Gemini pour ce projet', en: 'Made by Gemini for this project' })}>
                {made.map((block) => {
                  const on = activeKey === block.id
                  const title = t(block.title)
                  return (
                    <div key={block.id} className={`rp-tab rp-made${on ? ' on' : ''}${block.fresh && !on ? ' fresh' : ''}`} role="presentation" data-tab={block.id}>
                      {tabButton(on, () => openSection(block.id), <>{AI_SPARK}<span className="rp-trunc">{title}</span></>, title)}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {role !== 'guest' && (made.length > 0
            ? <IconButton icon="add" size={32} className="rp-add" label={addLabel} onClick={() => setBlockGallery(true)} />
            : <button type="button" className="rp-add-first" title={addLabel} onClick={() => setBlockGallery(true)}><Icon name="add" size={18} /><span className="rp-trunc">{t({ fr: 'Demander à Gemini de construire quelque chose', en: 'Ask Gemini to build something' })}</span></button>)}
        </div>
        <div className="rp-docs">
          <div ref={docsAnchor} className="rp-tabs" role="tablist" aria-label={t({ fr: 'Fichiers et appel', en: 'Files and call' })}>
            {call && (
              <div className={`rp-tab rp-tab-call${activeKey === 'call' ? ' on' : ''}`} role="presentation">
                {tabButton(activeKey === 'call', openCall, <><i className="rp-live-dot" aria-hidden="true" />{t({ fr: 'Appel', en: 'Call' })}<span className="rp-tab-time">{mmss(now - call.startedAt)}</span></>)}
              </div>
            )}
            <div className={`rp-tab rp-files${filesOn ? ' on' : ''}${filesBlock?.fresh && !filesOn ? ' fresh' : ''}`} role="presentation" data-tab={filesBlock?.id ?? 'part-files'}>
              {tabButton(filesOn, () => openPart('files'), t({ fr: 'Fichiers', en: 'Files' }))}
            </div>
          </div>
          {moreDocs.length > 0 && (
            <Menu align="right" items={filesItems} header={t({ fr: 'Documents ouverts', en: 'Open documents' })} trigger={(p) => (
              <button type="button" {...p} className="rp-files-more" aria-label={t({ fr: `${moreDocs.length} autres documents ouverts`, en: `${moreDocs.length} more open ${moreDocs.length === 1 ? 'document' : 'documents'}` })}>{moreDocs.length}<Icon name="arrow_drop_down" size={16} /></button>
            )} />
          )}
          {shownDocs.length > 0 && (
            <div className="rp-tabs" role="tablist" aria-label={t({ fr: 'Documents ouverts', en: 'Open documents' })}>
              {shownDocs.map((id) => {
                const a = project.artifacts.find((x) => x.id === id)!
                const title = t(a.title)
                const on = activeKey === id
                return (
                  <div key={id} className={`rp-tab closable${on ? ' on' : ''}`} role="presentation" style={{ width: DOC_TAB_W }} onAuxClick={(e) => { if (e.button === 1) closeTab(id) }}>
                    <button type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1} className="rp-tab-btn" title={title} onClick={() => setPane({ type: 'artifact', id })} onKeyDown={(e) => { if (e.key === 'Delete') closeTab(id) }}>
                      <KindIcon kind={a.kind} size={16} /><span className="rp-trunc">{title}</span>
                    </button>
                    <button type="button" className="rp-tab-x" aria-label={t({ fr: `Fermer ${title}`, en: `Close ${title}` })} onClick={() => closeTab(id)}><Icon name="close" size={14} /></button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {/* On a phone the middle would crowd the thumb row: the blocks made by AI are one tap away, in a sheet. */}
        {role !== 'guest' && (
          <div className={`rp-ai-sheet${madeOpen ? ' on' : ''}${made.some((b) => b.fresh) ? ' fresh' : ''}`}>
            <Menu align="right" header={t({ fr: 'Fait par IA', en: 'Made by AI' })}
              items={[
                ...made.map((b) => ({ label: t(b.title), selected: activeKey === b.id, onSelect: () => openSection(b.id) })),
                ...(made.length ? [{ divider: true, label: '' }] : []),
                { icon: 'add', label: made.length ? addLabel : t({ fr: 'Demander à Gemini de construire quelque chose', en: 'Ask Gemini to build something' }), onSelect: () => setBlockGallery(true) },
              ]}
              trigger={(p) => <button type="button" {...p} className="rp-ai-btn" aria-label={t({ fr: 'Fait par IA', en: 'Made by AI' })} title={t({ fr: 'Fait par IA', en: 'Made by AI' })}><Sparkle size={18} mono /></button>}
            />
          </div>
        )}
        {role !== 'guest' && <div ref={adviceSlot} className="rp-advice-slot"><AdviceChip key={project.id} onOpenSection={openSection} /></div>}
      </div>
        <div className="rp-body">
          {/* Overview stays mounted under the other tabs: scroll position kept, and its bars can animate a move. */}
          <div className="rp-view" hidden={view !== 'board' || section !== 'overview'} role="tabpanel"><Overview key={project.id} onOpen={openSection} /></div>
          {view === 'board' && openBlock && (
            <div className="rp-view" role="tabpanel" key={openBlock.id}>
              {viewFromOverview && <div className="rp-viewbar"><button type="button" className="rp-back" onClick={() => openSection('overview')}><Icon name="arrow_back" size={16} />{t({ fr: 'Vue d’ensemble', en: 'Overview' })}</button></div>}
              {madeOpen && <MadeLine block={openBlock} canAsk={role !== 'guest'} />}
              <SectionView block={openBlock} />
            </div>
          )}
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

/** A block in the middle was made for this project: it says so, and asking for a change is one click. */
function MadeLine({ block, canAsk }: { block: Block; canAsk: boolean }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const lastMessage = useProject()?.messages.at(-1)?.at
  const at = block.updatedAt ?? lastMessage ?? Date.now()
  const when = startOfDay(at) === startOfDay(Date.now()) ? fmtTime(at, lang) : fmtDate(at, lang)
  const ask = () => window.dispatchEvent(new CustomEvent('oneplace:compose', { detail: { text: `@Gemini update ${t(block.title)}: ` } }))
  return (
    <div className="rp-viewbar rp-made-line">
      <span>{t({ fr: `Fait par Gemini · mis à jour ${when}`, en: `Made by Gemini · updated ${when}` })}</span>
      {canAsk && <Button size="s" className="rp-quiet" onClick={ask}>{t({ fr: 'Demander une mise à jour', en: 'Ask Gemini to update' })}</Button>}
    </div>
  )
}

/** A guest persona can't add anything: don't leave the flag on for when the persona changes back. */
function CloseOnMount({ close }: { close: () => void }) {
  useEffect(close, [close])
  return null
}
