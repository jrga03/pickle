import { useState } from 'react'
import type { PlaySystem, SavedPlayer, SavedVenue, Session } from '../types'
import { useSessions } from '../context/SessionsContext'
import { addRosterPlayer, removeRosterPlayer, updateSessionFields, localToday } from '../utils/sessionOps'
import { loadVenues, saveVenues, loadPlayers, savePlayers } from '../utils/storage'
import { Autocomplete } from './Autocomplete'
import { Modal } from './Modal'

const systemLabels: Record<PlaySystem, string> = {
  'paddle-queue': 'Paddle Queue',
  'challenge-court': 'Challenge Court',
  'round-robin': 'Round Robin',
}

const COURTS_MIN = 1
const COURTS_MAX = 20

const clampCourts = (n: number) =>
  Math.min(COURTS_MAX, Math.max(COURTS_MIN, n))

const sanitizeInteger = (raw: string) => raw.replace(/\D/g, '')

// digits and at most one decimal point; minus can never enter
const sanitizeAmount = (raw: string) => {
  const cleaned = raw.replace(/[^0-9.]/g, '')
  const [head, ...rest] = cleaned.split('.')
  return rest.length ? `${head}.${rest.join('')}` : head
}

interface RosterDraftEntry {
  id: string | null // null = not yet in the session (added on save)
  name: string
}

interface SessionModalProps {
  sessionId?: string
  onClose: () => void
  onCreated?: (session: Session) => void
}

