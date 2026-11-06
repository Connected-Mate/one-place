// The gallery of block templates. The owner adds directly; a member's pick becomes a proposal in the chat.
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { askGemini } from '../chat/gemini'
import type { Artifact, Block, BlockType, L, Project, Txt } from '../data/types'
import { useT } from '../i18n'
import { personById, uid, useStore } from '../store'
import { Avatar, Dialog, Icon, IconButton, Sparkle } from '../ui/kit'
import { DAY, KINDS, startOfDay } from './shared'

interface Template { id: string; name: L; hint: L; type: BlockType; mini: (faces: string[]) => ReactNode; make: (p: Project, artifact?: Artifact) => Block; artifact?: () => Omit<Artifact, 'ownerId'> }

const people = (p: Project) => p.memberIds.filter((id) => personById(id).role !== 'ai')
const pick = (p: Project, i: number) => { const l = people(p); return l.length ? l[i % l.length] : p.ownerId }

const Lines = ({ widths }: { widths: number[] }) => <>{widths.map((w, i) => <i key={i} className="m-line" style={{ width: `${w}%` }} />)}</>

const TEMPLATES: Template[] = [
  {
    id: 'timeline', type: 'timeline', name: { fr: 'Calendrier', en: 'Timeline' }, hint: { fr: 'Phases, jalons et ligne du jour', en: 'Phases, milestones and a today line' },
    mini: () => (
      <div className="m-gantt">
        <i style={{ left: '4%', width: '42%', background: 'var(--blue)' }} /><i style={{ left: '30%', width: '38%', background: 'var(--green)' }} /><i style={{ left: '56%', width: '34%', background: 'var(--yellow)' }} />
        <b /><u />
      </div>
    ),
    make: (p) => {
      const now = startOfDay(Date.now())
      return {
        id: uid('b'), type: 'timeline', span: 3, title: { fr: 'Calendrier', en: 'Timeline' },
        items: [
          { id: uid('i'), label: { fr: 'Cadrage', en: 'Scoping' }, start: now - 7 * DAY, end: now + 3 * DAY, ownerId: pick(p, 0), lane: { fr: 'Préparation', en: 'Prep' }, color: '#4285f4', progress: 70 },
          { id: uid('i'), label: { fr: 'Réalisation', en: 'Build' }, start: now + 3 * DAY, end: now + 20 * DAY, ownerId: pick(p, 1), lane: { fr: 'Production', en: 'Production' }, color: '#34a853', progress: 10 },
          { id: uid('i'), label: { fr: 'Lancement', en: 'Launch' }, start: now + 24 * DAY, end: now + 24 * DAY, lane: { fr: 'Production', en: 'Production' }, color: '#ea4335', milestone: true },
        ],
      }
    },
  },
  {
    id: 'todo', type: 'todo', name: { fr: 'À faire', en: 'To-do' }, hint: { fr: 'Tâches avec visages et échéances', en: 'Tasks with faces and due dates' },
    mini: (f) => (
      <div className="m-todo">
        {[62, 80, 48].map((w, i) => <span key={i} className={i === 0 ? 'done' : ''}><em /><i className="m-line" style={{ width: `${w}%` }} />{f[i % Math.max(f.length, 1)] && <Avatar id={f[i % f.length]} size={14} />}</span>)}
      </div>
    ),
    make: () => ({ id: uid('b'), type: 'todo', span: 1, title: { fr: 'À faire', en: 'To-do' }, todos: [] }),
  },
  {
    id: 'kanban', type: 'kanban', name: { fr: 'Kanban', en: 'Kanban' }, hint: { fr: 'Des colonnes, des cartes à déplacer', en: 'Columns and cards to move' },
    mini: () => <div className="m-kanban">{[3, 2, 1].map((n, c) => <span key={c}>{Array.from({ length: n }, (_, i) => <i key={i} />)}</span>)}</div>,
    make: (p) => ({
      id: uid('b'), type: 'kanban', span: 3, title: { fr: 'Suivi', en: 'Tracker' },
      columns: [
        { id: uid('c'), title: { fr: 'À faire', en: 'To do' }, cards: [{ id: uid('k'), title: { fr: 'Première carte', en: 'First card' }, assigneeId: pick(p, 0) }] },
        { id: uid('c'), title: { fr: 'En cours', en: 'In progress' }, cards: [] },
        { id: uid('c'), title: { fr: 'Fait', en: 'Done' }, cards: [] },
      ],
    }),
  },
  {
    id: 'doc', type: 'files', name: { fr: 'Document', en: 'Doc' }, hint: { fr: 'Une page à écrire à plusieurs', en: 'A page to write together' },
    mini: () => <div className="m-doc"><i className="m-line m-h" style={{ width: '55%' }} /><Lines widths={[100, 92, 96, 60]} /></div>,
    artifact: () => ({ id: uid('a'), kind: 'doc', title: { fr: 'Nouveau document', en: 'New document' }, updatedAt: Date.now(), sections: [{ heading: { fr: 'Pourquoi', en: 'Why' }, body: '' }, { heading: { fr: 'Prochaines étapes', en: 'Next steps' }, body: '' }] }),
    make: (_p, a) => ({ id: uid('b'), type: 'files', span: 1, title: { fr: 'Document', en: 'Doc' }, artifactIds: a ? [a.id] : [] }),
  },
  {
    id: 'files', type: 'files', name: { fr: 'Fichiers', en: 'Files' }, hint: { fr: 'Les fichiers du projet, ouverts ici', en: 'Project files, opened right here' },
    mini: () => <div className="m-files">{(['doc', 'sheet', 'slides'] as const).map((k, i) => <span key={k}><Icon name={KINDS[k].icon} fill size={14} style={{ color: KINDS[k].color }} /><i className="m-line" style={{ width: `${70 - i * 12}%` }} /></span>)}</div>,
    make: (p) => ({ id: uid('b'), type: 'files', span: 1, title: { fr: 'Fichiers', en: 'Files' }, artifactIds: p.artifacts.map((a) => a.id) }),
  },
  {
    id: 'calendar', type: 'calendar', name: { fr: 'Prochains rendez-vous', en: 'Next meetings' }, hint: { fr: 'Ce qui arrive, avec qui', en: 'What is coming, with whom' },
    mini: () => <div className="m-cal"><b>{new Date().getDate()}</b><Lines widths={[90, 62, 76]} /></div>,
    make: (p) => {
      const at = startOfDay(Date.now()) + 3 * DAY + 10 * 36e5
      return { id: uid('b'), type: 'calendar', span: 1, title: { fr: 'Prochains rendez-vous', en: 'Next meetings' }, events: [{ id: uid('e'), title: { fr: 'Point d’équipe', en: 'Team check-in' }, start: at, durationMin: 30, attendeeIds: people(p).slice(0, 4) }] }
    },
  },
  {
    id: 'chart', type: 'chart', name: { fr: 'Graphique', en: 'Chart' }, hint: { fr: 'Le réel face à l’objectif', en: 'Actuals against target' },
    mini: () => <div className="m-chart">{[78, 54, 92, 40].map((w, i) => <span key={i}><i style={{ width: `${w}%` }} /><u style={{ left: `${[70, 66, 84, 58][i]}%` }} /></span>)}</div>,
    make: () => ({ id: uid('b'), type: 'chart', span: 2, title: { fr: 'Avancement', en: 'Progress' }, unit: '%', series: [{ label: { fr: 'Phase 1', en: 'Phase 1' }, value: 80, target: 70 }, { label: { fr: 'Phase 2', en: 'Phase 2' }, value: 35, target: 50 }, { label: { fr: 'Phase 3', en: 'Phase 3' }, value: 10, target: 20 }] }),
  },
  {
    id: 'model3d', type: 'model3d', name: { fr: 'Objet 3D', en: '3D model' }, hint: { fr: 'À faire tourner, sans rien installer', en: 'Spin it, with nothing to install' },
    mini: () => <div className="m-3d"><i className="halo" /><i className="globe" /><i className="base" /></div>,
    make: () => ({ id: uid('b'), type: 'model3d', span: 1, title: { fr: 'Prototype', en: 'Prototype' }, model: 'lamp', caption: { fr: 'Lampe de chevet connectée', en: 'Smart bedside lamp' } }),
  },
  {
    id: 'notes', type: 'notes', name: { fr: 'Notes', en: 'Notes' }, hint: { fr: 'Du texte libre pour toute l’équipe', en: 'Free text for the whole team' },
    mini: () => <div className="m-notes"><Lines widths={[88, 96, 70, 44]} /><em /></div>,
    make: () => ({ id: uid('b'), type: 'notes', span: 1, title: { fr: 'Notes', en: 'Notes' }, text: '' }),
  },
  {
    id: 'poll', type: 'poll', name: { fr: 'Sondage', en: 'Poll' }, hint: { fr: 'Décider vite, sans réunion', en: 'Decide fast, without a meeting' },
    mini: () => <div className="m-poll">{[72, 44, 18].map((w, i) => <span key={i}><i style={{ width: `${w}%` }} /></span>)}</div>,
    make: () => ({
      id: uid('b'), type: 'poll', span: 1, title: { fr: 'Sondage', en: 'Poll' }, question: { fr: 'Quel créneau pour la revue ?', en: 'Which slot for the review?' },
      options: [{ id: uid('o'), label: { fr: 'Mardi matin', en: 'Tuesday morning' }, votes: [] }, { id: uid('o'), label: { fr: 'Jeudi après-midi', en: 'Thursday afternoon' }, votes: [] }],
    }),
  },
]

