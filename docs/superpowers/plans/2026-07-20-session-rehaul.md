# Session Rehaul (Games-First Matchups) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the round-based matchup system with a games-first flow: per-court win buttons, ranked match suggestions, equal-play fairness, player stats, and a standalone court-cost calculator.

**Architecture:** Session state becomes `liveGames` (one per court) + flat `matchHistory` (completed games with winners) + `queue` (waiting order) + `courtWinners` (challenge-court holds). A pure, deterministic suggestion engine (`suggestions.ts`) ranks up to 15 candidate matches per system. UI: court cards with "Team 1/2 Wins" buttons, suggestion list with per-court assign buttons, stat sublines on Players, flat Matches list.

**Tech Stack:** React 19 + TypeScript (strict, `tsc -b`), Vite, Tailwind v4 classes, vitest + @testing-library/react (jsdom), localStorage persistence.

**Spec:** `docs/superpowers/specs/2026-07-20-session-rehaul-design.md` — read it before starting any task.

## Global Constraints

- No new dependencies. No web workers.
- The suggestion engine must be fully deterministic: no `Math.random`, no `Date` — same inputs, same output.
- Suggestion caps: up to **15** candidates, never padded. FIFO window = first **6** in queue; round-robin fairness window = **10** lowest-scored players.
- Every checked-in player is in exactly one of: a live game, `courtWinners`, or `queue` (invariant — ops must preserve it).
- Hold dissolution rule (all causes): dissolved `courtWinners` pairs go to the **front** of the queue.
- Old stored sessions are discarded, not migrated. Delete legacy migration code.
- Mobile-first: interactive elements keep `min-h-[44px]` (or existing smaller patterns for inline chips), Tailwind classes follow existing light/dark pairs.
- Tests: run scoped per task with `npx vitest run <file>`; the full suite and `npm run build` must be green by the final task (intermediate tasks may leave not-yet-rewritten files failing).
- Commit messages: conventional style (`feat:`, `refactor:`, `test:`, `docs:`). **Never add a Co-Authored-By line.**

## File Map

| File | Action | Owner task |
|---|---|---|
| `src/types.ts` | reshape Session, add CompletedGame + calculator types | 1 |
| `src/utils/storage.ts` | drop legacy migration, shape filter, calculator persistence | 1 |
| `src/utils/__tests__/storage.test.ts` | rewrite | 1 |
| `src/utils/suggestions.ts` | create engine | 2 |
| `src/utils/__tests__/suggestions.test.ts` | create | 2 |
| `src/utils/stats.ts` | create (player stats + win streak) | 3 |
| `src/utils/__tests__/stats.test.ts` | create | 3 |
| `src/utils/sessionOps.ts` | rewrite ops | 4 |
| `src/utils/__tests__/sessionOps.test.ts` | rewrite | 4 |
| `src/utils/matchups.ts` + `__tests__/matchups.test.ts` | **delete** | 4 |
| `src/context/SessionContext.tsx` | new API | 5 |
| `src/context/__tests__/SessionContext.test.tsx` | rewrite | 5 |
| `src/components/MatchupsTab.tsx` | rewrite (courts task 6, suggestions task 7) | 6, 7 |
| `src/components/__tests__/MatchupsTab.test.tsx` | rewrite | 6, 7 |
| `src/test-setup.ts` | scrollIntoView stub | 7 |
| `src/components/MatchesTab.tsx` | rewrite | 8 |
| `src/components/__tests__/MatchesTab.test.tsx` | rewrite | 8 |
| `src/components/PlayersTab.tsx` | stat sublines | 9 |
| `src/components/__tests__/PlayersTab.test.tsx` | update | 9 |
| `src/components/SessionModal.tsx` | relabel amount field | 10 |
| `src/components/__tests__/SessionModal.test.tsx` | update labels | 10 |
| `src/components/CourtCostCalculator.tsx` | create | 11 |
| `src/components/__tests__/CourtCostCalculator.test.tsx` | create | 11 |
| `src/screens/SessionListScreen.tsx` | calculator button | 11 |
| remaining test files (`screens.test.tsx`, `SessionsContext.test.tsx`, …) | fix stragglers | 12 |

---

### Task 1: Data model + storage

**Files:**
- Modify: `src/types.ts` (full replacement below)
- Modify: `src/utils/storage.ts` (full replacement below)
- Test: `src/utils/__tests__/storage.test.ts` (full replacement below)

**Interfaces:**
- Consumes: nothing (foundation task).
- Produces: `Game { court, team1, team2 }` (no winner field), `CompletedGame { id, court, team1, team2, winner: 1|2, endedAt }`, `Session` with `liveGames: Game[]`, `matchHistory: CompletedGame[]`, `queue: string[]`, `courtWinners: Record<number, [string, string]>` (and **without** `matchupState`/`roundHistory`/`deferredPlayerIds`), `CalculatorRow { id, hours, courts, rate }` / `CalculatorState { defaultRate, rows }` (string fields — raw input values), `loadCalculator(): CalculatorState`, `saveCalculator(state): void`. `loadSessions()` now discards old-shape sessions.

Note: after this task, `sessionOps.ts`, `matchups.ts`, and the UI no longer typecheck (they reference removed types). That is expected until Tasks 4–11; only run the scoped test file below.

- [x] **Step 1: Replace `src/types.ts`**

```ts
export type SessionStatus = 'active' | 'ended'
export type PlaySystem = 'paddle-queue' | 'challenge-court' | 'round-robin'
export interface SessionPlayer { id: string; name: string; checkedIn: boolean; participated: boolean }
export interface Game { court: number; team1: [string, string]; team2: [string, string] }
export interface CompletedGame {
  id: string
  court: number
  team1: [string, string]
  team2: [string, string]
  winner: 1 | 2
  endedAt: string
}
export interface Session {
  id: string; createdAt: string; status: SessionStatus
  date: string; venue: string; numCourts: number; courtAmount: number | null
  playSystem: PlaySystem; players: SessionPlayer[]
  liveGames: Game[]
  matchHistory: CompletedGame[]
  queue: string[]
  courtWinners: Record<number, [string, string]>
}
export interface SavedVenue { id: string; name: string }
export interface SavedPlayer { id: string; name: string }
export interface CalculatorRow { id: string; hours: string; courts: string; rate: string }
export interface CalculatorState { defaultRate: string; rows: CalculatorRow[] }
```

- [x] **Step 2: Replace `src/utils/storage.ts`** (legacy migration deleted entirely)

```ts
import type { Session, SavedVenue, SavedPlayer, CalculatorState } from '../types'

const SESSIONS_KEY = 'pickleball-sessions'
const VENUES_KEY = 'pickleball-venues'
const PLAYERS_KEY = 'pickleball-players'
const CALCULATOR_KEY = 'pickleball-calculator'

export function saveSessions(sessions: Session[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

function isNewShape(s: Session | undefined | null): s is Session {
  return !!s
    && Array.isArray(s.liveGames)
    && Array.isArray(s.matchHistory)
    && Array.isArray(s.queue)
    && typeof s.courtWinners === 'object' && s.courtWinners !== null
}

export function loadSessions(): Session[] {
  const data = localStorage.getItem(SESSIONS_KEY)
  if (!data) return []
  try {
    const parsed = JSON.parse(data) as unknown
    if (!Array.isArray(parsed)) return []
    return (parsed as Session[]).filter(isNewShape)
  } catch {
    return []
  }
}

export function saveVenues(venues: SavedVenue[]): void {
  localStorage.setItem(VENUES_KEY, JSON.stringify(venues))
}

export function loadVenues(): SavedVenue[] {
  const data = localStorage.getItem(VENUES_KEY)
  if (!data) return []
  try {
    return JSON.parse(data) as SavedVenue[]
  } catch {
    return []
  }
}

export function savePlayers(players: SavedPlayer[]): void {
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(players))
}

export function loadPlayers(): SavedPlayer[] {
  const data = localStorage.getItem(PLAYERS_KEY)
  if (!data) return []
  try {
    return JSON.parse(data) as SavedPlayer[]
  } catch {
    return []
  }
}

export function saveCalculator(state: CalculatorState): void {
  localStorage.setItem(CALCULATOR_KEY, JSON.stringify(state))
}

export function loadCalculator(): CalculatorState {
  const fallback: CalculatorState = { defaultRate: '', rows: [] }
  const data = localStorage.getItem(CALCULATOR_KEY)
  if (!data) return fallback
  try {
    const parsed = JSON.parse(data) as CalculatorState
    return {
      defaultRate: typeof parsed.defaultRate === 'string' ? parsed.defaultRate : '',
      rows: Array.isArray(parsed.rows) ? parsed.rows : [],
    }
  } catch {
    return fallback
  }
}
```

- [x] **Step 3: Replace `src/utils/__tests__/storage.test.ts` with failing tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveSessions, loadSessions, saveVenues, loadVenues,
  savePlayers, loadPlayers, saveCalculator, loadCalculator,
} from '../storage'
import type { Session } from '../../types'

function newShapeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1', createdAt: '2026-07-20T00:00:00.000Z', status: 'active',
    date: '2026-07-20', venue: 'BGC', numCourts: 2, courtAmount: 2000,
    playSystem: 'round-robin', players: [],
    liveGames: [], matchHistory: [], queue: [], courtWinners: {},
    ...overrides,
  }
}

