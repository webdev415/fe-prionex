/**
 * PromisesDailyTab Component
 *
 * «Обіцянки до кінця місяця» report tab for the Reports page (migrated
 * Metabase Card 103): a day × department matrix of the money promised for
 * each calendar day of the window, with per-department and grand totals.
 *
 * Both bounds are REQUIRED, and the default window is the report's namesake
 * period: today → the END OF THE CURRENT MONTH, resolved in the user's
 * profile timezone. «Весь місяць» widens it to the whole current month
 * (1st → end of month) with one click; unchecking it returns to the default.
 * «Враховувати можливі оплати» adds the possible-payment agreement subtype to
 * the counted promises — a different report, so it refetches.
 *
 * There is NO pagination and no sub-tabs: the matrix arrives whole (at most
 * 367 rows on the widest window the backend allows) and the departments are
 * its columns, the no-department series included — that money must not be
 * lost, so it renders under a localized «Без відділу» column.
 *
 * All tab state lives in the URL (`?pdf=`, `?pdt=`, `?pdp=`) so it survives
 * refresh, bookmarking and switching between the page tabs (panels unmount on
 * switch). Filter updates use `replace` — only page-tab changes create
 * history entries. The key set is declared in the page-wide registry
 * (`src/lib/reportsUrlKeys.ts`), whose test keeps the namespace
 * collision-free; a shared key would silently transplant one tab's filter
 * into another.
 */

import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { DateSelect } from '@/components/ui/DateSelect'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { isTransientFailure } from '@/lib/api'
import { formatDateTime } from '@/lib/localeFormat'
import { formatPickerDateAsYMD, getDateStringInTimezone } from '@/lib/dateUtils'
import { getErrorMessage, getErrorStatus, hasResponseDetail } from '@/lib/errors'
import { Icons } from '@/lib/icons'
import { REPORTS_URL_KEYS } from '@/lib/reportsUrlKeys'
import { isDatePairInverted, readUrlDateBound } from '@/lib/urlDateBound'
import { useAuthStore } from '@/stores/authStore'
import { usePromisesDailyReport } from '../hooks'
import { endOfMonthYMD, startOfMonthYMD } from '../utils/monthWindow'
import { PromisesDailyTable } from './PromisesDailyTable'

/**
 * This tab's slice of the Reports page URL namespace (see the registry).
 * "pdf"/"pdt" = Promises-Daily From/To; "pdp" = the possible-payment switch.
 */
const {
  dateFrom: DATE_FROM_KEY,
  dateTo: DATE_TO_KEY,
  possiblePayment: POSSIBLE_PAYMENT_KEY,
} = REPORTS_URL_KEYS.promisesDaily

/**
 * Mirrors the backend's window cap in
 * api-prionex/services/client/app/routers/reports.py: the (end - start) day
 * difference may be at most 366, i.e. an inclusive window of 367 days is the
 * widest allowed — larger answers 400. Same cap as operator-promises.
 */
const MAX_RANGE_DAYS = 366

const MS_PER_DAY = 86_400_000

/**
 * Skeleton width while the first answer loads. The real column count is
 * data-driven (one per department of the response), so it cannot be pinned to
 * a constant the way the record-list siblings pin theirs; the day column, the
 * fixed department triple plus the no-department series and «Разом» make six
 * a representative width.
 */
const SKELETON_COLUMNS = 6

