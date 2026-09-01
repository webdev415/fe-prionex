import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { OutboundCallsTab } from '../OutboundCallsTab'
import { getOutboundCallsReport } from '../../api/outboundCallsApi'
import type { OutboundCallsReportResponse, OutboundCallsReportRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key.

vi.mock('../../api/outboundCallsApi', () => ({
  getOutboundCallsReport: vi.fn(),
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
// component (onChange receives a Date or null). `error` is rendered so the
// per-field hint stays observable.
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
      {error && <span role="alert">{error}</span>}
    </>
  ),
}))

const mockGetReport = vi.mocked(getOutboundCallsReport)

function makeRow(overrides: Partial<OutboundCallsReportRow> = {}): OutboundCallsReportRow {
  return {
    user_id: 101,
    fio: 'Іваненко Іван Іванович',
    sip: '2060',
    full_count: 288,
    env_count: 186,
    answer_count: 74,
    answer_percent: 25.69,
    quality_count: 31,
    quality_percent: 10.76,
    answer_duration_seconds: 4090,
    quality_duration_seconds: 3600,
    avg_duration_per_call_seconds: 14,
    avg_duration_per_answered_seconds: 55,
    department: 'Стягнення',
    group: 'Група №2',
    ...overrides,
  }
}

function makeResponse(rows: OutboundCallsReportRow[]): OutboundCallsReportResponse {
  return {
    project_id: 1,
    date_start: '2026-08-27',
    date_end: '2026-08-27',
    timezone: 'UTC',
    rows,
    generated_at: '2026-08-27T12:00:00Z',
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
 * Today as the component resolves it (the profile timezone is null in these
 * tests, so browser-local parts apply).
 */
function expectedToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
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
        <OutboundCallsTab />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const dateInputs = () => screen.getAllByTestId('date-select') as HTMLInputElement[]

beforeEach(() => {
  vi.clearAllMocks()
  authState.user.timezone = null
  authState.user.active_project_id = 1
})

describe('OutboundCallsTab', () => {
  it('defaults BOTH bounds to today and sends them explicitly', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    expect(await screen.findByText('Іваненко Іван Іванович')).toBeInTheDocument()

    const today = expectedToday()
    const [from, to] = dateInputs()
    expect(from.value).toBe(today)
    expect(to.value).toBe(today)

    // Request contract: both bounds always sent (the backend has no default
    // window — without one the aggregate would scan the whole call history),
    // and no timezone for a profile without one (the backend then uses UTC).
    expect(mockGetReport).toHaveBeenCalledTimes(1)
    expect(mockGetReport).toHaveBeenCalledWith({
      project_id: 1,
      date_start: today,
      date_end: today,
    })
  })

  it('sends the profile IANA timezone to the API when the user has one', async () => {
    authState.user.timezone = 'Europe/Kyiv'
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Іваненко Іван Іванович')

    expect(mockGetReport).toHaveBeenCalledWith(expect.objectContaining({ timezone: 'Europe/Kyiv' }))
  })

  it('reads both dates from the URL (?ocf=&oct=)', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?ocf=2026-08-01&oct=2026-08-27'])
    await screen.findByText('Іваненко Іван Іванович')

    expect(mockGetReport).toHaveBeenCalledWith(
      expect.objectContaining({ date_start: '2026-08-01', date_end: '2026-08-27' })
    )
  })

  it('writes a picked date into the URL and refetches', async () => {
    mockGetReport
      .mockResolvedValueOnce(makeResponse([makeRow()]))
      .mockResolvedValueOnce(makeResponse([makeRow({ sip: '2061', fio: 'Фільтренко Федір' })]))

    renderTab()
    await screen.findByText('Іваненко Іван Іванович')

    const [from] = dateInputs()
    fireEvent.change(from, { target: { value: '2026-08-01' } })

    await waitFor(() => expect(screen.getByTestId('location-search').textContent).toContain('ocf='))
    await waitFor(() =>
      expect(mockGetReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ date_start: '2026-08-01' })
      )
    )
    expect(await screen.findByText('Фільтренко Федір')).toBeInTheDocument()
  })

  it('blocks the request and shows an inline hint for an inverted window', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?ocf=2026-08-27&oct=2026-08-01'])

    expect(await screen.findByText('pages.reports.outboundCalls.invalidRange')).toBeInTheDocument()
    expect(mockGetReport).not.toHaveBeenCalled()
  })

  it('pins the 90-day boundary: 90 inclusive days pass, 91 are blocked', async () => {
    // Matches the backend's `_OUTBOUND_CALLS_MAX_WINDOW_DAYS` (services/client/
    // app/routers/reports.py), which counts calendar days INCLUSIVE — both ends
    // included, so a window of N inclusive days starts N−1 days before its end.
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Іваненко Іван Іванович')
    expect(mockGetReport).toHaveBeenCalledTimes(1)

    const [from, to] = dateInputs()
    const end = to.value
    const startOfWindow = (inclusiveDays: number) => isoPlusDays(end, -(inclusiveDays - 1))

    fireEvent.change(from, { target: { value: startOfWindow(90) } })
    await waitFor(() => expect(mockGetReport).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('pages.reports.outboundCalls.rangeTooLong')).not.toBeInTheDocument()

    fireEvent.change(from, { target: { value: startOfWindow(91) } })
    expect(await screen.findByText('pages.reports.outboundCalls.rangeTooLong')).toBeInTheDocument()
    expect(mockGetReport).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['a day the month does not have', '/?ocf=2026-02-31'],
    ['a month that does not exist', '/?oct=2026-13-01'],
  ])('blocks a hand-edited bound with %s', async (_case, entry) => {
    // Shape-only validation would let these through: the range checks compare
    // against NaN (always false) and the request would go out with a date the
    // picker itself renders as a different day.
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab([entry])

    expect(await screen.findByText('pages.reports.outboundCalls.invalidDate')).toBeInTheDocument()
    expect(mockGetReport).not.toHaveBeenCalled()
  })

  it('ignores a cleared manual input (URL keeps the previous value)', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?ocf=2026-08-01&oct=2026-08-27'])
    await screen.findByText('Іваненко Іван Іванович')

    const [from] = dateInputs()
    fireEvent.change(from, { target: { value: '' } })

    // Observable contract of onChange(null): both bounds are REQUIRED, so an
    // abandoned manual entry must not empty the window.
    expect(screen.getByTestId('location-search').textContent).toContain('ocf=2026-08-01')
    expect(screen.getByText('Іваненко Іван Іванович')).toBeInTheDocument()
    expect(mockGetReport).toHaveBeenCalledTimes(1)
  })

  it('renders the durations as a clock and the percents from the payload', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow({ answer_duration_seconds: 90_061 })]))

    renderTab()
    await screen.findByText('Іваненко Іван Іванович')

    expect(screen.getByText('25:01:01')).toBeInTheDocument()
    expect(screen.getByText('25.69%')).toBeInTheDocument()
  })

  it('names an unknown seat by its extension instead of dropping the row', async () => {
    mockGetReport.mockResolvedValue(
      makeResponse([makeRow({ user_id: null, fio: null, department: null, group: null })])
    )

    renderTab()

    // Once as the operator label, once in its own SIP column — the calls
    // happened, and dropping them would shrink every total.
    expect(await screen.findAllByText('2060')).toHaveLength(2)
  })

  it('shows the empty state when nobody dialled in the window', async () => {
    mockGetReport.mockResolvedValue(makeResponse([]))

    renderTab()

    expect(await screen.findByText('pages.reports.outboundCalls.empty')).toBeInTheDocument()
  })

  it('says nothing at all while the query is disabled (no project to ask about)', async () => {
    // An unresolvable project keeps the query off: no loading, no error and no
    // data. The "nobody dialled in the window" line would be a claim about a
    // period that was never queried, and the error box would blame a request
    // that never went out — so neither may appear.
    authState.user.active_project_id = 0
    mockGetReport.mockResolvedValue(makeResponse([]))

    renderTab()
    await screen.findByLabelText('pages.reports.outboundCalls.dateFrom')

    expect(mockGetReport).not.toHaveBeenCalled()
    expect(screen.queryByText('pages.reports.outboundCalls.empty')).not.toBeInTheDocument()
    expect(screen.queryByText('pages.reports.outboundCalls.error.title')).not.toBeInTheDocument()
  })

  it('marks previous-window rows as busy while a new one is loading', async () => {
    let resolveSecond: (value: OutboundCallsReportResponse) => void = () => {}
    mockGetReport
      .mockResolvedValueOnce(makeResponse([makeRow()]))
      .mockImplementationOnce(
        () => new Promise<OutboundCallsReportResponse>((resolve) => (resolveSecond = resolve))
      )

    renderTab()
    await screen.findByText('Іваненко Іван Іванович')

    const [from] = dateInputs()
    fireEvent.change(from, { target: { value: isoPlusDays(from.value, -1) } })

    expect(await screen.findByTestId('outbound-calls-refreshing')).toBeInTheDocument()
    expect(screen.getByText('Іваненко Іван Іванович')).toBeInTheDocument()

    resolveSecond(makeResponse([makeRow({ sip: '2065', fio: 'Оновленко Олег' })]))

    expect(await screen.findByText('Оновленко Олег')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByTestId('outbound-calls-refreshing')).not.toBeInTheDocument()
    )
  })

  it('shows an error state with retry and recovers after a successful refetch', async () => {
    mockGetReport
      .mockRejectedValueOnce(makeHttpError(500))
      .mockResolvedValueOnce(makeResponse([makeRow()]))

    renderTab()

    expect(await screen.findByText('pages.reports.outboundCalls.error.title')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.outboundCalls.error.retry' })
    )

    expect(await screen.findByText('Іваненко Іван Іванович')).toBeInTheDocument()
  })

  it('shows the backend detail for a 400 validation answer', async () => {
    mockGetReport.mockRejectedValue(
      makeHttpError(400, { detail: 'date_start must not be after date_end' })
    )

    renderTab()

    expect(await screen.findByText('date_start must not be after date_end')).toBeInTheDocument()
  })

  it('shows the window-too-wide 400 verbatim — it is the only actionable hint', async () => {
    // The aggregate walk has a page budget; past it the report refuses with a
    // sentence naming the remedy ("narrow the window"), which the generic
    // title would swallow.
    mockGetReport.mockRejectedValue(
      makeHttpError(400, { detail: 'The window holds too many calls — please narrow it' })
    )

    renderTab()

    expect(
      await screen.findByText('The window holds too many calls — please narrow it')
    ).toBeInTheDocument()
  })

  it('falls back to the generic title for a 400 with no detail body', async () => {
    // Otherwise axios' own untranslated "Request failed with status code 400"
    // would reach the screen.
    mockGetReport.mockRejectedValue(makeHttpError(400))

    renderTab()

    expect(await screen.findByText('pages.reports.outboundCalls.error.title')).toBeInTheDocument()
  })

  it('shows a permissions message without a retry button on 403', async () => {
    mockGetReport.mockRejectedValue(makeHttpError(403))

    renderTab()

    expect(await screen.findByText('pages.reports.outboundCalls.forbidden')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'pages.reports.outboundCalls.error.retry' })
    ).not.toBeInTheDocument()
  })

  it.each([502, 503, 504])(
    'shows the dedicated unavailability message on transient %d errors',
    async (status) => {
      mockGetReport.mockRejectedValue(makeHttpError(status))

      renderTab()

      expect(await screen.findByText('pages.reports.outboundCalls.unavailable')).toBeInTheDocument()
    }
  )

  it('shows the call-service 503 detail under the localized message', async () => {
    // The endpoint words its 503s distinctly (call-service down vs throttling
    // vs directory down vs deadline) because the remedies differ; the operator
    // reads their language and the server's own sentence stays visible.
    mockGetReport.mockRejectedValue(
      makeHttpError(503, { detail: 'Call statistics are unavailable' })
    )

    renderTab()

    expect(await screen.findByText('pages.reports.outboundCalls.unavailable')).toBeInTheDocument()
    expect(screen.getByText('Call statistics are unavailable')).toBeInTheDocument()
  })

  it('treats network failures as transient unavailability too', async () => {
    mockGetReport.mockRejectedValue(makeNetworkError('ERR_NETWORK'))

    renderTab()

    expect(await screen.findByText('pages.reports.outboundCalls.unavailable')).toBeInTheDocument()
  })
})
