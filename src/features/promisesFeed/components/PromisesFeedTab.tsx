/**
 * PromisesFeedTab Component
 *
 * «Обіцянки» feed tab for the Reports page (migrated Metabase Card 119): a
 * row-by-row WORK LIST of promises whose PROMISED date falls inside the
 * window — the operator's list of who has to pay in the period and whether
 * they were already worked or already paid.
 *
 * All filter state and the current page live in the URL (`?prf=`, `?prt=`,
 * `?prw=`, `?prp=`, `?prpg=`, `?prps=`) so they survive refresh, bookmarking
 * and switching between the page tabs (panels unmount on switch). Filter
 * updates use `replace` — only page-tab changes create history entries. The
 * URL shell — composed updates, page/page-size parsing, the page clamp and
 * its self-heal — is the shared `useUrlPagedFeedFilters`; the keys are this
 * tab's set in the page-wide registry (`src/lib/reportsUrlKeys.ts`),
 * deliberately NEW so no sibling tab's filter is silently transplanted into
 * this one.
 *
 * The window is ONE date pair and the tab always sends both bounds — the
 * DEFAULT is today–today in the profile timezone (Techno-Finance parity: the
 * card defaults to today in Kyiv), held in state seeded at mount and
 * re-resolved on window focus (an overnight tab rolls to the new day when
 * the operator returns to it), and deliberately NOT written into the URL (an
 * auto-derived value in a shared link would pin "today" to the day the link
 * was made). The backend caps the window at a 366-day difference (mirrored
 * here — see utils/window.ts) and answers 400 on an inverted pair (guarded
 * here before any request leaves).
 *
 * «Скрыть отработанных» / «Скрыть оплативших» are SERVER-side filters
 * (`hide_worked`/`hide_paid`): the feed is paginated, so hiding client-side
 * would tear holes in pages. Toggling one is a filter change — it resets the
 * page in the same URL update and refetches. The off state is the ABSENCE of
 * the key (`prw`/`prp` present-as-"1"), so a shared link carries only
 * choices somebody made.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { DateSelect } from '@/components/ui/DateSelect'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { usePagedFeedPages, useUrlPagedFeedFilters } from '@/hooks'
import { isTransientFailure } from '@/lib/api'
import { getDateStringInTimezone } from '@/lib/dateUtils'
import { getErrorMessage, getErrorStatus, hasResponseDetail } from '@/lib/errors'
import { Icons } from '@/lib/icons'
import { REPORTS_URL_KEYS } from '@/lib/reportsUrlKeys'
import { readUrlDateBound } from '@/lib/urlDateBound'
import { useAuthStore } from '@/stores/authStore'
import { usePromisesFeed } from '../hooks'
import { isWindowTooLong } from '../utils/window'
import { PROMISES_FEED_COLUMN_COUNT, PromisesFeedTable } from './PromisesFeedTable'

/** This tab's slice of the Reports page URL namespace (see the registry). */
const {
  dateFrom: DATE_FROM_KEY,
  dateTo: DATE_TO_KEY,
  hideWorked: HIDE_WORKED_KEY,
  hidePaid: HIDE_PAID_KEY,
  page: PAGE_KEY,
  pageSize: PAGE_SIZE_KEY,
} = REPORTS_URL_KEYS.promisesFeed

/**
 * The keys this tab may write as FILTERS — handed to the shell so a
 * misspelled key is a compile error rather than a value written under a name
 * nothing reads (or, worse, one a sibling tab owns). The paging keys are the
 * shell's own and are configured, not passed per call.
 */
type FilterKey =
  | typeof DATE_FROM_KEY
  | typeof DATE_TO_KEY
  | typeof HIDE_WORKED_KEY
  | typeof HIDE_PAID_KEY

