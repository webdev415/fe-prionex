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
  mergeCampaignCostFields,
  messagingApi,
  messagingStatusForCallLogCard,
} from '@/features/messaging'
import type { MessagingCampaignRecipient, MessagingCampaignSummary } from '@/features/messaging'
import { useMessagingCampaign, useMessagingCampaignRecipients } from '@/features/messaging'
import { useAuthStore } from '@/stores/authStore'

const formatStatusFallback = (status: string) =>
  status
    .split('_')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
    .join(' ')

function campaignStatusBadgeClasses(status: string) {
  const normalized = status.trim().toLowerCase()
  if (normalized === 'completed') {
    return 'bg-success-100 text-success-700'
  }
  if (normalized === 'failed') {
    return 'bg-error-100 text-error-700'
  }
  if (normalized === 'partially_failed') {
    return 'bg-warning-100 text-warning-700'
  }
  if (normalized === 'queued' || normalized === 'sending') {
    return 'bg-information-100 text-information-700'
  }
  return 'bg-muted text-muted-foreground'
}

function recipientStatusBadgeClasses(status: string) {
  const display = messagingStatusForCallLogCard(status)
  switch (display) {
    case 'Delivered':
      return 'bg-success-100 text-success-700'
    case 'Failed':
      return 'bg-error-100 text-error-700'
    case 'Sent':
      return 'bg-information-100 text-information-700'
    case 'Skipped':
      return 'bg-muted text-muted-foreground'
    default:
      return 'bg-warning-100 text-warning-700'
  }
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-border flex flex-col gap-1 border-b py-3 last:border-b-0 sm:flex-row sm:items-start sm:gap-6">
      <span className="text-muted-foreground w-full shrink-0 text-xs font-light tracking-wide sm:w-[8.5rem] sm:text-sm">
        {label}
      </span>
      <div className="text-foreground min-w-0 flex-1 text-sm leading-relaxed font-medium">
        {children}
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted ring-border rounded-xl px-3 py-3 ring-1 ring-inset sm:px-4 sm:py-3.5">
      <div className="text-muted-foreground text-xs font-light tracking-wide">{label}</div>
      <div className="text-foreground mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
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
          <div key={index} className="bg-muted h-16 animate-pulse rounded-xl" />
        ))}
      </div>
      <div className="bg-muted h-40 animate-pulse rounded-2xl" />
      <div className="bg-muted h-28 animate-pulse rounded-2xl" />
      <TableSkeleton columns={5} rows={4} className="w-full" />
    </div>
  )
}

export interface CampaignDetailModalProps {
  campaignId: number | null
  /** List row snapshot — used to show cost when detail API omits cost fields. */
  listCampaign?: MessagingCampaignSummary | null
  operatorNames: Map<number, string>
  onClose: () => void
}

