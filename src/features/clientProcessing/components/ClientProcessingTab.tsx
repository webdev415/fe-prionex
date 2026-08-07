/**
 * ClientProcessingTab Component
 *
 * "Відпрацювання за ЦД" report tab for the Reports page: a date-range filter
 * (defaults to today–today, matching the backend default window), department
 * sub-tabs built dynamically from the response and keyed by `department_id`
 * (one request per period, client-side filtering), and the per-employee
 * table.
 *
 * All tab state the user set lives in the URL (`?dept=`, `?from=`, `?to=`) so
 * it survives refresh, bookmarking and switching between the page tabs
 * (panels unmount on switch). Filter updates use `replace` — only page-tab
 * changes create history entries. An auto-selected department is deliberately
 * NOT written to the URL (see the resolver below).
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import {
  SegmentedTabs,
  segmentedTabId,
  segmentedTabPanelId,
  type SegmentedTabItem,
} from '@/components/ui/SegmentedTabs'
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

// Mirrors the backend's window cap `_MAX_RANGE_DAYS` in
// api-prionex/services/client/app/routers/reports.py: the (end - start) day
// difference may be at most 366, i.e. an inclusive window of 367 days is the
// widest allowed — larger answers 400.
const MAX_RANGE_DAYS = 366

const MS_PER_DAY = 86_400_000

const TABS_ID_PREFIX = 'client-processing'

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
  // defaults to the same window, but we always send both dates explicitly,
  // together with the profile timezone for the day-boundary cut).
  const today = getDateStringInTimezone(new Date(), userTimezone)
  const rawFrom = searchParams.get('from')
  const rawTo = searchParams.get('to')
  const dateStart = rawFrom && DATE_RE.test(rawFrom) ? rawFrom : today
  const dateEnd = rawTo && DATE_RE.test(rawTo) ? rawTo : today

  // Filter updates never create history entries (page-tab switches do).
  const setUrlParam = (key: string, value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set(key, value)
        return next
      },
      { replace: true }
    )
  }

  // Timezone policy: the profile TZ applies only to the "today" DEFAULT above
  // (resolving the moment "now" into a calendar day). A PICKED date is
  // already a calendar day — the picker hands us a local-midnight Date whose
  // local Y/M/D are exactly the cell the user clicked, so we read them back
  // verbatim with formatPickerDateAsYMD. Re-rendering that instant in the
  // profile TZ would shift the day whenever the browser-vs-profile offset
  // spans midnight (IANA offsets span 26h, so a noon anchor doesn't save it).
  const handleDateChange =
    (key: 'from' | 'to') =>
    ({ value }: { value: Date | null }) => {
      // A cleared manual input is not a filter change: the URL keeps the old
      // value and a valid date commits once the user finishes retyping
      // (DateSelect itself resyncs the abandoned text on blur).
      if (value) setUrlParam(key, formatPickerDateAsYMD(value))
    }

  // Manual input can bypass the pickers' min/max, so invalid ranges must not
  // reach the API. ISO YYYY-MM-DD strings compare correctly as strings.
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
    timezone: userTimezone,
    enabled: !rangeErrorKey,
  })

  const rows = useMemo(() => query.data?.rows ?? [], [query.data])
  const departmentTabs = useMemo(() => buildDepartmentTabs(rows), [rows])
  const rawDept = searchParams.get('dept')

  // Only an EXPLICIT pick pins the department. Writing the auto-selected tab
  // into the URL would freeze the "first non-empty tab" heuristic after the
  // very first load, leaving the user on an empty tab once the period changes
  // — and would put a department nobody chose into shared links. Seeded from
  // the URL so a link shared *after* an explicit pick still honours it.
  // (State, not a ref: the flag is read during render, and the pick already
  // re-renders through the URL update anyway.)
  const [hasPickedDept, setHasPickedDept] = useState(rawDept !== null)
  const activeTab = resolveActiveDepartmentTab(departmentTabs, hasPickedDept ? rawDept : null, rows)

  const tabItems: SegmentedTabItem<string>[] = departmentTabs.map((tab) => ({
    id: tab.id,
    label: tab.labelKey ? t(tab.labelKey) : (tab.label ?? tab.id),
  }))

  const filteredRows = useMemo(
    () => rows.filter((row) => rowDepartmentTabId(row) === activeTab.id),
    [rows, activeTab.id]
  )

  // keepPreviousData shows the previous period's rows while a new period
  // loads — they must not look final, hence the busy overlay. Placeholder
  // only: a background refetch of the SAME period (e.g. window focus) shows
  // current data and needs no overlay. Accepted stale-while-revalidate
  // trade-off: returning to a period older than staleTime (60s) renders the
  // cached rows without an overlay while a background revalidation runs, so
  // the numbers may update in place a moment later.
  const isRefreshing = query.isPlaceholderData

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
        <DateSelect
          label={t('pages.reports.processing.dateFrom')}
          value={dateStart}
          max={dateEnd}
          onChange={handleDateChange('from')}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <DateSelect
          label={t('pages.reports.processing.dateTo')}
          value={dateEnd}
          min={dateStart}
          onChange={handleDateChange('to')}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
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
        onChange={(deptId) => {
          setHasPickedDept(true)
          setUrlParam('dept', deptId)
        }}
        ariaLabel={t('pages.reports.tabs.processing')}
        idPrefix={TABS_ID_PREFIX}
      />

      {/* Content: an invalid range shows only the hint above */}
      <div
        role="tabpanel"
        id={segmentedTabPanelId(TABS_ID_PREFIX, activeTab.id)}
        aria-labelledby={segmentedTabId(TABS_ID_PREFIX, activeTab.id)}
        // This panel holds only the table — no focusable content — so per
        // ARIA APG the panel itself must be keyboard-reachable. (Making the
        // wide table horizontally scrollable from the keyboard is a separate
        // concern: the scroll container lives inside DataTable, and focusing
        // this parent does not scroll it. Tracked as a follow-up on the
        // shared component.)
        tabIndex={0}
        className="w-full"
      >
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
    </div>
  )
}
