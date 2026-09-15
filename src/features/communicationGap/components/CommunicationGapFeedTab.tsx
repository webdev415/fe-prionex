/**
 * CommunicationGapFeedTab Component
 *
 * «Великий розрив» feed tab for the Reports page: a WORK LIST of clients in
 * work who carry an active debt and whom nobody has reached lately — no fresh
 * interaction, no payment in the last 30 days and no live promise to pay. One
 * row = one client, and the key metric is `communication_gap`, the days of
 * silence (the SMALLER of "since assignment" and "since the last interaction",
 * so a freshly reassigned client is not blamed on its new owner).
 *
 * All filter state and the current page live in the URL (`?gf=`, `?gt=`,
 * `?gm=`, `?gpg=`, `?gps=`) so they survive refresh, bookmarking and switching
 * between the page tabs (panels unmount on switch). Filter updates use
 * `replace` — only page-tab changes create history entries. The URL shell —
 * composed updates, page/page-size parsing, the page clamp and its self-heal —
 * is the shared `useUrlPagedFeedFilters`; the keys are this tab's set in the
 * page-wide registry (`src/lib/reportsUrlKeys.ts`), deliberately NEW so no
 * sibling tab's filter is silently transplanted into this one (in particular
 * the sibling feeds own `pg`/`ps` and `spg`/`sps`, which is why paging here is
 * `gpg`/`gps`).
 *
 * There is NO default window: both sell bounds start EMPTY and are INDEPENDENT
 * (the card's two separate Metabase `[[…]]` blocks — either may be set alone,
 * which the backend accepts as an open-ended bound). Card 125 and its
 * Techno-Finance usage both default to the WHOLE population, unlike the
 * searcher tab's today–today, so there is no "today" to seed, pin or roll over
 * at midnight here. The bounds can only NARROW the feed, which is also why
 * there is no 366-day window cap to mirror: the backend caps nothing here —
 * what bounds an oversized population is the candidate cap, and that answers
 * 400 with "request a narrower sell window", passed straight through below.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import {
  useDateWindowFilters,
  useFeedErrorMessage,
  usePagedFeedPages,
  useUrlPagedFeedFilters,
} from '@/hooks'
import { Icons } from '@/lib/icons'
import { REPORTS_URL_KEYS } from '@/lib/reportsUrlKeys'
import { useAuthStore } from '@/stores/authStore'
import { useCommunicationGapFeed } from '../hooks'
import { GAP_MIN_CEILING, parseGapMin } from '../utils/gapMin'
import { COMMUNICATION_GAP_COLUMN_COUNT, CommunicationGapTable } from './CommunicationGapTable'

/**
 * This tab's slice of the Reports page URL namespace (see the registry).
 * "gf"/"gt" = Gap-tab sell From/To; "gm" = Gap Min; "gpg"/"gps" = Gap PaGe /
 * Page Size.
 */
const {
  sellFrom: SELL_FROM_KEY,
  sellTo: SELL_TO_KEY,
  gapMin: GAP_MIN_KEY,
  page: PAGE_KEY,
  pageSize: PAGE_SIZE_KEY,
} = REPORTS_URL_KEYS.communicationGap

/**
 * The keys this tab may write as FILTERS — handed to the shell so a misspelled
 * key is a compile error rather than a value written under a name nothing
 * reads (or, worse, one a sibling tab owns). The paging keys are the shell's
 * own and are configured, not passed per call.
 */
type FilterKey = typeof SELL_FROM_KEY | typeof SELL_TO_KEY | typeof GAP_MIN_KEY

/**
 * This tab's wording for the two window complaints (see `useDateWindowFilters`).
 * The sell window's keys are NOT spelled like the other report tabs' — the
 * section has always named them `invalidSell*`, which is why the hook takes
 * whole keys instead of a prefix.
 */
const SELL_WINDOW_ERROR_KEYS = {
  invalidDate: 'pages.reports.communicationGap.invalidSellDate',
  invertedRange: 'pages.reports.communicationGap.invalidSellRange',
} as const

