import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { ThirdPartyVerificationTab } from '../ThirdPartyVerificationTab'
import { getThirdPartyVerificationReport } from '../../api/thirdPartyVerificationApi'
import type { ThirdPartyVerificationResponse, ThirdPartyVerificationRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key.

vi.mock('../../api/thirdPartyVerificationApi', () => ({
  getThirdPartyVerificationReport: vi.fn(),
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
// name the shipped component never renders.
vi.mock('@/components/ui/DateSelect', () => ({
  DateSelect: ({
    value,
    onChange,
    onClear,
    clearLabel,
    label,
  }: {
    value?: string | Date | null
    onChange?: (args: { value: Date | null }) => void
    onClear?: () => void
    clearLabel?: string
    label?: string
  }) => (
    <>
      <input
        data-testid="date-select"
        aria-label={label}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) =>
          // Noon avoids the parsed UTC date rolling into the previous local day
          onChange?.({ value: e.target.value ? new Date(`${e.target.value}T12:00:00`) : null })
        }
      />
      {onClear && (
        <button type="button" aria-label={clearLabel ?? 'Clear'} onClick={onClear}>
          ×
        </button>
      )}
    </>
  ),
}))

const mockGetReport = vi.mocked(getThirdPartyVerificationReport)

function makeRow(overrides: Partial<ThirdPartyVerificationRow> = {}): ThirdPartyVerificationRow {
  return {
    user_id: 1,
    full_name: 'Іваненко Іван',
    group_name: 'Група 1',
    numbers_added: 900,
    unique_clients: 300,
    month_plan: 1198.8,
    month_plan_diff: -298.8,
    ...overrides,
  }
}

function makeResponse(rows: ThirdPartyVerificationRow[]): ThirdPartyVerificationResponse {
  return {
    project_id: 1,
    sell_from: '2026-08-01',
    sell_to: '2026-08-31',
    count_from: null,
    count_to: null,
    rows,
    generated_at: '2026-08-06T12:00:00Z',
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

/** Shift an ISO YYYY-MM-DD date by whole days. */
function isoPlusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * The current month's bounds, computed independently of the component (the
 * profile timezone is null in these tests, so browser-local parts apply).
 */
function expectedCurrentMonth() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`,
  }
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
        <ThirdPartyVerificationTab />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const dateInputs = () => screen.getAllByTestId('date-select') as HTMLInputElement[]

beforeEach(() => {
  vi.clearAllMocks()
  authState.user.timezone = null
})

describe('ThirdPartyVerificationTab', () => {
  it('defaults the sell window to the current month and leaves the count window empty', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    expect(await screen.findByText('Іваненко Іван')).toBeInTheDocument()

    const month = expectedCurrentMonth()
    const [sellFrom, sellTo, countFrom, countTo] = dateInputs()
    expect(sellFrom.value).toBe(month.from)
    expect(sellTo.value).toBe(month.to)
    expect(countFrom.value).toBe('')
    expect(countTo.value).toBe('')

    // Request contract: both sell bounds always sent, no count bounds, and no
    // timezone for a profile without one (the backend then defaults to UTC).
    expect(mockGetReport).toHaveBeenCalledTimes(1)
    expect(mockGetReport).toHaveBeenCalledWith({
      project_id: 1,
      sell_from: month.from,
      sell_to: month.to,
    })
  })

  it('sends the profile IANA timezone to the API when the user has one', async () => {
    authState.user.timezone = 'Europe/Kyiv'
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Іваненко Іван')

    expect(mockGetReport).toHaveBeenCalledWith(expect.objectContaining({ timezone: 'Europe/Kyiv' }))
  })

  it('reads all four dates from the URL (?sf=&st=&cf=&ct=)', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?sf=2026-01-01&st=2026-01-31&cf=2026-01-10&ct=2026-01-20'])
    await screen.findByText('Іваненко Іван')

    expect(mockGetReport).toHaveBeenCalledWith(
      expect.objectContaining({
        sell_from: '2026-01-01',
        sell_to: '2026-01-31',
        count_from: '2026-01-10',
        count_to: '2026-01-20',
      })
    )
  })

  it.each([
    ['count_from', 'cf', 'count_from', 'count_to'],
    ['count_to', 'ct', 'count_to', 'count_from'],
  ])(
    'sends an independent %s bound without the other one',
    async (_case, urlKey, sentKey, absentKey) => {
      mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

      renderTab([`/?${urlKey}=2026-01-10`])
      await screen.findByText('Іваненко Іван')

      const params: Record<string, unknown> = { ...mockGetReport.mock.calls[0][0] }
      expect(params[sentKey]).toBe('2026-01-10')
      // A single bound is a legitimate open-ended filter — the other key must
      // not be invented (an empty value would be a 400 on the backend).
      expect(absentKey in params).toBe(false)
    }
  )

  it('writes a picked count date into the URL and clears it again', async () => {
    // Distinct payloads per window, so "the filter is gone" is observable in
    // the rendered rows and not just in the request params.
    mockGetReport
      .mockResolvedValueOnce(makeResponse([makeRow()]))
      .mockResolvedValueOnce(makeResponse([makeRow({ user_id: 2, full_name: 'Фільтренко Федір' })]))

    renderTab()
    await screen.findByText('Іваненко Іван')

    const [, , countFrom] = dateInputs()
    fireEvent.change(countFrom, { target: { value: '2026-01-10' } })

    await waitFor(() => expect(screen.getByTestId('location-search').textContent).toContain('cf='))
    await waitFor(() =>
      expect(mockGetReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ count_from: '2026-01-10' })
      )
    )
    expect(await screen.findByText('Фільтренко Федір')).toBeInTheDocument()

    // The opt-in "×" removes the bound entirely (onChange(null) would only be
    // an abandoned manual entry and must not drop the filter).
    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.verification.clearCountFrom' })
    )

    await waitFor(() =>
      expect(screen.getByTestId('location-search').textContent).not.toContain('cf=')
    )
    // Back on the unfiltered query key: its rows are on screen again and the
    // bounded ones are gone. No third request — that key is still fresh in the
    // React Query cache (staleTime), so the only calls are the initial
    // unfiltered one and the bounded one.
    expect(await screen.findByText('Іваненко Іван')).toBeInTheDocument()
    expect(screen.queryByText('Фільтренко Федір')).not.toBeInTheDocument()
    expect(mockGetReport).toHaveBeenCalledTimes(2)
  })

  it('blocks the request and shows an inline hint for an inverted sell range', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Іваненко Іван')
    expect(mockGetReport).toHaveBeenCalledTimes(1)

    // Manual input can bypass the pickers' min/max — set start far after end
    const [sellFrom] = dateInputs()
    fireEvent.change(sellFrom, { target: { value: '2030-01-05' } })

    expect(
      await screen.findByText('pages.reports.verification.invalidSellRange')
    ).toBeInTheDocument()
    expect(screen.queryByText('Іваненко Іван')).not.toBeInTheDocument()
    expect(mockGetReport).toHaveBeenCalledTimes(1)
  })

  it('blocks an inverted count range but accepts a lone lower bound after it', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?cf=2026-02-20&ct=2026-02-10'])

    expect(
      await screen.findByText('pages.reports.verification.invalidCountRange')
    ).toBeInTheDocument()
    expect(mockGetReport).not.toHaveBeenCalled()

    // Dropping the upper bound leaves a valid open-ended filter — the pair
    // rule applies only when BOTH bounds are set.
    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.verification.clearCountTo' })
    )

    expect(await screen.findByText('Іваненко Іван')).toBeInTheDocument()
    expect(mockGetReport).toHaveBeenCalledWith(
      expect.objectContaining({ count_from: '2026-02-20' })
    )
  })

  it('pins the 366-day boundary on the sell window: 366 passes, 367 is blocked', async () => {
    // Matches the backend's `_MAX_RANGE_DAYS` (services/client/app/routers/
    // reports.py): a (end - start) diff of 366 days is the widest allowed.
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Іваненко Іван')
    expect(mockGetReport).toHaveBeenCalledTimes(1)

    const [sellFrom, sellTo] = dateInputs()
    const end = sellTo.value

    fireEvent.change(sellFrom, { target: { value: isoPlusDays(end, -366) } })
    await waitFor(() => expect(mockGetReport).toHaveBeenCalledTimes(2))
    expect(
      screen.queryByText('pages.reports.verification.sellRangeTooLong')
    ).not.toBeInTheDocument()

    fireEvent.change(sellFrom, { target: { value: isoPlusDays(end, -367) } })
    expect(
      await screen.findByText('pages.reports.verification.sellRangeTooLong')
    ).toBeInTheDocument()
    expect(mockGetReport).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['a day the month does not have', '/?sf=2026-02-31&st=2026-02-28'],
    ['a month that does not exist', '/?sf=2026-13-01&st=2026-12-31'],
  ])('blocks a hand-edited sell bound with %s', async (_case, entry) => {
    // Shape-only validation would let these through: the range checks compare
    // against NaN (always false) and the request would go out with a date the
    // picker itself renders as a different day.
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([entry])

    expect(
      await screen.findByText('pages.reports.verification.invalidSellDate')
    ).toBeInTheDocument()
    expect(mockGetReport).not.toHaveBeenCalled()
  })

  it.each([
    ['a day the month does not have', '/?cf=2026-02-31'],
    ['a month that does not exist', '/?ct=2026-13-01'],
  ])('blocks a hand-edited count bound with %s', async (_case, entry) => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([entry])

    expect(
      await screen.findByText('pages.reports.verification.invalidCountDate')
    ).toBeInTheDocument()
    expect(mockGetReport).not.toHaveBeenCalled()
  })

  it('blocks a count window wider than 366 days', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?cf=2024-01-01&ct=2025-01-02'])

    expect(
      await screen.findByText('pages.reports.verification.countRangeTooLong')
    ).toBeInTheDocument()
    expect(mockGetReport).not.toHaveBeenCalled()
  })

  it('ignores a cleared manual sell input (URL keeps the previous value)', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?sf=2026-01-01&st=2026-01-31'])
    await screen.findByText('Іваненко Іван')

    const [sellFrom] = dateInputs()
    fireEvent.change(sellFrom, { target: { value: '' } })

    // Observable contract of onChange(null): the URL still carries the old
    // bound, the rows stay, and no new request fires. The input text itself
    // resyncing on blur is DateSelect's own behavior, covered by its tests.
    expect(screen.getByTestId('location-search').textContent).toContain('sf=2026-01-01')
    expect(screen.getByText('Іваненко Іван')).toBeInTheDocument()
    expect(mockGetReport).toHaveBeenCalledTimes(1)
  })

  it('renders "—" for a null monthly plan without crashing the tab', async () => {
    mockGetReport.mockResolvedValue(
      makeResponse([makeRow({ month_plan: null, month_plan_diff: null })])
    )

    renderTab()
    await screen.findByText('Іваненко Іван')

    // Both plan columns degrade to the placeholder (zero active ТП headcount)
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('shows the empty state when the report has no rows', async () => {
    mockGetReport.mockResolvedValue(makeResponse([]))

    renderTab()

    expect(await screen.findByText('pages.reports.verification.empty')).toBeInTheDocument()
  })

  it('marks previous-window rows as busy while a new window is loading', async () => {
    let resolveSecond: (value: ThirdPartyVerificationResponse) => void = () => {}
    mockGetReport
      .mockResolvedValueOnce(makeResponse([makeRow()]))
      .mockImplementationOnce(
        () => new Promise<ThirdPartyVerificationResponse>((resolve) => (resolveSecond = resolve))
      )

    renderTab()
    await screen.findByText('Іваненко Іван')

    const [sellFrom] = dateInputs()
    fireEvent.change(sellFrom, { target: { value: isoPlusDays(sellFrom.value, -1) } })

    expect(await screen.findByTestId('verification-refreshing')).toBeInTheDocument()
    expect(screen.getByText('Іваненко Іван')).toBeInTheDocument()

    resolveSecond(makeResponse([makeRow({ user_id: 5, full_name: 'Оновленко Олег' })]))

    expect(await screen.findByText('Оновленко Олег')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByTestId('verification-refreshing')).not.toBeInTheDocument()
    )
  })

  it('shows an error state with retry and recovers after a successful refetch', async () => {
    mockGetReport
      .mockRejectedValueOnce(makeHttpError(500))
      .mockResolvedValueOnce(makeResponse([makeRow()]))

    renderTab()

    expect(await screen.findByText('pages.reports.verification.error.title')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.verification.error.retry' })
    )

    expect(await screen.findByText('Іваненко Іван')).toBeInTheDocument()
  })

  it('shows the backend detail for a 400 validation answer', async () => {
    mockGetReport.mockRejectedValue(
      makeHttpError(400, { detail: 'count_from must not be after count_to' })
    )

    renderTab()

    expect(await screen.findByText('count_from must not be after count_to')).toBeInTheDocument()
  })

  it('shows a permissions message without a retry button on 403', async () => {
    mockGetReport.mockRejectedValue(makeHttpError(403))

    renderTab()

    expect(await screen.findByText('pages.reports.verification.forbidden')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'pages.reports.verification.error.retry' })
    ).not.toBeInTheDocument()
  })

  it.each([502, 503, 504])(
    'shows the dedicated unavailability message on transient %d errors',
    async (status) => {
      mockGetReport.mockRejectedValue(makeHttpError(status))

      renderTab()

      expect(await screen.findByText('pages.reports.verification.unavailable')).toBeInTheDocument()
    }
  )

  it('treats network failures as transient unavailability too', async () => {
    mockGetReport.mockRejectedValue(makeNetworkError('ERR_NETWORK'))

    renderTab()

    expect(await screen.findByText('pages.reports.verification.unavailable')).toBeInTheDocument()
  })

  it('always shows the plan-vs-fact hint under the filters', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()

    // Without it a one-day count window shows a deeply negative "shortfall"
    // against a whole month's plan and reads as a bug.
    expect(await screen.findByText('pages.reports.verification.planHint')).toBeInTheDocument()
  })
})
