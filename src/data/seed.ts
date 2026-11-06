// PLACEHOLDER: replaced by the content agent. Keep these exports.
import type { Person, Project } from './types'
export const SEED_VERSION = 1
export const GEMINI_ID = 'gemini'
export const ME_ID = 'alex'
export const people: Person[] = [
  { id: 'gemini', name: 'Gemini', title: 'AI', email: '', hue: '#4285f4', role: 'ai', presence: 'online' },
  { id: 'alex', name: 'Alex Cormeraie', title: { fr: 'Chef de projet', en: 'Project lead' }, email: 'alex@oneplace.example', hue: '#0b57d0', role: 'owner', presence: 'online' },
]
export const seedProjects = (): Project[] => [{
  id: 'aurora', name: 'Aurora', icon: 'lightbulb', color: '#fbbc04', description: '', ownerId: 'alex', memberIds: ['alex'], externalIds: [], unread: 0, mentions: 0, messages: [], blocks: [], artifacts: [], address: 'aurora@oneplace.example',
}]
