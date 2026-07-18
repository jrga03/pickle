# Session History Refactor — Design

**Date:** 2026-07-18
**Status:** Approved

## Overview

Pickle currently manages a single session stored under one localStorage key, edited through four bottom tabs (Setup, Players, Matchups, Expenses). This refactor turns the app into a session-history app: the home screen lists all sessions (active pinned above ended, newest first), sessions are created and edited through a modal, and session details slims down to three tabs — **Players | Matchups | Matches** — with expenses moved to a modal behind a header button.

Alongside the structural change, the expense model simplifies from per-hour presence proration to a **flat split**: everyone who checked in at any point splits the total court amount equally. This deletes time slots and player arrival/departure schedules from the data model.

## Decisions & Deferrals

- **Flat expense split, no times** — per-slot presence proration dropped; total ÷ participants. Revisit if the group starts caring about late-arrival fairness again.
- **Time slots deleted** — matchups only ever consumed the max court count; flat split removes the other consumer. Session captures `numCourts` + optional `courtAmount` instead.
- **Modal defines roster; Players tab checks in/out** — the create/edit modal lists expected players; a dedicated Players tab in session details handles check-in/check-out, which controls matchup-pool membership.
- **Winners recorded** — challenge-court captures the winner from the existing advance tap; all modes can tap-to-mark winners on past games in the Matches tab. Enables W/L tally. Full score entry (11-7) rejected as too much tapping.
- **Lifecycle: active/ended, explicit End + Reopen** — ended sessions are read-only except the Expenses modal. Multiple sessions may be active simultaneously; nothing auto-ends.
- **Delete only for ended sessions** — prevents nuking a live session mid-play.
- **React Router (Approach B)** — chosen over view-state navigation (A) and a bolt-on session picker (C, rejected — didn't deliver the refactor). Real URLs, reload restores place.
- **Play system in both places** — modal sets the initial system; the Matchups tab selector remains for mid-session switches.
- **`participated` is sticky** — check in then out → still owes a share (they played).
- **Migrated legacy session is `ended` unless dated today.**

## Data Model

```ts
export type SessionStatus = 'active' | 'ended'
export type PlaySystem = 'paddle-queue' | 'challenge-court' | 'round-robin' // unchanged

export interface SessionPlayer {
  id: string
  name: string
  checkedIn: boolean     // currently in the matchup pool
  participated: boolean  // ever checked in — sticky; drives expense split
}

export interface Game {
  court: number
  team1: [string, string] // player IDs
  team2: [string, string]
  winner?: 1 | 2          // NEW — recorded result
}

export interface Round {
  id: string
  games: Game[]           // games may carry winner
  sittingOut: string[]
}

export interface MatchupState {
  games: Game[]
  sittingOut: string[]
}

export interface Session {
  id: string                 // NEW
  createdAt: string          // NEW — ISO timestamp, sort tiebreaker
  status: SessionStatus      // NEW
  date: string               // "2026-07-18"
  venue: string              // optional (empty string allowed)
  numCourts: number          // NEW — replaces timeSlots; min 1
  courtAmount: number | null // NEW — optional flat total; replaces defaultRate
  playSystem: PlaySystem
  players: SessionPlayer[]
  matchupState: MatchupState | null
  roundHistory: Round[]
  deferredPlayerIds: string[]
}

export interface SavedVenue {
  id: string
  name: string   // defaultRate removed — a flat total varies per session
}

export interface SavedPlayer {
  id: string
  name: string
}
```

Deleted: `TimeSlot`, `PlayerStatus`, player `arrivalTime`/`departureTime`/`status`, `Session.defaultRate`, `Session.timeSlots`, `SavedVenue.defaultRate`.

## Storage & Migration

- New key **`pickleball-sessions`** holds `Session[]`, saved on change (same `useEffect` pattern as today, whole array).
- **Migration** (first load, when `pickleball-sessions` is absent and legacy `pickleball-session` exists) — legacy session becomes one array entry, then the legacy key is removed:
  - `id`, `createdAt` generated
  - `numCourts` = max `numCourts` across legacy time slots, min 1
  - `courtAmount` = legacy computed total cost (sum of slot hours × courts × effective rate — the old expense math), or `null` if 0
  - players: `checkedIn` = legacy `status === 'active'`; `participated` = `true` for all
  - `status` = `'active'` if legacy `date` is today, else `'ended'`
  - `matchupState`, `roundHistory`, `deferredPlayerIds` carry over untouched (including existing stale-ID cleanup)
- `pickleball-venues` / `pickleball-players` keys unchanged; venues simply stop reading `defaultRate`.
- Corrupt JSON in any key → treated as empty (today's behavior).

## Routing & Screens

`react-router` with `BrowserRouter`. The PWA service worker's `navigateFallback` serves `index.html` for deep-link reloads once installed; if the app is ever hosted on a static host without SPA rewrites, add the host's rewrite/404 fallback.

- **`/` → SessionListScreen** — "New Session" button, then active sessions (badge), then ended sessions; both groups newest first (by `date`, `createdAt` tiebreak). Cards show date, venue, player count, status badge; ended cards get a trash icon (confirm before delete). Tap card → `/session/:id`.
- **`/session/:id` → SessionDetailScreen** — header: back arrow, venue/date title, actions: **Edit** (hidden when ended), **Expenses**, **End Session** / **Reopen**. Bottom tab bar: **Players | Matchups | Matches**. Active tab is component state, not a route — back always returns to the list. Unknown/deleted id → redirect to `/`.

## Components

- **SessionModal** — create + edit modes. Fields: date (defaults today), venue (autocomplete over saved venues, save-venue affordance), courts (number, min 1), court amount (optional), play system, roster editor (add via saved-player autocomplete, remove). Create → players start `checkedIn: false`, `participated: false`. Edit → removing a rostered player also removes them from live matchups via existing `removePlayerFromMatchups`.
- **PlayersTab** (rewritten) — roster rows with a **Check in / Check out** toggle each, "N checked in" summary. Check-in: `checkedIn = true`, `participated = true`, `addPlayerToMatchups`. Check-out: `checkedIn = false`, `removePlayerFromMatchups`, cleared from `deferredPlayerIds`. Re-check-in unlimited. Read-only when ended.
- **MatchupsTab** — round-history section removed (moves to Matches). Player pool = checked-in players; courts = `session.numCourts`; keeps its play-system selector. Action buttons hidden when ended. Otherwise untouched.
- **MatchesTab** (new) — W/L tally strip at top (only players with ≥1 recorded result), rounds newest first. Tap a team → mark winner; tap again → unset; tap other team → flip. Challenge-court rounds arrive pre-marked. Read-only when ended (Reopen to fix results).
- **ExpensesModal** — court amount input (editable here; ended sessions included — you settle up after ending), participant count, per-head share (2 decimals), participant list, copy-to-clipboard Share button. No amount → focus amount input, split area empty. Zero participants → "No one has checked in yet."
- **TabBar** — parameterized (takes a tab list); rendered only inside SessionDetailScreen.
- **ThemeToggle / ReloadPrompt / Autocomplete** — unchanged.

## State

- **SessionsProvider** (new) — owns `Session[]` + persistence; list ops: `createSession`, `updateSession(id, updater)`, `deleteSession`, `endSession`, `reopenSession`.
- **SessionProvider** (existing, rebound) — mounted by SessionDetailScreen with the route's session id; exposes the same per-session API consumers use today (`useSession()` → `session`, `setMatchupState`, `setRoundHistory`, `setDeferredPlayerIds`, check-in ops, …), delegating writes to `updateSession`. Keeps the MatchupsTab diff small.

## Behaviors

- **End Session** → read-only everywhere except ExpensesModal; Edit hidden, no check-in/out, no generate/next/re-roll, no winner edits. **Reopen** restores active.
- **Expenses** — `perHead = courtAmount / participants.length`, participants = `players.filter(p => p.participated)`. Share text: date/venue header, total, `÷ N players`, per-head, participant names.
- **Winners** — challenge-court advance stamps `winner` on the game as it snapshots into `roundHistory`; Matches tab tap-to-mark works for all modes. W/L tally computed on the fly from `roundHistory` — no stored stats.

## Guardrails & Edge Cases

- Courts min 1; roster names deduped case-insensitively per session; new roster names auto-saved to global saved players (today's behavior).
- Navigating to a deleted/unknown session id (stale URL, second tab) — detail route redirects to `/`.
- Checked-in player removed from roster via Edit modal → removed from matchups and deferred (existing utils).
- `courtAmount ≤ 0` treated as unset (`null`).

## Testing

- `expenses.test` — rewritten: even division, null amount, zero participants, non-participants excluded, 2-decimal display.
- `storage.test` — rewritten migration: legacy single-session → array (field mapping incl. courtAmount from old totals, status by date), fresh install, corrupt JSON, legacy-key removal.
- `matchups.test` — extended: challenge advance stamps winner on the snapshotted game.
- Context tests — sessions CRUD, end/reopen, check-in/out ↔ matchup-pool integration.
- Component tests — MatchesTab winner toggling + tally; SessionModal create/edit incl. roster removal; smoke tests for both screens/routes.

## Out of Scope

- Per-hour expense fairness (deliberately dropped)
- Score entry (points), player stats beyond session W/L tally
- Any backend, auth, or sync
