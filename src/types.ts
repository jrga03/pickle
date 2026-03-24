export type PlayerStatus = 'active' | 'left'

export type PlaySystem = 'paddle-queue' | 'challenge-court' | 'round-robin'

export interface TimeSlot {
  id: string
  startTime: string // "13:00"
  endTime: string   // "14:00"
  numCourts: number
  rateOverride?: number
}

export interface Player {
  id: string
  name: string
  arrivalTime: string   // "14:00" — hour the player arrives
  departureTime: string // "18:00" — hour the player leaves
  status: PlayerStatus
}

export interface Game {
  court: number
  team1: [string, string] // player IDs
  team2: [string, string] // player IDs
}

export interface Round {
  id: string
  games: Game[]
  sittingOut: string[] // player IDs
}

export interface Session {
  date: string
  venue: string
  defaultRate: number
  timeSlots: TimeSlot[]
  players: Player[]
  rounds: Round[]
  playSystem: PlaySystem
  deferredPlayerIds: string[]
}

export interface SavedVenue {
  id: string
  name: string
  defaultRate: number
}

export interface SavedPlayer {
  id: string
  name: string
}
