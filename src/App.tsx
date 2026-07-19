import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { SessionsProvider } from './context/SessionsContext'
import { SessionListScreen } from './screens/SessionListScreen'
import { SessionDetailScreen } from './screens/SessionDetailScreen'
import { ReloadPrompt } from './components/ReloadPrompt'

function App() {
  return (
    <SessionsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SessionListScreen />} />
          <Route path="/session/:id" element={<SessionDetailScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ReloadPrompt />
      </BrowserRouter>
    </SessionsProvider>
  )
}

export default App
