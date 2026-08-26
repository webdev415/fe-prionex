/**
 * ContactTagFeedTab Component
 *
 * «Контакт/Неконтакт» feed tab for the Reports page (migrated Metabase
 * Card 124): a WORK LIST of clients with a live debt who carry the «Контакт» or
 * «Неконтакт» tag and whom NOBODY has touched for longer than that tag's
 * threshold — 5 days for `kontakt`, 7 for `nekontakt` — where "touched" means
 * BOTH an interaction and a re-assignment. One row = one client; a client with
 * a live promise (or a promised call-back) is not here at all.
 *
 * All filter state, the sub-tab and the current page live in the URL (`?kd=`,
 * `?kf=`, `?kt=`, `?kg=`, `?kpg=`, `?kps=`) so they survive refresh,
 * bookmarking and switching between the page tabs (panels unmount on switch).
 * Filter updates use `replace` — only page-tab changes create history entries.
 * The URL shell — composed updates, page/page-size parsing, the page clamp and
 * its self-heal — is the shared `useUrlPagedFeedFilters`; the keys are this
 * tab's set in the page-wide registry (`src/lib/reportsUrlKeys.ts`),
 * deliberately spelled `k…` because the natural `ct`/`cf` are already the
 * verification tab's count bounds.
 *
 * ## The date model is NOT the other feeds'
 *
 * Two independent things, not one window:
 *
 * 1. **«Дата перегляду» (`view_date`) is REQUIRED and single.** It is the day
 *    the feed is computed AS OF — both staleness thresholds and the promise
 *    gate are measured against it — and the backend has no default for it. The
 *    tab's default is TODAY in the profile timezone (the source system's own
 *    behaviour), held in state seeded at mount and re-resolved on window focus
 *    so a tab left open across midnight rolls to the new day when the operator
 *    comes back to it, and deliberately NOT written into the URL: an
 *    auto-derived value in a shared link would pin "today" to the day the link
 *    was made.
 *
 * 2. **The sell window is OPTIONAL and asymmetric.** `sell_from` behaves like
 *    every other optional bound on the page. `sell_to` has THREE states, and
 *    the whole machine lives in `utils/sellWindow.ts`:
 *
 *    - **default** (`?kt=` absent, the state the tab opens in) — the parameter
 *      is not sent, the backend applies "the last day of the month four months
 *      before `view_date`'s month", and the response ECHOES the date it
 *      applied. That echo is what the hint under the fields shows: the frontend
 *      deliberately does not recompute the month arithmetic (a month offset
 *      with a day clamp and a leap February — 2024-06-01 → 2024-02-29 — is not
 *      a rule worth having two implementations of), so before the first answer
 *      lands — and while a keepPreviousData frame is still showing the previous
 *      one — there is simply nothing to state;
 *    - **off** (`?kt=`, present and empty) — `sell_to=` goes on the wire and
 *      the upper bound is switched off. Reached by the picker's "×" when a date
 *      is set, or by the explicit "switch off" button when the default is in
 *      force (the "×" cannot serve that edge: the field is empty there, so the
 *      shared DateSelect renders no "×" at all);
 *    - **explicit** (`?kt=2026-06-30`) — that date goes on the wire.
 *
 *    …and one button walks back to **default** from either of the other two.
 *    Exactly one control per edge of the machine; see the state diagram in
 *    `utils/sellWindow.ts`.
 *
 * ## What this tab does NOT guard
 *
 * An inverted window is reachable here without a single bad value — "purchased
 * since last month" against a default upper bound four months back — and the
 * tab does not pre-empt it. It guards only the pair it can SEE (an explicit
 * `sell_from` after an explicit `sell_to`); the defaulted case goes to the
 * backend, which answers 400 with a detail naming the APPLIED `sell_to` and the
 * empty-value escape hatch. That detail is strictly more useful than anything
 * this tab could say without knowing the default, and it is passed through
 * verbatim by the error ladder below. The candidate cap
 * (`CONTACT_TAG_FEED_MAX_CANDIDATES`) is the other input-shaped 400 and rides
 * the same branch.
 *
 * ## Sub-tabs
 *
 * «Всі» / «Контакт» / «Неконтакт», filtering the CURRENT PAGE client-side by
 * `tag_code`. They change no request, so — unlike every other key this tab
 * writes — the sub-tab does NOT reset the page: the rows on screen are the same
 * rows either way. The counts in the strip are page-scoped and labelled as
 * such; see `utils/tagTabs.ts` for why keying on the code (not the localized
 * name) is what keeps them working across a tag rename.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import { Pagination } from '@/components/ui/Pagination'
import {
  SegmentedTabs,
  segmentedTabId,
  segmentedTabPanelId,
  type SegmentedTabItem,
} from '@/components/ui/SegmentedTabs'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { usePagedFeedPages, useUrlPagedFeedFilters } from '@/hooks'
import { isTransientFailure } from '@/lib/api'
import { formatCalendarDay } from '@/lib/calendarDay'
import { getDateStringInTimezone } from '@/lib/dateUtils'
import { getErrorMessage, getErrorStatus, hasResponseDetail } from '@/lib/errors'
import { Icons } from '@/lib/icons'
import { REPORTS_URL_KEYS } from '@/lib/reportsUrlKeys'
import { isDatePairInverted, readUrlDateBound } from '@/lib/urlDateBound'
import { useAuthStore } from '@/stores/authStore'
import { useContactTagFeed } from '../hooks'
import { readSellToState } from '../utils/sellWindow'
import {
  CONTACT_TAG_TAB_IDS,
  DEFAULT_CONTACT_TAG_TAB,
  countRowsByTagTab,
  filterRowsByTagTab,
  resolveContactTagTab,
  type ContactTagTabId,
} from '../utils/tagTabs'
import { CONTACT_TAG_COLUMN_COUNT, ContactTagTable } from './ContactTagTable'

/** This tab's slice of the Reports page URL namespace (see the registry). */
const {
  viewDate: VIEW_DATE_KEY,
  sellFrom: SELL_FROM_KEY,
  sellTo: SELL_TO_KEY,
  tag: TAG_KEY,
  page: PAGE_KEY,
  pageSize: PAGE_SIZE_KEY,
} = REPORTS_URL_KEYS.contactTag

