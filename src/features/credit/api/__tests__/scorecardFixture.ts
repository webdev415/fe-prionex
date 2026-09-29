/**
 * Срез живых снимков решений — не выдумка.
 *
 * Сцены A–E — ключи `scorecard`, `income_class`, `income_class_source` и
 * `income_class_basis` решений DEV-приёмки 19-3 (DEV s1, модуль `main`
 * `7934c035`, заявки CA-000320…CA-000324; выгрузка куратора read-only `psql`,
 * только эти ключи, `income_class_basis` — без `amounts`). Прочих ключей снимка
 * здесь нет: ни дохода, ни банковской проверки, ни реквизитов.
 *
 * Единственное отличие от живого снимка — `version`: живое значение несёт имя
 * проекта, а страж устаревших текстов раздела ищет его и в тестах. Для фронта
 * `version` непрозрачна, поэтому здесь синтетическая `scorecard@1`.
 *
 * Часть B (тир и сумма) — литерал story 19-4 AC-14, ИЗ STORY, НЕ ИЗ КОДА: кода
 * 19-4 на 29.09 нет. После 19-4 на DEV — заменить срезом живого снимка.
 */
import type {
  CreditDecisionCodesRegistry,
  CreditDecisionSnapshot,
  CreditIncomeClassBasis,
  CreditScorecardSnapshot,
} from '../types'

/** Снимок, как его пишет модуль: основание класса несёт `missing`, которого тип fe не читает. */
type LiveDecisionSnapshot = Omit<CreditDecisionSnapshot, 'income_class_basis'> & {
  income_class_basis: CreditIncomeClassBasis & { missing: string[] }
}

/** Сцена A: employment_full_time + demo-happy: A/both, approved (CA-000320). */
export const SCENE_A: LiveDecisionSnapshot = {
  scorecard: {
    band: 2,
    gate: {
      held: [],
      codes: [],
      review: [],
      decline: false,
    },
    total: 12,
    inputs: {
      missing: [],
      nsf_90d: 0,
      overdraft: false,
      history_days: 1240,
      income_class: 'A',
      micro_lenders: 0,
      b_not_confirmed: false,
      employment_loss: false,
      active_days_trend: 'CONSISTENT',
      employer_income_30d: true,
      income_class_source: 'both',
      employer_income_trend: 'CONSISTENT',
      government_income_30d: false,
      employment_status_known: true,
      negative_balance_days_90d: 0,
      free_cash_flow_monthly_minor: 26380,
    },
    points: {
      nsf_90d: 2,
      overdraft: 1,
      history_days: 2,
      income_trend: 1,
      micro_lenders: 2,
      active_days_trend: 1,
      free_cash_flow_monthly: 1,
      negative_balance_days_90d: 2,
    },
    version: 'scorecard@1',
    income_class: 'A',
    income_class_source: 'both',
  },
  income_class: 'A',
  income_class_source: 'both',
  income_class_basis: {
    missing: [],
    evidence: {
      b_income: false,
      c_income: false,
      employer_income_30d: true,
    },
    declared_class: 'A',
    b_not_confirmed: false,
    employment_status: 'employment_full_time',
    employment_status_known: true,
  },
}

/** Сцена B: employment_full_time + demo-nsf5: declined AB-G-04 (CA-000321). */
export const SCENE_B: LiveDecisionSnapshot = {
  scorecard: {
    band: 0,
    gate: {
      held: [],
      codes: ['AB-G-04'],
      review: [],
      decline: true,
    },
    total: 7,
    inputs: {
      missing: [],
      nsf_90d: 5,
      overdraft: false,
      history_days: 1240,
      income_class: 'A',
      micro_lenders: 2,
      b_not_confirmed: false,
      employment_loss: false,
      active_days_trend: 'CONSISTENT',
      employer_income_30d: true,
      income_class_source: 'both',
      employer_income_trend: 'CONSISTENT',
      government_income_30d: false,
      employment_status_known: true,
      negative_balance_days_90d: 4,
      free_cash_flow_monthly_minor: 26380,
    },
    points: {
      nsf_90d: 0,
      overdraft: 1,
      history_days: 2,
      income_trend: 1,
      micro_lenders: 1,
      active_days_trend: 1,
      free_cash_flow_monthly: 1,
      negative_balance_days_90d: 0,
    },
    version: 'scorecard@1',
    income_class: 'A',
    income_class_source: 'both',
  },
  income_class: 'A',
  income_class_source: 'both',
  income_class_basis: {
    missing: [],
    evidence: {
      b_income: false,
      c_income: false,
      employer_income_30d: true,
    },
    declared_class: 'A',
    b_not_confirmed: false,
    employment_status: 'employment_full_time',
    employment_status_known: true,
  },
}

