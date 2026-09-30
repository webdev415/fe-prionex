/**
 * RecordedPaymentsTab Component
 *
 * «Внесені платежі» tab for the Reports page (migrated Metabase Card 76): the
 * list of payments whose BANK confirmation date falls inside the window — one
 * row per PAYMENT — with the whole-selection summary and a per-operator
 * breakdown on the client's RESPONSIBLE employee (key B). The first report
 * tab served by the PAYMENT service (`/api/v1/payments/reports/feeds/…`); the
 * shell it stands on is the same as every sibling's: `useUrlPagedFeedFilters`
 * (URL state, composed updates, paging), `useDateWindowFilters` (both bounds
 * and their complaints), `useTodayInTimezone` ("today" in the profile zone)
 * and `useFeedErrorMessage` (the failure ladder). What is left here is this
 * tab's own knowledge: which keys, what the default window is, one switch,
 * one operator filter, and the two blocks above the table.
 *
 * All filter state and the current page live in the URL (`?rpf=`, `?rpt=`,
 * `?rpu=`, `?rpv=`, `?rppg=`, `?rpps=`) so they survive refresh, bookmarking
 * and switching between the page tabs (panels unmount on switch). Filter
 * updates use `replace` — only page-tab changes create history entries. The
 * keys are this tab's set in the page-wide registry
 * (`src/lib/reportsUrlKeys.ts`), deliberately NEW so no sibling tab's filter is
 * silently transplanted into this one.
 *
 * ── THE DEFAULT WINDOW IS THE CURRENT MONTH TO DATE ────────────────────────
 * `[the 1st .. today]` in the PROFILE timezone — the backend's own no-dates
 * default. (The source system's popup loads the same month up to YESTERDAY;
 * the one-day difference is deliberate, see `../lib/currentMonthWindow`.)
 * Not today–today, not the previous working day: a default copied from a
 * neighbouring tab would silently show a day instead of a month, and the page
 * would look perfectly fine. The rule lives in `../lib/currentMonthWindow`
 * with a suite of its own. Like every sibling, the derived default is NOT
 * written into the URL — an auto-derived value in a shared link would pin the
 * window to the day the link was made.
 *
 * The dates are BOTH-OR-NEITHER on the wire and there is NO all-history mode:
 * for "neither" the server applies its own default (the same month-to-date
 * rule as above). This tab never leans on that: every request it sends
 * carries both dates, so the window applied is always the one it asked for.
 * An absent bound simply means the derived default, an unusable one blocks
 * the request on its field, and the query hook refuses to fire with one
 * bound OR none no matter what (its own gate, pinned in its suite) — so
 * unlike the drains tab there is no mode flag and no half-window UI state.
 *
 * ── THE OPERATOR AXIS IS KEY B, MATCHED BY ID ──────────────────────────────
 * `rpu` (→ `user_ids`) filters by the client's RESPONSIBLE employee, as the
 * source system's popup does — never by name, which is the one deliberate
 * difference from it (the directory holds nine groups of duplicate full
 * names). The breakdown block is grouped on the same key, so the filter and
 * the block agree by construction. The row's «Відповідальний за платіж» is a
 * DIFFERENT key (key A, folded by id in the table) and is what links to the
 * operator-promises tab; the two keys disagree on 43 % of a month's rows and
 * that is inherited from the source system, documented, not reconciled.
 *
 * THE OPTION LIST OF THE OPERATOR MULTI-SELECT IS THE BREAKDOWN, not a users
 * directory: it costs no extra request, and it is exactly the operators who
 * HAVE payments in the window — the directory's ~1 400 users would be 93 %
 * noise for a filter whose point is drilling into this month's collections.
 * The cost of that choice is that a FILTERED response carries only the
 * filtered operators' lines, so the OPTION LIST is read from the last
 * UNFILTERED answer for the same window and switch — which React Query's
 * cache still holds (the click that applied the filter came from it), found
 * by the response's own echo fields rather than by rebuilding a query key:
 * arriving by the breakdown's own click keeps the full list, arriving by a
 * shared link with `rpu` set shows the selected operators until the filter
 * is cleared. An id selected but absent from the list (a link, or an
 * operator without payments after a window change) stays selectable under
 * its bare id so it can be unticked. ONLY the options come from the cache:
 * the breakdown BLOCK renders the current answer, filtered lines and all, so
 * its numbers and the summary above them are always one response.
 *
 * ── «ТІЛЬКИ ПІДТВЕРДЖЕНІ» IS OFF BY DEFAULT ────────────────────────────────
 * `rpv` (→ `verified_only`) is a SERVER-side filter: the feed paginates, so
 * hiding client-side would tear holes in pages, and it changes `total`, the
 * summary and the breakdown. Off means ALL statuses — `cancelled` payments
 * listed as recorded, which is what the card returns and what the source
 * system's popup shows with its toggle off (owner's decision Q2). The off
 * state is the ABSENCE of the key, so a shared link carries only choices
 * somebody made.
 */

