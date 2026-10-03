/**
 * Настройки кредитного модуля.
 *
 * Что защищаем:
 *  - продукты и параметры видит только риск-менеджер, остальным объясняем
 *    причину вместо пустого экрана;
 *  - кнопки правки продукта показаны, но выключены — иначе риск-менеджер
 *    решит, что правка возможна, и упрётся в 501;
 *  - страница интеграций не рисует зелёных галочек там, где подключения нет;
 *  - вкладка «Сайт» (17-40b) есть только у того, кто меняет владельца сайта
 *    или правит его контент, а контент-менеджеру без кредитных прав она —
 *    единственная (вкладки модуля были бы ему стеной отказов);
 *  - (r4, решение куратора) вкладку решают права JWT АКТИВНОГО проекта: право,
 *    которое есть только в проекте-владельце, вкладку из другого проекта не
 *    открывает, и настройки сайта у такого человека не спрашиваются;
 *  - (18-13d-a1) вкладку «Постбеки партнерам» открывает право чтения постбеков из
 *    пропуска CRM; маркетологу без кредитных прав модуль сводку и рубильник не
 *    спрашивает, а предупреждение о выключенном разделе на вкладке не висит.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CreditSettingsPage } from '../CreditSettingsPage'
import { useAuthStore } from '@/stores/authStore'
import {
  useCreditOverview,
  useCreditParameters,
  useCreditProducts,
  useCreditSectionEnabled,
} from '@/features/credit/hooks/useCredit'
import type { CreditOverview, CreditParameter, CreditProduct } from '@/features/credit/api/types'
import { useSiteAdminSettings } from '@/features/siteAdmin/hooks'
import { useCreditPostbackRules } from '@/features/credit/hooks/useCreditPostbacks'
import type { CreditPostbackRule } from '@/features/credit/api/postbacks'

// Мокаем хуки, а не HTTP: живой QueryClient оставлял таймеры notifyManager,
// которые падали уже после teardown jsdom в чужом тест-файле.
vi.mock('@/features/credit/hooks/useCredit', () => ({
  useCreditOverview: vi.fn(),
  useCreditProducts: vi.fn(),
  useCreditParameters: vi.fn(),
  // Страница читает положение рубильника, чтобы объяснить выключенный раздел:
  // сама она калиткой НЕ закрыта — иначе выключивший себя риск-менеджер не
  // смог бы включить раздел обратно.
  useCreditSectionEnabled: vi.fn(() => true),
  useCreditSwitches: () => ({ data: undefined, isLoading: false, error: null }),
  useSetCreditSwitch: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}))

// Вкладка «Сайт» ходит в auth-service, не в модуль; её хуки — тоже заглушки.
// Сервер отвечает ролью `editor`: у вызывающего право в проекте-владельце 7 —
// так сцена r4 «право только во владельце» строится одной сменой JWT.
vi.mock('@/features/siteAdmin/hooks', () => ({
  siteAdminKeys: { all: ['siteAdmin'], settings: () => ['siteAdmin', 'settings'] },
  useSiteAdminSettings: vi.fn(() => ({
    data: {
      site_owner_project_id: 7,
      site_owner_project_name: 'Owner Project Alpha',
      configured: true,
      site_owner_active: true,
      current_user_site_role: 'editor',
    },
    isLoading: false,
    error: null,
  })),
  useOwnerProjectChoices: () => ({
    data: { projects: [{ id: 7, name: 'Owner Project Alpha' }], truncated: false },
  }),
  useUpdateSiteAdminSettings: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useSiteAdminHandoff: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false }),
}))

// Вкладка постбеков (18-13d) ходит в свои двери модуля; хуки — заглушки, как выше.
vi.mock('@/features/credit/hooks/useCreditPostbacks', () => ({
  useCreditPostbackRules: vi.fn(),
  useToggleCreditPostbackRule: () => ({ run: vi.fn(), isPending: false, error: null }),
  useDeleteCreditPostbackRule: () => ({ run: vi.fn(), isPending: false, error: null }),
}))

const POSTBACK_RULE: CreditPostbackRule = {
  id: 'r-1',
  name: 'Partner one — lead',
  active: true,
  trigger: 'new_lead',
  utm_source: 'partner1',
  url_template: 'https://partner.example/pb?clickid={click_id}',
  goal: '1',
  currency: null,
  created_at: '2026-10-02T10:00:00Z',
  updated_at: '2026-10-02T10:00:00Z',
  created_by: 7,
  updated_by: 7,
}

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

/** Права CRM (JWT активного проекта) — по ним решается вкладка «Сайт». */
function signIn(permissions: string[], activeProjectId = '7'): void {
  useAuthStore.setState({
    user: {
      id: '1',
      username: 'u',
      projects: [],
      active_project_id: activeProjectId,
      permissions,
    } as never,
  })
}

