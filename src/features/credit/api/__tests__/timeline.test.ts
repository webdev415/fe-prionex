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
