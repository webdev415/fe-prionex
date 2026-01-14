/**
 * ImportHistoryFiltersBar Component
 *
 * Search and filter bar for Import History page.
 * Follows the same pattern and styling as SearchFiltersBar from ProjectManagement.
 */

import { useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSyncedState } from '@/hooks'
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
  const { t } = useTranslation('common')

  // Use synced state for search input - automatically syncs with external changes (URL restoration)
  const [searchValue, setSearchValue] = useSyncedState(filters.searchFilename, '')

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
      <div className="flex h-12 flex-1 items-center gap-3 rounded-full border border-gray-200 bg-white pr-2 pl-4 shadow-sm">
        {/* Search Input */}
        <div className="flex flex-1 items-center gap-2 py-1">
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
        <div className="flex items-center gap-4 text-xs text-gray-600">
          {/* Date Range Filter */}
          <div className="flex items-center gap-1">
            <Select
              value={filters.dateRange || 'all'}
              onValueChange={handleDateRangeChange}
              disabled={isLoading}
            >
              <SelectTrigger className="h-8 rounded-none border-0 p-0 px-2 text-[11px] font-medium shadow-none focus:ring-0">
                <SelectValue placeholder={t('pages.imports.history.filters.dateRange')} />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">{t('pages.imports.history.filters.allDates')}</SelectItem>
                <SelectItem value="today">{t('pages.imports.history.filters.today')}</SelectItem>
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
                <SelectValue placeholder={t('pages.imports.history.filters.status')} />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">
                  {t('pages.imports.history.filters.allStatuses')}
                </SelectItem>
                <SelectItem value="done">{t('pages.imports.history.statuses.done')}</SelectItem>
                <SelectItem value="failed">{t('pages.imports.history.statuses.failed')}</SelectItem>
                <SelectItem value="cancelled">
                  {t('pages.imports.history.statuses.cancelled')}
                </SelectItem>
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
                <SelectValue placeholder={t('pages.imports.history.filters.uploadedBy')} />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">{t('pages.imports.history.filters.allUsers')}</SelectItem>
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
