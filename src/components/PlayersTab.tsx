import { useState } from 'react'
import { useSession } from '../context/SessionContext'
import type { PlayerStatus } from '../types'

const statusColors: Record<PlayerStatus, string> = {
  active: 'bg-green-100 text-green-800',
  deferred: 'bg-yellow-100 text-yellow-800',
  left: 'bg-gray-100 text-gray-600',
}

const nextStatus: Record<PlayerStatus, PlayerStatus> = {
  active: 'deferred',
  deferred: 'left',
  left: 'active',
}

export function PlayersTab() {
  const {
    session,
    addPlayer,
    removePlayer,
    updatePlayerStatus,
    updatePlayerArrival,
  } = useSession()

  const [name, setName] = useState('')

  const handleAdd = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    addPlayer(trimmed)
    setName('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
  }

  const slotPlayerCounts = session.timeSlots.map(slot => {
    const count = session.players.filter(p => p.arrivalSlotId === slot.id).length
    return { slot, count }
  })

  return (
    <div className="space-y-4">
      {session.timeSlots.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {slotPlayerCounts.map(({ slot, count }) => (
            <span key={slot.id} className="text-xs bg-gray-100 rounded-full px-3 py-1 text-gray-600">
              {slot.startTime}–{slot.endTime}: {count} player{count !== 1 ? 's' : ''}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Player name"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-base"
        />
        <button
          onClick={handleAdd}
          disabled={!name.trim()}
          className="rounded-lg bg-green-600 text-white px-4 py-2.5 text-sm font-medium disabled:opacity-50 min-h-[44px]"
        >
          Add
        </button>
      </div>

      {session.players.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-8">
          No players yet. Add players above.
        </p>
      )}

      <ul className="space-y-2">
        {session.players.map(player => (
          <li key={player.id} className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{player.name}</p>
              {session.timeSlots.length > 0 && (
                <select
                  value={player.arrivalSlotId}
                  onChange={e => updatePlayerArrival(player.id, e.target.value)}
                  className="mt-1 text-xs rounded border border-gray-200 px-1 py-0.5 text-gray-600"
                >
                  {session.timeSlots.map(slot => (
                    <option key={slot.id} value={slot.id}>
                      {slot.startTime}–{slot.endTime}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              onClick={() => updatePlayerStatus(player.id, nextStatus[player.status])}
              className={`rounded-full px-3 py-1 text-xs font-medium min-h-[32px] ${statusColors[player.status]}`}
            >
              {player.status}
            </button>

            <button
              onClick={() => removePlayer(player.id)}
              className="text-red-500 hover:text-red-700 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={`Remove ${player.name}`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
