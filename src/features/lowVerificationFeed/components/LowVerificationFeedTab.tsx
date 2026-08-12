/**
 * LowVerificationFeedTab Component
 *
 * «Мало верифікацій» feed tab for the Reports page: a WORK LIST of freshly
 * purchased clients that still carry few verified third-party contacts — the
 * flip side of the per-operator verification KPI tab. One row = one client.
 *
 * All filter state and the current page live in the URL (`?pf=`, `?pt=`,
 * `?mv=`, `?pg=`, `?ps=`) so they survive refresh, bookmarking and switching
 * between the page tabs (panels unmount on switch). Filter updates use
 * `replace` — only page-tab changes create history entries.
 *
 * The URL keys are deliberately NOT the verification tab's `sf`/`st`: the host
 * page keeps every tab's params in the URL, and the two sell windows differ in
 * kind (this one is optional and uncapped, the other defaults to the current
 * month and is capped at 366 days). A shared key would silently transplant one
 * tab's filter into the other.
 *
 * Both sell bounds default to EMPTY and are INDEPENDENT: either may be set
 * alone, which the backend accepts as an open-ended bound. They can only
 * NARROW the feed's built-in floor (last purchase not older than MONTHS_FLOOR
 * months), never widen it — which is why, unlike the sibling reports, there is
 * no 366-day window cap to mirror here.
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
import { getErrorMessage, getErrorStatus } from '@/lib/errors'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import { useLowVerificationFeed } from '../hooks'
import { MAX_VERIFIED_CEILING, parseMaxVerified } from '../utils/maxVerified'
import { LowVerificationTable } from './LowVerificationTable'

/** URL keys, distinct from the processing (`from/to/dept`) and verification (`sf/st/cf/ct`) tabs. */
const SELL_FROM_KEY = 'pf'
const SELL_TO_KEY = 'pt'
const MAX_VERIFIED_KEY = 'mv'
const PAGE_KEY = 'pg'
const PAGE_SIZE_KEY = 'ps'

type FilterKey = typeof SELL_FROM_KEY | typeof SELL_TO_KEY | typeof MAX_VERIFIED_KEY

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
 * here stays inside the cap for every `?ps=` the user can switch to afterwards.
 */
const MAX_SKIP = 2_147_483_647
const MAX_PAGE = Math.floor(MAX_SKIP / Math.max(...PAGE_SIZE_OPTIONS)) + 1

/** Number of table columns — kept in step with LowVerificationTable for the skeleton. */
const COLUMN_COUNT = 9

/**
 * How far back the feed's built-in floor reaches, in months — the "last
 * purchase not older than N months" rule the filters can only narrow.
 *
 * MIRRORS the backend's `LOW_VERIFICATION_MONTHS_FLOOR` DEFAULT (see
 * api-prionex `services/client/app/core/config.py`, and the `:-2` in both
 * compose files). The value is env-configurable there and is NOT echoed in the
 * response, so it cannot be read from the data: whoever changes that setting
 * must change this constant in the same breath, or the hint below starts
 * lying. The Ukrainian copy spells the numeral out as "{{months}} місяці",
 * which is only grammatical for 2–4 — a floor outside that range needs the
 * `floorHint` translation revisited too.
 */
const MONTHS_FLOOR = 2

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

