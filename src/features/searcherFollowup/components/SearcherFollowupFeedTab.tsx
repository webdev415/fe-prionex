/**
 * SearcherFollowupFeedTab Component
 *
 * «Серчер без відпрацювання» feed tab for the Reports page: a WORK LIST of
 * clients whose latest meaningful interaction is a searcher chain step that
 * ended with «Інформація знайдена» — the searcher located the client's data
 * and no operator has acted on the find yet. One row = one client; the client
 * leaves the list the moment anyone records an interaction after the find.
 *
 * All filter state and the current page live in the URL (`?if=`, `?it=`,
 * `?spg=`, `?sps=`) so they survive refresh, bookmarking and switching
 * between the page tabs (panels unmount on switch). Filter updates use
 * `replace` — only page-tab changes create history entries. The URL shell —
 * composed updates, page/page-size parsing, the page clamp and its self-heal —
 * is the shared `useUrlPagedFeedFilters`; the keys are this tab's set in the
 * page-wide registry (`src/lib/reportsUrlKeys.ts`), deliberately NEW so no
 * sibling tab's filter is silently transplanted into this one.
 *
 * Unlike the sibling feed's optional independent bounds, this window is ONE
 * date pair: the backend accepts both bounds or neither (the card's single
 * Metabase `[[…]]` block; half a window answers 400), and the tab always
 * sends both — the DEFAULT is today–today in the profile timezone
 * (Techno-Finance parity: its Card 123 usage defaults to today), held in
 * state seeded at mount and re-resolved on window focus (an overnight tab
 * rolls to the new day when the operator returns to it), and deliberately
 * NOT written into the URL (an auto-derived value in a shared link would pin
 * "today" to the day the link was made). No 366-day cap to mirror: the
 * backend caps nothing here because the window cannot widen the query's cost.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { usePagedFeedPages, useTodayInTimezone, useUrlPagedFeedFilters } from '@/hooks'
import { isTransientFailure } from '@/lib/api'
import { getErrorMessage, getErrorStatus, hasResponseDetail } from '@/lib/errors'
import { Icons } from '@/lib/icons'
import { REPORTS_URL_KEYS } from '@/lib/reportsUrlKeys'
import { readUrlDateBound } from '@/lib/urlDateBound'
import { useAuthStore } from '@/stores/authStore'
import { useSearcherFollowupFeed } from '../hooks'
import { SEARCHER_FOLLOWUP_COLUMN_COUNT, SearcherFollowupTable } from './SearcherFollowupTable'

/** This tab's slice of the Reports page URL namespace (see the registry). */
const {
  dateFrom: DATE_FROM_KEY,
  dateTo: DATE_TO_KEY,
  page: PAGE_KEY,
  pageSize: PAGE_SIZE_KEY,
} = REPORTS_URL_KEYS.searcherFollowup

/**
 * The keys this tab may write as FILTERS — handed to the shell so a misspelled
 * key is a compile error rather than a value written under a name nothing
 * reads (or, worse, one a sibling tab owns). The paging keys are the shell's
 * own and are configured, not passed per call.
 */
type FilterKey = typeof DATE_FROM_KEY | typeof DATE_TO_KEY

