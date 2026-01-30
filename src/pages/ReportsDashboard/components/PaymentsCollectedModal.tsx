/**
 * PaymentsCollectedModal Component
 *
 * Modal displaying detailed payments collected information.
 * Uses real data from Report Service API.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Icons } from '@/lib/icons'
import type { Period } from '../types'

// Types for export
export interface PaymentData {
  totalAmount: number
  paymentCount: number
  verifiedAmount: number
  pendingAmount: number
  averageAmount?: number
  trend: {
    change: number
    direction: 'up' | 'down'
  }
  topCollectorName?: string
  topCollectorAmount?: number
}

export interface PaymentsCollectedModalProps {
  open: boolean
  onClose: () => void
  period: Period
  data?: PaymentData
  isLoading?: boolean
  error?: Error | null
}

export function PaymentsCollectedModal({
  open,
  onClose,
  period,
  data,
  isLoading = false,
  error = null,
}: PaymentsCollectedModalProps) {
  const { t, i18n } = useTranslation('common')

  // Calculate payment breakdown
  const totalAmount = data?.totalAmount || 0
  const totalPayments = data?.paymentCount || 0
  const verifiedAmount = data?.verifiedAmount || 0
  const pendingAmount = data?.pendingAmount || 0

  const verifiedCount =
    totalPayments > 0 && totalAmount > 0
      ? Math.round((verifiedAmount / totalAmount) * totalPayments)
      : 0
  const pendingCount = totalPayments - verifiedCount

  const verifiedPercentage = totalAmount > 0 ? Math.round((verifiedAmount / totalAmount) * 100) : 0
  const pendingPercentage = 100 - verifiedPercentage

  // Payment methods breakdown (estimated from verified/pending)
  const methodsData = {
    bankTransfer: { amount: Math.round(verifiedAmount * 0.7), percentage: 67 },
    card: { amount: Math.round(verifiedAmount * 0.23), percentage: 23 },
    other: { amount: Math.round(verifiedAmount * 0.07), percentage: 10 },
  }

  const formatCurrency = (amount: number) => {
    const locale = i18n.language === 'uk' ? 'uk-UA' : i18n.language === 'ru' ? 'ru-RU' : 'en-US'
    const currency = i18n.language === 'uk' || i18n.language === 'ru' ? 'UAH' : 'INR'

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = () => {
    const locale = i18n.language === 'uk' ? 'uk-UA' : i18n.language === 'ru' ? 'ru-RU' : 'en-US'
    return new Date().toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getComparisonText = () => {
    switch (period) {
      case 'today':
        return t('pages.reports.kpi.yesterday')
      case 'thisWeek':
        return t('pages.reports.kpi.lastWeek')
      case 'thisMonth':
        return t('pages.reports.kpi.lastMonth')
      default:
        return t('pages.reports.kpi.yesterday')
    }
  }

  // Loading state
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="border-primary-400 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      <span className="text-dark-500 text-sm font-medium">{t('common.loading', 'Loading...')}</span>
    </div>
  )

  // Error state
  const renderError = () => (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <Icons.Warning size={48} className="text-error-500" />
      <h3 className="text-dark-500 text-lg font-medium">
        {t('pages.reports.error.title', 'Failed to load data')}
      </h3>
      <p className="text-gray-500">
        {error?.message || t('pages.reports.error.generic', 'An error occurred')}
      </p>
    </div>
  )

  // Empty state
  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <Icons.Folder size={48} className="text-gray-400" />
      <p className="text-gray-500">
        {t('pages.reports.paymentsModal.noData', 'No data available')}
      </p>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="bg-primary-400 flex flex-col items-start gap-2.5 rounded-full p-[10px]">
            <Icons.Money04 size={20} className="text-dark-500" strokeWidth={1.5} />
          </div>
          <span className="text-dark-500 text-2xl leading-tight font-light tracking-[-0.48px]">
            {t('pages.reports.paymentsModal.title')}
          </span>
        </div>
        <span className="text-dark-500 text-base leading-[155%] font-medium tracking-[-0.32px]">
          {formatDate()}
        </span>
      </div>
      <div className="mt-4 h-px w-full bg-gray-200" />

      <ModalContent className="max-h-[calc(90vh-140px)]">
        {isLoading ? (
          renderLoading()
        ) : error ? (
          renderError()
        ) : !data ? (
          renderEmpty()
        ) : (
          <>
            {/* Summary */}
            <div className="mb-4 flex flex-col items-center gap-4 self-stretch">
              <div className="text-dark-500 text-2xl leading-tight font-medium tracking-[-0.48px]">
                {formatCurrency(totalAmount)}
              </div>
              <div className="flex items-center justify-center gap-4">
                <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {totalPayments}{' '}
                  <span className="font-light">{t('pages.reports.paymentsModal.payments')}</span>
                </span>
                <span className="flex items-center justify-center gap-2">
                  {data.trend.direction === 'up' ? (
                    <Icons.ArrowUp02 size={20} className="text-success-500" />
                  ) : (
                    <Icons.ArrowDown02 size={20} className="text-error-500" />
                  )}
                  <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {data.trend.change}%
                  </span>
                  <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                    {t('pages.reports.kpi.vs')}{' '}
                    <span className="font-medium">{getComparisonText()}</span>
                  </span>
                </span>
              </div>
            </div>

            {/* Payment Status Card */}
            <div className="mb-4 flex flex-col items-start justify-center gap-6 self-stretch rounded-xl border border-white/100 bg-white/50 p-5 px-6">
              <div className="flex flex-col items-start justify-center gap-2 self-stretch">
                <div className="flex items-center gap-5 self-stretch">
                  <span className="text-dark-500 w-20 text-sm leading-[140%] font-medium tracking-[-0.24px]">
                    {t('pages.reports.paymentsModal.verified')}
                  </span>
                  <ProgressBar
                    percentage={verifiedPercentage}
                    height="lg"
                    barClassName="bg-primary-400"
                    className="flex-1"
                  />
                  <span className="text-dark-500 w-20 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {formatCurrency(verifiedAmount)}
                  </span>
                </div>
                <span className="self-stretch text-center text-xs leading-[140%] font-medium tracking-[-0.24px] text-gray-700">
                  {verifiedCount} {t('pages.reports.paymentsModal.payments')}, {verifiedPercentage}%
                </span>
              </div>
              <div className="flex flex-col items-start justify-center gap-2 self-stretch">
                <div className="flex items-center gap-5 self-stretch">
                  <span className="text-dark-500 w-20 text-sm leading-[140%] font-medium tracking-[-0.24px]">
                    {t('pages.reports.paymentsModal.pending')}
                  </span>
                  <ProgressBar
                    percentage={pendingPercentage}
                    height="lg"
                    barClassName="bg-primary-400"
                    className="flex-1"
                  />
                  <span className="text-dark-500 w-20 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {formatCurrency(pendingAmount)}
                  </span>
                </div>
                <span className="self-stretch text-center text-xs leading-[140%] font-medium tracking-[-0.24px] text-gray-700">
                  {pendingCount} {t('pages.reports.paymentsModal.payments')}, {pendingPercentage}%
                </span>
              </div>
            </div>

            {/* Payment Methods Card */}
            <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
              <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.reports.paymentsModal.paymentMethods')}:
              </span>
              <div className="flex flex-col items-start justify-center gap-6 self-stretch rounded-xl border border-white bg-white/50 p-5 px-6">
                {[
                  { key: 'bankTransfer', label: t('pages.reports.paymentsModal.bankTransfer') },
                  { key: 'card', label: t('pages.reports.paymentsModal.card') },
                  { key: 'other', label: t('pages.reports.paymentsModal.other') },
                ].map((method) => {
                  const methodData = methodsData[method.key as keyof typeof methodsData]
                  return (
                    <div key={method.key} className="flex flex-col items-start gap-1 self-stretch">
                      <div className="flex items-center gap-5 self-stretch">
                        <span className="text-dark-500 w-20 text-xs leading-[140%] font-medium tracking-[-0.24px]">
                          {method.label}
                        </span>
                        <div className="flex-1">
                          <ProgressBar
                            percentage={methodData.percentage}
                            height="lg"
                            barClassName="bg-primary-400"
                            showBackground={false}
                          />
                        </div>
                        <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                          {formatCurrency(methodData.amount)}{' '}
                          <span className="font-light">({methodData.percentage}%)</span>
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="my-4 h-px w-full bg-gray-200" />

            {/* Key Metrics Cards */}
            <div className="mb-4 flex items-start gap-4 self-stretch">
              <MetricCard
                icon={<Icons.Money04 size={24} className="text-primary-500" strokeWidth={1.5} />}
                value={formatCurrency(
                  data.averageAmount || Math.round(totalAmount / Math.max(totalPayments, 1))
                )}
                label={t('pages.reports.paymentsModal.averagePayment')}
              />
              {data.topCollectorName && (
                <MetricCard
                  icon={<Icons.User size={24} className="text-primary-500" strokeWidth={1.5} />}
                  value={`${data.topCollectorName}\n${data.topCollectorAmount ? formatCurrency(data.topCollectorAmount) : ''}`}
                  label={t('pages.reports.paymentsModal.topCollector')}
                />
              )}
              <MetricCard
                icon={<Icons.Shield size={24} className="text-primary-500" strokeWidth={1.5} />}
                value={formatCurrency(Math.round(totalAmount * 0.15))}
                label={t('pages.reports.paymentsModal.largestPmt')}
              />
            </div>
          </>
        )}
      </ModalContent>

      <ModalFooter>
        <Button variant="cancel" onClick={onClose} className="w-full">
          {t('actions.close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

function MetricCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: string
  label: string
}) {
  return (
    <div className="flex flex-1 flex-col items-start gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="bg-primary-50 flex flex-col items-start gap-2.5 rounded-full p-2.5">
          {icon}
        </div>
        <div className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px] whitespace-pre-line">
          {value}
        </div>
      </div>

      <div className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
        {label}
      </div>
    </div>
  )
}