describe('storage', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips new-shape sessions', () => {
    const s = newShapeSession()
    saveSessions([s])
    expect(loadSessions()).toEqual([s])
  })

  it('discards sessions missing the games-first fields', () => {
    localStorage.setItem('pickleball-sessions', JSON.stringify([
      newShapeSession(),
      { id: 'old', roundHistory: [], matchupState: null, players: [] },
    ]))
    const loaded = loadSessions()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('s1')
  })

  it('returns [] for corrupt or non-array session data', () => {
    localStorage.setItem('pickleball-sessions', 'not json')
    expect(loadSessions()).toEqual([])
    localStorage.setItem('pickleball-sessions', '{"a":1}')
    expect(loadSessions()).toEqual([])
  })

  it('round-trips venues and players', () => {
    saveVenues([{ id: 'v1', name: 'BGC' }])
    savePlayers([{ id: 'p1', name: 'Migs' }])
    expect(loadVenues()).toEqual([{ id: 'v1', name: 'BGC' }])
    expect(loadPlayers()).toEqual([{ id: 'p1', name: 'Migs' }])
  })

  it('round-trips calculator state and falls back on empty/corrupt data', () => {
    expect(loadCalculator()).toEqual({ defaultRate: '', rows: [] })
    saveCalculator({ defaultRate: '350', rows: [{ id: 'r1', hours: '2', courts: '2', rate: '' }] })
    expect(loadCalculator()).toEqual({ defaultRate: '350', rows: [{ id: 'r1', hours: '2', courts: '2', rate: '' }] })
    localStorage.setItem('pickleball-calculator', 'not json')
    expect(loadCalculator()).toEqual({ defaultRate: '', rows: [] })
  })
})
```

- [x] **Step 4: Run the scoped tests**

Run: `npx vitest run src/utils/__tests__/storage.test.ts`
Expected: PASS (5 tests). If you wrote the test first against old storage, it fails on `loadCalculator` not exported — either order is fine as long as the final state passes.

- [x] **Step 5: Commit**

```bash
git add src/types.ts src/utils/storage.ts src/utils/__tests__/storage.test.ts
git commit -m "feat: games-first data model, storage shape filter, calculator persistence"
```

---

### Task 2: Suggestion engine

**Files:**
- Create: `src/utils/suggestions.ts`
- Test: `src/utils/__tests__/suggestions.test.ts`

**Interfaces:**
- Consumes: `CompletedGame`, `PlaySystem` from `src/types.ts` (Task 1).
- Produces: `Candidate { team1: [string, string]; team2: [string, string] }`, `MAX_SUGGESTIONS = 15`, `gamesPlayedMap(history: CompletedGame[]): Map<string, number>`, `suggestFoursomes(queue: string[], history: CompletedGame[], playSystem: PlaySystem): Candidate[]`, `suggestChallengers(queue: string[], winners: [string, string]): Candidate[]` (team1 is always the winners).

- [x] **Step 1: Write failing tests `src/utils/__tests__/suggestions.test.ts`**

```ts
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
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/__tests__/suggestions.test.ts`
Expected: FAIL — `Cannot find module '../suggestions'` (or similar).

- [x] **Step 3: Implement `src/utils/suggestions.ts`**

```ts
import type { CompletedGame, PlaySystem } from '../types'

export interface Candidate {
  team1: [string, string]
  team2: [string, string]
}

export const MAX_SUGGESTIONS = 15
const FIFO_WINDOW = 6      // C(6,4) = 15 foursomes, C(6,2) = 15 pairs
const FAIRNESS_WINDOW = 10 // C(10,4) = 210 foursomes scored for round robin

export function gamesPlayedMap(history: CompletedGame[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const g of history) {
    for (const id of [...g.team1, ...g.team2]) {
      map.set(id, (map.get(id) ?? 0) + 1)
    }
  }
  return map
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

function partnerCounts(history: CompletedGame[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const g of history) {
    for (const [a, b] of [g.team1, g.team2]) {
      const key = pairKey(a, b)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
  }
  return map
}

function opponentCounts(history: CompletedGame[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const g of history) {
    for (const a of g.team1) {
      for (const b of g.team2) {
        const key = pairKey(a, b)
        map.set(key, (map.get(key) ?? 0) + 1)
      }
    }
  }
  return map
}

function combinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = []
  const combo: T[] = []
  const walk = (start: number) => {
    if (combo.length === k) {
      result.push([...combo])
      return
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i])
      walk(i + 1)
      combo.pop()
    }
  }
  walk(0)
  return result
}

// true when a sorts strictly before b, comparing element by element
function lexLess(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i]
  }
  return false
}

function splits(four: string[]): Candidate[] {
  const [a, b, c, d] = four
  return [
    { team1: [a, b], team2: [c, d] },
    { team1: [a, c], team2: [b, d] },
    { team1: [a, d], team2: [b, c] },
  ]
}

function bestSplit(
  four: string[],
  partners: Map<string, number>,
  opponents: Map<string, number>,
): Candidate {
  let best: Candidate = splits(four)[0]
  let bestScore: number[] | null = null
  splits(four).forEach((split, index) => {
    const partnerRepeats =
      (partners.get(pairKey(split.team1[0], split.team1[1])) ?? 0) +
      (partners.get(pairKey(split.team2[0], split.team2[1])) ?? 0)
    let opponentRepeats = 0
    for (const a of split.team1) {
      for (const b of split.team2) {
        opponentRepeats += opponents.get(pairKey(a, b)) ?? 0
      }
    }
    const score = [partnerRepeats, opponentRepeats, index]
    if (bestScore === null || lexLess(score, bestScore)) {
      bestScore = score
      best = split
    }
  })
  return best
}

export function suggestFoursomes(
  queue: string[],
  history: CompletedGame[],
  playSystem: PlaySystem,
): Candidate[] {
  if (queue.length < 4) return []
  const queueIndex = new Map(queue.map((id, i) => [id, i]))
  const games = gamesPlayedMap(history)

  let window: string[]
  if (playSystem === 'round-robin') {
    window = [...queue]
      .sort((a, b) =>
        (games.get(a) ?? 0) - (games.get(b) ?? 0) ||
        queueIndex.get(a)! - queueIndex.get(b)!)
      .slice(0, FAIRNESS_WINDOW)
  } else {
    window = queue.slice(0, FIFO_WINDOW)
  }

  const scored = combinations(window, 4).map(four => {
    const waitScore = four.reduce((sum, id) => sum + queueIndex.get(id)!, 0)
    const gameScore = four.reduce((sum, id) => sum + (games.get(id) ?? 0), 0)
    return {
      four,
      score: playSystem === 'round-robin' ? [gameScore, waitScore] : [waitScore],
    }
  })
  scored.sort((x, y) => (lexLess(x.score, y.score) ? -1 : lexLess(y.score, x.score) ? 1 : 0))

  const partners = partnerCounts(history)
  const opponents = opponentCounts(history)

  return scored.slice(0, MAX_SUGGESTIONS).map(({ four }) => {
    if (playSystem === 'round-robin') return bestSplit(four, partners, opponents)
    const ordered = [...four].sort((a, b) => queueIndex.get(a)! - queueIndex.get(b)!)
    return {
      team1: [ordered[0], ordered[1]] as [string, string],
      team2: [ordered[2], ordered[3]] as [string, string],
    }
  })
}

export function suggestChallengers(
  queue: string[],
  winners: [string, string],
): Candidate[] {
  if (queue.length < 2) return []
  const window = queue.slice(0, FIFO_WINDOW)
  const index = new Map(window.map((id, i) => [id, i]))
  const pairs = combinations(window, 2)
    .sort((p, q) =>
      (index.get(p[0])! + index.get(p[1])!) - (index.get(q[0])! + index.get(q[1])!))
  return pairs.slice(0, MAX_SUGGESTIONS).map(pair => ({
    team1: [winners[0], winners[1]] as [string, string],
    team2: [pair[0], pair[1]] as [string, string],
  }))
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/__tests__/suggestions.test.ts`
Expected: PASS (15 tests).

- [x] **Step 5: Commit**

```bash
git add src/utils/suggestions.ts src/utils/__tests__/suggestions.test.ts
git commit -m "feat: deterministic ranked suggestion engine"
```

---

### Task 3: Stats helpers

**Files:**
- Create: `src/utils/stats.ts`
- Test: `src/utils/__tests__/stats.test.ts`

**Interfaces:**
- Consumes: `CompletedGame` from Task 1.
- Produces: `PlayerStats { games: number; wins: number; losses: number }`, `computePlayerStats(history: CompletedGame[]): Map<string, PlayerStats>`, `winStreak(history: CompletedGame[], court: number, pair: [string, string]): number`.

- [x] **Step 1: Write failing tests `src/utils/__tests__/stats.test.ts`**

```ts
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
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/__tests__/stats.test.ts`
Expected: FAIL — cannot find module `../stats`.

- [x] **Step 3: Implement `src/utils/stats.ts`**

```ts
import type { CompletedGame } from '../types'

export interface PlayerStats { games: number; wins: number; losses: number }

export function computePlayerStats(history: CompletedGame[]): Map<string, PlayerStats> {
  const stats = new Map<string, PlayerStats>()
  const get = (id: string): PlayerStats => {
    let s = stats.get(id)
    if (!s) {
      s = { games: 0, wins: 0, losses: 0 }
      stats.set(id, s)
    }
    return s
  }
  for (const g of history) {
    const winners = g.winner === 1 ? g.team1 : g.team2
    const losers = g.winner === 1 ? g.team2 : g.team1
    for (const id of winners) {
      const s = get(id); s.games++; s.wins++
    }
    for (const id of losers) {
      const s = get(id); s.games++; s.losses++
    }
  }
  return stats
}

function samePair(a: [string, string], b: [string, string]): boolean {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0])
}