export function PromisesDailyTab() {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language
  const [searchParams, setSearchParams] = useSearchParams()

  // Same project resolution as the Reports dashboard: active project first,
  // then the first assigned project, then 1.
  const user = useAuthStore((state) => state.user)
  const projectId: number = Number(user?.active_project_id ?? user?.projects?.[0]?.id ?? 1)
  const userTimezone = user?.timezone

  // One function resolves "today" for the default window; a PICKED date goes
  // through formatPickerDateAsYMD below. The profile timezone therefore
  // decides only which calendar day (and hence which month end) "now" is, and
  // then travels to the backend, where it cuts the PROMISED-date days.
  const today = getDateStringInTimezone(new Date(), userTimezone)
  const monthStart = startOfMonthYMD(today)
  const monthEnd = endOfMonthYMD(today)

  // A present-but-unusable bound is NOT silently replaced with the default:
  // the URL would then disagree with both the field and the request. It goes
  // down the same path as an inverted window — inline hint, no request —
  // tracked per bound so the hint sits on the offending field.
  const fromBound = readUrlDateBound(searchParams, DATE_FROM_KEY)
  const toBound = readUrlDateBound(searchParams, DATE_TO_KEY)

  // An ABSENT key is the default (today → end of the current month); only an
  // explicitly bad one stays undefined and blocks the request.
  const dateFrom = fromBound.value ?? (fromBound.isInvalid ? undefined : today)
  const dateTo = toBound.value ?? (toBound.isInvalid ? undefined : monthEnd)

  const possiblePayment = searchParams.get(POSSIBLE_PAYMENT_KEY) === '1'

  // The only guard against an inverted or oversized window: the pickers
  // deliberately do not bound each other (see the fields below), and manual
  // input and hand-edited URLs would bypass such bounds anyway.
  const isInverted = isDatePairInverted(dateFrom, dateTo)
  const isTooLong =
    !!dateFrom &&
    !!dateTo &&
    !isInverted &&
    (Date.parse(dateTo) - Date.parse(dateFrom)) / MS_PER_DAY > MAX_RANGE_DAYS

  const hasFilterError = fromBound.isInvalid || toBound.isInvalid || isInverted || isTooLong

  // «Весь місяць» is a STATE of the window, not a filter of its own: it reads
  // as checked exactly when the window IS the whole current month, however it
  // got there (the checkbox, hand-set pickers, a shared link).
  const isWholeMonth = dateFrom === monthStart && dateTo === monthEnd

  // Filter updates never create history entries (page-tab switches do). The
  // simple functional form is enough for the SINGLE-key writers here; the
  // whole-month toggle moves both bounds in one commit through
  // `setWindowParams` below — two back-to-back functional updates in the same
  // tick would be the paged feeds' composition problem all over again.
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

  /** Write (or clear, with null) BOTH window bounds in one URL commit. */
  const setWindowParams = (from: string | null, to: string | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (from === null) next.delete(DATE_FROM_KEY)
        else next.set(DATE_FROM_KEY, from)
        if (to === null) next.delete(DATE_TO_KEY)
        else next.set(DATE_TO_KEY, to)
        return next
      },
      { replace: true }
    )
  }

  // Timezone policy: a PICKED date is already a calendar day — the picker
  // hands us a local-midnight Date whose local Y/M/D are exactly the cell the
  // user clicked, so we read them back verbatim.
  const handleDateChange =
    (key: string) =>
    ({ value }: { value: Date | null }) => {
      // A cleared manual input is not a filter change: both bounds are
      // REQUIRED, so an empty window is not a state this report has
      // (DateSelect itself resyncs the abandoned text on blur).
      if (value) setUrlParam(key, formatPickerDateAsYMD(value))
    }

  // Checking pins the whole current month into the URL; unchecking drops both
  // keys, which IS the default window (today → end of month) — a state nobody
  // chose must not travel in a shared link.
  const handleWholeMonthChange = (checked: boolean | 'indeterminate') => {
    if (checked === true) setWindowParams(monthStart, monthEnd)
    else setWindowParams(null, null)
  }

  const dateError = t('pages.reports.promisesDaily.invalidDate')
  const rangeErrorKey = isInverted
    ? 'pages.reports.promisesDaily.invalidRange'
    : isTooLong
      ? 'pages.reports.promisesDaily.rangeTooLong'
      : null

  const query = usePromisesDailyReport({
    projectId,
    // The fallbacks are never sent: a missing bound can only come from an
    // invalid URL value, which is exactly what sets `hasFilterError` and
    // disables the query.
    dateFrom: dateFrom ?? today,
    dateTo: dateTo ?? monthEnd,
    timezone: userTimezone,
    possiblePayment,
    enabled: !hasFilterError,
  })

  // keepPreviousData shows the previous window's matrix while a new one loads
  // — it must not look final, hence the busy overlay. Placeholder only: a
  // background refetch of the SAME window shows current data and needs none.
  const isRefreshing = query.isPlaceholderData

  const errorStatus = getErrorStatus(query.error)
  const isForbidden = errorStatus === 403
  const isUnavailable = isTransientFailure(query.error)
  const errorMessage = isUnavailable
    ? // Covers the endpoint's 503s — the auth-service org directory being down
      // (without it the series cannot be grouped into departments) and the
      // lookup blowing its deadline. The operator's move is the same in both:
      // wait and retry; a partial report is never shown.
      t('pages.reports.promisesDaily.unavailable')
    : isForbidden
      ? t('pages.reports.promisesDaily.forbidden')
      : // Backend date/timezone validation answers 400 with a human-readable
        // detail (inverted window, > 367 days, a date outside
        // 1900-01-01..9998-12-31, an unknown IANA zone). Passing it through
        // verbatim is what makes the refusal actionable — but only when the
        // answer HAS a detail (see hasResponseDetail), otherwise axios' own
        // untranslated sentence would leak through.
        errorStatus === 400 && hasResponseDetail(query.error)
        ? getErrorMessage(query.error)
        : t('pages.reports.promisesDaily.error.title')

  // The 503s are worded distinctly by the backend on purpose, so the server's
  // own sentence is shown UNDER the localized one rather than instead of it.
  // Absent for a transport-level failure (a 502/504 or a dropped connection
  // carries no body).
  const errorDetail =
    isUnavailable && hasResponseDetail(query.error) ? getErrorMessage(query.error) : null

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Both bounds are REQUIRED — neither may be left empty, so there is no
          "×" on either field; the window simply defaults to today → end of
          the current month.

          NEITHER picker is bounded by the other (no `min`/`max`), on purpose:
          the page-wide rule for every date pair WITH A DEFAULTED WINDOW
          (processing, searcher, operator-promises, outbound-calls — the
          reasoning is written out in full in OperatorPromisesTab). The
          pair-level guard below is what actually protects the API — manual
          input and hand-edited URLs bypass picker bounds anyway. */}
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl p-4 shadow-sm sm:gap-4">
        <DateSelect
          label={t('pages.reports.promisesDaily.dateFrom')}
          value={dateFrom ?? null}
          // Only the bound that actually carries the unusable value is marked.
          // `error` (not `invalidText`) is the right prop: the value arrives
          // already committed, from the URL, not as half-typed text.
          error={fromBound.isInvalid ? dateError : undefined}
          onChange={handleDateChange(DATE_FROM_KEY)}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <DateSelect
          label={t('pages.reports.promisesDaily.dateTo')}
          value={dateTo ?? null}
          error={toBound.isInvalid ? dateError : undefined}
          onChange={handleDateChange(DATE_TO_KEY)}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <label className="flex h-[45px] cursor-pointer items-center gap-2">
          <Checkbox
            checked={isWholeMonth}
            onCheckedChange={handleWholeMonthChange}
            aria-label={t('pages.reports.promisesDaily.wholeMonth')}
          />
          <span className="text-foreground text-xs font-medium sm:text-sm">
            {t('pages.reports.promisesDaily.wholeMonth')}
          </span>
        </label>
        <label className="flex h-[45px] cursor-pointer items-center gap-2">
          <Checkbox
            checked={possiblePayment}
            onCheckedChange={(checked) =>
              // The backend default (off) is the ABSENCE of the key, never a
              // spelled-out `pdp=0`: a shared link then carries only choices
              // somebody made.
              setUrlParam(POSSIBLE_PAYMENT_KEY, checked === true ? '1' : null)
            }
            aria-label={t('pages.reports.promisesDaily.possiblePayments')}
          />
          <span className="text-foreground text-xs font-medium sm:text-sm">
            {t('pages.reports.promisesDaily.possiblePayments')}
          </span>
        </label>
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
          claim the window is empty. */}
      {hasFilterError ? null : query.isLoading ? (
        <TableSkeleton columns={SKELETON_COLUMNS} rows={6} />
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
              {t('pages.reports.promisesDaily.error.retry')}
            </Button>
          )}
        </div>
      ) : query.data ? (
        <div className="relative flex w-full flex-col gap-2" aria-busy={isRefreshing || undefined}>
          {/* The answer may be up to 15 minutes old (worker-local server
              cache), and `generated_at` is stamped when the numbers were
              computed — so it is shown rather than implied. Rendered in the
              PROFILE timezone, the one that cut the window, not in whatever
              zone the browser happens to be in. */}
          <p className="text-muted-foreground self-end text-xs">
            {t('pages.reports.promisesDaily.generatedAt', {
              value: formatDateTime(query.data.generated_at, language, userTimezone),
            })}
          </p>
          {/* An empty answer is a normal 200: nobody promised anything for the
              window. */}
          <PromisesDailyTable
            dates={query.data.dates}
            departments={query.data.departments}
            total={query.data.total}
            emptyMessage={t('pages.reports.promisesDaily.empty')}
          />
          {isRefreshing && (
            <div
              data-testid="promises-daily-refreshing"
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
