/**
 * Раздел «Кредитный модуль» → карточка кредита, вкладка «Платежі».
 *
 * Защищается одна вещь, которая ломается молча: СТОРНИРОВАННЫЙ платёж не
 * должен выглядеть как обычный. На живом кредите FB-001788 плитка «Сплачено»
 * показывает 70,00, а таблица — три строки на 154,00: 84,00 расхождения на
 * одном экране, ничем не объяснённые. Это ровно тот разговор «я же платил»,
 * ради которого пункт и заводился: оператор видит три платежа, система
 * считает один.
 */
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, type AxiosResponse } from 'axios'
import { CreditLoanDetailPage } from '../CreditLoanDetailPage'
import { searchClientsByPhoneExact } from '@/api/clientSearchApi'
import { callSmsApi } from '@/features/clients/api/callSmsApi'
import * as hooks from '@/features/credit/hooks/useCredit'
import { CreditApiError } from '@/features/credit/api/creditApi'
import { formatDate, formatDateTime } from '@/lib/formatters'
// Словарь корзин импортируется, а не переписывается списком: переписанный
// повторил бы опечатку кода и зеленел бы вместе с ней (сцена J-1).
import { CREDIT_BUCKETS } from '@/features/credit/api/enums'
import type {
  CreditLoanDetail,
  CreditLoanState,
  CreditPayment,
  CreditRailOperation,
} from '@/features/credit/api/types'
// Словари — статическим импортом, как в i18nKeys.test.ts: сцена «занятые
// слова» сверяет новые подписи с теми, что уже значат другое, по живым
// значениям словаря, а не по переписанным литералам.
import en from '../../../../public/locales/en/common.json'
import es from '../../../../public/locales/es/common.json'
import uk from '../../../../public/locales/uk/common.json'

// Мокаем хуки, а не HTTP: живой QueryClient оставляет таймеры notifyManager,
// которые срабатывают после teardown jsdom и падают в чужом файле.
vi.mock('@/features/credit/hooks/useCredit')
// Поиск клиента CRM по телефону и история звонков/SMS — транспорт, а не хуки: сцены
// ниже проверяют, КУДА карточка ходит, а куда не ходит вовсе.
vi.mock('@/api/clientSearchApi', () => ({ searchClientsByPhoneExact: vi.fn() }))
vi.mock('@/features/clients/api/callSmsApi', () => ({
  callSmsApi: { getClientCalls: vi.fn(), getClientSms: vi.fn() },
}))

// Паспорт кредита ищет клиента CRM по телефону заявки (`CreditClientLink`) — ему
// нужен клиент запросов. `gcTime: Infinity` — без пятиминутного таймера сборки
// кэша: запрос создаётся и выключенным, а таймер пережил бы тест.
const withQuery = (ui: ReactNode) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}
  >
    {ui}
  </QueryClientProvider>
)
// Общий мок в src/test/setup.ts возвращает ГОЛЫЙ КЛЮЧ и подстановку теряет —
// проверять по нему текст бесполезно. Здесь мок печатает ключ вместе с
// подставленными значениями, поэтому тест видит, ЧТО именно ушло в строку:
// дата сторно (02-10) должна прийти из `reversed_on`, а не из даты платежа
// (29-08) — подмена одного поля другим иначе останется незамеченной.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars && typeof vars === 'object'
        ? `${key} ${Object.entries(vars)
            .map(([name, value]) => `${name}=${String(value)}`)
            .join(' ')}`
        : key,
    i18n: { language: 'uk', changeLanguage: vi.fn() },
  }),
  // Эти экспорты нужны src/lib/i18n.ts, который тянется через formatters.
  I18nextProvider: ({ children }: { children: ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useParams: () => ({ loanId: 'e2a959c4-c151-402a-b533-c17b90420c78' }),
}))

const LOAN: CreditLoanDetail = {
  loan_id: 'e2a959c4-c151-402a-b533-c17b90420c78',
  contract_number: 'FB-001788',
  product_code: 'CA_AB_PAYDAY',
  product_version: '1',
  status: 'delinquent',
  currency: 'CAD',
  principal_minor: 40_000,
  balance_total_minor: 51_000,
  project_id: 1,
  client_id: null,
  debt_id: null,
  application_id: 'a1111111-2222-3333-4444-555555555555',
  origin: 'credit_module',
  jurisdiction: 'CA-AB',
  schedule_version: 1,
  delinquency_days: 3,
  advance_refund_excess_minor: 0,
  paid_minor: 7_000,
  disbursed_at: '2026-08-29T09:00:00Z',
  maturity_date: '2026-10-19',
}

/**
 * Снимок ЖИВОГО ответа стенда `GET /loans/{id}/state` (FB-001788), урезанный
 * до полей, которые читает страница. Форму не выдумываем: три прошлых дефекта
 * карточки родились именно из типов, «подтверждавших» несуществующую форму.
 */
const STATE = {
  loan_id: 'e2a959c4-c151-402a-b533-c17b90420c78',
  contract_number: 'FB-001788',
  status: 'delinquent',
  currency: 'CAD',
  paid_minor: 7000,
  delinquency: {
    delinquency_days: 20,
    arrears_flag: true,
    no_contact_flag: false,
  },
  balances: {
    principal_minor: 27200,
    interest_minor: 130,
    fee_minor: 0,
    commission_minor: 0,
    penalty_minor: 0,
    fine_minor: 0,
    overpayment_minor: 0,
    total_due_minor: 27330,
    overdue_minor: 15930,
    principal_charged_minor: 30000,
    interest_charged_minor: 130,
    fee_charged_minor: 4200,
    commission_charged_minor: 0,
    penalty_charged_minor: 0,
    fine_charged_minor: 0,
    total_charged_minor: 34330,
    default_interest_minor: 130,
    nsf_fees_minor: 0,
  },
  flags: {
    validation_valid: true,
    delinquency_bucket: '1-30',
  },
  next_payment: {
    due_date: '2026-10-10',
    amount_minor: 11400,
  },
  payments: [
    {
      payment_id: '15784953-9b21-442a-a4cc-785ef219ce44',
      effective_date: '2026-08-29',
      amount_minor: 5000,
      state: 'reversed',
      reversed_on: '2026-10-02',
      allocation: [
        {
          bucket: 'fee',
          amount_minor: 4200,
        },
        {
          bucket: 'principal',
          amount_minor: 800,
        },
      ],
    },
    {
      payment_id: 'd40f9f31-e1d6-44b4-80b3-3f80162ae293',
      effective_date: '2026-08-29',
      amount_minor: 7000,
      state: 'accepted',
      reversed_on: null,
      allocation: [
        {
          bucket: 'principal',
          amount_minor: 7000,
        },
      ],
    },
    {
      payment_id: 'ee1603b3-a65a-42f4-8ae3-fe9f4bcbf8d5',
      effective_date: '2026-08-29',
      amount_minor: 3400,
      state: 'reversed',
      reversed_on: '2026-09-26',
      allocation: [
        {
          bucket: 'principal',
          amount_minor: 3400,
        },
      ],
    },
  ],
} as unknown as CreditLoanState

const PAYMENTS: CreditPayment[] = STATE.payments as CreditPayment[]

const idle = { data: undefined, isLoading: false, error: null, refetch: vi.fn() }

