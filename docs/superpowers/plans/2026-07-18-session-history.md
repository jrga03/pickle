# Session History Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-session Pickle app into a session-history app: sessions list home screen, modal-based create/edit, three-tab session details (Players | Matchups | Matches), flat expense split in a modal, active/ended lifecycle.

**Architecture:** Pure session-transform functions (`sessionOps.ts`) applied through a new `SessionsContext` (owns `Session[]` + localStorage persistence); the existing `SessionContext` becomes a thin per-session binding so `MatchupsTab` keeps its `useSession()` API. React Router v7 (declarative mode) provides `/` and `/session/:id`. Legacy single-session localStorage data is migrated on first load.

**Tech Stack:** React 19, TypeScript strict, Tailwind v4, react-router v7, vitest + Testing Library, vite-plugin-pwa.

**Spec:** `docs/superpowers/specs/2026-07-18-session-history-design.md`

## Global Constraints

- Work directly on `main` — user preference: no worktrees, no feature branches.
- Commit messages: conventional prefix (`feat:`/`refactor:`/`test:`), NO `Co-Authored-By` line ever (user rule).
- There is NO pre-commit hook; the pre-push hook runs `tsc -b`. **`tsc -b` is expected to FAIL from Task 2 until Task 15 completes — do not push until Task 15's gates are green.** Per-task gate is `npx vitest run` (must pass at the end of every task).
- vitest does not typecheck; that is why per-task test runs stay green while `tsc -b` is mid-refactor red.
- Match existing UI idiom exactly: Tailwind classes with `dark:` variants, primary `green-600`/`dark:green-700`, cards `bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700`, min tap targets `min-h-[44px]`.
- All IDs via `crypto.randomUUID()`; dates as `YYYY-MM-DD` strings; timestamps as ISO strings.
- Money displayed with `.toFixed(2)`, no currency symbol (existing behavior).
- `courtAmount <= 0` or `NaN` is stored as `null`. `numCourts` minimum 1.
- Roster names deduped case-insensitively within a session.

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/types.ts` | Rewrite | New `Session`/`SessionPlayer`/`SessionStatus`, `winner` on `Game`; delete `TimeSlot`, `PlayerStatus` |
| `src/utils/sessionOps.ts` | Create | Pure session transforms: create, check-in/out, roster ops, field updates, winner marking, sorting |
| `src/utils/storage.ts` | Rewrite | `saveSessions`/`loadSessions` on `pickleball-sessions` key + legacy migration; venues/players keys unchanged |
| `src/utils/expenses.ts` | Rewrite | `calculateFlatSplit`, `formatExpenseText` (flat split) |
| `src/utils/matchups.ts` | Extend | `snapshotToHistory` winner stamping, `computeWinLoss` |
| `src/context/SessionsContext.tsx` | Create | Owns `Session[]`, persistence, CRUD + lifecycle ops |
| `src/context/SessionContext.tsx` | Rewrite | Thin per-session binding over `SessionsContext`; keeps `useSession()` API for tabs |
| `src/components/Modal.tsx` | Create | Reusable bottom-sheet modal shell |
| `src/components/TabBar.tsx` | Rewrite | Parameterized tab list (generic) |
| `src/components/SessionModal.tsx` | Create | Create/edit session form: date, venue, courts, amount, play system, roster |
| `src/components/PlayersTab.tsx` | Rewrite | Roster rows with Check in / Check out toggles |
| `src/components/MatchesTab.tsx` | Create | W/L tally + round history with tap-to-mark winners |
| `src/components/ExpensesModal.tsx` | Create | Amount input + flat split + share/copy |
| `src/components/MatchupsTab.tsx` | Modify | checkedIn pool, `numCourts`, winner stamp on snapshot, drop history section, read-only guard |
| `src/screens/SessionListScreen.tsx` | Create | Home: New Session, active + ended groups, delete ended |
| `src/screens/SessionDetailScreen.tsx` | Create | Header actions (Edit/Expenses/End/Reopen), tab switching |
| `src/App.tsx` | Rewrite | Router + providers |
| `src/components/SetupTab.tsx` | Delete | Superseded by SessionModal |
| `src/components/ExpensesTab.tsx` | Delete | Superseded by ExpensesModal |

Tests live in the existing `__tests__` directories mirroring these paths.

---

### Task 1: Install react-router

**Files:**
- Modify: `package.json` (dependency added by npm)

**Interfaces:**
- Produces: `react-router` v7 importable as `import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate, MemoryRouter } from 'react-router'` (used by Tasks 14–15 and screen tests).

- [ ] **Step 1: Install**

Run: `npm install react-router`
Expected: exit 0, `react-router` under `dependencies` in `package.json` at `^7.x`.

- [ ] **Step 2: Verify baseline still green**

Run: `npx vitest run`
Expected: all existing tests PASS.

Run: `npx tsc -b`
Expected: PASS (last green typecheck until Task 15).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-router"
```

---

### Task 2: Rewrite types.ts

**Files:**
- Rewrite: `src/types.ts`

**Interfaces:**
- Produces (all later tasks consume these exact types):

```ts
export type SessionStatus = 'active' | 'ended'
export type PlaySystem = 'paddle-queue' | 'challenge-court' | 'round-robin'
export interface SessionPlayer { id: string; name: string; checkedIn: boolean; participated: boolean }
export interface Game { court: number; team1: [string, string]; team2: [string, string]; winner?: 1 | 2 }
export interface Round { id: string; games: Game[]; sittingOut: string[] }
export interface MatchupState { games: Game[]; sittingOut: string[] }
export interface Session {
  id: string; createdAt: string; status: SessionStatus
  date: string; venue: string; numCourts: number; courtAmount: number | null
  playSystem: PlaySystem; players: SessionPlayer[]
  matchupState: MatchupState | null; roundHistory: Round[]; deferredPlayerIds: string[]
}
export interface SavedVenue { id: string; name: string }
export interface SavedPlayer { id: string; name: string }
```

- [ ] **Step 1: Replace the whole file**

Write `src/types.ts` with exactly the block above (nothing else — `TimeSlot`, `PlayerStatus`, `Player`, `SavedVenue.defaultRate` are gone).

- [ ] **Step 2: Verify tests still green (runtime-only)**

Run: `npx vitest run`
Expected: PASS — vitest doesn't typecheck, and no runtime code reads the deleted types yet. (`npx tsc -b` now fails in consumers; expected until Task 15.)

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "refactor: new session-history data model in types"
```

---

### Task 3: sessionOps — pure session transforms (TDD)

**Files:**
- Create: `src/utils/sessionOps.ts`
- Test: `src/utils/__tests__/sessionOps.test.ts`

**Interfaces:**
- Consumes: types from Task 2; `addPlayerToMatchups`, `removePlayerFromMatchups` from `src/utils/matchups.ts` (existing, unchanged signatures `(state: MatchupState, playerId: string) => MatchupState`).
- Produces:

```ts
export interface NewSessionInput {
  date: string; venue: string; numCourts: number
  courtAmount: number | null; playSystem: PlaySystem; playerNames: string[]
}
export function createNewSession(input: NewSessionInput): Session
export function checkInPlayer(session: Session, playerId: string): Session
export function checkOutPlayer(session: Session, playerId: string): Session
export function addRosterPlayer(session: Session, name: string): Session
export function removeRosterPlayer(session: Session, playerId: string): Session
export function updateSessionFields(session: Session, fields: Partial<Pick<Session, 'date' | 'venue' | 'numCourts' | 'courtAmount' | 'playSystem'>>): Session
export function setGameWinner(session: Session, roundId: string, court: number, winner: 1 | 2 | undefined): Session
export function compareSessionsDesc(a: Session, b: Session): number
```

- [ ] **Step 1: Write the failing tests**

Create `src/utils/__tests__/sessionOps.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  createNewSession, checkInPlayer, checkOutPlayer, addRosterPlayer,
  removeRosterPlayer, updateSessionFields, setGameWinner, compareSessionsDesc,
} from '../sessionOps'
import type { Session } from '../../types'

const base = (): Session => createNewSession({
  date: '2026-07-18', venue: 'BGC Courts', numCourts: 2,
  courtAmount: 2000, playSystem: 'paddle-queue', playerNames: ['Alice', 'Ben'],
})

describe('createNewSession', () => {
  it('creates an active session with unchecked roster', () => {
    const s = base()
    expect(s.id).toBeTruthy()
    expect(s.createdAt).toBeTruthy()
    expect(s.status).toBe('active')
    expect(s.players).toHaveLength(2)
    expect(s.players[0]).toMatchObject({ name: 'Alice', checkedIn: false, participated: false })
    expect(s.matchupState).toBeNull()
    expect(s.roundHistory).toEqual([])
    expect(s.deferredPlayerIds).toEqual([])
  })

  it('clamps numCourts to min 1 and non-positive amount to null', () => {
    const s = createNewSession({ date: '2026-07-18', venue: '', numCourts: 0, courtAmount: 0, playSystem: 'round-robin', playerNames: [] })
    expect(s.numCourts).toBe(1)
    expect(s.courtAmount).toBeNull()
  })

  it('dedupes roster names case-insensitively', () => {
    const s = createNewSession({ date: '2026-07-18', venue: '', numCourts: 1, courtAmount: null, playSystem: 'paddle-queue', playerNames: ['Alice', 'alice', ' Ben '] })
    expect(s.players.map(p => p.name)).toEqual(['Alice', 'Ben'])
  })
})

describe('check-in / check-out', () => {
  it('check-in sets checkedIn and sticky participated, joins matchup pool', () => {
    let s = base()
    s = { ...s, matchupState: { games: [], sittingOut: [] } }
    s = checkInPlayer(s, s.players[0].id)
    expect(s.players[0].checkedIn).toBe(true)
    expect(s.players[0].participated).toBe(true)
    expect(s.matchupState!.sittingOut).toContain(s.players[0].id)
  })

  it('check-out clears checkedIn, keeps participated, leaves pool and deferred', () => {
    let s = base()
    s = { ...s, matchupState: { games: [], sittingOut: [] } }
    const id = s.players[0].id
    s = checkInPlayer(s, id)
    s = { ...s, deferredPlayerIds: [id] }
    s = checkOutPlayer(s, id)
    expect(s.players[0].checkedIn).toBe(false)
    expect(s.players[0].participated).toBe(true)
    expect(s.matchupState!.sittingOut).not.toContain(id)
    expect(s.deferredPlayerIds).not.toContain(id)
  })

  it('check-in with no matchupState leaves it null', () => {
    let s = base()
    s = checkInPlayer(s, s.players[0].id)
    expect(s.matchupState).toBeNull()
  })
})

