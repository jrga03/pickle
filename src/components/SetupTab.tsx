import { useState } from 'react'
import { useSession } from '../context/SessionContext'

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
        <h2 className="text-lg font-semibold text-gray-900">Session Details</h2>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Date</span>
          <input
            type="date"
            value={session.date}
            onChange={e => setDate(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Venue (optional)</span>
          <input
            type="text"
            value={session.venue}
            onChange={e => setVenue(e.target.value)}
            placeholder="e.g. BGC Courts"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Default Rate per Court (PHP)</span>
          <input
            type="number"
            value={session.defaultRate || ''}
            onChange={e => setDefaultRate(Number(e.target.value))}
            placeholder="e.g. 500"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base"
          />
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Time Slots</h2>

        {session.timeSlots.length === 0 && (
          <p className="text-sm text-gray-500">No time slots yet. Add one below.</p>
        )}

        {session.timeSlots.map(slot => (
          <div key={slot.id} className="flex items-center gap-2 rounded-lg bg-white border border-gray-200 p-3">
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <input
                  type="time"
                  value={slot.startTime}
                  onChange={e => updateTimeSlot(slot.id, { startTime: e.target.value })}
                  className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
                <span className="self-center text-gray-400">–</span>
                <input
                  type="time"
                  value={slot.endTime}
                  onChange={e => updateTimeSlot(slot.id, { endTime: e.target.value })}
                  className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <label className="flex items-center gap-1 text-sm text-gray-600">
                  Courts:
                  <input
                    type="number"
                    min={1}
                    value={slot.numCourts}
                    onChange={e => updateTimeSlot(slot.id, { numCourts: Number(e.target.value) })}
                    className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="flex items-center gap-1 text-sm text-gray-600">
                  Rate:
                  <input
                    type="number"
                    value={slot.rateOverride ?? ''}
                    onChange={e => updateTimeSlot(slot.id, {
                      rateOverride: e.target.value ? Number(e.target.value) : undefined,
                    })}
                    placeholder="default"
                    className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </label>
              </div>
            </div>
            <button
              onClick={() => removeTimeSlot(slot.id)}
              className="self-start text-red-500 hover:text-red-700 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Remove time slot"
            >
              ✕
            </button>
          </div>
        ))}

        <div className="rounded-lg bg-green-50 border border-green-200 p-3 space-y-2">
          <p className="text-sm font-medium text-green-800">Add Time Slot</p>
          <div className="flex gap-2">
            <input
              type="time"
              value={newSlot.startTime}
              onChange={e => setNewSlot(s => ({ ...s, startTime: e.target.value }))}
              className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
            <span className="self-center text-gray-400">–</span>
            <input
              type="time"
              value={newSlot.endTime}
              onChange={e => setNewSlot(s => ({ ...s, endTime: e.target.value }))}
              className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <label className="flex items-center gap-1 text-sm text-gray-600">
              Courts:
              <input
                type="number"
                min={1}
                value={newSlot.numCourts}
                onChange={e => setNewSlot(s => ({ ...s, numCourts: Number(e.target.value) }))}
                className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
            <label className="flex items-center gap-1 text-sm text-gray-600">
              Rate:
              <input
                type="number"
                value={newSlot.rateOverride}
                onChange={e => setNewSlot(s => ({ ...s, rateOverride: e.target.value }))}
                placeholder="default"
                className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
          </div>
          <button
            onClick={handleAddSlot}
            disabled={!newSlot.startTime || !newSlot.endTime}
            className="w-full rounded-lg bg-green-600 text-white py-2.5 text-sm font-medium disabled:opacity-50 min-h-[44px]"
          >
            Add Slot
          </button>
        </div>
      </section>
    </div>
  )
}
