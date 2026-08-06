import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

// The real DateSelect drags react-datepicker into jsdom; the tab tests only
// exercise filtering/error states, so a light stub keeps them focused.
vi.mock('@/components/ui/DateSelect', () => ({
  DateSelect: () => <input data-testid="date-select" readOnly />,
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
        makeRow({ employee_id: 2, full_name: 'Петренко Петро', department_name: 'Дайлер' }),
        makeRow({ employee_id: 3, full_name: 'Сидоренко Сидір', department_name: 'Стягнення' }),
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
        makeRow({ employee_id: 2, full_name: 'Петренко Петро', department_name: 'Дайлер' }),
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

  it('shows an error state with retry and recovers after a successful refetch', async () => {
    mockGetReport
      .mockRejectedValueOnce(
        Object.assign(new Error('Server error'), { response: { status: 500 } })
      )
      .mockResolvedValueOnce(makeResponse([makeRow()]))

    renderTab()

    expect(await screen.findByText('pages.reports.processing.error.title')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'pages.reports.processing.error.retry' })
    )

    expect(await screen.findByText('Іваненко Іван')).toBeInTheDocument()
  })

  it('shows the dedicated unavailability message on 503', async () => {
    mockGetReport.mockRejectedValue(
      Object.assign(new Error('Service unavailable'), { response: { status: 503 } })
    )

    renderTab()

    expect(await screen.findByText('pages.reports.processing.unavailable')).toBeInTheDocument()
  })
})
