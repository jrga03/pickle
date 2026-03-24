# Saved Venues & Players Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist venues and players in localStorage so users can quickly select from saved entries via autocomplete on the Setup and Players tabs.

**Architecture:** Two new localStorage collections (`pickleball-venues`, `pickleball-players`) with CRUD functions in `storage.ts`. A reusable `Autocomplete` component handles the dropdown + delete UX. SetupTab gets venue autocomplete with a save button; PlayersTab gets player autocomplete that auto-saves new names.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest, localStorage

---

### Task 1: Add SavedVenue and SavedPlayer types

**Files:**
- Modify: `src/types.ts:41` (append after Session interface)

**Step 1: Add the types**

Append to the end of `src/types.ts`:

```typescript
export interface SavedVenue {
  id: string
  name: string
  defaultRate: number
}

export interface SavedPlayer {
  id: string
  name: string
}
```

**Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add SavedVenue and SavedPlayer types"
```

---

### Task 2: Add storage functions for saved venues and players

**Files:**
- Modify: `src/utils/storage.ts`
- Test: `src/utils/__tests__/storage.test.ts`

**Step 1: Write failing tests**

Add to `src/utils/__tests__/storage.test.ts`:

```typescript
import { saveVenues, loadVenues, savePlayers, loadPlayers } from '../storage'
import type { SavedVenue, SavedPlayer } from '../../types'

describe('venue storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty array when no venues saved', () => {
    expect(loadVenues()).toEqual([])
  })

  it('saves and loads venues', () => {
    const venues: SavedVenue[] = [
      { id: '1', name: 'BGC Courts', defaultRate: 500 },
    ]
    saveVenues(venues)
    expect(loadVenues()).toEqual(venues)
  })
})