describe('roster ops', () => {
  it('addRosterPlayer appends unchecked; ignores case-insensitive duplicates and blanks', () => {
    let s = base()
    s = addRosterPlayer(s, 'Carol')
    expect(s.players.map(p => p.name)).toEqual(['Alice', 'Ben', 'Carol'])
    expect(s.players[2]).toMatchObject({ checkedIn: false, participated: false })
    expect(addRosterPlayer(s, 'carol').players).toHaveLength(3)
    expect(addRosterPlayer(s, '  ').players).toHaveLength(3)
  })

  it('removeRosterPlayer removes from roster, matchups, and deferred', () => {
    let s = base()
    const id = s.players[0].id
    s = { ...s, matchupState: { games: [], sittingOut: [id] }, deferredPlayerIds: [id] }
    s = removeRosterPlayer(s, id)
    expect(s.players.map(p => p.name)).toEqual(['Ben'])
    expect(s.matchupState!.sittingOut).toEqual([])
    expect(s.deferredPlayerIds).toEqual([])
  })
})

describe('updateSessionFields', () => {
  it('applies fields with clamping', () => {
    let s = base()
    s = updateSessionFields(s, { venue: 'New Venue', numCourts: 0, courtAmount: -5 })
    expect(s.venue).toBe('New Venue')
    expect(s.numCourts).toBe(1)
    expect(s.courtAmount).toBeNull()
  })
})

describe('setGameWinner', () => {
  it('sets, flips, and unsets winner on a history game', () => {
    let s = base()
    const round = { id: 'r1', games: [{ court: 1, team1: ['a', 'b'] as [string, string], team2: ['c', 'd'] as [string, string] }], sittingOut: [] }
    s = { ...s, roundHistory: [round] }
    s = setGameWinner(s, 'r1', 1, 1)
    expect(s.roundHistory[0].games[0].winner).toBe(1)
    s = setGameWinner(s, 'r1', 1, 2)
    expect(s.roundHistory[0].games[0].winner).toBe(2)
    s = setGameWinner(s, 'r1', 1, undefined)
    expect(s.roundHistory[0].games[0].winner).toBeUndefined()
  })
})

describe('compareSessionsDesc', () => {
  it('sorts by date desc then createdAt desc', () => {
    const a = { ...base(), date: '2026-07-18', createdAt: '2026-07-18T10:00:00Z' }
    const b = { ...base(), date: '2026-07-17', createdAt: '2026-07-17T10:00:00Z' }
    const c = { ...base(), date: '2026-07-18', createdAt: '2026-07-18T12:00:00Z' }
    expect([a, b, c].sort(compareSessionsDesc).map(s => s.createdAt))
      .toEqual(['2026-07-18T12:00:00Z', '2026-07-18T10:00:00Z', '2026-07-17T10:00:00Z'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/__tests__/sessionOps.test.ts`
Expected: FAIL — cannot resolve `../sessionOps`.

- [ ] **Step 3: Implement `src/utils/sessionOps.ts`**

```ts
import type { Session, PlaySystem } from '../types'
import { addPlayerToMatchups, removePlayerFromMatchups } from './matchups'

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
    matchupState: null,
    roundHistory: [],
    deferredPlayerIds: [],
  }
}

export function checkInPlayer(session: Session, playerId: string): Session {
  return {
    ...session,
    players: session.players.map(p =>
      p.id === playerId ? { ...p, checkedIn: true, participated: true } : p),
    matchupState: session.matchupState
      ? addPlayerToMatchups(session.matchupState, playerId)
      : null,
  }
}

export function checkOutPlayer(session: Session, playerId: string): Session {
  return {
    ...session,
    players: session.players.map(p =>
      p.id === playerId ? { ...p, checkedIn: false } : p),
    matchupState: session.matchupState
      ? removePlayerFromMatchups(session.matchupState, playerId)
      : null,
    deferredPlayerIds: session.deferredPlayerIds.filter(id => id !== playerId),
  }
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
  return {
    ...session,
    players: session.players.filter(p => p.id !== playerId),
    matchupState: session.matchupState
      ? removePlayerFromMatchups(session.matchupState, playerId)
      : null,
    deferredPlayerIds: session.deferredPlayerIds.filter(id => id !== playerId),
  }
}

export function updateSessionFields(
  session: Session,
  fields: Partial<Pick<Session, 'date' | 'venue' | 'numCourts' | 'courtAmount' | 'playSystem'>>,
): Session {
  const next = { ...session, ...fields }
  if (fields.numCourts !== undefined) next.numCourts = clampCourts(fields.numCourts)
  if (fields.courtAmount !== undefined) next.courtAmount = normalizeAmount(fields.courtAmount)
  if (fields.venue !== undefined) next.venue = fields.venue.trim()
  return next
}

export function setGameWinner(
  session: Session,
  roundId: string,
  court: number,
  winner: 1 | 2 | undefined,
): Session {
  return {
    ...session,
    roundHistory: session.roundHistory.map(round =>
      round.id !== roundId ? round : {
        ...round,
        games: round.games.map(game =>
          game.court !== court ? game : { ...game, winner }),
      }),
  }
}

export function compareSessionsDesc(a: Session, b: Session): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
  return 0
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/__tests__/sessionOps.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Full suite + commit**

Run: `npx vitest run`
Expected: PASS.

```bash
git add src/utils/sessionOps.ts src/utils/__tests__/sessionOps.test.ts
git commit -m "feat: pure session transform utilities"
```

---

### Task 4: Storage rewrite + legacy migration (TDD)

**Files:**
- Rewrite: `src/utils/storage.ts`
- Rewrite (full replacement): `src/utils/__tests__/storage.test.ts`

**Interfaces:**
- Consumes: `Session`, `SavedVenue`, `SavedPlayer`, `MatchupState`, `Game`, `Round` from `../types`; `createNewSession` from `./sessionOps` (tests only).
- Produces:

```ts
export function saveSessions(sessions: Session[]): void
export function loadSessions(): Session[]   // performs legacy migration internally
export function saveVenues(venues: SavedVenue[]): void   // unchanged
export function loadVenues(): SavedVenue[]               // unchanged
export function savePlayers(players: SavedPlayer[]): void // unchanged
export function loadPlayers(): SavedPlayer[]              // unchanged
```

- [ ] **Step 1: Replace `src/utils/__tests__/storage.test.ts` with failing tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { saveSessions, loadSessions, saveVenues, loadVenues, savePlayers, loadPlayers } from '../storage'
import { createNewSession } from '../sessionOps'

const SESSIONS_KEY = 'pickleball-sessions'
const LEGACY_KEY = 'pickleball-session'

const sample = () => createNewSession({
  date: '2026-07-18', venue: 'BGC Courts', numCourts: 2,
  courtAmount: 2000, playSystem: 'paddle-queue', playerNames: ['Alice'],
})

describe('sessions storage', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips sessions', () => {
    const s = sample()
    saveSessions([s])
    expect(loadSessions()).toEqual([s])
  })

  it('returns [] when nothing stored', () => {
    expect(loadSessions()).toEqual([])
  })

  it('returns [] on corrupt sessions data', () => {
    localStorage.setItem(SESSIONS_KEY, '{nope')
    expect(loadSessions()).toEqual([])
  })
})

describe('legacy migration', () => {
  beforeEach(() => localStorage.clear())

  const legacy = {
    date: '2026-03-24',
    venue: 'Court A',
    defaultRate: 500,
    timeSlots: [
      { id: 't1', startTime: '14:00', endTime: '16:00', numCourts: 2 },
      { id: 't2', startTime: '16:00', endTime: '17:00', numCourts: 3, rateOverride: 600 },
    ],
    players: [
      { id: 'p1', name: 'Alice', arrivalTime: '14:00', departureTime: '17:00', status: 'active' },
      { id: 'p2', name: 'Ben', arrivalTime: '14:00', departureTime: '16:00', status: 'left' },
    ],
    matchupState: { games: [], sittingOut: ['p1', 'ghost'] },
    roundHistory: [],
    playSystem: 'challenge-court',
    deferredPlayerIds: ['p1', 'ghost'],
  }

  it('migrates the legacy session into the array and removes the legacy key', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy))
    const sessions = loadSessions()
    expect(sessions).toHaveLength(1)
    const s = sessions[0]
    expect(s.id).toBeTruthy()
    expect(s.status).toBe('ended') // past date
    expect(s.numCourts).toBe(3)    // max across slots
    // 2h × 2 courts × 500 + 1h × 3 courts × 600 = 2000 + 1800
    expect(s.courtAmount).toBe(3800)
    expect(s.playSystem).toBe('challenge-court')
    expect(s.players).toEqual([
      expect.objectContaining({ id: 'p1', name: 'Alice', checkedIn: true, participated: true }),
      expect.objectContaining({ id: 'p2', name: 'Ben', checkedIn: false, participated: true }),
    ])
    expect(s.matchupState!.sittingOut).toEqual(['p1']) // ghost dropped
    expect(s.deferredPlayerIds).toEqual(['p1'])
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
    expect(localStorage.getItem(SESSIONS_KEY)).not.toBeNull()
  })

  it('marks a legacy session dated today as active', () => {
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ ...legacy, date: today }))
    expect(loadSessions()[0].status).toBe('active')
  })

  it('converts the oldest rounds[] format to matchupState + roundHistory', () => {
    const { matchupState: _m, roundHistory: _r, ...rest } = legacy
    const withRounds = {
      ...rest,
      rounds: [
        { id: 'r1', games: [], sittingOut: ['p1'] },
        { id: 'r2', games: [], sittingOut: ['p2'] },
      ],
    }
    localStorage.setItem(LEGACY_KEY, JSON.stringify(withRounds))
    const s = loadSessions()[0]
    expect(s.roundHistory).toHaveLength(1)
    expect(s.roundHistory[0].id).toBe('r1')
    expect(s.matchupState).toEqual({ games: [], sittingOut: ['p2'] })
  })

  it('returns [] for corrupt legacy data', () => {
    localStorage.setItem(LEGACY_KEY, '{nope')
    expect(loadSessions()).toEqual([])
  })
})

