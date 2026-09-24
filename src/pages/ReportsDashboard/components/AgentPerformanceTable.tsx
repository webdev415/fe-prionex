/**
 * AgentPerformanceTable Component
 *
 * Table displaying agent performance metrics with filters.
 */

import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { intlLocaleForUiLanguage } from '@/lib/i18n'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { LinkButton } from '@/components/ui/LinkButton'
import { Icons } from '@/lib/icons'
import type { Period } from '../types'
import { formatIsoDate, withCurrency } from '@/lib/formatters'
import { computeAgentPerformanceTotals } from '@/features/report/utils/dashboardMetrics'

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
 * Human-readable window shown in the read-only «Період» field: one date for a
 * single day, "from – to" otherwise. Inputs are the YYYY-MM-DD strings the
 * page queries with, so what the user reads is exactly the queried window.
 */
function formatPeriodWindow(fromDate: string, toDate: string): string {
  if (!fromDate && !toDate) return '—'
  if (!toDate || fromDate === toDate) return formatIsoDate(fromDate)
  if (!fromDate) return formatIsoDate(toDate)
  return `${formatIsoDate(fromDate)} – ${formatIsoDate(toDate)}`
}

export interface AgentPerformance {
  id: string
  operator: string
  calls: number
  contactRate: number
  avgDuration: string
  /** Answered calls; when absent the totals derive it from calls × rate. */
  callsAnswered?: number
  /** Talk time in seconds; when absent the totals derive it from avg × answered. */
  totalTalkTime?: number
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
  /**
   * Window the table (and the KPI cards) are queried for, YYYY-MM-DD in the
   * user's profile time zone. Shown read-only — the period tabs drive it.
   */
  fromDate: string
  toDate: string
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
  fromDate,
  toDate,
}: AgentPerformanceTableProps) {
  const { t, i18n } = useTranslation('common')

  const periodText = formatPeriodWindow(fromDate, toDate)

  // Get unique operators for filter (map to their IDs)
  const operators = useMemo(
    () =>
      Array.from(new Set(data.map((item) => ({ id: item.id, name: item.operator })))).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [data]
  )

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
          {withCurrency(formatCurrency(item.payments), 'suffix')}
        </span>
      ),
    },
  ]

  // Weighted totals: rate = Σanswered / Σcalls, avg duration = Σtalk / Σanswered
  // (never the plain mean of the row values — a 0-call row would drag it down).
  // Operator and date filtering happen on the API side, so the rows are summed as-is.
  const totals = useMemo(() => computeAgentPerformanceTotals(data), [data])

  const handleExport = () => {
    const exportData = data.map((item) => ({
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
          {t('pages.reports.agentPerformance.title', { count: data.length })}
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
          {/* Read-only: the period tabs above choose the window. Two disabled
              date pickers used to sit here and looked like a broken filter. */}
          <div className="flex w-full min-w-0 flex-col items-start justify-center gap-1 xl:flex-1">
            <span className="text-foreground text-xs leading-[140%] font-medium tracking-[-0.24px]">
              {t('pages.reports.filters.period')}
            </span>
            <div
              data-testid="agent-performance-period"
              className="border-input-border bg-muted text-foreground flex h-[45px] w-full items-center rounded-lg border px-4 text-sm font-light"
            >
              {periodText}
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
              ) : data.length === 0 ? (
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
                  {data.map((item, rowIndex) => (
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
                      {withCurrency(formatCurrency(totals.payments), 'suffix')}
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
