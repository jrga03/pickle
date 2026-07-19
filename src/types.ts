export type SessionStatus = 'active' | 'ended'
export type PlaySystem = 'paddle-queue' | 'challenge-court' | 'round-robin'
export interface SessionPlayer { id: string; name: string; checkedIn: boolean; participated: boolean }
export interface Game { court: number; team1: [string, string]; team2: [string, string]; winner?: 1 | 2 }
export interface Round { id: string; games: Game[]; sittingOut: string[] }
export interface MatchupState { games: Game[]; sittingOut: string[] }
export interface Session {
  id: string; createdAt: string; status: SessionStatus
  date: string; venue: string; numCourts: number; courtAmount: number | null
  playSystem: PlaySystem; players: SessionPlayer[]
  matchupState: MatchupState | null; roundHistory: Round[]; deferredPlayerIds: string[]
}
export interface SavedVenue { id: string; name: string }
export interface SavedPlayer { id: string; name: string }
