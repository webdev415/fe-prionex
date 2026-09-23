/**
 * Dashboard tab wiring — board #1332 (D8: top collector), #1338 (D14: export
 * window, FE part), the read-only «Період» of #1337 (D13) and the project-wide
 * KPI fallbacks (same unfiltered rows as the top collector).
 *
 * The data hooks and the presentational components are stubbed; the stubs
 * capture the props the tab hands them, which is exactly what is under test.
 * react-i18next is mocked globally in src/test/setup.ts — t() returns the key.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

interface StubRow {
  id: string
  operator: string
  calls: number
  contactRate: number
  payments: number
}

interface StubTableParams {
  operatorId?: number
  enabled?: boolean
}

const captured = vi.hoisted(() => ({
  exportMutate: vi.fn(),
  paymentsModalData: undefined as unknown,
  tableProps: undefined as unknown,
  agentRows: [] as StubRow[],
  tableQueries: [] as StubTableParams[],
  /** Overrides of the dashboard KPIs for one test (e.g. a lagging 0). */
  kpiOverrides: {} as Record<string, unknown>,
}))

vi.mock('@/features/report', () => ({
  useDashboard: () => ({
    data: { ...dashboardFixture, kpis: { ...dashboardFixture.kpis, ...captured.kpiOverrides } },
    isLoading: false,
    error: null,
  }),
  // Behaves like the endpoint: `operatorId` narrows the rows to that operator;
  // a disabled query has no data.
  useAgentPerformanceTable: (params: StubTableParams) => {
    captured.tableQueries.push(params)
    const rows =
      params.operatorId === undefined
        ? captured.agentRows
        : captured.agentRows.filter((r) => r.id === String(params.operatorId))
    return {
      data: params.enabled === false ? undefined : rows,
      isLoading: false,
      isFetching: false,
    }
  },
  useExportDashboard: () => ({ mutate: captured.exportMutate, isPending: false }),
  useCallsMadeModal: () => ({ data: undefined, isLoading: false, error: null }),
  useContactRateModal: () => ({ data: undefined, isLoading: false, error: null }),
  useSMSSentModal: () => ({ data: undefined, isLoading: false, error: null }),
  useMessagesSentModal: () => ({ data: undefined, isLoading: false, error: null }),
}))

vi.mock('../components', () => ({
  KPICard: ({
    title,
    value,
    onViewDetails,
  }: {
    title: string
    value: string
    onViewDetails?: () => void
  }) => (
    <div>
      <button type="button" onClick={onViewDetails}>
        {title}
      </button>
      <span data-testid={`kpi-value-${title}`}>{value}</span>
    </div>
  ),
  PeriodTabs: () => <div data-testid="period-tabs" />,
  AgentPerformanceTable: (props: unknown) => {
    captured.tableProps = props
    return <div data-testid="agent-performance-table" />
  },
  PaymentsCollectedModal: ({ data }: { data: unknown }) => {
    captured.paymentsModalData = data
    return <div data-testid="payments-modal" />
  },
  ReportsDashboardPageSkeleton: () => <div data-testid="dashboard-skeleton" />,
  CallsMadeDetailModal: () => null,
  ContactRateDetailModal: () => null,
  SMSSentDetailModal: () => null,
  MessagesSentDetailModal: () => null,
}))

