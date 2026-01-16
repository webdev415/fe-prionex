/**
 * Configuration History Page
 *
 * Page for viewing scoring configuration change history with filters, table, and pagination.
 * Uses reusable components following the same pattern as ImportHistoryPage.
 */

import { useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useURLState, useAutoPersistedState } from '@/hooks'
import { DataTable, type Column, type SortConfig } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { Icons } from '@/lib/icons'
// import { Button } from '@/components/ui/Button' // Commented out: not used after export feature removal
import { LinkButton } from '@/components/ui/LinkButton'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { configApi, type ConfigHistoryEntry } from '@/features/clients/api/configApi'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sellersApi } from '@/features/sellers/api/sellersApi'

// Status Badge Component for Configuration Changes
function ChangeTypeBadge({ changeType }: { changeType: string }) {
  const { t } = useTranslation('common')

  if (changeType === 'create') {
    return (
      <span className="bg-success-500 inline-flex h-[33px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white">
        <span className="h-2 w-2 rounded-full bg-white" />
        {t('pages.scoringConfiguration.history.changeTypes.created', 'Created')}
      </span>
    )
  }

  if (changeType === 'update') {
    return (
      <span className="bg-information-500 inline-flex h-[33px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white">
        <span className="h-2 w-2 rounded-full bg-white" />
        {t('pages.scoringConfiguration.history.changeTypes.updated', 'Updated')}
      </span>
    )
  }

  if (changeType === 'delete') {
    return (
      <span className="bg-error-500 inline-flex h-[33px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white">
        <span className="h-2 w-2 rounded-full bg-white" />
        {t('pages.scoringConfiguration.history.changeTypes.deleted', 'Deleted')}
      </span>
    )
  }

  return (
    <span className="inline-flex h-[33px] items-center gap-1.5 rounded-full bg-gray-500 px-3 text-xs font-medium text-white">
      <span className="h-2 w-2 rounded-full bg-white" />
      {changeType}
    </span>
  )
}

