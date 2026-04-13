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

export function calculateExpenses(
  slots: TimeSlot[],
  players: Player[],
  defaultRate: number,
): PlayerExpense[] {
  const playerTotals = new Map<string, { slotBreakdown: SlotExpense[]; total: number }>()
  for (const player of players) {
    playerTotals.set(player.id, { slotBreakdown: [], total: 0 })
  }

  for (const slot of slots) {
    const rate = slot.rateOverride ?? defaultRate
    const slotStart = parseHour(slot.startTime)
    const slotEnd = parseHour(slot.endTime)
    const slotCost = (slotEnd - slotStart) * slot.numCourts * rate

    // Collect hour boundaries where the set of present players changes
    const boundaries = new Set<number>([slotStart, slotEnd])
    for (const p of players) {
      const arr = parseHour(p.arrivalTime)
      if (arr > slotStart && arr < slotEnd) boundaries.add(arr)
      const dep = parseHour(p.departureTime)
      if (dep > slotStart && dep < slotEnd) boundaries.add(dep)
    }
    const sorted = [...boundaries].sort((a, b) => a - b)

    // Split each sub-period's cost evenly among players present
    for (let i = 0; i < sorted.length - 1; i++) {
      const subStart = sorted[i]
      const subEnd = sorted[i + 1]
      const subCost = (subEnd - subStart) * slot.numCourts * rate

      const present = players.filter(p => {
        const pStart = parseHour(p.arrivalTime)
        const pEnd = parseHour(p.departureTime)
        return pStart <= subStart && pEnd >= subEnd
      })

      if (present.length === 0) continue
      const each = subCost / present.length
      for (const p of present) {
        const data = playerTotals.get(p.id)!
        data.slotBreakdown.push({
          slotId: slot.id,
          slotLabel: `${String(subStart).padStart(2, '0')}:00-${String(subEnd).padStart(2, '0')}:00`,
          cost: subCost,
          playerCount: present.length,
          share: each,
        })
        data.total += each
      }
    }
  }

  return players.map(player => ({
    playerId: player.id,
    playerName: player.name,
    slotBreakdown: playerTotals.get(player.id)!.slotBreakdown,
    total: playerTotals.get(player.id)!.total,
  }))
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