function mockHooks(payments: CreditPayment[]) {
  const state = { ...STATE, payments } as unknown as CreditLoanState
  vi.mocked(hooks.useCreditLoan).mockReturnValue({
    ...idle,
    data: LOAN,
  } as unknown as ReturnType<typeof hooks.useCreditLoan>)
  vi.mocked(hooks.useCreditLoanState).mockReturnValue({
    ...idle,
    data: state,
  } as unknown as ReturnType<typeof hooks.useCreditLoanState>)
  for (const hook of [
    hooks.useCreditLoanSchedule,
    hooks.useCreditLoanJournal,
    hooks.useCreditLoanScheduleVersions,
    hooks.useCreditLoanDocuments,
    hooks.useCreditApplication,
    // Операции рельса (17-6f): без записи автомок вернул бы `undefined`, и
    // вкладка «Платежі» упала бы не своими словами. `idle` — операций нет,
    // метки нет, таблица платежей как без операций.
    hooks.useCreditLoanRailOperations,
  ]) {
    vi.mocked(hook).mockReturnValue(idle as never)
  }
}

function openPayments() {
  render(<MemoryRouter>{withQuery(<CreditLoanDetailPage />)}</MemoryRouter>)
  // Вкладка — по роли: текст «платіж» встречается и в блоке следующего
  // платежа, и getByText нашёл бы несколько узлов.
  fireEvent.click(screen.getByRole('tab', { name: /Платеж|Платіж|Payment/i }))
}

describe('CreditLoanDetailPage → платежи', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHooks(PAYMENTS)
  })

  it('помечает сторнированный платёж и называет дату возврата', () => {
    openPayments()
    // Дата сторно — учётная из журнала, она НЕ равна дате платежа
    // (платёж 29.08, возврат 02.10) и должна быть на экране именно она.
    expect(screen.getByText(/paymentReversedOn date=02-10-2026/)).toBeInTheDocument()
    expect(screen.getByText(/paymentReversedOn date=26-09-2026/)).toBeInTheDocument()
    // Дата платежа в подпись попасть не должна: это разные события.
    expect(screen.queryByText(/paymentReversedOn date=29-08-2026/)).not.toBeInTheDocument()
  })

  it('отличает сторно не только цветом', () => {
    const { container } = render(<MemoryRouter>{withQuery(<CreditLoanDetailPage />)}</MemoryRouter>)
    fireEvent.click(screen.getByRole('tab', { name: /Платеж|Платіж|Payment/i }))
    // jsdom не применяет Tailwind, поэтому смотрим класс: важно, что
    // зачёркивание есть у сторнированных сумм и его нет у зачтённой —
    // цвет один не читается ни в печати, ни при дальтонизме.
    const struck = container.querySelectorAll('.line-through')
    expect(struck).toHaveLength(2)
    expect([...struck].map((node) => node.textContent)).not.toContain('70.00 CAD')
  })

  it('объясняет расхождение между плиткой «Сплачено» и суммой строк', () => {
    openPayments()
    // 50,00 + 34,00 = 84,00 — ровно разница между 154,00 в таблице и 70,00
    // в плитке. Без этой строки расхождение выглядит ошибкой системы.
    expect(screen.getByText(/paymentsReversedHint .*count=2 .*amount=84[.,]00/)).toBeInTheDocument()
  })

  it('не помечает обычные платежи', () => {
    vi.clearAllMocks()
    mockHooks([PAYMENTS[1]])
    const { container } = render(<MemoryRouter>{withQuery(<CreditLoanDetailPage />)}</MemoryRouter>)
    fireEvent.click(screen.getByRole('tab', { name: /Платеж|Платіж|Payment/i }))
    expect(container.querySelectorAll('.line-through')).toHaveLength(0)
    expect(screen.queryByText(/paymentsReversedHint/)).not.toBeInTheDocument()
  })
})

