/**
 * AuditLogDetailModal Component
 *
 * Modal that displays detailed information about an audit log entry.
 * Shows Event Information, Changes, and Request Information sections.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import type { AuditLog, AuditLogChange } from '../AuditLogsPage'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface AuditLogDetailModalProps {
  open: boolean
  log: AuditLog | null
  onClose: () => void
}

export function AuditLogDetailModal({ open, log, onClose }: AuditLogDetailModalProps) {
  const { t } = useTranslation('common')

  if (!log) return null

  // Format timestamp with UTC
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp)
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const hours = String(date.getUTCHours()).padStart(2, '0')
    const minutes = String(date.getUTCMinutes()).padStart(2, '0')
    const seconds = String(date.getUTCSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`
  }

  // Calculate change for a field
  const calculateChange = (change: AuditLogChange): string => {
    // Use calculated_change if available
    if (change.calculated_change) {
      return change.calculated_change
    }
    // Use change_type if available
    if (change.change_type) {
      if (change.change_type === 'Added') {
        return t('pages.auditLogs.detailModal.added')
      }
      if (change.change_type === 'Removed') {
        return t('pages.auditLogs.detailModal.removed')
      }
      if (change.change_type === 'Modified') {
        // For modified, try to calculate the difference if it's a currency field
        if (change.field_name === 'debt_amount' || change.field_name === 'total_debt') {
          const oldNum = parseFloat(change.old_value || '0')
          const newNum = parseFloat(change.new_value || '0')
          const diff = newNum - oldNum
          if (diff === 0) return t('pages.auditLogs.detailModal.modified')
          const formattedDiff = formatCurrency(Math.abs(diff))
          return `${diff > 0 ? '+' : '-'}${formattedDiff} UAH`
        }
        return t('pages.auditLogs.detailModal.modified')
      }
    }
    // Fallback to old logic
    if (change.old_value === null && change.new_value !== null) {
      return t('pages.auditLogs.detailModal.added')
    }
    if (change.old_value !== null && change.new_value === null) {
      return t('pages.auditLogs.detailModal.removed')
    }
    if (change.field_name === 'debt_amount' || change.field_name === 'total_debt') {
      const oldNum = parseFloat(change.old_value || '0')
      const newNum = parseFloat(change.new_value || '0')
      const diff = newNum - oldNum
      if (diff === 0) return t('pages.auditLogs.detailModal.modified')
      const formattedDiff = formatCurrency(Math.abs(diff))
      return `${diff > 0 ? '+' : '-'}${formattedDiff} UAH`
    }
    return t('pages.auditLogs.detailModal.modified')
  }

  // Format value for display
  const formatValue = (value: string | null | undefined, fieldName?: string): string => {
    if (value === null || value === undefined) return '(null)'
    if (value === '') return '(empty)'

    // Special handling for available_variables field
    if (fieldName === 'available_variables') {
      try {
        // Parse JSON array of variable objects
        const parsed = typeof value === 'string' ? JSON.parse(value) : value
        if (Array.isArray(parsed)) {
          // Extract variable names and format as {variable_name}
          const variableNames = parsed
            .map((item: unknown) => {
              if (typeof item === 'object' && item !== null) {
                const obj = item as Record<string, unknown>
                return (obj.name as string) || (obj.variable as string) || String(item)
              }
              return String(item)
            })
            .filter((name: string) => name)
          if (variableNames.length === 0) return '(empty)'
          // Format as {variable1}, {variable2}, etc.
          return variableNames.map((name: string) => `{${name}}`).join(', ')
        }
      } catch {
        // If parsing fails, fall through to default handling
      }
    }

    // Check if value is a JSON string (starts with { or [)
    if (
      typeof value === 'string' &&
      (value.trim().startsWith('{') || value.trim().startsWith('['))
    ) {
      try {
        // Try to parse and pretty-print JSON
        const parsed = JSON.parse(value)
        return JSON.stringify(parsed, null, 2)
      } catch {
        // If not valid JSON, return as-is
        return value
      }
    }
    return value
  }

  // Format currency value
  const formatCurrencyValue = (value: string | null | undefined): string => {
    if (value === null || value === undefined) return '(null)'
    const num = parseFloat(value)
    if (isNaN(num)) return value
    return `${formatCurrency(num)} UAH`
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex items-center justify-center rounded-full p-2.5">
            <Icons.File size={20} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.auditLogs.detailModal.title')}
        className="pb-6"
      />
      <ModalContent className="max-h-[calc(90vh-200px)]">
        <div className="flex flex-col gap-4">
          {/* Event Information Section */}
          <div className="flex flex-col gap-2 self-stretch">
            <span className="text-dark-500 text-base leading-[155%] font-medium tracking-[-0.32px]">
              {t('pages.auditLogs.detailModal.eventInformation')}
            </span>
            <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white bg-white/50 px-3 py-4 sm:px-6 sm:py-5">
              <div className="flex w-full flex-col items-start gap-2 py-0 sm:w-[472px]">
                <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-start sm:gap-6">
                  <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                    {t('pages.auditLogs.detailModal.timestamp')}:
                  </span>
                  <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] break-words sm:text-sm">
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>
                <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-start sm:gap-6">
                  <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                    {t('pages.auditLogs.detailModal.user')}:
                  </span>
                  <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] break-words sm:text-sm">
                    {log.username} {log.user_id ? `(ID: ${log.user_id})` : ''}
                  </span>
                </div>
                <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-start sm:gap-6">
                  <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                    {t('pages.auditLogs.detailModal.role')}:
                  </span>
                  <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] break-words sm:text-sm">
                    {log.role || '—'}
                  </span>
                </div>
                <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-start sm:gap-6">
                  <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                    {t('pages.auditLogs.detailModal.action')}:
                  </span>
                  <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] break-words sm:text-sm">
                    {log.action}
                  </span>
                </div>
                <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-start sm:gap-6">
                  <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                    {t('pages.auditLogs.detailModal.result')}:
                  </span>
                  <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] break-words sm:text-sm">
                    {log.entity_name
                      ? log.entity_name
                      : log.entity_type && log.entity_id
                        ? `${log.entity_type.charAt(0).toUpperCase() + log.entity_type.slice(1)} #${log.entity_id}`
                        : log.entity_type
                          ? log.entity_type.charAt(0).toUpperCase() + log.entity_type.slice(1)
                          : '—'}
                  </span>
                </div>
                <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-start sm:gap-6">
                  <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                    {t('pages.auditLogs.detailModal.ipAddress')}:
                  </span>
                  <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] break-words sm:text-sm">
                    {log.ip_address || '—'}
                  </span>
                </div>
                <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-start sm:gap-6">
                  <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                    {t('pages.auditLogs.detailModal.sessionId')}:
                  </span>
                  <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] break-words sm:text-sm">
                    {log.session_id || '—'}
                  </span>
                </div>
                <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-start sm:gap-6">
                  <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                    {t('pages.auditLogs.detailModal.status')}:
                  </span>
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
                        'text-xs font-medium sm:text-sm',
                        log.status === 'success' ? 'text-success-500' : 'text-error-500'
                      )}
                    >
                      {log.status === 'success'
                        ? t('pages.auditLogs.status.success')
                        : t('pages.auditLogs.status.failed')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Changes Section */}
          {log.changes && log.changes.length > 0 && (
            <div className="flex flex-col gap-2 self-stretch">
              <span className="text-dark-500 text-base leading-[155%] font-medium tracking-[-0.32px]">
                {t('pages.auditLogs.detailModal.changes')}
              </span>

              {log.changes.map((change, index) => (
                <div
                  key={index}
                  className="flex flex-col items-start justify-center gap-1 self-stretch rounded-xl border border-white bg-white/50 px-3 py-3 sm:px-6 sm:py-4"
                >
                  <div className="flex flex-col gap-3 self-stretch sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex w-full flex-col items-start gap-2 p-0 sm:w-[120px]">
                      <span className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-700 sm:text-sm">
                        {t('pages.auditLogs.detailModal.field')}:
                      </span>
                      <span className="text-dark-500 text-xs leading-[150%] font-medium tracking-[-0.28px] break-words sm:text-sm">
                        {change.field_name}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col items-start gap-2 p-0">
                      <span className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-700 sm:text-sm">
                        {t('pages.auditLogs.detailModal.oldValue')}:
                      </span>
                      <span className="text-dark-500 text-xs leading-[150%] font-medium tracking-[-0.28px] break-words sm:text-sm">
                        {change.field_name === 'debt_amount' || change.field_name === 'total_debt'
                          ? formatCurrencyValue(change.old_value)
                          : formatValue(change.old_value, change.field_name)}
                      </span>
                    </div>
                    {/* Arrow Icon - hidden on mobile, shown on desktop */}
                    <div className="hidden w-[26px] self-stretch sm:block">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="27"
                        height="80"
                        viewBox="0 0 27 80"
                        fill="none"
                      >
                        <path
                          d="M6.44629 0.22589L26.4463 39.7259L6.44629 79.2259"
                          stroke="#DFDFDF"
                        />
                        <path
                          d="M0.446289 0.22589L20.4463 39.7259L0.446286 79.2259"
                          stroke="#DFDFDF"
                        />
                      </svg>
                    </div>
                    <div className="flex flex-1 flex-col items-start p-0">
                      <span className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-700 sm:text-sm">
                        {t('pages.auditLogs.detailModal.newValue')}:
                      </span>
                      <span className="text-dark-500 text-xs leading-[150%] font-medium tracking-[-0.28px] break-words sm:text-sm">
                        {change.field_name === 'debt_amount' || change.field_name === 'total_debt'
                          ? formatCurrencyValue(change.new_value)
                          : formatValue(change.new_value, change.field_name)}
                      </span>
                    </div>
                  </div>
                  <div className="my-2 h-px w-full bg-gray-200" />
                  <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] break-words sm:text-sm">
                    {t('pages.auditLogs.detailModal.change')}:
                    <span className="font-medium">{calculateChange(change)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Request Information Section */}
          <div className="flex flex-col gap-2 self-stretch">
            <span className="text-dark-500 text-base leading-[155%] font-medium tracking-[-0.32px]">
              {t('pages.auditLogs.detailModal.requestInformation')}
            </span>
            <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white bg-white/50 px-3 py-4 sm:px-6 sm:py-5">
              <div className="flex w-full flex-col items-start gap-2 py-0 sm:w-[472px]">
                <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-start sm:gap-6">
                  <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                    {t('pages.auditLogs.detailModal.httpMethod')}:
                  </span>
                  <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] break-words sm:text-sm">
                    {log.http_method || '—'}
                  </span>
                </div>
                <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-start sm:gap-6">
                  <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                    {t('pages.auditLogs.detailModal.apiPath')}:
                  </span>
                  <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] break-words sm:text-sm">
                    {log.api_path || '—'}
                  </span>
                </div>
                <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-start sm:gap-6">
                  <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                    {t('pages.auditLogs.detailModal.responseStatus')}:
                  </span>
                  <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] break-words sm:text-sm">
                    {log.response_status || '—'}
                  </span>
                </div>
                <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-start sm:gap-6">
                  <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                    {t('pages.auditLogs.detailModal.responseTime')}:
                  </span>
                  <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] break-words sm:text-sm">
                    {log.response_time !== undefined ? `${log.response_time} ms` : '—'}
                  </span>
                </div>
                <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-start sm:gap-6">
                  <span className="text-dark-500 shrink-0 text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                    {t('pages.auditLogs.detailModal.userAgent')}:
                  </span>
                  <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] break-words sm:text-sm">
                    {log.user_agent || '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ModalContent>
      <ModalFooter className="flex flex-col gap-3 self-stretch border-none">
        <Button type="button" variant="cancel" onClick={onClose} className="h-12 w-full rounded-md">
          {t('actions.close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
