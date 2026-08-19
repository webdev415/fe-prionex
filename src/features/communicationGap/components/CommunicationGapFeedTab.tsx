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
 * `replace` — only page-tab changes create history entries.
 *
 * The URL keys are deliberately NEW: the host page keeps every tab's params in
 * the URL, so this tab must not collide with `?tab` (host), `?from/?to/?dept`
 * (processing), `?sf/?st/?cf/?ct` (verification), `?pf/?pt/?mv/?pg/?ps` (the
 * low-verification feed) or `?if/?it/?spg/?sps` (the searcher feed) — in
 * particular the two sibling feeds own `pg`/`ps` and `spg`/`sps`, which is why
 * paging here is `gpg`/`gps`. A shared key would silently transplant one tab's
 * filter into the other.
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { isTransientFailure } from '@/lib/api'
import { isRealCalendarDate } from '@/lib/calendarDate'
import { formatPickerDateAsYMD } from '@/lib/dateUtils'
import { getErrorMessage, getErrorStatus, isApiError } from '@/lib/errors'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import { useCommunicationGapFeed } from '../hooks'
import { parseGapMin } from '../utils/gapMin'
import { COMMUNICATION_GAP_COLUMN_COUNT, CommunicationGapTable } from './CommunicationGapTable'

/**
 * URL keys, distinct from every other tab of the host page — processing
 * (`from/to/dept`), verification (`sf/st/cf/ct`), the low-verification feed
 * (`pf/pt/mv/pg/ps`), the searcher feed (`if/it/spg/sps`) and the host's own
 * `tab`. "gf"/"gt" = Gap-tab sell From/To; "gm" = Gap Min; "gpg"/"gps" = Gap
 * PaGe / Page Size.
 */
const SELL_FROM_KEY = 'gf'
const SELL_TO_KEY = 'gt'
const GAP_MIN_KEY = 'gm'
const PAGE_KEY = 'gpg'
const PAGE_SIZE_KEY = 'gps'

type FilterKey = typeof SELL_FROM_KEY | typeof SELL_TO_KEY | typeof GAP_MIN_KEY

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
 * here stays inside the cap for every `?gps=` the user can switch to afterwards.
 */
const MAX_SKIP = 2_147_483_647
const MAX_PAGE = Math.floor(MAX_SKIP / Math.max(...PAGE_SIZE_OPTIONS)) + 1

/**
 * True when the failed response actually carries a message of the backend's own.
 *
 * `getErrorMessage` has no such thing as "nothing to say": with an empty or
 * body-less response it degrades to axios' own `error.message` — the
 * untranslated "Request failed with status code 400" — which is exactly what a
 * proxy that strips the body produces, and not a sentence to show an operator.
 * So the 400 branch below passes the detail through only when there IS one and
 * takes the localized generic title otherwise.
 *
 * The shapes checked are the ones `getErrorMessage` reads out of the BODY for a
 * FastAPI endpoint like this one: a bare string body, `detail` (string or the
 * validation array), and `message`. An empty string or an empty array is no
 * detail either: the empty string falls through to `message` and then to the
 * axios text, while an empty array makes `getErrorMessage` return its
 * hardcoded English "Validation error occurred" — both equally unfit to show,
 * so the helper treats both as "no detail".
 */
function hasResponseDetail(error: unknown): boolean {
  if (!isApiError(error)) return false
  const data = error.response?.data
  if (typeof data === 'string') return data.trim() !== ''
  if (!data || typeof data !== 'object') return false
  const record = data as Record<string, unknown>
  const detail = record.detail
  if (typeof detail === 'string') return detail.trim() !== ''
  if (Array.isArray(detail)) return detail.length > 0
  return typeof record.message === 'string' && record.message.trim() !== ''
}

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

