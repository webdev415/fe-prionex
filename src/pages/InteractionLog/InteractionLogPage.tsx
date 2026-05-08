/**
 * Admin Global Interaction Log — shows all ta_interactions across all
 * clients with advanced filtering, search, pagination, and CSV export.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import type { TAInteraction, TAInteractionListParams } from '@/features/taInteractions/api/types'
import { formatDateTime, formatMoneyKopeckTight } from '@/lib/formatters'
import { InteractionLogTableSkeleton } from './InteractionLogTableSkeleton'
import api from '@/lib/api'
import { Pagination } from '@/components/ui/Pagination'
import { DateSelect } from '@/components/ui/DateSelect'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'

function toIsoOrUndefined(v?: string, endOfDay = false): string | undefined {
  if (!v) return undefined
  const d = new Date(`${v}T00:00:00`)
  if (Number.isNaN(d.getTime())) return undefined
  return `${v}T${endOfDay ? '23:59:59.999' : '00:00:00'}`
}

/** Accepts plain digits or values copied from the UI like "#23426". */
function parseClientIdInput(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const digits = trimmed.startsWith('#') ? trimmed.slice(1).trim() : trimmed
  if (!/^\d+$/.test(digits)) return undefined
  const n = Number.parseInt(digits, 10)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return n
}

