import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionsProvider } from '../SessionsContext'
import { SessionProvider, useSession } from '../SessionContext'
import { createNewSession } from '../../utils/sessionOps'
import { saveSessions } from '../../utils/storage'

function seedSession() {
  const session = createNewSession({
    date: '2026-07-18', venue: 'BGC', numCourts: 2,
    courtAmount: null, playSystem: 'paddle-queue', playerNames: ['Alice', 'Ben'],
  })
  saveSessions([session])
  return session
}

function TestConsumer() {
  const { session, readOnly, checkIn, checkOut } = useSession()
  const alice = session.players[0]
  return (
    <div>
      <span data-testid="checked-in">{session.players.filter(p => p.checkedIn).length}</span>
      <span data-testid="participated">{session.players.filter(p => p.participated).length}</span>
      <span data-testid="read-only">{String(readOnly)}</span>
      <button onClick={() => checkIn(alice.id)}>Check In</button>
      <button onClick={() => checkOut(alice.id)}>Check Out</button>
    </div>
  )
}

describe('SessionContext', () => {
  beforeEach(() => localStorage.clear())

  it('binds to the given session and toggles check-in with sticky participation', async () => {
    const session = seedSession()
    const user = userEvent.setup()
    render(
      <SessionsProvider>
        <SessionProvider sessionId={session.id}>
          <TestConsumer />
        </SessionProvider>
      </SessionsProvider>
    )
    expect(screen.getByTestId('read-only')).toHaveTextContent('false')
    expect(screen.getByTestId('checked-in')).toHaveTextContent('0')
    await user.click(screen.getByText('Check In'))
    expect(screen.getByTestId('checked-in')).toHaveTextContent('1')
    expect(screen.getByTestId('participated')).toHaveTextContent('1')
    await user.click(screen.getByText('Check Out'))
    expect(screen.getByTestId('checked-in')).toHaveTextContent('0')
    expect(screen.getByTestId('participated')).toHaveTextContent('1')
  })

  it('reports readOnly for an ended session', () => {
    const session = seedSession()
    saveSessions([{ ...session, status: 'ended' }])
    render(
      <SessionsProvider>
        <SessionProvider sessionId={session.id}>
          <TestConsumer />
        </SessionProvider>
      </SessionsProvider>
    )
    expect(screen.getByTestId('read-only')).toHaveTextContent('true')
  })

  it('renders nothing for an unknown session id', () => {
    render(
      <SessionsProvider>
        <SessionProvider sessionId="nope">
          <TestConsumer />
        </SessionProvider>
      </SessionsProvider>
    )
    expect(screen.queryByTestId('checked-in')).toBeNull()
  })
})
