import { describe, it, expect } from 'vitest'
import {
  createNewSession, checkInPlayer, checkOutPlayer, addRosterPlayer,
  removeRosterPlayer, updateSessionFields, setGameWinner, compareSessionsDesc,
} from '../sessionOps'
import type { Session } from '../../types'

const base = (): Session => createNewSession({
  date: '2026-07-18', venue: 'BGC Courts', numCourts: 2,
  courtAmount: 2000, playSystem: 'paddle-queue', playerNames: ['Alice', 'Ben'],
})

describe('createNewSession', () => {
  it('creates an active session with unchecked roster', () => {
    const s = base()
    expect(s.id).toBeTruthy()
    expect(s.createdAt).toBeTruthy()
    expect(s.status).toBe('active')
    expect(s.players).toHaveLength(2)
    expect(s.players[0]).toMatchObject({ name: 'Alice', checkedIn: false, participated: false })
    expect(s.matchupState).toBeNull()
    expect(s.roundHistory).toEqual([])
    expect(s.deferredPlayerIds).toEqual([])
  })

  it('clamps numCourts to min 1 and non-positive amount to null', () => {
    const s = createNewSession({ date: '2026-07-18', venue: '', numCourts: 0, courtAmount: 0, playSystem: 'round-robin', playerNames: [] })
    expect(s.numCourts).toBe(1)
    expect(s.courtAmount).toBeNull()
  })

  it('dedupes roster names case-insensitively', () => {
    const s = createNewSession({ date: '2026-07-18', venue: '', numCourts: 1, courtAmount: null, playSystem: 'paddle-queue', playerNames: ['Alice', 'alice', ' Ben '] })
    expect(s.players.map(p => p.name)).toEqual(['Alice', 'Ben'])
  })
})

describe('check-in / check-out', () => {
  it('check-in sets checkedIn and sticky participated, joins matchup pool', () => {
    let s = base()
    s = { ...s, matchupState: { games: [], sittingOut: [] } }
    s = checkInPlayer(s, s.players[0].id)
    expect(s.players[0].checkedIn).toBe(true)
    expect(s.players[0].participated).toBe(true)
    expect(s.matchupState!.sittingOut).toContain(s.players[0].id)
  })

  it('check-out clears checkedIn, keeps participated, leaves pool and deferred', () => {
    let s = base()
    s = { ...s, matchupState: { games: [], sittingOut: [] } }
    const id = s.players[0].id
    s = checkInPlayer(s, id)
    s = { ...s, deferredPlayerIds: [id] }
    s = checkOutPlayer(s, id)
    expect(s.players[0].checkedIn).toBe(false)
    expect(s.players[0].participated).toBe(true)
    expect(s.matchupState!.sittingOut).not.toContain(id)
    expect(s.deferredPlayerIds).not.toContain(id)
  })

  it('check-in with no matchupState leaves it null', () => {
    let s = base()
    s = checkInPlayer(s, s.players[0].id)
    expect(s.matchupState).toBeNull()
  })
})

describe('roster ops', () => {
  it('addRosterPlayer appends unchecked; ignores case-insensitive duplicates and blanks', () => {
    let s = base()
    s = addRosterPlayer(s, 'Carol')
    expect(s.players.map(p => p.name)).toEqual(['Alice', 'Ben', 'Carol'])
    expect(s.players[2]).toMatchObject({ checkedIn: false, participated: false })
    expect(addRosterPlayer(s, 'carol').players).toHaveLength(3)
    expect(addRosterPlayer(s, '  ').players).toHaveLength(3)
  })

  it('removeRosterPlayer removes from roster, matchups, and deferred', () => {
    let s = base()
    const id = s.players[0].id
    s = { ...s, matchupState: { games: [], sittingOut: [id] }, deferredPlayerIds: [id] }
    s = removeRosterPlayer(s, id)
    expect(s.players.map(p => p.name)).toEqual(['Ben'])
    expect(s.matchupState!.sittingOut).toEqual([])
    expect(s.deferredPlayerIds).toEqual([])
  })
})

describe('updateSessionFields', () => {
  it('applies fields with clamping', () => {
    let s = base()
    s = updateSessionFields(s, { venue: 'New Venue', numCourts: 0, courtAmount: -5 })
    expect(s.venue).toBe('New Venue')
    expect(s.numCourts).toBe(1)
    expect(s.courtAmount).toBeNull()
  })
})

describe('setGameWinner', () => {
  it('sets, flips, and unsets winner on a history game', () => {
    let s = base()
    const round = { id: 'r1', games: [{ court: 1, team1: ['a', 'b'] as [string, string], team2: ['c', 'd'] as [string, string] }], sittingOut: [] }
    s = { ...s, roundHistory: [round] }
    s = setGameWinner(s, 'r1', 1, 1)
    expect(s.roundHistory[0].games[0].winner).toBe(1)
    s = setGameWinner(s, 'r1', 1, 2)
    expect(s.roundHistory[0].games[0].winner).toBe(2)
    s = setGameWinner(s, 'r1', 1, undefined)
    expect(s.roundHistory[0].games[0].winner).toBeUndefined()
  })
})

describe('compareSessionsDesc', () => {
  it('sorts by date desc then createdAt desc', () => {
    const a = { ...base(), date: '2026-07-18', createdAt: '2026-07-18T10:00:00Z' }
    const b = { ...base(), date: '2026-07-17', createdAt: '2026-07-17T10:00:00Z' }
    const c = { ...base(), date: '2026-07-18', createdAt: '2026-07-18T12:00:00Z' }
    expect([a, b, c].sort(compareSessionsDesc).map(s => s.createdAt))
      .toEqual(['2026-07-18T12:00:00Z', '2026-07-18T10:00:00Z', '2026-07-17T10:00:00Z'])
  })
})