export function PromisesFeedTab() {
  const { t } = useTranslation('common')

  // Same project resolution as the Reports dashboard: active project first,
  // then the first assigned project, then 1.
  const user = useAuthStore((state) => state.user)
  const projectId: number = Number(user?.active_project_id ?? user?.projects?.[0]?.id ?? 1)
  const userTimezone = user?.timezone

  // The default window: "today" resolved in the PROFILE timezone — "now" is a
  // real moment, and near midnight the browser's day and the operator's day
  // differ. The same timezone travels to the backend, which cuts the
  // PROMISED-date calendar days in it, so the two ends of the request agree
  // on what "today" means.
  //
  // Held in STATE, not read off the wall clock in render: seeded once at
  // mount and re-resolved on window focus, so a tab left open across midnight
  // picks up the new day the moment the operator comes back to it instead of
  // keeping yesterday's window until an unrelated re-render. The functional
  // update returns the previous value while the day is unchanged, so a
  // same-day focus re-renders nothing. `today` only backs the DEFAULT window
  // below — user-picked URL bounds never move when the day rolls over. Same
  // pattern as the searcher feed.
  const [today, setToday] = useState(() => getDateStringInTimezone(new Date(), userTimezone))
  useEffect(() => {
    const refreshToday = () =>
      setToday((prev) => {
        const next = getDateStringInTimezone(new Date(), userTimezone)
        return next === prev ? prev : next
      })
    // The profile timezone can change what "today" means without the clock
    // moving (it loads or changes after mount) — re-resolve right away, not
    // only on the next focus.
    refreshToday()
    window.addEventListener('focus', refreshToday)
    return () => window.removeEventListener('focus', refreshToday)
  }, [userTimezone])

  // The shared paged-feed URL shell: composed `replace` updates (the
  // same-tick-burst ref composition lives there), defensive page/page-size
  // parsing against the backend's `skip`/`limit` caps, and the page reset on
  // every filter change. Defaults match the backend's own `limit=50`.
  const filters = useUrlPagedFeedFilters<FilterKey>({
    pageKey: PAGE_KEY,
    pageSizeKey: PAGE_SIZE_KEY,
  })
  const { searchParams, pageSize } = filters

  // A present-but-unusable bound is NOT silently replaced by the default: the
  // URL would then disagree with both the field and the request. It goes down
  // the same path as an inverted range — inline hint, no request (below).
  // Tracked per bound so the hint can sit on the field holding the bad value.
  const dateFromBound = readUrlDateBound(searchParams, DATE_FROM_KEY)
  const dateToBound = readUrlDateBound(searchParams, DATE_TO_KEY)
  const isDateFromInvalid = dateFromBound.isInvalid
  const isDateToInvalid = dateToBound.isInvalid
  const hasInvalidDate = isDateFromInvalid || isDateToInvalid

  // An ABSENT bound means "today", not "no bound": the pair always goes to
  // the API whole (the backend would default an absent bound to today itself,
  // but the fields and the request must never disagree).
  const dateFrom = dateFromBound.value ?? today
  const dateTo = dateToBound.value ?? today

  // There is no "×" on these fields on purpose — the pair is mandatory, and
  // the way back to the default is simply picking today.
  const handleDateChange = (key: FilterKey) => filters.dateFilterHandler(key)

  // The two server-side toggles: present-as-"1" is on, absent is the backend
  // default (off). A toggle is a FILTER — setFilterParam resets the page in
  // the same URL update, or the user lands on an offset the filtered feed may
  // not even have.
  const hideWorked = searchParams.get(HIDE_WORKED_KEY) === '1'
  const hidePaid = searchParams.get(HIDE_PAID_KEY) === '1'
  const handleToggle = (key: FilterKey) => (checked: boolean | 'indeterminate') =>
    filters.setFilterParam(key, checked === true ? '1' : null)

  // The only guards against an inverted or oversized window: the pickers
  // deliberately do not bound each other (see the fields below), and manual
  // input and hand-edited URLs would bypass such bounds anyway. ISO
  // YYYY-MM-DD strings compare correctly as strings.
  const isRangeInverted = !hasInvalidDate && dateFrom > dateTo
  const isTooLong = !hasInvalidDate && !isRangeInverted && isWindowTooLong(dateFrom, dateTo)

  // Where a message is rendered follows WHAT it is about: a bad date belongs
  // to ONE field, so it rides that field's `error` prop; an inverted or
  // oversized window belongs to the PAIR — neither bound is wrong on its own
  // — so it stays a standalone alert under the filters. Same split as the
  // sibling feed tabs.
  const dateError = hasInvalidDate ? t('pages.reports.promisesFeed.invalidDate') : undefined
  const rangeError = isRangeInverted
    ? t('pages.reports.promisesFeed.invalidRange')
    : isTooLong
      ? t('pages.reports.promisesFeed.rangeTooLong')
      : undefined

  const hasFilterError = hasInvalidDate || isRangeInverted || isTooLong

  const query = usePromisesFeed({
    projectId,
    dateFrom,
    dateTo,
    hideWorked,
    hidePaid,
    skip: filters.skip,
    limit: pageSize,
    timezone: userTimezone,
    enabled: !hasFilterError,
  })

  // Stable identity for the empty fallback — a fresh `[]` every render would
  // defeat PromisesFeedTable's useMemo over its rows prop.
  const rows = useMemo(() => query.data?.rows ?? [], [query.data])

  // Totals, the display clamp for a bookmarked page the drained feed no longer
  // has, and the URL self-heal that follows the answer — shared shell.
  const { total, totalPages, clampedPage } = usePagedFeedPages(filters, query.data)

  // keepPreviousData shows the previous page's rows while a new one loads —
  // they must not look final, hence the busy overlay. Placeholder only: a
  // background refetch of the SAME page shows current data and needs none.
  const isRefreshing = query.isPlaceholderData

  const errorStatus = getErrorStatus(query.error)
  const isForbidden = errorStatus === 403
  const isUnavailable = isTransientFailure(query.error)
  const errorMessage = isUnavailable
    ? // Covers the endpoint's 503s — the auth-service org directory being down
      // (without it the rows cannot be grouped into departments), the payment
      // lookup failing and either blowing its deadline. The operator's move is
      // the same in all: wait and retry; a partial feed is never shown — a
      // silently missing payment would read as "not paid" and send an operator
      // to dun somebody who paid an hour ago.
      t('pages.reports.promisesFeed.unavailable')
    : isForbidden
      ? t('pages.reports.promisesFeed.forbidden')
      : // Backend date/timezone validation answers 400 with a human-readable
        // detail (inverted window, > 366-day difference, a date outside the
        // supported range, an unknown IANA zone). Passing it through verbatim
        // is what makes the refusal actionable — but only when the answer HAS
        // a detail (see hasResponseDetail), otherwise axios' own untranslated
        // sentence would leak through.
        errorStatus === 400 && hasResponseDetail(query.error)
        ? getErrorMessage(query.error)
        : t('pages.reports.promisesFeed.error.title')

  // The 503s are worded distinctly by the backend on purpose — the remedies
  // differ and monitoring must tell an outage from a timeout — so the
  // server's own sentence is shown UNDER the localized one rather than
  // instead of it. Absent for a transport-level failure (a 502/504 or a
  // dropped connection carries no body).
  const errorDetail =
    isUnavailable && hasResponseDetail(query.error) ? getErrorMessage(query.error) : null

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Filters: the mandatory promised-date window (default today–today)
          and the two server-side toggles.

          NEITHER picker is bounded by the other (no `min`/`max`), on purpose —
          the page-wide rule for every date pair WITH A DEFAULTED WINDOW
          (processing, searcher, operator-promises, outbound-calls,
          promises-daily; the reasoning is written out in full in
          SearcherFollowupFeedTab). The pair-level guard below is what
          actually protects the API — manual input and hand-edited URLs bypass
          picker bounds anyway. */}
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl p-4 shadow-sm sm:gap-4">
        <DateSelect
          label={t('pages.reports.promisesFeed.dateFrom')}
          // An unusable URL value shows an empty field with the error on it,
          // never the default silently standing in for the bad value.
          value={isDateFromInvalid ? null : dateFrom}
          // Only the bound that actually carries the unusable value is marked.
          error={isDateFromInvalid ? dateError : undefined}
          onChange={handleDateChange(DATE_FROM_KEY)}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <DateSelect
          label={t('pages.reports.promisesFeed.dateTo')}
          value={isDateToInvalid ? null : dateTo}
          error={isDateToInvalid ? dateError : undefined}
          onChange={handleDateChange(DATE_TO_KEY)}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <label className="flex h-[45px] cursor-pointer items-center gap-2">
          <Checkbox
            checked={hideWorked}
            onCheckedChange={handleToggle(HIDE_WORKED_KEY)}
            aria-label={t('pages.reports.promisesFeed.hideWorked')}
          />
          <span className="text-foreground text-xs font-medium sm:text-sm">
            {t('pages.reports.promisesFeed.hideWorked')}
          </span>
        </label>
        <label className="flex h-[45px] cursor-pointer items-center gap-2">
          <Checkbox
            checked={hidePaid}
            onCheckedChange={handleToggle(HIDE_PAID_KEY)}
            aria-label={t('pages.reports.promisesFeed.hidePaid')}
          />
          <span className="text-foreground text-xs font-medium sm:text-sm">
            {t('pages.reports.promisesFeed.hidePaid')}
          </span>
        </label>

        {/* Pair-level only: the single-field errors live on their fields (see
            above). Neither bound is wrong on its own in an inverted or
            oversized window, so this one has no field to sit on. */}
        {rangeError && (
          <p className="text-error-500 w-full text-xs font-medium" role="alert">
            {rangeError}
          </p>
        )}
      </div>

      {/* Content: an invalid filter shows only the hints above */}
      {hasFilterError ? null : query.isLoading ? (
        // The skeleton mirrors the real table's width — the count comes from
        // PromisesFeedTable so the two cannot drift apart.
        <TableSkeleton columns={PROMISES_FEED_COLUMN_COUNT} rows={6} />
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
              {t('pages.reports.promisesFeed.error.retry')}
            </Button>
          )}
        </div>
      ) : (
        <div className="relative w-full" aria-busy={isRefreshing || undefined}>
          {/* An empty answer is a normal 200: a weekend window can hold no
              promises, and both toggles on can legitimately drain a day —
              hence a calm message, not an error state. */}
          <PromisesFeedTable
            rows={rows}
            timezone={userTimezone}
            emptyMessage={t('pages.reports.promisesFeed.empty')}
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
          {isRefreshing && (
            <div
              data-testid="promises-feed-refreshing"
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
