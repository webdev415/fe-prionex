/**
 * ImportHistoryFiltersBar Component
 *
 * Search and filter bar for Import History page.
 * Follows the same pattern and styling as SearchFiltersBar from ProjectManagement.
 */

import { useEffect, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSyncedState } from '@/hooks'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'

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
  const { t } = useTranslation('common')

  // Use synced state for search input - automatically syncs with external changes (URL restoration)
  const [searchValue, setSearchValue] = useSyncedState(filters.searchFilename, '')
  const [isFiltersDropdownOpen, setIsFiltersDropdownOpen] = useState(false)

  // Close filters dropdown when screen size crosses breakpoint (in either direction)
  useEffect(() => {
    let wasMobile = window.innerWidth < 1024 // lg breakpoint

    const handleResize = () => {
      const isMobile = window.innerWidth < 1024

      // Close filters dropdown if transitioning across breakpoint (mobile <-> desktop)
      if (wasMobile !== isMobile && isFiltersDropdownOpen) {
        setIsFiltersDropdownOpen(false)
      }

      wasMobile = isMobile
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isFiltersDropdownOpen])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== (filters.searchFilename || '')) {
        onFilterChange({ ...filters, searchFilename: searchValue || undefined })
      }
    }, 2000)
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
      <div
        className={cn(
          'border-light-100 flex h-11 flex-1 items-center gap-2 rounded-full border bg-white sm:gap-3',
          'pl-3 sm:pl-4',
          'pr-2 lg:pr-2',
          'w-full max-w-full'
        )}
      >
        {/* Search icon - shown on mobile when search button is hidden, hidden on desktop when search button is visible */}
        <Icons.Search size={18} className="shrink-0 text-gray-400 lg:hidden" strokeWidth={1.5} />

        {/* Search Input */}
        <div className="flex flex-1 items-center gap-2">
          <input
            type="text"
            placeholder={t('pages.imports.history.filters.searchFilename')}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch()
              }
            }}
            disabled={isLoading}
            className="text-dark-500 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:font-light placeholder:text-gray-400 sm:text-sm"
          />
          {searchValue && (
            <button
              onClick={() => setSearchValue('')}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-gray-100"
              type="button"
            >
              <Icons.Close size={14} className="text-gray-500" />
            </button>
          )}
        </div>

        {/* Filters - icon-only dropdown on mobile, inline on desktop */}
        <div className="flex shrink-0 items-center">
          {/* Mobile: Icon-only filter dropdown */}
          <div className="lg:hidden">
            <DropdownMenu
              modal={false}
              open={isFiltersDropdownOpen}
              onOpenChange={setIsFiltersDropdownOpen}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="text-dark-500 bg-primary-300 hover:bg-primary-500 active:bg-primary-600 group flex h-9 w-9 min-w-0 cursor-pointer items-center justify-center rounded-full border-0 p-0 shadow-none transition-all duration-200 hover:shadow-md focus:outline-none active:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:focus:ring-0 data-[state=open]:focus:ring-offset-0"
                  aria-label="Filters"
                  disabled={isLoading}
                >
                  <Icons.Filter
                    size={18}
                    className="text-dark-500 shrink-0 transition-transform duration-200 group-hover:scale-110"
                    strokeWidth={1.5}
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white">
                {/* Date Range Filter */}
                <div className="px-2 py-1.5">
                  <span className="text-xs font-medium text-gray-700">
                    {t('pages.imports.history.filters.dateRange')}:
                  </span>
                  <div className="mt-1">
                    <Select
                      value={filters.dateRange || 'all'}
                      onValueChange={handleDateRangeChange}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="h-8 w-full border border-gray-200 bg-white text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="all">
                          {t('pages.imports.history.filters.allDates')}
                        </SelectItem>
                        <SelectItem value="today">
                          {t('pages.imports.history.filters.today')}
                        </SelectItem>
                        <SelectItem value="last_7_days">
                          {t('pages.imports.history.filters.last7Days')}
                        </SelectItem>
                        <SelectItem value="last_30_days">
                          {t('pages.imports.history.filters.last30Days')}
                        </SelectItem>
                        <SelectItem value="last_90_days">
                          {t('pages.imports.history.filters.last90Days')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Status Filter */}
                <div className="px-2 py-1.5">
                  <span className="text-xs font-medium text-gray-700">
                    {t('pages.imports.history.filters.status')}:
                  </span>
                  <div className="mt-1">
                    <Select
                      value={filters.status || 'all'}
                      onValueChange={handleStatusChange}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="h-8 w-full border border-gray-200 bg-white text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="all">
                          {t('pages.imports.history.filters.allStatuses')}
                        </SelectItem>
                        <SelectItem value="done">
                          {t('pages.imports.history.statuses.done')}
                        </SelectItem>
                        <SelectItem value="failed">
                          {t('pages.imports.history.statuses.failed')}
                        </SelectItem>
                        <SelectItem value="cancelled">
                          {t('pages.imports.history.statuses.cancelled')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Uploaded By Filter */}
                <div className="px-2 py-1.5">
                  <span className="text-xs font-medium text-gray-700">
                    {t('pages.imports.history.filters.uploadedBy')}:
                  </span>
                  <div className="mt-1">
                    <Select
                      value={filters.uploadedBy || 'all'}
                      onValueChange={handleUploadedByChange}
                      disabled={isLoading || availableUsers.length === 0}
                    >
                      <SelectTrigger className="h-8 w-full border border-gray-200 bg-white text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white" searchable>
                        <SelectItem value="all">
                          {t('pages.imports.history.filters.allUsers')}
                        </SelectItem>
                        {availableUsers.map((user) => (
                          <SelectItem key={user} value={user}>
                            {user}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Desktop: Inline filters with divider */}
          <div className="hidden items-center lg:flex">
            <div className="mx-2 h-5 w-px bg-gray-300" />
            <div className="flex items-center gap-4 text-xs text-gray-700">
              {/* Date Range Filter */}
              <div className="flex items-center gap-1">
                <Select
                  value={filters.dateRange || 'all'}
                  onValueChange={handleDateRangeChange}
                  disabled={isLoading}
                >
                  <SelectTrigger className="h-auto border-0 bg-transparent p-0 text-[11px] font-medium shadow-none focus:ring-0">
                    <SelectValue placeholder={t('pages.imports.history.filters.dateRange')} />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">
                      {t('pages.imports.history.filters.allDates')}
                    </SelectItem>
                    <SelectItem value="today">
                      {t('pages.imports.history.filters.today')}
                    </SelectItem>
                    <SelectItem value="last_7_days">
                      {t('pages.imports.history.filters.last7Days')}
                    </SelectItem>
                    <SelectItem value="last_30_days">
                      {t('pages.imports.history.filters.last30Days')}
                    </SelectItem>
                    <SelectItem value="last_90_days">
                      {t('pages.imports.history.filters.last90Days')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1">
                <Select
                  value={filters.status || 'all'}
                  onValueChange={handleStatusChange}
                  disabled={isLoading}
                >
                  <SelectTrigger className="h-auto border-0 bg-transparent p-0 text-[11px] font-medium shadow-none focus:ring-0">
                    <SelectValue placeholder={t('pages.imports.history.filters.status')} />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">
                      {t('pages.imports.history.filters.allStatuses')}
                    </SelectItem>
                    <SelectItem value="done">{t('pages.imports.history.statuses.done')}</SelectItem>
                    <SelectItem value="failed">
                      {t('pages.imports.history.statuses.failed')}
                    </SelectItem>
                    <SelectItem value="cancelled">
                      {t('pages.imports.history.statuses.cancelled')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Uploaded By Filter */}
              <div className="flex items-center gap-1">
                <Select
                  value={filters.uploadedBy || 'all'}
                  onValueChange={handleUploadedByChange}
                  disabled={isLoading || availableUsers.length === 0}
                >
                  <SelectTrigger className="h-auto border-0 bg-transparent p-0 text-[11px] font-medium shadow-none focus:ring-0">
                    <SelectValue placeholder={t('pages.imports.history.filters.uploadedBy')} />
                  </SelectTrigger>
                  <SelectContent className="bg-white" searchable>
                    <SelectItem value="all">
                      {t('pages.imports.history.filters.allUsers')}
                    </SelectItem>
                    {availableUsers.map((user) => (
                      <SelectItem key={user} value={user}>
                        {user}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Search Button - hidden on mobile, visible on desktop */}
        <button
          type="button"
          onClick={handleSearch}
          disabled={isLoading}
          className="bg-primary-300 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 hover:scale-105 disabled:opacity-60 lg:flex"
          aria-label="Search import history"
        >
          <Icons.Search size={18} className="text-dark-500" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}

export default ImportHistoryFiltersBar
