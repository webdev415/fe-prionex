/**
 * SearchBar Component
 *
 * Reusable search bar component with input, dropdown, and search button.
 * Supports debounced search while typing.
 */

import { useState, useEffect, useRef } from 'react'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'

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
  const [isMobileDropdownOpen, setIsMobileDropdownOpen] = useState(false)
  const [isDesktopDropdownOpen, setIsDesktopDropdownOpen] = useState(false)

  // Sync with controlled value prop
  useEffect(() => {
    if (value !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchQuery(value)
    }
  }, [value])

  // Close mobile dropdown when screen size crosses breakpoint (in either direction)
  useEffect(() => {
    let wasMobile = window.innerWidth < 1024 // lg breakpoint

    const handleResize = () => {
      const isMobile = window.innerWidth < 1024

      // Close mobile dropdown if transitioning across breakpoint (mobile <-> desktop)
      if (wasMobile !== isMobile && isMobileDropdownOpen) {
        setIsMobileDropdownOpen(false)
      }

      wasMobile = isMobile
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isMobileDropdownOpen])

  // Close desktop dropdown on window resize to prevent positioning issues
  useEffect(() => {
    const handleResize = () => {
      if (isDesktopDropdownOpen) {
        setIsDesktopDropdownOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isDesktopDropdownOpen])

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

  // Get current search type label
  const currentSearchTypeLabel = searchOptions.find((opt) => opt.value === searchType)?.label || ''

  return (
    <div className="relative">
      <div
        className={cn(
          'border-light-100 flex h-11 items-center gap-2 rounded-full border bg-white sm:gap-3',
          // Responsive padding: less on mobile, more on desktop
          'pl-3 sm:pl-4',
          // Responsive width: smaller on mobile, full width on larger screens
          'w-[200px] sm:w-[280px] md:w-[360px] lg:w-[448px]',
          // Responsive right padding: adjust for mobile (with filter button) and desktop (with search button)
          'pr-2 lg:pr-2',
          className
        )}
      >
        {/* Search icon - shown on mobile when search button is hidden, hidden on desktop when search button is visible */}
        <Icons.Search size={18} className="shrink-0 text-gray-400 lg:hidden" strokeWidth={1.5} />

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          className="text-dark-500 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:font-light placeholder:text-gray-400 sm:text-sm"
        />

        {/* Search type selector - icon-only on mobile, full on desktop */}
        <div className="flex shrink-0 items-center">
          {/* Mobile: Icon-only selector - styled as a rounded-full button with primary background */}
          <div className="lg:hidden">
            <DropdownMenu
              modal={false}
              open={isMobileDropdownOpen}
              onOpenChange={setIsMobileDropdownOpen}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="text-dark-500 bg-primary-300 hover:bg-primary-500 active:bg-primary-600 group flex h-9 w-9 min-w-0 cursor-pointer items-center justify-center rounded-full border-0 p-0 shadow-none transition-all duration-200 hover:shadow-md focus:outline-none active:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:focus:ring-0 data-[state=open]:focus:ring-offset-0"
                  aria-label="Search type"
                >
                  <Icons.Filter
                    size={18}
                    className="text-dark-500 shrink-0 transition-transform duration-200 group-hover:scale-110"
                    strokeWidth={1.5}
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 bg-white">
                {searchOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => handleSearchTypeChange(option.value)}
                    className={cn(
                      'text-dark-500 flex cursor-pointer items-center gap-2 text-xs',
                      searchType === option.value && 'bg-gray-100 font-medium'
                    )}
                  >
                    {option.label}
                    {searchType === option.value && (
                      <Icons.Checkmark
                        size={16}
                        className="text-dark-500 ml-auto"
                        strokeWidth={2}
                      />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Desktop: Full selector with divider */}
          <div className="hidden items-center lg:flex">
            <div className="mx-2 h-5 w-px bg-gray-300" />
            <DropdownMenu
              modal={false}
              open={isDesktopDropdownOpen}
              onOpenChange={setIsDesktopDropdownOpen}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="text-dark-500 group flex h-auto w-auto min-w-[120px] cursor-pointer items-center justify-between gap-2 rounded-md border-0 bg-transparent px-2 py-1 text-xs shadow-none transition-all duration-200 hover:bg-gray-100 focus:outline-none active:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:focus:ring-0 data-[state=open]:focus:ring-offset-0"
                  aria-label="Search type"
                >
                  <span className="transition-colors duration-200">{currentSearchTypeLabel}</span>
                  <Icons.ArrowDown
                    size={14}
                    className="text-gray-500 opacity-50 transition-all duration-200 group-hover:translate-y-0.5 group-hover:opacity-100"
                    strokeWidth={1.5}
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 bg-white">
                {searchOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => handleSearchTypeChange(option.value)}
                    className={cn(
                      'text-dark-500 flex cursor-pointer items-center gap-2 text-xs',
                      searchType === option.value && 'bg-gray-100 font-medium'
                    )}
                  >
                    {option.label}
                    {searchType === option.value && (
                      <Icons.Checkmark
                        size={16}
                        className="text-dark-500 ml-auto"
                        strokeWidth={2}
                      />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search button - hidden on mobile, visible on desktop */}
        <button
          className="bg-primary-300 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 hover:scale-105 disabled:opacity-50 lg:flex"
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
