# Matchups Tab Redesign & UUID Bug Fix

## Problem

1. Player status controls (active/deferred/left) are in the Players tab but belong in Matchups
2. Matchups tab shows raw UUIDs instead of player names — stale localStorage data from a data model migration

## Design

### Players Tab (simplified)

Each player row shows only:
- Player name
- Time slot (arrival/departure)
- Remove button

No status badges. Status management moves entirely to Matchups.

### Matchups Tab (restructured)

#### Roster Section (top)

A player list at the top of the Matchups tab with two statuses:
- **Active** (green) — player is in the matchup pool
- **Left** (gray) — player has left and is excluded from matchup generation

Clicking a player's status toggles between active and left.

#### Court Matchups (below roster)

Each matched player name has a **"Defer"** button. When clicked:
1. The deferred player is removed from the current matchup
2. The first player in the sitting-out list automatically replaces them
3. The deferred player is added to `deferredPlayerIds` — guaranteeing them a spot in the next round

When the next round is generated:
1. Deferred players are placed first (guaranteed inclusion)
2. Remaining spots filled normally from the active pool
3. `deferredPlayerIds` is cleared — deferred players return to normal active status

### Data Model Changes

#### PlayerStatus type
Change from `'active' | 'deferred' | 'left'` to `'active' | 'left'`.

#### Session type
Add `deferredPlayerIds: string[]` — persisted in localStorage so it survives page refresh.

#### Storage migration
Add migration in `loadSession()` to:
- Convert any `status: 'deferred'` players to `status: 'active'`
- Initialize `deferredPlayerIds: []` if missing

### UUID Bug Fix

The `getName()` fallback logic in MatchupsTab is correct — it builds a `playerNameMap` from `session.players` and falls back to showing the raw ID. The bug is stale localStorage data where player IDs in rounds don't match current player entries.

Fix: clear rounds on session load if player IDs in rounds don't exist in the players list, or provide a "clear rounds" action. The simplest fix is to reset rounds when the data is inconsistent.

### Matchup Generation Changes

All three generators (paddle-queue, round-robin, challenge-court) need to:
1. Accept `deferredPlayerIds` as a parameter
2. Place deferred players first when filling courts
3. Fill remaining spots with the rest of the active pool

After generation, `deferredPlayerIds` is cleared.
