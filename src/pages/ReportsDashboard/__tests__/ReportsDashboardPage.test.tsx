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

// …and for the inbound follow-up feed (features/inboundFollowup).
vi.mock('@/features/inboundFollowup', () => ({
  InboundFollowupFeedTab: () => <div data-testid="inbound-followup-feed-tab" />,
}))

// …and for the contact-tag feed (features/contactTag).
vi.mock('@/features/contactTag', () => ({
  ContactTagFeedTab: () => <div data-testid="contact-tag-feed-tab" />,
}))

// …and for the communication-gap feed (features/communicationGap).
vi.mock('@/features/communicationGap', () => ({
  CommunicationGapFeedTab: () => <div data-testid="communication-gap-feed-tab" />,
}))

// …and for the operator-promises report (features/operatorPromises).
vi.mock('@/features/operatorPromises', () => ({
  OperatorPromisesTab: () => <div data-testid="operator-promises-tab" />,
}))

// …and for the outbound-calls report (features/outboundCalls).
vi.mock('@/features/outboundCalls', () => ({
  OutboundCallsTab: () => <div data-testid="outbound-calls-tab" />,
}))

// …and for the daily promises report (features/promisesDaily).
vi.mock('@/features/promisesDaily', () => ({
  PromisesDailyTab: () => <div data-testid="promises-daily-tab" />,
}))

// …and for the promises feed (features/promisesFeed).
vi.mock('@/features/promisesFeed', () => ({
  PromisesFeedTab: () => <div data-testid="promises-feed-tab" />,
}))

// …and for the callbacks feed (features/callbacksFeed).
vi.mock('@/features/callbacksFeed', () => ({
  CallbacksFeedTab: () => <div data-testid="callbacks-feed-tab" />,
}))

// …and for the drains feed (features/drainsFeed).
vi.mock('@/features/drainsFeed', () => ({
  DrainsFeedTab: () => <div data-testid="drains-feed-tab" />,
}))

// …and for the recorded payments feed (features/recordedPayments).
vi.mock('@/features/recordedPayments', () => ({
  RecordedPaymentsTab: () => <div data-testid="recorded-payments-tab" />,
}))