const TABS_ID_PREFIX = 'contact-tag'

/**
 * The keys this tab may write through the shell's typed helpers — handed to it
 * so a misspelled key is a compile error rather than a value written under a
 * name nothing reads (or, worse, one a sibling tab owns).
 *
 * `TAG_KEY` is deliberately NOT in this union: it is not a filter. It changes
 * no request, so it must not go through `setFilterParam` (which resets the
 * page) — it is written with the raw `setUrlParams` instead. The paging keys
 * are the shell's own and are configured, not passed per call.
 */
type FilterKey = typeof VIEW_DATE_KEY | typeof SELL_FROM_KEY | typeof SELL_TO_KEY

export function ContactTagFeedTab() {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language

  // Same project resolution as the Reports dashboard: active project first,
  // then the first assigned project, then 1.
  const user = useAuthStore((state) => state.user)
  const projectId: number = Number(user?.active_project_id ?? user?.projects?.[0]?.id ?? 1)
  const userTimezone = user?.timezone

  // The default view date: "today" resolved in the PROFILE timezone — "now" is
  // a real moment, and near midnight the browser's day and the operator's day
  // differ. The same timezone travels to the backend, which cuts the promise
  // date and the assignment date in it, so the two ends of the request agree on
  // what "today" means.
  //
  // Held in STATE, not read off the wall clock in render: seeded once at mount
  // and re-resolved on window focus, so a tab left open across midnight picks
  // up the new day the moment the operator comes back to it instead of keeping
  // yesterday's reference day until an unrelated re-render. The functional
  // update returns the previous value while the day is unchanged, so a same-day
  // focus re-renders nothing. `today` only backs the DEFAULT — a user-picked
  // URL date never moves when the day rolls over.
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
  // every filter change. Defaults match the backend's own `limit=50` — and this
  // is the one feed where paging is not a formality: ~44 000 rows, ~880 pages.
  const filters = useUrlPagedFeedFilters<FilterKey>({
    pageKey: PAGE_KEY,
    pageSizeKey: PAGE_SIZE_KEY,
  })
  const { searchParams, pageSize, setFilterParam, setUrlParams } = filters

  // A present-but-unusable bound is NOT silently replaced by the default: the
  // URL would then disagree with both the field and the request. It goes down
  // the same path as an inverted range — inline hint, no request (below).
  // Tracked per bound so the hint sits on the field holding the bad value.
  const viewDateBound = readUrlDateBound(searchParams, VIEW_DATE_KEY)
  const sellFromBound = readUrlDateBound(searchParams, SELL_FROM_KEY)
  // ...and the upper bound gets its own reader, because `readUrlDateBound`
  // folds "absent" and "empty" together — right for every other bound on the
  // page, and the exact distinction this one is built on.
  const sellToState = readSellToState(searchParams, SELL_TO_KEY)

  const isViewDateInvalid = viewDateBound.isInvalid
  const isSellFromInvalid = sellFromBound.isInvalid
  const isSellToInvalid = sellToState.isInvalid
  const hasInvalidSellDate = isSellFromInvalid || isSellToInvalid

  // An ABSENT view date means "today", not "no date": the parameter is
  // mandatory, so the default fills in.
  const viewDate = viewDateBound.value ?? today
  // The lower bound has no default: unset means "no bound".
  const sellFrom = sellFromBound.value

  const handleDateChange = (key: FilterKey) => filters.dateFilterHandler(key)

  // Only the pair this tab can SEE. The defaulted upper bound can invert the
  // window too, and that case is deliberately left to the backend's 400 —
  // its detail names the applied date, which is the one thing this guard could
  // not (see the module docblock).
  const isSellInverted = !hasInvalidSellDate && isDatePairInverted(sellFrom, sellToState.value)

  // Where a message is rendered follows WHAT it is about: a bad date belongs to
  // ONE field, so it rides that field's `error` prop (red border, aria-invalid,
  // aria-describedby on the offending input); an inverted window belongs to the
  // PAIR — neither bound is wrong on its own — so it stays a standalone alert
  // under the filters. Same split as every sibling feed tab.
  //
  // `error` (not `invalidText`) is the right prop for all three: these values
  // arrive already committed, from the URL, not as half-typed text.
  const viewDateError = isViewDateInvalid
    ? t('pages.reports.contactTag.invalidViewDate')
    : undefined
  const sellDateError = hasInvalidSellDate
    ? t('pages.reports.contactTag.invalidSellDate')
    : undefined
  const sellRangeError = isSellInverted ? t('pages.reports.contactTag.invalidSellRange') : undefined

  const hasFilterError = isViewDateInvalid || hasInvalidSellDate || isSellInverted

  const query = useContactTagFeed({
    projectId,
    viewDate,
    sellFrom,
    sellTo: sellToState,
    skip: filters.skip,
    limit: pageSize,
    timezone: userTimezone,
    enabled: !hasFilterError,
  })

  // Stable identity for the empty fallback — a fresh `[]` every render would
  // defeat the memos below and ContactTagTable's own.
  const rows = useMemo(() => query.data?.rows ?? [], [query.data])

  // Totals, the display clamp for a bookmarked page the drained feed no longer
  // has, and the URL self-heal that follows the answer — shared shell.
  const { total, totalPages, clampedPage } = usePagedFeedPages(filters, query.data)

  const activeTab: ContactTagTabId = resolveContactTagTab(searchParams.get(TAG_KEY))
  const visibleRows = useMemo(() => filterRowsByTagTab(rows, activeTab), [rows, activeTab])
  const tabCounts = useMemo(() => countRowsByTagTab(rows), [rows])

  // The counts belong to the PAGE, not the feed — this list is ~880 pages long,
  // so a client-side filter can only ever see the 50 rows on screen. Saying so
  // in the label (and once more under the strip) is what keeps "Контакт (12)"
  // from reading as "12 in the whole feed".
  //
  // ...and they are only appended once a page EXISTS to count. Before the first
  // answer (and while a filter error keeps the query from asking for one) there
  // are no rows, and "Всі (0)" would state a fact about the feed — zero tagged
  // clients — that nothing has established. The bare label says the same thing
  // the empty strip does: nothing yet.
  const hasCountedPage = !hasFilterError && !!query.data
  const tabItems: SegmentedTabItem<ContactTagTabId>[] = useMemo(
    () =>
      CONTACT_TAG_TAB_IDS.map((id) => {
        const name = t(`pages.reports.contactTag.subtabs.${id}`)
        return {
          id,
          label: hasCountedPage ? `${name} (${tabCounts[id]})` : name,
          title: hasCountedPage ? t('pages.reports.contactTag.subtabCountTitle') : undefined,
        }
      }),
    [t, tabCounts, hasCountedPage]
  )

  // "The page produced rows, but none of them carry this tag" — a different
  // fact from "the feed produced nothing", and saying "no data" there would be
  // false: the page has data, this tab just cannot see it.
  const hasUnmatchedRows = rows.length > 0 && visibleRows.length === 0

  // The APPLIED upper bound, straight from the answer — never recomputed here
  // (see the module docblock). `undefined` until the first response: the hint
  // states a fact about the data, so it has nothing to say before there is any.
  const appliedSellTo = query.data?.sell_to

  // keepPreviousData shows the previous page's rows while a new one loads —
  // they must not look final, hence the busy overlay. Placeholder only: a
  // background refetch of the SAME page shows current data and needs none.
  const isRefreshing = query.isPlaceholderData

  const errorStatus = getErrorStatus(query.error)
  const isForbidden = errorStatus === 403
  const isUnavailable = isTransientFailure(query.error)
  const errorMessage = isUnavailable
    ? // Covers all SIX of the endpoint's own 503s — the tag directory being
      // down, it throttling us past the single bounded retry, its keyset walk
      // blowing either its deadline or its page cap, and the auth-service
      // directory being down or blowing the fan-out deadline. The operator's
      // move is the same in all of them (wait and retry), and none may degrade
      // to a partial feed: a silently missing tag or employee would drop
      // clients out of a work list without a word.
      t('pages.reports.contactTag.unavailable')
    : isForbidden
      ? t('pages.reports.contactTag.forbidden')
      : // Backend date/timezone validation answers 400 with a human-readable
        // detail — and so do the two refusals that matter most here: an
        // inverted window whose upper bound is the DEFAULT (the detail names
        // the applied date and the empty-value escape hatch, which is the one
        // thing the local guard cannot know), and the candidate cap, whose
        // detail asks for a narrower sell window. Passing them through verbatim
        // is what makes those refusals actionable. Only when the answer HAS a
        // detail, though: a 400 whose body never arrived would otherwise show
        // axios' own untranslated "Request failed with status code 400" (see
        // hasResponseDetail), so it joins every other unexplained failure under
        // the localized generic title.
        errorStatus === 400 && hasResponseDetail(query.error)
        ? getErrorMessage(query.error)
        : t('pages.reports.contactTag.error.title')

  // The six 503s are worded distinctly by the backend on purpose — the remedies
  // differ (two outages, throttling, two timeouts, a page cap) and monitoring
  // must tell them apart — so the server's own sentence is shown
  // UNDER the localized one rather than instead of it: the operator reads their
  // language, and whoever is asked "what does it say?" can tell which
  // dependency failed. Absent for a transport-level failure (a 502/504 or a
  // dropped connection carries no body).
  const errorDetail =
    isUnavailable && hasResponseDetail(query.error) ? getErrorMessage(query.error) : null

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Filters: the mandatory reference day + the optional, asymmetric sell
          window.

          CALENDAR POLICY, and it differs per field on purpose:

          «Дата перегляду» carries no `min`/`max`. It is a DEFAULTED value with
          no partner to be ordered against — the page-wide rule for every tab
          whose date is defaulted (searcher, inbound, processing,
          operator-promises) is that a bound nothing on screen states must not
          grey out a calendar.

          The sell PAIR keeps its mutual bounds, following the two feeds whose
          bounds start empty and optional (Cards 125 and 148): with no default
          there is no order trap to remove, and `max`/`min` only appear once the
          OTHER end actually holds a picked date. Note the consequence of the
          asymmetry: in the `default` state «по» holds no value, so «з» stays
          unbounded — which is right, because the bound in force there is the
          backend's and the guard against inverting against it is the backend's
          400, not a greyed-out calendar (see the module docblock). */}
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl p-4 shadow-sm sm:gap-4">
        <DateSelect
          label={t('pages.reports.contactTag.viewDate')}
          // An unusable URL value shows an empty field with the error on it,
          // never the default silently standing in for the bad value.
          value={isViewDateInvalid ? null : viewDate}
          error={viewDateError}
          onChange={handleDateChange(VIEW_DATE_KEY)}
          // No "×": the parameter is REQUIRED, so an empty reference day is not
          // a state this feed has. The way back to the default is picking today.
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <DateSelect
          label={t('pages.reports.contactTag.sellFrom')}
          value={sellFrom ?? null}
          // Bounded by the other end only when it holds a PICKED date — an
          // open-ended (or backend-defaulted) upper bound must not constrain it.
          max={sellToState.value}
          // Only the bound that actually carries the unusable value is marked.
          error={isSellFromInvalid ? sellDateError : undefined}
          onChange={handleDateChange(SELL_FROM_KEY)}
          // Absent and empty mean the same thing here (no lower bound), so the
          // "×" simply drops the key.
          onClear={() => setFilterParam(SELL_FROM_KEY, null)}
          // Several "×" buttons stand side by side here — DateSelect's default
          // "Clear" name would be identical for all of them.
          clearLabel={t('pages.reports.contactTag.clearSellFrom')}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <DateSelect
          label={t('pages.reports.contactTag.sellTo')}
          value={sellToState.value ?? null}
          min={sellFrom}
          error={isSellToInvalid ? sellDateError : undefined}
          onChange={handleDateChange(SELL_TO_KEY)}
          // THE "×" IS THE `off` TRANSITION, not a key deletion: clearing the
          // field is how the source system's operator says "no upper bound",
          // and deleting the key would instead re-apply the backend's four-month
          // default — the opposite of what the gesture means. It renders only
          // while a date is set (DateSelect's own rule), which is why the
          // `default` state needs the button below.
          onClear={() => setFilterParam(SELL_TO_KEY, '')}
          clearLabel={t('pages.reports.contactTag.clearSellTo')}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />

        {/* The two transitions the pickers cannot express. Each renders only
            where it changes something, so the strip never offers a no-op. */}
        {sellToState.mode === 'default' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilterParam(SELL_TO_KEY, '')}
            className="shrink-0"
          >
            {t('pages.reports.contactTag.disableSellTo')}
          </Button>
        )}
        {sellToState.mode !== 'default' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilterParam(SELL_TO_KEY, null)}
            className="shrink-0"
          >
            {t('pages.reports.contactTag.restoreSellToDefault')}
          </Button>
        )}

        {/* What upper bound is ACTUALLY in force, told in the state's own
            words. The defaulted date is the backend's echo, so this line cannot
            drift out of step with the arithmetic that produced it — and it
            appears only once there IS an answer (an empty feed is one), because
            before that there is no applied window to name.

            `!isRefreshing` is the same rule one step further: under
            keepPreviousData `query.data` is the PREVIOUS answer while a new one
            flies, and on an explicit → default switch that previous echo is the
            date the operator just stopped asking for — the hint would announce
            "the default is 30.06.2026" about a bound they had picked by hand.
            An echo that does not belong to the state on screen is worse than
            silence, so the line waits for the answer that matches. The cost is
            that it also blinks out while a mere page change reloads the same
            defaulted window; a moment of nothing is the honest half of that
            trade. */}
        {sellToState.mode === 'default' && appliedSellTo && !isRefreshing && (
          <p className="text-muted-foreground w-full text-xs">
            {t('pages.reports.contactTag.sellToDefaultHint', {
              date: formatCalendarDay(appliedSellTo, language),
            })}
          </p>
        )}
        {sellToState.mode === 'off' && (
          <p className="text-muted-foreground w-full text-xs">
            {t('pages.reports.contactTag.sellToOffHint')}
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

      {/* Tag sub-tabs: a fixed triple, always present. Switching is pure
          client-side filtering of an already-fetched page — cheap, so selection
          follows focus (`activation` default) per the ARIA APG rule the host
          page's own expensive strip deliberately opts out of. */}
      <SegmentedTabs<ContactTagTabId>
        items={tabItems}
        value={activeTab}
        onChange={(tabId) =>
          // The default tab is the ABSENCE of the key, never a spelled-out
          // `kg=all`: a shared link then carries only choices somebody made.
          //
          // `setUrlParams`, NOT `setFilterParam`: the sub-tab changes no
          // request, so resetting the page would throw away the operator's
          // position in an 880-page feed for nothing.
          setUrlParams({ [TAG_KEY]: tabId === DEFAULT_CONTACT_TAG_TAB ? null : tabId })
        }
        ariaLabel={t('pages.reports.tabs.contact-tag')}
        idPrefix={TABS_ID_PREFIX}
      />
      <p className="text-muted-foreground -mt-2 text-xs">
        {t('pages.reports.contactTag.subtabCountTitle')}
      </p>

      {/* Content: an invalid filter shows only the hints above.

          The panel is deliberately NOT focusable: the ARIA APG rule that a
          tabpanel needs `tabIndex={0}` applies only to panels with no focusable
          content, and this one holds a client link per row plus the pager's
          buttons and rows-per-page select — the same reasoning as the host
          page's own panels. */}
      <div
        role="tabpanel"
        id={segmentedTabPanelId(TABS_ID_PREFIX, activeTab)}
        aria-labelledby={segmentedTabId(TABS_ID_PREFIX, activeTab)}
        className="flex w-full flex-col gap-4"
      >
        {hasFilterError ? null : query.isLoading ? (
          // The skeleton mirrors the real table's width — the count comes from
          // ContactTagTable so the two cannot drift apart.
          <TableSkeleton columns={CONTACT_TAG_COLUMN_COUNT} rows={6} />
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
                {t('pages.reports.contactTag.error.retry')}
              </Button>
            )}
          </div>
        ) : (
          <div className="relative w-full" aria-busy={isRefreshing || undefined}>
            {/* Two different silences, told apart. A genuinely empty answer is
                a normal 200 (zero tagged clients and zero surviving candidates
                both answer 200) and gets the calm "nothing to work". A page
                that HAS rows none of which carry this tag is a different fact,
                and the message points at «Всі», where they certainly are. */}
            <ContactTagTable
              rows={visibleRows}
              emptyMessage={t(
                hasUnmatchedRows
                  ? 'pages.reports.contactTag.emptyTag'
                  : 'pages.reports.contactTag.empty'
              )}
            />
            {/* No pager for an empty feed — a lone "Page 1 of 1" under a "no
                data" row is noise. It follows the FEED's total, not the
                sub-tab's visible count: paging is server-side, so a tag tab
                that hides every row of this page has not made the feed shorter. */}
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
                data-testid="contact-tag-refreshing"
                className="bg-card/60 absolute inset-0 z-10 flex items-center justify-center rounded-xl"
              >
                <Icons.Spinner className="h-8 w-8" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
