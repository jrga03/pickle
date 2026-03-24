# Pickleball Open Play App — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a mobile-first PWA for managing pickleball open play sessions — matchups and expense splitting.

**Architecture:** Single-page React app with tab navigation (Setup → Players → Matchups → Expenses). All state managed via React Context, persisted to LocalStorage. No backend, no auth.

**Tech Stack:** Vite, React, TypeScript, Tailwind CSS, vite-plugin-pwa, Vitest + React Testing Library

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`
- Create: `src/main.tsx`, `src/App.tsx`, `src/index.css`

**Step 1: Scaffold Vite + React + TypeScript project**

Run:
```bash
npm create vite@latest . -- --template react-ts
npm install
```

**Step 2: Install Tailwind CSS**

Run:
```bash
npm install -D tailwindcss @tailwindcss/vite
```

Update `src/index.css` to:
```css
@import "tailwindcss";
```

Update `vite.config.ts` to:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

**Step 3: Install PWA plugin**

Run:
```bash
npm install -D vite-plugin-pwa
```

Update `vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Pickleball Open Play',
        short_name: 'Pickleball',
        description: 'Manage open play sessions and expenses',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
```

**Step 4: Install testing dependencies**

Run:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

Add to `vite.config.ts`:
```ts
/// <reference types="vitest/config" />
```

And add `test` config:
```ts
export default defineConfig({
  // ...plugins
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
})
```

Create `src/test-setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

**Step 5: Create minimal App.tsx**

```tsx
function App() {
  return (
    <div className="min-h-screen bg-white">
      <h1 className="text-2xl font-bold p-4">Pickleball Open Play</h1>
    </div>
  )
}

export default App
```

**Step 6: Verify everything works**

Run:
```bash
npm run dev
```
Expected: App renders with "Pickleball Open Play" heading, Tailwind styles applied.

Run:
```bash
npx vitest run
```
Expected: No test failures (no tests yet, clean exit).

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + React + TypeScript + Tailwind + PWA project"
```

---

### Task 2: Types & Session Context

**Files:**
- Create: `src/types.ts`
- Create: `src/context/SessionContext.tsx`
- Test: `src/context/__tests__/SessionContext.test.tsx`

**Step 1: Write the types**

Create `src/types.ts`:
```ts
export type PlayerStatus = 'active' | 'deferred' | 'left'

export type PlaySystem = 'paddle-queue' | 'challenge-court' | 'round-robin'

export interface TimeSlot {
  id: string
  startTime: string // "13:00"
  endTime: string   // "14:00"
  numCourts: number
  rateOverride?: number
}

export interface Player {
  id: string
  name: string
  arrivalSlotId: string // references TimeSlot.id
  status: PlayerStatus
}

export interface Game {
  court: number
  team1: [string, string] // player IDs
  team2: [string, string] // player IDs
}

export interface Round {
  id: string
  games: Game[]
  sittingOut: string[] // player IDs
}

export interface Session {
  date: string
  venue: string
  defaultRate: number
  timeSlots: TimeSlot[]
  players: Player[]
  rounds: Round[]
  playSystem: PlaySystem
}
```

**Step 2: Write failing test for SessionContext**

Create `src/context/__tests__/SessionContext.test.tsx`:
```tsx
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionProvider, useSession } from '../SessionContext'

function TestConsumer() {
  const { session, addPlayer, removePlayer } = useSession()
  return (
    <div>
      <span data-testid="player-count">{session.players.length}</span>
      <button onClick={() => addPlayer('Alice')}>Add Alice</button>
      <button onClick={() => {
        if (session.players[0]) removePlayer(session.players[0].id)
      }}>Remove First</button>
    </div>
  )
}

describe('SessionContext', () => {
  it('starts with empty session', () => {
    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    )
    expect(screen.getByTestId('player-count')).toHaveTextContent('0')
  })

  it('adds a player', async () => {
    const user = userEvent.setup()
    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    )
    await user.click(screen.getByText('Add Alice'))
    expect(screen.getByTestId('player-count')).toHaveTextContent('1')
  })

  it('removes a player', async () => {
    const user = userEvent.setup()
    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    )
    await user.click(screen.getByText('Add Alice'))
    await user.click(screen.getByText('Remove First'))
    expect(screen.getByTestId('player-count')).toHaveTextContent('0')
  })
})
```

**Step 3: Run test to verify it fails**

Run: `npx vitest run src/context/__tests__/SessionContext.test.tsx`
Expected: FAIL — module not found

**Step 4: Implement SessionContext**

Create `src/context/SessionContext.tsx`:
```tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { Session, Player, TimeSlot, PlaySystem } from '../types'

