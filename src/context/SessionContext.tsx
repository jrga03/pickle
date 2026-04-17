import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { Session, Player, TimeSlot, PlaySystem, MatchupState, Round } from '../types'
import { saveSession, loadSession } from '../utils/storage'
import { addPlayerToMatchups, removePlayerFromMatchups } from '../utils/matchups'

const generateId = () => crypto.randomUUID()

const defaultSession: Session = {
  date: new Date().toISOString().split('T')[0],
  venue: '',
  defaultRate: 0,
  timeSlots: [],
  players: [],
  matchupState: null,
  roundHistory: [],
  playSystem: 'paddle-queue',
  deferredPlayerIds: [],
}

interface SessionContextType {
  session: Session
  setDate: (date: string) => void
  setVenue: (venue: string) => void
  setDefaultRate: (rate: number) => void
  setPlaySystem: (system: PlaySystem) => void
  addTimeSlot: (startTime: string, endTime: string, numCourts: number, rateOverride?: number) => void
  removeTimeSlot: (id: string) => void
  updateTimeSlot: (id: string, updates: Partial<Omit<TimeSlot, 'id'>>) => void
  addPlayer: (name: string) => void
  removePlayer: (id: string) => void
  updatePlayerStatus: (id: string, status: Player['status']) => void
  updatePlayerSchedule: (id: string, arrivalTime: string, departureTime: string) => void
  setDeferredPlayerIds: (ids: string[]) => void
  setMatchupState: (state: MatchupState | null) => void
  setRoundHistory: (history: Round[]) => void
  resetSession: () => void
}

const SessionContext = createContext<SessionContextType | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(() => loadSession() ?? defaultSession)

  useEffect(() => {
    saveSession(session)
  }, [session])

  const setDate = useCallback((date: string) =>
    setSession(s => ({ ...s, date })), [])

  const setVenue = useCallback((venue: string) =>
    setSession(s => ({ ...s, venue })), [])

  const setDefaultRate = useCallback((rate: number) =>
    setSession(s => ({ ...s, defaultRate: rate })), [])

  const setPlaySystem = useCallback((playSystem: PlaySystem) =>
    setSession(s => ({ ...s, playSystem })), [])

  const addTimeSlot = useCallback((startTime: string, endTime: string, numCourts: number, rateOverride?: number) =>
    setSession(s => ({
      ...s,
      timeSlots: [...s.timeSlots, { id: generateId(), startTime, endTime, numCourts, rateOverride }],
    })), [])

  const removeTimeSlot = useCallback((id: string) =>
    setSession(s => ({
      ...s,
      timeSlots: s.timeSlots.filter(ts => ts.id !== id),
    })), [])

  const updateTimeSlot = useCallback((id: string, updates: Partial<Omit<TimeSlot, 'id'>>) =>
    setSession(s => ({
      ...s,
      timeSlots: s.timeSlots.map(ts => ts.id === id ? { ...ts, ...updates } : ts),
    })), [])

  const addPlayer = useCallback((name: string) =>
    setSession(s => {
      const newPlayer = {
        id: generateId(),
        name,
        arrivalTime: s.timeSlots.length > 0
          ? s.timeSlots.reduce((min, ts) => ts.startTime < min ? ts.startTime : min, s.timeSlots[0].startTime)
          : '',
        departureTime: s.timeSlots.length > 0
          ? s.timeSlots.reduce((max, ts) => ts.endTime > max ? ts.endTime : max, s.timeSlots[0].endTime)
          : '',
        status: 'active' as const,
      }
      return {
        ...s,
        players: [...s.players, newPlayer],
        matchupState: s.matchupState
          ? addPlayerToMatchups(s.matchupState, newPlayer.id)
          : null,
      }
    }), [])

  const removePlayer = useCallback((id: string) =>
    setSession(s => ({
      ...s,
      players: s.players.filter(p => p.id !== id),
      matchupState: s.matchupState
        ? removePlayerFromMatchups(s.matchupState, id)
        : null,
      deferredPlayerIds: s.deferredPlayerIds.filter(d => d !== id),
    })), [])

  const updatePlayerStatus = useCallback((id: string, status: Player['status']) =>
    setSession(s => {
      let newMatchupState = s.matchupState
      if (newMatchupState) {
        if (status === 'left') {
          newMatchupState = removePlayerFromMatchups(newMatchupState, id)
        } else if (status === 'active') {
          newMatchupState = addPlayerToMatchups(newMatchupState, id)
        }
      }
      return {
        ...s,
        players: s.players.map(p => p.id === id ? { ...p, status } : p),
        matchupState: newMatchupState,
        deferredPlayerIds: status === 'left'
          ? s.deferredPlayerIds.filter(d => d !== id)
          : s.deferredPlayerIds,
      }
    }), [])

  const updatePlayerSchedule = useCallback((id: string, arrivalTime: string, departureTime: string) =>
    setSession(s => ({
      ...s,
      players: s.players.map(p => p.id === id ? { ...p, arrivalTime, departureTime } : p),
    })), [])

  const setDeferredPlayerIds = useCallback((deferredPlayerIds: string[]) =>
    setSession(s => ({ ...s, deferredPlayerIds })), [])

  const setMatchupState = useCallback((matchupState: MatchupState | null) =>
    setSession(s => ({ ...s, matchupState })), [])

  const setRoundHistory = useCallback((roundHistory: Round[]) =>
    setSession(s => ({ ...s, roundHistory })), [])

  const resetSession = useCallback(() =>
    setSession(defaultSession), [])

  return (
    <SessionContext.Provider value={{
      session, setDate, setVenue, setDefaultRate, setPlaySystem,
      addTimeSlot, removeTimeSlot, updateTimeSlot,
      addPlayer, removePlayer, updatePlayerStatus, updatePlayerSchedule,
      setDeferredPlayerIds, setMatchupState, setRoundHistory, resetSession,
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
