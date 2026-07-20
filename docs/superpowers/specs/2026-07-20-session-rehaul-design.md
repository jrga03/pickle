# Session Rehaul — Games-First Matchups

Date: 2026-07-20
Status: approved (brainstorm with Jason)

## Problem

The court-centric refactor left the session flow with leftover concepts that no longer match how open play runs:

- Rounds don't exist in reality — courts finish at different times, yet the UI is built around "Next Round" and `Round[]` history.
- Players are auto-assigned to courts on generate; organizers want to see suggestions and assign when a court is actually free.
- The Roster section on the Matchups tab duplicates the Players tab.
- The number of courts drives nothing visible, and the old time-slot cost model (courts × hours × rate) was lost in the refactor.
- No per-player stats.

## Goals

- Court cards with explicit "Team 1 Wins" / "Team 2 Wins" buttons; no rounds.
- Suggestion-driven assignment: ranked candidate matches, organizer picks one per free court.
- Equal-play fairness for round robin (fewest games first).
- Challenge court: winners hold the court; only losers are replaced.
- Per-player stats (games, W–L, win %) on the Players tab.
- Flat game list on the Matches tab (no "Sat out", no round grouping).
- Standalone court-cost calculator (restores the old slots × rate math) outside sessions.

## Out of scope

- Migration of existing stored sessions — old data is wiped (Jason's call).
- Web workers for the suggestion engine (bounded enumeration keeps it sub-ms; `useDeferredValue` is the future escape hatch if ever needed).
- Cross-session player stats.
- Win-streak caps for challenge court.

## Data model

Replaces `MatchupState`, `Round`, `matchupState`, `roundHistory`, `deferredPlayerIds`.

```ts
export interface Game {
  court: number
  team1: [string, string]
  team2: [string, string]
}

export interface CompletedGame {
  id: string            // uuid
  court: number
  team1: [string, string]
  team2: [string, string]
  winner: 1 | 2         // always set — games complete only via a win tap
  endedAt: string       // ISO timestamp; orders the Matches tab
}

export interface Session {
  // unchanged: id, createdAt, status, date, venue, numCourts,
  //            courtAmount, playSystem, players
  liveGames: Game[]                                // at most one per court
  matchHistory: CompletedGame[]                    // append-only, oldest first
  queue: string[]                                  // waiting player ids, front = next up
  courtWinners: Record<number, [string, string]>   // challenge court holdovers
}
```

**Invariant:** every checked-in player is in exactly one of: a live game, `courtWinners`, or `queue`.

- Check-in → append to queue end (`participated` still flips true).
- Check-out → remove from wherever they are. If they were in a live game, that game is cancelled — nothing recorded, the *remaining 3* go to the front of the queue. If they held a court in `courtWinners`, the hold dissolves and the court becomes fully free.

## Win / cancel semantics

**"Team X Wins"** (buttons under each live court card):

- Paddle queue / round robin: live game → `matchHistory` (winner + `endedAt` stamped); all 4 players to the back of the queue, losers first, then winners; court free.
- Challenge court: game → history; losers to back of queue; winners → `courtWinners[court]` (they hold the court awaiting challengers). Win streak shown on the card is derived by walking `matchHistory` backwards (same pair winning on that court) — no stored state.

**Cancel** (subtle ✕ on a live court card, with confirm): game removed, nothing recorded, all 4 players to the *front* of the queue in team order. Covers mis-assignments.

**Holdover dissolution rule (single rule, all causes):** whenever a `courtWinners` hold dissolves without a new game — play system switched, court removed by lowering `numCourts`, or a holder checks out (remaining partner) — the affected players go to the **front** of the queue.

## Suggestion engine

Pure, deterministic functions in `src/utils/suggestions.ts`. Computed on render inside `useMemo` keyed on `(queue, matchHistory, playSystem, numCourts, liveGames)` — recomputes only on assign / win / check-in/out, never per keystroke or scroll.

Returns a ranked list of up to **15** candidates (fewer if the pool is small — never forced).

- **Paddle queue:** window = first 6 in queue → C(6,4) = 15 foursomes, ranked by combined queue position ascending (longest waiting first). Team split follows queue order within the foursome (1st & 2nd vs 3rd & 4th).
- **Round robin:** score each waiting player by `(gamesPlayed, queuePosition)`; window = 10 lowest-scored → C(10,4) = 210 foursomes; rank by total games ascending, tie-break by combined queue position. Each candidate's team split is the arrangement (of 3) with the fewest repeat partnerships from `matchHistory`; ties → fewest repeat opponents; then first arrangement. Cap at 15.
- **Challenge court:**
  - Court held by winners: candidates are challenger *pairs* — window = first 6 in queue → C(6,2) = 15 pairs ranked by combined queue position. Candidate = winners (team 1, locked) vs pair (team 2).
  - Fully free court (session start, or hold dissolved): foursome candidates, same as paddle queue.

Performance: worst case ~210 foursomes × 3 splits scored per recompute — sub-millisecond; no web worker.

## Matchups tab UI

Top to bottom:

1. **System switcher + tagline** — unchanged. Roster section removed (check-in lives on the Players tab only).
2. **Court cards** — always `numCourts` cards (Court 1..N):
   - Live game: teams, then "Team 1 Wins" / "Team 2 Wins" buttons, plus the cancel ✕.
   - Challenge holdover: winner pair + derived streak ("3 wins"), awaiting challengers.
   - Free: empty-state card.
3. **Suggestions** — shown when at least one court is fillable: ranked candidates ("A & B vs C & D"), each with an "Assign to Court X" button per fillable court. Assigning creates the live game, removes those players from the queue (and clears the court's hold, for challenge), then **smooth-scrolls to the top** so the filled court card is visible.
4. **Waiting list** — display-only chips in queue order: name + games played (e.g. "Migs · 3").

Not enough waiting players for a court (4, or 2 for a held challenge court): no candidates for it; the waiting chips still render.

Removed entirely: Generate Matchups, Next Round, Reshuffle, Edit mode (tap-swap), Re-roll, defer, stored sitting-out.

## Players tab

Row layout unchanged (name + check-in/out button); add one stat subline per player, computed from `matchHistory`:

```
Migs
7 games · 4W–3L · 57%
```

Win % = wins ÷ games played, rounded to whole percent. Zero games → "0 games". No other UI.

## Matches tab

Flat list of `matchHistory`, newest first. Each row: court label + the two teams as buttons with the winner highlighted.

- Tap the losing team → winner flips to them (corrects a wrong tap; reversible).
- Small ✕ per row with confirm → deletes the record entirely (court state is unaffected — players already rotated).
- Removed: round grouping, "Sat out" line, and the W–L tally chips (now redundant with Players tab stats).

Empty state: "No games yet. Completed games appear here."

## Session setup & expenses

- "Courts" number field stays — it drives court cards/matchups only.
- "Court Amount (optional)" relabels to **"Total amount (optional)"** — a flat total for the whole session, split per participant in the Expenses modal (math unchanged).

## Standalone cost calculator

- 🧮 button in the session-list header, beside the theme toggle → modal.
- Inputs: default hourly rate + rows of `{ hours, courts, rate override? }`; rows addable/removable.
- Row subtotal = hours × courts × (override ?? default rate); grand total displayed.
- Last inputs persist to localStorage (`pickleball-calculator`).
- Fully standalone — no link to sessions; the organizer types the result into "Total amount" themselves.

## Storage

- `loadSessions()` keeps only sessions matching the new shape (`Array.isArray(matchHistory) && Array.isArray(queue)`); anything else is discarded. Existing sessions are wiped — accepted.
- Delete the entire legacy migration block (`LegacySession`, `LEGACY_SESSION_KEY`, time-slot parsing) from `storage.ts`.

## Session context / ops

`sessionOps.ts` gains pure ops (each unit-tested):

- `assignToCourt(session, candidate, court)` — validates players are still waiting; no-op if stale.
- `recordWin(session, court, winner)`
- `cancelGame(session, court)`
- `setGameWinner(session, gameId, winner)` — Matches tab correction (replaces round-based version)
- `deleteGame(session, gameId)`
- `checkIn` / `checkOut` — new queue semantics above
- `setPlaySystem` — dissolves holds per the single rule

`SessionContext` exposes these instead of `setMatchupState` / `setRoundHistory` / `setDeferredPlayerIds`.

`src/utils/matchups.ts` is deleted outright — generators, rotation helpers, and `computeWinLoss` are replaced by `suggestions.ts` (engine), ops above, and a small stats helper for the Players tab.

## Edge cases

- `numCourts` lowered while a game is live on a removed court: the card stays until the game ends (win or cancel), then the court disappears; it is never refilled.
- Ending a session freezes live games and holds as-is (read-only, not in history/stats); reopening resumes them.
- All candidate/assignment computation is deterministic — no randomness anywhere in the engine (testability).

## Testing

- **Engine** (`suggestions.test.ts`): ranking order per system, window bounds, ≤15 cap, split selection (repeat-partner then repeat-opponent tie-breaks), challenger pairs vs free-court foursomes, small pools (exactly 4, fewer than 4).
- **Ops** (`sessionOps.test.ts`): win-tap queue placement (losers then winners), challenge holdover creation/dissolution rule, cancel to queue front, check-out from each location, assign validation, winner flip, delete.
- **Storage**: old-shape sessions discarded; new-shape round-trips.
- **Components**: court card buttons record wins and free the court; assign creates the game and triggers scroll (`scrollIntoView` stubbed); suggestions hidden when pool too small; Matches flip/delete; Players stat sublines; calculator math + persistence; setup relabel.
- Rewrites: most of `matchups.test.ts` (file replaced by `suggestions.test.ts`), `MatchupsTab.test.tsx`, `MatchesTab.test.tsx`; smaller updates to `PlayersTab`, `SessionModal`, context and storage tests.

## Decisions & Deferrals

- **Flat total + courts count in session; slots × rate as standalone calculator** — richer per-court expense model rejected for in-session use; revisit if flat split stops matching reality.
- **Wipe old sessions, no migration** — Jason's call; data is disposable.
- **Keep all 3 play systems** — paddle queue stays, FIFO suggestions.
- **No web workers** — bounded enumeration is sub-ms; `useDeferredValue` first if it ever grows.
- **Up to 15 suggestions, never forced** — Jason wants breadth beyond top-3.
- **Deterministic engine (no shuffle)** — the ranked list replaces randomness; simplifies tests.
- **No copy button on calculator** (deferred) — add if typing totals over feels tedious.
- **No win-streak cap for challenge court** (deferred) — revisit if one team squats the court.
