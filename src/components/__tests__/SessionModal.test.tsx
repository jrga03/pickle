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
      <span data-testid="amount">{sessions[0]?.courtAmount ?? 'null'}</span>
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

  it('uses numeric keyboards for courts and amount', () => {
    render(
      <SessionsProvider>
        <SessionModal onClose={() => {}} />
      </SessionsProvider>
    )
    expect(screen.getByLabelText('Courts')).toHaveAttribute('inputmode', 'numeric')
    expect(screen.getByLabelText('Total Amount')).toHaveAttribute('inputmode', 'decimal')
  })

  it('keeps courts integer-only and clamps to 1–20 on blur', async () => {
    const user = userEvent.setup()
    render(
      <SessionsProvider>
        <SessionModal onClose={() => {}} />
      </SessionsProvider>
    )
    const courts = screen.getByLabelText('Courts')
    await user.clear(courts)
    await user.type(courts, '2.5')
    expect(courts).toHaveValue('25')
    await user.tab()
    expect(courts).toHaveValue('20')
    await user.clear(courts)
    await user.type(courts, '0')
    await user.tab()
    expect(courts).toHaveValue('1')
    await user.clear(courts)
    await user.tab()
    expect(courts).toHaveValue('')
  })

  it('strips negatives and extra dots from amount', async () => {
    const user = userEvent.setup()
    render(
      <SessionsProvider>
        <SessionModal onClose={() => {}} />
      </SessionsProvider>
    )
    const amount = screen.getByLabelText('Total Amount')
    await user.type(amount, '-12.5.5')
    expect(amount).toHaveValue('12.55')
  })

  it('clamps out-of-range courts at save and keeps decimal amount', async () => {
    const user = userEvent.setup()
    render(
      <SessionsProvider>
        <SessionModal onClose={() => {}} />
        <Probe />
      </SessionsProvider>
    )
    const courts = screen.getByLabelText('Courts')
    await user.clear(courts)
    await user.type(courts, '500')
    await user.type(screen.getByLabelText('Total Amount'), '12.5')
    await user.click(screen.getByText('Create Session'))
    expect(screen.getByTestId('courts')).toHaveTextContent(/^20$/)
    expect(screen.getByTestId('amount')).toHaveTextContent(/^12.5$/)
  })

  it('saves empty amount as null', async () => {
    const user = userEvent.setup()
    render(
      <SessionsProvider>
        <SessionModal onClose={() => {}} />
        <Probe />
      </SessionsProvider>
    )
    await user.click(screen.getByText('Create Session'))
    expect(screen.getByTestId('amount')).toHaveTextContent(/^null$/)
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
