/**
 * Unit tests for the shared paged-feed URL shell.
 *
 * The shell was extracted from the three paged feed tabs, whose suites keep
 * testing the same behaviour end-to-end; what is covered HERE is the shell's
 * own contract, once, against a real MemoryRouter (no mocked router — the
 * same-tick-burst composition exists precisely because of react-router's real
 * `setSearchParams` semantics):
 * - the URL race: two updates in the same tick compose instead of the last
 *   navigation dropping the first one's key;
 * - the resync from a URL change the shell did not make (a sibling component
 *   writes through the router; the next shell write must not erase it);
 * - defensive page/page-size parsing (unknown size, malformed page, the int32
 *   `skip` overflow guard);
 * - the page clamp and its self-heal after a feed drained under a bookmarked
 *   offset — pinned SEPARATELY, since the heal hides a missing clamp from any
 *   after-the-fact assertion (see `clampedPageFrames` and the direct
 *   `usePagedFeedPages` unit at the bottom);
 * - non-interference: for EVERY key set registered in
 *   `src/lib/reportsUrlKeys.ts`, the shell's writes leave every foreign key
 *   verbatim.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation, useSearchParams } from 'react-router-dom'
import { REPORTS_URL_KEYS, allReportsUrlKeys } from '@/lib/reportsUrlKeys'
import {
  usePagedFeedPages,
  useUrlPagedFeedFilters,
  type UrlPagedFeedFiltersConfig,
} from '../useUrlPagedFeedFilters'

/** Exposes the current ?search so tests can assert URL-state side effects. */
function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-search">{location.search}</div>
}

const search = () => screen.getByTestId('location-search').textContent ?? ''

/**
 * Every `clampedPage` the harness has EVER rendered, in order.
 *
 * The clamp's whole job is a value that must never reach the DOM — and the
 * self-heal erases the evidence: by the time an assertion runs, the URL already
 * says page 2 and a hook with no clamp at all reads "2" too. A pass-through
 * probe records each frame as it renders, including the one commit between the
 * out-of-range answer landing and the heal rewriting the URL, so the assertion
 * can be "5 was never on screen" rather than "5 is not on screen now".
 */
const clampedPageFrames: number[] = []

function ClampedPageProbe({ clampedPage }: { clampedPage: number }) {
  clampedPageFrames.push(clampedPage)
  return <div data-testid="clamped-page">{clampedPage}</div>
}

/**
 * Writes a URL key straight through react-router, BYPASSING the shell — a
 * stand-in for every update the shell does not make itself: Back/Forward, a
 * sibling component on the same page, a link opened over the current one.
 */
function OutsideWriter() {
  const [, setSearchParams] = useSearchParams()
  return (
    <button
      onClick={() =>
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.set('outside', 'z')
            return next
          },
          { replace: true }
        )
      }
    >
      outside-write
    </button>
  )
}

interface HarnessProps extends UrlPagedFeedFiltersConfig {
  /** When set, `usePagedFeedPages` runs against this fake response. */
  data?: { total?: number; total_pages?: number }
}

/**
 * A minimal consumer: renders the parsed state and wires buttons to the
 * shell's setters, including the same-tick pair the shared Pagination emits.
 */
function Harness({ data, ...config }: HarnessProps) {
  const filters = useUrlPagedFeedFilters(config)
  const pages = usePagedFeedPages(filters, data)
  return (
    <div>
      <div data-testid="page">{filters.page}</div>
      <div data-testid="page-size">{filters.pageSize}</div>
      <div data-testid="skip">{filters.skip}</div>
      <ClampedPageProbe clampedPage={pages.clampedPage} />
      <div data-testid="total-pages">{pages.totalPages}</div>
      <button onClick={() => filters.setPage(3)}>page3</button>
      <button onClick={() => filters.setPage(1)}>page1</button>
      <button
        onClick={() => {
          // The exact same-tick burst the shared Pagination emits on a resize:
          // onPageSizeChange immediately followed by onPageChange(1).
          filters.setPageSize(100)
          filters.setPage(1)
        }}
      >
        resize-burst
      </button>
      <button
        onClick={() => {
          // A filter write and a page write in one tick — two different keys,
          // both must land.
          filters.setFilterParam('flt', 'x')
          filters.setPage(1)
        }}
      >
        filter-burst
      </button>
      <button onClick={() => filters.setFilterParam('flt', 'y')}>set-filter</button>
      <button onClick={() => filters.setFilterParam('flt', null)}>clear-filter</button>
      <button
        onClick={() => filters.dateFilterHandler('df')({ value: new Date('2026-08-05T12:00:00') })}
      >
        pick-date
      </button>
      <button onClick={() => filters.dateFilterHandler('df')({ value: null })}>clear-date</button>
    </div>
  )
}

