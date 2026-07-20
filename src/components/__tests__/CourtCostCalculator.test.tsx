import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router'
import { CourtCostCalculator } from '../CourtCostCalculator'
import { SessionsProvider } from '../../context/SessionsContext'
import { SessionListScreen } from '../../screens/SessionListScreen'
import { loadCalculator } from '../../utils/storage'

describe('CourtCostCalculator', () => {
  beforeEach(() => localStorage.clear())

  it('computes row subtotals with the default rate and shows the total', async () => {
    const user = userEvent.setup()
    render(<CourtCostCalculator onClose={() => {}} />)
    await user.type(screen.getByLabelText('Default hourly rate'), '350')
    await user.type(screen.getByLabelText('Hours'), '2')
    await user.type(screen.getByLabelText('Courts'), '2')
    expect(screen.getByText('Total: 1400.00')).toBeInTheDocument()
  })

  it('row rate overrides the default', async () => {
    const user = userEvent.setup()
    render(<CourtCostCalculator onClose={() => {}} />)
    await user.type(screen.getByLabelText('Default hourly rate'), '350')
    await user.type(screen.getByLabelText('Hours'), '1')
    await user.type(screen.getByLabelText('Courts'), '1')
    await user.type(screen.getByLabelText('Rate override'), '500')
    expect(screen.getByText('Total: 500.00')).toBeInTheDocument()
  })

  it('adds and removes rows, summing subtotals', async () => {
    const user = userEvent.setup()
    render(<CourtCostCalculator onClose={() => {}} />)
    await user.type(screen.getByLabelText('Default hourly rate'), '100')
    await user.type(screen.getByLabelText('Hours'), '1')
    await user.type(screen.getByLabelText('Courts'), '1')
    await user.click(screen.getByRole('button', { name: '+ Add row' }))
    await user.type(screen.getAllByLabelText('Hours')[1], '2')
    await user.type(screen.getAllByLabelText('Courts')[1], '1')
    expect(screen.getByText('Total: 300.00')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Remove row' })[1])
    expect(screen.getByText('Total: 100.00')).toBeInTheDocument()
  })

  it('persists inputs to localStorage', async () => {
    const user = userEvent.setup()
    render(<CourtCostCalculator onClose={() => {}} />)
    await user.type(screen.getByLabelText('Default hourly rate'), '350')
    expect(loadCalculator().defaultRate).toBe('350')
  })

  it('opens from the session list header', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SessionsProvider>
          <SessionListScreen />
        </SessionsProvider>
      </MemoryRouter>
    )
    await user.click(screen.getByRole('button', { name: 'Court cost calculator' }))
    expect(screen.getByText('Court Cost Calculator')).toBeInTheDocument()
  })
})
