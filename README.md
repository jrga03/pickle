# Pickle

A mobile-first PWA for managing pickleball open play sessions — handle matchups, track rounds, and split court expenses.

## Features

- **Session Setup** — Configure date, venue, court rates, and time slots with multiple courts
- **Player Management** — Add players with arrival/departure times, autocomplete from saved history
- **Matchup Generation** — Three play systems:
  - **Paddle Queue** — First 4 play, rest wait in line
  - **Challenge Court** — Winners stay on, losers rotate out
  - **Round Robin** — Minimizes repeat partnerships
- **Expense Splitting** — Pro-rata court cost calculation based on each player's time on court
- **PWA** — Installable, works offline, dark mode support
- **Local Storage** — All data stays on your device

## Tech Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 4
- Vitest + Testing Library
- vite-plugin-pwa

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── components/       # React components (tabs, UI)
├── context/          # SessionContext (central state)
├── utils/            # Business logic
│   ├── matchups.ts   # Game generation algorithms
│   ├── expenses.ts   # Cost splitting calculations
│   └── storage.ts    # LocalStorage persistence
├── types.ts          # TypeScript interfaces
├── App.tsx           # Main app
└── main.tsx          # Entry point
```

## License

MIT