import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  CheckboxMultiSelect,
  type CheckboxMultiSelectOption,
} from '@/components/ui/CheckboxMultiSelect'
import { DateSelect } from '@/components/ui/DateSelect'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import {
  useDateWindowFilters,
  useFeedErrorMessage,
  usePagedFeedPages,
  useTodayInTimezone,
  useUrlPagedFeedFilters,
} from '@/hooks'
import { Icons } from '@/lib/icons'
import { formatMoneyAmount, formatNumber } from '@/lib/localeFormat'
import { isWindowTooLong } from '@/lib/reportWindow'
import { REPORTS_URL_KEYS } from '@/lib/reportsUrlKeys'
import { useAuthStore } from '@/stores/authStore'
import { recordedPaymentsFeedKeys, useRecordedPaymentsFeed } from '../hooks'
import { currentMonthToDateWindow } from '../lib/currentMonthWindow'
import {
  MAX_OPERATOR_IDS,
  formatOperatorIdsParam,
  readOperatorIdsParam,
} from '../lib/operatorIdsParam'
import type { RecordedPaymentsFeedResponse } from '../types'
import { OperatorBreakdown } from './OperatorBreakdown'
import { RECORDED_PAYMENTS_COLUMN_COUNT, RecordedPaymentsTable } from './RecordedPaymentsTable'

/** This tab's slice of the Reports page URL namespace (see the registry). */
const {
  dateFrom: DATE_FROM_KEY,
  dateTo: DATE_TO_KEY,
  operators: OPERATORS_KEY,
  verifiedOnly: VERIFIED_ONLY_KEY,
  page: PAGE_KEY,
  pageSize: PAGE_SIZE_KEY,
} = REPORTS_URL_KEYS.recordedPayments

/**
 * The keys this tab may write as FILTERS — handed to the shell so a misspelled
 * key is a compile error rather than a value written under a name nothing
 * reads (or, worse, one a sibling tab owns). The paging keys are the shell's
 * own and are configured, not passed per call.
 */
type FilterKey =
  | typeof DATE_FROM_KEY
  | typeof DATE_TO_KEY
  | typeof OPERATORS_KEY
  | typeof VERIFIED_ONLY_KEY

/** This tab's wording for the two window complaints (see `useDateWindowFilters`). */
const WINDOW_ERROR_KEYS = {
  invalidDate: 'pages.reports.recordedPayments.invalidDate',
  invertedRange: 'pages.reports.recordedPayments.invalidRange',
} as const

/**
 * The backend's 366-day DIFFERENCE cap, mirrored — predicate and sentence
 * together. This endpoint DOES cap (`DATE_RANGE_TOO_LONG`, the same shared
 * 366-day rule as the client-service feeds), with no uncapped mode.
 */
const WINDOW_CAP = {
  isTooLong: isWindowTooLong,
  messageKey: 'pages.reports.recordedPayments.rangeTooLong',
} as const

