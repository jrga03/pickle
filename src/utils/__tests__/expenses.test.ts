import { describe, it, expect } from 'vitest'
import { calculateFlatSplit, formatExpenseText } from '../expenses'
import { createNewSession, checkInPlayer, checkOutPlayer } from '../sessionOps'

const session = () => {
  let s = createNewSession({
    date: '2026-07-18', venue: 'BGC Courts', numCourts: 2,
    courtAmount: 2000, playSystem: 'paddle-queue',
    playerNames: ['Cara', 'Alice', 'Ben', 'Dan'],
  })
  // Alice, Ben, Cara check in; Dan never does
  for (const name of ['Alice', 'Ben', 'Cara']) {
    s = checkInPlayer(s, s.players.find(p => p.name === name)!.id)
  }
  return s
}

describe('calculateFlatSplit', () => {
  it('splits total evenly among participated players only', () => {
    const split = calculateFlatSplit(session())
    expect(split.total).toBe(2000)
    expect(split.participants.map(p => p.name)).toEqual(['Alice', 'Ben', 'Cara'])
    expect(split.perHead).toBeCloseTo(2000 / 3)
  })

  it('keeps checked-out players in the split (participated is sticky)', () => {
    let s = session()
    s = checkOutPlayer(s, s.players.find(p => p.name === 'Ben')!.id)
    const split = calculateFlatSplit(s)
    expect(split.participants.map(p => p.name)).toEqual(['Alice', 'Ben', 'Cara'])
  })

  it('returns null perHead when amount is null', () => {
    const s = { ...session(), courtAmount: null }
    const split = calculateFlatSplit(s)
    expect(split.total).toBeNull()
    expect(split.perHead).toBeNull()
    expect(split.participants).toHaveLength(3)
  })

  it('returns null perHead when nobody participated', () => {
    const s = createNewSession({
      date: '2026-07-18', venue: '', numCourts: 1,
      courtAmount: 1000, playSystem: 'paddle-queue', playerNames: ['Alice'],
    })
    const split = calculateFlatSplit(s)
    expect(split.participants).toEqual([])
    expect(split.perHead).toBeNull()
  })
})

describe('formatExpenseText', () => {
  it('formats date, venue, total, per-head, and participant names', () => {
    const text = formatExpenseText(session())
    expect(text).toContain('2026-07-18')
    expect(text).toContain('BGC Courts')
    expect(text).toContain('Total: 2000.00')
    expect(text).toContain(`÷ 3 players = ${(2000 / 3).toFixed(2)} each`)
    expect(text).toContain('Alice')
    expect(text).toContain('Ben')
    expect(text).toContain('Cara')
    expect(text).not.toContain('Dan')
  })

  it('omits venue and money lines when absent', () => {
    const s = { ...session(), venue: '', courtAmount: null }
    const text = formatExpenseText(s)
    expect(text).not.toContain('BGC')
    expect(text).not.toContain('Total:')
    expect(text).toContain('Alice')
  })
})