const SITE_TAB = { name: 'credit.settings.tabs.site' }

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
    vi.mocked(useCreditPostbackRules).mockReturnValue({
      data: { items: [POSTBACK_RULE], triggers: [], macros: [] },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCreditPostbackRules>)
    vi.mocked(useCreditSectionEnabled).mockReturnValue(true)
  })

  afterEach(() => {
    useAuthStore.setState({ user: null })
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

  it('без прав на сайт и настройки вкладки «Сайт» нет', async () => {
    mockOverview(['credit.products.read'])
    signIn(['credit.products.read'])
    renderPage()
    await screen.findByText('CA_AB_PAYDAY')
    expect(screen.queryByRole('tab', SITE_TAB)).not.toBeInTheDocument()
  })

  it('право на сайт только в проекте-владельце, активен другой проект — вкладки нет (решение r4)', async () => {
    // Сервер ответил бы ролью `editor` (право в проекте-владельце 7), но
    // вкладку решают права JWT активного проекта 9, а в нём права на сайт и
    // `manage_settings` нет. Гейт по ответу сервера стоил бы GET настроек у
    // каждого пользователя CRM — решение куратора: ограничение, а не запрос.
    mockOverview(['credit.products.read'])
    signIn(['credit.products.read'], '9')
    renderPage('/dashboard/credit/settings?tab=site')
    await screen.findByText('CA_AB_PAYDAY')
    expect(screen.queryByRole('tab', SITE_TAB)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'credit.settings.site.openAdmin' })).toBeNull()
    expect(vi.mocked(useSiteAdminSettings)).not.toHaveBeenCalled()
  })

  it('держатель manage_settings видит «Сайт» рядом с вкладками модуля', async () => {
    mockOverview(['credit.products.read'])
    signIn(['manage_settings'])
    renderPage()
    expect(await screen.findByRole('tab', SITE_TAB)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'credit.settings.tabs.products' })).toBeInTheDocument()
  })

  it('вкладка «Сайт» открывается из URL и показывает владельца сайта', async () => {
    mockOverview(['credit.products.read'])
    signIn(['manage_settings'])
    renderPage('/dashboard/credit/settings?tab=site')
    expect(await screen.findByTestId('site-owner-name')).toHaveTextContent('Owner Project Alpha')
    expect(screen.getByRole('tab', SITE_TAB)).toHaveAttribute('aria-selected', 'true')
  })

  it('контент-менеджеру без кредитных прав — одна вкладка «Сайт», открытая сразу', async () => {
    mockOverview([])
    signIn(['site.content.edit'])
    renderPage()
    const tabs = await screen.findAllByRole('tab')
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toHaveTextContent('credit.settings.tabs.site')
    expect(screen.getByRole('button', { name: 'credit.settings.site.openAdmin' })).toBeEnabled()
    expect(screen.queryByText('credit.settings.needRiskManager')).not.toBeInTheDocument()
  })

  it('контент-менеджера без кредитных прав модуль не спрашивает — лишних 403 нет', async () => {
    mockOverview([])
    signIn(['site.content.edit'])
    renderPage()
    await screen.findAllByRole('tab')
    // Обзор и рубильники модуля такому человеку ничего не покажут, а каждый
    // запрос стал бы 403 credit-service в логах шлюза.
    expect(vi.mocked(useCreditOverview)).toHaveBeenCalledWith({ enabled: false })
    expect(vi.mocked(useCreditOverview)).not.toHaveBeenCalledWith({ enabled: true })
    expect(vi.mocked(useCreditSectionEnabled)).toHaveBeenCalledWith(false)
    expect(vi.mocked(useCreditSectionEnabled)).not.toHaveBeenCalledWith(true)
  })

  it('с кредитными правами модуль спрашивается как прежде', async () => {
    mockOverview(['credit.products.read'])
    signIn(['credit.products.read', 'site.content.edit'])
    renderPage()
    await screen.findByText('CA_AB_PAYDAY')
    expect(vi.mocked(useCreditOverview)).toHaveBeenCalledWith({ enabled: true })
    expect(vi.mocked(useCreditSectionEnabled)).toHaveBeenCalledWith(true)
  })

  describe('вкладка «Постбеки партнерам» (18-13d-a1)', () => {
    const READ = 'credit.partner_postbacks.read'
    const WRITE = 'credit.partner_postbacks.write'
    const tabNames = async () =>
      (await screen.findAllByRole('tab')).map((tab) => tab.textContent ?? '')

    it('маркетологу с одним правом чтения — ровно одна вкладка, модуль не спрашивается', async () => {
      mockOverview([])
      signIn([READ])
      renderPage()
      expect(await tabNames()).toEqual(['credit.settings.tabs.postbacks'])
      expect(await screen.findByText('Partner one — lead')).toBeInTheDocument()
      // Сводка требует `credit.loans.read`: каждый заход маркетолога был бы 403.
      expect(vi.mocked(useCreditOverview)).toHaveBeenCalledWith({ enabled: false })
      expect(vi.mocked(useCreditOverview)).not.toHaveBeenCalledWith({ enabled: true })
      expect(vi.mocked(useCreditSectionEnabled)).toHaveBeenCalledWith(false)
      expect(vi.mocked(useCreditSectionEnabled)).not.toHaveBeenCalledWith(true)
    })

    it('контент-менеджер с правом чтения постбеков — «Сайт» и «Постбеки», без вкладок модуля', async () => {
      mockOverview([])
      signIn(['site.content.edit', READ])
      renderPage()
      expect(await tabNames()).toEqual([
        'credit.settings.tabs.site',
        'credit.settings.tabs.postbacks',
      ])
      expect(vi.mocked(useCreditOverview)).toHaveBeenCalledWith({ enabled: false })
    })

    it('кредитный оператор без права постбеков — прежние вкладки, постбеков нет', async () => {
      mockOverview(['credit.applications.read'])
      signIn(['credit.applications.read'])
      renderPage()
      expect(await tabNames()).toEqual([
        'credit.settings.tabs.products',
        'credit.settings.tabs.parameters',
        'credit.settings.tabs.integrations',
      ])
      expect(vi.mocked(useCreditPostbackRules)).not.toHaveBeenCalled()
    })

    it('риск-менеджер с правом постбеков — прежние вкладки и «Постбеки» последней', async () => {
      mockOverview(['credit.products.read', 'credit.parameters.read', 'credit.switches.read'])
      signIn(['credit.products.read', 'credit.parameters.read', READ])
      renderPage()
      expect(await tabNames()).toEqual([
        'credit.settings.tabs.products',
        'credit.settings.tabs.parameters',
        'credit.settings.tabs.integrations',
        'credit.settings.tabs.switches',
        'credit.settings.tabs.postbacks',
      ])
      expect(vi.mocked(useCreditOverview)).toHaveBeenCalledWith({ enabled: true })
    })

    it('без права ссылка ?tab=postbacks открывает первую доступную вкладку', async () => {
      mockOverview(['credit.products.read'])
      signIn(['credit.products.read'])
      renderPage('/dashboard/credit/settings?tab=postbacks')
      expect(await screen.findByText('CA_AB_PAYDAY')).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'credit.settings.tabs.products' })).toHaveAttribute(
        'aria-selected',
        'true'
      )
      expect(screen.queryByText('Partner one — lead')).not.toBeInTheDocument()
    })

    it('раздел выключен — на вкладке постбеков предупреждения нет, на вкладке модуля есть', async () => {
      vi.mocked(useCreditSectionEnabled).mockReturnValue(false)
      mockOverview(['credit.products.read'])
      signIn(['credit.products.read', READ])
      renderPage('/dashboard/credit/settings?tab=postbacks')
      expect(await screen.findByText('Partner one — lead')).toBeInTheDocument()
      expect(screen.queryByText('credit.switches.sectionOffHere')).not.toBeInTheDocument()
    })

    it('контроль: то же выключение на вкладке продуктов предупреждение показывает', async () => {
      vi.mocked(useCreditSectionEnabled).mockReturnValue(false)
      mockOverview(['credit.products.read'])
      signIn(['credit.products.read', READ])
      renderPage('/dashboard/credit/settings?tab=products')
      expect(await screen.findByText('credit.switches.sectionOffHere')).toBeInTheDocument()
    })

    it('право записи из пропуска доходит до списка: без него кнопки удаления нет', async () => {
      mockOverview([])
      signIn([READ])
      renderPage('/dashboard/credit/settings?tab=postbacks')
      await screen.findByText('Partner one — lead')
      expect(
        screen.queryByRole('button', { name: 'credit.postbacks.rules.delete' })
      ).not.toBeInTheDocument()
      expect(screen.getByRole('switch')).toBeDisabled()
    })

    it('с правом записи — кнопка удаления есть и переключатель доступен', async () => {
      mockOverview([])
      signIn([READ, WRITE])
      renderPage('/dashboard/credit/settings?tab=postbacks')
      await screen.findByText('Partner one — lead')
      expect(screen.getByRole('button', { name: 'credit.postbacks.rules.delete' })).toBeEnabled()
      expect(screen.getByRole('switch')).toBeEnabled()
    })
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
