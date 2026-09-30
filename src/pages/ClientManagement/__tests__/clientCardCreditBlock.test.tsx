/**
 * Кредит модуля в карточке клиента — сцены S-5, S-6, S-9, S-10, S-14…S-21
 * и страж P-24.
 *
 * 🔴 С 14-7b предмет ПЕРЕВЁРНУТ. Раньше здесь доказывали, что строка кредита
 * из «Позики» УХОДИТ (её показывала отдельная вкладка). Теперь вкладки нет
 * вовсе: кредит стоит строкой в том же списке, отличается пометкой и
 * разворачивается чипом на месте. Что НЕ изменилось ни на букву — он
 * по-прежнему не является предметом ни одного действия взыскания.
 *
 * Сцены идут ПО КАРТОЧКЕ ЦЕЛИКОМ, а не по копии правила рядом: предмет здесь —
 * утверждение об экране. Правило, проверенное на собственной копии, чинит
 * двойника, а не класс.
 *
 * Мокаются ИСТОЧНИКИ ДАННЫХ карточки, а не её логика: профиль, долги и соседние
 * разделы приходят заглушками, а разделение по происхождению, гейт разворота и
 * подпись в ленте — настоящие.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { DebtDetail } from '@/features/clients/api/types'
import type { ClientLoanCard } from '@/features/credit/api/types'
/**
 * 🔴 СТАТИЧЕСКИЙ импорт страницы — не стиль, а починка красного CI.
 *
 * Пока он стоял внутри `renderCard` (`await import('../ClientDetailPage')`),
 * холодная загрузка страницы со всем её деревом зависимостей попадала в бюджет
 * ПЕРВОГО теста. Локально это 3.5 с и незаметно; в CI под покрытием и
 * пятьюдесятью двумя параллельными форками — больше двадцати секунд, и тест
 * падал по таймауту, не добравшись до своего утверждения. Следующие тесты
 * ждали тот же незавершённый промис и падали так же: в прогоне 80788 сгорели
 * ровно пять первых сцен по 20 с каждая, а шестая прошла за 1 с.
 *
 * Замер (24 ядра, `--coverage --maxWorkers=52`, то есть перегрузка): первый
 * тест 20396 мс и таймаут, второй — 265 мс. Вся стоимость сидела в первом.
 * Импорт в шапке выполняется при загрузке файла тестов, и `testTimeout` на эту
 * фазу не распространяется.
 *
 * `vi.mock` поднимается выше импортов, поэтому заглушки ниже действуют и на
 * этот импорт — порядок строк на них не влияет.
 */
import ClientDetailPage from '../ClientDetailPage'
import { ClientActivityLogTab } from '../components/ClientActivityLogTab'
import { CreditApiError } from '@/features/credit/api/creditApi'
import * as activityLogModule from '@/features/clients/hooks/useClientActivityLog'

const { creditFlag, clientLoansFn } = vi.hoisted(() => ({
  creditFlag: vi.fn(() => true),
  clientLoansFn: vi.fn(),
}))

/**
 * 🔴 Здесь подменён общий мок `react-i18next` из `src/test/setup.ts`, и это не
 * прихоть. Тот мок возвращает САМ КЛЮЧ и подставляет переменные только в свой
 * короткий список строк. Подпись вкладки в ленте активности приезжает ровно
 * переменной (`Відкрито вкладку '{{tab}}'`), то есть под общим моком её не
 * видно ни в каком виде — сцена S-14 измеряла бы наличие ключа, а не слова,
 * которое прочитает оператор. Словарь берётся настоящий, украинский.
 */
vi.mock('react-i18next', async () => {
  const uk = (await import('../../../../public/locales/uk/common.json')).default as Record<
    string,
    unknown
  >
  const lookup = (key: string): unknown =>
    key
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === 'object' && part in node
            ? (node as Record<string, unknown>)[part]
            : undefined,
        uk
      )
  const t = (key: string, options?: unknown, interpolation?: Record<string, unknown>): string => {
    const vars = (interpolation ?? (typeof options === 'object' ? options : undefined)) as
      | Record<string, unknown>
      | undefined
    const found = lookup(key)
    let template = typeof found === 'string' ? found : typeof options === 'string' ? options : key
    if (vars) {
      template = template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
        name in vars ? String(vars[name]) : `{{${name}}}`
      )
    }
    return template
  }
  return {
    useTranslation: () => ({ t, i18n: { language: 'uk', changeLanguage: vi.fn() } }),
    Trans: ({ children }: { children: ReactNode }) => children,
    I18nextProvider: ({ children }: { children: ReactNode }) => children,
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  }
})

vi.mock('@/features/credit/api/creditModuleFlag', () => ({
  CREDIT_MODULE_FLAG: 'VITE_CREDIT_MODULE_ENABLED',
  isCreditModuleEnabled: creditFlag,
}))

vi.mock('@/features/credit/api/creditApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/credit/api/creditApi')>()
  return { ...actual, creditApi: { ...actual.creditApi, clientLoans: clientLoansFn } }
})

/**
 * Потребители действий взыскания подменены заглушками, которые ЗАПИСЫВАЮТ
 * переданный им список долгов.
 *
 * Иначе проверить нечего: история УБКИ, история ЦД и модалки платежа и
 * списания в закрытом виде не рисуют ни одной строки, и утверждение «кредита
 * модуля там нет» выполнялось бы на пустом экране — при любом списке.
 */
const handedDebts = vi.hoisted(() => ({
  ubki: [] as Array<{ loanNumber?: string }>,
  taHistory: [] as Array<{ contract_number?: string }>,
  payment: [] as Array<{ contract_number?: string }>,
  writeoff: [] as Array<{ contract_number?: string }>,
  chainExecutor: [] as Array<{ contract_number?: string }>,
  interactionOptions: [] as Array<{ contractNumber?: string }>,
  sms: [] as Array<{ loanNumber?: string }>,
  message: [] as Array<{ loanNumber?: string }>,
}))

/** Массовая отправка в бюро — единственное действие, которое уходит НАРУЖУ. */
const bulkSubmitToUbki = vi.hoisted(() => vi.fn())

vi.mock('@/features/ubki', () => ({
  useSubmitDebtToUbki: () => ({ mutate: vi.fn(), isPending: false }),
  useBulkSubmitToUbki: () => ({ mutate: bulkSubmitToUbki, isPending: false }),
  useUbkiAvailable: () => true,
  ubkiKeys: { all: ['ubki'] },
}))

vi.mock('../components/UbkiSubmissionHistory', () => ({
  UbkiSubmissionHistory: (props: { loans: Array<{ loanNumber?: string }> }) => {
    handedDebts.ubki = props.loans
    return null
  },
}))

