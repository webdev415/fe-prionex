import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { LowVerificationFeedTab } from '../LowVerificationFeedTab'
import { getLowVerificationFeed } from '../../api/lowVerificationFeedApi'
import type { LowVerificationFeedResponse, LowVerificationFeedRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key,
// except for the floor hint, which the mock renders as `<key>:<count>` so the
// month count travelling from the response stays assertable.

vi.mock('../../api/lowVerificationFeedApi', () => ({
  getLowVerificationFeed: vi.fn(),
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
// the component's hardcoded "Clear" — so these tests can't over-promise a
// name the shipped component never renders. `error` is mirrored the same way:
// the real component renders it as a role="alert" paragraph and marks the
// field aria-invalid/aria-describedby, so field-level error wiring is
// assertable here.
vi.mock('@/components/ui/DateSelect', () => ({
  DateSelect: ({
    value,
    onChange,
    onClear,
    clearLabel,
    label,
    error,
  }: {
    value?: string | Date | null
    onChange?: (args: { value: Date | null }) => void
    onClear?: () => void
    clearLabel?: string
    label?: string
    error?: string
  }) => {
    const errorId = `date-select-error-${label ?? ''}`
    return (
      <>
        <input
          data-testid="date-select"
          aria-label={label}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) =>
            // Noon avoids the parsed UTC date rolling into the previous local day
            onChange?.({ value: e.target.value ? new Date(`${e.target.value}T12:00:00`) : null })
          }
        />
        {/* Same gate as the real component's `showClear` (onClear AND a date
            actually set) — an unconditional "×" would let a test click a
            control production does not render. */}
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

const mockGetFeed = vi.mocked(getLowVerificationFeed)

function makeRow(overrides: Partial<LowVerificationFeedRow> = {}): LowVerificationFeedRow {
  return {
    client_id: 84213,
    inn: '1234567890',
    employee_id: 6959,
    full_name: 'Коваленко Іван Петрович',
    department: 'Дайлер',
    group_name: 'Полка',
    sell_date: '2026-07-29',
    assignment_date: '2026-07-30',
    last_interaction_date: null,
    body_amount: '15000.00',
    verified_count: 0,
    ...overrides,
  }
}

function makeResponse(
  rows: LowVerificationFeedRow[],
  overrides: Partial<LowVerificationFeedResponse> = {}
): LowVerificationFeedResponse {
  return {
    project_id: 1,
    sell_from: null,
    sell_to: null,
    max_verified: null,
    // The backend echoes the floor it applied; 2 is its default.
    months_floor: 2,
    rows,
    total: rows.length,
    page: 1,
    page_size: 50,
    total_pages: rows.length > 0 ? 1 : 0,
    generated_at: '2026-08-12T09:00:00Z',
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
        <LowVerificationFeedTab />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const dateInputs = () => screen.getAllByTestId('date-select') as HTMLInputElement[]
const maxVerifiedInput = () =>
  screen.getByLabelText('pages.reports.lowVerification.maxVerified') as HTMLInputElement
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
  authState.user.timezone = null
})

describe('LowVerificationFeedTab', () => {
  it('requests the first page with no filters by default', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()

    const [sellFrom, sellTo] = dateInputs()
    expect(sellFrom.value).toBe('')
    expect(sellTo.value).toBe('')
    expect(maxVerifiedInput().value).toBe('')

    // No sell bounds, no cap, no timezone for a profile without one (the
    // backend then defaults to UTC); pagination mirrors its own defaults.
    expect(mockGetFeed).toHaveBeenCalledTimes(1)
    expect(mockGetFeed).toHaveBeenCalledWith({ project_id: 1, skip: 0, limit: 50 })
  })

  it('sends the profile IANA timezone to the API when the user has one', async () => {
    authState.user.timezone = 'Europe/Kyiv'
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    // It cuts assignment_date only — last_interaction_date stays a UTC cut
    // server-side and is never shifted on the client.
    expect(mockGetFeed).toHaveBeenCalledWith(expect.objectContaining({ timezone: 'Europe/Kyiv' }))
  })

  it('reads every filter from the URL (?pf=&pt=&mv=)', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?pf=2026-06-01&pt=2026-06-30&mv=2'])
    await screen.findByText('Коваленко Іван Петрович')

    expect(mockGetFeed).toHaveBeenCalledWith(
      expect.objectContaining({
        sell_from: '2026-06-01',
        sell_to: '2026-06-30',
        max_verified: 2,
      })
    )
    const [sellFrom, sellTo] = dateInputs()
    expect(sellFrom.value).toBe('2026-06-01')
    expect(sellTo.value).toBe('2026-06-30')
    expect(maxVerifiedInput().value).toBe('2')
  })

  it.each([
    ['sell_from', 'pf', 'sell_from', 'sell_to'],
    ['sell_to', 'pt', 'sell_to', 'sell_from'],
  ])(
    'sends an independent %s bound without the other one',
    async (_case, urlKey, sentKey, absentKey) => {
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab([`/?${urlKey}=2026-06-10`])
      await screen.findByText('Коваленко Іван Петрович')

      const params: Record<string, unknown> = { ...mockGetFeed.mock.calls[0][0] }
      expect(params[sentKey]).toBe('2026-06-10')
      // A single bound is a legitimate open-ended filter — the other key must
      // not be invented (an empty value would be a 400 on the backend).
      expect(absentKey in params).toBe(false)
    }
  )

  it('sends max_verified=0 — the falsy value that means "never verified"', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?mv=0'])
    await screen.findByText('Коваленко Іван Петрович')

    const params: Record<string, unknown> = { ...mockGetFeed.mock.calls[0][0] }
    expect(params.max_verified).toBe(0)
  })

  it('writes a picked sell date into the URL and clears it again', async () => {
    mockGetFeed
      .mockResolvedValueOnce(makeResponse([makeRow()]))
      .mockResolvedValueOnce(
        makeResponse([makeRow({ client_id: 2, full_name: 'Фільтренко Федір' })])
      )

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    const [sellFrom] = dateInputs()
    fireEvent.change(sellFrom, { target: { value: '2026-06-10' } })

    await waitFor(() => expect(search()).toContain('pf=2026-06-10'))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(
        expect.objectContaining({ sell_from: '2026-06-10' })
      )
    )
    expect(await screen.findByText('Фільтренко Федір')).toBeInTheDocument()

    // The opt-in "×" removes the bound entirely (onChange(null) would only be
    // an abandoned manual entry and must not drop the filter).
    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.lowVerification.clearSellFrom' })
    )

    await waitFor(() => expect(search()).not.toContain('pf='))
    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
    // Back on the unfiltered query key, still fresh in the React Query cache.
    expect(mockGetFeed).toHaveBeenCalledTimes(2)
  })

  it('commits the max_verified input on blur, not on every keystroke', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    // Typing alone must not fire a request: this endpoint scans the whole
    // candidate set (3–6 s cold), so "100" must not cost three round trips.
    fireEvent.change(maxVerifiedInput(), { target: { value: '1' } })
    fireEvent.change(maxVerifiedInput(), { target: { value: '10' } })
    expect(mockGetFeed).toHaveBeenCalledTimes(1)

    fireEvent.blur(maxVerifiedInput())

    await waitFor(() => expect(search()).toContain('mv=10'))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ max_verified: 10 }))
    )
  })

  it('clears the max_verified filter through the "×" of the input', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?mv=3'])
    await screen.findByText('Коваленко Іван Петрович')

    // Input's own opt-in clear button, under the field-specific name — three
    // "×" buttons stand in this filter row and a bare "Clear" would name all
    // three the same.
    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.lowVerification.clearMaxVerified' })
    )

    await waitFor(() => expect(search()).not.toContain('mv='))
    await waitFor(() => {
      const params: Record<string, unknown> = {
        ...mockGetFeed.mock.calls[mockGetFeed.mock.calls.length - 1][0],
      }
      expect('max_verified' in params).toBe(false)
    })
  })

  it.each([
    ['a day the month does not have', '/?pf=2026-02-31', 0],
    ['a month that does not exist', '/?pt=2026-13-01', 1],
  ])('blocks a hand-edited sell bound with %s', async (_case, entry, offendingIndex) => {
    // Shape-only validation would let these through: comparisons against NaN
    // are all false and the request would go out with a date the picker itself
    // renders as a different day.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([entry])

    expect(
      await screen.findByText('pages.reports.lowVerification.invalidSellDate')
    ).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()

    // A single-field error rides that field: only the bound holding the bad
    // value is marked, and its message is reachable from the field itself.
    const fields = dateInputs()
    expect(fields[offendingIndex]).toHaveAttribute('aria-invalid', 'true')
    expect(fields[1 - offendingIndex]).not.toHaveAttribute('aria-invalid')
    const describedBy = fields[offendingIndex].getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      'pages.reports.lowVerification.invalidSellDate'
    )
    // An unusable bound is not a value the picker can hold, so it renders no
    // "×" to take it back — which is exactly why the message names the LINK as
    // the source and asks for a date instead of pointing at a missing control.
    expect(
      screen.queryByRole('button', {
        name: [
          'pages.reports.lowVerification.clearSellFrom',
          'pages.reports.lowVerification.clearSellTo',
        ][offendingIndex],
      })
    ).not.toBeInTheDocument()
  })

  it('blocks an inverted sell window but accepts a lone bound after it', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?pf=2026-06-20&pt=2026-06-10'])

    expect(
      await screen.findByText('pages.reports.lowVerification.invalidSellRange')
    ).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()

    // A pair error stays a standalone alert: neither bound is wrong on its own,
    // so neither field is singled out as invalid.
    for (const field of dateInputs()) {
      expect(field).not.toHaveAttribute('aria-invalid')
    }

    // Dropping the upper bound leaves a valid open-ended filter — the pair
    // rule applies only when BOTH bounds are set.
    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.lowVerification.clearSellTo' })
    )

    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
    expect(mockGetFeed).toHaveBeenCalledWith(expect.objectContaining({ sell_from: '2026-06-20' }))
  })

  it.each([
    ['a negative cap', '/?mv=-1', '-1'],
    ['a fractional cap', '/?mv=1.5', '1.5'],
    ['a non-numeric cap', '/?mv=abc', 'abc'],
  ])('blocks a hand-edited max_verified with %s', async (_case, entry, raw) => {
    // The value can only be this bad from a hand-edited URL; it earns an inline
    // hint instead of the 422 the backend would answer with.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([entry])

    expect(
      await screen.findByText('pages.reports.lowVerification.invalidMaxVerified')
    ).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()

    // Single-field error → it rides the field (red border, aria-invalid) and
    // the message is what aria-describedby points at.
    const field = maxVerifiedInput()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    const describedBy = field.getAttribute('aria-describedby')
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      'pages.reports.lowVerification.invalidMaxVerified'
    )
    // ...and the offending value stays VISIBLE: a number input would coerce
    // "abc" to an empty string, leaving a hint pointing at a blank field.
    expect(field).toHaveAttribute('type', 'text')
    expect(field.value).toBe(raw)
  })

  it('blocks a max_verified past the int32 ceiling with the CEILING sentence', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?mv=2147483648'])

    // Deliberate wording split: 2147483648 IS "a whole number of 0 or more",
    // so the malformed-value hint would describe everything except the actual
    // violation — the ceiling refusal gets its own sentence. (Same split as
    // the sibling feed's gap_min.)
    expect(
      await screen.findByText('pages.reports.lowVerification.maxVerifiedTooLarge')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('pages.reports.lowVerification.invalidMaxVerified')
    ).not.toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()

    // Same field-level wiring as every other single-field refusal.
    const field = maxVerifiedInput()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    const describedBy = field.getAttribute('aria-describedby')
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      'pages.reports.lowVerification.maxVerifiedTooLarge'
    )
  })

  it('pages through the feed with the right skip and keeps the page in the URL', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 130, page: 1, page_size: 50, total_pages: 3 })
    )

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    await userEvent.click(screen.getByTitle('3'))

    await waitFor(() => expect(search()).toContain('pg=3'))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(
        expect.objectContaining({ skip: 100, limit: 50 })
      )
    )
  })

  it('sends a supported ?ps= as the limit, and offsets the page by it', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 260, page: 2, page_size: 100, total_pages: 3 })
    )

    renderTab(['/?ps=100&pg=2'])
    await screen.findByText('Коваленко Іван Петрович')

    // skip is derived from the ACTIVE page size, not the default one.
    expect(mockGetFeed).toHaveBeenCalledWith(expect.objectContaining({ skip: 100, limit: 100 }))
  })

  it.each([
    ['a size outside the offered options', '/?ps=999'],
    ['a non-numeric size', '/?ps=abc'],
  ])('falls back to the default limit for %s', async (_case, entry) => {
    // 999 would also break the backend's `limit <= 500`. A page size is a view
    // preference, not a filter: an unusable one is ignored silently (no hint,
    // no rewrite of the URL) rather than blocking the request.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([entry])
    await screen.findByText('Коваленко Іван Петрович')

    expect(mockGetFeed).toHaveBeenCalledTimes(1)
    expect(mockGetFeed).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }))
    expect(search()).toContain('ps=')
  })

  it('writes a non-default rows-per-page into ?ps=, drops it again for the default', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 260, page: 1, page_size: 50, total_pages: 6 })
    )

    renderTab(['/?pg=3'])
    await screen.findByText('Коваленко Іван Петрович')

    await selectPageSize('100')

    // A new page size invalidates the old offset — the pager resets to page 1,
    // and page 1 is the default, so `pg` leaves the URL in the same update.
    await waitFor(() => expect(search()).toContain('ps=100'))
    expect(search()).not.toContain('pg=')
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 0, limit: 100 }))
    )

    await selectPageSize('50')

    // The default is the absence of the key — it is never spelled out.
    await waitFor(() => expect(search()).not.toContain('ps='))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 50 }))
    )
  })

  it('resets to page 1 when a filter changes', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 130, page: 3, page_size: 50, total_pages: 3 })
    )

    renderTab(['/?pg=3'])
    await screen.findByText('Коваленко Іван Петрович')
    expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 100 }))

    fireEvent.change(dateInputs()[0], { target: { value: '2026-06-10' } })

    // Otherwise the user lands on an offset the new filter may not even have.
    await waitFor(() => expect(search()).not.toContain('pg='))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(
        expect.objectContaining({ sell_from: '2026-06-10', skip: 0 })
      )
    )
  })

  it('heals a stale ?pg= down to the last page the answer still has', async () => {
    // A shared link outlives the rows it pointed at: the feed drained to two
    // pages while `?pg=5` stayed in the URL.
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([], { total: 90, page: 5, page_size: 50, total_pages: 2 })
      )
      .mockResolvedValue(
        makeResponse([makeRow()], { total: 90, page: 2, page_size: 50, total_pages: 2 })
      )

    renderTab(['/?pg=5'])

    // The page count is only known from an answer, so the stale offset does go
    // out once — but exactly once, and never again after the URL self-heals.
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenNthCalledWith(1, expect.objectContaining({ skip: 200 }))
    )
    await waitFor(() => expect(search()).toContain('pg=2'))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 50, limit: 50 }))
    )
    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
    expect(mockGetFeed).toHaveBeenCalledTimes(2)

    // A dead offset is not a failure — no error branch on the way through.
    expect(
      screen.queryByRole('button', { name: 'pages.reports.lowVerification.error.retry' })
    ).not.toBeInTheDocument()
  })

  it('never renders "Page N of M" with N past M while a stale ?pg= heals', async () => {
    let resolveHealed: (value: LowVerificationFeedResponse) => void = () => {}
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([], { total: 90, page: 5, page_size: 50, total_pages: 2 })
      )
      .mockImplementationOnce(
        () => new Promise<LowVerificationFeedResponse>((resolve) => (resolveHealed = resolve))
      )

    renderTab(['/?pg=5'])

    // Placeholder frame: the stale page's answer is still on screen while the
    // healed page loads, and the pager already reads the clamped page.
    expect(await screen.findByTestId('low-verification-refreshing')).toBeInTheDocument()
    expect(pageIndicator()).toEqual(['2', '2'])
    expect(screen.queryByTitle('5')).not.toBeInTheDocument()

    resolveHealed(makeResponse([makeRow()], { total: 90, page: 2, page_size: 50, total_pages: 2 }))

    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
    expect(pageIndicator()).toEqual(['2', '2'])
  })

  it('falls back to page 1 for a ?pg= whose offset would overflow the int32 skip cap', async () => {
    // (100000000 - 1) * 50 ≈ 5e9 — past the backend's `skip <= 2147483647`, so
    // the request could only come back 422. Same silent fallback as a bad ?ps=.
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 130, page: 1, page_size: 50, total_pages: 3 })
    )

    renderTab(['/?pg=100000000'])
    await screen.findByText('Коваленко Іван Петрович')

    expect(mockGetFeed).toHaveBeenCalledTimes(1)
    expect(mockGetFeed).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }))
    expect(pageIndicator()).toEqual(['1', '3'])
    // A view preference, not a filter: the value is ignored, not rewritten —
    // the tab treats an unusable ?ps= the same way.
    expect(search()).toContain('pg=100000000')
  })

  it('shows the calm empty state (and no pager) for a drained feed', async () => {
    // The two-month floor legitimately empties the feed between purchase
    // batches — HTTP 200 with total 0, not a fault.
    mockGetFeed.mockResolvedValue(makeResponse([], { total: 0, total_pages: 0 }))

    renderTab()

    expect(await screen.findByText('pages.reports.lowVerification.empty')).toBeInTheDocument()
    // The pager's own label, as the global i18n mock renders it ("Page") — the
    // raw key never reaches the DOM, so querying for it would pass vacuously.
    expect(screen.queryByText('Page')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    // The empty state is exactly the case the hint explains, so it must survive
    // it — with the floor the ANSWER carried, not a constant of our own.
    expect(screen.getByText('pages.reports.lowVerification.floorHint:2')).toBeInTheDocument()
  })

  it('takes the floor hint from the response, not from a constant', async () => {
    // A different LOW_VERIFICATION_MONTHS_FLOOR in the environment reaches the
    // copy through the payload alone — nothing here has to be edited with it.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()], { months_floor: 3 }))

    renderTab()

    expect(await screen.findByText('pages.reports.lowVerification.floorHint:3')).toBeInTheDocument()
    expect(screen.queryByText('pages.reports.lowVerification.floorHint:2')).not.toBeInTheDocument()
  })

  it('shows no floor hint before the first answer arrives', async () => {
    // Nothing to explain yet, and no floor to name: the hint waits rather than
    // guessing (a guess is the drift it exists to prevent).
    mockGetFeed.mockImplementation(() => new Promise<LowVerificationFeedResponse>(() => {}))

    renderTab()

    await waitFor(() => expect(mockGetFeed).toHaveBeenCalled())
    expect(screen.queryByText(/floorHint/)).not.toBeInTheDocument()
  })

  it('renders "—" for nullable columns and formats the Decimal debt amount', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow({ inn: null, group_name: null, assignment_date: null })])
    )

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    // inn, group_name, assignment_date, last_interaction_date
    expect(screen.getAllByText('—')).toHaveLength(4)
    expect(screen.getByText('15,000.00')).toBeInTheDocument()
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
    let resolveSecond: (value: LowVerificationFeedResponse) => void = () => {}
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([makeRow()], { total: 130, page: 1, page_size: 50, total_pages: 3 })
      )
      .mockImplementationOnce(
        () => new Promise<LowVerificationFeedResponse>((resolve) => (resolveSecond = resolve))
      )

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    await userEvent.click(screen.getByTitle('2'))

    expect(await screen.findByTestId('low-verification-refreshing')).toBeInTheDocument()
    expect(screen.getByText('Коваленко Іван Петрович')).toBeInTheDocument()

    resolveSecond(
      makeResponse([makeRow({ client_id: 5, full_name: 'Оновленко Олег' })], {
        total: 130,
        page: 2,
        page_size: 50,
        total_pages: 3,
      })
    )

    expect(await screen.findByText('Оновленко Олег')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByTestId('low-verification-refreshing')).not.toBeInTheDocument()
    )
  })

  it('shows an error state with retry and recovers after a successful refetch', async () => {
    mockGetFeed
      .mockRejectedValueOnce(makeHttpError(500))
      .mockResolvedValueOnce(makeResponse([makeRow()]))

    renderTab()

    expect(await screen.findByText('pages.reports.lowVerification.error.title')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.lowVerification.error.retry' })
    )

    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
  })

  it('shows the backend detail for a 400 validation answer', async () => {
    mockGetFeed.mockRejectedValue(
      makeHttpError(400, { detail: 'sell_from must not be after sell_to' })
    )

    renderTab()

    expect(await screen.findByText('sell_from must not be after sell_to')).toBeInTheDocument()
  })

  it('falls back to the localized title for a 400 whose body never arrived', async () => {
    // THE ONE DELIBERATE BEHAVIOUR CHANGE of the shared error ladder. This tab
    // used to gate its 400 on the status alone, so a body-less answer — what a
    // proxy that strips the body produces — reached the operator as whatever
    // `getErrorMessage` could scrape off the error: in production axios'
    // untranslated "Request failed with status code 400", here this suite's
    // own `HTTP 400`. The nine sibling tabs already gated on
    // `hasResponseDetail`; this pins that this one now does too.
    //
    // The case above (a 400 WITH a detail) stays green either way, which is
    // exactly why it could not stand in for this one.
    //
    // The absence assertion names the helper's OWN message rather than the
    // axios wording: the helper never produces the axios sentence, so checking
    // for that would pass whatever the tab rendered.
    mockGetFeed.mockRejectedValue(makeHttpError(400))

    renderTab()

    expect(await screen.findByText('pages.reports.lowVerification.error.title')).toBeInTheDocument()
    expect(screen.queryByText(/HTTP 400/)).not.toBeInTheDocument()
  })

  it('shows a permissions message without a retry button on 403', async () => {
    mockGetFeed.mockRejectedValue(makeHttpError(403))

    renderTab()

    expect(await screen.findByText('pages.reports.lowVerification.forbidden')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'pages.reports.lowVerification.error.retry' })
    ).not.toBeInTheDocument()
  })

  it.each([502, 503, 504])(
    'shows the dedicated unavailability message on transient %d errors',
    async (status) => {
      // 503 is what the endpoint answers when the auth-service directory is
      // down — never a partial feed.
      mockGetFeed.mockRejectedValue(makeHttpError(status))

      renderTab()

      expect(
        await screen.findByText('pages.reports.lowVerification.unavailable')
      ).toBeInTheDocument()
    }
  )

  it('treats network failures as transient unavailability too', async () => {
    mockGetFeed.mockRejectedValue(makeNetworkError('ERR_NETWORK'))

    renderTab()

    expect(await screen.findByText('pages.reports.lowVerification.unavailable')).toBeInTheDocument()
  })

  it('does not crash on an unexpected 422 from a hand-crafted request', async () => {
    // Unreachable through the UI (the inputs are constrained), but it must
    // land in the generic error branch instead of breaking the tab.
    mockGetFeed.mockRejectedValue(makeHttpError(422, { detail: [{ msg: 'bad' }] }))

    renderTab()

    expect(await screen.findByText('pages.reports.lowVerification.error.title')).toBeInTheDocument()
  })
})
