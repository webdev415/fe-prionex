/**
 * OperatorPromisesTab Component
 *
 * «Обіцянки по операторах» report tab for the Reports page (migrated Metabase
 * Card 102): one row per OPERATOR — the chain runs they first touched in the
 * period, the money they took promises for, the money that was DUE in the
 * period, the money that arrived, and the conversion between the last two.
 *
 * The three windows are INDEPENDENT and all cut by the same date pair, which is
 * why both bounds are required and no bound is optional here (unlike the
 * sibling feeds): there is nothing to leave open. The default window is
 * today–today in the user's profile timezone — the same default the
 * Techno-Finance «Обещания» panel applies (`defaultRange()` there returns
 * `from = to = today`), and the same default the sibling processing tab uses,
 * so the two systems open on the same period.
 *
 * There is NO pagination: the endpoint returns the whole roster (~136 rows for
 * a month on production, one per operator) precisely so a frontend can render
 * it in full and group it into its own department tabs. This tab is therefore
 * NOT built on the paged-feed shell the four feed tabs share — it has no page,
 * no page size and no clamp/self-heal; what it borrows from them is the URL
 * date sync and the error ladder.
 *
 * Department sub-tabs filter the SINGLE response client-side — one request
 * serves the whole strip, as in Techno-Finance. The backend applies no
 * department filter at all, on purpose: the departments Techno-Finance drops on
 * its frontend (Юристи, Аналітики, no department) held ≈ 631 000 ₴ of July 2026
 * collections. Here «Всі» shows them all, and every department beyond the fixed
 * triple additionally gets a tab of its own, built from the response and keyed
 * by `department_id` — see utils/departmentTabs.ts for the two halves of the
 * strip and for what a renamed department looks like on screen.
 *
 * All tab state the user set lives in the URL (`?opf=`, `?opt=`, `?opd=`) so it
 * survives refresh, bookmarking and switching between the page tabs (panels
 * unmount on switch). Filter updates use `replace` — only page-tab changes
 * create history entries. A fourth key, `?opu=`, is READ but never set here:
 * it is the operator the recorded payments tab (card 76) linked to by
 * `user_id`, and this tab answers it by highlighting and scrolling to that
 * row (never by filtering — the roster stays whole).
 *
 * The URL keys are deliberately NEW — the host page keeps every tab's params in
 * the URL, so this tab must not collide with any sibling's. Every tab's set is
 * declared in the page-wide registry (`src/lib/reportsUrlKeys.ts`), whose test
 * keeps the namespace collision-free; a shared key would silently transplant
 * one tab's filter into another.
 */

import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import {
  SegmentedTabs,
  segmentedTabId,
  segmentedTabPanelId,
  type SegmentedTabItem,
} from '@/components/ui/SegmentedTabs'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { useDateWindowFilters, useFeedErrorMessage } from '@/hooks'
import { formatPickerDateAsYMD, getDateStringInTimezone } from '@/lib/dateUtils'
import { Icons } from '@/lib/icons'
import { isWindowTooLong } from '@/lib/reportWindow'
import { REPORTS_URL_KEYS } from '@/lib/reportsUrlKeys'
import { useAuthStore } from '@/stores/authStore'
import { useOperatorPromisesReport } from '../hooks'
import {
  DEFAULT_OPERATOR_PROMISES_TAB,
  OPERATOR_PROMISES_FIXED_TAB_IDS,
  collectDynamicDepartmentTabs,
  filterRowsByTab,
  resolveOperatorPromisesTab,
  type OperatorPromisesTabId,
} from '../utils/departmentTabs'
import { sumOperatorPromisesRows } from '../utils/totals'
import { linkedOperatorNotice } from '../utils/linkedOperatorNotice'
import { operatorPromisesRowAnchorId } from '../utils/rowAnchor'
import { OPERATOR_PROMISES_COLUMN_COUNT, OperatorPromisesTable } from './OperatorPromisesTable'
import { OperatorPromisesTotals } from './OperatorPromisesTotals'

/**
 * This tab's slice of the Reports page URL namespace (see the registry).
 * "opf"/"opt" = Operator-Promises From/To; "opd" = Operator-Promises
 * Department sub-tab.
 */