vi.mock('../components/taChains', () => ({
  TAInteractionHistory: (props: { debts: Array<{ contract_number?: string }> }) => {
    handedDebts.taHistory = props.debts
    return null
  },
  ChainExecutor: (props: { debts: Array<{ contract_number?: string }> }) => {
    handedDebts.chainExecutor = props.debts
    return null
  },
}))

vi.mock('../components/EditInteractionModal', () => ({
  EditInteractionModal: (props: { loanOptions: Array<{ contractNumber?: string }> }) => {
    handedDebts.interactionOptions = props.loanOptions
    return null
  },
}))

vi.mock('../components/SendSMSModal', () => ({
  SendSMSModal: (props: { loans: Array<{ loanNumber?: string }> }) => {
    handedDebts.sms = props.loans
    return null
  },
}))

vi.mock('../components/SendMessageModal', () => ({
  SendMessageModal: (props: { loans: Array<{ loanNumber?: string }> }) => {
    handedDebts.message = props.loans
    return null
  },
}))

/**
 * Модалки карточки рисуют содержимое только открытыми, а списки, которые они
 * получают (цепочки ЦД, выбор договора для реструктуризации), — как раз то,
 * что проверяется. Заглушка рендерит их всегда: без неё «кредита модуля в
 * списке нет» выполнялось бы просто потому, что списка нет вовсе.
 */
/**
 * Список выбора договора для реструктуризации живёт внутри закрытого `Select`
 * и в DOM не попадает. Заглушка рисует его содержимое обычными узлами — иначе
 * «кредита модуля в списке РР нет» проверялось бы на пустом множестве.
 */
vi.mock('@/components/ui/Select', () => {
  const pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  return {
    Select: pass,
    SelectGroup: pass,
    SelectValue: pass,
    SelectTrigger: pass,
    SelectContent: pass,
    SelectLabel: pass,
    SelectItem: ({ children, value }: { children?: ReactNode; value?: string }) => (
      <div data-select-item={value}>{children}</div>
    ),
    SelectSeparator: pass,
    SelectScrollUpButton: pass,
    SelectScrollDownButton: pass,
  }
})

vi.mock('../components/RecordPaymentModal', () => ({
  RecordPaymentModal: (props: { debts: Array<{ contract_number?: string }> }) => {
    handedDebts.payment = props.debts
    return null
  },
}))

vi.mock('../components/WriteoffCreateModal', () => ({
  WriteoffCreateModal: (props: { debts: Array<{ contract_number?: string }> }) => {
    handedDebts.writeoff = props.debts
    return null
  },
}))

vi.mock('@/hooks/usePermissions', () => ({
  useHasPermission: vi.fn(() => true),
  useHasAnyPermission: vi.fn(() => true),
  useHasAllPermissions: vi.fn(() => true),
  useUserRole: vi.fn(() => 'admin'),
}))

/**
 * Долг, который в CRM записал кредитный модуль.
 *
 * 🔴 Форма — ОТВЕТА client-service, а не рукописного типа фронта. Сумма
 * выдачи едет в `principal_amount` (модуль кладёт туда начисленное тело), а
 * `original_debt_amount` сервер не отдаёт вовсе: этого поля нет ни в
 * `DebtDetail` ответа карточки, ни в словаре, который его наполняет
 * (`services/client/app/schemas/client.py:27-60`, `routers/clients.py:307-345`
 * на `d6f7c9af`). Прежняя фикстура несла поле, которого сервер не шлёт, и не
 * несла того, что шлёт, — выдуманный вход проверял только себя, и строка на
 * живом ответе печатала «Сума позики 0,00» незамеченной.
 */
const CREDIT_DEBT = {
  id: 9001,
  seller_company: '',
  contract_number: 'FB-000088',
  principal_amount: '5000.00',
  remaining_debt_amount: '6123.00',
  days_past_due: 41,
  status: 'active',
  origin: 'credit_module',
  loan_id: '11111111-1111-4111-8111-111111111111',
  currency: 'UAH',
  lifecycle_detail: 'delinquent',
  lifecycle_updated_at: '2026-09-21T10:00:00Z',
} as unknown as DebtDetail

/**
 * Второй кредит того же клиента — живой `FB-000090` с DEV (400,00 / 456,00
 * CAD, GATE-CL-05 п. 3). Та же форма ответа сервера, что у `CREDIT_DEBT`.
 * `lifecycle_detail` — `null`: у активного кредита без нюанса модуль детали не
 * шлёт (`crm_projection.py:73`, `"active": ("active", None)`).
 */
const SECOND_CREDIT_DEBT = {
  id: 9004,
  seller_company: '',
  contract_number: 'FB-000090',
  principal_amount: '400.00',
  remaining_debt_amount: '456.00',
  days_past_due: 0,
  status: 'active',
  origin: 'credit_module',
  loan_id: '22222222-2222-4222-8222-222222222222',
  currency: 'CAD',
  lifecycle_detail: null,
  lifecycle_updated_at: '2026-09-21T10:00:00Z',
} as unknown as DebtDetail

/**
 * Карты класса А обоих кредитов — ответ двери модуля, все двадцать четыре
 * ключа контракта (форма — `LOAN` в `pages/Credit/__tests__/ClientCreditBlock.test.tsx`).
 * Продукт у них РАЗНЫЙ намеренно: продукта в строке нет, и по нему видно, чья
 * карта развернулась под какой строкой.
 */
const CARD_FB_000088: ClientLoanCard = {
  loan_id: '11111111-1111-4111-8111-111111111111',
  contract_number: 'FB-000088',
  product_code: 'PDL-UA-30',
  status: 'delinquent',
  currency: 'UAH',
  jurisdiction: 'UA',
  principal_minor: 500000,
  balance_total_minor: 612300,
  paid_minor: 120000,
  overdue_minor: 98700,
  delinquency_days: 41,
  arrears_flag: true,
  no_contact_flag: false,
  default_reported_at: null,
  disbursed_at: '2026-06-01T09:15:00Z',
  maturity_date: '2026-07-01',
  next_payment: null,
  closed_at: null,
  close_reason: null,
  cancelled_at: null,
  return_pending: false,
  as_of: '2026-09-22',
  closed_through: '2026-09-21',
  module_url: '/dashboard/credit/loans/11111111-1111-4111-8111-111111111111',
}

const CARD_FB_000090: ClientLoanCard = {
  ...CARD_FB_000088,
  loan_id: '22222222-2222-4222-8222-222222222222',
  contract_number: 'FB-000090',
  product_code: 'CA_AB_PAYDAY',
  status: 'active',
  currency: 'CAD',
  jurisdiction: 'CA-AB',
  principal_minor: 40000,
  balance_total_minor: 45600,
  paid_minor: 0,
  overdue_minor: 0,
  delinquency_days: 0,
  arrears_flag: false,
  module_url: '/dashboard/credit/loans/22222222-2222-4222-8222-222222222222',
}

