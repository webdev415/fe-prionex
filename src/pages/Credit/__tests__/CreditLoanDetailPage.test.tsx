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
// Словарь корзин импортируется, а не переписывается списком: переписанный
// повторил бы опечатку кода и зеленел бы вместе с ней (сцена J-1).
import { CREDIT_BUCKETS } from '@/features/credit/api/enums'
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
    render(
      <MemoryRouter>
        <CreditLoanDetailPage />
      </MemoryRouter>
    )
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
