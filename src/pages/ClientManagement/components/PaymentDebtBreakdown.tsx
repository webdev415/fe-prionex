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
      <div className="border-border mt-4 border-t pt-4">
        <h4 className="text-muted-foreground mb-3 text-sm font-medium">{t('breakdown.title')}</h4>
        <div className="animate-pulse space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-muted h-8 rounded" />
          ))}
        </div>
      </div>
    )
  }

  // No debt associated
  if (!hasDebtId) {
    return (
      <div className="border-border mt-4 border-t pt-4">
        <h4 className="text-muted-foreground mb-2 text-sm font-medium">{t('breakdown.title')}</h4>
        <p className="text-muted-foreground text-sm italic">{t('breakdown.no_debt')}</p>
      </div>
    )
  }

  // Error state
  if (isError || !breakdown) {
    return (
      <div className="border-border mt-4 border-t pt-4">
        <h4 className="text-muted-foreground mb-2 text-sm font-medium">{t('breakdown.title')}</h4>
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
    <div className="border-border mt-4 border-t pt-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-muted-foreground text-sm font-medium">{t('breakdown.title')}</h4>
        {breakdown.is_reversed ? (
          // KAN-334: reversed payments show the RE-ALLOCATED split (the BE
          // overrides allocated_amount with the reversal's new amounts) plus
          // a "Reversed" badge.
          <span className="text-foreground inline-flex items-center gap-1 text-xs">
            <Icons.Reload className="h-3 w-3" />
            {t('breakdown.reversed_note')}
          </span>
        ) : isCancelled ? (
          // H-3: cancelled snapshotted payments render the historical
          // allocation with an inline cancelled badge instead of a
          // placeholder. The BE preserves ``allocated_*`` across cancel.
          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs italic">
            <Icons.Close className="h-3 w-3" />
            {t('breakdown.cancelled_note')}
          </span>
        ) : isPending ? (
          <span className="text-warning-600 text-xs italic">{t('breakdown.pending_note')}</span>
        ) : (
          <span className="text-success-600 inline-flex items-center gap-1 text-xs">
            <Icons.Checkmark className="h-3 w-3" />
            {t('breakdown.verified_note')}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left">
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
              <tr key={item.component} className="border-border border-b">
                <td className="text-foreground py-2">
                  {componentLabels[item.component] || item.component_label}
                </td>
                <td className="text-muted-foreground py-2 text-right">
                  {formatMoneyUAHTwoDecimals(item.original_amount)}
                </td>
                <td
                  className={`py-2 text-right font-medium ${
                    isMuted ? 'text-muted-foreground' : 'text-success-600'
                  }`}
                >
                  {formatMoneyUAHTwoDecimals(item.allocated_amount)}
                </td>
                <td className="text-muted-foreground py-2 text-right">
                  {formatMoneyUAHTwoDecimals(Number(item.paid_amount ?? 0))}
                </td>
                <td className="text-muted-foreground py-2 text-right">
                  {formatMoneyUAHTwoDecimals(Number(item.written_off_amount ?? 0))}
                </td>
                <td className="py-2 text-right">
                  {Number(item.remaining_balance) === 0 ? (
                    <span className="text-success-600 inline-flex items-center gap-1">
                      {formatMoneyUAHTwoDecimals(0)}
                      <Icons.Checkmark className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span className="text-foreground">
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
                className="border-warning-200 bg-warning-100 border-b"
                title={t('breakdown.unmatched_tooltip')}
              >
                <td className="text-warning-700 py-2 font-medium">
                  <span className="inline-flex items-center gap-1">
                    <Icons.Warning className="h-3.5 w-3.5" />
                    {t('breakdown.unmatched')}
                  </span>
                </td>
                <td className="text-warning-700 py-2 text-right">—</td>
                <td className="text-warning-700 py-2 text-right font-medium">
                  {formatMoneyUAHTwoDecimals(Number(breakdown.unmatched ?? 0))}
                </td>
                <td className="text-warning-700 py-2 text-right">—</td>
                <td className="text-warning-700 py-2 text-right">—</td>
                <td className="text-warning-700 py-2 text-right">—</td>
              </tr>
            )}
            {/* Total row */}
            <tr className="border-border border-t-2 font-bold">
              <td className="text-foreground pt-2">{t('breakdown.total')}</td>
              <td className="text-foreground pt-2 text-right">
                {formatMoneyUAHTwoDecimals(breakdown.total_original ?? 0)}
              </td>
              <td
                className={`pt-2 text-right ${
                  isMuted ? 'text-muted-foreground' : 'text-success-700'
                }`}
              >
                {formatMoneyUAHTwoDecimals(breakdown.total_allocated)}
              </td>
              <td className="text-foreground pt-2 text-right">
                {formatMoneyUAHTwoDecimals(breakdown.total_paid ?? 0)}
              </td>
              <td className="text-muted-foreground pt-2 text-right">
                {formatMoneyUAHTwoDecimals(breakdown.total_written_off ?? 0)}
              </td>
              <td className="text-foreground pt-2 text-right">
                {formatMoneyUAHTwoDecimals(breakdown.total_remaining_debt)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
