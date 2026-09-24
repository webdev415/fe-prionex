/**
 * Метрики раздела считаются здесь и больше нигде — на этапе 2 их заменят
 * серверные агрегаты, и заменить должно быть можно ровно в одном месте.
 *
 * Проверяем то, что легко испортить незаметно: масштаб денег (minor units),
 * счёт «таблеток» статусов из сводки (без сводки числа нет, отсутствующий
 * статус — ноль), отсутствие статусных карточек у заявок и конверсию, которая
 * не должна делиться на ноль на пустой выборке.
 */
import { describe, it, expect } from 'vitest'
import {
  applicationStatusCount,
  buildApplicationMetrics,
  buildLoanMetrics,
  formatMinorTotal,
} from '../metrics'
import type { CreditApplicationSummary, CreditLoanSummary, CreditOverview } from '../types'

const OVERVIEW: CreditOverview = {
  role: 'underwriter',
  permissions: [],
  applications: { referred: 2, scoring: 1, declined: 118, disbursed: 257, approved: 4 },
  loans: { active: 61, delinquent: 224, closed: 22 },
  application_statuses: ['scoring', 'referred', 'approved', 'declined', 'disbursed'],
  demo_mode: true,
}

const APPLICATION: CreditApplicationSummary = {
  application_id: 'a1',
  number: 'DEMO-1',
  status: 'referred',
  product_code: 'CA_AB_PAYDAY',
  channel: 'site',
  jurisdiction: 'CA-AB',
  currency: 'CAD',
  requested_amount_minor: 90_000,
  client_email: null,
  created_at: '2026-08-29T09:00:00Z',
  updated_at: '2026-08-29T09:00:00Z',
  decision_outcome: null,
  decision_mode: null,
  final_amount_minor: null,
}

const LOAN: CreditLoanSummary = {
  loan_id: 'l1',
  contract_number: 'FB-000255',
  product_code: 'CA_AB_PAYDAY',
  status: 'delinquent',
  currency: 'CAD',
  principal_minor: 30_000,
  total_payable_minor: 34_200,
  delinquency_days: 18,
  client_email: null,
  disbursed_at: '2026-08-29T08:55:00Z',
  maturity_date: '2026-10-10',
  application_id: 'a1',
}

describe('formatMinorTotal', () => {
  it('переводит minor units в основные единицы, не теряя масштаб', () => {
    // 90 000 центов = 900 долларов, а не 90 000 и не 9
    expect(formatMinorTotal(90_000, 'CAD')).toBe('900 CAD')
  })
})

describe('buildApplicationMetrics', () => {
  // Статус переключают «таблетки» над списком; карточка статуса была вторым
  // рядом того же фильтра, и её возврат — дубль, который снимала единица.
  it('статусных метрик у заявок нет: статус переключают только «таблетки»', () => {
    const metrics = buildApplicationMetrics(OVERVIEW, [APPLICATION])
    const statusLike = metrics.filter(
      (metric) => metric.status !== undefined || metric.key.startsWith('status:')
    )
    expect(
      statusLike.map((metric) => metric.key),
      'у заявок снова есть карточка статуса — второй ряд того же фильтра'
    ).toEqual([])
  })

  it('над заявками — только деньги и конверсия', () => {
    const metrics = buildApplicationMetrics(OVERVIEW, [APPLICATION])
    expect(
      metrics.map((metric) => metric.key),
      'набор карточек над заявками не «запрошено + конверсия»'
    ).toEqual(['sum:requested', 'rate:conversion'])
  })

  it('считает конверсию заявка → выдача по решённым заявкам', () => {
    const metrics = buildApplicationMetrics(OVERVIEW, [APPLICATION])
    // disbursed 257 из (approved 4 + declined 118 + disbursed 257) = 68 %
    expect(metrics.find((metric) => metric.key === 'rate:conversion')?.value).toBe('68%')
  })

  it('не делит на ноль, когда решений ещё нет', () => {
    const empty: CreditOverview = { ...OVERVIEW, applications: { in_progress: 3 } }
    const metrics = buildApplicationMetrics(empty, [])
    expect(metrics.find((metric) => metric.key === 'rate:conversion')).toBeUndefined()
  })

  it('суммирует запрошенное по странице', () => {
    const metrics = buildApplicationMetrics(OVERVIEW, [APPLICATION, APPLICATION])
    // 90 000 minor × 2 = 180 000 minor = 1 800 в основных единицах.
    // Разделитель разрядов зависит от языка (мок фиксирует 'en'), поэтому
    // сравниваем по цифрам, а не по форме: смысл теста — сумма, не локаль.
    const value = metrics.find((metric) => metric.key === 'sum:requested')?.value
    expect(value?.replace(/[^\d]/g, '')).toBe('1800')
    expect(value).toContain('CAD')
  })
})

describe('applicationStatusCount', () => {
  it('без сводки числа нет, а не ноль', () => {
    expect(
      applicationStatusCount(undefined, 'referred'),
      'без сводки «таблетка» получила число — неизвестное выдано за ноль'
    ).toBeNull()
  })

  it('число — из сводки модуля', () => {
    expect(applicationStatusCount(OVERVIEW, 'referred'), 'счёт referred не из сводки').toBe('2')
  })

  it('статус без ключа в сводке — ноль, и ноль виден', () => {
    expect(
      applicationStatusCount(OVERVIEW, 'expired'),
      'статус без ключа в сводке остался без числа, а это ноль в проекте'
    ).toBe('0')
  })
})

describe('buildLoanMetrics', () => {
  it('показывает портфель и среднюю просрочку только по просроченным', () => {
    const metrics = buildLoanMetrics(OVERVIEW, [LOAN, { ...LOAN, delinquency_days: 0 }])
    expect(metrics.find((metric) => metric.key === 'sum:principal')?.value).toBe('600 CAD')
    // средний DPD считается по просроченным (18), а не по всем (9)
    expect(metrics.find((metric) => metric.key === 'avg:dpd')?.value).toBe('18')
  })
})
