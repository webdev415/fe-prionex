/**
 * Настройки кредитного модуля.
 *
 * Что защищаем:
 *  - продукты и параметры видит только риск-менеджер, остальным объясняем
 *    причину вместо пустого экрана;
 *  - кнопки правки продукта показаны, но выключены — иначе риск-менеджер
 *    решит, что правка возможна, и упрётся в 501;
 *  - страница интеграций не рисует зелёных галочек там, где подключения нет.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CreditSettingsPage } from '../CreditSettingsPage'
import {
  useCreditOverview,
  useCreditParameters,
  useCreditProducts,
} from '@/features/credit/hooks/useCredit'
import type { CreditOverview, CreditParameter, CreditProduct } from '@/features/credit/api/types'

// Мокаем хуки, а не HTTP: живой QueryClient оставлял таймеры notifyManager,
// которые падали уже после teardown jsdom в чужом тест-файле.
vi.mock('@/features/credit/hooks/useCredit', () => ({
  useCreditOverview: vi.fn(),
  useCreditProducts: vi.fn(),
  useCreditParameters: vi.fn(),
  // Страница читает положение рубильника, чтобы объяснить выключенный раздел:
  // сама она калиткой НЕ закрыта — иначе выключивший себя риск-менеджер не
  // смог бы включить раздел обратно.
  useCreditSectionEnabled: () => true,
  useCreditSwitches: () => ({ data: undefined, isLoading: false, error: null }),
  useSetCreditSwitch: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}))

const PRODUCT: CreditProduct = {
  code: 'CA_AB_PAYDAY',
  name: 'Payday loan (Alberta)',
  project: 'fin-boost',
  jurisdiction: 'CA-AB',
  currency: 'CAD',
  availability: 'available',
  versions: [
    {
      version: '2026-08-01.1',
      state: 'active',
      pricing_version: 'AB-cost-2025-01-01',
      valid_from: null,
      payload: { amount_min_minor: 10000, amount_max_minor: 150000, fee_per_100: '14' },
    },
  ],
}

const PARAMETER: CreditParameter = {
  code: 'credit.decision.ca_ab',
  value: { max_active_loans: 1, decline_cooldown_days: 30 },
  description: 'Гейты допуска CA-AB',
  updated_at: '2026-08-29T01:19:00Z',
}

function overviewWith(permissions: string[]): CreditOverview {
  return {
    role: permissions.includes('credit.parameters.read') ? 'risk_manager' : 'underwriter',
    permissions,
    roles_available: ['verifier', 'underwriter', 'risk_manager'],
    applications: {},
    loans: {},
    application_statuses: [],
    demo_mode: true,
  }
}

function mockOverview(permissions: string[]): void {
  vi.mocked(useCreditOverview).mockReturnValue({
    data: overviewWith(permissions),
  } as ReturnType<typeof useCreditOverview>)
}

function renderPage(entry = '/dashboard/credit/settings') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <CreditSettingsPage />
    </MemoryRouter>
  )
}

describe('CreditSettingsPage', () => {
  beforeEach(() => {
    // Счётчики вызовов проверяются в тестах — без сброса они копятся между ними.
    vi.clearAllMocks()
    vi.mocked(useCreditProducts).mockReturnValue({
      data: { items: [PRODUCT], next_cursor: null },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCreditProducts>)
    vi.mocked(useCreditParameters).mockReturnValue({
      data: { items: [PARAMETER], next_cursor: null },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCreditParameters>)
  })

  it('риск-менеджеру показывает каталог продуктов', async () => {
    mockOverview(['credit.products.read', 'credit.parameters.read'])
    renderPage()
    expect(await screen.findByText('CA_AB_PAYDAY')).toBeInTheDocument()
  })

  it('кнопки правки продукта выключены до второго утверждающего', async () => {
    mockOverview(['credit.products.read'])
    renderPage()
    await screen.findByText('CA_AB_PAYDAY')
    expect(screen.getByRole('button', { name: 'credit.settings.createProduct' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'credit.settings.activateVersion' })).toBeDisabled()
  })

  it('другой роли объясняет, почему раздел закрыт, вместо пустого экрана', async () => {
    mockOverview(['credit.applications.read'])
    renderPage()
    expect(await screen.findByText('credit.settings.needRiskManager')).toBeInTheDocument()
    // Хук вызывается всегда (правила хуков), но с enabled=false — запроса нет.
    expect(vi.mocked(useCreditProducts)).toHaveBeenCalledWith(false)
  })

  it('параметры открываются вкладкой из URL и помечены как read-only', async () => {
    mockOverview(['credit.parameters.read'])
    renderPage('/dashboard/credit/settings?tab=parameters')
    expect(await screen.findByText('credit.decision.ca_ab')).toBeInTheDocument()
    expect(screen.getByText('credit.settings.parametersReadonly')).toBeInTheDocument()
  })

  it('интеграции показывают честный статус «не подключено», а не зелёную галочку', async () => {
    mockOverview(['credit.applications.read'])
    renderPage('/dashboard/credit/settings?tab=integrations')
    expect(await screen.findByText('credit.settings.integrations.flinks.name')).toBeInTheDocument()
    expect(
      screen.getAllByText('credit.settings.integrationState.not_connected').length
    ).toBeGreaterThanOrEqual(3)
  })
})
