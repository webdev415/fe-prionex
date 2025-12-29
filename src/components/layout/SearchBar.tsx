/**
 * SearchBar Component
 *
 * Reusable search bar component with input, dropdown, and search button.
 * Supports debounced search while typing.
 */

import { useState, useEffect, useRef } from 'react'
import { Icons } from '@/lib/icons'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'

interface SearchOption {
  value: string
  label: string
}

interface SearchBarProps {
  placeholder?: string
  searchOptions?: SearchOption[]
  defaultSearchType?: string
  onSearch?: (query: string, searchType: string) => void
  onSearchChange?: (query: string, searchType: string) => void
  className?: string
  isLoading?: boolean
  value?: string
  searchTypeValue?: string
}

export function SearchBar({
  placeholder = 'Search',
  searchOptions = [
    { value: 'all', label: 'All' },
    { value: 'projects', label: 'Projects' },
    { value: 'users', label: 'Users' },
  ],
  defaultSearchType = 'all',
  onSearch,
  onSearchChange,
  className,
  isLoading = false,
  value,
  searchTypeValue,
}: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState(value || '')
  const [searchType, setSearchType] = useState(searchTypeValue || defaultSearchType)

  // Sync with controlled value prop
  useEffect(() => {
    if (value !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchQuery(value)
    }
  }, [value])

  useEffect(() => {
    if (searchTypeValue !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchType(searchTypeValue)
    }
  }, [searchTypeValue])
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousQueryRef = useRef<string>('')
  const previousTypeRef = useRef<string>(defaultSearchType)

  // Debounce search while typing
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Only trigger search if query or type actually changed
    const queryChanged = searchQuery.trim() !== previousQueryRef.current.trim()
    const typeChanged = searchType !== previousTypeRef.current

    if (searchQuery.trim() && onSearchChange && (queryChanged || typeChanged)) {
      debounceTimerRef.current = setTimeout(() => {
        previousQueryRef.current = searchQuery
        previousTypeRef.current = searchType
        onSearchChange(searchQuery, searchType)
      }, 300)
    } else if (!searchQuery.trim()) {
      // Clear previous values when query is empty and notify parent
      previousQueryRef.current = ''
      previousTypeRef.current = searchType
      // Notify parent to clear results when query becomes empty
      if (onSearchChange) {
        onSearchChange('', searchType)
      }
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchQuery, searchType, onSearchChange])

  const handleSearch = () => {
    if (onSearch) {
      onSearch(searchQuery, searchType)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleSearchTypeChange = (value: string) => {
    setSearchType(value)
    // Don't trigger search immediately on type change if query is empty
    if (searchQuery.trim() && onSearchChange) {
      previousQueryRef.current = searchQuery
      previousTypeRef.current = value
      onSearchChange(searchQuery, value)
    }
  }

  return (
    <div className="relative">
      <div
        className={`border-light-100 flex h-11 w-[448px] items-center gap-3 rounded-full border bg-white pr-2 pl-4 ${className || ''}`}
      >
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          className="text-dark-500 flex-1 bg-transparent text-sm outline-none placeholder:font-light placeholder:text-gray-400"
        />
        <div className="h-5 w-px bg-gray-300" />
        <Select value={searchType} onValueChange={handleSearchTypeChange}>
          <SelectTrigger className="text-dark-500 h-auto w-auto min-w-[120px] border-0 bg-transparent p-0 text-xs shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white">
            {searchOptions.map((option) => (
              <SelectItem key={option.value} value={option.value} className="text-dark-500 text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          className="bg-primary-300 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 hover:scale-105 disabled:opacity-50"
          aria-label="Search"
          onClick={handleSearch}
          disabled={isLoading}
        >
          <Icons.Search size={20} className="text-dark-500" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}

export default SearchBar
