/**
 * SMSSentDetailModal Component
 *
 * Modal displaying detailed SMS information with delivery statistics and operator breakdown.
 * Uses real data from Report Service API via useSMSSentModal hook.
 */

import { useTranslation } from 'react-i18next'
import { dateSeparator } from '@/lib/formatters'
import { Modal, ModalContent, ModalFooter, ModalTitle } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Icons } from '@/lib/icons'
import type { Period } from '../types'
import type { SMSSentModalData } from '@/features/report'

// ============================================================================
// Types for export (backward compatibility)
// ============================================================================

export type SMSStatus = 'delivered' | 'failed' | 'pending'

export interface SMSRecord {
  id: string | number
  timestamp: string
  operatorId: number
  operatorName: string
  clientId: number
  clientName: string
  phone: string
  message: string
  templateName?: string
  status: SMSStatus
  deliveryTime?: string
  errorReason?: string
  cost: number
}

export interface SMSSentDetailData {
  totalSent: number
  delivered: number
  failed: number
  pending: number
  totalCost: number
  deliveryRate: number
  records: SMSRecord[]
}

export interface SMSSentDetailModalProps {
  open: boolean
  onClose: () => void
  period: Period
  data?: SMSSentModalData
  isLoading?: boolean
  error?: Error | null
  onClientClick?: (clientId: number) => void
}

// ============================================================================
// Helper Components
// ============================================================================

interface StatCardProps {
  icon: React.ReactNode
  value: string | number
  label: string
  color: 'primary' | 'success' | 'error' | 'warning'
}

