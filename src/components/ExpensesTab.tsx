import { useState, useMemo } from 'react'
import { useSession } from '../context/SessionContext'
import { calculateExpenses, formatExpenseText } from '../utils/expenses'

export function ExpensesTab() {
  const { session } = useSession()
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const expenses = useMemo(
    () => calculateExpenses(session.timeSlots, session.players, session.defaultRate),
    [session.timeSlots, session.players, session.defaultRate],
  )

  const totalCost = useMemo(
    () => expenses.reduce((sum, e) => sum + e.total, 0),
    [expenses],
  )

  const handleShare = async () => {
    const text = formatExpenseText(expenses, session)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: try share API
      if (navigator.share) {
        await navigator.share({ text })
      }
    }
  }

  if (session.players.length === 0 || session.timeSlots.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-500">
          Add time slots and players to see expense breakdown.
        </p>
      </div>
    )
  }

  const sorted = [...expenses].sort((a, b) => a.playerName.localeCompare(b.playerName))

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-green-50 rounded-lg border border-green-200 p-4 text-center">
        <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Total Session Cost</p>
        <p className="text-2xl font-bold text-green-800 mt-1">
          {totalCost.toFixed(2)}
        </p>
      </div>

      <div className="space-y-2">
        {sorted.map(expense => (
          <div key={expense.playerId} className="bg-white rounded-lg border border-gray-200">
            <button
              onClick={() => setExpandedPlayer(
                expandedPlayer === expense.playerId ? null : expense.playerId,
              )}
              className="w-full flex items-center justify-between px-4 py-3 min-h-[48px]"
            >
              <span className="font-medium text-gray-900">{expense.playerName}</span>
              <span className="font-semibold text-gray-700">
                {expense.total.toFixed(2)}
                <span className="text-xs text-gray-400 ml-1">
                  {expandedPlayer === expense.playerId ? '▲' : '▼'}
                </span>
              </span>
            </button>

            {expandedPlayer === expense.playerId && (
              <div className="border-t border-gray-100 px-4 pb-3 pt-2 space-y-1">
                {expense.slotBreakdown.map(slot => (
                  <div key={slot.slotId} className="flex justify-between text-sm text-gray-500">
                    <span>{slot.slotLabel} ({slot.playerCount} players)</span>
                    <span>{slot.share.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="fixed bottom-16 left-0 right-0 p-4 bg-gray-50">
        <button
          onClick={handleShare}
          className="w-full rounded-lg bg-green-600 text-white py-3 text-sm font-medium min-h-[48px]"
        >
          {copied ? 'Copied to clipboard!' : 'Share Expenses'}
        </button>
      </div>
    </div>
  )
}
