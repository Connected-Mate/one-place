/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The contract every part of the app shares. Change it only with care: other modules depend on it.
export type Lang = 'fr' | 'en'
/** A text in both languages. User-typed text is stored as a plain string. */
export type L = { fr: string; en: string }
export type Txt = L | string

export type Role = 'owner' | 'member' | 'guest' | 'external' | 'ai'
export interface Person {
  id: string
  name: string
  title: Txt
  email: string
  /** path relative to public/, e.g. avatars/maya.webp. Falls back to initials on `hue`. */
  avatar?: string
  hue: string
  role: Role // default role; a project may narrow it
  presence: 'online' | 'away' | 'offline' | 'dnd'
  /** Shown in the account panel. A real person keeps only what they agreed to: no invented facts. */
  fullName?: string
  company?: string
  team?: string
  location?: string
  timeZone?: string
  linkedin?: string
  /** a real person other than the author: name, title and photo only */
  minimal?: boolean
}

/**
 * Who can see a message. `private` is visible only to `with` (always includes the author).
 * `space` belongs to a sub-team of the project (see Space): only its members see it, wherever it shows up.
 */
export type Visibility = { type: 'all' } | { type: 'private'; with: string[] } | { type: 'space'; space: string; with: string[] }

/**
 * A sub-team inside a project, with its own thread and its own files.
 * `confidential`: part of the team only (costs, negotiation). `partner`: the team and an outside company, who sees nothing else.
 */
export interface Space {
  id: string
  name: Txt
  icon: string
  kind: 'confidential' | 'partner'
  /** everyone who reads and writes here, Gemini included */
  memberIds: string[]
  /** the outside company, for a partner space */
  org?: string
  description: Txt
}

export interface Reaction { emoji: string; by: string[] }

interface Base {
  id: string
  authorId: string
  /** epoch ms */
  at: number
  visibility: Visibility
  reactions?: Reaction[]
  replies?: Message[]
  /** true while Gemini is still writing */
  streaming?: boolean
  /** id of the message this one quotes (used by private replies: "about this message") */
  quoteId?: string
}
/** `text` may contain mentions written @[Display name](personId) and **bold**. */
export interface TextMessage extends Base { kind: 'text'; text: Txt }
/** Mail that landed in the project: the sender has no account, the reply goes back by mail. */
export interface EmailMessage extends Base {
  kind: 'email'; direction: 'in' | 'out'; subject: Txt; body: Txt; from: string; to: string; attachmentIds?: string[]
}
export interface MeetingMessage extends Base {
  kind: 'meeting'; title: Txt; start: number; durationMin: number; attendeeIds: string[]; guestEmails?: string[]; live?: boolean; ended?: boolean
}
export interface CallSummaryMessage extends Base {
  kind: 'call-summary'; title: Txt; durationMin: number; attendeeIds: string[]; summary: Txt; decisions: Txt[]; todoIds: string[]
}
export interface FileMessage extends Base { kind: 'file'; text?: Txt; artifactId: string }
/** Something a member (or Gemini) proposes; the project owner approves or declines. */
export interface ProposalMessage extends Base {
  kind: 'proposal'; title: Txt; description: Txt; action: ProposalAction; status: 'pending' | 'approved' | 'declined'; decidedBy?: string
}
export interface SystemMessage extends Base { kind: 'system'; text: Txt; icon?: string }
export type Message = TextMessage | EmailMessage | MeetingMessage | CallSummaryMessage | FileMessage | ProposalMessage | SystemMessage

export type ProposalAction =
  | { type: 'add-block'; block: Block }
  | { type: 'add-todo'; blockId: string; todo: Todo }
  | { type: 'move-milestone'; blockId: string; itemId: string; deltaDays: number; /** items that move with it, like a keynote with its launch */ alsoItemIds?: string[] }
  | { type: 'none' }

export interface Subtask { id: string; text: Txt; done: boolean }
export interface Todo {
  id: string; text: Txt; assigneeId?: string; due?: number; done: boolean; source?: Txt
  /** the larger piece of work this belongs to; to-dos are grouped by it */
  mission?: Txt
  subtasks?: Subtask[]
  priority?: 'high' | 'medium' | 'low'
}
export interface TimelineItem { id: string; label: Txt; start: number; end: number; ownerId?: string; lane?: Txt; color?: string; milestone?: boolean; progress?: number; /** ids of the items that must end before this one starts */ dependsOn?: string[] }
export interface KanbanCard { id: string; title: Txt; assigneeId?: string; tag?: Txt; note?: Txt }
export interface KanbanColumn { id: string; title: Txt; cards: KanbanCard[] }

