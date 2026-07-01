import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSyncedState } from '@/hooks'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DateSelect } from '@/components/ui/DateSelect'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { MESSAGING_CAMPAIGN_STATUSES, MESSAGING_CHANNELS } from '@/features/messaging'

export interface CampaignAnalyticsFilters {
  search?: string
  status: string
  channel: string
  launched_from?: string
  launched_to?: string
  launcher: string
}

interface LauncherOption {
  id: number
  label: string
}

interface CampaignAnalyticsFiltersBarProps {
  filters: CampaignAnalyticsFilters
  onFilterChange: (filters: CampaignAnalyticsFilters) => void
  launcherOptions: LauncherOption[]
  isLoading?: boolean
}

type PeriodOption = 'any' | 'today' | 'yesterday' | 'last_7' | 'last_30'

const DEFAULT_FILTERS: CampaignAnalyticsFilters = {
  status: 'all',
  channel: 'all',
  launcher: 'all',
}

const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const detectPeriodFromDates = (
  dateFrom: string | undefined,
  dateTo: string | undefined
): PeriodOption => {
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

  if (daysDiff === 0 && isStartToday && isEndToday) return 'today'

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

  if (daysDiff === 7 && isEndToday) return 'last_7'
  if (daysDiff === 30 && isEndToday) return 'last_30'

  return 'any'
}

const formatStatusFallback = (value: string) =>
  value
    .split('_')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
    .join(' ')

