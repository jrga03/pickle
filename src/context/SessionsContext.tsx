import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { Session } from '../types'
import { saveSessions, loadSessions } from '../utils/storage'
import { createNewSession, type NewSessionInput } from '../utils/sessionOps'

interface SessionsContextType {
  sessions: Session[]
  createSession: (input: NewSessionInput) => Session
  updateSession: (id: string, updater: (s: Session) => Session) => void
  deleteSession: (id: string) => void
  endSession: (id: string) => void
  reopenSession: (id: string) => void
}

const SessionsContext = createContext<SessionsContextType | null>(null)

export function SessionsProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>(() => loadSessions())

  useEffect(() => {
    saveSessions(sessions)
  }, [sessions])

  const createSession = useCallback((input: NewSessionInput) => {
    const session = createNewSession(input)
    setSessions(prev => [session, ...prev])
    return session
  }, [])

  const updateSession = useCallback((id: string, updater: (s: Session) => Session) =>
    setSessions(prev => prev.map(s => s.id === id ? updater(s) : s)), [])

  const deleteSession = useCallback((id: string) =>
    setSessions(prev => prev.filter(s => s.id !== id)), [])

  const endSession = useCallback((id: string) =>
    setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'ended' as const } : s)), [])

  const reopenSession = useCallback((id: string) =>
    setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'active' as const } : s)), [])

  return (
    <SessionsContext.Provider value={{
      sessions, createSession, updateSession, deleteSession, endSession, reopenSession,
    }}>
      {children}
    </SessionsContext.Provider>
  )
}

export function useSessions() {
  const ctx = useContext(SessionsContext)
  if (!ctx) throw new Error('useSessions must be used within SessionsProvider')
  return ctx
}
