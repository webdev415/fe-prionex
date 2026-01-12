/**
 * SearchFiltersBar Component for Audit Logs
 *
 * Search and filter bar for Audit Logs page.
 * Includes search input, status filter, client filter, period filter,
 * and additional filters (date range, user, entity, action, role, quick ranges).
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { DateSelect } from '@/components/ui/DateSelect'
import { Button } from '@/components/ui/Button'
import type { AuditLogFilters } from '../AuditLogsPage'
import { Input } from '@/components/ui/Input'
import { UserFilterDropdown } from './UserFilterDropdown'

interface SearchFiltersBarProps {
  filters: AuditLogFilters
  onFilterChange: (filters: AuditLogFilters) => void
  users: string[]
  entityTypes: string[]
  actions: string[]
  isLoading?: boolean
}

type PeriodOption = 'any' | 'today' | 'yesterday' | 'last_7' | 'last_30'

export function SearchFiltersBar({
  filters,
  onFilterChange,
  users,
  entityTypes,
  actions,
  isLoading = false,
}: SearchFiltersBarProps) {
  const { t } = useTranslation('common')
  const [searchValue, setSearchValue] = useState(filters.search || '')
  const [period, setPeriod] = useState<PeriodOption>('any')
  const [localFilters, setLocalFilters] = useState<AuditLogFilters>(filters)
  const [isFiltersDropdownOpen, setIsFiltersDropdownOpen] = useState(false)

  // Update local filters when props change
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setLocalFilters(filters)
    setSearchValue(filters.search || '')
  }, [filters])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Close filters dropdown when screen size crosses breakpoint
  useEffect(() => {
    let wasMobile = window.innerWidth < 1024 // lg breakpoint

    const handleResize = () => {
      const isMobile = window.innerWidth < 1024

      if (wasMobile !== isMobile && isFiltersDropdownOpen) {
        setIsFiltersDropdownOpen(false)
      }

      wasMobile = isMobile
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isFiltersDropdownOpen])

  const handlePeriodChange = useCallback(
    (value: PeriodOption) => {
      setPeriod(value)

      const today = new Date()
      const formatDate = (date: Date) => date.toISOString().slice(0, 10)

      let date_from: string | undefined
      let date_to: string | undefined

      switch (value) {
        case 'today': {
          date_from = formatDate(today)
          date_to = formatDate(today)
          break
        }
        case 'yesterday': {
          const yesterday = new Date(today)
          yesterday.setDate(yesterday.getDate() - 1)
          date_from = formatDate(yesterday)
          date_to = formatDate(yesterday)
          break
        }
        case 'last_7': {
          const from = new Date(today)
          from.setDate(from.getDate() - 7)
          date_from = formatDate(from)
          date_to = formatDate(today)
          break
        }
        case 'last_30': {
          const from = new Date(today)
          from.setDate(from.getDate() - 30)
          date_from = formatDate(from)
          date_to = formatDate(today)
          break
        }
        case 'any':
        default: {
          date_from = undefined
          date_to = undefined
        }
      }

      setLocalFilters({
        ...localFilters,
        date_from,
        date_to,
      })
    },
    [localFilters]
  )

  const handleUserChange = useCallback(
    (users: string[]) => {
      setLocalFilters({
        ...localFilters,
        users: users.length > 0 ? users : undefined,
        user: undefined, // Clear old single user filter
      })
    },
    [localFilters]
  )

  const handleEntityTypeChange = useCallback(
    (value: string) => {
      setLocalFilters({
        ...localFilters,
        entity_type: value === 'all' ? undefined : value,
      })
    },
    [localFilters]
  )

  const handleActionChange = useCallback(
    (value: string) => {
      setLocalFilters({
        ...localFilters,
        action: value === 'all' ? undefined : value,
      })
    },
    [localFilters]
  )

  const handleDateFromChange = useCallback(
    (args: { value: Date | null }) => {
      const date = args.value
      const dateStr = date ? date.toISOString().split('T')[0] : ''
      setLocalFilters({
        ...localFilters,
        date_from: dateStr || undefined,
      })
    },
    [localFilters]
  )

  const handleDateToChange = useCallback(
    (args: { value: Date | null }) => {
      const date = args.value
      const dateStr = date ? date.toISOString().split('T')[0] : ''
      setLocalFilters({
        ...localFilters,
        date_to: dateStr || undefined,
      })
    },
    [localFilters]
  )

  const handleApplyFilters = useCallback(() => {
    onFilterChange({ ...localFilters, search: searchValue || undefined })
  }, [localFilters, searchValue, onFilterChange])

  const handleClearAll = useCallback(() => {
    setSearchValue('')
    setPeriod('any')
    const clearedFilters: AuditLogFilters = {
      search: undefined,
      date_from: undefined,
      date_to: undefined,
      user: undefined,
      users: undefined,
      action: undefined,
      entity_type: undefined,
      role: undefined,
    }
    setLocalFilters(clearedFilters)
    onFilterChange(clearedFilters)
  }, [onFilterChange])

  // Memoize date values to prevent unnecessary re-renders and ensure proper date comparison
  const dateFromValue = useMemo(() => {
    if (!localFilters.date_from) return null
    // Create date at local midnight to avoid timezone issues
    const [year, month, day] = localFilters.date_from.split('-').map(Number)
    return new Date(year, month - 1, day)
  }, [localFilters.date_from])

  const dateToValue = useMemo(() => {
    if (!localFilters.date_to) return null
    // Create date at local midnight to avoid timezone issues
    const [year, month, day] = localFilters.date_to.split('-').map(Number)
    return new Date(year, month - 1, day)
  }, [localFilters.date_to])

  const dateFromMax = useMemo(() => {
    if (!localFilters.date_to) return undefined
    const [year, month, day] = localFilters.date_to.split('-').map(Number)
    return new Date(year, month - 1, day)
  }, [localFilters.date_to])

  const dateToMin = useMemo(() => {
    if (!localFilters.date_from) return undefined
    const [year, month, day] = localFilters.date_from.split('-').map(Number)
    return new Date(year, month - 1, day)
  }, [localFilters.date_from])

  return (
    <div className="mb-4 flex flex-col items-start gap-3 self-stretch rounded-xl bg-white/50 p-6">
      <div className="flex flex-col items-center gap-6 self-stretch">
        {/* Advanced Filters Section */}
        <div className="flex flex-col items-center gap-7 self-stretch">
          <div className="flex items-center gap-10 self-stretch">
            {/* Date Range */}
            <div className="flex flex-1 flex-col items-end gap-5">
              <div className="flex items-center gap-3 self-stretch">
                <span className="text-dark-500 w-[100px] text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {t('pages.auditLogs.searchFilters.dateRange')}:
                </span>
                <DateSelect
                  key={`date-from-${localFilters.date_from || 'empty'}`}
                  value={dateFromValue}
                  onChange={handleDateFromChange}
                  placeholder={t('pages.auditLogs.searchFilters.selectStartDate')}
                  disabled={isLoading}
                  max={dateFromMax}
                  format="MM/dd/yyyy"
                  className="flex-1 [&_input]:h-9 [&_input]:text-xs"
                />
                <span className="text-base leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                  -
                </span>
                <DateSelect
                  key={`date-to-${localFilters.date_to || 'empty'}`}
                  value={dateToValue}
                  onChange={handleDateToChange}
                  placeholder={t('pages.auditLogs.searchFilters.selectEndDate')}
                  disabled={isLoading}
                  min={dateToMin}
                  format="MM/dd/yyyy"
                  className="flex-1 [&_input]:h-9 [&_input]:text-xs"
                />
              </div>
            </div>
            {/* Quick Ranges */}
            <div className="flex flex-1 items-center gap-3">
              <span className="text-dark-500 w-[100px] text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.auditLogs.searchFilters.quickRanges')}:
              </span>
              <div className="flex flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePeriodChange('today')}
                  className={cn(
                    'text-dark-500 flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-xs leading-[140%] font-medium tracking-[-0.24px] shadow-sm',
                    period === 'today' ? 'bg-primary-300 text-white' : 'hover:bg-gray-50'
                  )}
                >
                  {t('pages.auditLogs.searchFilters.today')}
                </button>
                <button
                  type="button"
                  onClick={() => handlePeriodChange('yesterday')}
                  className={cn(
                    'text-dark-500 flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-xs leading-[140%] font-medium tracking-[-0.24px] shadow-sm',
                    period === 'yesterday' ? 'bg-primary-300 text-white' : 'hover:bg-gray-50'
                  )}
                >
                  {t('pages.auditLogs.searchFilters.yesterday')}
                </button>
                <button
                  type="button"
                  onClick={() => handlePeriodChange('last_7')}
                  className={cn(
                    'text-dark-500 flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-xs leading-[140%] font-medium tracking-[-0.24px] shadow-sm',
                    period === 'last_7' ? 'bg-primary-300 text-white' : 'hover:bg-gray-50'
                  )}
                >
                  {t('pages.auditLogs.searchFilters.last7')}
                </button>
                <button
                  type="button"
                  onClick={() => handlePeriodChange('last_30')}
                  className={cn(
                    'text-dark-500 flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-xs leading-[140%] font-medium tracking-[-0.24px] shadow-sm',
                    period === 'last_30' ? 'bg-primary-300 text-white' : 'hover:bg-gray-50'
                  )}
                >
                  {t('pages.auditLogs.searchFilters.last30')}
                </button>
              </div>
            </div>
          </div>
          <div className="h-px w-full bg-gray-200" />
          <div className="flex items-start gap-10 self-stretch">
            {/* User Filter */}
            <div className="flex min-w-[220px] flex-1 items-center gap-3">
              <span className="text-dark-500 w-12 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.auditLogs.searchFilters.user')}:
              </span>
              <UserFilterDropdown
                users={users}
                selectedUsers={localFilters.users || []}
                onUserChange={handleUserChange}
                disabled={isLoading}
                trigger={
                  <button
                    type="button"
                    disabled={isLoading}
                    className="text-dark-500 focus:border-primary-500 flex h-[45px] w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="truncate text-left">
                      {localFilters.users && localFilters.users.length > 0
                        ? localFilters.users.length === users.length
                          ? t('pages.auditLogs.searchFilters.allUsers')
                          : localFilters.users.length === 1
                            ? localFilters.users[0]
                            : `${localFilters.users.length} users selected`
                        : t('pages.auditLogs.searchFilters.allUsers')}
                    </span>
                    <Icons.ArrowDown size={16} className="shrink-0 text-gray-400" />
                  </button>
                }
              />
            </div>
            {/* Action Filter */}
            <div className="flex min-w-[220px] flex-1 items-center gap-3">
              <span className="text-dark-500 w-12 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.auditLogs.searchFilters.action')}:
              </span>
              <Select
                value={localFilters.action || 'all'}
                onValueChange={handleActionChange}
                disabled={isLoading}
              >
                <SelectTrigger className="max-h-[45px] w-full rounded-md border border-gray-200 bg-white text-xs">
                  <SelectValue placeholder={t('pages.auditLogs.searchFilters.selectSearcher')} />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Actions</SelectItem>
                  {actions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Entity Filter */}
            <div className="flex min-w-[220px] flex-1 items-center gap-3">
              <span className="text-dark-500 w-12 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.auditLogs.searchFilters.entity')}:
              </span>
              <Select
                value={localFilters.entity_type || 'all'}
                onValueChange={handleEntityTypeChange}
                disabled={isLoading}
              >
                <SelectTrigger className="max-h-[45px] w-full rounded-md border border-gray-200 bg-white text-xs">
                  <SelectValue placeholder={t('pages.auditLogs.searchFilters.allTypes')} />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Types</SelectItem>
                  {entityTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-start gap-10 self-stretch">
            {/* Role Filter */}
            <div className="flex min-w-[220px] flex-1 items-center gap-3">
              <span className="text-dark-500 w-12 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.auditLogs.searchFilters.role')}:
              </span>
              <Select
                value={localFilters.role || 'all'}
                onValueChange={(value) =>
                  setLocalFilters({
                    ...localFilters,
                    role: value === 'all' ? undefined : value,
                  })
                }
                disabled={isLoading}
              >
                <SelectTrigger className="max-h-[45px] w-full rounded-md border border-gray-200 bg-white text-xs">
                  <SelectValue placeholder={t('pages.auditLogs.searchFilters.selectRole')} />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Roles</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Search Input */}
            <div className="flex min-w-[220px] flex-1 items-center gap-3">
              <span className="text-dark-500 w-12 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.auditLogs.searchFilters.search')}:
              </span>
              <Input
                type="text"
                placeholder={t('pages.auditLogs.searchFilters.placeholder')}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="max-h-[45px] flex-1 rounded-md border border-gray-200 bg-white text-xs"
              />
            </div>
            {/* Action Buttons */}
            <div className="flex flex-1 items-center justify-end gap-6">
              <Button
                type="button"
                variant="secondary"
                onClick={handleApplyFilters}
                className="h-[45px] flex-1 rounded"
                disabled={isLoading}
              >
                {t('pages.auditLogs.searchFilters.applyFilters')}
              </Button>
              <Button
                type="button"
                variant="white-secondary"
                onClick={handleClearAll}
                className="h-[45px] flex-1 rounded"
                leftIcon={<Icons.Reload size={16} />}
              >
                {t('pages.auditLogs.searchFilters.clearAll')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SearchFiltersBar
