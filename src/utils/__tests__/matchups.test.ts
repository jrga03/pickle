import { describe, it, expect } from 'vitest'
import { generatePaddleQueueMatchups, generateRoundRobinMatchups, generateChallengeCourtMatchups } from '../matchups'

describe('generatePaddleQueueMatchups', () => {
  it('assigns 4 players to 1 court', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4']
    const round = generatePaddleQueueMatchups(playerIds, 1)
    expect(round.games).toHaveLength(1)
    expect(round.games[0].team1).toHaveLength(2)
    expect(round.games[0].team2).toHaveLength(2)
    expect(round.sittingOut).toHaveLength(0)
  })

  it('handles more players than court capacity', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
    const round = generatePaddleQueueMatchups(playerIds, 1)
    expect(round.games).toHaveLength(1)
    expect(round.sittingOut).toHaveLength(2)
  })

  it('fills multiple courts', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']
    const round = generatePaddleQueueMatchups(playerIds, 2)
    expect(round.games).toHaveLength(2)
    expect(round.sittingOut).toHaveLength(0)
  })

  it('handles fewer than 4 players gracefully', () => {
    const playerIds = ['p1', 'p2', 'p3']
    const round = generatePaddleQueueMatchups(playerIds, 1)
    expect(round.games).toHaveLength(0)
    expect(round.sittingOut).toHaveLength(3)
  })
})

describe('generateRoundRobinMatchups', () => {
  it('generates a round with unique pairings', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4']
    const previousRounds: { games: { team1: [string, string]; team2: [string, string] }[] }[] = []
    const round = generateRoundRobinMatchups(playerIds, 1, previousRounds)
    expect(round.games).toHaveLength(1)
    // All 4 players should be playing
    const allPlaying = [...round.games[0].team1, ...round.games[0].team2]
    expect(new Set(allPlaying).size).toBe(4)
  })

  it('tries to avoid repeating partner pairings', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4']
    const round1 = generateRoundRobinMatchups(playerIds, 1, [])
    const round2 = generateRoundRobinMatchups(playerIds, 1, [round1])
    // With 4 players, there are only 3 possible partner combos, so round 2 should differ
    const r1Partners = new Set([
      round1.games[0].team1.sort().join(','),
      round1.games[0].team2.sort().join(','),
    ])
    const r2Partners = new Set([
      round2.games[0].team1.sort().join(','),
      round2.games[0].team2.sort().join(','),
    ])
    // At least one pairing should be different
    const overlap = [...r2Partners].filter(p => r1Partners.has(p))
    expect(overlap.length).toBeLessThan(2)
  })
})

describe('deferred player priority', () => {
  it('paddle queue places deferred players in games first', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
    const deferredIds = ['p5', 'p6']
    const round = generatePaddleQueueMatchups(playerIds, 1, deferredIds)
    const playing = [...round.games[0].team1, ...round.games[0].team2]
    expect(playing).toContain('p5')
    expect(playing).toContain('p6')
  })

  it('round robin places deferred players in games first', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
    const deferredIds = ['p5', 'p6']
    const round = generateRoundRobinMatchups(playerIds, 1, [], deferredIds)
    const playing = [...round.games[0].team1, ...round.games[0].team2]
    expect(playing).toContain('p5')
    expect(playing).toContain('p6')
  })

  it('challenge court places deferred players in games first', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
    const deferredIds = ['p5', 'p6']
    const round = generateChallengeCourtMatchups(playerIds, 1, [], deferredIds)
    const playing = [...round.games[0].team1, ...round.games[0].team2]
    expect(playing).toContain('p5')
    expect(playing).toContain('p6')
  })
})
