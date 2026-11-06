// Renders message text: mention chips, **bold**, "- " bullets, and internal links [label](op:...).
// Never touches innerHTML: everything typed stays plain text.
import { Fragment, type ReactNode } from 'react'
import { GEMINI_ID, useStore } from '../store'
import { Sparkle } from '../ui/kit'
import { goBoard } from './chatState'

const INLINE = /@\[([^\]]+)\]\(([^)]+)\)|\[([^\]]+)\]\(op:([^)]+)\)|\*\*([^*]+)\*\*/g

function runOp(pid: string, op: string) {
  const [kind, id] = op.split('/')
  const s = useStore.getState()
  if (kind === 'board') goBoard(pid, id)
  if (kind === 'artifact' && id) s.setPane({ type: 'artifact', id })
  if (kind === 'msg' && id) s.focusMessage(id)
}

function inline(text: string, pid: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let k = 0
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1]) {
      out.push(m[2] === GEMINI_ID
        ? <span key={k++} className="mention gemini"><Sparkle size={12} />{m[1]}</span>
        : <span key={k++} className="mention">@{m[1]}</span>)
    } else if (m[3]) {
      const op = m[4]
      out.push(<button key={k++} type="button" className="op-link" onClick={() => runOp(pid, op)}>{m[3]}</button>)
    } else {
      out.push(<strong key={k++}>{m[5]}</strong>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function RichText({ text, pid }: { text: string; pid: string }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let bullets: string[] = []
  const flush = (key: number) => {
    if (!bullets.length) return
    blocks.push(<ul key={`u${key}`} className="rich-list">{bullets.map((b, i) => <li key={i}>{inline(b, pid)}</li>)}</ul>)
    bullets = []
  }
  lines.forEach((line, i) => {
    if (/^\s*[-•]\s+/.test(line)) { bullets.push(line.replace(/^\s*[-•]\s+/, '')); return }
    flush(i)
    blocks.push(<Fragment key={i}>{inline(line, pid)}{i < lines.length - 1 && !/^\s*[-•]\s+/.test(lines[i + 1]) ? <br /> : null}</Fragment>)
  })
  flush(lines.length)
  return <>{blocks}</>
}
