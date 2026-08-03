import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import {
  CampaignAnalyticsFiltersBar,
  type CampaignAnalyticsFilters,
} from './components/CampaignAnalyticsFiltersBar'
import { CampaignDetailModal } from './components/CampaignDetailModal'
import { CsvCampaignLaunchModal } from './components/CsvCampaignLaunchModal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/formatters'
import {
  buildOperatorNamesMap,
  formatCampaignCostAmount,
  formatCampaignCostDisplay,
  formatLauncherName,
  getMessagingServiceLabel,
  MESSAGING_CHANNELS,
} from '@/features/messaging'
import { MessagingCampaignsTableSkeleton } from './components/MessagingCampaignsPageSkeleton'
import type { MessagingCampaignSummary } from '@/features/messaging'
import {
  launchPermissionForChannel,
  useMessagingCampaigns,
  useMessagingIntegrations,
} from '@/features/messaging'
import { useHasAnyPermission } from '@/hooks/usePermissions'
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
  const userTimezone = useAuthStore((s) => s.user?.timezone)
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
  const [csvLaunchOpen, setCsvLaunchOpen] = useState(false)

  const canLaunchCsv = useHasAnyPermission([
    launchPermissionForChannel('sms'),
    launchPermissionForChannel('viber'),
    launchPermissionForChannel('email'),
  ])
  const { data: integrations = [] } = useMessagingIntegrations(csvLaunchOpen || canLaunchCsv)
  const canLaunchCsvWithIntegration = canLaunchCsv && integrations.length > 0

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
    tz: userTimezone,
    initiated_by: appliedFilters.launcher === 'all' ? undefined : Number(appliedFilters.launcher),
    search: appliedFilters.search?.trim() || undefined,
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
  })

  const campaigns = campaignList?.items ?? []
  const totalItems = campaignList?.total ?? 0
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0
  const selectedListCampaign =
    selectedCampaignId != null
      ? (campaigns.find((row) => row.id === selectedCampaignId) ?? null)
      : null

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
        key: 'cost',
        header: t('pages.messagingCampaigns.table.cost', 'Cost'),
        align: 'right',
        render: (campaign) => {
          const { amount, badge } = formatCampaignCostDisplay(campaign, t)
          return (
            <div className="flex flex-col items-end gap-0.5">
              <span className="tabular-nums">{amount}</span>
              {badge ? (
                <span className="text-muted-foreground text-xs font-light">{badge}</span>
              ) : null}
            </div>
          )
        },
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
        render: (campaign) => formatDateTime(campaign.launched_at, userTimezone),
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
                'border-border bg-card text-muted-foreground focus-visible:ring-primary-500 hover:border-primary-500 hover:text-primary-600 focus-visible:ring-offset-background inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
              )}
            >
              <Icons.View size={16} strokeWidth={1.5} />
            </button>
          </div>
        ),
      },
    ],
    [campaignSourceLabel, campaignStatusLabel, operatorNames, t, userTimezone]
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-foreground text-xl font-light sm:text-2xl">
            {t('navigation.campaignAnalytics', 'Campaign Analytics')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-light">
            {t(
              'pages.messagingCampaigns.description',
              'Review bulk and single-send campaigns, inspect recipient outcomes, and export delivery results.'
            )}
          </p>
        </div>
        {canLaunchCsvWithIntegration && (
          <Button
            type="button"
            variant="primary"
            className="shrink-0"
            leftIcon={<Icons.FileImport size={16} />}
            onClick={() => setCsvLaunchOpen(true)}
          >
            {t('pages.messagingCampaigns.csvLaunch.open', 'Launch from CSV')}
          </Button>
        )}
      </div>

      <CampaignAnalyticsFiltersBar
        filters={appliedFilters}
        onFilterChange={handleFilterChange}
        launcherOptions={launcherOptions}
        isLoading={isPending || isFetching}
        timezone={userTimezone}
      />

      {!showTableSkeleton && totalItems > 0 && (
        <div className="border-border bg-card/70 flex flex-col gap-1 self-stretch rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-foreground text-sm font-medium tracking-[-0.28px]">
            {t('pages.messagingCampaigns.summary.filteredCampaigns', {
              count: totalItems,
              defaultValue: '{{count}} campaigns match filters',
            })}
          </span>
          <span className="text-foreground text-sm font-medium tracking-[-0.28px]">
            {t('pages.messagingCampaigns.summary.totalCost', 'Total cost')}:{' '}
            <span className="font-semibold tabular-nums">
              {formatCampaignCostAmount(
                campaignList?.filtered_total_cost,
                campaignList?.filtered_cost_currency
              ) ?? t('pages.messagingCampaigns.cost.unavailable', '—')}
            </span>
          </span>
        </div>
      )}

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
        listCampaign={selectedListCampaign}
        operatorNames={operatorNames}
        onClose={() => setSelectedCampaignId(null)}
      />

      <CsvCampaignLaunchModal
        open={csvLaunchOpen}
        onClose={() => setCsvLaunchOpen(false)}
        onLaunched={() => {
          setCsvLaunchOpen(false)
        }}
      />
    </div>
  )
}

export default MessagingCampaignsPage
