/**
 * AgentPerformanceTable Component
 *
 * Table displaying agent performance metrics with filters.
 */

import { useState, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { intlLocaleForUiLanguage } from '@/lib/i18n'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { DateSelect } from '@/components/ui/DateSelect'
import { LinkButton } from '@/components/ui/LinkButton'
import { Icons } from '@/lib/icons'
import { getDateStringInTimezone } from '@/lib/dateUtils'
import type { Period } from '../types'

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Export data to CSV and trigger download
 */
function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return

  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header]
          // Escape values containing commas or quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return String(value ?? '')
        })
        .join(',')
    ),
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Calculate average duration from array of durations in seconds
 */
function calculateAverageDuration(durations: number[]): string {
  if (durations.length === 0) return '0:00'
  const avgSeconds = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
  const minutes = Math.floor(avgSeconds / 60)
  const seconds = avgSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Get date range based on period
 */
function getDateRange(period: Period): { from: Date; to: Date } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (period) {
    case 'today':
      return { from: today, to: today }
    case 'thisWeek': {
      const dayOfWeek = today.getDay()
      const monday = new Date(today)
      monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return { from: monday, to: sunday }
    }
    case 'thisMonth': {
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      return { from: firstOfMonth, to: lastOfMonth }
    }
    default:
      return { from: today, to: today }
  }
}

export interface AgentPerformance {
  id: string
  operator: string
  calls: number
  contactRate: number
  avgDuration: string
  sms: number
  messages: number
  payments: number
}

export interface AgentPerformanceTableProps {
  data: AgentPerformance[]
  isLoading?: boolean
  selectedPeriod: Period
  selectedOperator: number | null
  onOperatorChange: (operatorId: number | null) => void
  customFromDate: string | null
  customToDate: string | null
  onFromDateChange: (date: string | null) => void
  onToDateChange: (date: string | null) => void
  userTimezone?: string | null
}

export interface Column<T> {
  key: string
  header: string
  render?: (item: T) => ReactNode
  align?: 'left' | 'center' | 'right'
  className?: string
  sortable?: boolean
  sortKey?: string // Optional different key for sorting (e.g., 'name' column might sort by 'name' field)
}

