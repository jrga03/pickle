import { describe, it, expect } from 'vitest'
import { computePlayerStats, winStreak } from '../stats'
import type { CompletedGame } from '../../types'

let n = 0
function game(over: Partial<CompletedGame>): CompletedGame {
  return {
    id: `g${++n}`, court: 1, team1: ['a', 'b'], team2: ['c', 'd'],
    winner: 1, endedAt: '2026-07-20T10:00:00.000Z', ...over,
  }
}

describe('computePlayerStats', () => {
  it('tallies games, wins, losses per player', () => {
    const stats = computePlayerStats([
      game({ winner: 1 }),                                  // a,b win; c,d lose
      game({ team1: ['a', 'c'], team2: ['b', 'd'], winner: 2 }), // b,d win; a,c lose
    ])
    expect(stats.get('a')).toEqual({ games: 2, wins: 1, losses: 1 })
    expect(stats.get('b')).toEqual({ games: 2, wins: 2, losses: 0 })
    expect(stats.get('c')).toEqual({ games: 2, wins: 0, losses: 2 })
    expect(stats.get('z')).toBeUndefined()
  })
})

describe('winStreak', () => {
  it('counts consecutive wins by the same pair on the court, order-insensitive', () => {
    const history = [
      game({ winner: 1, team1: ['a', 'b'] }),
      game({ winner: 1, team1: ['b', 'a'], team2: ['e', 'f'] }),
    ]
    expect(winStreak(history, 1, ['a', 'b'])).toBe(2)
  })

  it('stops at a game the pair did not win on that court', () => {
    const history = [
      game({ winner: 2, team1: ['a', 'b'] }),               // c,d won
      game({ winner: 1, team1: ['a', 'b'], team2: ['c', 'd'] }),
    ]
    expect(winStreak(history, 1, ['a', 'b'])).toBe(1)
  })

  it('ignores games on other courts', () => {
    const history = [
      game({ winner: 1, team1: ['a', 'b'] }),
      game({ winner: 2, court: 2, team1: ['a', 'b'] }),
    ]
    expect(winStreak(history, 1, ['a', 'b'])).toBe(1)
  })

  it('is 0 with no matching games', () => {
    expect(winStreak([], 1, ['a', 'b'])).toBe(0)
  })
})
