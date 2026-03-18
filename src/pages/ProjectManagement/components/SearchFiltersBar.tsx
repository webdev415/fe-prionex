/**
 * SearchFiltersBar Component
 *
 * Search and filter bar for Project Management page.
 * Includes search input, status filter, client filter, and period filter.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
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
import type { ProjectFilters } from '@/features/projects/types'
import { CreateProjectModal } from './CreateProjectModal'
import { Button } from '@/components/ui/Button'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'

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
  const { t } = useTranslation('common')

  // Use synced state for search input - automatically syncs with external changes (URL restoration)
  const [searchValue, setSearchValue] = useSyncedState(filters.search, '')

  // Detect period from restored date filters
  const initialPeriod = useMemo((): PeriodOption => {
    if (!filters.start_date_from || !filters.start_date_to) return 'any'

    const start = new Date(filters.start_date_from)
    const end = new Date(filters.start_date_to)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const daysDiff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const isEndToday = end.toDateString() === today.toDateString()

    if (!isEndToday) return 'any'
    if (daysDiff === 30) return 'last_30_days'
    if (daysDiff === 90) return 'last_90_days'

    const yearStart = new Date(today.getFullYear(), 0, 1)
    if (start.toDateString() === yearStart.toDateString()) return 'this_year'

    return 'any'
  }, [filters.start_date_from, filters.start_date_to])

  const [period, setPeriod] = useState<PeriodOption>(initialPeriod)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isFiltersDropdownOpen, setIsFiltersDropdownOpen] = useState(false)

  // Sync period when dates change externally (URL restoration)
  useEffect(() => {
    setPeriod(initialPeriod)
  }, [initialPeriod])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== filters.search) {
        onFilterChange({ ...filters, search: searchValue || undefined })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchValue, filters, onFilterChange])

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

  const handleCreateSuccess = useCallback(() => {
    setShowCreateModal(false)
    // refetch()
  }, [])

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

  return (
    <div className="mb-6 flex w-full flex-row items-center justify-between gap-3">
      {/* Search + Filters pill - styled to match dashboard header search bar */}
      <div className="flex flex-1 items-center justify-between">
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
              placeholder={t('pages.projects.searchFilters.placeholder')}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
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
                  {/* Status Filter */}
                  <div className="px-2 py-1.5">
                    <span className="text-xs font-medium text-gray-700">
                      {t('pages.projects.searchFilters.status')}:
                    </span>
                    <div className="mt-1">
                      <Select
                        value={filters.status || 'active'}
                        onValueChange={handleStatusChange}
                        disabled={isLoading}
                      >
                        <SelectTrigger className="h-8 w-full border border-gray-200 bg-white text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="active">
                            {t('pages.projects.searchFilters.statusOptions.active')}
                          </SelectItem>
                          <SelectItem value="inactive">
                            {t('pages.projects.searchFilters.statusOptions.inactive')}
                          </SelectItem>
                          <SelectItem value="archived">
                            {t('pages.projects.searchFilters.statusOptions.archived')}
                          </SelectItem>
                          <SelectItem value="all">
                            {t('pages.projects.searchFilters.statusOptions.all')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Client Filter */}
                  <div className="px-2 py-1.5">
                    <span className="text-xs font-medium text-gray-700">
                      {t('pages.projects.searchFilters.client')}:
                    </span>
                    <div className="mt-1">
                      <Select
                        value={filters.client_company || 'all'}
                        onValueChange={handleClientChange}
                        disabled={isLoading || clients.length === 0}
                      >
                        <SelectTrigger className="h-8 w-full border border-gray-200 bg-white text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="all">
                            {t('pages.projects.searchFilters.allClients')}
                          </SelectItem>
                          {clients.map((client) => (
                            <SelectItem key={client} value={client}>
                              {client}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Period Filter */}
                  <div className="px-2 py-1.5">
                    <span className="text-xs font-medium text-gray-700">
                      {t('pages.projects.searchFilters.period')}:
                    </span>
                    <div className="mt-1">
                      <Select
                        value={period}
                        onValueChange={(value) => handlePeriodChange(value as PeriodOption)}
                        disabled={isLoading}
                      >
                        <SelectTrigger className="h-8 w-full border border-gray-200 bg-white text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="any">
                            {t('pages.projects.searchFilters.periodOptions.any')}
                          </SelectItem>
                          <SelectItem value="last_30_days">
                            {t('pages.projects.searchFilters.periodOptions.last30Days')}
                          </SelectItem>
                          <SelectItem value="last_90_days">
                            {t('pages.projects.searchFilters.periodOptions.last90Days')}
                          </SelectItem>
                          <SelectItem value="this_year">
                            {t('pages.projects.searchFilters.periodOptions.thisYear')}
                          </SelectItem>
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
                {/* Status Filter */}
                <div className="flex items-center gap-1">
                  <span className="text-[14px] text-gray-500">
                    {t('pages.projects.searchFilters.status')}:
                  </span>
                  <Select
                    value={filters.status || 'active'}
                    onValueChange={handleStatusChange}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="h-auto border-0 bg-transparent p-0 text-[11px] font-medium shadow-none focus:ring-0">
                      <SelectValue placeholder={t('pages.projects.searchFilters.status')} />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="active">
                        {t('pages.projects.searchFilters.statusOptions.active')}
                      </SelectItem>
                      <SelectItem value="inactive">
                        {t('pages.projects.searchFilters.statusOptions.inactive')}
                      </SelectItem>
                      <SelectItem value="archived">
                        {t('pages.projects.searchFilters.statusOptions.archived')}
                      </SelectItem>
                      <SelectItem value="all">
                        {t('pages.projects.searchFilters.statusOptions.all')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Client Filter */}
                <div className="flex items-center gap-1">
                  <span className="text-[14px] text-gray-500">
                    {t('pages.projects.searchFilters.client')}
                  </span>
                  <Select
                    value={filters.client_company || 'all'}
                    onValueChange={handleClientChange}
                    disabled={isLoading || clients.length === 0}
                  >
                    <SelectTrigger className="h-auto border-0 bg-transparent p-0 text-[11px] font-medium shadow-none focus:ring-0">
                      <SelectValue placeholder={t('pages.projects.searchFilters.client')} />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">
                        {t('pages.projects.searchFilters.allClients')}
                      </SelectItem>
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
                  <span className="text-[14px] text-gray-500">
                    {t('pages.projects.searchFilters.period')}
                  </span>
                  <Select
                    value={period}
                    onValueChange={(value) => handlePeriodChange(value as PeriodOption)}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="h-auto border-0 bg-transparent p-0 text-[11px] font-medium shadow-none focus:ring-0">
                      <SelectValue
                        placeholder={t('pages.projects.searchFilters.periodOptions.any')}
                      />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="any">
                        {t('pages.projects.searchFilters.periodOptions.any')}
                      </SelectItem>
                      <SelectItem value="last_30_days">
                        {t('pages.projects.searchFilters.periodOptions.last30Days')}
                      </SelectItem>
                      <SelectItem value="last_90_days">
                        {t('pages.projects.searchFilters.periodOptions.last90Days')}
                      </SelectItem>
                      <SelectItem value="this_year">
                        {t('pages.projects.searchFilters.periodOptions.thisYear')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Search Button - hidden on mobile, visible on desktop */}
          <button
            type="button"
            onClick={() => {
              onFilterChange({ ...filters, search: searchValue || undefined })
            }}
            disabled={isLoading}
            className="bg-primary-300 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 hover:scale-105 disabled:opacity-60 lg:flex"
            aria-label={t('pages.projects.searchFilters.searchProjects')}
          >
            <Icons.Search size={18} className="text-dark-500" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="flex w-[30%] items-center justify-end gap-2">
        {/* Add New Project Button - icon-only on mobile/tablet, full on desktop */}
        <DoubleButton
          size="md"
          icon={<Icons.Add size={20} strokeWidth={2} />}
          iconPosition="left"
          onClick={() => setShowCreateModal(true)}
          className="hidden h-[45px] lg:flex"
        >
          {t('pages.projects.searchFilters.newProject')}
        </DoubleButton>
        {/* Mobile/Tablet: Icon-only button */}
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="bg-primary-300 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-200 hover:scale-105 lg:hidden"
          aria-label={t('pages.projects.searchFilters.newProject')}
        >
          <Icons.Add size={20} className="text-dark-500" strokeWidth={2} />
        </button>

        {/* Create Modal */}
        {showCreateModal && (
          <CreateProjectModal
            open={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSuccess={handleCreateSuccess}
          />
        )}

        {/* Export Button - icon-only on mobile/tablet, full on desktop */}
        <PermissionGuard permission={PERMISSIONS.PROJECTS.MANAGE}>
          <Button
            variant="primary"
            size="md"
            onClick={onExport}
            disabled={isLoading}
            leftIcon={<Icons.FileImport size={16} className="text-dark-500" />}
            className="hidden h-[45px] rounded-full text-xs lg:flex"
          >
            {t('pages.projects.searchFilters.export')}
          </Button>
          {/* Mobile/Tablet: Icon-only button */}
          <button
            type="button"
            onClick={onExport}
            disabled={isLoading}
            className="bg-primary-300 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-200 hover:scale-105 disabled:opacity-60 lg:hidden"
            aria-label={t('pages.projects.searchFilters.export')}
          >
            <Icons.FileImport size={18} className="text-dark-500" strokeWidth={1.5} />
          </button>
        </PermissionGuard>
      </div>
    </div>
  )
}

export default SearchFiltersBar
