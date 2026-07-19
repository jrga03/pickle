import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionsProvider, useSessions } from '../../context/SessionsContext'
import { SessionModal } from '../SessionModal'
import { createNewSession } from '../../utils/sessionOps'
import { saveSessions } from '../../utils/storage'

function Probe() {
  const { sessions } = useSessions()
  return (
    <div>
      <span data-testid="count">{sessions.length}</span>
      <span data-testid="names">{sessions[0]?.players.map(p => p.name).join(',') ?? ''}</span>
      <span data-testid="courts">{sessions[0]?.numCourts ?? ''}</span>
    </div>
  )
}

describe('SessionModal', () => {
  beforeEach(() => localStorage.clear())

  it('creates a session with roster and fields', async () => {
    const user = userEvent.setup()
    render(
      <SessionsProvider>
        <SessionModal onClose={() => {}} />
        <Probe />
      </SessionsProvider>
    )
    await user.type(screen.getByPlaceholderText('Player name'), 'Alice')
    await user.click(screen.getByText('Add'))
    await user.type(screen.getByPlaceholderText('Player name'), 'Ben')
    await user.click(screen.getByText('Add'))
    await user.click(screen.getByText('Create Session'))
    expect(screen.getByTestId('count')).toHaveTextContent('1')
    expect(screen.getByTestId('names')).toHaveTextContent('Alice,Ben')
  })

  it('edits fields and removes a rostered player', async () => {
    const session = createNewSession({
      date: '2026-07-18', venue: 'BGC', numCourts: 1,
      courtAmount: null, playSystem: 'paddle-queue', playerNames: ['Alice', 'Ben'],
    })
    saveSessions([session])
    const user = userEvent.setup()
    render(
      <SessionsProvider>
        <SessionModal sessionId={session.id} onClose={() => {}} />
        <Probe />
      </SessionsProvider>
    )
    const courts = screen.getByLabelText('Courts')
    await user.clear(courts)
    await user.type(courts, '3')
    await user.click(screen.getByLabelText('Remove Ben'))
    await user.click(screen.getByText('Save Changes'))
    expect(screen.getByTestId('courts')).toHaveTextContent('3')
    expect(screen.getByTestId('names')).toHaveTextContent('Alice')
  })
})
