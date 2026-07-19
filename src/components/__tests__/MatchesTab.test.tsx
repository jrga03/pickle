import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionsProvider } from '../../context/SessionsContext'
import { SessionProvider } from '../../context/SessionContext'
import { MatchesTab } from '../MatchesTab'
import { createNewSession } from '../../utils/sessionOps'
import { saveSessions } from '../../utils/storage'
import type { Session } from '../../types'

function sessionWithRound(): Session {
  const s = createNewSession({
    date: '2026-07-18', venue: '', numCourts: 1,
    courtAmount: null, playSystem: 'paddle-queue',
    playerNames: ['Alice', 'Ben', 'Cara', 'Dan'],
  })
  const [a, b, c, d] = s.players.map(p => p.id)
  return {
    ...s,
    roundHistory: [{
      id: 'r1',
      games: [{ court: 1, team1: [a, b] as [string, string], team2: [c, d] as [string, string] }],
      sittingOut: [],
    }],
  }
}

function renderTab(session: Session) {
  saveSessions([session])
  return render(
    <SessionsProvider>
      <SessionProvider sessionId={session.id}>
        <MatchesTab />
      </SessionProvider>
    </SessionsProvider>
  )
}

describe('MatchesTab', () => {
  beforeEach(() => localStorage.clear())

  it('shows an empty state without rounds', () => {
    const s = createNewSession({
      date: '2026-07-18', venue: '', numCourts: 1,
      courtAmount: null, playSystem: 'paddle-queue', playerNames: [],
    })
    renderTab(s)
    expect(screen.getByText(/No completed rounds yet/)).toBeInTheDocument()
  })

  it('marks a winner on tap, shows tally, unsets on second tap', async () => {
    const user = userEvent.setup()
    renderTab(sessionWithRound())
    const team1 = screen.getByRole('button', { name: /Alice & Ben/ })
    await user.click(team1)
    expect(screen.getByText('Alice 1W–0L')).toBeInTheDocument()
    expect(screen.getByText('Cara 0W–1L')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Alice & Ben/ }))
    expect(screen.queryByText('Alice 1W–0L')).toBeNull()
  })

  it('disables winner buttons when ended', () => {
    renderTab({ ...sessionWithRound(), status: 'ended' })
    expect(screen.getByRole('button', { name: /Alice & Ben/ })).toBeDisabled()
  })
})
