import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionsProvider, useSessions } from '../SessionsContext'

function TestConsumer() {
  const { sessions, createSession, endSession, reopenSession, deleteSession } = useSessions()
  const first = sessions[0]
  return (
    <div>
      <span data-testid="count">{sessions.length}</span>
      <span data-testid="first-status">{first?.status ?? 'none'}</span>
      <button onClick={() => createSession({
        date: '2026-07-18', venue: 'BGC', numCourts: 2,
        courtAmount: 2000, playSystem: 'paddle-queue', playerNames: ['Alice'],
      })}>Create</button>
      <button onClick={() => first && endSession(first.id)}>End</button>
      <button onClick={() => first && reopenSession(first.id)}>Reopen</button>
      <button onClick={() => first && deleteSession(first.id)}>Delete</button>
    </div>
  )
}

const setup = () => render(<SessionsProvider><TestConsumer /></SessionsProvider>)

describe('SessionsContext', () => {
  beforeEach(() => localStorage.clear())

  it('starts empty and creates sessions (newest first)', async () => {
    const user = userEvent.setup()
    setup()
    expect(screen.getByTestId('count')).toHaveTextContent('0')
    await user.click(screen.getByText('Create'))
    expect(screen.getByTestId('count')).toHaveTextContent('1')
    expect(screen.getByTestId('first-status')).toHaveTextContent('active')
  })

  it('ends, reopens, and deletes a session', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('Create'))
    await user.click(screen.getByText('End'))
    expect(screen.getByTestId('first-status')).toHaveTextContent('ended')
    await user.click(screen.getByText('Reopen'))
    expect(screen.getByTestId('first-status')).toHaveTextContent('active')
    await user.click(screen.getByText('Delete'))
    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('persists to localStorage', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('Create'))
    const stored = JSON.parse(localStorage.getItem('pickleball-sessions')!)
    expect(stored).toHaveLength(1)
    expect(stored[0].venue).toBe('BGC')
  })
})
