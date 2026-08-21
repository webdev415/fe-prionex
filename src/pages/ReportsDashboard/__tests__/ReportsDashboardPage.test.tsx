import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { ReportsDashboardPage } from '../ReportsDashboardPage'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key.

// The dashboard tab's data layer: every hook it calls lives in @/features/report,
// so one module mock keeps the host test free of react-query and the network.
vi.mock('@/features/report', () => ({
  useDashboard: () => ({ data: dashboardFixture, isLoading: false, error: null }),
  useAgentPerformanceTable: () => ({ data: [], isLoading: false, isFetching: false }),
  useExportDashboard: () => ({ mutate: vi.fn(), isPending: false }),
  useCallsMadeModal: () => ({ data: undefined, isLoading: false, error: null }),
  useContactRateModal: () => ({ data: undefined, isLoading: false, error: null }),
  useSMSSentModal: () => ({ data: undefined, isLoading: false, error: null }),
  useMessagesSentModal: () => ({ data: undefined, isLoading: false, error: null }),
}))

// Presentation of the dashboard tab is covered by its own component tests; here
// the stubs only need to be identifiable so we can tell the two panels apart.
vi.mock('../components', () => ({
  KPICard: ({ title }: { title: string }) => <div data-testid="kpi-card">{title}</div>,
  PeriodTabs: () => <div data-testid="period-tabs" />,
  AgentPerformanceTable: () => <div data-testid="agent-performance-table" />,
  PaymentsCollectedModal: () => null,
  ReportsDashboardPageSkeleton: () => <div data-testid="dashboard-skeleton" />,
  CallsMadeDetailModal: () => null,
  ContactRateDetailModal: () => null,
  SMSSentDetailModal: () => null,
  MessagesSentDetailModal: () => null,
}))

// The processing tab has its own suite (features/clientProcessing) — the host
// only cares that this panel, and not the dashboard, is what gets mounted.
vi.mock('@/features/clientProcessing', () => ({
  ClientProcessingTab: () => <div data-testid="client-processing-tab" />,
}))

// Likewise for the verification tab (features/thirdPartyVerification).
vi.mock('@/features/thirdPartyVerification', () => ({
  ThirdPartyVerificationTab: () => <div data-testid="third-party-verification-tab" />,
}))

// …and for the low-verification feed (features/lowVerificationFeed).
vi.mock('@/features/lowVerificationFeed', () => ({
  LowVerificationFeedTab: () => <div data-testid="low-verification-feed-tab" />,
}))

// …and for the searcher follow-up feed (features/searcherFollowup).
vi.mock('@/features/searcherFollowup', () => ({
  SearcherFollowupFeedTab: () => <div data-testid="searcher-followup-feed-tab" />,
}))

// …and for the communication-gap feed (features/communicationGap).
vi.mock('@/features/communicationGap', () => ({
  CommunicationGapFeedTab: () => <div data-testid="communication-gap-feed-tab" />,
}))

// …and for the operator-promises report (features/operatorPromises).
vi.mock('@/features/operatorPromises', () => ({
  OperatorPromisesTab: () => <div data-testid="operator-promises-tab" />,
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({
      isAuthenticated: true,
      user: {
        active_project_id: 1,
        projects: [{ id: 1 }],
        timezone: null,
        permissions: [],
      },
    }),
}))

/** Minimal shape DashboardTab reads while no detail modal is open. */
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
  topOperators: [],
}

/** Exposes the current ?search and lets a test walk the history stack back. */
function HistoryProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <div data-testid="location-search">{location.search}</div>
      <button type="button" data-testid="history-back" onClick={() => navigate(-1)}>
        back
      </button>
    </>
  )
}

function renderPage(initialEntries: string[] = ['/reports']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ReportsDashboardPage />
      <HistoryProbe />
    </MemoryRouter>
  )
}

const search = () => screen.getByTestId('location-search').textContent ?? ''

const dashboardTab = () => screen.getByRole('tab', { name: 'pages.reports.tabs.dashboard' })
const processingTab = () => screen.getByRole('tab', { name: 'pages.reports.tabs.processing' })
const verificationTab = () => screen.getByRole('tab', { name: 'pages.reports.tabs.verification' })
const lowVerificationTab = () =>
  screen.getByRole('tab', { name: 'pages.reports.tabs.low-verification' })
const searcherFollowupTab = () =>
  screen.getByRole('tab', { name: 'pages.reports.tabs.searcher-followup' })
const communicationGapTab = () =>
  screen.getByRole('tab', { name: 'pages.reports.tabs.communication-gap' })
const operatorPromisesTab = () =>
  screen.getByRole('tab', { name: 'pages.reports.tabs.operator-promises' })

