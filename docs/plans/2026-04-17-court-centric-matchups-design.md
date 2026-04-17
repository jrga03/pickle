# Court-Centric Matchup System Redesign

## Problem

Three issues with the current matchup system:

1. **No per-court rotation** — "Next Round" advances all courts simultaneously, but games don't end at the same time
2. **No matchup overrides** — no way to manually rearrange players after matchups are generated
3. **Poor player add/remove handling** — removing a player leaves dangling UUIDs in matchup data; adding a player mid-session doesn't integrate them into the current queue

## Approach

Shift from a round-centric model (`Round[]` where the last entry is live state) to a court-centric model with explicit live state and history separation.

## Data Model

```typescript
interface MatchupState {
  games: Game[]         // one per active court
  sittingOut: string[]  // shared queue
}

// Round stays the same — used for history snapshots
interface Round {
  id: string
  games: Game[]
  sittingOut: string[]
}

interface Session {
  // existing fields unchanged...

  // Replaces: rounds: Round[]
  matchupState: MatchupState | null  // null = no matchups generated yet
  roundHistory: Round[]              // previous full-round snapshots
  deferredPlayerIds: string[]        // unchanged
}
```

**Migration:** `loadSession()` converts old `rounds[]` — last round becomes `matchupState`, rest become `roundHistory`.

## Per-Court Rotation

Applies to **paddle queue** and **challenge court** only. Round robin keeps all-at-once behavior.

### UI

- Each court card gets a **"Next"** button to rotate just that court
- Each court card gets a **"Re-roll"** button to rearrange the 4 players into a different team configuration
- "Next Round" button remains for rotating all courts at once (snapshots to history first)
- "Reshuffle" button remains for global reshuffle of all courts

### Single-court rotation logic

1. Take the 4 players from the court
2. Append them to the end of `sittingOut` queue
3. Pull the next 4 from the front of `sittingOut`
4. If fewer than 4 available, fill what we can — court stays short-handed
5. Update `matchupState` in place — no snapshot to `roundHistory`

### Challenge court single-court rotation

- User selects winning team before hitting "Next"
- Winners stay on court, losers go to back of queue
- 2 new players pulled from front of queue

### "Next Round" (all courts)

- Snapshots current `matchupState` into `roundHistory`
- Paddle queue: generates fresh matchups for all courts from full active player pool
- Challenge court: rotates all courts using winners-stay logic
- Round robin: same as today (algorithm uses `roundHistory` for partner tracking)

## Matchup Overrides (Edit Mode)

### Entering/exiting

- "Edit" button next to current matchup heading
- Visual state change (dashed borders or similar) to indicate edit mode
- "Cancel" discards changes, "Save" commits them

### In edit mode

- Tap two players to swap them (mobile-friendly)
- Players can be swapped between: team 1 slots, team 2 slots (any court), and the sitting-out queue

### On save

- `matchupState` replaced with edited arrangement
- `roundHistory` cleared (round robin partner tracking resets)
- `deferredPlayerIds` cleared
- System treats this as a clean slate

### Implementation

- Edit mode uses local component state (`useState`) for the draft
- Only on save does it write to session context
- Keeps ephemeral state isolated, cancellation trivial

## Player Add/Remove

### Adding a player mid-session (matchups exist)

- Player added to `session.players` as usual (status: `active`)
- Appended to end of `matchupState.sittingOut`

### Removing a player mid-session

Three cases:

1. **Sitting out** — remove from `sittingOut` queue
2. **On court, someone sitting out** — first person from `sittingOut` replaces them (same team, same slot)
3. **On court, nobody sitting out** — removed, court becomes short-handed (visually flagged)

### Toggling player status (active <-> left) on roster

- Marking "left" = same as removing from matchups
- Marking "active" again = same as adding (goes to end of queue)

### Migration cleanup

- Remove the `loadSession` logic that nukes all rounds on stale player IDs
- Replace with graceful handling: remove stale IDs from wherever they appear in `matchupState`

## Play System Taglines

Displayed below the mode tab selector:

- **Paddle Queue**: "Next in line plays next"
- **Challenge Court**: "Winners stay, losers rotate"
- **Round Robin**: "Everyone plays with everyone"

## Testing Strategy

### Per-court rotation

- Rotate single court: 4 players go to back of queue, next 4 from front fill court
- Rotate with partial queue (e.g., only 2 in queue): court gets partial fill, 2 remaining go to queue
- Rotate with empty queue: all 4 go to queue, court becomes empty
- Challenge court rotation: winners stay, losers go to queue, 2 pulled from front
- Challenge court rotation with no winners selected: all 4 rotate out
- All-courts rotation: snapshots to history, then rotates all
- All-courts rotation preserves queue order for deferred players
- Re-roll single court: same 4 players, different team arrangement
- Re-roll produces a different arrangement than current

### Matchup overrides

- Save override: replaces matchup state correctly
- Save override: clears round history
- Save override: clears deferred player IDs
- Cancel override: no state changes whatsoever
- Swap two players on same court: teams updated correctly
- Swap player on court with player sitting out: both positions updated
- Swap two players on different courts: both courts updated

### Player add/remove

- Add player when no matchups: player added to players list only
- Add player mid-session: appended to end of sitting out queue
- Remove player from sitting out (beginning, middle, end of queue): queue order preserved
- Remove player from court with queue available: replacement comes from front of queue
- Remove player from court with empty queue: court becomes short-handed (3 players)
- Remove player from court already short-handed: court becomes even shorter
- Remove last player from a court: court becomes empty
- Toggle player to "left" then back to "active": removed then re-added to end of queue
- Add multiple players mid-session: all appended in order
- Remove multiple players: each handled independently

### Round robin continuity

- Next round avoids repeat partnerships from round history
- Override save clears history, subsequent rounds start fresh (no partner avoidance from before)
- Round history accumulates correctly across multiple "Next Round" clicks

### Edge cases

- Generate matchups with exactly 4 players (1 court, 0 sitting out)
- Generate matchups with 5 players (1 court, 1 sitting out)
- Generate matchups with fewer than 4 players: should not generate
- Rotate court when all other courts are also mid-game
- Multiple sequential single-court rotations: queue stays consistent
- Remove player who is in deferred list: also removed from deferred
- Add player, immediately remove before any rotation: clean removal from queue
- Switch play system mid-session (existing matchups): matchup state preserved, behavior changes
- Session with 0 courts configured: fallback to 1
- Re-roll court with only 4 total players (no sitting out): just rearrange teams
