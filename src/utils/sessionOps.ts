import type { Session, PlaySystem, CompletedGame } from '../types'
import type { Candidate } from './suggestions'

export interface NewSessionInput {
  date: string
  venue: string
  numCourts: number
  courtAmount: number | null
  playSystem: PlaySystem
  playerNames: string[]
}

function clampCourts(n: number): number {
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}

function normalizeAmount(amount: number | null): number | null {
  return amount !== null && Number.isFinite(amount) && amount > 0 ? amount : null
}

export function createNewSession(input: NewSessionInput): Session {
  const players: Session['players'] = []
  for (const raw of input.playerNames) {
    const name = raw.trim()
    if (!name) continue
    if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) continue
    players.push({ id: crypto.randomUUID(), name, checkedIn: false, participated: false })
  }
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'active',
    date: input.date,
    venue: input.venue.trim(),
    numCourts: clampCourts(input.numCourts),
    courtAmount: normalizeAmount(input.courtAmount),
    playSystem: input.playSystem,
    players,
    liveGames: [],
    matchHistory: [],
    queue: [],
    courtWinners: {},
  }
}

export function checkInPlayer(session: Session, playerId: string): Session {
  return {
    ...session,
    players: session.players.map(p =>
      p.id === playerId ? { ...p, checkedIn: true, participated: true } : p),
    queue: session.queue.includes(playerId) ? session.queue : [...session.queue, playerId],
  }
}

export function checkOutPlayer(session: Session, playerId: string): Session {
  let next: Session = {
    ...session,
    players: session.players.map(p =>
      p.id === playerId ? { ...p, checkedIn: false } : p),
    queue: session.queue.filter(id => id !== playerId),
  }

  const game = next.liveGames.find(g =>
    g.team1.includes(playerId) || g.team2.includes(playerId))
  if (game) {
    const remaining = [...game.team1, ...game.team2].filter(id => id !== playerId)
    next = {
      ...next,
      liveGames: next.liveGames.filter(g => g !== game),
      queue: [...remaining, ...next.queue],
    }
  }

  const held = Object.entries(next.courtWinners).find(([, pair]) => pair.includes(playerId))
  if (held) {
    const [court, pair] = held
    const courtWinners = { ...next.courtWinners }
    delete courtWinners[Number(court)]
    next = {
      ...next,
      courtWinners,
      queue: [...pair.filter(id => id !== playerId), ...next.queue],
    }
  }

  return next
}

export function addRosterPlayer(session: Session, name: string): Session {
  const trimmed = name.trim()
  if (!trimmed) return session
  if (session.players.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) return session
  return {
    ...session,
    players: [...session.players, { id: crypto.randomUUID(), name: trimmed, checkedIn: false, participated: false }],
  }
}

export function removeRosterPlayer(session: Session, playerId: string): Session {
  const cleared = checkOutPlayer(session, playerId)
  return { ...cleared, players: cleared.players.filter(p => p.id !== playerId) }
}

export function assignToCourt(session: Session, candidate: Candidate, court: number): Session {
  if (court < 1 || court > session.numCourts) return session
  if (session.liveGames.some(g => g.court === court)) return session
  const ids = [...candidate.team1, ...candidate.team2]
  if (new Set(ids).size !== 4) return session
  const held = session.courtWinners[court] ?? []
  const available = new Set([...session.queue, ...held])
  if (ids.some(id => !available.has(id))) return session

  const courtWinners = { ...session.courtWinners }
  delete courtWinners[court]
  return {
    ...session,
    liveGames: [...session.liveGames, {
      court,
      team1: [candidate.team1[0], candidate.team1[1]],
      team2: [candidate.team2[0], candidate.team2[1]],
    }],
    queue: session.queue.filter(id => !ids.includes(id)),
    courtWinners,
  }
}

export function recordWin(session: Session, court: number, winner: 1 | 2): Session {
  const game = session.liveGames.find(g => g.court === court)
  if (!game) return session
  const completed: CompletedGame = {
    id: crypto.randomUUID(),
    court,
    team1: [game.team1[0], game.team1[1]],
    team2: [game.team2[0], game.team2[1]],
    winner,
    endedAt: new Date().toISOString(),
  }
  const winners = winner === 1 ? game.team1 : game.team2
  const losers = winner === 1 ? game.team2 : game.team1
  const base = {
    ...session,
    liveGames: session.liveGames.filter(g => g !== game),
    matchHistory: [...session.matchHistory, completed],
  }
  if (session.playSystem === 'challenge-court') {
    return {
      ...base,
      queue: [...session.queue, ...losers],
      courtWinners: { ...session.courtWinners, [court]: [winners[0], winners[1]] },
    }
  }
  return { ...base, queue: [...session.queue, ...losers, ...winners] }
}

export function cancelGame(session: Session, court: number): Session {
  const game = session.liveGames.find(g => g.court === court)
  if (!game) return session
  return {
    ...session,
    liveGames: session.liveGames.filter(g => g !== game),
    queue: [...game.team1, ...game.team2, ...session.queue],
  }
}

export function setGameWinner(session: Session, gameId: string, winner: 1 | 2): Session {
  return {
    ...session,
    matchHistory: session.matchHistory.map(g =>
      g.id === gameId ? { ...g, winner } : g),
  }
}

export function deleteGame(session: Session, gameId: string): Session {
  return {
    ...session,
    matchHistory: session.matchHistory.filter(g => g.id !== gameId),
  }
}

function dissolveHolds(session: Session, courts: number[]): Session {
  const freed: string[] = []
  const courtWinners = { ...session.courtWinners }
  for (const court of courts) {
    const pair = courtWinners[court]
    if (pair) {
      freed.push(...pair)
      delete courtWinners[court]
    }
  }
  if (freed.length === 0) return session
  return { ...session, courtWinners, queue: [...freed, ...session.queue] }
}

export function setPlaySystem(session: Session, playSystem: PlaySystem): Session {
  if (playSystem === session.playSystem) return session
  const dissolved = dissolveHolds(session, Object.keys(session.courtWinners).map(Number))
  return { ...dissolved, playSystem }
}

export function updateSessionFields(
  session: Session,
  fields: Partial<Pick<Session, 'date' | 'venue' | 'numCourts' | 'courtAmount' | 'playSystem'>>,
): Session {
  const next = { ...session, ...fields }
  if (fields.numCourts !== undefined) next.numCourts = clampCourts(fields.numCourts)
  if (fields.courtAmount !== undefined) next.courtAmount = normalizeAmount(fields.courtAmount)
  if (fields.venue !== undefined) next.venue = fields.venue.trim()
  const systemChanged = fields.playSystem !== undefined && fields.playSystem !== session.playSystem
  const toDissolve = Object.keys(next.courtWinners).map(Number)
    .filter(court => systemChanged || court > next.numCourts)
  return dissolveHolds(next, toDissolve)
}

export function compareSessionsDesc(a: Session, b: Session): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
  return 0
}

export function localToday(): string {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
}
