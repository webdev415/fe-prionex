import { type ReactNode, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Button } from '@/components/ui/Button'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/formatters'
import {
  downloadBlob,
  formatCampaignCostDisplay,
  formatLauncherName,
  getMessagingServiceLabel,
  CampaignViberContentSection,
  messagingApi,
  messagingStatusForCallLogCard,
} from '@/features/messaging'
import type { MessagingCampaignRecipient } from '@/features/messaging'
import { useMessagingCampaign, useMessagingCampaignRecipients } from '@/features/messaging'

const formatStatusFallback = (status: string) =>
  status
    .split('_')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
    .join(' ')

function campaignStatusBadgeClasses(status: string) {
  const normalized = status.trim().toLowerCase()
  if (normalized === 'completed') {
    return 'bg-success-50 text-success-800 ring-success-200/60'
  }
  if (normalized === 'failed') {
    return 'bg-error-50 text-error-800 ring-error-200/60'
  }
  if (normalized === 'partially_failed') {
    return 'bg-warning-50 text-warning-800 ring-warning-200/60'
  }
  if (normalized === 'queued' || normalized === 'sending') {
    return 'bg-secondary-800/10 text-secondary-800 ring-secondary-800/20'
  }
  return 'bg-gray-100 text-gray-700 ring-gray-200'
}

function recipientStatusBadgeClasses(status: string) {
  const display = messagingStatusForCallLogCard(status)
  switch (display) {
    case 'Delivered':
      return 'bg-success-50 text-success-800 ring-success-200/60'
    case 'Failed':
      return 'bg-error-50 text-error-800 ring-error-200/60'
    case 'Sent':
      return 'bg-secondary-800/10 text-secondary-800 ring-secondary-800/20'
    case 'Skipped':
      return 'bg-gray-100 text-gray-700 ring-gray-200'
    default:
      return 'bg-warning-50 text-warning-800 ring-warning-200/60'
  }
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-gray-100 py-3 last:border-b-0 sm:flex-row sm:items-start sm:gap-6">
      <span className="w-full shrink-0 text-xs font-light tracking-wide text-gray-500 sm:w-[8.5rem] sm:text-sm">
        {label}
      </span>
      <div className="text-dark-500 min-w-0 flex-1 text-sm leading-relaxed font-medium">
        {children}
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-3 ring-1 ring-gray-100 ring-inset sm:px-4 sm:py-3.5">
      <div className="text-xs font-light tracking-wide text-gray-500">{label}</div>
      <div className="text-dark-500 mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
        {value}
      </div>
    </div>
  )
}

function snapshotString(snapshot: Record<string, unknown>, key: string): string | undefined {
  const value = snapshot[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function formatSourceLabel(source: string, t: ReturnType<typeof useTranslation>['t']) {
  const normalized = source.trim().toLowerCase()
  if (normalized === 'single') {
    return t('pages.clients.modals.viewMessage.sourceSingle', { defaultValue: 'Single' })
  }
  if (normalized === 'bulk') {
    return t('pages.clients.modals.viewMessage.sourceBulk', { defaultValue: 'Bulk' })
  }
  return formatStatusFallback(source)
}

function formatSelectionSummary(
  payload: Record<string, unknown>,
  t: ReturnType<typeof useTranslation>['t']
) {
  const mode = typeof payload.mode === 'string' ? payload.mode : ''
  if (mode === 'ids' && Array.isArray(payload.ids)) {
    return t('pages.messagingCampaigns.detail.selectionIds', {
      count: payload.ids.length,
      defaultValue: '{{count}} clients selected by ID',
    })
  }
  if (mode === 'filter') {
    return t('pages.messagingCampaigns.detail.selectionFilter', {
      defaultValue: 'Clients matching saved list filters',
    })
  }
  return t('pages.messagingCampaigns.detail.selectionUnknown', {
    defaultValue: 'Custom selection',
  })
}

function CampaignDetailSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-xl bg-gray-200" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-2xl bg-gray-200" />
      <div className="h-28 animate-pulse rounded-2xl bg-gray-200" />
      <TableSkeleton columns={5} rows={4} className="w-full" />
    </div>
  )
}

export interface CampaignDetailModalProps {
  campaignId: number | null
  operatorNames: Map<number, string>
  onClose: () => void
}

