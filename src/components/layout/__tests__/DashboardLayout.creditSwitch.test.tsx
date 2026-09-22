import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/**
 * Рубильник раздела кредита в меню CRM.
 *
 * Модуль хранит и отдаёт положение рубильника, но сам по нему ничего не
 * запрещает: раздел — витрина оператора, а оператор обслуживает уже выданные
 * кредиты, и закрывать ему API нельзя. Значит прятать раздел обязана та
 * сторона, которой он принадлежит, — CRM. Здесь проверяется, что она это
 * действительно делает, и — не менее важно — что она НЕ делает этого от
 * недоступности модуля: пропавший пункт меню читается как поломка CRM, а не
 * как решение риск-менеджера.
 */
const mockLocation = { pathname: '/dashboard', search: '', hash: '', state: null }

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => mockLocation,
}))
// Меню фильтруется по правам из СТОРА, а не из useAuth: строка 743 читает
// useAuthStore. Мок useAuth без этого дал бы пустое меню и зелёный тест на
// сломанной фильтрации.
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: { id: '7', permissions: ['manage_settings'] } }),
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
// Меню отдаётся в Sidebar пропом — подменяем его на список путей, чтобы
// проверять именно фильтрацию, а не вёрстку боковой панели.
vi.mock('../Sidebar', () => ({
  Sidebar: ({ items }: { items: Array<{ path: string }> }) => (
    <nav data-testid="rail">{items.map((item) => item.path).join(' ')}</nav>
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

// Единственный мок, ради которого весь файл: положение рубильника.
const switchesResult = vi.fn()
vi.mock('@/features/credit/hooks/useCredit', () => ({
  useCreditSwitches: () => switchesResult(),
  useCreditSectionEnabled: (canSee: boolean) => {
    const { data } = switchesResult()
    return canSee ? data?.switches?.crm_section !== false : true
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

describe('DashboardLayout — рубильник раздела кредита', () => {
  it('раздел в меню есть, пока рубильник включён', () => {
    switchesResult.mockReturnValue({
      data: { switches: { applications_intake: true, client_cabinet: true, crm_section: true } },
    })
    renderLayout()
    expect(screen.getByTestId('rail').textContent).toContain('/dashboard/credit')
  })

  it('рубильник выключен — пункта нет даже у того, у кого есть права', () => {
    switchesResult.mockReturnValue({
      data: { switches: { applications_intake: true, client_cabinet: true, crm_section: false } },
    })
    renderLayout()
    expect(screen.getByTestId('rail').textContent).not.toContain('/dashboard/credit')
  })

  it('модуль недоступен — раздел ОСТАЁТСЯ: это поломка связи, а не решение риск-менеджера', () => {
    // Скрывать раздел от сетевой ошибки нельзя: оператор прочитает пропажу как
    // поломку CRM и пойдёт заводить задачу, вместо того чтобы дождаться модуля.
    switchesResult.mockReturnValue({ data: undefined })
    renderLayout()
    expect(screen.getByTestId('rail').textContent).toContain('/dashboard/credit')
  })
})
