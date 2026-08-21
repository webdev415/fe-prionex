import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/**
 * The dock strips the dashboard chrome inside `DashboardLayout` itself, so the
 * pure predicate (`shouldStripDashboardChrome`, covered in
 * features/onexEmbed) is only half the story: nothing would catch a `!isOnexDock`
 * that stopped being applied to the rail, the header or the call popup. This
 * suite mounts the real layout — with its auth/search/websocket stack mocked
 * out — and asserts on what the operator ends up seeing.
 */

const mockLocation = { pathname: '/dashboard/ai-assistant', search: '', hash: '', state: null }

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => mockLocation,
}))

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: { id: '7', permissions: [], asterisk_extension: '2001' },
    logout: vi.fn(),
    isImpersonating: false,
    impersonatedUser: null,
    exitImpersonation: vi.fn(),
  }),
}))
vi.mock('@/features/auth/components/ImpersonationBanner', () => ({
  ImpersonationBanner: () => null,
}))
vi.mock('@/features/scoring/hooks/useV3Scores', () => ({ useV3UiEnabled: () => false }))
vi.mock('@/hooks', () => ({ usePermissionRefresh: () => undefined }))
vi.mock('@/hooks/usePermissions', () => ({ useHasPermission: () => true }))
vi.mock('@/features/lawyerWorkplace', () => ({
  useLegalInboxSummary: () => ({ data: undefined }),
}))
vi.mock('@/pages/LawyerWorkplace/components/LawyerWorkplaceHeaderNav', () => ({
  LawyerWorkplaceHeaderNav: () => null,
}))
vi.mock('@/features/operatorAnalytics', () => ({
  TrackingProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  RouteChangeTracker: () => null,
}))
vi.mock('@/api/clientSearchApi', () => ({
  searchClients: vi.fn().mockResolvedValue([]),
  mapPriorityLevel: () => 'low',
}))
vi.mock('../Sidebar', () => ({
  Sidebar: () => <nav data-testid="dashboard-rail" />,
}))
vi.mock('../SearchBar', () => ({
  SearchBar: () => <input data-testid="dashboard-search" />,
}))
vi.mock('../UserProfile', () => ({ UserProfile: () => <div data-testid="user-profile" /> }))
vi.mock('../NotificationBell', () => ({ NotificationBell: () => null }))
vi.mock('../ThemeModeToggle', () => ({ ThemeModeToggle: () => null }))
vi.mock('../MinimizedCallBubble', () => ({ MinimizedCallBubble: () => null }))
vi.mock('../MinimizedChainExecutorBubble', () => ({ MinimizedChainExecutorBubble: () => null }))
vi.mock('@/pages/ClientManagement/components/CallDialogModal', () => ({
  CallDialogModal: () => <div data-testid="incoming-call-modal" />,
}))
vi.mock('@/pages/ClientManagement/components/CallRecordingModal', () => ({
  CallRecordingModal: () => null,
}))

const incomingCall = {
  call_id: 'call-1',
  customer_phone: '380971234567',
  client_id: 42,
  client_name: 'Іваненко',
  clients: [],
}
const useIncomingCall = vi.fn(() => ({ incomingCall, dismissIncomingCall: vi.fn() }))
vi.mock('@/features/calls/hooks/useIncomingCall', () => ({
  useIncomingCall: (...args: unknown[]) => useIncomingCall(...(args as [])),
}))
vi.mock('@/features/calls/hooks/useCanShowIncomingPopup', () => ({
  useCanShowIncomingPopup: () => true,
}))

import { DashboardLayout } from '../DashboardLayout'

function renderLayout() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardLayout>
        <div data-testid="page-content" />
      </DashboardLayout>
    </QueryClientProvider>
  )
}

describe('DashboardLayout — OneX dock', () => {
  beforeEach(() => {
    mockLocation.pathname = '/dashboard/ai-assistant'
    mockLocation.search = ''
    delete window.__onexDockSoloSurface
  })

  afterEach(() => {
    delete window.__onexDockSoloSurface
  })

  it('renders the full chrome without the dock query', () => {
    renderLayout()

    expect(screen.getByTestId('dashboard-rail')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-search')).toBeInTheDocument()
    expect(screen.getAllByTestId('user-profile').length).toBeGreaterThan(0)
    expect(screen.getByTestId('incoming-call-modal')).toBeInTheDocument()
    expect(screen.getByTestId('page-content')).toBeInTheDocument()
  })

  it('drops the rail, the header and the call popup in the dock', () => {
    mockLocation.search = '?embed=dock'
    renderLayout()

    expect(screen.queryByTestId('dashboard-rail')).not.toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-search')).not.toBeInTheDocument()
    expect(screen.queryByTestId('user-profile')).not.toBeInTheDocument()
    // The main CRM window in the main pane raises this one.
    expect(screen.queryByTestId('incoming-call-modal')).not.toBeInTheDocument()
    // The page itself is still there — and full-bleed: no rail margin, no
    // header padding to clear.
    const main = screen.getByTestId('page-content').closest('main')!
    expect(main.className).toContain('p-0')
    expect(main.className).not.toContain('pt-[80px]')
    expect(main.parentElement!.className).not.toContain('xl:ml-18')
  })

  it('keeps the call popup when the host runs the dock as its only CRM surface', () => {
    mockLocation.search = '?embed=dock'
    window.__onexDockSoloSurface = true
    renderLayout()

    expect(screen.queryByTestId('dashboard-rail')).not.toBeInTheDocument()
    expect(screen.getByTestId('incoming-call-modal')).toBeInTheDocument()
  })

  it('leaves an unrelated route alone even with the dock query', () => {
    // A copied link must never blank the navigation on another screen.
    mockLocation.pathname = '/dashboard/clients'
    mockLocation.search = '?embed=dock'
    renderLayout()

    expect(screen.getByTestId('dashboard-rail')).toBeInTheDocument()
    expect(screen.getByTestId('incoming-call-modal')).toBeInTheDocument()
  })
})
