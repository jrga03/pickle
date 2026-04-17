import type { Session, SavedVenue, SavedPlayer, MatchupState, Game } from '../types'

interface RawPlayer {
  id: string
  name: string
  arrivalTime?: string
  departureTime?: string
  status: string
}

interface RawRound {
  id: string
  games: Game[]
  sittingOut: string[]
}

interface RawSession {
  date: string
  venue: string
  defaultRate: number
  timeSlots: { startTime: string; endTime: string; numCourts: number; rateOverride?: number; id: string }[]
  players: RawPlayer[]
  rounds?: RawRound[]
  matchupState?: MatchupState | null
  roundHistory?: RawRound[]
  playSystem: string
  deferredPlayerIds?: string[]
}

const STORAGE_KEY = 'pickleball-session'
const VENUES_KEY = 'pickleball-venues'
const PLAYERS_KEY = 'pickleball-players'

export function saveSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function loadSession(): Session | null {
  const data = localStorage.getItem(STORAGE_KEY)
  if (!data) return null
  try {
    const raw = JSON.parse(data) as unknown as RawSession

    // Migrate players from old arrivalSlotId to arrivalTime/departureTime
    raw.players = (raw.players ?? []).map(p => ({
      ...p,
      arrivalTime: p.arrivalTime ?? raw.timeSlots?.[0]?.startTime ?? '',
      departureTime: p.departureTime ?? raw.timeSlots?.[raw.timeSlots.length - 1]?.endTime ?? '',
      status: p.status === 'deferred' ? 'active' : p.status,
    }))

    // Initialize deferredPlayerIds if missing
    if (!raw.deferredPlayerIds) {
      raw.deferredPlayerIds = []
    }

    const playerIdSet = new Set(raw.players.map(p => p.id))

    // Migrate old rounds[] to matchupState + roundHistory
    if (raw.rounds !== undefined && raw.matchupState === undefined) {
      const rounds = raw.rounds
      if (rounds.length === 0) {
        raw.matchupState = null
        raw.roundHistory = []
      } else {
        const lastRound = rounds[rounds.length - 1]
        raw.matchupState = {
          games: lastRound.games,
          sittingOut: lastRound.sittingOut,
        }
        raw.roundHistory = rounds.slice(0, -1)
      }
      delete raw.rounds
    }

    // Initialize if missing
    if (raw.matchupState === undefined) raw.matchupState = null
    if (raw.roundHistory === undefined) raw.roundHistory = []

    // Clean stale player IDs from matchupState
    if (raw.matchupState) {
      const state = raw.matchupState
      // Remove stale IDs from sittingOut
      state.sittingOut = state.sittingOut.filter(id => playerIdSet.has(id))
      // Check games for stale IDs — dissolve affected games
      const cleanGames: Game[] = []
      const displaced: string[] = []
      for (const game of state.games) {
        const allIds = [...game.team1, ...game.team2]
        const hasStale = allIds.some(id => !playerIdSet.has(id))
        if (hasStale) {
          displaced.push(...allIds.filter(id => playerIdSet.has(id)))
        } else {
          cleanGames.push(game)
        }
      }
      state.games = cleanGames
      state.sittingOut = [...displaced, ...state.sittingOut]
      raw.matchupState = state.games.length === 0 && state.sittingOut.length === 0 ? null : state
    }

    // Clean stale IDs from deferredPlayerIds
    raw.deferredPlayerIds = raw.deferredPlayerIds!.filter(id => playerIdSet.has(id))

    return raw as unknown as Session
  } catch {
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY)
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
