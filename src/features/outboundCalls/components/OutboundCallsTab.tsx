/**
 * OutboundCallsTab Component
 *
 * «Вихідні дзвінки» report tab for the Reports page (migrated Metabase Card
 * 145): one row per OPERATOR SEAT — calls dialled in the period, how many of
 * them reached a person, how many of those lasted long enough to count, the
 * talk time behind them and the seat's org placement.
 *
 * Both bounds are REQUIRED: the aggregate behind the report is bounded by the
 * window and by nothing else, so "no window" would mean scanning the whole
 * call history (which is exactly what the card does when its optional date
 * block is left empty). The default window is today–today in the user's
 * profile timezone — the same default the sibling processing and
 * operator-promises tabs use, so the reports open on the same period.
 *
 * There is NO pagination: the endpoint returns the whole roster of seats that
 * dialled in the window (83 operators over August 2026; the whole directory
 * holds 379 extensions). This tab is therefore NOT built on the paged-feed
 * shell the four feed tabs share — it has no page, no page size and no
 * clamp/self-heal; what it borrows from them is the URL date sync and the
 * error ladder.
 *
 * All tab state lives in the URL (`?ocf=`, `?oct=`) so it survives refresh,
 * bookmarking and switching between the page tabs (panels unmount on switch).
 * Filter updates use `replace` — only page-tab changes create history entries.
 * The key set is declared in the page-wide registry
 * (`src/lib/reportsUrlKeys.ts`), whose test keeps the namespace
 * collision-free; a shared key would silently transplant one tab's filter into
 * another.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { isTransientFailure } from '@/lib/api'
import { formatPickerDateAsYMD, getDateStringInTimezone } from '@/lib/dateUtils'
import { getErrorMessage, getErrorStatus, hasResponseDetail } from '@/lib/errors'
import { Icons } from '@/lib/icons'
import { REPORTS_URL_KEYS } from '@/lib/reportsUrlKeys'
import { isDatePairInverted, readUrlDateBound } from '@/lib/urlDateBound'
import { useAuthStore } from '@/stores/authStore'
import { useOutboundCallsReport } from '../hooks'
import { OUTBOUND_CALLS_COLUMN_COUNT, OutboundCallsTable } from './OutboundCallsTable'

/**
 * This tab's slice of the Reports page URL namespace (see the registry).
 * "ocf"/"oct" = Outbound-Calls From/To.
 */
const { dateFrom: DATE_START_KEY, dateTo: DATE_END_KEY } = REPORTS_URL_KEYS.outboundCalls

/**
 * Mirrors the backend's window cap `_OUTBOUND_CALLS_MAX_WINDOW_DAYS` in
 * api-prionex/services/client/app/routers/reports.py — larger answers 400.
 *
 * 90 and not a year because the cap is sized to what the aggregate walk can
 * actually pay for (~3.8 months of calls); a quarter fits inside that budget
 * with room to spare, so the refusal lands on the field instead of arriving as
 * a 400 from the API.
 */
const MAX_WINDOW_DAYS_INCLUSIVE = 90

const MS_PER_DAY = 86_400_000