const generateId = () => crypto.randomUUID()

const defaultSession: Session = {
  date: new Date().toISOString().split('T')[0],
  venue: '',
  defaultRate: 0,
  timeSlots: [],
  players: [],
  rounds: [],
  playSystem: 'paddle-queue',
}

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
  updatePlayerArrival: (id: string, slotId: string) => void
  setRounds: (rounds: Session['rounds']) => void
  resetSession: () => void
}

const SessionContext = createContext<SessionContextType | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(defaultSession)

  const setDate = useCallback((date: string) =>
    setSession(s => ({ ...s, date })), [])

  const setVenue = useCallback((venue: string) =>
    setSession(s => ({ ...s, venue })), [])

  const setDefaultRate = useCallback((rate: number) =>
    setSession(s => ({ ...s, defaultRate: rate })), [])

  const setPlaySystem = useCallback((playSystem: PlaySystem) =>
    setSession(s => ({ ...s, playSystem })), [])

  const addTimeSlot = useCallback((startTime: string, endTime: string, numCourts: number, rateOverride?: number) =>
    setSession(s => ({
      ...s,
      timeSlots: [...s.timeSlots, { id: generateId(), startTime, endTime, numCourts, rateOverride }],
    })), [])

  const removeTimeSlot = useCallback((id: string) =>
    setSession(s => ({
      ...s,
      timeSlots: s.timeSlots.filter(ts => ts.id !== id),
    })), [])

  const updateTimeSlot = useCallback((id: string, updates: Partial<Omit<TimeSlot, 'id'>>) =>
    setSession(s => ({
      ...s,
      timeSlots: s.timeSlots.map(ts => ts.id === id ? { ...ts, ...updates } : ts),
    })), [])

  const addPlayer = useCallback((name: string) =>
    setSession(s => ({
      ...s,
      players: [...s.players, {
        id: generateId(),
        name,
        arrivalSlotId: s.timeSlots[0]?.id ?? '',
        status: 'active' as const,
      }],
    })), [])

  const removePlayer = useCallback((id: string) =>
    setSession(s => ({
      ...s,
      players: s.players.filter(p => p.id !== id),
    })), [])

  const updatePlayerStatus = useCallback((id: string, status: Player['status']) =>
    setSession(s => ({
      ...s,
      players: s.players.map(p => p.id === id ? { ...p, status } : p),
    })), [])

  const updatePlayerArrival = useCallback((id: string, slotId: string) =>
    setSession(s => ({
      ...s,
      players: s.players.map(p => p.id === id ? { ...p, arrivalSlotId: slotId } : p),
    })), [])

  const setRounds = useCallback((rounds: Session['rounds']) =>
    setSession(s => ({ ...s, rounds })), [])

  const resetSession = useCallback(() =>
    setSession(defaultSession), [])

  return (
    <SessionContext.Provider value={{
      session, setDate, setVenue, setDefaultRate, setPlaySystem,
      addTimeSlot, removeTimeSlot, updateTimeSlot,
      addPlayer, removePlayer, updatePlayerStatus, updatePlayerArrival,
      setRounds, resetSession,
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

**Step 5: Run tests to verify they pass**

Run: `npx vitest run src/context/__tests__/SessionContext.test.tsx`
Expected: 3 tests PASS

**Step 6: Commit**

```bash
git add src/types.ts src/context/
git commit -m "feat: add types and SessionContext with player management"
```

---

### Task 3: Expense Calculation Logic

**Files:**
- Create: `src/utils/expenses.ts`
- Test: `src/utils/__tests__/expenses.test.ts`

**Step 1: Write failing tests**

Create `src/utils/__tests__/expenses.test.ts`:
```ts
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
  // p1-p6 arrive at s1, p7 arrives at s2
  // s3: only p1-p4 remain (p5, p6 left, p7 left)
  // For this test, all are "active" so all present from their arrival onward

  it('computes per-slot cost correctly', () => {
    const defaultRate = 500
    // Simplify: all 7 players present from s1 onward
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
    // "left" players are still included in expense if they were present
    // "left" status means they left at some point — they should still pay for slots they attended
    // The status is about matchup availability, not expense exclusion
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
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/__tests__/expenses.test.ts`
Expected: FAIL — module not found

**Step 3: Implement expense calculation**

Create `src/utils/expenses.ts`:
```ts
import type { TimeSlot, Player } from '../types'

export interface SlotExpense {
  slotId: string
  slotLabel: string
  cost: number
  playerCount: number
  share: number
}

export interface PlayerExpense {
  playerId: string
  playerName: string
  slotBreakdown: SlotExpense[]
  total: number
}

function getSlotIndex(slots: TimeSlot[], slotId: string): number {
  return slots.findIndex(s => s.id === slotId)
}

function getPlayersInSlot(players: Player[], slots: TimeSlot[], slotId: string): Player[] {
  const slotIndex = getSlotIndex(slots, slotId)
  return players.filter(p => {
    const arrivalIndex = getSlotIndex(slots, p.arrivalSlotId)
    return arrivalIndex >= 0 && arrivalIndex <= slotIndex
  })
}

export function calculateExpenses(
  slots: TimeSlot[],
  players: Player[],
  defaultRate: number,
): PlayerExpense[] {
  // Pre-compute per-slot costs and player counts
  const slotData = slots.map(slot => {
    const rate = slot.rateOverride ?? defaultRate
    const cost = slot.numCourts * rate
    const presentPlayers = getPlayersInSlot(players, slots, slot.id)
    const playerCount = presentPlayers.length
    const share = playerCount > 0 ? cost / playerCount : 0
    return {
      slot,
      cost,
      playerCount,
      share,
      presentPlayerIds: new Set(presentPlayers.map(p => p.id)),
    }
  })

  return players.map(player => {
    const slotBreakdown: SlotExpense[] = []
    let total = 0

    for (const { slot, cost, playerCount, share, presentPlayerIds } of slotData) {
      if (presentPlayerIds.has(player.id)) {
        slotBreakdown.push({
          slotId: slot.id,
          slotLabel: `${slot.startTime}-${slot.endTime}`,
          cost,
          playerCount,
          share,
        })
        total += share
      }
    }

    return {
      playerId: player.id,
      playerName: player.name,
      slotBreakdown,
      total,
    }
  })
}

export function formatExpenseText(
  expenses: PlayerExpense[],
  session: { date: string; venue: string; defaultRate: number },
): string {
  const lines: string[] = []
  lines.push(`Pickleball Session - ${session.date}`)
  if (session.venue) lines.push(`Venue: ${session.venue}`)
  lines.push('')

  const sorted = [...expenses].sort((a, b) => a.playerName.localeCompare(b.playerName))
  const totalCost = expenses.reduce((sum, e) => sum + e.total, 0)

  for (const exp of sorted) {
    lines.push(`${exp.playerName}: ${exp.total.toFixed(2)}`)
  }

  lines.push('')
  lines.push(`Total: ${totalCost.toFixed(2)}`)
  return lines.join('\n')
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/__tests__/expenses.test.ts`
Expected: All 5 tests PASS

**Step 5: Commit**

```bash
git add src/utils/
git commit -m "feat: add expense calculation with per-slot splitting and late arrivals"
```

---

### Task 4: Matchup Generation Logic

**Files:**
- Create: `src/utils/matchups.ts`
- Test: `src/utils/__tests__/matchups.test.ts`

**Step 1: Write failing tests**

Create `src/utils/__tests__/matchups.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { generatePaddleQueueRound, generateRoundRobinRound } from '../matchups'

describe('generatePaddleQueueRound', () => {
  it('assigns 4 players to 1 court', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4']
    const round = generatePaddleQueueRound(playerIds, 1)
    expect(round.games).toHaveLength(1)
    expect(round.games[0].team1).toHaveLength(2)
    expect(round.games[0].team2).toHaveLength(2)
    expect(round.sittingOut).toHaveLength(0)
  })

  it('handles more players than court capacity', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
    const round = generatePaddleQueueRound(playerIds, 1)
    expect(round.games).toHaveLength(1)
    expect(round.sittingOut).toHaveLength(2)
  })

  it('fills multiple courts', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']
    const round = generatePaddleQueueRound(playerIds, 2)
    expect(round.games).toHaveLength(2)
    expect(round.sittingOut).toHaveLength(0)
  })

  it('handles fewer than 4 players gracefully', () => {
    const playerIds = ['p1', 'p2', 'p3']
    const round = generatePaddleQueueRound(playerIds, 1)
    expect(round.games).toHaveLength(0)
    expect(round.sittingOut).toHaveLength(3)
  })
})

describe('generateRoundRobinRound', () => {
  it('generates a round with unique pairings', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4']
    const previousRounds: { games: { team1: [string, string]; team2: [string, string] }[] }[] = []
    const round = generateRoundRobinRound(playerIds, 1, previousRounds)
    expect(round.games).toHaveLength(1)
    // All 4 players should be playing
    const allPlaying = [...round.games[0].team1, ...round.games[0].team2]
    expect(new Set(allPlaying).size).toBe(4)
  })

  it('tries to avoid repeating partner pairings', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4']
    const round1 = generateRoundRobinRound(playerIds, 1, [])
    const round2 = generateRoundRobinRound(playerIds, 1, [round1])
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
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/__tests__/matchups.test.ts`
Expected: FAIL — module not found

**Step 3: Implement matchup generation**

Create `src/utils/matchups.ts`:
```ts
import type { Round, Game } from '../types'

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const generateId = () => crypto.randomUUID()

export function generatePaddleQueueRound(playerIds: string[], numCourts: number): Round {
  const shuffled = shuffle(playerIds)
  const games: Game[] = []
  const sittingOut: string[] = []

  const maxGames = Math.min(numCourts, Math.floor(shuffled.length / 4))

  for (let i = 0; i < maxGames; i++) {
    const offset = i * 4
    games.push({
      court: i + 1,
      team1: [shuffled[offset], shuffled[offset + 1]],
      team2: [shuffled[offset + 2], shuffled[offset + 3]],
    })
  }

  // Remaining players sit out
  const playingCount = maxGames * 4
  for (let i = playingCount; i < shuffled.length; i++) {
    sittingOut.push(shuffled[i])
  }

  return { id: generateId(), games, sittingOut }
}

function getPartnerKey(a: string, b: string): string {
  return [a, b].sort().join(',')
}

function getPreviousPartners(
  previousRounds: { games: { team1: [string, string]; team2: [string, string] }[] }[],
): Set<string> {
  const partners = new Set<string>()
  for (const round of previousRounds) {
    for (const game of round.games) {
      partners.add(getPartnerKey(game.team1[0], game.team1[1]))
      partners.add(getPartnerKey(game.team2[0], game.team2[1]))
    }
  }
  return partners
}

export function generateRoundRobinRound(
  playerIds: string[],
  numCourts: number,
  previousRounds: { games: { team1: [string, string]; team2: [string, string] }[] }[],
): Round {
  const usedPartners = getPreviousPartners(previousRounds)
  const maxGames = Math.min(numCourts, Math.floor(playerIds.length / 4))

  // Try multiple shuffles and pick the one with fewest repeated partner pairings
  let bestRound: Round | null = null
  let bestRepeats = Infinity

  for (let attempt = 0; attempt < 50; attempt++) {
    const shuffled = shuffle(playerIds)
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

export function generateChallengeCourtRound(
  playerIds: string[],
  numCourts: number,
  stayingPlayerIds: string[] = [],
): Round {
  // Winners (staying) get split across courts, remaining shuffled in
  const others = shuffle(playerIds.filter(id => !stayingPlayerIds.includes(id)))
  const staying = shuffle(stayingPlayerIds)
  const games: Game[] = []
  const sittingOut: string[] = []
  const maxGames = Math.min(numCourts, Math.floor(playerIds.length / 4))

  // Distribute staying players: 1 per court, paired with next available
  let otherIdx = 0
  let stayIdx = 0

  for (let i = 0; i < maxGames; i++) {
    const courtPlayers: string[] = []

    // Add a staying player if available
    if (stayIdx < staying.length) {
      courtPlayers.push(staying[stayIdx++])
    }

    // Fill rest from others
    while (courtPlayers.length < 4 && otherIdx < others.length) {
      courtPlayers.push(others[otherIdx++])
    }

    // If we still need players and have staying players, use them
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

  // Remaining players sit out
  while (otherIdx < others.length) sittingOut.push(others[otherIdx++])
  while (stayIdx < staying.length) sittingOut.push(staying[stayIdx++])

  return { id: generateId(), games, sittingOut }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/__tests__/matchups.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/utils/matchups.ts src/utils/__tests__/matchups.test.ts
git commit -m "feat: add matchup generation for paddle queue, round robin, and challenge court"
```

---

### Task 5: LocalStorage Persistence

**Files:**
- Create: `src/utils/storage.ts`
- Test: `src/utils/__tests__/storage.test.ts`
- Modify: `src/context/SessionContext.tsx`

**Step 1: Write failing tests**

Create `src/utils/__tests__/storage.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { saveSession, loadSession } from '../storage'
import type { Session } from '../../types'

const mockSession: Session = {
  date: '2026-03-24',
  venue: 'Court A',
  defaultRate: 500,
  timeSlots: [],
  players: [],
  rounds: [],
  playSystem: 'paddle-queue',
}

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and loads a session', () => {
    saveSession(mockSession)
    const loaded = loadSession()
    expect(loaded).toEqual(mockSession)
  })

  it('returns null when no session saved', () => {
    const loaded = loadSession()
    expect(loaded).toBeNull()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/__tests__/storage.test.ts`
Expected: FAIL — module not found

**Step 3: Implement storage**

Create `src/utils/storage.ts`:
```ts
import type { Session } from '../types'

const STORAGE_KEY = 'pickleball-session'

export function saveSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function loadSession(): Session | null {
  const data = localStorage.getItem(STORAGE_KEY)
  if (!data) return null
  try {
    return JSON.parse(data) as Session
  } catch {
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY)
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/__tests__/storage.test.ts`
Expected: All tests PASS

**Step 5: Wire up persistence in SessionContext**

Modify `src/context/SessionContext.tsx` — initialize state from `loadSession()` and call `saveSession()` on every state change via a `useEffect`.

**Step 6: Commit**

```bash
git add src/utils/storage.ts src/utils/__tests__/storage.test.ts src/context/SessionContext.tsx
git commit -m "feat: add LocalStorage persistence for sessions"
```

---

### Task 6: Tab Navigation Shell

**Files:**
- Create: `src/components/TabBar.tsx`
- Modify: `src/App.tsx`

**Step 1: Implement TabBar component**

Create `src/components/TabBar.tsx`:
```tsx
const tabs = ['Setup', 'Players', 'Matchups', 'Expenses'] as const
export type Tab = (typeof tabs)[number]

interface TabBarProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50">
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`flex-1 py-3 text-sm font-medium min-h-[48px] ${
            activeTab === tab
              ? 'text-green-600 border-t-2 border-green-600'
              : 'text-gray-500'
          }`}
        >
          {tab}
        </button>
      ))}
    </nav>
  )
}
```

**Step 2: Wire up App.tsx with tab state**

Update `src/App.tsx`:
```tsx
import { useState } from 'react'
import { SessionProvider } from './context/SessionContext'
import { TabBar, type Tab } from './components/TabBar'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Setup')

  return (
    <SessionProvider>
      <div className="min-h-screen bg-gray-50 pb-16">
        <header className="bg-green-600 text-white p-4">
          <h1 className="text-lg font-bold">Pickleball Open Play</h1>
        </header>
        <main className="p-4">
          {activeTab === 'Setup' && <div>Setup Tab</div>}
          {activeTab === 'Players' && <div>Players Tab</div>}
          {activeTab === 'Matchups' && <div>Matchups Tab</div>}
          {activeTab === 'Expenses' && <div>Expenses Tab</div>}
        </main>
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </SessionProvider>
  )
}

export default App
```

**Step 3: Verify visually**

Run: `npm run dev`
Expected: App shows green header, tab bar at bottom with 4 tabs, switching tabs changes content.

**Step 4: Commit**

```bash
git add src/components/TabBar.tsx src/App.tsx
git commit -m "feat: add bottom tab navigation shell"
```

---

### Task 7: Setup Tab UI

**Files:**
- Create: `src/components/SetupTab.tsx`
- Modify: `src/App.tsx`

**Step 1: Implement SetupTab**

Create `src/components/SetupTab.tsx` with:
- Date input
- Venue name input (optional)
- Default rate input (number, PHP)
- Time slots section: list of existing slots + "Add Time Slot" button
- Each time slot row: start time, end time, number of courts, optional rate override, delete button
- Use `useSession()` context for all state

The component should be mobile-friendly: stacked inputs, large touch targets, clear labels.

**Step 2: Wire into App.tsx**

Replace `{activeTab === 'Setup' && <div>Setup Tab</div>}` with `<SetupTab />`.

**Step 3: Verify visually**

Run: `npm run dev`
Expected: Setup tab shows form fields, can add/remove time slots, data persists on refresh.

**Step 4: Commit**

```bash
git add src/components/SetupTab.tsx src/App.tsx
git commit -m "feat: add Setup tab with session config and time slots"
```

---

### Task 8: Players Tab UI

**Files:**
- Create: `src/components/PlayersTab.tsx`
- Modify: `src/App.tsx`

**Step 1: Implement PlayersTab**

Create `src/components/PlayersTab.tsx` with:
- Text input + "Add" button to add player by name
- Player list: each player shows name, arrival slot dropdown, status badge
- Status badge is tappable: cycles Active → Deferred → Left
- Arrival slot dropdown shows available time slots
- Swipe-to-delete or delete button for removing players
- Player count summary per time slot shown at top

**Step 2: Wire into App.tsx**

**Step 3: Verify visually**

Run: `npm run dev`
Expected: Can add players, change status by tapping, set arrival slot, see counts per slot.

**Step 4: Commit**

```bash
git add src/components/PlayersTab.tsx src/App.tsx
git commit -m "feat: add Players tab with status cycling and arrival slots"
```

---

### Task 9: Matchups Tab UI

**Files:**
- Create: `src/components/MatchupsTab.tsx`
- Modify: `src/App.tsx`

**Step 1: Implement MatchupsTab**

Create `src/components/MatchupsTab.tsx` with:
- Play system selector at top (3 buttons: Paddle Queue / Challenge Court / Round Robin)
- "Generate Matchups" button — calls appropriate matchup function with active players + current court count
- Court cards: each card shows court number, team 1 vs team 2 with player names
- Sitting out section below cards
- "Next Round" button to generate another round
- For Challenge Court: after a round, show checkboxes to mark which players "stay" before generating next round
- "Regenerate" button to re-shuffle current round
- Round history: collapsible list of previous rounds

**Step 2: Wire into App.tsx**

**Step 3: Verify visually**

Run: `npm run dev`
Expected: Can select play system, generate matchups, see court cards, generate next rounds.

**Step 4: Commit**

```bash
git add src/components/MatchupsTab.tsx src/App.tsx
git commit -m "feat: add Matchups tab with play system selection and court cards"
```

---

### Task 10: Expenses Tab UI

**Files:**
- Create: `src/components/ExpensesTab.tsx`
- Modify: `src/App.tsx`

**Step 1: Implement ExpensesTab**

Create `src/components/ExpensesTab.tsx` with:
- Auto-computed expense breakdown using `calculateExpenses()`
- Per-player card showing: name, total amount, collapsible slot-by-slot breakdown
- Total session cost at top
- "Share" button at bottom (fixed) — calls `navigator.clipboard.writeText()` with formatted text from `formatExpenseText()`
- Show toast/feedback when copied

**Step 2: Wire into App.tsx**

**Step 3: Verify visually**

Run: `npm run dev`
Expected: Expenses auto-compute from session data, share button copies to clipboard.

**Step 4: Commit**

```bash
git add src/components/ExpensesTab.tsx src/App.tsx
git commit -m "feat: add Expenses tab with auto-computed breakdown and share"
```

---

### Task 11: PWA Icons & Final Polish

**Files:**
- Create: `public/icon-192.png`, `public/icon-512.png`
- Modify: `index.html` (meta tags for mobile)

**Step 1: Generate simple PWA icons**

Create minimal pickleball-themed icons (green circle with "PB" text) at 192x192 and 512x512.

**Step 2: Add mobile meta tags to index.html**

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#16a34a">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="/icon-192.png">
```

**Step 3: Build and test PWA**

Run:
```bash
npm run build
npx serve dist
```
Expected: App installable as PWA, works offline after first load.

**Step 4: Commit**

```bash
git add public/ index.html
git commit -m "feat: add PWA icons and mobile meta tags"
```

---

### Task 12: End-to-End Smoke Test

**Step 1: Manual test the full flow**

1. Open app → Setup tab → set date, rate 500, add 3 time slots (1-2pm/1 court, 2-3pm/2 courts, 3-4pm/1 court)
2. Players tab → add 7 players, set one to arrive at slot 2
3. Matchups tab → select Paddle Queue → Generate → verify court cards and sitting out
4. Tap Next Round → verify new matchups
5. Switch to Round Robin → Generate → verify different pairings
6. Expenses tab → verify correct per-player amounts
7. Tap Share → verify clipboard has formatted text
8. Refresh page → verify all data persisted

**Step 2: Fix any issues found**

**Step 3: Final commit**

```bash
git add -A
git commit -m "fix: address issues found during smoke testing"
```
