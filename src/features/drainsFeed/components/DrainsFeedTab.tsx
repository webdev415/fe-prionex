/**
 * DrainsFeedTab Component
 *
 * «Зливи» feed tab for the Reports page (migrated Metabase Card 120): the
 * BROKEN-PROMISE list — clients who promised to pay by a day inside the window
 * and did not. ONE ROW IS ONE CLIENT (the backend resolves each client's LAST
 * promise over the whole history), which makes `total` a count of clients and
 * makes historical windows SHRINK as clients promise again — a bookmarked past
 * window legitimately holds fewer rows every day.
 *
 * THE FIRST TAB BUILT ON THE SHARED SHELL FROM THE START, rather than
 * converted to it: `useUrlPagedFeedFilters` (URL state, composed updates,
 * paging), `useDateWindowFilters` (both bounds and their complaints),
 * `useTodayInTimezone` ("today" in the profile zone) and `useFeedErrorMessage`
 * (the failure ladder) are all called below, and what is left here is this
 * tab's own knowledge: which keys, what an absent bound means, three toggles,
 * and the one thing no sibling has — a window that can be switched OFF.
 *
 * All filter state and the current page live in the URL (`?drf=`, `?drt=`,
 * `?dra=`, `?drwt=`, `?drw=`, `?drp=`, `?drpg=`, `?drps=`) so they survive
 * refresh, bookmarking and switching between the page tabs (panels unmount on
 * switch). Filter updates use `replace` — only page-tab changes create history
 * entries. The keys are this tab's set in the page-wide registry
 * (`src/lib/reportsUrlKeys.ts`), deliberately NEW so no sibling tab's filter is
 * silently transplanted into this one.
 *
 * ── THE DEFAULT WINDOW IS NOT "TODAY" ──────────────────────────────────────
 * It is the PREVIOUS WORKING DAY, and "today" is never in it: on a Monday the
 * window is the three days Friday–Sunday so weekend work is not lost, on every
 * other day it is yesterday–yesterday. The rule is the source system's and the
 * client-service port carries it as a tested function too; ours lives in
 * `../lib/previousWorkingDayWindow` with a suite over all seven weekdays,
 * because `fallbackFrom: today` copied from a neighbouring tab is both the
 * likeliest mistake and an invisible one — the page renders perfectly and
 * silently shows a different report. Like every sibling, the derived default
 * is NOT written into the URL: an auto-derived value in a shared link would
 * pin the window to the day the link was made.
 *
 * ── THE ALL-HISTORY MODE, AND WHY IT NEEDS A FLAG OF ITS OWN ───────────────
 * The endpoint's dates are BOTH-OR-NEITHER, and "neither" is a supported MODE
 * there: it returns the whole history (~11.3k rows), which is acceptance
 * criterion #27 and the card's own behaviour with its optional date parameters
 * left empty. No sibling tab has this, because every sibling's absent bound
 * means "the tab's default" — and one absence cannot carry both meanings.
 *
 * So the mode is a checkbox («Вся історія») that writes ONE flag, `?dra=1`, and
 * clears both date keys in the same URL update. The flag is what the window
 * hook reads: with it on, `fallbackFrom`/`fallbackTo` are `undefined` — the
 * documented "no bound" branch of `useDateWindowFilters` — so both bounds
 * resolve to undefined and the query hook sends no dates at all.
 *
 * Two alternatives were considered and rejected. (1) Three-state date keys —
 * absent / present-and-empty / a date, the contact-tag feed's `kt` shape —
 * would need a reader of its own for BOTH bounds and would encode one mode in
 * two places, where the two places can disagree (`?drf=&drt=2026-09-01` means
 * nothing). (2) Inferring the mode from "the user cleared both fields" is not
 * expressible at all: a cleared field is an absent key, which is exactly what
 * the default window already means. One flag, one meaning, one place.
 *
 * Because the flag and a date pair would contradict each other, PICKING A DATE
 * CLEARS THE FLAG in the same update (`handleDateChange` below). The UI can
 * therefore never reach a half-specified window; a hand-edited link still can
 * (`?dra=1&drf=2026-09-01`), and that is refused with a complaint on the bound
 * that is MISSING, not silently defaulted — sending one bound answers 400, and
 * quietly filling in the other would apply a window nobody asked for.
 *
 * The guard runs in the WINDOWED mode too, and not for symmetry: there, a
 * missing bound means the default-window rule refused the day it was given, so
 * both fallbacks are undefined — which is indistinguishable from the
 * all-history mode. Left unguarded, the tab would request the whole history
 * with the mode checkbox showing unchecked (see `isWindowMalformed`).
 *
 * ── THE THREE TOGGLES ARE THREE DIFFERENT QUESTIONS ────────────────────────
 * «Приховати відпрацьованих сьогодні» (`hide_worked_today`, reads the today
 * FLAG), «Приховати рядки, де ЦД дійшов до обіцяної дати» (`hide_worked`,
 * compares DATES) and «Приховати тих, хто вже платив» (`hide_paid`, reads the
 * MONEY) are SERVER-side filters: the feed is paginated, so hiding
 * client-side would tear holes in pages, and all three
 * change `total`. Toggling one is a filter change — it resets the page in the
 * same URL update and refetches. The off state is the ABSENCE of the key, so a
 * shared link carries only choices somebody made.
 *
 * ⚠️ `hide_worked` here is NOT the promises feed's predicate of the same name:
 * that one reads `last_result`, this one compares the promised day against
 * `last_interaction_date`. The source system resolved the same ambiguity in
 * its own spec with data, and the wrong predicate yields a report where almost
 * nothing is "worked". The right one hides ~90 % of a day's rows BY DESIGN,
 * which is why the labels below name each predicate rather than sharing a
 * leading phrase: all three open with «Приховати», so the SECOND word is what
 * has to carry the difference («відпрацьованих» / «рядки» / «тих»), and a
 * locale test pins exactly that — a reader who skims two words must still end
 * up on the right switch (review of #172). Techno-Finance words the first two
 * almost identically, which is why they read as one idea there.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
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
import { formatPickerDateAsYMD } from '@/lib/dateUtils'
import { Icons } from '@/lib/icons'
import { isWindowTooLong } from '@/lib/reportWindow'
import { REPORTS_URL_KEYS } from '@/lib/reportsUrlKeys'
import { useAuthStore } from '@/stores/authStore'
import { useDrainsFeed } from '../hooks'
import { previousWorkingDayWindow } from '../lib/previousWorkingDayWindow'
import { DRAINS_FEED_COLUMN_COUNT, DrainsFeedTable } from './DrainsFeedTable'

/** This tab's slice of the Reports page URL namespace (see the registry). */
const {
  dateFrom: DATE_FROM_KEY,
  dateTo: DATE_TO_KEY,
  allHistory: ALL_HISTORY_KEY,
  hideWorkedToday: HIDE_WORKED_TODAY_KEY,
  hideWorked: HIDE_WORKED_KEY,
  hidePaid: HIDE_PAID_KEY,
  page: PAGE_KEY,
  pageSize: PAGE_SIZE_KEY,
} = REPORTS_URL_KEYS.drainsFeed

