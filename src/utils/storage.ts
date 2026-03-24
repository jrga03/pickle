import type { Session, SavedVenue, SavedPlayer } from '../types'

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
    const session = JSON.parse(data) as Session
    // Migrate players from old arrivalSlotId to arrivalTime/departureTime
    session.players = session.players.map(p => {
      if (!p.arrivalTime || !p.departureTime) {
        return {
          ...p,
          arrivalTime: p.arrivalTime ?? session.timeSlots[0]?.startTime ?? '',
          departureTime: p.departureTime ?? session.timeSlots[session.timeSlots.length - 1]?.endTime ?? '',
        }
      }
      return p
    })
    return session
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