export function AgentPerformanceTable({
  data,
  isLoading = false,
  selectedPeriod,
  selectedOperator,
  onOperatorChange,
  customFromDate,
  customToDate,
  onFromDateChange,
  onToDateChange,
  userTimezone,
}: AgentPerformanceTableProps) {
  const { t, i18n } = useTranslation('common')
  const [clientPhone, setClientPhone] = useState<string>('')

  // Calculate default date range from period
  const defaultDateRange = useMemo(() => getDateRange(selectedPeriod), [selectedPeriod])

  // Parse ISO date strings as local dates to avoid timezone issues
  const parseLocalDate = (isoString: string): Date => {
    const [year, month, day] = isoString.split('-').map(Number)
    return new Date(year, month - 1, day) // month is 0-indexed
  }

  // Use custom dates if set, otherwise use period-based dates
  const dateRange = useMemo(() => {
    const from = customFromDate ? parseLocalDate(customFromDate) : defaultDateRange.from
    const to = customToDate ? parseLocalDate(customToDate) : defaultDateRange.to
    return { from, to }
  }, [customFromDate, customToDate, defaultDateRange])

  // Get unique operators for filter (map to their IDs)
  const operators = useMemo(
    () =>
      Array.from(new Set(data.map((item) => ({ id: item.id, name: item.operator })))).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [data]
  )

  // Client-side filter for phone only (operator and date filters handled by API)
  const filteredData = useMemo(() => {
    if (!clientPhone || clientPhone.trim() === '') {
      return data
    }

    // In real implementation, this would filter by actual client phone data
    // For now, just return all data
    return data
  }, [data, clientPhone])

  const formatCurrency = (amount: number) => {
    const locale = intlLocaleForUiLanguage(i18n.language)
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(amount)
      .replace(/,/g, ' ')
  }

  const columns: Column<AgentPerformance>[] = [
    {
      key: 'operator',
      header: t('pages.reports.tableHeaders.operator'),
      render: (item) => (
        <span className="text-foreground text-xs font-medium">{item.operator}</span>
      ),
    },
    {
      key: 'calls',
      header: t('pages.reports.tableHeaders.calls'),
      align: 'center',
      render: (item) => <span className="text-foreground text-xs font-medium">{item.calls}</span>,
    },
    {
      key: 'contactRate',
      header: t('pages.reports.tableHeaders.contactRate'),
      align: 'center',
      render: (item) => (
        <span className="text-foreground text-xs font-medium">{item.contactRate}%</span>
      ),
    },
    {
      key: 'avgDuration',
      header: t('pages.reports.tableHeaders.avgDuration'),
      align: 'center',
      render: (item) => (
        <span className="text-foreground text-xs font-medium">{item.avgDuration}</span>
      ),
    },
    {
      key: 'sms',
      header: t('pages.reports.tableHeaders.sms'),
      align: 'center',
      render: (item) => <span className="text-foreground text-xs font-medium">{item.sms}</span>,
    },
    {
      key: 'messages',
      header: t('pages.reports.tableHeaders.messages'),
      align: 'center',
      render: (item) => (
        <span className="text-foreground text-xs font-medium">{item.messages}</span>
      ),
    },
    {
      key: 'payments',
      header: t('pages.reports.tableHeaders.payments'),
      align: 'right',
      render: (item) => (
        <span className="text-foreground text-xs font-medium">
          {formatCurrency(item.payments)} {t('pages.reports.currencySymbol')}
        </span>
      ),
    },
  ]

  // Calculate totals from filtered data
  const totals = useMemo(() => {
    if (filteredData.length === 0) {
      return {
        calls: 0,
        contactRate: 0,
        avgDuration: '0:00',
        sms: 0,
        messages: 0,
        payments: 0,
      }
    }

    const totalCalls = filteredData.reduce((sum, item) => sum + item.calls, 0)
    const avgContactRate = Math.round(
      filteredData.reduce((sum, item) => sum + item.contactRate, 0) / filteredData.length
    )

    // Calculate average duration from individual durations
    // Parse duration strings back to seconds for calculation
    const durations = filteredData.map((item) => {
      const [minutes, seconds] = item.avgDuration.split(':').map(Number)
      return minutes * 60 + seconds
    })
    const avgDuration = calculateAverageDuration(durations)

    return {
      calls: totalCalls,
      contactRate: avgContactRate,
      avgDuration,
      sms: filteredData.reduce((sum, item) => sum + item.sms, 0),
      messages: filteredData.reduce((sum, item) => sum + item.messages, 0),
      payments: filteredData.reduce((sum, item) => sum + item.payments, 0),
    }
  }, [filteredData])

  const handleExport = () => {
    const exportData = filteredData.map((item) => ({
      Operator: item.operator,
      Calls: item.calls,
      'Contact Rate (%)': item.contactRate,
      'Avg Duration': item.avgDuration,
      SMS: item.sms,
      Messages: item.messages,
      Payments: item.payments,
    }))

    // Add totals row
    exportData.push({
      Operator: 'Total',
      Calls: totals.calls,
      'Contact Rate (%)': totals.contactRate,
      'Avg Duration': totals.avgDuration,
      SMS: totals.sms,
      Messages: totals.messages,
      Payments: totals.payments,
    })

    const filename = `operator_performance_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.csv`
    exportToCSV(exportData, filename)
  }

  return (
    <div className="bg-card/50 flex min-h-0 w-full flex-1 flex-col items-start gap-3 self-stretch rounded-xl p-3 sm:min-h-[730px] sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:justify-between">
        <span className="text-foreground text-base leading-[155%] font-medium tracking-[-0.32px]">
          {t('pages.reports.agentPerformance.title', { count: filteredData.length })}
        </span>
        <LinkButton
          variant="regular-black"
          size="xs"
          onClick={handleExport}
          rightIcon={<Icons.ArrowRight size={20} className="text-foreground" />}
          className="self-start sm:self-auto"
        >
          {t('pages.reports.agentPerformance.exportTable')}
        </LinkButton>
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-start self-stretch">
        {/* Filters */}
        <div className="border-border bg-card flex w-full flex-col items-stretch gap-4 self-stretch rounded-t-xl border p-3 sm:p-4 xl:flex-row xl:items-end xl:gap-5">
          <div className="flex w-full min-w-0 flex-col items-start justify-center gap-1 xl:flex-1">
            <Label
              htmlFor="responsible-operator"
              required
              className="text-foreground text-xs leading-[140%] font-medium tracking-[-0.24px]"
            >
              {t('pages.reports.filters.responsibleOperator')}
            </Label>
            <Select
              value={selectedOperator?.toString() || 'all'}
              onValueChange={(value) => onOperatorChange(value === 'all' ? null : Number(value))}
            >
              <SelectTrigger className="w-full" id="responsible-operator">
                <SelectValue placeholder={t('pages.reports.filters.selectEmployee')} />
              </SelectTrigger>
              <SelectContent searchable>
                <SelectItem value="all">
                  {t('pages.reports.filters.allOperators', 'All Operators')}
                </SelectItem>
                {operators.map((operator) => (
                  <SelectItem key={operator.id} value={operator.id}>
                    {operator.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-full min-w-0 flex-col items-start justify-center gap-1 xl:flex-1">
            <Label
              htmlFor="client-phone"
              required
              className="text-foreground text-xs leading-[140%] font-medium tracking-[-0.24px]"
            >
              {t('pages.reports.filters.clientPhone')}
            </Label>
            <Input
              type="text"
              id="client-phone"
              placeholder={t('pages.reports.filters.typePhoneNumber')}
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex w-full min-w-0 flex-col items-start justify-center gap-1 xl:min-w-[280px] xl:flex-[1.4]">
            <span className="text-foreground text-xs leading-[140%] font-medium tracking-[-0.24px]">
              {t('pages.reports.filters.dateOfSale')}
            </span>
            <div className="grid w-full grid-cols-1 gap-2 min-[480px]:grid-cols-[1fr_auto_1fr] min-[480px]:items-center min-[480px]:gap-3">
              <DateSelect
                key={`date-from-${selectedPeriod}`}
                disabled={true} // Disable manual date selection when period is selected
                value={dateRange.from}
                onChange={({ value }) => {
                  onFromDateChange(value ? getDateStringInTimezone(value, userTimezone) : null)
                }}
                allowManualInput
                format="dd.MM.yyyy"
                className="w-full min-w-0"
              />
              <span className="text-muted-foreground hidden text-center text-base leading-[155%] font-medium tracking-[-0.32px] min-[480px]:block">
                -
              </span>
              <DateSelect
                key={`date-to-${selectedPeriod}`}
                disabled={true} // Disable manual date selection when period is selected
                value={dateRange.to}
                onChange={({ value }) => {
                  onToDateChange(value ? getDateStringInTimezone(value, userTimezone) : null)
                }}
                allowManualInput
                format="dd.MM.yyyy"
                className="w-full min-w-0"
              />
            </div>
          </div>
        </div>

        {/* Table with Total Row */}
        <div className="border-border bg-border w-full overflow-x-auto rounded-b-xl border border-t-0 shadow-sm">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="bg-card">
                {columns.map((column, index) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`text-foreground h-[49px] px-3 text-xs font-medium sm:px-6 ${
                      column.align === 'center'
                        ? 'text-center'
                        : column.align === 'right'
                          ? 'text-right'
                          : 'text-left'
                    } ${index < columns.length - 1 ? 'border-border border-r' : ''}`}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, rowIndex) => (
                  <tr
                    key={`skeleton-row-${rowIndex}`}
                    className={rowIndex % 2 === 0 ? 'bg-muted' : 'bg-card'}
                  >
                    {columns.map((_, colIndex) => (
                      <td
                        key={`skeleton-col-${colIndex}`}
                        className={`h-[49px] px-3 sm:px-6 ${
                          colIndex < columns.length - 1 ? 'border-border border-r' : ''
                        }`}
                      >
                        <div
                          className={`bg-muted h-4 animate-pulse rounded ${
                            colIndex === 0
                              ? 'w-[60%]'
                              : colIndex === columns.length - 1
                                ? 'ml-auto w-[40%]'
                                : 'mx-auto w-[70%]'
                          }`}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="text-foreground h-[49px] px-3 text-center text-xs font-medium sm:px-6"
                  >
                    {t('pages.reports.agentPerformance.noData')}
                  </td>
                </tr>
              ) : (
                <>
                  {filteredData.map((item, rowIndex) => (
                    <tr
                      key={item.id}
                      className={`transition-colors ${rowIndex % 2 === 0 ? 'bg-muted' : 'bg-card'}`}
                    >
                      {columns.map((column, colIndex) => (
                        <td
                          key={column.key}
                          className={`text-foreground h-[49px] px-3 text-xs font-medium sm:px-6 ${
                            column.align === 'center'
                              ? 'text-center'
                              : column.align === 'right'
                                ? 'text-right'
                                : 'text-left'
                          } ${colIndex < columns.length - 1 ? 'border-border border-r' : ''}`}
                        >
                          {column.render
                            ? column.render(item)
                            : String(
                                (item as unknown as Record<string, unknown>)[column.key] ?? ''
                              )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr className="bg-muted">
                    <td className="text-foreground border-border h-[49px] border-r px-3 text-left text-xs font-semibold sm:px-6">
                      {t('pages.reports.tableHeaders.total')}
                    </td>
                    <td className="text-foreground border-border h-[49px] border-r px-3 text-center text-xs font-semibold sm:px-6">
                      {totals.calls}
                    </td>
                    <td className="text-foreground border-border h-[49px] border-r px-3 text-center text-xs font-semibold sm:px-6">
                      {totals.contactRate}%
                    </td>
                    <td className="text-foreground border-border h-[49px] border-r px-3 text-center text-xs font-semibold sm:px-6">
                      {totals.avgDuration}
                    </td>
                    <td className="text-foreground border-border h-[49px] border-r px-3 text-center text-xs font-semibold sm:px-6">
                      {totals.sms}
                    </td>
                    <td className="text-foreground border-border h-[49px] border-r px-3 text-center text-xs font-semibold sm:px-6">
                      {totals.messages}
                    </td>
                    <td className="text-foreground h-[49px] px-3 text-right text-xs font-semibold sm:px-6">
                      {formatCurrency(totals.payments)} {t('pages.reports.currencySymbol')}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
