import { describe, it, expect, beforeEach } from 'vitest'
import { saveSession, loadSession, saveVenues, loadVenues, savePlayers, loadPlayers } from '../storage'
import type { Session, SavedVenue, SavedPlayer } from '../../types'

const mockSession: Session = {
  date: '2026-03-24',
  venue: 'Court A',
  defaultRate: 500,
  timeSlots: [],
  players: [],
  matchupState: null,
  roundHistory: [],
  playSystem: 'paddle-queue',
  deferredPlayerIds: [],
}

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and loads a session', () => {
    saveSession(mockSession)
    const loaded = loadSession()
    expect(loaded).toEqual(mockSession)
  })

  it('returns null when no session saved', () => {
    const loaded = loadSession()
    expect(loaded).toBeNull()
  })
})

describe('storage migration', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('migrates deferred status to active and initializes deferredPlayerIds', () => {
    const oldSession = {
      date: '2026-03-24',
      venue: 'Court A',
      defaultRate: 500,
      timeSlots: [],
      players: [
        { id: '1', name: 'Jason', arrivalTime: '14:00', departureTime: '18:00', status: 'deferred' },
        { id: '2', name: 'Lel', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
      ],
      rounds: [],
      playSystem: 'paddle-queue',
    }
    localStorage.setItem('pickleball-session', JSON.stringify(oldSession))
    const loaded = loadSession()
    expect(loaded!.players[0].status).toBe('active')
    expect(loaded!.players[1].status).toBe('active')
    expect(loaded!.deferredPlayerIds).toEqual([])
  })

})

describe('storage migration — rounds to matchupState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('migrates old rounds[] — last round becomes matchupState, rest become roundHistory', () => {
    const oldSession = {
      date: '2026-04-17',
      venue: 'Court A',
      defaultRate: 500,
      timeSlots: [],
      players: [
        { id: 'p1', name: 'A', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
        { id: 'p2', name: 'B', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
        { id: 'p3', name: 'C', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
        { id: 'p4', name: 'D', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
      ],
      rounds: [
        { id: 'r1', games: [{ court: 1, team1: ['p1', 'p2'], team2: ['p3', 'p4'] }], sittingOut: [] },
        { id: 'r2', games: [{ court: 1, team1: ['p3', 'p1'], team2: ['p2', 'p4'] }], sittingOut: [] },
      ],
      playSystem: 'paddle-queue',
      deferredPlayerIds: [],
    }
    localStorage.setItem('pickleball-session', JSON.stringify(oldSession))
    const loaded = loadSession()
    expect(loaded!.matchupState).toEqual({
      games: [{ court: 1, team1: ['p3', 'p1'], team2: ['p2', 'p4'] }],
      sittingOut: [],
    })
    expect(loaded!.roundHistory).toHaveLength(1)
    expect(loaded!.roundHistory[0].id).toBe('r1')
    expect((loaded as any).rounds).toBeUndefined()
  })

  it('migrates empty rounds[] — matchupState is null, roundHistory is empty', () => {
    const oldSession = {
      date: '2026-04-17',
      venue: 'Court A',
      defaultRate: 500,
      timeSlots: [],
      players: [],
      rounds: [],
      playSystem: 'paddle-queue',
      deferredPlayerIds: [],
    }
    localStorage.setItem('pickleball-session', JSON.stringify(oldSession))
    const loaded = loadSession()
    expect(loaded!.matchupState).toBeNull()
    expect(loaded!.roundHistory).toEqual([])
  })

  it('migrates single round — matchupState from that round, empty roundHistory', () => {
    const oldSession = {
      date: '2026-04-17',
      venue: 'Court A',
      defaultRate: 500,
      timeSlots: [],
      players: [
        { id: 'p1', name: 'A', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
        { id: 'p2', name: 'B', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
        { id: 'p3', name: 'C', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
        { id: 'p4', name: 'D', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
      ],
      rounds: [
        { id: 'r1', games: [{ court: 1, team1: ['p1', 'p2'], team2: ['p3', 'p4'] }], sittingOut: [] },
      ],
      playSystem: 'paddle-queue',
      deferredPlayerIds: [],
    }
    localStorage.setItem('pickleball-session', JSON.stringify(oldSession))
    const loaded = loadSession()
    expect(loaded!.matchupState).toEqual({
      games: [{ court: 1, team1: ['p1', 'p2'], team2: ['p3', 'p4'] }],
      sittingOut: [],
    })
    expect(loaded!.roundHistory).toEqual([])
  })

  it('loads new format correctly', () => {
    const newSession = {
      date: '2026-04-17',
      venue: 'Court A',
      defaultRate: 500,
      timeSlots: [],
      players: [],
      matchupState: null,
      roundHistory: [],
      playSystem: 'paddle-queue',
      deferredPlayerIds: [],
    }
    localStorage.setItem('pickleball-session', JSON.stringify(newSession))
    const loaded = loadSession()
    expect(loaded!.matchupState).toBeNull()
    expect(loaded!.roundHistory).toEqual([])
  })

  it('gracefully removes stale player IDs from matchupState instead of nuking', () => {
    const session = {
      date: '2026-04-17',
      venue: 'Court A',
      defaultRate: 500,
      timeSlots: [],
      players: [
        { id: 'p1', name: 'A', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
        { id: 'p2', name: 'B', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
        { id: 'p3', name: 'C', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
      ],
      matchupState: {
        games: [{ court: 1, team1: ['p1', 'p2'], team2: ['p3', 'stale-id'] }],
        sittingOut: ['stale-id-2'],
      },
      roundHistory: [],
      playSystem: 'paddle-queue',
      deferredPlayerIds: ['stale-id'],
    }
    localStorage.setItem('pickleball-session', JSON.stringify(session))
    const loaded = loadSession()
    // Stale IDs removed from deferredPlayerIds
    expect(loaded!.deferredPlayerIds).toEqual([])
    // Game with stale player dissolved, remaining go to front of queue
    expect(loaded!.matchupState!.games).toHaveLength(0)
    expect(loaded!.matchupState!.sittingOut).toEqual(['p1', 'p2', 'p3'])
  })
})

describe('venue storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty array when no venues saved', () => {
    expect(loadVenues()).toEqual([])
  })

  it('saves and loads venues', () => {
    const venues: SavedVenue[] = [
      { id: '1', name: 'BGC Courts', defaultRate: 500 },
    ]
    saveVenues(venues)
    expect(loadVenues()).toEqual(venues)
  })
})

describe('player storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty array when no players saved', () => {
    expect(loadPlayers()).toEqual([])
  })

  it('saves and loads players', () => {
    const players: SavedPlayer[] = [
      { id: '1', name: 'Jason' },
    ]
    savePlayers(players)
    expect(loadPlayers()).toEqual(players)
  })
})
