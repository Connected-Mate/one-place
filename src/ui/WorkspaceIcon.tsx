/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Google's real product icons, self-hosted, used to name the products this concept merges.
// They belong to Google. Every screen that shows them is reachable from "A concept. Not a Google product."
import { base } from './kit'

export type WorkspaceApp = 'gmail' | 'chat' | 'calendar' | 'meet' | 'docs' | 'sheets' | 'slides' | 'drive' | 'tasks' | 'keep' | 'notebooklm'
export const appOfKind = { doc: 'docs', sheet: 'sheets', slides: 'slides', notebook: 'notebooklm' } as const
/** The Google product a kind of file belongs to, when there is one. */
export const appOf = (kind: string): WorkspaceApp | null => (appOfKind as Record<string, WorkspaceApp>)[kind] ?? null
export const APP_NAME: Record<WorkspaceApp, string> = { notebooklm: 'NotebookLM', gmail: 'Gmail', chat: 'Chat', calendar: 'Calendar', meet: 'Meet', docs: 'Docs', sheets: 'Sheets', slides: 'Slides', drive: 'Drive', tasks: 'Tasks', keep: 'Keep' }

export function WorkspaceIcon({ app, size = 24 }: { app: WorkspaceApp; size?: number }) {
  return <img src={`${base}workspace/${app}.${app === 'tasks' ? 'png' : 'svg'}`} alt="" width={size} height={size} className={app === 'notebooklm' ? 'ws-mono' : undefined} style={{ flex: 'none', display: 'block' }} />
}
