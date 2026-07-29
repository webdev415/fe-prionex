/**
 * Verified payment totals grouped by contract (Debt Summary breakdown cards).
 */

import { useTranslation } from 'react-i18next'
import { formatMoneyUAHTwoDecimals } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { ContractVerifiedSummary } from '@/features/payments/utils/verifiedPaymentsByContract'

interface VerifiedPaymentsByContractProps {
  contracts: ContractVerifiedSummary[]
}

export function VerifiedPaymentsByContract({ contracts }: VerifiedPaymentsByContractProps) {
  const { t } = useTranslation('common')

  return (
    <div className="border-border bg-card flex w-full flex-col items-stretch border-t px-4 py-4 sm:px-6 sm:py-5">
      <span className="text-muted-foreground text-[10px] leading-[150%] font-medium tracking-[0.08em] uppercase sm:text-xs">
        {t('pages.clients.debtSummary.verifiedByContract.title')}
      </span>
      {contracts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3">
          {contracts.map((item) => {
            const isEmpty = item.verifiedCount === 0
            return (
              <div
                key={item.contractNumber}
                className="border-border bg-card flex min-w-[9.5rem] flex-1 flex-col gap-2 rounded-lg border px-4 py-3 sm:min-w-[10.5rem]"
              >
                <span className="text-muted-foreground text-xs leading-[150%] font-medium tracking-[-0.24px]">
                  {t('pages.clients.debtSummary.verifiedByContract.contract', {
                    number: item.contractNumber,
                  })}
                </span>
                <span
                  className={cn(
                    'text-foreground text-base leading-[132%] font-medium tracking-[-0.4px] sm:text-xl',
                    isEmpty && 'text-muted-foreground'
                  )}
                >
                  {formatMoneyUAHTwoDecimals(item.totalVerified)}
                </span>
                <span
                  className={cn(
                    'text-muted-foreground text-xs leading-[150%] font-medium tracking-[-0.24px]',
                    isEmpty && 'text-muted-foreground'
                  )}
                >
                  {item.verifiedCount === 1
                    ? t('pages.clients.debtSummary.verifiedByContract.payments_one')
                    : t('pages.clients.debtSummary.verifiedByContract.payments', {
                        count: item.verifiedCount,
                      })}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