export function ConfigurationHistoryPage() {
  const { t, i18n } = useTranslation('common')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // URL state for pagination
  const [currentPage, setCurrentPage] = useURLState<number>('page', 1)
  const [rowsPerPage, setRowsPerPage] = useURLState<number>('pageSize', 10)

  // URL state for sorting
  const [sortBy, setSortBy] = useURLState<string>('sort_by', '')
  const [sortOrder, setSortOrder] = useURLState<'asc' | 'desc'>('sort_order', 'asc')

  // Add persistence for state
  useAutoPersistedState(
    'config-history-state',
    {
      currentPage,
      rowsPerPage,
      sortBy,
      sortOrder,
    },
    {
      currentPage: setCurrentPage,
      rowsPerPage: setRowsPerPage,
      sortBy: setSortBy,
      sortOrder: setSortOrder,
    }
  )

  // Reconstruct sortConfig from URL state
  const sortConfig = useMemo<SortConfig | undefined>(
    () => (sortBy ? { key: sortBy, order: sortOrder } : undefined),
    [sortBy, sortOrder]
  )

  // Fetch configuration history
  const { data, isLoading } = useQuery({
    queryKey: ['configHistory', { page: currentPage, page_size: rowsPerPage }],
    queryFn: () => configApi.getConfigHistory({ page: currentPage, page_size: rowsPerPage }),
  })

  // Invalidate history query when page mounts (handles navigation from save)
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['configHistory'] })
  }, [queryClient])

  // Fetch sellers to map IDs to names
  const { data: sellersData } = useQuery({
    queryKey: ['sellers', { is_active: true }],
    queryFn: () => sellersApi.getSellers({ is_active: true, limit: 1000 }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Create seller ID to name map
  const sellerNameMap = useMemo(() => {
    const map = new Map<number, string>()
    if (sellersData?.sellers) {
      sellersData.sellers.forEach((seller) => {
        map.set(seller.id, seller.seller_name)
      })
    }
    return map
  }, [sellersData])

  // Helper function to replace seller IDs with names in reason text
  const formatReason = (reason: string | null, sellerId: number | null) => {
    if (!reason) return '-'

    // Handle "Seller configuration deleted" - replace with seller name if available
    if (reason === 'Seller configuration deleted' && sellerId && sellerNameMap.has(sellerId)) {
      const sellerName = sellerNameMap.get(sellerId)!
      return `Seller configuration deleted for ${sellerName}`
    }

    if (!sellerId || !sellerNameMap.has(sellerId)) return reason

    const sellerName = sellerNameMap.get(sellerId)!
    // Replace patterns like "seller 1", "seller1", "seller ID 1", "for seller 1" with actual name
    return reason.replace(
      new RegExp(`(?:for\\s+)?seller\\s*(?:id\\s*)?${sellerId}\\b`, 'gi'),
      (match) => {
        // Preserve "for " prefix if it exists
        return match.toLowerCase().startsWith('for') ? `for ${sellerName}` : sellerName
      }
    )
  }

  const historyItems = (data?.history || []).map((item) => ({
    ...item,
    id: item.history_id,
  }))
  const totalItems = data?.total_count || 0
  const totalPages = Math.ceil(totalItems / rowsPerPage)

  // Handle sort
  const handleSort = (key: string, order: 'asc' | 'desc') => {
    setSortBy(key)
    setSortOrder(order)
    setCurrentPage(1) // Reset to first page on sort change
  }

  // Apply sorting
  const sortedData = useMemo(() => {
    if (!sortConfig) return historyItems

    return [...historyItems].sort((a, b) => {
      const aValue = a[sortConfig.key as keyof ConfigHistoryEntry]
      const bValue = b[sortConfig.key as keyof ConfigHistoryEntry]

      if (aValue == null || bValue == null) return 0

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      return sortConfig.order === 'asc' ? comparison : -comparison
    })
  }, [historyItems, sortConfig])

  // Handle pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size: number) => {
    setRowsPerPage(size)
    setCurrentPage(1)
  }

  const handleGoBack = () => {
    navigate('/dashboard/scoring-configuration')
  }

  // Commented out: CSV export feature
  // const handleExportHistory = async () => {
  //   try {
  //     const blob = await configApi.exportConfigHistory()
  //     const url = window.URL.createObjectURL(blob)
  //     const a = document.createElement('a')
  //     a.href = url
  //     a.download = `config-history-${new Date().toISOString().split('T')[0]}.csv`
  //     document.body.appendChild(a)
  //     a.click()
  //     window.URL.revokeObjectURL(url)
  //     document.body.removeChild(a)
  //   } catch (error) {
  //     console.error('Export failed:', error)
  //   }
  // }

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Define table columns - recalculate when language changes
  const columns: Column<ConfigHistoryEntry>[] = useMemo(
    () => [
      {
        key: 'changed_at',
        header: t('pages.scoringConfiguration.history.tableHeaders.dateTime', 'Date & Time'),
        sortable: true,
        render: (item) => <span>{formatTimestamp(item.changed_at)}</span>,
      },
      {
        key: 'change_type',
        header: t('pages.scoringConfiguration.history.tableHeaders.changeType', 'Change Type'),
        sortable: true,
        render: (item) => <ChangeTypeBadge changeType={item.change_type} />,
      },
      {
        key: 'changed_by_username',
        header: t('pages.scoringConfiguration.history.tableHeaders.changedBy', 'Changed By'),
        sortable: true,
        render: (item) => (
          <span className="text-dark-500 text-sm">
            {item.changed_by_username || `User #${item.changed_by_user_id}`}
          </span>
        ),
      },
      {
        key: 'change_reason',
        header: t('pages.scoringConfiguration.history.tableHeaders.reason', 'Reason'),
        sortable: false,
        render: (item) => (
          <span className="text-dark-600 text-sm font-medium">
            {formatReason(item.change_reason, item.seller_id)}
          </span>
        ),
      },
      {
        key: 'changes_summary',
        header: t('pages.scoringConfiguration.history.tableHeaders.changes', 'Changes'),
        sortable: false,
        render: (item) => {
          if (!item.changes_summary || Object.keys(item.changes_summary).length === 0) {
            return <span className="text-sm text-gray-500">-</span>
          }

          // Display detailed JSON for changes
          try {
            const formattedJson = JSON.stringify(item.changes_summary, null, 2)
            return (
              <div className="text-dark-700 my-2 max-h-48 max-w-xl overflow-auto rounded-md border border-slate-200 bg-slate-50 p-4 font-mono text-xs shadow-sm">
                <pre className="m-0 leading-relaxed break-words whitespace-pre-wrap">
                  {formattedJson}
                </pre>
              </div>
            )
          } catch {
            // Fallback to string representation if JSON.stringify fails
            return (
              <div className="text-dark-700 my-2 max-h-48 max-w-xl overflow-auto rounded-md border border-slate-200 bg-slate-50 p-4 font-mono text-xs shadow-sm">
                <pre className="m-0 leading-relaxed break-words whitespace-pre-wrap">
                  {String(item.changes_summary)}
                </pre>
              </div>
            )
          }
        },
      },
    ],
    // i18n.language is needed to recalculate columns when language changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language]
  )

  const hasNoData = !isLoading && totalItems === 0

  return (
    <div className="flex w-full flex-col items-start gap-4">
      {/* Header */}
      <div className="mb-4 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 sm:gap-4">
          <LinkButton
            variant="regular-black"
            onClick={handleGoBack}
            leftIcon={<Icons.ArrowLeft size={16} className="text-dark-500" />}
            className="text-sm"
          >
            {t('actions.back', 'Back')}
          </LinkButton>
          <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
            {t('pages.scoringConfiguration.history.title', 'Configuration History')}
          </h1>
        </div>
        {/* Commented out: CSV export button */}
        {/* <Button
          variant="secondary"
          onClick={handleExportHistory}
          leftIcon={<Icons.Download size={20} />}
          className="rounded-full"
          disabled={hasNoData}
        >
          {t('pages.scoringConfiguration.history.export', 'Export CSV')}
        </Button> */}
      </div>

      {/* Data Table or Empty State */}
      <div className="min-h-[400px] w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          // Loading State - Show skeleton table while fetching data
          <div className="p-4 sm:p-6">
            <TableSkeleton columns={5} rows={rowsPerPage} />
          </div>
        ) : hasNoData ? (
          // Empty State - No configuration history at all
          <div className="flex min-h-[448px] flex-col items-center justify-center gap-6 p-4 sm:p-6">
            {/* Icon */}
            <div className="flex h-20 w-20 items-center justify-center">
              <Icons.FolderRemove size={48} className="text-gray-400" strokeWidth={1} />
            </div>

            {/* Primary Message */}
            <h3 className="text-dark-500 text-center text-xl leading-[120%] font-light tracking-[-0.48px] sm:text-2xl">
              {t('pages.scoringConfiguration.history.noHistoryYet', 'No configuration changes yet')}
            </h3>

            {/* Secondary Message */}
            <p className="text-dark-500 text-center text-sm leading-[150%] font-medium tracking-[-0.32px] sm:text-base">
              {t(
                'pages.scoringConfiguration.history.makeFirstChange',
                'Make your first configuration change to see history here'
              )}
            </p>

            {/* Go Back Button */}
            <DoubleButton
              icon={<Icons.Settings size={20} />}
              iconPosition="left"
              onClick={handleGoBack}
              className="text-sm font-medium"
            >
              {t('pages.scoringConfiguration.history.goToConfig', 'Go to Configuration')}
            </DoubleButton>
          </div>
        ) : (
          // Data Table
          <div className="overflow-x-auto">
            <DataTable
              columns={columns}
              data={sortedData}
              sortConfig={sortConfig}
              onSort={handleSort}
              emptyMessage={t(
                'pages.scoringConfiguration.history.noHistoryFound',
                'No history found'
              )}
            />
          </div>
        )}
      </div>

      {/* Pagination Footer - Only show if there's data */}
      {totalItems > 0 && (
        <div className="mt-4 flex w-full items-center justify-center sm:mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            pageSize={rowsPerPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      )}
    </div>
  )
}

export default ConfigurationHistoryPage
