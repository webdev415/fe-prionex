import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { usePayment, usePaymentDebtBreakdown } from '@/features/payments/hooks/usePayments'
import { formatMoneyUAHTwoDecimals } from '@/lib/formatters'

class BreakdownErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('PaymentDebtBreakdown error:', error, info)
  }
  render() {
    if (this.state.hasError) return null
    return this.children
  }
  get children() {
    return this.props.children
  }
}

interface PaymentDebtBreakdownProps {
  paymentId: string
}

export function PaymentDebtBreakdown({ paymentId }: PaymentDebtBreakdownProps) {
  return (
    <BreakdownErrorBoundary>
      <PaymentDebtBreakdownInner paymentId={paymentId} />
    </BreakdownErrorBoundary>
  )
}

function PaymentDebtBreakdownInner({ paymentId }: PaymentDebtBreakdownProps) {
  const { t } = useTranslation('payments')
  const { data: payment, isLoading: isLoadingPayment } = usePayment(paymentId)

  const isCancelled = payment?.status === 'cancelled'
  const hasDebtId = !!payment?.debt_id

  const {
    data: breakdown,
    isLoading: isLoadingBreakdown,
    isError,
    refetch,
  } = usePaymentDebtBreakdown(paymentId, {
    // H-3: cancelled snapshotted payments must still render the
    // historical allocation. The BE preserves ``allocated_*`` across
    // cancel; the modal surfaces the cancelled state via an inline
    // badge instead of hiding the table.
    enabled: hasDebtId,
  })

  const componentLabels: Record<string, string> = {
    principal: t('breakdown.principal'),
    interest: t('breakdown.interest'),
    fees: t('breakdown.fees'),
    penalties: t('breakdown.penalties'),
    fines: t('breakdown.fines'),
  }

  // Loading state
  if (isLoadingPayment || (hasDebtId && isLoadingBreakdown)) {
    return (
      <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
        <h4 className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400">
          {t('breakdown.title')}
        </h4>
        <div className="animate-pulse space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-8 rounded bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      </div>
    )
  }

  // No debt associated
  if (!hasDebtId) {
    return (
      <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
        <h4 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
          {t('breakdown.title')}
        </h4>
        <p className="text-sm text-gray-400 italic dark:text-gray-500">{t('breakdown.no_debt')}</p>
      </div>
    )
  }

  // Error state
  if (isError || !breakdown) {
    return (
      <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
        <h4 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
          {t('breakdown.title')}
        </h4>
        <div className="flex items-center gap-2 text-sm text-red-500">
          <Icons.Warning className="h-4 w-4" />
          <span>{t('breakdown.error')}</span>
          <button
            onClick={() => refetch()}
            className="ml-2 inline-flex items-center gap-1 text-blue-500 underline hover:text-blue-700"
          >
            <Icons.Reload className="h-3 w-3" />
            {t('breakdown.retry')}
          </button>
        </div>
      </div>
    )
  }

  const isPending = breakdown.payment_status === 'pending'
  // H-3: render cancelled rows with the same muted styling as pending
  // so the historical allocation reads as "not contributing to the
  // current balance" rather than as a fresh successful allocation.
  const isMuted = isPending || isCancelled

  return (
    <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {t('breakdown.title')}
        </h4>
        {isCancelled ? (
          // H-3: cancelled snapshotted payments render the historical
          // allocation with an inline cancelled badge instead of a
          // placeholder. The BE preserves ``allocated_*`` across cancel.
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 italic dark:text-gray-400">
            <Icons.Close className="h-3 w-3" />
            {t('breakdown.cancelled_note')}
          </span>
        ) : isPending ? (
          <span className="text-xs text-amber-600 italic dark:text-amber-400">
            {t('breakdown.pending_note')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <Icons.Checkmark className="h-3 w-3" />
            {t('breakdown.verified_note')}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <th className="pb-2 font-medium">{t('breakdown.component')}</th>
              <th className="pb-2 text-right font-medium">{t('breakdown.original')}</th>
              <th className="pb-2 text-right font-medium">{t('breakdown.allocated')}</th>
              <th className="pb-2 text-right font-medium">{t('breakdown.paid')}</th>
              <th className="pb-2 text-right font-medium">{t('breakdown.written_off')}</th>
              <th className="pb-2 text-right font-medium">{t('breakdown.remaining')}</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.allocation.map((item) => (
              <tr key={item.component} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 text-gray-700 dark:text-gray-300">
                  {componentLabels[item.component] || item.component_label}
                </td>
                <td className="py-2 text-right text-gray-600 dark:text-gray-400">
                  {formatMoneyUAHTwoDecimals(item.original_amount)}
                </td>
                <td
                  className={`py-2 text-right font-medium ${
                    isMuted
                      ? 'text-gray-500 dark:text-gray-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}
                >
                  {formatMoneyUAHTwoDecimals(item.allocated_amount)}
                </td>
                <td className="py-2 text-right text-gray-600 dark:text-gray-400">
                  {formatMoneyUAHTwoDecimals(Number(item.paid_amount ?? 0))}
                </td>
                <td className="py-2 text-right text-gray-500 dark:text-gray-400">
                  {formatMoneyUAHTwoDecimals(Number(item.written_off_amount ?? 0))}
                </td>
                <td className="py-2 text-right">
                  {Number(item.remaining_balance) === 0 ? (
                    <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                      {formatMoneyUAHTwoDecimals(0)}
                      <Icons.Checkmark className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span className="text-gray-700 dark:text-gray-300">
                      {formatMoneyUAHTwoDecimals(item.remaining_balance)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {/* Defensive Unmatched / Overpayment row (Phase 5 of
                payment-allocation-snapshot). Rendered only when the
                backend reports a non-zero residue (Σ allocated_* < amount).
                Old backends omit ``unmatched`` — treat as 0 and skip. */}
            {Number(breakdown.unmatched ?? 0) > 0.01 && (
              <tr
                className="border-b border-amber-200 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-900/20"
                title={t('breakdown.unmatched_tooltip')}
              >
                <td className="py-2 font-medium text-amber-700 dark:text-amber-300">
                  <span className="inline-flex items-center gap-1">
                    <Icons.Warning className="h-3.5 w-3.5" />
                    {t('breakdown.unmatched')}
                  </span>
                </td>
                <td className="py-2 text-right text-amber-700 dark:text-amber-300">—</td>
                <td className="py-2 text-right font-medium text-amber-700 dark:text-amber-300">
                  {formatMoneyUAHTwoDecimals(Number(breakdown.unmatched ?? 0))}
                </td>
                <td className="py-2 text-right text-amber-700 dark:text-amber-300">—</td>
                <td className="py-2 text-right text-amber-700 dark:text-amber-300">—</td>
                <td className="py-2 text-right text-amber-700 dark:text-amber-300">—</td>
              </tr>
            )}
            {/* Total row */}
            <tr className="border-t-2 border-gray-300 font-bold dark:border-gray-600">
              <td className="pt-2 text-gray-900 dark:text-gray-100">{t('breakdown.total')}</td>
              <td className="pt-2 text-right text-gray-900 dark:text-gray-100">
                {formatMoneyUAHTwoDecimals(breakdown.total_original ?? 0)}
              </td>
              <td
                className={`pt-2 text-right ${
                  isMuted
                    ? 'text-gray-600 dark:text-gray-300'
                    : 'text-green-700 dark:text-green-300'
                }`}
              >
                {formatMoneyUAHTwoDecimals(breakdown.total_allocated)}
              </td>
              <td className="pt-2 text-right text-gray-900 dark:text-gray-100">
                {formatMoneyUAHTwoDecimals(breakdown.total_paid ?? 0)}
              </td>
              <td className="pt-2 text-right text-gray-500 dark:text-gray-400">
                {formatMoneyUAHTwoDecimals(breakdown.total_written_off ?? 0)}
              </td>
              <td className="pt-2 text-right text-gray-900 dark:text-gray-100">
                {formatMoneyUAHTwoDecimals(breakdown.total_remaining_debt)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
