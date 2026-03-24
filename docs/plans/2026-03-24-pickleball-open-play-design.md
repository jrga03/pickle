# Pickleball Open Play App — Design Document

**Date:** 2026-03-24
**Status:** Approved

## Overview

A mobile-first PWA for managing pickleball open play sessions. The organizer creates a session on their phone, manages players and matchups, computes expenses, and shares the breakdown via Messenger. No backend, no auth — single-device, organizer-driven.

## Core Features

### 1. Session Setup
- Date, venue name (optional), default rate per court per hour
- Dynamic time slots: start/end time, number of courts, optional rate override
- Example: 1-2pm (1 court), 2-3pm (2 courts), 3-4pm (1 court)

### 2. Player Management
- Add players by name
- Set arrival time slot per player (defaults to first slot)
- Player status: **Active** | **Deferred** (skip current round) | **Left** (done for the day)
- Player count displayed per time slot

### 3. Matchups
- Pick open play system before generating:
  - **Paddle Queue** — random rotation, balanced play time
  - **Challenge Court** — winners stay, losers rotate out (organizer manually selects who stays)
  - **Round Robin** — cycle through partner/opponent combinations
- Generate matchups per round across available courts
- Sitting-out players shown when players exceed court capacity
- Controls: regenerate, swap players, manual adjust, "Next Round"
- Deferred players skip current round, auto-return to active next round

### 4. Expenses
- Auto-computed from time slots and player presence
- Each time slot cost = numCourts × rate × 1 hour
- Players present in a slot split that slot's cost equally
- Per-player total = sum of shares across all slots present
- "Share" button copies formatted text to clipboard for Messenger

## Data Model

```
Session
├── date
├── venue (optional)
├── defaultRate
├── timeSlots[]
│   ├── startTime
│   ├── endTime
│   ├── numCourts
│   └── rateOverride (optional)
├── players[]
│   ├── name
│   ├── arrivalSlot
│   └── status: "active" | "deferred" | "left"
└── rounds[]
    ├── timeSlot reference
    ├── games[]
    │   ├── court
    │   ├── team1: [player, player]
    │   └── team2: [player, player]
    └── sittingOut: [player, ...]
```

## UI/UX Principles

- **Mobile-first** — single-column layout, everything stacks vertically
- **Large touch targets** — minimum 44px height for all interactive elements
- **Bottom-anchored actions** — primary buttons pinned to bottom for thumb reach
- **Tap cycling for status** — Active → Deferred → Left, no dropdowns
- **Cards for matchups** — each court as a card with team lineups
- **Collapsible sections** — time slots and expense breakdowns collapse/expand
- **High contrast light theme** — readable outdoors in sunlight

## Tech Stack

- Vite + React + TypeScript
- vite-plugin-pwa (installable, offline support)
- Tailwind CSS (mobile-first styling)
- LocalStorage (session persistence)
- React Context (state management)
- No router — tab-based navigation via state

## Architecture

- **No backend** — all data in LocalStorage on the organizer's device
- **No auth** — organizer adds player names manually
- **Sharing** — clipboard copy of formatted expense text for Messenger
- **Offline capable** — PWA with service worker

## Expense Calculation Example

Rate: 500 PHP/hr/court

| Time Slot | Courts | Cost  | Players | Per Player |
|-----------|--------|-------|---------|------------|
| 1-2pm     | 1      | 500   | 6       | 83.33      |
| 2-3pm     | 2      | 1,000 | 7       | 142.86     |
| 3-4pm     | 1      | 500   | 4       | 125.00     |

Player present all 3 hours: 83.33 + 142.86 + 125.00 = **351.19 PHP**
