import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { Session } from '../types'
import { useSessions } from '../context/SessionsContext'
import { compareSessionsDesc } from '../utils/sessionOps'
import { SessionModal } from '../components/SessionModal'
import { ThemeToggle } from '../components/ThemeToggle'

function SessionCard({ session, onDelete }: { session: Session; onDelete?: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="flex items-stretch gap-2">
      <button
        onClick={() => navigate(`/session/${session.id}`)}
        className="flex-1 min-w-0 text-left bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-gray-900 dark:text-gray-50 truncate">
            {session.venue || session.date}
          </p>
          <span className={`text-xs rounded-full px-2 py-0.5 font-medium shrink-0 ${
            session.status === 'active'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
          }`}>
            {session.status}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {session.venue ? `${session.date} · ` : ''}
          {session.players.length} player{session.players.length !== 1 ? 's' : ''}
        </p>
      </button>
      {onDelete && (
        <button
          onClick={onDelete}
          aria-label={`Delete session ${session.venue || session.date}`}
          className="text-red-500 dark:text-red-400 px-3 min-h-[44px] flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
        >
          ✕
        </button>
      )}
    </div>
  )
}

export function SessionListScreen() {
  const { sessions, deleteSession } = useSessions()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)

  const active = sessions.filter(s => s.status === 'active').sort(compareSessionsDesc)
  const ended = sessions.filter(s => s.status === 'ended').sort(compareSessionsDesc)

  const handleDelete = (session: Session) => {
    if (window.confirm(`Delete session "${session.venue || session.date}"? This cannot be undone.`)) {
      deleteSession(session.id)
    }
  }

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-950 overflow-x-hidden">
      <header
        className="bg-green-600 dark:bg-green-800 text-white p-4 flex justify-between items-center"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <h1 className="text-lg font-bold">Pickle</h1>
        <ThemeToggle />
      </header>
      <main className="p-4 space-y-6">
        <button
          onClick={() => setShowCreate(true)}
          className="w-full rounded-lg bg-green-600 dark:bg-green-700 text-white py-3 text-sm font-medium min-h-[48px]"
        >
          + New Session
        </button>

        {sessions.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            No sessions yet. Create your first one.
          </p>
        )}

        {active.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Active</h2>
            {active.map(s => <SessionCard key={s.id} session={s} />)}
          </section>
        )}

        {ended.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Past</h2>
            {ended.map(s => (
              <SessionCard key={s.id} session={s} onDelete={() => handleDelete(s)} />
            ))}
          </section>
        )}
      </main>
      {showCreate && (
        <SessionModal
          onClose={() => setShowCreate(false)}
          onCreated={s => navigate(`/session/${s.id}`)}
        />
      )}
    </div>
  )
}
