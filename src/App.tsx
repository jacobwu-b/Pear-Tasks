import { useEffect, useState } from 'react'
import AppShell from './components/layout/AppShell'
import QuickCapture from './components/tasks/QuickCapture'
import NewTaskForm from './components/tasks/NewTaskForm'
import { seedOnFirstLaunch } from './db/seed'
import { seedBuiltInTemplates } from './db/templates'
import { useUiStore } from './store/uiStore'

function App() {
  const [ready, setReady] = useState(false)
  const quickCaptureOpen = useUiStore((s) => s.quickCaptureOpen)
  const newTaskFormOpen = useUiStore((s) => s.newTaskFormOpen)
  const openQuickCapture = useUiStore((s) => s.openQuickCapture)
  const closeQuickCapture = useUiStore((s) => s.closeQuickCapture)
  const openNewTaskForm = useUiStore((s) => s.openNewTaskForm)
  const closeNewTaskForm = useUiStore((s) => s.closeNewTaskForm)

  useEffect(() => {
    Promise.all([seedOnFirstLaunch(), seedBuiltInTemplates()]).then(() => setReady(true))
  }, [])

  // Global capture shortcuts. Both require Cmd/Ctrl so they don't conflict
  // with typing in any input — if a modifier is held with Enter, the user
  // is signaling intent regardless of focus. The full-form shortcut also
  // requires Shift. Shift+Cmd+Enter → full form; Cmd+Enter → quick capture.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key !== 'Enter') return
      // Don't re-open if a modal is already open.
      const state = useUiStore.getState()
      if (state.quickCaptureOpen || state.newTaskFormOpen) return
      e.preventDefault()
      if (e.shiftKey) openNewTaskForm()
      else openQuickCapture()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openQuickCapture, openNewTaskForm])

  if (!ready) return null

  return (
    <>
      <AppShell />
      <QuickCapture open={quickCaptureOpen} onClose={closeQuickCapture} />
      <NewTaskForm open={newTaskFormOpen} onClose={closeNewTaskForm} />
    </>
  )
}

export default App
