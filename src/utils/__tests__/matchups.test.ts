import { describe, it, expect } from 'vitest'
import {
  generatePaddleQueueMatchups,
  generateRoundRobinMatchups,
  generateChallengeCourtMatchups,
  rotateCourt,
  rotateChallengeCourtSingle,
  rerollCourt,
  addPlayerToMatchups,
  removePlayerFromMatchups,
} from '../matchups'
import type { MatchupState } from '../../types'

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

describe('rotateCourt', () => {
  it('rotates court players to back of queue and fills from front', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: ['e', 'f', 'g', 'h'],
    }
    const result = rotateCourt(state, 1)
    expect(result.games[0].team1).toEqual(['e', 'f'])
    expect(result.games[0].team2).toEqual(['g', 'h'])
    expect(result.sittingOut).toEqual(['a', 'b', 'c', 'd'])
  })

  it('preserves queue order — court players go to back', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: ['e', 'f', 'g', 'h', 'i', 'j'],
    }
    const result = rotateCourt(state, 1)
    expect(result.sittingOut).toEqual(['i', 'j', 'a', 'b', 'c', 'd'])
  })

  it('works with exactly 4 players and empty queue', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: [],
    }
    const result = rotateCourt(state, 1)
    const allPlayers = [...result.games[0].team1, ...result.games[0].team2]
    expect(allPlayers.sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(result.sittingOut).toEqual([])
  })

  it('only rotates the specified court, leaving others untouched', () => {
    const state: MatchupState = {
      games: [
        { court: 1, team1: ['a', 'b'], team2: ['c', 'd'] },
        { court: 2, team1: ['e', 'f'], team2: ['g', 'h'] },
      ],
      sittingOut: ['i', 'j', 'k', 'l'],
    }
    const result = rotateCourt(state, 1)
    expect(result.games.find(g => g.court === 2)).toEqual({
      court: 2, team1: ['e', 'f'], team2: ['g', 'h'],
    })
    expect(result.games.find(g => g.court === 1)!.team1).toEqual(['i', 'j'])
    expect(result.games.find(g => g.court === 1)!.team2).toEqual(['k', 'l'])
    expect(result.sittingOut).toEqual(['a', 'b', 'c', 'd'])
  })

  it('returns state unchanged for nonexistent court', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: ['e', 'f'],
    }
    expect(rotateCourt(state, 99)).toEqual(state)
  })

  it('handles queue with fewer than 4 — dissolves game, all players go to queue', () => {
    const state: MatchupState = {
      games: [
        { court: 1, team1: ['a', 'b'], team2: ['c', 'd'] },
        { court: 2, team1: ['e', 'f'], team2: ['g', 'h'] },
      ],
      sittingOut: ['i', 'j'],
    }
    const result = rotateCourt(state, 1)
    expect(result.games.find(g => g.court === 1)!.team1).toEqual(['i', 'j'])
    expect(result.games.find(g => g.court === 1)!.team2).toEqual(['a', 'b'])
    expect(result.sittingOut).toEqual(['c', 'd'])
  })
})

describe('rotateChallengeCourtSingle', () => {
  it('winners stay, losers go to queue, 2 new from front', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: ['e', 'f', 'g', 'h'],
    }
    const result = rotateChallengeCourtSingle(state, 1, 'team1')
    expect(result.games[0].team1).toEqual(['a', 'b'])
    expect(result.games[0].team2).toEqual(['e', 'f'])
    expect(result.sittingOut).toEqual(['g', 'h', 'c', 'd'])
  })

  it('team2 wins — team2 stays as team1, new challengers as team2', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: ['e', 'f', 'g'],
    }
    const result = rotateChallengeCourtSingle(state, 1, 'team2')
    expect(result.games[0].team1).toEqual(['c', 'd'])
    expect(result.games[0].team2).toEqual(['e', 'f'])
    expect(result.sittingOut).toEqual(['g', 'a', 'b'])
  })

  it('with empty queue — losers go to queue then come right back', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: [],
    }
    const result = rotateChallengeCourtSingle(state, 1, 'team1')
    expect(result.games[0].team1).toEqual(['a', 'b'])
    expect(result.games[0].team2).toEqual(['c', 'd'])
    expect(result.sittingOut).toEqual([])
  })

  it('with only 1 in queue — losers go to queue, 2 pulled back', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: ['e'],
    }
    const result = rotateChallengeCourtSingle(state, 1, 'team1')
    expect(result.games[0].team1).toEqual(['a', 'b'])
    expect(result.games[0].team2).toEqual(['e', 'c'])
    expect(result.sittingOut).toEqual(['d'])
  })

  it('only rotates specified court', () => {
    const state: MatchupState = {
      games: [
        { court: 1, team1: ['a', 'b'], team2: ['c', 'd'] },
        { court: 2, team1: ['e', 'f'], team2: ['g', 'h'] },
      ],
      sittingOut: ['i', 'j'],
    }
    const result = rotateChallengeCourtSingle(state, 1, 'team1')
    expect(result.games.find(g => g.court === 2)).toEqual({
      court: 2, team1: ['e', 'f'], team2: ['g', 'h'],
    })
  })

  it('returns state unchanged for nonexistent court', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: [],
    }
    expect(rotateChallengeCourtSingle(state, 99, 'team1')).toEqual(state)
  })
})

