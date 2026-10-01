/**
 * LowVerificationFeedTab Component
 *
 * «Мало верифікацій» feed tab for the Reports page: a WORK LIST of freshly
 * purchased clients that still carry few verified third-party contacts — the
 * flip side of the per-operator verification KPI tab. One row = one client.
 *
 * All filter state and the current page live in the URL (`?pf=`, `?pt=`,
 * `?mv=`, `?pg=`, `?ps=`) so they survive refresh, bookmarking and switching
 * between the page tabs (panels unmount on switch). Filter updates use
 * `replace` — only page-tab changes create history entries. The URL shell —
 * composed updates, page/page-size parsing, the page clamp and its self-heal —
 * is the shared `useUrlPagedFeedFilters`; the keys are this tab's set in the
 * page-wide registry (`src/lib/reportsUrlKeys.ts`).
 *
 * The URL keys are deliberately NOT the verification tab's `sf`/`st`: the host
 * page keeps every tab's params in the URL, and the two sell windows differ in
 * kind (this one is optional and uncapped, the other defaults to the current
 * month and is capped at 366 days). A shared key would silently transplant one
 * tab's filter into the other.
 *
 * Both sell bounds default to EMPTY and are INDEPENDENT: either may be set
 * alone, which the backend accepts as an open-ended bound. They can only
 * NARROW the feed's built-in floor (last purchase not older than the response's
 * `months_floor` months), never widen it — which is why, unlike the sibling
 * reports, there is no 366-day window cap to mirror here.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import {
  ReportRefreshingOverlay,
  ReportTableLoading,
} from '@/features/report/components/ReportLoadingState'
import {
  useDateWindowFilters,
  useFeedErrorMessage,
  usePagedFeedPages,
  useUrlPagedFeedFilters,
} from '@/hooks'
import { Icons } from '@/lib/icons'
import { REPORTS_URL_KEYS } from '@/lib/reportsUrlKeys'
import { useAuthStore } from '@/stores/authStore'
import { useLowVerificationFeed } from '../hooks'
import { MAX_VERIFIED_CEILING, parseMaxVerified } from '../utils/maxVerified'
import { LOW_VERIFICATION_COLUMN_COUNT, LowVerificationTable } from './LowVerificationTable'

/** This tab's slice of the Reports page URL namespace (see the registry). */
const {
  sellFrom: SELL_FROM_KEY,
  sellTo: SELL_TO_KEY,
  maxVerified: MAX_VERIFIED_KEY,
  page: PAGE_KEY,
  pageSize: PAGE_SIZE_KEY,
} = REPORTS_URL_KEYS.lowVerificationFeed

/**
 * The keys this tab may write as FILTERS — handed to the shell so a misspelled
 * key is a compile error rather than a value written under a name nothing
 * reads (or, worse, one a sibling tab owns). The paging keys are the shell's
 * own and are configured, not passed per call.
 */
type FilterKey = typeof SELL_FROM_KEY | typeof SELL_TO_KEY | typeof MAX_VERIFIED_KEY

/**
 * This tab's wording for the two window complaints (see `useDateWindowFilters`).
 * The sell window's keys are NOT spelled like the other report tabs' — the
 * section has always named them `invalidSell*`, which is why the hook takes
 * whole keys instead of a prefix.
 */
const SELL_WINDOW_ERROR_KEYS = {
  invalidDate: 'pages.reports.lowVerification.invalidSellDate',
  invertedRange: 'pages.reports.lowVerification.invalidSellRange',
} as const

