/**
 * AgentPerformanceTable Component
 *
 * Table displaying agent performance metrics with filters.
 */

import { useState, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
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
  payments: number
}

export interface AgentPerformanceTableProps {
  data: AgentPerformance[]
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
    const locale = i18n.language === 'uk' ? 'uk-UA' : i18n.language === 'ru' ? 'ru-RU' : 'en-US'
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
      render: (item) => <span className="text-dark-500 text-xs font-medium">{item.operator}</span>,
    },
    {
      key: 'calls',
      header: t('pages.reports.tableHeaders.calls'),
      align: 'center',
      render: (item) => <span className="text-dark-500 text-xs font-medium">{item.calls}</span>,
    },
    {
      key: 'contactRate',
      header: t('pages.reports.tableHeaders.contactRate'),
      align: 'center',
      render: (item) => (
        <span className="text-dark-500 text-xs font-medium">{item.contactRate}%</span>
      ),
    },
    {
      key: 'avgDuration',
      header: t('pages.reports.tableHeaders.avgDuration'),
      align: 'center',
      render: (item) => (
        <span className="text-dark-500 text-xs font-medium">{item.avgDuration}</span>
      ),
    },
    {
      key: 'sms',
      header: t('pages.reports.tableHeaders.sms'),
      align: 'center',
      render: (item) => <span className="text-dark-500 text-xs font-medium">{item.sms}</span>,
    },
    {
      key: 'payments',
      header: t('pages.reports.tableHeaders.payments'),
      align: 'right',
      render: (item) => (
        <span className="text-dark-500 text-xs font-medium">
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
      Payments: item.payments,
    }))

    // Add totals row
    exportData.push({
      Operator: 'Total',
      Calls: totals.calls,
      'Contact Rate (%)': totals.contactRate,
      'Avg Duration': totals.avgDuration,
      SMS: totals.sms,
      Payments: totals.payments,
    })

    const filename = `operator_performance_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.csv`
    exportToCSV(exportData, filename)
  }

  return (
    <div className="flex min-h-[730px] flex-1 flex-col items-start gap-3 self-stretch rounded-xl bg-white/50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between self-stretch">
        <span className="text-dark-500 text-base leading-[155%] font-medium tracking-[-0.32px]">
          {t('pages.reports.agentPerformance.title', { count: filteredData.length })}
        </span>
        <LinkButton
          variant="regular-secondary"
          size="xs"
          onClick={handleExport}
          rightIcon={<Icons.ArrowRight size={20} />}
        >
          {t('pages.reports.agentPerformance.exportTable')}
        </LinkButton>
      </div>

      <div className="flex flex-1 flex-col items-start self-stretch">
        {/* Filters */}
        <div className="flex items-start gap-5 self-stretch rounded-t-xl border border-[#EBECE8] bg-white p-4">
          <div className="flex flex-1 flex-col items-start justify-center gap-1">
            <Label
              htmlFor="responsible-operator"
              required
              className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]"
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
          <div className="flex flex-1 flex-col items-start justify-center gap-1">
            <Label
              htmlFor="client-phone"
              required
              className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]"
            >
              {t('pages.reports.filters.clientPhone')}
            </Label>
            <Input
              type="text"
              id="client-phone"
              placeholder={t('pages.reports.filters.typePhoneNumber')}
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
            />
          </div>
          <div className="flex flex-col items-start justify-center gap-1 self-stretch">
            <span className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
              {t('pages.reports.filters.dateOfSale')}
            </span>
            <div className="flex items-center gap-3">
              <DateSelect
                key={`date-from-${selectedPeriod}`}
                disabled={true} // Disable manual date selection when period is selected
                value={dateRange.from}
                onChange={({ value }) => {
                  onFromDateChange(value ? getDateStringInTimezone(value, userTimezone) : null)
                }}
              />
              <span className="text-base leading-[155%] font-medium tracking-[-0.32px] text-gray-700">
                -
              </span>
              <DateSelect
                key={`date-to-${selectedPeriod}`}
                disabled={true} // Disable manual date selection when period is selected
                value={dateRange.to}
                onChange={({ value }) => {
                  onToDateChange(value ? getDateStringInTimezone(value, userTimezone) : null)
                }}
              />
            </div>
          </div>
        </div>

        {/* Table with Total Row */}
        <div className="w-full overflow-hidden rounded-b-xl border border-t-0 border-[#EBECE8] bg-[#EBECE8] shadow-sm">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-white">
                {columns.map((column, index) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`h-[49px] px-6 text-xs font-medium text-[#05040D] ${
                      column.align === 'center'
                        ? 'text-center'
                        : column.align === 'right'
                          ? 'text-right'
                          : 'text-left'
                    } ${index < columns.length - 1 ? 'border-r border-[#EBECE8]' : ''}`}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="text-dark-500 h-[49px] px-6 text-center text-xs font-medium"
                  >
                    {t('pages.reports.agentPerformance.noData')}
                  </td>
                </tr>
              ) : (
                <>
                  {filteredData.map((item, rowIndex) => (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        rowIndex % 2 === 0 ? 'bg-[#F2F3F0]' : 'bg-white'
                      }`}
                    >
                      {columns.map((column, colIndex) => (
                        <td
                          key={column.key}
                          className={`text-dark-500 h-[49px] px-6 text-xs font-medium ${
                            column.align === 'center'
                              ? 'text-center'
                              : column.align === 'right'
                                ? 'text-right'
                                : 'text-left'
                          } ${colIndex < columns.length - 1 ? 'border-r border-[#EBECE8]' : ''}`}
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
                  <tr className="bg-[#F2F3F0]">
                    <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-left text-xs font-semibold">
                      {t('pages.reports.tableHeaders.total')}
                    </td>
                    <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-center text-xs font-semibold">
                      {totals.calls}
                    </td>
                    <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-center text-xs font-semibold">
                      {totals.contactRate}%
                    </td>
                    <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-center text-xs font-semibold">
                      {totals.avgDuration}
                    </td>
                    <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-center text-xs font-semibold">
                      {totals.sms}
                    </td>
                    <td className="text-dark-500 h-[49px] px-6 text-right text-xs font-semibold">
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
