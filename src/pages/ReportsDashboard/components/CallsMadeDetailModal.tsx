/**
 * CallsMadeDetailModal Component
 *
 * Modal displaying detailed calls made information: total, by hour, and by operator.
 * Uses real data from Report Service API via useCallsMadeModal hook.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Icons } from '@/lib/icons'
import type { Period } from '../types'
import type { CallsMadeModalData } from '@/features/report'

// Types for export
export interface CallsMadeDetailData {
  total: number
  change: number
  changeType: 'increase' | 'decrease'
  previousTotal: number
  byHour: { label: string; calls: number }[]
  byOperator: { name: string; calls: number }[]
}

export interface CallRecord {
  id: string
  timestamp: string
  operatorId: number
  operatorName: string
  clientId: number
  clientName: string
  phone: string
  duration: number
  outcome: CallOutcome
}

export type CallOutcome = 'answered' | 'no_answer' | 'busy' | 'failed'

export interface CallsMadeDetailModalProps {
  open: boolean
  onClose: () => void
  period: Period
  data?: CallsMadeModalData
  isLoading?: boolean
  error?: Error | null
}

export function CallsMadeDetailModal({
  open,
  onClose,
  period,
  data,
  isLoading = false,
  error = null,
}: CallsMadeDetailModalProps) {
  const { t, i18n } = useTranslation('common')

  const maxByHour = data?.byHour ? Math.max(...data.byHour.map((h) => h.calls), 1) : 1
  const maxByOperator = data?.byOperator ? Math.max(...data.byOperator.map((o) => o.calls), 1) : 1

  const formatDate = () => {
    const locale = i18n.language === 'uk' ? 'uk-UA' : i18n.language === 'ru' ? 'ru-RU' : 'en-US'
    return new Date().toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
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
        {t('pages.reports.callsMadeModal.noData', 'No data available')}
      </p>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl" className="">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="bg-primary-400 flex flex-col items-start gap-2.5 rounded-full p-[10px]">
            <Icons.Call02 size={20} className="text-dark-500" strokeWidth={1.5} />
          </div>
          <span className="text-dark-500 text-2xl leading-tight font-light tracking-[-0.48px]">
            {t('pages.reports.callsMadeModal.title')} – {getPeriodLabel()}
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
                {t('pages.reports.callsMadeModal.total')}: {data.total}
              </div>
              <div className="flex items-center justify-center gap-4">
                <span className="flex items-center justify-center gap-2">
                  {data.changeType === 'increase' ? (
                    <Icons.ArrowUp02 size={20} className="text-success-500" />
                  ) : (
                    <Icons.ArrowDown02 size={20} className="text-error-500" />
                  )}
                  <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {data.change}%
                  </span>
                </span>
                <span className="text-dark-500 text-sm leading-[150%] tracking-[-0.28px]">
                  <span className="font-light">{t('pages.reports.kpi.vs')} </span>
                  <span className="font-medium">{getComparisonText()}</span>
                  <span className="font-light"> ({data.previousTotal})</span>
                </span>
              </div>
            </div>

            {/* By Hour */}
            {data.byHour.length > 0 && (
              <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
                <div className="flex items-center gap-2">
                  <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {t('pages.reports.callsMadeModal.byHour')}:
                  </span>
                </div>
                <div className="flex flex-col items-start justify-center gap-4 self-stretch rounded-xl border border-white bg-white/50 p-5 px-6">
                  {data.byHour.map((row) => (
                    <div key={row.label} className="flex w-full flex-col items-start gap-1">
                      <div className="flex items-center gap-5 self-stretch">
                        <span className="text-dark-500 w-24 shrink-0 text-xs leading-[140%] font-medium tracking-[-0.24px]">
                          {row.label}
                        </span>
                        <ProgressBar
                          percentage={maxByHour > 0 ? (row.calls / maxByHour) * 100 : 0}
                          height="lg"
                          barClassName="bg-primary-400"
                          className="flex-1"
                        />
                        <span className="text-dark-500 w-20 shrink-0 text-right text-sm leading-[150%] font-medium tracking-[-0.28px]">
                          {row.calls} {t('pages.reports.callsMadeModal.calls')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By Operator */}
            {data.byOperator.length > 0 && (
              <div className="flex flex-col items-start gap-2 self-stretch">
                <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {t('pages.reports.callsMadeModal.byOperator')}:
                </span>
                <div className="flex flex-col items-start justify-center gap-4 self-stretch rounded-xl border border-white bg-white/50 p-5 px-6">
                  {data.byOperator.map((row) => (
                    <div key={row.name} className="flex w-full flex-col items-start gap-1">
                      <div className="flex items-center gap-5 self-stretch">
                        <span className="text-dark-500 w-24 shrink-0 text-xs leading-[140%] font-medium tracking-[-0.24px]">
                          {row.name}
                        </span>
                        <ProgressBar
                          percentage={maxByOperator > 0 ? (row.calls / maxByOperator) * 100 : 0}
                          height="lg"
                          barClassName="bg-primary-400"
                          className="flex-1"
                        />
                        <span className="text-dark-500 w-20 shrink-0 text-right text-sm leading-[150%] font-medium tracking-[-0.28px]">
                          {row.calls} {t('pages.reports.callsMadeModal.calls')}
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
