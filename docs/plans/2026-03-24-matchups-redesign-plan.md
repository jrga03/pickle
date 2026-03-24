# Matchups Tab Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move player status management from Players tab to Matchups tab, add defer-from-court flow, and fix UUID display bug.

**Architecture:** Simplify PlayerStatus to `'active' | 'left'`, add `deferredPlayerIds` to Session for persist-safe defer tracking. Roster with status toggles lives at top of MatchupsTab. Defer buttons on matched players swap them out and queue them for next round. All three matchup generators gain deferred-first placement.

**Tech Stack:** React 19, TypeScript, Vitest, Tailwind CSS

---

### Task 1: Update data model — types and storage migration

**Files:**
- Modify: `src/types.ts`
- Modify: `src/utils/storage.ts`
- Modify: `src/utils/__tests__/storage.test.ts`

**Step 1: Write the failing test for storage migration**

In `src/utils/__tests__/storage.test.ts`, add:

```typescript
it('migrates deferred status to active and initializes deferredPlayerIds', () => {
  const oldSession = {
    date: '2026-03-24',
    venue: 'Court A',
    defaultRate: 500,
    timeSlots: [],
    players: [
      { id: '1', name: 'Jason', arrivalTime: '14:00', departureTime: '18:00', status: 'deferred' },
      { id: '2', name: 'Lel', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
    ],
    rounds: [],
    playSystem: 'paddle-queue',
  }
  localStorage.setItem('pickleball-session', JSON.stringify(oldSession))
  const loaded = loadSession()
  expect(loaded!.players[0].status).toBe('active')
  expect(loaded!.players[1].status).toBe('active')
  expect(loaded!.deferredPlayerIds).toEqual([])
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/storage.test.ts`
Expected: FAIL — `deferredPlayerIds` does not exist on Session type

**Step 3: Update types.ts**

Change `PlayerStatus` and `Session`:

```typescript
// In src/types.ts
export type PlayerStatus = 'active' | 'left'

// Add to Session interface:
  deferredPlayerIds: string[]
```

**Step 4: Update storage.ts migration**

In `loadSession()`, after the existing arrivalTime migration, add:

```typescript
// Migrate deferred status to active
session.players = session.players.map(p => ({
  ...p,
  status: p.status === 'deferred' ? 'active' : p.status,
}))
// Initialize deferredPlayerIds if missing
if (!session.deferredPlayerIds) {
  session.deferredPlayerIds = []
}
```

**Step 5: Update defaultSession in SessionContext.tsx**

Add `deferredPlayerIds: []` to the `defaultSession` object.

**Step 6: Update mockSession in storage test**

Add `deferredPlayerIds: []` to the existing `mockSession` in `storage.test.ts`.

**Step 7: Run tests to verify they pass**

Run: `npx vitest run src/utils/__tests__/storage.test.ts`
Expected: PASS

**Step 8: Commit**

```bash
git add src/types.ts src/utils/storage.ts src/utils/__tests__/storage.test.ts src/context/SessionContext.tsx
git commit -m "feat: update data model — simplify PlayerStatus, add deferredPlayerIds"
```

---

### Task 2: Add setDeferredPlayerIds action to SessionContext

**Files:**
- Modify: `src/context/SessionContext.tsx`

**Step 1: Add the action**

In `SessionContextType` interface, add:
```typescript
setDeferredPlayerIds: (ids: string[]) => void
```

Add the implementation:
```typescript
const setDeferredPlayerIds = useCallback((deferredPlayerIds: string[]) =>
  setSession(s => ({ ...s, deferredPlayerIds })), [])
```

Add to the Provider value:
```typescript
setDeferredPlayerIds,
```

**Step 2: Run existing tests to verify nothing breaks**

