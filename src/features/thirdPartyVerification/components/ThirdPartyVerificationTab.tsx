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
 * Unlike the three paged FEED tabs, this report is NOT built on the shared
 * `useUrlPagedFeedFilters` shell: the endpoint returns the whole per-operator
 * table (no pagination), so there is no page to reset, clamp or self-heal —
 * the shell's actual substance. What the tabs do share is the URL key
 * namespace, declared in `src/lib/reportsUrlKeys.ts`.
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
import {
  ReportRefreshingOverlay,
  ReportTableLoading,
} from '@/features/report/components/ReportLoadingState'
import { useFeedErrorMessage } from '@/hooks'
import { isRealCalendarDate } from '@/lib/calendarDate'
import { Icons } from '@/lib/icons'
import { formatPickerDateAsYMD } from '@/lib/dateUtils'
import { isWindowTooLong } from '@/lib/reportWindow'
import { REPORTS_URL_KEYS } from '@/lib/reportsUrlKeys'
import { useAuthStore } from '@/stores/authStore'
import { useThirdPartyVerificationReport } from '../hooks'
import { currentMonthRange } from '../utils/monthRange'
import { VerificationTable } from './VerificationTable'

/** This tab's slice of the Reports page URL namespace (see the registry). */
const {
  sellFrom: SELL_FROM_KEY,
  sellTo: SELL_TO_KEY,
  countFrom: COUNT_FROM_KEY,
  countTo: COUNT_TO_KEY,
} = REPORTS_URL_KEYS.verification

type FilterKey =
  | typeof SELL_FROM_KEY
  | typeof SELL_TO_KEY
  | typeof COUNT_FROM_KEY
  | typeof COUNT_TO_KEY

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

  // A present-but-unusable bound is NOT silently replaced by the default: the
  // URL would then disagree with both the field and the request. It goes down
  // the same path as an inverted range — inline hint, no request (below). An
  // absent (or empty) parameter stays a plain "no value".
  const hasInvalidSellDate =
    (!!rawSellFrom && !isRealCalendarDate(rawSellFrom)) ||
    (!!rawSellTo && !isRealCalendarDate(rawSellTo))
  const hasInvalidCountDate =
    (!!rawCountFrom && !isRealCalendarDate(rawCountFrom)) ||
    (!!rawCountTo && !isRealCalendarDate(rawCountTo))

  const sellFrom = rawSellFrom && isRealCalendarDate(rawSellFrom) ? rawSellFrom : sellDefaults.from
  const sellTo = rawSellTo && isRealCalendarDate(rawSellTo) ? rawSellTo : sellDefaults.to
  // No default: an unset count bound means "no bound", not "today".
  const countFrom = rawCountFrom && isRealCalendarDate(rawCountFrom) ? rawCountFrom : undefined
  const countTo = rawCountTo && isRealCalendarDate(rawCountTo) ? rawCountTo : undefined

  // Filter updates never create history entries (page-tab switches do). The
  // simple functional form is enough here — but NOT for the reason its `prev`
  // suggests: in react-router 7.9.6 `prev` is itself a clone of the
  // RENDER-SCOPED params, so two updates fired in the same tick would still
  // drop one another's keys. Nothing in this tab fires such a burst (each
  // picker commits its own separate user action), which is the actual
  // guarantee this relies on; the paged feeds, whose shared Pagination does
  // emit a same-tick pair, compose through a ref instead — see
  // useUrlPagedFeedFilters.
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
  const isSellInverted = !hasInvalidSellDate && sellFrom > sellTo
  const isSellTooLong = !hasInvalidSellDate && isWindowTooLong(sellFrom, sellTo)
  const sellErrorKey = hasInvalidSellDate
    ? 'pages.reports.verification.invalidSellDate'
    : isSellInverted
      ? 'pages.reports.verification.invalidSellRange'
      : isSellTooLong
        ? 'pages.reports.verification.sellRangeTooLong'
        : null

  // Only a FULLY specified count window can be inverted or too wide — a single
  // bound is a legitimate open-ended filter (backend rule, same branch).
  const hasBothCountBounds = !!countFrom && !!countTo
  const isCountInverted = hasBothCountBounds && countFrom > countTo
  const isCountTooLong = hasBothCountBounds && isWindowTooLong(countFrom, countTo)
  const countErrorKey = hasInvalidCountDate
    ? 'pages.reports.verification.invalidCountDate'
    : isCountInverted
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

  // The shared failure ladder (see the hook for the rungs and their order).
  // What is this endpoint's own: its 400 carries a human-readable detail from
  // the range validation — and this report measures TWO windows, so that
  // detail is the only thing that says which one the backend refused.
  // `errorDetail` is not taken — this tab has never shown the server's 503
  // sentence under the localized one.
  //
  // The 400 now goes through the hook's `hasResponseDetail` gate, which this
  // tab did not have: a 400 whose body a proxy stripped used to reach the
  // operator as axios' own untranslated "Request failed with status code 400"
  // and now reaches them as the localized title. Deliberate — see the hook.
  const { errorMessage, isForbidden } = useFeedErrorMessage(query.error, 'verification')

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
          // Two "×" buttons stand side by side here — DateSelect's default
          // "Clear" name would be identical for both.
          clearLabel={t('pages.reports.verification.clearCountFrom')}
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
          clearLabel={t('pages.reports.verification.clearCountTo')}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />

        {/* Deliberate addition over the Techno-Finance reference, which shows
            the four pickers with no explanation: the plan comes from the client
            cohort of the WHOLE sell window (a month is only the default window),
            while the fact is counted over the count window. Without this note a
            one-day count window shows a deeply negative "shortfall" by
            construction and reads as a bug. */}
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
        <ReportTableLoading columns={6} />
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
          {isRefreshing && <ReportRefreshingOverlay testId="verification-refreshing" />}
        </div>
      )}
    </div>
  )
}