describe('CreditLoanDetailPage → журнал проводок', () => {
  const entry = (over: Record<string, unknown>) => ({
    entry_id: `e-${String(over.seq)}`,
    seq: 1,
    entry_type: 'reversal',
    bucket: 'principal',
    amount_minor: 3_400,
    currency: 'CAD',
    business_date: '2026-09-26',
    posted_at: '2026-09-26T10:00:00Z',
    ...over,
  })

  function renderJournal(items: Array<ReturnType<typeof entry>>) {
    vi.clearAllMocks()
    mockHooks(PAYMENTS)
    vi.mocked(hooks.useCreditLoanJournal).mockReturnValue({
      ...idle,
      data: { items, total: items.length },
    } as never)
    render(<MemoryRouter>{withQuery(<CreditLoanDetailPage />)}</MemoryRouter>)
    fireEvent.click(screen.getByRole('tab', { name: /Журнал|Journal/i }))
  }

  it('не подписывает сторно словом «сторно» дважды', () => {
    // Тип уже называет проводку сторнированием; пометка рядом давала
    // «Сторнування (сторно)» — оператор читает это как две разные вещи.
    renderJournal([entry({ seq: 2, reversal_of_entry_id: 'e-1' })])
    expect(screen.queryByText(/card\.isReversal/)).not.toBeInTheDocument()
  })

  it('но помечает компенсирующую проводку, если по типу этого не видно', () => {
    // `cancellation` со ссылкой на оригинал — тоже компенсирующая, и без
    // пометки её не отличить от самостоятельной отмены.
    renderJournal([entry({ seq: 3, entry_type: 'cancellation', reversal_of_entry_id: 'e-1' })])
    expect(screen.getByText(/card\.isReversal/)).toBeInTheDocument()
  })

  it('J-13 колонки не слипаются: у каждой, кроме последней, правый отступ — в заголовке и в строке', () => {
    // «Сума» выровнена вправо, «Правило» — влево: без отступа между ними на
    // экране стояло «СумаПравило» и «400,00 CADdisbursement». jsdom вёрстку не
    // считает, поэтому смотрим класс — тот же `pr-3`, что у таблицы документов.
    renderJournal([entry({ seq: 1, rule_id: 'disbursement' })])
    const amount = screen.getByRole('columnheader', { name: 'credit.columns.amount' })
    const table = amount.closest('table')
    if (!table) throw new Error('таблицы журнала нет')
    const headers = [...table.querySelectorAll('thead th')]
    const cells = [...table.querySelectorAll('tbody tr:first-child td')]
    // Контроль выборки: шесть колонок, последняя — «Правило», строка той же ширины.
    expect(headers.map((th) => th.textContent)).toEqual([
      'credit.columns.date',
      'credit.columns.entryType',
      'credit.columns.bucket',
      'credit.columns.installment',
      'credit.columns.amount',
      'credit.columns.rule',
    ])
    expect(cells).toHaveLength(headers.length)
    const column = headers.indexOf(amount)
    expect(amount.classList.contains('pr-3'), 'у заголовка «Сума» нет правого отступа').toBe(true)
    expect(cells[column].classList.contains('pr-3'), 'у суммы в строке нет правого отступа').toBe(
      true
    )
    const withoutPadding = [...headers.slice(0, -1), ...cells.slice(0, -1)]
      .filter((node) => !node.classList.contains('pr-3'))
      .map((node) => node.textContent)
    expect(withoutPadding).toEqual([])
    // У последней колонки отступа нет: справа от неё соседа нет, а у таблицы
    // во всю ширину он отнял бы место у «Правило».
    expect(headers.at(-1)?.classList.contains('pr-3'), 'у заголовка «Правило» правый отступ').toBe(
      false
    )
    expect(cells.at(-1)?.classList.contains('pr-3'), 'у правила в строке правый отступ').toBe(false)
  })

  /**
   * Отбор по корзине — сцены J-1…J-12 story 11-4b.
   *
   * Мок хука ВЕДЁТ СЕБЯ КАК СЕРВЕР: отдаёт разный набор в зависимости от
   * параметров. Клиентского `filter` в экране нет и быть не должно — иначе
   * «в корзине пусто» означало бы «записи за шестидесятой строкой».
   *
   * ⚠️ Ручка строки — `rule_id`: `entry_id` на экране не печатается вовсе, а
   * по типу и корзине строки A и B неразличимы. Деньги как ручку брать нельзя —
   * их формат задаёт `money()` и локаль.
   */
  function renderJournalFiltered(
    all: Array<ReturnType<typeof entry>>,
    filtered: Array<ReturnType<typeof entry>>,
    // Состояние ответа ПОД ФИЛЬТРОМ поверх `data` — например, загрузка (J-11).
    filteredState: Record<string, unknown> = {}
  ) {
    vi.clearAllMocks()
    mockHooks(PAYMENTS)
    vi.mocked(hooks.useCreditLoanJournal).mockImplementation(
      (_loanId, params) =>
        ({
          ...idle,
          data: { items: params?.bucket ? filtered : all },
          ...(params?.bucket ? filteredState : {}),
        }) as never
    )
    render(<MemoryRouter>{withQuery(<CreditLoanDetailPage />)}</MemoryRouter>)
    fireEvent.click(screen.getByRole('tab', { name: /Журнал|Journal/i }))
  }

  const A = entry({
    seq: 1,
    entry_type: 'accrual',
    bucket: 'penalty',
    rule_id: 'A-row',
    entry_id: 'A',
  })
  const B = entry({
    seq: 2,
    entry_type: 'accrual',
    bucket: 'penalty',
    rule_id: 'B-row',
    entry_id: 'B',
  })
  const RA = entry({
    seq: 3,
    entry_type: 'reversal',
    bucket: 'penalty',
    rule_id: 'RA-row',
    entry_id: 'RA',
    reversal_of_entry_id: 'A',
  })

  const row = (handle: string) => screen.getByText(handle).closest('tr') as HTMLElement

  it('J-1 селектор корзин собран из словаря кода, а не из литералов', () => {
    // Значения сверяются с САМОЙ константой: переписанный в тест список
    // повторил бы опечатку кода и зеленел бы вместе с ней, а дверь на
    // неизвестную корзину отвечает 200 с пустым `items` — оператор прочитал бы
    // опечатку как «в корзине проводок нет».
    renderJournal([])
    const options = screen.getAllByRole('option') as HTMLOptionElement[]
    expect(options).toHaveLength(1 + CREDIT_BUCKETS.length)
    expect(options.map((option) => option.value)).toEqual(['', ...CREDIT_BUCKETS])
    // Точное совпадение, а не `toContain`: ключ `credit.filters.any` является
    // подстрокой `credit.filters.anyBucket`, и подстрочная проверка зеленела бы
    // при обоих.
    expect(
      options[0].textContent,
      'the "any bucket" option does not carry its own label credit.filters.anyBucket'
    ).toBe('credit.filters.anyBucket')
    // Подписи корзин — из словаря: мок печатает ключ, поэтому машинное имя на
    // экране (`principal`) отличимо от подписи (`credit.bucket.principal`).
    expect(
      options.slice(1).map((option) => option.textContent),
      'the bucket options show machine names (principal, …) instead of credit.bucket.* labels'
    ).toEqual(CREDIT_BUCKETS.map((name) => `credit.bucket.${name}`))
  })

  it('J-2 выбор корзины уходит в хук параметром, а не остаётся на экране', () => {
    renderJournalFiltered([A, B, RA], [A])
    const calls = vi.mocked(hooks.useCreditLoanJournal).mock.calls
    // До смены — без параметров: «все корзины» не строят объект вовсе.
    expect(calls[0][1]).toBeUndefined()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'penalty' } })
    const last = vi.mocked(hooks.useCreditLoanJournal).mock.calls.at(-1)
    expect(last?.[1]?.bucket, 'the chosen bucket did not reach the hook').toBe('penalty')
    // Строго, а не `toEqual`: лишний ключ со значением `undefined` (`as_of`)
    // `toEqual` пропустил бы — та же ловушка, что у транспорта (A-4).
    expect(
      last?.[1],
      'the page sent the hook more than the chosen bucket — an extra key rides along'
    ).toStrictEqual({ bucket: 'penalty' })
    expect(last?.[0]).toBe('e2a959c4-c151-402a-b533-c17b90420c78')
  })

  it('J-3 экран показывает ровно то, что вернул сервер, — сам не режет', () => {
    // Мок отдаёт под фильтром ДВЕ записи из трёх; будь на экране клиентский
    // `filter` по корзине, третья (из другой корзины) исчезла бы и до фильтра.
    const other = entry({ seq: 4, bucket: 'principal', rule_id: 'C-row', entry_id: 'C' })
    renderJournalFiltered([A, B, other], [A, other])
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'penalty' } })
    expect(document.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(screen.getByText('A-row')).toBeInTheDocument()
    // Строка ЧУЖОЙ корзины пришла от сервера — и экран её не выбрасывает.
    expect(screen.getByText('C-row')).toBeInTheDocument()
  })

  it('J-4 пустой результат фильтра говорит про корзину, и селектор остаётся', () => {
    renderJournalFiltered([], [])
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'penalty' } })
    // Точное совпадение: `credit.card.noJournal` — подстрока
    // `credit.card.noJournalInBucket`, и regexp дал бы ложный зелёный.
    expect(screen.getByText('credit.card.noJournalInBucket')).toBeInTheDocument()
    expect(screen.queryByText('credit.card.noJournal')).not.toBeInTheDocument()
    // Селектор живёт НАД панелью: иначе фильтр исчезал бы ровно тогда, когда
    // его результат пуст, и снять его было бы нечем, кроме перезагрузки.
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    // Пометка — свойство выборки, и пустая выборка её не отменяет (AC-6.3):
    // она тоже живёт над панелью, а не в её `children`.
    expect(
      screen.queryByText('credit.card.journalBucketReversalUnknown'),
      'under an active filter with an empty result the selection notice is gone — it moved inside AsyncPanel'
    ).not.toBeNull()
  })

  it('J-9 «все корзины» снимает фильтр: хук без параметров, пометки нет', () => {
    renderJournalFiltered([A, B, RA], [A])
    const select = screen.getByRole('combobox') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'penalty' } })
    // Положительный контроль: фильтр действительно стоял — строка одна, и
    // пометка на экране, так что её отсутствие ниже что-то значит.
    expect(screen.queryByText('B-row')).toBeNull()
    expect(screen.getByText('credit.card.journalBucketReversalUnknown')).toBeInTheDocument()
    fireEvent.change(select, { target: { value: '' } })
    const last = vi.mocked(hooks.useCreditLoanJournal).mock.calls.at(-1)
    // Именно `undefined`, а не `{ bucket: '' }` и не `{}`: «все корзины» не
    // строят объект параметров вовсе (AC-4.5).
    expect(
      last?.[1],
      'choosing "any bucket" left the filter on penalty — the operator is locked in the bucket'
    ).toBeUndefined()
    expect(select.value).toBe('')
    expect(screen.queryByText('credit.card.journalBucketReversalUnknown')).not.toBeInTheDocument()
    // Положительный контроль: на экране снова весь журнал.
    expect(screen.getByText('A-row')).toBeInTheDocument()
    expect(screen.getByText('B-row')).toBeInTheDocument()
    expect(screen.getByText('RA-row')).toBeInTheDocument()
  })

  it('J-5 пустой журнал без фильтра говорит про журнал, а не про корзину', () => {
    renderJournalFiltered([], [])
    expect(screen.getByText('credit.card.noJournal')).toBeInTheDocument()
    expect(screen.queryByText('credit.card.noJournalInBucket')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('J-6 под фильтром: пришедшая пара зачёркнута, панель предупреждает о выборке', () => {
    renderJournalFiltered([A, B, RA], [A, B, RA])
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'penalty' } })
    expect(row('A-row').className).toContain('line-through')
    // B не зачёркнута: её компенсирующей записи в ответе нет — и именно про
    // это молчание говорит пометка.
    expect(row('B-row').className).not.toContain('line-through')
    expect(screen.getByText('credit.card.journalBucketReversalUnknown')).toBeInTheDocument()
    // Положительный контроль: все три строки нарисованы, сцена не зеленеет на
    // пустой таблице.
    expect(screen.getByText('RA-row')).toBeInTheDocument()
  })

  it('J-7 без фильтра: пара цела, и панель ничего не утверждает про выборку', () => {
    renderJournalFiltered([A, B, RA], [A, B, RA])
    expect(screen.getByText('A-row')).toBeInTheDocument()
    expect(screen.getByText('RA-row')).toBeInTheDocument()
    expect(row('A-row').className).toContain('line-through')
    expect(screen.queryByText('credit.card.journalBucketReversalUnknown')).not.toBeInTheDocument()
  })

  it('J-8 второй ключ порядка — posted_at, а не seq', () => {
    // Порядки ПРОТИВОПОЛОЖНЫ: по `seq` сверху была бы `early-row`. Модуль
    // нумерует `seq` после отбора, и под фильтром он означает не то, что обещает.
    const late = entry({
      seq: 1,
      rule_id: 'late-row',
      business_date: '2026-09-26',
      posted_at: '2026-09-26T18:00:00Z',
      entry_id: 'late',
    })
    const early = entry({
      seq: 2,
      rule_id: 'early-row',
      business_date: '2026-09-26',
      posted_at: '2026-09-26T09:00:00Z',
      entry_id: 'early',
    })
    renderJournal([early, late])
    const rows = [...document.querySelectorAll('tbody tr')].map((node) => node.textContent)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain('late-row')
    expect(rows[1]).toContain('early-row')
  })

  it('J-10 смена корзины возвращает срез в шестьдесят строк', () => {
    // Раскрытый в одной корзине список не должен отключать `PAGE` в следующей:
    // иначе кнопка «показать ещё» пропадает, а журнал рисуется целиком.
    const sixtyOne = (tag: string, bucket: string) =>
      Array.from({ length: 61 }, (_, index) =>
        entry({
          seq: index + 1,
          entry_type: 'accrual',
          bucket,
          rule_id: `${tag}-row-${index}`,
          entry_id: `${tag}-${index}`,
        })
      )
    renderJournalFiltered(sixtyOne('all', 'principal'), sixtyOne('pen', 'penalty'))
    fireEvent.click(screen.getByRole('button', { name: 'credit.actions.showMore' }))
    // Положительный контроль: раскрытие до смены действительно дало все 61.
    expect(document.querySelectorAll('tbody tr')).toHaveLength(61)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'penalty' } })
    expect(
      document.querySelectorAll('tbody tr'),
      'under a new bucket all 61 rows are drawn and the show-more button is gone — the 60-row slice carried over from the previous bucket'
    ).toHaveLength(60)
    expect(screen.getByText('credit.card.journalShown shown=60 total=61')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'credit.actions.showMore' })).toBeInTheDocument()
  })

  it('J-11 пока грузится выборка под фильтром, селектор и пометка на экране', () => {
    renderJournalFiltered([A, B, RA], [], { isLoading: true, data: undefined })
    // Положительный контроль исходного режима: без фильтра журнал нарисован.
    expect(screen.getByText('A-row')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'penalty' } })
    expect(
      screen.queryByRole('combobox'),
      'the bucket selector vanished while the filtered journal loads — the operator cannot change the filter mid-request'
    ).not.toBeNull()
    expect(
      screen.queryByText('credit.card.journalBucketReversalUnknown'),
      'while the filtered journal loads the selection notice is gone — it moved inside AsyncPanel'
    ).not.toBeNull()
    // Положительный контроль состояния: панель журнала именно ГРУЗИТСЯ — в ней
    // скелет, а не строки и не текст пустоты.
    const panel = screen
      .getByRole('heading', { name: 'credit.tabs.journal' })
      .closest('section') as HTMLElement
    expect(panel.querySelector('.animate-pulse')).not.toBeNull()
    expect(screen.queryByText('A-row')).toBeNull()
    expect(screen.queryByText('credit.card.noJournal')).toBeNull()
    expect(screen.queryByText('credit.card.noJournalInBucket')).toBeNull()
  })

  it('J-12 ничья по posted_at разбирается порядком записи, а не порядком ответа', () => {
    // Проводки одной операции пишутся одной транзакцией и несут одно
    // `posted_at` — ничья обычна. Вход в порядке двери (`ORDER BY id`, старые
    // первыми); сверху обязана быть более поздняя запись, как во всём журнале.
    const tie = { business_date: '2026-09-26', posted_at: '2026-09-26T10:00:00+00:00' }
    const first = entry({
      ...tie,
      seq: 1,
      entry_type: 'accrual',
      rule_id: 'first-row',
      entry_id: 'first',
    })
    const second = entry({
      ...tie,
      seq: 2,
      entry_type: 'accrual',
      rule_id: 'second-row',
      entry_id: 'second',
    })
    renderJournal([first, second])
    const rows = [...document.querySelectorAll('tbody tr')].map((node) => node.textContent)
    expect(rows).toHaveLength(2)
    expect(
      rows[0],
      'a posted_at tie was ordered as the response came, not by ledger order — the third sort key is gone'
    ).toContain('second-row')
    expect(rows[1]).toContain('first-row')
  })
})

