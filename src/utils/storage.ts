import type { Session, SavedVenue, SavedPlayer, CalculatorState } from '../types'

const SESSIONS_KEY = 'pickleball-sessions'
const VENUES_KEY = 'pickleball-venues'
const PLAYERS_KEY = 'pickleball-players'
const CALCULATOR_KEY = 'pickleball-calculator'

export function saveSessions(sessions: Session[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

function isNewShape(s: Session | undefined | null): s is Session {
  return !!s
    && Array.isArray(s.liveGames)
    && Array.isArray(s.matchHistory)
    && Array.isArray(s.queue)
    && typeof s.courtWinners === 'object' && s.courtWinners !== null
}

export function loadSessions(): Session[] {
  const data = localStorage.getItem(SESSIONS_KEY)
  if (!data) return []
  try {
    const parsed = JSON.parse(data) as unknown
    if (!Array.isArray(parsed)) return []
    return (parsed as Session[]).filter(isNewShape)
  } catch {
    return []
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

export function saveCalculator(state: CalculatorState): void {
  localStorage.setItem(CALCULATOR_KEY, JSON.stringify(state))
}

export function loadCalculator(): CalculatorState {
  const fallback: CalculatorState = { defaultRate: '', rows: [] }
  const data = localStorage.getItem(CALCULATOR_KEY)
  if (!data) return fallback
  try {
    const parsed = JSON.parse(data) as CalculatorState
    return {
      defaultRate: typeof parsed.defaultRate === 'string' ? parsed.defaultRate : '',
      rows: Array.isArray(parsed.rows) ? parsed.rows : [],
    }
  } catch {
    return fallback
  }
}
