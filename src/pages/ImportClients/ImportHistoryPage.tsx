/**
 * ImportHistoryPage Component
 *
 * Page for viewing import history with filters, table, and pagination.
 * Uses reusable components following the same pattern as other pages.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataTable, type Column, type SortConfig } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { Icons } from '@/lib/icons'
import {
  ImportHistoryFiltersBar,
  type ImportHistoryFilters,
} from './components/ImportHistoryFiltersBar'
import { useImportJobs, useExportImportErrors } from '@/features/imports'
import type { ImportJob, ImportJobsListParams } from '@/features/imports'

// Types for import history data - map from API types
export interface ImportHistoryItem {
  id: number | string
  dateTime: string
  fileName: string
  uploadedBy: string
  status: 'done' | 'failed' | 'in_progress'
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
    status: job.status === 'completed' ? 'done' : job.status === 'failed' ? 'failed' : 'done', // Default to 'done' for any other status
    errors: job.errors_count,
  }
}

// Status Badge Component for Import History
function ImportStatusBadge({ status }: { status: 'done' | 'failed' | 'in_progress' }) {
  if (status === 'done') {
    return (
      <span className="inline-flex h-[33px] items-center gap-1.5 rounded-full bg-[#204E4D] px-3 text-xs font-medium text-white">
        <span className="h-2 w-2 rounded-full bg-white" />
        Done
      </span>
    )
  }

  if (status === 'in_progress') {
    return (
      <span className="bg-secondary-800 inline-flex h-[33px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white">
        <span className="h-2 w-2 rounded-full bg-white" />
        In progress
      </span>
    )
  }

  return (
    <span className="inline-flex h-[33px] items-center gap-1.5 rounded-full bg-red-600 px-3 text-xs font-medium text-white">
      <span className="h-2 w-2 rounded-full bg-white" />
      Failed
    </span>
  )
}

export function ImportHistoryPage() {
  const navigate = useNavigate()
  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 10 // Changed from useState to constant
  const [sortConfig, setSortConfig] = useState<SortConfig | undefined>(undefined)
  const [selectedJobId, setSelectedJobId] = useState<number | string | null>(null)

  // Export errors mutation
  const exportErrorsMutation = useExportImportErrors()

  // Filter state - using the same pattern as SearchFiltersBar
  const [filters, setFilters] = useState<ImportHistoryFilters>({
    searchFilename: undefined,
    dateRange: undefined,
    status: undefined,
    uploadedBy: undefined,
  })

  // Track previous filter values to detect changes
  const prevFiltersRef = useRef(filters)

  // Build API params from filters
  // IMPORTANT: Always exclude 'in_progress' and 'pending' jobs from Import History page
  const apiParams = useMemo(() => {
    const params: ImportJobsListParams = {
      page: currentPage,
      page_size: rowsPerPage,
      // Always exclude in_progress and pending jobs from history page
      exclude_status: ['in_progress', 'pending'],
    }

    if (filters.searchFilename) {
      params.search = filters.searchFilename
    }

    // Only allow filtering by 'completed' or 'failed' status
    // Don't allow filtering by 'in_progress' in history page
    if (filters.status && filters.status !== 'all' && filters.status !== 'in_progress') {
      // Map filter status to API status
      if (filters.status === 'done') {
        params.status = 'completed'
      } else if (filters.status === 'failed') {
        params.status = 'failed'
      }
    }

    if (filters.uploadedBy && filters.uploadedBy !== 'all') {
      params.uploaded_by = filters.uploadedBy
    }

    // Handle date range
    if (filters.dateRange && filters.dateRange !== 'all') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      switch (filters.dateRange) {
        case 'today': {
          params.date_from = today.toISOString().split('T')[0]
          params.date_to = today.toISOString().split('T')[0]
          break
        }
        case 'last_7_days': {
          const sevenDaysAgo = new Date(today)
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
          params.date_from = sevenDaysAgo.toISOString().split('T')[0]
          params.date_to = today.toISOString().split('T')[0]
          break
        }
        case 'last_30_days': {
          const thirtyDaysAgo = new Date(today)
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
          params.date_from = thirtyDaysAgo.toISOString().split('T')[0]
          params.date_to = today.toISOString().split('T')[0]
          break
        }
        case 'last_90_days': {
          const ninetyDaysAgo = new Date(today)
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
          params.date_from = ninetyDaysAgo.toISOString().split('T')[0]
          params.date_to = today.toISOString().split('T')[0]
          break
        }
      }
    }

    return params
  }, [currentPage, rowsPerPage, filters])

  // Fetch import jobs from API
  const { data: importJobsData, isLoading } = useImportJobs(apiParams)

  // Convert API data to ImportHistoryItem format
  // Filter out any in_progress jobs as a safety measure (should be handled by API, but filter client-side too)
  const importHistory = useMemo(() => {
    const jobs = (importJobsData?.items || []).filter(
      (job) => job.status !== 'in_progress' && job.status !== 'pending'
    )
    return jobs.map(mapImportJobToHistoryItem)
  }, [importJobsData])

  // Extract unique users from all import history (for filter dropdown)
  // We need to fetch all jobs without filters to get all users
  // Exclude in_progress jobs when fetching for user list
  const { data: allJobsData } = useImportJobs({
    page: 1,
    page_size: 1000,
    exclude_status: ['in_progress', 'pending'],
  })
  const availableUsers = useMemo(() => {
    const allJobs = (allJobsData?.items || []).filter(
      (job) => job.status !== 'in_progress' && job.status !== 'pending'
    )
    const users = new Set(allJobs.map((job) => job.uploaded_by))
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
  }, [filters.searchFilename, filters.dateRange, filters.status, filters.uploadedBy, filters])

  // Ensure current page doesn't exceed total pages when data changes
  useEffect(() => {
    if (currentPage > maxPage && maxPage > 0) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setCurrentPage(1)
      }, 0)
    }
  }, [maxPage, currentPage])

  const handleSort = (key: string, order: 'asc' | 'desc') => {
    setSortConfig({ key, order })
    // Don't reset page when sorting - keep current page if possible
  }

  const handlePageChange = (page: number) => {
    // Ensure page is within valid range
    const validPage = Math.max(1, Math.min(page, maxPage))
    setCurrentPage(validPage)
  }

  const handleViewDetails = () => {
    if (selectedJobId) {
      navigate(`/dashboard/import/history/${selectedJobId}`)
    } else if (paginatedData.length > 0) {
      // If no selection, use first item
      navigate(`/dashboard/import/history/${paginatedData[0].id}`)
    }
  }

  const handleDownloadErrors = () => {
    const jobId = selectedJobId || paginatedData[0]?.id
    if (jobId) {
      exportErrorsMutation.mutate(jobId)
    }
  }

  const handleFilterChange = useCallback((newFilters: ImportHistoryFilters) => {
    setFilters(newFilters)
    // Page reset is handled by useEffect above
  }, [])

  const handleClearFilters = useCallback(() => {
    const clearedFilters: ImportHistoryFilters = {
      searchFilename: undefined,
      dateRange: undefined,
      status: undefined,
      uploadedBy: undefined,
    }
    setFilters(clearedFilters)
    setCurrentPage(1)
    // Explicitly trigger filter change to ensure child component syncs
    handleFilterChange(clearedFilters)
  }, [handleFilterChange])

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
      header: 'Date/Time',
      sortable: true,
      render: (item) => <span>{item.dateTime}</span>,
    },
    {
      key: 'fileName',
      header: 'File name',
      sortable: true,
      render: (item) => (
        <div className="flex flex-col">
          <span className="font-medium">{item.fileName}</span>
          <span className="mt-0.5 text-[11px] text-gray-600">Uploaded by: {item.uploadedBy}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (item) => <ImportStatusBadge status={item.status} />,
    },
    {
      key: 'errors',
      header: 'Errors',
      sortable: true,
      align: 'center',
      render: (item) => <span>{item.errors}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      render: (item) => (
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedJobId(item.id)
              navigate(`/dashboard/import/history/${item.id}`)
            }}
            className="text-dark-500 flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
          >
            <Icons.View size={16} className="text-dark-500" strokeWidth={1.5} />
            View
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-dark-500 mb-6 text-2xl font-light">Import History</h1>
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
            {filteredAndSortedData.length > 0 && (
              <button
                onClick={handleViewDetails}
                disabled={!selectedJobId && paginatedData.length === 0}
                className="bg-secondary-800 flex items-center rounded-full shadow-md transition-all duration-200 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="bg-primary-300 ml-1 flex h-10 w-10 items-center justify-center rounded-full">
                  <Icons.File size={20} className="text-dark-500" strokeWidth={1.5} />
                </div>
                <span className="px-4 py-3 text-sm font-medium text-white">View Details</span>
              </button>
            )}
            <button
              onClick={handleDownloadErrors}
              type="button"
              disabled={
                exportErrorsMutation.isPending ||
                (!selectedJobId && paginatedData.length === 0) ||
                (selectedJobId
                  ? !paginatedData.find((item) => item.id === selectedJobId)?.errors
                  : !paginatedData[0]?.errors)
              }
              className="bg-primary-300 text-dark-500 flex h-[45px] items-center gap-2 rounded-full px-4 text-xs font-medium transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icons.FileDownload size={20} className="text-dark-500" />
              {exportErrorsMutation.isPending ? 'Exporting...' : 'Download Errors'}
            </button>
          </div>
        </div>
      </div>

      {/* Data Table or Empty State */}
      <div className="min-h-[400px] rounded-xl bg-white/50 p-6 shadow-sm">
        {isLoading ? (
          // Loading State - Show while fetching data
          <div className="flex min-h-[448px] flex-col items-center justify-center gap-6 p-6">
            <div className="text-dark-500 text-center text-base leading-[150%] font-light tracking-[-0.32px]">
              Loading import history...
            </div>
          </div>
        ) : filteredAndSortedData.length === 0 && hasActiveFilters ? (
          // Empty State - No results for filters
          <div className="flex flex-col items-center justify-center py-16">
            {/* Icon */}
            <div className="flex h-16 w-16 items-center justify-center rounded-lg">
              <Icons.FolderRemove size={48} className="text-gray-400" strokeWidth={1} />
            </div>

            {/* Message */}
            <h3 className="text-dark-500 flex flex-col items-center justify-center gap-6 p-6 text-2xl leading-[120%] font-light tracking-[-0.48px]">
              No imports found for selected filters.
            </h3>

            {/* Clear Filters Button */}
            <button
              onClick={handleClearFilters}
              className="bg-secondary-800 flex items-center rounded-full shadow-md transition-all duration-200 hover:shadow-lg"
            >
              <div className="bg-primary-300 ml-1 flex h-10 w-10 items-center justify-center rounded-full">
                <Icons.Reload size={22} className="text-dark-500" strokeWidth={1.5} />
              </div>
              <span className="px-4 py-3 text-sm font-medium text-white">Clear filters</span>
            </button>
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
              No import history yet.
            </h3>

            {/* Secondary Message */}
            <p className="text-dark-500 text-center text-base leading-[150%] font-medium tracking-[-0.32px]">
              Run your first CSV import to see history here.
            </p>

            {/* Go to Import Clients Button */}
            <button
              onClick={handleGoToImportClients}
              className="bg-secondary-800 flex items-center rounded-full shadow-md transition-all duration-200 hover:shadow-lg"
            >
              <div className="bg-primary-300 ml-1 flex h-10 w-10 items-center justify-center rounded-full">
                <Icons.FileImport size={20} className="text-dark-500" strokeWidth={1.5} />
              </div>
              <span className="px-4 py-3 text-sm font-medium text-white">Go to Import Clients</span>
            </button>
          </div>
        ) : (
          // Data Table
          <DataTable
            columns={columns}
            data={paginatedData}
            sortConfig={sortConfig}
            onSort={handleSort}
            emptyMessage="No import history found"
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
            onPageSizeChange={() => {}} // TODO: Implement page size change
          />
        </div>
      )}
    </div>
  )
}

export default ImportHistoryPage
