/**
 * useUrlPagedFeedFilters Hook
 *
 * The URL shell every paged FEED tab of the Reports page shares (extracted
 * from LowVerificationFeedTab / SearcherFollowupFeedTab /
 * CommunicationGapFeedTab, byte-for-byte in behaviour; the bot's review of the
 * fourth feed asked for exactly this before a fifth one lands):
 *
 * - filter state and the current page live in the URL, so they survive
 *   refresh, bookmarking and switching between the page tabs (panels unmount
 *   on switch), and every update uses `replace` — only page-tab switches
 *   create history entries;
 * - URL updates COMPOSE through a ref (see `setUrlParams`) so a same-tick
 *   burst cannot drop a key;
 * - `?page=`/`?pageSize=` are parsed defensively: an unknown page size falls
 *   back silently (a view preference, not a filter), a page whose offset would
 *   overflow the backend's int32 `skip` cap falls back to 1 silently — no
 *   request is ever fired with an out-of-range offset;
 * - a bookmarked page that outlived the rows it pointed at (feeds DRAIN as
 *   operators work them) is clamped for display and self-healed in the URL —
 *   see `usePagedFeedPages`.
 *
 * Which keys spell the state is the tab's choice — every set is declared in
 * `src/lib/reportsUrlKeys.ts`, whose registry test keeps the page's whole URL
 * namespace collision-free, and the tab hands its own key union to the hook so
 * a misspelled filter key is a compile error. Reading a DATE out of the URL is
 * not part of this shell — that is `src/lib/urlDateBound.ts`, pure and usable
 * by a tab that never paginates. The tabs that do NOT paginate (verification,
 * operator-promises, processing) deliberately do not use this hook: they have
 * no page to reset, clamp or heal, and nothing in them fires two URL updates
 * in the same tick, so the plain functional `setSearchParams` form is enough
 * there.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEFAULT_PAGE_SIZE_OPTIONS } from '@/components/ui/Pagination'
import { formatPickerDateAsYMD } from '@/lib/dateUtils'

export interface UrlPagedFeedFiltersConfig {
  /** URL key of the current page (absent = page 1). */
  pageKey: string
  /** URL key of the rows-per-page choice (absent = `defaultPageSize`). */
  pageSizeKey: string
  /**
   * Rows per page when the URL names none. The feeds keep the backend's own
   * default (`limit=50`).
   */
  defaultPageSize?: number
  /**
   * The selectable sizes; every option must stay inside the backend's
   * `limit <= 500` cap. The feeds keep the shared Pagination component's
   * default set. (Plain `number[]`, not readonly — the array is handed
   * straight to Pagination's `pageSizeOptions` prop.)
   */
  pageSizeOptions?: number[]
}

export const DEFAULT_FEED_PAGE_SIZE = 50

/**
 * The selectable sizes, imported from the component that renders them rather
 * than re-declared: the shell parses `?pageSize=` against exactly the set the
 * Pagination dropdown offers, so a second copy could drift into a URL value
 * the picker cannot select (or a picker entry the URL parser rejects).
 */
export const FEED_PAGE_SIZE_OPTIONS: number[] = DEFAULT_PAGE_SIZE_OPTIONS

/**
 * The backend caps `skip` at the int32 ceiling (`le=2_147_483_647`) and the
 * request sends `skip = (page - 1) * limit`.
 */
const MAX_SKIP = 2_147_483_647

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

/**
 * The shell as one tab sees it.
 *
 * `F` is the tab's own union of FILTER keys — the literal type of the set it
 * owns in `src/lib/reportsUrlKeys.ts`. It types `setFilterParam` and
 * `dateFilterHandler`, so a misspelled key is a compile error rather than a
 * filter written under a name nothing reads (and, when the typo happens to hit
 * a sibling tab's key, a silent transplant into that tab). The page keys are
 * NOT part of `F`: they come from the config and are the shell's own business.
 * `setUrlParams` stays untyped in its keys on purpose — it is the raw
 * composition primitive, and the shell itself composes page keys through it.
 */
export interface UrlPagedFeedFilters<F extends string = string> {
  /** The committed URL params (react-router's own object, re-read every render). */
  searchParams: URLSearchParams
  /** Current page, already guarded against the int32 `skip` overflow. */
  page: number
  /** Current rows-per-page, already guarded against unknown sizes. */
  pageSize: number
  /** The selectable sizes, echoed for the Pagination props. */
  pageSizeOptions: number[]
  /** `(page - 1) * pageSize` — the request offset. */
  skip: number
  /**
   * Compose one coherent URL update out of several keys (null deletes a key).
   * Always `replace` — a filter or self-heal update is not a navigation step.
   */
  setUrlParams: (updates: Record<string, string | null>) => void
  /** A changed filter invalidates the current offset — page 1 or the user reads a hole. */
  setFilterParam: (key: F, value: string | null) => void
  /**
   * A DateSelect `onChange` handler for the date filter under `key`. A cleared
   * manual input is not a filter change: the URL keeps the old value and a
   * valid date commits once the user finishes retyping (DateSelect itself
   * resyncs the abandoned text on blur) — removing a bound, where a tab allows
   * it at all, is an explicit action (the "×" button, `onClear`).
   */
  dateFilterHandler: (key: F) => (change: { value: Date | null }) => void
  /** Move to `nextPage`. Page 1 is the default — the key is dropped, not written. */
  setPage: (nextPage: number) => void
  /**
   * Resize the page. The old offset dies with the old size, so the page goes
   * back to 1 in the SAME update — the shared Pagination does emit its own
   * `onPageChange(1)` right after `onPageSizeChange`, but a filter's worth of
   * URL state must not depend on a shared component's call order. The default
   * size is the absence of the key, never spelled out.
   */
  setPageSize: (nextSize: number) => void
}