// The export button sits behind a permission check; this suite is about what
// the button sends, not who may see it.
vi.mock('@/components/auth', () => ({
  PermissionGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

// The other report tabs are never mounted here (the dashboard is the default).
vi.mock('@/features/clientProcessing', () => ({ ClientProcessingTab: () => null }))
vi.mock('@/features/thirdPartyVerification', () => ({ ThirdPartyVerificationTab: () => null }))
vi.mock('@/features/lowVerificationFeed', () => ({ LowVerificationFeedTab: () => null }))
vi.mock('@/features/searcherFollowup', () => ({ SearcherFollowupFeedTab: () => null }))
vi.mock('@/features/inboundFollowup', () => ({ InboundFollowupFeedTab: () => null }))
vi.mock('@/features/contactTag', () => ({ ContactTagFeedTab: () => null }))
vi.mock('@/features/communicationGap', () => ({ CommunicationGapFeedTab: () => null }))
vi.mock('@/features/operatorPromises', () => ({ OperatorPromisesTab: () => null }))
vi.mock('@/features/outboundCalls', () => ({ OutboundCallsTab: () => null }))
vi.mock('@/features/promisesDaily', () => ({ PromisesDailyTab: () => null }))
vi.mock('@/features/promisesFeed', () => ({ PromisesFeedTab: () => null }))
vi.mock('@/features/callbacksFeed', () => ({ CallbacksFeedTab: () => null }))
vi.mock('@/features/drainsFeed', () => ({ DrainsFeedTab: () => null }))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({
      isAuthenticated: true,
      user: {
        active_project_id: 4,
        projects: [{ id: 4 }],
        timezone: 'Europe/Kyiv',
        permissions: [],
      },
    }),
}))

import { ReportsDashboardPage } from '../ReportsDashboardPage'

const trend = { change: 0, changeType: 'increase' as const }
const dashboardFixture = {
  kpis: {
    callsMade: 10,
    callsTrend: trend,
    contactRate: 25,
    contactRateTrend: trend,
    smsSent: 5,
    smsTrend: trend,
    messagesSent: 3,
    messagesTrend: trend,
    paymentsCollected: 100,
    paymentsTrend: trend,
    paymentsCount: 1,
    paymentsAverage: 100,
    paymentsLargest: 100,
    paymentsVerified: 100,
    paymentsPending: 0,
  },
  paymentMethods: [],
  // Sorted by CALLS on the backend — «most calls» is not «top collector».
  topOperators: [{ operatorId: 1, operatorName: 'Most calls', callsMade: 900, contactRate: 20 }],
}

function row(id: string, operator: string, payments: number, calls = 10, contactRate = 20) {
  return {
    id,
    operator,
    calls,
    contactRate,
    avgDuration: '0:30',
    sms: 0,
    messages: 0,
    payments,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/reports']}>
      <ReportsDashboardPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  captured.exportMutate.mockReset()
  captured.paymentsModalData = undefined
  captured.tableProps = undefined
  captured.agentRows = []
  captured.tableQueries = []
  captured.kpiOverrides = {}
  // 21.09 21:30 UTC is already 22.09 00:30 in Kyiv: the profile time zone,
  // not the UTC date, decides which "today" the screen and the export use.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-21T21:30:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('dashboard tab — top collector (D8 #1332)', () => {
  it('takes name and amount from the same operator: the largest collected amount', () => {
    captured.agentRows = [
      row('1', 'Most calls', 1200),
      row('2', 'Top collector', 58_000),
      row('3', 'Other', 9_000),
    ]
    renderPage()

    fireEvent.click(screen.getByText('pages.reports.kpi.paymentsCollected'))

    expect(screen.getByTestId('payments-modal')).toBeInTheDocument()
    expect(captured.paymentsModalData).toMatchObject({
      topCollectorName: 'Top collector',
      topCollectorAmount: 58_000,
    })
  })

  it('picks over all operators even while the table is filtered to one', () => {
    captured.agentRows = [
      row('1', 'Most calls', 1200),
      row('2', 'Top collector', 58_000),
      row('3', 'Other', 9_000),
    ]
    renderPage()

    const table = captured.tableProps as { onOperatorChange: (id: number | null) => void }
    act(() => table.onOperatorChange(3))
    // The table now shows the selected operator only …
    expect((captured.tableProps as { data: StubRow[] }).data.map((r) => r.operator)).toEqual([
      'Other',
    ])

    fireEvent.click(screen.getByText('pages.reports.kpi.paymentsCollected'))

    // … but the payments modal is project-wide, and so is its top collector.
    expect(captured.paymentsModalData).toMatchObject({
      topCollectorName: 'Top collector',
      topCollectorAmount: 58_000,
    })
  })

  it('warms the unfiltered list as soon as a filter is on, before the modal opens', () => {
    captured.agentRows = [row('1', 'Other', 1_000), row('2', 'Top collector', 58_000)]
    renderPage()

    const unfilteredExtra = () =>
      captured.tableQueries.filter((q) => q.operatorId === undefined && q.enabled !== undefined)
    // No filter: the table query already is the unfiltered list.
    expect(unfilteredExtra().every((q) => q.enabled === false)).toBe(true)

    const table = captured.tableProps as { onOperatorChange: (id: number | null) => void }
    act(() => table.onOperatorChange(1))
    // Filter on, modal still closed: the project-wide list is already requested …
    expect(screen.queryByTestId('payments-modal')).not.toBeInTheDocument()
    expect(unfilteredExtra().at(-1)?.enabled).toBe(true)

    // … so the modal opens with the top collector in place.
    fireEvent.click(screen.getByText('pages.reports.kpi.paymentsCollected'))
    expect(captured.paymentsModalData).toMatchObject({
      topCollectorName: 'Top collector',
      topCollectorAmount: 58_000,
    })

    // Filter cleared: back to the table's own (unfiltered) query only.
    act(() => table.onOperatorChange(null))
    expect(unfilteredExtra().at(-1)?.enabled).toBe(false)
  })

  it('hides the top collector when nobody collected anything', () => {
    captured.agentRows = [row('1', 'Most calls', 0)]
    renderPage()

    fireEvent.click(screen.getByText('pages.reports.kpi.paymentsCollected'))

    const data = captured.paymentsModalData as Record<string, unknown>
    expect(data.topCollectorName).toBeUndefined()
    expect(data.topCollectorAmount).toBeUndefined()
  })
})

