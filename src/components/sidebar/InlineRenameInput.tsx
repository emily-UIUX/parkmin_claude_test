import { useRef, useEffect } from 'react'

interface InlineRenameInputProps {
  initialValue: string
  onSubmit: (value: string) => void
  onCancel: () => void
}

export function InlineRenameInput({ initialValue, onSubmit, onCancel }: InlineRenameInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const value = inputRef.current?.value.trim()
      if (value) onSubmit(value)
      else onCancel()
    } else if (e.key === 'Escape') {
      onCancel()
    }
    e.stopPropagation()
  }

  return (
    <input
      ref={inputRef}
      defaultValue={initialValue}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        const value = inputRef.current?.value.trim()
        if (value && value !== initialValue) onSubmit(value)
        else onCancel()
      }}
      onClick={(e) => e.stopPropagation()}
      className="flex-1 min-w-0 bg-background border border-primary rounded px-1 py-0 text-sm outline-none"
    />
  )
}
