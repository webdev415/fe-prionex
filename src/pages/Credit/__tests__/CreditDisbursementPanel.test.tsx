/**
 * Раздел «Кредитный модуль» → карточка кредита, блок «Хід видачі грошей».
 *
 * Защищаются три вещи, каждая из которых уже стоила денег или доверия.
 *
 * 1. У кредита с неудавшейся выдачей оператор видел ОДИН бейдж «Видача не
 *    пройшла» и больше ничего — при том что причина, даты и признак ожидания
 *    разбора лежали в `/loans/{id}/state`, который карточка и так запрашивает.
 * 2. У нормально выданного кредита блока быть не должно: дата выдачи уже
 *    стоит в паспорте, вторая панель о том же — шум.
 * 3. Код причины обязан быть переведён. Машинное `payout_account_not_pinned`
 *    на экране оператор читает как поломку системы, а не как «решение не
 *    закрепило счёт».
 *
 * Данные блоков `disbursement` скопированы ДОСЛОВНО из живого ответа
 * dev-стенда 31.08.2026 (`GET /api/v1/credit/loans/{id}/state`, кредиты
 * FB-000027, FB-000007, FB-000061). Форму не выдумываем: прошлые дефекты
 * карточки родились ровно из типов, «подтверждавших» несуществующую форму.
 */
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CreditLoanDetailPage } from '../CreditLoanDetailPage'
import * as hooks from '@/features/credit/hooks/useCredit'
import type {
  CreditDisbursement,
  CreditLoanDetail,
  CreditLoanState,
} from '@/features/credit/api/types'

vi.mock('@/features/credit/hooks/useCredit')
// Мок печатает ключ вместе с подставленными значениями: так тест видит не
// только «строка нашлась», но и ЧТО именно в неё ушло — например что причина
// разбора пришла переводом, а не машинным именем.
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
  I18nextProvider: ({ children }: { children: ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useParams: () => ({ loanId: 'fcf0d53f-d778-4042-8113-1780936c76ab' }),
}))

/** Живой снимок: FB-000027, деньги ушли и ВЕРНУЛИСЬ (`reversed`). */
const REVERSED: CreditDisbursement = {
  state: 'reversed',
  method: 'interac',
  settled_at: '2026-08-31T12:51:24.903371+00:00',
  failed_at: '2026-08-31T12:51:25.445029+00:00',
  failure_code: 'NSF',
  provider: 'mock',
  provider_tx_id: 'mock-zum-6dc78b223ae606208006b01a',
  provider_status: 'Failed',
  client_transaction_id: 'disburse:fcf0d53f-d778-4042-8113-1780936c76ab:principal',
  amount_minor: 40000,
  currency: 'CAD',
  retry_allowed: true,
  review_reason: null,
  review_raised_at: null,
  provider_time_source: 'provider',
  created_at: '2026-08-31T12:51:04.903371+00:00',
  updated_at: '2026-08-31T12:51:25.471492+00:00',
}

/** Живой снимок: FB-000007, мы сами остановили выплату и ждём человека. */
const REFUSED: CreditDisbursement = {
  state: 'failed',
  method: 'interac',
  settled_at: null,
  failed_at: '2026-08-31T12:18:56.733381+00:00',
  failure_code: 'payout_refused_pending_review',
  provider: 'mock',
  provider_tx_id: null,
  provider_status: null,
  client_transaction_id: 'disburse:f975f1b2-11bd-4ebf-a9af-1096b6c4915e:principal',
  amount_minor: 40000,
  currency: 'CAD',
  retry_allowed: true,
  review_reason: 'payout_account_not_pinned',
  review_raised_at: '2026-08-31T12:18:56.733381+00:00',
  provider_time_source: null,
  created_at: '2026-08-31T12:18:56.708965+00:00',
  updated_at: '2026-08-31T12:18:56.734442+00:00',
}

