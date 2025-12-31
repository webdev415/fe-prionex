/**
 * Client Management Page
 *
 * Main page for managing clients with priority overview, filters, and data table.
 */

import { useState, useMemo, useEffect, useRef, startTransition } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column, type SortConfig } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Button } from '@/components/ui/Button'
import { LinkButton } from '@/components/ui/LinkButton'
import { PriorityCards } from './components/PriorityCards'
import { PriorityBadge } from './components/PriorityBadge'
import { ClientFiltersBar } from './components/ClientFiltersBar'
import { AssignClientModal } from './components/AssignClientModal'
import { BulkAssignClientModal } from './components/BulkAssignClientModal'
import { ClientManagementPageSkeleton } from './components/ClientManagementPageSkeleton'
import { Icons } from '@/lib/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useClients, useClientCount, usePrioritySummary } from '@/features/clients/hooks/useClients'
import { usePriorityThresholds } from '@/features/clients/hooks/useConfig'
import { mapScoreToPriority } from '@/features/clients/api/configApi'
import type { Client as APIClient } from '@/features/clients/api/types'
import type { PriorityThresholds } from '@/features/clients/api/configApi'
import { useDebounce } from '@/hooks/useDebounce'

// Display type matching page requirements
interface DisplayClient {
  id: number
  fullName: string
  taxIdNumber: string
  tags: string[]
  phoneNumber: string
  dateOfSale: string
  creditor: string
  debt: number
  amountOfDebt: number
  priority: 'Critical' | 'High' | 'Medium' | 'Low'
  score: number
}

// Default thresholds (fallback if API not available)
const DEFAULT_THRESHOLDS: PriorityThresholds = {
  critical: 75,
  high: 50,
  medium: 25,
  low: 0,
}

// Helper to map API Client to DisplayClient
const mapAPIClientToDisplay = (
  client: APIClient,
  thresholds: PriorityThresholds
): DisplayClient => {
  const fullName = [client.first_name, client.middle_name, client.last_name]
    .filter(Boolean)
    .join(' ')

  return {
    id: client.id,
    fullName,
    taxIdNumber: client.tax_id,
    tags: [], // TODO: Add tags from backend when available
    phoneNumber: client.phone_primary,
    dateOfSale: client.created_at ? new Date(client.created_at).toLocaleDateString('uk-UA') : '-',
    creditor: client.primary_creditor || '-',
    debt: client.total_debt || 0,
    amountOfDebt: client.total_debt || 0,
    priority:
      (client.manual_priority as 'Critical' | 'High' | 'Medium' | 'Low') ||
      mapScoreToPriority(client.priority_score, thresholds),
    score: client.priority_score,
  }
}

export interface ClientFilters {
  debtRangeFrom?: number
  debtRangeTo?: number
  amountOfDebtRangeFrom?: number
  amountOfDebtRangeTo?: number
  dpdRangeFrom?: number
  dpdRangeTo?: number
  dateOfSaleFrom?: string
  dateOfSaleTo?: string
  portfolio?: string[]
  status?: string[]
  responsibleEmployee?: string
  responsibleSearcher?: string
}

