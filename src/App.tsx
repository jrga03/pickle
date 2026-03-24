import { useState } from 'react'
import { SessionProvider } from './context/SessionContext'
import { TabBar, type Tab } from './components/TabBar'
import { SetupTab } from './components/SetupTab'
import { PlayersTab } from './components/PlayersTab'
import { MatchupsTab } from './components/MatchupsTab'
import { ExpensesTab } from './components/ExpensesTab'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Setup')

  return (
    <SessionProvider>
      <div className="min-h-dvh bg-gray-50 pb-16">
        <header className="bg-green-600 text-white p-4">
          <h1 className="text-lg font-bold">Pickleball</h1>
        </header>
        <main className="p-4">
          {activeTab === 'Setup' && <SetupTab />}
          {activeTab === 'Players' && <PlayersTab />}
          {activeTab === 'Matchups' && <MatchupsTab />}
          {activeTab === 'Expenses' && <ExpensesTab />}
        </main>
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </SessionProvider>
  )
}

export default App
