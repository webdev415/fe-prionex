import { beforeEach, describe, expect, it, vi } from 'vitest'
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
 *
 * 17-40b r4: рубильник прячет подпункты МОДУЛЯ, но не «Настройки» — там
 * вкладка «Сайт», вход в админку сайта, к кредитному разделу отношения не
 * имеющий. Держатель права на контент сайта или `manage_settings` видит
 * «Кредитный модуль → Настройки» и при выключенном разделе; остальные — как
 * прежде, ничего.
 */
const mockLocation = { pathname: '/dashboard', search: '', hash: '', state: null }

// Права пользователя меню — по сцене: страж r4 различает держателя права на
// сайт и человека с одними кредитными правами.
const auth = vi.hoisted(() => ({ permissions: ['manage_settings'] as string[] }))

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

const SWITCHED_OFF = {
  data: { switches: { applications_intake: true, client_cabinet: true, crm_section: false } },
}

/** Пути меню одним списком: родитель и его подпункты. */
function railPaths(): string[] {
  return (screen.getByTestId('rail').textContent ?? '').split(' ').filter(Boolean)
}

const MODULE_SUB_ITEMS = [
  '/dashboard/credit/applications',
  '/dashboard/credit/underwriting',
  '/dashboard/credit/loans',
]

describe('DashboardLayout — рубильник раздела кредита', () => {
  beforeEach(() => {
    auth.permissions = ['manage_settings']
  })

  it('раздел в меню есть, пока рубильник включён', () => {
    switchesResult.mockReturnValue({
      data: { switches: { applications_intake: true, client_cabinet: true, crm_section: true } },
    })
    renderLayout()
    expect(screen.getByTestId('rail').textContent).toContain('/dashboard/credit')
  })

  it('рубильник выключен — пункта нет даже у того, у кого есть кредитные права', () => {
    auth.permissions = ['credit.applications.read', 'credit.loans.read', 'credit.products.read']
    switchesResult.mockReturnValue(SWITCHED_OFF)
    renderLayout()
    expect(screen.getByTestId('rail').textContent).not.toContain('/dashboard/credit')
  })

  it.each([
    ['права на контент сайта', ['credit.applications.read', 'site.content.edit']],
    ['права на публикацию сайта', ['credit.loans.read', 'site.content.publish']],
    ['manage_settings', ['manage_settings']],
  ])(
    'рубильник выключен — у держателя %s остаются «Настройки» (вкладка «Сайт»), модуль скрыт',
    (_name, permissions) => {
      auth.permissions = permissions
      switchesResult.mockReturnValue(SWITCHED_OFF)
      renderLayout()
      const paths = railPaths()
      expect(paths).toContain('/dashboard/credit')
      expect(paths).toContain('/dashboard/credit/settings')
      for (const path of MODULE_SUB_ITEMS) expect(paths).not.toContain(path)
    }
  )

  it('контроль: рубильник включён — подпункты модуля на месте у того же человека', () => {
    auth.permissions = ['credit.applications.read', 'site.content.edit']
    switchesResult.mockReturnValue({
      data: { switches: { applications_intake: true, client_cabinet: true, crm_section: true } },
    })
    renderLayout()
    const paths = railPaths()
    expect(paths).toContain('/dashboard/credit/applications')
    expect(paths).toContain('/dashboard/credit/settings')
  })

  it('модуль недоступен — раздел ОСТАЁТСЯ: это поломка связи, а не решение риск-менеджера', () => {
    // Скрывать раздел от сетевой ошибки нельзя: оператор прочитает пропажу как
    // поломку CRM и пойдёт заводить задачу, вместо того чтобы дождаться модуля.
    switchesResult.mockReturnValue({ data: undefined })
    renderLayout()
    expect(screen.getByTestId('rail').textContent).toContain('/dashboard/credit')
  })
})