export function SearcherFollowupFeedTab() {
  const { t } = useTranslation('common')

  // Same project resolution as the Reports dashboard: active project first,
  // then the first assigned project, then 1.
  const user = useAuthStore((state) => state.user)
  const projectId: number = Number(user?.active_project_id ?? user?.projects?.[0]?.id ?? 1)
  const userTimezone = user?.timezone

  // The default window: "today" resolved in the PROFILE timezone — "now" is a
  // real moment, and near midnight the browser's day and the operator's day
  // differ. The same timezone travels to the backend, which cuts the window's
  // calendar days in it, so the two ends of the request agree on what "today"
  // means.
  //
  // Held in STATE, not read off the wall clock in render (the host page keeps
  // comparable clock reads inside effects too): seeded once at mount and
  // re-resolved on window focus, so a tab left open across midnight picks up
  // the new day the moment the operator comes back to it instead of keeping
  // yesterday's window until an unrelated re-render. The functional update
  // returns the previous value while the day is unchanged, so a same-day
  // focus re-renders nothing. `today` only backs the DEFAULT window below —
  // user-picked URL bounds never move when the day rolls over.
  const today = useTodayInTimezone(userTimezone)

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

  // An ABSENT bound means "today", not "no bound": the pair is mandatory
  // (both dates always go to the API), so the default fills in per bound.
  const dateStart = dateFromBound.value ?? today
  const dateEnd = dateToBound.value ?? today

  // There is no "×" on these fields on purpose — the pair is mandatory
  // (clearing a bound cannot mean "no bound" when the backend rejects half a
  // window), and the way back to the default is simply picking today.
  const handleDateChange = (key: FilterKey) => filters.dateFilterHandler(key)

  // The only guard against an inverted window: the pickers deliberately do not
  // bound each other (see the fields below), and manual input and hand-edited
  // URLs would bypass such bounds anyway. ISO YYYY-MM-DD strings compare
  // correctly as strings. Both bounds always exist here (default today), so the
  // pair check is unconditional once both are usable.
  const isRangeInverted = !hasInvalidDate && dateStart > dateEnd

  // Where a message is rendered follows WHAT it is about: a bad date belongs
  // to ONE field, so it rides that field's `error` prop (red border,
  // aria-invalid, aria-describedby on the offending input); an inverted
  // window belongs to the PAIR — neither bound is wrong on its own — so it
  // stays a standalone alert under the filters. Same split as the sibling
  // feed tab.
  const dateError = hasInvalidDate ? t('pages.reports.searcherFollowup.invalidDate') : undefined
  const rangeError = isRangeInverted ? t('pages.reports.searcherFollowup.invalidRange') : undefined

  const hasFilterError = hasInvalidDate || isRangeInverted

  const query = useSearcherFollowupFeed({
    projectId,
    dateStart,
    dateEnd,
    skip: filters.skip,
    limit: pageSize,
    timezone: userTimezone,
    enabled: !hasFilterError,
  })

  // Stable identity for the empty fallback — a fresh `[]` every render would
  // defeat SearcherFollowupTable's useMemo over its rows prop.
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
    ? // Covers all FOUR of the endpoint's own 503s — the auth-service directory
      // being down, the call-service being down, the call-service throttling
      // past one retry, and the two lookups together blowing the fan-out
      // deadline. The operator's move is the same in all four (wait and retry),
      // and none may degrade to a partial feed: a silently missing "last call"
      // would read as "never called" and send an operator to re-dial somebody
      // who was called an hour ago.
      t('pages.reports.searcherFollowup.unavailable')
    : isForbidden
      ? t('pages.reports.searcherFollowup.forbidden')
      : // Backend date/timezone validation answers 400 with a human-readable
        // detail — and so does the candidate cap, whose detail names the count,
        // the maximum and the remedy ("ask for a narrower window"). Passing it
        // through verbatim is what makes that refusal actionable; a generic
        // message would leave the operator with no idea which knob to turn.
        // Only when the answer HAS a detail, though: a 400 whose body never
        // arrived would otherwise show axios' own untranslated "Request failed
        // with status code 400" (see hasResponseDetail), so it joins every
        // other unexplained failure under the localized generic title.
        errorStatus === 400 && hasResponseDetail(query.error)
        ? getErrorMessage(query.error)
        : t('pages.reports.searcherFollowup.error.title')

  // The four 503s are worded distinctly by the backend on purpose — the
  // remedies differ and monitoring must tell an outage from a timeout from
  // throttling — so the server's own sentence is shown UNDER the localized one
  // rather than instead of it: the operator reads their language, and whoever
  // is asked "what does it say?" can tell which dependency failed. Absent for a
  // transport-level failure (a 502/504 or a dropped connection carries no body).
  const errorDetail =
    isUnavailable && hasResponseDetail(query.error) ? getErrorMessage(query.error) : null

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Filters: the mandatory find-day window, defaulting to today–today.

          NEITHER picker is bounded by the other (no `min`/`max`), on purpose —
          the shared rule of the tabs with a DEFAULTED window (this one,
          processing, operator-promises; the two feeds with empty optional
          bounds keep their mutual bounds — no default, no order trap). A mutual bound imposes an ORDER nothing on screen states: with
          the today–today default, «з» opens on days up to today and «по» on
          days from today, so a window entirely in the PAST can only be reached
          by moving «з» first — reach for «по» first and every day before today
          is greyed out, with nothing saying why or which field to touch
          instead. (DateSelect adds no bounds of its own: `minDate`/`maxDate`
          reach react-datepicker only from these props, so dropping them leaves
          both calendars fully open.)

          What actually protects the API is the pair guard below
          (`isRangeInverted` → the alert, no request), which is needed
          regardless: manual input and hand-edited URLs bypass picker bounds
          anyway. So an inverted window can be PICKED, and it is answered in
          words — "Дата знахідки «з» пізніша за дату «по»" — instead of by a
          calendar the user cannot get past. */}
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl p-4 shadow-sm sm:gap-4">
        <DateSelect
          label={t('pages.reports.searcherFollowup.dateFrom')}
          // An unusable URL value shows an empty field with the error on it,
          // never the default silently standing in for the bad value.
          value={isDateFromInvalid ? null : dateStart}
          // Only the bound that actually carries the unusable value is marked.
          error={isDateFromInvalid ? dateError : undefined}
          onChange={handleDateChange(DATE_FROM_KEY)}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <DateSelect
          label={t('pages.reports.searcherFollowup.dateTo')}
          value={isDateToInvalid ? null : dateEnd}
          error={isDateToInvalid ? dateError : undefined}
          onChange={handleDateChange(DATE_TO_KEY)}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />

        {/* Pair-level only: the single-field errors live on their fields (see
            above). This one has no single field to sit on. */}
        {rangeError && (
          <p className="text-error-500 w-full text-xs font-medium" role="alert">
            {rangeError}
          </p>
        )}
      </div>

      {/* Content: an invalid filter shows only the hints above */}
      {hasFilterError ? null : query.isLoading ? (
        // The skeleton mirrors the real table's width — the count comes from
        // SearcherFollowupTable so the two cannot drift apart.
        <TableSkeleton columns={SEARCHER_FOLLOWUP_COLUMN_COUNT} rows={6} />
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
              {t('pages.reports.searcherFollowup.error.retry')}
            </Button>
          )}
        </div>
      ) : (
        <div className="relative w-full" aria-busy={isRefreshing || undefined}>
          {/* An empty answer is a normal 200: most days have finds, but a
              weekend window can legitimately hold none — hence a calm message,
              not an error state. */}
          <SearcherFollowupTable
            rows={rows}
            timezone={userTimezone}
            emptyMessage={t('pages.reports.searcherFollowup.empty')}
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
              data-testid="searcher-followup-refreshing"
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
