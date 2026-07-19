import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionsProvider } from '../../context/SessionsContext'
import { SessionProvider } from '../../context/SessionContext'
import { ExpensesModal } from '../ExpensesModal'
import { createNewSession, checkInPlayer } from '../../utils/sessionOps'
import { saveSessions } from '../../utils/storage'
import type { Session } from '../../types'

function sessionWithPlayers(courtAmount: number | null): Session {
  let s = createNewSession({
    date: '2026-07-18', venue: 'BGC', numCourts: 2,
    courtAmount, playSystem: 'paddle-queue',
    playerNames: ['Alice', 'Ben', 'Cara', 'Dan'],
  })
  for (const name of ['Alice', 'Ben']) {
    s = checkInPlayer(s, s.players.find(p => p.name === name)!.id)
  }
  return s
}

function renderModal(session: Session) {
  saveSessions([session])
  return render(
    <SessionsProvider>
      <SessionProvider sessionId={session.id}>
        <ExpensesModal onClose={() => {}} />
      </SessionProvider>
    </SessionsProvider>
  )
}

describe('ExpensesModal', () => {
  beforeEach(() => localStorage.clear())

  it('shows the flat split for participants', () => {
    renderModal(sessionWithPlayers(2000))
    expect(screen.getByText('1000.00 each')).toBeInTheDocument()
    expect(screen.getByText(/2 players/)).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Ben')).toBeInTheDocument()
    expect(screen.queryByText('Dan')).toBeNull() // never checked in
  })

  it('prompts for amount when missing, and computes after typing', async () => {
    const user = userEvent.setup()
    renderModal(sessionWithPlayers(null))
    expect(screen.getByText(/Enter the court amount/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Court Amount'), '3000')
    expect(screen.getByText('1500.00 each')).toBeInTheDocument()
  })

  it('shows empty state when nobody has checked in', () => {
    const s = createNewSession({
      date: '2026-07-18', venue: '', numCourts: 1,
      courtAmount: 1000, playSystem: 'paddle-queue', playerNames: ['Alice'],
    })
    renderModal(s)
    expect(screen.getByText(/No one has checked in yet/)).toBeInTheDocument()
  })

  it('treats a zero amount as unset and keeps prompting for the split', async () => {
    const user = userEvent.setup()
    renderModal(sessionWithPlayers(null))
    await user.type(screen.getByLabelText('Court Amount'), '0')
    expect(screen.getByText(/Enter the court amount/)).toBeInTheDocument()
  })
})
