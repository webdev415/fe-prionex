import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { ClientProcessingTab } from '../ClientProcessingTab'
import { getClientProcessingReport } from '../../api/clientProcessingApi'
import type { ProcessingReportResponse, ProcessingReportRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key.

vi.mock('../../api/clientProcessingApi', () => ({
  getClientProcessingReport: vi.fn(),
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
// component (onChange receives a Date or null, mirroring DateSelect's API).
// `min`/`max` are surfaced as `data-min`/`data-max` and ONLY when the tab
// passes them: in the real component they become react-datepicker's
// minDate/maxDate, i.e. they are what greys days out — mirroring them as
// data attributes is what lets a test PIN their absence (the dead-calendar
// rule below), the same probe the operator-promises suite uses.
vi.mock('@/components/ui/DateSelect', () => ({
  DateSelect: ({
    value,
    onChange,
    label,
    min,
    max,
  }: {
    value?: string | Date | null
    onChange?: (args: { value: Date | null }) => void
    label?: string
    min?: Date | string
    max?: Date | string
  }) => (
    <input
      data-testid="date-select"
      aria-label={label}
      data-min={min == null ? undefined : String(min)}
      data-max={max == null ? undefined : String(max)}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) =>
        // Noon avoids the parsed UTC date rolling into the previous local day
        onChange?.({ value: e.target.value ? new Date(`${e.target.value}T12:00:00`) : null })
      }
    />
  ),
}))

const mockGetReport = vi.mocked(getClientProcessingReport)

function makeRow(overrides: Partial<ProcessingReportRow> = {}): ProcessingReportRow {
  return {
    employee_id: 1,
    full_name: 'Іваненко Іван',
    department_id: 10,
    department_name: 'ТП',
    group_id: 100,
    group_name: 'Група 1',
    count_client: 200,
    count_processed: 120,
    count_processed_client: 90,
    count_processed_contact: 40,
    percent_processed: 60,
    percent_processed_client: 45,
    percent_processed_contact: 20,
    ...overrides,
  }
}

function makeResponse(rows: ProcessingReportRow[]): ProcessingReportResponse {
  return {
    project_id: 1,
    date_start: '2026-08-06',
    date_end: '2026-08-06',
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
        <ClientProcessingTab />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authState.user.timezone = null
})

describe('ClientProcessingTab', () => {
  it('renders the ТП department rows by default and requests today–today', async () => {
    mockGetReport.mockResolvedValue(
      makeResponse([
        makeRow(),
        makeRow({
          employee_id: 2,
          full_name: 'Петренко Петро',
          department_id: 11,
          department_name: 'Дайлер',
        }),
        makeRow({
          employee_id: 3,
          full_name: 'Сидоренко Сидір',
          department_id: 12,
          department_name: 'Стягнення',
        }),
      ])
    )

    renderTab()

    expect(await screen.findByText('Іваненко Іван')).toBeInTheDocument()
    expect(screen.queryByText('Петренко Петро')).not.toBeInTheDocument()
    expect(screen.queryByText('Сидоренко Сидір')).not.toBeInTheDocument()

    // One request serves all department sub-tabs; contract: project + the
    // today–today default window shown in the pickers, no timezone for a
    // profile without one (backend then defaults to UTC).
    const [startInput, endInput] = screen.getAllByTestId('date-select')
    expect(mockGetReport).toHaveBeenCalledTimes(1)
    expect(mockGetReport).toHaveBeenCalledWith({
      project_id: 1,
      date_start: (startInput as HTMLInputElement).value,
      date_end: (endInput as HTMLInputElement).value,
    })
  })

  it('sends the profile IANA timezone to the API when the user has one', async () => {
    authState.user.timezone = 'Europe/Kyiv'
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Іваненко Іван')

    expect(mockGetReport).toHaveBeenCalledWith(expect.objectContaining({ timezone: 'Europe/Kyiv' }))
  })

  it('reads dates and department from the URL (?from=&to=&dept=)', async () => {
    mockGetReport.mockResolvedValue(
      makeResponse([
        makeRow(),
        makeRow({
          employee_id: 3,
          full_name: 'Сидоренко Сидір',
          department_id: 12,
          department_name: 'Стягнення',
        }),
      ])
    )

    renderTab(['/?from=2026-01-01&to=2026-01-31&dept=collection'])

    expect(await screen.findByText('Сидоренко Сидір')).toBeInTheDocument()
    expect(screen.queryByText('Іваненко Іван')).not.toBeInTheDocument()
    expect(mockGetReport).toHaveBeenCalledWith(
      expect.objectContaining({ date_start: '2026-01-01', date_end: '2026-01-31' })
    )
  })

  it('falls back to today for an impossible calendar date in the URL', async () => {
    // Round-trip validation, not a shape check: V8's Date.parse lazily reads
    // 2026-02-31 as March 3rd, so a `^\d{4}-\d{2}-\d{2}$` regex would send the
    // API a date nobody typed and feed NaN-free-but-wrong numbers into the
    // 366-day arithmetic. An unusable value takes this tab's long-standing
    // malformed-URL path instead: the today default, in field and request.
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab(['/?from=2026-02-31&to=2026-02-31'])
    await screen.findByText('Іваненко Іван')

    const [startInput] = screen.getAllByTestId('date-select') as HTMLInputElement[]
    expect(startInput.value).not.toBe('2026-02-31')
    expect(mockGetReport).toHaveBeenCalledTimes(1)
    const params = mockGetReport.mock.calls[0][0]
    expect(params.date_start).toBe(startInput.value)
    // Neither the raw impossible day nor its lazy V8 reading may go out.
    expect(params.date_start).not.toBe('2026-02-31')
    expect(params.date_start).not.toBe('2026-03-03')
    expect(params.date_end).toBe(params.date_start)
  })

  it('bounds neither picker by the other — no min/max on either field', async () => {
    // A mutual bound would not deaden a calendar, but it would impose an ORDER
    // nothing on screen states: with the today–today default, «з» would open on
    // days up to today and «по» on days from today, so "give me last month" is
    // reachable only by moving «з» first — reach for «по» first and the whole
    // past is greyed out with no explanation. The page-wide rule (same on the
    // operator-promises and searcher tabs); the inverted-pair GUARD (test
    // below) is what actually protects the API.
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Іваненко Іван')

    for (const field of screen.getAllByTestId('date-select')) {
      expect(field).not.toHaveAttribute('data-min')
      expect(field).not.toHaveAttribute('data-max')
    }
  })

  it('switches rows when another department sub-tab is selected', async () => {
    mockGetReport.mockResolvedValue(
      makeResponse([
        makeRow(),
        makeRow({
          employee_id: 2,
          full_name: 'Петренко Петро',
          department_id: 11,
          department_name: 'Дайлер',
        }),
      ])
    )

    renderTab()
    await screen.findByText('Іваненко Іван')

    await userEvent.click(
      screen.getByRole('tab', { name: 'pages.reports.processing.departments.dialer' })
    )

    expect(await screen.findByText('Петренко Петро')).toBeInTheDocument()
    expect(screen.queryByText('Іваненко Іван')).not.toBeInTheDocument()
    // Client-side filter — no extra request
    expect(mockGetReport).toHaveBeenCalledTimes(1)
  })

  it('defaults to the first non-empty sub-tab when ?dept= is not set', async () => {
    mockGetReport.mockResolvedValue(
      makeResponse([
        makeRow({
          employee_id: 2,
          full_name: 'Петренко Петро',
          department_id: 11,
          department_name: 'Дайлер',
        }),
      ])
    )

    renderTab()

    // No ТП rows — the Дайлер tab (first with data) opens instead of an empty ТП
    expect(await screen.findByText('Петренко Петро')).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: 'pages.reports.processing.departments.dialer' })
    ).toHaveAttribute('aria-selected', 'true')

    // An auto-selected tab is NOT pinned into the URL: it would freeze the
    // heuristic after the first load and put a department nobody chose into
    // shared links.
    expect(screen.getByTestId('location-search').textContent).not.toContain('dept=')
  })

  it('re-resolves the auto-selected sub-tab after the period changes', async () => {
    mockGetReport
      .mockResolvedValueOnce(
        makeResponse([
          makeRow({
            employee_id: 2,
            full_name: 'Петренко Петро',
            department_id: 11,
            department_name: 'Дайлер',
          }),
        ])
      )
      .mockResolvedValueOnce(
        makeResponse([
          makeRow({
            employee_id: 3,
            full_name: 'Сидоренко Сидір',
            department_id: 12,
            department_name: 'Стягнення',
          }),
        ])
      )

    renderTab()
    await screen.findByText('Петренко Петро')

    const [, endInput] = screen.getAllByTestId('date-select')
    fireEvent.change(endInput, {
      target: { value: isoPlusDays((endInput as HTMLInputElement).value, 1) },
    })

    // The new period's rows live in another department — the heuristic runs
    // again instead of stranding the user on an empty Дайлер tab
    expect(await screen.findByText('Сидоренко Сидір')).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getByRole('tab', { name: 'pages.reports.processing.departments.collection' })
      ).toHaveAttribute('aria-selected', 'true')
    )
  })

  it('keeps an explicitly picked sub-tab across a period change', async () => {
    mockGetReport.mockResolvedValue(
      makeResponse([
        makeRow(),
        makeRow({
          employee_id: 2,
          full_name: 'Петренко Петро',
          department_id: 11,
          department_name: 'Дайлер',
        }),
      ])
    )

    renderTab()
    await screen.findByText('Іваненко Іван')

    await userEvent.click(
      screen.getByRole('tab', { name: 'pages.reports.processing.departments.dialer' })
    )
    await screen.findByText('Петренко Петро')

    const [, endInput] = screen.getAllByTestId('date-select')
    fireEvent.change(endInput, {
      target: { value: isoPlusDays((endInput as HTMLInputElement).value, 1) },
    })

    // ТП has rows too, so the heuristic would have grabbed it — the user's
    // pick (also pinned in ?dept=) wins
    expect(await screen.findByText('Петренко Петро')).toBeInTheDocument()
    expect(screen.queryByText('Іваненко Іван')).not.toBeInTheDocument()
    expect(screen.getByTestId('location-search').textContent).toContain('dept=dialer')
  })

  it('builds id-keyed extra sub-tabs and a «—» tab for rows without a department', async () => {
    mockGetReport.mockResolvedValue(
      makeResponse([
        makeRow(),
        makeRow({
          employee_id: 2,
          full_name: 'Новенко Новак',
          department_id: 42,
          department_name: 'Новий відділ',
        }),
        makeRow({
          employee_id: 3,
          full_name: 'Безвідділенко Богдан',
          department_id: null,
          department_name: null,
        }),
      ])
    )

    renderTab()
    await screen.findByText('Іваненко Іван')

    // Unknown department appears after the three known tabs, «—» goes last
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'pages.reports.processing.departments.tp',
      'pages.reports.processing.departments.dialer',
      'pages.reports.processing.departments.collection',
      'Новий відділ',
      '—',
    ])

    await userEvent.click(screen.getByRole('tab', { name: 'Новий відділ' }))
    expect(await screen.findByText('Новенко Новак')).toBeInTheDocument()
    expect(screen.queryByText('Іваненко Іван')).not.toBeInTheDocument()

    // Rows without a department are not lost — they live under «—»
    await userEvent.click(screen.getByRole('tab', { name: '—' }))
    expect(await screen.findByText('Безвідділенко Богдан')).toBeInTheDocument()
    expect(screen.queryByText('Новенко Новак')).not.toBeInTheDocument()
  })

  it('formats percents as XX.XX% in the table', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow({ percent_processed: 76.6 })]))

    renderTab()

    expect(await screen.findByText('76.60%')).toBeInTheDocument()
  })

  it('shows the empty state when the department has no rows', async () => {
    mockGetReport.mockResolvedValue(makeResponse([]))

    renderTab()

    expect(await screen.findByText('pages.reports.processing.empty')).toBeInTheDocument()
  })

  it('marks previous-period rows as busy while a new period is loading', async () => {
    let resolveSecond: (value: ProcessingReportResponse) => void = () => {}
    mockGetReport
      .mockResolvedValueOnce(makeResponse([makeRow()]))
      .mockImplementationOnce(
        () => new Promise<ProcessingReportResponse>((resolve) => (resolveSecond = resolve))
      )

    renderTab()
    await screen.findByText('Іваненко Іван')

    // Change the end date — a new period starts fetching
    const [, endInput] = screen.getAllByTestId('date-select')
    const initialEnd = (endInput as HTMLInputElement).value
    fireEvent.change(endInput, { target: { value: isoPlusDays(initialEnd, 1) } })

    // Old rows are still shown (keepPreviousData) but flagged as busy
    expect(await screen.findByTestId('processing-refreshing')).toBeInTheDocument()
    expect(screen.getByText('Іваненко Іван')).toBeInTheDocument()

    resolveSecond(makeResponse([makeRow({ employee_id: 5, full_name: 'Оновленко Олег' })]))

    expect(await screen.findByText('Оновленко Олег')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByTestId('processing-refreshing')).not.toBeInTheDocument()
    )
  })

  it('blocks the request and shows an inline hint for an inverted date range', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Іваненко Іван')
    expect(mockGetReport).toHaveBeenCalledTimes(1)

    // Manual input can bypass the pickers' min/max — set start far after end
    const [startInput] = screen.getAllByTestId('date-select')
    fireEvent.change(startInput, { target: { value: '2030-01-05' } })

    expect(await screen.findByText('pages.reports.processing.invalidRange')).toBeInTheDocument()
    // The table is hidden and no request was issued for the inverted range
    expect(screen.queryByText('Іваненко Іван')).not.toBeInTheDocument()
    expect(mockGetReport).toHaveBeenCalledTimes(1)
  })

  it('pins the 366-day boundary: a 366-day span passes, 367 is blocked', async () => {
    // Matches the backend's `_MAX_RANGE_DAYS` (services/client/app/routers/
    // reports.py): (end - start) diff of 366 days is the widest allowed window.
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Іваненко Іван')
    expect(mockGetReport).toHaveBeenCalledTimes(1)

    const [startInput, endInput] = screen.getAllByTestId('date-select')
    const end = (endInput as HTMLInputElement).value

    // Exactly 366 days back — still valid, a new request goes out
    fireEvent.change(startInput, { target: { value: isoPlusDays(end, -366) } })
    await waitFor(() => expect(mockGetReport).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('pages.reports.processing.rangeTooLong')).not.toBeInTheDocument()

    // 367 days back — blocked with a hint, no third request
    fireEvent.change(startInput, { target: { value: isoPlusDays(end, -367) } })
    expect(await screen.findByText('pages.reports.processing.rangeTooLong')).toBeInTheDocument()
    expect(mockGetReport).toHaveBeenCalledTimes(2)
  })

  it('ignores a cleared manual date input (URL keeps the previous value)', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Іваненко Іван')

    const [startInput] = screen.getAllByTestId('date-select')
    const initialValue = (startInput as HTMLInputElement).value
    expect(initialValue).not.toBe('')

    fireEvent.change(startInput, { target: { value: '' } })

    // onChange(null) is a no-op: state/URL keep the old date and no request
    // is issued; a valid date commits once the user finishes retyping.
    const [inputAfterClear] = screen.getAllByTestId('date-select')
    expect((inputAfterClear as HTMLInputElement).value).toBe(initialValue)
    expect(screen.getByText('Іваненко Іван')).toBeInTheDocument()
    expect(mockGetReport).toHaveBeenCalledTimes(1)
  })

  it('shows an error state with retry and recovers after a successful refetch', async () => {
    mockGetReport
      .mockRejectedValueOnce(makeHttpError(500))
      .mockResolvedValueOnce(makeResponse([makeRow()]))

    renderTab()

    expect(await screen.findByText('pages.reports.processing.error.title')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.processing.error.retry' })
    )

    expect(await screen.findByText('Іваненко Іван')).toBeInTheDocument()
  })

  it('shows the backend detail for a 400 validation answer', async () => {
    mockGetReport.mockRejectedValue(
      makeHttpError(400, { detail: 'Date range must not exceed 366 days' })
    )

    renderTab()

    expect(await screen.findByText('Date range must not exceed 366 days')).toBeInTheDocument()
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
    mockGetReport.mockRejectedValue(makeHttpError(400))

    renderTab()

    expect(await screen.findByText('pages.reports.processing.error.title')).toBeInTheDocument()
    expect(screen.queryByText(/HTTP 400/)).not.toBeInTheDocument()
  })

  it('shows a permissions message without a retry button on 403', async () => {
    mockGetReport.mockRejectedValue(makeHttpError(403))

    renderTab()

    expect(await screen.findByText('pages.reports.processing.forbidden')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'pages.reports.processing.error.retry' })
    ).not.toBeInTheDocument()
  })

  it.each([502, 503, 504])(
    'shows the dedicated unavailability message on transient %d errors',
    async (status) => {
      mockGetReport.mockRejectedValue(makeHttpError(status))

      renderTab()

      expect(await screen.findByText('pages.reports.processing.unavailable')).toBeInTheDocument()
    }
  )

  it('treats network failures as transient unavailability too', async () => {
    mockGetReport.mockRejectedValue(makeNetworkError('ERR_NETWORK'))

    renderTab()

    expect(await screen.findByText('pages.reports.processing.unavailable')).toBeInTheDocument()
  })
})
