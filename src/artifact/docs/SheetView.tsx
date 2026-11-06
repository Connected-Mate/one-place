import { useEffect, useMemo, useRef, useState } from 'react'
import type { Artifact } from '../../data/types'
import { useT } from '../../i18n'
import { useStore } from '../../store'
import { Button } from '../../ui/kit'
import { useBoard } from '../shared'
import { colName, computeCell, parseInput, type Cell } from './formula'
import { ArtifactHeader, takeFocus } from './Header'

type Sheet = Extract<Artifact, { kind: 'sheet' }>
/** r = 0 is the row of column names, r >= 1 the data. */
interface Pos { r: number; c: number }

export function SheetView({ sheet }: { sheet: Sheet }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const { project, role } = useBoard()
  const patchArtifact = useStore((s) => s.patchArtifact)
  const readOnly = role === 'guest'
  const [sel, setSel] = useState<Pos>({ r: 1, c: 0 })
  const [edit, setEdit] = useState<{ value: string; from: 'cell' | 'bar' } | null>(null)
  const grid = useRef<HTMLTableElement>(null)
  const skipBlur = useRef(false)
  const nf = useMemo(() => new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 2 }), [lang])

  const nCols = Math.max(sheet.columns.length, ...sheet.rows.map((r) => r.length), 1)
  const nRows = sheet.rows.length
  const header = (c: number) => t(sheet.columns[c])

  const computed = useMemo(() => {
    const memo = new Map<string, Cell>()
    const visiting = new Set<string>()
    const get = (r: number, c: number): Cell => {
      if (r === 0) return header(c)
      const key = `${r}:${c}`
      if (memo.has(key)) return memo.get(key)!
      if (visiting.has(key)) throw new RangeError('cycle')
      visiting.add(key)
      try {
        const v = computeCell(sheet.rows[r - 1]?.[c], get)
        memo.set(key, v)
        return v
      } finally { visiting.delete(key) }
    }
    return get
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.rows, sheet.columns, lang])

  // Derived, never stored: a column is totalled when at least half of its cells are numbers.
  const totals = useMemo(() => {
    const out: (number | null)[] = []
    for (let c = 0; c < nCols; c++) {
      if (c === 0) { out.push(null); continue }
      const nums: number[] = []
      for (let r = 1; r <= nRows; r++) { const v = computed(r, c); if (typeof v === 'number') nums.push(v) }
      out.push(nums.length > 0 && nums.length * 2 >= nRows ? nums.reduce((a, b) => a + b, 0) : null)
    }
    return out
  }, [computed, nCols, nRows])

  const rawOf = (p: Pos): string => {
    if (p.r === 0) return header(p.c)
    const v = sheet.rows[p.r - 1]?.[p.c]
    return v == null ? '' : String(v)
  }
  const save = (p: Pos, value: string) => {
    if (readOnly || value === rawOf(p)) return
    if (p.r === 0) {
      const columns = Array.from({ length: nCols }, (_, c) => sheet.columns[c] ?? '')
      columns[p.c] = value
      patchArtifact(project.id, sheet.id, { columns, updatedAt: Date.now() })
      return
    }
    const rows = sheet.rows.map((row, r) => {
      if (r !== p.r - 1) return row
      const next: Cell[] = Array.from({ length: nCols }, (_, c) => row[c] ?? '')
      next[p.c] = parseInput(value)
      return next
    })
    patchArtifact(project.id, sheet.id, { rows, updatedAt: Date.now() })
  }
  const go = (r: number, c: number) => setSel({ r: Math.max(0, Math.min(nRows, r)), c: Math.max(0, Math.min(nCols - 1, c)) })
  const commit = (move?: [number, number]) => {
    if (!edit) return
    save(sel, edit.value)
    setEdit(null)
    if (move) { go(sel.r + move[0], sel.c + move[1]); skipBlur.current = true; grid.current?.focus({ preventScroll: true }); skipBlur.current = false }
  }
  const cancel = () => { skipBlur.current = true; setEdit(null); grid.current?.focus({ preventScroll: true }); skipBlur.current = false }

  useEffect(() => { takeFocus(grid.current) }, [])
  useEffect(() => {
    grid.current?.querySelector(`[data-pos="${sel.r}-${sel.c}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [sel])

  const onGridKey = (e: React.KeyboardEvent) => {
    if (edit) return
    const k = e.key
    if (k === 'ArrowUp') { e.preventDefault(); go(sel.r - 1, sel.c) }
    else if (k === 'ArrowDown') { e.preventDefault(); go(sel.r + 1, sel.c) }
    else if (k === 'ArrowLeft') { e.preventDefault(); go(sel.r, sel.c - 1) }
    else if (k === 'ArrowRight') { e.preventDefault(); go(sel.r, sel.c + 1) }
    else if (k === 'Home') { e.preventDefault(); go(sel.r, 0) }
    else if (k === 'End') { e.preventDefault(); go(sel.r, nCols - 1) }
    else if (k === 'Tab') {
      // leave the grid at its edges, so that the keyboard is never trapped
      const next = sel.c + (e.shiftKey ? -1 : 1)
      if (next >= 0 && next < nCols) { e.preventDefault(); go(sel.r, next) }
    } else if (readOnly) return
    else if (k === 'Enter' || k === 'F2') { e.preventDefault(); setEdit({ value: rawOf(sel), from: 'cell' }) }
    else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); save(sel, '') }
    else if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); setEdit({ value: k, from: 'cell' }) }
  }

  const display = (r: number, c: number): { text: string; numeric: boolean; error: boolean } => {
    let v: Cell
    try { v = computed(r, c) } catch { v = '#REF' }
    if (typeof v === 'number') return { text: nf.format(v), numeric: true, error: false }
    return { text: v, numeric: false, error: v.startsWith('#') && v.length <= 7 }
  }
  const addRow = () => {
    const rows = [...sheet.rows, Array.from({ length: nCols }, () => '' as Cell)]
    patchArtifact(project.id, sheet.id, { rows, updatedAt: Date.now() })
    setSel({ r: rows.length, c: 0 })
    grid.current?.focus({ preventScroll: true })
  }

  const ref = `${colName(sel.c)}${sel.r + 1}`
  return (
    <div className="rp-doc">
      <ArtifactHeader artifact={sheet} />
      <div className="rp-formula">
        <span className="rp-formula-ref" aria-label={t({ fr: 'Cellule sélectionnée', en: 'Selected cell' })}>{ref}</span>
        <span className="rp-formula-fx" aria-hidden="true">fx</span>
        <input
          className="rp-formula-input"
          aria-label={t({ fr: `Contenu de la cellule ${ref}`, en: `Content of cell ${ref}` })}
          readOnly={readOnly}
          value={edit ? edit.value : rawOf(sel)}
          onChange={(e) => setEdit({ value: e.target.value, from: 'bar' })}
          onBlur={() => { if (!skipBlur.current && edit?.from === 'bar') commit() }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); if (edit) commit([1, 0]); else grid.current?.focus({ preventScroll: true }) }
            if (e.key === 'Escape') { e.preventDefault(); cancel() }
          }}
        />
      </div>
      <div className="rp-sheet-scroll">
        <table
          ref={grid}
          className="rp-sheet"
          role="grid"
          tabIndex={0}
          aria-label={t(sheet.title)}
          aria-rowcount={nRows + 3}
          aria-colcount={nCols + 1}
          aria-activedescendant={`cell-${sheet.id}-${sel.r}-${sel.c}`}
          onKeyDown={onGridKey}
        >
          <thead>
            <tr>
              <th className="rp-sh-corner" aria-hidden="true" />
              {Array.from({ length: nCols }, (_, c) => <th key={c} scope="col" className={`rp-sh-col${sel.c === c ? ' on' : ''}${c === 0 ? ' wide' : ''}`}>{colName(c)}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: nRows + 1 }, (_, r) => (
              <tr key={r} className={r === 0 ? 'rp-sh-names' : undefined}>
                <th scope="row" className={`rp-sh-row${sel.r === r ? ' on' : ''}`}>{r + 1}</th>
                {Array.from({ length: nCols }, (_, c) => {
                  const on = sel.r === r && sel.c === c
                  const d = r === 0 ? { text: header(c), numeric: false, error: false } : display(r, c)
                  return (
                    <td
                      key={c}
                      id={`cell-${sheet.id}-${r}-${c}`}
                      data-pos={`${r}-${c}`}
                      role="gridcell"
                      aria-selected={on}
                      className={`${on ? 'sel ' : ''}${d.numeric ? 'num ' : ''}${d.error ? 'err' : ''}`}
                      onMouseDown={() => { if (!on) { if (edit) commit(); setSel({ r, c }) } }}
                      onDoubleClick={() => { if (!readOnly) setEdit({ value: rawOf({ r, c }), from: 'cell' }) }}
                    >
                      {on && edit?.from === 'cell' ? (
                        <input
                          autoFocus
                          className="rp-sh-input"
                          value={edit.value}
                          aria-label={t({ fr: `Modifier ${ref}`, en: `Edit ${ref}` })}
                          onChange={(e) => setEdit({ value: e.target.value, from: 'cell' })}
                          onBlur={() => { if (!skipBlur.current) commit() }}
                          onKeyDown={(e) => {
                            e.stopPropagation()
                            if (e.key === 'Enter') { e.preventDefault(); commit([1, 0]) }
                            if (e.key === 'Tab') { e.preventDefault(); commit([0, e.shiftKey ? -1 : 1]) }
                            if (e.key === 'Escape') { e.preventDefault(); cancel() }
                          }}
                        />
                      ) : <span className="rp-sh-text" title={d.text.length > 18 ? d.text : undefined}>{d.text}</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="rp-sh-row" aria-hidden="true">{'Σ'}</th>
              {Array.from({ length: nCols }, (_, c) => (
                <td key={c} className={totals[c] != null ? 'num' : undefined} aria-readonly="true">
                  {c === 0 ? t({ fr: 'Total', en: 'Total' }) : totals[c] != null ? nf.format(totals[c]!) : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
        {!readOnly && <Button size="s" icon="add" className="rp-sh-add" onClick={addRow}>{t({ fr: 'Ajouter une ligne', en: 'Add a row' })}</Button>}
      </div>
    </div>
  )
}
