/**
 * OperatorPromisesTab Component
 *
 * «Обіцянки по операторах» report tab for the Reports page (migrated Metabase
 * Card 102): one row per OPERATOR — the chain runs they first touched in the
 * period, the money they took promises for, the money that was DUE in the
 * period, the money that arrived, and the conversion between the last two.
 *
 * The three windows are INDEPENDENT and all cut by the same date pair, which is
 * why both bounds are required and no bound is optional here (unlike the
 * sibling feeds): there is nothing to leave open. The default window is
 * today–today in the user's profile timezone — the same default the
 * Techno-Finance «Обещания» panel applies (`defaultRange()` there returns
 * `from = to = today`), and the same default the sibling processing tab uses,
 * so the two systems open on the same period.
 *
 * There is NO pagination: the endpoint returns the whole roster (~136 rows for
 * a month on production, one per operator) precisely so a frontend can render
 * it in full and group it into its own department tabs. This tab is therefore
 * NOT built on the paged-feed shell the four feed tabs share — it has no page,
 * no page size and no clamp/self-heal; what it borrows from them is the URL
 * date sync and the error ladder.
 *
 * Department sub-tabs («Всі» / ТП / Дайлер / Стягнення) filter the SINGLE
 * response client-side — one request serves all four, as in Techno-Finance.
 * The backend applies no department filter at all, on purpose: the departments
 * Techno-Finance drops on its frontend (Юристи, Аналітики, no department) held
 * ≈ 631 000 ₴ of July 2026 collections, and «Всі» is the tab that shows them.
 *
 * All tab state the user set lives in the URL (`?opf=`, `?opt=`, `?opd=`) so it
 * survives refresh, bookmarking and switching between the page tabs (panels
 * unmount on switch). Filter updates use `replace` — only page-tab changes
 * create history entries.
 *
 * The URL keys are deliberately NEW — the host page keeps every tab's params in
 * the URL, so this tab must not collide with `?tab` (host), `?from/?to/?dept`
 * (processing), `?sf/?st/?cf/?ct` (verification), `?pf/?pt/?mv/?pg/?ps` (the
 * low-verification feed), `?if/?it/?spg/?sps` (the searcher feed) or
 * `?gf/?gt/?gm/?gpg/?gps` (the communication-gap feed). A shared key would
 * silently transplant one tab's filter into another.
 */

import { useMemo } from 'react'
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
import { isRealCalendarDate } from '@/lib/calendarDate'
import { formatPickerDateAsYMD, getDateStringInTimezone } from '@/lib/dateUtils'
import { getErrorMessage, getErrorStatus, hasResponseDetail } from '@/lib/errors'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import { useOperatorPromisesReport } from '../hooks'
import {
  DEFAULT_OPERATOR_PROMISES_TAB,
  OPERATOR_PROMISES_TAB_IDS,
  filterRowsByTab,
  resolveOperatorPromisesTab,
  type OperatorPromisesTabId,
} from '../utils/departmentTabs'
import { sumOperatorPromisesRows } from '../utils/totals'
import { OPERATOR_PROMISES_COLUMN_COUNT, OperatorPromisesTable } from './OperatorPromisesTable'
import { OperatorPromisesTotals } from './OperatorPromisesTotals'

/**
 * URL keys, distinct from every other tab of the host page — the host's own
 * `tab`, processing (`from/to/dept`), verification (`sf/st/cf/ct`), the
 * low-verification feed (`pf/pt/mv/pg/ps`), the searcher feed (`if/it/spg/sps`)
 * and the communication-gap feed (`gf/gt/gm/gpg/gps`). "opf"/"opt" =
 * Operator-Promises From/To; "opd" = Operator-Promises Department sub-tab.
 */
const DATE_FROM_KEY = 'opf'
const DATE_TO_KEY = 'opt'
const DEPARTMENT_KEY = 'opd'

const TABS_ID_PREFIX = 'operator-promises'

/**
 * Mirrors the backend's window cap `_MAX_RANGE_DAYS` in
 * api-prionex/services/client/app/routers/reports.py: the (end - start) day
 * difference may be at most 366, i.e. an inclusive window of 367 days is the
 * widest allowed — larger answers 400.
 */
const MAX_RANGE_DAYS = 366

const MS_PER_DAY = 86_400_000

