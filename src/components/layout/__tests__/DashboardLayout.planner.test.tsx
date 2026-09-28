import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/**
 * «Планування» in the CRM menu (planner story 1.9, AC2–AC4).
 *
 * Exactly one entry, right after «Дашборд», and only for a holder of
 * `planner.access` whose `GET /meta` said `available: true`. Anything else —
 * no right, `available: false`, the planner not deployed (no data) — no entry,
 * and the planner is asked only by holders of the right. The opposite of the
 * credit switch on purpose: the planner ships to PROD dark.
 *
 * The mocks below mirror `DashboardLayout.creditSwitch.test.tsx`: the menu is
 * filtered by permissions from the auth STORE and handed to a mocked Sidebar
 * that prints the paths in order.
 */
const mockLocation = { pathname: '/dashboard', search: '', hash: '', state: null }

// Права пользователя меню — по сцене: страж r4 различает держателя права на
// сайт и человека с одними кредитными правами.
const auth = vi.hoisted(() => ({ permissions: ['view_clients'] as string[] }))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => mockLocation,
}))
// Меню фильтруется по правам из СТОРА, а не из useAuth: строка 743 читает
// useAuthStore. Мок useAuth без этого дал бы пустое меню и зелёный тест на
// сломанной фильтрации.
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: { id: '7', permissions: auth.permissions } }),
}))
vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    // Право системных настроек: именно по нему раздел кредита виден
    // администратору, пока ролей credit.* в auth-service ещё нет.
    user: { id: '7', permissions: ['manage_settings'], asterisk_extension: '2001' },
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
vi.mock('@/hooks/usePermissions', () => ({
  useHasPermission: () => true,
  useHasAnyPermission: () => true,
}))
vi.mock('@/features/lawyerWorkplace', () => ({ useLegalInboxSummary: () => ({ data: undefined }) }))
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
// Меню отдаётся в Sidebar пропом — подменяем его на список путей (с
// подпунктами), чтобы проверять именно фильтрацию, а не вёрстку боковой панели.
vi.mock('../Sidebar', () => ({
  Sidebar: ({ items }: { items: Array<{ path: string; subItems?: Array<{ path: string }> }> }) => (
    <nav data-testid="rail">
      {items
        .flatMap((item) => [item.path, ...(item.subItems ?? []).map((sub) => sub.path)])
        .join(' ')}
    </nav>
  ),
}))
vi.mock('../SearchBar', () => ({ SearchBar: () => null }))
vi.mock('../UserProfile', () => ({ UserProfile: () => null }))
vi.mock('../NotificationBell', () => ({ NotificationBell: () => null }))
vi.mock('../ThemeModeToggle', () => ({ ThemeModeToggle: () => null }))
vi.mock('../MinimizedCallBubble', () => ({ MinimizedCallBubble: () => null }))
vi.mock('../MinimizedChainExecutorBubble', () => ({ MinimizedChainExecutorBubble: () => null }))
vi.mock('@/features/calls/components/IncomingCallWindowContainer', () => ({
  IncomingCallWindowContainer: () => null,
}))
vi.mock('@/pages/ClientManagement/components/CallDialogModal', () => ({
  CallDialogModal: () => null,
}))
vi.mock('@/pages/ClientManagement/components/CallRecordingModal', () => ({
  CallRecordingModal: () => null,
}))
vi.mock('@/features/calls/hooks/useIncomingCall', () => ({
  useIncomingCall: () => ({ incomingCall: null, dismissIncomingCall: vi.fn() }),
}))
vi.mock('@/features/calls/hooks/useCanShowIncomingPopup', () => ({
  useCanShowIncomingPopup: () => false,
}))

vi.mock('@/features/credit/hooks/useCredit', () => ({ useCreditSectionEnabled: () => true }))

// The mock this file exists for: the planner's GET /meta, and whether it was asked.
const metaResult = vi.fn()
const metaEnabled = vi.fn()
vi.mock('@/api/planner/plannerQueries', () => ({
  usePlannerMeta: (enabled: boolean) => {
    metaEnabled(enabled)
    return enabled ? metaResult() : { data: undefined }
  },
}))

import { DashboardLayout } from '../DashboardLayout'

function renderLayout() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardLayout>
        <div />
      </DashboardLayout>
    </QueryClientProvider>
  )
}

function railPaths(): string[] {
  return (screen.getByTestId('rail').textContent ?? '').split(' ').filter(Boolean)
}

const AVAILABLE = { data: { mode: 'on', available: true } }

describe('DashboardLayout — «Планування» (planner 1.9)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.permissions = ['view_clients', 'planner.access']
  })

  it('planner.access + available: true — one entry, right after «Дашборд»', () => {
    metaResult.mockReturnValue(AVAILABLE)
    renderLayout()
    const paths = railPaths()
    expect(paths.filter((p) => p.startsWith('/dashboard/planning'))).toEqual([
      '/dashboard/planning',
    ])
    expect(paths.indexOf('/dashboard/planning')).toBe(paths.indexOf('/dashboard') + 1)
  })

  it('without planner.access — no entry, and the planner is not asked', () => {
    auth.permissions = ['view_clients']
    metaResult.mockReturnValue(AVAILABLE)
    renderLayout()
    expect(railPaths()).not.toContain('/dashboard/planning')
    expect(metaEnabled).not.toHaveBeenCalledWith(true)
  })

  it.each([
    [
      'available: false (off, or prep without the person)',
      { data: { mode: 'prep', available: false } },
    ],
    ['no answer / planner not deployed', { data: undefined }],
  ])('%s — no entry, the rest of the menu stays', (_name, result) => {
    metaResult.mockReturnValue(result)
    renderLayout()
    const paths = railPaths()
    expect(paths).not.toContain('/dashboard/planning')
    expect(paths).toContain('/dashboard')
  })
})
