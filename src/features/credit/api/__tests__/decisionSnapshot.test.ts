/**
 * Сырой снимок решения на экране — без реквизитов выплаты и сумм пособий.
 *
 * Все значения ниже выдуманы: держатель `Test Holder`, счёт `000000000`, круглые
 * суммы. Живых реквизитов и сумм в тестах нет.
 */
import { describe, it, expect } from 'vitest'
import { snapshotForDisplay } from '../decisionSnapshot'

const PAYOUT = {
  holder_name: 'Test Holder',
  institution_number: '000',
  transit_number: '00000',
  account_number: '000000000',
}

const withIbv = () => ({
  requested_amount_minor: 30_000,
  referral_reasons: ['income_class_b_not_confirmed'],
  ibv: {
    provider: 'mock',
    payout_account_id: 'acc-1',
    payout_account: { ...PAYOUT },
    income: { net_amount_minor: 250_000, employer_name: 'Synthetic Employer' },
    risk: {
      count_nsf_90_days: 0,
      extra: {
        has_overdraft: false,
        sum_pension_income: 1000,
        sum_disability_income: 2000,
        has_employer_income_in_last_30_days: true,
      },
    },
  },
  income_class_basis: {
    declared_class: 'B',
    amounts: { sum_pension_income: 1000, sum_disability_income: 2000 },
    evidence: { employer_income_30d: true, b_income: true, c_income: false },
  },
})

describe('snapshotForDisplay', () => {
  it('X-1: счёт выплаты убран, остальное в ibv и в снимке на месте', () => {
    const shown = snapshotForDisplay(withIbv())
    const ibv = shown.snapshot.ibv as Record<string, unknown>
    expect(ibv).not.toHaveProperty('payout_account')
    expect(JSON.stringify(shown.snapshot)).not.toContain('000000000')
    expect(JSON.stringify(shown.snapshot)).not.toContain('Test Holder')
    expect(ibv.income).toEqual(withIbv().ibv.income)
    expect(ibv.payout_account_id).toBe('acc-1')
    expect(ibv.provider).toBe('mock')
    expect((ibv.risk as Record<string, unknown>).count_nsf_90_days).toBe(0)
    expect(shown.snapshot.requested_amount_minor).toBe(30_000)
    expect(shown.snapshot.referral_reasons).toEqual(['income_class_b_not_confirmed'])
    expect(shown.payoutHidden).toBe(true)
  })

  it('X-2: вход не мутирован', () => {
    const input = withIbv()
    const before = JSON.parse(JSON.stringify(input)) as unknown
    snapshotForDisplay(input)
    expect(input).toEqual(before)
  })

  it('X-3: убирать нечего — то же содержимое, оба флага false', () => {
    const plain = { requested_amount_minor: 30_000, ibv: { provider: 'mock', income: { a: 1 } } }
    expect(snapshotForDisplay(plain)).toEqual({
      snapshot: plain,
      payoutHidden: false,
      amountsHidden: false,
    })
    const noIbv = { requested_amount_minor: 30_000 }
    expect(snapshotForDisplay(noIbv)).toEqual({
      snapshot: noIbv,
      payoutHidden: false,
      amountsHidden: false,
    })
    const noSums = { ibv: { risk: { extra: { has_overdraft: false } } } }
    expect(snapshotForDisplay(noSums)).toEqual({
      snapshot: noSums,
      payoutHidden: false,
      amountsHidden: false,
    })
  })

  it('X-3: не снимок — пустой объект', () => {
    for (const value of [undefined, null, 'snapshot', 7, ['a']]) {
      expect(snapshotForDisplay(value)).toEqual({
        snapshot: {},
        payoutHidden: false,
        amountsHidden: false,
      })
    }
  })

  it('X-4: суммы пособий убраны и из основания класса, и из risk.extra; признаки на месте', () => {
    const shown = snapshotForDisplay(withIbv())
    const basis = shown.snapshot.income_class_basis as Record<string, unknown>
    expect(basis).not.toHaveProperty('amounts')
    expect(basis.evidence).toEqual(withIbv().income_class_basis.evidence)
    expect(basis.declared_class).toBe('B')
    const extra = (
      (shown.snapshot.ibv as Record<string, unknown>).risk as Record<
        string,
        Record<string, unknown>
      >
    ).extra
    expect(Object.keys(extra).sort()).toEqual([
      'has_employer_income_in_last_30_days',
      'has_overdraft',
    ])
    expect(JSON.stringify(shown.snapshot)).not.toContain('sum_pension_income')
    expect(shown.amountsHidden).toBe(true)
  })

  it('X-4: только суммы в основании класса — amountsHidden, payoutHidden нет', () => {
    const shown = snapshotForDisplay({ income_class_basis: { amounts: { sum_wsib_income: 5 } } })
    expect(shown).toEqual({
      snapshot: { income_class_basis: {} },
      payoutHidden: false,
      amountsHidden: true,
    })
  })

  /**
   * Модуль пишет `income_class_basis.amounts` в каждое решение — автоматическое
   * без флага скоринга и ручное тоже; без банковской проверки все семь сумм
   * Lending там `null`. Строка «суми приховано» под таким снимком была бы
   * неправдой: прятать было нечего.
   */
  const NULL_AMOUNTS = {
    sum_pension_income: null,
    sum_disability_income: null,
    sum_government_income_total: null,
    sum_employment_insurance_income: null,
    sum_social_assistance_income: null,
    sum_wsib_income: null,
    sum_child_support_income_government: null,
  }

  it('X-5: amounts из одних null — флага нет, ключ с экрана убран', () => {
    const shown = snapshotForDisplay({
      requested_amount_minor: 30_000,
      income_class_basis: { declared_class: 'A', amounts: { ...NULL_AMOUNTS } },
    })
    expect(shown).toEqual({
      snapshot: { requested_amount_minor: 30_000, income_class_basis: { declared_class: 'A' } },
      payoutHidden: false,
      amountsHidden: false,
    })
  })

  it('X-5: sum_* в risk.extra из одних null — флага нет, признаки на месте', () => {
    const shown = snapshotForDisplay({
      ibv: { risk: { extra: { sum_pension_income: null, has_overdraft: false } } },
    })
    expect(shown).toEqual({
      snapshot: { ibv: { risk: { extra: { has_overdraft: false } } } },
      payoutHidden: false,
      amountsHidden: false,
    })
  })

  it('X-5: одна сумма среди null — флаг есть (и в amounts, и в risk.extra)', () => {
    expect(
      snapshotForDisplay({
        income_class_basis: { amounts: { ...NULL_AMOUNTS, sum_disability_income: 0 } },
      }).amountsHidden
    ).toBe(true)
    expect(
      snapshotForDisplay({
        ibv: { risk: { extra: { sum_pension_income: null, sum_wsib_income: 1200 } } },
      }).amountsHidden
    ).toBe(true)
  })
})