export function CampaignDetailModal({
  campaignId,
  operatorNames,
  onClose,
}: CampaignDetailModalProps) {
  const { t } = useTranslation('common')

  const statusLabel = useCallback(
    (status: string) =>
      t(`pages.messagingCampaigns.status.${status}`, formatStatusFallback(status)),
    [t]
  )
  const { data: campaign, isLoading } = useMessagingCampaign(campaignId ?? 0, campaignId !== null)
  const { data: recipients, isLoading: recipientsLoading } = useMessagingCampaignRecipients(
    campaignId ?? 0,
    { limit: 100, offset: 0 },
    campaignId !== null
  )
  const [isExportingCsv, setIsExportingCsv] = useState(false)

  const recipientColumns = useMemo<Column<MessagingCampaignRecipient>[]>(
    () => [
      {
        key: 'client_id',
        header: t('pages.messagingCampaigns.table.client', 'Client'),
        align: 'left',
        render: (recipient) => {
          const name = recipient.client_name?.trim()
          return (
            <div className="min-w-0">
              {name ? (
                <span className="text-dark-500 text-sm font-medium">{name}</span>
              ) : (
                <span className="font-mono text-xs text-gray-500 sm:text-sm">
                  #{recipient.client_id}
                </span>
              )}
            </div>
          )
        },
      },
      {
        key: 'destination',
        header: t('pages.messagingCampaigns.table.destination', 'Destination'),
        align: 'left',
        render: (recipient) => (
          <span className="font-mono text-xs tracking-wide break-all sm:text-sm">
            {recipient.destination || '—'}
          </span>
        ),
      },
      {
        key: 'status',
        header: t('pages.messagingCampaigns.table.status', 'Status'),
        align: 'left',
        render: (recipient) => {
          const label = statusLabel(recipient.status)
          return (
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
                recipientStatusBadgeClasses(recipient.status)
              )}
            >
              {label}
            </span>
          )
        },
      },
      {
        key: 'sent_at',
        header: t('pages.messagingCampaigns.table.sentAt', 'Sent'),
        align: 'left',
        render: (recipient) => formatDateTime(recipient.sent_at ?? undefined),
      },
      {
        key: 'delivered_at',
        header: t('pages.messagingCampaigns.table.deliveredAt', 'Delivered'),
        align: 'left',
        render: (recipient) => formatDateTime(recipient.delivered_at ?? undefined),
      },
      {
        key: 'error_message',
        header: t('pages.messagingCampaigns.table.error', 'Error'),
        align: 'left',
        render: (recipient) =>
          recipient.error_message ? (
            <span className="text-error-700 text-xs leading-relaxed">
              {recipient.error_message}
            </span>
          ) : (
            '—'
          ),
      },
    ],
    [statusLabel, t]
  )

  const handleExport = async () => {
    if (!campaign) return
    setIsExportingCsv(true)
    try {
      const blob = await messagingApi.exportCampaign(campaign.id)
      downloadBlob(blob, `campaign-${campaign.code}.csv`)
    } catch {
      toast.error(
        t('pages.messagingCampaigns.exportFailed', 'Failed to export campaign recipients')
      )
    } finally {
      setIsExportingCsv(false)
    }
  }

  const snapshot = campaign?.message_snapshot ?? {}
  const bodyTemplate = snapshotString(snapshot, 'body')
  const subjectTemplate = snapshotString(snapshot, 'subject')
  const senderName = snapshotString(snapshot, 'sender_name')
  const snapshotDraftName = snapshotString(snapshot, 'name')
  const showDraftUsed = campaign != null && campaign.draft_id != null && !!snapshotDraftName

  return (
    <Modal
      open={campaignId !== null}
      onClose={onClose}
      maxWidth="2xl"
      className="flex max-h-[90vh] flex-col overflow-hidden p-4 sm:p-6"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden sm:gap-5">
        <div className="flex shrink-0 flex-col gap-2">
          <ModalHeader
            icon={
              <div className="bg-primary-300 flex h-10 w-10 items-center justify-center rounded-full sm:h-12 sm:w-12">
                <Icons.MailSend01 size={20} className="text-dark-500 sm:size-6" strokeWidth={1.5} />
              </div>
            }
            title={campaign?.name ?? t('pages.messagingCampaigns.detail.title', 'Campaign details')}
          />
          {campaign ? (
            <div className="-mt-1 flex flex-wrap items-center gap-2 pl-12 sm:pl-[3.75rem]">
              <span className="font-mono text-xs tracking-tight text-gray-500">
                {campaign.code}
              </span>
              <span className="inline-flex items-center rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200/80 ring-inset">
                {campaign.channel.toUpperCase()}
              </span>
              <span className="inline-flex items-center rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200/80 ring-inset">
                {t(
                  `pages.messagingIntegrations.services.${campaign.service}`,
                  getMessagingServiceLabel(campaign.service)
                )}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
                  campaignStatusBadgeClasses(campaign.status)
                )}
              >
                {statusLabel(campaign.status)}
              </span>
            </div>
          ) : null}
        </div>

        <ModalContent className="max-h-none min-h-0 flex-1 overflow-y-auto py-2 sm:max-h-none sm:py-3 md:max-h-none">
          {isLoading || !campaign ? (
            <CampaignDetailSkeleton />
          ) : (
            <div className="flex flex-col gap-5 sm:gap-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                <MetricCard
                  label={t('pages.messagingCampaigns.detail.stats.total', 'Total')}
                  value={campaign.total_recipients}
                />
                <MetricCard
                  label={t('pages.messagingCampaigns.detail.stats.sent', 'Sent')}
                  value={campaign.sent_count}
                />
                <MetricCard
                  label={t('pages.messagingCampaigns.detail.stats.delivered', 'Delivered')}
                  value={campaign.delivered_count}
                />
                <MetricCard
                  label={t('pages.messagingCampaigns.detail.stats.failed', 'Failed')}
                  value={campaign.failed_count}
                />
                <MetricCard
                  label={t('pages.messagingCampaigns.detail.stats.skipped', 'Skipped')}
                  value={campaign.skipped_count}
                />
              </div>

              <section className="rounded-2xl border border-gray-200/80 bg-gradient-to-b from-white to-gray-50/80 px-4 py-1 shadow-sm sm:px-5">
                <DetailRow label={t('pages.messagingCampaigns.detail.source', 'Source')}>
                  {formatSourceLabel(campaign.source, t)}
                </DetailRow>
                <DetailRow label={t('pages.messagingCampaigns.detail.launchedBy', 'Launched by')}>
                  {formatLauncherName(campaign.initiated_by, operatorNames) || '—'}
                </DetailRow>
                <DetailRow label={t('pages.messagingCampaigns.detail.launchedAt', 'Launched at')}>
                  {formatDateTime(campaign.launched_at)}
                </DetailRow>
                <DetailRow label={t('pages.messagingCampaigns.detail.completedAt', 'Completed at')}>
                  {formatDateTime(campaign.completed_at ?? undefined)}
                </DetailRow>
                <DetailRow label={t('pages.messagingCampaigns.detail.cost', 'Cost')}>
                  {(() => {
                    const { amount, badge } = formatCampaignCostDisplay(campaign, t)
                    return (
                      <span>
                        {amount}
                        {badge ? (
                          <span className="ml-2 text-xs font-light text-gray-500">({badge})</span>
                        ) : null}
                      </span>
                    )
                  })()}
                </DetailRow>
                <DetailRow
                  label={t('pages.messagingCampaigns.detail.selectionPayload', 'Audience')}
                >
                  {formatSelectionSummary(campaign.selection_payload, t)}
                </DetailRow>
              </section>

              <section className="rounded-2xl border border-gray-200/80 bg-white px-4 py-3 shadow-sm sm:px-5 sm:py-4">
                <h3 className="text-dark-500 mb-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  {t('pages.messagingCampaigns.detail.campaignMessage', 'Campaign message')}
                </h3>
                <div className="space-y-3 text-sm">
                  {showDraftUsed && (
                    <div>
                      <span className="text-xs font-light text-gray-500">
                        {t('pages.messagingCampaigns.detail.draftUsed', 'Draft')}
                      </span>
                      <p className="text-dark-500 mt-0.5 font-medium">{snapshotDraftName}</p>
                    </div>
                  )}
                  {senderName && (
                    <div>
                      <span className="text-xs font-light text-gray-500">
                        {t('pages.messagingCampaigns.detail.senderName', 'Sender')}
                      </span>
                      <p className="text-dark-500 mt-0.5 font-medium">{senderName}</p>
                    </div>
                  )}
                  {subjectTemplate && campaign.channel === 'email' && (
                    <div>
                      <span className="text-xs font-light text-gray-500">
                        {t('pages.messagingCampaigns.detail.subject', 'Subject')}
                      </span>
                      <p className="text-dark-500 mt-0.5 font-medium">{subjectTemplate}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-light text-gray-500">
                      {t('pages.messagingCampaigns.detail.body', 'Body')}
                    </span>
                    <div
                      className="text-dark-500 mt-1.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ring-1 ring-gray-100 ring-inset"
                      role="article"
                    >
                      {bodyTemplate || '—'}
                    </div>
                  </div>
                  <CampaignViberContentSection snapshot={snapshot} channel={campaign.channel} />
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200/80 bg-white px-4 py-3 shadow-sm sm:px-5 sm:py-4">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <h3 className="text-dark-500 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                    {t('pages.messagingCampaigns.detail.recipientResults', 'Recipient results')}
                  </h3>
                  <p className="text-xs font-light text-gray-500">
                    {t(
                      'pages.messagingCampaigns.detail.recipientResultsHint',
                      'Showing the latest 100 recipient rows for this campaign.'
                    )}
                  </p>
                </div>
                {recipientsLoading ? (
                  <TableSkeleton columns={6} rows={4} className="w-full" />
                ) : (
                  <DataTable
                    columns={recipientColumns}
                    data={recipients ?? []}
                    emptyMessage={t(
                      'pages.messagingCampaigns.detail.noRecipients',
                      'No recipient results available yet'
                    )}
                  />
                )}
              </section>
            </div>
          )}
        </ModalContent>

        <ModalFooter className="bg-light-50 mt-auto shrink-0 flex-col gap-2 sm:flex-row">
          <Button type="button" variant="cancel" onClick={onClose} className="w-full sm:flex-1">
            {t('actions.close', 'Close')}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleExport()}
            className="w-full sm:flex-1"
            disabled={!campaign || isExportingCsv}
            isLoading={isExportingCsv}
            leftIcon={<Icons.Download size={18} />}
          >
            {t('pages.messagingCampaigns.actions.export', 'Export CSV')}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}

export default CampaignDetailModal