export function InteractionLogPage() {
  const { t, i18n } = useTranslation('common')
  const user = useAuthStore((s) => s.user)

  const [pendingFilters, setPendingFilters] = useState({
    clientId: '',
    chainFilter: '',
    notesSearch: '',
    dateFrom: '',
    dateTo: '',
  })
  const [appliedFilters, setAppliedFilters] = useState({
    clientId: '',
    chainFilter: '',
    notesSearch: '',
    dateFrom: '',
    dateTo: '',
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const { data: chainsData } = useTAChains({ include_inactive: true })
  const chains = chainsData?.items ?? []

  const appliedClientId = parseClientIdInput(appliedFilters.clientId)

  const listParams = useMemo((): TAInteractionListParams => {
    const p: TAInteractionListParams = {
      skip: (page - 1) * pageSize,
      limit: pageSize,
    }
    if (appliedClientId != null) p.client_id = appliedClientId

    if (appliedFilters.chainFilter) {
      const chainId = Number.parseInt(appliedFilters.chainFilter, 10)
      if (!Number.isNaN(chainId)) p.chain_id = chainId
    }
    if (appliedFilters.notesSearch.trim()) p.notes_search = appliedFilters.notesSearch.trim()

    const dateFrom = toIsoOrUndefined(appliedFilters.dateFrom, false)
    const dateTo = toIsoOrUndefined(appliedFilters.dateTo, true)
    if (dateFrom) p.date_from = dateFrom
    if (dateTo) p.date_to = dateTo
    return p
  }, [appliedFilters, appliedClientId, page, pageSize])

  const { data, isLoading } = useTAInteractions(listParams)

  const items = data?.items ?? []
  const totalCount = data?.total_count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const parseDateString = (value: string): Date | null => {
    if (!value) return null
    const [year, month, day] = value.split('-').map(Number)
    if (!year || !month || !day) return null
    return new Date(year, month - 1, day)
  }

  const formatDateString = (value: Date | null): string => {
    if (!value) return ''
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const handleApplyFilters = () => {
    setAppliedFilters(pendingFilters)
    setPage(1)
  }

  const handleClearFilters = () => {
    const cleared = {
      clientId: '',
      chainFilter: '',
      notesSearch: '',
      dateFrom: '',
      dateTo: '',
    }
    setPendingFilters(cleared)
    setAppliedFilters(cleared)
    setPage(1)
  }

  const dateInputFormat = i18n.language?.startsWith('en') ? 'MM/dd/yyyy' : 'dd/MM/yyyy'

  const handleExport = async () => {
    const params = new URLSearchParams()
    if (appliedClientId != null) params.set('client_id', String(appliedClientId))
    if (appliedFilters.chainFilter) params.set('chain_id', appliedFilters.chainFilter)
    if (appliedFilters.notesSearch) params.set('notes_search', appliedFilters.notesSearch)
    if (appliedFilters.dateFrom) params.set('date_from', `${appliedFilters.dateFrom}T00:00:00`)
    if (appliedFilters.dateTo) params.set('date_to', `${appliedFilters.dateTo}T23:59:59.999`)

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
        <span className="text-xs text-gray-700">
          {formatDateTime(row.created_at, user?.timezone)}
        </span>
      ),
    },
    {
      key: 'client_id',
      header: t('pages.interactionLog.columns.clientId'),
      align: 'left',
      render: (row) => (
        <Link
          to={`/dashboard/clients/${row.client_id}`}
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          #{row.client_id}
        </Link>
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
        const promiseSuffix: string[] = []
        if (row.promise_date) {
          promiseSuffix.push(
            `${t('pages.interactionLog.columns.promiseDate')}: ${formatDateTime(row.promise_date, user?.timezone)}`
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

      <div className="w-full rounded-xl bg-white/50 p-3 sm:p-4">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="flex flex-col gap-2">
              <label className="text-dark-500 text-xs leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.interactionLog.filters.clientId')}
              </label>
              <Input
                type="text"
                inputMode="numeric"
                className="max-h-[45px] w-full rounded-md border border-gray-200 bg-white text-xs"
                placeholder={t('pages.interactionLog.filters.clientIdPlaceholder')}
                value={pendingFilters.clientId}
                onChange={(e) =>
                  setPendingFilters((prev) => ({ ...prev, clientId: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-dark-500 text-xs leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.interactionLog.filters.chain')}
              </label>
              <Select
                value={pendingFilters.chainFilter || 'all'}
                onValueChange={(v) =>
                  setPendingFilters((prev) => ({ ...prev, chainFilter: v === 'all' ? '' : v }))
                }
              >
                <SelectTrigger className="max-h-[45px] w-full rounded-md border border-gray-200 bg-white text-xs">
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
            <div className="flex flex-col gap-2">
              <label className="text-dark-500 text-xs leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.interactionLog.filters.from')}
              </label>
              <DateSelect
                value={parseDateString(pendingFilters.dateFrom)}
                onChange={({ value }) =>
                  setPendingFilters((prev) => ({ ...prev, dateFrom: formatDateString(value) }))
                }
                max={parseDateString(pendingFilters.dateTo) || undefined}
                placeholder={t('pages.clientChains.history.selectStartDate')}
                format={dateInputFormat}
                className="[&_input]:h-[45px] [&_input]:rounded-md [&_input]:border-gray-200 [&_input]:text-xs [&_input]:font-normal"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-dark-500 text-xs leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.interactionLog.filters.to')}
              </label>
              <DateSelect
                value={parseDateString(pendingFilters.dateTo)}
                onChange={({ value }) =>
                  setPendingFilters((prev) => ({ ...prev, dateTo: formatDateString(value) }))
                }
                min={parseDateString(pendingFilters.dateFrom) || undefined}
                placeholder={t('pages.clientChains.history.selectEndDate')}
                format={dateInputFormat}
                className="[&_input]:h-[45px] [&_input]:rounded-md [&_input]:border-gray-200 [&_input]:text-xs [&_input]:font-normal"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-dark-500 text-xs leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.interactionLog.filters.notes')}
              </label>
              <Input
                type="text"
                className="max-h-[45px] w-full rounded-md border border-gray-200 bg-white text-xs"
                placeholder={t('pages.interactionLog.filters.notesPlaceholder')}
                value={pendingFilters.notesSearch}
                onChange={(e) =>
                  setPendingFilters((prev) => ({ ...prev, notesSearch: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="h-[45px] rounded sm:min-w-[160px]"
              onClick={handleApplyFilters}
            >
              {t('pages.clientChains.history.applyFilters')}
            </Button>
            <Button
              type="button"
              variant="white-secondary"
              className="h-[45px] rounded sm:min-w-[140px]"
              leftIcon={<Icons.Reload size={16} />}
              onClick={handleClearFilters}
            >
              {t('pages.clientChains.history.clearFilters')}
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <InteractionLogTableSkeleton rows={8} className="w-full" />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 self-stretch py-8 md:gap-6">
          <div className="flex flex-col items-center justify-center gap-4 self-stretch py-8 sm:flex-row md:gap-6">
            <Icons.FileRemove size={48} className="text-gray-500" strokeWidth={0.5} />
            <p className="text-dark-500 text-center text-xl leading-tight font-light tracking-[-0.48px] md:text-2xl">
              {t('pages.interactionLog.empty')}
            </p>
          </div>
        </div>
      ) : (
        <DataTable columns={columns} data={items} className="w-full" />
      )}

      {totalCount > 0 && (
        <div className="flex w-full items-center justify-center">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
          />
        </div>
      )}
    </div>
  )
}

export default InteractionLogPage
