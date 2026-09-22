/**
 * Врезка блока «Кредит (наш)» в карточку клиента — сцены S-5, S-6, S-9, S-10,
 * S-14, S-15.
 *
 * Сцены идут ПО КАРТОЧКЕ ЦЕЛИКОМ, а не по копии правила рядом: предмет здесь —
 * «строки нет в «Позики» и она есть в блоке», а это утверждение об экране.
 * Правило, проверенное на собственной копии, чинит двойника, а не класс.
 *
 * Мокаются ИСТОЧНИКИ ДАННЫХ карточки, а не её логика: профиль, долги и соседние
 * разделы приходят заглушками, а фильтр проекции, гейт вкладки и подпись в
 * ленте — настоящие.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { DebtDetail } from '@/features/clients/api/types'
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

/** Долг, который в CRM записал кредитный модуль. */
const CREDIT_DEBT = {
  id: 9001,
  seller_company: '',
  contract_number: 'FB-000088',
  original_debt_amount: '5000.00',
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
 * Долг с НЕИЗВЕСТНЫМ источником — контроль правила «по значению, а не по
 * отрицанию». Правило, написанное как «всё, что не факторинг», утащило бы его
 * в блок кредита и убрало из взыскания, хотя про этот источник не известно
 * ничего.
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

beforeEach(() => {
  vi.clearAllMocks()
  creditFlag.mockReturnValue(true)
  clientLoansFn.mockResolvedValue({ items: [], next_cursor: null })
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('S-5/S-6: строка проекции уходит из «Позики» ровно тогда, когда её показывает блок', () => {
  it('флаг включён: кредитного долга в «Позики» нет, купленный остаётся', async () => {
    await renderCard({ rows: [CREDIT_DEBT, FACTORING_DEBT] })

    // положительный контроль: купленный долг на месте, то есть список
    // отрисован и «строки нет» сказано о непустом экране
    await screen.findByText(/LEGACY-55/)
    expect(screen.queryByText(/FB-000088/)).toBeNull()
  })

  it('флаг выключен: вкладки нет, и кредитный долг остаётся в «Позики»', async () => {
    creditFlag.mockReturnValue(false)
    const { container } = await renderCard({ rows: [CREDIT_DEBT, FACTORING_DEBT] })

    await screen.findByText(/LEGACY-55/)
    // Долг никуда не делся — иначе оператор потерял бы его с экрана целиком.
    expect(screen.getByText(/FB-000088/)).toBeInTheDocument()
    // Положительный контроль: полоса вкладок отрисована, то есть «вкладки
    // «Кредит» нет» сказано о существующей полосе, а не о пустом экране.
    expect(container.querySelector('[data-tab="loans"]')).toBeTruthy()
    expect(container.querySelector('[data-tab="credit"]')).toBeNull()
    expect(clientLoansFn).not.toHaveBeenCalled()
  })
})

describe('S-10: запрос в модуль не уходит до открытия вкладки', () => {
  it('на вкладке «Позики» — ноль вызовов, после клика по «Кредит (наш)» — один', async () => {
    const user = userEvent.setup()
    const { container } = await renderCard({ rows: [CREDIT_DEBT] })

    await screen.findByText('Кредит (наш)')
    expect(clientLoansFn).not.toHaveBeenCalled()

    const tab = container.querySelector('[data-tab="credit"]') as HTMLElement
    expect(tab, 'кнопки вкладки нет — кликать нечего').toBeTruthy()
    await user.click(tab)

    await waitFor(() => expect(clientLoansFn).toHaveBeenCalledTimes(1))
    expect(clientLoansFn).toHaveBeenCalledWith(42)
  })

  it('🔴 проекция ПЕРЕНОСИТСЯ: её нет в «Позики», но она есть в блоке', async () => {
    // Второй выход правила, без которого скрытие строки — просто её потеря.
    // Отказ подделывать НЕЛЬЗЯ: блок различает состояния по классу ошибки, и
    // объект с подменённым `name` не является `CreditApiError` — прежняя
    // редакция сцены так и мерила состояние «модуль недоступен», называя это
    // проверкой фолбэка.
    const user = userEvent.setup()
    clientLoansFn.mockRejectedValue(new CreditApiError('forbidden', 403, 'forbidden'))
    const { container } = await renderCard({ rows: [CREDIT_DEBT, FACTORING_DEBT] })

    // в «Позики» кредитного долга нет, купленный на месте
    await screen.findByText(/LEGACY-55/)
    expect(screen.queryByText(/FB-000088/)).toBeNull()

    const tab = container.querySelector('[data-tab="credit"]') as HTMLElement
    await user.click(tab)

    // а в блоке он есть — с номером договора и пометкой проекции
    await screen.findByText(/FB-000088/)
    // Пометки читаются по тексту контейнера: подпись и значение — соседние
    // узлы, и поиск по целой строке через `getByText` их не склеивает.
    const text = container.textContent ?? ''
    expect(text).toContain('Проєкція станом на')
    expect(text).toContain('Повні дані')
    // Плашка называет причину — «прав нет», а не «модуля нет».
    expect(text).toContain('Немає прав на кредитний розділ')
    expect(text).not.toContain('недоступний на цьому стенді')
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
    // Исполнитель цепочек живёт в модалке и монтируется только открытым;
    // список, который ему передаётся, проверяет страж исходника ниже.
    await openCard()
    expect(handedDebts.chainExecutor).toEqual([])
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
   * Две модалки карточки — исполнитель цепочек и панель реструктуризации —
   * монтируются только открытыми, и сценой их список не увидеть, не разобрав
   * пол-карточки. Но предмет здесь не «как выглядит модалка», а «какой список
   * ей отдали», и это читается в исходнике однозначно: ни один потребитель
   * действия не берёт сырой `loans`. Проверка по тексту файла ловит возврат
   * ЛЮБОГО из потребителей, включая те, которых сцена не монтирует, — а
   * регистраторы выше доказывают, что у смонтированных список действительно
   * очищен.
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

  it('контрольная половина: при выключенном блоке действия видят долг снова', async () => {
    // Та же проверка с обратным исходом — значит выше меряется правило, а не
    // то, что строка вообще не доезжает до действий.
    creditFlag.mockReturnValue(false)
    await renderCard({ rows: [CREDIT_DEBT, FACTORING_DEBT] })
    await screen.findByText(/LEGACY-55/)
    expect(numbersOf(handedDebts.ubki).sort()).toEqual(['FB-000088', 'LEGACY-55'])
    expect(numbersOf(handedDebts.taHistory).sort()).toEqual(['FB-000088', 'LEGACY-55'])
    expect(numbersOf(handedDebts.interactionOptions).sort()).toEqual(['FB-000088', 'LEGACY-55'])
    expect(numbersOf(handedDebts.sms).sort()).toEqual(['FB-000088', 'LEGACY-55'])
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
