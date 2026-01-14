/**
 * ImportHistoryPage Component
 *
 * Page for viewing import history with filters, table, and pagination.
 * Uses reusable components following the same pattern as other pages.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useURLState } from '@/hooks/useURLState'
import { DataTable, type Column, type SortConfig } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { Icons } from '@/lib/icons'
import { LinkButton } from '@/components/ui/LinkButton'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { Button } from '@/components/ui/Button'
import {
  ImportHistoryFiltersBar,
  type ImportHistoryFilters,
} from './components/ImportHistoryFiltersBar'
import { useImportJobs, useExportImportErrors } from '@/features/imports'
import type { ImportJob, ImportJobsListParams } from '@/features/imports'
import { TableSkeleton } from '@/components/ui/TableSkeleton'

// Types for import history data - map from API types
export interface ImportHistoryItem {
  id: number | string
  dateTime: string
  fileName: string
  uploadedBy: string
  status: 'done' | 'failed' | 'in_progress' | 'pending' | 'cancelled'
  errors: number
}

// Helper to convert API ImportJob to ImportHistoryItem
// Note: Only converts completed or failed jobs (in_progress jobs are filtered out)
function mapImportJobToHistoryItem(job: ImportJob): ImportHistoryItem {
  return {
    id: job.id,
    dateTime: job.uploaded_at,
    fileName: job.file_name,
    uploadedBy: job.uploaded_by,
    status:
      job.status === 'completed'
        ? 'done'
        : job.status === 'failed'
          ? 'failed'
          : job.status === 'in_progress'
            ? 'in_progress'
            : job.status === 'pending'
              ? 'pending'
              : job.status === 'cancelled'
                ? 'cancelled'
                : 'done', // Default fallback
    errors: job.errors_count,
  }
}

// Status Badge Component for Import History
function ImportStatusBadge({
  status,
}: {
  status: 'done' | 'failed' | 'in_progress' | 'pending' | 'cancelled'
}) {
  const { t } = useTranslation('common')

  if (status === 'done') {
    return (
      <span className="inline-flex h-[33px] items-center gap-1.5 rounded-full bg-[#204E4D] px-3 text-xs font-medium text-white">
        <span className="h-2 w-2 rounded-full bg-white" />
        {t('pages.imports.history.statuses.done')}
      </span>
    )
  }

  if (status === 'in_progress') {
    return (
      <span className="bg-secondary-800 inline-flex h-[33px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white">
        <span className="h-2 w-2 rounded-full bg-white" />
        {t('pages.imports.history.statuses.inProgress')}
      </span>
    )
  }

  if (status === 'pending') {
    return (
      <span className="inline-flex h-[33px] items-center gap-1.5 rounded-full bg-yellow-500 px-3 text-xs font-medium text-white">
        <span className="h-2 w-2 rounded-full bg-white" />
        {t('pages.imports.history.statuses.pending')}
      </span>
    )
  }

  if (status === 'cancelled') {
    return (
      <span className="inline-flex h-[33px] items-center gap-1.5 rounded-full bg-gray-500 px-3 text-xs font-medium text-white">
        <span className="h-2 w-2 rounded-full bg-white" />
        {t('pages.imports.history.statuses.cancelled')}
      </span>
    )
  }

  return (
    <span className="inline-flex h-[33px] items-center gap-1.5 rounded-full bg-red-600 px-3 text-xs font-medium text-white">
      <span className="h-2 w-2 rounded-full bg-white" />
      {t('pages.imports.history.statuses.failed')}
    </span>
  )
}

export function ImportHistoryPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()

  // URL state for pagination
  const [currentPage, setCurrentPage] = useURLState<number>('page', 1)
  const [rowsPerPage, setRowsPerPage] = useURLState<number>('pageSize', 10)

  // URL state for sorting
  const [sortBy, setSortBy] = useURLState<string>('sort_by', '')
  const [sortOrder, setSortOrder] = useURLState<'asc' | 'desc'>('sort_order', 'asc')

  // URL state for all filter fields
  const [searchFilenameFilter, setSearchFilenameFilter] = useURLState<string>('search', '')
  const [dateRangeFilter, setDateRangeFilter] = useURLState<string>('date_range', '')
  const [statusFilter, setStatusFilter] = useURLState<string>('status', '')
  const [uploadedByFilter, setUploadedByFilter] = useURLState<string>('uploaded_by', '')

  // Reconstruct filters object from URL state
  const filters = useMemo<ImportHistoryFilters>(
    () => ({
      searchFilename: searchFilenameFilter || undefined,
      dateRange: dateRangeFilter || undefined,
      status: statusFilter || undefined,
      uploadedBy: uploadedByFilter || undefined,
    }),
    [searchFilenameFilter, dateRangeFilter, statusFilter, uploadedByFilter]
  )

  // Reconstruct sortConfig from URL state
  const sortConfig = useMemo<SortConfig | undefined>(
    () => (sortBy ? { key: sortBy, order: sortOrder } : undefined),
    [sortBy, sortOrder]
  )

  const [selectedJobId, setSelectedJobId] = useState<number | string | null>(null)

  // Export errors mutation
  const exportErrorsMutation = useExportImportErrors()

  // Track previous filter values to detect changes
  const prevFiltersRef = useRef(filters)

  // Build API params from filters
  // IMPORTANT: Always exclude 'in_progress' and 'pending' jobs from Import History page
  // Allow 'cancelled' jobs to be shown in history
  const apiParams = useMemo(() => {
    const params: ImportJobsListParams = {
      page: currentPage,
      page_size: rowsPerPage,
      // Always exclude in_progress and pending jobs from history page
      // Allow cancelled jobs to be shown
      exclude_status: ['in_progress', 'pending'],
    }

    if (filters.searchFilename) {
      params.search = filters.searchFilename
    }

    // Only allow filtering by 'completed', 'failed', or 'cancelled' status
    // Don't allow filtering by 'in_progress' in history page
    if (filters.status && filters.status !== 'all' && filters.status !== 'in_progress') {
      // Map filter status to API status
      if (filters.status === 'done') {
        params.status = 'completed'
      } else if (filters.status === 'failed') {
        params.status = 'failed'
      } else if (filters.status === 'cancelled') {
        params.status = 'cancelled'
      }
    }

    if (filters.uploadedBy && filters.uploadedBy !== 'all') {
      params.uploaded_by = filters.uploadedBy
    }

    // Handle date range
    if (filters.dateRange && filters.dateRange !== 'all') {
      // Use UTC dates to avoid timezone issues
      const now = new Date()
      const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

      switch (filters.dateRange) {
        case 'today': {
          const todayStr = todayUTC.toISOString().split('T')[0]
          params.date_from = todayStr
          params.date_to = todayStr
          break
        }
        case 'last_7_days': {
          const sevenDaysAgo = new Date(todayUTC)
          sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7)
          params.date_from = sevenDaysAgo.toISOString().split('T')[0]
          params.date_to = todayUTC.toISOString().split('T')[0]
          break
        }
        case 'last_30_days': {
          const thirtyDaysAgo = new Date(todayUTC)
          thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30)
          params.date_from = thirtyDaysAgo.toISOString().split('T')[0]
          params.date_to = todayUTC.toISOString().split('T')[0]
          break
        }
        case 'last_90_days': {
          const ninetyDaysAgo = new Date(todayUTC)
          ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90)
          params.date_from = ninetyDaysAgo.toISOString().split('T')[0]
          params.date_to = todayUTC.toISOString().split('T')[0]
          break
        }
      }
    }

    return params
  }, [currentPage, rowsPerPage, filters])

  // Fetch import jobs from API
  const { data: importJobsData, isLoading, refetch } = useImportJobs(apiParams)

  // Optional: Explicitly refetch when apiParams changes (though React Query should do this automatically)
  useEffect(() => {
    refetch()
  }, [apiParams, refetch])

  // Convert API data to ImportHistoryItem format
  // Filter out any in_progress and pending jobs as a safety measure (should be handled by API, but filter client-side too)
  // Allow cancelled jobs to be shown
  const importHistory = useMemo(() => {
    const jobs = (importJobsData?.items || []).filter(
      (job) => job.status !== 'in_progress' && job.status !== 'pending'
    )
    return jobs.map(mapImportJobToHistoryItem)
  }, [importJobsData])

  // Extract unique users from all import history (for filter dropdown)
  // Fetch all jobs without any filters to get all users who have import histories
  // Exclude in_progress and pending jobs when fetching for user list
  // Allow cancelled jobs to be included
  const { data: allJobsData } = useImportJobs({
    page: 1,
    page_size: 1000,
    exclude_status: ['in_progress', 'pending'],
    // Don't send any other filters - we want ALL users' data
  })

  const availableUsers = useMemo(() => {
    const allJobs = (allJobsData?.items || []).filter(
      (job) => job.status !== 'in_progress' && job.status !== 'pending'
    )
    // Extract unique usernames and filter out null/undefined
    const users = new Set(
      allJobs.map((job) => job.uploaded_by).filter((username): username is string => !!username)
    )
    return Array.from(users).sort()
  }, [allJobsData])

  // Filter and sort data (client-side sorting only, filtering is done by API)
  const filteredAndSortedData = useMemo(() => {
    const result = [...importHistory]

    // Apply sorting (API handles filtering)
    if (sortConfig) {
      result.sort((a, b) => {
        let aValue: string | number
        let bValue: string | number

        switch (sortConfig.key) {
          case 'dateTime':
            aValue = new Date(a.dateTime).getTime()
            bValue = new Date(b.dateTime).getTime()
            break
          case 'fileName':
            aValue = a.fileName.toLowerCase()
            bValue = b.fileName.toLowerCase()
            break
          case 'status':
            aValue = a.status
            bValue = b.status
            break
          case 'errors':
            aValue = a.errors
            bValue = b.errors
            break
          default:
            return 0
        }

        if (aValue < bValue) {
          return sortConfig.order === 'asc' ? -1 : 1
        }
        if (aValue > bValue) {
          return sortConfig.order === 'asc' ? 1 : -1
        }
        return 0
      })
    }

    return result
  }, [sortConfig, importHistory])

  // Calculate pagination from API response
  const totalPages = importJobsData?.total ? Math.ceil(importJobsData.total / rowsPerPage) : 1
  const paginatedData = filteredAndSortedData // Already paginated by API

  // Calculate max valid page
  const maxPage = totalPages

  // Reset to first page when filters change (but not when sort changes)
  // Use ref to track previous values and only update when filters actually change
  useEffect(() => {
    const prevFilters = prevFiltersRef.current
    const filtersChanged =
      prevFilters.searchFilename !== filters.searchFilename ||
      prevFilters.dateRange !== filters.dateRange ||
      prevFilters.status !== filters.status ||
      prevFilters.uploadedBy !== filters.uploadedBy

    if (filtersChanged) {
      prevFiltersRef.current = filters
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setCurrentPage(1)
      }, 0)
    }
  }, [
    filters.searchFilename,
    filters.dateRange,
    filters.status,
    filters.uploadedBy,
    filters,
    setCurrentPage,
  ])

  // Ensure current page doesn't exceed total pages when data changes
  useEffect(() => {
    if (currentPage > maxPage && maxPage > 0) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setCurrentPage(1)
      }, 0)
    }
  }, [maxPage, currentPage, setCurrentPage])

  const handleSort = (key: string, order: 'asc' | 'desc') => {
    setSortBy(key)
    setSortOrder(order)
    // Don't reset page when sorting - keep current page if possible
  }

  const handlePageChange = (page: number) => {
    // Ensure page is within valid range
    const validPage = Math.max(1, Math.min(page, maxPage))
    setCurrentPage(validPage)
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setRowsPerPage(newPageSize)
    setCurrentPage(1) // Reset to first page when page size changes
  }
  // const handleViewDetails = () => {
  //   if (selectedJobId) {
  //     navigate(`/dashboard/import/history/${selectedJobId}`)
  //   } else if (paginatedData.length > 0) {
  //     // If no selection, use first item
  //     navigate(`/dashboard/import/history/${paginatedData[0].id}`)
  //   }
  // }

  const handleDownloadErrors = () => {
    const jobId = selectedJobId || paginatedData[0]?.id
    if (jobId) {
      exportErrorsMutation.mutate(jobId)
    }
  }

  const handleFilterChange = useCallback(
    (newFilters: ImportHistoryFilters) => {
      // Update individual URL state for each filter field
      setSearchFilenameFilter(newFilters.searchFilename || '')
      setDateRangeFilter(newFilters.dateRange || '')
      setStatusFilter(newFilters.status || '')
      setUploadedByFilter(newFilters.uploadedBy || '')
      // Page reset is handled by useEffect above
    },
    [setSearchFilenameFilter, setDateRangeFilter, setStatusFilter, setUploadedByFilter]
  )

  const handleClearFilters = useCallback(() => {
    const clearedFilters: ImportHistoryFilters = {
      searchFilename: undefined,
      dateRange: undefined,
      status: undefined,
      uploadedBy: undefined,
    }
    // Update individual URL state for each filter field
    setSearchFilenameFilter('')
    setDateRangeFilter('')
    setStatusFilter('')
    setUploadedByFilter('')
    setCurrentPage(1)
    // Explicitly trigger filter change to ensure child component syncs
    handleFilterChange(clearedFilters)
  }, [
    handleFilterChange,
    setSearchFilenameFilter,
    setDateRangeFilter,
    setStatusFilter,
    setUploadedByFilter,
    setCurrentPage,
  ])

  const handleGoToImportClients = useCallback(() => {
    navigate('/dashboard/import')
  }, [navigate])

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.searchFilename ||
      (filters.dateRange && filters.dateRange !== 'all') ||
      (filters.status && filters.status !== 'all') ||
      (filters.uploadedBy && filters.uploadedBy !== 'all')
    )
  }, [filters])

  // Check if there's any data at all (not just filtered)
  const hasNoData = !isLoading && (importJobsData?.total || 0) === 0

  // Table columns definition
  const columns: Column<ImportHistoryItem>[] = [
    {
      key: 'dateTime',
      header: t('pages.imports.history.tableHeaders.dateTime'),
      sortable: true,
      render: (item) => <span>{item.dateTime}</span>,
    },
    {
      key: 'fileName',
      header: t('pages.imports.history.tableHeaders.fileName'),
      sortable: true,
      render: (item) => (
        <div className="flex flex-col">
          <span className="font-medium">{item.fileName}</span>
          <span className="mt-0.5 text-[11px] text-gray-600">
            {t('pages.imports.history.uploadedBy')} {item.uploadedBy}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('pages.imports.history.tableHeaders.status'),
      sortable: true,
      render: (item) => <ImportStatusBadge status={item.status} />,
    },
    {
      key: 'errors',
      header: t('pages.imports.history.tableHeaders.errors'),
      sortable: true,
      align: 'center',
      render: (item) => <span>{item.errors}</span>,
    },
    {
      key: 'actions',
      header: t('pages.imports.history.tableHeaders.actions'),
      align: 'center',
      render: (item) => (
        <div className="flex items-center justify-center">
          <LinkButton
            variant="regular-black"
            size="xs"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedJobId(item.id)
              navigate(`/dashboard/import/history/${item.id}`)
            }}
            leftIcon={<Icons.View size={16} color="#05040D" strokeWidth={1.5} />}
          >
            {t('pages.imports.history.view')}
          </LinkButton>
        </div>
      ),
    },
  ]

  return (
    <div>
      {/* Page Header */}
      <div className="mb-4 flex w-full items-center justify-between">
        <div className="flex items-center gap-4">
          <LinkButton
            variant="regular-black"
            onClick={handleGoToImportClients}
            leftIcon={<Icons.ArrowLeft size={16} className="text-dark-500" />}
          >
            {t('common.back', 'Back')}
          </LinkButton>
          <h1 className="text-dark-500 text-2xl font-light">{t('pages.imports.history.title')}</h1>
        </div>
      </div>
      <div className="mb-6">
        <div className="mb-6 flex w-full items-center justify-between gap-3">
          {/* Filters Section - using the reusable component */}
          <ImportHistoryFiltersBar
            filters={filters}
            onFilterChange={handleFilterChange}
            availableUsers={availableUsers}
            isLoading={isLoading}
          />

          {/* Action Buttons */}
          <div className="flex w-[30%] items-center justify-end gap-2">
            <Button
              onClick={handleDownloadErrors}
              variant="primary"
              size="xs"
              leftIcon={<Icons.FileDownload size={20} />}
              disabled={
                exportErrorsMutation.isPending ||
                (!selectedJobId && paginatedData.length === 0) ||
                (selectedJobId
                  ? !paginatedData.find((item) => item.id === selectedJobId)?.errors
                  : !paginatedData[0]?.errors)
              }
              className="flex h-12 items-center rounded-full text-xs font-medium"
            >
              {exportErrorsMutation.isPending
                ? t('pages.imports.history.exporting')
                : t('pages.imports.history.downloadErrors')}
            </Button>
          </div>
        </div>
      </div>

      {/* Data Table or Empty State */}
      <div className="min-h-[400px] rounded-xl bg-white/50 p-6 shadow-sm">
        {isLoading ? (
          // Loading State - Show skeleton table while fetching data
          <TableSkeleton columns={5} rows={rowsPerPage} />
        ) : filteredAndSortedData.length === 0 && hasActiveFilters ? (
          // Empty State - No results for filters
          <div className="flex flex-col items-center justify-center py-16">
            {/* Icon */}
            <div className="flex h-16 w-16 items-center justify-center rounded-lg">
              <Icons.FolderRemove size={48} className="text-gray-400" strokeWidth={1} />
            </div>

            {/* Message */}
            <h3 className="text-dark-500 flex flex-col items-center justify-center gap-6 p-6 text-2xl leading-[120%] font-light tracking-[-0.48px]">
              {t('pages.imports.history.noImportsFound')}
            </h3>

            {/* Clear Filters Button */}
            <DoubleButton
              icon={<Icons.Reload size={22} />}
              iconPosition="left"
              onClick={handleClearFilters}
              className="text-sm font-medium"
            >
              {t('pages.imports.history.clearFilters')}
            </DoubleButton>
          </div>
        ) : hasNoData ? (
          // Empty State - No import history at all
          <div className="flex min-h-[448px] flex-col items-center justify-center gap-6 p-6">
            {/* Icon */}
            <div className="flex h-20 w-20 items-center justify-center">
              <Icons.FolderRemove size={48} className="text-gray-400" strokeWidth={1} />
            </div>

            {/* Primary Message */}
            <h3 className="text-dark-500 text-center text-2xl leading-[120%] font-light tracking-[-0.48px]">
              {t('pages.imports.history.noHistoryYet')}
            </h3>

            {/* Secondary Message */}
            <p className="text-dark-500 text-center text-base leading-[150%] font-medium tracking-[-0.32px]">
              {t('pages.imports.history.runFirstImport')}
            </p>

            {/* Go to Import Clients Button */}
            <DoubleButton
              icon={<Icons.FileImport size={20} />}
              iconPosition="left"
              onClick={handleGoToImportClients}
              className="text-sm font-medium"
            >
              {t('pages.imports.history.goToImportClients')}
            </DoubleButton>
          </div>
        ) : (
          // Data Table
          <DataTable
            columns={columns}
            data={paginatedData}
            sortConfig={sortConfig}
            onSort={handleSort}
            emptyMessage={t('pages.imports.history.noHistoryFound')}
          />
        )}
      </div>

      {/* Pagination Footer - Only show if there's data */}
      {filteredAndSortedData.length > 0 && (
        <div className="mt-6 flex items-center justify-center">
          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            pageSize={rowsPerPage}
            onPageSizeChange={handlePageSizeChange} // Implement page size change
          />
        </div>
      )}
    </div>
  )
}

export default ImportHistoryPage