export function CampaignDetailModal({
  campaignId,
  listCampaign = null,
  operatorNames,
  onClose,
}: CampaignDetailModalProps) {
  const { t } = useTranslation('common')
  const userTimezone = useAuthStore((s) => s.user?.timezone)

  const statusLabel = useCallback(
    (status: string) =>
      t(`pages.messagingCampaigns.status.${status}`, formatStatusFallback(status)),
    [t]
  )
  const { data: campaign, isLoading } = useMessagingCampaign(campaignId ?? 0, campaignId !== null)
  const summary = campaign ?? listCampaign
  const costSource = mergeCampaignCostFields(campaign, listCampaign) ?? summary
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
                <span className="text-foreground text-sm font-medium">{name}</span>
              ) : (
                <span className="text-muted-foreground font-mono text-xs sm:text-sm">
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
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
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
        render: (recipient) => formatDateTime(recipient.sent_at ?? undefined, userTimezone),
      },
      {
        key: 'delivered_at',
        header: t('pages.messagingCampaigns.table.deliveredAt', 'Delivered'),
        align: 'left',
        render: (recipient) => formatDateTime(recipient.delivered_at ?? undefined, userTimezone),
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
    [statusLabel, t, userTimezone]
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
  const snapshotDraftName = snapshotString(snapshot, 'name')
  const showDraftUsed = campaign != null && campaign.draft_id != null && !!snapshotDraftName
  const renderedBody = campaign?.sample_rendered_body?.trim() || null
  const renderedSubject = campaign?.sample_rendered_subject?.trim() || null
  const displayBody = renderedBody || bodyTemplate
  const displaySubject = renderedSubject || subjectTemplate

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
                <Icons.MailSend01
                  size={20}
                  className="text-foreground sm:size-6"
                  strokeWidth={1.5}
                />
              </div>
            }
            title={summary?.name ?? t('pages.messagingCampaigns.detail.title', 'Campaign details')}
          />
          {summary ? (
            <div className="-mt-1 flex flex-wrap items-center gap-2 pl-12 sm:pl-[3.75rem]">
              <span className="text-muted-foreground font-mono text-xs tracking-tight">
                {summary.code}
              </span>
              <span className="bg-card text-foreground ring-border inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset">
                {summary.channel.toUpperCase()}
              </span>
              <span className="bg-card text-muted-foreground ring-border inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset">
                {t(
                  `pages.messagingIntegrations.services.${summary.service}`,
                  getMessagingServiceLabel(summary.service)
                )}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                  campaignStatusBadgeClasses(summary.status)
                )}
              >
                {statusLabel(summary.status)}
              </span>
            </div>
          ) : null}
        </div>

        <ModalContent className="max-h-none min-h-0 flex-1 overflow-y-auto py-2 sm:max-h-none sm:py-3 md:max-h-none">
          {isLoading && !summary ? (
            <CampaignDetailSkeleton />
          ) : summary ? (
            <div className="flex flex-col gap-5 sm:gap-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                <MetricCard
                  label={t('pages.messagingCampaigns.detail.stats.total', 'Total')}
                  value={summary.total_recipients}
                />
                <MetricCard
                  label={t('pages.messagingCampaigns.detail.stats.sent', 'Sent')}
                  value={summary.sent_count}
                />
                <MetricCard
                  label={t('pages.messagingCampaigns.detail.stats.delivered', 'Delivered')}
                  value={summary.delivered_count}
                />
                <MetricCard
                  label={t('pages.messagingCampaigns.detail.stats.failed', 'Failed')}
                  value={summary.failed_count}
                />
                <MetricCard
                  label={t('pages.messagingCampaigns.detail.stats.skipped', 'Skipped')}
                  value={summary.skipped_count}
                />
              </div>

              <section className="border-border from-card to-muted/50 rounded-2xl border bg-gradient-to-b px-4 py-1 shadow-sm sm:px-5">
                <DetailRow label={t('pages.messagingCampaigns.detail.source', 'Source')}>
                  {formatSourceLabel(summary.source, t)}
                </DetailRow>
                <DetailRow label={t('pages.messagingCampaigns.detail.launchedBy', 'Launched by')}>
                  {formatLauncherName(summary.initiated_by, operatorNames) || '—'}
                </DetailRow>
                <DetailRow label={t('pages.messagingCampaigns.detail.launchedAt', 'Launched at')}>
                  {formatDateTime(summary.launched_at, userTimezone)}
                </DetailRow>
                <DetailRow label={t('pages.messagingCampaigns.detail.completedAt', 'Completed at')}>
                  {formatDateTime(summary.completed_at ?? undefined, userTimezone)}
                </DetailRow>
                <DetailRow label={t('pages.messagingCampaigns.detail.cost', 'Cost')}>
                  {(() => {
                    const { amount, badge } = formatCampaignCostDisplay(costSource ?? summary, t)
                    return (
                      <span>
                        {amount}
                        {badge ? (
                          <span className="text-muted-foreground ml-2 text-xs font-light">
                            ({badge})
                          </span>
                        ) : null}
                      </span>
                    )
                  })()}
                </DetailRow>
                <DetailRow
                  label={t('pages.messagingCampaigns.detail.selectionPayload', 'Audience')}
                >
                  {campaign?.selection_payload
                    ? formatSelectionSummary(campaign.selection_payload, t)
                    : '—'}
                </DetailRow>
              </section>

              <section className="border-border bg-card rounded-2xl border px-4 py-3 shadow-sm sm:px-5 sm:py-4">
                <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                  {t('pages.messagingCampaigns.detail.campaignMessage', 'Campaign message')}
                </h3>
                <div className="space-y-3 text-sm">
                  {showDraftUsed && (
                    <div>
                      <span className="text-muted-foreground text-xs font-light">
                        {t('pages.messagingCampaigns.detail.draftUsed', 'Draft')}
                      </span>
                      <p className="text-foreground mt-0.5 font-medium">{snapshotDraftName}</p>
                    </div>
                  )}
                  {displaySubject && summary.channel === 'email' && (
                    <div>
                      <span className="text-muted-foreground text-xs font-light">
                        {t('pages.messagingCampaigns.detail.subject', 'Subject')}
                      </span>
                      <p className="text-foreground mt-0.5 font-medium">{displaySubject}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground text-xs font-light">
                      {renderedBody
                        ? t('pages.messagingCampaigns.detail.sentBody', 'Sent message')
                        : t('pages.messagingCampaigns.detail.body', 'Body')}
                    </span>
                    <div
                      className="text-foreground border-border bg-muted ring-border mt-1.5 rounded-xl border px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ring-1 ring-inset"
                      role="article"
                    >
                      {displayBody || '—'}
                    </div>
                  </div>
                  <CampaignViberContentSection snapshot={snapshot} channel={summary.channel} />
                </div>
              </section>

              <section className="border-border bg-card rounded-2xl border px-4 py-3 shadow-sm sm:px-5 sm:py-4">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    {t('pages.messagingCampaigns.detail.recipientResults', 'Recipient results')}
                  </h3>
                  <p className="text-muted-foreground text-xs font-light">
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
          ) : null}
        </ModalContent>

        <ModalFooter className="bg-muted mt-auto shrink-0 flex-col gap-2 sm:flex-row">
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
