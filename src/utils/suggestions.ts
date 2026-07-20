import type { CompletedGame, PlaySystem } from '../types'

export interface Candidate {
  team1: [string, string]
  team2: [string, string]
}

export const MAX_SUGGESTIONS = 15
const FIFO_WINDOW = 6      // C(6,4) = 15 foursomes, C(6,2) = 15 pairs
const FAIRNESS_WINDOW = 10 // C(10,4) = 210 foursomes scored for round robin

export function gamesPlayedMap(history: CompletedGame[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const g of history) {
    for (const id of [...g.team1, ...g.team2]) {
      map.set(id, (map.get(id) ?? 0) + 1)
    }
  }
  return map
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

function partnerCounts(history: CompletedGame[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const g of history) {
    for (const [a, b] of [g.team1, g.team2]) {
      const key = pairKey(a, b)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
  }
  return map
}

function opponentCounts(history: CompletedGame[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const g of history) {
    for (const a of g.team1) {
      for (const b of g.team2) {
        const key = pairKey(a, b)
        map.set(key, (map.get(key) ?? 0) + 1)
      }
    }
  }
  return map
}

function combinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = []
  const combo: T[] = []
  const walk = (start: number) => {
    if (combo.length === k) {
      result.push([...combo])
      return
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i])
      walk(i + 1)
      combo.pop()
    }
  }
  walk(0)
  return result
}

// true when a sorts strictly before b, comparing element by element
function lexLess(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i]
  }
  return false
}

function splits(four: string[]): Candidate[] {
  const [a, b, c, d] = four
  return [
    { team1: [a, b], team2: [c, d] },
    { team1: [a, c], team2: [b, d] },
    { team1: [a, d], team2: [b, c] },
  ]
}

function bestSplit(
  four: string[],
  partners: Map<string, number>,
  opponents: Map<string, number>,
): Candidate {
  let best: Candidate = splits(four)[0]
  let bestScore: number[] | null = null
  splits(four).forEach((split, index) => {
    const partnerRepeats =
      (partners.get(pairKey(split.team1[0], split.team1[1])) ?? 0) +
      (partners.get(pairKey(split.team2[0], split.team2[1])) ?? 0)
    let opponentRepeats = 0
    for (const a of split.team1) {
      for (const b of split.team2) {
        opponentRepeats += opponents.get(pairKey(a, b)) ?? 0
      }
    }
    const score = [partnerRepeats, opponentRepeats, index]
    if (bestScore === null || lexLess(score, bestScore)) {
      bestScore = score
      best = split
    }
  })
  return best
}

export function suggestFoursomes(
  queue: string[],
  history: CompletedGame[],
  playSystem: PlaySystem,
): Candidate[] {
  if (queue.length < 4) return []
  const queueIndex = new Map(queue.map((id, i) => [id, i]))
  const games = gamesPlayedMap(history)

  let window: string[]
  if (playSystem === 'round-robin') {
    window = [...queue]
      .sort((a, b) =>
        (games.get(a) ?? 0) - (games.get(b) ?? 0) ||
        queueIndex.get(a)! - queueIndex.get(b)!)
      .slice(0, FAIRNESS_WINDOW)
  } else {
    window = queue.slice(0, FIFO_WINDOW)
  }

  const scored = combinations(window, 4).map(four => {
    const waitScore = four.reduce((sum, id) => sum + queueIndex.get(id)!, 0)
    const gameScore = four.reduce((sum, id) => sum + (games.get(id) ?? 0), 0)
    return {
      four,
      score: playSystem === 'round-robin' ? [gameScore, waitScore] : [waitScore],
    }
  })
  scored.sort((x, y) => (lexLess(x.score, y.score) ? -1 : lexLess(y.score, x.score) ? 1 : 0))

  const partners = partnerCounts(history)
  const opponents = opponentCounts(history)

  return scored.slice(0, MAX_SUGGESTIONS).map(({ four }) => {
    if (playSystem === 'round-robin') return bestSplit(four, partners, opponents)
    const ordered = [...four].sort((a, b) => queueIndex.get(a)! - queueIndex.get(b)!)
    return {
      team1: [ordered[0], ordered[1]] as [string, string],
      team2: [ordered[2], ordered[3]] as [string, string],
    }
  })
}

export function suggestChallengers(
  queue: string[],
  winners: [string, string],
): Candidate[] {
  if (queue.length < 2) return []
  const window = queue.slice(0, FIFO_WINDOW)
  const index = new Map(window.map((id, i) => [id, i]))
  const pairs = combinations(window, 2)
    .sort((p, q) =>
      (index.get(p[0])! + index.get(p[1])!) - (index.get(q[0])! + index.get(q[1])!))
  return pairs.slice(0, MAX_SUGGESTIONS).map(pair => ({
    team1: [winners[0], winners[1]] as [string, string],
    team2: [pair[0], pair[1]] as [string, string],
  }))
}