/**
 * Паспорт кредита: идентификаторы и возраст.
 *
 * CEO считал, что «идентификатор кредита» оператору уже виден. Виден был
 * только номер договора (FB-000074) — а разработчик в логах модуля ищет по
 * `loan_id`, и UUID существовал единственно в адресной строке. Возраст же
 * («сколько дней кредит живёт») модуль не отдаёт вообще: единственный счётчик
 * дней в контракте — просрочка.
 */
describe('CreditLoanDetailPage → паспорт', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHooks(PAYMENTS)
  })

  function openPassport() {
    render(<MemoryRouter>{withQuery(<CreditLoanDetailPage />)}</MemoryRouter>)
  }

  it('показывает UUID кредита и заявки — их диктуют, а не кликают', () => {
    openPassport()
    expect(screen.getByText('e2a959c4-c151-402a-b533-c17b90420c78')).toBeInTheDocument()
    expect(screen.getByText('a1111111-2222-3333-4444-555555555555')).toBeInTheDocument()
  })

  it('даёт кнопку копирования на каждый идентификатор', () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    openPassport()
    const rows = screen.getByText('credit.card.identifiers').closest('section')
    const buttons = rows ? [...rows.querySelectorAll('button')] : []
    expect(buttons).toHaveLength(2)
    fireEvent.click(buttons[0])
    expect(writeText).toHaveBeenCalledWith('e2a959c4-c151-402a-b533-c17b90420c78')
  })

  it('срез сервиса на возраст НЕ влияет — считаем по календарю юрисдикции', () => {
    // Здесь раньше стоял тест ровно на обратное: «считать до среза `as_of`».
    // Довод звучал разумно (иначе возраст и просрочка окажутся на разные
    // даты), но `as_of` равен горизонту ночного расчёта и уходит ВПЕРЁД: на
    // живом стенде кредиты, выданные 31.08, имели срез 04.10. Оператор увидел
    // бы «34 днів з видачі» там, где клиент в своём кабинете видит «1 день».
    //
    // Правило теперь одно на обе стороны — календарные дни до сегодня в
    // юрисдикции (web-credit/apps/cabinet/src/components/loan-age.ts). Срез,
    // ушедший на две недели вперёд, обязан оставить возраст в покое.
    vi.mocked(hooks.useCreditLoanState).mockReturnValue({
      ...idle,
      data: { ...STATE, as_of: '2026-09-12' } as unknown as CreditLoanState,
    } as unknown as ReturnType<typeof hooks.useCreditLoanState>)
    openPassport()

    const row = screen.getByText('credit.fields.loanAgeDays').parentElement
    // 14 — это счёт «до среза». Его быть не должно ни при каком «сегодня».
    expect(row?.textContent).not.toContain('14')
  })

  it('деньги показываются ТОЛЬКО из состояния ядра — того же расчёта, что видит клиент', () => {
    // Клиент в кабинете видит сумму из расчёта модуля. Если оператор возьмёт
    // её из поля займа, они назовут РАЗНЫЕ деньги — и это хуже, чем не
    // показать ничего. Поле займа тут вдобавок приходит пустым: живой модуль
    // отдаёт `balance_total_minor: null` (проверено на FB-000088), так что
    // прежний «запасной путь» давал правду случайно, а не по замыслу.
    vi.mocked(hooks.useCreditLoanState).mockReturnValue({
      ...idle,
      data: undefined,
    } as unknown as ReturnType<typeof hooks.useCreditLoanState>)
    openPassport()

    // 51 000 minor = 510,00 — сумма из ПОЛЯ ЗАЙМА в фикстуре. Именно её и
    // подставлял прежний запасной путь; на экране её быть не должно.
    const row = screen.getByText('credit.fields.balance').parentElement
    expect(row?.textContent).not.toMatch(/510[,.\s]*00/)
    // И положительная половина: без состояния показываем прочерк, а не число.
    expect(row?.textContent).toContain('—')
  })
})

