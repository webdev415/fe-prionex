/**
 * Dashboard tab with a KPI that has no trend — board #1448.
 *
 * report-service may answer `kpis.payments_collected.trend: null`; the
 * transformer hands that over as `paymentsTrend: null`. The real KPICard and
 * PaymentsCollectedModal are rendered here, so the test sees what the operator
 * sees: the value, and no arrow / «0 %» / comparison next to it.
 * react-i18next is mocked globally in src/test/setup.ts — t() returns the key.
 */

import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

vi.mock('@/features/report', () => ({
  useDashboard: () => ({ data: dashboardFixture, isLoading: false, error: null }),
  useAgentPerformanceTable: () => ({
    data: [],
    topCollector: undefined,
    isLoading: false,
    isFetching: false,
  }),
  useExportDashboard: () => ({ mutate: vi.fn(), isPending: false }),
  useCallsMadeModal: () => ({ data: undefined, isLoading: false, error: null }),
  useContactRateModal: () => ({ data: undefined, isLoading: false, error: null }),
  useSMSSentModal: () => ({ data: undefined, isLoading: false, error: null }),
  useMessagesSentModal: () => ({ data: undefined, isLoading: false, error: null }),
}))

// The two components under test are the real ones; the rest are stubs.
vi.mock('../components', async () => {
  const { KPICard } =
    await vi.importActual<typeof import('../components/KPICard')>('../components/KPICard')
  const { PaymentsCollectedModal } = await vi.importActual<
    typeof import('../components/PaymentsCollectedModal')
  >('../components/PaymentsCollectedModal')
  return {
    KPICard,
    PaymentsCollectedModal,
    PeriodTabs: () => <div data-testid="period-tabs" />,
    AgentPerformanceTable: () => <div data-testid="agent-performance-table" />,
    ReportsDashboardPageSkeleton: () => <div data-testid="dashboard-skeleton" />,
    CallsMadeDetailModal: () => null,
    ContactRateDetailModal: () => null,
    SMSSentDetailModal: () => null,
    MessagesSentDetailModal: () => null,
  }
})

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

const trend = { change: 12, changeType: 'increase' as const, previousValue: 100 }
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
    paymentsCollected: 1500,
    // What the transformer makes of `payments_collected.trend: null`.
    paymentsTrend: null,
    paymentsCount: 3,
    paymentsAverage: 500,
    paymentsLargest: 800,
    paymentsVerified: 1000,
    paymentsPending: 500,
  },
  paymentMethods: [],
  topOperators: [],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/reports']}>
      <ReportsDashboardPage />
    </MemoryRouter>
  )
}

/** The KPICard around its title: title span → header row → card. */
function kpiTile(titleKey: string): HTMLElement {
  const card = screen.getByText(titleKey).parentElement?.parentElement
  if (!card) throw new Error(`no KPI card for ${titleKey}`)
  return card
}

describe('dashboard tab — KPI without a trend (#1448)', () => {
  it('renders the payments value without a trend badge', () => {
    renderPage()

    const payments = kpiTile('pages.reports.kpi.paymentsCollected')
    expect(within(payments).getByText('1500')).toBeInTheDocument()
    expect(within(payments).queryByText('pages.reports.kpi.vs')).not.toBeInTheDocument()
    expect(within(payments).queryByText(/%/)).not.toBeInTheDocument()
  })

  it('keeps the badge on a KPI that has a trend', () => {
    renderPage()

    const calls = kpiTile('pages.reports.kpi.callsMade')
    expect(within(calls).getByText('12%')).toBeInTheDocument()
    expect(within(calls).getByText('pages.reports.kpi.vs')).toBeInTheDocument()
  })

  it('opens the payments modal without a trend row', () => {
    renderPage()

    const payments = kpiTile('pages.reports.kpi.paymentsCollected')
    fireEvent.click(within(payments).getByText('pages.reports.kpi.viewDetails'))

    const modal = screen.getByRole('dialog')
    expect(within(modal).getByText('pages.reports.paymentsModal.title')).toBeInTheDocument()
    expect(within(modal).queryByText('pages.reports.kpi.vs')).not.toBeInTheDocument()
  })
})
