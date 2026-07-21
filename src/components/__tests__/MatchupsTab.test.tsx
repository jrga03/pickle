import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SessionsProvider } from '../../context/SessionsContext'
import { SessionProvider } from '../../context/SessionContext'
import { MatchupsTab } from '../MatchupsTab'
import { createNewSession, checkInPlayer, assignToCourt } from '../../utils/sessionOps'
import { saveSessions } from '../../utils/storage'
import type { Session, PlaySystem } from '../../types'

function makeSession(names: string[], playSystem: PlaySystem = 'paddle-queue', numCourts = 2): Session {
  let s = createNewSession({
    date: '2026-07-20', venue: '', numCourts, courtAmount: null,
    playSystem, playerNames: names,
  })
  for (const p of s.players) s = checkInPlayer(s, p.id)
  return s
}

function withLiveGame(s: Session, court = 1): Session {
  const [a, b, c, d] = s.queue
  return assignToCourt(s, { team1: [a, b], team2: [c, d] }, court)
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

function courtCard(court: number) {
  return screen.getByText(`Court ${court}`).closest('div[data-court]') as HTMLElement
}

describe('MatchupsTab courts', () => {
  beforeEach(() => localStorage.clear())

  it('renders one card per court with free state', () => {
    renderTab(makeSession(['A', 'B', 'C', 'D'], 'paddle-queue', 2))
    expect(screen.getByText('Court 1')).toBeInTheDocument()
    expect(screen.getByText('Court 2')).toBeInTheDocument()
    expect(screen.getAllByText('Free')).toHaveLength(2)
  })

  it('has no Roster section or legacy round buttons', () => {
    renderTab(makeSession(['A', 'B', 'C', 'D']))
    expect(screen.queryByText('Roster')).toBeNull()
    expect(screen.queryByText(/Next Round|Generate Matchups|Reshuffle/)).toBeNull()
  })

  it('shows teams and win buttons on a live court; a win frees the court', async () => {
    const user = userEvent.setup()
    renderTab(withLiveGame(makeSession(['A', 'B', 'C', 'D', 'E'])))
    const card = courtCard(1)
    expect(within(card).getByText('A')).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: 'Team 1 Wins' }))
    expect(within(courtCard(1)).getByText('Free')).toBeInTheDocument()
  })

  it('challenge court: win keeps winners on court with streak', async () => {
    const user = userEvent.setup()
    renderTab(withLiveGame(makeSession(['A', 'B', 'C', 'D', 'E'], 'challenge-court')))
    await user.click(within(courtCard(1)).getByRole('button', { name: 'Team 1 Wins' }))
    const card = courtCard(1)
    expect(within(card).getByText('A & B')).toBeInTheDocument()
    expect(within(card).getByText(/1 win · awaiting challengers/)).toBeInTheDocument()
  })

  it('cancel returns players and records nothing after confirm', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderTab(withLiveGame(makeSession(['A', 'B', 'C', 'D'])))
    await user.click(screen.getByRole('button', { name: 'Cancel game on court 1' }))
    expect(within(courtCard(1)).getByText('Free')).toBeInTheDocument()
    vi.restoreAllMocks()
  })

  it('hides action buttons when read-only', () => {
    const s = withLiveGame(makeSession(['A', 'B', 'C', 'D']))
    renderTab({ ...s, status: 'ended' })
    expect(screen.queryByRole('button', { name: 'Team 1 Wins' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Cancel game/ })).toBeNull()
  })

  it('keeps rendering a live game on a court beyond numCourts', () => {
    const s = withLiveGame(makeSession(['A', 'B', 'C', 'D'], 'paddle-queue', 2), 2)
    renderTab({ ...s, numCourts: 1 })
    expect(screen.getByText('Court 2')).toBeInTheDocument()
    expect(screen.queryByText('Court 3')).toBeNull()
  })
})

describe('MatchupsTab suggestions', () => {
  beforeEach(() => localStorage.clear())

  it('lists ranked candidates with a single assign button regardless of free courts', async () => {
    const user = userEvent.setup()
    renderTab(makeSession(['A', 'B', 'C', 'D', 'E'], 'paddle-queue', 3))
    expect(screen.getByText('Up Next')).toBeInTheDocument()
    const first = screen.getAllByTestId('suggestion')[0]
    expect(within(first).getByText(/A & B/)).toBeInTheDocument()
    expect(within(first).getAllByRole('button', { name: /^Assign to Court/ })).toHaveLength(1)
    await user.click(within(first).getByRole('button', { name: 'Assign to Court' }))
    expect(within(courtCard(1)).getByRole('button', { name: 'Team 1 Wins' })).toBeInTheDocument()
  })

  it('auto-assigns to the first free court when earlier courts are busy', async () => {
    const user = userEvent.setup()
    renderTab(withLiveGame(makeSession(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], 'paddle-queue', 2)))
    await user.click(screen.getByRole('button', { name: 'Assign to Court' }))
    expect(within(courtCard(2)).getByRole('button', { name: 'Team 1 Wins' })).toBeInTheDocument()
  })

  it('smooth-scrolls to the top after assigning', async () => {
    const user = userEvent.setup()
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView')
    renderTab(makeSession(['A', 'B', 'C', 'D']))
    await user.click(screen.getByRole('button', { name: 'Assign to Court' }))
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth' })
    scrollSpy.mockRestore()
  })

  it('shows challenger candidates for a held court', async () => {
    const user = userEvent.setup()
    renderTab(withLiveGame(makeSession(['A', 'B', 'C', 'D', 'E', 'F'], 'challenge-court')))
    await user.click(within(courtCard(1)).getByRole('button', { name: 'Team 1 Wins' }))
    expect(screen.getByText('Challengers · Court 1')).toBeInTheDocument()
    const first = screen.getAllByTestId('suggestion')[0]
    expect(within(first).getByText('E & F')).toBeInTheDocument()
    await user.click(within(first).getByRole('button', { name: 'Assign to Court 1' }))
    expect(within(courtCard(1)).getByRole('button', { name: 'Team 2 Wins' })).toBeInTheDocument()
  })

  it('shows waiting chips with game counts but no suggestions when fewer than 4 wait', () => {
    renderTab(makeSession(['A', 'B', 'C']))
    expect(screen.queryByText('Up Next')).toBeNull()
    expect(screen.getByText('Waiting (3)')).toBeInTheDocument()
    expect(screen.getByText('A · 0')).toBeInTheDocument()
  })

  it('hides suggestions when read-only', () => {
    renderTab({ ...makeSession(['A', 'B', 'C', 'D']), status: 'ended' })
    expect(screen.queryByText('Up Next')).toBeNull()
  })
})
