/**
 * Admin Global Interaction Log — shows all ta_interactions across all
 * clients with advanced filtering, search, pagination, and CSV export.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { useTAInteractions } from '@/features/taInteractions/hooks/useTAInteractions'
import { useTAChains } from '@/features/taChains/hooks/useTAChains'
import type { TAInteraction } from '@/features/taInteractions/api/types'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { formatMoneyKopeckTight } from '@/lib/formatters'
import api from '@/lib/api'

export function InteractionLogPage() {
  const { t } = useTranslation('common')

  const [chainFilter, setChainFilter] = useState<string>('')
  const [clientSearch, setClientSearch] = useState('')
  const [notesSearch, setNotesSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 25

  const { data: chainsData } = useTAChains({ include_inactive: true })
  const chains = chainsData?.items ?? []

  const clientId = clientSearch ? parseInt(clientSearch, 10) || undefined : undefined

  const { data, isLoading } = useTAInteractions({
    client_id: clientId,
    chain_id: chainFilter ? parseInt(chainFilter, 10) : undefined,
    notes_search: notesSearch || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo ? `${dateTo}T23:59:59` : undefined,
    skip: page * pageSize,
    limit: pageSize,
  })

  const items = data?.items ?? []
  const totalCount = data?.total_count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const handleExport = async () => {
    const params = new URLSearchParams()
    if (clientId) params.set('client_id', String(clientId))
    if (chainFilter) params.set('chain_id', chainFilter)
    if (notesSearch) params.set('notes_search', notesSearch)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', `${dateTo}T23:59:59`)

    const resp = await api.get('/api/v1/ta-interactions/export', {
      params,
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(new Blob([resp.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = 'ta_interactions_export.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const columns: Column<TAInteraction>[] = [
    {
      key: 'created_at',
      header: t('pages.interactionLog.columns.date'),
      align: 'left',
      render: (row) => (
        <span className="text-xs text-gray-700">{new Date(row.created_at).toLocaleString()}</span>
      ),
    },
    {
      key: 'client_id',
      header: t('pages.interactionLog.columns.clientId'),
      align: 'left',
      render: (row) => (
        <a
          href={`/dashboard/clients/${row.client_id}`}
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          #{row.client_id}
        </a>
      ),
    },
    {
      key: 'chain_name',
      header: t('pages.interactionLog.columns.chain'),
      align: 'left',
      render: (row) => <span className="text-xs text-gray-800">{row.chain_name ?? '-'}</span>,
    },
    {
      key: 'dictionary_path',
      header: t('pages.interactionLog.columns.dictionaryPath'),
      align: 'left',
      render: (row) => {
        const base = row.dictionary_path.length > 0 ? row.dictionary_path.join(' > ') : '-'
        // Promise date/amount live as top-level interaction fields. Surface
        // them inside the result so the dedicated columns aren't needed.
        const promiseSuffix: string[] = []
        if (row.promise_date) {
          promiseSuffix.push(
            `${t('pages.interactionLog.columns.promiseDate')}: ${new Date(row.promise_date).toLocaleDateString()}`
          )
        }
        if (row.promise_amount) {
          promiseSuffix.push(
            `${t('pages.interactionLog.columns.promiseAmount')}: ${formatMoneyKopeckTight(row.promise_amount)}`
          )
        }
        const suffix = promiseSuffix.length > 0 ? ` — ${promiseSuffix.join(', ')}` : ''
        return (
          <span className="text-xs text-gray-700">
            {base}
            {suffix}
          </span>
        )
      },
    },
    {
      key: 'credit_id',
      header: t('pages.interactionLog.columns.creditNumber'),
      align: 'left',
      render: (row) => (
        <span className="text-xs text-gray-700">{row.credit_id ? `#${row.credit_id}` : '-'}</span>
      ),
    },
    {
      key: 'notes',
      header: t('pages.interactionLog.columns.notes'),
      align: 'left',
      render: (row) => (
        <span className="text-xs text-gray-600">
          {row.notes ? (row.notes.length > 40 ? row.notes.slice(0, 40) + '...' : row.notes) : '-'}
        </span>
      ),
    },
    {
      key: 'recorded_by_name',
      header: t('pages.interactionLog.columns.operator'),
      align: 'left',
      render: (row) => <span className="text-xs text-gray-600">{row.recorded_by_name ?? '-'}</span>,
    },
  ]

  return (
    <div className="flex w-full flex-col items-start gap-4">
      <div className="flex w-full items-center justify-between">
        <h1 className="text-dark-500 text-2xl font-light">{t('pages.interactionLog.title')}</h1>
        <Button variant="cancel" size="sm" onClick={handleExport}>
          {t('pages.interactionLog.export')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex w-full flex-wrap items-end gap-3">
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-gray-500">
            {t('pages.interactionLog.filters.clientId')}
          </label>
          <Input
            type="text"
            className="h-8 w-32 text-xs"
            placeholder={t('pages.interactionLog.filters.clientIdPlaceholder')}
            value={clientSearch}
            onChange={(e) => {
              setClientSearch(e.target.value)
              setPage(0)
            }}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-gray-500">
            {t('pages.interactionLog.filters.chain')}
          </label>
          <Select
            value={chainFilter}
            onValueChange={(v) => {
              setChainFilter(v === 'all' ? '' : v)
              setPage(0)
            }}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder={t('pages.interactionLog.filters.allChains')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.interactionLog.filters.allChains')}</SelectItem>
              {chains.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-gray-500">
            {t('pages.interactionLog.filters.from')}
          </label>
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setPage(0)
            }}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-gray-500">
            {t('pages.interactionLog.filters.to')}
          </label>
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setPage(0)
            }}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-gray-500">
            {t('pages.interactionLog.filters.notes')}
          </label>
          <Input
            type="text"
            className="h-8 w-48 text-xs"
            placeholder={t('pages.interactionLog.filters.notesPlaceholder')}
            value={notesSearch}
            onChange={(e) => {
              setNotesSearch(e.target.value)
              setPage(0)
            }}
          />
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <TableSkeleton columns={7} rows={5} />
      ) : items.length === 0 ? (
        <div className="w-full rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          {t('pages.interactionLog.empty')}
        </div>
      ) : (
        <DataTable columns={columns} data={items} className="w-full" />
      )}

      {/* Pagination */}
      {totalCount > pageSize && (
        <div className="flex w-full items-center justify-between text-xs text-gray-600">
          <span>
            {t('pages.interactionLog.pagination.rangeOfTotal', {
              start: page * pageSize + 1,
              end: Math.min((page + 1) * pageSize, totalCount),
              total: totalCount,
            })}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border px-2 py-1 disabled:opacity-30"
              aria-label={t('pages.interactionLog.pagination.previousPage')}
            >
              &lt;
            </button>
            <span className="px-1">
              {t('pages.interactionLog.pagination.pageOfPages', {
                page: page + 1,
                totalPages,
              })}
            </span>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border px-2 py-1 disabled:opacity-30"
              aria-label={t('pages.interactionLog.pagination.nextPage')}
            >
              &gt;
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default InteractionLogPage
