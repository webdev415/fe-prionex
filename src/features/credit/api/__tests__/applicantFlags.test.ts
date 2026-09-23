/**
 * Подсветка проблем в заявке.
 *
 * Фикстуры сняты с ЖИВЫХ ответов модуля (стенд, 29.08), а не придуманы: два
 * дефекта за день произошли ровно потому, что тип «подтверждал» форму данных,
 * которой никто не касался. Здесь важнее всего CA-002769 — там
 * `divergence_pct` приходит СТРОКОЙ «75.26» против числового допуска 10.
 *
 * Каждая проверка прошла мутационную: убираешь приведение или условие — тест
 * краснеет. Зелёный тест, который ничего не ловит, уже стоил нам дефекта
 * (draft.test.ts прогонял сломанную ветку и молчал).
 */
import { describe, it, expect } from 'vitest'
import { collectApplicationFlags } from '../applicantFlags'
import type { CreditApplicationDetail } from '../types'

/** Заявка без единой проблемы — форма как у живого ответа. */
function cleanApplication(): CreditApplicationDetail {
  return {
    application_id: 'a1',
    number: 'CA-000001',
    status: 'disbursed',
    product_code: 'CA_AB_PAYDAY',
    channel: 'site',
    jurisdiction: 'CA-AB',
    currency: 'CAD',
    requested_amount_minor: 30000,
    client_email: 'clean@example.ca',
    client_phone: '+14035550111',
    created_at: '2026-08-29T19:04:53Z',
    updated_at: '2026-08-29T19:04:58Z',
    decision_outcome: 'approved',
    decision_mode: 'automatic',
    final_amount_minor: 30000,
    project_id: 0,
    client_id: null,
    decision_id: 'd1',
    loan_id: 'l1',
    paydays: [],
    consents: [
      { kind: 'terms', text_version: 'v1', granted: true },
      { kind: 'e_signature', text_version: 'v1', granted: true },
      { kind: 'pad', text_version: 'v1', granted: true },
    ],
    audit: [],
    draft: { income: { employer: 'Northern Logistics Inc.' } },
    missing_fields: [],
    ibv: {
      status: 'completed',
      identity_match_rate: 1.0,
      payout_account_ambiguous: false,
      income: {
        employer_name: 'Northern Logistics Inc.',
        net_amount_minor: 198600,
        observed_paydays: ['2026-08-14', '2026-08-28'],
      },
      risk: { count_nsf_90_days: 0, count_distinct_micro_lenders: 0 },
      payday_reconciliation: { dates_match: true, needs_review: false, frequency_matches: true },
    },
    decision: {
      decision_id: 'd1',
      application_id: 'a1',
      outcome: 'approved',
      decision_mode: 'automatic',
      decline_codes: [],
      final_amount_minor: 30000,
      currency: 'CAD',
      cooldown_until: null,
      ruleset_version: 'ca-ab-local@0.1.0',
      model_version: 'admission-stub@0',
      input_snapshot_id: 's1',
      underwriter_id: null,
      rationale: null,
      overrides_decision_id: null,
      supersedes_decision_id: null,
      decided_at: '2026-08-29T19:04:55Z',
      input_snapshot: {
        requested_amount_minor: 30000,
        affordability_cap_minor: 99300,
        active_loans: 0,
        income_reconciliation: {
          declared_net_amount_minor: 200000,
          verified_net_amount_minor: 198600,
          divergence_pct: '0.70',
          tolerance_pct: 10,
          needs_review: false,
          review_reason: null,
        },
      },
    },
  }
}

function idsOf(application: CreditApplicationDetail): string[] {
  return collectApplicationFlags(application).map((flag) => flag.id)
}

