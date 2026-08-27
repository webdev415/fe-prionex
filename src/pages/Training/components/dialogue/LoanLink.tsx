import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { DebtDetail } from '@/features/clients/api/types'

// Same semantics as the client card's «Кредити» tab (LoansCardList):
// open/active = any status but 'closed'.
function isActiveLoan(debt: DebtDetail): boolean {
  return debt.status !== 'closed'
}
function loanRecency(debt: DebtDetail): number {
  const iso = debt.credit_issued_date ?? debt.debt_start_date ?? debt.purchase_date
  const ts = iso ? Date.parse(iso) : Number.NaN
  return Number.isNaN(ts) ? 0 : ts
}

/**
 * The loan to display for a call: the freshest ACTIVE loan (with a "+N more"
 * count when there are several active ones), falling back to the freshest loan
 * of any status when none is active. There is no per-call loan link in the
 * data (the call record carries only the client), so this is a display
 * heuristic — the link opens the client card where every loan is listed.
 */
function pickDisplayLoan(
  debts: DebtDetail[] | undefined
): { loan: DebtDetail; moreActive: number } | null {
  if (!debts || debts.length === 0) return null
  const active = debts.filter(isActiveLoan)
  const pool = active.length > 0 ? active : debts
  const loan = pool.reduce((best, d) => {
    const a = loanRecency(d)
    const b = loanRecency(best)
    if (a !== b) return a > b ? d : best
    return d.id > best.id ? d : best
  })
  return { loan, moreActive: Math.max(0, active.length - 1) }
}

/**
 * Loan-number link for a client: the display loan's contract number as a real
 * <Link> to the client card (which opens on the «Кредити» tab by default; a
 * ctrl/middle-click opens a new browser tab), plus a "+N more" badge when
 * other active loans exist. Renders `fallback` (default: nothing) when the
 * client has no loans yet. stopPropagation keeps a click inside selectable
 * table rows from also selecting the row.
 *
 * Shared by the Dialogue Evaluation list's loan column and the review panel
 * header («Навчання» п.8).
 */
export function LoanLink({
  clientId,
  debts,
  fallback = null,
}: {
  clientId: number | null | undefined
  debts?: DebtDetail[]
  fallback?: ReactNode
}) {
  const { t } = useTranslation('common')
  const picked = clientId != null ? pickDisplayLoan(debts) : null
  if (clientId == null || !picked) return <>{fallback}</>
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <Link
        to={`/dashboard/clients/${clientId}`}
        onClick={(e) => e.stopPropagation()}
        className="text-primary-600 hover:underline"
      >
        {picked.loan.contract_number}
      </Link>
      {picked.moreActive > 0 ? (
        <span
          data-testid="more-loans-badge"
          className="rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] font-medium text-[#4B5563]"
        >
          {t('pages.training.dialogue.list.moreLoans', '+{{count}} more', {
            count: picked.moreActive,
          })}
        </span>
      ) : null}
    </span>
  )
}

export default LoanLink
