import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useSessions } from '../context/SessionsContext'
import { SessionProvider } from '../context/SessionContext'
import { TabBar } from '../components/TabBar'
import { PlayersTab } from '../components/PlayersTab'
import { MatchupsTab } from '../components/MatchupsTab'
import { MatchesTab } from '../components/MatchesTab'
import { SessionModal } from '../components/SessionModal'
import { ExpensesModal } from '../components/ExpensesModal'

const detailTabs = ['Players', 'Matchups', 'Matches'] as const
type DetailTab = (typeof detailTabs)[number]

export function SessionDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const { sessions, endSession, reopenSession } = useSessions()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<DetailTab>('Players')
  const [showEdit, setShowEdit] = useState(false)
  const [showExpenses, setShowExpenses] = useState(false)

  const session = sessions.find(s => s.id === id)
  if (!session) return <Navigate to="/" replace />

  const ended = session.status === 'ended'

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-950 pb-16 overflow-x-hidden">
      <header
        className="bg-green-600 dark:bg-green-800 text-white p-4 flex justify-between items-center gap-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <div className="flex items-center gap-1 min-w-0">
          <button
            onClick={() => navigate('/')}
            aria-label="Back to sessions"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-xl shrink-0"
          >
            ←
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">{session.venue || session.date}</h1>
            <p className="text-xs text-green-100 dark:text-green-200">
              {session.date}{ended ? ' · ended' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!ended && (
            <button
              onClick={() => setShowEdit(true)}
              aria-label="Edit session"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              ✏️
            </button>
          )}
          <button
            onClick={() => setShowExpenses(true)}
            aria-label="Expenses"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            💰
          </button>
          <button
            onClick={() => (ended ? reopenSession(session.id) : endSession(session.id))}
            className="rounded-lg border border-white/40 px-2.5 py-1.5 text-xs font-medium min-h-[44px]"
          >
            {ended ? 'Reopen' : 'End'}
          </button>
        </div>
      </header>

      <SessionProvider sessionId={session.id}>
        <main className="p-4">
          {activeTab === 'Players' && <PlayersTab />}
          {activeTab === 'Matchups' && <MatchupsTab />}
          {activeTab === 'Matches' && <MatchesTab />}
        </main>
        {showExpenses && <ExpensesModal onClose={() => setShowExpenses(false)} />}
      </SessionProvider>

      {showEdit && !ended && (
        <SessionModal sessionId={session.id} onClose={() => setShowEdit(false)} />
      )}

      <TabBar tabs={detailTabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
