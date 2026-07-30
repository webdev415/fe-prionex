/**
 * ContactRateDetailModal Component
 *
 * Modal displaying detailed contact rate information: outcomes, best performer, needs improvement.
 * Uses real data from Report Service API via useContactRateModal hook.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalContent, ModalFooter, ModalTitle } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import type { Period } from '../types'
import type { ContactRateModalData } from '@/features/report'

// Types for export
export interface ContactRateDetailData {
  rate: number
  contacted: number
  total: number
  change: number
  changeType: 'increase' | 'decrease'
  previousRate: number
  outcomes: { key: string; count: number; percentage: number }[]
  bestPerformer: { name: string; rate: number } | null
  needsImprovement: { name: string; rate: number } | null
}

export interface ContactRateRecord {
  id: string
  timestamp: string
  operatorId: number
  operatorName: string
  clientId: number
  clientName: string
  phone: string
  attempts: number
  duration: number
}

export type OutcomeType = 'answered' | 'noAnswer' | 'busy' | 'failed'

export interface ContactRateDetailModalProps {
  open: boolean
  onClose: () => void
  period: Period
  data?: ContactRateModalData
  isLoading?: boolean
  error?: Error | null
}

const outcomeIcons: Record<
  string,
  React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
> = {
  answered: Icons.Success,
  noAnswer: Icons.Cancel01,
  busy: Icons.HeadphoneMute,
  failed: Icons.Warning,
}

export function ContactRateDetailModal({
  open,
  onClose,
  period,
  data,
  isLoading = false,
  error = null,
}: ContactRateDetailModalProps) {
  const { t } = useTranslation('common')

  const formatDate = () => {
    const now = new Date()
    const day = String(now.getDate()).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `${day}-${month}-${now.getFullYear()}`
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
        {t('pages.reports.contactRateModal.noData', 'No data available')}
      </p>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="bg-primary-400 flex flex-col items-start gap-2.5 rounded-full p-[10px]">
            <Icons.Chart01 size={20} className="text-foreground" strokeWidth={1.5} />
          </div>
          <ModalTitle className="text-foreground text-2xl leading-tight font-light tracking-[-0.48px]">
            {t('pages.reports.contactRateModal.title')} – {getPeriodLabel()}
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
                {data.rate.toFixed(1)}% ({data.contacted} {t('pages.reports.contactRateModal.of')}{' '}
                {data.total} {t('pages.reports.callsMadeModal.calls')})
              </div>
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
                  <span className="font-light"> ({data.previousRate}%)</span>
                </span>
              </div>
            </div>

            {/* Outcomes Card */}
            {data.outcomes.length > 0 && (
              <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
                <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {t('pages.reports.contactRateModal.outcomes')}:
                </span>
                <div className="border-border bg-card/50 flex flex-col items-start justify-center gap-4 self-stretch rounded-xl border p-5 px-6">
                  {data.outcomes.map((o) => {
                    const IconComponent = outcomeIcons[o.key]
                    return (
                      <div
                        key={o.key}
                        className="flex w-full items-center justify-between self-stretch"
                      >
                        <span className="text-foreground flex items-center gap-2 text-sm leading-[140%] font-medium tracking-[-0.24px]">
                          {IconComponent && (
                            <IconComponent
                              size={18}
                              className="text-foreground"
                              strokeWidth={1.5}
                            />
                          )}
                          {t(`pages.reports.contactRateModal.${o.key}`)}
                        </span>
                        <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
                          {o.count} ({o.percentage}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Best Performer & Needs Improvement */}
            {(data.bestPerformer || data.needsImprovement) && (
              <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
                <div className="flex w-full flex-col gap-2 self-stretch sm:flex-row sm:flex-wrap sm:gap-4">
                  {data.bestPerformer && (
                    <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
                      <span className="text-muted-foreground font-medium">
                        {t('pages.reports.contactRateModal.bestPerformer')}:{' '}
                      </span>
                      {data.bestPerformer.name} ({data.bestPerformer.rate}%)
                    </span>
                  )}
                  {data.needsImprovement &&
                    data.needsImprovement.name !== data.bestPerformer?.name && (
                      <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
                        <span className="text-muted-foreground font-medium">
                          {t('pages.reports.contactRateModal.needsImprovement')}:{' '}
                        </span>
                        {data.needsImprovement.name} ({data.needsImprovement.rate}%)
                      </span>
                    )}
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
