/**
 * SearchableSelect
 *
 * A type-to-filter dropdown that replaces the plain <Select> for long user lists.
 * - Shows a text input at the top of the dropdown for filtering.
 * - Scrollable list of matching options.
 * - Keyboard accessible (Enter / Escape).
 */

import { useState, useRef, useEffect, useId, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Icons } from '@/lib/icons'

export interface SearchableSelectOption {
  id: string
  name: string
}

interface SearchableSelectProps {
  id?: string
  options: SearchableSelectOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
}

export function SearchableSelect({
  id,
  options,
  value,
  onValueChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  disabled = false,
  className,
}: SearchableSelectProps) {
  const generatedId = useId()
  const triggerId = id || generatedId

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [displayName, setDisplayName] = useState(
    () => options.find((o) => o.id === value)?.name ?? ''
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Keep displayName in sync with value + options
  useEffect(() => {
    requestAnimationFrame(() => {
      if (!value) {
        setDisplayName('')
        return
      }
      const found = options.find((o) => o.id === value)
      if (found) setDisplayName(found.name)
    })
  }, [value, options])

  const filtered = query.trim()
    ? options.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  const open = () => {
    if (disabled) return
    setIsOpen(true)
    setQuery('')
  }

  const close = () => {
    setIsOpen(false)
    setQuery('')
  }

  const select = (option: SearchableSelectOption) => {
    setDisplayName(option.name)
    onValueChange(option.id)
    close()
  }

  // Focus the search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        searchRef.current?.focus()
      })
    }
  }, [isOpen])

  // Close on outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      close()
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    } else {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isOpen, handleOutsideClick])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') close()
  }

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {/* Trigger button */}
      <button
        id={triggerId}
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (isOpen) {
              close()
            } else {
              open()
            }
          }
        }}
        className={cn(
          'flex h-[45px] w-full items-center justify-between overflow-hidden rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm font-light shadow-none focus:outline-none',
          disabled ? 'cursor-default opacity-50' : 'cursor-pointer',
          isOpen && 'border-primary-500 ring-primary-500 ring-2'
        )}
      >
        <span
          className="flex-1 truncate text-left"
          style={{ color: displayName ? '#1a1a2e' : '#9ca3af' }}
        >
          {displayName || placeholder}
        </span>
        <div className="ml-2 shrink-0 opacity-50">
          <Icons.ArrowDown
            size={16}
            className={cn('text-current transition-transform', isOpen && 'rotate-180')}
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] right-0 left-0 z-50 rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* Search input — sticky so it stays visible while scrolling */}
          <div className="sticky top-0 z-10 border-b border-gray-100 bg-white p-2">
            <div className="relative">
              <Icons.Search
                size={14}
                className="absolute top-1/2 left-2.5 -translate-y-1/2 text-gray-400"
                strokeWidth={1.5}
              />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="text-dark-500 focus:border-primary-500 focus:ring-primary-500 h-8 w-full rounded-md border border-gray-200 bg-gray-50 pr-3 pl-7 text-xs placeholder:text-gray-400 focus:ring-1 focus:outline-none"
              />
            </div>
          </div>

          {/* Options list */}
          <ul
            ref={listRef}
            className="max-h-52 overflow-y-auto py-1"
            role="listbox"
            onKeyDown={handleKeyDown}
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-gray-400">No results found</li>
            ) : (
              filtered.map((option) => (
                <li
                  key={option.id}
                  role="option"
                  aria-selected={option.id === value}
                  tabIndex={0}
                  onClick={() => select(option)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      select(option)
                    }
                  }}
                  className={cn(
                    'text-dark-500 flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-gray-50',
                    option.id === value && 'bg-primary-50 font-medium'
                  )}
                >
                  <span>{option.name}</span>
                  {option.id === value && (
                    <Icons.Tick02 size={14} className="text-primary-500" strokeWidth={2} />
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
