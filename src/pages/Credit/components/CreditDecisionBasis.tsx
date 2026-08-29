/**
 * «Підстава рішення» — цифры, на которых построен исход.
 *
 * Раньше они существовали только внутри чёрного `JSON.stringify` в окне
 * высотой 288 px: по-английски, в minor units, вперемешку со служебными
 * ключами. Андеррайтер физически не мог свериться с порогом, не разбирая JSON
 * глазами. Снимок остаётся ниже свёрнутым — он доказательство (DAT-02), но
 * читать оператор должен эту панель.
 */
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { formatDate } from '@/lib/formatters'
import { formatCreditMoney, formatCreditPercent } from '@/features/credit/api/money'
import type { CreditDecisionSnapshot } from '@/features/credit/api/types'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground w-64 shrink-0">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  )
}

export function CreditDecisionBasis({
  snapshot,
  currency,
}: {
  snapshot?: CreditDecisionSnapshot
  currency?: string
}) {
  const { t } = useTranslation('common')
  if (!snapshot) return null

  const money = (value?: number) => formatCreditMoney(value, currency)
  const income = snapshot.income_reconciliation
  const divergence = formatCreditPercent(income?.divergence_pct)
  const tolerance = formatCreditPercent(income?.tolerance_pct, 0)
  const bounds = snapshot.product_bounds_minor
  const requested = snapshot.requested_amount_minor
  const cap = snapshot.affordability_cap_minor
  const overCap = requested !== undefined && cap !== undefined && requested > cap

  const reviewReasons: string[] = []
  if (income?.needs_review) reviewReasons.push(t('credit.card.reviewIncome'))

  return (
    <section className="border-border bg-card mb-4 rounded-xl border shadow-sm">
      <h3 className="border-border flex min-h-[49px] items-center border-b px-4 text-sm font-semibold">
        {t('credit.card.decisionBasis')}
      </h3>
      <div className="p-4">
        {income && (
          <Row label={t('credit.fields.incomeCompare')}>
            <span>
              {money(income.declared_net_amount_minor)} →{' '}
              <strong>{money(income.verified_net_amount_minor)}</strong>
            </span>
            {divergence !== null && (
              <span className={income.needs_review ? 'text-warning-800' : 'text-muted-foreground'}>
                {' '}
                · {t('credit.fields.divergence')} {divergence} %
                {tolerance !== null && ` / ${tolerance} %`}
              </span>
            )}
          </Row>
        )}
        {snapshot.monthly_equivalent_minor !== undefined && (
          <Row label={t('credit.fields.monthlyIncome')}>
            {money(snapshot.monthly_equivalent_minor)}
          </Row>
        )}
        {cap !== undefined && (
          <Row label={t('credit.fields.affordabilityCap')}>
            <span className={overCap ? 'text-warning-800 font-medium' : ''}>{money(cap)}</span>
            {requested !== undefined && (
              <span className="text-muted-foreground">
                {' '}
                · {t('credit.fields.requested')}: {money(requested)}
              </span>
            )}
          </Row>
        )}
        {snapshot.active_loans !== undefined && (
          <Row label={t('credit.fields.activeLoans')}>{snapshot.active_loans}</Row>
        )}
        {bounds && (
          <Row label={t('credit.fields.productBounds')}>
            {money(bounds.min)} – {money(bounds.max)}
            {bounds.step ? (
              <span className="text-muted-foreground">
                {' '}
                · {t('credit.fields.step')} {money(bounds.step)}
              </span>
            ) : null}
          </Row>
        )}
        {snapshot.prior_decline_cooldown_until && (
          <Row label={t('credit.fields.priorCooldown')}>
            {formatDate(snapshot.prior_decline_cooldown_until)}
          </Row>
        )}

        {reviewReasons.length > 0 && (
          <Alert variant="warning" className="mt-3">
            {t('credit.card.reviewReasons')}: {reviewReasons.join(' · ')}
            {income?.review_reason ? ` (${income.review_reason})` : ''}
          </Alert>
        )}
      </div>
    </section>
  )
}

export default CreditDecisionBasis
