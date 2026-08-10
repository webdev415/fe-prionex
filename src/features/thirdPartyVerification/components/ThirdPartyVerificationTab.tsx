/**
 * ThirdPartyVerificationTab Component
 *
 * "Верифікація 3-х осіб" report tab for the Reports page: four date pickers
 * (the debt-purchase "sell" window and an optional contact-date "count"
 * window) and the per-operator table.
 *
 * All filter state lives in the URL (`?sf=`, `?st=`, `?cf=`, `?ct=`) so it
 * survives refresh, bookmarking and switching between the page tabs (panels
 * unmount on switch). Filter updates use `replace` — only page-tab changes
 * create history entries. Structure, error handling and the busy overlay
 * follow the processing tab (features/clientProcessing).
 *
 * Sell defaults to the current month in the profile timezone (backend-default
 * parity caveats in utils/monthRange); both dates are always sent explicitly
 * because the backend rejects one sell bound without the other. The count
 * bounds default to EMPTY and are INDEPENDENT: either may be set alone, which
 * is a legitimate open-ended contact-date filter.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { isTransientFailure } from '@/lib/api'
import { getErrorMessage, getErrorStatus } from '@/lib/errors'
import { Icons } from '@/lib/icons'
import { formatPickerDateAsYMD } from '@/lib/dateUtils'
import { useAuthStore } from '@/stores/authStore'
import { useThirdPartyVerificationReport } from '../hooks'
import { currentMonthRange } from '../utils/monthRange'
import { VerificationTable } from './VerificationTable'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Mirrors the backend's window cap `_MAX_RANGE_DAYS` in
// api-prionex/services/client/app/routers/reports.py: the (end - start) day
// difference may be at most 366 for BOTH windows — larger answers 400.
const MAX_RANGE_DAYS = 366

const MS_PER_DAY = 86_400_000

/** URL keys, kept short and distinct from the processing tab's `from/to/dept`. */
const SELL_FROM_KEY = 'sf'
const SELL_TO_KEY = 'st'
const COUNT_FROM_KEY = 'cf'
const COUNT_TO_KEY = 'ct'

type FilterKey =
  | typeof SELL_FROM_KEY
  | typeof SELL_TO_KEY
  | typeof COUNT_FROM_KEY
  | typeof COUNT_TO_KEY

/** Whole-day span between two ISO dates (the backend compares the same way). */
function spanInDays(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / MS_PER_DAY
}