describe('venues and players storage', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips venues', () => {
    const venues = [{ id: 'v1', name: 'BGC Courts' }]
    saveVenues(venues)
    expect(loadVenues()).toEqual(venues)
  })

  it('round-trips players', () => {
    const players = [{ id: 'sp1', name: 'Alice' }]
    savePlayers(players)
    expect(loadPlayers()).toEqual(players)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/utils/__tests__/storage.test.ts`
Expected: FAIL — `saveSessions`/`loadSessions` not exported.

- [ ] **Step 3: Rewrite `src/utils/storage.ts`**

```ts
import type { Session, SavedVenue, SavedPlayer, MatchupState, Game, Round } from '../types'

const SESSIONS_KEY = 'pickleball-sessions'
const LEGACY_SESSION_KEY = 'pickleball-session'
const VENUES_KEY = 'pickleball-venues'
const PLAYERS_KEY = 'pickleball-players'

export function saveSessions(sessions: Session[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

export function loadSessions(): Session[] {
  const data = localStorage.getItem(SESSIONS_KEY)
  if (data) {
    try {
      return JSON.parse(data) as Session[]
    } catch {
      return []
    }
  }
  const migrated = migrateLegacySession()
  if (migrated) {
    saveSessions([migrated])
    localStorage.removeItem(LEGACY_SESSION_KEY)
    return [migrated]
  }
  return []
}

interface LegacyPlayer {
  id: string
  name: string
  arrivalTime?: string
  departureTime?: string
  status: string
}

interface LegacyTimeSlot {
  id: string
  startTime: string
  endTime: string
  numCourts: number
  rateOverride?: number
}

interface LegacyRound {
  id: string
  games: Game[]
  sittingOut: string[]
}

interface LegacySession {
  date: string
  venue: string
  defaultRate: number
  timeSlots: LegacyTimeSlot[]
  players: LegacyPlayer[]
  rounds?: LegacyRound[]
  matchupState?: MatchupState | null
  roundHistory?: LegacyRound[]
  playSystem: string
  deferredPlayerIds?: string[]
}

function parseHour(time: string): number {
  return parseInt(time.split(':')[0], 10)
}

function migrateLegacySession(): Session | null {
  const data = localStorage.getItem(LEGACY_SESSION_KEY)
  if (!data) return null
  try {
    const raw = JSON.parse(data) as LegacySession
    const slots = raw.timeSlots ?? []
    const players = raw.players ?? []

    // Oldest format: rounds[] → matchupState + roundHistory
    let matchupState = raw.matchupState ?? null
    let roundHistory: Round[] = raw.roundHistory ?? []
    if (raw.rounds !== undefined && raw.matchupState === undefined) {
      if (raw.rounds.length > 0) {
        const last = raw.rounds[raw.rounds.length - 1]
        matchupState = { games: last.games, sittingOut: last.sittingOut }
        roundHistory = raw.rounds.slice(0, -1)
      }
    }

    // Drop stale player IDs from matchup state (same rules as the old loader)
    const idSet = new Set(players.map(p => p.id))
    if (matchupState) {
      const displaced: string[] = []
      const cleanGames: Game[] = []
      for (const game of matchupState.games) {
        const ids = [...game.team1, ...game.team2]
        if (ids.some(id => !idSet.has(id))) {
          displaced.push(...ids.filter(id => idSet.has(id)))
        } else {
          cleanGames.push(game)
        }
      }
      const sittingOut = [...displaced, ...matchupState.sittingOut.filter(id => idSet.has(id))]
      matchupState = cleanGames.length === 0 && sittingOut.length === 0
        ? null
        : { games: cleanGames, sittingOut }
    }

    const totalCost = slots.reduce((sum, s) => {
      const len = parseHour(s.endTime) - parseHour(s.startTime)
      if (!Number.isFinite(len) || len <= 0) return sum
      return sum + len * s.numCourts * (s.rateOverride ?? raw.defaultRate)
    }, 0)

    const today = new Date().toISOString().split('T')[0]
    const validSystems: Session['playSystem'][] = ['paddle-queue', 'challenge-court', 'round-robin']

    return {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: raw.date === today ? 'active' : 'ended',
      date: raw.date,
      venue: raw.venue ?? '',
      numCourts: slots.length > 0 ? Math.max(1, ...slots.map(s => s.numCourts)) : 1,
      courtAmount: totalCost > 0 ? totalCost : null,
      playSystem: validSystems.includes(raw.playSystem as Session['playSystem'])
        ? raw.playSystem as Session['playSystem']
        : 'paddle-queue',
      players: players.map(p => ({
        id: p.id,
        name: p.name,
        checkedIn: p.status === 'active',
        participated: true,
      })),
      matchupState,
      roundHistory,
      deferredPlayerIds: (raw.deferredPlayerIds ?? []).filter(id => idSet.has(id)),
    }
  } catch {
    return null
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
```

Note: `saveSession`/`loadSession`/`clearSession` are deleted, and `SessionContext.tsx` still imports them until Task 8 — so the old `SessionContext.test.tsx` WILL fail here with an import error. As part of this task, replace the entire content of `src/context/__tests__/SessionContext.test.tsx` with this placeholder (Task 8 rewrites it fully):

```tsx
import { describe, it } from 'vitest'

describe('SessionContext', () => {
  it.todo('rebound to SessionsContext in Task 8')
})
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/utils/__tests__/storage.test.ts`
Expected: PASS.

Run: `npx vitest run`
Expected: PASS (apply the placeholder note above if `SessionContext.test.tsx` breaks on the removed exports).

- [ ] **Step 5: Commit**

```bash
git add src/utils/storage.ts src/utils/__tests__/storage.test.ts src/context/__tests__/SessionContext.test.tsx
git commit -m "refactor: sessions array storage with legacy migration"
```

---

### Task 5: Flat-split expenses (TDD)

**Files:**
- Rewrite: `src/utils/expenses.ts`
- Rewrite (full replacement): `src/utils/__tests__/expenses.test.ts`

**Interfaces:**
- Consumes: `Session` from `../types`; `createNewSession`, `checkInPlayer` from `./sessionOps` (tests only).
- Produces:

```ts
export interface FlatSplit {
  total: number | null
  participants: { id: string; name: string }[]  // sorted by name
  perHead: number | null
}
export function calculateFlatSplit(session: Session): FlatSplit
export function formatExpenseText(session: Session): string
```

`parseHour`, `SlotExpense`, `PlayerExpense`, `calculateExpenses` are deleted.

- [ ] **Step 1: Replace `src/utils/__tests__/expenses.test.ts` with failing tests**

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/utils/__tests__/expenses.test.ts`
Expected: FAIL — `calculateFlatSplit` not exported.

- [ ] **Step 3: Rewrite `src/utils/expenses.ts`**

```ts
import type { Session } from '../types'

export interface FlatSplit {
  total: number | null
  participants: { id: string; name: string }[]
  perHead: number | null
}

export function calculateFlatSplit(session: Session): FlatSplit {
  const participants = session.players
    .filter(p => p.participated)
    .map(p => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const total = session.courtAmount
  const perHead = total !== null && participants.length > 0
    ? total / participants.length
    : null
  return { total, participants, perHead }
}

export function formatExpenseText(session: Session): string {
  const { total, participants, perHead } = calculateFlatSplit(session)
  const lines: string[] = [session.date]
  if (session.venue) lines.push(session.venue)
  lines.push('')
  if (total !== null && perHead !== null) {
    lines.push(`Total: ${total.toFixed(2)}`)
    lines.push(`÷ ${participants.length} player${participants.length !== 1 ? 's' : ''} = ${perHead.toFixed(2)} each`)
    lines.push('')
  }
  for (const p of participants) {
    lines.push(p.name)
  }
  return lines.join('\n')
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/utils/__tests__/expenses.test.ts`
Expected: PASS.

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/expenses.ts src/utils/__tests__/expenses.test.ts
git commit -m "refactor: flat-split expense calculation"
```

---

### Task 6: Winner stamping + W/L tally in matchups (TDD)

**Files:**
- Modify: `src/utils/matchups.ts` (change `snapshotToHistory` at the end of the file; append `computeWinLoss`)
- Modify: `src/utils/__tests__/matchups.test.ts` (append new describes)

**Interfaces:**
- Consumes: `MatchupState`, `Round`, `Game` from `../types` (already imported in the file).
- Produces:

```ts
export function snapshotToHistory(state: MatchupState, winnerIds?: ReadonlySet<string>): Round
export function computeWinLoss(rounds: Round[]): { playerId: string; wins: number; losses: number }[]
```

All other exports in `matchups.ts` are unchanged.

- [ ] **Step 1: Append failing tests to `src/utils/__tests__/matchups.test.ts`**

Add at the end of the file (inside no existing describe — top level), importing `snapshotToHistory` and `computeWinLoss` in the existing import from `'../matchups'`:

```ts
describe('snapshotToHistory winner stamping', () => {
  const state = {
    games: [
      { court: 1, team1: ['a', 'b'] as [string, string], team2: ['c', 'd'] as [string, string] },
      { court: 2, team1: ['e', 'f'] as [string, string], team2: ['g', 'h'] as [string, string] },
    ],
    sittingOut: ['i'],
  }

  it('stamps winner 1 or 2 when a full team is in winnerIds', () => {
    const round = snapshotToHistory(state, new Set(['a', 'b', 'g', 'h']))
    expect(round.games[0].winner).toBe(1)
    expect(round.games[1].winner).toBe(2)
  })

  it('leaves winner unset without winnerIds or with partial teams', () => {
    expect(snapshotToHistory(state).games[0].winner).toBeUndefined()
    expect(snapshotToHistory(state, new Set(['a'])).games[0].winner).toBeUndefined()
  })
})

describe('computeWinLoss', () => {
  it('tallies wins and losses from games with winners only', () => {
    const rounds = [
      { id: 'r1', games: [
        { court: 1, team1: ['a', 'b'] as [string, string], team2: ['c', 'd'] as [string, string], winner: 1 as const },
        { court: 2, team1: ['e', 'f'] as [string, string], team2: ['g', 'h'] as [string, string] },
      ], sittingOut: [] },
      { id: 'r2', games: [
        { court: 1, team1: ['a', 'c'] as [string, string], team2: ['b', 'd'] as [string, string], winner: 2 as const },
      ], sittingOut: [] },
    ]
    const tally = computeWinLoss(rounds)
    const get = (id: string) => tally.find(t => t.playerId === id)
    expect(get('a')).toEqual({ playerId: 'a', wins: 1, losses: 1 })
    expect(get('b')).toEqual({ playerId: 'b', wins: 2, losses: 0 })
    expect(get('c')).toEqual({ playerId: 'c', wins: 0, losses: 2 })
    expect(get('e')).toBeUndefined() // no recorded result
    expect(tally[0].playerId).toBe('b') // sorted by wins desc
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/utils/__tests__/matchups.test.ts`
Expected: FAIL — `computeWinLoss` not exported / winner undefined.

- [ ] **Step 3: Implement in `src/utils/matchups.ts`**

Replace the existing `snapshotToHistory` (bottom of file) with:

```ts
export function snapshotToHistory(state: MatchupState, winnerIds?: ReadonlySet<string>): Round {
  return {
    id: crypto.randomUUID(),
    games: state.games.map(game => {
      if (!winnerIds) return game
      if (game.team1.every(id => winnerIds.has(id))) return { ...game, winner: 1 as const }
      if (game.team2.every(id => winnerIds.has(id))) return { ...game, winner: 2 as const }
      return game
    }),
    sittingOut: state.sittingOut,
  }
}

export function computeWinLoss(rounds: Round[]): { playerId: string; wins: number; losses: number }[] {
  const stats = new Map<string, { wins: number; losses: number }>()
  const bump = (id: string, key: 'wins' | 'losses') => {
    const s = stats.get(id) ?? { wins: 0, losses: 0 }
    s[key]++
    stats.set(id, s)
  }
  for (const round of rounds) {
    for (const game of round.games) {
      if (!game.winner) continue
      const winners = game.winner === 1 ? game.team1 : game.team2
      const losers = game.winner === 1 ? game.team2 : game.team1
      winners.forEach(id => bump(id, 'wins'))
      losers.forEach(id => bump(id, 'losses'))
    }
  }
  return [...stats.entries()]
    .map(([playerId, s]) => ({ playerId, ...s }))
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/utils/__tests__/matchups.test.ts`
Expected: PASS.

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/matchups.ts src/utils/__tests__/matchups.test.ts
git commit -m "feat: winner stamping and win/loss tally"
```

---

### Task 7: SessionsContext (TDD)

**Files:**
- Create: `src/context/SessionsContext.tsx`
- Test: `src/context/__tests__/SessionsContext.test.tsx`

**Interfaces:**
- Consumes: `saveSessions`, `loadSessions` (Task 4); `createNewSession`, `NewSessionInput` (Task 3).
- Produces:

```ts
export function SessionsProvider({ children }: { children: ReactNode }): JSX.Element
export function useSessions(): {
  sessions: Session[]
  createSession: (input: NewSessionInput) => Session
  updateSession: (id: string, updater: (s: Session) => Session) => void
  deleteSession: (id: string) => void
  endSession: (id: string) => void
  reopenSession: (id: string) => void
}
```

- [ ] **Step 1: Write failing test `src/context/__tests__/SessionsContext.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionsProvider, useSessions } from '../SessionsContext'

function TestConsumer() {
  const { sessions, createSession, endSession, reopenSession, deleteSession } = useSessions()
  const first = sessions[0]
  return (
    <div>
      <span data-testid="count">{sessions.length}</span>
      <span data-testid="first-status">{first?.status ?? 'none'}</span>
      <button onClick={() => createSession({
        date: '2026-07-18', venue: 'BGC', numCourts: 2,
        courtAmount: 2000, playSystem: 'paddle-queue', playerNames: ['Alice'],
      })}>Create</button>
      <button onClick={() => first && endSession(first.id)}>End</button>
      <button onClick={() => first && reopenSession(first.id)}>Reopen</button>
      <button onClick={() => first && deleteSession(first.id)}>Delete</button>
    </div>
  )
}

const setup = () => render(<SessionsProvider><TestConsumer /></SessionsProvider>)

describe('SessionsContext', () => {
  beforeEach(() => localStorage.clear())

  it('starts empty and creates sessions (newest first)', async () => {
    const user = userEvent.setup()
    setup()
    expect(screen.getByTestId('count')).toHaveTextContent('0')
    await user.click(screen.getByText('Create'))
    expect(screen.getByTestId('count')).toHaveTextContent('1')
    expect(screen.getByTestId('first-status')).toHaveTextContent('active')
  })

  it('ends, reopens, and deletes a session', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('Create'))
    await user.click(screen.getByText('End'))
    expect(screen.getByTestId('first-status')).toHaveTextContent('ended')
    await user.click(screen.getByText('Reopen'))
    expect(screen.getByTestId('first-status')).toHaveTextContent('active')
    await user.click(screen.getByText('Delete'))
    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('persists to localStorage', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('Create'))
    const stored = JSON.parse(localStorage.getItem('pickleball-sessions')!)
    expect(stored).toHaveLength(1)
    expect(stored[0].venue).toBe('BGC')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/context/__tests__/SessionsContext.test.tsx`
Expected: FAIL — cannot resolve `../SessionsContext`.

- [ ] **Step 3: Implement `src/context/SessionsContext.tsx`**

```tsx
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { Session } from '../types'
import { saveSessions, loadSessions } from '../utils/storage'
import { createNewSession, type NewSessionInput } from '../utils/sessionOps'

interface SessionsContextType {
  sessions: Session[]
  createSession: (input: NewSessionInput) => Session
  updateSession: (id: string, updater: (s: Session) => Session) => void
  deleteSession: (id: string) => void
  endSession: (id: string) => void
  reopenSession: (id: string) => void
}

const SessionsContext = createContext<SessionsContextType | null>(null)

export function SessionsProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>(() => loadSessions())

  useEffect(() => {
    saveSessions(sessions)
  }, [sessions])

  const createSession = useCallback((input: NewSessionInput) => {
    const session = createNewSession(input)
    setSessions(prev => [session, ...prev])
    return session
  }, [])

  const updateSession = useCallback((id: string, updater: (s: Session) => Session) =>
    setSessions(prev => prev.map(s => s.id === id ? updater(s) : s)), [])

  const deleteSession = useCallback((id: string) =>
    setSessions(prev => prev.filter(s => s.id !== id)), [])

  const endSession = useCallback((id: string) =>
    setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'ended' as const } : s)), [])

  const reopenSession = useCallback((id: string) =>
    setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'active' as const } : s)), [])

  return (
    <SessionsContext.Provider value={{
      sessions, createSession, updateSession, deleteSession, endSession, reopenSession,
    }}>
      {children}
    </SessionsContext.Provider>
  )
}

export function useSessions() {
  const ctx = useContext(SessionsContext)
  if (!ctx) throw new Error('useSessions must be used within SessionsProvider')
  return ctx
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/context/__tests__/SessionsContext.test.tsx`
Expected: PASS. Then `npx vitest run` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/context/SessionsContext.tsx src/context/__tests__/SessionsContext.test.tsx
git commit -m "feat: sessions list context with persistence"
```

---

### Task 8: Rebind SessionContext to a session id (TDD)

**Files:**
- Rewrite: `src/context/SessionContext.tsx`
- Rewrite (full replacement): `src/context/__tests__/SessionContext.test.tsx`

**Interfaces:**
- Consumes: `useSessions` (Task 7); `checkInPlayer`, `checkOutPlayer`, `setGameWinner` ops (Task 3).
- Produces (tabs in Tasks 11–14 consume exactly this):

```ts
export function SessionProvider({ sessionId, children }: { sessionId: string; children: ReactNode }): ReactNode
export function useSession(): {
  session: Session
  readOnly: boolean            // session.status === 'ended'
  checkIn: (playerId: string) => void
  checkOut: (playerId: string) => void
  setPlaySystem: (system: PlaySystem) => void
  setMatchupState: (state: MatchupState | null) => void
  setRoundHistory: (history: Round[]) => void
  setDeferredPlayerIds: (ids: string[]) => void
  setGameWinner: (roundId: string, court: number, winner: 1 | 2 | undefined) => void
}
```

The old per-field setters (`setDate`, `setVenue`, `addTimeSlot`, `addPlayer`, `updatePlayerStatus`, `updatePlayerSchedule`, `resetSession`, …) are deleted — SessionModal edits fields via `useSessions().updateSession` + `updateSessionFields`/roster ops directly.

- [ ] **Step 1: Replace `src/context/__tests__/SessionContext.test.tsx` with failing tests**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionsProvider } from '../SessionsContext'
import { SessionProvider, useSession } from '../SessionContext'
import { createNewSession } from '../../utils/sessionOps'
import { saveSessions } from '../../utils/storage'

function seedSession() {
  const session = createNewSession({
    date: '2026-07-18', venue: 'BGC', numCourts: 2,
    courtAmount: null, playSystem: 'paddle-queue', playerNames: ['Alice', 'Ben'],
  })
  saveSessions([session])
  return session
}

function TestConsumer() {
  const { session, readOnly, checkIn, checkOut } = useSession()
  const alice = session.players[0]
  return (
    <div>
      <span data-testid="checked-in">{session.players.filter(p => p.checkedIn).length}</span>
      <span data-testid="participated">{session.players.filter(p => p.participated).length}</span>
      <span data-testid="read-only">{String(readOnly)}</span>
      <button onClick={() => checkIn(alice.id)}>Check In</button>
      <button onClick={() => checkOut(alice.id)}>Check Out</button>
    </div>
  )
}

describe('SessionContext', () => {
  beforeEach(() => localStorage.clear())

  it('binds to the given session and toggles check-in with sticky participation', async () => {
    const session = seedSession()
    const user = userEvent.setup()
    render(
      <SessionsProvider>
        <SessionProvider sessionId={session.id}>
          <TestConsumer />
        </SessionProvider>
      </SessionsProvider>
    )
    expect(screen.getByTestId('read-only')).toHaveTextContent('false')
    expect(screen.getByTestId('checked-in')).toHaveTextContent('0')
    await user.click(screen.getByText('Check In'))
    expect(screen.getByTestId('checked-in')).toHaveTextContent('1')
    expect(screen.getByTestId('participated')).toHaveTextContent('1')
    await user.click(screen.getByText('Check Out'))
    expect(screen.getByTestId('checked-in')).toHaveTextContent('0')
    expect(screen.getByTestId('participated')).toHaveTextContent('1')
  })

  it('reports readOnly for an ended session', () => {
    const session = seedSession()
    saveSessions([{ ...session, status: 'ended' }])
    render(
      <SessionsProvider>
        <SessionProvider sessionId={session.id}>
          <TestConsumer />
        </SessionProvider>
      </SessionsProvider>
    )
    expect(screen.getByTestId('read-only')).toHaveTextContent('true')
  })

  it('renders nothing for an unknown session id', () => {
    render(
      <SessionsProvider>
        <SessionProvider sessionId="nope">
          <TestConsumer />
        </SessionProvider>
      </SessionsProvider>
    )
    expect(screen.queryByTestId('checked-in')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/context/__tests__/SessionContext.test.tsx`
Expected: FAIL — `SessionProvider` has no `sessionId` prop / missing exports.

- [ ] **Step 3: Rewrite `src/context/SessionContext.tsx`**

```tsx
import { createContext, useContext, useCallback, type ReactNode } from 'react'
import type { Session, PlaySystem, MatchupState, Round } from '../types'
import { useSessions } from './SessionsContext'
import {
  checkInPlayer, checkOutPlayer, setGameWinner as setGameWinnerOp,
} from '../utils/sessionOps'

interface SessionContextType {
  session: Session
  readOnly: boolean
  checkIn: (playerId: string) => void
  checkOut: (playerId: string) => void
  setPlaySystem: (system: PlaySystem) => void
  setMatchupState: (state: MatchupState | null) => void
  setRoundHistory: (history: Round[]) => void
  setDeferredPlayerIds: (ids: string[]) => void
  setGameWinner: (roundId: string, court: number, winner: 1 | 2 | undefined) => void
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
    updateSession(sessionId, s => ({ ...s, playSystem })), [sessionId, updateSession])

  const setMatchupState = useCallback((matchupState: MatchupState | null) =>
    updateSession(sessionId, s => ({ ...s, matchupState })), [sessionId, updateSession])

  const setRoundHistory = useCallback((roundHistory: Round[]) =>
    updateSession(sessionId, s => ({ ...s, roundHistory })), [sessionId, updateSession])

  const setDeferredPlayerIds = useCallback((deferredPlayerIds: string[]) =>
    updateSession(sessionId, s => ({ ...s, deferredPlayerIds })), [sessionId, updateSession])

  const setGameWinner = useCallback((roundId: string, court: number, winner: 1 | 2 | undefined) =>
    updateSession(sessionId, s => setGameWinnerOp(s, roundId, court, winner)), [sessionId, updateSession])

  if (!session) return null

  return (
    <SessionContext.Provider value={{
      session,
      readOnly: session.status === 'ended',
      checkIn, checkOut, setPlaySystem, setMatchupState,
      setRoundHistory, setDeferredPlayerIds, setGameWinner,
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

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/context/__tests__/SessionContext.test.tsx`
Expected: PASS. Then `npx vitest run` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/context/SessionContext.tsx src/context/__tests__/SessionContext.test.tsx
git commit -m "refactor: bind SessionContext to a session id"
```

---

### Task 9: Modal shell + parameterized TabBar (TDD)

**Files:**
- Create: `src/components/Modal.tsx`
- Rewrite: `src/components/TabBar.tsx`
- Test: `src/components/__tests__/Modal.test.tsx`

**Interfaces:**
- Produces:

```ts
// Modal.tsx
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }): JSX.Element
// TabBar.tsx — generic; the old `export type Tab` union is deleted
export function TabBar<T extends string>({ tabs, activeTab, onTabChange }: { tabs: readonly T[]; activeTab: T; onTabChange: (tab: T) => void }): JSX.Element
```

- [ ] **Step 1: Write failing test `src/components/__tests__/Modal.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Modal } from '../Modal'

describe('Modal', () => {
  it('renders title and children', () => {
    render(<Modal title="Test Modal" onClose={() => {}}><p>Body here</p></Modal>)
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('Body here')).toBeInTheDocument()
  })

  it('calls onClose from the dismiss button and the backdrop', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Modal title="Test Modal" onClose={onClose}><p>Body</p></Modal>)
    await user.click(screen.getByLabelText('Dismiss'))
    await user.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/__tests__/Modal.test.tsx`
Expected: FAIL — cannot resolve `../Modal`.

- [ ] **Step 3: Create `src/components/Modal.tsx`**

```tsx
import type { ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
      <div
        className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl max-h-[90dvh] overflow-y-auto p-4 space-y-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rewrite `src/components/TabBar.tsx`**

```tsx
interface TabBarProps<T extends string> {
  tabs: readonly T[]
  activeTab: T
  onTabChange: (tab: T) => void
}

export function TabBar<T extends string>({ tabs, activeTab, onTabChange }: TabBarProps<T>) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`flex-1 py-3 text-sm font-medium min-h-[48px] ${
            activeTab === tab
              ? 'text-green-600 dark:text-green-400 border-t-2 border-green-600 dark:border-green-700'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {tab}
        </button>
      ))}
    </nav>
  )
}
```

- [ ] **Step 5: Run tests + commit**

Run: `npx vitest run`
Expected: PASS.

```bash
git add src/components/Modal.tsx src/components/TabBar.tsx src/components/__tests__/Modal.test.tsx
git commit -m "feat: modal shell and parameterized tab bar"
```

---

### Task 10: SessionModal — create/edit form (TDD)

**Files:**
- Create: `src/components/SessionModal.tsx`
- Test: `src/components/__tests__/SessionModal.test.tsx`

**Interfaces:**
- Consumes: `useSessions` (Task 7); `addRosterPlayer`, `removeRosterPlayer`, `updateSessionFields` (Task 3); `Modal` (Task 9); `Autocomplete` (existing: props `suggestions/onSelect/onSubmit/onDelete/placeholder/value/onChange`); venues/players storage fns (Task 4).
- Produces:

```ts
export function SessionModal(props: {
  sessionId?: string          // absent = create mode
  onClose: () => void
  onCreated?: (session: Session) => void
}): JSX.Element
```

- [ ] **Step 1: Write failing test `src/components/__tests__/SessionModal.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionsProvider, useSessions } from '../../context/SessionsContext'
import { SessionModal } from '../SessionModal'
import { createNewSession } from '../../utils/sessionOps'
import { saveSessions } from '../../utils/storage'

function Probe() {
  const { sessions } = useSessions()
  return (
    <div>
      <span data-testid="count">{sessions.length}</span>
      <span data-testid="names">{sessions[0]?.players.map(p => p.name).join(',') ?? ''}</span>
      <span data-testid="courts">{sessions[0]?.numCourts ?? ''}</span>
    </div>
  )
}

describe('SessionModal', () => {
  beforeEach(() => localStorage.clear())

  it('creates a session with roster and fields', async () => {
    const user = userEvent.setup()
    render(
      <SessionsProvider>
        <SessionModal onClose={() => {}} />
        <Probe />
      </SessionsProvider>
    )
    await user.type(screen.getByPlaceholderText('Player name'), 'Alice')
    await user.click(screen.getByText('Add'))
    await user.type(screen.getByPlaceholderText('Player name'), 'Ben')
    await user.click(screen.getByText('Add'))
    await user.click(screen.getByText('Create Session'))
    expect(screen.getByTestId('count')).toHaveTextContent('1')
    expect(screen.getByTestId('names')).toHaveTextContent('Alice,Ben')
  })

  it('edits fields and removes a rostered player', async () => {
    const session = createNewSession({
      date: '2026-07-18', venue: 'BGC', numCourts: 1,
      courtAmount: null, playSystem: 'paddle-queue', playerNames: ['Alice', 'Ben'],
    })
    saveSessions([session])
    const user = userEvent.setup()
    render(
      <SessionsProvider>
        <SessionModal sessionId={session.id} onClose={() => {}} />
        <Probe />
      </SessionsProvider>
    )
    const courts = screen.getByLabelText('Courts')
    await user.clear(courts)
    await user.type(courts, '3')
    await user.click(screen.getByLabelText('Remove Ben'))
    await user.click(screen.getByText('Save Changes'))
    expect(screen.getByTestId('courts')).toHaveTextContent('3')
    expect(screen.getByTestId('names')).toHaveTextContent('Alice')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/__tests__/SessionModal.test.tsx`
Expected: FAIL — cannot resolve `../SessionModal`.

- [ ] **Step 3: Create `src/components/SessionModal.tsx`**

```tsx
import { useState } from 'react'
import type { PlaySystem, SavedPlayer, SavedVenue, Session } from '../types'
import { useSessions } from '../context/SessionsContext'
import { addRosterPlayer, removeRosterPlayer, updateSessionFields } from '../utils/sessionOps'
import { loadVenues, saveVenues, loadPlayers, savePlayers } from '../utils/storage'
import { Autocomplete } from './Autocomplete'
import { Modal } from './Modal'

const systemLabels: Record<PlaySystem, string> = {
  'paddle-queue': 'Paddle Queue',
  'challenge-court': 'Challenge Court',
  'round-robin': 'Round Robin',
}

interface RosterDraftEntry {
  id: string | null // null = not yet in the session (added on save)
  name: string
}

interface SessionModalProps {
  sessionId?: string
  onClose: () => void
  onCreated?: (session: Session) => void
}

export function SessionModal({ sessionId, onClose, onCreated }: SessionModalProps) {
  const { sessions, createSession, updateSession } = useSessions()
  const existing = sessionId ? sessions.find(s => s.id === sessionId) : undefined

  const [date, setDate] = useState(existing?.date ?? new Date().toISOString().split('T')[0])
  const [venue, setVenue] = useState(existing?.venue ?? '')
  const [courts, setCourts] = useState(String(existing?.numCourts ?? 1))
  const [amount, setAmount] = useState(existing?.courtAmount != null ? String(existing.courtAmount) : '')
  const [playSystem, setPlaySystem] = useState<PlaySystem>(existing?.playSystem ?? 'paddle-queue')
  const [roster, setRoster] = useState<RosterDraftEntry[]>(
    existing?.players.map(p => ({ id: p.id, name: p.name })) ?? [],
  )
  const [playerInput, setPlayerInput] = useState('')
  const [savedVenues, setSavedVenues] = useState<SavedVenue[]>(() => loadVenues())
  const [savedPlayers, setSavedPlayers] = useState<SavedPlayer[]>(() => loadPlayers())

  const addToRoster = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (roster.some(r => r.name.toLowerCase() === trimmed.toLowerCase())) return
    setRoster(prev => [...prev, { id: null, name: trimmed }])
    if (!savedPlayers.some(sp => sp.name.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...savedPlayers, { id: crypto.randomUUID(), name: trimmed }]
      setSavedPlayers(updated)
      savePlayers(updated)
    }
    setPlayerInput('')
  }

  const handleSaveVenue = () => {
    const trimmed = venue.trim()
    if (!trimmed) return
    if (savedVenues.some(v => v.name.toLowerCase() === trimmed.toLowerCase())) return
    const updated = [...savedVenues, { id: crypto.randomUUID(), name: trimmed }]
    setSavedVenues(updated)
    saveVenues(updated)
  }

  const handleDeleteVenue = (id: string) => {
    const updated = savedVenues.filter(v => v.id !== id)
    setSavedVenues(updated)
    saveVenues(updated)
  }

  const handleDeleteSavedPlayer = (id: string) => {
    const updated = savedPlayers.filter(sp => sp.id !== id)
    setSavedPlayers(updated)
    savePlayers(updated)
  }

  const handleSave = () => {
    const fields = {
      date,
      venue,
      numCourts: Number(courts) || 1,
      courtAmount: amount.trim() ? Number(amount) : null,
      playSystem,
    }
    if (!existing) {
      const created = createSession({ ...fields, playerNames: roster.map(r => r.name) })
      onCreated?.(created)
    } else {
      updateSession(existing.id, s => {
        let next = updateSessionFields(s, fields)
        const keptIds = new Set(roster.filter(r => r.id !== null).map(r => r.id!))
        for (const p of s.players) {
          if (!keptIds.has(p.id)) next = removeRosterPlayer(next, p.id)
        }
        for (const r of roster) {
          if (r.id === null) next = addRosterPlayer(next, r.name)
        }
        return next
      })
    }
    onClose()
  }

  return (
    <Modal title={existing ? 'Edit Session' : 'New Session'} onClose={onClose}>
      <label className="block">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Date</span>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="mt-1 block w-full min-w-0 max-w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-base bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50"
        />
      </label>

      <div className="block">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Venue (optional)</span>
        <div className="mt-1 flex gap-2">
          <Autocomplete
            suggestions={savedVenues.map(v => ({ id: v.id, label: v.name }))}
            onSelect={item => setVenue(item.label)}
            onSubmit={val => setVenue(val)}
            onDelete={handleDeleteVenue}
            placeholder="e.g. BGC Courts"
            value={venue}
            onChange={setVenue}
          />
          <button
            onClick={handleSaveVenue}
            disabled={!venue.trim()}
            className="rounded-lg border border-green-600 dark:border-green-700 text-green-600 dark:text-green-400 px-3 py-2.5 text-sm font-medium disabled:opacity-50 min-h-[44px]"
          >
            Save
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <label className="block flex-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Courts</span>
          <input
            type="number"
            min={1}
            aria-label="Courts"
            value={courts}
            onChange={e => setCourts(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-base bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50"
          />
        </label>
        <label className="block flex-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Court Amount (optional)</span>
          <input
            type="number"
            aria-label="Court Amount"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="e.g. 2000"
            className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-base bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50"
          />
        </label>
      </div>

      <div className="block">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Play System</span>
        <div className="mt-1 flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {(Object.entries(systemLabels) as [PlaySystem, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPlaySystem(key)}
              className={`flex-1 rounded-md py-2 text-xs font-medium min-h-[40px] ${
                playSystem === key
                  ? 'bg-white dark:bg-gray-900 text-green-700 dark:text-green-300 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="block space-y-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Players</span>
        <div className="flex gap-2">
          <Autocomplete
            suggestions={savedPlayers
              .filter(sp => !roster.some(r => r.name.toLowerCase() === sp.name.toLowerCase()))
              .map(sp => ({ id: sp.id, label: sp.name }))}
            onSelect={item => addToRoster(item.label)}
            onSubmit={addToRoster}
            onDelete={handleDeleteSavedPlayer}
            placeholder="Player name"
            value={playerInput}
            onChange={setPlayerInput}
          />
          <button
            onClick={() => addToRoster(playerInput)}
            disabled={!playerInput.trim()}
            className="rounded-lg bg-green-600 dark:bg-green-700 text-white px-4 py-2.5 text-sm font-medium disabled:opacity-50 min-h-[44px]"
          >
            Add
          </button>
        </div>
        <ul className="space-y-1">
          {roster.map(entry => (
            <li
              key={entry.id ?? entry.name}
              className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2"
            >
              <span className="text-sm text-gray-900 dark:text-gray-50">{entry.name}</span>
              <button
                onClick={() => setRoster(prev => prev.filter(r => r !== entry))}
                className="text-red-500 dark:text-red-400 p-1 min-h-[36px] min-w-[36px]"
                aria-label={`Remove ${entry.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={handleSave}
        disabled={!date}
        className="w-full rounded-lg bg-green-600 dark:bg-green-700 text-white py-3 text-sm font-medium disabled:opacity-50 min-h-[48px]"
      >
        {existing ? 'Save Changes' : 'Create Session'}
      </button>
    </Modal>
  )
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/__tests__/SessionModal.test.tsx`
Expected: PASS. Then `npx vitest run` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SessionModal.tsx src/components/__tests__/SessionModal.test.tsx
git commit -m "feat: session create/edit modal"
```

---

### Task 11: PlayersTab — check-in/check-out (TDD)

**Files:**
- Rewrite: `src/components/PlayersTab.tsx`
- Test: `src/components/__tests__/PlayersTab.test.tsx` (new)

**Interfaces:**
- Consumes: `useSession()` (Task 8): `session`, `readOnly`, `checkIn`, `checkOut`.

- [ ] **Step 1: Write failing test `src/components/__tests__/PlayersTab.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionsProvider } from '../../context/SessionsContext'
import { SessionProvider } from '../../context/SessionContext'
import { PlayersTab } from '../PlayersTab'
import { createNewSession } from '../../utils/sessionOps'
import { saveSessions } from '../../utils/storage'
import type { Session } from '../../types'

function renderTab(session: Session) {
  saveSessions([session])
  return render(
    <SessionsProvider>
      <SessionProvider sessionId={session.id}>
        <PlayersTab />
      </SessionProvider>
    </SessionsProvider>
  )
}

const sample = () => createNewSession({
  date: '2026-07-18', venue: '', numCourts: 1,
  courtAmount: null, playSystem: 'paddle-queue', playerNames: ['Alice', 'Ben'],
})

describe('PlayersTab', () => {
  beforeEach(() => localStorage.clear())

  it('checks a player in and out', async () => {
    const user = userEvent.setup()
    renderTab(sample())
    expect(screen.getByText('0 of 2 checked in')).toBeInTheDocument()
    await user.click(screen.getAllByText('Check in')[0])
    expect(screen.getByText('1 of 2 checked in')).toBeInTheDocument()
    await user.click(screen.getByText('Check out'))
    expect(screen.getByText('0 of 2 checked in')).toBeInTheDocument()
  })

  it('hides toggles when the session is ended', () => {
    renderTab({ ...sample(), status: 'ended' })
    expect(screen.queryByText('Check in')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/__tests__/PlayersTab.test.tsx`
Expected: FAIL — current PlayersTab calls removed context APIs (`addPlayer` etc.) and crashes.

- [ ] **Step 3: Rewrite `src/components/PlayersTab.tsx`**

```tsx
import { useSession } from '../context/SessionContext'

export function PlayersTab() {
  const { session, readOnly, checkIn, checkOut } = useSession()
  const checkedInCount = session.players.filter(p => p.checkedIn).length

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {checkedInCount} of {session.players.length} checked in
      </p>

      {session.players.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
          No players in the roster yet. Tap Edit to add players.
        </p>
      )}

      <ul className="space-y-2">
        {session.players.map(player => (
          <li
            key={player.id}
            className="flex items-center justify-between gap-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3"
          >
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-gray-50 truncate">{player.name}</p>
              {player.participated && !player.checkedIn && (
                <p className="text-xs text-gray-400 dark:text-gray-500">played earlier</p>
              )}
            </div>
            {!readOnly && (
              <button
                onClick={() => (player.checkedIn ? checkOut(player.id) : checkIn(player.id))}
                className={`rounded-lg px-3 py-2 text-sm font-medium min-h-[44px] ${
                  player.checkedIn
                    ? 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                    : 'bg-green-600 dark:bg-green-700 text-white'
                }`}
              >
                {player.checkedIn ? 'Check out' : 'Check in'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/__tests__/PlayersTab.test.tsx`
Expected: PASS. Then `npx vitest run` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PlayersTab.tsx src/components/__tests__/PlayersTab.test.tsx
git commit -m "refactor: players tab as check-in/check-out roster"
```

---

### Task 12: MatchesTab — history + winner marking (TDD)

**Files:**
- Create: `src/components/MatchesTab.tsx`
- Test: `src/components/__tests__/MatchesTab.test.tsx`

**Interfaces:**
- Consumes: `useSession()` (Task 8): `session`, `readOnly`, `setGameWinner`; `computeWinLoss` (Task 6).

- [ ] **Step 1: Write failing test `src/components/__tests__/MatchesTab.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionsProvider } from '../../context/SessionsContext'
import { SessionProvider } from '../../context/SessionContext'
import { MatchesTab } from '../MatchesTab'
import { createNewSession } from '../../utils/sessionOps'
import { saveSessions } from '../../utils/storage'
import type { Session } from '../../types'

function sessionWithRound(): Session {
  const s = createNewSession({
    date: '2026-07-18', venue: '', numCourts: 1,
    courtAmount: null, playSystem: 'paddle-queue',
    playerNames: ['Alice', 'Ben', 'Cara', 'Dan'],
  })
  const [a, b, c, d] = s.players.map(p => p.id)
  return {
    ...s,
    roundHistory: [{
      id: 'r1',
      games: [{ court: 1, team1: [a, b] as [string, string], team2: [c, d] as [string, string] }],
      sittingOut: [],
    }],
  }
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

  it('shows an empty state without rounds', () => {
    const s = createNewSession({
      date: '2026-07-18', venue: '', numCourts: 1,
      courtAmount: null, playSystem: 'paddle-queue', playerNames: [],
    })
    renderTab(s)
    expect(screen.getByText(/No completed rounds yet/)).toBeInTheDocument()
  })

  it('marks a winner on tap, shows tally, unsets on second tap', async () => {
    const user = userEvent.setup()
    renderTab(sessionWithRound())
    const team1 = screen.getByRole('button', { name: /Alice & Ben/ })
    await user.click(team1)
    expect(screen.getByText('Alice 1W–0L')).toBeInTheDocument()
    expect(screen.getByText('Cara 0W–1L')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Alice & Ben/ }))
    expect(screen.queryByText('Alice 1W–0L')).toBeNull()
  })

  it('disables winner buttons when ended', () => {
    renderTab({ ...sessionWithRound(), status: 'ended' })
    expect(screen.getByRole('button', { name: /Alice & Ben/ })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/__tests__/MatchesTab.test.tsx`
Expected: FAIL — cannot resolve `../MatchesTab`.

- [ ] **Step 3: Create `src/components/MatchesTab.tsx`**

```tsx
import { useSession } from '../context/SessionContext'
import { computeWinLoss } from '../utils/matchups'

export function MatchesTab() {
  const { session, readOnly, setGameWinner } = useSession()
  const nameMap = new Map(session.players.map(p => [p.id, p.name]))
  const getName = (id: string) => nameMap.get(id) ?? id

  if (session.roundHistory.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
        No completed rounds yet. Rounds appear here as you play.
      </p>
    )
  }

  const tally = computeWinLoss(session.roundHistory)
  const rounds = session.roundHistory
    .map((round, idx) => ({ round, number: idx + 1 }))
    .reverse()

  const teamClasses = (isWinner: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-medium min-h-[44px] disabled:opacity-70 ${
      isWinner
        ? 'bg-green-600 dark:bg-green-700 text-white'
        : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600'
    }`

  return (
    <div className="space-y-4">
      {tally.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tally.map(t => (
            <span
              key={t.playerId}
              className="text-xs bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1 text-gray-600 dark:text-gray-300"
            >
              {getName(t.playerId)} {t.wins}W–{t.losses}L
            </span>
          ))}
        </div>
      )}

      {rounds.map(({ round, number }) => (
        <div
          key={round.id}
          className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3"
        >
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
            Round {number}
          </p>
          {round.games.map(game => (
            <div key={game.court} className="space-y-1">
              <p className="text-xs text-gray-400 dark:text-gray-500">Court {game.court}</p>
              <div className="flex items-center gap-2">
                <button
                  disabled={readOnly}
                  onClick={() => setGameWinner(round.id, game.court, game.winner === 1 ? undefined : 1)}
                  className={teamClasses(game.winner === 1)}
                >
                  {game.team1.map(getName).join(' & ')}{game.winner === 1 ? ' ✓' : ''}
                </button>
                <span className="text-xs text-gray-400 dark:text-gray-500">vs</span>
                <button
                  disabled={readOnly}
                  onClick={() => setGameWinner(round.id, game.court, game.winner === 2 ? undefined : 2)}
                  className={teamClasses(game.winner === 2)}
                >
                  {game.team2.map(getName).join(' & ')}{game.winner === 2 ? ' ✓' : ''}
                </button>
              </div>
            </div>
          ))}
          {round.sittingOut.length > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Sat out: {round.sittingOut.map(getName).join(', ')}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/__tests__/MatchesTab.test.tsx`
Expected: PASS. Then `npx vitest run` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/MatchesTab.tsx src/components/__tests__/MatchesTab.test.tsx
git commit -m "feat: matches tab with winner marking and tally"
```

---

### Task 13: ExpensesModal (TDD)

**Files:**
- Create: `src/components/ExpensesModal.tsx`
- Test: `src/components/__tests__/ExpensesModal.test.tsx`

**Interfaces:**
- Consumes: `useSessions` (Task 7), `useSession` (Task 8), `calculateFlatSplit`/`formatExpenseText` (Task 5), `updateSessionFields` (Task 3), `Modal` (Task 9).
- Produces: `export function ExpensesModal({ onClose }: { onClose: () => void }): JSX.Element`
- Amount stays editable when the session is ended (settle-up-after-ending is the normal flow).

- [ ] **Step 1: Write failing test `src/components/__tests__/ExpensesModal.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionsProvider } from '../../context/SessionsContext'
import { SessionProvider } from '../../context/SessionContext'
import { ExpensesModal } from '../ExpensesModal'
import { createNewSession, checkInPlayer } from '../../utils/sessionOps'
import { saveSessions } from '../../utils/storage'
import type { Session } from '../../types'

function sessionWithPlayers(courtAmount: number | null): Session {
  let s = createNewSession({
    date: '2026-07-18', venue: 'BGC', numCourts: 2,
    courtAmount, playSystem: 'paddle-queue',
    playerNames: ['Alice', 'Ben', 'Cara', 'Dan'],
  })
  for (const name of ['Alice', 'Ben']) {
    s = checkInPlayer(s, s.players.find(p => p.name === name)!.id)
  }
  return s
}

function renderModal(session: Session) {
  saveSessions([session])
  return render(
    <SessionsProvider>
      <SessionProvider sessionId={session.id}>
        <ExpensesModal onClose={() => {}} />
      </SessionProvider>
    </SessionsProvider>
  )
}

describe('ExpensesModal', () => {
  beforeEach(() => localStorage.clear())

  it('shows the flat split for participants', () => {
    renderModal(sessionWithPlayers(2000))
    expect(screen.getByText('1000.00 each')).toBeInTheDocument()
    expect(screen.getByText(/2 players/)).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Ben')).toBeInTheDocument()
    expect(screen.queryByText('Dan')).toBeNull() // never checked in
  })

  it('prompts for amount when missing, and computes after typing', async () => {
    const user = userEvent.setup()
    renderModal(sessionWithPlayers(null))
    expect(screen.getByText(/Enter the court amount/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Court Amount'), '3000')
    expect(screen.getByText('1500.00 each')).toBeInTheDocument()
  })

  it('shows empty state when nobody has checked in', () => {
    const s = createNewSession({
      date: '2026-07-18', venue: '', numCourts: 1,
      courtAmount: 1000, playSystem: 'paddle-queue', playerNames: ['Alice'],
    })
    renderModal(s)
    expect(screen.getByText(/No one has checked in yet/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/__tests__/ExpensesModal.test.tsx`
Expected: FAIL — cannot resolve `../ExpensesModal`.

- [ ] **Step 3: Create `src/components/ExpensesModal.tsx`**

```tsx
import { useState } from 'react'
import { useSessions } from '../context/SessionsContext'
import { useSession } from '../context/SessionContext'
import { calculateFlatSplit, formatExpenseText } from '../utils/expenses'
import { updateSessionFields } from '../utils/sessionOps'
import { Modal } from './Modal'

export function ExpensesModal({ onClose }: { onClose: () => void }) {
  const { updateSession } = useSessions()
  const { session } = useSession()
  const [copied, setCopied] = useState(false)
  const [amountInput, setAmountInput] = useState(
    session.courtAmount != null ? String(session.courtAmount) : '',
  )
  const { total, participants, perHead } = calculateFlatSplit(session)

  const handleAmountChange = (value: string) => {
    setAmountInput(value)
    updateSession(session.id, s =>
      updateSessionFields(s, { courtAmount: value.trim() ? Number(value) : null }))
  }

  const handleShare = async () => {
    const text = formatExpenseText(session)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      if (navigator.share) {
        await navigator.share({ text })
      }
    }
  }

  return (
    <Modal title="Expenses" onClose={onClose}>
      <label className="block">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Court Amount</span>
        <input
          type="number"
          aria-label="Court Amount"
          value={amountInput}
          onChange={e => handleAmountChange(e.target.value)}
          placeholder="e.g. 2000"
          autoFocus={session.courtAmount == null}
          className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-base bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50"
        />
      </label>

      {participants.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
          No one has checked in yet.
        </p>
      ) : total === null || perHead === null ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
          Enter the court amount to see the split.
        </p>
      ) : (
        <>
          <div className="bg-green-50 dark:bg-gray-800 rounded-lg border border-green-200 dark:border-gray-700 p-4 text-center">
            <p className="text-2xl font-bold text-green-800 dark:text-green-300">
              {perHead.toFixed(2)} each
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              {participants.length} player{participants.length !== 1 ? 's' : ''} · Total {total.toFixed(2)}
            </p>
          </div>
          <ul className="space-y-1">
            {participants.map(p => (
              <li
                key={p.id}
                className="flex justify-between text-sm text-gray-700 dark:text-gray-200 px-1 py-1.5"
              >
                <span>{p.name}</span>
                <span className="font-medium">{perHead.toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={handleShare}
            className="w-full rounded-lg bg-green-600 dark:bg-green-700 text-white py-3 text-sm font-medium min-h-[48px]"
          >
            {copied ? 'Copied to clipboard!' : 'Share Expenses'}
          </button>
        </>
      )}
    </Modal>
  )
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/__tests__/ExpensesModal.test.tsx`
Expected: PASS. Then `npx vitest run` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ExpensesModal.tsx src/components/__tests__/ExpensesModal.test.tsx
git commit -m "feat: flat-split expenses modal"
```

---

### Task 14: MatchupsTab — checked-in pool, winner stamp, read-only, drop history section (TDD)

**Files:**
- Modify: `src/components/MatchupsTab.tsx` (surgical edits listed below — the rest of the 508-line file stays untouched)
- Test: `src/components/__tests__/MatchupsTab.test.tsx` (new)

**Interfaces:**
- Consumes: `useSession()` (Task 8); `snapshotToHistory(state, winnerIds?)` (Task 6).

- [ ] **Step 1: Write failing test `src/components/__tests__/MatchupsTab.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionsProvider } from '../../context/SessionsContext'
import { SessionProvider } from '../../context/SessionContext'
import { MatchupsTab } from '../MatchupsTab'
import { createNewSession, checkInPlayer } from '../../utils/sessionOps'
import { saveSessions } from '../../utils/storage'
import type { Session } from '../../types'

function sessionWithFour(): Session {
  let s = createNewSession({
    date: '2026-07-18', venue: '', numCourts: 1,
    courtAmount: null, playSystem: 'paddle-queue',
    playerNames: ['Alice', 'Ben', 'Cara', 'Dan'],
  })
  const ids = s.players.map(p => p.id)
  for (const id of ids) s = checkInPlayer(s, id)
  return s
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

describe('MatchupsTab', () => {
  beforeEach(() => localStorage.clear())

  it('generates a round from checked-in players', async () => {
    const user = userEvent.setup()
    renderTab(sessionWithFour())
    await user.click(screen.getByText('Generate Matchups'))
    expect(screen.getByText('Court 1')).toBeInTheDocument()
    expect(screen.getByText('Round 1')).toBeInTheDocument()
  })

  it('needs 4 checked-in players', () => {
    const s = createNewSession({
      date: '2026-07-18', venue: '', numCourts: 1,
      courtAmount: null, playSystem: 'paddle-queue',
      playerNames: ['Alice', 'Ben', 'Cara', 'Dan'],
    }) // nobody checked in
    renderTab(s)
    expect(screen.getByText(/Need at least 4 active players/)).toBeInTheDocument()
  })

  it('hides generate controls when the session is ended', () => {
    renderTab({ ...sessionWithFour(), status: 'ended' })
    expect(screen.queryByText('Generate Matchups')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/__tests__/MatchupsTab.test.tsx`
Expected: FAIL — MatchupsTab destructures `updatePlayerStatus` (removed) and reads `session.timeSlots`/`p.status` (gone).

- [ ] **Step 3: Apply the surgical edits to `src/components/MatchupsTab.tsx`**

**Edit 3a — context destructure.** Replace:

```tsx
  const { session, setPlaySystem, setMatchupState, setRoundHistory, updatePlayerStatus, setDeferredPlayerIds } = useSession()
```

with:

```tsx
  const { session, readOnly, setPlaySystem, setMatchupState, setRoundHistory, checkIn, checkOut, setDeferredPlayerIds } = useSession()
```

**Edit 3b — delete the expanded-round state line** (history section is leaving this component):

```tsx
  const [expandedRound, setExpandedRound] = useState<string | null>(null)
```

**Edit 3c — player pool and court count.** Replace:

```tsx
  const activePlayers = session.players.filter(p => p.status === 'active')
  const currentCourts = session.timeSlots.length > 0
    ? Math.max(...session.timeSlots.map(s => s.numCourts))
    : 1
```

with:

```tsx
  const activePlayers = session.players.filter(p => p.checkedIn)
  const currentCourts = session.numCourts
```

**Edit 3d — winner stamping on snapshot** (inside `generateRound`). Replace:

```tsx
    if (session.matchupState) {
      const snapshot = snapshotToHistory(session.matchupState)
      setRoundHistory([...session.roundHistory, snapshot])
    }
```

with:

```tsx
    if (session.matchupState) {
      const snapshot = snapshotToHistory(
        session.matchupState,
        session.playSystem === 'challenge-court' ? stayingIds : undefined,
      )
      setRoundHistory([...session.roundHistory, snapshot])
    }
```

**Edit 3e — roster chips toggle check-in.** Replace:

```tsx
              <button
                key={player.id}
                onClick={() => updatePlayerStatus(player.id, player.status === 'active' ? 'left' : 'active')}
                className={`rounded-full px-3 py-1.5 text-sm font-medium min-h-[32px] ${
                  player.status === 'active'
```

with:

```tsx
              <button
                key={player.id}
                disabled={readOnly}
                onClick={() => (player.checkedIn ? checkOut(player.id) : checkIn(player.id))}
                className={`rounded-full px-3 py-1.5 text-sm font-medium min-h-[32px] ${
                  player.checkedIn
```

**Edit 3f — read-only guards.** Four replacements:

1. `      {!editMode && (` → `      {!editMode && !readOnly && (` (the Generate/Reshuffle button row)
2. `            {!editMode ? (` → `            {readOnly ? null : !editMode ? (` (the Edit / Cancel–Save header controls)
3. `              {!editMode && session.playSystem !== 'round-robin' && (` → `              {!editMode && !readOnly && session.playSystem !== 'round-robin' && (` (per-court Next/Re-roll)
4. `          {!editMode && session.playSystem === 'challenge-court' && (` → `          {!editMode && !readOnly && session.playSystem === 'challenge-court' && (` (winners selector)

And guard both defer buttons (two identical occurrences — replace both):

```tsx
                          {session.matchupState!.sittingOut.length > 0 && (
```

→

```tsx
                          {!readOnly && session.matchupState!.sittingOut.length > 0 && (
```

**Edit 3g — delete the whole "Previous Rounds" section** — the JSX block at the bottom of the component starting with:

```tsx
      {session.roundHistory.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Previous Rounds
          </h3>
```

…down to (and including) its closing:

```tsx
          ))}
        </div>
      )}
    </div>
  )
}
```

leaving the component ending as:

```tsx
    </div>
  )
}
```

(The `Round {session.roundHistory.length + 1}` heading earlier in the file stays — it numbers the current round.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/__tests__/MatchupsTab.test.tsx`
Expected: PASS. Then `npx vitest run` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/MatchupsTab.tsx src/components/__tests__/MatchupsTab.test.tsx
git commit -m "refactor: matchups tab on checked-in pool with winner stamping"
```

---

### Task 15: Screens, routing cutover, deletions, full gates (TDD)

**Files:**
- Create: `src/screens/SessionListScreen.tsx`
- Create: `src/screens/SessionDetailScreen.tsx`
- Rewrite: `src/App.tsx`
- Delete: `src/components/SetupTab.tsx`, `src/components/ExpensesTab.tsx`
- Test: `src/screens/__tests__/screens.test.tsx`

**Interfaces:**
- Consumes: everything above; `react-router` (`BrowserRouter`, `Routes`, `Route`, `Navigate`, `useNavigate`, `useParams`; `MemoryRouter` in tests).
- Produces: final app shell — routes `/` and `/session/:id`.

- [ ] **Step 1: Write failing test `src/screens/__tests__/screens.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router'
import { SessionsProvider } from '../../context/SessionsContext'
import { SessionListScreen } from '../SessionListScreen'
import { SessionDetailScreen } from '../SessionDetailScreen'
import { createNewSession } from '../../utils/sessionOps'
import { saveSessions } from '../../utils/storage'

function renderAt(path: string) {
  return render(
    <SessionsProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<SessionListScreen />} />
          <Route path="/session/:id" element={<SessionDetailScreen />} />
        </Routes>
      </MemoryRouter>
    </SessionsProvider>
  )
}

const make = (venue: string, date: string) => createNewSession({
  date, venue, numCourts: 1, courtAmount: null,
  playSystem: 'paddle-queue', playerNames: ['Alice'],
})

describe('SessionListScreen', () => {
  beforeEach(() => localStorage.clear())

  it('groups sessions by status', () => {
    const a = make('Active Venue', '2026-07-18')
    const e = { ...make('Old Venue', '2026-07-10'), status: 'ended' as const }
    saveSessions([a, e])
    renderAt('/')
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Past')).toBeInTheDocument()
    expect(screen.getByText('Active Venue')).toBeInTheDocument()
    expect(screen.getByText('Old Venue')).toBeInTheDocument()
  })

  it('deletes an ended session after confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    saveSessions([{ ...make('Old Venue', '2026-07-10'), status: 'ended' as const }])
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByLabelText('Delete session Old Venue'))
    expect(screen.queryByText('Old Venue')).toBeNull()
  })

  it('shows empty state with no sessions', () => {
    renderAt('/')
    expect(screen.getByText(/No sessions yet/)).toBeInTheDocument()
  })
})

describe('SessionDetailScreen', () => {
  beforeEach(() => localStorage.clear())

  it('renders tabs and ends/reopens the session', async () => {
    const s = make('BGC', '2026-07-18')
    saveSessions([s])
    const user = userEvent.setup()
    renderAt(`/session/${s.id}`)
    expect(screen.getByText('Players')).toBeInTheDocument()
    expect(screen.getByText('Matchups')).toBeInTheDocument()
    expect(screen.getByText('Matches')).toBeInTheDocument()
    await user.click(screen.getByText('End'))
    expect(screen.getByText('Reopen')).toBeInTheDocument()
    await user.click(screen.getByText('Reopen'))
    expect(screen.getByText('End')).toBeInTheDocument()
  })

  it('redirects unknown ids to the list', () => {
    renderAt('/session/nope')
    expect(screen.getByText('+ New Session')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/screens/__tests__/screens.test.tsx`
Expected: FAIL — screens don't exist.

- [ ] **Step 3: Create `src/screens/SessionListScreen.tsx`**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { Session } from '../types'
import { useSessions } from '../context/SessionsContext'
import { compareSessionsDesc } from '../utils/sessionOps'
import { SessionModal } from '../components/SessionModal'
import { ThemeToggle } from '../components/ThemeToggle'

function SessionCard({ session, onDelete }: { session: Session; onDelete?: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="flex items-stretch gap-2">
      <button
        onClick={() => navigate(`/session/${session.id}`)}
        className="flex-1 min-w-0 text-left bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-gray-900 dark:text-gray-50 truncate">
            {session.venue || session.date}
          </p>
          <span className={`text-xs rounded-full px-2 py-0.5 font-medium shrink-0 ${
            session.status === 'active'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
          }`}>
            {session.status}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {session.venue ? `${session.date} · ` : ''}
          {session.players.length} player{session.players.length !== 1 ? 's' : ''}
        </p>
      </button>
      {onDelete && (
        <button
          onClick={onDelete}
          aria-label={`Delete session ${session.venue || session.date}`}
          className="text-red-500 dark:text-red-400 px-3 min-h-[44px] flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
        >
          ✕
        </button>
      )}
    </div>
  )
}

export function SessionListScreen() {
  const { sessions, deleteSession } = useSessions()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)

  const active = sessions.filter(s => s.status === 'active').sort(compareSessionsDesc)
  const ended = sessions.filter(s => s.status === 'ended').sort(compareSessionsDesc)

  const handleDelete = (session: Session) => {
    if (window.confirm(`Delete session "${session.venue || session.date}"? This cannot be undone.`)) {
      deleteSession(session.id)
    }
  }

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-950 overflow-x-hidden">
      <header
        className="bg-green-600 dark:bg-green-800 text-white p-4 flex justify-between items-center"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <h1 className="text-lg font-bold">Pickle</h1>
        <ThemeToggle />
      </header>
      <main className="p-4 space-y-6">
        <button
          onClick={() => setShowCreate(true)}
          className="w-full rounded-lg bg-green-600 dark:bg-green-700 text-white py-3 text-sm font-medium min-h-[48px]"
        >
          + New Session
        </button>

        {sessions.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            No sessions yet. Create your first one.
          </p>
        )}

        {active.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Active</h2>
            {active.map(s => <SessionCard key={s.id} session={s} />)}
          </section>
        )}

        {ended.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Past</h2>
            {ended.map(s => (
              <SessionCard key={s.id} session={s} onDelete={() => handleDelete(s)} />
            ))}
          </section>
        )}
      </main>
      {showCreate && (
        <SessionModal
          onClose={() => setShowCreate(false)}
          onCreated={s => navigate(`/session/${s.id}`)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create `src/screens/SessionDetailScreen.tsx`**

```tsx
import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useSessions } from '../context/SessionsContext'
import { SessionProvider } from '../context/SessionContext'
import { TabBar } from '../components/TabBar'
import { PlayersTab } from '../components/PlayersTab'
import { MatchupsTab } from '../components/MatchupsTab'
import { MatchesTab } from '../components/MatchesTab'
import { SessionModal } from '../components/SessionModal'
import { ExpensesModal } from '../components/ExpensesModal'

const detailTabs = ['Players', 'Matchups', 'Matches'] as const
type DetailTab = (typeof detailTabs)[number]

export function SessionDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const { sessions, endSession, reopenSession } = useSessions()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<DetailTab>('Players')
  const [showEdit, setShowEdit] = useState(false)
  const [showExpenses, setShowExpenses] = useState(false)

  const session = sessions.find(s => s.id === id)
  if (!session) return <Navigate to="/" replace />

  const ended = session.status === 'ended'

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-950 pb-16 overflow-x-hidden">
      <header
        className="bg-green-600 dark:bg-green-800 text-white p-4 flex justify-between items-center gap-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <div className="flex items-center gap-1 min-w-0">
          <button
            onClick={() => navigate('/')}
            aria-label="Back to sessions"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-xl shrink-0"
          >
            ←
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">{session.venue || session.date}</h1>
            <p className="text-xs text-green-100 dark:text-green-200">
              {session.date}{ended ? ' · ended' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!ended && (
            <button
              onClick={() => setShowEdit(true)}
              aria-label="Edit session"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              ✏️
            </button>
          )}
          <button
            onClick={() => setShowExpenses(true)}
            aria-label="Expenses"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            💰
          </button>
          <button
            onClick={() => (ended ? reopenSession(session.id) : endSession(session.id))}
            className="rounded-lg border border-white/40 px-2.5 py-1.5 text-xs font-medium min-h-[44px]"
          >
            {ended ? 'Reopen' : 'End'}
          </button>
        </div>
      </header>

      <SessionProvider sessionId={session.id}>
        <main className="p-4">
          {activeTab === 'Players' && <PlayersTab />}
          {activeTab === 'Matchups' && <MatchupsTab />}
          {activeTab === 'Matches' && <MatchesTab />}
        </main>
        {showExpenses && <ExpensesModal onClose={() => setShowExpenses(false)} />}
      </SessionProvider>

      {showEdit && !ended && (
        <SessionModal sessionId={session.id} onClose={() => setShowEdit(false)} />
      )}

      <TabBar tabs={detailTabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
```

Note: `ThemeToggle` now lives only on the list screen header — the detail header is already full.

- [ ] **Step 5: Rewrite `src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { SessionsProvider } from './context/SessionsContext'
import { SessionListScreen } from './screens/SessionListScreen'
import { SessionDetailScreen } from './screens/SessionDetailScreen'
import { ReloadPrompt } from './components/ReloadPrompt'

function App() {
  return (
    <SessionsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SessionListScreen />} />
          <Route path="/session/:id" element={<SessionDetailScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ReloadPrompt />
      </BrowserRouter>
    </SessionsProvider>
  )
}

export default App
```

`src/main.tsx` stays unchanged.

- [ ] **Step 6: Delete superseded components and verify no dangling imports**

```bash
rm src/components/SetupTab.tsx src/components/ExpensesTab.tsx
grep -rnw "SetupTab\|ExpensesTab\|formatHour\|calculateExpenses\|loadSession\|saveSession\|clearSession" src/
```

Expected: grep exits 1 (no matches — `-w` keeps `loadSessions`/`saveSessions` from matching; `parseHour` is intentionally NOT in this list, a private copy lives inside `storage.ts` for migration math). If anything matches, fix that import before proceeding.

- [ ] **Step 7: Run ALL gates**

Run: `npx vitest run`
Expected: ALL PASS.

Run: `npx tsc -b`
Expected: PASS — first clean typecheck since Task 2. Fix any residual type errors now (they should only be in files this plan already touched).

Run: `npm run lint`
Expected: PASS (no unused imports/vars left behind).

Run: `npm run build`
Expected: PASS (tsc + vite build + PWA assets).

- [ ] **Step 8: Manual QA on `npm run dev`**

1. Seed legacy data in the browser console, then reload — the old session must appear under Past (or Active if dated today):
   `localStorage.clear(); localStorage.setItem('pickleball-session', JSON.stringify({date:'2026-03-24',venue:'Legacy Court',defaultRate:500,timeSlots:[{id:'t1',startTime:'14:00',endTime:'16:00',numCourts:2}],players:[{id:'p1',name:'Alice',status:'active'}],matchupState:null,roundHistory:[],playSystem:'paddle-queue',deferredPlayerIds:[]}))`
2. Create a session with 4+ players → check in 4 on Players tab → generate matchups → Next Round → mark a winner in Matches → open Expenses, type amount, verify split and Share copies text.
3. End the session → verify read-only everywhere except the Expenses modal → Reopen.
4. Browser back from detail returns to the list.

- [ ] **Step 9: Commit and push**

```bash
git add -A
git commit -m "feat: session history with list, detail screens, and routing"
git push
```

Pre-push `tsc -b` must pass (it will — Step 7 verified it).
