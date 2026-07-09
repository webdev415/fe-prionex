/**
 * Enhanced TA Interaction history for client card.
 * Shows full dictionary path, filters by date/chain/notes, pagination.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { creditIdsFromCreditSteps, extractPhones } from './taFieldMapping'
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
import { useHasPermission } from '@/hooks'
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
  const { t } = useTranslation('common')
  const togglePinMut = useTogglePinTAInteraction()
  // Pattern X: hide buttons entirely when the user lacks the permission.
  const canEditInteractions = useHasPermission(PERMISSIONS.CLIENTS.EDIT_INTERACTIONS)
  const canDeleteInteractions = useHasPermission(PERMISSIONS.CLIENTS.DELETE_INTERACTIONS)
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
  // O(1) chain lookup by id — the column renderers resolve a row's chain on
  // every render, so a Map avoids a linear scan per row per column.
  const chainById = useMemo(() => {
    const m = new Map<number, (typeof chains)[number]>()
    for (const c of chainsData?.items ?? []) m.set(c.id, c)
    return m
  }, [chainsData])

  // TA lookup for identifying credit-type steps
  const { data: tasData } = useTargetActions({ include_hidden: true })
  const taById = useMemo(() => {
    const m = new Map<number, TargetAction>()
    for (const ta of tasData?.items ?? []) m.set(ta.id, ta)
    return m
  }, [tasData])

  // Read each row's step values from the interaction's OWN step_data, keyed by
  // step_order. This is the single query that backs the table and is refreshed
  // on every edit, so the displayed value is STABLE — it can't flip as a
  // separate chain-instances (snapshot) query loads or its cache goes stale.
  // (An earlier version read the snapshot first; because the edit mutation only
  // invalidates the interactions query, the snapshot stayed cached and the
  // value flickered on navigation — KAN-744.) Phantom values that drifted into
  // the wrong step are filtered downstream by field type: credits come only
  // from credit steps, and a dropdown step skips values that match no option.
  // The backend keeps this copy reconciled with the wizard snapshot on
  // create/edit, so it is the authoritative record for display.
  const resolvedStepData = (row: TAInteraction): Record<string, string> => {
    const sd = (row.step_data ?? {}) as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(sd)) {
      const s = typeof v === 'object' && v !== null ? (v as { value?: unknown }).value : v
      if (s != null && String(s) !== '') out[k] = String(s)
    }
    return out
  }

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
        const chain = chainById.get(row.chain_id)
        const stepsOrdered = chain?.steps ?? []
        // extractPhones shape-checks every value (rejecting dates, datetimes,
        // debt-id lists and dropdown labels), so a date like
        // "2026-05-15T10:30:00" can no longer leak into the Phone column.
        // See taFieldMapping.ts (Bug 1). Resolve snapshot-first so the Phone
        // column matches the Edit modal's per-step values.
        const uniquePhones = extractPhones(resolvedStepData(row), stepsOrdered)
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
          // Credit-format ONLY actual credit steps. A debt-id-shaped value
          // sitting in a non-credit step is a phantom (chain drift / a stray
          // value) and must not be rendered as a credit — that's what made a
          // one-credit-step chain look like it had several (KAN-744).
          if (fieldType === 'credit') {
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
          // Universal chain-drift guard. The renderer can't trust the
          // step's *current* declared field_type because the chain
          // admin may have retyped a step after a TA was saved — the
          // stored value's shape is the more reliable signal. Three
          // layers, from most to least confident:
          //   (a) If the value clearly looks like an ISO datetime,
          //       render it as a date regardless of declared type
          //       (handles date → anything drift, e.g. "₴2026.00"
          //       coming from a year inside a date string).
          //   (b) For amount type, only format as money when the value
          //       is a clean numeric string; otherwise show raw
          //       (handles anything → amount drift).
          //   (c) For date type at this point we know it's NOT an
          //       ISO date — show raw instead of producing garbage
          //       from formatDateTime parsing e.g. "1500.50" as a
          //       timestamp (handles anything → date drift).
          const trimmed = val.trim()
          const isoDatetimePattern =
            /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/
          if (isoDatetimePattern.test(trimmed)) {
            return formatDateTime(trimmed, user?.timezone)
          }
          if (fieldType === 'amount') {
            const looksNumeric = /^-?\d+(\.\d+)?$/.test(trimmed)
            if (looksNumeric && Number.isFinite(parseFloat(trimmed))) {
              return formatMoneyKopeckTight(trimmed)
            }
            return val
          }
          if (fieldType === 'date') {
            // Not an ISO date (the detector above would have caught
            // it). Don't run formatDateTime; show raw.
            return val
          }
          return val
        }

        // Build step entries in chain order. Each dropdown step that
        // requested follow-ups gets them inline as `(date, amount, credit)`.
        const entries: { value: string; followUps: string[] }[] = []
        let consumedPromiseDate = false
        let consumedPromiseAmount = false
        let consumedCredit = false

        if (row.step_data && Object.keys(row.step_data).length > 0) {
          const chain = chainById.get(row.chain_id)
          const stepsOrdered = chain?.steps
            ? [...chain.steps].sort((a, b) => a.step_order - b.step_order)
            : []
          // Snapshot-first resolution — same source the Edit modal reads.
          const resolved = resolvedStepData(row)

          if (stepsOrdered.length > 0) {
            for (const step of stepsOrdered) {
              const val = resolved[String(step.step_order)]
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
                // A dropdown value that matches no real option is a phantom
                // (e.g. a credit id drifted into this slot). The Edit modal
                // shows it as empty, so skip the step here too rather than
                // print a stray value as if a step ran (KAN-744).
                if (!picked) continue
                if (picked.require_promise_date && row.promise_date && !consumedPromiseDate) {
                  followUps.push(formatDate(row.promise_date))
                  consumedPromiseDate = true
                }
                if (picked.require_promise_amount && row.promise_amount && !consumedPromiseAmount) {
                  followUps.push(formatMoneyKopeckTight(row.promise_amount))
                  consumedPromiseAmount = true
                }
                if (picked.require_credit && row.credit_id && !consumedCredit) {
                  const followCredit = safeCreditDisplay(row.credit_id)
                  if (followCredit) followUps.push(followCredit)
                  consumedCredit = true
                }
              }

              // A credit step whose value resolves to no real debt for this
              // client (e.g. a phone that bled into the credit slot) is a
              // phantom — skip it instead of printing the raw value as if a
              // credit step ran. Mirrors the dropdown skip above and matches
              // the Credit column, which already excludes such values (KAN-744).
              if (ta?.field_type === 'credit') {
                const hasRealCredit = val.split(',').some((id) => safeCreditDisplay(id.trim()))
                if (!hasRealCredit) continue
              }
              const formattedValue = formatStepValue(ta?.field_type, val)
              // Render every saved step faithfully — including a credit
              // that repeats across steps. Collapsing repeats used to hide
              // that multiple steps ran, making a multi-step chain look like
              // a single step (KAN-744). The Result column is the full
              // workflow trail, so each step the operator completed is shown.
              entries.push({ value: formattedValue, followUps })
            }
          } else {
            // No ordered steps (chain deleted or not loaded yet): fall back to
            // the interaction's own values. Iterate `resolved`, never raw
            // step_data — a value may be a rich object
            // ({value, autofilled, target_action_id, target_action_name}) from
            // the chain-autofill feature, and rendering one raw throws React
            // error #31, blanking the whole client profile.
            for (const val of Object.values(resolved)) {
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
        // Credits come ONLY from the chain's credit-type steps, read from the
        // SAME snapshot-first resolution the Edit modal uses. This is what
        // keeps the Credit column equal to the Edit modal: a debt id that
        // drifted into a non-credit step (a phantom) is ignored, and a credit
        // step holding several picks shows them all. See creditIdsFromCreditSteps.
        const resolved = resolvedStepData(row)
        const creditChain = chainById.get(row.chain_id)
        const creditSteps = (creditChain?.steps ?? []).map((s) => ({
          step_order: s.step_order,
          field_type: taById.get(s.target_action_id)?.field_type,
        }))
        for (const id of creditIdsFromCreditSteps(creditSteps, resolved)) {
          addCredit(id)
        }
        // Legacy top-level credit_id is a single-value fallback used ONLY when
        // the chain has no credit step (older interactions).
        if (creditIds.length === 0 && row.credit_id) addCredit(row.credit_id)
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
          {canEditInteractions && (
            <button
              type="button"
              onClick={() => setEditingId(row.id)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-800"
              aria-label={t('actions.edit')}
              title={t('actions.edit')}
            >
              <Icons.PencilEdit size={14} strokeWidth={1.5} />
            </button>
          )}
          {canDeleteInteractions && (
            <button
              type="button"
              onClick={() => setDeletingId(row.id)}
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
              aria-label={t('actions.delete')}
              title={t('actions.delete')}
            >
              <Icons.Delete size={14} strokeWidth={1.5} />
            </button>
          )}
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
                allowManualInput
                format="dd.MM.yyyy"
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
                allowManualInput
                format="dd.MM.yyyy"
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
