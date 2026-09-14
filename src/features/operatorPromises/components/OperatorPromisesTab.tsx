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
 * create history entries.
 *
 * The URL keys are deliberately NEW — the host page keeps every tab's params in
 * the URL, so this tab must not collide with any sibling's. Every tab's set is
 * declared in the page-wide registry (`src/lib/reportsUrlKeys.ts`), whose test
 * keeps the namespace collision-free; a shared key would silently transplant
 * one tab's filter into another.
 */

import { useMemo } from 'react'
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
import { isTransientFailure } from '@/lib/api'
import { isRealCalendarDate } from '@/lib/calendarDate'
import { formatPickerDateAsYMD, getDateStringInTimezone } from '@/lib/dateUtils'
import { getErrorMessage, getErrorStatus, hasResponseDetail } from '@/lib/errors'
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
} = REPORTS_URL_KEYS.operatorPromises

const TABS_ID_PREFIX = 'operator-promises'

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
  const rawFrom = searchParams.get(DATE_FROM_KEY)
  const rawTo = searchParams.get(DATE_TO_KEY)

  // A present-but-unusable bound is NOT silently replaced with today: the URL
  // would then disagree with both the field and the request, and a shape-only
  // check would let an impossible day like `?opf=2026-02-31` through to the API
  // (every comparison against NaN is false, so a range guard would pass
  // silently). It goes down the same path as an inverted window — inline hint,
  // no request — tracked per bound so the hint sits on the offending field.
  const isFromInvalid = !!rawFrom && !isRealCalendarDate(rawFrom)
  const isToInvalid = !!rawTo && !isRealCalendarDate(rawTo)

  // An ABSENT key is the default (today); only an explicitly bad one is undefined.
  const dateFrom = rawFrom ? (isFromInvalid ? undefined : rawFrom) : today
  const dateTo = rawTo ? (isToInvalid ? undefined : rawTo) : today

  // The only guard against an inverted or oversized window: the pickers
  // deliberately do not bound each other (see the fields below), and manual
  // input and hand-edited URLs would bypass such bounds anyway. ISO YYYY-MM-DD
  // strings compare correctly as strings.
  const isInverted = !!dateFrom && !!dateTo && dateFrom > dateTo
  const isTooLong = !!dateFrom && !!dateTo && !isInverted && isWindowTooLong(dateFrom, dateTo)

  const hasFilterError = isFromInvalid || isToInvalid || isInverted || isTooLong

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

  const dateError = t('pages.reports.operatorPromises.invalidDate')
  const rangeErrorKey = isInverted
    ? 'pages.reports.operatorPromises.invalidRange'
    : isTooLong
      ? 'pages.reports.operatorPromises.rangeTooLong'
      : null

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

  const errorStatus = getErrorStatus(query.error)
  const isForbidden = errorStatus === 403
  const isUnavailable = isTransientFailure(query.error)
  const errorMessage = isUnavailable
    ? // Covers all three of the endpoint's own 503s — the payment-service being
      // down, the auth-service directory being down, and the two lookups
      // together blowing the fan-out deadline. The operator's move is the same
      // in all three (wait and retry), and none may degrade to a partial
      // report: without the directory rows cannot be named, grouped or sorted,
      // and without the payment data a working operator reads as one who
      // collected nothing.
      t('pages.reports.operatorPromises.unavailable')
    : isForbidden
      ? t('pages.reports.operatorPromises.forbidden')
      : // Backend date/timezone validation answers 400 with a human-readable
        // detail (inverted window, > 367 days, a date outside
        // 1900-01-01..9998-12-31, an unknown IANA zone). Passing it through
        // verbatim is what makes the refusal actionable. Only when the answer
        // HAS a detail, though: a 400 whose body never arrived would otherwise
        // show axios' own untranslated "Request failed with status code 400"
        // (see hasResponseDetail), so it joins every other unexplained failure
        // under the localized generic title.
        errorStatus === 400 && hasResponseDetail(query.error)
        ? getErrorMessage(query.error)
        : t('pages.reports.operatorPromises.error.title')

  // The three 503s are worded distinctly by the backend on purpose — the
  // remedies differ and monitoring must tell an outage from a timeout — so the
  // server's own sentence is shown UNDER the localized one rather than instead
  // of it: the operator reads their language, and whoever is asked "what does
  // it say?" can tell which dependency failed. Absent for a transport-level
  // failure (a 502/504 or a dropped connection carries no body).
  const errorDetail =
    isUnavailable && hasResponseDetail(query.error) ? getErrorMessage(query.error) : null

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
        {rangeErrorKey && (
          <p className="text-error-500 w-full text-xs font-medium" role="alert">
            {t(rangeErrorKey)}
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
