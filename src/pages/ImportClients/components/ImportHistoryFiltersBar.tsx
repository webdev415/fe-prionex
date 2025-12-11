/**
 * ImportHistoryFiltersBar Component
 *
 * Search and filter bar for Import History page.
 * Follows the same pattern and styling as SearchFiltersBar from ProjectManagement.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Icons } from '@/lib/icons'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'

export interface ImportHistoryFilters {
  searchFilename?: string
  dateRange?: string
  status?: string
  uploadedBy?: string
}

interface ImportHistoryFiltersBarProps {
  filters: ImportHistoryFilters
  onFilterChange: (filters: ImportHistoryFilters) => void
  availableUsers?: string[]
  isLoading?: boolean
}

export function ImportHistoryFiltersBar({
  filters,
  onFilterChange,
  availableUsers = [],
  isLoading = false,
}: ImportHistoryFiltersBarProps) {
  const [searchValue, setSearchValue] = useState(filters.searchFilename || '')
  const prevSearchFilenameRef = useRef(filters.searchFilename)

  // Sync searchValue with filters when filters change externally (e.g., clear filters)
  useEffect(() => {
    if (prevSearchFilenameRef.current !== filters.searchFilename) {
      prevSearchFilenameRef.current = filters.searchFilename
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setSearchValue(filters.searchFilename || '')
      }, 0)
    }
  }, [filters.searchFilename])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== (filters.searchFilename || '')) {
        onFilterChange({ ...filters, searchFilename: searchValue || undefined })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchValue, filters, onFilterChange])

  const handleDateRangeChange = useCallback(
    (value: string) => {
      onFilterChange({
        ...filters,
        dateRange: value === 'all' ? undefined : value,
      })
    },
    [filters, onFilterChange]
  )

  const handleStatusChange = useCallback(
    (value: string) => {
      onFilterChange({
        ...filters,
        status: value === 'all' ? undefined : value,
      })
    },
    [filters, onFilterChange]
  )

  const handleUploadedByChange = useCallback(
    (value: string) => {
      onFilterChange({
        ...filters,
        uploadedBy: value === 'all' ? undefined : value,
      })
    },
    [filters, onFilterChange]
  )

  const handleSearch = useCallback(() => {
    onFilterChange({ ...filters, searchFilename: searchValue || undefined })
  }, [filters, onFilterChange, searchValue])

  return (
    <div className="flex flex-1 items-center justify-between">
      {/* Search + Filters pill - styled to match SearchFiltersBar */}
      <div className="flex h-12 flex-1 items-center gap-3 rounded-full border border-gray-200 bg-white pr-2 pl-4 shadow-sm">
        {/* Search Input */}
        <div className="flex flex-1 items-center gap-2 py-1">
          <input
            type="text"
            placeholder="Search filename"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch()
              }
            }}
            disabled={isLoading}
            className="text-dark-500 h-9 w-full bg-transparent text-sm font-light outline-none placeholder:text-gray-500 disabled:opacity-60"
          />
          {searchValue && (
            <button
              onClick={() => setSearchValue('')}
              className="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-gray-100"
              type="button"
            >
              <Icons.Close size={14} className="text-gray-500" />
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="mx-2 h-5 w-px bg-gray-200" />

        {/* Inline Filters */}
        <div className="flex items-center gap-4 text-xs text-gray-700">
          {/* Date Range Filter */}
          <div className="flex items-center gap-1">
            <Select
              value={filters.dateRange || 'all'}
              onValueChange={handleDateRangeChange}
              disabled={isLoading}
            >
              <SelectTrigger className="h-8 rounded-none border-0 p-0 px-2 text-[11px] font-medium shadow-none focus:ring-0">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="last_7_days">Last 7 days</SelectItem>
                <SelectItem value="last_30_days">Last 30 days</SelectItem>
                <SelectItem value="last_90_days">Last 90 days</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-gray-200" />

          {/* Status Filter */}
          <div className="flex items-center gap-1">
            <Select
              value={filters.status || 'all'}
              onValueChange={handleStatusChange}
              disabled={isLoading}
            >
              <SelectTrigger className="h-8 rounded-none border-0 p-0 px-2 text-[11px] font-medium shadow-none focus:ring-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-gray-200" />

          {/* Uploaded By Filter */}
          <div className="flex items-center gap-1">
            <Select
              value={filters.uploadedBy || 'all'}
              onValueChange={handleUploadedByChange}
              disabled={isLoading || availableUsers.length === 0}
            >
              <SelectTrigger className="h-8 rounded-none border-0 p-0 px-2 text-[11px] font-medium shadow-none focus:ring-0">
                <SelectValue placeholder="Uploaded by" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All users</SelectItem>
                {availableUsers.map((user) => (
                  <SelectItem key={user} value={user}>
                    {user}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-2 h-5 w-px bg-gray-200" />

        {/* Search Button - styled like SearchFiltersBar */}
        <button
          type="button"
          onClick={handleSearch}
          disabled={isLoading}
          className="bg-primary-300 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 hover:scale-105 disabled:opacity-60"
          aria-label="Search import history"
        >
          <Icons.Search size={18} className="text-dark-500" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}

export default ImportHistoryFiltersBar