export function winStreak(
  history: CompletedGame[],
  court: number,
  pair: [string, string],
): number {
  let streak = 0
  for (let i = history.length - 1; i >= 0; i--) {
    const g = history[i]
    if (g.court !== court) continue
    const winners = g.winner === 1 ? g.team1 : g.team2
    if (samePair(winners, pair)) streak++
    else break
  }
  return streak
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/__tests__/stats.test.ts`
Expected: PASS (5 tests).

- [x] **Step 5: Commit**

```bash
git add src/utils/stats.ts src/utils/__tests__/stats.test.ts
git commit -m "feat: player stats and win streak helpers"
```

---

### Task 4: Session ops rewrite

**Files:**
- Modify: `src/utils/sessionOps.ts` (full replacement below)
- Test: `src/utils/__tests__/sessionOps.test.ts` (full replacement below)
- Delete: `src/utils/matchups.ts`, `src/utils/__tests__/matchups.test.ts`

**Interfaces:**
- Consumes: `Session`, `PlaySystem`, `CompletedGame` (Task 1); `Candidate` type from `./suggestions` (Task 2).
- Produces (all pure `(session, …) => Session`): `createNewSession(input: NewSessionInput)`, `checkInPlayer(session, playerId)`, `checkOutPlayer(session, playerId)`, `addRosterPlayer(session, name)`, `removeRosterPlayer(session, playerId)`, `assignToCourt(session, candidate: Candidate, court: number)`, `recordWin(session, court: number, winner: 1 | 2)`, `cancelGame(session, court: number)`, `setGameWinner(session, gameId: string, winner: 1 | 2)`, `deleteGame(session, gameId: string)`, `setPlaySystem(session, playSystem: PlaySystem)`, `updateSessionFields(session, fields)` (now dissolves holds on system change / court shrink), `compareSessionsDesc`, `localToday`.

- [x] **Step 1: Delete the old matchups module**

```bash
git rm src/utils/matchups.ts src/utils/__tests__/matchups.test.ts
```

- [x] **Step 2: Write failing tests — replace `src/utils/__tests__/sessionOps.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import {
  createNewSession, checkInPlayer, checkOutPlayer, addRosterPlayer, removeRosterPlayer,
  assignToCourt, recordWin, cancelGame, setGameWinner, deleteGame,
  setPlaySystem, updateSessionFields, compareSessionsDesc,
} from '../sessionOps'
import type { Session } from '../../types'
import type { Candidate } from '../suggestions'

function makeSession(names: string[], overrides: Partial<Session> = {}): Session {
  let s = createNewSession({
    date: '2026-07-20', venue: '', numCourts: 2, courtAmount: null,
    playSystem: 'paddle-queue', playerNames: names,
  })
  for (const p of s.players) s = checkInPlayer(s, p.id)
  return { ...s, ...overrides }
}

function ids(s: Session, ...names: string[]): string[] {
  return names.map(n => s.players.find(p => p.name === n)!.id)
}

function candidateOf(s: Session, names: [string, string, string, string]): Candidate {
  const [a, b, c, d] = ids(s, ...names)
  return { team1: [a, b], team2: [c, d] }
}

describe('createNewSession', () => {
  it('starts with empty games-first state', () => {
    const s = createNewSession({
      date: '2026-07-20', venue: ' BGC ', numCourts: 0, courtAmount: -5,
      playSystem: 'round-robin', playerNames: ['A', 'a', ' ', 'B'],
    })
    expect(s.liveGames).toEqual([])
    expect(s.matchHistory).toEqual([])
    expect(s.queue).toEqual([])
    expect(s.courtWinners).toEqual({})
    expect(s.numCourts).toBe(1)          // clamped
    expect(s.courtAmount).toBeNull()     // normalized
    expect(s.players.map(p => p.name)).toEqual(['A', 'B']) // dedupe + trim
  })
})

describe('check-in / check-out and the queue', () => {
  it('check-in appends to the queue and marks participated', () => {
    let s = createNewSession({
      date: '2026-07-20', venue: '', numCourts: 1, courtAmount: null,
      playSystem: 'paddle-queue', playerNames: ['A', 'B'],
    })
    const [a, b] = s.players.map(p => p.id)
    s = checkInPlayer(s, a)
    s = checkInPlayer(s, b)
    s = checkInPlayer(s, a) // no duplicate
    expect(s.queue).toEqual([a, b])
    expect(s.players.find(p => p.id === a)).toMatchObject({ checkedIn: true, participated: true })
  })

  it('check-out removes from the queue', () => {
    let s = makeSession(['A', 'B', 'C'])
    const [a] = ids(s, 'A')
    s = checkOutPlayer(s, a)
    expect(s.queue).not.toContain(a)
    expect(s.players.find(p => p.id === a)!.checkedIn).toBe(false)
  })

  it('check-out mid-game cancels the game; remaining 3 go to the queue front', () => {
    let s = makeSession(['A', 'B', 'C', 'D', 'E'])
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 1)
    const [a, b, c, d, e] = ids(s, 'A', 'B', 'C', 'D', 'E')
    s = checkOutPlayer(s, b)
    expect(s.liveGames).toEqual([])
    expect(s.matchHistory).toEqual([])
    expect(s.queue).toEqual([a, c, d, e])
  })

  it('check-out of a court holder frees the court; partner to queue front', () => {
    let s = makeSession(['A', 'B', 'C', 'D', 'E'], { playSystem: 'challenge-court' })
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 1)
    s = recordWin(s, 1, 1) // A,B hold court 1
    const [a, b, c, d, e] = ids(s, 'A', 'B', 'C', 'D', 'E')
    s = checkOutPlayer(s, a)
    expect(s.courtWinners).toEqual({})
    expect(s.queue).toEqual([b, e, c, d]) // partner b to front; e was waiting; c,d lost earlier
  })

  it('removeRosterPlayer also cleans queue and games', () => {
    let s = makeSession(['A', 'B', 'C', 'D', 'E'])
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 1)
    const [a] = ids(s, 'A')
    s = removeRosterPlayer(s, a)
    expect(s.players.find(p => p.id === a)).toBeUndefined()
    expect(s.liveGames).toEqual([])
    expect(s.queue).toHaveLength(4) // B,C,D to front + E
  })
})

describe('assignToCourt', () => {
  it('creates a live game and removes players from the queue', () => {
    let s = makeSession(['A', 'B', 'C', 'D', 'E'])
    const cand = candidateOf(s, ['A', 'B', 'C', 'D'])
    s = assignToCourt(s, cand, 1)
    expect(s.liveGames).toEqual([{ court: 1, team1: cand.team1, team2: cand.team2 }])
    expect(s.queue).toEqual(ids(s, 'E'))
  })

  it('no-ops on an occupied court, out-of-range court, or unavailable player', () => {
    let s = makeSession(['A', 'B', 'C', 'D', 'E'])
    const cand = candidateOf(s, ['A', 'B', 'C', 'D'])
    s = assignToCourt(s, cand, 1)
    expect(assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'E']), 2)).toBe(s) // A..D already playing
    expect(assignToCourt(s, cand, 1)).toBe(s)  // occupied
    expect(assignToCourt(s, cand, 3)).toBe(s)  // beyond numCourts (2)
  })

  it('fills a held challenge court from winners + queue and clears the hold', () => {
    let s = makeSession(['A', 'B', 'C', 'D', 'E', 'F'], { playSystem: 'challenge-court' })
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 1)
    s = recordWin(s, 1, 1) // A,B hold
    const [a, b, e, f] = ids(s, 'A', 'B', 'E', 'F')
    s = assignToCourt(s, { team1: [a, b], team2: [e, f] }, 1)
    expect(s.courtWinners).toEqual({})
    expect(s.liveGames).toEqual([{ court: 1, team1: [a, b], team2: [e, f] }])
  })
})

describe('recordWin', () => {
  it('paddle queue: appends history and re-queues losers first, then winners', () => {
    let s = makeSession(['A', 'B', 'C', 'D', 'E'])
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 1)
    s = recordWin(s, 1, 1)
    const [a, b, c, d, e] = ids(s, 'A', 'B', 'C', 'D', 'E')
    expect(s.liveGames).toEqual([])
    expect(s.queue).toEqual([e, c, d, a, b])
    expect(s.matchHistory).toHaveLength(1)
    expect(s.matchHistory[0]).toMatchObject({ court: 1, winner: 1, team1: [a, b], team2: [c, d] })
    expect(s.matchHistory[0].id).toBeTruthy()
    expect(s.matchHistory[0].endedAt).toBeTruthy()
  })

  it('challenge court: losers to queue back, winners hold the court', () => {
    let s = makeSession(['A', 'B', 'C', 'D', 'E'], { playSystem: 'challenge-court' })
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 1)
    s = recordWin(s, 1, 2)
    const [a, b, c, d, e] = ids(s, 'A', 'B', 'C', 'D', 'E')
    expect(s.courtWinners).toEqual({ 1: [c, d] })
    expect(s.queue).toEqual([e, a, b])
  })

  it('no-ops when the court has no live game', () => {
    const s = makeSession(['A', 'B', 'C', 'D'])
    expect(recordWin(s, 1, 1)).toBe(s)
  })
})

describe('cancelGame', () => {
  it('returns all 4 to the queue front in team order, records nothing', () => {
    let s = makeSession(['A', 'B', 'C', 'D', 'E'])
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 1)
    s = cancelGame(s, 1)
    const [a, b, c, d, e] = ids(s, 'A', 'B', 'C', 'D', 'E')
    expect(s.queue).toEqual([a, b, c, d, e])
    expect(s.matchHistory).toEqual([])
  })
})

describe('history corrections', () => {
  it('setGameWinner flips a recorded winner', () => {
    let s = makeSession(['A', 'B', 'C', 'D'])
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 1)
    s = recordWin(s, 1, 1)
    const gameId = s.matchHistory[0].id
    s = setGameWinner(s, gameId, 2)
    expect(s.matchHistory[0].winner).toBe(2)
  })

  it('deleteGame removes the record only', () => {
    let s = makeSession(['A', 'B', 'C', 'D'])
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 1)
    s = recordWin(s, 1, 1)
    const queueAfterWin = s.queue
    s = deleteGame(s, s.matchHistory[0].id)
    expect(s.matchHistory).toEqual([])
    expect(s.queue).toEqual(queueAfterWin)
  })
})

describe('hold dissolution', () => {
  function heldSession(): Session {
    let s = makeSession(['A', 'B', 'C', 'D', 'E'], { playSystem: 'challenge-court' })
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 1)
    return recordWin(s, 1, 1) // A,B hold court 1; queue = [E, C, D]
  }

  it('setPlaySystem dissolves holds to the queue front', () => {
    let s = heldSession()
    const [a, b, c, d, e] = ids(s, 'A', 'B', 'C', 'D', 'E')
    s = setPlaySystem(s, 'round-robin')
    expect(s.playSystem).toBe('round-robin')
    expect(s.courtWinners).toEqual({})
    expect(s.queue).toEqual([a, b, e, c, d])
  })

  it('setPlaySystem with the same system is a no-op', () => {
    const s = heldSession()
    expect(setPlaySystem(s, 'challenge-court')).toBe(s)
  })

  it('updateSessionFields dissolves holds on removed courts', () => {
    let s = makeSession(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], { playSystem: 'challenge-court' })
    s = assignToCourt(s, candidateOf(s, ['A', 'B', 'C', 'D']), 2)
    s = recordWin(s, 2, 1) // A,B hold court 2
    const [a, b] = ids(s, 'A', 'B')
    s = updateSessionFields(s, { numCourts: 1 })
    expect(s.courtWinners).toEqual({})
    expect(s.queue.slice(0, 2)).toEqual([a, b])
  })

  it('updateSessionFields dissolves all holds when the play system changes', () => {
    let s = heldSession()
    s = updateSessionFields(s, { playSystem: 'paddle-queue' })
    expect(s.courtWinners).toEqual({})
  })
})

