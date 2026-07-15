import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useScorecards, useDeleteScorecard } from '@/features/quality'
import { useConfirm } from '@/components/ui/useConfirm'
import { useOperators } from '@/features/users/hooks'
import { useCallsBatch } from '@/features/calls/hooks/useCall'
import { useClientNames } from '@/features/clients/hooks/useClients'
import { useAuthStore } from '@/stores/authStore'
import { buildDialogueRows } from '../../lib/dialogueScorecardAdapter'
import type { CallContactInfo } from '../../lib/dialogueScorecardAdapter'
import { useScopedUserIds } from '../../lib/scope'
import { TrainingSegmentedStrip } from '../chrome/TrainingSegmentedStrip'
import { EmployeeMultiSelect } from './EmployeeMultiSelect'
import { ScorecardListView } from './ScorecardListView'
import { CallReviewPanel } from './CallReviewPanel'
import { AvgScoreByTypeView } from './AvgScoreByTypeView'
import { NewAssessmentButton } from './NewAssessmentButton'

type CategoryChip = 'all' | 'low' | 'average' | 'high'
type DialogueView = 'list' | 'averages'
type TelephonyFilter = '' | 'white' | 'grey' | 'unknown'

const DEFAULT_PAGE_SIZE = 50

/** A picker date (YYYY-MM-DD) → ISO at the day's start/end so the tz-aware
 *  `call_started_at` range parses (pydantic 2.5 rejects a bare date). */
function dayStartIso(date: string): string | undefined {
  return date ? new Date(`${date}T00:00:00`).toISOString() : undefined
}
function dayEndIso(date: string): string | undefined {
  return date ? new Date(`${date}T23:59:59.999`).toISOString() : undefined
}

