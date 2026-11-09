/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
import { useCallback, useEffect, useState } from 'react'
import { ChatPane } from './chat/ChatPane'
import { RightPane } from './artifact/RightPane'
import { CallChip, GuestScreen } from './call/CallView'
import { Home } from './home/Home'
import { TopBar } from './shell/TopBar'
import { ProjectsRail } from './shell/ProjectsRail'
import { Welcome } from './shell/Welcome'
import { Toasts } from './shell/Toasts'
import { MobileNav } from './shell/MobileNav'
import { Splitter } from './shell/Splitter'
import { ProjectBar } from './shell/ProjectBar'
import { YouPane } from './shell/YouPane'
import { useResponsiveShell } from './shell/viewport'
import { inProject, mobileView, personById, ME_ID, useStore } from './store'
import './shell/shell.css'
import './chat/chat-responsive.css'

export default function App() {
  const theme = useStore((s) => s.theme)
  const lang = useStore((s) => s.lang)
  const viewerId = useStore((s) => s.viewerId)
  const mobilePane = useStore(mobileView)
  const home = useStore((s) => s.home)
  const railCollapsed = useStore((s) => s.railCollapsed)
  const chatWidth = useStore((s) => s.chatWidth)
  const chatWidthTablet = useStore((s) => s.chatWidthTablet)
  const welcomeSeen = useStore((s) => s.welcomeSeen)
  const [about, setAbout] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const closeDrawer = useCallback(() => setDrawer(false), [])
  const isGuest = personById(viewerId).role === 'guest'
  useResponsiveShell()

  // The drawer only exists on tablets: rotating or resizing out of that range closes it. Esc closes it too.
  useEffect(() => {
    if (!drawer) return
    const mq = matchMedia('(min-width:600px) and (max-width:1279px)')
    const change = () => { if (!mq.matches) setDrawer(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.scrim,.menu')) setDrawer(false) }
    mq.addEventListener('change', change)
    document.addEventListener('keydown', key)
    return () => { mq.removeEventListener('change', change); document.removeEventListener('keydown', key) }
  }, [drawer])

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
    const mine = s.projects.filter((p) => inProject(p, viewerId))
    if (!mine.length || mine.some((p) => p.id === s.activeProjectId)) return
    if (s.home) useStore.setState({ activeProjectId: mine[0].id }) // stay on Home, and leave that project's unread alone
    else {
      const screen = s.mobilePane // switching persona from the phone's You or Projects screen stays on that screen
      s.selectProject(mine[0].id)
      if (screen === 'you' || screen === 'projects') s.setMobilePane(screen)
    }
  }, [viewerId])

  return (
    <>
      {isGuest ? <GuestScreen /> : (
        <div className={`app${railCollapsed ? ' rail-min' : ''}`} data-mobile={mobilePane} data-home={home || undefined} data-drawer={drawer || undefined} style={{ '--chat-w': `${chatWidth}px`, ...(chatWidthTablet ? { '--chat-w-t': `${chatWidthTablet}px` } : null) } as React.CSSProperties}>
          <TopBar onAbout={() => setAbout(true)} onMenu={() => setDrawer(true)} />
          <ProjectBar />
          <main className="app-main">
            <ProjectsRail drawer={drawer} onCloseDrawer={closeDrawer} />
            {drawer && <div className="drawer-scrim" onClick={closeDrawer} />}
            {/* The project stays mounted under Home: its scroll, its drafts and a running call all survive. */}
            {home && <Home onAbout={() => setAbout(true)} />}
            <ChatPane />
            <Splitter />
            <RightPane />
            <YouPane onAbout={() => setAbout(true)} />
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
