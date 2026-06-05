/**
 * SearchFiltersBar Component for Audit Logs
 *
 * Search and filter bar for Audit Logs page.
 * Includes search input, status filter, client filter, period filter,
 * and additional filters (date range, user, entity, action, role, quick ranges).
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
import { DateSelect } from '@/components/ui/DateSelect'
import { Button } from '@/components/ui/Button'
import type { AuditLogFilters } from '../AuditLogsPage'
import { Input } from '@/components/ui/Input'
import { UserFilterDropdown } from './UserFilterDropdown'
import { FilterDropdown } from './FilterDropdown'

interface SearchFiltersBarProps {
  filters: AuditLogFilters
  onFilterChange: (filters: AuditLogFilters) => void
  users: string[]
  roles: string[]
  entityTypes: string[]
  actions: string[]
  isLoading?: boolean
}

type PeriodOption = 'any' | 'today' | 'yesterday' | 'last_7' | 'last_30'

export function SearchFiltersBar({
  filters,
  onFilterChange,
  users,
  roles,
  entityTypes,
  actions,
  isLoading = false,
}: SearchFiltersBarProps) {
  const { t } = useTranslation('common')

  // Use synced state for search input - automatically syncs with external changes (URL restoration)
  const [searchValue, setSearchValue] = useSyncedState(filters.search, '')

  // Helper function to detect period from date range values
  const detectPeriodFromDates = useCallback(
    (dateFrom: string | undefined, dateTo: string | undefined): PeriodOption => {
      if (!dateFrom || !dateTo) return 'any'

      const start = new Date(dateFrom)
      const end = new Date(dateTo)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      start.setHours(0, 0, 0, 0)
      end.setHours(0, 0, 0, 0)

      const daysDiff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      const isEndToday = end.toDateString() === today.toDateString()
      const isStartToday = start.toDateString() === today.toDateString()

      // Today: same day and it's today
      if (daysDiff === 0 && isStartToday && isEndToday) return 'today'

      // Yesterday: same day and it's yesterday
      if (daysDiff === 0) {
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        if (
          start.toDateString() === yesterday.toDateString() &&
          end.toDateString() === yesterday.toDateString()
        ) {
          return 'yesterday'
        }
      }

      // Last 7 days: 7 days difference and ends today
      if (daysDiff === 7 && isEndToday) return 'last_7'

      // Last 30 days: 30 days difference and ends today
      if (daysDiff === 30 && isEndToday) return 'last_30'

      return 'any'
    },
    []
  )

  // Detect period from restored date filters (for initial state)
  const initialPeriod = useMemo((): PeriodOption => {
    return detectPeriodFromDates(filters.date_from, filters.date_to)
  }, [filters.date_from, filters.date_to, detectPeriodFromDates])

  const [localFilters, setLocalFilters] = useState<AuditLogFilters>(filters)
  const [isFiltersDropdownOpen, setIsFiltersDropdownOpen] = useState(false)

  // Track if period was manually set by user clicking a quick range button
  const periodManuallySetRef = useRef(false)

  // Compute period from localFilters - this will update automatically when dates change
  const computedPeriod = useMemo((): PeriodOption => {
    return detectPeriodFromDates(localFilters.date_from, localFilters.date_to)
  }, [localFilters.date_from, localFilters.date_to, detectPeriodFromDates])

  // Use state for period to allow manual selection, but sync with computed period when dates change manually
  const [period, setPeriod] = useState<PeriodOption>(initialPeriod)

  // Sync period state with computed period when dates change manually (not from quick range button)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Only update period if it wasn't manually set by user clicking a button
    // When user clicks a quick range button, periodManuallySetRef is set to true
    // When dates change manually, periodManuallySetRef is false, so we sync
    if (!periodManuallySetRef.current) {
      setPeriod(computedPeriod)
    } else {
      // Reset the flag after syncing, so next manual date change will update period
      periodManuallySetRef.current = false
    }
  }, [computedPeriod])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Sync local filters when props change externally (URL restoration)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setLocalFilters(filters)
    const newPeriod = detectPeriodFromDates(filters.date_from, filters.date_to)
    setPeriod(newPeriod)
    periodManuallySetRef.current = false
  }, [filters, detectPeriodFromDates])
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

  // Helper function to format date in local timezone (YYYY-MM-DD)
  const formatDateLocal = useCallback((date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  const handlePeriodChange = useCallback(
    (value: PeriodOption) => {
      periodManuallySetRef.current = true // Mark that period was manually set
      setPeriod(value)

      const today = new Date()
      today.setHours(0, 0, 0, 0) // Set to local midnight to avoid timezone issues

      let date_from: string | undefined
      let date_to: string | undefined

      switch (value) {
        case 'today': {
          date_from = formatDateLocal(today)
          date_to = formatDateLocal(today)
          break
        }
        case 'yesterday': {
          const yesterday = new Date(today)
          yesterday.setDate(yesterday.getDate() - 1)
          date_from = formatDateLocal(yesterday)
          date_to = formatDateLocal(yesterday)
          break
        }
        case 'last_7': {
          const from = new Date(today)
          from.setDate(from.getDate() - 7)
          date_from = formatDateLocal(from)
          date_to = formatDateLocal(today)
          break
        }
        case 'last_30': {
          const from = new Date(today)
          from.setDate(from.getDate() - 30)
          date_from = formatDateLocal(from)
          date_to = formatDateLocal(today)
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
    [localFilters, formatDateLocal]
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
    (entityTypes: string[]) => {
      setLocalFilters({
        ...localFilters,
        entity_types: entityTypes.length > 0 ? entityTypes : undefined,
        entity_type: undefined, // Clear old single entity filter
      })
    },
    [localFilters]
  )

  const handleActionChange = useCallback(
    (actions: string[]) => {
      setLocalFilters({
        ...localFilters,
        actions: actions.length > 0 ? actions : undefined,
        action: undefined, // Clear old single action filter
      })
    },
    [localFilters]
  )

  const handleDateFromChange = useCallback(
    (args: { value: Date | null }) => {
      const date = args.value
      const dateStr = date ? formatDateLocal(date) : ''
      const newFilters = {
        ...localFilters,
        date_from: dateStr || undefined,
      }
      setLocalFilters(newFilters)
      // Period will be updated automatically by the useEffect that watches date_from/date_to
    },
    [localFilters, formatDateLocal]
  )

  const handleDateToChange = useCallback(
    (args: { value: Date | null }) => {
      const date = args.value
      const dateStr = date ? formatDateLocal(date) : ''
      const newFilters = {
        ...localFilters,
        date_to: dateStr || undefined,
      }
      setLocalFilters(newFilters)
      // Period will be updated automatically by the useEffect that watches date_from/date_to
    },
    [localFilters, formatDateLocal]
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
      actions: undefined,
      entity_type: undefined,
      entity_types: undefined,
      role: undefined,
    }
    setLocalFilters(clearedFilters)
    onFilterChange(clearedFilters)
  }, [onFilterChange, setSearchValue])

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
    <div className="mb-4 flex flex-col items-start gap-3 self-stretch rounded-xl bg-white/50 p-3 sm:p-6">
      <div className="flex flex-col items-center gap-4 self-stretch sm:gap-6">
        {/* Advanced Filters Section */}
        <div className="flex flex-col items-center gap-4 self-stretch sm:gap-7">
          {/* Date Range and Quick Ranges */}
          <div className="flex flex-col gap-4 self-stretch xl:flex-row xl:items-center xl:gap-10">
            {/* Date Range */}
            <div className="flex flex-1 flex-col gap-2 self-stretch sm:items-end sm:gap-5">
              <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-3">
                <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:w-[100px] sm:text-sm">
                  {t('pages.auditLogs.searchFilters.dateRange')}:
                </span>
                <div className="flex flex-1 items-center gap-2">
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
            </div>
            {/* Quick Ranges */}
            <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-3 xl:flex-1">
              <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:w-[100px] sm:text-sm">
                {t('pages.auditLogs.searchFilters.quickRanges')}:
              </span>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-1 sm:items-center sm:gap-2">
                <button
                  type="button"
                  onClick={() => handlePeriodChange('today')}
                  className={cn(
                    'text-dark-500 flex cursor-pointer items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-xs leading-[140%] font-medium tracking-[-0.24px] shadow-sm sm:flex-1 sm:px-4',
                    period === 'today' ? 'bg-primary-500 text-white' : 'hover:bg-gray-50'
                  )}
                >
                  {t('pages.auditLogs.searchFilters.today')}
                </button>
                <button
                  type="button"
                  onClick={() => handlePeriodChange('yesterday')}
                  className={cn(
                    'text-dark-500 flex cursor-pointer items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-xs leading-[140%] font-medium tracking-[-0.24px] shadow-sm sm:flex-1 sm:px-4',
                    period === 'yesterday' ? 'bg-primary-500 text-white' : 'hover:bg-gray-50'
                  )}
                >
                  {t('pages.auditLogs.searchFilters.yesterday')}
                </button>
                <button
                  type="button"
                  onClick={() => handlePeriodChange('last_7')}
                  className={cn(
                    'text-dark-500 flex cursor-pointer items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-xs leading-[140%] font-medium tracking-[-0.24px] shadow-sm sm:flex-1 sm:px-4',
                    period === 'last_7' ? 'bg-primary-500 text-white' : 'hover:bg-gray-50'
                  )}
                >
                  {t('pages.auditLogs.searchFilters.last7')}
                </button>
                <button
                  type="button"
                  onClick={() => handlePeriodChange('last_30')}
                  className={cn(
                    'text-dark-500 flex cursor-pointer items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-xs leading-[140%] font-medium tracking-[-0.24px] shadow-sm sm:flex-1 sm:px-4',
                    period === 'last_30' ? 'bg-primary-500 text-white' : 'hover:bg-gray-50'
                  )}
                >
                  {t('pages.auditLogs.searchFilters.last30')}
                </button>
              </div>
            </div>
          </div>
          <div className="h-px w-full bg-gray-200" />
          {/* Filters Row 1: User, Action, Entity */}
          <div className="flex flex-col gap-4 self-stretch lg:flex-row lg:items-start lg:gap-6 lg:gap-10">
            {/* User Filter */}
            <div className="flex flex-col gap-2 self-stretch sm:min-w-[220px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:w-19 sm:text-sm">
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
            <div className="flex flex-col gap-2 self-stretch sm:min-w-[220px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:w-19 sm:text-sm">
                {t('pages.auditLogs.searchFilters.action')}:
              </span>
              <FilterDropdown
                items={actions}
                selectedItems={localFilters.actions || []}
                onItemChange={handleActionChange}
                disabled={isLoading}
                allItemsLabel="All Actions"
                searchPlaceholder="Search actions"
                noItemsFoundLabel="No actions found"
                trigger={
                  <button
                    type="button"
                    disabled={isLoading}
                    className="text-dark-500 focus:border-primary-500 flex h-[45px] w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="truncate text-left">
                      {localFilters.actions && localFilters.actions.length > 0
                        ? localFilters.actions.length === actions.length
                          ? 'All Actions'
                          : localFilters.actions.length === 1
                            ? localFilters.actions[0]
                            : `${localFilters.actions.length} actions selected`
                        : 'All Actions'}
                    </span>
                    <Icons.ArrowDown size={16} className="shrink-0 text-gray-400" />
                  </button>
                }
              />
            </div>
            {/* Entity Filter */}
            <div className="flex flex-col gap-2 self-stretch sm:min-w-[220px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:w-19 sm:text-sm">
                {t('pages.auditLogs.searchFilters.entity')}:
              </span>
              <FilterDropdown
                items={entityTypes}
                selectedItems={localFilters.entity_types || []}
                onItemChange={handleEntityTypeChange}
                disabled={isLoading}
                allItemsLabel="All Types"
                searchPlaceholder="Search entity types"
                noItemsFoundLabel="No entity types found"
                trigger={
                  <button
                    type="button"
                    disabled={isLoading}
                    className="text-dark-500 focus:border-primary-500 flex h-[45px] w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="truncate text-left">
                      {localFilters.entity_types && localFilters.entity_types.length > 0
                        ? localFilters.entity_types.length === entityTypes.length
                          ? 'All Types'
                          : localFilters.entity_types.length === 1
                            ? localFilters.entity_types[0]
                            : `${localFilters.entity_types.length} types selected`
                        : 'All Types'}
                    </span>
                    <Icons.ArrowDown size={16} className="shrink-0 text-gray-400" />
                  </button>
                }
              />
            </div>
          </div>
          {/* Filters Row 2: Role, Search, Buttons */}
          <div className="flex flex-col gap-4 self-stretch lg:flex-row lg:items-start lg:gap-6 lg:gap-10">
            {/* Role Filter */}
            <div className="flex flex-col gap-2 self-stretch sm:min-w-[220px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:w-19 sm:text-sm">
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
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Search Input */}
            <div className="flex flex-col gap-2 self-stretch sm:min-w-[220px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:w-19 sm:text-sm">
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
            <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:justify-end sm:gap-4 lg:flex-1 lg:gap-6">
              <Button
                type="button"
                variant="secondary"
                onClick={handleApplyFilters}
                className="h-[45px] w-full rounded sm:flex-1"
                disabled={isLoading}
              >
                {t('pages.auditLogs.searchFilters.applyFilters')}
              </Button>
              <Button
                type="button"
                variant="white-secondary"
                onClick={handleClearAll}
                className="h-[45px] w-full rounded sm:flex-1"
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
