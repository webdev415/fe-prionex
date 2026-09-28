/**
 * Разбор операций рельса для вкладки «Платежі» (story 17-6f): правило
 * «передано в Zūm», чей это код и статус, что сказать без колбэков и шагов,
 * платёж операции.
 *
 * Мок `t` печатает ключ вместе с подстановками — так видно, ЧТО ушло в строку:
 * код в подписи владельца, статус в подписи слова. Все фикстуры синтетические:
 * ключи `rail-test-*`, id провайдера `zum-test-*`.
 */
import { describe, it, expect } from 'vitest'
import {
  callbackLines,
  eventLabel,
  eventLines,
  eventText,
  isBlankStatus,
  noCallbackText,
  nonZumProviders,
  paymentCellOf,
  paymentMarkOf,
  railCodeLabel,
  railFailureText,
  railOperationAnchor,
  statusLabel,
  statusText,
  submissionOf,
} from '../railOperations'
import type { CreditPayment, CreditRailCallback, CreditRailOperation } from '../types'

const t = (key: string, vars?: Record<string, unknown>) =>
  vars
    ? `${key} ${Object.entries(vars)
        .map(([name, value]) => `${name}=${String(value)}`)
        .join(' ')}`
    : key

/** Полная операция со всеми 30 ключами контракта: пропущенный ключ — ошибка типа. */
function railOp(overrides: Partial<CreditRailOperation> = {}): CreditRailOperation {
  return {
    client_transaction_id: 'rail-test-0001',
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

function payment(id: string, date: string, amount = 11_400): CreditPayment {
  return {
    payment_id: id,
    effective_date: date,
    amount_minor: amount,
    state: 'accepted',
    reversed_on: null,
  }
}

describe('submissionOf — «Передано в Zūm» по признаку модуля (AC-3)', () => {
  it('п. 1 rail_called + принят → момент начала вызова, подтверждён', () => {
    expect(submissionOf(railOp())).toEqual({
      kind: 'sent',
      at: '2026-09-24T14:07:00Z',
      acknowledged: true,
    })
  })

  it('п. 2 rail_called, не принят, unknown + transport_error → момент и «не підтвердив»', () => {
    const op = railOp({
      provider_accepted: false,
      provider_tx_id: null,
      state: 'unknown',
      failure_code: 'transport_error',
    })
    expect(submissionOf(op)).toEqual({
      kind: 'sent',
      at: '2026-09-24T14:07:00Z',
      acknowledged: false,
    })
  })

  it('п. 3 not_recorded + принят → «передано, час не записано»', () => {
    const op = railOp({ submission: 'not_recorded', rail_call_started_at: null })
    expect(submissionOf(op).kind).toBe('notRecorded')
  })

  it('п. 4 stopped_before_send, не принят, наш отказ → «не відправлялась»', () => {
    const op = railOp({
      submission: 'stopped_before_send',
      provider_accepted: false,
      provider_tx_id: null,
      state: 'failed',
      failure_code: 'payout_refused_pending_review',
      rail_call_started_at: null,
      rail_call_returned_at: null,
    })
    expect(submissionOf(op).kind).toBe('notSent')
  })

  it('п. 5–7 not_recorded без приёма: failed → unknown, pending → notYet, unknown → unknown', () => {
    const base = {
      submission: 'not_recorded' as const,
      provider_accepted: false,
      provider_tx_id: null,
      rail_call_started_at: null,
      rail_call_returned_at: null,
    }
    expect(
      submissionOf(railOp({ ...base, state: 'failed', failure_code: 'transport_error' })).kind
    ).toBe('unknown')
    expect(submissionOf(railOp({ ...base, state: 'pending' })).kind).toBe('notYet')
    expect(submissionOf(railOp({ ...base, state: 'unknown' })).kind).toBe('unknown')
  })

  it('п. 8 пример (г): stopped_before_send при заданном моменте вызова → «не відправлялась»', () => {
    const op = railOp({
      submission: 'stopped_before_send',
      provider_accepted: false,
      provider_tx_id: null,
      state: 'unknown',
      failure_code: 'rail_limit_exceeded',
    })
    expect(op.rail_call_started_at, 'фикстура обязана нести момент вызова').not.toBeNull()
    expect(submissionOf(op).kind).toBe('notSent')
  })

  it('п. 9 противоречивая пара: stopped_before_send, но принят → «передано, час не записано»', () => {
    const op = railOp({
      submission: 'stopped_before_send',
      state: 'failed',
      failure_code: 'invalid_amount',
      rail_call_started_at: null,
    })
    expect(submissionOf(op).kind).toBe('notRecorded')
  })

  it('п. 10 rail_called, не принят, no_token → момент и «не підтвердив» (правило модуля)', () => {
    const op = railOp({
      provider_accepted: false,
      provider_tx_id: null,
      state: 'failed',
      failure_code: 'no_token',
    })
    expect(submissionOf(op)).toEqual({
      kind: 'sent',
      at: '2026-09-24T14:07:00Z',
      acknowledged: false,
    })
  })

  it('п. 11 после сверки: NotFound — notSent у остановленной, unknown у not_recorded', () => {
    const after = {
      provider_accepted: false,
      provider_tx_id: null,
      state: 'failed' as const,
      provider_status: 'NotFound',
      rail_call_started_at: null,
    }
    expect(
      submissionOf(
        railOp({ ...after, submission: 'stopped_before_send', failure_code: 'rail_limit_exceeded' })
      ).kind
    ).toBe('notSent')
    expect(
      submissionOf(
        railOp({ ...after, submission: 'not_recorded', failure_code: 'provider_never_created' })
      ).kind
    ).toBe('unknown')
  })
})

describe('railFailureText / railCodeLabel — чей код (AC-5)', () => {
  it('п. 1 код модуля → свой текст и «код модуля», без «код Zūm»', () => {
    expect(railFailureText(t, 'payout_refused_pending_review')).toBe(
      'credit.railFailure.payout_refused_pending_review'
    )
    expect(railCodeLabel(t, 'payout_refused_pending_review')).toBe(
      'credit.railOps.code.module code=payout_refused_pending_review'
    )
  })

  it('п. 2 код Zūm → свой текст и «код Zūm»', () => {
    expect(railFailureText(t, 'EftFailedInsufficientFunds')).toBe(
      'credit.railFailure.EftFailedInsufficientFunds'
    )
    expect(railCodeLabel(t, 'EftFailedInsufficientFunds')).toBe(
      'credit.railOps.code.zum code=EftFailedInsufficientFunds'
    )
  })

  it('п. 3 NSF — слово стенда: текст словаря и «код стенду», не «код Zūm»', () => {
    expect(railFailureText(t, 'NSF')).toBe('credit.railFailure.NSF')
    expect(railCodeLabel(t, 'NSF')).toBe('credit.railOps.code.stand code=NSF')
  })

  it('п. 4 незнакомый код → «Невідомий код: X» без приписки владельца', () => {
    expect(railFailureText(t, 'EftFailedSomethingNew')).toBe(
      'credit.railOps.code.unknown code=EftFailedSomethingNew'
    )
    expect(railCodeLabel(t, 'EftFailedSomethingNew')).toBeNull()
  })

  it('п. 7 семейство zum_http_ — «Zūm відповів помилкою HTTP» и «код модуля»', () => {
    expect(railFailureText(t, 'zum_http_503')).toBe('credit.railOps.code.transportHttp status=503')
    expect(railCodeLabel(t, 'zum_http_503')).toBe('credit.railOps.code.module code=zum_http_503')
  })

  it('п. 7 шаблон целиком: zum_http_50 и zum_http_abc — незнакомые коды', () => {
    for (const code of ['zum_http_50', 'zum_http_abc']) {
      expect(railFailureText(t, code)).toBe(`credit.railOps.code.unknown code=${code}`)
      expect(railCodeLabel(t, code)).toBeNull()
    }
  })

  it('п. 8 anr_probe_failed — код модуля', () => {
    expect(railFailureText(t, 'anr_probe_failed')).toBe('credit.railFailure.anr_probe_failed')
    expect(railCodeLabel(t, 'anr_probe_failed')).toBe(
      'credit.railOps.code.module code=anr_probe_failed'
    )
  })
})

describe('statusText / statusLabel — статус и слово дословно (AC-4 п. 5, 7, 8)', () => {
  it('слово Zūm → понятный текст и «статус Zūm: слово»', () => {
    expect(statusText(t, 'Completed')).toBe('credit.zumStatus.Completed')
    expect(statusLabel(t, 'Completed')).toBe('credit.railOps.status.label status=Completed')
  })

  it('слово с пробелом (Pending Cancellation) — ключ как есть', () => {
    expect(statusText(t, 'Pending Cancellation')).toBe('credit.zumStatus.Pending Cancellation')
  })

  it('NotFound — слово модуля своим словарём и «позначка модуля», не «статус Zūm»', () => {
    expect(statusText(t, 'NotFound')).toBe('credit.railModuleStatus.NotFound')
    expect(statusLabel(t, 'NotFound')).toBe('credit.railOps.status.moduleLabel status=NotFound')
  })

  it('незнакомое слово → «Невідомий статус: X», без подписи', () => {
    expect(statusText(t, 'Frobnicated')).toBe('credit.railOps.status.unknown status=Frobnicated')
    expect(statusLabel(t, 'Frobnicated')).toBeNull()
  })

  it.each([
    ['null', null],
    ['пустая строка', ''],
    ['пробелы', '  '],
  ] as const)('пустой статус (%s) → «Zūm не назвав статус», без подписи', (_name, status) => {
    expect(isBlankStatus(status)).toBe(true)
    expect(statusText(t, status)).toBe('credit.railOps.status.empty')
    expect(statusLabel(t, status)).toBeNull()
  })

  it('контроль: непустое слово пустым не считается', () => {
    expect(isBlankStatus('Failed')).toBe(false)
  })
})

describe('callbackLines / noCallbackText — колбэки (AC-4)', () => {
  it('п. 1, 9 все колбэки в порядке ответа, пометка ключа — только у связанного ключом', () => {
    const op = railOp({
      callbacks: [
        callback(),
        callback({
          received_at: '2026-09-26T10:00:00Z',
          status: 'Failed',
          matched_by: 'client_transaction_id',
        }),
      ],
      callbacks_total: 2,
    })
    const lines = callbackLines(op)
    expect(lines.map((line) => line.callback.status)).toEqual(['Completed', 'Failed'])
    expect(lines.map((line) => line.matchedByKey)).toEqual([false, true])
  })

  it('п. 3 подпись и применённость — независимо', () => {
    const [mismatch] = callbackLines(railOp({ callbacks: [callback({ signature_ok: false })] }))
    expect(mismatch.signatureMismatch).toBe(true)
    expect(mismatch.notProcessed).toBe(false)
    const [pending] = callbackLines(railOp({ callbacks: [callback({ processed_at: null })] }))
    expect(pending.signatureMismatch).toBe(false)
    expect(pending.notProcessed).toBe(true)
  })

  it('п. 4 без колбэков: итог → none / noneObserved; pending → waiting; unknown → звірка; notSent → «—»', () => {
    expect(noCallbackText(railOp())).toEqual({ kind: 'none' })
    expect(noCallbackText(railOp({ observed_at: '2026-09-24T15:00:00Z' }))).toEqual({
      kind: 'noneObserved',
      at: '2026-09-24T15:00:00Z',
    })
    expect(
      noCallbackText(
        railOp({
          submission: 'not_recorded',
          provider_accepted: false,
          provider_tx_id: null,
          state: 'failed',
          failure_code: 'transport_error',
          rail_call_started_at: null,
        })
      )
    ).toEqual({ kind: 'none' })
    expect(noCallbackText(railOp({ state: 'pending' }))).toEqual({ kind: 'waiting' })
    for (const accepted of [false, true]) {
      expect(noCallbackText(railOp({ state: 'unknown', provider_accepted: accepted }))).toEqual({
        kind: 'awaitingReconciliation',
      })
    }
    expect(
      noCallbackText(
        railOp({
          submission: 'stopped_before_send',
          provider_accepted: false,
          provider_tx_id: null,
          state: 'failed',
          failure_code: 'payout_refused_pending_review',
          rail_call_started_at: null,
        })
      )
    ).toEqual({ kind: 'notAsked' })
  })
})

describe('eventLines / eventText / eventLabel — шаги Zūm (AC-4a)', () => {
  it('п. 1, 6 шаги — в порядке ответа, без пересортировки', () => {
    const op = railOp({
      events: [
        { event: 'Succeeded', occurred_at: '2026-09-25T10:00:00Z' },
        { event: 'Started', occurred_at: '2026-09-25T09:00:00Z' },
      ],
    })
    expect(eventLines(op).events.map((event) => event.event)).toEqual(['Succeeded', 'Started'])
    expect(eventLines(op).empty).toBeNull()
  })

  it('п. 1 известный шаг → свой текст и «подія Zūm: имя»', () => {
    expect(eventText(t, 'Started')).toBe('credit.zumEvent.Started')
    expect(eventLabel(t, 'Started')).toBe('credit.railOps.event.label event=Started')
  })

  it('п. 2 событие отказа → текст кода Zūm, не credit.zumEvent', () => {
    expect(eventText(t, 'EftFailedInsufficientFunds')).toBe(
      'credit.railFailure.EftFailedInsufficientFunds'
    )
    expect(eventLabel(t, 'EftFailedInsufficientFunds')).toBe(
      'credit.railOps.event.label event=EftFailedInsufficientFunds'
    )
  })

  it('п. 3 незнакомое → «Невідома подія (X)», без подписи', () => {
    expect(eventText(t, 'FrobnicatedEvent')).toBe(
      'credit.railOps.event.unknown event=FrobnicatedEvent'
    )
    expect(eventLabel(t, 'FrobnicatedEvent')).toBeNull()
  })

  it('п. 5 пустые случаи: none, отброшенные без none, notSent → «—»', () => {
    expect(eventLines(railOp()).empty).toBe('none')
    const dropped = eventLines(railOp({ events_dropped: 2 }))
    expect(dropped.empty).toBeNull()
    expect(dropped.dropped).toBe(2)
    const notSent = railOp({
      submission: 'stopped_before_send',
      provider_accepted: false,
      provider_tx_id: null,
      state: 'failed',
      failure_code: 'payout_refused_pending_review',
      rail_call_started_at: null,
    })
    expect(eventLines(notSent).empty).toBe('notAsked')
    // Данные важнее правила: пришли шаги у неотправленной — они выводятся.
    expect(
      eventLines({ ...notSent, events: [{ event: 'Started', occurred_at: null }] }).empty
    ).toBeNull()
  })
})

describe('paymentCellOf / paymentMarkOf — платёж операции по payment_id (AC-6)', () => {
  const first = payment('p-test-0001', '2026-09-10')
  const second = payment('p-test-0002', '2026-09-24')

  it('п. 1 списание связано со ВТОРЫМ платежом той же суммы — по id, а не по сумме', () => {
    const op = railOp({ direction: 'collect', payment_id: second.payment_id })
    expect(paymentCellOf(op, [first, second], true)).toEqual({
      kind: 'found',
      payment: second,
      reversed: false,
    })
    expect(paymentMarkOf(second, [op])).toBe(op)
    expect(paymentMarkOf(first, [op])).toBeNull()
  })

  it('п. 1 сторнированная операция несёт пометку', () => {
    const op = railOp({ direction: 'collect', payment_id: second.payment_id, state: 'reversed' })
    expect(paymentCellOf(op, [first, second], true)).toEqual({
      kind: 'found',
      payment: second,
      reversed: true,
    })
  })

  it('п. 2 неудавшееся списание без платежа, платёж не из списка, выплата', () => {
    expect(paymentCellOf(railOp({ direction: 'collect', state: 'failed' }), [first], true)).toEqual(
      {
        kind: 'noneFailedCollect',
      }
    )
    expect(
      paymentCellOf(railOp({ direction: 'collect', payment_id: 'p-test-9999' }), [first], true)
    ).toEqual({ kind: 'notFound' })
    expect(paymentCellOf(railOp(), [first], true)).toEqual({ kind: 'none' })
  })

  it('п. 7 платежи не загружены → «—», а не «не знайдено»; отказ списания виден всегда', () => {
    const linked = railOp({ direction: 'collect', payment_id: second.payment_id })
    expect(paymentCellOf(linked, [], false)).toEqual({ kind: 'none' })
    // Контроль: те же данные при загруженном пустом списке — «не знайдено».
    expect(paymentCellOf(linked, [], true)).toEqual({ kind: 'notFound' })
    expect(paymentCellOf(railOp({ direction: 'collect', state: 'failed' }), [], false)).toEqual({
      kind: 'noneFailedCollect',
    })
  })
})

describe('вспомогательное: якорь строки и не боевые провайдеры', () => {
  it('якорь строки — ключ операции, закодированный для id и ссылки', () => {
    expect(railOperationAnchor(railOp({ client_transaction_id: 'collect:rail-test:2' }))).toBe(
      'rail-op-collect%3Arail-test%3A2'
    )
  })

  it('провайдеры не zum — по одному, в порядке первого появления', () => {
    const ops = [
      railOp({ provider: 'mock' }),
      railOp({ provider: 'zum' }),
      railOp({ provider: 'demo' }),
      railOp({ provider: 'mock' }),
    ]
    expect(nonZumProviders(ops)).toEqual(['mock', 'demo'])
    expect(nonZumProviders([railOp()])).toEqual([])
  })
})
