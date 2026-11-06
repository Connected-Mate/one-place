/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// To-dos for a whole team: missions, people, due dates, sub-tasks. All changes go through patchBlock,
// so addTodo, toggleTodo, Gemini, call summaries and Home keep working on the same list.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Block, Subtask, Todo } from '../../data/types'
import { fmtDate, tx, useT } from '../../i18n'
import { personById, uid, useStore } from '../../store'
import { Avatar, Icon, Menu, type MenuItem } from '../../ui/kit'
import { DAY, Empty, Frame, startOfDay, useBoard } from '../shared'

type TodoBlockT = Extract<Block, { type: 'todo' }>
type GroupBy = 'mission' | 'person' | 'due'
type Filter = 'all' | 'mine' | 'overdue'
const GROUP_KEY = 'one-place-todo-group'
const loadGroup = (): GroupBy => {
  try { const v = localStorage.getItem(GROUP_KEY); return v === 'person' || v === 'due' ? v : 'mission' } catch { return 'mission' }
}
const NO_MISSION = ''
const NOBODY = 'nobody'

interface Group {
  key: string
  label: string
  person?: string
  todos: Todo[]
  /** what a to-do added here starts with */
  seed: Partial<Todo>
  tone?: 'late'
}
const missionKey = (x: Todo) => (x.mission == null ? NO_MISSION : tx(x.mission, 'en'))

function dueBucket(x: Todo, today: number) {
  if (x.due == null) return 'none'
  const d = startOfDay(x.due)
  if (d < today) return 'overdue'
  if (d === today) return 'today'
  if (d === today + DAY) return 'tomorrow'
  if (d <= today + 7 * DAY) return 'week'
  return 'later'
}
const DUE_GROUPS: { key: string; label: string; due?: (today: number) => number; tone?: 'late' }[] = [
  { key: 'overdue', label: 'Overdue', tone: 'late' },
  { key: 'today', label: 'Today', due: (d) => d + 18 * 36e5 },
  { key: 'tomorrow', label: 'Tomorrow', due: (d) => d + DAY + 18 * 36e5 },
  { key: 'week', label: 'Next 7 days', due: (d) => d + 7 * DAY + 18 * 36e5 },
  { key: 'later', label: 'Later', due: (d) => d + 21 * DAY + 18 * 36e5 },
  { key: 'none', label: 'No date' },
]

function GroupAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (text: string) => void }) {
  const [text, setText] = useState('')
  return (
    <form
      className="rp-td-add"
      onSubmit={(e) => {
        e.preventDefault()
        const v = text.trim()
        if (!v) return
        onAdd(v)
        setText('')
      }}
    >
      <Icon name="add" size={18} />
      <input value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </form>
  )
}