function StatCard({ icon, value, label, color }: StatCardProps) {
  const bgColors = {
    primary: 'bg-primary-100',
    success: 'bg-success-100',
    error: 'bg-error-100',
    warning: 'bg-warning-100',
  }

  const iconColors = {
    primary: 'text-primary-600',
    success: 'text-success-600',
    error: 'text-error-600',
    warning: 'text-warning-600',
  }

  return (
    <div className={`flex flex-1 flex-col items-center gap-2 rounded-xl p-4 ${bgColors[color]}`}>
      <div className={`flex items-center justify-center ${iconColors[color]}`}>{icon}</div>
      <div className="text-foreground text-xl font-bold tracking-[-0.4px]">{value}</div>
      <div className="text-foreground text-center text-xs font-medium tracking-[-0.24px]">
        {label}
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function SMSSentDetailModal({
  open,
  onClose,
  period,
  data,
  isLoading = false,
  error = null,
}: SMSSentDetailModalProps) {
  const { t } = useTranslation('common')

  const maxByOperator = data?.byOperator ? Math.max(...data.byOperator.map((o) => o.smsSent), 1) : 1

  const formatDate = () => {
    const now = new Date()
    const day = String(now.getDate()).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const sep = dateSeparator()
    return `${day}${sep}${month}${sep}${now.getFullYear()}`
  }

  const getPeriodLabel = () => {
    switch (period) {
      case 'today':
        return t('pages.reports.periods.today')
      case 'thisWeek':
        return t('pages.reports.periods.thisWeek')
      case 'thisMonth':
        return t('pages.reports.periods.thisMonth')
      default:
        return t('pages.reports.periods.today')
    }
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
      <span className="text-foreground text-sm font-medium">
        {t('common.loading', 'Loading...')}
      </span>
    </div>
  )

  // Error state
  const renderError = () => (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <Icons.Warning size={48} className="text-error-500" />
      <h3 className="text-foreground text-lg font-medium">
        {t('pages.reports.error.title', 'Failed to load data')}
      </h3>
      <p className="text-muted-foreground">
        {error?.message || t('pages.reports.error.generic', 'An error occurred')}
      </p>
    </div>
  )

  // Empty state
  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <Icons.Folder size={48} className="text-muted-foreground" />
      <p className="text-muted-foreground">
        {t('pages.reports.smsModal.noData', 'No data available')}
      </p>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="bg-primary-400 flex flex-col items-start gap-2.5 rounded-full p-[10px]">
            <Icons.MailSend01 size={20} className="text-foreground" strokeWidth={1.5} />
          </div>
          <ModalTitle className="text-foreground text-2xl leading-tight font-light tracking-[-0.48px]">
            {t('pages.reports.smsModal.title')} – {getPeriodLabel()}
          </ModalTitle>
        </div>
        <span className="text-foreground text-base leading-[155%] font-medium tracking-[-0.32px]">
          {formatDate()}
        </span>
      </div>
      <div className="bg-border mt-4 h-px w-full" />

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
              <div className="text-foreground text-2xl leading-tight font-medium tracking-[-0.48px]">
                {t('pages.reports.smsModal.totalSent')}: {data.totalSent}
              </div>
              {/* KPI without a trend (null from report-service): no arrow, no «0 %» (#1448) */}
              {data.change !== null && (
                <div className="flex items-center justify-center gap-4">
                  <span className="flex items-center justify-center gap-2">
                    {data.changeType === 'increase' ? (
                      <Icons.ArrowUp02 size={20} className="text-success-500" />
                    ) : (
                      <Icons.ArrowDown02 size={20} className="text-error-500" />
                    )}
                    <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
                      {data.change}%
                    </span>
                  </span>
                  <span className="text-foreground text-sm leading-[150%] tracking-[-0.28px]">
                    <span className="font-light">{t('pages.reports.kpi.vs')} </span>
                    <span className="font-medium">{getComparisonText()}</span>
                    <span className="font-light"> ({data.previousTotal})</span>
                  </span>
                </div>
              )}
            </div>

            {/* Delivery Statistics */}
            <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
              <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.reports.smsModal.deliveryStats', 'Delivery Statistics')}:
              </span>
              <div className="flex w-full gap-4 self-stretch">
                <StatCard
                  icon={<Icons.Success size={24} strokeWidth={1.5} />}
                  value={data.delivered}
                  label={t('pages.reports.smsModal.delivered', 'Delivered')}
                  color="success"
                />
                <StatCard
                  icon={<Icons.CancelCircle size={24} strokeWidth={1.5} />}
                  value={data.failed}
                  label={t('pages.reports.smsModal.failed', 'Failed')}
                  color="error"
                />
                <StatCard
                  icon={<Icons.Clock01 size={24} strokeWidth={1.5} />}
                  value={data.pending}
                  label={t('pages.reports.smsModal.pending', 'Pending')}
                  color="warning"
                />
              </div>
            </div>

            {/* Delivery Rate */}
            <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
              <div className="flex w-full items-center justify-between">
                <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {t('pages.reports.smsModal.deliveryRate', 'Delivery Rate')}:
                </span>
                <span className="text-foreground text-sm leading-[150%] font-bold tracking-[-0.28px]">
                  {data.deliveryRate.toFixed(1)}%
                </span>
              </div>
              <ProgressBar
                percentage={data.deliveryRate}
                height="lg"
                barClassName="bg-success-500"
                className="w-full"
              />
            </div>

            {/* By Operator */}
            {data.byOperator.length > 0 && (
              <div className="flex flex-col items-start gap-2 self-stretch">
                <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {t('pages.reports.smsModal.byOperator', 'By Operator')}:
                </span>
                <div className="border-border bg-card/50 flex flex-col items-start justify-center gap-4 self-stretch rounded-xl border p-5 px-6">
                  {data.byOperator.map((row) => (
                    <div key={row.name} className="flex w-full flex-col items-start gap-1">
                      <div className="flex items-center gap-5 self-stretch">
                        <span className="text-foreground w-24 shrink-0 text-xs leading-[140%] font-medium tracking-[-0.24px]">
                          {row.name}
                        </span>
                        <ProgressBar
                          percentage={maxByOperator > 0 ? (row.smsSent / maxByOperator) * 100 : 0}
                          height="lg"
                          barClassName="bg-primary-400"
                          className="flex-1"
                        />
                        <span className="text-foreground w-20 shrink-0 text-right text-sm leading-[150%] font-medium tracking-[-0.28px]">
                          {row.smsSent} {t('pages.reports.smsModal.sms', 'SMS')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

export default SMSSentDetailModal