/**
 * Долг с НЕИЗВЕСТНЫМ источником — контроль правила «по значению, а не по
 * отрицанию». Правило, написанное как «всё, что не факторинг», утащило бы его
 * в блок кредита и убрало из взыскания, хотя про этот источник не известно
 * ничего.
 *
 * 🔴 С 14-7b у этой сцены ВТОРАЯ роль, и она главная. Прежняя контрольная
 * половина P-24 («при выключенном блоке действия видят долг снова») снята
 * вместе с параметром `creditBlockEnabled` у правила: принадлежность долга от
 * переменной сборки не зависит, и норма требует исключения из действий
 * ВСЕГДА. Роль «докажи, что сцены меряют правило, а не то, что строка вообще
 * не доезжает до действий» перешла сюда: этот долг проходит то же правило и
 * ОСТАЁТСЯ предметом взыскания — значит выборка различает по значению.
 */
const UNKNOWN_ORIGIN_DEBT = {
  id: 9003,
  seller_company: 'Партнёр',
  contract_number: 'PARTNER-9',
  original_debt_amount: '300.00',
  remaining_debt_amount: '250.00',
  days_past_due: 3,
  status: 'active',
  origin: 'partner',
} as unknown as DebtDetail

/** Купленный долг — положительный контроль: он из «Позики» НЕ уходит. */
const FACTORING_DEBT = {
  id: 9002,
  seller_company: 'ПриватБанк',
  contract_number: 'LEGACY-55',
  original_debt_amount: '1000.00',
  remaining_debt_amount: '900.00',
  days_past_due: 10,
  status: 'active',
} as unknown as DebtDetail

const PROFILE = {
  id: 42,
  full_name: 'Клієнт Тестовий',
  first_name: 'Тестовий',
  last_name: 'Клієнт',
  middle_name: null,
  email: null,
  tax_id: '1234567890',
  identity_key: 'tin' as const,
  phone_primary: '+380501112233',
  date_of_birth: null,
  age: null,
  priority_score: 10,
  priority_level: 'low',
  manual_priority: null,
  status: 'new',
  contacts: [],
  comments: [],
  addresses: [],
  passport: null,
  employment: null,
  tags: [],
}

const debts = vi.hoisted(() => ({ rows: [] as DebtDetail[] }))
const profileState = vi.hoisted(() => ({ value: null as unknown }))

vi.mock('@/features/clients/hooks/useClients', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/clients/hooks/useClients')>()
  const empty = { data: undefined, isLoading: false, isError: false, error: null, refetch: vi.fn() }
  const list = { data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }
  return {
    ...actual,
    useClient: () => empty,
    useClientProfile: () => ({ ...empty, data: profileState.value }),
    useClientLoans: () => ({ ...list, data: debts.rows }),
    useClientPaymentsSection: () => empty,
    useClientCallSmsHistory: () => empty,
    useClientRecentCalls: () => list,
    useClientTasks: () => list,
    useClientOperatorsSection: () => empty,
    useClientDocuments: () => list,
    useClientActivities: () => list,
    useUpdateContact: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useCreateContact: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeleteContact: () => ({ mutateAsync: vi.fn(), isPending: false }),
  }
})

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/dashboard/clients/42']}>
          <Routes>
            <Route path="/dashboard/clients/:id" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }
}

async function renderCard(options: { rows?: DebtDetail[]; profile?: unknown } = {}) {
  debts.rows = options.rows ?? []
  profileState.value = options.profile ?? PROFILE
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })
  const result = render(<ClientDetailPage />, { wrapper: wrapper(client) })
  return { ...result, client }
}

/**
 * Карточка строки «Позики» по номеру договора — корень `LoanCard`.
 *
 * Ищется по строке номера зоны 1 («№ FB-000090»), а не по голому номеру: у
 * развёрнутой строки тот же номер печатает и карта класса А под ней, и голый
 * поиск нашёл бы два узла ровно тогда, когда это важнее всего.
 */
function cardOf(contractNumber: string): HTMLElement {
  const line = screen.getByText(`№ ${contractNumber}`)
  const card = line.closest('div[role="button"]')
  if (!card) throw new Error(`строка ${contractNumber} отрисована вне карточки списка`)
  return card as HTMLElement
}

/**
 * Значение денежной ячейки строки по её подписи («Сума позики», «Залишок
 * боргу»): подпись и значение — соседние узлы `AmountCell`, и поиск по тексту
 * всей карточки не сказал бы, ПОД КАКОЙ подписью стоит число.
 */
function amountOf(card: HTMLElement, label: string): string {
  const labelNode = within(card).getByText(label, { selector: 'span' })
  return labelNode.nextElementSibling?.textContent ?? ''
}

