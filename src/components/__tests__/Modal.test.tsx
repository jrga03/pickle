import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Modal } from '../Modal'

describe('Modal', () => {
  it('renders title and children', () => {
    render(<Modal title="Test Modal" onClose={() => {}}><p>Body here</p></Modal>)
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('Body here')).toBeInTheDocument()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('calls onClose from the dismiss button and the backdrop', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Modal title="Test Modal" onClose={onClose}><p>Body</p></Modal>)
    await user.click(screen.getByLabelText('Dismiss'))
    await user.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
