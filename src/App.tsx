import { useEffect, useMemo, useState } from 'react'
import AppShell from './components/layout/AppShell'
import QuickCapture from './components/tasks/QuickCapture'
import NewTaskForm from './components/tasks/NewTaskForm'
import ShortcutHelp from './components/common/ShortcutHelp'
import SearchPalette from './components/common/SearchPalette'
import DataManagement from './components/common/DataManagement'
import { seedOnFirstLaunch } from './db/seed'
import { seedBuiltInTemplates } from './db/templates'
import { useUiStore } from './store/uiStore'
import { useTaskStore } from './store/taskStore'
import { useGlobalShortcuts } from './lib/keyboard'

function App() {
  const [ready, setReady] = useState(false)
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [dataOpen, setDataOpen] = useState(false)

  const quickCaptureOpen = useUiStore((s) => s.quickCaptureOpen)
  const newTaskFormOpen = useUiStore((s) => s.newTaskFormOpen)
  const openQuickCapture = useUiStore((s) => s.openQuickCapture)
  const closeQuickCapture = useUiStore((s) => s.closeQuickCapture)
  const openNewTaskForm = useUiStore((s) => s.openNewTaskForm)
  const closeNewTaskForm = useUiStore((s) => s.closeNewTaskForm)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const selectedTaskId = useUiStore((s) => s.selectedTaskId)
  const setSelectedTaskId = useUiStore((s) => s.setSelectedTaskId)
  const sidebarView = useUiStore((s) => s.sidebarView)
  const graphCollapsed = useUiStore((s) => s.graphCollapsed)
  const setGraphCollapsed = useUiStore((s) => s.setGraphCollapsed)

  const completeTask = useTaskStore((s) => s.completeTask)
  const deleteTask = useTaskStore((s) => s.deleteTask)
  const updateTaskField = useTaskStore((s) => s.updateTaskField)

  useEffect(() => {
    Promise.all([seedOnFirstLaunch(), seedBuiltInTemplates()]).then(() => setReady(true))
  }, [])

  const isProjectView = typeof sidebarView === 'object' && sidebarView.type === 'project'
  const anyModalOpen = quickCaptureOpen || newTaskFormOpen || shortcutHelpOpen || searchOpen

  const handlers = useMemo(() => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    return {
      quickCapture: () => {
        if (!anyModalOpen) openQuickCapture()
      },
      newTaskForm: () => {
        if (!anyModalOpen) openNewTaskForm()
      },
      completeTask: () => {
        if (selectedTaskId && !anyModalOpen) completeTask(selectedTaskId)
      },
      deleteTask: () => {
        if (selectedTaskId && !anyModalOpen) {
          deleteTask(selectedTaskId)
          setSelectedTaskId(null)
        }
      },
      moveToToday: () => {
        if (selectedTaskId && !anyModalOpen) updateTaskField(selectedTaskId, { when: todayStr })
      },
      moveToSomeday: () => {
        if (selectedTaskId && !anyModalOpen) updateTaskField(selectedTaskId, { when: 'someday' })
      },
      toggleSidebar: () => {
        if (!anyModalOpen) toggleSidebar()
      },
      toggleGraph: () => {
        if (isProjectView && !anyModalOpen) setGraphCollapsed(!graphCollapsed)
      },
      search: () => {
        if (!anyModalOpen) setSearchOpen(true)
      },
      showHelp: () => {
        if (!anyModalOpen) setShortcutHelpOpen(true)
      },
    }
  }, [
    anyModalOpen, selectedTaskId, isProjectView, graphCollapsed,
    openQuickCapture, openNewTaskForm, completeTask, deleteTask,
    setSelectedTaskId, updateTaskField, toggleSidebar, setGraphCollapsed,
  ])

  useGlobalShortcuts(handlers)

  if (!ready) return null

  return (
    <>
      <AppShell onDataManagement={() => setDataOpen(true)} />
      <QuickCapture open={quickCaptureOpen} onClose={closeQuickCapture} />
      <NewTaskForm open={newTaskFormOpen} onClose={closeNewTaskForm} />
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <DataManagement open={dataOpen} onClose={() => setDataOpen(false)} />
      <ShortcutHelp open={shortcutHelpOpen} onClose={() => setShortcutHelpOpen(false)} />
    </>
  )
}

export default App
