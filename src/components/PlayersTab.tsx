import { useSession } from '../context/SessionContext'

export function PlayersTab() {
  const { session, readOnly, checkIn, checkOut } = useSession()
  const checkedInCount = session.players.filter(p => p.checkedIn).length

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {checkedInCount} of {session.players.length} checked in
      </p>

      {session.players.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
          No players in the roster yet. Tap Edit to add players.
        </p>
      )}

      <ul className="space-y-2">
        {session.players.map(player => (
          <li
            key={player.id}
            className="flex items-center justify-between gap-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3"
          >
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-gray-50 truncate">{player.name}</p>
              {player.participated && !player.checkedIn && (
                <p className="text-xs text-gray-400 dark:text-gray-500">played earlier</p>
              )}
            </div>
            {!readOnly && (
              <button
                onClick={() => (player.checkedIn ? checkOut(player.id) : checkIn(player.id))}
                className={`rounded-lg px-3 py-2 text-sm font-medium min-h-[44px] ${
                  player.checkedIn
                    ? 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                    : 'bg-green-600 dark:bg-green-700 text-white'
                }`}
              >
                {player.checkedIn ? 'Check out' : 'Check in'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
