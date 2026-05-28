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
  useDeleteTAInteraction,
  useTogglePinTAInteraction,
} from '@/features/taInteractions/hooks/useTAInteractions'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { useTAChains } from '@/features/taChains/hooks/useTAChains'
import { useTargetActions } from '@/features/targetActions/hooks/useTargetActions'
import { useOperators } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/stores/authStore'
import type { TargetAction } from '@/features/targetActions/api/types'
import type { TAInteraction } from '@/features/taInteractions/api/types'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { formatDate, formatDateTime, formatMoneyKopeckTight } from '@/lib/formatters'
import { Icons } from '@/lib/icons'
import { PERMISSIONS } from '@/constants/permissions'
import { useGuardedAction } from '@/hooks'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { DateSelect } from '@/components/ui/DateSelect'
import { EditTAInteractionModal } from './EditTAInteractionModal'

interface Props {
  clientId: number
  debts?: Array<{
    id: number
    contract_number?: string
  }>
}

function toIsoOrUndefined(v?: string, endOfDay = false): string | undefined {
  if (!v) return undefined
  const d = new Date(`${v}T00:00:00`)
  if (Number.isNaN(d.getTime())) return undefined
  return `${v}T${endOfDay ? '23:59:59.999' : '00:00:00'}`
}

const NOTE_PREVIEW_LENGTH = 50

/**
 * Notes cell with per-row expand/collapse toggle. Short notes render
 * inline with no toggle. Long notes show a truncated preview by default
 * and a button to reveal the full text. State is local to the row so
 * expanding one note does not affect any other row.
 */
function NotesCell({ note }: { note: string | null | undefined }) {
  const { t } = useTranslation('common')
  const [expanded, setExpanded] = useState(false)
  if (!note) {
    return <span className="text-xs text-gray-600">-</span>
  }
  const isLong = note.length > NOTE_PREVIEW_LENGTH
  if (!isLong) {
    return <span className="text-xs text-gray-600">{note}</span>
  }
  const preview = note.slice(0, NOTE_PREVIEW_LENGTH) + '...'
  const label = expanded
    ? t('pages.clientChains.history.hideFullNote')
    : t('pages.clientChains.history.showFullNote')
  return (
    <span className="inline-flex items-start gap-1 text-xs text-gray-600">
      <span className="whitespace-pre-wrap">{expanded ? note : preview}</span>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={label}
        title={label}
        className="shrink-0 cursor-pointer rounded p-0.5 text-black hover:bg-gray-100"
      >
        {expanded ? (
          <Icons.ArrowUp size={16} strokeWidth={2} />
        ) : (
          <Icons.ArrowDown size={16} strokeWidth={2} />
        )}
      </button>
    </span>
  )
}