const {
  dateFrom: DATE_FROM_KEY,
  dateTo: DATE_TO_KEY,
  department: DEPARTMENT_KEY,
  user: USER_KEY,
} = REPORTS_URL_KEYS.operatorPromises

/**
 * The linked operator (`?opu=`), or null. A positive int32 only — the same
 * shape the row's `user_id` has; anything else reads as "no link" rather than
 * as a complaint, because nothing on this tab writes the key: it arrives
 * from the recorded payments tab's operator link, and a malformed one is a
 * hand-edited URL with nothing to act on.
 */
function readLinkedUserId(raw: string | null): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null
  const id = Number(raw)
  return id >= 1 && id <= 2_147_483_647 ? id : null
}

const TABS_ID_PREFIX = 'operator-promises'

/** This tab's wording for the two window complaints (see `useDateWindowFilters`). */
const WINDOW_ERROR_KEYS = {
  invalidDate: 'pages.reports.operatorPromises.invalidDate',
  invertedRange: 'pages.reports.operatorPromises.invalidRange',
} as const

/** The backend's 366-day DIFFERENCE cap, mirrored — predicate and sentence together. */
const WINDOW_CAP = {
  isTooLong: isWindowTooLong,
  messageKey: 'pages.reports.operatorPromises.rangeTooLong',
} as const

