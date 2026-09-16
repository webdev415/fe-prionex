import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import enCommon from '@/../public/locales/en/common.json'
import ukCommon from '@/../public/locales/uk/common.json'
import { InboundFollowupFeedTab } from '../InboundFollowupFeedTab'
import { getInboundFollowupFeed } from '../../api/inboundFollowupFeedApi'
import type { InboundFollowupResponse, InboundFollowupRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key.

vi.mock('../../api/inboundFollowupFeedApi', () => ({
  getInboundFollowupFeed: vi.fn(),
}))

// Mutable so individual tests can set the profile timezone.
const authState = {
  user: {
    active_project_id: 1,
    projects: [{ id: 1 }],
    timezone: null as string | null,
  },
}

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector(authState),
}))

// The real DateSelect drags react-datepicker into jsdom; a functional stub
// keeps the tests focused while still driving value/onChange/onClear like the
// real component (onChange receives a Date or null; onClear is the opt-in "×").
// The "×" name follows the real contract — `clearLabel` when given, otherwise
// the component's hardcoded "Clear" — and is gated on a value being set, so
// these tests can't over-promise a control the shipped component never
// renders (this tab passes no onClear at all: its date pair is mandatory).
// `error` is mirrored the same way: the real component renders it as a
// role="alert" paragraph and marks the field aria-invalid/aria-describedby,
// so field-level error wiring is assertable here.
//
// `min`/`max` are surfaced as `data-min`/`data-max` and ONLY when the tab
// actually passes them: the real component forwards them to react-datepicker's
// minDate/maxDate (and adds none of its own), i.e. they are what greys days
// out. Mirroring them as attributes makes "neither picker bounds the other" an
// assertable fact rather than a comment.
vi.mock('@/components/ui/DateSelect', () => ({
  DateSelect: ({
    value,
    onChange,
    onClear,
    clearLabel,
    label,
    error,
    min,
    max,
  }: {
    value?: string | Date | null
    onChange?: (args: { value: Date | null }) => void
    onClear?: () => void
    clearLabel?: string
    label?: string
    error?: string
    min?: Date | string
    max?: Date | string
  }) => {
    const errorId = `date-select-error-${label ?? ''}`
    return (
      <>
        <input
          data-testid="date-select"
          aria-label={label}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          data-min={min == null ? undefined : String(min)}
          data-max={max == null ? undefined : String(max)}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) =>
            // Noon avoids the parsed UTC date rolling into the previous local day
            onChange?.({ value: e.target.value ? new Date(`${e.target.value}T12:00:00`) : null })
          }
        />
        {/* Same gate as the real component's `showClear` (onClear AND a date
            actually set). */}
        {onClear && value && (
          <button type="button" aria-label={clearLabel ?? 'Clear'} onClick={onClear}>
            ×
          </button>
        )}
        {error && (
          <p id={errorId} role="alert">
            {error}
          </p>
        )}
      </>
    )
  },
}))

// The transient-frame invariant ("Page N of M" with N past M must never reach
// the DOM, not even for the single commit between a stale answer landing and
// the ?npg= self-heal rewriting the URL) is invisible to polling queries: the
// heal effect has already run by the time any waitFor observer looks. A
// pass-through wrapper records every (currentPage, totalPages) pair the REAL
// Pagination is rendered with, so the healing test can assert over ALL frames,
// including the intermediate one. Every other test renders the genuine
// component untouched.
const paginationFrames = vi.hoisted(() => [] as Array<{ currentPage: number; totalPages: number }>)
vi.mock('@/components/ui/Pagination', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/Pagination')>()
  return {
    // Spread first: the module also exports DEFAULT_PAGE_SIZE_OPTIONS, which
    // the paged-feed shell imports to parse `?nps=` against the very set this
    // dropdown offers. Only the component is wrapped.
    ...actual,
    Pagination: (props: import('@/components/ui/Pagination').PaginationProps) => {
      paginationFrames.push({ currentPage: props.currentPage, totalPages: props.totalPages })
      return <actual.Pagination {...props} />
    },
  }
})

const mockGetFeed = vi.mocked(getInboundFollowupFeed)

function makeRow(overrides: Partial<InboundFollowupRow> = {}): InboundFollowupRow {
  return {
    client_id: 84213,
    inn: '1234567890',
    interaction_at: '2026-08-12T06:14:03Z',
    interaction_type: 'Питання щодо спец.пропозицій',
    employee_id: 6959,
    employee_name: 'Коваленко Іван Петрович',
    department: 'Дайлер',
    group_name: 'Полка',
    last_call_at: '2026-08-11T15:02:44Z',
    last_call_outcome: 'no_answer',
    ...overrides,
  }
}