export function LowVerificationFeedTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()

  // Same project resolution as the Reports dashboard: active project first,
  // then the first assigned project, then 1.
  const user = useAuthStore((state) => state.user)
  const projectId: number = Number(user?.active_project_id ?? user?.projects?.[0]?.id ?? 1)
  const userTimezone = user?.timezone

  const rawSellFrom = searchParams.get(SELL_FROM_KEY)
  const rawSellTo = searchParams.get(SELL_TO_KEY)
  const rawMaxVerified = searchParams.get(MAX_VERIFIED_KEY) ?? ''

  // A present-but-unusable bound is NOT silently replaced: the URL would then
  // disagree with both the field and the request. It goes down the same path
  // as an inverted range — inline hint, no request (below). Tracked per bound
  // so the hint can sit on the field that actually holds the bad value.
  const isSellFromInvalid = !!rawSellFrom && !isRealCalendarDate(rawSellFrom)
  const isSellToInvalid = !!rawSellTo && !isRealCalendarDate(rawSellTo)
  const hasInvalidSellDate = isSellFromInvalid || isSellToInvalid

  // No defaults: an unset bound means "no bound", not "today".
  const sellFrom = rawSellFrom && isRealCalendarDate(rawSellFrom) ? rawSellFrom : undefined
  const sellTo = rawSellTo && isRealCalendarDate(rawSellTo) ? rawSellTo : undefined

  // The number input keeps a user inside `0 .. int32`, so a bad value can only
  // come from a hand-edited URL; it gets an inline hint rather than the 422 the
  // backend would answer with.
  const maxVerified = parseMaxVerified(rawMaxVerified)

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
  // (Back/Forward, a shared link, the ?pg= self-heal) is never built on a stale
  // base either. The resync belongs in an effect rather than in render — it
  // only has to be back in step by the next commit, and by then a same-tick
  // burst is long over.
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
  // profile timezone only travels to the backend, where it cuts
  // `assignment_date` (and nothing else).
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
  // this endpoint fetches the whole candidate set (3–6 s cold, see
  // docs/low-verification-feed.md), so typing "100" must not fire three of
  // them. Same shape as DateSelect's manual input, which also commits a
  // finished value and resyncs otherwise.
  const [maxVerifiedText, setMaxVerifiedText] = useState(rawMaxVerified)
  useEffect(() => {
    // Resync when the URL changes from the outside (Back/Forward, a shared link).
    setMaxVerifiedText(rawMaxVerified)
  }, [rawMaxVerified])

  const commitMaxVerified = () => {
    const trimmed = maxVerifiedText.trim()
    // Nothing to commit when the field still holds what the URL already says —
    // a bare focus/blur must not reset the page.
    if (trimmed === rawMaxVerified) return
    setFilterParam(MAX_VERIFIED_KEY, trimmed === '' ? null : trimmed)
  }

  // Manual input can bypass the pickers' min/max, so an inverted window must
  // not reach the API. ISO YYYY-MM-DD strings compare correctly as strings.
  // Only a FULLY specified window can be inverted — a single bound is a
  // legitimate open-ended filter (backend rule, same branch).
  const isSellInverted = !hasInvalidSellDate && !!sellFrom && !!sellTo && sellFrom > sellTo

  // Where a message is rendered follows WHAT it is about.
  //
  // A bad date or a bad cap belongs to ONE field, so it rides that field's
  // `error` prop: the red border, `aria-invalid` and `aria-describedby` all
  // land on the offending input, and a screen reader reaches the explanation
  // from the field itself. `error` (not `invalidText`) is the right prop here —
  // `invalidText` only surfaces while DateSelect holds half-typed text of its own,
  // whereas these values arrive already committed, from the URL.
  //
  // An inverted window belongs to the PAIR — neither bound is wrong on its own,
  // and pinning "from is later than to" on one of them would misattribute it —
  // so it stays a standalone alert under the filters, the way the sibling
  // verification tab reports its range errors.
  const sellDateError = hasInvalidSellDate
    ? t('pages.reports.lowVerification.invalidSellDate')
    : undefined
  const maxVerifiedError = maxVerified.isInvalid
    ? t('pages.reports.lowVerification.invalidMaxVerified')
    : undefined
  const sellRangeError = isSellInverted
    ? t('pages.reports.lowVerification.invalidSellRange')
    : undefined

  const hasFilterError = hasInvalidSellDate || isSellInverted || maxVerified.isInvalid

  const query = useLowVerificationFeed({
    projectId,
    sellFrom,
    sellTo,
    maxVerified: maxVerified.value,
    skip: (page - 1) * pageSize,
    limit: pageSize,
    timezone: userTimezone,
    enabled: !hasFilterError,
  })

  // Stable identity for the empty fallback — a fresh `[]` every render would
  // defeat LowVerificationTable's useMemo over its rows prop.
  const rows = useMemo(() => query.data?.rows ?? [], [query.data])
  const total = query.data?.total ?? 0
  const totalPages = Math.max(1, query.data?.total_pages ?? 1)

  // The feed drains, so a bookmarked `?pg=` can outlive the rows it pointed at.
  // What the pager shows is the page that actually exists — "Page 5 of 2" over
  // an empty table, with Prev walking down one empty page at a time, is not a
  // state to render. A drained feed (`total === 0`) keeps its calm empty state
  // and shows no pager at all, so there is nothing to clamp against.
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
    ? t('pages.reports.lowVerification.unavailable')
    : isForbidden
      ? t('pages.reports.lowVerification.forbidden')
      : errorStatus === 400
        ? // Backend date/timezone validation answers 400 with a human-readable detail
          getErrorMessage(query.error)
        : t('pages.reports.lowVerification.error.title')

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Filters: an optional, independent sell window + the optional cap */}
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl p-4 shadow-sm sm:gap-4">
        <DateSelect
          label={t('pages.reports.lowVerification.sellFrom')}
          value={sellFrom ?? null}
          // Bounded by the other end only when it exists — an open-ended
          // single bound must stay unconstrained.
          max={sellTo}
          // Only the bound that actually carries the unusable value is marked.
          error={isSellFromInvalid ? sellDateError : undefined}
          onChange={handleDateChange(SELL_FROM_KEY)}
          onClear={() => setFilterParam(SELL_FROM_KEY, null)}
          // Two "×" buttons stand side by side here — DateSelect's default
          // "Clear" name would be identical for both.
          clearLabel={t('pages.reports.lowVerification.clearSellFrom')}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <DateSelect
          label={t('pages.reports.lowVerification.sellTo')}
          value={sellTo ?? null}
          min={sellFrom}
          error={isSellToInvalid ? sellDateError : undefined}
          onChange={handleDateChange(SELL_TO_KEY)}
          onClear={() => setFilterParam(SELL_TO_KEY, null)}
          clearLabel={t('pages.reports.lowVerification.clearSellTo')}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <div className="w-full min-w-0 sm:w-44">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_VERIFIED_CEILING}
            step={1}
            label={t('pages.reports.lowVerification.maxVerified')}
            placeholder={t('pages.reports.lowVerification.maxVerifiedPlaceholder')}
            error={maxVerifiedError}
            value={maxVerifiedText}
            onChange={(event) => setMaxVerifiedText(event.target.value)}
            onBlur={commitMaxVerified}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitMaxVerified()
            }}
            onClear={() => {
              setMaxVerifiedText('')
              setFilterParam(MAX_VERIFIED_KEY, null)
            }}
            // This "×" stands in a row with the two date "×" buttons —
            // Input's default "Clear" name would be identical for all three.
            clearLabel={t('pages.reports.lowVerification.clearMaxVerified')}
          />
        </div>

        {/* The feed drains between purchase batches: its months-long floor is a
            hard backend rule no filter can widen, so an empty list is a normal
            state and not a failure. Without this note the empty table reads as
            a bug. The floor length comes from a constant (see MONTHS_FLOOR)
            rather than the copy, because the backend keeps it in an env var it
            never returns. */}
        <p className="text-muted-foreground w-full text-xs">
          {t('pages.reports.lowVerification.floorHint', { months: MONTHS_FLOOR })}
        </p>

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
        <TableSkeleton columns={COLUMN_COUNT} rows={6} />
      ) : query.isError ? (
        <div className="border-border bg-card flex w-full flex-col items-center justify-center gap-4 rounded-xl border p-8">
          <Icons.Warning size={40} className="text-error-500" />
          <p className="text-foreground text-center text-sm font-medium">{errorMessage}</p>
          {/* Retrying cannot fix missing permissions — no button on 403 */}
          {!isForbidden && (
            <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
              {t('pages.reports.lowVerification.error.retry')}
            </Button>
          )}
        </div>
      ) : (
        <div className="relative w-full" aria-busy={isRefreshing || undefined}>
          <LowVerificationTable
            rows={rows}
            emptyMessage={t('pages.reports.lowVerification.empty')}
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
                // `ps=50`.
                setUrlParams({
                  [PAGE_SIZE_KEY]: nextSize === DEFAULT_PAGE_SIZE ? null : String(nextSize),
                  [PAGE_KEY]: null,
                })
              }
            />
          )}
          {isRefreshing && (
            <div
              data-testid="low-verification-refreshing"
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
