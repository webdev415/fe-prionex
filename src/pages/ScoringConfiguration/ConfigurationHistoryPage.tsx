/**
 * Configuration History Page
 *
 * Page for viewing scoring configuration change history with filters, table, and pagination.
 * Uses reusable components following the same pattern as ImportHistoryPage.
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { DataTable, type Column, type SortConfig } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { configApi, type ConfigHistoryEntry } from '@/features/clients/api/configApi'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { useQuery } from '@tanstack/react-query'

// Status Badge Component for Configuration Changes
function ChangeTypeBadge({ changeType }: { changeType: string }) {
  const { t } = useTranslation('common')

  if (changeType === 'create') {
    return (
      <span className="inline-flex h-[33px] items-center gap-1.5 rounded-full bg-green-600 px-3 text-xs font-medium text-white">
        <span className="h-2 w-2 rounded-full bg-white" />
        {t('pages.scoringConfiguration.history.changeTypes.created', 'Created')}
      </span>
    )
  }

  if (changeType === 'update') {
    return (
      <span className="inline-flex h-[33px] items-center gap-1.5 rounded-full bg-blue-600 px-3 text-xs font-medium text-white">
        <span className="h-2 w-2 rounded-full bg-white" />
        {t('pages.scoringConfiguration.history.changeTypes.updated', 'Updated')}
      </span>
    )
  }

  if (changeType === 'delete') {
    return (
      <span className="inline-flex h-[33px] items-center gap-1.5 rounded-full bg-red-600 px-3 text-xs font-medium text-white">
        <span className="h-2 w-2 rounded-full bg-white" />
        {t('pages.scoringConfiguration.history.changeTypes.deleted', 'Deleted')}
      </span>
    )
  }

  return (
    <span className="inline-flex h-[33px] items-center gap-1.5 rounded-full bg-gray-600 px-3 text-xs font-medium text-white">
      <span className="h-2 w-2 rounded-full bg-white" />
      {changeType}
    </span>
  )
}

export function ConfigurationHistoryPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [sortConfig, setSortConfig] = useState<SortConfig | undefined>(undefined)

  // Fetch configuration history
  const { data, isLoading } = useQuery({
    queryKey: ['configHistory', { page: currentPage, page_size: rowsPerPage }],
    queryFn: () => configApi.getConfigHistory({ page: currentPage, page_size: rowsPerPage }),
  })

  const historyItems = (data?.history || []).map((item) => ({
    ...item,
    id: item.history_id,
  }))
  const totalItems = data?.total_count || 0
  const totalPages = Math.ceil(totalItems / rowsPerPage)

  // Handle sort
  const handleSort = (key: string, order: 'asc' | 'desc') => {
    setSortConfig({ key, order })
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

  const handleExportHistory = async () => {
    try {
      const blob = await configApi.exportConfigHistory()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `config-history-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

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

  // Define table columns
  const columns: Column<ConfigHistoryEntry>[] = [
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
        <span>{item.changed_by_username || `User #${item.changed_by_user_id}`}</span>
      ),
    },
    {
      key: 'change_reason',
      header: t('pages.scoringConfiguration.history.tableHeaders.reason', 'Reason'),
      sortable: false,
      render: (item) => <span className="text-sm text-gray-600">{item.change_reason || '-'}</span>,
    },
    {
      key: 'changes_summary',
      header: t('pages.scoringConfiguration.history.tableHeaders.changes', 'Changes'),
      sortable: false,
      render: (item) => {
        const changedFields: string[] = []
        if (item.old_values && item.new_values) {
          const allKeys = new Set([
            ...Object.keys(item.old_values),
            ...Object.keys(item.new_values),
          ])
          allKeys.forEach((key) => {
            if (JSON.stringify(item.old_values?.[key]) !== JSON.stringify(item.new_values?.[key])) {
              changedFields.push(key)
            }
          })
        }
        return (
          <div className="text-xs text-gray-600">
            {changedFields.length > 0 ? changedFields.join(', ') : '-'}
          </div>
        )
      },
    },
  ]

  const hasNoData = !isLoading && totalItems === 0

  return (
    <div className="flex w-full flex-col items-start gap-6">
      {/* Header */}
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGoBack}
            leftIcon={<Icons.ArrowLeft size={20} />}
            className="rounded-full"
          >
            {t('common.back', 'Back')}
          </Button>
          <h1 className="text-dark-500 text-2xl font-semibold">
            {t('pages.scoringConfiguration.history.title', 'Configuration History')}
          </h1>
        </div>
        <Button
          variant="secondary"
          onClick={handleExportHistory}
          leftIcon={<Icons.Download size={20} />}
          className="rounded-full"
          disabled={hasNoData}
        >
          {t('pages.scoringConfiguration.history.export', 'Export CSV')}
        </Button>
      </div>

      {/* Data Table or Empty State */}
      <div className="min-h-[400px] w-full rounded-xl bg-white/50 p-6 shadow-sm">
        {isLoading ? (
          // Loading State - Show skeleton table while fetching data
          <TableSkeleton columns={5} rows={rowsPerPage} />
        ) : hasNoData ? (
          // Empty State - No configuration history at all
          <div className="flex min-h-[448px] flex-col items-center justify-center gap-6 p-6">
            {/* Icon */}
            <div className="flex h-20 w-20 items-center justify-center">
              <Icons.FolderRemove size={48} className="text-gray-400" strokeWidth={1} />
            </div>

            {/* Primary Message */}
            <h3 className="text-dark-500 text-center text-2xl leading-[120%] font-light tracking-[-0.48px]">
              {t('pages.scoringConfiguration.history.noHistoryYet', 'No configuration changes yet')}
            </h3>

            {/* Secondary Message */}
            <p className="text-dark-500 text-center text-base leading-[150%] font-medium tracking-[-0.32px]">
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
        )}
      </div>

      {/* Pagination Footer - Only show if there's data */}
      {totalItems > 0 && (
        <div className="mt-6 flex w-full items-center justify-center">
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
