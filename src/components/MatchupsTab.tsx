import { useMemo, useRef } from 'react'
import { useSession } from '../context/SessionContext'
import type { PlaySystem } from '../types'
import { winStreak } from '../utils/stats'

const systemLabels: Record<PlaySystem, string> = {
  'paddle-queue': 'Paddle Queue',
  'challenge-court': 'Challenge Court',
  'round-robin': 'Round Robin',
}

const systemTaglines: Record<PlaySystem, string> = {
  'paddle-queue': 'Next in line plays next',
  'challenge-court': 'Winners stay, losers rotate',
  'round-robin': 'Everyone plays with everyone',
}

export function MatchupsTab() {
  const { session, readOnly, setPlaySystem, recordWin, cancelGame } = useSession()
  const topRef = useRef<HTMLDivElement>(null)

  const playerNameMap = new Map(session.players.map(p => [p.id, p.name]))
  const getName = (id: string) => playerNameMap.get(id) ?? id
  const teamNames = (team: [string, string]) => team.map(getName).join(' & ')

  const liveByCourt = new Map(session.liveGames.map(g => [g.court, g]))
  const courts = useMemo(() => {
    const set = new Set<number>()
    for (let c = 1; c <= session.numCourts; c++) set.add(c)
    for (const g of session.liveGames) set.add(g.court)
    return [...set].sort((a, b) => a - b)
  }, [session.numCourts, session.liveGames])

  const handleCancel = (court: number) => {
    if (window.confirm('Cancel this game? Nothing will be recorded.')) cancelGame(court)
  }

  const checkedInCount = session.players.filter(p => p.checkedIn).length

  return (
    <div ref={topRef} className="space-y-4">
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {(Object.entries(systemLabels) as [PlaySystem, string][]).map(([key, label]) => (
          <button
            key={key}
            disabled={readOnly}
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

      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
        {systemTaglines[session.playSystem]}
      </p>

      {checkedInCount < 4 && session.liveGames.length === 0 && (
        <p className="text-sm text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3">
          Need at least 4 checked-in players to fill a court. Currently: {checkedInCount}
        </p>
      )}

      <div className="space-y-3">
        {courts.map(court => {
          const game = liveByCourt.get(court)
          const holders = session.courtWinners[court]
          return (
            <div
              key={court}
              data-court={court}
              className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500">Court {court}</p>
                {game && !readOnly && (
                  <button
                    onClick={() => handleCancel(court)}
                    aria-label={`Cancel game on court ${court}`}
                    className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 px-2 min-h-[28px]"
                  >
                    ✕
                  </button>
                )}
              </div>

              {game ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-center flex-1 space-y-1">
                      {game.team1.map(id => (
                        <p key={id} className="font-medium text-gray-900 dark:text-gray-50">{getName(id)}</p>
                      ))}
                    </div>
                    <span className="text-gray-400 dark:text-gray-500 font-bold px-3">vs</span>
                    <div className="text-center flex-1 space-y-1">
                      {game.team2.map(id => (
                        <p key={id} className="font-medium text-gray-900 dark:text-gray-50">{getName(id)}</p>
                      ))}
                    </div>
                  </div>
                  {!readOnly && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <button
                        onClick={() => recordWin(court, 1)}
                        className="flex-1 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 py-2 text-xs font-medium min-h-[40px]"
                      >
                        Team 1 Wins
                      </button>
                      <button
                        onClick={() => recordWin(court, 2)}
                        className="flex-1 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 py-2 text-xs font-medium min-h-[40px]"
                      >
                        Team 2 Wins
                      </button>
                    </div>
                  )}
                </>
              ) : holders ? (
                <div className="text-center space-y-1 py-1">
                  <p className="font-medium text-gray-900 dark:text-gray-50">{teamNames(holders)}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-300">
                    {(() => {
                      const streak = winStreak(session.matchHistory, court, holders)
                      return `${streak} win${streak !== 1 ? 's' : ''} · awaiting challengers`
                    })()}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">Free</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