describe('compareSessionsDesc', () => {
  it('sorts by date then createdAt, newest first', () => {
    const a = { date: '2026-07-19', createdAt: '1' } as Session
    const b = { date: '2026-07-20', createdAt: '2' } as Session
    expect([a, b].sort(compareSessionsDesc)[0]).toBe(b)
  })
})
```

- [x] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/utils/__tests__/sessionOps.test.ts`
Expected: FAIL — `assignToCourt` etc. not exported.

- [x] **Step 4: Replace `src/utils/sessionOps.ts`**

```ts
import type { Session, PlaySystem, CompletedGame } from '../types'
import type { Candidate } from './suggestions'

export interface NewSessionInput {
  date: string
  venue: string
  numCourts: number
  courtAmount: number | null
  playSystem: PlaySystem
  playerNames: string[]
}

function clampCourts(n: number): number {
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}

function normalizeAmount(amount: number | null): number | null {
  return amount !== null && Number.isFinite(amount) && amount > 0 ? amount : null
}

export function createNewSession(input: NewSessionInput): Session {
  const players: Session['players'] = []
  for (const raw of input.playerNames) {
    const name = raw.trim()
    if (!name) continue
    if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) continue
    players.push({ id: crypto.randomUUID(), name, checkedIn: false, participated: false })
  }
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'active',
    date: input.date,
    venue: input.venue.trim(),
    numCourts: clampCourts(input.numCourts),
    courtAmount: normalizeAmount(input.courtAmount),
    playSystem: input.playSystem,
    players,
    liveGames: [],
    matchHistory: [],
    queue: [],
    courtWinners: {},
  }
}

export function checkInPlayer(session: Session, playerId: string): Session {
  return {
    ...session,
    players: session.players.map(p =>
      p.id === playerId ? { ...p, checkedIn: true, participated: true } : p),
    queue: session.queue.includes(playerId) ? session.queue : [...session.queue, playerId],
  }
}

export function checkOutPlayer(session: Session, playerId: string): Session {
  let next: Session = {
    ...session,
    players: session.players.map(p =>
      p.id === playerId ? { ...p, checkedIn: false } : p),
    queue: session.queue.filter(id => id !== playerId),
  }

  const game = next.liveGames.find(g =>
    g.team1.includes(playerId) || g.team2.includes(playerId))
  if (game) {
    const remaining = [...game.team1, ...game.team2].filter(id => id !== playerId)
    next = {
      ...next,
      liveGames: next.liveGames.filter(g => g !== game),
      queue: [...remaining, ...next.queue],
    }
  }

  const held = Object.entries(next.courtWinners).find(([, pair]) => pair.includes(playerId))
  if (held) {
    const [court, pair] = held
    const courtWinners = { ...next.courtWinners }
    delete courtWinners[Number(court)]
    next = {
      ...next,
      courtWinners,
      queue: [...pair.filter(id => id !== playerId), ...next.queue],
    }
  }

  return next
}

export function addRosterPlayer(session: Session, name: string): Session {
  const trimmed = name.trim()
  if (!trimmed) return session
  if (session.players.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) return session
  return {
    ...session,
    players: [...session.players, { id: crypto.randomUUID(), name: trimmed, checkedIn: false, participated: false }],
  }
}

export function removeRosterPlayer(session: Session, playerId: string): Session {
  const cleared = checkOutPlayer(session, playerId)
  return { ...cleared, players: cleared.players.filter(p => p.id !== playerId) }
}

export function assignToCourt(session: Session, candidate: Candidate, court: number): Session {
  if (court < 1 || court > session.numCourts) return session
  if (session.liveGames.some(g => g.court === court)) return session
  const ids = [...candidate.team1, ...candidate.team2]
  if (new Set(ids).size !== 4) return session
  const held = session.courtWinners[court] ?? []
  const available = new Set([...session.queue, ...held])
  if (ids.some(id => !available.has(id))) return session

  const courtWinners = { ...session.courtWinners }
  delete courtWinners[court]
  return {
    ...session,
    liveGames: [...session.liveGames, {
      court,
      team1: [candidate.team1[0], candidate.team1[1]],
      team2: [candidate.team2[0], candidate.team2[1]],
    }],
    queue: session.queue.filter(id => !ids.includes(id)),
    courtWinners,
  }
}

export function recordWin(session: Session, court: number, winner: 1 | 2): Session {
  const game = session.liveGames.find(g => g.court === court)
  if (!game) return session
  const completed: CompletedGame = {
    id: crypto.randomUUID(),
    court,
    team1: [game.team1[0], game.team1[1]],
    team2: [game.team2[0], game.team2[1]],
    winner,
    endedAt: new Date().toISOString(),
  }
  const winners = winner === 1 ? game.team1 : game.team2
  const losers = winner === 1 ? game.team2 : game.team1
  const base = {
    ...session,
    liveGames: session.liveGames.filter(g => g !== game),
    matchHistory: [...session.matchHistory, completed],
  }
  if (session.playSystem === 'challenge-court') {
    return {
      ...base,
      queue: [...session.queue, ...losers],
      courtWinners: { ...session.courtWinners, [court]: [winners[0], winners[1]] },
    }
  }
  return { ...base, queue: [...session.queue, ...losers, ...winners] }
}

export function cancelGame(session: Session, court: number): Session {
  const game = session.liveGames.find(g => g.court === court)
  if (!game) return session
  return {
    ...session,
    liveGames: session.liveGames.filter(g => g !== game),
    queue: [...game.team1, ...game.team2, ...session.queue],
  }
}

export function setGameWinner(session: Session, gameId: string, winner: 1 | 2): Session {
  return {
    ...session,
    matchHistory: session.matchHistory.map(g =>
      g.id === gameId ? { ...g, winner } : g),
  }
}

export function deleteGame(session: Session, gameId: string): Session {
  return {
    ...session,
    matchHistory: session.matchHistory.filter(g => g.id !== gameId),
  }
}

function dissolveHolds(session: Session, courts: number[]): Session {
  const freed: string[] = []
  const courtWinners = { ...session.courtWinners }
  for (const court of courts) {
    const pair = courtWinners[court]
    if (pair) {
      freed.push(...pair)
      delete courtWinners[court]
    }
  }
  if (freed.length === 0) return session
  return { ...session, courtWinners, queue: [...freed, ...session.queue] }
}

export function setPlaySystem(session: Session, playSystem: PlaySystem): Session {
  if (playSystem === session.playSystem) return session
  const dissolved = dissolveHolds(session, Object.keys(session.courtWinners).map(Number))
  return { ...dissolved, playSystem }
}

export function updateSessionFields(
  session: Session,
  fields: Partial<Pick<Session, 'date' | 'venue' | 'numCourts' | 'courtAmount' | 'playSystem'>>,
): Session {
  const next = { ...session, ...fields }
  if (fields.numCourts !== undefined) next.numCourts = clampCourts(fields.numCourts)
  if (fields.courtAmount !== undefined) next.courtAmount = normalizeAmount(fields.courtAmount)
  if (fields.venue !== undefined) next.venue = fields.venue.trim()
  const systemChanged = fields.playSystem !== undefined && fields.playSystem !== session.playSystem
  const toDissolve = Object.keys(next.courtWinners).map(Number)
    .filter(court => systemChanged || court > next.numCourts)
  return dissolveHolds(next, toDissolve)
}

export function compareSessionsDesc(a: Session, b: Session): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
  return 0
}

export function localToday(): string {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
}
```

- [x] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/utils/__tests__/sessionOps.test.ts`
Expected: PASS (20 tests).

- [x] **Step 6: Commit**

```bash
git add -A src/utils
git commit -m "refactor: games-first session ops; drop round-based matchups module"
```

---

### Task 5: SessionContext new API

**Files:**
- Modify: `src/context/SessionContext.tsx` (full replacement below)
- Test: `src/context/__tests__/SessionContext.test.tsx` (full replacement below)

**Interfaces:**
- Consumes: ops from Task 4, `Candidate` from Task 2.
- Produces: `useSession()` returning `{ session, readOnly, checkIn(playerId), checkOut(playerId), setPlaySystem(system), assignToCourt(candidate, court), recordWin(court, winner), cancelGame(court), setGameWinner(gameId, winner), deleteGame(gameId) }`. Components in Tasks 6–9 rely on these exact names.

- [x] **Step 1: Write failing tests — replace `src/context/__tests__/SessionContext.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionsProvider } from '../SessionsContext'
import { SessionProvider, useSession } from '../SessionContext'
import { createNewSession, checkInPlayer, assignToCourt } from '../../utils/sessionOps'
import { saveSessions } from '../../utils/storage'
import type { Session } from '../../types'

function makeSession(): Session {
  let s = createNewSession({
    date: '2026-07-20', venue: '', numCourts: 1, courtAmount: null,
    playSystem: 'paddle-queue', playerNames: ['A', 'B', 'C', 'D', 'E'],
  })
  for (const p of s.players) s = checkInPlayer(s, p.id)
  const [a, b, c, d] = s.players.map(p => p.id)
  return assignToCourt(s, { team1: [a, b], team2: [c, d] }, 1)
}

function Probe() {
  const { session, readOnly, recordWin, cancelGame, setGameWinner, deleteGame } = useSession()
  return (
    <div>
      <p>live:{session.liveGames.length}</p>
      <p>history:{session.matchHistory.length}</p>
      <p>queue:{session.queue.length}</p>
      <p>readOnly:{String(readOnly)}</p>
      <button onClick={() => recordWin(1, 1)}>win1</button>
      <button onClick={() => cancelGame(1)}>cancel</button>
      <button onClick={() => session.matchHistory[0] && setGameWinner(session.matchHistory[0].id, 2)}>flip</button>
      <button onClick={() => session.matchHistory[0] && deleteGame(session.matchHistory[0].id)}>delete</button>
    </div>
  )
}

function renderProbe(session: Session) {
  saveSessions([session])
  return render(
    <SessionsProvider>
      <SessionProvider sessionId={session.id}>
        <Probe />
      </SessionProvider>
    </SessionsProvider>
  )
}

