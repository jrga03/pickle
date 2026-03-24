import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Autocomplete } from '../Autocomplete'

describe('Autocomplete', () => {
  const suggestions = [
    { id: '1', label: 'Jason' },
    { id: '2', label: 'Mike' },
    { id: '3', label: 'Sarah' },
  ]

  it('shows filtered suggestions when typing', async () => {
    const user = userEvent.setup()
    render(
      <Autocomplete
        suggestions={suggestions}
        onSelect={vi.fn()}
        onSubmit={vi.fn()}
        onDelete={vi.fn()}
        placeholder="Player name"
      />
    )

    await user.type(screen.getByPlaceholderText('Player name'), 'ja')
    expect(screen.getByText('Jason')).toBeInTheDocument()
    expect(screen.queryByText('Mike')).not.toBeInTheDocument()
  })

  it('calls onSelect when clicking a suggestion', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <Autocomplete
        suggestions={suggestions}
        onSelect={onSelect}
        onSubmit={vi.fn()}
        onDelete={vi.fn()}
        placeholder="Player name"
      />
    )

    await user.type(screen.getByPlaceholderText('Player name'), 'ja')
    await user.click(screen.getByText('Jason'))
    expect(onSelect).toHaveBeenCalledWith({ id: '1', label: 'Jason' })
  })

  it('calls onSubmit with text value on Enter', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Autocomplete
        suggestions={suggestions}
        onSelect={vi.fn()}
        onSubmit={onSubmit}
        onDelete={vi.fn()}
        placeholder="Player name"
      />
    )

    await user.type(screen.getByPlaceholderText('Player name'), 'NewPlayer{Enter}')
    expect(onSubmit).toHaveBeenCalledWith('NewPlayer')
  })

  it('calls onDelete when clicking X on a suggestion', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(
      <Autocomplete
        suggestions={suggestions}
        onSelect={vi.fn()}
        onSubmit={vi.fn()}
        onDelete={onDelete}
        placeholder="Player name"
      />
    )

    await user.type(screen.getByPlaceholderText('Player name'), 'ja')
    await user.click(screen.getByLabelText('Delete Jason'))
    expect(onDelete).toHaveBeenCalledWith('1')
  })

  it('clears input after selecting a suggestion', async () => {
    const user = userEvent.setup()
    render(
      <Autocomplete
        suggestions={suggestions}
        onSelect={vi.fn()}
        onSubmit={vi.fn()}
        onDelete={vi.fn()}
        placeholder="Player name"
      />
    )

    await user.type(screen.getByPlaceholderText('Player name'), 'ja')
    await user.click(screen.getByText('Jason'))
    expect(screen.getByPlaceholderText('Player name')).toHaveValue('')
  })

  it('hides suggestions when input is empty', () => {
    render(
      <Autocomplete
        suggestions={suggestions}
        onSelect={vi.fn()}
        onSubmit={vi.fn()}
        onDelete={vi.fn()}
        placeholder="Player name"
      />
    )

    expect(screen.queryByText('Jason')).not.toBeInTheDocument()
  })
})
