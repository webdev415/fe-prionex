/**
 * Разбор скоринга книги правил проверки клиента — чтение `input_snapshot.scorecard`.
 *
 * Чистый модуль: без React, без i18n, без транспорта. Фронт НИЧЕГО не
 * пересчитывает — баллы, сумма, банд, коды и суммы блока тира берутся из снимка
 * так, как их записал модуль. Пороги живут в конфиге модуля; их вторая копия
 * здесь разошлась бы с ним при первой же калибровке.
 *
 * Чтение терпимое: ключа нет или он не объект — `null`; поле отсутствует или не
 * того типа — `null` в модели; параметр вне восьми известных (новая версия
 * модуля) — строкой в конце таблицы с сырым именем, а не потерян.
 */
import { CREDIT_SCORECARD_PARAMETERS } from './enums'
import type { CreditDecisionSnapshot } from './types'

export type CreditScorecardParameter = (typeof CREDIT_SCORECARD_PARAMETERS)[number]

/**
 * Ячейка балла и имя строки листа «Калькулятор скоринга» — данные книги, не
 * перевод, в словари не идут. Имя без подсказки формата в скобках: в листе
 * `Has Overdraft (TRUE/FALSE)`, здесь `Has Overdraft`.
 *
 * У C20 два имени: для класса B балл берётся из входа строки 11 раздела ГЕЙТЫ
 * (`C20: =IF(UPPER(B7)="B",IF(UPPER(B11)="YES",1,0),…)`), для A и C — из строки
 * 20 листа.
 */
export const SCORECARD_BOOK_ROWS: Record<
  CreditScorecardParameter,
  { cell: string; book: string; bookClassB?: string }
> = {
  nsf_90d: { cell: 'C13', book: 'Count NSF 90 Days' },
  free_cash_flow_monthly: { cell: 'C14', book: 'Average Monthly Free Cash Flow' },
  micro_lenders: { cell: 'C15', book: 'Count Distinct Micro Lenders' },
  negative_balance_days_90d: { cell: 'C16', book: 'Count Days Negative Balance 90 Days' },
  overdraft: { cell: 'C17', book: 'Has Overdraft' },
  active_days_trend: { cell: 'C18', book: 'Active Days Trend Simple' },
  history_days: { cell: 'C19', book: 'Account Age Days' },
  income_trend: {
    cell: 'C20',
    book: 'Employer Income Trend Simple',
    bookClassB: 'B11 Has Government Income Last 30 Days',
  },
}

/** Сумма баллов книги не больше 13 (форма банда C24). */
export const SCORECARD_MAX_TOTAL = 13

/**
 * Вход параметра. `missing` — «не измерено»: значения нет или поле названо в
 * `inputs.missing`. Это НЕ «нет» и не ноль — на этом различии стоит вся схема
 * удержаний 19-3. `unknown` — прочесть нечем: параметр незнакомый либо значение
 * не того типа; на экране прочерк, а не «не виміряно».
 */
export type CreditScorecardInput =
  | { kind: 'count'; value: number }
  | { kind: 'money'; value: number }
  | { kind: 'flag'; value: boolean }
  | { kind: 'trend'; value: string }
  | { kind: 'days'; value: number }
  | { kind: 'missing' }
  | { kind: 'unknown' }

export interface CreditScorecardRow {
  parameter: string
  /** Ячейка книги; у незнакомого параметра — `null`. */
  cell: string | null
  book: string | null
  points: number | null
  input: CreditScorecardInput
}

export interface CreditScorecardBasis {
  declaredClass: string | null
  employmentStatus: string | null
  employmentStatusKnown: boolean | null
  bNotConfirmed: boolean | null
  evidence: { signal: 'employer_income_30d' | 'b_income' | 'c_income'; value: boolean | null }[]
}

export interface CreditScorecardAmount {
  clientType: number | null
  closedLoans: number | null
  tier: { min: number | null; max: number | null; classBCap: boolean } | null
  scale: number | null
  cap: number | null
  rounded: number | null
  final: number | null
  installments: { min: number | null; max: number | null } | null
  codes: string[]
}

export interface CreditScorecardView {
  version: string | null
  incomeClass: string | null
  incomeClassSource: string | null
  basis: CreditScorecardBasis | null
  rows: CreditScorecardRow[]
  total: number | null
  maxTotal: number
  band: number | null
  declined: boolean
  gate: { decline: boolean | null; codes: string[]; held: string[]; review: string[] }
  gateSignals: {
    signal: 'employer_income_30d' | 'employment_loss' | 'government_income_30d'
    value: boolean | null
  }[]
  /** Блок тира и суммы (19-4); `null`, пока снимок не несёт `client_type`. */
  amount: CreditScorecardAmount | null
}

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null)
const bool = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null)
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

