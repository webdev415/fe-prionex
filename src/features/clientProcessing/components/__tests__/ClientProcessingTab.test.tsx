import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ClientProcessingTab } from '../ClientProcessingTab'
import { getClientProcessingReport } from '../../api/clientProcessingApi'
import type { ProcessingReportResponse, ProcessingReportRow } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key.

vi.mock('../../api/clientProcessingApi', () => ({
  getClientProcessingReport: vi.fn(),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({
      user: { active_project_id: 1, projects: [{ id: 1 }], timezone: null },
    }),
}))

// The real DateSelect drags react-datepicker into jsdom; a functional stub
// keeps the tests focused while still driving value/onChange like the real
// component (onChange receives a Date or null, mirroring DateSelect's API).
vi.mock('@/components/ui/DateSelect', () => ({
  DateSelect: ({
    value,
    onChange,
  }: {
    value?: string | Date | null
    onChange?: (args: { value: Date | null }) => void
  }) => (
    <input
      data-testid="date-select"
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

function renderTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ClientProcessingTab />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ClientProcessingTab', () => {
  it('renders the ТП department rows by default and filters out other departments', async () => {
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
    // One request serves all department sub-tabs
    expect(mockGetReport).toHaveBeenCalledTimes(1)
    expect(mockGetReport).toHaveBeenCalledWith(expect.objectContaining({ project_id: 1 }))
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

  it('blocks the request and shows a hint when the range exceeds 366 days', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Іваненко Іван')
    expect(mockGetReport).toHaveBeenCalledTimes(1)

    const [startInput] = screen.getAllByTestId('date-select')
    const initialStart = (startInput as HTMLInputElement).value
    fireEvent.change(startInput, { target: { value: isoPlusDays(initialStart, -400) } })

    expect(await screen.findByText('pages.reports.processing.rangeTooLong')).toBeInTheDocument()
    expect(screen.queryByText('Іваненко Іван')).not.toBeInTheDocument()
    expect(mockGetReport).toHaveBeenCalledTimes(1)
  })

  it('restores the previous date when a manual input is cleared', async () => {
    mockGetReport.mockResolvedValue(makeResponse([makeRow()]))

    renderTab()
    await screen.findByText('Іваненко Іван')

    const [startInput] = screen.getAllByTestId('date-select')
    const initialValue = (startInput as HTMLInputElement).value
    expect(initialValue).not.toBe('')

    fireEvent.change(startInput, { target: { value: '' } })

    // The field resyncs to the kept filter value instead of staying empty
    const [resyncedInput] = screen.getAllByTestId('date-select')
    expect((resyncedInput as HTMLInputElement).value).toBe(initialValue)
    // Filter state unchanged — no new request
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
