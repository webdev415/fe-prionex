/**
 * AuditLogsPage Component
 *
 * Main page for viewing audit logs with search and filtering capabilities.
 */

import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useURLState } from '@/hooks/useURLState'
import { SearchFiltersBar } from './components/SearchFiltersBar'
import { AuditLogDetailModal } from './components/AuditLogDetailModal'
import { CSVExportDialog, type CSVExportOptions } from './components/CSVExportDialog'
import { DataTable, type Column, type SortConfig, type SortOrder } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { LinkButton } from '@/components/ui/LinkButton'
import { cn } from '@/lib/utils'

const DEFAULT_PAGE_SIZE = 10

export interface AuditLogChange {
  field_name: string
  old_value: string | null
  new_value: string | null
  change_type?: 'Added' | 'Modified' | 'Removed'
  calculated_change?: string // e.g., "-5,000.00 UAH"
}

export interface AuditLog {
  id: number
  timestamp: string
  status: 'success' | 'failed' // Status for the audit log entry
  user_id?: number
  username: string
  role?: string
  action: string // UPDATE, CREATE, LOGIN_FAILED, etc.
  entity_type?: string // user, client, sms_template, etc.
  entity_id?: string
  entity_name?: string // Display name for the entity (e.g., "Олена Коваленко")
  field_name?: string
  old_value?: string
  new_value?: string
  reason?: string
  ip_address?: string
  session_id?: string
  login_attempts?: number // For failed login attempts
  project_id?: number
  // For detail modal - changes array
  changes?: AuditLogChange[]
  // Request information
  http_method?: string // PUT, POST, GET, etc.
  api_path?: string // /api/clients/5678
  response_status?: string // 200 OK
  response_time?: number // 245 (ms)
  user_agent?: string // Chrome 120.0 (Windows 10)
}

export interface AuditLogFilters {
  search?: string
  status?: string
  client?: string
  period?: string
  date_from?: string
  date_to?: string
  user?: string // For backward compatibility, but can be comma-separated
  users?: string[] // Array of selected usernames
  entity_type?: string
  action?: string
  role?: string
}