export function CampaignAnalyticsFiltersBar({
  filters,
  onFilterChange,
  launcherOptions,
  isLoading = false,
}: CampaignAnalyticsFiltersBarProps) {
  const { t } = useTranslation('common')
  const [searchValue, setSearchValue] = useSyncedState(filters.search, '')
  const [localFilters, setLocalFilters] = useState<CampaignAnalyticsFilters>(filters)

  const initialPeriod = useMemo(
    () => detectPeriodFromDates(filters.launched_from, filters.launched_to),
    [filters.launched_from, filters.launched_to]
  )

  const periodManuallySetRef = useRef(false)
  const computedPeriod = useMemo(
    () => detectPeriodFromDates(localFilters.launched_from, localFilters.launched_to),
    [localFilters.launched_from, localFilters.launched_to]
  )
  const [period, setPeriod] = useState<PeriodOption>(initialPeriod)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!periodManuallySetRef.current) {
      setPeriod(computedPeriod)
    } else {
      periodManuallySetRef.current = false
    }
  }, [computedPeriod])

  useEffect(() => {
    setLocalFilters(filters)
    setPeriod(detectPeriodFromDates(filters.launched_from, filters.launched_to))
    periodManuallySetRef.current = false
  }, [filters])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handlePeriodChange = useCallback(
    (value: PeriodOption) => {
      periodManuallySetRef.current = true
      setPeriod(value)

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      let launched_from: string | undefined
      let launched_to: string | undefined

      switch (value) {
        case 'today': {
          launched_from = formatDateLocal(today)
          launched_to = formatDateLocal(today)
          break
        }
        case 'yesterday': {
          const yesterday = new Date(today)
          yesterday.setDate(yesterday.getDate() - 1)
          launched_from = formatDateLocal(yesterday)
          launched_to = formatDateLocal(yesterday)
          break
        }
        case 'last_7': {
          const from = new Date(today)
          from.setDate(from.getDate() - 7)
          launched_from = formatDateLocal(from)
          launched_to = formatDateLocal(today)
          break
        }
        case 'last_30': {
          const from = new Date(today)
          from.setDate(from.getDate() - 30)
          launched_from = formatDateLocal(from)
          launched_to = formatDateLocal(today)
          break
        }
        case 'any':
        default: {
          launched_from = undefined
          launched_to = undefined
        }
      }

      setLocalFilters({
        ...localFilters,
        launched_from,
        launched_to,
      })
    },
    [localFilters]
  )

  const handleDateFromChange = useCallback(
    (args: { value: Date | null }) => {
      const dateStr = args.value ? formatDateLocal(args.value) : undefined
      setLocalFilters({
        ...localFilters,
        launched_from: dateStr,
      })
    },
    [localFilters]
  )

  const handleDateToChange = useCallback(
    (args: { value: Date | null }) => {
      const dateStr = args.value ? formatDateLocal(args.value) : undefined
      setLocalFilters({
        ...localFilters,
        launched_to: dateStr,
      })
    },
    [localFilters]
  )

  const handleApplyFilters = useCallback(() => {
    onFilterChange({
      ...localFilters,
      search: searchValue.trim() || undefined,
    })
  }, [localFilters, onFilterChange, searchValue])

  const handleClearAll = useCallback(() => {
    setSearchValue('')
    setPeriod('any')
    setLocalFilters(DEFAULT_FILTERS)
    onFilterChange(DEFAULT_FILTERS)
  }, [onFilterChange, setSearchValue])

  const dateFromValue = useMemo(() => {
    if (!localFilters.launched_from) return null
    const [year, month, day] = localFilters.launched_from.split('-').map(Number)
    return new Date(year, month - 1, day)
  }, [localFilters.launched_from])

  const dateToValue = useMemo(() => {
    if (!localFilters.launched_to) return null
    const [year, month, day] = localFilters.launched_to.split('-').map(Number)
    return new Date(year, month - 1, day)
  }, [localFilters.launched_to])

  const dateFromMax = useMemo(() => {
    if (!localFilters.launched_to) return undefined
    const [year, month, day] = localFilters.launched_to.split('-').map(Number)
    return new Date(year, month - 1, day)
  }, [localFilters.launched_to])

  const dateToMin = useMemo(() => {
    if (!localFilters.launched_from) return undefined
    const [year, month, day] = localFilters.launched_from.split('-').map(Number)
    return new Date(year, month - 1, day)
  }, [localFilters.launched_from])

  const statusOptions = useMemo(
    () => [
      {
        id: 'all',
        name: t('pages.messagingCampaigns.filters.allStatuses', 'All statuses'),
      },
      ...MESSAGING_CAMPAIGN_STATUSES.map((status) => ({
        id: status,
        name: t(`pages.messagingCampaigns.status.${status}`, formatStatusFallback(status)),
      })),
    ],
    [t]
  )

  const channelOptions = useMemo(
    () => [
      {
        id: 'all',
        name: t('pages.messagingCampaigns.filters.allChannels', 'All channels'),
      },
      ...MESSAGING_CHANNELS.map((channel) => ({
        id: channel,
        name: channel.toUpperCase(),
      })),
    ],
    [t]
  )

  const launcherSelectOptions = useMemo(
    () => [
      {
        id: 'all',
        name: t('pages.messagingCampaigns.filters.allLaunchers', 'All launchers'),
      },
      ...launcherOptions.map((operator) => ({
        id: String(operator.id),
        name: operator.label,
      })),
    ],
    [launcherOptions, t]
  )

  const filterDropdownClassName =
    '[&_button]:max-h-[45px] [&_button]:rounded-md [&_button]:border-gray-200 [&_button]:text-xs [&_button]:shadow-none'

  return (
    <div className="mb-4 flex flex-col items-start gap-3 self-stretch rounded-xl bg-white/50 p-3 sm:p-6">
      <div className="flex flex-col items-center gap-4 self-stretch sm:gap-6">
        <div className="flex flex-col items-center gap-4 self-stretch sm:gap-7">
          <div className="flex flex-col gap-4 self-stretch xl:flex-row xl:items-center xl:gap-10">
            <div className="flex flex-1 flex-col gap-2 self-stretch sm:items-end sm:gap-5">
              <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-3">
                <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:w-[100px] sm:text-sm">
                  {t('pages.auditLogs.searchFilters.dateRange')}:
                </span>
                <div className="flex flex-1 items-center gap-2">
                  <DateSelect
                    key={`campaign-date-from-${localFilters.launched_from || 'empty'}`}
                    value={dateFromValue}
                    onChange={handleDateFromChange}
                    placeholder={t('pages.auditLogs.searchFilters.selectStartDate')}
                    disabled={isLoading}
                    max={dateFromMax}
                    allowManualInput
                    format="dd.MM.yyyy"
                    className="flex-1 [&_input]:h-9 [&_input]:text-xs"
                  />
                  <span className="text-base leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                    -
                  </span>
                  <DateSelect
                    key={`campaign-date-to-${localFilters.launched_to || 'empty'}`}
                    value={dateToValue}
                    onChange={handleDateToChange}
                    placeholder={t('pages.auditLogs.searchFilters.selectEndDate')}
                    disabled={isLoading}
                    min={dateToMin}
                    allowManualInput
                    format="dd.MM.yyyy"
                    className="flex-1 [&_input]:h-9 [&_input]:text-xs"
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-3 xl:flex-1">
              <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:w-[100px] sm:text-sm">
                {t('pages.auditLogs.searchFilters.quickRanges')}:
              </span>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-1 sm:items-center sm:gap-2">
                {(
                  [
                    ['today', t('pages.auditLogs.searchFilters.today')],
                    ['yesterday', t('pages.auditLogs.searchFilters.yesterday')],
                    ['last_7', t('pages.auditLogs.searchFilters.last7')],
                    ['last_30', t('pages.auditLogs.searchFilters.last30')],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handlePeriodChange(key)}
                    disabled={isLoading}
                    className={cn(
                      'text-dark-500 flex cursor-pointer items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-xs leading-[140%] font-medium tracking-[-0.24px] shadow-sm disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1 sm:px-4',
                      period === key ? 'bg-primary-500 text-white' : 'hover:bg-gray-50'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-gray-200" />

          <div className="flex flex-col gap-4 self-stretch lg:flex-row lg:items-start lg:gap-10">
            <div className="flex flex-col gap-2 self-stretch sm:min-w-[200px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:w-[100px] sm:text-sm">
                {t('pages.messagingCampaigns.filters.searchLabel', 'Search')}:
              </span>
              <Input
                type="text"
                placeholder={t(
                  'pages.messagingCampaigns.filters.searchPlaceholder',
                  'Search campaign, code, or service'
                )}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                className="max-h-[45px] flex-1 rounded-md border border-gray-200 bg-white text-xs"
                disabled={isLoading}
              />
            </div>

            <div className="flex flex-col gap-2 self-stretch sm:min-w-[180px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:w-[100px] sm:text-sm">
                {t('pages.messagingCampaigns.filters.status', 'Status')}:
              </span>
              <SearchableSelect
                options={statusOptions}
                value={localFilters.status}
                onValueChange={(value) => setLocalFilters({ ...localFilters, status: value })}
                placeholder={t('pages.messagingCampaigns.filters.allStatuses', 'All statuses')}
                searchable={false}
                disabled={isLoading}
                className={filterDropdownClassName}
              />
            </div>

            <div className="flex flex-col gap-2 self-stretch sm:min-w-[180px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:w-[100px] sm:text-sm">
                {t('pages.messagingCampaigns.filters.channel', 'Channel')}:
              </span>
              <SearchableSelect
                options={channelOptions}
                value={localFilters.channel}
                onValueChange={(value) => setLocalFilters({ ...localFilters, channel: value })}
                placeholder={t('pages.messagingCampaigns.filters.allChannels', 'All channels')}
                searchable={false}
                disabled={isLoading}
                className={filterDropdownClassName}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 self-stretch lg:flex-row lg:items-start lg:gap-10">
            <div className="flex flex-col gap-2 self-stretch sm:min-w-[220px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:w-[100px] sm:text-sm">
                {t('pages.messagingCampaigns.filters.launcher', 'Launched by')}:
              </span>
              <SearchableSelect
                options={launcherSelectOptions}
                value={localFilters.launcher}
                onValueChange={(value) => setLocalFilters({ ...localFilters, launcher: value })}
                placeholder={t('pages.messagingCampaigns.filters.allLaunchers', 'All launchers')}
                searchPlaceholder={t(
                  'pages.messagingCampaigns.filters.searchLauncher',
                  'Search launcher...'
                )}
                disabled={isLoading}
                className={filterDropdownClassName}
              />
            </div>

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
                disabled={isLoading}
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

export default CampaignAnalyticsFiltersBar