export function OutboundCallsTab() {
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
  // cuts the window's calendar days (and nothing else).
  const today = getDateStringInTimezone(new Date(), userTimezone)

  // A present-but-unusable bound is NOT silently replaced with today: the URL
  // would then disagree with both the field and the request, and a shape-only
  // check would let an impossible day like `?ocf=2026-02-31` through to the API
  // (every comparison against NaN is false, so a range guard would pass
  // silently). It goes down the same path as an inverted window — inline hint,
  // no request — tracked per bound so the hint sits on the offending field.
  const startBound = readUrlDateBound(searchParams, DATE_START_KEY)
  const endBound = readUrlDateBound(searchParams, DATE_END_KEY)

  // An ABSENT key is the default (today); only an explicitly bad one stays
  // undefined and blocks the request.
  const dateStart = startBound.value ?? (startBound.isInvalid ? undefined : today)
  const dateEnd = endBound.value ?? (endBound.isInvalid ? undefined : today)

  // The only guard against an inverted or oversized window: the pickers
  // deliberately do not bound each other (see the fields below), and manual
  // input and hand-edited URLs would bypass such bounds anyway.
  const isInverted = isDatePairInverted(dateStart, dateEnd)
  // Both ends COUNT: a today–today window is one day, not zero — the same
  // reading the backend's cap uses.
  const inclusiveDays =
    dateStart && dateEnd
      ? (Date.parse(dateEnd) - Date.parse(dateStart)) / MS_PER_DAY + 1
      : undefined
  const isTooLong =
    inclusiveDays !== undefined && !isInverted && inclusiveDays > MAX_WINDOW_DAYS_INCLUSIVE

  const hasFilterError = startBound.isInvalid || endBound.isInvalid || isInverted || isTooLong

  // Filter updates never create history entries (page-tab switches do). The
  // simple functional form is enough here: nothing in this tab emits two URL
  // updates in the same tick (that is the paged feeds' problem — the shared
  // Pagination fires onPageSizeChange and onPageChange back to back, which is
  // why they compose through a ref). The two dates are separate user actions
  // and land in separate commits.
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

  // Timezone policy: a PICKED date is already a calendar day — the picker hands
  // us a local-midnight Date whose local Y/M/D are exactly the cell the user
  // clicked, so we read them back verbatim. Re-rendering that instant in the
  // profile timezone would shift the day whenever the browser-vs-profile offset
  // spans midnight.
  const handleDateChange =
    (key: string) =>
    ({ value }: { value: Date | null }) => {
      // A cleared manual input is not a filter change: the URL keeps the old
      // value and a valid date commits once the user finishes retyping
      // (DateSelect itself resyncs the abandoned text on blur). There is no "×"
      // on these fields — both bounds are REQUIRED, so an empty window is not a
      // state this report has.
      if (value) setUrlParam(key, formatPickerDateAsYMD(value))
    }

  const dateError = t('pages.reports.outboundCalls.invalidDate')
  const rangeErrorKey = isInverted
    ? 'pages.reports.outboundCalls.invalidRange'
    : isTooLong
      ? 'pages.reports.outboundCalls.rangeTooLong'
      : null

  const query = useOutboundCallsReport({
    projectId,
    // The fallbacks are never sent: a missing bound can only come from an
    // invalid URL value, which is exactly what sets `hasFilterError` and
    // disables the query.
    dateStart: dateStart ?? today,
    dateEnd: dateEnd ?? today,
    timezone: userTimezone,
    enabled: !hasFilterError,
  })

  // Stable identity for the empty fallback — a fresh `[]` every render would
  // defeat OutboundCallsTable's own memo over its rows prop.
  const rows = useMemo(() => query.data?.rows ?? [], [query.data])

  // keepPreviousData shows the previous window's rows while a new one loads —
  // they must not look final, hence the busy overlay. Placeholder only: a
  // background refetch of the SAME window shows current data and needs none.
  const isRefreshing = query.isPlaceholderData

  const errorStatus = getErrorStatus(query.error)
  const isForbidden = errorStatus === 403
  const isUnavailable = isTransientFailure(query.error)
  const errorMessage = isUnavailable
    ? // Covers every 503 this endpoint words separately — the call-service
      // aggregate being down or throttling, the auth-service directory being
      // down, and the two together blowing the fan-out deadline. The operator's
      // move is the same in all of them (wait and retry), and none may degrade
      // to a partial report: without the calls there is nothing to count, and
      // without the directory the seats cannot be named, grouped or sorted.
      t('pages.reports.outboundCalls.unavailable')
    : isForbidden
      ? t('pages.reports.outboundCalls.forbidden')
      : // Backend date/timezone/budget validation answers 400 with a
        // human-readable detail (inverted window, > 90 inclusive days, a date outside
        // 1900-01-01..9998-12-31, an unknown IANA zone, or a window carrying
        // more calls than the aggregate walk budgets for — "narrow it").
        // Passing it through verbatim is what makes the refusal actionable, and
        // the budget one is the only way the user learns which knob to turn.
        // Only when the answer HAS a detail, though: a 400 whose body never
        // arrived would otherwise show axios' own untranslated "Request failed
        // with status code 400" (see hasResponseDetail).
        errorStatus === 400 && hasResponseDetail(query.error)
        ? getErrorMessage(query.error)
        : t('pages.reports.outboundCalls.error.title')

  // The 503s are worded distinctly by the backend on purpose — the remedies
  // differ and monitoring must tell an outage from a timeout — so the server's
  // own sentence is shown UNDER the localized one rather than instead of it:
  // the operator reads their language, and whoever is asked "what does it say?"
  // can tell which dependency failed. Absent for a transport-level failure (a
  // 502/504 or a dropped connection carries no body).
  const errorDetail =
    isUnavailable && hasResponseDetail(query.error) ? getErrorMessage(query.error) : null

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Both bounds are REQUIRED — neither may be left empty, so there is no
          "×" on either field; the window simply defaults to today–today.

          NEITHER picker is bounded by the other (no `min`/`max`), on purpose:
          the page-wide rule for every date pair WITH A DEFAULTED WINDOW
          (processing, searcher, operator-promises — the reasoning is written
          out in full in OperatorPromisesTab). With today–today, a mutual bound
          would make "give me last month" reachable only by moving «з» first,
          and reaching for «по» first would grey out the whole past with
          nothing saying why. The pair-level guard below is what actually
          protects the API — manual input and hand-edited URLs bypass picker
          bounds anyway. */}
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl p-4 shadow-sm sm:gap-4">
        <DateSelect
          label={t('pages.reports.outboundCalls.dateFrom')}
          value={dateStart ?? null}
          // Only the bound that actually carries the unusable value is marked.
          // `error` (not `invalidText`) is the right prop: the value arrives
          // already committed, from the URL, not as half-typed text.
          error={startBound.isInvalid ? dateError : undefined}
          onChange={handleDateChange(DATE_START_KEY)}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <DateSelect
          label={t('pages.reports.outboundCalls.dateTo')}
          value={dateEnd ?? null}
          error={endBound.isInvalid ? dateError : undefined}
          onChange={handleDateChange(DATE_END_KEY)}
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

      {/* Content: an invalid window shows only the hints above.

          The ladder ends on `query.data`, not on an else: only an ANSWER may
          claim the window is empty. A disabled query (a project id that never
          resolved) has no loading, no error and no data, and "nobody dialled"
          there would be a statement about a period nobody asked about. */}
      {hasFilterError ? null : query.isLoading ? (
        // The skeleton mirrors the real table's width — the count comes from
        // OutboundCallsTable so the two cannot drift apart.
        <TableSkeleton columns={OUTBOUND_CALLS_COLUMN_COUNT} rows={6} />
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
              {t('pages.reports.outboundCalls.error.retry')}
            </Button>
          )}
        </div>
      ) : query.data ? (
        <div className="relative w-full" aria-busy={isRefreshing || undefined}>
          {/* An empty answer is a normal 200: nobody dialled in the window
              (a weekend, or a day the call centre did not work). */}
          <OutboundCallsTable rows={rows} emptyMessage={t('pages.reports.outboundCalls.empty')} />
          {isRefreshing && (
            <div
              data-testid="outbound-calls-refreshing"
              className="bg-card/60 absolute inset-0 z-10 flex items-center justify-center rounded-xl"
            >
              <Icons.Spinner className="h-8 w-8" />
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
