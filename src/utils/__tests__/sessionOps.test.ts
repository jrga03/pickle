import { describe, it, expect } from 'vitest'
import {
  createNewSession, checkInPlayer, checkOutPlayer, removeRosterPlayer,
  assignToCourt, recordWin, cancelGame, setGameWinner, deleteGame,
  setPlaySystem, updateSessionFields, compareSessionsDesc,
} from '../sessionOps'
import type { Session } from '../../types'
import type { Candidate } from '../suggestions'

function makeSession(names: string[], overrides: Partial<Session> = {}): Session {
  let s = createNewSession({
    date: '2026-07-20', venue: '', numCourts: 2, courtAmount: null,
    playSystem: 'paddle-queue', playerNames: names,
  })
  for (const p of s.players) s = checkInPlayer(s, p.id)
  return { ...s, ...overrides }
}

function ids(s: Session, ...names: string[]): string[] {
  return names.map(n => s.players.find(p => p.name === n)!.id)
}

function candidateOf(s: Session, names: [string, string, string, string]): Candidate {
  const [a, b, c, d] = ids(s, ...names)
  return { team1: [a, b], team2: [c, d] }
}

describe('createNewSession', () => {
  it('starts with empty games-first state', () => {
    const s = createNewSession({
      date: '2026-07-20', venue: ' BGC ', numCourts: 0, courtAmount: -5,
      playSystem: 'round-robin', playerNames: ['A', 'a', ' ', 'B'],
    })
    expect(s.liveGames).toEqual([])
    expect(s.matchHistory).toEqual([])
    expect(s.queue).toEqual([])
    expect(s.courtWinners).toEqual({})
    expect(s.numCourts).toBe(1)          // clamped
    expect(s.courtAmount).toBeNull()     // normalized
    expect(s.players.map(p => p.name)).toEqual(['A', 'B']) // dedupe + trim
  })
})

describe('check-in / check-out and the queue', () => {
  it('check-in appends to the queue and marks participated', () => {
    let s = createNewSession({
      date: '2026-07-20', venue: '', numCourts: 1, courtAmount: null,
      playSystem: 'paddle-queue', playerNames: ['A', 'B'],
    })
    const [a, b] = s.players.map(p => p.id)
    s = checkInPlayer(s, a)
    s = checkInPlayer(s, b)
    s = checkInPlayer(s, a) // no duplicate
    expect(s.queue).toEqual([a, b])
    expect(s.players.find(p => p.id === a)).toMatchObject({ checkedIn: true, participated: true })
  })

  it('check-out removes from the queue', () => {
    let s = makeSession(['A', 'B', 'C'])
    const [a] = ids(s, 'A')
    s = checkOutPlayer(s, a)
    expect(s.queue).not.toContain(a)
    expect(s.players.find(p => p.id === a)!.checkedIn).toBe(false)
  })

  it('check-out mid-game cancels the game; remaining 3 go to the queue front', () => {
    let s = makeSession(['A', 'B', 'C', 'D', 'E'])
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 1)
    const [a, b, c, d, e] = ids(s, 'A', 'B', 'C', 'D', 'E')
    s = checkOutPlayer(s, b)
    expect(s.liveGames).toEqual([])
    expect(s.matchHistory).toEqual([])
    expect(s.queue).toEqual([a, c, d, e])
  })

  it('check-out of a court holder frees the court; partner to queue front', () => {
    let s = makeSession(['A', 'B', 'C', 'D', 'E'], { playSystem: 'challenge-court' })
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 1)
    s = recordWin(s, 1, 1) // A,B hold court 1
    const [a, b, c, d, e] = ids(s, 'A', 'B', 'C', 'D', 'E')
    s = checkOutPlayer(s, a)
    expect(s.courtWinners).toEqual({})
    expect(s.queue).toEqual([b, e, c, d]) // partner b to front; e was waiting; c,d lost earlier
  })

  it('removeRosterPlayer also cleans queue and games', () => {
    let s = makeSession(['A', 'B', 'C', 'D', 'E'])
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 1)
    const [a] = ids(s, 'A')
    s = removeRosterPlayer(s, a)
    expect(s.players.find(p => p.id === a)).toBeUndefined()
    expect(s.liveGames).toEqual([])
    expect(s.queue).toHaveLength(4) // B,C,D to front + E
  })
})

describe('assignToCourt', () => {
  it('creates a live game and removes players from the queue', () => {
    let s = makeSession(['A', 'B', 'C', 'D', 'E'])
    const cand = candidateOf(s, ['A', 'B', 'C', 'D'])
    s = assignToCourt(s, cand, 1)
    expect(s.liveGames).toEqual([{ court: 1, team1: cand.team1, team2: cand.team2 }])
    expect(s.queue).toEqual(ids(s, 'E'))
  })

  it('no-ops on an occupied court, out-of-range court, or unavailable player', () => {
    let s = makeSession(['A', 'B', 'C', 'D', 'E'])
    const cand = candidateOf(s, ['A', 'B', 'C', 'D'])
    s = assignToCourt(s, cand, 1)
    expect(assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'E']), 2)).toBe(s) // A..D already playing
    expect(assignToCourt(s, cand, 1)).toBe(s)  // occupied
    expect(assignToCourt(s, cand, 3)).toBe(s)  // beyond numCourts (2)
  })

  it('fills a held challenge court from winners + queue and clears the hold', () => {
    let s = makeSession(['A', 'B', 'C', 'D', 'E', 'F'], { playSystem: 'challenge-court' })
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 1)
    s = recordWin(s, 1, 1) // A,B hold
    const [a, b, e, f] = ids(s, 'A', 'B', 'E', 'F')
    s = assignToCourt(s, { team1: [a, b], team2: [e, f] }, 1)
    expect(s.courtWinners).toEqual({})
    expect(s.liveGames).toEqual([{ court: 1, team1: [a, b], team2: [e, f] }])
  })
})

