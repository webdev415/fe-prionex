/**
 * SearchFiltersBar Component
 *
 * Search and filter bar for Project Management page.
 * Includes search input, status filter, client filter, and period filter.
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import type { ProjectFilters } from '@/features/projects/types'
import { CreateProjectModal } from './CreateProjectModal'
import { Button } from '@/components/ui/Button'
import { DoubleButton } from '@/components/ui/DoubleButton'

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
  const [searchValue, setSearchValue] = useState(filters.search || '')
  const [period, setPeriod] = useState<PeriodOption>('any')
  const [showCreateModal, setShowCreateModal] = useState(false)

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
    <div className="mb-6 flex w-full items-center justify-between gap-3">
      {/* Search + Filters pill - styled to match dashboard header search bar */}
      <div className="flex w-[70%] items-center justify-between">
        <div className="flex flex-1 items-center gap-3 rounded-full border border-gray-200 bg-white pr-2 pl-4 shadow-sm">
          {/* Search Input */}
          <div className="flex flex-1 items-center gap-2 py-1">
            <input
              type="text"
              placeholder={t('pages.projects.searchFilters.placeholder')}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
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
          <div className="mx-2 hidden h-5 w-px bg-gray-200 md:block" />

          {/* Inline Filters */}
          <div className="hidden items-center gap-4 text-xs text-gray-700 md:flex">
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
                  <SelectValue placeholder={t('pages.projects.searchFilters.periodOptions.any')} />
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

          {/* Search Button - styled like dashboard header search circle */}
          <button
            type="button"
            onClick={() => {
              onFilterChange({ ...filters, search: searchValue || undefined })
            }}
            disabled={isLoading}
            className="bg-primary-300 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 hover:scale-105 disabled:opacity-60"
            aria-label={t('pages.projects.searchFilters.searchProjects')}
          >
            <Icons.Search size={18} className="text-dark-500" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="flex w-[30%] items-center justify-end gap-2">
        {/* Add New Project Button */}
        <DoubleButton
          size="md"
          icon={<Icons.Add size={20} strokeWidth={2} />}
          iconPosition="left"
          onClick={() => setShowCreateModal(true)}
          className="h-[45px]"
        >
          {t('pages.projects.searchFilters.newProject')}
        </DoubleButton>

        {/* Create Modal */}
        {showCreateModal && (
          <CreateProjectModal
            open={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSuccess={handleCreateSuccess}
          />
        )}

        {/* Export Button */}
        <Button
          variant="primary"
          size="md"
          onClick={onExport}
          disabled={isLoading}
          leftIcon={<Icons.FileImport size={16} className="text-dark-500" />}
          className="h-[45px] rounded-full text-xs"
        >
          {t('pages.projects.searchFilters.export')}
        </Button>
      </div>
    </div>
  )
}

export default SearchFiltersBar
