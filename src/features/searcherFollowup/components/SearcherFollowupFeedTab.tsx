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
 * `replace` — only page-tab changes create history entries.
 *
 * The URL keys are deliberately NEW: the host page keeps every tab's params
 * in the URL, so this tab must not collide with `?tab` (host),
 * `?from/?to/?dept` (processing), `?sf/?st/?cf/?ct` (verification) or
 * `?pf/?pt/?mv/?pg/?ps` (low-verification feed) — in particular the sibling
 * feed owns `pg`/`ps`, which is why paging here is `spg`/`sps`. A shared key
 * would silently transplant one tab's filter into the other.
 *
 * Unlike the sibling feed's optional independent bounds, this window is ONE
 * date pair: the backend accepts both bounds or neither (the card's single
 * Metabase `[[…]]` block; half a window answers 400), and the tab always
 * sends both — the DEFAULT is today–today in the profile timezone
 * (Techno-Finance parity: its Card 123 usage defaults to today), computed
 * fresh each render and deliberately NOT written into the URL (an
 * auto-derived value in a shared link would pin "today" to the day the link
 * was made). No 366-day cap to mirror: the backend caps nothing here because
 * the window cannot widen the query's cost.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { isTransientFailure } from '@/lib/api'
import { isRealCalendarDate } from '@/lib/calendarDate'
import { formatPickerDateAsYMD, getDateStringInTimezone } from '@/lib/dateUtils'
import { getErrorMessage, getErrorStatus } from '@/lib/errors'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import { useSearcherFollowupFeed } from '../hooks'
import { SEARCHER_FOLLOWUP_COLUMN_COUNT, SearcherFollowupTable } from './SearcherFollowupTable'

/**
 * URL keys, distinct from every other tab of the host page — processing
 * (`from/to/dept`), verification (`sf/st/cf/ct`), the low-verification feed
 * (`pf/pt/mv/pg/ps`) and the host's own `tab`. "if"/"it" = Interaction
 * From/To; "spg"/"sps" = Searcher PaGe / Page Size.
 */
const DATE_FROM_KEY = 'if'
const DATE_TO_KEY = 'it'
const PAGE_KEY = 'spg'
const PAGE_SIZE_KEY = 'sps'

type FilterKey = typeof DATE_FROM_KEY | typeof DATE_TO_KEY

/**
 * Rows per page. The default matches the backend's own (`limit=50`) and every
 * option stays well inside its `limit <= 500` cap; the list is the shared
 * Pagination component's default set.
 */
const DEFAULT_PAGE_SIZE = 50
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

/**
 * Highest page the URL may ask for. The backend caps `skip` at the int32
 * ceiling (`le=2_147_483_647`) and we send `skip = (page - 1) * limit`, so the
 * bound is computed against the LARGEST selectable page size: a page accepted
 * here stays inside the cap for every `?sps=` the user can switch to afterwards.
 */
const MAX_SKIP = 2_147_483_647
const MAX_PAGE = Math.floor(MAX_SKIP / Math.max(...PAGE_SIZE_OPTIONS)) + 1

/** A positive integer read from the URL (optionally capped), or the fallback. */
function parsePositiveInt(
  raw: string | null,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER
): number {
  if (!raw || !/^\d+$/.test(raw)) return fallback
  const parsed = Number(raw)
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : fallback
}

