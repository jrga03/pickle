# Court-Centric Matchup System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the matchup system from round-centric to court-centric, enabling per-court rotation, matchup overrides, and proper player add/remove handling.

**Architecture:** Split `rounds: Round[]` into `matchupState: MatchupState | null` (live court state) and `roundHistory: Round[]` (snapshots). New utility functions handle per-court rotation, re-rolling, and player mutations. Edit mode uses local component state for ephemeral changes.

**Tech Stack:** React 19, TypeScript, Vitest, Tailwind CSS v4

---

### Task 1: Update Types

**Files:**
- Modify: `src/types.ts`

**Step 1: Add MatchupState and update Session**

```typescript
// Add after the Game interface (line 25):

export interface MatchupState {
  games: Game[]
  sittingOut: string[]
}

// Update Session interface — replace `rounds: Round[]` with:
//   matchupState: MatchupState | null
//   roundHistory: Round[]
```

The full updated `Session` interface:

```typescript
export interface Session {
  date: string
  venue: string
  defaultRate: number
  timeSlots: TimeSlot[]
  players: Player[]
  matchupState: MatchupState | null
  roundHistory: Round[]
  playSystem: PlaySystem
  deferredPlayerIds: string[]
}
```

**Step 2: Verify build**

Run: `npx tsc -b --noEmit 2>&1 | head -30`
Expected: Type errors in files that still reference `session.rounds` — this is expected and will be fixed in subsequent tasks.

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "refactor: add MatchupState type and update Session interface"
```

---

### Task 2: Update Generation Functions to Return MatchupState

**Files:**
- Modify: `src/utils/matchups.ts`
- Test: `src/utils/__tests__/matchups.test.ts`

**Step 1: Run existing tests to confirm they pass**

Run: `npx vitest run src/utils/__tests__/matchups.test.ts`
Expected: All tests pass.

**Step 2: Update return types**

In `src/utils/matchups.ts`:

- Change import: `import type { Round, Game } from '../types'` → `import type { MatchupState, Game } from '../types'`
- `generatePaddleQueueRound` → return type `MatchupState`, remove `id: generateId()` from return, rename to `generatePaddleQueueMatchups`
- `generateRoundRobinRound` → same treatment, rename to `generateRoundRobinMatchups`
- `generateChallengeCourtRound` → same treatment, rename to `generateChallengeCourtMatchups`
- Remove the `generateId` constant (no longer needed in this file)
- `getPreviousPartners` parameter type changes from custom inline type to use `MatchupState`:
  ```typescript
  function getPreviousPartners(
    previousRounds: { games: { team1: [string, string]; team2: [string, string] }[] }[],
  ): Set<string> {
  ```
  Keep this signature as-is since it accepts both `Round` and `MatchupState`.
- `generateRoundRobinMatchups` parameter `previousRounds` keeps the same flexible type.

Updated function signatures:

```typescript
export function generatePaddleQueueMatchups(
  playerIds: string[],
  numCourts: number,
  deferredPlayerIds: string[] = [],
): MatchupState {
  // ... same body, but return { games, sittingOut } without id
}

export function generateRoundRobinMatchups(
  playerIds: string[],
  numCourts: number,
  previousRounds: { games: { team1: [string, string]; team2: [string, string] }[] }[],
  deferredPlayerIds: string[] = [],
): MatchupState {
  // ... same body, but all `Round` references become `MatchupState`
  // The inner bestRound variable and return become MatchupState (no id)
}

export function generateChallengeCourtMatchups(
  playerIds: string[],
  numCourts: number,
  stayingPlayerIds: string[] = [],
  deferredPlayerIds: string[] = [],
): MatchupState {
  // ... same body, return { games, sittingOut } without id
}
```

**Step 3: Update test imports**

In `src/utils/__tests__/matchups.test.ts`, update the import:

```typescript
import { generatePaddleQueueMatchups, generateRoundRobinMatchups, generateChallengeCourtMatchups } from '../matchups'
```

And rename all `generatePaddleQueueRound` → `generatePaddleQueueMatchups`, `generateRoundRobinRound` → `generateRoundRobinMatchups`, `generateChallengeCourtRound` → `generateChallengeCourtMatchups` throughout the test file. Variable names like `round` can stay as-is (they're local).

**Step 4: Run tests**

Run: `npx vitest run src/utils/__tests__/matchups.test.ts`
Expected: All tests pass (tests never asserted on `.id`).

**Step 5: Commit**

```bash
git add src/utils/matchups.ts src/utils/__tests__/matchups.test.ts
git commit -m "refactor: generation functions return MatchupState instead of Round"
```

---

### Task 3: Court Rotation Utilities + Tests

**Files:**
- Modify: `src/utils/matchups.ts`
- Modify: `src/utils/__tests__/matchups.test.ts`

**Step 1: Write failing tests for `rotateCourt`**

Add to `src/utils/__tests__/matchups.test.ts`:

```typescript
import {
  generatePaddleQueueMatchups,
  generateRoundRobinMatchups,
  generateChallengeCourtMatchups,
  rotateCourt,
  rotateChallengeCourtSingle,
} from '../matchups'
import type { MatchupState } from '../../types'

describe('rotateCourt', () => {
  it('rotates court players to back of queue and fills from front', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: ['e', 'f', 'g', 'h'],
    }
    const result = rotateCourt(state, 1)
    // e, f, g, h were in queue; a, b, c, d go to back
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
    // Court players go to queue, then 4 pulled back — same players, reshuffled position
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
    // Court 2 untouched
    expect(result.games.find(g => g.court === 2)).toEqual({
      court: 2, team1: ['e', 'f'], team2: ['g', 'h'],
    })
    // Court 1 rotated
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
    // 2 courts, 10 players total. Court 1 rotates but only 2 in queue.
    const state: MatchupState = {
      games: [
        { court: 1, team1: ['a', 'b'], team2: ['c', 'd'] },
        { court: 2, team1: ['e', 'f'], team2: ['g', 'h'] },
      ],
      sittingOut: ['i', 'j'],
    }
    const result = rotateCourt(state, 1)
    // Queue becomes [i, j, a, b, c, d], pull 4 → [i, j, a, b] on court, queue = [c, d]
    expect(result.games.find(g => g.court === 1)!.team1).toEqual(['i', 'j'])
    expect(result.games.find(g => g.court === 1)!.team2).toEqual(['a', 'b'])
    expect(result.sittingOut).toEqual(['c', 'd'])
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/__tests__/matchups.test.ts`
Expected: FAIL — `rotateCourt` is not exported.

**Step 3: Implement `rotateCourt`**

Add to `src/utils/matchups.ts`:

```typescript
export function rotateCourt(
  state: MatchupState,
  courtNumber: number,
): MatchupState {
  const gameIndex = state.games.findIndex(g => g.court === courtNumber)
  if (gameIndex === -1) return state

  const game = state.games[gameIndex]
  const courtPlayers = [...game.team1, ...game.team2]

  // Court players go to back of queue, then pull next 4 from front
  const newQueue = [...state.sittingOut, ...courtPlayers]
  const incoming = newQueue.splice(0, 4)

  const newGames = [...state.games]
  if (incoming.length >= 4) {
    newGames[gameIndex] = {
      court: courtNumber,
      team1: [incoming[0], incoming[1]],
      team2: [incoming[2], incoming[3]],
    }
  } else {
    // Fewer than 4 total — can't form a game
    newGames.splice(gameIndex, 1)
    newQueue.unshift(...incoming)
  }

  return { games: newGames, sittingOut: newQueue }
}
```

Add `MatchupState` to the import from `'../types'`.

**Step 4: Run tests**

Run: `npx vitest run src/utils/__tests__/matchups.test.ts`
Expected: All `rotateCourt` tests pass.

**Step 5: Write failing tests for `rotateChallengeCourtSingle`**

Add to test file:

```typescript
describe('rotateChallengeCourtSingle', () => {
  it('winners stay, losers go to queue, 2 new from front', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: ['e', 'f', 'g', 'h'],
    }
    const result = rotateChallengeCourtSingle(state, 1, 'team1')
    // Team 1 wins — a, b stay. c, d go to back of queue. e, f come in.
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
    // Team 2 wins — c, d stay. a, b go to back of queue. e, f come in.
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
    // Losers [c, d] go to queue, then pulled back as challengers
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
    // Losers [c, d] go to queue → [e, c, d]. Pull 2 → [e, c]. Queue → [d].
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
```

**Step 6: Run tests to verify they fail**

Run: `npx vitest run src/utils/__tests__/matchups.test.ts`
Expected: FAIL — `rotateChallengeCourtSingle` is not exported.

**Step 7: Implement `rotateChallengeCourtSingle`**

Add to `src/utils/matchups.ts`:

```typescript
export function rotateChallengeCourtSingle(
  state: MatchupState,
  courtNumber: number,
  winningTeam: 'team1' | 'team2',
): MatchupState {
  const gameIndex = state.games.findIndex(g => g.court === courtNumber)
  if (gameIndex === -1) return state

  const game = state.games[gameIndex]
  const winners = [...game[winningTeam]]
  const losingTeam = winningTeam === 'team1' ? 'team2' : 'team1'
  const losers = [...game[losingTeam]]

  // Losers go to back of queue, then pull 2 challengers from front
  const newQueue = [...state.sittingOut, ...losers]
  const challengers = newQueue.splice(0, 2)

  const newGames = [...state.games]
  newGames[gameIndex] = {
    court: courtNumber,
    team1: [winners[0], winners[1]],
    team2: [challengers[0], challengers[1]],
  }

  return { games: newGames, sittingOut: newQueue }
}
```

**Step 8: Run tests**

Run: `npx vitest run src/utils/__tests__/matchups.test.ts`
Expected: All tests pass.

**Step 9: Commit**

```bash
git add src/utils/matchups.ts src/utils/__tests__/matchups.test.ts
git commit -m "feat: add rotateCourt and rotateChallengeCourtSingle utilities"
```

---

### Task 4: Court Re-roll Utility + Tests

**Files:**
- Modify: `src/utils/matchups.ts`
- Modify: `src/utils/__tests__/matchups.test.ts`

**Step 1: Write failing tests for `rerollCourt`**

Add to test file:

```typescript
import {
  // ... existing imports ...
  rerollCourt,
} from '../matchups'

describe('rerollCourt', () => {
  it('produces a different team arrangement with same players', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: ['e'],
    }
    const result = rerollCourt(state, 1)
    const originalPlayers = ['a', 'b', 'c', 'd'].sort()
    const newPlayers = [...result.games[0].team1, ...result.games[0].team2].sort()
    // Same players
    expect(newPlayers).toEqual(originalPlayers)
    // Different arrangement (team composition changed)
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
    // Valid arrangements (normalized: each team sorted, then pair sorted):
    // {a,b} vs {c,d}, {a,c} vs {b,d}, {a,d} vs {b,c}
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
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/__tests__/matchups.test.ts`
Expected: FAIL — `rerollCourt` is not exported.

**Step 3: Implement `rerollCourt`**

Add to `src/utils/matchups.ts`:

```typescript
function normalizeArrangement(team1: string[], team2: string[]): string {
  const t1 = [...team1].sort().join(',')
  const t2 = [...team2].sort().join(',')
  return [t1, t2].sort().join('|')
}

export function rerollCourt(
  state: MatchupState,
  courtNumber: number,
): MatchupState {
  const gameIndex = state.games.findIndex(g => g.court === courtNumber)
  if (gameIndex === -1) return state

  const game = state.games[gameIndex]
  const players = [...game.team1, ...game.team2]

  // All 3 possible 2v2 arrangements of 4 players
  const arrangements: [[string, string], [string, string]][] = [
    [[players[0], players[1]], [players[2], players[3]]],
    [[players[0], players[2]], [players[1], players[3]]],
    [[players[0], players[3]], [players[1], players[2]]],
  ]

  const currentKey = normalizeArrangement(game.team1, game.team2)
  const alternatives = arrangements.filter(
    ([t1, t2]) => normalizeArrangement(t1, t2) !== currentKey,
  )

  const chosen = alternatives[Math.floor(Math.random() * alternatives.length)]
  const newGames = [...state.games]
  newGames[gameIndex] = {
    court: courtNumber,
    team1: chosen[0],
    team2: chosen[1],
  }

  return { games: newGames, sittingOut: state.sittingOut }
}
```

**Step 4: Run tests**

Run: `npx vitest run src/utils/__tests__/matchups.test.ts`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/utils/matchups.ts src/utils/__tests__/matchups.test.ts
git commit -m "feat: add rerollCourt utility"
```

---

### Task 5: Player Mutation Utilities + Tests

**Files:**
- Modify: `src/utils/matchups.ts`
- Modify: `src/utils/__tests__/matchups.test.ts`

**Step 1: Write failing tests for `addPlayerToMatchups`**

```typescript
import {
  // ... existing imports ...
  addPlayerToMatchups,
  removePlayerFromMatchups,
} from '../matchups'

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
```

**Step 2: Write failing tests for `removePlayerFromMatchups`**

```typescript
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
    // Remaining 3 players go to front of queue
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
    // Remove from court 1 — court 2 is still playing, queue is empty
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
    expect(result.games.find(g => g.court === 2)!.team1).toEqual(['i', 'f'].includes('i') ? ['i', 'e'] : ['e', 'i'])
    // More precisely:
    expect(result.games.find(g => g.court === 2)!.team1).toEqual(['e', 'i'])
    // Wait, 'f' is removed, 'i' replaces. Position matters — 'f' was index 1 of team1.
    // So team1 becomes ['e', 'i']
  })

  it('handles sequential removals correctly', () => {
    let state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: ['e', 'f', 'g'],
    }
    // Remove 'a' from court — 'e' replaces
    state = removePlayerFromMatchups(state, 'a')
    expect(state.games[0].team1).toEqual(['e', 'b'])
    expect(state.sittingOut).toEqual(['f', 'g'])
    // Remove 'b' from court — 'f' replaces
    state = removePlayerFromMatchups(state, 'b')
    expect(state.games[0].team1).toEqual(['e', 'f'])
    expect(state.sittingOut).toEqual(['g'])
  })
})
```

Note: Fix the "handles removing player from second court" test — `'f'` was at index 1 of team1 `['e', 'f']`, so replacing with `'i'` gives `['e', 'i']`.

**Step 3: Run tests to verify they fail**

Run: `npx vitest run src/utils/__tests__/matchups.test.ts`
Expected: FAIL — functions not exported.

**Step 4: Implement `addPlayerToMatchups`**

Add to `src/utils/matchups.ts`:

```typescript
export function addPlayerToMatchups(
  state: MatchupState,
  playerId: string,
): MatchupState {
  return { games: state.games, sittingOut: [...state.sittingOut, playerId] }
}
```

**Step 5: Implement `removePlayerFromMatchups`**

Add to `src/utils/matchups.ts`:

```typescript
export function removePlayerFromMatchups(
  state: MatchupState,
  playerId: string,
): MatchupState {
  // Check sitting out queue first
  const queueIndex = state.sittingOut.indexOf(playerId)
  if (queueIndex !== -1) {
    const newQueue = [...state.sittingOut]
    newQueue.splice(queueIndex, 1)
    return { games: state.games, sittingOut: newQueue }
  }

  // Check games
  for (let i = 0; i < state.games.length; i++) {
    const game = state.games[i]
    const inTeam1 = game.team1.indexOf(playerId)
    const inTeam2 = game.team2.indexOf(playerId)

    if (inTeam1 === -1 && inTeam2 === -1) continue

    const newQueue = [...state.sittingOut]
    const replacement = newQueue.length > 0 ? newQueue.shift()! : null

    if (replacement) {
      const newGames = [...state.games]
      if (inTeam1 !== -1) {
        const newTeam1 = [...game.team1] as [string, string]
        newTeam1[inTeam1] = replacement
        newGames[i] = { ...game, team1: newTeam1 }
      } else {
        const newTeam2 = [...game.team2] as [string, string]
        newTeam2[inTeam2] = replacement
        newGames[i] = { ...game, team2: newTeam2 }
      }
      return { games: newGames, sittingOut: newQueue }
    } else {
      // No replacement — dissolve game, remaining go to front of queue
      const remaining = [...game.team1, ...game.team2].filter(id => id !== playerId)
      const newGames = state.games.filter((_, idx) => idx !== i)
      return { games: newGames, sittingOut: [...remaining, ...state.sittingOut] }
    }
  }

  return state
}
```

**Step 6: Run tests**

Run: `npx vitest run src/utils/__tests__/matchups.test.ts`
Expected: All tests pass.

**Step 7: Commit**

```bash
git add src/utils/matchups.ts src/utils/__tests__/matchups.test.ts
git commit -m "feat: add addPlayerToMatchups and removePlayerFromMatchups utilities"
```

---

### Task 6: Snapshot Utility + Tests

**Files:**
- Modify: `src/utils/matchups.ts`
- Modify: `src/utils/__tests__/matchups.test.ts`

**Step 1: Write failing tests**

```typescript
import {
  // ... existing imports ...
  snapshotToHistory,
} from '../matchups'
import type { MatchupState, Round } from '../../types'

describe('snapshotToHistory', () => {
  it('creates a Round with id from MatchupState', () => {
    const state: MatchupState = {
      games: [{ court: 1, team1: ['a', 'b'], team2: ['c', 'd'] }],
      sittingOut: ['e', 'f'],
    }
    const round = snapshotToHistory(state)
    expect(round.id).toBeDefined()
    expect(typeof round.id).toBe('string')
    expect(round.id.length).toBeGreaterThan(0)
    expect(round.games).toEqual(state.games)
    expect(round.sittingOut).toEqual(state.sittingOut)
  })

  it('generates unique ids for different snapshots', () => {
    const state: MatchupState = { games: [], sittingOut: [] }
    const round1 = snapshotToHistory(state)
    const round2 = snapshotToHistory(state)
    expect(round1.id).not.toEqual(round2.id)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/__tests__/matchups.test.ts`
Expected: FAIL.

**Step 3: Implement `snapshotToHistory`**

Add to `src/utils/matchups.ts`:

```typescript
import type { MatchupState, Round, Game } from '../types'

export function snapshotToHistory(state: MatchupState): Round {
  return {
    id: crypto.randomUUID(),
    games: state.games,
    sittingOut: state.sittingOut,
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run src/utils/__tests__/matchups.test.ts`
Expected: All pass.

**Step 5: Commit**

```bash
git add src/utils/matchups.ts src/utils/__tests__/matchups.test.ts
git commit -m "feat: add snapshotToHistory utility"
```

---

### Task 7: Storage Migration + Tests

**Files:**
- Modify: `src/utils/storage.ts`
- Modify: `src/utils/__tests__/storage.test.ts`

**Step 1: Write failing tests for migration**

Add to `src/utils/__tests__/storage.test.ts`:

```typescript
describe('storage migration — rounds to matchupState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('migrates old rounds[] — last round becomes matchupState, rest become roundHistory', () => {
    const oldSession = {
      date: '2026-04-17',
      venue: 'Court A',
      defaultRate: 500,
      timeSlots: [],
      players: [
        { id: 'p1', name: 'A', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
        { id: 'p2', name: 'B', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
        { id: 'p3', name: 'C', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
        { id: 'p4', name: 'D', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
      ],
      rounds: [
        { id: 'r1', games: [{ court: 1, team1: ['p1', 'p2'], team2: ['p3', 'p4'] }], sittingOut: [] },
        { id: 'r2', games: [{ court: 1, team1: ['p3', 'p1'], team2: ['p2', 'p4'] }], sittingOut: [] },
      ],
      playSystem: 'paddle-queue',
      deferredPlayerIds: [],
    }
    localStorage.setItem('pickleball-session', JSON.stringify(oldSession))
    const loaded = loadSession()
    expect(loaded!.matchupState).toEqual({
      games: [{ court: 1, team1: ['p3', 'p1'], team2: ['p2', 'p4'] }],
      sittingOut: [],
    })
    expect(loaded!.roundHistory).toHaveLength(1)
    expect(loaded!.roundHistory[0].id).toBe('r1')
    expect((loaded as any).rounds).toBeUndefined()
  })

  it('migrates empty rounds[] — matchupState is null, roundHistory is empty', () => {
    const oldSession = {
      date: '2026-04-17',
      venue: 'Court A',
      defaultRate: 500,
      timeSlots: [],
      players: [],
      rounds: [],
      playSystem: 'paddle-queue',
      deferredPlayerIds: [],
    }
    localStorage.setItem('pickleball-session', JSON.stringify(oldSession))
    const loaded = loadSession()
    expect(loaded!.matchupState).toBeNull()
    expect(loaded!.roundHistory).toEqual([])
  })

  it('migrates single round — matchupState from that round, empty roundHistory', () => {
    const oldSession = {
      date: '2026-04-17',
      venue: 'Court A',
      defaultRate: 500,
      timeSlots: [],
      players: [
        { id: 'p1', name: 'A', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
        { id: 'p2', name: 'B', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
        { id: 'p3', name: 'C', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
        { id: 'p4', name: 'D', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
      ],
      rounds: [
        { id: 'r1', games: [{ court: 1, team1: ['p1', 'p2'], team2: ['p3', 'p4'] }], sittingOut: [] },
      ],
      playSystem: 'paddle-queue',
      deferredPlayerIds: [],
    }
    localStorage.setItem('pickleball-session', JSON.stringify(oldSession))
    const loaded = loadSession()
    expect(loaded!.matchupState).toEqual({
      games: [{ court: 1, team1: ['p1', 'p2'], team2: ['p3', 'p4'] }],
      sittingOut: [],
    })
    expect(loaded!.roundHistory).toEqual([])
  })

  it('loads new format correctly', () => {
    const newSession = {
      date: '2026-04-17',
      venue: 'Court A',
      defaultRate: 500,
      timeSlots: [],
      players: [],
      matchupState: null,
      roundHistory: [],
      playSystem: 'paddle-queue',
      deferredPlayerIds: [],
    }
    localStorage.setItem('pickleball-session', JSON.stringify(newSession))
    const loaded = loadSession()
    expect(loaded!.matchupState).toBeNull()
    expect(loaded!.roundHistory).toEqual([])
  })

  it('gracefully removes stale player IDs from matchupState instead of nuking', () => {
    const session = {
      date: '2026-04-17',
      venue: 'Court A',
      defaultRate: 500,
      timeSlots: [],
      players: [
        { id: 'p1', name: 'A', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
        { id: 'p2', name: 'B', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
        { id: 'p3', name: 'C', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
      ],
      matchupState: {
        games: [{ court: 1, team1: ['p1', 'p2'], team2: ['p3', 'stale-id'] }],
        sittingOut: ['stale-id-2'],
      },
      roundHistory: [],
      playSystem: 'paddle-queue',
      deferredPlayerIds: ['stale-id'],
    }
    localStorage.setItem('pickleball-session', JSON.stringify(session))
    const loaded = loadSession()
    // Stale IDs removed from sittingOut
    expect(loaded!.matchupState!.sittingOut).toEqual([])
    // Stale IDs removed from deferredPlayerIds
    expect(loaded!.deferredPlayerIds).toEqual([])
    // Game with stale player dissolved, remaining go to front of queue
    expect(loaded!.matchupState!.games).toHaveLength(0)
    expect(loaded!.matchupState!.sittingOut).toEqual(['p1', 'p2', 'p3'])
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/__tests__/storage.test.ts`
Expected: FAIL.

**Step 3: Update `loadSession` in `src/utils/storage.ts`**

Replace the `loadSession` function:

```typescript
import type { Session, SavedVenue, SavedPlayer, MatchupState } from '../types'

export function loadSession(): Session | null {
  const data = localStorage.getItem(STORAGE_KEY)
  if (!data) return null
  try {
    const raw = JSON.parse(data)

    // Migrate players from old arrivalSlotId to arrivalTime/departureTime
    raw.players = (raw.players ?? []).map((p: any) => ({
      ...p,
      arrivalTime: p.arrivalTime ?? raw.timeSlots?.[0]?.startTime ?? '',
      departureTime: p.departureTime ?? raw.timeSlots?.[raw.timeSlots.length - 1]?.endTime ?? '',
      status: p.status === 'deferred' ? 'active' : p.status,
    }))

    // Initialize deferredPlayerIds if missing
    if (!raw.deferredPlayerIds) {
      raw.deferredPlayerIds = []
    }

    const playerIdSet = new Set(raw.players.map((p: any) => p.id))

    // Migrate old rounds[] to matchupState + roundHistory
    if (raw.rounds !== undefined && raw.matchupState === undefined) {
      const rounds = raw.rounds as any[]
      if (rounds.length === 0) {
        raw.matchupState = null
        raw.roundHistory = []
      } else {
        const lastRound = rounds[rounds.length - 1]
        raw.matchupState = {
          games: lastRound.games,
          sittingOut: lastRound.sittingOut,
        }
        raw.roundHistory = rounds.slice(0, -1)
      }
      delete raw.rounds
    }

    // Initialize if missing
    if (raw.matchupState === undefined) raw.matchupState = null
    if (raw.roundHistory === undefined) raw.roundHistory = []

    // Clean stale player IDs from matchupState
    if (raw.matchupState) {
      const state = raw.matchupState as MatchupState
      // Remove stale IDs from sittingOut
      state.sittingOut = state.sittingOut.filter((id: string) => playerIdSet.has(id))
      // Check games for stale IDs — dissolve affected games
      const cleanGames = []
      const displaced: string[] = []
      for (const game of state.games) {
        const allIds = [...game.team1, ...game.team2]
        const hasStale = allIds.some((id: string) => !playerIdSet.has(id))
        if (hasStale) {
          displaced.push(...allIds.filter((id: string) => playerIdSet.has(id)))
        } else {
          cleanGames.push(game)
        }
      }
      state.games = cleanGames
      state.sittingOut = [...displaced, ...state.sittingOut]
      raw.matchupState = state.games.length === 0 && state.sittingOut.length === 0 ? null : state
    }

    // Clean stale IDs from deferredPlayerIds
    raw.deferredPlayerIds = raw.deferredPlayerIds.filter((id: string) => playerIdSet.has(id))

    return raw as Session
  } catch {
    return null
  }
}
```

**Step 4: Update `mockSession` in storage tests**

Update the existing `mockSession` to use new format:

```typescript
const mockSession: Session = {
  date: '2026-03-24',
  venue: 'Court A',
  defaultRate: 500,
  timeSlots: [],
  players: [],
  matchupState: null,
  roundHistory: [],
  playSystem: 'paddle-queue',
  deferredPlayerIds: [],
}
```

Also update the "clears rounds when player IDs in rounds do not match" test to test the new stale-handling behavior instead. Remove or replace it since the behavior changed from "nuke rounds" to "graceful cleanup." The new migration tests above cover this.

**Step 5: Run tests**

Run: `npx vitest run src/utils/__tests__/storage.test.ts`
Expected: All pass.

**Step 6: Commit**

```bash
git add src/utils/storage.ts src/utils/__tests__/storage.test.ts
git commit -m "feat: storage migration from rounds[] to matchupState + roundHistory"
```

---

### Task 8: Update SessionContext

**Files:**
- Modify: `src/context/SessionContext.tsx`
- Modify: `src/context/__tests__/SessionContext.test.tsx`

**Step 1: Update default session and context type**

In `src/context/SessionContext.tsx`:

```typescript
const defaultSession: Session = {
  date: new Date().toISOString().split('T')[0],
  venue: '',
  defaultRate: 0,
  timeSlots: [],
  players: [],
  matchupState: null,
  roundHistory: [],
  playSystem: 'paddle-queue',
  deferredPlayerIds: [],
}
```

Update `SessionContextType`:

```typescript
import type { Session, Player, TimeSlot, PlaySystem, MatchupState, Round } from '../types'
import { addPlayerToMatchups, removePlayerFromMatchups } from '../utils/matchups'

interface SessionContextType {
  session: Session
  setDate: (date: string) => void
  setVenue: (venue: string) => void
  setDefaultRate: (rate: number) => void
  setPlaySystem: (system: PlaySystem) => void
  addTimeSlot: (startTime: string, endTime: string, numCourts: number, rateOverride?: number) => void
  removeTimeSlot: (id: string) => void
  updateTimeSlot: (id: string, updates: Partial<Omit<TimeSlot, 'id'>>) => void
  addPlayer: (name: string) => void
  removePlayer: (id: string) => void
  updatePlayerStatus: (id: string, status: Player['status']) => void
  updatePlayerSchedule: (id: string, arrivalTime: string, departureTime: string) => void
  setDeferredPlayerIds: (ids: string[]) => void
  setMatchupState: (state: MatchupState | null) => void
  setRoundHistory: (history: Round[]) => void
  resetSession: () => void
}
```

**Step 2: Update action implementations**

Replace `setRounds` with `setMatchupState` and `setRoundHistory`:

```typescript
const setMatchupState = useCallback((matchupState: MatchupState | null) =>
  setSession(s => ({ ...s, matchupState })), [])

const setRoundHistory = useCallback((roundHistory: Round[]) =>
  setSession(s => ({ ...s, roundHistory })), [])
```

Update `addPlayer` to also add to matchup sitting out queue:

```typescript
const addPlayer = useCallback((name: string) =>
  setSession(s => {
    const newPlayer = {
      id: generateId(),
      name,
      arrivalTime: s.timeSlots.length > 0
        ? s.timeSlots.reduce((min, ts) => ts.startTime < min ? ts.startTime : min, s.timeSlots[0].startTime)
        : '',
      departureTime: s.timeSlots.length > 0
        ? s.timeSlots.reduce((max, ts) => ts.endTime > max ? ts.endTime : max, s.timeSlots[0].endTime)
        : '',
      status: 'active' as const,
    }
    return {
      ...s,
      players: [...s.players, newPlayer],
      matchupState: s.matchupState
        ? addPlayerToMatchups(s.matchupState, newPlayer.id)
        : null,
    }
  }), [])
```

Update `removePlayer` to also remove from matchups:

```typescript
const removePlayer = useCallback((id: string) =>
  setSession(s => ({
    ...s,
    players: s.players.filter(p => p.id !== id),
    matchupState: s.matchupState
      ? removePlayerFromMatchups(s.matchupState, id)
      : null,
    deferredPlayerIds: s.deferredPlayerIds.filter(d => d !== id),
  })), [])
```

Update `updatePlayerStatus` to integrate with matchups:

```typescript
const updatePlayerStatus = useCallback((id: string, status: Player['status']) =>
  setSession(s => {
    let newMatchupState = s.matchupState
    if (newMatchupState) {
      if (status === 'left') {
        newMatchupState = removePlayerFromMatchups(newMatchupState, id)
      } else if (status === 'active') {
        newMatchupState = addPlayerToMatchups(newMatchupState, id)
      }
    }
    return {
      ...s,
      players: s.players.map(p => p.id === id ? { ...p, status } : p),
      matchupState: newMatchupState,
      deferredPlayerIds: status === 'left'
        ? s.deferredPlayerIds.filter(d => d !== id)
        : s.deferredPlayerIds,
    }
  }), [])
```

Update Provider value — replace `setRounds` with `setMatchupState, setRoundHistory`.

**Step 3: Update SessionContext tests**

The existing tests add/remove players and check count. They should still pass since `addPlayer`/`removePlayer` still modify `session.players`. No changes needed to existing tests.

**Step 4: Run tests**

Run: `npx vitest run src/context/__tests__/SessionContext.test.tsx`
Expected: All pass.

**Step 5: Commit**

```bash
git add src/context/SessionContext.tsx
git commit -m "refactor: update SessionContext for court-centric matchup model"
```

---

### Task 9: Refactor MatchupsTab — Core Data Model

**Files:**
- Modify: `src/components/MatchupsTab.tsx`

This task converts the component from `rounds[]` to `matchupState` + `roundHistory` without adding new UI yet.

**Step 1: Update imports and state**

```typescript
import type { PlaySystem, MatchupState } from '../types'
import {
  generatePaddleQueueMatchups,
  generateRoundRobinMatchups,
  generateChallengeCourtMatchups,
  snapshotToHistory,
} from '../utils/matchups'
```

Replace:
```typescript
const { session, setPlaySystem, setRounds, updatePlayerStatus, setDeferredPlayerIds } = useSession()
```
With:
```typescript
const { session, setPlaySystem, setMatchupState, setRoundHistory, updatePlayerStatus, setDeferredPlayerIds } = useSession()
```

**Step 2: Update `generateRound`**

```typescript
const generateRound = () => {
  const playerIds = activePlayers.map(p => p.id)
  let state: MatchupState

  // Snapshot current state to history if matchups exist
  if (session.matchupState) {
    const snapshot = snapshotToHistory(session.matchupState)
    setRoundHistory([...session.roundHistory, snapshot])
  }

  switch (session.playSystem) {
    case 'paddle-queue':
      state = generatePaddleQueueMatchups(playerIds, currentCourts, session.deferredPlayerIds)
      break
    case 'round-robin':
      state = generateRoundRobinMatchups(
        playerIds,
        currentCourts,
        [...session.roundHistory, ...(session.matchupState ? [session.matchupState] : [])],
        session.deferredPlayerIds,
      )
      break
    case 'challenge-court':
      state = generateChallengeCourtMatchups(playerIds, currentCourts, [...stayingIds], session.deferredPlayerIds)
      break
  }

  setMatchupState(state)
  setDeferredPlayerIds([])
  setStayingIds(new Set())
}
```

**Step 3: Update `regenerateLastRound` (Reshuffle)**

```typescript
const reshuffleMatchups = () => {
  if (!session.matchupState) return
  const playerIds = activePlayers.map(p => p.id)
  let state: MatchupState

  switch (session.playSystem) {
    case 'paddle-queue':
      state = generatePaddleQueueMatchups(playerIds, currentCourts, session.deferredPlayerIds)
      break
    case 'round-robin':
      state = generateRoundRobinMatchups(playerIds, currentCourts, session.roundHistory, session.deferredPlayerIds)
      break
    case 'challenge-court':
      state = generateChallengeCourtMatchups(playerIds, currentCourts, [...stayingIds], session.deferredPlayerIds)
      break
  }

  setMatchupState(state)
}
```

**Step 4: Update `deferPlayer`**

```typescript
const deferPlayer = (playerId: string) => {
  if (!session.matchupState) return
  const sittingOut = [...session.matchupState.sittingOut]
  if (sittingOut.length === 0) return

  const replacement = sittingOut.shift()!
  const updatedGames = session.matchupState.games.map(game => ({
    ...game,
    team1: game.team1.map(id => id === playerId ? replacement : id) as [string, string],
    team2: game.team2.map(id => id === playerId ? replacement : id) as [string, string],
  }))

  sittingOut.push(playerId)
  setMatchupState({ games: updatedGames, sittingOut })
  setDeferredPlayerIds([...session.deferredPlayerIds, playerId])
}
```

**Step 5: Update template references**

Replace all `currentRound` references:
- `currentRound` → `session.matchupState`
- `currentRound.games` → `session.matchupState.games`
- `currentRound.sittingOut` → `session.matchupState.sittingOut`
- `session.rounds.length` (for round number display) → `session.roundHistory.length + 1`
- `session.rounds.length === 0` (for button text) → `!session.matchupState`
- `previousRounds` → `session.roundHistory`

Remove:
```typescript
const currentRound = session.rounds.length > 0 ? session.rounds[session.rounds.length - 1] : null
const previousRounds = session.rounds.slice(0, -1)
```

**Step 6: Verify build**

Run: `npx tsc -b --noEmit`
Expected: No type errors.

**Step 7: Commit**

```bash
git add src/components/MatchupsTab.tsx
git commit -m "refactor: MatchupsTab uses matchupState + roundHistory"
```

---

### Task 10: MatchupsTab — Per-Court Rotation UI

**Files:**
- Modify: `src/components/MatchupsTab.tsx`

**Step 1: Import court rotation utilities**

```typescript
import {
  generatePaddleQueueMatchups,
  generateRoundRobinMatchups,
  generateChallengeCourtMatchups,
  snapshotToHistory,
  rotateCourt,
  rotateChallengeCourtSingle,
  rerollCourt,
} from '../utils/matchups'
```

**Step 2: Add per-court rotation handler**

```typescript
const rotateSingleCourt = (courtNumber: number) => {
  if (!session.matchupState) return
  if (session.playSystem === 'round-robin') return // disabled for round robin

  let newState: MatchupState
  if (session.playSystem === 'challenge-court') {
    const game = session.matchupState.games.find(g => g.court === courtNumber)
    if (!game) return
    // Determine winning team from stayingIds
    const team1Staying = game.team1.every(id => stayingIds.has(id))
    const winningTeam = team1Staying ? 'team1' : 'team2'
    newState = rotateChallengeCourtSingle(session.matchupState, courtNumber, winningTeam)
  } else {
    newState = rotateCourt(session.matchupState, courtNumber)
  }

  setMatchupState(newState)
  setStayingIds(new Set())
  setDeferredPlayerIds([])
}

const rerollSingleCourt = (courtNumber: number) => {
  if (!session.matchupState) return
  setMatchupState(rerollCourt(session.matchupState, courtNumber))
}
```

**Step 3: Add per-court buttons to each court card**

Inside the court card (the `currentRound.games.map(game => ...)` block), add buttons below the vs display. Only show for paddle-queue and challenge-court:

```tsx
{session.playSystem !== 'round-robin' && (
  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
    <button
      onClick={() => rotateSingleCourt(game.court)}
      className="flex-1 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 py-1.5 text-xs font-medium min-h-[32px]"
    >
      Next
    </button>
    <button
      onClick={() => rerollSingleCourt(game.court)}
      className="rounded-md bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-3 py-1.5 text-xs font-medium min-h-[32px]"
    >
      Re-roll
    </button>
  </div>
)}
```

**Step 4: Verify manually**

Run: `npm run dev`
Test: Generate matchups with paddle queue, 2 courts. Click "Next" on court 1. Verify court 2 stays the same and court 1 rotated.

**Step 5: Commit**

```bash
git add src/components/MatchupsTab.tsx
git commit -m "feat: add per-court Next and Re-roll buttons"
```

---

### Task 11: MatchupsTab — Edit Mode

**Files:**
- Modify: `src/components/MatchupsTab.tsx`

**Step 1: Add edit mode state**

```typescript
const [editMode, setEditMode] = useState(false)
const [editDraft, setEditDraft] = useState<MatchupState | null>(null)
const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
```

**Step 2: Add enter/exit/save edit mode handlers**

```typescript
const enterEditMode = () => {
  if (!session.matchupState) return
  setEditDraft({ 
    games: session.matchupState.games.map(g => ({ ...g, team1: [...g.team1], team2: [...g.team2] })),
    sittingOut: [...session.matchupState.sittingOut],
  })
  setEditMode(true)
  setSelectedPlayerId(null)
}

const cancelEditMode = () => {
  setEditMode(false)
  setEditDraft(null)
  setSelectedPlayerId(null)
}

const saveEditMode = () => {
  if (!editDraft) return
  setMatchupState(editDraft)
  setRoundHistory([])
  setDeferredPlayerIds([])
  setEditMode(false)
  setEditDraft(null)
  setSelectedPlayerId(null)
}
```

**Step 3: Add tap-to-swap handler**

When in edit mode, tapping a player selects them. Tapping a second player swaps them.

```typescript
const handleEditTap = (playerId: string) => {
  if (!editDraft) return

  if (!selectedPlayerId) {
    setSelectedPlayerId(playerId)
    return
  }

  if (selectedPlayerId === playerId) {
    setSelectedPlayerId(null)
    return
  }

  // Swap the two players in the draft
  const swap = (id: string) => (id === selectedPlayerId ? playerId : id === playerId ? selectedPlayerId : id)

  setEditDraft({
    games: editDraft.games.map(game => ({
      ...game,
      team1: game.team1.map(swap) as [string, string],
      team2: game.team2.map(swap) as [string, string],
    })),
    sittingOut: editDraft.sittingOut.map(swap),
  })
  setSelectedPlayerId(null)
}
```

**Step 4: Update the display to use editDraft when in edit mode**

Create a computed variable:

```typescript
const displayState = editMode && editDraft ? editDraft : session.matchupState
```

Replace `session.matchupState` with `displayState` in all the render sections (games, sittingOut).

**Step 5: Add Edit button and edit mode UI**

Next to the "Round N" heading, add an Edit button:

```tsx
<div className="flex items-center justify-between">
  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
    Round {session.roundHistory.length + 1}
  </h3>
  {!editMode ? (
    <button
      onClick={enterEditMode}
      className="text-xs text-blue-600 dark:text-blue-400 font-medium px-2 py-1 min-h-[28px]"
    >
      Edit
    </button>
  ) : (
    <div className="flex gap-2">
      <button
        onClick={cancelEditMode}
        className="text-xs text-gray-500 dark:text-gray-400 font-medium px-2 py-1 min-h-[28px]"
      >
        Cancel
      </button>
      <button
        onClick={saveEditMode}
        className="text-xs text-blue-600 dark:text-blue-400 font-medium px-2 py-1 min-h-[28px]"
      >
        Save
      </button>
    </div>
  )}
</div>
```

**Step 6: Style players as tappable in edit mode**

When in edit mode, wrap player names with a clickable handler and highlight selected player:

```tsx
// In the game card player display:
{editMode ? (
  <button
    onClick={() => handleEditTap(id)}
    className={`font-medium px-2 py-0.5 rounded ${
      selectedPlayerId === id
        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 ring-2 ring-blue-400'
        : 'text-gray-900 dark:text-gray-50'
    }`}
  >
    {getName(id)}
  </button>
) : (
  // existing non-edit display with defer button
)}
```

Similarly for sitting out players — make them tappable in edit mode:

```tsx
{displayState.sittingOut.map(id => (
  editMode ? (
    <button
      key={id}
      onClick={() => handleEditTap(id)}
      className={`text-sm px-2 py-0.5 rounded ${
        selectedPlayerId === id
          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 ring-2 ring-blue-400'
          : 'text-gray-700 dark:text-gray-200'
      }`}
    >
      {getName(id)}
    </button>
  ) : (
    // existing non-edit display
  )
))}
```

**Step 7: Hide action buttons during edit mode**

Hide the "Next Round", "Reshuffle", per-court "Next"/"Re-roll", and defer buttons while in edit mode. Wrap them with `{!editMode && ...}`.

Also add a visual indicator for edit mode — e.g., a blue dashed border on court cards:

```tsx
className={`bg-white dark:bg-gray-900 rounded-lg border p-4 ${
  editMode
    ? 'border-dashed border-blue-400 dark:border-blue-500'
    : 'border-gray-200 dark:border-gray-700'
}`}
```

**Step 8: Verify manually**

Run: `npm run dev`
Test: Generate matchups → click Edit → tap two players → verify swap → Save → verify history cleared → generate next round → verify no partner avoidance from before.

**Step 9: Commit**

```bash
git add src/components/MatchupsTab.tsx
git commit -m "feat: add edit mode with tap-to-swap for matchup overrides"
```

---

### Task 12: MatchupsTab — Play System Taglines

**Files:**
- Modify: `src/components/MatchupsTab.tsx`

**Step 1: Add tagline map**

```typescript
const systemTaglines: Record<PlaySystem, string> = {
  'paddle-queue': 'Next in line plays next',
  'challenge-court': 'Winners stay, losers rotate',
  'round-robin': 'Everyone plays with everyone',
}
```

**Step 2: Add tagline below the tab selector**

Insert after the play system tab bar `div`:

```tsx
<p className="text-xs text-gray-400 dark:text-gray-500 text-center">
  {systemTaglines[session.playSystem]}
</p>
```

**Step 3: Verify manually**

Run: `npm run dev`
Test: Switch between modes, confirm tagline updates.

**Step 4: Commit**

```bash
git add src/components/MatchupsTab.tsx
git commit -m "feat: add play system taglines below mode selector"
```

---

### Task 13: Final Cleanup and Verification

**Files:**
- All modified files

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

**Step 2: Run type check**

Run: `npx tsc -b --noEmit`
Expected: No errors.

**Step 3: Run lint**

Run: `npm run lint`
Expected: No errors (or only pre-existing ones).

**Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds.

**Step 5: Manual smoke test**

Run: `npm run dev`
Test the following flows:
1. **Paddle Queue**: Generate → per-court next → re-roll → reshuffle → next round
2. **Challenge Court**: Generate → select winners → per-court next → verify winners stay
3. **Round Robin**: Generate → next round → verify no per-court buttons → verify partner avoidance
4. **Edit Mode**: Enter → swap players across courts → swap court player with sitting out → save → verify history cleared
5. **Player Add**: Add player mid-session → verify they appear in sitting out queue
6. **Player Remove**: Remove from queue → remove from court (with sub) → remove from court (no sub, game dissolves)
7. **Toggle Status**: Mark player as left → verify removed from matchups → mark active again → verify in queue

**Step 6: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: final cleanup for court-centric matchup system"
```
