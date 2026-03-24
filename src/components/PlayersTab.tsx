import { useState } from 'react'
import { useSession } from '../context/SessionContext'
import { formatHour } from './SetupTab'
import { parseHour } from '../utils/expenses'
import { Autocomplete } from './Autocomplete'
import { loadPlayers, savePlayers } from '../utils/storage'
import type { SavedPlayer } from '../types'

function toTimeStr(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

export function PlayersTab() {
  const {
    session,
    addPlayer,
    removePlayer,
    updatePlayerSchedule,
  } = useSession()

  const [savedPlayers, setSavedPlayers] = useState<SavedPlayer[]>(() => loadPlayers())
  const [playerInput, setPlayerInput] = useState('')

  const availableSuggestions = savedPlayers
    .filter(sp => !session.players.some(
      p => p.name.toLowerCase() === sp.name.toLowerCase()
    ))
    .map(sp => ({ id: sp.id, label: sp.name }))

  const handleSelectPlayer = (item: { id: string; label: string }) => {
    addPlayer(item.label)
    setPlayerInput('')
  }

  const handleSubmitPlayer = (value: string) => {
    addPlayer(value)
    if (!savedPlayers.some(sp => sp.name.toLowerCase() === value.toLowerCase())) {
      const updated = [...savedPlayers, { id: crypto.randomUUID(), name: value }]
      setSavedPlayers(updated)
      savePlayers(updated)
    }
    setPlayerInput('')
  }

  const handleDeleteSavedPlayer = (id: string) => {
    const updated = savedPlayers.filter(sp => sp.id !== id)
    setSavedPlayers(updated)
    savePlayers(updated)
  }

  const slots = session.timeSlots
  // Compute session hour range from all time slots
  const sessionStartH = slots.length > 0
    ? Math.min(...slots.map(s => parseHour(s.startTime)))
    : 0
  const sessionEndH = slots.length > 0
    ? Math.max(...slots.map(s => parseHour(s.endTime)))
    : 0

  // Generate all hours within session range for arrival/departure pickers
  const sessionHours: { value: string; label: string }[] = []
  for (let h = sessionStartH; h <= sessionEndH; h++) {
    sessionHours.push({ value: toTimeStr(h), label: formatHour(toTimeStr(h)) })
  }

  // Count players present per slot
  const slotPlayerCounts = slots.map(slot => {
    const count = session.players.filter(p =>
      p.arrivalTime <= slot.startTime && p.departureTime >= slot.endTime
    ).length
    return { slot, count }
  })

  return (
    <div className="space-y-4">
      {slots.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {slotPlayerCounts.map(({ slot, count }) => (
            <span key={slot.id} className="text-xs bg-gray-100 rounded-full px-3 py-1 text-gray-600">
              {formatHour(slot.startTime)}–{formatHour(slot.endTime)}: {count} player{count !== 1 ? 's' : ''}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Autocomplete
          suggestions={availableSuggestions}
          onSelect={handleSelectPlayer}
          onSubmit={handleSubmitPlayer}
          onDelete={handleDeleteSavedPlayer}
          placeholder="Player name"
          value={playerInput}
          onChange={setPlayerInput}
        />
        <button
          onClick={() => {
            if (playerInput.trim()) handleSubmitPlayer(playerInput.trim())
          }}
          disabled={!playerInput.trim()}
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
              {sessionHours.length > 1 && (
                <div className="mt-1 flex items-center gap-1">
                  <select
                    value={player.arrivalTime}
                    onChange={e => updatePlayerSchedule(player.id, e.target.value, player.departureTime)}
                    className="text-xs rounded border border-gray-200 px-1 py-0.5 text-gray-600"
                  >
                    {sessionHours
                      .filter(h => h.value < player.departureTime)
                      .map(h => (
                        <option key={h.value} value={h.value}>{h.label}</option>
                      ))}
                  </select>
                  <span className="text-xs text-gray-400">–</span>
                  <select
                    value={player.departureTime}
                    onChange={e => updatePlayerSchedule(player.id, player.arrivalTime, e.target.value)}
                    className="text-xs rounded border border-gray-200 px-1 py-0.5 text-gray-600"
                  >
                    {sessionHours
                      .filter(h => h.value > player.arrivalTime)
                      .map(h => (
                        <option key={h.value} value={h.value}>{h.label}</option>
                      ))}
                  </select>
                </div>
              )}
            </div>

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