function renderHarness(entry: string, props: Partial<HarnessProps> = {}) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Harness pageKey="pg" pageSizeKey="ps" {...props} />
      <OutsideWriter />
      <LocationProbe />
    </MemoryRouter>
  )
}

describe('useUrlPagedFeedFilters', () => {
  beforeEach(() => {
    clampedPageFrames.length = 0
  })

  // ==========================================================================
  // Parsing and clamping
  // ==========================================================================

  it('reads page and page size from the URL and derives skip', () => {
    renderHarness('/?pg=3&ps=20')
    expect(screen.getByTestId('page').textContent).toBe('3')
    expect(screen.getByTestId('page-size').textContent).toBe('20')
    expect(screen.getByTestId('skip').textContent).toBe('40')
  })

  it('defaults to page 1 and the configured default size when the keys are absent', () => {
    renderHarness('/')
    expect(screen.getByTestId('page').textContent).toBe('1')
    expect(screen.getByTestId('page-size').textContent).toBe('50')
    expect(screen.getByTestId('skip').textContent).toBe('0')
  })

  it.each([
    ['a malformed page', '/?pg=abc'],
    ['a negative page', '/?pg=-2'],
    ['a zero page', '/?pg=0'],
    ['a fractional page', '/?pg=1.5'],
    // (100000000 - 1) * 100 ≈ 1e10 — past the backend's `skip <= 2147483647`
    // for the LARGEST selectable size, so the page must never be requested.
    ['a page past the int32 skip cap', '/?pg=100000000'],
  ])('silently falls back to page 1 for %s', (_case, entry) => {
    renderHarness(entry)
    expect(screen.getByTestId('page').textContent).toBe('1')
  })

  it('accepts the highest page whose offset still fits the int32 cap at every size', () => {
    // floor(2147483647 / 100) + 1 = 21474837, for the default option set.
    renderHarness('/?pg=21474837')
    expect(screen.getByTestId('page').textContent).toBe('21474837')
  })

  it.each([
    ['an unknown size', '/?ps=37'],
    ['a malformed size', '/?ps=abc'],
    ['a size past the backend limit cap', '/?ps=1000'],
  ])('silently falls back to the default page size for %s', (_case, entry) => {
    renderHarness(entry)
    expect(screen.getByTestId('page-size').textContent).toBe('50')
  })

  it('honours a custom default size and option set', () => {
    renderHarness('/?ps=25', { defaultPageSize: 5, pageSizeOptions: [5, 25] })
    expect(screen.getByTestId('page-size').textContent).toBe('25')
  })

  it('survives an empty option set instead of pinning the feed to page 1', () => {
    // No caller passes one, but the arithmetic would take it badly if any did:
    // `Math.max()` of nothing is -Infinity, so the int32 page cap would go
    // negative and EVERY page in the URL would silently fall back to 1. The
    // shared set stands in.
    renderHarness('/?pg=4', { pageSizeOptions: [] })
    expect(screen.getByTestId('page').textContent).toBe('4')
    expect(screen.getByTestId('page-size').textContent).toBe('50')
  })

  // ==========================================================================
  // The URL race: same-tick updates must compose
  // ==========================================================================

  it('lands a same-tick setPageSize + setPage(1) burst as one coherent URL', async () => {
    // Start on page 4 of size 20: the resize burst must drop BOTH keys (100 is
    // written, the page reset deletes pg; then setPage(1) is a no-op write).
    renderHarness('/?pg=4&ps=20')

    fireEvent.click(screen.getByText('resize-burst'))

    await waitFor(() => expect(search()).toContain('ps=100'))
    // The first update of the burst must not be dropped by the second: if the
    // composition broke, the pg deletion (part of setPageSize) would be undone
    // by a setPage built on the stale pre-burst params.
    expect(search()).not.toContain('pg=')
  })

  it('lands a same-tick setFilterParam + setPage burst without dropping a key', async () => {
    renderHarness('/?pg=4')

    fireEvent.click(screen.getByText('filter-burst'))

    await waitFor(() => expect(search()).toContain('flt=x'))
    expect(search()).not.toContain('pg=')
  })

  it('carries its own earlier update forward into the next one', async () => {
    // Two updates in SEPARATE ticks, both made through the shell: the second
    // must build on the first. (Scope note: this says nothing about an outside
    // URL change — the shell's own ref would carry these two even with no
    // resync at all. The resync is pinned by the test below.)
    renderHarness('/?pg=2')

    fireEvent.click(screen.getByText('set-filter'))
    await waitFor(() => expect(search()).toContain('flt=y'))
    // The filter write reset the page...
    expect(search()).not.toContain('pg=')

    fireEvent.click(screen.getByText('page3'))
    await waitFor(() => expect(search()).toContain('pg=3'))
    // ...and the later page write kept the earlier filter.
    expect(search()).toContain('flt=y')
  })

  it('resyncs its base from a URL change made outside the shell', async () => {
    // The ref the shell composes on is its own memory of the URL, and an update
    // it did not make never passes through it. Without the resync effect that
    // memory silently ages: the next write rebuilds the URL from a snapshot
    // taken before the outside change and DELETES whatever landed in between.
    //
    // Here a sibling component writes `outside=z` straight through
    // react-router. Comment out the resync effect and the page write below
    // takes the URL back to the mount-time params — `outside=z` disappears.
    renderHarness('/?pg=2')

    fireEvent.click(screen.getByText('outside-write'))
    await waitFor(() => expect(search()).toContain('outside=z'))

    fireEvent.click(screen.getByText('page3'))
    await waitFor(() => expect(search()).toContain('pg=3'))

    expect(search()).toContain('outside=z')
  })

  // ==========================================================================
  // Filter writes
  // ==========================================================================

  it('setFilterParam writes the value and resets the page in the same update', async () => {
    renderHarness('/?pg=5')

    fireEvent.click(screen.getByText('set-filter'))

    await waitFor(() => expect(search()).toContain('flt=y'))
    expect(search()).not.toContain('pg=')
  })

  it('setFilterParam(null) deletes the key (and still resets the page)', async () => {
    renderHarness('/?flt=y&pg=5')

    fireEvent.click(screen.getByText('clear-filter'))

    await waitFor(() => expect(search()).not.toContain('flt='))
    expect(search()).not.toContain('pg=')
  })

  it('setPage(1) drops the key rather than writing pg=1', async () => {
    renderHarness('/?pg=3')
    fireEvent.click(screen.getByText('page1'))
    await waitFor(() => expect(search()).not.toContain('pg='))
  })

  it('dateFilterHandler commits a picked date as YYYY-MM-DD and ignores null', async () => {
    renderHarness('/?pg=2')

    fireEvent.click(screen.getByText('pick-date'))
    await waitFor(() => expect(search()).toContain('df=2026-08-05'))
    expect(search()).not.toContain('pg=')

    // A cleared manual input is not a filter change: the URL keeps the value.
    fireEvent.click(screen.getByText('clear-date'))
    expect(search()).toContain('df=2026-08-05')
  })

  // ==========================================================================
  // Clamp and self-heal (usePagedFeedPages)
  // ==========================================================================

  it('clamps the displayed page to the answer and heals the URL', async () => {
    renderHarness('/?pg=5', { data: { total: 60, total_pages: 2 } })

    // Display never shows "Page 5 of 2"...
    expect(screen.getByTestId('clamped-page').textContent).toBe('2')
    // ...and the URL follows the answer, so a refresh no longer re-requests
    // the dead offset.
    await waitFor(() => expect(search()).toBe('?pg=2'))
  })

  it('never renders the out-of-range page — not even in the frame before the heal', async () => {
    // What the assertion above cannot see: with the clamp deleted, the FIRST
    // commit still renders page 5 (the answer says 2 pages, the URL still says
    // 5), and only the heal's rewrite brings the DOM to "2". Reading the node
    // after the fact therefore passes either way. This reads every frame the
    // probe recorded instead, so the transient one counts.
    renderHarness('/?pg=5', { data: { total: 60, total_pages: 2 } })

    await waitFor(() => expect(search()).toBe('?pg=2'))

    expect(clampedPageFrames.length).toBeGreaterThan(0)
    expect(clampedPageFrames).not.toContain(5)
    expect(new Set(clampedPageFrames)).toEqual(new Set([2]))
  })

  it('heals to a dropped key when the feed shrank to a single page', async () => {
    renderHarness('/?pg=5', { data: { total: 3, total_pages: 1 } })
    await waitFor(() => expect(search()).not.toContain('pg='))
  })

  it('leaves a drained feed (total = 0) unclamped and unhealed', () => {
    // A drained feed shows its calm empty state and no pager at all — there is
    // nothing to clamp against, and rewriting the URL would destroy the
    // bookmarked offset for the day the feed refills.
    renderHarness('/?pg=5', { data: { total: 0, total_pages: 0 } })
    expect(screen.getByTestId('clamped-page').textContent).toBe('5')
    expect(search()).toContain('pg=5')
  })

  it('does not touch the URL while the page is within range', () => {
    renderHarness('/?pg=2', { data: { total: 60, total_pages: 2 } })
    expect(search()).toBe('?pg=2')
    expect(screen.getByTestId('clamped-page').textContent).toBe('2')
  })

  // ==========================================================================
  // Non-interference: one sweep for every registered key set
  // ==========================================================================

  it('neither consumes nor clobbers any other tab’s registered URL keys', async () => {
    // The host page keeps every tab's params in the URL at once. For EACH
    // paged feed's registered key set, mount the shell on a URL carrying every
    // OTHER registered key (host, processing, verification, both sibling
    // feeds, operator-promises — whatever the registry holds now or grows
    // next) and drive every kind of write the shell can make. Each foreign key
    // must survive verbatim. One sweep here replaces a per-tab backfill every
    // time a new tab's keys join the registry.
    const feeds = [
      REPORTS_URL_KEYS.lowVerificationFeed,
      REPORTS_URL_KEYS.searcherFollowup,
      REPORTS_URL_KEYS.communicationGap,
    ]

    for (const feed of feeds) {
      const own = new Set<string>(Object.values(feed))
      const foreign = allReportsUrlKeys()
        .filter(({ key }) => !own.has(key))
        .map(({ key }, index) => [key, `v${index}`] as const)
      const entry = `/?${foreign.map(([k, v]) => `${k}=${v}`).join('&')}`

      const view = render(
        <MemoryRouter initialEntries={[entry]}>
          <Harness
            pageKey={feed.page}
            pageSizeKey={feed.pageSize}
            data={{ total: 60, total_pages: 2 }}
          />
          <LocationProbe />
        </MemoryRouter>
      )

      fireEvent.click(screen.getByText('set-filter'))
      await waitFor(() => expect(search()).toContain('flt=y'))
      // An out-of-range page write is immediately self-healed to the answer's
      // last page — the pg=3 frame is transient (heal rewrites it in the same
      // flush), so the wait targets the healed value directly.
      fireEvent.click(screen.getByText('page3'))
      await waitFor(() => expect(search()).toContain(`${feed.page}=2`))
      fireEvent.click(screen.getByText('resize-burst'))
      await waitFor(() => expect(search()).toContain(`${feed.pageSize}=100`))

      // ...and every foreign key survives verbatim through all of it.
      for (const [key, value] of foreign) {
        expect(search()).toContain(`${key}=${value}`)
      }

      view.unmount()
    }
  })
})