export function CommunicationGapFeedTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()

  // Same project resolution as the Reports dashboard: active project first,
  // then the first assigned project, then 1.
  const user = useAuthStore((state) => state.user)
  const projectId: number = Number(user?.active_project_id ?? user?.projects?.[0]?.id ?? 1)
  const userTimezone = user?.timezone

  const rawSellFrom = searchParams.get(SELL_FROM_KEY)
  const rawSellTo = searchParams.get(SELL_TO_KEY)
  const rawGapMin = searchParams.get(GAP_MIN_KEY) ?? ''

  // A present-but-unusable bound is NOT silently replaced: the URL would then
  // disagree with both the field and the request. It goes down the same path
  // as an inverted range — inline hint, no request (below). Tracked per bound
  // so the hint can sit on the field that actually holds the bad value.
  const isSellFromInvalid = !!rawSellFrom && !isRealCalendarDate(rawSellFrom)
  const isSellToInvalid = !!rawSellTo && !isRealCalendarDate(rawSellTo)
  const hasInvalidSellDate = isSellFromInvalid || isSellToInvalid

  // No defaults: an unset bound means "no bound", not "today" (the card's own
  // default is the whole population — see the module comment).
  const sellFrom = rawSellFrom && isRealCalendarDate(rawSellFrom) ? rawSellFrom : undefined
  const sellTo = rawSellTo && isRealCalendarDate(rawSellTo) ? rawSellTo : undefined

  // Whatever the field or a hand-edited URL carries is validated here and gets
  // an inline hint rather than the 422 the backend would answer with.
  const gapMin = parseGapMin(rawGapMin)

  const pageSizeFromUrl = parsePositiveInt(searchParams.get(PAGE_SIZE_KEY), DEFAULT_PAGE_SIZE)
  // An unknown page size falls back silently (it is a view preference, not a
  // filter) — but it must never exceed the backend's `limit <= 500`.
  const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeFromUrl) ? pageSizeFromUrl : DEFAULT_PAGE_SIZE
  // A page whose offset would overflow the backend's int32 `skip` cap falls
  // back to 1 silently, exactly like an unknown page size: it can only come
  // from a hand-edited URL, and the 422 it would earn is nothing the user could
  // act on. No request is ever fired with an out-of-range offset.
  const page = parsePositiveInt(searchParams.get(PAGE_KEY), 1, MAX_PAGE)

  // The base every update builds on. It cannot be react-router's own `prev`:
  // the functional form of `setSearchParams` hands back a clone of the
  // RENDER-SCOPED params, so two updates fired in the SAME tick each start from
  // the pre-update URL and the last navigation silently drops the first one's
  // key. The shared Pagination emits exactly that pair — `onPageSizeChange`
  // immediately followed by `onPageChange(1)`. Keeping the composed value in a
  // ref makes such a sequence land as one coherent URL, while the effect below
  // resyncs it from the committed URL, so an update whose origin is elsewhere
  // (Back/Forward, a shared link, the ?gpg= self-heal) is never built on a stale
  // base either. The resync belongs in an effect rather than in render — it only
  // has to be back in step by the next commit, and by then a same-tick burst is
  // long over. (Precedent: LowVerificationFeedTab, review standards on
  // setSearchParams.)
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
  const setFilterParam = (key: FilterKey, value: string | null) =>
    setUrlParams({ [key]: value, [PAGE_KEY]: null })

  // Timezone policy: a PICKED date is already a calendar day — the picker hands
  // us a local-midnight Date whose local Y/M/D are exactly the cell the user
  // clicked, so we read them back verbatim with formatPickerDateAsYMD. The
  // profile timezone only travels to the backend, where it decides the
  // reference "today", the assignment/promise day cuts and the payment window.
  const handleDateChange =
    (key: FilterKey) =>
    ({ value }: { value: Date | null }) => {
      // A cleared manual input is not a filter change: the URL keeps the old
      // value and a valid date commits once the user finishes retyping
      // (DateSelect itself resyncs the abandoned text on blur). Removing a
      // bound is an explicit action — the "×" button.
      if (value) setFilterParam(key, formatPickerDateAsYMD(value))
    }

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

  // Manual input can bypass the pickers' min/max, so an inverted window must
  // not reach the API. ISO YYYY-MM-DD strings compare correctly as strings.
  // Only a FULLY specified window can be inverted — a single bound is a
  // legitimate open-ended filter (backend rule, same branch).
  const isSellInverted = !hasInvalidSellDate && !!sellFrom && !!sellTo && sellFrom > sellTo

  // Where a message is rendered follows WHAT it is about.
  //
  // A bad date or a bad minimum belongs to ONE field, so it rides that field's
  // `error` prop: the red border, `aria-invalid` and `aria-describedby` all land
  // on the offending input, and a screen reader reaches the explanation from the
  // field itself. `error` (not `invalidText`) is the right prop here —
  // `invalidText` only surfaces while DateSelect holds half-typed text of its
  // own, whereas these values arrive already committed, from the URL.
  //
  // An inverted window belongs to the PAIR — neither bound is wrong on its own —
  // so it stays a standalone alert under the filters, the way both sibling feeds
  // report their range errors.
  const sellDateError = hasInvalidSellDate
    ? t('pages.reports.communicationGap.invalidSellDate')
    : undefined
  const gapMinError = gapMin.isInvalid
    ? t('pages.reports.communicationGap.invalidGapMin')
    : undefined
  const sellRangeError = isSellInverted
    ? t('pages.reports.communicationGap.invalidSellRange')
    : undefined

  const hasFilterError = hasInvalidSellDate || isSellInverted || gapMin.isInvalid

  const query = useCommunicationGapFeed({
    projectId,
    sellFrom,
    sellTo,
    gapMin: gapMin.value,
    skip: (page - 1) * pageSize,
    limit: pageSize,
    timezone: userTimezone,
    enabled: !hasFilterError,
  })

  // Stable identity for the empty fallback — a fresh `[]` every render would
  // defeat CommunicationGapTable's useMemo over its rows prop.
  const rows = useMemo(() => query.data?.rows ?? [], [query.data])
  const total = query.data?.total ?? 0
  const totalPages = Math.max(1, query.data?.total_pages ?? 1)

  // The feed drains as operators work it, so a bookmarked `?gpg=` can outlive
  // the rows it pointed at. What the pager shows is the page that actually
  // exists — "Page 5 of 2" over an empty table, with Prev walking down one empty
  // page at a time, is not a state to render. A drained feed (`total === 0`)
  // keeps its calm empty state and shows no pager at all, so there is nothing to
  // clamp against.
  const clampedPage = total > 0 ? Math.min(page, totalPages) : page

  // ...and the URL follows the answer, so a refresh no longer re-requests the
  // dead offset. `replace` (via setUrlParams) — self-correction is not a
  // navigation step and must not stack history entries. Page 1 is the default,
  // hence the key is dropped rather than written.
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
    ? // Covers all three of the endpoint's own 503s — the auth-service
      // directory being down, the payment-service being down, and the two
      // lookups together blowing the fan-out deadline. Each has its own server
      // detail, but the operator's move is the same in all three (wait and
      // retry), and none may degrade to a partial feed: without the directory
      // the department gate disappears, without the payment data a client who
      // paid yesterday lands back in a call list.
      t('pages.reports.communicationGap.unavailable')
    : isForbidden
      ? t('pages.reports.communicationGap.forbidden')
      : // Backend date/timezone validation answers 400 with a human-readable
        // detail — and so does the candidate cap, whose detail asks for a
        // narrower sell window. Passing it through verbatim is what makes that
        // refusal actionable; a generic message would leave the operator with no
        // idea which knob to turn. Only when the answer HAS a detail, though: a
        // 400 whose body never arrived would otherwise show axios' own
        // untranslated "Request failed with status code 400" (see
        // hasResponseDetail), so it joins every other unexplained failure under
        // the localized generic title.
        errorStatus === 400 && hasResponseDetail(query.error)
        ? getErrorMessage(query.error)
        : t('pages.reports.communicationGap.error.title')

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
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageChange={(nextPage) =>
                // Page 1 is the default — keep it out of the URL.
                setUrlParams({ [PAGE_KEY]: nextPage <= 1 ? null : String(nextPage) })
              }
              onPageSizeChange={(nextSize) =>
                // A resized page invalidates the old offset, so the page goes
                // back to 1 in the SAME update — Pagination does emit its own
                // onPageChange(1) right after this, but a filter's worth of URL
                // state must not depend on a shared component's call order. The
                // default size is the absence of the key, never a spelled-out
                // `gps=50`.
                setUrlParams({
                  [PAGE_SIZE_KEY]: nextSize === DEFAULT_PAGE_SIZE ? null : String(nextSize),
                  [PAGE_KEY]: null,
                })
              }
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
