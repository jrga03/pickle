import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SessionsProvider } from '../../context/SessionsContext'
import { SessionProvider } from '../../context/SessionContext'
import { MatchesTab } from '../MatchesTab'
import { createNewSession, checkInPlayer, assignToCourt, recordWin } from '../../utils/sessionOps'
import { saveSessions } from '../../utils/storage'
import type { Session } from '../../types'

function sessionWithGames(): Session {
  let s = createNewSession({
    date: '2026-07-20', venue: '', numCourts: 2, courtAmount: null,
    playSystem: 'paddle-queue', playerNames: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  })
  for (const p of s.players) s = checkInPlayer(s, p.id)
  const [a, b, c, d, e, f, g, h] = s.players.map(p => p.id)
  s = assignToCourt(s, { team1: [a, b], team2: [c, d] }, 1)
  s = recordWin(s, 1, 1)                                   // game 1: A&B beat C&D
  s = assignToCourt(s, { team1: [e, f], team2: [g, h] }, 2)
  s = recordWin(s, 2, 2)                                   // game 2: G&H beat E&F
  return s
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

  it('shows an empty state without games', () => {
    const s = createNewSession({
      date: '2026-07-20', venue: '', numCourts: 1, courtAmount: null,
      playSystem: 'paddle-queue', playerNames: [],
    })
    renderTab(s)
    expect(screen.getByText(/No games yet/)).toBeInTheDocument()
  })

  it('lists games newest first with winner marked, no round grouping or sat-out', () => {
    renderTab(sessionWithGames())
    const rows = screen.getAllByTestId('game-row')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText(/G & H/)).toBeInTheDocument() // newest first
    expect(within(rows[0]).getByRole('button', { name: /G & H ✓/ })).toBeInTheDocument()
    expect(screen.queryByText(/Sat out/)).toBeNull()
    expect(screen.queryByText(/Round \d/)).toBeNull()
  })

  it('taps the losing team to flip the winner', async () => {
    const user = userEvent.setup()
    renderTab(sessionWithGames())
    const row = screen.getAllByTestId('game-row')[1]
    await user.click(within(row).getByRole('button', { name: /C & D/ }))
    expect(within(row).getByRole('button', { name: /C & D ✓/ })).toBeInTheDocument()
  })

  it('deletes a record after confirm', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderTab(sessionWithGames())
    await user.click(screen.getAllByRole('button', { name: /Delete game/ })[0])
    expect(screen.getAllByTestId('game-row')).toHaveLength(1)
    vi.restoreAllMocks()
  })

  it('disables corrections when ended', () => {
    renderTab({ ...sessionWithGames(), status: 'ended' })
    const row = screen.getAllByTestId('game-row')[0]
    expect(within(row).getByRole('button', { name: /G & H ✓/ })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Delete game/ })).toBeNull()
  })
})
