/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
import { useState } from 'react'
import type { Block, Todo } from '../../data/types'
import { fmtDate, useT } from '../../i18n'
import { personById, uid, useStore } from '../../store'
import { Avatar, Button, Icon } from '../../ui/kit'
import { Empty, Frame, startOfDay, useBoard } from '../shared'

export function TodoBlock({ block }: { block: Extract<Block, { type: 'todo' }> }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const { project, role, viewerId } = useBoard()
  const toggleTodo = useStore((s) => s.toggleTodo)
  const addTodo = useStore((s) => s.addTodo)
  const [hideDone, setHideDone] = useState(false)
  const [text, setText] = useState('')
  const today = startOfDay(Date.now())
  const done = block.todos.filter((x) => x.done).length
  const shown = hideDone ? block.todos.filter((x) => !x.done) : block.todos
  const readOnly = role === 'guest'

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    const todo: Todo = { id: uid('todo'), text: value, assigneeId: viewerId, done: false, source: { fr: 'Ajouté ici', en: 'Added here' } }
    addTodo(project.id, block.id, todo)
    setText('')
  }

  return (
    <Frame
      block={block}
      actions={done > 0 && (
        <Button size="s" className="rp-quiet" aria-pressed={hideDone} onClick={() => setHideDone((v) => !v)}>
          {hideDone ? t({ fr: `Afficher les faits (${done})`, en: `Show done (${done})` }) : t({ fr: 'Masquer les faits', en: 'Hide done' })}
        </Button>
      )}
    >
      {!readOnly && (
        <form className="rp-inline-add" onSubmit={submit}>
          <Icon name="add" size={20} />
          <input
            className="rp-inline-input"
            value={text}
            maxLength={200}
            onChange={(e) => setText(e.target.value)}
            placeholder={t({ fr: 'Ajouter une tâche', en: 'Add a to-do' })}
            aria-label={t({ fr: `Ajouter une tâche à ${t(block.title)}`, en: `Add a to-do to ${t(block.title)}` })}
          />
        </form>
      )}
      {shown.length === 0 ? (
        block.todos.length === 0
          ? <Empty icon="task_alt" title={t({ fr: 'Rien à faire pour l’instant', en: 'Nothing to do yet' })} hint={t({ fr: 'Gemini ajoute ici ce qui se décide dans le chat et en appel.', en: 'Gemini adds here what gets decided in the chat and on calls.' })} />
          : <Empty icon="celebration" title={t({ fr: 'Tout est fait', en: 'All done' })} />
      ) : (
        <ul className="rp-todos">
          {shown.map((todo) => {
            const label = t(todo.text)
            const overdue = !todo.done && todo.due != null && todo.due < today
            const assignee = todo.assigneeId ? personById(todo.assigneeId) : null
            return (
              <li key={todo.id} className={`rp-todo${todo.done ? ' done' : ''}`}>
                <label className="rp-todo-check">
                  <input type="checkbox" checked={todo.done} disabled={readOnly} onChange={() => toggleTodo(project.id, block.id, todo.id)} />
                  <span className="rp-check" aria-hidden="true"><Icon name="check" size={16} /></span>
                  <span className="rp-todo-text"><span className="rp-strike">{label}</span></span>
                </label>
                {assignee && <Avatar person={assignee} size={24} />}
                {(todo.due != null || todo.source) && (
                  <div className="rp-todo-meta">
                    {todo.due != null && (
                      <span className={overdue ? 'rp-overdue' : undefined}>
                        {overdue && <Icon name="schedule" size={14} />}
                        {overdue && <span className="sr-only">{t({ fr: 'En retard : ', en: 'Overdue: ' })}</span>}
                        {fmtDate(todo.due, lang)}
                      </span>
                    )}
                    {todo.source && <span className="rp-tag rp-trunc" title={t(todo.source)}><Icon name="link" size={14} /><span className="rp-trunc">{t(todo.source)}</span></span>}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Frame>
  )
}
