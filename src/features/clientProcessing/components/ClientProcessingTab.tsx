/**
 * ClientProcessingTab Component
 *
 * "Відпрацювання за ЦД" report tab for the Reports page: a date-range filter
 * (defaults to today–today, matching the backend default window), department
 * sub-tabs (ТП / Дайлер / Стягнення — filtered on the client by
 * `department_name`, one request per period), and the per-employee table.
 *
 * The active department lives in the URL (`?dept=…`) so refresh/bookmark
 * keeps the selection, following the tab-state-in-URL convention.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { formatPickerDateAsYMD, getDateStringInTimezone } from '@/lib/dateUtils'
import { useAuthStore } from '@/stores/authStore'
import { useClientProcessingReport } from '../hooks'
import {
  PROCESSING_DEPARTMENT_TABS,
  PROCESSING_TAB_TO_DEPARTMENT,
  isProcessingDepartmentTab,
} from '../types'
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

  const rawDept = searchParams.get('dept')
  const activeDept = isProcessingDepartmentTab(rawDept) ? rawDept : 'tp'

  const handleDeptChange = (dept: (typeof PROCESSING_DEPARTMENT_TABS)[number]) => {
    const next = new URLSearchParams(searchParams)
    next.set('dept', dept)
    setSearchParams(next, { replace: true })
  }

  const query = useClientProcessingReport({ projectId, dateStart, dateEnd })

  const filteredRows = useMemo(
    () =>
      (query.data?.rows ?? []).filter(
        (row) => row.department_name === PROCESSING_TAB_TO_DEPARTMENT[activeDept]
      ),
    [query.data, activeDept]
  )

  const errorStatus = (query.error as { response?: { status?: number } } | null)?.response?.status

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Date range filter */}
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl p-4 shadow-sm sm:gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-foreground text-xs leading-[140%] font-medium tracking-[-0.24px]">
            {t('pages.reports.processing.dateFrom')}
          </span>
          <DateSelect
            value={dateStart}
            max={dateEnd}
            onChange={({ value }) => {
              if (value) setDateStart(formatPickerDateAsYMD(value))
            }}
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
            value={dateEnd}
            min={dateStart}
            onChange={({ value }) => {
              if (value) setDateEnd(formatPickerDateAsYMD(value))
            }}
            allowManualInput
            format="dd.MM.yyyy"
            className="w-full min-w-0 sm:w-44"
          />
        </div>
      </div>

      {/* Department sub-tabs */}
      <div
        role="tablist"
        className="bg-card flex w-full items-center gap-1 rounded-lg p-1 shadow-sm sm:w-fit"
      >
        {PROCESSING_DEPARTMENT_TABS.map((dept) => {
          const isActive = dept === activeDept
          return (
            <button
              key={dept}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleDeptChange(dept)}
              className={cn(
                'flex flex-1 cursor-pointer items-center justify-center rounded-md px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors sm:w-[120px] sm:flex-none sm:px-4 sm:text-sm',
                isActive
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-muted'
              )}
            >
              {t(`pages.reports.processing.departments.${dept}`)}
            </button>
          )
        })}
      </div>

      {/* Content: skeleton / error / table */}
      {query.isLoading ? (
        <TableSkeleton columns={9} rows={6} />
      ) : query.isError ? (
        <div className="border-border bg-card flex w-full flex-col items-center justify-center gap-4 rounded-xl border p-8">
          <Icons.Warning size={40} className="text-error-500" />
          <p className="text-foreground text-center text-sm font-medium">
            {errorStatus === 503
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