describe('collectApplicationFlags', () => {
  it('на чистой заявке не даёт ни одного признака', () => {
    // Негативная проверка: без неё любой сломанный порог выглядел бы «работающим».
    expect(collectApplicationFlags(cleanApplication())).toEqual([])
  })

  it('ловит расхождение дохода, когда процент приходит СТРОКОЙ (CA-002769)', () => {
    const application = cleanApplication()
    // Форма из живого ответа: строка против числового допуска.
    application.decision!.input_snapshot!.income_reconciliation = {
      declared_net_amount_minor: 200000,
      verified_net_amount_minor: 49485,
      divergence_pct: '75.26',
      tolerance_pct: 10,
      needs_review: true,
      review_reason: 'divergence_above_tolerance',
    }
    const flags = collectApplicationFlags(application)
    const income = flags.find((flag) => flag.id === 'income-divergence')
    expect(income).toBeDefined()
    // Заявлено БОЛЬШЕ банковского — опасная сторона, помечается красным.
    expect(income?.severity).toBe('danger')
    expect(income?.labelKey).toBe('credit.flags.incomeOverstated')
    // Строку в подстановку пускать нельзя: сравнение с числом JS сделает и
    // сам, а вот дальнейшая арифметика и форматирование на строке врут.
    // Уберёшь приведение — здесь окажется '75.26', и тест покраснеет.
    expect(typeof income?.values?.divergence).toBe('number')
    expect(income?.values?.divergence).toBe(75.26)
  })

  it('сравнивает числа, а не строки, когда допуск тоже пришёл строкой', () => {
    // '9.50' > '10' лексикографически ИСТИНА («9» > «1»), то есть без
    // приведения заявка с расхождением 9,5 % при допуске 10 % получила бы
    // ложную тревогу.
    const application = cleanApplication()
    application.decision!.input_snapshot!.income_reconciliation = {
      declared_net_amount_minor: 200000,
      verified_net_amount_minor: 190000,
      divergence_pct: '9.50',
      tolerance_pct: '10',
      needs_review: false,
      review_reason: null,
    }
    expect(idsOf(application)).not.toContain('income-divergence')
  })

  it('не поднимает тревогу, когда расхождение внутри допуска', () => {
    // Мутационный контроль к предыдущему: 0.70 < 10 — признака быть не должно.
    expect(idsOf(cleanApplication())).not.toContain('income-divergence')
  })

  it('ловит возвраты за недостатком средств и микрокредиторов (CA-002770)', () => {
    const application = cleanApplication()
    application.ibv!.risk = { count_nsf_90_days: 3, count_distinct_micro_lenders: 2 }
    const flags = collectApplicationFlags(application)
    expect(flags.find((flag) => flag.id === 'nsf-history')?.severity).toBe('danger')
    expect(idsOf(application)).toContain('micro-lenders')
  })

  it('ловит запрет на повторную подачу после отказа (CA-002778)', () => {
    const application = cleanApplication()
    application.decision!.outcome = 'declined'
    application.decision!.decline_codes = ['RC-04']
    application.decision!.cooldown_until = '2026-09-28'
    expect(idsOf(application)).toContain('cooldown')
  })

  it('ловит расхождение работодателя анкеты и выписки (CA-002782)', () => {
    const application = cleanApplication()
    application.draft = { income: { employer: 'ТОВ «Ромашка»' } }
    const flags = collectApplicationFlags(application)
    const employer = flags.find((flag) => flag.id === 'employer-mismatch')
    expect(employer).toBeDefined()
    expect(employer?.values?.verified).toBe('Northern Logistics Inc.')
  })

  it('не считает расхождением разный регистр одного работодателя', () => {
    const application = cleanApplication()
    application.draft = { income: { employer: 'northern logistics inc.' } }
    expect(idsOf(application)).not.toContain('employer-mismatch')
  })

  it('ловит подключённый банк без единого дохода (CA-002771)', () => {
    const application = cleanApplication()
    application.ibv!.income = { observed_paydays: [] }
    const flags = collectApplicationFlags(application)
    expect(flags.find((flag) => flag.id === 'no-verified-income')?.severity).toBe('danger')
  })

  it('отказ от РЕКЛАМЫ не считается нехваткой данных', () => {
    // Законный выбор клиента. Красный на нём приучил бы не смотреть на цвет.
    const application = cleanApplication()
    application.consents = [
      ...application.consents!,
      { kind: 'marketing', text_version: 'v1', granted: false },
    ]
    expect(idsOf(application)).not.toContain('consents-missing')
  })

  it('но отсутствие обязательного согласия — красное', () => {
    const application = cleanApplication()
    application.consents = [{ kind: 'terms', text_version: 'v1', granted: false }]
    const flags = collectApplicationFlags(application)
    expect(flags.find((flag) => flag.id === 'consents-missing')?.severity).toBe('danger')
  })

  it('делит признаки на противоречия и нехватку', () => {
    const application = cleanApplication()
    application.ibv!.risk = { count_nsf_90_days: 1 }
    application.missing_fields = ['income']
    const flags = collectApplicationFlags(application)
    expect(flags.find((flag) => flag.id === 'nsf-history')?.kind).toBe('conflict')
    expect(flags.find((flag) => flag.id === 'missing-blocks')?.kind).toBe('missing')
  })
})
