import { describe, it, expect, beforeEach } from 'vitest'
import { saveSession, loadSession, saveVenues, loadVenues, savePlayers, loadPlayers } from '../storage'
import type { Session, SavedVenue, SavedPlayer } from '../../types'

const mockSession: Session = {
  date: '2026-03-24',
  venue: 'Court A',
  defaultRate: 500,
  timeSlots: [],
  players: [],
  rounds: [],
  playSystem: 'paddle-queue',
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