export function useUrlPagedFeedFilters<F extends string = string>(
  config: UrlPagedFeedFiltersConfig
): UrlPagedFeedFilters<F> {
  const {
    pageKey,
    pageSizeKey,
    defaultPageSize = DEFAULT_FEED_PAGE_SIZE,
    pageSizeOptions: configuredOptions = FEED_PAGE_SIZE_OPTIONS,
  } = config
  const [searchParams, setSearchParams] = useSearchParams()

  // A caller CAN hand over an empty option set, and the arithmetic below would
  // take it badly: `Math.max()` of nothing is -Infinity, so every page in the
  // URL would fall back to 1 and the pager would offer no size at all. Falling
  // back to the shared set keeps a mistyped config working instead of silently
  // pinning the feed to its first page.
  const pageSizeOptions = configuredOptions.length > 0 ? configuredOptions : FEED_PAGE_SIZE_OPTIONS

  const pageSizeFromUrl = parsePositiveInt(searchParams.get(pageSizeKey), defaultPageSize)
  // An unknown page size falls back silently (it is a view preference, not a
  // filter) — but it must never exceed the backend's `limit <= 500`.
  const pageSize = pageSizeOptions.includes(pageSizeFromUrl) ? pageSizeFromUrl : defaultPageSize

  // Highest page the URL may ask for, computed against the LARGEST selectable
  // page size: a page accepted here stays inside the int32 `skip` cap for
  // every size the user can switch to afterwards.
  const maxPage = Math.floor(MAX_SKIP / Math.max(...pageSizeOptions)) + 1
  // A page whose offset would overflow the backend's int32 `skip` cap falls
  // back to 1 silently, exactly like an unknown page size: it can only come
  // from a hand-edited URL, and the 422 it would earn is nothing the user could
  // act on. No request is ever fired with an out-of-range offset.
  const page = parsePositiveInt(searchParams.get(pageKey), 1, maxPage)

  // The base every update builds on. It cannot be react-router's own `prev`:
  // the functional form of `setSearchParams` hands back a clone of the
  // RENDER-SCOPED params, so two updates fired in the SAME tick each start from
  // the pre-update URL and the last navigation silently drops the first one's
  // key. The shared Pagination emits exactly that pair — `onPageSizeChange`
  // immediately followed by `onPageChange(1)`. Keeping the composed value in a
  // ref makes such a sequence land as one coherent URL, while the effect below
  // resyncs it from the committed URL, so an update whose origin is elsewhere
  // (Back/Forward, a shared link, the page self-heal) is never built on a stale
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

  const setFilterParam = useCallback(
    (key: F, value: string | null) => setUrlParams({ [key]: value, [pageKey]: null }),
    [setUrlParams, pageKey]
  )

  // Timezone note for the pickers this handler serves: a PICKED date is
  // already a calendar day — the picker hands us a local-midnight Date whose
  // local Y/M/D are exactly the cell the user clicked, so we read them back
  // verbatim with formatPickerDateAsYMD. Whatever the profile timezone means
  // to a given feed (the default "today", the backend's day cut) is the tab's
  // own concern and never re-renders a picked day.
  const dateFilterHandler = useCallback(
    (key: F) =>
      ({ value }: { value: Date | null }) => {
        if (value) setFilterParam(key, formatPickerDateAsYMD(value))
      },
    [setFilterParam]
  )

  const setPage = useCallback(
    (nextPage: number) => setUrlParams({ [pageKey]: nextPage <= 1 ? null : String(nextPage) }),
    [setUrlParams, pageKey]
  )

  const setPageSize = useCallback(
    (nextSize: number) =>
      setUrlParams({
        [pageSizeKey]: nextSize === defaultPageSize ? null : String(nextSize),
        [pageKey]: null,
      }),
    [setUrlParams, pageSizeKey, pageKey, defaultPageSize]
  )

  return {
    searchParams,
    page,
    pageSize,
    pageSizeOptions,
    skip: (page - 1) * pageSize,
    setUrlParams,
    setFilterParam,
    dateFilterHandler,
    setPage,
    setPageSize,
  }
}

/**
 * The paged half of a feed RESPONSE, read against the shell: totals with their
 * defaults, the page as it should be DISPLAYED, and the URL self-heal.
 *
 * The feed drains as operators work it, so a bookmarked page can outlive the
 * rows it pointed at. What the pager shows is the page that actually exists —
 * "Page 5 of 2" over an empty table, with Prev walking down one empty page at
 * a time, is not a state to render — hence `clampedPage`. A drained feed
 * (`total === 0`) keeps its calm empty state and shows no pager at all, so
 * there is nothing to clamp against.
 *
 * ...and the URL follows the answer, so a refresh no longer re-requests the
 * dead offset. `replace` (via the shell's `setPage`) — self-correction is not
 * a navigation step and must not stack history entries. Page 1 is the default,
 * hence the key is dropped rather than written.
 */
export function usePagedFeedPages(
  filters: Pick<UrlPagedFeedFilters, 'page' | 'setPage'>,
  data: { total?: number; total_pages?: number } | undefined
): { total: number; totalPages: number; clampedPage: number } {
  const { page, setPage } = filters
  const total = data?.total ?? 0
  const totalPages = Math.max(1, data?.total_pages ?? 1)

  const clampedPage = total > 0 ? Math.min(page, totalPages) : page

  useEffect(() => {
    if (total > 0 && page > totalPages) {
      setPage(totalPages)
    }
  }, [total, totalPages, page, setPage])

  return { total, totalPages, clampedPage }
}
