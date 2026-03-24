import { describe, it, expect } from 'vitest'
import { calculateExpenses } from '../expenses'
import type { TimeSlot, Player } from '../../types'

describe('calculateExpenses', () => {
  const slots: TimeSlot[] = [
    { id: 's1', startTime: '13:00', endTime: '14:00', numCourts: 1 },
    { id: 's2', startTime: '14:00', endTime: '15:00', numCourts: 2 },
    { id: 's3', startTime: '15:00', endTime: '16:00', numCourts: 1 },
  ]

  const players: Player[] = [
    { id: 'p1', name: 'Alice', arrivalSlotId: 's1', status: 'active' },
    { id: 'p2', name: 'Bob', arrivalSlotId: 's1', status: 'active' },
    { id: 'p3', name: 'Carol', arrivalSlotId: 's1', status: 'active' },
    { id: 'p4', name: 'Dave', arrivalSlotId: 's1', status: 'active' },
    { id: 'p5', name: 'Eve', arrivalSlotId: 's1', status: 'active' },
    { id: 'p6', name: 'Frank', arrivalSlotId: 's1', status: 'active' },
    { id: 'p7', name: 'Grace', arrivalSlotId: 's2', status: 'active' },
  ]

  it('computes per-slot cost correctly', () => {
    const defaultRate = 500
    const allFromStart: Player[] = players.map(p => ({ ...p, arrivalSlotId: 's1' }))
    const result = calculateExpenses(slots, allFromStart, defaultRate)

    // s1: 1 court * 500 = 500, split by 7 = 71.43
    // s2: 2 courts * 500 = 1000, split by 7 = 142.86
    // s3: 1 court * 500 = 500, split by 7 = 71.43
    const aliceExpense = result.find(r => r.playerId === 'p1')!
    expect(aliceExpense.total).toBeCloseTo(285.71, 1)
  })

  it('handles late arrivals', () => {
    const defaultRate = 500
    const result = calculateExpenses(slots, players, defaultRate)

    // Alice (s1): 500/6 + 1000/7 + 500/7 = 83.33 + 142.86 + 71.43 = 297.62
    const alice = result.find(r => r.playerId === 'p1')!
    expect(alice.total).toBeCloseTo(297.62, 1)

    // Grace (s2): 0 + 1000/7 + 500/7 = 142.86 + 71.43 = 214.29
    const grace = result.find(r => r.playerId === 'p7')!
    expect(grace.total).toBeCloseTo(214.29, 1)
  })

  it('handles rate overrides', () => {
    const slotsWithOverride: TimeSlot[] = [
      { id: 's1', startTime: '13:00', endTime: '14:00', numCourts: 1, rateOverride: 800 },
    ]
    const twoPlayers: Player[] = [
      { id: 'p1', name: 'Alice', arrivalSlotId: 's1', status: 'active' },
      { id: 'p2', name: 'Bob', arrivalSlotId: 's1', status: 'active' },
    ]
    const result = calculateExpenses(slotsWithOverride, twoPlayers, 500)
    // 1 * 800 / 2 = 400
    expect(result[0].total).toBeCloseTo(400, 1)
  })

  it('excludes players who left before a slot', () => {
    const leftPlayers: Player[] = [
      { id: 'p1', name: 'Alice', arrivalSlotId: 's1', status: 'active' },
      { id: 'p2', name: 'Bob', arrivalSlotId: 's1', status: 'left' },
    ]
    const singleSlot: TimeSlot[] = [
      { id: 's1', startTime: '13:00', endTime: '14:00', numCourts: 1 },
    ]
    const result = calculateExpenses(singleSlot, leftPlayers, 500)
    const alice = result.find(r => r.playerId === 'p1')!
    const bob = result.find(r => r.playerId === 'p2')!
    expect(alice.total).toBeCloseTo(250, 1)
    expect(bob.total).toBeCloseTo(250, 1)
  })

  it('returns formatted share text', () => {
    const singleSlot: TimeSlot[] = [
      { id: 's1', startTime: '13:00', endTime: '14:00', numCourts: 1 },
    ]
    const twoPlayers: Player[] = [
      { id: 'p1', name: 'Alice', arrivalSlotId: 's1', status: 'active' },
      { id: 'p2', name: 'Bob', arrivalSlotId: 's1', status: 'active' },
    ]
    const result = calculateExpenses(singleSlot, twoPlayers, 500)
    expect(result).toHaveLength(2)
    expect(result[0]).toHaveProperty('playerName')
    expect(result[0]).toHaveProperty('total')
    expect(result[0]).toHaveProperty('slotBreakdown')
  })
})