/**
 * The keys this tab may write as FILTERS — handed to the shell so a misspelled
 * key is a compile error rather than a value written under a name nothing
 * reads (or, worse, one a sibling tab owns). The paging keys are the shell's
 * own and are configured, not passed per call.
 */
type FilterKey =
  | typeof DATE_FROM_KEY
  | typeof DATE_TO_KEY
  | typeof ALL_HISTORY_KEY
  | typeof HIDE_WORKED_TODAY_KEY
  | typeof HIDE_WORKED_KEY
  | typeof HIDE_PAID_KEY

/** This tab's wording for the two window complaints (see `useDateWindowFilters`). */
const WINDOW_ERROR_KEYS = {
  invalidDate: 'pages.reports.drainsFeed.invalidDate',
  invertedRange: 'pages.reports.drainsFeed.invalidRange',
} as const

/**
 * The backend's 366-day DIFFERENCE cap, mirrored — predicate and sentence
 * together. This endpoint DOES cap (`_MAX_RANGE_DAYS` in the router, the same
 * `> 366` test as its six capped siblings), and it caps only the windowed
 * mode: the all-history request is deliberately the widest one it accepts,
 * bounded by the candidate ceiling instead.
 */
const WINDOW_CAP = {
  isTooLong: isWindowTooLong,
  messageKey: 'pages.reports.drainsFeed.rangeTooLong',
} as const