/**
 * Излишек возврата — деньги, которые МОДУЛЬ должен клиенту (T-FE-6-03).
 *
 * Два поля живут в двух ответах: излишек `advance_refund_excess_minor` — в
 * паспорте (`useCreditLoan`), переплата `overpayment_minor` — в состоянии
 * ядра (`useCreditLoanState`). Числа разные и в STATE не встречаются: излишек
 * 12 345 (123,45), переплата 6 789 (67,89) — иначе сцена не различила бы, из
 * какого ответа взята сумма. Синтетика «оба > 0» контрактом у одного кредита
 * невозможна, поэтому рядом реальная форма модуля (`funding_exception`,
 * переплата 0) и обратная (излишек 0, переплата есть).
 */
describe('CreditLoanDetailPage → излишек возврата (обязательство перед клиентом)', () => {
  // Два семейства якорей: «показано деньгами» требует десятичный разделитель и
  // валюту ответа, а «встречается где-либо» свободен, потому что строгий якорь
  // в `not.toMatch` ослеп бы к утечке сырых minor «12345». Литерал выведен из
  // числа фикстуры и `LOAN.currency`, не из форматтера.
  const shown = (major: string) =>
    new RegExp(`(?<![\\d,.])${major.replace('.', '[,.]')} ${LOAN.currency}`)
  const EXCESS_SHOWN = shown('123.45')
  const OVERPAYMENT_SHOWN = shown('67.89')
  const BALANCE_SHOWN = shown('273.30')
  const EXCESS = /123[,.\s]*45/
  const OVERPAYMENT = /67[,.\s]*89/
  const notMoney = (where: string) =>
    `${where} does not show 123,45 ${LOAN.currency} from the passport: another amount, raw minor units or no currency`

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function open(loan: CreditLoanDetail, overpayment = 0, withState = true) {
    mockHooks(PAYMENTS)
    vi.mocked(hooks.useCreditLoan).mockReturnValue({
      ...idle,
      data: loan,
    } as unknown as ReturnType<typeof hooks.useCreditLoan>)
    const state = withState
      ? ({
          ...STATE,
          balances: { ...STATE.balances, overpayment_minor: overpayment },
        } as unknown as CreditLoanState)
      : undefined
    vi.mocked(hooks.useCreditLoanState).mockReturnValue({
      ...idle,
      data: state,
    } as unknown as ReturnType<typeof hooks.useCreditLoanState>)
    return render(<MemoryRouter>{withQuery(<CreditLoanDetailPage />)}</MemoryRouter>)
  }

  const openBalances = () =>
    fireEvent.click(screen.getByRole('tab', { name: 'credit.tabs.balances' }))
  const section = (key: string) => screen.getByText(key).closest('section')

  it('X-1: строка излишка берёт сумму из паспорта, а переплата остаётся в «Складові боргу»', () => {
    open({ ...LOAN, advance_refund_excess_minor: 12_345 }, 6_789)

    const row = screen.getByText('credit.fields.advanceRefundExcess').parentElement
    expect(row?.textContent, notMoney('the owed-to-client row')).toMatch(EXCESS_SHOWN)
    expect(row?.textContent).not.toMatch(OVERPAYMENT)

    openBalances()
    const balances = section('credit.card.balances')
    expect(balances?.textContent).toMatch(OVERPAYMENT_SHOWN)
    expect(balances?.textContent).not.toMatch(EXCESS)
    expect(balances?.textContent).not.toContain('credit.fields.advanceRefundExcess')
  })

  it('X-2: реальная форма модуля — своя панель, пояснение, без тона тревоги и без «Переплати»', () => {
    open({ ...LOAN, status: 'funding_exception', advance_refund_excess_minor: 12_345 }, 0)

    const panel = section('credit.card.owedToClient')
    expect(panel).not.toBeNull()
    expect(panel?.textContent, notMoney('the owed-to-client panel')).toMatch(EXCESS_SHOWN)
    expect(panel?.textContent).toContain('credit.card.owedToClientHint')
    expect(panel?.textContent).not.toContain('credit.bucket.overpayment')
    // Токены тревоги раздела и базовые красные/жёлтые семейства.
    const alarm = ['error', 'danger', 'warning', 'red-', 'destructive', 'amber', 'yellow']
      .map((family) => `[class*="${family}"]`)
      .join(', ')
    expect(panel?.querySelector(alarm), 'alarm tone inside the owed-to-client panel').toBeNull()
    // Цвет наследуется: класс на самой секции или на обёртке красит сумму не
    // хуже класса на ней самой — поэтому секция и все предки до <html>.
    for (let el: Element | null = panel; el; el = el.parentElement) {
      expect(
        el.matches(alarm),
        `alarm tone on <${el.tagName.toLowerCase()} class="${el.className}"> — the owed-to-client panel or its ancestor paints the sum as the client's debt`
      ).toBe(false)
    }
    // Контроль селектора: на той же странице тревожный узел есть (плитка
    // просрочки) — пустота выше значит «в панели нет», а не «селектор слеп».
    expect(document.querySelector(alarm)).not.toBeNull()

    openBalances()
    const balances = section('credit.card.balances')
    expect(balances?.textContent).toContain('credit.fields.totalDue')
    expect(balances?.textContent).not.toMatch(EXCESS)
    expect(balances?.textContent).not.toContain('credit.bucket.overpayment')
  })

  it('X-3: излишка нет, переплата есть — панели нет, переплата на своём месте', () => {
    open({ ...LOAN, advance_refund_excess_minor: 0 }, 6_789)

    expect(screen.queryByText('credit.card.owedToClient')).toBeNull()
    // У панели два заголовка (Р-610b-6), а имя величины есть в обеих формах —
    // подписью поля и заголовком «не знаем»: без него форма «не знаем» невидима.
    expect(
      screen.queryAllByText('credit.fields.advanceRefundExcess'),
      'a loan without excess shows the owed-to-client panel under the name of the quantity — its unknown form or a zero sum'
    ).toHaveLength(0)
    expect(screen.getByText('credit.card.passport')).toBeInTheDocument()

    openBalances()
    const balances = section('credit.card.balances')
    expect(balances?.textContent).toMatch(OVERPAYMENT_SHOWN)
    expect(balances?.textContent).toContain('credit.bucket.overpayment')
  })

  it('X-4: отстающий модуль без ключа — панель говорит «не знаем», а не «излишка нет»', () => {
    const lagging: Partial<CreditLoanDetail> = { ...LOAN }
    delete lagging.advance_refund_excess_minor
    expect('advance_refund_excess_minor' in LOAN).toBe(true)
    expect('advance_refund_excess_minor' in lagging).toBe(false)

    open(lagging as CreditLoanDetail)

    // Заголовок — имя величины: «Винні клієнту» утверждал бы обязательство,
    // о котором тело панели говорит «не знаем».
    expect(
      screen.queryByText('credit.card.owedToClient'),
      'the unknown-state panel is titled «owed to the client» — the title asserts an obligation the body says we do not know'
    ).toBeNull()
    expect(
      screen.queryByText('credit.fields.advanceRefundExcess'),
      'no panel without the key — the screen says «no excess» where it does not know'
    ).not.toBeNull()
    const panel = section('credit.fields.advanceRefundExcess')
    expect(panel?.textContent).toContain('credit.card.owedToClientUnknown')
    // Суммы нет вовсе: прочерк-сумма читалась бы как «пусто».
    expect(panel?.textContent).not.toContain('—')
    expect(panel?.textContent).not.toMatch(/\d/)
  })

  it('X-5: без состояния ядра панель излишка на месте — она читает только паспорт', () => {
    open({ ...LOAN, advance_refund_excess_minor: 12_345 }, 0, false)

    // Контроль: состояния действительно нет — плитка баланса пуста.
    expect(screen.getByText('credit.fields.balance').parentElement?.textContent).toContain('—')
    const panel = section('credit.card.owedToClient')
    expect(panel?.textContent, notMoney('the owed-to-client panel without /state')).toMatch(
      EXCESS_SHOWN
    )
  })

  it('X-6: излишек не попадает в плитки шапки и не живёт нигде, кроме своей панели', () => {
    open({ ...LOAN, advance_refund_excess_minor: 12_345 }, 6_789)

    const tile = (key: string) => screen.getByText(key).parentElement?.textContent
    for (const key of [
      'credit.fields.balance',
      'credit.fields.paid',
      'credit.fields.nextPayment',
      'credit.fields.overdue',
    ]) {
      expect(tile(key), key).not.toMatch(EXCESS)
    }
    // Контроль: баланс — это total_due_minor состояния, 27 330 → 273,30.
    expect(tile('credit.fields.balance')).toMatch(BALANCE_SHOWN)

    const panel = section('credit.card.owedToClient')
    const hits = screen.getAllByText(EXCESS)
    expect(hits.length).toBeGreaterThan(0)
    for (const hit of hits) expect(hit.closest('section')).toBe(panel)
  })

  it('X-7: на вкладке «Складові боргу» панели излишка нет и суммы его нет', () => {
    open({ ...LOAN, status: 'funding_exception', advance_refund_excess_minor: 12_345 }, 0)
    openBalances()

    expect(screen.getByText('credit.card.balances')).toBeInTheDocument()
    expect(screen.queryByText('credit.card.owedToClient')).toBeNull()
    expect(document.body.textContent).not.toMatch(EXCESS)
  })

  it('X-8: новые подписи не повторяют слов, которые в разделе уже значат другое', () => {
    // Структура, а не `typeof uk`: так компилятор требует каждый ключ в ОБОИХ
    // словарях, не сверяя остальные тысячи строк между собой.
    type Words = {
      credit: {
        card: { owedToClient: string; owedToClientHint: string; owedToClientUnknown: string }
        fields: { advanceRefundExcess: string; supersedesDecision: string }
        columns: { payable: string }
        metrics: { payable: string }
        entryType: { refund: string }
        bucket: { overpayment: string }
      }
    }
    const fresh = (d: Words) => [
      d.credit.card.owedToClient,
      d.credit.card.owedToClientHint,
      d.credit.card.owedToClientUnknown,
      d.credit.fields.advanceRefundExcess,
      d.credit.fields.supersedesDecision,
    ]
    // «До повернення» — долг заёмщика; «Повернення клієнту» — совершённый
    // возврат журнала; en «Refund due» — соседнее поле модуля
    // refund_due_to_borrower_minor. Читаются из словаря, не литералом.
    const taken = (d: Words) => [
      d.credit.columns.payable,
      d.credit.metrics.payable,
      d.credit.entryType.refund,
    ]
    const cases: Array<[string, Words, string[]]> = [
      ['uk', uk, taken(uk)],
      ['en', en, [...taken(en), 'Refund due']],
    ]
    // Контроль: занятые фразы в словаре есть и те самые.
    expect(uk.credit.columns.payable).toContain('До повернення')
    expect(uk.credit.entryType.refund).toContain('Повернення клієнту')
    expect(uk.credit.bucket.overpayment).toContain('Переплата')
    expect(en.credit.bucket.overpayment).toContain('Overpayment')
    // «Переплата» — составляющая долга из `/state`. Подписи (то, что оператор
    // читает как имя суммы) её не повторяют. Законный случай — подсказка: она
    // называет переплату, чтобы её отрицать (AC-7), поэтому сверяется отдельно.
    const labels = (d: Words) => [
      d.credit.card.owedToClient,
      d.credit.fields.advanceRefundExcess,
      d.credit.fields.supersedesDecision,
    ]
    expect(uk.credit.card.owedToClientHint.toLowerCase()).toContain('не переплата')
    expect(en.credit.card.owedToClientHint.toLowerCase()).toContain('not an overpayment')

    for (const [lang, dict, busy] of cases) {
      const overpayment = dict.credit.bucket.overpayment
      for (const label of labels(dict)) {
        expect(
          label.toLowerCase(),
          `${lang}: «${label}» ⊃ «${overpayment}» — the label calls the module's obligation an overpayment`
        ).not.toContain(overpayment.toLowerCase())
      }
      const values = fresh(dict)
      expect(values, lang).toHaveLength(5)
      for (const phrase of busy) expect(phrase, `${lang}: занятая фраза`).toBeTruthy()
      for (const value of values) {
        expect(value, `${lang}: пустая подпись`).toBeTruthy()
        for (const phrase of busy) {
          expect(value.toLowerCase(), `${lang}: «${value}» ⊃ «${phrase}»`).not.toContain(
            phrase.toLowerCase()
          )
        }
      }
    }
  })
})