export function SessionModal({ sessionId, onClose, onCreated }: SessionModalProps) {
  const { sessions, createSession, updateSession } = useSessions()
  const existing = sessionId ? sessions.find(s => s.id === sessionId) : undefined

  const [date, setDate] = useState(existing?.date ?? localToday())
  const [venue, setVenue] = useState(existing?.venue ?? '')
  const [courts, setCourts] = useState(String(existing?.numCourts ?? 1))
  const [amount, setAmount] = useState(existing?.courtAmount != null ? String(existing.courtAmount) : '')
  const [playSystem, setPlaySystem] = useState<PlaySystem>(existing?.playSystem ?? 'paddle-queue')
  const [roster, setRoster] = useState<RosterDraftEntry[]>(
    existing?.players.map(p => ({ id: p.id, name: p.name })) ?? [],
  )
  const [playerInput, setPlayerInput] = useState('')
  const [savedVenues, setSavedVenues] = useState<SavedVenue[]>(() => loadVenues())
  const [savedPlayers, setSavedPlayers] = useState<SavedPlayer[]>(() => loadPlayers())

  const addToRoster = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (roster.some(r => r.name.toLowerCase() === trimmed.toLowerCase())) return
    setRoster(prev => [...prev, { id: null, name: trimmed }])
    if (!savedPlayers.some(sp => sp.name.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...savedPlayers, { id: crypto.randomUUID(), name: trimmed }]
      setSavedPlayers(updated)
      savePlayers(updated)
    }
    setPlayerInput('')
  }

  const handleSaveVenue = () => {
    const trimmed = venue.trim()
    if (!trimmed) return
    if (savedVenues.some(v => v.name.toLowerCase() === trimmed.toLowerCase())) return
    const updated = [...savedVenues, { id: crypto.randomUUID(), name: trimmed }]
    setSavedVenues(updated)
    saveVenues(updated)
  }

  const handleDeleteVenue = (id: string) => {
    const updated = savedVenues.filter(v => v.id !== id)
    setSavedVenues(updated)
    saveVenues(updated)
  }

  const handleDeleteSavedPlayer = (id: string) => {
    const updated = savedPlayers.filter(sp => sp.id !== id)
    setSavedPlayers(updated)
    savePlayers(updated)
  }

  const handleSave = () => {
    const parsedAmount = Number(amount)
    const fields = {
      date,
      venue,
      numCourts: clampCourts(Number(courts) || COURTS_MIN),
      courtAmount:
        amount.trim() && Number.isFinite(parsedAmount)
          ? Math.max(0, parsedAmount)
          : null,
      playSystem,
    }
    if (!existing) {
      const created = createSession({ ...fields, playerNames: roster.map(r => r.name) })
      onCreated?.(created)
    } else {
      updateSession(existing.id, s => {
        let next = updateSessionFields(s, fields)
        const keptIds = new Set(roster.filter(r => r.id !== null).map(r => r.id!))
        for (const p of s.players) {
          if (!keptIds.has(p.id)) next = removeRosterPlayer(next, p.id)
        }
        for (const r of roster) {
          if (r.id === null) next = addRosterPlayer(next, r.name)
        }
        return next
      })
    }
    onClose()
  }

  return (
    <Modal title={existing ? 'Edit Session' : 'New Session'} onClose={onClose}>
      <label className="block">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Date</span>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="mt-1 block w-full min-w-0 max-w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-base bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50"
        />
      </label>

      <div className="block">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Venue (optional)</span>
        <div className="mt-1 flex gap-2">
          <Autocomplete
            suggestions={savedVenues.map(v => ({ id: v.id, label: v.name }))}
            onSelect={item => setVenue(item.label)}
            onSubmit={val => setVenue(val)}
            onDelete={handleDeleteVenue}
            placeholder="e.g. BGC Courts"
            value={venue}
            onChange={setVenue}
          />
          <button
            onClick={handleSaveVenue}
            disabled={!venue.trim()}
            className="rounded-lg border border-green-600 dark:border-green-700 text-green-600 dark:text-green-400 px-3 py-2.5 text-sm font-medium disabled:opacity-50 min-h-[44px]"
          >
            Save
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <label className="block flex-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Courts</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label="Courts"
            value={courts}
            onChange={e => setCourts(sanitizeInteger(e.target.value))}
            onBlur={() => {
              if (courts) setCourts(String(clampCourts(Number(courts))))
            }}
            className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-base bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50"
          />
        </label>
        <label className="block flex-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Total amount (optional)</span>
          <input
            type="text"
            inputMode="decimal"
            aria-label="Total Amount"
            value={amount}
            onChange={e => setAmount(sanitizeAmount(e.target.value))}
            placeholder="e.g. 2000"
            className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-base bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50"
          />
        </label>
      </div>

      <div className="block">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Play System</span>
        <div className="mt-1 flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {(Object.entries(systemLabels) as [PlaySystem, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPlaySystem(key)}
              className={`flex-1 rounded-md py-2 text-xs font-medium min-h-[40px] ${
                playSystem === key
                  ? 'bg-white dark:bg-gray-900 text-green-700 dark:text-green-300 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="block space-y-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Players</span>
        <div className="flex gap-2">
          <Autocomplete
            suggestions={savedPlayers
              .filter(sp => !roster.some(r => r.name.toLowerCase() === sp.name.toLowerCase()))
              .map(sp => ({ id: sp.id, label: sp.name }))}
            onSelect={item => addToRoster(item.label)}
            onSubmit={addToRoster}
            onDelete={handleDeleteSavedPlayer}
            placeholder="Player name"
            value={playerInput}
            onChange={setPlayerInput}
          />
          <button
            onClick={() => addToRoster(playerInput)}
            disabled={!playerInput.trim()}
            className="rounded-lg bg-green-600 dark:bg-green-700 text-white px-4 py-2.5 text-sm font-medium disabled:opacity-50 min-h-[44px]"
          >
            Add
          </button>
        </div>
        <ul className="space-y-1">
          {roster.map(entry => (
            <li
              key={entry.id ?? entry.name}
              className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2"
            >
              <span className="text-sm text-gray-900 dark:text-gray-50">{entry.name}</span>
              <button
                onClick={() => setRoster(prev => prev.filter(r => r !== entry))}
                className="text-red-500 dark:text-red-400 p-1 min-h-[36px] min-w-[36px]"
                aria-label={`Remove ${entry.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={handleSave}
        disabled={!date}
        className="w-full rounded-lg bg-green-600 dark:bg-green-700 text-white py-3 text-sm font-medium disabled:opacity-50 min-h-[48px]"
      >
        {existing ? 'Save Changes' : 'Create Session'}
      </button>
    </Modal>
  )
}
