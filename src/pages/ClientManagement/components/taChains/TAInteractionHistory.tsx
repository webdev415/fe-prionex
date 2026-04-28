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
import {
  useClientTAInteractions,
  useTogglePinTAInteraction,
} from '@/features/taInteractions/hooks/useTAInteractions'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { useTAChains } from '@/features/taChains/hooks/useTAChains'
import { useTargetActions } from '@/features/targetActions/hooks/useTargetActions'
import type { TargetAction } from '@/features/targetActions/api/types'
import type { TAInteraction } from '@/features/taInteractions/api/types'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { formatDate, formatDateTime, formatMoneyKopeckTight } from '@/lib/formatters'
import { Icons } from '@/lib/icons'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { EditTAInteractionModal } from './EditTAInteractionModal'

interface Props {
  clientId: number
  debts?: Array<{
    id: number
    contract_number?: string
  }>
}

export function TAInteractionHistory({ clientId, debts = [] }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null)
  // Map debt ID → contract number for display
  const debtContractMap = new Map(debts.map((d) => [d.id, `#${d.contract_number ?? d.id}`]))
  const { t } = useTranslation('common')
  const togglePinMut = useTogglePinTAInteraction()
  const handleTogglePin = async (id: number) => {
    try {
      await togglePinMut.mutateAsync(id)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

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
        const formatStepValue = (fieldType: string | undefined, val: string): string => {
          if (fieldType === 'credit') {
            return val
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .map((id) => {
                const numId = parseInt(id, 10)
                if (Number.isNaN(numId)) return id
                return debtContractMap.get(numId) ?? `#${numId}`
              })
              .join(', ')
          }
          if (fieldType === 'amount') return formatMoneyKopeckTight(val)
          if (fieldType === 'date') return formatDateTime(val)
          return val
        }

        // Build step entries in chain order. Each dropdown step that
        // requested follow-ups gets them inline as `(date, amount, credit)`.
        const entries: { value: string; followUps: string[] }[] = []
        let consumedPromiseDate = false
        let consumedPromiseAmount = false
        let consumedCredit = false

        if (row.step_data && Object.keys(row.step_data).length > 0) {
          const chain = chains.find((c) => c.id === row.chain_id)
          const stepsOrdered = chain?.steps
            ? [...chain.steps].sort((a, b) => a.step_order - b.step_order)
            : []

          if (stepsOrdered.length > 0) {
            for (const step of stepsOrdered) {
              const val = (row.step_data as Record<string, string>)[String(step.target_action_id)]
              if (!val) continue
              const ta = taById.get(step.target_action_id)
              const followUps: string[] = []

              // Attach top-level promise/credit fields to the dropdown step
              // whose picked value triggered them (matched via require_* flags).
              if (ta?.field_type === 'dropdown') {
                const picked = ta.dropdown_values.find((dv) => dv.value === val)
                if (picked) {
                  if (picked.require_promise_date && row.promise_date && !consumedPromiseDate) {
                    followUps.push(formatDate(row.promise_date))
                    consumedPromiseDate = true
                  }
                  if (
                    picked.require_promise_amount &&
                    row.promise_amount &&
                    !consumedPromiseAmount
                  ) {
                    followUps.push(formatMoneyKopeckTight(row.promise_amount))
                    consumedPromiseAmount = true
                  }
                  if (picked.require_credit && row.credit_id && !consumedCredit) {
                    followUps.push(debtContractMap.get(row.credit_id) ?? `#${row.credit_id}`)
                    consumedCredit = true
                  }
                }
              }

              entries.push({ value: formatStepValue(ta?.field_type, val), followUps })
            }
          } else {
            for (const [, val] of Object.entries(row.step_data as Record<string, string>)) {
              if (val) entries.push({ value: val, followUps: [] })
            }
          }
        }

        // Stragglers: follow-ups that didn't match any dropdown step
        // (legacy data, schema drift) — append to the last entry, or as a
        // standalone "()" if there were no steps at all.
        const orphan: string[] = []
        if (row.promise_date && !consumedPromiseDate) orphan.push(formatDate(row.promise_date))
        if (row.promise_amount && !consumedPromiseAmount) {
          orphan.push(formatMoneyKopeckTight(row.promise_amount))
        }
        if (row.credit_id && !consumedCredit) {
          orphan.push(debtContractMap.get(row.credit_id) ?? `#${row.credit_id}`)
        }
        if (orphan.length > 0) {
          if (entries.length > 0) {
            entries[entries.length - 1].followUps.push(...orphan)
          } else {
            entries.push({ value: '', followUps: orphan })
          }
        }

        if (entries.length === 0) {
          const fallback =
            row.dropdown_value_name ??
            (row.dictionary_path.length > 0 ? row.dictionary_path.join(' > ') : '-')
          return <span className="text-xs text-gray-700">{fallback}</span>
        }

        return (
          <span className="text-xs text-gray-700">
            {entries.map((e, i) => (
              <span key={i}>
                {e.value}
                {e.followUps.length > 0 && (
                  <span className="text-gray-500"> ({e.followUps.join(', ')})</span>
                )}
                {i < entries.length - 1 && ' -> '}
              </span>
            ))}
          </span>
        )
      },
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
    {
      key: 'pin',
      header: '',
      align: 'right',
      render: (row) => (
        <button
          type="button"
          onClick={() => handleTogglePin(row.id)}
          disabled={togglePinMut.isPending}
          className={`rounded p-1 transition-colors ${
            row.is_pinned
              ? 'text-amber-500 hover:bg-amber-50'
              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
          }`}
          aria-label={row.is_pinned ? t('actions.unpin', 'Unpin') : t('actions.pin', 'Pin')}
          title={row.is_pinned ? t('actions.unpin', 'Unpin') : t('actions.pin', 'Pin')}
        >
          <Icons.Pin size={14} strokeWidth={1.5} />
        </button>
      ),
    },
    {
      key: 'edit',
      header: '',
      align: 'right',
      render: (row) => (
        <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
          <button
            type="button"
            onClick={() => setEditingId(row.id)}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label={t('actions.edit')}
            title={t('actions.edit')}
          >
            <Icons.PencilEdit size={14} strokeWidth={1.5} />
          </button>
        </PermissionGuard>
      ),
    },
  ]

  if (isLoading && page === 0) return <TableSkeleton columns={8} rows={3} />

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

      <EditTAInteractionModal
        open={editingId !== null}
        interactionId={editingId}
        onClose={() => setEditingId(null)}
        debts={debts}
      />

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