describe('recordWin', () => {
  it('paddle queue: appends history and re-queues losers first, then winners', () => {
    let s = makeSession(['A', 'B', 'C', 'D', 'E'])
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 1)
    s = recordWin(s, 1, 1)
    const [a, b, c, d, e] = ids(s, 'A', 'B', 'C', 'D', 'E')
    expect(s.liveGames).toEqual([])
    expect(s.queue).toEqual([e, c, d, a, b])
    expect(s.matchHistory).toHaveLength(1)
    expect(s.matchHistory[0]).toMatchObject({ court: 1, winner: 1, team1: [a, b], team2: [c, d] })
    expect(s.matchHistory[0].id).toBeTruthy()
    expect(s.matchHistory[0].endedAt).toBeTruthy()
  })

  it('challenge court: losers to queue back, winners hold the court', () => {
    let s = makeSession(['A', 'B', 'C', 'D', 'E'], { playSystem: 'challenge-court' })
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 1)
    s = recordWin(s, 1, 2)
    const [a, b, c, d, e] = ids(s, 'A', 'B', 'C', 'D', 'E')
    expect(s.courtWinners).toEqual({ 1: [c, d] })
    expect(s.queue).toEqual([e, a, b])
  })

  it('no-ops when the court has no live game', () => {
    const s = makeSession(['A', 'B', 'C', 'D'])
    expect(recordWin(s, 1, 1)).toBe(s)
  })
})

describe('cancelGame', () => {
  it('returns all 4 to the queue front in team order, records nothing', () => {
    let s = makeSession(['A', 'B', 'C', 'D', 'E'])
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 1)
    s = cancelGame(s, 1)
    const [a, b, c, d, e] = ids(s, 'A', 'B', 'C', 'D', 'E')
    expect(s.queue).toEqual([a, b, c, d, e])
    expect(s.matchHistory).toEqual([])
  })
})

describe('history corrections', () => {
  it('setGameWinner flips a recorded winner', () => {
    let s = makeSession(['A', 'B', 'C', 'D'])
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 1)
    s = recordWin(s, 1, 1)
    const gameId = s.matchHistory[0].id
    s = setGameWinner(s, gameId, 2)
    expect(s.matchHistory[0].winner).toBe(2)
  })

  it('deleteGame removes the record only', () => {
    let s = makeSession(['A', 'B', 'C', 'D'])
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 1)
    s = recordWin(s, 1, 1)
    const queueAfterWin = s.queue
    s = deleteGame(s, s.matchHistory[0].id)
    expect(s.matchHistory).toEqual([])
    expect(s.queue).toEqual(queueAfterWin)
  })
})

describe('hold dissolution', () => {
  function heldSession(): Session {
    let s = makeSession(['A', 'B', 'C', 'D', 'E'], { playSystem: 'challenge-court' })
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 1)
    return recordWin(s, 1, 1) // A,B hold court 1; queue = [E, C, D]
  }

  it('setPlaySystem dissolves holds to the queue front', () => {
    let s = heldSession()
    const [a, b, c, d, e] = ids(s, 'A', 'B', 'C', 'D', 'E')
    s = setPlaySystem(s, 'round-robin')
    expect(s.playSystem).toBe('round-robin')
    expect(s.courtWinners).toEqual({})
    expect(s.queue).toEqual([a, b, e, c, d])
  })

  it('setPlaySystem with the same system is a no-op', () => {
    const s = heldSession()
    expect(setPlaySystem(s, 'challenge-court')).toBe(s)
  })

  it('updateSessionFields dissolves holds on removed courts', () => {
    let s = makeSession(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], { playSystem: 'challenge-court' })
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 2)
    s = recordWin(s, 2, 1) // A,B hold court 2
    const [a, b] = ids(s, 'A', 'B')
    s = updateSessionFields(s, { numCourts: 1 })
    expect(s.courtWinners).toEqual({})
    expect(s.queue.slice(0, 2)).toEqual([a, b])
  })

  it('updateSessionFields dissolves all holds when the play system changes', () => {
    let s = heldSession()
    s = updateSessionFields(s, { playSystem: 'paddle-queue' })
    expect(s.courtWinners).toEqual({})
  })
})

describe('compareSessionsDesc', () => {
  it('sorts by date then createdAt, newest first', () => {
    const a = { date: '2026-07-19', createdAt: '1' } as Session
    const b = { date: '2026-07-20', createdAt: '2' } as Session
    expect([a, b].sort(compareSessionsDesc)[0]).toBe(b)
  })
})