// …and for the two workday reports (features/workday).
vi.mock('@/features/workday', () => ({
  WorkdayTab: () => <div data-testid="workday-tab" />,
  WorkmonthTab: () => <div data-testid="workmonth-tab" />,
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
const inboundFollowupTab = () =>
  screen.getByRole('tab', { name: 'pages.reports.tabs.inbound-followup' })
const contactTagTab = () => screen.getByRole('tab', { name: 'pages.reports.tabs.contact-tag' })
const communicationGapTab = () =>
  screen.getByRole('tab', { name: 'pages.reports.tabs.communication-gap' })
const operatorPromisesTab = () =>
  screen.getByRole('tab', { name: 'pages.reports.tabs.operator-promises' })
const outboundCallsTab = () =>
  screen.getByRole('tab', { name: 'pages.reports.tabs.outbound-calls' })
const promisesDailyTab = () =>
  screen.getByRole('tab', { name: 'pages.reports.tabs.promises-daily' })
const promisesFeedTab = () => screen.getByRole('tab', { name: 'pages.reports.tabs.promises-feed' })
const callbacksFeedTab = () => screen.getByRole('tab', { name: 'pages.reports.tabs.callbacks' })
const drainsFeedTab = () => screen.getByRole('tab', { name: 'pages.reports.tabs.drains' })
const recordedPaymentsTab = () =>
  screen.getByRole('tab', { name: 'pages.reports.tabs.recorded-payments' })
const workdayTab = () => screen.getByRole('tab', { name: 'pages.reports.tabs.workday' })
const workmonthTab = () => screen.getByRole('tab', { name: 'pages.reports.tabs.workmonth' })

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
    expect(screen.queryByTestId('inbound-followup-feed-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('contact-tag-feed-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('communication-gap-feed-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('operator-promises-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('outbound-calls-tab')).not.toBeInTheDocument()
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

  it('renders the inbound follow-up feed panel for ?tab=inbound-followup', () => {
    renderPage(['/reports?tab=inbound-followup'])

    expect(screen.getByTestId('inbound-followup-feed-tab')).toBeInTheDocument()
    // Its semantic twin sits right next to it in the strip — the two must not
    // be confusable at the routing level.
    expect(screen.queryByTestId('searcher-followup-feed-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('agent-performance-table')).not.toBeInTheDocument()
    expect(inboundFollowupTab()).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'reports-panel-inbound-followup')
  })

  it('keeps the inbound follow-up filters when switching tabs', async () => {
    renderPage(['/reports?tab=inbound-followup&nf=2026-08-01&nt=2026-08-07&npg=2&nps=100'])
    expect(screen.getByTestId('inbound-followup-feed-tab')).toBeInTheDocument()

    await userEvent.click(dashboardTab())

    // Same documented contract as the other report tabs: the filters survive a
    // round-trip through the dashboard, and no key set collides with another
    // tab's (`nf/nt/npg/nps` vs the searcher's `if/it/spg/sps` vs
    // `pf/pt/mv/pg/ps` vs `sf/st/cf/ct` vs `from/to/dept`).
    expect(screen.getByTestId('agent-performance-table')).toBeInTheDocument()
    expect(search()).not.toContain('tab=')
    expect(search()).toContain('nf=2026-08-01')
    expect(search()).toContain('nt=2026-08-07')
    expect(search()).toContain('npg=2')
    expect(search()).toContain('nps=100')
  })

  it('keeps the two follow-up feeds’ windows apart in one URL', () => {
    // Both tabs park a date pair and a page window in the SAME query string,
    // and their shapes are identical — the registry is what keeps them from
    // transplanting into each other. Opening one with both sets present must
    // mount only that one; the sibling's keys are inert here.
    renderPage([
      '/reports?tab=inbound-followup&if=2026-01-01&it=2026-01-31&spg=3&nf=2026-08-01&nt=2026-08-07',
    ])

    expect(screen.getByTestId('inbound-followup-feed-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('searcher-followup-feed-tab')).not.toBeInTheDocument()
    expect(search()).toContain('if=2026-01-01')
    expect(search()).toContain('nf=2026-08-01')
  })

  it('renders the contact-tag feed panel for ?tab=contact-tag', () => {
    renderPage(['/reports?tab=contact-tag'])

    expect(screen.getByTestId('contact-tag-feed-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('inbound-followup-feed-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('agent-performance-table')).not.toBeInTheDocument()
    expect(contactTagTab()).toHaveAttribute('aria-selected', 'true')
    // The panel is labelled by the active tab, so the pairing must follow it
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'reports-panel-contact-tag')
  })

  it('keeps the contact-tag filters when switching tabs', async () => {
    renderPage([
      '/reports?tab=contact-tag&kd=2026-08-26&kf=2026-01-01&kt=2026-06-30&kg=kontakt&kpg=2&kps=100',
    ])
    expect(screen.getByTestId('contact-tag-feed-tab')).toBeInTheDocument()

    await userEvent.click(dashboardTab())

    // Same documented contract as the other report tabs: the filters survive a
    // round-trip through the dashboard, and no key set collides with another
    // tab's (`kd/kf/kt/kg/kpg/kps` vs `nf/nt/npg/nps` vs `if/it/spg/sps` vs
    // `pf/pt/mv/pg/ps` vs `sf/st/cf/ct` vs `from/to/dept`).
    expect(screen.getByTestId('agent-performance-table')).toBeInTheDocument()
    expect(search()).not.toContain('tab=')
    expect(search()).toContain('kd=2026-08-26')
    expect(search()).toContain('kf=2026-01-01')
    expect(search()).toContain('kt=2026-06-30')
    expect(search()).toContain('kg=kontakt')
    expect(search()).toContain('kpg=2')
    expect(search()).toContain('kps=100')
  })

  it('carries the contact-tag feed’s switched-off sale bound (?kt=) through a tab round-trip', async () => {
    // `?kt=` present-but-empty is a REAL state of that tab (the upper bound is
    // off, as opposed to absent, where the backend defaults it). A host that
    // dropped empty values while rebuilding the query string would silently
    // restore a four-month window on the way back.
    renderPage(['/reports?tab=contact-tag&kt='])
    expect(screen.getByTestId('contact-tag-feed-tab')).toBeInTheDocument()

    await userEvent.click(dashboardTab())
    await userEvent.click(contactTagTab())

    expect(screen.getByTestId('contact-tag-feed-tab')).toBeInTheDocument()
    expect(new URLSearchParams(search()).get('kt')).toBe('')
  })

  it('keeps the contact-tag and verification date keys apart in one URL', () => {
    // `ct` is the verification tab's "count to" and is exactly the
    // abbreviation a «Контакт» feed would have taken — the registry is what
    // keeps them from transplanting into each other.
    renderPage(['/reports?tab=contact-tag&cf=2026-01-01&ct=2026-01-31&kt=2026-06-30'])

    expect(screen.getByTestId('contact-tag-feed-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('third-party-verification-tab')).not.toBeInTheDocument()
    expect(search()).toContain('ct=2026-01-31')
    expect(search()).toContain('kt=2026-06-30')
  })

  it('renders the communication-gap feed panel for ?tab=communication-gap', () => {
    renderPage(['/reports?tab=communication-gap'])

    expect(screen.getByTestId('communication-gap-feed-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('inbound-followup-feed-tab')).not.toBeInTheDocument()
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

  it('renders the outbound-calls report panel for ?tab=outbound-calls', () => {
    renderPage(['/reports?tab=outbound-calls'])

    expect(screen.getByTestId('outbound-calls-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('operator-promises-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('agent-performance-table')).not.toBeInTheDocument()
    expect(outboundCallsTab()).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'reports-panel-outbound-calls')
  })

  it('keeps the outbound-calls filters when switching tabs', async () => {
    renderPage(['/reports?tab=outbound-calls&ocf=2026-08-01&oct=2026-08-27'])
    expect(screen.getByTestId('outbound-calls-tab')).toBeInTheDocument()

    await userEvent.click(dashboardTab())

    // Same documented contract as the other report tabs: the filters survive a
    // round-trip through the dashboard, and no key set collides with another
    // tab's (`ocf/oct` vs the operator-promises `opf/opt/opd` — the closest
    // spelling in the registry).
    expect(screen.getByTestId('agent-performance-table')).toBeInTheDocument()
    expect(search()).not.toContain('tab=')
    expect(search()).toContain('ocf=2026-08-01')
    expect(search()).toContain('oct=2026-08-27')
  })

  it('renders the daily promises report panel for ?tab=promises-daily', () => {
    renderPage(['/reports?tab=promises-daily'])

    expect(screen.getByTestId('promises-daily-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('outbound-calls-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('agent-performance-table')).not.toBeInTheDocument()
    expect(promisesDailyTab()).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'reports-panel-promises-daily')
  })

  it('keeps the daily promises filters when switching tabs', async () => {
    renderPage(['/reports?tab=promises-daily&pdf=2026-08-01&pdt=2026-08-31&pdp=1'])
    expect(screen.getByTestId('promises-daily-tab')).toBeInTheDocument()

    await userEvent.click(dashboardTab())

    // Same documented contract as the other report tabs: the filters survive a
    // round-trip through the dashboard, and no key set collides with another
    // tab's (`pdf/pdt/pdp` vs the low-verification `pf/pt/pg/ps` — the closest
    // spelling in the registry).
    expect(screen.getByTestId('agent-performance-table')).toBeInTheDocument()
    expect(search()).not.toContain('tab=')
    expect(search()).toContain('pdf=2026-08-01')
    expect(search()).toContain('pdt=2026-08-31')
    expect(search()).toContain('pdp=1')
  })

  it('renders the promises feed panel for ?tab=promises-feed', () => {
    renderPage(['/reports?tab=promises-feed'])

    expect(screen.getByTestId('promises-feed-tab')).toBeInTheDocument()
    // Its neighbour migrates the same promise universe (Cards 103/119) — the
    // two must not be confusable at the routing level.
    expect(screen.queryByTestId('promises-daily-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('agent-performance-table')).not.toBeInTheDocument()
    expect(promisesFeedTab()).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'reports-panel-promises-feed')
  })

  it('keeps the promises feed filters when switching tabs', async () => {
    renderPage([
      '/reports?tab=promises-feed&prf=2026-09-01&prt=2026-09-07&prw=1&prp=1&prpg=2&prps=100',
    ])
    expect(screen.getByTestId('promises-feed-tab')).toBeInTheDocument()

    await userEvent.click(dashboardTab())

    // Same documented contract as the other report tabs: the filters survive a
    // round-trip through the dashboard, and no key set collides with another
    // tab's (`prf/prt/prw/prp/prpg/prps` vs the daily promises `pdf/pdt/pdp`
    // and the low-verification `pf/pt/pg/ps` — the closest spellings in the
    // registry).
    expect(screen.getByTestId('agent-performance-table')).toBeInTheDocument()
    expect(search()).not.toContain('tab=')
    expect(search()).toContain('prf=2026-09-01')
    expect(search()).toContain('prt=2026-09-07')
    expect(search()).toContain('prw=1')
    expect(search()).toContain('prp=1')
    expect(search()).toContain('prpg=2')
    expect(search()).toContain('prps=100')
  })

  it('keeps the two promises tabs’ params apart in one URL', () => {
    // `pdf/pdt/pdp` and `prf/prt/prp` are one letter apart, and both tabs are
    // about promises — the registry is what keeps them from transplanting
    // into each other. Opening one with both sets present must mount only
    // that one; the sibling's keys are inert here.
    renderPage([
      '/reports?tab=promises-feed&pdf=2026-08-01&pdt=2026-08-31&pdp=1&prf=2026-09-01&prt=2026-09-07',
    ])

    expect(screen.getByTestId('promises-feed-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('promises-daily-tab')).not.toBeInTheDocument()
    expect(search()).toContain('pdf=2026-08-01')
    expect(search()).toContain('prf=2026-09-01')
  })

  it('renders the callbacks feed panel for ?tab=callbacks', () => {
    renderPage(['/reports?tab=callbacks'])

    expect(screen.getByTestId('callbacks-feed-tab')).toBeInTheDocument()
    // Its neighbour is the promises feed it shares a frame with — the two
    // must not be confusable at the routing level.
    expect(screen.queryByTestId('promises-feed-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('agent-performance-table')).not.toBeInTheDocument()
    expect(callbacksFeedTab()).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'reports-panel-callbacks')
  })

  it('keeps the callbacks feed filters when switching tabs', async () => {
    renderPage(['/reports?tab=callbacks&cbf=2026-09-01&cbt=2026-09-07&cbc=1&cbw=1&cbpg=2&cbps=100'])
    expect(screen.getByTestId('callbacks-feed-tab')).toBeInTheDocument()

    await userEvent.click(dashboardTab())

    // Same documented contract as the other report tabs: the filters survive a
    // round-trip through the dashboard, and no key set collides with another
    // tab's (`cbf/cbt/cbc/cbw/cbpg/cbps` vs the verification tab's `cf`/`ct` —
    // the closest spellings in the registry).
    expect(screen.getByTestId('agent-performance-table')).toBeInTheDocument()
    expect(search()).not.toContain('tab=')
    expect(search()).toContain('cbf=2026-09-01')
    expect(search()).toContain('cbt=2026-09-07')
    expect(search()).toContain('cbc=1')
    expect(search()).toContain('cbw=1')
    expect(search()).toContain('cbpg=2')
    expect(search()).toContain('cbps=100')
  })

  it('keeps the callbacks feed apart from the verification tab’s `c…` params in one URL', () => {
    // `cf`/`ct` are the verification tab's "count from/to" and the two keys a
    // CallbacKs feed would reach for first — the registry is what keeps them
    // from transplanting into each other. Opening the feed with both sets
    // present must mount only it; the sibling's keys are inert here.
    renderPage(['/reports?tab=callbacks&cf=2026-01-01&ct=2026-01-31&cbf=2026-09-01&cbt=2026-09-07'])

    expect(screen.getByTestId('callbacks-feed-tab')).toBeInTheDocument()
    expect(search()).toContain('cf=2026-01-01')
    expect(search()).toContain('ct=2026-01-31')
    expect(search()).toContain('cbf=2026-09-01')
  })

  it('renders the drains feed panel for ?tab=drains', () => {
    renderPage(['/reports?tab=drains'])

    expect(screen.getByTestId('drains-feed-tab')).toBeInTheDocument()
    // Its two neighbours in the factoring family share its column frame — the
    // three must not be confusable at the routing level.
    expect(screen.queryByTestId('callbacks-feed-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('promises-feed-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('agent-performance-table')).not.toBeInTheDocument()
    expect(drainsFeedTab()).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'reports-panel-drains')
  })

  it('keeps the drains feed filters — the all-history flag included — when switching tabs', async () => {
    renderPage(['/reports?tab=drains&dra=1&drwt=1&drw=1&drp=1&drpg=2&drps=100'])
    expect(screen.getByTestId('drains-feed-tab')).toBeInTheDocument()

    await userEvent.click(dashboardTab())

    // Same documented contract as the other report tabs. `dra` matters most
    // here: it is the only key on the page that selects a MODE rather than a
    // filter value, so losing it on a tab round-trip would silently swap an
    // 11k-row report for a one-day window.
    expect(screen.getByTestId('agent-performance-table')).toBeInTheDocument()
    expect(search()).not.toContain('tab=')
    expect(search()).toContain('dra=1')
    expect(search()).toContain('drwt=1')
    expect(search()).toContain('drw=1')
    expect(search()).toContain('drp=1')
    expect(search()).toContain('drpg=2')
    expect(search()).toContain('drps=100')
  })

  it('keeps the drains feed apart from the processing tab’s `d…` param in one URL', () => {
    // `dept` is the processing tab's department filter and the `d…` spelling a
    // DRains feed would collide with first. Opening the feed with both sets
    // present must mount only it; the sibling's key is inert here.
    renderPage(['/reports?tab=drains&dept=5&drf=2026-09-11&drt=2026-09-13'])

    expect(screen.getByTestId('drains-feed-tab')).toBeInTheDocument()
    expect(search()).toContain('dept=5')
    expect(search()).toContain('drf=2026-09-11')
    expect(search()).toContain('drt=2026-09-13')
  })

  it('renders the recorded payments panel for ?tab=recorded-payments', () => {
    renderPage(['/reports?tab=recorded-payments'])

    expect(screen.getByTestId('recorded-payments-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('drains-feed-tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('agent-performance-table')).not.toBeInTheDocument()
    expect(recordedPaymentsTab()).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'reports-panel-recorded-payments')
  })

  it('keeps the recorded payments filters when switching tabs', async () => {
    renderPage([
      '/reports?tab=recorded-payments&rpf=2026-09-01&rpt=2026-09-29&rpu=101,102&rpv=1&rppg=2',
    ])
    expect(screen.getByTestId('recorded-payments-tab')).toBeInTheDocument()

    await userEvent.click(dashboardTab())
    expect(screen.getByTestId('agent-performance-table')).toBeInTheDocument()

    // Same documented contract as the other report tabs: the filters survive
    // a round-trip through the dashboard.
    await userEvent.click(recordedPaymentsTab())
    expect(screen.getByTestId('recorded-payments-tab')).toBeInTheDocument()
    expect(screen.getByTestId('location-search').textContent).toContain('rpf=2026-09-01')
    expect(screen.getByTestId('location-search').textContent).toContain('rpt=2026-09-29')
    expect(screen.getByTestId('location-search').textContent).toMatch(/rpu=101(,|%2C)102/)
    expect(screen.getByTestId('location-search').textContent).toContain('rpv=1')
    expect(screen.getByTestId('location-search').textContent).toContain('rppg=2')
  })

  it.each([
    ['workday', 'workday-tab', '/reports?tab=workday'],
    ['workmonth', 'workmonth-tab', '/reports?tab=workmonth'],
  ])('renders the %s panel for its ?tab=', (tab, testId, entry) => {
    renderPage([entry])

    expect(screen.getByTestId(testId)).toBeInTheDocument()
    expect(screen.queryByTestId('agent-performance-table')).not.toBeInTheDocument()
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', `reports-panel-${tab}`)
  })

  it('keeps the workday and workmonth filters when switching tabs', async () => {
    renderPage(['/reports?tab=workday&wd=2026-09-17&wdc=cumulative&wm=2026-09'])
    expect(screen.getByTestId('workday-tab')).toBeInTheDocument()

    await userEvent.click(workmonthTab())
    expect(screen.getByTestId('workmonth-tab')).toBeInTheDocument()
    await userEvent.click(workdayTab())
    expect(screen.getByTestId('workday-tab')).toBeInTheDocument()

    expect(search()).toContain('wd=2026-09-17')
    expect(search()).toContain('wdc=cumulative')
    expect(search()).toContain('wm=2026-09')
  })

  it('offers all seventeen report tabs in a fixed order', () => {
    // The strip is the only place the tab set is visible at a glance; a new
    // report must be ADDED here rather than replace a sibling.
    renderPage()

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'pages.reports.tabs.dashboard',
      'pages.reports.tabs.processing',
      'pages.reports.tabs.verification',
      'pages.reports.tabs.low-verification',
      'pages.reports.tabs.searcher-followup',
      // The two follow-up feeds are neighbours on purpose — same source column
      // shape, same operator workflow.
      'pages.reports.tabs.inbound-followup',
      // …and the tagged-client work list follows them, before the gap feed
      // whose client/employee/debt column shape it shares.
      'pages.reports.tabs.contact-tag',
      'pages.reports.tabs.communication-gap',
      'pages.reports.tabs.operator-promises',
      'pages.reports.tabs.outbound-calls',
      'pages.reports.tabs.promises-daily',
      // …and the promises feed right after the daily matrix it details.
      'pages.reports.tabs.promises-feed',
      // …and the call plan next to the promises feed it shares a frame
      // with: same operators, but «whom do I RING, and at what time».
      'pages.reports.tabs.callbacks',
      // …and the drains feed, closing the promise side of the factoring
      // family: the only one of the three whose row is a CLIENT rather than
      // an interaction.
      'pages.reports.tabs.drains',
      // …and the recorded payments feed last — the money that ARRIVED, the
      // family's answer after its three questions.
      'pages.reports.tabs.recorded-payments',
      // …and the two operator-discipline reports (Cards 73 + 74) after the
      // promise/payment family: the day, then its monthly roll-up.
      'pages.reports.tabs.workday',
      'pages.reports.tabs.workmonth',
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
