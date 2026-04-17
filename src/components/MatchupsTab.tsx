import { useState } from 'react'
import { useSession } from '../context/SessionContext'
import type { PlaySystem, MatchupState } from '../types'
import {
  generatePaddleQueueMatchups,
  generateRoundRobinMatchups,
  generateChallengeCourtMatchups,
  snapshotToHistory,
} from '../utils/matchups'

const systemLabels: Record<PlaySystem, string> = {
  'paddle-queue': 'Paddle Queue',
  'challenge-court': 'Challenge Court',
  'round-robin': 'Round Robin',
}

export function MatchupsTab() {
  const { session, setPlaySystem, setMatchupState, setRoundHistory, updatePlayerStatus, setDeferredPlayerIds } = useSession()
  const [stayingIds, setStayingIds] = useState<Set<string>>(new Set())
  const [expandedRound, setExpandedRound] = useState<string | null>(null)

  const activePlayers = session.players.filter(p => p.status === 'active')
  const currentCourts = session.timeSlots.length > 0
    ? Math.max(...session.timeSlots.map(s => s.numCourts))
    : 1

  const playerNameMap = new Map(session.players.map(p => [p.id, p.name]))
  const getName = (id: string) => playerNameMap.get(id) ?? id

  const generateRound = () => {
    const playerIds = activePlayers.map(p => p.id)
    let state: MatchupState

    // Snapshot current state to history if matchups exist
    if (session.matchupState) {
      const snapshot = snapshotToHistory(session.matchupState)
      setRoundHistory([...session.roundHistory, snapshot])
    }

    switch (session.playSystem) {
      case 'paddle-queue':
        state = generatePaddleQueueMatchups(playerIds, currentCourts, session.deferredPlayerIds)
        break
      case 'round-robin':
        state = generateRoundRobinMatchups(
          playerIds,
          currentCourts,
          [...session.roundHistory, ...(session.matchupState ? [session.matchupState] : [])],
          session.deferredPlayerIds,
        )
        break
      case 'challenge-court':
        state = generateChallengeCourtMatchups(playerIds, currentCourts, [...stayingIds], session.deferredPlayerIds)
        break
    }

    setMatchupState(state)
    setDeferredPlayerIds([])
    setStayingIds(new Set())
  }

  const reshuffleMatchups = () => {
    if (!session.matchupState) return
    const playerIds = activePlayers.map(p => p.id)
    let state: MatchupState

    switch (session.playSystem) {
      case 'paddle-queue':
        state = generatePaddleQueueMatchups(playerIds, currentCourts, session.deferredPlayerIds)
        break
      case 'round-robin':
        state = generateRoundRobinMatchups(playerIds, currentCourts, session.roundHistory, session.deferredPlayerIds)
        break
      case 'challenge-court':
        state = generateChallengeCourtMatchups(playerIds, currentCourts, [...stayingIds], session.deferredPlayerIds)
        break
    }

    setMatchupState(state)
  }

  const toggleWinningTeam = (team: string[], opposingTeam: string[]) => {
    setStayingIds(prev => {
      const next = new Set(prev)
      const allSelected = team.every(id => next.has(id))
      if (allSelected) {
        team.forEach(id => next.delete(id))
      } else {
        team.forEach(id => next.add(id))
        opposingTeam.forEach(id => next.delete(id))
      }
      return next
    })
  }

  const deferPlayer = (playerId: string) => {
    if (!session.matchupState) return
    const sittingOut = [...session.matchupState.sittingOut]
    if (sittingOut.length === 0) return

    const replacement = sittingOut.shift()!
    const updatedGames = session.matchupState.games.map(game => ({
      ...game,
      team1: game.team1.map(id => id === playerId ? replacement : id) as [string, string],
      team2: game.team2.map(id => id === playerId ? replacement : id) as [string, string],
    }))

    sittingOut.push(playerId)
    setMatchupState({ games: updatedGames, sittingOut })
    setDeferredPlayerIds([...session.deferredPlayerIds, playerId])
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {(Object.entries(systemLabels) as [PlaySystem, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPlaySystem(key)}
            className={`flex-1 rounded-md py-2 text-xs font-medium min-h-[40px] ${
              session.playSystem === key
                ? 'bg-white dark:bg-gray-900 text-green-700 dark:text-green-300 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {session.players.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Roster</h3>
          <div className="flex flex-wrap gap-2">
            {session.players.map(player => (
              <button
                key={player.id}
                onClick={() => updatePlayerStatus(player.id, player.status === 'active' ? 'left' : 'active')}
                className={`rounded-full px-3 py-1.5 text-sm font-medium min-h-[32px] ${
                  player.status === 'active'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 line-through'
                }`}
              >
                {player.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {activePlayers.length < 4 && (
        <p className="text-sm text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3">
          Need at least 4 active players to generate matchups. Currently: {activePlayers.length}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={generateRound}
          disabled={activePlayers.length < 4}
          className="flex-1 rounded-lg bg-green-600 dark:bg-green-700 text-white py-2.5 text-sm font-medium disabled:opacity-50 min-h-[44px]"
        >
          {!session.matchupState ? 'Generate Matchups' : 'Next Round'}
        </button>
        {session.matchupState && (
          <button
            onClick={reshuffleMatchups}
            className="rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2.5 text-sm font-medium min-h-[44px]"
          >
            Reshuffle
          </button>
        )}
      </div>

      {session.matchupState && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Round {session.roundHistory.length + 1}
          </h3>

          {session.matchupState.games.map(game => (
            <div key={game.court} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2">Court {game.court}</p>
              <div className="flex items-center justify-between">
                <div className="text-center flex-1 space-y-1">
                  {game.team1.map(id => (
                    <div key={id} className="flex items-center justify-center gap-1">
                      <p className="font-medium text-gray-900 dark:text-gray-50">{getName(id)}</p>
                      {session.matchupState!.sittingOut.length > 0 && (
                        <button
                          onClick={() => deferPlayer(id)}
                          className="text-xs text-amber-600 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 px-1"
                          title="Defer to next round"
                        >
                          defer
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <span className="text-gray-400 dark:text-gray-500 font-bold px-3">vs</span>
                <div className="text-center flex-1 space-y-1">
                  {game.team2.map(id => (
                    <div key={id} className="flex items-center justify-center gap-1">
                      <p className="font-medium text-gray-900 dark:text-gray-50">{getName(id)}</p>
                      {session.matchupState!.sittingOut.length > 0 && (
                        <button
                          onClick={() => deferPlayer(id)}
                          className="text-xs text-amber-600 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 px-1"
                          title="Defer to next round"
                        >
                          defer
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {session.matchupState.sittingOut.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">Sitting Out</p>
              <div className="flex flex-wrap gap-1">
                {session.matchupState.sittingOut.map(id => (
                  <span
                    key={id}
                    className={`text-sm px-2 py-0.5 rounded ${
                      session.deferredPlayerIds.includes(id)
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                        : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {getName(id)}{session.deferredPlayerIds.includes(id) ? ' (next round)' : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {session.playSystem === 'challenge-court' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-3 space-y-3">
              <p className="text-xs font-medium text-blue-800 dark:text-blue-200">Winners stay on court?</p>
              {session.matchupState.games.map(game => {
                const team1Selected = game.team1.every(id => stayingIds.has(id))
                const team2Selected = game.team2.every(id => stayingIds.has(id))
                return (
                  <div key={game.court} className="space-y-1">
                    <p className="text-xs text-gray-400 dark:text-gray-500">Court {game.court}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleWinningTeam([...game.team1], [...game.team2])}
                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium min-h-[40px] ${
                          team1Selected
                            ? 'bg-blue-600 text-white'
                            : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {game.team1.map(getName).join(', ')}
                      </button>
                      <span className="text-xs text-gray-400 dark:text-gray-500">vs</span>
                      <button
                        onClick={() => toggleWinningTeam([...game.team2], [...game.team1])}
                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium min-h-[40px] ${
                          team2Selected
                            ? 'bg-blue-600 text-white'
                            : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {game.team2.map(getName).join(', ')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {session.roundHistory.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Previous Rounds
          </h3>
          {session.roundHistory.map((round, idx) => (
            <div key={round.id} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setExpandedRound(expandedRound === round.id ? null : round.id)}
                className="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 min-h-[44px]"
              >
                Round {idx + 1} — {round.games.length} game{round.games.length !== 1 ? 's' : ''}
                <span className="float-right text-gray-400 dark:text-gray-500">
                  {expandedRound === round.id ? '▲' : '▼'}
                </span>
              </button>
              {expandedRound === round.id && (
                <div className="px-4 pb-3 space-y-2">
                  {round.games.map(game => (
                    <div key={game.court} className="text-sm text-gray-600 dark:text-gray-300">
                      <span className="text-gray-400 dark:text-gray-500">Court {game.court}:</span>{' '}
                      {getName(game.team1[0])} & {getName(game.team1[1])} vs{' '}
                      {getName(game.team2[0])} & {getName(game.team2[1])}
                    </div>
                  ))}
                  {round.sittingOut.length > 0 && (
                    <div className="text-sm text-gray-400 dark:text-gray-500">
                      Sat out: {round.sittingOut.map(getName).join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
