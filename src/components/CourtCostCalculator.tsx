import { useState } from 'react'
import type { CalculatorRow, CalculatorState } from '../types'
import { loadCalculator, saveCalculator } from '../utils/storage'
import { Modal } from './Modal'

function newRow(): CalculatorRow {
  return { id: crypto.randomUUID(), hours: '', courts: '', rate: '' }
}

export function CourtCostCalculator({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<CalculatorState>(() => {
    const loaded = loadCalculator()
    return loaded.rows.length > 0 ? loaded : { ...loaded, rows: [newRow()] }
  })

  const update = (next: CalculatorState) => {
    setState(next)
    saveCalculator(next)
  }

  const setRow = (id: string, patch: Partial<CalculatorRow>) =>
    update({ ...state, rows: state.rows.map(r => (r.id === id ? { ...r, ...patch } : r)) })

  const subtotal = (row: CalculatorRow): number => {
    const hours = Number(row.hours) || 0
    const courts = Number(row.courts) || 0
    const rate = row.rate.trim() !== '' ? Number(row.rate) || 0 : Number(state.defaultRate) || 0
    return hours * courts * rate
  }

  const total = state.rows.reduce((sum, row) => sum + subtotal(row), 0)

  const inputClasses = 'mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-base bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50'

  return (
    <Modal title="Court Cost Calculator" onClose={onClose}>
      <label className="block">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Default hourly rate</span>
        <input
          type="number"
          aria-label="Default hourly rate"
          value={state.defaultRate}
          onChange={e => update({ ...state, defaultRate: e.target.value })}
          placeholder="e.g. 350"
          className={inputClasses}
        />
      </label>

      {state.rows.map(row => (
        <div key={row.id} className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 space-y-2">
          <div className="flex gap-2">
            <label className="block flex-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Hours</span>
              <input type="number" aria-label="Hours" value={row.hours}
                onChange={e => setRow(row.id, { hours: e.target.value })} className={inputClasses} />
            </label>
            <label className="block flex-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Courts</span>
              <input type="number" aria-label="Courts" value={row.courts}
                onChange={e => setRow(row.id, { courts: e.target.value })} className={inputClasses} />
            </label>
            <label className="block flex-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Rate override</span>
              <input type="number" aria-label="Rate override" value={row.rate}
                onChange={e => setRow(row.id, { rate: e.target.value })} className={inputClasses} />
            </label>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">Subtotal: {subtotal(row).toFixed(2)}</p>
            <button
              onClick={() => update({ ...state, rows: state.rows.filter(r => r.id !== row.id) })}
              aria-label="Remove row"
              className="text-red-500 dark:text-red-400 text-sm px-2 min-h-[36px]"
            >
              Remove row
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={() => update({ ...state, rows: [...state.rows, newRow()] })}
        className="w-full rounded-lg border border-green-600 dark:border-green-700 text-green-600 dark:text-green-400 py-2.5 text-sm font-medium min-h-[44px]"
      >
        + Add row
      </button>

      <p className="text-base font-semibold text-gray-900 dark:text-gray-50 text-right">
        Total: {total.toFixed(2)}
      </p>
    </Modal>
  )
}