/** Живой снимок: FB-000061, выдача прошла ровно. */
const SETTLED: CreditDisbursement = {
  state: 'settled',
  method: 'interac',
  settled_at: '2026-08-31T15:53:43.911269+00:00',
  failed_at: null,
  failure_code: null,
  provider: 'mock',
  provider_tx_id: 'mock-zum-650679eebb6cf7680949ece4',
  provider_status: 'Completed',
  client_transaction_id: 'disburse:466f3f4d-5a04-4668-8222-cfccd9d1ac31:principal',
  amount_minor: 30000,
  currency: 'CAD',
  retry_allowed: false,
  review_reason: null,
  review_raised_at: null,
  provider_time_source: 'provider',
  created_at: '2026-08-31T15:53:23.890872+00:00',
  updated_at: '2026-08-31T15:53:43.963550+00:00',
}

const LOAN: CreditLoanDetail = {
  loan_id: 'fcf0d53f-d778-4042-8113-1780936c76ab',
  contract_number: 'FB-000027',
  product_code: 'CA_AB_PAYDAY',
  product_version: '1',
  status: 'disbursement_failed',
  currency: 'CAD',
  principal_minor: 40_000,
  balance_total_minor: 45_600,
  project_id: 1,
  client_id: null,
  debt_id: null,
  application_id: 'a1111111-2222-3333-4444-555555555555',
  origin: 'credit_module',
  jurisdiction: 'CA-AB',
  schedule_version: 1,
  delinquency_days: 0,
  paid_minor: 0,
  disbursed_at: '2026-08-31T12:51:24.903371+00:00',
  maturity_date: '2026-10-12',
}

const idle = { data: undefined, isLoading: false, error: null, refetch: vi.fn() }

function openPassport(
  disbursement: CreditDisbursement | undefined,
  loanOverrides: Partial<CreditLoanDetail> = {},
  // Состояние ЗАПРОСА состояния ядра: панель обязана отличать «попытки не
  // было» от «мы не знаем», а по одному только пустому `disbursement` эти
  // случаи неразличимы.
  stateQuery?: { isLoading?: boolean; error?: unknown }
) {
  const loan = { ...LOAN, ...loanOverrides }
  const state = {
    loan_id: loan.loan_id,
    contract_number: loan.contract_number,
    status: loan.status,
    currency: 'CAD',
    as_of: '2026-08-31',
    paid_minor: 0,
    delinquency: { delinquency_days: 0 },
    balances: { total_due_minor: 45_600, total_charged_minor: 45_600, overdue_minor: 0 },
    flags: { validation_valid: true, delinquency_bucket: 'current' },
    ...(disbursement ? { disbursement } : {}),
  } as unknown as CreditLoanState

  vi.mocked(hooks.useCreditLoan).mockReturnValue({ ...idle, data: loan } as never)
  vi.mocked(hooks.useCreditLoanState).mockReturnValue({
    ...idle,
    data: stateQuery?.error || stateQuery?.isLoading ? undefined : state,
    isLoading: stateQuery?.isLoading ?? false,
    error: stateQuery?.error ?? null,
  } as never)
  for (const hook of [
    hooks.useCreditLoanSchedule,
    hooks.useCreditLoanJournal,
    hooks.useCreditLoanScheduleVersions,
    hooks.useCreditLoanDocuments,
    hooks.useCreditApplication,
  ]) {
    vi.mocked(hook).mockReturnValue(idle as never)
  }
  return render(
    <MemoryRouter>
      <CreditLoanDetailPage />
    </MemoryRouter>
  )
}

/**
 * Значение строки блока ПО ЕЁ ПОДПИСИ.
 *
 * Искать значение самим по себе бесполезно: у возврата дата зачисления и дата
 * отказа отличаются на полсекунды и печатаются одинаково, а «—» на экране
 * десяток. Проверять надо связку «подпись → значение», иначе тест переживёт
 * перепутанные местами поля.
 */
function fieldValue(label: string): string {
  const node = screen.getByText(label)
  return (node.parentElement?.textContent ?? '').replace(label, '').trim()
}

