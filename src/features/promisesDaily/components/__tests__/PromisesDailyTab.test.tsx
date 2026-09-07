import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import enCommon from '@/../public/locales/en/common.json'
import ukCommon from '@/../public/locales/uk/common.json'
import { PromisesDailyTab } from '../PromisesDailyTab'
import { getPromisesDailyReport } from '../../api/promisesDailyApi'
import type { PromisesDailyDepartment, PromisesDailyReportResponse } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key.

vi.mock('../../api/promisesDailyApi', () => ({
  getPromisesDailyReport: vi.fn(),
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
// keeps the tests focused while still driving value/onChange like the real
// component (onChange receives a Date or null), mirroring the sibling report
// tab tests (operatorPromises, outboundCalls).
vi.mock('@/components/ui/DateSelect', () => ({
  DateSelect: ({
    value,
    onChange,
    label,
    error,
  }: {
    value?: string | Date | null
    onChange?: (args: { value: Date | null }) => void
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
        {error && (
          <p id={errorId} role="alert">
            {error}
          </p>
        )}
      </>
    )
  },
}))

const mockGetReport = vi.mocked(getPromisesDailyReport)

const FIXTURE_DATES = ['2026-07-01', '2026-07-02', '2026-07-03']

const FIXTURE_DEPARTMENTS: PromisesDailyDepartment[] = [
  { name: 'ТП', values: ['100.00', '0', '50.50'], total: '150.50' },
  { name: 'Стягнення', values: ['200.00', '25.00', '0'], total: '225.00' },
  { name: null, values: ['0', '5.00', '0'], total: '5.00' },
]

function makeResponse(
  overrides: Partial<PromisesDailyReportResponse> = {}
): PromisesDailyReportResponse {
  return {
    project_id: 1,
    date_from: '2026-07-01',
    date_to: '2026-07-03',
    timezone: 'UTC',
    possible_payment: false,
    dates: FIXTURE_DATES,
    departments: FIXTURE_DEPARTMENTS,
    total: '380.50',
    generated_at: '2026-09-07T13:20:31.400543Z',
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
        <PromisesDailyTab />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const dateInputs = () => screen.getAllByTestId('date-select') as HTMLInputElement[]
const search = () => screen.getByTestId('location-search').textContent ?? ''
const wholeMonthCheckbox = () =>
  screen.getByRole('checkbox', { name: 'pages.reports.promisesDaily.wholeMonth' })
const possiblePaymentsCheckbox = () =>
  screen.getByRole('checkbox', { name: 'pages.reports.promisesDaily.possiblePayments' })

const pad = (n: number) => String(n).padStart(2, '0')

/** Today and the current month's bounds, computed INDEPENDENTLY of the tab. */
function localWindow() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = `${year}-${pad(month + 1)}-${pad(now.getDate())}`
  const monthStart = `${year}-${pad(month + 1)}-01`
  const monthEnd = `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`
  return { today, monthStart, monthEnd }
}

beforeEach(() => {
  vi.clearAllMocks()
  authState.user.timezone = null
})

afterEach(() => {
  // Several tests below fake Date (only Date — real timers keep waitFor,
  // React Query and userEvent flowing); a no-op for the rest.
  vi.useRealTimers()
})

describe('PromisesDailyTab', () => {
  // ==========================================================================
  // The window
  // ==========================================================================

  it('requests a today → end-of-month window by default and pins nothing into the URL', async () => {
    // Only Date is faked (real timers keep waitFor / React Query flowing):
    // computing the expectation from the real clock at assert time would flake
    // on a run that crosses midnight. Noon UTC keeps "today" the same calendar
    // day in any plausible runner zone.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'))
    mockGetReport.mockResolvedValue(makeResponse())

    renderTab()
    await screen.findByText('Стягнення')

    // The report's namesake period: from today to the END of the current
    // month, not today–today like the record-list siblings.
    const [from, to] = dateInputs()
    expect(from.value).toBe('2026-07-15')
    expect(to.value).toBe('2026-07-31')
    expect(mockGetReport).toHaveBeenCalledTimes(1)
    expect(mockGetReport).toHaveBeenCalledWith({
      project_id: 1,
      date_from: '2026-07-15',
      date_to: '2026-07-31',
    })
    // A default nobody chose must not travel in a shared link.
    expect(search()).not.toContain('pdf=')
    expect(search()).not.toContain('pdt=')
    expect(search()).not.toContain('pdp=')
  })

  it('sends the profile timezone to the API when the profile has one', async () => {
    authState.user.timezone = 'Europe/Kyiv'
    mockGetReport.mockResolvedValue(makeResponse())

    renderTab()
    await screen.findByText('Стягнення')

    expect(mockGetReport).toHaveBeenCalledWith(expect.objectContaining({ timezone: 'Europe/Kyiv' }))
  })

  it('resolves the default window in the PROFILE timezone, not the machine clock', async () => {
    // 22:00 UTC on Aug 31 is already 01:00 on Sep 1 in Kyiv (UTC+3): the
    // default window must start on KYIV's today and run to KYIV's month end —
    // September, not the August a UTC (or further-west) clock would pick.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-31T22:00:00Z'))
    authState.user.timezone = 'Europe/Kyiv'
    mockGetReport.mockResolvedValue(makeResponse())

    renderTab()
    await screen.findByText('Стягнення')

    expect(mockGetReport).toHaveBeenCalledWith({
      project_id: 1,
      date_from: '2026-09-01',
      date_to: '2026-09-30',
      timezone: 'Europe/Kyiv',
    })
    const [from, to] = dateInputs()
    expect(from.value).toBe('2026-09-01')
    expect(to.value).toBe('2026-09-30')
  })

  it('omits the timezone key entirely for a profile without one', async () => {
    mockGetReport.mockResolvedValue(makeResponse())

    renderTab()
    await screen.findByText('Стягнення')

    const params: Record<string, unknown> = { ...mockGetReport.mock.calls[0][0] }
    expect('timezone' in params).toBe(false)
  })

  it('reads the window from the URL (?pdf=&pdt=)', async () => {
    mockGetReport.mockResolvedValue(makeResponse())

    renderTab(['/?pdf=2026-07-01&pdt=2026-07-03'])
    await screen.findByText('Стягнення')

    expect(mockGetReport).toHaveBeenCalledWith({
      project_id: 1,
      date_from: '2026-07-01',
      date_to: '2026-07-03',
    })
    const [from, to] = dateInputs()
    expect(from.value).toBe('2026-07-01')
    expect(to.value).toBe('2026-07-03')
  })

  it('writes a picked date into its URL key and refetches', async () => {
    mockGetReport.mockResolvedValue(makeResponse())

    renderTab(['/?pdf=2026-07-01&pdt=2026-07-31'])
    await screen.findByText('Стягнення')

    fireEvent.change(dateInputs()[0], { target: { value: '2026-07-15' } })

    await waitFor(() => expect(search()).toContain('pdf=2026-07-15'))
    await waitFor(() =>
      expect(mockGetReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ date_from: '2026-07-15' })
      )
    )
  })

  // ==========================================================================
  // «Весь місяць»
  // ==========================================================================

  it('pins the whole current month into the URL when «Весь місяць» is checked', async () => {
    mockGetReport.mockResolvedValue(makeResponse())

    // A mid-month window that is NOT the whole month, whatever today is.
    renderTab(['/?pdf=2026-07-10&pdt=2026-07-20'])
    await screen.findByText('Стягнення')
    expect(wholeMonthCheckbox()).not.toBeChecked()

    await userEvent.click(wholeMonthCheckbox())

    const { monthStart, monthEnd } = localWindow()
    await waitFor(() => expect(search()).toContain(`pdf=${monthStart}`))
    expect(search()).toContain(`pdt=${monthEnd}`)
    expect(wholeMonthCheckbox()).toBeChecked()
    await waitFor(() =>
      expect(mockGetReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ date_from: monthStart, date_to: monthEnd })
      )
    )
  })

  it('returns to the default window (today → end of month) when unchecked', async () => {
    // Same pinned clock as the default-window test: the expectation is a
    // literal, not a re-read of the real clock that could roll past midnight
    // between render and assert.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'))
    mockGetReport.mockResolvedValue(makeResponse())

    renderTab(['/?pdf=2026-07-01&pdt=2026-07-31'])
    await screen.findByText('Стягнення')
    // The checkbox reads the STATE of the window, however it got there — a
    // shared whole-month link opens with it already checked.
    expect(wholeMonthCheckbox()).toBeChecked()

    await userEvent.click(wholeMonthCheckbox())

    // The default is the ABSENCE of the keys, never spelled out.
    await waitFor(() => expect(search()).not.toContain('pdf='))
    expect(search()).not.toContain('pdt=')
    await waitFor(() =>
      expect(mockGetReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ date_from: '2026-07-15', date_to: '2026-07-31' })
      )
    )
  })

  // ==========================================================================
  // «Враховувати можливі оплати»
  // ==========================================================================

  it('refetches with possible_payment: true when the checkbox is set, and pins ?pdp=1', async () => {
    mockGetReport.mockResolvedValue(makeResponse())

    renderTab()
    await screen.findByText('Стягнення')
    // The backend default (firm agreements only) sends NO key at all.
    const firstParams: Record<string, unknown> = { ...mockGetReport.mock.calls[0][0] }
    expect('possible_payment' in firstParams).toBe(false)
    expect(possiblePaymentsCheckbox()).not.toBeChecked()

    await userEvent.click(possiblePaymentsCheckbox())

    await waitFor(() => expect(search()).toContain('pdp=1'))
    // A different report — it must REFETCH, not filter client-side.
    await waitFor(() => expect(mockGetReport).toHaveBeenCalledTimes(2))
    expect(mockGetReport).toHaveBeenLastCalledWith(
      expect.objectContaining({ possible_payment: true })
    )
  })

  it('drops the key and refetches without it when the checkbox is cleared', async () => {
    mockGetReport.mockResolvedValue(makeResponse())

    renderTab(['/?pdp=1'])
    await screen.findByText('Стягнення')
    expect(possiblePaymentsCheckbox()).toBeChecked()
    expect(mockGetReport).toHaveBeenCalledWith(expect.objectContaining({ possible_payment: true }))

    await userEvent.click(possiblePaymentsCheckbox())

    await waitFor(() => expect(search()).not.toContain('pdp='))
    await waitFor(() => expect(mockGetReport).toHaveBeenCalledTimes(2))
    const lastParams: Record<string, unknown> = { ...mockGetReport.mock.calls[1][0] }
    expect('possible_payment' in lastParams).toBe(false)
  })

  // ==========================================================================
  // The matrix
  // ==========================================================================

  it('renders the day × department matrix from the response', async () => {
    mockGetReport.mockResolvedValue(makeResponse())

    renderTab(['/?pdf=2026-07-01&pdt=2026-07-03'])
    await screen.findByText('Стягнення')

    // One row per day of the CONTINUOUS axis (zero-days included), in order.
    const [, tbody] = screen.getAllByRole('rowgroup')
    const rows = tbody.querySelectorAll('tr')
    expect(rows).toHaveLength(FIXTURE_DATES.length)
    expect(within(rows[0] as HTMLElement).getByText('07/01/2026')).toBeInTheDocument()
    expect(within(rows[1] as HTMLElement).getByText('07/02/2026')).toBeInTheDocument()
    expect(within(rows[2] as HTMLElement).getByText('07/03/2026')).toBeInTheDocument()

    // The null-name series is a real column, localized — not dropped.
    expect(
      screen.getByRole('columnheader', { name: 'pages.reports.promisesDaily.columns.noDepartment' })
    ).toBeInTheDocument()

    // Per-day «Разом» is summed client-side (100 + 200 + 0)…
    expect(within(rows[0] as HTMLElement).getByText('300.00')).toBeInTheDocument()
    // …and the footer carries the SERVER's own totals verbatim.
    const footer = document.querySelector('tfoot') as HTMLElement
    expect(within(footer).getByText('150.50')).toBeInTheDocument()
    expect(within(footer).getByText('380.50')).toBeInTheDocument()
  })

  it('states when the report was computed', async () => {
    mockGetReport.mockResolvedValue(makeResponse())

    renderTab()
    await screen.findByText('Стягнення')

    // The answer can be up to 15 minutes old (worker-local server cache), and
    // `generated_at` is stamped at computation time — so it is shown rather
    // than implied.
    expect(screen.getByText('pages.reports.promisesDaily.generatedAt')).toBeInTheDocument()
  })

  it('shows the calm period message for a genuinely empty answer', async () => {
    mockGetReport.mockResolvedValue(makeResponse({ dates: [], departments: [], total: '0.00' }))

    renderTab()

    expect(await screen.findByText('pages.reports.promisesDaily.empty')).toBeInTheDocument()
  })

  // ==========================================================================
  // Window validation — nothing invalid reaches the API
  // ==========================================================================

  it('refuses an impossible calendar day in the URL and fires no request', async () => {
    mockGetReport.mockResolvedValue(makeResponse())

    // A shape-only check would let 2026-02-31 through: every comparison
    // against NaN is false, so the range guard would pass silently.
    renderTab(['/?pdf=2026-02-31'])

    const [from, to] = dateInputs()
    await waitFor(() => expect(from).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getByRole('alert')).toHaveTextContent('pages.reports.promisesDaily.invalidDate')
    expect(mockGetReport).not.toHaveBeenCalled()
    // The hint sits on the offending field only.
    expect(to).not.toHaveAttribute('aria-invalid')
  })

  it('refuses an inverted window with a pair-level alert and no request', async () => {
    mockGetReport.mockResolvedValue(makeResponse())

    renderTab(['/?pdf=2026-07-31&pdt=2026-07-01'])

    expect(await screen.findByText('pages.reports.promisesDaily.invalidRange')).toBeInTheDocument()
    expect(mockGetReport).not.toHaveBeenCalled()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('mirrors the backend’s 366-day cap instead of letting it answer 400', async () => {
    mockGetReport.mockResolvedValue(makeResponse())

    // 2026-01-01 → 2027-01-03 is a 367-day difference (368 days inclusive).
    renderTab(['/?pdf=2026-01-01&pdt=2027-01-03'])

    expect(await screen.findByText('pages.reports.promisesDaily.rangeTooLong')).toBeInTheDocument()
    expect(mockGetReport).not.toHaveBeenCalled()
  })

  it('lets the widest allowed window — exactly a 366-day difference — through', async () => {
    mockGetReport.mockResolvedValue(makeResponse())

    // The cap is on the day DIFFERENCE (backend: end - start ≤ 366), so
    // 2026-01-01 → 2027-01-02 (367 days inclusive) is the last window that
    // must still fire a request — pinning the boundary from the allowed side
    // too, or the guard could silently tighten to 365.
    renderTab(['/?pdf=2026-01-01&pdt=2027-01-02'])
    await screen.findByText('Стягнення')

    expect(screen.queryByText('pages.reports.promisesDaily.rangeTooLong')).not.toBeInTheDocument()
    expect(mockGetReport).toHaveBeenCalledWith(
      expect.objectContaining({ date_from: '2026-01-01', date_to: '2027-01-02' })
    )
  })

  // ==========================================================================
  // The error ladder
  // ==========================================================================

  it('shows a permission message and no Retry on 403', async () => {
    mockGetReport.mockRejectedValue(makeHttpError(403, { detail: 'Forbidden' }))

    renderTab()

    expect(await screen.findByText('pages.reports.promisesDaily.forbidden')).toBeInTheDocument()
    // Retrying cannot fix missing permissions.
    expect(
      screen.queryByRole('button', { name: 'pages.reports.promisesDaily.error.retry' })
    ).not.toBeInTheDocument()
  })

  it('passes a 400 detail through verbatim so the refusal is actionable', async () => {
    mockGetReport.mockRejectedValue(
      makeHttpError(400, { detail: 'Unknown IANA timezone: Mars/Olympus' })
    )

    renderTab()

    expect(await screen.findByText('Unknown IANA timezone: Mars/Olympus')).toBeInTheDocument()
  })

  it('retries the report when the Retry button is used', async () => {
    mockGetReport.mockRejectedValueOnce(makeHttpError(500)).mockResolvedValueOnce(makeResponse())

    renderTab()
    await screen.findByText('pages.reports.promisesDaily.error.title')

    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.promisesDaily.error.retry' })
    )

    expect(await screen.findByText('Стягнення')).toBeInTheDocument()
  })
})

describe('PromisesDaily locale keys', () => {
  // The tab renders KEYS in tests (react-i18next is mocked globally), so
  // nothing above would notice a key added to one locale only — these read the
  // actual translation files.
  const uk = ukCommon.pages.reports.promisesDaily
  const en = enCommon.pages.reports.promisesDaily

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
    expect(ukCommon.pages.reports.tabs['promises-daily']).toBe('Обіцянки до кінця місяця')
    expect(enCommon.pages.reports.tabs['promises-daily']).toBe('Promises till end of month')
  })
})