beforeEach(() => {
  vi.clearAllMocks()
  creditFlag.mockReturnValue(true)
  clientLoansFn.mockResolvedValue({ items: [], next_cursor: null })
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('S-5/S-6: кредит модуля стоит СТРОКОЙ в «Позики» и помечен', () => {
  it('S-5′ флаг включён: кредитный долг в «Позики» есть и помечен чипом; купленный — без чипа', async () => {
    await renderCard({ rows: [CREDIT_DEBT, FACTORING_DEBT] })

    // положительный контроль: купленный долг на месте, то есть список
    // отрисован и утверждения ниже сказаны о непустом экране
    await screen.findByText(/LEGACY-55/)
    // 🔴 Заглавная перемена 14-7b: строка БОЛЬШЕ НЕ уходит из списка — она в
    // нём, и отличает её пометка, а не отсутствие.
    expect(screen.queryByText(/FB-000088/), 'кредитной строки нет в списке «Позики»').not.toBeNull()
    // Ровно одна пометка на два долга: вторая означала бы, что купленный долг
    // подписан как наш кредит.
    expect(screen.getAllByText('кредит (наш)')).toHaveLength(1)
  })

  it('S-6′ флаг выключен: чипа-ручки и разворота нет, строка и пометка на месте', async () => {
    creditFlag.mockReturnValue(false)
    const { container } = await renderCard({ rows: [CREDIT_DEBT, FACTORING_DEBT] })

    await screen.findByText(/LEGACY-55/)
    // Долг никуда не делся — иначе оператор потерял бы его с экрана целиком.
    expect(
      screen.queryByText(/FB-000088/),
      'при выключенном флаге строки кредита в «Позики» нет — долг пропал с экрана'
    ).not.toBeNull()
    // Пометка остаётся: принадлежность долга от переменной сборки не зависит.
    const tag = screen.getByText('кредит (наш)')
    expect(tag).toBeInTheDocument()
    // А вот РУЧКИ нет: при выключенном флаге пометка печатается подписью, а не
    // кнопкой, и разворачивать нечего.
    expect(tag.tagName).toBe('SPAN')
    expect(clientLoansFn).not.toHaveBeenCalled()
    // ⚠️ Про `data-tab="credit"` здесь НЕ утверждается ничего: кнопка вкладки
    // и на прежней базе стояла под флагом, так что при выключенном флаге её
    // нет и БЕЗ снятия вкладки. Отсутствие вкладки доказывает S-19 — при
    // ВКЛЮЧЁННОМ флаге, то есть в том состоянии, где кнопка раньше была.
    expect(container.querySelector('[data-tab="loans"]')).toBeTruthy()
  })
})

describe('S-20: строка кредита печатает цифры ПРОЕКЦИИ — через маппер страницы', () => {
  /**
   * 🔴 Сцены L-* кормят карточку руками собранной строкой и маппер страницы
   * не видят вовсе. Здесь строка рождается из ответа client-service тем же
   * путём, что в бою (`mapCreditProjectionToRow`), — и только так видно,
   * ИЗ КАКОГО ПОЛЯ взята сумма. Прежний маппер читал `original_debt_amount`,
   * которого сервер не шлёт, и печатал «Сума позики 0,00» на каждом кредите.
   *
   * Утверждения идут от частного к общему: каждое отрицание называет свою
   * подмену, иначе «не 400,00 CAD» не различило бы четыре разных ошибки.
   */
  it('🔴 «Сума позики» 400,00 CAD, «Залишок боргу» 456,00 CAD, стадия — словом словаря', async () => {
    await renderCard({ rows: [CREDIT_DEBT, SECOND_CREDIT_DEBT, FACTORING_DEBT] })
    await screen.findByText(/LEGACY-55/)

    const second = cardOf('FB-000090')
    const loanAmount = amountOf(second, 'Сума позики')
    expect(
      loanAmount,
      'под строкой FB-000090 напечатано «Сума позики 0,00 CAD» вместо 400,00 CAD — сумма взята из поля, которого сервер не шлёт'
    ).not.toMatch(/^0,00/)
    expect(
      loanAmount,
      '«Сума позики» показывает остаток 456,00 вместо суммы выдачи 400,00'
    ).not.toBe('456,00 CAD')
    expect(loanAmount, 'кредит в CAD напечатан гривной — ложь о валюте').toMatch(/ CAD$/)
    expect(loanAmount).toBe('400,00 CAD')
    expect(amountOf(second, 'Залишок боргу')).toBe('456,00 CAD')

    // Стадия приходит в `lifecycle_detail` и печатается словом словаря.
    expect(
      within(cardOf('FB-000088')).queryByText('Прострочення'),
      'стадия «Прострочення» пропала из строки кредита FB-000088'
    ).not.toBeNull()

    // Ни одна кредитная строка не выдаёт отсутствие суммы за ноль.
    for (const number of ['FB-000088', 'FB-000090']) {
      const card = cardOf(number)
      for (const label of ['Сума позики', 'Залишок боргу']) {
        expect(amountOf(card, label), `${number}: «${label}» — ноль как факт`).not.toMatch(/^0,00/)
      }
    }

    // Контроль: купленная строка в том же списке печатает свои суммы гривной —
    // значит сетка сумм у неё прежняя, и «CAD» выше сказано о другой форме.
    expect(amountOf(cardOf('LEGACY-55'), 'Залишок боргу')).toMatch(/^₴\s900\.00$/)
  })
})

describe('S-19: вкладки «Кредит (наш)» нет при ВКЛЮЧЁННОМ флаге', () => {
  it('🔴 полоса вкладок отрисована, кнопки «Кредит (наш)» в ней нет', async () => {
    // Единственное доказательство снятия вкладки. Сцена с выключённым флагом
    // его не даёт: там кнопки не было и до правки.
    creditFlag.mockReturnValue(true)
    const { container } = await renderCard({ rows: [CREDIT_DEBT, FACTORING_DEBT] })
    await screen.findByText(/LEGACY-55/)

    // Положительный контроль: полоса вкладок ЕСТЬ и в ней есть соседи, то
    // есть «кнопки нет» сказано о существующей полосе, а не о пустом экране.
    expect(container.querySelector('[data-tab="loans"]')).toBeTruthy()
    expect(container.querySelector('[data-tab="activity"]')).toBeTruthy()
    expect(
      container.querySelector('[data-tab="credit"]'),
      'вкладка «Кредит (наш)» вернулась в полосу при включённом флаге'
    ).toBeNull()
  })
})

describe('S-10: запрос в модуль не уходит до разворота строки', () => {
  it('S-10′ на открытой «Позики» — ноль вызовов; после клика по чипу — один, и второй чип его не добавляет', async () => {
    const user = userEvent.setup()
    await renderCard({ rows: [CREDIT_DEBT, SECOND_CREDIT_DEBT] })

    // Обе строки на экране, вкладка «Позики» открыта — и запроса всё ещё нет:
    // гейт ленивости это МОНТИРОВАНИЕ панели, а не её видимость.
    await screen.findByText(/FB-000088/)
    const chips = screen.getAllByText('кредит (наш)')
    expect(chips, 'чипов должно быть два — по одному на кредит').toHaveLength(2)
    expect(
      clientLoansFn,
      'запрос в модуль ушёл до разворота строки — гейт ленивости снят'
    ).not.toHaveBeenCalled()

    await user.click(chips[0])

    await waitFor(() => expect(clientLoansFn).toHaveBeenCalledTimes(1))
    expect(clientLoansFn).toHaveBeenCalledWith(42)

    // Ключ кэша один на клиента: разворот второй строки берёт тот же ответ.
    await user.click(screen.getAllByText('кредит (наш)')[1])
    await waitFor(() => expect(clientLoansFn).toHaveBeenCalledTimes(1))
  })

  it('S-10′ 🔴 403: строка в списке есть, а разворот объясняет причину БЕЗ повтора цифр', async () => {
    // Отказ подделывать НЕЛЬЗЯ: блок различает состояния по классу ошибки, и
    // объект с подменённым `name` не является `CreditApiError` — прежняя
    // редакция сцены так и мерила состояние «модуль недоступен», называя это
    // проверкой фолбэка.
    const user = userEvent.setup()
    clientLoansFn.mockRejectedValue(new CreditApiError('forbidden', 403, 'forbidden'))
    const { container } = await renderCard({ rows: [CREDIT_DEBT, FACTORING_DEBT] })

    // Строка кредита стоит в списке рядом с купленным долгом.
    await screen.findByText(/LEGACY-55/)
    await screen.findByText(/FB-000088/)

    await user.click(screen.getByText('кредит (наш)'))

    // Пометки читаются по тексту контейнера: подпись и значение — соседние
    // узлы, и поиск по целой строке через `getByText` их не склеивает.
    await waitFor(() =>
      expect(container.textContent ?? '').toContain('Немає прав на кредитний розділ')
    )
    const text = container.textContent ?? ''
    // День среза — ЗНАЧЕНИЕМ, а не подписью: `2026-09-21T10:00:00Z` фикстуры
    // `CREDIT_DEBT` в зоне Киева (+03) — 21-е, 13:00. Подпись без даты
    // доказывала бы лишь, что ключ словаря на месте.
    expect(text, 'день среза проекции не напечатан под строкой').toContain(
      'Проєкція станом на 21-09-2026 13:00'
    )
    expect(text).toContain('Повні дані')
    // Плашка называет причину — «прав нет», а не «модуля нет».
    expect(text).not.toContain('недоступний на цьому стенді')
    // 🔴 Цифры строки НЕ печатаются под ней второй раз: они уже стоят в самой
    // строке, и две одинаковые суммы в двух местах одного экрана читаются
    // оператором как два разных факта. Меряется номером договора, а не суммой:
    // пробел-разделитель разрядов в числе — неразрывный, и литерал с обычным
    // пробелом не нашёл бы ничего, то есть сцена зеленела бы всегда.
    expect(
      screen.getAllByText(/FB-000088/),
      'строки проекции напечатаны под карточкой — номер договора встретился дважды'
    ).toHaveLength(1)
    // Подписи повторяемых цифр строки под ней не появляются.
    expect(text).not.toContain('Видано')
    // 🔴 А ДПЗ — появляется (Р-FEL1B-12). Его в строке нет вовсе, то есть это
    // пятая величина, а не повтор; и отказ двери получают ВСЕ роли взыскания
    // (право не расширяется), так что без этой строки оператор взыскания не
    // видел бы просрочку нашего кредита нигде.
    const dpd = screen.queryByText('ДПЗ')
    expect(
      dpd,
      'при отказе двери просрочка кредита не напечатана нигде — оператор взыскания её не видит'
    ).not.toBeNull()
    expect(dpd?.nextElementSibling?.textContent).toBe('41')
  })
})

describe('P-24: кредит модуля не является предметом действий взыскания', () => {
  /**
   * У каждого действия — две половины: кредит модуля НЕ передан, а купленный
   * долг передан. Проверяется СПИСОК, который действие получило, а не текст на
   * экране: закрытая модалка не рисует ни строки, и «кредита там нет»
   * выполнялось бы при любом наборе.
   */
  async function openCard() {
    const result = await renderCard({ rows: [CREDIT_DEBT, FACTORING_DEBT] })
    await screen.findByText(/LEGACY-55/)
    return result
  }

  const numbersOf = (
    rows: Array<{ contract_number?: string; loanNumber?: string; contractNumber?: string }>
  ) => rows.map((row) => row.contract_number ?? row.loanNumber ?? row.contractNumber)

  it('массовая отправка в УБКИ получает список без кредита модуля', async () => {
    // О кредите модуля в бюро отчитывается сам модуль (`default_reported_at`
    // его карточки); вторая отправка была бы повторной передачей.
    await openCard()
    expect(numbersOf(handedDebts.ubki)).toEqual(['LEGACY-55'])
  })

  it('🔴 нажатая кнопка отправляет в бюро ТОЛЬКО долги взыскания', async () => {
    // Список подписей проверяет показ, а этот случай — то, что уходит наружу:
    // идентификаторы в теле запроса к бюро.
    const user = userEvent.setup()
    const { container } = await openCard()
    const button = Array.from(container.querySelectorAll('button')).find((node) =>
      node.textContent?.includes('УБКІ')
    )
    expect(button, 'кнопки массовой отправки нет — нажимать нечего').toBeTruthy()
    await user.click(button as HTMLElement)

    await waitFor(() => expect(bulkSubmitToUbki).toHaveBeenCalled())
    const [payload] = bulkSubmitToUbki.mock.calls[0]
    // 9002 — купленный долг, 9001 — кредит модуля.
    expect(payload.debt_ids).toEqual([9002])
  })

  it('история ЦД получает список без кредита модуля', async () => {
    await openCard()
    expect(numbersOf(handedDebts.taHistory)).toEqual(['LEGACY-55'])
  })

  it('платёж и списание получают список без кредита модуля', async () => {
    await openCard()
    expect(numbersOf(handedDebts.payment)).toEqual(['LEGACY-55'])
    expect(numbersOf(handedDebts.writeoff)).toEqual(['LEGACY-55'])
  })

  it('цепочки ЦД получают список без кредита модуля', async () => {
    // Исполнитель цепочек живёт в модалке и монтируется только ОТКРЫТЫМ.
    // Прежняя редакция сцены его не открывала и утверждала `toEqual([])` —
    // верно при ЛЮБОМ списке, то есть не мерила ничего. Теперь модалка
    // открывается штатной кнопкой шапки «Журнал взаємодії», и регистратор
    // видит ровно то, что получил исполнитель.
    const user = userEvent.setup()
    await openCard()
    expect(handedDebts.chainExecutor, 'исполнитель смонтирован до открытия модалки').toEqual([])

    await user.click(screen.getAllByRole('button', { name: /Журнал взаємодії/ })[0])

    // Положительный контроль: исполнитель смонтирован и список получил —
    // иначе утверждение ниже снова говорило бы о пустом множестве.
    await waitFor(() => expect(handedDebts.chainExecutor.length).toBeGreaterThan(0))
    expect(numbersOf(handedDebts.chainExecutor), 'цепочки ЦД получили кредит модуля').toEqual([
      'LEGACY-55',
    ])
  })

  it('правка взаимодействия предлагает договор без кредита модуля', async () => {
    await openCard()
    expect(numbersOf(handedDebts.interactionOptions)).toEqual(['LEGACY-55'])
  })

  it('SMS и сообщения предлагают договор без кредита модуля', async () => {
    await openCard()
    expect(numbersOf(handedDebts.sms)).toEqual(['LEGACY-55'])
    expect(numbersOf(handedDebts.message)).toEqual(['LEGACY-55'])
  })

  /**
   * 🔴 Класс, а не экземпляр.
   *
   * Часть потребителей действий монтируется только открытой, и сценой их
   * список не увидеть, не разобрав пол-карточки. Но предмет здесь не «как
   * выглядит модалка», а «какой список ей отдали», и это читается в исходнике:
   * проверка по тексту файла ловит возврат ЛЮБОГО потребителя, включая те,
   * которых сцены не монтируют, а регистраторы этого блока (включая S-18 и
   * сцену выключенного флага) доказывают, что у смонтированных список
   * действительно очищен.
   *
   * ⚠️ Остаточная дыра названа, а не спрятана: ПСЕВДОНИМ через локальную
   * переменную (`const rows = displayLoans` → `debts={rows}`) текстом не
   * ловится. Смонтированных потребителей держат регистраторы; тех, кого ни одна
   * сцена не монтирует (панель реструктуризации и её выбор договора), — только
   * этот страж и пины производных `useMemo` ниже.
   */
  it('🔴 ни один потребитель действий не читает сырой список долгов', () => {
    const sources = import.meta.glob('../ClientDetailPage.tsx', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>
    const source = Object.values(sources)[0]
    expect(source, 'исходник карточки не прочитан — проверять нечего').toBeTruthy()

    // Положительный контроль: очищенный список в файле ЕСТЬ, то есть «сырого
    // нет» сказано о живом файле, а не о пустом чтении.
    expect(source).toMatch(/debts=\{collectionDebts\}/)
    expect(source).toMatch(/loanOptions=\{collectionDebts/)
    // 🔴 И второй положительный контроль — на НОВЫЙ источник: список показа
    // действительно собран третьим выходом правила.
    expect(source, 'список «Позики» собран не из третьего выхода правила').toMatch(
      /loans=\{displayLoans\}/
    )

    /**
     * 🔴 Источники ПОКАЗА охраняются по ЗНАЧЕНИЮ атрибута, а не по имени пропса.
     *
     * Прежняя форма стража перечисляла запрещённые написания
     * (`debts={displayDebts}`, `loanOptions={displayLoans…}`) и пропускала всё,
     * чего не перечислила: `debts={[...displayDebts]}`, `debts={displayLoans ??
     * []}`, `.filter(…)` и — главное — второй `loans={displayLoans}` у чужого
     * потребителя, у которого пропс называется так же, как у списка. Теперь
     * собираются ВСЕ JSX-атрибуты, в значении которых упомянут любой из двух
     * источников показа, и множество обязано быть ровно одним законным случаем.
     */
    // Значение атрибута может нести фигурные скобки внутри (`debts={displayDebts.filter((d) => { … })}`):
    // ищем до первого вхождения имени, не требуя закрывающей скобки (дельта-ревью r2 N-2, куратор 23.09).
    const displayAttrs = source.match(/\b\w+=\{[^}]*?\bdisplay(?:Loans|Debts)\b/g) ?? []
    expect(
      displayAttrs,
      `список показа отдан не только «Позикам»: [${displayAttrs.join(', ')}]`
    ).toEqual(['loans={displayLoans'])

    // Документы привязываются к КУПЛЕННЫМ договорам и читают очищенный
    // `client.loans` — ровно в двух местах (`DocumentsAccordion` и
    // `DocumentUploadModal`). Третий читатель этого списка — новый потребитель,
    // и решать о нём надо здесь, а не молча.
    const documentReaders = source.match(/loans=\{client\.loans\}/g) ?? []
    expect(
      documentReaders,
      `читателей client.loans стало ${documentReaders.length}, а не 2 (документы)`
    ).toHaveLength(2)

    // Сырой список долгов — тем же ходом, что и до 14-7b.
    for (const forbidden of [
      /debts=\{loans\}/,
      /debts=\{loans \?\? \[\]\}/,
      /loans=\{loans\}/,
      /loanOptions=\{loans[^A-Za-z]/,
    ]) {
      expect(source, `потребитель действия читает сырой список: ${forbidden}`).not.toMatch(
        forbidden
      )
    }

    // Три производные, на которых стоят действия, тоже строятся из очищенного
    // набора: список РР (он же питает SMS и сообщения), признак списания и
    // идентификаторы для бюро.
    expect(source).toMatch(/eligibleLoansForRr = useMemo\(\s*\(\) => collectionDebts/)
    expect(source).toMatch(/hasEligibleLoanForWriteoff = useMemo\(\s*\(\) => collectionDebts/)
    expect(source).toMatch(/ubkiLoanIds = useMemo\(\(\) => collectionDebts/)
  })

  it('долг с неизвестным источником остаётся предметом взыскания', async () => {
    // Правило названо ЗНАЧЕНИЕМ (`origin === 'credit_module'`), а не
    // отрицанием факторинга: иначе первый же новый источник молча уехал бы в
    // кредитный блок и пропал из действий.
    await renderCard({ rows: [CREDIT_DEBT, FACTORING_DEBT, UNKNOWN_ORIGIN_DEBT] })
    await screen.findByText(/LEGACY-55/)
    expect(numbersOf(handedDebts.ubki).sort()).toEqual(['LEGACY-55', 'PARTNER-9'])
    expect(screen.getByText(/PARTNER-9/)).toBeInTheDocument()
  })

  it('S-18 🔴 список ПОКАЗА не подменил список действий', async () => {
    // Третий выход правила появился ради экрана, и молча подменить им первый
    // было бы легче всего: экран выглядел бы так же, а в списание уехал бы
    // чужой долг. Поэтому обе половины утверждаются В ОДНОЙ сцене: строка
    // кредита ВИДНА оператору и при этом НЕ отдана ни одному действию.
    creditFlag.mockReturnValue(true)
    await openCard()

    // видна
    expect(screen.getByText(/FB-000088/)).toBeInTheDocument()
    expect(screen.getByText('кредит (наш)')).toBeInTheDocument()
    // и не отдана
    for (const [name, rows] of [
      ['УБКІ', handedDebts.ubki],
      ['история ЦД', handedDebts.taHistory],
      ['платёж', handedDebts.payment],
      ['списание', handedDebts.writeoff],
      ['выбор договора', handedDebts.interactionOptions],
      ['SMS', handedDebts.sms],
      ['сообщения', handedDebts.message],
    ] as const) {
      expect(numbersOf(rows), `${name} получил кредит модуля`).toEqual(['LEGACY-55'])
    }
  })

  it('🔴 флаг ВЫКЛЮЧЕН — кредит по-прежнему вне всех действий (Р-FEL1B-1)', async () => {
    // Прежняя «контрольная половина» P-24 утверждала обратное — при
    // выключенном блоке долг возвращался во все действия, — и снята вместе с
    // параметром правила. Пустое место на её месте означало бы, что новую
    // норму никто не мерит: принадлежность долга от переменной сборки не
    // зависит, и исключение из действий обязано держаться при любом флаге.
    creditFlag.mockReturnValue(false)
    await openCard()

    // Положительный контроль: строка кредита на экране и помечена ПОДПИСЬЮ
    // (ручки нет — флаг выключен), то есть сцена идёт в том самом состоянии.
    expect(screen.getByText(/FB-000088/)).toBeInTheDocument()
    expect(screen.getByText('кредит (наш)').tagName).toBe('SPAN')
    for (const [name, rows] of [
      ['УБКІ', handedDebts.ubki],
      ['история ЦД', handedDebts.taHistory],
      ['платёж', handedDebts.payment],
      ['списание', handedDebts.writeoff],
      ['выбор договора', handedDebts.interactionOptions],
      ['SMS', handedDebts.sms],
      ['сообщения', handedDebts.message],
    ] as const) {
      expect(
        numbersOf(rows),
        `при выключенном флаге ${name} получил кредит модуля FB-000088 — исключение из действий стало зависеть от стенда (Р-FEL1B-1)`
      ).toEqual(['LEGACY-55'])
    }
  })
})

describe('S-16: разворот не трогает фокус карточки', () => {
  it('клик по чипу не притемняет соседние карточки', async () => {
    const user = userEvent.setup()
    const { container } = await renderCard({ rows: [CREDIT_DEBT, FACTORING_DEBT] })
    await screen.findByText(/LEGACY-55/)

    // Контроль: притемнение вообще умеет появляться — клик по ТЕЛУ карточки
    // его включает. Без этой половины «не притемнилось» доказывало бы лишь то,
    // что класс не ищется нигде.
    await user.click(screen.getByText(/LEGACY-55/))
    await waitFor(() => expect(container.querySelector('[class*="opacity-[0.42]"]')).toBeTruthy())

    // Снимаем фокус тем же кликом и разворачиваем чипом — притемнения нет.
    await user.click(screen.getByText(/LEGACY-55/))
    await waitFor(() => expect(container.querySelector('[class*="opacity-[0.42]"]')).toBeNull())
    await user.click(screen.getByText('кредит (наш)'))
    expect(
      container.querySelector('[class*="opacity-[0.42]"]'),
      'клик по чипу переключил фокус карточки — соседние карточки притемнились'
    ).toBeNull()
  })

  it('второй клик по тому же чипу сворачивает панель и снимает поворот шеврона', async () => {
    // Мерится НАСТОЯЩЕЕ состояние страницы (`toggleCreditExpand`), а не
    // пропс, поданный руками: разворот, который нельзя закрыть, в сценах
    // карточки выглядел бы так же, как рабочий.
    const user = userEvent.setup()
    clientLoansFn.mockResolvedValue({ items: [CARD_FB_000088], next_cursor: null })
    await renderCard({ rows: [CREDIT_DEBT, FACTORING_DEBT] })
    await screen.findByText(/LEGACY-55/)
    const chip = () => within(cardOf('FB-000088')).getByText('кредит (наш)')
    const chevronClass = () => chip().querySelector('svg')?.getAttribute('class') ?? ''

    await user.click(chip())
    // Положительный контроль: панель действительно развернулась — продукт
    // печатает только карта класса А, в строке его нет.
    expect(await within(cardOf('FB-000088')).findByText('PDL-UA-30')).toBeInTheDocument()
    expect(chevronClass()).toContain('rotate-180')

    await user.click(chip())
    expect(
      within(cardOf('FB-000088')).queryByText('PDL-UA-30'),
      'второй клик по чипу не свернул панель — разворот необратим'
    ).toBeNull()
    expect(chevronClass()).not.toContain('rotate-180')
  })
})

describe('S-21: успешный разворот — под строкой карта ИМЕННО её договора', () => {
  it('клик по чипу FB-000088 — под ней её карта класса А, и ни следа FB-000090', async () => {
    // Стык «страница → панель» (номер договора и проекции, переданные в
    // `ClientCreditBlock`) не видит ни одна сцена панели: там пропсы подаются
    // руками. Дверь здесь отвечает ОБОИМИ кредитами клиента — ровно как в бою.
    const user = userEvent.setup()
    clientLoansFn.mockResolvedValue({ items: [CARD_FB_000088, CARD_FB_000090], next_cursor: null })
    await renderCard({ rows: [CREDIT_DEBT, SECOND_CREDIT_DEBT, FACTORING_DEBT] })
    await screen.findByText(/LEGACY-55/)

    await user.click(within(cardOf('FB-000088')).getByText('кредит (наш)'))

    // Положительный контроль: под строкой FB-000088 развернулась карта класса А
    // этого договора — продукт и ссылку в модуль строка не печатает.
    const own = cardOf('FB-000088')
    expect(await within(own).findByText('PDL-UA-30')).toBeInTheDocument()
    // Чужая карта проверяется ДО ссылки: развернись под строкой обе, ссылок
    // в модуль стало бы две, и сцена упала бы на «найдено несколько», не
    // назвав предмета.
    expect(
      within(own).queryByText('CA_AB_PAYDAY'),
      'под строкой FB-000088 развернулся и чужой кредит FB-000090'
    ).toBeNull()
    expect(within(own).getByText('Відкрити в кредитному модулі')).toBeInTheDocument()
    expect(
      within(cardOf('FB-000090')).queryByText('CA_AB_PAYDAY'),
      'клик по одному чипу развернул панели под всеми кредитными строками'
    ).toBeNull()
    // Панель под второй строкой не смонтирована вовсе — не только без карты.
    expect(within(cardOf('FB-000090')).queryByText('Продукт')).toBeNull()
  })
})

describe('S-17: множество статусов проекции — предмет договора, а не догадки', () => {
  /**
   * 🔴 Правило секции (`LoansCardList`: `status === 'closed'` → «Закриті»,
   * иначе «Відкриті») верно РОВНО для тех значений, которые проекция шлёт
   * сегодня. Замер CM-L2 (`crm_projection.PROJECTED_STATUS`): в CRM едут
   * только `active` и `closed` — `charged_off` приезжает как `active`, а
   * `written_off`/`cancelled`/`withdrawn`/`disbursement_failed` как `closed`;
   * нюанс стадии живёт в `lifecycle_detail`. Расширение множества на стороне
   * модуля доехало бы сюда молча, и третий статус тихо лёг бы в «Відкриті».
   */
  const PROJECTED_STATUSES = ['active', 'closed'] as const

  it('договор на два значения пинуется здесь', () => {
    expect(
      [...PROJECTED_STATUSES],
      'проекция начала слать третий статус — решите ЗДЕСЬ, в какую секцию он идёт, ' +
        'а не оставляйте правилу «всё, что не closed, — открытое»'
    ).toEqual(['active', 'closed'])
  })

  it('значение вне множества читается как открытое — и сцена его называет', async () => {
    const status = 'delinquent'
    await renderCard({ rows: [{ ...CREDIT_DEBT, status } as unknown as DebtDetail] })

    const open = (await screen.findByText('Відкриті позики')).closest('div') as HTMLElement
    expect(
      within(open).queryByText('1'),
      `статус '${status}' вне договорного множества прочитан как ОТКРЫТЫЙ`
    ).toBeInTheDocument()
    expect(screen.getByText(/FB-000088/)).toBeInTheDocument()
  })
})

describe('S-9: пометка «опознан по e-mail» стоит там, где ИНН нет', () => {
  it('identity_key=email — на месте ИНН объяснение', async () => {
    await renderCard({ profile: { ...PROFILE, tax_id: null, identity_key: 'email' } })
    await screen.findByText('Опізнаний за e-mail (OTP кабінету)')
  })

  it('identity_key=tin — поведение не меняется ни на символ', async () => {
    await renderCard({ profile: PROFILE })
    await screen.findByText('1234567890')
    expect(screen.queryByText('Опізнаний за e-mail (OTP кабінету)')).toBeNull()
  })

  it('поля identity_key нет вовсе (старый бэкенд) — пометки тоже нет', async () => {
    const withoutKey: Record<string, unknown> = { ...PROFILE }
    delete withoutKey.identity_key
    await renderCard({ profile: { ...withoutKey, tax_id: null } })
    // Положительный контроль: строка ИНН на экране есть, то есть «пометки
    // нет» сказано о существующей строке.
    await waitFor(() => expect(screen.queryByText('ІПН')).not.toBeNull())
    expect(screen.queryByText('Опізнаний за e-mail (OTP кабінету)')).toBeNull()
  })
})

describe('S-15: клиент без ИНН не роняет карточку', () => {
  it('tax_id=null рендерится без исключения и без слов null/undefined', async () => {
    const { container } = await renderCard({
      profile: { ...PROFILE, tax_id: null, identity_key: 'email' },
    })
    await screen.findByText('Опізнаний за e-mail (OTP кабінету)')
    const text = container.textContent ?? ''
    expect(text).not.toContain('null')
    expect(text).not.toContain('undefined')
  })
})

describe('S-14: лента активности называет вкладку словом, а не ключом состояния', () => {
  it('запись client_card_section_open с section=credit читается подписью вкладки', async () => {
    // Переключение вкладки пишется в эту же ленту, и незамапленное имя
    // отрисовалось бы оператору сырым словом `credit`.
    const spy = vi.spyOn(activityLogModule, 'useClientActivityLog')
    spy.mockReturnValue({
      data: {
        client_id: 42,
        entries: [
          {
            id: 'events:1',
            ts: '2026-09-22T08:00:00Z',
            source: 'events',
            kind: 'client_card_section_open',
            operator_id: 1,
            operator_name: 'Оператор',
            summary: null,
            detail: { meta: { section: 'credit' } },
          },
          {
            id: 'events:2',
            ts: '2026-09-22T08:01:00Z',
            source: 'events',
            kind: 'client_card_section_open',
            operator_id: 1,
            operator_name: 'Оператор',
            summary: null,
            detail: { meta: { section: 'loans' } },
          },
        ],
        degraded: [],
        total: 2,
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof activityLogModule.useClientActivityLog>)

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(
      <ClientActivityLogTab clientId={42} isActive onPlayRecording={vi.fn()} />,
      { wrapper: wrapper(client) }
    )

    const text = container.textContent ?? ''
    // Положительный контроль: соседняя запись читается подписью своей вкладки,
    // значит лента вообще отрисована и маппинг работает.
    expect(text).toContain("Відкрито вкладку 'Позики'")
    expect(text).toContain("Відкрито вкладку 'Кредит (наш)'")
    spy.mockRestore()
  })
})

describe('KAN-1617: тип договора покупки в строке «Позики» — через маппер страницы', () => {
  /**
   * Купленный долг в форме ответа client-service после истории 1: у долга своя
   * копия типа (её печатает зона 4), у вложенного договора — свой тип (им
   * подписана дата договора). Здесь они РАЗНЫЕ намеренно: так видно, какое поле
   * читает каждое место. В жизни они расходятся, только если тип договора
   * исправили отдельно от копий (задача доски #1619).
   */
  const CESSION_DEBT = {
    ...FACTORING_DEBT,
    id: 9010,
    contract_number: 'CESSION-1',
    sale_type: 'cession',
    factoring_agreement_id: 77,
    factoring_agreement: {
      id: 77,
      agreement_number: '30-09-26ФБ',
      contract_purchase_date: '2026-09-30',
      sale_type: 'factoring',
    },
  } as unknown as DebtDetail

  /** Строка, записанная старым образом: копии у долга нет, тип знает только договор. */
  const AGREEMENT_ONLY_DEBT = {
    ...FACTORING_DEBT,
    id: 9011,
    contract_number: 'OLD-FA-1',
    factoring_agreement_id: 78,
    factoring_agreement: {
      id: 78,
      agreement_number: '12-03-25ФБ',
      contract_purchase_date: '2025-03-12',
      sale_type: 'factoring',
    },
  } as unknown as DebtDetail

  /** Значение зоны 4 карточки: соседний узел подписи «Тип договору». */
  const saleTypeOf = (card: HTMLElement) =>
    within(card).getByText('Тип договору', { selector: 'span' }).nextElementSibling?.textContent

  it('зона 4 — тип долга «Цесія», подпись даты — тип договора «за ДФ»', async () => {
    await renderCard({ rows: [CESSION_DEBT] })
    await screen.findByText(/CESSION-1/)
    const card = cardOf('CESSION-1')

    expect(saleTypeOf(card), 'зона 4 взяла тип не из копии долга').toBe('Цесія')
    // Дата — договора, и назвать она должна его тип, а не копию долга.
    expect(within(card).getByText('Дата купівлі за ДФ')).toBeInTheDocument()
    expect(
      within(card).queryByText('Дата купівлі (відступлення)'),
      'дата договора факторинга подписана по копии долга'
    ).toBeNull()
  })

  /** Договор, у которого тип не задан: копия у долга есть, у договора — NULL. */
  const UNTYPED_AGREEMENT_DEBT = {
    ...FACTORING_DEBT,
    id: 9012,
    contract_number: 'UNTYPED-FA-1',
    sale_type: 'cession',
    factoring_agreement_id: 79,
    factoring_agreement: {
      id: 79,
      agreement_number: '01-08-26ФБ',
      contract_purchase_date: '2026-08-01',
      sale_type: null,
    },
  } as unknown as DebtDetail

  it('договор без типа: зона 4 «Цесія» по копии долга, подпись даты без названия договора', async () => {
    await renderCard({ rows: [UNTYPED_AGREEMENT_DEBT] })
    await screen.findByText(/UNTYPED-FA-1/)
    const card = cardOf('UNTYPED-FA-1')

    expect(saleTypeOf(card)).toBe('Цесія')
    expect(within(card).getByText('Дата купівлі')).toBeInTheDocument()
    expect(within(card).queryByText('Дата купівлі за ДФ')).toBeNull()
    expect(within(card).queryByText('Дата купівлі (відступлення)')).toBeNull()
  })

  it('без копии у долга тип берётся у договора: «Факторинг» и «Дата купівлі за ДФ»', async () => {
    await renderCard({ rows: [AGREEMENT_ONLY_DEBT] })
    await screen.findByText(/OLD-FA-1/)
    const card = cardOf('OLD-FA-1')

    expect(saleTypeOf(card), 'пустая копия у долга напечатана прочерком').toBe('Факторинг')
    expect(within(card).getByText('Дата купівлі за ДФ')).toBeInTheDocument()
  })
})
