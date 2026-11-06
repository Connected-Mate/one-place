/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Home's links into a project: the project, then the exact message or the exact to-do.
import { useStore } from '../store'

const st = () => useStore.getState()

export function openMessage(pid: string, messageId: string) {
  st().selectProject(pid)
  st().setMobilePane('chat')
  st().focusMessage(messageId)
}

/**
 * The board's section tabs keep their state inside RightPane, with no store API: selecting a section means
 * pressing its tab. No such tab (Overview-only board, older layout) leaves the board showing, which still has the block.
 */
function pressSection(blockId: string) {
  document.querySelector<HTMLElement>(`[data-tab="${CSS.escape(blockId)}"] [role="tab"]`)?.click()
}

function atBoard(pid: string, blockId: string) {
  st().selectProject(pid)
  st().setPane({ type: 'board' })
  requestAnimationFrame(() => pressSection(blockId))
}

export function openBlock(pid: string, blockId: string) {
  atBoard(pid, blockId)
  st().patchBlock(pid, blockId, { fresh: true })
}

/** Opens the to-do's tab, brings its row into view and flashes it. */
export function openTodo(pid: string, blockId: string, todoId: string) {
  atBoard(pid, blockId)
  const block = st().projects.find((p) => p.id === pid)?.blocks.find((b) => b.id === blockId)
  const todo = block?.type === 'todo' ? block.todos.find((x) => x.id === todoId) : undefined
  if (!todo) return
  const label = typeof todo.text === 'string' ? todo.text : todo.text[st().lang]
  let tries = 0
  const find = () => {
    const row = [...document.querySelectorAll<HTMLElement>('.right-pane .rp-todo')].find((li) => li.offsetParent && li.textContent?.includes(label))
    if (!row) { if (++tries < 12) requestAnimationFrame(find); return }
    row.scrollIntoView({ block: 'center', behavior: 'smooth' })
    row.classList.add('hm-flash')
    setTimeout(() => row.classList.remove('hm-flash'), 1600)
  }
  requestAnimationFrame(() => requestAnimationFrame(find))
}
