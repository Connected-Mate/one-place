import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { GEMINI_ID, ME_ID, people, seedProjects, SEED_VERSION } from './data/seed'
import type { Block, CallState, Lang, Message, MobilePane, PaneView, Person, Project, Todo, Txt, Visibility } from './data/types'
import { detectLang } from './lang'

export const uid = (p = 'id') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
export type Theme = 'auto' | 'light' | 'dark'
export interface Toast { id: string; text: Txt; icon?: string; action?: { label: Txt; run: () => void } }

export interface State {
  lang: Lang
  theme: Theme
  /** the persona the demo is viewed as: changes what is visible (private messages, guest scope, permissions) */
  viewerId: string
  projects: Project[]
  activeProjectId: string
  /** the personal dashboard is showing instead of the active project */
  home: boolean
  /** rows of Home set aside by hand, as `viewerId:itemId` */
  homeDone: string[]
  panes: Record<string, PaneView> // per project
  mobilePane: MobilePane
  railCollapsed: boolean
  chatWidth: number
  call: CallState | null
  welcomeSeen: boolean
  tourDone: string[]
  toasts: Toast[]
  /** composer draft target: private recipient for the active project, or null = everyone */
  privateTo: string | null
  /** message the private composer quotes */
  quoteId: string | null
  /** message to scroll to and flash */
  focusMessageId: string | null
  blockGalleryOpen: boolean

  setLang(l: Lang): void
  setTheme(t: Theme): void
  setViewer(id: string): void
  selectProject(id: string): void
  goHome(): void
  markHomeDone(key: string): void
  setPane(v: PaneView): void
  setMobilePane(p: MobilePane): void
  toggleRail(): void
  setChatWidth(w: number): void
  dismissWelcome(): void
  markTour(step: string): void
  toast(t: Omit<Toast, 'id'>): void
  dropToast(id: string): void
  setPrivateTo(id: string | null, quoteId?: string | null): void
  focusMessage(id: string | null): void
  setBlockGallery(open: boolean): void

  // messages
  push(projectId: string, m: Message): void
  patch(projectId: string, messageId: string, patch: Partial<Message>): void
  reply(projectId: string, parentId: string, m: Message): void
  react(projectId: string, messageId: string, emoji: string): void

  // board
  addBlock(projectId: string, b: Block): void
  removeBlock(projectId: string, blockId: string): void
  moveBlock(projectId: string, blockId: string, delta: number): void
  patchBlock(projectId: string, blockId: string, patch: Partial<Block>): void
  toggleTodo(projectId: string, blockId: string, todoId: string): void
  addTodo(projectId: string, blockId: string, t: Todo): void
  addArtifact(projectId: string, a: Project['artifacts'][number]): void
  patchArtifact(projectId: string, id: string, patch: Partial<Project['artifacts'][number]>): void
  decideProposal(projectId: string, messageId: string, approved: boolean): void

  // projects
  createProject(name: string, template: 'blank' | 'launch' | 'event'): string
  addMember(projectId: string, personId: string): void

  // call: the call module fills the summary on end
  setCall(c: CallState | null): void
  patchCall(p: Partial<CallState>): void

  reset(): void
}

const mapP = (s: State, id: string, fn: (p: Project) => Project) => ({ projects: s.projects.map((p) => (p.id === id ? fn(p) : p)) })
const safe = createJSONStorage(() => ({
  getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  setItem: (k, v) => { try { localStorage.setItem(k, v) } catch { /* private mode: keep going */ } },
  removeItem: (k) => { try { localStorage.removeItem(k) } catch { /* ignore */ } },
}))

/** Going back into the active project from Home: it counts as reading it, like selectProject. */
const leaveHome = (s: State): Partial<State> => (s.home ? { home: false, ...mapP(s, s.activeProjectId, (p) => ({ ...p, unread: 0, mentions: 0 })) } : {})

const initial = () => ({
  lang: detectLang(),
  theme: 'auto' as Theme,
  viewerId: ME_ID,
  projects: seedProjects(),
  activeProjectId: 'aurora',
  home: true,
  homeDone: [] as string[],
  panes: {} as Record<string, PaneView>,
  mobilePane: 'chat' as MobilePane,
  railCollapsed: false,
  chatWidth: 440,
  call: null,
  welcomeSeen: false,
  tourDone: [] as string[],
  toasts: [] as Toast[],
  privateTo: null,
  quoteId: null,
  focusMessageId: null,
  blockGalleryOpen: false,
})

