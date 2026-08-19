import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

import type { LoanCardLoan } from './LoanCard'

/**
 * KAN-993 — the Loans tab split into two card sections (supersedes the KAN-339
 * grid). Open loans (always expanded) and Closed loans (collapsible, collapsed
 * by default), each with a count badge. Card rendering is delegated to
 * `renderLoan` so the parent keeps ownership of the per-loan actions/state.
 */

type LoansCardListProps = {
  loans: LoanCardLoan[]
  renderLoan: (loan: LoanCardLoan, isClosed: boolean) => React.ReactNode
  /** "Send all loans to UBKI" button (rendered under the sections). */
  sendAllButton?: React.ReactNode
  /** UBKI submission history block. */
  ubkiHistory?: React.ReactNode
}

function CountBadge({ n }: { n: number }) {
  return (
    <span className="bg-muted text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium">
      {n}
    </span>
  )
}

export function LoansCardList({
  loans,
  renderLoan,
  sendAllButton,
  ubkiHistory,
}: LoansCardListProps) {
  const { t } = useTranslation('common')
  const [closedOpen, setClosedOpen] = useState(false)

  const { openLoans, closedLoans } = useMemo(() => {
    const open: LoanCardLoan[] = []
    const closed: LoanCardLoan[] = []
    for (const loan of loans) {
      ;(loan.status === 'closed' ? closed : open).push(loan)
    }
    return { openLoans: open, closedLoans: closed }
  }, [loans])

  return (
    <div className="flex flex-col gap-4 px-3 py-4 md:px-6">
      {/* Open loans — always expanded (AC #1) */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <Icons.Unlock size={18} className="text-muted-foreground" />
          <h3 className="text-foreground text-sm font-semibold">
            {t('pages.clients.detail.openLoans', 'Open loans')}
          </h3>
          <CountBadge n={openLoans.length} />
        </div>
        <div className="flex flex-col gap-2.5">
          {openLoans.map((loan) => renderLoan(loan, false))}
        </div>
      </section>

      {/* Closed loans — collapsible, collapsed by default (AC #1) */}
      <section className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => setClosedOpen((v) => !v)}
          className="flex items-center gap-2"
        >
          <Icons.Lock size={18} className="text-muted-foreground" />
          <h3 className="text-foreground text-sm font-semibold">
            {t('pages.clients.detail.closedLoans', 'Closed loans')}
          </h3>
          <CountBadge n={closedLoans.length} />
          <Icons.ArrowRight
            size={16}
            className={cn('text-muted-foreground transition-transform', closedOpen && 'rotate-90')}
          />
        </button>
        {closedOpen && (
          <div className="flex flex-col gap-2.5">
            {closedLoans.map((loan) => renderLoan(loan, true))}
          </div>
        )}
      </section>

      {sendAllButton}
      {ubkiHistory}
    </div>
  )
}
