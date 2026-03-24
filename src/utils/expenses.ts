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

function getSlotIndex(slots: TimeSlot[], slotId: string): number {
  return slots.findIndex(s => s.id === slotId)
}

function getPlayersInSlot(players: Player[], slots: TimeSlot[], slotId: string): Player[] {
  const slotIndex = getSlotIndex(slots, slotId)
  return players.filter(p => {
    const arrivalIndex = getSlotIndex(slots, p.arrivalSlotId)
    return arrivalIndex >= 0 && arrivalIndex <= slotIndex
  })
}

export function calculateExpenses(
  slots: TimeSlot[],
  players: Player[],
  defaultRate: number,
): PlayerExpense[] {
  const slotData = slots.map(slot => {
    const rate = slot.rateOverride ?? defaultRate
    const cost = slot.numCourts * rate
    const presentPlayers = getPlayersInSlot(players, slots, slot.id)
    const playerCount = presentPlayers.length
    const share = playerCount > 0 ? cost / playerCount : 0
    return {
      slot,
      cost,
      playerCount,
      share,
      presentPlayerIds: new Set(presentPlayers.map(p => p.id)),
    }
  })

  return players.map(player => {
    const slotBreakdown: SlotExpense[] = []
    let total = 0

    for (const { slot, cost, playerCount, share, presentPlayerIds } of slotData) {
      if (presentPlayerIds.has(player.id)) {
        slotBreakdown.push({
          slotId: slot.id,
          slotLabel: `${slot.startTime}-${slot.endTime}`,
          cost,
          playerCount,
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

export function formatExpenseText(
  expenses: PlayerExpense[],
  session: { date: string; venue: string; defaultRate: number },
): string {
  const lines: string[] = []
  lines.push(`Pickleball Session - ${session.date}`)
  if (session.venue) lines.push(`Venue: ${session.venue}`)
  lines.push('')

  const sorted = [...expenses].sort((a, b) => a.playerName.localeCompare(b.playerName))
  const totalCost = expenses.reduce((sum, e) => sum + e.total, 0)

  for (const exp of sorted) {
    lines.push(`${exp.playerName}: ${exp.total.toFixed(2)}`)
  }

  lines.push('')
  lines.push(`Total: ${totalCost.toFixed(2)}`)
  return lines.join('\n')
}