/** Сцена C: pension + demo-happy: referred income_class_b_not_confirmed, held AB-G-03 (CA-000322). */
export const SCENE_C: LiveDecisionSnapshot = {
  scorecard: {
    band: 2,
    gate: {
      held: ['AB-G-03'],
      codes: [],
      review: ['income_class_b_not_confirmed'],
      decline: false,
    },
    total: 11,
    inputs: {
      missing: [],
      nsf_90d: 0,
      overdraft: false,
      history_days: 1240,
      income_class: 'B',
      micro_lenders: 0,
      b_not_confirmed: true,
      employment_loss: false,
      active_days_trend: 'CONSISTENT',
      employer_income_30d: true,
      income_class_source: 'questionnaire',
      employer_income_trend: 'CONSISTENT',
      government_income_30d: false,
      employment_status_known: true,
      negative_balance_days_90d: 0,
      free_cash_flow_monthly_minor: 26380,
    },
    points: {
      nsf_90d: 2,
      overdraft: 1,
      history_days: 2,
      income_trend: 0,
      micro_lenders: 2,
      active_days_trend: 1,
      free_cash_flow_monthly: 1,
      negative_balance_days_90d: 2,
    },
    version: 'scorecard@1',
    income_class: 'B',
    income_class_source: 'questionnaire',
  },
  income_class: 'B',
  income_class_source: 'questionnaire',
  income_class_basis: {
    missing: [],
    evidence: {
      b_income: false,
      c_income: false,
      employer_income_30d: true,
    },
    declared_class: 'B',
    b_not_confirmed: true,
    employment_status: 'pension',
    employment_status_known: true,
  },
}

/** Сцена D: pension + demo-pension: B/both, approved (CA-000323). */
export const SCENE_D: LiveDecisionSnapshot = {
  scorecard: {
    band: 2,
    gate: {
      held: [],
      codes: [],
      review: [],
      decline: false,
    },
    total: 12,
    inputs: {
      missing: [],
      nsf_90d: 0,
      overdraft: false,
      history_days: 1240,
      income_class: 'B',
      micro_lenders: 0,
      b_not_confirmed: false,
      employment_loss: false,
      active_days_trend: 'CONSISTENT',
      employer_income_30d: true,
      income_class_source: 'both',
      employer_income_trend: 'CONSISTENT',
      government_income_30d: true,
      employment_status_known: true,
      negative_balance_days_90d: 0,
      free_cash_flow_monthly_minor: 26380,
    },
    points: {
      nsf_90d: 2,
      overdraft: 1,
      history_days: 2,
      income_trend: 1,
      micro_lenders: 2,
      active_days_trend: 1,
      free_cash_flow_monthly: 1,
      negative_balance_days_90d: 2,
    },
    version: 'scorecard@1',
    income_class: 'B',
    income_class_source: 'both',
  },
  income_class: 'B',
  income_class_source: 'both',
  income_class_basis: {
    missing: [],
    evidence: {
      b_income: true,
      c_income: false,
      employer_income_30d: true,
    },
    declared_class: 'B',
    b_not_confirmed: false,
    employment_status: 'pension',
    employment_status_known: true,
  },
}

/**
 * Сцена E: student + demo-happy: A/flinks (bank measured salary), approved (CA-000324).
 * Единственная живая сцена, где класс по анкете (`declared_class: null`) и итоговый класс
 * расходятся, а источник класса — банк (`flinks`).
 */
