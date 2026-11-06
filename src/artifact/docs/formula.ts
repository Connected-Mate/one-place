// A tiny formula engine for the sheet: + - * / ( ), cell references, SUM, AVERAGE, MIN, MAX, COUNT.
// Written by hand on purpose: no eval, no dependency.
export type Cell = string | number
/** r is the visual row: 0 = column names (text), 1 = first data row. Formulas see them as A1, A2... */
export type Getter = (r: number, c: number) => Cell

class Fail extends Error {}

const colIndex = (s: string) => [...s.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
export const colName = (c: number): string => (c < 26 ? String.fromCharCode(65 + c) : colName(Math.floor(c / 26) - 1) + String.fromCharCode(65 + (c % 26)))

export function evaluate(src: string, get: Getter): number {
  const text = src.replace(/\s+/g, '').replace(/;/g, ',')
  let i = 0
  const peek = () => text[i]
  const num = (v: Cell) => (typeof v === 'number' ? v : 0)

  const readRef = () => {
    const m = /^([A-Za-z]{1,2})(\d{1,4})/.exec(text.slice(i))
    if (!m) throw new Fail('ref')
    i += m[0].length
    return { c: colIndex(m[1]), r: Number(m[2]) - 1 }
  }
  const args = (): number[] => {
    const out: number[] = []
    if (peek() === ')') return out
    for (;;) {
      if (/^[A-Za-z]{1,2}\d/.test(text.slice(i))) {
        const save = i
        const a = readRef()
        if (peek() === ':') {
          i++
          const b = readRef()
          for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) {
            for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) {
              const v = get(r, c)
              if (typeof v === 'number') out.push(v)
            }
          }
        } else { i = save; out.push(expr()) }
      } else out.push(expr())
      if (peek() !== ',') return out
      i++
    }
  }
  const factor = (): number => {
    if (peek() === '-') { i++; return -factor() }
    if (peek() === '+') { i++; return factor() }
    if (peek() === '(') {
      i++
      const v = expr()
      if (peek() !== ')') throw new Fail('paren')
      i++
      return v
    }
    const n = /^\d+(?:[.,]\d+)?/.exec(text.slice(i))
    if (n && !/^\d+,\d+/.test(n[0])) { i += n[0].length; return Number(n[0]) }
    if (n) { const whole = /^\d+(?:\.\d+)?/.exec(text.slice(i))!; i += whole[0].length; return Number(whole[0]) }
    const fn = /^([A-Za-z]+)\(/.exec(text.slice(i))
    if (fn) {
      i += fn[0].length
      const list = args()
      if (peek() !== ')') throw new Fail('paren')
      i++
      switch (fn[1].toUpperCase()) {
        case 'SUM': case 'SOMME': return list.reduce((a, b) => a + b, 0)
        case 'AVERAGE': case 'MOYENNE': if (!list.length) throw new Fail('div'); return list.reduce((a, b) => a + b, 0) / list.length
        case 'MIN': return list.length ? Math.min(...list) : 0
        case 'MAX': return list.length ? Math.max(...list) : 0
        case 'COUNT': case 'NB': return list.length
        default: throw new Fail('fn')
      }
    }
    const { r, c } = readRef()
    return num(get(r, c))
  }
  const term = (): number => {
    let v = factor()
    while (peek() === '*' || peek() === '/') {
      const op = text[i++]
      const b = factor()
      if (op === '/' && b === 0) throw new Fail('div')
      v = op === '*' ? v * b : v / b
    }
    return v
  }
  function expr(): number {
    let v = term()
    while (peek() === '+' || peek() === '-') { const op = text[i++]; const b = term(); v = op === '+' ? v + b : v - b }
    return v
  }
  const result = expr()
  if (i < text.length) throw new Fail('rest')
  return result
}

/** Value shown for one cell. A cycle or a typo gives a short error rather than a crash. */
export function computeCell(raw: Cell | undefined, get: (r: number, c: number) => Cell): Cell {
  if (raw == null || raw === '') return ''
  if (typeof raw !== 'string' || !raw.startsWith('=')) return raw
  try { return evaluate(raw.slice(1), get) } catch (e) { return e instanceof RangeError ? '#REF' : e instanceof Fail && e.message === 'div' ? '#DIV/0' : '#ERR' }
}

/** "1 200,50", "1,200.50" and "1200.5" are numbers; anything else stays text. */
export function parseInput(text: string): Cell {
  const v = text.trim()
  if (!v) return ''
  if (v.startsWith('=')) return v
  const compact = v.replace(/[\s  ]/g, '')
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(compact)) return Number(compact.replace(/,/g, ''))
  if (/^-?\d+([.,]\d+)?$/.test(compact)) return Number(compact.replace(',', '.'))
  return v
}
