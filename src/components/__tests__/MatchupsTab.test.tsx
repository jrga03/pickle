import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionsProvider } from '../../context/SessionsContext'
import { SessionProvider } from '../../context/SessionContext'
import { MatchupsTab } from '../MatchupsTab'
import { createNewSession, checkInPlayer } from '../../utils/sessionOps'
import { saveSessions } from '../../utils/storage'
import type { Session } from '../../types'

function sessionWithFour(): Session {
  let s = createNewSession({
    date: '2026-07-18', venue: '', numCourts: 1,
    courtAmount: null, playSystem: 'paddle-queue',
    playerNames: ['Alice', 'Ben', 'Cara', 'Dan'],
  })
  const ids = s.players.map(p => p.id)
  for (const id of ids) s = checkInPlayer(s, id)
  return s
}

function renderTab(session: Session) {
  saveSessions([session])
  return render(
    <SessionsProvider>
      <SessionProvider sessionId={session.id}>
        <MatchupsTab />
      </SessionProvider>
    </SessionsProvider>
  )
}

describe('MatchupsTab', () => {
  beforeEach(() => localStorage.clear())

  it('generates a round from checked-in players', async () => {
    const user = userEvent.setup()
    renderTab(sessionWithFour())
    await user.click(screen.getByText('Generate Matchups'))
    expect(screen.getByText('Court 1')).toBeInTheDocument()
    expect(screen.getByText('Round 1')).toBeInTheDocument()
  })

  it('needs 4 checked-in players', () => {
    const s = createNewSession({
      date: '2026-07-18', venue: '', numCourts: 1,
      courtAmount: null, playSystem: 'paddle-queue',
      playerNames: ['Alice', 'Ben', 'Cara', 'Dan'],
    }) // nobody checked in
    renderTab(s)
    expect(screen.getByText(/Need at least 4 active players/)).toBeInTheDocument()
  })

  it('hides generate controls when the session is ended', () => {
    renderTab({ ...sessionWithFour(), status: 'ended' })
    expect(screen.queryByText('Generate Matchups')).toBeNull()
    expect(screen.getByText('Paddle Queue')).toBeDisabled()
  })

  it('preserves round history when saving an edit', async () => {
    const user = userEvent.setup()
    let s = sessionWithFour()
    const [a, b, c, d] = s.players.map(p => p.id)
    s = {
      ...s,
      matchupState: { games: [{ court: 1, team1: [a, b] as [string, string], team2: [c, d] as [string, string] }], sittingOut: [] },
      roundHistory: [{ id: 'r1', games: [{ court: 1, team1: [a, c] as [string, string], team2: [b, d] as [string, string] }], sittingOut: [] }],
    }
    renderTab(s)
    await user.click(screen.getByText('Edit'))
    await user.click(screen.getByText('Save'))
    const stored = JSON.parse(localStorage.getItem('pickleball-sessions')!)
    expect(stored[0].roundHistory).toHaveLength(1)
  })
})
