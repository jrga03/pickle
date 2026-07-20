import { createContext, useContext, useCallback, type ReactNode } from 'react'
import type { Session, PlaySystem } from '../types'
import type { Candidate } from '../utils/suggestions'
import { useSessions } from './SessionsContext'
import {
  checkInPlayer, checkOutPlayer,
  assignToCourt as assignToCourtOp,
  recordWin as recordWinOp,
  cancelGame as cancelGameOp,
  setGameWinner as setGameWinnerOp,
  deleteGame as deleteGameOp,
  setPlaySystem as setPlaySystemOp,
} from '../utils/sessionOps'

interface SessionContextType {
  session: Session
  readOnly: boolean
  checkIn: (playerId: string) => void
  checkOut: (playerId: string) => void
  setPlaySystem: (system: PlaySystem) => void
  assignToCourt: (candidate: Candidate, court: number) => void
  recordWin: (court: number, winner: 1 | 2) => void
  cancelGame: (court: number) => void
  setGameWinner: (gameId: string, winner: 1 | 2) => void
  deleteGame: (gameId: string) => void
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
    updateSession(sessionId, s => setPlaySystemOp(s, playSystem)), [sessionId, updateSession])

  const assignToCourt = useCallback((candidate: Candidate, court: number) =>
    updateSession(sessionId, s => assignToCourtOp(s, candidate, court)), [sessionId, updateSession])

  const recordWin = useCallback((court: number, winner: 1 | 2) =>
    updateSession(sessionId, s => recordWinOp(s, court, winner)), [sessionId, updateSession])

  const cancelGame = useCallback((court: number) =>
    updateSession(sessionId, s => cancelGameOp(s, court)), [sessionId, updateSession])

  const setGameWinner = useCallback((gameId: string, winner: 1 | 2) =>
    updateSession(sessionId, s => setGameWinnerOp(s, gameId, winner)), [sessionId, updateSession])

  const deleteGame = useCallback((gameId: string) =>
    updateSession(sessionId, s => deleteGameOp(s, gameId)), [sessionId, updateSession])

  if (!session) return null

  return (
    <SessionContext.Provider value={{
      session,
      readOnly: session.status === 'ended',
      checkIn, checkOut, setPlaySystem,
      assignToCourt, recordWin, cancelGame, setGameWinner, deleteGame,
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
