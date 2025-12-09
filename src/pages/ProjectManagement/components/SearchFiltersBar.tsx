/**
 * SearchFiltersBar Component
 *
 * Search and filter bar for Project Management page.
 * Includes search input, status filter, client filter, and period filter.
 */

import { useState, useEffect, useCallback } from 'react'
import { Icons } from '@/lib/icons'
import { colors } from '@/lib/colors'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import type { ProjectFilters } from '@/features/projects/types'

interface SearchFiltersBarProps {
  filters: ProjectFilters
  onFilterChange: (filters: ProjectFilters) => void
  onExport: () => void
  clients: string[]
  isLoading?: boolean
}

type PeriodOption = 'any' | 'last_30_days' | 'last_90_days' | 'this_year'

export function SearchFiltersBar({
  filters,
  onFilterChange,
  onExport,
  clients,
  isLoading = false,
}: SearchFiltersBarProps) {
  const [searchValue, setSearchValue] = useState(filters.search || '')
  const [period, setPeriod] = useState<PeriodOption>('any')

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== filters.search) {
        onFilterChange({ ...filters, search: searchValue || undefined })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchValue, filters, onFilterChange])

  const handleStatusChange = useCallback(
    (value: string) => {
      onFilterChange({
        ...filters,
        status: value as ProjectFilters['status'],
      })
    },
    [filters, onFilterChange]
  )

  const handleClientChange = useCallback(
    (value: string) => {
      onFilterChange({
        ...filters,
        client_company: value === 'all' ? undefined : value,
      })
    },
    [filters, onFilterChange]
  )

  const handlePeriodChange = useCallback(
    (value: PeriodOption) => {
      setPeriod(value)

      const today = new Date()
      const formatDate = (date: Date) => date.toISOString().slice(0, 10)

      let start_date_from: string | undefined
      let start_date_to: string | undefined

      switch (value) {
        case 'last_30_days': {
          const from = new Date(today)
          from.setDate(from.getDate() - 30)
          start_date_from = formatDate(from)
          start_date_to = formatDate(today)
          break
        }
        case 'last_90_days': {
          const from = new Date(today)
          from.setDate(from.getDate() - 90)
          start_date_from = formatDate(from)
          start_date_to = formatDate(today)
          break
        }
        case 'this_year': {
          const from = new Date(today.getFullYear(), 0, 1)
          start_date_from = formatDate(from)
          start_date_to = formatDate(today)
          break
        }
        case 'any':
        default: {
          start_date_from = undefined
          start_date_to = undefined
        }
      }

      onFilterChange({
        ...filters,
        start_date_from,
        start_date_to,
      })
    },
    [filters, onFilterChange]
  )

  const handleClearFilters = useCallback(() => {
    setSearchValue('')
    onFilterChange({
      search: undefined,
      status: 'active',
      client_company: undefined,
      start_date_from: undefined,
      start_date_to: undefined,
    })
  }, [onFilterChange])

  const hasActiveFilters =
    filters.search ||
    (filters.status && filters.status !== 'active') ||
    filters.client_company ||
    filters.start_date_from ||
    filters.start_date_to

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      {/* Search + Filters pill - styled to match dashboard header search bar */}
      <div
        className="flex min-w-[320px] flex-1 items-center gap-3 rounded-full border bg-white pr-2 pl-4 shadow-sm"
        style={{
          borderColor: colors.gray[200],
        }}
      >
        {/* Search Input */}
        <div className="flex flex-1 items-center gap-2">
          <Icons.Search size={18} color={colors.gray[500]} />
          <input
            type="text"
            placeholder="Search by name, code, clients"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            disabled={isLoading}
            className="h-10 w-full bg-transparent text-sm font-light outline-none placeholder:text-gray-500 disabled:opacity-60"
            style={{
              color: colors.neutral.dark[500],
            }}
          />
          {searchValue && (
            <button
              onClick={() => setSearchValue('')}
              className="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-gray-100"
              type="button"
            >
              <Icons.Close size={14} color={colors.gray[500]} />
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="mx-2 hidden h-5 w-px bg-gray-200 md:block" />

        {/* Inline Filters */}
        <div className="hidden items-center gap-4 text-xs text-gray-700 md:flex">
          {/* Status Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-gray-500">Status:</span>
            <Select
              value={filters.status || 'active'}
              onValueChange={handleStatusChange}
              disabled={isLoading}
            >
              <SelectTrigger className="h-auto border-0 bg-transparent p-0 text-[11px] font-medium shadow-none focus:ring-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Client Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-gray-500">Client</span>
            <Select
              value={filters.client_company || 'all'}
              onValueChange={handleClientChange}
              disabled={isLoading || clients.length === 0}
            >
              <SelectTrigger className="h-auto border-0 bg-transparent p-0 text-[11px] font-medium shadow-none focus:ring-0">
                <SelectValue placeholder="Client" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client} value={client}>
                    {client}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Period Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-gray-500">Period</span>
            <Select
              value={period}
              onValueChange={(value) => handlePeriodChange(value as PeriodOption)}
              disabled={isLoading}
            >
              <SelectTrigger className="h-auto border-0 bg-transparent p-0 text-[11px] font-medium shadow-none focus:ring-0">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="any">Any time</SelectItem>
                <SelectItem value="last_30_days">Last 30 days</SelectItem>
                <SelectItem value="last_90_days">Last 90 days</SelectItem>
                <SelectItem value="this_year">This year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search Button - styled like dashboard header search circle */}
        <button
          type="button"
          onClick={() => {
            onFilterChange({ ...filters, search: searchValue || undefined })
          }}
          disabled={isLoading}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 hover:scale-105 disabled:opacity-60"
          style={{
            backgroundColor: colors.primary[300],
          }}
          aria-label="Search projects"
        >
          <Icons.Search size={18} color={colors.neutral.dark[500]} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            type="button"
            className="h-9 rounded-full border bg-white px-4 text-xs font-medium transition-colors hover:bg-gray-50"
            style={{
              borderColor: colors.gray[300],
              color: colors.gray[700],
            }}
          >
            Clear
          </button>
        )}

        {/* Export Button */}
        <button
          onClick={onExport}
          disabled={isLoading}
          type="button"
          className="flex h-9 items-center gap-2 rounded-full border bg-white px-4 text-xs font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
          style={{
            borderColor: colors.gray[300],
            color: colors.gray[700],
          }}
        >
          <Icons.Download size={16} color={colors.gray[700]} />
          Export
        </button>
      </div>
    </div>
  )
}

export default SearchFiltersBar
