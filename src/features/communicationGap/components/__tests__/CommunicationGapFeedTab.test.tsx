import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { CommunicationGapFeedTab } from '../CommunicationGapFeedTab'
import { getCommunicationGapFeed } from '../../api/communicationGapFeedApi'
import type { CommunicationGapFeedResponse, CommunicationGapFeedRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key.

vi.mock('../../api/communicationGapFeedApi', () => ({
  getCommunicationGapFeed: vi.fn(),
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
// these tests can't over-promise a control the shipped component never renders.
// `error` is mirrored the same way: the real component renders it as a
// role="alert" paragraph and marks the field aria-invalid/aria-describedby, so
// field-level error wiring is assertable here.
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

// The transient-frame invariant ("Page N of M" with N past M must never reach
// the DOM, not even for the single commit between a stale answer landing and
// the ?gpg= self-heal rewriting the URL) is invisible to polling queries: the
// heal effect has already run by the time any waitFor observer looks. A
// pass-through wrapper records every (currentPage, totalPages) pair the REAL
// Pagination is rendered with, so the healing test can assert over ALL frames,
// including the intermediate one. Every other test renders the genuine
// component untouched.
const paginationFrames = vi.hoisted(() => [] as Array<{ currentPage: number; totalPages: number }>)
vi.mock('@/components/ui/Pagination', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/Pagination')>()
  return {
    Pagination: (props: import('@/components/ui/Pagination').PaginationProps) => {
      paginationFrames.push({ currentPage: props.currentPage, totalPages: props.totalPages })
      return <actual.Pagination {...props} />
    },
  }
})

const mockGetFeed = vi.mocked(getCommunicationGapFeed)

function makeRow(overrides: Partial<CommunicationGapFeedRow> = {}): CommunicationGapFeedRow {
  return {
    client_id: 84213,
    inn: '1234567890',
    sell_date: '2026-07-04',
    assignment_date: '2026-07-10',
    last_promise_date: null,
    employee_id: 6959,
    employee_name: 'Коваленко Іван Петрович',
    department: 'ТП',
    group_name: 'Група №1',
    body_amount: '15000.00',
    last_interaction_date: '2026-08-02',
    communication_gap: 15,
    ...overrides,
  }
}

function makeResponse(
  rows: CommunicationGapFeedRow[],
  overrides: Partial<CommunicationGapFeedResponse> = {}
): CommunicationGapFeedResponse {
  return {
    project_id: 1,
    sell_from: null,
    sell_to: null,
    gap_min: null,
    rows,
    total: rows.length,
    page: 1,
    page_size: 50,
    total_pages: rows.length > 0 ? 1 : 0,
    generated_at: '2026-08-17T09:00:00Z',
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
        <CommunicationGapFeedTab />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const dateInputs = () => screen.getAllByTestId('date-select') as HTMLInputElement[]
const gapMinInput = () =>
  screen.getByLabelText('pages.reports.communicationGap.gapMin') as HTMLInputElement
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
  paginationFrames.length = 0
  authState.user.timezone = null
})

describe('CommunicationGapFeedTab', () => {
  it('requests the whole feed with no filters by default', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()

    const [sellFrom, sellTo] = dateInputs()
    expect(sellFrom.value).toBe('')
    expect(sellTo.value).toBe('')
    expect(gapMinInput().value).toBe('')

    // No sell bounds, no minimum, no timezone for a profile without one (the
    // backend then defaults to UTC); pagination mirrors its own defaults. There
    // is deliberately NO default window here — Card 125 and its
    // Techno-Finance usage both default to the whole population, unlike the
    // searcher tab's today–today.
    expect(mockGetFeed).toHaveBeenCalledTimes(1)
    expect(mockGetFeed).toHaveBeenCalledWith({ project_id: 1, skip: 0, limit: 50 })
    // ...and nothing auto-derived is pinned into the URL either.
    expect(search()).not.toContain('gf=')
    expect(search()).not.toContain('gt=')
  })

  it('sends the profile IANA timezone to the API when the user has one', async () => {
    authState.user.timezone = 'Europe/Kyiv'
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    // Server-side it governs the reference "today" the gap is measured
    // against, the assignment/promise day cuts and the 30-day payment window —
    // last_interaction_date stays a UTC cut and nothing is shifted here.
    expect(mockGetFeed).toHaveBeenCalledWith(expect.objectContaining({ timezone: 'Europe/Kyiv' }))
  })

  it('reads every filter and the page window from the URL (?gf=&gt=&gm=&gpg=&gps=)', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 260, page: 2, page_size: 100, total_pages: 3 })
    )

    renderTab(['/?gf=2026-06-01&gt=2026-06-30&gm=10&gpg=2&gps=100'])
    await screen.findByText('Коваленко Іван Петрович')

    // skip is derived from the ACTIVE page size, not the default one.
    expect(mockGetFeed).toHaveBeenCalledWith({
      project_id: 1,
      sell_from: '2026-06-01',
      sell_to: '2026-06-30',
      gap_min: 10,
      skip: 100,
      limit: 100,
    })
    const [sellFrom, sellTo] = dateInputs()
    expect(sellFrom.value).toBe('2026-06-01')
    expect(sellTo.value).toBe('2026-06-30')
    expect(gapMinInput().value).toBe('10')
  })

  it.each([
    ['sell_from', 'gf', 'sell_from', 'sell_to'],
    ['sell_to', 'gt', 'sell_to', 'sell_from'],
  ])(
    'sends an independent %s bound without the other one',
    async (_case, urlKey, sentKey, absentKey) => {
      // The card's two `[[…]]` blocks are separate, so the backend accepts one
      // bound alone as an open-ended filter (unlike the searcher feed's
      // both-or-neither pair).
      mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

      renderTab([`/?${urlKey}=2026-06-10`])
      await screen.findByText('Коваленко Іван Петрович')

      const params: Record<string, unknown> = { ...mockGetFeed.mock.calls[0][0] }
      expect(params[sentKey]).toBe('2026-06-10')
      // The other key must not be invented (an empty value would be a 400).
      expect(absentKey in params).toBe(false)
    }
  )

  it('sends gap_min=0 — the falsy value the backend accepts as its own floor', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?gm=0'])
    await screen.findByText('Коваленко Іван Петрович')

    const params: Record<string, unknown> = { ...mockGetFeed.mock.calls[0][0] }
    expect(params.gap_min).toBe(0)
  })

  it('neither consumes nor clobbers the other report tabs’ URL params', async () => {
    // The host page keeps every tab's params in the URL, so this tab renders
    // with the COMPLETE key set of every other tab present: the host's own
    // `tab`, processing (`from`, `to`, `dept`), verification (`sf`, `st`, `cf`,
    // `ct`), the low-verification feed (`pf`, `pt`, `mv`, `pg`, `ps`) and the
    // searcher feed (`if`, `it`, `spg`, `sps`). None of them may leak into this
    // tab's request — and writing this tab's own keys must leave every one of
    // them untouched. Seeding the whole set (not a sample) is what makes the
    // key-collision check exhaustive: a partial one would pass over a key this
    // tab had quietly started reading or dropping.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([
      '/?tab=communication-gap&from=2026-03-03&to=2026-03-31&dept=12' +
        '&sf=2026-02-02&st=2026-02-28&cf=2026-05-05&ct=2026-05-31' +
        '&pf=2026-01-01&pt=2026-01-31&mv=4&pg=7&ps=100' +
        '&if=2026-04-04&it=2026-04-30&spg=5&sps=20',
    ])
    await screen.findByText('Коваленко Іван Петрович')

    // Foreign date keys are not this tab's window, the foreign `mv` is not this
    // tab's minimum, and neither sibling feed's paging is this tab's paging.
    const params: Record<string, unknown> = { ...mockGetFeed.mock.calls[0][0] }
    expect('sell_from' in params).toBe(false)
    expect('sell_to' in params).toBe(false)
    expect('gap_min' in params).toBe(false)
    expect(params.skip).toBe(0)
    expect(params.limit).toBe(50)

    // Now write this tab's own state...
    fireEvent.change(dateInputs()[0], { target: { value: '2026-08-05' } })
    await waitFor(() => expect(search()).toContain('gf=2026-08-05'))

    // ...and every foreign key survives verbatim.
    expect(search()).toContain('tab=communication-gap')
    expect(search()).toContain('from=2026-03-03')
    expect(search()).toContain('to=2026-03-31')
    expect(search()).toContain('dept=12')
    expect(search()).toContain('sf=2026-02-02')
    expect(search()).toContain('st=2026-02-28')
    expect(search()).toContain('cf=2026-05-05')
    expect(search()).toContain('ct=2026-05-31')
    expect(search()).toContain('pf=2026-01-01')
    expect(search()).toContain('pt=2026-01-31')
    expect(search()).toContain('mv=4')
    expect(search()).toContain('pg=7')
    expect(search()).toContain('ps=100')
    expect(search()).toContain('if=2026-04-04')
    expect(search()).toContain('it=2026-04-30')
    expect(search()).toContain('spg=5')
    expect(search()).toContain('sps=20')
  })

  it('writes a picked sell date into the URL and clears it again', async () => {
    mockGetFeed
      .mockResolvedValueOnce(makeResponse([makeRow()]))
      .mockResolvedValueOnce(
        makeResponse([makeRow({ client_id: 2, employee_name: 'Фільтренко Федір' })])
      )

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    fireEvent.change(dateInputs()[0], { target: { value: '2026-06-10' } })

    await waitFor(() => expect(search()).toContain('gf=2026-06-10'))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(
        expect.objectContaining({ sell_from: '2026-06-10' })
      )
    )
    expect(await screen.findByText('Фільтренко Федір')).toBeInTheDocument()

    // The opt-in "×" removes the bound entirely (onChange(null) would only be
    // an abandoned manual entry and must not drop the filter).
    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.communicationGap.clearSellFrom' })
    )

    await waitFor(() => expect(search()).not.toContain('gf='))
    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
    // Back on the unfiltered query key, still fresh in the React Query cache.
    expect(mockGetFeed).toHaveBeenCalledTimes(2)
  })

  it('commits the gap_min input on blur, not on every keystroke', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    // Typing alone must not fire a request: this endpoint enriches and sorts
    // the whole candidate population, so "10" must not cost two round trips.
    fireEvent.change(gapMinInput(), { target: { value: '1' } })
    fireEvent.change(gapMinInput(), { target: { value: '10' } })
    expect(mockGetFeed).toHaveBeenCalledTimes(1)

    fireEvent.blur(gapMinInput())

    await waitFor(() => expect(search()).toContain('gm=10'))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ gap_min: 10 }))
    )
  })

  it('commits the gap_min input on Enter as well', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    fireEvent.change(gapMinInput(), { target: { value: '7' } })
    fireEvent.keyDown(gapMinInput(), { key: 'Enter' })

    await waitFor(() => expect(search()).toContain('gm=7'))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ gap_min: 7 }))
    )
  })

  it('commits a padded gap_min canonically ("007" → gm=7) and resyncs the field', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    fireEvent.change(gapMinInput(), { target: { value: '007' } })
    fireEvent.blur(gapMinInput())

    // "007" passes the digits rule, so committing it raw would put three
    // spellings of one filter on screen at once: `gm=007` in the URL, "007" in
    // the field and 7 on the wire — and a bookmarked link that renders a value
    // the request never sent.
    await waitFor(() => expect(search()).toContain('gm=7'))
    expect(search()).not.toContain('gm=007')
    await waitFor(() => expect(gapMinInput().value).toBe('7'))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ gap_min: 7 }))
    )

    // Retyping the padded form over the canonical URL is the no-op it looks like
    // — the page must not reset — and the field still snaps back to "7" rather
    // than keeping a spelling the URL disagrees with.
    fireEvent.change(gapMinInput(), { target: { value: '007' } })
    fireEvent.blur(gapMinInput())

    await waitFor(() => expect(gapMinInput().value).toBe('7'))
    expect(search()).toContain('gm=7')
    expect(mockGetFeed).toHaveBeenCalledTimes(2)
  })

  it('commits an invalid gap_min verbatim so the hint points at what was typed', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    fireEvent.change(gapMinInput(), { target: { value: '1.5' } })
    fireEvent.blur(gapMinInput())

    // Canonicalization is for USABLE values only: there is nothing to
    // canonicalize here, and rewriting the text would leave the hint explaining
    // a value nobody entered.
    await waitFor(() => expect(search()).toContain('gm=1.5'))
    expect(
      await screen.findByText('pages.reports.communicationGap.invalidGapMin')
    ).toBeInTheDocument()
    expect(gapMinInput().value).toBe('1.5')
    // ...and no request goes out for a value the backend would answer 422 to.
    expect(mockGetFeed).toHaveBeenCalledTimes(1)
  })

  it('treats a bare focus/blur of gap_min as a no-op', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 130, page: 3, page_size: 50, total_pages: 3 })
    )

    renderTab(['/?gm=10&gpg=3'])
    await screen.findByText('Коваленко Іван Петрович')
    expect(mockGetFeed).toHaveBeenCalledTimes(1)

    fireEvent.blur(gapMinInput())

    // Nothing changed, so nothing is committed — in particular the page must
    // not silently reset under the operator.
    expect(search()).toContain('gpg=3')
    expect(mockGetFeed).toHaveBeenCalledTimes(1)
  })

  it('clears the gap_min filter through the "×" of the input', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?gm=10'])
    await screen.findByText('Коваленко Іван Петрович')

    // Input's own opt-in clear button, under the field-specific name — three
    // "×" buttons stand in this filter row and a bare "Clear" would name all
    // three the same.
    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.communicationGap.clearGapMin' })
    )

    await waitFor(() => expect(search()).not.toContain('gm='))
    await waitFor(() => {
      const params: Record<string, unknown> = {
        ...mockGetFeed.mock.calls[mockGetFeed.mock.calls.length - 1][0],
      }
      expect('gap_min' in params).toBe(false)
    })
  })

  it.each([
    ['a day the month does not have', '/?gf=2026-02-31', 0],
    ['a month that does not exist', '/?gt=2026-13-01', 1],
  ])('blocks a hand-edited sell bound with %s', async (_case, entry, offendingIndex) => {
    // Shape-only validation would let these through: comparisons against NaN
    // are all false and the request would go out with a date the picker itself
    // renders as a different day.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([entry])

    expect(
      await screen.findByText('pages.reports.communicationGap.invalidSellDate')
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
      'pages.reports.communicationGap.invalidSellDate'
    )
    // An unusable bound is not a value the picker can hold, so it renders no
    // "×" to take it back — which is exactly why the message names the LINK as
    // the source and asks for a date instead of pointing at a missing control.
    expect(
      screen.queryByRole('button', {
        name: [
          'pages.reports.communicationGap.clearSellFrom',
          'pages.reports.communicationGap.clearSellTo',
        ][offendingIndex],
      })
    ).not.toBeInTheDocument()
  })

  it('blocks an inverted sell window but accepts a lone bound after it', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?gf=2026-06-20&gt=2026-06-10'])

    expect(
      await screen.findByText('pages.reports.communicationGap.invalidSellRange')
    ).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()

    // A pair error stays a standalone alert: neither bound is wrong on its own,
    // so neither field is singled out as invalid.
    for (const field of dateInputs()) {
      expect(field).not.toHaveAttribute('aria-invalid')
    }

    // Dropping the upper bound leaves a valid open-ended filter — the pair rule
    // applies only when BOTH bounds are set (the backend's own branch).
    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.communicationGap.clearSellTo' })
    )

    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
    expect(mockGetFeed).toHaveBeenCalledWith(expect.objectContaining({ sell_from: '2026-06-20' }))
  })

  it.each([
    ['a negative minimum', '/?gm=-1', '-1'],
    ['a fractional minimum', '/?gm=1.5', '1.5'],
    ['a non-numeric minimum', '/?gm=abc', 'abc'],
  ])('blocks a hand-edited gap_min with %s', async (_case, entry, raw) => {
    // The value can only be this bad from a hand-edited URL; it earns an inline
    // hint instead of the 422 the backend would answer with.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([entry])

    expect(
      await screen.findByText('pages.reports.communicationGap.invalidGapMin')
    ).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()

    // Single-field error → it rides the field (red border, aria-invalid) and
    // the message is what aria-describedby points at.
    const field = gapMinInput()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    const describedBy = field.getAttribute('aria-describedby')
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      'pages.reports.communicationGap.invalidGapMin'
    )
    // ...and the offending value stays VISIBLE: a number input would coerce
    // "abc" to an empty string, leaving a hint pointing at a blank field.
    expect(field).toHaveAttribute('type', 'text')
    expect(field.value).toBe(raw)
  })

  it('blocks a gap_min past the int32 ceiling the backend enforces', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?gm=2147483648'])

    expect(
      await screen.findByText('pages.reports.communicationGap.invalidGapMin')
    ).toBeInTheDocument()
    expect(mockGetFeed).not.toHaveBeenCalled()
  })

  it('pages through the feed with the right skip and keeps the page in the URL', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 130, page: 1, page_size: 50, total_pages: 3 })
    )

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    await userEvent.click(screen.getByTitle('3'))

    await waitFor(() => expect(search()).toContain('gpg=3'))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(
        expect.objectContaining({ skip: 100, limit: 50 })
      )
    )
  })

  it('resets the page when a filter changes', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 130, page: 3, page_size: 50, total_pages: 3 })
    )

    renderTab(['/?gpg=3'])
    await screen.findByText('Коваленко Іван Петрович')
    expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 100 }))

    fireEvent.change(gapMinInput(), { target: { value: '10' } })
    fireEvent.blur(gapMinInput())

    // Otherwise the user lands on an offset the filtered feed may not have.
    await waitFor(() => expect(search()).toContain('gm=10'))
    await waitFor(() => expect(search()).not.toContain('gpg='))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(
        expect.objectContaining({ gap_min: 10, skip: 0 })
      )
    )
  })

  it.each([
    ['a size outside the offered options', '/?gps=999'],
    ['a non-numeric size', '/?gps=abc'],
  ])('falls back to the default limit for %s', async (_case, entry) => {
    // 999 would also break the backend's `limit <= 500`. A page size is a view
    // preference, not a filter: an unusable one is ignored silently (no hint, no
    // rewrite of the URL) rather than blocking the request.
    mockGetFeed.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([entry])
    await screen.findByText('Коваленко Іван Петрович')

    expect(mockGetFeed).toHaveBeenCalledTimes(1)
    expect(mockGetFeed).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }))
    expect(search()).toContain('gps=')
  })

  it('writes a non-default rows-per-page into ?gps=, drops it again for the default', async () => {
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 260, page: 1, page_size: 50, total_pages: 6 })
    )

    renderTab(['/?gpg=3'])
    await screen.findByText('Коваленко Іван Петрович')

    await selectPageSize('100')

    // A new page size invalidates the old offset — the pager resets to page 1,
    // and page 1 is the default, so `gpg` leaves the URL in the same update.
    await waitFor(() => expect(search()).toContain('gps=100'))
    expect(search()).not.toContain('gpg=')
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 0, limit: 100 }))
    )

    await selectPageSize('50')

    // The default is the absence of the key — it is never spelled out.
    await waitFor(() => expect(search()).not.toContain('gps='))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 50 }))
    )
  })

  it('heals a stale ?gpg= down to the last page the answer still has', async () => {
    // A shared link outlives the rows it pointed at: operators worked the feed
    // down to two pages while `?gpg=5` stayed in the URL.
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([], { total: 90, page: 5, page_size: 50, total_pages: 2 })
      )
      .mockResolvedValue(
        makeResponse([makeRow()], { total: 90, page: 2, page_size: 50, total_pages: 2 })
      )

    renderTab(['/?gpg=5'])

    // The page count is only known from an answer, so the stale offset does go
    // out once — but exactly once, and never again after the URL self-heals.
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenNthCalledWith(1, expect.objectContaining({ skip: 200 }))
    )
    await waitFor(() => expect(search()).toContain('gpg=2'))
    await waitFor(() =>
      expect(mockGetFeed).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 50, limit: 50 }))
    )
    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
    expect(mockGetFeed).toHaveBeenCalledTimes(2)
    expect(pageIndicator()).toEqual(['2', '2'])

    // A dead offset is not a failure — no error branch on the way through.
    expect(
      screen.queryByRole('button', { name: 'pages.reports.communicationGap.error.retry' })
    ).not.toBeInTheDocument()
  })

  it('never renders "Page N of M" with N past M while a stale ?gpg= heals', async () => {
    let resolveHealed: (value: CommunicationGapFeedResponse) => void = () => {}
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([], { total: 90, page: 5, page_size: 50, total_pages: 2 })
      )
      .mockImplementationOnce(
        () => new Promise<CommunicationGapFeedResponse>((resolve) => (resolveHealed = resolve))
      )

    renderTab(['/?gpg=5'])

    // Placeholder frame: the stale page's answer is still on screen while the
    // healed page loads, and the pager already reads the clamped page.
    expect(await screen.findByTestId('communication-gap-refreshing')).toBeInTheDocument()
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

  it('falls back to page 1 for a ?gpg= whose offset would overflow the int32 skip cap', async () => {
    // (100000000 - 1) * 50 ≈ 5e9 — past the backend's `skip <= 2147483647`, so
    // the request could only come back 422. Same silent fallback as a bad ?gps=.
    mockGetFeed.mockResolvedValue(
      makeResponse([makeRow()], { total: 130, page: 1, page_size: 50, total_pages: 3 })
    )

    renderTab(['/?gpg=100000000'])
    await screen.findByText('Коваленко Іван Петрович')

    expect(mockGetFeed).toHaveBeenCalledTimes(1)
    expect(mockGetFeed).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }))
    expect(pageIndicator()).toEqual(['1', '3'])
    // A view preference, not a filter: the value is ignored, not rewritten.
    expect(search()).toContain('gpg=100000000')
  })

  it('shows the calm empty state (and no pager) for filters nothing matches', async () => {
    // A narrow sell window, or a minimum above the feed's own worst gap (max 49
    // days on the production probe), legitimately holds no rows — HTTP 200 with
    // total 0, not a fault.
    mockGetFeed.mockResolvedValue(makeResponse([], { total: 0, total_pages: 0 }))

    renderTab(['/?gm=500'])

    expect(await screen.findByText('pages.reports.communicationGap.empty')).toBeInTheDocument()
    // The pager's own label, as the global i18n mock renders it ("Page") — the
    // raw key never reaches the DOM, so querying for it would pass vacuously.
    expect(screen.queryByText('Page')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('renders the row through the table: days, gap and the Decimal amount', async () => {
    mockGetFeed.mockResolvedValue(makeResponse([makeRow({ last_promise_date: '2026-08-01' })]))

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    expect(screen.getByText('07/04/2026')).toBeInTheDocument() // sell_date
    expect(screen.getByText('07/10/2026')).toBeInTheDocument() // assignment_date
    expect(screen.getByText('08/02/2026')).toBeInTheDocument() // last_interaction_date
    expect(screen.getByText('08/01/2026')).toBeInTheDocument() // last_promise_date
    expect(screen.getByText('15')).toBeInTheDocument() // communication_gap
    // Decimal-as-JSON-string, formatted with two decimals.
    expect(screen.getByText('15,000.00')).toBeInTheDocument()
  })

  it('renders "—" for the nullable columns, promise date included', async () => {
    // last_promise_date is null on 89–94 % of production rows BY DESIGN, and a
    // department-less employee keeps their clients in this feed (the card's
    // `OR department IS NULL` branch).
    mockGetFeed.mockResolvedValue(
      makeResponse([
        makeRow({
          inn: null,
          department: null,
          group_name: null,
          last_interaction_date: null,
          last_promise_date: null,
        }),
      ])
    )

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    // inn, department, group, last interaction, last promise
    expect(screen.getAllByText('—')).toHaveLength(5)
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
    let resolveSecond: (value: CommunicationGapFeedResponse) => void = () => {}
    mockGetFeed
      .mockResolvedValueOnce(
        makeResponse([makeRow()], { total: 130, page: 1, page_size: 50, total_pages: 3 })
      )
      .mockImplementationOnce(
        () => new Promise<CommunicationGapFeedResponse>((resolve) => (resolveSecond = resolve))
      )

    renderTab()
    await screen.findByText('Коваленко Іван Петрович')

    await userEvent.click(screen.getByTitle('2'))

    expect(await screen.findByTestId('communication-gap-refreshing')).toBeInTheDocument()
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
      expect(screen.queryByTestId('communication-gap-refreshing')).not.toBeInTheDocument()
    )
  })

  it('shows an error state with retry and recovers after a successful refetch', async () => {
    mockGetFeed
      .mockRejectedValueOnce(makeHttpError(500))
      .mockResolvedValueOnce(makeResponse([makeRow()]))

    renderTab()

    expect(
      await screen.findByText('pages.reports.communicationGap.error.title')
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.communicationGap.error.retry' })
    )

    expect(await screen.findByText('Коваленко Іван Петрович')).toBeInTheDocument()
  })

  it('shows the backend detail for a 400 validation answer', async () => {
    mockGetFeed.mockRejectedValue(
      makeHttpError(400, { detail: 'sell_from must not be after sell_to' })
    )

    renderTab(['/?gf=2026-06-01'])

    expect(await screen.findByText('sell_from must not be after sell_to')).toBeInTheDocument()
  })

  it('passes the candidate-cap refusal detail through so the remedy is readable', async () => {
    // The endpoint refuses an oversized candidate population with a 400 (not a
    // 503: it is deterministic and input-shaped, and a 503 would be auto-retried
    // by the shared axios client over the very population it refuses). The
    // detail names the knob — the operator can only act on it if it reaches the
    // screen verbatim.
    // Wording mirrors the backend's real refusal detail: past the cap the
    // exact count is unknowable (the candidate query stops at max+1), so the
    // backend says "more than {max}", never a number.
    const detail =
      'Communication-gap feed: more than the configured maximum of 100000 ' +
      'candidates match; request a narrower sell window (sell_from/sell_to)'
    mockGetFeed.mockRejectedValue(makeHttpError(400, { detail }))

    renderTab()

    expect(await screen.findByText(detail)).toBeInTheDocument()
    // A retry is still offered — it becomes useful once the window is narrowed —
    // but the generic title must not hide the actionable detail.
    expect(screen.queryByText('pages.reports.communicationGap.error.title')).not.toBeInTheDocument()
  })

  it.each([
    ['no body at all', undefined],
    ['an empty body', {}],
    ['an empty detail', { detail: '' }],
  ])('falls back to the localized title for a 400 with %s', async (_case, data) => {
    // A 400 normally explains itself, but the body can be missing by the time it
    // reaches the browser (a proxy stripping it). getErrorMessage has nothing to
    // read then and degrades to axios' own message, so the tab must NOT show it:
    // "Request failed with status code 400" is untranslated and tells the
    // operator nothing.
    const error = makeHttpError(400, data)
    // Axios' verbatim wording, so the negative assertion below is the real thing.
    error.message = 'Request failed with status code 400'
    mockGetFeed.mockRejectedValue(error)

    renderTab(['/?gf=2026-06-01'])

    expect(
      await screen.findByText('pages.reports.communicationGap.error.title')
    ).toBeInTheDocument()
    expect(screen.queryByText(/Request failed with status code/)).not.toBeInTheDocument()
    // Still a retryable failure — the 403 branch is the only one without a button.
    expect(
      screen.getByRole('button', { name: 'pages.reports.communicationGap.error.retry' })
    ).toBeInTheDocument()
  })

  it('shows a permissions message without a retry button on 403', async () => {
    mockGetFeed.mockRejectedValue(makeHttpError(403))

    renderTab()

    expect(await screen.findByText('pages.reports.communicationGap.forbidden')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'pages.reports.communicationGap.error.retry' })
    ).not.toBeInTheDocument()
  })

  it.each([502, 503, 504])(
    'shows the dedicated unavailability message on transient %d errors',
    async (status) => {
      mockGetFeed.mockRejectedValue(makeHttpError(status))

      renderTab()

      expect(
        await screen.findByText('pages.reports.communicationGap.unavailable')
      ).toBeInTheDocument()
    }
  )

  it.each([
    [
      'auth-service outage',
      'Employee directory (auth-service) is unavailable; the feed cannot be rendered safely',
    ],
    [
      'payment-service outage',
      'Recent-payment lookup (payment-service) is unavailable; the feed cannot be rendered safely',
    ],
    [
      'fan-out deadline',
      'Internal lookups (employee directory and recent payments) timed out; the feed cannot be rendered safely',
    ],
  ])('treats the %s 503 as the same transient class', async (_case, detail) => {
    // The endpoint has THREE distinct 503 details, and all of them are the same
    // thing to the operator: wait and retry. None may degrade to a partial feed
    // — without the directory the department gate disappears, without the
    // payment data a client who paid yesterday lands back in a call list.
    mockGetFeed.mockRejectedValue(makeHttpError(503, { detail }))

    renderTab()

    expect(
      await screen.findByText('pages.reports.communicationGap.unavailable')
    ).toBeInTheDocument()
    // The transient branch wins over the 400-style detail passthrough: a
    // retryable outage must not read as something the operator mis-typed.
    expect(screen.queryByText(detail)).not.toBeInTheDocument()
  })

  it('treats network failures as transient unavailability too', async () => {
    mockGetFeed.mockRejectedValue(makeNetworkError('ERR_NETWORK'))

    renderTab()

    expect(
      await screen.findByText('pages.reports.communicationGap.unavailable')
    ).toBeInTheDocument()
  })

  it('does not crash on an unexpected 422 from a hand-crafted request', async () => {
    // Unreachable through the UI (the inputs are constrained), but it must land
    // in the generic error branch instead of breaking the tab.
    mockGetFeed.mockRejectedValue(makeHttpError(422, { detail: [{ msg: 'bad' }] }))

    renderTab()

    expect(
      await screen.findByText('pages.reports.communicationGap.error.title')
    ).toBeInTheDocument()
  })
})