export function SearcherFollowupFeedTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()

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
  const today = getDateStringInTimezone(new Date(), userTimezone)

  const rawDateFrom = searchParams.get(DATE_FROM_KEY)
  const rawDateTo = searchParams.get(DATE_TO_KEY)

  // A present-but-unusable bound is NOT silently replaced by the default: the
  // URL would then disagree with both the field and the request. It goes down
  // the same path as an inverted range — inline hint, no request (below).
  // Tracked per bound so the hint can sit on the field holding the bad value.
  const isDateFromInvalid = !!rawDateFrom && !isRealCalendarDate(rawDateFrom)
  const isDateToInvalid = !!rawDateTo && !isRealCalendarDate(rawDateTo)
  const hasInvalidDate = isDateFromInvalid || isDateToInvalid

  // An ABSENT bound means "today", not "no bound": the pair is mandatory
  // (both dates always go to the API), so the default fills in per bound.
  const dateStart = rawDateFrom && !isDateFromInvalid ? rawDateFrom : today
  const dateEnd = rawDateTo && !isDateToInvalid ? rawDateTo : today

  const pageSizeFromUrl = parsePositiveInt(searchParams.get(PAGE_SIZE_KEY), DEFAULT_PAGE_SIZE)
  // An unknown page size falls back silently (it is a view preference, not a
  // filter) — but it must never exceed the backend's `limit <= 500`.
  const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeFromUrl) ? pageSizeFromUrl : DEFAULT_PAGE_SIZE
  // A page whose offset would overflow the backend's int32 `skip` cap falls
  // back to 1 silently, exactly like an unknown page size: it can only come
  // from a hand-edited URL, and the 422 it would earn is nothing the user
  // could act on. No request is ever fired with an out-of-range offset.
  const page = parsePositiveInt(searchParams.get(PAGE_KEY), 1, MAX_PAGE)

  // The base every update builds on. It cannot be react-router's own `prev`:
  // the functional form of `setSearchParams` hands back a clone of the
  // RENDER-SCOPED params, so two updates fired in the SAME tick each start
  // from the pre-update URL and the last navigation silently drops the first
  // one's key. The shared Pagination emits exactly that pair —
  // `onPageSizeChange` immediately followed by `onPageChange(1)`. Keeping the
  // composed value in a ref makes such a sequence land as one coherent URL,
  // while the effect below resyncs it from the committed URL, so an update
  // whose origin is elsewhere (Back/Forward, a shared link, the ?spg=
  // self-heal) is never built on a stale base either. The resync belongs in
  // an effect rather than in render — it only has to be back in step by the
  // next commit, and by then a same-tick burst is long over. (Precedent:
  // LowVerificationFeedTab, review standards on setSearchParams.)
  const paramsRef = useRef(searchParams)
  useEffect(() => {
    paramsRef.current = searchParams
  }, [searchParams])

  // Filter updates never create history entries (page-tab switches do).
  const setUrlParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(paramsRef.current)
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) next.delete(key)
        else next.set(key, value)
      }
      paramsRef.current = next
      setSearchParams(next, { replace: true })
    },
    [setSearchParams]
  )

  /** A changed filter invalidates the current offset — page 1 or the user reads a hole. */
  const setFilterParam = (key: FilterKey, value: string) =>
    setUrlParams({ [key]: value, [PAGE_KEY]: null })

  // Timezone policy: a PICKED date is already a calendar day — the picker
  // hands us a local-midnight Date whose local Y/M/D are exactly the cell the
  // user clicked, so we read them back verbatim with formatPickerDateAsYMD.
  // The profile timezone applies to the "today" DEFAULT above and travels to
  // the backend for the window's day cut.
  const handleDateChange =
    (key: FilterKey) =>
    ({ value }: { value: Date | null }) => {
      // A cleared manual input is not a filter change: the URL keeps the old
      // value and a valid date commits once the user finishes retyping
      // (DateSelect itself resyncs the abandoned text on blur). There is no
      // "×" here on purpose — the pair is mandatory (clearing a bound cannot
      // mean "no bound" when the backend rejects half a window), and the way
      // back to the default is simply picking today.
      if (value) setFilterParam(key, formatPickerDateAsYMD(value))
    }

  // Manual input can bypass the pickers' min/max, so an inverted window must
  // not reach the API. ISO YYYY-MM-DD strings compare correctly as strings.
  // Both bounds always exist here (default today), so the pair check is
  // unconditional once both are usable.
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
    skip: (page - 1) * pageSize,
    limit: pageSize,
    timezone: userTimezone,
    enabled: !hasFilterError,
  })

  // Stable identity for the empty fallback — a fresh `[]` every render would
  // defeat SearcherFollowupTable's useMemo over its rows prop.
  const rows = useMemo(() => query.data?.rows ?? [], [query.data])
  const total = query.data?.total ?? 0
  const totalPages = Math.max(1, query.data?.total_pages ?? 1)

  // The feed drains as operators work it, so a bookmarked `?spg=` can outlive
  // the rows it pointed at. What the pager shows is the page that actually
  // exists — "Page 5 of 2" over an empty table is not a state to render. A
  // drained feed (`total === 0`) keeps its calm empty state and shows no
  // pager at all, so there is nothing to clamp against.
  const clampedPage = total > 0 ? Math.min(page, totalPages) : page

  // ...and the URL follows the answer, so a refresh no longer re-requests the
  // dead offset. `replace` (via setUrlParams) — self-correction is not a
  // navigation step and must not stack history entries. Page 1 is the
  // default, hence the key is dropped rather than written.
  useEffect(() => {
    if (total > 0 && page > totalPages) {
      setUrlParams({ [PAGE_KEY]: totalPages <= 1 ? null : String(totalPages) })
    }
  }, [total, totalPages, page, setUrlParams])

  // keepPreviousData shows the previous page's rows while a new one loads —
  // they must not look final, hence the busy overlay. Placeholder only: a
  // background refetch of the SAME page shows current data and needs none.
  const isRefreshing = query.isPlaceholderData

  const errorStatus = getErrorStatus(query.error)
  const isForbidden = errorStatus === 403
  const errorMessage = isTransientFailure(query.error)
    ? // Covers the endpoint's own 503 too: it fails loud when EITHER the
      // auth-service directory or the call-service is down (never a partial
      // feed — a missing "last call" would read as "never called").
      t('pages.reports.searcherFollowup.unavailable')
    : isForbidden
      ? t('pages.reports.searcherFollowup.forbidden')
      : errorStatus === 400
        ? // Backend date/timezone validation answers 400 with a human-readable detail
          getErrorMessage(query.error)
        : t('pages.reports.searcherFollowup.error.title')

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Filters: the mandatory find-day window, defaulting to today–today */}
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl p-4 shadow-sm sm:gap-4">
        <DateSelect
          label={t('pages.reports.searcherFollowup.dateFrom')}
          // An unusable URL value shows an empty field with the error on it,
          // never the default silently standing in for the bad value.
          value={isDateFromInvalid ? null : dateStart}
          // Bounded by the other end only while that end is usable.
          max={isDateToInvalid ? undefined : dateEnd}
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
          min={isDateFromInvalid ? undefined : dateStart}
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
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageChange={(nextPage) =>
                // Page 1 is the default — keep it out of the URL.
                setUrlParams({ [PAGE_KEY]: nextPage <= 1 ? null : String(nextPage) })
              }
              onPageSizeChange={(nextSize) =>
                // A resized page invalidates the old offset, so the page goes
                // back to 1 in the SAME update — Pagination does emit its own
                // onPageChange(1) right after this, but a filter's worth of
                // URL state must not depend on a shared component's call
                // order. The default size is the absence of the key, never a
                // spelled-out `sps=50`.
                setUrlParams({
                  [PAGE_SIZE_KEY]: nextSize === DEFAULT_PAGE_SIZE ? null : String(nextSize),
                  [PAGE_KEY]: null,
                })
              }
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