function makeResponse(
  rows: InboundFollowupRow[],
  overrides: Partial<InboundFollowupResponse> = {}
): InboundFollowupResponse {
  return {
    project_id: 1,
    date_start: null,
    date_end: null,
    rows,
    total: rows.length,
    page: 1,
    page_size: 50,
    total_pages: rows.length > 0 ? 1 : 0,
    generated_at: '2026-08-25T09:00:00Z',
    ...overrides,
  }
}

/** Error shaped like an AxiosError so lib/errors + lib/api predicates read it. */
function makeHttpError(status: number, data?: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    response: { status, data },
  })
}

function makeNetworkError(code: string) {
  return Object.assign(new Error(code), { isAxiosError: true, code })
}

/** Exposes the current ?search so tests can assert URL-state side effects. */
function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-search">{location.search}</div>
}

function renderTab(initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <InboundFollowupFeedTab />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const dateInputs = () => screen.getAllByTestId('date-select') as HTMLInputElement[]
const search = () => screen.getByTestId('location-search').textContent ?? ''
/**
 * The pager's "Page N of M" indicator, read back as [N, M]. The shared
 * Pagination labels resolve through the global i18n mock's map ("Page"/"of"),
 * not to raw keys like this tab's own strings.
 */
const pageIndicator = () =>
  Array.from(screen.getByText('Page').parentElement?.children ?? [])
    .map((element) => element.textContent ?? '')
    .filter((text) => /^\d+$/.test(text))

/** Picks a rows-per-page option in the shared Pagination's (Radix) select. */
async function selectPageSize(size: string) {
  fireEvent.click(screen.getByRole('combobox'))
  fireEvent.click(await screen.findByRole('option', { name: size }))
}

/**
 * Today's calendar day in an IANA zone, computed independently of the
 * component's own helper (en-CA renders as YYYY-MM-DD) — asserting through
 * `getDateStringInTimezone` itself would be circular.
 */
function ymdIn(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// The shared Pagination's rows-per-page control is a Radix Select, which uses
// pointer-capture / scroll APIs jsdom doesn't implement.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
  paginationFrames.length = 0
  authState.user.timezone = null
})