/**
 * Связь кредита с клиентом CRM — вместо ложного «створюється при укладенні
 * договору».
 *
 * Клиента CRM для канадского заёмщика не создаст никто, поэтому карточка кредита
 * ищет его так же, как карточка заявки: по телефону заявки, с честным «не
 * шукали». Три состояния заявки различаются: грузится (не «телефону немає»), не
 * получена (не «телефону немає» и без поиска), получена. Звонки и SMS в карточку
 * кредита не добавлены — они живут в карточке заявки.
 */
describe('CreditLoanDetailPage → связь с клиентом CRM', () => {
  // Синтетика: вымышленный номер NANP (станция 555, абонентская часть 01xx).
  const PHONE = '+14035550123'

  beforeEach(() => {
    vi.clearAllMocks()
    mockHooks(PAYMENTS)
    vi.mocked(searchClientsByPhoneExact).mockResolvedValue([])
  })

  function withApplication(application: Partial<Record<string, unknown>>, rest = {}) {
    vi.mocked(hooks.useCreditApplication).mockReturnValue({
      ...idle,
      data: { draft: {}, client_email: null, ...application },
      ...rest,
    } as never)
  }

  function openPassport() {
    render(<MemoryRouter>{withQuery(<CreditLoanDetailPage />)}</MemoryRouter>)
  }

  const clientRow = () => screen.getByText('credit.fields.clientId').parentElement

  it('L-1: без client_id ищет клиента по телефону заявки; «створюється…» нет', async () => {
    withApplication({ client_phone: PHONE })
    openPassport()
    await waitFor(() => expect(searchClientsByPhoneExact).toHaveBeenCalledWith(PHONE))
    expect(await screen.findByText('credit.clientLink.notFound')).toBeInTheDocument()
    expect(screen.queryByText('credit.card.clientPending')).not.toBeInTheDocument()
  })

  it('L-2: заявка без телефона — «не шукали: телефону немає»', () => {
    withApplication({ client_phone: null })
    openPassport()
    expect(clientRow()?.textContent).toContain('credit.clientLink.notSearched.no_phone')
    expect(searchClientsByPhoneExact).not.toHaveBeenCalled()
  })

  it('L-3: заявка ещё грузится — «шукаємо», а не «телефону немає»', () => {
    vi.mocked(hooks.useCreditApplication).mockReturnValue({ ...idle, isLoading: true } as never)
    openPassport()
    expect(clientRow()?.textContent).toContain('credit.clientLink.notSearched.loading')
    expect(clientRow()?.textContent).not.toContain('credit.clientLink.notSearched.no_phone')
  })

  it('L-4: client_id есть — ссылка на клиента, как раньше', () => {
    vi.mocked(hooks.useCreditLoan).mockReturnValue({
      ...idle,
      data: { ...LOAN, client_id: 5 },
    } as unknown as ReturnType<typeof hooks.useCreditLoan>)
    withApplication({ client_phone: PHONE })
    openPassport()
    const link = screen.getByRole('link', { name: '#5' })
    expect(link.getAttribute('href')).toBe('/dashboard/clients/5')
    expect(searchClientsByPhoneExact).not.toHaveBeenCalled()
  })

  it.each([
    ['без связи', null],
    ['со связью', 5],
  ] as const)('L-5: %s — звонки и SMS CRM карточка кредита не запрашивает', (_name, clientId) => {
    vi.mocked(hooks.useCreditLoan).mockReturnValue({
      ...idle,
      data: { ...LOAN, client_id: clientId },
    } as unknown as ReturnType<typeof hooks.useCreditLoan>)
    withApplication({ client_phone: PHONE })
    openPassport()
    expect(callSmsApi.getClientCalls).not.toHaveBeenCalled()
    expect(callSmsApi.getClientSms).not.toHaveBeenCalled()
  })

  it.each([
    ['500', 500],
    ['404', 404],
  ] as const)('L-6: заявка не получена (%s) — «телефон невідомий», без поиска', (_name, status) => {
    vi.mocked(hooks.useCreditApplication).mockReturnValue({
      ...idle,
      error: new AxiosError('x', 'ERR_BAD_RESPONSE', undefined, undefined, {
        status,
      } as AxiosResponse),
    } as never)
    openPassport()
    expect(clientRow()?.textContent).toContain('credit.card.borrowerApplicationFailed')
    expect(clientRow()?.textContent).not.toContain('credit.clientLink.notSearched.no_phone')
    expect(searchClientsByPhoneExact).not.toHaveBeenCalled()
  })

  // Своя копия поиска по словарю (`i18nKeys.test.ts`): помощник стража не
  // экспортируется, а сам страж неиспользуемых ключей в общем виде не ловит.
  function lookup(dictionary: unknown, key: string): unknown {
    return key.split('.').reduce<unknown>((node, part) => {
      if (node && typeof node === 'object' && part in node) {
        return (node as Record<string, unknown>)[part]
      }
      return undefined
    }, dictionary)
  }

  it.each([
    ['uk', uk],
    ['en', en],
    ['es', es],
  ] as const)(
    'L-7: %s — ключа прежней строки нет, соседний ключ того же поиска есть',
    (_lang, dictionary) => {
      expect(lookup(dictionary, 'credit.card.clientPending')).toBeUndefined()
      // Положительный контроль ТОГО ЖЕ поиска: иначе «не найдено» выше значило бы
      // «искать не умеем».
      const control = lookup(dictionary, 'credit.card.projectionPending')
      expect(typeof control).toBe('string')
      expect(String(control).trim()).not.toBe('')
    }
  )
})