export function CommunicationGapFeedTab() {
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
  // not "today" (the card's own default is the whole population — see the
  // module comment), and either may be set alone, which the backend accepts as
  // an open-ended bound. NO `cap` either: the bounds can only NARROW the feed,
  // so the backend caps nothing here — what bounds an oversized population is
  // the candidate cap — and the suite pins that a window wider than the
  // sibling reports' 366 days does go out.
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

  const rawGapMin = searchParams.get(GAP_MIN_KEY) ?? ''

  // Whatever the field or a hand-edited URL carries is validated here and gets
  // an inline hint rather than the 422 the backend would answer with.
  const gapMin = parseGapMin(rawGapMin)

  const handleDateChange = (key: FilterKey) => filters.dateFilterHandler(key)

  // The numeric filter is committed on blur/Enter rather than per keystroke:
  // this endpoint enriches and sorts the whole candidate population (tens of
  // thousands of rows without a sell window, see
  // docs/communication-gap-feed.md), so typing "10" must not fire two of them.
  // Same shape as DateSelect's manual input, which also commits a finished
  // value and resyncs otherwise, and as the sibling feed's verification cap.
  const [gapMinText, setGapMinText] = useState(rawGapMin)
  useEffect(() => {
    // Resync when the URL changes from the outside (Back/Forward, a shared link).
    setGapMinText(rawGapMin)
  }, [rawGapMin])

  const commitGapMin = () => {
    const trimmed = gapMinText.trim()
    const parsed = parseGapMin(trimmed)
    // A USABLE value is committed canonically: "007" passes the digits rule, so
    // the raw text would leave the URL and the field reading "007" while the
    // request carries 7 — one filter spelled three ways, and a bookmarked link
    // that renders differently from what was actually sent. An INVALID string is
    // committed verbatim instead: the inline hint has to keep pointing at what
    // the user typed, not at a value nobody entered.
    const next = trimmed === '' ? null : parsed.isInvalid ? trimmed : String(parsed.value)
    // Nothing to commit when the field already agrees with the URL — a bare
    // focus/blur must not reset the page. Compared AFTER canonicalization, so
    // retyping "007" over a committed `gm=7` is the no-op it looks like...
    if ((next ?? '') === rawGapMin) {
      // ...though the field still snaps back to the canonical spelling: with no
      // URL change there is no resync effect to do it.
      setGapMinText(rawGapMin)
      return
    }
    setFilterParam(GAP_MIN_KEY, next)
  }

  // A bad minimum belongs to ONE field, so it rides that field's `error` prop:
  // the red border, `aria-invalid` and `aria-describedby` all land on the
  // offending input, and a screen reader reaches the explanation from the field
  // itself. (The sell window's own two messages are split along the same line
  // by the shared hook — a bad bound on its field, an inverted pair as a
  // standalone alert, because neither bound is wrong on its own there.)
  const gapMinError = gapMin.isInvalid
    ? t(
        // The two refusals get different sentences: a value past the backend's
        // int32 ceiling IS "a whole number of 0 or more", so that hint would
        // describe everything except the actual violation.
        gapMin.isTooLarge
          ? 'pages.reports.communicationGap.gapMinTooLarge'
          : 'pages.reports.communicationGap.invalidGapMin',
        // The ceiling is INTERPOLATED, never spelled out in the locale files:
        // the number the hint quotes and the number the parser enforces are the
        // same constant, so a backend bound change cannot leave two translations
        // quoting a limit that no longer exists.
        { max: GAP_MIN_CEILING }
      )
    : undefined

  // The window is not this tab's only filter, which is exactly why the hook
  // names its verdict for the WINDOW: `enabled: !hasWindowError` would let a
  // bad numeric filter reach the backend for a 422.
  const hasFilterError = hasWindowError || gapMin.isInvalid

  const query = useCommunicationGapFeed({
    projectId,
    sellFrom,
    sellTo,
    gapMin: gapMin.value,
    skip: filters.skip,
    limit: pageSize,
    timezone: userTimezone,
    enabled: !hasFilterError,
  })

  // Stable identity for the empty fallback — a fresh `[]` every render would
  // defeat CommunicationGapTable's useMemo over its rows prop.
  const rows = useMemo(() => query.data?.rows ?? [], [query.data])

  // Totals, the display clamp for a bookmarked page the drained feed no longer
  // has, and the URL self-heal that follows the answer — shared shell.
  const { total, totalPages, clampedPage } = usePagedFeedPages(filters, query.data)

  // keepPreviousData shows the previous page's rows while a new one loads —
  // they must not look final, hence the busy overlay. Placeholder only: a
  // background refetch of the SAME page shows current data and needs none.
  const isRefreshing = query.isPlaceholderData

  // The shared failure ladder (see the hook for the rungs and their order).
  // What is this endpoint's own: three 503s — the auth-service directory down,
  // the payment-service down, and the two lookups together blowing the fan-out
  // deadline — none of which may degrade to a partial feed, since without the
  // directory the department gate disappears and without the payment data a
  // client who paid yesterday lands back in a call list. Its 400 detail names
  // the failing date/timezone or asks for a narrower sell window when the
  // candidate cap is hit.
  //
  // `errorDetail` is DELIBERATELY NOT TAKEN: each 503 has its own server
  // sentence, but the operator's move is the same in all three and the wording
  // is aimed at whoever runs the services. Same call as the sibling contact-tag
  // feed, which explains it at length.
  const { errorMessage, isForbidden } = useFeedErrorMessage(query.error, 'communicationGap')

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Filters: an optional, independent sell window + the optional gap floor */}
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl p-4 shadow-sm sm:gap-4">
        <DateSelect
          label={t('pages.reports.communicationGap.sellFrom')}
          value={sellFrom ?? null}
          // Bounded by the other end only when it exists — an open-ended
          // single bound must stay unconstrained.
          max={sellTo}
          // Only the bound that actually carries the unusable value is marked.
          error={isSellFromInvalid ? sellDateError : undefined}
          onChange={handleDateChange(SELL_FROM_KEY)}
          onClear={() => setFilterParam(SELL_FROM_KEY, null)}
          // Three "×" buttons stand side by side in this row — DateSelect's
          // default "Clear" name would be identical for all of them.
          clearLabel={t('pages.reports.communicationGap.clearSellFrom')}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <DateSelect
          label={t('pages.reports.communicationGap.sellTo')}
          value={sellTo ?? null}
          min={sellFrom}
          error={isSellToInvalid ? sellDateError : undefined}
          onChange={handleDateChange(SELL_TO_KEY)}
          onClear={() => setFilterParam(SELL_TO_KEY, null)}
          clearLabel={t('pages.reports.communicationGap.clearSellTo')}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <div className="w-full min-w-0 sm:w-44">
          <Input
            // Deliberately NOT type="number": the browser blanks a numeric
            // input whose value is not a number, so a `?gm=abc` would point its
            // "must be a whole number" hint at a field that LOOKS empty. A text
            // input shows the offending value back to the user; the numeric
            // keypad still comes up on touch, and the rule itself lives in
            // parseGapMin (which the URL bypasses anyway).
            type="text"
            inputMode="numeric"
            label={t('pages.reports.communicationGap.gapMin')}
            placeholder={t('pages.reports.communicationGap.gapMinPlaceholder')}
            error={gapMinError}
            value={gapMinText}
            onChange={(event) => setGapMinText(event.target.value)}
            onBlur={commitGapMin}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitGapMin()
            }}
            onClear={() => {
              setGapMinText('')
              setFilterParam(GAP_MIN_KEY, null)
            }}
            // This "×" stands in a row with the two date "×" buttons —
            // Input's default "Clear" name would be identical for all three.
            clearLabel={t('pages.reports.communicationGap.clearGapMin')}
          />
        </div>

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
        // CommunicationGapTable so the two cannot drift apart.
        <TableSkeleton columns={COMMUNICATION_GAP_COLUMN_COUNT} rows={6} />
      ) : query.isError ? (
        <div className="border-border bg-card flex w-full flex-col items-center justify-center gap-4 rounded-xl border p-8">
          <Icons.Warning size={40} className="text-error-500" />
          <p className="text-foreground text-center text-sm font-medium">{errorMessage}</p>
          {/* Retrying cannot fix missing permissions — no button on 403 */}
          {!isForbidden && (
            <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
              {t('pages.reports.communicationGap.error.retry')}
            </Button>
          )}
        </div>
      ) : (
        <div className="relative w-full" aria-busy={isRefreshing || undefined}>
          {/* An empty answer is a normal 200: a narrow sell window, or a
              minimum above the feed's own worst gap, legitimately holds no
              rows — hence a calm message, not an error state. */}
          <CommunicationGapTable
            rows={rows}
            emptyMessage={t('pages.reports.communicationGap.empty')}
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
              data-testid="communication-gap-refreshing"
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