export function LowVerificationFeedTab() {
  const { t } = useTranslation('common')

  // Same project resolution as the Reports dashboard: active project first,
  // then the first assigned project, then 1.
  const user = useAuthStore((state) => state.user)
  const projectId: number = Number(user?.active_project_id ?? user?.projects?.[0]?.id ?? 1)
  const userTimezone = user?.timezone

  // The shared paged-feed URL shell: composed `replace` updates (the
  // same-tick-burst ref composition lives there), defensive page/page-size
  // parsing against the backend's `skip`/`limit` caps, and the page reset on
  // every filter change. Defaults match the backend's own `limit=50`.
  const filters = useUrlPagedFeedFilters<FilterKey>({
    pageKey: PAGE_KEY,
    pageSizeKey: PAGE_SIZE_KEY,
  })
  const { searchParams, pageSize, setFilterParam } = filters

  // The shared window reader. NO defaults: an unset bound means "no bound",
  // not "today" — either may be set alone, which the backend accepts as an
  // open-ended bound. NO `cap` either: these bounds can only NARROW the feed's
  // built-in floor, so the backend caps nothing here (see the module comment),
  // and the suite pins that a window wider than the sibling reports' 366 days
  // does go out.
  const {
    dateFrom: sellFrom,
    dateTo: sellTo,
    isFromInvalid: isSellFromInvalid,
    isToInvalid: isSellToInvalid,
    dateError: sellDateError,
    rangeError: sellRangeError,
    hasWindowError,
  } = useDateWindowFilters({
    searchParams,
    fromKey: SELL_FROM_KEY,
    toKey: SELL_TO_KEY,
    keys: SELL_WINDOW_ERROR_KEYS,
  })

  const rawMaxVerified = searchParams.get(MAX_VERIFIED_KEY) ?? ''

  // Whatever the field or a hand-edited URL carries is validated here and gets
  // an inline hint rather than the 422 the backend would answer with.
  const maxVerified = parseMaxVerified(rawMaxVerified)

  const handleDateChange = (key: FilterKey) => filters.dateFilterHandler(key)

  // The numeric filter is committed on blur/Enter rather than per keystroke:
  // this endpoint fetches the whole candidate set (3–6 s cold, see
  // docs/low-verification-feed.md), so typing "100" must not fire three of
  // them. Same shape as DateSelect's manual input, which also commits a
  // finished value and resyncs otherwise.
  const [maxVerifiedText, setMaxVerifiedText] = useState(rawMaxVerified)
  useEffect(() => {
    // Resync when the URL changes from the outside (Back/Forward, a shared link).
    setMaxVerifiedText(rawMaxVerified)
  }, [rawMaxVerified])

  const commitMaxVerified = () => {
    const trimmed = maxVerifiedText.trim()
    // Nothing to commit when the field still holds what the URL already says —
    // a bare focus/blur must not reset the page.
    if (trimmed === rawMaxVerified) return
    setFilterParam(MAX_VERIFIED_KEY, trimmed === '' ? null : trimmed)
  }

  // A bad cap belongs to ONE field, so it rides that field's `error` prop: the
  // red border, `aria-invalid` and `aria-describedby` all land on the offending
  // input, and a screen reader reaches the explanation from the field itself.
  // (The sell window's own two messages are split along the same line by the
  // shared hook — a bad bound on its field, an inverted pair as a standalone
  // alert, because neither bound is wrong on its own there.)
  const maxVerifiedError = maxVerified.isInvalid
    ? t(
        // The two refusals get different sentences: a value past the backend's
        // int32 ceiling IS "a whole number of 0 or more", so that hint would
        // describe everything except the actual violation. (Same split as the
        // sibling feed's gap_min.)
        maxVerified.isTooLarge
          ? 'pages.reports.lowVerification.maxVerifiedTooLarge'
          : 'pages.reports.lowVerification.invalidMaxVerified',
        // The ceiling is INTERPOLATED, never spelled out in the locale files:
        // the number the hint quotes and the number the parser enforces are the
        // same constant, so a backend bound change cannot leave two translations
        // quoting a limit that no longer exists.
        { max: MAX_VERIFIED_CEILING }
      )
    : undefined

  // The window is not this tab's only filter, which is exactly why the hook
  // names its verdict for the WINDOW: `enabled: !hasWindowError` would let a
  // bad numeric filter reach the backend for a 422.
  const hasFilterError = hasWindowError || maxVerified.isInvalid

  const query = useLowVerificationFeed({
    projectId,
    sellFrom,
    sellTo,
    maxVerified: maxVerified.value,
    skip: filters.skip,
    limit: pageSize,
    timezone: userTimezone,
    enabled: !hasFilterError,
  })

  // Stable identity for the empty fallback — a fresh `[]` every render would
  // defeat LowVerificationTable's useMemo over its rows prop.
  const rows = useMemo(() => query.data?.rows ?? [], [query.data])

  // Totals, the display clamp for a bookmarked page the drained feed no longer
  // has, and the URL self-heal that follows the answer — shared shell.
  const { total, totalPages, clampedPage } = usePagedFeedPages(filters, query.data)

  // The floor comes from the answer, never from a constant here: the backend
  // keeps it in an env var (`LOW_VERIFICATION_MONTHS_FLOOR`) and now echoes the
  // value it actually applied, so the hint below cannot drift out of step with
  // the environment it describes. `undefined` until the first response — the
  // hint explains the data, so it has nothing to say before there is any.
  const monthsFloor = query.data?.months_floor

  // keepPreviousData shows the previous page's rows while a new one loads —
  // they must not look final, hence the busy overlay. Placeholder only: a
  // background refetch of the SAME page shows current data and needs none.
  const isRefreshing = query.isPlaceholderData

  // The shared failure ladder (see the hook for the rungs and their order).
  // What is this endpoint's own: its 400 carries a human-readable detail from
  // the date/timezone validation, which is what makes the refusal actionable.
  // `errorDetail` is not taken — this tab has never shown the server's 503
  // sentence under the localized one.
  //
  // The 400 now goes through the hook's `hasResponseDetail` gate, which this
  // tab did not have: a 400 whose body a proxy stripped used to reach the
  // operator as axios' own untranslated "Request failed with status code 400"
  // and now reaches them as the localized title. Deliberate — see the hook.
  const { errorMessage, isForbidden } = useFeedErrorMessage(query.error, 'lowVerification')

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Filters: an optional, independent sell window + the optional cap */}
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl p-4 shadow-sm sm:gap-4">
        <DateSelect
          label={t('pages.reports.lowVerification.sellFrom')}
          value={sellFrom ?? null}
          // Bounded by the other end only when it exists — an open-ended
          // single bound must stay unconstrained.
          max={sellTo}
          // Only the bound that actually carries the unusable value is marked.
          error={isSellFromInvalid ? sellDateError : undefined}
          onChange={handleDateChange(SELL_FROM_KEY)}
          onClear={() => setFilterParam(SELL_FROM_KEY, null)}
          // Two "×" buttons stand side by side here — DateSelect's default
          // "Clear" name would be identical for both.
          clearLabel={t('pages.reports.lowVerification.clearSellFrom')}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <DateSelect
          label={t('pages.reports.lowVerification.sellTo')}
          value={sellTo ?? null}
          min={sellFrom}
          error={isSellToInvalid ? sellDateError : undefined}
          onChange={handleDateChange(SELL_TO_KEY)}
          onClear={() => setFilterParam(SELL_TO_KEY, null)}
          clearLabel={t('pages.reports.lowVerification.clearSellTo')}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <div className="w-full min-w-0 sm:w-44">
          <Input
            // Deliberately NOT type="number": the browser blanks a numeric
            // input whose value is not a number, so a `?mv=abc` would point its
            // "must be a whole number" hint at a field that LOOKS empty. A text
            // input shows the offending value back to the user; the numeric
            // keypad still comes up on touch, and the rule itself lives in
            // parseMaxVerified (which the URL bypasses anyway).
            type="text"
            inputMode="numeric"
            label={t('pages.reports.lowVerification.maxVerified')}
            placeholder={t('pages.reports.lowVerification.maxVerifiedPlaceholder')}
            error={maxVerifiedError}
            value={maxVerifiedText}
            onChange={(event) => setMaxVerifiedText(event.target.value)}
            onBlur={commitMaxVerified}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitMaxVerified()
            }}
            onClear={() => {
              setMaxVerifiedText('')
              setFilterParam(MAX_VERIFIED_KEY, null)
            }}
            // This "×" stands in a row with the two date "×" buttons —
            // Input's default "Clear" name would be identical for all three.
            clearLabel={t('pages.reports.lowVerification.clearMaxVerified')}
          />
        </div>

        {/* The feed drains between purchase batches: its months-long floor is a
            hard backend rule no filter can widen, so an empty list is a normal
            state and not a failure. Without this note the empty table reads as
            a bug — which is exactly why it renders as soon as there IS an
            answer (an empty feed is one) and not before: with no response there
            is no floor to name, and inventing one would be the drift this hint
            exists to avoid. `count` (not a plain `months` variable) so
            i18next picks the right plural form — Ukrainian needs three
            (місяць / місяці / місяців), and the old copy was only grammatical
            for 2–4. */}
        {monthsFloor !== undefined && (
          <p className="text-muted-foreground w-full text-xs">
            {t('pages.reports.lowVerification.floorHint', { count: monthsFloor })}
          </p>
        )}

        {/* Pair-level only: the single-field errors live on their fields (see
            above). This one has no single field to sit on. */}
        {sellRangeError && (
          <p className="text-error-500 w-full text-xs font-medium" role="alert">
            {sellRangeError}
          </p>
        )}
      </div>

      {/* Content: an invalid filter shows only the hints above */}
      {hasFilterError ? null : query.isLoading ? (
        // The skeleton mirrors the real table's width — the count comes from
        // LowVerificationTable so the two cannot drift apart.
        <ReportTableLoading columns={LOW_VERIFICATION_COLUMN_COUNT} />
      ) : query.isError ? (
        <div className="border-border bg-card flex w-full flex-col items-center justify-center gap-4 rounded-xl border p-8">
          <Icons.Warning size={40} className="text-error-500" />
          <p className="text-foreground text-center text-sm font-medium">{errorMessage}</p>
          {/* Retrying cannot fix missing permissions — no button on 403 */}
          {!isForbidden && (
            <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
              {t('pages.reports.lowVerification.error.retry')}
            </Button>
          )}
        </div>
      ) : (
        <div className="relative w-full" aria-busy={isRefreshing || undefined}>
          <LowVerificationTable
            rows={rows}
            emptyMessage={t('pages.reports.lowVerification.empty')}
          />
          {/* No pager for an empty feed — a lone "Page 1 of 1" under a "no
              data" row is noise. */}
          {total > 0 && (
            <Pagination
              currentPage={clampedPage}
              totalPages={totalPages}
              pageSize={pageSize}
              pageSizeOptions={filters.pageSizeOptions}
              onPageChange={filters.setPage}
              onPageSizeChange={filters.setPageSize}
            />
          )}
          {isRefreshing && <ReportRefreshingOverlay testId="low-verification-refreshing" />}
        </div>
      )}
    </div>
  )
}
