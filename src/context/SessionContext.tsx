import { createContext, useContext, useCallback, type ReactNode } from 'react'
import type { Session, PlaySystem, MatchupState, Round } from '../types'
import { useSessions } from './SessionsContext'
import {
  checkInPlayer, checkOutPlayer, setGameWinner as setGameWinnerOp,
} from '../utils/sessionOps'

interface SessionContextType {
  session: Session
  readOnly: boolean
  checkIn: (playerId: string) => void
  checkOut: (playerId: string) => void
  setPlaySystem: (system: PlaySystem) => void
  setMatchupState: (state: MatchupState | null) => void
  setRoundHistory: (history: Round[]) => void
  setDeferredPlayerIds: (ids: string[]) => void
  setGameWinner: (roundId: string, court: number, winner: 1 | 2 | undefined) => void
}

const SessionContext = createContext<SessionContextType | null>(null)

export function SessionProvider({ sessionId, children }: { sessionId: string; children: ReactNode }) {
  const { sessions, updateSession } = useSessions()
  const session = sessions.find(s => s.id === sessionId)

  const checkIn = useCallback((playerId: string) =>
    updateSession(sessionId, s => checkInPlayer(s, playerId)), [sessionId, updateSession])

  const checkOut = useCallback((playerId: string) =>
    updateSession(sessionId, s => checkOutPlayer(s, playerId)), [sessionId, updateSession])

  const setPlaySystem = useCallback((playSystem: PlaySystem) =>
    updateSession(sessionId, s => ({ ...s, playSystem })), [sessionId, updateSession])

  const setMatchupState = useCallback((matchupState: MatchupState | null) =>
    updateSession(sessionId, s => ({ ...s, matchupState })), [sessionId, updateSession])

  const setRoundHistory = useCallback((roundHistory: Round[]) =>
    updateSession(sessionId, s => ({ ...s, roundHistory })), [sessionId, updateSession])

  const setDeferredPlayerIds = useCallback((deferredPlayerIds: string[]) =>
    updateSession(sessionId, s => ({ ...s, deferredPlayerIds })), [sessionId, updateSession])

  const setGameWinner = useCallback((roundId: string, court: number, winner: 1 | 2 | undefined) =>
    updateSession(sessionId, s => setGameWinnerOp(s, roundId, court, winner)), [sessionId, updateSession])

  if (!session) return null

  return (
    <SessionContext.Provider value={{
      session,
      readOnly: session.status === 'ended',
      checkIn, checkOut, setPlaySystem, setMatchupState,
      setRoundHistory, setDeferredPlayerIds, setGameWinner,
    }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
