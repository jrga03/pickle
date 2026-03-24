# Saved Venues & Players Design

## Problem

Every new session starts from scratch — no memory of courts or players. Users typically play with the same people at the same venues and want quick selection.

## Solution

Persist venues and players in localStorage. Enhance existing Setup and Players tabs with autocomplete inputs that suggest from saved data.

## Data Model

Two new localStorage keys alongside existing `pickleball-session`:

**`pickleball-venues`** — Array of saved venues:
```typescript
interface SavedVenue {
  id: string
  name: string
  defaultRate: number // cents
}
```

**`pickleball-players`** — Array of saved players:
```typescript
interface SavedPlayer {
  id: string
  name: string
}
```

Players store names only — arrival/departure times are session-specific.

## UI Changes

### Setup Tab — Venue Autocomplete

- Replace plain venue text input with autocomplete input.
- Typing filters saved venues in a dropdown.
- Selecting a saved venue fills in venue name AND default rate.
- Free-typing a new venue name still works.
- "Save" button/icon next to venue input saves current venue + rate (or updates existing match).
- Each autocomplete suggestion row has an X icon to delete the saved venue.

### Players Tab — Player Autocomplete

- Replace plain "add player" input with autocomplete input.
- Typing filters saved players in a dropdown.
- Selecting a saved player adds them to the session.
- Typing a new name and submitting both adds to session AND auto-saves to known players list.
- Already-added session players are excluded from suggestions.
- Each autocomplete suggestion row has an X icon to delete the saved player.

## Storage

- Same localStorage pattern as existing session storage.
- New utility functions in `storage.ts` for load/save of venues and players.
- No migration needed — new keys, not modifications to existing schema.

## What This Does NOT Include

- Cross-device sync
- Player groups/presets
- Default arrival/departure times per player
- Time slot templates per venue