interface BlockBase {
  /** when its content last changed */
  updatedAt?: number
  id: string
  title: Txt
  /** columns taken in the 3-column board grid */
  span: 1 | 2 | 3
  /** set briefly by the store when just added, to play the arrival animation */
  fresh?: boolean
}
export type Block =
  | (BlockBase & { type: 'summary'; text: Txt; bullets: Txt[]; updatedAt: number })
  | (BlockBase & { type: 'timeline'; items: TimelineItem[] })
  | (BlockBase & { type: 'todo'; todos: Todo[] })
  | (BlockBase & { type: 'kanban'; columns: KanbanColumn[] })
  | (BlockBase & { type: 'files'; artifactIds: string[] })
  | (BlockBase & { type: 'people' })
  | (BlockBase & { type: 'calendar'; events: { id: string; title: Txt; start: number; durationMin: number; attendeeIds: string[] }[] })
  | (BlockBase & { type: 'chart'; unit?: string; series: { label: Txt; value: number; target?: number }[] })
  | (BlockBase & { type: 'model3d'; model: 'lamp' | 'desk' | 'badge'; caption?: Txt })
  | (BlockBase & { type: 'notes'; text: Txt })
  | (BlockBase & { type: 'poll'; question: Txt; options: { id: string; label: Txt; votes: string[] }[] })
  /** A small tool Gemini built for this exact project. `data` holds the facts it starts from, `state` what people did with it. */
  | (BlockBase & { type: 'app'; app: AppId; data?: Record<string, unknown>; state?: Record<string, unknown> })
export type BlockType = Block['type']
export type AppId = 'launch-sim' | 'colorway' | 'seats' | 'candidates' | 'deal' | 'odds' | 'pitch'

export interface TranscriptLine { at: number; who?: string; text: Txt }
export interface NotebookSource { id: string; title: Txt; type: 'pdf' | 'doc' | 'web' | 'slides' | 'audio' | 'text'; note?: Txt }
export interface Overview { id: string; type: 'audio' | 'video'; title: Txt; durationSec: number; poster?: string; transcript: TranscriptLine[] }

/**
 * A document living inside the project. Everything opens in the right-hand pane, never another app.
 * `space`: who can open it. None = the project team. A confidential space = its members only.
 * A partner space = the team and that partner.
 */
export type Artifact = ArtifactBody & { space?: string }
type ArtifactBody =
  | { id: string; kind: 'doc'; title: Txt; ownerId: string; updatedAt: number; sections: { heading?: Txt; body: Txt }[] }
  | { id: string; kind: 'sheet'; title: Txt; ownerId: string; updatedAt: number; columns: Txt[]; rows: (string | number)[][] }
  | { id: string; kind: 'slides'; title: Txt; ownerId: string; updatedAt: number; slides: { title: Txt; subtitle?: Txt; bullets?: Txt[]; accent?: string }[] }
  | { id: string; kind: 'pdf'; title: Txt; ownerId: string; updatedAt: number; pages: number; excerpt: Txt }
  | { id: string; kind: 'notebook'; title: Txt; ownerId: string; updatedAt: number; summary: Txt; sources: NotebookSource[]; notes: Txt[]; overviews: Overview[] }
  | { id: string; kind: 'image'; title: Txt; ownerId: string; updatedAt: number; src: string; width: number; height: number; sizeKb: number; format: string; caption?: Txt }
  /** A video file, or an Audio or Video Overview made by NotebookLM. Playback is simulated: a poster, a progress bar, a transcript. */
  | { id: string; kind: 'video'; title: Txt; ownerId: string; updatedAt: number; durationSec: number; sizeMb: number; poster?: string; overview?: 'audio' | 'video'; transcript?: TranscriptLine[] }
  /** Anything else that was shared: a CSV, a ZIP. `preview` shows the first rows of a table. */
  | { id: string; kind: 'file'; title: Txt; ownerId: string; updatedAt: number; ext: string; sizeKb: number; description?: Txt; preview?: string[][] }

export interface Project {
  id: string
  name: Txt
  icon: string // Material Symbol name
  color: string
  description: Txt
  ownerId: string
  memberIds: string[] // includes owner
  externalIds: string[] // people outside who only write by mail or join a call
  unread: number
  mentions: number
  messages: Message[]
  blocks: Block[]
  artifacts: Artifact[]
  /** Scripted things Gemini and people say during the demo. See src/chat/gemini.ts */
  script?: ProjectScript
  /** address that turns mail into project messages */
  address: string
  createdByUser?: boolean
  /** sub-teams with their own thread and files; the main thread is the whole team */
  spaces?: Space[]
}
export interface ProjectScript {
  callTitle: Txt
  /** lines shown as live captions during a call */
  captions: { who: string; text: Txt }[]
  callSummary: { summary: Txt; decisions: Txt[]; todos: { text: Txt; assigneeId?: string }[] }
  catchUp: { text: Txt; bullets: Txt[] }
  privateReplies: Record<string, Txt[]>
}

export interface CallState {
  projectId: string
  title: Txt
  startedAt: number
  participantIds: string[]
  guests: { name: string; email: string }[]
  mic: boolean
  cam: boolean
  captions: boolean
  sharing: boolean
}

/** What the right-hand pane shows: the shared board, an open document, or the live call. */
export type PaneView = { type: 'board' } | { type: 'artifact'; id: string } | { type: 'call' }
export type MobilePane = 'projects' | 'you' | 'chat' | 'pane'
