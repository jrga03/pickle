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
    { id: 'p1', name: 'Alice', arrivalTime: '13:00', departureTime: '16:00', status: 'active' },
    { id: 'p2', name: 'Bob', arrivalTime: '13:00', departureTime: '16:00', status: 'active' },
    { id: 'p3', name: 'Carol', arrivalTime: '13:00', departureTime: '16:00', status: 'active' },
    { id: 'p4', name: 'Dave', arrivalTime: '13:00', departureTime: '16:00', status: 'active' },
    { id: 'p5', name: 'Eve', arrivalTime: '13:00', departureTime: '16:00', status: 'active' },
    { id: 'p6', name: 'Frank', arrivalTime: '13:00', departureTime: '16:00', status: 'active' },
    { id: 'p7', name: 'Grace', arrivalTime: '14:00', departureTime: '16:00', status: 'active' },
  ]

  it('computes per-slot cost correctly', () => {
    const defaultRate = 500
    const allFromStart: Player[] = players.map(p => ({ ...p, arrivalTime: '13:00', departureTime: '16:00' }))
    const result = calculateExpenses(slots, allFromStart, defaultRate)

    const aliceExpense = result.find(r => r.playerId === 'p1')!
    expect(aliceExpense.total).toBeCloseTo(285.71, 1)
  })

  it('handles late arrivals', () => {
    const defaultRate = 500
    const result = calculateExpenses(slots, players, defaultRate)

    // Alice (13-16): 500/6 + 1000/7 + 500/7 = 83.33 + 142.86 + 71.43 = 297.62
    const alice = result.find(r => r.playerId === 'p1')!
    expect(alice.total).toBeCloseTo(297.62, 1)

    // Grace (14-16): 0 + 1000/7 + 500/7 = 142.86 + 71.43 = 214.29
    const grace = result.find(r => r.playerId === 'p7')!
    expect(grace.total).toBeCloseTo(214.29, 1)
  })

  it('handles early departures', () => {
    const defaultRate = 500
    // Eve leaves at 15:00 (not present for s3: 15-16)
    const withEarlyDeparture: Player[] = players.map(p =>
      p.id === 'p5' ? { ...p, departureTime: '15:00' } : p
    )
    const result = calculateExpenses(slots, withEarlyDeparture, defaultRate)

    // Eve: s1 (500/6=83.33) + s2 (1000/7=142.86) + s3 (not present) = 226.19
    const eve = result.find(r => r.playerId === 'p5')!
    expect(eve.total).toBeCloseTo(226.19, 1)

    // Others in s3: 6 players (p1-p4, p6, p7) → 500/6 = 83.33
    const alice = result.find(r => r.playerId === 'p1')!
    const aliceS3 = alice.slotBreakdown.find(s => s.slotId === 's3')!
    expect(aliceS3.share).toBeCloseTo(83.33, 1)
  })

  it('handles rate overrides', () => {
    const slotsWithOverride: TimeSlot[] = [
      { id: 's1', startTime: '13:00', endTime: '14:00', numCourts: 1, rateOverride: 800 },
    ]
    const twoPlayers: Player[] = [
      { id: 'p1', name: 'Alice', arrivalTime: '13:00', departureTime: '14:00', status: 'active' },
      { id: 'p2', name: 'Bob', arrivalTime: '13:00', departureTime: '14:00', status: 'active' },
    ]
    const result = calculateExpenses(slotsWithOverride, twoPlayers, 500)
    expect(result[0].total).toBeCloseTo(400, 1)
  })

  it('includes left players in expense for slots they attended', () => {
    const leftPlayers: Player[] = [
      { id: 'p1', name: 'Alice', arrivalTime: '13:00', departureTime: '14:00', status: 'active' },
      { id: 'p2', name: 'Bob', arrivalTime: '13:00', departureTime: '14:00', status: 'left' },
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
      { id: 'p1', name: 'Alice', arrivalTime: '13:00', departureTime: '14:00', status: 'active' },
      { id: 'p2', name: 'Bob', arrivalTime: '13:00', departureTime: '14:00', status: 'active' },
    ]
    const result = calculateExpenses(singleSlot, twoPlayers, 500)
    expect(result).toHaveLength(2)
    expect(result[0]).toHaveProperty('playerName')
    expect(result[0]).toHaveProperty('total')
    expect(result[0]).toHaveProperty('slotBreakdown')
  })
})
