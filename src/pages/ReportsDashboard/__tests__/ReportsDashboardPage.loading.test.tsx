/**
 * The Dashboard tab's first load (Kanbanboard#100): a cold dashboard request
 * takes 10–14 s on production, so the page skeleton carries the shared
 * loading caption — the same card every other report tab shows.
 *
 * Only the data hooks and the page skeleton are stubbed; the caption card is
 * the real shared component. react-i18next is mocked globally — t() returns
 * the key.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ReportsDashboardPage } from '../ReportsDashboardPage'

vi.mock('@/features/report', () => ({
  useDashboard: () => ({ data: undefined, isLoading: true, error: null }),
  useAgentPerformanceTable: () => ({ data: [], isLoading: true, isFetching: false }),
  useExportDashboard: () => ({ mutate: vi.fn(), isPending: false }),
  useCallsMadeModal: () => ({ data: undefined, isLoading: false, error: null }),
  useContactRateModal: () => ({ data: undefined, isLoading: false, error: null }),
  useSMSSentModal: () => ({ data: undefined, isLoading: false, error: null }),
  useMessagesSentModal: () => ({ data: undefined, isLoading: false, error: null }),
}))

vi.mock('../components', () => ({
  KPICard: () => null,
  PeriodTabs: () => null,
  AgentPerformanceTable: () => null,
  PaymentsCollectedModal: () => null,
  ReportsDashboardPageSkeleton: () => <div data-testid="dashboard-skeleton" />,
  CallsMadeDetailModal: () => null,
  ContactRateDetailModal: () => null,
  SMSSentDetailModal: () => null,
  MessagesSentDetailModal: () => null,
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

describe('ReportsDashboardPage — first load of the Dashboard tab', () => {
  it('shows the shared loading caption over the page skeleton', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/reports']}>
        <ReportsDashboardPage />
      </MemoryRouter>
    )
    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('pages.reports.loading.caption')
  })
})
