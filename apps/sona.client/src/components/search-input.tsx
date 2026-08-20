import { useEffect, useRef, useState } from 'react'

import { Search, X } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }: SearchInputProps) {
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (expanded) {
      inputRef.current?.focus()
    }
  }, [expanded])

  function handleClose() {
    setExpanded(false)
    onChange('')
  }

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="cursor-pointer rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      >
        <Search size={18} />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${expanded ? 'ml-2 w-56 opacity-100' : 'w-0 opacity-0'}`}
      >
        <div className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full border-none bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={handleClose}
            className="cursor-pointer text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