describe('InboundFollowupFeedTab', () => {
  it('defaults the window to today–today in the PROFILE timezone and sends it explicitly', async () => {
    // UTC+14 — almost always a different calendar day than the test runner's
    // clock, so a component that resolved "today" browser-locally would fail.
    authState.user.timezone = 'Pacific/Kiritimati'
    const kiritimatiToday = ymdIn('Pacific/Kiritimati')
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()

    // Both bounds go out even though the backend has a default of its own
    // (whole history!) — the source system's default is today–today, and the
    // profile timezone travels along so the server cuts the same day.
    expect(mockGetFeed).toHaveBeenCalledTimes(1)
    expect(mockGetFeed).toHaveBeenCalledWith({
      project_id: 1,
      date_start: kiritimatiToday,
      date_end: kiritimatiToday,
      skip: 0,
      limit: 50,
      timezone: 'Pacific/Kiritimati',
    })

    // The fields show the default...
    const [dateFrom, dateTo] = dateInputs()
    expect(dateFrom.value).toBe(kiritimatiToday)
    expect(dateTo.value).toBe(kiritimatiToday)
    // ...but an auto-derived value is never pinned into the URL: a shared
    // link would otherwise freeze "today" to the day the link was made.
    expect(search()).not.toContain('nf=')
    expect(search()).not.toContain('nt=')
  })

  it('omits the timezone param for a profile without one (backend defaults to UTC)', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    const params: Record<string, unknown> = { ...mockGetFeed.mock.calls[0][0] }
    expect('timezone' in params).toBe(false)
    // The default still goes out as an explicit pair.
    expect(params.date_start).toBe(params.date_end)
  })

  it('renders the contract row end to end — every column of the answer', async () => {
    // The wire shape (docs/inbound-followup-feed.md) reaching the DOM through
    // hook → table, not just through the table's own fixtures.
    authState.user.timezone = 'Europe/Kyiv'
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], {
        date_start: '2026-08-12',
        date_end: '2026-08-12',
        total: 1,
        total_pages: 1,
      })
    )

    renderTab()

    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
    expect(screen.getByText('Питання щодо спец.пропозицій')).toBeInTheDocument()
    expect(screen.getByText('Дайлер')).toBeInTheDocument()
    expect(screen.getByText('Полка')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '1234567890' })).toBeInTheDocument()
    // Both instants in the profile zone: 06:14 UTC = 09:14 Kyiv summer time.
    expect(screen.getByText('12-08-2026 09:14')).toBeInTheDocument()
    expect(screen.getByText('11-08-2026 18:02')).toBeInTheDocument()
  })

  it('never renders generated_at as a freshness stamp', async () => {
    // This endpoint has NO result cache, so `generated_at` is always "just
    // now" — it exists for shape parity with the caching siblings only, and
    // presenting it as "data as of …" would state a fact nothing backs.
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { generated_at: '2026-08-25T09:00:00Z' })
    )

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    expect(screen.queryByText(/2026-08-25T09:00:00Z/)).not.toBeInTheDocument()
    expect(screen.queryByText(/25-08-2026 09:00/)).not.toBeInTheDocument()
  })

  describe('midnight rollover — the default window lives in state and re-resolves on focus', () => {
    // Only Date is faked: real timers keep waitFor / React Query / userEvent
    // flowing, while setSystemTime moves what "now" (and thus "today") is.
    // React Query v5's own focus refetching listens to `visibilitychange`,
    // not `focus`, so the dispatched focus events below reach ONLY the tab's
    // listener — every refetch asserted here is the component's doing.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      authState.user.timezone = 'Europe/Kyiv'
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    /** Lets any would-be re-render/refetch land before asserting nothing did. */
    const flush = () =>
      act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

    it('refires the default window with the new day on a focus after midnight', async () => {
      // Mounted just before Kyiv midnight (UTC+3 in August)...
      vi.setSystemTime(new Date('2026-08-14T20:55:00Z')) // 23:55 Aug 14 Kyiv
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab()
      await screen.findByText('Коваленко Іван Петрович')
      expect(mockGetFeed).toHaveBeenCalledWith(
        expect.objectContaining({ date_start: '2026-08-14', date_end: '2026-08-14' })
      )

      // ...left open across it, and focused again the next morning. A render
      // read of the wall clock would keep YESTERDAY's window here until some
      // unrelated re-render happened to recompute it.
      vi.setSystemTime(new Date('2026-08-15T05:00:00Z')) // 08:00 Aug 15 Kyiv
      fireEvent(window, new Event('focus'))

      await waitFor(() =>
        expect(mockGetFeed).toHaveBeenLastCalledWith(
          expect.objectContaining({ date_start: '2026-08-15', date_end: '2026-08-15' })
        )
      )
      expect(mockGetFeed).toHaveBeenCalledTimes(2)
      // The fields follow the rolled-over default...
      const [dateFrom, dateTo] = dateInputs()
      expect(dateFrom.value).toBe('2026-08-15')
      expect(dateTo.value).toBe('2026-08-15')
      // ...and an auto-derived value still never lands in the URL.
      expect(search()).not.toContain('nf=')
      expect(search()).not.toContain('nt=')
    })

    it('treats a same-day focus as a no-op — no extra request', async () => {
      vi.setSystemTime(new Date('2026-08-14T09:00:00Z'))
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab()
      await screen.findByText('Коваленко Іван Петрович')
      expect(mockGetFeed).toHaveBeenCalledTimes(1)

      // Hours later, but the same Kyiv calendar day: the functional update
      // hands back the previous value, so nothing re-renders and the query
      // key never moves.
      vi.setSystemTime(new Date('2026-08-14T15:00:00Z'))
      fireEvent(window, new Event('focus'))

      await flush()
      expect(mockGetFeed).toHaveBeenCalledTimes(1)
    })

    it('leaves a user-picked window alone when the day rolls over', async () => {
      vi.setSystemTime(new Date('2026-08-14T20:55:00Z'))
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab(['/?nf=2026-06-01&nt=2026-06-30'])
      await screen.findByText('Коваленко Іван Петрович')

      vi.setSystemTime(new Date('2026-08-15T05:00:00Z'))
      fireEvent(window, new Event('focus'))

      await flush()
      // `today` only backs the DEFAULT window: with both bounds picked in the
      // URL, the rollover neither refetches nor moves what is sent or shown.
      expect(mockGetFeed).toHaveBeenCalledTimes(1)
      expect(mockGetFeed).toHaveBeenCalledWith(
        expect.objectContaining({ date_start: '2026-06-01', date_end: '2026-06-30' })
      )
      const [dateFrom, dateTo] = dateInputs()
      expect(dateFrom.value).toBe('2026-06-01')
      expect(dateTo.value).toBe('2026-06-30')
    })
  })

  it('round-trips every filter and the page window through the URL (?nf=&nt=&npg=&nps=)', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 260, page: 2, page_size: 100, total_pages: 3 })
    )

    renderTab(['/?nf=2026-06-01&nt=2026-06-30&npg=2&nps=100'])
    await screen.findByText('Коваленко Іван Петрович')

    // skip is derived from the ACTIVE page size, not the default one.
    expect(mockGetFeed).toHaveBeenCalledWith(
      expect.objectContaining({
        date_start: '2026-06-01',
        date_end: '2026-06-30',
        skip: 100,
        limit: 100,
      })
    )
    const [dateFrom, dateTo] = dateInputs()
    expect(dateFrom.value).toBe('2026-06-01')
    expect(dateTo.value).toBe('2026-06-30')
  })

  it.each([
    [
      'a lower bound (?nf=) only',
      '/?nf=2026-06-01',
      (today: string) => ({ date_start: '2026-06-01', date_end: today }),
    ],
    [
      'an upper bound (?nt=) only',
      // A future date — the defaulted lower bound is today, so a past-only
      // upper bound would (correctly) trip the inverted-range guard instead.
      '/?nt=2030-12-31',
      (today: string) => ({ date_start: today, date_end: '2030-12-31' }),
    ],
  ])(
    'fills the absent side of a link carrying %s with today in the profile timezone',
    async (_case, entry, expected) => {
      // The backend accepts both bounds or neither (half a window answers 400),
      // so an absent bound means "today", not "no bound" — the pair must go out
      // whole even when a shared link carries only one side.
      authState.user.timezone = 'Pacific/Kiritimati'
      const kiritimatiToday = ymdIn('Pacific/Kiritimati')
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab([entry])
      await screen.findByText('Коваленко Іван Петрович')

      expect(mockGetFeed).toHaveBeenCalledTimes(1)
      expect(mockGetFeed).toHaveBeenCalledWith(expect.objectContaining(expected(kiritimatiToday)))
    }
  )

  it('neither consumes nor clobbers the other report tabs’ URL params', async () => {
    // The host page keeps every tab's params in the URL, so this tab renders
    // with the processing (`from`), searcher (`if`, `it`, `spg`, `sps`) and
    // low-verification (`pf`, `pg`, `ps`) keys present. The searcher pair is
    // the dangerous one — same shape, same meaning, one letter apart — so none
    // of them may leak into this tab's request, and writing this tab's own
    // keys must leave them untouched.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([
      '/?tab=inbound-followup&from=2026-03-03&if=2026-02-02&it=2026-02-09&spg=4&sps=100&pf=2026-01-01&pg=7&ps=100',
    ])
    await screen.findByText('Коваленко Іван Петрович')

    // Foreign date keys are not this tab's window (defaults hold) and the
    // sibling feeds' paging is not this tab's paging.
    const params: Record<string, unknown> = { ...mockGetFeed.mock.calls[0][0] }
    expect(params.date_start).not.toBe('2026-03-03')
    expect(params.date_start).not.toBe('2026-02-02')
    expect(params.date_end).not.toBe('2026-02-09')
    expect(params.date_start).not.toBe('2026-01-01')
    expect(params.skip).toBe(0)
    expect(params.limit).toBe(50)

    // Now write this tab's own state...
    fireEvent.change(dateInputs()[0], { target: { value: '2026-08-05' } })
    await waitFor(() => expect(search()).toContain('nf=2026-08-05'))

    // ...and every foreign key survives verbatim.
    expect(search()).toContain('tab=inbound-followup')
    expect(search()).toContain('from=2026-03-03')
    expect(search()).toContain('if=2026-02-02')
    expect(search()).toContain('it=2026-02-09')
    expect(search()).toContain('spg=4')
    expect(search()).toContain('sps=100')
    expect(search()).toContain('pf=2026-01-01')
    expect(search()).toContain('pg=7')
    expect(search()).toContain('ps=100')
  })

  it('writes a picked date into the URL and resets the page in the same update', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 130, page: 3, page_size: 50, total_pages: 3 })
    )

    renderTab(['/?npg=3'])
    await screen.findByText('Коваленко Іван Петрович')
    expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 100 }))

    fireEvent.change(dateInputs()[0], { target: { value: '2026-08-05' } })

    // Otherwise the user lands on an offset the new window may not even have.
    await waitFor(() => expect(search()).toContain('nf=2026-08-05'))
    await waitFor(() => expect(search()).not.toContain('npg='))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(
        expect.objectContaining({ date_start: '2026-08-05', skip: 0 })
      )
    )
  })

  it.each([
    ['a day the month does not have', '/?nf=2026-02-31', 0],
    ['a month that does not exist', '/?nt=2026-13-01', 1],
  ])('blocks a hand-edited bound with %s', async (_case, entry, offendingIndex) => {
    // Shape-only validation would let these through: comparisons against NaN
    // are all false and the request would go out with a date the picker itself
    // renders as a different day. The default must NOT silently stand in for
    // the bad value either — the URL would then disagree with the request.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([entry])

    expect(await screen.findByText('pages.reports.inboundFollowup.invalidDate')).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()

    // A single-field error rides that field: only the bound holding the bad
    // value is marked, and its message is reachable from the field itself.
    const fields = dateInputs()
    expect(fields[offendingIndex]).toHaveAttribute('aria-invalid', 'true')
    expect(fields[1 - offendingIndex]).not.toHaveAttribute('aria-invalid')
    const describedBy = fields[offendingIndex].getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      'pages.reports.inboundFollowup.invalidDate'
    )
    // The offending field shows empty (the message asks to pick a date), not
    // the default silently pretending the URL value was fine.
    expect(fields[offendingIndex].value).toBe('')
  })

  it('sends a window wider than a YEAR — this endpoint has no window cap, on purpose', async () => {
    // The uncapped half of the Reports page is a deliberate backend decision
    // (`# No _MAX_RANGE_DAYS cap here on purpose` in the router) that until now
    // nothing on the client pinned: adding a `cap` (the capped siblings' `WINDOW_CAP`) to this tab's
    // window call would have left every suite green while silently refusing
    // windows the API serves. Two years is comfortably past the 366-day
    // DIFFERENCE its capped siblings mirror.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?nf=2024-01-01&nt=2026-01-01'])
    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()

    expect(mockGetFeed).toHaveBeenCalledWith(
      expect.objectContaining({ date_start: '2024-01-01', date_end: '2026-01-01' })
    )
    // ...and no pair alert of any kind under the filters.
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
  })

  it('blocks an inverted window and recovers once a bound is repicked', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?nf=2026-06-20&nt=2026-06-10'])

    expect(
      await screen.findByText('pages.reports.inboundFollowup.invalidRange')
    ).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()

    // A pair error stays a standalone alert: neither bound is wrong on its
    // own, so neither field is singled out as invalid.
    for (const field of dateInputs()) {
      expect(field).not.toHaveAttribute('aria-invalid')
    }

    // Repicking the upper bound past the lower one makes the pair valid again.
    fireEvent.change(dateInputs()[1], { target: { value: '2026-06-25' } })

    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
    expect(mockGetFeed).toHaveBeenCalledWith(
      expect.objectContaining({ date_start: '2026-06-20', date_end: '2026-06-25' })
    )
  })

  it('bounds neither picker by the other — no min/max on either field', async () => {
    // The page-wide calendar policy of every tab with a DEFAULTED window (this
    // one, searcher, processing, operator-promises). A mutual bound would not
    // deaden a calendar, but it would impose an ORDER nothing on screen states:
    // with the today–today default, «з» would open on days up to today and «по»
    // on days from today, so a window entirely in the PAST is reachable only by
    // moving «з» first — reach for «по» first and the whole past is greyed out
    // with no explanation. So the tab passes no bounds at all and lets the
    // pair-level guard refuse in words (the test below). This is the regression
    // guard: reinstating `min={dateStart}` on the «по» field fails here.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?nf=2026-06-10&nt=2026-06-20'])
    await screen.findByText('Коваленко Іван Петрович')

    for (const field of dateInputs()) {
      expect(field).not.toHaveAttribute('data-min')
      expect(field).not.toHaveAttribute('data-max')
    }
  })

  it('lets an inverted window be PICKED and answers with the guard, not a dead calendar', async () => {
    // The counterpart of the bounds test above: since neither picker refuses an
    // inverted pair, the pair-level guard is what has to, and it does so in
    // words with no request leaving. Scope note: this drives the picker's
    // onChange (the same call the calendar makes on a click), so what is
    // pinned here is the GUARD's behaviour on a freshly PICKED inverted pair —
    // not merely a hand-edited URL, which the test above already covers.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?nf=2026-06-10&nt=2026-06-20'])
    await screen.findByText('Коваленко Іван Петрович')
    expect(mockGetFeed).toHaveBeenCalledTimes(1)

    // «по» pulled BEFORE «з» — the very pick a mutual `min` would have blocked.
    fireEvent.change(dateInputs()[1], { target: { value: '2026-06-01' } })

    expect(
      await screen.findByText('pages.reports.inboundFollowup.invalidRange')
    ).toBeInTheDocument()
    // The choice is kept (the user can fix either bound), but nothing is sent.
    await waitFor(() => expect(search()).toContain('nt=2026-06-01'))
    expect(mockGetFeed).toHaveBeenCalledTimes(1)
    // Neither bound is wrong on its own, so neither field is singled out.
    for (const field of dateInputs()) expect(field).not.toHaveAttribute('aria-invalid')
  })

  it('pages through the feed with the right skip and keeps the page in the URL', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 130, page: 1, page_size: 50, total_pages: 3 })
    )

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    await userEvent.click(screen.getByTitle('3'))

    await waitFor(() => expect(search()).toContain('npg=3'))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(
        expect.objectContaining({ skip: 100, limit: 50 })
      )
    )
  })

  it.each([
    ['a size outside the offered options', '/?nps=999'],
    ['a non-numeric size', '/?nps=abc'],
  ])('falls back to the default limit for %s', async (_case, entry) => {
    // 999 would also break the backend's `limit <= 500`. A page size is a view
    // preference, not a filter: an unusable one is ignored silently (no hint,
    // no rewrite of the URL) rather than blocking the request.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([entry])
    await screen.findByText('Коваленко Іван Петрович')

    expect(mockGetFeed).toHaveBeenCalledTimes(1)
    expect(mockGetFeed).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }))
    expect(search()).toContain('nps=')
  })

  it('writes a non-default rows-per-page into ?nps=, drops it again for the default', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 260, page: 1, page_size: 50, total_pages: 6 })
    )

    renderTab(['/?npg=3'])
    await screen.findByText('Коваленко Іван Петрович')

    await selectPageSize('100')

    // A new page size invalidates the old offset — the pager resets to page 1,
    // and page 1 is the default, so `npg` leaves the URL in the same update.
    await waitFor(() => expect(search()).toContain('nps=100'))
    expect(search()).not.toContain('npg=')
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 0, limit: 100 }))
    )

    await selectPageSize('50')

    // The default is the absence of the key — it is never spelled out.
    await waitFor(() => expect(search()).not.toContain('nps='))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 50 }))
    )
  })

  it('heals a stale ?npg= down to the last page the answer still has', async () => {
    // A shared link outlives the rows it pointed at, and this feed DRAINS
    // faster than any sibling — it is a to-do list of 1-8 rows a day.
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([], { total: 90, page: 5, page_size: 50, total_pages: 2 })
      )
      .mockResolvedValue(
        makeResponse([makeRow()], { total: 90, page: 2, page_size: 50, total_pages: 2 })
      )

    renderTab(['/?npg=5'])

    // The page count is only known from an answer, so the stale offset does go
    // out once — but exactly once, and never again after the URL self-heals.
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenNthCalledWith(1, expect.objectContaining({ skip: 200 }))
    )
    await waitFor(() => expect(search()).toContain('npg=2'))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 50, limit: 50 }))
    )
    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
    expect(mockGetFeed).toHaveBeenCalledTimes(2)
    expect(pageIndicator()).toEqual(['2', '2'])

    // A dead offset is not a failure — no error branch on the way through.
    expect(
      screen.queryByRole('button', { name: 'pages.reports.inboundFollowup.error.retry' })
    ).not.toBeInTheDocument()
  })

  it('never renders "Page N of M" with N past M while a stale ?npg= heals', async () => {
    let resolveHealed: (value: InboundFollowupResponse) => void = () => {}
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([], { total: 90, page: 5, page_size: 50, total_pages: 2 })
      )
      .mockImplementationOnce(
        () => new Promise<InboundFollowupResponse>((resolve) => (resolveHealed = resolve))
      )

    renderTab(['/?npg=5'])

    // Placeholder frame: the stale page's answer is still on screen while the
    // healed page loads, and the pager already reads the clamped page.
    expect(await screen.findByTestId('inbound-followup-refreshing')).toBeInTheDocument()
    expect(pageIndicator()).toEqual(['2', '2'])
    expect(screen.queryByTitle('5')).not.toBeInTheDocument()

    resolveHealed(makeResponse([makeRow()], { total: 90, page: 2, page_size: 50, total_pages: 2 }))

    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
    expect(pageIndicator()).toEqual(['2', '2'])

    // The commit BETWEEN the stale answer landing and the URL self-heal is the
    // frame the queries above cannot see — so the invariant is asserted over
    // every frame the pager was actually rendered with: an unclamped page 5
    // must never have reached it.
    expect(paginationFrames.length).toBeGreaterThan(0)
    for (const frame of paginationFrames) {
      expect(frame.currentPage).toBeLessThanOrEqual(frame.totalPages)
    }
  })

  it('falls back to page 1 for a ?npg= whose offset would overflow the int32 skip cap', async () => {
    // (100000000 - 1) * 50 ≈ 5e9 — past the backend's `skip <= 2147483647`, so
    // the request could only come back 422. Same silent fallback as a bad ?nps=.
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 130, page: 1, page_size: 50, total_pages: 3 })
    )

    renderTab(['/?npg=100000000'])
    await screen.findByText('Коваленко Іван Петрович')

    expect(mockGetFeed).toHaveBeenCalledTimes(1)
    expect(mockGetFeed).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }))
    expect(pageIndicator()).toEqual(['1', '3'])
    // A view preference, not a filter: the value is ignored, not rewritten.
    expect(search()).toContain('npg=100000000')
  })

  it('shows the calm empty state (and no pager) for a day with nothing to work', async () => {
    // The routine case for this feed rather than an exception: 1-8 rows a day
    // means plenty of windows hold none. HTTP 200 with total 0, not a fault.
    mockGetFeed.mockResolvedValue(makeResponse([], { total: 0, total_pages: 0 }))

    renderTab()

    expect(await screen.findByText('pages.reports.inboundFollowup.empty')).toBeInTheDocument()
    // The pager's own label, as the global i18n mock renders it ("Page") — the
    // raw key never reaches the DOM, so querying for it would pass vacuously.
    expect(screen.queryByText('Page')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('renders empty telephony as plain "—" with no hint, banner or empty state', async () => {
    // 89 % of production rows have a responsible employee with no
    // asterisk_extension and 94 % have no call at all (probe 2026-08-25): two
    // blank call cells are CORRECT output. So they get the same placeholder as
    // any other missing value and nothing that reads as a fault or a warning —
    // and the calm "nothing to work" empty state stays reserved for a feed with
    // no ROWS, which this answer is not.
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow({ last_call_at: null, last_call_outcome: null })])
    )

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    // Exactly the two call cells — nothing else in this row is null.
    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(
      screen.queryByText('pages.reports.inboundFollowup.outcome.unknown')
    ).not.toBeInTheDocument()
    expect(screen.queryByText('pages.reports.inboundFollowup.empty')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders "—" for the other nullable columns and localises the call outcome', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([
        makeRow({ inn: null, interaction_type: null, department: null, group_name: null }),
      ])
    )

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    // inn, request reason, department, group
    expect(screen.getAllByText('—')).toHaveLength(4)
    // no_answer resolves through the shared classifier's
    // pages.clients.statuses.noAnswer key, which the global i18n mock maps
    // to readable text.
    expect(screen.getByText('No Answer')).toBeInTheDocument()
  })

  it('links a row to the client details route built from client_id', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow({ client_id: 777 })]))

    renderTab()

    expect(await screen.findByRole('link', { name: '1234567890' })).toHaveAttribute(
      'href',
      '/dashboard/clients/777'
    )
  })

  it('marks previous rows as busy while a new page is loading', async () => {
    let resolveSecond: (value: InboundFollowupResponse) => void = () => {}
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([makeRow()], { total: 130, page: 1, page_size: 50, total_pages: 3 })
      )
      .mockImplementationOnce(
        () => new Promise<InboundFollowupResponse>((resolve) => (resolveSecond = resolve))
      )

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    await userEvent.click(screen.getByTitle('2'))

    expect(await screen.findByTestId('inbound-followup-refreshing')).toBeInTheDocument()
    expect(screen.getByText('Коваленко Іван Петрович')).toBeInTheDocument()

    resolveSecond(
      makeResponse([makeRow({ client_id: 5, employee_name: 'Оновленко Олег' })], {
        total: 130,
        page: 2,
        page_size: 50,
        total_pages: 3,
      })
    )

    expect(await screen.findByText('Оновленко Олег')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByTestId('inbound-followup-refreshing')).not.toBeInTheDocument()
    )
  })

  it('shows an error state with retry and recovers after a successful refetch', async () => {
    mockGetFeed
      .mockRejectedValueOnce(makeHttpError(500))
      .mockResolvedValueOnce(makeResponse([makeRow()]))

    renderTab()

    expect(await screen.findByText('pages.reports.inboundFollowup.error.title')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.inboundFollowup.error.retry' })
    )

    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
  })

  it('shows the backend detail for a 400 validation answer', async () => {
    mockGetFeed.mockRejectedValue(
      makeHttpError(400, { detail: 'date_start must not be after date_end' })
    )

    renderTab()

    expect(await screen.findByText('date_start must not be after date_end')).toBeInTheDocument()
  })

  it('passes the candidate-cap refusal through so the operator knows which knob to turn', async () => {
    // The hard cap is deliberately a 400, not a 503: its detail names the feed,
    // the count, the configured maximum and the remedy, and the shared axios
    // client does not auto-retry a 400 over the very population the cap refuses
    // to fan out over.
    mockGetFeed.mockRejectedValue(
      makeHttpError(400, {
        detail:
          'Inbound follow-up feed: 12000 candidates exceed the maximum of 10000 — request a narrower date window',
      })
    )

    renderTab()

    expect(await screen.findByText(/request a narrower date window/)).toBeInTheDocument()
    // Not the generic title, and not the unavailability wording.
    expect(screen.queryByText('pages.reports.inboundFollowup.error.title')).not.toBeInTheDocument()
    expect(screen.queryByText('pages.reports.inboundFollowup.unavailable')).not.toBeInTheDocument()
    // A 400 IS retryable by hand — the state it refuses is a filter choice.
    expect(
      screen.getByRole('button', { name: 'pages.reports.inboundFollowup.error.retry' })
    ).toBeInTheDocument()
  })

  it('falls back to the localized title for a 400 whose body never arrived', async () => {
    // A proxy that strips the body would otherwise leave axios' own
    // untranslated "Request failed with status code 400" on screen.
    mockGetFeed.mockRejectedValue(makeHttpError(400))

    renderTab()

    expect(await screen.findByText('pages.reports.inboundFollowup.error.title')).toBeInTheDocument()
    expect(screen.queryByText(/Request failed with status code/)).not.toBeInTheDocument()
  })

  it('shows a permissions message without a retry button on 403', async () => {
    // The endpoint gate is `view_all_reports` + project access — the same
    // permission the Reports page itself is guarded by, so a 403 here means the
    // user reached the tab without the report permission. Retrying cannot fix it.
    mockGetFeed.mockRejectedValue(makeHttpError(403, { detail: 'Not enough permissions' }))

    renderTab()

    expect(await screen.findByText('pages.reports.inboundFollowup.forbidden')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'pages.reports.inboundFollowup.error.retry' })
    ).not.toBeInTheDocument()
    // The localized sentence stands alone — the server's English detail is not
    // shown for a 403 (it explains nothing the message does not).
    expect(screen.queryByText('Not enough permissions')).not.toBeInTheDocument()
  })

  it.each([502, 503, 504])(
    'shows the dedicated unavailability message on transient %d errors',
    async (status) => {
      // 503 is what the endpoint answers when EITHER internal lookup fails —
      // never a partial feed.
      mockGetFeed.mockRejectedValue(makeHttpError(status))

      renderTab()

      expect(
        await screen.findByText('pages.reports.inboundFollowup.unavailable')
      ).toBeInTheDocument()
    }
  )

  it.each([
    ['the auth-service directory is down', 'User directory service is unavailable'],
    ['the call-service is down', 'Call service is unavailable'],
    ['the call-service is throttling', 'Call service is throttling requests'],
    ['the fan-out deadline expired', 'internal lookups timed out'],
  ])(
    'keeps the localized message but names the failing dependency when %s',
    async (_case, detail) => {
      // The backend words its FOUR 503s distinctly because the remedies differ
      // (an outage, a second outage, throttling, a timeout). The operator reads
      // their own language; the server's sentence sits under it so whoever is
      // asked "what does it say?" can tell the four apart.
      mockGetFeed.mockRejectedValue(makeHttpError(503, { detail }))

      renderTab()

      expect(
        await screen.findByText('pages.reports.inboundFollowup.unavailable')
      ).toBeInTheDocument()
      expect(screen.getByText(detail)).toBeInTheDocument()
    }
  )

  it('shows no detail line for a transient failure that carries no body', async () => {
    // A 502 from a proxy or a dropped connection has nothing to say — the
    // localized sentence must stand alone rather than gain axios' own text.
    mockGetFeed.mockRejectedValue(makeHttpError(502))

    renderTab()

    expect(await screen.findByText('pages.reports.inboundFollowup.unavailable')).toBeInTheDocument()
    expect(screen.queryByText(/Request failed with status code/)).not.toBeInTheDocument()
  })

  it('treats network failures as transient unavailability too', async () => {
    mockGetFeed.mockRejectedValue(makeNetworkError('ERR_NETWORK'))

    renderTab()

    expect(await screen.findByText('pages.reports.inboundFollowup.unavailable')).toBeInTheDocument()
  })

  it('does not crash on an unexpected 422 from a hand-crafted request', async () => {
    // Unreachable through the UI (the inputs are constrained), but it must
    // land in the generic error branch instead of breaking the tab.
    mockGetFeed.mockRejectedValue(makeHttpError(422, { detail: [{ msg: 'bad' }] }))

    renderTab()

    expect(await screen.findByText('pages.reports.inboundFollowup.error.title')).toBeInTheDocument()
  })
})

