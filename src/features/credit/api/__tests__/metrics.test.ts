/**
 * Метрики раздела считаются здесь и больше нигде — на этапе 2 их заменят
 * серверные агрегаты, и заменить должно быть можно ровно в одном месте.
 *
 * Проверяем то, что легко испортить незаметно: масштаб денег (minor units),
 * кликабельность карточек статусов и конверсию, которая не должна делиться
 * на ноль на пустой выборке.
 */
import { describe, it, expect } from 'vitest'
import { buildApplicationMetrics, buildLoanMetrics, formatMinorTotal } from '../metrics'
import type { CreditApplicationSummary, CreditLoanSummary, CreditOverview } from '../types'

const OVERVIEW: CreditOverview = {
  role: 'underwriter',
  permissions: [],
  roles_available: [],
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
  it('карточки статусов кликабельны и берут числа из сводки', () => {
    const metrics = buildApplicationMetrics(OVERVIEW, [APPLICATION], [])
    const referred = metrics.find((metric) => metric.key === 'status:referred')
    expect(referred?.value).toBe('2')
    expect(referred?.status).toBe('referred')
  })

  it('считает конверсию заявка → выдача по решённым заявкам', () => {
    const metrics = buildApplicationMetrics(OVERVIEW, [APPLICATION], [])
    // disbursed 257 из (approved 4 + declined 118 + disbursed 257) = 68 %
    expect(metrics.find((metric) => metric.key === 'rate:conversion')?.value).toBe('68%')
  })

  it('не делит на ноль, когда решений ещё нет', () => {
    const empty: CreditOverview = { ...OVERVIEW, applications: { in_progress: 3 } }
    const metrics = buildApplicationMetrics(empty, [], [])
    expect(metrics.find((metric) => metric.key === 'rate:conversion')).toBeUndefined()
  })

  it('суммирует запрошенное по странице', () => {
    const metrics = buildApplicationMetrics(OVERVIEW, [APPLICATION, APPLICATION], [])
    // toLocaleString('ru-RU') разделяет разряды НЕРАЗРЫВНЫМ пробелом —
    // нормализуем, иначе тест ловит невидимую разницу, а не смысл.
    const value = metrics.find((metric) => metric.key === 'sum:requested')?.value
    expect(value?.replace(/\s/g, ' ')).toBe('1 800 CAD')
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
