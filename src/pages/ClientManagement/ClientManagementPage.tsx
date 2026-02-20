/**
 * Client Management Page
 *
 * Main page for managing clients with priority overview, filters, and data table.
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column, type SortConfig } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Button } from '@/components/ui/Button'
import { LinkButton } from '@/components/ui/LinkButton'
import { PriorityCards } from './components/PriorityCards'
import { PriorityBadge } from './components/PriorityBadge'
import { TagBadge } from '@/components/ui/TagBadge'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { ClientFiltersBar } from './components/ClientFiltersBar'
import { AssignClientModal } from './components/AssignClientModal'
import { BulkAssignClientModal } from './components/BulkAssignClientModal'
import { TagSelectorModal } from './components/TagSelectorModal'
import { BulkTagModal } from './components/BulkTagModal'
import { ClientManagementPageSkeleton } from './components/ClientManagementPageSkeleton'
import { Icons } from '@/lib/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Link } from 'react-router-dom'
import {
  useAssignClient,
  useBulkAssignClients,
  useClients,
} from '@/features/clients/hooks/useClients'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useSearchStore } from '@/stores/searchStore'
import { usePriorityThresholds } from '@/features/clients/hooks/useConfig'
import { mapScoreToPriority } from '@/features/clients/api/configApi'
import type { Client as APIClient } from '@/features/clients/api/types'
import type { PriorityThresholds } from '@/features/clients/api/configApi'
import { useURLState } from '@/hooks/useURLState'
import type { Priority } from './types'
import { useAuthStore } from '@/stores/authStore'

// Display type matching page requirements
interface DisplayClient {
  id: number
  fullName: string
  taxIdNumber: string
  tags: Array<{ id: number; name: string; color: string }>
  phoneNumber: string
  createdDate: string
  creditor: string
  debt: string
  priority: 'Critical' | 'High' | 'Medium' | 'Low'
  score: number
  employeeName: string
  searcherName: string
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
  thresholds: PriorityThresholds,
  userNameMap: Map<number, string>
): DisplayClient => {
  const fullName = [client.first_name, client.middle_name, client.last_name]
    .filter(Boolean)
    .join(' ')

  return {
    id: client.id,
    fullName,
    taxIdNumber: client.tax_id,
    tags: client.tags || [], // Tags from API
    // Filter placeholder "000000000000" phones from legacy data migration
    phoneNumber: /^0+$/.test(client.phone_primary) ? '-' : client.phone_primary,
    createdDate: client.created_at ? new Date(client.created_at).toLocaleDateString('uk-UA') : '-',
    creditor: client.primary_creditor || '-',
    debt: client.total_debt || '0',
    priority:
      (client.manual_priority as 'Critical' | 'High' | 'Medium' | 'Low') ||
      mapScoreToPriority(client.priority_score, thresholds),
    score: client.priority_score,
    employeeName: client.responsible_employee_id
      ? userNameMap.get(client.responsible_employee_id) || '-'
      : '-',
    searcherName: client.responsible_searcher_id
      ? userNameMap.get(client.responsible_searcher_id) || '-'
      : '-',
  }
}

export interface ClientFilters {
  // Debt Range Filters
  debtRangeFrom?: number // Legacy remaining debt min
  debtRangeTo?: number // Legacy remaining debt max
  amountOfDebtRangeFrom?: number // Total debt min (UI label)
  amountOfDebtRangeTo?: number // Total debt max (UI label)

  // Principal Amount Filter (NEW - maps to principal_min/max)
  principalRangeFrom?: number
  principalRangeTo?: number

  // Total Debt Filter (NEW - maps to total_debt_min/max)
  totalDebtRangeFrom?: number
  totalDebtRangeTo?: number

  // Days Past Due Filter
  dpdRangeFrom?: number
  dpdRangeTo?: number

  // Date Range Filter
  dateOfSaleFrom?: string
  dateOfSaleTo?: string

  // Portfolio/Sellers Filter (now stores IDs only)
  portfolio?: number[]

  // Status Filter
  status?: string[]

  // Assignment Filters
  responsibleEmployee?: string
  responsibleSearcher?: string
  unassignedOnly?: boolean

  // Tags Filter
  tagIds?: number[]

  // Priority Filter
  priorities?: Priority[]
}

export function ClientManagementPage() {
  const { t } = useTranslation('common')
  // Get search state from global store (synced with header search)
  const { searchQuery, searchType, setSearchQuery: clearSearchQuery } = useSearchStore()
  const user = useAuthStore((state) => state.user)

  // URL state for priority filtering
  const [selectedPriorities, setSelectedPriorities] = useURLState<Priority[]>('priority', [])

  // URL state for pagination
  const [currentPage, setCurrentPage] = useURLState<number>('page', 1)
  const [rowsPerPage, setRowsPerPage] = useURLState<number>('pageSize', 10)

  // URL state for sorting (stores frontend column key, converted to backend field in apiParams)
  const [sortBy, setSortBy] = useURLState<string>('sort_by', 'priority')
  const [sortOrder, setSortOrder] = useURLState<'asc' | 'desc'>('sort_order', 'desc')

  // URL state for filters
  const [portfolioFilter, setPortfolioFilter] = useURLState<number[]>('sellers', [])
  const [statusFilter, setStatusFilter] = useURLState<string[]>('status', [])
  const [tagIdsFilter, setTagIdsFilter] = useURLState<number[]>('tags', [])
  const [responsibleEmployeeFilter, setResponsibleEmployeeFilter] = useURLState<string>(
    'employee',
    ''
  )
  const [responsibleSearcherFilter, setResponsibleSearcherFilter] = useURLState<string>(
    'searcher',
    ''
  )
  const [unassignedOnlyFilter, setUnassignedOnlyFilter] = useURLState<boolean>('unassigned', false)
  const [dateOfSaleFromFilter, setDateOfSaleFromFilter] = useURLState<string>('dateFrom', '')
  const [dateOfSaleToFilter, setDateOfSaleToFilter] = useURLState<string>('dateTo', '')
  const [debtRangeFromFilter, setDebtRangeFromFilter] = useURLState<number>('debtMin', 0)
  const [debtRangeToFilter, setDebtRangeToFilter] = useURLState<number>('debtMax', 0)
  const [principalRangeFromFilter, setPrincipalRangeFromFilter] = useURLState<number>(
    'principalMin',
    0
  )
  const [principalRangeToFilter, setPrincipalRangeToFilter] = useURLState<number>('principalMax', 0)
  const [totalDebtRangeFromFilter, setTotalDebtRangeFromFilter] = useURLState<number>(
    'totalDebtMin',
    0
  )
  const [totalDebtRangeToFilter, setTotalDebtRangeToFilter] = useURLState<number>('totalDebtMax', 0)
  const [dpdRangeFromFilter, setDpdRangeFromFilter] = useURLState<number>('dpdMin', 0)
  const [dpdRangeToFilter, setDpdRangeToFilter] = useURLState<number>('dpdMax', 0)

  // Compute filters object from URL state
  const filters: ClientFilters = useMemo(
    () => ({
      portfolio: portfolioFilter,
      status: statusFilter,
      tagIds: tagIdsFilter,
      responsibleEmployee: responsibleEmployeeFilter || undefined,
      responsibleSearcher: responsibleSearcherFilter || undefined,
      unassignedOnly: unassignedOnlyFilter,
      dateOfSaleFrom: dateOfSaleFromFilter || undefined,
      dateOfSaleTo: dateOfSaleToFilter || undefined,
      debtRangeFrom: debtRangeFromFilter || undefined,
      debtRangeTo: debtRangeToFilter || undefined,
      principalRangeFrom: principalRangeFromFilter || undefined,
      principalRangeTo: principalRangeToFilter || undefined,
      totalDebtRangeFrom: totalDebtRangeFromFilter || undefined,
      totalDebtRangeTo: totalDebtRangeToFilter || undefined,
      dpdRangeFrom: dpdRangeFromFilter || undefined,
      dpdRangeTo: dpdRangeToFilter || undefined,
    }),
    [
      portfolioFilter,
      statusFilter,
      tagIdsFilter,
      responsibleEmployeeFilter,
      responsibleSearcherFilter,
      unassignedOnlyFilter,
      dateOfSaleFromFilter,
      dateOfSaleToFilter,
      debtRangeFromFilter,
      debtRangeToFilter,
      principalRangeFromFilter,
      principalRangeToFilter,
      totalDebtRangeFromFilter,
      totalDebtRangeToFilter,
      dpdRangeFromFilter,
      dpdRangeToFilter,
    ]
  )

  // Compute sortConfig from URL state (sortBy already stores the frontend column key)
  const sortConfig: SortConfig | undefined = useMemo(() => {
    if (!sortBy) return undefined
    return { key: sortBy, order: sortOrder }
  }, [sortBy, sortOrder])

  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [selectedClients, setSelectedClients] = useState<Set<number>>(new Set())
  const [allClientsSelected, setAllClientsSelected] = useState(false)
  const [excludedClients, setExcludedClients] = useState<Set<number>>(new Set())
  const [assignModalClientId, setAssignModalClientId] = useState<number | null>(null)
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false)
  const [showBulkTagModal, setShowBulkTagModal] = useState(false)
  const [bulkTagAction, setBulkTagAction] = useState<'add' | 'remove'>('add')
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [selectedClientForTags, setSelectedClientForTags] = useState<{
    id: number
    name: string
  } | null>(null)
  const [openDropdownClientId, setOpenDropdownClientId] = useState<number | null>(null)
  const hasSetDefaultFilter = useRef(false)
  // User-specific storage key to prevent filter leakage between users
  const STORAGE_KEY = user?.id ? `client-filters-state-${user.id}` : null

  // Save filters to localStorage whenever they change (for persistence when sidebar navigation clears URL)
  useEffect(() => {
    const filterState = {
      selectedPriorities,
      currentPage,
      rowsPerPage,
      sortBy,
      sortOrder,
      portfolioFilter,
      statusFilter,
      tagIdsFilter,
      responsibleEmployeeFilter,
      responsibleSearcherFilter,
      unassignedOnlyFilter,
      dateOfSaleFromFilter,
      dateOfSaleToFilter,
      debtRangeFromFilter,
      debtRangeToFilter,
      principalRangeFromFilter,
      principalRangeToFilter,
      totalDebtRangeFromFilter,
      totalDebtRangeToFilter,
      dpdRangeFromFilter,
      dpdRangeToFilter,
      searchQuery,
      searchType,
    }

    // Only save if there are active filters (don't save empty state)
    const hasActiveFilters =
      selectedPriorities.length > 0 ||
      searchQuery !== '' ||
      responsibleEmployeeFilter !== '' ||
      responsibleSearcherFilter !== '' ||
      portfolioFilter.length > 0 ||
      statusFilter.length > 0 ||
      tagIdsFilter.length > 0 ||
      unassignedOnlyFilter ||
      dateOfSaleFromFilter !== '' ||
      dateOfSaleToFilter !== '' ||
      debtRangeFromFilter > 0 ||
      debtRangeToFilter > 0 ||
      principalRangeFromFilter > 0 ||
      principalRangeToFilter > 0 ||
      totalDebtRangeFromFilter > 0 ||
      totalDebtRangeToFilter > 0 ||
      dpdRangeFromFilter > 0 ||
      dpdRangeToFilter > 0

    if (hasActiveFilters && STORAGE_KEY) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filterState))
      } catch (e) {
        console.error('Failed to save filters to localStorage:', e)
      }
    }
  }, [
    STORAGE_KEY,
    selectedPriorities,
    currentPage,
    rowsPerPage,
    sortBy,
    sortOrder,
    portfolioFilter,
    statusFilter,
    tagIdsFilter,
    responsibleEmployeeFilter,
    responsibleSearcherFilter,
    unassignedOnlyFilter,
    dateOfSaleFromFilter,
    dateOfSaleToFilter,
    debtRangeFromFilter,
    debtRangeToFilter,
    principalRangeFromFilter,
    principalRangeToFilter,
    totalDebtRangeFromFilter,
    totalDebtRangeToFilter,
    dpdRangeFromFilter,
    dpdRangeToFilter,
    searchQuery,
    searchType,
  ])

  // Set default "assigned to me" filter on initial load OR restore from localStorage
  useEffect(() => {
    if (hasSetDefaultFilter.current || !user?.id) return

    // Check if URL has any filters
    const hasURLFilters =
      selectedPriorities.length > 0 ||
      searchQuery !== '' ||
      responsibleEmployeeFilter !== '' ||
      portfolioFilter.length > 0 ||
      statusFilter.length > 0 ||
      tagIdsFilter.length > 0 ||
      unassignedOnlyFilter ||
      dateOfSaleFromFilter !== '' ||
      debtRangeFromFilter > 0 ||
      principalRangeFromFilter > 0

    if (!hasURLFilters && STORAGE_KEY) {
      // Try to restore from localStorage first
      try {
        const savedState = localStorage.getItem(STORAGE_KEY)
        if (savedState) {
          const parsed = JSON.parse(savedState)
          // Restore filters (use setTimeout to avoid state updates during render)
          setTimeout(() => {
            if (parsed.selectedPriorities) setSelectedPriorities(parsed.selectedPriorities)
            if (parsed.portfolioFilter) setPortfolioFilter(parsed.portfolioFilter)
            if (parsed.statusFilter) setStatusFilter(parsed.statusFilter)
            if (parsed.tagIdsFilter) setTagIdsFilter(parsed.tagIdsFilter)
            if (parsed.responsibleEmployeeFilter)
              setResponsibleEmployeeFilter(parsed.responsibleEmployeeFilter)
            if (parsed.responsibleSearcherFilter)
              setResponsibleSearcherFilter(parsed.responsibleSearcherFilter)
            if (parsed.unassignedOnlyFilter) setUnassignedOnlyFilter(parsed.unassignedOnlyFilter)
            if (parsed.dateOfSaleFromFilter) setDateOfSaleFromFilter(parsed.dateOfSaleFromFilter)
            if (parsed.dateOfSaleToFilter) setDateOfSaleToFilter(parsed.dateOfSaleToFilter)
            if (parsed.debtRangeFromFilter) setDebtRangeFromFilter(parsed.debtRangeFromFilter)
            if (parsed.debtRangeToFilter) setDebtRangeToFilter(parsed.debtRangeToFilter)
            if (parsed.principalRangeFromFilter)
              setPrincipalRangeFromFilter(parsed.principalRangeFromFilter)
            if (parsed.principalRangeToFilter)
              setPrincipalRangeToFilter(parsed.principalRangeToFilter)
            if (parsed.totalDebtRangeFromFilter)
              setTotalDebtRangeFromFilter(parsed.totalDebtRangeFromFilter)
            if (parsed.totalDebtRangeToFilter)
              setTotalDebtRangeToFilter(parsed.totalDebtRangeToFilter)
            if (parsed.dpdRangeFromFilter) setDpdRangeFromFilter(parsed.dpdRangeFromFilter)
            if (parsed.dpdRangeToFilter) setDpdRangeToFilter(parsed.dpdRangeToFilter)
            if (parsed.currentPage) setCurrentPage(parsed.currentPage)
            if (parsed.rowsPerPage) setRowsPerPage(parsed.rowsPerPage)
            if (parsed.sortBy) setSortBy(parsed.sortBy)
            if (parsed.sortOrder) setSortOrder(parsed.sortOrder)
            // Note: search query and type are managed separately via setSearchParams
          }, 0)
        } else {
          // No saved state, apply default "assigned to me" filter
          setResponsibleEmployeeFilter(user.id)
        }
      } catch (e) {
        console.error('Failed to restore filters from localStorage:', e)
        // Fallback to default filter
        setResponsibleEmployeeFilter(user.id)
      }
    }

    hasSetDefaultFilter.current = true
    // Only run once when user is available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Close dropdown when screen size crosses breakpoint (in either direction)
  useEffect(() => {
    let wasMobile = window.innerWidth < 1024 // lg breakpoint

    const handleResize = () => {
      const isMobile = window.innerWidth < 1024

      // Close dropdown if transitioning across breakpoint (mobile <-> desktop)
      if (wasMobile !== isMobile && openDropdownClientId !== null) {
        setOpenDropdownClientId(null)
      }

      wasMobile = isMobile
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [openDropdownClientId])

  // NO need to debounce filters - useURLState already does this with 300ms debounce
  // const filters = useDebounce(filters, 500)

  // Toggle handler for priority card clicks
  const handlePriorityToggle = (priority: Priority) => {
    setSelectedPriorities((prev) => {
      const newValue = prev.includes(priority)
        ? prev.filter((p) => p !== priority)
        : [...prev, priority]
      return newValue
    })
  }

  // Convert frontend filters to API parameters
  const apiParams = useMemo(() => {
    // Map frontend column keys to backend sort fields
    const frontendToBackendSort: Record<string, string> = {
      priority: 'priority_score',
      score: 'priority_score',
      fullName: 'first_name',
      id: 'id',
      createdDate: 'created_at',
      taxIdNumber: 'tax_id',
      phoneNumber: 'phone_primary',
      employeeName: 'responsible_employee_id',
      searcherName: 'responsible_searcher_id',
      creditor: 'primary_creditor',
      debt: 'total_debt',
    }

    const params: Record<string, unknown> = {
      // Server-side pagination
      skip: (currentPage - 1) * rowsPerPage,
      limit: rowsPerPage,
      // Sorting (convert frontend key to backend field)
      sort_by: frontendToBackendSort[sortBy] || 'priority_score',
      sort_order: sortOrder,
    }

    // FILTER 1: Portfolio/Sellers (now using IDs directly)
    if (filters.portfolio && filters.portfolio.length > 0) {
      params.seller_ids = filters.portfolio.join(',')
    }

    // FILTER 2: Sale Date Range (FIXED - correct parameter names)
    if (filters.dateOfSaleFrom) {
      params.sale_date_from = filters.dateOfSaleFrom
    }
    if (filters.dateOfSaleTo) {
      params.sale_date_to = filters.dateOfSaleTo
    }

    // FILTER 3: Assignment - Employee
    if (filters.responsibleEmployee) {
      params.responsible_employee_id = parseInt(filters.responsibleEmployee)
    }

    // FILTER 4: Assignment - Searcher
    if (filters.responsibleSearcher) {
      params.responsible_searcher_id = parseInt(filters.responsibleSearcher)
    }

    // FILTER 5: Assignment - Unassigned Only
    if (filters.unassignedOnly) {
      params.unassigned_only = true
    }

    // FILTER 6: Principal Amount
    if (filters.principalRangeFrom !== undefined) {
      params.principal_min = filters.principalRangeFrom
    }
    if (filters.principalRangeTo !== undefined) {
      params.principal_max = filters.principalRangeTo
    }

    // FILTER 7: Total Debt Amount
    if (filters.totalDebtRangeFrom !== undefined) {
      params.total_debt_min = filters.totalDebtRangeFrom
    }
    if (filters.totalDebtRangeTo !== undefined) {
      params.total_debt_max = filters.totalDebtRangeTo
    }

    // FILTER 8: Days Past Due
    if (filters.dpdRangeFrom !== undefined) {
      params.dpd_min = filters.dpdRangeFrom
    }
    if (filters.dpdRangeTo !== undefined) {
      params.dpd_max = filters.dpdRangeTo
    }

    // Existing filters (already working)
    if (filters.debtRangeFrom !== undefined) {
      params.debt_min = filters.debtRangeFrom
    }
    if (filters.debtRangeTo !== undefined) {
      params.debt_max = filters.debtRangeTo
    }

    if (filters.status && filters.status.length > 0) {
      params.status = filters.status.join(',')
    }

    // FILTER 9: Tags
    if (filters.tagIds && filters.tagIds.length > 0) {
      params.tag_ids = filters.tagIds.join(',')
    }

    // FILTER 10: Priority
    if (selectedPriorities.length > 0) {
      // Map priority labels to lowercase for API
      const priorityValues = selectedPriorities.map((p) => p.toLowerCase()).join(',')
      params.priorities = priorityValues
    }

    // FILTER 11: Search (from global header search)
    if (searchQuery.trim()) {
      params.q = searchQuery.trim()
      params.search_type = searchType
    }

    return params
  }, [
    filters,
    currentPage,
    rowsPerPage,
    sortBy,
    sortOrder,
    selectedPriorities,
    searchQuery,
    searchType,
  ])

  // Fetch clients from API
  const { data: clientsResponse, isLoading, isFetching, isError, error } = useClients(apiParams)

  // Extract paginated data from response
  const apiClients = useMemo(() => clientsResponse?.items || [], [clientsResponse?.items])
  const totalCount = clientsResponse?.total || 0
  const totalPages = clientsResponse?.total_pages || 1
  const prioritySummaryData = clientsResponse?.priority_summary

  // Fetch priority thresholds configuration
  const { data: thresholds = DEFAULT_THRESHOLDS } = usePriorityThresholds()

  // Fetch active users for resolving employee/searcher IDs to names
  const { data: usersResponse } = useUsers({ status: 'active', page_size: 100 })
  const userNameMap = useMemo(() => {
    const map = new Map<number, string>()
    if (usersResponse?.users) {
      for (const user of usersResponse.users) {
        map.set(
          user.id,
          [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ')
        )
      }
    }
    return map
  }, [usersResponse])

  // Assignment mutations
  const assignClientMutation = useAssignClient()
  const bulkAssignClientsMutation = useBulkAssignClients()

  // Map API clients to display format
  const displayClients = useMemo(() => {
    return apiClients.map((client) => mapAPIClientToDisplay(client, thresholds, userNameMap))
  }, [apiClients, thresholds, userNameMap])

  // Count applied filters
  const appliedFiltersCount = useMemo(() => {
    let count = 0
    if (filters.debtRangeFrom || filters.debtRangeTo) count++
    // Note: amountOfDebtRange is same as debtRange (both filter on total_debt)
    // Not counting amountOfDebtRange separately to avoid double-counting
    // DPD Range not yet implemented (days past due not calculated)
    // if (filters.dpdRangeFrom || filters.dpdRangeTo) count++
    if (filters.dateOfSaleFrom || filters.dateOfSaleTo) count++
    if (filters.portfolio && filters.portfolio.length > 0) count++
    if (filters.tagIds && filters.tagIds.length > 0) count++
    if (filters.status && filters.status.length > 0) count++
    if (filters.responsibleEmployee) count++
    if (filters.responsibleSearcher) count++
    if (filters.unassignedOnly) count++
    if (selectedPriorities.length > 0) count++
    return count
  }, [filters, selectedPriorities])

  // All filtering (including search) is now handled server-side
  const filteredClients = displayClients

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

  const handleSort = (key: string, order: 'asc' | 'desc') => {
    setSortBy(key)
    setSortOrder(order)
    // Reset to page 1 when sort changes
    setCurrentPage(1)
  }

  // Bulk selection handlers
  const handleBulkAssign = () => {
    setShowBulkAssignModal(true)
  }

  const handleBulkAddTags = () => {
    setBulkTagAction('add')
    setShowBulkTagModal(true)
  }

  const handleBulkRemoveTags = () => {
    setBulkTagAction('remove')
    setShowBulkTagModal(true)
  }

  const handleBulkAssignSubmit = (assignmentData: {
    employeeId?: string
    searcherId?: string
    distributionMethod: 'assign-all' | 'distribute-evenly'
    reason: string
    notes?: string
  }) => {
    // Collect client IDs to assign
    let clientIds: number[]

    if (allClientsSelected) {
      // All selected minus excluded - get from current page data
      clientIds = apiClients
        .filter((client) => !excludedClients.has(client.id))
        .map((client) => client.id)
    } else {
      // Just the explicitly selected clients
      clientIds = Array.from(selectedClients).map(Number)
    }

    if (clientIds.length === 0) return

    bulkAssignClientsMutation.mutate(
      {
        client_ids: clientIds,
        responsible_employee_id: assignmentData.employeeId
          ? parseInt(assignmentData.employeeId)
          : undefined,
        responsible_searcher_id: assignmentData.searcherId
          ? parseInt(assignmentData.searcherId)
          : undefined,
        assignment_reason: assignmentData.reason,
      },
      {
        onSuccess: () => {
          // Close modal and clear selection after successful assignment
          setShowBulkAssignModal(false)
          setSelectedClients(new Set())
          setAllClientsSelected(false)
          setExcludedClients(new Set())
        },
      }
    )
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

  // Tag management handler
  const handleManageTags = (clientId: number, clientName: string) => {
    setSelectedClientForTags({ id: clientId, name: clientName })
    setTagModalOpen(true)
  }

  const handleAssignSubmit = (assignmentData: {
    employeeId?: string
    searcherId?: string
    reason: string
    notes?: string
  }) => {
    if (!assignModalClientId) return

    assignClientMutation.mutate(
      {
        clientId: assignModalClientId,
        data: {
          responsible_employee_id: assignmentData.employeeId
            ? parseInt(assignmentData.employeeId)
            : undefined,
          responsible_searcher_id: assignmentData.searcherId
            ? parseInt(assignmentData.searcherId)
            : undefined,
          assignment_reason: assignmentData.reason,
        },
      },
      {
        onSuccess: () => {
          // Close modal after successful assignment
          setAssignModalClientId(null)
        },
      }
    )
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

  // Handler to update filters from ClientFiltersBar
  // Uses functional updates for array filters to avoid stale closure issues
  const handleFilterChange = (
    newFilters: ClientFilters & { _action?: string; _value?: string | number; _checked?: boolean }
  ) => {
    // Handle toggle actions with functional updates to avoid stale state
    if (newFilters._action === 'togglePortfolio') {
      const sellerId = newFilters._value as number
      const checked = newFilters._checked as boolean
      setPortfolioFilter((prev) =>
        checked ? [...prev, sellerId] : prev.filter((id) => id !== sellerId)
      )
      setCurrentPage(1)
      return
    }

    if (newFilters._action === 'toggleStatus') {
      const status = newFilters._value as string
      const checked = newFilters._checked as boolean
      setStatusFilter((prev) => (checked ? [...prev, status] : prev.filter((s) => s !== status)))
      setCurrentPage(1)
      return
    }

    if (newFilters._action === 'toggleTag') {
      const tagId = newFilters._value as number
      const checked = newFilters._checked as boolean
      setTagIdsFilter((prev) => (checked ? [...prev, tagId] : prev.filter((id) => id !== tagId)))
      setCurrentPage(1)
      return
    }

    // Handle regular filter updates (non-toggle actions)
    // Only update if value has actually changed (use JSON.stringify for deep comparison)
    if (JSON.stringify(newFilters.portfolio) !== JSON.stringify(portfolioFilter)) {
      setPortfolioFilter(newFilters.portfolio || [])
    }
    if (JSON.stringify(newFilters.status) !== JSON.stringify(statusFilter)) {
      setStatusFilter(newFilters.status || [])
    }
    if (JSON.stringify(newFilters.tagIds) !== JSON.stringify(tagIdsFilter)) {
      setTagIdsFilter(newFilters.tagIds || [])
    }
    if (newFilters.responsibleEmployee !== responsibleEmployeeFilter) {
      setResponsibleEmployeeFilter(newFilters.responsibleEmployee || '')
    }
    if (newFilters.responsibleSearcher !== responsibleSearcherFilter) {
      setResponsibleSearcherFilter(newFilters.responsibleSearcher || '')
    }
    if (newFilters.unassignedOnly !== unassignedOnlyFilter) {
      setUnassignedOnlyFilter(newFilters.unassignedOnly || false)
    }
    if (newFilters.dateOfSaleFrom !== dateOfSaleFromFilter) {
      setDateOfSaleFromFilter(newFilters.dateOfSaleFrom || '')
    }
    if (newFilters.dateOfSaleTo !== dateOfSaleToFilter) {
      setDateOfSaleToFilter(newFilters.dateOfSaleTo || '')
    }
    if (newFilters.debtRangeFrom !== debtRangeFromFilter) {
      setDebtRangeFromFilter(newFilters.debtRangeFrom || 0)
    }
    if (newFilters.debtRangeTo !== debtRangeToFilter) {
      setDebtRangeToFilter(newFilters.debtRangeTo || 0)
    }
    if (newFilters.principalRangeFrom !== principalRangeFromFilter) {
      setPrincipalRangeFromFilter(newFilters.principalRangeFrom || 0)
    }
    if (newFilters.principalRangeTo !== principalRangeToFilter) {
      setPrincipalRangeToFilter(newFilters.principalRangeTo || 0)
    }
    if (newFilters.totalDebtRangeFrom !== totalDebtRangeFromFilter) {
      setTotalDebtRangeFromFilter(newFilters.totalDebtRangeFrom || 0)
    }
    if (newFilters.totalDebtRangeTo !== totalDebtRangeToFilter) {
      setTotalDebtRangeToFilter(newFilters.totalDebtRangeTo || 0)
    }
    if (newFilters.dpdRangeFrom !== dpdRangeFromFilter) {
      setDpdRangeFromFilter(newFilters.dpdRangeFrom || 0)
    }
    if (newFilters.dpdRangeTo !== dpdRangeToFilter) {
      setDpdRangeToFilter(newFilters.dpdRangeTo || 0)
    }

    // Reset to page 1 when filters change
    setCurrentPage(1)
  }

  const handleClearAll = () => {
    // Clear all URL state filters (useURLState will handle URL updates after debounce)
    setSelectedPriorities([])
    setPortfolioFilter([])
    setStatusFilter([])
    setTagIdsFilter([])
    setResponsibleEmployeeFilter('')
    setResponsibleSearcherFilter('')
    setUnassignedOnlyFilter(false)
    setDateOfSaleFromFilter('')
    setDateOfSaleToFilter('')
    setDebtRangeFromFilter(0)
    setDebtRangeToFilter(0)
    setPrincipalRangeFromFilter(0)
    setPrincipalRangeToFilter(0)
    setTotalDebtRangeFromFilter(0)
    setTotalDebtRangeToFilter(0)
    setDpdRangeFromFilter(0)
    setDpdRangeToFilter(0)

    // Reset to first page
    setCurrentPage(1)

    // Reset sorting to defaults
    setSortBy('priority')
    setSortOrder('desc')

    // Clear search query from global store
    clearSearchQuery('')

    // Clear localStorage saved state
    if (STORAGE_KEY) {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch (e) {
        console.error('Failed to clear localStorage:', e)
      }
    }
  }

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return '0'
    return new Intl.NumberFormat('uk-UA', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    })
      .format(num)
      .replace(/,/g, ' ')
  }

  // Get tag icon based on tag name

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
        <Link
          to={`/dashboard/clients/${client.id}`}
          className="text-dark-500 cursor-pointer text-left hover:underline"
        >
          {client.fullName}
        </Link>
      ),
    },
    {
      key: 'taxIdNumber',
      header: t('pages.clients.tableHeaders.taxIdNumber'),
      align: 'left',
      sortable: true,
      sortKey: 'taxIdNumber',
    },
    {
      key: 'tags',
      header: t('pages.clients.tableHeaders.tags'),
      align: 'left',
      render: (client) => (
        <div className="flex flex-wrap gap-1">
          {client.tags && client.tags.length > 0 ? (
            client.tags.map((tag) => (
              <TagBadge key={tag.id} name={tag.name} color={tag.color} size="sm" />
            ))
          ) : (
            <span className="text-xs text-gray-400">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'phoneNumber',
      header: t('pages.clients.tableHeaders.phoneNumber'),
      align: 'left',
      sortable: true,
      sortKey: 'phoneNumber',
      render: (client) => client.phoneNumber,
    },
    {
      key: 'creditor',
      header: t('pages.clients.tableHeaders.creditor'),
      align: 'left',
      sortable: true,
      sortKey: 'creditor',
    },
    {
      key: 'debt',
      header: t('pages.clients.tableHeaders.totalDebt'),
      align: 'right',
      sortable: true,
      sortKey: 'debt',
      render: (client) => `${formatCurrency(client.debt)} ₴`,
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
      key: 'createdDate',
      header: t('pages.clients.tableHeaders.createdDate'),
      align: 'left',
      sortable: true,
      sortKey: 'createdDate',
    },
    {
      key: 'employeeName',
      header: t('pages.clients.tableHeaders.employee'),
      align: 'left',
    },
    {
      key: 'searcherName',
      header: t('pages.clients.tableHeaders.searcher'),
      align: 'left',
    },
    {
      key: 'actions',
      header: t('pages.clients.tableHeaders.actions'),
      align: 'center',
      render: (client) => {
        // Disable assign button when bulk actions are active (items are selected)
        const isBulkActionActive = selectedClients.size > 0 || allClientsSelected
        return (
          <div
            className="flex items-center justify-center gap-2 sm:gap-4"
            data-testid={`client-actions-${client.id}`}
          >
            {/* Desktop: Individual buttons */}
            <div className="hidden items-center gap-4 lg:flex">
              <LinkButton
                variant="regular-black"
                size="xs"
                onClick={() => handleAssign(client.id)}
                leftIcon={<Icons.PencilEdit size={16} color="#05040D" strokeWidth={1.5} />}
                disabled={isBulkActionActive}
              >
                {t('pages.clients.assign')}
              </LinkButton>
              <LinkButton
                variant="regular-black"
                size="xs"
                onClick={() => handleManageTags(client.id, client.fullName)}
                leftIcon={<Icons.File size={16} color="#05040D" strokeWidth={1.5} />}
                disabled={isBulkActionActive}
                data-testid={`tag-button-${client.id}`}
              >
                {t('pages.clients.manageTags')}
              </LinkButton>
            </div>

            {/* Mobile/Tablet: Dropdown button group */}
            <div className="lg:hidden">
              <DropdownMenu
                modal={false}
                open={openDropdownClientId === client.id}
                onOpenChange={(open) => setOpenDropdownClientId(open ? client.id : null)}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-dark-500 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-gray-300 bg-white transition-colors hover:bg-gray-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={t('pages.clients.tableHeaders.actions')}
                    disabled={isBulkActionActive}
                  >
                    <Icons.FilterVertical size={16} strokeWidth={1.5} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white">
                  <DropdownMenuItem
                    onClick={() => handleAssign(client.id)}
                    className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                    disabled={isBulkActionActive}
                  >
                    <Icons.PencilEdit size={16} strokeWidth={1.5} />
                    <span>{t('pages.clients.assign')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleManageTags(client.id, client.fullName)}
                    className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                    disabled={isBulkActionActive}
                    data-testid={`tag-button-${client.id}`}
                  >
                    <Icons.File size={16} strokeWidth={1.5} />
                    <span>{t('pages.clients.manageTags')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
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
        <p className="font-medium text-gray-900">{t('pages.clients.errorLoading')}</p>
        <p className="text-sm text-gray-600">
          {error?.message || t('pages.clients.errorOccurred')}
        </p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex w-full flex-col items-start gap-3 px-2 sm:gap-4 sm:px-0">
        {/* Priority Overview Cards */}
        <PriorityCards
          priorityStats={priorityStats}
          selected={selectedPriorities}
          onToggle={handlePriorityToggle}
        />

        {/* List of Clients Section */}
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex flex-row items-center gap-2">
              <span className="text-dark-500 text-center text-xl leading-tight font-light tracking-[-0.4px] sm:text-2xl sm:tracking-[-0.48px]">
                {t('pages.clients.listOfClients')}
              </span>
              <span className="text-center text-sm leading-[155%] font-light tracking-[-0.28px] text-gray-700 sm:text-base sm:tracking-[-0.32px]">
                {totalCount}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-5">
            {appliedFiltersCount > 0 && (
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
            )}
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
        {isFiltersOpen && (
          <ClientFiltersBar filters={filters} onFilterChange={handleFilterChange} />
        )}

        {/* Data Table - Show skeleton when fetching */}
        {isFetching && !isLoading ? (
          <div className="flex w-full flex-col items-start gap-4 self-stretch sm:gap-8">
            <TableSkeleton columns={columns.length + 1} rows={rowsPerPage} className="w-full" />
          </div>
        ) : (
          <div className="mx-0 w-full overflow-x-auto px-0">
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="primary"
                      size="sm"
                      className="h-9 gap-1.5 rounded-lg px-3 text-xs sm:h-10 sm:gap-2 sm:px-4 sm:text-sm"
                    >
                      <Icons.Settings
                        size={16}
                        className="text-dark-500 sm:h-[18px] sm:w-[18px]"
                        strokeWidth={1.5}
                      />
                      <span className="hidden font-medium sm:inline">Bulk Actions</span>
                      <span className="font-medium sm:hidden">Actions</span>
                      <Icons.ArrowDown
                        size={14}
                        className="text-dark-500 sm:h-4 sm:w-4"
                        strokeWidth={1.5}
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56 rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
                  >
                    <DropdownMenuItem
                      onClick={handleBulkAssign}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-gray-50 focus:bg-gray-50"
                    >
                      <Icons.UserCheck01 size={18} className="text-dark-500" strokeWidth={1.5} />
                      <span className="text-dark-500 text-sm font-medium">
                        {t('pages.clients.bulkActions.assignEmployee', 'Assign Employee')}
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleBulkAddTags}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-gray-50 focus:bg-gray-50"
                    >
                      <Icons.PlusSignCircle size={18} className="text-dark-500" strokeWidth={1.5} />
                      <span className="text-dark-500 text-sm font-medium">
                        {t('pages.clients.bulkActions.addTags', 'Add Tags')}
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleBulkRemoveTags}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-gray-50 focus:bg-gray-50"
                    >
                      <Icons.Remove02 size={18} className="text-dark-500" strokeWidth={1.5} />
                      <span className="text-dark-500 text-sm font-medium">
                        {t('pages.clients.bulkActions.removeTags', 'Remove Tags')}
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
            />
          </div>
        )}

        {/* Pagination */}
        {!isFetching && (
          <div className="flex w-full flex-col items-center gap-4 self-stretch sm:gap-8">
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

        {/* Tag Selector Modal */}
        {selectedClientForTags && (
          <TagSelectorModal
            open={tagModalOpen}
            clientId={selectedClientForTags.id}
            clientName={selectedClientForTags.name}
            projectId={1}
            onClose={() => {
              setTagModalOpen(false)
              setSelectedClientForTags(null)
            }}
          />
        )}

        {/* Bulk Tag Modal */}
        <BulkTagModal
          open={showBulkTagModal}
          clientIds={
            allClientsSelected
              ? apiClients
                  .filter((client) => !excludedClients.has(client.id))
                  .map((client) => client.id)
              : Array.from(selectedClients).map(Number)
          }
          clientCount={totalSelectedCount}
          action={bulkTagAction}
          onClose={() => setShowBulkTagModal(false)}
        />
      </div>
    </TooltipProvider>
  )
}

export default ClientManagementPage