describe('InboundFollowup locale keys', () => {
  // The tab renders KEYS in tests (react-i18next is mocked globally), so
  // nothing above would notice a key added to one locale only — these read the
  // actual translation files.
  const uk = ukCommon.pages.reports.inboundFollowup
  const en = enCommon.pages.reports.inboundFollowup

  function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
    return Object.entries(obj).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key
      return value && typeof value === 'object' && !Array.isArray(value)
        ? flatten(value as Record<string, unknown>, path)
        : [path]
    })
  }

  it('carries the same key set, and the same number of keys, in both locales', () => {
    const ukKeys = flatten(uk).sort()
    const enKeys = flatten(en).sort()

    expect(ukKeys).toEqual(enKeys)
    expect(ukKeys).toHaveLength(enKeys.length)
  })

  it('names the tab in both locales', () => {
    expect(ukCommon.pages.reports.tabs['inbound-followup']).toBe('Вхід без відпрацювання')
    expect(enCommon.pages.reports.tabs['inbound-followup']).toBe('Inbound without follow-up')
  })

  it('keeps its own copy distinct from the sibling searcher feed’s', () => {
    // The two feeds share a shape, not a vocabulary: a copy-pasted subtree
    // would leave operators reading «Дата знахідки» over a column of request
    // dates, and the empty state promising there are no searcher finds.
    const searcher = ukCommon.pages.reports.searcherFollowup
    expect(uk.dateFrom).not.toBe(searcher.dateFrom)
    expect(uk.dateTo).not.toBe(searcher.dateTo)
    expect(uk.empty).not.toBe(searcher.empty)
    expect(uk.columns.interactionAt).not.toBe(searcher.columns.foundAt)
    // …and the request-reason column follows the source system's own PLURAL
    // header rather than the singular target-action name.
    expect(uk.columns.interactionType).toBe('Причини звернення')
  })
})