export function DialogueEvaluationTab() {
  const { t } = useTranslation('common')
  const [activeCategory, setActiveCategory] = useState<CategoryChip>('all')
  const [view, setView] = useState<DialogueView>('list')
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([])
  // KAN-827 call-attribute filters (server-side over denormalized columns).
  const [nameQuery, setNameQuery] = useState('')
  const [telephonyType, setTelephonyType] = useState<TelephonyFilter>('')
  const [callFrom, setCallFrom] = useState('')
  const [callTo, setCallTo] = useState('')
  const [minDuration, setMinDuration] = useState('')
  // Unsaved-changes guard: the review panel reports its dirty state so we can
  // warn before switching rows (which would discard the edit).
  const [reviewDirty, setReviewDirty] = useState(false)

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)
  const scoped = useScopedUserIds(operators)

  // Resolve the ФИО (full-name) search to operator ids, then intersect with the
  // multi-select / scope so the server filters on the ``operator_id`` column.
  // ``undefined`` means "no operator restriction" (scope=all/group) — kept as-is
  // so the server returns every operator's scorecards.
  const operatorIds = useMemo<number[] | undefined>(() => {
    const base = selectedEmployeeIds.length > 0 ? selectedEmployeeIds : scoped.userIds
    const q = nameQuery.trim().toLowerCase()
    if (!q) return base
    const matches = operators.filter((o) => o.full_name?.toLowerCase().includes(q)).map((o) => o.id)
    // With an unrestricted base, the name matches become the restriction; else
    // intersect the name matches with the existing scope/selection.
    const matchSet = new Set(matches)
    return base ? base.filter((id) => matchSet.has(id)) : matches
  }, [selectedEmployeeIds, scoped.userIds, nameQuery, operators])

  const filters = useMemo(
    () => ({
      operator_id: operatorIds,
      telephony_type: telephonyType || undefined,
      call_from: dayStartIso(callFrom),
      call_to: dayEndIso(callTo),
      min_talk_duration: minDuration ? Number(minDuration) : undefined,
      page: 1,
      page_size: DEFAULT_PAGE_SIZE,
    }),
    [operatorIds, telephonyType, callFrom, callTo, minDuration]
  )

  // No operators to query for: scope resolved empty, or a name search / employee
  // selection narrowed to an explicit empty list. Don't fetch — an empty
  // operator_id array would otherwise be omitted and widen to the whole project.
  // (``undefined`` = "all operators" and must still fetch.)
  const noOperators =
    scoped.isEmptyResolution || (Array.isArray(operatorIds) && operatorIds.length === 0)
  const { data, isLoading, isError } = useScorecards(filters, !noOperators)

  // Scorecards carry only call_id; resolve the contacted number + client for
  // every row in one batched call-service request (vs. N per-row fetches).
  const callIds = useMemo(() => (data?.data ?? []).map((s) => s.call_id), [data?.data])
  const { data: callBatch } = useCallsBatch(callIds)

  const callLookup = useMemo(() => {
    const map = new Map<string, CallContactInfo>()
    for (const c of callBatch ?? []) {
      map.set(c.call_id, { customer_number: c.customer_number, client_id: c.client_id })
    }
    return map
  }, [callBatch])

  // Resolve the unique, non-null client ids to display names (cached per id,
  // shared with client detail pages).
  const clientIds = useMemo(
    () =>
      Array.from(
        new Set((callBatch ?? []).map((c) => c.client_id).filter((id): id is number => id != null))
      ),
    [callBatch]
  )
  const clientNames = useClientNames(clientIds)

  const rows = useMemo(
    () => buildDialogueRows(data?.data ?? [], operators, callLookup, clientNames),
    [data?.data, operators, callLookup, clientNames]
  )

  const categoryCounts = useMemo(
    () => ({
      all: rows.length,
      low: rows.filter((r) => r.category === 'Low').length,
      average: rows.filter((r) => r.category === 'Average').length,
      high: rows.filter((r) => r.category === 'High').length,
    }),
    [rows]
  )

  const categoryChips = useMemo(
    () =>
      // KAN-504: All calls · Low · Average · High.
      (
        [
          { id: 'all' as const, label: t('pages.training.dialogue.chips.all', 'All calls') },
          { id: 'low' as const, label: t('pages.training.dialogue.chips.low', 'Low') },
          { id: 'average' as const, label: t('pages.training.dialogue.chips.average', 'Average') },
          { id: 'high' as const, label: t('pages.training.dialogue.chips.high', 'High') },
        ] as const
      ).map((c) => ({
        id: c.id,
        label: c.label,
        count: categoryCounts[c.id],
      })),
    [t, categoryCounts]
  )

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (activeCategory === 'all') return true
        if (activeCategory === 'low') return r.category === 'Low'
        if (activeCategory === 'average') return r.category === 'Average'
        if (activeCategory === 'high') return r.category === 'High'
        return true
      }),
    [rows, activeCategory]
  )

  // Derive the effective selection during render (no setState-in-effect):
  // honour the user's pick while it's still visible, else fall back to the
  // first row in the active filter.
  const effectiveSelectedId =
    selectedRowId != null && filteredRows.some((r) => r.id === selectedRowId)
      ? selectedRowId
      : (filteredRows[0]?.id ?? null)

  // The interactive review panel needs the raw scorecard (call_id, operator_id).
  const selectedScorecard = useMemo(
    () => data?.data?.find((s) => s.id === effectiveSelectedId),
    [data?.data, effectiveSelectedId]
  )
  const selectedOperatorName = useMemo(() => {
    if (!selectedScorecard) return undefined
    return operators.find((o) => o.id === selectedScorecard.operator_id)?.full_name ?? undefined
  }, [selectedScorecard, operators])

  const { confirm, confirmDialog } = useConfirm()

  // Guard against discarding unsaved edits when switching rows.
  const handleSelectRow = async (id: number) => {
    if (reviewDirty && id !== effectiveSelectedId) {
      const ok = await confirm({
        title: t('pages.training.scorecard.unsaved', 'Unsaved changes'),
        message: t(
          'pages.training.scorecard.unsavedConfirm',
          'You have unsaved changes that will be lost. Close anyway?'
        ),
        confirmLabel: t('pages.training.scorecard.discardConfirm', 'Discard changes'),
        tone: 'danger',
      })
      if (!ok) return
    }
    setSelectedRowId(id)
  }

  const deleteMutation = useDeleteScorecard()
  const handleDeleteRow = async (id: number) => {
    const ok = await confirm({
      title: t('pages.training.dialogue.list.deleteTitle', 'Delete draft'),
      message: t('pages.training.dialogue.list.deleteConfirm', 'Delete this draft assessment?'),
      confirmLabel: t('pages.training.dialogue.list.delete', 'Delete draft'),
      tone: 'danger',
    })
    if (!ok) return
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success(t('pages.training.dialogue.list.deleted', 'Assessment deleted'))
        if (selectedRowId === id) setSelectedRowId(null)
      },
      onError: () =>
        toast.error(t('pages.training.dialogue.list.deleteFailed', 'Could not delete assessment')),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {confirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {view === 'list' ? (
          <TrainingSegmentedStrip
            items={categoryChips}
            activeId={activeCategory}
            onChange={(id) => setActiveCategory(id as CategoryChip)}
          />
        ) : (
          <div />
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="inline-flex rounded-md border border-[#EBECE8] p-0.5">
            {(['list', 'averages'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`h-9 rounded px-3 text-xs font-medium transition-colors ${
                  view === v ? 'bg-[#204E4D] text-white' : 'text-[#6B7280] hover:text-[#05040D]'
                }`}
              >
                {v === 'list'
                  ? t('pages.training.dialogue.view.list', 'Scorecards')
                  : t('pages.training.dialogue.view.averages', 'Averages')}
              </button>
            ))}
          </div>
          <NewAssessmentButton />
          <EmployeeMultiSelect
            value={selectedEmployeeIds}
            onChange={setSelectedEmployeeIds}
            operators={operators}
          />
        </div>
      </div>

      {view === 'list' ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder={t(
              'pages.training.dialogue.filters.namePlaceholder',
              'Search by full name…'
            )}
            className="h-9 w-[200px] rounded-lg border border-[#DFDFDF] bg-white px-3 text-xs text-[#05040D] focus:outline-none"
          />
          <select
            value={telephonyType}
            onChange={(e) => setTelephonyType(e.target.value as TelephonyFilter)}
            className="h-9 rounded-lg border border-[#DFDFDF] bg-white px-3 text-xs text-[#05040D] focus:outline-none"
          >
            <option value="">{t('pages.training.dialogue.filters.allTypes', 'All types')}</option>
            <option value="white">{t('pages.training.dialogue.filters.white', 'White')}</option>
            <option value="grey">{t('pages.training.dialogue.filters.grey', 'Grey')}</option>
            <option value="unknown">
              {t('pages.training.dialogue.filters.unknown', 'Unknown')}
            </option>
          </select>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#6B7280]">
              {t('pages.training.dialogue.filters.callDate', 'Call date')}
            </span>
            <input
              type="date"
              value={callFrom}
              onChange={(e) => setCallFrom(e.target.value)}
              className="h-9 rounded-lg border border-[#DFDFDF] bg-white px-2 text-xs text-[#05040D] focus:outline-none"
            />
            <span className="text-[10px] text-[#6B7280]">–</span>
            <input
              type="date"
              value={callTo}
              onChange={(e) => setCallTo(e.target.value)}
              className="h-9 rounded-lg border border-[#DFDFDF] bg-white px-2 text-xs text-[#05040D] focus:outline-none"
            />
          </div>
          <input
            type="number"
            min={0}
            value={minDuration}
            onChange={(e) => setMinDuration(e.target.value)}
            placeholder={t('pages.training.dialogue.filters.minDuration', 'Min talk (sec)')}
            className="h-9 w-[130px] rounded-lg border border-[#DFDFDF] bg-white px-3 text-xs text-[#05040D] focus:outline-none"
          />
        </div>
      ) : null}

      {view === 'averages' ? (
        <AvgScoreByTypeView operatorIds={filters.operator_id} />
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_520px]">
          {noOperators ? (
            <div className="rounded-xl bg-white/50 p-12 text-center text-sm text-gray-500 shadow-sm">
              {t(
                'pages.training.errors.emptyScopeResolution',
                'The selected scope returned no operators.'
              )}
            </div>
          ) : isLoading ? (
            <div className="rounded-xl bg-white p-12 text-center text-sm text-[#6B7280] shadow-sm">
              {t('common.loading', 'Loading…')}
            </div>
          ) : isError ? (
            <div className="rounded-xl bg-white p-12 text-center text-sm text-red-500 shadow-sm">
              {t('pages.training.errors.loadScorecardsFailed', 'Failed to load scorecards')}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-xl bg-white p-12 text-center text-sm text-[#6B7280] shadow-sm">
              {t('pages.training.scorecardsEmpty', 'No scorecards in scope.')}
            </div>
          ) : (
            <ScorecardListView
              rows={filteredRows}
              selectedId={effectiveSelectedId}
              onSelect={handleSelectRow}
              onDelete={handleDeleteRow}
            />
          )}
          <CallReviewPanel
            scorecard={selectedScorecard}
            operatorName={selectedOperatorName}
            onDirtyChange={setReviewDirty}
          />
        </div>
      )}
    </div>
  )
}

export default DialogueEvaluationTab