export function OperatorPromisesTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()

  // Same project resolution as the Reports dashboard: active project first,
  // then the first assigned project, then 1.
  const user = useAuthStore((state) => state.user)
  const projectId: number = Number(user?.active_project_id ?? user?.projects?.[0]?.id ?? 1)
  const userTimezone = user?.timezone

  // One function resolves "today" for the default window; a PICKED date goes
  // through formatPickerDateAsYMD below. The profile timezone therefore decides
  // only which calendar day "now" is, and then travels to the backend, where it
  // cuts the PROMISED-date window (and nothing else).
  const today = getDateStringInTimezone(new Date(), userTimezone)
  const rawFrom = searchParams.get(DATE_FROM_KEY)
  const rawTo = searchParams.get(DATE_TO_KEY)

  // A present-but-unusable bound is NOT silently replaced with today: the URL
  // would then disagree with both the field and the request, and a shape-only
  // check would let an impossible day like `?opf=2026-02-31` through to the API
  // (every comparison against NaN is false, so a range guard would pass
  // silently). It goes down the same path as an inverted window — inline hint,
  // no request — tracked per bound so the hint sits on the offending field.
  const isFromInvalid = !!rawFrom && !isRealCalendarDate(rawFrom)
  const isToInvalid = !!rawTo && !isRealCalendarDate(rawTo)

  // An ABSENT key is the default (today); only an explicitly bad one is undefined.
  const dateFrom = rawFrom ? (isFromInvalid ? undefined : rawFrom) : today
  const dateTo = rawTo ? (isToInvalid ? undefined : rawTo) : today

  // The only guard against an inverted or oversized window: the pickers
  // deliberately do not bound each other (see the fields below), and manual
  // input and hand-edited URLs would bypass such bounds anyway. ISO YYYY-MM-DD
  // strings compare correctly as strings.
  const isInverted = !!dateFrom && !!dateTo && dateFrom > dateTo
  const isTooLong =
    !!dateFrom &&
    !!dateTo &&
    !isInverted &&
    (Date.parse(dateTo) - Date.parse(dateFrom)) / MS_PER_DAY > MAX_RANGE_DAYS

  const hasFilterError = isFromInvalid || isToInvalid || isInverted || isTooLong

  // Filter updates never create history entries (page-tab switches do). The
  // simple functional form is enough here: nothing in this tab emits two URL
  // updates in the same tick (that is the paged feeds' problem — the shared
  // Pagination fires onPageSizeChange and onPageChange back to back, which is
  // why they compose through a ref). Dates and the department sub-tab are
  // separate user actions and land in separate commits.
  const setUrlParam = (key: string, value: string | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true }
    )
  }

  // Timezone policy: a PICKED date is already a calendar day — the picker hands
  // us a local-midnight Date whose local Y/M/D are exactly the cell the user
  // clicked, so we read them back verbatim. Re-rendering that instant in the
  // profile timezone would shift the day whenever the browser-vs-profile offset
  // spans midnight (IANA offsets span 26 h, so a noon anchor doesn't save it).
  const handleDateChange =
    (key: typeof DATE_FROM_KEY | typeof DATE_TO_KEY) =>
    ({ value }: { value: Date | null }) => {
      // A cleared manual input is not a filter change: the URL keeps the old
      // value and a valid date commits once the user finishes retyping
      // (DateSelect itself resyncs the abandoned text on blur). There is no "×"
      // on these fields — both bounds are REQUIRED, so an empty window is not a
      // state this report has.
      if (value) setUrlParam(key, formatPickerDateAsYMD(value))
    }

  const dateError = t('pages.reports.operatorPromises.invalidDate')
  const rangeErrorKey = isInverted
    ? 'pages.reports.operatorPromises.invalidRange'
    : isTooLong
      ? 'pages.reports.operatorPromises.rangeTooLong'
      : null

  const query = useOperatorPromisesReport({
    projectId,
    // The fallbacks are never sent: a missing bound can only come from an
    // invalid URL value, which is exactly what sets `hasFilterError` and
    // disables the query.
    dateFrom: dateFrom ?? today,
    dateTo: dateTo ?? today,
    timezone: userTimezone,
    enabled: !hasFilterError,
  })

  const activeTab: OperatorPromisesTabId = resolveOperatorPromisesTab(
    searchParams.get(DEPARTMENT_KEY)
  )

  const tabItems: SegmentedTabItem<OperatorPromisesTabId>[] = OPERATOR_PROMISES_TAB_IDS.map(
    (id) => ({
      id,
      label: t(`pages.reports.operatorPromises.subtabs.${id}`),
    })
  )

  // Stable identity for the empty fallback — a fresh `[]` every render would
  // defeat the memos below and OperatorPromisesTable's own.
  const rows = useMemo(() => query.data?.rows ?? [], [query.data])
  const visibleRows = useMemo(() => filterRowsByTab(rows, activeTab), [rows, activeTab])
  const visibleTotals = useMemo(() => sumOperatorPromisesRows(visibleRows), [visibleRows])

  // "The period produced rows, but none of them belong to this tab" — a
  // different fact from "the period produced nothing", and the only shape in
  // which a department renamed in the auth directory can surface (see
  // utils/departmentTabs.ts). By construction this is never true on «Всі»,
  // which does not filter.
  const hasUnmatchedRows = rows.length > 0 && visibleRows.length === 0

  // keepPreviousData shows the previous window's rows while a new one loads —
  // they must not look final, hence the busy overlay. Placeholder only: a
  // background refetch of the SAME window shows current data and needs none.
  const isRefreshing = query.isPlaceholderData

  const errorStatus = getErrorStatus(query.error)
  const isForbidden = errorStatus === 403
  const isUnavailable = isTransientFailure(query.error)
  const errorMessage = isUnavailable
    ? // Covers all three of the endpoint's own 503s — the payment-service being
      // down, the auth-service directory being down, and the two lookups
      // together blowing the fan-out deadline. The operator's move is the same
      // in all three (wait and retry), and none may degrade to a partial
      // report: without the directory rows cannot be named, grouped or sorted,
      // and without the payment data a working operator reads as one who
      // collected nothing.
      t('pages.reports.operatorPromises.unavailable')
    : isForbidden
      ? t('pages.reports.operatorPromises.forbidden')
      : // Backend date/timezone validation answers 400 with a human-readable
        // detail (inverted window, > 367 days, a date outside
        // 1900-01-01..9998-12-31, an unknown IANA zone). Passing it through
        // verbatim is what makes the refusal actionable. Only when the answer
        // HAS a detail, though: a 400 whose body never arrived would otherwise
        // show axios' own untranslated "Request failed with status code 400"
        // (see hasResponseDetail), so it joins every other unexplained failure
        // under the localized generic title.
        errorStatus === 400 && hasResponseDetail(query.error)
        ? getErrorMessage(query.error)
        : t('pages.reports.operatorPromises.error.title')

  // The three 503s are worded distinctly by the backend on purpose — the
  // remedies differ and monitoring must tell an outage from a timeout — so the
  // server's own sentence is shown UNDER the localized one rather than instead
  // of it: the operator reads their language, and whoever is asked "what does
  // it say?" can tell which dependency failed. Absent for a transport-level
  // failure (a 502/504 or a dropped connection carries no body).
  const errorDetail =
    isUnavailable && hasResponseDetail(query.error) ? getErrorMessage(query.error) : null

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Both bounds are required — this report has no default period at all.

          NEITHER picker is bounded by the other (no `min`/`max`), on purpose.
          The default window is today–today, so a mutual bound would open BOTH
          calendars with exactly one selectable day: whichever field the user
          reaches for first is dead — every other day greyed out — and the only
          way through is to widen the other bound first, which is not a rule
          anything on screen states. Letting an inverted window be PICKED and
          then refused by the guard above (`isInverted` → the pair-level alert,
          no request) trades an unexplained dead calendar for a sentence, and
          the guard is needed regardless: manual input bypasses picker bounds
          anyway. The sibling processing tab still carries the dead calendar —
          same fix, tracked in TASK-010. */}
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl p-4 shadow-sm sm:gap-4">
        <DateSelect
          label={t('pages.reports.operatorPromises.dateFrom')}
          value={dateFrom ?? null}
          // Only the bound that actually carries the unusable value is marked.
          // `error` (not `invalidText`) is the right prop: the value arrives
          // already committed, from the URL, not as half-typed text.
          error={isFromInvalid ? dateError : undefined}
          onChange={handleDateChange(DATE_FROM_KEY)}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <DateSelect
          label={t('pages.reports.operatorPromises.dateTo')}
          value={dateTo ?? null}
          error={isToInvalid ? dateError : undefined}
          onChange={handleDateChange(DATE_TO_KEY)}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        {/* Pair-level only: a bad single date rides its own field above.
            Neither bound is wrong on its own in an inverted or oversized
            window, so this one has no field to sit on. */}
        {rangeErrorKey && (
          <p className="text-error-500 w-full text-xs font-medium" role="alert">
            {t(rangeErrorKey)}
          </p>
        )}
      </div>

      {/* Department sub-tabs. Switching is pure client-side filtering of an
          already-fetched response — cheap, so selection follows focus
          (`activation` default) per the ARIA APG rule the host page's own
          expensive strip deliberately opts out of. */}
      <SegmentedTabs<OperatorPromisesTabId>
        items={tabItems}
        value={activeTab}
        onChange={(tabId) =>
          // The default tab is the ABSENCE of the key, never a spelled-out
          // `opd=all`: a shared link then carries only choices somebody made.
          setUrlParam(DEPARTMENT_KEY, tabId === DEFAULT_OPERATOR_PROMISES_TAB ? null : tabId)
        }
        ariaLabel={t('pages.reports.tabs.operator-promises')}
        idPrefix={TABS_ID_PREFIX}
      />

      {/* Content: an invalid window shows only the hints above */}
      <div
        role="tabpanel"
        id={segmentedTabPanelId(TABS_ID_PREFIX, activeTab)}
        aria-labelledby={segmentedTabId(TABS_ID_PREFIX, activeTab)}
        // This panel holds only the totals block and the table — no focusable
        // content — so per ARIA APG the panel itself must be keyboard-reachable
        // (same as the sibling processing tab, and unlike the host page's
        // panels, which are full of controls).
        tabIndex={0}
        className="flex w-full flex-col gap-4"
      >
        {hasFilterError ? null : query.isLoading ? (
          // The skeleton mirrors the real table's width — the count comes from
          // OperatorPromisesTable so the two cannot drift apart.
          <TableSkeleton columns={OPERATOR_PROMISES_COLUMN_COUNT} rows={6} />
        ) : query.isError ? (
          <div className="border-border bg-card flex w-full flex-col items-center justify-center gap-4 rounded-xl border p-8">
            <Icons.Warning size={40} className="text-error-500" />
            <p className="text-foreground text-center text-sm font-medium">{errorMessage}</p>
            {errorDetail && (
              <p className="text-muted-foreground text-center text-xs">{errorDetail}</p>
            )}
            {/* Retrying cannot fix missing permissions — no button on 403 */}
            {!isForbidden && (
              <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
                {t('pages.reports.operatorPromises.error.retry')}
              </Button>
            )}
          </div>
        ) : query.data ? (
          <div
            className="relative flex w-full flex-col gap-4"
            aria-busy={isRefreshing || undefined}
          >
            <OperatorPromisesTotals
              visible={visibleTotals}
              overall={query.data.totals}
              visibleLabel={t(`pages.reports.operatorPromises.subtabs.${activeTab}`)}
              generatedAt={query.data.generated_at}
              // Same profile zone that travelled to the API and cut the window,
              // so the stamp reads in the report's own clock rather than the
              // browser's.
              timezone={userTimezone}
            />
            {/* Two different silences, told apart. A genuinely empty answer is
                a normal 200 — nobody worked the period — and gets the calm
                "no data for the period". An answer that HAS rows none of which
                match this tab is a different fact, and saying "no data for the
                period" there would be false: the period has data, this tab
                just cannot see it. That is also the only surface on which a
                department renamed in the auth directory can ever appear (the
                tabs match a display string — see utils/departmentTabs.ts), so
                the message points at «Всі», where the rows certainly are. */}
            <OperatorPromisesTable
              rows={visibleRows}
              emptyMessage={t(
                hasUnmatchedRows
                  ? 'pages.reports.operatorPromises.emptyDepartment'
                  : 'pages.reports.operatorPromises.empty'
              )}
            />
            {isRefreshing && (
              <div
                data-testid="operator-promises-refreshing"
                className="bg-card/60 absolute inset-0 z-10 flex items-center justify-center rounded-xl"
              >
                <Icons.Spinner className="h-8 w-8" />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
