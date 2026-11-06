/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Places the Overview tiles on a grid. Any set of blocks gets a composed page: tiles take their preferred
// size where it fits, the last one in a row shrinks to fit or grows to fill, and no hole is left behind.
import type { Block } from '../data/types'

export interface Slot { c: number; r: number; w: number; h: number }
interface Want { w: number; h: number; min: number }

// [wide 12-column page] and [narrow 2-column page], in grid units. Order below is also reading order.
const WANT: Record<Block['type'], { wide: Want; narrow: Want; rank: number }> = {
  summary: { rank: 0, wide: { w: 8, h: 2, min: 5 }, narrow: { w: 2, h: 2, min: 2 } },
  calendar: { rank: 1, wide: { w: 4, h: 2, min: 3 }, narrow: { w: 1, h: 2, min: 1 } },
  timeline: { rank: 2, wide: { w: 8, h: 4, min: 5 }, narrow: { w: 2, h: 3, min: 2 } },
  model3d: { rank: 3, wide: { w: 4, h: 4, min: 3 }, narrow: { w: 1, h: 3, min: 1 } },
  kanban: { rank: 4, wide: { w: 8, h: 3, min: 6 }, narrow: { w: 2, h: 2, min: 2 } },
  todo: { rank: 5, wide: { w: 5, h: 3, min: 4 }, narrow: { w: 2, h: 3, min: 2 } },
  chart: { rank: 6, wide: { w: 4, h: 3, min: 3 }, narrow: { w: 1, h: 3, min: 1 } },
  people: { rank: 7, wide: { w: 3, h: 3, min: 3 }, narrow: { w: 1, h: 2, min: 1 } },
  files: { rank: 8, wide: { w: 5, h: 2, min: 3 }, narrow: { w: 2, h: 2, min: 2 } },
  poll: { rank: 9, wide: { w: 4, h: 2, min: 3 }, narrow: { w: 1, h: 2, min: 1 } },
  notes: { rank: 10, wide: { w: 3, h: 2, min: 3 }, narrow: { w: 1, h: 2, min: 1 } },
}

function pack(items: { id: string; want: Want }[], cols: number) {
  const grid: (string | null)[][] = []
  const row = (r: number) => { while (grid.length <= r) grid.push(Array(cols).fill(null)); return grid[r] }
  const clear = (c: number, r: number, w: number, h: number) => {
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (x >= cols || row(y)[x]) return false
    return true
  }
  const out = new Map<string, Slot>()
  for (const { id, want } of items) {
    let placed: Slot | null = null
    for (let r = 0; !placed; r++) {
      for (let c = 0; c < cols && !placed; c++) {
        if (row(r)[c]) continue
        let run = 0
        while (c + run < cols && !row(r)[c + run]) run++
        const w = run >= want.w ? want.w : run >= want.min ? run : 0
        if (w && clear(c, r, w, want.h)) placed = { c, r, w, h: want.h }
        c += run - 1
      }
    }
    for (let y = placed.r; y < placed.r + placed.h; y++) for (let x = placed.c; x < placed.c + placed.w; x++) row(y)[x] = id
    out.set(id, placed)
  }
  // close the holes: to the right first, then down to the bottom of the page
  const rows = grid.reduce((n, cells, i) => (cells.some(Boolean) ? i + 1 : n), 0)
  const take = (s: Slot, id: string) => { for (let y = s.r; y < s.r + s.h; y++) for (let x = s.c; x < s.c + s.w; x++) row(y)[x] = id }
  for (const { id } of [...items].reverse()) {
    const s = out.get(id)!
    while (clear(s.c + s.w, s.r, 1, s.h)) s.w++
    while (s.r + s.h < rows && clear(s.c, s.r + s.h, s.w, 1)) s.h++
    take(s, id)
  }
  return { slots: out, rows }
}

export function layout(blocks: Block[]) {
  const ordered = [...blocks].sort((a, b) => WANT[a.type].rank - WANT[b.type].rank)
  return {
    ordered,
    wide: pack(ordered.map((b) => ({ id: b.id, want: WANT[b.type].wide })), 12),
    narrow: pack(ordered.map((b) => ({ id: b.id, want: WANT[b.type].narrow })), 2),
  }
}
