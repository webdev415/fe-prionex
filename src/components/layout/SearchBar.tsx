/**
 * SearchBar Component
 *
 * Reusable search bar component with input, dropdown, and search button.
 */

import { useState } from 'react'
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
  className?: string
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
  className,
}: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState(defaultSearchType)

  const handleSearch = () => {
    onSearch?.(searchQuery, searchType)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div
      className={`border-light-100 flex h-11 w-[448px] items-center gap-3 rounded-full border bg-white pr-2 pl-4 ${className || ''}`}
    >
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        className="text-dark-950 flex-1 bg-transparent text-sm outline-none placeholder:font-light placeholder:text-gray-400"
      />
      <div className="h-5 w-px bg-gray-300" />
      <Select value={searchType} onValueChange={setSearchType}>
        <SelectTrigger className="text-dark-950 h-auto w-auto min-w-[120px] border-0 bg-transparent p-0 text-xs shadow-none focus:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-white">
          {searchOptions.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-dark-950 text-xs">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        className="bg-primary-300 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 hover:scale-105"
        aria-label="Search"
        onClick={handleSearch}
      >
        <Icons.Search size={20} color="#1A1A1A" strokeWidth={1.5} />
      </button>
    </div>
  )
}

export default SearchBar