describe('SessionContext', () => {
  beforeEach(() => localStorage.clear())

  it('recordWin moves the live game into history and re-queues players', async () => {
    const user = userEvent.setup()
    renderProbe(makeSession())
    expect(screen.getByText('live:1')).toBeInTheDocument()
    await user.click(screen.getByText('win1'))
    expect(screen.getByText('live:0')).toBeInTheDocument()
    expect(screen.getByText('history:1')).toBeInTheDocument()
    expect(screen.getByText('queue:5')).toBeInTheDocument()
  })

  it('cancelGame frees the court without recording', async () => {
    const user = userEvent.setup()
    renderProbe(makeSession())
    await user.click(screen.getByText('cancel'))
    expect(screen.getByText('live:0')).toBeInTheDocument()
    expect(screen.getByText('history:0')).toBeInTheDocument()
  })

  it('setGameWinner and deleteGame edit history', async () => {
    const user = userEvent.setup()
    renderProbe(makeSession())
    await user.click(screen.getByText('win1'))
    await user.click(screen.getByText('flip'))
    expect(screen.getByText('history:1')).toBeInTheDocument()
    await user.click(screen.getByText('delete'))
    expect(screen.getByText('history:0')).toBeInTheDocument()
  })

  it('readOnly reflects ended status', () => {
    renderProbe({ ...makeSession(), status: 'ended' })
    expect(screen.getByText('readOnly:true')).toBeInTheDocument()
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/context/__tests__/SessionContext.test.tsx`
Expected: FAIL — `recordWin` is not a function (old context API).

- [x] **Step 3: Replace `src/context/SessionContext.tsx`**

```tsx
import { createContext, useContext, useCallback, type ReactNode } from 'react'
import type { Session, PlaySystem } from '../types'
import type { Candidate } from '../utils/suggestions'
import { useSessions } from './SessionsContext'
import {
  checkInPlayer, checkOutPlayer,
  assignToCourt as assignToCourtOp,
  recordWin as recordWinOp,
  cancelGame as cancelGameOp,
  setGameWinner as setGameWinnerOp,
  deleteGame as deleteGameOp,
  setPlaySystem as setPlaySystemOp,
} from '../utils/sessionOps'

interface SessionContextType {
  session: Session
  readOnly: boolean
  checkIn: (playerId: string) => void
  checkOut: (playerId: string) => void
  setPlaySystem: (system: PlaySystem) => void
  assignToCourt: (candidate: Candidate, court: number) => void
  recordWin: (court: number, winner: 1 | 2) => void
  cancelGame: (court: number) => void
  setGameWinner: (gameId: string, winner: 1 | 2) => void
  deleteGame: (gameId: string) => void
}

const SessionContext = createContext<SessionContextType | null>(null)

export function SessionProvider({ sessionId, children }: { sessionId: string; children: ReactNode }) {
  const { sessions, updateSession } = useSessions()
  const session = sessions.find(s => s.id === sessionId)

  const checkIn = useCallback((playerId: string) =>
    updateSession(sessionId, s => checkInPlayer(s, playerId)), [sessionId, updateSession])

  const checkOut = useCallback((playerId: string) =>
    updateSession(sessionId, s => checkOutPlayer(s, playerId)), [sessionId, updateSession])

  const setPlaySystem = useCallback((playSystem: PlaySystem) =>
    updateSession(sessionId, s => setPlaySystemOp(s, playSystem)), [sessionId, updateSession])

  const assignToCourt = useCallback((candidate: Candidate, court: number) =>
    updateSession(sessionId, s => assignToCourtOp(s, candidate, court)), [sessionId, updateSession])

  const recordWin = useCallback((court: number, winner: 1 | 2) =>
    updateSession(sessionId, s => recordWinOp(s, court, winner)), [sessionId, updateSession])

  const cancelGame = useCallback((court: number) =>
    updateSession(sessionId, s => cancelGameOp(s, court)), [sessionId, updateSession])

  const setGameWinner = useCallback((gameId: string, winner: 1 | 2) =>
    updateSession(sessionId, s => setGameWinnerOp(s, gameId, winner)), [sessionId, updateSession])

  const deleteGame = useCallback((gameId: string) =>
    updateSession(sessionId, s => deleteGameOp(s, gameId)), [sessionId, updateSession])

  if (!session) return null

  return (
    <SessionContext.Provider value={{
      session,
      readOnly: session.status === 'ended',
      checkIn, checkOut, setPlaySystem,
      assignToCourt, recordWin, cancelGame, setGameWinner, deleteGame,
    }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/context/__tests__/SessionContext.test.tsx`
Expected: PASS (4 tests).

- [x] **Step 5: Commit**

```bash
git add src/context/SessionContext.tsx src/context/__tests__/SessionContext.test.tsx
git commit -m "refactor: session context exposes games-first ops"
```

---

### Task 6: MatchupsTab — court cards, win & cancel

**Files:**
- Modify: `src/components/MatchupsTab.tsx` (full replacement below — suggestions section arrives in Task 7)
- Test: `src/components/__tests__/MatchupsTab.test.tsx` (full replacement below)

**Interfaces:**
- Consumes: `useSession()` (Task 5), `winStreak` (Task 3), `gamesPlayedMap` (Task 2).
- Produces: the court-cards UI. Task 7 extends this exact file.

- [x] **Step 1: Write failing tests — replace `src/components/__tests__/MatchupsTab.test.tsx`**

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SessionsProvider } from '../../context/SessionsContext'
import { SessionProvider } from '../../context/SessionContext'
import { MatchupsTab } from '../MatchupsTab'
import { createNewSession, checkInPlayer, assignToCourt } from '../../utils/sessionOps'
import { saveSessions } from '../../utils/storage'
import type { Session, PlaySystem } from '../../types'

function makeSession(names: string[], playSystem: PlaySystem = 'paddle-queue', numCourts = 2): Session {
  let s = createNewSession({
    date: '2026-07-20', venue: '', numCourts, courtAmount: null,
    playSystem, playerNames: names,
  })
  for (const p of s.players) s = checkInPlayer(s, p.id)
  return s
}

function withLiveGame(s: Session, court = 1): Session {
  const [a, b, c, d] = s.queue
  return assignToCourt(s, { team1: [a, b], team2: [c, d] }, court)
}

function renderTab(session: Session) {
  saveSessions([session])
  return render(
    <SessionsProvider>
      <SessionProvider sessionId={session.id}>
        <MatchupsTab />
      </SessionProvider>
    </SessionsProvider>
  )
}

function courtCard(court: number) {
  return screen.getByText(`Court ${court}`).closest('div[data-court]') as HTMLElement
}

describe('MatchupsTab courts', () => {
  beforeEach(() => localStorage.clear())

  it('renders one card per court with free state', () => {
    renderTab(makeSession(['A', 'B', 'C', 'D'], 'paddle-queue', 2))
    expect(screen.getByText('Court 1')).toBeInTheDocument()
    expect(screen.getByText('Court 2')).toBeInTheDocument()
    expect(screen.getAllByText('Free')).toHaveLength(2)
  })

  it('has no Roster section or legacy round buttons', () => {
    renderTab(makeSession(['A', 'B', 'C', 'D']))
    expect(screen.queryByText('Roster')).toBeNull()
    expect(screen.queryByText(/Next Round|Generate Matchups|Reshuffle/)).toBeNull()
  })

  it('shows teams and win buttons on a live court; a win frees the court', async () => {
    const user = userEvent.setup()
    renderTab(withLiveGame(makeSession(['A', 'B', 'C', 'D', 'E'])))
    const card = courtCard(1)
    expect(within(card).getByText('A')).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: 'Team 1 Wins' }))
    expect(within(courtCard(1)).getByText('Free')).toBeInTheDocument()
  })

  it('challenge court: win keeps winners on court with streak', async () => {
    const user = userEvent.setup()
    renderTab(withLiveGame(makeSession(['A', 'B', 'C', 'D', 'E'], 'challenge-court')))
    await user.click(within(courtCard(1)).getByRole('button', { name: 'Team 1 Wins' }))
    const card = courtCard(1)
    expect(within(card).getByText('A & B')).toBeInTheDocument()
    expect(within(card).getByText(/1 win · awaiting challengers/)).toBeInTheDocument()
  })

  it('cancel returns players and records nothing after confirm', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderTab(withLiveGame(makeSession(['A', 'B', 'C', 'D'])))
    await user.click(screen.getByRole('button', { name: 'Cancel game on court 1' }))
    expect(within(courtCard(1)).getByText('Free')).toBeInTheDocument()
    vi.restoreAllMocks()
  })

  it('hides action buttons when read-only', () => {
    const s = withLiveGame(makeSession(['A', 'B', 'C', 'D']))
    renderTab({ ...s, status: 'ended' })
    expect(screen.queryByRole('button', { name: 'Team 1 Wins' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Cancel game/ })).toBeNull()
  })

  it('keeps rendering a live game on a court beyond numCourts', () => {
    const s = withLiveGame(makeSession(['A', 'B', 'C', 'D'], 'paddle-queue', 2), 2)
    renderTab({ ...s, numCourts: 1 })
    expect(screen.getByText('Court 2')).toBeInTheDocument()
    expect(screen.queryByText('Court 3')).toBeNull()
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/MatchupsTab.test.tsx`
Expected: FAIL — old component still imports deleted `../utils/matchups`.

- [x] **Step 3: Replace `src/components/MatchupsTab.tsx`**

```tsx
import { useMemo, useRef } from 'react'
import { useSession } from '../context/SessionContext'
import type { PlaySystem } from '../types'
import { winStreak } from '../utils/stats'

const systemLabels: Record<PlaySystem, string> = {
  'paddle-queue': 'Paddle Queue',
  'challenge-court': 'Challenge Court',
  'round-robin': 'Round Robin',
}

const systemTaglines: Record<PlaySystem, string> = {
  'paddle-queue': 'Next in line plays next',
  'challenge-court': 'Winners stay, losers rotate',
  'round-robin': 'Everyone plays with everyone',
}

export function MatchupsTab() {
  const { session, readOnly, setPlaySystem, recordWin, cancelGame } = useSession()
  const topRef = useRef<HTMLDivElement>(null)

  const playerNameMap = new Map(session.players.map(p => [p.id, p.name]))
  const getName = (id: string) => playerNameMap.get(id) ?? id
  const teamNames = (team: [string, string]) => team.map(getName).join(' & ')

  const liveByCourt = new Map(session.liveGames.map(g => [g.court, g]))
  const courts = useMemo(() => {
    const set = new Set<number>()
    for (let c = 1; c <= session.numCourts; c++) set.add(c)
    for (const g of session.liveGames) set.add(g.court)
    return [...set].sort((a, b) => a - b)
  }, [session.numCourts, session.liveGames])

  const handleCancel = (court: number) => {
    if (window.confirm('Cancel this game? Nothing will be recorded.')) cancelGame(court)
  }

  const checkedInCount = session.players.filter(p => p.checkedIn).length

  return (
    <div ref={topRef} className="space-y-4">
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {(Object.entries(systemLabels) as [PlaySystem, string][]).map(([key, label]) => (
          <button
            key={key}
            disabled={readOnly}
            onClick={() => setPlaySystem(key)}
            className={`flex-1 rounded-md py-2 text-xs font-medium min-h-[40px] ${
              session.playSystem === key
                ? 'bg-white dark:bg-gray-900 text-green-700 dark:text-green-300 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
        {systemTaglines[session.playSystem]}
      </p>

      {checkedInCount < 4 && session.liveGames.length === 0 && (
        <p className="text-sm text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3">
          Need at least 4 checked-in players to fill a court. Currently: {checkedInCount}
        </p>
      )}

      <div className="space-y-3">
        {courts.map(court => {
          const game = liveByCourt.get(court)
          const holders = session.courtWinners[court]
          return (
            <div
              key={court}
              data-court={court}
              className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500">Court {court}</p>
                {game && !readOnly && (
                  <button
                    onClick={() => handleCancel(court)}
                    aria-label={`Cancel game on court ${court}`}
                    className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 px-2 min-h-[28px]"
                  >
                    ✕
                  </button>
                )}
              </div>

              {game ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-center flex-1 space-y-1">
                      {game.team1.map(id => (
                        <p key={id} className="font-medium text-gray-900 dark:text-gray-50">{getName(id)}</p>
                      ))}
                    </div>
                    <span className="text-gray-400 dark:text-gray-500 font-bold px-3">vs</span>
                    <div className="text-center flex-1 space-y-1">
                      {game.team2.map(id => (
                        <p key={id} className="font-medium text-gray-900 dark:text-gray-50">{getName(id)}</p>
                      ))}
                    </div>
                  </div>
                  {!readOnly && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <button
                        onClick={() => recordWin(court, 1)}
                        className="flex-1 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 py-2 text-xs font-medium min-h-[40px]"
                      >
                        Team 1 Wins
                      </button>
                      <button
                        onClick={() => recordWin(court, 2)}
                        className="flex-1 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 py-2 text-xs font-medium min-h-[40px]"
                      >
                        Team 2 Wins
                      </button>
                    </div>
                  )}
                </>
              ) : holders ? (
                <div className="text-center space-y-1 py-1">
                  <p className="font-medium text-gray-900 dark:text-gray-50">{teamNames(holders)}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-300">
                    {(() => {
                      const streak = winStreak(session.matchHistory, court, holders)
                      return `${streak} win${streak !== 1 ? 's' : ''} · awaiting challengers`
                    })()}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">Free</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/MatchupsTab.test.tsx`
Expected: PASS (7 tests).

- [x] **Step 5: Commit**

```bash
git add src/components/MatchupsTab.tsx src/components/__tests__/MatchupsTab.test.tsx
git commit -m "feat: court cards with win and cancel actions"
```

---

### Task 7: MatchupsTab — suggestions, waiting list, scroll

**Files:**
- Modify: `src/components/MatchupsTab.tsx` (insertions below, anchored to Task 6's code)
- Modify: `src/test-setup.ts` (scrollIntoView stub)
- Test: `src/components/__tests__/MatchupsTab.test.tsx` (append describe block below)

**Interfaces:**
- Consumes: `suggestFoursomes`, `suggestChallengers`, `gamesPlayedMap`, `Candidate` (Task 2); `assignToCourt` from `useSession()` (Task 5).
- Produces: completed MatchupsTab.

- [x] **Step 1: Add the scrollIntoView stub to `src/test-setup.ts`** (append at end)

```ts
// jsdom does not implement scrollIntoView; MatchupsTab calls it after assigning.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
```

- [x] **Step 2: Append failing tests to `src/components/__tests__/MatchupsTab.test.tsx`**

```tsx
describe('MatchupsTab suggestions', () => {
  beforeEach(() => localStorage.clear())

  it('lists ranked candidates with an assign button per free court', async () => {
    const user = userEvent.setup()
    renderTab(makeSession(['A', 'B', 'C', 'D', 'E'], 'paddle-queue', 2))
    expect(screen.getByText('Up Next')).toBeInTheDocument()
    const first = screen.getAllByTestId('suggestion')[0]
    expect(within(first).getByText(/A & B/)).toBeInTheDocument()
    expect(within(first).getByRole('button', { name: 'Assign to Court 1' })).toBeInTheDocument()
    expect(within(first).getByRole('button', { name: 'Assign to Court 2' })).toBeInTheDocument()
    await user.click(within(first).getByRole('button', { name: 'Assign to Court 1' }))
    expect(within(courtCard(1)).getByRole('button', { name: 'Team 1 Wins' })).toBeInTheDocument()
  })

  it('smooth-scrolls to the top after assigning', async () => {
    const user = userEvent.setup()
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView')
    renderTab(makeSession(['A', 'B', 'C', 'D']))
    await user.click(screen.getAllByRole('button', { name: 'Assign to Court 1' })[0])
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth' })
    scrollSpy.mockRestore()
  })

  it('shows challenger candidates for a held court', async () => {
    const user = userEvent.setup()
    renderTab(withLiveGame(makeSession(['A', 'B', 'C', 'D', 'E', 'F'], 'challenge-court')))
    await user.click(within(courtCard(1)).getByRole('button', { name: 'Team 1 Wins' }))
    expect(screen.getByText('Challengers · Court 1')).toBeInTheDocument()
    const first = screen.getAllByTestId('suggestion')[0]
    expect(within(first).getByText('E & F')).toBeInTheDocument()
    await user.click(within(first).getByRole('button', { name: 'Assign to Court 1' }))
    expect(within(courtCard(1)).getByRole('button', { name: 'Team 2 Wins' })).toBeInTheDocument()
  })

  it('shows waiting chips with game counts but no suggestions when fewer than 4 wait', () => {
    renderTab(makeSession(['A', 'B', 'C']))
    expect(screen.queryByText('Up Next')).toBeNull()
    expect(screen.getByText('Waiting (3)')).toBeInTheDocument()
    expect(screen.getByText('A · 0')).toBeInTheDocument()
  })

  it('hides suggestions when read-only', () => {
    renderTab({ ...makeSession(['A', 'B', 'C', 'D']), status: 'ended' })
    expect(screen.queryByText('Up Next')).toBeNull()
  })
})
```

- [x] **Step 3: Run tests to verify the new block fails**

Run: `npx vitest run src/components/__tests__/MatchupsTab.test.tsx`
Expected: FAIL — no "Up Next" section yet (Task 6 tests still pass).

- [x] **Step 4: Extend `src/components/MatchupsTab.tsx`**

4a. Replace the import lines

```tsx
import { useSession } from '../context/SessionContext'
import type { PlaySystem } from '../types'
import { winStreak } from '../utils/stats'
```

with

```tsx
import { useSession } from '../context/SessionContext'
import type { PlaySystem } from '../types'
import { winStreak } from '../utils/stats'
import { suggestFoursomes, suggestChallengers, gamesPlayedMap, type Candidate } from '../utils/suggestions'
```

4b. Replace the destructuring line

```tsx
  const { session, readOnly, setPlaySystem, recordWin, cancelGame } = useSession()
```

with

```tsx
  const { session, readOnly, setPlaySystem, recordWin, cancelGame, assignToCourt } = useSession()
```

4c. Insert after the `courts` useMemo block:

```tsx
  const gamesCount = useMemo(() => gamesPlayedMap(session.matchHistory), [session.matchHistory])

  const foursomes = useMemo(
    () => suggestFoursomes(session.queue, session.matchHistory, session.playSystem),
    [session.queue, session.matchHistory, session.playSystem],
  )

  const challengerCandidates = useMemo(() => {
    const map = new Map<number, Candidate[]>()
    for (const [court, winners] of Object.entries(session.courtWinners)) {
      map.set(Number(court), suggestChallengers(session.queue, winners))
    }
    return map
  }, [session.queue, session.courtWinners])

  const freeCourts = courts.filter(c =>
    c <= session.numCourts && !liveByCourt.has(c) && !session.courtWinners[c])

  const assign = (candidate: Candidate, court: number) => {
    assignToCourt(candidate, court)
    topRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
```

4d. Insert before the closing `</div>` of the component's root element (after the court-cards `<div className="space-y-3">…</div>` block):

```tsx
      {!readOnly && [...challengerCandidates.entries()].map(([court, pairs]) => pairs.length > 0 && (
        <div key={court} className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Challengers · Court {court}
          </h3>
          {pairs.map((cand, i) => (
            <div
              key={i}
              data-testid="suggestion"
              className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex items-center justify-between gap-2"
            >
              <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{teamNames(cand.team2)}</p>
              <button
                onClick={() => assign(cand, court)}
                className="rounded-md bg-green-600 dark:bg-green-700 text-white px-3 py-2 text-xs font-medium min-h-[40px] shrink-0"
              >
                Assign to Court {court}
              </button>
            </div>
          ))}
        </div>
      ))}

      {!readOnly && freeCourts.length > 0 && foursomes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Up Next</h3>
          {foursomes.map((cand, i) => (
            <div
              key={i}
              data-testid="suggestion"
              className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2"
            >
              <p className="text-sm font-medium text-gray-900 dark:text-gray-50 text-center">
                {teamNames(cand.team1)} <span className="text-gray-400 dark:text-gray-500">vs</span> {teamNames(cand.team2)}
              </p>
              <div className="flex gap-2">
                {freeCourts.map(court => (
                  <button
                    key={court}
                    onClick={() => assign(cand, court)}
                    className="flex-1 rounded-md bg-green-600 dark:bg-green-700 text-white py-2 text-xs font-medium min-h-[40px]"
                  >
                    Assign to Court {court}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {session.queue.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">Waiting ({session.queue.length})</p>
          <div className="flex flex-wrap gap-1">
            {session.queue.map(id => (
              <span key={id} className="text-sm px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">
                {getName(id)} · {gamesCount.get(id) ?? 0}
              </span>
            ))}
          </div>
        </div>
      )}
```

- [x] **Step 5: Run the full component test file**

Run: `npx vitest run src/components/__tests__/MatchupsTab.test.tsx`
Expected: PASS (12 tests).

- [x] **Step 6: Commit**

```bash
git add src/components/MatchupsTab.tsx src/components/__tests__/MatchupsTab.test.tsx src/test-setup.ts
git commit -m "feat: ranked suggestions with per-court assignment and waiting list"
```

---

### Task 8: MatchesTab rewrite

**Files:**
- Modify: `src/components/MatchesTab.tsx` (full replacement below)
- Test: `src/components/__tests__/MatchesTab.test.tsx` (full replacement below)

**Interfaces:**
- Consumes: `useSession()` — `session.matchHistory`, `setGameWinner(gameId, winner)`, `deleteGame(gameId)`.
- Produces: flat newest-first game list.

- [x] **Step 1: Write failing tests — replace `src/components/__tests__/MatchesTab.test.tsx`**

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SessionsProvider } from '../../context/SessionsContext'
import { SessionProvider } from '../../context/SessionContext'
import { MatchesTab } from '../MatchesTab'
import { createNewSession, checkInPlayer, assignToCourt, recordWin } from '../../utils/sessionOps'
import { saveSessions } from '../../utils/storage'
import type { Session } from '../../types'

function sessionWithGames(): Session {
  let s = createNewSession({
    date: '2026-07-20', venue: '', numCourts: 2, courtAmount: null,
    playSystem: 'paddle-queue', playerNames: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  })
  for (const p of s.players) s = checkInPlayer(s, p.id)
  const [a, b, c, d, e, f, g, h] = s.players.map(p => p.id)
  s = assignToCourt(s, { team1: [a, b], team2: [c, d] }, 1)
  s = recordWin(s, 1, 1)                                   // game 1: A&B beat C&D
  s = assignToCourt(s, { team1: [e, f], team2: [g, h] }, 2)
  s = recordWin(s, 2, 2)                                   // game 2: G&H beat E&F
  return s
}

function renderTab(session: Session) {
  saveSessions([session])
  return render(
    <SessionsProvider>
      <SessionProvider sessionId={session.id}>
        <MatchesTab />
      </SessionProvider>
    </SessionsProvider>
  )
}

describe('MatchesTab', () => {
  beforeEach(() => localStorage.clear())

  it('shows an empty state without games', () => {
    const s = createNewSession({
      date: '2026-07-20', venue: '', numCourts: 1, courtAmount: null,
      playSystem: 'paddle-queue', playerNames: [],
    })
    renderTab(s)
    expect(screen.getByText(/No games yet/)).toBeInTheDocument()
  })

  it('lists games newest first with winner marked, no round grouping or sat-out', () => {
    renderTab(sessionWithGames())
    const rows = screen.getAllByTestId('game-row')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText(/G & H/)).toBeInTheDocument() // newest first
    expect(within(rows[0]).getByRole('button', { name: /G & H ✓/ })).toBeInTheDocument()
    expect(screen.queryByText(/Sat out/)).toBeNull()
    expect(screen.queryByText(/Round \d/)).toBeNull()
  })

  it('taps the losing team to flip the winner', async () => {
    const user = userEvent.setup()
    renderTab(sessionWithGames())
    const row = screen.getAllByTestId('game-row')[1]
    await user.click(within(row).getByRole('button', { name: /C & D/ }))
    expect(within(row).getByRole('button', { name: /C & D ✓/ })).toBeInTheDocument()
  })

  it('deletes a record after confirm', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderTab(sessionWithGames())
    await user.click(screen.getAllByRole('button', { name: /Delete game/ })[0])
    expect(screen.getAllByTestId('game-row')).toHaveLength(1)
    vi.restoreAllMocks()
  })

  it('disables corrections when ended', () => {
    renderTab({ ...sessionWithGames(), status: 'ended' })
    const row = screen.getAllByTestId('game-row')[0]
    expect(within(row).getByRole('button', { name: /G & H ✓/ })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Delete game/ })).toBeNull()
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/MatchesTab.test.tsx`
Expected: FAIL — old component reads `session.roundHistory`.

- [x] **Step 3: Replace `src/components/MatchesTab.tsx`**

```tsx
import { useSession } from '../context/SessionContext'

export function MatchesTab() {
  const { session, readOnly, setGameWinner, deleteGame } = useSession()
  const nameMap = new Map(session.players.map(p => [p.id, p.name]))
  const getName = (id: string) => nameMap.get(id) ?? id

  if (session.matchHistory.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
        No games yet. Completed games appear here.
      </p>
    )
  }

  const games = [...session.matchHistory].reverse()

  const teamClasses = (isWinner: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-medium min-h-[44px] disabled:opacity-70 ${
      isWinner
        ? 'bg-green-600 dark:bg-green-700 text-white'
        : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600'
    }`

  const handleDelete = (gameId: string) => {
    if (window.confirm('Delete this game record? Stats will update.')) deleteGame(gameId)
  }

  return (
    <div className="space-y-3">
      {games.map(game => (
        <div
          key={game.id}
          data-testid="game-row"
          className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 dark:text-gray-500">Court {game.court}</p>
            {!readOnly && (
              <button
                onClick={() => handleDelete(game.id)}
                aria-label={`Delete game on court ${game.court}`}
                className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 px-2 min-h-[28px]"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={readOnly}
              onClick={() => game.winner !== 1 && setGameWinner(game.id, 1)}
              className={teamClasses(game.winner === 1)}
            >
              {game.team1.map(getName).join(' & ')}{game.winner === 1 ? ' ✓' : ''}
            </button>
            <span className="text-xs text-gray-400 dark:text-gray-500">vs</span>
            <button
              disabled={readOnly}
              onClick={() => game.winner !== 2 && setGameWinner(game.id, 2)}
              className={teamClasses(game.winner === 2)}
            >
              {game.team2.map(getName).join(' & ')}{game.winner === 2 ? ' ✓' : ''}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/MatchesTab.test.tsx`
Expected: PASS (5 tests).

- [x] **Step 5: Commit**

```bash
git add src/components/MatchesTab.tsx src/components/__tests__/MatchesTab.test.tsx
git commit -m "feat: flat match list with winner correction and record delete"
```

---

### Task 9: PlayersTab stats

**Files:**
- Modify: `src/components/PlayersTab.tsx` (replace the subtext block, lines 25–30 of the current file — exact edit below)
- Test: `src/components/__tests__/PlayersTab.test.tsx` (update: the "played earlier" test is replaced by stat-subline tests below; keep the existing check-in/out tests unchanged)

**Interfaces:**
- Consumes: `computePlayerStats` (Task 3), `useSession()`.
- Produces: stat sublines.

- [x] **Step 1: Update tests — in `src/components/__tests__/PlayersTab.test.tsx`, delete the test asserting the "played earlier" subtext and add**

(reuse the file's existing render helper; if it builds sessions via `createNewSession`, extend fixtures the same way as below)

```tsx
import { createNewSession, checkInPlayer, assignToCourt, recordWin } from '../../utils/sessionOps'

function sessionWithStats(): Session {
  let s = createNewSession({
    date: '2026-07-20', venue: '', numCourts: 1, courtAmount: null,
    playSystem: 'paddle-queue', playerNames: ['A', 'B', 'C', 'D', 'E'],
  })
  for (const p of s.players) s = checkInPlayer(s, p.id)
  const [a, b, c, d] = s.players.map(p => p.id)
  s = assignToCourt(s, { team1: [a, b], team2: [c, d] }, 1)
  s = recordWin(s, 1, 1)
  return s
}

it('shows games, W–L, and win percentage per player', () => {
  renderTab(sessionWithStats())
  expect(screen.getAllByText('1 game · 1W–0L · 100%')).toHaveLength(2) // A and B
  expect(screen.getAllByText('1 game · 0W–1L · 0%')).toHaveLength(2)   // C and D
  expect(screen.getByText('0 games')).toBeInTheDocument()              // E
})
```

- [x] **Step 2: Run tests to verify the new test fails**

Run: `npx vitest run src/components/__tests__/PlayersTab.test.tsx`
Expected: FAIL — stat subline not rendered.

- [x] **Step 3: Edit `src/components/PlayersTab.tsx`**

Add the import and compute stats once:

```tsx
import { useSession } from '../context/SessionContext'
import { computePlayerStats } from '../utils/stats'

export function PlayersTab() {
  const { session, readOnly, checkIn, checkOut } = useSession()
  const checkedInCount = session.players.filter(p => p.checkedIn).length
  const stats = computePlayerStats(session.matchHistory)
```

Replace the name/subtext block

```tsx
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-gray-50 truncate">{player.name}</p>
              {player.participated && !player.checkedIn && (
                <p className="text-xs text-gray-400 dark:text-gray-500">played earlier</p>
              )}
            </div>
```

with

```tsx
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-gray-50 truncate">{player.name}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {(() => {
                  const s = stats.get(player.id)
                  if (!s) return '0 games'
                  const pct = Math.round((s.wins / s.games) * 100)
                  return `${s.games} game${s.games !== 1 ? 's' : ''} · ${s.wins}W–${s.losses}L · ${pct}%`
                })()}
              </p>
            </div>
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/PlayersTab.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/components/PlayersTab.tsx src/components/__tests__/PlayersTab.test.tsx
git commit -m "feat: per-player game count, record, and win rate"
```

---

### Task 10: SessionModal relabel

**Files:**
- Modify: `src/components/SessionModal.tsx:150-152` (label + aria-label)
- Test: `src/components/__tests__/SessionModal.test.tsx` (matching label updates)

**Interfaces:**
- Consumes/produces: none new — copy change only. The field still writes `courtAmount`.

- [x] **Step 1: Update the label in `src/components/SessionModal.tsx`**

Replace

```tsx
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Court Amount (optional)</span>
          <input
            type="number"
            aria-label="Court Amount"
```

with

```tsx
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Total amount (optional)</span>
          <input
            type="number"
            aria-label="Total Amount"
```

- [x] **Step 2: Update `src/components/__tests__/SessionModal.test.tsx`** *(no-op — the test file contains no Court Amount matchers)*

Replace every `getByLabelText('Court Amount')` / `{ name: 'Court Amount' }` / `/Court Amount/` matcher with `'Total Amount'` (same query kinds, new string). No behavioral assertions change.

- [x] **Step 3: Run tests**

Run: `npx vitest run src/components/__tests__/SessionModal.test.tsx`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add src/components/SessionModal.tsx src/components/__tests__/SessionModal.test.tsx
git commit -m "feat: relabel court amount to total amount"
```

---

### Task 11: Standalone court-cost calculator

**Files:**
- Create: `src/components/CourtCostCalculator.tsx`
- Modify: `src/screens/SessionListScreen.tsx` (header button + modal, anchored below)
- Test: `src/components/__tests__/CourtCostCalculator.test.tsx`

**Interfaces:**
- Consumes: `Modal` component (existing, props `{ title, onClose, children }`), `loadCalculator`/`saveCalculator` (Task 1), `CalculatorRow`/`CalculatorState` types (Task 1).
- Produces: `CourtCostCalculator({ onClose }: { onClose: () => void })`.

- [x] **Step 1: Write failing tests `src/components/__tests__/CourtCostCalculator.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router'
import { CourtCostCalculator } from '../CourtCostCalculator'
import { SessionsProvider } from '../../context/SessionsContext'
import { SessionListScreen } from '../../screens/SessionListScreen'
import { loadCalculator } from '../../utils/storage'

describe('CourtCostCalculator', () => {
  beforeEach(() => localStorage.clear())

  it('computes row subtotals with the default rate and shows the total', async () => {
    const user = userEvent.setup()
    render(<CourtCostCalculator onClose={() => {}} />)
    await user.type(screen.getByLabelText('Default hourly rate'), '350')
    await user.type(screen.getByLabelText('Hours'), '2')
    await user.type(screen.getByLabelText('Courts'), '2')
    expect(screen.getByText('Total: 1400.00')).toBeInTheDocument()
  })

  it('row rate overrides the default', async () => {
    const user = userEvent.setup()
    render(<CourtCostCalculator onClose={() => {}} />)
    await user.type(screen.getByLabelText('Default hourly rate'), '350')
    await user.type(screen.getByLabelText('Hours'), '1')
    await user.type(screen.getByLabelText('Courts'), '1')
    await user.type(screen.getByLabelText('Rate override'), '500')
    expect(screen.getByText('Total: 500.00')).toBeInTheDocument()
  })

  it('adds and removes rows, summing subtotals', async () => {
    const user = userEvent.setup()
    render(<CourtCostCalculator onClose={() => {}} />)
    await user.type(screen.getByLabelText('Default hourly rate'), '100')
    await user.type(screen.getByLabelText('Hours'), '1')
    await user.type(screen.getByLabelText('Courts'), '1')
    await user.click(screen.getByRole('button', { name: '+ Add row' }))
    await user.type(screen.getAllByLabelText('Hours')[1], '2')
    await user.type(screen.getAllByLabelText('Courts')[1], '1')
    expect(screen.getByText('Total: 300.00')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Remove row' })[1])
    expect(screen.getByText('Total: 100.00')).toBeInTheDocument()
  })

  it('persists inputs to localStorage', async () => {
    const user = userEvent.setup()
    render(<CourtCostCalculator onClose={() => {}} />)
    await user.type(screen.getByLabelText('Default hourly rate'), '350')
    expect(loadCalculator().defaultRate).toBe('350')
  })

  it('opens from the session list header', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SessionsProvider>
          <SessionListScreen />
        </SessionsProvider>
      </MemoryRouter>
    )
    await user.click(screen.getByRole('button', { name: 'Court cost calculator' }))
    expect(screen.getByText('Court Cost Calculator')).toBeInTheDocument()
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/CourtCostCalculator.test.tsx`
Expected: FAIL — module not found.

- [x] **Step 3: Create `src/components/CourtCostCalculator.tsx`**

```tsx
import { useState } from 'react'
import type { CalculatorRow, CalculatorState } from '../types'
import { loadCalculator, saveCalculator } from '../utils/storage'
import { Modal } from './Modal'

function newRow(): CalculatorRow {
  return { id: crypto.randomUUID(), hours: '', courts: '', rate: '' }
}

export function CourtCostCalculator({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<CalculatorState>(() => {
    const loaded = loadCalculator()
    return loaded.rows.length > 0 ? loaded : { ...loaded, rows: [newRow()] }
  })

  const update = (next: CalculatorState) => {
    setState(next)
    saveCalculator(next)
  }

  const setRow = (id: string, patch: Partial<CalculatorRow>) =>
    update({ ...state, rows: state.rows.map(r => (r.id === id ? { ...r, ...patch } : r)) })

  const subtotal = (row: CalculatorRow): number => {
    const hours = Number(row.hours) || 0
    const courts = Number(row.courts) || 0
    const rate = row.rate.trim() !== '' ? Number(row.rate) || 0 : Number(state.defaultRate) || 0
    return hours * courts * rate
  }

  const total = state.rows.reduce((sum, row) => sum + subtotal(row), 0)

  const inputClasses = 'mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-base bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50'

  return (
    <Modal title="Court Cost Calculator" onClose={onClose}>
      <label className="block">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Default hourly rate</span>
        <input
          type="number"
          aria-label="Default hourly rate"
          value={state.defaultRate}
          onChange={e => update({ ...state, defaultRate: e.target.value })}
          placeholder="e.g. 350"
          className={inputClasses}
        />
      </label>

      {state.rows.map(row => (
        <div key={row.id} className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 space-y-2">
          <div className="flex gap-2">
            <label className="block flex-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Hours</span>
              <input type="number" aria-label="Hours" value={row.hours}
                onChange={e => setRow(row.id, { hours: e.target.value })} className={inputClasses} />
            </label>
            <label className="block flex-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Courts</span>
              <input type="number" aria-label="Courts" value={row.courts}
                onChange={e => setRow(row.id, { courts: e.target.value })} className={inputClasses} />
            </label>
            <label className="block flex-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Rate override</span>
              <input type="number" aria-label="Rate override" value={row.rate}
                onChange={e => setRow(row.id, { rate: e.target.value })} className={inputClasses} />
            </label>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">Subtotal: {subtotal(row).toFixed(2)}</p>
            <button
              onClick={() => update({ ...state, rows: state.rows.filter(r => r.id !== row.id) })}
              aria-label="Remove row"
              className="text-red-500 dark:text-red-400 text-sm px-2 min-h-[36px]"
            >
              Remove row
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={() => update({ ...state, rows: [...state.rows, newRow()] })}
        className="w-full rounded-lg border border-green-600 dark:border-green-700 text-green-600 dark:text-green-400 py-2.5 text-sm font-medium min-h-[44px]"
      >
        + Add row
      </button>

      <p className="text-base font-semibold text-gray-900 dark:text-gray-50 text-right">
        Total: {total.toFixed(2)}
      </p>
    </Modal>
  )
}
```

- [x] **Step 4: Wire the header button in `src/screens/SessionListScreen.tsx`**

Add imports and state:

```tsx
import { CourtCostCalculator } from '../components/CourtCostCalculator'
```

In `SessionListScreen`, next to `const [showCreate, setShowCreate] = useState(false)`:

```tsx
  const [showCalculator, setShowCalculator] = useState(false)
```

Replace the header block

```tsx
        <h1 className="text-lg font-bold">Pickle</h1>
        <ThemeToggle />
```

with

```tsx
        <h1 className="text-lg font-bold">Pickle</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowCalculator(true)}
            aria-label="Court cost calculator"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-lg"
          >
            🧮
          </button>
          <ThemeToggle />
        </div>
```

And before the closing tag of the screen (next to the `showCreate` modal):

```tsx
      {showCalculator && <CourtCostCalculator onClose={() => setShowCalculator(false)} />}
```

- [x] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/CourtCostCalculator.test.tsx`
Expected: PASS (5 tests).

- [x] **Step 6: Commit**

```bash
git add src/components/CourtCostCalculator.tsx src/components/__tests__/CourtCostCalculator.test.tsx src/screens/SessionListScreen.tsx
git commit -m "feat: standalone court cost calculator in list header"
```

---

### Task 12: Full-suite green, build, cleanup

**Files:**
- Modify: any remaining test files referencing the old model (`src/screens/__tests__/screens.test.tsx`, `src/context/__tests__/SessionsContext.test.tsx`, `src/components/__tests__/ExpensesModal.test.tsx` if needed)

- [x] **Step 1: Sweep for stale references** *(only hit: the intentional old-shape fixture in storage.test.ts)*

Run: `grep -rn "matchupState\|roundHistory\|sittingOut\|deferredPlayerIds\|MatchupState" src --include="*.ts" --include="*.tsx"`
Expected: no hits. Fix any stragglers by switching fixtures to the new shape (build sessions with `createNewSession` + `checkInPlayer` + `assignToCourt` + `recordWin`, as in Task 8's `sessionWithGames()`), and assertions to the new UI copy.

- [x] **Step 2: Run the full suite** *(16 files, 103 tests, all pass — no straggler fixes needed)*

Run: `npx vitest run`
Expected: ALL PASS. Any failing file gets its fixtures/assertions updated to the new model — the components themselves are already correct from Tasks 6–11; do not change component behavior to satisfy an old test.

- [x] **Step 3: Typecheck and build**

Run: `npm run build`
Expected: `tsc -b` clean (no unused exports from the old model remain), Vite build succeeds.

- [x] **Step 4: Lint** *(fixed one unused test import: `addRosterPlayer` in sessionOps.test.ts)*

Run: `npm run lint`
Expected: clean.

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "test: align remaining suites with games-first model"
```

- [x] **Step 6 (recommended): Real-browser verification** *(Playwright + system Chrome, 390×844: 16/16 checks — create → check-in 5 → assign → win → Matches/Players → expenses split 400.00 each → calculator 1400.00 → reload persistence; smooth scroll 284→0; screenshots reviewed)*

Use the project's `verify` skill (build/launch/drive recipe) to click through: create session → check in 5 players → assign a suggestion → record a win → check Matches + Players tabs → open the calculator. Confirm the smooth scroll and expense split still work on mobile viewport.

---

## Plan Self-Review (done at write time)

- **Spec coverage:** data model (T1), storage wipe + calculator persistence (T1), engine incl. windows/caps/determinism (T2), stats + streak (T3), ops incl. win/cancel/dissolution/corrections (T4), context (T5), courts UI + win buttons + cancel (T6), suggestions + waiting list + scroll (T7), Matches tab (T8), Players stats (T9), relabel (T10), calculator UI + header button (T11), full-suite/build (T12). Expenses math intentionally untouched (spec: unchanged).
- **Type consistency:** `Candidate`, op signatures, and context API cross-checked across Tasks 2/4/5/6/7.
- **Known intermediate state:** tasks 1–5 leave old UI files failing typecheck/tests until their rewrite tasks — scoped test commands per task, full green gate at Task 12.