export function BlockGallery({ project }: { project: Project }) {
  const t = useT()
  const viewerId = useStore((s) => s.viewerId)
  const setBlockGallery = useStore((s) => s.setBlockGallery)
  const addBlock = useStore((s) => s.addBlock)
  const addArtifact = useStore((s) => s.addArtifact)
  const push = useStore((s) => s.push)
  const toast = useStore((s) => s.toast)
  const [ask, setAsk] = useState('')
  const used = useRef(false)
  const isOwner = project.ownerId === viewerId
  const owner = personById(project.ownerId).name.split(' ')[0]
  const close = useCallback(() => setBlockGallery(false), [setBlockGallery])

  const choose = (tpl: Template) => {
    if (used.current) return // double click safe
    used.current = true
    const draft = tpl.artifact?.()
    const artifact = draft ? ({ ...draft, ownerId: viewerId } as Artifact) : undefined
    if (artifact) addArtifact(project.id, artifact)
    const block = tpl.make(project, artifact)
    close()
    if (isOwner) { addBlock(project.id, block); return }
    const name: Txt = tpl.name
    push(project.id, {
      id: uid('m'), kind: 'proposal', authorId: viewerId, at: Date.now(), visibility: { type: 'all' }, status: 'pending',
      title: { fr: `Ajouter le bloc « ${name.fr} »`, en: `Add the "${name.en}" block` },
      description: { fr: `${tpl.hint.fr}. Il arrivera sur le tableau de tout le monde.`, en: `${tpl.hint.en}. It will land on everyone's board.` },
      action: { type: 'add-block', block },
    })
    toast({ text: { fr: `Proposition envoyée : ${owner} décide dans le chat`, en: `Proposal sent: ${owner} decides in the chat` }, icon: 'how_to_vote' })
  }
  const submitAsk = (e: React.FormEvent) => {
    e.preventDefault()
    const text = ask.trim()
    if (!text || used.current) return
    used.current = true
    close()
    askGemini(project.id, text)
    toast({ text: { fr: 'Gemini s’en occupe, suivez dans le chat', en: 'Gemini is on it, follow along in the chat' }, icon: 'auto_awesome' })
  }

  const faces = project.memberIds.filter((id) => personById(id).role !== 'ai').slice(0, 3)
  return (
    <Dialog width={760} onClose={close} title={isOwner ? t({ fr: 'Ajouter un bloc', en: 'Add a block' }) : t({ fr: 'Proposer un bloc', en: 'Propose a block' })}>
      {!isOwner && <p className="rp-gal-note">{t({ fr: `${owner} recevra votre proposition dans le chat et décidera.`, en: `${owner} gets your proposal in the chat and decides.` })}</p>}
      <form className="rp-gal-ask" onSubmit={submitAsk}>
        <Sparkle size={20} />
        <input
          data-autofocus
          value={ask}
          maxLength={240}
          onChange={(e) => setAsk(e.target.value)}
          aria-label={t({ fr: 'Demander à Gemini de créer un bloc', en: 'Ask Gemini to build a block' })}
          placeholder={t({ fr: 'Demander à Gemini : « un suivi du budget par phase »', en: 'Ask Gemini: "a budget tracker by phase"' })}
        />
        <IconButton type="submit" icon="arrow_upward" size={32} disabled={!ask.trim()} label={t({ fr: 'Envoyer à Gemini', en: 'Send to Gemini' })} />
      </form>
      <ul className="rp-gal-grid">
        {TEMPLATES.map((tpl) => (
          <li key={tpl.id}>
            <button type="button" className="rp-gal-item" data-template={tpl.id} onClick={() => choose(tpl)}>
              <span className="rp-mini" aria-hidden="true">{tpl.mini(faces)}</span>
              <span className="rp-gal-name">{t(tpl.name)}</span>
              <span className="rp-gal-hint">{t(tpl.hint)}</span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