export const SCENE_E: LiveDecisionSnapshot = {
  scorecard: {
    band: 2,
    gate: {
      held: [],
      codes: [],
      review: [],
      decline: false,
    },
    total: 12,
    inputs: {
      missing: [],
      nsf_90d: 0,
      overdraft: false,
      history_days: 1240,
      income_class: 'A',
      micro_lenders: 0,
      b_not_confirmed: false,
      employment_loss: false,
      active_days_trend: 'CONSISTENT',
      employer_income_30d: true,
      income_class_source: 'flinks',
      employer_income_trend: 'CONSISTENT',
      government_income_30d: false,
      employment_status_known: true,
      negative_balance_days_90d: 0,
      free_cash_flow_monthly_minor: 26380,
    },
    points: {
      nsf_90d: 2,
      overdraft: 1,
      history_days: 2,
      income_trend: 1,
      micro_lenders: 2,
      active_days_trend: 1,
      free_cash_flow_monthly: 1,
      negative_balance_days_90d: 2,
    },
    version: 'scorecard@1',
    income_class: 'A',
    income_class_source: 'flinks',
  },
  income_class: 'A',
  income_class_source: 'flinks',
  income_class_basis: {
    missing: [],
    evidence: {
      b_income: false,
      c_income: false,
      employer_income_30d: true,
    },
    declared_class: null,
    b_not_confirmed: false,
    employment_status: 'student',
    employment_status_known: true,
  },
}

/** Ключи 19-4 в `input_snapshot.scorecard` — дословно story 19-4 AC-14 (одобрение Type 1). */
export const PART_B_KEYS = {
  client_type: 1,
  closed_loans: 0,
  tier: { min_minor: 10000, max_minor: 30000, class_b_cap_applied: false },
  product_bounds_minor: { min: 10000, max: 150000, step: 2500 },
  scale_amount_minor: 20000,
  cap_amount_minor: 269200,
  rounded_amount_minor: 20000,
  final_amount_minor: 20000,
  installments: { min: null, max: 7 },
  codes: [],
}

/** Сцена A со снимком после 19-4: к ключам 19-3 добавлены ключи блока суммы. */
export const withPartB = (
  keys: Partial<CreditScorecardSnapshot> = {},
  base: LiveDecisionSnapshot = SCENE_A
): LiveDecisionSnapshot => ({
  ...base,
  scorecard: { ...base.scorecard, ...PART_B_KEYS, ...keys },
})

/**
 * Реестр для текстов кодов гейта: записи `AB-G-01…AB-G-06` дословно из того же
 * снимка `registry_view()`, что у фикстуры 19-1f (модуль `1f05e4c`). Своя
 * `version` (`book@g1`, у 19-1f — `book@1`): индекс `indexDecisionCodes` кэшируется
 * по объекту ответа, и разные реестры не должны выглядеть одной версией.
 */
export const SCORECARD_REGISTRY_FIXTURE: CreditDecisionCodesRegistry = {
  version: 'book@g1',
  codes: [
    {
      id: 'AB-G-01',
      kind: 'gate',
      book: null,
      book_code: 'О-20',
      category: 'income',
      ru: 'Нет дохода от работодателя за последние 30 дней (класс A)',
      en: 'No employer income in the last 30 days (class A)',
      note_ru: null,
      traits: ['automatic'],
      legacy_rc: null,
    },
    {
      id: 'AB-G-02',
      kind: 'gate',
      book: null,
      book_code: 'У-01',
      category: 'income',
      ru: 'Обнаружена потеря работы (класс A)',
      en: 'Employment loss detected (class A)',
      note_ru: null,
      traits: ['automatic'],
      legacy_rc: null,
    },
    {
      id: 'AB-G-03',
      kind: 'gate',
      book: null,
      book_code: 'О-21',
      category: 'income',
      ru: 'Нет государственного дохода за последние 30 дней (класс B)',
      en: 'No government income in the last 30 days (class B)',
      note_ru: null,
      traits: ['automatic'],
      legacy_rc: null,
    },
    {
      id: 'AB-G-04',
      kind: 'gate',
      book: null,
      book_code: 'О-22',
      category: 'bank_statement',
      ru: '5 и более NSF за 90 дней',
      en: 'Five or more NSF events in 90 days',
      note_ru: null,
      traits: ['automatic'],
      legacy_rc: null,
    },
    {
      id: 'AB-G-05',
      kind: 'gate',
      book: null,
      book_code: 'О-21',
      category: 'income',
      ru: 'Основной доход класса C',
      en: 'Primary income of class C',
      note_ru: null,
      traits: ['automatic'],
      legacy_rc: null,
    },
    {
      id: 'AB-G-06',
      kind: 'gate',
      book: null,
      book_code: 'О-01',
      category: 'loan_terms',
      ru: 'Допустимая сумма ниже минимума $100 (50 % ЗП за период)',
      en: 'Allowed amount below the $100 minimum (50 % of net pay per period)',
      note_ru: null,
      traits: ['automatic'],
      legacy_rc: 'RC-11',
    },
  ],
}
