import { describe, it, expect, beforeEach } from 'vitest'
import { saveSessions, loadSessions, saveVenues, loadVenues, savePlayers, loadPlayers } from '../storage'
import { createNewSession } from '../sessionOps'

const SESSIONS_KEY = 'pickleball-sessions'
const LEGACY_KEY = 'pickleball-session'

const sample = () => createNewSession({
  date: '2026-07-18', venue: 'BGC Courts', numCourts: 2,
  courtAmount: 2000, playSystem: 'paddle-queue', playerNames: ['Alice'],
})

describe('sessions storage', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips sessions', () => {
    const s = sample()
    saveSessions([s])
    expect(loadSessions()).toEqual([s])
  })

  it('returns [] when nothing stored', () => {
    expect(loadSessions()).toEqual([])
  })

  it('returns [] on corrupt sessions data', () => {
    localStorage.setItem(SESSIONS_KEY, '{nope')
    expect(loadSessions()).toEqual([])
  })
})

describe('legacy migration', () => {
  beforeEach(() => localStorage.clear())

  const legacy = {
    date: '2026-03-24',
    venue: 'Court A',
    defaultRate: 500,
    timeSlots: [
      { id: 't1', startTime: '14:00', endTime: '16:00', numCourts: 2 },
      { id: 't2', startTime: '16:00', endTime: '17:00', numCourts: 3, rateOverride: 600 },
    ],
    players: [
      { id: 'p1', name: 'Alice', arrivalTime: '14:00', departureTime: '17:00', status: 'active' },
      { id: 'p2', name: 'Ben', arrivalTime: '14:00', departureTime: '16:00', status: 'left' },
    ],
    matchupState: { games: [], sittingOut: ['p1', 'ghost'] },
    roundHistory: [],
    playSystem: 'challenge-court',
    deferredPlayerIds: ['p1', 'ghost'],
  }

  it('migrates the legacy session into the array and removes the legacy key', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy))
    const sessions = loadSessions()
    expect(sessions).toHaveLength(1)
    const s = sessions[0]
    expect(s.id).toBeTruthy()
    expect(s.status).toBe('ended') // past date
    expect(s.numCourts).toBe(3)    // max across slots
    // 2h × 2 courts × 500 + 1h × 3 courts × 600 = 2000 + 1800
    expect(s.courtAmount).toBe(3800)
    expect(s.playSystem).toBe('challenge-court')
    expect(s.players).toEqual([
      expect.objectContaining({ id: 'p1', name: 'Alice', checkedIn: true, participated: true }),
      expect.objectContaining({ id: 'p2', name: 'Ben', checkedIn: false, participated: true }),
    ])
    expect(s.matchupState!.sittingOut).toEqual(['p1']) // ghost dropped
    expect(s.deferredPlayerIds).toEqual(['p1'])
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
    expect(localStorage.getItem(SESSIONS_KEY)).not.toBeNull()
  })

  it('marks a legacy session dated today as active', () => {
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ ...legacy, date: today }))
    expect(loadSessions()[0].status).toBe('active')
  })

  it('converts the oldest rounds[] format to matchupState + roundHistory', () => {
    const { matchupState: _m, roundHistory: _r, ...rest } = legacy
    const withRounds = {
      ...rest,
      rounds: [
        { id: 'r1', games: [], sittingOut: ['p1'] },
        { id: 'r2', games: [], sittingOut: ['p2'] },
      ],
    }
    localStorage.setItem(LEGACY_KEY, JSON.stringify(withRounds))
    const s = loadSessions()[0]
    expect(s.roundHistory).toHaveLength(1)
    expect(s.roundHistory[0].id).toBe('r1')
    expect(s.matchupState).toEqual({ games: [], sittingOut: ['p2'] })
  })

  it('returns [] for corrupt legacy data', () => {
    localStorage.setItem(LEGACY_KEY, '{nope')
    expect(loadSessions()).toEqual([])
  })
})

describe('venues and players storage', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips venues', () => {
    const venues = [{ id: 'v1', name: 'BGC Courts' }]
    saveVenues(venues)
    expect(loadVenues()).toEqual(venues)
  })

  it('round-trips players', () => {
    const players = [{ id: 'sp1', name: 'Alice' }]
    savePlayers(players)
    expect(loadPlayers()).toEqual(players)
  })
})