export function TodoBlock({ block }: { block: TodoBlockT }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const { project, role, viewerId } = useBoard()
  const patchBlock = useStore((s) => s.patchBlock)
  const [groupBy, setGroupBy] = useState<GroupBy>(loadGroup)
  const [filter, setFilter] = useState<Filter>('all')
  const [personFilter, setPersonFilter] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [openDone, setOpenDone] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [newMissions, setNewMissions] = useState<string[]>([])
  const [naming, setNaming] = useState(false)
  // A to-do just ticked stays in place a moment, so the strike is seen before it moves to Completed.
  const [justDone, setJustDone] = useState<string[]>([])
  const [live, setLive] = useState('')
  const [drag, setDrag] = useState<{ todo: Todo; x: number; y: number; w: number; before: string | null; group: string | null } | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const refocus = useRef<string | null>(null)
  const readOnly = role === 'guest'
  const today = startOfDay(Date.now())
  const todos = block.todos

  useEffect(() => { try { localStorage.setItem(GROUP_KEY, groupBy) } catch { /* private mode */ } }, [groupBy])
  useEffect(() => {
    if (!refocus.current) return
    list.current?.querySelector<HTMLElement>(`[data-todo="${CSS.escape(refocus.current)}"] .rp-td-handle`)?.focus()
    refocus.current = null
  })

  const write = (next: Todo[]) => patchBlock(project.id, block.id, { todos: next })
  const patchTodo = (id: string, patch: Partial<Todo>) => write(todos.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const isLate = (x: Todo) => !x.done && x.due != null && x.due < today

  const open = todos.filter((x) => !x.done)
  const overdue = open.filter(isLate)
  const mine = open.filter((x) => x.assigneeId === viewerId)

  const passes = (x: Todo) => {
    if (personFilter && (x.assigneeId ?? NOBODY) !== personFilter) return false
    if (filter === 'mine') return x.assigneeId === viewerId
    if (filter === 'overdue') return isLate(x)
    return true
  }
  const shown = todos.filter(passes)

  const people = useMemo(() => {
    const ids = [...new Set([...project.memberIds, ...todos.map((x) => x.assigneeId).filter((x): x is string => !!x)])]
    return ids.filter((id) => personById(id).role !== 'ai')
  }, [project.memberIds, todos])
  const load = people
    .map((id) => ({ id, open: open.filter((x) => x.assigneeId === id).length, late: overdue.filter((x) => x.assigneeId === id).length }))
    .filter((x) => x.open > 0)
    .sort((a, b) => b.open - a.open)
  const maxLoad = Math.max(1, ...load.map((x) => x.open))

  const groups: Group[] = useMemo(() => {
    if (groupBy === 'person') {
      const out: Group[] = people.map((id) => ({ key: id, label: personById(id).name, person: id, todos: shown.filter((x) => x.assigneeId === id), seed: { assigneeId: id } }))
      const rest = shown.filter((x) => !x.assigneeId || !people.includes(x.assigneeId))
      if (rest.length) out.push({ key: NOBODY, label: t({ fr: 'Sans responsable', en: 'Unassigned' }), todos: rest, seed: { assigneeId: undefined } })
      return out
        .filter((g) => g.todos.length > 0 || filter === 'all')
        .sort((a, b) => b.todos.filter((x) => !x.done).length - a.todos.filter((x) => !x.done).length)
    }
    if (groupBy === 'due') {
      return DUE_GROUPS.map((g) => ({
        key: g.key, label: t({ fr: g.label, en: g.label }), tone: g.tone,
        todos: shown.filter((x) => dueBucket(x, today) === g.key && !(g.key === 'overdue' && x.done)),
        seed: g.due ? { due: g.due(today) } : {},
      })).filter((g) => g.todos.length > 0)
    }
    const names = [...new Set(todos.map(missionKey))]
    const order = [...(names.includes(NO_MISSION) ? [NO_MISSION] : []), ...names.filter((n) => n !== NO_MISSION), ...newMissions.filter((n) => !names.includes(n))]
    return order.map((key) => {
      const sample = todos.find((x) => missionKey(x) === key)
      return {
        key,
        label: key === NO_MISSION ? (names.length === 1 ? t({ fr: 'Tâches', en: 'To-dos' }) : t({ fr: 'Sans mission', en: 'No mission' })) : sample?.mission ? t(sample.mission) : key,
        todos: shown.filter((x) => missionKey(x) === key),
        seed: key === NO_MISSION ? {} : { mission: sample?.mission ?? key },
      }
    }).filter((g) => g.todos.length > 0 || filter === 'all' && !personFilter)
  }, [groupBy, people, shown, todos, newMissions, filter, personFilter, today]) // eslint-disable-line react-hooks/exhaustive-deps

  const addIn = (g: Group, text: string) => {
    const todo: Todo = { id: uid('todo'), text, assigneeId: viewerId, done: false, source: { fr: 'Ajouté ici', en: 'Added here' }, ...g.seed }
    // right after the last one of its group, so it appears where it was typed
    const last = [...todos].reverse().find((x) => g.todos.some((y) => y.id === x.id))
    const at = last ? todos.findIndex((x) => x.id === last.id) + 1 : todos.length
    write([...todos.slice(0, at), todo, ...todos.slice(at)])
    setNewMissions((n) => n.filter((x) => x !== g.key))
    setLive(t({ fr: 'Tâche ajoutée', en: 'To-do added' }))
  }
  const toggle = (x: Todo) => {
    patchTodo(x.id, { done: !x.done })
    if (!x.done) {
      setJustDone((d) => [...d, x.id])
      setTimeout(() => setJustDone((d) => d.filter((id) => id !== x.id)), 700)
    }
  }
  const setSub = (x: Todo, subs: Subtask[]) => patchTodo(x.id, { subtasks: subs })
  const flip = <T,>(set: Set<T>, v: T) => { const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); return n }

  /** Dropping into another mission or person changes it too: moving is how you reassign in bulk. */
  const moveTo = (id: string, before: string | null, groupKey: string | null) => {
    const moving = todos.find((x) => x.id === id)
    if (!moving) return
    const rest = todos.filter((x) => x.id !== id)
    const g = groups.find((x) => x.key === groupKey)
    const patched: Todo = g && groupBy !== 'due' && !g.todos.some((x) => x.id === id) ? { ...moving, ...g.seed, mission: groupBy === 'mission' ? (g.key === NO_MISSION ? undefined : g.seed.mission) : moving.mission } : moving
    let at = before ? rest.findIndex((x) => x.id === before) : -1
    if (at < 0) {
      const last = g ? [...rest].reverse().find((x) => g.todos.some((y) => y.id === x.id)) : undefined
      at = last ? rest.findIndex((x) => x.id === last.id) + 1 : rest.length
    }
    write([...rest.slice(0, at), patched, ...rest.slice(at)])
  }
  const startDrag = (e: React.PointerEvent, todo: Todo) => {
    if (readOnly || e.pointerType !== 'mouse' || e.button !== 0) return
    e.preventDefault()
    const row = e.currentTarget.closest('.rp-todo')!.getBoundingClientRect()
    const ox = e.clientX, oy = e.clientY
    let moved = false
    let target: { before: string | null; group: string | null } = { before: null, group: null }
    const locate = (x: number, y: number) => {
      const sections = [...(list.current?.querySelectorAll<HTMLElement>('[data-group]') ?? [])]
      const sec = sections.find((el) => { const r = el.getBoundingClientRect(); return y >= r.top && y <= r.bottom })
      if (!sec) return { before: null, group: null }
      const rows = [...sec.querySelectorAll<HTMLElement>('[data-todo]')].filter((el) => el.dataset.todo !== todo.id)
      const hit = rows.find((el) => { const r = el.getBoundingClientRect(); return y < r.top + r.height / 2 })
      return { before: hit?.dataset.todo ?? null, group: sec.dataset.group ?? null, x }
    }
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - ox, ev.clientY - oy) < 4) return
      moved = true
      target = locate(ev.clientX, ev.clientY)
      setDrag({ todo, x: ev.clientX - (ox - row.left), y: ev.clientY - (oy - row.top), w: row.width, ...target })
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('keydown', key, true)
      setDrag(null)
    }
    const up = () => {
      if (moved && target.group != null) {
        moveTo(todo.id, target.before, target.group)
        setLive(t({ fr: 'Tâche déplacée', en: 'To-do moved' }))
      }
      stop()
    }
    const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { ev.stopPropagation(); stop() } }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('keydown', key, true)
  }
  const onHandleKey = (e: React.KeyboardEvent, x: Todo, g: Group) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const openRows = g.todos.filter((y) => !y.done)
    const i = openRows.findIndex((y) => y.id === x.id)
    const neighbor = openRows[i + (e.key === 'ArrowUp' ? -1 : 1)]
    if (!neighbor) return
    refocus.current = x.id
    if (e.key === 'ArrowUp') moveTo(x.id, neighbor.id, g.key)
    else moveTo(x.id, openRows[i + 2]?.id ?? null, g.key)
    setLive(t({ fr: 'Tâche déplacée', en: 'To-do moved' }))
  }

  const row = (x: Todo, g: Group): ReactNode => {
    const label = t(x.text)
    const subs = x.subtasks ?? []
    const subsDone = subs.filter((s) => s.done).length
    const isOpen = expanded.has(x.id)
    const late = isLate(x)
    const owner = x.assigneeId ? personById(x.assigneeId) : null
    const assign: MenuItem[] = [
      ...people.map((id) => ({ icon: <Avatar id={id} size={24} />, label: personById(id).name, selected: x.assigneeId === id, onSelect: () => patchTodo(x.id, { assigneeId: id }) })),
      { divider: true, label: '' },
      { icon: 'person_off', label: t({ fr: 'Personne', en: 'Nobody' }), selected: !x.assigneeId, onSelect: () => patchTodo(x.id, { assigneeId: undefined }) },
    ]
    const PRIORITIES = [
      { v: 'high' as const, name: t({ fr: 'Haute', en: 'High' }) },
      { v: 'medium' as const, name: t({ fr: 'Moyenne', en: 'Medium' }) },
      { v: 'low' as const, name: t({ fr: 'Basse', en: 'Low' }) },
    ]
    const priorityName = PRIORITIES.find((p) => p.v === x.priority)?.name
    const priority: MenuItem[] = [
      ...PRIORITIES.map((p) => ({ icon: <Icon name="flag" fill size={18} className={`rp-td-flag ${p.v}`} />, label: p.name, selected: x.priority === p.v, onSelect: () => patchTodo(x.id, { priority: p.v }) })),
      { divider: true, label: '' },
      { label: t({ fr: 'Aucune', en: 'None' }), selected: !x.priority, onSelect: () => patchTodo(x.id, { priority: undefined }) },
    ]
    return (
      <li key={x.id} className={`rp-todo${x.done ? ' done' : ''}${late ? ' late' : ''}${drag?.todo.id === x.id ? ' dragged' : ''}${drag?.before === x.id ? ' drop-before' : ''}`} data-todo={x.id}>
        <div className="rp-td-line">
          {!readOnly && !x.done && (
            <button type="button" className="rp-td-handle" aria-label={t({ fr: `Déplacer ${label}. Flèches haut et bas.`, en: `Move ${label}. Up and down arrow keys.` })} title={t({ fr: 'Glisser pour déplacer', en: 'Drag to move' })} onPointerDown={(e) => startDrag(e, x)} onKeyDown={(e) => onHandleKey(e, x, g)}>
              <Icon name="drag_indicator" size={16} />
            </button>
          )}
          <label className="rp-todo-check">
            <input type="checkbox" checked={x.done} disabled={readOnly} onChange={() => toggle(x)} />
            <span className="rp-check" aria-hidden="true"><Icon name="check" size={14} /></span>
            <span className="rp-todo-text"><span className="rp-strike">{label}</span></span>
          </label>
          <button
            type="button"
            className={`rp-td-subs${subs.length ? ' has' : ''}`}
            aria-expanded={isOpen}
            aria-label={subs.length ? t({ fr: `Sous-tâches, ${subsDone} sur ${subs.length}`, en: `Subtasks, ${subsDone} of ${subs.length} done` }) : t({ fr: 'Ajouter une sous-tâche', en: 'Add a subtask' })}
            title={subs.length ? undefined : t({ fr: 'Ajouter une sous-tâche', en: 'Add a subtask' })}
            onClick={() => setExpanded((s) => flip(s, x.id))}
          >
            {subs.length > 0 ? <>{subsDone}/{subs.length}</> : null}
            <Icon name={isOpen ? 'expand_less' : subs.length ? 'expand_more' : 'add'} size={16} />
          </button>
          <div className="rp-td-meta">
            {x.source && <span className="rp-td-source" title={t(x.source)}><Icon name="link" size={14} /><span className="rp-trunc">{t(x.source)}</span></span>}
            {readOnly ? (priorityName && <Icon name="flag" fill size={16} className={`rp-td-flag ${x.priority}`} />) : (
              <Menu align="right" items={priority} trigger={(p) => (
                <button type="button" {...p} className={`rp-td-pri${x.priority ? '' : ' none'}`} aria-label={priorityName ? t({ fr: `Priorité ${priorityName}`, en: `Priority ${priorityName}` }) : t({ fr: 'Définir une priorité', en: 'Set a priority' })} title={priorityName}>
                  <Icon name="flag" fill={!!x.priority} size={16} className={`rp-td-flag ${x.priority ?? ''}`} />
                </button>
              )} />
            )}
            <span className={`rp-td-due${late ? ' late' : ''}`}>
              {late && <span className="sr-only">{t({ fr: 'En retard : ', en: 'Overdue: ' })}</span>}
              {x.due != null ? fmtDate(x.due, lang) : ''}
            </span>
            {readOnly ? (owner ? <Avatar person={owner} size={24} /> : null) : (
              <Menu align="right" items={assign} header={t({ fr: 'Attribuer à', en: 'Assign to' })} trigger={(p) => (
                <button type="button" {...p} className="rp-td-face" aria-label={owner ? t({ fr: `Attribué à ${owner.name}. Changer.`, en: `Assigned to ${owner.name}. Change.` }) : t({ fr: 'Attribuer', en: 'Assign' })} title={owner?.name}>
                  {owner ? <Avatar person={owner} size={24} /> : <Icon name="person_add" size={18} />}
                </button>
              )} />
            )}
          </div>
        </div>
        {isOpen && (
          <div className="rp-td-sublist">
            {subs.length > 0 && (
              <ul>
                {subs.map((s) => (
                  <li key={s.id} className={s.done ? 'done' : ''}>
                    <label className="rp-todo-check">
                      <input type="checkbox" checked={s.done} disabled={readOnly} onChange={() => setSub(x, subs.map((y) => (y.id === s.id ? { ...y, done: !y.done } : y)))} />
                      <span className="rp-check" aria-hidden="true"><Icon name="check" size={12} /></span>
                      <span className="rp-todo-text"><span className="rp-strike">{t(s.text)}</span></span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {!readOnly && <GroupAdd placeholder={t({ fr: 'Ajouter une sous-tâche', en: 'Add a subtask' })} onAdd={(text) => setSub(x, [...subs, { id: uid('sub'), text, done: false }])} />}
          </div>
        )}
      </li>
    )
  }

  const FILTERS: { v: Filter; label: string; n: number }[] = [
    { v: 'all', label: t({ fr: 'Toutes', en: 'All' }), n: open.length },
    { v: 'mine', label: t({ fr: 'Les miennes', en: 'Mine' }), n: mine.length },
    { v: 'overdue', label: t({ fr: 'En retard', en: 'Overdue' }), n: overdue.length },
  ]
  const GROUPINGS: { v: GroupBy; label: string }[] = [
    { v: 'mission', label: t({ fr: 'Mission', en: 'Mission' }) },
    { v: 'person', label: t({ fr: 'Personne', en: 'Person' }) },
    { v: 'due', label: t({ fr: 'Échéance', en: 'Due date' }) },
  ]
  const clearFilters = () => { setFilter('all'); setPersonFilter(null) }

  return (
    <Frame block={block} className="rp-fill rp-td">
      <div className="rp-td-summary">
        <p className="rp-td-counts" aria-live="polite">
          <span><b>{open.length}</b> {t({ fr: 'ouvertes', en: 'open' })}</span>
          {overdue.length > 0 && <span className="rp-td-late-count"><b>{overdue.length}</b> {t({ fr: 'en retard', en: 'overdue' })}</span>}
          <span><b>{todos.length - open.length}</b> {t({ fr: 'faites', en: 'done' })}</span>
        </p>
        {load.length > 0 && (
          <div className="rp-td-load" role="group" aria-label={t({ fr: 'Charge par personne', en: 'Load per person' })}>
            {load.map((p) => {
              const name = personById(p.id).name
              return (
                <button key={p.id} type="button" className={`rp-td-person${personFilter === p.id ? ' on' : ''}`} aria-pressed={personFilter === p.id} title={t({ fr: `${name}, ${p.open} ouvertes`, en: `${name}, ${p.open} open` })} aria-label={t({ fr: `Voir les tâches de ${name}, ${p.open} ouvertes`, en: `Show ${name}'s to-dos, ${p.open} open` })} onClick={() => setPersonFilter((x) => (x === p.id ? null : p.id))}>
                  <Avatar id={p.id} size={24} />
                  <i className="rp-td-bar" aria-hidden="true"><i style={{ width: `${(p.open / maxLoad) * 100}%` }} className={p.late ? 'late' : ''} /></i>
                  <span className="rp-td-n">{p.open}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div className="rp-td-tools">
        <div className="rp-td-chips" role="group" aria-label={t({ fr: 'Filtrer', en: 'Filter' })}>
          {FILTERS.map((f) => (
            <button key={f.v} type="button" className={`chip click${filter === f.v ? ' selected' : ''}`} aria-pressed={filter === f.v} onClick={() => setFilter(f.v)}>
              {f.label}<span className="rp-td-chipn">{f.n}</span>
            </button>
          ))}
        </div>
        <div className="rp-seg" role="group" aria-label={t({ fr: 'Grouper par', en: 'Group by' })}>
          <span className="rp-seg-label" aria-hidden="true">{t({ fr: 'Grouper par', en: 'Group by' })}</span>
          {GROUPINGS.map((g) => <button key={g.v} type="button" className={groupBy === g.v ? 'on' : ''} aria-pressed={groupBy === g.v} onClick={() => setGroupBy(g.v)}>{g.label}</button>)}
        </div>
      </div>
      <div ref={list} className={`rp-td-list${drag ? ' dragging' : ''}`}>
        {todos.length === 0 && newMissions.length === 0 ? (
          <div className="rp-td-empty">
            <Empty icon="task_alt" title={t({ fr: 'Rien à faire pour l’instant', en: 'Nothing to do yet' })} hint={t({ fr: 'Gemini ajoute ici ce qui se décide dans le chat et en appel.', en: 'Gemini adds what gets decided in the chat and on calls.' })} />
            {!readOnly && <GroupAdd placeholder={t({ fr: 'Ajouter une tâche', en: 'Add a to-do' })} onAdd={(text) => addIn({ key: NO_MISSION, label: '', todos: [], seed: {} }, text)} />}
          </div>
        ) : groups.length === 0 ? (
          <div className="rp-td-empty">
            <Empty icon="celebration" title={filter === 'overdue' ? t({ fr: 'Rien en retard', en: 'Nothing is overdue' }) : t({ fr: 'Rien ici', en: 'Nothing here' })}>
              <button type="button" className="chip click" onClick={clearFilters}>{t({ fr: 'Tout voir', en: 'See all to-dos' })}</button>
            </Empty>
          </div>
        ) : groups.map((g) => {
          const isCollapsed = collapsed.has(g.key)
          const done = g.todos.filter((x) => x.done)
          const openHere = g.todos.filter((x) => !x.done || justDone.includes(x.id))
          const doneHere = done.filter((x) => !justDone.includes(x.id))
          const showDone = openDone.has(g.key)
          const pct = g.todos.length ? Math.round((done.length / g.todos.length) * 100) : 0
          const lateHere = g.todos.filter(isLate).length
          return (
            <section key={g.key} className={`rp-td-group${g.tone === 'late' ? ' late' : ''}${drag?.group === g.key ? ' over' : ''}`} data-group={g.key}>
              <button type="button" className="rp-td-ghead" aria-expanded={!isCollapsed} onClick={() => setCollapsed((s) => flip(s, g.key))}>
                <Icon name={isCollapsed ? 'chevron_right' : 'expand_more'} size={20} />
                {g.person && <Avatar id={g.person} size={24} status />}
                <span className="rp-td-gname rp-trunc" title={g.label}>{g.label}</span>
                {lateHere > 0 && g.tone !== 'late' && <span className="rp-td-glate">{t({ fr: `${lateHere} en retard`, en: `${lateHere} overdue` })}</span>}
                <span className="rp-td-gcount">{g.person ? t({ fr: `${g.todos.length - done.length} ouvertes`, en: `${g.todos.length - done.length} open` }) : `${done.length}/${g.todos.length}`}</span>
                <i className="rp-td-gbar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></i>
              </button>
              {!isCollapsed && (
                <>
                  <ul className="rp-todos">
                    {openHere.map((x) => row(x, g))}
                    {drag?.group === g.key && drag.before == null && <li className="rp-td-dropline" aria-hidden="true" />}
                  </ul>
                  {!readOnly && <GroupAdd placeholder={t({ fr: 'Ajouter une tâche', en: 'Add a to-do' })} onAdd={(text) => addIn(g, text)} />}
                  {doneHere.length > 0 && (
                    <>
                      <button type="button" className="rp-td-donebtn" aria-expanded={showDone} onClick={() => setOpenDone((s) => flip(s, g.key))}>
                        <Icon name={showDone ? 'expand_less' : 'expand_more'} size={16} />
                        {t({ fr: `Terminées (${doneHere.length})`, en: `Completed (${doneHere.length})` })}
                      </button>
                      {showDone && <ul className="rp-todos">{doneHere.map((x) => row(x, g))}</ul>}
                    </>
                  )}
                </>
              )}
            </section>
          )
        })}
        {groupBy === 'mission' && !readOnly && todos.length + newMissions.length > 0 && (naming ? (
          <div className="rp-td-newmission">
            <GroupAdd placeholder={t({ fr: 'Nom de la mission', en: 'Mission name' })} onAdd={(name) => { setNewMissions((n) => [...n, name]); setNaming(false) }} />
          </div>
        ) : (
          <button type="button" className="rp-td-newbtn" onClick={() => setNaming(true)}><Icon name="add" size={18} />{t({ fr: 'Nouvelle mission', en: 'New mission' })}</button>
        ))}
      </div>
      <span className="sr-only" aria-live="polite">{live}</span>
      {drag && createPortal(
        <div className="rp-td-ghost" aria-hidden="true" style={{ left: drag.x, top: drag.y, width: drag.w }}>{t(drag.todo.text)}</div>, document.body)}
    </Frame>
  )
}