describe('player storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty array when no players saved', () => {
    expect(loadPlayers()).toEqual([])
  })

  it('saves and loads players', () => {
    const players: SavedPlayer[] = [
      { id: '1', name: 'Jason' },
    ]
    savePlayers(players)
    expect(loadPlayers()).toEqual(players)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/__tests__/storage.test.ts`
Expected: FAIL — functions not exported

**Step 3: Implement storage functions**

Add to `src/utils/storage.ts`:

```typescript
import type { Session, SavedVenue, SavedPlayer } from '../types'

const VENUES_KEY = 'pickleball-venues'
const PLAYERS_KEY = 'pickleball-players'

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

Also update the existing import to include new types:
```typescript
import type { Session, SavedVenue, SavedPlayer } from '../types'
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/__tests__/storage.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/storage.ts src/utils/__tests__/storage.test.ts
git commit -m "feat: add localStorage CRUD for saved venues and players"
```

---

### Task 3: Build Autocomplete component

**Files:**
- Create: `src/components/Autocomplete.tsx`
- Test: `src/components/__tests__/Autocomplete.test.tsx`

**Step 1: Write failing tests**

Create `src/components/__tests__/Autocomplete.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Autocomplete } from '../Autocomplete'

describe('Autocomplete', () => {
  const suggestions = [
    { id: '1', label: 'Jason' },
    { id: '2', label: 'Mike' },
    { id: '3', label: 'Sarah' },
  ]

  it('shows filtered suggestions when typing', async () => {
    const user = userEvent.setup()
    render(
      <Autocomplete
        suggestions={suggestions}
        onSelect={vi.fn()}
        onSubmit={vi.fn()}
        onDelete={vi.fn()}
        placeholder="Player name"
      />
    )

    await user.type(screen.getByPlaceholderText('Player name'), 'ja')
    expect(screen.getByText('Jason')).toBeInTheDocument()
    expect(screen.queryByText('Mike')).not.toBeInTheDocument()
  })

  it('calls onSelect when clicking a suggestion', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <Autocomplete
        suggestions={suggestions}
        onSelect={onSelect}
        onSubmit={vi.fn()}
        onDelete={vi.fn()}
        placeholder="Player name"
      />
    )

    await user.type(screen.getByPlaceholderText('Player name'), 'ja')
    await user.click(screen.getByText('Jason'))
    expect(onSelect).toHaveBeenCalledWith({ id: '1', label: 'Jason' })
  })

  it('calls onSubmit with text value on Enter', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Autocomplete
        suggestions={suggestions}
        onSelect={vi.fn()}
        onSubmit={onSubmit}
        onDelete={vi.fn()}
        placeholder="Player name"
      />
    )

    await user.type(screen.getByPlaceholderText('Player name'), 'NewPlayer{Enter}')
    expect(onSubmit).toHaveBeenCalledWith('NewPlayer')
  })

  it('calls onDelete when clicking X on a suggestion', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(
      <Autocomplete
        suggestions={suggestions}
        onSelect={vi.fn()}
        onSubmit={vi.fn()}
        onDelete={onDelete}
        placeholder="Player name"
      />
    )

    await user.type(screen.getByPlaceholderText('Player name'), 'ja')
    await user.click(screen.getByLabelText('Delete Jason'))
    expect(onDelete).toHaveBeenCalledWith('1')
  })

  it('clears input after selecting a suggestion', async () => {
    const user = userEvent.setup()
    render(
      <Autocomplete
        suggestions={suggestions}
        onSelect={vi.fn()}
        onSubmit={vi.fn()}
        onDelete={vi.fn()}
        placeholder="Player name"
      />
    )

    await user.type(screen.getByPlaceholderText('Player name'), 'ja')
    await user.click(screen.getByText('Jason'))
    expect(screen.getByPlaceholderText('Player name')).toHaveValue('')
  })

  it('hides suggestions when input is empty', () => {
    render(
      <Autocomplete
        suggestions={suggestions}
        onSelect={vi.fn()}
        onSubmit={vi.fn()}
        onDelete={vi.fn()}
        placeholder="Player name"
      />
    )

    expect(screen.queryByText('Jason')).not.toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/Autocomplete.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement the Autocomplete component**

Create `src/components/Autocomplete.tsx`:

```typescript
import { useState, useRef } from 'react'

export interface AutocompleteSuggestion {
  id: string
  label: string
}

interface AutocompleteProps {
  suggestions: AutocompleteSuggestion[]
  onSelect: (item: AutocompleteSuggestion) => void
  onSubmit: (value: string) => void
  onDelete: (id: string) => void
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
}

export function Autocomplete({
  suggestions,
  onSelect,
  onSubmit,
  onDelete,
  placeholder,
  value: controlledValue,
  onChange,
}: AutocompleteProps) {
  const [internalValue, setInternalValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const value = controlledValue ?? internalValue
  const setValue = (v: string) => {
    if (onChange) onChange(v)
    else setInternalValue(v)
  }

  const filtered = value.trim()
    ? suggestions.filter(s =>
        s.label.toLowerCase().includes(value.toLowerCase())
      )
    : []

  const handleSelect = (item: AutocompleteSuggestion) => {
    onSelect(item)
    setValue('')
    setShowSuggestions(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const trimmed = value.trim()
      if (!trimmed) return
      // If there's an exact match in filtered, select it
      const exact = filtered.find(
        s => s.label.toLowerCase() === trimmed.toLowerCase()
      )
      if (exact) {
        handleSelect(exact)
      } else {
        onSubmit(trimmed)
        setValue('')
        setShowSuggestions(false)
      }
    }
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    onDelete(id)
  }

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => {
          setValue(e.target.value)
          setShowSuggestions(true)
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => {
          // Delay to allow click on suggestion
          setTimeout(() => setShowSuggestions(false), 200)
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base"
      />
      {showSuggestions && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(item => (
            <li
              key={item.id}
              className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 cursor-pointer min-h-[44px]"
              onMouseDown={() => handleSelect(item)}
            >
              <span className="text-gray-900">{item.label}</span>
              <button
                onMouseDown={e => handleDelete(e, item.id)}
                className="text-gray-400 hover:text-red-500 p-1 min-h-[32px] min-w-[32px] flex items-center justify-center"
                aria-label={`Delete ${item.label}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/Autocomplete.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/Autocomplete.tsx src/components/__tests__/Autocomplete.test.tsx
git commit -m "feat: add reusable Autocomplete component with delete"
```

---

### Task 4: Integrate venue autocomplete into SetupTab

**Files:**
- Modify: `src/components/SetupTab.tsx`

**Step 1: Add venue autocomplete to SetupTab**

In `SetupTab.tsx`, add state and handlers for saved venues, then replace the plain venue `<input>` with the `Autocomplete` component plus a save button.

Key changes:
- Import `Autocomplete` and storage functions
- Load saved venues on mount with `useState(() => loadVenues())`
- Replace the venue `<input>` (lines 62-69) with `<Autocomplete>` that:
  - Maps `savedVenues` to `{ id, label: name }` suggestions
  - `onSelect`: sets venue name + default rate from saved venue
  - `onChange`: calls `setVenue` (controlled mode, using `session.venue` as value)
  - `onSubmit`: calls `setVenue` (for Enter key)
  - `onDelete`: removes venue from saved list and persists
- Add a "Save" button next to the autocomplete that saves current venue + rate

```typescript
import { useState } from 'react'
import { useSession } from '../context/SessionContext'
import { Autocomplete } from './Autocomplete'
import { loadVenues, saveVenues } from '../utils/storage'
import type { SavedVenue } from '../types'

// Inside SetupTab component:
const [savedVenues, setSavedVenues] = useState<SavedVenue[]>(() => loadVenues())

const handleSelectVenue = (item: { id: string; label: string }) => {
  const venue = savedVenues.find(v => v.id === item.id)
  if (venue) {
    setVenue(venue.name)
    setDefaultRate(venue.defaultRate)
  }
}

const handleDeleteVenue = (id: string) => {
  const updated = savedVenues.filter(v => v.id !== id)
  setSavedVenues(updated)
  saveVenues(updated)
}

const handleSaveVenue = () => {
  if (!session.venue.trim()) return
  const existing = savedVenues.find(
    v => v.name.toLowerCase() === session.venue.toLowerCase()
  )
  let updated: SavedVenue[]
  if (existing) {
    updated = savedVenues.map(v =>
      v.id === existing.id ? { ...v, defaultRate: session.defaultRate } : v
    )
  } else {
    updated = [...savedVenues, {
      id: crypto.randomUUID(),
      name: session.venue,
      defaultRate: session.defaultRate,
    }]
  }
  setSavedVenues(updated)
  saveVenues(updated)
}
```

Replace the venue label/input block (lines 61-69) with:

```tsx
<div className="block">
  <span className="text-sm font-medium text-gray-700">Venue (optional)</span>
  <div className="mt-1 flex gap-2">
    <Autocomplete
      suggestions={savedVenues.map(v => ({ id: v.id, label: v.name }))}
      onSelect={handleSelectVenue}
      onSubmit={val => setVenue(val)}
      onDelete={handleDeleteVenue}
      placeholder="e.g. BGC Courts"
      value={session.venue}
      onChange={setVenue}
    />
    <button
      onClick={handleSaveVenue}
      disabled={!session.venue.trim()}
      className="rounded-lg border border-green-600 text-green-600 px-3 py-2.5 text-sm font-medium disabled:opacity-50 min-h-[44px]"
    >
      Save
    </button>
  </div>
</div>
```

**Step 2: Manually test in browser**

Run: `npx vite dev`
- Type a venue name → autocomplete shows matches
- Select a saved venue → fills name + rate
- Click Save → venue persists across page reloads
- Click X on suggestion → venue is deleted

**Step 3: Commit**

```bash
git add src/components/SetupTab.tsx
git commit -m "feat: add venue autocomplete to SetupTab"
```

---

### Task 5: Integrate player autocomplete into PlayersTab

**Files:**
- Modify: `src/components/PlayersTab.tsx`

**Step 1: Add player autocomplete to PlayersTab**

Key changes:
- Import `Autocomplete` and storage functions
- Load saved players on mount: `useState(() => loadPlayers())`
- Replace the player name `<input>` + Add button (lines 80-96) with `<Autocomplete>` + Add button that:
  - Filters out already-added session players from suggestions
  - `onSelect`: calls `addPlayer(item.label)` to add existing saved player to session
  - `onSubmit`: calls `addPlayer(value)` AND auto-saves new player to saved list
  - `onDelete`: removes player from saved list and persists
- Keep the Add button — it calls `onSubmit` with current input value

```typescript
import { Autocomplete } from './Autocomplete'
import { loadPlayers, savePlayers } from '../utils/storage'
import type { SavedPlayer } from '../types'

// Inside PlayersTab component:
const [savedPlayers, setSavedPlayers] = useState<SavedPlayer[]>(() => loadPlayers())
const [playerInput, setPlayerInput] = useState('')

// Filter out players already in the session
const availableSuggestions = savedPlayers
  .filter(sp => !session.players.some(
    p => p.name.toLowerCase() === sp.name.toLowerCase()
  ))
  .map(sp => ({ id: sp.id, label: sp.name }))

const handleSelectPlayer = (item: { id: string; label: string }) => {
  addPlayer(item.label)
  setPlayerInput('')
}

const handleSubmitPlayer = (value: string) => {
  addPlayer(value)
  // Auto-save if not already in saved list
  if (!savedPlayers.some(sp => sp.name.toLowerCase() === value.toLowerCase())) {
    const updated = [...savedPlayers, { id: crypto.randomUUID(), name: value }]
    setSavedPlayers(updated)
    savePlayers(updated)
  }
  setPlayerInput('')
}

const handleDeleteSavedPlayer = (id: string) => {
  const updated = savedPlayers.filter(sp => sp.id !== id)
  setSavedPlayers(updated)
  savePlayers(updated)
}
```

Replace the input + button block (lines 80-96) with:

```tsx
<div className="flex gap-2">
  <Autocomplete
    suggestions={availableSuggestions}
    onSelect={handleSelectPlayer}
    onSubmit={handleSubmitPlayer}
    onDelete={handleDeleteSavedPlayer}
    placeholder="Player name"
    value={playerInput}
    onChange={setPlayerInput}
  />
  <button
    onClick={() => {
      if (playerInput.trim()) handleSubmitPlayer(playerInput.trim())
    }}
    disabled={!playerInput.trim()}
    className="rounded-lg bg-green-600 text-white px-4 py-2.5 text-sm font-medium disabled:opacity-50 min-h-[44px]"
  >
    Add
  </button>
</div>
```

Also remove the old `name` state and `handleAdd`/`handleKeyDown` functions since `Autocomplete` handles that now.

**Step 2: Manually test in browser**

Run: `npx vite dev`
- Add a new player "Jason" → appears in session AND saved for future
- Start new session → type "Ja" → "Jason" appears in autocomplete
- Select "Jason" → added to session, disappears from suggestions
- Click X on a suggestion → player removed from saved list

**Step 3: Commit**

```bash
git add src/components/PlayersTab.tsx
git commit -m "feat: add player autocomplete to PlayersTab with auto-save"
```

---

### Task 6: Run full test suite and fix any issues

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Fix any failures**

Address any test failures from the changes above.

**Step 3: Commit if fixes were needed**

```bash
git add -A
git commit -m "fix: resolve test failures from autocomplete integration"
```
