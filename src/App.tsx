import { useEffect, useState } from 'react'
import { ChatPane } from './chat/ChatPane'
import { RightPane } from './artifact/RightPane'
import { CallChip, GuestScreen } from './call/CallView'
import { TopBar } from './shell/TopBar'
import { ProjectsRail } from './shell/ProjectsRail'
import { Welcome } from './shell/Welcome'
import { Toasts } from './shell/Toasts'
import { MobileNav } from './shell/MobileNav'
import { Splitter } from './shell/Splitter'
import { personById, ME_ID, useStore } from './store'
import './shell/shell.css'

export default function App() {
  const theme = useStore((s) => s.theme)
  const lang = useStore((s) => s.lang)
  const viewerId = useStore((s) => s.viewerId)
  const mobilePane = useStore((s) => s.mobilePane)
  const railCollapsed = useStore((s) => s.railCollapsed)
  const chatWidth = useStore((s) => s.chatWidth)
  const welcomeSeen = useStore((s) => s.welcomeSeen)
  const [about, setAbout] = useState(false)
  const isGuest = personById(viewerId).role === 'guest'

  useEffect(() => {
    const r = document.documentElement
    if (theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', theme)
  }, [theme])
  useEffect(() => {
    document.documentElement.lang = lang
    document.title = lang === 'fr' ? 'One Place : un concept' : 'One Place: a concept'
  }, [lang])

  // A persona only sees the projects they belong to.
  useEffect(() => {
    const s = useStore.getState()
    if (viewerId !== ME_ID) s.markTour('viewas')
    const mine = s.projects.filter((p) => p.memberIds.includes(viewerId))
    if (mine.length && !mine.some((p) => p.id === s.activeProjectId)) s.selectProject(mine[0].id)
  }, [viewerId])

  return (
    <>
      {isGuest ? <GuestScreen /> : (
        <div className={`app${railCollapsed ? ' rail-min' : ''}`} data-mobile={mobilePane} style={{ '--chat-w': `${chatWidth}px` } as React.CSSProperties}>
          <TopBar onAbout={() => setAbout(true)} />
          <main className="app-main">
            <ProjectsRail />
            <ChatPane />
            <Splitter />
            <RightPane />
          </main>
          <MobileNav />
          <CallChip />
        </div>
      )}
      <Toasts />
      {(!welcomeSeen || about) && <Welcome onClose={() => { setAbout(false); useStore.getState().dismissWelcome() }} />}
    </>
  )
}
