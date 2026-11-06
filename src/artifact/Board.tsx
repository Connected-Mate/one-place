import type { Block } from '../data/types'
import { useT } from '../i18n'
import { personById, useStore } from '../store'
import { AvatarStack, Button } from '../ui/kit'
import { ChartBlock } from './blocks/Chart'
import { KanbanBlock } from './blocks/Kanban'
import { Model3DBlock } from './blocks/Model3D'
import { CalendarBlock, FilesBlock, NotesBlock, PeopleBlock, PollBlock, SummaryBlock } from './blocks/simple'
import { TimelineBlock } from './blocks/Timeline'
import { TodoBlock } from './blocks/Todo'
import { BlockBoundary, Empty, useBoard } from './shared'

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'summary': return <SummaryBlock block={block} />
    case 'timeline': return <TimelineBlock block={block} />
    case 'todo': return <TodoBlock block={block} />
    case 'kanban': return <KanbanBlock block={block} />
    case 'files': return <FilesBlock block={block} />
    case 'people': return <PeopleBlock block={block} />
    case 'calendar': return <CalendarBlock block={block} />
    case 'chart': return <ChartBlock block={block} />
    case 'model3d': return <Model3DBlock block={block} />
    case 'notes': return <NotesBlock block={block} />
    case 'poll': return <PollBlock block={block} />
    default: return null
  }
}

export function Board() {
  const t = useT()
  const { project, role } = useBoard()
  const setBlockGallery = useStore((s) => s.setBlockGallery)
  const name = t(project.name)
  const owner = personById(project.ownerId).name.split(' ')[0]
  const people = project.memberIds.filter((id) => personById(id).role !== 'ai')
  const addLabel = role === 'owner' ? t({ fr: 'Ajouter un bloc', en: 'Add block' }) : t({ fr: 'Proposer un bloc', en: 'Propose a block' })
  const add = role !== 'guest' && <Button variant="tonal" size="s" icon="add" onClick={() => setBlockGallery(true)}>{addLabel}</Button>

  return (
    <div className="rp-board">
      <div className="rp-board-inner">
        <header className="rp-board-head">
          <h1 className="rp-board-title rp-trunc" title={name}>{name}</h1>
          <span className="rp-board-faces"><AvatarStack ids={people} size={28} max={5} /></span>
          {add}
        </header>
        {project.blocks.length === 0 ? (
          <Empty
            icon="dashboard_customize"
            title={t({ fr: 'Ce tableau est encore vide', en: 'This board is still empty' })}
            hint={role === 'owner'
              ? t({ fr: 'Ajoutez un premier bloc, ou demandez à Gemini de le faire.', en: 'Add a first block, or ask Gemini to do it.' })
              : t({ fr: `Tout le monde voit le même tableau. ${owner} décide de ce qui y arrive : proposez-lui un bloc.`, en: `Everyone sees the same board. ${owner} decides what lands on it: propose a block.` })}
          >
            {add}
          </Empty>
        ) : (
          <div className="rp-grid">
            {project.blocks.map((b) => (
              <BlockBoundary key={b.id} fallback={<p className="rp-block rp-meta span-1">{t({ fr: 'Ce bloc n’a pas pu s’afficher.', en: 'This block could not be displayed.' })}</p>}>
                <BlockView block={b} />
              </BlockBoundary>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
