import { useEffect, useState } from 'react'
import AppShell from './components/layout/AppShell'
import { seedOnFirstLaunch } from './db/seed'

function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    seedOnFirstLaunch().then(() => setReady(true))
  }, [])

  if (!ready) return null

  return <AppShell />
}

export default App
