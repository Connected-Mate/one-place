/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
import type { Block } from '../data/types'
import { useT } from '../i18n'
import { ChartBlock } from './blocks/Chart'
import { KanbanBlock } from './blocks/Kanban'
import { Model3DBlock } from './blocks/Model3D'
import { CalendarBlock } from './blocks/Calendar'
import { FilesBlock } from './blocks/Files'
import { NotesBlock, PeopleBlock, PollBlock, SummaryBlock } from './blocks/simple'
import { TimelineBlock } from './blocks/Timeline'
import { TodoBlock } from './blocks/Todo'
import { BlockBoundary } from './shared'

function BlockSwitch({ block }: { block: Block }) {
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

/** One block, full size, in its own tab. */
export function SectionView({ block }: { block: Block }) {
  const t = useT()
  const fallback = <p className="rp-meta">{t({ fr: 'Ce bloc n’a pas pu s’afficher.', en: 'This block could not be displayed.' })}</p>
  // These four are whole applications: they take all of the pane and manage their own scrolling.
  if (block.type === 'todo' || block.type === 'timeline' || block.type === 'calendar' || block.type === 'files') {
    return <div className="rp-fillview"><BlockBoundary key={block.id} fallback={fallback}><BlockSwitch block={{ ...block, span: 3 } as Block} /></BlockBoundary></div>
  }
  return (
    <div className="rp-board rp-section">
      <div className="rp-board-inner">
        <BlockBoundary key={block.id} fallback={fallback}>
          <BlockSwitch block={{ ...block, span: 3 } as Block} />
        </BlockBoundary>
      </div>
    </div>
  )
}
