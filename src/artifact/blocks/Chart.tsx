// Bars vs target. One series = one colour; the target is a tick in ink, never a second hue.
// Plain HTML marks: 16px bars, 4px rounded data-end, square at the baseline, hairline grid.
import { useState } from 'react'
import type { Block } from '../../data/types'
import { useT, withUnit } from '../../i18n'
import { useStore } from '../../store'
import { Button } from '../../ui/kit'
import { Empty, Frame, useTip } from '../shared'

/** Clean axis: 1, 2 or 5 times a power of ten, around four intervals. */
function niceTicks(max: number) {
  if (max <= 0) return [0, 1]
  const raw = max / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw)!
  const out: number[] = []
  for (let v = 0; v < max + step; v += step) out.push(Math.round(v * 1e6) / 1e6)
  return out
}

export function ChartBlock({ block }: { block: Extract<Block, { type: 'chart' }> }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const [asTable, setAsTable] = useState(false)
  const { bind, node } = useTip()
  const fmt = (v: number) => withUnit(new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 1, notation: Math.abs(v) >= 1e5 ? 'compact' : 'standard' }).format(v), block.unit)
  const series = block.series
  const hasTarget = series.some((s) => s.target != null)
  const ticks = niceTicks(Math.max(0, ...series.flatMap((s) => [s.value, s.target ?? 0])))
  const top = ticks[ticks.length - 1]
  const x = (v: number) => `${(Math.max(0, v) / top) * 100}%`
  const actual = t({ fr: 'Réel', en: 'Actual' }), target = t({ fr: 'Objectif', en: 'Target' })

  const table = (
    <table className={asTable ? 'rp-viz-table' : 'sr-only'}>
      <caption className="sr-only">{t(block.title)}</caption>
      <thead><tr><th scope="col">{t({ fr: 'Élément', en: 'Item' })}</th><th scope="col">{actual}</th>{hasTarget && <th scope="col">{target}</th>}</tr></thead>
      <tbody>{series.map((s, i) => <tr key={i}><th scope="row">{t(s.label)}</th><td>{fmt(s.value)}</td>{hasTarget && <td>{s.target != null ? fmt(s.target) : ''}</td>}</tr>)}</tbody>
    </table>
  )

  return (
    <Frame block={block} actions={series.length > 0 && <Button size="s" className="rp-quiet" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>{asTable ? t({ fr: 'Voir le graphique', en: 'View chart' }) : t({ fr: 'Voir le tableau', en: 'View table' })}</Button>}>
      {series.length === 0 ? <Empty icon="bar_chart" title={t({ fr: 'Pas encore de données', en: 'No data yet' })} /> : (
        <>
          {!asTable && (
            <div className="rp-viz" aria-hidden="true">
              {hasTarget && (
                <div className="rp-viz-legend">
                  <span><i className="rp-viz-swatch" />{actual}</span>
                  <span><i className="rp-viz-tickkey" />{target}</span>
                </div>
              )}
              <div className="rp-viz-rows">
                {series.map((s, i) => {
                  const label = t(s.label)
                  const gap = s.target != null ? s.value - s.target : null
                  return (
                    <div key={i} className="rp-viz-row" {...bind(
                      <>
                        <b>{label}</b>
                        <span>{actual} {fmt(s.value)}</span>
                        {s.target != null && <span>{target} {fmt(s.target)}</span>}
                        {gap != null && <span>{gap >= 0 ? '+' : ''}{fmt(gap)} {t({ fr: 'par rapport à l’objectif', en: 'vs target' })}</span>}
                      </>,
                    )}>
                      <span className="rp-viz-label rp-trunc" title={label}>{label}</span>
                      <div className="rp-viz-plot">
                        <div className="rp-viz-inner">
                          {ticks.map((tk) => <span key={tk} className="rp-viz-grid" style={{ left: x(tk) }} />)}
                          <span className="rp-viz-bar" style={{ width: x(s.value) }} />
                          {s.target != null && <span className="rp-viz-target" style={{ left: x(s.target) }} />}
                          <span className="rp-viz-value" style={{ left: x(Math.max(s.value, s.target ?? 0)) }}>{fmt(s.value)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div className="rp-viz-row rp-viz-axisrow">
                  <span />
                  <div className="rp-viz-plot"><div className="rp-viz-inner">
                    {ticks.map((tk) => <span key={tk} className="rp-viz-tick" style={{ left: x(tk) }}>{new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US', { notation: top >= 1e4 ? 'compact' : 'standard' }).format(tk)}</span>)}
                  </div></div>
                </div>
              </div>
            </div>
          )}
          {table}
        </>
      )}
      {node}
    </Frame>
  )
}