export function AuditLogsPage() {
  const { t } = useTranslation('common')

  // Calculate initial date range from mock data dates
  // Dates in mock data: 2025-11-17 to 2025-11-18
  const initialDateRange = useMemo(() => {
    const mockTimestamps = [
      new Date('2025-11-18T10:30:45'),
      new Date('2025-11-18T09:15:22'),
      new Date('2025-11-18T08:45:10'),
      new Date('2025-11-18T07:20:33'),
      new Date('2025-11-17T16:55:12'),
    ]
    const dates = mockTimestamps.map((d) => d.getTime())
    const minDate = new Date(Math.min(...dates))
    const maxDate = new Date(Math.max(...dates))
    return {
      date_from: minDate.toISOString().slice(0, 10),
      date_to: maxDate.toISOString().slice(0, 10),
    }
  }, [])

  // URL state for pagination
  const [currentPage, setCurrentPage] = useURLState<number>('page', 1)
  const [pageSize, setPageSize] = useURLState<number>('pageSize', DEFAULT_PAGE_SIZE)

  // URL state for sorting
  const [sortBy, setSortBy] = useURLState<string>('sort_by', 'timestamp')
  const [sortOrder, setSortOrder] = useURLState<'asc' | 'desc'>('sort_order', 'desc')

  // URL state for all filter fields
  const [searchFilter, setSearchFilter] = useURLState<string>('search', '')
  const [statusFilter, setStatusFilter] = useURLState<string>('status', '')
  const [clientFilter, setClientFilter] = useURLState<string>('client', '')
  const [periodFilter, setPeriodFilter] = useURLState<string>('period', '')
  const [dateFromFilter, setDateFromFilter] = useURLState<string>(
    'date_from',
    initialDateRange.date_from
  )
  const [dateToFilter, setDateToFilter] = useURLState<string>('date_to', initialDateRange.date_to)
  const [userFilter, setUserFilter] = useURLState<string>('user', '')
  const [usersFilter, setUsersFilter] = useURLState<string[]>('users', [])
  const [entityTypeFilter, setEntityTypeFilter] = useURLState<string>('entity_type', '')
  const [actionFilter, setActionFilter] = useURLState<string>('action', '')
  const [roleFilter, setRoleFilter] = useURLState<string>('role', '')

  // Reconstruct filters object from URL state
  const filters = useMemo<AuditLogFilters>(
    () => ({
      search: searchFilter || undefined,
      status: statusFilter || undefined,
      client: clientFilter || undefined,
      period: periodFilter || undefined,
      date_from: dateFromFilter || undefined,
      date_to: dateToFilter || undefined,
      user: userFilter || undefined,
      users: usersFilter.length > 0 ? usersFilter : undefined,
      entity_type: entityTypeFilter || undefined,
      action: actionFilter || undefined,
      role: roleFilter || undefined,
    }),
    [
      searchFilter,
      statusFilter,
      clientFilter,
      periodFilter,
      dateFromFilter,
      dateToFilter,
      userFilter,
      usersFilter,
      entityTypeFilter,
      actionFilter,
      roleFilter,
    ]
  )

  // Reconstruct sortConfig from URL state
  const sortConfig = useMemo<SortConfig>(
    () => ({
      key: sortBy,
      order: sortOrder,
    }),
    [sortBy, sortOrder]
  )

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)

  // Format timestamp for display (Nov 18\n10:30:45)
  const formatTimestamp = useCallback((timestamp: string): string => {
    const date = new Date(timestamp)
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]
    const month = monthNames[date.getMonth()]
    const day = date.getDate()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')
    return `${month} ${day}\n${hours}:${minutes}:${seconds}`
  }, [])

  // Format currency helper
  const formatCurrency = useCallback((amount: string | number): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return String(amount)
    return new Intl.NumberFormat('uk-UA', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    })
      .format(num)
      .replace(/,/g, ' ')
  }, [])

  // Format details based on action type
  const formatDetails = useCallback(
    (log: AuditLog): string => {
      if (
        log.action === 'UPDATE' &&
        log.field_name === 'debt_amount' &&
        log.old_value &&
        log.new_value
      ) {
        return `Debt: ${formatCurrency(log.old_value)} → ${formatCurrency(log.new_value)} UAH`
      }
      if (log.action === 'CREATE' && log.entity_type === 'user') {
        return `Role: ${log.new_value || 'N/A'}, Project: ${log.entity_name || 'N/A'}`
      }
      if (log.action === 'LOGIN_FAILED' && log.ip_address) {
        const attempts = log.login_attempts || 1
        return `IP: ${log.ip_address}${attempts > 1 ? `\n(${attempts} attempts)` : ''}`
      }
      if (log.action === 'IMPORT' && log.reason) {
        return `CSV: ${log.entity_id || 'N/A'} - ${log.reason}`
      }
      return log.reason || '—'
    },
    [formatCurrency]
  )

  // Format result column
  const formatEntity = useCallback((log: AuditLog): string => {
    if (log.entity_type && log.entity_name) {
      const entityTypeCapitalized =
        log.entity_type.charAt(0).toUpperCase() + log.entity_type.slice(1)
      return `${entityTypeCapitalized}\n${log.entity_name}`
    }
    if (log.entity_type === 'user' && log.entity_id) {
      return `User: ${log.entity_id}`
    }
    if (log.action === 'LOGIN_FAILED' && log.reason) {
      return log.reason // e.g., "Invalid password"
    }
    if (log.entity_type) {
      return log.entity_type.charAt(0).toUpperCase() + log.entity_type.slice(1)
    }
    return '—'
  }, [])

  // Mock data - replace with actual API call
  const mockAuditLogs: AuditLog[] = useMemo(
    () => [
      {
        id: 1,
        timestamp: new Date('2025-11-18T10:30:45').toISOString(),
        status: 'success',
        user_id: 42,
        username: 'maria_s',
        role: 'Operator',
        action: 'UPDATE',
        entity_type: 'client',
        entity_id: '5678',
        entity_name: 'Олена Коваленко',
        field_name: 'debt_amount',
        old_value: '25000',
        new_value: '20000',
        reason: 'Payment received',
        ip_address: '192.168.1.100',
        session_id: 'sess_abc123',
        project_id: 1,
        http_method: 'PUT',
        api_path: '/api/clients/5678',
        response_status: '200 OK',
        response_time: 245,
        user_agent: 'Chrome 120.0 (Windows 10)',
        changes: [
          {
            field_name: 'debt_amount',
            old_value: '25000',
            new_value: '20000',
            change_type: 'Modified',
            calculated_change: '-5,000.00 UAH',
          },
          {
            field_name: 'phone_secondary',
            old_value: null,
            new_value: '+380931234567',
            change_type: 'Added',
          },
          {
            field_name: 'notes',
            old_value: 'Client prefers morning calls',
            new_value: 'Payment received. New phone verified.',
            change_type: 'Modified',
          },
        ],
      },
      {
        id: 2,
        timestamp: new Date('2025-11-18T09:15:22').toISOString(),
        status: 'success',
        user_id: 1,
        username: 'admin',
        role: 'Admin',
        action: 'CREATE',
        entity_type: 'user',
        entity_id: 'ivan_d',
        entity_name: 'Project A',
        new_value: 'Operator',
        ip_address: '192.168.1.50',
        session_id: 'sess_def456',
        project_id: 1,
        http_method: 'POST',
        api_path: '/api/users',
        response_status: '201 Created',
        response_time: 180,
        user_agent: 'Chrome 120.0 (Windows 10)',
        changes: [
          {
            field_name: 'role',
            old_value: null,
            new_value: 'Operator',
            change_type: 'Added',
          },
          {
            field_name: 'project',
            old_value: null,
            new_value: 'Project A',
            change_type: 'Added',
          },
        ],
      },
      {
        id: 3,
        timestamp: new Date('2025-11-18T08:45:10').toISOString(),
        status: 'failed',
        user_id: 8,
        username: 'unknown',
        action: 'LOGIN_FAILED',
        reason: 'Invalid password',
        ip_address: '45.123.45.67',
        login_attempts: 3,
        session_id: undefined,
        http_method: 'POST',
        api_path: '/api/auth/login',
        response_status: '401 Unauthorized',
        response_time: 120,
        user_agent: 'Firefox 119.0 (Linux)',
      },
      {
        id: 4,
        timestamp: new Date('2025-11-18T07:20:33').toISOString(),
        status: 'success',
        user_id: 15,
        username: 'olena_k',
        role: 'Supervisor',
        action: 'IMPORT',
        entity_type: 'client',
        entity_id: 'bank_nov.csv',
        reason: 'Created: 150, Updated: 50, Errors: 5',
        ip_address: '192.168.1.75',
        session_id: 'sess_ghi789',
        project_id: 1,
        http_method: 'POST',
        api_path: '/api/clients/import',
        response_status: '200 OK',
        response_time: 3500,
        user_agent: 'Chrome 120.0 (macOS)',
      },
      {
        id: 5,
        timestamp: new Date('2025-11-17T16:55:12').toISOString(),
        status: 'success',
        user_id: 42,
        username: 'maria_s',
        role: 'Operator',
        action: 'OVERRIDE',
        entity_type: 'client',
        entity_id: '4523',
        field_name: 'priority_score',
        old_value: '45',
        new_value: '95',
        reason: 'Lawsuit pending',
        ip_address: '192.168.1.100',
        session_id: 'sess_abc123',
        project_id: 1,
        http_method: 'PATCH',
        api_path: '/api/clients/4523/override',
        response_status: '200 OK',
        response_time: 190,
        user_agent: 'Chrome 120.0 (Windows 10)',
        changes: [
          {
            field_name: 'priority_score',
            old_value: '45',
            new_value: '95',
            change_type: 'Modified',
          },
        ],
      },
    ],
    []
  )

  const filteredLogs = useMemo(() => {
    let result = [...mockAuditLogs]

    // Apply filters
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      result = result.filter(
        (log) =>
          log.entity_id?.toLowerCase().includes(searchLower) ||
          log.username.toLowerCase().includes(searchLower) ||
          log.entity_type?.toLowerCase().includes(searchLower) ||
          log.entity_name?.toLowerCase().includes(searchLower) ||
          formatDetails(log).toLowerCase().includes(searchLower) ||
          formatEntity(log).toLowerCase().includes(searchLower) ||
          log.ip_address?.toLowerCase().includes(searchLower)
      )
    }

    // Filter by users (support both old single user and new multi-user format)
    if (filters.users && filters.users.length > 0) {
      result = result.filter(
        (log) =>
          filters.users!.includes(log.username) ||
          (log.user_id && filters.users!.includes(log.user_id.toString()))
      )
    } else if (filters.user) {
      // Backward compatibility with single user filter
      result = result.filter(
        (log) => log.username === filters.user || log.user_id?.toString() === filters.user
      )
    }

    if (filters.action) {
      result = result.filter((log) => log.action === filters.action)
    }

    if (filters.entity_type) {
      result = result.filter((log) => log.entity_type === filters.entity_type)
    }

    if (filters.date_from) {
      const fromDate = new Date(filters.date_from)
      result = result.filter((log) => new Date(log.timestamp) >= fromDate)
    }

    if (filters.date_to) {
      const toDate = new Date(filters.date_to)
      toDate.setHours(23, 59, 59, 999) // End of day
      result = result.filter((log) => new Date(log.timestamp) <= toDate)
    }

    // Apply sorting
    result.sort((a, b) => {
      const aValue = (a as unknown as Record<string, unknown>)[sortConfig.key]
      const bValue = (b as unknown as Record<string, unknown>)[sortConfig.key]

      if (aValue === bValue) return 0
      if (aValue == null) return 1
      if (bValue == null) return -1

      // Handle timestamp sorting
      if (sortConfig.key === 'timestamp') {
        const aTime = new Date(aValue as string).getTime()
        const bTime = new Date(bValue as string).getTime()
        const comparison = aTime > bTime ? 1 : -1
        return sortConfig.order === 'asc' ? comparison : -comparison
      }

      const comparison = aValue > bValue ? 1 : -1
      return sortConfig.order === 'asc' ? comparison : -comparison
    })

    return result
  }, [mockAuditLogs, filters, sortConfig, formatDetails, formatEntity])

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / pageSize)
  const paginatedLogs = useMemo(
    () => filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredLogs, currentPage, pageSize]
  )

  const handleFilterChange = useCallback(
    (newFilters: AuditLogFilters) => {
      // Update individual URL state for each filter field
      setSearchFilter(newFilters.search || '')
      setStatusFilter(newFilters.status || '')
      setClientFilter(newFilters.client || '')
      setPeriodFilter(newFilters.period || '')
      setDateFromFilter(newFilters.date_from || initialDateRange.date_from)
      setDateToFilter(newFilters.date_to || initialDateRange.date_to)
      setUserFilter(newFilters.user || '')
      setUsersFilter(newFilters.users || [])
      setEntityTypeFilter(newFilters.entity_type || '')
      setActionFilter(newFilters.action || '')
      setRoleFilter(newFilters.role || '')
      setCurrentPage(1) // Reset to first page on filter change
    },
    [
      setSearchFilter,
      setStatusFilter,
      setClientFilter,
      setPeriodFilter,
      setDateFromFilter,
      setDateToFilter,
      setUserFilter,
      setUsersFilter,
      setEntityTypeFilter,
      setActionFilter,
      setRoleFilter,
      setCurrentPage,
      initialDateRange,
    ]
  )

  const handleSort = useCallback(
    (key: string, order: SortOrder) => {
      setSortBy(key)
      setSortOrder(order)
      setCurrentPage(1) // Reset to first page on sort change
    },
    [setSortBy, setSortOrder, setCurrentPage]
  )

  const handleExport = useCallback(() => {
    setIsExportDialogOpen(true)
  }, [])

  const handleExportConfirm = useCallback(
    (options: CSVExportOptions) => {
      // TODO: Implement actual CSV export logic
      console.log('Exporting audit logs to CSV with options:', options)
      console.log('Filtered logs:', filteredLogs)
      // This would typically call an API or generate CSV client-side
    },
    [filteredLogs]
  )

  // Extract unique values for filters
  const users = useMemo(() => {
    const userSet = new Set<string>()
    mockAuditLogs.forEach((log) => {
      if (log.username) userSet.add(log.username)
    })
    // Add additional users to match screenshot examples
    userSet.add('david_k')
    userSet.add('emily_r')
    userSet.add('sara_t')
    userSet.add('Alex Johnson')
    userSet.add('Mia Thompson')
    userSet.add('Liam Smith')
    userSet.add('Olivia Brown')
    return Array.from(userSet).sort()
  }, [mockAuditLogs])

  const entityTypes = useMemo(() => {
    // Entity types from user story
    return ['User', 'Client', 'SMS Template', 'System Setting']
  }, [])

  const actions = useMemo(() => {
    // Action types from user story - map display names to actual action values
    return [
      'UPDATE',
      'CREATE',
      'DELETE',
      'IMPORT',
      'OVERRIDE',
      'LOGIN_FAILED',
      'Configuration Change',
    ]
  }, [])

  // Handle View Details click
  const handleViewDetails = useCallback((log: AuditLog) => {
    setSelectedLog(log)
    setIsDetailModalOpen(true)
  }, [])

  // Table columns definition - matching design
  const columns: Column<AuditLog>[] = useMemo(
    () => [
      {
        key: 'status',
        header: t('pages.auditLogs.tableHeaders.status'),
        align: 'left',
        sortable: false,
        render: (log) => (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded-full',
                log.status === 'success' ? 'bg-success-200' : 'bg-error-200'
              )}
            >
              {' '}
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  log.status === 'success' ? 'bg-success-500' : 'bg-error-500'
                )}
              />
            </span>
            <span
              className={cn(
                'text-sm font-medium',
                log.status === 'success' ? 'text-success-500' : 'text-error-500'
              )}
            >
              {log.status === 'success'
                ? t('pages.auditLogs.status.success')
                : t('pages.auditLogs.status.failed')}
            </span>
          </div>
        ),
      },
      {
        key: 'timestamp',
        header: t('pages.auditLogs.tableHeaders.timestamp'),
        sortable: true,
        render: (log) => (
          <span className="truncate overflow-hidden text-sm leading-[150%] font-light tracking-[-0.28px] text-[#1E1E1E]">
            {formatTimestamp(log.timestamp)}
          </span>
        ),
      },
      {
        key: 'user',
        header: t('pages.auditLogs.tableHeaders.user'),
        sortable: true,
        sortKey: 'username',
        render: (log) => (
          <div className="flex flex-row items-center justify-between">
            <span className="truncate overflow-hidden text-sm leading-[150%] font-light tracking-[-0.28px] text-[#1E1E1E]">
              {log.username || '—'}
            </span>
            {log.role && (
              <span className="truncate overflow-hidden text-sm leading-[150%] font-light tracking-[-0.28px] text-[#1E1E1E]">
                {log.role}
              </span>
            )}
            {!log.role && log.username === 'unknown' && (
              <span className="truncate overflow-hidden text-sm leading-[150%] font-light tracking-[-0.28px] text-[#1E1E1E]">
                —
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'action',
        header: t('pages.auditLogs.tableHeaders.actions'),
        sortable: true,
        render: (log) => (
          <span className="truncate overflow-hidden text-sm leading-[150%] font-light tracking-[-0.28px] text-[#1E1E1E]">
            {log.action || '—'}
          </span>
        ),
      },
      {
        key: 'entity',
        header: t('pages.auditLogs.tableHeaders.entity'),
        sortable: false,
        render: (log) => (
          <span className="truncate overflow-hidden text-sm leading-[150%] font-light tracking-[-0.28px] text-[#1E1E1E]">
            {formatEntity(log)}
          </span>
        ),
      },
      {
        key: 'details',
        header: t('pages.auditLogs.tableHeaders.details'),
        sortable: false,
        render: (log) => (
          <div className="flex flex-row items-center justify-between">
            <span className="truncate overflow-hidden text-sm leading-[150%] font-light tracking-[-0.28px] text-[#1E1E1E]">
              {formatDetails(log)}
            </span>
            <LinkButton
              variant="regular-secondary"
              size="xs"
              onClick={() => handleViewDetails(log)}
              leftIcon={<Icons.View size={14} strokeWidth={2} />}
            >
              {t('pages.auditLogs.viewDetails')}
            </LinkButton>
          </div>
        ),
      },
    ],
    [formatTimestamp, formatEntity, formatDetails, handleViewDetails, t]
  )

  return (
    <div className="flex h-full flex-col">
      {/* Page Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
          {t('pages.auditLogs.title')}
        </h1>
        <Button
          variant="primary"
          size="md"
          onClick={handleExport}
          leftIcon={<Icons.Download size={16} className="text-dark-500" />}
          className="h-[45px] rounded-full text-xs"
        >
          {t('pages.auditLogs.exportCsv')}
        </Button>
      </div>

      {/* Search & Filters */}
      <SearchFiltersBar
        filters={filters}
        onFilterChange={handleFilterChange}
        users={users}
        entityTypes={entityTypes}
        actions={actions}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Audit Logs Table */}
        <div className="flex flex-1 flex-col gap-6 overflow-hidden rounded-xl bg-white/50 p-6">
          <DataTable
            columns={columns}
            data={paginatedLogs}
            emptyMessage={t('pages.auditLogs.noLogsFound')}
            sortConfig={sortConfig}
            onSort={handleSort}
          />

          {/* Pagination */}
          {totalPages > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize)
                setCurrentPage(1) // Reset to first page when changing page size
              }}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <AuditLogDetailModal
        open={isDetailModalOpen}
        log={selectedLog}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedLog(null)
        }}
      />
      <CSVExportDialog
        open={isExportDialogOpen}
        totalEntries={filteredLogs.length}
        onClose={() => setIsExportDialogOpen(false)}
        onExport={handleExportConfirm}
      />
    </div>
  )
}

export default AuditLogsPage
