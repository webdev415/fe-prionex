/**
 * PaymentsCollectedModal Component
 *
 * Modal displaying detailed payments collected information.
 */

import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Icons } from '@/lib/icons'
import { getMockDashboard } from '../mockReportsData'
import type { Period } from '../types'

export interface PaymentsCollectedModalProps {
  open: boolean
  onClose: () => void
  period: Period
}

export function PaymentsCollectedModal({ open, onClose, period }: PaymentsCollectedModalProps) {
  const { t, i18n } = useTranslation('common')

  // Get mock dashboard data for the selected period
  const dashboardData = getMockDashboard(period)
  const kpis = dashboardData.kpis

  // Calculate payment breakdown from dashboard KPIs
  const verifiedCount = Math.round(
    (kpis.payments_verified / kpis.payments_collected_today) * kpis.payments_count_today
  )
  const pendingCount = kpis.payments_count_today - verifiedCount

  const verifiedPercentage =
    kpis.payments_collected_today > 0
      ? Math.round((kpis.payments_verified / kpis.payments_collected_today) * 100)
      : 0
  const pendingPercentage = 100 - verifiedPercentage

  // Mock payment methods breakdown (not in API spec yet, but needed for UI)
  const data = {
    totalAmount: kpis.payments_collected_today,
    totalPayments: kpis.payments_count_today,
    change: 12, // This would come from API comparison
    verified: {
      count: verifiedCount,
      percentage: verifiedPercentage,
      amount: kpis.payments_verified,
    },
    pending: {
      count: pendingCount,
      percentage: pendingPercentage,
      amount: kpis.payments_pending,
    },
    methods: {
      bankTransfer: { amount: kpis.payments_verified, percentage: 67 },
      card: { amount: kpis.payments_pending, percentage: 23 },
      other: { amount: 15000, percentage: 10 },
    },
    averagePayment: kpis.avg_payment_amount,
    topCollector: {
      name: dashboardData.top_operators[0]?.operator_name || 'Maria S.',
      amount: 45000,
    },
    largestPayment: 25000,
  }

  const formatCurrency = (amount: number) => {
    // Use locale-aware currency formatting
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

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl" className="overflow-y-scroll">
      <div className="flex flex-col gap-6">
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
        <div className="h-px w-full bg-gray-200" />
        {/* Summary */}
        <div className="flex flex-col items-center gap-4 self-stretch">
          <div className="text-dark-500 text-2xl leading-tight font-medium tracking-[-0.48px]">
            {formatCurrency(data.totalAmount)}
          </div>
          <div className="flex items-center justify-center gap-4">
            <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {data.totalPayments}{' '}
              <span className="font-light">{t('pages.reports.paymentsModal.payments')}</span>
            </span>
            <span className="flex items-center justify-center gap-2">
              <Icons.ArrowUp02 size={20} className="text-success-500" />
              <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {data.change}%
              </span>
              <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                {t('pages.reports.kpi.vs')}{' '}
                <span className="font-medium">
                  {period === 'today'
                    ? t('pages.reports.kpi.yesterday')
                    : period === 'thisWeek'
                      ? t('pages.reports.kpi.lastWeek')
                      : t('pages.reports.kpi.lastMonth')}
                </span>
              </span>
            </span>
          </div>
        </div>

        {/* Payment Status Card */}
        <div className="flex flex-col items-start justify-center gap-6 self-stretch rounded-xl border border-white/100 bg-white/50 p-5 px-6">
          <div className="flex flex-col items-start justify-center gap-2 self-stretch">
            <div className="flex items-center gap-5 self-stretch">
              <span className="text-dark-500 w-20 text-sm leading-[140%] font-medium tracking-[-0.24px]">
                {t('pages.reports.paymentsModal.verified')}
              </span>
              <ProgressBar
                percentage={data.verified.percentage}
                height="lg"
                barClassName="bg-primary-400"
                className="flex-1"
              />
              <span className="text-dark-500 w-20 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {formatCurrency(data.verified.amount)}
              </span>
            </div>
            <span className="self-stretch text-center text-xs leading-[140%] font-medium tracking-[-0.24px] text-gray-700">
              {data.verified.count} {t('pages.reports.paymentsModal.payments')},{' '}
              {data.verified.percentage}%
            </span>
          </div>
          <div className="flex flex-col items-start justify-center gap-2 self-stretch">
            <div className="flex items-center gap-5 self-stretch">
              <span className="text-dark-500 w-20 text-sm leading-[140%] font-medium tracking-[-0.24px]">
                {t('pages.reports.paymentsModal.pending')}
              </span>
              <ProgressBar
                percentage={data.pending.percentage}
                height="lg"
                barClassName="bg-primary-400"
                className="flex-1"
              />
              <span className="text-dark-500 w-20 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {formatCurrency(data.pending.amount)}
              </span>
            </div>
            <span className="self-stretch text-center text-xs leading-[140%] font-medium tracking-[-0.24px] text-gray-700">
              {data.pending.count} {t('pages.reports.paymentsModal.payments')},{' '}
              {data.pending.percentage}%
            </span>
          </div>
        </div>

        {/* Payment Methods Card */}
        <div className="flex flex-col items-start gap-2 self-stretch">
          <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
            {t('pages.reports.paymentsModal.paymentMethods')}:
          </span>
          <div className="flex flex-col items-start justify-center gap-6 self-stretch rounded-xl border border-white bg-white/50 p-5 px-6">
            {[
              { key: 'bankTransfer', label: t('pages.reports.paymentsModal.bankTransfer') },
              { key: 'card', label: t('pages.reports.paymentsModal.card') },
              { key: 'other', label: t('pages.reports.paymentsModal.other') },
            ].map((method) => {
              const methodData = data.methods[method.key as keyof typeof data.methods]
              return (
                <div key={method.key} className="flex flex-col items-start gap-1 self-stretch">
                  <div className="flex items-center gap-5 self-stretch">
                    <span className="text-dark-500 w-20 text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {method.label}
                    </span>
                    <ProgressBar
                      percentage={methodData.percentage}
                      height="lg"
                      barClassName="bg-primary-400"
                      className="flex-1"
                    />
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
        <div className="h-px w-full bg-gray-200" />
        {/* Key Metrics Cards */}
        <div className="flex items-start gap-4 self-stretch">
          <MetricCard
            icon={<Icons.Money04 size={24} className="text-primary-500" strokeWidth={1.5} />}
            value={formatCurrency(data.averagePayment)}
            label={t('pages.reports.paymentsModal.averagePayment')}
          />
          <MetricCard
            icon={<Icons.User size={24} className="text-primary-500" strokeWidth={1.5} />}
            value={`${data.topCollector.name}\n${formatCurrency(data.topCollector.amount)}`}
            label={t('pages.reports.paymentsModal.topCollector')}
          />
          <MetricCard
            icon={<Icons.Shield size={24} className="text-primary-500" strokeWidth={1.5} />}
            value={formatCurrency(data.largestPayment)}
            label={t('pages.reports.paymentsModal.largestPmt')}
          />
        </div>
        <div className="h-px w-full bg-gray-200" />
        {/* Footer */}
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose} className="w-full">
            {t('actions.close')}
          </Button>
        </div>
      </div>
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
        <div className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
          {value}
        </div>
      </div>

      <div className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
        {label}
      </div>
    </div>
  )
}
