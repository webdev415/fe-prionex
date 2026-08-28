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
 *    was made. An ABSENT `?kd=` is what that default fills in for — a PRESENT
 *    but empty one is not: the key would then be stating no day at all for a
 *    parameter that has no "unset", so it is refused exactly like `2026-02-31`
 *    (see `utils/viewDate.ts`).
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
 *      lands there is simply nothing to state. An echo keeps speaking for the
 *      screen until the request moves out from under it — the sell MODE leaving
 *      the one it was fetched in, or the reference day leaving the one it
 *      answers for (the default is derived from `view_date`, so it moves with
 *      it). Paging the same defaulted window does neither;
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
 * `tag_code` (the endpoint takes no `tag_code` parameter yet — a follow-up
 * carries one). They change no request, so — unlike every other key this tab
 * writes — the sub-tab does NOT reset the page: the rows on screen are the same
 * rows either way. Both the filtering and the counts are therefore page-scoped,
 * and the line between the strip and the table says so; see `utils/tagTabs.ts`
 * for why keying on the code (not the localized name) is what keeps them
 * working across a tag rename.
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
import { readSellToState, type SellToMode } from '../utils/sellWindow'
import { readViewDateBound } from '../utils/viewDate'
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
  //
  // TWO of this tab's three dates need their own reader, and for the same
  // reason: `readUrlDateBound` folds "absent" and "empty" together, which is
  // right for an OPTIONAL bound (both mean "no bound") and wrong for either
  // date here that has a meaning for the absent case. The required reference
  // day is one of them — a bare `?kd=` states no day, and folding it into
  // "absent" would quietly answer for TODAY under a URL that says nothing (see
  // `utils/viewDate.ts`); the upper sell bound is the other, and its third
  // state is the whole contract (see `utils/sellWindow.ts`). Only `sell_from`,
  // a plain optional bound, reads through the shared helper.
  const viewDateBound = readViewDateBound(searchParams, VIEW_DATE_KEY)
  const sellFromBound = readUrlDateBound(searchParams, SELL_FROM_KEY)
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
  // has, and the URL self-heal that follows the answer — shared shell. The
  // answer is withheld while a filter error blocks the request: a disabled
  // query still returns cached data for its key, and an unusable ?kd=/?kf=
  // falls back to the VALID state's params (unlike ?kt=, which carries its
  // raw spelling), so without the guard the ?kpg= self-heal could rewrite
  // the URL from an answer the current filters never asked for.
  const { total, totalPages, clampedPage } = usePagedFeedPages(
    filters,
    hasFilterError ? undefined : query.data
  )

  const activeTab: ContactTagTabId = resolveContactTagTab(searchParams.get(TAG_KEY))
  const visibleRows = useMemo(() => filterRowsByTagTab(rows, activeTab), [rows, activeTab])
  const tabCounts = useMemo(() => countRowsByTagTab(rows), [rows])

  // Is there an ANSWER this screen may speak for? Both hints under the filters
  // and the counts in the tab strip state facts about data, so all three wait
  // for data to exist — and none of them may speak while a filter error keeps
  // the query from asking at all. (`query.data` alone would not do: an
  // unusable `?kd=` leaves the view date at today, i.e. on a query key that may
  // still hold a cached answer, which React Query hands back even with the
  // query disabled.)
  const hasAnswer = !hasFilterError && !!query.data

  // The counts belong to the PAGE, not the feed — this list is ~880 pages long,
  // so a client-side filter can only ever see the 50 rows on screen. Saying so
  // in the line below the strip is what keeps "Контакт (12)" from reading as
  // "12 in the whole feed"; it is said ONCE, in a line every reader gets,
  // rather than also as a per-tab `title` only a mouse can find (a tooltip
  // repeating a caveat the paragraph below already carries is noise on hover
  // and reaches neither keyboard nor touch).
  //
  // ...and they are only appended once a page EXISTS to count. Before the first
  // answer (and while a filter error keeps the query from asking for one) there
  // are no rows, and "Всі (0)" would state a fact about the feed — zero tagged
  // clients — that nothing has established. The bare label says the same thing
  // the empty strip does: nothing yet.
  const tabItems: SegmentedTabItem<ContactTagTabId>[] = useMemo(
    () =>
      CONTACT_TAG_TAB_IDS.map((id) => {
        const name = t(`pages.reports.contactTag.subtabs.${id}`)
        return { id, label: hasAnswer ? `${name} (${tabCounts[id]})` : name }
      }),
    [t, tabCounts, hasAnswer]
  )

  // "The page produced rows, but none of them carry this tag" — a different
  // fact from "the feed produced nothing", and saying "no data" there would be
  // false: the page has data, this tab just cannot see it.
  const hasUnmatchedRows = rows.length > 0 && visibleRows.length === 0

  // The APPLIED upper bound, straight from the answer — never recomputed here
  // (see the module docblock). `undefined` until the first response: the hint
  // states a fact about the data, so it has nothing to say before there is any.
  const appliedSellTo = query.data?.sell_to

  // WHICH request the answer on screen was fetched under — the sell MODE it was
  // asked in, plus the reference day it came back stamped with.
  //
  // Under keepPreviousData `query.data` is the PREVIOUS answer while a new one
  // flies, so an echo can outlive the state that produced it: on an explicit →
  // default switch the previous echo is the date the operator just stopped
  // asking for, and a hint reading it would announce "the default is
  // 30.06.2026" about a bound they had picked by hand. What makes that echo
  // stale, though, is the MODE having moved on — not the request being in
  // flight. Remembering the mode each answer arrived under, and hiding the hint
  // only when the two disagree, says exactly that: the line goes quiet across a
  // switch it no longer speaks for, and holds still while merely paging through
  // the SAME defaulted window — which is the most frequent interaction this tab
  // has (~880 pages), and a hint that blinked out and back on every page turn
  // moved the whole filter strip's layout with it.
  //
  // The mode is captured from the frames where the data is NOT placeholder:
  // there — and only there — the answer on screen belongs to the query key
  // currently being asked, so the mode in this render is by construction the
  // mode it was fetched under. Every placeholder frame afterwards keeps that
  // memory, which is what lets a page turn (a new key, same sell state) go on
  // showing the hint while a mode switch (a new key, different sell state)
  // silences it.
  //
  // Adjusted during render rather than in an effect — React's own "storing
  // information from previous renders" pattern: the re-render happens before
  // the browser paints, so no frame ever shows a fresh answer paired with the
  // mode of the previous one.
  const [answeredSellToMode, setAnsweredSellToMode] = useState<SellToMode | null>(null)
  const settledSellToMode = query.data && !query.isPlaceholderData ? sellToState.mode : null
  if (settledSellToMode !== null && settledSellToMode !== answeredSellToMode) {
    setAnsweredSellToMode(settledSellToMode)
  }
  // The mode memory alone is not enough, because the DEFAULTED bound is derived
  // from `view_date` (the last day of the month four months before it): moving
  // the reference day moves the applied default without the mode budging, so
  // the gate above stays silent while keepPreviousData holds the previous
  // answer on screen — and if that refetch fails, the superseded date sits next
  // to the error for as long as the operator leaves it there. The response's
  // OWN echo of the day it was computed for cannot drift the way a remembered
  // value can, so the hint speaks only while the answer it reads was computed
  // for the day the strip is showing.
  const isSellToEchoCurrent =
    answeredSellToMode === sellToState.mode && query.data?.view_date === viewDate

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

  // Note what is NOT shown for a 503: the server's own sentence. The six
  // flavours are worded distinctly on purpose, but they are worded for the
  // people who run the services — they name internal dependencies and env
  // knobs («raise CONTACT_TAG_FEED_TAG_MAX_PAGES», «auth-service») — and the
  // operator's move is the same in all six, so the detail is an internals leak
  // that buys the reader nothing. Monitoring tells the six apart from the
  // backend's own logs, where they are already distinct. Same as the sibling
  // gap feed's 503 branch; the 400 detail keeps riding `errorMessage` above,
  // because THAT one names a filter the operator can actually turn.

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
            appears only once there IS an answer it belongs to (an empty feed is
            one): before the first response there is no applied window to name,
            a blocked request never asked for one, and an echo left over from a
            sell mode the operator has since walked away from would name a bound
            that is no longer in force (see `isSellToEchoCurrent` above).

            Note what is deliberately NOT a condition: being mid-flight.
            `isPlaceholderData` is true on every page turn of this ~880-page
            feed, and gating on it made the line — and with it the height of the
            whole filter strip — flicker on the tab's commonest interaction,
            about a default that had not changed at all. */}
        {sellToState.mode === 'default' && hasAnswer && appliedSellTo && isSellToEchoCurrent && (
          <p className="text-muted-foreground w-full text-xs">
            {t('pages.reports.contactTag.sellToDefaultHint', {
              date: formatCalendarDay(appliedSellTo, language),
            })}
          </p>
        )}
        {/* The other half of the same rule. "The upper bound is off — you are
            looking at the whole portfolio" is a claim about rows on screen, and
            a blocked request (an unusable date anywhere in the strip) has put
            none there: the tab is showing hints, not a portfolio. Same before
            the first answer.

            And the same staleness gate as its sibling, read off the answer's
            own echo: `sell_to: null` is exactly what "no upper bound was
            applied" looks like on the wire, so it says whether the rows on
            screen were fetched WITHOUT the bound. Under keepPreviousData a
            switch into `off` would otherwise have this line claiming the whole
            portfolio over rows a bound had trimmed — the mirror image of the
            explicit → default drift above. A page turn inside the off state
            keeps echoing `null`, so the line holds still there. */}
        {sellToState.mode === 'off' && hasAnswer && query.data?.sell_to === null && (
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
      {/* What the strip above actually does, said between the strip and the
          table it governs — the two places the page scope is felt.

          Both halves are named, and the FILTERING half is the load-bearing one:
          «Контакт» shows the tagged rows OF THIS PAGE, so an operator who reads
          the strip as a feed-wide filter would take an empty «Неконтакт» tab
          for "none in the feed" while page 2 of ~880 is full of them. (There is
          no server-side `tag_code` parameter yet; a follow-up carries it.)

          Gated on the same `hasAnswer` as the counts themselves: with no page
          fetched — before the first answer, or while a filter error keeps the
          request from being made — there is nothing being scoped, and a caveat
          about counts nobody can see is one more line to read past. */}
      {hasAnswer && (
        <p className="text-muted-foreground -mt-2 text-xs">
          {t('pages.reports.contactTag.subtabCountScope')}
        </p>
      )}

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