describe('dashboard tab — project-wide KPI fallbacks', () => {
  const kpiValue = (key: string) => screen.getByTestId(`kpi-value-pages.reports.kpi.${key}`)

  beforeEach(() => {
    // Lagging dashboard KPIs: the cards fall back to the operator rows.
    captured.kpiOverrides = { callsMade: 0, contactRate: 0 }
    captured.agentRows = [row('1', 'Olena', 0, 100, 30), row('2', 'Petro', 0, 50, 10)]
  })

  it('derives calls and a weighted contact rate over all operators', () => {
    renderPage()

    expect(kpiValue('callsMade')).toHaveTextContent(/^150$/)
    // (30 + 5) answered / 150 calls — weighted, not the mean of 30 % and 10 %.
    expect(kpiValue('contactRate')).toHaveTextContent(/^23\.3%$/)
  })

  it('keeps the project-wide numbers while the table is filtered to one operator', () => {
    renderPage()

    const table = captured.tableProps as { onOperatorChange: (id: number | null) => void }
    act(() => table.onOperatorChange(2))
    expect((captured.tableProps as { data: StubRow[] }).data.map((r) => r.operator)).toEqual([
      'Petro',
    ])

    expect(kpiValue('callsMade')).toHaveTextContent(/^150$/)
    expect(kpiValue('contactRate')).toHaveTextContent(/^23\.3%$/)
  })

  it('prefers the dashboard KPIs when they are present', () => {
    captured.kpiOverrides = {}
    renderPage()

    expect(kpiValue('callsMade')).toHaveTextContent(/^10$/)
    expect(kpiValue('contactRate')).toHaveTextContent(/^25\.0%$/)
  })
})

describe('dashboard tab — export window (D14 #1338)', () => {
  it('exports the window the screen shows, in the profile time zone', () => {
    renderPage()

    fireEvent.click(screen.getByText('pages.reports.exportCsv'))

    expect(captured.exportMutate).toHaveBeenCalledTimes(1)
    expect(captured.exportMutate).toHaveBeenCalledWith({
      projectId: 4,
      format: 'csv',
      period: 'today',
      startDate: '2026-09-22',
      endDate: '2026-09-22',
      timezone: 'Europe/Kyiv',
    })
  })

  it('shows the table the same window it is queried for (D13 #1337)', () => {
    renderPage()

    expect(captured.tableProps).toMatchObject({ fromDate: '2026-09-22', toDate: '2026-09-22' })
  })
})
