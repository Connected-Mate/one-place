/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Candidate compare: the people on the board, scored on the same five lines, by each interviewer.
import { useMemo } from 'react'
import { personById } from '../../store'
import { Avatar, Icon, Sparkle } from '../../ui/kit'
import { Empty, Frame, useBoard } from '../shared'
import { biasNotes, candidateDefaults, candidatesOf, CRITERIA, INTERVIEWERS, nextQuestion, scorers, scoreTotal, type Candidate, type CriterionId, type Scores } from './logic'
import { Radar, SERIES } from './RadarMini'
import { Seg, Slider, useAppState, type AppProps } from './ui'

function Face({ c, size = 32 }: { c: Candidate; size?: number }) {
  const hue = ['#5b3f9e', '#00695c', '#9c4b00', '#3f51b5', '#ad1457', '#37474f', '#2e7d32'][[...c.id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 7]
  return <Avatar person={c.personId ? personById(c.personId) : { id: c.id, name: c.name, title: '', email: '', hue, role: 'external', presence: 'offline' }} size={size} />
}

export default function Candidates({ block }: AppProps) {
  const { project } = useBoard()
  const [state, update, flush] = useAppState(block, candidateDefaults)
  const scores = state.scores as Scores
  const everyone = candidatesOf(project)
  const known = new Set(everyone.map((c) => c.id))
  const selectedIds = (state.selected as string[]).filter((id) => known.has(id))
  const selected = selectedIds.length ? selectedIds : everyone.slice(0, 2).map((c) => c.id)
  const people = selected.map((id) => everyone.find((c) => c.id === id)!).filter(Boolean)
  const interviewer = String(state.interviewer)
  const notes = useMemo(() => biasNotes(scores, people), [scores, people.map((p) => p.id).join()]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!everyone.length) return <Frame block={block}><Empty icon="person_search" title="No candidates to compare yet" hint="Add them to a kanban on this project and they show up here." /></Frame>

  const setScore = (c: string, crit: CriterionId, v: number) => update((s) => {
    const all = s.scores as Scores
    return { scores: { ...all, [c]: { ...all[c], [interviewer]: { ...all[c]?.[interviewer], [crit]: v } } } }
  })
  const toggle = (id: string) => update((s) => {
    const cur = (s.selected as string[]).filter((x) => known.has(x))
    if (cur.includes(id)) return cur.length > 1 ? { selected: cur.filter((x) => x !== id) } : {}
    return { selected: [...cur, id].slice(-3) }
  })
  const top = Math.max(...people.map((p) => scoreTotal(scores, p.id)))
  return (
    <Frame block={block}>
      <div className="ap ap-cand">
        <div className="ap-cand-pick" role="group" aria-label="Compare up to three candidates">
          {everyone.map((c) => {
            const k = selected.indexOf(c.id)
            return (
              <button key={c.id} type="button" className={`ap-cand-chip${k >= 0 ? ' on' : ''}`} aria-pressed={k >= 0} data-cand={c.id} onClick={() => toggle(c.id)} style={k >= 0 ? { borderColor: SERIES[k] } : undefined}>
                <Face c={c} size={24} /><span className="ap-trunc">{c.name}</span><small>{c.stage}</small>
              </button>
            )
          })}
        </div>
        <div className="ap-cand-top">
          <div className="ap-cand-radar">
            <Radar scores={scores} ids={selected} />
          </div>
          <ul className="ap-cand-cards">
            {people.map((c, k) => {
              const total = scoreTotal(scores, c.id), who = scorers(scores, c.id)
              return (
                <li key={c.id} style={{ '--c': SERIES[k] } as React.CSSProperties}>
                  <div className="ap-cand-who"><Face c={c} size={36} /><div className="ap-minw"><b className="ap-trunc">{c.name}</b><small className="ap-trunc">{c.tag || c.stage}</small></div></div>
                  <div className="ap-cand-total"><b data-total={c.id}>{total ? total.toFixed(1) : '0'}</b><span>of 20</span>{total > 0 && total === top && people.length > 1 && <em>ahead</em>}</div>
                  <span className="ap-cand-bar" aria-hidden="true"><i style={{ width: `${(total / 20) * 100}%` }} /></span>
                  <small className="ap-cand-note">{c.note || 'No note on the board yet.'}</small>
                  <small className="ap-cand-by">{who.length ? `Scored by ${who.map((id) => personById(id).name.split(' ')[0]).join(', ')}` : 'Nobody has scored yet'}</small>
                </li>
              )
            })}
          </ul>
        </div>
        <section className="ap-score" aria-label="Scores">
          <header className="ap-score-head">
            <h4 className="ap-h">Score out of 4 as</h4>
            <Seg size="s" label="Interviewer" value={interviewer} onChange={(v) => { flush(); update({ interviewer: v }) }} options={INTERVIEWERS.map((id) => ({ id, label: <><Avatar id={id} size={18} />{personById(id).name.split(' ')[0]}</>, aria: personById(id).name }))} />
          </header>
          <div className="ap-score-grid" style={{ '--n': people.length } as React.CSSProperties}>
            <div className="ap-score-corner" />
            {people.map((c, k) => <div key={c.id} className="ap-score-col" style={{ color: SERIES[k] }}><span className="ap-trunc">{c.name.split(' ')[0]}</span></div>)}
            {CRITERIA.map((x) => (
              <div key={x.id} className="ap-score-row">
                <div className="ap-score-crit">{x.label}</div>
                {people.map((c) => {
                  const v = scores[c.id]?.[interviewer]?.[x.id] ?? 0
                  return (
                    <div key={c.id} className="ap-score-cell" data-score={`${c.id}:${x.id}`}>
                      <small className="ap-score-who ap-trunc">{c.name.split(' ')[0]}</small>
                      <Slider hideLabel label={`${personById(interviewer).name.split(' ')[0]}’s score for ${c.name}, ${x.label}`} text={v ? `${v} of 4` : 'Not scored'} min={0} max={4} value={v} onChange={(n) => setScore(c.id, x.id, n)} onCommit={flush} />
                      <b>{v}</b>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </section>
        <div className="ap-cand-ask">
          <section aria-label="What to ask next">
            <h4 className="ap-h"><Sparkle size={16} />What to ask next</h4>
            <ul className="ap-asks">
              {people.map((c) => {
                const q = nextQuestion(scores, c)
                return <li key={c.id}><Face c={c} size={24} /><div><p>{q.question}</p><small>{q.criterion}. {q.why}</small></div></li>
              })}
            </ul>
          </section>
          <section aria-label="Bias check" className="ap-bias">
            <h4 className="ap-h"><Icon name="balance" size={16} />Bias check</h4>
            <ul>{notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </section>
        </div>
      </div>
    </Frame>
  )
}
