/**
 * LoanFactoringInfo
 *
 * Renders the factoring-agreement details for a single debt, shown inside
 * the expandable row on `ClientDetailPage`'s loan table. Three locked
 * fields per the requirement:
 *
 *   1. Full legal name of the seller (primary creditor)
 *   2. Who sold the debt (previous_lender)
 *   3. Purchase date from the agreement (contract_purchase_date)
 *
 * Falls back to an empty-state message when the debt has no linked
 * factoring agreement. This is the common case for pre-step-4 production
 * debts (most have ``factoring_agreement_id = NULL`` until the historical
 * backfill ships) — the copy is intentionally non-alarming.
 */

import { useTranslation } from 'react-i18next'

interface LoanFactoringInfoProps {
  /** Seller's full legal name (denormalized from ``sellers.legal_name``). */
  legalName: string | null | undefined
  /** Counterparty that sold the debts to the project (from the agreement). */
  previousLender: string | null | undefined
  /** Agreement-level purchase date (NOT the per-debt ``debts.purchase_date``). */
  purchaseDate: string | null | undefined
}

export function LoanFactoringInfo({
  legalName,
  previousLender,
  purchaseDate,
}: LoanFactoringInfoProps) {
  const { t } = useTranslation('common')

  const hasAny = legalName || previousLender || purchaseDate

  if (!hasAny) {
    return (
      <p className="text-muted-foreground text-sm font-light">
        {t(
          'pages.clients.detail.factoringInfo.empty',
          'This debt is not linked to a factoring agreement.'
        )}
      </p>
    )
  }

  return (
    <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-6">
      <dt className="text-muted-foreground font-medium">
        {t('pages.clients.detail.factoringInfo.legalName', 'Legal name')}
      </dt>
      <dd className="text-foreground font-light">{legalName || '—'}</dd>

      <dt className="text-muted-foreground font-medium">
        {t('pages.clients.detail.factoringInfo.previousLender', 'Who sold')}
      </dt>
      <dd className="text-foreground font-light">{previousLender || '—'}</dd>

      <dt className="text-muted-foreground font-medium">
        {t('pages.clients.detail.factoringInfo.purchaseDate', 'Purchase date')}
      </dt>
      <dd className="text-foreground font-light">{purchaseDate || '—'}</dd>
    </dl>
  )
}

export default LoanFactoringInfo