export function DrainsFeedTab() {
  const { t } = useTranslation('common')

  // Same project resolution as the Reports dashboard: active project first,
  // then the first assigned project, then 1.
  const user = useAuthStore((state) => state.user)
  const projectId: number = Number(user?.active_project_id ?? user?.projects?.[0]?.id ?? 1)
  const userTimezone = user?.timezone

  // The PROFILE timezone is the one that travels to the backend, where it cuts
  // the promised-payment calendar days — so both ends of the request must
  // agree on which day "today" is (the hook owns when that day is re-resolved).
  // Here it decides the WEEKDAY too, and therefore whether the default window
  // is one day or three: near midnight the browser's day and the operator's
  // can be different days of the week.
  const today = useTodayInTimezone(userTimezone)

  // The source system's rule, literally: Monday → [today-3 .. today-1],
  // otherwise [yesterday .. yesterday]. Memoized on the day rather than
  // recomputed per render so the two strings keep their identity between
  // renders of the same day (they feed the window hook and, through it, the
  // query key).
  const defaultWindow = useMemo(() => previousWorkingDayWindow(today), [today])

  // The shared paged-feed URL shell: composed `replace` updates (the
  // same-tick-burst ref composition lives there), defensive page/page-size
  // parsing against the backend's `skip`/`limit` caps, and the page reset on
  // every filter change. Defaults match the backend's own `limit=50`.
  const filters = useUrlPagedFeedFilters<FilterKey>({
    pageKey: PAGE_KEY,
    pageSizeKey: PAGE_SIZE_KEY,
  })
  const { searchParams, pageSize } = filters

  // The mode switch. Present-as-"1" is on; absent is the windowed mode, which
  // is what the tab opens in.
  const allHistory = searchParams.get(ALL_HISTORY_KEY) === '1'

  // The shared window reader. The FALLBACKS are where the mode lives: the
  // previous working day in the windowed mode, and `undefined` — the hook's
  // documented "no bound" branch — in the all-history one, so both bounds come
  // back undefined and no date reaches the request.
  const { dateFrom, dateTo, isFromInvalid, isToInvalid, dateError, rangeError, hasWindowError } =
    useDateWindowFilters({
      searchParams,
      fromKey: DATE_FROM_KEY,
      toKey: DATE_TO_KEY,
      fallbackFrom: allHistory ? undefined : defaultWindow?.dateFrom,
      fallbackTo: allHistory ? undefined : defaultWindow?.dateTo,
      cap: WINDOW_CAP,
      keys: WINDOW_ERROR_KEYS,
    })

  // BOTH-OR-NEITHER, the one window rule the shared hook deliberately does not
  // own: it allows a half-specified window because several tabs want an
  // open-ended filter, and this endpoint answers 400 for one. An unusable bound
  // is NOT this finding — it already rides its own field.
  //
  // The two modes are checked SEPARATELY because they fail in opposite
  // directions, and the windowed half is not theatre:
  //  - all-history: a bound present at all is the 400. Unreachable through the
  //    UI (picking a date clears the mode flag), so a hand-edited
  //    `?dra=1&drf=…` is the way in;
  //  - windowed: a MISSING bound would mean `previousWorkingDayWindow` refused
  //    the day it was handed, and then BOTH fallbacks are undefined — which is
  //    exactly the shape of the all-history mode. Without this branch the tab
  //    would quietly request the whole history (~11.3k rows) with the mode
  //    checkbox showing unchecked. It takes a malformed "today" to get there,
  //    which is why it is a guard rather than a user-facing state; a silent
  //    switch to a different, far heavier report is not an acceptable failure.
  const hasInvalidBound = isFromInvalid || isToInvalid
  const isWindowMalformed =
    !hasInvalidBound && (allHistory ? !!dateFrom || !!dateTo : !dateFrom || !dateTo)
  const bothOrNeitherError = isWindowMalformed
    ? t('pages.reports.drainsFeed.bothOrNeither')
    : undefined
  // Where the complaint sits. A HALF window (either mode) marks the field
  // that is missing its date — that is where the action is. A FULL window
  // under the all-history flag has no missing field: both dates are the
  // intruders, so both are marked; otherwise the checkbox would read as
  // applied over two untouched, unmarked fields.
  const fullWindowUnderFlag = allHistory && !!dateFrom && !!dateTo

  // Picking a date LEAVES the all-history mode — the flag and a window would
  // otherwise contradict each other on screen (a checkbox saying "the whole
  // history" above an applied window). One composed URL update: the bound, the
  // flag dropped, and the page reset the shell adds.
  const handleDateChange = (key: FilterKey) => (change: { value: Date | null }) => {
    if (!change.value) return
    filters.setUrlParams({
      [key]: formatPickerDateAsYMD(change.value),
      [ALL_HISTORY_KEY]: null,
      [PAGE_KEY]: null,
    })
  }

  // Switching the mode ON drops both bounds in the SAME update: a date left in
  // the URL would be a value the request does not use, and re-reading it as a
  // half window on the next hand-edit. Switching it OFF only drops the flag —
  // the default window then fills both sides, which is the state the tab opens
  // in.
  const handleAllHistoryToggle = (checked: boolean | 'indeterminate') =>
    filters.setUrlParams(
      checked === true
        ? {
            [ALL_HISTORY_KEY]: '1',
            [DATE_FROM_KEY]: null,
            [DATE_TO_KEY]: null,
            [PAGE_KEY]: null,
          }
        : { [ALL_HISTORY_KEY]: null, [PAGE_KEY]: null }
    )

  // The three server-side toggles: present-as-"1" is on, absent is the backend
  // default (off). A toggle is a FILTER — setFilterParam resets the page in the
  // same URL update, or the user lands on an offset the filtered feed may not
  // even have (`hide_worked` alone drops ~90 % of a day's rows).
  const hideWorkedToday = searchParams.get(HIDE_WORKED_TODAY_KEY) === '1'
  const hideWorked = searchParams.get(HIDE_WORKED_KEY) === '1'
  const hidePaid = searchParams.get(HIDE_PAID_KEY) === '1'
  const handleToggle = (key: FilterKey) => (checked: boolean | 'indeterminate') =>
    filters.setFilterParam(key, checked === true ? '1' : null)

  // The window and the both-or-neither rule are this tab's only filters that
  // can be wrong; the three toggles cannot be.
  const hasFilterError = hasWindowError || isWindowMalformed

  const query = useDrainsFeed({
    projectId,
    // Undefined on BOTH sides is the all-history mode and is sent as the
    // absence of the two params. Undefined on one side only cannot reach here:
    // `hasFilterError` is true then and the query is disabled.
    dateFrom,
    dateTo,
    hideWorkedToday,
    hideWorked,
    hidePaid,
    skip: filters.skip,
    limit: pageSize,
    timezone: userTimezone,
    enabled: !hasFilterError,
  })

  // Stable identity for the empty fallback — a fresh `[]` every render would
  // defeat DrainsFeedTable's useMemo over its rows prop.
  const rows = useMemo(() => query.data?.rows ?? [], [query.data])

  // Totals, the display clamp for a bookmarked page the drained feed no longer
  // has, and the URL self-heal that follows the answer — shared shell. It
  // matters more here than anywhere else on the page: this feed's historical
  // windows genuinely shrink from one day to the next.
  const { total, totalPages, clampedPage } = usePagedFeedPages(filters, query.data)

  // keepPreviousData shows the previous page's rows while a new one loads —
  // they must not look final, hence the busy overlay. Placeholder only: a
  // background refetch of the SAME page shows current data and needs none.
  const isRefreshing = query.isPlaceholderData

  // The shared failure ladder (see the hook for the rungs and their order).
  // What is this endpoint's own: five distinct 503s — the auth-service org
  // directory down, the PAYMENT-service history down, the two lookups blowing
  // their joint deadline, the candidate statement timing out, and the feed
  // being saturated (no build slot came free). The payment one is the
  // important one and the reason nothing may degrade to a partial feed:
  // payments are this feed's ROW GATE, so serving without them would publish
  // every candidate as an unpaid drain (+37.6 % rows, naming clients who did
  // pay). Its 400 detail names a half-specified window ("Provide both
  // date_from and date_to, or neither" — the one the both-or-neither guard
  // above exists to pre-empt), an inverted window, a > 366-day difference, a
  // date outside the supported range, an unknown IANA zone, or a candidate set
  // over the feed's ceiling — all actionable, which is why it is shown
  // verbatim.
  //
  // `errorDetail` IS RENDERED here, like both money siblings and unlike the
  // communication-gap and contact-tag feeds. The decision is not automatic:
  // two of the five 503 sentences name internal knobs
  // (DRAIN_FEED_BUILD_SLOT_WAIT_SECONDS, DRAIN_FEED_COMPUTE_DEADLINE_SECONDS),
  // which is exactly the reason those two tabs suppress theirs. It is rendered
  // anyway because the other three name WHICH DEPENDENCY failed — and telling
  // "the employee directory is down" from "the payment history is down" from
  // "the query timed out, narrow the window" is the difference between a
  // support ticket that routes itself and one that does not. The knob-naming
  // pair still ends in an operator-actionable clause ("retry shortly",
  // "request a narrower date window"), which the suppressed feeds' texts did
  // not.
  const { errorMessage, errorDetail, isForbidden } = useFeedErrorMessage(query.error, 'drainsFeed')

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Filters: the promised-day window (default = the previous working
          day), its off switch, and the three server-side toggles.

          NEITHER picker is bounded by the other (no `min`/`max`), on purpose —
          the page-wide rule for every date pair WITH A DEFAULTED WINDOW
          (processing, searcher, operator-promises, outbound-calls,
          promises-daily, promises-feed, callbacks; the reasoning is written
          out in full in SearcherFollowupFeedTab). The pair-level guard below
          is what actually protects the API — manual input and hand-edited URLs
          bypass picker bounds anyway. */}
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl p-4 shadow-sm sm:gap-4">
        <DateSelect
          label={t('pages.reports.drainsFeed.dateFrom')}
          // Empty in the all-history mode (there is no bound to show), and
          // empty for an unusable URL value — never the default silently
          // standing in for a bad value, since the bound itself is undefined
          // in that case.
          value={dateFrom ?? null}
          // Only the bound that actually carries the complaint is marked: the
          // unusable value rides the field holding it; the both-or-neither
          // complaint rides the field that is MISSING its date — or both
          // fields when a full window sits under the all-history flag (see
          // `fullWindowUnderFlag`).
          error={
            isFromInvalid
              ? dateError
              : isWindowMalformed && (!dateFrom || fullWindowUnderFlag)
                ? bothOrNeitherError
                : undefined
          }
          onChange={handleDateChange(DATE_FROM_KEY)}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <DateSelect
          label={t('pages.reports.drainsFeed.dateTo')}
          value={dateTo ?? null}
          error={
            isToInvalid
              ? dateError
              : isWindowMalformed && (!dateTo || fullWindowUnderFlag)
                ? bothOrNeitherError
                : undefined
          }
          onChange={handleDateChange(DATE_TO_KEY)}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        {/* The window's off switch — the endpoint's all-history mode. Sits
            next to the dates it switches off, not among the three row filters
            below, because it is not a filter: it changes which REPORT is
            requested (~11.3k rows against a day's few hundred). */}
        <label className="flex h-[45px] cursor-pointer items-center gap-2">
          <Checkbox
            checked={allHistory}
            onCheckedChange={handleAllHistoryToggle}
            aria-label={t('pages.reports.drainsFeed.allHistory')}
          />
          <span className="text-foreground text-xs font-medium sm:text-sm">
            {t('pages.reports.drainsFeed.allHistory')}
          </span>
        </label>
        <label className="flex h-[45px] cursor-pointer items-center gap-2">
          <Checkbox
            checked={hideWorkedToday}
            onCheckedChange={handleToggle(HIDE_WORKED_TODAY_KEY)}
            aria-label={t('pages.reports.drainsFeed.hideWorkedToday')}
          />
          <span className="text-foreground text-xs font-medium sm:text-sm">
            {t('pages.reports.drainsFeed.hideWorkedToday')}
          </span>
        </label>
        <label className="flex h-[45px] cursor-pointer items-center gap-2">
          <Checkbox
            checked={hideWorked}
            onCheckedChange={handleToggle(HIDE_WORKED_KEY)}
            aria-label={t('pages.reports.drainsFeed.hideWorked')}
          />
          <span className="text-foreground text-xs font-medium sm:text-sm">
            {t('pages.reports.drainsFeed.hideWorked')}
          </span>
        </label>
        <label className="flex h-[45px] cursor-pointer items-center gap-2">
          <Checkbox
            checked={hidePaid}
            onCheckedChange={handleToggle(HIDE_PAID_KEY)}
            aria-label={t('pages.reports.drainsFeed.hidePaid')}
          />
          <span className="text-foreground text-xs font-medium sm:text-sm">
            {t('pages.reports.drainsFeed.hidePaid')}
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
        // DrainsFeedTable so the two cannot drift apart.
        <TableSkeleton columns={DRAINS_FEED_COLUMN_COUNT} rows={6} />
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
              {t('pages.reports.drainsFeed.error.retry')}
            </Button>
          )}
        </div>
      ) : (
        <div className="relative w-full" aria-busy={isRefreshing || undefined}>
          {/* An empty answer is a normal 200: the default window is a single
              past day, `hide_worked` alone drops ~90 % of it, and a bookmarked
              historical window shrinks as clients promise again — hence a calm
              message, not an error state. */}
          <DrainsFeedTable
            rows={rows}
            timezone={userTimezone}
            emptyMessage={t('pages.reports.drainsFeed.empty')}
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
              data-testid="drains-feed-refreshing"
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
