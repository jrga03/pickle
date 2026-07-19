import { useState } from 'react'
import { useSessions } from '../context/SessionsContext'
import { useSession } from '../context/SessionContext'
import { calculateFlatSplit, formatExpenseText } from '../utils/expenses'
import { updateSessionFields } from '../utils/sessionOps'
import { Modal } from './Modal'

export function ExpensesModal({ onClose }: { onClose: () => void }) {
  const { updateSession } = useSessions()
  const { session } = useSession()
  const [copied, setCopied] = useState(false)
  const [amountInput, setAmountInput] = useState(
    session.courtAmount != null ? String(session.courtAmount) : '',
  )
  const { total, participants, perHead } = calculateFlatSplit(session)

  const handleAmountChange = (value: string) => {
    setAmountInput(value)
    updateSession(session.id, s =>
      updateSessionFields(s, { courtAmount: value.trim() ? Number(value) : null }))
  }

  const handleShare = async () => {
    const text = formatExpenseText(session)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      if (navigator.share) {
        await navigator.share({ text })
      }
    }
  }

  return (
    <Modal title="Expenses" onClose={onClose}>
      <label className="block">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Court Amount</span>
        <input
          type="number"
          aria-label="Court Amount"
          value={amountInput}
          onChange={e => handleAmountChange(e.target.value)}
          placeholder="e.g. 2000"
          autoFocus={session.courtAmount == null}
          className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-base bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50"
        />
      </label>

      {participants.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
          No one has checked in yet.
        </p>
      ) : total === null || perHead === null ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
          Enter the court amount to see the split.
        </p>
      ) : (
        <>
          <div className="bg-green-50 dark:bg-gray-800 rounded-lg border border-green-200 dark:border-gray-700 p-4 text-center">
            <p className="text-2xl font-bold text-green-800 dark:text-green-300">
              {perHead.toFixed(2)} each
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              {participants.length} player{participants.length !== 1 ? 's' : ''} · Total {total.toFixed(2)}
            </p>
          </div>
          <ul className="space-y-1">
            {participants.map(p => (
              <li
                key={p.id}
                className="flex justify-between text-sm text-gray-700 dark:text-gray-200 px-1 py-1.5"
              >
                <span>{p.name}</span>
                <span className="font-medium">{perHead.toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={handleShare}
            className="w-full rounded-lg bg-green-600 dark:bg-green-700 text-white py-3 text-sm font-medium min-h-[48px]"
          >
            {copied ? 'Copied to clipboard!' : 'Share Expenses'}
          </button>
        </>
      )}
    </Modal>
  )
}
