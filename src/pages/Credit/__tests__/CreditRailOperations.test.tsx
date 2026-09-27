/**
 * Раздел «Кредитный модуль» → карточка кредита → вкладка «Платежі» → панель
 * «Операції Zūm» (story 17-6f).
 *
 * Защищается то, что оператор говорит клиенту словами: когда деньги ушли в Zūm
 * (и что НЕ уходили), что и когда Zūm ответил, что это значит и чей это код.
 * Ошибка здесь — не косметика: «передано» у остановленной выплаты или «колбеку
 * не було» у пришедшего колбэка — ложный факт о деньгах клиента.
 *
 * Панель хуков не зовёт — ответ двери приходит пропсами, поэтому мок хуков не
 * нужен. Мок `t` печатает ключ с подстановками: утверждения о времени идут по
 * подстановке, ожидание считается той же функцией `formatDateTime` с поясом.
 * Утверждения о содержимом — в пределах СВОЕЙ ячейки (`cellOf`): бейдж
 * «Операції» несёт тот же ключ состояния, что «Розшифровка», и поиск по всей
 * панели не отличил бы одну ячейку от другой. Все данные синтетические.
 */
import type { ComponentProps, ReactNode } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { CreditRailOperations } from '../components/CreditRailOperations'
import { CreditApiError } from '@/features/credit/api/creditApi'
import { formatCreditMoney } from '@/features/credit/api/money'
import type {
  CreditPayment,
  CreditRailCallback,
  CreditRailOperation,
} from '@/features/credit/api/types'
import { formatDate, formatDateTime } from '@/lib/formatters'

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

const ZONE = 'America/Edmonton'
const KEY = 'rail-test-0001'

