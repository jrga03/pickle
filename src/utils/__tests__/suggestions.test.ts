import { describe, it, expect } from 'vitest'
import { suggestFoursomes, suggestChallengers, gamesPlayedMap, MAX_SUGGESTIONS } from '../suggestions'
import type { CompletedGame } from '../../types'

function game(over: Partial<CompletedGame>): CompletedGame {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    court: 1, team1: ['a', 'b'], team2: ['c', 'd'],
    winner: 1, endedAt: '2026-07-20T10:00:00.000Z',
    ...over,
  }
}

describe('gamesPlayedMap', () => {
  it('counts appearances per player', () => {
    const map = gamesPlayedMap([
      game({ team1: ['a', 'b'], team2: ['c', 'd'] }),
      game({ team1: ['a', 'c'], team2: ['e', 'f'] }),
    ])
    expect(map.get('a')).toBe(2)
    expect(map.get('b')).toBe(1)
    expect(map.get('z')).toBeUndefined()
  })
})

describe('suggestFoursomes — paddle queue (FIFO)', () => {
  it('returns [] with fewer than 4 waiting', () => {
    expect(suggestFoursomes(['a', 'b', 'c'], [], 'paddle-queue')).toEqual([])
  })

  it('returns one candidate for exactly 4, split by queue order', () => {
    const result = suggestFoursomes(['a', 'b', 'c', 'd'], [], 'paddle-queue')
    expect(result).toEqual([{ team1: ['a', 'b'], team2: ['c', 'd'] }])
  })

  it('ranks by combined wait with the front-of-queue foursome first', () => {
    const result = suggestFoursomes(['a', 'b', 'c', 'd', 'e', 'f'], [], 'paddle-queue')
    expect(result).toHaveLength(15) // C(6,4)
    expect(result[0]).toEqual({ team1: ['a', 'b'], team2: ['c', 'd'] })
    // last candidate is the back-of-window foursome
    expect(result[14]).toEqual({ team1: ['c', 'd'], team2: ['e', 'f'] })
  })

  it('ignores players beyond the FIFO window of 6', () => {
    const result = suggestFoursomes(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], [], 'paddle-queue')
    const everyone = result.flatMap(c => [...c.team1, ...c.team2])
    expect(everyone).not.toContain('g')
    expect(everyone).not.toContain('h')
  })

  it('challenge-court free court behaves like FIFO', () => {
    const result = suggestFoursomes(['a', 'b', 'c', 'd', 'e'], [], 'challenge-court')
    expect(result[0]).toEqual({ team1: ['a', 'b'], team2: ['c', 'd'] })
  })
})

describe('suggestFoursomes — round robin (fairness)', () => {
  it('puts the lowest-game-count foursome first', () => {
    // e,f,g,h have 0 games; a,b,c,d have 1
    const history = [game({ team1: ['a', 'b'], team2: ['c', 'd'] })]
    const result = suggestFoursomes(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], history, 'round-robin')
    expect([...result[0].team1, ...result[0].team2].sort()).toEqual(['e', 'f', 'g', 'h'])
  })

  it('breaks game-count ties by queue position', () => {
    const result = suggestFoursomes(['a', 'b', 'c', 'd', 'e'], [], 'round-robin')
    expect([...result[0].team1, ...result[0].team2].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('splits to avoid repeat partnerships', () => {
    // a+b partnered before — best split of {a,b,c,d} must not pair them again
    const history = [game({ team1: ['a', 'b'], team2: ['e', 'f'] })]
    const [first] = suggestFoursomes(['a', 'b', 'c', 'd'], history, 'round-robin')
    const pairedAgain = (first.team1.includes('a') && first.team1.includes('b'))
      || (first.team2.includes('a') && first.team2.includes('b'))
    expect(pairedAgain).toBe(false)
  })

  it('breaks split ties by repeat opponents', () => {
    // no repeat partners possible to avoid entirely; a-vs-c happened, prefer split avoiding it
    const history = [
      game({ team1: ['a', 'x'], team2: ['c', 'y'] }), // a and c were opponents
    ]
    const [first] = suggestFoursomes(['a', 'b', 'c', 'd'], history, 'round-robin')
    const opponentsAgain = (first.team1.includes('a') && first.team2.includes('c'))
      || (first.team2.includes('a') && first.team1.includes('c'))
    expect(opponentsAgain).toBe(false)
  })

  it('caps at MAX_SUGGESTIONS', () => {
    const queue = 'abcdefghijkl'.split('') // 12 waiting → window 10 → C(10,4)=210
    const result = suggestFoursomes(queue, [], 'round-robin')
    expect(result).toHaveLength(MAX_SUGGESTIONS)
  })

  it('is deterministic', () => {
    const queue = 'abcdefgh'.split('')
    const history = [game({ team1: ['a', 'b'], team2: ['c', 'd'] })]
    expect(suggestFoursomes(queue, history, 'round-robin'))
      .toEqual(suggestFoursomes(queue, history, 'round-robin'))
  })
})

describe('suggestChallengers', () => {
  it('returns [] with fewer than 2 waiting', () => {
    expect(suggestChallengers(['a'], ['w1', 'w2'])).toEqual([])
  })

  it('locks winners as team1 and ranks pairs by combined wait', () => {
    const result = suggestChallengers(['a', 'b', 'c'], ['w1', 'w2'])
    expect(result[0]).toEqual({ team1: ['w1', 'w2'], team2: ['a', 'b'] })
    expect(result[1]).toEqual({ team1: ['w1', 'w2'], team2: ['a', 'c'] })
    expect(result[2]).toEqual({ team1: ['w1', 'w2'], team2: ['b', 'c'] })
  })

  it('caps at 15 pairs from the window of 6', () => {
    const result = suggestChallengers('abcdefgh'.split(''), ['w1', 'w2'])
    expect(result).toHaveLength(15) // C(6,2)
    const challengers = result.flatMap(c => c.team2)
    expect(challengers).not.toContain('g')
    expect(challengers).not.toContain('h')
  })
})
