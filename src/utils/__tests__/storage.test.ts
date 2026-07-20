import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveSessions, loadSessions, saveVenues, loadVenues,
  savePlayers, loadPlayers, saveCalculator, loadCalculator,
} from '../storage'
import type { Session } from '../../types'

function newShapeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1', createdAt: '2026-07-20T00:00:00.000Z', status: 'active',
    date: '2026-07-20', venue: 'BGC', numCourts: 2, courtAmount: 2000,
    playSystem: 'round-robin', players: [],
    liveGames: [], matchHistory: [], queue: [], courtWinners: {},
    ...overrides,
  }
}

describe('storage', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips new-shape sessions', () => {
    const s = newShapeSession()
    saveSessions([s])
    expect(loadSessions()).toEqual([s])
  })

  it('discards sessions missing the games-first fields', () => {
    localStorage.setItem('pickleball-sessions', JSON.stringify([
      newShapeSession(),
      { id: 'old', roundHistory: [], matchupState: null, players: [] },
    ]))
    const loaded = loadSessions()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('s1')
  })

  it('returns [] for corrupt or non-array session data', () => {
    localStorage.setItem('pickleball-sessions', 'not json')
    expect(loadSessions()).toEqual([])
    localStorage.setItem('pickleball-sessions', '{"a":1}')
    expect(loadSessions()).toEqual([])
  })

  it('round-trips venues and players', () => {
    saveVenues([{ id: 'v1', name: 'BGC' }])
    savePlayers([{ id: 'p1', name: 'Migs' }])
    expect(loadVenues()).toEqual([{ id: 'v1', name: 'BGC' }])
    expect(loadPlayers()).toEqual([{ id: 'p1', name: 'Migs' }])
  })

  it('round-trips calculator state and falls back on empty/corrupt data', () => {
    expect(loadCalculator()).toEqual({ defaultRate: '', rows: [] })
    saveCalculator({ defaultRate: '350', rows: [{ id: 'r1', hours: '2', courts: '2', rate: '' }] })
    expect(loadCalculator()).toEqual({ defaultRate: '350', rows: [{ id: 'r1', hours: '2', courts: '2', rate: '' }] })
    localStorage.setItem('pickleball-calculator', 'not json')
    expect(loadCalculator()).toEqual({ defaultRate: '', rows: [] })
  })
})
