/**
 * Enhanced TA Interaction history for client card.
 * Shows full dictionary path, filters by date/chain/notes, pagination.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { useClientTAInteractions } from '@/features/taInteractions/hooks/useTAInteractions'
import { useTAChains } from '@/features/taChains/hooks/useTAChains'
import { useTargetActions } from '@/features/targetActions/hooks/useTargetActions'
import type { TargetAction } from '@/features/targetActions/api/types'
import type { TAInteraction } from '@/features/taInteractions/api/types'
import { TableSkeleton } from '@/components/ui/TableSkeleton'

interface Props {
  clientId: number
  debts?: Array<{
    id: number
    contract_number?: string
  }>
}

export function TAInteractionHistory({ clientId, debts = [] }: Props) {
  // Map debt ID → contract number for display
  const debtContractMap = new Map(debts.map((d) => [d.id, d.contract_number ?? `#${d.id}`]))
  const { t } = useTranslation('common')

  // Filters
  const [chainFilter, setChainFilter] = useState<string>('')
  const [notesSearch, setNotesSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 10

  const { data: chainsData } = useTAChains({ include_inactive: true })
  const chains = chainsData?.items ?? []

  // TA lookup for identifying credit-type steps
  const { data: tasData } = useTargetActions({ include_hidden: true })
  const taById = useMemo(() => {
    const m = new Map<number, TargetAction>()
    for (const ta of tasData?.items ?? []) m.set(ta.id, ta)
    return m
  }, [tasData])

  const { data, isLoading } = useClientTAInteractions(clientId, {
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

  const columns: Column<TAInteraction>[] = [
    {
      key: 'created_at',
      header: t('pages.clientChains.history.date'),
      align: 'left',
      render: (row) => (
        <span className="text-xs text-gray-700">{new Date(row.created_at).toLocaleString()}</span>
      ),
    },
    {
      key: 'chain_name',
      header: t('pages.clientChains.history.chain'),
      align: 'left',
      render: (row) => (
        <span className="text-xs font-medium text-gray-800">{row.chain_name ?? '-'}</span>
      ),
    },
    {
      key: 'result',
      header: t('pages.clientChains.history.result'),
      align: 'left',
      render: (row) => {
        // Show all step values from step_data, ordered by chain step_order
        if (row.step_data && Object.keys(row.step_data).length > 0) {
          const chain = chains.find((c) => c.id === row.chain_id)
          const stepsOrdered = chain?.steps
            ? [...chain.steps].sort((a, b) => a.step_order - b.step_order)
            : []
          // Build ordered values: walk steps in order
          const orderedValues: string[] = []
          if (stepsOrdered.length > 0) {
            for (const step of stepsOrdered) {
              const val = (row.step_data as Record<string, string>)[String(step.target_action_id)]
              if (val) orderedValues.push(val)
            }
          } else {
            orderedValues.push(
              ...Object.values(row.step_data as Record<string, string>).filter(Boolean)
            )
          }
          if (orderedValues.length > 0) {
            return <span className="text-xs text-gray-700">{orderedValues.join(' -> ')}</span>
          }
        }
        // Fallback to single dropdown_value_name or legacy dictionary_path
        return (
          <span className="text-xs text-gray-700">
            {row.dropdown_value_name ??
              (row.dictionary_path.length > 0 ? row.dictionary_path.join(' > ') : '-')}
          </span>
        )
      },
    },
    {
      key: 'promise_date',
      header: t('pages.clientChains.history.promiseDate'),
      align: 'left',
      render: (row) => (
        <span className="text-xs text-gray-700">
          {row.promise_date ? new Date(row.promise_date).toLocaleDateString() : '-'}
        </span>
      ),
    },
    {
      key: 'promise_amount',
      header: t('pages.clientChains.history.promiseAmount'),
      align: 'left',
      render: (row) => <span className="text-xs text-gray-700">{row.promise_amount ?? '-'}</span>,
    },
    {
      key: 'credit_id',
      header: t('pages.clientChains.history.credit'),
      align: 'left',
      render: (row) => {
        // Collect credit IDs from: credit_id field + credit-type steps in step_data
        const creditIds: string[] = []
        if (row.credit_id) {
          creditIds.push(debtContractMap.get(row.credit_id) ?? `#${row.credit_id}`)
        }
        // Check step_data for credit-type step values
        if (row.step_data) {
          const chain = chains.find((c) => c.id === row.chain_id)
          const stepsOrdered = chain?.steps ?? []
          for (const step of stepsOrdered) {
            const ta = taById.get(step.target_action_id)
            if (ta?.field_type === 'credit') {
              const val = (row.step_data as Record<string, string>)[String(step.target_action_id)]
              if (val) {
                // val is comma-separated credit IDs like "125844,55138"
                for (const id of val.split(',')) {
                  const numId = parseInt(id.trim(), 10)
                  if (!Number.isNaN(numId)) {
                    creditIds.push(debtContractMap.get(numId) ?? `#${numId}`)
                  }
                }
              }
            }
          }
        }
        return (
          <span className="text-xs text-gray-700">
            {creditIds.length > 0 ? creditIds.join(', ') : '-'}
          </span>
        )
      },
    },
    {
      key: 'notes',
      header: t('pages.clientChains.history.notes'),
      align: 'left',
      render: (row) => (
        <span className="text-xs text-gray-600">
          {row.notes ? (row.notes.length > 50 ? row.notes.slice(0, 50) + '...' : row.notes) : '-'}
        </span>
      ),
    },
    {
      key: 'recorded_by_name',
      header: t('pages.clientChains.history.operator'),
      align: 'left',
      render: (row) => <span className="text-xs text-gray-600">{row.recorded_by_name ?? '-'}</span>,
    },
  ]

  if (isLoading && page === 0) return <TableSkeleton columns={6} rows={3} />

  return (
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-gray-500">
            {t('pages.clientChains.history.filterChain')}
          </label>
          <Select
            value={chainFilter}
            onValueChange={(v) => {
              setChainFilter(v === 'all' ? '' : v)
              setPage(0)
            }}
          >
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder={t('pages.clientChains.history.allChains')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.clientChains.history.allChains')}</SelectItem>
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
            {t('pages.clientChains.history.from')}
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
          <label className="text-[10px] text-gray-500">{t('pages.clientChains.history.to')}</label>
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
            {t('pages.clientChains.history.searchNotes')}
          </label>
          <Input
            type="text"
            className="h-8 w-44 text-xs"
            placeholder={t('pages.clientChains.history.searchNotesPlaceholder')}
            value={notesSearch}
            onChange={(e) => {
              setNotesSearch(e.target.value)
              setPage(0)
            }}
          />
        </div>
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <p className="py-4 text-center text-xs text-gray-500">
          {t('pages.clientChains.history.empty')}
        </p>
      ) : (
        <DataTable columns={columns} data={items} className="w-full" />
      )}

      {/* Pagination */}
      {totalCount > pageSize && (
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} / {totalCount}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border px-2 py-1 disabled:opacity-30"
            >
              &lt;
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border px-2 py-1 disabled:opacity-30"
            >
              &gt;
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
