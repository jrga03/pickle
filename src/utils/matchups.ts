import type { MatchupState, Round, Game } from '../types'

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function generatePaddleQueueMatchups(
  playerIds: string[],
  numCourts: number,
  deferredPlayerIds: string[] = [],
): MatchupState {
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

  return { games, sittingOut }
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

export function generateRoundRobinMatchups(
  playerIds: string[],
  numCourts: number,
  previousRounds: { games: { team1: [string, string]; team2: [string, string] }[] }[],
  deferredPlayerIds: string[] = [],
): MatchupState {
  const usedPartners = getPreviousPartners(previousRounds)
  const maxGames = Math.min(numCourts, Math.floor(playerIds.length / 4))
  const deferred = deferredPlayerIds.filter(id => playerIds.includes(id))
  const restIds = playerIds.filter(id => !deferredPlayerIds.includes(id))

  let bestRound: MatchupState | null = null
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

    const round: MatchupState = { games, sittingOut }

    if (repeats < bestRepeats) {
      bestRepeats = repeats
      bestRound = round
    }
    if (repeats === 0) break
  }

  return bestRound!
}

export function generateChallengeCourtMatchups(
  playerIds: string[],
  numCourts: number,
  stayingPlayerIds: string[] = [],
  deferredPlayerIds: string[] = [],
): MatchupState {
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

  return { games, sittingOut }
}

export function rotateCourt(
  state: MatchupState,
  courtNumber: number,
): MatchupState {
  const gameIndex = state.games.findIndex(g => g.court === courtNumber)
  if (gameIndex === -1) return state

  const game = state.games[gameIndex]
  const courtPlayers = [...game.team1, ...game.team2]

  // Court players go to back of queue, then pull next 4 from front
  const newQueue = [...state.sittingOut, ...courtPlayers]
  const incoming = newQueue.splice(0, 4)

  const newGames = [...state.games]
  if (incoming.length >= 4) {
    newGames[gameIndex] = {
      court: courtNumber,
      team1: [incoming[0], incoming[1]],
      team2: [incoming[2], incoming[3]],
    }
  } else {
    // Fewer than 4 total — can't form a game
    newGames.splice(gameIndex, 1)
    newQueue.unshift(...incoming)
  }

  return { games: newGames, sittingOut: newQueue }
}

export function rotateChallengeCourtSingle(
  state: MatchupState,
  courtNumber: number,
  winningTeam: 'team1' | 'team2',
): MatchupState {
  const gameIndex = state.games.findIndex(g => g.court === courtNumber)
  if (gameIndex === -1) return state

  const game = state.games[gameIndex]
  const winners = [...game[winningTeam]]
  const losingTeam = winningTeam === 'team1' ? 'team2' : 'team1'
  const losers = [...game[losingTeam]]

  // Losers go to back of queue, then pull 2 challengers from front
  const newQueue = [...state.sittingOut, ...losers]
  const challengers = newQueue.splice(0, 2)

  const newGames = [...state.games]
  newGames[gameIndex] = {
    court: courtNumber,
    team1: [winners[0], winners[1]],
    team2: [challengers[0], challengers[1]],
  }

  return { games: newGames, sittingOut: newQueue }
}

function normalizeArrangement(team1: string[], team2: string[]): string {
  const t1 = [...team1].sort().join(',')
  const t2 = [...team2].sort().join(',')
  return [t1, t2].sort().join('|')
}

export function rerollCourt(
  state: MatchupState,
  courtNumber: number,
): MatchupState {
  const gameIndex = state.games.findIndex(g => g.court === courtNumber)
  if (gameIndex === -1) return state

  const game = state.games[gameIndex]
  const players = [...game.team1, ...game.team2]

  // All 3 possible 2v2 arrangements of 4 players
  const arrangements: [[string, string], [string, string]][] = [
    [[players[0], players[1]], [players[2], players[3]]],
    [[players[0], players[2]], [players[1], players[3]]],
    [[players[0], players[3]], [players[1], players[2]]],
  ]

  const currentKey = normalizeArrangement(game.team1, game.team2)
  const alternatives = arrangements.filter(
    ([t1, t2]) => normalizeArrangement(t1, t2) !== currentKey,
  )

  const chosen = alternatives[Math.floor(Math.random() * alternatives.length)]
  const newGames = [...state.games]
  newGames[gameIndex] = {
    court: courtNumber,
    team1: chosen[0],
    team2: chosen[1],
  }

  return { games: newGames, sittingOut: state.sittingOut }
}

export function addPlayerToMatchups(
  state: MatchupState,
  playerId: string,
): MatchupState {
  return { games: state.games, sittingOut: [...state.sittingOut, playerId] }
}

export function removePlayerFromMatchups(
  state: MatchupState,
  playerId: string,
): MatchupState {
  // Check sitting out queue first
  const queueIndex = state.sittingOut.indexOf(playerId)
  if (queueIndex !== -1) {
    const newQueue = [...state.sittingOut]
    newQueue.splice(queueIndex, 1)
    return { games: state.games, sittingOut: newQueue }
  }

  // Check games
  for (let i = 0; i < state.games.length; i++) {
    const game = state.games[i]
    const inTeam1 = game.team1.indexOf(playerId)
    const inTeam2 = game.team2.indexOf(playerId)

    if (inTeam1 === -1 && inTeam2 === -1) continue

    const newQueue = [...state.sittingOut]
    const replacement = newQueue.length > 0 ? newQueue.shift()! : null

    if (replacement) {
      const newGames = [...state.games]
      if (inTeam1 !== -1) {
        const newTeam1 = [...game.team1] as [string, string]
        newTeam1[inTeam1] = replacement
        newGames[i] = { ...game, team1: newTeam1 }
      } else {
        const newTeam2 = [...game.team2] as [string, string]
        newTeam2[inTeam2] = replacement
        newGames[i] = { ...game, team2: newTeam2 }
      }
      return { games: newGames, sittingOut: newQueue }
    } else {
      // No replacement — dissolve game, remaining go to front of queue
      const remaining = [...game.team1, ...game.team2].filter(id => id !== playerId)
      const newGames = state.games.filter((_, idx) => idx !== i)
      return { games: newGames, sittingOut: [...remaining, ...state.sittingOut] }
    }
  }

  return state
}

export function snapshotToHistory(state: MatchupState): Round {
  return {
    id: crypto.randomUUID(),
    games: state.games,
    sittingOut: state.sittingOut,
  }
}