export function ThirdPartyVerificationTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()

  // Same project resolution as the Reports dashboard: active project first,
  // then the first assigned project, then 1.
  const user = useAuthStore((state) => state.user)
  const projectId: number = Number(user?.active_project_id ?? user?.projects?.[0]?.id ?? 1)
  const userTimezone = user?.timezone

  const sellDefaults = currentMonthRange(userTimezone)
  const rawSellFrom = searchParams.get(SELL_FROM_KEY)
  const rawSellTo = searchParams.get(SELL_TO_KEY)
  const rawCountFrom = searchParams.get(COUNT_FROM_KEY)
  const rawCountTo = searchParams.get(COUNT_TO_KEY)

  const sellFrom = rawSellFrom && DATE_RE.test(rawSellFrom) ? rawSellFrom : sellDefaults.from
  const sellTo = rawSellTo && DATE_RE.test(rawSellTo) ? rawSellTo : sellDefaults.to
  // No default: an unset count bound means "no bound", not "today".
  const countFrom = rawCountFrom && DATE_RE.test(rawCountFrom) ? rawCountFrom : undefined
  const countTo = rawCountTo && DATE_RE.test(rawCountTo) ? rawCountTo : undefined

  // Functional form only: a clone taken from a render-scoped `searchParams`
  // would drop a concurrent update from another field.
  // Filter updates never create history entries (page-tab switches do).
  const setUrlParam = (key: FilterKey, value: string | null) => {
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

  // Timezone policy: the profile TZ applies only to the current-month DEFAULT
  // above (resolving the moment "now" into calendar days). A PICKED date is
  // already a calendar day — the picker hands us a local-midnight Date whose
  // local Y/M/D are exactly the cell the user clicked, so we read them back
  // verbatim with formatPickerDateAsYMD.
  const handleDateChange =
    (key: FilterKey) =>
    ({ value }: { value: Date | null }) => {
      // A cleared manual input is not a filter change: the URL keeps the old
      // value and a valid date commits once the user finishes retyping
      // (DateSelect itself resyncs the abandoned text on blur). Removing a
      // count bound is an explicit action — the "×" button below.
      if (value) setUrlParam(key, formatPickerDateAsYMD(value))
    }

  // Manual input can bypass the pickers' min/max, so invalid ranges must not
  // reach the API. ISO YYYY-MM-DD strings compare correctly as strings.
  const isSellInverted = sellFrom > sellTo
  const isSellTooLong = !isSellInverted && spanInDays(sellFrom, sellTo) > MAX_RANGE_DAYS
  const sellErrorKey = isSellInverted
    ? 'pages.reports.verification.invalidSellRange'
    : isSellTooLong
      ? 'pages.reports.verification.sellRangeTooLong'
      : null

  // Only a FULLY specified count window can be inverted or too wide — a single
  // bound is a legitimate open-ended filter (backend rule, same branch).
  const hasBothCountBounds = !!countFrom && !!countTo
  const isCountInverted = hasBothCountBounds && countFrom > countTo
  const isCountTooLong =
    hasBothCountBounds && !isCountInverted && spanInDays(countFrom, countTo) > MAX_RANGE_DAYS
  const countErrorKey = isCountInverted
    ? 'pages.reports.verification.invalidCountRange'
    : isCountTooLong
      ? 'pages.reports.verification.countRangeTooLong'
      : null

  const hasFilterError = !!sellErrorKey || !!countErrorKey

  const query = useThirdPartyVerificationReport({
    projectId,
    sellFrom,
    sellTo,
    countFrom,
    countTo,
    timezone: userTimezone,
    enabled: !hasFilterError,
  })

  // Stable identity for the empty fallback — a fresh `[]` every render would
  // defeat VerificationTable's useMemo over its rows prop.
  const rows = useMemo(() => query.data?.rows ?? [], [query.data])

  // keepPreviousData shows the previous window's rows while a new one loads —
  // they must not look final, hence the busy overlay. Placeholder only: a
  // background refetch of the SAME window shows current data and needs none.
  const isRefreshing = query.isPlaceholderData

  const errorStatus = getErrorStatus(query.error)
  const isForbidden = errorStatus === 403
  const errorMessage = isTransientFailure(query.error)
    ? t('pages.reports.verification.unavailable')
    : isForbidden
      ? t('pages.reports.verification.forbidden')
      : errorStatus === 400
        ? // Backend range validation answers 400 with a human-readable detail
          getErrorMessage(query.error)
        : t('pages.reports.verification.error.title')

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Filters: sell window (required, defaults to the current month) +
          optional independent count window */}
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl p-4 shadow-sm sm:gap-4">
        <DateSelect
          label={t('pages.reports.verification.sellFrom')}
          value={sellFrom}
          max={sellTo}
          onChange={handleDateChange(SELL_FROM_KEY)}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <DateSelect
          label={t('pages.reports.verification.sellTo')}
          value={sellTo}
          min={sellFrom}
          onChange={handleDateChange(SELL_TO_KEY)}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <DateSelect
          label={t('pages.reports.verification.countFrom')}
          value={countFrom ?? null}
          // Bounded by the other end only when it exists — an open-ended
          // single bound must stay unconstrained.
          max={countTo}
          onChange={handleDateChange(COUNT_FROM_KEY)}
          onClear={() => setUrlParam(COUNT_FROM_KEY, null)}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <DateSelect
          label={t('pages.reports.verification.countTo')}
          value={countTo ?? null}
          min={countFrom}
          onChange={handleDateChange(COUNT_TO_KEY)}
          onClear={() => setUrlParam(COUNT_TO_KEY, null)}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />

        {/* Deliberate addition over the Techno-Finance reference, which shows
            the four pickers with no explanation: the plan is always a MONTHLY
            figure derived from the sell window, while the fact is counted over
            the count window. Without this note a one-day count window shows a
            deeply negative "shortfall" by construction and reads as a bug. */}
        <p className="text-muted-foreground w-full text-xs">
          {t('pages.reports.verification.planHint')}
        </p>

        {sellErrorKey && (
          <p className="text-error-500 w-full text-xs font-medium" role="alert">
            {t(sellErrorKey)}
          </p>
        )}
        {countErrorKey && (
          <p className="text-error-500 w-full text-xs font-medium" role="alert">
            {t(countErrorKey)}
          </p>
        )}
      </div>

      {/* Content: an invalid range shows only the hints above */}
      {hasFilterError ? null : query.isLoading ? (
        <TableSkeleton columns={6} rows={6} />
      ) : query.isError ? (
        <div className="border-border bg-card flex w-full flex-col items-center justify-center gap-4 rounded-xl border p-8">
          <Icons.Warning size={40} className="text-error-500" />
          <p className="text-foreground text-center text-sm font-medium">{errorMessage}</p>
          {/* Retrying cannot fix missing permissions — no button on 403 */}
          {!isForbidden && (
            <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
              {t('pages.reports.verification.error.retry')}
            </Button>
          )}
        </div>
      ) : (
        <div className="relative w-full" aria-busy={isRefreshing || undefined}>
          <VerificationTable rows={rows} />
          {isRefreshing && (
            <div
              data-testid="verification-refreshing"
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
