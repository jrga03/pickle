import type { CompletedGame } from '../types'

export interface PlayerStats { games: number; wins: number; losses: number }

export function computePlayerStats(history: CompletedGame[]): Map<string, PlayerStats> {
  const stats = new Map<string, PlayerStats>()
  const get = (id: string): PlayerStats => {
    let s = stats.get(id)
    if (!s) {
      s = { games: 0, wins: 0, losses: 0 }
      stats.set(id, s)
    }
    return s
  }
  for (const g of history) {
    const winners = g.winner === 1 ? g.team1 : g.team2
    const losers = g.winner === 1 ? g.team2 : g.team1
    for (const id of winners) {
      const s = get(id); s.games++; s.wins++
    }
    for (const id of losers) {
      const s = get(id); s.games++; s.losses++
    }
  }
  return stats
}

function samePair(a: [string, string], b: [string, string]): boolean {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0])
}

export function winStreak(
  history: CompletedGame[],
  court: number,
  pair: [string, string],
): number {
  let streak = 0
  for (let i = history.length - 1; i >= 0; i--) {
    const g = history[i]
    if (g.court !== court) continue
    const winners = g.winner === 1 ? g.team1 : g.team2
    if (samePair(winners, pair)) streak++
    else break
  }
  return streak
}