describe('ReportsDashboardPage (tab host)', () => {
  it('renders the processing report panel for ?tab=processing', () => {
    renderPage(['/reports?tab=processing'])

    expect(screen.getByTestId('client-processing-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('agent-performance-table')).not.toBeInTheDocument()
    expect(processingTab()).toHaveAttribute('aria-selected', 'true')
    // The panel is labelled by the active tab, so the pairing must follow it
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'reports-panel-processing')
  })

  it.each([
    ['no tab param', '/reports'],
    ['an unknown tab value', '/reports?tab=bogus'],
    ['an empty tab value', '/reports?tab='],
  ])('falls back to the dashboard for %s', (_case, entry) => {
    renderPage([entry])

    expect(screen.getByTestId('agent-performance-table')).toBeInTheDocument()
    expect(screen.queryByTestId('client-processing-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('third-party-verification-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('low-verification-feed-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('searcher-followup-feed-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('communication-gap-feed-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('operator-promises-tab')).not.toBeInTheDocument()
    expect(dashboardTab()).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'reports-panel-dashboard')
  })

  it('keeps the panel out of the tab order (it holds focusable content)', () => {
    renderPage()

    expect(screen.getByRole('tabpanel')).not.toHaveAttribute('tabindex')
  })

  it('switching back to the dashboard drops ?tab= but keeps from/to/dept', async () => {
    renderPage(['/reports?tab=processing&from=2026-01-01&to=2026-01-31&dept=collection'])
    expect(screen.getByTestId('client-processing-tab')).toBeInTheDocument()

    await userEvent.click(dashboardTab())

    expect(screen.getByTestId('agent-performance-table')).toBeInTheDocument()
    // Documented contract: the processing filters must survive a round-trip
    // through the dashboard, while the default tab keeps a clean URL.
    expect(search()).not.toContain('tab=')
    expect(search()).toContain('from=2026-01-01')
    expect(search()).toContain('to=2026-01-31')
    expect(search()).toContain('dept=collection')
  })

  it('keeps the filter params when switching to the processing tab as well', async () => {
    renderPage(['/reports?from=2026-01-01&to=2026-01-31&dept=collection'])

    await userEvent.click(processingTab())

    expect(screen.getByTestId('client-processing-tab')).toBeInTheDocument()
    expect(search()).toContain('tab=processing')
    expect(search()).toContain('from=2026-01-01')
    expect(search()).toContain('to=2026-01-31')
    expect(search()).toContain('dept=collection')
  })

  it('renders the verification report panel for ?tab=verification', () => {
    renderPage(['/reports?tab=verification'])

    expect(screen.getByTestId('third-party-verification-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('client-processing-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('agent-performance-table')).not.toBeInTheDocument()
    expect(verificationTab()).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'reports-panel-verification')
  })

  it('keeps the verification filters when switching tabs', async () => {
    renderPage(['/reports?tab=verification&sf=2026-01-01&st=2026-01-31&cf=2026-01-10'])
    expect(screen.getByTestId('third-party-verification-tab')).toBeInTheDocument()

    await userEvent.click(dashboardTab())

    // Same documented contract as the processing tab: the filters survive a
    // round-trip through the dashboard, and the two key sets don't collide.
    expect(screen.getByTestId('agent-performance-table')).toBeInTheDocument()
    expect(search()).not.toContain('tab=')
    expect(search()).toContain('sf=2026-01-01')
    expect(search()).toContain('st=2026-01-31')
    expect(search()).toContain('cf=2026-01-10')
  })

  it('renders the low-verification feed panel for ?tab=low-verification', () => {
    renderPage(['/reports?tab=low-verification'])

    expect(screen.getByTestId('low-verification-feed-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('third-party-verification-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('agent-performance-table')).not.toBeInTheDocument()
    expect(lowVerificationTab()).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'reports-panel-low-verification')
  })

  it('keeps the low-verification filters when switching tabs', async () => {
    renderPage(['/reports?tab=low-verification&pf=2026-06-01&pt=2026-06-30&mv=0&pg=3'])
    expect(screen.getByTestId('low-verification-feed-tab')).toBeInTheDocument()

    await userEvent.click(dashboardTab())

    // Same documented contract as the other report tabs: the filters survive a
    // round-trip through the dashboard, and no key set collides with another
    // tab's (`pf/pt/mv/pg` vs `sf/st/cf/ct` vs `from/to/dept`).
    expect(screen.getByTestId('agent-performance-table')).toBeInTheDocument()
    expect(search()).not.toContain('tab=')
    expect(search()).toContain('pf=2026-06-01')
    expect(search()).toContain('pt=2026-06-30')
    expect(search()).toContain('mv=0')
    expect(search()).toContain('pg=3')
  })

  it('renders the searcher follow-up feed panel for ?tab=searcher-followup', () => {
    renderPage(['/reports?tab=searcher-followup'])

    expect(screen.getByTestId('searcher-followup-feed-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('low-verification-feed-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('agent-performance-table')).not.toBeInTheDocument()
    expect(searcherFollowupTab()).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'reports-panel-searcher-followup')
  })

  it('keeps the searcher follow-up filters when switching tabs', async () => {
    renderPage(['/reports?tab=searcher-followup&if=2026-08-01&it=2026-08-07&spg=2&sps=100'])
    expect(screen.getByTestId('searcher-followup-feed-tab')).toBeInTheDocument()

    await userEvent.click(dashboardTab())

    // Same documented contract as the other report tabs: the filters survive a
    // round-trip through the dashboard, and no key set collides with another
    // tab's (`if/it/spg/sps` vs `pf/pt/mv/pg/ps` vs `sf/st/cf/ct` vs
    // `from/to/dept`).
    expect(screen.getByTestId('agent-performance-table')).toBeInTheDocument()
    expect(search()).not.toContain('tab=')
    expect(search()).toContain('if=2026-08-01')
    expect(search()).toContain('it=2026-08-07')
    expect(search()).toContain('spg=2')
    expect(search()).toContain('sps=100')
  })

  it('renders the communication-gap feed panel for ?tab=communication-gap', () => {
    renderPage(['/reports?tab=communication-gap'])

    expect(screen.getByTestId('communication-gap-feed-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('searcher-followup-feed-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('agent-performance-table')).not.toBeInTheDocument()
    expect(communicationGapTab()).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'reports-panel-communication-gap')
  })

  it('keeps the communication-gap filters when switching tabs', async () => {
    renderPage(['/reports?tab=communication-gap&gf=2026-07-01&gt=2026-07-31&gm=10&gpg=2&gps=100'])
    expect(screen.getByTestId('communication-gap-feed-tab')).toBeInTheDocument()

    await userEvent.click(dashboardTab())

    // Same documented contract as the other report tabs: the filters survive a
    // round-trip through the dashboard, and no key set collides with another
    // tab's (`gf/gt/gm/gpg/gps` vs `if/it/spg/sps` vs `pf/pt/mv/pg/ps` vs
    // `sf/st/cf/ct` vs `from/to/dept`).
    expect(screen.getByTestId('agent-performance-table')).toBeInTheDocument()
    expect(search()).not.toContain('tab=')
    expect(search()).toContain('gf=2026-07-01')
    expect(search()).toContain('gt=2026-07-31')
    expect(search()).toContain('gm=10')
    expect(search()).toContain('gpg=2')
    expect(search()).toContain('gps=100')
  })

  it('renders the operator-promises report panel for ?tab=operator-promises', () => {
    renderPage(['/reports?tab=operator-promises'])

    expect(screen.getByTestId('operator-promises-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('communication-gap-feed-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('agent-performance-table')).not.toBeInTheDocument()
    expect(operatorPromisesTab()).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'reports-panel-operator-promises')
  })

  it('keeps the operator-promises filters when switching tabs', async () => {
    renderPage(['/reports?tab=operator-promises&opf=2026-07-01&opt=2026-07-31&opd=collection'])
    expect(screen.getByTestId('operator-promises-tab')).toBeInTheDocument()

    await userEvent.click(dashboardTab())

    // Same documented contract as the other report tabs: the filters survive a
    // round-trip through the dashboard, and no key set collides with another
    // tab's (`opf/opt/opd` vs `gf/gt/gm/gpg/gps` vs `if/it/spg/sps` vs
    // `pf/pt/mv/pg/ps` vs `sf/st/cf/ct` vs `from/to/dept`).
    expect(screen.getByTestId('agent-performance-table')).toBeInTheDocument()
    expect(search()).not.toContain('tab=')
    expect(search()).toContain('opf=2026-07-01')
    expect(search()).toContain('opt=2026-07-31')
    expect(search()).toContain('opd=collection')
  })

  it('offers all seven report tabs in a fixed order', () => {
    // The strip is the only place the tab set is visible at a glance; a new
    // report must be ADDED here rather than replace a sibling.
    renderPage()

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'pages.reports.tabs.dashboard',
      'pages.reports.tabs.processing',
      'pages.reports.tabs.verification',
      'pages.reports.tabs.low-verification',
      'pages.reports.tabs.searcher-followup',
      'pages.reports.tabs.communication-gap',
      'pages.reports.tabs.operator-promises',
    ])
  })

  it('pushes a history entry so Back returns to the previous tab', async () => {
    renderPage(['/reports'])
    expect(screen.getByTestId('agent-performance-table')).toBeInTheDocument()

    await userEvent.click(processingTab())
    expect(screen.getByTestId('client-processing-tab')).toBeInTheDocument()
    expect(search()).toContain('tab=processing')

    // Browser Back. With `replace` there would be no entry to pop and the page
    // would stay on the processing tab — this is what pins the push.
    await userEvent.click(screen.getByTestId('history-back'))

    expect(screen.getByTestId('agent-performance-table')).toBeInTheDocument()
    expect(screen.queryByTestId('client-processing-tab')).not.toBeInTheDocument()
    expect(search()).not.toContain('tab=processing')
  })
})