export function OperatorPromisesTab() {
  const { t, i18n } = useTranslation('common')
  // Orders the dynamic department tabs in the reader's own alphabet.
  const language = i18n.language
  const [searchParams, setSearchParams] = useSearchParams()

  // Same project resolution as the Reports dashboard: active project first,
  // then the first assigned project, then 1.
  const user = useAuthStore((state) => state.user)
  const projectId: number = Number(user?.active_project_id ?? user?.projects?.[0]?.id ?? 1)
  const userTimezone = user?.timezone

  // One function resolves "today" for the default window; a PICKED date goes
  // through formatPickerDateAsYMD below. The profile timezone therefore decides
  // only which calendar day "now" is, and then travels to the backend, where it
  // cuts the PROMISED-date window (and nothing else).
  const today = getDateStringInTimezone(new Date(), userTimezone)

  // The shared window reader: both bounds, what is wrong with them, and the
  // verdict that gates the request. An ABSENT key is the default (today); only
  // an explicitly bad one stays undefined and blocks the request.
  const { dateFrom, dateTo, isFromInvalid, isToInvalid, dateError, rangeError, hasWindowError } =
    useDateWindowFilters({
      searchParams,
      fromKey: DATE_FROM_KEY,
      toKey: DATE_TO_KEY,
      fallbackFrom: today,
      fallbackTo: today,
      cap: WINDOW_CAP,
      keys: WINDOW_ERROR_KEYS,
    })

  // The window is this tab's only filter — the department sub-tab filters an
  // already-fetched response and cannot be wrong.
  const hasFilterError = hasWindowError

  // Filter updates never create history entries (page-tab switches do). The
  // simple functional form is enough here: nothing in this tab emits two URL
  // updates in the same tick (that is the paged feeds' problem — the shared
  // Pagination fires onPageSizeChange and onPageChange back to back, which is
  // why they compose through a ref). Dates and the department sub-tab are
  // separate user actions and land in separate commits.
  const setUrlParam = (key: string, value: string | null) => {
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

  // Timezone policy: a PICKED date is already a calendar day — the picker hands
  // us a local-midnight Date whose local Y/M/D are exactly the cell the user
  // clicked, so we read them back verbatim. Re-rendering that instant in the
  // profile timezone would shift the day whenever the browser-vs-profile offset
  // spans midnight (IANA offsets span 26 h, so a noon anchor doesn't save it).
  const handleDateChange =
    (key: typeof DATE_FROM_KEY | typeof DATE_TO_KEY) =>
    ({ value }: { value: Date | null }) => {
      // A cleared manual input is not a filter change: the URL keeps the old
      // value and a valid date commits once the user finishes retyping
      // (DateSelect itself resyncs the abandoned text on blur). There is no "×"
      // on these fields — both bounds are REQUIRED, so an empty window is not a
      // state this report has.
      if (value) setUrlParam(key, formatPickerDateAsYMD(value))
    }

  const query = useOperatorPromisesReport({
    projectId,
    // The fallbacks are never sent: a missing bound can only come from an
    // invalid URL value, which is exactly what sets `hasFilterError` and
    // disables the query.
    dateFrom: dateFrom ?? today,
    dateTo: dateTo ?? today,
    timezone: userTimezone,
    enabled: !hasFilterError,
  })

  // Stable identity for the empty fallback — a fresh `[]` every render would
  // defeat the memos below and OperatorPromisesTable's own.
  const rows = useMemo(() => query.data?.rows ?? [], [query.data])

  // The dynamic half of the strip comes from the response itself, so it exists
  // only once the rows do — which is exactly why `resolveOperatorPromisesTab`
  // must not write its fallback back into the URL: `?opd=d17` reads as «Всі»
  // while the request is in flight and snaps to its tab when the rows land.
  const dynamicTabs = useMemo(() => collectDynamicDepartmentTabs(rows, language), [rows, language])

  const activeTab: OperatorPromisesTabId = resolveOperatorPromisesTab(
    searchParams.get(DEPARTMENT_KEY),
    dynamicTabs
  )

  // Fixed triple first (aggregate → ТП → Дайлер → Стягнення), then one tab per
  // remaining department of the response, alphabetically. The fixed labels are
  // TRANSLATED; a dynamic one is the department's own live name, which no
  // locale file can know — so its length is unbounded too.
  //
  // A long name is NOT truncated. What made the strip overflow the page was the
  // number of tabs, and `flex-wrap` (below) already answers that: a wide tab
  // simply takes a row of its own. Capping it as well would ellipsize a name
  // that had room to render, leaving the reader to hover for a word the layout
  // could have shown them — worse for touch and for anyone reading a screen at
  // 200 %. `title` stays as pure redundancy (a native tooltip on hover); the
  // accessible name is the full label either way.
  const tabItems: SegmentedTabItem<OperatorPromisesTabId>[] = useMemo(
    () => [
      ...OPERATOR_PROMISES_FIXED_TAB_IDS.map((id) => ({
        id,
        label: t(`pages.reports.operatorPromises.subtabs.${id}`),
      })),
      ...dynamicTabs.map((tab) => ({
        id: tab.id,
        label: tab.label,
        title: tab.label,
      })),
    ],
    [dynamicTabs, t]
  )

  // The heading of the totals block's "visible" column. Falling back to the
  // default tab's label is unreachable (`activeTab` always names an item) and
  // is here so the heading can never render as `undefined`.
  const activeTabLabel =
    tabItems.find((item) => item.id === activeTab)?.label ??
    t(`pages.reports.operatorPromises.subtabs.${DEFAULT_OPERATOR_PROMISES_TAB}`)

  const visibleRows = useMemo(() => filterRowsByTab(rows, activeTab), [rows, activeTab])

  // The operator a sibling tab linked to (the recorded payments tab, by
  // `user_id`, with the same window). Their row is highlighted and scrolled
  // into view once the rows are on screen — the roster is whole and unpaged,
  // so there is nothing to request; the link only has to be FOUND. The
  // notice tells three cases apart (utils/linkedOperatorNotice.ts): the row
  // is on screen; the row EXISTS but the department sub-tab hides it (the
  // link never writes `opd`, but a click on a sub-tab keeps `opu`); the
  // period has no row for them at all. Only the last one may say "no rows".
  const linkedUserId = readLinkedUserId(searchParams.get(USER_KEY))
  const linkedRow = useMemo(
    () =>
      linkedUserId === null ? null : (rows.find((row) => row.user_id === linkedUserId) ?? null),
    [rows, linkedUserId]
  )
  const isLinkedRowVisible =
    linkedRow !== null && visibleRows.some((row) => row.user_id === linkedUserId)
  const linkedNotice =
    linkedUserId === null ? null : linkedOperatorNotice(linkedUserId, linkedRow, isLinkedRowVisible)
  useEffect(() => {
    if (linkedUserId === null || !isLinkedRowVisible) return
    document
      .getElementById(operatorPromisesRowAnchorId(linkedUserId))
      ?.scrollIntoView({ block: 'center' })
  }, [linkedUserId, isLinkedRowVisible])
  const visibleTotals = useMemo(() => sumOperatorPromisesRows(visibleRows), [visibleRows])

  // "The period produced rows, but none of them belong to this tab" — a
  // different fact from "the period produced nothing". In practice this is a
  // FIXED tab's message: a dynamic tab exists only because a row carries its
  // `department_id`, and «Всі» does not filter at all. It is what a renamed
  // department leaves behind on its old fixed tab, next to the new tab that now
  // holds the rows (see utils/departmentTabs.ts).
  const hasUnmatchedRows = rows.length > 0 && visibleRows.length === 0

  // keepPreviousData shows the previous window's rows while a new one loads —
  // they must not look final, hence the busy overlay. Placeholder only: a
  // background refetch of the SAME window shows current data and needs none.
  const isRefreshing = query.isPlaceholderData

  // The shared failure ladder (see the hook for the rungs and their order).
  // What is this endpoint's own: three 503s — the payment-service down, the
  // auth-service directory down, and the two lookups together blowing the
  // fan-out deadline — none of which may degrade to a partial report, since
  // without the directory rows cannot be named, grouped or sorted, and without
  // the payment data a working operator reads as one who collected nothing.
  // Its 400 detail names an inverted window, > 367 days, a date outside
  // 1900-01-01..9998-12-31, or an unknown IANA zone.
  const { errorMessage, errorDetail, isForbidden } = useFeedErrorMessage(
    query.error,
    'operatorPromises'
  )

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Both bounds are REQUIRED — neither may be left empty, so there is no
          "×" on either field; the window simply defaults to today–today.

          NEITHER picker is bounded by the other (no `min`/`max`), on purpose.
          A mutual bound does not deaden a calendar; what it does is impose an
          ORDER nothing on screen states. With the today–today default,
          `max={dateTo}` would leave «з» open on every day up to today and
          `min={dateFrom}` would leave «по» open on every day from today — so
          the common request "give me last month" is reachable only by moving
          «з» first. Reach for «по» first and the whole past is greyed out,
          with nothing saying why or which field to touch instead. (DateSelect
          adds no bounds of its own: `minDate`/`maxDate` reach react-datepicker
          only from these props, so passing none leaves both calendars fully
          open.)

          What actually protects the API is the guard above (`isInverted` →
          the pair-level alert, no request), which is needed regardless: manual
          input and hand-edited URLs bypass picker bounds anyway. So an
          inverted window can be PICKED, and it is answered in words instead of
          by a calendar the user cannot get past.

          This is the rule for every date pair WITH A DEFAULTED WINDOW on the
          Reports page (this tab, processing, searcher). The two feeds whose
          bounds start empty and optional keep their mutual picker bounds —
          without a default there is no order trap to remove. */}
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl p-4 shadow-sm sm:gap-4">
        <DateSelect
          label={t('pages.reports.operatorPromises.dateFrom')}
          value={dateFrom ?? null}
          // Only the bound that actually carries the unusable value is marked.
          // `error` (not `invalidText`) is the right prop: the value arrives
          // already committed, from the URL, not as half-typed text.
          error={isFromInvalid ? dateError : undefined}
          onChange={handleDateChange(DATE_FROM_KEY)}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <DateSelect
          label={t('pages.reports.operatorPromises.dateTo')}
          value={dateTo ?? null}
          error={isToInvalid ? dateError : undefined}
          onChange={handleDateChange(DATE_TO_KEY)}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        {/* Pair-level only: a bad single date rides its own field above.
            Neither bound is wrong on its own in an inverted or oversized
            window, so this one has no field to sit on. */}
        {rangeError && (
          <p className="text-error-500 w-full text-xs font-medium" role="alert">
            {rangeError}
          </p>
        )}
      </div>

      {/* Department sub-tabs: the fixed triple, always present, then one tab
          per remaining department of the response. Switching is pure
          client-side filtering of an already-fetched response — cheap, so
          selection follows focus (`activation` default) per the ARIA APG rule
          the host page's own expensive strip deliberately opts out of. */}
      <SegmentedTabs<OperatorPromisesTabId>
        items={tabItems}
        // The dynamic half makes the strip unbounded in length (one tab per
        // department the directory grows), and the segmented variant neither
        // wraps nor scrolls on its own — without this the strip overflows the
        // page sideways once enough departments report rows.
        className="flex-wrap"
        value={activeTab}
        onChange={(tabId) =>
          // The default tab is the ABSENCE of the key, never a spelled-out
          // `opd=all`: a shared link then carries only choices somebody made.
          setUrlParam(DEPARTMENT_KEY, tabId === DEFAULT_OPERATOR_PROMISES_TAB ? null : tabId)
        }
        ariaLabel={t('pages.reports.tabs.operator-promises')}
        idPrefix={TABS_ID_PREFIX}
      />

      {/* Content: an invalid window shows only the hints above */}
      <div
        role="tabpanel"
        id={segmentedTabPanelId(TABS_ID_PREFIX, activeTab)}
        aria-labelledby={segmentedTabId(TABS_ID_PREFIX, activeTab)}
        // This panel holds only the totals block and the table — no focusable
        // content — so per ARIA APG the panel itself must be keyboard-reachable
        // (same as the sibling processing tab, and unlike the host page's
        // panels, which are full of controls).
        tabIndex={0}
        className="flex w-full flex-col gap-4"
      >
        {hasFilterError ? null : query.isLoading ? (
          // The skeleton mirrors the real table's width — the count comes from
          // OperatorPromisesTable so the two cannot drift apart.
          <TableSkeleton columns={OPERATOR_PROMISES_COLUMN_COUNT} rows={6} />
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
                {t('pages.reports.operatorPromises.error.retry')}
              </Button>
            )}
          </div>
        ) : query.data ? (
          <div
            className="relative flex w-full flex-col gap-4"
            aria-busy={isRefreshing || undefined}
          >
            {linkedNotice && (
              <p
                role="status"
                data-testid="operator-promises-linked-operator"
                data-notice={linkedNotice.key}
                className="text-foreground bg-information-50 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
              >
                <span>
                  {t(`pages.reports.operatorPromises.${linkedNotice.key}`, linkedNotice.params)}
                </span>
                {/* Dropping the key is the only thing this tab ever writes to
                    it; the window it arrived with stays. */}
                <button
                  type="button"
                  onClick={() => setUrlParam(USER_KEY, null)}
                  className="text-information-700 hover:underline"
                >
                  {t('pages.reports.operatorPromises.clearHighlight')}
                </button>
              </p>
            )}
            <OperatorPromisesTotals
              visible={visibleTotals}
              overall={query.data.totals}
              visibleLabel={activeTabLabel}
              generatedAt={query.data.generated_at}
              // Same profile zone that travelled to the API and cut the window,
              // so the stamp reads in the report's own clock rather than the
              // browser's.
              timezone={userTimezone}
            />
            {/* Two different silences, told apart. A genuinely empty answer is
                a normal 200 — nobody worked the period — and gets the calm
                "no data for the period". An answer that HAS rows none of which
                match this tab is a different fact, and saying "no data for the
                period" there would be false: the period has data, this tab
                just cannot see it. It is also what a renamed department leaves
                on its fixed tab, which is why the message points at «Всі»,
                where the rows certainly are — the tab that now HOLDS them is
                right there in the strip too (utils/departmentTabs.ts). */}
            <OperatorPromisesTable
              rows={visibleRows}
              highlightedUserId={linkedUserId}
              emptyMessage={t(
                hasUnmatchedRows
                  ? 'pages.reports.operatorPromises.emptyDepartment'
                  : 'pages.reports.operatorPromises.empty'
              )}
            />
            {isRefreshing && (
              <div
                data-testid="operator-promises-refreshing"
                className="bg-card/60 absolute inset-0 z-10 flex items-center justify-center rounded-xl"
              >
                <Icons.Spinner className="h-8 w-8" />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
