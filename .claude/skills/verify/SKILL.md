---
name: verify
description: Use when a Pickle change needs to be confirmed working in the real browser GUI — launching, screenshotting, or driving the app end-to-end
---

# Verifying Pickle

Mobile-first React 19 + Vite PWA, localStorage-only, no backend. Surface is the browser GUI. Sessions are **games-first**: court cards + ranked suggestions + a waiting queue (no rounds, no auto-generate).

## Launch

```bash
npm run dev          # background; serves http://localhost:5173
```

Vite dev serves index.html for any path, so `/session/:id` deep links work without extra config. The PWA service worker is NOT active in dev — no SW interference.

## Drive

Playwright with the system Chrome (no browser download needed):

```js
import { chromium } from 'playwright'   // npm i playwright in a scratch dir
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }) // mobile-first
```

- Grant `['clipboard-write', 'clipboard-read']` on the context to exercise the expenses Share button.
- Seed/inspect state via `page.evaluate` on `localStorage`: `pickleball-sessions` (array), `pickleball-venues`, `pickleball-players`, `pickleball-calculator`. There is **no legacy migration** — `loadSessions()` silently discards anything not matching the games-first shape (`liveGames`/`matchHistory`/`queue`/`courtWinners` fields). Seed new-shape objects only; easiest is building state through the UI.
- `window.confirm` (session delete, game cancel/delete) → handle with `page.once('dialog', ...)`.

## Flows worth driving

1. Create session: "+ New Session" button → modal (Date, Venue, Courts, "Total amount", play system — defaults to Paddle Queue — and players) → "Create Session" auto-navigates to `/session/:id`, landing on the Players tab.
2. Players tab check-in (fills the queue) → Matchups tab: "Up Next" ranked suggestions, each with per-court "Assign to Court N" buttons → assigning creates a live court card and smooth-scrolls to top → "Team 1 Wins"/"Team 2 Wins" frees the court (card returns to "Free"; paddle queue / round robin), or winners hold it with a streak line and a "Challengers · Court N" list (challenge court). Cancel ✕ returns players to the queue unrecorded.
3. Matches tab: flat list newest-first; tapping the losing team flips the winner; row ✕ deletes after confirm.
4. Players tab stat sublines: "1 game · 1W–0L · 100%" / "3 games · 2W–1L · 67%" / "0 games" (unit singularizes at 1 — don't regex `\d+ games` blindly).
5. Expenses modal math (flat split of Total amount across participated players).
6. Calculator: 🧮 button in the session-list header → opens with one empty row; default rate + rows of hours × courts × (rate override ?? default) → row subtotals + grand total; inputs persist to `pickleball-calculator`.
7. End → read-only sweep (system switcher disabled; win/assign/cancel/check-in controls hidden; Matches team buttons disabled; Expenses stays editable) → Reopen.
8. Probes: unknown `/session/id` redirects to `/`; browser back; deep-link reload; delete confirm dismiss/accept.

## Key controls (verified names)

- New Session modal: players via placeholder-`Player name` input + "Add" (`exact: true` — collides with the calculator's "+ Add row"); amount input aria-label "Total Amount"; submit "Create Session".
- Players tab: per-row "Check in" ↔ "Check out" buttons; counter text "N of M checked in".
- Detail tabs are plain buttons ("Players"/"Matchups"/"Matches") in the bottom nav — `getByRole('tab')` finds nothing.
- Header aria-labels: "Edit session", "Expenses", "Back to sessions" (detail); "Court cost calculator" (list).
- Calculator inputs: "Default hourly rate", "Hours", "Courts", "Rate override"; buttons "+ Add row", "Remove row".
- Stable hooks: suggestion cards `data-testid="suggestion"`, court cards `div[data-court="N"]`, match rows `data-testid="game-row"`; destructive ✕ aria-labels "Cancel game on court N", "Delete game on court N".

## Gotchas

- `getByText` substring-matches by default: "Total: 1400.00" also hits "Subtotal: 1400.00" in the calculator — use `exact: true` on totals. Same for short button names ('Edit'/'End'/'Add').
- Team text joins names with " & "; the winning team's button ends with " ✓".
- To assert the post-assign smooth scroll: scroll to the bottom first, then compare `document.scrollingElement.scrollTop` before/after with ~900ms settle time.
