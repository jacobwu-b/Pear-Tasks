import { useEffect, useState } from 'react'
import AppShell from './components/layout/AppShell'
import { seedOnFirstLaunch } from './db/seed'
import { seedBuiltInTemplates } from './db/templates'

function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    Promise.all([seedOnFirstLaunch(), seedBuiltInTemplates()]).then(() => setReady(true))
  }, [])

  if (!ready) return null

  return <AppShell />
}

export default App
