import type { Session } from '../types'

export interface FlatSplit {
  total: number | null
  participants: { id: string; name: string }[]
  perHead: number | null
}

export function calculateFlatSplit(session: Session): FlatSplit {
  const participants = session.players
    .filter(p => p.participated)
    .map(p => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const total = session.courtAmount
  const perHead = total !== null && participants.length > 0
    ? total / participants.length
    : null
  return { total, participants, perHead }
}

export function formatExpenseText(session: Session): string {
  const { total, participants, perHead } = calculateFlatSplit(session)
  const lines: string[] = [session.date]
  if (session.venue) lines.push(session.venue)
  lines.push('')
  if (total !== null && perHead !== null) {
    lines.push(`Total: ${total.toFixed(2)}`)
    lines.push(`÷ ${participants.length} player${participants.length !== 1 ? 's' : ''} = ${perHead.toFixed(2)} each`)
    lines.push('')
  }
  for (const p of participants) {
    lines.push(p.name)
  }
  return lines.join('\n')
}
