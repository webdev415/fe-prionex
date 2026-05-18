import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { Icons } from '@/lib/icons'
import { messagingApi, MESSAGING_CHANNELS } from '@/features/messaging'
import type { MessagingCampaignRecipient, MessagingCampaignSummary } from '@/features/messaging'
import {
  useCancelMessagingCampaign,
  useMessagingCampaign,
  useMessagingCampaignRecipients,
  useMessagingCampaigns,
} from '@/features/messaging'

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const formatStatus = (value: string) =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

interface CampaignDetailModalProps {
  campaignId: number | null
  onClose: () => void
}

function CampaignDetailModal({ campaignId, onClose }: CampaignDetailModalProps) {
  const { t } = useTranslation('common')
  const { data: campaign, isLoading } = useMessagingCampaign(campaignId ?? 0, campaignId !== null)
  const { data: recipients, isLoading: recipientsLoading } = useMessagingCampaignRecipients(
    campaignId ?? 0,
    { limit: 100, offset: 0 },
    campaignId !== null
  )
  const cancelCampaignMutation = useCancelMessagingCampaign()

  const recipientColumns = useMemo<Column<MessagingCampaignRecipient>[]>(
    () => [
      {
        key: 'client_id',
        header: t('pages.messagingCampaigns.table.client', 'Client'),
        align: 'left',
      },
      {
        key: 'destination',
        header: t('pages.messagingCampaigns.table.destination', 'Destination'),
        align: 'left',
      },
      {
        key: 'status',
        header: t('pages.messagingCampaigns.table.status', 'Status'),
        align: 'left',
        render: (recipient) => formatStatus(recipient.status),
      },
      {
        key: 'sent_at',
        header: t('pages.messagingCampaigns.table.sentAt', 'Sent'),
        align: 'left',
        render: (recipient) => formatDateTime(recipient.sent_at),
      },
      {
        key: 'delivered_at',
        header: t('pages.messagingCampaigns.table.deliveredAt', 'Delivered'),
        align: 'left',
        render: (recipient) => formatDateTime(recipient.delivered_at),
      },
      {
        key: 'error_message',
        header: t('pages.messagingCampaigns.table.error', 'Error'),
        align: 'left',
        render: (recipient) => recipient.error_message || '-',
      },
    ],
    [t]
  )

  const handleExport = () => {
    if (!campaign) return

    window.open(messagingApi.getCampaignExportUrl(campaign.id), '_blank', 'noopener,noreferrer')
  }

  const handleCancel = async () => {
    if (!campaign) return
    await cancelCampaignMutation.mutateAsync(campaign.id)
  }

  return (
    <Modal open={campaignId !== null} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.MailSend01 size={18} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title={
          campaign
            ? `${campaign.code} - ${campaign.name}`
            : t('pages.messagingCampaigns.detail.title', 'Campaign detail')
        }
      />
      <ModalContent>
        {isLoading || !campaign ? (
          <div className="py-8 text-sm text-gray-500">{t('status.loading', 'Loading...')}</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-xs tracking-wide text-gray-500 uppercase">
                  {t('pages.messagingCampaigns.detail.status', 'Status')}
                </div>
                <div className="text-dark-500 mt-2 text-lg font-semibold">
                  {formatStatus(campaign.status)}
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-xs tracking-wide text-gray-500 uppercase">
                  {t('pages.messagingCampaigns.detail.channelService', 'Channel / service')}
                </div>
                <div className="text-dark-500 mt-2 text-lg font-semibold">
                  {campaign.channel.toUpperCase()} / {campaign.service}
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-xs tracking-wide text-gray-500 uppercase">
                  {t('pages.messagingCampaigns.detail.source', 'Source')}
                </div>
                <div className="text-dark-500 mt-2 text-lg font-semibold">
                  {formatStatus(campaign.source)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                ['Total', campaign.total_recipients],
                ['Sent', campaign.sent_count],
                ['Delivered', campaign.delivered_count],
                ['Failed', campaign.failed_count],
                ['Skipped', campaign.skipped_count],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="text-xs tracking-wide text-gray-500 uppercase">{label}</div>
                  <div className="text-dark-500 mt-2 text-2xl font-semibold">{value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-dark-500 mb-2 text-sm font-medium">
                  {t('pages.messagingCampaigns.detail.messageSnapshot', 'Message snapshot')}
                </div>
                <pre className="text-dark-500 overflow-auto rounded-lg bg-gray-50 p-3 text-xs">
                  {JSON.stringify(campaign.message_snapshot, null, 2)}
                </pre>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-dark-500 mb-2 text-sm font-medium">
                  {t('pages.messagingCampaigns.detail.selectionPayload', 'Selection payload')}
                </div>
                <pre className="text-dark-500 overflow-auto rounded-lg bg-gray-50 p-3 text-xs">
                  {JSON.stringify(campaign.selection_payload, null, 2)}
                </pre>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-4 flex flex-col gap-1">
                <div className="text-dark-500 text-sm font-medium">
                  {t('pages.messagingCampaigns.detail.recipientResults', 'Recipient results')}
                </div>
                <div className="text-xs text-gray-500">
                  {t(
                    'pages.messagingCampaigns.detail.recipientResultsHint',
                    'Showing the latest 100 recipient rows for this campaign.'
                  )}
                </div>
              </div>

              {recipientsLoading ? (
                <div className="py-6 text-sm text-gray-500">
                  {t('status.loading', 'Loading...')}
                </div>
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
            </div>

            <div className="grid grid-cols-1 gap-2 text-sm text-gray-600 md:grid-cols-2">
              <div>
                {t('pages.messagingCampaigns.detail.launchedAt', 'Launched at')}:&nbsp;
                <span className="text-dark-500 font-medium">
                  {formatDateTime(campaign.launched_at)}
                </span>
              </div>
              <div>
                {t('pages.messagingCampaigns.detail.completedAt', 'Completed at')}:&nbsp;
                <span className="text-dark-500 font-medium">
                  {formatDateTime(campaign.completed_at)}
                </span>
              </div>
            </div>
          </div>
        )}
      </ModalContent>
      <ModalFooter>
        <Button type="button" variant="cancel" onClick={onClose} size="sm">
          {t('actions.close', 'Close')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleExport}
          size="sm"
          disabled={!campaign}
        >
          {t('pages.messagingCampaigns.actions.export', 'Export CSV')}
        </Button>
        <PermissionGuard permission={PERMISSIONS.MESSAGING.LAUNCH_CAMPAIGNS}>
          <Button
            type="button"
            variant="danger"
            onClick={handleCancel}
            size="sm"
            disabled={!campaign || cancelCampaignMutation.isPending}
            isLoading={cancelCampaignMutation.isPending}
          >
            {t('pages.messagingCampaigns.actions.cancelCampaign', 'Cancel campaign')}
          </Button>
        </PermissionGuard>
      </ModalFooter>
    </Modal>
  )
}

export function MessagingCampaignsPage() {
  const { t } = useTranslation('common')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null)

  const {
    data: campaigns = [],
    isLoading,
    isFetching,
  } = useMessagingCampaigns({
    status: statusFilter === 'all' ? undefined : statusFilter,
    channel:
      channelFilter === 'all' ? undefined : (channelFilter as (typeof MESSAGING_CHANNELS)[number]),
    limit: 100,
    offset: 0,
  })

  const filteredCampaigns = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return campaigns

    return campaigns.filter((campaign) => {
      return (
        campaign.name.toLowerCase().includes(query) ||
        campaign.code.toLowerCase().includes(query) ||
        campaign.service.toLowerCase().includes(query)
      )
    })
  }, [campaigns, searchQuery])

  const columns = useMemo<Column<MessagingCampaignSummary>[]>(
    () => [
      { key: 'code', header: t('pages.messagingCampaigns.table.code', 'Code'), align: 'left' },
      { key: 'name', header: t('pages.messagingCampaigns.table.name', 'Campaign'), align: 'left' },
      {
        key: 'source',
        header: t('pages.messagingCampaigns.table.source', 'Source'),
        align: 'left',
        render: (campaign) => formatStatus(campaign.source),
      },
      {
        key: 'channel',
        header: t('pages.messagingCampaigns.table.channel', 'Channel'),
        align: 'left',
        render: (campaign) => campaign.channel.toUpperCase(),
      },
      {
        key: 'service',
        header: t('pages.messagingCampaigns.table.service', 'Service'),
        align: 'left',
      },
      {
        key: 'status',
        header: t('pages.messagingCampaigns.table.status', 'Status'),
        align: 'left',
        render: (campaign) => formatStatus(campaign.status),
      },
      {
        key: 'summary',
        header: t('pages.messagingCampaigns.table.summary', 'Results'),
        align: 'left',
        render: (campaign) =>
          `${campaign.delivered_count}/${campaign.total_recipients} ${t(
            'pages.messagingCampaigns.summary.delivered',
            'delivered'
          )}`,
      },
      {
        key: 'launched_at',
        header: t('pages.messagingCampaigns.table.launchedAt', 'Launched'),
        align: 'left',
        render: (campaign) => formatDateTime(campaign.launched_at),
      },
      {
        key: 'actions',
        header: t('pages.messagingCampaigns.table.actions', 'Actions'),
        align: 'center',
        render: (campaign) => (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => setSelectedCampaignId(campaign.id)}
          >
            {t('pages.messagingCampaigns.actions.viewDetails', 'View details')}
          </Button>
        ),
      },
    ],
    [t]
  )

  return (
    <div className="flex flex-col gap-6 p-3 md:p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-dark-500 text-2xl font-semibold">
          {t('navigation.campaignAnalytics', 'Campaign Analytics')}
        </h1>
        <p className="text-sm text-gray-600">
          {t(
            'pages.messagingCampaigns.description',
            'Review bulk and single-send campaigns, inspect recipient outcomes, and export delivery results.'
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-white/70 bg-white/60 p-4 md:grid-cols-3">
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t(
            'pages.messagingCampaigns.filters.search',
            'Search campaign, code, or service'
          )}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder={t('pages.messagingCampaigns.filters.status', 'Status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t('pages.messagingCampaigns.filters.allStatuses', 'All statuses')}
            </SelectItem>
            {['queued', 'running', 'completed', 'cancelled', 'failed'].map((status) => (
              <SelectItem key={status} value={status}>
                {formatStatus(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger>
            <SelectValue placeholder={t('pages.messagingCampaigns.filters.channel', 'Channel')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t('pages.messagingCampaigns.filters.allChannels', 'All channels')}
            </SelectItem>
            {MESSAGING_CHANNELS.map((channel) => (
              <SelectItem key={channel} value={channel}>
                {channel.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-white/70 bg-white/60 p-4">
        {isLoading || isFetching ? (
          <div className="py-8 text-sm text-gray-500">{t('status.loading', 'Loading...')}</div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredCampaigns}
            emptyMessage={t(
              'pages.messagingCampaigns.empty',
              'No campaigns matched the current filters'
            )}
          />
        )}
      </div>

      <CampaignDetailModal
        campaignId={selectedCampaignId}
        onClose={() => setSelectedCampaignId(null)}
      />
    </div>
  )
}

export default MessagingCampaignsPage
