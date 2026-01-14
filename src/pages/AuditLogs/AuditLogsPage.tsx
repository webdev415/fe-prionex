/**
 * AuditLogsPage Component
 *
 * Main page for viewing audit logs with search and filtering capabilities.
 */

import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { SearchFiltersBar } from './components/SearchFiltersBar'
import { AuditLogDetailModal } from './components/AuditLogDetailModal'
import { CSVExportDialog, type CSVExportOptions } from './components/CSVExportDialog'
import { DataTable, type Column, type SortConfig, type SortOrder } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { LinkButton } from '@/components/ui/LinkButton'
import { cn } from '@/lib/utils'
import { useAuditLogs, exportAuditLogs } from '@/features/audit'
import type { AuditLogResponse } from '@/features/audit/api/types'
import { toast } from 'sonner'

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
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [filters, setFilters] = useState<AuditLogFilters>({})

  // Convert backend filters to API params
  const apiParams = useMemo(() => {
    const params: Record<string, unknown> = {
      page: currentPage,
      limit: pageSize,
    }

    if (filters.date_from) params.from_date = filters.date_from
    if (filters.date_to) params.to_date = filters.date_to
    if (filters.entity_type) params.resource_type = filters.entity_type.toLowerCase()
    if (filters.action) params.action = filters.action.toLowerCase()
    if (filters.status === 'success') params.success = true
    if (filters.status === 'failed') params.success = false

    // Handle user filter - try to parse as user_id if numeric, otherwise use username
    if (filters.user) {
      const userId = parseInt(filters.user, 10)
      if (!isNaN(userId)) {
        params.user_id = userId
      }
    }

    // Handle search - map to resource_id if numeric, otherwise use resource_identifier
    if (filters.search) {
      const resourceId = parseInt(filters.search, 10)
      if (!isNaN(resourceId)) {
        params.resource_id = resourceId
      } else {
        params.resource_identifier = filters.search
      }
    }

    return params
  }, [filters, currentPage, pageSize])

  // Fetch audit logs from API
  // React Query will automatically refetch when apiParams changes (including page changes)
  // The query key includes all params, so changing currentPage will trigger a new request
  const { data: auditData, isLoading, error } = useAuditLogs(apiParams)

  // Map backend response to frontend AuditLog type
  const mapAuditLogResponse = useCallback((log: AuditLogResponse): AuditLog => {
    // Extract entity name from resource_name (new field) or record_after/record_before
    let entityName: string | undefined
    // First check resource_name field (new field from backend)
    if (log.resource_name) {
      entityName = log.resource_name
    }
    // Fallback to record_after or record_before
    if (!entityName && log.record_after) {
      const record = log.record_after as Record<string, unknown>
      entityName =
        (record.full_name as string) ||
        (record.name as string) ||
        (record.client_name as string) ||
        (record.username as string) ||
        (record.email as string)
    }
    if (!entityName && log.record_before) {
      const record = log.record_before as Record<string, unknown>
      entityName =
        (record.full_name as string) ||
        (record.name as string) ||
        (record.client_name as string) ||
        (record.username as string) ||
        (record.email as string)
    }

    // Map changes to AuditLogChange format
    const changes: AuditLogChange[] = []
    if (log.changes) {
      Object.entries(log.changes).forEach(([field, change]) => {
        const changeObj = change as { old?: unknown; new?: unknown }
        let changeType: 'Added' | 'Modified' | 'Removed' | undefined
        if (changeObj.old === null || changeObj.old === undefined) {
          changeType = 'Added'
        } else if (changeObj.new === null || changeObj.new === undefined) {
          changeType = 'Removed'
        } else {
          changeType = 'Modified'
        }

        changes.push({
          field_name: field,
          old_value: changeObj.old ? String(changeObj.old) : null,
          new_value: changeObj.new ? String(changeObj.new) : null,
          change_type: changeType,
        })
      })
    }

    // Extract reason from multiple sources: record_after, record_before, or details
    let reason: string | undefined
    // First check record_after (backend stores details here)
    if (log.record_after && typeof log.record_after === 'object') {
      const details = log.record_after as Record<string, unknown>
      reason = (details.reason as string) || (details.message as string) || undefined
    }
    // Then check record_before
    if (!reason && log.record_before && typeof log.record_before === 'object') {
      const details = log.record_before as Record<string, unknown>
      reason = (details.reason as string) || (details.message as string) || undefined
    }
    // Also check details field directly (some services only send details, not record_after/before)
    if (!reason && log.details && typeof log.details === 'object') {
      const details = log.details as Record<string, unknown>
      reason = (details.reason as string) || (details.message as string) || undefined
    }
    // Also check if record_after itself is a string (some cases)
    if (!reason && typeof log.record_after === 'string') {
      reason = log.record_after
    }

    // Map action to display format
    const actionDisplay =
      log.action.split('.').pop()?.toUpperCase().replace(/_/g, ' ') || log.action

    return {
      id: log.id,
      timestamp: log.timestamp,
      status: log.success ? 'success' : 'failed',
      user_id: log.user_id ?? undefined,
      username: log.username || 'unknown',
      role: log.user_role ?? undefined,
      action: actionDisplay,
      entity_type: log.resource_type,
      entity_id: log.resource_id?.toString() || log.resource_identifier || undefined,
      entity_name: entityName,
      ip_address: log.ip_address ?? undefined,
      session_id: log.session_id ?? undefined,
      project_id: log.project_id ?? undefined,
      changes: changes.length > 0 ? changes : undefined,
      http_method: log.request_method ?? undefined,
      api_path: log.request_path ?? undefined,
      response_status: log.response_status
        ? `${log.response_status} ${log.response_status < 300 ? 'OK' : 'Error'}`
        : undefined,
      response_time: log.response_time ?? undefined,
      user_agent: log.user_agent ?? undefined,
      reason,
    }
  }, [])

  // Convert API response to frontend format
  const auditLogs: AuditLog[] = useMemo(() => {
    if (!auditData?.logs) return []
    return auditData.logs.map(mapAuditLogResponse)
  }, [auditData, mapAuditLogResponse])

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'timestamp',
    order: 'desc',
  })
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
      // Handle import events (action will be "STARTED", "COMPLETED", "FILE UPLOADED", etc. after transformation)
      if (log.entity_type === 'import_job' && log.reason) {
        return log.reason
      }
      // Handle import events by checking if action contains import-related keywords
      if (
        (log.action.includes('IMPORT') ||
          log.action === 'STARTED' ||
          log.action === 'COMPLETED' ||
          log.action === 'FILE UPLOADED' ||
          log.action === 'FAILED') &&
        log.entity_type === 'import_job' &&
        log.reason
      ) {
        return log.reason
      }
      // Handle scoring events (RUN STARTED, RUN COMPLETED, RUN FAILED)
      if (log.entity_type === 'score' && log.reason) {
        return log.reason
      }
      if (
        (log.action === 'RUN STARTED' ||
          log.action === 'RUN COMPLETED' ||
          log.action === 'RUN FAILED') &&
        log.entity_type === 'score' &&
        log.reason
      ) {
        return log.reason
      }
      // Handle auth events (LOGIN SUCCESS, LOGIN FAILED, LOGOUT)
      if (log.entity_type === 'auth' && log.reason) {
        return log.reason
      }
      if (
        (log.action === 'LOGIN SUCCESS' ||
          log.action === 'LOGIN FAILED' ||
          log.action === 'LOGOUT') &&
        log.entity_type === 'auth' &&
        log.reason
      ) {
        return log.reason
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
    // For import jobs, show filename if available (from resource_name)
    if (log.entity_type === 'import_job' && log.entity_name) {
      return log.entity_name // This will be the filename from resource_name
    }
    // For scoring events, show resource name if available (e.g., "Project 1")
    if (log.entity_type === 'score' && log.entity_name) {
      return log.entity_name // This will be the project name from resource_name
    }
    // For auth events, show username if available (from resource_name)
    if (log.entity_type === 'auth' && log.entity_name) {
      return log.entity_name // This will be the username from resource_name
    }
    if (log.entity_type) {
      return log.entity_type.charAt(0).toUpperCase() + log.entity_type.slice(1)
    }
    return '—'
  }, [])

  // Apply client-side filtering for search (since API doesn't support text search)
  const filteredLogs = useMemo(() => {
    let result = [...auditLogs]

    // Client-side search filter (API doesn't support text search)
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

    // Filter by users (client-side)
    if (filters.users && filters.users.length > 0) {
      result = result.filter(
        (log) =>
          filters.users!.includes(log.username) ||
          (log.user_id && filters.users!.includes(log.user_id.toString()))
      )
    } else if (filters.user) {
      result = result.filter(
        (log) => log.username === filters.user || log.user_id?.toString() === filters.user
      )
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
  }, [auditLogs, filters, sortConfig, formatDetails, formatEntity])

  // Pagination - use API pagination
  // The API already returns paginated results, so we use them directly
  // Client-side filtering is applied, but NOT client-side pagination
  const totalPages = auditData ? Math.ceil(auditData.total / pageSize) : 0
  const paginatedLogs = filteredLogs // Use filtered results directly (API handles pagination)

  const handleFilterChange = useCallback((newFilters: AuditLogFilters) => {
    setFilters(newFilters)
    setCurrentPage(1) // Reset to first page on filter change
  }, [])

  const handleSort = useCallback((key: string, order: SortOrder) => {
    setSortConfig({ key, order })
    setCurrentPage(1) // Reset to first page on sort change
  }, [])

  const handleExport = useCallback(() => {
    setIsExportDialogOpen(true)
  }, [])

  const handleExportConfirm = useCallback(
    async (_options: CSVExportOptions) => {
      try {
        // Export as CSV (the dialog is for CSV export)
        // Note: _options contains export configuration but backend API uses apiParams
        const blob = await exportAuditLogs('csv', apiParams)

        // Create download link
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)

        toast.success(t('pages.auditLogs.exportSuccess'))
      } catch (err) {
        console.error('Export failed:', err)
        toast.error(t('pages.auditLogs.exportError'))
      }
    },
    [apiParams, t]
  )

  // Extract unique values for filters from API data
  const users = useMemo(() => {
    const userSet = new Set<string>()
    auditLogs.forEach((log) => {
      if (log.username) userSet.add(log.username)
    })
    return Array.from(userSet).sort()
  }, [auditLogs])

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
        isLoading={isLoading}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Audit Logs Table */}
        <div className="flex flex-1 flex-col gap-6 overflow-hidden rounded-xl bg-white/50 p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">{t('common.loading')}</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-error-500">{t('pages.auditLogs.loadError')}</div>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={paginatedLogs}
              emptyMessage={t('pages.auditLogs.noLogsFound')}
              sortConfig={sortConfig}
              onSort={handleSort}
            />
          )}

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
        totalEntries={auditData?.total || 0}
        onClose={() => setIsExportDialogOpen(false)}
        onExport={handleExportConfirm}
      />
    </div>
  )
}

export default AuditLogsPage