describe('CreditLoanDetailPage → блок «Хід видачі грошей»', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('рисует состояние, даты и коды по живому снимку возврата', () => {
    openPassport(REVERSED)
    // Состояние выплаты — своя шкала, не статус кредита: деньги ВЕРНУЛИСЬ.
    expect(screen.getByText('credit.disbursementState.reversed')).toBeInTheDocument()
    // Даты — в часовом поясе юрисдикции (CA-AB → Edmonton, UTC−6):
    // 12:51 UTC превращается в 06:51 местного.
    expect(fieldValue('credit.fields.settledAt')).toBe('31-08-2026 06:51')
    expect(fieldValue('credit.fields.failedAt')).toBe('31-08-2026 06:51')
    expect(fieldValue('credit.fields.disbursementAmount')).toBe('400.00 CAD')
    expect(fieldValue('credit.fields.disbursementMethod')).toBe('credit.disbursementMethod.interac')
    expect(fieldValue('credit.fields.timeSource')).toBe('credit.providerTimeSource.provider')
    // Ключи операции — оба: их диктуют в поддержку провайдера.
    expect(fieldValue('credit.fields.providerTxId')).toBe('mock-zum-6dc78b223ae606208006b01a')
    expect(fieldValue('credit.fields.clientTransactionId')).toBe(
      'disburse:fcf0d53f-d778-4042-8113-1780936c76ab:principal'
    )
    // Статус провайдера — дословно, без перевода: это чужой словарь, и по нему
    // сверяются с поддержкой рельса буква в букву.
    expect(fieldValue('credit.fields.providerStatus')).toBe('Failed')
  })

  it('честно показывает пустые поля отказа собственного заслона', () => {
    // У выплаты, остановленной нами, провайдер не видел операции вовсе: ни
    // ключа, ни статуса, ни зачисления, ни датировки. «—» здесь — содержание,
    // а не заглушка: оно говорит «до провайдера не дошло».
    openPassport(REFUSED, { status: 'pending_disbursement' })
    expect(fieldValue('credit.fields.settledAt')).toBe('—')
    expect(fieldValue('credit.fields.providerTxId')).toBe('—')
    expect(fieldValue('credit.fields.providerStatus')).toBe('—')
    expect(fieldValue('credit.fields.timeSource')).toBe('—')
    expect(fieldValue('credit.fields.failedAt')).toBe('31-08-2026 06:18')
  })

  it('переводит код причины, а не показывает машинное имя', () => {
    openPassport(REFUSED, {
      loan_id: 'f975f1b2-11bd-4ebf-a9af-1096b6c4915e',
      contract_number: 'FB-000007',
      status: 'pending_disbursement',
    })
    expect(
      screen.getByText('credit.disbursementFailure.payout_refused_pending_review')
    ).toBeInTheDocument()
    // Причина разбора уходит в строку уже ПЕРЕВЕДЁННОЙ: в подстановке стоит
    // ключ словаря, а не сырой `payout_account_not_pinned`.
    expect(
      screen.getByText(
        /disbursementReview reason=credit\.railReviewReason\.payout_account_not_pinned/
      )
    ).toBeInTheDocument()
    // Машинных имён на экране быть не должно ни в каком виде.
    expect(screen.queryByText(/^payout_account_not_pinned$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^payout_refused_pending_review$/)).not.toBeInTheDocument()
  })

  it('не обещает повтор возврату, хотя модуль его «разрешает»', () => {
    // retry_allowed=true, но команда возобновления принимает только `failed`
    // и ответила бы 409 disbursement_not_failed.
    openPassport(REVERSED)
    expect(fieldValue('credit.fields.retry')).toBe('credit.disbursementRetry.notFailed')
    expect(screen.getByText('credit.card.disbursementRetryContradiction')).toBeInTheDocument()
  })

  it('не обещает повтор, пока по операции открыт разбор', () => {
    // retry_allowed=true, но команда ответила бы 409
    // disbursement_review_not_resolved: разбор — не то, что можно обойти.
    openPassport(REFUSED, { status: 'pending_disbursement' })
    expect(fieldValue('credit.fields.retry')).toBe('credit.disbursementRetry.reviewOpen')
    expect(screen.getByText('credit.card.disbursementRetryContradiction')).toBeInTheDocument()
  })

  it('не показывает блок у нормально выданного кредита', () => {
    openPassport(SETTLED, {
      loan_id: '466f3f4d-5a04-4668-8222-cfccd9d1ac31',
      contract_number: 'FB-000061',
      status: 'active',
    })
    expect(screen.queryByText('credit.card.disbursement')).not.toBeInTheDocument()
    expect(screen.queryByText('credit.disbursementState.settled')).not.toBeInTheDocument()
    // Паспорт при этом на месте — исчез именно лишний блок, а не вкладка.
    expect(screen.getByText('credit.card.passport')).toBeInTheDocument()
  })

  it('но показывает его, если у зачисленной выплаты дата ВЫВЕДЕНА нами', () => {
    // От даты выдачи считается двухдневное окно отказа CA s.124.4. «Оценено»
    // и «известно» — разные вещи, и молчать об этом нельзя.
    openPassport({ ...SETTLED, provider_time_source: 'observed' }, { status: 'active' })
    expect(screen.getByText('credit.card.disbursementObservedTime')).toBeInTheDocument()
    expect(screen.getByText('credit.providerTimeSource.observed')).toBeInTheDocument()
  })

  it('D-1 при retry_allowed=false поле остаётся диагностикой, а не гейтом', () => {
    // Флаг модуля `retry_allowed` не управляет ни кнопкой (её нет вовсе), ни
    // уведомлением: уведомление говорит «модуль разрешает повтор, а команда
    // откажет», и при `false` противоречия нет — говорить не о чем.
    // Фикстура SETTLED — единственная в файле с `retry_allowed: false`; блок
    // выдачи делается видимым той же подменой источника времени, что и выше.
    openPassport({ ...SETTLED, provider_time_source: 'observed' }, { status: 'active' })
    expect(screen.queryByText('credit.card.disbursementRetryContradiction')).not.toBeInTheDocument()
    // Положительный контроль: «уведомления нет» сказано о НАРИСОВАННОЙ панели,
    // а не о пустом экране, и поле-диагностика на месте.
    expect(screen.getByText('credit.card.disbursement')).toBeInTheDocument()
    expect(fieldValue('credit.fields.retry')).toBe('credit.disbursementRetry.settled')
  })

  it('у застрявшего кредита без единой попытки говорит это словами', () => {
    openPassport(undefined, { status: 'pending_disbursement' })
    expect(screen.getByText('credit.card.disbursementNotSent')).toBeInTheDocument()
  })

  it('а у живого кредита без блока выплаты панель не рисует', () => {
    openPassport(undefined, { status: 'active' })
    expect(screen.queryByText('credit.card.disbursement')).not.toBeInTheDocument()
  })

  it('пока состояние ядра грузится — не утверждает, что попытки не было', () => {
    // Раньше панель говорила категоричное «виплату ще не відправляли» и во
    // время загрузки, и на упавшем запросе. Оператор передавал это клиенту,
    // тогда как перевод мог уйти и провалиться. Тот же дефект уже был у
    // графика («Графіка ще немає» на упавшем запросе).
    openPassport(undefined, { status: 'disbursement_failed' }, { isLoading: true })

    expect(screen.queryByText(/credit\.card\.disbursementNotSent/)).not.toBeInTheDocument()
  })

  it('запрос упал — говорит «не знаем», а не «переказу не було»', () => {
    openPassport(undefined, { status: 'disbursement_failed' }, { error: new Error('502') })

    expect(screen.getByText(/credit\.card\.disbursementUnknown/)).toBeInTheDocument()
    expect(screen.queryByText(/credit\.card\.disbursementNotSent/)).not.toBeInTheDocument()
  })
})