Run: `npx vitest run`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/context/SessionContext.tsx
git commit -m "feat: add setDeferredPlayerIds action to SessionContext"
```

---

### Task 3: Simplify PlayersTab — remove status badges

**Files:**
- Modify: `src/components/PlayersTab.tsx`

**Step 1: Remove status-related code**

Remove these imports/constants:
- `statusColors` map
- `nextStatus` map
- `updatePlayerStatus` from the useSession destructure
- The `PlayerStatus` import

Remove the status button from each player row (the `<button>` with `statusColors` around line 160-165).

**Step 2: Run the app and verify**

Run: `npx vite dev`
Verify: Players tab shows name, time slot pickers, remove button. No status badges.

**Step 3: Commit**

```bash
git add src/components/PlayersTab.tsx
git commit -m "feat: remove status badges from PlayersTab"
```

---

### Task 4: Update matchup generators to support deferred-first placement

**Files:**
- Modify: `src/utils/matchups.ts`
- Modify: `src/utils/__tests__/matchups.test.ts`

**Step 1: Write failing tests for deferred-first placement**

Add to `matchups.test.ts`:

```typescript
describe('deferred player priority', () => {
  it('paddle queue places deferred players in games first', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
    const deferredIds = ['p5', 'p6']
    const round = generatePaddleQueueRound(playerIds, 1, deferredIds)
    const playing = [...round.games[0].team1, ...round.games[0].team2]
    expect(playing).toContain('p5')
    expect(playing).toContain('p6')
  })

  it('round robin places deferred players in games first', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
    const deferredIds = ['p5', 'p6']
    const round = generateRoundRobinRound(playerIds, 1, [], deferredIds)
    const playing = [...round.games[0].team1, ...round.games[0].team2]
    expect(playing).toContain('p5')
    expect(playing).toContain('p6')
  })

  it('challenge court places deferred players in games first', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
    const deferredIds = ['p5', 'p6']
    const round = generateChallengeCourtRound(playerIds, 1, [], deferredIds)
    const playing = [...round.games[0].team1, ...round.games[0].team2]
    expect(playing).toContain('p5')
    expect(playing).toContain('p6')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/__tests__/matchups.test.ts`
Expected: FAIL — wrong number of arguments

**Step 3: Update generatePaddleQueueRound**

Add optional `deferredPlayerIds` parameter. Place deferred players first, then shuffle remaining:

```typescript
export function generatePaddleQueueRound(
  playerIds: string[],
  numCourts: number,
  deferredPlayerIds: string[] = [],
): Round {
  const deferred = deferredPlayerIds.filter(id => playerIds.includes(id))
  const rest = shuffle(playerIds.filter(id => !deferredPlayerIds.includes(id)))
  const ordered = [...deferred, ...rest]
  const games: Game[] = []
  const sittingOut: string[] = []

  const maxGames = Math.min(numCourts, Math.floor(ordered.length / 4))

  for (let i = 0; i < maxGames; i++) {
    const offset = i * 4
    games.push({
      court: i + 1,
      team1: [ordered[offset], ordered[offset + 1]],
      team2: [ordered[offset + 2], ordered[offset + 3]],
    })
  }

  const playingCount = maxGames * 4
  for (let i = playingCount; i < ordered.length; i++) {
    sittingOut.push(ordered[i])
  }

  return { id: generateId(), games, sittingOut }
}
```

**Step 4: Update generateRoundRobinRound**

Add optional `deferredPlayerIds` parameter. Ensure deferred players are placed first in each shuffle attempt:

```typescript
export function generateRoundRobinRound(
  playerIds: string[],
  numCourts: number,
  previousRounds: { games: { team1: [string, string]; team2: [string, string] }[] }[],
  deferredPlayerIds: string[] = [],
): Round {
  const usedPartners = getPreviousPartners(previousRounds)
  const maxGames = Math.min(numCourts, Math.floor(playerIds.length / 4))
  const deferred = deferredPlayerIds.filter(id => playerIds.includes(id))
  const restIds = playerIds.filter(id => !deferredPlayerIds.includes(id))

  let bestRound: Round | null = null
  let bestRepeats = Infinity

  for (let attempt = 0; attempt < 50; attempt++) {
    const shuffled = [...deferred, ...shuffle(restIds)]
    const games: Game[] = []
    const sittingOut: string[] = []
    let repeats = 0

    for (let i = 0; i < maxGames; i++) {
      const offset = i * 4
      const t1: [string, string] = [shuffled[offset], shuffled[offset + 1]]
      const t2: [string, string] = [shuffled[offset + 2], shuffled[offset + 3]]
      if (usedPartners.has(getPartnerKey(t1[0], t1[1]))) repeats++
      if (usedPartners.has(getPartnerKey(t2[0], t2[1]))) repeats++
      games.push({ court: i + 1, team1: t1, team2: t2 })
    }

    const playingCount = maxGames * 4
    for (let i = playingCount; i < shuffled.length; i++) {
      sittingOut.push(shuffled[i])
    }

    const round: Round = { id: generateId(), games, sittingOut }

    if (repeats < bestRepeats) {
      bestRepeats = repeats
      bestRound = round
    }
    if (repeats === 0) break
  }

  return bestRound!
}
```

**Step 5: Update generateChallengeCourtRound**

Add optional `deferredPlayerIds` parameter. Deferred players take priority over both staying and others:

```typescript
export function generateChallengeCourtRound(
  playerIds: string[],
  numCourts: number,
  stayingPlayerIds: string[] = [],
  deferredPlayerIds: string[] = [],
): Round {
  const deferredSet = new Set(deferredPlayerIds)
  const stayingSet = new Set(stayingPlayerIds)
  const deferred = playerIds.filter(id => deferredSet.has(id))
  const staying = shuffle(playerIds.filter(id => stayingSet.has(id) && !deferredSet.has(id)))
  const others = shuffle(playerIds.filter(id => !stayingSet.has(id) && !deferredSet.has(id)))
  const games: Game[] = []
  const sittingOut: string[] = []
  const maxGames = Math.min(numCourts, Math.floor(playerIds.length / 4))

  let defIdx = 0
  let otherIdx = 0
  let stayIdx = 0

  for (let i = 0; i < maxGames; i++) {
    const courtPlayers: string[] = []

    // Deferred players first
    while (courtPlayers.length < 4 && defIdx < deferred.length) {
      courtPlayers.push(deferred[defIdx++])
    }

    // Then one staying player per court
    if (courtPlayers.length < 4 && stayIdx < staying.length) {
      courtPlayers.push(staying[stayIdx++])
    }

    // Fill with others
    while (courtPlayers.length < 4 && otherIdx < others.length) {
      courtPlayers.push(others[otherIdx++])
    }

    // Fill with remaining staying
    while (courtPlayers.length < 4 && stayIdx < staying.length) {
      courtPlayers.push(staying[stayIdx++])
    }

    if (courtPlayers.length === 4) {
      games.push({
        court: i + 1,
        team1: [courtPlayers[0], courtPlayers[1]],
        team2: [courtPlayers[2], courtPlayers[3]],
      })
    } else {
      sittingOut.push(...courtPlayers)
    }
  }

  while (defIdx < deferred.length) sittingOut.push(deferred[defIdx++])
  while (otherIdx < others.length) sittingOut.push(others[otherIdx++])
  while (stayIdx < staying.length) sittingOut.push(staying[stayIdx++])

  return { id: generateId(), games, sittingOut }
}
```

**Step 6: Run all tests**

Run: `npx vitest run src/utils/__tests__/matchups.test.ts`
Expected: All PASS

**Step 7: Commit**

```bash
git add src/utils/matchups.ts src/utils/__tests__/matchups.test.ts
git commit -m "feat: matchup generators support deferred-first placement"
```

---

### Task 5: Update MatchupsTab — add roster section and defer buttons

**Files:**
- Modify: `src/components/MatchupsTab.tsx`

**Step 1: Add roster section at top of MatchupsTab**

After the play system selector and before the generate buttons, add a roster section. Import `updatePlayerStatus` from useSession:

```tsx
const { session, setPlaySystem, setRounds, updatePlayerStatus, setDeferredPlayerIds } = useSession()
```

Roster section (after the play system toggle, before the "need 4 players" warning):

```tsx
{session.players.length > 0 && (
  <div className="space-y-2">
    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Roster</h3>
    <div className="flex flex-wrap gap-2">
      {session.players.map(player => (
        <button
          key={player.id}
          onClick={() => updatePlayerStatus(player.id, player.status === 'active' ? 'left' : 'active')}
          className={`rounded-full px-3 py-1.5 text-sm font-medium min-h-[32px] ${
            player.status === 'active'
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-500 line-through'
          }`}
        >
          {player.name}
        </button>
      ))}
    </div>
  </div>
)}
```

**Step 2: Add defer buttons to matched players in court cards**

Update the court card rendering. For each player in a game, add a defer button next to their name. The defer action:
1. Removes the player from the current round's game
2. Replaces them with the first sitting-out player
3. Adds the deferred player to `session.deferredPlayerIds`

Add a handler function:

```tsx
const deferPlayer = (playerId: string) => {
  if (!currentRound) return
  const sittingOut = [...currentRound.sittingOut]
  if (sittingOut.length === 0) return // No replacement available

  const replacement = sittingOut.shift()!
  const updatedGames = currentRound.games.map(game => ({
    ...game,
    team1: game.team1.map(id => id === playerId ? replacement : id) as [string, string],
    team2: game.team2.map(id => id === playerId ? replacement : id) as [string, string],
  }))

  sittingOut.push(playerId) // Deferred player goes to sitting out for this round display
  const updatedRound = { ...currentRound, games: updatedGames, sittingOut }
  const updatedRounds = [...session.rounds.slice(0, -1), updatedRound]
  setRounds(updatedRounds)
  setDeferredPlayerIds([...session.deferredPlayerIds, playerId])
}
```

Update the player name display in court cards to include a defer button:

```tsx
{currentRound.games.map(game => (
  <div key={game.court} className="bg-white rounded-lg border border-gray-200 p-4">
    <p className="text-xs font-medium text-gray-400 mb-2">Court {game.court}</p>
    <div className="flex items-center justify-between">
      <div className="text-center flex-1 space-y-1">
        {game.team1.map(id => (
          <div key={id} className="flex items-center justify-center gap-1">
            <p className="font-medium text-gray-900">{getName(id)}</p>
            {currentRound.sittingOut.length > 0 && (
              <button
                onClick={() => deferPlayer(id)}
                className="text-xs text-amber-600 hover:text-amber-800 px-1"
                title="Defer to next round"
              >
                defer
              </button>
            )}
          </div>
        ))}
      </div>
      <span className="text-gray-400 font-bold px-3">vs</span>
      <div className="text-center flex-1 space-y-1">
        {game.team2.map(id => (
          <div key={id} className="flex items-center justify-center gap-1">
            <p className="font-medium text-gray-900">{getName(id)}</p>
            {currentRound.sittingOut.length > 0 && (
              <button
                onClick={() => deferPlayer(id)}
                className="text-xs text-amber-600 hover:text-amber-800 px-1"
                title="Defer to next round"
              >
                defer
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
))}
```

**Step 3: Pass deferredPlayerIds to generators and clear after generation**

Update `generateRound()`:

```tsx
const generateRound = () => {
  const playerIds = activePlayers.map(p => p.id)
  let round: Round

  switch (session.playSystem) {
    case 'paddle-queue':
      round = generatePaddleQueueRound(playerIds, currentCourts, session.deferredPlayerIds)
      break
    case 'round-robin':
      round = generateRoundRobinRound(playerIds, currentCourts, session.rounds, session.deferredPlayerIds)
      break
    case 'challenge-court':
      round = generateChallengeCourtRound(playerIds, currentCourts, [...stayingIds], session.deferredPlayerIds)
      break
  }

  setRounds([...session.rounds, round])
  setDeferredPlayerIds([])
  setStayingIds(new Set())
}
```

Update `regenerateLastRound()` similarly — pass `session.deferredPlayerIds` to generators.

**Step 4: Show deferred indicator in sitting out section**

Update the sitting out display to mark deferred players:

```tsx
{currentRound.sittingOut.length > 0 && (
  <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
    <p className="text-xs font-medium text-gray-400 mb-1">Sitting Out</p>
    <div className="flex flex-wrap gap-1">
      {currentRound.sittingOut.map(id => (
        <span
          key={id}
          className={`text-sm px-2 py-0.5 rounded ${
            session.deferredPlayerIds.includes(id)
              ? 'bg-amber-100 text-amber-800'
              : 'text-gray-700'
          }`}
        >
          {getName(id)}{session.deferredPlayerIds.includes(id) ? ' (next round)' : ''}
        </span>
      ))}
    </div>
  </div>
)}
```

**Step 5: Verify in browser**

Run: `npx vite dev`
Verify:
- Roster section shows at top with active/left toggles
- Court cards have defer buttons next to player names
- Clicking defer swaps the player with first sitting-out player
- Deferred player shows "(next round)" in sitting out
- Next round places deferred players first
- Deferred state clears after next round generation

**Step 6: Commit**

```bash
git add src/components/MatchupsTab.tsx
git commit -m "feat: add roster section and defer buttons to MatchupsTab"
```

---

### Task 6: Fix UUID display bug

**Files:**
- Modify: `src/utils/storage.ts`
- Modify: `src/utils/__tests__/storage.test.ts`

**Step 1: Write failing test**

```typescript
it('clears rounds when player IDs in rounds do not match session players', () => {
  const staleSession = {
    date: '2026-03-24',
    venue: 'Court A',
    defaultRate: 500,
    timeSlots: [],
    players: [
      { id: 'p1', name: 'Jason', arrivalTime: '14:00', departureTime: '18:00', status: 'active' },
    ],
    rounds: [{
      id: 'r1',
      games: [{
        court: 1,
        team1: ['stale-uuid-1', 'stale-uuid-2'],
        team2: ['stale-uuid-3', 'stale-uuid-4'],
      }],
      sittingOut: [],
    }],
    playSystem: 'paddle-queue',
    deferredPlayerIds: [],
  }
  localStorage.setItem('pickleball-session', JSON.stringify(staleSession))
  const loaded = loadSession()
  expect(loaded!.rounds).toEqual([])
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/storage.test.ts`
Expected: FAIL — rounds not cleared

**Step 3: Add stale round cleanup to loadSession**

After existing migrations in `loadSession()`, add:

```typescript
// Clear rounds if they reference player IDs not in the current player list
const playerIdSet = new Set(session.players.map(p => p.id))
const hasStaleRounds = session.rounds.some(round =>
  round.games.some(game =>
    [...game.team1, ...game.team2].some(id => !playerIdSet.has(id))
  ) || round.sittingOut.some(id => !playerIdSet.has(id))
)
if (hasStaleRounds) {
  session.rounds = []
}
```

**Step 4: Run tests**

Run: `npx vitest run src/utils/__tests__/storage.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/utils/storage.ts src/utils/__tests__/storage.test.ts
git commit -m "fix: clear stale rounds with orphaned player IDs on session load"
```

---

### Task 7: Clean up unused code

**Files:**
- Modify: `src/types.ts` — verify `'deferred'` is no longer referenced anywhere
- Modify: `src/components/PlayersTab.tsx` — remove `PlayerStatus` import if still present
- Modify: `src/context/SessionContext.tsx` — verify `updatePlayerStatus` only accepts `'active' | 'left'`

**Step 1: Search for remaining 'deferred' references**

Run: `grep -r "deferred" src/ --include="*.ts" --include="*.tsx" | grep -v deferredPlayerIds | grep -v __tests__`

Fix any remaining references to the old 3-state status.

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All PASS

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove leftover deferred status references"
```
