/**
 * MessagesSentDetailModal Component
 *
 * Modal for messaging-service send statistics (parallel to SMSSentDetailModal).
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Icons } from '@/lib/icons'
import type { Period } from '../types'
import { formatCampaignCostAmount } from '@/features/messaging'
import type { MessagesSentModalData } from '@/features/report'

export interface MessagesSentDetailModalProps {
  open: boolean
  onClose: () => void
  period: Period
  data?: MessagesSentModalData
  isLoading?: boolean
  error?: Error | null
}

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
      <div className="text-dark-500 text-xl font-bold tracking-[-0.4px]">{value}</div>
      <div className="text-dark-500 text-center text-xs font-medium tracking-[-0.24px]">
        {label}
      </div>
    </div>
  )
}

function formatChannelLabel(
  channel: string,
  t: (key: string, options?: { defaultValue?: string }) => string
): string {
  const key = `pages.reports.messagesModal.channels.${channel}`
  return t(key, { defaultValue: channel.toUpperCase() })
}

export function MessagesSentDetailModal({
  open,
  onClose,
  period,
  data,
  isLoading = false,
  error = null,
}: MessagesSentDetailModalProps) {
  const { t } = useTranslation('common')

  const maxByOperator = data?.byOperator
    ? Math.max(...data.byOperator.map((o) => o.messagesSent), 1)
    : 1
  const maxByChannel = data?.byChannel ? Math.max(...data.byChannel.map((c) => c.count), 1) : 1

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

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="border-primary-400 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      <span className="text-dark-500 text-sm font-medium">{t('common.loading', 'Loading...')}</span>
    </div>
  )

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

  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <Icons.Folder size={48} className="text-gray-400" />
      <p className="text-gray-500">
        {t('pages.reports.messagesModal.noData', 'No data available')}
      </p>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="bg-primary-400 flex flex-col items-start gap-2.5 rounded-full p-[10px]">
            <Icons.MessageMultiple01 size={20} className="text-dark-500" strokeWidth={1.5} />
          </div>
          <span className="text-dark-500 text-2xl leading-tight font-light tracking-[-0.48px]">
            {t('pages.reports.messagesModal.title')} – {getPeriodLabel()}
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
            <div className="mb-4 flex flex-col items-center gap-3 self-stretch">
              <div className="text-dark-500 text-2xl leading-tight font-medium tracking-[-0.48px]">
                {t('pages.reports.messagesModal.totalSent')}: {data.totalSent}
              </div>
              <div className="text-dark-500 text-base leading-tight font-medium tracking-[-0.32px]">
                {t('pages.reports.messagesModal.totalCost', 'Total Cost')}:{' '}
                <span className="tabular-nums">
                  {formatCampaignCostAmount(data.totalCost, data.costCurrency) ??
                    t('pages.messagingCampaigns.cost.unavailable', '—')}
                </span>
              </div>
            </div>

            <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
              <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.reports.messagesModal.statusBreakdown', 'Status breakdown')}:
              </span>
              <div className="grid w-full grid-cols-2 gap-3 self-stretch sm:grid-cols-3 lg:grid-cols-5">
                <StatCard
                  icon={<Icons.Success size={24} strokeWidth={1.5} />}
                  value={data.delivered}
                  label={t('pages.reports.messagesModal.delivered', 'Delivered')}
                  color="success"
                />
                <StatCard
                  icon={<Icons.CancelCircle size={24} strokeWidth={1.5} />}
                  value={data.failed}
                  label={t('pages.reports.messagesModal.failed', 'Failed')}
                  color="error"
                />
                <StatCard
                  icon={<Icons.Clock01 size={24} strokeWidth={1.5} />}
                  value={data.inFlight}
                  label={t('pages.reports.messagesModal.inFlight', 'In flight')}
                  color="warning"
                />
                <StatCard
                  icon={<Icons.Clock04 size={24} strokeWidth={1.5} />}
                  value={data.queued}
                  label={t('pages.reports.messagesModal.queued', 'Queued')}
                  color="warning"
                />
                <StatCard
                  icon={<Icons.Warning size={24} strokeWidth={1.5} />}
                  value={data.skipped}
                  label={t('pages.reports.messagesModal.skipped', 'Skipped')}
                  color="warning"
                />
              </div>
            </div>

            <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
              <div className="flex w-full items-center justify-between">
                <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {t('pages.reports.messagesModal.deliveryRate', 'Delivery Rate')}:
                </span>
                <span className="text-dark-500 text-sm leading-[150%] font-bold tracking-[-0.28px]">
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

            {data.byChannel.length > 0 && (
              <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
                <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {t('pages.reports.messagesModal.byChannel', 'By Channel')}:
                </span>
                <div className="flex flex-col items-start justify-center gap-4 self-stretch rounded-xl border border-white bg-white/50 p-5 px-6">
                  {data.byChannel.map((row) => (
                    <div key={row.channel} className="flex w-full flex-col items-start gap-1">
                      <div className="flex items-center gap-5 self-stretch">
                        <span className="text-dark-500 w-24 shrink-0 text-xs leading-[140%] font-medium tracking-[-0.24px]">
                          {formatChannelLabel(row.channel, t)}
                        </span>
                        <ProgressBar
                          percentage={maxByChannel > 0 ? (row.count / maxByChannel) * 100 : 0}
                          height="lg"
                          barClassName="bg-primary-400"
                          className="flex-1"
                        />
                        <span className="text-dark-500 w-20 shrink-0 text-right text-sm leading-[150%] font-medium tracking-[-0.28px]">
                          {row.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.topDrafts.length > 0 && (
              <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
                <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {t('pages.reports.messagesModal.topDrafts', 'Top Drafts')}:
                </span>
                <div className="flex flex-col items-start justify-center gap-3 self-stretch rounded-xl border border-white bg-white/50 p-5 px-6">
                  {data.topDrafts.map((draft) => (
                    <div
                      key={draft.name}
                      className="text-dark-500 flex w-full justify-between text-sm font-medium"
                    >
                      <span>{draft.name}</span>
                      <span>
                        {draft.count} {t('pages.reports.messagesModal.messages', 'messages')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.byOperator.length > 0 && (
              <div className="flex flex-col items-start gap-2 self-stretch">
                <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {t('pages.reports.messagesModal.byOperator', 'By Operator')}:
                </span>
                <div className="flex flex-col items-start justify-center gap-4 self-stretch rounded-xl border border-white bg-white/50 p-5 px-6">
                  {data.byOperator.map((row) => (
                    <div key={row.name} className="flex w-full flex-col items-start gap-1">
                      <div className="flex items-center gap-5 self-stretch">
                        <span className="text-dark-500 w-24 shrink-0 text-xs leading-[140%] font-medium tracking-[-0.24px]">
                          {row.name}
                        </span>
                        <ProgressBar
                          percentage={
                            maxByOperator > 0 ? (row.messagesSent / maxByOperator) * 100 : 0
                          }
                          height="lg"
                          barClassName="bg-primary-400"
                          className="flex-1"
                        />
                        <span className="text-dark-500 w-20 shrink-0 text-right text-sm leading-[150%] font-medium tracking-[-0.28px]">
                          {row.messagesSent} {t('pages.reports.messagesModal.messages', 'messages')}
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

export default MessagesSentDetailModal