/** Поле входа параметра и вид его значения (C20 зависит от класса). */
function inputField(
  parameter: CreditScorecardParameter,
  incomeClass: string | null
): [field: string, kind: Exclude<CreditScorecardInput['kind'], 'missing' | 'unknown'>] {
  switch (parameter) {
    case 'free_cash_flow_monthly':
      return ['free_cash_flow_monthly_minor', 'money']
    case 'overdraft':
      return ['overdraft', 'flag']
    case 'active_days_trend':
      return ['active_days_trend', 'trend']
    case 'history_days':
      return ['history_days', 'days']
    case 'income_trend':
      return incomeClass === 'B'
        ? ['government_income_30d', 'flag']
        : ['employer_income_trend', 'trend']
    default:
      return [parameter, 'count']
  }
}

function readInput(
  inputs: Json,
  missing: readonly string[],
  field: string,
  kind: ReturnType<typeof inputField>[1]
): CreditScorecardInput {
  const raw = inputs[field]
  if (raw === null || raw === undefined || missing.includes(field)) return { kind: 'missing' }
  if (kind === 'flag') {
    const value = bool(raw)
    return value === null ? { kind: 'unknown' } : { kind, value }
  }
  if (kind === 'trend') {
    const value = str(raw)
    return value === null ? { kind: 'unknown' } : { kind, value }
  }
  const value = num(raw)
  return value === null ? { kind: 'unknown' } : { kind, value }
}

function readBasis(value: unknown): CreditScorecardBasis | null {
  if (!isObject(value)) return null
  // Белый список: `amounts` (суммы пособий) и `missing` в модель не копируются.
  const evidence = isObject(value.evidence) ? value.evidence : {}
  return {
    declaredClass: str(value.declared_class),
    employmentStatus: str(value.employment_status),
    employmentStatusKnown: bool(value.employment_status_known),
    bNotConfirmed: bool(value.b_not_confirmed),
    evidence: (['employer_income_30d', 'b_income', 'c_income'] as const).map((signal) => ({
      signal,
      value: bool(evidence[signal]),
    })),
  }
}

function readAmount(scorecard: Json): CreditScorecardAmount | null {
  // Ключи 19-4 есть всегда под флагом; их отсутствие — модуль до 19-4.
  if (!('client_type' in scorecard)) return null
  const tier = isObject(scorecard.tier) ? scorecard.tier : null
  const installments = isObject(scorecard.installments) ? scorecard.installments : null
  return {
    clientType: num(scorecard.client_type),
    closedLoans: num(scorecard.closed_loans),
    tier: tier && {
      min: num(tier.min_minor),
      max: num(tier.max_minor),
      classBCap: tier.class_b_cap_applied === true,
    },
    scale: num(scorecard.scale_amount_minor),
    cap: num(scorecard.cap_amount_minor),
    rounded: num(scorecard.rounded_amount_minor),
    final: num(scorecard.final_amount_minor),
    installments: installments && { min: num(installments.min), max: num(installments.max) },
    codes: strings(scorecard.codes),
  }
}

export function readScorecard(
  snapshot?: CreditDecisionSnapshot | null
): CreditScorecardView | null {
  const scorecard: unknown = snapshot?.scorecard
  if (!isObject(scorecard)) return null

  const inputs = isObject(scorecard.inputs) ? scorecard.inputs : {}
  const missing = strings(inputs.missing)
  const points = isObject(scorecard.points) ? scorecard.points : {}
  const gate = isObject(scorecard.gate) ? scorecard.gate : {}
  const incomeClass = str(scorecard.income_class) ?? str(inputs.income_class)
  const band = num(scorecard.band)
  const decline = bool(gate.decline)

  const known: readonly string[] = CREDIT_SCORECARD_PARAMETERS
  const rows: CreditScorecardRow[] = CREDIT_SCORECARD_PARAMETERS.map((parameter) => {
    const row = SCORECARD_BOOK_ROWS[parameter]
    const [field, kind] = inputField(parameter, incomeClass)
    return {
      parameter,
      cell: row.cell,
      book: incomeClass === 'B' && row.bookClassB ? row.bookClassB : row.book,
      points: num(points[parameter]),
      input: readInput(inputs, missing, field, kind),
    }
  })
  for (const parameter of Object.keys(points)) {
    if (known.includes(parameter)) continue
    rows.push({
      parameter,
      cell: null,
      book: null,
      points: num(points[parameter]),
      input: { kind: 'unknown' },
    })
  }

  return {
    version: str(scorecard.version),
    incomeClass,
    incomeClassSource: str(scorecard.income_class_source) ?? str(inputs.income_class_source),
    basis: readBasis(snapshot?.income_class_basis),
    rows,
    total: num(scorecard.total),
    maxTotal: SCORECARD_MAX_TOTAL,
    band,
    declined: decline === true || band === 0,
    gate: {
      decline,
      codes: strings(gate.codes),
      held: strings(gate.held),
      review: strings(gate.review),
    },
    gateSignals: (['employer_income_30d', 'employment_loss', 'government_income_30d'] as const).map(
      (signal) => ({
        signal,
        value: missing.includes(signal) ? null : bool(inputs[signal]),
      })
    ),
    amount: readAmount(scorecard),
  }
}
