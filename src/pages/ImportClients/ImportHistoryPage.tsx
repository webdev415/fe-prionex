/**
 * ImportHistoryPage Component
 *
 * Page for viewing import history with filters, table, and pagination.
 * Uses reusable components following the same pattern as other pages.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { DataTable, type Column, type SortConfig } from '@/components/ui/DataTable'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Pagination } from '@/components/ui/Pagination'
import { Icons } from '@/lib/icons'
import {
  ImportHistoryFiltersBar,
  type ImportHistoryFilters,
} from './components/ImportHistoryFiltersBar'

// Types for import history data
export interface ImportHistoryItem {
  id: number | string
  dateTime: string
  fileName: string
  uploadedBy: string
  status: 'done' | 'failed'
  errors: number
}

// Generate 50 mock data items with variety
const generateMockData = (): ImportHistoryItem[] => {
  const users = ['Olena', 'Maria', 'John', 'Anna', 'David']
  const statuses: ('done' | 'failed')[] = ['done', 'failed']
  const data: ImportHistoryItem[] = []

  for (let i = 1; i <= 50; i++) {
    const date = new Date(2024, 10, Math.floor(Math.random() * 30) + 1) // November 2024
    const hours = Math.floor(Math.random() * 24)
    const minutes = Math.floor(Math.random() * 60)
    const dateTime = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

    const user = users[Math.floor(Math.random() * users.length)]
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    const errors =
      status === 'failed' ? Math.floor(Math.random() * 100) + 1 : Math.floor(Math.random() * 100)

    data.push({
      id: i,
      dateTime,
      fileName: `clients_batch_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${i}.csv`,
      uploadedBy: user,
      status,
      errors,
    })
  }

  return data
}

const mockImportHistory = generateMockData()

// Status Badge Component for Import History
function ImportStatusBadge({ status }: { status: 'done' | 'failed' }) {
  const isDone = status === 'done'
  return (
    <span
      className={`inline-flex h-[33px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white ${
        isDone ? 'bg-[#204E4D]' : 'bg-red-600'
      }`}
    >
      <span className="h-2 w-2 rounded-full bg-white" />
      {isDone ? 'Done' : 'Failed'}
    </span>
  )
}

export function ImportHistoryPage() {
  const navigate = useNavigate()
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [sortConfig, setSortConfig] = useState<SortConfig | undefined>(undefined)

  // Filter state - using the same pattern as SearchFiltersBar
  const [filters, setFilters] = useState<ImportHistoryFilters>({
    searchFilename: undefined,
    dateRange: undefined,
    status: undefined,
    uploadedBy: undefined,
  })

  // Track previous filter values to detect changes
  const prevFiltersRef = useRef(filters)

  // Extract unique users from mock data
  const availableUsers = useMemo(() => {
    const users = new Set(mockImportHistory.map((item) => item.uploadedBy))
    return Array.from(users).sort()
  }, [])

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let result = [...mockImportHistory]

    // Apply search filter
    if (filters.searchFilename) {
      const searchLower = filters.searchFilename.toLowerCase()
      result = result.filter((item) => item.fileName.toLowerCase().includes(searchLower))
    }

    // Apply status filter
    if (filters.status) {
      result = result.filter((item) => item.status === filters.status)
    }

    // Apply uploaded by filter
    if (filters.uploadedBy) {
      result = result.filter((item) => item.uploadedBy === filters.uploadedBy)
    }

    // Apply date range filter
    if (filters.dateRange && filters.dateRange !== 'all') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      result = result.filter((item) => {
        const itemDate = new Date(item.dateTime.split(' ')[0])
        itemDate.setHours(0, 0, 0, 0)

        switch (filters.dateRange) {
          case 'today': {
            return itemDate.getTime() === today.getTime()
          }
          case 'last_7_days': {
            const sevenDaysAgo = new Date(today)
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
            return itemDate >= sevenDaysAgo && itemDate <= today
          }
          case 'last_30_days': {
            const thirtyDaysAgo = new Date(today)
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
            return itemDate >= thirtyDaysAgo && itemDate <= today
          }
          case 'last_90_days': {
            const ninetyDaysAgo = new Date(today)
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
            return itemDate >= ninetyDaysAgo && itemDate <= today
          }
          default:
            return true
        }
      })
    }

    // Apply sorting
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
  }, [filters, sortConfig])

  // Calculate pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / rowsPerPage)
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    const end = start + rowsPerPage
    return filteredAndSortedData.slice(start, end)
  }, [filteredAndSortedData, currentPage, rowsPerPage])

  // Calculate max valid page
  const maxPage = useMemo(() => {
    return Math.max(1, Math.ceil(filteredAndSortedData.length / rowsPerPage))
  }, [filteredAndSortedData.length, rowsPerPage])

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

  const handleRowsPerPageChange = (value: string) => {
    setRowsPerPage(Number(value))
    setCurrentPage(1) // Reset to first page when changing rows per page
  }

  const handleViewDetails = () => {
    // TODO: Implement view details functionality
    console.log('View Details clicked')
  }

  const handleDownloadErrors = () => {
    // TODO: Implement download errors functionality
    console.log('Download Errors clicked')
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
  const hasNoData = mockImportHistory.length === 0

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
          <Link
            to={`/dashboard/import/history/${item.id}`}
            onClick={(e) => {
              e.stopPropagation()
            }}
            className="text-dark-500 flex items-center gap-1 text-xs font-medium no-underline transition-colors hover:opacity-80"
          >
            <Icons.View size={16} className="text-dark-500" strokeWidth={1.5} />
            View
          </Link>
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
            isLoading={false} // TODO: Add loading state from API
          />

          {/* Action Buttons */}
          <div className="flex w-[30%] items-center justify-end gap-2">
            {filteredAndSortedData.length > 0 && (
              <button
                onClick={handleViewDetails}
                className="bg-secondary-800 flex items-center rounded-full shadow-md transition-all duration-200 hover:shadow-lg"
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
              className="bg-primary-300 text-dark-500 flex h-[45px] items-center gap-2 rounded-full px-4 text-xs font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              <Icons.FileDownload size={20} className="text-dark-500" />
              Download Errors
            </button>
          </div>
        </div>
      </div>

      {/* Data Table or Empty State */}
      <div className="min-h-[400px] rounded-xl bg-white/50 p-6 shadow-sm">
        {filteredAndSortedData.length === 0 && hasActiveFilters ? (
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
        <div className="mt-6 flex items-center justify-between">
          {/* Rows per page selector */}
          <div className="flex items-center gap-2">
            <span className="text-dark-500 text-sm font-normal">Rows per page:</span>
            <Select value={String(rowsPerPage)} onValueChange={handleRowsPerPageChange}>
              <SelectTrigger className="h-10 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />

          {/* Page info */}
          <div className="text-dark-500 text-sm font-normal">
            Page {currentPage} of {totalPages}
          </div>
        </div>
      )}
    </div>
  )
}

export default ImportHistoryPage
