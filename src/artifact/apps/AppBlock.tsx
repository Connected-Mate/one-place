/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// A tool Gemini built for this project. Each one loads on its own, so the board stays light.
import { lazy, Suspense } from 'react'
import type { AppId } from '../../data/types'
import './apps.css'
import type { AppBlock as App } from './ui'

const APPS: Record<AppId, React.LazyExoticComponent<(p: { block: App }) => React.JSX.Element>> = {
  'launch-sim': lazy(() => import('./LaunchSim')),
  colorway: lazy(() => import('./Colorway')),
  seats: lazy(() => import('./Seats')),
  candidates: lazy(() => import('./Candidates')),
  deal: lazy(() => import('./Deal')),
  odds: lazy(() => import('./Odds')),
  pitch: lazy(() => import('./Pitch')),
}

export function AppBlock({ block }: { block: App }) {
  const Tool = APPS[block.app]
  if (!Tool) return null
  return (
    <Suspense fallback={<div className="ap-loading" aria-hidden="true"><i /><i /><i /></div>}>
      <Tool block={block} />
    </Suspense>
  )
}
