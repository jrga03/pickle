import type { Session, SavedVenue, SavedPlayer, MatchupState, Game, Round } from '../types'
import { localToday } from './sessionOps'

const SESSIONS_KEY = 'pickleball-sessions'
const LEGACY_SESSION_KEY = 'pickleball-session'
const VENUES_KEY = 'pickleball-venues'
const PLAYERS_KEY = 'pickleball-players'

export function saveSessions(sessions: Session[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

export function loadSessions(): Session[] {
  const data = localStorage.getItem(SESSIONS_KEY)
  if (data) {
    try {
      const parsed = JSON.parse(data) as unknown
      return Array.isArray(parsed) ? (parsed as Session[]) : []
    } catch {
      return []
    }
  }
  const migrated = migrateLegacySession()
  if (migrated) {
    saveSessions([migrated])
    localStorage.removeItem(LEGACY_SESSION_KEY)
    return [migrated]
  }
  return []
}

interface LegacyPlayer {
  id: string
  name: string
  arrivalTime?: string
  departureTime?: string
  status: string
}

interface LegacyTimeSlot {
  id: string
  startTime: string
  endTime: string
  numCourts: number
  rateOverride?: number
}

interface LegacyRound {
  id: string
  games: Game[]
  sittingOut: string[]
}

interface LegacySession {
  date: string
  venue: string
  defaultRate: number
  timeSlots: LegacyTimeSlot[]
  players: LegacyPlayer[]
  rounds?: LegacyRound[]
  matchupState?: MatchupState | null
  roundHistory?: LegacyRound[]
  playSystem: string
  deferredPlayerIds?: string[]
}

function parseHour(time: string): number {
  return parseInt(time.split(':')[0], 10)
}

function migrateLegacySession(): Session | null {
  const data = localStorage.getItem(LEGACY_SESSION_KEY)
  if (!data) return null
  try {
    const raw = JSON.parse(data) as LegacySession
    const slots = raw.timeSlots ?? []
    const players = raw.players ?? []

    // Oldest format: rounds[] → matchupState + roundHistory
    let matchupState = raw.matchupState ?? null
    let roundHistory: Round[] = raw.roundHistory ?? []
    if (raw.rounds !== undefined && raw.matchupState === undefined) {
      if (raw.rounds.length > 0) {
        const last = raw.rounds[raw.rounds.length - 1]
        matchupState = { games: last.games, sittingOut: last.sittingOut }
        roundHistory = raw.rounds.slice(0, -1)
      }
    }

    // Drop stale player IDs from matchup state (same rules as the old loader)
    const idSet = new Set(players.map(p => p.id))
    if (matchupState) {
      const displaced: string[] = []
      const cleanGames: Game[] = []
      for (const game of matchupState.games) {
        const ids = [...game.team1, ...game.team2]
        if (ids.some(id => !idSet.has(id))) {
          displaced.push(...ids.filter(id => idSet.has(id)))
        } else {
          cleanGames.push(game)
        }
      }
      const sittingOut = [...displaced, ...matchupState.sittingOut.filter(id => idSet.has(id))]
      matchupState = cleanGames.length === 0 && sittingOut.length === 0
        ? null
        : { games: cleanGames, sittingOut }
    }

    const totalCost = slots.reduce((sum, s) => {
      const len = parseHour(s.endTime) - parseHour(s.startTime)
      if (!Number.isFinite(len) || len <= 0) return sum
      return sum + len * s.numCourts * (s.rateOverride ?? raw.defaultRate)
    }, 0)

    const today = localToday()
    const validSystems: Session['playSystem'][] = ['paddle-queue', 'challenge-court', 'round-robin']

    return {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: raw.date === today ? 'active' : 'ended',
      date: raw.date,
      venue: raw.venue ?? '',
      numCourts: slots.length > 0 ? Math.max(1, ...slots.map(s => s.numCourts)) : 1,
      courtAmount: totalCost > 0 ? totalCost : null,
      playSystem: validSystems.includes(raw.playSystem as Session['playSystem'])
        ? raw.playSystem as Session['playSystem']
        : 'paddle-queue',
      players: players.map(p => ({
        id: p.id,
        name: p.name,
        checkedIn: p.status === 'active',
        participated: true,
      })),
      matchupState,
      roundHistory,
      deferredPlayerIds: (raw.deferredPlayerIds ?? []).filter(id => idSet.has(id)),
    }
  } catch {
    return null
  }
}

export function saveVenues(venues: SavedVenue[]): void {
  localStorage.setItem(VENUES_KEY, JSON.stringify(venues))
}

export function loadVenues(): SavedVenue[] {
  const data = localStorage.getItem(VENUES_KEY)
  if (!data) return []
  try {
    return JSON.parse(data) as SavedVenue[]
  } catch {
    return []
  }
}

export function savePlayers(players: SavedPlayer[]): void {
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(players))
}

export function loadPlayers(): SavedPlayer[] {
  const data = localStorage.getItem(PLAYERS_KEY)
  if (!data) return []
  try {
    return JSON.parse(data) as SavedPlayer[]
  } catch {
    return []
  }
}
