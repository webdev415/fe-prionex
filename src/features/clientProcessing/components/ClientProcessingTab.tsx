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
import { FEED_ERROR_KEY_PREFIXES, useFeedErrorMessage } from '@/hooks'
import { isRealCalendarDate } from '@/lib/calendarDate'
import { Icons } from '@/lib/icons'
import { formatPickerDateAsYMD, getDateStringInTimezone } from '@/lib/dateUtils'
import { isWindowTooLong } from '@/lib/reportWindow'
import { REPORTS_URL_KEYS } from '@/lib/reportsUrlKeys'
import { useAuthStore } from '@/stores/authStore'
import { useClientProcessingReport } from '../hooks'
import {
  buildDepartmentTabs,
  resolveActiveDepartmentTab,
  rowDepartmentTabId,
} from '../utils/departmentTabs'
import { ProcessingTable } from './ProcessingTable'

const TABS_ID_PREFIX = 'client-processing'

/** This tab's slice of the Reports page URL namespace (see the registry). */
const { from: FROM_KEY, to: TO_KEY, dept: DEPT_KEY } = REPORTS_URL_KEYS.processing

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
  //
  // `isRealCalendarDate`, not a shape-only regex: V8's Date.parse lazily
  // reads an impossible day like 2026-02-31 as March 3rd, so a shape check
  // would wave `?from=2026-02-31` through to the API (and into the window-cap
  // check below, which would then measure the window from a date nobody
  // typed). An unusable value falls back to today — this tab's long-standing
  // rule for malformed URL values; the sibling tabs' louder per-field error
  // treatment is a different design this report has not adopted.
  const today = getDateStringInTimezone(new Date(), userTimezone)
  const rawFrom = searchParams.get(FROM_KEY)
  const rawTo = searchParams.get(TO_KEY)
  const dateStart = rawFrom && isRealCalendarDate(rawFrom) ? rawFrom : today
  const dateEnd = rawTo && isRealCalendarDate(rawTo) ? rawTo : today

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
    (key: typeof FROM_KEY | typeof TO_KEY) =>
    ({ value }: { value: Date | null }) => {
      // A cleared manual input is not a filter change: the URL keeps the old
      // value and a valid date commits once the user finishes retyping
      // (DateSelect itself resyncs the abandoned text on blur).
      if (value) setUrlParam(key, formatPickerDateAsYMD(value))
    }

  // The only guard against an inverted or oversized window: the pickers
  // deliberately do not bound each other (see the fields below), and manual
  // input and hand-edited URLs would bypass such bounds anyway. ISO YYYY-MM-DD
  // strings compare correctly as strings.
  const isRangeInverted = dateStart > dateEnd
  const isRangeTooLong = isWindowTooLong(dateStart, dateEnd)
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
  const rawDept = searchParams.get(DEPT_KEY)

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

  // The shared failure ladder (see the hook for the rungs and their order).
  // What is this endpoint's own: its 400 carries a human-readable detail from
  // the range validation, which is what makes the refusal actionable.
  // `errorDetail` is not taken — this tab has never shown the server's 503
  // sentence under the localized one.
  //
  // The 400 now goes through the hook's `hasResponseDetail` gate, which this
  // tab did not have: a 400 whose body a proxy stripped used to reach the
  // operator as axios' own untranslated "Request failed with status code 400"
  // and now reaches them as the localized title. Deliberate — see the hook.
  const { errorMessage, isForbidden } = useFeedErrorMessage(
    query.error,
    FEED_ERROR_KEY_PREFIXES.processing
  )

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Date range filter.

          NEITHER picker is bounded by the other (no `min`/`max`), on purpose —
          the shared rule of the tabs with a DEFAULTED window (this one,
          operator-promises, searcher; the two feeds with empty optional
          bounds keep their mutual bounds — no default, no order trap). A mutual bound does not deaden a calendar; what it does is
          impose an ORDER nothing on screen states. With the today–today
          default, `max={dateEnd}` would leave «з» open on every day up to
          today and `min={dateStart}` would leave «по» open on every day from
          today — so the common request "give me last month" is reachable only
          by moving «з» first. Reach for «по» first and the whole past is
          greyed out, with nothing saying why or which field to touch
          instead. (DateSelect adds
          no bounds of its own: `minDate`/`maxDate` reach react-datepicker only
          from these props, so dropping them leaves both calendars fully open.)

          What actually protects the API is the pair guard above
          (`isRangeInverted` → the alert below, no request), which is needed
          regardless: manual input and hand-edited URLs bypass picker bounds
          anyway. So an inverted window can be PICKED, and it is answered in
          words — "Початкова дата пізніша за кінцеву" — instead of by a
          calendar the user cannot get past. */}
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl p-4 shadow-sm sm:gap-4">
        <DateSelect
          label={t('pages.reports.processing.dateFrom')}
          value={dateStart}
          onChange={handleDateChange(FROM_KEY)}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <DateSelect
          label={t('pages.reports.processing.dateTo')}
          value={dateEnd}
          onChange={handleDateChange(TO_KEY)}
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
          setUrlParam(DEPT_KEY, deptId)
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
