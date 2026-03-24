import type { Session } from '../types'

const STORAGE_KEY = 'pickleball-session'

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
