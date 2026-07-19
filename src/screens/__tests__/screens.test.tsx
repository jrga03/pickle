import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router'
import { SessionsProvider } from '../../context/SessionsContext'
import { SessionListScreen } from '../SessionListScreen'
import { SessionDetailScreen } from '../SessionDetailScreen'
import { createNewSession } from '../../utils/sessionOps'
import { saveSessions } from '../../utils/storage'

function renderAt(path: string) {
  return render(
    <SessionsProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<SessionListScreen />} />
          <Route path="/session/:id" element={<SessionDetailScreen />} />
        </Routes>
      </MemoryRouter>
    </SessionsProvider>
  )
}

const make = (venue: string, date: string) => createNewSession({
  date, venue, numCourts: 1, courtAmount: null,
  playSystem: 'paddle-queue', playerNames: ['Alice'],
})

describe('SessionListScreen', () => {
  beforeEach(() => localStorage.clear())

  it('groups sessions by status', () => {
    const a = make('Active Venue', '2026-07-18')
    const e = { ...make('Old Venue', '2026-07-10'), status: 'ended' as const }
    saveSessions([a, e])
    renderAt('/')
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Past')).toBeInTheDocument()
    expect(screen.getByText('Active Venue')).toBeInTheDocument()
    expect(screen.getByText('Old Venue')).toBeInTheDocument()
  })

  it('deletes an ended session after confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    saveSessions([{ ...make('Old Venue', '2026-07-10'), status: 'ended' as const }])
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByLabelText('Delete session Old Venue'))
    expect(screen.queryByText('Old Venue')).toBeNull()
  })

  it('shows empty state with no sessions', () => {
    renderAt('/')
    expect(screen.getByText(/No sessions yet/)).toBeInTheDocument()
  })
})

describe('SessionDetailScreen', () => {
  beforeEach(() => localStorage.clear())

  it('renders tabs and ends/reopens the session', async () => {
    const s = make('BGC', '2026-07-18')
    saveSessions([s])
    const user = userEvent.setup()
    renderAt(`/session/${s.id}`)
    expect(screen.getByText('Players')).toBeInTheDocument()
    expect(screen.getByText('Matchups')).toBeInTheDocument()
    expect(screen.getByText('Matches')).toBeInTheDocument()
    await user.click(screen.getByText('End'))
    expect(screen.getByText('Reopen')).toBeInTheDocument()
    await user.click(screen.getByText('Reopen'))
    expect(screen.getByText('End')).toBeInTheDocument()
  })

  it('redirects unknown ids to the list', () => {
    renderAt('/session/nope')
    expect(screen.getByText('+ New Session')).toBeInTheDocument()
  })
})
