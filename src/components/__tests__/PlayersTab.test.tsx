import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionsProvider } from '../../context/SessionsContext'
import { SessionProvider } from '../../context/SessionContext'
import { PlayersTab } from '../PlayersTab'
import { createNewSession, checkInPlayer, assignToCourt, recordWin } from '../../utils/sessionOps'
import { saveSessions } from '../../utils/storage'
import type { Session } from '../../types'

function renderTab(session: Session) {
  saveSessions([session])
  return render(
    <SessionsProvider>
      <SessionProvider sessionId={session.id}>
        <PlayersTab />
      </SessionProvider>
    </SessionsProvider>
  )
}

const sample = () => createNewSession({
  date: '2026-07-18', venue: '', numCourts: 1,
  courtAmount: null, playSystem: 'paddle-queue', playerNames: ['Alice', 'Ben'],
})

function sessionWithStats(): Session {
  let s = createNewSession({
    date: '2026-07-20', venue: '', numCourts: 1, courtAmount: null,
    playSystem: 'paddle-queue', playerNames: ['A', 'B', 'C', 'D', 'E'],
  })
  for (const p of s.players) s = checkInPlayer(s, p.id)
  const [a, b, c, d] = s.players.map(p => p.id)
  s = assignToCourt(s, { team1: [a, b], team2: [c, d] }, 1)
  s = recordWin(s, 1, 1)
  return s
}

describe('PlayersTab', () => {
  beforeEach(() => localStorage.clear())

  it('checks a player in and out', async () => {
    const user = userEvent.setup()
    renderTab(sample())
    expect(screen.getByText('0 of 2 checked in')).toBeInTheDocument()
    await user.click(screen.getAllByText('Check in')[0])
    expect(screen.getByText('1 of 2 checked in')).toBeInTheDocument()
    await user.click(screen.getByText('Check out'))
    expect(screen.getByText('0 of 2 checked in')).toBeInTheDocument()
  })

  it('hides toggles when the session is ended', () => {
    renderTab({ ...sample(), status: 'ended' })
    expect(screen.queryByText('Check in')).toBeNull()
  })

  it('shows games, W–L, and win percentage per player', () => {
    renderTab(sessionWithStats())
    expect(screen.getAllByText('1 game · 1W–0L · 100%')).toHaveLength(2) // A and B
    expect(screen.getAllByText('1 game · 0W–1L · 0%')).toHaveLength(2)   // C and D
    expect(screen.getByText('0 games')).toBeInTheDocument()              // E
  })

  it('shows the empty-roster message when there are no players', () => {
    const s = createNewSession({
      date: '2026-07-18', venue: '', numCourts: 1,
      courtAmount: null, playSystem: 'paddle-queue', playerNames: [],
    })
    renderTab(s)
    expect(screen.getByText(/No players in the roster yet/)).toBeInTheDocument()
  })
})
