/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// What CSS alone can't do for a real phone: follow the on-screen keyboard, close a message's actions on a tap
// elsewhere, open them on a long press, and let the system's back gesture leave a project before leaving the app.
import { useEffect } from 'react'
import { useChat } from '../chat/chatState'
import { mobileView, useStore, type State } from '../store'

const inProject = (s: State) => { const v = mobileView(s); return v === 'chat' || v === 'pane' }
const isPhone = () => matchMedia('(max-width:599px)').matches

export function useResponsiveShell() {
  // iOS Safari keeps 100dvh under the keyboard: --kb lifts the app above it. Android resizes by itself (see the viewport meta).
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    const apply = () => {
      if (vv.scale > 1.01) return // a pinch zoom is not a keyboard
      const kb = Math.round(innerHeight - vv.height)
      root.style.setProperty('--kb', `${kb > 80 ? kb : 0}px`)
      if (kb > 80 && scrollY) scrollTo(0, 0)
    }
    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => { vv.removeEventListener('resize', apply); vv.removeEventListener('scroll', apply) }
  }, [])

  // Message actions on touch: any tap outside closes them, and using one closes the sheet. Long press opens them.
  useEffect(() => {
    if (!matchMedia('(hover:none)').matches) return
    const close = () => useChat.getState().setTouched(null)
    const click = (e: MouseEvent) => {
      const el = e.target as HTMLElement
      const btn = el.closest('.msg-actions button')
      if (btn) {
        const emoji = btn.matches('.emoji-btn'); const inPicker = !!btn.closest('.shown')
        // "React" swaps the sheet for the emoji row, and the row's close comes back to the sheet: those stay open.
        requestAnimationFrame(() => { if (emoji || (!inPicker && !document.querySelector('.msg.touched .msg-actions.shown'))) close() })
      } else if (useChat.getState().touched && !el.closest('.msg')) close()
    }
    const press = (e: MouseEvent) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('.msg[data-mid]')
      if (!row || (e.target as HTMLElement).closest('a,input,textarea,[contenteditable="true"]')) return
      e.preventDefault()
      useChat.getState().setTouched(row.dataset.mid ?? null)
    }
    // capture: React may have swapped the tapped button for another by the time the click bubbles up
    document.addEventListener('click', click, true)
    document.addEventListener('contextmenu', press)
    return () => { document.removeEventListener('click', click, true); document.removeEventListener('contextmenu', press) }
  }, [])

  // On a phone a project is a screen pushed over the list: the system's back goes to the list, as in Google Chat.
  useEffect(() => {
    let was = inProject(useStore.getState())
    const mark = () => { if (isPhone() && !(history.state as { opProject?: boolean } | null)?.opProject) history.pushState({ opProject: true }, '') }
    if (was) mark()
    const unsub = useStore.subscribe((s) => {
      const now = inProject(s)
      if (now && !was) mark()
      was = now
    })
    const pop = () => { if (isPhone() && inProject(useStore.getState())) useStore.getState().setMobilePane('projects') }
    addEventListener('popstate', pop)
    return () => { unsub(); removeEventListener('popstate', pop) }
  }, [])
}
