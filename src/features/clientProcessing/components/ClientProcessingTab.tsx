/**
 * ClientProcessingTab Component
 *
 * "Відпрацювання за ЦД" report tab for the Reports page: a date-range filter
 * (defaults to today–today, matching the backend default window), department
 * sub-tabs built dynamically from the response and keyed by `department_id`
 * (one request per period, client-side filtering), and the per-employee
 * table.
 *
 * All tab state lives in the URL (`?dept=`, `?from=`, `?to=`) so it survives
 * refresh, bookmarking and switching between the page tabs (panels unmount
 * on switch).
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import { SegmentedTabs, type SegmentedTabItem } from '@/components/ui/SegmentedTabs'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { isTransientFailure } from '@/lib/api'
import { getErrorMessage, getErrorStatus } from '@/lib/errors'
import { Icons } from '@/lib/icons'
import { formatPickerDateAsYMD, getDateStringInTimezone } from '@/lib/dateUtils'
import { useAuthStore } from '@/stores/authStore'
import { useClientProcessingReport } from '../hooks'
import {
  buildDepartmentTabs,
  resolveActiveDepartmentTab,
  rowDepartmentTabId,
} from '../utils/departmentTabs'
import { ProcessingTable } from './ProcessingTable'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Mirrors the backend's window cap (client-service reports router).
const MAX_RANGE_DAYS = 366

const MS_PER_DAY = 86_400_000

export function ClientProcessingTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()

  // Same project resolution as the Reports dashboard: active project first,
  // then the first assigned project, then 1.
  const user = useAuthStore((state) => state.user)
  const projectId: number = Number(user?.active_project_id ?? user?.projects?.[0]?.id ?? 1)
  const userTimezone = user?.timezone

  // Dates live in the URL so they survive switching page tabs. Default
  // window is today–today in the user's profile timezone (the backend
  // defaults to the same window, but we always send both dates explicitly).
  const today = getDateStringInTimezone(new Date(), userTimezone)
  const rawFrom = searchParams.get('from')
  const rawTo = searchParams.get('to')
  const dateStart = rawFrom && DATE_RE.test(rawFrom) ? rawFrom : today
  const dateEnd = rawTo && DATE_RE.test(rawTo) ? rawTo : today

  // Per-field remount nonces: bumping one re-mounts only that DateSelect so
  // a cleared manual input resyncs back to the kept URL value instead of
  // looking empty (clearing one field must not disturb the other). A proper
  // clear-and-retype flow inside DateSelect itself is out of scope here.
  const [startNonce, setStartNonce] = useState(0)
  const [endNonce, setEndNonce] = useState(0)

  const setUrlParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  const handleDateChange =
    (key: 'from' | 'to', bumpNonce: () => void) =>
    ({ value }: { value: Date | null }) => {
      if (value) setUrlParam(key, formatPickerDateAsYMD(value))
      else bumpNonce()
    }

  // Manual input can bypass the pickers' min/max, so invalid ranges must not
  // reach the API. ISO YYYY-MM-DD strings compare correctly as strings; the
  // 366-day cap mirrors the backend validation (which answers 400).
  const isRangeInverted = dateStart > dateEnd
  const isRangeTooLong =
    !isRangeInverted && (Date.parse(dateEnd) - Date.parse(dateStart)) / MS_PER_DAY > MAX_RANGE_DAYS
  const rangeErrorKey = isRangeInverted
    ? 'pages.reports.processing.invalidRange'
    : isRangeTooLong
      ? 'pages.reports.processing.rangeTooLong'
      : null

  const query = useClientProcessingReport({
    projectId,
    dateStart,
    dateEnd,
    enabled: !rangeErrorKey,
  })

  const rows = useMemo(() => query.data?.rows ?? [], [query.data])
  const departmentTabs = useMemo(() => buildDepartmentTabs(rows), [rows])
  const activeTab = resolveActiveDepartmentTab(departmentTabs, searchParams.get('dept'))

  const tabItems: SegmentedTabItem<string>[] = departmentTabs.map((tab) => ({
    id: tab.id,
    label: tab.labelKey ? t(tab.labelKey) : (tab.label ?? tab.id),
  }))

  const filteredRows = useMemo(
    () => rows.filter((row) => rowDepartmentTabId(row) === activeTab.id),
    [rows, activeTab.id]
  )

  // keepPreviousData shows the previous period's rows while a new period
  // loads — they must not look final, hence the busy overlay.
  const isRefreshing = query.isFetching || query.isPlaceholderData

  const errorStatus = getErrorStatus(query.error)
  const isForbidden = errorStatus === 403
  const errorMessage = isTransientFailure(query.error)
    ? t('pages.reports.processing.unavailable')
    : isForbidden
      ? t('pages.reports.processing.forbidden')
      : errorStatus === 400
        ? // Backend range validation answers 400 with a human-readable detail
          getErrorMessage(query.error)
        : t('pages.reports.processing.error.title')

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Date range filter */}
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl p-4 shadow-sm sm:gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-foreground text-xs leading-[140%] font-medium tracking-[-0.24px]">
            {t('pages.reports.processing.dateFrom')}
          </span>
          <DateSelect
            key={`processing-date-start-${startNonce}`}
            value={dateStart}
            max={dateEnd}
            onChange={handleDateChange('from', () => setStartNonce((nonce) => nonce + 1))}
            allowManualInput
            format="dd.MM.yyyy"
            className="w-full min-w-0 sm:w-44"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-foreground text-xs leading-[140%] font-medium tracking-[-0.24px]">
            {t('pages.reports.processing.dateTo')}
          </span>
          <DateSelect
            key={`processing-date-end-${endNonce}`}
            value={dateEnd}
            min={dateStart}
            onChange={handleDateChange('to', () => setEndNonce((nonce) => nonce + 1))}
            allowManualInput
            format="dd.MM.yyyy"
            className="w-full min-w-0 sm:w-44"
          />
        </div>
        {rangeErrorKey && (
          <p className="text-error-500 w-full text-xs font-medium" role="alert">
            {t(rangeErrorKey)}
          </p>
        )}
      </div>

      {/* Department sub-tabs (dynamic: known departments + any others found in data) */}
      <SegmentedTabs<string>
        items={tabItems}
        value={activeTab.id}
        onChange={(deptId) => setUrlParam('dept', deptId)}
        ariaLabel={t('pages.reports.tabs.processing')}
      />

      {/* Content: an invalid range shows only the hint above */}
      {rangeErrorKey ? null : query.isLoading ? (
        <TableSkeleton columns={9} rows={6} />
      ) : query.isError ? (
        <div className="border-border bg-card flex w-full flex-col items-center justify-center gap-4 rounded-xl border p-8">
          <Icons.Warning size={40} className="text-error-500" />
          <p className="text-foreground text-center text-sm font-medium">{errorMessage}</p>
          {/* Retrying cannot fix missing permissions — no button on 403 */}
          {!isForbidden && (
            <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
              {t('pages.reports.processing.error.retry')}
            </Button>
          )}
        </div>
      ) : (
        <div className="relative w-full" aria-busy={isRefreshing || undefined}>
          <ProcessingTable rows={filteredRows} />
          {isRefreshing && (
            <div
              data-testid="processing-refreshing"
              className="bg-card/60 absolute inset-0 z-10 flex items-center justify-center rounded-xl"
            >
              <Icons.Spinner className="h-8 w-8" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
