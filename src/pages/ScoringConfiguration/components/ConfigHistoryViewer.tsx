/**
 * Config History Viewer Component
 *
 * Displays configuration change history with filters and export functionality.
 * Shows before/after comparison for each change.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import {
  configApi,
  type ConfigHistoryEntry,
  type ConfigHistoryListResponse,
} from '@/features/clients/api/configApi'

interface ConfigHistoryViewerProps {
  sellers: Array<{ id: number; name: string }>
}

export function ConfigHistoryViewer({ sellers }: ConfigHistoryViewerProps) {
  const { t } = useTranslation('common')

  // State
  const [history, setHistory] = useState<ConfigHistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20

  // Filters
  const [sellerFilter, setSellerFilter] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Load history on mount and when filters change
  useEffect(() => {
    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sellerFilter, startDate, endDate])

  const loadHistory = async () => {
    try {
      setIsLoading(true)
      const params: {
        page: number
        page_size: number
        seller_id?: number
        start_date?: string
        end_date?: string
      } = {
        page,
        page_size: pageSize,
      }

      if (sellerFilter) {
        params.seller_id = Number(sellerFilter)
      }
      if (startDate) {
        params.start_date = startDate
      }
      if (endDate) {
        params.end_date = endDate
      }

      const response: ConfigHistoryListResponse = await configApi.getConfigHistory(params)
      setHistory(response.history)
      setTotalCount(response.total_count)
    } catch (error) {
      console.error('Failed to load history:', error)
      toast.error(
        t('pages.scoringConfiguration.historyLoadFailed', 'Failed to load configuration history')
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      setIsExporting(true)

      const params: {
        seller_id?: number
        start_date?: string
        end_date?: string
      } = {}

      if (sellerFilter) {
        params.seller_id = Number(sellerFilter)
      }
      if (startDate) {
        params.start_date = startDate
      }
      if (endDate) {
        params.end_date = endDate
      }

      const blob = await configApi.exportConfigHistory(params)

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `config-history-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success(t('pages.scoringConfiguration.exportSuccess', 'History exported successfully'))
    } catch (error) {
      console.error('Export failed:', error)
      toast.error(t('pages.scoringConfiguration.exportFailed', 'Failed to export history'))
    } finally {
      setIsExporting(false)
    }
  }

  const handleReset = () => {
    setSellerFilter('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const sellerOptions = [
    { value: '', label: t('common.all', 'All Sellers') },
    ...sellers.map((seller) => ({
      value: seller.id.toString(),
      label: seller.name,
    })),
  ]

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <div className="bg-light-100 rounded-lg p-4">
        <h4 className="text-dark-500 mb-4 text-sm font-semibold">
          {t('pages.scoringConfiguration.filters', 'Filters')}
        </h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="text-dark-500 mb-2 block text-xs font-medium">
              {t('pages.scoringConfiguration.seller', 'Seller')}
            </label>
            <Select value={sellerFilter} onValueChange={setSellerFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('common.all', 'All Sellers')} />
              </SelectTrigger>
              <SelectContent>
                {sellerOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-dark-500 mb-2 block text-xs font-medium">
              {t('pages.scoringConfiguration.startDate', 'Start Date')}
            </label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div>
            <label className="text-dark-500 mb-2 block text-xs font-medium">
              {t('pages.scoringConfiguration.endDate', 'End Date')}
            </label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          <div className="flex items-end gap-2">
            <Button variant="secondary" onClick={handleReset} className="flex-1">
              {t('common.reset', 'Reset')}
            </Button>
            <Button onClick={handleExport} disabled={isExporting} className="flex-1">
              <Icons.Download size={16} />
              {isExporting
                ? t('common.exporting', 'Exporting...')
                : t('common.export', 'Export CSV')}
            </Button>
          </div>
        </div>
      </div>

      {/* History Timeline */}
      {isLoading ? (
        <div className="text-dark-400 text-center text-sm">{t('common.loading', 'Loading...')}</div>
      ) : history.length === 0 ? (
        <div className="bg-light-100 text-dark-400 rounded-lg p-6 text-center text-sm">
          {t(
            'pages.scoringConfiguration.noHistory',
            'No configuration changes found for the selected filters.'
          )}
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {history.map((entry) => (
              <div
                key={entry.history_id}
                className="border-light-200 bg-light-50 rounded-lg border p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          entry.change_type === 'create'
                            ? 'bg-green-100 text-green-700'
                            : entry.change_type === 'update'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {entry.change_type.toUpperCase()}
                      </span>
                      {entry.seller_id && (
                        <span className="text-dark-400 text-xs">
                          Seller:{' '}
                          {sellers.find((s) => s.id === entry.seller_id)?.name ||
                            `ID ${entry.seller_id}`}
                        </span>
                      )}
                    </div>

                    <div className="text-dark-500 mb-1 text-sm font-medium">
                      Changed by: {entry.changed_by_username}
                    </div>
                    <div className="text-dark-400 mb-2 text-xs">
                      {new Date(entry.changed_at).toLocaleString()}
                    </div>

                    {entry.change_reason && (
                      <div className="text-dark-400 mb-3 text-sm italic">
                        Reason: {entry.change_reason}
                      </div>
                    )}

                    {/* Before/After Comparison */}
                    {entry.before_config && entry.after_config && (
                      <div className="mt-3 grid grid-cols-2 gap-4">
                        <div className="bg-light-100 rounded p-3">
                          <div className="text-dark-300 mb-2 text-xs font-semibold uppercase">
                            {t('pages.scoringConfiguration.before', 'Before')}
                          </div>
                          <pre className="text-dark-500 text-xs whitespace-pre-wrap">
                            {JSON.stringify(entry.before_config, null, 2)}
                          </pre>
                        </div>
                        <div className="bg-light-100 rounded p-3">
                          <div className="text-dark-300 mb-2 text-xs font-semibold uppercase">
                            {t('pages.scoringConfiguration.after', 'After')}
                          </div>
                          <pre className="text-dark-500 text-xs whitespace-pre-wrap">
                            {JSON.stringify(entry.after_config, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-dark-400 text-sm">
                {t(
                  'pages.scoringConfiguration.showingResults',
                  'Showing {{start}} to {{end}} of {{total}} results',
                  {
                    start: (page - 1) * pageSize + 1,
                    end: Math.min(page * pageSize, totalCount),
                    total: totalCount,
                  }
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  {t('common.previous', 'Previous')}
                </Button>
                <span className="text-dark-500 flex items-center px-4 text-sm">
                  {t('common.page', 'Page')} {page} / {totalPages}
                </span>
                <Button
                  variant="secondary"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  {t('common.next', 'Next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