describe('rerollCourt', () => {
  it('produces a different team arrangement with same players', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: ['e'],
    }
    const result = rerollCourt(state, 1)
    const originalPlayers = ['a', 'b', 'c', 'd'].sort()
    const newPlayers = [...result.games[0].team1, ...result.games[0].team2].sort()
    expect(newPlayers).toEqual(originalPlayers)
    const originalTeams = [['a', 'b'].sort().join(), ['c', 'd'].sort().join()].sort().join('|')
    const newTeams = [
      [...result.games[0].team1].sort().join(),
      [...result.games[0].team2].sort().join(),
    ].sort().join('|')
    expect(newTeams).not.toEqual(originalTeams)
  })

  it('does not modify the sitting out queue', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: ['e', 'f'],
    }
    const result = rerollCourt(state, 1)
    expect(result.sittingOut).toEqual(['e', 'f'])
  })

  it('does not modify other courts', () => {
    const state: MatchupState = {
      games: [
        { court: 1, team1: ['a', 'b'], team2: ['c', 'd'] },
        { court: 2, team1: ['e', 'f'], team2: ['g', 'h'] },
      ],
      sittingOut: [],
    }
    const result = rerollCourt(state, 1)
    expect(result.games.find(g => g.court === 2)).toEqual({
      court: 2, team1: ['e', 'f'], team2: ['g', 'h'],
    })
  })

  it('returns state unchanged for nonexistent court', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: [],
    }
    expect(rerollCourt(state, 99)).toEqual(state)
  })

  it('always produces one of the 3 valid 2v2 arrangements', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: [],
    }
    const validArrangements = new Set([
      'a,b|c,d',
      'a,c|b,d',
      'a,d|b,c',
    ])
    const result = rerollCourt(state, 1)
    const teams = [
      [...result.games[0].team1].sort().join(','),
      [...result.games[0].team2].sort().join(','),
    ].sort().join('|')
    expect(validArrangements.has(teams)).toBe(true)
  })
})

describe('addPlayerToMatchups', () => {
  it('appends player to end of sitting out queue', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: ['e', 'f'],
    }
    const result = addPlayerToMatchups(state, 'g')
    expect(result.sittingOut).toEqual(['e', 'f', 'g'])
  })

  it('appends to empty queue', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: [],
    }
    const result = addPlayerToMatchups(state, 'e')
    expect(result.sittingOut).toEqual(['e'])
  })

  it('does not modify games', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: [],
    }
    const result = addPlayerToMatchups(state, 'e')
    expect(result.games).toEqual(state.games)
  })

  it('preserves queue order when adding multiple players sequentially', () => {
    let state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: [],
    }
    state = addPlayerToMatchups(state, 'e')
    state = addPlayerToMatchups(state, 'f')
    state = addPlayerToMatchups(state, 'g')
    expect(state.sittingOut).toEqual(['e', 'f', 'g'])
  })
})

describe('removePlayerFromMatchups', () => {
  it('removes player from sitting out queue', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: ['e', 'f', 'g'],
    }
    const result = removePlayerFromMatchups(state, 'f')
    expect(result.sittingOut).toEqual(['e', 'g'])
  })

  it('removes from beginning of queue', () => {
    const state: MatchupState = {
      games: [],
      sittingOut: ['e', 'f', 'g'],
    }
    const result = removePlayerFromMatchups(state, 'e')
    expect(result.sittingOut).toEqual(['f', 'g'])
  })

  it('removes from end of queue', () => {
    const state: MatchupState = {
      games: [],
      sittingOut: ['e', 'f', 'g'],
    }
    const result = removePlayerFromMatchups(state, 'g')
    expect(result.sittingOut).toEqual(['e', 'f'])
  })

  it('replaces player on court team1 with first from queue', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: ['e', 'f'],
    }
    const result = removePlayerFromMatchups(state, 'a')
    expect(result.games[0].team1).toEqual(['e', 'b'])
    expect(result.sittingOut).toEqual(['f'])
  })

  it('replaces player on court team2 with first from queue', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: ['e', 'f'],
    }
    const result = removePlayerFromMatchups(state, 'd')
    expect(result.games[0].team2).toEqual(['c', 'e'])
    expect(result.sittingOut).toEqual(['f'])
  })

  it('dissolves game when no replacement available — remaining go to front of queue', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: [],
    }
    const result = removePlayerFromMatchups(state, 'b')
    expect(result.games).toHaveLength(0)
    expect(result.sittingOut).toEqual(['a', 'c', 'd'])
  })

  it('dissolves game with no replacement — preserves existing queue after remaining players', () => {
    const state: MatchupState = {
      games: [
        { court: 1, team1: ['a', 'b'], team2: ['c', 'd'] },
        { court: 2, team1: ['e', 'f'], team2: ['g', 'h'] },
      ],
      sittingOut: [],
    }
    const result = removePlayerFromMatchups(state, 'a')
    expect(result.games).toHaveLength(1)
    expect(result.games[0].court).toBe(2)
    expect(result.sittingOut).toEqual(['b', 'c', 'd'])
  })

  it('returns state unchanged for player not in matchups', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: ['e'],
    }
    expect(removePlayerFromMatchups(state, 'z')).toEqual(state)
  })

  it('handles removing player from second court', () => {
    const state: MatchupState = {
      games: [
        { court: 1, team1: ['a', 'b'], team2: ['c', 'd'] },
        { court: 2, team1: ['e', 'f'], team2: ['g', 'h'] },
      ],
      sittingOut: ['i', 'j'],
    }
    const result = removePlayerFromMatchups(state, 'f')
    expect(result.games.find(g => g.court === 2)!.team1).toEqual(['e', 'i'])
  })

  it('handles sequential removals correctly', () => {
    let state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: ['e', 'f', 'g'],
    }
    state = removePlayerFromMatchups(state, 'a')
    expect(state.games[0].team1).toEqual(['e', 'b'])
    expect(state.sittingOut).toEqual(['f', 'g'])
    state = removePlayerFromMatchups(state, 'b')
    expect(state.games[0].team1).toEqual(['e', 'f'])
    expect(state.sittingOut).toEqual(['g'])
  })
})
