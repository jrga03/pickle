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

export function generatePaddleQueueRound(
  playerIds: string[],
  numCourts: number,
  deferredPlayerIds: string[] = [],
): Round {
  const deferred = deferredPlayerIds.filter(id => playerIds.includes(id))
  const rest = shuffle(playerIds.filter(id => !deferredPlayerIds.includes(id)))
  const shuffled = [...deferred, ...rest]
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
  deferredPlayerIds: string[] = [],
): Round {
  const usedPartners = getPreviousPartners(previousRounds)
  const maxGames = Math.min(numCourts, Math.floor(playerIds.length / 4))
  const deferred = deferredPlayerIds.filter(id => playerIds.includes(id))
  const restIds = playerIds.filter(id => !deferredPlayerIds.includes(id))

  let bestRound: Round | null = null
  let bestRepeats = Infinity

  for (let attempt = 0; attempt < 50; attempt++) {
    const shuffled = [...deferred, ...shuffle(restIds)]
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
  deferredPlayerIds: string[] = [],
): Round {
  const deferredSet = new Set(deferredPlayerIds)
  const stayingSet = new Set(stayingPlayerIds)
  const deferred = playerIds.filter(id => deferredSet.has(id))
  const staying = shuffle(playerIds.filter(id => stayingSet.has(id) && !deferredSet.has(id)))
  const others = shuffle(playerIds.filter(id => !stayingSet.has(id) && !deferredSet.has(id)))
  const games: Game[] = []
  const sittingOut: string[] = []
  const maxGames = Math.min(numCourts, Math.floor(playerIds.length / 4))

  let defIdx = 0
  let otherIdx = 0
  let stayIdx = 0

  for (let i = 0; i < maxGames; i++) {
    const courtPlayers: string[] = []

    // Deferred players first
    while (courtPlayers.length < 4 && defIdx < deferred.length) {
      courtPlayers.push(deferred[defIdx++])
    }

    // Then one staying player per court
    if (courtPlayers.length < 4 && stayIdx < staying.length) {
      courtPlayers.push(staying[stayIdx++])
    }

    // Fill with others
    while (courtPlayers.length < 4 && otherIdx < others.length) {
      courtPlayers.push(others[otherIdx++])
    }

    // Fill with remaining staying
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

  while (defIdx < deferred.length) sittingOut.push(deferred[defIdx++])
  while (otherIdx < others.length) sittingOut.push(others[otherIdx++])
  while (stayIdx < staying.length) sittingOut.push(staying[stayIdx++])

  return { id: generateId(), games, sittingOut }
}
