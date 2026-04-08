import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { usePayment, usePaymentDebtBreakdown } from '@/features/payments/hooks/usePayments'

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
  const { t, i18n } = useTranslation('payments')
  const { data: payment, isLoading: isLoadingPayment } = usePayment(paymentId)

  const isCancelled = payment?.status === 'cancelled'
  const hasDebtId = !!payment?.debt_id

  const {
    data: breakdown,
    isLoading: isLoadingBreakdown,
    isError,
    refetch,
  } = usePaymentDebtBreakdown(paymentId, {
    enabled: hasDebtId && !isCancelled,
  })

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return '₴ 0.00'
    const locale = i18n.language === 'uk' ? 'uk-UA' : i18n.language === 'ru' ? 'ru-RU' : 'en-US'
    return `₴ ${num.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const componentLabels: Record<string, string> = {
    principal: t('breakdown.principal'),
    interest: t('breakdown.interest'),
    fees: t('breakdown.fees'),
    penalties: t('breakdown.penalties'),
    fines: t('breakdown.fines'),
  }

  // Loading state
  if (isLoadingPayment || (hasDebtId && !isCancelled && isLoadingBreakdown)) {
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

  // Cancelled payment
  if (isCancelled) {
    return (
      <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
        <h4 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
          {t('breakdown.title')}
        </h4>
        <p className="text-sm text-gray-400 italic dark:text-gray-500">
          {t('breakdown.cancelled_note')}
        </p>
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

  return (
    <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {t('breakdown.title')}
        </h4>
        {isPending ? (
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
                  {formatCurrency(item.original_amount)}
                </td>
                <td
                  className={`py-2 text-right font-medium ${
                    isPending
                      ? 'text-gray-500 dark:text-gray-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}
                >
                  {formatCurrency(item.allocated_amount)}
                </td>
                <td className="py-2 text-right">
                  {Number(item.remaining_balance) === 0 ? (
                    <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                      {formatCurrency(0)}
                      <Icons.Checkmark className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span className="text-gray-700 dark:text-gray-300">
                      {formatCurrency(item.remaining_balance)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {/* Total row */}
            <tr className="border-t-2 border-gray-300 font-bold dark:border-gray-600">
              <td className="pt-2 text-gray-900 dark:text-gray-100">{t('breakdown.total')}</td>
              <td className="pt-2 text-right text-gray-900 dark:text-gray-100">
                {formatCurrency(
                  breakdown.allocation.reduce((sum, a) => sum + Number(a.original_amount), 0)
                )}
              </td>
              <td
                className={`pt-2 text-right ${
                  isPending
                    ? 'text-gray-600 dark:text-gray-300'
                    : 'text-green-700 dark:text-green-300'
                }`}
              >
                {formatCurrency(breakdown.total_allocated)}
              </td>
              <td className="pt-2 text-right text-gray-900 dark:text-gray-100">
                {formatCurrency(breakdown.total_remaining_debt)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
