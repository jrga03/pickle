import type { Session, PlaySystem } from '../types'
import { addPlayerToMatchups, removePlayerFromMatchups } from './matchups'

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
    matchupState: null,
    roundHistory: [],
    deferredPlayerIds: [],
  }
}

export function checkInPlayer(session: Session, playerId: string): Session {
  return {
    ...session,
    players: session.players.map(p =>
      p.id === playerId ? { ...p, checkedIn: true, participated: true } : p),
    matchupState: session.matchupState
      ? addPlayerToMatchups(session.matchupState, playerId)
      : null,
  }
}

export function checkOutPlayer(session: Session, playerId: string): Session {
  return {
    ...session,
    players: session.players.map(p =>
      p.id === playerId ? { ...p, checkedIn: false } : p),
    matchupState: session.matchupState
      ? removePlayerFromMatchups(session.matchupState, playerId)
      : null,
    deferredPlayerIds: session.deferredPlayerIds.filter(id => id !== playerId),
  }
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
  return {
    ...session,
    players: session.players.filter(p => p.id !== playerId),
    matchupState: session.matchupState
      ? removePlayerFromMatchups(session.matchupState, playerId)
      : null,
    deferredPlayerIds: session.deferredPlayerIds.filter(id => id !== playerId),
  }
}

export function updateSessionFields(
  session: Session,
  fields: Partial<Pick<Session, 'date' | 'venue' | 'numCourts' | 'courtAmount' | 'playSystem'>>,
): Session {
  const next = { ...session, ...fields }
  if (fields.numCourts !== undefined) next.numCourts = clampCourts(fields.numCourts)
  if (fields.courtAmount !== undefined) next.courtAmount = normalizeAmount(fields.courtAmount)
  if (fields.venue !== undefined) next.venue = fields.venue.trim()
  return next
}

export function setGameWinner(
  session: Session,
  roundId: string,
  court: number,
  winner: 1 | 2 | undefined,
): Session {
  return {
    ...session,
    roundHistory: session.roundHistory.map(round =>
      round.id !== roundId ? round : {
        ...round,
        games: round.games.map(game =>
          game.court !== court ? game : { ...game, winner }),
      }),
  }
}

export function compareSessionsDesc(a: Session, b: Session): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
  return 0
}

export function localToday(): string {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
}
