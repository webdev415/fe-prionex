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
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CreditLoanDetailPage } from '../CreditLoanDetailPage'
import * as hooks from '@/features/credit/hooks/useCredit'
import type { CreditLoanDetail, CreditLoanState, CreditPayment } from '@/features/credit/api/types'

// Мокаем хуки, а не HTTP: живой QueryClient оставляет таймеры notifyManager,
// которые срабатывают после teardown jsdom и падают в чужом файле.
vi.mock('@/features/credit/hooks/useCredit')
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
  ]) {
    vi.mocked(hook).mockReturnValue(idle as never)
  }
}

function openPayments() {
  render(
    <MemoryRouter>
      <CreditLoanDetailPage />
    </MemoryRouter>
  )
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
    const { container } = render(
      <MemoryRouter>
        <CreditLoanDetailPage />
      </MemoryRouter>
    )
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
    const { container } = render(
      <MemoryRouter>
        <CreditLoanDetailPage />
      </MemoryRouter>
    )
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
    render(
      <MemoryRouter>
        <CreditLoanDetailPage />
      </MemoryRouter>
    )
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
    render(
      <MemoryRouter>
        <CreditLoanDetailPage />
      </MemoryRouter>
    )
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
})
