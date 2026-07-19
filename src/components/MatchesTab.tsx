import { useSession } from '../context/SessionContext'
import { computeWinLoss } from '../utils/matchups'

export function MatchesTab() {
  const { session, readOnly, setGameWinner } = useSession()
  const nameMap = new Map(session.players.map(p => [p.id, p.name]))
  const getName = (id: string) => nameMap.get(id) ?? id

  if (session.roundHistory.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
        No completed rounds yet. Rounds appear here as you play.
      </p>
    )
  }

  const tally = computeWinLoss(session.roundHistory)
  const rounds = session.roundHistory
    .map((round, idx) => ({ round, number: idx + 1 }))
    .reverse()

  const teamClasses = (isWinner: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-medium min-h-[44px] disabled:opacity-70 ${
      isWinner
        ? 'bg-green-600 dark:bg-green-700 text-white'
        : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600'
    }`

  return (
    <div className="space-y-4">
      {tally.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tally.map(t => (
            <span
              key={t.playerId}
              className="text-xs bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1 text-gray-600 dark:text-gray-300"
            >
              {getName(t.playerId)} {t.wins}W–{t.losses}L
            </span>
          ))}
        </div>
      )}

      {rounds.map(({ round, number }) => (
        <div
          key={round.id}
          className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3"
        >
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
            Round {number}
          </p>
          {round.games.map(game => (
            <div key={game.court} className="space-y-1">
              <p className="text-xs text-gray-400 dark:text-gray-500">Court {game.court}</p>
              <div className="flex items-center gap-2">
                <button
                  disabled={readOnly}
                  onClick={() => setGameWinner(round.id, game.court, game.winner === 1 ? undefined : 1)}
                  className={teamClasses(game.winner === 1)}
                >
                  {game.team1.map(getName).join(' & ')}{game.winner === 1 ? ' ✓' : ''}
                </button>
                <span className="text-xs text-gray-400 dark:text-gray-500">vs</span>
                <button
                  disabled={readOnly}
                  onClick={() => setGameWinner(round.id, game.court, game.winner === 2 ? undefined : 2)}
                  className={teamClasses(game.winner === 2)}
                >
                  {game.team2.map(getName).join(' & ')}{game.winner === 2 ? ' ✓' : ''}
                </button>
              </div>
            </div>
          ))}
          {round.sittingOut.length > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Sat out: {round.sittingOut.map(getName).join(', ')}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
