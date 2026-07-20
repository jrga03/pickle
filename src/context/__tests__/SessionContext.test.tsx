import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionsProvider } from '../SessionsContext'
import { SessionProvider, useSession } from '../SessionContext'
import { createNewSession, checkInPlayer, assignToCourt } from '../../utils/sessionOps'
import { saveSessions } from '../../utils/storage'
import type { Session } from '../../types'

function makeSession(): Session {
  let s = createNewSession({
    date: '2026-07-20', venue: '', numCourts: 1, courtAmount: null,
    playSystem: 'paddle-queue', playerNames: ['A', 'B', 'C', 'D', 'E'],
  })
  for (const p of s.players) s = checkInPlayer(s, p.id)
  const [a, b, c, d] = s.players.map(p => p.id)
  return assignToCourt(s, { team1: [a, b], team2: [c, d] }, 1)
}

function Probe() {
  const { session, readOnly, recordWin, cancelGame, setGameWinner, deleteGame } = useSession()
  return (
    <div>
      <p>live:{session.liveGames.length}</p>
      <p>history:{session.matchHistory.length}</p>
      <p>queue:{session.queue.length}</p>
      <p>readOnly:{String(readOnly)}</p>
      <button onClick={() => recordWin(1, 1)}>win1</button>
      <button onClick={() => cancelGame(1)}>cancel</button>
      <button onClick={() => session.matchHistory[0] && setGameWinner(session.matchHistory[0].id, 2)}>flip</button>
      <button onClick={() => session.matchHistory[0] && deleteGame(session.matchHistory[0].id)}>delete</button>
    </div>
  )
}

function renderProbe(session: Session) {
  saveSessions([session])
  return render(
    <SessionsProvider>
      <SessionProvider sessionId={session.id}>
        <Probe />
      </SessionProvider>
    </SessionsProvider>
  )
}

describe('SessionContext', () => {
  beforeEach(() => localStorage.clear())

  it('recordWin moves the live game into history and re-queues players', async () => {
    const user = userEvent.setup()
    renderProbe(makeSession())
    expect(screen.getByText('live:1')).toBeInTheDocument()
    await user.click(screen.getByText('win1'))
    expect(screen.getByText('live:0')).toBeInTheDocument()
    expect(screen.getByText('history:1')).toBeInTheDocument()
    expect(screen.getByText('queue:5')).toBeInTheDocument()
  })

  it('cancelGame frees the court without recording', async () => {
    const user = userEvent.setup()
    renderProbe(makeSession())
    await user.click(screen.getByText('cancel'))
    expect(screen.getByText('live:0')).toBeInTheDocument()
    expect(screen.getByText('history:0')).toBeInTheDocument()
  })

  it('setGameWinner and deleteGame edit history', async () => {
    const user = userEvent.setup()
    renderProbe(makeSession())
    await user.click(screen.getByText('win1'))
    await user.click(screen.getByText('flip'))
    expect(screen.getByText('history:1')).toBeInTheDocument()
    await user.click(screen.getByText('delete'))
    expect(screen.getByText('history:0')).toBeInTheDocument()
  })

  it('readOnly reflects ended status', () => {
    renderProbe({ ...makeSession(), status: 'ended' })
    expect(screen.getByText('readOnly:true')).toBeInTheDocument()
  })
})