export function RecordedPaymentsTab() {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language

  // Same project resolution as the Reports dashboard: active project first,
  // then the first assigned project, then 1.
  const user = useAuthStore((state) => state.user)
  const projectId: number = Number(user?.active_project_id ?? user?.projects?.[0]?.id ?? 1)
  const userTimezone = user?.timezone

  // The PROFILE timezone decides which MONTH it is (the default window) and
  // travels to the backend, which resolves its own default in the same zone;
  // near midnight on the 1st the browser and the operator can be in different
  // months. The hook owns when the day is re-resolved (mount, focus).
  const today = useTodayInTimezone(userTimezone)

  // The current month to date. Memoized on the day so the two strings keep
  // their identity between renders of the same day (they feed the window hook
  // and, through it, the query key).
  const defaultWindow = useMemo(() => currentMonthToDateWindow(today), [today])

  // The shared paged-feed URL shell. Defaults match the backend's own
  // `limit=50`; every offered page size is under this endpoint's `limit <= 200`.
  const filters = useUrlPagedFeedFilters<FilterKey>({
    pageKey: PAGE_KEY,
    pageSizeKey: PAGE_SIZE_KEY,
  })
  const { searchParams, pageSize } = filters

  // The shared window reader. An ABSENT key is the default (the month to
  // date); only an explicitly bad one stays undefined and blocks the request.
  const { dateFrom, dateTo, isFromInvalid, isToInvalid, dateError, rangeError, hasWindowError } =
    useDateWindowFilters({
      searchParams,
      fromKey: DATE_FROM_KEY,
      toKey: DATE_TO_KEY,
      fallbackFrom: defaultWindow?.dateFrom,
      fallbackTo: defaultWindow?.dateTo,
      cap: WINDOW_CAP,
      keys: WINDOW_ERROR_KEYS,
    })

  // The verified switch: present-as-"1" is on, absent is the backend default
  // (off — all statuses).
  const verifiedOnly = searchParams.get(VERIFIED_ONLY_KEY) === '1'

  // The operator filter, read strictly: a list the backend would refuse is
  // refused HERE with a sentence and no request (see `operatorIdsParam`).
  const operatorReading = readOperatorIdsParam(searchParams.get(OPERATORS_KEY))
  const operatorIds = operatorReading.ids
  const operatorError =
    operatorReading.error === 'tooMany'
      ? t('pages.reports.recordedPayments.operatorsTooMany', { max: MAX_OPERATOR_IDS })
      : operatorReading.error === 'invalid'
        ? t('pages.reports.recordedPayments.operatorsInvalid')
        : undefined

  // A toggle or a selection is a FILTER — setFilterParam resets the page in
  // the same URL update, or the user lands on an offset the filtered feed may
  // not even have.
  const handleVerifiedToggle = (checked: boolean | 'indeterminate') =>
    filters.setFilterParam(VERIFIED_ONLY_KEY, checked === true ? '1' : null)
  const setOperatorIds = (ids: number[]) =>
    filters.setFilterParam(OPERATORS_KEY, formatOperatorIdsParam(ids))

  // Everything that can be wrong before a request: the window (shared rules)
  // and the operator list (this tab's own); the switch cannot be wrong.
  const hasFilterError = hasWindowError || operatorReading.error !== null

  const query = useRecordedPaymentsFeed({
    projectId,
    dateFrom,
    dateTo,
    userIds: operatorIds,
    verifiedOnly,
    skip: filters.skip,
    limit: pageSize,
    timezone: userTimezone,
    enabled: !hasFilterError,
  })

  // Stable identity for the empty fallback — a fresh `[]` every render would
  // defeat RecordedPaymentsTable's useMemo over its rows prop.
  const rows = useMemo(() => query.data?.rows ?? [], [query.data])

  // The multi-select's OPTION LIST survives a filtered answer: the last
  // UNFILTERED answer for the same window and switch is read back out of
  // React Query's cache (see the docblock) — matched on the response's own
  // echo fields, so no query key has to be rebuilt here and a different page
  // of the same window qualifies (the breakdown is the whole selection's,
  // not the page's). Every field of the match is load-bearing: without the
  // window, a filtered view after a window change would offer last window's
  // operators; without the switch, «Тільки підтверджені» would offer the
  // operators who have nothing verified. No state and no effect: the cache
  // IS the memory, and it forgets on its own schedule (gcTime). Recomputed
  // when the answer changes, which is also when the cache may have gained
  // the entry.
  const queryClient = useQueryClient()
  const unfilteredAnswer = useMemo(() => {
    if (!query.data) return null
    for (const [, cached] of queryClient.getQueriesData<RecordedPaymentsFeedResponse>({
      queryKey: recordedPaymentsFeedKeys.all,
    })) {
      if (
        cached &&
        cached.project_id === projectId &&
        cached.user_ids.length === 0 &&
        !cached.breakdown_capped &&
        cached.date_from === dateFrom &&
        cached.date_to === dateTo &&
        cached.verified_only === verifiedOnly
      ) {
        return cached
      }
    }
    return null
  }, [query.data, queryClient, projectId, dateFrom, dateTo, verifiedOnly])
  const optionLines = useMemo(
    () => (unfilteredAnswer ?? query.data)?.operator_breakdown ?? [],
    [unfilteredAnswer, query.data]
  )

  // The breakdown BLOCK is the CURRENT answer — the one the summary above it
  // prints — never the cached one: a cached answer can be up to gcTime old,
  // and "Платежів: 11" over a line saying 10 for the same operator is the
  // invariant "the lines add up to the summary" visibly broken. Under a
  // filter the block therefore shows the filtered lines only; the whole
  // list lives in the multi-select.
  const breakdownLines = useMemo(() => query.data?.operator_breakdown ?? [], [query.data])
  const breakdownTruncated = query.data?.breakdown_truncated ?? false
  const breakdownCapped = query.data?.breakdown_capped ?? false

  const operatorOptions: CheckboxMultiSelectOption<number>[] = useMemo(() => {
    const options: CheckboxMultiSelectOption<number>[] = []
    const seen = new Set<number>()
    for (const line of optionLines) {
      // The null line (unresolved clients) has no id to filter on.
      if (line.user_id == null) continue
      seen.add(line.user_id)
      const name = line.full_name?.trim() ? line.full_name : String(line.user_id)
      options.push({
        value: line.user_id,
        label: line.is_service
          ? `${name} · ${t('pages.reports.recordedPayments.serviceBadge')}`
          : name,
      })
    }
    // A selected id the list does not know stays selectable under its bare
    // id — otherwise it could never be unticked.
    for (const id of operatorIds) {
      if (!seen.has(id)) options.push({ value: id, label: String(id) })
    }
    return options
  }, [optionLines, operatorIds, t])

  // Totals, the display clamp for a bookmarked page the feed no longer has,
  // and the URL self-heal that follows the answer — shared shell.
  const { total, totalPages, clampedPage } = usePagedFeedPages(filters, query.data)

  // keepPreviousData shows the previous page's rows while a new one loads —
  // they must not look final, hence the busy overlay.
  const isRefreshing = query.isPlaceholderData

  // The shared failure ladder (see the hook for the rungs and their order).
  // What is this endpoint's own: its coded 400s — the three window codes the
  // family shares and three of its own (`USER_IDS_TOO_MANY`,
  // `USER_IDS_OUT_OF_RANGE`, `BREAKDOWN_WINDOW_TOO_WIDE`, all translated in
  // `errors.json` with their params by `getErrorMessage`) — and its 503s,
  // whose details name WHICH dependency failed (the client directory, the
  // employee directory, the debt directory, a statement timeout, a saturated
  // feed slot). `errorDetail` IS RENDERED for that reason, as on the drains
  // tab: "the employee directory is down" and "narrow the window" route a
  // support question by themselves.
  const { errorMessage, errorDetail, isForbidden } = useFeedErrorMessage(
    query.error,
    'recordedPayments'
  )

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Filters: the confirmation-date window (default = the month to date),
          the operator multi-select and the verified switch.

          NEITHER picker is bounded by the other (no `min`/`max`), on purpose —
          the page-wide rule for every date pair WITH A DEFAULTED WINDOW (the
          reasoning is written out in full in SearcherFollowupFeedTab). The
          pair-level guard is what actually protects the API. */}
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl p-4 shadow-sm sm:gap-4">
        <DateSelect
          label={t('pages.reports.recordedPayments.dateFrom')}
          // Empty for an unusable URL value — never the default silently
          // standing in for a bad value.
          value={dateFrom ?? null}
          error={isFromInvalid ? dateError : undefined}
          onChange={filters.dateFilterHandler(DATE_FROM_KEY)}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <DateSelect
          label={t('pages.reports.recordedPayments.dateTo')}
          value={dateTo ?? null}
          error={isToInvalid ? dateError : undefined}
          onChange={filters.dateFilterHandler(DATE_TO_KEY)}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <div className="flex w-full min-w-0 flex-col gap-1 sm:w-72">
          <span className="text-foreground text-xs font-medium">
            {t('pages.reports.recordedPayments.operators')}
          </span>
          <CheckboxMultiSelect<number>
            options={operatorOptions}
            selected={operatorIds}
            onChange={setOperatorIds}
            allLabel={t('pages.reports.recordedPayments.allOperators')}
            ariaLabel={t('pages.reports.recordedPayments.operators')}
            // The options are employees' names. The component marks its own
            // summary text and its option list for OpenReplay: the list is a
            // Radix portal under `document.body`, which a mark on this
            // wrapper would never reach (KAN-KB-54).
            obscured
            // The backend refuses the filter on a capped window; offering it
            // would only produce that 400.
            disabled={breakdownCapped && operatorIds.length === 0}
            testId="recorded-payments-operators"
          />
        </div>
        <label className="flex h-[45px] cursor-pointer items-center gap-2">
          <Checkbox
            checked={verifiedOnly}
            onCheckedChange={handleVerifiedToggle}
            aria-label={t('pages.reports.recordedPayments.verifiedOnly')}
          />
          <span className="text-foreground text-xs font-medium sm:text-sm">
            {t('pages.reports.recordedPayments.verifiedOnly')}
          </span>
        </label>

        {/* Pair-level only: the single-field errors live on their fields.
            Neither bound is wrong on its own in an inverted or oversized
            window, so this one has no field to sit on. */}
        {rangeError && (
          <p className="text-error-500 w-full text-xs font-medium" role="alert">
            {rangeError}
          </p>
        )}
        {operatorError && (
          <p className="text-error-500 w-full text-xs font-medium" role="alert">
            {operatorError}
          </p>
        )}
      </div>

      {/* Content: an invalid filter shows only the hints above */}
      {hasFilterError ? null : query.isLoading ? (
        // The skeleton mirrors the real table's width — the count comes from
        // RecordedPaymentsTable so the two cannot drift apart.
        <TableSkeleton columns={RECORDED_PAYMENTS_COLUMN_COUNT} rows={6} />
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
              {t('pages.reports.recordedPayments.error.retry')}
            </Button>
          )}
        </div>
      ) : query.data ? (
        <div className="relative flex w-full flex-col gap-4" aria-busy={isRefreshing || undefined}>
          {/* The whole-selection summary — the same numbers the source
              system's popup prints in its footer, for the same filter. */}
          <p
            className="text-foreground text-sm font-medium"
            data-testid="recorded-payments-summary"
          >
            {t('pages.reports.recordedPayments.summary', {
              count: formatNumber(query.data.summary.rows_count, language),
              amount: formatMoneyAmount(query.data.summary.total_amount, language),
            })}
          </p>
          <OperatorBreakdown
            lines={breakdownLines}
            capped={breakdownCapped}
            truncated={breakdownTruncated}
            // The window as APPLIED, from the echo: what the operator link
            // carries over.
            dateFrom={query.data.date_from}
            dateTo={query.data.date_to}
            selectedUserIds={operatorIds}
            onSelectOperator={(userId) => setOperatorIds([userId])}
            onClearOperators={() => setOperatorIds([])}
          />
          {/* An empty answer is a normal 200: a filtered operator may have no
              payments in the window, and the month is empty on its 1st. */}
          <RecordedPaymentsTable
            rows={rows}
            dateFrom={query.data.date_from}
            dateTo={query.data.date_to}
            timezone={userTimezone}
            emptyMessage={t('pages.reports.recordedPayments.empty')}
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
              data-testid="recorded-payments-refreshing"
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
