import { useSession } from '../context/SessionContext'

export function MatchesTab() {
  const { session, readOnly, setGameWinner, deleteGame } = useSession()
  const nameMap = new Map(session.players.map(p => [p.id, p.name]))
  const getName = (id: string) => nameMap.get(id) ?? id

  if (session.matchHistory.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
        No games yet. Completed games appear here.
      </p>
    )
  }

  const games = [...session.matchHistory].reverse()

  const teamClasses = (isWinner: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-medium min-h-[44px] disabled:opacity-70 ${
      isWinner
        ? 'bg-green-600 dark:bg-green-700 text-white'
        : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600'
    }`

  const handleDelete = (gameId: string) => {
    if (window.confirm('Delete this game record? Stats will update.')) deleteGame(gameId)
  }

  return (
    <div className="space-y-3">
      {games.map(game => (
        <div
          key={game.id}
          data-testid="game-row"
          className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 dark:text-gray-500">Court {game.court}</p>
            {!readOnly && (
              <button
                onClick={() => handleDelete(game.id)}
                aria-label={`Delete game on court ${game.court}`}
                className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 px-2 min-h-[28px]"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={readOnly}
              onClick={() => game.winner !== 1 && setGameWinner(game.id, 1)}
              className={teamClasses(game.winner === 1)}
            >
              {game.team1.map(getName).join(' & ')}{game.winner === 1 ? ' ✓' : ''}
            </button>
            <span className="text-xs text-gray-400 dark:text-gray-500">vs</span>
            <button
              disabled={readOnly}
              onClick={() => game.winner !== 2 && setGameWinner(game.id, 2)}
              className={teamClasses(game.winner === 2)}
            >
              {game.team2.map(getName).join(' & ')}{game.winner === 2 ? ' ✓' : ''}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
