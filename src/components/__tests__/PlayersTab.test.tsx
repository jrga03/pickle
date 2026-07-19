import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionsProvider } from '../../context/SessionsContext'
import { SessionProvider } from '../../context/SessionContext'
import { PlayersTab } from '../PlayersTab'
import { createNewSession } from '../../utils/sessionOps'
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
})
