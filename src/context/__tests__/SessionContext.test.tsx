import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach } from 'vitest'
import { SessionProvider, useSession } from '../SessionContext'

function TestConsumer() {
  const { session, addPlayer, removePlayer } = useSession()
  return (
    <div>
      <span data-testid="player-count">{session.players.length}</span>
      <button onClick={() => addPlayer('Alice')}>Add Alice</button>
      <button onClick={() => {
        if (session.players[0]) removePlayer(session.players[0].id)
      }}>Remove First</button>
    </div>
  )
}

describe('SessionContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts with empty session', () => {
    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    )
    expect(screen.getByTestId('player-count')).toHaveTextContent('0')
  })

  it('adds a player', async () => {
    const user = userEvent.setup()
    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    )
    await user.click(screen.getByText('Add Alice'))
    expect(screen.getByTestId('player-count')).toHaveTextContent('1')
  })

  it('removes a player', async () => {
    const user = userEvent.setup()
    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    )
    await user.click(screen.getByText('Add Alice'))
    await user.click(screen.getByText('Remove First'))
    expect(screen.getByTestId('player-count')).toHaveTextContent('0')
  })
})
