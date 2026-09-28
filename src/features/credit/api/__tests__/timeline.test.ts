/**
 * Разбор хронологии карточки заявки: подпись события, письма, честное число.
 *
 * Мок `t` печатает ключ вместе с подстановками — так видно, ЧТО ушло в строку:
 * незнакомое событие обязано прийти пометкой «подія сайту» с именем, а не голым
 * машинным именем.
 */
import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import {
  hasStatusRows,
  hasTimeline,
  isKnownPortalEvent,
  isMailRow,
  loanMailKind,
  loanSiteMailState,
  mailRows,
  portalEventLabel,
  truncatedPortalEvents,
} from '../timeline'
import type { CreditPortalEventRecord, CreditTimelineRow } from '../types'

const t = ((key: string, vars?: Record<string, unknown>) =>
  vars
    ? `${key} ${Object.entries(vars)
        .map(([name, value]) => `${name}=${String(value)}`)
        .join(' ')}`
    : key) as unknown as TFunction

function clientRow(
  event: string,
  scope: 'application' | 'client' = 'application'
): CreditTimelineRow {
  return {
    track: 'client',
    at: '2026-09-01T10:00:00Z',
    last_at: '2026-09-01T10:00:00Z',
    count: 1,
    client: { event, source: 'cabinet', scope },
    transition: null,
  }
}

const STATUS_ROW: CreditTimelineRow = {
  track: 'status',
  at: '2026-09-01T10:01:00Z',
  last_at: '2026-09-01T10:01:00Z',
  count: 1,
  client: null,
  transition: {
    from_status: null,
    to_status: 'in_progress',
    actor: 'create',
    at: '2026-09-01T10:01:00Z',
  },
}

describe('U-1: подпись события сайта', () => {
  it('известное событие — подпись своего ключа', () => {
    expect(isKnownPortalEvent('ibv_login')).toBe(true)
    expect(portalEventLabel(t, 'ibv_login')).toBe('credit.portalEvent.ibv_login')
  })

  it('незнакомое событие — пометка «подія сайту» с именем, не голое имя', () => {
    expect(isKnownPortalEvent('future_event')).toBe(false)
    expect(portalEventLabel(t, 'future_event')).toBe('credit.portalEvent.unknown name=future_event')
  })

  it('письма сайта — в перечне событий', () => {
    expect(isKnownPortalEvent('notification_mailed')).toBe(true)
    expect(isKnownPortalEvent('code_sent')).toBe(true)
  })
})

describe('U-2: письма клиенту — строки хронологии', () => {
  it('письмо-уведомление и письмо с кодом — письма, в обеих областях', () => {
    expect(isMailRow(clientRow('notification_mailed'))).toBe(true)
    expect(isMailRow(clientRow('code_sent', 'client'))).toBe(true)
  })

  it('прочие события и переходы статуса — не письма', () => {
    expect(isMailRow(clientRow('ibv_login'))).toBe(false)
    expect(isMailRow(STATUS_ROW)).toBe(false)
  })

  it('отбор сохраняет порядок хронологии', () => {
    const first = clientRow('code_sent', 'client')
    const second = clientRow('notification_mailed')
    expect(mailRows([first, STATUS_ROW, clientRow('ibv_login'), second])).toEqual([first, second])
    expect(mailRows(undefined)).toEqual([])
  })

  it('не-массив на месте ленты — пусто, а не падение', () => {
    expect(mailRows({ track: 'client' })).toEqual([])
    expect(mailRows('timeline')).toEqual([])
  })
})

describe('U-3: честное число событий сайта', () => {
  const events = (n: number): CreditPortalEventRecord[] =>
    Array.from({ length: n }, (_, i) => ({
      event_id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      ts: '2026-09-01T10:00:00Z',
      source: 'cabinet',
      event: 'block_saved',
    }))

  it('всего больше показанного — называется и то, и другое', () => {
    expect(truncatedPortalEvents(events(200), 250)).toEqual({ shown: 200, total: 250 })
  })

  it('показано всё — пометки нет', () => {
    expect(truncatedPortalEvents(events(3), 3)).toBeNull()
  })

  it('модуль числа не прислал — сравнивать не с чем', () => {
    expect(truncatedPortalEvents(events(3), undefined)).toBeNull()
  })

  it('число есть, а ленты нет — «показано 0 из N» не выдумывается', () => {
    expect(truncatedPortalEvents(undefined, 250)).toBeNull()
  })
})

describe('U-8: пришла ли хронология и есть ли в ней переходы', () => {
  it('пустая лента — как отсутствие поля', () => {
    expect(hasTimeline([])).toBe(false)
    expect(hasTimeline(undefined)).toBe(false)
    expect(hasTimeline({})).toBe(false)
    expect(hasTimeline([STATUS_ROW])).toBe(true)
  })

  it('лента только из событий сайта — переходов в ней нет', () => {
    expect(hasStatusRows([clientRow('ibv_login')])).toBe(false)
    expect(hasStatusRows([clientRow('ibv_login'), STATUS_ROW])).toBe(true)
  })
})