/**
 * Вкладка «Платежі» → операции Zūm (story 17-6f).
 *
 * Здесь — то, что видно только на странице: где зовётся хук операций, что отказ
 * двери не ломает таблицу платежей, пояс вкладки от юрисдикции кредита и метка
 * «Zūm: передано» в строке платежа со ссылкой на строку операции. Правила ячеек
 * панели — в `CreditRailOperations.test.tsx`. Все данные синтетические.
 */
describe('CreditLoanDetailPage → операции Zūm на вкладке «Платежі»', () => {
  const EDMONTON = 'America/Edmonton'

  /** Полная операция со всеми 30 ключами контракта: пропущенный ключ — ошибка типа. */
  function railOp(overrides: Partial<CreditRailOperation> = {}): CreditRailOperation {
    return {
      client_transaction_id: 'collect:rail-test-0002:1',
      provider: 'zum',
      direction: 'disburse',
      method: 'eft',
      amount_minor: 11_400,
      currency: 'CAD',
      installment_seq: null,
      state: 'settled',
      provider_status: null,
      failure_code: null,
      provider_tx_id: 'zum-test-0002',
      provider_accepted: true,
      // Три момента в разные минуты: подмена одного другим видна по строке.
      rail_call_started_at: '2026-09-24T14:07:00Z',
      rail_call_returned_at: '2026-09-24T14:09:00Z',
      submission: 'rail_called',
      created_at: '2026-09-24T14:05:00Z',
      observed_at: null,
      updated_at: '2026-09-24T14:30:00Z',
      settled_at: null,
      failed_at: null,
      provider_effective_at: null,
      provider_time_source: null,
      review_reason: null,
      review_raised_at: null,
      payment_id: null,
      status_evidence: null,
      callbacks: [],
      callbacks_total: 0,
      events: [],
      events_dropped: 0,
      ...overrides,
    }
  }

  const page = (items: CreditRailOperation[]) => ({ items, total: items.length, next_cursor: null })

  function withRail(value: Record<string, unknown>) {
    vi.mocked(hooks.useCreditLoanRailOperations).mockReturnValue({ ...idle, ...value } as never)
  }

  function renderPage() {
    return render(<MemoryRouter>{withQuery(<CreditLoanDetailPage />)}</MemoryRouter>)
  }

  /** Строки ТАБЛИЦЫ ПЛАТЕЖЕЙ — не панели операций под ней. */
  function paymentRows(): HTMLElement[] {
    const section = screen.getByText('credit.card.payments').closest('section')
    if (!section) throw new Error('панели платежей нет')
    return [...section.querySelectorAll<HTMLElement>('tbody tr')]
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockHooks(PAYMENTS)
  })

  it('AC-2 п. 2 хук операций зовётся только на вкладке «Платежі» — с id кредита', () => {
    renderPage()
    // Открыт паспорт: запроса операций с открытием карточки быть не должно.
    expect(screen.getByText('credit.card.passport')).toBeInTheDocument()
    expect(hooks.useCreditLoanRailOperations).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('tab', { name: /Платеж|Платіж|Payment/i }))
    expect(hooks.useCreditLoanRailOperations).toHaveBeenCalledWith(LOAN.loan_id)
  })

  it('AC-2 п. 3 404 not_found — «модуль старший», без повтора; таблица платежей на месте', () => {
    withRail({ error: new CreditApiError('Not found', 404, 'not_found') })
    openPayments()
    expect(screen.getByText('credit.railOps.unavailable')).toBeInTheDocument()
    expect(screen.queryByText('credit.actions.retry')).not.toBeInTheDocument()
    // Таблица платежей — та же, что без двери: все строки и подпись сторно.
    expect(paymentRows()).toHaveLength(PAYMENTS.length)
    expect(screen.getByText(/paymentReversedOn date=02-10-2026/)).toBeInTheDocument()
  })

  it('AC-6a п. 1 метка «Zūm: передано» — во второй из двух одинаковых строк, со ссылкой на операцию', () => {
    const twin = (id: string): CreditPayment => ({
      payment_id: id,
      effective_date: '2026-09-24',
      amount_minor: 11_400,
      state: 'accepted',
      reversed_on: null,
    })
    mockHooks([twin('p-test-0001'), twin('p-test-0002')])
    const op = railOp({ direction: 'collect', payment_id: 'p-test-0002' })
    withRail({ data: page([op]) })
    openPayments()
    const [firstRow, secondRow] = paymentRows()
    const when = formatDateTime('2026-09-24T14:07:00Z', EDMONTON)
    const mark = within(secondRow).getByText(`credit.railOps.paymentMark.sent when=${when}`)
    const anchor = `rail-op-${encodeURIComponent(op.client_transaction_id)}`
    expect(mark.closest('a')?.getAttribute('href')).toBe(`#${anchor}`)
    expect(
      document.getElementById(anchor),
      'ссылка ведёт на строку, которой в панели нет'
    ).not.toBeNull()
    expect(firstRow.textContent).not.toContain('credit.railOps.paymentMark')
  })

  it('AC-6a п. 2 момента вызова нет — «операція в таблиці нижче», без выдуманного времени', () => {
    const op = railOp({
      direction: 'collect',
      payment_id: PAYMENTS[1].payment_id,
      submission: 'not_recorded',
      rail_call_started_at: null,
    })
    withRail({ data: page([op]) })
    openPayments()
    expect(
      within(paymentRows()[1]).getByText('credit.railOps.paymentMark.linked')
    ).toBeInTheDocument()
    const text = document.body.textContent ?? ''
    expect(text, 'created_at выдан за время отправки').not.toContain(
      formatDateTime('2026-09-24T14:05:00Z', EDMONTON)
    )
    expect(text, 'rail_call_returned_at выдан за время отправки').not.toContain(
      formatDateTime('2026-09-24T14:09:00Z', EDMONTON)
    )
  })

  it('AC-6a п. 3 отказ двери — ни одной метки, ячейки дат как без операций; повтор — хуком операций', () => {
    const linked = railOp({ direction: 'collect', payment_id: PAYMENTS[1].payment_id })
    const expected = PAYMENTS.map((payment) => formatDate(payment.effective_date))
    for (const error of [
      new CreditApiError('Service unavailable', 503),
      new CreditApiError('Not found', 404, 'not_found'),
    ]) {
      // Данные в кэше при этом есть: метку гасит отказ, а не пустота.
      const refetch = vi.fn()
      withRail({ data: page([linked]), error, refetch })
      const view = renderPage()
      fireEvent.click(screen.getByRole('tab', { name: /Платеж|Платіж|Payment/i }))
      expect(screen.queryByText(/credit\.railOps\.paymentMark/)).not.toBeInTheDocument()
      expect(paymentRows().map((row) => row.querySelector('td')?.textContent)).toEqual(expected)
      if (error.status === 503) {
        // Повтор панели зовёт повтор ИМЕННО двери операций, ровно раз: таблица
        // платежей над ней загружена, и её повтора на экране нет.
        fireEvent.click(screen.getByText('credit.actions.retry'))
        expect(refetch, 'кнопка «Повторити» не дошла до хука операций').toHaveBeenCalledTimes(1)
      }
      view.unmount()
    }
  })

  it('AC-6a п. 4 платежи ещё грузятся — ячейка «Платіж» не говорит «не знайдено»', () => {
    vi.mocked(hooks.useCreditLoanState).mockReturnValue({ ...idle, isLoading: true } as never)
    const op = railOp({ direction: 'collect', payment_id: PAYMENTS[1].payment_id })
    withRail({ data: page([op]) })
    openPayments()
    // Положительный контроль: строка операции нарисована — сцена не пустая.
    expect(
      document.getElementById(`rail-op-${encodeURIComponent(op.client_transaction_id)}`)
    ).not.toBeNull()
    expect(screen.queryByText('credit.railOps.payment.notFound')).not.toBeInTheDocument()
  })

  it('AC-6 п. 5–6 пояс вкладки — от юрисдикции кредита; вне карты страницы — умолчание раздела', () => {
    const at = '2026-09-25T02:30:00Z'
    const op = railOp({
      callbacks: [
        {
          received_at: at,
          status: 'Completed',
          failure_code: null,
          signature_ok: true,
          processed_at: at,
          matched_by: 'provider_tx_id',
        },
      ],
      callbacks_total: 1,
    })
    for (const [jurisdiction, zone] of [
      ['CA-ON', 'America/Toronto'],
      ['CA-QC', 'Europe/Kyiv'],
    ] as const) {
      vi.mocked(hooks.useCreditLoan).mockReturnValue({
        ...idle,
        data: { ...LOAN, jurisdiction },
      } as never)
      withRail({ data: page([op]) })
      const view = renderPage()
      fireEvent.click(screen.getByRole('tab', { name: /Платеж|Платіж|Payment/i }))
      expect(screen.getByText(`credit.railOps.footer zone=${zone}`)).toBeInTheDocument()
      expect(screen.getByText(formatDateTime(at, zone))).toBeInTheDocument()
      view.unmount()
    }
  })
})