/** Полная операция со всеми 30 ключами контракта: пропущенный ключ — ошибка типа. */
function railOp(overrides: Partial<CreditRailOperation> = {}): CreditRailOperation {
  return {
    client_transaction_id: KEY,
    provider: 'zum',
    direction: 'disburse',
    method: 'interac',
    amount_minor: 50_000,
    currency: 'CAD',
    installment_seq: null,
    state: 'settled',
    provider_status: null,
    failure_code: null,
    provider_tx_id: 'zum-test-0001',
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

function callback(overrides: Partial<CreditRailCallback> = {}): CreditRailCallback {
  return {
    received_at: '2026-09-25T02:30:00Z',
    status: 'Completed',
    failure_code: null,
    signature_ok: true,
    processed_at: '2026-09-25T02:30:05Z',
    matched_by: 'provider_tx_id',
    ...overrides,
  }
}

/** Операция, которую модуль остановил до отправки (форма S-3 стенда). */
const STOPPED: Partial<CreditRailOperation> = {
  submission: 'stopped_before_send',
  provider_accepted: false,
  provider_tx_id: null,
  state: 'failed',
  failure_code: 'payout_refused_pending_review',
  rail_call_started_at: null,
  rail_call_returned_at: null,
}

/** not_recorded без приёма — явный `null` момента, а не умолчание помощника (Э3.1-7 п. 4). */
const NOT_RECORDED: Partial<CreditRailOperation> = {
  submission: 'not_recorded',
  provider_accepted: false,
  provider_tx_id: null,
  rail_call_started_at: null,
  rail_call_returned_at: null,
}

type Props = ComponentProps<typeof CreditRailOperations>

function renderPanel({
  operations,
  total,
  ...rest
}: Partial<Props> & { operations?: CreditRailOperation[]; total?: number } = {}) {
  const onRetry = vi.fn()
  const page = operations
    ? { items: operations, total: total ?? operations.length, next_cursor: null }
    : undefined
  const view = render(
    <CreditRailOperations
      page={page}
      isLoading={false}
      error={null}
      onRetry={onRetry}
      zone={ZONE}
      payments={[]}
      paymentsReady
      {...rest}
    />
  )
  return { onRetry, ...view }
}

/** Порядок колонок фиксирован: 0 «Операція» … 5 «Платіж». */
const COLUMN = { operation: 0, submitted: 1, callback: 2, events: 3, meaning: 4, payment: 5 }

function cellOf(key: string, column: keyof typeof COLUMN): HTMLElement {
  const row = document.getElementById(`rail-op-${encodeURIComponent(key)}`)
  if (!row) throw new Error(`строки операции ${key} нет в панели`)
  const cell = row.querySelectorAll('td')[COLUMN[column]]
  if (!cell) throw new Error(`у строки ${key} нет колонки ${column}`)
  return cell
}

/** Моменты, которых на экране быть не должно ни в одной сцене «передано». */
function expectNoWrongMoments(op: CreditRailOperation) {
  const text = document.body.textContent ?? ''
  expect(text, 'created_at на экране — время заведения строки выдано за отправку').not.toContain(
    formatDateTime(op.created_at, ZONE)
  )
  if (op.rail_call_returned_at) {
    expect(
      text,
      'rail_call_returned_at на экране — «вызов вернулся» выдан за отправку'
    ).not.toContain(formatDateTime(op.rail_call_returned_at, ZONE))
  }
}

describe('CreditRailOperations → каркас панели', () => {
  it('колонки идут в фиксированном порядке', () => {
    renderPanel({ operations: [railOp()] })
    const headers = [...document.querySelectorAll('thead th')].map((th) => th.textContent)
    expect(headers).toEqual([
      'credit.railOps.columns.operation',
      'credit.railOps.columns.submitted',
      'credit.railOps.columns.callback',
      'credit.railOps.columns.events',
      'credit.railOps.columns.meaning',
      'credit.railOps.columns.payment',
    ])
  })
})

describe('CreditRailOperations → отказы двери (AC-2)', () => {
  it('п. 3 404 not_found — «модуль старший», без повтора и без «пусто»', () => {
    renderPanel({ error: new CreditApiError('Not found', 404, 'not_found') })
    expect(screen.getByText('credit.railOps.unavailable')).toBeInTheDocument()
    expect(screen.queryByText('credit.actions.retry')).not.toBeInTheDocument()
    expect(screen.queryByText('credit.railOps.empty')).not.toBeInTheDocument()
  })

  it('п. 3 404 без кода (шлюз) — обычный отказ с повтором, не «модуль старший»', () => {
    renderPanel({ error: new CreditApiError('Request failed with status code 404', 404) })
    expect(screen.queryByText('credit.railOps.unavailable')).not.toBeInTheDocument()
    expect(screen.getByText('credit.actions.retry')).toBeInTheDocument()
  })

  it('п. 4 прочий отказ — сообщение и «Повторити», нажатие зовёт повтор ровно раз', () => {
    const { onRetry } = renderPanel({ error: new CreditApiError('Service unavailable', 503) })
    expect(screen.getByText('Service unavailable')).toBeInTheDocument()
    fireEvent.click(screen.getByText('credit.actions.retry'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('п. 4 пусто — «операцій ще не було»; загрузка — скелет', () => {
    const { unmount } = renderPanel({ operations: [] })
    expect(screen.getByText('credit.railOps.empty')).toBeInTheDocument()
    unmount()
    const { container } = renderPanel({ isLoading: true })
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
    expect(screen.queryByText('credit.railOps.empty')).not.toBeInTheDocument()
  })

  it('п. 5 total больше строк — «показано N з M»; при равенстве строки нет', () => {
    const ops = ['a', 'b', 'c'].map((suffix) =>
      railOp({ client_transaction_id: `${KEY}-${suffix}` })
    )
    const { unmount } = renderPanel({ operations: ops, total: 5 })
    expect(screen.getByText('credit.railOps.truncated shown=3 total=5')).toBeInTheDocument()
    unmount()
    renderPanel({ operations: ops, total: 3 })
    expect(screen.queryByText(/credit\.railOps\.truncated/)).not.toBeInTheDocument()
  })
})

describe('CreditRailOperations → «Передано в Zūm» (AC-3)', () => {
  const sentAt = formatDateTime('2026-09-24T14:07:00Z', ZONE)

  it('п. 1 rail_called + принят, settled — время начала вызова, без «не підтвердив»', () => {
    const op = railOp()
    renderPanel({ operations: [op] })
    const cell = cellOf(KEY, 'submitted')
    expect(within(cell).getByText(sentAt)).toBeInTheDocument()
    expect(within(cell).queryByText('credit.railOps.submission.notAcknowledged')).toBeNull()
    expectNoWrongMoments(op)
  })

  it('п. 2 rail_called, не принят, unknown + transport_error — время и «не підтвердив»', () => {
    const op = railOp({
      provider_accepted: false,
      provider_tx_id: null,
      state: 'unknown',
      failure_code: 'transport_error',
      rail_call_returned_at: null,
    })
    renderPanel({ operations: [op] })
    const cell = cellOf(KEY, 'submitted')
    expect(within(cell).getByText(sentAt)).toBeInTheDocument()
    expect(within(cell).getByText('credit.railOps.submission.notAcknowledged')).toBeInTheDocument()
    expectNoWrongMoments(op)
  })

  it('п. 3 not_recorded + принят, settled — «передано, час не записано»', () => {
    const op = railOp({ submission: 'not_recorded', rail_call_started_at: null })
    renderPanel({ operations: [op] })
    expect(cellOf(KEY, 'submitted').textContent).toBe('credit.railOps.submission.notRecorded')
    expectNoWrongMoments(op)
  })

  it('п. 4 stopped_before_send, наш отказ — «не відправлялась»', () => {
    const op = railOp(STOPPED)
    renderPanel({ operations: [op] })
    expect(cellOf(KEY, 'submitted').textContent).toBe('credit.railOps.submission.notSent')
    expectNoWrongMoments(op)
  })

  it('п. 5 not_recorded, не принят, failed + transport_error — «невідомо», не «не відправлялась»', () => {
    const op = railOp({ ...NOT_RECORDED, state: 'failed', failure_code: 'transport_error' })
    renderPanel({ operations: [op] })
    expect(cellOf(KEY, 'submitted').textContent).toBe('credit.railOps.submission.unknown')
    expectNoWrongMoments(op)
  })

  it('п. 6 not_recorded, не принят, pending — «ще не передано»', () => {
    const op = railOp({ ...NOT_RECORDED, state: 'pending' })
    renderPanel({ operations: [op] })
    expect(cellOf(KEY, 'submitted').textContent).toBe('credit.railOps.submission.notYet')
    expectNoWrongMoments(op)
  })

  it('п. 7 not_recorded, не принят, unknown без кода — «невідомо»', () => {
    const op = railOp({ ...NOT_RECORDED, state: 'unknown' })
    renderPanel({ operations: [op] })
    expect(cellOf(KEY, 'submitted').textContent).toBe('credit.railOps.submission.unknown')
    expectNoWrongMoments(op)
  })

  it('п. 8 пример (г): остановлено до отправки при заданном моменте вызова — ни времени, ни «не підтвердив»', () => {
    const op = railOp({
      submission: 'stopped_before_send',
      provider_accepted: false,
      provider_tx_id: null,
      state: 'unknown',
      failure_code: 'rail_limit_exceeded',
      rail_call_returned_at: null,
    })
    renderPanel({ operations: [op] })
    const cell = cellOf(KEY, 'submitted')
    expect(cell.textContent).toBe('credit.railOps.submission.notSent')
    expect(document.body.textContent).not.toContain(sentAt)
    expect(within(cell).queryByText('credit.railOps.submission.notAcknowledged')).toBeNull()
  })

  it('п. 9 противоречивая пара: остановлено, но принят — «передано, час не записано»', () => {
    const op = railOp({
      submission: 'stopped_before_send',
      state: 'failed',
      failure_code: 'invalid_amount',
      rail_call_started_at: null,
    })
    renderPanel({ operations: [op] })
    expect(cellOf(KEY, 'submitted').textContent).toBe('credit.railOps.submission.notRecorded')
  })

  it('п. 10 rail_called, не принят, no_token — время и «не підтвердив» (не «не відправлялась»)', () => {
    const op = railOp({
      provider_accepted: false,
      provider_tx_id: null,
      state: 'failed',
      failure_code: 'no_token',
      rail_call_returned_at: null,
    })
    renderPanel({ operations: [op] })
    const cell = cellOf(KEY, 'submitted')
    expect(within(cell).getByText(sentAt)).toBeInTheDocument()
    expect(within(cell).getByText('credit.railOps.submission.notAcknowledged')).toBeInTheDocument()
  })

  it('п. 11 после сверки NotFound: остановленная — «не відправлялась», not_recorded — «невідомо»', () => {
    const after = { provider_status: 'NotFound', state: 'failed' as const }
    const { unmount } = renderPanel({
      operations: [railOp({ ...STOPPED, ...after, failure_code: 'rail_limit_exceeded' })],
    })
    expect(cellOf(KEY, 'submitted').textContent).toBe('credit.railOps.submission.notSent')
    unmount()
    renderPanel({
      operations: [railOp({ ...NOT_RECORDED, ...after, failure_code: 'provider_never_created' })],
    })
    expect(cellOf(KEY, 'submitted').textContent).toBe('credit.railOps.submission.unknown')
  })
})

describe('CreditRailOperations → колбэк (AC-4)', () => {
  it('п. 1–2 два колбэка — обе строки в порядке ответа: время в поясе, текст и слово дословно', () => {
    renderPanel({
      operations: [
        railOp({
          callbacks: [
            callback({ received_at: '2026-09-25T02:30:00Z', status: 'Completed' }),
            callback({ received_at: '2026-09-26T09:15:00Z', status: 'Failed' }),
          ],
          callbacks_total: 2,
        }),
      ],
    })
    const items = within(cellOf(KEY, 'callback')).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(
      within(items[0]).getByText(formatDateTime('2026-09-25T02:30:00Z', ZONE))
    ).toBeInTheDocument()
    expect(within(items[0]).getByText('credit.zumStatus.Completed')).toBeInTheDocument()
    expect(
      within(items[0]).getByText('credit.railOps.status.label status=Completed')
    ).toBeInTheDocument()
    expect(
      within(items[1]).getByText(formatDateTime('2026-09-26T09:15:00Z', ZONE))
    ).toBeInTheDocument()
    expect(within(items[1]).getByText('credit.zumStatus.Failed')).toBeInTheDocument()
    expect(
      within(items[1]).getByText('credit.railOps.status.label status=Failed')
    ).toBeInTheDocument()
  })

  it('п. 3 подпись не сошлась, применён — «підпис не збігся», без «не оброблено»', () => {
    renderPanel({
      operations: [railOp({ callbacks: [callback({ signature_ok: false })], callbacks_total: 1 })],
    })
    const cell = cellOf(KEY, 'callback')
    expect(within(cell).getByText('credit.railOps.callback.signatureMismatch')).toBeInTheDocument()
    expect(within(cell).queryByText('credit.railOps.callback.notProcessed')).toBeNull()
  })

  it('п. 3 подпись сошлась, не применён — «ще не оброблено», без «підпис не збігся»', () => {
    renderPanel({
      operations: [railOp({ callbacks: [callback({ processed_at: null })], callbacks_total: 1 })],
    })
    const cell = cellOf(KEY, 'callback')
    expect(within(cell).getByText('credit.railOps.callback.notProcessed')).toBeInTheDocument()
    expect(within(cell).queryByText('credit.railOps.callback.signatureMismatch')).toBeNull()
  })

  it.each<[string, Partial<CreditRailOperation>, string]>([
    ['settled без observed_at', {}, 'credit.railOps.callback.none'],
    [
      'failed + transport_error без приёма',
      { ...NOT_RECORDED, state: 'failed', failure_code: 'transport_error' },
      'credit.railOps.callback.none',
    ],
    ['pending', { ...NOT_RECORDED, state: 'pending' }, 'credit.railOps.callback.waiting'],
    [
      'unknown без приёма',
      { ...NOT_RECORDED, state: 'unknown' },
      'credit.railOps.callback.awaitingReconciliation',
    ],
    ['unknown с приёмом', { state: 'unknown' }, 'credit.railOps.callback.awaitingReconciliation'],
    ['не отправлялась', STOPPED, '—'],
  ])('п. 4 колбэков нет: %s → своя фраза', (_name, overrides, expected) => {
    renderPanel({ operations: [railOp(overrides)] })
    expect(cellOf(KEY, 'callback').textContent).toBe(expected)
  })

  it('п. 4 колбэков нет, исход узнан — «востаннє <час>», без голого «колбеку не було»', () => {
    renderPanel({ operations: [railOp({ observed_at: '2026-09-24T15:00:00Z' })] })
    expect(cellOf(KEY, 'callback').textContent).toBe(
      `credit.railOps.callback.noneObserved when=${formatDateTime('2026-09-24T15:00:00Z', ZONE)}`
    )
  })

  it('п. 5 незнакомый статус — «Невідомий статус: X»', () => {
    renderPanel({
      operations: [
        railOp({ callbacks: [callback({ status: 'Frobnicated' })], callbacks_total: 1 }),
      ],
    })
    const cell = cellOf(KEY, 'callback')
    expect(
      within(cell).getByText('credit.railOps.status.unknown status=Frobnicated')
    ).toBeInTheDocument()
    expect(within(cell).queryByText(/^Frobnicated$/)).toBeNull()
  })

  it('п. 6 код Zūm в колбэке виден рядом с нашим кодом операции', () => {
    renderPanel({
      operations: [
        railOp({
          ...STOPPED,
          callbacks: [callback({ status: 'Failed', failure_code: 'EftFailedInsufficientFunds' })],
          callbacks_total: 1,
        }),
      ],
    })
    const inCallback = within(cellOf(KEY, 'callback'))
    expect(
      inCallback.getByText('credit.railFailure.EftFailedInsufficientFunds')
    ).toBeInTheDocument()
    expect(
      inCallback.getByText('credit.railOps.code.zum code=EftFailedInsufficientFunds')
    ).toBeInTheDocument()
    const inMeaning = within(cellOf(KEY, 'meaning'))
    expect(
      inMeaning.getByText('credit.railFailure.payout_refused_pending_review')
    ).toBeInTheDocument()
    expect(
      inMeaning.getByText('credit.railOps.code.module code=payout_refused_pending_review')
    ).toBeInTheDocument()
  })

  it.each([
    ['остановленная, rail_limit_exceeded', { ...STOPPED, failure_code: 'rail_limit_exceeded' }],
    [
      'not_recorded, provider_never_created',
      { ...NOT_RECORDED, state: 'failed' as const, failure_code: 'provider_never_created' },
    ],
  ])('п. 7 NotFound после сверки (%s): сперва код, затем слово модуля', (_name, overrides) => {
    const op = railOp({ ...overrides, provider_status: 'NotFound' })
    renderPanel({ operations: [op] })
    const cell = cellOf(KEY, 'meaning')
    const code = op.failure_code as string
    const text = cell.textContent ?? ''
    expect(within(cell).getByText(`credit.railFailure.${code}`)).toBeInTheDocument()
    expect(within(cell).getByText(`credit.railOps.code.module code=${code}`)).toBeInTheDocument()
    expect(within(cell).getByText('credit.railModuleStatus.NotFound')).toBeInTheDocument()
    expect(
      within(cell).getByText('credit.railOps.status.moduleLabel status=NotFound')
    ).toBeInTheDocument()
    expect(text.indexOf(`credit.railFailure.${code}`)).toBeLessThan(
      text.indexOf('credit.railModuleStatus.NotFound')
    )
    expect(text).not.toContain('credit.zumStatus.NotFound')
    expect(text).not.toContain('credit.railOps.status.label status=NotFound')
    expect(text).not.toContain('credit.railOperationState.failed')
  })

  it.each([
    ['null', null],
    ['пустая строка', ''],
    ['пробелы', '  '],
  ] as const)(
    'п. 8 пустой статус колбэка (%s) — «Zūm не назвав статус», без подписей',
    (_name, status) => {
      renderPanel({
        operations: [railOp({ callbacks: [callback({ status })], callbacks_total: 1 })],
      })
      const cell = cellOf(KEY, 'callback')
      expect(within(cell).getByText('credit.railOps.status.empty')).toBeInTheDocument()
      expect(cell.textContent).not.toContain('credit.railOps.status.unknown')
      expect(cell.textContent).not.toContain('credit.railOps.status.label')
    }
  )

  it("п. 9 «зв'язано за нашим ключем» — у колбэка, связанного ключом, и только у него", () => {
    renderPanel({
      operations: [
        railOp({
          callbacks: [
            callback({ matched_by: 'provider_tx_id' }),
            callback({
              received_at: '2026-09-26T09:15:00Z',
              status: 'Failed',
              matched_by: 'client_transaction_id',
            }),
          ],
          callbacks_total: 2,
        }),
      ],
    })
    const items = within(cellOf(KEY, 'callback')).getAllByRole('listitem')
    expect(within(items[0]).queryByText('credit.railOps.callback.matchedByKey')).toBeNull()
    expect(within(items[1]).getByText('credit.railOps.callback.matchedByKey')).toBeInTheDocument()
  })

  it('п. 10 колбэков меньше, чем в счётчике, — «показано N з M колбеків»; при равенстве нет', () => {
    const { unmount } = renderPanel({
      operations: [railOp({ callbacks: [callback()], callbacks_total: 2 })],
    })
    expect(
      within(cellOf(KEY, 'callback')).getByText('credit.railOps.callbacksTruncated shown=1 total=2')
    ).toBeInTheDocument()
    unmount()
    renderPanel({ operations: [railOp({ callbacks: [callback()], callbacks_total: 1 })] })
    expect(cellOf(KEY, 'callback').textContent).not.toContain('callbacksTruncated')
  })
})

describe('CreditRailOperations → кроки Zūm (AC-4a)', () => {
  it('п. 1 два шага в порядке ответа: время в поясе, текст и имя дословно', () => {
    renderPanel({
      operations: [
        railOp({
          events: [
            { event: 'Started', occurred_at: '2026-09-25T02:30:00Z' },
            { event: 'Succeeded', occurred_at: '2026-09-25T03:10:00Z' },
          ],
        }),
      ],
    })
    const items = within(cellOf(KEY, 'events')).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    const first = formatDateTime('2026-09-25T02:30:00Z', ZONE)
    // Контроль: в поясе юрисдикции другие сутки, чем в UTC, — иначе сцена пуста.
    expect(first).not.toBe(formatDateTime('2026-09-25T02:30:00Z', 'UTC'))
    expect(within(items[0]).getByText(first)).toBeInTheDocument()
    expect(within(items[0]).getByText('credit.zumEvent.Started')).toBeInTheDocument()
    expect(
      within(items[0]).getByText('credit.railOps.event.label event=Started')
    ).toBeInTheDocument()
    expect(
      within(items[1]).getByText(formatDateTime('2026-09-25T03:10:00Z', ZONE))
    ).toBeInTheDocument()
    expect(within(items[1]).getByText('credit.zumEvent.Succeeded')).toBeInTheDocument()
  })

  it('п. 2 событие отказа — текст кода Zūm, не credit.zumEvent', () => {
    renderPanel({
      operations: [
        railOp({
          events: [{ event: 'EftFailedInsufficientFunds', occurred_at: '2026-09-25T02:30:00Z' }],
        }),
      ],
    })
    const cell = cellOf(KEY, 'events')
    expect(
      within(cell).getByText('credit.railFailure.EftFailedInsufficientFunds')
    ).toBeInTheDocument()
    expect(
      within(cell).getByText('credit.railOps.event.label event=EftFailedInsufficientFunds')
    ).toBeInTheDocument()
    expect(cell.textContent).not.toContain('credit.zumEvent.EftFailedInsufficientFunds')
  })

  it('п. 3 незнакомое событие — «Невідома подія (X)», без подписи', () => {
    renderPanel({
      operations: [
        railOp({ events: [{ event: 'FrobnicatedEvent', occurred_at: '2026-09-25T02:30:00Z' }] }),
      ],
    })
    const cell = cellOf(KEY, 'events')
    expect(
      within(cell).getByText('credit.railOps.event.unknown event=FrobnicatedEvent')
    ).toBeInTheDocument()
    expect(cell.textContent).not.toContain('credit.railOps.event.label')
  })

  it('п. 4 шаг без момента — «час не названо», created_at на экране нет', () => {
    const op = railOp({ events: [{ event: 'Started', occurred_at: null }] })
    renderPanel({ operations: [op] })
    expect(
      within(cellOf(KEY, 'events')).getByText('credit.railOps.event.noTime')
    ).toBeInTheDocument()
    expectNoWrongMoments(op)
  })

  it('п. 5 шагов нет — «Zūm не надсилав»; отброшены — счёт без «не надсилав»; шаг и отброшенный', () => {
    const { unmount } = renderPanel({ operations: [railOp()] })
    expect(cellOf(KEY, 'events').textContent).toBe('credit.railOps.events.none')
    unmount()
    const second = renderPanel({ operations: [railOp({ events_dropped: 2 })] })
    const dropped = cellOf(KEY, 'events')
    expect(within(dropped).getByText('credit.railOps.events.dropped n=2')).toBeInTheDocument()
    expect(dropped.textContent).not.toContain('credit.railOps.events.none')
    second.unmount()
    renderPanel({
      operations: [
        railOp({ events: [{ event: 'Started', occurred_at: null }], events_dropped: 1 }),
      ],
    })
    const both = within(cellOf(KEY, 'events'))
    expect(both.getByText('credit.zumEvent.Started')).toBeInTheDocument()
    expect(both.getByText('credit.railOps.events.dropped n=1')).toBeInTheDocument()
  })

  it('п. 5 не отправлялась и шагов нет — «—», а не «Zūm не надсилав»', () => {
    renderPanel({ operations: [railOp(STOPPED)] })
    const cell = cellOf(KEY, 'events')
    expect(cell.textContent).toBe('—')
    expect(cell.textContent).not.toContain('credit.railOps.events.none')
  })

  it('п. 6 порядок ответа сохраняется: панель шаги не сортирует', () => {
    const names = () =>
      within(cellOf(KEY, 'events'))
        .getAllByRole('listitem')
        .map((item) => item.textContent ?? '')
    const { unmount } = renderPanel({
      operations: [
        railOp({
          events: [
            { event: 'Started', occurred_at: '2026-09-25T10:00:00Z' },
            { event: 'Succeeded', occurred_at: null },
          ],
        }),
      ],
    })
    expect(names()[0]).toContain('credit.zumEvent.Started')
    expect(names()[1]).toContain('credit.zumEvent.Succeeded')
    unmount()
    renderPanel({
      operations: [
        railOp({
          events: [
            { event: 'Succeeded', occurred_at: '2026-09-25T10:00:00Z' },
            { event: 'Started', occurred_at: '2026-09-25T09:00:00Z' },
          ],
        }),
      ],
    })
    expect(names()[0]).toContain('credit.zumEvent.Succeeded')
    expect(names()[1]).toContain('credit.zumEvent.Started')
  })
})

describe('CreditRailOperations → розшифровка (AC-5)', () => {
  const meaning = () => cellOf(KEY, 'meaning')

  it('п. 1 код модуля — свой текст и «код модуля»; ни «код Zūm», ни строки статуса, ни состояния', () => {
    renderPanel({ operations: [railOp(STOPPED)] })
    const cell = meaning()
    expect(
      within(cell).getByText('credit.railFailure.payout_refused_pending_review')
    ).toBeInTheDocument()
    expect(
      within(cell).getByText('credit.railOps.code.module code=payout_refused_pending_review')
    ).toBeInTheDocument()
    expect(cell.textContent).not.toContain('credit.railOps.code.zum')
    expect(cell.textContent).not.toContain('credit.railOps.status')
    expect(cell.textContent).not.toContain('credit.railOperationState')
  })

  it('п. 2 код Zūm — свой текст и «код Zūm»', () => {
    renderPanel({
      operations: [railOp({ state: 'failed', failure_code: 'EftFailedInsufficientFunds' })],
    })
    const cell = meaning()
    expect(
      within(cell).getByText('credit.railFailure.EftFailedInsufficientFunds')
    ).toBeInTheDocument()
    expect(
      within(cell).getByText('credit.railOps.code.zum code=EftFailedInsufficientFunds')
    ).toBeInTheDocument()
  })

  it('п. 3 NSF — «код стенду», не «код Zūm»', () => {
    renderPanel({ operations: [railOp({ state: 'reversed', failure_code: 'NSF' })] })
    const cell = meaning()
    expect(within(cell).getByText('credit.railFailure.NSF')).toBeInTheDocument()
    expect(within(cell).getByText('credit.railOps.code.stand code=NSF')).toBeInTheDocument()
    expect(cell.textContent).not.toContain('credit.railOps.code.zum')
  })

  it('п. 4 незнакомый код — «Невідомий код: X», без «код Zūm»', () => {
    renderPanel({
      operations: [railOp({ state: 'failed', failure_code: 'EftFailedSomethingNew' })],
    })
    const cell = meaning()
    expect(
      within(cell).getByText('credit.railOps.code.unknown code=EftFailedSomethingNew')
    ).toBeInTheDocument()
    expect(cell.textContent).not.toContain('credit.railOps.code.zum')
  })

  it('п. 5 без кода со статусом — только строка статуса, без текста состояния', () => {
    renderPanel({ operations: [railOp({ provider_status: 'Completed' })] })
    const cell = meaning()
    expect(within(cell).getByText('credit.zumStatus.Completed')).toBeInTheDocument()
    expect(
      within(cell).getByText('credit.railOps.status.label status=Completed')
    ).toBeInTheDocument()
    expect(cell.textContent).not.toContain('credit.railOperationState')
  })

  it.each([
    ['null', null],
    ['пустая строка', ''],
  ] as const)('п. 5 без кода и статуса (%s) — текст состояния операции', (_name, status) => {
    renderPanel({ operations: [railOp({ provider_status: status })] })
    const cell = meaning()
    expect(cell.textContent).toBe('credit.railOperationState.settled')
  })

  it('п. 7 zum_http_503 — «Zūm відповів помилкою HTTP 503» и «код модуля»', () => {
    renderPanel({ operations: [railOp({ state: 'unknown', failure_code: 'zum_http_503' })] })
    const cell = meaning()
    expect(
      within(cell).getByText('credit.railOps.code.transportHttp status=503')
    ).toBeInTheDocument()
    expect(
      within(cell).getByText('credit.railOps.code.module code=zum_http_503')
    ).toBeInTheDocument()
    expect(cell.textContent).not.toContain('credit.railOps.code.zum code=')
    expect(cell.textContent).not.toContain('credit.railOps.code.unknown')
  })

  it.each(['zum_http_50', 'zum_http_abc'])('п. 7 %s — незнакомый код, не семейство', (code) => {
    renderPanel({ operations: [railOp({ state: 'unknown', failure_code: code })] })
    const cell = meaning()
    expect(within(cell).getByText(`credit.railOps.code.unknown code=${code}`)).toBeInTheDocument()
    expect(cell.textContent).not.toContain('credit.railOps.code.transportHttp')
    expect(cell.textContent).not.toContain('credit.railOps.code.module')
  })

  it('п. 8 anr_probe_failed — код модуля, не «невідомий»', () => {
    renderPanel({ operations: [railOp({ ...STOPPED, failure_code: 'anr_probe_failed' })] })
    const cell = meaning()
    expect(within(cell).getByText('credit.railFailure.anr_probe_failed')).toBeInTheDocument()
    expect(
      within(cell).getByText('credit.railOps.code.module code=anr_probe_failed')
    ).toBeInTheDocument()
    expect(cell.textContent).not.toContain('credit.railOps.code.unknown')
  })

  it('п. 9 сторно NSF со статусом Failed — сперва код стенда, затем статус Zūm', () => {
    renderPanel({
      operations: [railOp({ state: 'reversed', failure_code: 'NSF', provider_status: 'Failed' })],
    })
    const cell = meaning()
    const text = cell.textContent ?? ''
    expect(within(cell).getByText('credit.railFailure.NSF')).toBeInTheDocument()
    expect(within(cell).getByText('credit.railOps.code.stand code=NSF')).toBeInTheDocument()
    expect(within(cell).getByText('credit.zumStatus.Failed')).toBeInTheDocument()
    expect(within(cell).getByText('credit.railOps.status.label status=Failed')).toBeInTheDocument()
    expect(text.indexOf('credit.railFailure.NSF')).toBeLessThan(
      text.indexOf('credit.zumStatus.Failed')
    )
  })
})

describe('CreditRailOperations → платёж, mock, пояс (AC-6)', () => {
  function payment(id: string, date: string, amount = 11_400): CreditPayment {
    return {
      payment_id: id,
      effective_date: date,
      amount_minor: amount,
      state: 'accepted',
      reversed_on: null,
    }
  }
  const first = payment('p-test-0001', '2026-09-10')
  const second = payment('p-test-0002', '2026-09-24')

  it('п. 1 списание связано со ВТОРЫМ из двух платежей одной суммы — дата и сумма второго', () => {
    renderPanel({
      operations: [railOp({ direction: 'collect', payment_id: second.payment_id })],
      payments: [first, second],
    })
    const cell = cellOf(KEY, 'payment')
    expect(cell.textContent).toContain(formatDate(second.effective_date))
    expect(cell.textContent).not.toContain(formatDate(first.effective_date))
    expect(
      within(cell).getByText(formatCreditMoney(second.amount_minor, 'CAD'))
    ).toBeInTheDocument()
    expect(cell.textContent).not.toContain('credit.railOps.payment.reversed')
  })

  it('п. 1 сторнированная операция — пометка «сторновано» в ячейке платежа', () => {
    renderPanel({
      operations: [
        railOp({ direction: 'collect', payment_id: second.payment_id, state: 'reversed' }),
      ],
      payments: [first, second],
    })
    expect(
      within(cellOf(KEY, 'payment')).getByText('credit.railOps.payment.reversed')
    ).toBeInTheDocument()
  })

  it('п. 2 неудавшееся списание без платежа — строка есть, «платежу немає»; чужой id — «не знайдено»; выплата — «—»', () => {
    renderPanel({
      operations: [
        railOp({
          direction: 'collect',
          state: 'failed',
          provider_tx_id: null,
          provider_accepted: false,
        }),
        railOp({
          client_transaction_id: `${KEY}-b`,
          direction: 'collect',
          payment_id: 'p-test-9999',
        }),
        railOp({ client_transaction_id: `${KEY}-c` }),
      ],
      payments: [first],
    })
    expect(cellOf(KEY, 'payment').textContent).toBe('credit.railOps.payment.noneFailedCollect')
    expect(cellOf(`${KEY}-b`, 'payment').textContent).toBe('credit.railOps.payment.notFound')
    expect(cellOf(`${KEY}-c`, 'payment').textContent).toBe('—')
  })

  it('п. 3 предупреждение синтетики — по одному на каждого провайдера не zum', () => {
    const warnings = () => screen.queryAllByText(/credit\.card\.mockProviderWarning/)
    const one = renderPanel({
      operations: ['a', 'b', 'c'].map((s) =>
        railOp({ client_transaction_id: `${KEY}-${s}`, provider: 'mock' })
      ),
    })
    expect(warnings().map((node) => node.textContent)).toEqual([
      'credit.card.mockProviderWarning provider=mock',
    ])
    one.unmount()
    const two = renderPanel({
      operations: [
        railOp({ client_transaction_id: `${KEY}-a`, provider: 'mock' }),
        railOp({ client_transaction_id: `${KEY}-b`, provider: 'demo' }),
      ],
    })
    expect(warnings().map((node) => node.textContent)).toEqual([
      'credit.card.mockProviderWarning provider=mock',
      'credit.card.mockProviderWarning provider=demo',
    ])
    two.unmount()
    renderPanel({ operations: [railOp({ provider: 'zum' })] })
    expect(warnings()).toHaveLength(0)
  })

  it('п. 4 время колбэка — в поясе юрисдикции, другие сутки, чем в UTC', () => {
    renderPanel({
      operations: [
        railOp({
          callbacks: [callback({ received_at: '2026-09-25T02:30:00Z' })],
          callbacks_total: 1,
        }),
      ],
    })
    const local = formatDateTime('2026-09-25T02:30:00Z', 'America/Edmonton')
    const utc = formatDateTime('2026-09-25T02:30:00Z', 'UTC')
    // Контроль: сцена что-то проверяет, только если сутки разные.
    expect(local).not.toBe(utc)
    const cell = cellOf(KEY, 'callback')
    expect(within(cell).getByText(local)).toBeInTheDocument()
    expect(cell.textContent).not.toContain(utc)
  })

  it('п. 5 футер называет пояс, пришедший от вкладки', () => {
    renderPanel({ operations: [railOp()], zone: 'America/Toronto' })
    expect(screen.getByText('credit.railOps.footer zone=America/Toronto')).toBeInTheDocument()
  })

  it('п. 7 платежи не загружены — «—», а не «не знайдено»; контроль при загруженных', () => {
    const linked = railOp({ direction: 'collect', payment_id: second.payment_id })
    const failed = railOp({
      client_transaction_id: `${KEY}-f`,
      direction: 'collect',
      state: 'failed',
      provider_tx_id: null,
      provider_accepted: false,
    })
    const { unmount } = renderPanel({ operations: [linked, failed], paymentsReady: false })
    expect(cellOf(KEY, 'payment').textContent).toBe('—')
    expect(screen.queryByText('credit.railOps.payment.notFound')).not.toBeInTheDocument()
    expect(cellOf(`${KEY}-f`, 'payment').textContent).toBe(
      'credit.railOps.payment.noneFailedCollect'
    )
    unmount()
    renderPanel({ operations: [linked], paymentsReady: true, payments: [] })
    expect(cellOf(KEY, 'payment').textContent).toBe('credit.railOps.payment.notFound')
  })
})

describe('CreditRailOperations → ячейка «Операція» (AC-6b)', () => {
  const operation = () => cellOf(KEY, 'operation')

  it('п. 1 направление, сумма, состояние, канал и оба ключа с копированием', () => {
    renderPanel({ operations: [railOp()] })
    const cell = within(operation())
    expect(cell.getByText(/credit\.railOps\.direction\.disburse/)).toBeInTheDocument()
    expect(cell.getByText(formatCreditMoney(50_000, 'CAD'))).toBeInTheDocument()
    expect(cell.getByText('credit.railOperationState.settled')).toBeInTheDocument()
    expect(cell.getByText('credit.disbursementMethod.interac')).toBeInTheDocument()
    expect(
      cell.getByText('credit.fields.clientTransactionId').parentElement?.textContent
    ).toContain(KEY)
    expect(cell.getByText('credit.fields.providerTxId').parentElement?.textContent).toContain(
      'zum-test-0001'
    )
    expect(cell.getAllByRole('button', { name: 'credit.actions.copy' })).toHaveLength(2)
  })

  it('п. 2 бейдж — словарь операции; текстов выплаты во всей панели нет', () => {
    const { unmount } = renderPanel({ operations: [railOp({ state: 'reversed' })] })
    expect(within(operation()).getByText('credit.railOperationState.reversed')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('credit.disbursementState')
    unmount()
    renderPanel({ operations: [railOp({ state: 'unknown' })] })
    expect(within(operation()).getByText('credit.railOperationState.unknown')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('credit.disbursementState')
  })

  it('п. 3 незнакомый канал — дословно, не через словарь', () => {
    renderPanel({ operations: [railOp({ method: 'wire' })] })
    const cell = operation()
    expect(within(cell).getByText('wire')).toBeInTheDocument()
    expect(cell.textContent).not.toContain('credit.disbursementMethod.wire')
  })

  it('п. 4 списание — «Списання з клієнта», не «Виплата»', () => {
    renderPanel({ operations: [railOp({ direction: 'collect' })] })
    const cell = operation()
    expect(cell.textContent).toContain('credit.railOps.direction.collect')
    expect(cell.textContent).not.toContain('credit.railOps.direction.disburse')
  })

  it('п. 5 без id провайдера — строки id нет, наш ключ есть, кнопка одна', () => {
    renderPanel({ operations: [railOp({ provider_tx_id: null, provider_accepted: false })] })
    const cell = within(operation())
    expect(cell.queryByText('credit.fields.providerTxId')).toBeNull()
    expect(cell.getByText('credit.fields.clientTransactionId')).toBeInTheDocument()
    expect(cell.getAllByRole('button', { name: 'credit.actions.copy' })).toHaveLength(1)
  })
})
