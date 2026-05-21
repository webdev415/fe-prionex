import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import {
  CampaignAnalyticsFiltersBar,
  type CampaignAnalyticsFilters,
} from './components/CampaignAnalyticsFiltersBar'
import { CampaignDetailModal } from './components/CampaignDetailModal'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/formatters'
import {
  buildOperatorNamesMap,
  formatLauncherName,
  getMessagingServiceLabel,
  MESSAGING_CHANNELS,
} from '@/features/messaging'
import { MessagingCampaignsTableSkeleton } from './components/MessagingCampaignsPageSkeleton'
import type { MessagingCampaignSummary } from '@/features/messaging'
import { useMessagingCampaigns } from '@/features/messaging'
import { useOperators } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/stores/authStore'

const formatStatusFallback = (value: string) =>
  value
    .split('_')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
    .join(' ')

const DEFAULT_PAGE_SIZE = 10

export function MessagingCampaignsPage() {
  const { t } = useTranslation('common')
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)
  const operatorNames = useMemo(() => buildOperatorNamesMap(operators), [operators])

  const [appliedFilters, setAppliedFilters] = useState<CampaignAnalyticsFilters>({
    status: 'all',
    channel: 'all',
    launcher: 'all',
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null)

  const handleFilterChange = useCallback((filters: CampaignAnalyticsFilters) => {
    setAppliedFilters(filters)
    setCurrentPage(1)
  }, [])

  const launcherOptions = useMemo(
    () =>
      [...operators]
        .sort((a, b) =>
          (operatorNames.get(a.id) ?? '').localeCompare(operatorNames.get(b.id) ?? '')
        )
        .map((operator) => ({
          id: operator.id,
          label: operatorNames.get(operator.id) || `#${operator.id}`,
        })),
    [operatorNames, operators]
  )

  const {
    data: campaignList,
    isPending,
    isFetching,
    isPlaceholderData,
  } = useMessagingCampaigns({
    status: appliedFilters.status === 'all' ? undefined : appliedFilters.status,
    channel:
      appliedFilters.channel === 'all'
        ? undefined
        : (appliedFilters.channel as (typeof MESSAGING_CHANNELS)[number]),
    launched_from: appliedFilters.launched_from,
    launched_to: appliedFilters.launched_to,
    initiated_by: appliedFilters.launcher === 'all' ? undefined : Number(appliedFilters.launcher),
    search: appliedFilters.search?.trim() || undefined,
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
  })

  const campaigns = campaignList?.items ?? []
  const totalItems = campaignList?.total ?? 0
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0

  const campaignStatusLabel = useCallback(
    (status: string) =>
      t(`pages.messagingCampaigns.status.${status}`, formatStatusFallback(status)),
    [t]
  )

  const campaignSourceLabel = useCallback(
    (source: string) => {
      const normalized = source.trim().toLowerCase()
      if (normalized === 'single') {
        return t('pages.clients.modals.viewMessage.sourceSingle', { defaultValue: 'Single' })
      }
      if (normalized === 'bulk') {
        return t('pages.clients.modals.viewMessage.sourceBulk', { defaultValue: 'Bulk' })
      }
      return formatStatusFallback(source)
    },
    [t]
  )

  const showTableSkeleton = isPending || (isFetching && isPlaceholderData)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])
  /* eslint-enable react-hooks/set-state-in-effect */

  const columns = useMemo<Column<MessagingCampaignSummary>[]>(
    () => [
      { key: 'code', header: t('pages.messagingCampaigns.table.code', 'Code'), align: 'left' },
      { key: 'name', header: t('pages.messagingCampaigns.table.name', 'Campaign'), align: 'left' },
      {
        key: 'source',
        header: t('pages.messagingCampaigns.table.source', 'Source'),
        align: 'left',
        render: (campaign) => campaignSourceLabel(campaign.source),
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
        render: (campaign) =>
          t(
            `pages.messagingIntegrations.services.${campaign.service}`,
            getMessagingServiceLabel(campaign.service)
          ),
      },
      {
        key: 'status',
        header: t('pages.messagingCampaigns.table.status', 'Status'),
        align: 'left',
        render: (campaign) => campaignStatusLabel(campaign.status),
      },
      {
        key: 'summary',
        header: t('pages.messagingCampaigns.table.summary', 'Results'),
        align: 'left',
        render: (campaign) =>
          t('pages.messagingCampaigns.summary.resultsLine', {
            delivered: campaign.delivered_count,
            total: campaign.total_recipients,
            defaultValue: `${campaign.delivered_count}/${campaign.total_recipients} delivered`,
          }),
      },
      {
        key: 'initiated_by',
        header: t('pages.messagingCampaigns.table.launchedBy', 'Launched by'),
        align: 'left',
        render: (campaign) => formatLauncherName(campaign.initiated_by, operatorNames),
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
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => setSelectedCampaignId(campaign.id)}
              aria-label={t('pages.messagingCampaigns.actions.viewDetails', 'View details')}
              title={t('pages.messagingCampaigns.actions.viewDetails', 'View details')}
              className={cn(
                'focus-visible:ring-primary-500 hover:border-primary-500 hover:text-primary-600 inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
              )}
            >
              <Icons.View size={16} strokeWidth={1.5} />
            </button>
          </div>
        ),
      },
    ],
    [campaignSourceLabel, campaignStatusLabel, operatorNames, t]
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
          {t('navigation.campaignAnalytics', 'Campaign Analytics')}
        </h1>
        <p className="mt-1 text-sm font-light text-gray-600">
          {t(
            'pages.messagingCampaigns.description',
            'Review bulk and single-send campaigns, inspect recipient outcomes, and export delivery results.'
          )}
        </p>
      </div>

      <CampaignAnalyticsFiltersBar
        filters={appliedFilters}
        onFilterChange={handleFilterChange}
        launcherOptions={launcherOptions}
        isLoading={isPending || isFetching}
      />

      {showTableSkeleton ? (
        <MessagingCampaignsTableSkeleton rows={pageSize} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={campaigns}
            emptyMessage={t(
              'pages.messagingCampaigns.empty',
              'No campaigns matched the current filters'
            )}
          />
          {totalPages > 0 && (
            <div className="flex items-center justify-center">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize)
                  setCurrentPage(1)
                }}
              />
            </div>
          )}
        </>
      )}

      <CampaignDetailModal
        campaignId={selectedCampaignId}
        operatorNames={operatorNames}
        onClose={() => setSelectedCampaignId(null)}
      />
    </div>
  )
}

export default MessagingCampaignsPage
