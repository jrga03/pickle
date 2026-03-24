import { useState } from 'react'
import { useSession } from '../context/SessionContext'
import { Autocomplete } from './Autocomplete'
import { loadVenues, saveVenues } from '../utils/storage'
import type { SavedVenue } from '../types'

const hours = Array.from({ length: 18 }, (_, i) => {
  const h = i + 6 // 6 AM to 11 PM
  const value = `${String(h).padStart(2, '0')}:00`
  const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
  return { value, label }
})

export function formatHour(time: string): string {
  const h = parseInt(time.split(':')[0], 10)
  if (isNaN(h)) return time
  return h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
}

export function SetupTab() {
  const {
    session,
    setDate,
    setVenue,
    setDefaultRate,
    addTimeSlot,
    removeTimeSlot,
    updateTimeSlot,
  } = useSession()

  const [savedVenues, setSavedVenues] = useState<SavedVenue[]>(() => loadVenues())

  const handleSelectVenue = (item: { id: string; label: string }) => {
    const venue = savedVenues.find(v => v.id === item.id)
    if (venue) {
      setVenue(venue.name)
      setDefaultRate(venue.defaultRate)
    }
  }

  const handleDeleteVenue = (id: string) => {
    const updated = savedVenues.filter(v => v.id !== id)
    setSavedVenues(updated)
    saveVenues(updated)
  }

  const handleSaveVenue = () => {
    if (!session.venue.trim()) return
    const existing = savedVenues.find(
      v => v.name.toLowerCase() === session.venue.toLowerCase()
    )
    let updated: SavedVenue[]
    if (existing) {
      updated = savedVenues.map(v =>
        v.id === existing.id ? { ...v, defaultRate: session.defaultRate } : v
      )
    } else {
      updated = [...savedVenues, {
        id: crypto.randomUUID(),
        name: session.venue,
        defaultRate: session.defaultRate,
      }]
    }
    setSavedVenues(updated)
    saveVenues(updated)
  }

  const [newSlot, setNewSlot] = useState({
    startTime: '',
    endTime: '',
    numCourts: 1,
    rateOverride: '',
  })

  const handleAddSlot = () => {
    if (!newSlot.startTime || !newSlot.endTime) return
    addTimeSlot(
      newSlot.startTime,
      newSlot.endTime,
      newSlot.numCourts,
      newSlot.rateOverride ? Number(newSlot.rateOverride) : undefined,
    )
    setNewSlot({ startTime: '', endTime: '', numCourts: 1, rateOverride: '' })
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Session Details</h2>

        <label className="block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Date</span>
          <input
            type="date"
            value={session.date}
            onChange={e => setDate(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-base bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50"
          />
        </label>

        <div className="block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Venue (optional)</span>
          <div className="mt-1 flex gap-2">
            <Autocomplete
              suggestions={savedVenues.map(v => ({ id: v.id, label: v.name }))}
              onSelect={handleSelectVenue}
              onSubmit={val => setVenue(val)}
              onDelete={handleDeleteVenue}
              placeholder="e.g. BGC Courts"
              value={session.venue}
              onChange={setVenue}
            />
            <button
              onClick={handleSaveVenue}
              disabled={!session.venue.trim()}
              className="rounded-lg border border-green-600 dark:border-green-700 text-green-600 dark:text-green-400 px-3 py-2.5 text-sm font-medium disabled:opacity-50 min-h-[44px]"
            >
              Save
            </button>
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Court Rate</span>
          <input
            type="number"
            value={session.defaultRate || ''}
            onChange={e => setDefaultRate(Number(e.target.value))}
            placeholder="e.g. 500"
            className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-base bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50"
          />
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Time Slots</h2>

        {session.timeSlots.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No time slots yet. Add one below.</p>
        )}

        {session.timeSlots.map(slot => (
          <div key={slot.id} className="flex items-center gap-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <select
                  value={slot.startTime}
                  onChange={e => updateTimeSlot(slot.id, { startTime: e.target.value })}
                  className="flex-1 rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50"
                >
                  <option value="">Start</option>
                  {hours.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                </select>
                <span className="self-center text-gray-400 dark:text-gray-500">–</span>
                <select
                  value={slot.endTime}
                  onChange={e => updateTimeSlot(slot.id, { endTime: e.target.value })}
                  className="flex-1 rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50"
                >
                  <option value="">End</option>
                  {hours.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                  Courts:
                  <input
                    type="number"
                    min={1}
                    value={slot.numCourts}
                    onChange={e => updateTimeSlot(slot.id, { numCourts: Number(e.target.value) })}
                    className="w-16 rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50"
                  />
                </label>
                <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                  Rate:
                  <input
                    type="number"
                    value={slot.rateOverride ?? ''}
                    onChange={e => updateTimeSlot(slot.id, {
                      rateOverride: e.target.value ? Number(e.target.value) : undefined,
                    })}
                    placeholder="default"
                    className="w-20 rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50"
                  />
                </label>
              </div>
            </div>
            <button
              onClick={() => removeTimeSlot(slot.id)}
              className="self-start text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Remove time slot"
            >
              ✕
            </button>
          </div>
        ))}

        <div className="rounded-lg bg-green-50 dark:bg-gray-900 border border-green-200 dark:border-gray-700 p-3 space-y-2">
          <p className="text-sm font-medium text-green-800 dark:text-green-300">Add Time Slot</p>
          <div className="flex gap-2">
            <select
              value={newSlot.startTime}
              onChange={e => setNewSlot(s => ({ ...s, startTime: e.target.value }))}
              className="flex-1 rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50"
            >
              <option value="">Start</option>
              {hours.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
            <span className="self-center text-gray-400 dark:text-gray-500">–</span>
            <select
              value={newSlot.endTime}
              onChange={e => setNewSlot(s => ({ ...s, endTime: e.target.value }))}
              className="flex-1 rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50"
            >
              <option value="">End</option>
              {hours.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
              Courts:
              <input
                type="number"
                min={1}
                value={newSlot.numCourts}
                onChange={e => setNewSlot(s => ({ ...s, numCourts: Number(e.target.value) }))}
                className="w-16 rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50"
              />
            </label>
            <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
              Rate:
              <input
                type="number"
                value={newSlot.rateOverride}
                onChange={e => setNewSlot(s => ({ ...s, rateOverride: e.target.value }))}
                placeholder="default"
                className="w-20 rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50"
              />
            </label>
          </div>
          <button
            onClick={handleAddSlot}
            disabled={!newSlot.startTime || !newSlot.endTime}
            className="w-full rounded-lg bg-green-600 dark:bg-green-700 text-white py-2.5 text-sm font-medium disabled:opacity-50 min-h-[44px]"
          >
            Add Slot
          </button>
        </div>
      </section>
    </div>
  )
}