/**
 * Лента кредита — события сайта в форме модуля (`PortalEventRecord`). Поля,
 * которых нет в объявленном минимуме (`who`, `loan_id`, `received_at`),
 * лежат в фикстуре как в живом ответе — приведением, а не расширением типа.
 * Все значения синтетические: нули с номером.
 */
function loanEvent(
  n: number,
  event: string,
  details: Record<string, unknown> = {}
): CreditPortalEventRecord {
  return {
    event_id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    ts: `2026-09-25T10:${String(n).padStart(2, '0')}:00Z`,
    received_at: `2026-09-25T11:${String(n).padStart(2, '0')}:00Z`,
    source: 'cabinet',
    event,
    who: '0000000000000001',
    application_id: null,
    external_application_id: null,
    loan_id: '00000000-0000-4000-8000-0000000000aa',
    details,
    seq: n,
  } as unknown as CreditPortalEventRecord
}

const mailed = (n: number, type: unknown) =>
  loanEvent(n, 'notification_mailed', {
    type,
    notice_event_id: `00000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`,
  })

describe('U-k: лента писем карточки кредита — состояние по форме поля', () => {
  it.each([
    ['undefined, 3', undefined, 3],
    ['null, 0', null, 0],
    ["'x', 1", 'x', 1],
  ] as const)(
    'U-k1: лента не массив (%s) — «модуль не передав», без усечения',
    (_n, feed, total) => {
      expect(loanSiteMailState(feed, total)).toEqual({ kind: 'notProvided' })
    }
  )

  it('U-k2: пустая лента — «листів немає», а не «модуль не передав»', () => {
    expect(loanSiteMailState([], 0)).toEqual({ kind: 'none', truncated: null })
  })

  it('U-k3: смешанная лента — только письма, в порядке модуля, письмо с кодом входит', () => {
    const a = mailed(2, 'loan.issued')
    const b = loanEvent(4, 'code_sent')
    const c = mailed(5, 'loan.closed')
    const feed = [loanEvent(1, 'document_opened'), a, loanEvent(3, 'payoff_quoted'), b, c]
    expect(loanSiteMailState(feed, 5)).toEqual({ kind: 'rows', rows: [a, b, c], truncated: null })
  })

  it.each([
    ['total undefined', undefined, null],
    ["total '5'", '5', null],
    ['total 3 > длины 1', 3, { shown: 1, total: 3 }],
  ] as const)('U-k4: %s — строка об усечении по числу модуля', (_n, total, truncated) => {
    const feed = [mailed(1, 'loan.issued')]
    expect(loanSiteMailState(feed, total)).toEqual({ kind: 'rows', rows: feed, truncated })
  })

  it('U-k5: элементы null, 5 и { event: 7 } рядом с письмом — одна строка, без падения', () => {
    const letter = mailed(1, 'loan.issued')
    expect(loanSiteMailState([null, 5, { event: 7 }, letter], undefined)).toEqual({
      kind: 'rows',
      rows: [letter],
      truncated: null,
    })
  })
})

describe('U-k: вид письма-уведомления по коду повода', () => {
  const REASONS = [
    ['loan.issued', 'credit.loanMail.kind.issued'],
    ['loan.disbursement_reversed', 'credit.loanMail.kind.disbursementReversed'],
    ['loan.payment.allocated', 'credit.loanMail.kind.paymentAllocated'],
    ['loan.delinquency.changed', 'credit.loanMail.kind.delinquencyChanged'],
    ['loan.closed', 'credit.loanMail.kind.closed'],
  ] as const

  it.each(REASONS)('U-k6: повод %s — своя подпись %s', (type, key) => {
    expect(loanMailKind(t, mailed(1, type))).toBe(key)
  })

  it('U-k6: пять поводов — пять разных подписей', () => {
    const kinds = REASONS.map(([type]) => loanMailKind(t, mailed(1, type)))
    expect(new Set(kinds).size).toBe(5)
  })

  it('U-k7: незнакомый повод — как есть, с пометкой «привід модуля»', () => {
    expect(loanMailKind(t, mailed(1, 'loan.future_thing'))).toBe(
      'credit.loanMail.kindUnknown type=loan.future_thing'
    )
  })

  it.each([
    ['details нет', undefined],
    ['details {}', {}],
    ['type: 5', { type: 5 }],
    ["type: '  '", { type: '  ' }],
  ] as const)('U-k8: %s — «привід не названо»', (_n, details) => {
    const record = loanEvent(1, 'notification_mailed') as unknown as Record<string, unknown>
    if (details === undefined) delete record.details
    else record.details = details
    // Контроль фикстуры: «details нет» — ключа нет вовсе, а не `undefined` в нём.
    expect('details' in record).toBe(details !== undefined)
    expect(loanMailKind(t, record as unknown as CreditPortalEventRecord)).toBe(
      'credit.loanMail.kindMissing'
    )
  })

  it('U-k9: у письма с кодом и у прочих событий вида письма нет', () => {
    expect(loanMailKind(t, loanEvent(1, 'code_sent', { type: 'loan.issued' }))).toBeNull()
    expect(loanMailKind(t, loanEvent(2, 'document_opened'))).toBeNull()
  })
})
