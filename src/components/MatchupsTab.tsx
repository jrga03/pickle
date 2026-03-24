import { useState } from 'react'
import { useSession } from '../context/SessionContext'
import type { PlaySystem, Round } from '../types'
import { generatePaddleQueueRound, generateRoundRobinRound, generateChallengeCourtRound } from '../utils/matchups'

const systemLabels: Record<PlaySystem, string> = {
  'paddle-queue': 'Paddle Queue',
  'challenge-court': 'Challenge Court',
  'round-robin': 'Round Robin',
}

export function MatchupsTab() {
  const { session, setPlaySystem, setRounds, updatePlayerStatus, setDeferredPlayerIds } = useSession()
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
    let round: Round

    switch (session.playSystem) {
      case 'paddle-queue':
        round = generatePaddleQueueRound(playerIds, currentCourts, session.deferredPlayerIds)
        break
      case 'round-robin':
        round = generateRoundRobinRound(playerIds, currentCourts, session.rounds, session.deferredPlayerIds)
        break
      case 'challenge-court':
        round = generateChallengeCourtRound(playerIds, currentCourts, [...stayingIds], session.deferredPlayerIds)
        break
    }

    setRounds([...session.rounds, round])
    setDeferredPlayerIds([])
    setStayingIds(new Set())
  }

  const regenerateLastRound = () => {
    if (session.rounds.length === 0) return
    const prevRounds = session.rounds.slice(0, -1)
    const playerIds = activePlayers.map(p => p.id)
    let round: Round

    switch (session.playSystem) {
      case 'paddle-queue':
        round = generatePaddleQueueRound(playerIds, currentCourts, session.deferredPlayerIds)
        break
      case 'round-robin':
        round = generateRoundRobinRound(playerIds, currentCourts, prevRounds, session.deferredPlayerIds)
        break
      case 'challenge-court':
        round = generateChallengeCourtRound(playerIds, currentCourts, [...stayingIds], session.deferredPlayerIds)
        break
    }

    setRounds([...prevRounds, round])
  }

  const currentRound = session.rounds.length > 0 ? session.rounds[session.rounds.length - 1] : null
  const previousRounds = session.rounds.slice(0, -1)

  const toggleStaying = (playerId: string) => {
    setStayingIds(prev => {
      const next = new Set(prev)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }

  const deferPlayer = (playerId: string) => {
    if (!currentRound) return
    const sittingOut = [...currentRound.sittingOut]
    if (sittingOut.length === 0) return

    const replacement = sittingOut.shift()!
    const updatedGames = currentRound.games.map(game => ({
      ...game,
      team1: game.team1.map(id => id === playerId ? replacement : id) as [string, string],
      team2: game.team2.map(id => id === playerId ? replacement : id) as [string, string],
    }))

    sittingOut.push(playerId)
    const updatedRound = { ...currentRound, games: updatedGames, sittingOut }
    const updatedRounds = [...session.rounds.slice(0, -1), updatedRound]
    setRounds(updatedRounds)
    setDeferredPlayerIds([...session.deferredPlayerIds, playerId])
  }

  const currentPlayingIds = currentRound
    ? new Set(currentRound.games.flatMap(g => [...g.team1, ...g.team2]))
    : new Set<string>()

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {(Object.entries(systemLabels) as [PlaySystem, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPlaySystem(key)}
            className={`flex-1 rounded-md py-2 text-xs font-medium min-h-[40px] ${
              session.playSystem === key
                ? 'bg-white text-green-700 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {session.players.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Roster</h3>
          <div className="flex flex-wrap gap-2">
            {session.players.map(player => (
              <button
                key={player.id}
                onClick={() => updatePlayerStatus(player.id, player.status === 'active' ? 'left' : 'active')}
                className={`rounded-full px-3 py-1.5 text-sm font-medium min-h-[32px] ${
                  player.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-500 line-through'
                }`}
              >
                {player.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {activePlayers.length < 4 && (
        <p className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
          Need at least 4 active players to generate matchups. Currently: {activePlayers.length}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={generateRound}
          disabled={activePlayers.length < 4}
          className="flex-1 rounded-lg bg-green-600 text-white py-2.5 text-sm font-medium disabled:opacity-50 min-h-[44px]"
        >
          {session.rounds.length === 0 ? 'Generate Matchups' : 'Next Round'}
        </button>
        {session.rounds.length > 0 && (
          <button
            onClick={regenerateLastRound}
            className="rounded-lg border border-gray-300 text-gray-700 px-4 py-2.5 text-sm font-medium min-h-[44px]"
          >
            Reshuffle
          </button>
        )}
      </div>

      {currentRound && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Round {session.rounds.length}
          </h3>

          {currentRound.games.map(game => (
            <div key={game.court} className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-400 mb-2">Court {game.court}</p>
              <div className="flex items-center justify-between">
                <div className="text-center flex-1 space-y-1">
                  {game.team1.map(id => (
                    <div key={id} className="flex items-center justify-center gap-1">
                      <p className="font-medium text-gray-900">{getName(id)}</p>
                      {currentRound.sittingOut.length > 0 && (
                        <button
                          onClick={() => deferPlayer(id)}
                          className="text-xs text-amber-600 hover:text-amber-800 px-1"
                          title="Defer to next round"
                        >
                          defer
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <span className="text-gray-400 font-bold px-3">vs</span>
                <div className="text-center flex-1 space-y-1">
                  {game.team2.map(id => (
                    <div key={id} className="flex items-center justify-center gap-1">
                      <p className="font-medium text-gray-900">{getName(id)}</p>
                      {currentRound.sittingOut.length > 0 && (
                        <button
                          onClick={() => deferPlayer(id)}
                          className="text-xs text-amber-600 hover:text-amber-800 px-1"
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

          {currentRound.sittingOut.length > 0 && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-medium text-gray-400 mb-1">Sitting Out</p>
              <div className="flex flex-wrap gap-1">
                {currentRound.sittingOut.map(id => (
                  <span
                    key={id}
                    className={`text-sm px-2 py-0.5 rounded ${
                      session.deferredPlayerIds.includes(id)
                        ? 'bg-amber-100 text-amber-800'
                        : 'text-gray-700'
                    }`}
                  >
                    {getName(id)}{session.deferredPlayerIds.includes(id) ? ' (next round)' : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {session.playSystem === 'challenge-court' && (
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 space-y-2">
              <p className="text-xs font-medium text-blue-800">Winners stay on court?</p>
              <div className="flex flex-wrap gap-2">
                {[...currentPlayingIds].map(id => (
                  <button
                    key={id}
                    onClick={() => toggleStaying(id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium min-h-[32px] ${
                      stayingIds.has(id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300'
                    }`}
                  >
                    {getName(id)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {previousRounds.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Previous Rounds
          </h3>
          {previousRounds.map((round, idx) => (
            <div key={round.id} className="bg-white rounded-lg border border-gray-200">
              <button
                onClick={() => setExpandedRound(expandedRound === round.id ? null : round.id)}
                className="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 min-h-[44px]"
              >
                Round {idx + 1} — {round.games.length} game{round.games.length !== 1 ? 's' : ''}
                <span className="float-right text-gray-400">
                  {expandedRound === round.id ? '▲' : '▼'}
                </span>
              </button>
              {expandedRound === round.id && (
                <div className="px-4 pb-3 space-y-2">
                  {round.games.map(game => (
                    <div key={game.court} className="text-sm text-gray-600">
                      <span className="text-gray-400">Court {game.court}:</span>{' '}
                      {getName(game.team1[0])} & {getName(game.team1[1])} vs{' '}
                      {getName(game.team2[0])} & {getName(game.team2[1])}
                    </div>
                  ))}
                  {round.sittingOut.length > 0 && (
                    <div className="text-sm text-gray-400">
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
