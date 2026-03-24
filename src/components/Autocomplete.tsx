import { useState, useRef } from 'react'

export interface AutocompleteSuggestion {
  id: string
  label: string
}

interface AutocompleteProps {
  suggestions: AutocompleteSuggestion[]
  onSelect: (item: AutocompleteSuggestion) => void
  onSubmit: (value: string) => void
  onDelete: (id: string) => void
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
}

export function Autocomplete({
  suggestions,
  onSelect,
  onSubmit,
  onDelete,
  placeholder,
  value: controlledValue,
  onChange,
}: AutocompleteProps) {
  const [internalValue, setInternalValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const value = controlledValue ?? internalValue
  const setValue = (v: string) => {
    if (onChange) onChange(v)
    else setInternalValue(v)
  }

  const filtered = value.trim()
    ? suggestions.filter(s =>
        s.label.toLowerCase().includes(value.toLowerCase())
      )
    : []

  const handleSelect = (item: AutocompleteSuggestion) => {
    onSelect(item)
    setValue('')
    setShowSuggestions(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const trimmed = value.trim()
      if (!trimmed) return
      const exact = filtered.find(
        s => s.label.toLowerCase() === trimmed.toLowerCase()
      )
      if (exact) {
        handleSelect(exact)
      } else {
        onSubmit(trimmed)
        setValue('')
        setShowSuggestions(false)
      }
    }
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    onDelete(id)
  }

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => {
          setValue(e.target.value)
          setShowSuggestions(true)
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => {
          setTimeout(() => setShowSuggestions(false), 200)
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base"
      />
      {showSuggestions && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(item => (
            <li
              key={item.id}
              className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 cursor-pointer min-h-[44px]"
              onMouseDown={() => handleSelect(item)}
            >
              <span className="text-gray-900">{item.label}</span>
              <button
                onMouseDown={e => handleDelete(e, item.id)}
                className="text-gray-400 hover:text-red-500 p-1 min-h-[32px] min-w-[32px] flex items-center justify-center"
                aria-label={`Delete ${item.label}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
