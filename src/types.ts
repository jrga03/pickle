export type PlayerStatus = 'active' | 'deferred' | 'left'

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
  arrivalSlotId: string // references TimeSlot.id
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
}