describe('usePagedFeedPages', () => {
  it('clamps to the last existing page on its own, with no self-heal to lean on', () => {
    // The clamp and the heal are two different guarantees, and the suite above
    // can only ever see them TOGETHER: by the time any assertion runs, the heal
    // has rewritten the URL and both a clamped and an unclamped implementation
    // read "2". Here `setPage` is a no-op — the URL never moves, `page` stays 5
    // forever — so the returned value is the clamp and nothing else. Delete
    // `Math.min` from the hook and this fails immediately.
    const { result } = renderHook(() =>
      usePagedFeedPages({ page: 5, setPage: () => {} }, { total: 60, total_pages: 2 })
    )

    expect(result.current.clampedPage).toBe(2)
    expect(result.current.totalPages).toBe(2)
    expect(result.current.total).toBe(60)
  })

  it('leaves a drained feed (total = 0) unclamped even with no self-heal', () => {
    // Nothing to clamp against: no pager is rendered at all, and pulling the
    // bookmarked offset down to 1 would destroy it for the day the feed refills.
    const { result } = renderHook(() =>
      usePagedFeedPages({ page: 5, setPage: () => {} }, { total: 0, total_pages: 0 })
    )

    expect(result.current.clampedPage).toBe(5)
  })

  it('applies its defaults when the response has not landed yet', () => {
    const { result } = renderHook(() =>
      usePagedFeedPages({ page: 3, setPage: () => {} }, undefined)
    )

    expect(result.current).toEqual({ total: 0, totalPages: 1, clampedPage: 3 })
  })
})
