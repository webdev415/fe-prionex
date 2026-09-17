/**
 * SearchableSelect
 *
 * A type-to-filter dropdown that replaces the plain <Select> for long user lists.
 * - Shows a text input at the top of the dropdown for filtering.
 * - Scrollable list of matching options.
 * - Keyboard accessible (Enter / Escape).
 */

import { useState, useRef, useEffect, useLayoutEffect, useId, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Icons } from '@/lib/icons'

export interface SearchableSelectOption {
  id: string
  name: string
  /** When true, option is shown but not selectable. */
  disabled?: boolean
  /** Optional secondary line under the option name. */
  description?: string
}

interface SearchableSelectProps {
  id?: string
  options: SearchableSelectOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  /** When false, the dropdown lists options only (no search field). Default true. */
  searchable?: boolean
  /**
   * When provided, the component delegates filtering to the parent.
   * Called on every input keystroke — parent is responsible for debouncing
   * and updating `options` accordingly. Local client-side filtering is
   * disabled when this prop is set.
   */
  onSearchChange?: (query: string) => void
  /** Shows a spinner inside the dropdown while the parent fetches results. */
  isLoading?: boolean
  /** Hint shown when the search box is empty (server-search mode only). */
  emptySearchHint?: string
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
  searchable = true,
  onSearchChange,
  isLoading = false,
  emptySearchHint = 'Type to search…',
  disabled = false,
  className,
}: SearchableSelectProps) {
  const generatedId = useId()
  const triggerId = id || generatedId

  const { t } = useTranslation('common')
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

  // Server-search mode: parent owns filtering; local filtering is skipped.
  const filtered = onSearchChange
    ? options
    : searchable && query.trim()
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
    onSearchChange?.('')
  }

  const closeRef = useRef(close)
  useLayoutEffect(() => {
    closeRef.current = close
  })

  const select = (option: SearchableSelectOption) => {
    if (option.disabled) return
    setDisplayName(option.name)
    onValueChange(option.id)
    close()
  }

  // Focus the search input when dropdown opens (searchable mode only)
  useEffect(() => {
    if (isOpen && searchable) {
      requestAnimationFrame(() => {
        searchRef.current?.focus()
      })
    }
  }, [isOpen, searchable])

  // Close on outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      closeRef.current()
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
          'focus:border-primary-500 text-foreground border-input-border bg-input flex h-[45px] w-full items-center justify-between overflow-hidden rounded-lg border px-3 py-2 text-sm font-light shadow-none focus:outline-none',
          disabled ? 'cursor-default opacity-50' : 'cursor-pointer',
          isOpen && 'border-primary-500'
        )}
      >
        <span
          className={cn(
            'flex-1 truncate text-left',
            displayName ? 'text-foreground' : 'text-muted-foreground'
          )}
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
        <div className="border-border bg-card absolute top-[calc(100%+4px)] right-0 left-0 z-[200] rounded-lg border shadow-lg">
          {searchable && (
            <div className="border-border bg-card sticky top-0 z-10 border-b p-2">
              <div className="relative">
                <Icons.Search
                  size={14}
                  className="text-muted-foreground absolute top-1/2 left-2.5 -translate-y-1/2"
                  strokeWidth={1.5}
                />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    onSearchChange?.(e.target.value)
                  }}
                  placeholder={searchPlaceholder}
                  className="text-foreground border-border bg-muted placeholder:text-muted-foreground focus:border-primary-500 h-8 w-full rounded-md border pr-3 pl-7 text-xs focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Options list */}
          <ul
            ref={listRef}
            className="max-h-52 overflow-y-auto py-1"
            role="listbox"
            onKeyDown={handleKeyDown}
          >
            {isLoading ? (
              <li className="flex items-center justify-center px-3 py-6">
                <svg
                  className="text-muted-foreground h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </li>
            ) : onSearchChange && !query.trim() ? (
              <li className="text-muted-foreground px-3 py-6 text-center text-xs">
                {emptySearchHint}
              </li>
            ) : filtered.length === 0 ? (
              <li className="text-muted-foreground px-3 py-6 text-center text-xs">
                {t('components.searchableSelect.noResults', 'No results found')}
              </li>
            ) : (
              filtered.map((option) => (
                <li
                  key={option.id}
                  role="option"
                  aria-selected={option.id === value}
                  aria-disabled={option.disabled || undefined}
                  tabIndex={option.disabled ? -1 : 0}
                  onClick={() => select(option)}
                  onKeyDown={(e) => {
                    if (option.disabled) return
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      select(option)
                    }
                  }}
                  className={cn(
                    'text-foreground flex items-center justify-between px-3 py-2 text-sm',
                    option.disabled
                      ? 'cursor-not-allowed opacity-50'
                      : 'hover:bg-muted cursor-pointer',
                    option.id === value && !option.disabled && 'bg-muted font-medium'
                  )}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{option.name}</span>
                    {option.description ? (
                      <span className="text-muted-foreground text-[11px] font-normal">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  {option.id === value && !option.disabled && (
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