export const useStore = create<State>()(persist((set, get) => ({
  ...initial(),

  setLang: (lang) => set({ lang }),
  setTheme: (theme) => set({ theme }),
  setViewer: (viewerId) => set({ viewerId, privateTo: null, quoteId: null }),
  selectProject: (id) => set((s) => ({ ...mapP(s, id, (p) => ({ ...p, unread: 0, mentions: 0 })), activeProjectId: id, home: false, mobilePane: 'chat', privateTo: null, quoteId: null })),
  // The call stays alive behind Home: without its pane open, CallChip shows the way back to it.
  goHome: () => set((s) => ({ home: true, mobilePane: 'chat', privateTo: null, quoteId: null, panes: s.panes[s.activeProjectId]?.type === 'call' ? { ...s.panes, [s.activeProjectId]: { type: 'board' } } : s.panes })),
  markHomeDone: (key) => set((s) => (s.homeDone.includes(key) ? s : { homeDone: [...s.homeDone, key] })),
  setPane: (v) => set((s) => ({ ...leaveHome(s), panes: { ...s.panes, [s.activeProjectId]: v }, mobilePane: 'pane' })),
  // 'projects' is only the phone's list of projects, over whatever is current; the others show the project.
  setMobilePane: (mobilePane) => set((s) => (mobilePane === 'projects' ? { mobilePane } : { ...leaveHome(s), mobilePane })),
  toggleRail: () => set((s) => ({ railCollapsed: !s.railCollapsed })),
  setChatWidth: (chatWidth) => set({ chatWidth }),
  dismissWelcome: () => set({ welcomeSeen: true }),
  markTour: (step) => set((s) => (s.tourDone.includes(step) ? s : { tourDone: [...s.tourDone, step] })),
  toast: (t) => {
    const id = uid('toast')
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }))
    setTimeout(() => get().dropToast(id), 5000)
  },
  dropToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setPrivateTo: (privateTo, quoteId = null) => set({ privateTo, quoteId }),
  focusMessage: (focusMessageId) => set({ focusMessageId }),
  setBlockGallery: (blockGalleryOpen) => set({ blockGalleryOpen }),

  push: (pid, m) => set((s) => mapP(s, pid, (p) => ({
    ...p, messages: [...p.messages, m],
    unread: pid === s.activeProjectId && !s.home ? p.unread : p.unread + 1,
  }))),
  patch: (pid, mid, patch) => set((s) => mapP(s, pid, (p) => ({ ...p, messages: p.messages.map((m) => (m.id === mid ? ({ ...m, ...patch } as Message) : m)) }))),
  reply: (pid, parent, m) => set((s) => mapP(s, pid, (p) => ({ ...p, messages: p.messages.map((x) => (x.id === parent ? { ...x, replies: [...(x.replies ?? []), m] } : x)) }))),
  react: (pid, mid, emoji) => set((s) => mapP(s, pid, (p) => ({
    ...p,
    messages: p.messages.map((m) => {
      if (m.id !== mid) return m
      const me = s.viewerId
      const rs = m.reactions ?? []
      const r = rs.find((x) => x.emoji === emoji)
      const next = !r ? [...rs, { emoji, by: [me] }]
        : rs.map((x) => (x.emoji === emoji ? { ...x, by: x.by.includes(me) ? x.by.filter((b) => b !== me) : [...x.by, me] } : x)).filter((x) => x.by.length)
      return { ...m, reactions: next }
    }),
  }))),

  addBlock: (pid, b) => {
    set((s) => mapP(s, pid, (p) => ({ ...p, blocks: [...p.blocks, { ...b, fresh: true }] })))
    setTimeout(() => get().patchBlock(pid, b.id, { fresh: false }), 1800)
  },
  removeBlock: (pid, bid) => set((s) => mapP(s, pid, (p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== bid) }))),
  moveBlock: (pid, bid, d) => set((s) => mapP(s, pid, (p) => {
    const i = p.blocks.findIndex((b) => b.id === bid); const j = i + d
    if (i < 0 || j < 0 || j >= p.blocks.length) return p
    const blocks = [...p.blocks]; [blocks[i], blocks[j]] = [blocks[j], blocks[i]]
    return { ...p, blocks }
  })),
  patchBlock: (pid, bid, patch) => set((s) => mapP(s, pid, (p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === bid ? ({ ...b, ...patch } as Block) : b)) }))),
  toggleTodo: (pid, bid, tid) => set((s) => mapP(s, pid, (p) => ({
    ...p, blocks: p.blocks.map((b) => (b.id === bid && b.type === 'todo' ? { ...b, todos: b.todos.map((t) => (t.id === tid ? { ...t, done: !t.done } : t)) } : b)),
  }))),
  addTodo: (pid, bid, t) => set((s) => mapP(s, pid, (p) => ({
    ...p, blocks: p.blocks.map((b) => (b.id === bid && b.type === 'todo' ? { ...b, todos: [t, ...b.todos] } : b)),
  }))),
  addArtifact: (pid, a) => set((s) => mapP(s, pid, (p) => ({ ...p, artifacts: [...p.artifacts, a] }))),
  patchArtifact: (pid, id, patch) => set((s) => mapP(s, pid, (p) => ({ ...p, artifacts: p.artifacts.map((a) => (a.id === id ? ({ ...a, ...patch } as typeof a) : a)) }))),
  decideProposal: (pid, mid, approved) => {
    const s = get()
    const p = s.projects.find((x) => x.id === pid); const m = p?.messages.find((x) => x.id === mid)
    if (!p || !m || m.kind !== 'proposal' || m.status !== 'pending') return // double click safe
    s.patch(pid, mid, { status: approved ? 'approved' : 'declined', decidedBy: s.viewerId } as Partial<Message>)
    s.markTour('proposal')
    if (!approved) return
    const a = m.action
    if (a.type === 'add-block') s.addBlock(pid, a.block)
    if (a.type === 'add-todo') s.addTodo(pid, a.blockId, a.todo)
    if (a.type === 'move-milestone') {
      set((st) => mapP(st, pid, (pr) => ({
        ...pr,
        blocks: pr.blocks.map((b) => (b.id === a.blockId && b.type === 'timeline'
          ? { ...b, fresh: true, items: b.items.map((it) => (it.id === a.itemId ? { ...it, start: it.start + a.deltaDays * 864e5, end: it.end + a.deltaDays * 864e5 } : it)) }
          : b)),
      })))
      setTimeout(() => get().patchBlock(pid, a.blockId, { fresh: false }), 1800)
    }
  },

  createProject: (name, template) => {
    const id = uid('p')
    const me = ME_ID
    const blocks: Block[] = [
      { id: uid('b'), type: 'summary', title: { fr: 'Où on en est', en: 'Where things stand' }, span: 3, text: { fr: 'Rien pour l’instant. Gemini résumera ici tout ce qui se passe dans le projet.', en: 'Nothing yet. Gemini will summarize here everything that happens in this project.' }, bullets: [], updatedAt: Date.now() },
      { id: uid('b'), type: 'todo', title: { fr: 'À faire', en: 'To do' }, span: 1, todos: [] },
      { id: uid('b'), type: 'people', title: { fr: 'Équipe', en: 'Team' }, span: 1 },
      { id: uid('b'), type: 'files', title: { fr: 'Fichiers', en: 'Files' }, span: 1, artifactIds: [] },
    ]
    if (template !== 'blank') blocks.splice(1, 0, { id: uid('b'), type: 'timeline', title: { fr: 'Calendrier', en: 'Timeline' }, span: 3, items: [] })
    const project: Project = {
      id, name, icon: 'folder', color: '#4285f4',
      description: { fr: 'Nouveau projet', en: 'New project' },
      ownerId: me, memberIds: [me], externalIds: [], unread: 0, mentions: 0, blocks, artifacts: [],
      address: `${name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'}@oneplace.example`,
      createdByUser: true,
      messages: [{ id: uid('m'), kind: 'system', authorId: me, at: Date.now(), visibility: { type: 'all' }, text: { fr: 'Projet créé. Tout ce qui le concerne se passera ici.', en: 'Project created. Everything about it happens here.' }, icon: 'celebration' }],
    }
    set((s) => ({ projects: [project, ...s.projects], activeProjectId: id, home: false, mobilePane: 'chat', privateTo: null, quoteId: null }))
    return id
  },
  addMember: (pid, personId) => set((s) => mapP(s, pid, (p) => (p.memberIds.includes(personId) ? p : { ...p, memberIds: [...p.memberIds, personId] }))),

  setCall: (call) => set({ call }),
  patchCall: (p) => set((s) => (s.call ? { call: { ...s.call, ...p } } : s)),

  reset: () => set({ ...initial(), lang: get().lang, theme: get().theme, welcomeSeen: true }),
}), {
  name: 'one-place',
  version: SEED_VERSION,
  storage: safe,
  migrate: () => initial() as unknown as State, // new seed: start clean rather than crash
  partialize: (s) => ({ theme: s.theme, viewerId: s.viewerId, projects: s.projects, activeProjectId: s.activeProjectId, home: s.home, homeDone: s.homeDone, panes: s.panes, railCollapsed: s.railCollapsed, chatWidth: s.chatWidth, welcomeSeen: s.welcomeSeen, tourDone: s.tourDone }) as State,
}))

/* ------- selectors / helpers used everywhere ------- */
export const personById = (id: string): Person => people.find((p) => p.id === id) ?? { id, name: id, title: '', email: '', hue: '#5f6368', role: 'external', presence: 'offline' }
export const useProject = () => useStore((s) => s.projects.find((p) => p.id === s.activeProjectId) ?? s.projects[0])
export const useViewer = () => personById(useStore((s) => s.viewerId))
export const canSee = (v: Visibility, viewerId: string) => v.type === 'all' || v.with.includes(viewerId)
/** owner edits directly; members propose; guests see only their call. */
export const roleIn = (p: Project, viewerId: string): 'owner' | 'member' | 'guest' => (p.ownerId === viewerId ? 'owner' : p.memberIds.includes(viewerId) ? 'member' : 'guest')
export { GEMINI_ID, ME_ID }
const BOARD: PaneView = { type: 'board' } // same object each read: safe as a store selector
/** What the phone shows: Home has no tab state of its own, it sits over the chat and board tabs. */
export const mobileView = (s: State): MobilePane | 'home' => (s.home && s.mobilePane !== 'projects' ? 'home' : s.mobilePane)
export const paneOf = (s: State): PaneView => s.panes[s.activeProjectId] ?? BOARD
