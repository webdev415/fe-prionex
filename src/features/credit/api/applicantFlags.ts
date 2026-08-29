/**
 * Подсветка проблем в заявке.
 *
 * Требование CEO (29.08): «должны быть в заявке все данные заявителя
 * обязательно, подсвечивать, если что-то не так будет».
 *
 * Два вида подсветки держим РАЗДЕЛЬНО, потому что они требуют от оператора
 * разных действий:
 *   • `conflict` — данные противоречат друг другу (клиент заявил одно, банк
 *     видит другое). Действие: разобраться, кому верить.
 *   • `missing`  — данных не хватает (клиент не дошёл, блок пуст). Действие:
 *     дособрать.
 * Один общий значок обесценил бы оба.
 *
 * Каждый признак строится ТОЛЬКО из полей, которые реально приходят в ответе
 * (проверено на живых заявках стенда 29.08). Подсветка по полю, которого в
 * ответе нет, — это молчание, замаскированное под проверку.
 */
import type { CreditApplicationDetail } from './types'

export type CreditFlagKind = 'conflict' | 'missing'

export interface CreditApplicationFlag {
  id: string
  kind: CreditFlagKind
  /** Ключ перевода заголовка. */
  labelKey: string
  /** Подставляемые значения для перевода. */
  values?: Record<string, string | number>
  /** Насколько это серьёзно: danger — нельзя игнорировать. */
  severity: 'danger' | 'warn'
}

function toNumber(value?: string | number | null): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Собирает признаки «что-то не так» по заявке.
 * Порядок — по убыванию опасности: сначала расхождения, потом нехватка.
 */
export function collectApplicationFlags(
  application: CreditApplicationDetail
): CreditApplicationFlag[] {
  const flags: CreditApplicationFlag[] = []
  const ibv = application.ibv
  const snapshot = application.decision?.input_snapshot
  const reconciliation = snapshot?.income_reconciliation

  // --- противоречия --------------------------------------------------------

  const divergence = toNumber(reconciliation?.divergence_pct)
  const tolerance = toNumber(reconciliation?.tolerance_pct)
  const declared = reconciliation?.declared_net_amount_minor
  const verified = reconciliation?.verified_net_amount_minor
  if (divergence !== null && tolerance !== null && divergence > tolerance) {
    // Направление важнее самого факта: «заявил БОЛЬШЕ, чем видит банк» — это
    // сторона, на которой кредит выдают под несуществующий доход.
    const overstated = declared !== undefined && verified !== undefined && declared > verified
    flags.push({
      id: 'income-divergence',
      kind: 'conflict',
      labelKey: overstated ? 'credit.flags.incomeOverstated' : 'credit.flags.incomeDivergence',
      values: { divergence, tolerance },
      severity: overstated ? 'danger' : 'warn',
    })
  } else if (reconciliation?.needs_review) {
    flags.push({
      id: 'income-review',
      kind: 'conflict',
      labelKey: 'credit.flags.incomeNeedsReview',
      values: { reason: reconciliation.review_reason ?? '' },
      severity: 'warn',
    })
  }

  const identity = ibv?.identity_match_rate
  if (identity !== undefined && identity < 0.9) {
    flags.push({
      id: 'identity-mismatch',
      kind: 'conflict',
      labelKey: 'credit.flags.identityMismatch',
      values: { rate: Math.round(identity * 100) },
      severity: identity < 0.7 ? 'danger' : 'warn',
    })
  }

  const payday = ibv?.payday_reconciliation
  if (payday?.needs_review || payday?.dates_match === false) {
    flags.push({
      id: 'payday-mismatch',
      kind: 'conflict',
      labelKey: 'credit.flags.paydayMismatch',
      severity: 'warn',
    })
  }
  if (payday?.frequency_matches === false) {
    flags.push({
      id: 'frequency-mismatch',
      kind: 'conflict',
      labelKey: 'credit.flags.frequencyMismatch',
      values: {
        declared: payday.application_frequency ?? '—',
        detected: payday.detected_frequency ?? '—',
      },
      severity: 'warn',
    })
  }

  if (ibv?.payout_account_ambiguous) {
    flags.push({
      id: 'payout-ambiguous',
      kind: 'conflict',
      labelKey: 'credit.flags.payoutAmbiguous',
      severity: 'danger',
    })
  }

  const cap = snapshot?.affordability_cap_minor
  const requested = snapshot?.requested_amount_minor ?? application.requested_amount_minor
  if (cap !== undefined && requested > cap) {
    flags.push({
      id: 'over-affordability',
      kind: 'conflict',
      labelKey: 'credit.flags.overAffordability',
      severity: 'warn',
    })
  }

  // --- нехватка ------------------------------------------------------------

  const missing = application.missing_fields ?? []
  if (missing.length > 0) {
    flags.push({
      id: 'missing-blocks',
      kind: 'missing',
      labelKey: 'credit.flags.missingBlocks',
      values: { count: missing.length },
      severity: 'warn',
    })
  }

  if (!ibv || Object.keys(ibv).length === 0) {
    flags.push({
      id: 'no-ibv',
      kind: 'missing',
      labelKey: 'credit.flags.noIbv',
      severity: 'warn',
    })
  } else if (ibv.status && ibv.status !== 'completed') {
    flags.push({
      id: 'ibv-incomplete',
      kind: 'missing',
      labelKey: 'credit.flags.ibvIncomplete',
      values: { status: ibv.status },
      severity: 'warn',
    })
  }

  if (!application.client_phone) {
    flags.push({
      id: 'no-phone',
      kind: 'missing',
      labelKey: 'credit.flags.noPhone',
      severity: 'warn',
    })
  }

  const consents = application.consents ?? []
  const ungranted = consents.filter((consent) => !consent.granted)
  if (ungranted.length > 0) {
    flags.push({
      id: 'consents-missing',
      kind: 'missing',
      labelKey: 'credit.flags.consentsMissing',
      values: { count: ungranted.length },
      severity: 'danger',
    })
  }

  return flags
}