export function TAInteractionHistory({ clientId, debts = [] }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const deleteMut = useDeleteTAInteraction()
  // Map debt ID → contract number for display. We deliberately only render
  // debts that are present here; values not in the map are treated as
  // not-a-credit (chain layout drift can shove phone numbers / unrelated
  // values into a step that the *current* chain marks as field_type=credit).
  const debtContractMap = new Map(debts.map((d) => [d.id, `#${d.contract_number ?? d.id}`]))
  // Returns the contract-number display for a credit id, or null if the id
  // does not belong to this client's debts (or looks like a phone — debt
  // ids are <=7 digits in this project, phones are 10+).
  const safeCreditDisplay = (raw: number | string | null | undefined): string | null => {
    if (raw === null || raw === undefined) return null
    const numId = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10)
    if (Number.isNaN(numId)) return null
    if (String(numId).length >= 9) return null // looks like a phone, not a debt id
    return debtContractMap.get(numId) ?? null
  }
  const { t, i18n } = useTranslation('common')
  const togglePinMut = useTogglePinTAInteraction()
  // Pattern Y: buttons always render; warn-on-click if the user lacks the perm.
  const guardEdit = useGuardedAction(
    PERMISSIONS.CLIENTS.EDIT_INTERACTIONS,
    'errors:permissions.editTAInteraction'
  )
  const guardDelete = useGuardedAction(
    PERMISSIONS.CLIENTS.DELETE_INTERACTIONS,
    'errors:permissions.deleteTAInteraction'
  )
  const handleTogglePin = async (id: number) => {
    try {
      await togglePinMut.mutateAsync(id)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  // Filters
  const [pendingFilters, setPendingFilters] = useState({
    chainFilter: '',
    notesSearch: '',
    dateFrom: '',
    dateTo: '',
  })
  const [appliedFilters, setAppliedFilters] = useState({
    chainFilter: '',
    notesSearch: '',
    dateFrom: '',
    dateTo: '',
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const { data: chainsData } = useTAChains({ include_inactive: true })
  const chains = chainsData?.items ?? []

  // TA lookup for identifying credit-type steps
  const { data: tasData } = useTargetActions({ include_hidden: true })
  const taById = useMemo(() => {
    const m = new Map<number, TargetAction>()
    for (const ta of tasData?.items ?? []) m.set(ta.id, ta)
    return m
  }, [tasData])

  // Operator lookup so we can render full names instead of usernames in the
  // Operator column. Snapshot column `recorded_by_name` keeps the username
  // (set at creation), but for display we prefer first+last from the live
  // users directory.
  const user = useAuthStore((s) => s.user)
  const projectId = user?.active_project_id ? parseInt(user.active_project_id, 10) : null
  const { data: operators } = useOperators(projectId)
  const operatorNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const op of operators ?? []) {
      const full = `${op.first_name ?? ''} ${op.last_name ?? ''}`.trim()
      m.set(op.id, full || op.username)
    }
    return m
  }, [operators])

  const { data, isLoading } = useClientTAInteractions(clientId, {
    chain_id: appliedFilters.chainFilter ? parseInt(appliedFilters.chainFilter, 10) : undefined,
    notes_search: appliedFilters.notesSearch || undefined,
    date_from: toIsoOrUndefined(appliedFilters.dateFrom, false),
    date_to: toIsoOrUndefined(appliedFilters.dateTo, true),
    skip: (page - 1) * pageSize,
    limit: pageSize,
  })

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
    const cleared = { chainFilter: '', notesSearch: '', dateFrom: '', dateTo: '' }
    setPendingFilters(cleared)
    setAppliedFilters(cleared)
    setPage(1)
  }

  const dateInputFormat = i18n.language?.startsWith('en') ? 'MM/dd/yyyy' : 'dd/MM/yyyy'

  const columns: Column<TAInteraction>[] = [
    {
      key: 'created_at',
      header: t('pages.clientChains.history.date'),
      align: 'left',
      render: (row) => (
        <span className="text-xs text-gray-700">
          {formatDateTime(row.created_at, user?.timezone)}
        </span>
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
      key: 'phone',
      header: t('pages.clientChains.history.phone'),
      align: 'left',
      render: (row) => {
        if (!row.step_data) return <span className="text-xs text-gray-700">-</span>
        const chain = chains.find((c) => c.id === row.chain_id)
        const stepsOrdered = chain?.steps
          ? [...chain.steps].sort((a, b) => a.step_order - b.step_order)
          : []
        const sd = row.step_data as Record<string, string>
        const phones = new Set<string>()
        const isPhoneShaped = (val: string): boolean => {
          // 10–15 digits after stripping non-digit chars. Debt ids are
          // <=7 digits in this project, so this range cannot collide
          // with a credit value.
          const digits = val.replace(/\D/g, '')
          return digits.length >= 10 && digits.length <= 15
        }
        // 1. Happy path: render whatever the current chain marks as
        //    contact-typed. Validate shape so a retyped step (e.g.
        //    contact → credit) doesn't pump a debt id into this cell.
        for (const step of stepsOrdered) {
          if (step.target_action_field_type !== 'contact') continue
          const val = sd[String(step.step_order)] ?? sd[String(step.target_action_id)]
          if (val && isPhoneShaped(val)) phones.add(val)
        }
        // 2. Drift recovery: if the chain was retyped so the original
        //    contact step is no longer contact (was the user-reported
        //    case), the phone still lives in step_data — pull it back
        //    by scanning all values. We add only phone-shaped strings,
        //    so dropdown labels and small numeric ids never appear.
        for (const val of Object.values(sd)) {
          if (typeof val === 'string' && isPhoneShaped(val)) phones.add(val)
        }
        const uniquePhones = Array.from(phones)
        return (
          <span className="text-xs text-gray-700">
            {uniquePhones.length > 0 ? uniquePhones.join(', ') : '-'}
          </span>
        )
      },
    },
    {
      key: 'result',
      header: t('pages.clientChains.history.result'),
      align: 'left',
      render: (row) => {
        const formatStepValue = (fieldType: string | undefined, val: string): string => {
          // Drift-tolerant credit format: even when the step's current
          // type isn't 'credit', if the value happens to match a real
          // debt for this client we render the contract number so the
          // Result column stays consistent with the Credit column.
          if (fieldType === 'credit' || debtContractMap.has(parseInt(val, 10))) {
            const seen = new Set<number>()
            const out: string[] = []
            for (const id of val
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)) {
              const display = safeCreditDisplay(id)
              if (!display) continue
              const numId = parseInt(id, 10)
              if (seen.has(numId)) continue
              seen.add(numId)
              out.push(display)
            }
            if (out.length > 0) return out.join(', ')
            // Fell through (e.g. credit-typed step holding a phone after
            // drift) — show raw so the step isn't silently dropped.
          }
          if (fieldType === 'amount') return formatMoneyKopeckTight(val)
          if (fieldType === 'date') return formatDateTime(val, user?.timezone)
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
              const sd = row.step_data as Record<string, string>
              const val = sd[String(step.step_order)] ?? sd[String(step.target_action_id)]
              if (!val) continue
              const ta = taById.get(step.target_action_id)
              // Show every saved step in the Result column (workflow
              // trail). The Phone and Credit columns are convenience
              // summary views; we don't suppress values here just
              // because they're also surfaced there.
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
                    const followCredit = safeCreditDisplay(row.credit_id)
                    if (followCredit) followUps.push(followCredit)
                    consumedCredit = true
                  }
                }
              }

              let formattedValue = formatStepValue(ta?.field_type, val)
              // Chain-layout drift: a credit-typed step whose saved value
              // isn't a real debt for this client (e.g. step was contact
              // when the phone was captured, then retyped to credit).
              // Don't pretend it's a debt id (#raw) and don't silently
              // drop the step — show the raw value so operators see the
              // step ran, while keeping the dedicated Credit column
              // clean of phones.
              if (ta?.field_type === 'credit' && !formattedValue) {
                formattedValue = val
              }
              entries.push({ value: formattedValue, followUps })
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
          const orphanCredit = safeCreditDisplay(row.credit_id)
          if (orphanCredit) orphan.push(orphanCredit)
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
        // Collect credit IDs from both sources (legacy top-level field
        // and credit-type chain steps), dedupe by numeric id, and drop
        // values that aren't real debts. Filtering through
        // safeCreditDisplay is what prevents three failure modes:
        //   - phones showing up here when an old contact step is now
        //     marked field_type='credit' (chain edited after save),
        //   - the same loan appearing twice when row.credit_id and a
        //     credit-step value both reference the same debt,
        //   - raw "#<numeric id>" leaking when the debt isn't in this
        //     client's debtContractMap (cross-project / soft-deleted).
        const seen = new Set<number>()
        const creditIds: string[] = []
        const addCredit = (raw: number | string | null | undefined) => {
          const display = safeCreditDisplay(raw)
          if (!display) return
          const numId = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10)
          if (seen.has(numId)) return
          seen.add(numId)
          creditIds.push(display)
        }
        if (row.credit_id) addCredit(row.credit_id)
        if (row.step_data) {
          // Scan every step_data value — not just credit-typed steps —
          // so a debt id saved when the step was credit but later
          // retyped (chain drift) still shows up here. addCredit /
          // safeCreditDisplay only accept real debts of this client,
          // so non-credit values (phones, dropdown labels, dates)
          // never leak in.
          const sd = row.step_data as Record<string, string>
          for (const v of Object.values(sd)) {
            if (typeof v !== 'string') continue
            for (const id of v.split(',')) addCredit(id.trim())
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
      render: (row) => <NotesCell note={row.notes} />,
    },
    {
      key: 'recorded_by_name',
      header: t('pages.clientChains.history.operator'),
      align: 'left',
      render: (row) => {
        const display =
          (row.recorded_by != null ? operatorNameById.get(row.recorded_by) : null) ??
          row.recorded_by_name ??
          '-'
        return <span className="text-xs text-gray-600">{display}</span>
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => handleTogglePin(row.id)}
            disabled={togglePinMut.isPending}
            className={`rounded p-1 transition-colors ${
              row.is_pinned
                ? 'text-amber-500 hover:bg-amber-50'
                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
            }`}
            aria-label={row.is_pinned ? t('pages.clientChains.unpin') : t('pages.clientChains.pin')}
            title={row.is_pinned ? t('pages.clientChains.unpin') : t('pages.clientChains.pin')}
          >
            <Icons.Pin size={14} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => guardEdit(() => setEditingId(row.id))}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-800"
            aria-label={t('actions.edit')}
            title={t('actions.edit')}
          >
            <Icons.PencilEdit size={14} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => guardDelete(() => setDeletingId(row.id))}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
            aria-label={t('actions.delete')}
            title={t('actions.delete')}
          >
            <Icons.Delete size={14} strokeWidth={1.5} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <div className="rounded-xl bg-white/50 p-3 sm:p-4">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="flex flex-col gap-2">
              <label className="text-dark-500 text-xs leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clientChains.history.filterChain')}
              </label>
              <Select
                value={pendingFilters.chainFilter}
                onValueChange={(v) =>
                  setPendingFilters((prev) => ({ ...prev, chainFilter: v === 'all' ? '' : v }))
                }
              >
                <SelectTrigger className="max-h-[45px] w-full rounded-md border border-gray-200 bg-white text-xs">
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
            <div className="flex flex-col gap-2">
              <label className="text-dark-500 text-xs leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clientChains.history.from')}
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
                {t('pages.clientChains.history.to')}
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
                {t('pages.clientChains.history.searchNotes')}
              </label>
              <Input
                type="text"
                className="max-h-[45px] w-full rounded-md border border-gray-200 bg-white text-xs"
                placeholder={t('pages.clientChains.history.searchNotesPlaceholder')}
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

      {/* Table */}
      {isLoading ? (
        <TableSkeleton columns={9} rows={3} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 self-stretch py-8 md:gap-6">
          <div className="flex flex-col items-center justify-center gap-4 self-stretch py-8 sm:flex-row md:gap-6">
            <Icons.FileRemove size={48} className="text-gray-500" strokeWidth={0.5} />
            <p className="text-dark-500 text-center text-xl leading-tight font-light tracking-[-0.48px] md:text-2xl">
              {t('pages.clientChains.history.empty')}
            </p>
          </div>
        </div>
      ) : (
        <DataTable columns={columns} data={items} className="w-full" />
      )}

      <EditTAInteractionModal
        open={editingId !== null}
        interactionId={editingId}
        onClose={() => setEditingId(null)}
        debts={debts}
      />

      <Modal open={deletingId !== null} onClose={() => setDeletingId(null)} maxWidth="sm">
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <Icons.Delete size={26} className="text-red-600" strokeWidth={1.8} />
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className="text-base font-semibold text-gray-900">
              {t('pages.clientChains.history.deleteTitle')}
            </h3>
            <p className="text-sm text-gray-500">{t('pages.clientChains.history.deleteConfirm')}</p>
          </div>
          <div className="mt-2 flex w-full gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeletingId(null)}
              disabled={deleteMut.isPending}
            >
              {t('actions.cancel')}
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={deleteMut.isPending}
              onClick={async () => {
                try {
                  await deleteMut.mutateAsync(deletingId!)
                  setDeletingId(null)
                  toast.success(t('pages.clientChains.history.deleteSuccess'))
                } catch (err) {
                  toast.error(getErrorMessage(err))
                }
              }}
            >
              {t('actions.delete')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex w-full items-center justify-center">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={[10, 20, 50, 100]}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
    </div>
  )
}