export function ClientManagementPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const searchQuery = searchParams.get('search') || ''
  const searchType = searchParams.get('type') || 'phone'

  const [filters, setFilters] = useState<ClientFilters>({
    // Start with no filters applied - user can select what they want
    portfolio: [],
    status: [],
  })
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [sortConfig, setSortConfig] = useState<SortConfig | undefined>()
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedClients, setSelectedClients] = useState<Set<number>>(new Set())
  const [allClientsSelected, setAllClientsSelected] = useState(false)
  const [excludedClients, setExcludedClients] = useState<Set<number>>(new Set()) // Track excluded items when all are selected
  const [assignModalClientId, setAssignModalClientId] = useState<number | null>(null)
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false)
  const prevSearchQueryRef = useRef(searchQuery)
  const prevFiltersRef = useRef(filters)
  const prevRowsPerPageRef = useRef(rowsPerPage)
  const prevSortConfigRef = useRef(sortConfig)

  // Debounce filters to avoid triggering API calls on every keystroke
  const debouncedFilters = useDebounce(filters, 500)

  // Convert frontend filters to API parameters
  const apiParams = useMemo(() => {
    // Map frontend sort keys to backend sort fields
    // Note: debt/amountOfDebt removed - total_debt is computed post-query and not sortable
    const sortFieldMap: Record<string, string> = {
      priority: 'priority_score',
      score: 'priority_score',
      fullName: 'first_name',
      id: 'id',
    }

    const params: Record<string, unknown> = {
      // Server-side pagination
      skip: (currentPage - 1) * rowsPerPage,
      limit: rowsPerPage,
    }

    // Add sorting parameters
    if (sortConfig) {
      const backendSortField = sortFieldMap[sortConfig.key] || 'priority_score'
      params.sort_by = backendSortField
      params.sort_order = sortConfig.order
    } else {
      // Default sort: priority_score DESC
      params.sort_by = 'priority_score'
      params.sort_order = 'desc'
    }

    // Debt range filtering - use debtRangeFrom/To for filtering
    if (debouncedFilters.debtRangeFrom !== undefined) {
      params.debt_min = debouncedFilters.debtRangeFrom
    }
    if (debouncedFilters.debtRangeTo !== undefined) {
      params.debt_max = debouncedFilters.debtRangeTo
    }

    // Status filtering - join array into comma-separated string
    if (debouncedFilters.status && debouncedFilters.status.length > 0) {
      params.status = debouncedFilters.status.join(',')
    }

    // Date range filtering
    if (debouncedFilters.dateOfSaleFrom) {
      params.date_from = debouncedFilters.dateOfSaleFrom
    }
    if (debouncedFilters.dateOfSaleTo) {
      params.date_to = debouncedFilters.dateOfSaleTo
    }

    return params
  }, [debouncedFilters, currentPage, rowsPerPage, sortConfig])

  // Fetch clients from API
  const { data: apiClients = [], isLoading, isFetching, isError, error } = useClients(apiParams)
  const { data: totalCount = 0 } = useClientCount()
  const { data: prioritySummaryData } = usePrioritySummary()

  // Fetch priority thresholds configuration
  const { data: thresholds = DEFAULT_THRESHOLDS } = usePriorityThresholds()

  // Map API clients to display format
  const displayClients = useMemo(() => {
    return apiClients.map((client) => mapAPIClientToDisplay(client, thresholds))
  }, [apiClients, thresholds])

  // Reset to page 1 when search query or filters change
  useEffect(() => {
    if (searchQuery !== prevSearchQueryRef.current) {
      prevSearchQueryRef.current = searchQuery
      startTransition(() => {
        setCurrentPage(1)
        setSelectedClients(new Set()) // Clear selection when search changes
      })
    }
  }, [searchQuery])

  // Reset to page 1 when filters, page size, or sort changes
  useEffect(() => {
    const filtersChanged =
      JSON.stringify(debouncedFilters) !== JSON.stringify(prevFiltersRef.current)
    const rowsPerPageChanged = rowsPerPage !== prevRowsPerPageRef.current
    const sortConfigChanged =
      JSON.stringify(sortConfig) !== JSON.stringify(prevSortConfigRef.current)

    if (filtersChanged || rowsPerPageChanged || sortConfigChanged) {
      prevFiltersRef.current = debouncedFilters
      prevRowsPerPageRef.current = rowsPerPage
      prevSortConfigRef.current = sortConfig
      startTransition(() => {
        setCurrentPage(1)
        // Only clear selection when filters change, not when rows per page or sort changes
        if (filtersChanged) {
          setSelectedClients(new Set())
          setAllClientsSelected(false)
          setExcludedClients(new Set())
        }
      })
    }
  }, [debouncedFilters, rowsPerPage, sortConfig])

  // Count applied filters
  const appliedFiltersCount = useMemo(() => {
    let count = 0
    if (filters.debtRangeFrom || filters.debtRangeTo) count++
    // Note: amountOfDebtRange is same as debtRange (both filter on total_debt)
    // Not counting amountOfDebtRange separately to avoid double-counting
    // DPD Range not yet implemented (days past due not calculated)
    // if (filters.dpdRangeFrom || filters.dpdRangeTo) count++
    if (filters.dateOfSaleFrom || filters.dateOfSaleTo) count++
    // Portfolio not yet implemented in schema
    // if (filters.portfolio && filters.portfolio.length > 0) count++
    if (filters.status && filters.status.length > 0) count++
    // Responsible employee/searcher not yet assigned to clients
    // if (filters.responsibleEmployee) count++
    // if (filters.responsibleSearcher) count++
    return count
  }, [filters])

  // Filter clients (search only - sorting and pagination handled server-side)
  const filteredClients = useMemo(() => {
    let result = [...displayClients]

    // Apply search filter (client-side)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      const phoneRegex = /[\s\-()]/g
      result = result.filter((client) => {
        switch (searchType) {
          case 'phone': {
            // Search by phone number (remove spaces and special chars for comparison)
            const phoneNormalized = client.phoneNumber.replace(phoneRegex, '').toLowerCase()
            const queryNormalized = query.replace(phoneRegex, '')
            return phoneNormalized.includes(queryNormalized)
          }
          case 'username':
          case 'email': {
            // For username/email, search in full name and tax ID (as we don't have email/username fields)
            return (
              client.fullName.toLowerCase().includes(query) ||
              client.taxIdNumber.toLowerCase().includes(query)
            )
          }
          default: {
            // Search in all fields
            const queryNormalized = query.replace(phoneRegex, '')
            return (
              client.fullName.toLowerCase().includes(query) ||
              client.phoneNumber.replace(phoneRegex, '').toLowerCase().includes(queryNormalized) ||
              client.taxIdNumber.toLowerCase().includes(query) ||
              client.creditor.toLowerCase().includes(query) ||
              client.tags.some((tag) => tag.toLowerCase().includes(query))
            )
          }
        }
      })
    }

    // Note: Sorting, pagination, and filters are handled server-side
    return result
  }, [displayClients, searchQuery, searchType])

  // Map API priority summary to component format
  const priorityStats = useMemo(() => {
    if (!prioritySummaryData) {
      return {
        Critical: { totalDebt: 0, count: 0 },
        High: { totalDebt: 0, count: 0 },
        Medium: { totalDebt: 0, count: 0 },
        Low: { totalDebt: 0, count: 0 },
      }
    }

    return {
      Critical: {
        totalDebt: prioritySummaryData.critical.total_debt,
        count: prioritySummaryData.critical.count,
      },
      High: {
        totalDebt: prioritySummaryData.high.total_debt,
        count: prioritySummaryData.high.count,
      },
      Medium: {
        totalDebt: prioritySummaryData.medium.total_debt,
        count: prioritySummaryData.medium.count,
      },
      Low: {
        totalDebt: prioritySummaryData.low.total_debt,
        count: prioritySummaryData.low.count,
      },
    }
  }, [prioritySummaryData])

  // Calculate total pages from server-side count
  const totalPages = Math.ceil(totalCount / rowsPerPage)

  const handleSort = (key: string, order: 'asc' | 'desc') => {
    setSortConfig({ key, order })
  }

  // Bulk selection handlers
  const handleBulkAssign = () => {
    setShowBulkAssignModal(true)
  }

  const handleBulkAssignSubmit = (assignmentData: {
    employeeId?: string
    searcherId?: string
    distributionMethod: 'assign-all' | 'distribute-evenly'
    reason: string
    notes?: string
  }) => {
    // TODO: Implement bulk assignment API call
    console.log('Bulk assigning clients:', Array.from(selectedClients), assignmentData)
    // Close modal after assignment
    setShowBulkAssignModal(false)
  }

  // Get selected clients data for bulk assign modal
  const selectedClientsData = useMemo(() => {
    if (allClientsSelected) {
      // If all clients are selected, use current page clients as preview
      // The actual count will be totalCount - excludedClients.size
      return filteredClients
        .filter((client) => !excludedClients.has(client.id))
        .map((client) => ({
          id: client.id,
          fullName: client.fullName,
          priority: client.priority,
          score: client.score,
          debt: client.debt,
        }))
    }
    return filteredClients
      .filter((client) => selectedClients.has(client.id))
      .map((client) => ({
        id: client.id,
        fullName: client.fullName,
        priority: client.priority,
        score: client.score,
        debt: client.debt,
      }))
  }, [filteredClients, selectedClients, allClientsSelected, excludedClients])

  // Calculate total selected count for bulk assign modal
  const totalSelectedCount = useMemo(() => {
    if (allClientsSelected) {
      return totalCount - excludedClients.size
    }
    return selectedClients.size
  }, [allClientsSelected, totalCount, excludedClients.size, selectedClients.size])

  // Individual row assign handler
  const handleAssign = (clientId: number) => {
    setAssignModalClientId(clientId)
  }

  const handleAssignSubmit = (assignmentData: {
    employeeId?: string
    searcherId?: string
    reason: string
    notes?: string
  }) => {
    // TODO: Implement assignment API call
    console.log('Assigning client:', assignModalClientId, assignmentData)
    // Close modal after assignment
    setAssignModalClientId(null)
  }

  const handleSelectionChange = (selectedItems: Set<number | string>) => {
    const newSelection = new Set(Array.from(selectedItems).map(Number))

    // If selection is completely empty, clear all selection state
    if (newSelection.size === 0) {
      setSelectedClients(new Set())
      setAllClientsSelected(false)
      setExcludedClients(new Set())
      return
    }

    if (allClientsSelected) {
      // When all items are selected, track which items are excluded (unchecked)
      const currentPageIds = new Set(filteredClients.map((client) => client.id))
      const uncheckedOnCurrentPage = filteredClients
        .filter((client) => !newSelection.has(client.id))
        .map((client) => client.id)

      // Add unchecked items to excluded set
      const newExcluded = new Set(excludedClients)
      uncheckedOnCurrentPage.forEach((id) => newExcluded.add(id))

      // Remove items that are checked again from excluded set
      currentPageIds.forEach((id) => {
        if (newSelection.has(id)) {
          newExcluded.delete(id)
        }
      })

      setExcludedClients(newExcluded)
      setSelectedClients(newSelection)

      // If all items are checked again (no exclusions), clear excluded set
      if (newExcluded.size === 0) {
        setExcludedClients(new Set())
      }
    } else {
      // Normal selection mode
      setSelectedClients(newSelection)
      setExcludedClients(new Set())
    }
  }

  const handleSelectAll = () => {
    // Select all items across all pages
    setAllClientsSelected(true)
    setExcludedClients(new Set()) // Clear any exclusions
    // Also select all items on the current page for visual feedback
    const currentPageIds = new Set(filteredClients.map((client) => client.id))
    setSelectedClients(currentPageIds)
    // Note: We mark all as selected, so the count will show "Selected 14060 of 14060"
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Don't clear selection when page changes - keep selections across pages
  }

  const handleClearAll = () => {
    // Reset filters to initial state
    setFilters({
      // Clear all filter fields
      debtRangeFrom: undefined,
      debtRangeTo: undefined,
      amountOfDebtRangeFrom: undefined,
      amountOfDebtRangeTo: undefined,
      dpdRangeFrom: undefined,
      dpdRangeTo: undefined,
      dateOfSaleFrom: undefined,
      dateOfSaleTo: undefined,
      portfolio: [],
      status: [],
      responsibleEmployee: undefined,
      responsibleSearcher: undefined,
    })

    // Reset to first page
    setCurrentPage(1)

    // Clear search params
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('search')
    newParams.delete('type')
    setSearchParams(newParams)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    })
      .format(amount)
      .replace(/,/g, ' ')
  }

  // Get tag icon based on tag name
  const getTagIcon = (tag: string) => {
    const lowerTag = tag.toLowerCase()
    if (lowerTag.includes('employee')) {
      return <span className="bg-success-500 h-2 w-2 rounded-full" />
    }
    if (lowerTag.includes('creditor') || lowerTag.includes('insolvent')) {
      return <Icons.Warning size={12} className="text-warning-500" strokeWidth={2} />
    }
    return null
  }

  const columns: Column<DisplayClient>[] = [
    {
      key: 'id',
      header: '#',
      align: 'left',
      render: (client) => {
        const index = filteredClients.findIndex((c) => c.id === client.id)
        const rowNumber = (currentPage - 1) * rowsPerPage + index + 1
        return rowNumber
      },
    },
    {
      key: 'fullName',
      header: t('pages.clients.tableHeaders.fullName'),
      align: 'left',
      sortable: true,
      sortKey: 'fullName',
      render: (client) => (
        <button
          onClick={() => navigate(`/dashboard/${client.id}`)}
          className="text-dark-500 cursor-pointer text-left"
        >
          {client.fullName}
        </button>
      ),
    },
    {
      key: 'taxIdNumber',
      header: t('pages.clients.tableHeaders.taxIdNumber'),
      align: 'left',
    },
    {
      key: 'tags',
      header: t('pages.clients.tableHeaders.tags'),
      align: 'left',
      render: (client) => (
        <div className="flex flex-wrap gap-1">
          {client.tags.map((tag, index) => {
            const icon = getTagIcon(tag)
            return (
              <span
                key={index}
                className="text-dark-500 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs"
              >
                {icon}
                {tag}
              </span>
            )
          })}
        </div>
      ),
    },
    {
      key: 'phoneNumber',
      header: t('pages.clients.tableHeaders.phoneNumber'),
      align: 'left',
    },
    {
      key: 'dateOfSale',
      header: t('pages.clients.tableHeaders.dateOfSale'),
      align: 'left',
    },
    {
      key: 'creditor',
      header: t('pages.clients.tableHeaders.creditor'),
      align: 'left',
    },
    {
      key: 'debt',
      header: t('pages.clients.tableHeaders.debt'),
      align: 'right',
      sortable: false, // total_debt computed post-query, not sortable
      render: (client) => `${formatCurrency(client.debt)} ₴`,
    },
    {
      key: 'amountOfDebt',
      header: t('pages.clients.tableHeaders.amountOfDebt'),
      align: 'right',
      sortable: false, // total_debt computed post-query, not sortable
      render: (client) => `${formatCurrency(client.amountOfDebt)} ₴`,
    },
    {
      key: 'priority',
      header: t('pages.clients.tableHeaders.priority'),
      align: 'left',
      sortable: true,
      sortKey: 'priority',
      render: (client) => <PriorityBadge priority={client.priority} variant="compact" />,
    },
    {
      key: 'score',
      header: t('pages.clients.tableHeaders.score'),
      align: 'right',
      sortable: true,
      sortKey: 'score',
    },
    {
      key: 'actions',
      header: t('pages.clients.tableHeaders.actions', 'Actions'),
      align: 'center',
      render: (client) => {
        // Disable assign button when bulk actions are active (items are selected)
        const isBulkActionActive = selectedClients.size > 0 || allClientsSelected
        return (
          <LinkButton
            leftIcon={<Icons.Tick02 size={16} strokeWidth={2} />}
            onClick={() => handleAssign(client.id)}
            variant="regular-black"
            size="xs"
            className="text-xs"
            disabled={isBulkActionActive}
          >
            {t('pages.clients.assign', 'Assign')}
          </LinkButton>
        )
      },
    },
  ]

  // Show initial loading state (only when no data exists yet)
  if (isLoading && apiClients.length === 0) {
    return <ClientManagementPageSkeleton />
  }

  // Show error state
  if (isError && apiClients.length === 0) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4 pt-20">
        <Icons.Warning className="text-error-500 h-8 w-8" strokeWidth={2} />
        <p className="font-medium text-gray-900">Failed to load clients</p>
        <p className="text-sm text-gray-600">{error?.message || 'An error occurred'}</p>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col items-start gap-5 pt-1 pr-7 pb-6 pl-7">
      {/* Priority Overview Cards */}
      <PriorityCards priorityStats={priorityStats} />

      {/* List of Clients Section */}
      <div className="flex items-center justify-between self-stretch">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-dark-500 text-center text-2xl leading-tight font-light tracking-[-0.48px]">
              {t('pages.clients.listOfClients')}
            </span>
            <span className="text-center text-base leading-[155%] font-light tracking-[-0.32px] text-gray-700">
              {totalCount}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-5">
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2.5 transition-colors hover:bg-white/10"
          >
            <Icons.Cancel01
              size={20}
              className="stroke-secondary-800 text-secondary-800"
              strokeWidth={1.5}
            />
            <span className="text-center text-xs leading-[140%] font-medium tracking-[-0.24px] text-gray-700">
              {t('pages.clients.clearAll')}
            </span>
          </button>
          <button
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className="flex flex-col items-start gap-2.5 rounded-lg bg-white px-5 py-3 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Icons.FilterVertical size={20} className="text-gray-700" strokeWidth={1.5} />
              <span className="text-dark-500 text-center text-xs leading-[140%] font-light tracking-[-0.24px]">
                {t('pages.clients.filtersLabel')}{' '}
                <span className="font-medium">
                  ({appliedFiltersCount} {t('pages.clients.applied')})
                </span>
              </span>
              <span className={`transition-transform ${isFiltersOpen ? 'rotate-180' : ''}`}>
                <Icons.ArrowUp size={18} className="text-dark-500" strokeWidth={1.5} />
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      {isFiltersOpen && <ClientFiltersBar filters={filters} onFilterChange={setFilters} />}

      {/* Data Table - Show skeleton when fetching */}
      {isFetching && !isLoading ? (
        <div className="flex flex-col items-start gap-8 self-stretch">
          <TableSkeleton columns={columns.length + 1} rows={rowsPerPage} className="w-full" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredClients}
          sortConfig={sortConfig}
          onSort={handleSort}
          emptyMessage={t('pages.clients.noClientsFound')}
          className="flex flex-col items-start self-stretch"
          enableBulkSelection
          selectedItems={selectedClients}
          onSelectionChange={handleSelectionChange}
          totalCount={totalCount}
          onSelectAll={handleSelectAll}
          allItemsSelected={allClientsSelected}
          excludedItemsCount={excludedClients.size}
          excludedItems={excludedClients}
          headerActions={
            <Button
              onClick={handleBulkAssign}
              variant="primary"
              size="sm"
              className="flex items-center gap-2"
            >
              <Icons.UserCheck01 size={16} strokeWidth={2} />
              {t('pages.clients.bulkAssign', 'Bulk Assign')}
            </Button>
          }
        />
      )}

      {/* Pagination */}
      {!isFetching && (
        <div className="flex flex-col items-center gap-8 self-stretch">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={rowsPerPage}
            pageSizeOptions={[10, 20, 50, 100]}
            onPageChange={handlePageChange}
            onPageSizeChange={setRowsPerPage}
          />
        </div>
      )}

      {/* Assign Client Modal */}
      <AssignClientModal
        open={assignModalClientId !== null}
        clientId={assignModalClientId}
        onClose={() => setAssignModalClientId(null)}
        onAssign={handleAssignSubmit}
      />

      {/* Bulk Assign Client Modal */}
      <BulkAssignClientModal
        open={showBulkAssignModal}
        selectedClientIds={selectedClients}
        selectedClients={selectedClientsData}
        totalSelectedCount={totalSelectedCount}
        onClose={() => setShowBulkAssignModal(false)}
        onAssign={handleBulkAssignSubmit}
      />
    </div>
  )
}

export default ClientManagementPage
