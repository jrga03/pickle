import type { TimeSlot, Player } from '../types'

export interface SlotExpense {
  slotId: string
  slotLabel: string
  cost: number
  playerCount: number
  share: number
}

export interface PlayerExpense {
  playerId: string
  playerName: string
  slotBreakdown: SlotExpense[]
  total: number
}

export function parseHour(time: string): number {
  return parseInt(time.split(':')[0], 10)
}

function playerHoursInSlot(player: Player, slot: TimeSlot): number {
  const slotStart = parseHour(slot.startTime)
  const slotEnd = parseHour(slot.endTime)
  const playerStart = parseHour(player.arrivalTime)
  const playerEnd = parseHour(player.departureTime)

  const overlapStart = Math.max(slotStart, playerStart)
  const overlapEnd = Math.min(slotEnd, playerEnd)
  return Math.max(0, overlapEnd - overlapStart)
}

export function calculateExpenses(
  slots: TimeSlot[],
  players: Player[],
  defaultRate: number,
): PlayerExpense[] {
  const slotData = slots.map(slot => {
    const rate = slot.rateOverride ?? defaultRate
    const slotHours = parseHour(slot.endTime) - parseHour(slot.startTime)
    const cost = slotHours * slot.numCourts * rate

    const playerHours = players.map(p => ({
      player: p,
      hours: playerHoursInSlot(p, slot),
    })).filter(ph => ph.hours > 0)

    const totalPlayerHours = playerHours.reduce((sum, ph) => sum + ph.hours, 0)

    return { slot, cost, playerHours, totalPlayerHours }
  })

  return players.map(player => {
    const slotBreakdown: SlotExpense[] = []
    let total = 0

    for (const { slot, cost, playerHours, totalPlayerHours } of slotData) {
      const ph = playerHours.find(ph => ph.player.id === player.id)
      if (ph) {
        const share = totalPlayerHours > 0 ? (ph.hours / totalPlayerHours) * cost : 0
        slotBreakdown.push({
          slotId: slot.id,
          slotLabel: `${slot.startTime}-${slot.endTime}`,
          cost,
          playerCount: playerHours.length,
          share,
        })
        total += share
      }
    }

    return {
      playerId: player.id,
      playerName: player.name,
      slotBreakdown,
      total,
    }
  })
}

function formatHourShort(time: string): string {
  const h = parseInt(time.split(':')[0], 10)
  if (isNaN(h)) return time
  if (h === 0 || h === 12) return h === 0 ? '12am' : '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

export function formatExpenseText(
  expenses: PlayerExpense[],
  session: { date: string; venue: string; defaultRate: number; timeSlots: TimeSlot[]; players: Player[] },
): string {
  const lines: string[] = []
  lines.push(session.date)
  if (session.venue) lines.push(session.venue)
  lines.push('')

  // Group players by their actual play time (arrival-departure)
  const groups = new Map<string, { start: number; end: number; entries: { name: string; total: number }[] }>()
  for (const player of session.players) {
    const expense = expenses.find(e => e.playerId === player.id)
    if (!expense || expense.total === 0) continue

    const start = parseHour(player.arrivalTime)
    const end = parseHour(player.departureTime)
    const key = `${start}-${end}`
    if (!groups.has(key)) groups.set(key, { start, end, entries: [] })
    groups.get(key)!.entries.push({ name: player.name, total: expense.total })
  }

  // Sort groups: longest duration first, then earlier start
  const sortedGroups = [...groups.entries()].sort((a, b) => {
    const aDur = a[1].end - a[1].start
    const bDur = b[1].end - b[1].start
    if (bDur !== aDur) return bDur - aDur
    return a[1].start - b[1].start
  })

  for (const [, group] of sortedGroups) {
    const label = `${formatHourShort(`${group.start}:00`)}-${formatHourShort(`${group.end}:00`)}`
    lines.push(label)

    const sorted = group.entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of sorted) {
      lines.push(`  ${entry.name}: ${entry.total.toFixed(2)}`)
    }
  }
  lines.push('')

  const totalCost = expenses.reduce((sum, e) => sum + e.total, 0)
  lines.push(`Total: ${totalCost.toFixed(2)}`)
  return lines.join('\n')
}
