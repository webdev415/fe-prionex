import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useScorecards, useDeleteScorecard } from '@/features/quality'
import { useOperators } from '@/features/users/hooks'
import { useAuthStore } from '@/stores/authStore'
import { buildDialogueRows } from '../../lib/dialogueScorecardAdapter'
import { useScopedUserIds } from '../../lib/scope'
import { TrainingSegmentedStrip } from '../chrome/TrainingSegmentedStrip'
import { EmployeeMultiSelect } from './EmployeeMultiSelect'
import { ScorecardListView } from './ScorecardListView'
import { CallReviewPanel } from './CallReviewPanel'
import { AvgScoreByTypeView } from './AvgScoreByTypeView'
import { NewAssessmentButton } from './NewAssessmentButton'

type CategoryChip = 'all' | 'low' | 'average' | 'high'
type DialogueView = 'list' | 'averages'

const DEFAULT_PAGE_SIZE = 50

export function DialogueEvaluationTab() {
  const { t } = useTranslation('common')
  const [activeCategory, setActiveCategory] = useState<CategoryChip>('all')
  const [view, setView] = useState<DialogueView>('list')
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([])
  // Unsaved-changes guard: the review panel reports its dirty state so we can
  // warn before switching rows (which would discard the edit).
  const [reviewDirty, setReviewDirty] = useState(false)

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)
  const scoped = useScopedUserIds(operators)

  const filters = useMemo(
    () => ({
      operator_id: selectedEmployeeIds.length > 0 ? selectedEmployeeIds : scoped.userIds,
      page: 1,
      page_size: DEFAULT_PAGE_SIZE,
    }),
    [selectedEmployeeIds, scoped.userIds]
  )

  const { data, isLoading, isError } = useScorecards(filters, !scoped.isEmptyResolution)

  const rows = useMemo(
    () => buildDialogueRows(data?.data ?? [], operators),
    [data?.data, operators]
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

  // Guard against discarding unsaved edits when switching rows.
  const handleSelectRow = (id: number) => {
    if (
      reviewDirty &&
      id !== effectiveSelectedId &&
      !window.confirm(
        t(
          'pages.training.scorecard.unsavedConfirm',
          'You have unsaved changes that will be lost. Close anyway?'
        )
      )
    ) {
      return
    }
    setSelectedRowId(id)
  }

  const deleteMutation = useDeleteScorecard()
  const handleDeleteRow = (id: number) => {
    if (
      !window.confirm(
        t('pages.training.dialogue.list.deleteConfirm', 'Delete this draft assessment?')
      )
    ) {
      return
    }
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

      {view === 'averages' ? (
        <AvgScoreByTypeView operatorIds={filters.operator_id} />
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_520px]">
          {scoped.isEmptyResolution ? (
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
