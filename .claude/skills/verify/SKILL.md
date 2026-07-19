---
name: verify
description: Build/launch/drive recipe for verifying Pickle (React PWA) changes end-to-end in a real browser
---

# Verifying Pickle

Mobile-first React 19 + Vite PWA, localStorage-only, no backend. Surface is the browser GUI.

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
- Seed/inspect state via `page.evaluate` on `localStorage`: `pickleball-sessions` (array), `pickleball-venues`, `pickleball-players`. Legacy migration triggers only when `pickleball-sessions` is absent and legacy `pickleball-session` exists — use `addInitScript` with a run-once guard, or a dedicated context.
- `window.confirm` (session delete) → handle with `page.once('dialog', ...)`.

## Flows worth driving

1. Legacy migration: seed old key → list shows migrated card; sessions key written, legacy key removed.
2. Create session (+ New Session modal) → auto-navigates to `/session/:id`.
3. Players check-in → Matchups Generate/Next Round → Matches winner tap + tally.
4. Expenses modal math (flat split excludes never-checked-in roster players).
5. End → read-only sweep (no Generate/check-in/winner taps, selector disabled; Expenses stays editable) → Reopen.
6. Probes: unknown `/session/id` redirects to `/`; browser back; deep-link reload; delete confirm dismiss/accept.

## Gotchas

- Button names collide: use `exact: true` for 'Edit'/'End'/'Add'; header actions are aria-labels ("Edit session", "Expenses", "Back to sessions").
- Winner team buttons match `/ & /` (player names joined with " & ").
