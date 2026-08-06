/**
 * ClientProcessingTab Component
 *
 * "Відпрацювання за ЦД" report tab for the Reports page: a date-range filter
 * (defaults to today–today, matching the backend default window), department
 * sub-tabs built dynamically from the response's `department_name` values
 * (one request per period, client-side filtering), and the per-employee
 * table.
 *
 * The active department lives in the URL (`?dept=…`) so refresh/bookmark
 * keeps the selection, following the tab-state-in-URL convention.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import { SegmentedTabs, type SegmentedTabItem } from '@/components/ui/SegmentedTabs'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { TRANSIENT_RETRY_STATUSES } from '@/lib/api'
import { getErrorStatus } from '@/lib/errors'
import { Icons } from '@/lib/icons'
import { formatPickerDateAsYMD, getDateStringInTimezone } from '@/lib/dateUtils'
import { useAuthStore } from '@/stores/authStore'
import { useClientProcessingReport } from '../hooks'
import { buildDepartmentTabs, resolveActiveDepartmentTab } from '../utils/departmentTabs'
import { ProcessingTable } from './ProcessingTable'

export function ClientProcessingTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()

  // Same project resolution as the Reports dashboard: active project first,
  // then the first assigned project, then 1.
  const user = useAuthStore((state) => state.user)
  const projectId: number = Number(user?.active_project_id ?? user?.projects?.[0]?.id ?? 1)
  const userTimezone = user?.timezone

  // Default window is today–today in the user's profile timezone (the backend
  // defaults to the same window, but we always send both dates explicitly).
  const [dateStart, setDateStart] = useState<string>(() =>
    getDateStringInTimezone(new Date(), userTimezone)
  )
  const [dateEnd, setDateEnd] = useState<string>(() =>
    getDateStringInTimezone(new Date(), userTimezone)
  )
  // Bumped when a manual date input is cleared: remounting the DateSelects
  // resyncs them back to the kept state values, so the field never looks
  // empty while the filter is still active.
  const [dateSyncNonce, setDateSyncNonce] = useState(0)

  const handleDateChange =
    (setter: (value: string) => void) =>
    ({ value }: { value: Date | null }) => {
      if (value) setter(formatPickerDateAsYMD(value))
      else setDateSyncNonce((nonce) => nonce + 1)
    }

  // ISO YYYY-MM-DD strings compare correctly as strings. Manual input can
  // bypass the pickers' min/max, so an inverted range must not reach the API.
  const isRangeInvalid = dateStart > dateEnd

  const query = useClientProcessingReport({
    projectId,
    dateStart,
    dateEnd,
    enabled: !isRangeInvalid,
  })

  const rows = useMemo(() => query.data?.rows ?? [], [query.data])
  const departmentTabs = useMemo(() => buildDepartmentTabs(rows), [rows])
  const activeTab = resolveActiveDepartmentTab(departmentTabs, searchParams.get('dept'))

  const handleDeptChange = (deptId: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('dept', deptId)
    setSearchParams(next, { replace: true })
  }

  const tabItems: SegmentedTabItem<string>[] = departmentTabs.map((tab) => ({
    id: tab.id,
    label: tab.labelKey ? t(tab.labelKey) : tab.departmentName,
  }))

  const filteredRows = useMemo(
    () => rows.filter((row) => row.department_name === activeTab.departmentName),
    [rows, activeTab.departmentName]
  )

  const errorStatus = getErrorStatus(query.error)
  const isTransientlyUnavailable = errorStatus !== null && TRANSIENT_RETRY_STATUSES.has(errorStatus)

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Date range filter */}
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl p-4 shadow-sm sm:gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-foreground text-xs leading-[140%] font-medium tracking-[-0.24px]">
            {t('pages.reports.processing.dateFrom')}
          </span>
          <DateSelect
            key={`processing-date-start-${dateSyncNonce}`}
            value={dateStart}
            max={dateEnd}
            onChange={handleDateChange(setDateStart)}
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
            key={`processing-date-end-${dateSyncNonce}`}
            value={dateEnd}
            min={dateStart}
            onChange={handleDateChange(setDateEnd)}
            allowManualInput
            format="dd.MM.yyyy"
            className="w-full min-w-0 sm:w-44"
          />
        </div>
        {isRangeInvalid && (
          <p className="text-error-500 w-full text-xs font-medium" role="alert">
            {t('pages.reports.processing.invalidRange')}
          </p>
        )}
      </div>

      {/* Department sub-tabs (dynamic: known departments + any others found in data) */}
      <SegmentedTabs<string>
        items={tabItems}
        value={activeTab.id}
        onChange={handleDeptChange}
        ariaLabel={t('pages.reports.tabs.processing')}
      />

      {/* Content: invalid range shows only the hint above */}
      {isRangeInvalid ? null : query.isLoading ? (
        <TableSkeleton columns={9} rows={6} />
      ) : query.isError ? (
        <div className="border-border bg-card flex w-full flex-col items-center justify-center gap-4 rounded-xl border p-8">
          <Icons.Warning size={40} className="text-error-500" />
          <p className="text-foreground text-center text-sm font-medium">
            {isTransientlyUnavailable
              ? t('pages.reports.processing.unavailable')
              : t('pages.reports.processing.error.title')}
          </p>
          <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
            {t('pages.reports.processing.error.retry')}
          </Button>
        </div>
      ) : (
        <ProcessingTable rows={filteredRows} />
      )}
    </div>
  )
}
