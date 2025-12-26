/**
 * Client Management Page
 *
 * Main page for managing clients with priority overview, filters, and data table.
 */

import { useState, useMemo, useEffect, useRef, startTransition } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column, type SortConfig } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { PriorityCards } from './components/PriorityCards'
import { ClientFiltersBar } from './components/ClientFiltersBar'
import { Icons } from '@/lib/icons'
import type { Client } from './types'
import { useNavigate, useSearchParams } from 'react-router-dom'

// Import shared mock data
import { mockClients } from './mockClients'

// Total clients count (from API or mock)
const TOTAL_CLIENTS_COUNT = 0

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
    portfolio: ['Portfolio A'],
    status: ['Active', 'Defaulted'],
  })
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [sortConfig, setSortConfig] = useState<SortConfig | undefined>()
  const [currentPage, setCurrentPage] = useState(1)
  const prevSearchQueryRef = useRef(searchQuery)

  // Reset to page 1 when search query changes
  useEffect(() => {
    if (searchQuery !== prevSearchQueryRef.current) {
      prevSearchQueryRef.current = searchQuery
      startTransition(() => {
        setCurrentPage(1)
      })
    }
  }, [searchQuery])

  // Count applied filters
  const appliedFiltersCount = useMemo(() => {
    let count = 0
    if (filters.debtRangeFrom || filters.debtRangeTo) count++
    if (filters.amountOfDebtRangeFrom || filters.amountOfDebtRangeTo) count++
    if (filters.dpdRangeFrom || filters.dpdRangeTo) count++
    if (filters.dateOfSaleFrom || filters.dateOfSaleTo) count++
    if (filters.portfolio && filters.portfolio.length > 0) count++
    if (filters.status && filters.status.length > 0) count++
    if (filters.responsibleEmployee) count++
    if (filters.responsibleSearcher) count++
    return count
  }, [filters])

  // Filter and sort clients
  const filteredClients = useMemo(() => {
    let result = [...mockClients]

    // Apply search filter
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

    // Apply other filters (simplified - add actual filtering logic)
    // TODO: Implement actual filtering logic

    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = (a as unknown as Record<string, unknown>)[sortConfig.key]
        const bValue = (b as unknown as Record<string, unknown>)[sortConfig.key]
        if (aValue === bValue) return 0
        const comparison = (aValue as number) > (bValue as number) ? 1 : -1
        return sortConfig.order === 'asc' ? comparison : -comparison
      })
    }

    return result
  }, [searchQuery, searchType, sortConfig])

  // Calculate priority statistics from filtered clients
  const priorityStats = useMemo(() => {
    const stats = {
      Critical: { totalDebt: 0, count: 0 },
      High: { totalDebt: 0, count: 0 },
      Medium: { totalDebt: 0, count: 0 },
      Low: { totalDebt: 0, count: 0 },
    }

    filteredClients.forEach((client) => {
      const priority = client.priority as keyof typeof stats
      if (stats[priority]) {
        stats[priority].totalDebt += client.debt
        stats[priority].count += 1
      }
    })

    return stats
  }, [filteredClients])

  // Paginate clients
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    const end = start + rowsPerPage
    return filteredClients.slice(start, end)
  }, [filteredClients, currentPage, rowsPerPage])

  const totalPages = Math.ceil(filteredClients.length / rowsPerPage)

  const handleSort = (key: string, order: 'asc' | 'desc') => {
    setSortConfig({ key, order })
  }

  const handleClearAll = () => {
    setFilters({
      portfolio: [],
      status: [],
    })
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

  const columns: Column<Client>[] = [
    {
      key: 'id',
      header: '#',
      align: 'left',
      render: (client) => {
        const index = paginatedClients.findIndex((c) => c.id === client.id)
        const rowNumber = (currentPage - 1) * rowsPerPage + index + 1
        return rowNumber
      },
    },
    {
      key: 'fullName',
      header: t('pages.clients.tableHeaders.fullName'),
      align: 'left',
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
      sortable: true,
      sortKey: 'debt',
      render: (client) => `${formatCurrency(client.debt)} ₴`,
    },
    {
      key: 'amountOfDebt',
      header: t('pages.clients.tableHeaders.amountOfDebt'),
      align: 'right',
      sortable: true,
      sortKey: 'amountOfDebt',
      render: (client) => `${formatCurrency(client.amountOfDebt)} ₴`,
    },
    {
      key: 'priority',
      header: t('pages.clients.tableHeaders.priority'),
      align: 'left',
      sortable: true,
      sortKey: 'priority',
      render: (client) => {
        const priorityColors = {
          Critical: 'bg-error-500',
          High: 'bg-warning-500',
          Medium: 'bg-success-500',
          Low: 'bg-gray-500',
        }
        return (
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white ${priorityColors[client.priority as keyof typeof priorityColors] || 'bg-gray-500'}`}
          >
            {t(`pages.clients.priorities.${client.priority.toLowerCase()}`)}
          </span>
        )
      },
    },
    {
      key: 'score',
      header: t('pages.clients.tableHeaders.score'),
      align: 'right',
      sortable: true,
      sortKey: 'score',
    },
  ]

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
              {TOTAL_CLIENTS_COUNT}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-5">
          <button
            onClick={handleClearAll}
            className="flex flex-col items-start gap-2.5 rounded-full bg-white/5 px-4 py-2.5"
          >
            <div className="flex items-center gap-2">
              <Icons.Cancel01
                size={20}
                className="stroke-secondary-800 text-secondary-800"
                strokeWidth={1.5}
              />
              <span className="text-center text-xs leading-[140%] font-medium tracking-[-0.24px] text-gray-700">
                {t('pages.clients.clearAll')}
              </span>
            </div>
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

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={paginatedClients}
        sortConfig={sortConfig}
        onSort={handleSort}
        emptyMessage={t('pages.clients.noClientsFound')}
        className="flex flex-col items-start gap-8 self-stretch"
      />

      {/* Pagination */}
      <div className="flex flex-col items-center gap-8 self-stretch">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={rowsPerPage}
          pageSizeOptions={[10, 20, 50, 100]}
          onPageChange={setCurrentPage}
          onPageSizeChange={setRowsPerPage}
        />
      </div>
    </div>
  )
}

export default ClientManagementPage
