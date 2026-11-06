/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Artifact } from '../../data/types'
import { useT } from '../../i18n'
import { useStore } from '../../store'
import { Button, Icon } from '../../ui/kit'
import { revealIn, useBoard } from '../shared'
import { colName, computeCell, parseInput, type Cell } from './formula'
import { ArtifactHeader, takeFocus, TB, TBSep } from './Header'

type Sheet = Extract<Artifact, { kind: 'sheet' }>
/** r = 0 is the row of column names, r >= 1 the data. */
interface Pos { r: number; c: number }
interface ColFormat { style?: 'currency' | 'percent'; decimals?: number }
const safe = (get: (r: number, c: number) => Cell, r: number, c: number): Cell => { try { return get(r, c) } catch { return '#REF' } }

/** A typed "Total" line would be counted twice: the grid derives its own, always right. */
const isTotalRow = (row: Cell[]) => typeof row[0] === 'string' && /^\s*(total|sum|somme)\b/i.test(row[0])

export function SheetView({ sheet: source }: { sheet: Sheet }) {
  const sheet = useMemo(() => ({ ...source, rows: source.rows.filter((r) => !isTotalRow(r)) }), [source])
  const t = useT()
  const lang = useStore((s) => s.lang)
  const { project, role } = useBoard()
  const patchArtifact = useStore((s) => s.patchArtifact)
  const readOnly = role === 'guest'
  const [sel, setSel] = useState<Pos>({ r: 1, c: 0 })
  const [edit, setEdit] = useState<{ value: string; from: 'cell' | 'bar' } | null>(null)
  const grid = useRef<HTMLTableElement>(null)
  const skipBlur = useRef(false)
  // Undo and redo are whole snapshots: small data, simple and right.
  const past = useRef<Pick<Sheet, 'rows' | 'columns'>[]>([])
  const future = useRef<Pick<Sheet, 'rows' | 'columns'>[]>([])
  const [, bump] = useState(0)
  const [formats, setFormats] = useState<Record<number, ColFormat>>({})
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const fmtNum = (v: number, c: number) => {
    const f = formats[c]
    const options: Intl.NumberFormatOptions = { maximumFractionDigits: f?.decimals ?? 2, minimumFractionDigits: f?.decimals ?? 0 }
    if (f?.style === 'currency') return new Intl.NumberFormat(locale, { ...options, style: 'currency', currency: 'EUR' }).format(v)
    if (f?.style === 'percent') return new Intl.NumberFormat(locale, { ...options, style: 'percent' }).format(v)
    return new Intl.NumberFormat(locale, options).format(v)
  }
  const write = (patch: Partial<Pick<Sheet, 'rows' | 'columns'>>) => {
    past.current = [...past.current.slice(-49), { rows: sheet.rows, columns: sheet.columns }]
    future.current = []
    patchArtifact(project.id, sheet.id, { ...patch, updatedAt: Date.now() })
    bump((n) => n + 1)
  }
  const travel = (from: typeof past, to: typeof past) => {
    const snap = from.current[from.current.length - 1]
    if (!snap) return
    from.current = from.current.slice(0, -1)
    to.current = [...to.current, { rows: sheet.rows, columns: sheet.columns }]
    patchArtifact(project.id, sheet.id, { ...snap, updatedAt: Date.now() })
    bump((n) => n + 1)
    grid.current?.focus({ preventScroll: true })
  }
  const undo = () => travel(past, future)
  const redo = () => travel(future, past)
  const setFormat = (c: number, change: (f: ColFormat) => ColFormat) => setFormats((m) => ({ ...m, [c]: change(m[c] ?? {}) }))

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
      for (let r = 1; r <= nRows; r++) { const v = safe(computed, r, c); if (typeof v === 'number') nums.push(v) }
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
      write({ columns })
      return
    }
    const rows = sheet.rows.map((row, r) => {
      if (r !== p.r - 1) return row
      const next: Cell[] = Array.from({ length: nCols }, (_, c) => row[c] ?? '')
      next[p.c] = parseInput(value)
      return next
    })
    write({ rows })
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
    revealIn(grid.current?.closest('.rp-sheet-scroll') as HTMLElement | null, grid.current?.querySelector(`[data-pos="${sel.r}-${sel.c}"]`), { top: 26, right: 4, bottom: 28, left: 46 })
  }, [sel])

  const onGridKey = (e: React.KeyboardEvent) => {
    if (edit) return
    const k = e.key
    if ((e.metaKey || e.ctrlKey) && k.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
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
    const v = safe(computed, r, c)
    if (typeof v === 'number') return { text: fmtNum(v, c), numeric: true, error: false }
    return { text: v, numeric: false, error: v.startsWith('#') && v.length <= 7 }
  }
  const addRow = () => {
    const rows = [...sheet.rows, Array.from({ length: nCols }, () => '' as Cell)]
    write({ rows })
    setSel({ r: rows.length, c: 0 })
    grid.current?.focus({ preventScroll: true })
  }

  const ref = `${colName(sel.c)}${sel.r + 1}`
  const autoSum = () => {
    if (readOnly || sel.r < 2) return
    const col = colName(sel.c)
    save(sel, `=SUM(${col}2:${col}${sel.r})`)
    grid.current?.focus({ preventScroll: true })
  }
  const fmt = formats[sel.c] ?? {}
  const selValue = sel.r > 0 ? display(sel.r, sel.c) : null
  const colNums: number[] = []
  for (let r = 1; r <= nRows; r++) { const v = safe(computed, r, sel.c); if (typeof v === 'number') colNums.push(v) }
  return (
    <div className="rp-doc">
      <ArtifactHeader artifact={sheet} />
      <div className="rp-toolbar" role="toolbar" aria-label={t({ fr: 'Outils de la feuille', en: 'Sheet tools' })}>
        <TB icon="undo" label={t({ fr: 'Annuler', en: 'Undo' })} disabled={!past.current.length} onClick={undo} />
        <TB icon="redo" label={t({ fr: 'Rétablir', en: 'Redo' })} disabled={!future.current.length} onClick={redo} />
        <TBSep />
        <TB icon="euro" label={t({ fr: 'Format monétaire', en: 'Currency format' })} pressed={fmt.style === 'currency'} onClick={() => setFormat(sel.c, (f) => ({ ...f, style: f.style === 'currency' ? undefined : 'currency' }))} />
        <TB icon="percent" label={t({ fr: 'Format pourcentage', en: 'Percent format' })} pressed={fmt.style === 'percent'} onClick={() => setFormat(sel.c, (f) => ({ ...f, style: f.style === 'percent' ? undefined : 'percent' }))} />
        <TB icon="decimal_decrease" label={t({ fr: 'Moins de décimales', en: 'Fewer decimals' })} onClick={() => setFormat(sel.c, (f) => ({ ...f, decimals: Math.max(0, (f.decimals ?? 2) - 1) }))} />
        <TB icon="decimal_increase" label={t({ fr: 'Plus de décimales', en: 'More decimals' })} onClick={() => setFormat(sel.c, (f) => ({ ...f, decimals: Math.min(4, (f.decimals ?? 0) + 1) }))} />
        <TBSep />
        <TB icon="functions" label={t({ fr: 'Somme de la colonne au-dessus', en: 'Sum of the column above' })} disabled={readOnly || sel.r < 2} onClick={autoSum} />
      </div>
      <div className="rp-formula">
        <span className="rp-formula-ref" aria-label={t({ fr: 'Cellule sélectionnée', en: 'Selected cell' })}>{ref}</span>
        <Icon name="function" size={18} className="rp-formula-fx" />
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
                  {c === 0 ? t({ fr: 'Total', en: 'Total' }) : totals[c] != null ? fmtNum(totals[c]!, c) : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
        {!readOnly && <Button size="s" icon="add" className="rp-sh-add" onClick={addRow}>{t({ fr: 'Ajouter une ligne', en: 'Add a row' })}</Button>}
      </div>
      <div className="rp-sheet-foot">
        <span className="rp-sheet-tab">{t({ fr: 'Feuille 1', en: 'Sheet 1' })}</span>
        {selValue?.numeric && colNums.length > 1 && (
          <span className="rp-sheet-sum" aria-live="polite">{t({ fr: 'Somme de la colonne', en: 'Column sum' })}: {fmtNum(colNums.reduce((a, b) => a + b, 0), sel.c)}</span>
        )}
      </div>
    </div>
  )
}
