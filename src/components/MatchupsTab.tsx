import { useState } from 'react'
import { useSession } from '../context/SessionContext'
import type { PlaySystem, MatchupState } from '../types'
import {
  generatePaddleQueueMatchups,
  generateRoundRobinMatchups,
  generateChallengeCourtMatchups,
  snapshotToHistory,
  rotateCourt,
  rotateChallengeCourtSingle,
  rerollCourt,
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
  const [editMode, setEditMode] = useState(false)
  const [editDraft, setEditDraft] = useState<MatchupState | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)

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

  const rotateSingleCourt = (courtNumber: number) => {
    if (!session.matchupState) return
    if (session.playSystem === 'round-robin') return

    let newState: MatchupState
    if (session.playSystem === 'challenge-court') {
      const game = session.matchupState.games.find(g => g.court === courtNumber)
      if (!game) return
      const team1Staying = game.team1.every(id => stayingIds.has(id))
      const winningTeam = team1Staying ? 'team1' : 'team2'
      newState = rotateChallengeCourtSingle(session.matchupState, courtNumber, winningTeam)
    } else {
      newState = rotateCourt(session.matchupState, courtNumber)
    }

    setMatchupState(newState)
    setStayingIds(new Set())
    setDeferredPlayerIds([])
  }

  const rerollSingleCourt = (courtNumber: number) => {
    if (!session.matchupState) return
    setMatchupState(rerollCourt(session.matchupState, courtNumber))
  }

  const enterEditMode = () => {
    if (!session.matchupState) return
    setEditDraft({
      games: session.matchupState.games.map(g => ({ ...g, team1: [...g.team1], team2: [...g.team2] })),
      sittingOut: [...session.matchupState.sittingOut],
    })
    setEditMode(true)
    setSelectedPlayerId(null)
  }

  const cancelEditMode = () => {
    setEditMode(false)
    setEditDraft(null)
    setSelectedPlayerId(null)
  }

  const saveEditMode = () => {
    if (!editDraft) return
    setMatchupState(editDraft)
    setRoundHistory([])
    setDeferredPlayerIds([])
    setEditMode(false)
    setEditDraft(null)
    setSelectedPlayerId(null)
  }

  const handleEditTap = (playerId: string) => {
    if (!editDraft) return

    if (!selectedPlayerId) {
      setSelectedPlayerId(playerId)
      return
    }

    if (selectedPlayerId === playerId) {
      setSelectedPlayerId(null)
      return
    }

    // Swap the two players in the draft
    const swap = (id: string) => (id === selectedPlayerId ? playerId : id === playerId ? selectedPlayerId : id)

    setEditDraft({
      games: editDraft.games.map(game => ({
        ...game,
        team1: game.team1.map(swap) as [string, string],
        team2: game.team2.map(swap) as [string, string],
      })),
      sittingOut: editDraft.sittingOut.map(swap),
    })
    setSelectedPlayerId(null)
  }

  const displayState = editMode && editDraft ? editDraft : session.matchupState

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

      {!editMode && (
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
      )}

      {displayState && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Round {session.roundHistory.length + 1}
            </h3>
            {!editMode ? (
              <button
                onClick={enterEditMode}
                className="text-xs text-blue-600 dark:text-blue-400 font-medium px-2 py-1 min-h-[28px]"
              >
                Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={cancelEditMode}
                  className="text-xs text-gray-500 dark:text-gray-400 font-medium px-2 py-1 min-h-[28px]"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEditMode}
                  className="text-xs text-blue-600 dark:text-blue-400 font-medium px-2 py-1 min-h-[28px]"
                >
                  Save
                </button>
              </div>
            )}
          </div>

          {displayState.games.map(game => (
            <div key={game.court} className={`bg-white dark:bg-gray-900 rounded-lg border p-4 ${
              editMode
                ? 'border-dashed border-blue-400 dark:border-blue-500'
                : 'border-gray-200 dark:border-gray-700'
            }`}>
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2">Court {game.court}</p>
              <div className="flex items-center justify-between">
                <div className="text-center flex-1 space-y-1">
                  {game.team1.map(id => (
                    <div key={id} className="flex items-center justify-center gap-1">
                      {editMode ? (
                        <button
                          onClick={() => handleEditTap(id)}
                          className={`font-medium px-2 py-0.5 rounded ${
                            selectedPlayerId === id
                              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 ring-2 ring-blue-400'
                              : 'text-gray-900 dark:text-gray-50'
                          }`}
                        >
                          {getName(id)}
                        </button>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <span className="text-gray-400 dark:text-gray-500 font-bold px-3">vs</span>
                <div className="text-center flex-1 space-y-1">
                  {game.team2.map(id => (
                    <div key={id} className="flex items-center justify-center gap-1">
                      {editMode ? (
                        <button
                          onClick={() => handleEditTap(id)}
                          className={`font-medium px-2 py-0.5 rounded ${
                            selectedPlayerId === id
                              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 ring-2 ring-blue-400'
                              : 'text-gray-900 dark:text-gray-50'
                          }`}
                        >
                          {getName(id)}
                        </button>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {!editMode && session.playSystem !== 'round-robin' && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => rotateSingleCourt(game.court)}
                    className="flex-1 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 py-1.5 text-xs font-medium min-h-[32px]"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => rerollSingleCourt(game.court)}
                    className="rounded-md bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-3 py-1.5 text-xs font-medium min-h-[32px]"
                  >
                    Re-roll
                  </button>
                </div>
              )}
            </div>
          ))}

          {displayState.sittingOut.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">Sitting Out</p>
              <div className="flex flex-wrap gap-1">
                {displayState.sittingOut.map(id => (
                  editMode ? (
                    <button
                      key={id}
                      onClick={() => handleEditTap(id)}
                      className={`text-sm px-2 py-0.5 rounded ${
                        selectedPlayerId === id
                          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 ring-2 ring-blue-400'
                          : 'text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {getName(id)}
                    </button>
                  ) : (
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
                  )
                ))}
              </div>
            </div>
          )}

          {!editMode && session.playSystem === 'challenge-court' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-3 space-y-3">
              <p className="text-xs font-medium text-blue-800 dark:text-blue-200">Winners stay on court?</p>
              {session.matchupState!.games.map(game => {
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
