import { describe, it, expect, beforeEach } from 'vitest'
import { saveSession, loadSession } from '../storage'
import type { Session } from '../../types'

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
