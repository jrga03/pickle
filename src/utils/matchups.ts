import type { Round, Game } from '../types'

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const generateId = () => crypto.randomUUID()

export function generatePaddleQueueRound(playerIds: string[], numCourts: number): Round {
  const shuffled = shuffle(playerIds)
  const games: Game[] = []
  const sittingOut: string[] = []

  const maxGames = Math.min(numCourts, Math.floor(shuffled.length / 4))

  for (let i = 0; i < maxGames; i++) {
    const offset = i * 4
    games.push({
      court: i + 1,
      team1: [shuffled[offset], shuffled[offset + 1]],
      team2: [shuffled[offset + 2], shuffled[offset + 3]],
    })
  }

  const playingCount = maxGames * 4
  for (let i = playingCount; i < shuffled.length; i++) {
    sittingOut.push(shuffled[i])
  }

  return { id: generateId(), games, sittingOut }
}

function getPartnerKey(a: string, b: string): string {
  return [a, b].sort().join(',')
}

function getPreviousPartners(
  previousRounds: { games: { team1: [string, string]; team2: [string, string] }[] }[],
): Set<string> {
  const partners = new Set<string>()
  for (const round of previousRounds) {
    for (const game of round.games) {
      partners.add(getPartnerKey(game.team1[0], game.team1[1]))
      partners.add(getPartnerKey(game.team2[0], game.team2[1]))
    }
  }
  return partners
}

export function generateRoundRobinRound(
  playerIds: string[],
  numCourts: number,
  previousRounds: { games: { team1: [string, string]; team2: [string, string] }[] }[],
): Round {
  const usedPartners = getPreviousPartners(previousRounds)
  const maxGames = Math.min(numCourts, Math.floor(playerIds.length / 4))

  let bestRound: Round | null = null
  let bestRepeats = Infinity

  for (let attempt = 0; attempt < 50; attempt++) {
    const shuffled = shuffle(playerIds)
    const games: Game[] = []
    const sittingOut: string[] = []
    let repeats = 0

    for (let i = 0; i < maxGames; i++) {
      const offset = i * 4
      const t1: [string, string] = [shuffled[offset], shuffled[offset + 1]]
      const t2: [string, string] = [shuffled[offset + 2], shuffled[offset + 3]]
      if (usedPartners.has(getPartnerKey(t1[0], t1[1]))) repeats++
      if (usedPartners.has(getPartnerKey(t2[0], t2[1]))) repeats++
      games.push({ court: i + 1, team1: t1, team2: t2 })
    }

    const playingCount = maxGames * 4
    for (let i = playingCount; i < shuffled.length; i++) {
      sittingOut.push(shuffled[i])
    }

    const round: Round = { id: generateId(), games, sittingOut }

    if (repeats < bestRepeats) {
      bestRepeats = repeats
      bestRound = round
    }
    if (repeats === 0) break
  }

  return bestRound!
}

export function generateChallengeCourtRound(
  playerIds: string[],
  numCourts: number,
  stayingPlayerIds: string[] = [],
): Round {
  const others = shuffle(playerIds.filter(id => !stayingPlayerIds.includes(id)))
  const staying = shuffle(stayingPlayerIds)
  const games: Game[] = []
  const sittingOut: string[] = []
  const maxGames = Math.min(numCourts, Math.floor(playerIds.length / 4))

  let otherIdx = 0
  let stayIdx = 0

  for (let i = 0; i < maxGames; i++) {
    const courtPlayers: string[] = []

    if (stayIdx < staying.length) {
      courtPlayers.push(staying[stayIdx++])
    }

    while (courtPlayers.length < 4 && otherIdx < others.length) {
      courtPlayers.push(others[otherIdx++])
    }

    while (courtPlayers.length < 4 && stayIdx < staying.length) {
      courtPlayers.push(staying[stayIdx++])
    }

    if (courtPlayers.length === 4) {
      games.push({
        court: i + 1,
        team1: [courtPlayers[0], courtPlayers[1]],
        team2: [courtPlayers[2], courtPlayers[3]],
      })
    } else {
      sittingOut.push(...courtPlayers)
    }
  }

  while (otherIdx < others.length) sittingOut.push(others[otherIdx++])
  while (stayIdx < staying.length) sittingOut.push(staying[stayIdx++])

  return { id: generateId(), games, sittingOut }
}
