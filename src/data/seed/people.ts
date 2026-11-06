/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
import type { Person } from '../types'

export const GEMINI_ID = 'gemini'
export const ME_ID = 'alex'

const av = (id: string) => `avatars/${id}.webp`

export const people: Person[] = [
  { id: 'gemini', name: 'Gemini', title: { fr: 'IA du projet', en: 'Project AI' }, email: '', hue: '#4285f4', role: 'ai', presence: 'online' },
  { id: 'alex', name: 'Alex Cormeraie', title: { fr: 'Product manager', en: 'Product manager' }, email: 'alex.connectedmate@gmail.com', avatar: av('alex'), hue: '#0b57d0', role: 'owner', presence: 'online', fullName: 'Alexandre Cormeraie', company: 'One Place (concept)', linkedin: 'https://www.linkedin.com/in/alex-cormeraie/' },
  { id: 'damien', name: 'Damien Wattez', title: { fr: 'Manager d’équipe agentique', en: 'Agentic team manager' }, email: 'damien@oneplace.example', avatar: av('damien'), hue: '#546e7a', role: 'member', presence: 'online', minimal: true },
  { id: 'maya', name: 'Maya Chen', title: { fr: 'Produit', en: 'Product' }, email: 'maya@oneplace.example', avatar: av('maya'), hue: '#8430ce', role: 'member', presence: 'online', company: 'Aurora Lamps', team: 'Product', location: 'Lyon', timeZone: 'Europe/Paris' },
  { id: 'tom', name: 'Tom Laurent', title: { fr: 'Design', en: 'Design' }, email: 'tom@oneplace.example', avatar: av('tom'), hue: '#e37400', role: 'member', presence: 'online', company: 'Aurora Lamps', team: 'Design studio', location: 'Nantes', timeZone: 'Europe/Paris' },
  { id: 'sofia', name: 'Sofia Reyes', title: { fr: 'Marketing', en: 'Marketing' }, email: 'sofia@oneplace.example', avatar: av('sofia'), hue: '#d01884', role: 'member', presence: 'away', company: 'Aurora Lamps', team: 'Brand and press', location: 'Madrid', timeZone: 'Europe/Madrid' },
  { id: 'karim', name: 'Karim Haddad', title: { fr: 'Opérations', en: 'Operations' }, email: 'karim@oneplace.example', avatar: av('karim'), hue: '#188038', role: 'member', presence: 'online', company: 'Aurora Lamps', team: 'Supply chain', location: 'Marseille', timeZone: 'Europe/Paris' },
  { id: 'lea', name: 'Léa Martin', title: { fr: 'Finance', en: 'Finance' }, email: 'lea@oneplace.example', avatar: av('lea'), hue: '#007b83', role: 'member', presence: 'online', company: 'Aurora Lamps', team: 'Finance', location: 'Paris', timeZone: 'Europe/Paris' },
  { id: 'jun', name: 'Jun Park', title: { fr: 'Lumen Works, production', en: 'Lumen Works, production' }, email: 'jun.park@lumenworks.example', avatar: av('jun'), hue: '#9c4b00', role: 'external', presence: 'offline', company: 'Lumen Works', team: 'Production', location: 'Busan', timeZone: 'Asia/Seoul' },
  { id: 'nora', name: 'Nora Weiss', title: { fr: 'Journaliste indépendante', en: 'Freelance journalist' }, email: 'nora@weiss-writes.example', avatar: av('nora'), hue: '#5b3f9e', role: 'guest', presence: 'away', company: 'Weiss Writes', location: 'Berlin', timeZone: 'Europe/Berlin' },
  { id: 'priya', name: 'Priya Nair', title: { fr: 'Achats, Northwind Hotels', en: 'Procurement, Northwind Hotels' }, email: 'priya.nair@northwind-hotels.example', avatar: av('priya'), hue: '#b3261e', role: 'external', presence: 'offline', company: 'Northwind Hotels', team: 'Procurement', location: 'Lyon', timeZone: 'Europe/Paris' },
  { id: 'ben', name: 'Ben Okafor', title: { fr: 'Candidat, Design lead', en: 'Candidate, Design lead' }, email: 'ben.okafor@mail.example', avatar: av('ben'), hue: '#3f51b5', role: 'external', presence: 'offline' },
]
